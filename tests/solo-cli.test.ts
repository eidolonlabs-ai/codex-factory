import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { repo, git, TASK } from "./helpers.js";
import { taskDigest } from "../harness/readiness.js";
const cli = resolve("harness/cli.ts");
const call = (path: string, args: string[]) =>
  spawnSync(
    process.execPath,
    [
      "--import",
      resolve("node_modules/tsx/dist/loader.mjs"),
      cli,
      ...args,
      "--repo",
      path,
    ],
    { encoding: "utf8", timeout: 15000 },
  );
test("CLI prepares and preflights records, persists verification and rejects stale bases", (t) => {
  const r = repo(t);
  writeFileSync(
    join(r.path, "harness.json"),
    JSON.stringify({
      schema_version: 1,
      checks: [
        {
          name: "unit",
          argv: [process.execPath, "-e", "if (1+1!==2) process.exit(1)"],
        },
      ],
    }),
  );
  const taskPath = join(r.root, "task.json"),
    acceptancePath = join(r.root, "acceptance.json");
  writeFileSync(taskPath, JSON.stringify(TASK));
  let result = call(r.path, ["prepare", taskPath]);
  assert.equal(result.status, 0, result.stderr);
  const a = JSON.parse(result.stdout);
  assert.equal(a.task_sha256, taskDigest(TASK));
  assert.ok(a.unresolved_decisions.length);
  a.unresolved_decisions = [];
  writeFileSync(acceptancePath, JSON.stringify(a));
  result = call(r.path, [
    "preflight",
    taskPath,
    "--acceptance",
    acceptancePath,
  ]);
  assert.equal(result.status, 0, result.stderr);
  result = call(r.path, [
    "verify",
    "--task",
    taskPath,
    "--acceptance",
    acceptancePath,
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /protected/);
  git(r.path, "add", ".");
  git(r.path, "commit", "-m", "configure");
  result = call(r.path, [
    "preflight",
    taskPath,
    "--acceptance",
    acceptancePath,
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /base changed/);
  a.base = git(r.path, "rev-parse", "HEAD");
  writeFileSync(acceptancePath, JSON.stringify(a));
  result = call(r.path, [
    "verify",
    "--task",
    taskPath,
    "--acceptance",
    acceptancePath,
  ]);
  assert.equal(result.status, 0, result.stderr);
  const v = JSON.parse(result.stdout);
  assert.equal(
    JSON.parse(readFileSync(join(v.run_dir, "result.json"), "utf8")).candidate,
    v.candidate,
  );
  assert.ok(v.policy_sha256);
});
test("doctor verify mode does not require clean project or authenticated Codex", (t) => {
  const r = repo(t);
  writeFileSync(
    join(r.path, "harness.json"),
    JSON.stringify({
      schema_version: 1,
      checks: [{ name: "unit", argv: ["node", "check.mjs"] }],
    }),
  );
  const result = call(r.path, ["doctor", "--mode", "verify"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).authentication, "not tested");
});
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, symlinkSync } from "node:fs";
import { fake } from "./helpers.js";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
test("interrupting interactive review persists interrupted status and missing-review handoff", async (t) => {
  const r = repo(t);
  writeFileSync(
    join(r.path, "harness.json"),
    JSON.stringify({
      schema_version: 1,
      checks: [{ name: "unit", argv: [process.execPath, "-e", "void 0"] }],
    }),
  );
  git(r.path, "add", ".");
  git(r.path, "commit", "-m", "checks");
  const task = join(r.root, "task.json");
  writeFileSync(task, JSON.stringify(TASK));
  const bin = join(r.root, "bin");
  mkdirSync(bin);
  const marker = join(r.root, "review-started");
  symlinkSync(
    fake(
      r.root,
      `fs.writeFileSync(${JSON.stringify(marker)},'started');setInterval(()=>{},100);`,
    ),
    join(bin, "codex"),
  );
  const child = spawn(
    process.execPath,
    [
      "--import",
      resolve("node_modules/tsx/dist/loader.mjs"),
      cli,
      "review",
      "--task",
      task,
      "--repo",
      r.path,
    ],
    {
      env: { ...process.env, PATH: bin + ":" + process.env.PATH },
      stdio: "ignore",
    },
  );
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  });
  const ended = once(child, "exit");
  for (let i = 0; i < 200 && !existsSync(marker); i++) await delay(25);
  assert.ok(existsSync(marker), "review process started");
  child.kill("SIGINT");
  await ended;
  const dir = join(r.path, ".git/harness/verification");
  const id = readdirSync(dir)[0]!;
  const result = JSON.parse(readFileSync(join(dir, id, "result.json"), "utf8"));
  assert.equal(result.status, "interrupted");
  const handoff = call(r.path, ["handoff", id]);
  assert.match(handoff.stdout, /review.*not.*collected|Review.*missing/i);
});

test("CLI disposition accepts complete current evidence and rejects missing evidence or drift", (t) => {
  const r = repo(t);
  writeFileSync(
    join(r.path, "harness.json"),
    JSON.stringify({
      schema_version: 1,
      checks: [{ name: "unit", argv: [process.execPath, "-e", "void 0"] }],
    }),
  );
  git(r.path, "add", ".");
  git(r.path, "commit", "-m", "checks");
  const task = join(r.root, "task.json"),
    acceptance = join(r.root, "acceptance.json"),
    disposition = join(r.root, "disposition.json");
  writeFileSync(task, JSON.stringify(TASK));
  const a = JSON.parse(call(r.path, ["prepare", task]).stdout);
  a.unresolved_decisions = [];
  a.criteria[0].manual = ["Observe UI"];
  writeFileSync(acceptance, JSON.stringify(a));
  const bin = join(r.root, "bin");
  mkdirSync(bin);
  symlinkSync(
    fake(
      r.root,
      `process.stdin.resume();process.stdin.on('end',()=>fs.writeFileSync(args[args.indexOf('--output-last-message')+1],'No findings.'));`,
    ),
    join(bin, "codex"),
  );
  const review = () =>
    spawnSync(
      process.execPath,
      [
        "--import",
        resolve("node_modules/tsx/dist/loader.mjs"),
        cli,
        "review",
        "--task",
        task,
        "--acceptance",
        acceptance,
        "--repo",
        r.path,
      ],
      {
        encoding: "utf8",
        timeout: 15000,
        env: { ...process.env, PATH: bin + ":" + process.env.PATH },
      },
    );
  let result = review();
  assert.equal(result.status, 1, result.stderr);
  let record = JSON.parse(result.stdout);
  writeFileSync(
    disposition,
    JSON.stringify({
      candidate: record.candidate,
      decision: "accepted",
      note: "Test owner decision",
    }),
  );
  result = call(r.path, ["disposition", record.run_id, "--file", disposition]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /evidence still missing/);
  a.manual_evidence = [
    {
      criterion_id: a.criteria[0].id,
      requirement: "Observe UI",
      candidate: record.candidate,
      note: "Test fixture observation",
    },
  ];
  writeFileSync(acceptance, JSON.stringify(a));
  result = review();
  assert.equal(result.status, 0, result.stderr);
  record = JSON.parse(result.stdout);
  result = call(r.path, ["disposition", record.run_id, "--file", disposition]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    JSON.parse(result.stdout).review.disposition.decision,
    "accepted",
  );
  writeFileSync(join(r.path, "src/a"), "changed after review");
  result = call(r.path, ["disposition", record.run_id, "--file", disposition]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Candidate changed/);
});
