import { describe, it, expect, afterEach } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BaseJurisdictionProvider,
  type LiveFetchContext,
  type LiveSearchContext,
} from "../../src/tools/juris/providers/base_provider.ts";
import {
  buildJurisCacheFilePath,
  getJurisCacheDir,
  JURIS_TTL_MS,
} from "../../src/tools/juris/providers/juris_ttl_cache.ts";
import type {
  RawJurisFetchResult,
  RawJurisSearchResult,
} from "../../src/tools/juris/types.ts";

class StubJurisProvider extends BaseJurisdictionProvider {
  public readonly courtId = "STUB";
  public readonly envOverrideKey = "DOCGOV_STUB_BASE_URL";
  protected override readonly mockEnvKeys = ["DOCGOV_JURIS_STUB_URL"];
  protected override readonly baseUrlEnvKeys = ["DOCGOV_STUB_BASE_URL"];
  protected override readonly defaultLiveTimeoutMs = 1500;
  protected override readonly forceLiveTimeoutMs = 3000;

  public liveSearchCalls = 0;
  public liveFetchCalls = 0;
  public lastTimeoutUsed = 0;

  protected getDefaultBaseUrl(): string {
    return "http://127.0.0.1:1";
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    this.liveSearchCalls++;
    this.lastTimeoutUsed = ctx.timeoutMs;
    const baseUrl = this.getBaseUrl();
    const res = await this.executeHttp(
      `${baseUrl}/live-search?q=${encodeURIComponent(query)}&limit=${limit}`,
      { timeoutMs: ctx.timeoutMs }
    );
    this.assertHttpOk(res);
    return (res.data?.items || []).map((x: any) => this.mapMockHitToResult(x));
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    this.liveFetchCalls++;
    this.lastTimeoutUsed = ctx.timeoutMs;
    const baseUrl = this.getBaseUrl();
    const res = await this.executeHttp(
      `${baseUrl}/live-fetch?id=${encodeURIComponent(idOrRef)}`,
      { timeoutMs: ctx.timeoutMs }
    );
    if (res.status === 404) return null;
    this.assertHttpOk(res);
    return {
      id: idOrRef,
      court: "STUB",
      exists: true,
      rawTextOrJson: res.data,
    };
  }

  protected mapMockHitToResult(raw: any): RawJurisSearchResult {
    return {
      id: raw.id || "STUB-LIVE-1",
      court: "STUB",
      numero: raw.numero || "100",
      ...(raw.ano !== undefined ? { ano: raw.ano } : {}),
      tese: raw.tese || "Tese live STUB",
    };
  }
}

describe("Jurisprudência v1.7.6 — BaseJurisdictionProvider + Cache Global TTL 24h", () => {
  const dirs: string[] = [];
  const originalBase = process.env.DOCGOV_JURIS_BASE_URL;
  const originalStub = process.env.DOCGOV_STUB_BASE_URL;
  const originalMockStub = process.env.DOCGOV_JURIS_STUB_URL;
  const originalCache = process.env.DOCGOV_JURIS_CACHE_DIR;

  function makeCacheDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "docgov-base-ttl-"));
    dirs.push(dir);
    process.env.DOCGOV_JURIS_CACHE_DIR = dir;
    return dir;
  }

  afterEach(() => {
    if (originalBase === undefined) delete process.env.DOCGOV_JURIS_BASE_URL;
    else process.env.DOCGOV_JURIS_BASE_URL = originalBase;
    if (originalStub === undefined) delete process.env.DOCGOV_STUB_BASE_URL;
    else process.env.DOCGOV_STUB_BASE_URL = originalStub;
    if (originalMockStub === undefined) delete process.env.DOCGOV_JURIS_STUB_URL;
    else process.env.DOCGOV_JURIS_STUB_URL = originalMockStub;
    if (originalCache === undefined) delete process.env.DOCGOV_JURIS_CACHE_DIR;
    else process.env.DOCGOV_JURIS_CACHE_DIR = originalCache;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("(a)(b)(d) live 200 grava cache em <root>/<court>/, 503 com cache quente serve CACHE_TTL_FALLBACK e force_live=true ignora cache", async () => {
    const cacheRoot = makeCacheDir();
    let mode: "200" | "503" = "200";
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (mode === "503") return new Response("Service Unavailable", { status: 503 });
        if (url.pathname === "/live-search") {
          return Response.json({
            items: [{ id: "STUB-LIVE-2025", numero: "2025", ano: 2025, tese: "Acórdão live" }],
          });
        }
        return Response.json({ id: "STUB-LIVE-2025", numero: "2025", ano: 2025, ementa: "Íntegra" });
      },
    });

    try {
      process.env.DOCGOV_STUB_BASE_URL = `http://127.0.0.1:${server.port}`;
      const prov = new StubJurisProvider();

      // (a) Live 200 grava cache no subdiretório da corte (<cacheRoot>/stub/)
      const rLive = await prov.searchWithDiagnostic("licitação", { limit: 5 });
      expect(rLive.diagnostic.status).toBe("ok");
      expect(rLive.diagnostic.source_mode).toBe("LIVE");
      expect(rLive.hits[0]?.id).toBe("STUB-LIVE-2025");
      expect(rLive.hits[0]?.origin).toBe("LIVE");
      const searchCachePath = buildJurisCacheFilePath("STUB", "search", "licitação|5");
      expect(searchCachePath.startsWith(join(cacheRoot, "stub"))).toBe(true);
      expect(existsSync(searchCachePath)).toBe(true);

      const fLive = await prov.fetch("STUB-LIVE-2025");
      expect(fLive?.exists).toBe(true);
      expect(fLive?.source).toBe("LIVE");
      expect(existsSync(buildJurisCacheFilePath("STUB", "fetch", "STUB-LIVE-2025"))).toBe(true);

      // (b) 503 com cache quente -> CACHE_TTL_FALLBACK (cache_hit: true, fetched_at)
      mode = "503";
      const rFallback = await prov.searchWithDiagnostic("licitação", { limit: 5 });
      expect(rFallback.diagnostic.status).toBe("ok");
      expect(rFallback.diagnostic.source_mode).toBe("CACHE_TTL_FALLBACK");
      expect(rFallback.diagnostic.cache_hit).toBe(true);
      expect(rFallback.diagnostic.fetched_at).toBeDefined();
      expect(rFallback.diagnostic.live_error).toContain("HTTP 503");
      expect(rFallback.hits[0]?.id).toBe("STUB-LIVE-2025");

      // Circuito aberto na 2ª chamada sem force_live -> CIRCUIT_OPEN_FALLBACK sem ir à rede
      const callsBeforeCircuit = prov.liveSearchCalls;
      const rCircuit = await prov.searchWithDiagnostic("licitação", { limit: 5 });
      expect(prov.liveSearchCalls).toBe(callsBeforeCircuit);
      expect(rCircuit.diagnostic.status).toBe("ok");
      expect(rCircuit.diagnostic.source_mode).toBe("CIRCUIT_OPEN_FALLBACK");
      expect(rCircuit.diagnostic.cache_hit).toBe(true);

      const fFallback = await prov.fetch("STUB-LIVE-2025");
      expect(fFallback?.cache_hit).toBe(true);
      expect(fFallback?.fetched_at).toBeDefined();

      // (d) force_live=true ignora cache quente e circuito aberto -> LIVE_FAILED / [LIVE_UNAVAILABLE]
      const rForcedFail = await prov.searchWithDiagnostic("licitação", { limit: 5, force_live: true });
      expect(rForcedFail.diagnostic.status).toBe("error");
      expect(rForcedFail.diagnostic.source_mode).toBe("LIVE_FAILED");
      expect(rForcedFail.hits).toEqual([]);
      expect(prov.lastTimeoutUsed).toBe(3000);

      await expect(prov.fetch("STUB-LIVE-2025", { force_live: true })).rejects.toThrow(
        /\[LIVE_UNAVAILABLE\]/
      );

      // Recuperação com force_live=true fecha o circuito
      mode = "200";
      const rRecovered = await prov.searchWithDiagnostic("licitação", { limit: 5, force_live: true });
      expect(rRecovered.diagnostic.status).toBe("ok");
      expect(rRecovered.diagnostic.source_mode).toBe("LIVE");
    } finally {
      server.stop(true);
    }
  });

  it("(c)(e) 503 com cache frio ou expirado (> 24h) devolve LIVE_FAILED sem servir fallback", async () => {
    makeCacheDir();
    let mode: "200" | "503" = "503";
    const server = Bun.serve({
      port: 0,
      fetch() {
        if (mode === "503") return new Response("Service Unavailable", { status: 503 });
        return Response.json({ items: [{ id: "STUB-TEMP-1", tese: "Temporário" }] });
      },
    });

    try {
      process.env.DOCGOV_STUB_BASE_URL = `http://127.0.0.1:${server.port}`;
      const prov = new StubJurisProvider();

      // (c) Cache frio + 503 -> LIVE_FAILED e [LIVE_UNAVAILABLE]
      const rCold = await prov.searchWithDiagnostic("consulta inédita", { limit: 5 });
      expect(rCold.diagnostic.status).toBe("error");
      expect(rCold.diagnostic.source_mode).toBe("LIVE_FAILED");
      expect(rCold.hits).toEqual([]);
      await expect(prov.fetch("STUB-INEXISTENTE")).rejects.toThrow(/\[LIVE_UNAVAILABLE\]/);

      // Popula cache via 200 e depois expira (> 24h)
      mode = "200";
      prov.resetCircuit();
      await prov.searchWithDiagnostic("consulta expiravel", { limit: 5 });
      await prov.fetch("STUB-EXP-1");

      const searchFile = buildJurisCacheFilePath("STUB", "search", "consulta expiravel|5");
      const sEntry = JSON.parse(readFileSync(searchFile, "utf-8"));
      sEntry.fetched_at = Date.now() - JURIS_TTL_MS - 1000;
      writeFileSync(searchFile, JSON.stringify(sEntry), "utf-8");

      const fetchFile = buildJurisCacheFilePath("STUB", "fetch", "STUB-EXP-1");
      const fEntry = JSON.parse(readFileSync(fetchFile, "utf-8"));
      fEntry.fetched_at = Date.now() - JURIS_TTL_MS - 1000;
      writeFileSync(fetchFile, JSON.stringify(fEntry), "utf-8");

      // (e) Cache expirado + 503 -> LIVE_FAILED / [LIVE_UNAVAILABLE]
      mode = "503";
      const rExpired = await prov.searchWithDiagnostic("consulta expiravel", { limit: 5 });
      expect(rExpired.diagnostic.status).toBe("error");
      expect(rExpired.diagnostic.source_mode).toBe("LIVE_FAILED");
      expect(rExpired.hits).toEqual([]);
      await expect(prov.fetch("STUB-EXP-1")).rejects.toThrow(/\[LIVE_UNAVAILABLE\]/);
    } finally {
      server.stop(true);
    }
  });

  it("em modo Mock (DOCGOV_JURIS_BASE_URL) aplica ciclo Live-First -> TTL 24h -> CACHE_TTL_FALLBACK -> LIVE_FAILED e 404 anti-alucinação", async () => {
    makeCacheDir();
    let mode: "200" | "503" = "200";
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/search") {
          if (mode === "503") return new Response("Unavailable", { status: 503 });
          return Response.json({ items: [{ id: "MOCK-STUB-10", tese: "Mock Live Hit" }] });
        }
        if (url.pathname.startsWith("/fetch")) {
          if (url.pathname.includes("STUB-999999")) return new Response("Not Found", { status: 404 });
          if (mode === "503") return new Response("Unavailable", { status: 503 });
          return Response.json({ id: "MOCK-STUB-10", numero: "10", ano: 2025, ementa: "OK" });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    try {
      process.env.DOCGOV_JURIS_BASE_URL = `http://127.0.0.1:${server.port}`;
      const prov = new StubJurisProvider();
      expect(getJurisCacheDir("STUB").endsWith("stub")).toBe(true);

      const okSearch = await prov.searchWithDiagnostic("licitação");
      expect(okSearch.diagnostic.source_mode).toBe("LIVE");
      expect(okSearch.hits[0]?.id).toBe("MOCK-STUB-10");

      const okFetch = await prov.fetch("MOCK-STUB-10");
      expect(okFetch?.exists).toBe(true);
      expect(okFetch?.source).toBe("LIVE");

      // 503 no mock com cache quente -> CACHE_TTL_FALLBACK em search e fetch
      mode = "503";
      const degSearch = await prov.searchWithDiagnostic("licitação");
      expect(degSearch.diagnostic.status).toBe("ok");
      expect(degSearch.diagnostic.source_mode).toBe("CACHE_TTL_FALLBACK");
      expect(degSearch.diagnostic.cache_hit).toBe(true);
      expect(degSearch.hits[0]?.id).toBe("MOCK-STUB-10");

      const degFetch = await prov.fetch("MOCK-STUB-10");
      expect(degFetch?.cache_hit).toBe(true);
      expect(degFetch?.rawTextOrJson.ementa).toBe("OK");

      // 503 no mock + cache frio ou force_live -> LIVE_FAILED / [LIVE_UNAVAILABLE]
      const coldSearch = await prov.searchWithDiagnostic("query sem cache");
      expect(coldSearch.diagnostic.status).toBe("error");
      expect(coldSearch.diagnostic.source_mode).toBe("LIVE_FAILED");

      const flSearch = await prov.searchWithDiagnostic("licitação", { force_live: true });
      expect(flSearch.diagnostic.status).toBe("error");
      expect(flSearch.diagnostic.source_mode).toBe("LIVE_FAILED");

      await expect(prov.fetch("MOCK-STUB-10", { force_live: true })).rejects.toThrow(
        /\[LIVE_UNAVAILABLE\]/
      );

      // 404 no mock -> null (nunca usa cache)
      expect(await prov.fetch("STUB-999999")).toBeNull();
    } finally {
      server.stop(true);
    }
  });
});
