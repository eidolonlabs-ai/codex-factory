import { Interrupted } from "./process.js";
import { decideGuard, evaluateShellGuard } from "./guard.js";

export { decideGuard };
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  openSync,
  closeSync,
  unlinkSync,
  realpathSync,
  appendFileSync,
  lstatSync,
} from "node:fs";
import { join, resolve, relative } from "node:path";
import { loadConfig, type Config, type Task } from "./models.js";
import {
  assessReadiness,
  type AcceptanceRecord,
  configDigest,
  missingEvidence,
} from "./readiness.js";
import { classifyChanges, resolvePolicy } from "./policy.js";
import {
  git,
  storage,
  snapshotCandidate,
  type Workspace,
} from "./workspace.js";
import { verifyProject } from "./compose.js";
import { scopeViolations } from "./verify.js";
import { reviewCandidate } from "./review.js";
import { buildReviewPacket } from "./review-packet.js";
import { writeResult } from "./evidence.js";
export interface HookEvent {
  hook_event_name: string;
  cwd: string;
  session_id?: string;
  tool_name?: string;
  tool_input?: { command?: string; [key: string]: unknown };
}
interface Active {
  version: 1;
  workspace: string;
  task: Task;
  config: Config;
  acceptance: AcceptanceRecord;
  attempts: number;
  status: string;
  reason?: string;
  candidate?: string;
  run_dir?: string;
}
export function hookDirectory(repo: string) {
  const root = realpathSync(git(repo, "rev-parse", "--show-toplevel"));
  return join(
    storage(root),
    "hooks",
    createHash("sha256").update(root).digest("hex").slice(0, 24),
  );
}
function save(dir: string, state: Active) {
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `state-${randomUUID()}.tmp`);
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, join(dir, "active.json"));
}
export function activate(
  repo: string,
  task: Task,
  config: Config,
  acceptance: AcceptanceRecord,
) {
  if (config.schema_version !== 3)
    throw new Error(
      "Hook activation requires version 3 with Docker Compose acceptance",
    );
  const readiness = assessReadiness(task, config, acceptance);
  if (!readiness.ready) throw new Error(readiness.blockers.join("; "));
  if (git(repo, "rev-parse", task.base_ref + "^{commit}") !== acceptance.base)
    throw new Error("Acceptance base changed");
  const dir = hookDirectory(repo);
  if (existsSync(join(dir, "active.json")))
    throw new Error(
      "Active task exists; inspect and explicitly deactivate it before replacing",
    );
  const state: Active = {
    version: 1,
    workspace: realpathSync(repo),
    task,
    config,
    acceptance,
    attempts: 0,
    status: "active",
  };
  save(dir, state);
  return state;
}
export function hookStatus(repo: string) {
  return JSON.parse(
    readFileSync(join(hookDirectory(repo), "active.json"), "utf8"),
  ) as Active;
}
export function deactivate(repo: string) {
  const dir = hookDirectory(repo);
  const state = hookStatus(repo);
  if (existsSync(join(dir, "gate.lock")))
    throw new Error("Gate running; do not deactivate");
  renameSync(
    join(dir, "active.json"),
    join(dir, `archived-${Date.now()}-${randomUUID()}.json`),
  );
  return { status: "deactivated", previous_status: state.status };
}
export function guardCommand(command: string): string | undefined {
  if (/--no-verify\b|\bHUSKY\s*=\s*0\b|core\.hooksPath\s*=/i.test(command))
    return "Verification bypass is prohibited";
  if (
    /\brm\s+(?:[^\n;&|]*\s)?-[a-z]*r[a-z]*f|\brm\s+(?:[^\n;&|]*\s)?-[a-z]*f[a-z]*r|\bgit\s+(?:reset\s+--hard|clean\s+-[^\n]*f)|\bdocker\s+(?:system|volume|container|image)\s+prune/i.test(
      command,
    )
  )
    return "Destructive bulk operation requires a separate operator action";
  const evalResult = evaluateShellGuard(command, { respectOutside: false });
  if (evalResult.decision !== "allow") {
    return (
      evalResult.reason ??
      "Destructive or restricted shell operation is prohibited"
    );
  }
  return undefined;
}
export function patchPaths(command: string): string[] {
  return [
    ...command.matchAll(
      /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm,
    ),
  ].map((m) => m[1]!);
}
function deny(reason: string) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}
export async function handleHook(event: HookEvent) {
  let repo: string;
  try {
    repo = realpathSync(git(event.cwd, "rev-parse", "--show-toplevel"));
  } catch {
    return {};
  }
  const dir = hookDirectory(repo);
  if (!existsSync(join(repo, "factory.json")) && !existsSync(dir)) return {}; // adopted projects only
  mkdirSync(dir, { recursive: true });
  // Bounded audit contains no command arguments or credentials.
  const audit = join(dir, "events.jsonl");
  if (existsSync(audit) && readFileSync(audit).length > 65536)
    renameSync(audit, join(dir, "events.previous.jsonl"));
  appendFileSync(
    audit,
    JSON.stringify({
      at: new Date().toISOString(),
      event: event.hook_event_name,
      tool: event.tool_name,
    }) + "\n",
  );
  let active: Active | undefined;
  if (existsSync(join(dir, "active.json"))) active = hookStatus(repo);
  const managedPath = join(dir, "managed.json");
  const managedRecord:
    { task: Task; config: Config; token: string } | undefined = existsSync(
    managedPath,
  )
    ? JSON.parse(readFileSync(managedPath, "utf8"))
    : undefined;
  const managed =
    managedRecord?.token &&
    managedRecord.token === process.env.CODEX_FACTORY_WORKER_TOKEN
      ? managedRecord
      : undefined;
  if (managedRecord && !managed && event.hook_event_name === "Stop")
    return {
      continue: false,
      stopReason: "Retained managed context has no matching worker invocation",
      systemMessage:
        "Factory blocked: inspect controller/worktree before recovery; no live supervision is established.",
    };
  if (!active && !managed && !existsSync(join(repo, "factory.json")))
    return event.hook_event_name === "PreToolUse"
      ? deny("Adopted configuration removed; operator review required")
      : {
          continue: false,
          stopReason: "Adopted configuration removed",
          systemMessage: "Factory blocked; acceptance not complete",
        };
  const config =
    active?.config ?? managed?.config ?? loadConfig(join(repo, "factory.json"));
  const sessionFile = join(
    dir,
    "session-" +
      createHash("sha256")
        .update(event.session_id ?? "unknown")
        .digest("hex")
        .slice(0, 24) +
      ".json",
  );
  if (event.hook_event_name === "SessionStart" && !existsSync(sessionFile))
    writeFileSync(
      sessionFile,
      JSON.stringify({
        candidate: snapshotCandidate({ path: repo } as Workspace),
      }),
    );
  if (event.hook_event_name === "SessionStart")
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: `Codex Factory guards active for adopted project. ${active ? `Task ${active.task.id}; state ${active.status}; repair attempts ${active.attempts}.` : "No interactive task activated. Use factory activate TASK --acceptance RECORD before implementation; read-only planning remains available."}`,
      },
    };
  if (event.hook_event_name === "PreToolUse") {
    const command = event.tool_input?.command ?? "";
    if (typeof command !== "string") return deny("Malformed tool command");
    const reason = guardCommand(command);
    if (reason) return deny(reason);
    if (["apply_patch", "Edit", "Write"].includes(event.tool_name ?? "")) {
      if (!active && !managed)
        return deny("Activate an approved task before implementation edits");
      const paths = patchPaths(command);
      if (!paths.length) return deny("Unrecognized patch format");
      const normalized = paths.map((p) =>
        relative(
          repo,
          resolve(
            realpathSync(event.cwd),
            p.startsWith(event.cwd + "/") ? p.slice(event.cwd.length + 1) : p,
          ),
        ),
      );
      if (normalized.some((p) => p.startsWith("../") || !p || p.includes("\0")))
        return deny("Patch leaves repository");
      for (const p of normalized) {
        const parts = p.split("/");
        for (let i = 1; i <= parts.length; i++)
          try {
            if (lstatSync(join(repo, ...parts.slice(0, i))).isSymbolicLink())
              return deny("Patch through symlink is not allowed");
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
          }
      }
      const policy = resolvePolicy(config);
      const violations = classifyChanges(
        normalized,
        active?.task.allowed_paths ?? managed!.task.allowed_paths,
        policy,
      );
      if (violations.length)
        return deny(violations.map((v) => `${v.path}: ${v.reason}`).join("; "));
    }
    return {};
  }
  if (event.hook_event_name !== "Stop") return {};
  if (managed)
    return {
      systemMessage:
        "Controller-managed worker: controller owns independent verification and review.",
    };
  if (!active) {
    const baseline = existsSync(sessionFile)
      ? JSON.parse(readFileSync(sessionFile, "utf8")).candidate
      : undefined;
    const changed = baseline
      ? baseline !== snapshotCandidate({ path: repo } as Workspace)
      : !!git(repo, "status", "--porcelain");
    return changed
      ? {
          continue: false,
          stopReason: "Implementation changes have no active approved task",
          systemMessage:
            "Factory BLOCKED: activate a scoped task and verify these changes; completion is not accepted.",
        }
      : {};
  }
  if (["blocked", "interrupted"].includes(active.status))
    return {
      continue: false,
      stopReason: active.reason,
      systemMessage: `Factory BLOCKED: ${active.reason}. Inspect factory hooks-status; explicit deactivate/reactivate required to retry.`,
    };
  const lock = join(dir, "gate.lock");
  let fd: number;
  try {
    fd = openSync(lock, "wx", 0o600);
  } catch {
    return {
      continue: false,
      stopReason:
        "Factory gate lock exists; inspect running gate before recovery",
      systemMessage: "Task completion is not verified",
    };
  }
  closeSync(fd);
  const id = randomUUID().replaceAll("-", "");
  const w: Workspace = {
    path: repo,
    run_dir: join(storage(repo), "verification", id),
    base: active.acceptance.base,
    branch: "",
    lock: "",
  };
  try {
    if (!existsSync(join(repo, "factory.json")))
      throw new Error("Frozen factory configuration changed: file removed");
    if (
      configDigest(loadConfig(join(repo, "factory.json"))) !==
      configDigest(active.config)
    )
      throw new Error(
        "Frozen factory configuration changed; operator review required",
      );
    if (active.attempts >= config.limits.attempts)
      throw new Error("Interactive repair budget exhausted");
    active.status = "verifying";
    active.run_dir = w.run_dir;
    save(dir, active);
    writeResult(w.run_dir, {
      schema_version: 1,
      run_id: id,
      status: "verifying",
      phase: "hooks",
      workspace: repo,
      base: w.base,
      task: active.task,
    });
    const violations = scopeViolations(
      w,
      active.task.allowed_paths,
      resolvePolicy(config),
    );
    if (violations.length) throw new Error(violations.join("; "));
    const deadline =
      performance.now() + Math.min(config.limits.run_seconds, 1500) * 1000;
    const verification = await verifyProject(w, config, deadline);
    if (!verification.passed) throw new Error(verification.reason);
    const pending = missingEvidence(active.acceptance, verification.candidate);
    if (pending.length)
      throw new Error("Manual evidence required: " + pending.join("; "));
    const review = await reviewCandidate(
      w,
      verification.candidate!,
      Math.min(
        deadline,
        performance.now() + config.limits.agent_seconds * 1000,
      ),
      "codex",
      buildReviewPacket(
        active.task,
        active.acceptance,
        verification,
        verification.candidate!,
      ),
    );
    if (!review.collected) throw new Error(review.reason);
    active.status = "ready_for_human_review";
    active.candidate = verification.candidate;
    active.reason =
      "Checks passed and independent review collected; owner disposition pending";
    writeResult(w.run_dir, {
      ...verification,
      schema_version: 1,
      run_id: id,
      status: active.status,
      phase: "hooks",
      workspace: repo,
      base: w.base,
      task: active.task,
      review,
      missing_evidence: pending,
      config_sha256: configDigest(config),
    });
    save(dir, active);
    return { systemMessage: active.reason + `; evidence ${w.run_dir}` };
  } catch (e) {
    if (!(e instanceof Interrupted)) active.attempts++;
    active.reason = e instanceof Error ? e.message : String(e);
    active.status =
      e instanceof Interrupted
        ? "interrupted"
        : active.attempts >= config.limits.attempts ||
            /configuration changed|scope|protected|Manual evidence/.test(
              active.reason,
            )
          ? "blocked"
          : "repair_needed";
    save(dir, active);
    writeResult(w.run_dir, {
      schema_version: 1,
      run_id: id,
      status: active.status,
      phase: "hooks",
      workspace: repo,
      base: w.base,
      reason: active.reason,
      task: active.task,
    });
    return ["blocked", "interrupted"].includes(active.status)
      ? {
          continue: false,
          stopReason: active.reason,
          systemMessage:
            "Factory BLOCKED; acceptance not complete: " + active.reason,
        }
      : {
          decision: "block",
          reason: `Factory acceptance failed (${active.attempts}/${config.limits.attempts}): ${active.reason}. Inspect ${w.run_dir}, repair implementation without weakening checks, then finish again.`,
        };
  } finally {
    unlinkSync(lock);
  }
}

export function managedContext(repo: string, task: Task, config: Config) {
  const dir = hookDirectory(repo);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, "managed.json");
  const token = randomUUID();
  writeFileSync(p, JSON.stringify({ task, config, token }), {
    flag: "wx",
    mode: 0o600,
  });
  return Object.assign(() => unlinkSync(p), { token });
}
