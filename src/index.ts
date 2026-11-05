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
import type {} from '@deepseek-ai/dsh-settings'
import type {
  AdapterRegistrationHandle,
  DirectoryRegistrationHandle,
  LlmConfigurableProvider,
} from '@deepseek-ai/dsh-llm'
import { SiwcAccountController } from './account-controller.ts'
import { ChatGptSiwcAdapter, PROVIDER_DISPLAY_NAME } from './adapter.ts'
import { DEFAULT_AGENT_NAME_HINT } from './constants.ts'
import { SiwcError } from './errors.ts'
import { ensureAccessToken, fetchModels } from './oauth.ts'
import { EFFORT_MAP } from './serialize.ts'
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
  /** Maximum time between incoming provider bytes (default 120 seconds). */
  streamIdleTimeoutMs?: number
}

/** The same keys after schema resolution: the two defaults are always present. */
export interface ResolvedConfig {
  provider: string
  agentNameHint: string
  apiBaseUrl?: string
  reasoningEffort?: string
  storePath?: string
  /** Maximum time between incoming provider bytes (default 120 seconds). */
  streamIdleTimeoutMs?: number
}

/** Fill the schema defaults so a partial composition config resolves like the schema does. */
function resolveConfig(config: PluginConfig): ResolvedConfig {
  return {
    provider: config.provider !== undefined && config.provider.length > 0 ? config.provider : DEFAULT_PROVIDER,
    agentNameHint: config.agentNameHint !== undefined && config.agentNameHint.length > 0
      ? config.agentNameHint
      : DEFAULT_AGENT_NAME_HINT,
    ...config.apiBaseUrl === undefined ? {} : { apiBaseUrl: config.apiBaseUrl },
    ...config.reasoningEffort === undefined ? {} : { reasoningEffort: config.reasoningEffort },
    ...config.storePath === undefined ? {} : { storePath: config.storePath },
    ...config.streamIdleTimeoutMs === undefined ? {} : { streamIdleTimeoutMs: config.streamIdleTimeoutMs },
  }
}

export const Config = Schema.object({
  provider: Schema.string().default(DEFAULT_PROVIDER),
  agentNameHint: Schema.string().default(DEFAULT_AGENT_NAME_HINT),
  apiBaseUrl: Schema.string(),
  reasoningEffort: Schema.string(),
  storePath: Schema.string(),
  streamIdleTimeoutMs: Schema.number(),
})

/** Validate composition and saved settings before credentials or routes are used. */
function validateConfig(value: ResolvedConfig): void {
  if (value.provider.trim().length === 0) throw new SiwcError('provider route name must not be empty', 'INVALID_CONFIG')
  if (value.agentNameHint.trim().length === 0) throw new SiwcError('app name must not be empty', 'INVALID_CONFIG')
  if (value.reasoningEffort !== undefined && !Object.hasOwn(EFFORT_MAP, value.reasoningEffort)) {
    throw new SiwcError(`unsupported reasoning effort "${value.reasoningEffort}"`, 'INVALID_CONFIG')
  }
  if (value.streamIdleTimeoutMs !== undefined && (!Number.isSafeInteger(value.streamIdleTimeoutMs) || value.streamIdleTimeoutMs <= 0)) {
    throw new SiwcError('stream idle timeout must be a positive integer in milliseconds', 'INVALID_CONFIG')
  }
  if (value.apiBaseUrl !== undefined && value.apiBaseUrl.length > 0) {
    let url: URL
    try { url = new URL(value.apiBaseUrl) } catch { throw new SiwcError('API base URL must be an absolute HTTPS URL', 'INVALID_CONFIG') }
    const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) {
      throw new SiwcError('API base URL requires HTTPS (HTTP is allowed only on loopback), without credentials, query, or fragment', 'INVALID_CONFIG')
    }
  }
}

export function apply(ctx: Context, config: PluginConfig = {}): void {
  validateConfig(resolveConfig(config))
  let current: () => ResolvedConfig = () => resolveConfig(config)
  const store = (): AccountsStore => new AccountsStore(current().storePath)
  const adapter = new ChatGptSiwcAdapter({
    store: () => store(),
    apiBaseUrl: () => current().apiBaseUrl,
    reasoningEffort: () => current().reasoningEffort,
    streamIdleTimeoutMs: () => current().streamIdleTimeoutMs,
  })

  // Route and directory registration: one route, swapped atomically when a
  // committed settings change renames it. The effect below releases both on
  // unload or reload, whatever names they then hold.
  let adapterRegistration: AdapterRegistrationHandle | undefined
  let directoryRegistration: DirectoryRegistrationHandle | undefined
  let registeredProvider: string | undefined
  const directoryEntry = (provider: string): LlmConfigurableProvider => ({
    provider,
    displayName: PROVIDER_DISPLAY_NAME,
    settingsNs: SETTINGS_NS,
    settingsPath: [],
  })
  /**
   * Register the route and its directory entry, or swap both when a settings
   * change renamed the route. The first registration fails loud (a colliding
   * route is a composition error); a later refused swap keeps the previous
   * routes serving and only costs the diagnostic.
   */
  const ensureRegistered = (contain: boolean): void => {
    const { provider } = current()
    if (adapterRegistration === undefined) {
      adapterRegistration = ctx.llm.registerAdapter([provider], adapter)
      try {
        directoryRegistration = ctx.llm.registerConfigurableProviders([directoryEntry(provider)])
      } catch (error) {
        adapterRegistration()
        adapterRegistration = undefined
        throw error
      }
    } else if (provider !== registeredProvider) {
      try {
        adapterRegistration.replace([provider])
        try {
          directoryRegistration?.replace([directoryEntry(provider)])
        } catch (error) {
          try { adapterRegistration.replace([registeredProvider!]) } catch (rollbackError) {
            directoryRegistration?.()
            adapterRegistration()
            directoryRegistration = undefined
            adapterRegistration = undefined
            registeredProvider = undefined
            throw new SiwcError('provider rename and rollback failed; the inconsistent route was removed. Save a valid provider route to restore it.', 'REGISTRATION_ROLLBACK_FAILED', { cause: rollbackError })
          }
          throw error
        }
      } catch (error) {
        if (!contain) throw error
        ctx.logger.error(adapterRegistration === undefined ? 'dsh-chatgpt-siwc: route removed after rollback failure' : 'dsh-chatgpt-siwc: keeping previously registered route after refused settings change')
        ctx.logger.error(error)
        return
      }
    }
    registeredProvider = provider
  }
  ensureRegistered(false)
  ctx.effect(() => () => {
    directoryRegistration?.()
    adapterRegistration?.()
    adapterRegistration = undefined
    directoryRegistration = undefined
  })

  // The discovery offer honors the caller's cancellation signal; the SIWC flow
  // has no draft endpoint to interrogate, so the signed-in account's live
  // catalog is the answer, with the cached catalog as the offline fallback.
  ctx.effect(() => ctx.llm.registerModelDiscovery(SETTINGS_NS, async (_request, signal) => {
    if (signal?.aborted) return []
    const { apiBaseUrl } = current()
    const accountStore = store()
    const toEntry = (m: { slug: string; displayName: string }) => ({ id: m.slug, name: m.displayName })
    try {
      const { account, accessToken } = await ensureAccessToken(accountStore)
      if (!planGranted(account)) return (account.models ?? []).map(toEntry)
      const models = await fetchModels(accessToken, { apiBaseUrl, signal })
      await accountStore.saveModels(account.client_id, models).catch(() => undefined)
      return models.map(toEntry)
    } catch {
      const active = await accountStore.active().catch(() => undefined)
      return (active?.models ?? []).map(toEntry)
    }
  }))

  ctx.inject(['typert'], (accountCtx) => {
    const controller = new SiwcAccountController(accountCtx, { store, agentNameHint: () => current().agentNameHint })
    accountCtx.effect(() => async () => { await controller.dispose() })
  })

  // Settings section: while a settings service is mounted, the namespace is
  // served for the web card and every committed change re-judges the
  // registrations above; without one, the composition config stays authoritative.
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, SETTINGS_NS, Config, resolveConfig(config), {
      validate: (value) => { validateConfig(value) },
      setSource: (source) => {
        current = () => resolveConfig(source())
      },
      onChange: () => {
        ensureRegistered(true)
      },
    })
  })
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

export { EFFORT_MAP, serializeRequest } from './serialize.ts'
export type { ResponsesInputItem, ResponsesRequest } from './serialize.ts'

export type { CallbackOutcome } from './oauth.ts'

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

export { SiwcAccountController } from './account-controller.ts'
export type { SiwcAccountControllerOptions } from './account-controller.ts'
export type { SiwcAccountIdentity, SiwcAccountAttempt, SiwcAccountStatus, SiwcSignInStart, SiwcSignOutResult } from './account-types.ts'
