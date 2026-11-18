# From one developer to a shared workflow

Use one builder for a small change. Use the [local task graph](orchestration.md) when multiple tasks have clear ownership and dependencies. One controller bounds concurrency within its plan, integrates the worker snapshots, and verifies the combined candidate.

Small teams can share pinned plugin versions, task contracts, application CI, and review practices. Assign ownership of shared interfaces and trusted acceptance inputs before scheduling parallel work.

A distributed factory would add a durable queue, leases, idempotent dispatch, and budgets across controllers. Local locks coordinate work on one machine. Separate builder and verifier environments can protect acceptance inputs and publish evidence for immutable candidates. PR automation, deployment, telemetry, and organization policy would be separate integrations.
