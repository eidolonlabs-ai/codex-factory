import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { storage, snapshotCandidate, type Workspace } from "./workspace.js";
import { validateDisposition } from "./review-packet.js";
export interface RunSummary {
  run_id: string;
  status: string;
  phase: string;
  candidate?: string;
  base?: string;
  evidence: string;
  workspace?: string;
  freshness: "current" | "changed" | "unknown";
  blockers: string[];
  next_action: string;
}
export function locateRun(repo: string, runId: string): string {
  if (!/^[a-f0-9]{32}$/.test(runId)) throw new Error("Invalid run ID");
  const home = storage(repo);
  for (const kind of ["runs", "intake-runs", "verification"]) {
    const parent = join(home, kind),
      dir = join(parent, runId);
    if (existsSync(dir)) {
      if (lstatSync(parent).isSymbolicLink() || lstatSync(dir).isSymbolicLink())
        throw new Error("Unsafe evidence directory");
      return dir;
    }
  }
  throw new Error("Unknown run ID");
}
export function readRunRecord(
  repo: string,
  id: string,
): Record<string, unknown> {
  const path = join(locateRun(repo, id), "result.json");
  if (lstatSync(path).isSymbolicLink()) throw new Error("Unsafe result file");
  const result = JSON.parse(readFileSync(path, "utf8"));
  if (
    !result ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    result.schema_version !== 1 ||
    typeof result.status !== "string" ||
    result.run_id !== id
  )
    throw new Error("Malformed run record");
  return result;
}
export function readRunSummary(repo: string, runId: string): RunSummary {
  const evidence = locateRun(repo, runId);
  let r: Record<string, unknown>;
  try {
    r = readRunRecord(repo, runId);
  } catch {
    return {
      run_id: runId,
      status: "incomplete",
      phase: "unknown",
      evidence,
      freshness: "unknown",
      blockers: ["Missing or malformed result; inspect retained artifacts"],
      next_action:
        "Inspect evidence and retained work before starting a new run; do not delete locks automatically",
    };
  }
  const s: RunSummary = {
    run_id: runId,
    status: r.status as string,
    phase: typeof r.phase === "string" ? r.phase : (r.status as string),
    evidence,
    freshness: "unknown",
    blockers: [],
    next_action:
      "Inspect checks, review and retained diff; owner decides the next action",
  };
  if (typeof r.base === "string") s.base = r.base;
  if (typeof r.candidate === "string") s.candidate = r.candidate;
  if (typeof r.workspace === "string") s.workspace = r.workspace;
  if (s.candidate && s.workspace) {
    try {
      const root = realpathSync(s.workspace);
      if (storage(root) !== storage(repo))
        throw new Error("Unexpected workspace");
      s.freshness =
        snapshotCandidate({ path: root } as Workspace) === s.candidate
          ? "current"
          : "changed";
    } catch {
      s.freshness = "unknown";
    }
  }
  if (s.freshness === "changed")
    s.blockers.push("Candidate changed; rerun verification and review");
  if (s.freshness === "unknown") s.blockers.push("Candidate freshness unknown");
  if (
    ["created", "running", "repairing", "verifying", "reviewing"].includes(
      s.status,
    )
  )
    s.blockers.push(
      "Persisted running state is not verified live; inspect controller before recovery",
    );
  if (
    ["failed", "interrupted", "timed_out", "awaiting_manual_evidence"].includes(
      s.status,
    )
  )
    s.blockers.push(typeof r.reason === "string" ? r.reason : s.status);
  const review = r.review as
    { collected?: boolean; disposition?: unknown } | undefined;
  if (r.task && !review)
    s.blockers.push("Review not collected for this task candidate");
  if (review) {
    try {
      const disposition = validateDisposition(
        review.disposition,
        s.candidate ?? "",
      );
      if (disposition.decision !== "accepted")
        s.blockers.push(`Owner review disposition: ${disposition.decision}`);
    } catch {
      s.blockers.push("Owner review disposition pending or malformed");
    }
    if (!review.collected) s.blockers.push("Review was not collected");
  }
  if (Array.isArray(r.missing_evidence))
    s.blockers.push(
      ...r.missing_evidence.filter((x): x is string => typeof x === "string"),
    );
  return s;
}
export function listRuns(repo: string): RunSummary[] {
  const home = storage(repo);
  const ids: string[] = [];
  for (const kind of ["runs", "intake-runs", "verification"]) {
    const p = join(home, kind);
    if (!existsSync(p) || lstatSync(p).isSymbolicLink()) continue;
    ids.push(
      ...readdirSync(p)
        .filter((id) => /^[a-f0-9]{32}$/.test(id))
        .slice(-50),
    );
  }
  return [...new Set(ids)].map((id) => readRunSummary(repo, id));
}
export function renderHandoff(s: RunSummary): string {
  return [
    `Run: ${s.run_id}`,
    `Status: ${s.status} (${s.phase})`,
    `Base: ${s.base ?? "unknown"}`,
    `Candidate: ${s.candidate ?? "unknown"} (${s.freshness})`,
    `Workspace: ${s.workspace ?? "see artifacts"}`,
    `Evidence: ${s.evidence}`,
    ...s.blockers.map((b) => `Outstanding: ${b}`),
    `Next: ${s.next_action}`,
  ].join("\n");
}
