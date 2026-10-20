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
import { MANAGE_USAGE_URL } from "./constants.js";
/** One failure in this plugin, carrying a stable machine-routable code. */
export class SiwcError extends Error {
    code;
    constructor(message, code, options) {
        super(message, options);
        this.code = code;
        this.name = 'SiwcError';
    }
}
/** The two documented usage-limit codes and what the user should do about each. */
const SUBSCRIPTION_MESSAGES = {
    subscription_sharing_usage_limit_exceeded: 'ChatGPT plan usage limit reached for this app or for your plan. '
        + `Review the applicable limit under Manage usage: ${MANAGE_USAGE_URL}`,
    subscription_sharing_usage_unavailable: 'ChatGPT plan usage is temporarily unavailable for this account. '
        + `Check your plan status under Manage usage: ${MANAGE_USAGE_URL}`,
    subscription_sharing_not_entitled: 'This ChatGPT account is not eligible for plan usage in third-party apps '
        + '(Plus or Pro required). Identity sign-in alone does not grant model usage.',
    subscription_sharing_plan_not_granted: 'ChatGPT plan usage was not granted at sign-in. Sign in again and approve '
        + 'plan usage on the consent screen.',
};
/**
 * Explain any `subscription_sharing_*` failure in user terms.
 * @param code - the provider error code, when one was supplied.
 * @param detail - the provider's own message/detail text, when supplied.
 * @returns a user-facing explanation; unknown codes keep the provider detail.
 */
export function describeSubscriptionError(code, detail) {
    if (code !== undefined && code in SUBSCRIPTION_MESSAGES)
        return SUBSCRIPTION_MESSAGES[code];
    if (code !== undefined && code.startsWith('subscription_sharing_')) {
        return `ChatGPT plan usage was refused (${code}). `
            + `Review your plan and this app's limit under Manage usage: ${MANAGE_USAGE_URL}`
            + (detail !== undefined && detail.length > 0 ? ` Provider detail: ${detail}` : '');
    }
    return detail !== undefined && detail.length > 0 ? detail : 'ChatGPT plan request failed.';
}
/** Whether a provider code is one of the plan-usage family. */
export function isSubscriptionError(code) {
    return code !== undefined && code.startsWith('subscription_sharing_');
}
/** Whether a provider code means the plan/app usage limit is exhausted. */
export function isUsageLimitError(code) {
    return code === 'subscription_sharing_usage_limit_exceeded';
}
//# sourceMappingURL=errors.js.map