import { constants } from "node:os";
import { setImmediate as yieldEventLoop } from "node:timers/promises";
import { spawn } from "node:child_process";
import { mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ProcessResult {
  argv: string[];
  returncode: number;
  timed_out: boolean;
  duration_seconds: number;
  log_dir: string;
  launch_error: string | null;
}
export class Interrupted extends Error {
  constructor() {
    super("Interrupted by operator");
  }
}
// Keep signal ownership across synchronous Git/hash phases, not only child waits.
export class InterruptScope {
  private interrupted = false;
  private readonly handler = () => {
    this.interrupted = true;
  };
  constructor() {
    process.on("SIGINT", this.handler);
    process.on("SIGTERM", this.handler);
  }
  async checkpoint(): Promise<void> {
    await yieldEventLoop();
    if (this.interrupted) throw new Interrupted();
  }
  dispose(): void {
    process.off("SIGINT", this.handler);
    process.off("SIGTERM", this.handler);
  }
}
function killGroup(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(-pid, signal);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e;
  }
}
export async function runProcess(
  argv: string[],
  cwd: string,
  seconds: number,
  log_dir: string,
  stdin = "",
): Promise<ProcessResult> {
  if (process.platform === "win32")
    throw new Error("Use WSL: POSIX process groups are required");
  if (!argv.length || !Number.isFinite(seconds) || seconds <= 0)
    throw new Error("Invalid process command or timeout");
  mkdirSync(log_dir, { recursive: true });
  writeFileSync(join(log_dir, "stdin.txt"), stdin);
  const input = openSync(join(log_dir, "stdin.txt"), "r"),
    out = openSync(join(log_dir, "stdout.log"), "w"),
    err = openSync(join(log_dir, "stderr.log"), "w");
  const start = performance.now();
  let timed_out = false,
    interrupted = false;
  let timer: NodeJS.Timeout | undefined;
  let force: NodeJS.Timeout | undefined;
  const child = spawn(argv[0]!, argv.slice(1), {
    cwd,
    detached: true,
    stdio: [input, out, err],
    shell: false,
  });
  const stop = () => {
    if (child.pid) {
      killGroup(child.pid, "SIGTERM");
      force ??= setTimeout(() => killGroup(child.pid!, "SIGKILL"), 1000);
    }
  };
  const interrupt = () => {
    interrupted = true;
    stop();
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  try {
    const result = await new Promise<{ code: number; error: string | null }>(
      (resolve) => {
        child.once("error", (e) => resolve({ code: 127, error: e.message }));
        child.once("exit", (code, signal) =>
          resolve({
            code: code ?? (signal ? -constants.signals[signal] : -1),
            error: null,
          }),
        );
        timer = setTimeout(
          () => {
            timed_out = true;
            stop();
          },
          Math.min(seconds * 1000, 2_147_483_647),
        );
      },
    );
    if (child.pid) {
      killGroup(child.pid, "SIGTERM");
      killGroup(child.pid, "SIGKILL");
    }
    if (result.error) writeFileSync(err, result.error);
    if (interrupted) throw new Interrupted();
    return {
      argv,
      returncode: result.code,
      timed_out,
      duration_seconds: (performance.now() - start) / 1000,
      log_dir,
      launch_error: result.error,
    };
  } finally {
    clearTimeout(timer);
    clearTimeout(force);
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    closeSync(input);
    closeSync(out);
    closeSync(err);
  }
}
