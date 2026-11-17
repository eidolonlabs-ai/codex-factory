# Codex solo developer harness

[![Harness verification](https://github.com/theRealMarkCastillo/codex-harness-template/actions/workflows/verify.yml/badge.svg)](https://github.com/theRealMarkCastillo/codex-harness-template/actions/workflows/verify.yml)

[Use this template](https://github.com/theRealMarkCastillo/codex-harness-template/generate) to create your own repository.

An example Codex-specific repository template for moving from an ambiguous project intake to an approved task, bounded implementation, independent checks, and human review. Designed for one developer now, with task/result formats that a future queue can reuse.

The template is application-stack independent. It includes a small Python controller, Codex instructions and skills, offline tests, and the deliberately incomplete ChronoGraph intake benchmark. It does not include a built ChronoGraph application.

## Start in Codex Desktop

1. Open this repository as a project in **Codex Desktop**. Inspect its instructions and trust the project only if you approve them. Start a new chat so newly added skills and project agents can be discovered.
2. Invoke **`$coordinate-development`**, attach the original project intake, and say you want the Desktop workflow. The coordinator uses a native architect subagent for focused analysis and returns its questions to you. No CLI controller is launched.
3. Answer consequential questions and approve the resolved specification. The original ChronoGraph benchmark deliberately remains unchanged; record answers separately.
4. Have the coordinator create task cards with acceptance criteria, file ownership, dependencies, and a pinned base commit. For independent builders, start separate app chats, select **Worktree** under the composer, choose the base branch, and paste the [builder prompts](docs/builder-prompts.md).
5. Inspect each builder's diff in the app. The coordinator combines their reviewed changes in an integration worktree and runs the same project checks used everywhere:

   ```sh
   python3 -m harness verify
   ```

   This is a local verifier, **not** `codex exec` or the CLI task controller. Configure real checks in `harness.json` first; an empty check list deliberately fails.
6. Ask for a fresh native reviewer of the **integrated** candidate. Review findings and missing live/browser checks come back to the main chat before you decide whether to merge.

Native subagents handle focused analysis/review; parallel code-writing workers use separate Desktop Worktree chats. The architect and reviewer role files are under `.codex/agents/`. They instruct read-only behavior but inherit parent permissions: choose read-only permissions on the parent for an enforced read-only phase. No hook is installed or required.

See the [Desktop walkthrough](docs/desktop.md), [coordinator skill](.agents/skills/coordinate-development/SKILL.md), and [Desktop acceptance record](docs/desktop-acceptance.md). The acceptance record distinguishes observed native Desktop chat behavior from app UI steps that still require manual verification.

## ChronoGraph Desktop acceptance test

In a fresh Desktop chat, invoke the coordinator with `benchmarks/chronograph/input/original.docx`. Ask it to delegate intake to the architect with a fresh context containing only the original source and generic role/skill instructions. Keep `evaluator/` and prior results out of its context. The architect should bring consequential ambiguities back as questions and stop before implementation.

A separate evaluator scores what it caught and missed after the report is returned. See [benchmark instructions](benchmarks/chronograph/README.md). Desktop-native results and headless CLI results are recorded separately. This is an intake benchmark, not a completed ChronoGraph build.

## Shared checks and adoption

Requirements for the local verifier and tests: Python 3.11+, Git, macOS or Linux (including WSL). Day-to-day Desktop work does not require starting a CLI agent. No extra Python packages or model credentials are needed for offline harness checks.

```sh
python3 -m unittest discover -s tests -v
python3 -m harness verify --config examples/demo/harness.json
```

The demo verifies only its labeled fixture. For application work, add real checks to `harness.json`, reconcile AGENTS.md with your application, and write task JSON plus Desktop task cards. [Adoption guide](docs/adoption.md).

## Optional scripted and unattended runs

Keep the CLI runner for repeatable benchmarks, automation, and unattended tasks. These require an installed, authenticated Codex CLI:

```sh
python3 -m harness benchmark
python3 -m harness intake /absolute/path/to/spec.docx
python3 -m harness doctor
python3 -m harness run tasks/my-task.json
python3 -m harness status RUN_ID
```

The task runner assumes its operator approved the specification. It creates its own worktree, invokes Codex, runs checks independently, and collects a separate review. Default budgets are 3 total implementation attempts, 20 minutes per agent invocation, 10 minutes per check, and 90 minutes per run. These limits do not apply automatically to Desktop chats.

CLI intake and Desktop intake use the same clarification principles; implementation uses the same task contract and `harness.json` checks. An intake report never automatically dispatches a builder. [CLI operation](docs/cli.md).

## Evidence and limitations

Run artifacts live under the Git common directory at `harness/runs`, `harness/intake-runs`, and `harness/verification`. Worktrees and review snapshots are retained there for inspection. Do not delete your Git directory if you need these records. Logs may contain project data; keep them private and review before sharing. There is no automatic retention policy or automatic worktree deletion.

Protected changes to tests, harness controls, skills, schemas, CI, and benchmark fixtures stop the managed run for human review. V1 has no automatic override: implement those changes interactively and review them explicitly. Add public application unit tests outside the protected `tests/` prefix if your project needs routine worker-written tests; keep acceptance controls protected.

The controller and verification commands run as trusted host code. Worktrees, local instructions, and local evidence are not security isolation or tamper-proof attestation. Candidate hashes exclude Git-ignored files; production acceptance must not depend on an unchecked ignored artifact. See [security boundaries](docs/security.md).

[CLI](docs/cli.md) · [Desktop](docs/desktop.md) · [Adoption](docs/adoption.md) · [Compatibility](docs/compatibility.md) · [Scaling](docs/scaling.md) · [Validation report](docs/validation.md)

## License

[MIT](LICENSE), including the supplied ChronoGraph benchmark document and extracted text. This is an independent community example, not an official OpenAI product.
