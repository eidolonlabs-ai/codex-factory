---
name: factory-verify
description: Phase 4A deterministic verification gate (`factory verify`) and live UI/browser verification. Enforces `NOT_RUN !== PASS`.
---

Resolve <PLUGIN_ROOT> from this installed skill path (two directories above).
Run commands with the target project as the working directory, or supply
`--repo "<PROJECT_ROOT>"`; source/task/config arguments resolve from the caller
working directory. Use absolute paths when working elsewhere. Never assume the
project contains this plugin’s npm scripts or edit the plugin installation.
Use installed skill names as exposed by the host, including namespaces.
If not adopted, use this plugin’s factory-setup skill first.
Read `../../references/plugin.md` for runtime requirements and role fallback.

# Phase 4A: Verify Candidate (`factory-verify`)

Run `node "<PLUGIN_ROOT>/scripts/factory.mjs" verify` in the candidate checkout. For an approved task, pass `--task TASK --acceptance RECORD` so scope, acceptance mapping, and candidate-bound evidence are checked.

1. **`NOT_RUN` Is Never `PASS`**:
   Missing checks, empty check lists, or an unreachable Docker daemon fail acceptance. Read failed logs (under `/tmp/` or recorded run log dirs) and distinguish product defects from unavailable infrastructure.
2. **Real Stack & Live Browser Checks**:
   New application adoption requires v3 Docker Compose verification with real services and live browser/E2E checks (no mocked databases or skipped Playwright assertions). Inspect startup, service health, test execution, and cleanup evidence.
3. **Manual Observations**:
   If automated checks pass while manual criteria remain, status stays pending until the owner inspects the running app and records observations outside the working tree (`../../references/solo-workflow.md`) so the candidate digest stays unchanged.
4. **Report Truthfully**:
   Never invent evidence or weaken acceptance controls. Report exact commands, `PASS`/`FAIL`/`NOT_RUN` results, candidate identity, and any live/browser gaps. Proceed to `$factory-review`.
