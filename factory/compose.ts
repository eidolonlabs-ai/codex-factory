import { randomUUID, createHash } from "node:crypto";
import { join } from "node:path";
import { readFileSync, lstatSync, writeFileSync, mkdirSync } from "node:fs";
import type { Config } from "./models.js";
import { runProcess, Interrupted } from "./process.js";
import { verify, type VerificationResult } from "./verify.js";
import { snapshotCandidate, type Workspace } from "./workspace.js";

/** Trusted host runner. Compose definitions are reviewed executable configuration. */
export async function verifyProject(
  w: Workspace,
  config: Config,
  deadline: number,
  docker = "docker",
): Promise<VerificationResult> {
  if (config.schema_version !== 3) return verify(w, config.checks, deadline);
  const c = config.compose!;
  const candidate = snapshotCandidate(w);
  const project = `factory-${randomUUID().replaceAll("-", "")}`;
  let prefix = [
    docker,
    "compose",
    "--profile",
    "*",
    "--project-name",
    project,
    ...c.files.flatMap((f) => ["--file", join(w.path, f)]),
  ];
  const results: VerificationResult["checks"] = [];
  let started = false;
  let interruption: Interrupted | undefined;
  let reason = "Checks passed";
  let passed = false;
  const step = async (name: string, argv: string[], cleanup = false) => {
    const seconds = cleanup
      ? 30
      : Math.min(c.timeout_seconds, (deadline - performance.now()) / 1000);
    if (seconds <= 0)
      throw new Error("Compose verification deadline exhausted");
    const r = await runProcess(
      argv,
      w.path,
      seconds,
      join(w.run_dir, "compose", project, name),
    );
    results.push({ ...r, name: `compose:${name}` });
    if (r.returncode !== 0 || r.timed_out || r.launch_error)
      throw new Error(`Compose ${name} failed; inspect ${r.log_dir}`);
    return readFileSync(join(r.log_dir, "stdout.log"), "utf8");
  };
  try {
    for (const f of c.files)
      if (!lstatSync(join(w.path, f)).isFile())
        throw new Error(`Compose file must be a regular file: ${f}`);
    await step("version", [docker, "compose", "version"]);
    await step("daemon", [docker, "info", "--format", "{{.ServerVersion}}"]);
    const resolved = JSON.parse(
      await step("config", [...prefix, "config", "--format", "json"]),
    );
    // Fixed names, external resources and host binds defeat run-level isolation.
    for (const [name, service] of Object.entries(resolved.services ?? {}) as [
      string,
      any,
    ][]) {
      if (
        (service.build && service.image) ||
        service.container_name ||
        service.privileged ||
        service.network_mode ||
        service.pid ||
        service.ipc ||
        service.devices
      )
        throw new Error(`Unsafe shared/privileged Compose service: ${name}`);
      for (const port of service.ports ?? [])
        if (port.published && String(port.published) !== "0")
          throw new Error(`Use dynamically allocated ports: ${name}`);
      for (const volume of service.volumes ?? [])
        if (
          volume.type === "bind" ||
          (volume.type !== "volume" && volume.type !== "tmpfs")
        )
          throw new Error(
            `Host bind mounts are not allowed in acceptance: ${name}`,
          );
    }
    for (const category of ["volumes", "networks"])
      for (const resource of Object.values(resolved[category] ?? {}) as any[])
        if (
          resource.external ||
          resource.driver_opts ||
          (resource.driver && !["local", "bridge"].includes(resource.driver)) ||
          (resource.name && !resource.name.startsWith(project + "_"))
        )
          throw new Error(`Shared Compose ${category} are not allowed`);
    for (const name of [...c.services, c.test_service])
      if (!resolved.services?.[name])
        throw new Error(`Missing Compose service: ${name}`);
    for (const name of c.services)
      if (
        !resolved.services[name].healthcheck ||
        resolved.services[name].healthcheck.disable
      )
        throw new Error(`Healthcheck required: ${name}`);
    const frozen = join(w.run_dir, "compose", project, "resolved.json");
    mkdirSync(join(frozen, ".."), { recursive: true });
    writeFileSync(frozen, JSON.stringify(resolved, null, 2), { mode: 0o600 });
    prefix = [
      docker,
      "compose",
      "--profile",
      "*",
      "--project-name",
      project,
      "--project-directory",
      w.path,
      "--file",
      frozen,
    ];
    await step("build", [
      ...prefix,
      "build",
      "--pull",
      ...c.services,
      c.test_service,
    ]);
    started = true;
    await step("up", [
      ...prefix,
      "up",
      "--detach",
      "--wait",
      "--wait-timeout",
      String(
        Math.min(
          c.timeout_seconds,
          Math.max(1, Math.floor((deadline - performance.now()) / 1000)),
        ),
      ),
      ...c.services,
    ]);
    await step("e2e", [...prefix, "run", "--rm", "--no-deps", c.test_service]);
    await step("images", [...prefix, "images", "--format", "json"]);
    if (config.checks.length) {
      const local = await verify(w, config.checks, deadline);
      results.push(...local.checks);
      if (!local.passed) throw new Error(local.reason);
    }
    passed = snapshotCandidate(w) === candidate;
    if (!passed) reason = "Candidate changed during verification";
    // Keep the resolved definition in the bounded run artifacts; its digest is
    // included in the result reason without treating mutable image tags as pins.
    if (passed)
      reason += `; Compose config ${createHash("sha256").update(JSON.stringify(resolved)).digest("hex")}`;
  } catch (e) {
    if (e instanceof Interrupted) interruption = e;
    reason = e instanceof Error ? e.message : String(e);
  } finally {
    if (started) {
      try {
        await step(
          "logs",
          [...prefix, "logs", "--no-color", "--tail", "100"],
          true,
        );
      } catch {
        /* cleanup still required */
      }
      try {
        await step(
          "down",
          [
            ...prefix,
            "down",
            "--volumes",
            "--remove-orphans",
            "--timeout",
            "10",
          ],
          true,
        );
      } catch (e) {
        passed = false;
        reason += `; cleanup failed: ${e instanceof Error ? e.message : e}`;
      }
    }
  }
  if (interruption) throw interruption;
  return { passed, reason, checks: results, candidate };
}
