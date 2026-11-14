// ============================================================================
// Tipos e Interfaces: Fiscalização Contratual, Aditivos, PAS e Cesta (Gen5.6)
// docgov-engine v1.5.6 — src/contracts/types.ts
// ============================================================================

import type {
  RawPasFederativeFields,
  PasFederativeAnalysisSummary,
  PasDosimetryCalibrationSummary,
} from "./pas_federative_types.ts";

export * from "./pas_federative_types.ts";

export type ContractObjectType =
  | "PURCHASE"
  | "SERVICE"
  | "WORK"
  | "BUILDING_REFORM"
  | "EQUIPMENT_REFORM"
  | "REFORM"
  | "REFORMA"
  | "OTHER";

export type LegalRegime = "LEI_14133" | "LEI_13303" | "LEI_8666" | string;

export type TargetInstrument = "CONTRACT" | "ARP" | string;

export type ContractCompilationMode =
  | "PAS_NOTIFICATION"
  | "SANCTION_DOSIMETRY_OPINION"
  | "DOSIMETRY_OPINION"
  | "BOTH"
  | "NONE"
  | string;

export interface RawAddendumItem {
  id?: string;
  date?: string;
  type?: string;
  value_increase?: number;
  valueIncrease?: number;
  value_decrease?: number;
  valueDecrease?: number;
  increase_pct?: number;
  increasePct?: number;
  gross_increase_pct?: number;
  decrease_pct?: number;
  decreasePct?: number;
  gross_decrease_pct?: number;
  is_unilateral?: boolean;
  isUnilateral?: boolean;
  unilateral?: boolean;
  is_consensual?: boolean;
  isConsensual?: boolean;
  compensated_attempt?: boolean;
  compensatedAttempt?: boolean;
  justification?: string;
}

export interface RawTripartiteItem {
  item_id?: string;
  itemId?: string;
  code?: string;
  description?: string;
  edital_tr?: { quantity?: number; unit_price?: number; unitPrice?: number };
  winning_proposal?: { quantity?: number; unit_price?: number; unitPrice?: number };
  arp?: { quantity?: number; unit_price?: number; unitPrice?: number };
  contract_or_invoice?: { quantity?: number; unit_price?: number; unitPrice?: number };
  tr_unit_price?: number;
  trUnitPrice?: number;
  proposal_unit_price?: number;
  proposalUnitPrice?: number;
  arp_unit_price?: number;
  arpUnitPrice?: number;
  contract_unit_price?: number;
  contractUnitPrice?: number;
  invoice_unit_price?: number;
  invoiceUnitPrice?: number;
  homologated_qty?: number;
  homologatedQty?: number;
  contract_qty?: number;
  contractQty?: number;
  invoiced_qty?: number;
  invoicedQty?: number;
  attested_qty?: number;
  attestedQty?: number;
  overpricing_detected?: boolean;
  overpricingDetected?: boolean;
  advance_payment_without_guarantee?: boolean;
  unauthorized_suppression?: boolean;
}

export interface RawReadjustmentItem {
  id?: string;
  type?: "REAJUSTE_INDICE" | "REPACTUACAO_CCT" | string;
  index_name?: string;
  index?: string;
  base_date?: string;
  budget_base_date?: string;
  request_date?: string;
  grant_date?: string;
  months_elapsed?: number;
  interregnum_months?: number;
  has_cct_proof?: boolean;
  hasCctProof?: boolean;
  cct_attached?: boolean;
  cctAttached?: boolean;
  base_index_value?: number;
  current_index_value?: number;
  applied_percentage?: number;
}

export interface RawSlaGlosaInput {
  indicator_id?: string;
  indicatorId?: string;
  achieved_score?: number;
  achievedScore?: number;
  invoice_gross_value?: number;
  invoiceGrossValue?: number;
  discount_pct?: number;
  discountPct?: number;
  glosa_value?: number;
  glosaValue?: number;
  within_imr_bands?: boolean;
  withinImrBands?: boolean;
  classified_as?: string;
  classifiedAs?: string;
  is_punitive_disguised_as_glosa?: boolean;
  isPunitiveDisguisedAsGlosa?: boolean;
  is_imr_classified_as_sanction?: boolean;
  isImrClassifiedAsSanction?: boolean;
  ans_glosa_applied_as_punitive_sanction?: boolean;
  ansGlosaAppliedAsPunitiveSanction?: boolean;
  opened_formal_pas?: boolean;
  openedFormalPas?: boolean;
}

export interface RawPasSanctionInput extends RawPasFederativeFields {
  process_id?: string;
  processId?: string;
  id?: string;
  infraction_article?: string;
  infractionArticle?: string;
  infraction_severity?: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | string;
  infractionSeverity?: string;
  penalty_type?: string;
  penaltyType?: string;
  proposed_sanction?: string;
  proposedSanction?: string;
  sanction_scope?: "FEDERATIVE_ENTITY" | "ALL_SPHERES" | string;
  sanctionScope?: string;
  debarment_years?: number;
  debarmentYears?: number;
  proposed_fine_pct?: number;
  proposedFinePct?: number;
  fine_pct?: number;
  finePct?: number;
  fine_value?: number;
  fineValue?: number;
  contract_value?: number;
  contractValue?: number;
  opened_formal_pas?: boolean;
  openedFormalPas?: boolean;
  prior_notification_sent?: boolean;
  priorNotificationSent?: boolean;
  defense_deadline_business_days?: number;
  defenseDeadlineBusinessDays?: number;
  contradictory_days?: number;
  contradictoryDays?: number;
  guarantee_modality?: string;
  guaranteeModality?: string;
  has_surety_bond?: boolean;
  hasSuretyBond?: boolean;
  claim_or_default_detected?: boolean;
  claimOrDefaultDetected?: boolean;
  surety_insurer_notified?: boolean;
  suretyInsurerNotified?: boolean;
  insurer_notified?: boolean;
  insurerNotified?: boolean;
  policy_expired?: boolean;
  policyExpired?: boolean;
  ans_glosa_applied_as_punitive_sanction?: boolean;
  ansGlosaAppliedAsPunitiveSanction?: boolean;
  is_punitive_disguised_as_glosa?: boolean;
  isPunitiveDisguisedAsGlosa?: boolean;
  is_imr_classified_as_sanction?: boolean;
  isImrClassifiedAsSanction?: boolean;
  within_imr_bands?: boolean;
  withinImrBands?: boolean;
  sla_glosa?: RawSlaGlosaInput;
  slaGlosa?: RawSlaGlosaInput;
}

export interface RawPriceBasketItem {
  item_id?: string;
  itemId?: string;
  description?: string;
  quotes?: number[];
  cotacoes?: number[];
  samples?: number[];
  selected_metric?: string;
  selectedMetric?: string;
  selected_method?: string;
  selectedMethod?: string;
  claimed_reference_price?: number;
  claimedReferencePrice?: number;
  proposed_unit_price?: number;
  proposedUnitPrice?: number;
}

export interface RawRebalanceRequest {
  id?: string;
  event_description?: string;
  eventDescription?: string;
  event_nature?: string;
  eventNature?: string;
  is_extraordinary_unforeseeable?: boolean;
  isExtraordinaryUnforeseeable?: boolean;
  is_ordinary_inflation?: boolean;
  isOrdinaryInflation?: boolean;
  risk_allocated_to?: string;
  riskAllocatedTo?: string;
  requested_value?: number;
  requestedValue?: number;
}

export interface RawContractInput extends RawPasFederativeFields {
  contract_id?: string;
  contractId?: string;
  contract_type?: ContractObjectType;
  contractType?: ContractObjectType;
  object_type?: ContractObjectType;
  objectType?: ContractObjectType;
  legal_regime?: LegalRegime;
  legalRegime?: LegalRegime;
  target_instrument?: TargetInstrument;
  targetInstrument?: TargetInstrument;
  is_arp_instrument?: boolean;
  isArpInstrument?: boolean;
  is_arp_direct_addendum?: boolean;
  isArpDirectAddendum?: boolean;
  initial_value?: number;
  initialValue?: number;
  updated_initial_value?: number;
  updatedInitialValue?: number;
  current_value?: number;
  currentValue?: number;
  addendums?: RawAddendumItem[];
  aditivos?: RawAddendumItem[];
  increase_pct?: number;
  increasePct?: number;
  gross_increase_pct?: number;
  decrease_pct?: number;
  decreasePct?: number;
  gross_decrease_pct?: number;
  compensated_attempt?: boolean;
  compensatedAttempt?: boolean;
  is_consensual?: boolean;
  isConsensual?: boolean;
  unilateral?: boolean;
  tripartite_items?: RawTripartiteItem[];
  tripartite?: RawTripartiteItem[];
  items?: RawTripartiteItem[];
  readjustments?: RawReadjustmentItem[];
  reajustes?: RawReadjustmentItem[];
  readjustment?: RawReadjustmentItem;
  reajuste?: RawReadjustmentItem;
  pas_sanction?: RawPasSanctionInput | RawPasSanctionInput[];
  pasSanction?: RawPasSanctionInput | RawPasSanctionInput[];
  pas_sanctions?: RawPasSanctionInput | RawPasSanctionInput[];
  pasSanctions?: RawPasSanctionInput | RawPasSanctionInput[];
  pas?: RawPasSanctionInput | RawPasSanctionInput[];
  pas_evaluation?: RawPasSanctionInput | RawPasSanctionInput[];
  pasEvaluation?: RawPasSanctionInput | RawPasSanctionInput[];
  sla_glosa?: RawSlaGlosaInput | RawSlaGlosaInput[];
  slaGlosa?: RawSlaGlosaInput | RawSlaGlosaInput[];
  price_basket?: RawPriceBasketItem | RawPriceBasketItem[];
  priceBasket?: RawPriceBasketItem | RawPriceBasketItem[];
  cesta_precos?: RawPriceBasketItem | RawPriceBasketItem[];
  rebalance_claim?: RawRebalanceRequest | RawRebalanceRequest[];
  rebalanceClaim?: RawRebalanceRequest | RawRebalanceRequest[];
  rebalance_request?: RawRebalanceRequest | RawRebalanceRequest[];
  rebalanceRequest?: RawRebalanceRequest | RawRebalanceRequest[];
  rebalance_requests?: RawRebalanceRequest | RawRebalanceRequest[];
  rebalanceRequests?: RawRebalanceRequest | RawRebalanceRequest[];
  reequilibrio?: RawRebalanceRequest | RawRebalanceRequest[];
  compilation_mode?: ContractCompilationMode;
  compilationMode?: ContractCompilationMode;
  mode?: ContractCompilationMode;
  output_format?: "docx" | "pdf" | "both";
  outputFormat?: "docx" | "pdf" | "both";
  format?: "docx" | "pdf" | "both";
}

export interface AuditContractOptions {
  caseDir?: string;
  outputDir?: string;
  auditType?: "FULL" | "ADDENDUM_LIMITS" | "TRIPARTITE_MATCH" | "READJUSTMENT" | "PAS_SANCTIONS" | "PRICE_BASKET" | string;
  compilationMode?: ContractCompilationMode;
  mode?: ContractCompilationMode;
  outputFormat?: "docx" | "pdf" | "both";
  format?: "docx" | "pdf" | "both";
}

export interface PasSanctionAnalysisItem {
  process_id: string;
  proposed_sanction?: string;
  recommended_sanction: string;
  recommended_scope: string;
  fine_pct?: number;
  legal_floor_pct: number;
  legal_ceiling_pct: number;
  fine_within_legal_bounds: boolean;
  remuneratory_glosa_value?: number;
  sla_glosa_misclassified: boolean;
  defense_deadline_business_days?: number;
  contradictory_15_days_ok: boolean;
  guarantee_modality?: string;
  insurer_notification_ok: boolean;
  competent_audit_court?: string;
  federative_adequacy?: PasFederativeAnalysisSummary;
  dosimetry_calibration?: PasDosimetryCalibrationSummary;
  justification?: string;
}

export interface PriceBasketAnalysisItem {
  item_id: string;
  description?: string;
  quotes_count: number;
  mean: number;
  median: number;
  std_dev: number;
  cv_pct: number;
  lower_bound: number;
  upper_bound: number;
  outliers_removed: number[];
  sanitized_mean: number;
  high_dispersion: boolean;
  selected_metric?: string;
  recommended_method: string;
  recommended_reference_price: number;
}

export interface RebalanceAnalysisItem {
  id: string;
  event_description?: string;
  event_nature: string;
  risk_allocated_to: string;
  extraordinary_unforeseeable: boolean;
  eligible_for_revision: boolean;
  reason?: string;
}

export interface ContractAuditReport {
  status: "success" | "blocked" | "warning";
  engine_version: string;
  contract_id: string;
  legal_regime: string;
  object_type: string;
  target_instrument: string;
  blocking_tags: string[];
  adherence_summary: {
    gross_increase_pct: number;
    gross_decrease_pct: number;
    legal_limit_pct: number;
    compensation_attempted: boolean;
    tripartite_overpricing_count: number;
    readjustment_violations_count: number;
    pas_violations_count?: number;
    price_basket_warnings_count?: number;
    rebalance_violations_count?: number;
  };
  addendums_analysis: {
    total_increase: number;
    total_decrease: number;
    initial_base_value: number;
    is_reform: boolean;
    has_unilateral_state_enterprise: boolean;
    has_direct_arp_addendum: boolean;
    details: Array<{
      id: string;
      increase: number;
      decrease: number;
      increase_pct: number;
      decrease_pct: number;
      unilateral: boolean;
      justification?: string;
    }>;
  };
  tripartite_analysis: {
    items_analyzed: number;
    divergent_items_count: number;
    total_overpricing_value: number;
    items: Array<{
      item_id: string;
      description?: string;
      overpricing_detected: boolean;
      unit_divergence_pct?: number;
      qty_divergence?: number;
      reason?: string;
    }>;
  };
  readjustment_analysis: {
    events_analyzed: number;
    violations_count: number;
    events: Array<{
      id: string;
      type: string;
      months_elapsed: number;
      interregnum_ok: boolean;
      cct_proof_ok: boolean;
      applied_percentage?: number;
      justification?: string;
    }>;
  };
  pas_sanctions_analysis?: {
    processes_analyzed: number;
    violations_count: number;
    competent_audit_court?: string;
    processes: PasSanctionAnalysisItem[];
  };
  price_basket_analysis?: {
    items_analyzed: number;
    high_dispersion_warnings_count: number;
    items: PriceBasketAnalysisItem[];
  };
  extraordinary_rebalance_analysis?: {
    events_analyzed: number;
    violations_count: number;
    events: RebalanceAnalysisItem[];
  };
  compiled_artifacts?: {
    pas_notification_docx_path?: string;
    pas_notification_pdf_path?: string;
    dosimetry_opinion_docx_path?: string;
    dosimetry_opinion_pdf_path?: string;
  };
}

export interface AuditContractSyntheticResult {
  status: "success" | "blocked" | "warning";
  engine_version: string;
  contract_id: string;
  legal_regime?: string;
  blocking_tags: string[];
  adherence_summary?: {
    gross_increase_pct?: number;
    gross_decrease_pct?: number;
    legal_limit_pct: number;
    tripartite_overpricing_count?: number;
    readjustment_violations_count?: number;
    pas_violations_count?: number;
    price_basket_warnings_count?: number;
    rebalance_violations_count?: number;
  };
  report_json_path: string;
  dossier_md_path: string;
  compiled_artifacts?: string[];
  next_step_hint?: string;
}
