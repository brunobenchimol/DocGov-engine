// ============================================================================
// Cache Dinâmico Live-Backed com TTL Estrito de 24h (Global JURIS)
// docgov-engine v1.7.6 — providers/juris_ttl_cache.ts
// ============================================================================

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { withDirectoryLock, writeFileSafeAsync } from "../../../utils/fs_safe_io.ts";

export const JURIS_TTL_MS = 86_400_000; // 24 horas (1 dia)

export interface JurisTtlCacheEntry<T> {
  fetched_at: number;
  ttl_ms: number;
  court: string;
  key: string;
  payload: T;
}

export interface JurisTtlCacheHit<T> {
  payload: T;
  fetched_at: number;
  ttl_ms: number;
  age_ms: number;
  cachePath: string;
}

function normalizeCourtFolder(courtId: string): string {
  const clean = (courtId || "default").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return clean || "default";
}

export function getJurisCacheRootDir(): string {
  const customRoot = process.env.DOCGOV_JURIS_CACHE_DIR?.trim();
  if (customRoot) {
    return customRoot;
  }
  return join(os.tmpdir(), "docgov_juris_cache");
}

export function getJurisCacheDir(courtId: string): string {
  return join(getJurisCacheRootDir(), normalizeCourtFolder(courtId));
}

export function buildJurisCacheFilePath(
  courtId: string,
  kind: "search" | "fetch",
  rawKey: string
): string {
  const normalized = rawKey.trim().toLowerCase().replace(/\s+/g, " ");
  const hash = createHash("sha256")
    .update(`${normalizeCourtFolder(courtId)}:${kind}:${normalized}`)
    .digest("hex")
    .slice(0, 20);
  return join(getJurisCacheDir(courtId), `${kind}_${hash}.json`);
}

export function readJurisTtlCache<T>(
  courtId: string,
  kind: "search" | "fetch",
  rawKey: string,
  nowMs: number = Date.now()
): JurisTtlCacheHit<T> | null {
  const cachePath = buildJurisCacheFilePath(courtId, kind, rawKey);
  if (!existsSync(cachePath)) return null;

  try {
    const raw = readFileSync(cachePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<JurisTtlCacheEntry<T>>;
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
        : JURIS_TTL_MS;
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

export async function writeJurisTtlCache<T>(
  courtId: string,
  kind: "search" | "fetch",
  rawKey: string,
  payload: T,
  nowMs: number = Date.now()
): Promise<string> {
  const dir = getJurisCacheDir(courtId);
  const cachePath = buildJurisCacheFilePath(courtId, kind, rawKey);
  const entry: JurisTtlCacheEntry<T> = {
    fetched_at: nowMs,
    ttl_ms: JURIS_TTL_MS,
    court: courtId,
    key: rawKey.trim(),
    payload,
  };

  await withDirectoryLock(dir, `juris_ttl_${normalizeCourtFolder(courtId)}`, async () => {
    await writeFileSafeAsync(cachePath, JSON.stringify(entry));
  });

  return cachePath;
}
