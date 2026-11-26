import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import JSZip from "jszip";
import { extractDocxForensicMetaFromBuffer } from "../src/utils/pdf/docx_forensic_meta.ts";
import { extractXlsxForensicMetaFromBuffer } from "../src/utils/pdf/xlsx_forensic_meta.ts";
import {
  detectCrossDocumentForensicCollisions,
  formatCompactForensicMetaMarkdown,
} from "../src/utils/pdf/forensic_cross_audit.ts";
import {
  generatePdfLinearAuditViewMarkdown,
  generateLinearAuditViewMarkdown,
} from "../src/tools/inspect/audit_view_formatter.ts";
import { inspectDocx } from "../src/tools/inspect.ts";
import { bootstrapCase } from "../src/tools/bootstrap.ts";
import { evaluateBiddingProposals } from "../src/bidding/evaluate_bidding_proposals.ts";
import { auditDirectContracting } from "../src/direct_contracting/audit_direct_contracting.ts";

const tempDirs: string[] = [];
function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const d of tempDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  }
});

async function buildSyntheticDocx(opts: {
  author?: string;
  rsidRoot?: string;
  rsidRs?: string[];
}): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">${opts.author ? `<dc:creator>${opts.author}</dc:creator>` : ""}</cp:coreProperties>`
  );
  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>`
  );
  if (opts.rsidRoot !== undefined) {
    zip.file(
      "word/settings.xml",
      `<?xml version="1.0" encoding="UTF-8"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:rsids><w:rsidRoot w:val="${opts.rsidRoot}"/></w:rsids></w:settings>`
    );
  }
  const paragraphs = (opts.rsidRs || ["11223344"])
    .map((r) => `<w:p w:rsidR="${r}"><w:r><w:t>Item de proposta</w:t></w:r></w:p>`)
    .join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

async function buildSyntheticXlsx(opts: {
  author?: string;
  lastModifiedBy?: string;
  company?: string;
}): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`
  );
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>${opts.author || ""}</dc:creator><cp:lastModifiedBy>${opts.lastModifiedBy || ""}</cp:lastModifiedBy></cp:coreProperties>`
  );
  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application><Company>${opts.company || ""}</Company></Properties>`
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Planilha1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>`
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Item</t></is></c></row></sheetData></worksheet>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("Pilar 5.2 & 5.3 (v1.7.0) — Clones w:rsid em DOCX & forensic_meta em XLSX", () => {
  test("1. Ignora w:rsidRoot zerado (00000000), normaliza HEX8 maiúsculo e detecta clone sem Author", async () => {
    const zeroDoc = await buildSyntheticDocx({ rsidRoot: "00000000", rsidRs: ["00000000", "00ab12cd"] });
    const zeroMeta = await extractDocxForensicMetaFromBuffer(zeroDoc);
    expect(zeroMeta.rsid_root).toBeNull();
    expect(zeroMeta.rsid_sample).toEqual(["00AB12CD"]);

    const dir = makeTempDir("docgov-rsid-clone-");
    const docA = join(dir, "proposta_empresa_a.docx");
    const docB = join(dir, "proposta_empresa_b.docx");
    writeFileSync(docA, await buildSyntheticDocx({ rsidRoot: "00af1234", rsidRs: ["00AF1234", "00AF1235"] }));
    writeFileSync(docB, await buildSyntheticDocx({ rsidRoot: "00AF1234", rsidRs: ["00AF1234", "00AF9999"] }));

    const evalRes = await evaluateBiddingProposals(
      {
        process_id: "PROC-RSID-CLONE",
        competing_proposals_meta: [
          { bidder_name: "EMPRESA_A", proposal_pdf_path: docA },
          { bidder_name: "EMPRESA_B", proposal_pdf_path: docB },
        ],
      },
      { outputDir: dir, compilationMode: "NONE" }
    );
    expect(evalRes.dossier.decision).toBe("REJECTED");
    expect(evalRes.dossier.blocking_tags).toContain("[FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK]");
  });

  test("2. Detecta sobreposição elevada de w:rsidR mesmo com w:rsidRoot diferente e Author apagado", async () => {
    const metaA = await extractDocxForensicMetaFromBuffer(
      await buildSyntheticDocx({ rsidRoot: "11111111", rsidRs: ["00AA0001", "00AA0002", "00AA0003", "00AA0004"] })
    );
    const metaB = await extractDocxForensicMetaFromBuffer(
      await buildSyntheticDocx({ rsidRoot: "22222222", rsidRs: ["00AA0001", "00AA0002", "00AA0003", "00BB9999"] })
    );
    const collisions = detectCrossDocumentForensicCollisions([
      { fileName: "a.docx", forensicMeta: metaA },
      { fileName: "b.docx", forensicMeta: metaB },
    ]);
    expect(collisions.some((c) => c.code === "FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK")).toBe(true);
  });

  test("3. inspectDocx e bootstrapCase extraem forensic_meta de XLSX e exibem na Tabela Forense", async () => {
    const tmpRoot = makeTempDir("docgov-xlsx-boot-");
    const caseDir = join(tmpRoot, "cases", "caso_xlsx_forense");
    const inputsDir = join(caseDir, "inputs");
    mkdirSync(inputsDir, { recursive: true });
    const xlsx1 = join(inputsDir, "cotacao_fornecedor_1.xlsx");
    const xlsx2 = join(inputsDir, "cotacao_fornecedor_2.xlsx");
    writeFileSync(xlsx1, await buildSyntheticXlsx({ author: "Fulano Planilhas", company: "Consultoria Alfa" }));
    writeFileSync(xlsx2, await buildSyntheticXlsx({ author: "Fulano Planilhas", company: "Consultoria Alfa" }));

    const inspected = await inspectDocx(xlsx1);
    expect(inspected.forensic_meta?.source_format).toBe("xlsx");
    expect(inspected.forensic_meta?.author).toBe("Fulano Planilhas");

    const boot = await bootstrapCase(caseDir, { cleanupMode: "none" });
    expect(boot.indice_mestre_path).toBeDefined();
    const indexMd = readFileSync(boot.indice_mestre_path!, "utf-8");
    expect(indexMd).toContain("Inventário Forense de Metadados (PDF, DOCX & XLSX)");
    expect(indexMd).toContain("cotacao_fornecedor_1.xlsx");
    expect(indexMd).toContain("PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK");
  });

  test("4. Conluio em cotações XLSX aciona bloqueio em auditDirectContracting e evaluateBiddingProposals", async () => {
    const dir = makeTempDir("docgov-xlsx-direct-");
    const q1 = join(dir, "cotacao_1.xlsx");
    const q2 = join(dir, "cotacao_2.xlsx");
    writeFileSync(q1, await buildSyntheticXlsx({ author: "Operador Unico" }));
    writeFileSync(q2, await buildSyntheticXlsx({ author: "Operador Unico" }));

    const directRes = await auditDirectContracting(
      {
        process_id: "PROC-XLSX-DIR",
        contracting_modality: "INEXIGIBILIDADE",
        quotations_forensic_meta: [
          { quotation_id: "Q1", file_name: "cotacao_fornecedor_1.xlsx", pdf_path: q1 },
          { quotation_id: "Q2", file_name: "cotacao_fornecedor_2.xlsx", pdf_path: q2 },
        ],
        inexigibility_details: {
          competition_infeasibility_proven: true,
          exclusivity_certificate: { provided: true, sumula_255_tcu_verified: true },
          supplier_market_price_proofs: [
            { identifier: "NF-1", unit_price: 100 },
            { identifier: "NF-2", unit_price: 100 },
            { identifier: "NF-3", unit_price: 100 },
          ],
        },
      },
      { outputDir: dir, compilationMode: "NONE" }
    );
    expect(directRes.dossier.blocking_tags).toContain("[PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK]");

    const xlsxMeta = await extractXlsxForensicMetaFromBuffer(readFileSync(q1));
    expect(xlsxMeta.source_format).toBe("xlsx");
    expect(xlsxMeta.author).toBe("Operador Unico");
  });

  test("5. Polimento R4: bloco compacto forensic_meta no topo de visao_auditoria_*.md (PDF, DOCX e XLSX)", async () => {
    const dir = makeTempDir("docgov-visao-forensic-");
    const xlsxPath = join(dir, "planilha_r4.xlsx");
    const docxPath = join(dir, "minuta_r4.docx");
    writeFileSync(xlsxPath, await buildSyntheticXlsx({ author: "Perito XLSX R4" }));
    writeFileSync(docxPath, await buildSyntheticDocx({ rsidRoot: "1234ABCD", rsidRs: ["1234ABCD", "AABB1122"], author: "Perito DOCX R4" }));

    const xlsxRes = await inspectDocx(xlsxPath, undefined, true);
    if (xlsxRes.audit_view_path) tempDirs.push(dirname(xlsxRes.audit_view_path));
    const xlsxMd = readFileSync(xlsxRes.audit_view_path!, "utf-8");
    expect(xlsxMd).toContain("## 🔍 Resumo Forense de Metadados (`forensic_meta`)");
    expect(xlsxMd).toContain("`.xlsx`");
    expect(xlsxMd).toContain("**Author:** Perito XLSX R4");

    const docxRes = await inspectDocx(docxPath, undefined, true);
    if (docxRes.audit_view_path) tempDirs.push(dirname(docxRes.audit_view_path));
    const docxMd = readFileSync(docxRes.audit_view_path!, "utf-8");
    expect(docxMd).toContain("## 🔍 Resumo Forense de Metadados (`forensic_meta`)");
    expect(docxMd).toContain("`.docx`");
    expect(docxMd).toContain("`rsid_root=1234ABCD`");
    expect(docxMd).toContain("`rsid_unique_count=2`");

    const pdfMd = generatePdfLinearAuditViewMarkdown(
      "certidao_r4.pdf",
      {
        pageCount: 1,
        lineCount: 1,
        pages: [{ pageNumber: 1, lines: [{ bracket_coord: "[PAG_001 | L0001]", text: "Conteúdo" }] }],
        lines: [{ bracket_coord: "[PAG_001 | L0001]", text: "Conteúdo" }],
        forensic_meta: {
          source_format: "pdf",
          title: null,
          author: "Autor PDF R4",
          last_modified_by: null,
          creator_tool: "Writer",
          producer: "LibreOffice",
          company: null,
          template: null,
          revision_count: null,
          creation_date_iso: "2026-10-01T10:00:00Z",
          mod_date_iso: "2026-10-02T10:00:00Z",
          has_digital_signature: true,
          signature_date_iso: null,
          editing_software_traces: [],
          forensic_anomalies: [],
          pades_signatures: [
            {
              signature_index: 0,
              byte_range: [0, 100, 200, 300],
              covers_eof: true,
              post_signature_bytes: 0,
              post_signature_classification: "NONE",
              digest_verified: true,
              subject_cn: "SIGNATARIO R4",
              issuer_cn: "AC Final do Governo Federal do Brasil v1",
              subject_dn: "CN=SIGNATARIO R4",
              issuer_dn: "CN=AC Final do Governo Federal do Brasil v1",
              icp_brasil_cpf: "12345678901",
              icp_brasil_cnpj: null,
              not_before_iso: null,
              not_after_iso: null,
              is_self_signed: false,
              is_trusted_icp_chain: true,
              anomalies: [],
            },
          ],
        },
      },
      { outline_headings: [], page_signals: [], impugnation_zones: [] }
    );
    expect(pdfMd).toContain("## 🔍 Resumo Forense de Metadados (`forensic_meta`)");
    expect(pdfMd).toContain("Assinaturas PAdES (1)");
    expect(pdfMd).toContain("`#0`: CN=`SIGNATARIO R4` | AC=`AC Final do Governo Federal do Brasil v1` | CPF=12345678901 | trusted_icp=`true` | digest=`true`");
    expect(formatCompactForensicMetaMarkdown(null)).toEqual([]);
    expect(generateLinearAuditViewMarkdown("doc_sem_meta.docx", { headers: [], footers: [], paragraphs: [], tables: [] })).not.toContain("Resumo Forense");
  });
});
