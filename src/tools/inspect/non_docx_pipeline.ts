import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { isPdfBuffer, extractPdfPages } from "../../utils/pdf.ts";
import { materializeExtractedPdfImages } from "../../utils/pdf/forensic_cross_audit.ts";
import { extractXlsxForensicMetaFromBuffer } from "../../utils/pdf/xlsx_forensic_meta.ts";
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
import { resolveInspectOutputDir } from "../../utils/ephemeral_scope.ts";
import type {
  BodyParagraphInfo,
  DocxTocMap,
  DocxInspectionResult,
  PdfExtractionResult,
} from "../../types/index.ts";
import {
  buildTocMap,
  generatePdfLinearAuditViewMarkdown,
} from "./audit_view_formatter.ts";
export { inspectTextOrMarkdownDocument } from "./text_markdown_pipeline.ts";
import {
  attachTransientInspectMarkdown,
  writeOrDeferMarkdownArtifact,
} from "./markdown_artifacts.ts";

export async function inspectSpreadsheetDocument(
  resolvedDocx: string,
  buffer: Buffer,
  outputPath?: string,
  inScope?: boolean,
  options: {
    skipAuditArtifacts?: boolean;
    skipOutputWrite?: boolean;
    deferMarkdownWrite?: boolean;
    resolvedOutDir?: string;
    resolvedTargetOutputPath?: string;
  } = {}
): Promise<DocxInspectionResult> {
  const isCsv = resolvedDocx.toLowerCase().endsWith(".csv");
  const extraction = isCsv
    ? parseCsvBuffer(buffer)
    : await parseXlsxBuffer(buffer);
  let xlsxForensicMeta = undefined;
  if (!isCsv && buffer.length > 30 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    try {
      xlsxForensicMeta = await extractXlsxForensicMetaFromBuffer(buffer);
    } catch {
      xlsxForensicMeta = undefined;
    }
  }

  const budgetAudit = auditDocumentBudget({ docxTables: extraction.tables });
  const baseStem = outputPath
    ? basename(resolve(outputPath), ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      )
    : basename(resolvedDocx).replace(/\.(?:xlsx|xls|csv)$/i, "");

  const scopeOut = options.skipOutputWrite
    ? { outDir: dirname(resolvedDocx), targetOutputPath: undefined }
    : options.resolvedOutDir
    ? {
        outDir: options.resolvedOutDir,
        targetOutputPath: options.resolvedTargetOutputPath,
      }
    : resolveInspectOutputDir({
        resolvedSource: resolvedDocx,
        outputPath,
        inScope: Boolean(inScope),
        baseStem,
        prefix: "inspect",
      });
  const outDir = scopeOut.outDir;
  const targetOutputPath = scopeOut.targetOutputPath;

  if (!options.skipOutputWrite && !existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const auditViewPath = resolve(outDir, `visao_auditoria_${baseStem}.md`);
  const dossieHotspotsPath = resolve(outDir, `dossie_hotspots_${baseStem}.md`);
  const budgetAuditPath = resolve(
    outDir,
    `auditoria_orcamentaria_${baseStem}.json`
  );

  let transientAuditMd: string | undefined;
  let transientDossieMd: string | undefined;
  if (!options.skipAuditArtifacts) {
    let auditMd = generateSpreadsheetLinearAuditViewMarkdown(
      basename(resolvedDocx),
      extraction,
      xlsxForensicMeta
    );
    if (budgetAudit.has_budget_table) {
      auditMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
    }
    writeOrDeferMarkdownArtifact(auditViewPath, auditMd, options.deferMarkdownWrite);
    transientAuditMd = auditMd;

    let dossieMd = generateSpreadsheetHotspotsDossierMarkdown(
      basename(resolvedDocx),
      extraction
    );
    if (budgetAudit.has_budget_table) {
      dossieMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
      writeFileSync(budgetAuditPath, JSON.stringify(budgetAudit, null, 2), "utf-8");
    }
    writeOrDeferMarkdownArtifact(dossieHotspotsPath, dossieMd, options.deferMarkdownWrite);
    transientDossieMd = dossieMd;
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
    ...(xlsxForensicMeta ? { forensic_meta: xlsxForensicMeta } : {}),
  };

  if (transientAuditMd !== undefined || transientDossieMd !== undefined) {
    attachTransientInspectMarkdown(result, transientAuditMd, transientDossieMd);
  }
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
  options: {
    compareWithPath?: string;
    skipAuditArtifacts?: boolean;
    skipOutputWrite?: boolean;
    deferMarkdownWrite?: boolean;
    resolvedOutDir?: string;
    resolvedTargetOutputPath?: string;
  } = {}
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

  const scopeOut = options.skipOutputWrite
    ? { outDir: dirname(resolvedDocx), targetOutputPath: undefined }
    : options.resolvedOutDir
    ? {
        outDir: options.resolvedOutDir,
        targetOutputPath: options.resolvedTargetOutputPath,
      }
    : resolveInspectOutputDir({
        resolvedSource: resolvedDocx,
        outputPath,
        inScope: Boolean(inScope),
        baseStem,
        prefix: "inspect",
      });
  const outDir = scopeOut.outDir;
  const targetOutputPath = scopeOut.targetOutputPath;

  if (!options.skipOutputWrite && !existsSync(outDir)) {
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
  let extractedImagesManifest =
    !options.skipOutputWrite &&
    extraction.extracted_images &&
    extraction.extracted_images.length > 0
      ? materializeExtractedPdfImages({
          extractedImages: extraction.extracted_images,
          outDir,
          inScope,
          baseStem,
        })
      : undefined;

  let transientPdfAuditMd: string | undefined;
  let transientPdfDossieMd: string | undefined;
  if (!options.skipAuditArtifacts) {
    auditViewPath = resolve(outDir, `visao_auditoria_${baseStem}.md`);
    let auditMd = generatePdfLinearAuditViewMarkdown(
      basename(resolvedDocx),
      extraction,
      cartography,
      extractedImagesManifest
    );
    if (budgetAudit.has_budget_table) {
      auditMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
    }
    writeOrDeferMarkdownArtifact(auditViewPath, auditMd, options.deferMarkdownWrite);
    transientPdfAuditMd = auditMd;

    dossieHotspotsPath = resolve(outDir, `dossie_hotspots_${baseStem}.md`);
    let dossieMd = generateHotspotsDossierMarkdown(
      basename(resolvedDocx),
      extraction,
      cartography,
      extractedImagesManifest
    );
    if (budgetAudit.has_budget_table) {
      dossieMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
    }
    writeOrDeferMarkdownArtifact(dossieHotspotsPath, dossieMd, options.deferMarkdownWrite);
    transientPdfDossieMd = dossieMd;
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
    ...(extraction.hybrid_scan_pages
      ? { hybrid_scan_pages: extraction.hybrid_scan_pages }
      : {}),
    ...(extraction.page_inspection_summary
      ? { page_inspection_summary: extraction.page_inspection_summary }
      : {}),
    ...(extractedImagesManifest && extractedImagesManifest.length > 0
      ? { extracted_images_manifest: extractedImagesManifest }
      : {}),
    ...(typeof extraction.skipped_decorative_images_count === "number"
      ? {
          skipped_decorative_images_count:
            extraction.skipped_decorative_images_count,
        }
      : {}),
    ...(extraction.forensic_meta
      ? {
          forensic_meta: extraction.forensic_meta,
          pdf_forensic_meta: extraction.forensic_meta,
        }
      : {}),
    ...(extraction.ocr_applied
      ? { ocr_applied: true, ocr_pages: extraction.ocr_pages }
      : {}),
    headers: [],
    footers: [],
    paragraphs,
    tables: [],
    ...(budgetAudit.has_budget_table ? { budget_audit: budgetAudit } : {}),
  };

  if (transientPdfAuditMd !== undefined || transientPdfDossieMd !== undefined) {
    attachTransientInspectMarkdown(
      pdfResult,
      transientPdfAuditMd,
      transientPdfDossieMd
    );
  }
  if (targetOutputPath) {
    writeFileSync(targetOutputPath, JSON.stringify(pdfResult, null, 2), "utf-8");
  }

  return pdfResult;
}
