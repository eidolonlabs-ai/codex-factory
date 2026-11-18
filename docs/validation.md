# Runtime migration validation

This report records the original TypeScript migration baseline. See [0.3 acceptance](hooks-acceptance.md) for current workflow evidence.

## Initial TypeScript implementation

Local checks on Node.js 22.22.3/macOS:

- `npm test`: 38 passing tests.
- `npm run typecheck`: passed with strict application/test type checking.
- `npm run format:check`: passed.
- `npm run build`: passed.
- `node dist/factory/cli.js verify --config examples/demo/factory.json`: passed.
- Unconfigured project verification fails deliberately.
- The original ChronoGraph DOCX extracts to exactly the preserved text; UTF-16 XML fixtures also pass.

Real temporary repositories/processes cover worktree isolation and locks, linked worktrees, dirty/unborn repositories, scope checks, complete review snapshots, candidate drift, retry budgets, malformed reports, missing tools, timeout cleanup, descendants, SIGINT during agent execution and between subprocesses, and atomic evidence replacement. [Migration and review details](typescript-migration.md).

A real TypeScript CLI smoke task completed an implementation, independent check, and separate review. A new ChronoGraph CLI intake returned needs_clarification with 12 questions. Those calls ran before the final review fixes; the final changes have targeted regressions and the full passing suite. Live calls used the account's configured model, so they are not controlled cross-model comparisons. Private session metadata is not published.

The Node.js CI matrix targets Ubuntu/macOS with Node 22/24. See the [workflow runs](https://github.com/eidolonlabs-ai/codex-factory/actions/workflows/verify.yml) for CI results.

## Earlier Python and Desktop evidence

The original Python implementation passed 33 tests and its initial cross-platform CI. [Historical CI run](https://github.com/eidolonlabs-ai/codex-factory/actions/runs/44010310656). Those results are historical and are not evidence for the TypeScript implementation.

The earlier headless intake returned 7 questions, 6 blocking, in 46.33 seconds. [Historical report](../benchmarks/chronograph/results/first-run.md). A separate earlier one-file implementation/review smoke passed in 30.42 seconds.

[Desktop acceptance](desktop-acceptance.md) records native coordinator/architect/reviewer behavior. Automatic role discovery and the GUI Worktree walkthrough remain pending by user request. That exercise predated the hook bundle.

## Limits

The enclosing tool sandbox can deny process-group signals or nested Codex initialization. Authorized host execution was used where needed while the child Codex retained its sandbox; no dangerous bypass flags were used. Process cleanup tests do not prove containment of malicious processes that deliberately detach into new sessions. Power-loss recovery, hostile-worker isolation, and production deployment remain outside these checks.

No ChronoGraph application, live databases, or browser UI was built or verified. No cross-tool benchmark superiority claim is made. Local hashes/logs are not signed attestations.

## Native Windows VM baseline

At commit `2252bb7`, a native Windows VM with Node.js 22.23.5 passed dependency installation, type checking, formatting, and compilation. The test suite had 18 passes and 20 failures; demo verification failed at the explicit Windows platform guard. Native Windows runtime support is not established. See the [Windows baseline](windows-baseline.md) for environment, failure categories, and evidence limits. No WSL was used.
