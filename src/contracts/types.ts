// ============================================================================
// Tipos e Interfaces: Fiscalização Contratual, Aditivos e Batimento (Gen5)
// docgov-engine v1.5.0 — src/contracts/types.ts
// ============================================================================

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

export interface RawContractInput {
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
}

export interface AuditContractOptions {
  caseDir?: string;
  outputDir?: string;
  auditType?: "FULL" | "ADDENDUM_LIMITS" | "TRIPARTITE_MATCH" | "READJUSTMENT";
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
}

export interface AuditContractSyntheticResult {
  status: "success" | "blocked" | "warning";
  engine_version: string;
  contract_id: string;
  legal_regime: string;
  blocking_tags: string[];
  adherence_summary: {
    gross_increase_pct: number;
    gross_decrease_pct: number;
    legal_limit_pct: number;
    tripartite_overpricing_count: number;
    readjustment_violations_count: number;
  };
  report_json_path: string;
  dossier_md_path: string;
  next_step_hint: string;
}
