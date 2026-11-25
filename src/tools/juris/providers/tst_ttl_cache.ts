// ============================================================================
// Cache Dinâmico Live-Backed com TTL Estrito de 24h (Exclusivo TST)
// docgov-engine — providers/tst_ttl_cache.ts
// ============================================================================

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import { join } from "node:path";

export const TST_TTL_MS = 86_400_000; // 24 horas (1 dia)

export interface TstTtlCacheEntry<T> {
  fetched_at: number;
  ttl_ms: number;
  key: string;
  payload: T;
}

export interface TstTtlCacheHit<T> {
  payload: T;
  fetched_at: number;
  ttl_ms: number;
  age_ms: number;
  cachePath: string;
}

export function getTstCacheDir(): string {
  const customRoot = process.env.DOCGOV_JURIS_CACHE_DIR?.trim();
  if (customRoot) {
    return join(customRoot, "tst");
  }
  return join(os.tmpdir(), "docgov_juris_cache", "tst");
}

export function buildTstCacheFilePath(
  kind: "search" | "fetch",
  rawKey: string
): string {
  const normalized = rawKey.trim().toLowerCase().replace(/\s+/g, " ");
  const hash = createHash("sha256").update(`${kind}:${normalized}`).digest("hex").slice(0, 20);
  return join(getTstCacheDir(), `${kind}_${hash}.json`);
}

export function readTstTtlCache<T>(
  kind: "search" | "fetch",
  rawKey: string,
  nowMs: number = Date.now()
): TstTtlCacheHit<T> | null {
  const cachePath = buildTstCacheFilePath(kind, rawKey);
  if (!existsSync(cachePath)) return null;

  try {
    const raw = readFileSync(cachePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<TstTtlCacheEntry<T>>;
    if (
      !parsed ||
      typeof parsed.fetched_at !== "number" ||
      !Number.isFinite(parsed.fetched_at) ||
      parsed.payload === undefined
    ) {
      return null;
    }

    const ttlMs =
      typeof parsed.ttl_ms === "number" && parsed.ttl_ms > 0
        ? parsed.ttl_ms
        : TST_TTL_MS;
    const ageMs = nowMs - parsed.fetched_at;
    if (ageMs < 0 || ageMs >= ttlMs) {
      return null;
    }

    return {
      payload: parsed.payload,
      fetched_at: parsed.fetched_at,
      ttl_ms: ttlMs,
      age_ms: ageMs,
      cachePath,
    };
  } catch {
    return null;
  }
}

export function writeTstTtlCache<T>(
  kind: "search" | "fetch",
  rawKey: string,
  payload: T,
  nowMs: number = Date.now()
): string {
  const dir = getTstCacheDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const cachePath = buildTstCacheFilePath(kind, rawKey);
  const entry: TstTtlCacheEntry<T> = {
    fetched_at: nowMs,
    ttl_ms: TST_TTL_MS,
    key: rawKey.trim(),
    payload,
  };

  const tmpPath = `${cachePath}.tmp.${process.pid}.${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  try {
    writeFileSync(tmpPath, JSON.stringify(entry), "utf-8");
    renameSync(tmpPath, cachePath);
  } catch (err) {
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {}
    throw err;
  }

  return cachePath;
}
