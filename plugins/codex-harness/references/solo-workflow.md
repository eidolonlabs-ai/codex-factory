# Solo task workflow

Desktop and CLI share interactive and managed modes. Use one sequential builder
unless independent parallel tasks justify more worktrees. The CLI examples below
use the installed plugin's scripts/harness.mjs with Node; the template equivalent
is `node "<PLUGIN_ROOT>/scripts/harness.mjs"`.

## Adopt and prepare

Run setup.mjs with --repo to inspect a preview. Suggestions are drawn from
existing package scripts, not executed or installed as checks automatically.
Review the commands and any service/data requirements before configuring them.
The runtime never treats an empty check list as success. `doctor --mode verify`
checks verification prerequisites without requiring Codex or a clean checkout;
`doctor --mode managed` also checks CLI capabilities and clean starting state.
Authentication is not claimed until a real run succeeds.

Version 1 protection behavior is unchanged. Opt into version 2 only after
reviewing docs/solo-policy.md and the project's trusted acceptance dependencies.
For example:

```json
{"schema_version":2,"checks":[{"name":"acceptance","argv":["node","acceptance/check.mjs"]}],"policy":{"editable_paths":["src","tests/unit"],"protected_paths":["acceptance"]}}
```

Keep the task JSON small and compatible with version 1. Add a companion record:

```json
{"schema_version":1,"task_sha256":"<SHA256 of JSON.stringify(parsed task)>","base":"<resolved Git base commit>","unresolved_decisions":[],"criteria":[{"id":"save","criterion":"Exact text from task acceptance_criteria","checks":["acceptance"],"manual":[]}],"manual_evidence":[]}
```

Use the exported `taskDigest` helper from harness/readiness.ts when developing
against this repository. The `prepare TASK` command emits a draft acceptance
record with the correct task/base identities and proposed mappings; inspect it
before saving it and adding required manual/live checks. It never approves a task.
Task changes invalidate the digest. Each criterion must be mapped exactly once;
check names must exist. Preflight does not launch an agent or test a live service.

```sh
node "<PLUGIN_ROOT>/scripts/harness.mjs" prepare /absolute/task.json --repo /absolute/project
node "<PLUGIN_ROOT>/scripts/harness.mjs" preflight /absolute/task.json --acceptance /absolute/task.acceptance.json --repo /absolute/project
```

## Execute and inspect

Interactive: implement the approved task in the selected checkout, then use
`verify --task TASK --acceptance RECORD` and `review --task TASK --acceptance RECORD`.
Review always runs fresh verification and gives the reviewer the task, criteria,
check outcomes and full snapshot diff. Managed: use `run TASK --acceptance RECORD`
from either interface. A managed run launches a separate process; its lifetime
is not guaranteed after its parent terminal/app closes. An explicit unattended
request authorizes the chosen managed run; do not repeatedly ask to continue it.

`runs` lists up to 50 records per category. `status RUN_ID` preserves raw JSON;
`handoff RUN_ID` reports freshness, blockers and retained artifact locations.
Evidence is in the Git common directory's harness folders. A persisted running
record does not prove the process is live. Ctrl-C cancels the supervised process
and retains work. After a hard crash, inspect the process and worktree before
any manual lock removal. No automatic cleanup, resume or lock deletion occurs.

## Manual evidence and owner disposition

A check pass is distinct from full acceptance. Required manual/browser evidence
must identify a criterion, requirement, observed candidate digest and note.
To avoid changing the candidate by recording its own digest, store the evidence
copy of the acceptance record **outside the working tree**, for example in the
Git common directory under harness/manual-evidence. Keep the approved criterion
mapping unchanged. Rerun verification/review using that copy via --acceptance.
Manual evidence is an operator assertion, not a signed attestation.

Review prose is retained; no automatic parsing turns it into approval. The owner
may provide a JSON disposition with `candidate`, `decision` (pending,
changes_requested or accepted), and `note`, then explicitly invoke
`disposition RUN_ID --file PATH`. Acceptance is refused for missing evidence or
changed candidates. Store disposition input outside the working tree as well.
It records a decision only; it never merges, publishes or deploys.

After repairs, rerun verification/review. For a new managed attempt, inspect and
preserve the prior diff, choose a deliberate base and task, and create a new run.
Do not reset a dirty checkout or discard work simply to pass preflight.
