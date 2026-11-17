---
name: implement-task
description: Use when implementing an approved task in a Codex Desktop workspace or an explicitly requested unattended CLI run.
---
# Implement an approved task

**Interactive work is the default in Desktop and CLI.** Read the approved spec and task card/JSON. Confirm base commit, acceptance criteria, file ownership, dependencies and required checks. Implement directly in this chat's workspace. When the owner requests an approved task run unattended, use the controller from either interface; otherwise implement here. Do not treat an interactive CLI session as controller-managed.

Parallel builders run in separate Desktop Worktree chats, not shared-workspace subagents. Use native subagents only for focused read-only analysis. Stay within owned files. If a dependency is missing, a shared contract must change, or an owner decision is unresolved, report the blocker to the coordinator rather than guessing or editing another builder's files.

Run the task's targeted checks and invoke $verify-task. Do not weaken acceptance tests, CI, or verifier commands to pass. In interactive work, legitimate tests can be added within explicitly assigned ownership; flag acceptance/control changes for separate review. After 3 unsuccessful repair cycles, stop and return the failure evidence for a scope/dependency decision. This is a workflow rule, not an app-enforced timeout.

Return the task ID, base/HEAD, complete changed-file list, diff or commit, checks with results, and gaps. Do not merge or publish. The coordinator integrates builders and verifies the combined candidate before review.

Only for explicitly selected unattended execution: use `npm run harness -- doctor`, then `npm run harness -- run tasks/TASK.json`. The CLI enforces its own budgets and protected paths; it may stop for protected test/control edits even where a Desktop task allows them.

For bugs and review findings, reproduce first and add a regression within authorized paths where practical; use docs/design-checklist.md.
