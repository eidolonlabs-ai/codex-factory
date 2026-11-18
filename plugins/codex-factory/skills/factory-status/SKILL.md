---
name: factory-status
description: Inspect Codex Factory active task, hook state, run history, and durable handoff packets (`hooks-status`, `status`, `runs`, `handoff`).
---

Resolve <PLUGIN_ROOT> from this installed skill path (two directories above).
Run commands with the target project as the working directory, or supply
`--repo "<PROJECT_ROOT>"`; source/task/config arguments resolve from the caller
working directory. Use absolute paths when working elsewhere. Never assume the
project contains this plugin’s npm scripts or edit the plugin installation.
Use installed skill names as exposed by the host, including namespaces.
If not adopted, use this plugin’s factory-setup skill first.
Read `../../references/plugin.md` for runtime requirements and role fallback.

# Inspect Factory Status (`factory-status`)

Query the current interactive hook state or durable managed run evidence without mutating code:

```sh
node "<PLUGIN_ROOT>/scripts/factory.mjs" hooks-status
node "<PLUGIN_ROOT>/scripts/factory.mjs" status RUN_ID
node "<PLUGIN_ROOT>/scripts/factory.mjs" runs
node "<PLUGIN_ROOT>/scripts/factory.mjs" handoff RUN_ID
```

Summarize truthfully for the owner:
- Active interactive task or managed run ID, base commit, and `allowed_paths`.
- Whether check/verification evidence matches the current candidate digest (stale or exhausted Stop-gate attempts are **unverified**, never complete).
- Remaining live/browser checks, review findings, and `docs/factory/development-state.md` next owner action.
