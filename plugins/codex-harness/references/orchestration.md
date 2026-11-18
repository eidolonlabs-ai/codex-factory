# Local task graph execution

`orchestrate PLAN --repo PROJECT` runs a dependency graph through local Codex
workers in separate Git worktrees. It requires a clean committed base and v3
Docker Compose configuration. It creates a retained integration worktree and
never updates main. Native analysis/review agents remain useful for focused
questions; managed builder processes provide worktree ownership and time limits.

The JSON plan has schema_version:1, task (the whole objective), acceptance (its
companion mapping), concurrency (1–4), and nodes (1–32). Each node has task,
acceptance and depends_on (an array of task IDs). Task and acceptance formats are
the same as single-task execution. All approved records initially reference the
same resolved base; worker paths must be subsets of the integration task scope.
Overlapping ownership requires a dependency. Missing dependencies, duplicates
and cycles fail before launching workers.

A wave runs up to the configured concurrency from the current integrated base.
Execution task base references and acceptance task hashes are mechanically
rebound to that predecessor snapshot; original records are retained. All wave
outcomes settle before integration or failure handoff. Each worker runs checks
and receives an independent review. Failed/blocked workers stop integration and
retain their work. Successful review snapshots are applied to the integration
worktree and committed there; these commits are internal candidates, not main
merges or owner approval. Conflicts stop with retained evidence.

After all waves, the complete candidate receives fresh Compose acceptance and
independent review, including worker review references. The owner must inspect
worker and final findings before accepting the result. Review collection alone
does not establish a clean review. Manual evidence on intermediate workers
blocks automated integration; prefer automated worker gates and final manual
observations. Aggregate run time and each worker's attempts are bounded.

Use runs, status and handoff with the orchestration run ID. Cancellation must
retain results; stale locks require inspection, never automatic removal. Starting
another orchestration does not resume or discard the first. Compose runs reject
fixed host ports, external volumes/networks, host bind mounts, privileged services
shared tags on built images, and custom volume/network driver options. Configure acceptance topology accordingly.
