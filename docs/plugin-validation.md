# Initial packaging validation

This report records the 0.1.0 packaging checkpoint. See [0.3 acceptance](hooks-acceptance.md) for native hooks and Compose validation.

Local candidate validation on 2026-11-17, macOS arm64, Node 22.22.3.
Scope and base are recorded in `docs/plugin-task.md`. No application was built
as part of this task; demonstration checks exercise only the labeled fixture.

## Results

| Check | Result |
| --- | --- |
| `npm ci --offline --no-audit --no-fund` | Passed with synchronized package/lock files. esbuild 0.28.2 was already locked transitively and is now an explicit build dependency. |
| `npm run typecheck` | Passed. |
| `npm run format:check` | Passed for factory, tests, build scripts and plugin runtime/setup sources. |
| `npm test` | 43 passed, zero failures/skips, including five plugin regression tests. |
| `npm run build` | Passed. |
| `node dist/factory/cli.js verify --config examples/demo/factory.json` | Passed, labeled demo fixture only. Required filesystem permission to write evidence under this checkout's `.git/factory`. |
| `npm run plugin:check` | Passed; 27 generated package files, six skills, catalog and manifests synchronized. |
| `npm run plugin:pack` | Passed; source/private-distribution ZIP in `dist/codex-factory-0.1.0.zip`. |

The five plugin tests check manifest consistency and resource resolution;
preview-only and repeated adoption with existing rules/package/config retained;
symlink rejection before scaffold writes; standalone CLI execution against a
separate Git repository; and ZIP extraction/runtime startup without template
dependencies. Positive and negative checks cover empty configuration, a real
fixture assertion that fails after a source regression, and an unavailable
check executable. Evidence is stored in the destination repository. The bundle
contains fflate, saxes and xmlchars with license notices. The saxes npm archive
omits its license, so the exact upstream v6.0.0 LICENSE was fetched from
`https://raw.githubusercontent.com/lddubeau/saxes/v6.0.0/LICENSE` and included.

Generation is checked against canonical sources, including the runtime bundle.
CI adds plugin freshness validation without removing any existing checks.
Core controller code, protected paths and acceptance behavior were unchanged.

## Installation and remaining acceptance

The installed CLI help confirms marketplace registration and plugin-add
commands. A read-only `codex plugin list --marketplace codex-factory --available
--json` returned empty installed/available lists for the unregistered checkout.
That is not an installation/discovery pass. No user/global plugin settings
were changed. The package is prepared for repository distribution; the remote
GitHub repository cannot serve this candidate until authorized publication.

Not exercised: installation and six-skill discovery in a fresh Desktop chat;
installation from the published GitHub revision; a real authenticated model
intake/managed run using the installed bundle; project-native role discovery;
live application services/browser journeys; Linux/WSL execution of this new
candidate; public directory submission. Existing CI covers Linux/macOS and
Node 22/24 when run remotely, but remote CI has not run for this local diff.

The ZIP is a source/private distribution artifact, not a public-directory
submission-ready package. Publisher verification, listing/policy URLs, icon,
applicable review materials and portal validation remain future release work.

## Independent review

A fresh native reviewer inspected the complete candidate, including untracked
plugin sources/generated files, build/test changes and design coverage report.
Two P2 findings were fixed: the wrapper unnecessarily rejected argument values
named `benchmark`, and the archive test hardcoded the initial release version.
The wrapper now delegates argument parsing to the unchanged controller; the
regression test covers `--help --repo benchmark`. Archive selection comes from
the canonical manifest and asserts the embedded version.

After fixes, all 43 tests, typecheck, expanded formatting, plugin freshness and
archive checks passed again. The reviewer inspected the fixes and reported no
remaining material findings from the focused follow-up. They did not rerun
tests or approve publication/merge. Installation and application acceptance
gaps above remain open.
