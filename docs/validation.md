# Validation report

Date: 2026-11-16 (America/Los_Angeles).

## Local deterministic evidence

- Python 3.12 on macOS: `python3 -m unittest discover -s tests -v` passed 33 tests after review fixes.
- `python3 -m harness verify --config examples/demo/harness.json` passed the labeled demo check.
- Empty root project verification remains a failure, by design.
- Fresh local clone walkthrough passed: all 33 tests, demo verification, and expected exit 1 for unconfigured project verification.
- Real temporary Git repositories and real subprocesses exercise isolation/locks, linked worktrees, dirty/unborn repositories, scope detection, committed+dirty review coverage, candidate mutation, bounded repairs, malformed reports, timeout cleanup, successful-parent descendant cleanup, literal argv handling, atomic evidence replacement, and missing-tool failures.
- Native review found two real defects; both had observed failing regression tests before fixes and a passing full suite afterward.

## Desktop evidence

See [Desktop acceptance](desktop-acceptance.md). Native coordinator/architect/reviewer behavior was exercised in this app chat. Automatic role discovery and GUI Worktree flow remain pending by user request. No hooks are installed.

## Headless CLI evidence

Installed CLI: 0.169.0. Help confirmed exec/review and required output/sandbox flags.

- ChronoGraph intake: needs_clarification, 7 questions, 6 blocking, 46.33 seconds. [Report](../benchmarks/chronograph/results/first-run.md).
- A disposable, separate one-file task changed `src/message.txt` from pending to exactly `verified\n`. The controller independently checked the file and collected a separate real `codex review`. Terminal status: ready_for_human_review. One implementation attempt; total 30.42 seconds; builder 13.91 seconds; review 16.10 seconds. The original smoke checkout stayed unchanged. Run ID: `[local run identifier omitted]`. Full local evidence remains in the scratch smoke repository, not shipped in the template.
- These live invocations used the existing account's default model/settings. They do not prove model-independent behavior or eliminate inherited-context contamination.
- The enclosing agent sandbox initially prevented Codex initialization. Authorized host execution was used for the successful live tests; child Codex still requested read-only/workspace-write sandboxing and never-ask approvals. No dangerous bypass flags were used.

## Limits

Linux/Python 3.11 are configured in CI but were not run locally; GitHub CI has not run because the repository is not published. SIGINT cleanup, power-loss recovery, adversarial detached process/session escape, and hostile-worker isolation are not exhaustively validated. Local hashes/logs are not signed attestations. No ChronoGraph application, live databases, or browser UI was built or verified. No cross-tool benchmark superiority claim is made.
