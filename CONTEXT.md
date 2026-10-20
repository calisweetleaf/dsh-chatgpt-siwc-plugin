# Current Repository Context

**Observed:** 2026-10-19
**Repository:** `dsh-chatgpt-siwc-plugin` (`dsh-chatgpt-siwc` npm package)
**Branch / base:** `main` tracking `origin/main`
**Base commit:** `9c8c7d6` — `feat: add OAuth flow pages and serialization for ChatGPT integration`

## Current state

The repository is a TypeScript/Node.js DeepSeek Harness plugin. Its implemented
surfaces are the Cordis plugin/provider registration, SIWC OAuth and account
store, Responses API request/stream adapter, CLI, and settings client. The
root `AGENTS.md` is now the Factory-facing entry/routing packet; it supersedes
the imported Accelerate constitution text that previously occupied that file.
No plugin implementation was changed in this setup pass. Package metadata and
the lockfile were adjusted to remove unused dev-only peer packages while
retaining them as optional package peers. `.github/workflows/ci.yml` defines
read-only PR and `main`-push checks on Node 22/24; this local workflow
definition is not evidence of a hosted GitHub run. `.gitignore` now excludes
local dependencies, npm logs, and package archives.

The working tree has intentional setup edits in `AGENTS.md`, `CONTEXT.md`,
`filetree.md`, `package.json`, `package-lock.json`, `.gitignore`, and
`.github/workflows/ci.yml`; check Git before starting additional work.
`MEMORY.md` remains the project-history surface and contains only its initial
scaffold; there is no active task board or implementation packet.

The optional `@deepseek-ai/dsh-commands` and `@deepseek-ai/dsh-settings` peer
integrations remain declared but are no longer development dependencies:
they are not imported by the repository's source or tests, and installing
`dsh-commands` in the test environment triggered an incompatible transitive
DSH alpha peer resolution. The package contract remains intact while the
unneeded test-only peer graph is omitted.

## Validation posture

The repository declares Node `^22.19.0 || >=24.0.0` and scripts in
`package.json`: `npm run typecheck`, `npm test`, and `npm pack --dry-run` for
package-surface changes.

On 2026-10-19, after correcting the unnecessary development peer graph,
`npm ci`, `npm run typecheck`, `npm test`, and `npm pack --dry-run` all passed
under Node `v22.22.1`. `npm test` built both bundles and reported 2 files / 7
tests passing. No test uses live account credentials or proves a remote OAuth
exchange. The GitHub workflow is not yet proven by a hosted run.

## Boundaries to preserve

- The plugin uses the user's SIWC token with the public Responses API; it is
  not Codex login or Codex backend access.
- Model usage depends on the required granted scope; identity-only sign-in is
  insufficient.
- No token pooling or cross-account client-id/token mixing.
- Keep credentials out of output and never test by signing in/revoking a real
  account.
- No GitHub push, release, or external state change was part of this setup.

## Next entry point

The next Factory task should begin at `AGENTS.md`, identify its specific lane,
inspect the named source and consumer, and run the relevant validation. This
setup does not establish that Factory automatically consumes the file or that
GitHub CI has run. No release or publish workflow is configured.
