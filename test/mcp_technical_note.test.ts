import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import JSZip from "jszip";
import {
  getMcpToolsDefinition,
  formatTechnicalNoteSyntheticResult,
  generateTechnicalNoteDocx,
  createTechnicalNoteDataFromDiff,
} from "../src/index.ts";
import type { TechnicalNoteData } from "../src/types/index.ts";

const TEST_DIR = resolve("./test_tmp_mcp_note");

async function createMockDocx(
  filePath: string,
  paragraphs: string[]
): Promise<void> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  const pXml = paragraphs
    .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
    .join("");

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${pXml}</w:body>
</w:document>`
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(filePath, buffer);
}

describe("MCP Server Tool: generate_technical_note_docx (Marco 6.2 — Hibridismo e Lei 2)", () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  test("1. Deve registrar a ferramenta generate_technical_note_docx com schema válido e descrições ricas", () => {
    const tools = getMcpToolsDefinition();
    const noteTool = tools.find((t) => t.name === "generate_technical_note_docx");
    expect(noteTool).toBeDefined();
    expect(noteTool!.description).toContain("Antes vs. Depois");
    expect(noteTool!.description).toContain("Quando usar");
    expect(noteTool!.description).toContain("Próximo Passo");
    expect(noteTool!.inputSchema.properties.outputPath).toBeDefined();
    expect(noteTool!.inputSchema.properties.noteJsonPath).toBeDefined();
    expect(noteTool!.inputSchema.properties.oldPath).toBeDefined();
    expect(noteTool!.inputSchema.properties.newPath).toBeDefined();
    expect(noteTool!.inputSchema.properties.outputFormat).toBeDefined();
  });

  test("2. Modo Direto via JSON: deve gerar DOCX a partir de noteJsonPath e formatar retorno sintético < 900 bytes", async () => {
    const noteData: TechnicalNoteData = {
      document_type: "TECHNICAL_NOTE",
      processo_id: "PROC-2026/001",
      orgao_entidade: "ORGAO_CONTRATANTE",
      artefato_auditado: "Termo de Referência v2",
      versao_anterior: "TR_v1.docx",
      versao_nova: "TR_v2.docx",
      resumo_executivo: "Resumo sucinto das alterações realizadas para atendimento às recomendações.",
      contagem: {
        total_alteracoes: 1,
        modificadas: 1,
        incluidas: 0,
        suprimidas: 0,
        apontamentos_saneados: 1,
      },
      quadro_evolucao: [
        {
          id: "EVO-01",
          coordenada: "P04",
          secao_titulo: "Qualificação Técnica",
          tipo_alteracao: "MODIFICACAO",
          redacao_anterior: "Prazo de 10 dias corridos",
          redacao_nova: "Prazo de 15 dias úteis",
          justificativa_tecnica: "Alinhamento aos padrões normativos vigentes.",
          fundamentacao_juridica: "Art. 67 da Lei 14.133/2021.",
        },
      ],
    };

    const jsonPath = join(TEST_DIR, "nota_valida.json");
    writeFileSync(jsonPath, JSON.stringify(noteData, null, 2), "utf-8");

    const outDocx = join(TEST_DIR, "Nota_Direta.docx");
    const res = await generateTechnicalNoteDocx(jsonPath, outDocx);
    expect(existsSync(outDocx)).toBe(true);

    const synthetic = formatTechnicalNoteSyntheticResult(res, TEST_DIR);
    expect(synthetic.status).toBe("success");
    expect(synthetic.document_type).toBe("TECHNICAL_NOTE");
    expect(synthetic.total_changes).toBe(1);

    const byteLen = Buffer.byteLength(JSON.stringify(synthetic), "utf-8");
    expect(byteLen).toBeLessThan(900);
  });

  test("3. Modo Híbrido Comparativo: deve derivar TechnicalNoteData a partir de oldPath e newPath", async () => {
    const oldDocx = join(TEST_DIR, "Base.docx");
    const newDocx = join(TEST_DIR, "Revisado.docx");

    await createMockDocx(oldDocx, [
      "1. DO OBJETO",
      "Contratação de solução de software em prazo de 10 dias corridos.",
    ]);
    await createMockDocx(newDocx, [
      "1. DO OBJETO",
      "Contratação de solução de software em prazo de 15 dias úteis com garantia estendida.",
    ]);

    const { inspectDoc } = await import("../src/tools/inspect.ts");
    const { computeStructuralDiff } = await import("../src/core/structural_diff.ts");

    const oldIns = await inspectDoc(oldDocx, undefined, true);
    const newIns = await inspectDoc(newDocx, undefined, true);
    const diff = computeStructuralDiff(oldIns, newIns, oldDocx, newDocx);

    const noteData = createTechnicalNoteDataFromDiff(diff, oldDocx, newDocx);
    expect(noteData.quadro_evolucao.length).toBeGreaterThan(0);
    expect(noteData.quadro_evolucao[0].tipo_alteracao).toBe("MODIFICACAO");
    expect(noteData.quadro_evolucao[0].diff_chunks).toBeDefined();

    const outDocx = join(TEST_DIR, "Nota_Hibrida.docx");
    const res = await generateTechnicalNoteDocx(noteData, outDocx);
    expect(existsSync(outDocx)).toBe(true);

    const synthetic = formatTechnicalNoteSyntheticResult(res, TEST_DIR);
    const byteLen = Buffer.byteLength(JSON.stringify(synthetic), "utf-8");
    expect(byteLen).toBeLessThan(900);
  });
});
