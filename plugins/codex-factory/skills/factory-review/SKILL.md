---
name: factory-review
description: Phase 4B cold-context review of the verified candidate (`factory review` / `factory-reviewer` / `/review`), enforcing Reproduce Before Fixing before human merge decisions.
---

Resolve <PLUGIN_ROOT> from this installed skill path (two directories above).
Run commands with the target project as the working directory, or supply
`--repo "<PROJECT_ROOT>"`; source/task/config arguments resolve from the caller
working directory. Use absolute paths when working elsewhere. Never assume the
project contains this plugin’s npm scripts or edit the plugin installation.
Use installed skill names as exposed by the host, including namespaces.
If not adopted, use this plugin’s factory-setup skill first.
Read `../../references/plugin.md` for runtime requirements and role fallback.

# Phase 4B: Cold-Context Review (`factory-review`)

Use `node "<PLUGIN_ROOT>/scripts/factory.mjs" review --task TASK --acceptance RECORD` for a managed review of an interactive candidate (it runs fresh verification and saves a review packet), or delegate a fresh cold-context `factory-reviewer` (`reviewer`) / `/review` over the complete candidate diff (commits + dirty changes + untracked files; `--uncommitted` alone misses committed work).

1. **Audit Scope, Matrix & Evidence**:
   - Verify the review packet's task, acceptance mapping, check results, and candidate digest are fresh (stale or missing verification means unverified).
   - Inspect full changed files against acceptance criteria, error paths, missing tests, and the **4-Part State & Edge-Case Matrix** (concurrency row locks, idempotency, UTC/`as_of` boundaries, dual-write cleanup, UI `AbortController` + unique `data-testid`).
2. **Enforce "Reproduce Before Fixing"**:
   For any bug or edge-case defect found, require a standalone failing regression test confirming the failure before applying a minimal fix, then rerun `$factory-verify` and re-review the updated candidate.
3. **Separate Findings from Owner Disposition**:
   A collected review is not an approval or merge permission. Keep findings ordered by severity with `file:line` references, impact, and open risks. Only record an owner disposition when the owner explicitly decides (`../../references/solo-workflow.md`).
