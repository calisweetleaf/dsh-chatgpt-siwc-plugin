/**
 * SSE framing for the Responses API: yields `{event, data}` pairs
 * (the event name matters here, unlike chat-completions streams).
 * Framing is `eventsource-parser`'s; this module owns termination —
 * the Responses stream ends by closing after a terminal event, not
 * with a `[DONE]` sentinel.
 *
 * @module dsh-chatgpt-siwc/sse
 */

import { EventSourceParserStream } from 'eventsource-parser/stream'

export interface SseEvent {
  event: string
  data: string
}

/**
 * Parse a response body into SSE events.
 * @param body - the streaming response body.
 * @param onActivity - called per received chunk (idle-watchdog pulse).
 */
export async function* parseSseEvents(
  body: ReadableStream<Uint8Array>,
  onActivity?: () => void,
): AsyncGenerator<SseEvent> {
  const stream = body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
  for await (const message of stream) {
    onActivity?.()
    const event = message.event
    if (!event || event === 'ping' || message.data.length === 0) continue
    yield { event, data: message.data }
  }
}
