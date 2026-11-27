import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultJurisdictionRegistry } from "../../src/tools/juris/provider_registry.ts";
import { TcmPaProvider } from "../../src/tools/juris/providers/tcm_pa_provider.ts";
import { normalizeTcmPaId } from "../../src/tools/juris/providers/tcm_pa_catalog.ts";
import { sliceAcordaoAnatomically } from "../../src/tools/juris/anatomical_slicer.ts";
import { searchJuris, formatSearchJurisSyntheticResult } from "../../src/tools/juris/search_juris.ts";
import { fetchJuris, formatFetchJurisSyntheticResult } from "../../src/tools/juris/index.ts";

describe("Jurisprudência v1.7.6 — Onda 3: Cortes de Contas Municipais (TCM-PA Corte Limpo)", () => {
  const dirs: string[] = [];
  const originalMockEnv = process.env.DOCGOV_JURIS_TCM_PA_URL;
  const originalCacheEnv = process.env.DOCGOV_JURIS_CACHE_DIR;

  function makeTempDir(prefix: string): string {
    const d = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(d);
    return d;
  }

  afterEach(() => {
    if (originalMockEnv === undefined) delete process.env.DOCGOV_JURIS_TCM_PA_URL;
    else process.env.DOCGOV_JURIS_TCM_PA_URL = originalMockEnv;
    if (originalCacheEnv === undefined) delete process.env.DOCGOV_JURIS_CACHE_DIR;
    else process.env.DOCGOV_JURIS_CACHE_DIR = originalCacheEnv;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
    defaultJurisdictionRegistry.resetAllCircuits();
  });

  it("Coexistência na UF PA (STATE/MUNICIPAL/ALL), zero autoTriggerKeywords e normalização pura TCM-PA", () => {
    const tcmpa = new TcmPaProvider();
    expect(tcmpa.courtId).toBe("TCM-PA");
    expect(tcmpa.tier).toBe("MUNICIPAL");
    expect(tcmpa.uf).toBe("PA");
    expect(tcmpa.defaultFederal).toBe(false);

    // Coexistência na UF "PA"
    expect(defaultJurisdictionRegistry.resolveRouting(undefined, "PA").routingInfo.executed_courts).toEqual([
      "TCU", "STJ", "STF", "TCE-PA",
    ]);
    expect(
      defaultJurisdictionRegistry.resolveRouting(undefined, "PA", "licitação", "MUNICIPAL").routingInfo.executed_courts
    ).toEqual(["TCU", "STJ", "STF", "TCM-PA"]);
    expect(
      defaultJurisdictionRegistry.resolveRouting(undefined, "PA", "licitação", "ALL").routingInfo.executed_courts
    ).toEqual(["TCU", "STJ", "STF", "TCE-PA", "TCM-PA"]);
    expect(defaultJurisdictionRegistry.resolveRouting(undefined, "TCM-PA").routingInfo.executed_courts).toContain("TCM-PA");
    expect(defaultJurisdictionRegistry.resolveRouting(["TCMPA"]).routingInfo.executed_courts).toEqual(["TCM-PA"]);

    // Zero autoTriggerKeywords sem courts/uf
    expect(
      defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "acórdão 45821/2024 do tcm-pa").routingInfo.executed_courts
    ).toEqual(["TCU", "STJ", "STF"]);

    // Normalização pura (inclusive numérico puro "45821" e canônico)
    expect(normalizeTcmPaId("45821")).toBe("TCM-PA-ACORDAO-45821");
    expect(normalizeTcmPaId("TCM-PA-ACORDAO-45821-2024")).toBe("TCM-PA-ACORDAO-45821-2024");
    expect(normalizeTcmPaId("TCM-PA-AC-45821-2024")).toBe("TCM-PA-ACORDAO-45821-2024");
    expect(normalizeTcmPaId("Acórdão nº 45.821/2024-TCM-PA-Pleno")).toBe("TCM-PA-ACORDAO-45821-2024");
    expect(normalizeTcmPaId("Resolução nº 16.995/2023 TCM-PA")).toBe("TCM-PA-RESOLUCAO-16995-2023");
    expect(normalizeTcmPaId("IN 02/2023 TCM-PA")).toBe("TCM-PA-IN-02-2023");
    expect(normalizeTcmPaId("Consulta 18/2024 TCM-PA")).toBe("TCM-PA-CONSULTA-18-2024");
    expect(normalizeTcmPaId("Súmula 1 do TCM-PA")).toBe("TCM-PA-SUMULA-1");

    expect(defaultJurisdictionRegistry.detectCourtFromRef("TCM-PA-AC-45821-2024")).toBe("TCM-PA");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("TCE-PA-1-2024")).toBe("TCE-PA");
  });

  it("Mock Server DOCGOV_JURIS_TCM_PA_URL: search, fetch, 404 anti-alucinação, TTL fallback e teto < 900B", async () => {
    process.env.DOCGOV_JURIS_CACHE_DIR = makeTempDir("docgov-tcmpa-cache-");
    const testDir = join(makeTempDir("docgov-tcmpa-case-"), "cases", "tcmpa_mock");
    let mode: "200" | "503" = "200";

    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/search") {
          if (mode === "503") return new Response("Unavailable", { status: 503 });
          return Response.json({
            items: [
              {
                id: "TCM-PA-ACORDAO-45821-2024",
                numero: "45821",
                ano: 2024,
                colegiado: "Tribunal Pleno",
                tese: "Adjudicação em lote único justificada no ETP.",
                dispositivo: "ACORDAM em julgar improcedente a representação.",
              },
            ],
          });
        }
        if (url.pathname === "/fetch") {
          const id = url.searchParams.get("id") || "";
          if (id.includes("999999") || id.toLowerCase().includes("fake")) {
            return new Response(JSON.stringify({ exists: false }), { status: 404 });
          }
          if (mode === "503") return new Response("Unavailable", { status: 503 });
          return Response.json({
            id: "TCM-PA-ACORDAO-45821-2024",
            tribunal: "TCM-PA",
            colegiado: "Tribunal Pleno",
            numero: "45821",
            ano: 2024,
            enunciado: "Lote único justificado no ETP.",
            dispositivo: "ACORDAM em julgar improcedente a representação.",
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    try {
      process.env.DOCGOV_JURIS_TCM_PA_URL = `http://127.0.0.1:${server.port}`;

      const searchRes = await searchJuris({
        caseDir: testDir,
        query: "lote unico tcm-pa",
        courts: ["TCM-PA"],
        stance: "DEFENSE",
      });
      expect(searchRes.fileResult.results[0]?.id).toBe("TCM-PA-ACORDAO-45821-2024");
      expect(searchRes.fileResult.results[0]?.entidade).toBe("NAO_INFORMADA");

      const synthSearch = formatSearchJurisSyntheticResult(searchRes.fileResult, searchRes.mdPath, testDir);
      expect(Buffer.byteLength(JSON.stringify(synthSearch), "utf-8")).toBeLessThan(900);

      const okFetch = await fetchJuris({
        caseDir: testDir,
        acordaoIdOrUrl: "TCM-PA-ACORDAO-45821-2024",
        court: "TCM-PA",
      });
      expect(okFetch.canonicalId).toContain("45821");
      const synthFetch = formatFetchJurisSyntheticResult(okFetch, testDir);
      expect(Buffer.byteLength(JSON.stringify(synthFetch), "utf-8")).toBeLessThan(900);

      const sliced = sliceAcordaoAnatomically(
        { tribunal: "TCM-PA", numero: "45821", tese: "Lote único" },
        { court: "TCM-PA" }
      );
      expect(sliced.layers.layer_1B_entity_regime.entidade).toBe("NAO_INFORMADA");
      expect(sliced.layers.layer_6A_closing_quorum.quorum).toBe("NAO_INFORMADO");

      // 503 com cache quente -> CACHE_TTL_FALLBACK
      mode = "503";
      const degRes = await searchJuris({
        caseDir: testDir,
        query: "lote unico tcm-pa",
        courts: ["TCM-PA"],
        stance: "DEFENSE",
      });
      expect(degRes.fileResult.court_diagnostics?.[0]?.source_mode).toBe("CACHE_TTL_FALLBACK");
      expect(degRes.fileResult.court_diagnostics?.[0]?.cache_hit).toBe(true);

      // 404 anti-alucinação
      await expect(
        fetchJuris({ caseDir: testDir, acordaoIdOrUrl: "TCM-PA-999999", court: "TCM-PA" })
      ).rejects.toThrow(/\[ANTI_HALLUCINATION_BLOCK\]/);
    } finally {
      server.stop(true);
    }
  });
});
