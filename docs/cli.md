# CLI operation

For the current v3 hook-driven Docker Compose workflow, start with
[entry paths](entry-paths.md), [hooks](hooks.md) and [orchestration](orchestration.md).
Legacy v1/v2 examples below remain compatible but do not provide the v3 acceptance contract.


Run `npm ci` in the template or adopted repository root first. Run the commands from that root so npm can load the TypeScript harness. `--repo PATH` selects another Git repository for operations; task/config/source arguments are resolved relative to the process current directory.

- `npm run harness -- doctor`: checks tools, platform, clean Git state and configured checks. Does not test authentication.
- `npm run harness -- intake SOURCE [--model MODEL] [--timeout SECONDS]`: read-only questions report.
- `npm run harness -- benchmark [--model MODEL] [--timeout SECONDS]`: intake using the preserved ChronoGraph document.
- `npm run harness -- run TASK [--config CONFIG]`: bounded builder, checks, then review.
- `npm run harness -- verify [--config CONFIG]`: checks the current candidate, including uncommitted changes.
- `npm run harness -- status RUN_ID`: reads a managed implementation/intake record.

Exit codes: 0 successful command/report collection; 1 unsuccessful run or checks; 2 invalid input or setup. An intake requiring clarification returns 0 because clarification is its intended output. Benchmark scoring is separate.

Task IDs are lowercase letters, digits and hyphens, 1–48 characters. Scopes are normalized repository-relative file/directory prefixes; no globbing, absolute paths, `.` or `..`. A prefix `src` includes `src/api.py` but not `src-other`. Limits must be positive integers. JSON runtime validation rejects unknown fields.

Commands execute without shell expansion. To run a deliberate sequence, create a reviewed project script and invoke it explicitly; do not place `&&` or pipes into an argv field expecting shell behavior.

For a compiled entry point, run `npm run build`, then `node dist/harness/cli.js --help`. npm scripts run the source through tsx; compiled execution only needs the runtime dependencies. Node.js 22+ is required. Windows uses WSL; native Windows process-group supervision is not supported.

The JSON contracts remain version 1. Candidate hashes are local fingerprints, not cross-language signatures; rerun verification after the migration rather than reusing old evidence. Non-UTF-8 Git paths now fail closed instead of being decoded lossily. DOCX inputs are limited to 64 MiB and document XML to 16 MiB; DOCTYPE is rejected.

## Failures and recovery

Read result.json and the attempt/check/review log directories named within it. Authentication failures, malformed reports, scope violations, protected changes and missing tools stop immediately. Ordinary failing project checks can trigger repair within the attempt budget. No implicit resume occurs: a new run gets a new ID.

Ctrl-C produces interrupted status and terminates the subprocess group. A hard kill/power loss can leave a running record and lock; inspect the PID and associated worktree before removing a stale lock. Locks do not provide distributed scheduling or PID-reuse-proof leases.

Managed runs preserve worktrees, branches and review snapshot commits. Inspect with `git worktree list`. Clean up only after saving work/evidence, using ordinary Git worktree commands and explicit branch decisions. Never use `git clean -fdx` as a recovery shortcut.

The local evidence is reproducibility information, not protection against a hostile worker that can access the common Git directory. Stronger isolation belongs in an external runner/verifier deployment.

## Interactive and managed execution

An interactive CLI session follows the same [solo workflow](execution-modes.md)
as Desktop. Only a controller-owned run gets controller deadlines and retries.
