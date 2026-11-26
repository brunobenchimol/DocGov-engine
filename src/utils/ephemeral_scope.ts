// ============================================================================
// Isolamento Efêmero (%TEMP%/docgov_ephemeral_inspect), Proteção de inputs/ e Sweep >= 72h
// ============================================================================

import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  isValidDocGovCaseScope,
  resolveWorkspacePath,
} from "./paths.ts";

const EPHEMERAL_DIR_NAME = "docgov_ephemeral_inspect";
const LAST_SWEEP_FILE = ".last_sweep";
const DEFAULT_SWEEP_INTERVAL_MS = 12 * 3600 * 1000;
const DEFAULT_STALE_AGE_MS = 72 * 3600 * 1000;

let hasSweptThisProcess = false;

function normalizeCmp(p: string): string {
  const norm = p.replace(/\\/g, "/").replace(/\/+$/, "");
  return process.platform === "win32" ? norm.toLowerCase() : norm;
}

function resolveCanonicalWithExistingAncestor(targetPath: string): string {
  const resolved = resolve(targetPath);
  const missingTail: string[] = [];
  let cursor = resolved;

  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) break;
    missingTail.unshift(basename(cursor));
    cursor = parent;
  }

  let realBase = cursor;
  if (existsSync(cursor)) {
    try {
      realBase = realpathSync(cursor);
    } catch {
      realBase = cursor;
    }
  }
  return missingTail.length > 0 ? join(realBase, ...missingTail) : realBase;
}

export function getEphemeralRootDir(): string {
  const root = resolve(tmpdir(), EPHEMERAL_DIR_NAME);
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

export function isNamedEphemeralSubdir(targetPath: string): boolean {
  if (!targetPath || typeof targetPath !== "string") return false;
  const root = resolveCanonicalWithExistingAncestor(getEphemeralRootDir());
  const resolved = resolve(targetPath);
  const canonical = resolveCanonicalWithExistingAncestor(resolved);

  for (const candidate of [resolved, canonical]) {
    const rel = relative(root, candidate);
    if (!rel || rel === "." || rel.startsWith("..") || isAbsolute(rel)) {
      return false;
    }
    const rootCmp = normalizeCmp(root);
    const candCmp = normalizeCmp(candidate);
    if (candCmp === rootCmp || !candCmp.startsWith(`${rootCmp}/`)) {
      return false;
    }
  }
  return true;
}

export function maybeCleanupStaleEphemeralDirs(
  excludeDir?: string,
  options: {
    nowMs?: number;
    maxAgeMs?: number;
    sweepIntervalMs?: number;
    forceResetInProcess?: boolean;
  } = {}
): number {
  if (options.forceResetInProcess) {
    hasSweptThisProcess = false;
  }
  if (hasSweptThisProcess) return 0;

  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_STALE_AGE_MS;
  const sweepIntervalMs = options.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
  const ephemeralRoot = resolve(tmpdir(), EPHEMERAL_DIR_NAME);

  if (!existsSync(ephemeralRoot)) {
    hasSweptThisProcess = true;
    return 0;
  }

  const lastSweepPath = join(ephemeralRoot, LAST_SWEEP_FILE);
  try {
    const st = statSync(lastSweepPath);
    if (nowMs - st.mtimeMs < sweepIntervalMs) {
      hasSweptThisProcess = true;
      return 0;
    }
  } catch {
    // .last_sweep ausente -> prossegue com varredura única neste processo
  }

  const excludeCmp = excludeDir ? normalizeCmp(resolve(excludeDir)) : null;
  let removed = 0;

  try {
    const entries = readdirSync(ephemeralRoot);
    for (const entry of entries) {
      if (entry === LAST_SWEEP_FILE) continue;
      const entryPath = join(ephemeralRoot, entry);
      const entryCmp = normalizeCmp(resolve(entryPath));
      if (
        excludeCmp &&
        (excludeCmp === entryCmp || excludeCmp.startsWith(`${entryCmp}/`))
      ) {
        continue;
      }

      try {
        const st = statSync(entryPath);
        if (nowMs - st.mtimeMs >= maxAgeMs) {
          rmSync(entryPath, { recursive: true, force: true });
          removed++;
        }
      } catch {
        // Silencia EBUSY/EPERM em pastas abertas por outro processo
      }
    }
  } catch {
    // Silencia falha de listagem
  }

  try {
    writeFileSync(lastSweepPath, new Date(nowMs).toISOString(), "utf-8");
  } catch {
    // Silencia falha de atualização do marcador .last_sweep
  }

  hasSweptThisProcess = true;
  return removed;
}

export function createIsolatedEphemeralDir(prefix: string): string {
  const root = getEphemeralRootDir();
  const safePrefix = (prefix || "session").replace(/[^a-zA-Z0-9_-]/g, "_");
  const randHex = randomBytes(2).toString("hex");
  const dir = join(root, `${safePrefix}_${Date.now()}_${randHex}`);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  maybeCleanupStaleEphemeralDirs(dir);
  return dir;
}

export function redirectInputsDirToSiblingState(
  sourceFilePath: string
): string | null {
  if (!sourceFilePath) return null;
  const resolved = resolve(sourceFilePath);
  if (!isValidDocGovCaseScope(resolved)) return null;

  const normDir = dirname(resolved).replace(/\\/g, "/");
  const segments = normDir.split("/").filter(Boolean);
  let lastInputsIdx = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].toLowerCase() === "inputs") {
      lastInputsIdx = i;
      break;
    }
  }
  if (lastInputsIdx === -1) return null;

  const isWinDrive = /^[a-zA-Z]:$/.test(segments[0]);
  const isRootPosix = normDir.startsWith("/");
  const prefixParts = segments.slice(0, lastInputsIdx);
  let caseBaseDir: string;
  if (isWinDrive) {
    caseBaseDir =
      prefixParts.length === 1
        ? `${prefixParts[0]}/`
        : prefixParts.join("/");
  } else if (isRootPosix) {
    caseBaseDir = `/${prefixParts.join("/")}`;
  } else {
    caseBaseDir = prefixParts.join("/");
  }

  return resolve(caseBaseDir, "state");
}

export function resolveEphemeralTargetDir(params: {
  caseDir?: string;
  prefix: string;
  appendStateIfCase?: boolean;
  appendStateIfNamedEphemeral?: boolean;
}): { targetDir: string; isEphemeral: boolean } {
  const {
    caseDir,
    prefix,
    appendStateIfCase = true,
    appendStateIfNamedEphemeral = false,
  } = params;

  if (caseDir) {
    const resolved = resolveWorkspacePath(caseDir);
    if (isValidDocGovCaseScope(resolved)) {
      return {
        targetDir: appendStateIfCase ? join(resolved, "state") : resolved,
        isEphemeral: false,
      };
    }
    if (isNamedEphemeralSubdir(resolved)) {
      maybeCleanupStaleEphemeralDirs(resolved);
      return {
        targetDir: appendStateIfNamedEphemeral
          ? join(resolved, "state")
          : resolved,
        isEphemeral: true,
      };
    }
  }

  return {
    targetDir: createIsolatedEphemeralDir(prefix),
    isEphemeral: true,
  };
}

export function resolveInspectOutputDir(params: {
  resolvedSource: string;
  outputPath?: string;
  inScope: boolean;
  baseStem: string;
  prefix?: string;
}): { outDir: string; targetOutputPath?: string; isEphemeral: boolean } {
  const { resolvedSource, outputPath, inScope, baseStem, prefix = "inspect" } =
    params;

  if (outputPath) {
    const resolvedOut = resolve(outputPath);
    if (isValidDocGovCaseScope(resolvedOut)) {
      return {
        outDir: dirname(resolvedOut),
        targetOutputPath: resolvedOut,
        isEphemeral: false,
      };
    }
    const outParent = dirname(resolvedOut);
    if (isNamedEphemeralSubdir(outParent)) {
      maybeCleanupStaleEphemeralDirs(outParent);
      return {
        outDir: outParent,
        targetOutputPath: resolvedOut,
        isEphemeral: true,
      };
    }
    const isolated = createIsolatedEphemeralDir(prefix);
    return {
      outDir: isolated,
      targetOutputPath: resolve(isolated, basename(resolvedOut)),
      isEphemeral: true,
    };
  }

  if (inScope) {
    const redirected = redirectInputsDirToSiblingState(resolvedSource);
    return {
      outDir: redirected ?? dirname(resolvedSource),
      targetOutputPath: undefined,
      isEphemeral: false,
    };
  }

  const sourceDir = dirname(resolvedSource);
  if (isNamedEphemeralSubdir(sourceDir)) {
    maybeCleanupStaleEphemeralDirs(sourceDir);
    return {
      outDir: sourceDir,
      targetOutputPath: resolve(sourceDir, `estrutura_${baseStem}.json`),
      isEphemeral: true,
    };
  }

  const isolated = createIsolatedEphemeralDir(prefix);
  return {
    outDir: isolated,
    targetOutputPath: resolve(isolated, `estrutura_${baseStem}.json`),
    isEphemeral: true,
  };
}
