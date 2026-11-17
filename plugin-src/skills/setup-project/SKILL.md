---
name: setup-project
description: Adopt Codex Harness in a new or existing Git project without overwriting its configuration. Use after installing the plugin or when project checks are missing.
---
# Set up a project

Resolve the installed plugin root from this skill's location (two directories
above). Do not assume that the plugin lives in the project, and do not write
to its installation/cache. Read `../../references/plugin.md` first.

Inspect the selected project's instructions, stack, existing checks, and Git
root. Run `node "<PLUGIN_ROOT>/scripts/setup.mjs" --repo "<PROJECT_ROOT>"`
to preview missing scaffold files. For an authorized project adoption request,
apply that concrete plan with the same command plus `--apply`. Existing files
are preserved. Inspect them and reconcile them explicitly if necessary.

Configure real acceptance checks in the project's `harness.json` using its
existing stack and test commands. Empty checks intentionally fail. Do not
replace them with placeholder success commands, demo fixtures, or skipped E2E
tests. For a project without defined acceptance requirements, ask the owner
about consequential decisions before building the application.

Review `docs/harness/AGENTS.snippet.md` with existing project rules and integrate
only appropriate guidance when project adoption authorizes it. No global
settings or project role configuration are changed by setup. The plugin can
provide role instructions directly to a native subagent; read the installed
`references/roles/architect.toml` or `reviewer.toml` and pass its behavioral
instructions along with the relevant skill text. Do not claim a role was loaded
or separately sandboxed. These role files disable plugins when configured as
project roles, so plugin discovery within such roles must never be assumed.

Use the installed coordinate-development skill for the next phase. Use the
skill name exposed by the host, including its plugin namespace when present.
Keep shared state and approved specs in the project. Run verification with
`node "<PLUGIN_ROOT>/scripts/harness.mjs" verify --repo "<PROJECT_ROOT>"`.
Report checks still needing live services or browser validation. CLI `doctor`
is for managed-run preflight; its Codex authentication/setup expectations do
not prevent using Desktop skills or the verifier alone.
