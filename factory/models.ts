import { readFileSync } from "node:fs";
import { normalizedPath } from "./policy.js";

export interface Task {
  schema_version: 1;
  id: string;
  title: string;
  specification: string;
  acceptance_criteria: string[];
  allowed_paths: string[];
  base_ref: string;
}
export interface Check {
  name: string;
  argv: string[];
  timeout_seconds: number;
}
export interface Config {
  schema_version: 1 | 2 | 3;
  compose?: {
    files: string[];
    services: string[];
    test_service: string;
    timeout_seconds: number;
  };
  policy?: { editable_paths: string[]; protected_paths: string[] };
  checks: Check[];
  limits: { attempts: number; agent_seconds: number; run_seconds: number };
  model: string | null;
}
export function fields(
  value: unknown,
  required: string[],
  optional: string[] = [],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    required.some((k) => !Object.hasOwn(value, k)) ||
    Object.keys(value).some(
      (k) => !required.includes(k) && !optional.includes(k),
    )
  )
    throw new Error(`Expected fields ${required}; optional ${optional}`);
}
export function nonempty(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.includes("\0"))
    throw new Error("Expected nonempty string without NUL");
}
export function positive(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0)
    throw new Error("Limits must be positive safe integers");
}
function strings(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error("Expected nonempty string array");
  value.forEach(nonempty);
}
export function parseTask(data: unknown): Task {
  fields(data, [
    "schema_version",
    "id",
    "title",
    "specification",
    "acceptance_criteria",
    "allowed_paths",
    "base_ref",
  ]);
  if (data.schema_version !== 1) throw new Error("Unsupported schema_version");
  for (const k of ["id", "title", "specification", "base_ref"])
    nonempty(data[k]);
  const { id, base_ref } = data as unknown as Task;
  if (
    id.match(/^[a-z0-9][a-z0-9-]{0,47}$/)?.[0] !== id ||
    base_ref.startsWith("-")
  )
    throw new Error("Unsafe task ID or base ref");
  strings(data.acceptance_criteria);
  strings(data.allowed_paths);
  for (const p of data.allowed_paths)
    if (
      p.includes("\\") ||
      p.split("/").some((x) => ["", ".", "..", ".git"].includes(x))
    )
      throw new Error("Scopes must be normalized repository-relative paths");
  return structuredClone(data) as unknown as Task;
}
export function parseConfig(data: unknown): Config {
  fields(
    data,
    ["schema_version", "checks"],
    ["limits", "model", "policy", "compose"],
  );
  if (
    ![1, 2, 3].includes(data.schema_version as number) ||
    !Array.isArray(data.checks)
  )
    throw new Error("Invalid configuration");
  if (data.schema_version === 1 && Object.hasOwn(data, "policy"))
    throw new Error("Version 1 does not accept policy");
  if (data.schema_version !== 1) {
    fields(data.policy, ["editable_paths", "protected_paths"]);
    for (const key of ["editable_paths", "protected_paths"]) {
      strings(data.policy[key]);
      (data.policy[key] as string[]).forEach(normalizedPath);
      if (
        new Set(data.policy[key] as string[]).size !==
        (data.policy[key] as string[]).length
      )
        throw new Error("Duplicate policy paths");
    }
  }
  if (data.schema_version === 3) {
    fields(
      data.compose,
      ["files", "services", "test_service"],
      ["timeout_seconds"],
    );
    strings(data.compose.files);
    data.compose.files.forEach(normalizedPath);
    strings(data.compose.services);
    nonempty(data.compose.test_service);
    for (const s of [...data.compose.services, data.compose.test_service])
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(s))
        throw new Error("Invalid Compose service");
    const composeTimeout =
      (data.compose as Record<string, unknown>).timeout_seconds === undefined
        ? 600
        : (data.compose as Record<string, unknown>).timeout_seconds;
    positive(composeTimeout);
  } else if (data.compose !== undefined)
    throw new Error("Compose requires version 3");
  const checks: Check[] = data.checks.map((c) => {
    fields(c, ["name", "argv"], ["timeout_seconds"]);
    nonempty(c.name);
    strings(c.argv);
    const timeout = c.timeout_seconds === undefined ? 600 : c.timeout_seconds;
    positive(timeout);
    return { name: c.name, argv: [...c.argv], timeout_seconds: timeout };
  });
  if (new Set(checks.map((c) => c.name)).size !== checks.length)
    throw new Error("Duplicate check names");
  const limits = data.limits === undefined ? {} : data.limits;
  fields(limits, [], ["attempts", "agent_seconds", "run_seconds"]);
  Object.values(limits).forEach(positive);
  const model = data.model ?? null;
  if (model !== null) nonempty(model);
  return {
    schema_version: data.schema_version,
    ...(data.schema_version !== 1
      ? { policy: structuredClone(data.policy) }
      : {}),
    ...(data.schema_version === 3
      ? {
          compose: {
            ...(data.compose as object),
            timeout_seconds:
              (data.compose as Record<string, unknown>).timeout_seconds ===
              undefined
                ? 600
                : (data.compose as Record<string, unknown>).timeout_seconds,
          },
        }
      : {}),
    checks,
    limits: { attempts: 3, agent_seconds: 1200, run_seconds: 5400, ...limits },
    model,
  } as Config;
}
export const loadTask = (path: string): Task =>
  parseTask(JSON.parse(readFileSync(path, "utf8")));
export const loadConfig = (path: string): Config =>
  parseConfig(JSON.parse(readFileSync(path, "utf8")));
