import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  openSync,
  writeFileSync,
  closeSync,
  unlinkSync,
  lstatSync,
  readlinkSync,
  readSync,
} from "node:fs";
import { join } from "node:path";
import { TextDecoder } from "node:util";
import type { Task } from "./models.js";

export interface Workspace {
  path: string;
  run_dir: string;
  lock: string;
  base: string;
  branch: string;
}
export function git(repo: string, ...args: string[]): string {
  const b = execFileSync("git", ["-C", repo, ...args], {
    timeout: 30000,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Fail closed on non-UTF8 path bytes rather than hashing a replacement filename.
  const s = new TextDecoder("utf-8", { fatal: true }).decode(b);
  return args.includes("-z") ? s : s.replace(/\n$/, "");
}
export const storage = (repo: string) =>
  join(
    git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir"),
    "harness",
  );
export function prepareWorkspace(
  repo: string,
  task: Task,
  id: string,
): Workspace {
  if (git(repo, "status", "--porcelain"))
    throw new Error(
      "Starting repository must be clean (including untracked files)",
    );
  const base = git(repo, "rev-parse", "--verify", task.base_ref + "^{commit}");
  const home = storage(repo);
  for (const name of ["locks", "runs", "worktrees"])
    mkdirSync(join(home, name), { recursive: true });
  const lock = join(home, "locks", task.id);
  let fd: number;
  try {
    fd = openSync(lock, "wx", 0o600);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error(
        `Task locked: ${lock}; inspect before removing stale lock`,
      );
    throw e;
  }
  try {
    writeFileSync(fd, `pid=${process.pid} run=${id}\n`);
  } finally {
    closeSync(fd);
  }
  const run_dir = join(home, "runs", id);
  const path = join(home, "worktrees", id);
  const branch = `harness/${task.id}/${id}`;
  try {
    mkdirSync(run_dir);
    git(repo, "worktree", "add", "-b", branch, path, base);
    return { path, run_dir, lock, base, branch };
  } catch (e) {
    unlinkSync(lock);
    throw e;
  }
}
export function releaseWorkspace(w: Workspace) {
  try {
    unlinkSync(w.lock);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}
export function changedPaths(w: Workspace): string[] {
  return [
    ...new Set(
      (
        git(w.path, "diff", "--name-only", "--no-renames", "-z", w.base, "--") +
        "\0" +
        git(w.path, "ls-files", "--others", "--exclude-standard", "-z")
      )
        .split("\0")
        .filter(Boolean),
    ),
  ].sort();
}
export function snapshotCandidate(w: Workspace): string {
  const h = createHash("sha256");
  for (const args of [
    ["rev-parse", "HEAD"],
    ["diff", "--binary", "HEAD", "--"],
    ["diff", "--cached", "--binary", "--"],
  ])
    h.update(git(w.path, ...args)).update("\0");
  const files = [
    ...new Set(
      git(w.path, "ls-files", "-c", "-o", "--exclude-standard", "-z")
        .split("\0")
        .filter(Boolean),
    ),
  ].sort();
  for (const name of files) {
    const p = join(w.path, name);
    h.update(name).update("\0");
    let stat;
    try {
      stat = lstatSync(p);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (!stat) h.update("deleted");
    else if (stat.isSymbolicLink()) h.update("link:").update(readlinkSync(p));
    else if (stat.isFile()) {
      h.update(String(stat.mode & 0o777) + ":");
      const fd = openSync(p, "r");
      const b = Buffer.alloc(1024 * 1024);
      try {
        let n: number;
        while ((n = readSync(fd, b, 0, b.length, null)) > 0)
          h.update(b.subarray(0, n));
      } finally {
        closeSync(fd);
      }
    } else throw new Error(`Unsupported candidate entry: ${name}`);
    h.update("\0");
  }
  return h.digest("hex");
}
