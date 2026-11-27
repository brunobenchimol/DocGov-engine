import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultJurisdictionRegistry } from "../../src/tools/juris/provider_registry.ts";
import { TstProvider } from "../../src/tools/juris/providers/tst_provider.ts";
import { parseCanonicalAcordaoRef } from "../../src/tools/juris/providers/http_client.ts";
import { assertAuthenticAcordao, sliceAcordaoAnatomically } from "../../src/tools/juris/anatomical_slicer.ts";
import { fetchJuris } from "../../src/tools/juris/fetch_juris.ts";

describe("Jurisprudência v1.7.6 — Cortes Federais (Corte Limpo, Zero Viés e Zero Ano Fabricado)", () => {
  const dirs: string[] = [];
  const originalAguEnv = process.env.DOCGOV_JURIS_AGU_URL;
  const originalTstEnv = process.env.DOCGOV_TST_BASE_URL;
  const originalTcuEnv = process.env.DOCGOV_TCU_BASE_URL;
  const originalStfEnv = process.env.DOCGOV_STF_BASE_URL;
  const originalStjEnv = process.env.DOCGOV_STJ_BASE_URL;
  const originalJurisEnv = process.env.DOCGOV_JURIS_BASE_URL;
  const originalCacheEnv = process.env.DOCGOV_JURIS_CACHE_DIR;

  function makeTempDir(prefix: string): string {
    const d = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(d);
    return d;
  }

  afterEach(() => {
    if (originalAguEnv === undefined) delete process.env.DOCGOV_JURIS_AGU_URL;
    else process.env.DOCGOV_JURIS_AGU_URL = originalAguEnv;
    if (originalTstEnv === undefined) delete process.env.DOCGOV_TST_BASE_URL;
    else process.env.DOCGOV_TST_BASE_URL = originalTstEnv;
    if (originalTcuEnv === undefined) delete process.env.DOCGOV_TCU_BASE_URL;
    else process.env.DOCGOV_TCU_BASE_URL = originalTcuEnv;
    if (originalStfEnv === undefined) delete process.env.DOCGOV_STF_BASE_URL;
    else process.env.DOCGOV_STF_BASE_URL = originalStfEnv;
    if (originalStjEnv === undefined) delete process.env.DOCGOV_STJ_BASE_URL;
    else process.env.DOCGOV_STJ_BASE_URL = originalStjEnv;
    if (originalJurisEnv === undefined) delete process.env.DOCGOV_JURIS_BASE_URL;
    else process.env.DOCGOV_JURIS_BASE_URL = originalJurisEnv;
    if (originalCacheEnv === undefined) delete process.env.DOCGOV_JURIS_CACHE_DIR;
    else process.env.DOCGOV_JURIS_CACHE_DIR = originalCacheEnv;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
    defaultJurisdictionRegistry.resetAllCircuits();
  });

  it("TstProvider & Router: sem autoTriggerKeywords, roteamento explícito TST e reconhecimento CNJ", () => {
    const tst = defaultJurisdictionRegistry.get("TST");
    expect(tst).toBeDefined();
    expect(tst?.courtId).toBe("TST");
    expect(tst?.tier).toBe("FEDERAL");
    expect(tst?.defaultFederal).toBe(false);

    // Roteamento sem courts explícitas NÃO aciona TST/AGU automaticamente por keyword
    const routeDefault = defaultJurisdictionRegistry.resolveRouting(
      undefined,
      undefined,
      "fiscalização de terceirização súmula 331 orientação normativa agu"
    );
    expect(routeDefault.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF"]);

    // Roteamento explícito
    expect(defaultJurisdictionRegistry.resolveRouting(["TST"]).routingInfo.executed_courts).toEqual(["TST"]);
    expect(defaultJurisdictionRegistry.resolveRouting(["AGU"]).routingInfo.executed_courts).toEqual(["AGU"]);

    // Reconhecimento de padrão de ID do TST (CNJ J=5)
    expect(defaultJurisdictionRegistry.detectCourtFromRef("TST-RR-21474-45.2015.5.04.0202")).toBe("TST");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("AIRR - 100123-45.2020.5.02.0001")).toBe("TST");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("959-81.2015.5.05.0033")).toBe("TST");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("00009598120155050033")).toBe("TST");
    expect(parseCanonicalAcordaoRef("959-81.2015.5.05.0033").court).toBe("TST");

    const rawHitWithNulls = {
      id: "abc123",
      numFormatado: "RR - 0000697-62.2024.5.10.0006",
      temaProcs: [null, { desTemaProc: "Ente Público" }],
      indicadores: [null, { desIndicador: "Lei 13.467/2017" }],
    };
    const mapped = (tst as any).mapTstHitToResult(rawHitWithNulls);
    expect(mapped.indexacao).toContain("Ente Público");
    expect(mapped.ano).toBeUndefined();
  });

  it("Regressão STF: zero injeção bool.must licitatória, zero must_not bitributação e zero ano 2024 fabricado", async () => {
    process.env.DOCGOV_JURIS_CACHE_DIR = makeTempDir("docgov-stf-cache-");
    let capturedBody: any = null;
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        capturedBody = await req.json();
        return Response.json({
          result: {
            hits: {
              hits: [
                {
                  _source: {
                    id: "STF-RE-999",
                    processo_numero: "999",
                    ementa_texto: "Bitributação ICMS e ISS.",
                  },
                },
              ],
            },
          },
        });
      },
    });

    try {
      process.env.DOCGOV_STF_BASE_URL = `http://127.0.0.1:${server.port}`;
      const stf = defaultJurisdictionRegistry.get("STF")!;
      const res = await stf.searchWithDiagnostic!("ICMS ISS bitributação");

      expect(capturedBody?.query?.bool?.must).toEqual([
        { query_string: { query: "ICMS ISS bitributação" } },
      ]);
      expect(capturedBody?.query?.bool?.must_not).toBeUndefined();
      expect(res.hits[0]?.ano).toBeUndefined();
      expect(res.hits[0]?.entidade).toBe("NAO_INFORMADA");
    } finally {
      server.stop(true);
    }
  });

  it("AguProvider: aceita AGU-PARECER-V176-NEUTRO, suporta Mock Server e zero Art. 40 hardcoded no slicer", async () => {
    const cacheDir = makeTempDir("docgov-agu-cache-");
    process.env.DOCGOV_JURIS_CACHE_DIR = cacheDir;
    const caseDir = join(makeTempDir("docgov-agu-case-"), "cases", "agu_v176");

    expect(defaultJurisdictionRegistry.detectCourtFromRef("ON-AGU-050-2014")).toBe("AGU");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("SUMULA-AGU-072")).toBe("AGU");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("AGU-PARECER-V176-NEUTRO")).toBe("AGU");

    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/search") {
          return Response.json({
            items: [
              {
                id: "AGU-PARECER-V176-NEUTRO",
                numero: "V176",
                colegiado: "Advogado-Geral da União",
                tese: "Serviço contínuo e vigência contratual.",
                dispositivo: "Parecer consultivo.",
              },
            ],
          });
        }
        if (url.pathname.startsWith("/fetch")) {
          if (url.pathname.includes("999999")) {
            return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
          }
          return Response.json({
            id: "AGU-PARECER-V176-NEUTRO",
            numero: "V176",
            tese: "Serviço contínuo.",
            dispositivo: "Parecer consultivo.",
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    try {
      process.env.DOCGOV_JURIS_AGU_URL = `http://127.0.0.1:${server.port}`;
      const agu = defaultJurisdictionRegistry.get("AGU")!;
      const hits = await agu.search("serviço contínuo");
      expect(hits.length).toBe(1);
      expect(hits[0].ano).toBeUndefined();
      expect(hits[0].entidade).toBe("NAO_INFORMADA");

      const fetched = await fetchJuris({
        caseDir,
        acordaoIdOrUrl: "AGU-PARECER-V176-NEUTRO",
      });
      expect(fetched.court).toBe("AGU");
      expect(fetched.canonicalId).not.toContain("undefined");
      expect(fetched.slicedResult.layers.layer_1B_entity_regime.entidade).toBe("NAO_INFORMADA");
      expect(fetched.slicedResult.layers.layer_6A_closing_quorum.quorum).toBe(
        "Eficácia condicionada à esfera federal e ao regime de direito público (não presumida)"
      );
      expect(fetched.slicedResult.layers.layer_6A_closing_quorum.quorum).not.toContain("Art. 40");

      const fakeFetch = await agu.fetch("AGU-ON-999999");
      expect(fakeFetch).toBeNull();
      expect(() => assertAuthenticAcordao(false, "AGU-ON-999999", "AGU")).toThrow(
        /\[ANTI_HALLUCINATION_BLOCK\]/
      );

      const slicedOnly = sliceAcordaoAnatomically({ tese: "Teste AGU" }, { court: "AGU" });
      expect(slicedOnly.layers.layer_1A_metadata.ano).toBeUndefined();
    } finally {
      server.stop(true);
    }
  });

  it("TCU, STF e STJ — HTTP 503 sem cache quente retorna LIVE_FAILED / [LIVE_UNAVAILABLE] sem catálogo estático", async () => {
    process.env.DOCGOV_JURIS_CACHE_DIR = makeTempDir("docgov-fed-503-");
    const server503 = Bun.serve({
      port: 0,
      fetch() {
        return new Response("Service Unavailable", { status: 503 });
      },
    });

    try {
      process.env.DOCGOV_TCU_BASE_URL = `http://127.0.0.1:${server503.port}`;
      process.env.DOCGOV_STF_BASE_URL = `http://127.0.0.1:${server503.port}`;
      process.env.DOCGOV_STJ_BASE_URL = `http://127.0.0.1:${server503.port}`;

      const tcu = defaultJurisdictionRegistry.get("TCU")!;
      const stf = defaultJurisdictionRegistry.get("STF")!;
      const stj = defaultJurisdictionRegistry.get("STJ")!;

      for (const prov of [tcu, stf, stj]) {
        const res = await prov.searchWithDiagnostic!("parcelamento lote único");
        expect(res.diagnostic.status).toBe("error");
        expect(res.diagnostic.source_mode).toBe("LIVE_FAILED");
        expect(res.hits).toEqual([]);
        await expect(prov.fetch(`${prov.courtId}-999999`)).rejects.toThrow(/\[LIVE_UNAVAILABLE\]/);
      }
    } finally {
      server503.stop(true);
    }
  });
});
