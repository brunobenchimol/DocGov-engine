// ============================================================================
// Camada Universal de I/O Seguro e Concorrência (Google Drive / OneDrive / NTFS / POSIX)
// ============================================================================

import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const LOCK_STALE_MS = 5_000;
const LOCK_RETRY_MS = 25;
const LOCK_MAX_WAIT_MS = 10_000;
const WRITE_RETRY_DELAYS_MS = [50, 150, 300] as const;
const RETRYABLE_FS_CODES = new Set(["EBUSY", "EPERM", "EACCES", "EXDEV"]);

const dirMutexQueues = new Map<string, Promise<void>>();
const pendingWrites = new Map<string, Promise<void>>();

export function normalizePathKey(targetPath: string): string {
  const resolved = resolve(targetPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function getDocGovLocksDir(): string {
  const locksDir = join(tmpdir(), "docgov_locks");
  if (!existsSync(locksDir)) {
    mkdirSync(locksDir, { recursive: true });
  }
  return locksDir;
}

function isInsideSystemTemp(resolvedFilePath: string): boolean {
  const normFile = normalizePathKey(resolvedFilePath).replace(/\\/g, "/");
  const normTmp = normalizePathKey(tmpdir()).replace(/\\/g, "/").replace(/\/+$/, "");
  return normFile === normTmp || normFile.startsWith(`${normTmp}/`);
}

function normalizeTextContent(content: string): string {
  const withoutBom = content.startsWith("\uFEFF") ? content.slice(1) : content;
  return withoutBom.replace(/\r\n?/g, "\n");
}

function sleepSyncMs(ms: number): void {
  if (typeof Bun !== "undefined" && typeof Bun.sleepSync === "function") {
    Bun.sleepSync(ms);
    return;
  }
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

function sleepAsyncMs(ms: number): Promise<void> {
  return new Promise((resolveFn) => setTimeout(resolveFn, ms));
}

function writeDirectWithRetrySync(
  resolvedPath: string,
  payload: string | Buffer
): void {
  for (let attempt = 0; attempt <= WRITE_RETRY_DELAYS_MS.length; attempt++) {
    try {
      if (typeof payload === "string") {
        writeFileSync(resolvedPath, payload, "utf-8");
      } else {
        writeFileSync(resolvedPath, payload);
      }
      return;
    } catch (err: any) {
      const code = err?.code;
      if (
        attempt < WRITE_RETRY_DELAYS_MS.length &&
        RETRYABLE_FS_CODES.has(String(code))
      ) {
        sleepSyncMs(WRITE_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw err;
    }
  }
}

async function writeDirectWithRetryAsync(
  resolvedPath: string,
  payload: string | Buffer
): Promise<void> {
  for (let attempt = 0; attempt <= WRITE_RETRY_DELAYS_MS.length; attempt++) {
    try {
      if (typeof payload === "string") {
        writeFileSync(resolvedPath, payload, "utf-8");
      } else {
        writeFileSync(resolvedPath, payload);
      }
      return;
    } catch (err: any) {
      const code = err?.code;
      if (
        attempt < WRITE_RETRY_DELAYS_MS.length &&
        RETRYABLE_FS_CODES.has(String(code))
      ) {
        await sleepAsyncMs(WRITE_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw err;
    }
  }
}

function tryAtomicWriteSync(
  resolvedPath: string,
  payload: string | Buffer
): boolean {
  const tmpPath = `${resolvedPath}.tmp.${process.pid}.${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  try {
    if (typeof payload === "string") {
      writeFileSync(tmpPath, payload, "utf-8");
    } else {
      writeFileSync(tmpPath, payload);
    }
    renameSync(tmpPath, resolvedPath);
    return true;
  } catch (err: any) {
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {}
    if (RETRYABLE_FS_CODES.has(String(err?.code))) {
      return false;
    }
    throw err;
  }
}

export function writeFileSafeSync(
  filePath: string,
  content: string | Buffer
): void {
  const resolved = resolve(filePath);
  const parentDir = dirname(resolved);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }
  const payload =
    typeof content === "string" ? normalizeTextContent(content) : content;

  const useDirectOnly =
    process.platform === "win32" && !isInsideSystemTemp(resolved);
  if (useDirectOnly) {
    writeDirectWithRetrySync(resolved, payload);
    return;
  }

  if (!tryAtomicWriteSync(resolved, payload)) {
    writeDirectWithRetrySync(resolved, payload);
  }
}

export async function writeFileSafeAsync(
  filePath: string,
  content: string | Buffer
): Promise<void> {
  const resolved = resolve(filePath);
  const parentDir = dirname(resolved);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }
  const payload =
    typeof content === "string" ? normalizeTextContent(content) : content;

  const useDirectOnly =
    process.platform === "win32" && !isInsideSystemTemp(resolved);
  if (useDirectOnly) {
    await writeDirectWithRetryAsync(resolved, payload);
    return;
  }

  if (!tryAtomicWriteSync(resolved, payload)) {
    await writeDirectWithRetryAsync(resolved, payload);
  }
}

export async function withDirectoryLock<T>(
  targetDir: string,
  lockName: string,
  fn: () => Promise<T>
): Promise<T> {
  const canonicalDir = normalizePathKey(targetDir);
  const safeName = (lockName || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  const mutexKey = `${canonicalDir}::${safeName}`;

  const prev = dirMutexQueues.get(mutexKey) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((res) => {
    release = res;
  });
  const chained = prev.then(() => current);
  dirMutexQueues.set(mutexKey, chained);

  await prev;
  try {
    const dirHash = createHash("sha256")
      .update(canonicalDir)
      .digest("hex")
      .slice(0, 24);
    const lockPath = join(getDocGovLocksDir(), `${dirHash}_${safeName}.lock`);
    const startWait = Date.now();
    let acquired = false;

    while (!acquired) {
      try {
        const fd = openSync(lockPath, "wx");
        closeSync(fd);
        acquired = true;
      } catch (err: any) {
        if (err?.code !== "EEXIST") throw err;
        try {
          const st = statSync(lockPath);
          if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
            try {
              unlinkSync(lockPath);
            } catch {}
            continue;
          }
        } catch {
          continue;
        }
        if (Date.now() - startWait >= LOCK_MAX_WAIT_MS) {
          try {
            unlinkSync(lockPath);
          } catch {}
          throw new Error(
            `Timeout ao aguardar lock de escrita em '${lockPath}' após ${LOCK_MAX_WAIT_MS}ms.`
          );
        }
        await sleepAsyncMs(LOCK_RETRY_MS);
      }
    }

    try {
      return await fn();
    } finally {
      try {
        unlinkSync(lockPath);
      } catch {}
    }
  } finally {
    release();
    if (dirMutexQueues.get(mutexKey) === chained) {
      dirMutexQueues.delete(mutexKey);
    }
  }
}

export function enqueueWrite(
  filePath: string,
  content: string | Buffer
): Promise<void> {
  const key = normalizePathKey(filePath);
  const prev = pendingWrites.get(key) || Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(() => writeFileSafeAsync(filePath, content));

  const tracked = next
    .catch(() => undefined)
    .finally(() => {
      if (pendingWrites.get(key) === tracked) {
        pendingWrites.delete(key);
      }
    });
  pendingWrites.set(key, tracked);
  return next;
}

export async function flushPendingWrites(): Promise<void> {
  while (pendingWrites.size > 0) {
    await Promise.allSettled(Array.from(pendingWrites.values()));
  }
}
