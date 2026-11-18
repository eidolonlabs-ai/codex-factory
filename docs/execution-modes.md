# Interactive and managed execution

Desktop and CLI share the same approved task, acceptance mapping, and candidate evidence. Choose the mode per task.

- **Interactive** suits exploration and small changes. Activate an approved task in the current worktree. Trusted hooks check covered edits and run acceptance at Stop. Failed gates consume a persisted repair budget.
- **Managed** suits an unattended task. The factory starts a separate Codex CLI process, owns its deadlines, and keeps implementation and review in separate worktrees. Start it from Desktop or a terminal.
- **Task graph** suits approved tasks with disjoint ownership or explicit dependencies. The controller runs bounded waves and checks the final integrated candidate. [Orchestration](orchestration.md)

Use one builder for straightforward work. For handoff, inspect the current candidate, verification results, manual evidence, and review findings before recording an owner decision. [Task workflow](solo-workflow.md) · [CLI reference](https://github.com/eidolonlabs-ai/codex-factory/blob/main/docs/cli.md)
