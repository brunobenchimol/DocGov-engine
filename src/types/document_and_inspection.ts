// ============================================================================
// Interfaces e Tipos do Motor docgov-docx — Documentos, Cartografia e Inspeção
// ============================================================================

import type { SlotsManifest } from "./template_and_bootstrap.ts";
import type { BudgetAuditReport, StructuralDiffResult } from "./audit_diff_and_pncp.ts";

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
  physicalCellIndex?: number;
  virtualColIndex?: number;
  text: string;
  colSpan?: number;
  rowSpan?: string;
  isSpanPlaceholder?: boolean;
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

export type PdfPageClass =
  | "BORN_DIGITAL"
  | "FULL_PAGE_SCAN"
  | "HYBRID_HEADER_SCAN_TRAP"
  | "EMBEDDED_VISUAL_ASSET"
  | "OCR_LAYER_EMBEDDED";

export interface PdfPageInspectionDetail {
  page: number;
  page_class: PdfPageClass;
  visible_chars: number;
  invisible_text_length: number;
  image_count: number;
  image_coverage: number;
}

export interface ExtractedPdfImageAsset {
  page: number;
  asset_index: number;
  asset_id: string;
  page_class: PdfPageClass;
  coverage_pct: number;
  width: number;
  height: number;
  sha256: string;
  saved_path?: string;
  relative_path?: string;
  png_data?: Buffer;
}

export interface PdfPadesSignatureDetail {
  signature_index: number;
  byte_range?: [number, number, number, number];
  covers_eof: boolean;
  post_signature_bytes: number;
  post_signature_classification:
    | "NONE"
    | "BENIGN_CO_SIGNATURE_OR_TIMESTAMP"
    | "SUSPECT_INCREMENTAL_TAMPERING";
  digest_algorithm?: string;
  message_digest_hex?: string;
  computed_byte_range_hash_hex?: string;
  digest_verified?: boolean;
  subject_cn: string | null;
  issuer_cn: string | null;
  subject_dn: string | null;
  issuer_dn: string | null;
  icp_brasil_cpf: string | null;
  icp_brasil_cnpj: string | null;
  not_before_iso: string | null;
  not_after_iso: string | null;
  is_self_signed: boolean;
  is_trusted_icp_chain: boolean;
  anomalies: string[];
}

export interface DocumentForensicMeta {
  source_format: "pdf" | "docx" | "xlsx";
  title: string | null;
  author: string | null;
  last_modified_by: string | null;
  creator_tool: string | null;
  producer: string | null;
  company: string | null;
  template: string | null;
  revision_count: number | null;
  creation_date_iso: string | null;
  mod_date_iso: string | null;
  has_digital_signature: boolean;
  signature_date_iso: string | null;
  editing_software_traces: string[];
  forensic_anomalies: string[];
  links_detected_count?: number;
  pades_signatures?: PdfPadesSignatureDetail[];
  rsid_root?: string | null;
  rsid_sample?: string[];
  rsid_unique_count?: number;
}

export interface PdfExtractionResult {
  pageCount: number;
  lineCount: number;
  pages: PdfPageInfo[];
  lines: PdfLineItem[];
  scanned_pages_detected?: number[];
  hybrid_scan_pages?: number[];
  page_inspection_summary?: PdfPageInspectionDetail[];
  extracted_images?: ExtractedPdfImageAsset[];
  skipped_decorative_images_count?: number;
  forensic_meta?: DocumentForensicMeta;
  pdf_forensic_meta?: DocumentForensicMeta;
  ocr_applied?: boolean;
  ocr_pages?: number[];
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

export interface DetectedItemSubtable {
  table_index: number;
  header_row?: number;
  from_row: number;
  to_row: number;
  item_count: number;
  number_col_index: number;
}

export interface DetectedCheckboxGroup {
  coord: string;
  table_index: number;
  start_row: number;
  end_row: number;
  prompt: string;
  options_summary: string;
}

export type PostCompileAlertCode =
  | "UNREMOVED_ITEM_WORKAROUND"
  | "RAW_MARKDOWN_TABLE"
  | "CONTRADICTORY_CHECKBOXES"
  | "HARDWARE_DONOR_CONTAMINATION"
  | "PARTIAL_ITEM_ROW_CONTAMINATION"
  | "UNCALCULATED_TOTAL_ROW"
  | "MULTILEVEL_NUMBERING_RESET"
  | "DUPLICATE_CONFLICTING_SLA_TABLES";

export interface PostCompileIntegrityAlert {
  code: PostCompileAlertCode;
  category?: string;
  severity: "CRITICAL" | "HIGH" | "WARNING";
  coords?: string[];
  coord?: string;
  excerpt?: string;
  message?: string;
  recommendation?: string;
  remediation_hint?: string;
}

export interface DocxInspectionResult {
  doc_type?: "docx" | "pdf" | "xlsx" | "csv" | "spreadsheet" | "markdown" | "text";
  format?: string;
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
  hybrid_scan_pages?: number[];
  page_inspection_summary?: PdfPageInspectionDetail[];
  extracted_images_manifest?: Array<Omit<ExtractedPdfImageAsset, "png_data">>;
  skipped_decorative_images_count?: number;
  forensic_meta?: DocumentForensicMeta;
  pdf_forensic_meta?: DocumentForensicMeta;
  ocr_applied?: boolean;
  ocr_pages?: number[];
  headers: HeaderFooterParagraphInfo[];
  footers: HeaderFooterParagraphInfo[];
  paragraphs: BodyParagraphInfo[];
  tables: TableInfo[];
  budget_audit?: BudgetAuditReport;
  diff_result?: StructuralDiffResult;
  detected_subtables?: DetectedItemSubtable[];
  detected_checkboxes?: DetectedCheckboxGroup[];
  post_compile_alerts?: PostCompileIntegrityAlert[];
  comments_count?: number;
  comments_unmatched?: string[];
}

export type InspectResult = DocxInspectionResult;
