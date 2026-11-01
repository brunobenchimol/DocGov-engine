import { describe, it, expect } from "bun:test";
import {
  STATUTORY_BRIDGES,
  isStateItEntity,
  findStatutoryBridgesForText,
  expandQueryWithStatutoryBridge,
  getDistinguishingNote,
} from "../src/tools/juris/statutory_bridge.ts";
import {
  scoreJurisItem,
  classifyDecisionOutcome,
  tokenizeQuery,
} from "../src/tools/juris/relevance_scorer.ts";
import {
  createJurisSearchContractError,
  createJurisFetchContractError,
  EXACT_COPY_PASTE_JURIS_SEARCH_SNIPPET,
  EXACT_COPY_PASTE_JURIS_FETCH_SNIPPET,
} from "../src/contracts/errors.ts";
import {
  assertAuthenticAcordao,
  sliceAcordaoAnatomically,
} from "../src/tools/juris/anatomical_slicer.ts";
import {
  defaultJurisdictionRegistry,
  JurisdictionProviderRegistry,
  SUPPORTED_UFS,
} from "../src/tools/juris/provider_registry.ts";
import {
  searchJuris,
  formatSearchJurisSyntheticResult,
} from "../src/tools/juris/search_juris.ts";
import {
  fetchJuris,
  formatFetchJurisSyntheticResult,
} from "../src/tools/juris/fetch_juris.ts";
import type { JurisdictionProvider } from "../src/tools/juris/types.ts";

describe("Jurisprudência v1.4.0 — Statutory Bridge (Lei 13.303/16 <-> Lei 14.133/21)", () => {
  it("deve contemplar os 10 eixos normativos estruturados (SB-01 a SB-10)", () => {
    expect(STATUTORY_BRIDGES.length).toBe(10);
    const ids = STATUTORY_BRIDGES.map((b) => b.id);
    expect(ids).toEqual([
      "SB-01", "SB-02", "SB-03", "SB-04", "SB-05",
      "SB-06", "SB-07", "SB-08", "SB-09", "SB-10",
    ]);

    for (const bridge of STATUTORY_BRIDGES) {
      expect(bridge.topic).toBeDefined();
      expect(bridge.art13303).toBeDefined();
      expect(bridge.art14133).toBeDefined();
      expect(bridge.distinguishingNote.length).toBeGreaterThan(20);
      expect(bridge.keywords.length).toBeGreaterThan(2);
    }
  });

  it("deve reconhecer empresas estatais de TI e entidades públicas estratégicas", () => {
    expect(isStateItEntity("SERPRO")).toBe(true);
    expect(isStateItEntity("Serviço Federal de Processamento de Dados - Serpro")).toBe(true);
    expect(isStateItEntity("Empresa de Tecnologia e Informações da Previdência - DATAPREV")).toBe(true);
    expect(isStateItEntity("BB Tecnologia e Serviços (BBTS)")).toBe(true);
    expect(isStateItEntity("Petróleo Brasileiro S.A. - Petrobras")).toBe(true);
    expect(isStateItEntity("Empresa de Tecnologia da Informação e Comunicação do Pará - PRODEPA")).toBe(true);
    expect(isStateItEntity("Companhia de Processamento de Dados do Estado de São Paulo - PRODESP")).toBe(true);
    expect(isStateItEntity("SECRETARIA_MUNICIPAL_GENERICA")).toBe(false);
  });

  it("deve detectar eixos temáticos e expandir queries adequadamente", () => {
    const bridges = findStatutoryBridgesForText("Contratação integrada de software em lote único indivisível");
    expect(bridges.some((b) => b.id === "SB-02")).toBe(true);

    const expansion = expandQueryWithStatutoryBridge("lote único e adjudicação global", "13303");
    expect(expansion.appliedBridgeIds).toContain("SB-02");
    expect(expansion.expandedTerms).toContain("Súmula TCU 247");
    expect(expansion.expandedTerms).toContain("13.303");
  });

  it("deve fornecer distinguishing específico pró-estatais para Art. 34 e Art. 71", () => {
    const note34 = getDistinguishingNote("SB-04");
    expect(note34).toContain("regra legal geral direta");
    expect(note34).toContain("Art. 34 da Lei 13.303/16");

    const note71 = getDistinguishingNote("SB-05");
    expect(note71).toContain("até 5 anos (60 meses)");
  });
});

describe("Jurisprudência v1.4.0 — Motor de Ranking Determinístico (0..100 pts)", () => {
  it("deve pontuar mais alto no modo DEFENSE quando a decisão favorece a modelagem", () => {
    const favorableItem = {
      id: "ACORDAO-TCU-100-2024",
      court: "TCU",
      colegiado: "Plenário",
      ano: 2024,
      entidade: "SERPRO",
      indexacao: "LICITAÇÃO. LOTE ÚNICO. ADJUDICAÇÃO POR PREÇO GLOBAL.",
      tese: "É lícita a adjudicação por preço global de solução integrada de TI.",
      dispositivo: "ACORDAM em julgar a representação improcedente, arquivando os autos.",
    };

    const defenseScore = scoreJurisItem(favorableItem, "lote único adjudicação global", {
      stance: "DEFENSE",
      regime: "13303",
    });

    const attackScore = scoreJurisItem(favorableItem, "lote único adjudicação global", {
      stance: "ATTACK",
      regime: "13303",
    });

    expect(defenseScore.relevance_score).toBeGreaterThan(attackScore.relevance_score);
    expect(defenseScore.relevance_score).toBe(defenseScore.score); // alias de compatibilidade
    expect(defenseScore.breakdown.stanceAlignment).toBe(25);
    expect(attackScore.breakdown.stanceAlignment).toBe(4);
    expect(defenseScore.outcome).toBe("IMPROCEDENTE / MANUTENCAO_CERTAME");
  });

  it("deve pontuar mais alto no modo ATTACK quando a decisão anula ou suspende o certame", () => {
    const adverseItem = {
      id: "ACORDAO-TCU-200-2024",
      court: "TCU",
      colegiado: "Plenário",
      ano: 2024,
      indexacao: "LICITAÇÃO. CLÁUSULA RESTRITIVA. HABILITAÇÃO.",
      tese: "A exigência excessiva restringe a competitividade e fere a isonomia.",
      dispositivo: "ACORDAM em julgar a representação procedente para determinar a anulação do edital.",
    };

    const attackScore = scoreJurisItem(adverseItem, "cláusula restritiva habilitação", {
      stance: "ATTACK",
    });

    const defenseScore = scoreJurisItem(adverseItem, "cláusula restritiva habilitação", {
      stance: "DEFENSE",
    });

    expect(attackScore.relevance_score).toBeGreaterThan(defenseScore.relevance_score);
    expect(attackScore.breakdown.stanceAlignment).toBe(25);
    expect(defenseScore.breakdown.stanceAlignment).toBe(4);
    expect(attackScore.outcome).toBe("PROCEDENTE / DETERMINACAO");
  });

  it("deve classificar os desfechos decisórios por regex determinístico", () => {
    expect(classifyDecisionOutcome("deferir a medida cautelar para suspender o certame")).toBe("CAUTELAR_DEFERIDA");
    expect(classifyDecisionOutcome("indeferir a medida cautelar requerida")).toBe("CAUTELAR_INDEFERIDA");
    expect(classifyDecisionOutcome("julgar improcedente a representação")).toBe("IMPROCEDENTE / MANUTENCAO_CERTAME");
    expect(classifyDecisionOutcome("julgar procedente a representação e determinar a anulação")).toBe("PROCEDENTE / DETERMINACAO");
    expect(classifyDecisionOutcome("dar ciência de impropriedade ao órgão")).toBe("CIENCIA / RECOMENDACAO");
  });

  it("deve tokenizar query sem ruído de stopwords", () => {
    const tokens = tokenizeQuery("Contratação de fábrica de software pelo TCU no Plenário");
    expect(tokens).toContain("contratação");
    expect(tokens).toContain("fábrica");
    expect(tokens).toContain("software");
    expect(tokens).not.toContain("de");
    expect(tokens).not.toContain("pelo");
    expect(tokens).not.toContain("tcu");
    expect(tokens).not.toContain("plenário");
  });
});

describe("Jurisprudência v1.4.0 — Contratos e Padrão Exact Copy-Paste Error (Lei 3)", () => {
  it("createJurisSearchContractError deve gerar erro com mensagem imperativa e snippet canônico", () => {
    const err = createJurisSearchContractError("query ausente");
    expect(err.message).toContain("NÃO faça leituras exploratórias no repositório");
    expect(err.message).toContain("search_juris");
    expect(err.message).toContain(EXACT_COPY_PASTE_JURIS_SEARCH_SNIPPET);
  });

  it("createJurisFetchContractError deve gerar erro com mensagem imperativa e snippet canônico", () => {
    const err = createJurisFetchContractError("acordaoIdOrUrl ausente");
    expect(err.message).toContain("NÃO faça leituras exploratórias no repositório");
    expect(err.message).toContain("fetch_juris");
    expect(err.message).toContain(EXACT_COPY_PASTE_JURIS_FETCH_SNIPPET);
  });
});

describe("Jurisprudência v1.4.0 — AnatomicalSlicer e Trava Anti-Alucinação", () => {
  it("assertAuthenticAcordao deve permitir acórdãos autênticos e barrar acórdãos inexistentes com [ANTI_HALLUCINATION_BLOCK]", () => {
    expect(() => assertAuthenticAcordao(true, "Acórdão 1234/2024-TCU-Plenário", "TCU")).not.toThrow();

    expect(() => assertAuthenticAcordao(false, "Acórdão 99999/2099-TCU-Plenário", "TCU")).toThrow(
      /\[ANTI_HALLUCINATION_BLOCK\].*NÃO EXISTE na base oficial/
    );
  });

  it("sliceAcordaoAnatomically deve decompor nas 6 Macro-Partes e 10 Sub-Camadas", () => {
    const rawAcordao = {
      tribunal: "TCU",
      colegiado: "Plenário",
      numeroAcordao: "1234",
      anoAcordao: 2024,
      processo: "001.234/2024-5",
      relator: "Ministro Relator Teste",
      dataSessao: "15/05/2024",
      unidadeJurisdicionada: "Serviço Federal de Processamento de Dados - SERPRO",
      indexacao: "LICITAÇÃO; CONTRATAÇÃO DE TI; LOTE ÚNICO; LEI 13.303/2016",
      enunciado: "<p>É lícita a <b>adjudicação por preço global</b> em solução integrada de software quando motivada na integridade sistêmica.</p>",
      relatorio: `
        HISTÓRICO
        Trata-se de representação sobre supostas irregularidades em pregão eletrônico.
        MANIFESTAÇÃO DA UNIDADE JURISDICIONADA
        O Serpro alegou que a indivisibilidade do objeto é indispensável para garantia de SLA único.
        EXAME TÉCNICO DA AUDTI
        A AudTI concluiu que a modelagem adotada preserva a vantajosidade e atende à jurisprudência.
      `,
      voto: `
        I - INTRODUÇÃO
        Acolho as conclusões da unidade técnica.
        II - DO LOTE ÚNICO E ADJUDICAÇÃO GLOBAL
        No caso concreto, assiste razão ao gestor diante da interdependência técnica dos módulos.
      `,
      acordao: `
        ACÓRDÃO 1234/2024 - TCU - Plenário
        9.1. conhecer da presente representação para, no mérito, julgá-la improcedente;
        9.2. arquivar os presentes autos.
      `,
    };

    const result = sliceAcordaoAnatomically(rawAcordao, {
      topicFilter: "lote único | adjudicação global",
    });

    const l = result.layers;
    // 1A & 1B
    expect(l.layer_1A_metadata.tribunal).toBe("TCU");
    expect(l.layer_1A_metadata.colegiado).toBe("Plenário");
    expect(l.layer_1A_metadata.numero).toBe("1234");
    expect(l.layer_1A_metadata.ano).toBe(2024);
    expect(l.layer_1B_entity_regime.regimeLegal).toBe("LEI_13303_ESTATAIS");
    expect(l.layer_1B_entity_regime.isStateItEntity).toBe(true);

    // 2A & 2B
    expect(l.layer_2A_indexing_tags.length).toBeGreaterThanOrEqual(3);
    expect(l.layer_2B_enunciado_tese).toContain("adjudicação por preço global");
    expect(l.layer_2B_enunciado_tese).not.toContain("<b>"); // HTML sanitizado

    // 3A, 3B, 3C
    expect(l.layer_3A_factual_controversy).toContain("representação");
    expect(l.layer_3B_defense_arguments).toContain("Serpro");
    expect(l.layer_3C_technical_unit_analysis).toContain("AudTI");

    // 4A & 5A & 6A
    expect(l.layer_4A_ratio_decidendi).toContain("interdependência técnica");
    expect(l.layer_5A_operative_commands.length).toBe(2);
    expect(result.layers.outcome_summary).toBe("IMPROCEDENTE / MANUTENCAO_CERTAME");
    expect(l.layer_6A_closing_quorum.quorum).toBeDefined();

    // Estágio 2 e 3 Markdowns
    expect(result.dossieMarkdown).toContain("# 🏛️ Dossiê Anatômico de Jurisprudência");
    expect(result.dossieMarkdown).toContain("IMPROCEDENTE / MANUTENCAO_CERTAME");
    expect(result.fullMarkdown).toContain("# Inteiro Teor Estruturado");
    expect(result.fullMarkdown).toContain("## 3. Relatório");
    expect(result.fullMarkdown).toContain("## 4. Voto / Fundamentação");

    // Topic matching
    expect(result.topicsMatched).toBeGreaterThanOrEqual(1);
  });
});

describe("Jurisprudência v1.4.0 — Roteamento Jurisdicional e Graceful Fallback", () => {
  it("deve selecionar a camada federal completa (TCU, STJ, STF) quando courts e uf forem omitidos", () => {
    const { selectedProviders, routingInfo } = defaultJurisdictionRegistry.resolveRouting();
    expect(routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF"]);
    expect(routingInfo.unimplemented_uf_requested).toBeNull();
    expect(routingInfo.fallback_notice).toBeNull();
    expect(routingInfo.supported_ufs).toEqual(["PA", "CE", "DF"]);
    expect(selectedProviders.map((p) => p.courtId)).toEqual(["TCU", "STJ", "STF"]);
  });

  it("deve incluir o TCE respectivo para UFs implementadas (PA, CE, DF)", () => {
    const resPa = defaultJurisdictionRegistry.resolveRouting(undefined, "PA");
    expect(resPa.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF", "TCE-PA"]);
    expect(resPa.routingInfo.unimplemented_uf_requested).toBeNull();

    const resCe = defaultJurisdictionRegistry.resolveRouting(undefined, "CE");
    expect(resCe.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF", "TCE-CE"]);

    const resDf = defaultJurisdictionRegistry.resolveRouting(undefined, "DF");
    expect(resDf.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF", "TCDF"]);
  });

  it("deve aplicar Graceful Fallback sem falhar quando solicitada UF não implementada (ex: AM, PR)", () => {
    const resAm = defaultJurisdictionRegistry.resolveRouting(undefined, "AM");
    expect(resAm.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF"]);
    expect(resAm.routingInfo.unimplemented_uf_requested).toBe("AM");
    expect(resAm.routingInfo.fallback_notice).toContain("Conector estadual para UF 'AM' ainda não implementado");
    expect(resAm.routingInfo.fallback_notice).toContain("Graceful Fallback");
    expect(resAm.routingInfo.supported_ufs).toEqual(["PA", "CE", "DF"]);
  });

  it("deve respeitar courts explícitos informados pelo usuário", () => {
    const res = defaultJurisdictionRegistry.resolveRouting(["TCU", "TCE-PA"]);
    expect(res.routingInfo.executed_courts).toEqual(["TCU", "TCE-PA"]);
    expect(res.routingInfo.unimplemented_uf_requested).toBeNull();
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


