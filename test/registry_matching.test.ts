import { describe, test, expect, afterAll } from "bun:test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeStructureFingerprint,
  computeStructuralSimilarity,
  saveTemplateToRegistry,
} from "../src/index.ts";
import { createSuiteTempDir } from "./helpers/fixtures.ts";

describe("Testes Unitários: Registry Matching Avançado e Tolerância vMerge (ENG-03)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("registry_matching");

  afterAll(() => {
    cleanup();
  });

  test("ENG-03: computeStructureFingerprint e matching com vMerge/gridSpan e relato de melhor similaridade em status NEW", async () => {
    // 1. computeStructureFingerprint desconsidera isSpanPlaceholder e vMerge continue
    const mockInspection: any = {
      tables: [
        {
          index: 0,
          rows: [
            {
              cells: [
                { text: "Item", isSpanPlaceholder: false, physicalCellIndex: 0 },
                { text: "Descricao", isSpanPlaceholder: false, physicalCellIndex: 1, colSpan: 2 },
                { text: "Descricao", isSpanPlaceholder: true },
              ],
            },
            {
              cells: [
                { text: "1", isSpanPlaceholder: false, physicalCellIndex: 0, rowSpan: "restart" },
                { text: "Produto A", isSpanPlaceholder: false, physicalCellIndex: 1 },
                { text: "Info", isSpanPlaceholder: false, physicalCellIndex: 2 },
              ],
            },
            {
              cells: [
                { text: "", isSpanPlaceholder: false, physicalCellIndex: 0, rowSpan: "continue" },
                { text: "Produto B", isSpanPlaceholder: false, physicalCellIndex: 1 },
                { text: "Info", isSpanPlaceholder: false, physicalCellIndex: 2 },
              ],
            },
          ],
        },
      ],
      toc_map: {
        sections: [{ title: "1. OBJETO" }],
        form_fields: [
          { coord: "T0.R1.C0", title: "Item 1", suggested_target_slot: "T0.R1.C1" },
          // Duplicata resultante de vMerge
          { coord: "T0.R2.C0", title: "Item 1", suggested_target_slot: "T0.R2.C1" },
        ],
      },
    };

    const fp = computeStructureFingerprint(mockInspection);
    // Deve contar apenas 3 células físicas no cabeçalho (não 3 + placeholder = 3 physical)
    expect(fp.tables[0].cols).toBe(3);
    // Deve deduplicar o form_field repetido na mesma tabela
    expect(fp.form_fields.length).toBe(1);
    expect(fp.form_fields[0].label_normalized).toBe("item 1");

    // 2. Similaridade tolerante a variação de colunas com cabeçalhos iguais
    const fpA = {
      tables: [{ index: 0, rows: 3, cols: 3, coord: "T0", headers: ["item", "descricao", "valor"] }],
      sections: ["1 objeto"],
      form_fields: [{ coord: "T0.R1.C0", label_normalized: "item 1", original_label: "Item 1" }],
    };
    const fpB = {
      tables: [{ index: 0, rows: 3, cols: 4, coord: "T0", headers: ["item", "descricao", "valor"] }],
      sections: ["1 objeto"],
      form_fields: [{ coord: "T0.R1.C0", label_normalized: "item 1", original_label: "Item 1" }],
    };
    const sim = computeStructuralSimilarity(fpA, fpB);
    expect(sim).toBeGreaterThanOrEqual(0.95);

    // 3. findBestTemplateMatch retorna bestEntry e maior similaridade mesmo em status NEW
    const regDir = resolve(tempDir, "test_new_best_match_registry");
    mkdirSync(regDir, { recursive: true });

    saveTemplateToRegistry(
      "modelo_parcial_v1",
      { replace_table_cells: [{ table_index: 0, row_index: 0, cell_index: 1, tag: "{{val}}" }] },
      fpA,
      undefined,
      regDir
    );

    const fpUnrelated = {
      tables: [{ index: 0, rows: 10, cols: 8, coord: "T0", headers: ["codigo", "lote", "unidade"] }],
      sections: ["5 cronograma de execucao"],
      form_fields: [{ coord: "T0.R1.C0", label_normalized: "fiscal", original_label: "Fiscal" }],
    };

    const bestMatch = (await import("../src/core/registry.ts")).findBestTemplateMatch(
      fpUnrelated,
      undefined,
      regDir
    );
    expect(bestMatch.entry).toBeDefined();
    expect(bestMatch.entry?.template_id).toBe("modelo_parcial_v1");
    expect(bestMatch.similarity).toBeGreaterThanOrEqual(0);
    expect(bestMatch.similarity).toBeLessThan(0.75);
  });
});
