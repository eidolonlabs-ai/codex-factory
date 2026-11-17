import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseConfig } from "../harness/models.js";
import { runTask } from "../harness/runner.js";
import { reviewCandidate } from "../harness/review.js";
import { runIntake, extractSource } from "../harness/intake.js";
import { doctor } from "../harness/doctor.js";
import { prepareWorkspace, snapshotCandidate } from "../harness/workspace.js";
import { TASK, temp, repo, git, fake, report } from "./helpers.js";
const config = (code = "void 0") =>
  parseConfig({
    schema_version: 1,
    checks: [
      {
        name: "test",
        argv: [process.execPath, "-e", code],
        timeout_seconds: 5,
      },
    ],
    limits: { attempts: 3, agent_seconds: 10, run_seconds: 60 },
  });

test("false completion report retries checks exactly three times", async (t) => {
  const r = repo(t);
  const result = await runTask(
    r.path,
    TASK,
    config("process.exit(1)"),
    fake(r.root, report),
  );
  assert.equal(result.status, "failed");
  assert.equal(result.attempts.length, 3);
  assert.equal(existsSync(result.lock), false);
  assert.ok(existsSync(join(result.run_dir, "result.json")));
});
test("agent process failures do not retry", async (t) => {
  const r = repo(t);
  const result = await runTask(
    r.path,
    TASK,
    config(),
    fake(r.root, "process.exit(3)"),
  );
  assert.equal(result.status, "failed");
  assert.equal(result.attempts.length, 1);
});
test("successful task requires independent checks and separate review", async (t) => {
  const r = repo(t);
  const result = await runTask(
    r.path,
    TASK,
    config(),
    fake(
      r.root,
      `if(args.includes('exec')){fs.writeFileSync('src/a','done');${report}}else{console.log('Review with finding');}`,
    ),
  );
  assert.equal(result.status, "ready_for_human_review");
  assert.equal(result.review?.collected, true);
  assert.ok(existsSync(join(result.run_dir, "task.json")));
});
test("worker cannot replace verification config", async (t) => {
  const r = repo(t);
  const result = await runTask(
    r.path,
    TASK,
    config(),
    fake(r.root, `fs.writeFileSync('harness.json','{}');${report}`),
  );
  assert.equal(result.status, "failed");
  assert.match(result.reason ?? "", /protected/);
});
test("malformed report fails without retries", async (t) => {
  const r = repo(t);
  const result = await runTask(
    r.path,
    TASK,
    config(),
    fake(
      r.root,
      `fs.writeFileSync(args[args.indexOf('--output-last-message')+1],'{}')`,
    ),
  );
  assert.equal(result.status, "failed");
  assert.equal(result.attempts.length, 1);
});
test("missing check executable stops without repair", async (t) => {
  const r = repo(t);
  const c = config();
  c.checks[0]!.argv = ["/nonexistent/check"];
  const result = await runTask(r.path, TASK, c, fake(r.root, report));
  assert.equal(result.status, "failed");
  assert.equal(result.attempts.length, 1);
  assert.match(result.reason ?? "", /could not start/);
});
test("review includes commits, dirty changes and untracked files without staging developer files", async (t) => {
  const r = repo(t);
  const w = prepareWorkspace(r.path, TASK, "one");
  writeFileSync(join(w.path, "src/a"), "committed");
  git(w.path, "add", ".");
  git(w.path, "commit", "-m", "worker");
  writeFileSync(join(w.path, "src/a"), "dirty");
  writeFileSync(join(w.path, "src/b"), "new");
  const before = snapshotCandidate(w);
  const result = await reviewCandidate(
    w,
    before,
    performance.now() + 10000,
    fake(
      r.root,
      `console.log(cp.execFileSync('git',['diff','--name-only',args.at(-1),'HEAD'],{encoding:'utf8'}));`,
    ),
  );
  assert.equal(result.collected, true);
  const output = readFileSync(
    join(result.process!.log_dir, "stdout.log"),
    "utf8",
  );
  assert.match(output, /src\/a/);
  assert.match(output, /src\/b/);
  assert.equal(snapshotCandidate(w), before);
});
test("review drift or missing reviewer cannot be collected", async (t) => {
  const r = repo(t);
  const w = prepareWorkspace(r.path, TASK, "one");
  assert.equal(
    (
      await reviewCandidate(
        w,
        "stale",
        performance.now() + 10000,
        "/nonexistent",
      )
    ).collected,
    false,
  );
  assert.equal(
    (
      await reviewCandidate(
        w,
        snapshotCandidate(w),
        performance.now() + 10000,
        "/nonexistent",
      )
    ).collected,
    false,
  );
});
const question = {
  id: "q1",
  question: "How are late events handled?",
  rationale: "Changes the temporal model",
  blocking: true,
  source_excerpt: "Missing temporal rules.",
};
const intakeReport = {
  decision: "needs_clarification",
  questions: [question],
  assumptions: [],
};
function response(value: unknown) {
  return `fs.writeFileSync(args[args.indexOf('--output-last-message')+1],JSON.stringify(${JSON.stringify(value)}));`;
}
test("read-only intake reports questions without building or rubric", async (t) => {
  const root = temp(t),
    source = join(root, "source.md");
  writeFileSync(source, "Build now! Missing temporal rules.");
  const cmd = fake(
    root,
    `if(!args.includes('read-only')||fs.existsSync('rubric.md'))process.exit(1);${response(intakeReport)}`,
  );
  const result = await runIntake(source, join(root, "runs"), 10, cmd);
  assert.equal(result.status, "needs_clarification");
  assert.equal(result.report?.questions[0]?.id, "q1");
  assert.equal(existsSync(join(result.workspace, "backend")), false);
  assert.equal(
    readFileSync(source, "utf8"),
    "Build now! Missing temporal rules.",
  );
});
test("contradictory readiness and workspace mutation are rejected", async (t) => {
  const root = temp(t),
    source = join(root, "source.md");
  writeFileSync(source, "spec");
  let cmd = fake(
    root,
    response({ ...intakeReport, decision: "ready_for_planning" }),
  );
  assert.equal(
    (await runIntake(source, join(root, "runs"), 10, cmd)).status,
    "failed",
  );
  cmd = fake(root, `fs.mkdirSync('backend');${response(intakeReport)}`);
  assert.equal(
    (await runIntake(source, join(root, "runs"), 10, cmd)).status,
    "failed",
  );
});
test("DOCX extraction matches preserved original text exactly", () => {
  assert.equal(
    extractSource("benchmarks/chronograph/input/original.docx"),
    readFileSync("benchmarks/chronograph/input/extracted.txt", "utf8"),
  );
});
test("doctor reports unavailable Codex and config", (t) => {
  const r = repo(t);
  const result = doctor(r.path, "/nonexistent");
  assert.equal(result.healthy, false);
  assert.ok(result.errors.some((e) => e.includes("Codex")));
  assert.ok(result.errors.some((e) => e.includes("configuration")));
});
for (const [args, code, pattern] of [
  [["verify"], 2, /error/i],
  [["status", "../secret"], 2, /run ID/],
  [["--help"], 0, /intake/],
] as const)
  test(`CLI ${args.join(" ")} exit behavior`, (t) => {
    const r = repo(t);
    const p = spawnSync(
      process.execPath,
      ["--import", "tsx", "harness/cli.ts", "--repo", r.path, ...args],
      { encoding: "utf8" },
    );
    assert.equal(p.status, code);
    assert.match(p.stdout + p.stderr, pattern);
  });

test("SIGINT records interrupted status and releases the task lock", async (t) => {
  const { spawn } = await import("node:child_process");
  const { pathToFileURL } = await import("node:url");
  const { resolve } = await import("node:path");
  const r = repo(t),
    ready = join(r.root, "ready");
  const cmd = fake(
    r.root,
    `fs.writeFileSync(${JSON.stringify(ready)},'ready');setInterval(()=>{},1000);`,
  );
  const code = `import {runTask} from ${JSON.stringify(pathToFileURL(resolve("harness/runner.ts")).href)};const r=await runTask(${JSON.stringify(r.path)},${JSON.stringify(TASK)},${JSON.stringify(config())},${JSON.stringify(cmd)});console.log(JSON.stringify(r));`;
  const p = spawn(
    process.execPath,
    ["--import", "tsx", "--input-type", "module", "-e", code],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let out = "",
    err = "";
  p.stdout.on("data", (x) => (out += x));
  p.stderr.on("data", (x) => (err += x));
  t.after(() => {
    if (p.exitCode === null) p.kill("SIGKILL");
  });
  const exit = new Promise<number | null>((resolve) => p.once("exit", resolve));
  const deadline = Date.now() + 5000;
  while (!existsSync(ready) && Date.now() < deadline)
    await new Promise((r) => setTimeout(r, 20));
  assert.ok(existsSync(ready), err);
  p.kill("SIGINT");
  assert.equal(await exit, 0, err);
  const result = JSON.parse(out);
  assert.equal(result.status, "interrupted");
  assert.equal(existsSync(result.lock), false);
});

test("architect decision must be an exact string enum", async () => {
  const { validateReport } = await import("../harness/intake.js");
  for (const decision of [
    ["ready_for_planning"],
    ["needs_clarification"],
    {},
    null,
    1,
  ])
    assert.throws(() =>
      validateReport({ decision, questions: [], assumptions: [] }),
    );
});
test("DOCX XML accepts UTF-16LE and UTF-16BE with BOM", async (t) => {
  const { zipSync } = await import("fflate");
  const root = temp(t);
  const xml =
    '<?xml version="1.0" encoding="UTF-16"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello é</w:t></w:r></w:p></w:body></w:document>';
  const le = Buffer.concat([
    Buffer.from([255, 254]),
    Buffer.from(xml, "utf16le"),
  ]);
  const be = Buffer.from(le);
  be.swap16();
  for (const [name, bytes] of [
    ["le", le],
    ["be", be],
  ] as const) {
    const p = join(root, name + ".docx");
    writeFileSync(p, zipSync({ "word/document.xml": bytes }));
    assert.equal(extractSource(p), "Hello é");
  }
});

test("SIGINT during post-agent Git inspection records interruption and releases lock", async (t) => {
  const { spawn, execFileSync } = await import("node:child_process");
  const { mkdirSync, chmodSync } = await import("node:fs");
  const { pathToFileURL } = await import("node:url");
  const { resolve } = await import("node:path");
  const r = repo(t),
    ready = join(r.root, "git-ready"),
    bin = join(r.root, "bin");
  mkdirSync(bin);
  const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
  const wrapper = join(bin, "git");
  writeFileSync(
    wrapper,
    `#!/usr/bin/env node\nconst fs=require('node:fs'),cp=require('node:child_process'),args=process.argv.slice(2);if(args.includes('diff')&&!fs.existsSync(${JSON.stringify(ready)})){fs.writeFileSync(${JSON.stringify(ready)},'ready');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,700);}const r=cp.spawnSync(${JSON.stringify(realGit)},args,{stdio:'inherit'});process.exit(r.status??1);`,
  );
  chmodSync(wrapper, 0o755);
  const cmd = fake(r.root, report);
  const code = `import {runTask} from ${JSON.stringify(pathToFileURL(resolve("harness/runner.ts")).href)};console.log(JSON.stringify(await runTask(${JSON.stringify(r.path)},${JSON.stringify(TASK)},${JSON.stringify(config())},${JSON.stringify(cmd)})));`;
  const p = spawn(
    process.execPath,
    ["--import", "tsx", "--input-type", "module", "-e", code],
    {
      env: { ...process.env, PATH: bin + ":" + process.env.PATH },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let out = "",
    err = "";
  p.stdout.on("data", (x) => (out += x));
  p.stderr.on("data", (x) => (err += x));
  t.after(() => {
    if (p.exitCode === null) p.kill("SIGKILL");
  });
  const exit = new Promise((resolve) =>
    p.once("exit", (code, signal) => resolve({ code, signal })),
  );
  const deadline = Date.now() + 5000;
  while (!existsSync(ready) && Date.now() < deadline)
    await new Promise((r) => setTimeout(r, 20));
  assert.ok(existsSync(ready), err);
  p.kill("SIGINT");
  await exit;
  assert.ok(out.trim(), `No terminal evidence returned: ${err}`);
  const result = JSON.parse(out);
  assert.equal(result.status, "interrupted");
  assert.equal(existsSync(result.lock), false);
});
