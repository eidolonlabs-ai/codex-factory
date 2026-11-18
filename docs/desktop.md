# Develop in Codex Desktop

Open the target repository, start a fresh chat, and invoke the coordinator skill shown by Codex. If you installed the plugin, start with [adoption](plugin.md) and [hook trust](hooks.md). The [entry paths](entry-paths.md) explain what to provide for each kind of task.

## Work in one checkout

Give the coordinator the intended behavior, constraints, and source material. Resolve consequential questions, then review the task's acceptance criteria and allowed paths. Activate the task in the checkout before editing. Trusted hooks guard covered edits and run Compose acceptance and independent review when Codex finishes.

## Use separate Worktree chats

For parallel builders, prepare a [task card](templates/desktop-task.md) for each slice. Pin the base SHA and spell out ownership, upstream contracts, dependencies, and checks. In a new Desktop chat, choose **Worktree**, select the base branch, and provide its [builder prompt](builder-prompts.md). Verify the checkout SHA. Use a dedicated integration worktree to apply reviewed changes in dependency order, then verify and review the combined candidate.

Native architect and reviewer subagents are useful for focused analysis. Project role files live in `.codex/agents/`. If Codex does not discover a role, supply its instructions explicitly. Roles inherit parent permissions. Select read-only permissions when the review requires enforced read-only access.

Desktop can also launch a [managed run](execution-modes.md) as a separate process. The [Desktop observations](desktop-acceptance.md) document earlier native intake testing. The [0.3 acceptance report](hooks-acceptance.md) records CLI hook testing and the outstanding Desktop UI checks.
