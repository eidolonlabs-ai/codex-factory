import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repo, git, fake } from "./helpers.js";
import { parseConfig } from "../factory/models.js";
import { verifyProject } from "../factory/compose.js";
const config = () =>
  parseConfig({
    schema_version: 3,
    checks: [],
    policy: { editable_paths: ["src"], protected_paths: ["acceptance"] },
    compose: {
      files: ["compose.yaml"],
      services: ["api"],
      test_service: "e2e",
      timeout_seconds: 5,
    },
  });
for (const mode of [
  "pass",
  "test-failure",
  "up-failure",
  "unsafe",
  "missing-docker",
  "host-volume",
  "shared-image",
]) {
  test(`Compose gate ${mode} retains evidence and owns cleanup`, async (t) => {
    const r = repo(t);
    writeFileSync(join(r.path, "compose.yaml"), "services: {}\n");
    git(r.path, "add", ".");
    git(r.path, "commit", "-m", "compose");
    const calls = join(r.root, "calls.jsonl");
    const docker =
      mode === "missing-docker"
        ? join(r.root, "missing")
        : fake(
            r.root,
            `fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify(args)+'\\n');
if(args.includes('config'))console.log(JSON.stringify({services:{api:{healthcheck:{test:['CMD','true']}${mode === "unsafe" ? ",privileged:true" : mode === "shared-image" ? ",build:{context:'.'},image:'shared:latest'" : ""}},e2e:{}},networks:{},volumes:${mode === "host-volume" ? "{data:{driver_opts:{type:'none',o:'bind',device:'/tmp/shared'}}}" : "{}"}}));
if(${JSON.stringify(mode)}==='test-failure'&&args.includes('run'))process.exit(1);
if(${JSON.stringify(mode)}==='up-failure'&&args.includes('up'))process.exit(1);`,
          );
    const v = await verifyProject(
      {
        path: r.path,
        base: git(r.path, "rev-parse", "HEAD"),
        run_dir: join(r.root, "evidence"),
        branch: "",
        lock: "",
      },
      config(),
      performance.now() + 15000,
      docker,
    );
    assert.equal(v.passed, mode === "pass", v.reason);
    if (mode !== "missing-docker") {
      const callsList = readFileSync(calls, "utf8")
        .trim()
        .split("\n")
        .map((x) => JSON.parse(x) as string[]);
      assert.equal(
        callsList.some((a) => a.includes("down")),
        ["pass", "test-failure", "up-failure"].includes(mode),
      );
      for (const a of callsList.filter(
        (a) => a[0] === "compose" && a.includes("--project-name"),
      ))
        assert.match(
          a[a.indexOf("--project-name") + 1]!,
          /^factory-[a-f0-9]{32}$/,
        );
      assert.ok(!callsList.some((a) => a.includes("prune")));
    }
  });
}
test("v3 requires Compose while legacy configs stay explicit", () => {
  assert.throws(() =>
    parseConfig({
      schema_version: 3,
      checks: [],
      policy: { editable_paths: ["src"], protected_paths: ["acceptance"] },
    }),
  );
  assert.throws(() =>
    parseConfig({
      schema_version: 2,
      checks: [],
      policy: { editable_paths: ["src"], protected_paths: ["acceptance"] },
      compose: {},
    }),
  );
  assert.equal(config().schema_version, 3);
});

test("Compose interruption cleans owned resources and propagates cancellation", async (t) => {
  const r = repo(t);
  writeFileSync(join(r.path, "compose.yaml"), "services: {}");
  git(r.path, "add", ".");
  git(r.path, "commit", "-m", "compose");
  const { existsSync } = await import("node:fs");
  const { setTimeout: delay } = await import("node:timers/promises");
  const marker = join(r.root, "started"),
    cleaned = join(r.root, "cleaned");
  const docker = fake(
    r.root,
    `if(args.includes('config'))console.log(JSON.stringify({services:{api:{healthcheck:{test:['CMD','true']}},e2e:{}}}));if(args.includes('up')){fs.writeFileSync(${JSON.stringify(marker)},'yes');setInterval(()=>{},100);}if(args.includes('down'))fs.writeFileSync(${JSON.stringify(cleaned)},'yes');`,
  );
  const running = verifyProject(
    {
      path: r.path,
      base: git(r.path, "rev-parse", "HEAD"),
      run_dir: join(r.root, "evidence"),
      branch: "",
      lock: "",
    },
    config(),
    performance.now() + 15000,
    docker,
  );
  const rejected = assert.rejects(running, /Interrupted by operator/);
  for (let i = 0; i < 100 && !existsSync(marker); i++) await delay(20);
  assert.ok(existsSync(marker));
  process.emit("SIGINT");
  await rejected;
  assert.ok(existsSync(cleaned));
});
