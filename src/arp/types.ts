// ============================================================================
// Tipos e Interfaces: Governança Determinística de ARP e Caronas (Gen5)
// docgov-engine v1.5.0 — src/arp/types.ts
// ============================================================================

export type FederativeSphere = "FEDERAL" | "STATE" | "MUNICIPAL" | string;
export type LegalRegime = "LEI_14133" | "LEI_13303" | "LEI_8666" | string;
export type ArpCompilationMode = "ARP_ADHESION_GRANT_NOTE" | "ARP_ADVANTAGE_STUDY" | "NONE" | string;

export interface RawArpOrganInfo {
  name?: string;
  federative_sphere?: FederativeSphere;
  federativeSphere?: FederativeSphere;
  sphere?: FederativeSphere;
  legal_regime?: LegalRegime;
  legalRegime?: LegalRegime;
  regime?: LegalRegime;
  is_state_enterprise?: boolean;
  isStateEnterprise?: boolean;
}

export interface RawArpItem {
  item_id?: string;
  itemId?: string;
  id?: string;
  description?: string;
  unit?: string;
  registered_quantity?: number;
  registeredQuantity?: number;
  registered_qty?: number;
  registeredQty?: number;
  unit_price?: number;
  unitPrice?: number;
  consumed_by_managing_and_participants?: number;
  manager_own_qty?: number;
  own_balance?: number;
  participants_qty?: number;
  previous_carona_adhesions?: number;
  prior_adhesions_qty?: number;
  accumulated_adhesions_qty?: number;
  requested_adhesion_qty?: number;
  requestedQty?: number;
}

export interface RawArpValidity {
  start_date?: string;
  end_date?: string;
  validity_months?: number;
  arp_months?: number;
  is_renewed_year_2?: boolean;
  is_second_year_renewal?: boolean;
  renew_quantities_second_year?: boolean;
  has_edital_renewal_clause?: boolean;
  edital_clause_for_renewal?: boolean;
  has_advantage_proof?: boolean;
  advantage_proven_year_2?: boolean;
  derived_contract_duration_months?: number;
  derived_contract_years?: number;
}

export interface RawAdhesionRequest {
  requesting_organ?: RawArpOrganInfo;
  adherent_organ?: RawArpOrganInfo;
  items_requested?: Array<{
    item_id?: string;
    itemId?: string;
    requested_quantity?: number;
    requested_qty?: number;
    requestedQty?: number;
  }>;
  supplier_consent?: boolean;
  is_supplier_consensual?: boolean;
  market_price_comparison?: Array<{
    item_id?: string;
    arp_price?: number;
    market_price?: number;
    is_advantageous?: boolean;
  }>;
  etp_pdtic_alignment_summary?: string;
  justification_no_bidding?: string;
}

export interface RawArpInput {
  arp_number?: string;
  arpNumber?: string;
  caseDir?: string;
  outputDir?: string;
  managing_organ?: RawArpOrganInfo;
  managingOrgan?: RawArpOrganInfo;
  manager_sphere?: FederativeSphere;
  managerSphere?: FederativeSphere;
  manager_regime?: LegalRegime;
  managerRegime?: LegalRegime;
  participating_organs?: Array<{ name?: string; items_allocated?: Record<string, number> }>;
  validity?: RawArpValidity;
  vigencia?: RawArpValidity;
  arp_months?: number;
  is_second_year_renewal?: boolean;
  renew_quantities_second_year?: boolean;
  has_edital_renewal_clause?: boolean;
  has_advantage_proof?: boolean;
  derived_contract_duration_months?: number;
  is_tic?: boolean;
  isIctArp?: boolean;
  is_ict_arp?: boolean;
  is_umbrella_or_single_lot?: boolean;
  is_umbrella_single_lot?: boolean;
  isUmbrellaLot?: boolean;
  has_granulated_calculation_memory?: boolean;
  has_granular_memory_and_justification?: boolean;
  hasTechnicalJustification?: boolean;
  items?: RawArpItem[];
  adhesion_request?: RawAdhesionRequest;
  adhesion_requests?: RawAdhesionRequest[];
  adherent_sphere?: FederativeSphere;
  adherentSphere?: FederativeSphere;
  adherent_regime?: LegalRegime;
  adherentRegime?: LegalRegime;
  registered_qty?: number;
  registeredQty?: number;
  prior_adhesions_qty?: number;
  accumulated_adhesions_qty?: number;
  requested_adhesion_qty?: number;
  requestedQty?: number;
  compilation_mode?: ArpCompilationMode;
  compilationMode?: ArpCompilationMode;
  mode?: ArpCompilationMode;
  output_format?: "docx" | "pdf" | "both";
  outputFormat?: "docx" | "pdf" | "both";
  format?: "docx" | "pdf" | "both";
}

export interface ArpGovernOptions {
  caseDir?: string;
  outputDir?: string;
  compilationMode?: ArpCompilationMode;
  mode?: ArpCompilationMode;
  outputFormat?: "docx" | "pdf" | "both";
  format?: "docx" | "pdf" | "both";
}

export interface ArpGovernDossier {
  status: "success" | "blocked" | "warning";
  engine_version: string;
  arp_number: string;
  decision: "APPROVED" | "REJECTED";
  blocking_tags: string[];
  ledger_summary: {
    items_checked: number;
    max_individual_ratio_pct: number;
    max_global_ratio_pct: number;
    preserved_own_balance_intact: boolean;
  };
  items_ledger: Array<{
    item_id: string;
    description?: string;
    registered_qty: number;
    own_balance_preserved: number;
    prior_carona_adhesions: number;
    requested_qty: number;
    new_accumulated_carona_adhesions: number;
    individual_ratio_pct: number;
    global_ratio_pct: number;
    individual_limit_ok: boolean;
    global_limit_ok: boolean;
  }>;
  compatibility_analysis: {
    regime_ok: boolean;
    manager_regime: string;
    adherent_regime: string;
    federative_ok: boolean;
    manager_sphere: string;
    adherent_sphere: string;
    is_tic: boolean;
    tic_divisibility_ok: boolean;
  };
  validity_analysis: {
    validity_months: number;
    is_second_year_renewal: boolean;
    has_edital_clause: boolean;
    has_advantage_proof: boolean;
    renewal_ok: boolean;
    derived_contract_duration_months: number;
    derived_contract_decoupled_valid: boolean;
  };
  compilation: {
    mode: string;
    docx_path?: string;
    pdf_path?: string;
  };
}

export interface ArpGovernSyntheticResult {
  status: "success" | "blocked" | "warning";
  engine_version: string;
  arp_number: string;
  decision: "APPROVED" | "REJECTED";
  blocking_tags: string[];
  ledger_summary: {
    items_checked: number;
    max_individual_ratio_pct: number;
    max_global_ratio_pct: number;
    preserved_own_balance_intact: boolean;
  };
  dossier_json_path: string;
  dossier_md_path: string;
  compiled_document_path?: string;
  compiled_pdf_path?: string;
  next_step_hint: string;
}
