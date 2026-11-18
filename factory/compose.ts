import { randomUUID, createHash } from "node:crypto";
import { join, resolve, relative, isAbsolute } from "node:path";
import {
  readFileSync,
  lstatSync,
  realpathSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import type { Config } from "./models.js";
import { runProcess, Interrupted } from "./process.js";
import { verify, type VerificationResult } from "./verify.js";
import { snapshotCandidate, type Workspace } from "./workspace.js";

function assertInsideWorktree(
  realRoot: string,
  candidatePath: string,
  label: string,
): void {
  const resolved = realpathSync(resolve(realRoot, candidatePath));
  const rel = relative(realRoot, resolved);
  if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) {
    throw new Error(`Compose ${label} escapes worktree: ${candidatePath}`);
  }
  const relParts = rel.split("/").filter(Boolean);
  for (let i = 1; i <= relParts.length; i++) {
    if (lstatSync(join(realRoot, ...relParts.slice(0, i))).isSymbolicLink()) {
      throw new Error(`Compose ${label} uses symlink: ${candidatePath}`);
    }
  }
}

function assertSafeRepoFile(
  worktree: string,
  realRoot: string,
  relPath: string,
  label: string,
): void {
  const parts = relPath.split("/").filter(Boolean);
  for (let i = 1; i <= parts.length; i++) {
    if (lstatSync(join(worktree, ...parts.slice(0, i))).isSymbolicLink()) {
      throw new Error(`${label} must not traverse symlinks: ${relPath}`);
    }
  }
  const full = join(worktree, relPath);
  if (!lstatSync(full).isFile()) {
    throw new Error(`${label} must be a regular file: ${relPath}`);
  }
  const realFile = realpathSync(full);
  const rel = relative(realRoot, realFile);
  if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) {
    throw new Error(`${label} escapes worktree: ${relPath}`);
  }
}

function nonExemptHostContainers(
  psOutput: string,
  project: string,
): Set<string> {
  const out = new Set<string>();
  for (const rawLine of psOutput.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const [id = "", name = "", composeProj = ""] = line.split("\t");
    const label = composeProj.trim();
    const cname = name.trim();
    const target = label || cname;
    if (
      label === project ||
      cname.startsWith(`${project}-`) ||
      /^factory-/.test(target) ||
      /-[0-9a-f]{8}$/.test(target) ||
      /-preview$/.test(target)
    ) {
      continue;
    }
    out.add(`${id}:${cname}`);
  }
  return out;
}

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
  let hostContainersBefore: Set<string> | undefined;
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
    const realRoot = realpathSync(w.path);
    for (const f of c.files)
      assertSafeRepoFile(w.path, realRoot, f, "Compose file");
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
        service.uts ||
        service.cgroup ||
        service.userns_mode ||
        service.devices ||
        (Array.isArray(service.cap_add) && service.cap_add.length > 0) ||
        (Array.isArray(service.security_opt) &&
          service.security_opt.length > 0) ||
        (Array.isArray(service.volumes_from) &&
          service.volumes_from.length > 0) ||
        service.env_file
      )
        throw new Error(`Unsafe shared/privileged Compose service: ${name}`);
      if (service.build && typeof service.build === "object") {
        const buildObj = service.build as {
          context?: string;
          dockerfile?: string;
          dockerfile_inline?: string;
          additional_contexts?: Record<string, string>;
        };
        const ctxDir = buildObj.context ?? ".";
        assertInsideWorktree(
          realRoot,
          resolve(w.path, ctxDir),
          `build.context (${name})`,
        );
        if (buildObj.dockerfile && !buildObj.dockerfile_inline) {
          assertInsideWorktree(
            realRoot,
            resolve(resolve(w.path, ctxDir), buildObj.dockerfile),
            `build.dockerfile (${name})`,
          );
        }
        for (const [ctxName, ctxVal] of Object.entries(
          buildObj.additional_contexts ?? {},
        )) {
          if (
            typeof ctxVal === "string" &&
            !/^(?:service:|target:|docker-image:\/\/|https?:\/\/|oci-layout:\/\/)/.test(
              ctxVal,
            )
          ) {
            assertInsideWorktree(
              realRoot,
              resolve(w.path, ctxVal),
              `build.additional_contexts.${ctxName} (${name})`,
            );
          }
        }
      }
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
    for (const category of ["secrets", "configs"])
      for (const resource of Object.values(resolved[category] ?? {}) as any[]) {
        if (resource.external)
          throw new Error(`External Compose ${category} are not allowed`);
        if (typeof resource.file === "string")
          assertInsideWorktree(
            realRoot,
            resolve(w.path, resource.file),
            `${category}.file`,
          );
      }
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
    hostContainersBefore = nonExemptHostContainers(
      await step("ps-before", [
        docker,
        "ps",
        "-a",
        "--format",
        '{{.ID}}\t{{.Names}}\t{{.Label "com.docker.compose.project"}}',
      ]),
      project,
    );
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
        if (hostContainersBefore && !interruption) {
          const hostContainersAfter = nonExemptHostContainers(
            await step(
              "ps-after",
              [
                docker,
                "ps",
                "-a",
                "--format",
                '{{.ID}}\t{{.Names}}\t{{.Label "com.docker.compose.project"}}',
              ],
              true,
            ),
            project,
          );
          const changed =
            hostContainersBefore.size !== hostContainersAfter.size ||
            [...hostContainersBefore].some((x) => !hostContainersAfter.has(x));
          if (changed) {
            passed = false;
            reason += "; unrelated host containers changed";
          }
        }
      } catch (e) {
        passed = false;
        reason += `; cleanup failed: ${e instanceof Error ? e.message : e}`;
      }
    }
  }
  if (interruption) throw interruption;
  return { passed, reason, checks: results, candidate };
}
