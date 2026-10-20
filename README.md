# dsh-chatgpt-siwc

A DeepSeek Harness plugin that serves model calls from **your own ChatGPT
Plus/Pro plan** through the official **Sign in with ChatGPT (SIWC)**
open-source flow: dynamic OAuth registration, then the **public Responses
API** (`https://api.openai.com/v1`) with the issued OAuth access token.

Effectively only an API surface: one LLM provider route, one settings
card, one CLI. Nothing else.

## Boundaries

- **Not the Codex login.** No `app_EMoam…` client, no
  `chatgpt.com/backend-api/codex` endpoint, no `~/.codex/auth.json`, and
  no contact with any Codex harness state. The only token this plugin
  ever touches is the user's own SIWC token, issued to this app.
- **No sub2api, no pooling.** Requests go straight from the adapter to
  the public API with the signed-in account's token. One account's
  client id only ever travels with that account's tokens.
- **Plan usage is a grant, not an identity.** Sign-in alone enables
  nothing: model calls require the plan-usage scopes
  (`chatgpt.tokens.use.direct`) in the account's granted scope set.
  Per-app caps are the user's to manage in
  [ChatGPT settings](https://chatgpt.com/settings/usage).

## How sign-in works

1. **Dynamic registration.** First sign-in starts with
   `client_id=dynamic_agent_client`, this host's stable
   `ext_agent_host_id`, and an `agent_name_hint`. The callback returns
   the issued `oaiapp_…` client id, which is saved with the account and
   used for the code exchange and every later refresh.
2. **Authorization code + PKCE (S256)** against a loopback listener on
   `127.0.0.1` (path `/auth/callback`), fresh `state`/`nonce` per attempt.
3. **Code exchange** at the token endpoint with
   `resource=https://api.openai.com/v1`. No client secret.
4. **ID-token verification** (JWKS, issuer, audience, nonce). Granted
   scopes — not identity — decide whether plan usage is on.
5. **Refresh** is standard OAuth, serialized per account, with rotating
   tokens replaced atomically. **Sign-out** revokes at the discovery
   document's revocation endpoint, then clears local tokens.

Endpoints come from the OIDC discovery document
(`https://auth.openai.com/.well-known/openid-configuration`), with the
documented production values as fallback.

Accounts live under the Harness home — `chatgpt-siwc/accounts.json`
(`0600`, directory `0700`) plus a non-secret `host.json` holding the
stable host id. Writes are atomic and cross-process locked, so a rotating
refresh token cannot be spent twice by two processes.

## Install & configure

The plugin ships as a Cordis plugin for the DeepSeek Harness. The bundle
patch (`cordis.patch.yml`, referenced from `package.json` as
`dsh.bundle.patch`) registers it with defaults:

```yaml
plugins:
  dsh-chatgpt-siwc:
    provider: chatgpt            # route name (default)
    agentNameHint: DeepSeek Harness
```

Optional config keys: `apiBaseUrl` (public API base override),
`reasoningEffort` (effort materialized when a call names none),
`storePath` (accounts file override).

The settings UI card is in `src/client` (visual identity: white surface,
near-black ink, one green accent reserved for "plan active"). It is
bundled by the harness client, which provides the
`@deepseek-ai/dsh-client-ui-settings-plugins` runtime package named in
`package.json` under `dsh.client.inject`; the registration contract the
client compiles against is declared in `src/client/host.d.ts`.

## CLI

Sign-in is interactive and lives outside the model-call path — drive it
with the bundled CLI (or the settings card):

```bash
dsh-chatgpt-siwc login [--name "DeepSeek Harness"] [--no-browser]
dsh-chatgpt-siwc status          # token-free public view of the account
dsh-chatgpt-siwc models          # the account's live model catalog
dsh-chatgpt-siwc logout [--purge]
```

## Wire contract

The adapter (`src/adapter.ts`) posts `serializeRequest` output to
`POST /v1/responses` and translates the SSE stream into harness chunks.
The serializer enforces the plan-usage contract by omission:

- `store: false` and `stream: true` on every request.
- System prompts travel as top-level `instructions`; a system message
  becomes instructions, never an input item.
- Never sent: `max_output_tokens`, `temperature`, `top_p`,
  `prompt_cache_retention`, `truncation`, `metadata`, `user`.
- Function tools only — no hosted tools. Image/audio input is refused
  locally (`UNSUPPORTED_CONTENT`) rather than silently dropped.
- Provider `subscription_sharing_*` failures (admission or mid-stream)
  surface as plain-language errors pointing at Manage usage.

## Development

```bash
npm run build      # server (tsconfig.build.json) + client (tsconfig.client.json)
npm run typecheck  # both projects, noEmit
npm test           # build, then vitest (wire contract + registration/auth boundary)
```

The OAuth flow itself is exercised by signing in; the test suite covers
everything that can be verified without an account: the serializer's
wire contract, plugin registration wiring, and the adapter's AUTH
boundary with an empty store.
