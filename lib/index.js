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
import { SiwcError } from "./errors.js";
import { ensureAccessToken, fetchModels } from "./oauth.js";
import { EFFORT_MAP } from "./serialize.js";
import { AccountsStore, planGranted } from "./store.js";
export const name = 'dsh-chatgpt-siwc';
/** Services the plugin requires; it loads only while `llm` is present. */
export const inject = ['llm'];
/** User-settings namespace whose section configures this provider. */
export const SETTINGS_NS = 'dsh-chatgpt-siwc';
/** Provider route registered when the config names none. */
export const DEFAULT_PROVIDER = 'chatgpt';
/** Fill the schema defaults so a partial composition config resolves like the schema does. */
function resolveConfig(config) {
    return {
        provider: config.provider !== undefined && config.provider.length > 0 ? config.provider : DEFAULT_PROVIDER,
        agentNameHint: config.agentNameHint !== undefined && config.agentNameHint.length > 0
            ? config.agentNameHint
            : DEFAULT_AGENT_NAME_HINT,
        ...config.apiBaseUrl === undefined ? {} : { apiBaseUrl: config.apiBaseUrl },
        ...config.reasoningEffort === undefined ? {} : { reasoningEffort: config.reasoningEffort },
        ...config.storePath === undefined ? {} : { storePath: config.storePath },
    };
}
export const Config = Schema.object({
    provider: Schema.string().default(DEFAULT_PROVIDER),
    agentNameHint: Schema.string().default(DEFAULT_AGENT_NAME_HINT),
    apiBaseUrl: Schema.string(),
    reasoningEffort: Schema.string(),
    storePath: Schema.string(),
});
export function apply(ctx, config = {}) {
    let current = () => resolveConfig(config);
    const store = () => new AccountsStore(current().storePath);
    const adapter = new ChatGptSiwcAdapter({
        store: () => store(),
        apiBaseUrl: () => current().apiBaseUrl,
        reasoningEffort: () => current().reasoningEffort,
    });
    // Route and directory registration: one route, swapped atomically when a
    // committed settings change renames it. The effect below releases both on
    // unload or reload, whatever names they then hold.
    let adapterRegistration;
    let directoryRegistration;
    let registeredProvider;
    const directoryEntry = (provider) => ({
        provider,
        displayName: PROVIDER_DISPLAY_NAME,
        settingsNs: SETTINGS_NS,
        settingsPath: [],
    });
    /**
     * Register the route and its directory entry, or swap both when a settings
     * change renamed the route. The first registration fails loud (a colliding
     * route is a composition error); a later refused swap keeps the previous
     * routes serving and only costs the diagnostic.
     */
    const ensureRegistered = (contain) => {
        const { provider } = current();
        if (adapterRegistration === undefined) {
            adapterRegistration = ctx.llm.registerAdapter([provider], adapter);
            directoryRegistration = ctx.llm.registerConfigurableProviders([directoryEntry(provider)]);
        }
        else if (provider !== registeredProvider) {
            try {
                adapterRegistration.replace([provider]);
                directoryRegistration?.replace([directoryEntry(provider)]);
            }
            catch (error) {
                if (!contain)
                    throw error;
                ctx.logger.error('dsh-chatgpt-siwc: keeping the previously registered route after a refused settings change');
                ctx.logger.error(error);
                return;
            }
        }
        registeredProvider = provider;
    };
    ensureRegistered(false);
    ctx.effect(() => () => {
        directoryRegistration?.();
        adapterRegistration?.();
        adapterRegistration = undefined;
        directoryRegistration = undefined;
    });
    // The discovery offer honors the caller's cancellation signal; the SIWC flow
    // has no draft endpoint to interrogate, so the signed-in account's live
    // catalog is the answer, with the cached catalog as the offline fallback.
    ctx.effect(() => ctx.llm.registerModelDiscovery(SETTINGS_NS, async (_request, signal) => {
        if (signal?.aborted)
            return [];
        const { apiBaseUrl } = current();
        const toEntry = (m) => ({ id: m.slug, name: m.displayName });
        try {
            const { account, accessToken } = await ensureAccessToken(store());
            if (!planGranted(account))
                return (account.models ?? []).map(toEntry);
            const models = await fetchModels(accessToken, { apiBaseUrl, signal });
            await store().saveModels(account.client_id, models).catch(() => undefined);
            return models.map(toEntry);
        }
        catch {
            const active = await store().active().catch(() => undefined);
            return (active?.models ?? []).map(toEntry);
        }
    }));
    // Settings section: while a settings service is mounted, the namespace is
    // served for the web card and every committed change re-judges the
    // registrations above; without one, the composition config stays authoritative.
    ctx.inject(['settings'], (settingsCtx) => {
        settingsCtx.settings.installSection(ctx, SETTINGS_NS, Config, resolveConfig(config), {
            validate: (value) => {
                if (value.provider.trim().length === 0) {
                    throw new SiwcError('provider route name must not be empty', 'INVALID_CONFIG');
                }
                if (value.reasoningEffort !== undefined && !(value.reasoningEffort in EFFORT_MAP)) {
                    throw new SiwcError(`unsupported reasoning effort "${value.reasoningEffort}"`, 'INVALID_CONFIG');
                }
            },
            setSource: (source) => {
                current = () => resolveConfig(source());
            },
            onChange: () => {
                ensureRegistered(true);
            },
        });
    });
}
// ---------------------------------------------------------------------------
// Programmatic API — the same surface the CLI (bin.ts) drives.
// ---------------------------------------------------------------------------
export { ChatGptSiwcAdapter, PROVIDER_DISPLAY_NAME } from "./adapter.js";
export { discoverEndpoints, ensureAccessToken, fetchModels, login, logout, openUrlInBrowser, refreshAccount, } from "./oauth.js";
export { AccountsStore, applyTokens, defaultStorePath, isSignedIn, parseScopes, planGranted, publicView, } from "./store.js";
export { EFFORT_MAP, serializeRequest } from "./serialize.js";
export { parseSseEvents } from "./sse.js";
export { describeSubscriptionError, isSubscriptionError, isUsageLimitError, SiwcError, } from "./errors.js";
export { API_BASE_URL, DEFAULT_AGENT_NAME_HINT, ISSUER, MANAGE_USAGE_URL, PLAN_SCOPE, } from "./constants.js";
//# sourceMappingURL=index.js.map