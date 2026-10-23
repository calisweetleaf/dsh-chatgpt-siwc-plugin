/**
 * Wire constants for the official Sign in with ChatGPT (SIWC) open-source
 * flow, as documented by OpenAI under developers.openai.com/siwc
 * (token-sharing for open-source / locally hosted apps).
 *
 * This is NOT the Codex CLI login: no `app_EMoam…` client, no
 * `chatgpt.com/backend-api/codex` endpoint, no `~/.codex/auth.json`.
 * The app registers itself dynamically on first sign-in and afterwards
 * calls the public API (`https://api.openai.com/v1`) with the issued
 * OAuth access token.
 *
 * @module dsh-chatgpt-siwc/constants
 */
/** OIDC issuer for every token in this flow. */
export declare const ISSUER = "https://auth.openai.com";
/** Discovery document that names the live endpoints (they can move). */
export declare const DISCOVERY_URL = "https://auth.openai.com/.well-known/openid-configuration";
/** Documented fallback endpoints, used when discovery cannot be read. */
export declare const FALLBACK_ENDPOINTS: {
    readonly authorizationEndpoint: "https://auth.openai.com/api/accounts/authorize";
    readonly tokenEndpoint: "https://auth.openai.com/api/accounts/oauth/token";
    readonly jwksUri: "https://auth.openai.com/.well-known/jwks.json";
    readonly revocationEndpoint: string | undefined;
};
/** Public API base the plan-usage token is scoped to. */
export declare const API_BASE_URL = "https://api.openai.com/v1";
/** The `resource` parameter sent on authorize, exchange, and refresh. */
export declare const RESOURCE = "https://api.openai.com/v1";
/** First-registration placeholder client id; never saved, never exchanged with. */
export declare const DYNAMIC_CLIENT_ID = "dynamic_agent_client";
/** Identity scopes: who the user is. They grant no model usage by themselves. */
export declare const IDENTITY_SCOPES: readonly ["openid", "profile", "email"];
/** Plan-usage scopes: the grant that lets requests draw on the user's ChatGPT plan. */
export declare const PLAN_SCOPES: readonly ["offline_access", "resource.invoke", "chatgpt.tokens.use.direct"];
/** Every scope this plugin requests at sign-in. */
export declare const ALL_SCOPES: readonly ["openid", "profile", "email", "offline_access", "resource.invoke", "chatgpt.tokens.use.direct"];
/** The scope whose presence in a token response proves plan usage was granted. */
export declare const PLAN_SCOPE = "chatgpt.tokens.use.direct";
/** Default `agent_name_hint` shown on the first-registration consent screen. */
export declare const DEFAULT_AGENT_NAME_HINT = "DeepSeek Harness";
/** Loopback callback path; only the port may vary between attempts. */
export declare const CALLBACK_PATH = "/auth/callback";
/** Preferred loopback port (the port Codex popularized); any free port works. */
export declare const PREFERRED_CALLBACK_PORT = 1455;
/** Where users review per-app caps and plan usage (linked as "Manage usage"). */
export declare const MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage";
/** Access tokens in this flow live one hour; refresh this early. */
export declare const REFRESH_SKEW_MS: number;
/** Bound on any single OAuth control-plane fetch (discovery, token, JWKS, models). */
export declare const HTTP_TIMEOUT_MS = 20000;
/** How long the held loopback callback page may wait for the sign-in to settle. */
export declare const CALLBACK_DEADLINE_MS = 120000;
