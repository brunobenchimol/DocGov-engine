import type { AppealsEvaluation, AppealContextInput } from "./types.ts";

export function evaluateAdministrativeAppeal(
  ctx?: AppealContextInput
): AppealsEvaluation {
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

  const elapsedDays = Number(
    appealType === "CONTRARRAZOES"
      ? ctx.counter_reasons_business_days_elapsed ?? ctx.reasons_business_days_elapsed ?? 0
      : ctx.reasons_business_days_elapsed ?? 0
  );
  const timely = elapsedDays <= 3;
  if (!timely) {
    blocking_tags.push("[APPEAL_UNTIMELY_3_BUSINESS_DAYS_BLOCK]");
    findings.push(
      `Intempestividade recursal (Art. 165, I / § 4º da Lei 14.133/2021): protocolo após ${elapsedDays} dia(s) útil(eis), excedendo o prazo legal peremptório de 3 (três) dias úteis.`
    );
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

  return {
    evaluated: true,
    appeal_type: appealType,
    timely_3_business_days: timely,
    immediate_intent_valid: immediateIntentValid,
    thematic_link_ok: thematicLinkOk,
    suspensive_effect_applicable: true,
    authority_forwarding_deadline_days: 10,
    blocking_tags,
    findings,
  };
}
