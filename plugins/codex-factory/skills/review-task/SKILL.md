---
name: review-task
description: Inspect Codex task evidence and review the complete candidate before human merge decisions.
---

Resolve <PLUGIN_ROOT> from this installed skill path (two directories above).
Run commands with the target project as the working directory, or supply
`--repo "<PROJECT_ROOT>"`; source/task/config arguments resolve from the caller
working directory. Use absolute paths when working elsewhere. Never assume the
project contains this plugin’s npm scripts or edit the plugin installation.
Use installed skill names as exposed by the host, including namespaces.
If not adopted, use this plugin’s setup-project skill first.
Read `../../references/plugin.md` for runtime requirements and role fallback.

Use `node "<PLUGIN_ROOT>/scripts/factory.mjs" review --task TASK --acceptance RECORD` for a managed
review of an interactive candidate. It performs fresh verification and saves a
review packet. For a native reviewer, supply the same packet's task, acceptance,
check results, candidate and complete diff. Include commits, dirty changes and
untracked files; `--uncommitted` alone misses committed work. Review correctness,
error paths, missing tests and scope. A collected review is not a clean review
or approval. Keep prose and owner disposition separate. Changes invalidate prior
evidence; rerun verification/review after repairs. Only record an owner disposition
when the owner explicitly makes that decision. Never infer acceptance or merge
permission from zero exit status. Read `../../references/solo-workflow.md` for handoff/evidence.
