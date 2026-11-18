# Hook-driven local harness acceptance — 2026-11-17

Candidate plugin: 0.3.0, based on c4bcd9f. This report supersedes the earlier
skills-only acceptance for the newly required hook/Compose workflow. Changes
are local and uncommitted. The owner approved installation and an isolated native
hook test; the local installed plugin is now 0.3.0.

## Implemented

- Native plugin SessionStart, PreToolUse and Stop definitions plus a standalone
  bundled handler. Guards apply only in adopted repositories, as selected by
  the owner. Explicit activation freezes task/configuration/acceptance.
- Missing activation blocks direct edits and detects indirect session changes;
  active configuration deletion cannot disable the completion gate. Failed Stop
  gates request bounded repair. Exhaustion, cancellation and missing required
  evidence produce blocked/interrupted states, never acceptance.
- Managed workers use invocation-scoped context tokens, so stale records do not
  silently disable gates in later sessions. Reviewer worktrees do not recursively
  inherit interactive Stop tasks. Owner disposition remains separate from review.
- V3 requires Docker Compose acceptance; v1/v2 compatibility remains. Runs freeze
  resolved Compose configuration, isolate project identities, reject shared
  resource definitions and built-image tags, enforce health/readiness deadlines,
  run E2E, capture image/log evidence and clean run-owned workloads/volumes.
- Local dependency-graph orchestration validates ownership/cycles, executes bounded
  workers in separate worktrees, waits for all outcomes, retains failed work,
  integrates reviewed snapshots and reruns whole-stack verification/review.
- Four user-facing entry paths and migration/trust guidance are bundled in the
  plugin. Setup preserves existing project files and emits a v3 scaffold.

## Verification evidence

Typecheck, formatting, build and the full **81-test** suite passed. Package
build/freshness/archive checks passed for 39 generated files and six skills.
The extracted ZIP's native hook entry point explicitly denied a verification
bypass without access to template node_modules. This is a packaging/handler test,
not proof of native host dispatch or trusted installation.

Regression coverage includes configuration deletion, unactivated edits, symlink
patch paths, stale managed tokens, persistent repair budgets, malformed Stop
configuration, missing Docker, failed startup/E2E, host-backed named volumes,
shared build tags, SIGINT cleanup, task graph cycles/ownership, integrated worker
snapshots and settled sibling results after a launch failure.

Independent read-only review found concrete false-pass/lifecycle issues during
implementation. Those were fixed and reviewed again; the final focused review
reported no remaining material findings. Reviewers did not run the tests.

## Real Docker and browser execution

Environment: macOS, Node 22.22.3, Docker 29.8.2, Compose 5.5.0, CLI 0.169.0.
The disposable example builds an API service and a Chromium/Playwright E2E
service, with no published host ports or host bind mounts. It checks save/trim,
page-reload persistence, whitespace rejection and API retrieval. Persistence
across container replacement is outside this small pilot's acceptance scope.

Observed runs:

- Initial real full-stack pass: `6cd5486593ae476fb01818fa6af4c546`.
- Deliberately removed normalization: `08c4256ea0e34ea8b0f56240cf4ff52d` failed
  E2E and still completed run-owned cleanup.
- A concurrent correct candidate passed with a distinct project identity and
  successful cleanup. Exact result retained in `/tmp/compose-final-result.json`.
- Direct Stop-adapter exercise on the broken app returned `decision: block`,
  attempt `1/3`, with failing E2E evidence in
  `421cd6b24d574c528cae1da9189f3fb4`.
- Restoring the deliberately broken file to its original correct implementation
  passed Compose and a real authenticated independent Codex review:
  `5cbd903c3bb04b0e99baedb7c437dc1a`, `ready_for_human_review`. The final diff
  against that pilot's correct baseline is empty; this is a fault-injection and
  recovery exercise, not a claimed new feature. No manual evidence was invented.

The real pass/fail projects had zero remaining containers or volumes when
checked after cleanup. Build images/cache are retained; no Docker-wide prune is
performed. Pilot paths and logs under the system temporary directory may expire.

## Real local multi-agent integration

Run `894adf9ad61a4766a6c24a7201ae0eac` dispatched two authenticated Codex
workers concurrently into separate worktrees. One documented normalization;
the other added explicit polite live-status markup. Each received its own
Compose/browser checks and independent review. The orchestrator integrated both
review snapshots into a retained integration worktree, reran Compose, and
collected a final independent review. It ended `ready_for_human_review` with
candidate `bcf8be89f1e521f53cca87d11ca017723ac23659dbe86da48b2002556289ae02`.
The pilot's main branch was unchanged. The final reviewer found no blocking
issue and noted that actual screen-reader announcement was not exercised;
Chromium verified visible status behavior only. Owner disposition remains pending.

This exercised real worker processes and Docker, not fake model acceptance.
It did not prove native hook dispatch inside those workers: the installed plugin
was still 0.2.1, and their gates were controller-managed. Evidence is retained at
`/private/var/folders/wm/nsxs1hz15rz4rf6b8lg96d9h0000gp/T/codex-graph-live-z_vct0yc/repo/.git/harness/orchestrations/894adf9ad61a4766a6c24a7201ae0eac`.

## Native CLI dispatch acceptance

The first two native probes exposed a real packaging defect: CLI 0.169.0 selected
root portable `plugin.json` and silently skipped hooks, even with an explicit
OpenAI hooks extension. Neither SessionStart nor PreToolUse nor Stop ran. The
unprotected test patch was confined to the disposable pilot and reverted before
retry. Direct handler tests had not detected this host integration failure.

The generator now ships only `.codex-plugin/plugin.json` with an explicit hooks
path. Canonical portable metadata stays in `plugin-src`, outside the installable
bundle. Setup and archive tests use the native manifest and assert the absence
of a root manifest. An independent focused review found no material packaging
issue. See the [exact release loader](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/core-plugins/src/loader.rs#L929-L939).

After reinstalling, the native CLI dispatched SessionStart and denied both the
`git -c core.hooksPath=/dev/null status` command and a direct protected acceptance
patch. The first native Stop ran real Compose/Chromium, failed the deliberately
broken normalizer, and sent repair feedback (run
`31c6d9b102a84aa886e4a2e841a8e30e`). The agent changed only `src/title.mjs`, adding
`.trim()` while preserving non-string handling. The second gate's Compose/browser
checks and run-owned cleanup passed. Independent review reported no code or
scope findings and complete evidence for the stated criterion. Native run
`ceea3f9adf554c83968089d0ab095ab3` ended `ready_for_human_review`, candidate
`4ac0e5ef8ae4300ca50673e61100d5d32537a98654333e745734a932895bffb1`.
Only the approved source file changed; the protected probe did not apply. The
final Compose project had no remaining containers or volumes. Owner disposition
is pending, not automatically accepted.

The invocation used `--no-daemon --sandbox workspace-write` and the explicitly
approved `--dangerously-bypass-hook-trust` flag. No persistent trust was granted.
Native log: `/tmp/native-hook-log-3.txt`. Pilot/evidence root:
`/private/var/folders/wm/nsxs1hz15rz4rf6b8lg96d9h0000gp/T/codex-native-hooks-b2_is4ak/repo`.
The agent's final text precedes Stop completion; the persisted gate result above
is the authoritative post-Stop outcome.

## Remaining checks and boundaries

The owner approved updating the installed plugin and native Codex dispatch with
a per-invocation hook trust flag on a disposable task.
No global hook trust or sandbox/approval defaults were changed. Direct handler
execution is not substituted for that native test. Fresh Desktop hook trust/UI
remain unverified. Native dispatch was verified in CLI 0.169.0; managed-worker
nonce propagation through native hooks remains a separate untested integration.

Local guards do not provide a sealed holdout boundary against host-side builders.
A hidden/protected test directory is not advertised as sealed. Containerized
application acceptance is implemented; containerizing the agent with separately
accessible verifier inputs would be an additional isolation mode.

Hook host timeouts/unsupported tool paths can fail open. Shell pattern guards are
limited; post-edit scope checks and OS permissions remain important. Local state
and activation commands are trusted operator inputs, not signed attestations.
External image tags, dependencies and services are re-evaluated on each gate;
production environment equivalence is not inferred from using Docker.

GitHub distribution of this 0.3 candidate, remote CI/Linux/WSL, public-directory
hook support and platform-wide Desktop parity have not been validated. No merge,
push or publication of these new changes has been performed.
