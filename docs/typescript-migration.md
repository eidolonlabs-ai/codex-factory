# TypeScript migration

The factory now requires Node.js 22+ and npm. Python is no longer required to run the factory, verifier, demo, tests, or DOCX intake. The original ChronoGraph application specification still mentions Python because it is unchanged benchmark input.

## Commands

| Previous | Replacement |
|---|---|
| Python unit-test discovery | `npm test` |
| Python factory command | `npm run factory -- COMMAND` |
| Project verification | `npm run factory -- verify` |
| Demo verification | `npm run verify:demo` |
| Type checking | `npm run typecheck` |
| Compile | `npm run build` |
| Run compiled CLI | `node dist/factory/cli.js COMMAND` |

Run `npm ci` after cloning and in each new Desktop Worktree. For an existing Node application, merge package scripts/dependencies and tsconfig settings instead of replacing its package files.

The task/config/result JSON formats remain schema version 1. Limits, statuses, check argv arrays, local artifact locations, and the distinction between Desktop and optional unattended execution remain. Signal-terminated subprocesses retain negative POSIX signal return codes. Candidate fingerprints are local evidence, not a portable signature: rerun checks after migrating rather than reusing earlier results.

Dependencies are pinned: TypeScript, Node types, tsx and Prettier for development; fflate and saxes for DOCX ZIP/XML parsing. The compiled CLI needs the runtime dependencies but not tsx. Application/test code uses strict TypeScript checking; skipLibCheck excludes third-party declaration internals due to invalid generic constraints in the saxes type declarations.

DOCX extraction preserves the original ChronoGraph text exactly and supports UTF-16 XML as well as UTF-8. Inputs above 64 MiB, document XML above 16 MiB, and XML DOCTYPE are rejected. Non-UTF-8 Git path names fail closed instead of being decoded lossily. Native Windows remains unsupported; use WSL.

## Review and evidence

A fresh native reviewer identified four migration defects: interruption handling between child processes, non-string architect decision acceptance, incorrect signal return codes, and UTF-16 DOCX parsing. Each received a failing regression followed by a passing fix. An additional validator test caught explicit null limits. The suite now contains 38 passing tests, including real-process interruption during Git inspection and forced cleanup of a child ignoring SIGTERM.

Live TypeScript smoke evidence: one bounded Codex implementation task reached ready_for_human_review after independent checks and a separate real review; a new headless ChronoGraph intake returned needs_clarification with 12 questions. Raw logs and run identifiers remain local. The live smoke preceded the review-driven fixes; the final revision is covered by the regression suite. These CLI observations do not complete the deferred Desktop UI acceptance.
