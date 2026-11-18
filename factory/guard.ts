import { posix as posixPath } from "node:path";

export type GuardDecision = "allow" | "deny" | "ask";

export interface GuardContext {
  control_dir?: string;
  controlPrefixes?: string[];
  frozen?: string[] | ReadonlySet<string>;
  holdout_markers?: string[];
  holdoutMarkers?: string[];
}

export interface GuardEvaluation {
  decision: GuardDecision;
  reason?: string;
  outside?: boolean;
  rel?: string | null;
}

export interface GuardRequest {
  tool: "write" | "shell" | string;
  input: string;
  root?: string;
  cwd?: string;
  ctx?: GuardContext;
  unattended?: boolean;
}

export interface PathGuardOptions {
  root?: string;
  cwd?: string;
  ctx?: GuardContext;
  respectOutside?: boolean;
}

export interface ShellGuardOptions extends PathGuardOptions {
  depth?: number;
}

export const ALLOWED_ENV_TEMPLATES = new Set([
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.test",
]);

export const PRIVATE_KEY_BASENAMES = new Set([
  "id_rsa",
  "id_ed25519",
  "id_ecdsa",
  "id_dsa",
]);

const CATASTROPHIC_RM_TARGETS = new Set([
  "/",
  "/.",
  "/..",
  "/*",
  "~",
  "~/",
  "~/*",
  "$HOME",
  "${HOME}",
  "$HOME/",
  "${HOME}/",
  "$HOME/*",
  "${HOME}/*",
]);

const ENV_ASSIGNMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;
const COMMAND_PREFIX_WRAPPERS = new Set([
  "sudo",
  "env",
  "command",
  "nohup",
  "nice",
  "time",
  "exec",
]);
const SHELL_WRAPPER_CMDS = new Set(["sh", "bash", "zsh", "dash", "ksh", "ash"]);
const DOWNLOAD_CMDS = new Set(["curl", "wget", "fetch"]);
const PIPE_EXEC_TARGETS = new Set([
  ...SHELL_WRAPPER_CMDS,
  "python",
  "python3",
  "perl",
  "ruby",
  "node",
]);
const DOCKER_PRUNE_SCOPES = new Set([
  "system",
  "volume",
  "container",
  "image",
  "network",
  "builder",
  "buildx",
]);
const DOCKER_VALUE_FLAGS = new Set([
  "-H",
  "--host",
  "-c",
  "--context",
  "-l",
  "--log-level",
  "--config",
  "--tlscacert",
  "--tlscert",
  "--tlskey",
]);
const GIT_GLOBAL_VALUE_FLAGS = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--super-prefix",
  "--exec-path",
  "--config-env",
]);
const NO_VERIFY_GIT_SUBCOMMANDS = new Set([
  "commit",
  "merge",
  "push",
  "am",
  "cherry-pick",
  "revert",
  "rebase",
]);

function toPosix(value: string): string {
  return value.replace(/\\/g, "/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Unquote one shell word while keeping unescaped `$HOME` / `${HOME}` variable markers
 * and handling single-quoted literal segments and double-quoted escapes.
 */
export function unquoteShellToken(token: string): string {
  if (!token) return "";
  let out = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < token.length; i += 1) {
    const ch = token.charAt(i);
    if (inSingle) {
      if (ch === "'") inSingle = false;
      else out += ch;
      continue;
    }
    if (inDouble) {
      if (ch === "\\" && i + 1 < token.length) {
        const next = token.charAt(i + 1);
        if (next === '"' || next === "\\" || next === "$" || next === "`") {
          out += next;
          i += 1;
          continue;
        }
      }
      if (ch === '"') inDouble = false;
      else out += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
    } else if (ch === '"') {
      inDouble = true;
    } else if (ch === "\\" && i + 1 < token.length) {
      out += token.charAt(i + 1);
      i += 1;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Tokenize one pipeline segment while keeping quoted spans and `$(...)`/`...` substitutions intact.
 */
export function tokenizeShellSegment(segment: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let substDepth = 0;

  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment.charAt(i);
    const next = segment.charAt(i + 1);

    if (inSingle) {
      current += ch;
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === "\\" && i + 1 < segment.length) {
      current += ch + next;
      i += 1;
      continue;
    }
    if (inDouble) {
      current += ch;
      if (ch === "$" && next === "(") {
        substDepth += 1;
        current += "(";
        i += 1;
      } else if (substDepth > 0 && ch === ")") {
        substDepth -= 1;
      } else if (ch === "`") {
        inBacktick = !inBacktick;
      } else if (ch === '"' && substDepth === 0 && !inBacktick) {
        inDouble = false;
      }
      continue;
    }
    if (inBacktick) {
      current += ch;
      if (ch === "`") inBacktick = false;
      continue;
    }
    if (substDepth > 0) {
      current += ch;
      if (ch === "(") substDepth += 1;
      else if (ch === ")") substDepth -= 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      current += ch;
    } else if (ch === '"') {
      inDouble = true;
      current += ch;
    } else if (ch === "`") {
      inBacktick = true;
      current += ch;
    } else if (ch === "$" && next === "(") {
      substDepth = 1;
      current += "$(";
      i += 1;
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) tokens.push(current);
  return tokens;
}

/**
 * Split a shell command line into pipeline lists (`;`, `&&`, `||`, `&`, `\n`),
 * each split on unquoted pipes (`|`, `|&`).
 */
export function splitShellPipelines(commandLine: string): string[][] {
  const pipelines: string[][] = [];
  let currentPipeline: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let parenDepth = 0;

  const pushSegment = (): void => {
    const trimmed = current.trim();
    if (trimmed) currentPipeline.push(trimmed);
    current = "";
  };

  const pushPipeline = (): void => {
    pushSegment();
    if (currentPipeline.length > 0) pipelines.push(currentPipeline);
    currentPipeline = [];
  };

  for (let i = 0; i < commandLine.length; i += 1) {
    const ch = commandLine.charAt(i);
    const next = commandLine.charAt(i + 1);

    if (inSingle) {
      current += ch;
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === "\\" && i + 1 < commandLine.length) {
      current += ch + next;
      i += 1;
      continue;
    }
    if (inBacktick) {
      current += ch;
      if (ch === "`") inBacktick = false;
      continue;
    }
    if (inDouble) {
      current += ch;
      if (ch === "`") {
        inBacktick = true;
      } else if (ch === "$" && next === "(") {
        parenDepth += 1;
        current += "(";
        i += 1;
      } else if (parenDepth > 0 && ch === ")") {
        parenDepth -= 1;
      } else if (ch === '"' && parenDepth === 0) {
        inDouble = false;
      }
      continue;
    }

    if (parenDepth > 0) {
      current += ch;
      if (ch === "(") parenDepth += 1;
      else if (ch === ")") parenDepth -= 1;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      current += ch;
      continue;
    }
    if (ch === "`") {
      inBacktick = true;
      current += ch;
      continue;
    }
    if (ch === "$" && next === "(") {
      parenDepth = 1;
      current += "$(";
      i += 1;
      continue;
    }

    if (ch === "\n" || ch === ";") {
      pushPipeline();
      continue;
    }
    if ((ch === "&" && next === "&") || (ch === "|" && next === "|")) {
      pushPipeline();
      i += 1;
      continue;
    }
    if (ch === "&") {
      const prev = i > 0 ? commandLine.charAt(i - 1) : "";
      if (prev !== ">" && prev !== "<" && next !== ">") {
        pushPipeline();
        continue;
      }
    }
    if (ch === "|") {
      const prev = i > 0 ? commandLine.charAt(i - 1) : "";
      if (prev === ">") {
        current += ch;
        continue;
      }
      pushSegment();
      if (next === "&") i += 1;
      continue;
    }

    current += ch;
  }

  pushPipeline();
  return pipelines;
}

/**
 * Extract active `$(...)` and backtick command substitution bodies from a segment
 * (ignoring single-quoted literal text).
 */
export function extractCommandSubstitutions(segment: string): string[] {
  const inner: string[] = [];
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment.charAt(i);
    if (inSingle) {
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === "\\" && i + 1 < segment.length) {
      i += 1;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (ch === "`") {
      let j = i + 1;
      let body = "";
      while (j < segment.length) {
        const cur = segment.charAt(j);
        if (cur === "\\" && j + 1 < segment.length) {
          body += segment.charAt(j + 1);
          j += 2;
          continue;
        }
        if (cur === "`") break;
        body += cur;
        j += 1;
      }
      if (body.trim()) inner.push(body);
      i = j;
      continue;
    }
    if (ch === "$" && segment.charAt(i + 1) === "(") {
      let depth = 1;
      let j = i + 2;
      let body = "";
      let subSingle = false;
      let subDouble = false;
      while (j < segment.length && depth > 0) {
        const c = segment.charAt(j);
        if (subSingle) {
          body += c;
          if (c === "'") subSingle = false;
          j += 1;
          continue;
        }
        if (c === "\\" && j + 1 < segment.length) {
          body += c + segment.charAt(j + 1);
          j += 2;
          continue;
        }
        if (c === "'" && !subDouble) {
          subSingle = true;
          body += c;
          j += 1;
          continue;
        }
        if (c === '"') {
          subDouble = !subDouble;
          body += c;
          j += 1;
          continue;
        }
        if (!subDouble) {
          if (c === "(") depth += 1;
          else if (c === ")") {
            depth -= 1;
            if (depth === 0) break;
          }
        }
        body += c;
        j += 1;
      }
      if (body.trim()) inner.push(body);
      i = j;
    }
  }
  return inner;
}

function normalizeGuardContext(ctx: GuardContext = {}): {
  controlPrefixes: string[];
  frozenSet: Set<string>;
  holdoutMarkers: string[];
} {
  const rawControls = ctx.controlPrefixes
    ? ctx.controlPrefixes
    : ctx.control_dir
      ? [ctx.control_dir]
      : [".factory/"];
  const controlPrefixes = rawControls
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => {
      const clean = toPosix(v.trim()).replace(/^\.\//, "");
      return clean.endsWith("/") ? clean : `${clean}/`;
    });

  const rawFrozen = ctx.frozen ? [...ctx.frozen] : [];
  const frozenSet = new Set(
    rawFrozen
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => posixPath.normalize(toPosix(v.trim())).replace(/^\.\//, "")),
  );

  const rawHoldout = ctx.holdoutMarkers ??
    ctx.holdout_markers ?? ["holdout/", ".holdout."];
  const holdoutMarkers = rawHoldout
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => toPosix(v.trim()).toLowerCase());

  return {
    controlPrefixes:
      controlPrefixes.length > 0 ? controlPrefixes : [".factory/"],
    frozenSet,
    holdoutMarkers:
      holdoutMarkers.length > 0 ? holdoutMarkers : ["holdout/", ".holdout."],
  };
}

function relativeToRoot(
  rawPath: string,
  root: string,
  cwd?: string,
): { outside: boolean; rel: string | null } {
  const cleaned = unquoteShellToken(rawPath).trim();
  const posixRaw = toPosix(cleaned);
  if (
    !posixRaw ||
    posixRaw === "~" ||
    posixRaw.startsWith("~/") ||
    posixRaw.startsWith("$HOME") ||
    posixRaw.startsWith("${HOME}")
  ) {
    return { outside: true, rel: null };
  }

  const absRoot = posixPath.resolve(toPosix(root || "/"));
  const baseDir = cwd ? posixPath.resolve(absRoot, toPosix(cwd)) : absRoot;
  const resolved = posixPath.resolve(baseDir, posixRaw);
  const rel = posixPath.relative(absRoot, resolved);
  const outside =
    rel === ".." || rel.startsWith("../") || posixPath.isAbsolute(rel);

  return {
    outside,
    rel: outside ? null : rel === "" ? "." : rel,
  };
}

function matchesHoldoutMarker(
  candidatePath: string,
  holdoutMarkers: string[],
): boolean {
  const lower = candidatePath.toLowerCase();
  const segments = lower.split("/").filter(Boolean);
  for (const marker of holdoutMarkers) {
    if (marker.endsWith("/")) {
      const dirSeg = marker.slice(0, -1);
      if (dirSeg && segments.includes(dirSeg)) return true;
    } else if (lower.includes(marker)) {
      return true;
    }
  }
  return false;
}

/**
 * Classify a file or directory target path against CONTRACT.md §8 secret, git, control,
 * holdout, and frozen rules.
 */
export function inspectTargetPath(
  rawPath: string,
  { root, cwd, ctx, respectOutside = false }: PathGuardOptions = {},
): GuardEvaluation {
  if (!rawPath || !rawPath.trim()) return { decision: "allow" };

  const unquoted = unquoteShellToken(rawPath).trim();
  if (!unquoted) return { decision: "allow" };

  const policy = normalizeGuardContext(ctx);
  let checkPath = posixPath.normalize(toPosix(unquoted));
  if (checkPath.length > 1 && checkPath.endsWith("/")) {
    checkPath = checkPath.slice(0, -1);
  }

  let rel: string | null = null;
  let outside = false;
  if (root) {
    const info = relativeToRoot(unquoted, root, cwd);
    outside = info.outside;
    if (respectOutside && info.outside) {
      return { decision: "allow", outside: true, rel: null };
    }
    rel = info.rel;
    if (!info.outside && rel !== null) {
      checkPath = rel === "." ? "" : rel;
    }
  } else {
    rel = checkPath.replace(/^\.?\//, "");
  }

  const normalizedCheck = checkPath.replace(/^\.?\//, "");
  if (
    normalizedCheck === ".git" ||
    normalizedCheck.startsWith(".git/") ||
    (!respectOutside && /(^|\/)\.git(\/|$)/i.test(normalizedCheck))
  ) {
    return {
      decision: "deny",
      reason: `Blocked direct modification of git internals (${unquoted}).`,
      rel,
      outside,
    };
  }

  for (const prefix of policy.controlPrefixes) {
    const bare = prefix.replace(/\/+$/, "");
    if (
      normalizedCheck === bare ||
      normalizedCheck.startsWith(prefix) ||
      (!respectOutside &&
        new RegExp(`(^|/)${escapeRegExp(bare)}(/|$)`, "i").test(
          normalizedCheck,
        ))
    ) {
      return {
        decision: "deny",
        reason: `Blocked direct modification of factory control directory (${unquoted}).`,
        rel,
        outside,
      };
    }
  }

  if (matchesHoldoutMarker(normalizedCheck, policy.holdoutMarkers)) {
    return {
      decision: "deny",
      reason: `Blocked modification of protected holdout test path (${unquoted}).`,
      rel,
      outside,
    };
  }

  if (policy.frozenSet.size > 0) {
    const candidateRel = rel === "." ? "" : (rel ?? normalizedCheck);
    for (const frozenPath of policy.frozenSet) {
      const cleanFrozen = frozenPath.replace(/\/+$/, "");
      if (
        candidateRel === cleanFrozen ||
        (cleanFrozen && candidateRel.startsWith(`${cleanFrozen}/`))
      ) {
        return {
          decision: "deny",
          reason: `Blocked modification of frozen contract/test file (${unquoted}).`,
          rel,
          outside,
        };
      }
    }
  }

  const baseLower = posixPath.basename(normalizedCheck).toLowerCase();
  if (
    (baseLower === ".env" || baseLower.startsWith(".env.")) &&
    !ALLOWED_ENV_TEMPLATES.has(baseLower)
  ) {
    return {
      decision: "deny",
      reason: `Blocked secret file modification (${unquoted}). Only safe templates like .env.example may be edited.`,
      rel,
      outside,
    };
  }

  if (
    PRIVATE_KEY_BASENAMES.has(baseLower) ||
    baseLower.endsWith(".pem") ||
    baseLower.endsWith(".key")
  ) {
    return {
      decision: "deny",
      reason: `Blocked private key material write (${unquoted}).`,
      rel,
      outside,
    };
  }

  return { decision: "allow", rel, outside };
}

function normalizeRmTarget(rawTarget: string): string {
  const cleaned = unquoteShellToken(rawTarget).trim();
  if (!cleaned) return "";
  if (cleaned === "~" || cleaned.startsWith("~/")) {
    if (cleaned === "~") return "~";
    const normHome = posixPath.normalize(cleaned.slice(2));
    if (normHome === "." || normHome === "") return "~/";
    if (normHome === "*") return "~/*";
    return `~/${normHome}`;
  }
  if (cleaned.startsWith("$HOME") || cleaned.startsWith("${HOME}")) {
    const prefix = cleaned.startsWith("${HOME}") ? "${HOME}" : "$HOME";
    const rest = cleaned.slice(prefix.length);
    if (!rest) return prefix;
    const collapsed = rest.replace(/\/+/g, "/");
    if (collapsed === "/" || collapsed === "/.") return `${prefix}/`;
    if (collapsed === "/*") return `${prefix}/*`;
    return `${prefix}${collapsed}`;
  }
  if (cleaned === "/*" || /^\/+\*$/.test(cleaned)) return "/*";
  if (cleaned === "/.." || /^\/+\.\.$/.test(cleaned)) return "/..";
  if (cleaned === "/." || /^\/+\.$/.test(cleaned)) return "/.";
  const collapsed = cleaned.replace(/\/+/g, "/");
  const normalized = posixPath.normalize(collapsed);
  if (normalized === "/" || normalized === "/.") return "/";
  return normalized;
}

function isCatastrophicRm(rawTarget: string, cwd?: string): boolean {
  const norm = normalizeRmTarget(rawTarget);
  if (CATASTROPHIC_RM_TARGETS.has(norm)) return true;
  if (
    cwd &&
    norm &&
    !norm.startsWith("~") &&
    !norm.startsWith("$HOME") &&
    !norm.startsWith("${HOME}")
  ) {
    const resolved = posixPath.resolve(toPosix(cwd), norm);
    if (resolved === "/") return true;
  }
  return false;
}

function stripCommandPrefixes(rawTokens: string[]): {
  envAssignments: string[];
  tokens: string[];
} {
  const envAssignments: string[] = [];
  let idx = 0;

  while (idx < rawTokens.length) {
    const tok = unquoteShellToken(rawTokens[idx] ?? "");
    if (tok === "env") {
      idx += 1;
      while (idx < rawTokens.length) {
        const nextTok = unquoteShellToken(rawTokens[idx] ?? "");
        if (ENV_ASSIGNMENT_RE.test(nextTok)) {
          envAssignments.push(nextTok);
          idx += 1;
        } else if (nextTok.startsWith("-")) {
          if (
            nextTok === "-u" ||
            nextTok === "-C" ||
            nextTok === "--unset" ||
            nextTok === "--chdir"
          ) {
            idx += 2;
          } else {
            idx += 1;
          }
        } else {
          break;
        }
      }
      continue;
    }
    if (ENV_ASSIGNMENT_RE.test(tok)) {
      envAssignments.push(tok);
      idx += 1;
      continue;
    }
    if (COMMAND_PREFIX_WRAPPERS.has(tok)) {
      idx += 1;
      while (
        idx < rawTokens.length &&
        unquoteShellToken(rawTokens[idx] ?? "").startsWith("-")
      ) {
        const opt = unquoteShellToken(rawTokens[idx] ?? "");
        if (
          tok === "sudo" &&
          (opt === "-u" || opt === "-g" || opt === "-C" || opt === "-h")
        ) {
          idx += 2;
        } else if (tok === "nice" && opt === "-n") {
          idx += 2;
        } else {
          idx += 1;
        }
      }
      continue;
    }
    break;
  }

  return { envAssignments, tokens: rawTokens.slice(idx) };
}

function extractRedirects(rawTokens: string[]): {
  redirectTargets: string[];
  commandTokens: string[];
} {
  const redirectTargets: string[] = [];
  const commandTokens: string[] = [];

  for (let i = 0; i < rawTokens.length; i += 1) {
    const raw = rawTokens[i] ?? "";
    const tok = unquoteShellToken(raw);

    if (/^(?:\d+|&)?(?:>>?|>\||&>>?)$/.test(tok)) {
      if (i + 1 < rawTokens.length) {
        const nextTok = unquoteShellToken(rawTokens[i + 1] ?? "");
        if (!/^&\d+$|^&-$/.test(nextTok)) redirectTargets.push(nextTok);
        i += 1;
      }
      continue;
    }

    const attached = tok.match(/^(?:\d+|&)?(?:>>?|>\||&>>?)(.+)$/);
    if (attached && attached[1]) {
      const target = attached[1];
      if (!/^&\d+$|^&-$/.test(target)) redirectTargets.push(target);
      continue;
    }

    commandTokens.push(raw);
  }

  return { redirectTargets, commandTokens };
}

function parseCopyMoveDestinations(
  args: string[],
  includeSources: boolean,
): string[] {
  let targetDir: string | null = null;
  const positional: string[] = [];
  let stopFlags = false;
  const valueFlags = new Set(["-t", "--target-directory", "-S", "--suffix"]);

  for (let i = 0; i < args.length; i += 1) {
    const tok = unquoteShellToken(args[i] ?? "");
    if (!stopFlags && tok === "--") {
      stopFlags = true;
      continue;
    }
    if (!stopFlags && tok.startsWith("--target-directory=")) {
      targetDir = tok.slice("--target-directory=".length);
      continue;
    }
    if (
      !stopFlags &&
      tok.startsWith("-t") &&
      tok.length > 2 &&
      tok !== "-target-directory"
    ) {
      targetDir = tok.slice(2);
      continue;
    }
    if (!stopFlags && valueFlags.has(tok)) {
      const next =
        i + 1 < args.length ? unquoteShellToken(args[i + 1] ?? "") : "";
      if ((tok === "-t" || tok === "--target-directory") && next) {
        targetDir = next;
      }
      i += 1;
      continue;
    }
    if (!stopFlags && tok.startsWith("-") && tok !== "-") {
      continue;
    }
    positional.push(tok);
  }

  if (includeSources) {
    const out = [...positional];
    if (targetDir) out.push(targetDir);
    return out;
  }
  if (targetDir) return [targetDir];
  const last = positional[positional.length - 1];
  return last ? [last] : [];
}

function parseInPlaceTargets(cmd: string, args: string[]): string[] {
  let inPlace = false;
  let hasExplicitScript = false;
  const positional: string[] = [];
  let stopFlags = false;

  for (let i = 0; i < args.length; i += 1) {
    const tok = unquoteShellToken(args[i] ?? "");
    if (!stopFlags && tok === "--") {
      stopFlags = true;
      continue;
    }
    if (!stopFlags && tok.startsWith("-") && tok !== "-") {
      if (tok === "--in-place" || tok.startsWith("--in-place=")) {
        inPlace = true;
        continue;
      }
      if (/^-[A-Za-z]*i/.test(tok) || (cmd === "sed" && tok.startsWith("-i"))) {
        inPlace = true;
      }
      if (
        tok === "-e" ||
        tok === "-f" ||
        tok === "--expression" ||
        tok === "--file"
      ) {
        hasExplicitScript = true;
        i += 1;
      }
      continue;
    }
    positional.push(tok);
  }

  if (!inPlace) return [];
  if (hasExplicitScript) return positional;
  return positional.length > 1 ? positional.slice(1) : [];
}

function parseGitSubcommand(args: string[]): {
  subcommand: string;
  subArgs: string[];
} {
  let i = 0;
  while (i < args.length) {
    const tok = unquoteShellToken(args[i] ?? "");
    if (tok === "--") {
      i += 1;
      break;
    }
    if (tok.startsWith("-")) {
      if (GIT_GLOBAL_VALUE_FLAGS.has(tok)) {
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }
    return {
      subcommand: tok,
      subArgs: args.slice(i + 1).map(unquoteShellToken),
    };
  }
  if (i < args.length) {
    return {
      subcommand: unquoteShellToken(args[i] ?? ""),
      subArgs: args.slice(i + 1).map(unquoteShellToken),
    };
  }
  return { subcommand: "", subArgs: [] };
}

function hasShortFlag(tokens: string[], flagChar: string): boolean {
  for (const tok of tokens) {
    if (tok === "--") break;
    if (tok.startsWith("-") && !tok.startsWith("--") && tok.length > 1) {
      if (tok.slice(1).includes(flagChar)) return true;
    }
  }
  return false;
}

/**
 * Evaluate a shell command line against CONTRACT.md §8 guard rules.
 */
export function evaluateShellGuard(
  commandLine: string,
  { root, cwd, ctx, respectOutside = false, depth = 0 }: ShellGuardOptions = {},
): GuardEvaluation {
  if (!commandLine || !commandLine.trim()) return { decision: "allow" };
  if (depth > 5) {
    return {
      decision: "deny",
      reason: "Blocked excessively nested shell command expansion.",
    };
  }

  if (/:\(\)\s*\{[^}]*:\s*\|\s*:[^}]*\}\s*;\s*:/.test(commandLine)) {
    return {
      decision: "deny",
      reason: "Blocked catastrophic shell fork bomb.",
    };
  }

  const checkPath = (rawTarget: string): GuardEvaluation =>
    inspectTargetPath(rawTarget, { root, cwd, ctx, respectOutside });

  let pendingAsk: GuardEvaluation | null = null;
  const recordAsk = (reason: string): void => {
    if (!pendingAsk) pendingAsk = { decision: "ask", reason };
  };

  const pipelines = splitShellPipelines(commandLine);

  for (const pipeline of pipelines) {
    let sawDownloader = false;

    for (const segment of pipeline) {
      for (const inner of extractCommandSubstitutions(segment)) {
        const subRes = evaluateShellGuard(inner, {
          root,
          cwd,
          ctx,
          respectOutside,
          depth: depth + 1,
        });
        if (subRes.decision === "deny") return subRes;
        if (subRes.decision === "ask" && subRes.reason) {
          recordAsk(subRes.reason);
        }
      }

      const rawTokens = tokenizeShellSegment(segment);
      if (rawTokens.length === 0) continue;

      const { redirectTargets, commandTokens } = extractRedirects(rawTokens);
      for (const target of redirectTargets) {
        const targetRes = checkPath(target);
        if (targetRes.decision !== "allow") return targetRes;
      }

      const { envAssignments, tokens } = stripCommandPrefixes(commandTokens);
      for (const envPair of envAssignments) {
        if (/^HUSKY=0$/i.test(envPair)) {
          return {
            decision: "deny",
            reason: "Verification bypass via HUSKY=0 is prohibited.",
          };
        }
      }

      if (tokens.length === 0) continue;

      const cmdToken = unquoteShellToken(tokens[0] ?? "");
      const cmd = posixPath.basename(toPosix(cmdToken)).toLowerCase();
      const args = tokens.slice(1);
      const unquotedArgs = args.map(unquoteShellToken);

      if (DOWNLOAD_CMDS.has(cmd)) {
        sawDownloader = true;
      } else if (sawDownloader && PIPE_EXEC_TARGETS.has(cmd)) {
        return {
          decision: "deny",
          reason: `Blocked pipe-to-shell remote execution (${cmd}).`,
        };
      }

      if (cmd === "mkfs" || cmd.startsWith("mkfs.")) {
        return {
          decision: "deny",
          reason: "Blocked catastrophic filesystem formatting command (mkfs).",
        };
      }

      if (SHELL_WRAPPER_CMDS.has(cmd)) {
        for (let i = 0; i < unquotedArgs.length; i += 1) {
          const arg = unquotedArgs[i] ?? "";
          if (arg === "-c" || /^-[A-Za-z]*c[A-Za-z]*$/.test(arg)) {
            if (i + 1 < unquotedArgs.length) {
              const nestedRes = evaluateShellGuard(unquotedArgs[i + 1] ?? "", {
                root,
                cwd,
                ctx,
                respectOutside,
                depth: depth + 1,
              });
              if (nestedRes.decision === "deny") return nestedRes;
              if (nestedRes.decision === "ask" && nestedRes.reason) {
                recordAsk(nestedRes.reason);
              }
            }
            break;
          }
          if (!arg.startsWith("-")) break;
        }
        continue;
      }

      if (cmd === "rm") {
        let recursive = false;
        let stopFlags = false;
        const rmTargets: string[] = [];
        for (const arg of unquotedArgs) {
          if (!stopFlags && arg === "--") {
            stopFlags = true;
            continue;
          }
          if (!stopFlags && arg.startsWith("-") && arg !== "-") {
            if (arg === "--recursive" || /^-[A-Za-z]*[rR]/.test(arg)) {
              recursive = true;
            }
            continue;
          }
          rmTargets.push(arg);
        }
        for (const target of rmTargets) {
          if (
            (recursive ||
              CATASTROPHIC_RM_TARGETS.has(normalizeRmTarget(target))) &&
            isCatastrophicRm(target, cwd)
          ) {
            return {
              decision: "deny",
              reason: `Blocked catastrophic recursive delete targeting "${target}".`,
            };
          }
          const targetRes = checkPath(target);
          if (targetRes.decision !== "allow") return targetRes;
        }
        continue;
      }

      if (cmd === "mv") {
        for (const target of parseCopyMoveDestinations(args, true)) {
          const res = checkPath(target);
          if (res.decision !== "allow") return res;
        }
        continue;
      }

      if (cmd === "cp" || cmd === "ln" || cmd === "install") {
        for (const target of parseCopyMoveDestinations(args, false)) {
          const res = checkPath(target);
          if (res.decision !== "allow") return res;
        }
        continue;
      }

      if (cmd === "tee" || cmd === "touch" || cmd === "truncate") {
        let stopFlags = false;
        for (let i = 0; i < unquotedArgs.length; i += 1) {
          const arg = unquotedArgs[i] ?? "";
          if (!stopFlags && arg === "--") {
            stopFlags = true;
            continue;
          }
          if (!stopFlags && arg.startsWith("-") && arg !== "-") {
            if (
              cmd === "truncate" &&
              (arg === "-s" ||
                arg === "-r" ||
                arg === "--size" ||
                arg === "--reference")
            ) {
              i += 1;
            }
            continue;
          }
          const res = checkPath(arg);
          if (res.decision !== "allow") return res;
        }
        continue;
      }

      if (cmd === "sed" || cmd === "perl") {
        for (const target of parseInPlaceTargets(cmd, args)) {
          const res = checkPath(target);
          if (res.decision !== "allow") return res;
        }
        continue;
      }

      if (cmd === "dd") {
        for (const arg of unquotedArgs) {
          if (arg.startsWith("of=")) {
            const res = checkPath(arg.slice(3));
            if (res.decision !== "allow") return res;
          }
        }
        continue;
      }

      if (cmd === "docker" || cmd === "podman") {
        let i = 0;
        while (i < unquotedArgs.length) {
          const arg = unquotedArgs[i] ?? "";
          if (arg.startsWith("-")) {
            if (DOCKER_VALUE_FLAGS.has(arg)) i += 2;
            else i += 1;
            continue;
          }
          break;
        }
        const sub = (unquotedArgs[i] ?? "").toLowerCase();
        const sub2 = (unquotedArgs[i + 1] ?? "").toLowerCase();
        if (
          sub === "prune" ||
          (DOCKER_PRUNE_SCOPES.has(sub) && sub2 === "prune")
        ) {
          return {
            decision: "deny",
            reason: `Destructive bulk host operation (${cmd} ${sub}${sub2 ? ` ${sub2}` : ""}) is prohibited.`,
          };
        }
        continue;
      }

      if (cmd === "git") {
        if (unquotedArgs.some((a) => /core\.hooksPath=/i.test(a))) {
          return {
            decision: "deny",
            reason: "Verification bypass via core.hooksPath= is prohibited.",
          };
        }
        const { subcommand, subArgs } = parseGitSubcommand(args);
        if (
          subArgs.includes("--no-verify") ||
          (NO_VERIFY_GIT_SUBCOMMANDS.has(subcommand) &&
            (subcommand === "commit" || subcommand === "merge") &&
            hasShortFlag(subArgs, "n"))
        ) {
          return {
            decision: "deny",
            reason: `Verification bypass (--no-verify) in git ${subcommand} is prohibited.`,
          };
        }

        if (subcommand === "push") {
          return {
            decision: "deny",
            reason:
              "Pushing (`git push`) is prohibited inside the factory guard.",
          };
        }

        if (subcommand === "reset" && subArgs.includes("--hard")) {
          recordAsk(
            "Destructive `git reset --hard` requires a separate operator action.",
          );
          continue;
        }

        if (
          subcommand === "clean" &&
          (subArgs.includes("--force") || hasShortFlag(subArgs, "f"))
        ) {
          recordAsk(
            "Destructive `git clean -f` requires a separate operator action.",
          );
          continue;
        }

        if (
          subcommand === "rebase" &&
          (subArgs.includes("--interactive") || hasShortFlag(subArgs, "i"))
        ) {
          recordAsk(
            "Interactive rebase (`git rebase -i`) requires a separate operator action.",
          );
          continue;
        }

        if (subcommand === "checkout" || subcommand === "restore") {
          const dashIdx = subArgs.indexOf("--");
          const pathSpecs =
            dashIdx >= 0
              ? subArgs.slice(dashIdx + 1)
              : subcommand === "restore"
                ? subArgs.filter((a, idx) => {
                    if (a.startsWith("-")) return false;
                    const prev = idx > 0 ? (subArgs[idx - 1] ?? "") : "";
                    return (
                      prev !== "-s" &&
                      prev !== "--source" &&
                      prev !== "--conflict"
                    );
                  })
                : [];
          for (const target of pathSpecs) {
            const res = checkPath(target);
            if (res.decision !== "allow") return res;
          }
        }
      }
    }
  }

  return pendingAsk ?? { decision: "allow" };
}

/**
 * Shared CONTRACT.md §8 guard entry point used across tests and runtime hooks.
 */
export function decideGuard({
  tool,
  input,
  root = "/repo",
  cwd = root,
  ctx = {},
  unattended = false,
}: GuardRequest): GuardDecision {
  let result: GuardEvaluation;
  if (tool === "write") {
    result = inspectTargetPath(String(input ?? ""), {
      root,
      cwd,
      ctx,
      respectOutside: true,
    });
  } else if (tool === "shell") {
    result = evaluateShellGuard(String(input ?? ""), {
      root,
      cwd,
      ctx,
      respectOutside: true,
    });
  } else {
    return "allow";
  }

  if (result.decision === "ask" && unattended) return "deny";
  return result.decision;
}
