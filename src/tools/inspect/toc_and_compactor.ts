import { formatCompactMcpPath } from "../../utils/json.ts";
import type {
  BodyParagraphInfo,
  TableInfo,
  DocxTocMap,
  TocParagraphItem,
  TocFormCellItem,
  TocTableItem,
  DocxInspectionResult,
} from "../../types/index.ts";
// ============================================================================
// Formatação de Visão Linear de Auditoria e TOC Map (ENG-02, 07, 11)
// ============================================================================

export function buildTocMap(
  paragraphs: BodyParagraphInfo[],
  tables: TableInfo[]
): DocxTocMap {
  const sections: TocParagraphItem[] = [];
  const form_fields: TocFormCellItem[] = [];
  const tocTables: TocTableItem[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const text = p.text.trim();
    if (!text || text.length > 150) continue;

    const hasHeadingStyle =
      p.style !== null &&
      /^(?:Heading|Titulo|Título|T[ií]tulo|Header|Se[çc][ãa]o)/i.test(p.style);

    const isNumberedSection =
      /^(?:(?:\d+(?:\.\d+)*|[A-Z]|\b[IVXLCDM]+\b)[\.\-\)\s]|CL[ÁA]USULA|SE[ÇC][ãA]O|CAP[IÍ]TULO|ANEXO)\s+[A-ZÀ-Ú0-9]/i.test(
        text
      );

    const isCommonAdminHeader =
      /^(?:ESTUDO T[EÉ]CNICO PRELIMINAR|TERMO DE REFER[EÊ]NCIA|PROJETO B[AÁ]SICO|JUSTIFICATIVA|OBJETO(?:\s+DA\s+CONTRATA[ÇC][ãA]O)?|DISPOSI[ÇC][ÕO]ES GERAIS|MATRIZ DE RISCOS|CRONOGRAMA|PESQUISA DE PRE[ÇC]OS|CRIT[EÉ]RIOS DE HABILITA[ÇC][ãA]O|DISPOSI[ÇC][ÕO]ES FINAIS)\b/i.test(
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

  for (const tbl of tables) {
    for (let rIdx = 0; rIdx < tbl.rows.length; rIdx++) {
      const row = tbl.rows[rIdx];
      const physicalCells = row.cells.filter((c) => !c.isSpanPlaceholder);
      for (let cIdx = 0; cIdx < physicalCells.length; cIdx++) {
        const cell = physicalCells[cIdx];
        if (cell.rowSpan === "continue") continue;
        const txt = cell.text.trim();
        if (!txt || txt.length > 250) continue;

        const isCheckboxText =
          txt.length <= 35 &&
          /^(?:[☐☑☒\u2610\u2611\u2612]|\[[\sxX]\]|\(x\)|\(\s*\)|sim\b|n[ãa]o\b|optante\b|n[ãa]o\s+optante\b|exclusiv[ao]\b|ampla\s+concorr[êe]ncia\b)/i.test(
            txt
          );

        if (
          isCheckboxText &&
          (cell.colSpan ?? 1) <= 2 &&
          cIdx + 1 < physicalCells.length
        ) {
          const nextCell = physicalCells[cIdx + 1];
          if (
            (nextCell.colSpan ?? 1) >= 3 ||
            physicalCells.length <= 3 ||
            cIdx === 1
          ) {
            const currentPhysIdx = cell.physicalCellIndex ?? cell.cellIndex;
            const nextPhysIdx = nextCell.physicalCellIndex ?? nextCell.cellIndex;
            const targetCoord = `T${tbl.index}.R${row.rowIndex}.C${nextPhysIdx}`;

            form_fields.push({
              coord: `T${tbl.index}.R${row.rowIndex}.C${currentPhysIdx}`,
              title: `[Checkbox Curto] ${txt}`,
              suggested_target_slot: targetCoord,
            });

            form_fields.push({
              coord: targetCoord,
              title: `[Texto Discursivo / Especificar] ${
                nextCell.text.trim().slice(0, 50) || "(vazio)"
              }`,
            });
            cIdx++;
            continue;
          }
        }

        const isQuestion = txt.endsWith("?") || txt.includes("?");
        const isLabel =
          txt.endsWith(":") && txt.length <= 100 && !txt.includes("\n");
        const isNumberedPrompt =
          /^\d+(\.\d+)*\s+[A-ZÀ-Ú]/i.test(txt) && txt.length <= 100;
        const isTwoColKey =
          physicalCells.length === 2 &&
          cIdx === 0 &&
          txt.length <= 100 &&
          !txt.includes("\n");

        if (isQuestion || isLabel || isNumberedPrompt || isTwoColKey) {
          let suggestedTarget: string | undefined;
          const currentPhysIdx = cell.physicalCellIndex ?? cell.cellIndex;

          if (cIdx + 1 < physicalCells.length) {
            const nextCell = physicalCells[cIdx + 1];
            const nextPhysIdx = nextCell.physicalCellIndex ?? nextCell.cellIndex;
            suggestedTarget = `T${tbl.index}.R${row.rowIndex}.C${nextPhysIdx}`;
          } else if (rIdx + 1 < tbl.rows.length) {
            const nextRow = tbl.rows[rIdx + 1];
            const nextPhysicalCells = nextRow.cells.filter((c) => !c.isSpanPlaceholder);
            const targetCell =
              nextPhysicalCells.find((c) => (c.physicalCellIndex ?? c.cellIndex) === currentPhysIdx) ??
              nextPhysicalCells[0];
            if (targetCell) {
              const targetPhysIdx = targetCell.physicalCellIndex ?? targetCell.cellIndex;
              suggestedTarget = `T${tbl.index}.R${nextRow.rowIndex}.C${targetPhysIdx}`;
            }
          }

          form_fields.push({
            coord: `T${tbl.index}.R${row.rowIndex}.C${currentPhysIdx}`,
            title: txt.length > 120 ? `${txt.slice(0, 117)}...` : txt,
            ...(suggestedTarget ? { suggested_target_slot: suggestedTarget } : {}),
          });
        }
      }
    }

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
    ...(full.detected_subtables && full.detected_subtables.length > 0
      ? { detected_subtables: full.detected_subtables }
      : {}),
    ...(full.detected_checkboxes && full.detected_checkboxes.length > 0
      ? { detected_checkboxes: full.detected_checkboxes }
      : {}),
    ...(full.post_compile_alerts && full.post_compile_alerts.length > 0
      ? { post_compile_alerts: full.post_compile_alerts }
      : {}),
    ...(full.structure_fingerprint
      ? { structure_fingerprint: full.structure_fingerprint }
      : {}),
    ...(full.template_match ? { template_match: full.template_match } : {}),
    ...(full.audit_view_path ? { audit_view_path: full.audit_view_path } : {}),
    ...(full.forensic_meta ? { forensic_meta: full.forensic_meta } : {}),
    ...(full.pdf_forensic_meta ? { pdf_forensic_meta: full.pdf_forensic_meta } : {}),
    ...(full.scanned_pages_detected
      ? { scanned_pages_detected: full.scanned_pages_detected }
      : {}),
    ...(full.hybrid_scan_pages
      ? { hybrid_scan_pages: full.hybrid_scan_pages }
      : {}),
    ...(full.page_inspection_summary
      ? { page_inspection_summary: full.page_inspection_summary }
      : {}),
    ...(full.extracted_images_manifest
      ? { extracted_images_manifest: full.extracted_images_manifest }
      : {}),
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

export function toShortDocPath(p: string): string {
  return formatCompactMcpPath(p);
}
