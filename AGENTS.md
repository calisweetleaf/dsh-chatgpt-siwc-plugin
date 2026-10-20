# Repository Entry and Work Router

## Project identity and current objective

**Repository:** `dsh-chatgpt-siwc-plugin` (`dsh-chatgpt-siwc`, npm package `0.1.0`).
**Purpose:** A DeepSeek Harness plugin that provides a ChatGPT Sign in with
ChatGPT (SIWC) OAuth client, a provider adapter for the public Responses API,
a settings card, and a sign-in/status/models/logout CLI.
**Current objective:** Prepare this repository's entry and routing surface so a
newly assigned Factory agent can orient and begin scoped work without first
reconstructing the project. This is agent-entry setup, not a request to change
plugin behavior.
**Current state observed:** `main` tracks `origin/main`; HEAD is
`9c8c7d6` (`feat: add OAuth flow pages and serialization for ChatGPT
integration`). The working tree was clean before this entry-packet update.
There is no active implementation packet or task board in the repository.
Do not infer that GitHub publication, a release, or Factory's automatic
consumption of this file has been configured.

## Entry sequence

1. Read this file first. It is the repository router and defines task lanes,
   ownership, boundaries, and validation; it is not a substitute for source or
   the README's user-facing contract.
2. Read [`CONTEXT.md`](CONTEXT.md) for the latest concise state and known
   validation posture. Read [`MEMORY.md`](MEMORY.md) only when prior decisions
   or history affect the task; it is a project-history surface, not current
   runtime proof.
3. Consult [`filetree.md`](filetree.md) for spatial orientation or after a
   structural change. It is a map, not a task router or ownership authority.
4. Check `git status --short --branch` before editing. Preserve pre-existing
   user changes. Read the relevant source and its caller/consumer before
   changing behavior; tests and docs alone do not establish runtime behavior.
5. Read [`README.md`](README.md) when changing public behavior, installation,
   boundaries, configuration, CLI, or the documented protocol contract.

If this router conflicts with live code, package metadata, tests, or current
Git state, record the discrepancy in the work report and use the evidence
closest to the affected boundary. Update this packet only after verifying the
new state. Do not convert unavailable evidence into a success claim.

## Hard boundaries

- This is the **SIWC public Responses API** integration. It is not a Codex
  login integration. Never add use of `~/.codex/auth.json`, Codex backend
  endpoints, Codex app credentials, or unrelated harness authentication.
- Do not add account pooling, shared-token services, or forwarding of one
  account's client id with another account's tokens. Requests are for the
  signed-in user's own account.
- A successful identity sign-in is not sufficient authorization for model
  usage. The granted `chatgpt.tokens.use.direct` scope is the usage gate.
- Keep tokens and secrets out of logs, CLI output, tests, documentation,
  commits, and public artifacts. The CLI status path is intentionally
  token-free. Do not run a real OAuth login or revoke an account as a test.
- Preserve the existing plugin boundaries: provider adapter, OAuth/account
  lifecycle, serialization/SSE translation, client settings UI, and thin CLI.
  Do not expand scope into the future DSH/Codex host or other repositories.
- Do not publish, push, release, or alter external GitHub state unless the
  current task explicitly authorizes that operation.
- This repository contains an imported prior AGENTS document with unrelated
  Somnus Accelerate material. That text is not this plugin's architecture or
  authority. Do not carry its project-specific names or assumptions forward.

## Surface and ownership map

| Surface | Owns / when to read | Does not own; route onward |
|---|---|---|
| `package.json`, `package-lock.json` | Package identity, entrypoints/exports, scripts, DSH bundle/client injection metadata, dependency and Node engine contract. Read for packaging or install changes. | Runtime logic. Follow exported entrypoints into `src/`; validate packaging with `npm pack --dry-run` when packaging is changed. |
| `src/index.ts` | Cordis plugin entry, config schema, provider/settings/model-discovery registrations and public programmatic exports. Read for plugin lifecycle/wiring. | Provider protocol details. Follow `src/adapter.ts`, OAuth/store modules, and registration tests. |
| `src/adapter.ts` | Harness `LlmAdapter`, request dispatch, Responses SSE-to-harness translation, usage/error mapping. Read for provider behavior. | Request wire shape and account lifecycle. Follow `src/serialize.ts`, `src/sse.ts`, `src/errors.ts`, `src/oauth.ts`, and adapter tests. |
| `src/oauth.ts`, `src/jwt.ts`, `src/store.ts` | SIWC discovery/registration/PKCE/callback/token refresh and verification; account persistence, token state and plan-scope facts. Read for authentication, credentials, or account lifecycle. | The host's global credentials or Codex auth. Validate with isolated temporary stores and injected fetch/callback seams; never real account actions. |
| `src/serialize.ts`, `src/sse.ts`, `src/errors.ts`, `src/constants.ts` | Responses request contract, SSE parsing, provider errors, endpoints/scopes/constants. Read for wire or error semantics. | Harness registration or UI. Follow `tests/serialize.test.ts` and adapter tests for observed expectations. |
| `src/client/client.ts`, `src/client/host.d.ts` | Settings-card descriptor, token-free account view, and the compile-time contract for the DSH-injected settings package. Read for client UI changes. | Server registration. `package.json` owns the client injection declaration. |
| `src/bin.ts` | Interactive login and token-free status/models/logout CLI. Read for command behavior. | Provider call path. Follow OAuth/store functions; do not print credentials. |
| `lib/` | Built JavaScript, declarations, and source maps consumed by package entrypoints. Generated from `src/` by the build scripts. | Primary authoring source. Edit `src/`, then build; do not hand-edit generated `lib/` unless the task explicitly concerns generated artifacts and the source relationship is preserved. |
| `tests/plugin.test.ts`, `tests/serialize.test.ts` | Regression expectations for plugin registration, signed-out auth boundary, and request serialization. Read/add tests with related behavior changes. | Proof of external OAuth/account operation or complete host installation. Tests use local/injected seams; do not promote them to live-service proof. |
| `cordis.patch.yml` | DSH bundle default plugin registration. `package.json` points to this file via `dsh.bundle.patch`. | Plugin implementation/config schema. Keep the two surfaces consistent and validate YAML/package metadata when changed. |
| `README.md` | User-facing install/configuration, protocol boundaries, CLI and development instructions. | Runtime authority. Keep it aligned with the implementation and tests. |
| `.github/workflows/ci.yml` | Pull-request and `main` push verification on Node 22 and 24: clean install, typecheck, build/tests, and package dry-run. Read when changing GitHub CI behavior. | Does not publish, release, or establish hosted-run success until an actual GitHub workflow run exists. |
| `.gitignore` | Excludes local `node_modules`, npm debug logs, and local tarballs from version control. | Does not ignore build output; `lib/` is tracked package output and remains subject to the source/build relationship above. |
| `CONTEXT.md`, `MEMORY.md`, `filetree.md` | Concise current state, durable project decisions/history, and repository topology respectively. | Source of runtime truth. Update only the surface affected; refresh filetree after structural changes. |

### Boundary-specific authority

- **Package and host discovery:** `package.json` owns package entrypoints and
  DSH metadata; `cordis.patch.yml` owns the bundled default configuration;
  `src/index.ts` owns plugin registrations and config interpretation.
- **Runtime behavior:** `src/` owns authored behavior. `lib/` is a generated
  distribution surface. Tests encode local regression expectations, not a
  universal spec or proof of remote service availability.
- **Wire contract:** `src/serialize.ts` and `src/adapter.ts` implement the
  outgoing request and stream mapping; `README.md` documents the public
  contract. A change must reconcile both and run the relevant tests.
- **Credentials/authorization:** `src/oauth.ts`, `src/jwt.ts`, and
  `src/store.ts` own this plugin's SIWC credential handling and granted-scope
  check. They must not be confused with the host's account or Codex state.
- **If surfaces disagree:** preserve the observation, inspect the executable
  owner and its consumer, run the closest available check, then correct stale
  docs. Do not silently edit generated output or tests to make a behavior look
  correct.

## Work routing

There is no repository task board or active task packet at this entry update.
For a bounded change, state the requested outcome, affected owners, hard
boundaries, and consumed-boundary acceptance check in the work item or handoff
before implementation. Do not create a standing packet system unless the
project's actual work requires one.

| Work lane | Enter here | Required neighboring evidence |
|---|---|---|
| Plugin registration/config | `src/index.ts` | `package.json`, `cordis.patch.yml`, `tests/plugin.test.ts`; build/typecheck. |
| Responses wire/stream behavior | `src/adapter.ts` | `src/serialize.ts`, `src/sse.ts`, `src/errors.ts`, relevant tests; test and typecheck. |
| SIWC/auth/account/store | `src/oauth.ts` or `src/store.ts` | `src/jwt.ts`, `src/constants.ts`, auth-boundary tests, README; use isolated stores/injected network and do not use real account credentials. |
| Settings UI/client bundle | `src/client/client.ts` | `src/client/host.d.ts`, `package.json` `dsh.client.inject`; client TypeScript build/typecheck. |
| CLI | `src/bin.ts` | OAuth/store public functions, CLI package entry in `package.json`; test token-free output and command behavior. |
| Distribution/install | `package.json` | lockfile, `lib/` build, README, DSH metadata; build, typecheck, tests, and `npm pack --dry-run`. |
| GitHub/repository operations | `.github/workflows/ci.yml` owns repository CI definition; inspect actual GitHub run and repository settings for hosted state | The workflow does not publish or release. No hosted workflow run has been observed in this task. Never push or publish without explicit authorization. |

## Validation and handoff

Use the repository's actual scripts from a dependency-complete Node environment
matching `package.json` (`^22.19.0 || >=24.0.0`):

```bash
npm ci
npm run typecheck
npm test
```

`npm test` builds the server and client and then runs Vitest. Run the closest
focused test while iterating, followed by the full relevant gate. For package
surface changes, also run:

```bash
npm pack --dry-run
```

At setup, clean installation initially failed because the dev dependency set
included `@deepseek-ai/dsh-commands` and `@deepseek-ai/dsh-settings`, neither
of which is imported by `src/` or `tests/`; the former's peer graph selected a
newer incompatible DSH alpha package. They remain optional peer integrations
in `package.json` but are no longer installed as development dependencies.
After that metadata correction, clean `npm ci`, `npm run typecheck`,
`npm test`, and `npm pack --dry-run` all completed successfully under Node
`v22.22.1`; `npm test` reported 2 files and 7 tests passing. `.gitignore`
excludes local dependencies, npm logs, and pack archives. The same checks are
configured in `.github/workflows/ci.yml` for Node 22 and 24, but no hosted
GitHub run has been observed yet. Do not bypass future resolver failures with
`--force`/`--legacy-peer-deps` without tracing and resolving the actual
dependency contract.

After a state-changing task:

1. Inspect `git diff --check` and `git status --short`.
2. Run the lane's validation and report exact commands/results, including
   blocked or not-run gates.
3. Update `CONTEXT.md` for material current-state or validation changes;
   append to `MEMORY.md` only for a durable decision/failure lesson, not routine
   activity.
4. Refresh `filetree.md` after adds, moves, deletions, or ownership changes.
5. Leave a concise handoff naming what changed, what was actually verified,
   unresolved risks, and the next concrete entry point. Do not claim a GitHub
   push, release, live OAuth run, or Factory integration unless it occurred.

## Topology

`filetree.md` is the spatial map for all tracked project surfaces. Use it to
reorient and refresh it after structural changes; use this router to choose
the next file. Directory proximity alone does not establish ownership.
