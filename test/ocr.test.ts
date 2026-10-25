import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { executeHeadlessOcr } from "../src/core/ocr.ts";
import { extractPdfPages } from "../src/utils/pdf.ts";
import { inspectDoc, formatInspectDocSyntheticResult } from "../src/tools/inspect.ts";

describe("Pipeline OCR Headless para PDFs Escaneados (Marco 5.3)", () => {
  const tmpDir = resolve("./test/fixtures/tmp_ocr_test");

  beforeEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("1. executeHeadlessOcr deve extrair texto de streams gráficos e metadados de página escaneada", async () => {
    // PDF sintético que simula documento escaneado (sem operadores de texto visíveis, com camada OCR embutida nos metadados do stream)
    const mockScannedPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 120 >>
stream
q
/Im1 Do
Q
% OCR_PAGE_1: CLÁUSULA TERCEIRA - EXIGÊNCIA DE ATESTADO DE CAPACIDADE TÉCNICA COM REGISTRO EM CARTÓRIO
% OCR_PAGE_1: Item | Descrição | Qtd | Valor Unitário | Valor Total
% OCR_PAGE_1: 1 | Licença de Software | 5 | R$ 1.000,00 | R$ 5.000,00
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
420
%%EOF`;

    const buffer = Buffer.from(mockScannedPdf, "latin1");
    const ocrMap = await executeHeadlessOcr(buffer, [1]);

    expect(ocrMap.has(1)).toBe(true);
    const lines = ocrMap.get(1)!;
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toContain("CLÁUSULA TERCEIRA");
    expect(lines[1]).toContain("Item | Descrição");
  });

  it("2. extractPdfPages deve detectar Scanned Trap, acionar OCR headless e injetar coordenadas [PAG_001 | LYYYY]", async () => {
    const mockScannedPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 120 >>
stream
q
/Im1 Do
Q
% PAGE_1_OCR: CLÁUSULA QUINTA - VISTORIA OBRIGATÓRIA SEM SALVAGUARDA DE DECLARAÇÃO FORMAL
% PAGE_1_OCR: O licitante deverá comparecer obrigatoriamente para visita técnica prévia.
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
420
%%EOF`;

    const buffer = Buffer.from(mockScannedPdf, "latin1");
    const extraction = await extractPdfPages(buffer);

    expect(extraction.scanned_pages_detected).toBeDefined();
    expect(extraction.scanned_pages_detected).toContain(1);
    expect(extraction.ocr_applied).toBe(true);
    expect(extraction.ocr_pages).toContain(1);
    expect(extraction.lines.length).toBeGreaterThanOrEqual(2);

    // Coordenadas homogêneas [PAG_001 | L0001]
    expect(extraction.lines[0].bracket_coord).toBe("[PAG_001 | L0001]");
    expect(extraction.lines[0].text).toContain("CLÁUSULA QUINTA");
  });

  it("3. inspectDoc deve submeter linhas OCR ao Radar das 14 Zonas (Z4 Vistoria) e gerar visao_auditoria com badge OCR", async () => {
    const mockScannedPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 150 >>
stream
q
/Im1 Do
Q
% PAGE_1_OCR: CLÁUSULA SEXTA - DA VISTORIA TÉCNICA
% PAGE_1_OCR: É obrigatória a visita técnica no local com atestado emitido exclusivamente pelo órgão.
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
420
%%EOF`;

    const pdfPath = resolve(tmpDir, "edital_escaneado.pdf");
    const outStructurePath = resolve(tmpDir, "estrutura_escaneado.json");
    writeFileSync(pdfPath, Buffer.from(mockScannedPdf, "latin1"));

    const full = await inspectDoc(pdfPath, outStructurePath);
    expect(full.doc_type).toBe("pdf");
    expect(full.ocr_applied).toBe(true);
    expect(full.ocr_pages).toContain(1);

    // Valida que o Radar Z4 (Vistoria Técnica) identificou os termos da camada OCR recuperada!
    expect(full.impugnation_zones).toBeDefined();
    const z4 = full.impugnation_zones?.Z4_VISTORIA_VISITA_TECNICA;
    expect(z4).toBeDefined();
    expect(z4!.length).toBeGreaterThan(0);

    // Valida visão de auditoria
    const auditViewPath = full.audit_view_path || resolve(tmpDir, "visao_auditoria_escaneado.md");
    expect(existsSync(auditViewPath)).toBe(true);
    const auditMd = readFileSync(auditViewPath, "utf-8");
    expect(auditMd).toContain("PIPELINE OCR HEADLESS APLICADO");

    // Valida teto MCP (< 900 bytes)
    const synthetic = formatInspectDocSyntheticResult(pdfPath, outStructurePath, full);
    const bytes = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(bytes).toBeLessThan(900);
    expect(synthetic.ocr_applied).toBe(true);
  });
});
