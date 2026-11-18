import { orchestrate, parsePlan } from "./orchestrate.js";
import { activate, deactivate, hookStatus } from "./hooks.js";
import { verifyProject } from "./compose.js";
import { parseArgs } from "node:util";
import { resolve, join } from "node:path";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { doctor } from "./doctor.js";
import { runIntake } from "./intake.js";
import { loadConfig, loadTask, positive } from "./models.js";
import { runTask } from "./runner.js";
import { verify, scopeViolations, type VerificationResult } from "./verify.js";
import {
  git,
  storage,
  snapshotCandidate,
  type Workspace,
} from "./workspace.js";
import { Interrupted } from "./process.js";
import {
  assessReadiness,
  loadAcceptance,
  configDigest,
  missingEvidence,
  taskDigest,
} from "./readiness.js";
import { resolvePolicy, policyDigest } from "./policy.js";
import { buildReviewPacket, validateDisposition } from "./review-packet.js";
import { reviewCandidate } from "./review.js";
import { writeResult } from "./evidence.js";
import {
  readRunRecord,
  readRunSummary,
  listRuns,
  renderHandoff,
  locateRun,
} from "./status.js";

export async function main(args = process.argv.slice(2)): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        repo: { type: "string" },
        config: { type: "string" },
        task: { type: "string" },
        acceptance: { type: "string" },
        timeout: { type: "string" },
        model: { type: "string" },
        mode: { type: "string" },
        file: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      console.log(
        "Codex factory: orchestrate PLAN | activate TASK --acceptance RECORD | deactivate | hooks-status | doctor | prepare TASK | preflight TASK | intake SOURCE | benchmark | run TASK | verify | review | status RUN_ID | runs | handoff RUN_ID | disposition RUN_ID\nOptions: --repo PATH; --config PATH; --task PATH (verify/review); --acceptance PATH (preflight/run/verify/review); --mode verify|managed (doctor); --file PATH (disposition); --timeout SECONDS --model MODEL (intake/benchmark)",
      );
      return 0;
    }
    const [command, arg] = positionals;
    const valid = [
      "orchestrate",
      "activate",
      "deactivate",
      "hooks-status",
      "doctor",
      "prepare",
      "preflight",
      "intake",
      "benchmark",
      "run",
      "verify",
      "review",
      "status",
      "runs",
      "handoff",
      "disposition",
    ];
    if (!command || !valid.includes(command))
      throw new Error("Choose " + valid.join(", "));
    const needsArg = [
      "orchestrate",
      "activate",
      "prepare",
      "preflight",
      "intake",
      "run",
      "status",
      "handoff",
      "disposition",
    ].includes(command);
    if (positionals.length !== (needsArg ? 2 : 1))
      throw new Error("Wrong number of command arguments");
    for (const [option, commands] of Object.entries({
      config: [
        "orchestrate",
        "activate",
        "prepare",
        "preflight",
        "run",
        "verify",
        "review",
      ],
      task: ["verify", "review"],
      acceptance: ["activate", "preflight", "run", "verify", "review"],
      timeout: ["intake", "benchmark"],
      model: ["intake", "benchmark"],
      mode: ["doctor"],
      file: ["disposition"],
    }))
      if (values[option as keyof typeof values] && !commands.includes(command))
        throw new Error("Option is not supported for this command");
    const repo = resolve(values.repo ?? ".");
    let result: unknown, success: boolean;
    if (command === "orchestrate") {
      result = await orchestrate(
        repo,
        parsePlan(JSON.parse(readFileSync(resolve(arg!), "utf8"))),
        loadConfig(resolve(values.config ?? join(repo, "factory.json"))),
      );
      success =
        (result as { status: string }).status === "ready_for_human_review";
    } else if (command === "activate") {
      if (!values.acceptance)
        throw new Error("Activation requires --acceptance PATH");
      result = activate(
        repo,
        loadTask(resolve(arg!)),
        loadConfig(resolve(values.config ?? join(repo, "factory.json"))),
        loadAcceptance(resolve(values.acceptance)),
      );
      success = true;
    } else if (command === "deactivate") {
      result = deactivate(repo);
      success = true;
    } else if (command === "hooks-status") {
      result = hookStatus(repo);
      success = true;
    } else if (command === "doctor") {
      if (values.mode && !["verify", "managed"].includes(values.mode))
        throw new Error("Invalid doctor mode");
      const r = doctor(
        repo,
        "codex",
        values.mode as "verify" | "managed" | undefined,
      );
      result = r;
      success = r.healthy;
    } else if (command === "intake" || command === "benchmark") {
      const timeout =
        values.timeout === undefined ? 1200 : Number(values.timeout);
      positive(timeout);
      const source =
        command === "intake"
          ? resolve(arg!)
          : join(repo, "benchmarks/chronograph/input/original.md");
      const r = await runIntake(
        source,
        join(storage(repo), "intake-runs"),
        timeout,
        "codex",
        values.model,
      );
      result = r;
      success = ["needs_clarification", "ready_for_planning"].includes(
        r.status,
      );
    } else if (command === "status") {
      result = readRunRecord(repo, arg!);
      success = true;
    } else if (command === "runs") {
      result = listRuns(repo);
      success = true;
    } else if (command === "handoff") {
      console.log(renderHandoff(readRunSummary(repo, arg!)));
      return 0;
    } else if (command === "disposition") {
      if (!values.file)
        throw new Error(
          "Provide an explicit owner disposition with --file PATH",
        );
      const summary = readRunSummary(repo, arg!),
        record = readRunRecord(repo, arg!);
      if (summary.freshness !== "current" || !summary.candidate)
        throw new Error(
          "Candidate changed or freshness unknown; reverify and review",
        );
      const review = record.review as
        { collected?: boolean; disposition?: unknown } | undefined;
      if (!review?.collected) throw new Error("No collected review");
      const d = validateDisposition(
        JSON.parse(readFileSync(resolve(values.file), "utf8")),
        summary.candidate,
      );
      if (
        d.decision === "accepted" &&
        (record.status === "awaiting_manual_evidence" ||
          (Array.isArray(record.missing_evidence) &&
            record.missing_evidence.length))
      )
        throw new Error(
          "Required evidence still missing; rerun task verification with evidence",
        );
      review.disposition = d;
      writeResult(locateRun(repo, arg!), record);
      result = record;
      success = true;
    } else {
      const config = loadConfig(
        resolve(values.config ?? join(repo, "factory.json")),
      );
      const taskPath = ["prepare", "preflight", "run"].includes(command)
        ? arg
        : values.task;
      const task = taskPath ? loadTask(resolve(taskPath)) : undefined;
      const acceptance = values.acceptance
        ? loadAcceptance(resolve(values.acceptance))
        : undefined;
      if (acceptance && !task) throw new Error("Acceptance requires a task");
      if (
        (command === "preflight" ||
          (command === "run" && config.schema_version !== 1)) &&
        !acceptance
      )
        throw new Error("Provide --acceptance PATH");
      const readiness =
        task && acceptance
          ? assessReadiness(task, config, acceptance)
          : undefined;
      if (
        task &&
        acceptance &&
        git(repo, "rev-parse", "--verify", task.base_ref + "^{commit}") !==
          acceptance.base
      )
        readiness!.blockers.push("Acceptance base changed");
      if (readiness) readiness.ready = !readiness.blockers.length;
      if (command === "prepare") {
        result = {
          schema_version: 1,
          task_sha256: taskDigest(task!),
          base: git(
            repo,
            "rev-parse",
            "--verify",
            task!.base_ref + "^{commit}",
          ),
          unresolved_decisions: [
            "Review proposed mappings and resolve material decisions before execution",
          ],
          criteria: task!.acceptance_criteria.map((criterion, i) => ({
            id: `criterion-${i + 1}`,
            criterion,
            checks: [
              ...config.checks.map((c) => c.name),
              ...(config.compose ? ["compose:e2e"] : []),
            ],
            manual:
              config.checks.length || config.compose
                ? []
                : ["Define acceptance evidence"],
          })),
          manual_evidence: [],
        };
        success = true;
      } else if (command === "preflight") {
        result = readiness;
        success = !!readiness?.ready;
      } else if (command === "run") {
        const r = await runTask(repo, task!, config, "codex", acceptance);
        result = r;
        success = r.status === "ready_for_human_review";
      } else {
        if (command === "review" && !task)
          throw new Error("review requires --task PATH");
        if (task && config.schema_version !== 1 && !acceptance)
          throw new Error(
            "Version 2 task verification requires --acceptance PATH",
          );
        if (readiness && !readiness.ready)
          throw new Error(readiness.blockers.join("; "));
        const id = randomUUID().replaceAll("-", ""),
          runDir = join(storage(repo), "verification", id);
        const w: Workspace = {
          path: repo,
          run_dir: runDir,
          lock: join(runDir, "unused-lock"),
          base: git(
            repo,
            "rev-parse",
            task ? task.base_ref + "^{commit}" : "HEAD",
          ),
          branch: "",
        };
        const deadline = performance.now() + config.limits.run_seconds * 1000;
        const policy = resolvePolicy(config),
          violations = task
            ? scopeViolations(w, task.allowed_paths, policy)
            : [];
        const initialRecord = {
          schema_version: 1,
          run_id: id,
          status: "verifying",
          phase: "verification",
          workspace: repo,
          base: w.base,
          run_dir: runDir,
          ...(task ? { task } : {}),
        };
        writeResult(runDir, initialRecord);
        let v: VerificationResult;
        try {
          v = violations.length
            ? {
                passed: false,
                reason: violations.join("; "),
                checks: [],
                candidate: snapshotCandidate(w),
              }
            : await verifyProject(w, config, deadline);
        } catch (e) {
          writeResult(runDir, {
            ...initialRecord,
            status: e instanceof Interrupted ? "interrupted" : "failed",
            reason: e instanceof Error ? e.message : String(e),
          });
          throw e;
        }
        const pending =
          acceptance && v.candidate
            ? missingEvidence(acceptance, v.candidate)
            : [];
        const record = {
          ...v,
          schema_version: 1,
          run_id: id,
          status: v.passed
            ? pending.length
              ? "awaiting_manual_evidence"
              : "verified"
            : "failed",
          phase: "verification",
          workspace: repo,
          base: w.base,
          run_dir: runDir,
          config_sha256: configDigest(config),
          policy_sha256: policyDigest(policy),
          missing_evidence: pending,
          ...(task ? { task } : {}),
          ...(acceptance ? { acceptance } : {}),
        } as Record<string, unknown>;
        writeResult(runDir, record);
        if (task && v.candidate) {
          const packet = buildReviewPacket(task, acceptance, v, v.candidate);
          writeResult(join(runDir, "review-packet"), packet);
          if (command === "review" && v.passed) {
            record.status = "reviewing";
            record.phase = "review";
            writeResult(runDir, record);
            try {
              const review = await reviewCandidate(
                w,
                v.candidate,
                Math.min(
                  deadline,
                  performance.now() + config.limits.agent_seconds * 1000,
                ),
                "codex",
                packet,
              );
              record.review = review;
              record.reason = review.reason;
              record.status = review.collected
                ? pending.length
                  ? "awaiting_manual_evidence"
                  : "ready_for_human_review"
                : "failed";
              record.phase = "review";
              writeResult(runDir, record);
            } catch (e) {
              record.status =
                e instanceof Interrupted ? "interrupted" : "failed";
              record.reason = e instanceof Error ? e.message : String(e);
              writeResult(runDir, record);
              throw e;
            }
          }
        }
        result = record;
        success =
          command === "review"
            ? record.status === "ready_for_human_review"
            : v.passed && !pending.length;
      }
    }
    console.log(JSON.stringify(result, null, 2));
    return success ? 0 : 1;
  } catch (e) {
    console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
    return e instanceof Interrupted ? 130 : 2;
  }
}
process.exitCode = await main();
