---
name: factory-build
description: Phase 3 isolated execution in Codex Desktop, Worktree chat (`codex --worktree`), or controller-managed `run` / `orchestrate`. Verifies locked specs and frozen Milestone 1.5 tests exist first, routing back to `$factory-intake` / `$factory-plan` if missing.
---
# Phase 3: Build an Approved Task (`factory-build`)

**Interactive work is the default in Desktop and CLI.** Read the approved spec and task card/JSON. Confirm base commit, acceptance criteria, file ownership, dependencies, and required checks. Implement directly in this chat's workspace (or an isolated Desktop **Worktree chat** via `codex --worktree` / `/worktree`). When the owner explicitly selects unattended execution, use the controller (`npm run factory -- doctor` then `run` or `orchestrate`); otherwise implement interactively.

> **Pre-Flight Spec & Test Check (Pushback Gate):** Before modifying application code on non-trivial work, verify an approved spec, pinned base commit, `allowed_paths`, acceptance mapping, and landed Milestone 1.5 / reproduction tests exist. If intake or planning was skipped, stop and route back to `$factory-intake` and `$factory-plan`.

1. **Enforce Worktree & Ownership Boundaries**:
   - Parallel builders run in separate Desktop Worktree chats (or controller-managed `orchestrate` worktrees), never shared-workspace subagents.
   - Stay strictly within `allowed_paths`. Never edit protected acceptance tests, `factory.json`, or another builder's owned files.
   - If a dependency is missing, a shared contract must change, or a decision is unresolved, stop and report the blocker to the coordinator (`$factory-pipeline`).
2. **Reproduce Bugs & Enforce Context Hygiene**:
   - For bug fixes and review findings, capture a failing regression test first (`docs/design-checklist.md`) before changing implementation code.
   - Redirect heavy build/test logs to `/tmp/*.log` and inspect only the tail.
3. **Run Verification & Circuit Breaker**:
   - Activate v3 tasks before editing in interactive plugin mode (`docs/hooks.md`).
   - Run targeted checks and invoke `$factory-verify`. Never weaken acceptance tests, CI, or verifier commands, and never disable hooks.
   - After 3 unsuccessful repair cycles, stop and return the exact failure evidence for a scope/dependency decision. The installed Stop hook also enforces its failed-attempt budget for activated tasks.
4. **Handoff**:
   Return the task ID, base/HEAD, complete changed-file list, diff or commit, check results, and remaining gaps. Do not merge or publish; proceed to `$factory-verify` and `$factory-review` on the integrated candidate.
