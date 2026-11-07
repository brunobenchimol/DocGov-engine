import { describe, it, expect } from "bun:test";
import {
  assertAuthenticAcordao,
  sliceAcordaoAnatomically,
} from "../../src/tools/juris/anatomical_slicer.ts";

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

  it("sliceAcordaoAnatomically: deve fatiar acórdão do TST com tipografia espaçada forense e extrair votos reais", () => {
    const rawTstText = `
A C Ó R D Ã O
(4ª Turma)
GMMCP/jmd

EMBARGOS DE DECLARAÇÃO – RECURSO DE REVISTA – TERCEIRIZAÇÃO – SÚMULA Nº 331, IV, DO TST

Vistos, relatados e discutidos estes autos de ED-Ag-RR n° TST-ED-Ag-RR-959-81.2015.5.05.0033.
A C. 4ª Turma negou provimento ao Agravo da Reclamante.
É o relatório.

V O T O

I - CONHECIMENTO
Tempestivos e regulares, conheço dos embargos.

II – MÉRITO
Manteve a decisão monocrática que conhecera do Recurso de Revista da segunda Reclamada por má aplicação da Súmula nº 331 do TST.
Fundamentação detalhada com mais de mil palavras sobre terceirização ilícita e fiscalização contratual pelo ente público.

ISTO POSTO

ACORDAM os Ministros da Quarta Turma do Tribunal Superior do Trabalho, por unanimidade, rejeitar os Embargos de Declaração.
Brasília, 6 de agosto de 2024.
Maria Cristina Irigoyen Peduzzi
Ministra Relatora
    `;

    const tstPayload = {
      court: "TST",
      colegiado: "4ª Turma",
      processo: "ED-Ag-RR - 959-81.2015.5.05.0033",
      relator: "Maria Cristina Irigoyen Peduzzi",
      ementa: "EMBARGOS DE DECLARAÇÃO – RECURSO DE REVISTA – TERCEIRIZAÇÃO – SÚMULA Nº 331, IV, DO TST",
      rawText: rawTstText,
    };

    const res = sliceAcordaoAnatomically(tstPayload, { court: "TST" });
    const l = res.layers;

    expect(l.layer_1A_metadata.tribunal).toBe("TST");
    expect(l.layer_1A_metadata.colegiado).toBe("4ª Turma");
    expect(l.layer_1A_metadata.relator).toContain("Maria Cristina Irigoyen Peduzzi");
    expect(l.layer_2B_enunciado_tese).toContain("SÚMULA Nº 331");
    expect(l.layer_4A_ratio_decidendi).toContain("Súmula nº 331");
    expect(l.layer_4A_ratio_decidendi).not.toBe("");
    expect(l.layer_5A_operative_commands.length).toBeGreaterThan(0);
    expect(l.layer_5A_operative_commands[0]).toContain("ACORDAM");
    expect(res.dossieMarkdown).not.toContain("(VAZIO — ZERO CONTEÚDO EXTRAÍDO)");
  });
});
