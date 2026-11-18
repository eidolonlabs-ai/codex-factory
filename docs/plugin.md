# Codex Harness plugin

The plugin adds the template's workflow to an existing Git repository. It
includes six skills, supporting templates/role instructions, a preview-first
setup script, and the existing CLI bundled with its runtime dependencies.
Node.js 22+, Git, and macOS/Linux (including WSL) are required for scripts.
The target application can use any stack; it needs no harness npm dependencies.
Authenticated Codex CLI is required only for agent-driven intake/managed runs.

## Installation from GitHub

Register the GitHub marketplace and install the committed plugin:

```sh
codex plugin marketplace add theRealMarkCastillo/codex-harness-template
codex plugin add codex-harness@codex-harness
```

For local testing, register the checkout path instead of the GitHub shorthand.
This changes the user's plugin configuration and is an explicit installation
action, not part of the build. Refresh the host/start a new chat as needed and
select Codex Harness. Invoke its setup-project skill. Use the namespaced skill
name displayed by the host. Installation alone does not adopt a project.

Git marketplace sources and portable packaging are described in the
[OpenAI packaging guide](https://developers.openai.com/plugins/build/plugins).
The installed package uses `.codex-plugin/plugin.json` exclusively. Codex CLI
0.169.0 skips hook loading when it selects a portable root manifest, even when
that manifest declares hooks. Portable metadata remains canonical build input,
but root `plugin.json` is deliberately excluded from the shipped package.
No MCP server, account upload, or hosted service is needed. The plugin bundles native hooks; review and trust their current definitions in the host before claiming enforcement. See [hook setup](hooks.md).

## Updating an installed plugin

For a GitHub marketplace installation:

```sh
codex plugin marketplace upgrade codex-harness
codex plugin add codex-harness@codex-harness
```

For a local-checkout installation (the current development setup), build the
updated checkout and reinstall it:

```sh
cd /Users/markcastillo/git/codex-harness-template
npm run plugin:build
codex plugin add codex-harness@codex-harness
```

`marketplace upgrade` refreshes Git sources; it is not needed for a local path.
Use `codex plugin list --json` to inspect the installed version and source.
Start a fresh Codex session and review/trust changed hooks through `/hooks` or
the Desktop hook interface. Reinstallation does not migrate existing project
configuration or activate a task. Never modify the installed cache by hand.

## Project adoption

Resolve PLUGIN_ROOT from the installed skill file: it is two directories above
`skills/<name>/SKILL.md`. The following paths are placeholders, not environment
variables that Codex necessarily sets. Use absolute, quoted paths.

```sh
node "<PLUGIN_ROOT>/scripts/setup.mjs" --repo "<PROJECT_ROOT>"
node "<PLUGIN_ROOT>/scripts/setup.mjs" --repo "<PROJECT_ROOT>" --apply
node "<PLUGIN_ROOT>/scripts/harness.mjs" verify --repo "<PROJECT_ROOT>"
```

Preview creates nothing. Apply creates missing `harness.json` and scaffolds in
`docs/harness/`; existing files are preserved, including existing checks.
Symlink destinations and non-root project paths are rejected. Apply is a local
scaffolding operation, not a transaction against concurrently modified files;
run it while another process is not rewriting the destination directories.
It does not modify AGENTS.md, package files, .codex settings, CI, or global
configuration. Reconcile the suggested AGENTS snippet and existing instructions
as an explicit project edit. Configure actual acceptance checks: the generated
configuration requires a real Compose stack and E2E service. Commit adopted files before a
managed CLI run; that runner requires a clean base.

Checks execute in the project as trusted host commands. Source, task and
`--config` arguments resolve from the caller's working directory, so use
absolute paths when running outside the project. Verification evidence lives
in the project's Git common directory under `harness/verification`, not in the
plugin cache. Project state and decisions belong in the project as well.

## Workflow and limitations

Use [entry paths](entry-paths.md), [hook activation](hooks.md), [orchestration](orchestration.md), and the [solo task workflow](solo-workflow.md) and [execution modes](execution-modes.md) from either Desktop or CLI.

Use coordinate-development for intake, approved tasks, implementation,
integration, verification and review. Parallel builders use separate Desktop
Worktree chats. Native subagents handle focused analysis/review. Read
`references/roles/*.toml` within the installed package as role instructions;
bundling them does not register them as project agents. Supply the relevant
skill text and behavioral instructions directly when a native role cannot
discover plugin skills. Existing project roles may disable plugins. Never
claim a separate role sandbox; permissions are inherited.

Only explicitly requested controller-managed runs enforce controller budgets. Interactive
skills in either interface are instructions. Version 1 preserves conservative protected paths. Versions 2 and 3 explicitly adopt
editable application/unit-test paths and trusted acceptance protections; see
[protection policy](solo-policy.md). Manifest/lock/control changes remain reviewed
interactive work. No sealed holdouts,
permission bypass, automatic merge, scheduler, or organization policy service
is provided. The ChronoGraph benchmark remains in the template repository and
is excluded from the package; use `intake SOURCE` for user-supplied documents.
The runtime's `benchmark` command still requires those fixtures in the target
repository; packaging does not change the controller's command grammar.

## Maintenance and release

Canonical workflow skills live in `.agents/skills`, templates/guide material
in `docs`, runtime source in `harness`, and plugin-only sources in `plugin-src`.
Do not edit generated files under `plugins/codex-harness` directly. Run:

```sh
npm ci
npm run plugin:build
npm run plugin:check
npm run plugin:pack
```

The build generates the catalog and package, including a standalone CLI bundle
and third-party license notices. Commit generated files so Git installs need
no build step. Tests exercise the shipped bundle in a separate Git repository.
The private/source-distribution ZIP is written under `dist/` without a catalog,
node_modules, benchmark sources, or unrelated repository files.

Increment `plugin-src/plugin.json` version for a release and regenerate the native
package. Refresh the marketplace and reinstall/update using the host's
supported flow; never edit an installed cache. Project scaffolds are not
automatically overwritten on upgrade. Review changes and migrate project
configuration deliberately. Teams can pin a Git ref with marketplace `--ref`.

Public directory submission is a later release task. This source package is
not advertised as submission-ready: publisher verification, listing/policy
URLs, icon, applicable review materials and portal checks remain outstanding.
GitHub publication and public-directory approval are separate milestones.

Local automated package tests do not establish Desktop discovery, a live
Codex agent run, native Windows support, or application browser/service
acceptance. See the repository's plugin validation and design coverage reports
for evidence and remaining gaps.

## Version 0.3 requirements

New adoption requires Docker and Docker Compose via schema version 3. The plugin
bundles SessionStart, PreToolUse and Stop handlers. V1/v2 remain compatible for
existing calls but do not satisfy the new full-stack/hook adoption contract.
Local-script hooks require host trust. The current OpenAI packaging guide excludes
plugins containing lifecycle hooks from the public plugin directory; a future
listing depends on that policy changing or a separately scoped package.
Git/local marketplace installation is the supported distribution route to test.
