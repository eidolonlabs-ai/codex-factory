import { existsSync, lstatSync, readlinkSync, realpathSync } from "node:fs";
import { posix as posixPath } from "node:path";

export type GuardDecision = "allow" | "deny" | "ask";
export type WriteTargetKind = "write" | "delete";

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
  onRepoWriteTarget?: (
    relPath: string,
    rawTarget: string,
    kind: WriteTargetKind,
  ) => GuardEvaluation | undefined;
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
 * Scan from `openParenIdx` (`(`) to its matching `)`, respecting quotes,
 * backslashes, backticks, and nested `$(...)`/`(...)`.
 */
function consumeBalancedParen(src: string, openParenIdx: number): number {
  let depth = 1;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

  for (let i = openParenIdx + 1; i < src.length; i += 1) {
    const ch = src.charAt(i);
    if (inSingle) {
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === "\\" && i + 1 < src.length) {
      i += 1;
      continue;
    }
    if (inBacktick) {
      if (ch === "`") inBacktick = false;
      continue;
    }
    if (inDouble) {
      if (ch === "`") inBacktick = true;
      else if (ch === "$" && src.charAt(i + 1) === "(") {
        i = consumeBalancedParen(src, i + 1);
      } else if (ch === '"') {
        inDouble = false;
      }
      continue;
    }
    if (ch === "'") inSingle = true;
    else if (ch === '"') inDouble = true;
    else if (ch === "`") inBacktick = true;
    else if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return src.length - 1;
}

/**
 * Tokenize one pipeline segment while keeping quoted spans, `$(...)`/`...` substitutions,
 * and shell redirections cleanly separated.
 */
export function tokenizeShellSegment(segment: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

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
    if (inBacktick) {
      current += ch;
      if (ch === "`") inBacktick = false;
      continue;
    }
    if (inDouble) {
      if (ch === "$" && next === "(") {
        const end = consumeBalancedParen(segment, i + 1);
        current += segment.slice(i, end + 1);
        i = end;
      } else {
        current += ch;
        if (ch === "`") inBacktick = true;
        else if (ch === '"') inDouble = false;
      }
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
      const end = consumeBalancedParen(segment, i + 1);
      current += segment.slice(i, end + 1);
      i = end;
    } else if (ch === ">") {
      if (current.length > 0 && !/^\d+$/.test(current) && current !== "&") {
        tokens.push(current);
        current = "";
      }
      let op = ">";
      if (next === ">" || next === "|" || next === "&") {
        op += next;
        i += 1;
      }
      tokens.push(current + op);
      current = "";
    } else if (ch === "<" && next === ">") {
      if (current.length > 0 && !/^\d+$/.test(current)) {
        tokens.push(current);
        current = "";
      }
      tokens.push(current + "<>");
      current = "";
      i += 1;
    } else if (ch === "&" && next === ">") {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      if (segment.charAt(i + 2) === ">") {
        tokens.push("&>>");
        i += 2;
      } else {
        tokens.push("&>");
        i += 1;
      }
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

interface PipelineListItem {
  segments: string[];
  sep: string;
}

function splitShellPipelineItems(commandLine: string): PipelineListItem[] {
  const pipelines: PipelineListItem[] = [];
  let currentPipeline: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

  const pushSegment = (): void => {
    const trimmed = current.trim();
    if (trimmed) currentPipeline.push(trimmed);
    current = "";
  };

  const pushPipeline = (sep: string): void => {
    pushSegment();
    if (currentPipeline.length > 0)
      pipelines.push({ segments: currentPipeline, sep });
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
      if (ch === "$" && next === "(") {
        const end = consumeBalancedParen(commandLine, i + 1);
        current += commandLine.slice(i, end + 1);
        i = end;
      } else {
        current += ch;
        if (ch === "`") inBacktick = true;
        else if (ch === '"') inDouble = false;
      }
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
      const end = consumeBalancedParen(commandLine, i + 1);
      current += commandLine.slice(i, end + 1);
      i = end;
      continue;
    }
    if (ch === "(" && !current.trim()) {
      const end = consumeBalancedParen(commandLine, i);
      current += commandLine.slice(i, end + 1);
      i = end;
      continue;
    }

    if (ch === "\n" || ch === ";") {
      pushPipeline(ch);
      continue;
    }
    if ((ch === "&" && next === "&") || (ch === "|" && next === "|")) {
      pushPipeline(ch + next);
      i += 1;
      continue;
    }
    if (ch === "&") {
      const prev = i > 0 ? commandLine.charAt(i - 1) : "";
      if (prev !== ">" && prev !== "<" && next !== ">") {
        pushPipeline("&");
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

  pushPipeline("");
  return pipelines;
}

/**
 * Split a shell command line into pipeline lists (`;`, `&&`, `||`, `&`, `\n`),
 * each split on unquoted pipes (`|`, `|&`).
 */
export function splitShellPipelines(commandLine: string): string[][] {
  return splitShellPipelineItems(commandLine).map((item) => item.segments);
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
      const end = consumeBalancedParen(segment, i + 1);
      const bodyEnd =
        segment.charAt(end) === ")" && end > i + 1 ? end : segment.length;
      const body = segment.slice(i + 2, bodyEnd);
      if (body.trim()) inner.push(body);
      i = end;
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

function resolveWithSymlinks(absPath: string, depth = 0): string {
  if (depth > 32) return absPath;
  const suffix: string[] = [];
  let cur = posixPath.resolve(absPath);
  while (true) {
    try {
      const stat = lstatSync(cur);
      if (stat.isSymbolicLink()) {
        const target = posixPath.resolve(
          posixPath.dirname(cur),
          toPosix(readlinkSync(cur)),
        );
        return resolveWithSymlinks(
          suffix.length ? posixPath.join(target, ...suffix) : target,
          depth + 1,
        );
      }
      const real = toPosix(realpathSync(cur));
      return suffix.length ? posixPath.join(real, ...suffix) : real;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") return absPath;
      const parent = posixPath.dirname(cur);
      if (parent === cur) return absPath;
      suffix.unshift(posixPath.basename(cur));
      cur = parent;
    }
  }
}

function relativeToRoot(
  rawPath: string,
  root: string,
  cwd?: string,
): { outside: boolean; symlinkEscape?: boolean; rel: string | null } {
  const cleaned = unquoteShellToken(rawPath).trim();
  let posixRaw = toPosix(cleaned);
  if (
    !posixRaw ||
    posixRaw === "~" ||
    posixRaw.startsWith("~/") ||
    posixRaw.startsWith("$HOME") ||
    posixRaw.startsWith("${HOME}")
  ) {
    return { outside: true, rel: null };
  }
  if (posixRaw === "$PWD" || posixRaw === "${PWD}") {
    posixRaw = ".";
  } else if (posixRaw.startsWith("$PWD/")) {
    posixRaw = `./${posixRaw.slice(5)}`;
  } else if (posixRaw.startsWith("${PWD}/")) {
    posixRaw = `./${posixRaw.slice(7)}`;
  }

  const absRoot = posixPath.resolve(toPosix(root || "/"));
  const realOnDisk = existsSync(absRoot);
  const effectiveRoot = realOnDisk ? toPosix(realpathSync(absRoot)) : absRoot;
  const baseRaw = cwd
    ? posixPath.resolve(effectiveRoot, toPosix(cwd))
    : effectiveRoot;
  const baseDir = realOnDisk ? resolveWithSymlinks(baseRaw) : baseRaw;
  const lexicalResolved = posixPath.resolve(baseDir, posixRaw);
  const lexicalRel = posixPath.relative(effectiveRoot, lexicalResolved);
  const lexicalOutside =
    lexicalRel === ".." ||
    lexicalRel.startsWith("../") ||
    posixPath.isAbsolute(lexicalRel);

  if (realOnDisk) {
    const resolvedReal = resolveWithSymlinks(lexicalResolved);
    const realRel = posixPath.relative(effectiveRoot, resolvedReal);
    const realOutside =
      realRel === ".." ||
      realRel.startsWith("../") ||
      posixPath.isAbsolute(realRel);
    if (!lexicalOutside && realOutside) {
      return {
        outside: false,
        symlinkEscape: true,
        rel: lexicalRel === "" ? "." : lexicalRel,
      };
    }
    return {
      outside: realOutside,
      rel: realOutside ? null : realRel === "" ? "." : realRel,
    };
  }

  return {
    outside: lexicalOutside,
    rel: lexicalOutside ? null : lexicalRel === "" ? "." : lexicalRel,
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
    if (info.symlinkEscape) {
      return {
        decision: "deny",
        reason: `Blocked path traversal via symlink outside repository (${unquoted}).`,
        rel: info.rel,
        outside: false,
      };
    }
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
  const normalizedLower = normalizedCheck.toLowerCase();
  const hasVarPrefix = /^\$[A-Za-z_{]/.test(toPosix(unquoted));
  if (
    normalizedLower === ".git" ||
    normalizedLower.startsWith(".git/") ||
    ((!respectOutside || hasVarPrefix) &&
      /(^|\/)\.git(\/|$)/i.test(normalizedCheck))
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
    const prefixLower = prefix.toLowerCase();
    const bareLower = bare.toLowerCase();
    if (
      normalizedLower === bareLower ||
      normalizedLower.startsWith(prefixLower) ||
      ((!respectOutside || hasVarPrefix) &&
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
    const candidateLower = candidateRel.toLowerCase();
    for (const frozenPath of policy.frozenSet) {
      const cleanFrozen = frozenPath.replace(/\/+$/, "");
      const cleanFrozenLower = cleanFrozen.toLowerCase();
      if (
        candidateLower === cleanFrozenLower ||
        (cleanFrozenLower && candidateLower.startsWith(`${cleanFrozenLower}/`))
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
  extraCommands: string[];
  tokens: string[];
} {
  const envAssignments: string[] = [];
  const extraCommands: string[] = [];
  let idx = 0;

  while (idx < rawTokens.length) {
    const tok = unquoteShellToken(rawTokens[idx] ?? "");
    if (tok === "!") {
      idx += 1;
      continue;
    }
    if (tok === "env") {
      idx += 1;
      while (idx < rawTokens.length) {
        const nextTok = unquoteShellToken(rawTokens[idx] ?? "");
        if (ENV_ASSIGNMENT_RE.test(nextTok)) {
          envAssignments.push(nextTok);
          idx += 1;
        } else if (nextTok.startsWith("--split-string=")) {
          extraCommands.push(nextTok.slice("--split-string=".length));
          idx += 1;
        } else if (nextTok === "-S" || nextTok === "--split-string") {
          const payload = unquoteShellToken(rawTokens[idx + 1] ?? "");
          if (payload) extraCommands.push(payload);
          idx += 2;
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

  return { envAssignments, extraCommands, tokens: rawTokens.slice(idx) };
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

    if (/^(?:\d+|&)?(?:>>?|>\||&>>?|<>|>&)$/.test(tok)) {
      if (i + 1 < rawTokens.length) {
        const nextTok = unquoteShellToken(rawTokens[i + 1] ?? "");
        const isFdDup =
          tok.endsWith(">&") && /^(?:\d+|-)$/.test(nextTok)
            ? true
            : /^&\d+$|^&-$/.test(nextTok);
        if (!isFdDup) {
          redirectTargets.push(
            nextTok.startsWith("&") ? nextTok.slice(1) : nextTok,
          );
        }
        i += 1;
      }
      continue;
    }

    const attached = tok.match(/^(?:\d+|&)?(?:>>?|>\||&>>?|<>|>&)(.+)$/);
    if (attached && attached[1]) {
      const target = attached[1];
      const isFdDup =
        /(?:>&)/.test(tok) && /^(?:\d+|-)$/.test(target)
          ? true
          : /^&\d+$|^&-$/.test(target);
      if (!isFdDup) {
        redirectTargets.push(target.startsWith("&") ? target.slice(1) : target);
      }
      continue;
    }

    commandTokens.push(raw);
  }

  return { redirectTargets, commandTokens };
}

function parseCopyMoveDestinations(
  cmd: string,
  args: string[],
  includeSources: boolean,
): string[] {
  let targetDir: string | null = null;
  let createDirs = false;
  const positional: string[] = [];
  let stopFlags = false;
  const valueFlags = new Set([
    "-t",
    "--target-directory",
    "-S",
    "--suffix",
    ...(cmd === "install"
      ? ["-g", "-m", "-o", "--group", "--mode", "--owner"]
      : []),
  ]);

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
    if (!stopFlags && valueFlags.has(tok)) {
      const next =
        i + 1 < args.length ? unquoteShellToken(args[i + 1] ?? "") : "";
      if ((tok === "-t" || tok === "--target-directory") && next) {
        targetDir = next;
      }
      i += 1;
      continue;
    }
    if (
      !stopFlags &&
      tok.startsWith("-") &&
      !tok.startsWith("--") &&
      tok !== "-"
    ) {
      const flags = tok.slice(1);
      if (cmd === "install" && flags.includes("d")) createDirs = true;
      const tIdx = flags.indexOf("t");
      if (tIdx >= 0) {
        if (tIdx < flags.length - 1) {
          targetDir = flags.slice(tIdx + 1);
        } else if (i + 1 < args.length) {
          targetDir = unquoteShellToken(args[i + 1] ?? "");
          i += 1;
        }
        continue;
      }
      if (flags.includes("S")) {
        if (flags.indexOf("S") === flags.length - 1) i += 1;
        continue;
      }
      continue;
    }
    if (!stopFlags && tok.startsWith("-") && tok !== "-") {
      if (cmd === "install" && tok === "--directory") createDirs = true;
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
  if (cmd === "install" && createDirs) return positional;
  if (cmd === "ln" && positional.length === 1 && positional[0]) {
    const base = posixPath.basename(toPosix(positional[0]));
    return base ? [positional[0], base] : [positional[0]];
  }
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
      if (
        tok.startsWith("--expression=") ||
        tok.startsWith("--file=") ||
        /^-[A-Za-z]*(?:e|f).+$/.test(tok)
      ) {
        if (/^-[A-Za-z]*i/.test(tok)) inPlace = true;
        hasExplicitScript = true;
        continue;
      }
      if (/^-[A-Za-z]*i/.test(tok) || (cmd === "sed" && tok.startsWith("-i"))) {
        inPlace = true;
      }
      if (
        tok === "-e" ||
        tok === "-f" ||
        tok === "--expression" ||
        tok === "--file" ||
        /^-[A-Za-z]*(?:e|f)$/.test(tok)
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

function extractSubshell(
  segment: string,
): { inner: string; rest: string } | null {
  if (!segment.startsWith("(")) return null;
  const closeIdx = consumeBalancedParen(segment, 0);
  if (segment.charAt(closeIdx) !== ")") return null;
  return {
    inner: segment.slice(1, closeIdx),
    rest: segment.slice(closeIdx + 1).trim(),
  };
}

function extractXargsCommand(rawArgs: string[]): string | null {
  const valueFlags = new Set([
    "-I",
    "-J",
    "-L",
    "-l",
    "-n",
    "-P",
    "-s",
    "-d",
    "-E",
    "-a",
    "-R",
    "--max-args",
    "--max-procs",
    "--max-lines",
    "--max-chars",
    "--replace",
    "--delimiter",
    "--eof",
    "--arg-file",
  ]);
  let i = 0;
  while (i < rawArgs.length) {
    const tok = unquoteShellToken(rawArgs[i] ?? "");
    if (tok === "--") {
      i += 1;
      break;
    }
    if (tok.startsWith("--")) {
      i += valueFlags.has(tok) ? 2 : 1;
      continue;
    }
    if (tok.startsWith("-") && tok.length > 1) {
      const last = tok.slice(-1);
      i +=
        tok.length === 2 && valueFlags.has(tok)
          ? 2
          : valueFlags.has(`-${last}`) && tok.length > 2
            ? 1
            : 1;
      continue;
    }
    break;
  }
  const rest = rawArgs.slice(i);
  return rest.length ? rest.join(" ") : null;
}

/**
 * Evaluate a shell command line against CONTRACT.md §8 guard rules.
 */
export function evaluateShellGuard(
  commandLine: string,
  {
    root,
    cwd,
    ctx,
    respectOutside = false,
    depth = 0,
    onRepoWriteTarget,
  }: ShellGuardOptions = {},
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

  let activeCwd = cwd;
  const absRoot = root ? posixPath.resolve(toPosix(root)) : undefined;
  const checkPath = (
    rawTarget: string,
    kind: WriteTargetKind = "write",
  ): GuardEvaluation => {
    const res = inspectTargetPath(rawTarget, {
      root,
      cwd: activeCwd,
      ctx,
      respectOutside,
    });
    if (
      res.decision === "allow" &&
      !res.outside &&
      res.rel &&
      res.rel !== "." &&
      onRepoWriteTarget
    ) {
      const cbRes = onRepoWriteTarget(res.rel, rawTarget, kind);
      if (cbRes && cbRes.decision !== "allow") return cbRes;
    }
    return res;
  };

  let pendingAsk: GuardEvaluation | null = null;
  const recordAsk = (reason: string): void => {
    if (!pendingAsk) pendingAsk = { decision: "ask", reason };
  };

  const pipelines = splitShellPipelineItems(commandLine);

  for (const pipeline of pipelines) {
    let sawDownloader = false;

    for (const rawSegment of pipeline.segments) {
      let segment = rawSegment.trim();
      while (segment.startsWith("{") && /^\{\s+/.test(segment)) {
        segment = segment.slice(1).trim();
      }
      if (segment === "}") continue;
      if (!segment) continue;

      const subshell = extractSubshell(segment);
      if (subshell) {
        if (subshell.rest) {
          const restTokens = tokenizeShellSegment(subshell.rest);
          const { redirectTargets } = extractRedirects(restTokens);
          for (const target of redirectTargets) {
            const targetRes = checkPath(target, "write");
            if (targetRes.decision !== "allow") return targetRes;
          }
        }
        const subRes = evaluateShellGuard(subshell.inner, {
          root,
          cwd: activeCwd,
          ctx,
          respectOutside,
          depth: depth + 1,
          onRepoWriteTarget,
        });
        if (subRes.decision === "deny") return subRes;
        if (subRes.decision === "ask" && subRes.reason) {
          recordAsk(subRes.reason);
        }
        continue;
      }

      for (const inner of extractCommandSubstitutions(segment)) {
        const subRes = evaluateShellGuard(inner, {
          root,
          cwd: activeCwd,
          ctx,
          respectOutside,
          depth: depth + 1,
          onRepoWriteTarget,
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
        const targetRes = checkPath(target, "write");
        if (targetRes.decision !== "allow") return targetRes;
      }

      const {
        envAssignments,
        extraCommands,
        tokens: strippedTokens,
      } = stripCommandPrefixes(commandTokens);
      for (const envPair of envAssignments) {
        if (/^HUSKY=0$/i.test(envPair)) {
          return {
            decision: "deny",
            reason: "Verification bypass via HUSKY=0 is prohibited.",
          };
        }
      }
      for (const extra of extraCommands) {
        const extraRes = evaluateShellGuard(extra, {
          root,
          cwd: activeCwd,
          ctx,
          respectOutside,
          depth: depth + 1,
          onRepoWriteTarget,
        });
        if (extraRes.decision === "deny") return extraRes;
        if (extraRes.decision === "ask" && extraRes.reason) {
          recordAsk(extraRes.reason);
        }
      }

      let tokens = strippedTokens;
      while (tokens.length && unquoteShellToken(tokens[0] ?? "") === "{") {
        tokens = tokens.slice(1);
      }
      while (
        tokens.length &&
        unquoteShellToken(tokens[tokens.length - 1] ?? "") === "}"
      ) {
        tokens = tokens.slice(0, -1);
      }
      if (tokens.length === 0) continue;

      const cmdToken = unquoteShellToken(tokens[0] ?? "");
      const cmd = posixPath.basename(toPosix(cmdToken)).toLowerCase();
      const args = tokens.slice(1);
      const unquotedArgs = args.map(unquoteShellToken);

      if (
        cmd === "cd" &&
        pipeline.segments.length === 1 &&
        pipeline.sep !== "||" &&
        pipeline.sep !== "&"
      ) {
        const cdTargets = unquotedArgs.filter(
          (a) => a !== "--" && !a.startsWith("-"),
        );
        const cdTarget = toPosix(cdTargets[0] ?? "");
        if (
          !cdTarget ||
          cdTarget === "~" ||
          cdTarget.startsWith("~/") ||
          cdTarget.startsWith("$HOME") ||
          cdTarget.startsWith("${HOME}")
        ) {
          activeCwd = "/__outside_home__/user";
        } else if (!cdTarget.includes("$") && cdTarget !== "-") {
          const base = activeCwd
            ? posixPath.resolve(absRoot ?? "/", toPosix(activeCwd))
            : (absRoot ?? "/");
          activeCwd = posixPath.resolve(base, cdTarget);
        }
        continue;
      }

      if (cmd === "export") {
        if (unquotedArgs.some((a) => /^HUSKY=0$/i.test(a))) {
          return {
            decision: "deny",
            reason: "Verification bypass via HUSKY=0 is prohibited.",
          };
        }
        continue;
      }

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

      if (cmd === "eval") {
        const evalArgs =
          unquotedArgs[0] === "--" ? unquotedArgs.slice(1) : unquotedArgs;
        if (evalArgs.length) {
          const nestedRes = evaluateShellGuard(evalArgs.join(" "), {
            root,
            cwd: activeCwd,
            ctx,
            respectOutside,
            depth: depth + 1,
            onRepoWriteTarget,
          });
          if (nestedRes.decision === "deny") return nestedRes;
          if (nestedRes.decision === "ask" && nestedRes.reason) {
            recordAsk(nestedRes.reason);
          }
        }
        continue;
      }

      if (cmd === "xargs") {
        const xargsCmd = extractXargsCommand(args);
        if (xargsCmd) {
          const nestedRes = evaluateShellGuard(xargsCmd, {
            root,
            cwd: activeCwd,
            ctx,
            respectOutside,
            depth: depth + 1,
            onRepoWriteTarget,
          });
          if (nestedRes.decision === "deny") return nestedRes;
          if (nestedRes.decision === "ask" && nestedRes.reason) {
            recordAsk(nestedRes.reason);
          }
        }
        continue;
      }

      if (SHELL_WRAPPER_CMDS.has(cmd)) {
        for (let i = 0; i < unquotedArgs.length; i += 1) {
          const arg = unquotedArgs[i] ?? "";
          if (arg === "--") break;
          if (
            arg === "-o" ||
            arg === "+o" ||
            arg === "-O" ||
            arg === "+O" ||
            arg === "--rcfile" ||
            arg === "--init-file"
          ) {
            i += 1;
            continue;
          }
          if (arg === "-c" || /^-[A-Za-z]*c[A-Za-z]*$/.test(arg)) {
            let cmdIdx = i + 1;
            if (unquotedArgs[cmdIdx] === "--") cmdIdx += 1;
            if (cmdIdx < unquotedArgs.length) {
              const nestedRes = evaluateShellGuard(unquotedArgs[cmdIdx] ?? "", {
                root,
                cwd: activeCwd,
                ctx,
                respectOutside,
                depth: depth + 1,
                onRepoWriteTarget,
              });
              if (nestedRes.decision === "deny") return nestedRes;
              if (nestedRes.decision === "ask" && nestedRes.reason) {
                recordAsk(nestedRes.reason);
              }
            }
            break;
          }
          if (!arg.startsWith("-") && !arg.startsWith("+")) break;
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
            isCatastrophicRm(target, activeCwd)
          ) {
            return {
              decision: "deny",
              reason: `Blocked catastrophic recursive delete targeting "${target}".`,
            };
          }
          const targetRes = checkPath(target, "delete");
          if (targetRes.decision !== "allow") return targetRes;
        }
        continue;
      }

      if (cmd === "mv") {
        for (const target of parseCopyMoveDestinations(cmd, args, true)) {
          const res = checkPath(target, "write");
          if (res.decision !== "allow") return res;
        }
        continue;
      }

      if (cmd === "cp" || cmd === "ln" || cmd === "install") {
        for (const target of parseCopyMoveDestinations(cmd, args, false)) {
          const res = checkPath(target, "write");
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
          const res = checkPath(arg, "write");
          if (res.decision !== "allow") return res;
        }
        continue;
      }

      if (cmd === "sed" || cmd === "perl") {
        for (const target of parseInPlaceTargets(cmd, args)) {
          const res = checkPath(target, "write");
          if (res.decision !== "allow") return res;
        }
        continue;
      }

      if (cmd === "dd") {
        for (const arg of unquotedArgs) {
          if (arg.startsWith("of=")) {
            const res = checkPath(arg.slice(3), "write");
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
          subcommand === "config" &&
          subArgs.some((a) => /^core\.hooksPath(?:=|$)/i.test(a))
        ) {
          return {
            decision: "deny",
            reason: "Verification bypass via core.hooksPath is prohibited.",
          };
        }
        if (
          subArgs.includes("--no-verify") ||
          (NO_VERIFY_GIT_SUBCOMMANDS.has(subcommand) &&
            (subcommand === "commit" ||
              subcommand === "merge" ||
              subcommand === "am") &&
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
          let pathSpecs: string[];
          if (dashIdx >= 0) {
            pathSpecs = subArgs.slice(dashIdx + 1);
          } else if (subcommand === "restore") {
            pathSpecs = subArgs.filter((a, idx) => {
              if (a.startsWith("-")) return false;
              const prev = idx > 0 ? (subArgs[idx - 1] ?? "") : "";
              return (
                prev !== "-s" && prev !== "--source" && prev !== "--conflict"
              );
            });
          } else {
            const skipValueOpts = new Set([
              "-b",
              "-B",
              "--orphan",
              "-U",
              "--unified",
              "--conflict",
              "--pathspec-from-file",
            ]);
            pathSpecs = [];
            for (let idx = 0; idx < subArgs.length; idx += 1) {
              const a = subArgs[idx] ?? "";
              if (a.startsWith("-")) {
                if (skipValueOpts.has(a)) idx += 1;
                continue;
              }
              pathSpecs.push(a);
            }
          }
          for (const target of pathSpecs) {
            const res = checkPath(target, "write");
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
