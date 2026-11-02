import { describe, test, expect, afterAll } from "bun:test";
import { resolve } from "node:path";
import { existsSync, writeFileSync } from "node:fs";
import {
  handleCallTool,
  formatInspectDocSyntheticResult,
  formatBuildDocxTemplateSyntheticResult,
} from "../src/index.ts";
import type { InspectResult, BuildDocxTemplateResult } from "../src/types/index.ts";
import {
  createSampleRawDocx,
  createSuiteTempDir,
} from "./helpers/fixtures.ts";

describe("Testes Unitários & Regressão MCP: Dispatch de Ferramentas (inspect_doc, build_docx_template)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("mcp_dispatch");

  afterAll(() => {
    cleanup();
  });

  test("1. Deve executar inspect_doc via MCP omitindo outputPath sem erro de undefined.tables", async () => {
    const rawDocxPath = resolve(tempDir, "sample_raw_for_mcp.docx");
    await createSampleRawDocx(rawDocxPath);

    // Invocação padrão MCP omitindo outputPath (cenário real relatado pela suíte .NET)
    const result = await handleCallTool("inspect_doc", {
      filePath: rawDocxPath,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBe(1);
    expect(result.content[0].type).toBe("text");

    const payload = JSON.parse(result.content[0].text);
    expect(payload.status).toBe("success");
    expect(typeof payload.tables).toBe("number");
    expect(payload.tables).toBeGreaterThanOrEqual(1);
    expect(typeof payload.paragraphs).toBe("number");
    expect(typeof payload.rows).toBe("number");
    expect(Array.isArray(payload.toc_summary)).toBe(true);
    expect(payload.toc_summary.length).toBeGreaterThan(0);
    expect(payload.outputPath).toBeUndefined();
    expect(payload.filePath).toBe(rawDocxPath);
  });

  test("2. Deve executar inspect_doc via MCP com outputPath especificado", async () => {
    const rawDocxPath = resolve(tempDir, "sample_raw_for_mcp_with_out.docx");
    const outJsonPath = resolve(tempDir, "estrutura.json");
    await createSampleRawDocx(rawDocxPath);

    const result = await handleCallTool("inspect_doc", {
      filePath: rawDocxPath,
      outputPath: outJsonPath,
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.status).toBe("success");
    expect(payload.outputPath).toBe(outJsonPath);
    expect(existsSync(outJsonPath)).toBe(true);
  });

  test("3. Deve suportar formatInspectDocSyntheticResult com tipagem estrita InspectResult e outputPath undefined", () => {
    const mockInspection: InspectResult = {
      doc_type: "docx",
      tables: [
        {
          index: 0,
          rows: [
            { index: 0, cells: [{ text: "Header" }] },
            { index: 1, cells: [{ text: "Content" }] },
          ],
        },
      ],
      paragraphs: [
        { index: 0, text: "Parágrafo 1" },
        { index: 1, text: "Parágrafo 2" },
      ],
      headers: [],
      footers: [],
      toc_map: {
        sections: [
          { coord: "P0", title: "1. OBJETO DO TERMO DE REFERÊNCIA" },
        ],
        form_fields: [],
        tables: [],
      },
    };

    const synthetic = formatInspectDocSyntheticResult(
      "test.docx",
      undefined,
      mockInspection
    );

    expect(synthetic.status).toBe("success");
    expect(synthetic.tables).toBe(1);
    expect(synthetic.rows).toBe(2);
    expect(synthetic.paragraphs).toBe(2);
    expect(synthetic.toc_summary).toBeDefined();
    expect(synthetic.toc_summary!.length).toBe(1);
    expect(synthetic.outputPath).toBeUndefined();
  });

  test("4. Deve formatar build_docx_template synthetic result sem erro de argumentos ausentes", () => {
    const mockBuildResult: BuildDocxTemplateResult = {
      templatePath: "template.docx",
      applied_slots_count: 5,
      breakdown: {
        sections: 2,
        tables: 2,
        form_fields: 1,
      },
      message: "Template construído com sucesso",
    };

    const synthetic = formatBuildDocxTemplateSyntheticResult(
      "output.docx",
      mockBuildResult
    );

    expect(synthetic.status).toBe("success");
    expect(synthetic.applied_slots_count).toBe(5);
    expect(synthetic.breakdown.sections).toBe(2);
    expect(synthetic.outputPath).toContain("output.docx");
  });
});
