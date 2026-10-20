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

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { ChatGptSiwcAdapter, PROVIDER_DISPLAY_NAME } from './adapter.ts'
import { DEFAULT_AGENT_NAME_HINT } from './constants.ts'
import { ensureAccessToken, fetchModels } from './oauth.ts'
import { AccountsStore, planGranted } from './store.ts'

export const name = 'dsh-chatgpt-siwc'

/** Services the plugin requires; it loads only while `llm` is present. */
export const inject = ['llm']

/** User-settings namespace whose section configures this provider. */
export const SETTINGS_NS = 'dsh-chatgpt-siwc'

/** Provider route registered when the config names none. */
export const DEFAULT_PROVIDER = 'chatgpt'

export interface PluginConfig {
  /** Provider route to register. Default: `chatgpt`. */
  provider?: string
  /** App name shown at first registration. Use one name consistently. */
  agentNameHint?: string
  /** Public API base override (tests/embeds); default is production. */
  apiBaseUrl?: string
  /** Reasoning effort materialized when a call names none. */
  reasoningEffort?: string
  /** Accounts file override; default is the Harness home location. */
  storePath?: string
}

export const Config = Schema.object({
  provider: Schema.string().default(DEFAULT_PROVIDER),
  agentNameHint: Schema.string().default(DEFAULT_AGENT_NAME_HINT),
  apiBaseUrl: Schema.string(),
  reasoningEffort: Schema.string(),
  storePath: Schema.string(),
})

export function apply(ctx: Context, config: PluginConfig = {}): void {
  const provider = config.provider ?? DEFAULT_PROVIDER
  const store = new AccountsStore(config.storePath)
  const adapter = new ChatGptSiwcAdapter({
    store,
    apiBaseUrl: config.apiBaseUrl,
    reasoningEffort: config.reasoningEffort,
  })

  // Registrations live inside effects: each handle is the effect's
  // disposer, so unloading (or reloading with new config) withdraws the
  // route, the directory entry, and the discovery hook together.
  ctx.effect(() => ctx.llm.registerAdapter([provider], adapter))
  ctx.effect(() =>
    ctx.llm.registerConfigurableProviders([
      {
        provider,
        displayName: PROVIDER_DISPLAY_NAME,
        settingsNs: SETTINGS_NS,
        settingsPath: [],
      },
    ]),
  )
  ctx.effect(() =>
    ctx.llm.registerModelDiscovery(SETTINGS_NS, async () => {
      try {
        const { account, accessToken } = await ensureAccessToken(store)
        if (!planGranted(account)) {
          return (account.models ?? []).map((m) => ({ id: m.slug, name: m.displayName }))
        }
        const models = await fetchModels(accessToken, { apiBaseUrl: config.apiBaseUrl })
        return models.map((m) => ({ id: m.slug, name: m.displayName }))
      } catch {
        const active = await store.active().catch(() => undefined)
        return (active?.models ?? []).map((m) => ({ id: m.slug, name: m.displayName }))
      }
    }),
  )
}

// ---------------------------------------------------------------------------
// Programmatic API — the same surface the CLI (bin.ts) drives.
// ---------------------------------------------------------------------------

export { ChatGptSiwcAdapter, PROVIDER_DISPLAY_NAME } from './adapter.ts'
export type { SiwcAdapterOptions } from './adapter.ts'

export {
  discoverEndpoints,
  ensureAccessToken,
  fetchModels,
  login,
  logout,
  openUrlInBrowser,
  refreshAccount,
} from './oauth.ts'
export type {
  CatalogModel,
  LoginOptions,
  LoginReporter,
  LoginResult,
  SiwcEndpoints,
  SiwcOverrides,
} from './oauth.ts'

export {
  AccountsStore,
  applyTokens,
  defaultStorePath,
  isSignedIn,
  parseScopes,
  planGranted,
  publicView,
} from './store.ts'
export type { AccountRecord, AccountsDocument, TokenSet } from './store.ts'

export { serializeRequest } from './serialize.ts'
export type { ResponsesInputItem, ResponsesRequest } from './serialize.ts'

export { parseSseEvents } from './sse.ts'
export type { SseEvent } from './sse.ts'

export {
  describeSubscriptionError,
  isSubscriptionError,
  isUsageLimitError,
  SiwcError,
} from './errors.ts'

export {
  API_BASE_URL,
  DEFAULT_AGENT_NAME_HINT,
  ISSUER,
  MANAGE_USAGE_URL,
  PLAN_SCOPE,
} from './constants.ts'
