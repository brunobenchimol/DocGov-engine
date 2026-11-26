import { VERSION } from "../../constants/index.ts";
import { formatCentsToCurrency } from "../../core/budget_auditor.ts";
import { formatCompactMcpPath } from "../../utils/json.ts";
import type {
  DocxInspectionResult,
  InspectResult,
  InspectDocSyntheticResult,
  InspectDocxSyntheticResult,
  TemplateMatchResult,
} from "../../types/index.ts";
import { toShortDocPath } from "./toc_and_compactor.ts";
import { isPdfBuffer } from "../../utils/pdf.ts";

export { detectTableSubtablesAndCheckboxes } from "./subtable_checkbox_detector.ts";
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
    nextHint = `Diff concluído (+${diff.total_added} / -${diff.total_removed} / ~${diff.total_modified}). Relatório: ${
      diff.diff_report_path ? formatCompactMcpPath(diff.diff_report_path) : ""
    }.`;
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
              ? formatCompactMcpPath(inspection.diff_result.diff_report_path)
              : undefined,
          },
        }
      : {}),
    ...(inspection.scanned_pages_detected &&
    inspection.scanned_pages_detected.length > 0
      ? { scanned_pages: inspection.scanned_pages_detected }
      : {}),
    ...(inspection.hybrid_scan_pages &&
    inspection.hybrid_scan_pages.length > 0
      ? { hybrid_scan_pages_count: inspection.hybrid_scan_pages.length }
      : {}),
    ...(inspection.extracted_images_manifest &&
    inspection.extracted_images_manifest.length > 0
      ? {
          assets_extracted_count: inspection.extracted_images_manifest.length,
        }
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
