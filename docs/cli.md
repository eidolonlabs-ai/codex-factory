# CLI operation

Run all commands from the template or an adopted repository root so Python can import `harness`. `--repo PATH` selects another Git repository for operations; task/config/source arguments are resolved relative to the process current directory.

- `python3 -m harness doctor`: checks tools, platform, clean Git state and configured checks. Does not test authentication.
- `python3 -m harness intake SOURCE [--model MODEL] [--timeout SECONDS]`: read-only questions report.
- `python3 -m harness benchmark [--model MODEL] [--timeout SECONDS]`: intake using the preserved ChronoGraph document.
- `python3 -m harness run TASK [--config CONFIG]`: bounded builder, checks, then review.
- `python3 -m harness verify [--config CONFIG]`: checks the current candidate, including uncommitted changes.
- `python3 -m harness status RUN_ID`: reads a managed implementation/intake record.

Exit codes: 0 successful command/report collection; 1 unsuccessful run or checks; 2 invalid input or setup. An intake requiring clarification returns 0 because clarification is its intended output. Benchmark scoring is separate.

Task IDs are lowercase letters, digits and hyphens, 1–48 characters. Scopes are normalized repository-relative file/directory prefixes; no globbing, absolute paths, `.` or `..`. A prefix `src` includes `src/api.py` but not `src-other`. Limits must be positive integers. JSON runtime validation rejects unknown fields.

Commands execute without shell expansion. To run a deliberate sequence, create a reviewed project script and invoke it explicitly; do not place `&&` or pipes into an argv field expecting shell behavior.

## Failures and recovery

Read result.json and the attempt/check/review log directories named within it. Authentication failures, malformed reports, scope violations, protected changes and missing tools stop immediately. Ordinary failing project checks can trigger repair within the attempt budget. No implicit resume occurs: a new run gets a new ID.

Ctrl-C produces interrupted status and terminates the subprocess group. A hard kill/power loss can leave a running record and lock; inspect the PID and associated worktree before removing a stale lock. Locks do not provide distributed scheduling or PID-reuse-proof leases.

Managed runs preserve worktrees, branches and review snapshot commits. Inspect with `git worktree list`. Clean up only after saving work/evidence, using ordinary Git worktree commands and explicit branch decisions. Never use `git clean -fdx` as a recovery shortcut.

The local evidence is reproducibility information, not protection against a hostile worker that can access the common Git directory. Stronger isolation belongs in an external runner/verifier deployment.
