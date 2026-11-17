import { InterruptScope } from "./process.js";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { runProcess, type ProcessResult } from "./process.js";
import {
  git,
  snapshotCandidate,
  storage,
  type Workspace,
} from "./workspace.js";
export interface ReviewResult {
  collected: boolean;
  reason: string;
  snapshot_commit?: string;
  review_worktree?: string;
  process?: ProcessResult;
}
export async function reviewCandidate(
  w: Workspace,
  baseline: string,
  deadline: number,
  codex = "codex",
): Promise<ReviewResult> {
  const interrupts = new InterruptScope();
  try {
    await interrupts.checkpoint();
    if (snapshotCandidate(w) !== baseline)
      return { collected: false, reason: "Candidate changed before review" };
    if (deadline <= performance.now())
      return { collected: false, reason: "Run deadline exhausted" };
    const tmp = mkdtempSync(join(w.run_dir, "review-index-"));
    let commit: string;
    try {
      const env = {
        ...process.env,
        GIT_INDEX_FILE: join(tmp, "index"),
        GIT_AUTHOR_NAME: "Harness Review",
        GIT_AUTHOR_EMAIL: "harness@example.invalid",
        GIT_COMMITTER_NAME: "Harness Review",
        GIT_COMMITTER_EMAIL: "harness@example.invalid",
      };
      const command = (...args: string[]) =>
        execFileSync("git", ["-C", w.path, ...args], {
          env,
          encoding: "utf8",
          timeout: 30000,
          stdio: ["ignore", "pipe", "pipe"],
        }).trim();
      command("read-tree", "HEAD");
      command("add", "-A", "--", ".");
      commit = command(
        "commit-tree",
        command("write-tree"),
        "-p",
        w.base,
        "-m",
        "Temporary harness review snapshot",
      );
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
    const path = join(storage(w.path), "reviews", basename(w.run_dir));
    mkdirSync(join(path, ".."), { recursive: true });
    git(w.path, "worktree", "add", "--detach", path, commit);
    const rw = { ...w, path, branch: "" };
    const before = snapshotCandidate(rw);
    await interrupts.checkpoint();
    const result = await runProcess(
      [
        codex,
        "-c",
        'sandbox_mode="read-only"',
        "-c",
        'approval_policy="never"',
        "review",
        "--base",
        w.base,
      ],
      path,
      Math.max(0.001, (deadline - performance.now()) / 1000),
      join(w.run_dir, "review"),
    );
    const same =
      snapshotCandidate(w) === baseline && snapshotCandidate(rw) === before;
    await interrupts.checkpoint();
    const collected = result.returncode === 0 && !result.timed_out && same;
    return {
      collected,
      reason: !same
        ? "Candidate changed during review"
        : collected
          ? "Review collected; human interpretation required"
          : "Review process failed; inspect logs",
      snapshot_commit: commit,
      review_worktree: path,
      process: result,
    };
  } finally {
    interrupts.dispose();
  }
}
