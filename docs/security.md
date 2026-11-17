# Trust and enforcement boundaries

Codex sandboxing controls Codex tool execution. Git worktrees prevent ordinary branch/file collisions but share Git metadata and credentials. Repository instructions and skills guide the model; they cannot mechanically enforce permissions.

The controller is trusted local code. Its verification commands run with the user's OS permissions and are not automatically sandboxed. Only configure reviewed commands for trusted application code. For hostile inputs/code, use a dedicated container/VM with appropriate mounts, network controls, and no production credentials.

The controller freezes the command list in memory and detects candidate changes across checks/review. This prevents common accidental weakening and stale verification. It does not make tests immutable, prevent a malicious worker from altering local artifacts, or guarantee detection of ignored-file mutations. Symlink entries are hashed as links, not dereferenced contents. External dependencies, services and data can change outside the hash.

Protected path checks run after the worker, so they detect changes rather than preventing writes. A protected edit causes a human handoff. An external CI/verifier must enforce any stronger acceptance boundary. Do not place secret holdouts in the worker repository and describe them as sealed.

Read-only intake receives only the generic architect prompt and extracted source text. The evaluator rubric is not supplied, but filesystem read access may extend beyond that workspace. Use separated environments if the benchmark requires strict blindness.

The runtime captures stdout/stderr and task prompts; they may contain sensitive project content. Artifact retention is local and manual. Never publish raw session logs without inspecting them.
