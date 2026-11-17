---
name: verify-task
description: Run the project's configured checks and report concrete verification evidence and remaining gaps.
---
Run `python3 -m harness verify` in the candidate checkout. Missing checks are an adoption error, not a pass. Read failed check logs and distinguish product failures from missing infrastructure. Report exact commands and results, and any browser/live-provider checks not run. Do not alter acceptance criteria or verification commands merely to obtain green results.
