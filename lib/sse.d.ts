/**
 * SSE framing for the Responses API: yields `{event, data}` pairs
 * (the event name matters here, unlike chat-completions streams).
 * Framing is `eventsource-parser`'s; this module owns termination —
 * the Responses stream ends by closing after a terminal event, not
 * with a `[DONE]` sentinel.
 *
 * @module dsh-chatgpt-siwc/sse
 */
export interface SseEvent {
    event: string;
    data: string;
}
export declare class SseIdleTimeoutError extends Error {
    readonly timeoutMs: number;
    constructor(timeoutMs: number);
}
/**
 * Parse a response body into SSE events.
 * @param body - the streaming response body.
 * @param onActivity - called per received chunk (idle-watchdog pulse).
 */
export declare function parseSseEvents(body: ReadableStream<Uint8Array>, onActivity?: () => void, signal?: AbortSignal, idleTimeoutMs?: number): AsyncGenerator<SseEvent>;
