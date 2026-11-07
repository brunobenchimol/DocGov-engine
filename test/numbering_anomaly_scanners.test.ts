import { describe, test, expect } from "bun:test";
import { scanPostCompileIntegrityAlerts } from "../src/tools/inspect.ts";
import type { DocxInspectionResult } from "../src/types/index.ts";

describe("ENG-15 & ENG-16: Scanners de Anomalia e Integridade Pós-Compilação", () => {
  test("4. scanPostCompileIntegrityAlerts deve detectar MULTILEVEL_NUMBERING_RESET em seções >= 2 e não disparar na Seção 1 (ENG-15)", () => {
    // Simulação de inspeção onde na Seção 4 surge um parágrafo iniciando em 1.1.
    const mockInspectionComReset: DocxInspectionResult = {
      paragraphs: [
        { index: 0, text: "4. REQUISITOS DA CONTRATAÇÃO (ORGAO_CONTRATANTE)" },
        { index: 1, text: "1.1. O prazo de entrega do equipamento será de 30 dias." },
      ],
      tables: [],
      headers: [],
      footers: [],
    };

    const alertsComReset = scanPostCompileIntegrityAlerts(mockInspectionComReset);
    const resetAlert = alertsComReset.find((a) => a.code === "MULTILEVEL_NUMBERING_RESET");
    expect(resetAlert).toBeDefined();
    expect(resetAlert?.severity).toBe("HIGH");
    expect(resetAlert?.coords).toContain("P1");

    // Na Seção 1 (OBJETO), 1.1 é perfeitamente legítimo e NÃO deve disparar alerta
    const mockInspectionSecao1: DocxInspectionResult = {
      paragraphs: [
        { index: 0, text: "1. DO OBJETO DA CONTRATAÇÃO (ORGAO_CONTRATANTE)" },
        { index: 1, text: "1.1. Contratação de serviços continuados de tecnologia da informação." },
      ],
      tables: [],
      headers: [],
      footers: [],
    };

    const alertsSecao1 = scanPostCompileIntegrityAlerts(mockInspectionSecao1);
    const resetAlertSecao1 = alertsSecao1.find((a) => a.code === "MULTILEVEL_NUMBERING_RESET");
    expect(resetAlertSecao1).toBeUndefined();

    // ENG-16: Detectar SECTION_PREFIX_MISMATCH quando subcláusula com raiz divergente surgir sob a seção ativa (ex: 10.2.2 na Seção 5)
    const mockInspectionMismatch: DocxInspectionResult = {
      paragraphs: [
        { index: 0, text: "5. DA EXECUÇÃO DO OBJETO E CRITÉRIOS DE MEDIÇÃO" },
        { index: 1, text: "5.1. A execução observará o cronograma físico-financeiro." },
        { index: 2, text: "10.2.2. O prazo de entrega do hardware do doador será de 30 dias." },
      ],
      tables: [],
      headers: [],
      footers: [],
    };
    const alertsMismatch = scanPostCompileIntegrityAlerts(mockInspectionMismatch);
    const mismatchAlert = alertsMismatch.find((a) => a.code === "SECTION_PREFIX_MISMATCH");
    expect(mismatchAlert).toBeDefined();
    expect(mismatchAlert?.severity).toBe("HIGH");
    expect(mismatchAlert?.coords[0]).toContain("10.2.2 sob Seção 5");

    // ENG-16: Detectar DUPLICATE_CLAUSE_NUMBER quando a mesma numeração de cláusula for repetida na mesma seção
    const mockInspectionDuplicate: DocxInspectionResult = {
      paragraphs: [
        { index: 0, text: "5. DA EXECUÇÃO DO OBJETO E CRITÉRIOS DE MEDIÇÃO" },
        { index: 1, text: "5.2.1. Primeira especificação técnica." },
        { index: 2, text: "5.2.1. Segunda especificação técnica com mesmo número duplicado." },
      ],
      tables: [],
      headers: [],
      footers: [],
    };
    const alertsDuplicate = scanPostCompileIntegrityAlerts(mockInspectionDuplicate);
    const dupAlert = alertsDuplicate.find((a) => a.code === "DUPLICATE_CLAUSE_NUMBER");
    expect(dupAlert).toBeDefined();
    expect(dupAlert?.severity).toBe("HIGH");
    expect(dupAlert?.coords[0]).toContain("5.2.1 duplicado na Seção 5");
  });

  test("5. scanPostCompileIntegrityAlerts deve detectar DUPLICATE_CONFLICTING_SLA_TABLES quando houver prazos divergentes para Severidade 1 (ENG-15)", () => {
    // Duas tabelas com Severidade 1 divergente (4 horas vs 1 hora)
    const mockInspectionSlaDivergente: DocxInspectionResult = {
      paragraphs: [{ index: 0, text: "Termo de Referência" }],
      tables: [
        {
          index: 0,
          rows: [
            {
              rowIndex: 0,
              cells: [
                { cellIndex: 0, text: "Severidade", isSpanPlaceholder: false },
                { cellIndex: 1, text: "Tempo de Solução SLA", isSpanPlaceholder: false },
              ],
            },
            {
              rowIndex: 1,
              cells: [
                { cellIndex: 0, text: "Severidade 1 (Crítica)", isSpanPlaceholder: false },
                { cellIndex: 1, text: "Até 4 horas", isSpanPlaceholder: false },
              ],
            },
          ],
        },
        {
          index: 1,
          rows: [
            {
              rowIndex: 0,
              cells: [
                { cellIndex: 0, text: "Classificação do Chamado", isSpanPlaceholder: false },
                { cellIndex: 1, text: "Prazo de Atendimento / SLA", isSpanPlaceholder: false },
              ],
            },
            {
              rowIndex: 1,
              cells: [
                { cellIndex: 0, text: "Severidade 1 - Crítica", isSpanPlaceholder: false },
                { cellIndex: 1, text: "1 hora", isSpanPlaceholder: false },
              ],
            },
          ],
        },
      ],
      headers: [],
      footers: [],
    };

    const alerts = scanPostCompileIntegrityAlerts(mockInspectionSlaDivergente);
    const slaAlert = alerts.find((a) => a.code === "DUPLICATE_CONFLICTING_SLA_TABLES");
    expect(slaAlert).toBeDefined();
    expect(slaAlert?.severity).toBe("HIGH");
    expect(slaAlert?.coords).toEqual(["T0", "T1"]);
    expect(slaAlert?.message).toContain("T0: '4 horas' vs T1: '1 hora'");

    // Quando os prazos de Severidade 1 coincidem, NÃO dispara alerta
    const mockInspectionSlaHarmonizado: DocxInspectionResult = {
      paragraphs: [{ index: 0, text: "Termo de Referência" }],
      tables: [
        {
          index: 0,
          rows: [
            {
              rowIndex: 0,
              cells: [
                { cellIndex: 0, text: "Severidade", isSpanPlaceholder: false },
                { cellIndex: 1, text: "Tempo de Atendimento", isSpanPlaceholder: false },
              ],
            },
            {
              rowIndex: 1,
              cells: [
                { cellIndex: 0, text: "Severidade 1 (Crítica)", isSpanPlaceholder: false },
                { cellIndex: 1, text: "1 hora", isSpanPlaceholder: false },
              ],
            },
          ],
        },
        {
          index: 1,
          rows: [
            {
              rowIndex: 0,
              cells: [
                { cellIndex: 0, text: "Chamado SLA", isSpanPlaceholder: false },
                { cellIndex: 1, text: "Tempo de Resposta", isSpanPlaceholder: false },
              ],
            },
            {
              rowIndex: 1,
              cells: [
                { cellIndex: 0, text: "Severidade 1", isSpanPlaceholder: false },
                { cellIndex: 1, text: "1 hora", isSpanPlaceholder: false },
              ],
            },
          ],
        },
      ],
      headers: [],
      footers: [],
    };

    const alertsHarmonizado = scanPostCompileIntegrityAlerts(mockInspectionSlaHarmonizado);
    const slaAlertHarmonizado = alertsHarmonizado.find((a) => a.code === "DUPLICATE_CONFLICTING_SLA_TABLES");
    expect(slaAlertHarmonizado).toBeUndefined();
  });

  test("7. scanPostCompileIntegrityAlerts: refinamento de UNCALCULATED_TOTAL_ROW permite unitários de referência com total zerado (RILC Art. 19)", () => {
    // Cenário 1: Tabela de Estimativa de Preços com valores unitários preenchidos e total zerado (orçamento em fechamento de cotações)
    const mockCotacaoPreliminar: DocxInspectionResult = {
      paragraphs: [{ index: 0, text: "Estudo Técnico Preliminar - Estimativa de Preços" }],
      tables: [
        {
          index: 0,
          rows: [
            {
              rowIndex: 0,
              cells: [
                { cellIndex: 0, text: "Item", isSpanPlaceholder: false },
                { cellIndex: 1, text: "Descrição", isSpanPlaceholder: false },
                { cellIndex: 2, text: "Qtd", isSpanPlaceholder: false },
                { cellIndex: 3, text: "Valor Unitário", isSpanPlaceholder: false },
                { cellIndex: 4, text: "Valor Total", isSpanPlaceholder: false },
              ],
            },
            {
              rowIndex: 1,
              cells: [
                { cellIndex: 0, text: "1", isSpanPlaceholder: false },
                { cellIndex: 1, text: "Subscrição Software A", isSpanPlaceholder: false },
                { cellIndex: 2, text: "10 UNS", isSpanPlaceholder: false },
                { cellIndex: 3, text: "R$ 1.306,46", isSpanPlaceholder: false },
                { cellIndex: 4, text: "R$ 0,00", isSpanPlaceholder: false },
              ],
            },
            {
              rowIndex: 2,
              cells: [
                { cellIndex: 0, text: "2", isSpanPlaceholder: false },
                { cellIndex: 1, text: "Subscrição Software B", isSpanPlaceholder: false },
                { cellIndex: 2, text: "5 UNS", isSpanPlaceholder: false },
                { cellIndex: 3, text: "R$ 1.631,78", isSpanPlaceholder: false },
                { cellIndex: 4, text: "R$ 0,00", isSpanPlaceholder: false },
              ],
            },
            {
              rowIndex: 3,
              cells: [
                { cellIndex: 0, text: "TOTAL GERAL", isSpanPlaceholder: false },
                { cellIndex: 1, text: "", isSpanPlaceholder: false },
                { cellIndex: 2, text: "", isSpanPlaceholder: false },
                { cellIndex: 3, text: "", isSpanPlaceholder: false },
                { cellIndex: 4, text: "R$ 0,00", isSpanPlaceholder: false },
              ],
            },
          ],
        },
      ],
      headers: [],
      footers: [],
    };

    const alertsCotacao = scanPostCompileIntegrityAlerts(mockCotacaoPreliminar);
    const uncalcAlertCotacao = alertsCotacao.find((a) => a.code === "UNCALCULATED_TOTAL_ROW");
    expect(uncalcAlertCotacao).toBeUndefined();

    // Cenário 2: Tabela onde os itens possuem total calculado (> 0), mas a linha TOTAL GERAL está em R$ 0,00 -> DEVE disparar
    const mockTotalDivergente: DocxInspectionResult = {
      paragraphs: [{ index: 0, text: "Termo de Referência" }],
      tables: [
        {
          index: 0,
          rows: [
            {
              rowIndex: 0,
              cells: [
                { cellIndex: 0, text: "Item", isSpanPlaceholder: false },
                { cellIndex: 1, text: "Descrição", isSpanPlaceholder: false },
                { cellIndex: 2, text: "Qtd", isSpanPlaceholder: false },
                { cellIndex: 3, text: "Valor Unitário", isSpanPlaceholder: false },
                { cellIndex: 4, text: "Valor Total", isSpanPlaceholder: false },
              ],
            },
            {
              rowIndex: 1,
              cells: [
                { cellIndex: 0, text: "1", isSpanPlaceholder: false },
                { cellIndex: 1, text: "Subscrição Software", isSpanPlaceholder: false },
                { cellIndex: 2, text: "10 UNS", isSpanPlaceholder: false },
                { cellIndex: 3, text: "R$ 1.000,00", isSpanPlaceholder: false },
                { cellIndex: 4, text: "R$ 10.000,00", isSpanPlaceholder: false },
              ],
            },
            {
              rowIndex: 2,
              cells: [
                { cellIndex: 0, text: "TOTAL GERAL", isSpanPlaceholder: false },
                { cellIndex: 1, text: "", isSpanPlaceholder: false },
                { cellIndex: 2, text: "", isSpanPlaceholder: false },
                { cellIndex: 3, text: "", isSpanPlaceholder: false },
                { cellIndex: 4, text: "R$ 0,00", isSpanPlaceholder: false },
              ],
            },
          ],
        },
      ],
      headers: [],
      footers: [],
    };

    const alertsDivergente = scanPostCompileIntegrityAlerts(mockTotalDivergente);
    const uncalcAlertDivergente = alertsDivergente.find((a) => a.code === "UNCALCULATED_TOTAL_ROW");
    expect(uncalcAlertDivergente).toBeDefined();
    expect(uncalcAlertDivergente?.severity).toBe("HIGH");
  });
});
