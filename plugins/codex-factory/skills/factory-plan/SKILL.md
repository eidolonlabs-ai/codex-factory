---
name: factory-plan
description: Phase 2 pre-build freeze gate. Pushes back if intake blockers remain, locks `SPEC.md`, Compose healthchecks, and Milestone 1.5 Frozen Adversarial Tests, then validates task cards/JSONs (`allowed_paths`), `prepare` / `preflight`, and `activate`.
---

Resolve <PLUGIN_ROOT> from this installed skill path (two directories above).
Run commands with the target project as the working directory, or supply
`--repo "<PROJECT_ROOT>"`; source/task/config arguments resolve from the caller
working directory. Use absolute paths when working elsewhere. Never assume the
project contains this plugin’s npm scripts or edit the plugin installation.
Use installed skill names as exposed by the host, including namespaces.
If not adopted, use this plugin’s factory-setup skill first.
Read `../../references/plugin.md` for runtime requirements and role fallback.

# Phase 2: Contract Freeze & Task Planning (`factory-plan`)

Turn approved intake decisions into frozen contracts, adversarial tests, and verifiable tasks **before** launching builders.

> **Pre-Build Freeze Gate (Pushback Rule):** Refuse to run `preflight` or `activate` if any blocking intake decision or `unresolved_decisions` entry remains open, if `SPEC.md`/Compose healthchecks are undefined, or if **Milestone 1.5 Frozen Adversarial Tests** (or bug reproduction tests) have not been landed and observed failing first.

1. **Lock Shared Contracts & Compose Healthchecks**:
   - Write `SPEC.md`, API/schema contracts, and `docker-compose.yml` with realistic service `healthcheck` definitions and `condition: service_healthy`.
   - Keep `AGENTS.md` concise and scoped (no unrelated reformatting or unapproved dependency additions).
2. **Author Milestone 1.5 Frozen Adversarial Tests**:
   - Before writing business logic, author failing unit, integration, and E2E tests covering happy paths and all applicable **4-Part State & Edge-Case Matrix** cases (with explicit `data-testid` attributes on UI controls).
   - Confirm the tests fail as expected and commit them to the approved base commit inside protected acceptance paths.
3. **Create Scoped Task JSONs & Cards**:
   - Use `../../templates/desktop-task.md` alongside task JSON (`base_ref`, `allowed_paths`, `acceptance_criteria`).
   - For parallel builders, ensure disjoint `allowed_paths` and explicit `depends_on` ordering for any shared/dependent integration.
4. **Prepare, Preflight & Activate**:
   ```sh
   node "<PLUGIN_ROOT>/scripts/factory.mjs" prepare TASK --out RECORD
   node "<PLUGIN_ROOT>/scripts/factory.mjs" preflight TASK --acceptance RECORD
   node "<PLUGIN_ROOT>/scripts/factory.mjs" activate TASK --acceptance RECORD
   ```
   Review every proposed criterion mapping and clear `unresolved_decisions` explicitly with the owner before activating interactive work or launching unattended `run` / `orchestrate`. Proceed to `$factory-build`.
