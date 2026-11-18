# Start a development task (`codex-factory`)

Install and adopt the [plugin](plugin.md), or [set up the template](https://github.com/eidolonlabs-ai/codex-factory/blob/main/docs/adoption.md) in your project. Open the repo in Codex Desktop or CLI and invoke `$factory-pipeline` (or `$factory-setup` on an unadopted project).

> **Shift-Left Habit:** Unattended Codex runs (`run` / `orchestrate`) and parallel Desktop Worktree chats only succeed when ambiguities, contracts, Compose healthchecks, and adversarial tests are locked *before* implementation starts. If your prompt is underspecified, `$factory-intake` will push back (`needs_clarification`) rather than guessing.

## 1. Choose Your Entry Point (Minimum Inputs & Pushback Triggers)

| Starting point | Minimum inputs required | When the factory pushes back (`needs_clarification`) | First milestone |
| --- | --- | --- | --- |
| **1. New / Greenfield App** | Intended users, core journeys, stack constraints, data/API expectations, and any spec | Vague 1-liners, undefined schemas/endpoints, or unresolved **4-Part State & Edge-Case Matrix** domains | Resolve consequential questions via read-only `factory-architect` (`architect`) on the 4-Part Matrix, lock `SPEC.md`/contracts + Compose healthchecks, land **Milestone 1.5 Frozen Adversarial Tests**, and freeze via `$factory-plan`. |
| **2. Existing / Brownfield Repo** | Repo, concrete goal, conventions, run/test commands, and known failures | Missing v3 Compose checks, unstated compatibility bounds, or legacy unmigrated config | Preview adoption with `$factory-setup`, preserve existing config, establish baseline `doctor --mode verify` + `verify`, and migrate config to v3 for hook-driven acceptance. |
| **3. Bug Fix (Reproduce-First)** | Expected vs. actual behavior, steps to reproduce, environment, and relevant logs | Missing reproduction steps or request to patch immediately without a failing test | Capture a failing reproduction test first (**Reproduce Before Fixing**) before modifying app code, repair within scoped `allowed_paths`, and rerun the full gate. Review protected acceptance changes separately. |
| **4. Feature / Behavior Change** | Desired behavior, exemplar files (`@path`), compatibility constraints, and error handling | Unspecified interface/data changes or missing acceptance mapping | Agree on interface/data changes and acceptance (`prepare TASK`), freeze regression tests, and split into disjoint tasks when ownership and dependencies are clear. |
| **5. Large-Scale Refactor / Migration** | Source/target transformation rules, invariants, edge cases, and verification oracle | Missing baseline tests or overlapping edits across parallel worktrees | Lock baseline contract tests, partition module slices into a dependency-aware task plan, and run across parallel Desktop Worktree chats (`codex --worktree`) or managed `orchestrate PLAN` / `codex exec`. |

## 2. How to Choose Which Skill / Stage to Invoke

Start with **`$factory-pipeline`** whenever you want guided end-to-end orchestration. Invoke an individual `$factory-<stage>` skill directly only when upstream inputs are already complete:

| Skill | Invoke directly when… | What happens if prerequisites are missing (Pushback) |
| --- | --- | --- |
| **`$factory-pipeline`** | Default entry point for any full feature, greenfield build, bug fix, or refactor | Guides Phases 0–4 and refuses to start building while intake blockers or tests are missing |
| **`$factory-setup`** | Adopting a repo (`setup.mjs --apply`, v3 Compose checks, `doctor --mode verify`, hook trust) | Fails closed on empty check lists (`NOT_RUN !== PASS`) rather than allowing placeholder passes |
| **`$factory-intake`** | Evaluating a raw spec (`benchmarks/chronograph/input/original.md`) or scoping requirements in read-only mode | **Pushes back** (`needs_clarification`) with prioritized `factory-architect` questions covering the 4-Part Matrix |
| **`$factory-plan`** | All intake answers are recorded and you are ready to lock `SPEC.md`, Milestone 1.5 tests, and run `prepare` / `preflight` / `activate` | **Refuses preflight/activation** if `unresolved_decisions` remain, paths overlap protected inputs, or tests are unmapped |
| **`$factory-build`** | Approved task/plan and frozen tests are locked in this workspace, a Desktop Worktree chat, or `run`/`orchestrate` | **Stops and routes back** to `$factory-intake` / `$factory-plan` if non-trivial work lacks an approved spec, acceptance record, or reproduction test |
| **`$factory-verify`** | Running deterministic checks (`verify --task TASK --acceptance RECORD`), Compose E2E, and browser checks | Fails closed on `NOT_RUN`, scope drift, or unavailable Docker |
| **`$factory-review`** | Delegating cold-context `factory-reviewer` / `/review` over the complete candidate diff + evidence packet | Rejects stale/missing verification and enforces **Reproduce Before Fixing** for every bug |
| **`$factory-status`** | Inspecting `hooks-status`, `status`, `runs`, `handoff RUN_ID`, and `docs/development-state.md` | Reports drift, missing evidence, or exhausted budgets truthfully—never treats exhaustion as completion |

Run plugin commands with `node "<PLUGIN_ROOT>/scripts/factory.mjs"` or `node "<PLUGIN_ROOT>/scripts/factory.mjs"` in the template. Pass `--repo PATH` if invoking the runtime outside the target repo.
