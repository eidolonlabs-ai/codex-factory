# Adopt the repository template

If you already have a project, the [plugin](plugin.md) adds the workflow without changing your build tooling. Choose the template if you want the factory source, project skills, and roles in your repo.

1. Clone the repo or copy it into a new Git repository and run `npm ci`. Each template worktree that runs the npm factory needs its own dependencies. When copying into an existing project, merge package scripts and project instructions with the existing files.
2. Configure schema v3 in `factory.json`. Define editable paths, trusted acceptance inputs, Compose files, the application services to wait for, and an E2E test service. Use the [Compose pilot](../examples/compose-pilot/README.md) as a reference and check the [Compose requirements](security.md). Add host checks such as type checking or unit tests as needed.
3. Create an initial Git commit if the repo has none. Run `npm run factory -- doctor --mode verify` followed by `npm run factory -- verify`. Resolve baseline failures and commit the configuration and acceptance checks. The template’s empty legacy config needs project checks before it can verify anything.
4. Follow the [task entry paths](entry-paths.md) (starting with `$factory-pipeline` or `$factory-intake` + `$factory-plan` to lock contracts and Milestone 1.5 tests before implementation). For interactive enforcement, install and trust the [plugin hooks](hooks.md).

Keep acceptance commands and their dependencies under [protected paths](solo-policy.md). The factory workflow in this repository tests the factory and its demo. Add the project's own verification command to application CI when you adopt it.
