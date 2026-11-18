# Design coverage assessment

The initial assessment below is historical. Owner corrections require native
hooks, local multi-agent orchestration and Docker Compose acceptance. See
[harness design correction](harness-design-correction.md), [hooks](hooks.md),
[orchestration](orchestration.md), and [entry paths](entry-paths.md). The earlier
deferral of interactive hooks is superseded.

Reviewed 2026-11-17 against the plugin candidate and existing harness. The
owner's intended product is a reusable custom harness/plugin for a solo
developer or small team, with a possible later role in a software factory.

## Conclusion

The core local development loop is covered: clarification, explicit task
contracts, scoped implementation, independent checks, bounded CLI retries,
separate review, and human merge handoff. Plugin packaging now makes this
usable outside the template repository. It does **not** implement every
mechanism proposed by the supplied material, nor does it constitute a
distributed software factory.

The central distinction is execution mode. Desktop skills describe a workflow;
the managed CLI controller enforces its attempt/deadline and result gates.
Neither path makes local worktrees or hidden test directories into a security
boundary. This distinction is necessary for an accurate product promise.

## Sources and method

All five supplied files were read as design input, including all ten workshop
slides and their notes. The DOCX and Markdown playbooks substantially overlap;
both renditions were inspected. DOCX paragraphs and PPTX slide text/notes were
extracted from OOXML. This is a content/design review, not a visual layout
review or a verification of every historical platform claim in the material.
Original files were not modified, copied into the public package, or executed.

Source keys refer to the supplied filenames:

- **P:** OpenAI Codex Desktop & CLI End-to-End Playbook_ From Idea to Verified
  Full-Stack App.docx and the corresponding .md file.
- **W:** AI Software Factories & Harness Engineering Workshop.pptx.
- **G:** AI Software Factories & Harness Engineering Guide.docx.
- **A:** Complete App & Engineering Workflows with OpenAI Codex (App & CLI).docx.

A native architect performed a read-only coverage assessment against all five
sources and the owning implementation. No Entire checkpoint history was
available in this repository; findings below use current code and documents,
not inferred historical intent. Claims of runtime success belong in
[plugin validation](plugin-validation.md), not this source comparison.

## Coverage matrix

| Design aspect and source | Owning implementation/resource | Coverage and limit |
| --- | --- | --- |
| Reusable skills and existing-project adoption — A I §2.2; G §5; W slide 9 | `plugins/codex-harness`, `scripts/build-plugin.mjs`, `plugin-src/scripts/setup.mjs` | Implemented packaging and additive setup. Existing project config survives; adoption still requires meaningful project checks and rule reconciliation. |
| Spec clarification and edge cases — P §3 phase 1, §5 prompt 1; A I §2.1 | `architect-intake`, `harness/intake.ts`, `docs/design-checklist.md` | Generic intake is implemented/instructed. New optional checklist covers ordering, retries, concurrency, time, deletion and cross-service recovery without imposing a stack. |
| Freeze interfaces and task scope before builders — P §3 phase 2; G §3 | `harness/models.ts`, `harness/verify.ts`, task-card template | Strict task schema and CLI scope detection implemented. Spec approval, upstream contract pinning and architecture choices are recorded workflow decisions, not cryptographic approval. |
| Application acceptance and deterministic oracles — W slide 6; A I §4.1 | `harness/verify.ts`, `harness/runner.ts`, `verify-task` | CLI runs configured checks independently, fails empty/missing checks, and detects candidate mutation. Desktop invokes it by instruction. No universal app test suite is supplied. |
| Test strategy, failing cases, service setup — P §3 phases 0–2 | `docs/adoption.md`, `docs/design-checklist.md`, project `harness.json` | Guidance and execution mechanism provided. App-specific fixtures, migrations, E2E, security and accessibility checks remain adoption work. Docker/OpenAPI/Playwright are examples, not dependencies. |
| Reproduction before bug/review fixes — P §3 phase 4; A II workflow 2 | `docs/design-checklist.md`, packaged `implement-task` | Added a focused reproduction/regression/repair procedure. This is guidance, not test-first enforcement. Protected acceptance edits still require review. |
| Parallel worktrees and integration — W slide 7; A I §3 | `harness/workspace.ts`, coordinator, builder prompts/task cards | CLI worktree creation and Desktop workflow covered. Separate builder ownership, dependency order and integrated verification are instructed. No fleet scheduler. |
| Independent fresh review — G §2; A I §4.2 | `harness/review.ts`, `review-task`, coordinator | CLI review uses a separate process/snapshot and detects mutation. Desktop requests a fresh native reviewer. Bundled role files are references; role loading and plugin access are not assumed. |
| Circuit breakers and bounded repairs — G §2; P §1 | `harness/process.ts`, `harness/runner.ts`, config limits | Agent/check/run timeouts and attempt limits enforced by managed CLI. Desktop repair limit is instruction-only. No shared spend/concurrency budget across runs. |
| Prevent test cheating / sealed holdouts — W slide 6; G §2 | protected-path checks in `harness/verify.ts`; `docs/security.md` | Protected changes detected after writes; not prevention or unreadable tests. True sealed acceptance environments are missing and deferred. |
| Brownfield conventions and migrations — A II workflows 1, 3, 4 | adoption and implementation guidance, additive setup | Existing rules/config are preserved; exemplar code, compatibility and scoped changes are workflow practices. No automated migration planner. |
| Context hygiene and durable handoff — W slides 3–4; A III | state/task templates, CLI run artifacts/log tails | Bounded evidence and explicit shared state covered. No central knowledge store or automatic context-quality enforcement. |
| Live app/platform acceptance — P §3 phase 0; A I §4.2 | task-card live/browser fields, verifier, compatibility docs | Mechanism and reporting guidance covered; actual services/UI/platform checks depend on the target app. Native Windows runtime remains unsupported; WSL follows Linux. |
| Lifecycle hooks and command guards — W slides 5–7; G §§1–2 | documented controller-based design | No hooks installed. Controller-managed checks provide completion gates only within that path. Universal Desktop Stop/PreToolUse enforcement is not supplied. |
| Factory queues, ticket/webhook intake, cloud jobs — W slides 7–8; G §3 | versioned task/result formats, `docs/scaling.md` | Extension seams exist; scheduler, leases, idempotency and provider adapters are future work. Local task locks are not distributed ownership. |
| Automated PR/CI reporting and DORA metrics — G §3; A II workflow 5 | harness CI, human handoff, scaling guide | Harness CI exists; application CI integration is adoption work. No PR automation, automatic merge, deployment or operational telemetry pipeline. |
| Organization governance and global fallback — W slide 9; G §§4–5 | plugin marketplace, adoption/scaling guides | Distribution supports reuse. No org policy inheritance, automatic sync PRs or mandatory fleet enforcement. Installation does not rewrite global settings or every project. |

## Conflicts in the supplied design material

Some workshop/guide language treats worktrees as sandboxes, hidden directories
as sealed holdouts, and reduced approval prompts as a safety result. Those
claims are not adopted. Worktrees isolate working copies; process permissions,
network access and trusted verification infrastructure determine stronger
boundaries. A builder with filesystem access may read or modify local tests.
Local hashes are useful evidence but not tamper-proof attestations; ignored
files remain outside the current candidate digest.

The sources also include particular models, tool commands, application stacks,
global settings and cloud orchestration examples. They are illustrative source
material, not authorization to execute them or universal product requirements.
Packaging deliberately preserves model choice and the Desktop-first workflow.

## Priorities for the intended product

**Initial packaging priorities (superseded by the solo implementation below):** validate plugin discovery in the target Desktop version,
adopt it in one real small project, and exercise that project's full acceptance
journey. The automated package smoke tests establish portability and failure
behavior, not application quality. Consider a later reviewable design for
project-specific protected paths: the existing conservative defaults can block
routine package/test edits in brownfield managed runs and are unchanged here.

**Small-team next step:** standardized task/contract records, shared application
CI, pinned plugin releases, and a repeatable integration/review handoff. Add PR
and CI adapters only when desired; preserve the human merge boundary. Introduce
release/migration policy for project scaffolds rather than overwriting them on
plugin upgrades.

**Factory later:** a durable queue with leases, heartbeats, idempotent dispatch,
aggregate budgets and concurrency limits; separate builder and verifier
environments; sealed acceptance inputs and immutable candidate artifacts;
reviewed PR automation; retention/redaction and telemetry; organization policy
distribution. These require additional architecture and operating decisions.
The plugin can be a reusable worker workflow within that system, but packaging
alone does not implement it.

No new consequential owner decision from the source review blocked the
already-approved plugin work. Guidance additions are stack-neutral; expanding
into a software factory remains a separate future scope.

## Solo implementation update — 2026-11-17

The approved follow-up implements the important local workflow gaps: shared
interactive/managed semantics; opt-in v2 editable unit-test paths with fixed
verifier protections; previewed setup suggestions; explicit criterion/check/manual
evidence mapping; candidate-bound review packets and owner disposition; and
durable status/handoff with interruption evidence. Version 1 remains compatible.
Package manifests and lockfiles remain protected because checks can execute
their contents; dependency changes require a separately reviewed workflow.

A disposable UI/API/persistence pilot exercises the installed bundle. See
[solo acceptance](solo-acceptance.md) for actual results and platform limitations.
Desktop UI discovery is still unverified; shared runtime support alone is not
proof of host integration. Factory queues, isolated verification, fleet budgets,
organization policy and deployment automation remain deliberately deferred.
