import { describe, it, expect, afterEach } from "bun:test";
import { join } from "node:path";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { defaultJurisdictionRegistry } from "../../src/tools/juris/provider_registry.ts";
import { TcmPaProvider } from "../../src/tools/juris/providers/tcm_pa_provider.ts";
import {
  searchTcmPaCatalog,
  normalizeTcmPaId,
} from "../../src/tools/juris/providers/tcm_pa_catalog.ts";
import {
  assertAuthenticAcordao,
  sliceAcordaoAnatomically,
} from "../../src/tools/juris/anatomical_slicer.ts";
import {
  searchJuris,
  formatSearchJurisSyntheticResult,
} from "../../src/tools/juris/search_juris.ts";
import {
  fetchJuris,
  formatFetchJurisSyntheticResult,
} from "../../src/tools/juris/index.ts";

describe("Jurisprudência — Onda 3: Cortes de Contas Municipais (TCMs)", () => {
  const originalMockEnv = process.env.DOCGOV_JURIS_TCM_PA_URL;

  afterEach(() => {
    if (originalMockEnv === undefined) {
      delete process.env.DOCGOV_JURIS_TCM_PA_URL;
    } else {
      process.env.DOCGOV_JURIS_TCM_PA_URL = originalMockEnv;
    }
  });

  it("v1.6.8 — TcmPaProvider: deve integrar conector TCM-PA, coexistir com TCE-PA na UF PA, normalizar IDs e respeitar teto MCP", async () => {
    const tcmpa = new TcmPaProvider();
    expect(tcmpa.courtId).toBe("TCM-PA");
    expect(tcmpa.tier).toBe("MUNICIPAL");
    expect(tcmpa.uf).toBe("PA");
    expect(tcmpa.defaultFederal).toBe(false);
    expect(tcmpa.envOverrideKey).toBe("DOCGOV_JURIS_TCM_PA_URL");

    // 1. Coexistência retrocompatível na UF "PA" (default STATE -> TCE-PA; supported_ufs deduplicado)
    const routingDefaultPa = defaultJurisdictionRegistry.resolveRouting(undefined, "PA");
    expect(routingDefaultPa.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF", "TCE-PA"]);
    expect(routingDefaultPa.routingInfo.unimplemented_uf_requested).toBeNull();
    expect(routingDefaultPa.routingInfo.supported_ufs).toEqual(["PA", "CE", "DF", "SP", "MG", "PR"]);

    // 2. Coexistência por sphere ("MUNICIPAL" e "ALL") e atalho direto por UF ("TCM-PA")
    const routingMunicipalPa = defaultJurisdictionRegistry.resolveRouting(
      undefined,
      "PA",
      "licitação municipal",
      "MUNICIPAL"
    );
    expect(routingMunicipalPa.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF", "TCM-PA"]);

    const routingAllPa = defaultJurisdictionRegistry.resolveRouting(
      undefined,
      "PA",
      "licitação",
      "ALL"
    );
    expect(routingAllPa.routingInfo.executed_courts).toEqual([
      "TCU",
      "STJ",
      "STF",
      "TCE-PA",
      "TCM-PA",
    ]);

    const routingShortcut = defaultJurisdictionRegistry.resolveRouting(undefined, "TCM-PA");
    expect(routingShortcut.routingInfo.executed_courts).toContain("TCM-PA");
    expect(routingShortcut.routingInfo.unimplemented_uf_requested).toBeNull();
    expect(routingShortcut.routingInfo.fallback_notice).toBeNull();

    const routingExplicit = defaultJurisdictionRegistry.resolveRouting(["TCMPA"]);
    expect(routingExplicit.routingInfo.executed_courts).toEqual(["TCM-PA"]);

    // 3. Auto-trigger com isolamento cirúrgico (zero colisão com TCE-PA nem falsos positivos por "pará")
    const triggerTcmPa = defaultJurisdictionRegistry.resolveRouting(
      undefined,
      undefined,
      "resolução 16995 do tcm-pa sobre mural de licitações"
    );
    expect(triggerTcmPa.routingInfo.executed_courts).toContain("TCM-PA");
    expect(triggerTcmPa.routingInfo.executed_courts).not.toContain("TCE-PA");

    const triggerUfPlusQuery = defaultJurisdictionRegistry.resolveRouting(
      undefined,
      "PA",
      "acórdão 42110/2024 do tcmpa"
    );
    expect(triggerUfPlusQuery.routingInfo.executed_courts).toContain("TCE-PA");
    expect(triggerUfPlusQuery.routingInfo.executed_courts).toContain("TCM-PA");

    const triggerParaIsolado = defaultJurisdictionRegistry.resolveRouting(
      undefined,
      undefined,
      "prefeitura no estado do pará pa licitação"
    );
    expect(triggerParaIsolado.routingInfo.executed_courts).not.toContain("TCM-PA");
    expect(triggerParaIsolado.routingInfo.executed_courts).not.toContain("TCE-PA");

    // 4. Normalização bidirecional de IDs e detecção de corte
    expect(normalizeTcmPaId("TCM-PA-ACORDAO-42110-2024")).toBe("TCM-PA-ACORDAO-42110-2024");
    expect(normalizeTcmPaId("TCM-PA-AC-42110-2024")).toBe("TCM-PA-ACORDAO-42110-2024");
    expect(normalizeTcmPaId("Acórdão nº 42.110/2024-TCM-PA-Pleno")).toBe(
      "TCM-PA-ACORDAO-42110-2024"
    );
    expect(normalizeTcmPaId("Resolução nº 16.995/2023 TCM-PA")).toBe(
      "TCM-PA-RESOLUCAO-16995-2023"
    );
    expect(normalizeTcmPaId("IN 02/2023 TCM-PA")).toBe("TCM-PA-IN-02-2023");
    expect(normalizeTcmPaId("Consulta 18/2024 TCM-PA")).toBe("TCM-PA-CONSULTA-18-2024");
    expect(normalizeTcmPaId("Súmula 1 do TCM-PA")).toBe("TCM-PA-SUMULA-1");

    expect(defaultJurisdictionRegistry.detectCourtFromRef("TCM-PA-AC-42110-2024")).toBe("TCM-PA");
    expect(
      defaultJurisdictionRegistry.detectCourtFromRef("Acórdão nº 42.110/2024-TCM-PA-Pleno")
    ).toBe("TCM-PA");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("TCE-PA-1-2024")).toBe("TCE-PA");

    // 5. Busca no catálogo curado e fetch determinístico do Precedente Canônico Principal (.NET)
    const catHits = searchTcmPaCatalog("lote único software gestão municipal");
    expect(catHits.some((h) => h.id === "TCM-PA-ACORDAO-42110-2024")).toBe(true);

    const fetched42110 = await tcmpa.fetch("TCM-PA-ACORDAO-42110-2024");
    expect(fetched42110?.exists).toBe(true);
    expect(fetched42110?.rawTextOrJson.numero).toBe("42110");
    expect(fetched42110?.rawTextOrJson.entidade).toBe("ORGAO_CONTRATANTE");

    const fetchedAlias = await tcmpa.fetch("TCM-PA-AC-42110-2024");
    expect(fetchedAlias?.exists).toBe(true);
    expect(fetchedAlias?.id).toBe("TCM-PA-ACORDAO-42110-2024");

    // 6. Trava anti-alucinação estrita
    const invalidOffline = await tcmpa.fetch("TCM-PA-999999");
    expect(invalidOffline?.exists).toBe(false);
    expect(() => assertAuthenticAcordao(false, "TCM-PA-999999", "TCM-PA")).toThrow(
      /\[ANTI_HALLUCINATION_BLOCK\]/
    );

    // 7. Fatiamento anatômico em 6 Macro-Partes / 10 Sub-Camadas
    const sliced = sliceAcordaoAnatomically(fetched42110!.rawTextOrJson, { court: "TCM-PA" });
    expect(sliced.layers.layer_1A_metadata.tribunal).toBe("TCM-PA");
    expect(sliced.layers.layer_1A_metadata.colegiado).toBe("Tribunal Pleno");
    expect(sliced.layers.layer_1B_entity_regime.entidade).toBe("ORGAO_CONTRATANTE");
    expect(sliced.layers.layer_3A_factual_controversy.length).toBeGreaterThan(10);
    expect(sliced.layers.layer_3B_defense_arguments.length).toBeGreaterThan(10);
    expect(sliced.layers.layer_3C_technical_unit_analysis.length).toBeGreaterThan(10);
    expect(sliced.layers.layer_4A_ratio_decidendi.length).toBeGreaterThan(10);
    expect(sliced.layers.layer_5A_operative_commands.length).toBeGreaterThan(0);
    expect(sliced.layers.layer_6A_closing_quorum.data).toBe("2024-08-14");

    // 8. Rankeamento, stance_alignment FAVORABLE e teto MCP (< 900 bytes)
    const testDir = join(tmpdir(), `docgov_test_tcm_pa_${Date.now()}`);
    try {
      const searchRes = await searchJuris({
        caseDir: testDir,
        query: "acórdão 42110 lote único software gestão municipal tcm-pa",
        courts: ["TCM-PA"],
        limit: 3,
        stance: "DEFENSE",
      });
      const synthSearch = formatSearchJurisSyntheticResult(
        searchRes.fileResult,
        searchRes.mdPath,
        testDir
      );
      expect(Buffer.byteLength(JSON.stringify(synthSearch), "utf-8")).toBeLessThan(900);
      const mainHit = searchRes.fileResult.results.find(
        (r) => r.id === "TCM-PA-ACORDAO-42110-2024"
      );
      expect(mainHit).toBeDefined();
      expect(mainHit?.stance_alignment).toBe("FAVORABLE");

      const fetchRes = await fetchJuris({
        caseDir: testDir,
        acordaoIdOrUrl: "TCM-PA-AC-42110-2024",
        court: "TCM-PA",
        stance: "DEFENSE",
      });
      const synthFetch = formatFetchJurisSyntheticResult(fetchRes, testDir);
      expect(Buffer.byteLength(JSON.stringify(synthFetch), "utf-8")).toBeLessThan(900);
    } finally {
      if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    }
  }, 15000);

  it("v1.6.8 — TcmPaProvider (Mock Server DOCGOV_JURIS_TCM_PA_URL): deve suportar /search, /fetch e HTTP 404 anti-alucinação", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/search") {
          return Response.json({
            items: [
              {
                id: "TCM-PA-ACORDAO-42110-2024",
                numero: "42110",
                ano: 2024,
                colegiado: "Tribunal Pleno",
                entidade: "ORGAO_CONTRATANTE",
                tese: "Adjudicação em lote único para plataforma integrada municipal.",
                dispositivo: "ACORDAM em julgar improcedente a representação.",
              },
            ],
          });
        }
        if (url.pathname === "/fetch") {
          const id = url.searchParams.get("id") || "";
          if (id === "999999" || id.includes("999999") || id.toLowerCase().includes("fake")) {
            return new Response(JSON.stringify({ exists: false }), { status: 404 });
          }
          return Response.json({
            id: "TCM-PA-ACORDAO-42110-2024",
            tribunal: "TCM-PA",
            colegiado: "Tribunal Pleno",
            numero: "42110",
            ano: 2024,
            entidade: "ORGAO_CONTRATANTE",
            enunciado: "Lote único justificado no ETP.",
            dispositivo: "ACORDAM em julgar improcedente a representação.",
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    const testDir = join(tmpdir(), `docgov_test_tcm_pa_mock_${Date.now()}`);
    try {
      process.env.DOCGOV_JURIS_TCM_PA_URL = `http://127.0.0.1:${server.port}`;

      const searchRes = await searchJuris({
        caseDir: testDir,
        query: "lote unico tcm-pa",
        courts: ["TCM-PA"],
        stance: "DEFENSE",
      });
      expect(searchRes.fileResult.results[0]?.id).toBe("TCM-PA-ACORDAO-42110-2024");

      const okFetch = await fetchJuris({
        caseDir: testDir,
        acordaoIdOrUrl: "TCM-PA-ACORDAO-42110-2024",
        court: "TCM-PA",
      });
      expect(okFetch.canonicalId).toContain("42110");

      await expect(
        fetchJuris({
          caseDir: testDir,
          acordaoIdOrUrl: "TCM-PA-999999",
          court: "TCM-PA",
        })
      ).rejects.toThrow(/\[ANTI_HALLUCINATION_BLOCK\]/);

      await expect(
        fetchJuris({
          caseDir: testDir,
          acordaoIdOrUrl: "TCM-PA-fake-id",
          court: "TCM-PA",
        })
      ).rejects.toThrow(/\[ANTI_HALLUCINATION_BLOCK\]/);
    } finally {
      server.stop(true);
      if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    }
  });
});
