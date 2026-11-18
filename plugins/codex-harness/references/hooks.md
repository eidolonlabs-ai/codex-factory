# Native Codex hook gates

Plugin 0.3.0 ships hooks/hooks.json, scripts/hooks.mjs and runtime/hooks.mjs.
SessionStart reports adopted-project task state and records a baseline for detecting unactivated changes. PreToolUse denies recognized
verification-bypass/destructive shell patterns and rejects direct apply_patch
changes outside frozen task/policy paths. Stop performs version-3 Compose
verification and independent review for an explicitly activated task.

The host must trust the current hook definition. Use /hooks in a fresh CLI
session or the Desktop hook trust interface. Installation and project trust are
not hook trust. Changed definitions require renewed review. This project does
not change approval/sandbox defaults or silently trust hooks globally.

Activation snapshots the approved task, acceptance mapping and configuration in
Git common-directory storage keyed by the worktree's canonical path. Distinct
worker/reviewer worktrees do not inherit another worktree's active Stop task,
preventing recursive reviewer launches. Managed workers are supervised by their
controller; they still receive adopted-project baseline tool guards.

Failed verification asks Codex to repair; attempts persist across turns. Budget
exhaustion, protected/configuration changes or missing manual evidence records a
blocked state and stops continuation without reporting success. Interruption is
terminal and retains evidence. Successful checks plus collected review produce
ready_for_human_review, not accepted. Every Stop reruns acceptance: ignored
Compose interpolation and mutable external images make Git-only caches unsafe.

Inspect hooks-status and the bounded events.jsonl audit. A stale gate.lock never
gets silently removed. After checking no process owns it, an operator can recover
it explicitly. Deactivate archives the task without claiming success; activate
starts an explicitly reviewed new attempt. Local records and CLI activation are
trusted operator inputs, not cryptographic authorization. A builder with the same
host permissions could tamper with them; true sealed acceptance needs a separate
verifier permissions boundary and is not provided by this local mode.

Shell pattern guards are defense in depth, not a shell interpreter or universal
filesystem firewall. Indirect writes are checked by the full candidate scope gate.
The host can fail open on hook timeouts/errors and some tool paths lack hooks;
write_stdin does not repeat PreToolUse. Do not disable sandboxing or claim complete
security isolation. The adapter emits explicit native blocking responses on known
failures, but cannot override host behavior if it never executes.

Official contracts checked during implementation:
https://learn.chatgpt.com/docs/hooks
https://developers.openai.com/plugins/build/plugins
The current packaging guide excludes lifecycle-hook plugins from the public
plugin directory. Git/local marketplace installation remains the distribution route. The installed CLI tested baseline is 0.169.0.

Without activation, direct implementation patches are denied. If a shell call
changes the candidate indirectly, Stop detects the changed session baseline and
reports blocked/unverified work. Managed workers have controller-owned scoped
context so their Stop can return to the supervising verifier; reviewer worktrees
do not inherit the parent task. Deliberate operator lifecycle commands remain
trusted inputs, not a tamper-proof distinction between a human and model.

### Codex 0.169.0 package compatibility

The shipped bundle contains only `.codex-plugin/plugin.json`. A portable root
manifest takes precedence but [this release's loader](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/core-plugins/src/loader.rs#L929-L939)
skips all hooks for that format without a warning. Declaring hooks explicitly in
the portable extension does not fix it. Keep portable metadata in `plugin-src`
only; the generator excludes it from the installable bundle. Native event tests
are necessary in addition to direct handler tests.
