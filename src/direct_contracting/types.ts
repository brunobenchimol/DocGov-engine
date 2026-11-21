// ============================================================================
// Tipos e Contratos: Contratação Direta & Oportunidade Estatal (Gen6)
// docgov-engine v1.6.0 — src/direct_contracting/types.ts
// ============================================================================

import type { DocumentForensicMeta } from "../types/index.ts";

export type DirectContractingModality =
  | "INEXIGIBILIDADE"
  | "DISPENSA_VALOR"
  | "OPORTUNIDADE_NEGOCIO_ESTATAL";

export interface ExclusivityCertificateInput {
  provided?: boolean;
  issuer_entity?: string;
  is_generic_or_self_declared?: boolean;
  covers_only_local_scope_without_technical_justification?: boolean;
  sumula_255_tcu_verified?: boolean;
}

export interface MarketPriceProofInput {
  type?: "NOTA_FISCAL" | "NF" | "CONTRATO" | string;
  identifier?: string;
  unit_price?: number;
  buyer?: string;
  issue_date?: string;
  pdf_path?: string;
  structure_json_path?: string;
  nfe_access_key?: string;
  issuer_cnpj?: string;
}

export interface QuotationForensicMetaInput {
  quotation_id?: string;
  file_name?: string;
  supplier_name?: string;
  structure_json_path?: string;
  pdf_path?: string;
  forensic_meta?: DocumentForensicMeta;
}

export interface InexigibilityDetailsInput {
  legal_hypothesis?: string;
  competition_infeasibility_proven?: boolean;
  notorious_specialization_proven?: boolean;
  exclusivity_certificate?: ExclusivityCertificateInput;
  supplier_market_price_proofs?: MarketPriceProofInput[];
}

export interface DispensationByValueDetailsInput {
  managing_unit_code?: string;
  financial_year?: number;
  activity_branch_code?: string;
  is_engineering_or_maintenance?: boolean;
  legal_annual_limit?: number;
  prior_accumulated_spend_in_branch?: number;
  current_proposed_spend?: number;
}

export interface StateEnterpriseOpportunityDetailsInput {
  is_linked_to_corporate_purpose?: boolean;
  partner_competitive_singularity_proven?: boolean;
  competitive_procedure_infeasibility_proven?: boolean;
  has_risk_and_revenue_sharing_matrix?: boolean;
  is_ordinary_commodity_disguised?: boolean;
}

export interface RawDirectContractingInput {
  process_id?: string;
  contracting_modality?: string;
  modality?: string;
  legal_regime?: "LEI_14133" | "LEI_13303" | string;
  contracted_amount?: number;
  contracted_Amount?: number;
  supplier_cnpj?: string;
  caseDir?: string;
  case_dir?: string;
  outputDir?: string;
  output_dir?: string;
  compilation_mode?: string;
  compilationMode?: string;
  mode?: string;
  output_format?: "docx" | "pdf" | "both";
  outputFormat?: "docx" | "pdf" | "both";
  format?: "docx" | "pdf" | "both";
  inexigibility_details?: InexigibilityDetailsInput;
  dispensation_by_value_details?: DispensationByValueDetailsInput;
  state_enterprise_opportunity_details?: StateEnterpriseOpportunityDetailsInput;
  quotations_forensic_meta?: QuotationForensicMetaInput[];
  offered_unit_price?: number;
  proposed_unit_price?: number;
  unit_quantity?: number;
  // Sinônimos e flags flat de topo (Normalização Dual)
  exclusivity_certificate_valid?: boolean;
  price_proof_invoices_count?: number;
  competition_infeasibility_proven?: boolean;
  pdm_catmat_catser?: string;
  prior_accumulated_spend_in_branch?: number;
  current_proposed_spend?: number;
  legal_annual_limit?: number;
  has_partner_uniqueness_justification?: boolean;
  is_ordinary_commodity_disguised?: boolean;
  has_risk_and_revenue_sharing_matrix?: boolean;
  [key: string]: any;
}

export interface AuditDirectContractingOptions {
  caseDir?: string;
  outputDir?: string;
  compilationMode?: string;
  outputFormat?: "docx" | "pdf" | "both";
}

export interface DirectContractingAuditDossier {
  status: "success" | "blocked" | "warning";
  engine_version: string;
  process_id: string;
  modality: DirectContractingModality;
  legal_regime: string;
  decision: "APPROVED" | "REJECTED";
  contracted_amount?: number;
  blocking_tags: string[];
  findings: string[];
  unknown_keys?: string[];
  schema_warnings?: string[];
  raw_context?: RawDirectContractingInput;
  inexigibility_summary?: {
    exclusivity_valid: boolean;
    valid_market_price_proofs_count: number;
    competition_infeasibility_proven: boolean;
    sanitized_market_median?: number;
    proposed_comparison_price?: number;
  };
  dispensation_summary?: {
    managing_unit_code: string;
    activity_branch_code: string;
    financial_year: number;
    legal_annual_limit: number;
    accumulated_total_in_branch: number;
    fragmentation_detected: boolean;
  };
  state_opportunity_summary?: {
    linked_to_corporate_purpose: boolean;
    partner_singularity_proven: boolean;
    competitive_infeasibility_proven: boolean;
    risk_revenue_matrix_present: boolean;
    ordinary_commodity_disguised: boolean;
  };
  compiled_artifacts?: {
    opinion_docx_path?: string;
    opinion_pdf_path?: string;
  };
}

export interface DirectContractingSyntheticResult {
  status: "success" | "blocked" | "warning";
  engine_version: string;
  process_id: string;
  modality?: string;
  decision: string;
  blocking_tags: string[];
  docx_path?: string;
  pdf_path?: string;
  dossier_json_path: string;
  dossier_md_path: string;
  unknown_keys?: string[];
  next_step_hint?: string;
}
