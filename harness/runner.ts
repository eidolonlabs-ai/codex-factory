import { InterruptScope } from "./process.js";
import { createHash, randomUUID } from "node:crypto";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  openSync,
  fstatSync,
  readSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { writeResult } from "./evidence.js";
import { fields, type Config, type Task } from "./models.js";
import { runProcess, Interrupted, type ProcessResult } from "./process.js";
import { reviewCandidate, type ReviewResult } from "./review.js";
import { verify, scopeViolations, type VerificationResult } from "./verify.js";
import {
  prepareWorkspace,
  releaseWorkspace,
  snapshotCandidate,
} from "./workspace.js";
export const AGENT_SCHEMA = {
  type: "object",
  properties: { summary: { type: "string" }, completed: { type: "boolean" } },
  required: ["summary", "completed"],
  additionalProperties: false,
};
interface AgentReport {
  summary: string;
  completed: boolean;
}
interface Attempt {
  number: number;
  process: ProcessResult;
  report?: AgentReport;
  verification?: VerificationResult;
}
export interface RunResult {
  schema_version: 1;
  run_id: string;
  status: string;
  phase: string;
  base: string;
  branch: string;
  workspace: string;
  run_dir: string;
  lock: string;
  attempts: Attempt[];
  reason?: string;
  duration_seconds?: number;
  config_sha256?: string;
  candidate?: string;
  review?: ReviewResult;
}
function tail(path: string): string {
  const fd = openSync(path, "r");
  try {
    const b = Buffer.alloc(4000);
    const n = readSync(
      fd,
      b,
      0,
      b.length,
      Math.max(0, fstatSync(fd).size - 4000),
    );
    return b.subarray(0, n).toString();
  } finally {
    closeSync(fd);
  }
}
export async function runTask(
  repo: string,
  task: Task,
  inputConfig: Config,
  codex = "codex",
): Promise<RunResult> {
  const config = structuredClone(inputConfig); // Freeze the invocation's command list against caller/worker edits.
  if (!config.checks.length)
    throw new Error(
      "Configure project checks before running an implementation task",
    );
  const start = performance.now(),
    deadline = start + config.limits.run_seconds * 1000,
    id = randomUUID().replaceAll("-", "");
  const interrupts = new InterruptScope();
  let w;
  try {
    w = prepareWorkspace(repo, task, id);
  } catch (e) {
    interrupts.dispose();
    throw e;
  }
  const result: RunResult = {
    schema_version: 1,
    run_id: id,
    status: "created",
    phase: "created",
    base: w.base,
    branch: w.branch,
    workspace: w.path,
    run_dir: w.run_dir,
    lock: w.lock,
    attempts: [],
  };
  const save = (status: string, reason?: string) => {
    result.status = status;
    if (!["failed", "timed_out", "interrupted"].includes(status))
      result.phase = status;
    if (reason) result.reason = reason;
    result.duration_seconds = (performance.now() - start) / 1000;
    writeResult(w.run_dir, result);
  };
  try {
    await interrupts.checkpoint();
    for (const [name, value] of [
      ["task", task],
      ["config", config],
      ["agent-report.schema", AGENT_SCHEMA],
    ])
      writeFileSync(
        join(w.run_dir, `${name}.json`),
        JSON.stringify(value, null, 2) + "\n",
      );
    result.config_sha256 = createHash("sha256")
      .update(readFileSync(join(w.run_dir, "config.json")))
      .digest("hex");
    save("created");
    let feedback = "";
    for (let attempt = 1; attempt <= config.limits.attempts; attempt++) {
      if (performance.now() >= deadline) {
        save("timed_out", "Whole-run deadline exhausted");
        return result;
      }
      save(attempt === 1 ? "running" : "repairing");
      const log = join(w.run_dir, `attempt-${attempt}`);
      mkdirSync(log);
      const final = join(log, "agent-report.json");
      const argv = [
        codex,
        "-c",
        'approval_policy="never"',
        "exec",
        "--sandbox",
        "workspace-write",
        "--json",
        "--output-schema",
        join(w.run_dir, "agent-report.schema.json"),
        "--output-last-message",
        final,
      ];
      if (config.model) argv.push("--model", config.model);
      argv.push("-");
      const prompt =
        "Implement the approved task below. Follow AGENTS.md. Stay within allowed_paths. Do not edit harness controls, acceptance tests, or commit/publish/merge. Report completed=false if requirements are ambiguous or access is blocked. Your completion report is not the verification result.\nTASK DATA:\n" +
        JSON.stringify(task) +
        "\nPREVIOUS VERIFICATION:\n" +
        feedback;
      const p = await runProcess(
        argv,
        w.path,
        Math.min(
          config.limits.agent_seconds,
          (deadline - performance.now()) / 1000,
        ),
        log,
        prompt,
      );
      const entry: Attempt = { number: attempt, process: p };
      result.attempts.push(entry);
      if (p.timed_out) {
        save("timed_out", "Agent invocation deadline exhausted");
        return result;
      }
      if (p.returncode) {
        save(
          "failed",
          "Codex process failed; inspect logs (no automatic infrastructure retry)",
        );
        return result;
      }
      let report: AgentReport;
      try {
        const data: unknown = JSON.parse(readFileSync(final, "utf8"));
        fields(data, ["summary", "completed"]);
        if (
          typeof data.summary !== "string" ||
          typeof data.completed !== "boolean"
        )
          throw new Error("Invalid report fields");
        report = data as unknown as AgentReport;
      } catch {
        save("failed", "Missing or malformed agent report");
        return result;
      }
      entry.report = report;
      if (!report.completed) {
        save(
          "failed",
          "Agent requires clarification or could not complete task",
        );
        return result;
      }
      const violations = scopeViolations(w, task.allowed_paths);
      await interrupts.checkpoint();
      if (violations.length) {
        save("failed", violations.join("\n"));
        return result;
      }
      save("verifying");
      const v = await verify(w, config.checks, deadline);
      await interrupts.checkpoint();
      entry.verification = v;
      if (v.passed) {
        result.candidate = v.candidate!;
        save("reviewing");
        const review = await reviewCandidate(
          w,
          result.candidate,
          Math.min(
            deadline,
            performance.now() + config.limits.agent_seconds * 1000,
          ),
          codex,
        );
        await interrupts.checkpoint();
        result.review = review;
        if (
          review.collected &&
          performance.now() < deadline &&
          snapshotCandidate(w) === result.candidate
        )
          save(
            "ready_for_human_review",
            "Required checks passed; inspect review findings before merging",
          );
        else
          save(
            performance.now() >= deadline || review.process?.timed_out
              ? "timed_out"
              : "failed",
            review.reason,
          );
        return result;
      }
      if (performance.now() >= deadline || v.checks.some((c) => c.timed_out)) {
        save("timed_out", v.reason);
        return result;
      }
      if (
        v.checks.some((c) => c.launch_error) ||
        v.reason === "Candidate changed during verification"
      ) {
        save("failed", v.reason);
        return result;
      }
      feedback = JSON.stringify(v);
      for (const c of v.checks)
        for (const name of ["stdout.log", "stderr.log"])
          feedback += "\n" + tail(join(c.log_dir, name));
    }
    save("failed", "Implementation attempt budget exhausted");
  } catch (e) {
    save(
      e instanceof Interrupted ? "interrupted" : "failed",
      e instanceof Error ? e.message : String(e),
    );
  } finally {
    interrupts.dispose();
    releaseWorkspace(w);
  }
  return result;
}
