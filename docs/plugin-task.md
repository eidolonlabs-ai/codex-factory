# Plugin distribution task

Historical task record for the initial plugin package. See [current plugin setup](plugin.md).

## Approved scope

The owner approved the preceding proposal on 2026-11-17: retain this repository
as a template, add a Codex plugin with portable skills/resources/runtime and
explicit project adoption, support GitHub marketplace distribution, and leave
public listing submission for later. The owner also requested a design coverage
review of five supplied documents/slides for solo developers and small teams,
with a path toward a larger software factory.

Base: `1175ec00f3e5f5b9358e98ea77a9d01e458d7ebf`.
Owner: coordinator in the current workspace. Native agents perform read-only
design analysis and final review. No parallel builders.

## Acceptance and ownership

- Add `plugins/codex-factory/` and `.agents/plugins/marketplace.json` with
  synchronized portable/compatibility identities and six discoverable skills.
- Generate existing workflow skills and supporting templates from canonical
  repository sources; detect stale generated files. Bundle the existing CLI
  and dependencies into JavaScript runnable with Node 22+ without npm setup
  in the destination repository. Preserve controller behavior and restrictions.
- Add a preview-first setup script that only creates missing scaffold files,
  rejects symlink destinations, and never changes global settings, existing
  project rules, dependencies, CI, or agent-role configuration.
- Test the shipped package from a standalone location against a separate Git
  project: setup preservation, successful/failed/empty verification, evidence
  placement, reproducible generation, and archive contents.
- Document installation, runtime requirements, explicit adoption, role fallback,
  upgrade behavior, public-listing status, and platform validation gaps.
- Review every supplied source; save a traceable coverage matrix distinguishing
  implementation, instructions, missing features, and future factory scope.

Allowed paths: `scripts/`, `plugin-src/`, `plugins/`,
`.agents/plugins/marketplace.json`, `tests/plugin.test.ts`, `package.json`,
`package-lock.json`, `README.md`, `docs/`, `.github/workflows/verify.yml`.
CI may gain plugin validation only; existing checks and controller protections
must not be weakened. Tests/configuration changes require independent review.

## Implementation plan

1. Add plugin source metadata, setup and wrapper, then deterministic generation
   with bundled runtime and dependency license notices.
2. Add standalone-package regression tests and build/check/archive commands.
3. Extend CI with generation checks, and document GitHub distribution/adoption.
4. Save source coverage assessment and prioritized future work.
5. Run typecheck, formatting, factory and plugin tests, build, demo verifier,
   package freshness/archive inspection, then independent candidate review.

No publishing, global installation, public submission, merge, or deployment is
part of this task. New factory behavior is assessed, not silently implemented.
