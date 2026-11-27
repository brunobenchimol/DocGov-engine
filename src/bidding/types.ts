// ============================================================================
// Tipos e Contratos: Seleção do Fornecedor 360º TIC & ACT Forense (Gen6)
// docgov-engine v1.6.0 — src/bidding/types.ts
// ============================================================================

import type {
  DocumentForensicMeta,
  McpDeliveryEnvelopeFields,
  PdfPadesSignatureDetail,
} from "../types/index.ts";

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

export interface UnitPriceItemInput {
  item_id?: string;
  description?: string;
  estimated_unit_price?: number;
  reference_unit_price?: number;
  offered_unit_price?: number;
  unit_price?: number;
  quantity?: number;
  estimated_quantity?: number;
  offered_quantity?: number;
}

export interface ProposalExequibilityInput {
  offered_unit_value?: number;
  parametric_profile_floor_value?: number;
  profiles_breakdown?: IctProfileFloorInput[];
  summary_disqualification_attempted?: boolean;
  prior_diligence_opportunity_granted?: boolean;
  diligence_viability_proven?: boolean;
  has_unit_price_overpricing?: boolean;
  jogo_de_planilha_detected?: boolean;
  unit_price_overpricing_detected?: boolean;
  unit_items?: UnitPriceItemInput[];
  items?: UnitPriceItemInput[];
  spreadsheet_items?: UnitPriceItemInput[];
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

export interface DiligenceNfeKeyInput {
  access_key: string;
  expected_cnpj?: string;
  declared_issue_date?: string;
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
  pdf_mod_date?: string;
  digital_signature_date?: string;
  pdf_author?: string;
  pdf_creator_tool?: string;
  pdf_producer?: string;
  editing_software_traces?: string[];
  act_pdf_path?: string;
  act_structure_json_path?: string;
  is_second_copy_declared?: boolean;
  expected_signer_name?: string;
  expected_signer_cpf_cnpj?: string;
  pades_signatures?: PdfPadesSignatureDetail[];
  nfe_access_key?: string;
  nfe_declared_issue_date?: string;
  diligence_nfe_keys?: Array<string | DiligenceNfeKeyInput>;
}

export interface CompetingProposalMetaInput {
  bidder_name?: string;
  bidder_cnpj?: string;
  proposal_file_name?: string;
  proposal_pdf_path?: string;
  structure_json_path?: string;
  forensic_meta?: DocumentForensicMeta;
}

export interface AppealContextInput {
  appeal_type?: "RAZOES" | "CONTRARRAZOES" | "DECISAO_PREGOEIRO" | string;
  appellant_name?: string;
  appellant_cnpj?: string;
  counter_appellant_name?: string;
  session_or_decision_date?: string;
  intent_manifested_timely?: boolean;
  intent_summary_rejection_attempted?: boolean;
  summary_merit_rejection_of_intent?: boolean;
  deadline_less_than_3_business_days?: boolean;
  edital_appeal_deadline_days?: number;
  pre_existing_document_submitted_on_appeal?: boolean;
  acordao_1211_2021_applicable?: boolean;
  new_document_for_preexisting_fact?: boolean;
  maintained_decision_without_hierarchical_remission?: boolean;
  hierarchical_decision_days_elapsed?: number;
  requires_hierarchical_remission?: boolean;
  declared_intent_scope?: string;
  appeal_reasons_scope?: string;
  reasons_filed_date?: string;
  reasons_business_days_elapsed?: number;
  counter_reasons_filed_date?: string;
  counter_reasons_business_days_elapsed?: number;
  innovation_outside_intent?: boolean;
  reconsider_decision?: "ACOLHER" | "MANTER_E_ENCAMINHAR" | boolean | string;
  summary_reasons?: string;
  summary_counter_reasons?: string;
}

export interface ForensicCollusionEvaluation {
  proposals_audited: number;
  collusion_pairs_count: number;
  blocking_tags: string[];
  findings: string[];
}

export interface InexequibilityEvaluation {
  is_engineering_or_works: boolean;
  estimated_budget_value?: number;
  offered_proposal_value?: number;
  ratio_pct?: number;
  presumed_inexequible_75: boolean;
  requires_additional_guarantee_85: boolean;
  additional_guarantee_amount?: number;
  unit_price_overpricing_detected?: boolean;
  overpriced_unit_items_count?: number;
  blocking_tags: string[];
  findings: string[];
}

export interface AppealsEvaluation {
  evaluated: boolean;
  appeal_type: string;
  timely_3_business_days: boolean;
  immediate_intent_valid: boolean;
  thematic_link_ok: boolean;
  new_document_exception_applicable?: boolean;
  hierarchical_remission_required?: boolean;
  suspensive_effect_applicable: boolean;
  authority_forwarding_deadline_days: number;
  blocking_tags: string[];
  findings: string[];
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
  competing_proposals_meta?: CompetingProposalMetaInput[];
  appeal_context?: AppealContextInput;
  estimated_budget_value?: number;
  offered_proposal_value?: number;
  offered_total_value?: number;
  is_engineering_or_works?: boolean;
  additional_guarantee_offered?: boolean;
  has_unit_price_overpricing?: boolean;
  jogo_de_planilha_detected?: boolean;
  unit_price_overpricing_detected?: boolean;
  unit_items?: UnitPriceItemInput[];
  spreadsheet_items?: UnitPriceItemInput[];
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
  deferMarkdownWrite?: boolean;
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
  estimated_total_value?: number;
  ict_execution: IctExecutionEvaluation;
  qualification: QualificationEvaluation;
  act_forensics: ActForensicEvaluation;
  forensic_collusion?: ForensicCollusionEvaluation;
  inexequibility_check?: InexequibilityEvaluation;
  appeals_evaluation?: AppealsEvaluation;
  unknown_keys?: string[];
  schema_warnings?: string[];
  raw_context?: RawBiddingProposalInput;
  compiled_artifacts?: {
    judgment_opinion_docx_path?: string;
    judgment_opinion_pdf_path?: string;
    act_diligence_docx_path?: string;
    act_diligence_pdf_path?: string;
    appeal_petition_docx_path?: string;
    appeal_petition_pdf_path?: string;
    pregoeiro_decision_docx_path?: string;
    pregoeiro_decision_pdf_path?: string;
  };
}

export interface BiddingSyntheticResult extends McpDeliveryEnvelopeFields {
  status: "success" | "blocked" | "warning";
  engine_version: string;
  process_id: string;
  decision: string;
  proposal_decision?: string;
  blocking_tags: string[];
  act_forensic_alerts_count?: number;
  compiled_docs_count?: number;
  dossier_json_path: string;
  dossier_md_path: string;
  compiled_artifacts?: string[];
  unknown_keys?: string[];
  next_step_hint?: string;
}
