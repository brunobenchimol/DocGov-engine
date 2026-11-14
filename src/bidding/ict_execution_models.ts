// ============================================================================
// Módulo 9.1: Modelos de Execução TIC sem DEMO & Exequibilidade (Gen6)
// docgov-engine v1.6.0 — src/bidding/ict_execution_models.ts
// ============================================================================

import type {
  RawBiddingProposalInput,
  IctExecutionEvaluation,
  IctProfileFloorInput,
} from "./types.ts";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeProfileUnitFloor(profiles: IctProfileFloorInput[]): number {
  if (!profiles || profiles.length === 0) return 0;
  let totalCost = 0;
  let totalUnits = 0;
  for (const p of profiles) {
    const salary = Number(p.salary_floor || 0);
    const charges = Number(p.social_charges_pct ?? 70) / 100;
    const taxes = Number(p.taxes_and_admin_pct ?? 18) / 100;
    const units = Number(p.monthly_productive_units ?? 168);
    if (salary > 0 && units > 0) {
      totalCost += salary * (1 + charges) * (1 + taxes);
      totalUnits += units;
    }
  }
  return totalUnits > 0 ? round2(totalCost / totalUnits) : 0;
}

export function evaluateIctExecutionAndExequibility(
  raw: RawBiddingProposalInput
): IctExecutionEvaluation {
  const model = raw.ict_execution_model || {};
  const exeq = raw.proposal_exequibility || {};

  const metricType = String(
    model.metric_type || raw.metric_type || "UST"
  ).toUpperCase();

  const blocking_tags: string[] = [];
  const findings: string[] = [];

  // 1. Matriz de Descaracterização de DEMO (Alocação Oculta de Mão de Obra)
  const isDemo = Boolean(model.is_demo_regime);
  const demoTrap =
    Boolean(raw.has_hidden_labor_dedication_trap) ||
    (!isDemo &&
      (Boolean(model.requires_fixed_schedule_or_timeclock) ||
        Boolean(model.requires_named_individuals_in_os) ||
        Boolean(model.has_direct_hierarchical_subordination) ||
        Boolean(model.has_fixed_monthly_payment_without_deliverables)));

  if (demoTrap) {
    blocking_tags.push("[ICT_HIDDEN_LABOR_DEDICATION_DEMO_TRAP_BLOCK]");
    findings.push(
      "Desvirtuamento de contrato de TIC por resultado para alocação disfarçada de mão de obra (DEMO): detectado controle de ponto/jornada, pessoalidade nominal na OS, subordinação direta ou pagamento fixo sem entregáveis/ANS."
    );
  }

  const nonDemoLegitimacyVerified =
    !demoTrap &&
    (model.disables_linked_account_and_uses_ict_index !== false);

  // 2. Travas Específicas das Métricas de TIC
  let metricComplianceOk = true;

  if (metricType === "UST" || metricType === "USM" || metricType === "UNS") {
    const rawHourEquivalence =
      Boolean(raw.ust_equals_raw_hour_without_catalog) ||
      Boolean(model.is_ust_equal_to_raw_hour) ||
      model.has_complexity_weighted_activity_catalog === false;

    if (rawHourEquivalence) {
      metricComplianceOk = false;
      blocking_tags.push("[ICT_UST_RAW_HOUR_EQUIVALENCE_SUMULA269_BLOCK]");
      findings.push(
        "Violação da Súmula TCU nº 269: métrica UST/USM/UNS empregada como mera equivalência 1:1 com Hora-Homem pura sem catálogo de atividades ponderado por complexidade e resultado."
      );
    }
  } else if (metricType === "HST" || metricType === "HORA_TECNICA") {
    const unboundedHst =
      Boolean(raw.unbounded_technical_hour_os) ||
      model.has_prior_closed_os_hour_ceiling === false ||
      model.has_exceptional_hst_justification === false;

    if (unboundedHst) {
      metricComplianceOk = false;
      blocking_tags.push("[ICT_UNBOUNDED_TECHNICAL_HOUR_PARADOX_BLOCK]");
      findings.push(
        "Paradoxo do lucro-incompetência em HST/Hora-Técnica: ausência de justificativa excepcional e de Ordem de Serviço com teto prévio fechado de horas máximas antes da execução."
      );
    }
  } else if (metricType === "PF" || metricType === "SQUAD") {
    if (model.links_payment_to_sprint_throughput_and_ans === false) {
      metricComplianceOk = false;
      blocking_tags.push("[ICT_AGILE_OR_PF_WITHOUT_ANS_DELIVERABLE_LINK_BLOCK]");
      findings.push(
        `Modelagem ${metricType} sem vinculação objetiva do pagamento a entregáveis medidos (Throughput/Velocity/Pontos de Função) e metas de ANS (Acórdãos TCU 1.508/2020 e 2.503/2024-Plenário).`
      );
    }
  }

  // 3. Exequibilidade Paramétrica de Perfis de TI & Súmula TCU 262
  const computedFloor = computeProfileUnitFloor(exeq.profiles_breakdown || []);
  const explicitFloor = Number(
    exeq.parametric_profile_floor_value ?? raw.parametric_profile_floor_value ?? 0
  );
  const parametricFloorValue =
    explicitFloor > 0 ? round2(explicitFloor) : computedFloor;

  const offeredValueRaw =
    exeq.offered_unit_value ?? raw.offered_unit_value;
  const offeredUnitValue =
    offeredValueRaw !== undefined ? round2(Number(offeredValueRaw)) : undefined;

  const belowFloor =
    Boolean(raw.below_profile_floor) ||
    (parametricFloorValue > 0 &&
      offeredUnitValue !== undefined &&
      offeredUnitValue < parametricFloorValue);

  const diligenceProven = Boolean(exeq.diligence_viability_proven);
  const isExequible = !(belowFloor && !diligenceProven);

  if (!isExequible) {
    blocking_tags.push("[ICT_PROPOSAL_BELOW_PROFILE_FLOOR_INEXEQUIBLE]");
    findings.push(
      `Proposta abaixo do piso paramétrico operacional dos perfis de TI (ofertado: ${offeredUnitValue ?? "N/A"} < piso: ${parametricFloorValue || "N/A"}), indicando risco de inexequibilidade.`
    );
  }

  const diligenceOpened =
    raw.sumula_262_diligence_opened !== undefined
      ? Boolean(raw.sumula_262_diligence_opened)
      : exeq.prior_diligence_opportunity_granted;

  const summaryDisqAttempt =
    Boolean(exeq.summary_disqualification_attempted) ||
    Boolean(raw.summary_disqualification_attempted);

  const diligenceRequired =
    belowFloor && (summaryDisqAttempt || diligenceOpened === false);

  if (diligenceRequired) {
    blocking_tags.push("[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]");
    findings.push(
      "Trava vinculante da Súmula TCU nº 262: vedada a desclassificação sumária por inexequibilidade sem prévia abertura de diligência formal para o licitante comprovar a viabilidade de sua planilha de custos."
    );
  }

  return {
    metric_type: metricType,
    non_demo_legitimacy_verified: nonDemoLegitimacyVerified,
    demo_trap_detected: demoTrap,
    metric_compliance_ok: metricComplianceOk,
    parametric_floor_value: parametricFloorValue,
    ...(offeredUnitValue !== undefined ? { offered_unit_value: offeredUnitValue } : {}),
    is_exequible: isExequible,
    diligence_required: diligenceRequired,
    blocking_tags,
    findings,
  };
}
