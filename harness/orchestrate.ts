import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  fields,
  parseTask,
  positive,
  type Task,
  type Config,
} from "./models.js";
import {
  parseAcceptance,
  taskDigest,
  missingEvidence,
  assessReadiness,
  type AcceptanceRecord,
} from "./readiness.js";
import { within, resolvePolicy } from "./policy.js";
import { git, storage, type Workspace } from "./workspace.js";
import { runTask, type RunResult } from "./runner.js";
import { verifyProject } from "./compose.js";
import { scopeViolations } from "./verify.js";
import { buildReviewPacket } from "./review-packet.js";
import { reviewCandidate } from "./review.js";
import { writeResult } from "./evidence.js";
export interface Plan {
  schema_version: 1;
  task: Task;
  acceptance: AcceptanceRecord;
  concurrency: number;
  nodes: { task: Task; acceptance: AcceptanceRecord; depends_on: string[] }[];
}
export function parsePlan(value: unknown): Plan {
  fields(value, [
    "schema_version",
    "task",
    "acceptance",
    "concurrency",
    "nodes",
  ]);
  if (
    value.schema_version !== 1 ||
    !Array.isArray(value.nodes) ||
    !value.nodes.length ||
    value.nodes.length > 32
  )
    throw new Error("Invalid orchestration plan");
  positive(value.concurrency);
  if (value.concurrency > 4) throw new Error("Local concurrency limit is 4");
  const nodes = value.nodes.map((n) => {
    fields(n, ["task", "acceptance", "depends_on"]);
    if (
      !Array.isArray(n.depends_on) ||
      n.depends_on.some((d) => typeof d !== "string")
    )
      throw new Error("Invalid dependencies");
    return {
      task: parseTask(n.task),
      acceptance: parseAcceptance(n.acceptance),
      depends_on: n.depends_on as string[],
    };
  });
  const ids = nodes.map((n) => n.task.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate task IDs");
  for (const node of nodes)
    if (node.depends_on.some((id) => !ids.includes(id) || id === node.task.id))
      throw new Error("Unknown or self dependency");
  const done = new Set<string>();
  while (done.size < nodes.length) {
    const ready = nodes.filter(
      (n) => !done.has(n.task.id) && n.depends_on.every((id) => done.has(id)),
    );
    if (!ready.length) throw new Error("Dependency cycle");
    ready.forEach((n) => done.add(n.task.id));
  }
  function ancestors(id: string): Set<string> {
    const n = nodes.find((n) => n.task.id === id)!;
    return new Set(n.depends_on.flatMap((d) => [d, ...ancestors(d)]));
  }
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!,
        b = nodes[j]!;
      if (
        !ancestors(a.task.id).has(b.task.id) &&
        !ancestors(b.task.id).has(a.task.id) &&
        a.task.allowed_paths.some((p) =>
          b.task.allowed_paths.some((q) => within(p, q) || within(q, p)),
        )
      )
        throw new Error("Overlapping ownership requires a dependency");
    }
  const task = parseTask(value.task);
  for (const n of nodes)
    if (
      n.task.allowed_paths.some(
        (p) => !task.allowed_paths.some((q) => within(p, q)),
      )
    )
      throw new Error("Worker ownership exceeds integration scope");
  return {
    schema_version: 1,
    task,
    acceptance: parseAcceptance(value.acceptance),
    concurrency: value.concurrency,
    nodes,
  };
}
export async function orchestrate(
  repo: string,
  plan: Plan,
  config: Config,
  codex = "codex",
) {
  if (config.schema_version !== 3)
    throw new Error(
      "Orchestration requires Docker Compose configuration version 3",
    );
  if (git(repo, "status", "--porcelain"))
    throw new Error("Start orchestration from a clean committed baseline");
  const base = git(repo, "rev-parse", plan.task.base_ref + "^{commit}");
  for (const n of [
    { task: plan.task, acceptance: plan.acceptance },
    ...plan.nodes,
  ]) {
    const ready = assessReadiness(n.task, config, n.acceptance);
    if (
      !ready.ready ||
      n.acceptance.base !== base ||
      git(repo, "rev-parse", n.task.base_ref + "^{commit}") !== base
    )
      throw new Error(
        "Plan task readiness/base mismatch: " + ready.blockers.join("; "),
      );
  }
  const id = randomUUID().replaceAll("-", "");
  const run_dir = join(storage(repo), "orchestrations", id),
    path = join(storage(repo), "integration", id);
  mkdirSync(run_dir, { recursive: true });
  mkdirSync(join(path, ".."), { recursive: true });
  git(repo, "worktree", "add", "-b", `harness/integration/${id}`, path, base);
  const w: Workspace = {
    path,
    run_dir,
    base,
    branch: `harness/integration/${id}`,
    lock: "",
  };
  const result: {
    run_id: string;
    status: string;
    phase: string;
    workspace: string;
    base: string;
    run_dir: string;
    workers: RunResult[];
    reason?: string;
    candidate?: string;
    [key: string]: unknown;
  } = {
    run_id: id,
    status: "running",
    phase: "orchestration",
    workspace: path,
    base,
    run_dir,
    workers: [],
    schema_version: 1,
    task: plan.task,
  };
  const save = () => writeResult(run_dir, result);
  save();
  const deadline = performance.now() + config.limits.run_seconds * 1000;
  const done = new Set<string>();
  try {
    while (done.size < plan.nodes.length) {
      if (performance.now() >= deadline)
        throw new Error("Orchestration deadline exhausted");
      const wave = plan.nodes
        .filter(
          (n) => !done.has(n.task.id) && n.depends_on.every((d) => done.has(d)),
        )
        .slice(0, plan.concurrency);
      const waveBase = git(path, "rev-parse", "HEAD");
      // Rebase execution contracts onto the integrated predecessor snapshot;
      // original approved records are retained separately for provenance.
      writeResult(join(run_dir, `wave-${done.size}`), {
        base: waveBase,
        nodes: wave,
      });
      const settled = await Promise.allSettled(
        wave.map(async (n) => {
          const task = { ...n.task, base_ref: waveBase };
          const acceptance = {
            ...n.acceptance,
            base: waveBase,
            task_sha256: taskDigest(task),
            manual_evidence: [],
          };
          return runTask(
            path,
            task,
            {
              ...config,
              limits: {
                ...config.limits,
                run_seconds: Math.max(
                  1,
                  Math.floor((deadline - performance.now()) / 1000),
                ),
              },
            },
            codex,
            acceptance,
          );
        }),
      );
      const outcomes = settled.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : [],
      );
      result.worker_launch_errors = settled.flatMap((r) =>
        r.status === "rejected" ? [String(r.reason)] : [],
      );
      result.workers.push(...outcomes);
      save();
      if (
        settled.some((r) => r.status === "rejected") ||
        outcomes.some((r) => r.status !== "ready_for_human_review")
      )
        throw new Error(
          "Worker blocked or failed; retained worktrees require inspection",
        );
      for (const [index, r] of outcomes.entries()) {
        if (!r.review?.snapshot_commit)
          throw new Error("Missing reviewed worker snapshot");
        git(path, "cherry-pick", "--no-commit", r.review.snapshot_commit);
        if (git(path, "status", "--porcelain"))
          git(
            path,
            "-c",
            "user.name=Harness Integration",
            "-c",
            "user.email=harness@example.invalid",
            "commit",
            "-m",
            `Integrate ${wave[index]!.task.id} for verification`,
          );
        done.add(wave[index]!.task.id);
      }
    }
    result.status = "verifying";
    save();
    const violations = scopeViolations(
      w,
      plan.task.allowed_paths,
      resolvePolicy(config),
    );
    if (violations.length) throw new Error(violations.join("; "));
    const verification = await verifyProject(w, config, deadline);
    result.verification = verification;
    if (!verification.passed) throw new Error(verification.reason);
    result.candidate = verification.candidate;
    result.missing_evidence = missingEvidence(
      plan.acceptance,
      result.candidate,
    );
    result.status = "reviewing";
    save();
    result.review = await reviewCandidate(
      w,
      result.candidate!,
      Math.min(
        deadline,
        performance.now() + config.limits.agent_seconds * 1000,
      ),
      codex,
      {
        ...buildReviewPacket(
          plan.task,
          plan.acceptance,
          verification,
          result.candidate!,
        ),
        worker_reviews: result.workers.map((r) => ({
          task: r.task,
          review: r.review,
        })),
      },
    );
    if (!(result.review as { collected: boolean }).collected)
      throw new Error("Integrated review was not collected");
    result.status = (result.missing_evidence as string[]).length
      ? "awaiting_manual_evidence"
      : "ready_for_human_review";
    result.reason =
      "Integrated checks and independent review collected; worker and integration review findings require owner disposition. Main unchanged.";
  } catch (e) {
    result.status = "blocked";
    result.reason = e instanceof Error ? e.message : String(e);
  }
  save();
  return result;
}
