# Solo protection policy

Version 1 retains every existing protected prefix. Versions 2 and 3 require explicit
`policy: { editable_paths: [...], protected_paths: [...] }`. Task allowed paths
AND policy editable paths must cover each change. Protected prefixes win.
Fixed controls: factory, factory.json, AGENTS.md, .agents, .codex, .github,
schemas, benchmarks, tsconfig.json, plugin-src, plugins, and scripts/factory. Custom protected
paths identify trusted acceptance scripts/data. Node package manifests and lock
files remain fixed protections: changing them can replace the tests invoked by
npm, so dependency changes remain reviewed interactive work in this release.
Ordinary application tests may be explicitly editable (e.g. tests/unit).

A nonempty explicit protected_paths list is required for v2/v3. It must cover the
project's trusted acceptance inputs. This is adoption policy, not automatic
proof that a command's dependency graph is sealed. The immutable in-memory
configuration and policy digest detect changes; filesystem permissions still
bound hostile processes. Reject symlink traversal in changed paths. Renames
are classified as deletion plus addition, so moving a protected file cannot
avoid detection. V1 callers and their historical behavior remain unchanged.

V2 and v3 protect package manifests, supported lockfiles, AGENTS.md, factory.json and tsconfig*.json at every depth, as well as nested .agents/.codex/.github directories. Test-runner configuration and transitive acceptance helpers must be included in the adopted protected_paths.

The policy also protects root `Dockerfile` and `.dockerignore`, plus the
Compose files listed in v3 config. Include additional build and test inputs in
`protected_paths`.
