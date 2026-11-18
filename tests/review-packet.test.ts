import test from "node:test";
import assert from "node:assert/strict";
import { TASK, repo, fake } from "./helpers.js";
import { parseConfig } from "../factory/models.js";
import {
  buildReviewPacket,
  validateDisposition,
} from "../factory/review-packet.js";
import { prepareWorkspace, snapshotCandidate } from "../factory/workspace.js";
import { reviewCandidate } from "../factory/review.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const candidate = "a".repeat(64);
test("review packet carries task, verification and unknown manual coverage explicitly", () => {
  const p = buildReviewPacket(
    TASK,
    undefined,
    { passed: true, reason: "Checks passed", checks: [], candidate },
    candidate,
  );
  assert.equal(p.task.specification, TASK.specification);
  assert.equal(p.candidate, candidate);
  assert.ok(p.missing_evidence.length);
  assert.equal(p.disposition.decision, "pending");
  assert.throws(() =>
    validateDisposition(
      { candidate: "b".repeat(64), decision: "accepted", note: "ok" },
      candidate,
    ),
  );
});
test("context review receives packet and zero exit does not accept findings", async (t) => {
  const r = repo(t);
  const w = prepareWorkspace(r.path, TASK, "packet");
  const digest = snapshotCandidate(w);
  const p = buildReviewPacket(
    TASK,
    undefined,
    { passed: true, reason: "Passed", checks: [], candidate: digest },
    digest,
  );
  const result = await reviewCandidate(
    w,
    digest,
    performance.now() + 10000,
    fake(
      r.root,
      `let input='';process.stdin.on('data',x=>input+=x);process.stdin.on('end',()=>{console.log(input);fs.writeFileSync(args[args.indexOf('--output-last-message')+1],'P1 finding: needs repair');console.log('P1 finding: needs repair');});`,
    ),
    p,
  );
  assert.equal(result.collected, true);
  assert.equal(result.disposition?.decision, "pending");
  const output = readFileSync(
    join(result.process!.log_dir, "stdout.log"),
    "utf8",
  );
  assert.match(output, /Implement sum/);
  assert.match(output, /Sum works/);
  assert.match(output, /Passed/);
});
test("empty or absent final reviewer messages are not collected", async (t) => {
  for (const mode of ["absent", "empty"]) {
    const r = repo(t);
    const w = prepareWorkspace(r.path, TASK, "empty-" + mode);
    const digest = snapshotCandidate(w);
    const p = buildReviewPacket(
      TASK,
      undefined,
      { passed: true, reason: "Passed", checks: [], candidate: digest },
      digest,
    );
    const script =
      mode === "empty"
        ? `fs.writeFileSync(args[args.indexOf('--output-last-message')+1],'   ');`
        : "";
    const result = await reviewCandidate(
      w,
      digest,
      performance.now() + 10000,
      fake(r.root, script),
      p,
    );
    assert.equal(result.collected, false, mode);
    assert.match(result.reason, /review.*(missing|empty)|message/i);
  }
});
