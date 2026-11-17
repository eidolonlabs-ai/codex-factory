import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type { TestContext } from "node:test";

export const TASK = {
  schema_version: 1 as const,
  id: "demo",
  title: "Demo",
  specification: "Implement sum",
  acceptance_criteria: ["Sum works"],
  allowed_paths: ["src"],
  base_ref: "HEAD",
};
export function temp(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "codex-ts-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
export function git(repo: string, ...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}
export function repo(t: TestContext) {
  const root = temp(t);
  const path = join(root, "repo");
  mkdirSync(path);
  git(path, "init", "-b", "main");
  git(path, "config", "user.email", "test@example.invalid");
  git(path, "config", "user.name", "Test");
  mkdirSync(join(path, "src"));
  writeFileSync(join(path, "src/a"), "base");
  git(path, "add", ".");
  git(path, "commit", "-m", "base");
  return { root, path };
}
export function fake(root: string, body: string) {
  const path = join(root, "fake-codex");
  writeFileSync(
    path,
    `#!/usr/bin/env node\nconst fs = require('node:fs'); const cp = require('node:child_process'); const args = process.argv.slice(2);\n${body}\n`,
  );
  chmodSync(path, 0o755);
  return path;
}
export const report = `fs.writeFileSync(args[args.indexOf('--output-last-message')+1],JSON.stringify({summary:'done',completed:true}));`;
