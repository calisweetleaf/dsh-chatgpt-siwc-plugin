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

import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  ALL_SCOPES,
  CALLBACK_DEADLINE_MS,
  CALLBACK_PATH,
  DISCOVERY_URL,
  DYNAMIC_CLIENT_ID,
  FALLBACK_ENDPOINTS,
  HTTP_TIMEOUT_MS,
  ISSUER,
  PLAN_SCOPE,
  PREFERRED_CALLBACK_PORT,
  REFRESH_SKEW_MS,
  RESOURCE,
} from './constants.ts'
import { SiwcError, describeSubscriptionError } from './errors.ts'
import { verifyIdToken } from './jwt.ts'
import { errorPage, successPage, waitingPage } from './pages.ts'
import { AccountsStore, applyTokens, isSignedIn, planGranted } from './store.ts'
import type { AccountRecord, TokenSet } from './store.ts'

export interface SiwcEndpoints {
  authorizationEndpoint: string
  tokenEndpoint: string
  jwksUri: string
  revocationEndpoint?: string
}

/** Test/embedding seam: override endpoints and fetch. Production uses discovery. */
export interface SiwcOverrides {
  endpoints?: SiwcEndpoints
  fetchFn?: typeof fetch
}

let discoveryCache: { endpoints: SiwcEndpoints; fetchedAt: number } | undefined
const DISCOVERY_TTL_MS = 60 * 60 * 1000

/** Resolve the live endpoints from the discovery document (cached), falling back to the documented values. */
export async function discoverEndpoints(overrides?: SiwcOverrides): Promise<SiwcEndpoints> {
  if (overrides?.endpoints !== undefined) return overrides.endpoints
  const fetchFn = timedFetch(overrides?.fetchFn ?? fetch)
  const now = Date.now()
  if (discoveryCache !== undefined && now - discoveryCache.fetchedAt < DISCOVERY_TTL_MS) {
    return discoveryCache.endpoints
  }
  try {
    const response = await fetchFn(DISCOVERY_URL)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const doc = (await response.json()) as Record<string, unknown>
    const endpoints: SiwcEndpoints = {
      authorizationEndpoint: stringOr(doc['authorization_endpoint'], FALLBACK_ENDPOINTS.authorizationEndpoint),
      tokenEndpoint: stringOr(doc['token_endpoint'], FALLBACK_ENDPOINTS.tokenEndpoint),
      jwksUri: stringOr(doc['jwks_uri'], FALLBACK_ENDPOINTS.jwksUri),
      ...(typeof doc['revocation_endpoint'] === 'string'
        ? { revocationEndpoint: doc['revocation_endpoint'] }
        : {}),
    }
    discoveryCache = { endpoints, fetchedAt: now }
    return endpoints
  } catch {
    return { ...FALLBACK_ENDPOINTS }
  }
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function base64url(bytes: Buffer): string {
  return bytes.toString('base64url')
}

/** Caller cancellation combined with the control-plane per-call timeout. */
function boundedSignal(signal?: AbortSignal): AbortSignal {
  return AbortSignal.any([...signal === undefined ? [] : [signal], AbortSignal.timeout(HTTP_TIMEOUT_MS)])
}

/** One fetch bound to caller cancellation and the control-plane timeout. */
function timedFetch(fetchFn: typeof fetch, signal?: AbortSignal): typeof fetch {
  return (input, init) => fetchFn(input, { ...init, signal: boundedSignal(init?.signal ?? signal) })
}

/** Human-facing sink for sign-in progress. */
export interface LoginReporter {
  line(text: string): void
  openUrl?(url: string): void
}

export interface LoginOptions {
  store: AccountsStore
  /** App name shown at first registration; use one name consistently across installs. */
  agentNameHint: string
  /** Reauthorize this registered account instead of starting fresh. */
  clientId?: string
  openBrowser?: boolean
  reporter?: LoginReporter
  signal?: AbortSignal
  overrides?: SiwcOverrides
}

/** The outcome of one completed sign-in. */
export interface LoginResult {
  account: AccountRecord
  planGranted: boolean
  firstRegistration: boolean
}

/** Open an https URL in the desktop browser; failures are reported, never fatal. */
export function openUrlInBrowser(url: string, reporter?: LoginReporter): void {
  if (!url.startsWith('https://')) {
    reporter?.line('dsh-chatgpt-siwc: refusing to open a non-https URL')
    return
  }
  if (reporter?.openUrl !== undefined) {
    try { reporter.openUrl(url) } catch { /* the URL is also printed */ }
    return
  }
  const command = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'rundll32.exe' : 'xdg-open'
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url]
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true })
    child.once('error', () => { /* manual URL already printed */ })
    child.unref()
  } catch { /* manual URL already printed */ }
}

interface PendingAttempt {
  state: string
  nonce: string
  verifier: string
  redirectUri: string
  requestedClientId: string
  existing?: AccountRecord
}

/** Build the authorization URL for one attempt. Exported for tests and diagnostics. */
export function buildAuthorizeUrl(input: {
  endpoints: SiwcEndpoints
  pending: PendingAttempt
  hostId: string
  agentNameHint: string
}): string {
  const { endpoints, pending, hostId, agentNameHint } = input
  const url = new URL(endpoints.authorizationEndpoint)
  const params = url.searchParams
  params.set('client_id', pending.requestedClientId)
  if (pending.existing === undefined) {
    // First registration only: the hint names the agent being created.
    if (pending.requestedClientId === DYNAMIC_CLIENT_ID) params.set('agent_name_hint', agentNameHint)
  }
  params.set('ext_agent_host_id', hostId)
  params.set('response_type', 'code')
  params.set('redirect_uri', pending.redirectUri)
  params.set('scope', ALL_SCOPES.join(' '))
  params.set('resource', RESOURCE)
  params.set('state', pending.state)
  params.set('nonce', pending.nonce)
  params.set('code_challenge_method', 'S256')
  params.set('code_challenge', base64url(createHash('sha256').update(pending.verifier).digest()))
  if (pending.existing !== undefined) {
    if (pending.existing.id_token !== undefined) params.set('id_token_hint', pending.existing.id_token)
    if (pending.existing.email !== undefined) params.set('login_hint', pending.existing.email)
  }
  return url.toString()
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  id_token?: string
  token_type?: string
  expires_in?: number
  scope?: string
}

async function postTokenForm(
  endpoints: SiwcEndpoints,
  form: Record<string, string>,
  fetchFn: typeof fetch,
): Promise<TokenResponse> {
  const response = await fetchFn(endpoints.tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  })
  const text = await response.text()
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { parsed = undefined }
  if (!response.ok) {
    const detail = (parsed as { error_description?: string; error?: string } | undefined)
    const message = detail?.error_description ?? detail?.error ?? `HTTP ${response.status}`
    throw new SiwcError(`token endpoint refused the request: ${message}`, detail?.error ?? `HTTP_${response.status}`)
  }
  const tokens = parsed as TokenResponse
  if (typeof tokens.access_token !== 'string' || tokens.access_token.length === 0) {
    throw new SiwcError('token endpoint returned no access token', 'TOKEN_EXCHANGE_FAILED')
  }
  return tokens
}

/**
 * Run one interactive sign-in: loopback listener first, browser second,
 * validated callback last. Resolves only after the credential record is
 * stored; the pending attempt is kept separate from any active account
 * until its identity is validated.
 */
export async function login(options: LoginOptions): Promise<LoginResult> {
  const { store, reporter } = options
  const fetchFn = timedFetch(options.overrides?.fetchFn ?? fetch, options.signal)
  const endpoints = await discoverEndpoints({ ...options.overrides, fetchFn })
  const hostId = await store.hostId()

  const existing = options.clientId === undefined ? undefined : await store.account(options.clientId)
  if (options.clientId !== undefined && existing === undefined) {
    throw new SiwcError(`no registration for client id ${options.clientId}`, 'UNKNOWN_ACCOUNT')
  }
  const pending: PendingAttempt = {
    state: base64url(randomBytes(32)),
    nonce: base64url(randomBytes(32)),
    verifier: base64url(randomBytes(64)),
    redirectUri: '', // set once the listener picks its port
    requestedClientId: existing?.client_id ?? DYNAMIC_CLIENT_ID,
    ...(existing === undefined ? {} : { existing }),
  }

  const callback = await startCallbackServer(pending, reporter)
  pending.redirectUri = `http://127.0.0.1:${callback.port}${CALLBACK_PATH}`
  const authorizeUrl = buildAuthorizeUrl({ endpoints, pending, hostId, agentNameHint: options.agentNameHint })

  reporter?.line('Sign in with ChatGPT: open this URL in your browser if it does not open automatically:')
  // Reauthorization URLs can contain the stored ID token as an optional
  // id_token_hint. Keep that credential in the browser handoff only.
  const printableUrl = new URL(authorizeUrl)
  printableUrl.searchParams.delete('id_token_hint')
  reporter?.line(printableUrl.toString())
  if (options.openBrowser !== false) openUrlInBrowser(authorizeUrl, reporter)

  try {
    const result = await callback.wait(options.signal)
    // The loopback tab is held open, so every post-callback failure below
    // still renders its outcome there before the attempt closes.
    let record: AccountRecord
    let plan: boolean
    let firstTime: boolean
    try {
      // A different issued client id on a reauthorization callback is a
      // different registration — never overwrite the selected account.
      const issuedClientId = result.clientId ?? pending.requestedClientId
      if (existing !== undefined && issuedClientId !== existing.client_id) {
        throw new SiwcError('callback returned a different client id than the selected account', 'CLIENT_ID_MISMATCH')
      }
      if (existing === undefined && issuedClientId === DYNAMIC_CLIENT_ID) {
        throw new SiwcError('registration callback returned no issued client id', 'REGISTRATION_INCOMPLETE')
      }

      const tokens = await postTokenForm(endpoints, {
        grant_type: 'authorization_code',
        client_id: issuedClientId,
        code: result.code,
        code_verifier: pending.verifier,
        redirect_uri: pending.redirectUri,
        resource: RESOURCE,
      }, fetchFn)

      if (tokens.id_token === undefined) {
        throw new SiwcError('token response carried no ID token; identity cannot be validated', 'TOKEN_EXCHANGE_FAILED')
      }
      const identity = await verifyIdToken(tokens.id_token, {
        jwksUri: endpoints.jwksUri,
        issuer: ISSUER,
        audience: issuedClientId,
        nonce: pending.nonce,
        fetchFn,
      })
      if (existing !== undefined && identity.subject !== existing.subject) {
        throw new SiwcError('signed-in identity does not match the selected account', 'IDENTITY_MISMATCH')
      }

      const granted = (tokens.scope ?? result.scope ?? '').split(/\s+/u)
      record = {
        ...(existing ?? {}),
        email: identity.email ?? existing?.email,
        name: identity.name ?? existing?.name,
        picture: identity.picture ?? existing?.picture,
        issuer: ISSUER,
        subject: identity.subject,
        client_id: issuedClientId,
        ext_agent_host_id: hostId,
        scopes: [],
        saved_at: new Date().toISOString(),
      }
      applyTokens(record, tokens as TokenSet)
      if (tokens.scope === undefined && record.scopes.length === 0 && granted.length > 0) {
        record.scopes = granted.filter(s => s.length > 0)
      }
      options.signal?.throwIfAborted()
      await store.saveSignIn(record)
      plan = planGranted(record)
      firstTime = existing === undefined && !(await store.welcomed().catch(() => false))
      await store.markWelcomed().catch(() => undefined)
    } catch (error) {
      callback.finish({ ok: false, message: error instanceof Error ? error.message : String(error) })
      throw error
    }
    callback.finish({
      ok: true,
      ...(record.email === undefined ? {} : { email: record.email }),
      plan,
      firstTime,
    })
    reporter?.line(`Signed in${record.email !== undefined ? ` as ${record.email}` : ''}.`)
    reporter?.line(plan
      ? 'ChatGPT plan usage: granted. Eligible requests will draw on your plan.'
      : 'ChatGPT plan usage: NOT granted — identity only. Re-run sign-in and approve plan usage to run models.')
    return { account: record, planGranted: plan, firstRegistration: existing === undefined }
  } finally {
    callback.close()
  }
}

interface CallbackServer {
  port: number
  wait(signal?: AbortSignal): Promise<{ code: string; clientId?: string; scope?: string }>
  /** Render the sign-in outcome into the held callback page; idempotent. */
  finish(outcome: CallbackOutcome): void
  close(): void
}

/** The final page the held loopback callback renders for one attempt. */
export type CallbackOutcome =
  | { ok: true; email?: string; plan: boolean; firstTime: boolean }
  | { ok: false; message: string }

function startCallbackServer(pending: PendingAttempt, reporter?: LoginReporter): Promise<CallbackServer> {
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false
    let held: ServerResponse | undefined
    let deadline: NodeJS.Timeout | undefined
    let arrivalDeadline: NodeJS.Timeout | undefined
    let resolveWait: (value: { code: string; clientId?: string; scope?: string }) => void
    let rejectWait: (error: Error) => void
    const waitPromise = new Promise<{ code: string; clientId?: string; scope?: string }>((res, rej) => {
      resolveWait = res
      rejectWait = rej
    })
    // Avoid an unhandled rejection if the caller aborts before awaiting.
    waitPromise.catch(() => {})

    /** Render the validated outcome into the held callback page; idempotent. */
    const finish = (outcome: CallbackOutcome): void => {
      if (deadline !== undefined) {
        clearTimeout(deadline)
        deadline = undefined
      }
      if (arrivalDeadline !== undefined) {
        clearTimeout(arrivalDeadline)
        arrivalDeadline = undefined
      }
      const response = held
      if (response === undefined) return
      held = undefined
      if (outcome.ok) {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        response.end(successPage(outcome.email, outcome.plan, outcome.firstTime))
      } else {
        response.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
        response.end(errorPage(outcome.message))
      }
    }

    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (url.pathname === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        response.end(waitingPage())
        return
      }
      if (url.pathname !== CALLBACK_PATH) {
        response.writeHead(404, { 'content-type': 'text/plain' })
        response.end('not found')
        return
      }
      const fail = (message: string): void => {
        response.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
        response.end(errorPage(message))
        if (!settled) {
          settled = true
          rejectWait(new SiwcError(message, 'AUTHORIZATION_FAILED'))
        }
      }
      if (url.searchParams.get('state') !== pending.state) {
        fail('Sign-in callback state did not match this attempt. Nothing was exchanged.')
        return
      }
      const error = url.searchParams.get('error')
      if (error !== null) {
        fail(error === 'access_denied'
          ? describeSubscriptionError('subscription_sharing_plan_not_granted')
          : `Authorization failed: ${error}`)
        return
      }
      const code = url.searchParams.get('code')
      if (code === null || code.length === 0) {
        fail('Authorization callback carried no code.')
        return
      }
      if (settled) {
        response.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
        response.end(errorPage('This sign-in attempt already completed. Start the sign-in again for a new one.'))
        return
      }
      // Hold the response: the tab renders the validated outcome, not the
      // code's arrival. login() finishes it (or the deadline below does), so a
      // completed sign-in never leaves the browser on a stale page.
      settled = true
      if (arrivalDeadline !== undefined) {
        clearTimeout(arrivalDeadline)
        arrivalDeadline = undefined
      }
      held = response
      deadline = setTimeout(() => {
        finish({ ok: false, message: 'The sign-in did not complete in time. Run the sign-in again.' })
      }, CALLBACK_DEADLINE_MS)
      deadline.unref()
      resolveWait({
        code,
        ...(url.searchParams.get('client_id') !== null
          ? { clientId: url.searchParams.get('client_id')! }
          : {}),
        ...(url.searchParams.get('scope') !== null
          ? { scope: url.searchParams.get('scope')! }
          : {}),
      })
    })

    const onListen = (): void => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        rejectPromise(new SiwcError('loopback listener has no port', 'LISTENER_FAILED'))
        return
      }
      arrivalDeadline = setTimeout(() => {
        arrivalDeadline = undefined
        if (!settled) {
          settled = true
          rejectWait(new SiwcError('sign-in callback did not arrive in time', 'CALLBACK_TIMEOUT'))
        }
      }, CALLBACK_DEADLINE_MS)
      arrivalDeadline.unref()
      resolvePromise({
        port: address.port,
        wait: async (signal?: AbortSignal) => {
          if (signal !== undefined) {
            if (signal.aborted) throw new SiwcError('sign-in aborted', 'ABORTED')
            const onAbort = (): void => {
              if (!settled) {
                settled = true
                if (arrivalDeadline !== undefined) {
                  clearTimeout(arrivalDeadline)
                  arrivalDeadline = undefined
                }
                rejectWait(new SiwcError('sign-in aborted', 'ABORTED'))
              }
            }
            signal.addEventListener('abort', onAbort, { once: true })
            try {
              return await waitPromise
            } finally {
              signal.removeEventListener('abort', onAbort)
            }
          }
          return waitPromise
        },
        finish,
        close: () => {
          if (arrivalDeadline !== undefined) {
            clearTimeout(arrivalDeadline)
            arrivalDeadline = undefined
          }
          if (held !== undefined) {
            finish({ ok: false, message: 'The sign-in attempt ended. Run the sign-in again to retry.' })
          }
          server.close()
        },
      })
    }

    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        // Preferred port busy (another local tool's flow, a stale listener):
        // only the port may vary, so retry on an ephemeral one.
        server.listen(0, '127.0.0.1', onListen)
      } else {
        rejectPromise(error)
      }
    })
    server.listen(PREFERRED_CALLBACK_PORT, '127.0.0.1', onListen)
    reporter?.line(`Listening for the ChatGPT callback on 127.0.0.1 (path ${CALLBACK_PATH}).`)
  })
}

const refreshInFlight = new Map<string, Promise<AccountRecord>>()

/**
 * Refresh one account's access token, serialized per account so two
 * callers never race a rotating refresh token. The replacement token
 * set is stored together, under the store's cross-process lock.
 */
export async function refreshAccount(
  store: AccountsStore,
  clientId: string,
  overrides?: SiwcOverrides,
): Promise<AccountRecord> {
  const inFlight = refreshInFlight.get(clientId)
  if (inFlight !== undefined) return inFlight
  const promise = (async (): Promise<AccountRecord> => {
    const account = await store.account(clientId)
    if (account === undefined || account.refresh_token === undefined) {
      throw new SiwcError('no refresh token stored; sign in again', 'REAUTH_REQUIRED')
    }
    const endpoints = await discoverEndpoints(overrides)
    let tokens: TokenResponse
    try {
      tokens = await postTokenForm(endpoints, {
        grant_type: 'refresh_token',
        client_id: account.client_id,
        refresh_token: account.refresh_token,
        resource: RESOURCE,
      }, timedFetch(overrides?.fetchFn ?? fetch))
    } catch (error: unknown) {
      if (error instanceof SiwcError && (error.code === 'invalid_grant' || error.code === 'invalid_token')) {
        // A refresh token OpenAI will not take again ends the renewable
        // session: clear the tokens, keep the registration.
        await store.clearTokens(clientId)
        throw new SiwcError('ChatGPT session expired or was disconnected. Sign in again.', 'REAUTH_REQUIRED', { cause: error })
      }
      throw error
    }
    return store.saveTokens(clientId, tokens as TokenSet)
  })()
  refreshInFlight.set(clientId, promise)
  try {
    return await promise
  } finally {
    refreshInFlight.delete(clientId)
  }
}

/**
 * The access token for the active (or named) account, refreshing first
 * when it is expired or inside the skew window. Throws
 * `REAUTH_REQUIRED` / `MISSING_CREDENTIAL` SiwcErrors the adapter maps
 * onto harness error codes.
 */
export async function ensureAccessToken(
  store: AccountsStore,
  options?: { clientId?: string; forceRefresh?: boolean; overrides?: SiwcOverrides },
): Promise<{ account: AccountRecord; accessToken: string }> {
  let account = options?.clientId === undefined
    ? await store.active()
    : await store.account(options.clientId)
  if (!isSignedIn(account)) {
    throw new SiwcError(
      'Not signed in with ChatGPT. Run `dsh-chatgpt-siwc login` or `/chatgpt login` first.',
      'MISSING_CREDENTIAL',
    )
  }
  if (!planGranted(account)) {
    throw new SiwcError(describeSubscriptionError('subscription_sharing_plan_not_granted'), 'PLAN_NOT_GRANTED')
  }
  const stale = account.expires_at === undefined || account.expires_at - Date.now() <= REFRESH_SKEW_MS
  if (stale || options?.forceRefresh === true) {
    account = await refreshAccount(store, account.client_id, options?.overrides)
  }
  return { account, accessToken: account.access_token! }
}

/**
 * Sign out: revoke the renewable session (refresh token) at the
 * discovery document's revocation endpoint, then clear local tokens.
 * The registration survives unless `purge` is set. Revocation retries
 * transient failures; an unconfirmed revocation is reported, and the
 * user can always disconnect the app in ChatGPT settings instead.
 */
export async function logout(
  store: AccountsStore,
  options?: { clientId?: string; purge?: boolean; overrides?: SiwcOverrides },
): Promise<{ revoked: boolean; email?: string }> {
  const account = options?.clientId === undefined
    ? await store.active()
    : await store.account(options.clientId)
  if (account === undefined) return { revoked: false }
  let revoked = false
  if (account.refresh_token !== undefined) {
    const endpoints = await discoverEndpoints(options?.overrides)
    if (endpoints.revocationEndpoint !== undefined) {
      const fetchFn = timedFetch(options?.overrides?.fetchFn ?? fetch)
      for (let attempt = 0; attempt < 3 && !revoked; attempt++) {
        try {
          const response = await fetchFn(endpoints.revocationEndpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              token: account.refresh_token,
              token_type_hint: 'refresh_token',
              client_id: account.client_id,
            }).toString(),
          })
          // An empty 200 is success, including for an already-invalid token.
          if (response.ok) revoked = true
          else if (response.status < 500) break
        } catch {
          // network failure: retry with backoff below
        }
        if (!revoked && attempt < 2) await new Promise(r => setTimeout(r, 250 * (attempt + 1)))
      }
    }
  }
  if (options?.purge === true) await store.remove(account.client_id)
  else await store.clearTokens(account.client_id)
  return { revoked, ...(account.email === undefined ? {} : { email: account.email }) }
}

/** One model entry from the account's live catalog. */
export interface CatalogModel {
  slug: string
  displayName: string
}

/**
 * The signed-in account's model catalog from `GET /v1/models` — this
 * flow's response is `{models: [{slug, display_name, visibility}]}`
 * or the standard public API `data[]` shape. For the SIWC catalog, only `visibility: "list"` entries
 * belong in a picker; server order is preserved.
 */
export async function fetchModels(
  accessToken: string,
  overrides?: SiwcOverrides & { apiBaseUrl?: string; signal?: AbortSignal },
): Promise<CatalogModel[]> {
  const fetchFn = overrides?.fetchFn ?? fetch
  const base = overrides?.apiBaseUrl ?? 'https://api.openai.com/v1'
  const response = await fetchFn(`${base}/models`, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: boundedSignal(overrides?.signal),
  })
  if (!response.ok) {
    throw new SiwcError(`model catalog request failed (HTTP ${response.status})`, `HTTP_${response.status}`)
  }
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null) throw new SiwcError('model catalog response is not an object', 'INVALID_MODEL_CATALOG')
  const catalog = body as Record<string, unknown>
  const rows = Array.isArray(catalog['models']) ? catalog['models'] : Array.isArray(catalog['data']) ? catalog['data'] : undefined
  if (rows === undefined) throw new SiwcError('model catalog response contains neither models nor data', 'INVALID_MODEL_CATALOG')
  const subscription = Array.isArray(catalog['models'])
  return rows.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return []
    const model = entry as Record<string, unknown>
    if (subscription && model['visibility'] !== 'list') return []
    const slug = subscription ? model['slug'] : model['id']
    if (typeof slug !== 'string' || slug.length === 0) return []
    return [{ slug, displayName: typeof model['display_name'] === 'string' ? model['display_name'] : slug }]
  })
}

export { PLAN_SCOPE }
