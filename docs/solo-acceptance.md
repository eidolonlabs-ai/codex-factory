# Solo release acceptance — 2026-11-17

Historical 0.2.1 pilot. See [0.3 acceptance](hooks-acceptance.md) for current hook and Compose evidence.

Local release candidate: plugin **0.2.1**, macOS arm64, Node 22.22.3,
Codex CLI 0.169.0. Branch `codex/solo-developer-workflow`, base
`1175ec00f3e5f5b9358e98ea77a9d01e458d7ebf`; changes remain uncommitted.
Owner authorized implementation, the disposable app, and local plugin registration
and installation. No publication, merge or deployment was performed.

## Implemented and checked

- One shared interactive/managed workflow usable from either interface.
- Preview-first adoption suggestions; v1 compatibility; opt-in v2 editable
  application/unit-test paths with fixed control/config/package protections.
- `prepare`/`preflight` with exact criterion mappings, unresolved decisions,
  task identity and resolved base; readiness distinct from final acceptance.
- Shared verification/review packets with candidate/config/policy identities,
  bounded logs, separate review collection and explicit owner disposition.
- `runs`/`status`/`handoff`, candidate freshness checks, retained worktrees, and
  persisted interrupted/failed review state. No automatic destructive recovery.

| Validation | Observed result |
| --- | --- |
| Typecheck / formatting / build | Passed |
| `npm test` | 61 passed, no failures or skips |
| Demo verifier | Passed, labeled fixture only |
| Plugin build / freshness / ZIP | 34 generated files, six skills; passed |
| Installed runtime | Byte-identical to generated 0.2.1 runtime |
| Fresh authenticated CLI discovery | All six installed 0.2.1 skills listed from initial metadata |
| Setup / archive regression tests | Repeated additive adoption preserves existing rules/config; extracted bundle runs independently |
| Negative regression cases | Missing checks/executable, protected edits, invalid paths, candidate drift, missing review output, missing manual evidence and interrupted review covered |

The ZIP at `dist/codex-harness-0.2.1.zip` is a source/private distribution
artifact. It is not a completed public-directory submission.

## Actual disposable application

`examples/solo-pilot` is a deliberately failing source fixture: a notes UI,
loopback HTTP API, JSON persistence and protected unit/integration tests. Copies
were initialized as separate interactive and managed Git repositories. The
initial title-normalization unit check failed. Only disposable `src/title.mjs`
was repaired; the tracked example retains the reproduction.

Both final candidates have digest
`96d2f278585f399e944fe4c638417f22d3691628baeef9c2643162c3807beab3`.
The unit check covers trimming/whitespace/non-string inputs. The integration
check starts a real HTTP service, tests validation and trimmed writes, restarts
the service, and verifies persisted data.

Interactive: the coordinator made the scoped repair; installed verification
and a real separate Codex review succeeded. Browser save, reload persistence
and whitespace rejection were observed. Final 0.2.1 verification run: `72b081a3b5464441aef59932cfcb40a2`.
The earlier real review `c55a30eb5bed4e2498578fb581c65d10` used 0.2.0, found no
defects/missing evidence, and left owner disposition pending.

Managed: first run `6bdaf7cca103441da9d68033908bfdd6` retained its repair but
failed when the builder reported its sandbox could not bind the integration
service. This exposed an instruction ambiguity. The prompt now assigns service
acceptance checks to the controller while the worker reports scoped
implementation completion; the controller still verifies independently.

A new real authenticated 0.2.1 run, `8b0d3149168146c18ef3f0c1620f9ff2`, completed
the repair, passed both independent checks, and collected a separate review.
It correctly stopped at `awaiting_manual_evidence`. The reviewer independently
flagged the missing browser observation rather than treating HTTP checks as UI
coverage. The browser then visibly saved a padded title as “Managed browser
note”, retained it after reload, and rejected whitespace without adding a note.
The observation was stored outside the working tree and bound to the candidate.

Follow-up verification/review `f100d880e8254bdb958cdd0a863152f6` passed with no
missing evidence and no concrete reviewer findings. Its status is
`ready_for_human_review`; **owner disposition remains pending**. This exercise
also verified that follow-up evidence works from the managed linked worktree.

Raw pilot evidence is retained locally under
`/private/var/folders/wm/nsxs1hz15rz4rf6b8lg96d9h0000gp/T/codex-solo-pilot-RROqCB`
in each Git common directory's `harness` folders. These temporary paths are
machine-specific and may expire. Browser screenshot: `dist/solo-pilot-browser.jpg`.
Neither local hashes nor operator observations are signed attestations.

## Independent harness review

Read-only native reviews examined policy and the integrated implementation.
Fixed findings: nested executable config protection, accepting empty reviewer
output, and stale verified status after interrupted review. A reporting follow-up
now preserves the review failure reason. Focused re-review found no remaining
material issue. CLI regression checks prove missing-manual and changed-candidate
acceptance is refused, and complete current evidence can receive an explicit
owner disposition. Test-only fake reviewers are not counted as live acceptance.

## Remaining release checks

- Fresh Desktop UI skill discovery and a separate Desktop-hosted managed
  journey remain unverified. Computer-use access to the Codex app was blocked
  by the environment; no alternate UI-control workaround was attempted.
- Published GitHub revision installation awaits authorized publication. Local
  marketplace installation does not prove a remote install.
- Linux/WSL, remote CI, project-native role loading and real model intake were
  not exercised for this candidate. No native Windows support claim.
- Real-model cancellation was not exercised; SIGINT persistence is verified
  by a command-level supervised-process regression. Missing executable behavior
  is tested; broader external-service outages are not covered by this pilot.
- Public directory submission still needs publisher/listing assets and portal
  review. Factory scheduling, distributed leases, sealed acceptance environments,
  organization policy and deployment automation remain outside the solo scope.

The local acceptance evidence supports this solo release candidate; it does
not establish every platform, application, or production-readiness claim.
