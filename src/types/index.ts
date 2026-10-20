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
  created_at?: string;
  updated_at?: string;
  engine_version?: string;
  slots_count?: number;
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
  created_at?: string;
  updated_at?: string;
  age_days?: number | null;
  cache_date_status?: "KNOWN" | "UNKNOWN";
  engine_version?: string;
  slots_count?: number;
  message?: string;
}

export interface PdfLineItem {
  page: number;
  line: number;
  coord: string; // Ex: "PAG_001 | L0001"
  bracket_coord: string; // Ex: "[PAG_001 | L0001]"
  text: string;
}

export interface PdfPageInfo {
  pageNumber: number;
  lines: PdfLineItem[];
}

export interface PdfExtractionResult {
  pageCount: number;
  lineCount: number;
  pages: PdfPageInfo[];
  lines: PdfLineItem[];
  scanned_pages_detected?: number[];
}

export interface OutlineHeadingItem {
  coord: string; // Ex: "[PAG_001 | L0001]" ou "[P0]"
  title: string;
  page?: number;
  line?: number;
}

export interface PageSignalItem {
  page?: number;
  coord_range: string; // Ex: "[PAG_002 | L0010]..[PAG_002 | L0025]" ou "[T0]..[T1]"
  signal_type: "ORCAMENTO_ITENS" | "ESPECIFICACAO_TECNICA" | "MISTO";
  budget_score: number;
  tech_spec_score: number;
  matched_terms: string[];
}

export type ImpugnationZoneId =
  | "Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO"
  | "Z2_QUALIFICACAO_TECNICA_ATESTADOS"
  | "Z3_QUALIFICACAO_ECONOMICA_GARANTIAS"
  | "Z4_VISTORIA_VISITA_TECNICA"
  | "Z5_AMOSTRA_POC_HOMOLOGACAO"
  | "Z6_VINCULO_FABRICANTE_SOLIDARIEDADE"
  | "Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP"
  | "Z8_PRAZOS_ENTREGA_SLA_GARANTIA"
  | "Z9_EQUIPE_CERTIFICACOES_SEDE"
  | "Z10_PRECOS_EXEQUIBILIDADE_PLANILHA"
  | "Z11_PAGAMENTO_REAJUSTE_IMR_SANCOES"
  | "Z12_MAPA_CRUZADO_MULTIPECA"
  | "Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO"
  | "Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO";

export interface ImpugnationZoneHit {
  coord: string; // Ex: "[PAG_001 | L0005]" ou "[P3]"
  keyword: string;
  snippet: string; // Até 90 chars
  section?: string;
}

export type ImpugnationZonesMap = Record<ImpugnationZoneId, ImpugnationZoneHit[]>;

export interface DocumentCartography {
  outline_headings: OutlineHeadingItem[];
  page_signals: PageSignalItem[];
  impugnation_zones: ImpugnationZonesMap;
}

export interface DocxInspectionResult {
  doc_type?: "docx" | "pdf";
  page_count?: number;
  line_count?: number;
  outline_headings?: OutlineHeadingItem[];
  page_signals?: PageSignalItem[];
  impugnation_zones?: ImpugnationZonesMap;
  toc_map?: DocxTocMap;
  structure_fingerprint?: StructureFingerprint;
  template_match?: TemplateMatchResult;
  audit_view_path?: string;
  dossie_hotspots_path?: string;
  scanned_pages_detected?: number[];
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

export interface BootstrapCaseInspectedPdf {
  fileName: string;
  pdfPath: string;
  structurePath: string;
  audit_view_path?: string;
  dossie_hotspots_path?: string;
  scanned_pages_detected?: number[];
  pageCount: number;
  lineCount: number;
  outlineHeadingsCount: number;
  activeZonesCount: number;
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

export interface BootstrapCaseSyntheticResult {
  status: "success";
  engine_version: string;
  caseDir: string;
  master_index_path?: string;
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
  next_step_hint: string;
}

export interface InspectDocxSyntheticResult {
  status: "success";
  engine_version: string;
  docxPath: string;
  outputPath: string;
  doc_type?: "docx" | "pdf";
  page_count?: number;
  line_count?: number;
  tables: number;
  rows: number;
  paragraphs: number;
  template_match?: TemplateMatchResult;
  audit_view_path?: string;
  dossie_path?: string;
  scanned_pages?: number[];
  toc_summary?: Array<{
    coord: string;
    title: string;
    target?: string;
  }>;
  next_step_hint: string;
}

export interface BuildDocxTemplateSyntheticResult {
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

export interface FillDocxTemplateSyntheticResult {
  status: "success";
  engine_version: string;
  outputPath: string;
  pdf_path?: string;
  inspection_path?: string;
  visao_auditoria_path?: string;
  message: string;
  next_step_hint: string;
}

export interface GenerateAuditDocxOptions {
  outputFormat?: "docx" | "pdf" | "both";
  pdfTimeoutMs?: number;
}

export interface GenerateAuditDocxSyntheticResult {
  status: "success";
  engine_version: string;
  outputPath: string;
  pdf_path?: string;
  message: string;
  next_step_hint: string;
}

export type AuditDocxSyntheticResult = GenerateAuditDocxSyntheticResult;

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

