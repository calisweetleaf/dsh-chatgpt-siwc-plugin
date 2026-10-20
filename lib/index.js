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
import Schema from '@deepseek-ai/schemastery';
import { ChatGptSiwcAdapter, PROVIDER_DISPLAY_NAME } from "./adapter.js";
import { DEFAULT_AGENT_NAME_HINT } from "./constants.js";
import { ensureAccessToken, fetchModels } from "./oauth.js";
import { AccountsStore, planGranted } from "./store.js";
export const name = 'dsh-chatgpt-siwc';
/** Services the plugin requires; it loads only while `llm` is present. */
export const inject = ['llm'];
/** User-settings namespace whose section configures this provider. */
export const SETTINGS_NS = 'dsh-chatgpt-siwc';
/** Provider route registered when the config names none. */
export const DEFAULT_PROVIDER = 'chatgpt';
export const Config = Schema.object({
    provider: Schema.string().default(DEFAULT_PROVIDER),
    agentNameHint: Schema.string().default(DEFAULT_AGENT_NAME_HINT),
    apiBaseUrl: Schema.string(),
    reasoningEffort: Schema.string(),
    storePath: Schema.string(),
});
export function apply(ctx, config = {}) {
    const provider = config.provider ?? DEFAULT_PROVIDER;
    const store = new AccountsStore(config.storePath);
    const adapter = new ChatGptSiwcAdapter({
        store,
        apiBaseUrl: config.apiBaseUrl,
        reasoningEffort: config.reasoningEffort,
    });
    // Registrations live inside effects: each handle is the effect's
    // disposer, so unloading (or reloading with new config) withdraws the
    // route, the directory entry, and the discovery hook together.
    ctx.effect(() => ctx.llm.registerAdapter([provider], adapter));
    ctx.effect(() => ctx.llm.registerConfigurableProviders([
        {
            provider,
            displayName: PROVIDER_DISPLAY_NAME,
            settingsNs: SETTINGS_NS,
            settingsPath: [],
        },
    ]));
    ctx.effect(() => ctx.llm.registerModelDiscovery(SETTINGS_NS, async () => {
        try {
            const { account, accessToken } = await ensureAccessToken(store);
            if (!planGranted(account)) {
                return (account.models ?? []).map((m) => ({ id: m.slug, name: m.displayName }));
            }
            const models = await fetchModels(accessToken, { apiBaseUrl: config.apiBaseUrl });
            return models.map((m) => ({ id: m.slug, name: m.displayName }));
        }
        catch {
            const active = await store.active().catch(() => undefined);
            return (active?.models ?? []).map((m) => ({ id: m.slug, name: m.displayName }));
        }
    }));
}
// ---------------------------------------------------------------------------
// Programmatic API — the same surface the CLI (bin.ts) drives.
// ---------------------------------------------------------------------------
export { ChatGptSiwcAdapter, PROVIDER_DISPLAY_NAME } from "./adapter.js";
export { discoverEndpoints, ensureAccessToken, fetchModels, login, logout, openUrlInBrowser, refreshAccount, } from "./oauth.js";
export { AccountsStore, applyTokens, defaultStorePath, isSignedIn, parseScopes, planGranted, publicView, } from "./store.js";
export { serializeRequest } from "./serialize.js";
export { parseSseEvents } from "./sse.js";
export { describeSubscriptionError, isSubscriptionError, isUsageLimitError, SiwcError, } from "./errors.js";
export { API_BASE_URL, DEFAULT_AGENT_NAME_HINT, ISSUER, MANAGE_USAGE_URL, PLAN_SCOPE, } from "./constants.js";
//# sourceMappingURL=index.js.map