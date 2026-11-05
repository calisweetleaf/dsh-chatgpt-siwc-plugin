/**
 * SSE framing for the Responses API: yields `{event, data}` pairs
 * (the event name matters here, unlike chat-completions streams).
 * Framing is `eventsource-parser`'s; this module owns termination —
 * the Responses stream ends by closing after a terminal event, not
 * with a `[DONE]` sentinel.
 *
 * @module dsh-chatgpt-siwc/sse
 */
import { EventSourceParserStream } from 'eventsource-parser/stream';
export class SseIdleTimeoutError extends Error {
    timeoutMs;
    constructor(timeoutMs) {
        super(`the Responses stream was idle for ${timeoutMs} ms`);
        this.timeoutMs = timeoutMs;
        this.name = 'SseIdleTimeoutError';
    }
}
/**
 * Parse a response body into SSE events.
 * @param body - the streaming response body.
 * @param onActivity - called per received chunk (idle-watchdog pulse).
 */
export async function* parseSseEvents(body, onActivity, signal, idleTimeoutMs) {
    let touchIdleDeadline;
    const stream = body
        .pipeThrough(new TransformStream({
        transform(chunk, controller) {
            onActivity?.();
            touchIdleDeadline?.();
            controller.enqueue(chunk);
        },
    }))
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream());
    const reader = stream.getReader();
    const cancel = () => { void reader.cancel(signal?.reason).catch(() => undefined); };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
        while (true) {
            if (signal?.aborted)
                return;
            let timeout;
            let result;
            let rejectIdle = () => undefined;
            const idleDeadline = idleTimeoutMs !== undefined && idleTimeoutMs > 0
                ? new Promise((_, reject) => { rejectIdle = reject; })
                : undefined;
            const resetIdleDeadline = () => {
                if (idleDeadline === undefined)
                    return;
                if (timeout !== undefined)
                    clearTimeout(timeout);
                timeout = setTimeout(() => rejectIdle(new SseIdleTimeoutError(idleTimeoutMs)), idleTimeoutMs);
            };
            touchIdleDeadline = resetIdleDeadline;
            resetIdleDeadline();
            try {
                result = await (idleDeadline === undefined
                    ? reader.read()
                    : Promise.race([reader.read(), idleDeadline]));
            }
            finally {
                if (timeout !== undefined)
                    clearTimeout(timeout);
                touchIdleDeadline = undefined;
            }
            if (result.done)
                return;
            const message = result.value;
            const event = message.event;
            if (event === 'ping' || message.data.length === 0)
                continue;
            // eventsource-parser labels data-only frames as `message`. Preserve
            // them so the adapter can use the Responses payload's `type` field.
            yield { event: event || 'message', data: message.data };
        }
    }
    finally {
        touchIdleDeadline = undefined;
        signal?.removeEventListener('abort', cancel);
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}
//# sourceMappingURL=sse.js.map