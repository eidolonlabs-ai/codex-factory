# Native Windows baseline

Tested commit: `2252bb72920aa3b13d7f5f5ab0e21adc8350ea0e`.

This was a native Windows VM run over SSH using PowerShell and cmd.exe, with no WSL. Windows reported build 26200 (AMD64), PowerShell 5.1, Node.js 22.23.5, npm 10.9.9, and MinGit 2.56.1.windows.1. Portable tools were extracted into a dedicated user directory, with PATH and Git configuration scoped to the test process. Node and MinGit archive SHA-256 hashes were checked against their release metadata. No system-wide installation was performed.

| Check | Result |
| --- | --- |
| Clean checkout and `npm ci` | Passed |
| `npm run typecheck` | Passed |
| `npm run format:check` | Passed |
| `npm test` | 18 passed, 20 failed; no skipped tests |
| `npm run build` | Passed |
| `npm run verify:demo` | Failed, exit 2 |

## Findings

The process runner explicitly rejects `win32` with `Use WSL: POSIX process groups are required`. This blocks subprocess-based verification, intake, implementation, and review. The demo verifier reaches this guard. The guard was not removed for testing, so this run does not test hypothetical Windows process cleanup.

The test suite also assumes Unix behavior: executable permission changes, newline-containing filenames, and the `which` executable fail on this Windows setup. Fake agent executables use Unix shebang scripts; they will require a Windows-compatible launcher before agent lifecycle tests can establish native Windows support. Most workflow failures occur at or downstream of the process-runner guard, so 20 failing tests do not mean 20 independent implementation defects.

Some tests expecting rejection can pass without reaching their intended condition because Windows is rejected earlier. The 18 passing tests therefore must not be interpreted as broad workflow compatibility.

Native Windows remains unsupported by the shared verifier and unattended runner. Successful TypeScript compilation does not imply runtime compatibility. Supporting it requires a Windows process lifecycle implementation, portable test fixtures, and Windows-specific acceptance tests for timeout cleanup, descendant processes, interruption evidence, and locks. Merely deleting the platform guard would not be sufficient.

No live Codex model calls or Codex Desktop UI flows were tested on Windows. WSL was neither installed nor used. Raw logs stay outside the public repository to avoid publishing machine-specific paths and metadata.
