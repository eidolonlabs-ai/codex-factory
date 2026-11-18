import test from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { git, repo, temp } from "./helpers.js";

const source = resolve("plugins/codex-harness");
function call(script: string, args: string[], cwd: string) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 20000,
    env: { ...process.env, NODE_PATH: "", NODE_OPTIONS: "" },
  });
  assert.ifError(result.error);
  return result;
}
function standalone(root: string) {
  const plugin = join(root, "standalone plugin");
  cpSync(source, plugin, { recursive: true });
  assert.equal(existsSync(join(plugin, "node_modules")), false);
  return plugin;
}
test("plugin manifests, resource links and generated files stay synchronized", () => {
  const result = call(
    resolve("scripts/build-plugin.mjs"),
    ["--check"],
    process.cwd(),
  );
  assert.equal(result.status, 0, result.stderr);
  const portable = JSON.parse(
    readFileSync(resolve("plugin-src/plugin.json"), "utf8"),
  );
  const compat = JSON.parse(
    readFileSync(join(source, ".codex-plugin/plugin.json"), "utf8"),
  );
  assert.equal(portable.name, compat.name);
  assert.equal(existsSync(join(source, "plugin.json")), false);
  assert.equal(portable.version, compat.version);
  assert.equal(portable.extensions["com.openai"].hooks, "./hooks/hooks.json");
  assert.equal(compat.hooks, portable.extensions["com.openai"].hooks);
  assert.equal(
    portable.$schema,
    "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  );
  assert.deepEqual(
    portable.extensions["com.openai"].interface,
    compat.interface,
  );
  const skills = readdirSync(join(source, "skills"));
  assert.equal(skills.length, 6);
  for (const name of skills) {
    const path = join(source, "skills", name);
    const text = readFileSync(join(path, "SKILL.md"), "utf8");
    assert.ok(text.startsWith(`---\nname: ${name}\n`));
    assert.doesNotMatch(text, /npm run harness/);
    for (const link of text.matchAll(/`(\.\.\/\.\.\/[^`<>]+)`/g)) {
      assert.ok(existsSync(resolve(path, link[1]!)), `${name}: ${link[1]}`);
    }
  }
});

test("standalone setup previews, preserves project files and repeats safely", (t) => {
  const { root, path } = repo(t);
  const plugin = standalone(root);
  const setup = join(plugin, "scripts/setup.mjs");
  writeFileSync(join(path, "AGENTS.md"), "Project-specific rules\n");
  writeFileSync(join(path, "package.json"), '{"name":"existing-app"}\n');
  const before = git(path, "status", "--porcelain");
  let result = call(setup, ["--repo", path], root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).applied, false);
  assert.equal(existsSync(join(path, "harness.json")), false);
  assert.equal(git(path, "status", "--porcelain"), before);
  result = call(setup, ["--repo", path, "--apply"], root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    JSON.parse(readFileSync(join(path, "harness.json"), "utf8")).checks,
    [],
  );
  const custom = '{"schema_version":1,"checks":[],"limits":{"attempts":1}}\n';
  writeFileSync(join(path, "harness.json"), custom);
  result = call(setup, ["--repo", path, "--apply"], root);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    JSON.parse(result.stdout).files.every(
      (f: { action: string }) => f.action === "preserve",
    ),
  );
  assert.equal(readFileSync(join(path, "harness.json"), "utf8"), custom);
  assert.equal(
    readFileSync(join(path, "AGENTS.md"), "utf8"),
    "Project-specific rules\n",
  );
  assert.equal(
    readFileSync(join(path, "package.json"), "utf8"),
    '{"name":"existing-app"}\n',
  );
  assert.equal(existsSync(join(path, ".codex")), false);
});

test("setup rejects symlink destinations before creating any scaffold", (t) => {
  const { root, path } = repo(t);
  const external = join(root, "outside");
  mkdirSync(external);
  symlinkSync(external, join(path, "docs"));
  const result = call(
    join(source, "scripts/setup.mjs"),
    ["--repo", path, "--apply"],
    root,
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /symlink/);
  assert.equal(existsSync(join(path, "harness.json")), false);
  assert.deepEqual(readdirSync(external), []);
});

test("standalone runtime verifies another project, fails closed and stores evidence there", (t) => {
  const { root, path } = repo(t);
  const plugin = standalone(root);
  const cli = join(plugin, "scripts/harness.mjs");
  const run = () => call(cli, ["verify", "--repo", path], root);
  writeFileSync(
    join(path, "harness.json"),
    JSON.stringify({ schema_version: 1, checks: [] }),
  );
  let result = run();
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /No project checks configured/);
  writeFileSync(
    join(path, "check.mjs"),
    'import fs from "node:fs"; if (fs.readFileSync("src/a", "utf8") !== "base") process.exit(1);',
  );
  writeFileSync(
    join(path, "harness.json"),
    JSON.stringify({
      schema_version: 1,
      checks: [
        { name: "source behavior", argv: [process.execPath, "check.mjs"] },
      ],
    }),
  );
  result = run();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, true);
  assert.ok(report.candidate);
  assert.ok(existsSync(join(path, ".git/harness/verification")));
  assert.equal(existsSync(join(plugin, ".git")), false);
  writeFileSync(join(path, "src/a"), "regression");
  result = run();
  assert.equal(result.status, 1, result.stderr);
  assert.equal(JSON.parse(result.stdout).passed, false);
  writeFileSync(
    join(path, "harness.json"),
    JSON.stringify({
      schema_version: 1,
      checks: [{ name: "missing", argv: ["/nonexistent/harness-check"] }],
    }),
  );
  result = run();
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /Check could not start/);
  result = call(cli, ["--help", "--repo", "benchmark"], root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /verify/);
});

test("archive contains a complete standalone plugin without repository extras", (t) => {
  const root = temp(t);
  const result = call(
    resolve("scripts/build-plugin.mjs"),
    ["--check", "--archive"],
    process.cwd(),
  );
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(
    readFileSync(resolve("plugin-src/plugin.json"), "utf8"),
  );
  const archive = unzipSync(
    readFileSync(resolve(`dist/codex-harness-${manifest.version}.zip`)),
  );
  assert.equal(
    JSON.parse(strFromU8(archive[".codex-plugin/plugin.json"]!)).name,
    "codex-harness",
  );
  assert.equal(
    JSON.parse(strFromU8(archive[".codex-plugin/plugin.json"]!)).version,
    manifest.version,
  );
  for (const key of Object.keys(archive)) {
    assert.doesNotMatch(
      key,
      /(^|\/)(node_modules|\.git|benchmarks|marketplace\.json)(\/|$)/,
    );
    assert.ok(!key.startsWith("/") && !key.split("/").includes(".."));
    const target = join(root, key);
    mkdirSync(resolve(target, ".."), { recursive: true });
    writeFileSync(target, archive[key]!);
  }
  const help = call(join(root, "scripts/harness.mjs"), ["--help"], root);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /verify/);
  assert.ok(archive["THIRD_PARTY_NOTICES.md"]);
  const hooks = JSON.parse(strFromU8(archive["hooks/hooks.json"]!));
  assert.deepEqual(Object.keys(hooks.hooks).sort(), [
    "PreToolUse",
    "SessionStart",
    "Stop",
  ]);
  const project = repo(t);
  writeFileSync(
    join(project.path, "harness.json"),
    JSON.stringify({ schema_version: 1, checks: [] }),
  );
  const hook = spawnSync(process.execPath, [join(root, "scripts/hooks.mjs")], {
    cwd: project.path,
    encoding: "utf8",
    timeout: 15000,
    input: JSON.stringify({
      hook_event_name: "PreToolUse",
      cwd: project.path,
      tool_name: "Bash",
      tool_input: { command: "git commit --no-verify -m bypass" },
    }),
    env: { ...process.env, NODE_PATH: "", NODE_OPTIONS: "" },
  });
  assert.equal(hook.status, 0, hook.stderr);
  assert.equal(
    JSON.parse(hook.stdout).hookSpecificOutput.permissionDecision,
    "deny",
  );
});
