/**
 * Error vocabulary for the SIWC flow. OpenAI's plan-usage failures use
 * `subscription_sharing_*` codes — before the stream (as a `{"detail": …}`
 * admission failure or a structured Responses error) and mid-stream (as
 * `response.failed`). Each one maps to a plain instruction plus the
 * Manage usage destination, per the official UI guidelines: the limit may
 * be the plan's or this app's per-app cap, and the user resolves it in
 * ChatGPT settings, not here.
 *
 * @module dsh-chatgpt-siwc/errors
 */
/** One failure in this plugin, carrying a stable machine-routable code. */
export declare class SiwcError extends Error {
    readonly code: string;
    constructor(message: string, code: string, options?: ErrorOptions);
}
/**
 * Explain any `subscription_sharing_*` failure in user terms.
 * @param code - the provider error code, when one was supplied.
 * @param detail - the provider's own message/detail text, when supplied.
 * @returns a user-facing explanation; unknown codes keep the provider detail.
 */
export declare function describeSubscriptionError(code: string | undefined, detail?: string): string;
/** Whether a provider code is one of the plan-usage family. */
export declare function isSubscriptionError(code: string | undefined): boolean;
/** Whether a provider code means the plan/app usage limit is exhausted. */
export declare function isUsageLimitError(code: string | undefined): boolean;
