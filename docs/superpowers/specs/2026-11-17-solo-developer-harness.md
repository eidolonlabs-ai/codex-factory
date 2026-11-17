# Solo developer harness design

Status: approved by the owner with “go” on 2026-11-17; implemented locally.
See docs/solo-acceptance.md for observed acceptance and remaining host checks. Supersedes the earlier
Desktop-versus-CLI framing, not the completed plugin packaging work.

## Product goal

A solo developer installs one Codex plugin, adopts an existing or new Git
project, describes work, resolves material ambiguities, and gets a verified,
independently reviewed candidate with a clear next action. The developer can
work from Desktop or CLI without maintaining different task definitions,
verification rules, or review standards.

## Proposed defaults

- Desktop and CLI are interfaces to the workflow. Interactive and managed are
  execution modes. Interactive work is the default for exploration and small
  edits; a request to run an approved task unattended selects managed execution
  from either interface. Do not ask again within an already-authorized mode.
- Use one builder per task and serialize dependent tasks by default. Parallel
  worktrees remain available for explicitly independent tasks, not mandatory
  ceremony for a solo developer.
- Keep the existing controller as the managed execution engine. Desktop can
  launch it as a separate supervised process and monitor its recorded status.
  This does not supervise the parent Desktop chat. No daemon or App Server
  integration is required for the first solo release; verify host process
  lifetime before claiming a run survives closing the UI.
- Keep local Node.js 22+, Git, macOS/Linux/WSL support. No new hosted service,
  model pin, global settings change, account upload, or billing integration.
- Preserve current CLI attempt/deadline defaults: 3 attempts, 1200 seconds per
  agent invocation, 600 seconds per check, 5400 seconds per managed run.
- Human authorization controls merge, publication and deployment. Checks and
  reviewer output inform that decision; neither is an approval credential.

## Required behavior

1. **One workflow:** setup, clarify, approve task, implement, verify, review,
   repair if needed, and hand off. Both modes use the same acceptance contract
   and evidence format. Skills alone do not enforce process timeouts.
2. **Useful adoption:** inspect project conventions and existing checks, propose
   concrete configuration, preview changes and preserve existing files. Explain
   missing services or prerequisites. Do not infer meaningful acceptance from
   an arbitrary zero exit code, a skipped test suite, or a demo fixture.
3. **Explicit task readiness:** retain specification, stable base commit,
   allowed paths, material decisions, and a mapping from each acceptance
   criterion to automated checks or required manual/live evidence. Store this
   in a small project task record and companion card, not a project dashboard.
4. **Practical protection:** distinguish editable application/unit-test paths
   from trusted acceptance scripts, harness configuration and execution policy.
   Existing version-1 behavior must remain unchanged. Any new protection policy
   requires explicit adoption; never silently relax old protected paths. Freeze
   policy and checks before the builder starts and flag control changes.
5. **Complete review context:** reviewer receives the approved task, full diff
   including commits/dirty/untracked files, candidate identity, relevant check
   results, and missing evidence. Review collection must not imply no findings.
   Repairs invalidate prior evidence and require verification/review as needed.
   Preserve review prose and explicit owner disposition for this release; do
   not add automatic reviewer-driven repair or infer clean review from prose.
6. **Clear local handoff:** each task/run has readable status, evidence locations,
   blockers and next action. A new chat can recover context from project records
   and run artifacts without relying on the previous chat's memory.
7. **Safe recovery:** detect interrupted/incomplete runs, retain work and logs,
   and explain recovery. No automatic retry after a failed process, no automatic
   lock deletion, destructive cleanup, or blind reuse of stale verification.
   Starting a follow-up attempt requires a new recorded run and deliberate base.
8. **Proven installation and use:** establish actual plugin discovery in Desktop
   and CLI, a real local end-to-end pilot, and eventual GitHub installation from
   an authorized published revision. Record versions and remaining gaps.

## Boundaries

Local control-change detection is not sealed testing. Worktrees isolate working
copies, not host permissions. Tests, ignored inputs, mutable services and local
Git evidence have trust limits that must remain explicit. No promise of identical
model output across interfaces is made; parity means the same contracts and gates.

Defer durable fleet queues, distributed leases, organization policy inheritance,
ticket/webhook integrations, automatic PR/merge/deploy, DORA dashboards, remote
sealed acceptance infrastructure, and universal lifecycle-hook enforcement.
Keep versioned task/result boundaries so these can be added later.

## Decisions needed before dependent execution

The plan proposes the mode/defaults above; owner review can change them without
blocking preparation of the plan. Before the pilot, choose a disposable new
project or a specific existing project and its acceptance journey. Before host
installation or publication, use explicit authorization for those actions;
this planning request does not change global plugin settings or publish code.
Protection-policy schema and any removal from the legacy protection set require
focused human review before enabling them in an adopted project.
