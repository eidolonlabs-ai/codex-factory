---
name: verify-task
description: Run the project's configured checks and report concrete verification evidence and remaining gaps.
---
Run `npm run harness -- verify` in the candidate checkout. For an approved task,
use `verify --task TASK --acceptance RECORD` so scope, acceptance mapping and
candidate-bound evidence are checked. Version 2 requires the companion record.
Missing checks are an adoption error, not a pass. Read failed logs and distinguish
product failures from unavailable services. Missing manual/live evidence remains
pending even if all automated checks passed. Persist observations outside the
working tree to avoid altering the candidate with its own digest; see
`docs/solo-workflow.md`. Never invent observed evidence or weaken acceptance.
Report exact commands, results, candidate identity and live/browser gaps.

New application adoption requires v3 Docker Compose verification with real services and browser E2E. Legacy checks are compatibility only. Inspect startup, health, test and cleanup evidence; unavailable Docker fails acceptance. See docs/entry-paths.md.
