import { fields, nonempty, type Task } from "./models.js";
import { missingEvidence, type AcceptanceRecord } from "./readiness.js";
import type { VerificationResult } from "./verify.js";
export interface Disposition {
  candidate: string;
  decision: "pending" | "changes_requested" | "accepted";
  note: string;
}
export interface ReviewPacket {
  schema_version: 1;
  task: Task;
  acceptance?: AcceptanceRecord;
  candidate: string;
  verification: VerificationResult;
  missing_evidence: string[];
  disposition: Disposition;
}
export function buildReviewPacket(
  task: Task,
  acceptance: AcceptanceRecord | undefined,
  verification: VerificationResult,
  candidate: string,
): ReviewPacket {
  if (!/^[a-f0-9]{64}$/.test(candidate) || verification.candidate !== candidate)
    throw new Error("Verification does not match review candidate");
  return {
    schema_version: 1,
    task: structuredClone(task),
    ...(acceptance ? { acceptance: structuredClone(acceptance) } : {}),
    candidate,
    verification: structuredClone(verification),
    missing_evidence: acceptance
      ? missingEvidence(acceptance, candidate)
      : ["Legacy task has no explicit manual/live evidence mapping"],
    disposition: {
      candidate,
      decision: "pending",
      note: "Owner interpretation of review required",
    },
  };
}
export function validateDisposition(
  data: unknown,
  candidate: string,
): Disposition {
  fields(data, ["candidate", "decision", "note"]);
  nonempty(data.note);
  if (
    data.candidate !== candidate ||
    !["pending", "changes_requested", "accepted"].includes(
      data.decision as string,
    )
  )
    throw new Error("Invalid or stale owner disposition");
  return { ...data } as unknown as Disposition;
}
