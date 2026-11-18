# Codex compatibility

Implementation initially checked against locally installed `codex-cli 0.169.0`. The doctor probes required exec/review flags, rather than assuming every Codex version supports them. Help checks cannot prove authentication, sandbox enforcement, project trust, or live provider behavior.

Project settings are limited to `sandbox_mode = "workspace-write"` and `approval_policy = "on-request"`. The controller overrides these for unattended calls: workspace-write for implementation, read-only for intake/review, and approval_policy never. This fails inaccessible operations instead of disabling sandboxing or waiting for approval. Managed account policy can reject the requested policy.

Native sources consulted:
- [OpenAI configuration basics](https://learn.chatgpt.com/docs/config-file/config-basic): project `.codex/config.toml` and project trust.
- [OpenAI configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference): supported sandbox and approval settings.
- [OpenAI customization](https://learn.chatgpt.com/docs/customization/overview): repo-local `.agents/skills`.

See [0.3 acceptance](hooks-acceptance.md) for native CLI dispatch and Compose/browser checks, and [migration validation](validation.md) for earlier results. The package uses the [native manifest](hooks.md#codex-01690-package-compatibility) required by CLI 0.169.0. Global user instructions, skills, memory, plugins, and configured model settings can affect live results; v1 does not claim a clean-room benchmark or reset them. No global settings are modified.

On macOS an enclosing agent sandbox may prevent a nested Codex process from opening its session database or initializing the app server. Run the factory from an ordinary authorized terminal if that happens; do not add a sandbox-bypass flag to the child agent.

## Desktop roles

The standalone `.codex/agents/architect.toml` and `reviewer.toml` files use name, description and developer_instructions. They omit model overrides and sandbox overrides. Supported capability flags reduce apps/plugins/memory access when the role is actually loaded. Native roles inherit parent permissions; read-only instructions alone are not a separate sandbox. [OpenAI subagent reference](https://learn.chatgpt.com/docs/agent-configuration/subagents). Automatic role discovery on this installed app has not yet been observed; explicit role-instruction fallback tests are labeled as such.

## TypeScript runtime

Node.js 22+ is required. Dependencies are pinned in package-lock.json. Source execution uses tsx; `npm run build` emits a runnable JavaScript CLI. TypeScript strict checking covers application and test code; skipLibCheck skips external declaration-file internals because the saxes declarations contain unconstrained generic parameters. DOCX extraction is exercised against the original preserved benchmark text.

## Native Windows

The shared verifier and unattended runner currently reject native Windows because subprocess cleanup uses POSIX process groups. A real Windows VM baseline passed compilation but failed runtime verification: [native Windows results](windows-baseline.md). WSL is a separate Linux execution environment and was not tested in that baseline.
