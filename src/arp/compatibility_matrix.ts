// ============================================================================
// Matriz de Compatibilidade Jurídica, Federativa e TIC da ARP (Gen5)
// docgov-engine v1.5.0 — src/arp/compatibility_matrix.ts
// ============================================================================

import type { RawArpInput, ArpGovernDossier } from "./types.ts";

export interface ArpCompatibilityResult {
  blocking_tags: string[];
  compatibility_analysis: ArpGovernDossier["compatibility_analysis"];
  validity_analysis: ArpGovernDossier["validity_analysis"];
}

export function evaluateArpCompatibility(input: RawArpInput): ArpCompatibilityResult {
  const blocking_tags: string[] = [];

  // 1. Resolução do Regime Jurídico (Órgão Gerenciador vs Aderente)
  const managerRegime = (
    input.manager_regime ||
    input.managerRegime ||
    input.managing_organ?.legal_regime ||
    input.managing_organ?.legalRegime ||
    input.managing_organ?.regime ||
    "LEI_14133"
  ).toUpperCase();

  const adherentRegime = (
    input.adherent_regime ||
    input.adherentRegime ||
    input.adhesion_request?.requesting_organ?.legal_regime ||
    input.adhesion_request?.requesting_organ?.legalRegime ||
    input.adhesion_request?.requesting_organ?.regime ||
    input.adhesion_request?.adherent_organ?.legal_regime ||
    input.adhesion_request?.adherent_organ?.legalRegime ||
    managerRegime
  ).toUpperCase();

  const isStateEnterpriseManager = managerRegime.includes("13303");
  const isStateEnterpriseAdherent = adherentRegime.includes("13303");
  const regimeOk = isStateEnterpriseManager === isStateEnterpriseAdherent;

  if (!regimeOk) {
    blocking_tags.push("[ARP_REGIME_ASYMMETRY_BLOCK]");
  }

  // 2. Hierarquia Federativa (Vedação de Adesão Ascendente — Art. 86 §§ 3º e 8º)
  const managerSphere = (
    input.manager_sphere ||
    input.managerSphere ||
    input.managing_organ?.federative_sphere ||
    input.managing_organ?.federativeSphere ||
    input.managing_organ?.sphere ||
    "FEDERAL"
  ).toUpperCase();

  const adherentSphere = (
    input.adherent_sphere ||
    input.adherentSphere ||
    input.adhesion_request?.requesting_organ?.federative_sphere ||
    input.adhesion_request?.requesting_organ?.federativeSphere ||
    input.adhesion_request?.requesting_organ?.sphere ||
    input.adhesion_request?.adherent_organ?.federative_sphere ||
    managerSphere
  ).toUpperCase();

  let federativeOk = true;
  if (managerSphere === "MUNICIPAL" && (adherentSphere === "STATE" || adherentSphere === "ESTADUAL" || adherentSphere === "FEDERAL")) {
    federativeOk = false;
  } else if ((managerSphere === "STATE" || managerSphere === "ESTADUAL") && adherentSphere === "FEDERAL") {
    federativeOk = false;
  }

  if (!federativeOk) {
    blocking_tags.push("[ARP_FEDERATIVE_ASCENDING_BLOCK]");
  }

  // 3. Condicionantes de Soluções de TIC (Lote Único / Guarda-Chuva)
  const isTic = Boolean(input.is_tic || input.isIctArp || input.is_ict_arp);
  const isUmbrella = Boolean(
    input.is_umbrella_or_single_lot ||
    input.is_umbrella_single_lot ||
    input.isUmbrellaLot
  );
  const hasGranularMemory = Boolean(
    input.has_granulated_calculation_memory ||
    input.has_granular_memory_and_justification ||
    input.hasTechnicalJustification
  );

  let ticDivisibilityOk = true;
  if (isTic && isUmbrella && !hasGranularMemory) {
    ticDivisibilityOk = false;
    blocking_tags.push("[ARP_ICT_UMBRELLA_LOT_BLOCK]");
  }

  // 4. Vigência (12 + 12m), Renovação de Quantitativos e Desacoplamento Contratual
  const validityBlock = input.validity || input.vigencia || {};
  const validityMonths = Number(
    validityBlock.validity_months ??
    validityBlock.arp_months ??
    input.arp_months ??
    12
  );

  const isSecondYear = Boolean(
    validityBlock.is_second_year_renewal ??
    validityBlock.is_renewed_year_2 ??
    validityBlock.renew_quantities_second_year ??
    input.is_second_year_renewal ??
    input.renew_quantities_second_year
  );

  const hasEditalClause = Boolean(
    validityBlock.has_edital_renewal_clause ??
    validityBlock.edital_clause_for_renewal ??
    input.has_edital_renewal_clause
  );

  const hasAdvantageProof = Boolean(
    validityBlock.has_advantage_proof ??
    validityBlock.advantage_proven_year_2 ??
    input.has_advantage_proof
  );

  let renewalOk = true;
  if (isSecondYear && (!hasEditalClause || !hasAdvantageProof)) {
    renewalOk = false;
    blocking_tags.push("[ARP_RENEWAL_WITHOUT_EDITAL_CLAUSE_BLOCK]");
  }

  const derivedContractMonths = Number(
    validityBlock.derived_contract_duration_months ??
    (validityBlock.derived_contract_years ? validityBlock.derived_contract_years * 12 : undefined) ??
    input.derived_contract_duration_months ??
    12
  );
  // Desacoplamento: contrato derivado pode ter vigência autônoma de até 60 meses (5 anos)
  const derivedContractDecoupledValid = derivedContractMonths <= 60;

  return {
    blocking_tags,
    compatibility_analysis: {
      regime_ok: regimeOk,
      manager_regime: managerRegime,
      adherent_regime: adherentRegime,
      federative_ok: federativeOk,
      manager_sphere: managerSphere,
      adherent_sphere: adherentSphere,
      is_tic: isTic,
      tic_divisibility_ok: ticDivisibilityOk,
    },
    validity_analysis: {
      validity_months: validityMonths,
      is_second_year_renewal: isSecondYear,
      has_edital_clause: hasEditalClause,
      has_advantage_proof: hasAdvantageProof,
      renewal_ok: renewalOk,
      derived_contract_duration_months: derivedContractMonths,
      derived_contract_decoupled_valid: derivedContractDecoupledValid,
    },
  };
}
