# Start a local Codex development task

Install Codex Harness, open the target Git repository in Desktop or CLI, and
start a fresh chat. Review and trust the plugin's hooks through the host's hook
UI (`/hooks` in the CLI). Installation alone does not activate hooks. Use the
namespaced setup-project and coordinate-development skills shown by your host.
Docker, a running daemon, Docker Compose and Node 22+ are required for application
acceptance. The application stack and package manager remain your choice.

## New project

Supply the idea, intended users, core journey, constraints and any existing
mockups or specification. For example:

> Use Codex Harness to build a new appointment app. First clarify the product,
> define acceptance criteria and propose the stack. Establish Docker/Compose
> services, health checks and browser E2E before implementing vertical slices.

The coordinator resolves consequential decisions, creates a Git project if
needed, previews adoption, and builds a reviewed scaffold with real checks.
Commit the scaffold/checks as a trusted starting point. Freeze interfaces and
split implementation into owned tasks; parallelize only independent slices.

## Existing project

Supply the repo path, desired outcome, current run/test commands and known
failures. For example:

> Adopt Codex Harness in this repository. Inspect its instructions, architecture,
> Compose setup and tests. Preserve existing configuration. Report baseline
> failures and propose the smallest reconciliation before taking a feature task.

Setup previews missing files and preserves existing ones. Reconcile nested
AGENTS instructions and Compose acceptance. Existing v1/v2 configurations are
legacy-compatible; migrate explicitly to v3 for the new hook/Compose workflow.
Missing services/checks block acceptance; baseline failures are not silently
waived. Do not reset dirty work to manufacture a clean start.

## Bug fix

Supply expected/actual behavior, reproduction steps, relevant logs, environment
and regression boundaries. Redact secrets. For example:

> Fix whitespace-only notes being saved. Reproduce it first in the Compose stack,
> add a regression in the authorized test paths, confirm failure, make the
> smallest implementation repair, and rerun the complete acceptance gate.

Investigate before changing code. Legitimate new acceptance tests and changes to
trusted controls need a reviewed preparation step; builders cannot weaken them.
Record the failing reproduction and passing repair. Re-review substantive fixes.

## Feature addition or behavior change

Supply the requested behavior, exemplar files, compatibility constraints and
what should stay unchanged. For example:

> Add retry scheduling to src/webhooks following src/billing conventions.
> Identify schema/API changes and migration needs before implementation. Preserve
> existing clients, and cover duplicate delivery, retry exhaustion and UI errors.

For a change, state the old and new behavior and data migration expectations.
For an addition, specify interactions with existing features. Freeze contracts
and assign dependencies before dispatching workers; verify the integrated app.
Refactors/migrations use the same route with explicit invariants and batches.

## Shared execution

Use the installed plugin runtime (shown here as H) or `node "<PLUGIN_ROOT>/scripts/harness.mjs"` in
this template. H means `node "<PLUGIN_ROOT>/scripts/harness.mjs"`; replace the
placeholder with the actual installed root from the skill metadata.

1. Configure v3 harness.json, Dockerfile(s), Compose and the E2E service. Run
   `H doctor --mode verify` and establish a committed baseline.
2. Save an approved task JSON with acceptance criteria and allowed paths.
   `H prepare TASK` emits a draft mapping; inspect/resolve it, map stack criteria
   to `compose:e2e`, and save it outside the working tree. Then run
   `H preflight TASK --acceptance RECORD`.
3. Interactive: `H activate TASK --acceptance RECORD`. Trusted native hooks guard
   covered tool calls and run the full verification/review gate at Stop.
   Managed single task: `H run TASK --acceptance RECORD`. Multiple tasks:
   `H orchestrate PLAN`; see orchestration.md.
4. Inspect `H hooks-status` or `H handoff RUN_ID`, checks and review prose.
   Required manual evidence must match the candidate. Review collection is not
   approval. The owner may record a disposition with the existing command.
5. `H deactivate` archives the interactive task after inspection or cancellation.
   It does not certify completion. Reactivation is an explicit retry/setup action.
   Merge/push directly to main when the owner authorizes it; no PR is required.

No-task read-only discussion does not trigger the completion gate. Hooks only
apply in adopted projects. Do not claim activation merely because files exist:
check host trust and the events.jsonl record under the Git common directory's
harness/hooks folder. Files there are local evidence, not tamper-proof authority.
