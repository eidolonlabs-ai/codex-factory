# Design correction: hooks are core to the solo factory

This is the design record from before the 0.3 implementation. See [coverage](design-coverage.md) and [0.3 acceptance](hooks-acceptance.md) for the resulting behavior.

Owner direction, 2026-11-17: the supplied **AI Software Factories & Factory
Engineering Guide.docx** and **AI Software Factories & Factory Engineering
Workshop.pptx** define the intended design. Solo scope does not remove hooks.
This supersedes the earlier decision to treat interactive enforcement as
skills-only. The 0.2.1 release is useful infrastructure, not completion of the
intended factory. Original documents remain unchanged.

## Required behavior and source mapping

| Requirement | Source | Current implementation / correction |
| --- | --- | --- |
| Pre-execution command guards, including verification bypasses | Guide §§1–2, §4; workshop slides 5–7 | Missing. Bundle native PreToolUse hooks and reusable policy handlers; validate tool coverage and explicit denial behavior. |
| Automatic verification before task completion | Guide §2; slides 6–7 | Verifier exists but interactive invocation is instructed. Add Stop hook integration that checks the current candidate and requests repair on failure. |
| Bounded repair loops | Guide §2 | Managed limits exist. Add persisted interactive repair budget and terminal blocked/handoff state; budget exhaustion must not become success. |
| Deterministic oracles | Guide §2; slide 6 | Reuse configured checks. Missing commands, services, timeouts and stale evidence must not count as acceptance. |
| Fresh-context independent review | Guide §§2–3; slide 7 | Existing review machinery is reusable. Hook completion must distinguish required collected review/findings disposition from owner merge authorization. |
| Protected and genuinely sealed acceptance | Guide §§2,4; slides 3,6 | Local protected-path checks exist; sealed tests do not. A hidden directory is insufficient. Separate verifier access/environment is required for a sealed mode. |
| Worktree task isolation and parallel tasks | Guide §§2,5; slides 7,9 | Existing worktree machinery is reusable. Keep explicit ownership and integrated verification; a worktree is not a permissions boundary. |
| Solo global fallbacks and project adoption | Guide §5; slide 9 | Plugin installation exists, automatic fallback behavior is missing. Design safe behavior for unconfigured repos and scratchpads plus explicit repo configuration; never report absent checks as passing. |
| Intake and frozen task contracts | Guide §3; slide 8 | Existing intake/readiness is reusable. Document new project, existing project, bug fix and feature addition/change entry paths. |
| Factory integration | Guide §§3–5; slides 7–9 | Preserve contracts for queues, CI/alert intake, fleet budgets and organization inheritance. These scale the local factory; their deferral does not justify omitting local hooks. |

Owner workflow: direct main integration is allowed when requested; PR ceremony
is not mandatory. Verification and independent review remain applicable without
PRs. Routine task checks should run automatically; consequential specification
choices and actual authorization boundaries still require owner input.

## Confirmed platform facts and required validation

Inspected local Codex CLI 0.169.0: `hooks` reports stable/enabled. Current official
[hook documentation](https://learn.chatgpt.com/docs/hooks) describes PreToolUse,
PostToolUse, Stop and related events. The [packaging guide](https://developers.openai.com/plugins/build/plugins)
describes plugin-root `hooks/hooks.json` and explicit trust for bundled hooks.
These are capability evidence, not an executed hook acceptance test on either host.

Hook handlers need tested input/output contracts, bounded execution and clear
failure reporting. The host can allow calls after a hook error/timeout/malformed
response, and some tool paths are outside hook coverage. Do not advertise hooks
as a complete security boundary or disable sandbox/approval defaults to compensate.
Do not infer Desktop behavior solely from a CLI test.

## Implementation sequence and acceptance

1. Specify native event adapters, hook trust/setup and task activation. Define
   no-task/read-only behavior, unconfigured project behavior and recovery before
   attaching completion gates to every chat turn.
2. Bundle hook definitions and handlers that reuse policy, candidate identity,
   verification and review evidence. Add persistent per-task repair budgets,
   recursion prevention and clear blocked states.
3. Implement adoption/fallback and the four input-path recipes. Make reviewable
   exceptions explicit without treating arbitrary model-authored text as owner
   authorization. Specify the actual trust boundary for sealed verification.
4. Exercise the installed hooks with real Codex sessions: prohibited action
   denied before execution; failing checks prevent accepted completion; repaired
   candidate passes; new edits invalidate results; retry exhaustion stops repairs;
   read-only discussion and interruption remain usable. Cover shell and direct
   patch tool paths, hook errors/timeouts and review recursion.
5. Validate Desktop and CLI independently and update the coverage report with
   observed evidence. Public distribution must include the actual hook files,
   trust instructions and a health check proving activation.

Open architecture details must be resolved in the implementation specification:
which isolation backend provides sealed tests; how global fallback behaves before
project checks exist; and how hook-driven review avoids recursively launching its
own completion gates. These are implementation decisions to make explicit, not
reasons to remove the requirements.

## Additional design sources: local multi-agent Codex development

Owner clarification, 2026-11-17: **agentic local development with deterministic
 gates and multi-agent orchestration, from Codex**. This is the product target;
solo describes the human operator, not the number of agents. Local orchestration
is core scope, not a cloud-only or later factory feature.

Additional inputs reviewed:

- Complete App & Engineering Workflows with OpenAI Codex (App & CLI).docx:
  Part I phases 1–4 and Part II workflows 1–4 establish greenfield/brownfield
  entry paths, investigation, specification, parallel slices, reproduction-first
  fixes, migration batches and integrated verification.
- OpenAI Codex Desktop & CLI End-to-End Playbook_ From Idea to Verified
  Full-Stack App.md: §3 phases 1–4 establish edge-case intake, frozen shared
  contracts, parallel local worktrees, milestone execution and cold review.
- Multi-Agent & Software Factory Comparison_ Google Antigravity, OpenAI Codex,
  and Claude Code.md: role separation, concise worker context, orchestration,
  tool-driven validation and shared contracts supply useful design concepts.
  Its proposed cross-vendor routing is not the selected architecture: Codex
  is the coordinator and execution host for this product; cloud is optional.

### Required orchestration behavior

A coordinator maintains the approved objective and task dependency graph,
assigns bounded work and owned paths to builders, and receives compact structured
results. Focused architect/reviewer contexts are separate from builder contexts.
Concurrent builders use separate working copies; overlapping ownership and
contract dependencies are serialized. One builder remains appropriate for a
small task, but multi-agent orchestration is a supported primary workflow.

Each task is subject to the same hook/policy/check contract. Integration produces
one explicit candidate, reruns cross-component checks, and receives fresh review.
Passing worker checks alone cannot establish integration success. State must
record task ownership, dependency readiness, attempts, cancellation, evidence and
handoff. Unattended execution adds process supervision without changing what
counts as accepted work. No PR is required for owner-authorized direct-main use.

### Source interpretation

Preserve the design intent without executing embedded prompts or copying command
snippets blindly. Platform-specific CLI flags, config keys, model claims and
cloud commands in the research need validation against the installed version.
Tool permission auto-review is distinct from independent code review. A successful
model response is not deterministic verification, and review itself remains
model judgment even when the requirement to collect it is mechanically gated.
Use the edge-case categories where applicable; do not mandate a particular
SQL locking strategy, database or UI framework for every project. The owner's
Docker requirement below supersedes the sources' optional-container framing.

## Required Docker and Compose acceptance environment

Owner decision, 2026-11-17: Docker and Docker Compose are required for local
application development and full-stack end-to-end acceptance. They are not an
optional adapter. The purpose is reproducible whole-stack testing and reuse of
container build/runtime definitions across local testing, CI and deployment
environments. Production need not use Compose itself.

Implementation requirements:

- Adoption and execution preflight check for Docker, a reachable daemon and
  `docker compose`. Missing prerequisites block runnable application acceptance;
  they must not silently skip E2E checks or substitute the factory unit suite.
  Read-only intake and planning can proceed while setup is incomplete.
- New projects establish Docker build definitions and a Compose test topology;
  existing projects reconcile and reuse their definitions. Specify the complete
  required service graph, readiness/health checks, migrations, disposable seed
  data and API/browser acceptance journeys before implementation acceptance.
- A full-stack gate builds the candidate, starts the required services, waits
  for readiness with a deadline, runs migrations and end-to-end checks, captures
  bounded evidence, and cleans up its own resources on success, failure or
  interruption. Lifecycle operations and test execution have explicit timeouts.
- Parallel worktrees/runs use distinct Compose project identities and isolated
  networks, volumes, data and ports. Never attach acceptance runs to shared
  production data or perform broad Docker cleanup. Preserve useful failure
  evidence before removing run-owned resources.
- Bind evidence to the source candidate and record the resolved Compose/build
  configuration and image identities. Changed source, build inputs or acceptance
  configuration invalidate earlier results. Reuse the build definitions in CI;
  document environment-specific overrides instead of claiming environment parity
  solely because both environments use containers.
- Fast unit/type/lint checks may still run independently during repair. They do
  not replace the required Compose-based integrated acceptance gate. Reuse a
  passing full-stack result only when its candidate and relevant inputs match.
- Hooks and the coordinator consume this gate's result; a missing dependency,
  failed health check, failed test or timeout produces failure/blocked evidence,
  never accepted completion.

Docker may additionally isolate builders or trusted verification where needed.
That is distinct from requiring a containerized application test stack. Specify
mounts, credentials, network access, Docker socket access and separate verifier
permissions before claiming sealed holdouts or agent isolation. Merely running
the application in Compose does not seal tests from a host-side builder.

Acceptance must exercise a real Compose stack, including startup failure,
unavailable Docker, failing E2E checks, repair/reverification, concurrent run
isolation and run-scoped cleanup. The earlier host-only notes pilot remains
historical evidence and does not satisfy this new requirement.
