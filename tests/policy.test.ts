import test from "node:test";
import assert from "node:assert/strict";
import { parseConfig } from "../factory/models.js";
import { resolvePolicy, classifyChanges } from "../factory/policy.js";
const cfg = () =>
  parseConfig({
    schema_version: 2,
    checks: [{ name: "unit", argv: ["node", "acceptance/check.mjs"] }],
    policy: {
      editable_paths: ["src", "tests/unit"],
      protected_paths: ["acceptance"],
    },
  });
test("v1 preserves legacy protected paths", () => {
  const p = resolvePolicy(parseConfig({ schema_version: 1, checks: [] }));
  assert.match(
    classifyChanges(
      ["tests/unit/a.ts", "package.json"],
      ["tests", "package.json"],
      p,
    )
      .map((x) => x.reason)
      .join(),
    /protected/,
  );
});
test("v2 allows scoped unit tests but trusted controls always win", () => {
  const p = resolvePolicy(cfg());
  assert.deepEqual(classifyChanges(["tests/unit/a.ts"], ["tests/unit"], p), []);
  for (const path of [
    "acceptance/check.mjs",
    "factory.json",
    "package.json",
    ".codex/config.toml",
  ])
    assert.ok(classifyChanges([path], [path], p).length);
  assert.ok(classifyChanges(["src-other/a"], ["src"], p).length);
});
test("v2 rejects malformed policy and does not silently migrate v1", () => {
  assert.throws(() => parseConfig({ schema_version: 2, checks: [] }));
  for (const bad of [
    "../src",
    "src/../acceptance",
    "/tmp",
    "src\\x",
    ".git",
    "",
  ])
    assert.throws(() =>
      parseConfig({
        schema_version: 2,
        checks: [],
        policy: { editable_paths: [bad], protected_paths: ["acceptance"] },
      }),
    );
  assert.throws(() =>
    parseConfig({
      schema_version: 1,
      checks: [],
      policy: { editable_paths: ["src"], protected_paths: ["acceptance"] },
    }),
  );
});
import { repo, git, TASK } from "./helpers.js";
import { writeFileSync, mkdirSync, symlinkSync, renameSync } from "node:fs";
import { join } from "node:path";
import { scopeViolations } from "../factory/verify.js";
import { runTask } from "../factory/runner.js";
import { fake, report } from "./helpers.js";
import { taskDigest } from "../factory/readiness.js";
test("v2 protects nested manifests and compiler settings", () => {
  const p = resolvePolicy(cfg());
  p.editable_paths = ["packages"];
  for (const path of [
    "packages/web/package.json",
    "packages/web/pnpm-lock.yaml",
    "packages/web/tsconfig.build.json",
  ])
    assert.ok(
      classifyChanges([path], ["packages"], p).some((f) =>
        f.reason.includes("protected"),
      ),
    );
});
test("v2 catches renames out of protected paths and symlink destinations", (t) => {
  const r = repo(t);
  mkdirSync(join(r.path, "acceptance"));
  writeFileSync(join(r.path, "acceptance/a"), "trusted");
  git(r.path, "add", ".");
  git(r.path, "commit", "-m", "trusted");
  const base = git(r.path, "rev-parse", "HEAD");
  renameSync(join(r.path, "acceptance/a"), join(r.path, "src/stolen"));
  symlinkSync(join(r.path, "acceptance"), join(r.path, "src/link"));
  const violations = scopeViolations(
    { path: r.path, base } as never,
    ["src", "acceptance"],
    resolvePolicy(cfg()),
  );
  assert.ok(
    violations.some(
      (s) => s.includes("protected") && s.includes("acceptance/a"),
    ),
  );
  assert.ok(violations.some((s) => s.includes("symlink")));
});
test("v2 freezes policy and stops worker configuration changes", async (t) => {
  const r = repo(t);
  const config = cfg();
  const base = git(r.path, "rev-parse", "HEAD");
  const acceptance = {
    schema_version: 1 as const,
    task_sha256: taskDigest(TASK),
    base,
    unresolved_decisions: [],
    criteria: [
      { id: "sum", criterion: "Sum works", checks: ["unit"], manual: [] },
    ],
    manual_evidence: [],
  };
  const result = await runTask(
    r.path,
    TASK,
    config,
    fake(r.root, `fs.writeFileSync('factory.json','{}');${report}`),
    acceptance,
  );
  assert.equal(result.status, "failed");
  assert.match(result.reason!, /protected/);
  assert.ok(result.policy_sha256);
});
