import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fields, nonempty, type Config, type Task } from "./models.js";
export interface AcceptanceRecord {
  schema_version: 1;
  task_sha256: string;
  base: string;
  unresolved_decisions: string[];
  criteria: {
    id: string;
    criterion: string;
    checks: string[];
    manual: string[];
  }[];
  manual_evidence: {
    criterion_id: string;
    requirement: string;
    candidate: string;
    note: string;
  }[];
}
export interface ReadinessResult {
  ready: boolean;
  blockers: string[];
  missingEvidence: string[];
}
export const taskDigest = (task: Task) =>
  createHash("sha256").update(JSON.stringify(task)).digest("hex");
export const configDigest = (config: Config) =>
  createHash("sha256").update(JSON.stringify(config)).digest("hex");
const strings = (x: unknown): x is string[] =>
  Array.isArray(x) &&
  x.every((v) => typeof v === "string" && !!v.trim() && !v.includes("\0"));
export function parseAcceptance(data: unknown): AcceptanceRecord {
  fields(data, [
    "schema_version",
    "task_sha256",
    "base",
    "unresolved_decisions",
    "criteria",
    "manual_evidence",
  ]);
  if (
    data.schema_version !== 1 ||
    typeof data.task_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(data.task_sha256) ||
    typeof data.base !== "string" ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(data.base) ||
    !strings(data.unresolved_decisions) ||
    !Array.isArray(data.criteria) ||
    !Array.isArray(data.manual_evidence)
  )
    throw new Error("Invalid acceptance record");
  for (const c of data.criteria) {
    fields(c, ["id", "criterion", "checks", "manual"]);
    nonempty(c.id);
    nonempty(c.criterion);
    if (
      !strings(c.checks) ||
      !strings(c.manual) ||
      new Set(c.checks).size !== c.checks.length ||
      new Set(c.manual).size !== c.manual.length ||
      (!c.checks.length && !c.manual.length)
    )
      throw new Error("Invalid criterion mapping");
  }
  const criteria = data.criteria as AcceptanceRecord["criteria"];
  if (new Set(criteria.map((c) => c.id)).size !== criteria.length)
    throw new Error("Duplicate criterion IDs");
  for (const e of data.manual_evidence) {
    fields(e, ["criterion_id", "requirement", "candidate", "note"]);
    Object.values(e).forEach(nonempty);
    if (
      !/^[a-f0-9]{64}$/.test(e.candidate as string) ||
      !criteria.some(
        (c) =>
          c.id === e.criterion_id && c.manual.includes(e.requirement as string),
      )
    )
      throw new Error("Invalid manual evidence binding");
  }
  return structuredClone(data) as unknown as AcceptanceRecord;
}
export const loadAcceptance = (path: string) =>
  parseAcceptance(JSON.parse(readFileSync(path, "utf8")));
export function missingEvidence(
  record: AcceptanceRecord,
  candidate?: string,
): string[] {
  return record.criteria.flatMap((c) =>
    c.manual
      .filter(
        (requirement) =>
          !candidate ||
          !record.manual_evidence.some(
            (e) =>
              e.criterion_id === c.id &&
              e.requirement === requirement &&
              e.candidate === candidate,
          ),
      )
      .map((m) => `${c.id}: ${m}`),
  );
}
export function assessReadiness(
  task: Task,
  config: Config,
  record: AcceptanceRecord,
): ReadinessResult {
  const blockers: string[] = [];
  if (record.task_sha256 !== taskDigest(task))
    blockers.push("Task/specification changed since acceptance mapping");
  if (!config.checks.length) blockers.push("No project checks configured");
  if (record.unresolved_decisions.length)
    blockers.push(
      ...record.unresolved_decisions.map((s) => `Unresolved decision: ${s}`),
    );
  if (
    task.acceptance_criteria.length !== record.criteria.length ||
    task.acceptance_criteria.some(
      (c) => record.criteria.filter((r) => r.criterion === c).length !== 1,
    )
  )
    blockers.push("Every task criterion needs exactly one acceptance mapping");
  for (const c of record.criteria) {
    if (!task.acceptance_criteria.includes(c.criterion))
      blockers.push(`Unknown criterion: ${c.id}`);
    for (const name of c.checks)
      if (!config.checks.some((check) => check.name === name))
        blockers.push(`Unknown check: ${name}`);
  }
  return {
    ready: !blockers.length,
    blockers,
    missingEvidence: missingEvidence(record),
  };
}
