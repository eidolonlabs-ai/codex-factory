# Adopting the template

Run `npm ci` after cloning the template. Each separate Desktop Worktree needs its own dependency installation; node_modules is ignored and is not carried into new worktrees. For existing Node projects, merge the package scripts/dependencies and TypeScript configuration rather than overwriting their package files.

Start with a new repository for an application, or copy selected files into an existing one after inspecting differences. Preserve project-specific AGENTS.md rules and reconcile `.codex/config.toml`. Do not overwrite another agent's template or global settings.

The empty root `harness.json` is intentional. Configure application checks such as typecheck, unit tests, integration tests, migrations on disposable databases, and browser tests as appropriate. These are trusted commands executed outside Codex's tool sandbox. Install their dependencies yourself or through your existing project setup process.

Keep verification scripts stable. A check that exits zero without exercising acceptance criteria proves nothing. Configure required E2E tests to fail when tooling or services are absent, rather than silently skipping. Do not use a destructive reset against a shared database.

The supplied GitHub workflow checks the harness and demo, not your application. Add the same project verification entry point to your application CI after configuration. Branch protection, required CI checks and ownership rules are remote repository settings and are not installed automatically.

Use `tasks/example.json` only as a format reference. A resolved specification and concrete assertions belong in every real task. Define the smallest allowed path prefixes that cover the work. Public unit tests can be inside application source directories; the root tests directory is protected by default. Changes to protected controls are manual reviewed work in v1.

This template and the supplied ChronoGraph benchmark are MIT licensed. Retain the license notice when reusing or distributing them. Use GitHub's **Use this template** action to create your own repository, then adapt the project checks, tasks, and documentation.
