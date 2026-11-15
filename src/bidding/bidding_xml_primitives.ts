// ============================================================================
// Primitivas OpenXML A4 & Exportação DOCX/PDF: Eixo de Licitação TIC (Gen6)
// docgov-engine v1.6.1 — src/bidding/bidding_xml_primitives.ts
// ============================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { sanitizeXmlString } from "../utils/xml.ts";
import { convertDocxToPdf, resolveOutputPaths, safeUnlink } from "../utils/pdf_exporter.ts";
import { cleanHumanText } from "../tools/audit.ts";

export function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function pDocHeader(kicker: string, title: string, subtitle: string): string {
  return [
    `<w:p><w:pPr><w:spacing w:before="0" w:after="40"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="1E3A8A"/></w:pBdr></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="475569"/></w:rPr><w:t>${esc(cleanHumanText(kicker))}</w:t></w:r></w:p>`,
    `<w:p><w:pPr><w:spacing w:before="140" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="0F172A"/></w:rPr><w:t>${esc(cleanHumanText(title))}</w:t></w:r></w:p>`,
    `<w:p><w:pPr><w:spacing w:before="0" w:after="140"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="475569"/></w:rPr><w:t>${esc(cleanHumanText(subtitle))}</w:t></w:r></w:p>`,
  ].join("\n");
}

export function pHeading(text: string, level: 1 | 2 | 3 = 1): string {
  const sz = level === 1 ? "26" : level === 2 ? "23" : "21";
  const color = level === 1 ? "1E3A8A" : level === 2 ? "1D4ED8" : "334155";
  const before = level === 1 ? "240" : level === 2 ? "180" : "120";
  return `<w:p><w:pPr><w:spacing w:before="${before}" w:after="80"/><w:keepNext/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:color w:val="${color}"/></w:rPr><w:t>${esc(cleanHumanText(text))}</w:t></w:r></w:p>`;
}

export function pBody(text: string, bold = false, italic = false): string {
  const b = bold ? "<w:b/>" : "";
  const i = italic ? "<w:i/>" : "";
  return `<w:p><w:pPr><w:spacing w:before="40" w:after="90" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:r><w:rPr>${b}${i}<w:sz w:val="21"/><w:szCs w:val="21"/><w:color w:val="1F2937"/></w:rPr><w:t>${esc(cleanHumanText(text))}</w:t></w:r></w:p>`;
}

export function pBullet(leadLabel: string, text: string): string {
  return `<w:p><w:pPr><w:spacing w:before="30" w:after="70" w:line="264" w:lineRule="auto"/><w:ind w:left="360"/><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">• ${esc(cleanHumanText(leadLabel))}: </w:t></w:r><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="1F2937"/></w:rPr><w:t>${esc(cleanHumanText(text))}</w:t></w:r></w:p>`;
}

export function pCallout(
  title: string,
  body: string,
  tone: "danger" | "warn" | "info" | "ok" = "info"
): string {
  const styles = {
    danger: { fill: "FEF2F2", border: "B91C1C", titleColor: "991B1B" },
    warn: { fill: "FFFBEB", border: "B45309", titleColor: "92400E" },
    info: { fill: "EFF6FF", border: "1D4ED8", titleColor: "1E3A8A" },
    ok: { fill: "ECFDF5", border: "047857", titleColor: "065F46" },
  }[tone];

  return `<w:tbl>
  <w:tblPr><w:tblW w:w="9072" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="${styles.border}"/><w:left w:val="single" w:sz="24" w:color="${styles.border}"/><w:bottom w:val="single" w:sz="4" w:color="${styles.border}"/><w:right w:val="single" w:sz="4" w:color="${styles.border}"/></w:tblBorders></w:tblPr>
  <w:tblGrid><w:gridCol w:w="9072"/></w:tblGrid>
  <w:tr><w:tc><w:tcPr><w:tcW w:w="9072" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${styles.fill}"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar></w:tcPr>
    <w:p><w:pPr><w:spacing w:before="20" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="${styles.titleColor}"/></w:rPr><w:t>${esc(cleanHumanText(title))}</w:t></w:r></w:p>
    <w:p><w:pPr><w:spacing w:before="0" w:after="20" w:line="264" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="1F2937"/></w:rPr><w:t>${esc(cleanHumanText(body))}</w:t></w:r></w:p>
  </w:tc></w:tr>
</w:tbl>`;
}

export function buildTableXml(
  headers: string[],
  rows: string[][],
  weights?: number[]
): string {
  const totalWidth = 9072;
  const cols = Math.max(headers.length, 1);
  const effectiveWeights =
    weights && weights.length === cols ? weights : headers.map(() => 1);
  const weightSum = effectiveWeights.reduce((acc, w) => acc + Math.max(w, 0.2), 0);
  const colWidths = effectiveWeights.map((w, idx) => {
    if (idx === cols - 1) return 0; // calculado abaixo para fechar exatamente 9072
    return Math.floor((Math.max(w, 0.2) / weightSum) * totalWidth);
  });
  const used = colWidths.slice(0, -1).reduce((a, b) => a + b, 0);
  colWidths[cols - 1] = totalWidth - used;

  const grid = colWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const makeCell = (txt: string, colIdx: number, isHeader = false, rowIdx = 0) => {
    const fill = isHeader ? "1E3A8A" : rowIdx % 2 === 1 ? "F8FAFC" : "FFFFFF";
    const color = isHeader ? "FFFFFF" : "1F2937";
    const b = isHeader ? "<w:b/>" : "";
    const w = colWidths[colIdx] ?? Math.floor(totalWidth / cols);
    const lines = String(txt ?? "—").split(/\r?\n/);
    const paras = lines
      .map(
        (line) =>
          `<w:p><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${b}<w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="${color}"/></w:rPr><w:t>${esc(cleanHumanText(line))}</w:t></w:r></w:p>`
      )
      .join("");
    return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:tcMar><w:top w:w="70" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${paras}</w:tc>`;
  };

  const headerRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headers
    .map((h, idx) => makeCell(h, idx, true, 0))
    .join("")}</w:tr>`;
  const bodyRows = rows
    .map(
      (r, rIdx) =>
        `<w:tr><w:trPr><w:cantSplit/></w:trPr>${headers
          .map((_, cIdx) => makeCell(r[cIdx] ?? "—", cIdx, false, rIdx))
          .join("")}</w:tr>`
    )
    .join("");

  return `<w:tbl><w:tblPr><w:tblW w:w="${totalWidth}" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="94A3B8"/><w:left w:val="single" w:sz="6" w:color="94A3B8"/><w:bottom w:val="single" w:sz="8" w:color="1E3A8A"/><w:right w:val="single" w:sz="6" w:color="94A3B8"/><w:insideH w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:color="CBD5E1"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${headerRow}${bodyRows}</w:tbl>`;
}

export function pSignatureBlock(signatories: string[]): string[] {
  const parts: string[] = [
    `<w:p><w:pPr><w:spacing w:before="280" w:after="180"/><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="334155"/></w:rPr><w:t>MUNICIPIO_GENERICO, ____ de __________________ de ________.</w:t></w:r></w:p>`,
  ];
  for (const sig of signatories) {
    parts.push(
      `<w:p><w:pPr><w:spacing w:before="260" w:after="20"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="1F2937"/></w:rPr><w:t>______________________________________________________________</w:t></w:r></w:p>`,
      `<w:p><w:pPr><w:spacing w:before="0" w:after="100"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="19"/><w:szCs w:val="19"/><w:color w:val="0F172A"/></w:rPr><w:t>${esc(cleanHumanText(sig))}</w:t></w:r></w:p>`
    );
  }
  return parts;
}

export async function emitDocxAndPdf(
  bodyParts: string[],
  outPath: string,
  outputFormat: "docx" | "pdf" | "both"
): Promise<{ docx_path?: string; pdf_path?: string }> {
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyParts.join("\n")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1418"/></w:sectPr></w:body>
</w:document>`;

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(
    parser.parseFromString(sanitizeXmlString(docXml), "application/xml")
  );

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default ContentType="application/vnd.openxmlformats-package.relationships+xml" Extension="rels"/><Default ContentType="application/xml" Extension="xml"/><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" PartName="/word/document.xml"/><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml" PartName="/word/styles.xml"/></Types>`
  );
  zip.folder("_rels")!.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  const word = zip.folder("word")!;
  word.file("document.xml", serialized);
  word.file(
    "styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`
  );

  const buf = (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
  const resolved = resolveOutputPaths(outPath, outputFormat);
  mkdirSync(dirname(resolved.docxPath), { recursive: true });
  writeFileSync(resolved.docxPath, buf);

  let pdfOut: string | undefined;
  if (outputFormat === "pdf" || outputFormat === "both") {
    const res = await convertDocxToPdf(resolved.docxPath, resolved.pdfPath!);
    if (res.success && res.pdfPath) pdfOut = res.pdfPath;
  }
  if (resolved.isExclusivePdf && resolved.tempDocxPath) {
    await safeUnlink(resolved.tempDocxPath);
  }
  return {
    docx_path: resolved.isExclusivePdf ? undefined : resolved.docxPath,
    pdf_path: pdfOut,
  };
}
