# Project Neuter Memory: This contains the memory of the project, not agent memories, this is the Project/codebases memory

## Memory Explained

> Within this file contains raw detailed memories no polish, not meant for easy reading. This file contains all deep details,explanations, and expansions not explained in the *CONTEXT.md* file. The *CONTEXT.md* serves as an index to make this file traversable and must be queried first. Each session will be broken down into days within this file. The *CONTEXT.md* holds the key to traverse and will be cross referenced. *AGENTS.md* will host the map to make this traversable.

---

# 2026-10-22: Client-half contract rebuilt against the real harness

## Durable lessons

**A self-authored `declare module` can make fiction typecheck.** The first
settings card compiled against `src/client/host.d.ts`, a hand-written
declaration of a `registerSettingsPlugin` API that does not exist anywhere
in the harness. A green `tsc` proved nothing. Client-half contracts must be
verified against the real harness (checkout source and/or the published
`@deepseek-ai/dsh-client-*` tarballs) and compiled against the published
packages as devDependencies — type-only imports, never a local re-declaration.

**The client artifact is a shape, not a file.** The harness client module
system serves `lib/client.js` as one CJS bundle wrapped in
`window.__ModuleLoader__.load({ id: <package name>, factory: (require) => { …
return module.exports; } });`, with side effects (including CSS injection)
inside the factory. `require` answers only the platform seed words
(react, react/jsx-runtime, react-dom, cordis, dsh-client-store,
dsh-client-ui-slots, dsh-client-ui-primitives, dsh-client-ui-dockkit) plus
registered package rows; everything else must inline. An outside package
reproduces this with a bundler (esbuild here); the browser plugin exports
`apply`/`inject`, and the loader discovers it from `dsh.client.platform:
"web"` plus the `./client` export.

**A wrong call shape in a test can silently hit the real network.**
`refreshAccount(store, clientId, overrides)` takes `SiwcOverrides` directly;
wrapping it as `{ overrides: … }` (the `ensureAccessToken` shape) left the
override empty, so production `fetch` ran and the real OpenAI discovery
document — cached for an hour at module scope — poisoned later discovery
assertions. Tests must always pass endpoint overrides, and a real-endpoint
response inside a test is a shape bug, never a network condition to tolerate.

**Follow-up surfaces (deliberately not built):** the harness `authorization`
seam (`ctx.authorization.registerFlow`, published as `dsh-authorization`) is
the sanctioned sign-in-flow surface, but no shipped web surface currently
runs flows (the Models page writes API keys via `credentials.set`), and its
commit protocol requires a credentials-store record — a hybrid the SIWC
token vault should not adopt blindly. The Models page also declares
`settings.models.provider-card`, a keyed slot for third-party provider
plugins. Both are recorded as future surfaces, not current behavior.

---

# August, 8 2026: Investigation Begins

## <DATE> — <DECISION_TITLE>

**Decision:** <WHAT WAS DECIDED>

**Rationale:** <WHY>

**Alternatives considered:**

- <ALTERNATIVE> — rejected because <REASON>
- <ALTERNATIVE> — rejected because <REASON>

**Consequences:**

- <WHAT THIS ENABLES>
- <WHAT THIS PREVENTS>

**Related:**

- <LINK_TO_TASK, ISSUE, OR OTHER DECISION>
