# Install and use Codex Factory

The plugin bundles workflow skills, project scaffolding, native hooks, and a standalone Node runtime. Application verification requires Node.js 22+, Git, Docker, and Docker Compose. Agent-driven intake, managed builds, and the independent review launched by Stop also require an authenticated Codex CLI.

## Install from GitHub

```sh
codex plugin marketplace add eidolonlabs-ai/codex-factory
codex plugin add codex-factory@codex-factory
```

For a local checkout, pass its absolute path to `codex plugin marketplace add` in place of the GitHub repository. Open a fresh Codex session, review and trust the [hooks](https://github.com/eidolonlabs-ai/codex-factory/blob/main/docs/hooks.md), and invoke the plugin's `factory-setup` skill (or `factory-pipeline`) using the name Codex displays.

## Update

For a GitHub installation, refresh the marketplace and reinstall the plugin.

```sh
codex plugin marketplace upgrade codex-factory
codex plugin add codex-factory@codex-factory
```

For a local installation, run `npm ci` if dependencies are missing, then run `npm run plugin:build` in the registered checkout and repeat `codex plugin add codex-factory@codex-factory`. Use `codex plugin list --json` to check the version and source. Start a fresh session and review any changed hook definitions. Migrate project configuration explicitly when needed.

## Adopt a project

Use `factory-setup` to preview the scaffold, then apply it. To do the same from a terminal, replace the placeholders with absolute paths. The installed plugin root is two directories above `skills/<name>/SKILL.md`.

```sh
node "<PLUGIN_ROOT>/scripts/setup.mjs" --repo "<PROJECT_ROOT>"
node "<PLUGIN_ROOT>/scripts/setup.mjs" --repo "<PROJECT_ROOT>" --apply
```

Setup fills missing files and preserves existing configuration. Reconcile the suggested instructions with your project, configure real Compose services and acceptance checks, then establish a passing baseline. Follow the [entry paths](https://github.com/eidolonlabs-ai/codex-factory/blob/main/docs/entry-paths.md) to prepare the first task. [Task workflow](https://github.com/eidolonlabs-ai/codex-factory/blob/main/docs/solo-workflow.md)

Project roles are available as references under `references/roles/` in the package. Supply their instructions explicitly if Codex cannot discover the corresponding role.

## Architecture: Skills, Bundled Scripts & Parallel Slices

- **Skills + Centralized Bundled Scripts (`runtime/` + `scripts/`)**: All 8 skills under `skills/factory-<stage>/SKILL.md` share the plugin-level wrappers `<PLUGIN_ROOT>/scripts/factory.mjs` and `scripts/hooks.mjs` rather than duplicating scripts inside each skill directory. `npm run plugin:build` (`scripts/build-plugin.mjs`) bundles the TypeScript runtime (`factory/*.ts`) via `esbuild` into dependency-free `plugins/codex-factory/runtime/{cli,hooks}.mjs` and rewrites `skills/factory-*/SKILL.md` commands to invoke `<PLUGIN_ROOT>/scripts/factory.mjs`.
- **Parallel Implementation Slices**: Multi-slice tasks run either in separate Codex Desktop Worktree chats (`codex --worktree` per scoped task card with disjoint `allowed_paths`) or via CLI DAG waves (`factory orchestrate <plan.json>`) in isolated git worktrees before integrated Compose verification and cold-context review.

## Build and distribute

Edit the source skills under `.agents/skills`, runtime under `factory`, and plugin-specific files under `plugin-src`. Set the release version in both `plugin-src/plugin.json` and root `package.json` (`0.3.0`).

```sh
npm ci
npm run plugin:build
npm run plugin:check
npm run plugin:pack
```

Commit the generated plugin (`plugins/codex-factory/`) and GitHub catalog (`.agents/plugins/marketplace.json`) so `codex plugin marketplace add eidolonlabs-ai/codex-factory` + `codex plugin add codex-factory@codex-factory` work directly from GitHub. `npm run plugin:pack` also builds `dist/codex-factory-0.3.0.zip`. Codex CLI 0.169.0 loads the hooks through the native manifest (`.codex-plugin/plugin.json`). The build omits the portable root manifest because that CLI skips hooks when it selects the portable format. [Compatibility detail](https://github.com/eidolonlabs-ai/codex-factory/blob/main/docs/hooks.md)

Git and local marketplaces are the distribution paths for this package. OpenAI's public plugin directory excludes packages containing lifecycle hooks under the policy recorded for 0.3. [OpenAI packaging guide](https://developers.openai.com/plugins/build/plugins)
