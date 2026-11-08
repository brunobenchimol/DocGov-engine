import { describe, it, expect } from "bun:test";
import {
  defaultJurisdictionRegistry,
  JurisdictionProviderRegistry,
} from "../../src/tools/juris/provider_registry.ts";
import {
  searchJuris,
  formatSearchJurisSyntheticResult,
} from "../../src/tools/juris/search_juris.ts";
import {
  fetchJuris,
  formatFetchJurisSyntheticResult,
} from "../../src/tools/juris/index.ts";
import { parseCanonicalAcordaoRef } from "../../src/tools/juris/providers/http_client.ts";
import type { JurisdictionProvider } from "../../src/tools/juris/types.ts";

describe("Jurisprudência v1.4.0 — Roteamento Jurisdicional e Graceful Fallback", () => {
  it("deve selecionar a camada federal completa (TCU, STJ, STF) quando courts e uf forem omitidos", () => {
    const { selectedProviders, routingInfo } = defaultJurisdictionRegistry.resolveRouting();
    expect(routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF"]);
    expect(routingInfo.unimplemented_uf_requested).toBeNull();
    expect(routingInfo.fallback_notice).toBeNull();
    expect(routingInfo.supported_ufs).toEqual(["PA", "CE", "DF", "SP", "MG", "PR"]);
    expect(selectedProviders.map((p) => p.courtId)).toEqual(["TCU", "STJ", "STF"]);
  });

  it("deve incluir o TCE respectivo para UFs implementadas (PA, CE, DF, SP, MG, PR)", () => {
    const resPa = defaultJurisdictionRegistry.resolveRouting(undefined, "PA");
    expect(resPa.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF", "TCE-PA"]);
    expect(resPa.routingInfo.unimplemented_uf_requested).toBeNull();

    const resCe = defaultJurisdictionRegistry.resolveRouting(undefined, "CE");
    expect(resCe.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF", "TCE-CE"]);

    const resDf = defaultJurisdictionRegistry.resolveRouting(undefined, "DF");
    expect(resDf.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF", "TCDF"]);

    const resSp = defaultJurisdictionRegistry.resolveRouting(undefined, "SP");
    expect(resSp.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF", "TCE-SP"]);

    const resMg = defaultJurisdictionRegistry.resolveRouting(undefined, "MG");
    expect(resMg.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF", "TCE-MG"]);

    const resPr = defaultJurisdictionRegistry.resolveRouting(undefined, "PR");
    expect(resPr.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF", "TCE-PR"]);
  });

  it("deve aplicar Graceful Fallback sem falhar quando solicitada UF não implementada (ex: AM, RJ)", () => {
    const resAm = defaultJurisdictionRegistry.resolveRouting(undefined, "AM");
    expect(resAm.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF"]);
    expect(resAm.routingInfo.unimplemented_uf_requested).toBe("AM");
    expect(resAm.routingInfo.fallback_notice).toContain("Conector estadual para UF 'AM' ainda não implementado");
    expect(resAm.routingInfo.fallback_notice).toContain("Graceful Fallback");
    expect(resAm.routingInfo.supported_ufs).toEqual(["PA", "CE", "DF", "SP", "MG", "PR"]);
  });

  it("deve respeitar courts explícitos informados pelo usuário", () => {
    const res = defaultJurisdictionRegistry.resolveRouting(["TCU", "TCE-PA"]);
    expect(res.routingInfo.executed_courts).toEqual(["TCU", "TCE-PA"]);
    expect(res.routingInfo.unimplemented_uf_requested).toBeNull();
  });

  it("Plug-and-Play: deve expandir UFs suportadas e roteamento dinamicamente ao registrar novo conector", () => {
    const customRegistry = new JurisdictionProviderRegistry();
    const mockTceSp: JurisdictionProvider = {
      courtId: "TCE-SP",
      tier: "STATE",
      uf: "SP",
      idPatterns: [/\bTCE[-_\s]?SP\b/i],
      async search() {
        return [];
      },
      async fetch() {
        return null;
      },
    };

    customRegistry.register(mockTceSp);

    // 1. supported_ufs agora inclui SP
    expect(customRegistry.getSupportedUfs()).toContain("SP");
    expect(customRegistry.getProviderByUf("SP")?.courtId).toBe("TCE-SP");

    // 2. Roteamento automático para SP sem graceful fallback
    const resSp = customRegistry.resolveRouting(undefined, "SP");
    expect(resSp.routingInfo.executed_courts).toContain("TCE-SP");
    expect(resSp.routingInfo.unimplemented_uf_requested).toBeNull();

    // 3. Detecção automática de corte por idPatterns / regex
    expect(customRegistry.detectCourtFromRef("Acórdão 456/2024-TCE-SP")).toBe("TCE-SP");
    expect(parseCanonicalAcordaoRef("Acórdão 789/2024-TCE-MG").court).toBe("TCE-MG");
  });
});

describe("Jurisprudência v1.4.0 — search_juris e fetch_juris (Teto < 900 bytes e Contratos Gen4)", () => {
  it("searchJuris deve executar busca multi-query, gerar arquivos e expor statutory_bridge_applied + normative_bridge", async () => {
    // Registra mock temporário para testar searchJuris determinístico
    const mockTcu: JurisdictionProvider = {
      courtId: "TCU",
      async search(query: string) {
        return [
          {
            id: "ACORDAO-TCU-555-2024",
            court: "TCU",
            colegiado: "Plenário",
            numero: "555",
            ano: 2024,
            entidade: "SERPRO",
            indexacao: "LICITAÇÃO. TI. LOTE ÚNICO. ADJUDICAÇÃO GLOBAL.",
            tese: "É regular a adjudicação por preço global de solução de TI em lote único indivisível.",
            dispositivo: "ACORDAM em julgar improcedente a representação.",
          },
        ];
      },
      async fetch(id: string) {
        return null;
      },
    };

    const customRegistry = new JurisdictionProviderRegistry();
    customRegistry.register(mockTcu);

    const res = await searchJuris(
      {
        query: "lote único indivisível | adjudicação por preço global",
        courts: ["TCU"],
        stance: "DEFENSE",
        regime: "13303",
      },
      customRegistry
    );

    expect(res.fileResult.total_hits).toBeGreaterThanOrEqual(1);
    expect(res.fileResult.statutory_bridge_applied).toBeDefined();
    // Exigência estrita de contrato Gen4: normative_bridge idêntico a statutory_bridge_applied
    expect(res.fileResult.normative_bridge).toEqual(res.fileResult.statutory_bridge_applied);
    expect(res.fileResult.court_diagnostics).toBeDefined();
    expect(res.fileResult.court_diagnostics?.[0].court).toBe("TCU");
    expect(res.fileResult.court_diagnostics?.[0].status).toBe("ok");
    expect(res.fileResult.court_diagnostics?.[0].latency_ms).toBeGreaterThanOrEqual(0);
    expect(res.fileResult.results[0].relevance_score).toBeGreaterThan(50);
    expect(res.fileResult.results[0].relevance_score).toBe(res.fileResult.results[0].score);

    // Validação estrita do Teto MCP (< 900 bytes — Lei 2)
    const synthetic = formatSearchJurisSyntheticResult(res.fileResult, res.mdPath);
    const byteLength = Buffer.byteLength(JSON.stringify(synthetic), "utf-8");
    expect(byteLength).toBeLessThan(900);
    expect(synthetic.status).toBe("success");
    expect(synthetic.top_hits[0].relevance_score).toBe(synthetic.top_hits[0].score);
  });

  it("fetchJuris deve fatiar acórdão autêntico e respeitar teto de 900 bytes", async () => {
    // Simula mock provider no registro padrão
    const mockProvider: JurisdictionProvider = {
      courtId: "TCU",
      async search() {
        return [];
      },
      async fetch(id: string) {
        if (id.includes("1234")) {
          return {
            id,
            court: "TCU",
            exists: true,
            rawTextOrJson: {
              tribunal: "TCU",
              colegiado: "Plenário",
              numeroAcordao: "1234",
              anoAcordao: 2024,
              unidadeJurisdicionada: "DATAPREV",
              enunciado: "Validade da licitação com orçamento sigiloso.",
              relatorio: "Alegações e exame técnico",
              voto: "Fundamentação e ratio decidendi",
              acordao: "ACORDAM em julgar regular o procedimento.",
            },
          };
        }
        return { id, court: "TCU", exists: false, rawTextOrJson: null };
      },
    };

    defaultJurisdictionRegistry.register(mockProvider);

    const res = await fetchJuris({
      acordaoIdOrUrl: "Acórdão 1234/2024-TCU-Plenário",
      shortname: "acordao_teste_gen4",
    });

    expect(res.canonicalId).toContain("1234");
    expect(res.slicedResult.layers.layer_1B_entity_regime.isStateItEntity).toBe(true);

    const synthetic = formatFetchJurisSyntheticResult(res);
    const byteLength = Buffer.byteLength(JSON.stringify(synthetic), "utf-8");
    expect(byteLength).toBeLessThan(900);
    expect(synthetic.verified_authentic).toBe(true);
    expect(synthetic.layers_extracted.length).toBe(10);
  });
});
