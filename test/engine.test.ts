import { describe, test, expect } from "bun:test";
import {
  VERSION,
  formatBootstrapCaseSyntheticResult,
  formatInspectDocxSyntheticResult,
  formatBuildDocxTemplateSyntheticResult,
  formatFillDocxTemplateSyntheticResult,
  formatGenerateAuditDocxSyntheticResult,
  formatAuditDocxSyntheticResult,
} from "../src/index.ts";

describe("Testes Unitários v0.7.1: engine_version e Teto Estrito MCP (< 1024 bytes) nas 5 Ferramentas", () => {
  test("1. bootstrap_case deve conter 'engine_version' na raiz e payload < 1024 bytes", () => {
    const synthetic = formatBootstrapCaseSyntheticResult(
      {
        status: "success",
        caseDir: "cases/caso_contratacao_01",
        copiedFiles: ["minuta_edital.docx"],
        backgroundFiles: ["termo_referencia.pdf"],
        backgroundCopy: {
          status: "started",
          totalFiles: 1,
          files: ["termo_referencia.pdf"],
          message: "Salvaguarda ativa",
        },
        inspectedDocx: [
          {
            fileName: "minuta_edital.docx",
            structurePath: "cases/caso_contratacao_01/state/estrutura_minuta_edital.json",
            tablesCount: 3,
            paragraphsCount: 42,
            compactStructure: {
              headers: [],
              footers: [],
              paragraphs: [],
              tables: [],
            },
          },
        ],
      },
      "cases/caso_contratacao_01"
    );

    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("0.7.1");
    expect(synthetic).toHaveProperty("engine_version");

    const json = JSON.stringify(synthetic, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");
    expect(bytes).toBeLessThan(1024);
  });

  test("2. inspect_docx deve conter 'engine_version' na raiz e payload < 1024 bytes", () => {
    const synthetic = formatInspectDocxSyntheticResult(
      "inputs/modelo_dfd.docx",
      "state/estrutura_dfd.json",
      {
        headers: [],
        footers: [],
        paragraphs: [
          { index: 0, style: "Heading1", text: "1. OBJETO DO DFD" },
          { index: 1, style: null, text: "Aquisição de estações de trabalho" },
        ],
        tables: [
          {
            index: 0,
            rows: [
              {
                rowIndex: 0,
                cells: [
                  { cellIndex: 0, text: "Item" },
                  { cellIndex: 1, text: "Descrição" },
                ],
              },
            ],
          },
        ],
        toc_map: {
          sections: [
            {
              coord: "P0",
              title: "1. OBJETO DO DFD",
              suggested_target_slot: "P1",
            },
          ],
          form_fields: [],
          tables: [
            {
              table_index: 0,
              rows: 1,
              cols: 2,
              headers: ["Item", "Descrição"],
              sample_row_coord: "T0.R0",
            },
          ],
        },
      }
    );

    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("0.7.1");
    expect(synthetic).toHaveProperty("engine_version");

    const json = JSON.stringify(synthetic, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");
    expect(bytes).toBeLessThan(1024);
  });

  test("3. build_docx_template deve conter 'engine_version' na raiz e payload < 1024 bytes", () => {
    const synthetic = formatBuildDocxTemplateSyntheticResult(
      "state/template_dfd.docx",
      {
        success: true,
        message: "Template parametrizado gerado com sucesso em: state/template_dfd.docx (5 slots aplicados)",
        applied_slots_count: 5,
        breakdown: {
          replace_paragraphs: 2,
          loop_paragraphs: 0,
          replace_table_cells: 2,
          loop_table_rows: 1,
          replace_inline: 0,
        },
      }
    );

    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("0.7.1");
    expect(synthetic).toHaveProperty("engine_version");

    const json = JSON.stringify(synthetic, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");
    expect(bytes).toBeLessThan(1024);
  });

  test("4. fill_docx_template deve conter 'engine_version' na raiz e payload < 1024 bytes", () => {
    const synthetic = formatFillDocxTemplateSyntheticResult({
      success: true,
      message: "Minuta gerada com sucesso com motor híbrido v0.7.0",
      outputPath: "output/DFD_Final.docx",
      inspection_path: "state/inspecao_DFD_Final.json",
      visao_auditoria_path: "state/visao_auditoria_DFD_Final.md",
      next_step_hint: "Próximo: acione o Auditor Externo.",
    });

    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("0.7.1");
    expect(synthetic).toHaveProperty("engine_version");

    const json = JSON.stringify(synthetic, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");
    expect(bytes).toBeLessThan(1024);
  });

  test("5. generate_audit_docx deve conter 'engine_version' na raiz e payload < 1024 bytes", () => {
    const synthetic = formatGenerateAuditDocxSyntheticResult({
      outputPath: "output/Relatorio_Auditoria_DFD.docx",
      message: "Relatório de Auditoria (.docx) gerado com sucesso em: output/Relatorio_Auditoria_DFD.docx",
    });

    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("0.7.1");
    expect(synthetic).toHaveProperty("engine_version");
    expect(synthetic.next_step_hint).toContain("Ciclo de auditoria concluído");

    // Verifica também o alias exportado
    const aliasSynthetic = formatAuditDocxSyntheticResult({
      outputPath: "output/Relatorio_Auditoria_DFD.docx",
      message: "Relatório de Auditoria (.docx) gerado com sucesso em: output/Relatorio_Auditoria_DFD.docx",
    });
    expect(aliasSynthetic.engine_version).toBe("0.7.1");

    const json = JSON.stringify(synthetic, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");
    expect(bytes).toBeLessThan(1024);
  });

  test("Garantia Cross-Tool: todas as 5 ferramentas retornam payload sintético com engine_version idêntico e < 1024 bytes", () => {
    const payloads = [
      formatBootstrapCaseSyntheticResult({
        status: "success",
        caseDir: "cases/c1",
        copiedFiles: [],
        backgroundFiles: [],
        backgroundCopy: { status: "idle", totalFiles: 0, files: [], message: "" },
        inspectedDocx: [],
      }),
      formatInspectDocxSyntheticResult("doc.docx", "est.json", {
        headers: [],
        footers: [],
        paragraphs: [],
        tables: [],
      }),
      formatBuildDocxTemplateSyntheticResult("tpl.docx", {
        success: true,
        message: "OK",
        applied_slots_count: 1,
        breakdown: {
          replace_paragraphs: 1,
          loop_paragraphs: 0,
          replace_table_cells: 0,
          loop_table_rows: 0,
          replace_inline: 0,
        },
      }),
      formatFillDocxTemplateSyntheticResult({
        success: true,
        message: "OK",
        outputPath: "out.docx",
        next_step_hint: "hint",
      }),
      formatGenerateAuditDocxSyntheticResult({
        outputPath: "audit.docx",
        message: "OK",
      }),
    ];

    expect(payloads.length).toBe(5);
    for (const p of payloads) {
      expect(p.engine_version).toBe("0.7.1");
      expect(p.engine_version).toBe(VERSION);
      expect(p.status).toBe("success");
      const bytes = Buffer.byteLength(JSON.stringify(p, null, 2), "utf-8");
      expect(bytes).toBeLessThan(1024);
    }
  });
});
