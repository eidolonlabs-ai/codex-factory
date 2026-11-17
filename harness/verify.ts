import { InterruptScope } from "./process.js";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { lstatSync } from "node:fs";
import {
  classifyChanges,
  legacyProtected,
  type ProtectionPolicy,
} from "./policy.js";
import type { Check } from "./models.js";
import { runProcess, type ProcessResult } from "./process.js";
import {
  changedPaths,
  snapshotCandidate,
  type Workspace,
} from "./workspace.js";
export interface VerificationResult {
  passed: boolean;
  reason: string;
  checks: (ProcessResult & { name: string })[];
  candidate?: string;
}
export function scopeViolations(
  w: Workspace,
  allowed: string[],
  policy: ProtectionPolicy = {
    version: 1,
    editable_paths: [],
    protected_paths: legacyProtected,
  },
): string[] {
  const paths = changedPaths(w);
  const findings = classifyChanges(paths, allowed, policy).map(
    (f) => `${f.reason}: ${f.path}`,
  );
  if (policy.version === 2)
    for (const path of paths) {
      const parts = path.split("/");
      for (let i = 1; i <= parts.length; i++) {
        try {
          if (lstatSync(join(w.path, ...parts.slice(0, i))).isSymbolicLink()) {
            findings.push(`symlink change needs human review: ${path}`);
            break;
          }
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
      }
    }
  return findings;
}
export async function verify(
  w: Workspace,
  checks: Check[],
  deadline: number,
): Promise<VerificationResult> {
  const interrupts = new InterruptScope();
  try {
    await interrupts.checkpoint();
    if (!checks.length)
      return {
        passed: false,
        reason: "No project checks configured",
        checks: [],
      };
    const before = snapshotCandidate(w),
      results: VerificationResult["checks"] = [];
    for (const [i, check] of checks.entries()) {
      const remaining = (deadline - performance.now()) / 1000;
      if (remaining <= 0)
        return {
          passed: false,
          reason: "Run deadline exhausted",
          checks: results,
        };
      await interrupts.checkpoint();
      const r = await runProcess(
        check.argv,
        w.path,
        Math.min(remaining, check.timeout_seconds),
        join(w.run_dir, "checks", `${randomUUID()}-${i}`),
      );
      await interrupts.checkpoint();
      results.push({ ...r, name: check.name });
      if (r.launch_error)
        return {
          passed: false,
          reason: `Check could not start: ${check.name}: ${r.launch_error}`,
          checks: results,
        };
      if (r.returncode || r.timed_out)
        return {
          passed: false,
          reason: `Check failed: ${check.name}`,
          checks: results,
        };
    }
    const same = before === snapshotCandidate(w);
    await interrupts.checkpoint();
    return {
      passed: same,
      reason: same ? "Checks passed" : "Candidate changed during verification",
      checks: results,
      candidate: before,
    };
  } finally {
    interrupts.dispose();
  }
}
