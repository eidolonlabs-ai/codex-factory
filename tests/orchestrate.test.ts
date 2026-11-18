import test from "node:test";
import assert from "node:assert/strict";
import { parsePlan } from "../factory/orchestrate.js";
import { TASK } from "./helpers.js";
import { taskDigest } from "../factory/readiness.js";
const node = (id: string, paths: string[], deps: string[]) => {
  const task = { ...TASK, id, allowed_paths: paths };
  return {
    task,
    depends_on: deps,
    acceptance: {
      schema_version: 1,
      task_sha256: taskDigest(task),
      base: "a".repeat(40),
      unresolved_decisions: [],
      criteria: [
        {
          id: "one",
          criterion: task.acceptance_criteria[0],
          checks: ["compose:e2e"],
          manual: [],
        },
      ],
      manual_evidence: [],
    },
  };
};
const root = node("whole", ["src"], []);
const plan = (nodes: unknown[]) => ({
  schema_version: 1,
  task: root.task,
  acceptance: root.acceptance,
  concurrency: 2,
  nodes,
});
test("orchestration validates DAG ownership and dependency contracts", () => {
  assert.equal(
    parsePlan(plan([node("one", ["src/a"], []), node("two", ["src/b"], [])]))
      .nodes.length,
    2,
  );
  assert.throws(
    () =>
      parsePlan(plan([node("one", ["src"], []), node("two", ["src/b"], [])])),
    /Overlapping/,
  );
  assert.doesNotThrow(() =>
    parsePlan(
      plan([node("one", ["src"], []), node("two", ["src/b"], ["one"])]),
    ),
  );
  assert.throws(
    () =>
      parsePlan(
        plan([
          node("one", ["src/a"], ["two"]),
          node("two", ["src/b"], ["one"]),
        ]),
      ),
    /cycle/,
  );
  assert.throws(() => parsePlan(plan([node("one", ["outside"], [])])), /scope/);
  assert.throws(
    () => parsePlan(plan([node("one", ["src"], ["missing"])])),
    /dependency/,
  );
});

import { repo, git, fake } from "./helpers.js";
import { mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { orchestrate } from "../factory/orchestrate.js";
import { parseConfig } from "../factory/models.js";
import { storage } from "../factory/workspace.js";
for (const locked of [false, true])
  test(`local graph integration and settled sibling evidence (locked=${locked})`, async (t) => {
    const r = repo(t);
    writeFileSync(join(r.path, "compose.yaml"), "services: {}");
    const cfg = parseConfig({
      schema_version: 3,
      checks: [],
      policy: { editable_paths: ["src"], protected_paths: ["acceptance"] },
      compose: {
        files: ["compose.yaml"],
        services: ["api"],
        test_service: "e2e",
      },
      limits: { run_seconds: 60, agent_seconds: 10 },
    });
    writeFileSync(join(r.path, "factory.json"), JSON.stringify(cfg));
    git(r.path, "add", ".");
    git(r.path, "commit", "-m", "config");
    const base = git(r.path, "rev-parse", "HEAD");
    const p = plan([node("one", ["src/a"], []), node("two", ["src/b"], [])]);
    p.acceptance.base = base;
    for (const n of p.nodes as ReturnType<typeof node>[])
      n.acceptance.base = base;
    const parsed = parsePlan(p);
    const bin = join(r.root, "bin");
    mkdirSync(bin);
    const dockerDir = join(r.root, "docker");
    mkdirSync(dockerDir);
    symlinkSync(
      fake(
        dockerDir,
        `if(args.includes('config'))console.log(JSON.stringify({services:{api:{healthcheck:{test:['CMD','true']}},e2e:{}}}));`,
      ),
      join(bin, "docker"),
    );
    const old = process.env.PATH;
    process.env.PATH = bin + ":" + old;
    t.after(() => {
      process.env.PATH = old;
    });
    const codexDir = join(r.root, "codex");
    mkdirSync(codexDir);
    const codex = fake(
      codexDir,
      `let text='';process.stdin.on('data',b=>text+=b);process.stdin.on('end',()=>{const output=args[args.indexOf('--output-last-message')+1];if(args.includes('--json')){const task=JSON.parse(text.split('TASK DATA:\\n')[1].split('\\nADOPTED POLICY:')[0]);fs.writeFileSync(task.allowed_paths[0],'implemented');fs.writeFileSync(output,JSON.stringify({summary:'implemented',completed:true}));}else fs.writeFileSync(output,'No findings in test fixture');});`,
    );
    if (locked) {
      mkdirSync(join(storage(r.path), "locks"), { recursive: true });
      writeFileSync(join(storage(r.path), "locks/one"), "existing owner");
    }
    const result = await orchestrate(r.path, parsed, cfg, codex);
    assert.equal(
      result.status,
      locked ? "blocked" : "ready_for_human_review",
      result.reason,
    );
    assert.equal(result.workers.length, locked ? 1 : 2);
    assert.equal(
      git(r.path, "rev-parse", "HEAD"),
      base,
      "original branch unchanged",
    );
    if (!locked) {
      assert.match(git(result.workspace, "show", "HEAD:src/a"), /implemented/);
      assert.match(git(result.workspace, "show", "HEAD:src/b"), /implemented/);
    }
  });
