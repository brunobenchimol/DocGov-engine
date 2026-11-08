// ============================================================================
// Auditoria Determinística de Limites de Aditamento Contratual (Gen5)
// docgov-engine v1.5.0 — src/contracts/addendum_auditor.ts
// Art. 125 da Lei 14.133/2021, Art. 81 da Lei 13.303/2016 e Jurisprudência TCU
// ============================================================================

import type { RawContractInput } from "./types.ts";

export interface AddendumAuditResult {
  blocking_tags: string[];
  gross_increase_pct: number;
  gross_decrease_pct: number;
  legal_limit_pct: number;
  total_increase: number;
  total_decrease: number;
  initial_base_value: number;
  is_reform: boolean;
  compensation_attempted: boolean;
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
}

export function auditContractAddendums(input: RawContractInput): AddendumAuditResult {
  const blocking_tags: string[] = [];

  const rawObjType = (input.object_type || input.objectType || input.contract_type || input.contractType || "").toUpperCase();
  const is_reform = rawObjType.includes("REFORM") || rawObjType.includes("REFORMA");
  const legal_limit_pct = is_reform ? 50.0 : 25.0;

  const rawRegime = (input.legal_regime || input.legalRegime || "LEI_14133").toUpperCase();
  const isStateEnterprise = rawRegime.includes("13303");

  const targetInstrument = (input.target_instrument || input.targetInstrument || "CONTRACT").toUpperCase();
  const isArpDirect = Boolean(
    input.is_arp_direct_addendum ??
    input.isArpDirectAddendum ??
    input.is_arp_instrument ??
    input.isArpInstrument ??
    (targetInstrument === "ARP")
  );

  const initialBaseValue = Number(
    input.updated_initial_value ??
    input.updatedInitialValue ??
    input.initial_value ??
    input.initialValue ??
    0
  );

  const rawAddendums = input.addendums || input.aditivos || [];

  let totalIncrease = 0;
  let totalDecrease = 0;
  let hasUnilateral = Boolean(input.unilateral ?? (input.is_consensual === false) ?? (input.isConsensual === false));
  const details: AddendumAuditResult["details"] = [];

  if (rawAddendums.length > 0) {
    for (let i = 0; i < rawAddendums.length; i++) {
      const item = rawAddendums[i];
      const inc = Number(item.value_increase ?? item.valueIncrease ?? 0);
      const dec = Number(item.value_decrease ?? item.valueDecrease ?? 0);
      const unilateral = Boolean(item.is_unilateral ?? item.isUnilateral ?? item.unilateral ?? (item.is_consensual === false) ?? (item.isConsensual === false));
      if (unilateral) hasUnilateral = true;

      totalIncrease += inc;
      totalDecrease += dec;

      const incPct = initialBaseValue > 0 ? (inc / initialBaseValue) * 100 : Number(item.increase_pct ?? item.increasePct ?? 0);
      const decPct = initialBaseValue > 0 ? (dec / initialBaseValue) * 100 : Number(item.decrease_pct ?? item.decreasePct ?? 0);

      details.push({
        id: item.id || `TA-${i + 1}`,
        increase: inc,
        decrease: dec,
        increase_pct: Number(incPct.toFixed(4)),
        decrease_pct: Number(decPct.toFixed(4)),
        unilateral,
        justification: item.justification,
      });
    }
  }

  // Suporte a percentuais informados diretamente na raiz
  let gross_increase_pct = 0;
  if (initialBaseValue > 0 && totalIncrease > 0) {
    gross_increase_pct = (totalIncrease / initialBaseValue) * 100;
  } else {
    gross_increase_pct = Number(
      input.gross_increase_pct ??
      input.increase_pct ??
      input.increasePct ??
      0
    );
  }

  let gross_decrease_pct = 0;
  if (initialBaseValue > 0 && totalDecrease > 0) {
    gross_decrease_pct = (totalDecrease / initialBaseValue) * 100;
  } else {
    gross_decrease_pct = Number(
      input.gross_decrease_pct ??
      input.decrease_pct ??
      input.decreasePct ??
      0
    );
  }

  gross_increase_pct = Number(gross_increase_pct.toFixed(2));
  gross_decrease_pct = Number(gross_decrease_pct.toFixed(2));

  // 1. Bloqueio Determinístico de Aditivo Direto sobre ARP (Art. 86 da Lei 14.133/2021)
  const hasDirectArpAddendum = isArpDirect && (gross_increase_pct > 0 || totalIncrease > 0);
  if (hasDirectArpAddendum) {
    blocking_tags.push("[ILLEGAL_ARP_ADDENDUM_BLOCK]");
  }

  // 2. Vedação Absoluta de Compensação entre Acréscimos e Supressões (Jurisprudência TCU)
  const explicitCompAttempt = Boolean(
    input.compensated_attempt ??
    input.compensatedAttempt ??
    rawAddendums.some((a) => a.compensated_attempt || a.compensatedAttempt)
  );
  const net_pct = gross_increase_pct - gross_decrease_pct;
  const masksBreach = gross_increase_pct > legal_limit_pct && net_pct <= legal_limit_pct && gross_decrease_pct > 0;
  const compensation_attempted = explicitCompAttempt || masksBreach;

  if (compensation_attempted) {
    blocking_tags.push("[ADDENDUM_COMPENSATION_FORBIDDEN]");
  }

  // 3. Limites Rígidos de Aditamento (25% compras/serviços/obras e 50% reformas)
  if (is_reform) {
    if (gross_increase_pct > 50.0) {
      blocking_tags.push("[ADDENDUM_LIMIT_EXCEEDED_50PCT]");
    }
  } else {
    if (gross_increase_pct > 25.0) {
      blocking_tags.push("[ADDENDUM_LIMIT_EXCEEDED_25PCT]");
    }
  }

  // 4. Bloqueio de Aditivo Unilateral no Regime das Empresas Estatais (Art. 81, § 1º da Lei 13.303/2016)
  const has_unilateral_state_enterprise = isStateEnterprise && hasUnilateral;
  if (has_unilateral_state_enterprise) {
    blocking_tags.push("[STATE_ENTERPRISE_UNILATERAL_ADDENDUM_BLOCK]");
  }

  return {
    blocking_tags,
    gross_increase_pct,
    gross_decrease_pct,
    legal_limit_pct,
    total_increase: totalIncrease,
    total_decrease: totalDecrease,
    initial_base_value: initialBaseValue,
    is_reform,
    compensation_attempted,
    has_unilateral_state_enterprise,
    has_direct_arp_addendum: hasDirectArpAddendum,
    details,
  };
}
