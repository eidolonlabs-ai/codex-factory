# Harness CLI

From the template, run `npm ci` and prefix each command with `npm run harness --`. From a plugin installation, use `node "<PLUGIN_ROOT>/scripts/harness.mjs"`. Run from the target repository or pass `--repo PATH`. Task, plan, config, and source paths resolve from the caller's working directory.

| Command | Purpose |
| --- | --- |
| `doctor --mode verify` or `doctor --mode managed` | Check local prerequisites. Managed mode also checks CLI capabilities and the clean starting state. |
| `intake SOURCE` or `benchmark` | Collect intake questions from a source file or the bundled ChronoGraph fixture in the template repository. |
| `prepare TASK` · `preflight TASK --acceptance RECORD` | Draft the criterion mapping, then validate the reviewed task and acceptance record. |
| `activate TASK --acceptance RECORD` · `hooks-status` · `deactivate` | Start, inspect, or archive an interactive task in the current worktree. |
| `run TASK --acceptance RECORD` · `orchestrate PLAN` | Run one task or a dependency graph under the controller. |
| `verify [--task TASK --acceptance RECORD]` | Check the current candidate, including uncommitted changes. |
| `review --task TASK --acceptance RECORD` | Run fresh verification and collect a separate review. |
| `runs` · `status RUN_ID` · `handoff RUN_ID` | List retained runs, read raw results, or inspect candidate freshness and evidence. |
| `disposition RUN_ID --file PATH` | Record the owner's decision for the current reviewed candidate. |

Use `--help` for supported options. Exit code 0 indicates the command achieved its result, such as collecting intake questions or preparing a candidate for review. Code 1 indicates unsuccessful checks or execution. Code 2 indicates invalid input or setup. Code 130 indicates interruption.

Task IDs use 1–48 lowercase letters, digits, or hyphens. Scope entries are normalized repository-relative paths. A prefix such as `src` includes `src/api.py` and excludes `src-other`. Check commands use argv without shell expansion. Put pipelines and command sequences in a reviewed script.

## Failures and recovery

Inspect `handoff RUN_ID` and the logs in the Git common directory under `harness/`. Managed runs can retry ordinary check failures within the attempt budget. Ctrl-C interrupts the controller and preserves its evidence. After a hard crash, inspect the worktree and process before recovering a stale lock. To retry, start a new run using an approved base and retain the prior diff and evidence.

[Task workflow](solo-workflow.md) · [Hook behavior](hooks.md) · [Compatibility](compatibility.md)
