// ============================================================================
// Interfaces de Auditoria, Nota Técnica, Orçamento, Diff Estrutural e PNCP
// ============================================================================

import type { ImpugnationZoneId } from "./document_and_inspection.ts";
import type { UnpackedArchiveSummary } from "./template_and_bootstrap.ts";

export interface GenerateAuditDocxOptions {
  outputFormat?: "docx" | "pdf" | "both";
  pdfTimeoutMs?: number;
}

export type AuditDocumentType =
  | "AUDIT_REPORT"
  | "RISK_MATRIX"
  | "COMPLIANCE_CHECKLIST"
  | "TECHNICAL_NOTE"
  | "EVOLUTION_REPORT";

export interface RiskItem {
  id?: string;
  evento_risco: string;
  fase?: string;
  probabilidade?: string;
  impacto?: string;
  nivel_risco?: "BAIXO" | "MÉDIO" | "ALTO" | "CRÍTICO" | string;
  alocacao?: "CONTRATANTE" | "CONTRATADA" | "COMPARTILHADO" | string;
  acoes_preventivas?: string | string[];
  acoes_contingencia?: string | string[];
  responsavel?: string;
  [key: string]: any;
}

export interface ComplianceChecklistItem {
  id?: string;
  item_criterio: string;
  status:
    | "CONFORME"
    | "NÃO CONFORME"
    | "PARCIALMENTE CONFORME"
    | "NÃO APLICÁVEL"
    | string;
  fundamentacao_legal?: string;
  evidencia?: string;
  recomendacao?: string;
  [key: string]: any;
}

export type EvolutionChangeType = "MODIFICACAO" | "INCLUSAO" | "SUPRESSAO";

export interface EvolutionClauseItem {
  id: string; // Ex: "EVO-01"
  slot_id?: string; // Ex: "P14" ou "T1.R2.C1"
  coordenada?: string; // Ex: "[P14]"
  secao_titulo: string; // Ex: "Cláusula 5ª — Do Prazo de Entrega e Garantia"
  tipo_alteracao: EvolutionChangeType;
  redacao_anterior?: string;
  redacao_nova?: string;
  diff_inline?: string;
  diff_chunks?: GranularDiffChunk[];
  justificativa_tecnica: string;
  fundamentacao_juridica: string;
  apontamento_origem_id?: string; // Ex: "AUD-02"
  impacto_risco?: string;
  [key: string]: any;
}

export interface TechnicalNoteData {
  document_type?: "TECHNICAL_NOTE" | "EVOLUTION_REPORT";
  processo_id: string;
  orgao_entidade: string;
  artefato_auditado: string;
  versao_anterior?: string;
  versao_nova?: string;
  regime_juridico?: string;
  data_emissao?: string;
  autor_responsavel?: string;
  resumo_executivo: string;
  contagem?: {
    total_alteracoes?: number;
    modificadas?: number;
    incluidas?: number;
    suprimidas?: number;
    apontamentos_saneados?: number;
  };
  quadro_evolucao: EvolutionClauseItem[];
  delta_zonas?: ZoneDeltaReport[];
  conclusao_encaminhamento?: string;
  [key: string]: any;
}

export interface GenerateTechnicalNoteOptions {
  outputFormat?: "docx" | "pdf" | "both";
  pdfTimeoutMs?: number;
}

export interface GenerateTechnicalNoteSyntheticResult {
  status: "success";
  engine_version: string;
  document_type: "TECHNICAL_NOTE";
  outputPath: string;
  pdf_path?: string;
  total_changes: number;
  message: string;
  next_step_hint: string;
}

export interface GenerateAuditDocxSyntheticResult {
  status: "success";
  engine_version: string;
  document_type?: AuditDocumentType;
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
  document_type?: AuditDocumentType;
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
  matriz_riscos?: RiskItem[];
  risk_matrix?: RiskItem[];
  checklist_conformidade?: ComplianceChecklistItem[];
  compliance_checklist?: ComplianceChecklistItem[];
  versao_anterior?: string;
  versao_nova?: string;
  quadro_evolucao?: EvolutionClauseItem[];
  clausulas_evolucao?: EvolutionClauseItem[];
  delta_zonas?: ZoneDeltaReport[];
  conclusao_encaminhamento?: string;
  [key: string]: any;
}

// ============================================================================
// Auditoria Matemática Determinística de Planilhas Orçamentárias (v1.1.0)
// ============================================================================

export type BudgetDiscrepancySeverity = "MATH_ERROR" | "ROUNDING_WARNING";

export interface BudgetItemAudit {
  item_number?: string;
  description: string;
  coord: string; // Ex: "[T0.R2.C4]" ou "[PAG_002 | L0015]"
  quantity: number;
  quantity_raw: string;
  unit_cents: number;
  unit_raw: string;
  declared_total_cents: number;
  declared_total_raw: string;
  expected_total_cents: number;
  diff_cents: number;
  discrepancy_severity?: BudgetDiscrepancySeverity;
  formatted_diff?: string;
  has_error: boolean;
}

export interface BudgetTableAudit {
  table_coord: string; // Ex: "T0" ou "PAG_002"
  header_sample: string[];
  total_items: number;
  items_with_math_errors: number;
  items_with_rounding_warnings: number;
  items: BudgetItemAudit[];
  sum_declared_cents: number;
  sum_expected_cents: number;
  table_declared_total_row_cents?: number;
  table_declared_total_row_raw?: string;
  table_total_discrepancy_cents?: number;
  table_total_discrepancy_severity?: BudgetDiscrepancySeverity;
}

export interface BudgetTextCrossCheck {
  text_coord: string;
  snippet: string;
  text_value_cents: number;
  text_value_raw: string;
  table_sum_cents: number;
  diff_cents: number;
  discrepancy_severity: BudgetDiscrepancySeverity;
}

export interface BudgetAuditReport {
  has_budget_table: boolean;
  tables_checked: number;
  total_items_checked: number;
  math_errors_count: number;
  rounding_warnings_count: number;
  total_declared_cents: number;
  total_expected_cents: number;
  net_divergence_cents: number;
  tables: BudgetTableAudit[];
  text_cross_checks: BudgetTextCrossCheck[];
}

// ============================================================================
// Diff Estrutural e Semântico Multi-Versão (v1.1.0)
// ============================================================================

export type StructuralDiffChangeType = "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";

export interface GranularDiffChunk {
  type: "UNCHANGED" | "ADDED" | "REMOVED";
  text: string;
}

export interface StructuralDiffItem {
  change_type: StructuralDiffChangeType;
  coord_old?: string;
  coord_new?: string;
  section_title?: string;
  old_text?: string;
  new_text?: string;
  inline_diff?: string; // Destaque: ~~antigo~~ -> **novo**
  diff_chunks?: GranularDiffChunk[];
}

export interface ZoneDeltaReport {
  zone_id: ImpugnationZoneId;
  zone_title: string;
  status: "INTRODUCED" | "RESOLVED" | "RETAINED";
  old_occurrences_count: number;
  new_occurrences_count: number;
  details?: string;
}

export interface StructuralDiffResult {
  old_path: string;
  new_path: string;
  old_type: "docx" | "pdf";
  new_type: "docx" | "pdf";
  total_added: number;
  total_removed: number;
  total_modified: number;
  total_unchanged: number;
  changes: StructuralDiffItem[];
  zones_delta: ZoneDeltaReport[];
  diff_report_path?: string;
}

// ============================================================================
// Conector Nativo PNCP (v1.3.4)
// ============================================================================

export interface PncpIdentifier {
  cnpj: string;
  ano: string;
  sequencial: string;
  canonicalRef: string; // "${cnpj}/${ano}/${sequencial}"
}

export interface FetchPncpOptions {
  shortname?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface PncpDownloadedFileSummary {
  sequencialDocumento?: number | string;
  originalTitle: string;
  savedAs: string;
  detectedType: string;
  size: number;
  wasArchive: boolean;
  extractedFiles?: string[];
  headingsPreview?: string[];
  sectionsCount?: number;
}

export interface FetchPncpResult {
  status: "success";
  pncpRef: string;
  shortname: string;
  caseDir: string;
  targetDir: string;
  metaPath: string;
  indexPath: string;
  contractMeta: Record<string, any>;
  downloadedFiles: PncpDownloadedFileSummary[];
  unpackedArchives: UnpackedArchiveSummary[];
  filesDownloadedCount?: number;
  inspectedCount: number;
  failedInspections: Array<{ fileName: string; error: string }>;
}

export interface FetchPncpSyntheticResult {
  status: "success";
  engine_version: string;
  pncp_ref: string;
  target_dir: string;
  meta_path: string;
  index_path: string;
  files_downloaded: number;
  unpacked_archives_count: number;
  extracted_files_count: number;
  inspected_count: number;
  inspection_errors_count?: number;
  next_step_hint: string;
}

export interface SearchPncpOptions {
  status?: "recebendo_proposta" | "encerradas" | "todas";
  uf?: string;
  modalidade?: string;
  limit?: number;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface PncpSearchCandidate {
  pncp_id: string; // "${orgao_cnpj}/${ano}/${numero_sequencial}"
  numero_controle_pncp?: string;
  orgao_nome: string;
  orgao_cnpj: string;
  unidade_nome?: string;
  uf?: string;
  municipio_nome?: string;
  titulo: string;
  objeto: string;
  modalidade: string;
  valor_global?: number | null;
  data_publicacao?: string;
  situacao_nome?: string;
  pncp_url: string;
  matched_query?: string;
}

export interface SearchPncpResult {
  status: "success";
  caseDir: string;
  queriesExecuted: string[];
  resultsCount: number;
  totalAccumulatedCount: number;
  candidates: PncpSearchCandidate[];
  resultsJsonPath: string;
  resultsMdPath: string;
}

export interface SearchPncpSyntheticCandidate {
  pncp_id: string;
  orgao_uf: string;
  modalidade: string;
  objeto_resumo: string;
}

export interface SearchPncpSyntheticResult {
  status: "success";
  engine_version: string;
  queries_executed: string[];
  results_count: number;
  total_accumulated: number;
  results_md_path: string;
  results_json_path: string;
  top_candidates: SearchPncpSyntheticCandidate[];
  next_step_hint: string;
}
