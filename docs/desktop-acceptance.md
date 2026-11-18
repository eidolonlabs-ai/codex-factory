# Desktop acceptance record

Historical native Desktop exercise from the original implementation. The later TypeScript port changed shared command spellings below; the native app exercise has not been repeated for that port.

Date: 2026-11-16 (America/Los_Angeles). Test surface: this active Codex Desktop chat and its native subagents. App build number was not captured. CLI 0.169.0 is recorded separately and is not an app-build identifier.

## Observed in the native Desktop chat workflow

- A fresh native analysis subagent inspected the old Desktop instructions and found they routed implement-task into the CLI controller and omitted builder ownership/integration guidance.
- After the coordinator skill and Desktop task prompts were added, the same focused workflow test correctly described two separate Worktree builder chats, pinned ownership/dependencies, integrated checks, fresh review, and human merge handoff without launching the CLI controller. This is an instruction behavior test, not a click-through UI test.
- A fresh native architect read the original ChronoGraph DOCX and explicitly supplied architect role/skill instructions. It returned 14 questions, requested owner clarification, and stopped before implementation. [Intake report](../benchmarks/chronograph/results/desktop-native-intake.md).
- A fresh native reviewer read reviewer role/skill instructions, source code, the full candidate, and scope/evidence. It returned two actionable controller defects. The coordinator reproduced both with failing tests, fixed them, and ran the full passing suite. Both findings received failing regression tests before fixes.
- The shared verifier ran directly from this Desktop session with the labeled demo config. It passed without launching the CLI agent/controller. Unconfigured real project verification fails intentionally.

The role files were explicitly read by native agents because this existing projectless chat cannot prove newly created project roles were automatically discovered. Neither test claims an independently enforced role sandbox. The read-only role instructions were followed in observed work.

## Pending by user decision

The computer-use tool returned: `Computer Use is not allowed to use the app 'com.openai.codex' for safety reasons.` No alternate UI automation was attempted. The user selected **Leave UI acceptance pending for now**.

- Open the finished repository as a Desktop project and confirm automatic coordinator skill and architect/reviewer role discovery in a fresh chat.
- Observe Worktree selection and base-branch controls on the installed app build.
- Exercise two actual Desktop builder chats, inspect their diffs, and integrate them through the app workflow.
- Observe parent read-only permission selection and role behavior under that setting.

This is partial Desktop acceptance with explicit user deferral of GUI acceptance, not a claim that the entire requested app walkthrough passed. A future owner check should record app version/build and observed actions here.

## Hooks and CLI evidence

This Desktop exercise predated the hook bundle. The later [0.3 acceptance report](hooks-acceptance.md) covers native CLI dispatch. Desktop hook trust is still unverified.

Headless CLI intake and the separate one-file live implementation/review smoke test are documented in [validation](validation.md). They are not counted as Desktop UI acceptance.
