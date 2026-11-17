#!/usr/bin/env node
// Resolve implementation from the plugin, while preserving the caller's cwd.
if (
  Number(process.versions.node.split(".")[0]) < 22 ||
  !["darwin", "linux"].includes(process.platform)
) {
  console.error("Requires Node.js 22+ on macOS or Linux (including WSL).");
  process.exitCode = 2;
} else {
  await import("../runtime/cli.mjs");
}
