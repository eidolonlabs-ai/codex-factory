---
name: factory-status
description: Inspect Codex Factory active task, hook state, run history, and durable handoff packets (`hooks-status`, `status`, `runs`, `handoff`).
---
# Inspect Factory Status (`factory-status`)

Query the current interactive hook state or durable managed run evidence without mutating code:

```sh
npm run factory -- hooks-status
npm run factory -- status RUN_ID
npm run factory -- runs
npm run factory -- handoff RUN_ID
```

Summarize truthfully for the owner:
- Active interactive task or managed run ID, base commit, and `allowed_paths`.
- Whether check/verification evidence matches the current candidate digest (stale or exhausted Stop-gate attempts are **unverified**, never complete).
- Remaining live/browser checks, review findings, and `docs/development-state.md` next owner action.
