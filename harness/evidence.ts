import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  openSync,
  writeFileSync,
  fsyncSync,
  closeSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
export function writeResult(dir: string, result: unknown): void {
  const text =
    JSON.stringify(
      result,
      (_k, v) => {
        if (typeof v === "number" && !Number.isFinite(v))
          throw new Error("Nonfinite evidence");
        return v;
      },
      2,
    ) + "\n";
  mkdirSync(dir, { recursive: true });
  const file = join(dir, ".result-" + randomUUID());
  const fd = openSync(file, "wx", 0o600);
  try {
    try {
      writeFileSync(fd, text);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(file, join(dir, "result.json"));
  } finally {
    rmSync(file, { force: true });
  }
}
