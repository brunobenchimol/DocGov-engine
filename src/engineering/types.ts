// ============================================================================
// Tipos & Contratos Canônicos: Obras e Serviços de Engenharia (Gen6.5 Eixo 2)
// docgov-engine v1.6.6 — src/engineering/types.ts
// Acórdão TCU 2.622/2013 | Súmulas 253/254/259/262 | Dec. 7.983/2013 | Lei 14.973/2024
// ============================================================================

import type { UnitPriceItemInput } from "../bidding/types.ts";

export const ENGINEERING_BLOCKING_TAGS = [
  "[ENG_BDI_FORMULA_ALGEBRAIC_MISMATCH_BLOCK]",
  "[ENG_BDI_ABOVE_TCU_2622_Q3_CEILING_BLOCK]",
  "[ENG_BDI_SUMULA253_DIFFERENTIATED_MISSING_OR_EXCEEDED_BLOCK]",
  "[ENG_BDI_ADMIN_LOCAL_CANTEIRO_MOBILIZACAO_BIS_IN_IDEM_BLOCK]",
  "[ENG_BDI_SUMULA254_IRPJ_CSLL_FORBIDDEN_BLOCK]",
  "[ENG_ADMIN_LOCAL_NON_PROPORTIONAL_MEASUREMENT_BLOCK]",
  "[ENG_CURVA_ABC_SINAPI_SICRO_MEDIAN_OVERPRICING_BLOCK]",
  "[ENG_CPRB_DESONERACAO_TAX_ASYMMETRY_LEI14973_BLOCK]",
  "[ENG_SCHEDULE_FRONT_LOADING_CASHFLOW_MANIPULATION_BLOCK]",
  "[ENG_INTEGRATED_CONTRACTING_RISK_MATRIX_MISSING_BLOCK]",
  "[ENG_INTEGRATED_CONTRACTING_ILLEGAL_DESIGN_ADDENDUM_BLOCK]",
] as const;

export const ENGINEERING_INEXEQUIBILITY_TAGS = [
  "[INEXEQUIBILITY_75_PCT_PRESUMPTION_DILIGENCE_REQUIRED]",
  "[INEXEQUIBILITY_ADDITIONAL_GUARANTEE_85_PCT_REQUIRED]",
  "[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]",
  "[UNIT_PRICE_OVERPRICING_JOGO_DE_PLANILHA_BLOCK]",
] as const;

export const ENGINEERING_ALL_TAGS = [
  ...ENGINEERING_BLOCKING_TAGS,
  ...ENGINEERING_INEXEQUIBILITY_TAGS,
] as const;

export type EngineeringBlockingTag = (typeof ENGINEERING_ALL_TAGS)[number];

export type EngineeringWorkTypology =
  | "CONSTRUCAO_EDIFICIOS"
  | "RODOVIARIA"
  | "REDES_AGUA_ESGOTO"
  | "REDES_ENERGIA_ELETRICA"
  | "PORTUARIA_MARITIMA"
  | "FORNECIMENTO_MATERIAIS_EQUIPAMENTOS";

export type EngineeringExecutionRegime =
  | "EMPREITADA_PRECO_UNITARIO"
  | "EMPREITADA_PRECO_GLOBAL"
  | "EMPREITADA_INTEGRAL"
  | "TAREFA"
  | "CONTRATACAO_INTEGRADA"
  | "CONTRATACAO_SEMI_INTEGRADA";

export interface EngineeringBdiInput {
  central_admin_bps?: number;
  central_admin_pct?: number;
  insurance_and_guarantee_bps?: number;
  insurance_and_guarantee_pct?: number;
  risk_bps?: number;
  risk_pct?: number;
  financial_expenses_bps?: number;
  financial_expenses_pct?: number;
  profit_bps?: number;
  profit_pct?: number;
  pis_bps?: number;
  pis_pct?: number;
  cofins_bps?: number;
  cofins_pct?: number;
  iss_bps?: number;
  iss_pct?: number;
  cprb_bps?: number;
  cprb_pct?: number;
  irpj_bps?: number;
  irpj_pct?: number;
  csll_bps?: number;
  csll_pct?: number;
  declared_bdi_bps?: number;
  declared_bdi_pct?: number;
  justification_above_q3_proven?: boolean;
  includes_admin_local_in_bdi?: boolean;
  includes_canteiro_or_mobilizacao_in_bdi?: boolean;
  admin_local_in_bdi_bps?: number;
  includes_irpj_or_csll?: boolean;
  has_relevant_equipment_supply?: boolean;
  relevant_equipment_share_bps?: number;
  relevant_equipment_share_pct?: number;
  differentiated_equipment_bdi_bps?: number;
  differentiated_equipment_bdi_pct?: number;
  differentiated_bdi_justification_proven?: boolean;
  admin_local_proportional_to_physical_progress?: boolean;
  physical_progress_bps?: number;
  physical_progress_pct?: number;
  admin_local_measured_bps?: number;
  admin_local_measured_pct?: number;
}

export interface EngineeringTaxDesoneracaoInput {
  reference_year?: number;
  sinapi_sicro_table_regime: "DESONERADO" | "NAO_DESONERADO";
  bdi_includes_cprb?: boolean;
  applied_cprb_bps?: number;
  applied_cprb_pct?: number;
  payroll_inss_bps?: number;
  payroll_inss_pct?: number;
}

export interface EngineeringCurvaAbcItemInput {
  item_id: string;
  description: string;
  reference_source?: "SINAPI" | "SICRO" | "COTACAO_MERCADO";
  quantity: number;
  sinapi_sicro_median_unit_cents: number;
  offered_unit_cents: number;
  specificity_justification_approved?: boolean;
}

export interface EngineeringScheduleStageInput {
  stage_number: number;
  description?: string;
  reference_physical_cumulative_bps?: number;
  reference_physical_cumulative_pct?: number;
  financial_disbursement_cumulative_bps?: number;
  financial_disbursement_cumulative_pct?: number;
}

export interface EngineeringScheduleAndRiskInput {
  front_loading_detected?: boolean;
  schedule_stages?: EngineeringScheduleStageInput[];
  has_risk_allocation_matrix?: boolean;
  has_anteprojeto_or_basic_design?: boolean;
  attempts_design_error_addendum_without_legal_exception?: boolean;
}

export interface EngineeringWorksAuditInput {
  workspace_dir?: string;
  case_id?: string;
  contract_regime?: "LEI_14133" | "LEI_13303";
  work_typology: EngineeringWorkTypology;
  execution_regime?: EngineeringExecutionRegime;
  estimated_budget_cents?: number;
  estimated_budget_value?: number;
  offered_proposal_cents?: number;
  offered_proposal_value?: number;
  additional_guarantee_offered?: boolean;
  summary_disqualification_attempted?: boolean;
  prior_diligence_opportunity_granted?: boolean;
  diligence_viability_proven?: boolean;
  has_unit_price_overpricing?: boolean;
  bdi_evaluation: EngineeringBdiInput;
  tax_desoneracao_cprb?: EngineeringTaxDesoneracaoInput;
  curva_abc_items?: EngineeringCurvaAbcItemInput[];
  unit_price_items?: UnitPriceItemInput[];
  schedule_and_risk?: EngineeringScheduleAndRiskInput;
  output_format?: "docx" | "pdf" | "both";
}

export interface EngineeringBdiEvaluationSummary {
  work_typology: EngineeringWorkTypology;
  typology_label: string;
  quartile_q1_bps: number;
  quartile_median_bps: number;
  quartile_q3_bps: number;
  declared_bdi_bps: number;
  calculated_bdi_bps: number;
  differentiated_equipment_bdi_bps?: number;
  equipment_q3_ceiling_bps: number;
  blocking_tags: string[];
  findings: string[];
}

export interface EngineeringCurvaAbcAnalyzedItem {
  item_id: string;
  description: string;
  reference_source: string;
  abc_band: "A" | "B" | "C";
  quantity: number;
  sinapi_sicro_median_unit_cents: number;
  offered_unit_cents: number;
  offered_total_cents: number;
  reference_total_cents: number;
  overpricing_cents: number;
  cumulative_share_bps: number;
  overpriced_without_justification: boolean;
}

export interface EngineeringSinapiScheduleSummary {
  abc_total_offered_cents: number;
  abc_total_reference_cents: number;
  abc_net_overpricing_cents: number;
  abc_overpriced_items_count: number;
  abc_items: EngineeringCurvaAbcAnalyzedItem[];
  cprb_regime: string;
  cprb_reference_year: number;
  max_front_loading_gap_bps: number;
  integrated_or_semi_integrated: boolean;
  blocking_tags: string[];
  findings: string[];
}

export interface EngineeringWorksAuditOutput {
  engine_version: string;
  case_id: string;
  contract_regime: "LEI_14133" | "LEI_13303";
  work_typology: EngineeringWorkTypology;
  execution_regime: EngineeringExecutionRegime;
  status: "CONFORME" | "NAO_CONFORME";
  blocking_tags: string[];
  findings: string[];
  bdi_summary: EngineeringBdiEvaluationSummary;
  sinapi_schedule_summary: EngineeringSinapiScheduleSummary;
  inexequibility_summary: {
    estimated_budget_cents: number;
    offered_proposal_cents: number;
    ratio_pct?: number;
    presumed_inexequible_75: boolean;
    requires_additional_guarantee_85: boolean;
    additional_guarantee_cents: number;
    unit_price_overpricing_detected: boolean;
  };
  artifacts: {
    json_path: string;
    md_path: string;
    docx_path: string;
    pdf_path: string;
  };
}

export interface EngineeringWorksSyntheticResult {
  status: "CONFORME" | "NAO_CONFORME";
  engine_version: string;
  case_id: string;
  work_typology?: EngineeringWorkTypology;
  blocking_tags: string[];
  calculated_bdi_bps?: number;
  abc_overpriced_items_count?: number;
  additional_guarantee_cents?: number;
  json_path: string;
  md_path?: string;
  docx_path?: string;
  pdf_path?: string;
  next_step_hint?: string;
}

export interface AuditEngineeringWorksOptions {
  workspaceDir?: string;
  outputFormat?: "docx" | "pdf" | "both";
}
