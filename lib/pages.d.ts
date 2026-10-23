/**
 * The sign-in pages the loopback flow serves on `127.0.0.1` — the visual
 * surface a user actually sees mid-login. Same identity as the Web UI
 * card: white surface, near-black ink, one accent (green) reserved for
 * "plan active". The callback page is held until the sign-in is validated,
 * so the browser lands on the outcome itself, never on a stale spinner.
 *
 * @module dsh-chatgpt-siwc/pages
 */
/** Shown in the browser tab while the user completes consent on OpenAI's page (the root of the loopback server). */
export declare function waitingPage(): string;
/** Shown on the loopback callback after a validated sign-in. */
export declare function successPage(email: string | undefined, plan: boolean, firstTime: boolean): string;
/** Shown on the loopback callback when the flow fails or is denied. */
export declare function errorPage(message: string): string;
