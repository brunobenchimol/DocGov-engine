import { describe, it, expect } from "bun:test";
import { defaultJurisdictionRegistry } from "../../src/tools/juris/provider_registry.ts";
import { TceSpProvider } from "../../src/tools/juris/providers/tce_sp_provider.ts";
import {
  searchTceSpCatalog,
  normalizeTceSpId,
} from "../../src/tools/juris/providers/tce_sp_catalog.ts";
import { TceMgProvider } from "../../src/tools/juris/providers/tce_mg_provider.ts";
import {
  searchTceMgCatalog,
  normalizeTceMgId,
} from "../../src/tools/juris/providers/tce_mg_catalog.ts";
import { TcePrProvider } from "../../src/tools/juris/providers/tce_pr_provider.ts";
import {
  searchTcePrCatalog,
  normalizeTcePrId,
} from "../../src/tools/juris/providers/tce_pr_catalog.ts";
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

  it("Jurisprudência v1.4.5 — TceMgProvider: deve integrar conector TCE-MG, catálogo curado, auto-trigger e Sub-Assert 29.10", async () => {
    const tcemg = new TceMgProvider();
    expect(tcemg.courtId).toBe("TCE-MG");
    expect(tcemg.tier).toBe("STATE");
    expect(tcemg.uf).toBe("MG");
    expect(tcemg.defaultFederal).toBe(false);
    expect(tcemg.envOverrideKey).toBe("DOCGOV_JURIS_TCEMG_URL");

    // 1. Roteamento explícito por UF: "MG"
    const routingMg = defaultJurisdictionRegistry.resolveRouting(undefined, "MG");
    expect(routingMg.routingInfo.executed_courts).toContain("TCE-MG");
    expect(routingMg.routingInfo.unimplemented_uf_requested).toBeNull();
    expect(routingMg.routingInfo.supported_ufs).toContain("MG");

    // 2. Auto-Trigger Contextual Plug-and-Play (com higiene estrita anti-falso-positivo)
    const triggerSumula = defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "súmula 114 do tce-mg");
    expect(triggerSumula.routingInfo.executed_courts).toContain("TCE-MG");

    const triggerTcemg = defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "contratação na cemig pelo tcemg");
    expect(triggerTcemg.routingInfo.executed_courts).toContain("TCE-MG");

    const triggerDecreto = defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "decreto estadual 48.723 em minas gerais");
    expect(triggerDecreto.routingInfo.executed_courts).toContain("TCE-MG");

    // Higiene: busca genérica por "súmula 114" sem mencionar MG NÃO deve acionar TCE-MG
    const triggerGenerico = defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "parcelamento do objeto súmula 114");
    expect(triggerGenerico.routingInfo.executed_courts).not.toContain("TCE-MG");

    // 3. Normalização canônica de identificadores e aliases (incluindo Assert 29.10 do .NET)
    expect(normalizeTceMgId("SÚMULA 114 DO TCE-MG")).toBe("SUMULA-TCEMG-114");
    expect(normalizeTceMgId("TCE-MG-SUMULA-126")).toBe("SUMULA-TCEMG-126");
    expect(normalizeTceMgId("CONSULTA 1160667 TCE-MG")).toBe("CONSULTA-TCEMG-1160667");
    expect(normalizeTceMgId("TCE-MG-CONSULTA-123456")).toBe("TCE-MG-CONSULTA-123456");
    expect(normalizeTceMgId("TCE-MG-999999")).toBe("TCE-MG-999999");

    // 4. Busca no catálogo curado de alto valor (Súmulas e Consultas com Força Normativa)
    const hits114 = searchTceMgCatalog("parcelamento do objeto divisível");
    expect(hits114.some((h) => h.id === "SUMULA-TCEMG-114")).toBe(true);

    const hits126 = searchTceMgCatalog("manutenção frota quarteirização rede credenciada");
    expect(hits126.some((h) => h.id === "SUMULA-TCEMG-126")).toBe(true);

    const hitsCarona = searchTceMgCatalog("adesão carona registro de preços");
    expect(hitsCarona.some((h) => h.id === "CONSULTA-TCEMG-1160667")).toBe(true);

    const hitsTaxaCarona = searchTceMgCatalog("taxa de adesão tarifas administrativas consórcio");
    expect(hitsTaxaCarona.some((h) => h.id === "CONSULTA-TCEMG-1177447")).toBe(true);

    const hitsQualif = searchTceMgCatalog("qualificação técnica atestados 50%");
    expect(hitsQualif.some((h) => h.id === "CONSULTA-TCEMG-1092348")).toBe(true);

    const hitsTic = searchTceMgCatalog("tecnologia da informação ans sla");
    expect(hitsTic.some((h) => h.id === "CONSULTA-TCEMG-1007492")).toBe(true);

    // 5. Fetch determinístico no catálogo curado
    const fetched114 = await tcemg.fetch("SUMULA-TCEMG-114");
    expect(fetched114).not.toBeNull();
    expect(fetched114?.exists).toBe(true);
    expect(fetched114?.rawTextOrJson.numero).toBe("114");
    expect(fetched114?.rawTextOrJson.entidade).toBe("ORGAO_CONTRATANTE");

    const fetchedCons = await tcemg.fetch("CONSULTA-TCEMG-1160667");
    expect(fetchedCons).not.toBeNull();
    expect(fetchedCons?.exists).toBe(true);
    expect(fetchedCons?.rawTextOrJson.numero).toBe("1160667");
    expect(fetchedCons?.rawTextOrJson.entidade).toBe("ORGAO_CONTRATANTE");

    // 6. Trava anti-alucinação estrita
    const invalidId = await tcemg.fetch("TCE-MG-999999");
    expect(invalidId?.exists).toBe(false);
    expect(() => assertAuthenticAcordao(false, "TCE-MG-999999", "TCE-MG")).toThrow(
      /\[ANTI_HALLUCINATION_BLOCK\]/
    );

    // 7. Fatiamento anatômico nas 6 Macro-Partes / 10 Sub-Camadas
    const sliced114 = sliceAcordaoAnatomically(fetched114!.rawTextOrJson, { court: "TCE-MG" });
    expect(sliced114.layers.layer_1A_metadata.tribunal).toBe("TCE-MG");
    expect(sliced114.layers.layer_1A_metadata.colegiado).toBe("Tribunal Pleno");
    expect(sliced114.layers.layer_1B_entity_regime.entidade).toBe("ORGAO_CONTRATANTE");
    expect(sliced114.layers.layer_5A_operative_commands.length).toBeGreaterThan(0);
    expect(sliced114.layers.layer_6A_closing_quorum.quorum).toBeDefined();

    // 8. Teto Estrito MCP (< 900 bytes) tanto na busca quanto no fatiamento
    const testDir = join(tmpdir(), `tce_mg_test_${Date.now()}`);
    const searchRes = await searchJuris({
      caseDir: testDir,
      query: "parcelamento do objeto súmula 114 do tce-mg",
      courts: ["TCE-MG"],
      limit: 3,
      stance: "DEFENSE",
    });
    const synthSearch = formatSearchJurisSyntheticResult(searchRes.fileResult, searchRes.mdPath, testDir);
    const synthSearchBytes = Buffer.byteLength(JSON.stringify(synthSearch), "utf-8");
    expect(synthSearchBytes).toBeLessThan(900);

    const fetchRes = await fetchJuris({
      caseDir: testDir,
      acordaoIdOrUrl: "SUMULA-TCEMG-114",
      court: "TCE-MG",
      stance: "DEFENSE",
    });
    const synthFetch = formatFetchJurisSyntheticResult(fetchRes, testDir);
    const synthFetchBytes = Buffer.byteLength(JSON.stringify(synthFetch), "utf-8");
    expect(synthFetchBytes).toBeLessThan(900);
  }, 15000);

  it("Jurisprudência v1.4.6 — TcePrProvider: deve integrar conector TCE-PR, catálogo curado, auto-trigger e Sub-Assert 29.11", async () => {
    const tcepr = new TcePrProvider();
    expect(tcepr.courtId).toBe("TCE-PR");
    expect(tcepr.tier).toBe("STATE");
    expect(tcepr.uf).toBe("PR");
    expect(tcepr.defaultFederal).toBe(false);
    expect(tcepr.envOverrideKey).toBe("DOCGOV_JURIS_TCE_PR_URL");

    // 1. Roteamento explícito por UF: "PR"
    const routingPr = defaultJurisdictionRegistry.resolveRouting(undefined, "PR");
    expect(routingPr.routingInfo.executed_courts).toContain("TCE-PR");
    expect(routingPr.routingInfo.unimplemented_uf_requested).toBeNull();
    expect(routingPr.routingInfo.supported_ufs).toContain("PR");

    // 2. Auto-Trigger Contextual Plug-and-Play (com higiene estrita anti-falso-positivo)
    const triggerPrej = defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "prejulgado 28 do tce-pr");
    expect(triggerPrej.routingInfo.executed_courts).toContain("TCE-PR");

    const triggerViajuris = defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "pesquisa no viajuris");
    expect(triggerViajuris.routingInfo.executed_courts).toContain("TCE-PR");

    const triggerCelepar = defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "contrato na celepar");
    expect(triggerCelepar.routingInfo.executed_courts).toContain("TCE-PR");

    // Higiene: termo isolado 'parana' ou busca genérica NÃO deve acionar TCE-PR
    const triggerGenerico = defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "parcelamento lote unico");
    expect(triggerGenerico.routingInfo.executed_courts).not.toContain("TCE-PR");

    const triggerParanaIsolado = defaultJurisdictionRegistry.resolveRouting(undefined, undefined, "comarca no estado do parana");
    expect(triggerParanaIsolado.routingInfo.executed_courts).not.toContain("TCE-PR");

    // 3. Normalização canônica de identificadores e aliases (incluindo Sub-Assert 29.11 do .NET)
    expect(normalizeTcePrId("Prejulgado nº 28-TCE-PR-Pleno")).toBe("TCE-PR-PREJULGADO-28");
    expect(normalizeTcePrId("PREJULGADO-TCEPR-28")).toBe("TCE-PR-PREJULGADO-28");
    expect(normalizeTcePrId("PREJULGADO 25 DO TCE-PR")).toBe("PREJULGADO-TCEPR-25");
    expect(normalizeTcePrId("SÚMULA 5 DO TCE-PR")).toBe("SUMULA-TCEPR-5");
    expect(normalizeTcePrId("TCE-PR-SUMULA-8")).toBe("SUMULA-TCEPR-8");
    expect(normalizeTcePrId("CONSULTA 2804/2024 TCE-PR")).toBe("TCE-PR-CONSULTA-2804-2024");
    expect(normalizeTcePrId("ACÓRDÃO 2804/2026")).toBe("TCE-PR-ACORDAO-2804-2026");

    // 4. Busca no catálogo curado de alto valor (Prejulgados e Súmulas com Força Normativa)
    const hits28 = searchTcePrCatalog("parcelamento lote unico software");
    expect(hits28.some((h) => h.id === "TCE-PR-PREJULGADO-28")).toBe(true);

    const hits25 = searchTcePrCatalog("qualificação econômico-financeira patrimônio líquido 10%");
    expect(hits25.some((h) => h.id === "PREJULGADO-TCEPR-25")).toBe(true);

    const hits6 = searchTcePrCatalog("terceirização serviços contínuos mão de obra");
    expect(hits6.some((h) => h.id === "PREJULGADO-TCEPR-6")).toBe(true);

    const hits26 = searchTcePrCatalog("inexigibilidade serviços jurídicos contábeis");
    expect(hits26.some((h) => h.id === "PREJULGADO-TCEPR-26")).toBe(true);

    const hits11 = searchTcePrCatalog("pagamento antecipado garantia contratual");
    expect(hits11.some((h) => h.id === "PREJULGADO-TCEPR-11")).toBe(true);

    const hitsSum5 = searchTcePrCatalog("taxa de administração negativa taxa zero");
    expect(hitsSum5.some((h) => h.id === "SUMULA-TCEPR-5")).toBe(true);

    const hitsSum8 = searchTcePrCatalog("regularidade fiscal trabalhista habilitação");
    expect(hitsSum8.some((h) => h.id === "SUMULA-TCEPR-8")).toBe(true);

    const hitsCarona = searchTcePrCatalog("adesão carona registro de preços 50% 200%");
    expect(hitsCarona.some((h) => h.id === "TCE-PR-CONSULTA-3154-2023")).toBe(true);

    // 5. Fetch determinístico no catálogo curado (Lockstep Sub-Assert 29.11)
    const fetched28 = await tcepr.fetch("TCE-PR-PREJULGADO-28");
    expect(fetched28).not.toBeNull();
    expect(fetched28?.exists).toBe(true);
    expect(fetched28?.rawTextOrJson.numero).toBe("28");
    expect(fetched28?.rawTextOrJson.entidade).toBe("ORGAO_CONTRATANTE");

    const fetchedAlias28 = await tcepr.fetch("Prejulgado nº 28-TCE-PR-Pleno");
    expect(fetchedAlias28).not.toBeNull();
    expect(fetchedAlias28?.exists).toBe(true);
    expect(fetchedAlias28?.rawTextOrJson.numero).toBe("28");

    const fetched25 = await tcepr.fetch("PREJULGADO-TCEPR-25");
    expect(fetched25).not.toBeNull();
    expect(fetched25?.exists).toBe(true);
    expect(fetched25?.rawTextOrJson.numero).toBe("25");

    // 6. Trava anti-alucinação estrita
    const invalidId = await tcepr.fetch("TCE-PR-999999");
    expect(invalidId?.exists).toBe(false);
    expect(() => assertAuthenticAcordao(false, "TCE-PR-999999", "TCE-PR")).toThrow(
      /\[ANTI_HALLUCINATION_BLOCK\]/
    );

    // 7. Fatiamento anatômico nas 6 Macro-Partes / 10 Sub-Camadas
    const sliced28 = sliceAcordaoAnatomically(fetched28!.rawTextOrJson, { court: "TCE-PR" });
    expect(sliced28.layers.layer_1A_metadata.tribunal).toBe("TCE-PR");
    expect(sliced28.layers.layer_1A_metadata.colegiado).toBe("Tribunal Pleno");
    expect(sliced28.layers.layer_1B_entity_regime.entidade).toBe("ORGAO_CONTRATANTE");
    expect(sliced28.layers.layer_5A_operative_commands.length).toBeGreaterThan(0);
    expect(sliced28.layers.layer_6A_closing_quorum.quorum).toBeDefined();

    // 8. Teto Estrito MCP (< 900 bytes) tanto na busca quanto no fatiamento
    const testDir = join(tmpdir(), `tce_pr_test_${Date.now()}`);
    const searchRes = await searchJuris({
      caseDir: testDir,
      query: "parcelamento lote unico software prejulgado tce-pr",
      courts: ["TCE-PR"],
      limit: 3,
      stance: "DEFENSE",
    });
    const synthSearch = formatSearchJurisSyntheticResult(searchRes.fileResult, searchRes.mdPath, testDir);
    const synthSearchBytes = Buffer.byteLength(JSON.stringify(synthSearch), "utf-8");
    expect(synthSearchBytes).toBeLessThan(900);

    // Verifica que Prejulgado 28 pontua com alto score e stance favorável em defesa
    expect(searchRes.fileResult.results.some((r) => r.id === "TCE-PR-PREJULGADO-28")).toBe(true);
    const item28Result = searchRes.fileResult.results.find((r) => r.id === "TCE-PR-PREJULGADO-28");
    expect(item28Result?.stance_alignment).toBe("FAVORABLE");

    const fetchRes = await fetchJuris({
      caseDir: testDir,
      acordaoIdOrUrl: "TCE-PR-PREJULGADO-28",
      court: "TCE-PR",
      stance: "DEFENSE",
    });
    const synthFetch = formatFetchJurisSyntheticResult(fetchRes, testDir);
    const synthFetchBytes = Buffer.byteLength(JSON.stringify(synthFetch), "utf-8");
    expect(synthFetchBytes).toBeLessThan(900);
  }, 15000);
});
