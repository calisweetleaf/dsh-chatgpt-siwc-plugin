/**
 * The loopback pages the OAuth flow serves on `127.0.0.1` — the visual
 * surface a user actually sees mid-login. Same identity as the Web UI
 * card in `src/client`: white surface, near-black primary button,
 * one accent (green) reserved for "plan active".
 *
 * @module dsh-chatgpt-siwc/pages
 */
/** Shown in the browser tab while the user completes consent on OpenAI's page (the root of the loopback server). */
export declare function waitingPage(): string;
/** Shown on the loopback callback after a validated sign-in. */
export declare function successPage(email: string | undefined, plan: boolean, firstTime: boolean): string;
/** Shown on the loopback callback once the code arrives — sign-in is still being validated at this point. */
export declare function completingPage(): string;
/** Shown on the loopback callback when the flow fails or is denied. */
export declare function errorPage(message: string): string;
