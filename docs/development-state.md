# Development state

Phase: local implementation and approved installed CLI native-hook acceptance verified.
Release: 0.3.0 shipped on main in `fc0f871`, based on `c4bcd9f`.
Scope and acceptance: docs/remaining-implementation-task.md. Source reconciliation:
docs/factory-design-correction.md. Owner selected adopted-project-only guards and
required Docker/Compose full-stack acceptance. Direct main delivery is permitted
when requested; PR workflow is not required.

Implemented candidate: v3 Compose gate, native hook bundle and interactive task
activation, persistent repair budgets, dependency graph orchestration with separate
local worktrees and integrated verification/review, four onboarding entry paths.
Legacy v1/v2 remain compatible; new adoption uses v3.

Validation: 81 regression tests, typecheck/format/build/package checks, real
disposable Compose pass/fail/repair, real two-worker integration and independent
reviews passed. See docs/hooks-acceptance.md. Plugin 0.3.0 is installed. Native
SessionStart and tool denials passed after correcting manifest selection; native
Stop repair/review acceptance passed with no code/scope findings and owner
disposition pending. Desktop UI trust remains unverified.
Do not confuse host-only 0.2 acceptance with the new requirements.

Limits: hooks are host-dependent guards, not an OS security boundary. This local
mode protects acceptance controls but does not seal them from host-side builders.
No automatic main merge, global permission change or Docker-wide cleanup.
