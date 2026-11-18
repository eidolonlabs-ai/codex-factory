# Start a development task

Install and adopt the [plugin](plugin.md), or [set up the template](https://github.com/eidolonlabs-ai/codex-factory/blob/main/docs/adoption.md) in your project. Open the repo in Codex Desktop or CLI and invoke the coordinator skill. For a new app, you can clarify the scope before creating the repository or configuring Docker.

| Starting point | Give Codex | First milestone |
| --- | --- | --- |
| New project | Intended users, core journey, constraints, and any designs or spec | Resolve consequential questions. Agree on a stack and acceptance criteria, then commit a scaffold with real Compose checks. |
| Existing project | Repo, goal, conventions, run/test commands, and known failures | Preview adoption, preserve existing config, and establish the baseline. Migrate legacy config explicitly to v3 for hook-driven acceptance. |
| Bug fix | Expected vs. actual behavior, steps to reproduce, environment, and relevant logs | Capture a failing reproduction, repair the scoped code, and rerun the gate. Review changes to protected acceptance inputs separately. |
| Feature or behavior change | Desired behavior, example code, compatibility constraints, and behavior to preserve | Agree on interface or data changes, migration expectations, and acceptance. Split into tasks when ownership and dependencies are clear. |

For example, ask Codex to reproduce whitespace-only note saves in the Compose stack, confirm the regression, and fix the title normalization without changing the protected E2E checks.

## From approval to handoff

1. Establish v3 configuration with a real Compose stack and an E2E test service. Run `doctor --mode verify` and `verify` to check the baseline.
2. Save a task JSON with a base, criteria, and allowed paths. Run `prepare TASK`, review the proposed acceptance mapping, and run `preflight TASK --acceptance RECORD`. [Task and evidence formats](solo-workflow.md)
3. For interactive work, trust the [hooks](hooks.md) and run `activate TASK --acceptance RECORD`. For unattended work, use `run TASK --acceptance RECORD` or [`orchestrate PLAN`](orchestration.md).
4. Inspect `hooks-status` or `handoff RUN_ID`, plus the check and review evidence. Run `deactivate` to archive an interactive task. The owner decides whether to ship the reviewed candidate.

Run these commands with `node "<PLUGIN_ROOT>/scripts/factory.mjs"` or `npm run factory --` in the template. Pass `--repo PATH` if invoking the runtime outside the target repo.
