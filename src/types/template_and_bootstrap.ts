// ============================================================================
// Interfaces de Templates, Updater, Bootstrap e Envelopes Sintéticos
// ============================================================================

import type {
  DocumentForensicMeta,
  DocxInspectionResult,
  TemplateMatchResult,
} from "./document_and_inspection.ts";

export interface ReplaceParagraphRule {
  start_p: number;
  end_p: number;
  tag: string;
}

export interface LoopParagraphsRule {
  start_p: number;
  end_p: number;
  for_open_tag: string;
  for_close_tag: string;
  item_tag: string;
}

export interface ReplaceTableCellRule {
  table_index: number;
  row_index: number;
  cell_index: number;
  tag: string;
}

export interface LoopTableRowsRule {
  table_index: number;
  header_row_index: number;
  template_row_index: number;
  remove_from_row?: number;
  remove_to_row?: number;
  for_open_tag: string;
  for_close_tag: string;
  cell_tags: string[];
}

export interface ReplaceInlineRule {
  find: string;
  replace: string;
}

export interface RemoveTableRowsRule {
  table_index: number;
  from_row: number;
  to_row: number;
}

export interface CompactSlotRule {
  coord?: string;
  tag?: string;
  table_index?: number;
  row_index?: number;
  cell_index?: number;
  col_index?: number;
  column_index?: number;
  table?: number;
  row?: number;
  col?: number;
  start_p?: number;
  end_p?: number;
  paragraph_index?: number;
  p_index?: number;
  for_open_tag?: string;
  for_close_tag?: string;
  item_tag?: string;
  cell_tags?: string[];
  from_row?: number;
  to_row?: number;
  start_row?: number;
  end_row?: number;
  remove_from_row?: number;
  remove_to_row?: number;
  header_row_index?: number;
  template_row_index?: number;
  find?: string;
  replace?: string;
  [key: string]: any;
}

export interface SlotsManifest {
  slots?: CompactSlotRule[];
  replace_paragraphs?: ReplaceParagraphRule[];
  loop_paragraphs?: LoopParagraphsRule[];
  replace_table_cells?: ReplaceTableCellRule[];
  loop_table_rows?: LoopTableRowsRule[];
  remove_table_rows?: RemoveTableRowsRule[];
  replace_inline?: ReplaceInlineRule[];
  [key: string]: any;
}

export interface BuildDocxTemplateBreakdown {
  replace_paragraphs: number;
  loop_paragraphs: number;
  replace_table_cells: number;
  loop_table_rows: number;
  remove_table_rows?: number;
  replace_inline: number;
}

export interface BuildDocxTemplateResult {
  success: boolean;
  message: string;
  registryPath?: string;
  applied_slots_count: number;
  breakdown: BuildDocxTemplateBreakdown;
}

export interface BuildDocxTemplateOptions {
  saveToRegistry?: boolean;
  templateId?: string;
  registryDir?: string;
}

export interface SelfUpdateOptions {
  checkOnly?: boolean;
  force?: boolean;
  targetPath?: string;
  token?: string;
  skipChecksumVerification?: boolean;
}

export interface ReleaseInfo {
  tag: string;
  version: string;
  downloadUrl: string;
  apiUrl?: string;
  assetName: string;
  sha256sumsDownloadUrl?: string;
  sha256sumsApiUrl?: string;
  token?: string;
}

export interface Sha256VerificationResult {
  valid: boolean;
  expectedHash?: string;
  actualHash: string;
  assetFoundInManifest: boolean;
  message?: string;
}

export interface SelfUpdateResult {
  updated: boolean;
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  targetPath: string;
  message: string;
}

export interface BackgroundCopyInfo {
  status: "started" | "idle" | "completed";
  totalFiles: number;
  files: string[];
  message: string;
}

export interface SalvaguardaStatus {
  status: "in_progress" | "completed" | "partial_error";
  totalFiles: number;
  pendingFiles: string[];
  completedFiles: string[];
  failedFiles: Array<{ file: string; error: string }>;
  startedAt: string;
  updatedAt?: string;
}

export interface BackgroundCopyFileItem {
  source: string;
  target: string;
}

export type BackgroundCopyInput = string[] | BackgroundCopyFileItem[];

export interface IngestedFileSummary {
  original_name: string;
  saved_as: string;
  detected_type: string;
  structure_json?: string;
}

export interface IngestedFileSyntheticItem {
  original: string;
  saved_as: string;
  type: string;
  structure?: string;
}

export interface BootstrapCaseOptions {
  fileRenameMap?: Record<string, string>;
  waitBackground?: boolean;
  detachedCli?: boolean;
}

export interface BootstrapCaseInspectedDocx {
  fileName: string;
  docxPath: string;
  structurePath: string;
  tablesCount: number;
  paragraphsCount: number;
  compactStructure: DocxInspectionResult;
  forensic_meta?: DocumentForensicMeta;
  template_match?: TemplateMatchResult;
  audit_view_path?: string;
}

export interface BootstrapCaseInspectedPdf {
  fileName: string;
  pdfPath: string;
  structurePath: string;
  audit_view_path?: string;
  dossie_hotspots_path?: string;
  scanned_pages_detected?: number[];
  hybrid_scan_pages?: number[];
  assets_extracted_count?: number;
  forensic_meta?: DocumentForensicMeta;
  pageCount: number;
  lineCount: number;
  outlineHeadingsCount: number;
  activeZonesCount: number;
}

export interface UnpackedArchiveSummary {
  archiveName: string;
  archiveType: "zip" | "tar" | "tar.gz";
  extractedCount: number;
  files: Array<{
    originalEntryName: string;
    savedAs: string;
    size: number;
  }>;
}

export interface BootstrapCaseResult {
  status: "success";
  caseDir: string;
  copiedFiles: string[];
  backgroundFiles: string[];
  backgroundCopy: BackgroundCopyInfo;
  inspectedDocx: BootstrapCaseInspectedDocx[];
  inspectedPdf?: BootstrapCaseInspectedPdf[];
  ingestedFiles?: IngestedFileSummary[];
  unpacked_archives?: UnpackedArchiveSummary[];
  failed_inspections?: Array<{ fileName: string; type: string; error: string }>;
  other_files?: Array<{ fileName: string; extension: string; size: number }>;
  indice_mestre_path?: string;
}

export interface BootstrapCaseSyntheticDocx {
  filename: string;
  structure_json: string;
  tables_count: number;
  paragraphs_count: number;
  template_match?: {
    status: "EXACT" | "MODIFIED" | "NEW";
    template_id?: string;
    similarity?: number;
  };
  audit_view_path?: string;
}

export type McpDeliveryMode = "INLINE" | "POINTER" | "SUMMARY";

export interface McpDeliveryEnvelopeFields {
  delivery_mode?: McpDeliveryMode;
  read_file_required?: boolean;
  artifact_path?: string;
  artifact_size_kb?: number;
  artifact_lines?: number;
  inline_markdown?: string;
  next_step_hint?: string;
}

export interface BootstrapCaseSyntheticResult extends McpDeliveryEnvelopeFields {
  status: "success";
  engine_version: string;
  caseDir: string;
  master_index_path?: string;
  unpacked_archives_count?: number;
  extracted_files_count?: number;
  ingested_files?: IngestedFileSyntheticItem[];
  docx_inspected: BootstrapCaseSyntheticDocx[];
  pdf_inspected?: Array<{
    filename: string;
    structure_json: string;
    audit_view_path?: string;
    page_count: number;
    line_count: number;
  }>;
  background_copy: {
    status: "active" | "started" | "idle" | "completed" | "partial_error";
    message: string;
  };
  inspection_errors_count?: number;
  next_step_hint: string;
}

export interface InspectDocSyntheticResult extends McpDeliveryEnvelopeFields {
  status: "success";
  engine_version: string;
  filePath: string;
  docxPath?: string;
  outputPath?: string;
  doc_type?: "docx" | "pdf" | "xlsx" | "csv" | "spreadsheet" | "markdown" | "text";
  format?: string;
  page_count?: number;
  line_count?: number;
  tables: number;
  rows: number;
  paragraphs: number;
  template_match?: TemplateMatchResult;
  audit_view_path?: string;
  dossie_path?: string;
  scanned_pages?: number[];
  hybrid_scan_pages_count?: number;
  assets_extracted_count?: number;
  ocr_applied?: boolean;
  toc_summary?: Array<{
    coord: string;
    title: string;
    target?: string;
  }>;
  budget_audit?: {
    tables_checked: number;
    items_checked: number;
    math_errors: number;
    rounding_warnings: number;
    divergence?: string;
  };
  diff_summary?: {
    added: number;
    removed: number;
    modified: number;
    report?: string;
  };
  next_step_hint: string;
}

export type InspectDocxSyntheticResult = InspectDocSyntheticResult;

export interface BuildDocxTemplateSyntheticResult extends McpDeliveryEnvelopeFields {
  status: "success";
  engine_version: string;
  outputPath: string;
  applied_slots_count: number;
  breakdown: BuildDocxTemplateBreakdown;
  registryPath?: string;
  message: string;
  next_step_hint: string;
}

export interface ProcessDocumentOptions {
  autoInspect?: boolean;
  stateDir?: string;
  inspectionOutputPath?: string;
  outputFormat?: "docx" | "pdf" | "both";
  pdfTimeoutMs?: number;
}

export interface ProcessDocumentResult {
  success: boolean;
  message: string;
  outputPath: string;
  pdf_path?: string;
  tier_used?: string;
  inspection_path?: string;
  visao_auditoria_path?: string;
  next_step_hint: string;
}

export interface FillDocxTemplateSyntheticResult extends McpDeliveryEnvelopeFields {
  status: "success";
  engine_version: string;
  outputPath: string;
  pdf_path?: string;
  inspection_path?: string;
  visao_auditoria_path?: string;
  message: string;
  next_step_hint: string;
}
