# Install and use Codex Harness

The plugin bundles workflow skills, project scaffolding, native hooks, and a standalone Node runtime. Application verification requires Node.js 22+, Git, Docker, and Docker Compose. Agent-driven intake, managed builds, and the independent review launched by Stop also require an authenticated Codex CLI.

## Install from GitHub

```sh
codex plugin marketplace add theRealMarkCastillo/codex-harness
codex plugin add codex-harness@codex-harness
```

For a local checkout, pass its absolute path to `codex plugin marketplace add` in place of the GitHub repository. Open a fresh Codex session, review and trust the [hooks](https://github.com/theRealMarkCastillo/codex-harness/blob/main/docs/hooks.md), and invoke the plugin's setup-project skill using the name Codex displays.

## Update

For a GitHub installation, refresh the marketplace and reinstall the plugin.

```sh
codex plugin marketplace upgrade codex-harness
codex plugin add codex-harness@codex-harness
```

For a local installation, run `npm ci` if dependencies are missing, then run `npm run plugin:build` in the registered checkout and repeat `codex plugin add codex-harness@codex-harness`. Use `codex plugin list --json` to check the version and source. Start a fresh session and review any changed hook definitions. Migrate project configuration explicitly when needed.

## Adopt a project

Use setup-project to preview the scaffold, then apply it. To do the same from a terminal, replace the placeholders with absolute paths. The installed plugin root is two directories above `skills/<name>/SKILL.md`.

```sh
node "<PLUGIN_ROOT>/scripts/setup.mjs" --repo "<PROJECT_ROOT>"
node "<PLUGIN_ROOT>/scripts/setup.mjs" --repo "<PROJECT_ROOT>" --apply
```

Setup fills missing files and preserves existing configuration. Reconcile the suggested instructions with your project, configure real Compose services and acceptance checks, then establish a passing baseline. Follow the [entry paths](https://github.com/theRealMarkCastillo/codex-harness/blob/main/docs/entry-paths.md) to prepare the first task. [Task workflow](https://github.com/theRealMarkCastillo/codex-harness/blob/main/docs/solo-workflow.md)

Project roles are available as references under `references/roles/` in the package. Supply their instructions explicitly if Codex cannot discover the corresponding role.

## Build and distribute

Edit the source skills under `.agents/skills`, runtime under `harness`, and plugin-specific files under `plugin-src`. Set the release version in `plugin-src/plugin.json`.

```sh
npm ci
npm run plugin:build
npm run plugin:check
npm run plugin:pack
```

Commit the generated plugin and catalog for Git installation. The ZIP in `dist/` contains the standalone package. Codex CLI 0.169.0 loads the hooks through the native manifest. The build omits the portable root manifest because that CLI skips hooks when it selects the portable format. [Compatibility detail](https://github.com/theRealMarkCastillo/codex-harness/blob/main/docs/hooks.md)

Git and local marketplaces are the distribution paths for this package. OpenAI's public plugin directory excludes packages containing lifecycle hooks under the policy recorded for 0.3. [OpenAI packaging guide](https://developers.openai.com/plugins/build/plugins)
