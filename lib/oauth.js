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
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { ALL_SCOPES, CALLBACK_PATH, DISCOVERY_URL, DYNAMIC_CLIENT_ID, FALLBACK_ENDPOINTS, ISSUER, PLAN_SCOPE, PREFERRED_CALLBACK_PORT, REFRESH_SKEW_MS, RESOURCE, } from "./constants.js";
import { SiwcError, describeSubscriptionError } from "./errors.js";
import { verifyIdToken } from "./jwt.js";
import { completingPage, errorPage, waitingPage } from "./pages.js";
import { applyTokens, isSignedIn, planGranted } from "./store.js";
let discoveryCache;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;
/** Resolve the live endpoints from the discovery document (cached), falling back to the documented values. */
export async function discoverEndpoints(overrides) {
    if (overrides?.endpoints !== undefined)
        return overrides.endpoints;
    const fetchFn = overrides?.fetchFn ?? fetch;
    const now = Date.now();
    if (discoveryCache !== undefined && now - discoveryCache.fetchedAt < DISCOVERY_TTL_MS) {
        return discoveryCache.endpoints;
    }
    try {
        const response = await fetchFn(DISCOVERY_URL);
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        const doc = (await response.json());
        const endpoints = {
            authorizationEndpoint: stringOr(doc['authorization_endpoint'], FALLBACK_ENDPOINTS.authorizationEndpoint),
            tokenEndpoint: stringOr(doc['token_endpoint'], FALLBACK_ENDPOINTS.tokenEndpoint),
            jwksUri: stringOr(doc['jwks_uri'], FALLBACK_ENDPOINTS.jwksUri),
            ...(typeof doc['revocation_endpoint'] === 'string'
                ? { revocationEndpoint: doc['revocation_endpoint'] }
                : {}),
        };
        discoveryCache = { endpoints, fetchedAt: now };
        return endpoints;
    }
    catch {
        return { ...FALLBACK_ENDPOINTS };
    }
}
function stringOr(value, fallback) {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
}
function base64url(bytes) {
    return bytes.toString('base64url');
}
/** Open an https URL in the desktop browser; failures are reported, never fatal. */
export function openUrlInBrowser(url, reporter) {
    if (!url.startsWith('https://')) {
        reporter?.line('dsh-chatgpt-siwc: refusing to open a non-https URL');
        return;
    }
    if (reporter?.openUrl !== undefined) {
        try {
            reporter.openUrl(url);
        }
        catch { /* the URL is also printed */ }
        return;
    }
    const command = process.platform === 'darwin' ? 'open'
        : process.platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    try {
        const child = spawn(command, args, { stdio: 'ignore', detached: true });
        child.once('error', () => { });
        child.unref();
    }
    catch { /* manual URL already printed */ }
}
/** Build the authorization URL for one attempt. Exported for tests and diagnostics. */
export function buildAuthorizeUrl(input) {
    const { endpoints, pending, hostId, agentNameHint } = input;
    const url = new URL(endpoints.authorizationEndpoint);
    const params = url.searchParams;
    params.set('client_id', pending.requestedClientId);
    if (pending.existing === undefined) {
        // First registration only: the hint names the agent being created.
        if (pending.requestedClientId === DYNAMIC_CLIENT_ID)
            params.set('agent_name_hint', agentNameHint);
    }
    params.set('ext_agent_host_id', hostId);
    params.set('response_type', 'code');
    params.set('redirect_uri', pending.redirectUri);
    params.set('scope', ALL_SCOPES.join(' '));
    params.set('resource', RESOURCE);
    params.set('state', pending.state);
    params.set('nonce', pending.nonce);
    params.set('code_challenge_method', 'S256');
    params.set('code_challenge', base64url(createHash('sha256').update(pending.verifier).digest()));
    if (pending.existing !== undefined) {
        if (pending.existing.id_token !== undefined)
            params.set('id_token_hint', pending.existing.id_token);
        if (pending.existing.email !== undefined)
            params.set('login_hint', pending.existing.email);
    }
    return url.toString();
}
async function postTokenForm(endpoints, form, fetchFn) {
    const response = await fetchFn(endpoints.tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form).toString(),
    });
    const text = await response.text();
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        parsed = undefined;
    }
    if (!response.ok) {
        const detail = parsed;
        const message = detail?.error_description ?? detail?.error ?? `HTTP ${response.status}`;
        throw new SiwcError(`token endpoint refused the request: ${message}`, detail?.error ?? `HTTP_${response.status}`);
    }
    const tokens = parsed;
    if (typeof tokens.access_token !== 'string' || tokens.access_token.length === 0) {
        throw new SiwcError('token endpoint returned no access token', 'TOKEN_EXCHANGE_FAILED');
    }
    return tokens;
}
/**
 * Run one interactive sign-in: loopback listener first, browser second,
 * validated callback last. Resolves only after the credential record is
 * stored; the pending attempt is kept separate from any active account
 * until its identity is validated.
 */
export async function login(options) {
    const { store, reporter } = options;
    const fetchFn = options.overrides?.fetchFn ?? fetch;
    const endpoints = await discoverEndpoints(options.overrides);
    const hostId = await store.hostId();
    const existing = options.clientId === undefined ? undefined : await store.account(options.clientId);
    if (options.clientId !== undefined && existing === undefined) {
        throw new SiwcError(`no registration for client id ${options.clientId}`, 'UNKNOWN_ACCOUNT');
    }
    const pending = {
        state: base64url(randomBytes(32)),
        nonce: base64url(randomBytes(32)),
        verifier: base64url(randomBytes(64)),
        redirectUri: '', // set once the listener picks its port
        requestedClientId: existing?.client_id ?? DYNAMIC_CLIENT_ID,
        ...(existing === undefined ? {} : { existing }),
    };
    const callback = await startCallbackServer(pending, reporter);
    pending.redirectUri = `http://127.0.0.1:${callback.port}${CALLBACK_PATH}`;
    const authorizeUrl = buildAuthorizeUrl({ endpoints, pending, hostId, agentNameHint: options.agentNameHint });
    reporter?.line('Sign in with ChatGPT: open this URL in your browser if it does not open automatically:');
    reporter?.line(authorizeUrl);
    if (options.openBrowser !== false)
        openUrlInBrowser(authorizeUrl, reporter);
    try {
        const result = await callback.wait(options.signal);
        // A different issued client id on a reauthorization callback is a
        // different registration — never overwrite the selected account.
        const issuedClientId = result.clientId ?? pending.requestedClientId;
        if (existing !== undefined && issuedClientId !== existing.client_id) {
            throw new SiwcError('callback returned a different client id than the selected account', 'CLIENT_ID_MISMATCH');
        }
        if (existing === undefined && issuedClientId === DYNAMIC_CLIENT_ID) {
            throw new SiwcError('registration callback returned no issued client id', 'REGISTRATION_INCOMPLETE');
        }
        const tokens = await postTokenForm(endpoints, {
            grant_type: 'authorization_code',
            client_id: issuedClientId,
            code: result.code,
            code_verifier: pending.verifier,
            redirect_uri: pending.redirectUri,
            resource: RESOURCE,
        }, fetchFn);
        if (tokens.id_token === undefined) {
            throw new SiwcError('token response carried no ID token; identity cannot be validated', 'TOKEN_EXCHANGE_FAILED');
        }
        const identity = await verifyIdToken(tokens.id_token, {
            jwksUri: endpoints.jwksUri,
            issuer: ISSUER,
            audience: issuedClientId,
            nonce: pending.nonce,
            fetchFn,
        });
        if (existing !== undefined && identity.subject !== existing.subject) {
            throw new SiwcError('signed-in identity does not match the selected account', 'IDENTITY_MISMATCH');
        }
        const granted = (tokens.scope ?? result.scope ?? '').split(/\s+/u);
        const record = {
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
        };
        applyTokens(record, tokens);
        if (record.scopes.length === 0 && granted.length > 0)
            record.scopes = granted.filter(s => s.length > 0);
        await store.saveSignIn(record);
        const plan = planGranted(record);
        reporter?.line(`Signed in${record.email !== undefined ? ` as ${record.email}` : ''}.`);
        reporter?.line(plan
            ? 'ChatGPT plan usage: granted. Eligible requests will draw on your plan.'
            : 'ChatGPT plan usage: NOT granted — identity only. Re-run sign-in and approve plan usage to run models.');
        return { account: record, planGranted: plan, firstRegistration: existing === undefined };
    }
    finally {
        callback.close();
    }
}
function startCallbackServer(pending, reporter) {
    return new Promise((resolvePromise, rejectPromise) => {
        let settled = false;
        let resolveWait;
        let rejectWait;
        const waitPromise = new Promise((res, rej) => {
            resolveWait = res;
            rejectWait = rej;
        });
        // Avoid an unhandled rejection if the caller aborts before awaiting.
        waitPromise.catch(() => { });
        const server = createServer((request, response) => {
            const url = new URL(request.url ?? '/', 'http://127.0.0.1');
            if (url.pathname === '/') {
                response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
                response.end(waitingPage());
                return;
            }
            if (url.pathname !== CALLBACK_PATH) {
                response.writeHead(404, { 'content-type': 'text/plain' });
                response.end('not found');
                return;
            }
            const fail = (message) => {
                response.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
                response.end(errorPage(message));
                if (!settled) {
                    settled = true;
                    rejectWait(new SiwcError(message, 'AUTHORIZATION_FAILED'));
                }
            };
            if (url.searchParams.get('state') !== pending.state) {
                fail('Sign-in callback state did not match this attempt. Nothing was exchanged.');
                return;
            }
            const error = url.searchParams.get('error');
            if (error !== null) {
                fail(error === 'access_denied'
                    ? describeSubscriptionError('subscription_sharing_plan_not_granted')
                    : `Authorization failed: ${error}`);
                return;
            }
            const code = url.searchParams.get('code');
            if (code === null || code.length === 0) {
                fail('Authorization callback carried no code.');
                return;
            }
            response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            response.end(completingPage());
            if (!settled) {
                settled = true;
                resolveWait({
                    code,
                    ...(url.searchParams.get('client_id') !== null
                        ? { clientId: url.searchParams.get('client_id') }
                        : {}),
                    ...(url.searchParams.get('scope') !== null
                        ? { scope: url.searchParams.get('scope') }
                        : {}),
                });
            }
        });
        const onListen = () => {
            const address = server.address();
            if (address === null || typeof address === 'string') {
                rejectPromise(new SiwcError('loopback listener has no port', 'LISTENER_FAILED'));
                return;
            }
            resolvePromise({
                port: address.port,
                wait: async (signal) => {
                    if (signal !== undefined) {
                        if (signal.aborted)
                            throw new SiwcError('sign-in aborted', 'ABORTED');
                        signal.addEventListener('abort', () => {
                            if (!settled) {
                                settled = true;
                                rejectWait(new SiwcError('sign-in aborted', 'ABORTED'));
                            }
                        }, { once: true });
                    }
                    return waitPromise;
                },
                close: () => { server.close(); },
            });
        };
        server.once('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                // Preferred port busy (another local tool's flow, a stale listener):
                // only the port may vary, so retry on an ephemeral one.
                server.listen(0, '127.0.0.1', onListen);
            }
            else {
                rejectPromise(error);
            }
        });
        server.listen(PREFERRED_CALLBACK_PORT, '127.0.0.1', onListen);
        reporter?.line(`Listening for the ChatGPT callback on 127.0.0.1 (path ${CALLBACK_PATH}).`);
    });
}
const refreshInFlight = new Map();
/**
 * Refresh one account's access token, serialized per account so two
 * callers never race a rotating refresh token. The replacement token
 * set is stored together, under the store's cross-process lock.
 */
export async function refreshAccount(store, clientId, overrides) {
    const inFlight = refreshInFlight.get(clientId);
    if (inFlight !== undefined)
        return inFlight;
    const promise = (async () => {
        const account = await store.account(clientId);
        if (account === undefined || account.refresh_token === undefined) {
            throw new SiwcError('no refresh token stored; sign in again', 'REAUTH_REQUIRED');
        }
        const endpoints = await discoverEndpoints(overrides);
        let tokens;
        try {
            tokens = await postTokenForm(endpoints, {
                grant_type: 'refresh_token',
                client_id: account.client_id,
                refresh_token: account.refresh_token,
                resource: RESOURCE,
            }, overrides?.fetchFn ?? fetch);
        }
        catch (error) {
            if (error instanceof SiwcError && (error.code === 'invalid_grant' || error.code === 'invalid_token')) {
                // A refresh token OpenAI will not take again ends the renewable
                // session: clear the tokens, keep the registration.
                await store.clearTokens(clientId);
                throw new SiwcError('ChatGPT session expired or was disconnected. Sign in again.', 'REAUTH_REQUIRED', { cause: error });
            }
            throw error;
        }
        return store.saveTokens(clientId, tokens);
    })();
    refreshInFlight.set(clientId, promise);
    try {
        return await promise;
    }
    finally {
        refreshInFlight.delete(clientId);
    }
}
/**
 * The access token for the active (or named) account, refreshing first
 * when it is expired or inside the skew window. Throws
 * `REAUTH_REQUIRED` / `MISSING_CREDENTIAL` SiwcErrors the adapter maps
 * onto harness error codes.
 */
export async function ensureAccessToken(store, options) {
    let account = options?.clientId === undefined
        ? await store.active()
        : await store.account(options.clientId);
    if (!isSignedIn(account)) {
        throw new SiwcError('Not signed in with ChatGPT. Run `dsh-chatgpt-siwc login` or `/chatgpt login` first.', 'MISSING_CREDENTIAL');
    }
    if (!planGranted(account)) {
        throw new SiwcError(describeSubscriptionError('subscription_sharing_plan_not_granted'), 'PLAN_NOT_GRANTED');
    }
    const stale = account.expires_at === undefined || account.expires_at - Date.now() <= REFRESH_SKEW_MS;
    if (stale || options?.forceRefresh === true) {
        account = await refreshAccount(store, account.client_id, options?.overrides);
    }
    return { account, accessToken: account.access_token };
}
/**
 * Sign out: revoke the renewable session (refresh token) at the
 * discovery document's revocation endpoint, then clear local tokens.
 * The registration survives unless `purge` is set. Revocation retries
 * transient failures; an unconfirmed revocation is reported, and the
 * user can always disconnect the app in ChatGPT settings instead.
 */
export async function logout(store, options) {
    const account = options?.clientId === undefined
        ? await store.active()
        : await store.account(options.clientId);
    if (account === undefined)
        return { revoked: false };
    let revoked = false;
    if (account.refresh_token !== undefined) {
        const endpoints = await discoverEndpoints(options?.overrides);
        if (endpoints.revocationEndpoint !== undefined) {
            const fetchFn = options?.overrides?.fetchFn ?? fetch;
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
                    });
                    // An empty 200 is success, including for an already-invalid token.
                    if (response.ok)
                        revoked = true;
                    else if (response.status < 500)
                        break;
                }
                catch {
                    // network failure: retry with backoff below
                }
                if (!revoked && attempt < 2)
                    await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
            }
        }
    }
    if (options?.purge === true)
        await store.remove(account.client_id);
    else
        await store.clearTokens(account.client_id);
    return { revoked, ...(account.email === undefined ? {} : { email: account.email }) };
}
/**
 * The signed-in account's model catalog from `GET /v1/models` — this
 * flow's response is `{models: [{slug, display_name, visibility}]}`
 * (not the API-key `data[]` shape). Only `visibility: "list"` entries
 * belong in a picker; server order is preserved.
 */
export async function fetchModels(accessToken, overrides) {
    const fetchFn = overrides?.fetchFn ?? fetch;
    const base = overrides?.apiBaseUrl ?? 'https://api.openai.com/v1';
    const response = await fetchFn(`${base}/models`, {
        headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        throw new SiwcError(`model catalog request failed (HTTP ${response.status})`, `HTTP_${response.status}`);
    }
    const body = (await response.json());
    return (body.models ?? [])
        .filter(model => model.visibility === 'list' && typeof model.slug === 'string')
        .map(model => ({ slug: model.slug, displayName: model.display_name ?? model.slug }));
}
export { PLAN_SCOPE };
//# sourceMappingURL=oauth.js.map