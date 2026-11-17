---
name: review-task
description: Inspect Codex task evidence and review the complete candidate before human merge decisions.
---
Use `npm run harness -- review --task TASK --acceptance RECORD` for a managed
review of an interactive candidate. It performs fresh verification and saves a
review packet. For a native reviewer, supply the same packet's task, acceptance,
check results, candidate and complete diff. Include commits, dirty changes and
untracked files; `--uncommitted` alone misses committed work. Review correctness,
error paths, missing tests and scope. A collected review is not a clean review
or approval. Keep prose and owner disposition separate. Changes invalidate prior
evidence; rerun verification/review after repairs. Only record an owner disposition
when the owner explicitly makes that decision. Never infer acceptance or merge
permission from zero exit status. Read `docs/solo-workflow.md` for handoff/evidence.
