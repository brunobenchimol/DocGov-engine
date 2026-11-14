// ============================================================================
// Tipos e Contratos: Seleção do Fornecedor 360º TIC & ACT Forense (Gen6)
// docgov-engine v1.6.0 — src/bidding/types.ts
// ============================================================================

export type IctMetricType =
  | "UST"
  | "USM"
  | "UNS"
  | "HST"
  | "HORA_TECNICA"
  | "PF"
  | "SQUAD"
  | "POSTOS"
  | "CHAMADOS";

export interface IctProfileFloorInput {
  profile_name: string;
  salary_floor: number;
  social_charges_pct?: number;
  taxes_and_admin_pct?: number;
  monthly_productive_units?: number;
}

export interface IctExecutionModelInput {
  metric_type?: string;
  is_demo_regime?: boolean;
  requires_fixed_schedule_or_timeclock?: boolean;
  requires_named_individuals_in_os?: boolean;
  has_direct_hierarchical_subordination?: boolean;
  has_fixed_monthly_payment_without_deliverables?: boolean;
  has_complexity_weighted_activity_catalog?: boolean;
  is_ust_equal_to_raw_hour?: boolean;
  has_prior_closed_os_hour_ceiling?: boolean;
  has_exceptional_hst_justification?: boolean;
  links_payment_to_sprint_throughput_and_ans?: boolean;
  disables_linked_account_and_uses_ict_index?: boolean;
}

export interface ProposalExequibilityInput {
  offered_unit_value?: number;
  parametric_profile_floor_value?: number;
  profiles_breakdown?: IctProfileFloorInput[];
  summary_disqualification_attempted?: boolean;
  prior_diligence_opportunity_granted?: boolean;
  diligence_viability_proven?: boolean;
}

export interface RequiredParcelInput {
  description?: string;
  estimated_item_value?: number;
  total_quantity?: number;
  required_minimum_quantity?: number;
}

export interface PresentedCertificateInput {
  certificate_id?: string;
  metric?: string;
  quantity?: number;
  conversion_factor_to_edital_metric?: number;
}

export interface TechnicalQualificationInput {
  edital_metric?: string;
  requires_identical_metric_only?: boolean;
  allows_certificate_summation?: boolean;
  indivisibility_technically_justified?: boolean;
  required_parcels?: RequiredParcelInput[];
  presented_certificates?: PresentedCertificateInput[];
}

export interface FinancialQualificationInput {
  ativo_circulante?: number;
  realizavel_longo_prazo?: number;
  ativo_total?: number;
  passivo_circulante?: number;
  passivo_nao_circulante?: number;
  patrimonio_liquido?: number;
  capital_social?: number;
  required_min_equity_or_capital_pct?: number;
  requires_cumulative_capital_and_equity?: boolean;
}

export interface ActForensicItemInput {
  certificate_id?: string;
  issuer_name?: string;
  issuer_cnpj?: string;
  issuer_type?: "PUBLIC" | "STATE_ENTERPRISE" | "PRIVATE" | string;
  issuer_porte?: string;
  issuer_cnae_primary?: string;
  issuer_cnae_compatible_with_ict?: boolean;
  issuer_capital_social?: number;
  issuer_cnpj_status?: string;
  issuer_opening_date?: string;
  issuer_status_date?: string;
  execution_start_date?: string;
  execution_end_date?: string;
  act_issue_date?: string;
  pncp_contract_verified?: boolean;
  pncp_reference_id?: string;
  issuer_qsa_partners?: string[];
  bidder_qsa_partners?: string[];
  same_address_or_cep?: boolean;
  shared_or_free_email_domain?: boolean;
  issuer_official_email?: string;
  act_description_text?: string;
  edital_tr_reference_text?: string;
  attested_volume?: number;
  execution_months?: number;
  max_plausible_monthly_capacity?: number;
  pdf_creation_date?: string;
  digital_signature_date?: string;
  is_second_copy_declared?: boolean;
}

export interface RawBiddingProposalInput {
  process_id?: string;
  bidder_name?: string;
  bidder_cnpj?: string;
  legal_regime?: "LEI_14133" | "LEI_13303" | string;
  evaluation_stance?: "DEFENSE" | "ATTACK" | string;
  estimated_total_value?: number;
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
  ict_execution_model?: IctExecutionModelInput;
  proposal_exequibility?: ProposalExequibilityInput;
  technical_qualification?: TechnicalQualificationInput;
  financial_qualification?: FinancialQualificationInput;
  act_forensic_items?: ActForensicItemInput[];
  // Sinônimos e flags flat de topo (Normalização Dual)
  metric_type?: string;
  has_hidden_labor_dedication_trap?: boolean;
  ust_equals_raw_hour_without_catalog?: boolean;
  unbounded_technical_hour_os?: boolean;
  below_profile_floor?: boolean;
  offered_unit_value?: number;
  parametric_profile_floor_value?: number;
  sumula_262_diligence_opened?: boolean;
  summary_disqualification_attempted?: boolean;
  rejects_equivalent_metric_conversion?: boolean;
  forbids_certificate_summation_without_justification?: boolean;
  requires_cumulative_capital_and_equity?: boolean;
  required_min_equity_or_capital_pct?: number;
  [key: string]: any;
}

export interface EvaluateBiddingOptions {
  caseDir?: string;
  outputDir?: string;
  evaluationStance?: "DEFENSE" | "ATTACK";
  compilationMode?: string;
  outputFormat?: "docx" | "pdf" | "both";
}

export interface IctExecutionEvaluation {
  metric_type: string;
  non_demo_legitimacy_verified: boolean;
  demo_trap_detected: boolean;
  metric_compliance_ok: boolean;
  parametric_floor_value: number;
  offered_unit_value?: number;
  is_exequible: boolean;
  diligence_required: boolean;
  blocking_tags: string[];
  findings: string[];
}

export interface QualificationEvaluation {
  converted_total_quantity: number;
  conversion_applied: boolean;
  tech_rules_ok: boolean;
  financial_indices: {
    ilg: number | null;
    ilc: number | null;
    isg: number | null;
    eg: number | null;
  };
  financial_rules_ok: boolean;
  blocking_tags: string[];
  findings: string[];
}

export interface ActForensicFinding {
  certificate_id: string;
  issuer_name: string;
  issuer_cnpj: string;
  triggered_vectors: string[];
  blocking_tags: string[];
  details: string[];
}

export interface ActForensicEvaluation {
  certificates_audited: number;
  total_alerts: number;
  blocking_tags: string[];
  items: ActForensicFinding[];
}

export interface BiddingProposalDossier {
  status: "success" | "blocked" | "warning";
  engine_version: string;
  process_id: string;
  bidder_name: string;
  bidder_cnpj: string;
  legal_regime: string;
  evaluation_stance: "DEFENSE" | "ATTACK";
  decision: "APPROVED" | "DILIGENCE_REQUIRED" | "REJECTED";
  blocking_tags: string[];
  ict_execution: IctExecutionEvaluation;
  qualification: QualificationEvaluation;
  act_forensics: ActForensicEvaluation;
  compiled_artifacts?: {
    judgment_opinion_docx_path?: string;
    judgment_opinion_pdf_path?: string;
    act_diligence_docx_path?: string;
    act_diligence_pdf_path?: string;
  };
}

export interface BiddingSyntheticResult {
  status: "success" | "blocked" | "warning";
  engine_version: string;
  process_id: string;
  decision: string;
  proposal_decision: string;
  blocking_tags: string[];
  act_forensic_alerts_count: number;
  compiled_docs_count: number;
  dossier_json_path: string;
  dossier_md_path: string;
  compiled_artifacts?: string[];
  next_step_hint?: string;
}
