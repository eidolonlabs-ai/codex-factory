# Solo developer harness implementation plan

> **For agentic workers:** Use superpowers:executing-plans for sequential
> implementation. Follow the repository's coordinate-development workflow;
> native subagents perform focused analysis/review, not parallel shared-workspace
> builds. Steps use checkboxes to track progress.

**Goal:** Make the packaged harness a practical, verified daily workflow for
one developer, usable from Desktop and CLI with shared acceptance and review.

**Architecture:** Preserve the current controller and plugin. Separate host
interface from interactive/managed execution, share task readiness and review
evidence, and keep state in the project and Git common directory. Prefer small
local commands and records over a service or scheduler.

**Tech stack:** TypeScript, Node.js 22+, Git, existing JSON contracts, Codex,
and the existing plugin generator/bundler.

**Spec:** `docs/superpowers/specs/2026-11-17-solo-developer-harness.md`.

**Status:** approved with “go”; tasks 1–5 implemented and reviewed locally.
Task 6 has local acceptance evidence; Desktop discovery and published GitHub
installation remain unverified. See `docs/solo-acceptance.md`. Existing packaging is an
uncommitted candidate based on `1175ec00f3e5f5b9358e98ea77a9d01e458d7ebf`;
preserve it. Record its complete diff and pin the actual implementation base
before starting. Do not discard it or assume the old commit contains the plugin.

## Global constraints

- Node.js 22+; Git; macOS/Linux including WSL. No native Windows claim.
- Default to interactive work; explicitly requested unattended work uses the
  existing managed controller from either Desktop or CLI.
- One builder per task; serialize dependent work. No factory infrastructure.
- Keep limits at 3 attempts, 1200 seconds per agent, 600 seconds per check,
  5400 seconds per managed run unless the owner configures different values.
- Preserve version-1 contracts and protected behavior. New policy is opt-in
  and reviewed; do not weaken controls to get tests to pass.
- Generated plugin files come from canonical sources; regenerate and check
  them after relevant edits. No cache edits or silent scaffold overwrites.
- No publication, merge, deployment or global setting changes under plan-only
  authorization. No automatic destructive worktree/evidence cleanup.

## Review focus

- Dirty work and a switched base must not disappear during mode changes or
  follow-up runs; exercise this in tasks 3 and 5.
- Application-test edits must not create a path around trusted checks; exercise
  protected configuration, renames and path validation in task 2.
- Missing browser/services or stale candidate evidence must not become a pass;
  exercise incomplete readiness and evidence drift in tasks 3 and 4.
- A reviewer process exiting zero with findings must not become a clean review;
  exercise findings, malformed output and missing context in task 4.
- Plugin upgrades and process interruption must preserve project customization
  and developer changes; exercise them in tasks 2, 5 and 6.

## Task 1 — Unify the workflow across interfaces

**Owned paths:** `.agents/skills/`, `README.md`, `docs/desktop.md`,
`docs/cli.md`, `docs/builder-prompts.md`, `docs/plugin.md`,
`plugin-src/skills/setup-project/`, `scripts/build-plugin.mjs`, and generated
`plugins/codex-harness/`.

**Depends on:** none. **Produces:** a shared mode-selection contract and
invocation instructions; no new orchestration backend.

- [x] Replace the Desktop prohibition on controller invocation with an explicit
  interactive/managed distinction. Keep interactive terminal sessions equally
  distinct from controller-managed work.
- [x] Document the managed launch from either host, run-ID/status monitoring,
  process lifetime caveats, cancellation and human handoff. State that the
  launched process is separate from the interactive chat.
- [x] Make sequential solo work the default. Keep parallel builders optional
  with explicit ownership/dependencies and integrated verification.
- [x] Regenerate the plugin; run `npm run plugin:check` and review all skill
  references. Do not launch a live unattended run during this documentation task.
- [x] Once installation is authorized, run an early Desktop/CLI discovery smoke
  check on the existing package before further runtime work. Resolve any actual
  host packaging incompatibility before building additional workflows on it.

**Acceptance:** both interfaces describe the same lifecycle and mode rules;
no instruction claims controller guarantees for an unsupervised chat.

## Task 2 — Make adoption and protection usable in existing projects

**Owned paths:** `harness/models.ts`, new `harness/policy.ts`,
`harness/verify.ts`, `harness/runner.ts`, `harness/doctor.ts`,
`schemas/config.schema.json`, `plugin-src/scripts/setup.mjs`, setup skill,
`tests/policy.test.ts`, `tests/plugin.test.ts`, and adoption/plugin docs.

**Depends on:** task 1. **Interfaces:** introduce
`resolvePolicy(config: Config): ProtectionPolicy` and
`classifyChanges(paths: string[], allowed: string[], policy: ProtectionPolicy): ScopeFinding[]`.
`ProtectionPolicy` contains normalized editable/protected prefixes and a policy
version; `ScopeFinding` contains path, reason and disposition. Schema design is
a reviewed deliverable before wiring it into `scopeViolations`.

- [x] Specify an opt-in version-2 configuration, migration preview and fixed
  control protections. Define how routine unit tests/package changes are
  permitted while trusted acceptance inputs stay protected. Protected prefixes
  take precedence over editable prefixes; reject malformed paths and unsupported
  overrides. Version 1 must resolve to its existing policy unchanged.
- [x] Add failing regression cases for legacy equivalence, editable unit tests,
  protected-check edits, policy/config mutation, renames, path traversal,
  symlinks and empty/missing checks. Run targeted tests to establish the failures.
- [x] Implement policy resolution frozen before worker execution. Include its
  identity in evidence; never let a candidate's edits redefine its own checks.
- [x] Improve setup/preflight to inspect existing configuration and propose
  stack-appropriate commands without executing guessed commands or overwriting
  files. Separate verification readiness from authenticated managed-run readiness.
- [x] Verify repeated setup and upgrade previews preserve custom rules/checks.
  Run `node --import tsx --test tests/policy.test.ts tests/plugin.test.ts` plus
  existing controller regressions. Obtain focused review of protection changes.

**Acceptance:** a normal feature can add a unit test under an adopted policy;
the same task cannot silently change its trusted verifier or protection policy.

## Task 3 — Add a compact, checkable task-readiness record

**Owned paths:** new `harness/readiness.ts`, `harness/cli.ts`,
`harness/models.ts`, `schemas/`, `docs/templates/`, coordinator/intake skills,
`docs/design-checklist.md`, `tests/readiness.test.ts`, and generator resources.

**Depends on:** tasks 1–2. **Interfaces:**
`assessReadiness(task: Task, config: Config, record: AcceptanceRecord): ReadinessResult`.
The companion `AcceptanceRecord` maps stable criterion IDs to existing named
checks or required manual/live evidence, records base/spec identity and unresolved
decisions. `ReadinessResult` returns `ready`, `blockers` and `missingEvidence`.
Keep existing task JSON readable; do not overload it with Desktop-only metadata.

- [x] Define the companion schema and task-card mapping. Distinguish readiness
  to implement from verified completion: required live evidence may be planned
  before work, but cannot be marked complete until collected for the candidate.
- [x] Test missing criteria, unknown check names, unresolved decisions, stale
  base/spec identity, and manual evidence incorrectly treated as automated pass.
- [x] Add a `preflight TASK` command that reports readiness without launching
  a builder. Both host workflows use it before managed execution.
- [x] Wire the edge-case/contract checklist and reproduction-first repair recipe
  into canonical skills so template and generated plugin behavior stay aligned.
- [x] Run targeted readiness tests and schema compatibility tests; verify a
  small feature requires only a small task record, not a full architecture dossier.

**Acceptance:** the developer can see what is ready, what needs a decision, and
which acceptance evidence will still be required after implementation.

## Task 4 — Give verification and review the same evidence in both modes

**Owned paths:** `harness/verify.ts`, `harness/review.ts`, `harness/runner.ts`,
`harness/evidence.ts`, `harness/cli.ts`, new `harness/review-packet.ts`,
review/verification skills, result schemas, `tests/review-packet.test.ts`,
`tests/workflows.test.ts`.

**Depends on:** tasks 2–3. **Interfaces:**
`buildReviewPacket(task: Task, acceptance: AcceptanceRecord, verification: VerificationResult, candidate: string): ReviewPacket`.
The packet references bounded diff/check artifacts and records omissions.
Support `verify --task TASK` and `review --task TASK` for an interactive candidate;
the managed runner invokes the same underlying operations.

- [x] Write tests proving the reviewer receives specification, criteria, full
  candidate diff, check outcomes and outstanding evidence, not just a base SHA.
- [x] Persist verification results with candidate/config/policy identities.
  Reject reuse after drift and preserve committed, dirty and untracked changes.
- [x] Supply the same bounded packet to managed and native reviewer workflows.
  Preserve fresh context and current mutation checks.
- [x] Preserve reviewer prose and record collection status separately from
  owner disposition (pending, changes requested, accepted). Do not automatically
  infer findings or a clean review from prose/process exit. Validate disposition
  records against candidate identity; missing/malformed disposition stays
  pending. Automatic reviewer-driven repair is deferred.
- [x] Test zero-exit review with findings, missing review, changed candidate,
  missing live evidence and repair/reverification. Run targeted and integrated
  workflow tests, then focused independent review.

**Acceptance:** neither mode reports the task as fully verified/reviewed while
required evidence is missing or review findings remain unresolved.

## Task 5 — Make status, handoff and interruption recovery straightforward

**Owned paths:** `harness/cli.ts`, `harness/evidence.ts`,
`harness/workspace.ts`, new `harness/status.ts`, state/task templates,
`docs/cli.md`, `docs/plugin.md`, `tests/status.test.ts`.

**Depends on:** tasks 3–4. **Interfaces:**
`readRunSummary(repo: string, runId: string): RunSummary` and
`renderHandoff(summary: RunSummary): string`.
`RunSummary` includes status/phase, candidate/base, evidence paths, blockers,
and next action. Add read-only `runs` and `handoff RUN_ID` commands; retain
existing JSON status behavior for automation.

- [x] Test successful, failed, interrupted, incomplete/corrupt and missing runs,
  linked worktrees, dirty candidate drift and invalid run IDs.
- [x] Generate a concise handoff usable in a new Desktop or CLI chat. Distinguish
  a process reported running from a verified live process; do not trust a PID
  alone or silently remove an uncertain lock.
- [x] Document explicit follow-up from retained work: inspect diff, choose base
  and new task/run, preserve old evidence. Do not implement automatic resume,
  process detachment, a daemon, or destructive cleanup in this milestone.
- [x] Exercise SIGINT recovery and a stale record in disposable repositories;
  ensure no work/evidence is lost and no stale result is presented as current.

**Acceptance:** after an interrupted session the developer can determine what
happened and continue deliberately without reconstructing the entire chat.

## Task 6 — Prove the installed solo workflow and prepare release

**Owned paths:** `tests/`, `examples/solo-pilot/`, `docs/plugin-validation.md`,
new `docs/solo-acceptance.md`, `docs/design-coverage.md`, `docs/scaling.md`,
release metadata, generator and existing CI additions as needed.

**Depends on:** tasks 1–5. **Produces:** an observed acceptance record and
reviewable release candidate; publication is a separate authorized action.

- [x] Run typecheck, formatting, all tests, build, demo verification, plugin
  freshness and archive checks. Preserve existing CI checks and protections.
- [ ] With installation authorization, verify six-skill discovery and resource
  access in fresh Desktop and CLI sessions, recording host/plugin versions.
- [x] Use a disposable pilot, or an owner-selected project, with a small UI,
  API and persistence journey. Configure unit/integration/browser checks and
  real service startup; the pilot is an example, not a universal required stack.
- [ ] Exercise interactive work and an explicitly authorized managed run from
  each interface, with a real authenticated model. Include a reproduction-first
  bug fix, failing check, missing service, reviewer finding and interrupted run.
  Compare gates/evidence, not identical generated code.
- [ ] Verify repeated adoption and release-upgrade preservation. Document current
  process lifetime/cancellation behavior instead of assuming UI independence.
- [x] Review the complete integrated candidate. Resolve material findings and
  rerun affected checks plus integrated verification before release handoff.
- [ ] After authorized GitHub publication, install the pinned revision through
  the repository marketplace and repeat discovery/smoke checks. Keep public
  directory metadata/submission as a later release task.

**Acceptance:** installation and one real solo journey are demonstrated rather
than inferred from unit tests. Unsupported hosts/services remain explicitly
unverified; no live-model or browser result is substituted with a fake.

## Sequence and completion

Execute 1 → 2 → 3 → 4 → 5 → 6 sequentially in this workspace or an approved
isolated worktree. Each task gets a scoped task card and independent review
where controls or semantics change. Stop for consequential unresolved decisions;
reuse existing authorization for the agreed scope. Preserve reviewable task
boundaries; do not merge or publish as part of ordinary implementation.

The first solo release is complete when a developer can install, adopt, define
and run a task, see verified/reviewed evidence, and recover from failure from
either interface. Factory features are deferred, not marked implemented.

## Execution closeout

Local implementation and integrated review completed on 2026-11-17. Detailed
results and precise limits are in `docs/solo-acceptance.md`. The unchecked host
and publication steps remain open; implementation checkmarks do not imply
every platform/failure permutation was exercised. Package manifests remain
protected (reviewed policy ruling), and manual evidence lives outside the tree
to avoid self-referential hashes. No scheduler or automatic reviewer-driven
repair was introduced. Local installation was separately and explicitly approved.
