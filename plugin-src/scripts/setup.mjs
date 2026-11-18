#!/usr/bin/env node
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative, sep } from "node:path";
import {
  lstatSync,
  existsSync,
  realpathSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  "factory.json": "templates/factory.json",
  "docs/factory/task-card.md": "templates/desktop-task.md",
  "docs/factory/development-state.md": "templates/development-state.md",
  "docs/factory/example-task.json": "templates/example-task.json",
  "docs/factory/AGENTS.snippet.md": "templates/AGENTS.snippet.md",
};
function inspect(root, name) {
  const parts = name.split("/");
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = join(current, parts[i]);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (e) {
      if (e.code === "ENOENT") return "create";
      throw e;
    }
    if (stat.isSymbolicLink())
      throw new Error(`Refusing symlink destination: ${current}`);
    if (i < parts.length - 1 && !stat.isDirectory())
      throw new Error(`Not a directory: ${current}`);
    if (i === parts.length - 1 && !stat.isFile())
      throw new Error(`Not a regular file: ${current}`);
  }
  return "preserve";
}
try {
  const { values } = parseArgs({
    options: { repo: { type: "string" }, apply: { type: "boolean" } },
  });
  if (!values.repo) throw new Error("Usage: setup.mjs --repo PATH [--apply]");
  const root = realpathSync(resolve(values.repo));
  const gitRoot = realpathSync(
    execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim(),
  );
  if (root !== gitRoot) throw new Error("--repo must be the Git worktree root");
  const fromPlugin = relative(plugin, root);
  if (
    !fromPlugin ||
    (!fromPlugin.startsWith(".." + sep) && fromPlugin !== "..")
  )
    throw new Error("Choose a project outside the installed plugin");
  const suggestions = [];
  const packagePath = join(root, "package.json");
  if (existsSync(packagePath) && !lstatSync(packagePath).isSymbolicLink()) {
    const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
    for (const name of [
      "typecheck",
      "test",
      "test:integration",
      "test:e2e",
      "lint",
    ])
      if (typeof pkg.scripts?.[name] === "string")
        suggestions.push({
          name,
          argv: ["npm", "run", name],
          source: "package.json",
          review_required: true,
        });
  }
  const stackFiles = [
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "Makefile",
  ].filter((name) => existsSync(join(root, name)));
  const version = JSON.parse(
    readFileSync(join(plugin, ".codex-plugin/plugin.json"), "utf8"),
  ).version;
  // Validate every destination before any writes; never follow existing symlinks.
  const plan = Object.entries(files).map(([path, source]) => ({
    path,
    source,
    action: inspect(root, path),
  }));
  if (values.apply) {
    for (const item of plan) {
      if (item.action === "preserve") continue;
      if (inspect(root, item.path) !== "create")
        throw new Error(`Destination changed: ${item.path}`);
      mkdirSync(dirname(join(root, item.path)), { recursive: true });
      writeFileSync(
        join(root, item.path),
        readFileSync(join(plugin, item.source)),
        { flag: "wx" },
      );
    }
  }
  console.log(
    JSON.stringify(
      {
        repo: root,
        applied: !!values.apply,
        plugin_version: version,
        suggested_checks: suggestions,
        additional_stack_files: stackFiles,
        upgrade:
          "Existing scaffolds remain project-owned; review and migrate explicitly.",
        files: plan.map(({ path, action }) => ({ path, action })),
        next: "Configure required Docker Compose services and E2E in v3 factory.json; reconcile the AGENTS snippet and trust the plugin hooks. Missing stack checks fail.",
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exitCode = 2;
}
