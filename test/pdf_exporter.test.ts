import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { resolve } from "node:path";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import {
  convertDocxToPdf,
  convertViaPureJs,
  sanitizeTextForPdf,
  parseDocxBlocks,
} from "../src/utils/pdf_exporter.ts";
import { extractPdfPages } from "../src/utils/pdf.ts";
import { createSampleRawDocx } from "./helpers/fixtures.ts";

describe("Testes Unitários v0.9.5: Pipeline Híbrido de Conversão DOCX para PDF (pdf_exporter)", () => {
  const tempDir = resolve(process.cwd(), "cases", "_test_temp_pdf_exporter");

  beforeAll(() => {
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("1. sanitizeTextForPdf deve sanitizar caracteres especiais e pontuações tipográficas para WinAnsi", () => {
    const raw = '“Relatório” com ‘aspas’, travessão — longo, hífen – médio, bullet • e reticências…';
    const clean = sanitizeTextForPdf(raw);
    expect(clean).toContain('"Relatório"');
    expect(clean).toContain("'aspas'");
    expect(clean).toContain("- longo");
    expect(clean).toContain("- médio");
    expect(clean).toContain("* e reticências...");
  });

  test("2. parseDocxBlocks deve extrair parágrafos, cabeçalhos e tabelas de um arquivo .docx", async () => {
    const docxPath = resolve(tempDir, "sample_blocks.docx");
    await createSampleRawDocx(docxPath);

    const docxBuffer = readFileSync(docxPath);
    const blocks = await parseDocxBlocks(docxBuffer);

    expect(blocks.length).toBeGreaterThan(3);
    const headings = blocks.filter((b) => b.type === "paragraph" && b.isHeading);
    expect(headings.length).toBeGreaterThan(0);

    const tables = blocks.filter((b) => b.type === "table");
    expect(tables.length).toBeGreaterThanOrEqual(1);
    if (tables[0].type === "table") {
      expect(tables[0].rows.length).toBeGreaterThan(0);
      expect(tables[0].rows[0][0]).toContain("Unidade Requisitante");
    }
  });

  test("3. convertDocxToPdf com forceTier: 'purejs' deve gerar PDF válido (%PDF-) e extraível via extractPdfPages", async () => {
    const docxPath = resolve(tempDir, "sample_purejs.docx");
    const pdfPath = resolve(tempDir, "sample_purejs.pdf");
    await createSampleRawDocx(docxPath);

    const result = await convertDocxToPdf(docxPath, pdfPath, {
      forceTier: "purejs",
    });

    expect(result.success).toBe(true);
    expect(result.tierUsed).toBe("purejs");
    expect(result.pdfPath).toBe(pdfPath);
    expect(existsSync(pdfPath)).toBe(true);
    expect(result.byteLength).toBeGreaterThan(500);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);

    // Valida magic bytes %PDF-
    const header = readFileSync(pdfPath).subarray(0, 5).toString("utf-8");
    expect(header).toBe("%PDF-");

    // Valida que o motor de extração de PDF consegue ler o PDF recém-gerado
    const pdfBuffer = readFileSync(pdfPath);
    const extraction = await extractPdfPages(pdfBuffer);
    expect(extraction.pageCount).toBeGreaterThanOrEqual(1);
    expect(extraction.lineCount).toBeGreaterThan(0);

    const allText = extraction.lines.map((l) => l.text).join(" ");
    expect(allText).toContain("ESTUDO");
    expect(allText).toContain("NECESSIDADE");
    expect(allText).toContain("Unidade Requisitante");
  });

  test("4. convertDocxToPdf em modo automático (híbrido) deve selecionar Word COM ou Pure-JS fallback com sucesso", async () => {
    const docxPath = resolve(tempDir, "sample_auto.docx");
    const pdfPath = resolve(tempDir, "sample_auto.pdf");
    await createSampleRawDocx(docxPath);

    const result = await convertDocxToPdf(docxPath, pdfPath);

    expect(result.success).toBe(true);
    expect(["word", "purejs"]).toContain(result.tierUsed);
    expect(existsSync(pdfPath)).toBe(true);

    const header = readFileSync(pdfPath).subarray(0, 5).toString("utf-8");
    expect(header).toBe("%PDF-");
  }, 30000);

  test("5. convertDocxToPdf deve derivar caminho .pdf padrão quando pdfPath é omitido", async () => {
    const docxPath = resolve(tempDir, "default_deriv.docx");
    await createSampleRawDocx(docxPath);

    const result = await convertDocxToPdf(docxPath, undefined, {
      forceTier: "purejs",
    });

    const expectedPdfPath = resolve(tempDir, "default_deriv.pdf");
    expect(result.pdfPath).toBe(expectedPdfPath);
    expect(existsSync(expectedPdfPath)).toBe(true);
  });

  test("6. convertDocxToPdf deve rejeitar com erro claro se o arquivo de origem não existir", async () => {
    const nonExistent = resolve(tempDir, "nao_existe.docx");

    let threw = false;
    try {
      await convertDocxToPdf(nonExistent);
    } catch (err: any) {
      threw = true;
      expect(err.message).toContain("não encontrado");
    }
    expect(threw).toBe(true);
  });
});
