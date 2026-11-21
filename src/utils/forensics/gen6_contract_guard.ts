const BIDDING_ROOT_ALLOWED_KEYS = new Set([
  "process_id", "bidder_name", "bidder_cnpj", "legal_regime", "evaluation_stance",
  "estimated_total_value", "caseDir", "case_dir", "outputDir", "output_dir",
  "compilation_mode", "compilationMode", "mode", "output_format", "outputFormat", "format",
  "ict_execution_model", "proposal_exequibility", "technical_qualification",
  "financial_qualification", "act_forensic_items", "competing_proposals_meta", "appeal_context",
  "estimated_budget_value", "offered_proposal_value", "offered_total_value",
  "is_engineering_or_works", "additional_guarantee_offered", "has_unit_price_overpricing",
  "jogo_de_planilha_detected", "unit_price_overpricing_detected", "unit_items",
  "spreadsheet_items", "items", "metric_type", "has_hidden_labor_dedication_trap",
  "ust_equals_raw_hour_without_catalog", "unbounded_technical_hour_os", "below_profile_floor",
  "offered_unit_value", "parametric_profile_floor_value", "sumula_262_diligence_opened",
  "summary_disqualification_attempted", "rejects_equivalent_metric_conversion",
  "forbids_certificate_summation_without_justification", "requires_cumulative_capital_and_equity",
  "required_min_equity_or_capital_pct", "prior_diligence_opportunity_granted",
  "diligence_viability_proven", "intent_summary_rejection_attempted",
  "summary_merit_rejection_of_intent", "deadline_less_than_3_business_days",
  "edital_appeal_deadline_days", "pre_existing_document_submitted_on_appeal",
  "acordao_1211_2021_applicable", "new_document_for_preexisting_fact",
  "maintained_decision_without_hierarchical_remission", "hierarchical_decision_days_elapsed",
  "requires_hierarchical_remission", "issuer_porte", "issuer_cnae_primary",
  "issuer_cnpj_status", "issuer_opening_date", "execution_start_date", "act_issue_date",
  "pncp_contract_verified", "attested_volume", "execution_months", "pdf_creation_date",
  "digital_signature_date", "object_category",
]);

const ACT_FORENSIC_ITEM_ALLOWED_KEYS = new Set([
  "certificate_id", "issuer_name", "issuer_cnpj", "issuer_type", "issuer_porte",
  "issuer_cnae_primary", "issuer_cnae_compatible_with_ict", "issuer_capital_social",
  "issuer_cnpj_status", "issuer_opening_date", "issuer_status_date", "execution_start_date",
  "execution_end_date", "act_issue_date", "pncp_contract_verified", "pncp_reference_id",
  "issuer_qsa_partners", "bidder_qsa_partners", "same_address_or_cep",
  "shared_or_free_email_domain", "issuer_official_email", "act_description_text",
  "edital_tr_reference_text", "attested_volume", "execution_months",
  "max_plausible_monthly_capacity", "pdf_creation_date", "pdf_mod_date",
  "digital_signature_date", "pdf_author", "pdf_creator_tool", "pdf_producer",
  "editing_software_traces", "act_pdf_path", "act_structure_json_path",
  "is_second_copy_declared", "expected_signer_name", "expected_signer_cpf_cnpj",
  "pades_signatures", "nfe_access_key", "nfe_declared_issue_date", "diligence_nfe_keys",
]);

const DILIGENCE_NFE_KEY_ALLOWED_KEYS = new Set([
  "access_key", "expected_cnpj", "declared_issue_date",
]);

const COMPETING_PROPOSAL_ALLOWED_KEYS = new Set([
  "bidder_name", "bidder_cnpj", "proposal_file_name", "proposal_pdf_path",
  "structure_json_path", "forensic_meta",
]);

const DIRECT_CONTRACTING_ROOT_ALLOWED_KEYS = new Set([
  "process_id", "contracting_modality", "modality", "legal_regime", "contracted_amount",
  "contracted_Amount", "supplier_cnpj", "caseDir", "case_dir", "outputDir", "output_dir",
  "compilation_mode", "compilationMode", "mode", "output_format", "outputFormat", "format",
  "inexigibility_details", "dispensation_by_value_details",
  "state_enterprise_opportunity_details", "quotations_forensic_meta",
  "offered_unit_price", "proposed_unit_price", "unit_price", "unit_quantity",
  "exclusivity_certificate_valid", "price_proof_invoices_count",
  "competition_infeasibility_proven", "pdm_catmat_catser",
  "prior_accumulated_spend_in_branch", "current_proposed_spend", "legal_annual_limit",
  "has_partner_uniqueness_justification", "is_ordinary_commodity_disguised",
  "has_risk_and_revenue_sharing_matrix", "object_category",
]);

const MARKET_PRICE_PROOF_ALLOWED_KEYS = new Set([
  "type", "identifier", "unit_price", "buyer", "issue_date",
  "pdf_path", "structure_json_path", "nfe_access_key", "issuer_cnpj",
]);

const QUOTATION_FORENSIC_META_ALLOWED_KEYS = new Set([
  "quotation_id", "file_name", "supplier_name", "structure_json_path",
  "pdf_path", "forensic_meta",
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

export function detectBiddingUnknownKeys(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const rec = raw as Record<string, unknown>;
  const unknown: string[] = [];

  collectObjectUnknownKeys(rec, BIDDING_ROOT_ALLOWED_KEYS, "", unknown);

  if (Array.isArray(rec.act_forensic_items)) {
    for (let i = 0; i < rec.act_forensic_items.length; i++) {
      const item = rec.act_forensic_items[i] as Record<string, unknown> | undefined;
      collectObjectUnknownKeys(item, ACT_FORENSIC_ITEM_ALLOWED_KEYS, `act_forensic_items[${i}]`, unknown);
      if (item && Array.isArray(item.diligence_nfe_keys)) {
        for (let j = 0; j < item.diligence_nfe_keys.length; j++) {
          const entry = item.diligence_nfe_keys[j];
          if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            collectObjectUnknownKeys(
              entry,
              DILIGENCE_NFE_KEY_ALLOWED_KEYS,
              `act_forensic_items[${i}].diligence_nfe_keys[${j}]`,
              unknown
            );
          }
        }
      }
    }
  }

  if (Array.isArray(rec.competing_proposals_meta)) {
    for (let i = 0; i < rec.competing_proposals_meta.length; i++) {
      collectObjectUnknownKeys(
        rec.competing_proposals_meta[i],
        COMPETING_PROPOSAL_ALLOWED_KEYS,
        `competing_proposals_meta[${i}]`,
        unknown
      );
    }
  }

  return Array.from(new Set(unknown));
}

export function detectDirectContractingUnknownKeys(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const rec = raw as Record<string, unknown>;
  const unknown: string[] = [];

  collectObjectUnknownKeys(rec, DIRECT_CONTRACTING_ROOT_ALLOWED_KEYS, "", unknown);

  const inex = rec.inexigibility_details as Record<string, unknown> | undefined;
  if (inex && typeof inex === "object" && Array.isArray(inex.supplier_market_price_proofs)) {
    for (let i = 0; i < inex.supplier_market_price_proofs.length; i++) {
      collectObjectUnknownKeys(
        inex.supplier_market_price_proofs[i],
        MARKET_PRICE_PROOF_ALLOWED_KEYS,
        `inexigibility_details.supplier_market_price_proofs[${i}]`,
        unknown
      );
    }
  }

  if (Array.isArray(rec.quotations_forensic_meta)) {
    for (let i = 0; i < rec.quotations_forensic_meta.length; i++) {
      collectObjectUnknownKeys(
        rec.quotations_forensic_meta[i],
        QUOTATION_FORENSIC_META_ALLOWED_KEYS,
        `quotations_forensic_meta[${i}]`,
        unknown
      );
    }
  }

  return Array.from(new Set(unknown));
}

export function buildUnknownKeySchemaWarnings(unknownKeys: string[]): string[] {
  return unknownKeys.map(
    (k) => `Chave desconhecida '${k}' ignorada sem conversão silenciosa (Lei 3). Consulte --dump-spec.`
  );
}
