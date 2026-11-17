# Scaling to multiple Codex workers

The current product targets one developer with one sequential builder. Small
teams can share task contracts and CI while keeping explicit ownership and
integration review. Factory capabilities below are future architecture, not
requirements for adopting the plugin.

V1 runs one task per controller invocation and supports distinct concurrent task IDs with separate worktrees. It is not a scheduler and has no shared execution budget across workers.

A future scheduler can accept versioned task JSON, call the same runner, and ingest versioned result JSON. Add lease ownership, heartbeat expiry, idempotent dispatch, resource limits, and aggregate spend/concurrency limits before unattended multi-worker use. Local task locks are not distributed leases.

Next separate builders and verifiers into independent containers or machines. Keep trusted acceptance inputs and signing keys outside builder access. Store candidate artifacts by immutable content digest and rerun checks after merges, because individually passing branches can conflict.

Add PR creation and CI reporting only after the result contract is stable. Human merge decisions remain the initial default. Add service dashboards, organization policy distribution, or cloud task routing only when operating multiple workers makes their cost worthwhile.
