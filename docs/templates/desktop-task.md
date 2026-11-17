# Desktop task card

- Task ID:
- Shared task JSON: `tasks/<id>.json` (schema_version, id, title, specification, acceptance_criteria, allowed_paths, base_ref)
- Approved specification and approval evidence:
- Base branch and exact commit:
- Owner / builder chat / worktree:
- Owned file/directory prefixes (same as allowed_paths):
- Read-only dependencies and pinned upstream contract revision:
- Depends on task IDs (empty if independent):
- Acceptance criteria (same as task JSON):
- Targeted checks:
- Shared integrated verification: `python3 -m harness verify`
- Required live/browser checks:
- Stop conditions: unresolved requirements, missing dependency, ownership conflict, 3 unsuccessful repair cycles.
- Handoff: base/HEAD, full diff incl. untracked files, changed files, commands/results, unresolved issues.

Desktop metadata stays here; do not add extra fields to the CLI's strict task JSON.
