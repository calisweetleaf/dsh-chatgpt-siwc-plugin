/**
 * The official Sign in with ChatGPT open-source flow, end to end:
 *
 * 1. Dynamic registration — first sign-in for an account starts with
 *    `client_id=dynamic_agent_client`, this host's stable
 *    `ext_agent_host_id`, and `agent_name_hint`. The callback returns
 *    the issued `oaiapp_…` client id; that id (never the placeholder)
 *    is saved with the account and used for the code exchange and all
 *    later refreshes and reauthorizations.
 * 2. Authorization-code + PKCE (S256) against a loopback listener on
 *    `127.0.0.1` (path `/auth/callback`; `localhost` is not accepted).
 *    Fresh `state` and `nonce` per attempt.
 * 3. Code exchange at the token endpoint with the issued client id,
 *    the PKCE verifier, the exact same redirect URI, and
 *    `resource=https://api.openai.com/v1`. No client secret.
 * 4. ID-token verification (JWKS, issuer, audience, nonce), then the
 *    granted scopes decide whether plan usage is enabled — identity
 *    alone never does.
 * 5. Refresh: standard OAuth refresh near expiry, serialized per
 *    account, rotating tokens replaced together. Revocation on
 *    sign-out uses the discovery document's `revocation_endpoint`.
 *
 * Endpoints are read from the OIDC discovery document, with the
 * documented production values as fallback.
 *
 * @module dsh-chatgpt-siwc/oauth
 */
import { PLAN_SCOPE } from './constants.ts';
import { AccountsStore } from './store.ts';
import type { AccountRecord } from './store.ts';
export interface SiwcEndpoints {
    authorizationEndpoint: string;
    tokenEndpoint: string;
    jwksUri: string;
    revocationEndpoint?: string;
}
/** Test/embedding seam: override endpoints and fetch. Production uses discovery. */
export interface SiwcOverrides {
    endpoints?: SiwcEndpoints;
    fetchFn?: typeof fetch;
}
/** Resolve the live endpoints from the discovery document (cached), falling back to the documented values. */
export declare function discoverEndpoints(overrides?: SiwcOverrides): Promise<SiwcEndpoints>;
/** Human-facing sink for sign-in progress. */
export interface LoginReporter {
    line(text: string): void;
    openUrl?(url: string): void;
}
export interface LoginOptions {
    store: AccountsStore;
    /** App name shown at first registration; use one name consistently across installs. */
    agentNameHint: string;
    /** Reauthorize this registered account instead of starting fresh. */
    clientId?: string;
    openBrowser?: boolean;
    reporter?: LoginReporter;
    signal?: AbortSignal;
    overrides?: SiwcOverrides;
}
/** The outcome of one completed sign-in. */
export interface LoginResult {
    account: AccountRecord;
    planGranted: boolean;
    firstRegistration: boolean;
}
/** Open an https URL in the desktop browser; failures are reported, never fatal. */
export declare function openUrlInBrowser(url: string, reporter?: LoginReporter): void;
interface PendingAttempt {
    state: string;
    nonce: string;
    verifier: string;
    redirectUri: string;
    requestedClientId: string;
    existing?: AccountRecord;
}
/** Build the authorization URL for one attempt. Exported for tests and diagnostics. */
export declare function buildAuthorizeUrl(input: {
    endpoints: SiwcEndpoints;
    pending: PendingAttempt;
    hostId: string;
    agentNameHint: string;
}): string;
/**
 * Run one interactive sign-in: loopback listener first, browser second,
 * validated callback last. Resolves only after the credential record is
 * stored; the pending attempt is kept separate from any active account
 * until its identity is validated.
 */
export declare function login(options: LoginOptions): Promise<LoginResult>;
/** The final page the held loopback callback renders for one attempt. */
export type CallbackOutcome = {
    ok: true;
    email?: string;
    plan: boolean;
    firstTime: boolean;
} | {
    ok: false;
    message: string;
};
/**
 * Refresh one account's access token, serialized per account so two
 * callers never race a rotating refresh token. The replacement token
 * set is stored together, under the store's cross-process lock.
 */
export declare function refreshAccount(store: AccountsStore, clientId: string, overrides?: SiwcOverrides): Promise<AccountRecord>;
/**
 * The access token for the active (or named) account, refreshing first
 * when it is expired or inside the skew window. Throws
 * `REAUTH_REQUIRED` / `MISSING_CREDENTIAL` SiwcErrors the adapter maps
 * onto harness error codes.
 */
export declare function ensureAccessToken(store: AccountsStore, options?: {
    clientId?: string;
    forceRefresh?: boolean;
    overrides?: SiwcOverrides;
}): Promise<{
    account: AccountRecord;
    accessToken: string;
}>;
/**
 * Sign out: revoke the renewable session (refresh token) at the
 * discovery document's revocation endpoint, then clear local tokens.
 * The registration survives unless `purge` is set. Revocation retries
 * transient failures; an unconfirmed revocation is reported, and the
 * user can always disconnect the app in ChatGPT settings instead.
 */
export declare function logout(store: AccountsStore, options?: {
    clientId?: string;
    purge?: boolean;
    overrides?: SiwcOverrides;
}): Promise<{
    revoked: boolean;
    email?: string;
}>;
/** One model entry from the account's live catalog. */
export interface CatalogModel {
    slug: string;
    displayName: string;
}
/**
 * The signed-in account's model catalog from `GET /v1/models` — this
 * flow's response is `{models: [{slug, display_name, visibility}]}`
 * or the standard public API `data[]` shape. For the SIWC catalog, only `visibility: "list"` entries
 * belong in a picker; server order is preserved.
 */
export declare function fetchModels(accessToken: string, overrides?: SiwcOverrides & {
    apiBaseUrl?: string;
    signal?: AbortSignal;
}): Promise<CatalogModel[]>;
export { PLAN_SCOPE };
