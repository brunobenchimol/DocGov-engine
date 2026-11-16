import type {
  AppealsEvaluation,
  AppealContextInput,
  RawBiddingProposalInput,
} from "./types.ts";

export function evaluateAdministrativeAppeal(
  ctxInput?: AppealContextInput,
  raw?: RawBiddingProposalInput
): AppealsEvaluation {
  const ctx: AppealContextInput | undefined =
    ctxInput ||
    (raw &&
    (raw.intent_summary_rejection_attempted !== undefined ||
      raw.summary_merit_rejection_of_intent !== undefined ||
      raw.deadline_less_than_3_business_days !== undefined ||
      raw.edital_appeal_deadline_days !== undefined ||
      raw.pre_existing_document_submitted_on_appeal !== undefined ||
      raw.acordao_1211_2021_applicable !== undefined ||
      raw.new_document_for_preexisting_fact !== undefined ||
      raw.maintained_decision_without_hierarchical_remission !== undefined ||
      raw.hierarchical_decision_days_elapsed !== undefined ||
      raw.requires_hierarchical_remission !== undefined)
      ? raw
      : undefined);

  if (!ctx) {
    return {
      evaluated: false,
      appeal_type: "NONE",
      timely_3_business_days: true,
      immediate_intent_valid: true,
      thematic_link_ok: true,
      suspensive_effect_applicable: false,
      authority_forwarding_deadline_days: 10,
      blocking_tags: [],
      findings: [],
    };
  }

  const appealType = String(ctx.appeal_type || "RAZOES").toUpperCase();
  const blocking_tags: string[] = [];
  const findings: string[] = [];

  const immediateIntentValid = ctx.intent_manifested_timely !== false;
  if (!immediateIntentValid) {
    blocking_tags.push("[APPEAL_IMMEDIATE_INTENT_PRECLUSION_BLOCK]");
    findings.push(
      "Preclusão recursal (Art. 165, § 1º, I da Lei 14.133/2021): intenção de recorrer não manifestada imediatamente na sessão pública após o ato decisório."
    );
  }

  const summaryRejectionAttempted = Boolean(
    ctx.intent_summary_rejection_attempted ??
      ctx.summary_merit_rejection_of_intent ??
      raw?.intent_summary_rejection_attempted ??
      raw?.summary_merit_rejection_of_intent
  );
  if (summaryRejectionAttempted) {
    blocking_tags.push("[APPEAL_INTENTION_SUMMARY_REJECTION_ILLEGAL_BLOCK]");
    findings.push(
      "Ilegalidade de juízo sumário de mérito sobre a intenção de recorrer (Art. 165, § 1º, I da Lei 14.133/2021): na sessão, cabe apenas exame de sucumbência, tempestividade e motivação mínima, vedada antecipação do mérito recursal."
    );
  }

  const elapsedDays = Number(
    appealType === "CONTRARRAZOES"
      ? ctx.counter_reasons_business_days_elapsed ?? ctx.reasons_business_days_elapsed ?? 0
      : ctx.reasons_business_days_elapsed ?? 0
  );
  const timely = elapsedDays <= 3;
  const editalDeadlineRaw =
    ctx.edital_appeal_deadline_days ?? raw?.edital_appeal_deadline_days;
  const deadlineBelow3Days =
    Boolean(
      ctx.deadline_less_than_3_business_days ?? raw?.deadline_less_than_3_business_days
    ) || (editalDeadlineRaw !== undefined && Number(editalDeadlineRaw) < 3);

  if (!timely) {
    blocking_tags.push("[APPEAL_UNTIMELY_3_BUSINESS_DAYS_BLOCK]");
    findings.push(
      `Intempestividade recursal (Art. 165, I / § 4º da Lei 14.133/2021): protocolo após ${elapsedDays} dia(s) útil(eis), excedendo o prazo legal peremptório de 3 (três) dias úteis.`
    );
  }
  if (!timely || deadlineBelow3Days) {
    blocking_tags.push("[APPEAL_DEADLINE_3_BUSINESS_DAYS_VIOLATION]");
    if (deadlineBelow3Days && timely) {
      findings.push(
        "Violação do prazo mínimo legal de 3 (três) dias úteis para razões/contrarrazões recursais (Art. 165, I e § 4º da Lei 14.133/2021)."
      );
    }
  }

  let thematicLinkOk = !ctx.innovation_outside_intent;
  if (
    thematicLinkOk &&
    ctx.declared_intent_scope &&
    ctx.appeal_reasons_scope &&
    ctx.declared_intent_scope.trim().length > 4 &&
    ctx.appeal_reasons_scope.trim().length > 4
  ) {
    const intentTokens = ctx.declared_intent_scope
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length >= 4);
    const reasonText = ctx.appeal_reasons_scope.toLowerCase();
    if (
      intentTokens.length > 0 &&
      !intentTokens.some((tok) => reasonText.includes(tok))
    ) {
      thematicLinkOk = false;
    }
  }

  if (!thematicLinkOk) {
    blocking_tags.push("[APPEAL_THEMATIC_INNOVATION_OUTSIDE_INTENT_BLOCK]");
    findings.push(
      "Quebra da vinculação temática: razões recursais inovam matéria estranha aos motivos motivadamente registrados na intenção imediata de recurso."
    );
  }

  const newDocException = Boolean(
    ctx.pre_existing_document_submitted_on_appeal ??
      ctx.acordao_1211_2021_applicable ??
      ctx.new_document_for_preexisting_fact ??
      raw?.pre_existing_document_submitted_on_appeal ??
      raw?.acordao_1211_2021_applicable ??
      raw?.new_document_for_preexisting_fact
  );
  if (newDocException) {
    blocking_tags.push("[NEW_DOCUMENT_PRECLUSION_EXCEPTION_ACORDAO_1211_2021]");
    findings.push(
      "Exceção à preclusão documental (Acórdão TCU nº 1.211/2021-Plenário e Art. 64 da Lei 14.133/2021): documento novo juntado em sede recursal que atesta condição preexistente à sessão pública deve ser conhecido em diligência."
    );
  }

  const reconsiderRaw = ctx.reconsider_decision;
  const hierarchicalDaysRaw =
    ctx.hierarchical_decision_days_elapsed ?? raw?.hierarchical_decision_days_elapsed;
  const hierarchicalRemissionRequired = Boolean(
    reconsiderRaw === false ||
      String(reconsiderRaw || "").toUpperCase() === "MANTER_E_ENCAMINHAR" ||
      (ctx.maintained_decision_without_hierarchical_remission ??
        raw?.maintained_decision_without_hierarchical_remission) ||
      (ctx.requires_hierarchical_remission ?? raw?.requires_hierarchical_remission) ||
      (hierarchicalDaysRaw !== undefined && Number(hierarchicalDaysRaw) > 10)
  );
  if (hierarchicalRemissionRequired) {
    blocking_tags.push("[HIERARCHICAL_REMISSION_10_DAYS_MANDATORY]");
    findings.push(
      "Remessa hierárquica obrigatória (Art. 165, § 2º da Lei 14.133/2021): não reconsiderando a decisão em 3 dias úteis, o Pregoeiro/Agente deve encaminhar o recurso à Autoridade Superior para decisão em até 10 (dez) dias úteis."
    );
  }

  return {
    evaluated: true,
    appeal_type: appealType,
    timely_3_business_days: timely && !deadlineBelow3Days,
    immediate_intent_valid: immediateIntentValid && !summaryRejectionAttempted,
    thematic_link_ok: thematicLinkOk,
    ...(newDocException ? { new_document_exception_applicable: true } : {}),
    ...(hierarchicalRemissionRequired ? { hierarchical_remission_required: true } : {}),
    suspensive_effect_applicable: true,
    authority_forwarding_deadline_days: 10,
    blocking_tags,
    findings,
  };
}
