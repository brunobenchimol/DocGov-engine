import { describe, it, expect, afterAll } from "bun:test";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import JSZip from "jszip";
import { extractPdfPages } from "../src/utils/pdf.ts";
import { classifyPdfPage } from "../src/utils/pdf/page_inspector.ts";
import { extractDocxForensicMetaFromBuffer } from "../src/utils/pdf/docx_forensic_meta.ts";
import { inspectDoc } from "../src/tools/inspect.ts";
import { formatInspectDocSyntheticResult } from "../src/tools/inspect/document_pipelines.ts";
import { bootstrapCase } from "../src/tools/bootstrap.ts";

const tempDirs: string[] = [];
function makeTmpDir(prefix = "docgov-unpdf2-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const d of tempDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
});

interface PdfPageSpec {
  lines: string[];
  image?: {
    pixelWidth: number;
    pixelHeight: number;
    drawWidth: number;
    drawHeight: number;
    seed?: number;
  };
}

function buildRichTestPdf(
  pages: PdfPageSpec[],
  meta?: {
    author?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modDate?: string;
    includeSig?: boolean;
  }
): Buffer {
  const objs: Array<{ id: number; body: Buffer }> = [];
  let nextId = 1;
  const catalogId = nextId++;
  const pagesId = nextId++;
  const fontId = nextId++;

  const pageIds: number[] = [];
  const perPageEntries: Array<{
    pageId: number;
    contentId: number;
    imgId?: number;
    spec: PdfPageSpec;
  }> = [];

  for (const spec of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    const imgId = spec.image ? nextId++ : undefined;
    pageIds.push(pageId);
    perPageEntries.push({ pageId, contentId, imgId, spec });
  }

  let infoId: number | undefined;
  if (meta) {
    infoId = nextId++;
  }

  objs.push({
    id: catalogId,
    body: Buffer.from(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`, "latin1"),
  });
  objs.push({
    id: pagesId,
    body: Buffer.from(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
      "latin1"
    ),
  });
  objs.push({
    id: fontId,
    body: Buffer.from(
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
      "latin1"
    ),
  });

  for (const entry of perPageEntries) {
    const { pageId, contentId, imgId, spec } = entry;
    const ops: string[] = [];

    if (spec.image && imgId) {
      const { pixelWidth, pixelHeight, drawWidth, drawHeight, seed = 1 } = spec.image;
      ops.push(`q ${drawWidth} 0 0 ${drawHeight} 20 100 cm /Im1 Do Q`);
      const rgbLen = pixelWidth * pixelHeight * 3;
      const pixels = Buffer.alloc(rgbLen);
      for (let i = 0; i < rgbLen; i += 3) {
        pixels[i] = (seed * 37 + i) % 256;
        pixels[i + 1] = (seed * 73 + i) % 256;
        pixels[i + 2] = (seed * 19 + i) % 256;
      }
      const header = Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgbLen} >>\nstream\n`,
        "latin1"
      );
      const footer = Buffer.from(`\nendstream`, "latin1");
      objs.push({ id: imgId, body: Buffer.concat([header, pixels, footer]) });
    }

    if (spec.lines.length > 0) {
      ops.push("BT", "/F1 10 Tf", "14 TL", "30 760 Td");
      spec.lines.forEach((line, idx) => {
        const safe = line.replace(/[()\\]/g, " ");
        ops.push(idx === 0 ? `(${safe}) Tj` : `T* (${safe}) Tj`);
      });
      ops.push("ET");
    }

    const contentStr = ops.join("\n");
    objs.push({
      id: contentId,
      body: Buffer.from(
        `<< /Length ${Buffer.byteLength(contentStr, "latin1")} >>\nstream\n${contentStr}\nendstream`,
        "latin1"
      ),
    });

    const xobjPart = imgId ? ` /XObject << /Im1 ${imgId} 0 R >>` : "";
    objs.push({
      id: pageId,
      body: Buffer.from(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 ${fontId} 0 R >>${xobjPart} >> /Contents ${contentId} 0 R >>`,
        "latin1"
      ),
    });
  }

  if (infoId && meta) {
    const fields: string[] = [];
    if (meta.author) fields.push(`/Author (${meta.author})`);
    if (meta.creator) fields.push(`/Creator (${meta.creator})`);
    if (meta.producer) fields.push(`/Producer (${meta.producer})`);
    if (meta.creationDate) fields.push(`/CreationDate (${meta.creationDate})`);
    if (meta.modDate) fields.push(`/ModDate (${meta.modDate})`);
    if (meta.includeSig) fields.push(`/Type /Sig /M (D:20261110120000Z)`);
    objs.push({ id: infoId, body: Buffer.from(`<< ${fields.join(" ")} >>`, "latin1") });
  }

  objs.sort((a, b) => a.id - b.id);
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets: number[] = [0];
  let cursor = chunks[0].length;

  for (const o of objs) {
    offsets[o.id] = cursor;
    const head = Buffer.from(`${o.id} 0 obj\n`, "latin1");
    const tail = Buffer.from(`\nendobj\n`, "latin1");
    chunks.push(head, o.body, tail);
    cursor += head.length + o.body.length + tail.length;
  }

  const totalObjs = objs.length + 1;
  let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (let id = 1; id < totalObjs; id++) {
    xref += `${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`;
  }
  const trailerInfo = infoId ? ` /Info ${infoId} 0 R` : "";
  xref += `trailer\n<< /Size ${totalObjs} /Root ${catalogId} 0 R${trailerInfo} >>\nstartxref\n${cursor}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

async function createMinimalDocxBuffer(meta: {
  author: string;
  lastModifiedBy: string;
  created: string;
  modified: string;
  application?: string;
}): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default ContentType="application/xml" Extension="xml"/><Default ContentType="application/vnd.openxmlformats-package.relationships+xml" Extension="rels"/><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" PartName="/word/document.xml"/></Types>`
  );
  zip.folder("_rels")!.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.folder("word")!.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>PROPOSTA COMERCIAL TESTE ORGAO_CONTRATANTE</w:t></w:r></w:p></w:body></w:document>`
  );
  zip.folder("docProps")!.file(
    "core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:title>Minuta Teste</dc:title><dc:creator>${meta.author}</dc:creator><cp:lastModifiedBy>${meta.lastModifiedBy}</cp:lastModifiedBy><cp:revision>3</cp:revision><dcterms:created>${meta.created}</dcterms:created><dcterms:modified>${meta.modified}</dcterms:modified></cp:coreProperties>`
  );
  zip.folder("docProps")!.file(
    "app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>${meta.application || "Microsoft Word"}</Application><Company>ORGAO_A</Company><Template>Normal.dotm</Template></Properties>`
  );
  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

describe("unpdf@2.1.0+ Multimodal Assets, 5 Page Classes & Dual PDF/DOCX Forensics (v1.6.2)", () => {
  it("1. classifyPdfPage deve distinguir estritamente as 5 classes canônicas", () => {
    expect(
      classifyPdfPage({ visibleChars: 600, invisibleTextLength: 0, imageCount: 0, imageCoverage: 0 })
    ).toBe("BORN_DIGITAL");
    expect(
      classifyPdfPage({ visibleChars: 10, invisibleTextLength: 0, imageCount: 1, imageCoverage: 0.72 })
    ).toBe("FULL_PAGE_SCAN");
    expect(
      classifyPdfPage({ visibleChars: 140, invisibleTextLength: 0, imageCount: 1, imageCoverage: 0.61 })
    ).toBe("HYBRID_HEADER_SCAN_TRAP");
    expect(
      classifyPdfPage({ visibleChars: 240, invisibleTextLength: 0, imageCount: 1, imageCoverage: 0.32 })
    ).toBe("EMBEDDED_VISUAL_ASSET");
    expect(
      classifyPdfPage({ visibleChars: 400, invisibleTextLength: 85, imageCount: 1, imageCoverage: 0.50 })
    ).toBe("OCR_LAYER_EMBEDDED");
  });

  it("2. extractPdfPages deve detectar HYBRID_HEADER_SCAN_TRAP, filtrar logos/repetições e extrair PNGs reais + forensic_meta", async () => {
    const pdfBuf = buildRichTestPdf(
      [
        {
          lines: [
            "EDITAL PREGÃO ELETRÔNICO Nº 10/2026 - ORGAO_CONTRATANTE",
            "Documento nato digital integral sem imagem pesada de pagina inteira.",
          ],
        },
        {
          lines: ["Documento assinado eletronicamente SEI/PJe - Processo 001/2026"],
          image: { pixelWidth: 260, pixelHeight: 200, drawWidth: 500, drawHeight: 560, seed: 2 },
        },
        {
          lines: ["Anexo Técnico com diagrama de topologia de rede WAN e vistoria obrigatoria"],
          image: { pixelWidth: 260, pixelHeight: 190, drawWidth: 320, drawHeight: 350, seed: 3 },
        },
        {
          // Logo pequeno (< 220x150) deve ser filtrado como decorativo
          lines: ["Página com logo minúsculo em cabeçalho"],
          image: { pixelWidth: 100, pixelHeight: 80, drawWidth: 500, drawHeight: 580, seed: 4 },
        },
      ],
      {
        author: "Analista_Teste",
        creator: "Canva Free Editor",
        producer: "iLovePDF Merge",
        creationDate: "D:20261101100000Z",
        modDate: "D:20261110120000Z",
        includeSig: true,
      }
    );

    const res = await extractPdfPages(pdfBuf);
    expect(res.pageCount).toBe(4);
    expect(res.hybrid_scan_pages).toContain(2);
    expect(res.scanned_pages_detected).toContain(2);
    expect(res.extracted_images?.length).toBeGreaterThanOrEqual(2);
    expect(res.skipped_decorative_images_count).toBeGreaterThanOrEqual(1);
    expect(res.forensic_meta?.source_format).toBe("pdf");
    expect(res.forensic_meta?.editing_software_traces).toContain("Canva");
    expect(res.forensic_meta?.editing_software_traces).toContain("iLovePDF");
    expect(res.forensic_meta?.forensic_anomalies).toContain("[PDF_EDITOR_MANIPULATION_TRACE]");
    expect(res.forensic_meta?.has_digital_signature).toBe(true);
  });

  it("3. inspectDoc dentro de caso deve materializar PNGs em assets/<stem>/pag_XXX_img_YY.png e injetar âncoras sem estourar 900B", async () => {
    const caseDir = makeTmpDir("docgov-case-assets-");
    const inputsDir = join(caseDir, "inputs");
    const stateDir = join(caseDir, "state");
    mkdirSync(inputsDir, { recursive: true });
    mkdirSync(stateDir, { recursive: true });

    const pdfPath = join(inputsDir, "edital_hibrido.pdf");
    const outJson = join(stateDir, "estrutura_edital_hibrido.json");
    writeFileSync(
      pdfPath,
      buildRichTestPdf([
        {
          lines: ["Tarja SEI 123456 - exigência de vistoria técnica presencial obrigatoria"],
          image: { pixelWidth: 260, pixelHeight: 200, drawWidth: 500, drawHeight: 560, seed: 9 },
        },
      ])
    );

    const inspection = await inspectDoc(pdfPath, outJson, true);
    const expectedAsset = join(caseDir, "assets", "edital_hibrido", "pag_001_img_01.png");
    expect(existsSync(expectedAsset)).toBe(true);
    expect(inspection.extracted_images_manifest?.[0]?.asset_id).toBe("ASSET_IMG_01");

    const auditMd = readFileSync(inspection.audit_view_path!, "utf-8");
    const dossieMd = readFileSync(inspection.dossie_hotspots_path!, "utf-8");
    expect(auditMd).toContain("[PAG_001 | ASSET_IMG_01 | tipo=HYBRID_HEADER_SCAN_TRAP");
    expect(dossieMd).toContain("[PAG_001 | ASSET_IMG_01 | tipo=HYBRID_HEADER_SCAN_TRAP");

    const synthetic = formatInspectDocSyntheticResult(pdfPath, outJson, inspection);
    expect(synthetic.assets_extracted_count).toBe(1);
    expect(synthetic.hybrid_scan_pages_count).toBe(1);
    expect(Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8")).toBeLessThan(900);

    // Fora de caso (ephemeral inspect) deve gerar asset sem falhar
    const outsideDir = makeTmpDir("docgov-outside-");
    const extPdf = join(outsideDir, "avulso.pdf");
    writeFileSync(
      extPdf,
      buildRichTestPdf([
        {
          lines: ["Tarja PJe processo externo"],
          image: { pixelWidth: 260, pixelHeight: 200, drawWidth: 500, drawHeight: 560, seed: 11 },
        },
      ])
    );
    const extRes = await inspectDoc(extPdf, undefined, true);
    expect(existsSync(extRes.extracted_images_manifest?.[0]?.saved_path!)).toBe(true);
  });

  it("4. extractDocxForensicMetaFromBuffer + bootstrapCase deve detectar conluio de Author e emitir alerta no indice_mestre_caso.md", async () => {
    const docxA = await createMinimalDocxBuffer({
      author: "Consultor_Conluio_X",
      lastModifiedBy: "Consultor_Conluio_X",
      created: "2026-11-10T10:00:00Z",
      modified: "2026-11-10T10:05:00Z",
      application: "Microsoft Office Word",
    });
    const docxMeta = await extractDocxForensicMetaFromBuffer(docxA);
    expect(docxMeta.source_format).toBe("docx");
    expect(docxMeta.author).toBe("Consultor_Conluio_X");
    expect(docxMeta.revision_count).toBe(3);

    const rootWs = makeTmpDir("docgov-bs-collusion-");
    const caseDir = join(rootWs, "cases", "licitacao_conluio");
    const inputsDir = join(caseDir, "inputs");
    mkdirSync(inputsDir, { recursive: true });

    writeFileSync(join(inputsDir, "proposta_empresa_alpha.docx"), docxA);
    writeFileSync(
      join(inputsDir, "proposta_empresa_beta.pdf"),
      buildRichTestPdf(
        [{ lines: ["PROPOSTA COMERCIAL EMPRESA BETA LTDA - Valor Global R$ 500.000,00"] }],
        {
          author: "Consultor_Conluio_X",
          creator: "Microsoft Word",
          creationDate: "D:20261110100100Z",
        }
      )
    );

    const bsRes = await bootstrapCase(resolve(caseDir));
    const masterMd = readFileSync(bsRes.indice_mestre_path!, "utf-8");
    expect(masterMd).toContain("### 🔍 Inventário Forense de Metadados (PDF & DOCX) e Cobertura Visual Multimodal");
    expect(masterMd).toContain("Consultor_Conluio_X");
    expect(masterMd).toContain("[BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT]");
  });
});
