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
import { attributionHeaders, LlmAdapter, LlmError, ReasoningEffortId, ToolCallId } from '@deepseek-ai/dsh-llm';
import { API_BASE_URL } from "./constants.js";
import { describeSubscriptionError, isSubscriptionError, isUsageLimitError, SiwcError } from "./errors.js";
import { ensureAccessToken, fetchModels } from "./oauth.js";
import { serializeRequest } from "./serialize.js";
import { parseSseEvents, SseIdleTimeoutError } from "./sse.js";
import { planGranted } from "./store.js";
/** Display name of the one provider route this adapter serves. */
export const PROVIDER_DISPLAY_NAME = 'ChatGPT (Sign in with ChatGPT)';
const EFFORTS = ['low', 'medium', 'high'];
/** Map any failure onto the harness error vocabulary. */
function toLlmError(err) {
    if (err instanceof LlmError)
        return err;
    if (err instanceof SseIdleTimeoutError) {
        return new LlmError(err.message, 'PROVIDER_ERROR', { cause: err });
    }
    if (err instanceof SiwcError) {
        if (err.code === 'PLAN_NOT_GRANTED') {
            // The account is signed in but plan usage was not granted: an
            // authorization failure whose fix is a sign-in that approves plan usage.
            return new LlmError(err.message, 'AUTH', { cause: err });
        }
        if (err.code === 'REAUTH_REQUIRED' || err.code === 'MISSING_CREDENTIAL') {
            return new LlmError('ChatGPT sign-in is missing or no longer valid. Run `dsh-chatgpt-siwc login` (or sign in from the harness settings) and try again.', 'AUTH', { cause: err });
        }
        return new LlmError(err.message, err.code, { cause: err });
    }
    return new LlmError(err instanceof Error ? err.message : String(err), 'PROVIDER_ERROR', { cause: err });
}
/** A provider-side failure (Responses error body or stream error event). */
function providerError(code, message, status) {
    if (isSubscriptionError(code)) {
        return new LlmError(describeSubscriptionError(code, message), isUsageLimitError(code) ? 'USAGE_LIMIT' : 'PROVIDER_ERROR', status ? { status } : undefined);
    }
    return new LlmError(message || 'the provider reported an error', code || 'PROVIDER_ERROR', status ? { status } : undefined);
}
/** Responses usage → harness TokenUsage (input tokens are uncached-only). */
function mapUsage(u) {
    const cached = u.input_tokens_details?.cached_tokens ?? 0;
    return {
        inputTokens: Math.max(0, (u.input_tokens ?? 0) - cached),
        outputTokens: u.output_tokens ?? 0,
        totalTokens: u.total_tokens,
        cacheReadTokens: cached || undefined,
        reasoningTokens: u.output_tokens_details?.reasoning_tokens,
    };
}
export class ChatGptSiwcAdapter extends LlmAdapter {
    storeSource;
    baseUrlSource;
    effortSource;
    streamIdleTimeoutSource;
    fetchFn;
    constructor(options) {
        super();
        this.storeSource = options.store;
        this.baseUrlSource = () => {
            const base = typeof options.apiBaseUrl === 'function' ? options.apiBaseUrl() : options.apiBaseUrl;
            return base === undefined || base.length === 0 ? API_BASE_URL : base;
        };
        this.effortSource = () => {
            const effort = typeof options.reasoningEffort === 'function'
                ? options.reasoningEffort()
                : options.reasoningEffort;
            return effort === undefined || effort.length === 0 ? undefined : effort;
        };
        this.streamIdleTimeoutSource = () => {
            const timeout = typeof options.streamIdleTimeoutMs === 'function'
                ? options.streamIdleTimeoutMs()
                : options.streamIdleTimeoutMs;
            return timeout === undefined ? 120_000 : timeout;
        };
        this.fetchFn = options.fetchFn ?? fetch;
    }
    /** The account store as currently configured (a live source resolves per call). */
    get store() {
        return typeof this.storeSource === 'function' ? this.storeSource() : this.storeSource;
    }
    overrides() {
        return { fetchFn: this.fetchFn };
    }
    providerInfo(provider) {
        return { id: provider, name: PROVIDER_DISPLAY_NAME };
    }
    /** The signed-in account's cached catalog (offline-safe). */
    async cachedModels(provider) {
        const active = await this.store.active().catch(() => undefined);
        return (active?.models ?? []).map((m) => ({
            provider,
            id: m.slug,
            name: m.displayName,
            inputModalities: ['text'],
        }));
    }
    async listModels(provider) {
        try {
            const { account, accessToken } = await ensureAccessToken(this.store, { overrides: this.overrides() });
            if (!planGranted(account))
                return this.cachedModels(provider);
            const models = await fetchModels(accessToken, { ...this.overrides(), apiBaseUrl: this.baseUrlSource() });
            await this.store.saveModels(account.client_id, models).catch(() => undefined);
            return models.map((m) => ({
                provider,
                id: m.slug,
                name: m.displayName,
                inputModalities: ['text'],
            }));
        }
        catch {
            return this.cachedModels(provider);
        }
    }
    async resolveModel(provider, model) {
        return {
            provider,
            id: model,
            name: model,
            inputModalities: ['text'],
            reasoning: {
                efforts: EFFORTS.map((id) => ({ id: ReasoningEffortId(id), name: id })),
                defaultEffort: this.effortSource() === undefined ? undefined : ReasoningEffortId(this.effortSource()),
            },
        };
    }
    /** A non-2xx response before the stream opens (admission failure). */
    async admissionError(response) {
        const text = await response.text().catch(() => '');
        let code;
        let message;
        try {
            const body = JSON.parse(text);
            code = body.error?.code;
            message = body.error?.message ?? body.detail;
        }
        catch {
            message = text || undefined;
        }
        if (isSubscriptionError(code))
            return providerError(code, message, response.status);
        if (response.status === 401) {
            return new LlmError('the ChatGPT plan token was refused. Run `dsh-chatgpt-siwc login` to sign in again.', 'AUTH', { status: 401 });
        }
        if (response.status === 429) {
            return new LlmError(message || 'rate limited by the provider', 'RATE_LIMIT', { status: 429 });
        }
        return new LlmError(message || `the provider answered HTTP ${response.status}`, 'PROVIDER_ERROR', { status: response.status });
    }
    async *stream(options) {
        const finishAborted = () => ({
            type: 'finish',
            reason: { kind: 'aborted', failure: { message: 'the call was aborted', code: 'ABORTED' } },
        });
        if (options.signal?.aborted) {
            yield finishAborted();
            return;
        }
        let auth;
        try {
            auth = await ensureAccessToken(this.store, { overrides: this.overrides() });
        }
        catch (err) {
            if (options.signal?.aborted) {
                yield finishAborted();
                return;
            }
            throw toLlmError(err);
        }
        if (!planGranted(auth.account)) {
            throw new LlmError('this ChatGPT account is signed in, but plan usage was not granted for this app. Check the app\'s plan access and per-app cap in ChatGPT settings (Manage usage), then sign in again.', 'AUTH');
        }
        if (options.signal?.aborted) {
            yield finishAborted();
            return;
        }
        const body = serializeRequest(options, {
            reasoningEffort: options.reasoningEffort ?? this.effortSource(),
        });
        let response;
        try {
            response = await this.fetchFn(`${this.baseUrlSource()}/responses`, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${auth.accessToken}`,
                    'content-type': 'application/json',
                    ...attributionHeaders(),
                },
                body: JSON.stringify(body),
                signal: options.signal,
            });
        }
        catch (err) {
            if (options.signal?.aborted) {
                yield finishAborted();
                return;
            }
            throw toLlmError(err);
        }
        if (!response.ok || !response.body)
            throw await this.admissionError(response);
        const blocks = new Map();
        let nextIndex = 0;
        let sawToolCall = false;
        const stateFor = (outputIndex, kind) => {
            let st = blocks.get(outputIndex);
            if (!st) {
                st = { index: nextIndex++, kind, started: false, ended: false, text: '', args: '' };
                blocks.set(outputIndex, st);
            }
            return st;
        };
        const finalizeBlock = (st, item) => {
            if (st.ended)
                return [];
            if (item?.type === 'message') {
                const fullText = (item.content ?? [])
                    .filter(part => part.type === 'output_text' || part.type === 'refusal')
                    .map(part => part.type === 'refusal' ? part.refusal ?? '' : part.text ?? '')
                    .join('');
                if (!st.text || (fullText.startsWith(st.text) && fullText.length > st.text.length))
                    st.text = fullText;
            }
            if (item?.type === 'reasoning') {
                const fullText = (item.summary ?? []).map(part => part.text ?? '').join('');
                if (!st.text || (fullText.startsWith(st.text) && fullText.length > st.text.length))
                    st.text = fullText;
            }
            if (item?.type === 'function_call') {
                st.callId = item.call_id ?? st.callId;
                st.name = item.name ?? st.name;
                const fullArgs = item.arguments ?? '';
                if (!st.args || (fullArgs.startsWith(st.args) && fullArgs.length > st.args.length))
                    st.args = fullArgs;
                sawToolCall = true;
            }
            if (st.kind === 'tool-call' && (!st.callId || !st.name)) {
                throw providerError('MALFORMED_TOOL_CALL', 'the provider returned a function call without its call_id or name');
            }
            const chunks = [];
            if (!st.started)
                chunks.push({ type: 'block-start', index: st.index, blockType: st.kind });
            st.started = true;
            st.ended = true;
            const block = st.kind === 'text'
                ? { type: 'text', text: st.text }
                : st.kind === 'reasoning'
                    ? { type: 'reasoning', text: st.text }
                    : { type: 'tool-call', id: ToolCallId(st.callId ?? ''), name: st.name ?? '', arguments: st.args };
            chunks.push({ type: 'block-end', index: st.index, block });
            return chunks;
        };
        try {
            for await (const { event: sseEvent, data } of parseSseEvents(response.body, undefined, options.signal, this.streamIdleTimeoutSource())) {
                if (options.signal?.aborted) {
                    yield finishAborted();
                    return;
                }
                let payload;
                try {
                    payload = JSON.parse(data);
                }
                catch {
                    continue;
                }
                if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
                    continue;
                const event = !sseEvent || sseEvent === 'message' ? payload.type || '' : sseEvent;
                switch (event) {
                    case 'response.output_text.delta': {
                        const st = stateFor(payload.output_index ?? 0, 'text');
                        if (!st.started) {
                            st.started = true;
                            yield { type: 'block-start', index: st.index, blockType: 'text' };
                        }
                        const delta = payload.delta ?? '';
                        st.text += delta;
                        if (delta)
                            yield { type: 'text-delta', index: st.index, text: delta };
                        break;
                    }
                    case 'response.refusal.delta': {
                        const st = stateFor(payload.output_index ?? 0, 'text');
                        if (!st.started) {
                            st.started = true;
                            yield { type: 'block-start', index: st.index, blockType: 'text' };
                        }
                        const delta = payload.delta ?? '';
                        st.text += delta;
                        if (delta)
                            yield { type: 'text-delta', index: st.index, text: delta };
                        break;
                    }
                    case 'response.reasoning_summary_text.delta':
                    case 'response.reasoning_text.delta': {
                        const st = stateFor(payload.output_index ?? 0, 'reasoning');
                        if (!st.started) {
                            st.started = true;
                            yield { type: 'block-start', index: st.index, blockType: 'reasoning' };
                        }
                        const delta = payload.delta ?? '';
                        st.text += delta;
                        if (delta)
                            yield { type: 'reasoning-delta', index: st.index, text: delta };
                        break;
                    }
                    case 'response.output_item.added': {
                        const item = payload.item;
                        if (item?.type === 'function_call') {
                            const st = stateFor(payload.output_index ?? 0, 'tool-call');
                            st.callId = item.call_id;
                            st.name = item.name;
                            sawToolCall = true;
                        }
                        else if (item?.type === 'message') {
                            // Open the block at the item so a done-without-deltas item still
                            // backfills instead of being dropped.
                            stateFor(payload.output_index ?? 0, 'text');
                        }
                        else if (item?.type === 'reasoning') {
                            stateFor(payload.output_index ?? 0, 'reasoning');
                        }
                        break;
                    }
                    case 'response.function_call_arguments.delta': {
                        const st = stateFor(payload.output_index ?? 0, 'tool-call');
                        sawToolCall = true;
                        if (!st.started) {
                            st.started = true;
                            yield { type: 'block-start', index: st.index, blockType: 'tool-call' };
                        }
                        const delta = payload.delta ?? '';
                        st.args += delta;
                        yield {
                            type: 'tool-call-delta',
                            index: st.index,
                            id: ToolCallId(st.callId ?? ''),
                            name: st.name,
                            argumentsDelta: delta,
                        };
                        break;
                    }
                    case 'response.output_item.done': {
                        const item = payload.item;
                        let st = blocks.get(payload.output_index ?? 0);
                        if (st === undefined) {
                            // An item the deltas never opened: create its block from the
                            // item's own type, so a delta-less item still backfills instead
                            // of being dropped.
                            if (item?.type === 'reasoning')
                                st = stateFor(payload.output_index ?? 0, 'reasoning');
                            else if (item?.type === 'function_call')
                                st = stateFor(payload.output_index ?? 0, 'tool-call');
                            else if (item?.type === 'message')
                                st = stateFor(payload.output_index ?? 0, 'text');
                            else
                                break;
                        }
                        for (const chunk of finalizeBlock(st, item))
                            yield chunk;
                        break;
                    }
                    case 'response.completed': {
                        for (const [outputIndex, item] of (payload.response?.output ?? []).entries()) {
                            const kind = item.type === 'message' ? 'text' : item.type === 'reasoning' ? 'reasoning' : item.type === 'function_call' ? 'tool-call' : undefined;
                            if (!kind)
                                continue;
                            const st = blocks.get(outputIndex) ?? stateFor(outputIndex, kind);
                            for (const chunk of finalizeBlock(st, item))
                                yield chunk;
                        }
                        for (const st of blocks.values()) {
                            for (const chunk of finalizeBlock(st))
                                yield chunk;
                        }
                        if (payload.response?.usage) {
                            yield { type: 'usage', usage: mapUsage(payload.response.usage) };
                        }
                        yield { type: 'finish', reason: { kind: sawToolCall ? 'tool-calls' : 'stop' } };
                        return;
                    }
                    case 'response.incomplete': {
                        for (const [outputIndex, item] of (payload.response?.output ?? []).entries()) {
                            const kind = item.type === 'message' ? 'text' : item.type === 'reasoning' ? 'reasoning' : item.type === 'function_call' ? 'tool-call' : undefined;
                            if (!kind)
                                continue;
                            const st = blocks.get(outputIndex) ?? stateFor(outputIndex, kind);
                            for (const chunk of finalizeBlock(st, item))
                                yield chunk;
                        }
                        for (const st of blocks.values()) {
                            for (const chunk of finalizeBlock(st))
                                yield chunk;
                        }
                        if (payload.response?.usage)
                            yield { type: 'usage', usage: mapUsage(payload.response.usage) };
                        if (payload.response?.incomplete_details?.reason === 'max_output_tokens') {
                            yield { type: 'finish', reason: { kind: 'max-tokens' } };
                            return;
                        }
                        throw providerError('INCOMPLETE', `the response was incomplete (${payload.response?.incomplete_details?.reason ?? 'unknown reason'})`);
                    }
                    case 'response.cancelled': {
                        if (options.signal?.aborted) {
                            yield finishAborted();
                            return;
                        }
                        throw providerError('RESPONSE_CANCELLED', 'the provider cancelled the response');
                    }
                    case 'response.failed': {
                        const err = payload.response?.error;
                        throw providerError(err?.code, err?.message);
                    }
                    case 'error': {
                        throw providerError(payload.code, payload.message);
                    }
                    default:
                        break;
                }
            }
        }
        catch (err) {
            throw toLlmError(err);
        }
        if (options.signal?.aborted) {
            yield finishAborted();
            return;
        }
        throw new LlmError('the Responses stream ended without a terminal event', 'PROVIDER_ERROR');
    }
}
//# sourceMappingURL=adapter.js.map