import test from "node:test";
import assert from "node:assert/strict";
import { repo } from "./helpers.js";
import { storage, snapshotCandidate } from "../factory/workspace.js";
import { writeResult } from "../factory/evidence.js";
import { readRunSummary, renderHandoff, listRuns } from "../factory/status.js";
import { join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
test("status detects drift and handoff never claims a running record is live", (t) => {
  const r = repo(t);
  const id = "a".repeat(32);
  const candidate = snapshotCandidate({ path: r.path } as never);
  writeResult(join(storage(r.path), "runs", id), {
    schema_version: 1,
    run_id: id,
    status: "running",
    phase: "running",
    workspace: r.path,
    candidate,
    base: "HEAD",
  });
  let s = readRunSummary(r.path, id);
  assert.equal(s.freshness, "current");
  assert.match(renderHandoff(s), /not verified live/);
  writeFileSync(join(r.path, "src/a"), "changed");
  s = readRunSummary(r.path, id);
  assert.equal(s.freshness, "changed");
  assert.ok(s.blockers.some((b) => b.includes("changed")));
  assert.equal(listRuns(r.path).length, 1);
});
test("status rejects unsafe IDs and reports incomplete records without deleting them", (t) => {
  const r = repo(t);
  assert.throws(() => readRunSummary(r.path, "../secret"));
  const id = "b".repeat(32);
  mkdirSync(join(storage(r.path), "runs", id), { recursive: true });
  const s = readRunSummary(r.path, id);
  assert.equal(s.status, "incomplete");
  assert.match(renderHandoff(s), /inspect/i);
});
test("status preserves blocked orchestration reasons", (t) => {
  const r = repo(t);
  const id = "c".repeat(32);
  writeResult(join(storage(r.path), "orchestrations", id), {
    schema_version: 1,
    run_id: id,
    status: "blocked",
    phase: "orchestration",
    reason: "Worker blocked or failed; retained worktrees require inspection",
  });
  const s = readRunSummary(r.path, id);
  assert.ok(s.blockers.some((b) => b.includes("Worker blocked or failed")));
});
