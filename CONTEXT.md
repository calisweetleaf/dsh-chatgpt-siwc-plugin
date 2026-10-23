# Current Repository Context

**Observed:** 2026-10-22
**Repository:** `dsh-chatgpt-siwc-plugin` (`dsh-chatgpt-siwc` npm package)
**Branch / base:** `main` tracking `origin/main`; the 2026-10-22 production-readiness pass is committed on top of `e3a89ac`.

## Current state

The plugin serves one LLM provider route backed by the official Sign in
with ChatGPT flow and the public Responses API. The 2026-10-22 pass
rebuilt the client half against the real harness contract and hardened
the host half:

- **Client half (was fiction, now real).** The old card compiled against a
  self-authored `host.d.ts` declaring a nonexistent `registerSettingsPlugin`
  API, and its plain-tsc ESM output could not load in the harness. It is
  now a real browser plugin (`src/client`): `apply`/`inject` exports,
  `plugins.item` slot registration on the Plugins page gated on the served
  settings namespace, staged-form editing through the client settings
  scope, `en`/`zh` locale dictionaries, and an esbuild bundle in the exact
  client-module artifact shape (`window.__ModuleLoader__.load({ id,
  factory })`, verified by a stub-module-table smoke run).
- **Live configuration.** `apply` installs the `dsh-chatgpt-siwc` settings
  section via `ctx.settings.installSection` (optional service); committed
  changes re-register the provider route atomically, `apiBaseUrl`,
  `reasoningEffort`, and `storePath` are read live through adapter option
  providers, and refused swaps keep the previous route serving.
- **Discovery honors its contract.** The registered discovery takes the
  request/signal pair, settles immediately when aborted, and bounds the
  catalog fetch.
- **The loopback callback page is held open** until the sign-in validates,
  then renders the outcome (success page with identity/plan/first-time
  hint, or the failure). Every control-plane fetch is timeout-bounded and
  the held page has its own deadline; `successPage` is live code again,
  the one-time welcome rides the store's `welcomed` flag, and the unused
  `completingPage` was removed.
- **Stream translation hardened.** Blocks are opened at
  `output_item.added` and at `output_item.done` for delta-less items, so
  a message the deltas never observed still backfills instead of being
  dropped; a plan-not-granted account surfaces as `AUTH`.
- Cleanup: `@deepseek-ai/dsh-timeout` (never imported) was replaced by
  `AbortSignal.timeout`/`AbortSignal.any`; esbuild, zustand, and the
  published `dsh-client-*`/`dsh-settings` type packages are devDependencies;
  `.surgeon/` is gitignored and vitest runs only `tests/**/*.test.ts`.

## Validation posture

On 2026-10-22 (Node v24.14.0) after the changes: `npm install`,
`npm run typecheck` (server + client projects), `npm test` (build + vitest:
6 files, 58 tests passing, no unhandled errors), and a clean `npm ci` +
full gates + `npm pack --dry-run` close the pass — the commit message
carries the exact final results. Tests use fake endpoints, fake JWKS,
and a real loopback listener; no test touches a real OpenAI endpoint or
account. The client card has no runtime coverage against a booted harness
web client (no built harness in this environment): its staged-form logic
is covered by `tests/card-form.test.ts` and its compile-time contract by
the published `0.1.6-alpha.*` types. The GitHub workflow is still
unproven by a hosted run.

## Boundaries to preserve

- The plugin uses the user's SIWC token with the public Responses API; it
  is not Codex login or Codex backend access.
- Model usage depends on the required granted scope; identity-only sign-in
  is insufficient.
- No token pooling or cross-account client-id/token mixing.
- Keep credentials out of output and never test by signing in/revoking a
  real account.
- The authorization seam (`registerFlow`) and the Models-page
  `settings.models.provider-card` slot are documented follow-up surfaces,
  not current behavior.

## Next entry point

Start at `AGENTS.md`, then this file. Likely next steps: mount the plugin
in a local harness web build to see the card render end to end; consider
the authorization-flow seam for UI sign-in once a surface runs flows.
