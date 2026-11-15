// ============================================================================
// Auditoria Determinística de PAS, Glosa ANS/IMR vs. Multa e Garantias (Gen5.6)
// docgov-engine v1.5.6 — src/contracts/pas_sanction_auditor.ts
// Arts. 102 e 155 a 163 da Lei 14.133/2021; Art. 38 e 83 da Lei 13.303/2016
// ============================================================================

import {
  evaluatePasFederativeAndDosimetry,
  resolveCompetentAuditCourt,
} from "./pas_federative_dosimetry.ts";
import type {
  RawContractInput,
  RawPasSanctionInput,
  RawSlaGlosaInput,
  PasSanctionAnalysisItem,
} from "./types.ts";

export interface PasSanctionAuditResult {
  blocking_tags: string[];
  processes_analyzed: number;
  violations_count: number;
  competent_audit_court: string;
  processes: PasSanctionAnalysisItem[];
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function resolveDosimetry(
  item: RawPasSanctionInput,
  penaltyType: string,
  finePct: number | undefined,
  isPureRemuneratoryGlosa: boolean,
  isLei13303: boolean
): { recommended_sanction: string; recommended_scope: string; duration_note?: string } {
  if (isPureRemuneratoryGlosa) {
    return {
      recommended_sanction: "NONE_REMUNERATORY_GLOSA_ONLY",
      recommended_scope: "CONTRACT_BILLING",
    };
  }

  if (isLei13303 && (penaltyType.includes("SUSPENS") || penaltyType.includes("IMPEDIMENTO"))) {
    return {
      recommended_sanction: "SUSPENSAO_TEMPORARIA_13303",
      recommended_scope: "OWN_ENTITY",
      duration_note: "Até 2 anos (24 meses) restrita à própria Estatal (Art. 83, III Lei 13.303/2016)",
    };
  }

  const article = (item.infraction_article || item.infractionArticle || "").toUpperCase();
  const severity = (item.infraction_severity || item.infractionSeverity || "").toUpperCase();

  const isGraveArticle =
    /ART[_\s]*155[_\s]*(VIII|IX|X|XI|XII)\b/.test(article) ||
    severity === "VERY_HIGH";

  if (isGraveArticle || penaltyType.includes("INIDONEIDADE")) {
    return {
      recommended_sanction: "DECLARACAO_INIDONEIDADE",
      recommended_scope: "ALL_SPHERES",
      duration_note: "3 a 6 anos em todas as esferas federativas (Art. 156, § 5º)",
    };
  }

  const isImpedimentArticle =
    /ART[_\s]*155[_\s]*(II|III|IV|V|VI|VII)\b/.test(article) ||
    severity === "HIGH";

  if (isImpedimentArticle || penaltyType.includes("IMPEDIMENTO")) {
    return {
      recommended_sanction: "IMPEDIMENTO_LICITAR_CONTRATAR",
      recommended_scope: "FEDERATIVE_ENTITY",
      duration_note: "Até 3 anos restrito ao ente sancionador (Súmula 51 TCE-SP)",
    };
  }

  if (penaltyType.includes("MULTA") || penaltyType.includes("FINE") || finePct !== undefined || severity === "MEDIUM") {
    return {
      recommended_sanction: "MULTA",
      recommended_scope: "CONTRACTUAL",
    };
  }

  return {
    recommended_sanction: "ADVERTENCIA",
    recommended_scope: "CONTRACTUAL",
  };
}

const ROOT_PAS_TRIGGER_KEYS = [
  "dosimetry_evaluation", "dosimetryEvaluation", "dosimetry_benchmark", "dosimetryBenchmark",
  "sanction_type", "sanctionType", "registries_commanded", "registriesCommanded",
  "proposed_fine_pct", "proposedFinePct", "fine_pct", "finePct", "fine_percentage",
  "multa_percentual", "proposed_fine_percentage", "multa_sancionatoria_proposta",
  "signing_authority_role", "authority_role", "signing_authority", "signed_by",
  "sla_glosa_misclassified", "is_sla_glosa", "glosa_ans_como_multa", "ans_imr",
  "treated_as_penalty", "classified_as_penalty", "defense_business_days",
  "defense_deadline_days", "defense_period_days", "prazo_defesa_dias_uteis",
  "prazo_defesa_dias", "garantia", "surety_bond", "seguro_garantia",
  "seguradora_notificada", "precedent_fines_pct", "precedent_median_pct",
  "precedent_range_pct", "precedent_max_pct", "register_pncp", "register_ceis_cnep",
  "notify_audit_court",
];

export function auditPasSanctionsAndGuarantees(
  input: RawContractInput
): PasSanctionAuditResult {
  const blockingTagsSet = new Set<string>();
  const processes: PasSanctionAnalysisItem[] = [];
  const inAny = input as Record<string, any>;

  const legalRegime = (input.legal_regime || input.legalRegime || "LEI_14133").toUpperCase();
  const isLei13303 = legalRegime.includes("13303");
  const legalFloorPct = isLei13303 ? 0.0 : 0.5;
  const legalCeilingPct = 30.0;

  const rawPasList: RawPasSanctionInput[] = [
    ...toArray(input.pas_sanction),
    ...toArray(input.pasSanction),
    ...toArray(input.pas_sanctions),
    ...toArray(input.pasSanctions),
    ...toArray(inAny.pas_processes),
    ...toArray(inAny.pasProcesses),
    ...toArray(inAny.sanctions),
    ...toArray(inAny.sancoes),
    ...toArray(input.pas),
    ...toArray(input.pas_evaluation),
    ...toArray(input.pasEvaluation),
  ];

  if (rawPasList.length === 0 && ROOT_PAS_TRIGGER_KEYS.some((k) => inAny[k] !== undefined)) {
    rawPasList.push(input as RawPasSanctionInput);
  }

  const rootSlaList: RawSlaGlosaInput[] = [
    ...toArray(input.sla_glosa),
    ...toArray(input.slaGlosa),
  ];

  if (rootSlaList.length > 0) {
    rootSlaList.forEach((sla, idx) => {
      rawPasList.push({
        process_id: `SLA-IMR-${idx + 1}`,
        sla_glosa: sla,
      });
    });
  }

  const rootContractValue = Number(
    input.updated_initial_value ??
    input.updatedInitialValue ??
    input.initial_value ??
    input.initialValue ??
    input.current_value ??
    input.currentValue ??
    (inAny.initial_value_cents !== undefined ? Number(inAny.initial_value_cents) / 100 : undefined) ??
    (inAny.initialValueCents !== undefined ? Number(inAny.initialValueCents) / 100 : 0)
  );

  let violationsCount = 0;

  for (let i = 0; i < rawPasList.length; i++) {
    const item = rawPasList[i];
    const itemAny = item as Record<string, any>;
    const processId = item.process_id || item.processId || item.id || `PAS-${i + 1}`;
    const sla = item.sla_glosa || item.slaGlosa;
    const ansImr = itemAny.ans_imr || itemAny.ansImr || inAny.ans_imr || inAny.ansImr;
    const reasons: string[] = [];
    let itemHasViolation = false;

    // 1. Segregação ANS/IMR vs. Multa Punitiva
    const slaClassified = (sla?.classified_as || sla?.classifiedAs || "").toUpperCase();
    const slaAny = (sla || {}) as Record<string, any>;
    const isSlaGlosaFlag = Boolean(itemAny.is_sla_glosa === true || slaAny.is_sla_glosa === true || inAny.is_sla_glosa === true);
    const classifiedPenaltyFlag = Boolean(
      itemAny.classified_as_penalty === true || itemAny.treated_as_penalty === true ||
      slaAny.classified_as_penalty === true || slaAny.treated_as_penalty === true ||
      ansImr?.classificado_como_multa === true || ansImr?.classified_as_penalty === true || ansImr?.treated_as_penalty === true ||
      inAny.classified_as_penalty === true || inAny.treated_as_penalty === true
    );
    const slaMisclassified = Boolean(
      item.ans_glosa_applied_as_punitive_sanction === true || item.ansGlosaAppliedAsPunitiveSanction === true ||
      item.is_punitive_disguised_as_glosa === true || item.isPunitiveDisguisedAsGlosa === true ||
      item.is_imr_classified_as_sanction === true || item.isImrClassifiedAsSanction === true ||
      item.within_imr_bands === false || item.withinImrBands === false ||
      itemAny.sla_glosa_misclassified === true || itemAny.glosa_ans_como_multa === true ||
      inAny.sla_glosa_misclassified === true || inAny.glosa_ans_como_multa === true ||
      (isSlaGlosaFlag && classifiedPenaltyFlag) || classifiedPenaltyFlag ||
      sla?.ans_glosa_applied_as_punitive_sanction === true || sla?.ansGlosaAppliedAsPunitiveSanction === true ||
      sla?.is_punitive_disguised_as_glosa === true || sla?.isPunitiveDisguisedAsGlosa === true ||
      sla?.is_imr_classified_as_sanction === true || sla?.isImrClassifiedAsSanction === true ||
      sla?.within_imr_bands === false || sla?.withinImrBands === false ||
      slaAny.sla_glosa_misclassified === true || slaAny.glosa_ans_como_multa === true ||
      slaClassified === "PUNITIVE_SANCTION" || slaClassified === "DIRECT_PUNITIVE_DISCOUNT"
    );

    if (slaMisclassified) {
      blockingTagsSet.add("[SLA_GLOSA_MISCLASSIFIED_AS_PENALTY_BLOCK]");
      itemHasViolation = true;
      reasons.push(
        "Desvio de finalidade entre glosa remuneratória de ANS/IMR e sanção administrativa punitiva"
      );
    }

    let remuneratoryGlosaValue: number | undefined;
    if (sla) {
      const explicitGlosa = sla.glosa_value ?? sla.glosaValue;
      const grossInv = sla.invoice_gross_value ?? sla.invoiceGrossValue;
      const discPct = sla.discount_pct ?? sla.discountPct;
      if (explicitGlosa !== undefined) {
        remuneratoryGlosaValue = Number(Number(explicitGlosa).toFixed(2));
      } else if (grossInv !== undefined && discPct !== undefined) {
        remuneratoryGlosaValue = Number(((Number(grossInv) * Number(discPct)) / 100).toFixed(2));
      }
    }

    // 2. Validação de Piso (0,5%) e Teto (30%) de Multa
    const itemRegime = (item.legal_regime || item.legalRegime || legalRegime).toUpperCase();
    const itemIsLei13303 = itemRegime.includes("13303") || itemRegime.includes("ESTATAL");
    const penaltyType = (
      item.sanction_type ||
      item.sanctionType ||
      item.penalty_type ||
      item.penaltyType ||
      item.proposed_sanction ||
      item.proposedSanction ||
      ""
    ).toUpperCase();

    const benchObj =
      item.dosimetry_evaluation ||
      item.dosimetryEvaluation ||
      item.dosimetry_benchmark ||
      item.dosimetryBenchmark ||
      input.dosimetry_evaluation ||
      input.dosimetryEvaluation ||
      input.dosimetry_benchmark ||
      input.dosimetryBenchmark;

    const rawFinePct =
      item.proposed_fine_pct ??
      item.proposedFinePct ??
      itemAny.proposed_fine_percentage ??
      itemAny.proposedFinePercentage ??
      item.fine_pct ??
      item.finePct ??
      itemAny.fine_percentage ??
      itemAny.finePercentage ??
      item.multa_pct ??
      item.multaPct ??
      itemAny.multa_percentual ??
      itemAny.multaPercentual ??
      itemAny.multa_sancionatoria_proposta?.percentual ??
      itemAny.multa_sancionatoria_proposta?.fine_pct ??
      benchObj?.proposed_fine_pct ??
      benchObj?.proposedFinePct ??
      (benchObj as any)?.proposed_fine_percentage ??
      (benchObj as any)?.proposedFinePercentage ??
      benchObj?.fine_pct ??
      benchObj?.finePct ??
      (benchObj as any)?.fine_percentage ??
      (benchObj as any)?.finePercentage ??
      benchObj?.multa_pct ??
      benchObj?.multaPct ??
      (benchObj as any)?.multa_percentual ??
      (benchObj as any)?.multaPercentual ??
      inAny.fine_percentage ??
      inAny.multa_percentual ??
      inAny.proposed_fine_percentage ??
      inAny.multa_sancionatoria_proposta?.percentual ??
      inAny.multa_sancionatoria_proposta?.fine_pct;

    const itemContractVal = Number(item.contract_value ?? item.contractValue ?? rootContractValue);
    const fineVal = item.fine_value ?? item.fineValue;

    let effectiveFinePct: number | undefined;
    if (rawFinePct !== undefined) {
      effectiveFinePct = Number(rawFinePct);
    } else if (fineVal !== undefined && itemContractVal > 0) {
      effectiveFinePct = Number(((Number(fineVal) / itemContractVal) * 100).toFixed(4));
    }

    let fineWithinLegalBounds = true;
    if (effectiveFinePct !== undefined && !isNaN(effectiveFinePct)) {
      const explicitNonFineZero =
        effectiveFinePct === 0 &&
        penaltyType !== "" &&
        !penaltyType.includes("MULTA") &&
        !penaltyType.includes("FINE");

      if (!explicitNonFineZero) {
        const belowFloor = !itemIsLei13303 && effectiveFinePct < 0.5;
        const aboveCeiling = effectiveFinePct > 30.0;
        if (belowFloor || aboveCeiling) {
          fineWithinLegalBounds = false;
          blockingTagsSet.add("[MULTA_BELOW_LEGAL_FLOOR_0_5PCT_OR_ABOVE_30PCT_BLOCK]");
          itemHasViolation = true;
          reasons.push(
            `Multa proposta de ${effectiveFinePct}% viola a faixa legal (${legalFloorPct}% a ${legalCeilingPct}%)`
          );
        }
      }
    }

    // 3. Rito do Contraditório e Ampla Defesa (15 dias úteis — Arts. 157 e 158)
    const openedFormalPas = item.opened_formal_pas ?? item.openedFormalPas ?? sla?.opened_formal_pas ?? sla?.openedFormalPas;
    const priorNotifSent = item.prior_notification_sent ?? item.priorNotificationSent;
    const defDaysRaw =
      item.defense_deadline_business_days ??
      item.defenseDeadlineBusinessDays ??
      itemAny.defense_business_days ??
      itemAny.defenseBusinessDays ??
      itemAny.defense_deadline_days ??
      itemAny.defenseDeadlineDays ??
      itemAny.defense_period_days ??
      itemAny.defensePeriodDays ??
      item.contradictory_days ??
      item.contradictoryDays ??
      itemAny.prazo_defesa_dias_uteis ??
      itemAny.prazo_defesa_dias ??
      inAny.defense_deadline_business_days ??
      inAny.defense_business_days ??
      inAny.defense_deadline_days ??
      inAny.defense_period_days ??
      inAny.contradictory_days ??
      inAny.prazo_defesa_dias_uteis ??
      inAny.prazo_defesa_dias;
    const defDays = defDaysRaw !== undefined ? Number(defDaysRaw) : undefined;
    const defDaysType = String(
      itemAny.defense_days_type ?? itemAny.defenseDaysType ?? itemAny.tipo_prazo_defesa ??
      inAny.defense_days_type ?? inAny.tipo_prazo_defesa ?? ""
    ).toUpperCase();
    const isCalendarDaysViolation =
      (defDaysType === "CALENDAR" || defDaysType === "CORRIDOS" || defDaysType === "DIAS_CORRIDOS") &&
      defDays !== undefined &&
      defDays <= 15;

    const isPureRemuneratoryGlosa = Boolean(
      sla &&
      (sla.within_imr_bands === true || sla.withinImrBands === true) &&
      !slaMisclassified &&
      !penaltyType &&
      effectiveFinePct === undefined &&
      defDays === undefined &&
      priorNotifSent === undefined
    );

    let contradictory15DaysOk = true;
    if (!isPureRemuneratoryGlosa) {
      if (
        openedFormalPas === false ||
        priorNotifSent === false ||
        (defDays !== undefined && defDays < 15) ||
        isCalendarDaysViolation
      ) {
        contradictory15DaysOk = false;
        blockingTagsSet.add("[PAS_CONTRADICTORY_15_DAYS_VIOLATION_BLOCK]");
        itemHasViolation = true;
        reasons.push(
          "Violação do contraditório prévio ou concessão de prazo inferior a 15 dias úteis (Arts. 157 e 158 da Lei 14.133/2021)"
        );
      }
    }

    // 4. Seguro-Garantia e Notificação à Seguradora (Art. 102)
    const garantiaObj =
      itemAny.garantia || itemAny.surety_bond || itemAny.suretyBond ||
      inAny.garantia || inAny.surety_bond || inAny.suretyBond;
    const hasGarantiaFlag = Boolean(
      garantiaObj && (garantiaObj.seguradora_notificada !== undefined || garantiaObj.insurer_notified !== undefined)
    );
    const modality = String(
      item.guarantee_modality || item.guaranteeModality || garantiaObj?.modality || garantiaObj?.modalidade || ""
    ).toUpperCase();
    const hasSuretyBond = Boolean(
      item.has_surety_bond ??
      item.hasSuretyBond ??
      itemAny.seguro_garantia ??
      itemAny.seguroGarantia ??
      inAny.has_surety_bond ??
      inAny.seguro_garantia ??
      (hasGarantiaFlag ? true : undefined) ??
      (modality === "SURETY_BOND" || modality === "SEGURO_GARANTIA")
    );
    const claimDetected = item.claim_or_default_detected ?? item.claimOrDefaultDetected ?? true;
    const insurerNotified =
      item.surety_insurer_notified ??
      item.suretyInsurerNotified ??
      item.insurer_notified ??
      item.insurerNotified ??
      itemAny.seguradora_notificada ??
      itemAny.seguradoraNotificada ??
      garantiaObj?.seguradora_notificada ??
      garantiaObj?.insurer_notified ??
      inAny.surety_insurer_notified ??
      inAny.insurer_notified ??
      inAny.seguradora_notificada;
    const policyExpired = Boolean(item.policy_expired ?? item.policyExpired);

    let insurerNotificationOk = true;
    if ((hasSuretyBond && claimDetected !== false && insurerNotified === false) || policyExpired) {
      insurerNotificationOk = false;
      blockingTagsSet.add("[SURETY_INSURER_NOTIFICATION_REQUIRED_BLOCK]");
      itemHasViolation = true;
      reasons.push(
        policyExpired
          ? "Apólice de Seguro-Garantia vencida sem endosso de renovação vigente"
          : "Contrato com Seguro-Garantia exige notificação formal à seguradora (Art. 102 da Lei 14.133/2021)"
      );
    }

    // 5. Dosimetria Determinística + Adequação Federativa & LINDB Art. 22 (Gen5.6)
    const dosimetry = resolveDosimetry(
      item,
      penaltyType,
      effectiveFinePct,
      isPureRemuneratoryGlosa,
      itemIsLei13303
    );

    const fedDosimetry = evaluatePasFederativeAndDosimetry(
      item,
      input,
      effectiveFinePct,
      isPureRemuneratoryGlosa
    );
    for (const tag of fedDosimetry.blocking_tags) {
      blockingTagsSet.add(tag);
      itemHasViolation = true;
    }
    reasons.push(...fedDosimetry.reasons);

    const proposedScope = (item.sanction_scope || item.sanctionScope || "").toUpperCase();
    const debarmentYears = Number(item.debarment_years ?? item.debarmentYears ?? 0);
    if (
      fedDosimetry.blocking_tags.length === 0 &&
      dosimetry.recommended_sanction === "IMPEDIMENTO_LICITAR_CONTRATAR" &&
      (proposedScope === "ALL_SPHERES" || debarmentYears > 3)
    ) {
      reasons.push(
        "Alerta de dosimetria: impedimento de licitar limita-se a até 3 anos no ente federativo sancionador (Súmula 51 TCE-SP)"
      );
    } else if (dosimetry.duration_note) {
      reasons.push(`Enquadramento sugerido: ${dosimetry.recommended_sanction} (${dosimetry.duration_note})`);
    }

    if (itemHasViolation) {
      violationsCount++;
    }

    processes.push({
      process_id: processId,
      proposed_sanction: penaltyType || undefined,
      recommended_sanction: dosimetry.recommended_sanction,
      recommended_scope: dosimetry.recommended_scope,
      fine_pct: effectiveFinePct,
      legal_floor_pct: itemIsLei13303 ? 0.0 : 0.5,
      legal_ceiling_pct: legalCeilingPct,
      fine_within_legal_bounds: fineWithinLegalBounds,
      remuneratory_glosa_value: remuneratoryGlosaValue,
      sla_glosa_misclassified: slaMisclassified,
      defense_deadline_business_days: defDays,
      contradictory_15_days_ok: contradictory15DaysOk,
      guarantee_modality: modality || (hasSuretyBond ? "SURETY_BOND" : undefined),
      insurer_notification_ok: insurerNotificationOk,
      competent_audit_court: fedDosimetry.competent_audit_court,
      federative_adequacy: fedDosimetry.federative_adequacy,
      dosimetry_calibration: fedDosimetry.dosimetry_calibration,
      justification: reasons.length > 0 ? reasons.join("; ") : undefined,
    });
  }

  const rootCourt =
    processes[0]?.competent_audit_court ||
    resolveCompetentAuditCourt(
      input.sphere ?? input.esfera,
      input.uf,
      input.municipality ?? input.municipio
    );

  return {
    blocking_tags: Array.from(blockingTagsSet),
    processes_analyzed: processes.length,
    violations_count: violationsCount,
    competent_audit_court: rootCourt,
    processes,
  };
}
