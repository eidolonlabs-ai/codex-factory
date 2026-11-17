# Default Desktop development workflow

Open the template as a project in Codex Desktop and run `npm ci` in its terminal. Start a new chat and invoke `$coordinate-development`. Attach the intake. The coordinator delegates focused intake analysis, returns questions, records your decisions, and seeks approval for a resolved specification before implementation. Use the original ChronoGraph DOCX unchanged for the benchmark.

## Roles and permissions

Project roles: `.codex/agents/architect.toml` and `.codex/agents/reviewer.toml`. Both perform read-only work by instruction and inherit the parent's sandbox/approval settings. Select read-only permissions for the parent turn if you require OS-enforced read-only execution. Do not put unsupported sandbox overrides in role files. If the installed app does not discover a role, explicitly supply its instructions to a native subagent and record the fallback; do not claim automatic role loading worked.

Skills are shared: architect-intake, implement-task, verify-task, review-task. The coordinator composes them. Desktop implementation runs directly in the chat workspace; no CLI runner is required. Native subagents are focused helpers, not long-lived parallel code owners.

## Parallel builders

After spec approval, fill a shared task JSON and companion task card for each slice. Pin the same base commit, file ownership, acceptance criteria, dependencies, and upstream contract version. Choose independent tasks for parallel execution; serialize overlapping changes.

Start a new chat in the project, select **Worktree** below the composer, choose the approved base branch, and submit its [builder prompt](builder-prompts.md). Confirm the new checkout's base SHA and run `npm ci` in that worktree before using the shared verifier. Repeat for the next independent task. An app-created worktree can initially be detached; preserve its results using the app's branch controls when needed.

Inspect builder diffs and handoff evidence in the app. Do not direct multiple shared-workspace subagents to write parallel features. Do not start a CLI-managed worktree inside an app-managed Worktree chat.

## Integration and shared verification

Collect the reviewed builder changes in a dedicated integration Worktree from the approved base. Apply commits/patches in dependency order; resolve conflicts against the approved spec. This does not authorize merging the final target branch.

Run `npm run harness -- verify` from the integration checkout. It executes the checks in harness.json only; it does not launch Codex. Configure application tests and required browser/live checks before treating a task as accepted. Individual builder checks are insufficient for integration.

Delegate a fresh reviewer over the approved spec, task ownership/dependencies, complete combined diff, and verification evidence. Bring findings back to the main chat. Fix material issues and rerun checks. The owner sees evidence and limitations before the merge decision.

Use `docs/templates/development-state.md` for the coordinator's record. Approval is a recorded owner decision, not an agent's readiness claim.

## Hooks

No hooks are installed. Both Desktop coordination and the shared verifier work independently of hooks. If a future optional hook is added, first test a harmless hook in Desktop, document the tested app build and trust/inspection steps, and retain the manual verifier path. A CLI hook test is not Desktop hook evidence.

## Acceptance status

See [the acceptance record](desktop-acceptance.md) for actual Desktop-native observations, role-loading caveats, and unverified UI steps. Worktree UI instructions are based on [OpenAI's guide](https://learn.chatgpt.com/docs/environments/git-worktrees), not a claim that we clicked those controls on this machine.

## Shared solo workflow

The [execution-mode contract](execution-modes.md) applies equally to Desktop
and CLI. Interactive is the default; explicitly requested managed work may
launch the controller from Desktop as a separate process. Earlier UI examples
show interactive work, not a host limitation. Sequential builders are the default.
