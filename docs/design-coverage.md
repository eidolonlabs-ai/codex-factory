# Design coverage

Codex Harness 0.3 implements the local development loop for a solo developer or small team. The supplied playbooks, engineering guide, and workshop informed the workflow. The [design correction](harness-design-correction.md) records the owner decisions that made hooks, local orchestration, and Docker Compose acceptance core requirements.

| Design goal | What 0.3 provides |
| --- | --- |
| Clarify the problem and freeze a task contract | Architect intake, owner decisions, a pinned base, explicit scope, and a criterion-to-check mapping. [Entry paths](entry-paths.md) |
| Protect verification and catch failures before handoff | Trusted native hooks in adopted projects, configured scope checks, Compose health and E2E gates, and a persisted repair budget. [Hooks](hooks.md) |
| Keep checks independent of the builder | Verification runs configured commands on the candidate and gives a snapshot and evidence to a separate reviewer. The owner inspects findings and makes the release decision. [Task workflow](solo-workflow.md) |
| Handle parallel work without shared edits | Desktop Worktree chats or a managed task graph with explicit dependencies, local concurrency limits, and verification of the integrated candidate. [Orchestration](orchestration.md) |
| Adopt the workflow in existing projects | Git/local plugin installation and preview-first scaffolding that preserves existing files. Application-specific tests and migration decisions remain project work. [Plugin setup](plugin.md) |
| Retain evidence for handoff | Candidate fingerprints, logs, reviews, and owner disposition in the local Git common directory. [CLI](cli.md) |

The [0.3 acceptance report](hooks-acceptance.md) records tested behavior, including native CLI dispatch, failed and repaired browser checks, and a real two-worker integration. Desktop UI trust and discovery remain open checks.

The local controls operate with host permissions. Sealed acceptance requires a separate verifier boundary. A distributed factory would also need queues, leases, budgets across workers, and shared policy. [Trust boundaries](security.md) · [Scaling](scaling.md)
