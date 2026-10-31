import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { isPdfBuffer, extractPdfPages } from "../../utils/pdf.ts";
import {
  buildPdfCartography,
  buildDocxCartography,
  generateHotspotsDossierMarkdown,
  type IndexedLineEntry,
} from "../../core/cartography.ts";
import {
  auditDocumentBudget,
  injectBudgetAuditIntoImpugnationZones,
  formatBudgetAuditMarkdownBlock,
} from "../../core/budget_auditor.ts";
import {
  parseXlsxBuffer,
  parseCsvBuffer,
  generateSpreadsheetLinearAuditViewMarkdown,
  generateSpreadsheetHotspotsDossierMarkdown,
} from "../../parsers/spreadsheet.ts";
import { getEphemeralInspectDir } from "../../utils/paths.ts";
import type {
  BodyParagraphInfo,
  DocxTocMap,
  DocxInspectionResult,
  PdfExtractionResult,
} from "../../types/index.ts";
import {
  buildTocMap,
  generatePdfLinearAuditViewMarkdown,
  generateTextLinearAuditViewMarkdown,
} from "./audit_view_formatter.ts";

export async function inspectSpreadsheetDocument(
  resolvedDocx: string,
  buffer: Buffer,
  outputPath?: string,
  inScope?: boolean,
  options: { skipAuditArtifacts?: boolean } = {}
): Promise<DocxInspectionResult> {
  const isCsv = resolvedDocx.toLowerCase().endsWith(".csv");
  const extraction = isCsv
    ? parseCsvBuffer(buffer)
    : await parseXlsxBuffer(buffer);

  const budgetAudit = auditDocumentBudget({ docxTables: extraction.tables });
  const baseStem = outputPath
    ? basename(resolve(outputPath), ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      )
    : basename(resolvedDocx).replace(/\.(?:xlsx|xls|csv)$/i, "");

  const outDir = inScope
    ? (outputPath ? dirname(resolve(outputPath)) : dirname(resolvedDocx))
    : getEphemeralInspectDir();

  const targetOutputPath = inScope
    ? (outputPath ? resolve(outputPath) : undefined)
    : resolve(
        outDir,
        outputPath ? basename(outputPath) : `estrutura_${baseStem}.json`
      );

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const auditViewPath = resolve(outDir, `visao_auditoria_${baseStem}.md`);
  const dossieHotspotsPath = resolve(outDir, `dossie_hotspots_${baseStem}.md`);
  const budgetAuditPath = resolve(
    outDir,
    `auditoria_orcamentaria_${baseStem}.json`
  );

  if (!options.skipAuditArtifacts) {
    let auditMd = generateSpreadsheetLinearAuditViewMarkdown(
      basename(resolvedDocx),
      extraction
    );
    if (budgetAudit.has_budget_table) {
      auditMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
    }
    writeFileSync(auditViewPath, auditMd, "utf-8");

    let dossieMd = generateSpreadsheetHotspotsDossierMarkdown(
      basename(resolvedDocx),
      extraction
    );
    if (budgetAudit.has_budget_table) {
      dossieMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
      writeFileSync(budgetAuditPath, JSON.stringify(budgetAudit, null, 2), "utf-8");
    }
    writeFileSync(dossieHotspotsPath, dossieMd, "utf-8");
  }

  const toc_map: DocxTocMap = {
    sections: extraction.sheets.map((s) => ({
      coord: `ABA_${s.index + 1}`,
      title: s.name,
    })),
    form_fields: [],
    tables: extraction.tables.map((t) => ({
      table_index: t.index,
      rows: t.rows.length,
      cols: t.rows[0]?.cells.length ?? 0,
      headers: t.rows[0]?.cells.map((c) => c.text) ?? [],
      sample_row_coord: t.rows.length > 1 ? `T${t.index}.R1` : undefined,
    })),
  };

  const result: DocxInspectionResult = {
    doc_type: isCsv ? "csv" : "xlsx",
    format: extraction.format,
    page_count: extraction.sheets.length,
    line_count: extraction.totalRows,
    ...(options.skipAuditArtifacts ? {} : {
      audit_view_path: auditViewPath,
      dossie_hotspots_path: dossieHotspotsPath,
    }),
    headers: [],
    footers: [],
    paragraphs: [],
    tables: extraction.tables,
    toc_map,
    budget_audit: budgetAudit,
  };

  if (targetOutputPath) {
    writeFileSync(targetOutputPath, JSON.stringify(result, null, 2), "utf-8");
  }

  return result;
}

export async function inspectPdfDocument(
  resolvedDocx: string,
  buffer: Buffer,
  outputPath?: string,
  inScope?: boolean,
  options: { compareWithPath?: string; skipAuditArtifacts?: boolean } = {}
): Promise<DocxInspectionResult> {
  if (!isPdfBuffer(buffer)) {
    throw new Error(
      `Arquivo .pdf inválido (Magic Bytes '%PDF-' ausentes): ${resolvedDocx}`
    );
  }

  const extraction = await extractPdfPages(buffer);
  const cartography = buildPdfCartography(extraction);
  const baseStem = outputPath
    ? basename(resolve(outputPath), ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      )
    : basename(resolvedDocx).replace(/\.pdf$/i, "");

  const outDir = inScope
    ? (outputPath ? dirname(resolve(outputPath)) : dirname(resolvedDocx))
    : getEphemeralInspectDir();

  const targetOutputPath = inScope
    ? (outputPath ? resolve(outputPath) : undefined)
    : resolve(
        outDir,
        outputPath ? basename(outputPath) : `estrutura_${baseStem}.json`
      );

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const budgetAudit = auditDocumentBudget({ pdfLines: extraction.lines });
  if (budgetAudit.has_budget_table) {
    injectBudgetAuditIntoImpugnationZones(
      budgetAudit,
      cartography.impugnation_zones
    );

    if (!options.skipAuditArtifacts) {
      const budgetAuditPath = resolve(
        outDir,
        `auditoria_orcamentaria_${baseStem}.json`
      );
      writeFileSync(budgetAuditPath, JSON.stringify(budgetAudit, null, 2), "utf-8");
    }
  }

  let auditViewPath: string | undefined;
  let dossieHotspotsPath: string | undefined;

  if (!options.skipAuditArtifacts) {
    auditViewPath = resolve(outDir, `visao_auditoria_${baseStem}.md`);
    let auditMd = generatePdfLinearAuditViewMarkdown(
      basename(resolvedDocx),
      extraction,
      cartography
    );
    if (budgetAudit.has_budget_table) {
      auditMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
    }
    writeFileSync(auditViewPath, auditMd, "utf-8");

    dossieHotspotsPath = resolve(outDir, `dossie_hotspots_${baseStem}.md`);
    let dossieMd = generateHotspotsDossierMarkdown(
      basename(resolvedDocx),
      extraction,
      cartography
    );
    if (budgetAudit.has_budget_table) {
      dossieMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
    }
    writeFileSync(dossieHotspotsPath, dossieMd, "utf-8");
  }

  const toc_map: DocxTocMap = {
    sections: cartography.outline_headings.map((h) => ({
      coord: h.coord,
      title: h.title,
    })),
    form_fields: [],
    tables: [],
  };

  const paragraphs: BodyParagraphInfo[] = extraction.lines.map((l, idx) => ({
    index: idx,
    style: null,
    text: `${l.bracket_coord} ${l.text}`,
  }));

  const pdfResult: DocxInspectionResult = {
    doc_type: "pdf",
    page_count: extraction.pageCount,
    line_count: extraction.lineCount,
    outline_headings: cartography.outline_headings,
    page_signals: cartography.page_signals,
    impugnation_zones: cartography.impugnation_zones,
    toc_map,
    ...(auditViewPath ? { audit_view_path: auditViewPath } : {}),
    ...(dossieHotspotsPath ? { dossie_hotspots_path: dossieHotspotsPath } : {}),
    ...(extraction.scanned_pages_detected
      ? { scanned_pages_detected: extraction.scanned_pages_detected }
      : {}),
    ...(extraction.ocr_applied
      ? { ocr_applied: true, ocr_pages: extraction.ocr_pages }
      : {}),
    headers: [],
    footers: [],
    paragraphs,
    tables,
    ...(budgetAudit.has_budget_table ? { budget_audit: budgetAudit } : {}),
  };

  if (targetOutputPath) {
    writeFileSync(targetOutputPath, JSON.stringify(pdfResult, null, 2), "utf-8");
  }

  return pdfResult;
}

export async function inspectTextOrMarkdownDocument(
  resolvedDocx: string,
  buffer: Buffer,
  outputPath?: string,
  compact: boolean = false,
  inScope?: boolean,
  options: { compareWithPath?: string; skipAuditArtifacts?: boolean } = {}
): Promise<DocxInspectionResult> {
  const isMd =
    resolvedDocx.toLowerCase().endsWith(".md") ||
    resolvedDocx.toLowerCase().endsWith(".markdown");
  const textContent = buffer.toString("utf-8");
  const rawLines = textContent.split(/\r?\n/);

  const paragraphs: BodyParagraphInfo[] = rawLines.map((line, idx) => {
    const trimmed = line.trim();
    let style: string | null = null;
    let text = trimmed;

    const mdHeadingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (mdHeadingMatch) {
      const level = mdHeadingMatch[1].length;
      style = `Heading ${level}`;
      text = mdHeadingMatch[2].trim();
    } else if (
      /^(?:(?:\d+(?:\.\d+)*|[A-Z]|\b[IVXLCDM]+\b)[\.\-\)\s]|CL[ÁA]USULA|SE[ÇC][ãA]O|CAP[IÍ]TULO|ANEXO)\s+[A-ZÀ-Ú0-9]/i.test(
        trimmed
      ) ||
      /^(?:ESTUDO T[EÉ]CNICO PRELIMINAR|TERMO DE REFER[EÊ]NCIA|PROJETO B[AÁ]SICO|JUSTIFICATIVA|OBJETO|DISPOSI[ÇC][ÕO]ES)\b/i.test(
        trimmed
      )
    ) {
      style = "Heading 1";
    }

    return {
      part: "text",
      index: idx,
      paragraphIndex: idx,
      style,
      text,
    };
  });

  const toc_map = buildTocMap(paragraphs, []);
  const cartography = buildDocxCartography(paragraphs, [], toc_map);
  const baseStem = outputPath
    ? basename(resolve(outputPath), ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      )
    : basename(resolvedDocx).replace(/\.(?:md|markdown|txt|text|log)$/i, "");

  const outDir = inScope
    ? (outputPath ? dirname(resolve(outputPath)) : dirname(resolvedDocx))
    : getEphemeralInspectDir();

  const targetOutputPath = inScope
    ? (outputPath ? resolve(outputPath) : undefined)
    : resolve(
        outDir,
        outputPath ? basename(outputPath) : `estrutura_${baseStem}.json`
      );

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const auditViewPath = resolve(outDir, `visao_auditoria_${baseStem}.md`);
  const dossieHotspotsPath = resolve(outDir, `dossie_hotspots_${baseStem}.md`);

  if (!options.skipAuditArtifacts) {
    const auditMd = generateTextLinearAuditViewMarkdown(
      basename(resolvedDocx),
      paragraphs,
      cartography,
      isMd
    );
    writeFileSync(auditViewPath, auditMd, "utf-8");
  }

  const textLines: IndexedLineEntry[] = paragraphs.map((p) => ({
    coord: `[P${p.index}]`,
    text: p.text,
    line: p.index + 1,
    isExplicitHeading: Boolean(p.style && p.style.startsWith("Heading")),
  }));

  const fakeExtraction: PdfExtractionResult = {
    pageCount: Math.max(1, Math.ceil(paragraphs.length / 45)),
    lineCount: paragraphs.length,
    lines: textLines,
  };

  if (!options.skipAuditArtifacts) {
    const dossieMd = generateHotspotsDossierMarkdown(
      basename(resolvedDocx),
      fakeExtraction,
      cartography
    );
    writeFileSync(dossieHotspotsPath, dossieMd, "utf-8");
  }

  const textResult: DocxInspectionResult = {
    doc_type: isMd ? "markdown" : "text",
    format: isMd ? "markdown" : "plain_text",
    page_count: fakeExtraction.pageCount,
    line_count: paragraphs.length,
    ...(options.skipAuditArtifacts ? {} : {
      audit_view_path: auditViewPath,
      dossie_hotspots_path: dossieHotspotsPath,
    }),
    cartography,
    headers: [],
    footers: [],
    paragraphs: compact ? paragraphs.filter((p) => p.text.length > 0) : paragraphs,
    tables: [],
    toc_map,
  };

  if (targetOutputPath) {
    writeFileSync(targetOutputPath, JSON.stringify(textResult, null, 2), "utf-8");
  }

  return textResult;
}
