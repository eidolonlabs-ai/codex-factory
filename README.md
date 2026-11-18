# Codex Harness

[![Harness verification](https://github.com/theRealMarkCastillo/codex-harness/actions/workflows/verify.yml/badge.svg)](https://github.com/theRealMarkCastillo/codex-harness/actions/workflows/verify.yml)

A local development workflow for solo developers and small teams using Codex Desktop or CLI. Define the task and its acceptance criteria, implement within agreed paths, then verify the candidate with Docker Compose and collect an independent review before deciding what to ship.

## Get started

- **Add the plugin to Codex.** Install from the GitHub marketplace and review the bundled hooks. [Install, update, and adopt](docs/plugin.md)
- **Use the repository template.** Clone [Codex Harness](https://github.com/theRealMarkCastillo/codex-harness) or copy it into a new repository and configure your application checks. [Template setup](docs/adoption.md)
- **Start work.** Pick the path for a new project, existing repo, bug fix, or feature. [Task entry points](docs/entry-paths.md)

Application acceptance uses Node.js 22+, Git, and a running Docker engine with Docker Compose. The harness runs on macOS and Linux, including WSL. See the tested configurations and limits in [Compatibility](docs/compatibility.md).

## Choose how to run the task

| Mode | When to use it | Guide |
| --- | --- | --- |
| Interactive | Work with Codex in Desktop or CLI. Activate the task so trusted hooks guard covered edits and run the completion gate. | [Desktop](docs/desktop.md) · [Hooks](docs/hooks.md) |
| Managed task | Run an approved task unattended with bounded attempts, a separate worktree, and a review snapshot. | [CLI](docs/cli.md) |
| Managed task graph | Run independent tasks in parallel, integrate changes in dependency order, and verify the combined candidate. | [Orchestration](docs/orchestration.md) |

All three modes use the same task and acceptance formats. The owner decides whether to commit and push directly or use a PR. [Task evidence and handoff](docs/solo-workflow.md)

## Verify this repository

```sh
npm ci
npm run typecheck
npm test
npm run verify:demo
npm run plugin:check
```

The demo exercises a fixture. For real Compose and browser verification, use the [disposable pilot](examples/compose-pilot/README.md). The [ChronoGraph benchmark](benchmarks/chronograph/README.md) measures intake questions.

[Documentation index](docs/README.md) · [0.3 acceptance evidence](docs/hooks-acceptance.md) · [Trust boundaries](docs/security.md) · [MIT license](LICENSE)

Codex Harness is an independent community project.
