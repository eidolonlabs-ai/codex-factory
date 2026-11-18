import test from "node:test";
import assert from "node:assert/strict";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  chmodSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { parseTask, parseConfig } from "../factory/models.js";
import {
  prepareWorkspace,
  releaseWorkspace,
  snapshotCandidate,
  changedPaths,
} from "../factory/workspace.js";
import { runProcess } from "../factory/process.js";
import { verify, scopeViolations } from "../factory/verify.js";
import { writeResult } from "../factory/evidence.js";
import { TASK, temp, repo, git } from "./helpers.js";
const node = (code: string) => [process.execPath, "-e", code];

test("task validation and configuration defaults", () => {
  assert.equal(parseTask(TASK).id, "demo");
  assert.equal(
    parseConfig({ schema_version: 1, checks: [] }).limits.attempts,
    3,
  );
});
test("reject unsafe, unknown, incomplete task values", () => {
  for (const patch of [
    { id: "../bad" },
    { id: "$(bad)" },
    { base_ref: "--help" },
    { allowed_paths: ["../outside"] },
    { allowed_paths: ["/tmp"] },
    { allowed_paths: ["."] },
    { allowed_paths: ["a\\b"] },
    { acceptance_criteria: [] },
    { extra: true },
    { schema_version: true },
  ])
    assert.throws(() => parseTask({ ...TASK, ...patch }));
});
test("reject invalid configuration", () => {
  const c = { name: "test", argv: ["node", "-v"], timeout_seconds: 10 };
  for (const patch of [
    { checks: [c, c] },
    { checks: [{ ...c, argv: [] }] },
    { limits: { attempts: true } },
    { limits: { run_seconds: 0 } },
    { limits: { attempts: 1.5 } },
    { limits: { unknown: 3 } },
    { unknown: true },
  ])
    assert.throws(() =>
      parseConfig({ schema_version: 1, checks: [], ...patch }),
    );
});
test("worktree isolates files and locks same task", (t) => {
  const r = repo(t);
  const w = prepareWorkspace(r.path, TASK, "one");
  t.after(() => releaseWorkspace(w));
  assert.throws(() => prepareWorkspace(r.path, TASK, "two"), /locked/);
  writeFileSync(join(w.path, "src/a"), "changed");
  assert.equal(readFileSync(join(r.path, "src/a"), "utf8"), "base");
});
test("dirty and unborn repositories are rejected", (t) => {
  const r = repo(t);
  writeFileSync(join(r.path, "untracked"), "keep");
  assert.throws(() => prepareWorkspace(r.path, TASK, "one"));
  const unborn = join(r.root, "unborn");
  mkdirSync(unborn);
  git(unborn, "init");
  assert.throws(() => prepareWorkspace(unborn, TASK, "zero"));
});
test("linked worktrees share common storage", (t) => {
  const r = repo(t);
  const w = prepareWorkspace(r.path, TASK, "one");
  const other = prepareWorkspace(w.path, { ...TASK, id: "other" }, "two");
  t.after(() => {
    releaseWorkspace(w);
    releaseWorkspace(other);
  });
  assert.equal(join(w.run_dir, ".."), join(other.run_dir, ".."));
});
test("snapshot covers worker commits, dirty data, filenames and modes", (t) => {
  const r = repo(t);
  const w = prepareWorkspace(r.path, TASK, "one");
  const before = snapshotCandidate(w);
  writeFileSync(join(w.path, "src/a"), "committed");
  git(w.path, "add", ".");
  git(w.path, "commit", "-m", "worker");
  writeFileSync(join(w.path, "new"), "new");
  assert.notEqual(snapshotCandidate(w), before);
  assert.deepEqual(new Set(changedPaths(w)), new Set(["src/a", "new"]));
  const mode = snapshotCandidate(w);
  chmodSync(join(w.path, "new"), 0o755);
  assert.notEqual(snapshotCandidate(w), mode);
});
test("newline-prefixed filenames retain content in snapshots", (t) => {
  const r = repo(t);
  const w = prepareWorkspace(r.path, TASK, "one");
  const p = join(w.path, "\nfile");
  writeFileSync(p, "one");
  const before = snapshotCandidate(w);
  assert.ok(changedPaths(w).includes("\nfile"));
  writeFileSync(p, "two");
  assert.notEqual(snapshotCandidate(w), before);
});
test("argv is literal, nonzero exits preserved", async (t) => {
  const p = temp(t);
  const r = await runProcess(
    [...node("console.log(process.argv[1]); process.exit(7)"), "$(touch BAD)"],
    p,
    3,
    join(p, "logs"),
  );
  assert.equal(r.returncode, 7);
  assert.equal(
    readFileSync(join(p, "logs/stdout.log"), "utf8").trim(),
    "$(touch BAD)",
  );
  assert.equal(existsSync(join(p, "BAD")), false);
});
test("launch failure is distinct from a child exiting 127", async (t) => {
  const p = temp(t);
  const r = await runProcess(["/nonexistent/codex"], p, 1, join(p, "missing"));
  assert.ok(r.launch_error);
  const exit = await runProcess(
    node("process.exit(127)"),
    p,
    1,
    join(p, "exit"),
  );
  assert.equal(exit.returncode, 127);
  assert.equal(exit.launch_error, null);
});
for (const success of [false, true])
  test(`cleanup kills descendants after ${success ? "parent success" : "timeout"}`, async (t) => {
    const p = temp(t);
    const child = `setTimeout(()=>require('node:fs').writeFileSync('BAD','bad'),1400)`;
    const code = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(child)}],{stdio:'ignore'});${success ? "process.exit(0)" : "setTimeout(()=>{},10000)"}`;
    const r = await runProcess(
      node(code),
      p,
      success ? 3 : 0.15,
      join(p, "logs"),
    );
    assert.equal(r.timed_out, !success);
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(existsSync(join(p, "BAD")), false);
  });
test("atomic evidence survives serialization failure", (t) => {
  const p = temp(t);
  writeResult(p, { status: "running" });
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.throws(() => writeResult(p, circular));
  assert.deepEqual(JSON.parse(readFileSync(join(p, "result.json"), "utf8")), {
    status: "running",
  });
  assert.deepEqual(readdirSync(p), ["result.json"]);
});
test("empty checks fail closed", async (t) => {
  const r = repo(t);
  const w = prepareWorkspace(r.path, TASK, "one");
  const v = await verify(w, [], performance.now() + 5000);
  assert.equal(v.passed, false);
  assert.equal(v.reason, "No project checks configured");
});
test("verification failures, timeouts and candidate mutation cannot pass", async (t) => {
  const r = repo(t);
  const w = prepareWorkspace(r.path, TASK, "one");
  const check = (code: string) => [
    { name: "test", argv: node(code), timeout_seconds: 5 },
  ];
  assert.equal(
    (await verify(w, check("process.exit(3)"), performance.now() + 5000))
      .checks[0]?.returncode,
    3,
  );
  assert.equal(
    (
      await verify(
        w,
        check("require('node:fs').writeFileSync('src/a','changed')"),
        performance.now() + 5000,
      )
    ).passed,
    false,
  );
  assert.equal(
    (
      await verify(
        w,
        check("setTimeout(()=>{},10000)"),
        performance.now() + 100,
      )
    ).checks[0]?.timed_out,
    true,
  );
});
test("scope is a path prefix and protected edits stop", (t) => {
  const r = repo(t);
  const w = prepareWorkspace(r.path, TASK, "one");
  writeFileSync(join(w.path, "src-evil"), "bad");
  writeFileSync(join(w.path, "AGENTS.md"), "bad");
  const issues = scopeViolations(w, ["src", "AGENTS.md"]);
  assert.ok(issues.some((x) => x.includes("src-evil")));
  assert.ok(issues.some((x) => x.includes("protected")));
});

test("timeout kills a process that ignores SIGTERM", async (t) => {
  const p = temp(t);
  const r = await runProcess(
    node("process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"),
    p,
    0.25,
    join(p, "logs"),
  );
  assert.equal(r.timed_out, true);
  assert.notEqual(r.returncode, 0);
  assert.ok(r.duration_seconds < 3);
});

test("signal evidence preserves negative POSIX return codes", async (t) => {
  const { constants } = await import("node:os");
  const p = temp(t);
  for (const signal of ["SIGTERM", "SIGKILL", "SIGUSR2"] as const) {
    const r = await runProcess(
      node(`process.kill(process.pid,'${signal}')`),
      p,
      3,
      join(p, signal),
    );
    assert.equal(r.returncode, -constants.signals[signal]);
  }
});

test("explicit null limits and newline task IDs are rejected", () => {
  assert.throws(() =>
    parseConfig({ schema_version: 1, checks: [], limits: null }),
  );
  assert.throws(() => parseTask({ ...TASK, id: "demo\n" }));
});
