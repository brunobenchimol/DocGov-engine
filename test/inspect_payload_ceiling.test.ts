import { describe, test, expect } from "bun:test";
import { formatInspectDocSyntheticResult } from "../src/tools/inspect.ts";
import type { DocxInspectionResult } from "../src/types/index.ts";

describe("Testes Unitários v1.3.2: Otimização de Teto MCP em inspect_doc (< 900B)", () => {
  test("1. Deve manter payload < 900 bytes e eliminar duplicação de docxPath com caminhos longos e template_match", () => {
    // Simula caminho longo no Windows típico de ambiente corporativo / Antigravity
    const longFilePath =
      "C:/Users/bruno/Meu Drive/Agents/DocGov/cases/seduc_pa_rev2_id0015/inputs/ETP_AGU_14a9_minuta_padrao_contratacao.docx";
    const longOutputPath =
      "C:/Users/bruno/Meu Drive/Agents/DocGov/cases/seduc_pa_rev2_id0015/state/estrutura_ETP_AGU_14a9_minuta_padrao_contratacao.json";

    const mockInspection: DocxInspectionResult = {
      doc_type: "docx",
      page_count: 15,
      line_count: 420,
      tables: [
        {
          index: 0,
          rows: [
            { index: 0, cells: [{ text: "Item" }, { text: "Valor" }] },
            { index: 1, cells: [{ text: "Item 1" }, { text: "R$ 10.000,00" }] },
          ],
        },
      ],
      paragraphs: [{ index: 0, text: "Introdução" }, { index: 1, text: "Objeto" }],
      audit_view_path:
        "C:/Users/bruno/Meu Drive/Agents/DocGov/cases/seduc_pa_rev2_id0015/state/visao_auditoria_ETP.md",
      dossie_hotspots_path:
        "C:/Users/bruno/Meu Drive/Agents/DocGov/cases/seduc_pa_rev2_id0015/state/dossie_hotspots_ETP.md",
      template_match: {
        status: "EXACT",
        similarity: 1.0,
        template_id: "ETP_AGU_SERVICOS_COMUNS_V14",
        adapted_manifest_path:
          "C:/Users/bruno/Meu Drive/Agents/DocGov/cases/seduc_pa_rev2_id0015/state/adapted_slots_manifest.json",
        created_at: "2026-01-15T10:00:00.000Z",
        updated_at: "2026-03-20T14:30:00.000Z",
        age_days: 45,
        cache_date_status: "KNOWN",
        engine_version: "1.3.3",
        slots_count: 24,
      },
      toc_map: {
        sections: [
          { coord: "P001_L0001", title: "1. DO OBJETO DA CONTRATAÇÃO", suggested_target_slot: "SLOT_OBJETO" },
          { coord: "P003_L0045", title: "2. DA JUSTIFICATIVA DA NECESSIDADE", suggested_target_slot: "SLOT_JUSTIF" },
        ],
        form_fields: [
          { coord: "P005_L0080", title: "Valor Estimado Global", suggested_target_slot: "SLOT_VALOR" },
        ],
        tables: [
          { table_index: 0, rows: 2, cols: 2, headers: ["Item", "Valor"] },
        ],
      },
    };

    const synthetic = formatInspectDocSyntheticResult(
      longFilePath,
      longOutputPath,
      mockInspection
    );

    const jsonStr = JSON.stringify(synthetic, null, 2);
    const byteLength = Buffer.byteLength(jsonStr, "utf-8");

    // Validações estritas de engenharia
    // 1. Teto absoluto da Lei 2 (< 1024 bytes) e teto seguro do motor (< 900 bytes)
    expect(byteLength).toBeLessThan(900);
    expect(byteLength).toBeLessThan(880);

    // 2. Não deve haver concorrência redundante de docxPath quando filePath está presente
    expect(synthetic.filePath).toBeDefined();
    expect(synthetic.docxPath).toBeUndefined();

    // 3. Os campos vitais continuam presentes e funcionais
    expect(synthetic.status).toBe("success");
    expect(synthetic.template_match?.status).toBe("EXACT");
    expect(synthetic.template_match?.template_id).toBe("ETP_AGU_SERVICOS_COMUNS_V14");
    expect(synthetic.template_match?.slots_count).toBe(24);
  });
});
