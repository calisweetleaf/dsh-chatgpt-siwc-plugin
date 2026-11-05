/**
 * DeepSeek Harness plugin entry (Cordis): registers one LLM provider
 * route — `chatgpt` by default — backed by the official Sign in with
 * ChatGPT flow and the public Responses API.
 *
 * Boundaries this plugin keeps:
 * - No Codex backend, no `~/.codex` access, no contact with any Codex
 *   harness state. Accounts live in the Harness home (see store.ts);
 *   the one token this plugin ever touches is the user's own SIWC
 *   OAuth token, issued to this app by dynamic registration.
 * - No sub2api or any other pooling/sharing layer: requests go straight
 *   to `https://api.openai.com/v1` with the signed-in account's token.
 * - Effectively only an API surface: one adapter route, one
 *   configurable-provider directory entry, one model-discovery hook,
 *   plus the programmatic exports below (the same functions the CLI
 *   and settings surfaces drive).
 *
 * @module dsh-chatgpt-siwc
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
export declare const name = "dsh-chatgpt-siwc";
/** Services the plugin requires; it loads only while `llm` is present. */
export declare const inject: string[];
/** User-settings namespace whose section configures this provider. */
export declare const SETTINGS_NS = "dsh-chatgpt-siwc";
/** Provider route registered when the config names none. */
export declare const DEFAULT_PROVIDER = "chatgpt";
export interface PluginConfig {
    /** Provider route to register. Default: `chatgpt`. */
    provider?: string;
    /** App name shown at first registration. Use one name consistently. */
    agentNameHint?: string;
    /** Public API base override (tests/embeds); default is production. */
    apiBaseUrl?: string;
    /** Reasoning effort materialized when a call names none. */
    reasoningEffort?: string;
    /** Accounts file override; default is the Harness home location. */
    storePath?: string;
    /** Maximum time between incoming provider bytes (default 120 seconds). */
    streamIdleTimeoutMs?: number;
}
/** The same keys after schema resolution: the two defaults are always present. */
export interface ResolvedConfig {
    provider: string;
    agentNameHint: string;
    apiBaseUrl?: string;
    reasoningEffort?: string;
    storePath?: string;
    /** Maximum time between incoming provider bytes (default 120 seconds). */
    streamIdleTimeoutMs?: number;
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    provider: Schema<string, string, "defined">;
    agentNameHint: Schema<string, string, "defined">;
    apiBaseUrl: Schema<string, string, "plain">;
    reasoningEffort: Schema<string, string, "plain">;
    storePath: Schema<string, string, "plain">;
    streamIdleTimeoutMs: Schema<number, number, "plain">;
}>>, Schemastery.ObjectT<NoInfer<{
    provider: Schema<string, string, "defined">;
    agentNameHint: Schema<string, string, "defined">;
    apiBaseUrl: Schema<string, string, "plain">;
    reasoningEffort: Schema<string, string, "plain">;
    storePath: Schema<string, string, "plain">;
    streamIdleTimeoutMs: Schema<number, number, "plain">;
}>>, "plain">;
export declare function apply(ctx: Context, config?: PluginConfig): void;
export { ChatGptSiwcAdapter, PROVIDER_DISPLAY_NAME } from './adapter.ts';
export type { SiwcAdapterOptions } from './adapter.ts';
export { discoverEndpoints, ensureAccessToken, fetchModels, login, logout, openUrlInBrowser, refreshAccount, } from './oauth.ts';
export type { CatalogModel, LoginOptions, LoginReporter, LoginResult, SiwcEndpoints, SiwcOverrides, } from './oauth.ts';
export { AccountsStore, applyTokens, defaultStorePath, isSignedIn, parseScopes, planGranted, publicView, } from './store.ts';
export type { AccountRecord, AccountsDocument, TokenSet } from './store.ts';
export { EFFORT_MAP, serializeRequest } from './serialize.ts';
export type { ResponsesInputItem, ResponsesRequest } from './serialize.ts';
export type { CallbackOutcome } from './oauth.ts';
export { parseSseEvents } from './sse.ts';
export type { SseEvent } from './sse.ts';
export { describeSubscriptionError, isSubscriptionError, isUsageLimitError, SiwcError, } from './errors.ts';
export { API_BASE_URL, DEFAULT_AGENT_NAME_HINT, ISSUER, MANAGE_USAGE_URL, PLAN_SCOPE, } from './constants.ts';
