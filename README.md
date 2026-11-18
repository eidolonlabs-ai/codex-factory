# Codex Factory

[![Factory verification](https://github.com/eidolonlabs-ai/codex-factory/actions/workflows/verify.yml/badge.svg)](https://github.com/eidolonlabs-ai/codex-factory/actions/workflows/verify.yml)

A local development factory for solo developers and small teams using Codex Desktop or CLI. Define and freeze contracts, acceptance tests, and scoped paths upfront, execute safely in isolated worktrees, then verify with Docker Compose and collect an independent review before deciding what to ship.

## Why Prompts & Skills Alone Fail vs. This Software Factory

Prompts and `SKILL.md` guides alone are **probabilistic**—without mechanical guardrails, agents claim completion prematurely, pollute their context with verbose build output, weaken tests to turn red builds green, or stall waiting for approvals. **Codex Factory** adds **deterministic runtime physics** around Codex Desktop & CLI:

| Layer | Nature | What It Provides Here |
| --- | --- | --- |
| **1. Prompt Engineering** | Probabilistic (Single Turn) | 8 unified skills (`$factory-pipeline` through `$factory-status`) & 3 core roles (`factory-architect`, `factory-builder`, `factory-reviewer`) |
| **2. Context Engineering** | Probabilistic (Session State) | Hierarchical `AGENTS.md`, `/tmp/*.log` hygiene, task cards, and `docs/development-state.md` |
| **3. Factory / Harness Engineering** | Deterministic (Runtime Physics) | Native `SessionStart`/`PreToolUse`/`Stop` hooks, v3 Docker Compose acceptance gates (`NOT_RUN !== PASS`), candidate SHA-256 digests, isolated Desktop/`orchestrate` worktrees, attempt budgets, and fresh-context review packets |

| Unattended Failure Mode | Why Prompts/Skills Alone Fail | How Codex Factory Solves It Deterministically |
| --- | --- | --- |
| **Premature "Done" Claims** | Agent reports "tests pass" without running full stack checks | `Stop` hook & `factory verify` run v3 Docker Compose + E2E checks against the exact candidate (`NOT_RUN !== PASS`) |
| **Context Window Rot** | Verbose test/build streams push out spec requirements | `/tmp/*.log` tailing, dedicated Desktop Worktree chats (`codex --worktree`), and fresh-context `factory-reviewer` |
| **Test-Cheating / Weakened Assertions** | Agents edit acceptance tests or `factory.json` under failure | **Milestone 1.5 Frozen Adversarial Tests** committed to base + `PreToolUse` / `protected_paths` policy enforcement |
| **HIL Permission Fatigue** | Repeated approval popups stall long-horizon runs | Ephemeral worktree isolation + pre-trusted project hooks keep edits scoped and verifiable without blind `--yolo` |

## Shift-Left Engineering: Built-In Spec Pushback

Reliable unattended runs (`run` / `orchestrate`) and parallel Desktop Worktree chats depend on shifting clarity **left**:

- **Pushback on Insufficient Requirements (`$factory-intake`)**: When given a vague or contradictory request, `$factory-intake` (`factory-architect` in read-only mode) **pushes back** (`needs_clarification`), surfacing prioritized blocking questions across the **4-Part State & Edge-Case Matrix** (out-of-order/duplicates, concurrency/row locks & `AbortController`, UTC/`as_of` clock bounds, dual-write atomicity) instead of silently filling gaps.
- **Pre-Build Freeze Gate (`$factory-plan` → `$factory-build`)**: `$factory-plan` refuses `preflight`/`activate` until unresolved decisions are cleared, `SPEC.md`/Compose healthchecks are locked, and failing **Milestone 1.5 Frozen Adversarial Tests** (or bug reproduction tests) sit on the base commit. `$factory-build` stops and routes back to `$factory-intake`/`$factory-plan` if non-trivial tasks bypass planning.

## How to Choose Your Entry Point & Stage

Start with **`$factory-pipeline`** for guided Phases 0–4 orchestration. Jump directly to an individual skill only when its prerequisites are ready (see [Task entry points](docs/entry-paths.md)):

| Entry Point | Minimum Inputs | When `$factory-intake` Pushes Back |
| --- | --- | --- |
| **1. New / Greenfield App** | Users, core journeys, stack constraints, data/API expectations | Undefined schemas/endpoints or unresolved 4-Part Matrix edge cases |
| **2. Existing / Brownfield Repo** | Repo path, concrete goal, conventions, test commands, baseline failures | Missing v3 Compose checks or unstated compatibility bounds |
| **3. Bug Fix (Reproduce-First)** | Expected vs. actual behavior, repro steps, environment/logs | Missing reproduction steps or request to patch without a failing test |
| **4. Feature / Behavior Change** | Desired behavior, exemplar files (`@path`), compatibility constraints | Unspecified schema/interface deltas or unmapped acceptance criteria |
| **5. Refactor / Migration** | Source/target patterns, invariants, verification oracle | Missing baseline tests or overlapping multi-worktree edits |

| Phase | Skill | When to Invoke Directly |
| --- | --- | --- |
| **All (E2E)** | `$factory-pipeline` | Default entry point guiding Phases 0–4 with built-in intake and freeze pushback |
| **Phase 0** | `$factory-setup` | Adopting a repo (`setup.mjs --apply`, v3 Compose checks, `doctor --mode verify`, hook trust) |
| **Phase 1** | `$factory-intake` | Auditing a raw spec (`benchmarks/chronograph/input/original.md`) or surfacing blocking questions in read-only mode |
| **Phase 2** | `$factory-plan` | Intake is resolved; ready to lock `SPEC.md`, Milestone 1.5 tests, task JSONs, `prepare`/`preflight`/`activate` |
| **Phase 3** | `$factory-build` | Task/plan is approved; run interactive workspace, `codex --worktree` chats, or `run`/`orchestrate` |
| **Phase 4A** | `$factory-verify` | Running `verify --task TASK --acceptance RECORD`, Compose E2E, and live browser checks |
| **Phase 4B** | `$factory-review` | Delegating cold-context `factory-reviewer` / `/review` (**Reproduce Before Fixing**) |
| **Inspect** | `$factory-status` | Checking `hooks-status`, `status`, `runs`, `handoff RUN_ID`, and `docs/development-state.md` |

## Get started

- **Add the plugin to Codex.** Install from the GitHub marketplace and review the bundled hooks. [Install, update, and adopt](docs/plugin.md)
- **Use the repository template.** Clone [Codex Factory](https://github.com/eidolonlabs-ai/codex-factory) or copy it into a new repository and configure your application checks. [Template setup](docs/adoption.md)
- **Start work.** Pick the path for a new project, existing repo, bug fix, feature, or refactor/migration via `$factory-pipeline` (or stage skills `$factory-setup`, `$factory-intake`, `$factory-plan`, `$factory-build`, `$factory-verify`, `$factory-review`, `$factory-status`). [Task entry points](docs/entry-paths.md) · [Family contract](CONTRACT.md)

Application acceptance uses Node.js 22+, Git, and a running Docker engine with Docker Compose. The factory runs on macOS and Linux, including WSL. See the tested configurations and limits in [Compatibility](docs/compatibility.md).

## Choose how to run the task

| Mode | When to use it | Guide |
| --- | --- | --- |
| Interactive | Work with Codex in Desktop or CLI. Activate the task so trusted hooks guard covered edits and run the completion gate. | [Desktop](docs/desktop.md) · [Hooks](docs/hooks.md) |
| Managed task | Run an approved task unattended with bounded attempts, a separate worktree, and a review snapshot. | [CLI](docs/cli.md) |
| Managed task graph | Run independent tasks in parallel, integrate changes in dependency order, and verify the combined candidate. | [Orchestration](docs/orchestration.md) |

All three modes use the same task and acceptance formats. The owner decides whether to commit and push directly or use a PR. [Task evidence and handoff](docs/solo-workflow.md)

## Verify this repository

```sh
npm ci
npm run typecheck
npm test
npm run verify:demo
npm run plugin:check
```

The demo (`examples/demo`, `examples/solo-pilot`, `examples/compose-pilot`) exercises fast smoke fixtures. The official cross-factory benchmark is [ChronoGraph](benchmarks/chronograph/README.md) (intake + end-to-end build).

[Documentation index](docs/README.md) · [0.3 acceptance evidence](docs/hooks-acceptance.md) · [Trust boundaries](docs/security.md) · [MIT license](LICENSE)

Codex Factory is an independent community project.
