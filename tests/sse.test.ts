import { describe, expect, it } from 'vitest'
import { parseSseEvents, SseIdleTimeoutError } from '../src/sse.ts'

const enc = new TextEncoder()

describe('parseSseEvents', () => {
  it('accepts default message events as well as named events', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode('data: {"type":"response.completed"}\n\n'))
        controller.enqueue(enc.encode('event: response.output_text.delta\ndata: {"delta":"x"}\n\n'))
        controller.close()
      },
    })
    const events = []
    for await (const event of parseSseEvents(body)) events.push(event)
    expect(events).toEqual([
      { event: 'message', data: '{"type":"response.completed"}' },
      { event: 'response.output_text.delta', data: '{"delta":"x"}' },
    ])
  })

  it('resets the idle deadline on comment heartbeat bytes', async () => {
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (let i = 0; i < 4; i++) {
          await new Promise(resolve => setTimeout(resolve, 20))
          controller.enqueue(enc.encode(': heartbeat\n\n'))
        }
        controller.enqueue(enc.encode('event: response.completed\ndata: {}\n\n'))
        controller.close()
      },
    })
    const events = []
    for await (const event of parseSseEvents(body, undefined, undefined, 35)) events.push(event)
    expect(events).toEqual([{ event: 'response.completed', data: '{}' }])
  })

  it('rejects a genuinely idle stream and cancels its source', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true } })
    const iterator = parseSseEvents(body, undefined, undefined, 15)
    await expect(iterator.next()).rejects.toBeInstanceOf(SseIdleTimeoutError)
    expect(cancelled).toBe(true)
  })

  it('cancels the underlying stream when the consumer stops at a terminal frame', async () => {
    let markCancelled!: () => void
    const cancelled = new Promise<void>(resolve => { markCancelled = resolve })
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode('event: response.completed\ndata: {}\n\n'))
      },
      cancel() { markCancelled() },
    })
    const iterator = parseSseEvents(body)
    await iterator.next()
    await iterator.return?.()
    await expect(cancelled).resolves.toBeUndefined()
  })
})
