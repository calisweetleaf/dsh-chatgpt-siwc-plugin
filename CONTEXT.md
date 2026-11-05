# Current repository context

Completed standalone provider version 0.2.0. The public SIWC flow, account vault,
provider stream, typed browser account controls and staged settings form are
implemented. The private native Harness port targets a separate API generation.

## Verification

Current restored-checkout gates: `npm run typecheck`, `npm test` (10 files,
86 tests), `npm pack --dry-run` (68 package files), and `git diff --check` pass.
OAuth callback tests use a real loopback listener with fake authorization/token
endpoints; account tests use temporary stores and injected lifecycle functions.
No live account sign-in, revocation or inference was performed as a test.

The test compiler lowers the account service's standard decorators through the
same TypeScript compiler used by the distributed Host build. Runtime methods
use the actual Typert Remote markers and strict client codecs.

## Completed repairs

The CLI browser opener no longer recurses. Reauthorization URLs omit ID-token
hints from console/browser RPC. Callback arrival is bounded and cancellation
listeners are removed. Host-ID creation and token rotation are serialized.
Empty granted scopes clear previous grants. Windows browser launch avoids a
command interpreter. The adapter retains ordered tool replay, actual call IDs,
empty outputs, refusal text, terminal blocks and usage. Its byte-idle watchdog
accepts heartbeat traffic and releases stalled or cancelled readers.

Account sign-out excludes concurrent sign-in; pending sign-in settles before
cancellation/disposal completes. The browser opens the handoff before polling,
retains its fallback link on a status-read error, and cancels only its own
attempt when unloaded. The plugin configuration and route-directory pair are
validated and reconciled together.

## Continuation

The user explicitly authorizes frequent pushes to this repository's origin/main.
Keep completed tested milestones remote. Native Harness changes remain private;
its upstream origin is deepseek-ai rather than the user's repository. Preserve
existing language-native systems and defer the lab until login is useful.
