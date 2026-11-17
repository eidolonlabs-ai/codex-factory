# Solo execution modes

Desktop and CLI use one task/acceptance workflow. Interactive sessions in either
interface follow skills; managed execution adds the external controller's
process deadlines, attempt budget, independent checks and separate review.

Use interactive work for exploration and small edits. An explicit unattended
request for an approved task selects managed execution, from either interface.
The controller starts another Codex process; it does not supervise its parent
chat. One builder per task and sequential dependencies are the solo defaults.
Use parallel worktrees only when ownership is disjoint and dependencies permit.

Before a managed run, inspect the task, preflight it, and configure real checks.
Launch the installed scripts/harness.mjs with Node (or npm run harness in this
template), using absolute source/task/config paths outside the project. Keep
monitoring the run's persisted ID and status. Interrupt the controller with
Ctrl-C to terminate its owned subprocess group and retain work/evidence.
Do not assume that closing Desktop or a terminal keeps the process alive.

Both modes require integrated verification and independent review before human
merge handoff. Evidence must match the current candidate. A zero-exit reviewer
process means collection succeeded, not that there are no findings.
