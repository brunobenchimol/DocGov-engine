import { describe, it, expect } from "bun:test";
import { defaultJurisdictionRegistry } from "../../src/tools/juris/provider_registry.ts";
import { TceSpProvider } from "../../src/tools/juris/providers/tce_sp_provider.ts";
import {
  searchTceSpCatalog,
  normalizeTceSpId,
} from "../../src/tools/juris/providers/tce_sp_catalog.ts";
import { assertAuthenticAcordao, sliceAcordaoAnatomically } from "../../src/tools/juris/anatomical_slicer.ts";
import {
  searchJuris,
  formatSearchJurisSyntheticResult,
} from "../../src/tools/juris/search_juris.ts";
import {
  fetchJuris,
  formatFetchJurisSyntheticResult,
} from "../../src/tools/juris/index.ts";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Jurisprudência — Cortes de Contas Estaduais e Municipais (TCEs e TCMs)", () => {
  it("Jurisprudência v1.4.4 — TceSpProvider: deve integrar conector TCE-SP, catálogo curado, auto-trigger e Sub-Assert 29.9", async () => {
    const tcesp = new TceSpProvider();
    expect(tcesp.courtId).toBe("TCE-SP");
    expect(tcesp.tier).toBe("STATE");
    expect(tcesp.uf).toBe("SP");
    expect(tcesp.defaultFederal).toBe(false);

    // 1. Roteamento explícito por UF: "SP"
    const routingSp = defaultJurisdictionRegistry.resolveRouting(undefined, "SP");
    expect(routingSp.routingInfo.executed_courts).toContain("TCE-SP");
    expect(routingSp.routingInfo.unimplemented_uf_requested).toBeNull();
    expect(routingSp.routingInfo.supported_ufs).toContain("SP");

    // 2. Auto-Trigger Contextual Plug-and-Play (com higiene estrita anti-falso-positivo)
    const triggerSim = defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "súmula 50 do tce-sp");
    expect(triggerSim.routingInfo.executed_courts).toContain("TCE-SP");

    const triggerTcesp = defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "processo licitatório no tcesp");
    expect(triggerTcesp.routingInfo.executed_courts).toContain("TCE-SP");

    // Higiene: busca genérica por "súmula 20" sem mencionar SP NÃO deve acionar TCE-SP
    const triggerNao = defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "qualificação técnica súmula 20");
    expect(triggerNao.routingInfo.executed_courts).not.toContain("TCE-SP");

    // 3. Normalização canônica de identificadores e aliases
    expect(normalizeTceSpId("SÚMULA 50 DO TCE-SP")).toBe("SUMULA-TCESP-50");
    expect(normalizeTceSpId("TCE-SP-SUMULA-24")).toBe("SUMULA-TCESP-24");
    expect(normalizeTceSpId("SUMULA-TCESP-033")).toBe("SUMULA-TCESP-33");
    expect(normalizeTceSpId("TCE-SP-TC-000123-2024")).toBe("TCE-SP-TC-000123-2024");
    expect(normalizeTceSpId("TC-000123/026/24")).toBe("TCE-SP-TC-000123-2024");

    // 4. Busca no catálogo curado de alto valor
    const hits50 = searchTceSpCatalog("recuperação judicial");
    expect(hits50.some((h) => h.id === "SUMULA-TCESP-50")).toBe(true);

    const hits33 = searchTceSpCatalog("adesão carona registro de preços");
    expect(hits33.some((h) => h.id === "SUMULA-TCESP-33")).toBe(true);

    const hits24 = searchTceSpCatalog("parcelas maior relevância 50%");
    expect(hits24.some((h) => h.id === "SUMULA-TCESP-24")).toBe(true);

    // 5. Fetch determinístico no catálogo curado
    const fetched50 = await tcesp.fetch("SUMULA-TCESP-50");
    expect(fetched50).not.toBeNull();
    expect(fetched50?.exists).toBe(true);
    expect(fetched50?.rawTextOrJson.numero).toBe("50");
    expect(fetched50?.rawTextOrJson.entidade).toBe("ORGAO_CONTRATANTE");

    // Sub-Assert 29.9 (.NET Gen4 cross-check)
    const fetchedProc = await tcesp.fetch("TCE-SP-TC-000123-2024");
    expect(fetchedProc).not.toBeNull();
    expect(fetchedProc?.exists).toBe(true);
    expect(fetchedProc?.rawTextOrJson.numero).toBe("000123/026/24");

    // 6. Trava anti-alucinação estrita
    const invalidId = await tcesp.fetch("TCE-SP-999999");
    expect(invalidId?.exists).toBe(false);
    expect(() => assertAuthenticAcordao(false, "TCE-SP-999999", "TCE-SP")).toThrow(
      /\[ANTI_HALLUCINATION_BLOCK\]/
    );

    // 7. Fatiamento anatômico nas 6 Macro-Partes / 10 Sub-Camadas
    const sliced50 = sliceAcordaoAnatomically(fetched50!.rawTextOrJson, { court: "TCE-SP" });
    expect(sliced50.layers.layer_1A_metadata.tribunal).toBe("TCE-SP");
    expect(sliced50.layers.layer_1A_metadata.colegiado).toBe("Tribunal Pleno");
    expect(sliced50.layers.layer_1B_entity_regime.entidade).toBe("ORGAO_CONTRATANTE");
    expect(sliced50.layers.layer_5A_operative_commands.length).toBeGreaterThan(0);
    expect(sliced50.layers.layer_6A_closing_quorum.quorum).toBeDefined();
    expect(sliced50.layers.layer_6A_closing_quorum.data).toBe("2018-05-30");

    // 8. Teto Estrito MCP (< 900 bytes) tanto na busca quanto no fatiamento
    const testDir = join(tmpdir(), `tce_sp_test_${Date.now()}`);
    const searchRes = await searchJuris({
      caseDir: testDir,
      query: "recuperação judicial súmula 50 do tce-sp",
      courts: ["TCE-SP"],
      limit: 3,
      stance: "DEFENSE",
    });
    const synthSearch = formatSearchJurisSyntheticResult(searchRes.fileResult, searchRes.mdPath, testDir);
    const synthSearchBytes = Buffer.byteLength(JSON.stringify(synthSearch), "utf-8");
    expect(synthSearchBytes).toBeLessThan(900);

    const fetchRes = await fetchJuris({
      caseDir: testDir,
      acordaoIdOrUrl: "SUMULA-TCESP-50",
      court: "TCE-SP",
      stance: "DEFENSE",
    });
    const synthFetch = formatFetchJurisSyntheticResult(fetchRes, testDir);
    const synthFetchBytes = Buffer.byteLength(JSON.stringify(synthFetch), "utf-8");
    expect(synthFetchBytes).toBeLessThan(900);
  });
});
