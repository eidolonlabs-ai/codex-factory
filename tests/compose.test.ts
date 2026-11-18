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

test("Compose gate rejects symlinked compose parent, unsafe service capabilities, and host drift while exempting peer projects", async (t) => {
  const { mkdirSync, symlinkSync } = await import("node:fs");
  const r = repo(t);
  const outside = join(r.root, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "compose.yaml"), "services: {}\n");
  symlinkSync(outside, join(r.path, "sub"));
  writeFileSync(join(r.path, "compose.yaml"), "services: {}\n");
  git(r.path, "add", "compose.yaml");
  git(r.path, "commit", "-m", "compose");
  const base = git(r.path, "rev-parse", "HEAD");

  const symlinkCfg = parseConfig({
    schema_version: 3,
    checks: [],
    policy: { editable_paths: ["src"], protected_paths: ["acceptance"] },
    compose: {
      files: ["sub/compose.yaml"],
      services: ["api"],
      test_service: "e2e",
    },
  });
  const symRes = await verifyProject(
    {
      path: r.path,
      base,
      run_dir: join(r.root, "ev-sym"),
      branch: "",
      lock: "",
    },
    symlinkCfg,
    performance.now() + 5000,
    fake(r.root, ""),
  );
  assert.equal(symRes.passed, false);
  assert.match(symRes.reason, /symlink/i);

  mkdirSync(join(r.root, "cap"), { recursive: true });
  const capDockerBin = fake(
    join(r.root, "cap"),
    `if(args.includes('config'))console.log(JSON.stringify({services:{api:{cap_add:['SYS_ADMIN'],healthcheck:{test:['CMD','true']}},e2e:{}}}));`,
  );
  const capRes = await verifyProject(
    {
      path: r.path,
      base,
      run_dir: join(r.root, "ev-cap"),
      branch: "",
      lock: "",
    },
    config(),
    performance.now() + 5000,
    capDockerBin,
  );
  assert.equal(capRes.passed, false);
  assert.match(capRes.reason, /Unsafe/i);

  mkdirSync(join(r.root, "peer"), { recursive: true });
  const peerCount = join(r.root, "peer-ps-calls");
  const peerDocker = fake(
    join(r.root, "peer"),
    `if(args.includes('config'))console.log(JSON.stringify({services:{api:{healthcheck:{test:['CMD','true']}},e2e:{}}}));if(args[0]==='ps'){const n=fs.existsSync(${JSON.stringify(peerCount)})?Number(fs.readFileSync(${JSON.stringify(peerCount)},'utf8'))+1:1;fs.writeFileSync(${JSON.stringify(peerCount)},String(n));console.log(n===1?'c1\\tfactory-agy-1-api-1\\tfactory-agy-1':'c1\\tfactory-agy-1-api-1\\tfactory-agy-1\\nc2\\tapp-preview-1\\tapp-preview');}`,
  );
  const peerRes = await verifyProject(
    {
      path: r.path,
      base,
      run_dir: join(r.root, "ev-peer"),
      branch: "",
      lock: "",
    },
    config(),
    performance.now() + 5000,
    peerDocker,
  );
  assert.equal(peerRes.passed, true, peerRes.reason);

  mkdirSync(join(r.root, "drift"), { recursive: true });
  const driftCount = join(r.root, "drift-ps-calls");
  const driftDocker = fake(
    join(r.root, "drift"),
    `if(args.includes('config'))console.log(JSON.stringify({services:{api:{healthcheck:{test:['CMD','true']}},e2e:{}}}));if(args[0]==='ps'){const n=fs.existsSync(${JSON.stringify(driftCount)})?Number(fs.readFileSync(${JSON.stringify(driftCount)},'utf8'))+1:1;fs.writeFileSync(${JSON.stringify(driftCount)},String(n));if(n>1)console.log('rogue1\\trogue-container\\trogue-proj');}`,
  );
  const driftRes = await verifyProject(
    {
      path: r.path,
      base,
      run_dir: join(r.root, "ev-drift"),
      branch: "",
      lock: "",
    },
    config(),
    performance.now() + 5000,
    driftDocker,
  );
  assert.equal(driftRes.passed, false);
  assert.match(driftRes.reason, /unrelated host containers changed/);
});
