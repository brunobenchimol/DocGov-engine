import { describe, it, expect, afterEach } from "bun:test";
import {
  BaseJurisdictionProvider,
  type LiveFetchContext,
  type LiveSearchContext,
} from "../../src/tools/juris/providers/base_provider.ts";
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

  constructor(
    private readonly opts: {
      mockFetchStyle?: "path" | "query";
      notFoundStyle?: "null" | "exists_false";
    } = {}
  ) {
    super();
    if (opts.mockFetchStyle) {
      (this as any).mockFetchStyle = opts.mockFetchStyle;
    }
    if (opts.notFoundStyle) {
      (this as any).notFoundStyle = opts.notFoundStyle;
    }
  }

  protected getDefaultBaseUrl(): string {
    return "http://127.0.0.1:1";
  }

  protected override searchCatalog(query: string, limit: number): RawJurisSearchResult[] {
    if (/vazio_cat/i.test(query)) return [];
    return [
      {
        id: "SUMULA-STUB-1",
        court: "STUB",
        numero: "1",
        ano: 2024,
        tese: "Enunciado curado STUB 1 sobre terceirização e licitação.",
      },
    ].slice(0, limit);
  }

  protected override shouldShortCircuitCatalog(query: string): boolean {
    return /\bs[úu]mula\s*1\b/i.test(query);
  }

  protected override findCatalogItemById(idOrRef: string): RawJurisFetchResult | null {
    if (idOrRef.toUpperCase() === "SUMULA-STUB-1") {
      return {
        id: "SUMULA-STUB-1",
        court: "STUB",
        exists: true,
        rawTextOrJson: {
          id: "SUMULA-STUB-1",
          numero: "1",
          ano: 2024,
          colegiado: "Plenário",
          relator: "Jurisprudência Consolidada",
          ementa: "Enunciado curado STUB 1.",
          voto: "Fundamentação consolidada STUB 1.",
          dispositivo: "Enunciado vinculante.",
        },
      };
    }
    return null;
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
      ano: raw.ano || 2025,
      tese: raw.tese || "Tese live STUB",
    };
  }
}

describe("Jurisprudência — BaseJurisdictionProvider (Resiliência, Mock e force_live)", () => {
  const originalBase = process.env.DOCGOV_JURIS_BASE_URL;
  const originalStub = process.env.DOCGOV_STUB_BASE_URL;
  const originalMockStub = process.env.DOCGOV_JURIS_STUB_URL;

  afterEach(() => {
    if (originalBase === undefined) delete process.env.DOCGOV_JURIS_BASE_URL;
    else process.env.DOCGOV_JURIS_BASE_URL = originalBase;
    if (originalStub === undefined) delete process.env.DOCGOV_STUB_BASE_URL;
    else process.env.DOCGOV_STUB_BASE_URL = originalStub;
    if (originalMockStub === undefined) delete process.env.DOCGOV_JURIS_STUB_URL;
    else process.env.DOCGOV_JURIS_STUB_URL = originalMockStub;
  });

  it("deve aplicar precedência Live-First no merge e short-circuit apenas sem force_live", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(
          JSON.stringify({
            items: [{ id: "STUB-LIVE-2025", numero: "2025", ano: 2025, tese: "Acórdão recente" }],
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      },
    });
    try {
      process.env.DOCGOV_STUB_BASE_URL = `http://127.0.0.1:${server.port}`;
      const prov = new StubJurisProvider();

      // 1. Busca aberta: Live-First (STUB-LIVE-2025 vem antes de SUMULA-STUB-1)
      const openRes = await prov.searchWithDiagnostic("terceirização", { limit: 5 });
      expect(openRes.diagnostic.status).toBe("ok");
      expect(openRes.diagnostic.source_mode).toBe("MIXED");
      expect(openRes.hits[0]?.id).toBe("STUB-LIVE-2025");
      expect(openRes.hits[0]?.origin).toBe("LIVE");
      expect(openRes.hits[1]?.id).toBe("SUMULA-STUB-1");
      expect(openRes.hits[1]?.origin).toBe("CURATED_CATALOG");

      // 2. Short-circuit normativo sem rede
      const prevCalls = prov.liveSearchCalls;
      const scRes = await prov.searchWithDiagnostic("súmula 1", { limit: 5 });
      expect(scRes.diagnostic.source_mode).toBe("CURATED_SHORT_CIRCUIT");
      expect(prov.liveSearchCalls).toBe(prevCalls);

      // 3. force_live ignora short-circuit e usa janela estendida (3000ms)
      const flRes = await prov.searchWithDiagnostic("súmula 1", { limit: 5, force_live: true });
      expect(flRes.diagnostic.source_mode).toBe("MIXED");
      expect(prov.liveSearchCalls).toBe(prevCalls + 1);
      expect(prov.lastTimeoutUsed).toBe(3000);
    } finally {
      server.stop(true);
    }
  });

  it("deve impor retries: 0, abrir circuit breaker em HTTP 503 e permitir bypass/reset com force_live", async () => {
    let returnOk = false;
    const server = Bun.serve({
      port: 0,
      fetch() {
        if (!returnOk) {
          return new Response("Service Unavailable", { status: 503 });
        }
        return new Response(
          JSON.stringify({ items: [{ id: "STUB-RECOVERED", tese: "Recuperado" }] }),
          { headers: { "Content-Type": "application/json" } }
        );
      },
    });
    try {
      process.env.DOCGOV_STUB_BASE_URL = `http://127.0.0.1:${server.port}`;
      const prov = new StubJurisProvider();

      // 1. Primeira falha: apenas 1 chamada (retries: 0) e degradação transparente
      const r1 = await prov.searchWithDiagnostic("licitação");
      expect(prov.liveSearchCalls).toBe(1);
      expect(r1.diagnostic.status).toBe("ok");
      expect(r1.diagnostic.source_mode).toBe("CURATED_FALLBACK");
      expect(r1.diagnostic.live_error).toContain("HTTP 503");
      expect(r1.hits[0]?.origin).toBe("CURATED_CATALOG");

      // 2. Segunda chamada com circuito aberto: não bate na rede
      const r2 = await prov.searchWithDiagnostic("licitação");
      expect(prov.liveSearchCalls).toBe(1);
      expect(r2.diagnostic.source_mode).toBe("CIRCUIT_OPEN_FALLBACK");
      expect(r2.diagnostic.live_error).toBe("circuit_open");

      // 3. force_live sob 503 persistente: falha explícita sem degradação silenciosa
      const r3 = await prov.searchWithDiagnostic("licitação", { force_live: true });
      expect(prov.liveSearchCalls).toBe(2);
      expect(r3.diagnostic.status).toBe("error");
      expect(r3.diagnostic.source_mode).toBe("LIVE_FAILED");
      expect(r3.hits.length).toBe(0);

      // 4. force_live após recuperação: ignora circuito aberto e reseta o circuito
      returnOk = true;
      const r4 = await prov.searchWithDiagnostic("licitação", { force_live: true });
      expect(r4.diagnostic.status).toBe("ok");
      expect(r4.hits[0]?.id).toBe("STUB-RECOVERED");

      // 5. Chamada normal seguinte usa live normalmente pois circuito foi fechado
      const r5 = await prov.searchWithDiagnostic("licitação");
      expect(prov.liveSearchCalls).toBe(4);
      expect(r5.hits[0]?.id).toBe("STUB-RECOVERED");
    } finally {
      server.stop(true);
    }
  });

  it("em modo Mock (DOCGOV_JURIS_BASE_URL) deve suportar 200, 503 com fallback, force_live explícito e 404 anti-alucinação", async () => {
    let mode: "200" | "503" = "200";
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/search") {
          if (mode === "503") return new Response("Unavailable", { status: 503 });
          return new Response(
            JSON.stringify({ items: [{ id: "MOCK-STUB-10", tese: "Mock Live Hit" }] }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
        if (url.pathname.startsWith("/fetch")) {
          if (url.pathname.includes("STUB-999999")) {
            return new Response("Not Found", { status: 404 });
          }
          if (mode === "503") return new Response("Unavailable", { status: 503 });
          return new Response(
            JSON.stringify({ id: "MOCK-STUB-10", numero: "10", ano: 2025, ementa: "OK" }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      },
    });
    try {
      process.env.DOCGOV_JURIS_BASE_URL = `http://127.0.0.1:${server.port}`;
      const prov = new StubJurisProvider();

      // 200 OK no mock
      const okSearch = await prov.searchWithDiagnostic("súmula 1"); // short-circuit desabilitado em mock!
      expect(okSearch.diagnostic.source_mode).toBe("LIVE");
      expect(okSearch.hits[0]?.id).toBe("MOCK-STUB-10");
      expect(okSearch.hits[0]?.origin).toBe("LIVE");

      const okFetch = await prov.fetch("MOCK-STUB-10");
      expect(okFetch?.exists).toBe(true);
      expect(okFetch?.source).toBe("LIVE");

      // 503 no mock -> degrada para catálogo quando !force_live (sem contaminar circuito)
      mode = "503";
      const degSearch = await prov.searchWithDiagnostic("licitação");
      expect(degSearch.diagnostic.status).toBe("ok");
      expect(degSearch.diagnostic.source_mode).toBe("CURATED_FALLBACK");
      expect(degSearch.diagnostic.live_error).toContain("HTTP 503");
      expect(degSearch.hits[0]?.id).toBe("SUMULA-STUB-1");

      const degFetch = await prov.fetch("SUMULA-STUB-1");
      expect(degFetch?.exists).toBe(true);
      expect(degFetch?.source).toBe("CURATED_CATALOG");

      // 503 no mock + force_live -> falha explícita
      const flSearch = await prov.searchWithDiagnostic("licitação", { force_live: true });
      expect(flSearch.diagnostic.status).toBe("error");
      expect(flSearch.diagnostic.source_mode).toBe("LIVE_FAILED");
      await expect(prov.fetch("SUMULA-STUB-1", { force_live: true })).rejects.toThrow(
        /\[LIVE_UNAVAILABLE\]/
      );

      // 404 no mock -> null (trava anti-alucinação)
      const notFound = await prov.fetch("STUB-999999");
      expect(notFound).toBeNull();

      // Se mock voltar a 200, circuito nunca abriu em modo mock!
      mode = "200";
      const recSearch = await prov.searchWithDiagnostic("licitação");
      expect(recSearch.diagnostic.source_mode).toBe("LIVE");
    } finally {
      server.stop(true);
    }
  });
});
