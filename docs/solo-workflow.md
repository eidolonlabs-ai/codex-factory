# Solo task workflow

Prepare the approved task and acceptance record, then choose an [execution mode](execution-modes.md).

## Adopt and prepare

Use the [entry paths](entry-paths.md) to establish the project baseline. Task and acceptance records use schema version 1, including when `harness.json` uses v3.

```json
{
  "schema_version": 1,
  "id": "normalize-titles",
  "title": "Trim note titles",
  "specification": "Trim string titles before saving and reject whitespace-only titles.",
  "base_ref": "<approved commit SHA>",
  "allowed_paths": ["src/title.mjs"],
  "acceptance_criteria": ["The browser saves trimmed titles and rejects whitespace-only input."]
}
```

Save task inputs and evidence outside the worktree, or commit the task before a managed run. Draft the matching acceptance record outside the worktree.

```sh
node "<PLUGIN_ROOT>/scripts/harness.mjs" prepare /absolute/task.json --repo /absolute/project > /absolute/task.acceptance.json
# Review and edit the draft before preflight.
node "<PLUGIN_ROOT>/scripts/harness.mjs" preflight /absolute/task.json --acceptance /absolute/task.acceptance.json --repo /absolute/project
```

The draft includes the task digest, resolved base, proposed checks, and an unresolved-decision reminder. Confirm which checks prove each criterion (use `compose:e2e` for stack tests), add any manual requirements, and remove the reminder once all decisions are resolved. Map each criterion once. Regenerate the mapping if the task or base changes. Preflight validates these inputs without starting an agent or live service.

## Execute and inspect

For interactive work, run `activate TASK --acceptance RECORD` in the checkout.
The trusted [Stop hook](hooks.md) runs verification and review. Use task-aware
`verify` and `review` for explicit checks and follow-up evidence. For unattended
work, run `run TASK --acceptance RECORD`.

`runs` lists up to 50 records per category. `status RUN_ID` preserves raw JSON;
`handoff RUN_ID` reports freshness, blockers and retained artifact locations.
Evidence is in the Git common directory's harness folders. A persisted running
record does not prove the process is live. Ctrl-C cancels the supervised process
and retains work. After a hard crash, inspect the process and worktree before
any manual lock removal. A new run gets its own record. Worktrees and evidence remain available for inspection.

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
