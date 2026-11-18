---
name: factory-verify
description: Phase 4A deterministic verification gate (`factory verify`) and live UI/browser verification. Enforces `NOT_RUN !== PASS`.
---
# Phase 4A: Verify Candidate (`factory-verify`)

Run `npm run factory -- verify` in the candidate checkout. For an approved task, pass `--task TASK --acceptance RECORD` so scope, acceptance mapping, and candidate-bound evidence are checked.

1. **`NOT_RUN` Is Never `PASS`**:
   Missing checks, empty check lists, or an unreachable Docker daemon fail acceptance. Read failed logs (under `/tmp/` or recorded run log dirs) and distinguish product defects from unavailable infrastructure.
2. **Real Stack & Live Browser Checks**:
   New application adoption requires v3 Docker Compose verification with real services and live browser/E2E checks (no mocked databases or skipped Playwright assertions). Inspect startup, service health, test execution, and cleanup evidence.
3. **Manual Observations**:
   If automated checks pass while manual criteria remain, status stays pending until the owner inspects the running app and records observations outside the working tree (`docs/solo-workflow.md`) so the candidate digest stays unchanged.
4. **Report Truthfully**:
   Never invent evidence or weaken acceptance controls. Report exact commands, `PASS`/`FAIL`/`NOT_RUN` results, candidate identity, and any live/browser gaps. Proceed to `$factory-review`.
