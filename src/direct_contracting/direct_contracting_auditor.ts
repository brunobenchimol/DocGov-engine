// ============================================================================
// Auditor Determinístico: Contratação Direta & Oportunidade Estatal (Gen6)
// docgov-engine v1.6.0 — src/direct_contracting/direct_contracting_auditor.ts
// ============================================================================

import type {
  RawDirectContractingInput,
  DirectContractingModality,
  DirectContractingAuditDossier,
} from "./types.ts";
import { detectCrossDocumentForensicCollisions } from "../utils/pdf/forensic_cross_audit.ts";
import { parseAndValidateNfeAccessKey } from "../utils/forensics/nfe_key_validator.ts";

function computeSanitizedMedian(values: number[]): number | undefined {
  const valid = values
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (valid.length === 0) return undefined;

  const medianOf = (arr: number[]) => {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
  };

  const rawMedian = medianOf(valid);
  const filtered =
    valid.length >= 3
      ? valid.filter((v) => v >= rawMedian * 0.5 && v <= rawMedian * 1.5)
      : valid;
  const effective = filtered.length > 0 ? filtered : valid;
  return Math.round(medianOf(effective) * 100) / 100;
}

function checkQuotationForensicSimulation(
  raw: RawDirectContractingInput,
  blocking_tags: string[],
  findings: string[]
): void {
  const quotes = raw.quotations_forensic_meta || [];
  if (quotes.length < 2) return;

  const collisions = detectCrossDocumentForensicCollisions(
    quotes.map((q, idx) => ({
      fileName: q.file_name || q.supplier_name || q.quotation_id || `cotacao_${idx + 1}.pdf`,
      forensicMeta: q.forensic_meta,
    }))
  );

  if (collisions.length > 0) {
    if (!blocking_tags.includes("[PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK]")) {
      blocking_tags.push("[PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK]");
    }
    for (const col of collisions) {
      findings.push(
        `Simulação fraudulenta na pesquisa de preços detectada por colisão de metadados: ${col.reason}`
      );
    }
  }
}

export function normalizeDirectModality(raw: RawDirectContractingInput): DirectContractingModality {
  const val = String(raw.contracting_modality || raw.modality || "INEXIGIBILIDADE")
    .trim()
    .toUpperCase();

  if (
    val.includes("DISPENSA") ||
    val.includes("DISPENSATION") ||
    val === "ART_75" ||
    val === "ART_29"
  ) {
    return "DISPENSA_VALOR";
  }
  if (
    val.includes("OPORTUNIDADE") ||
    val.includes("OPPORTUNITY") ||
    val.includes("ESTATAL") ||
    val.includes("PARTNERSHIP") ||
    val === "ART_28_3_II"
  ) {
    return "OPORTUNIDADE_NEGOCIO_ESTATAL";
  }
  return "INEXIGIBILIDADE";
}

export function evaluateDirectContractingRules(raw: RawDirectContractingInput): {
  modality: DirectContractingModality;
  legal_regime: string;
  blocking_tags: string[];
  findings: string[];
  inexigibility_summary?: DirectContractingAuditDossier["inexigibility_summary"];
  dispensation_summary?: DirectContractingAuditDossier["dispensation_summary"];
  state_opportunity_summary?: DirectContractingAuditDossier["state_opportunity_summary"];
} {
  const modality = normalizeDirectModality(raw);
  const legalRegime = String(
    raw.legal_regime || (modality === "OPORTUNIDADE_NEGOCIO_ESTATAL" ? "LEI_13303" : "LEI_14133")
  ).toUpperCase();

  const blocking_tags: string[] = [];
  const findings: string[] = [];

  checkQuotationForensicSimulation(raw, blocking_tags, findings);

  if (modality === "INEXIGIBILIDADE") {
    const inex = raw.inexigibility_details || {};
    const cert = inex.exclusivity_certificate || {};

    const competitionProven =
      raw.competition_infeasibility_proven !== undefined
        ? Boolean(raw.competition_infeasibility_proven)
        : inex.competition_infeasibility_proven !== false;

    if (!competitionProven) {
      blocking_tags.push("[INEXIGIBILITY_COMPETITION_VIABILITY_UNPROVEN_BLOCK]");
      findings.push(
        "Inexigibilidade sem comprovação objetiva de inviabilidade de competição (Art. 74 da Lei 14.133/2021 / Art. 30 da Lei 13.303/2016)."
      );
    }

    const certInvalid =
      raw.exclusivity_certificate_valid === false ||
      Boolean(cert.is_generic_or_self_declared) ||
      Boolean(cert.covers_only_local_scope_without_technical_justification) ||
      cert.sumula_255_tcu_verified === false ||
      cert.provided === false;

    if (certInvalid) {
      blocking_tags.push("[INVALID_EXCLUSIVITY_CERTIFICATE_BLOCK]");
      findings.push(
        "Atestado de exclusividade inválido, genérico ou emitido sem verificação de legitimidade do ente emissor (Súmula TCU nº 255)."
      );
    }

    const proofsCount =
      raw.price_proof_invoices_count !== undefined
        ? Number(raw.price_proof_invoices_count)
        : (inex.supplier_market_price_proofs || []).length;

    if (proofsCount < 3) {
      blocking_tags.push("[INEXIGIBILITY_PRICE_PROOF_INSUFFICIENT_BLOCK]");
      findings.push(
        `Comprovação de razoabilidade de preços insuficiente (${proofsCount}/3): exigido mínimo de 3 Notas Fiscais ou contratos recentes praticados pelo próprio fornecedor no mercado (Art. 23, § 4º da Lei 14.133/2021 e IN SEGES 65/2021).`
      );
    }

    const proofPrices = (inex.supplier_market_price_proofs || [])
      .map((p) => Number(p.unit_price))
      .filter((n) => Number.isFinite(n) && n > 0);
    const sanitizedMedian = computeSanitizedMedian(proofPrices);

    for (const proof of inex.supplier_market_price_proofs || []) {
      if (!proof.nfe_access_key) continue;
      const nfeRes = parseAndValidateNfeAccessKey(proof.nfe_access_key, {
        expectedCnpj: proof.issuer_cnpj || raw.supplier_cnpj,
        declaredIssueDate: proof.issue_date,
      });
      for (const tag of nfeRes.blocking_tags) {
        if (!blocking_tags.includes(tag)) blocking_tags.push(tag);
      }
      nfeRes.reasons.forEach((r) =>
        findings.push(`Perícia NF-e 44 dígitos (${proof.identifier || "sem ID"}): ${r}`)
      );
    }

    const qty = Number(raw.unit_quantity || 0);
    const rawProposed =
      raw.offered_unit_price ??
      raw.proposed_unit_price ??
      raw.unit_price ??
      (raw.contracted_amount ?? raw.contracted_Amount);
    const comparisonPrice =
      raw.offered_unit_price !== undefined ||
      raw.proposed_unit_price !== undefined ||
      raw.unit_price !== undefined
        ? Number(rawProposed)
        : rawProposed !== undefined && qty > 0
          ? Number(rawProposed) / qty
          : rawProposed !== undefined
            ? Number(rawProposed)
            : undefined;

    if (
      sanitizedMedian !== undefined &&
      comparisonPrice !== undefined &&
      Number.isFinite(comparisonPrice) &&
      comparisonPrice > sanitizedMedian * 1.0001
    ) {
      blocking_tags.push("[INEXIGIBILITY_OVERPRICING_ABOVE_SUPPLIER_MARKET_PROOF_BLOCK]");
      findings.push(
        `Sobrepreço detectado na Inexigibilidade: valor proposto (R$ ${comparisonPrice.toFixed(
          2
        )}) excede a mediana saneada das NFs/contratos do próprio fornecedor (R$ ${sanitizedMedian.toFixed(
          2
        )}) (Art. 23, § 4º da Lei 14.133/2021).`
      );
    }

    return {
      modality,
      legal_regime: legalRegime,
      blocking_tags,
      findings,
      inexigibility_summary: {
        exclusivity_valid: !certInvalid,
        valid_market_price_proofs_count: proofsCount,
        competition_infeasibility_proven: competitionProven,
        ...(sanitizedMedian !== undefined ? { sanitized_market_median: sanitizedMedian } : {}),
        ...(comparisonPrice !== undefined && Number.isFinite(comparisonPrice)
          ? { proposed_comparison_price: Math.round(comparisonPrice * 100) / 100 }
          : {}),
      },
    };
  }

  if (modality === "DISPENSA_VALOR") {
    const disp = raw.dispensation_by_value_details || {};
    const ug = disp.managing_unit_code || "UG-PADRAO";
    const year = Number(disp.financial_year || new Date().getFullYear());
    const branch = String(disp.activity_branch_code || raw.pdm_catmat_catser || "PDM-GENERICO");
    const isEng = Boolean(disp.is_engineering_or_maintenance);

    const defaultLimit =
      legalRegime === "LEI_13303"
        ? isEng
          ? 100000
          : 50000
        : isEng
          ? 125451.15
          : 62725.59;

    const legalLimit = Number(disp.legal_annual_limit ?? raw.legal_annual_limit ?? defaultLimit);
    const prior = Number(disp.prior_accumulated_spend_in_branch ?? raw.prior_accumulated_spend_in_branch ?? 0);
    const current = Number(disp.current_proposed_spend ?? raw.current_proposed_spend ?? raw.contracted_amount ?? raw.contracted_Amount ?? 0);
    const accumulated = Math.round((prior + current) * 100) / 100;
    const fragmentation = accumulated > legalLimit;

    if (fragmentation) {
      blocking_tags.push("[EXPENSE_FRAGMENTATION_BLOCK]");
      findings.push(
        `Fracionamento ilegal de despesa detectado na UG '${ug}' (${year}, ramo '${branch}'): somatório acumulado (R$ ${accumulated.toFixed(2)}) excede o teto legal anual (R$ ${legalLimit.toFixed(2)}).`
      );
    }

    return {
      modality,
      legal_regime: legalRegime,
      blocking_tags,
      findings,
      dispensation_summary: {
        managing_unit_code: ug,
        activity_branch_code: branch,
        financial_year: year,
        legal_annual_limit: legalLimit,
        accumulated_total_in_branch: accumulated,
        fragmentation_detected: fragmentation,
      },
    };
  }

  // OPORTUNIDADE_NEGOCIO_ESTATAL (Art. 28, § 3º, II da Lei 13.303/2016)
  const opp = raw.state_enterprise_opportunity_details || {};
  const linkedToPurpose = opp.is_linked_to_corporate_purpose !== false;
  const partnerSingularity =
    raw.has_partner_uniqueness_justification !== undefined
      ? Boolean(raw.has_partner_uniqueness_justification)
      : opp.partner_competitive_singularity_proven !== false;
  const compInfeasible = opp.competitive_procedure_infeasibility_proven !== false;
  const riskMatrix =
    raw.has_risk_and_revenue_sharing_matrix !== undefined
      ? Boolean(raw.has_risk_and_revenue_sharing_matrix)
      : opp.has_risk_and_revenue_sharing_matrix !== false;
  const ordinaryDisguised =
    Boolean(raw.is_ordinary_commodity_disguised) ||
    Boolean(opp.is_ordinary_commodity_disguised);

  if (!linkedToPurpose || !partnerSingularity || !compInfeasible || !riskMatrix || ordinaryDisguised) {
    blocking_tags.push("[STATE_ENTERPRISE_PARTNERSHIP_UNJUSTIFIED_BLOCK]");
    findings.push(
      "Oportunidade de Negócio Estatal (Art. 28, § 3º, II da Lei 13.303/2016) não preenchida: exige vinculação ao objeto social, singularidade competitiva do parceiro, inviabilidade concorrencial, matriz de compartilhamento de riscos/receitas e vedação a compra comum disfarçada."
    );
  }

  return {
    modality,
    legal_regime: legalRegime,
    blocking_tags,
    findings,
    state_opportunity_summary: {
      linked_to_corporate_purpose: linkedToPurpose,
      partner_singularity_proven: partnerSingularity,
      competitive_infeasibility_proven: compInfeasible,
      risk_revenue_matrix_present: riskMatrix,
      ordinary_commodity_disguised: ordinaryDisguised,
    },
  };
}
