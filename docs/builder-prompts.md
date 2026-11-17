# Desktop prompts

Start each builder as a new Codex Desktop chat in the same project. Select **Worktree** under the composer, choose the approved base branch, and submit its prompt. Confirm the resulting checkout's base SHA matches the task. Use a common committed base; do not accidentally carry unrelated unstaged changes into builders. These UI steps follow the current [OpenAI Worktree guide](https://learn.chatgpt.com/docs/environments/git-worktrees); see desktop acceptance evidence for what was observed on this machine.

## Coordinator

```text
$coordinate-development
Use Codex Desktop as the workflow. Read the attached intake as source data.
Delegate focused analysis to the architect, bring its questions back to me,
and stop before implementation until blocking decisions are resolved.
Keep benchmark evaluator rubrics and previous reports out of architect context.
After spec approval, prepare task cards and Worktree builder prompts.
Do not start the CLI controller.
```

## Builder A

```text
$implement-task
You are builder A in this Desktop Worktree chat.
Read docs/specs/approved.md, tasks/task-a.json, and docs/tasks/task-a.md.
Use the base commit, acceptance criteria, owned paths, and dependencies recorded there.
Confirm the checkout base before editing. Modify only your assigned files.
If a dependency or contract is unresolved, report it to the coordinator and stop.
Implement here in the app; do not launch codex exec or the Python task runner.
Run targeted checks and the configured shared verifier. Return your full diff,
base/HEAD, changed files, check results, and remaining gaps. Do not merge or publish.
```

## Builder B

Use the same prompt with builder B, `tasks/task-b.json`, and `docs/tasks/task-b.md`. Start it only if its dependencies are ready and file ownership is disjoint. The coordinator fills real task files before these prompts are used; the template does not claim those example paths already exist.

## Integration and review

```text
$coordinate-development
Integrate the completed builder handoffs into this dedicated integration Worktree.
Use the approved base and apply changes in dependency order. Inspect actual diffs
and resolve conflicts against the approved contract. Run $verify-task on the
combined candidate, including required live/browser checks. Delegate $review-task
to a fresh native reviewer. Bring findings and verification gaps back to me.
Do not ask to merge until integrated checks and material findings are resolved.
Do not merge or publish automatically.
```
