# Suggested project guidance

Reconcile these instructions with the project's existing AGENTS.md; this file
does not activate them automatically.

- Use the installed Codex Harness coordinate-development skill for approved
  tasks. Clarify consequential requirements before implementation.
- Define acceptance criteria, allowed paths, dependencies, and the base commit.
- Run the plugin's `scripts/harness.mjs verify --repo <project>` with Node 22+.
  Resolve the plugin root from its installed skill path. Configure real checks
  in harness.json; empty checks deliberately fail.
- Delegate focused analysis/review to native subagents. Use separate Desktop
  Worktree chats for parallel builders and verify the integrated candidate.
- Preserve acceptance controls and report live/browser checks not exercised.
- Keep specifications, decisions, and development state in this repository.
- Skills are instructions. Only controller-managed CLI runs enforce their
  attempt/time limits. Worktrees do not isolate permissions; checks run as
  trusted host commands. Human authorization governs merge and deployment.
