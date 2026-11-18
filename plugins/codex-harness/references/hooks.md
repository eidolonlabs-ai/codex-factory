# Native hook gates

In a fresh Codex session, review and trust the plugin's current hook definitions using `/hooks` in CLI or the Desktop hook interface. Trusting the project or installing the plugin does not grant hook trust. Review changed definitions on update.

| Hook | Behavior in an adopted repository |
| --- | --- |
| SessionStart | Reports task state and records the candidate baseline. |
| PreToolUse | Denies recognized destructive or verification-bypass commands and covered direct changes outside approved paths. With no active task, it denies direct implementation patches unless the controller owns the task. |
| Stop | Checks scope, runs Compose acceptance, and collects independent review for an active task. Without an active task it can detect changes since SessionStart and report blocked work. Managed workers return to their supervising controller for verification. |

## Activate and inspect

Activate the task from the target worktree using the installed runtime.

```sh
node "<PLUGIN_ROOT>/scripts/harness.mjs" activate TASK --acceptance RECORD
```

Activation freezes the approved task, acceptance record, and v3 config for that worktree. Each Stop reruns acceptance. A failing check can request a repair, up to the persisted attempt limit. Protected changes or missing manual evidence can block completion. Passing checks and collected review yield `ready_for_human_review`. The owner reviews the findings and decides what ships.

The Git common directory stores the task state and bounded `events.jsonl` audit under `harness/hooks/`. Check the audit to confirm dispatch. Use `hooks-status` to inspect the active task. Run `deactivate` after reviewing the result or deciding to cancel. If a crash leaves `gate.lock`, inspect the owning process before manual recovery.

Hook coverage depends on the host and tool path. Errors or timeouts can prevent enforcement. For example, `write_stdin` does not start a fresh PreToolUse check. Read the [trust boundaries](security.md) before relying on hooks for controls that need OS enforcement.

### Codex 0.169.0 package compatibility

The package ships `.codex-plugin/plugin.json` and `hooks/hooks.json`, plus their launcher and bundled runtime. A portable root manifest takes precedence in Codex 0.169.0, but the loader skips hooks for that format. Keep portable metadata in `plugin-src` and test real dispatch after package changes. [Codex release source](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/core-plugins/src/loader.rs#L929-L939) · [OpenAI hook reference](https://learn.chatgpt.com/docs/hooks)
