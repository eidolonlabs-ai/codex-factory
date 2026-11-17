import { createHash } from "node:crypto";
import { basename } from "node:path";
import type { Config } from "./models.js";
export const legacyProtected = [
  "harness",
  "harness.json",
  "AGENTS.md",
  ".agents",
  ".codex",
  ".github",
  "tests",
  "schemas",
  "benchmarks",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
];
export interface ProtectionPolicy {
  version: 1 | 2;
  editable_paths: string[];
  protected_paths: string[];
}
export interface ScopeFinding {
  path: string;
  reason: string;
  disposition: "needs_review";
}
export const within = (path: string, prefix: string) =>
  path === prefix || path.startsWith(prefix + "/");
export function normalizedPath(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.includes("\\") ||
    /[\0\r\n]/.test(value) ||
    value.split("/").some((p) => ["", ".", "..", ".git"].includes(p))
  )
    throw new Error("Expected normalized repository-relative path");
}
export function resolvePolicy(config: Config): ProtectionPolicy {
  return config.schema_version === 1
    ? { version: 1, editable_paths: [], protected_paths: [...legacyProtected] }
    : {
        version: 2,
        editable_paths: [...config.policy!.editable_paths],
        protected_paths: [
          ...legacyProtected.filter((p) => p !== "tests"),
          "plugin-src",
          "plugins",
          "scripts/harness",
          ...config.policy!.protected_paths,
        ],
      };
}
export const policyDigest = (policy: ProtectionPolicy) =>
  createHash("sha256").update(JSON.stringify(policy)).digest("hex");
export function classifyChanges(
  paths: string[],
  allowed: string[],
  policy: ProtectionPolicy,
): ScopeFinding[] {
  return paths.flatMap((path) => {
    const reasons: string[] = [];
    if (!allowed.some((p) => within(path, p)))
      reasons.push("outside task scope");
    if (
      policy.version === 2 &&
      !policy.editable_paths.some((p) => within(path, p))
    )
      reasons.push("outside adopted editable paths");
    const nestedControl =
      policy.version === 2 &&
      ([
        "package.json",
        "package-lock.json",
        "npm-shrinkwrap.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "AGENTS.md",
        "harness.json",
      ].includes(basename(path)) ||
        /^tsconfig(?:\..+)?\.json$/.test(basename(path)) ||
        path
          .split("/")
          .some((p) => [".agents", ".codex", ".github", ".git"].includes(p)));
    if (nestedControl || policy.protected_paths.some((p) => within(path, p)))
      reasons.push("protected change needs human review");
    return reasons.map((reason) => ({
      path,
      reason,
      disposition: "needs_review" as const,
    }));
  });
}
