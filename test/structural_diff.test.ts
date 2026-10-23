import { describe, it, expect } from "bun:test";
import {
  computeStructuralDiff,
  computeZonesDelta,
  generateInlineDiff,
  generateDiffReportMarkdown,
} from "../src/core/structural_diff.ts";
import type { DocxInspectionResult } from "../src/types/index.ts";

describe("Diff Estrutural e Semântico Multi-Versão (v1.1.0)", () => {
  it("deve gerar inline diff destacando palavras suprimidas e adicionadas", () => {
    const inline = generateInlineDiff(
      "O prazo de entrega será de 10 dias úteis.",
      "O prazo de entrega será de 15 dias úteis."
    );
    expect(inline).toContain("10");
    expect(inline).toContain("15");
  });

  it("deve computar diff estrutural identificando ADDED, REMOVED, MODIFIED e UNCHANGED", () => {
    const oldDoc: DocxInspectionResult = {
      doc_type: "docx",
      headers: [],
      footers: [],
      paragraphs: [
        { index: 0, style: null, text: "1. OBJETO DA CONTRATAÇÃO" },
        { index: 1, style: null, text: "Contratação de serviços de tecnologia da informação." },
        { index: 2, style: null, text: "Cláusula restritiva antiga que deve ser removida." },
      ],
      tables: [],
      impugnation_zones: {
        Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO: [],
        Z2_QUALIFICACAO_TECNICA_ATESTADOS: [],
        Z3_QUALIFICACAO_ECONOMICA_GARANTIAS: [],
        Z4_VISTORIA_VISITA_TECNICA: [],
        Z5_AMOSTRA_POC_HOMOLOGACAO: [],
        Z6_VINCULO_FABRICANTE_SOLIDARIEDADE: [],
        Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP: [],
        Z8_PRAZOS_ENTREGA_SLA_GARANTIA: [
          { coord: "[P2]", keyword: "prazo", snippet: "prazo antigo", section: "SECAO" },
        ],
        Z9_EQUIPE_CERTIFICACOES_SEDE: [],
        Z10_PRECOS_EXEQUIBILIDADE_PLANILHA: [],
        Z11_PAGAMENTO_REAJUSTE_IMR_SANCOES: [],
        Z12_MAPA_CRUZADO_MULTIPECA: [],
        Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO: [],
        Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO: [],
      },
    };

    const newDoc: DocxInspectionResult = {
      doc_type: "docx",
      headers: [],
      footers: [],
      paragraphs: [
        { index: 0, style: null, text: "1. OBJETO DA CONTRATAÇÃO" }, // UNCHANGED
        { index: 1, style: null, text: "Contratação de serviços avançados de tecnologia da informação e nuvem." }, // MODIFIED
        { index: 2, style: null, text: "Nova cláusula de sustentabilidade ambiental e governança." }, // ADDED
      ],
      tables: [],
      impugnation_zones: {
        Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO: [],
        Z2_QUALIFICACAO_TECNICA_ATESTADOS: [],
        Z3_QUALIFICACAO_ECONOMICA_GARANTIAS: [],
        Z4_VISTORIA_VISITA_TECNICA: [],
        Z5_AMOSTRA_POC_HOMOLOGACAO: [],
        Z6_VINCULO_FABRICANTE_SOLIDARIEDADE: [],
        Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP: [],
        Z8_PRAZOS_ENTREGA_SLA_GARANTIA: [], // Z8 foi saneado (RESOLVED)!
        Z9_EQUIPE_CERTIFICACOES_SEDE: [],
        Z10_PRECOS_EXEQUIBILIDADE_PLANILHA: [],
        Z11_PAGAMENTO_REAJUSTE_IMR_SANCOES: [],
        Z12_MAPA_CRUZADO_MULTIPECA: [],
        Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO: [
          { coord: "[P2]", keyword: "marca", snippet: "marca Dell", section: "SECAO" }, // Z13 novo (INTRODUCED)!
        ],
        Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO: [],
      },
    };

    const diff = computeStructuralDiff(oldDoc, newDoc, "Edital_v1.docx", "Edital_v2.docx");

    expect(diff.total_unchanged).toBe(1);
    expect(diff.total_modified).toBe(1);
    expect(diff.total_added).toBe(1);
    expect(diff.total_removed).toBe(1);

    // Valida Delta das 14 Zonas
    expect(diff.zones_delta.length).toBe(2);

    const z13 = diff.zones_delta.find(
      (z) => z.zone_id === "Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO"
    );
    expect(z13).toBeDefined();
    expect(z13!.status).toBe("INTRODUCED");
    expect(z13!.new_occurrences_count).toBe(1);

    const z8 = diff.zones_delta.find(
      (z) => z.zone_id === "Z8_PRAZOS_ENTREGA_SLA_GARANTIA"
    );
    expect(z8).toBeDefined();
    expect(z8!.status).toBe("RESOLVED");
    expect(z8!.old_occurrences_count).toBe(1);

    // Valida relatório Markdown
    const md = generateDiffReportMarkdown(diff);
    expect(md).toContain("Relatório de Diff Estrutural e Semântico Multi-Versão");
    expect(md).toContain("Edital_v1.docx");
    expect(md).toContain("Edital_v2.docx");
    expect(md).toContain("INTRODUZIDO");
    expect(md).toContain("SANEADO");
    expect(md).toContain("[+] ADICIONADO");
    expect(md).toContain("[-] REMOVIDO");
    expect(md).toContain("[~] ALTERADO");
  });
});
