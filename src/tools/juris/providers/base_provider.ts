// ============================================================================
// Classe Base Abstrata de Conectores Jurisdicionais (Template Method — Corte Limpo v1.7.6)
// Ciclo Global: Live-First -> Grava TTL 24h -> Fallback TTL 24h (!forceLive) -> LIVE_FAILED
// ============================================================================

import type {
  CourtDiagnostic,
  FetchProviderOptions,
  JurisdictionProvider,
  JurisdictionTier,
  JurisSourceMode,
  RawJurisFetchResult,
  RawJurisSearchResult,
  SearchJurisOptions,
} from "../types.ts";
import {
  executeJurisHttpRequest,
  type JurisHttpOptions,
  type JurisHttpResponse,
} from "./http_client.ts";
import { readJurisTtlCache, writeJurisTtlCache } from "./juris_ttl_cache.ts";

export interface LiveSearchContext {
  timeoutMs: number;
  options?: Partial<SearchJurisOptions>;
}

export interface LiveFetchContext {
  timeoutMs: number;
  forceLive: boolean;
}

export abstract class BaseJurisdictionProvider implements JurisdictionProvider {
  public abstract readonly courtId: string;
  public readonly tier?: JurisdictionTier;
  public readonly uf?: string;
  public readonly defaultFederal?: boolean;
  public readonly envOverrideKey?: string;
  public readonly liveSmokeQuery?: string;
  public readonly idPatterns?: RegExp[];

  protected readonly mockEnvKeys: string[] = [];
  protected readonly baseUrlEnvKeys: string[] = [];
  protected readonly mockFetchStyle: "path" | "query" = "path";
  protected readonly notFoundStyle: "null" | "exists_false" = "null";
  protected readonly defaultLiveTimeoutMs: number = 4500;
  protected readonly defaultFetchTimeoutMs: number = 6000;
  protected readonly forceLiveTimeoutMs: number = 9000;
  protected readonly maxAllowedTimeoutMs: number = 9500;
  protected readonly circuitTtlMs: number = 30_000;

  private circuitOpenedUntil = 0;

  protected abstract getDefaultBaseUrl(): string;
  protected abstract executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]>;
  protected abstract executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null>;
  protected abstract mapMockHitToResult(raw: any): RawJurisSearchResult;

  public resetCircuit(): void {
    this.circuitOpenedUntil = 0;
  }

  protected isCircuitOpen(): boolean {
    if (this.isMockMode()) return false;
    return Date.now() < this.circuitOpenedUntil;
  }

  protected openCircuit(): void {
    if (this.isMockMode()) return;
    this.circuitOpenedUntil = Date.now() + this.circuitTtlMs;
  }

  protected isMockMode(): boolean {
    if (process.env.DOCGOV_JURIS_BASE_URL) return true;
    return this.mockEnvKeys.some((k) => !!process.env[k]);
  }

  protected getBaseUrl(): string {
    for (const key of this.mockEnvKeys) {
      if (process.env[key]) return process.env[key]!.replace(/\/+$/, "");
    }
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    for (const key of this.baseUrlEnvKeys) {
      if (process.env[key]) return process.env[key]!.replace(/\/+$/, "");
    }
    return this.getDefaultBaseUrl().replace(/\/+$/, "");
  }

  protected async executeHttp(
    url: string,
    options: JurisHttpOptions = {}
  ): Promise<JurisHttpResponse> {
    const requestedTimeout = options.timeoutMs ?? this.defaultLiveTimeoutMs;
    const boundedTimeout = Math.min(requestedTimeout, this.maxAllowedTimeoutMs);
    return executeJurisHttpRequest(url, {
      ...options,
      timeoutMs: boundedTimeout,
      retries: 0,
    });
  }

  protected assertHttpOk(res: JurisHttpResponse, contextLabel?: string): void {
    if (res.ok) return;
    const baseMsg = res.error || `HTTP ${res.status || 0}`;
    throw new Error(contextLabel ? `${contextLabel}: ${baseMsg}` : baseMsg);
  }

  protected notFoundFetchResult(idOrRef: string): RawJurisFetchResult | null {
    if (this.notFoundStyle === "exists_false") {
      return {
        id: idOrRef,
        court: this.courtId,
        exists: false,
        rawTextOrJson: null,
      };
    }
    return null;
  }

  public async search(
    query: string,
    options?: Partial<SearchJurisOptions>
  ): Promise<RawJurisSearchResult[]> {
    const { hits } = await this.searchWithDiagnostic(query, options);
    return hits;
  }

  public async searchWithDiagnostic(
    query: string,
    options?: Partial<SearchJurisOptions>
  ): Promise<{ hits: RawJurisSearchResult[]; diagnostic: CourtDiagnostic }> {
    const limit = Math.min(options?.limit || 10, 20);
    const forceLive = options?.force_live === true;
    const startMs = Date.now();
    const cacheKey = `${query}|${limit}`;

    if (this.isMockMode()) {
      return this.executeMockSearch(query, limit, forceLive, startMs, cacheKey);
    }

    if (!forceLive && this.isCircuitOpen()) {
      const cached = readJurisTtlCache<RawJurisSearchResult[]>(this.courtId, "search", cacheKey);
      if (cached) {
        const hits = cached.payload.slice(0, limit).map((h) => ({ ...h, origin: "LIVE" as const }));
        return {
          hits,
          diagnostic: this.buildDiagnostic(
            "ok",
            hits.length,
            startMs,
            null,
            "CIRCUIT_OPEN_FALLBACK",
            "circuit_open",
            true,
            new Date(cached.fetched_at).toISOString()
          ),
        };
      }
      return {
        hits: [],
        diagnostic: this.buildDiagnostic("error", 0, startMs, "circuit_open", "LIVE_FAILED", "circuit_open"),
      };
    }

    const timeoutMs = forceLive ? this.forceLiveTimeoutMs : this.defaultLiveTimeoutMs;
    try {
      const rawLive = await this.executeLiveSearch(query, limit, { timeoutMs, options });
      const liveHits = rawLive.slice(0, limit).map((item) => ({ ...item, origin: "LIVE" as const }));
      if (forceLive) this.resetCircuit();

      await writeJurisTtlCache(this.courtId, "search", cacheKey, liveHits);

      return {
        hits: liveHits,
        diagnostic: this.buildDiagnostic("ok", liveHits.length, startMs, null, "LIVE", null),
      };
    } catch (err: any) {
      const liveError = err?.message || String(err);
      this.openCircuit();

      if (!forceLive) {
        const cached = readJurisTtlCache<RawJurisSearchResult[]>(this.courtId, "search", cacheKey);
        if (cached) {
          const hits = cached.payload.slice(0, limit).map((h) => ({ ...h, origin: "LIVE" as const }));
          return {
            hits,
            diagnostic: this.buildDiagnostic(
              "ok",
              hits.length,
              startMs,
              null,
              "CACHE_TTL_FALLBACK",
              liveError,
              true,
              new Date(cached.fetched_at).toISOString()
            ),
          };
        }
      }

      return {
        hits: [],
        diagnostic: this.buildDiagnostic("error", 0, startMs, liveError, "LIVE_FAILED", liveError),
      };
    }
  }

  public async fetch(
    idOrRef: string,
    options?: FetchProviderOptions
  ): Promise<RawJurisFetchResult | null> {
    const forceLive = options?.force_live === true;

    if (this.isMockMode()) {
      return this.executeMockFetch(idOrRef, forceLive);
    }

    if (!forceLive && this.isCircuitOpen()) {
      const cached = readJurisTtlCache<RawJurisFetchResult>(this.courtId, "fetch", idOrRef);
      if (cached) {
        return {
          ...cached.payload,
          source: "LIVE",
          cache_hit: true,
          fetched_at: new Date(cached.fetched_at).toISOString(),
        };
      }
      throw new Error(
        `[LIVE_UNAVAILABLE] Circuito aberto e sem cache TTL 24h válido para '${idOrRef}' em ${this.courtId}`
      );
    }

    const timeoutMs = forceLive ? this.forceLiveTimeoutMs : this.defaultFetchTimeoutMs;
    try {
      const liveRes = await this.executeLiveFetch(idOrRef, { timeoutMs, forceLive });
      if (forceLive) this.resetCircuit();
      if (liveRes && liveRes.exists) {
        const normalized: RawJurisFetchResult = { ...liveRes, source: "LIVE" };
        await writeJurisTtlCache(this.courtId, "fetch", idOrRef, normalized);
        return normalized;
      }
      return this.notFoundFetchResult(idOrRef);
    } catch (err: any) {
      const liveError = err?.message || String(err);
      this.openCircuit();
      if (!forceLive) {
        const cached = readJurisTtlCache<RawJurisFetchResult>(this.courtId, "fetch", idOrRef);
        if (cached) {
          return {
            ...cached.payload,
            source: "LIVE",
            cache_hit: true,
            fetched_at: new Date(cached.fetched_at).toISOString(),
          };
        }
      }
      throw new Error(
        `[LIVE_UNAVAILABLE] Falha ao consultar '${idOrRef}' em ${this.courtId}${
          forceLive ? " com force_live=true" : " sem cache TTL 24h válido"
        }: ${liveError}`
      );
    }
  }

  private async executeMockSearch(
    query: string,
    limit: number,
    forceLive: boolean,
    startMs: number,
    cacheKey: string
  ): Promise<{ hits: RawJurisSearchResult[]; diagnostic: CourtDiagnostic }> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/search?court=${encodeURIComponent(this.courtId)}&q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await this.executeHttp(url, {
      timeoutMs: forceLive ? this.forceLiveTimeoutMs : this.defaultLiveTimeoutMs,
    });

    if (!res.ok) {
      const liveError = res.error || `HTTP ${res.status || 0}`;
      const isTransientFailure = res.status === 0 || res.status >= 500;
      if (!forceLive && isTransientFailure) {
        const cached = readJurisTtlCache<RawJurisSearchResult[]>(this.courtId, "search", cacheKey);
        if (cached) {
          const hits = cached.payload.slice(0, limit).map((h) => ({ ...h, origin: "LIVE" as const }));
          return {
            hits,
            diagnostic: this.buildDiagnostic(
              "ok",
              hits.length,
              startMs,
              null,
              "CACHE_TTL_FALLBACK",
              liveError,
              true,
              new Date(cached.fetched_at).toISOString()
            ),
          };
        }
      }
      return {
        hits: [],
        diagnostic: this.buildDiagnostic("error", 0, startMs, liveError, "LIVE_FAILED", liveError),
      };
    }

    const data = res.data;
    const rawHits = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.registros)
      ? data.registros.map((r: any) => r.registro || r)
      : [];

    const hits = rawHits
      .slice(0, limit)
      .map((h: any) => ({ ...this.mapMockHitToResult(h), origin: "LIVE" as const }));

    await writeJurisTtlCache(this.courtId, "search", cacheKey, hits);

    return {
      hits,
      diagnostic: this.buildDiagnostic("ok", hits.length, startMs, null, "LIVE", null),
    };
  }

  private async executeMockFetch(
    idOrRef: string,
    forceLive: boolean
  ): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const url =
      this.mockFetchStyle === "query"
        ? `${baseUrl}/fetch?court=${encodeURIComponent(this.courtId)}&id=${encodeURIComponent(idOrRef)}`
        : `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=${encodeURIComponent(this.courtId)}`;

    const res = await this.executeHttp(url, {
      timeoutMs: forceLive ? this.forceLiveTimeoutMs : this.defaultFetchTimeoutMs,
    });

    if (res.ok && res.data) {
      const data = res.data;
      if (typeof data === "object" && data.exists === false) {
        return this.notFoundFetchResult(idOrRef);
      }
      const item =
        typeof data === "object" && data.exists === true && data.rawTextOrJson
          ? data.rawTextOrJson
          : Array.isArray(data)
          ? data[0]
          : Array.isArray(data?.items)
          ? data.items[0]
          : data;
      if (!item) return this.notFoundFetchResult(idOrRef);
      const result: RawJurisFetchResult = {
        id: (typeof data === "object" && data.id) || idOrRef,
        court: this.courtId,
        exists: true,
        source: "LIVE",
        rawTextOrJson: item,
      };
      await writeJurisTtlCache(this.courtId, "fetch", idOrRef, result);
      return result;
    }

    if (res.status === 404 || res.status === 400) {
      return this.notFoundFetchResult(idOrRef);
    }

    const liveError = res.error || `HTTP ${res.status || 0}`;
    if (!forceLive) {
      const cached = readJurisTtlCache<RawJurisFetchResult>(this.courtId, "fetch", idOrRef);
      if (cached) {
        return {
          ...cached.payload,
          source: "LIVE",
          cache_hit: true,
          fetched_at: new Date(cached.fetched_at).toISOString(),
        };
      }
    }

    throw new Error(
      `[LIVE_UNAVAILABLE] Falha ao consultar '${idOrRef}' no mock ${this.courtId}${
        forceLive ? " com force_live=true" : " sem cache TTL 24h válido"
      }: ${liveError}`
    );
  }

  private buildDiagnostic(
    status: "ok" | "error",
    hits: number,
    startMs: number,
    error: string | null,
    sourceMode: JurisSourceMode,
    liveError: string | null,
    cacheHit?: boolean,
    fetchedAt?: string
  ): CourtDiagnostic {
    return {
      court: this.courtId,
      status,
      hits,
      latency_ms: Math.max(0, Date.now() - startMs),
      error,
      source_mode: sourceMode,
      live_error: liveError,
      ...(cacheHit ? { cache_hit: true, ...(fetchedAt ? { fetched_at: fetchedAt } : {}) } : {}),
    };
  }
}
