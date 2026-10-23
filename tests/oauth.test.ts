/**
 * The OAuth client against fake endpoints and a real loopback listener: the
 * authorization URL contract, the held callback page, token exchange and
 * verification, refresh rotation and refusal, revocation, and discovery.
 * No test touches a real OpenAI endpoint or account.
 */
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { FALLBACK_ENDPOINTS, ISSUER, RESOURCE } from '../src/constants.ts'
import { discoverEndpoints, fetchModels, login, logout, refreshAccount } from '../src/oauth.ts'
import type { LoginReporter, SiwcEndpoints } from '../src/oauth.ts'
import { AccountsStore, isSignedIn, planGranted } from '../src/store.ts'
import { createJwtHarness, jsonResponse } from './support.ts'
import { accountRecord, tempStore } from './store-fixture.ts'

const harness = createJwtHarness()

const ENDPOINTS: SiwcEndpoints = {
  authorizationEndpoint: 'https://auth.test/authorize',
  tokenEndpoint: 'https://auth.test/token',
  jwksUri: 'https://auth.test/jwks',
  revocationEndpoint: 'https://auth.test/revoke',
}

/** Capture the authorize URL login prints, so the test can act as the browser. */
function urlCapture(): { url: Promise<URL>; reporter: LoginReporter } {
  let resolveUrl: (url: URL) => void
  const url = new Promise<URL>((resolve) => { resolveUrl = resolve })
  const reporter: LoginReporter = {
    line: (text: string) => {
      if (text.startsWith(ENDPOINTS.authorizationEndpoint)) resolveUrl(new URL(text))
    },
  }
  return { url, reporter }
}

/** The faked OpenAI side: token, JWKS, and revocation endpoints. */
function fakeProvider(options: {
  tokenStatus?: number
  tokenError?: string
  subject?: string
  failRevoke?: boolean
} = {}) {
  const seen = {
    token: undefined as Record<string, string> | undefined,
    revocation: undefined as Record<string, string> | undefined,
    revokeCalls: 0,
  }
  let nonce = 'unset'
  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input)
    if (url === ENDPOINTS.tokenEndpoint) {
      seen.token = Object.fromEntries(new URLSearchParams(String(init?.body)))
      if (options.tokenStatus !== undefined) {
        return jsonResponse({ error: options.tokenError ?? 'server_error', error_description: 'nope' }, options.tokenStatus)
      }
      return jsonResponse({
        access_token: 'at-1',
        refresh_token: 'rt-1',
        id_token: harness.signToken({
          iss: ISSUER,
          aud: 'oaiapp_issued',
          sub: options.subject ?? 'user-1',
          email: 'user@example.com',
          exp: Math.floor(Date.now() / 1000) + 600,
          nonce,
        }),
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'openid offline_access chatgpt.tokens.use.direct',
      })
    }
    if (url === ENDPOINTS.jwksUri) return jsonResponse(harness.jwksFor('test-kid'))
    if (url === ENDPOINTS.revocationEndpoint) {
      seen.revocation = Object.fromEntries(new URLSearchParams(String(init?.body)))
      seen.revokeCalls += 1
      return options.failRevoke === true ? new Response(null, { status: 500 }) : new Response(null, { status: 200 })
    }
    throw new Error(`fake provider: unexpected fetch ${url}`)
  }
  return { seen, fetchFn, setNonce: (value: string) => { nonce = value } }
}

/** The loopback callback URL the authorize redirect names. */
const callbackUrlOf = (authUrl: URL): string => authUrl.searchParams.get('redirect_uri')!

/** Drive one sign-in: start it, act as the browser, and read the held page. */
async function runLogin(
  store: AccountsStore,
  provider: ReturnType<typeof fakeProvider>,
  options: { clientId?: string } = {},
): Promise<{ result: Awaited<ReturnType<typeof login>>; page: string; authUrl: URL }> {
  const capture = urlCapture()
  const loginPromise = login({
    store,
    agentNameHint: 'Test Agent',
    ...(options.clientId === undefined ? {} : { clientId: options.clientId }),
    openBrowser: false,
    reporter: capture.reporter,
    overrides: { endpoints: ENDPOINTS, fetchFn: provider.fetchFn },
  })
  const authUrl = await capture.url
  provider.setNonce(authUrl.searchParams.get('nonce') ?? 'unset')
  // Attach the settlement before awaiting the held page, so a login that
  // rejects while the page is still in flight is never briefly unhandled.
  const settled = loginPromise.then(
    (result) => ({ ok: true as const, result }),
    (error) => ({ ok: false as const, error }),
  )
  const page = await fetch(
    `${callbackUrlOf(authUrl)}?code=code-1&state=${authUrl.searchParams.get('state')}`
    + `&client_id=oaiapp_issued&scope=${encodeURIComponent('openid chatgpt.tokens.use.direct')}`,
  )
  const outcome = await settled
  if (!outcome.ok) throw outcome.error
  const result = outcome.result
  return { result, page: await page.text(), authUrl }
}

describe('login', () => {
  it('signs in end to end: authorize URL contract, held outcome page, validated record', async () => {
    const store = tempStore()
    const provider = fakeProvider()
    const { result, page, authUrl } = await runLogin(store, provider)

    // The authorization URL this flow builds.
    expect(authUrl.searchParams.get('client_id')).toBe('dynamic_agent_client')
    expect(authUrl.searchParams.get('agent_name_hint')).toBe('Test Agent')
    expect(authUrl.searchParams.get('response_type')).toBe('code')
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authUrl.searchParams.get('resource')).toBe(RESOURCE)
    expect(authUrl.searchParams.get('scope')).toContain('chatgpt.tokens.use.direct')
    expect(authUrl.searchParams.get('ext_agent_host_id')).toMatch(/^urn:uuid:/)
    expect(authUrl.searchParams.get('redirect_uri')).toBe(`http://127.0.0.1:${new URL(authUrl.searchParams.get('redirect_uri')!).port}/auth/callback`)

    // The held callback page renders the validated outcome.
    expect(page).toContain("You're signed in")
    expect(page).toContain('user@example.com')
    expect(page).toContain('per-app cap')
    expect(result.firstRegistration).toBe(true)
    expect(result.planGranted).toBe(true)

    // The exchange carried PKCE and the resource.
    expect(provider.seen.token).toMatchObject({
      grant_type: 'authorization_code',
      client_id: 'oaiapp_issued',
      code: 'code-1',
      redirect_uri: authUrl.searchParams.get('redirect_uri')!,
      resource: RESOURCE,
    })
    expect(provider.seen.token!.code_verifier).toBeDefined()
    expect(authUrl.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(provider.seen.token!.code_verifier!).digest('base64url'))

    // The stored account.
    const saved = await store.account('oaiapp_issued')
    expect(saved).toBeDefined()
    expect(isSignedIn(saved)).toBe(true)
    expect(planGranted(saved)).toBe(true)
    expect(saved!.email).toBe('user@example.com')
    expect(saved!.ext_agent_host_id).toMatch(/^urn:uuid:/)
    expect(await store.welcomed()).toBe(true)
  })

  it('reauthorizes the same registration and shows the first-time hint only once', async () => {
    const store = tempStore()
    const provider = fakeProvider()
    const first = await runLogin(store, provider)
    expect(first.page).toContain('per-app cap')

    const second = await runLogin(store, provider, { clientId: 'oaiapp_issued' })
    expect(second.authUrl.searchParams.get('client_id')).toBe('oaiapp_issued')
    expect(second.authUrl.searchParams.get('agent_name_hint')).toBeNull()
    expect(second.authUrl.searchParams.get('login_hint')).toBe('user@example.com')
    expect(second.result.firstRegistration).toBe(false)
    expect(second.result.planGranted).toBe(true)
    expect(second.page).toContain("You're signed in")
    expect(second.page).not.toContain('per-app cap')
  })

  it('refuses a reauthorization whose identity does not match', async () => {
    const store = tempStore()
    const provider = fakeProvider()
    await runLogin(store, provider)
    const other = fakeProvider({ subject: 'user-2' })
    await expect(runLogin(store, other, { clientId: 'oaiapp_issued' }))
      .rejects.toMatchObject({ code: 'IDENTITY_MISMATCH' })
  })

  it('rejects a callback whose state did not originate this attempt', async () => {
    const store = tempStore()
    const capture = urlCapture()
    const loginPromise = login({
      store,
      agentNameHint: 'Test Agent',
      openBrowser: false,
      reporter: capture.reporter,
      overrides: { endpoints: ENDPOINTS, fetchFn: vi.fn() },
    })
    const authUrl = await capture.url
    const loginRejection = expect(loginPromise).rejects.toMatchObject({ code: 'AUTHORIZATION_FAILED' })
    const response = await fetch(`${callbackUrlOf(authUrl)}?code=c&state=wrong`)
    expect(response.status).toBe(400)
    expect(await response.text()).toContain("Sign-in didn't complete")
    await loginRejection
  })

  it('treats access_denied as plan usage not granted', async () => {
    const store = tempStore()
    const capture = urlCapture()
    const loginPromise = login({
      store,
      agentNameHint: 'Test Agent',
      openBrowser: false,
      reporter: capture.reporter,
      overrides: { endpoints: ENDPOINTS, fetchFn: vi.fn() },
    })
    const authUrl = await capture.url
    const loginRejection = expect(loginPromise).rejects.toMatchObject({
      code: 'AUTHORIZATION_FAILED',
      message: expect.stringContaining('plan usage was not granted at sign-in'),
    })
    const response = await fetch(
      `${callbackUrlOf(authUrl)}?error=access_denied&state=${authUrl.searchParams.get('state')}`,
    )
    expect(response.status).toBe(400)
    await loginRejection
  })

  it('renders the failure into the held page when the exchange is refused', async () => {
    const store = tempStore()
    const provider = fakeProvider({ tokenStatus: 400 })
    const capture = urlCapture()
    const loginPromise = login({
      store,
      agentNameHint: 'Test Agent',
      openBrowser: false,
      reporter: capture.reporter,
      overrides: { endpoints: ENDPOINTS, fetchFn: provider.fetchFn },
    })
    const authUrl = await capture.url
    provider.setNonce(authUrl.searchParams.get('nonce') ?? 'unset')
    const loginExpectation = expect(loginPromise).rejects.toMatchObject({ code: 'server_error' })
    const page = await fetch(
      `${callbackUrlOf(authUrl)}?code=code-1&state=${authUrl.searchParams.get('state')}`
      + `&client_id=oaiapp_issued`,
    )
    await loginExpectation
    expect(page.status).toBe(400)
    expect(await page.text()).toContain('token endpoint refused the request: nope')
  })
})

describe('refreshAccount', () => {
  it('replaces the token set atomically when the access token is stale', async () => {
    const store = tempStore()
    await store.saveSignIn(accountRecord({ expiresIn: -10 }))
    const provider = fakeProvider()
    const account = await refreshAccount(store, 'oaiapp_test', { endpoints: ENDPOINTS, fetchFn: provider.fetchFn })
    expect(account.access_token).toBe('at-1')
    expect(account.refresh_token).toBe('rt-1')
    expect(provider.seen.token).toMatchObject({
      grant_type: 'refresh_token',
      client_id: 'oaiapp_test',
      refresh_token: 'rt-1',
      resource: RESOURCE,
    })
    const saved = await store.account('oaiapp_test')
    expect(saved!.access_token).toBe('at-1')
    expect(saved!.refresh_token).toBe('rt-1')
  })

  it('ends the renewable session when the refresh token is refused', async () => {
    const store = tempStore()
    await store.saveSignIn(accountRecord({ expiresIn: -10 }))
    const provider = fakeProvider({ tokenStatus: 400, tokenError: 'invalid_grant' })
    await expect(refreshAccount(store, 'oaiapp_test', { endpoints: ENDPOINTS, fetchFn: provider.fetchFn }))
      .rejects.toMatchObject({ code: 'REAUTH_REQUIRED' })
    const saved = await store.account('oaiapp_test')
    expect(isSignedIn(saved)).toBe(false)
    expect(saved!.client_id).toBe('oaiapp_test')
  })
})

describe('logout', () => {
  it('revokes at the revocation endpoint and clears local tokens, keeping the registration', async () => {
    const store = tempStore()
    await store.saveSignIn(accountRecord({}))
    const provider = fakeProvider()
    const result = await logout(store, { overrides: { endpoints: ENDPOINTS, fetchFn: provider.fetchFn } })
    expect(result).toMatchObject({ revoked: true, email: 'user@example.com' })
    expect(provider.seen.revocation).toMatchObject({
      token: 'rt-1',
      token_type_hint: 'refresh_token',
      client_id: 'oaiapp_test',
    })
    const saved = await store.account('oaiapp_test')
    expect(isSignedIn(saved)).toBe(false)
    expect(saved!.client_id).toBe('oaiapp_test')
  })

  it('reports an unconfirmed revocation after retries, and still signs out locally', async () => {
    const store = tempStore()
    await store.saveSignIn(accountRecord({}))
    const provider = fakeProvider({ failRevoke: true })
    const result = await logout(store, { overrides: { endpoints: ENDPOINTS, fetchFn: provider.fetchFn } })
    expect(result.revoked).toBe(false)
    expect(provider.seen.revokeCalls).toBe(3)
    const saved = await store.account('oaiapp_test')
    expect(isSignedIn(saved)).toBe(false)
  })

  it('purges the registration when asked', async () => {
    const store = tempStore()
    await store.saveSignIn(accountRecord({}))
    const provider = fakeProvider()
    const result = await logout(store, { purge: true, overrides: { endpoints: ENDPOINTS, fetchFn: provider.fetchFn } })
    expect(result.revoked).toBe(true)
    expect(await store.active()).toBeUndefined()
  })
})

describe('discoverEndpoints', () => {
  it('reads the live endpoints from the discovery document', async () => {
    const fetchFn: typeof fetch = async () => jsonResponse({
      authorization_endpoint: 'https://live/auth',
      token_endpoint: 'https://live/token',
      jwks_uri: 'https://live/jwks',
      revocation_endpoint: 'https://live/revoke',
    })
    await expect(discoverEndpoints({ fetchFn })).resolves.toEqual({
      authorizationEndpoint: 'https://live/auth',
      tokenEndpoint: 'https://live/token',
      jwksUri: 'https://live/jwks',
      revocationEndpoint: 'https://live/revoke',
    })
  })

  it('falls back to the documented endpoints when discovery fails', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000)
    try {
      const endpoints = await discoverEndpoints({ fetchFn: async () => { throw new Error('offline') } })
      expect(endpoints).toEqual({ ...FALLBACK_ENDPOINTS })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('fetchModels', () => {
  it('maps the plan-token catalog, keeping only listed models', async () => {
    const requests: string[] = []
    const fetchFn: typeof fetch = async (input) => {
      requests.push(String(input))
      return jsonResponse({
        models: [
          { slug: 'gpt-test', display_name: 'GPT Test', visibility: 'list' },
          { slug: 'hidden-model', visibility: 'private' },
        ],
      })
    }
    await expect(fetchModels('at-1', { apiBaseUrl: 'https://plan.test/v1', fetchFn })).resolves.toEqual([
      { slug: 'gpt-test', displayName: 'GPT Test' },
    ])
    expect(requests).toEqual(['https://plan.test/v1/models'])
  })
})
