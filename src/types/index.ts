// ============================================================================
// Interfaces e Tipos do Motor docgov-docx
// ============================================================================

export interface ParagraphNumberingInfo {
  numId: string;
  level: number;
}

export interface HeaderFooterParagraphInfo {
  part: string;
  index: number;
  paragraphIndex: number;
  style: string | null;
  text: string;
  numbering?: ParagraphNumberingInfo;
}

export interface BodyParagraphInfo {
  index: number;
  style: string | null;
  text: string;
  numbering?: ParagraphNumberingInfo;
}

export interface TableCellInfo {
  cellIndex: number;
  text: string;
}

export interface TableRowInfo {
  rowIndex: number;
  cells: TableCellInfo[];
}

export interface TableInfo {
  index: number;
  rows: TableRowInfo[];
}

export interface TocParagraphItem {
  coord: string;
  title: string;
  suggested_target_slot?: string;
}

export interface TocFormCellItem {
  coord: string;
  title: string;
  suggested_target_slot?: string;
}

export interface TocTableItem {
  table_index: number;
  rows: number;
  cols: number;
  headers: string[];
  sample_row_coord?: string;
}

export interface DocxTocMap {
  sections: TocParagraphItem[];
  form_fields: TocFormCellItem[];
  tables: TocTableItem[];
}

export interface TableFingerprint {
  index: number;
  rows: number;
  cols: number;
  coord: string; // Ex: "T0"
  headers: string[]; // Cabeçalhos normalizados da R0
}

export interface FormFieldFingerprint {
  coord: string; // Ex: "T0.R4.C0"
  label_normalized: string;
  original_label: string;
  suggested_target_slot?: string;
}

export interface StructureFingerprint {
  tables: TableFingerprint[];
  sections: string[]; // Títulos de seções normalizados (ex.: ["estudo tecnico preliminar", "1. descricao da necessidade"])
  form_fields: FormFieldFingerprint[];
}

export interface TemplateRegistryEntry {
  template_id: string;
  name?: string;
  description?: string;
  created_at: string;
  structure_fingerprint: StructureFingerprint;
  manifest: SlotsManifest;
  registry_path?: string;
}

export interface TemplateMatchResult {
  status: "EXACT" | "MODIFIED" | "NEW";
  similarity: number;
  template_id?: string;
  registry_path?: string;
  adapted_manifest_path?: string;
  shift_summary?: string;
  message?: string;
}

export interface DocxInspectionResult {
  toc_map?: DocxTocMap;
  structure_fingerprint?: StructureFingerprint;
  template_match?: TemplateMatchResult;
  audit_view_path?: string;
  headers: HeaderFooterParagraphInfo[];
  footers: HeaderFooterParagraphInfo[];
  paragraphs: BodyParagraphInfo[];
  tables: TableInfo[];
}

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
  replace_inline?: ReplaceInlineRule[];
  [key: string]: any;
}

export interface BuildDocxTemplateBreakdown {
  replace_paragraphs: number;
  loop_paragraphs: number;
  replace_table_cells: number;
  loop_table_rows: number;
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
  template_match?: TemplateMatchResult;
  audit_view_path?: string;
}

export interface BootstrapCaseResult {
  status: "success";
  caseDir: string;
  copiedFiles: string[];
  backgroundFiles: string[];
  backgroundCopy: BackgroundCopyInfo;
  inspectedDocx: BootstrapCaseInspectedDocx[];
  ingestedFiles?: IngestedFileSummary[];
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

export interface BootstrapCaseSyntheticResult {
  status: "success";
  caseDir: string;
  ingested_files?: IngestedFileSyntheticItem[];
  docx_inspected: BootstrapCaseSyntheticDocx[];
  background_copy: {
    status: "active" | "started" | "idle" | "completed" | "partial_error";
    message: string;
  };
  next_step_hint: string;
}

export interface InspectDocxSyntheticResult {
  status: "success";
  docxPath: string;
  outputPath: string;
  tables: number;
  rows: number;
  paragraphs: number;
  template_match?: TemplateMatchResult;
  audit_view_path?: string;
  toc_summary?: Array<{
    coord: string;
    title: string;
    target?: string;
  }>;
  next_step_hint: string;
}

export interface BuildDocxTemplateSyntheticResult {
  status: "success";
  outputPath: string;
  applied_slots_count: number;
  breakdown: BuildDocxTemplateBreakdown;
  registryPath?: string;
  message: string;
  next_step_hint: string;
}

export interface AuditDocumentExcerpt {
  secao_legivel?: string;
  texto_transcrito?: string;
  [key: string]: any;
}

export interface AuditFinding {
  id?: string;
  severidade?: string;
  status?: string;
  titulo_apontamento?: string;
  vulnerabilidade?: string;
  base_legal?: string;
  localizacao?: string;
  trechos_documento?: AuditDocumentExcerpt[];
  trecho_impugnado?: string;
  risco_controle_externo?: string;
  analise_risco?: string;
  redacao_saneadora_sugerida?: string;
  redacao_saneadora?: string;
  [key: string]: any;
}

export interface AuditReportData {
  processo_id?: string;
  orgao_entidade?: string;
  artefato_auditado?: string;
  regime_juridico?: string;
  iteracao_auditoria?: number | string;
  status_global?: string;
  contagem?: {
    bloqueantes?: number;
    alertas?: number;
    conformes?: number;
  };
  resumo_executivo?: string;
  apontamentos?: AuditFinding[];
  [key: string]: any;
}

