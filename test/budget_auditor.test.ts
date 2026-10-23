import { describe, it, expect } from "bun:test";
import {
  parseMonetaryValueToCents,
  parseQuantity,
  formatCentsToCurrency,
  auditDocxTables,
  auditPdfLines,
  checkTextGlobalValues,
  auditDocumentBudget,
  injectBudgetAuditIntoImpugnationZones,
  formatBudgetAuditMarkdownBlock,
} from "../src/core/budget_auditor.ts";
import type {
  TableInfo,
  PdfLineItem,
  ImpugnationZonesMap,
} from "../src/types/index.ts";

describe("Auditoria Matemática de Planilhas Orçamentárias (v1.1.0)", () => {
  describe("1. Parsers Numéricos e Monetários em Centavos", () => {
    it("deve converter valores monetários em pt-BR e internacional para centavos inteiros", () => {
      expect(parseMonetaryValueToCents("R$ 1.234,56")).toEqual({
        cents: 123456,
        raw: "R$ 1.234,56",
        isValid: true,
      });

      expect(parseMonetaryValueToCents("1.234,56")).toEqual({
        cents: 123456,
        raw: "1.234,56",
        isValid: true,
      });

      expect(parseMonetaryValueToCents("R$ 0,50")).toEqual({
        cents: 50,
        raw: "R$ 0,50",
        isValid: true,
      });

      expect(parseMonetaryValueToCents("0,01")).toEqual({
        cents: 1,
        raw: "0,01",
        isValid: true,
      });

      expect(parseMonetaryValueToCents("1500.00")).toEqual({
        cents: 150000,
        raw: "1500.00",
        isValid: true,
      });

      expect(parseMonetaryValueToCents("1500")).toEqual({
        cents: 150000,
        raw: "1500",
        isValid: true,
      });

      expect(parseMonetaryValueToCents("texto invalido").isValid).toBe(false);
      expect(parseMonetaryValueToCents("").isValid).toBe(false);
    });

    it("deve converter quantidades inteiras e fracionárias corretamente", () => {
      expect(parseQuantity("10")).toEqual({
        value: 10,
        raw: "10",
        isValid: true,
      });

      expect(parseQuantity("2,5")).toEqual({
        value: 2.5,
        raw: "2,5",
        isValid: true,
      });

      expect(parseQuantity("2.5")).toEqual({
        value: 2.5,
        raw: "2.5",
        isValid: true,
      });

      expect(parseQuantity("1.500")).toEqual({
        value: 1500,
        raw: "1.500",
        isValid: true,
      });

      expect(parseQuantity("10 un")).toEqual({
        value: 10,
        raw: "10 un",
        isValid: true,
      });
    });

    it("deve formatar centavos em moeda pt-BR com separadores de milhar", () => {
      expect(formatCentsToCurrency(123456)).toBe("R$ 1.234,56");
      expect(formatCentsToCurrency(50)).toBe("R$ 0,50");
      expect(formatCentsToCurrency(0)).toBe("R$ 0,00");
      expect(formatCentsToCurrency(-1500)).toBe("-R$ 15,00");
    });
  });

  describe("2. Auditoria em Tabelas DOCX (Word)", () => {
    it("deve validar planilha DOCX 100% conforme sem erros nem alertas", () => {
      const mockTable: TableInfo = {
        index: 0,
        rows: [
          {
            rowIndex: 0,
            cells: [
              { cellIndex: 0, text: "Item" },
              { cellIndex: 1, text: "Descrição" },
              { cellIndex: 2, text: "Unid" },
              { cellIndex: 3, text: "Qtd" },
              { cellIndex: 4, text: "Valor Unitário" },
              { cellIndex: 5, text: "Valor Total" },
            ],
          },
          {
            rowIndex: 1,
            cells: [
              { cellIndex: 0, text: "1" },
              { cellIndex: 1, text: "Notebook Corporativo" },
              { cellIndex: 2, text: "UN" },
              { cellIndex: 3, text: "10" },
              { cellIndex: 4, text: "R$ 4.500,00" },
              { cellIndex: 5, text: "R$ 45.000,00" },
            ],
          },
          {
            rowIndex: 2,
            cells: [
              { cellIndex: 0, text: "2" },
              { cellIndex: 1, text: "Monitor 27 Polegadas" },
              { cellIndex: 2, text: "UN" },
              { cellIndex: 3, text: "20" },
              { cellIndex: 4, text: "R$ 1.200,00" },
              { cellIndex: 5, text: "R$ 24.000,00" },
            ],
          },
          {
            rowIndex: 3,
            cells: [
              { cellIndex: 0, text: "TOTAL GERAL" },
              { cellIndex: 1, text: "" },
              { cellIndex: 2, text: "" },
              { cellIndex: 3, text: "" },
              { cellIndex: 4, text: "" },
              { cellIndex: 5, text: "R$ 69.000,00" },
            ],
          },
        ],
      };

      const audited = auditDocxTables([mockTable]);
      expect(audited.length).toBe(1);
      expect(audited[0].total_items).toBe(2);
      expect(audited[0].items_with_math_errors).toBe(0);
      expect(audited[0].items_with_rounding_warnings).toBe(0);
      expect(audited[0].sum_declared_cents).toBe(6900000);
      expect(audited[0].sum_expected_cents).toBe(6900000);
      expect(audited[0].table_total_discrepancy_cents).toBe(0);
    });

    it("deve detectar erro aritmético bloqueante (MATH_ERROR) e alerta de arredondamento (ROUNDING_WARNING)", () => {
      const mockTable: TableInfo = {
        index: 0,
        rows: [
          {
            rowIndex: 0,
            cells: [
              { cellIndex: 0, text: "Item" },
              { cellIndex: 1, text: "Descrição" },
              { cellIndex: 2, text: "Qtd" },
              { cellIndex: 3, text: "Valor Unitário" },
              { cellIndex: 4, text: "Valor Total" },
            ],
          },
          // Item 1: Erro grosseiro (10 x 50,00 = 550,00 -> Dif R$ 50,00) -> MATH_ERROR
          {
            rowIndex: 1,
            cells: [
              { cellIndex: 0, text: "1" },
              { cellIndex: 1, text: "Teclado USB" },
              { cellIndex: 2, text: "10" },
              { cellIndex: 3, text: "R$ 50,00" },
              { cellIndex: 4, text: "R$ 550,00" },
            ],
          },
          // Item 2: Arredondamento de 1 centavo (3 x 33,33 = 100,00 -> Esperado: 99,99 | Dif R$ 0,01) -> ROUNDING_WARNING
          {
            rowIndex: 2,
            cells: [
              { cellIndex: 0, text: "2" },
              { cellIndex: 1, text: "Serviço Mensal" },
              { cellIndex: 2, text: "3" },
              { cellIndex: 3, text: "R$ 33,33" },
              { cellIndex: 4, text: "R$ 100,00" },
            ],
          },
        ],
      };

      const audited = auditDocxTables([mockTable]);
      expect(audited.length).toBe(1);
      const t = audited[0];
      expect(t.total_items).toBe(2);
      expect(t.items_with_math_errors).toBe(1);
      expect(t.items_with_rounding_warnings).toBe(1);

      expect(t.items[0].discrepancy_severity).toBe("MATH_ERROR");
      expect(t.items[0].diff_cents).toBe(5000); // R$ 50,00

      expect(t.items[1].discrepancy_severity).toBe("ROUNDING_WARNING");
      expect(t.items[1].diff_cents).toBe(1); // R$ 0,01
    });
  });

  describe("3. Auditoria em Linhas PDF (Reconstrução com ' | ')", () => {
    it("deve auditar tabelas PDF extraídas espacialmente", () => {
      const mockLines: PdfLineItem[] = [
        {
          page: 1,
          line: 1,
          coord: "PAG_001 | L0001",
          bracket_coord: "[PAG_001 | L0001]",
          text: "Item | Descrição | Qtd | Valor Unit | Valor Total",
        },
        {
          page: 1,
          line: 2,
          coord: "PAG_001 | L0002",
          bracket_coord: "[PAG_001 | L0002]",
          text: "01 | Servidor Rack 2U | 2 | R$ 15.000,00 | R$ 30.000,00",
        },
        {
          page: 1,
          line: 3,
          coord: "PAG_001 | L0003",
          bracket_coord: "[PAG_001 | L0003]",
          text: "02 | Switch 24p | 4 | R$ 2.500,00 | R$ 12.000,00", // Erro: 4 x 2.500 = 10.000 (Dif R$ 2.000,00)
        },
        {
          page: 1,
          line: 4,
          coord: "PAG_001 | L0004",
          bracket_coord: "[PAG_001 | L0004]",
          text: "TOTAL | | | | R$ 42.000,00",
        },
      ];

      const audited = auditPdfLines(mockLines);
      expect(audited.length).toBe(1);
      const t = audited[0];
      expect(t.total_items).toBe(2);
      expect(t.items_with_math_errors).toBe(1);
      expect(t.items[1].expected_total_cents).toBe(1000000); // R$ 10.000,00
      expect(t.items[1].declared_total_cents).toBe(1200000); // R$ 12.000,00
      expect(t.items[1].discrepancy_severity).toBe("MATH_ERROR");
    });
  });

  describe("4. Cruzamento Textual de Valor Global e Injeção no Radar Z10/Z12", () => {
    it("deve detectar divergência entre soma da planilha e valor global citado no texto", () => {
      const paragraphs = [
        {
          coord: "[P5]",
          text: "O valor total estimado da contratação é de R$ 80.000,00 para o período de 12 meses.",
        },
      ];

      const crossChecks = checkTextGlobalValues(paragraphs, 6900000); // Planilha dá 69.000,00
      expect(crossChecks.length).toBe(1);
      expect(crossChecks[0].text_value_cents).toBe(8000000);
      expect(crossChecks[0].table_sum_cents).toBe(6900000);
      expect(crossChecks[0].diff_cents).toBe(1100000); // R$ 11.000,00
      expect(crossChecks[0].discrepancy_severity).toBe("MATH_ERROR");
    });

    it("deve injetar erros em Z10 (preços) e divergências em Z12 (cruzamento multipéça)", () => {
      const zones: ImpugnationZonesMap = {
        Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO: [],
        Z2_QUALIFICACAO_TECNICA_ATESTADOS: [],
        Z3_QUALIFICACAO_ECONOMICA_GARANTIAS: [],
        Z4_VISTORIA_VISITA_TECNICA: [],
        Z5_AMOSTRA_POC_HOMOLOGACAO: [],
        Z6_VINCULO_FABRICANTE_SOLIDARIEDADE: [],
        Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP: [],
        Z8_PRAZOS_ENTREGA_SLA_GARANTIA: [],
        Z9_EQUIPE_CERTIFICACOES_SEDE: [],
        Z10_PRECOS_EXEQUIBILIDADE_PLANILHA: [],
        Z11_PAGAMENTO_REAJUSTE_IMR_SANCOES: [],
        Z12_MAPA_CRUZADO_MULTIPECA: [],
        Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO: [],
        Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO: [],
      };

      const report = auditDocumentBudget({
        docxTables: [
          {
            index: 0,
            rows: [
              {
                rowIndex: 0,
                cells: [
                  { cellIndex: 0, text: "Item" },
                  { cellIndex: 1, text: "Descrição" },
                  { cellIndex: 2, text: "Qtd" },
                  { cellIndex: 3, text: "Valor Unit" },
                  { cellIndex: 4, text: "Valor Total" },
                ],
              },
              {
                rowIndex: 1,
                cells: [
                  { cellIndex: 0, text: "1" },
                  { cellIndex: 1, text: "Serviço X" },
                  { cellIndex: 2, text: "10" },
                  { cellIndex: 3, text: "R$ 100,00" },
                  { cellIndex: 4, text: "R$ 1.500,00" }, // Erro!
                ],
              },
            ],
          },
        ],
        docxParagraphs: [
          {
            index: 10,
            style: null,
            text: "O valor global estimado é de R$ 2.000,00 conforme dotação orçamentária.",
          },
        ],
      });

      injectBudgetAuditIntoImpugnationZones(report, zones);

      // Z10 deve receber o erro aritmético da planilha
      expect(zones.Z10_PRECOS_EXEQUIBILIDADE_PLANILHA.length).toBe(1);
      expect(
        zones.Z10_PRECOS_EXEQUIBILIDADE_PLANILHA[0].keyword
      ).toBe("ERRO ARITMÉTICO NA PLANILHA");

      // Z12 deve receber a divergência entre texto e planilha
      expect(zones.Z12_MAPA_CRUZADO_MULTIPECA.length).toBe(1);
      expect(zones.Z12_MAPA_CRUZADO_MULTIPECA[0].keyword).toBe(
        "DIVERGÊNCIA VALOR GLOBAL TEXTO VS PLANILHA"
      );

      // Bloco Markdown deve ser gerado
      const md = formatBudgetAuditMarkdownBlock(report);
      expect(md).toContain("Auditoria Matemática de Planilha Orçamentária");
      expect(md).toContain("ERROS ARITMÉTICOS DETECTADOS");
      expect(md).toContain("MATH_ERROR");
    });
  });
});
