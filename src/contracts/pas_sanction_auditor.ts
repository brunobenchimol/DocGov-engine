// ============================================================================
// Auditoria Determinística de PAS, Glosa ANS/IMR vs. Multa e Garantias (Gen5.5)
// docgov-engine v1.5.5 — src/contracts/pas_sanction_auditor.ts
// Arts. 102 e 155 a 163 da Lei 14.133/2021; Art. 83 da Lei 13.303/2016
// ============================================================================

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
  isPureRemuneratoryGlosa: boolean
): { recommended_sanction: string; recommended_scope: string; duration_note?: string } {
  if (isPureRemuneratoryGlosa) {
    return {
      recommended_sanction: "NONE_REMUNERATORY_GLOSA_ONLY",
      recommended_scope: "CONTRACT_BILLING",
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

export function auditPasSanctionsAndGuarantees(
  input: RawContractInput
): PasSanctionAuditResult {
  const blockingTagsSet = new Set<string>();
  const processes: PasSanctionAnalysisItem[] = [];

  const legalRegime = (input.legal_regime || input.legalRegime || "LEI_14133").toUpperCase();
  const isLei13303 = legalRegime.includes("13303");
  const legalFloorPct = isLei13303 ? 0.0 : 0.5;
  const legalCeilingPct = 30.0;

  const rawPasList: RawPasSanctionInput[] = [
    ...toArray(input.pas_sanction),
    ...toArray(input.pasSanction),
    ...toArray(input.pas_sanctions),
    ...toArray(input.pasSanctions),
    ...toArray(input.pas),
  ];

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
    0
  );

  let violationsCount = 0;

  for (let i = 0; i < rawPasList.length; i++) {
    const item = rawPasList[i];
    const processId = item.process_id || item.processId || item.id || `PAS-${i + 1}`;
    const sla = item.sla_glosa || item.slaGlosa;
    const reasons: string[] = [];
    let itemHasViolation = false;

    // 1. Segregação ANS/IMR vs. Multa Punitiva
    const slaClassified = (sla?.classified_as || sla?.classifiedAs || "").toUpperCase();
    const slaMisclassified = Boolean(
      item.ans_glosa_applied_as_punitive_sanction === true ||
      item.ansGlosaAppliedAsPunitiveSanction === true ||
      item.is_punitive_disguised_as_glosa === true ||
      item.isPunitiveDisguisedAsGlosa === true ||
      item.is_imr_classified_as_sanction === true ||
      item.isImrClassifiedAsSanction === true ||
      item.within_imr_bands === false ||
      item.withinImrBands === false ||
      sla?.ans_glosa_applied_as_punitive_sanction === true ||
      sla?.ansGlosaAppliedAsPunitiveSanction === true ||
      sla?.is_punitive_disguised_as_glosa === true ||
      sla?.isPunitiveDisguisedAsGlosa === true ||
      sla?.is_imr_classified_as_sanction === true ||
      sla?.isImrClassifiedAsSanction === true ||
      sla?.within_imr_bands === false ||
      sla?.withinImrBands === false ||
      slaClassified === "PUNITIVE_SANCTION" ||
      slaClassified === "DIRECT_PUNITIVE_DISCOUNT"
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
    const penaltyType = (
      item.penalty_type ||
      item.penaltyType ||
      item.proposed_sanction ||
      item.proposedSanction ||
      ""
    ).toUpperCase();

    const rawFinePct =
      item.proposed_fine_pct ??
      item.proposedFinePct ??
      item.fine_pct ??
      item.finePct;

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
        const belowFloor = !isLei13303 && effectiveFinePct < 0.5;
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
      item.contradictory_days ??
      item.contradictoryDays;
    const defDays = defDaysRaw !== undefined ? Number(defDaysRaw) : undefined;

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
        (defDays !== undefined && defDays < 15)
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
    const modality = (item.guarantee_modality || item.guaranteeModality || "").toUpperCase();
    const hasSuretyBond = Boolean(
      item.has_surety_bond ??
      item.hasSuretyBond ??
      (modality === "SURETY_BOND" || modality === "SEGURO_GARANTIA")
    );
    const claimDetected = item.claim_or_default_detected ?? item.claimOrDefaultDetected ?? true;
    const insurerNotified =
      item.surety_insurer_notified ??
      item.suretyInsurerNotified ??
      item.insurer_notified ??
      item.insurerNotified;
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

    // 5. Dosimetria Determinística
    const dosimetry = resolveDosimetry(
      item,
      penaltyType,
      effectiveFinePct,
      isPureRemuneratoryGlosa
    );

    const proposedScope = (item.sanction_scope || item.sanctionScope || "").toUpperCase();
    const debarmentYears = Number(item.debarment_years ?? item.debarmentYears ?? 0);
    if (
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
      legal_floor_pct: legalFloorPct,
      legal_ceiling_pct: legalCeilingPct,
      fine_within_legal_bounds: fineWithinLegalBounds,
      remuneratory_glosa_value: remuneratoryGlosaValue,
      sla_glosa_misclassified: slaMisclassified,
      defense_deadline_business_days: defDays,
      contradictory_15_days_ok: contradictory15DaysOk,
      guarantee_modality: modality || (hasSuretyBond ? "SURETY_BOND" : undefined),
      insurer_notification_ok: insurerNotificationOk,
      justification: reasons.length > 0 ? reasons.join("; ") : undefined,
    });
  }

  return {
    blocking_tags: Array.from(blockingTagsSet),
    processes_analyzed: processes.length,
    violations_count: violationsCount,
    processes,
  };
}
