// ============================================================================
// Classe Base Abstrata de Conectores Jurisdicionais (Template Method)
// Centraliza timeouts rigorosos (retries: 0), Circuit Breaker seguro,
// Modo Mock retrocompatível, merge Live-First e transparência cognitiva.
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
  public readonly autoTriggerKeywords?: RegExp;

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

  protected searchCatalog(_query: string, _limit: number): RawJurisSearchResult[] {
    return [];
  }

  protected shouldShortCircuitCatalog(_query: string): boolean {
    return false;
  }

  protected findCatalogItemById(_idOrRef: string): RawJurisFetchResult | null {
    return null;
  }

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

    // 1. Modo Mock Server (.NET Cross-Check / Testes Unitários)
    if (this.isMockMode()) {
      return this.executeMockSearch(query, limit, forceLive, startMs);
    }

    // 2. Modo Produção com Resiliência Dupla
    const catalogHits = this.searchCatalog(query, limit).map((item) => ({
      ...item,
      origin: "CURATED_CATALOG" as const,
    }));

    if (!forceLive && this.shouldShortCircuitCatalog(query) && catalogHits.length > 0) {
      return {
        hits: catalogHits.slice(0, limit),
        diagnostic: this.buildDiagnostic("ok", catalogHits.slice(0, limit).length, startMs, null, "CURATED_SHORT_CIRCUIT", null),
      };
    }

    if (!forceLive && this.isCircuitOpen()) {
      if (catalogHits.length > 0) {
        const sliced = catalogHits.slice(0, limit);
        return {
          hits: sliced,
          diagnostic: this.buildDiagnostic("ok", sliced.length, startMs, null, "CIRCUIT_OPEN_FALLBACK", "circuit_open"),
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
      const liveHits = rawLive.map((item) => ({ ...item, origin: "LIVE" as const }));
      if (forceLive) this.resetCircuit();

      if (liveHits.length > 0) {
        const merged = this.mergeLiveFirst(liveHits, catalogHits, limit);
        const hasCurated = merged.some((h) => h.origin === "CURATED_CATALOG");
        const mode: JurisSourceMode = hasCurated ? "MIXED" : "LIVE";
        return {
          hits: merged,
          diagnostic: this.buildDiagnostic("ok", merged.length, startMs, null, mode, null),
        };
      }

      if (!forceLive && catalogHits.length > 0) {
        const sliced = catalogHits.slice(0, limit);
        return {
          hits: sliced,
          diagnostic: this.buildDiagnostic("ok", sliced.length, startMs, null, "CURATED_FALLBACK", null),
        };
      }

      return {
        hits: [],
        diagnostic: this.buildDiagnostic("ok", 0, startMs, null, "LIVE", null),
      };
    } catch (err: any) {
      const liveError = err?.message || String(err);
      this.openCircuit();

      if (forceLive) {
        return {
          hits: [],
          diagnostic: this.buildDiagnostic("error", 0, startMs, liveError, "LIVE_FAILED", liveError),
        };
      }

      if (catalogHits.length > 0) {
        const sliced = catalogHits.slice(0, limit);
        return {
          hits: sliced,
          diagnostic: this.buildDiagnostic("ok", sliced.length, startMs, null, "CURATED_FALLBACK", liveError),
        };
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

    // 1. Modo Mock Server
    if (this.isMockMode()) {
      return this.executeMockFetch(idOrRef, forceLive);
    }

    // 2. Modo Produção: Catálogo primeiro quando !forceLive
    if (!forceLive) {
      const catItem = this.findCatalogItemById(idOrRef);
      if (catItem) {
        return { ...catItem, source: "CURATED_CATALOG" };
      }
    }

    if (!forceLive && this.isCircuitOpen()) {
      return this.notFoundFetchResult(idOrRef);
    }

    const timeoutMs = forceLive ? this.forceLiveTimeoutMs : this.defaultFetchTimeoutMs;
    try {
      const liveRes = await this.executeLiveFetch(idOrRef, { timeoutMs, forceLive });
      if (forceLive) this.resetCircuit();
      if (liveRes && liveRes.exists) {
        return { ...liveRes, source: liveRes.source || "LIVE" };
      }
      return this.notFoundFetchResult(idOrRef);
    } catch (err: any) {
      const liveError = err?.message || String(err);
      this.openCircuit();
      if (forceLive) {
        throw new Error(
          `[LIVE_UNAVAILABLE] Falha ao consultar '${idOrRef}' em ${this.courtId} com force_live=true: ${liveError}`
        );
      }
      const catItem = this.findCatalogItemById(idOrRef);
      if (catItem) {
        return { ...catItem, source: "CURATED_CATALOG" };
      }
      return this.notFoundFetchResult(idOrRef);
    }
  }

  private async executeMockSearch(
    query: string,
    limit: number,
    forceLive: boolean,
    startMs: number
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
        const catalogHits = this.searchCatalog(query, limit).map((item) => ({
          ...item,
          origin: "CURATED_CATALOG" as const,
        }));
        if (catalogHits.length > 0) {
          return {
            hits: catalogHits.slice(0, limit),
            diagnostic: this.buildDiagnostic("ok", catalogHits.slice(0, limit).length, startMs, null, "CURATED_FALLBACK", liveError),
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
      return {
        id: (typeof data === "object" && data.id) || idOrRef,
        court: this.courtId,
        exists: true,
        source: "LIVE",
        rawTextOrJson: item,
      };
    }

    if (res.status === 404 || res.status === 400) {
      return this.notFoundFetchResult(idOrRef);
    }

    const liveError = res.error || `HTTP ${res.status || 0}`;
    if (forceLive) {
      throw new Error(
        `[LIVE_UNAVAILABLE] Falha ao consultar '${idOrRef}' no mock ${this.courtId} com force_live=true: ${liveError}`
      );
    }

    const catItem = this.findCatalogItemById(idOrRef);
    if (catItem) {
      return { ...catItem, source: "CURATED_CATALOG" };
    }
    return this.notFoundFetchResult(idOrRef);
  }

  private mergeLiveFirst(
    liveHits: RawJurisSearchResult[],
    catalogHits: RawJurisSearchResult[],
    limit: number
  ): RawJurisSearchResult[] {
    const merged: RawJurisSearchResult[] = [];
    const seen = new Set<string>();
    for (const item of [...liveHits, ...catalogHits]) {
      const key = item.id.trim().toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
      if (merged.length >= limit) break;
    }
    return merged;
  }

  private buildDiagnostic(
    status: "ok" | "error",
    hits: number,
    startMs: number,
    error: string | null,
    sourceMode: JurisSourceMode,
    liveError: string | null
  ): CourtDiagnostic {
    return {
      court: this.courtId,
      status,
      hits,
      latency_ms: Math.max(0, Date.now() - startMs),
      error,
      source_mode: sourceMode,
      live_error: liveError,
    };
  }
}
