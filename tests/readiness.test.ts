import test from "node:test";
import assert from "node:assert/strict";
import { TASK } from "./helpers.js";
import { parseConfig } from "../harness/models.js";
import {
  assessReadiness,
  taskDigest,
  parseAcceptance,
  missingEvidence,
} from "../harness/readiness.js";
const config = parseConfig({
  schema_version: 1,
  checks: [{ name: "unit", argv: ["node", "check.mjs"] }],
});
const record = () => ({
  schema_version: 1,
  task_sha256: taskDigest(TASK),
  base: "a".repeat(40),
  unresolved_decisions: [],
  criteria: [
    {
      id: "sum",
      criterion: "Sum works",
      checks: ["unit"],
      manual: ["browser journey"],
    },
  ],
  manual_evidence: [],
});
test("readiness distinguishes planned manual evidence from readiness to implement", () => {
  const r = parseAcceptance(record());
  const result = assessReadiness(TASK, config, r);
  assert.equal(result.ready, true);
  assert.equal(result.missingEvidence.length, 1);
  assert.equal(missingEvidence(r, "b".repeat(64)).length, 1);
});
test("readiness blocks stale task, missing mappings and unknown checks", () => {
  for (const change of [
    { task_sha256: "b".repeat(64) },
    { criteria: [] },
    {
      criteria: [
        { id: "sum", criterion: "Sum works", checks: ["missing"], manual: [] },
      ],
    },
    { unresolved_decisions: ["storage choice"] },
  ]) {
    const r = parseAcceptance({ ...record(), ...change });
    assert.equal(assessReadiness(TASK, config, r).ready, false);
  }
});
test("manual evidence is candidate specific and cannot replace automated checks", () => {
  const r = parseAcceptance({
    ...record(),
    manual_evidence: [
      {
        criterion_id: "sum",
        requirement: "browser journey",
        candidate: "b".repeat(64),
        note: "Observed with browser",
      },
    ],
  });
  assert.deepEqual(missingEvidence(r, "b".repeat(64)), []);
  assert.equal(missingEvidence(r, "c".repeat(64)).length, 1);
  assert.throws(() =>
    parseAcceptance({ ...record(), manual_evidence: [{ done: true }] }),
  );
});
