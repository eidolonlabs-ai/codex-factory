---
name: review-task
description: Inspect Codex task evidence and review the complete candidate before human merge decisions.
---
Read the task, changed files, independent verification result, and separate review transcript. Ensure the recorded candidate still matches the files under review. Cover worker commits and dirty changes together; `--uncommitted` alone misses committed work. Review correctness, missing tests, error paths, and scope changes. Treat review findings as findings, not an approval token. Present remaining risks and ask the owner to make the merge decision.
