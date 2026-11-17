import { parseArgs } from "node:util";
import { resolve, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { doctor } from "./doctor.js";
import { runIntake } from "./intake.js";
import { loadConfig, loadTask, positive } from "./models.js";
import { runTask } from "./runner.js";
import { verify } from "./verify.js";
import { git, storage } from "./workspace.js";
import { Interrupted } from "./process.js";

export async function main(args = process.argv.slice(2)): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        repo: { type: "string" },
        config: { type: "string" },
        timeout: { type: "string" },
        model: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      console.log(
        "Codex harness: doctor | intake SOURCE | benchmark | run TASK | verify | status RUN_ID\nOptions: --repo PATH; --config PATH (run/verify); --timeout SECONDS --model MODEL (intake/benchmark)",
      );
      return 0;
    }
    const [command, arg] = positionals;
    const valid = ["doctor", "intake", "benchmark", "run", "verify", "status"];
    if (!command || !valid.includes(command))
      throw new Error(
        "Choose doctor, intake, benchmark, run, verify, or status",
      );
    const needsArg = ["run", "intake", "status"].includes(command);
    if (positionals.length !== (needsArg ? 2 : 1))
      throw new Error("Wrong number of command arguments");
    if (
      (values.config && !["run", "verify"].includes(command)) ||
      ((values.timeout || values.model) &&
        !["intake", "benchmark"].includes(command))
    )
      throw new Error("Option is not supported for this command");
    const repo = resolve(values.repo ?? ".");
    let result: unknown, success: boolean;
    if (command === "doctor") {
      const r = doctor(repo);
      result = r;
      success = r.healthy;
    } else if (command === "intake" || command === "benchmark") {
      const timeout =
        values.timeout === undefined ? 1200 : Number(values.timeout);
      positive(timeout);
      const source =
        command === "intake"
          ? resolve(arg!)
          : join(repo, "benchmarks/chronograph/input/original.docx");
      const r = await runIntake(
        source,
        join(storage(repo), "intake-runs"),
        timeout,
        "codex",
        values.model,
      );
      result = r;
      success = ["needs_clarification", "ready_for_planning"].includes(
        r.status,
      );
    } else if (command === "status") {
      if (!/^[0-9a-f]{32}$/.test(arg!)) throw new Error("Invalid run ID");
      const home = storage(repo);
      const path = [
        join(home, "runs", arg!, "result.json"),
        join(home, "intake-runs", arg!, "result.json"),
      ].find(existsSync);
      if (!path) throw new Error("Unknown run ID");
      result = JSON.parse(readFileSync(path, "utf8"));
      success = true;
    } else {
      const config = loadConfig(
        resolve(values.config ?? join(repo, "harness.json")),
      );
      if (command === "run") {
        const r = await runTask(repo, loadTask(resolve(arg!)), config);
        result = r;
        success = r.status === "ready_for_human_review";
      } else {
        const run_dir = join(
          storage(repo),
          "verification",
          randomUUID().replaceAll("-", ""),
        );
        const r = await verify(
          {
            path: repo,
            run_dir,
            lock: join(run_dir, "unused-lock"),
            base: git(repo, "rev-parse", "HEAD"),
            branch: "",
          },
          config.checks,
          performance.now() + config.limits.run_seconds * 1000,
        );
        result = r;
        success = r.passed;
      }
    }
    console.log(JSON.stringify(result, null, 2));
    return success ? 0 : 1;
  } catch (e) {
    console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
    return e instanceof Interrupted ? 130 : 2;
  }
}
process.exitCode = await main();
