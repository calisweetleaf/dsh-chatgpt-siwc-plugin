/**
 * The adapter's stream translation: Responses SSE events become harness
 * StreamChunks, provider failures become LlmErrors with the plain-language
 * plan-usage explanation, and the auth boundary holds before any request.
 */
import { describe, expect, it, vi } from 'vitest'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import { ChatGptSiwcAdapter } from '../src/adapter.ts'
import { tempStore, signedInStore } from './store-fixture.ts'

/** Encode one SSE event frame. */
function sse(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

/** A 200 response whose body streams the given SSE frames. */
function sseResponse(frames: readonly string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

/** Collect every chunk of one stream attempt. */
async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

/** The signed-in adapter under test, with its fetch faked. */
async function adapterWith(fetchFn: (frames: () => readonly string[]) => Promise<Response>) {
  return new ChatGptSiwcAdapter({ store: await signedInStore(), fetchFn })
}

describe('ChatGptSiwcAdapter stream translation', () => {
  it('translates a text stream to blocks, usage, and a stop finish', async () => {
    const frames = [
      sse('response.output_text.delta', { output_index: 0, delta: 'Hel' }),
      sse('response.output_text.delta', { output_index: 0, delta: 'lo' }),
      sse('response.completed', {
        response: {
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            input_tokens_details: { cached_tokens: 20 },
            output_tokens_details: { reasoning_tokens: 30 },
          },
        },
      }),
    ]
    const adapter = await adapterWith(async () => sseResponse(frames))
    const chunks = await collect(adapter.stream({ provider: 'chatgpt', model: 'gpt-test', messages: [] }))
    expect(chunks).toEqual([
      { type: 'block-start', index: 0, blockType: 'text' },
      { type: 'text-delta', index: 0, text: 'Hel' },
      { type: 'text-delta', index: 0, text: 'lo' },
      {
        type: 'usage',
        usage: {
          inputTokens: 80,
          outputTokens: 50,
          totalTokens: 150,
          cacheReadTokens: 20,
          reasoningTokens: 30,
        },
      },
      { type: 'finish', reason: { kind: 'stop' } },
    ])
  })

  it('keeps reasoning and text as separate blocks by output index', async () => {
    const frames = [
      sse('response.reasoning_summary_text.delta', { output_index: 0, delta: 'thinking' }),
      sse('response.output_text.delta', { output_index: 1, delta: 'answer' }),
      sse('response.output_item.done', { output_index: 0, item: { type: 'reasoning', summary: [{ type: 'summary_text', text: 'thinking' }] } }),
      sse('response.output_item.done', { output_index: 1, item: { type: 'message', content: [{ type: 'output_text', text: 'answer' }] } }),
      sse('response.completed', {}),
    ]
    const adapter = await adapterWith(async () => sseResponse(frames))
    const chunks = await collect(adapter.stream({ provider: 'chatgpt', model: 'gpt-test', messages: [] }))
    expect(chunks).toEqual([
      { type: 'block-start', index: 0, blockType: 'reasoning' },
      { type: 'reasoning-delta', index: 0, text: 'thinking' },
      { type: 'block-start', index: 1, blockType: 'text' },
      { type: 'text-delta', index: 1, text: 'answer' },
      { type: 'block-end', index: 0, block: { type: 'reasoning', text: 'thinking' } },
      { type: 'block-end', index: 1, block: { type: 'text', text: 'answer' } },
      { type: 'finish', reason: { kind: 'stop' } },
    ])
  })

  it('translates a function-call stream to a tool-call block and a tool-calls finish', async () => {
    const frames = [
      sse('response.output_item.added', { output_index: 0, item: { type: 'function_call', call_id: 'call_1', id: 'item_1', name: 'ping' } }),
      sse('response.function_call_arguments.delta', { output_index: 0, delta: '{"a":' }),
      sse('response.function_call_arguments.delta', { output_index: 0, delta: '1}' }),
      sse('response.output_item.done', { output_index: 0, item: { type: 'function_call', call_id: 'call_1', name: 'ping', arguments: '{"a":1}' } }),
      sse('response.completed', {}),
    ]
    const adapter = await adapterWith(async () => sseResponse(frames))
    const chunks = await collect(adapter.stream({ provider: 'chatgpt', model: 'gpt-test', messages: [] }))
    expect(chunks).toEqual([
      { type: 'block-start', index: 0, blockType: 'tool-call' },
      { type: 'tool-call-delta', index: 0, id: 'call_1', name: 'ping', argumentsDelta: '{"a":' },
      { type: 'tool-call-delta', index: 0, id: 'call_1', name: 'ping', argumentsDelta: '1}' },
      { type: 'block-end', index: 0, block: { type: 'tool-call', id: 'call_1', name: 'ping', arguments: '{"a":1}' } },
      { type: 'finish', reason: { kind: 'tool-calls' } },
    ])
  })

  it('backfills a message block the deltas never observed', async () => {
    const frames = [
      sse('response.output_item.done', { output_index: 0, item: { type: 'message', content: [{ type: 'output_text', text: 'Hello' }] } }),
      sse('response.completed', {}),
    ]
    const adapter = await adapterWith(async () => sseResponse(frames))
    const chunks = await collect(adapter.stream({ provider: 'chatgpt', model: 'gpt-test', messages: [] }))
    expect(chunks).toEqual([
      { type: 'block-start', index: 0, blockType: 'text' },
      { type: 'block-end', index: 0, block: { type: 'text', text: 'Hello' } },
      { type: 'finish', reason: { kind: 'stop' } },
    ])
  })

  it('maps a mid-stream plan-usage failure to the plain-language usage-limit error', async () => {
    const frames = [
      sse('response.output_text.delta', { output_index: 0, delta: 'par' }),
      sse('response.failed', { response: { error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'limit reached' } } }),
    ]
    const adapter = await adapterWith(async () => sseResponse(frames))
    await expect(collect(adapter.stream({ provider: 'chatgpt', model: 'gpt-test', messages: [] })))
      .rejects.toMatchObject({ code: 'USAGE_LIMIT', message: expect.stringContaining('Manage usage') })
  })

  it('surfaces a stream error event as the provider code it carries', async () => {
    const frames = [
      sse('response.output_text.delta', { output_index: 0, delta: 'par' }),
      sse('error', { code: 'server_error', message: 'boom' }),
    ]
    const adapter = await adapterWith(async () => sseResponse(frames))
    await expect(collect(adapter.stream({ provider: 'chatgpt', model: 'gpt-test', messages: [] })))
      .rejects.toMatchObject({ code: 'server_error', message: 'boom' })
  })

  it('fails a stream that ends without a terminal event', async () => {
    const frames = [sse('response.output_text.delta', { output_index: 0, delta: 'par' })]
    const adapter = await adapterWith(async () => sseResponse(frames))
    await expect(collect(adapter.stream({ provider: 'chatgpt', model: 'gpt-test', messages: [] })))
      .rejects.toMatchObject({ code: 'PROVIDER_ERROR', message: expect.stringContaining('ended without a terminal event') })
  })

  it('finishes as aborted once the caller aborts mid-stream', async () => {
    const controller = new AbortController()
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(c) {
        c.enqueue(encoder.encode(sse('response.output_text.delta', { output_index: 0, delta: 'Hel' })))
        await new Promise(resolve => setTimeout(resolve, 20))
        c.enqueue(encoder.encode(sse('response.output_text.delta', { output_index: 0, delta: 'lo' })))
        c.close()
      },
    })
    const adapter = new ChatGptSiwcAdapter({
      store: await signedInStore(),
      fetchFn: async () => new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    })
    const chunks: StreamChunk[] = []
    for await (const chunk of adapter.stream({ provider: 'chatgpt', model: 'gpt-test', messages: [], signal: controller.signal })) {
      chunks.push(chunk)
      if (chunks.length === 2) controller.abort()
    }
    expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'aborted' } })
  })

   it('refuses to call the provider when plan usage was not granted', async () => {
    const fetchFn = vi.fn()
    const adapter = new ChatGptSiwcAdapter({ store: await signedInStore({ plan: false }), fetchFn })
    await expect(collect(adapter.stream({ provider: 'chatgpt', model: 'gpt-test', messages: [] })))
      .rejects.toMatchObject({ code: 'AUTH' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('still reads a live-config store and base URL from provider functions', async () => {
    const store = await signedInStore()
    const seenUrls: string[] = []
    const adapter = new ChatGptSiwcAdapter({
      store: () => store,
      apiBaseUrl: () => 'https://plan.test/v1',
      fetchFn: async (input) => {
        seenUrls.push(String(input))
        return sseResponse([sse('response.completed', {})])
      },
    })
    await collect(adapter.stream({ provider: 'chatgpt', model: 'gpt-test', messages: [] }))
    expect(seenUrls).toEqual(['https://plan.test/v1/responses'])
  })
})

describe('ChatGptSiwcAdapter auth boundary', () => {
  it('fails as AUTH with no stored credentials, before any request', async () => {
    const adapter = new ChatGptSiwcAdapter({ store: tempStore(), fetchFn: vi.fn() })
    const chunks: unknown[] = []
    await expect(async () => {
      for await (const chunk of adapter.stream({ provider: 'chatgpt', model: 'gpt-test', messages: [] })) {
        chunks.push(chunk)
      }
    }).rejects.toMatchObject({ code: 'AUTH' })
    expect(chunks).toEqual([])
  })

  it('advertises no models when signed out and nothing is cached', async () => {
    const adapter = new ChatGptSiwcAdapter({ store: tempStore(), fetchFn: vi.fn() })
    await expect(adapter.listModels('chatgpt')).resolves.toEqual([])
  })
})
