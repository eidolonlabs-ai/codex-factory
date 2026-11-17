import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { loadConfig } from "./models.js";
import { git } from "./workspace.js";
export interface DoctorReport {
  healthy: boolean;
  errors: string[];
  node: string;
  platform: string;
  authentication: string;
  base?: string;
  codex_version?: string;
}
export function doctor(
  repo: string,
  codex = "codex",
  mode: "managed" | "verify" = "managed",
): DoctorReport {
  const result: DoctorReport = {
    healthy: true,
    errors: [],
    node: process.version,
    platform: process.platform,
    authentication: "not tested",
  };
  if (
    Number(process.versions.node.split(".")[0]) < 22 ||
    !["darwin", "linux"].includes(process.platform)
  )
    result.errors.push(
      "Requires Node.js 22+ on macOS or Linux (WSL supported as Linux)",
    );
  try {
    result.base = git(repo, "rev-parse", "--verify", "HEAD");
    if (mode === "managed" && git(repo, "status", "--porcelain"))
      result.errors.push(
        "Repository is dirty; commit or move changes before a managed run",
      );
  } catch (e) {
    result.errors.push(`Git repository: ${String(e)}`);
  }
  try {
    if (!loadConfig(join(repo, "harness.json")).checks.length)
      result.errors.push("Project verification checks are not configured");
  } catch (e) {
    result.errors.push(`Project configuration: ${String(e)}`);
  }
  if (mode === "managed")
    try {
      const probes: [string[], string[]][] = [
        [["--version"], []],
        [
          ["exec", "--help"],
          ["--sandbox", "--json", "--output-schema", "--output-last-message"],
        ],
        [["review", "--help"], ["--base"]],
      ];
      for (const [args, required] of probes) {
        const out = execFileSync(codex, args, {
          encoding: "utf8",
          timeout: 10000,
          stdio: ["ignore", "pipe", "pipe"],
        });
        if (required.some((flag) => !out.includes(flag)))
          throw new Error("Unsupported Codex capabilities");
        if (args[0] === "--version") result.codex_version = out.trim();
      }
    } catch (e) {
      result.errors.push(`Codex: ${String(e)}`);
    }
  result.healthy = !result.errors.length;
  return result;
}
