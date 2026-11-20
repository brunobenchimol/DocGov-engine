// ============================================================================
// Contratos Exact Copy-Paste Error (Lei 3): Gen5 Execução Contratual e ARP
// docgov-engine — src/contracts/gen5_contract_errors.ts
// ============================================================================

export const EXACT_COPY_PASTE_CONTRACT_EXECUTION_SNIPPET = `{
  "contract_id": "CT-001/2026",
  "legal_regime": "LEI_14133",
  "object_type": "SERVICE",
  "target_instrument": "CONTRACT",
  "sphere": "FEDERAL",
  "initial_value": 1000000,
  "addendums": [
    { "id": "TA-01", "value_increase": 200000, "value_decrease": 0 }
  ],
  "tripartite_items": [],
  "readjustments": [],
  "pas_sanctions": [],
  "price_basket": [],
  "risk_matrix_events": []
}`;

export const EXACT_COPY_PASTE_ARP_GOVERNANCE_SNIPPET = `{
  "arp_number": "ARP-001/2026",
  "managing_organ": {
    "name": "ORGAO_CONTRATANTE",
    "sphere": "FEDERAL",
    "legal_regime": "LEI_14133",
    "is_state_enterprise": false
  },
  "adherent_sphere": "FEDERAL",
  "adherent_regime": "LEI_14133",
  "validity": { "validity_months": 12, "is_renewed_year_2": false },
  "items": [
    {
      "item_id": "IT-01",
      "registered_quantity": 100,
      "unit_price": 500,
      "consumed_by_managing_and_participants": 20,
      "previous_carona_adhesions": 0,
      "requested_adhesion_qty": 30
    }
  ],
  "adhesion_request": {
    "requesting_organ": { "name": "ORGAO_A", "sphere": "FEDERAL", "legal_regime": "LEI_14133" },
    "supplier_consent": true
  }
}`;

const CONTRACT_EXECUTION_RECOGNIZED_KEYS = [
  "contract_id", "contractId", "initial_value", "initialValue", "initial_value_cents",
  "initialValueCents", "updated_initial_value", "updatedInitialValue", "original_value",
  "originalValue", "target_instrument", "targetInstrument", "addendums", "aditivos",
  "tripartite_items", "tripartite", "items", "readjustments", "reajustes", "readjustment",
  "reajuste", "pas_sanctions", "pasSanctions", "pas_sanction", "pasSanction",
  "pas_processes", "pasProcesses", "pas_evaluation", "pasEvaluation", "pas", "sanctions",
  "sancoes", "sanction_type", "penalty_type", "fine_pct", "fine_percentage",
  "sla_glosa_misclassified", "defense_deadline_business_days", "defense_business_days",
  "price_basket", "priceBasket", "price_basket_items", "priceBasketItems",
  "cesta_precos", "cestaPrecos", "pesquisa_precos", "pesquisaPrecos",
  "risk_matrix_events", "riskMatrixEvents", "rebalance_requests", "rebalanceRequests",
  "rebalance_request", "rebalanceRequest", "rebalance_claim", "rebalanceClaim",
  "rebalance_events", "rebalanceEvents", "reequilibrio", "matriz_riscos", "matrizRiscos",
];

const ARP_GOVERNANCE_RECOGNIZED_KEYS = [
  "arp_number", "arpNumber", "managing_organ", "managingOrgan", "adherent_sphere",
  "adherentSphere", "manager_sphere", "managerSphere", "adherent_regime",
  "adherentRegime", "manager_regime", "managerRegime", "items", "adhesion_request",
  "validity", "vigencia", "is_tic", "is_ict_arp", "isIctArp", "registered_qty",
  "registeredQty", "requested_adhesion_qty", "requestedQty",
];

const ADDENDUM_ITEM_ALLOWED_KEYS = new Set([
  "id", "numero", "date", "type", "description", "descricao",
  "value_increase", "valueIncrease", "value_decrease", "valueDecrease",
  "increase_pct", "increasePct", "gross_increase_pct",
  "decrease_pct", "decreasePct", "gross_decrease_pct",
  "is_unilateral", "isUnilateral", "unilateral",
  "is_consensual", "isConsensual",
  "compensated_attempt", "compensatedAttempt", "justification",
]);

const TRIPARTITE_ITEM_ALLOWED_KEYS = new Set([
  "item_id", "itemId", "description", "edital_tr", "winning_proposal", "arp",
  "contract_or_invoice", "tr_unit_price", "trUnitPrice", "proposal_unit_price",
  "proposalUnitPrice", "arp_unit_price", "arpUnitPrice", "contract_unit_price",
  "contractUnitPrice", "invoice_unit_price", "invoiceUnitPrice", "homologated_qty",
  "homologatedQty", "contract_qty", "contractQty", "invoiced_qty", "invoicedQty",
  "attested_qty", "attestedQty", "overpricing_detected", "overpricingDetected",
  "advance_payment_without_guarantee",
]);

const READJUSTMENT_ITEM_ALLOWED_KEYS = new Set([
  "id", "type", "index_name", "index", "base_date", "budget_base_date",
  "request_date", "grant_date", "months_elapsed", "interregnum_months",
  "has_cct_proof", "hasCctProof", "cct_attached", "cctAttached", "applied_percentage",
]);

const PAS_ITEM_ALLOWED_KEYS = new Set([
  "id", "process_id", "processId", "infraction_article", "infractionArticle",
  "infraction_severity", "infractionSeverity", "penalty_type", "penaltyType",
  "sanction_type", "sanctionType", "proposed_sanction", "proposedSanction",
  "sanction_scope", "sanctionScope", "sanction_scope_claimed", "sanctionScopeClaimed",
  "territorial_scope", "territorialScope", "duration_months", "durationMonths",
  "debarment_months", "debarmentMonths", "debarment_years", "debarmentYears",
  "proposed_fine_pct", "proposedFinePct", "proposed_fine_percentage", "proposedFinePercentage",
  "fine_pct", "finePct", "fine_percentage", "finePercentage", "multa_pct", "multaPct",
  "multa_percentual", "multaPercentual", "multa_sancionatoria_proposta", "fine_value",
  "fineValue", "contract_value", "contractValue", "legal_regime", "legalRegime",
  "opened_formal_pas", "openedFormalPas", "prior_notification_sent", "priorNotificationSent",
  "defense_deadline_business_days", "defenseDeadlineBusinessDays", "defense_business_days",
  "defenseBusinessDays", "defense_deadline_days", "defenseDeadlineDays", "defense_period_days",
  "defensePeriodDays", "contradictory_days", "contradictoryDays", "prazo_defesa_dias_uteis",
  "prazo_defesa_dias", "defense_days_type", "defenseDaysType", "tipo_prazo_defesa",
  "guarantee_modality", "guaranteeModality", "has_surety_bond", "hasSuretyBond",
  "seguro_garantia", "seguroGarantia", "garantia", "surety_bond", "suretyBond",
  "claim_or_default_detected", "claimOrDefaultDetected", "surety_insurer_notified",
  "suretyInsurerNotified", "insurer_notified", "insurerNotified", "seguradora_notificada",
  "seguradoraNotificada", "policy_expired", "policyExpired", "sla_glosa", "slaGlosa",
  "ans_imr", "ansImr", "is_sla_glosa", "classified_as_penalty", "treated_as_penalty",
  "sla_glosa_misclassified", "glosa_ans_como_multa",
  "ans_glosa_applied_as_punitive_sanction", "ansGlosaAppliedAsPunitiveSanction",
  "is_punitive_disguised_as_glosa", "isPunitiveDisguisedAsGlosa",
  "is_imr_classified_as_sanction", "isImrClassifiedAsSanction",
  "within_imr_bands", "withinImrBands", "sphere", "esfera", "uf", "municipality", "municipio",
  "signing_authority_role", "signingAuthorityRole", "authority_role", "authorityRole",
  "signed_by", "signedBy", "signing_authority", "signingAuthority",
  "has_conclusive_legal_opinion", "hasConclusiveLegalOpinion",
  "conclusive_legal_opinion", "conclusiveLegalOpinion",
  "registries_commanded", "registriesCommanded", "mandatory_registries", "mandatoryRegistries",
  "register_pncp", "registerPncp", "register_ceis", "registerCeis", "register_cnep",
  "registerCnep", "register_ceis_cnep", "registerCeisCnep", "notify_audit_court",
  "notifyAuditCourt", "external_control_court_notified", "externalControlCourtNotified",
  "art38_cross_debarment_applicable", "art38CrossDebarmentApplicable",
  "dosimetry_evaluation", "dosimetryEvaluation", "dosimetry_benchmark", "dosimetryBenchmark",
  "juris_precedent_id", "jurisPrecedentId", "benchmark_precedents", "benchmarkPrecedents",
  "jurisprudential_precedents", "precedentes_citados", "precedent_fines_pct",
  "benchmark_median_pct", "benchmarkMedianPct", "precedent_median_pct",
  "historical_average_fine_pct", "benchmark_range_pct", "benchmarkRangePct",
  "precedent_range_pct", "precedent_min_pct", "precedent_max_pct", "benchmark_max_pct",
  "benchmarkMaxPct", "benchmark_median_months", "benchmarkMedianMonths",
  "benchmark_max_months", "benchmarkMaxMonths", "nature_and_gravity_weighed",
  "natureAndGravityWeighed", "case_peculiarities_weighed", "casePeculiaritiesWeighed",
  "concrete_damage_proven", "concreteDamageProven", "is_primary_offender", "isPrimaryOffender",
  "has_integrity_program", "hasIntegrityProgram", "aggravating_factors", "aggravatingFactors",
  "mitigating_factors", "mitigatingFactors", "aggravating_factors_proven",
  "aggravatingFactorsProven", "lindb_art22_weighed", "lindbArt22Weighed",
  "art156_par1_weighed", "art156Par1Weighed",
  "has_jurisprudential_calibration", "hasJurisprudentialCalibration",
]);

const PRICE_BASKET_ITEM_ALLOWED_KEYS = new Set([
  "item_id", "itemId", "description", "quotes", "cotacoes", "prices", "values",
  "samples", "precos", "selected_metric", "selectedMetric", "selected_method",
  "selectedMethod", "claimed_reference_price", "claimedReferencePrice",
  "proposed_unit_price", "proposedUnitPrice", "items", "itens",
]);

const REBALANCE_ITEM_ALLOWED_KEYS = new Set([
  "id", "event_description", "eventDescription", "descricao", "risk_allocated_to",
  "riskAllocatedTo", "alocacao_matriz_riscos", "alocacaoMatrizRiscos", "risco_alocado",
  "riscoAlocado", "is_extraordinary_unforeseeable", "isExtraordinaryUnforeseeable",
  "is_ordinary_inflation", "isOrdinaryInflation", "event_nature", "eventNature",
  "natureza", "request_accepted",
]);

const CONTRACT_ROOT_ALLOWED_KEYS = new Set([
  ...CONTRACT_EXECUTION_RECOGNIZED_KEYS,
  ...PAS_ITEM_ALLOWED_KEYS,
  "contract_type", "contractType", "object_type", "objectType",
  "is_arp_instrument", "isArpInstrument", "is_arp_direct_addendum", "isArpDirectAddendum",
  "current_value", "currentValue", "increase_pct", "increasePct", "gross_increase_pct",
  "decrease_pct", "decreasePct", "gross_decrease_pct", "compensated_attempt",
  "compensatedAttempt", "is_consensual", "isConsensual", "unilateral",
  "compilation_mode", "compilationMode", "mode", "output_format", "outputFormat",
  "format", "caseDir", "outputDir", "auditType", "type",
]);

const ARP_ROOT_ALLOWED_KEYS = new Set([
  ...ARP_GOVERNANCE_RECOGNIZED_KEYS,
  "caseDir", "outputDir", "participating_organs", "arp_months", "is_second_year_renewal",
  "renew_quantities_second_year", "has_edital_renewal_clause", "has_advantage_proof",
  "derived_contract_duration_months", "is_umbrella_or_single_lot", "is_umbrella_single_lot",
  "isUmbrellaLot", "has_granulated_calculation_memory", "has_granular_memory_and_justification",
  "hasTechnicalJustification", "prior_adhesions_qty", "accumulated_adhesions_qty",
  "compilation_mode", "compilationMode", "mode", "output_format", "outputFormat", "format",
]);

const ARP_ITEM_ALLOWED_KEYS = new Set([
  "item_id", "itemId", "id", "description", "unit", "registered_quantity",
  "registeredQuantity", "registered_qty", "registeredQty", "unit_price", "unitPrice",
  "consumed_by_managing_and_participants", "manager_own_qty", "own_balance",
  "participants_qty", "previous_carona_adhesions", "prior_adhesions_qty",
  "accumulated_adhesions_qty", "requested_adhesion_qty", "requestedQty",
]);

const ARP_VALIDITY_ALLOWED_KEYS = new Set([
  "start_date", "end_date", "validity_months", "arp_months", "is_renewed_year_2",
  "is_second_year_renewal", "renew_quantities_second_year", "has_edital_renewal_clause",
  "edital_clause_for_renewal", "has_advantage_proof", "advantage_proven_year_2",
  "derived_contract_duration_months", "derived_contract_years",
]);

const ARP_ORGAN_ALLOWED_KEYS = new Set([
  "name", "federative_sphere", "federativeSphere", "sphere",
  "legal_regime", "legalRegime", "regime", "is_state_enterprise", "isStateEnterprise",
]);

const ARP_ADHESION_ALLOWED_KEYS = new Set([
  "requesting_organ", "adherent_organ", "items_requested", "supplier_consent",
  "is_supplier_consensual", "market_price_comparison", "etp_pdtic_alignment_summary",
  "justification_no_bidding",
]);

function collectObjectUnknownKeys(
  obj: unknown,
  allowed: Set<string>,
  prefix: string,
  out: string[]
): void {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (!allowed.has(key)) {
      out.push(prefix ? `${prefix}.${key}` : key);
    }
  }
}

function collectArrayOrObjectUnknownKeys(
  val: unknown,
  allowed: Set<string>,
  fieldName: string,
  out: string[]
): void {
  if (!val) return;
  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      collectObjectUnknownKeys(val[i], allowed, `${fieldName}[${i}]`, out);
    }
  } else if (typeof val === "object") {
    collectObjectUnknownKeys(val, allowed, fieldName, out);
  }
}

export function detectContractExecutionUnknownKeys(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const rec = raw as Record<string, unknown>;
  const unknown: string[] = [];

  collectObjectUnknownKeys(rec, CONTRACT_ROOT_ALLOWED_KEYS, "", unknown);

  for (const k of ["addendums", "aditivos", "addenda", "termos_aditivos"]) {
    collectArrayOrObjectUnknownKeys(rec[k], ADDENDUM_ITEM_ALLOWED_KEYS, k, unknown);
  }
  for (const k of ["tripartite_items", "tripartite", "items"]) {
    collectArrayOrObjectUnknownKeys(rec[k], TRIPARTITE_ITEM_ALLOWED_KEYS, k, unknown);
  }
  for (const k of ["readjustments", "reajustes", "readjustment", "reajuste", "repactuations"]) {
    collectArrayOrObjectUnknownKeys(rec[k], READJUSTMENT_ITEM_ALLOWED_KEYS, k, unknown);
  }
  for (const k of [
    "pas_sanctions", "pasSanctions", "pas_sanction", "pasSanction",
    "pas_processes", "pasProcesses", "pas_evaluation", "pasEvaluation",
    "pas", "sanctions", "sancoes",
  ]) {
    collectArrayOrObjectUnknownKeys(rec[k], PAS_ITEM_ALLOWED_KEYS, k, unknown);
  }
  for (const k of [
    "price_basket", "priceBasket", "price_basket_items", "priceBasketItems",
    "cesta_precos", "cestaPrecos", "pesquisa_precos", "pesquisaPrecos",
  ]) {
    collectArrayOrObjectUnknownKeys(rec[k], PRICE_BASKET_ITEM_ALLOWED_KEYS, k, unknown);
  }
  for (const k of [
    "risk_matrix_events", "riskMatrixEvents", "rebalance_requests", "rebalanceRequests",
    "rebalance_request", "rebalanceRequest", "rebalance_claim", "rebalanceClaim",
    "rebalance_events", "rebalanceEvents", "reequilibrio", "matriz_riscos", "matrizRiscos",
  ]) {
    collectArrayOrObjectUnknownKeys(rec[k], REBALANCE_ITEM_ALLOWED_KEYS, k, unknown);
  }

  return Array.from(new Set(unknown));
}

export function detectArpGovernanceUnknownKeys(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const rec = raw as Record<string, unknown>;
  const unknown: string[] = [];

  collectObjectUnknownKeys(rec, ARP_ROOT_ALLOWED_KEYS, "", unknown);

  for (const k of ["managing_organ", "managingOrgan"]) {
    collectObjectUnknownKeys(rec[k], ARP_ORGAN_ALLOWED_KEYS, k, unknown);
  }
  for (const k of ["validity", "vigencia"]) {
    collectObjectUnknownKeys(rec[k], ARP_VALIDITY_ALLOWED_KEYS, k, unknown);
  }
  collectArrayOrObjectUnknownKeys(rec.items, ARP_ITEM_ALLOWED_KEYS, "items", unknown);

  for (const k of ["adhesion_request", "adhesions", "adhesion_requests"]) {
    const val = rec[k];
    if (!val) continue;
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const entry = val[i] as Record<string, unknown> | undefined;
        collectObjectUnknownKeys(entry, ARP_ADHESION_ALLOWED_KEYS, `${k}[${i}]`, unknown);
        if (entry && typeof entry === "object") {
          for (const orgKey of ["requesting_organ", "adherent_organ"]) {
            if (typeof entry[orgKey] === "string") {
              unknown.push(`${k}[${i}].${orgKey}(string_must_be_object)`);
            } else {
              collectObjectUnknownKeys(entry[orgKey], ARP_ORGAN_ALLOWED_KEYS, `${k}[${i}].${orgKey}`, unknown);
            }
          }
        }
      }
    } else if (typeof val === "object") {
      const entry = val as Record<string, unknown>;
      collectObjectUnknownKeys(entry, ARP_ADHESION_ALLOWED_KEYS, k, unknown);
      for (const orgKey of ["requesting_organ", "adherent_organ"]) {
        if (typeof entry[orgKey] === "string") {
          unknown.push(`${k}.${orgKey}(string_must_be_object)`);
        } else {
          collectObjectUnknownKeys(entry[orgKey], ARP_ORGAN_ALLOWED_KEYS, `${k}.${orgKey}`, unknown);
        }
      }
    }
  }

  return Array.from(new Set(unknown));
}

function hasAnyRecognizedKey(raw: unknown, keys: readonly string[]): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return false;
  }
  const record = raw as Record<string, unknown>;
  return keys.some((key) => record[key] !== undefined);
}

export function hasRecognizedContractExecutionInput(raw: unknown): boolean {
  return hasAnyRecognizedKey(raw, CONTRACT_EXECUTION_RECOGNIZED_KEYS);
}

export function hasRecognizedArpGovernanceInput(raw: unknown): boolean {
  return hasAnyRecognizedKey(raw, ARP_GOVERNANCE_RECOGNIZED_KEYS);
}

function formatGen5ContractError(reason: string, snippet: string): Error {
  return new Error(
    `Erro de Contrato (docgov-engine Gen5): ${reason}\n` +
      `NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:\n` +
      `\`\`\`json\n${snippet}\n\`\`\``
  );
}

export function createContractExecutionContractError(reason: string): Error {
  return formatGen5ContractError(reason, EXACT_COPY_PASTE_CONTRACT_EXECUTION_SNIPPET);
}

export function createArpGovernanceContractError(reason: string): Error {
  return formatGen5ContractError(reason, EXACT_COPY_PASTE_ARP_GOVERNANCE_SNIPPET);
}
