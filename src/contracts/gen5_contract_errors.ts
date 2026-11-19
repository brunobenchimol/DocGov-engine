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
  "contract_id",
  "contractId",
  "initial_value",
  "initial_value_cents",
  "updated_initial_value",
  "original_value",
  "target_instrument",
  "targetInstrument",
  "addenda",
  "addendums",
  "aditivos",
  "termos_aditivos",
  "tripartite_items",
  "items",
  "readjustments",
  "reajustes",
  "repactuations",
  "pas_sanctions",
  "pas_processes",
  "pas_evaluation",
  "pas",
  "sanctions",
  "sanction_type",
  "penalty_type",
  "fine_pct",
  "fine_percentage",
  "sla_glosa_misclassified",
  "defense_deadline_business_days",
  "defense_business_days",
  "price_basket",
  "price_basket_items",
  "cesta_precos",
  "pesquisa_precos",
  "risk_matrix_events",
  "rebalance_requests",
  "rebalance_events",
  "reequilibrio",
];

const ARP_GOVERNANCE_RECOGNIZED_KEYS = [
  "arp_number",
  "arpNumber",
  "managing_organ",
  "adherent_sphere",
  "manager_sphere",
  "adherent_regime",
  "manager_regime",
  "items",
  "adhesion_request",
  "validity",
  "vigencia",
  "is_tic",
  "is_ict_arp",
];

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
