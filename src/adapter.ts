/**
 * The harness-facing adapter: an `LlmAdapter` that serves model calls
 * from the public Responses API (`POST /v1/responses`) with the signed-in
 * account's SIWC plan token.
 *
 * The adapter never signs anyone in — interactive login belongs to the
 * CLI and the settings surface. It only uses stored credentials:
 * `ensureAccessToken` refreshes a near-expiry token non-interactively,
 * and a missing/revoked credential fails as an `AUTH` LlmError naming
 * the fix. Plan usage is checked from the account's granted scopes
 * before any request is sent; identity alone never enables a call.
 *
 * Stream translation: Responses SSE events become harness StreamChunks —
 * text and reasoning deltas open text/reasoning blocks, function-call
 * argument deltas open tool-call blocks, `response.completed` yields
 * usage (input tokens reported uncached, per the TokenUsage contract)
 * and the finish chunk. Provider failures — including the
 * `subscription_sharing_*` family, before or mid-stream — surface as
 * LlmErrors carrying the plain-language explanation from errors.ts.
 *
 * @module dsh-chatgpt-siwc/adapter
 */

import { attributionHeaders, LlmAdapter, LlmError, ReasoningEffortId, ToolCallId } from '@deepseek-ai/dsh-llm'
import type {
  ContentBlock,
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  StreamChunk,
  TokenUsage,
} from '@deepseek-ai/dsh-llm'
import { API_BASE_URL } from './constants.ts'
import { describeSubscriptionError, isSubscriptionError, isUsageLimitError, SiwcError } from './errors.ts'
import { ensureAccessToken, fetchModels } from './oauth.ts'
import type { SiwcOverrides } from './oauth.ts'
import { serializeRequest } from './serialize.ts'
import { parseSseEvents } from './sse.ts'
import { planGranted } from './store.ts'
import type { AccountsStore } from './store.ts'

export interface SiwcAdapterOptions {
  store: AccountsStore
  /** Public API base; defaults to the documented production base. */
  apiBaseUrl?: string
  /** Reasoning effort materialized when a call names none. */
  reasoningEffort?: string
  /** Test/embedding seam: override fetch. */
  fetchFn?: typeof fetch
}

/** Display name of the one provider route this adapter serves. */
export const PROVIDER_DISPLAY_NAME = 'ChatGPT (Sign in with ChatGPT)'

const EFFORTS = ['low', 'medium', 'high'] as const

interface ResponsesUsage {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  input_tokens_details?: { cached_tokens?: number }
  output_tokens_details?: { reasoning_tokens?: number }
}

interface ResponsesEventPayload {
  output_index?: number
  delta?: string
  item?: {
    type?: string
    call_id?: string
    id?: string
    name?: string
    arguments?: string
    content?: { type?: string; text?: string }[]
    summary?: { type?: string; text?: string }[]
  }
  response?: {
    usage?: ResponsesUsage
    error?: { code?: string; message?: string }
  }
  code?: string
  message?: string
}

interface BlockState {
  index: number
  kind: 'text' | 'reasoning' | 'tool-call'
  started: boolean
  ended: boolean
  text: string
  callId?: string
  name?: string
  args: string
}

/** Map any failure onto the harness error vocabulary. */
function toLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err
  if (err instanceof SiwcError) {
    if (err.code === 'REAUTH_REQUIRED' || err.code === 'MISSING_CREDENTIAL') {
      return new LlmError(
        'ChatGPT sign-in is missing or no longer valid. Run `dsh-chatgpt-siwc login` (or sign in from the harness settings) and try again.',
        'AUTH',
        { cause: err },
      )
    }
    return new LlmError(err.message, err.code, { cause: err })
  }
  return new LlmError(err instanceof Error ? err.message : String(err), 'PROVIDER_ERROR', { cause: err })
}

/** A provider-side failure (Responses error body or stream error event). */
function providerError(code: string | undefined, message: string | undefined, status?: number): LlmError {
  if (isSubscriptionError(code)) {
    return new LlmError(
      describeSubscriptionError(code, message),
      isUsageLimitError(code) ? 'USAGE_LIMIT' : 'PROVIDER_ERROR',
      status ? { status } : undefined,
    )
  }
  return new LlmError(message || 'the provider reported an error', code || 'PROVIDER_ERROR', status ? { status } : undefined)
}

/** Responses usage → harness TokenUsage (input tokens are uncached-only). */
function mapUsage(u: ResponsesUsage): TokenUsage {
  const cached = u.input_tokens_details?.cached_tokens ?? 0
  return {
    inputTokens: Math.max(0, (u.input_tokens ?? 0) - cached),
    outputTokens: u.output_tokens ?? 0,
    totalTokens: u.total_tokens,
    cacheReadTokens: cached || undefined,
    reasoningTokens: u.output_tokens_details?.reasoning_tokens,
  }
}

export class ChatGptSiwcAdapter extends LlmAdapter {
  private readonly store: AccountsStore
  private readonly apiBaseUrl: string
  private readonly reasoningEffort?: string
  private readonly fetchFn: typeof fetch

  constructor(options: SiwcAdapterOptions) {
    super()
    this.store = options.store
    this.apiBaseUrl = options.apiBaseUrl ?? API_BASE_URL
    this.reasoningEffort = options.reasoningEffort
    this.fetchFn = options.fetchFn ?? fetch
  }

  private overrides(): SiwcOverrides {
    return { fetchFn: this.fetchFn }
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: PROVIDER_DISPLAY_NAME }
  }

  /** The signed-in account's cached catalog (offline-safe). */
  private async cachedModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const active = await this.store.active().catch(() => undefined)
    return (active?.models ?? []).map((m) => ({
      provider,
      id: m.slug,
      name: m.displayName,
      inputModalities: ['text'] as const,
    }))
  }

  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    try {
      const { account, accessToken } = await ensureAccessToken(this.store, { overrides: this.overrides() })
      if (!planGranted(account)) return this.cachedModels(provider)
      const models = await fetchModels(accessToken, { ...this.overrides(), apiBaseUrl: this.apiBaseUrl })
      await this.store.saveModels(account.client_id, models).catch(() => undefined)
      return models.map((m) => ({
        provider,
        id: m.slug,
        name: m.displayName,
        inputModalities: ['text'] as const,
      }))
    } catch {
      return this.cachedModels(provider)
    }
  }

  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return {
      provider,
      id: model,
      name: model,
      inputModalities: ['text'],
      reasoning: {
        efforts: EFFORTS.map((id) => ({ id: ReasoningEffortId(id), name: id })),
        defaultEffort: this.reasoningEffort ? ReasoningEffortId(this.reasoningEffort) : undefined,
      },
    }
  }

  /** A non-2xx response before the stream opens (admission failure). */
  private async admissionError(response: Response): Promise<LlmError> {
    const text = await response.text().catch(() => '')
    let code: string | undefined
    let message: string | undefined
    try {
      const body = JSON.parse(text) as { error?: { code?: string; message?: string }; detail?: string }
      code = body.error?.code
      message = body.error?.message ?? body.detail
    } catch {
      message = text || undefined
    }
    if (isSubscriptionError(code)) return providerError(code, message, response.status)
    if (response.status === 401) {
      return new LlmError(
        'the ChatGPT plan token was refused. Run `dsh-chatgpt-siwc login` to sign in again.',
        'AUTH',
        { status: 401 },
      )
    }
    if (response.status === 429) {
      return new LlmError(message || 'rate limited by the provider', 'RATE_LIMIT', { status: 429 })
    }
    return new LlmError(message || `the provider answered HTTP ${response.status}`, 'PROVIDER_ERROR', { status: response.status })
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    let auth: Awaited<ReturnType<typeof ensureAccessToken>>
    try {
      auth = await ensureAccessToken(this.store, { overrides: this.overrides() })
    } catch (err) {
      throw toLlmError(err)
    }
    if (!planGranted(auth.account)) {
      throw new LlmError(
        'this ChatGPT account is signed in, but plan usage was not granted for this app. Check the app\'s plan access and per-app cap in ChatGPT settings (Manage usage), then sign in again.',
        'AUTH',
      )
    }

    const body = serializeRequest(options, {
      reasoningEffort: options.reasoningEffort ?? this.reasoningEffort,
    })

    let response: Response
    try {
      response = await this.fetchFn(`${this.apiBaseUrl}/responses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
          'content-type': 'application/json',
          ...attributionHeaders(),
        },
        body: JSON.stringify(body),
        signal: options.signal,
      })
    } catch (err) {
      throw toLlmError(err)
    }
    if (!response.ok || !response.body) throw await this.admissionError(response)

    const blocks = new Map<number, BlockState>()
    let nextIndex = 0
    let sawToolCall = false

    const stateFor = (outputIndex: number, kind: BlockState['kind']): BlockState => {
      let st = blocks.get(outputIndex)
      if (!st) {
        st = { index: nextIndex++, kind, started: false, ended: false, text: '', args: '' }
        blocks.set(outputIndex, st)
      }
      return st
    }

    for await (const { event, data } of parseSseEvents(response.body)) {
      if (options.signal?.aborted) {
        yield {
          type: 'finish',
          reason: { kind: 'aborted', failure: { message: 'the call was aborted', code: 'ABORTED' } },
        }
        return
      }
      let payload: ResponsesEventPayload
      try {
        payload = JSON.parse(data) as ResponsesEventPayload
      } catch {
        continue
      }

      switch (event) {
        case 'response.output_text.delta': {
          const st = stateFor(payload.output_index ?? 0, 'text')
          if (!st.started) {
            st.started = true
            yield { type: 'block-start', index: st.index, blockType: 'text' }
          }
          const delta = payload.delta ?? ''
          st.text += delta
          if (delta) yield { type: 'text-delta', index: st.index, text: delta }
          break
        }
        case 'response.reasoning_summary_text.delta':
        case 'response.reasoning_text.delta': {
          const st = stateFor(payload.output_index ?? 0, 'reasoning')
          if (!st.started) {
            st.started = true
            yield { type: 'block-start', index: st.index, blockType: 'reasoning' }
          }
          const delta = payload.delta ?? ''
          st.text += delta
          if (delta) yield { type: 'reasoning-delta', index: st.index, text: delta }
          break
        }
        case 'response.output_item.added': {
          const item = payload.item
          if (item?.type === 'function_call') {
            const st = stateFor(payload.output_index ?? 0, 'tool-call')
            st.callId = item.call_id ?? item.id
            st.name = item.name
            sawToolCall = true
          }
          break
        }
        case 'response.function_call_arguments.delta': {
          const st = stateFor(payload.output_index ?? 0, 'tool-call')
          sawToolCall = true
          if (!st.started) {
            st.started = true
            yield { type: 'block-start', index: st.index, blockType: 'tool-call' }
          }
          const delta = payload.delta ?? ''
          st.args += delta
          yield {
            type: 'tool-call-delta',
            index: st.index,
            id: ToolCallId(st.callId ?? ''),
            name: st.name,
            argumentsDelta: delta,
          }
          break
        }
        case 'response.output_item.done': {
          const st = blocks.get(payload.output_index ?? 0)
          if (!st || st.ended) break
          const item = payload.item
          // Backfill from the final item when deltas were not observed.
          if (item?.type === 'message' && !st.text) {
            st.text = (item.content ?? [])
              .filter((part) => part.type === 'output_text')
              .map((part) => part.text ?? '')
              .join('')
          }
          if (item?.type === 'reasoning' && !st.text) {
            st.text = (item.summary ?? []).map((part) => part.text ?? '').join('')
          }
          if (item?.type === 'function_call') {
            st.callId = st.callId ?? item.call_id ?? item.id
            st.name = st.name ?? item.name
            if (!st.args && item.arguments) st.args = item.arguments
            sawToolCall = true
          }
          if (!st.started) {
            st.started = true
            yield { type: 'block-start', index: st.index, blockType: st.kind }
          }
          st.ended = true
          const block: ContentBlock =
            st.kind === 'text'
              ? { type: 'text', text: st.text }
              : st.kind === 'reasoning'
                ? { type: 'reasoning', text: st.text }
                : { type: 'tool-call', id: ToolCallId(st.callId ?? ''), name: st.name ?? '', arguments: st.args }
          yield { type: 'block-end', index: st.index, block }
          break
        }
        case 'response.completed': {
          if (payload.response?.usage) {
            yield { type: 'usage', usage: mapUsage(payload.response.usage) }
          }
          yield { type: 'finish', reason: { kind: sawToolCall ? 'tool-calls' : 'stop' } }
          return
        }
        case 'response.failed': {
          const err = payload.response?.error
          throw providerError(err?.code, err?.message)
        }
        case 'error': {
          throw providerError(payload.code, payload.message)
        }
        default:
          break
      }
    }

    throw new LlmError('the Responses stream ended without a terminal event', 'PROVIDER_ERROR')
  }
}
