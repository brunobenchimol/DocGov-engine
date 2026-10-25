import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { resolve, dirname, basename, relative } from "node:path";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import {
  getAllElements,
  getDirectChildElements,
  extractParagraphStyle,
  extractParagraphText,
  extractParagraphNumbering,
  extractCellText,
  extractCellGridSpan,
  extractCellVMerge,
  createNumberingResolver,
  sanitizeXmlString,
} from "../utils/xml.ts";
import {
  computeStructureFingerprint,
  findBestTemplateMatch,
  reanchorSlotsManifest,
  extractCacheTemporalMetadata,
} from "../core/registry.ts";
import { isPdfBuffer, extractPdfPages } from "../utils/pdf.ts";
import {
  buildPdfCartography,
  buildDocxCartography,
  renderCartographyMarkdownBlock,
  generateHotspotsDossierMarkdown,
} from "../core/cartography.ts";
import {
  auditDocumentBudget,
  injectBudgetAuditIntoImpugnationZones,
  formatBudgetAuditMarkdownBlock,
  formatCentsToCurrency,
} from "../core/budget_auditor.ts";
import {
  computeStructuralDiff,
  generateDiffReportMarkdown,
} from "../core/structural_diff.ts";
import {
  parseXlsxBuffer,
  parseCsvBuffer,
  generateSpreadsheetLinearAuditViewMarkdown,
  generateSpreadsheetHotspotsDossierMarkdown,
} from "../parsers/spreadsheet.ts";
import { VERSION } from "../constants/index.ts";
import type {
  BodyParagraphInfo,
  TableInfo,
  DocxTocMap,
  TocParagraphItem,
  TocFormCellItem,
  TocTableItem,
  DocxInspectionResult,
  HeaderFooterParagraphInfo,
  TemplateMatchResult,
  InspectDocSyntheticResult,
  InspectDocxSyntheticResult,
  PdfExtractionResult,
  DocumentCartography,
} from "../types/index.ts";

// ============================================================================
// Mapeamento Estrutural e Sumário (TOC Map & Compact Inspection)
// ============================================================================

export function buildTocMap(
  paragraphs: BodyParagraphInfo[],
  tables: TableInfo[]
): DocxTocMap {
  const sections: TocParagraphItem[] = [];
  const form_fields: TocFormCellItem[] = [];
  const tocTables: TocTableItem[] = [];

  // 1. Mapeamento de Títulos e Seções em Parágrafos
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const text = p.text.trim();
    if (!text || text.length > 150) continue;

    const hasHeadingStyle =
      p.style !== null &&
      /^(?:Heading|Titulo|Título|T[ií]tulo|Header|Se[çc][ãa]o)/i.test(p.style);

    const isNumberedSection =
      /^(?:(?:\d+(?:\.\d+)*|[A-Z]|\b[IVXLCDM]+\b)[\.\-\)\s]|CL[ÁA]USULA|SE[ÇC][ÃA]O|CAP[IÍ]TULO|ANEXO)\s+[A-ZÀ-Ú0-9]/i.test(
        text
      );

    const isCommonAdminHeader =
      /^(?:ESTUDO T[EÉ]CNICO PRELIMINAR|TERMO DE REFER[EÊ]NCIA|PROJETO B[AÁ]SICO|JUSTIFICATIVA|OBJETO(?:\s+DA\s+CONTRATA[ÇC][ÃA]O)?|DISPOSI[ÇC][ÕO]ES GERAIS|MATRIZ DE RISCOS|CRONOGRAMA|PESQUISA DE PRE[ÇC]OS|CRIT[EÉ]RIOS DE HABILITA[ÇC][ÃA]O|DISPOSI[ÇC][ÕO]ES FINAIS)\b/i.test(
        text
      );

    const isAllCapsTitle =
      text.length >= 4 &&
      text.length <= 100 &&
      text === text.toUpperCase() &&
      /[A-ZÀ-Ú]/.test(text) &&
      !/[;,.]$/.test(text) &&
      !text.includes("\n");

    if (
      hasHeadingStyle ||
      isNumberedSection ||
      isCommonAdminHeader ||
      isAllCapsTitle
    ) {
      sections.push({
        coord: `P${p.index}`,
        title: text,
        suggested_target_slot:
          i + 1 < paragraphs.length ? `P${paragraphs[i + 1].index}` : undefined,
      });
    }
  }

  // 2. Mapeamento de Campos e Perguntas em Tabelas de Formulário
  for (const tbl of tables) {
    for (let rIdx = 0; rIdx < tbl.rows.length; rIdx++) {
      const row = tbl.rows[rIdx];
      for (let cIdx = 0; cIdx < row.cells.length; cIdx++) {
        const cell = row.cells[cIdx];
        const txt = cell.text.trim();
        if (!txt || txt.length > 250) continue;

        const isQuestion = txt.endsWith("?") || txt.includes("?");
        const isLabel =
          txt.endsWith(":") && txt.length <= 100 && !txt.includes("\n");
        const isNumberedPrompt =
          /^\d+(\.\d+)*\s+[A-ZÀ-Ú]/i.test(txt) && txt.length <= 100;
        const isTwoColKey =
          row.cells.length === 2 &&
          cIdx === 0 &&
          txt.length <= 100 &&
          !txt.includes("\n");

        if (isQuestion || isLabel || isNumberedPrompt || isTwoColKey) {
          let suggestedTarget: string | undefined;

          // Se houver célula adjacente à direita na mesma linha
          if (cIdx + 1 < row.cells.length) {
            suggestedTarget = `T${tbl.index}.R${row.rowIndex}.C${row.cells[cIdx + 1].cellIndex}`;
          } else if (rIdx + 1 < tbl.rows.length) {
            // Se for coluna única, o alvo costuma ser a linha imediatamente abaixo
            const nextRow = tbl.rows[rIdx + 1];
            const targetCell =
              nextRow.cells.find((c) => c.cellIndex === cell.cellIndex) ??
              nextRow.cells[0];
            if (targetCell) {
              suggestedTarget = `T${tbl.index}.R${nextRow.rowIndex}.C${targetCell.cellIndex}`;
            }
          }

          form_fields.push({
            coord: `T${tbl.index}.R${row.rowIndex}.C${cell.cellIndex}`,
            title: txt.length > 120 ? `${txt.slice(0, 117)}...` : txt,
            ...(suggestedTarget ? { suggested_target_slot: suggestedTarget } : {}),
          });
        }
      }
    }

    // 3. Resumo Estrutural das Tabelas
    const rowsCount = tbl.rows.length;
    let maxCols = 0;
    for (const r of tbl.rows) {
      if (r.cells.length > maxCols) maxCols = r.cells.length;
    }

    const firstRowCells = tbl.rows[0]?.cells ?? [];
    const headers = firstRowCells
      .map((c) => c.text.trim().replace(/\r?\n/g, " "))
      .filter((t) => t.length > 0);

    tocTables.push({
      table_index: tbl.index,
      rows: rowsCount,
      cols: maxCols,
      headers,
      sample_row_coord: rowsCount > 1 ? `T${tbl.index}.R1` : undefined,
    });
  }

  return {
    sections,
    form_fields,
    tables: tocTables,
  };
}

export function compactInspectionResult(
  full: DocxInspectionResult
): DocxInspectionResult {
  return {
    ...(full.doc_type ? { doc_type: full.doc_type } : {}),
    ...(full.page_count !== undefined ? { page_count: full.page_count } : {}),
    ...(full.line_count !== undefined ? { line_count: full.line_count } : {}),
    ...(full.outline_headings
      ? { outline_headings: full.outline_headings }
      : {}),
    ...(full.page_signals ? { page_signals: full.page_signals } : {}),
    ...(full.impugnation_zones
      ? { impugnation_zones: full.impugnation_zones }
      : {}),
    ...(full.toc_map ? { toc_map: full.toc_map } : {}),
    ...(full.structure_fingerprint
      ? { structure_fingerprint: full.structure_fingerprint }
      : {}),
    ...(full.template_match ? { template_match: full.template_match } : {}),
    ...(full.audit_view_path ? { audit_view_path: full.audit_view_path } : {}),
    headers: full.headers.filter((h) => h.text.trim() !== ""),
    footers: full.footers.filter((f) => f.text.trim() !== ""),
    paragraphs: full.paragraphs.filter((p) => p.text.trim() !== ""),
    tables: full.tables.map((t) => ({
      index: t.index,
      rows: t.rows
        .map((r) => ({
          rowIndex: r.rowIndex,
          cells: r.cells.filter((c) => c.text.trim() !== ""),
        }))
        .filter((r) => r.cells.length > 0),
    })),
  };
}

export function generatePdfLinearAuditViewMarkdown(
  docName: string,
  extraction: PdfExtractionResult,
  cartography: DocumentCartography
): string {
  const lines: string[] = [];
  lines.push(`# Visão Linear de Auditoria: ${docName}`);
  lines.push(
    `> Espelho estrutural paginado gerado por docgov-engine v${VERSION} (${extraction.pageCount} página(s), ${extraction.lineCount} linha(s)).`
  );
  if (
    extraction.scanned_pages_detected &&
    extraction.scanned_pages_detected.length > 0
  ) {
    if (extraction.ocr_applied && extraction.ocr_pages && extraction.ocr_pages.length > 0) {
      lines.push(
        `> 🔍 **PIPELINE OCR HEADLESS APLICADO (Marco 5.3):** Texto recuperado com sucesso nas página(s) escaneada(s): ${extraction.ocr_pages.join(
          ", "
        )}.`
      );
    } else {
      lines.push(
        `> ⚠️ **ALERTA CRÍTICO: DETECTADA(S) PÁGINA(S) ESCANEADA(S) COMO IMAGEM — SEM CAMADA DE TEXTO EXTRAÍVEL:** Página(s) ${extraction.scanned_pages_detected.join(
          ", "
        )}.`
      );
    }
  }
  lines.push("");

  // Bloco 1: Mapa Cartográfico Estrutural + Radar das 14 Zonas de Impugnação
  lines.push(...renderCartographyMarkdownBlock(cartography));

  // Bloco 2: Conteúdo Integral Paginado [PAG_XXX | LYYYY]
  lines.push("## Bloco 2: Conteúdo Integral Paginado");
  lines.push("");

  const headingCoords = new Set(
    cartography.outline_headings.map((h) => h.coord)
  );
  const scannedSet = new Set(extraction.scanned_pages_detected || []);

  for (const page of extraction.pages) {
    lines.push(
      `### Página ${String(page.pageNumber).padStart(3, "0")}`
    );
    if (scannedSet.has(page.pageNumber)) {
      lines.push(
        "- **[ALERTA CRÍTICO: PÁGINA ESCANEADA COMO IMAGEM — SEM CAMADA DE TEXTO EXTRAÍVEL]**"
      );
    }
    if (page.lines.length === 0) {
      if (!scannedSet.has(page.pageNumber)) {
        lines.push("- *(Página sem texto extraível)*");
      }
    } else {
      for (const l of page.lines) {
        if (headingCoords.has(l.bracket_coord)) {
          lines.push(`- **${l.bracket_coord}** ${l.text}`);
        } else {
          lines.push(`- ${l.bracket_coord} ${l.text}`);
        }
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

export function generateLinearAuditViewMarkdown(
  docName: string,
  inspection: DocxInspectionResult
): string {
  const lines: string[] = [];
  lines.push(`# Visão Linear de Auditoria: ${docName}`);
  lines.push(
    `> Espelho estrutural gerado por docgov-docx v${VERSION} para leitura integral em turno único.`
  );
  lines.push("");

  // Bloco 1: Mapa Cartográfico Estrutural + Radar das 14 Zonas de Impugnação
  const cartography: DocumentCartography =
    inspection.outline_headings &&
    inspection.page_signals &&
    inspection.impugnation_zones
      ? {
          outline_headings: inspection.outline_headings,
          page_signals: inspection.page_signals,
          impugnation_zones: inspection.impugnation_zones,
        }
      : buildDocxCartography(
          inspection.paragraphs || [],
          inspection.tables || [],
          inspection.toc_map
        );

  lines.push(...renderCartographyMarkdownBlock(cartography));

  // Bloco 2: Conteúdo Integral do Documento (.docx)
  lines.push("## Bloco 2: Conteúdo Integral Estruturado");
  lines.push("");

  // 1. Cabeçalhos e Rodapés
  const hasHf =
    (inspection.headers && inspection.headers.length > 0) ||
    (inspection.footers && inspection.footers.length > 0);
  if (hasHf) {
    lines.push("## Cabeçalhos e Rodapés");
    if (inspection.headers) {
      for (const h of inspection.headers) {
        if (h.text.trim()) {
          lines.push(`- [H${h.paragraphIndex}] ${h.text.trim()}`);
        }
      }
    }
    if (inspection.footers) {
      for (const f of inspection.footers) {
        if (f.text.trim()) {
          lines.push(`- [F${f.paragraphIndex}] ${f.text.trim()}`);
        }
      }
    }
    lines.push("");
  }

  // 2. Parágrafos e Seções
  if (inspection.paragraphs && inspection.paragraphs.length > 0) {
    lines.push("## Parágrafos e Seções");
    for (const p of inspection.paragraphs) {
      const txt = p.text.trim();
      if (!txt) continue;
      const isHeading = inspection.toc_map?.sections.some(
        (s) => s.coord === `P${p.index}`
      );
      if (isHeading) {
        lines.push(`- **[P${p.index}]** ${txt}`);
      } else {
        lines.push(`- [P${p.index}] ${txt}`);
      }
    }
    lines.push("");
  }

  // 3. Tabelas
  if (inspection.tables && inspection.tables.length > 0) {
    lines.push("## Tabelas");
    for (const tbl of inspection.tables) {
      let maxCols = 0;
      for (const r of tbl.rows) {
        if (r.cells.length > maxCols) maxCols = r.cells.length;
      }
      lines.push(
        `### Tabela [T${tbl.index}] (${tbl.rows.length} linhas x ${maxCols} colunas)`
      );

      for (const r of tbl.rows) {
        const nonEmptyCells = r.cells.filter((c) => c.text.trim() !== "");
        if (nonEmptyCells.length === 0) continue;

        if (r.cells.length === 2) {
          const c0 = r.cells[0];
          const c1 = r.cells[1];
          const t0 = c0.text.trim().replace(/\r?\n/g, " ");
          const t1 = c1.text.trim().replace(/\r?\n/g, " ");
          lines.push(
            `- [T${tbl.index}.R${r.rowIndex}.C${c0.cellIndex}] ${t0} -> [T${tbl.index}.R${r.rowIndex}.C${c1.cellIndex}] ${t1 || "[vazio]"}`
          );
        } else {
          const rowParts = r.cells.map(
            (c) =>
              `[T${tbl.index}.R${r.rowIndex}.C${
                c.cellIndex
              }] ${c.text.trim().replace(/\r?\n/g, " ") || "[vazio]"}`
          );
          lines.push(`- [T${tbl.index}.R${r.rowIndex}] ${rowParts.join(" | ")}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim() + "\n";
}

// ============================================================================
// 1. Função de Inspeção Estrutural (inspect_docx — suporta .docx e .pdf)
// ============================================================================

async function applyStructuralDiffIfRequested(
  currentResult: DocxInspectionResult,
  currentPath: string,
  outputPath?: string,
  compareWithPath?: string
): Promise<void> {
  if (!compareWithPath) return;
  const resolvedOld = resolve(compareWithPath);
  if (!existsSync(resolvedOld)) {
    throw new Error(`Arquivo de comparação não encontrado: ${resolvedOld}`);
  }
  const oldInspection = await inspectDocx(resolvedOld, undefined, true);
  const diff = computeStructuralDiff(
    oldInspection,
    currentResult,
    resolvedOld,
    currentPath
  );

  const diffOutDir = outputPath
    ? dirname(resolve(outputPath))
    : dirname(currentPath);
  const diffBase = outputPath
    ? basename(resolve(outputPath), ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      )
    : basename(currentPath).replace(/\.(?:docx|pdf)$/i, "");
  const diffMdPath = resolve(diffOutDir, `diff_documental_${diffBase}.md`);
  const diffJsonPath = resolve(diffOutDir, `diff_documental_${diffBase}.json`);
  if (!existsSync(diffOutDir)) {
    mkdirSync(diffOutDir, { recursive: true });
  }
  const diffMd = generateDiffReportMarkdown(diff);
  writeFileSync(diffMdPath, diffMd, "utf-8");
  diff.diff_report_path = diffMdPath;
  writeFileSync(diffJsonPath, JSON.stringify(diff, null, 2), "utf-8");
  currentResult.diff_result = diff;
}

export async function inspectDocx(
  docxPath: string,
  outputPath?: string,
  compact: boolean = false,
  options: { registryDir?: string; compareWithPath?: string } = {}
): Promise<DocxInspectionResult> {
  const resolvedDocx = resolve(docxPath);
  if (!existsSync(resolvedDocx)) {
    throw new Error(`Arquivo não encontrado: ${resolvedDocx}`);
  }

  const buffer = readFileSync(resolvedDocx);
  const lowerPath = resolvedDocx.toLowerCase();
  const isSpreadsheet =
    lowerPath.endsWith(".xlsx") ||
    lowerPath.endsWith(".xls") ||
    lowerPath.endsWith(".csv");

  if (isSpreadsheet) {
    const isCsv = lowerPath.endsWith(".csv");
    const extraction = isCsv
      ? parseCsvBuffer(buffer)
      : await parseXlsxBuffer(buffer);

    // Auditoria Matemática Orçamentária
    const budgetAudit = auditDocumentBudget({ docxTables: extraction.tables });

    const baseStem = outputPath
      ? basename(resolve(outputPath), ".json").replace(
          /^(?:estrutura_|inspecao_)/,
          ""
        )
      : basename(resolvedDocx).replace(/\.(?:xlsx|xls|csv)$/i, "");

    const outDir = outputPath
      ? dirname(resolve(outputPath))
      : dirname(resolvedDocx);

    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const auditViewPath = resolve(outDir, `visao_auditoria_${baseStem}.md`);
    const dossieHotspotsPath = resolve(outDir, `dossie_hotspots_${baseStem}.md`);
    const budgetAuditPath = resolve(
      outDir,
      `auditoria_orcamentaria_${baseStem}.json`
    );

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
      audit_view_path: auditViewPath,
      dossie_hotspots_path: dossieHotspotsPath,
      headers: [],
      footers: [],
      paragraphs: [],
      tables: extraction.tables,
      toc_map,
      budget_audit: budgetAudit,
    };

    if (outputPath) {
      const resolvedOut = resolve(outputPath);
      writeFileSync(resolvedOut, JSON.stringify(result, null, 2), "utf-8");
    }

    return result;
  }

  const isPdf =
    isPdfBuffer(buffer) || resolvedDocx.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    if (!isPdfBuffer(buffer)) {
      throw new Error(
        `Arquivo .pdf inválido (Magic Bytes '%PDF-' ausentes): ${resolvedDocx}`
      );
    }

    const extraction = await extractPdfPages(buffer);
    const cartography = buildPdfCartography(extraction);

    // Auditoria Matemática Orçamentária (v1.1.0)
    const budgetAudit = auditDocumentBudget({ pdfLines: extraction.lines });
    if (budgetAudit.has_budget_table) {
      injectBudgetAuditIntoImpugnationZones(
        budgetAudit,
        cartography.impugnation_zones
      );

      const budgetOutDir = outputPath
        ? dirname(resolve(outputPath))
        : dirname(resolvedDocx);
      const budgetBase = outputPath
        ? basename(resolve(outputPath), ".json").replace(
            /^(?:estrutura_|inspecao_)/,
            ""
          )
        : basename(resolvedDocx).replace(/\.pdf$/i, "");
      const budgetAuditPath = resolve(
        budgetOutDir,
        `auditoria_orcamentaria_${budgetBase}.json`
      );
      if (!existsSync(budgetOutDir)) {
        mkdirSync(budgetOutDir, { recursive: true });
      }
      writeFileSync(
        budgetAuditPath,
        JSON.stringify(budgetAudit, null, 2),
        "utf-8"
      );
    }

    let auditViewPath: string;
    if (outputPath) {
      const resolvedOut = resolve(outputPath);
      const outDir = dirname(resolvedOut);
      const outBase = basename(resolvedOut, ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      );
      auditViewPath = resolve(outDir, `visao_auditoria_${outBase}.md`);
    } else {
      const docDir = dirname(resolvedDocx);
      const docBase = basename(resolvedDocx).replace(/\.pdf$/i, "");
      auditViewPath = resolve(docDir, `visao_auditoria_${docBase}.md`);
    }

    let auditMd = generatePdfLinearAuditViewMarkdown(
      basename(resolvedDocx),
      extraction,
      cartography
    );
    if (budgetAudit.has_budget_table) {
      auditMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
    }
    const auditDir = dirname(auditViewPath);
    if (!existsSync(auditDir)) {
      mkdirSync(auditDir, { recursive: true });
    }
    writeFileSync(auditViewPath, auditMd, "utf-8");

    // Geração do Dossiê Executivo de Hotspots (v0.9.0)
    let dossieHotspotsPath: string;
    if (outputPath) {
      const resolvedOut = resolve(outputPath);
      const outDir = dirname(resolvedOut);
      const outBase = basename(resolvedOut, ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      );
      dossieHotspotsPath = resolve(outDir, `dossie_hotspots_${outBase}.md`);
    } else {
      const docDir = dirname(resolvedDocx);
      const docBase = basename(resolvedDocx).replace(/\.pdf$/i, "");
      dossieHotspotsPath = resolve(docDir, `dossie_hotspots_${docBase}.md`);
    }

    let dossieMd = generateHotspotsDossierMarkdown(
      basename(resolvedDocx),
      extraction,
      cartography
    );
    if (budgetAudit.has_budget_table) {
      dossieMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
    }
    writeFileSync(dossieHotspotsPath, dossieMd, "utf-8");

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
      audit_view_path: auditViewPath,
      dossie_hotspots_path: dossieHotspotsPath,
      ...(extraction.scanned_pages_detected
        ? { scanned_pages_detected: extraction.scanned_pages_detected }
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

    await applyStructuralDiffIfRequested(
      pdfResult,
      resolvedDocx,
      outputPath,
      options.compareWithPath
    );

    if (outputPath) {
      const resolvedOut = resolve(outputPath);
      const outDir = dirname(resolvedOut);
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
      }
      writeFileSync(resolvedOut, JSON.stringify(pdfResult, null, 2), "utf-8");
    }

    return pdfResult;
  }

  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();

  const headers: HeaderFooterParagraphInfo[] = [];
  const footers: HeaderFooterParagraphInfo[] = [];

  const fileNames = Object.keys(zip.files).sort();

  for (const name of fileNames) {
    if (/^word\/header\d*\.xml$/i.test(name)) {
      const xmlStr = sanitizeXmlString(await zip.file(name)!.async("string"));
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      const pList = getAllElements(xmlDoc, "w:p");
      pList.forEach((p, idx) => {
        headers.push({
          part: name,
          index: idx,
          paragraphIndex: idx,
          style: extractParagraphStyle(p),
          text: extractParagraphText(p),
        });
      });
    } else if (/^word\/footer\d*\.xml$/i.test(name)) {
      const xmlStr = sanitizeXmlString(await zip.file(name)!.async("string"));
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      const pList = getAllElements(xmlDoc, "w:p");
      pList.forEach((p, idx) => {
        footers.push({
          part: name,
          index: idx,
          paragraphIndex: idx,
          style: extractParagraphStyle(p),
          text: extractParagraphText(p),
        });
      });
    }
  }

  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error(
      `Estrutura OpenXML inválida (word/document.xml ausente): ${resolvedDocx}`
    );
  }

  const docXmlStr = sanitizeXmlString(await docFile.async("string"));
  const docXml = parser.parseFromString(docXmlStr, "application/xml");
  const body = getAllElements(docXml, "w:body")[0];
  if (!body) {
    throw new Error(`Elemento <w:body> não encontrado em word/document.xml`);
  }

  const numberingFile = zip.file("word/numbering.xml");
  const numberingXmlStr = numberingFile
    ? await numberingFile.async("string")
    : null;
  const numberingResolver = createNumberingResolver(numberingXmlStr);

  const bodyParagraphs = getDirectChildElements(body, "w:p");
  const paragraphs: BodyParagraphInfo[] = bodyParagraphs.map((p, index) => {
    const numbering = extractParagraphNumbering(p);
    let text = extractParagraphText(p);
    if (numbering) {
      const trimmed = text.trim();
      const isTemplateTag = /^\{\{[\s\S]*\}\}$/.test(trimmed);
      if (trimmed && !isTemplateTag) {
        const computedPrefix = numberingResolver.formatParagraphPrefix(
          numbering.numId,
          numbering.level
        );
        if (
          computedPrefix &&
          !trimmed.startsWith(computedPrefix) &&
          !trimmed.startsWith(`${computedPrefix}.`)
        ) {
          text = `${computedPrefix} ${text.trimStart()}`;
        }
      }
    }
    return {
      index,
      style: extractParagraphStyle(p),
      text,
      ...(numbering ? { numbering } : {}),
    };
  });

  const bodyTables = getDirectChildElements(body, "w:tbl");
  const rawTables: TableInfo[] = bodyTables.map((tbl, index) => {
    const trList = getDirectChildElements(tbl, "w:tr");
    const activeVMerges = new Map<number, string>();

    const rows: TableRowInfo[] = trList.map((tr, rowIndex) => {
      const tcList = getDirectChildElements(tr, "w:tc");
      const cells: TableCellInfo[] = [];
      let currentCol = 0;

      for (const tc of tcList) {
        const span = extractCellGridSpan(tc);
        const vMerge = extractCellVMerge(tc);
        let text = extractCellText(tc);

        if (vMerge === "restart") {
          activeVMerges.set(currentCol, text);
        } else if (vMerge === "continue") {
          if (!text.trim() && activeVMerges.has(currentCol)) {
            text = activeVMerges.get(currentCol) || "";
          }
        } else {
          activeVMerges.delete(currentCol);
        }

        cells.push({
          cellIndex: currentCol,
          text,
          ...(span > 1 ? { colSpan: span } : {}),
          ...(vMerge ? { rowSpan: vMerge } : {}),
        });

        // Se span > 1 (gridSpan), preenche colunas lógicas intermediárias com células vazias
        // para manter alinhamento estrito das colunas subsequentes
        for (let s = 1; s < span; s++) {
          cells.push({
            cellIndex: currentCol + s,
            text: "",
            isSpanPlaceholder: true,
          });
        }

        currentCol += span;
      }

      return {
        rowIndex,
        cells,
      };
    });

    return {
      index,
      rows,
    };
  });

  // Unificação de tabelas consecutivas com mesma grade/repetição de cabeçalho
  const tables: TableInfo[] = [];
  for (let t = 0; t < rawTables.length; t++) {
    const current = rawTables[t];
    if (tables.length === 0) {
      tables.push(current);
      continue;
    }
    const prev = tables[tables.length - 1];
    const prevHeader = prev.rows[0]?.cells.map((c) => c.text.trim()) ?? [];
    const currHeader = current.rows[0]?.cells.map((c) => c.text.trim()) ?? [];

    const isSameCols = prev.rows[0]?.cells.length === current.rows[0]?.cells.length;
    const isRepeatedHeader =
      isSameCols &&
      prevHeader.length > 0 &&
      currHeader.length > 0 &&
      prevHeader.join("|") === currHeader.join("|");

    if (isSameCols && isRepeatedHeader) {
      // Mescla linhas da tabela seguinte na tabela anterior (omitindo o cabeçalho repetido)
      const dataRows = current.rows.slice(1);
      const startRowIdx = prev.rows.length;
      for (let r = 0; r < dataRows.length; r++) {
        prev.rows.push({
          rowIndex: startRowIdx + r,
          cells: dataRows[r].cells,
        });
      }
    } else {
      tables.push({
        ...current,
        index: tables.length,
      });
    }
  }

  const toc_map = buildTocMap(paragraphs, tables);
  const docxCartography = buildDocxCartography(paragraphs, tables, toc_map);

  // Auditoria Matemática Orçamentária (v1.1.0)
  const budgetAudit = auditDocumentBudget({
    docxTables: tables,
    docxParagraphs: paragraphs,
  });
  if (budgetAudit.has_budget_table) {
    injectBudgetAuditIntoImpugnationZones(
      budgetAudit,
      docxCartography.impugnation_zones
    );

    const budgetOutDir = outputPath
      ? dirname(resolve(outputPath))
      : dirname(resolvedDocx);
    const budgetBase = outputPath
      ? basename(resolve(outputPath), ".json").replace(
          /^(?:estrutura_|inspecao_)/,
          ""
        )
      : basename(resolvedDocx, ".docx");
    const budgetAuditPath = resolve(
      budgetOutDir,
      `auditoria_orcamentaria_${budgetBase}.json`
    );
    if (!existsSync(budgetOutDir)) {
      mkdirSync(budgetOutDir, { recursive: true });
    }
    writeFileSync(
      budgetAuditPath,
      JSON.stringify(budgetAudit, null, 2),
      "utf-8"
    );
  }

  const rawResult: DocxInspectionResult = {
    doc_type: "docx",
    outline_headings: docxCartography.outline_headings,
    page_signals: docxCartography.page_signals,
    impugnation_zones: docxCartography.impugnation_zones,
    toc_map,
    headers,
    footers,
    paragraphs,
    tables,
    ...(budgetAudit.has_budget_table ? { budget_audit: budgetAudit } : {}),
  };

  // Cálculo da Impressão Digital Estrutural (v0.6.0)
  const structure_fingerprint = computeStructureFingerprint(rawResult);
  rawResult.structure_fingerprint = structure_fingerprint;

  // Geração da Visão Linear Compacta de Auditoria (v0.6.0 / v0.8.0 / v0.8.1 com Cartografia + Z1..Z14)
  let auditViewPath: string;
  if (outputPath) {
    const resolvedOut = resolve(outputPath);
    const outDir = dirname(resolvedOut);
    const outBase = basename(resolvedOut, ".json").replace(
      /^(?:estrutura_|inspecao_)/,
      ""
    );
    auditViewPath = resolve(outDir, `visao_auditoria_${outBase}.md`);
  } else {
    const docDir = dirname(resolvedDocx);
    const docBase = basename(resolvedDocx, ".docx");
    auditViewPath = resolve(docDir, `visao_auditoria_${docBase}.md`);
  }

  let auditMd = generateLinearAuditViewMarkdown(
    basename(resolvedDocx),
    rawResult
  );
  if (budgetAudit.has_budget_table) {
    auditMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
  }
  const auditDir = dirname(auditViewPath);
  if (!existsSync(auditDir)) {
    mkdirSync(auditDir, { recursive: true });
  }
  writeFileSync(auditViewPath, auditMd, "utf-8");
  rawResult.audit_view_path = auditViewPath;

  // Matching 1-para-N contra o Cache Global de Templates (v0.6.0)
  const match = findBestTemplateMatch(
    structure_fingerprint,
    resolvedDocx,
    options.registryDir
  );
  let template_match: TemplateMatchResult;

  if (match.entry) {
    const meta = extractCacheTemporalMetadata(match.entry);
    if (match.similarity >= 0.995) {
      template_match = {
        status: "EXACT",
        similarity: 1.0,
        template_id: match.entry.template_id,
        registry_path: match.entry.registry_path,
        created_at: meta.created_at,
        updated_at: meta.updated_at,
        age_days: meta.age_days,
        cache_date_status: meta.cache_date_status,
        engine_version: meta.engine_version,
        slots_count: meta.slots_count,
        message:
          meta.cache_date_status === "KNOWN"
            ? `Template idêntico (100%) localizado no registro global: '${match.entry.template_id}' (atualizado em ${meta.updated_at.slice(0, 10)}, ${meta.slots_count} slots).`
            : `Template idêntico (100%) localizado no registro global: '${match.entry.template_id}' (data de criação não disponível no cache legado, ${meta.slots_count} slots).`,
      };
    } else if (match.similarity >= 0.75) {
      const adapted = reanchorSlotsManifest(
        match.entry,
        structure_fingerprint,
        rawResult
      );
      const outStateDir = outputPath
        ? dirname(resolve(outputPath))
        : dirname(resolvedDocx);
      const adaptedPath = resolve(outStateDir, "adapted_slots_manifest.json");
      if (!existsSync(outStateDir)) {
        mkdirSync(outStateDir, { recursive: true });
      }
      writeFileSync(adaptedPath, JSON.stringify(adapted, null, 2), "utf-8");

      template_match = {
        status: "MODIFIED",
        similarity: match.similarity,
        template_id: match.entry.template_id,
        registry_path: match.entry.registry_path,
        adapted_manifest_path: adaptedPath,
        shift_summary:
          adapted._shift_summary ||
          "Coordenadas reancoradas automaticamente por rótulos de formulário.",
        created_at: meta.created_at,
        updated_at: meta.updated_at,
        age_days: meta.age_days,
        cache_date_status: meta.cache_date_status,
        engine_version: meta.engine_version,
        slots_count: meta.slots_count,
        message: `Template base '${
          match.entry.template_id
        }' compatível com drift (${Math.round(
          match.similarity * 100
        )}%). Manifesto adaptado gerado em state/adapted_slots_manifest.json.`,
      };
    } else {
      template_match = {
        status: "NEW",
        similarity: match.similarity,
        message: `Minuta inédita (< 75% de similaridade com templates registrados). Maior similaridade: ${Math.round(
          match.similarity * 100
        )}% ('${
          match.entry.template_id
        }'). Elabore um novo slots_manifest.json.`,
      };
    }
  } else {
    template_match = {
      status: "NEW",
      similarity: 0,
      message:
        "Nenhum template salvo no registro global de templates. Elabore um novo slots_manifest.json.",
    };
  }
  rawResult.template_match = template_match;

  await applyStructuralDiffIfRequested(
    rawResult,
    resolvedDocx,
    outputPath,
    options.compareWithPath
  );

  const finalResult = compact ? compactInspectionResult(rawResult) : rawResult;

  if (outputPath) {
    const resolvedOut = resolve(outputPath);
    const outDir = dirname(resolvedOut);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }
    writeFileSync(resolvedOut, JSON.stringify(finalResult, null, 2), "utf-8");
  }

  return finalResult;
}

export function formatInspectDocSyntheticResult(
  filePath: string,
  outputPath: string,
  inspection: DocxInspectionResult
): InspectDocSyntheticResult {
  let totalRows = 0;
  for (const table of inspection.tables) {
    totalRows += table.rows.length;
  }

  const toc_summary: Array<{ coord: string; title: string; target?: string }> =
    [];
  const tocMap = inspection.toc_map;
  if (tocMap) {
    // Adiciona até 2 seções principais
    for (const s of tocMap.sections.slice(0, 2)) {
      toc_summary.push({
        coord: s.coord,
        title: s.title.length > 25 ? `${s.title.slice(0, 22)}...` : s.title,
        ...(s.suggested_target_slot ? { target: s.suggested_target_slot } : {}),
      });
    }
    // Adiciona 1 campo de formulário principal
    for (const f of tocMap.form_fields.slice(0, 1)) {
      toc_summary.push({
        coord: f.coord,
        title: f.title.length > 25 ? `${f.title.slice(0, 22)}...` : f.title,
        ...(f.suggested_target_slot ? { target: f.suggested_target_slot } : {}),
      });
    }
    // Adiciona 1 tabela resumida
    if (tocMap.tables.length > 0) {
      const t = tocMap.tables[0];
      const headerSample = t.headers.slice(0, 2).join(", ");
      toc_summary.push({
        coord: `T${t.table_index}`,
        title: `Tbl (${t.rows}x${t.cols})${
          headerSample ? ` [${headerSample}]` : ""
        }`,
      });
    }
  }

  const relAuditPath = inspection.audit_view_path
    ? relative(process.cwd(), inspection.audit_view_path).replace(/\\/g, "/")
    : undefined;

  const relDossiePath = inspection.dossie_hotspots_path
    ? relative(process.cwd(), inspection.dossie_hotspots_path).replace(/\\/g, "/")
    : undefined;

  const conciseMatch: TemplateMatchResult | undefined = inspection.template_match
    ? {
        status: inspection.template_match.status,
        similarity: inspection.template_match.similarity,
        ...(inspection.template_match.template_id
          ? { template_id: inspection.template_match.template_id }
          : {}),
        ...(inspection.template_match.adapted_manifest_path
          ? {
              adapted_manifest_path: relative(
                process.cwd(),
                inspection.template_match.adapted_manifest_path
              ).replace(/\\/g, "/"),
            }
          : {}),
        ...(inspection.template_match.created_at !== undefined
          ? { created_at: inspection.template_match.created_at }
          : {}),
        ...(inspection.template_match.updated_at !== undefined
          ? { updated_at: inspection.template_match.updated_at }
          : {}),
        ...(inspection.template_match.age_days !== undefined
          ? { age_days: inspection.template_match.age_days }
          : {}),
        ...(inspection.template_match.cache_date_status !== undefined
          ? { cache_date_status: inspection.template_match.cache_date_status }
          : {}),
        ...(inspection.template_match.engine_version !== undefined
          ? { engine_version: inspection.template_match.engine_version }
          : {}),
        ...(inspection.template_match.slots_count !== undefined
          ? { slots_count: inspection.template_match.slots_count }
          : {}),
      }
    : undefined;

  let nextHint =
    inspection.doc_type === "pdf"
      ? inspection.scanned_pages_detected &&
        inspection.scanned_pages_detected.length > 0
        ? `ALERTA: páginas escaneadas detectadas (${inspection.scanned_pages_detected.join(
            ", "
          )}). Leia visao_auditoria_*.md ou siga para 'generate_audit_docx'.`
        : "PDF inspecionado com Cartografia e Radar Z1..Z14. Leia visao_auditoria_*.md ou siga para 'build_docx_template' / 'generate_audit_docx'."
      : "Inspeção gravada com toc_map. Próximo passo: elabore slots_manifest.json e chame 'build_docx_template'.";
  if (
    inspection.template_match?.status === "EXACT" ||
    inspection.template_match?.status === "MODIFIED"
  ) {
    const st = inspection.template_match.status;
    const slots = inspection.template_match.slots_count ?? 0;
    if (
      inspection.template_match.cache_date_status === "KNOWN" &&
      inspection.template_match.updated_at &&
      inspection.template_match.updated_at !== "NÃO DISPONÍVEL"
    ) {
      const dateStr = inspection.template_match.updated_at.slice(0, 10);
      nextHint = `Cache reconhecido (${st}, criado/atualizado em ${dateStr}, ${slots} slots). Informe a data ao usuário no Gate 1. Próximo: 'build_docx_template'.`;
    } else {
      nextHint = `Cache reconhecido (${st}, data de criação não disponível no cache legado). Informe ao usuário no Gate 1 que a data do cache é desconhecida para que ele decida entre usar ou atualizar. Próximo: 'build_docx_template'.`;
    }
  }

  if (
    inspection.budget_audit?.has_budget_table &&
    inspection.budget_audit.math_errors_count > 0
  ) {
    nextHint = `ALERTA: ${inspection.budget_audit.math_errors_count} erro(s) matemático(s) na planilha. Consulte visao_auditoria_*.md.`;
  }

  if (inspection.diff_result) {
    const diff = inspection.diff_result;
    nextHint = `Diff concluído (+${diff.total_added} / -${diff.total_removed} / ~${diff.total_modified}). Relatório: ${relative(
      process.cwd(),
      diff.diff_report_path || ""
    ).replace(/\\/g, "/")}.`;
  }

  const buildPayload = (
    summaryItems: Array<{ coord: string; title: string; target?: string }>
  ): InspectDocSyntheticResult => ({
    status: "success",
    engine_version: VERSION,
    filePath,
    docxPath: filePath,
    outputPath,
    ...(inspection.doc_type && inspection.doc_type !== "docx"
      ? {
          doc_type: inspection.doc_type,
          page_count: inspection.page_count,
          line_count: inspection.line_count,
        }
      : {}),
    tables: inspection.tables.length,
    rows: totalRows,
    paragraphs: inspection.paragraphs.length,
    ...(conciseMatch ? { template_match: conciseMatch } : {}),
    ...(relAuditPath ? { audit_view_path: relAuditPath } : {}),
    ...(relDossiePath ? { dossie_path: relDossiePath } : {}),
    ...(inspection.budget_audit && inspection.budget_audit.has_budget_table
      ? {
          budget_audit: {
            tables_checked: inspection.budget_audit.tables_checked,
            items_checked: inspection.budget_audit.total_items_checked,
            math_errors: inspection.budget_audit.math_errors_count,
            rounding_warnings:
              inspection.budget_audit.rounding_warnings_count,
            ...(inspection.budget_audit.net_divergence_cents !== 0
              ? {
                  divergence: formatCentsToCurrency(
                    inspection.budget_audit.net_divergence_cents
                  ),
                }
              : {}),
          },
        }
      : {}),
    ...(inspection.diff_result
      ? {
          diff_summary: {
            added: inspection.diff_result.total_added,
            removed: inspection.diff_result.total_removed,
            modified: inspection.diff_result.total_modified,
            report: inspection.diff_result.diff_report_path
              ? relative(
                  process.cwd(),
                  inspection.diff_result.diff_report_path
                ).replace(/\\/g, "/")
              : undefined,
          },
        }
      : {}),
    ...(inspection.scanned_pages_detected &&
    inspection.scanned_pages_detected.length > 0
      ? { scanned_pages: inspection.scanned_pages_detected }
      : {}),
    ...(inspection.ocr_applied ? { ocr_applied: true } : {}),
    ...(summaryItems.length > 0 ? { toc_summary: summaryItems } : {}),
    next_step_hint: nextHint,
  });

  // Garante cumprimento estrito da Lei 2 (< 1024 bytes UTF-8 com folga segura < 900 bytes)
  const currentSummary = [...toc_summary];
  let result = buildPayload(currentSummary);
  while (
    currentSummary.length > 0 &&
    Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 900
  ) {
    currentSummary.pop();
    result = buildPayload(currentSummary);
  }

  if (
    Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 900 &&
    result.docxPath &&
    result.doc_type &&
    result.doc_type !== "docx"
  ) {
    delete result.docxPath;
  }

  if (
    Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 900 &&
    result.dossie_path
  ) {
    delete result.dossie_path;
  }

  if (
    Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 900 &&
    !nextHint.includes("Cache reconhecido") &&
    result.next_step_hint &&
    result.next_step_hint.length > 60
  ) {
    result.next_step_hint = "Inspeção gravada. Siga para 'generate_audit_docx'.";
  }

  if (
    Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 1000 &&
    !nextHint.includes("Cache reconhecido") &&
    !nextHint.includes("ALERTA:")
  ) {
    result.next_step_hint = "Inspeção gravada. Chame 'build_docx_template'.";
  }

  return result;
}

export const formatInspectDocxSyntheticResult = formatInspectDocSyntheticResult;
export const inspectDoc = inspectDocx;

