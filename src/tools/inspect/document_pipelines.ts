import { relative } from "node:path";
import { VERSION } from "../../constants/index.ts";
import { formatCentsToCurrency } from "../../core/budget_auditor.ts";
import type {
  TableInfo,
  DetectedItemSubtable,
  DetectedCheckboxGroup,
  DocxInspectionResult,
  InspectResult,
  InspectDocSyntheticResult,
  InspectDocxSyntheticResult,
  TemplateMatchResult,
} from "../../types/index.ts";
import { toShortDocPath } from "./audit_view_formatter.ts";
import { isPdfBuffer } from "../../utils/pdf.ts";

// ============================================================================
// Detecção de Subtabelas de Itens e Checkboxes (ENG-07b, ENG-11)
// ============================================================================

export function detectTableSubtablesAndCheckboxes(tables: TableInfo[]): {
  subtables: DetectedItemSubtable[];
  checkboxes: DetectedCheckboxGroup[];
} {
  const subtables: DetectedItemSubtable[] = [];
  const checkboxes: DetectedCheckboxGroup[] = [];

  for (const tbl of tables) {
    let currentStartRow = -1;
    let currentEndRow = -1;
    let currentHeaderRow: number | undefined;
    let currentLabel = "";
    let currentCount = 0;
    let lastItemNumber = 0;

    const flushSubtable = () => {
      if (currentCount >= 2 && currentStartRow >= 0 && currentEndRow >= currentStartRow) {
        subtables.push({
          table_index: tbl.index,
          label: currentLabel || `Subtabela de Itens (T${tbl.index})`,
          ...(currentHeaderRow !== undefined ? { header_row: currentHeaderRow } : {}),
          start_row: currentStartRow,
          end_row: currentEndRow,
          item_count: currentCount,
          sample_coords: [
            `T${tbl.index}.R${currentStartRow}`,
            `T${tbl.index}.R${currentEndRow}`,
          ],
        });
      }
      currentStartRow = -1;
      currentEndRow = -1;
      currentHeaderRow = undefined;
      currentLabel = "";
      currentCount = 0;
      lastItemNumber = 0;
    };

    for (let rIdx = 0; rIdx < tbl.rows.length; rIdx++) {
      const row = tbl.rows[rIdx];
      const physicalCells = row.cells.filter((c) => !c.isSpanPlaceholder);
      if (physicalCells.length < 2) {
        flushSubtable();
        continue;
      }

      let detectedItemNum: number | null = null;
      let labelCandidate = "";

      for (let cIdx = 0; cIdx < Math.min(physicalCells.length, 3); cIdx++) {
        const cell = physicalCells[cIdx];
        const txt = cell.text.trim().replace(/\r?\n/g, " ");
        if (cIdx === 0 && (cell.rowSpan === "restart" || cell.rowSpan === "continue") && txt && !/^(?:item\s*)?0*\d{1,3}[\.\)]?$/i.test(txt)) {
          labelCandidate = txt;
          continue;
        }
        const m = txt.match(/^(?:item\s*)?0*(\d{1,3})[\.\)]?$/i);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num >= 1 && num <= 500) {
            detectedItemNum = num;
            break;
          }
        }
      }

      if (detectedItemNum !== null) {
        if (currentCount === 0) {
          if (detectedItemNum === 1 || (rIdx > 0 && /item|descri[çc][ãa]o|especifica[çc][ãa]o|unid|qtd|quant/i.test(tbl.rows[rIdx - 1].cells.map((c) => c.text).join(" ")))) {
            currentStartRow = row.rowIndex;
            currentEndRow = row.rowIndex;
            currentCount = 1;
            lastItemNumber = detectedItemNum;
            if (rIdx > 0) {
              const prevRowText = tbl.rows[rIdx - 1].cells
                .filter((c) => !c.isSpanPlaceholder)
                .map((c) => c.text.trim())
                .join(" ");
              if (/item|descri[çc][ãa]o|especifica[çc][ãa]o|unid|qtd|quant|catmat|catser|sku/i.test(prevRowText)) {
                currentHeaderRow = tbl.rows[rIdx - 1].rowIndex;
              }
            }
            if (labelCandidate) {
              currentLabel = labelCandidate;
            } else if (currentHeaderRow !== undefined) {
              const hdrCells = tbl.rows[rIdx - 1].cells.filter((c) => !c.isSpanPlaceholder);
              if (hdrCells[0] && (hdrCells[0].rowSpan === "restart" || hdrCells[0].rowSpan === "continue") && hdrCells[0].text.trim()) {
                currentLabel = hdrCells[0].text.trim().replace(/\r?\n/g, " ");
              }
            }
          }
        } else if (detectedItemNum === lastItemNumber + 1) {
          currentEndRow = row.rowIndex;
          currentCount++;
          lastItemNumber = detectedItemNum;
          if (!currentLabel && labelCandidate) {
            currentLabel = labelCandidate;
          }
        } else if (detectedItemNum === 1) {
          flushSubtable();
          currentStartRow = row.rowIndex;
          currentEndRow = row.rowIndex;
          currentCount = 1;
          lastItemNumber = 1;
          if (labelCandidate) currentLabel = labelCandidate;
        } else {
          flushSubtable();
        }
      } else {
        const rowTextJoined = physicalCells.map((c) => c.text.trim()).join(" ");
        if (
          currentCount >= 1 &&
          /item\s+n[ãa]o\s+aplic[áa]vel|n[ãa]o\s+aplic[áa]vel\s+ao\s+escopo/i.test(rowTextJoined)
        ) {
          currentEndRow = row.rowIndex;
          currentCount++;
          lastItemNumber++;
        } else {
          flushSubtable();
        }
      }
    }
    flushSubtable();

    const checkboxTokenRegex =
      /(?:([☒☑✓✔])|([☐◻□])|\[\s*([xX✓✔])\s*\]|\[\s*()\s*\]|\(\s*([xX✓✔])\s*\)|\(\s*()\s*\))\s*(Sim|N[ãa]o|[A-Za-zÀ-ÿ0-9][^☒☐☑\[\(\r\n]{0,40})/gi;

    type RawCheckboxCellHit = {
      rowIndex: number;
      physicalCellIndex: number;
      coord: string;
      promptCandidate: string;
      options: Array<{
        label: string;
        coord: string;
        checked: boolean;
        raw_text: string;
      }>;
    };

    const hits: RawCheckboxCellHit[] = [];

    for (let rIdx = 0; rIdx < tbl.rows.length; rIdx++) {
      const row = tbl.rows[rIdx];
      const physicalCells = row.cells.filter((c) => !c.isSpanPlaceholder);
      let rowPromptCandidate = "";

      for (const c of physicalCells) {
        const t = c.text.trim().replace(/\r?\n/g, " ");
        if (
          t &&
          !/[☒☑☐◻□]|\[\s*[xX ]?\s*\]/.test(t) &&
          t.length >= 4 &&
          !rowPromptCandidate
        ) {
          rowPromptCandidate = t;
        }
      }

      for (const cell of physicalCells) {
        if (cell.rowSpan === "continue") continue;
        const rawText = cell.text.trim();
        if (!rawText) continue;

        const physIdx = cell.physicalCellIndex ?? cell.cellIndex;
        const coord = `T${tbl.index}.R${row.rowIndex}.C${physIdx}`;
        const cellOptions: RawCheckboxCellHit["options"] = [];

        let match: RegExpExecArray | null;
        checkboxTokenRegex.lastIndex = 0;
        while ((match = checkboxTokenRegex.exec(rawText)) !== null) {
          const isChecked = Boolean(match[1] || match[3] || match[5]);
          const labelRaw = (match[7] || "").trim().replace(/[.;,:]+$/, "");
          if (!labelRaw) continue;
          cellOptions.push({
            label: labelRaw,
            coord,
            checked: isChecked,
            raw_text: match[0].trim(),
          });
        }

        if (cellOptions.length > 0) {
          hits.push({
            rowIndex: row.rowIndex,
            physicalCellIndex: physIdx,
            coord,
            promptCandidate:
              rowPromptCandidate || `T${tbl.index}.R${row.rowIndex}`,
            options: cellOptions,
          });
        }
      }
    }

    let hIdx = 0;
    while (hIdx < hits.length) {
      const curr = hits[hIdx];
      const combinedOptions = [...curr.options];
      let prompt = curr.promptCandidate;

      while (hIdx + 1 < hits.length) {
        const next = hits[hIdx + 1];
        const sameRow = next.rowIndex === curr.rowIndex;
        const adjRow =
          next.rowIndex === curr.rowIndex + 1 &&
          curr.options.length === 1 &&
          next.options.length === 1 &&
          /^(?:sim|n[ãa]o)$/i.test(curr.options[0].label) &&
          /^(?:sim|n[ãa]o)$/i.test(next.options[0].label);

        if (sameRow || adjRow) {
          combinedOptions.push(...next.options);
          if (
            (!prompt || prompt.startsWith(`T${tbl.index}.R`)) &&
            next.promptCandidate &&
            !next.promptCandidate.startsWith(`T${tbl.index}.R`)
          ) {
            prompt = next.promptCandidate;
          }
          hIdx++;
        } else {
          break;
        }
      }

      checkboxes.push({
        table_index: tbl.index,
        prompt: prompt.length > 120 ? `${prompt.slice(0, 117)}...` : prompt,
        options: combinedOptions,
      });
      hIdx++;
    }
  }

  return { subtables, checkboxes };
}

// ============================================================================
// Utilitários de Formato e Magic Bytes
// ============================================================================

export function isZipBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 4) return false;
  return (
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)
  );
}

export function isTextOrMarkdownFile(filePath: string, buf: Buffer): boolean {
  const lower = filePath.toLowerCase();
  if (
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".text") ||
    lower.endsWith(".log")
  ) {
    return true;
  }
  if (
    lower.endsWith(".docx") ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".zip") ||
    lower.endsWith(".tar") ||
    lower.endsWith(".gz")
  ) {
    return false;
  }
  if (isZipBuffer(buf) || isPdfBuffer(buf)) {
    return false;
  }
  const checkLen = Math.min(buf.length, 512);
  for (let i = 0; i < checkLen; i++) {
    if (buf[i] === 0x00) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// Formatação de Retorno Sintético (< 900 bytes — Lei 2)
// ============================================================================

export function formatInspectDocSyntheticResult(
  filePath: string,
  outputPath: string | undefined,
  inspection: InspectResult
): InspectDocSyntheticResult {
  let totalRows = 0;
  for (const table of inspection.tables ?? []) {
    totalRows += table.rows.length;
  }

  const toc_summary: Array<{ coord: string; title: string; target?: string }> =
    [];
  const tocMap = inspection.toc_map;
  if (tocMap) {
    for (const s of tocMap.sections.slice(0, 2)) {
      toc_summary.push({
        coord: s.coord,
        title: s.title.length > 25 ? `${s.title.slice(0, 22)}...` : s.title,
        ...(s.suggested_target_slot ? { target: s.suggested_target_slot } : {}),
      });
    }
    for (const f of tocMap.form_fields.slice(0, 1)) {
      toc_summary.push({
        coord: f.coord,
        title: f.title.length > 25 ? `${f.title.slice(0, 22)}...` : f.title,
        ...(f.suggested_target_slot ? { target: f.suggested_target_slot } : {}),
      });
    }
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
    ? toShortDocPath(inspection.audit_view_path)
    : undefined;

  const relDossiePath = inspection.dossie_hotspots_path
    ? toShortDocPath(inspection.dossie_hotspots_path)
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
              adapted_manifest_path: toShortDocPath(
                inspection.template_match.adapted_manifest_path
              ),
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
      : inspection.doc_type === "markdown" || inspection.doc_type === "text"
      ? "Texto/MD inspecionado com Cartografia e Radar Z1..Z14. Consulte visao_auditoria_*.md. Minutas binárias originais em .user_uploaded têm prioridade."
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
    ...(outputPath ? { outputPath } : {}),
    ...(inspection.doc_type && inspection.doc_type !== "docx"
      ? {
          doc_type: inspection.doc_type,
          page_count: inspection.page_count,
          line_count: inspection.line_count,
        }
      : {}),
    tables: inspection.tables?.length ?? 0,
    rows: totalRows,
    paragraphs: inspection.paragraphs?.length ?? 0,
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
    result.filePath
  ) {
    delete result.docxPath;
  }

  if (Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 900) {
    result.filePath = toShortDocPath(result.filePath);
    result.outputPath = toShortDocPath(result.outputPath);
    if (result.audit_view_path) {
      result.audit_view_path = toShortDocPath(result.audit_view_path);
    }
    if (result.dossie_path) {
      result.dossie_path = toShortDocPath(result.dossie_path);
    }
    if (result.template_match?.adapted_manifest_path) {
      result.template_match.adapted_manifest_path = toShortDocPath(
        result.template_match.adapted_manifest_path
      );
    }
  }

  if (
    Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 900 &&
    result.dossie_path
  ) {
    delete result.dossie_path;
  }

  if (
    Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 900 &&
    result.next_step_hint &&
    result.next_step_hint.length > 55
  ) {
    if (result.next_step_hint.includes("Cache reconhecido")) {
      const st = result.template_match?.status ?? "EXACT";
      const slots = result.template_match?.slots_count ?? 0;
      result.next_step_hint = `Cache ${st} (${slots} slots). Siga para 'build_docx_template'.`;
    } else {
      result.next_step_hint = "Inspeção gravada. Siga para 'build_docx_template'.";
    }
  }

  return result;
}

export const formatInspectDocxSyntheticResult = formatInspectDocSyntheticResult;
