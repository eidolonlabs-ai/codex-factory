# Develop in Codex Desktop

Open the target repository, start a fresh chat, and invoke `$factory-pipeline` (or stage skills `$factory-setup`, `$factory-intake`, `$factory-plan`, `$factory-build`, `$factory-verify`, `$factory-review`, `$factory-status`). If you installed the plugin, start with [adoption](plugin.md) and [hook trust](hooks.md). The [entry paths](entry-paths.md) explain what to provide for each starting point and when the factory pushes back.

## Work in one checkout

Give `$factory-intake` the intended behavior, constraints, and source material. Expect `$factory-intake` (`factory-architect`) to push back if requirements or the 4-Part Edge-Case Matrix are underspecified. Resolve consequential questions, freeze contracts and Milestone 1.5 tests via `$factory-plan`, then activate the task in the checkout before editing (`$factory-build`). Trusted hooks guard covered edits and run Compose acceptance (`$factory-verify`) and independent review (`$factory-review`) when Codex finishes.

## Use separate Worktree chats

For parallel builders, prepare a [task card](templates/desktop-task.md) for each slice. Pin the base SHA and spell out ownership, upstream contracts, dependencies, and checks. In a new Desktop chat, choose **Worktree**, select the base branch, and provide its [builder prompt](builder-prompts.md). Verify the checkout SHA. Use a dedicated integration worktree to apply reviewed changes in dependency order, then verify (`$factory-verify`) and review (`$factory-review`) the combined candidate.

Native `factory-architect` and `factory-reviewer` subagents (`architect`, `reviewer`) are useful for focused analysis. Project role files live in `.codex/agents/`. If Codex does not discover a role, supply its instructions explicitly. Roles inherit parent permissions. Select read-only permissions when the review requires enforced read-only access.

Desktop can also launch a [managed run](execution-modes.md) as a separate process. The [Desktop observations](desktop-acceptance.md) document earlier native intake testing. The [0.3 acceptance report](hooks-acceptance.md) records CLI hook testing and the outstanding Desktop UI checks.
