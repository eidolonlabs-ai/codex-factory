---
name: factory-setup
description: Phase 0 workspace adoption for Codex Factory in a new or existing Git project without overwriting its configuration. Use after installing the plugin or when project checks are missing.
---
# Phase 0: Workspace Setup (`factory-setup`)

Inspect the selected project's instructions, stack, existing checks, and Git root. Read `docs/plugin.md` for runtime requirements, native hook trust, and role fallbacks.

1. **Preview and Apply Adoption Scaffold**:
   Run `node "<PLUGIN_ROOT>/scripts/setup.mjs" --repo "<PROJECT_ROOT>"` to preview missing scaffold files (or inspect `factory.json` in template checkouts). Apply with `--apply` only when authorized. Existing files are preserved; reconcile `docs/factory/AGENTS.snippet.md` explicitly with the project's `AGENTS.md`.
2. **Configure Real v3 Docker Compose Checks**:
   Configure real acceptance checks in `factory.json` using the project's existing stack and test commands. Empty checks intentionally fail—never replace them with placeholder commands, demo fixtures, or mocked databases. New application adoption requires Docker, a reachable daemon, Compose service healthchecks, and a real E2E test service (`docs/entry-paths.md`).
3. **Trust Native Hooks & Establish Context Hygiene**:
   - Review and trust the plugin's native hooks through the Codex UI (`docs/hooks.md`); installing the plugin does not trust them. Do not change global sandbox/approval defaults automatically.
   - Add context hygiene rules to `AGENTS.md`: redirect heavy build/test outputs to `/tmp/*.log` (`cmd > /tmp/run.log 2>&1 || tail -n 50 /tmp/run.log`).
4. **Doctor & Baseline Verification**:
   Run `npm run factory -- doctor --mode verify` and `npm run factory -- verify` to establish a baseline before Phase 1. CLI `doctor` checks Codex CLI auth for managed runs; Desktop skills and `verify` work interactively as well.
5. **Proceed to Phase 1**:
   Use `$factory-intake` (or `$factory-pipeline`) once configuration and baseline checks are ready.
