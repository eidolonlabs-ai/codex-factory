---
name: verify-task
description: Run the project's configured checks and report concrete verification evidence and remaining gaps.
---

Resolve <PLUGIN_ROOT> from this installed skill path (two directories above).
Run commands with the target project as the working directory, or supply
`--repo "<PROJECT_ROOT>"`; source/task/config arguments resolve from the caller
working directory. Use absolute paths when working elsewhere. Never assume the
project contains this plugin’s npm scripts or edit the plugin installation.
Use installed skill names as exposed by the host, including namespaces.
If not adopted, use this plugin’s setup-project skill first.
Read `../../references/plugin.md` for runtime requirements and role fallback.

Run `node "<PLUGIN_ROOT>/scripts/factory.mjs" verify` in the candidate checkout. For an approved task,
use `verify --task TASK --acceptance RECORD` so scope, acceptance mapping and
candidate-bound evidence are checked. Version 2 requires the companion record.
Missing checks are an adoption error, not a pass. Read failed logs and distinguish
product failures from unavailable services. Missing manual/live evidence remains
pending even if all automated checks passed. Persist observations outside the
working tree to avoid altering the candidate with its own digest; see
`../../references/solo-workflow.md`. Never invent observed evidence or weaken acceptance.
Report exact commands, results, candidate identity and live/browser gaps.

New application adoption requires v3 Docker Compose verification with real services and browser E2E. Legacy checks are compatibility only. Inspect startup, health, test and cleanup evidence; unavailable Docker fails acceptance. See ../../references/entry-paths.md.
