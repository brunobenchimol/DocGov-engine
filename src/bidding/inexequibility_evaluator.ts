import type {
  InexequibilityEvaluation,
  RawBiddingProposalInput,
} from "./types.ts";

export function evaluateProposalInexequibility(
  raw: RawBiddingProposalInput
): InexequibilityEvaluation {
  const exeq = raw.proposal_exequibility || {};
  const isWorks =
    Boolean(raw.is_engineering_or_works) ||
    /OBRA|ENGENHARIA/i.test(String(raw.object_category || ""));

  const estimated = Number(
    raw.estimated_budget_value ?? raw.estimated_total_value ?? 0
  );
  const offered = Number(
    raw.offered_proposal_value ?? raw.offered_total_value ?? 0
  );

  const summaryAttempted = Boolean(
    exeq.summary_disqualification_attempted ?? raw.summary_disqualification_attempted
  );
  const priorDiligenceGranted = Boolean(
    exeq.prior_diligence_opportunity_granted ?? raw.sumula_262_diligence_opened
  );
  const diligenceProven = Boolean(exeq.diligence_viability_proven);
  const guaranteeOffered = Boolean(raw.additional_guarantee_offered);

  const blocking_tags: string[] = [];
  const findings: string[] = [];

  if (estimated <= 0 || offered <= 0) {
    return {
      is_engineering_or_works: isWorks,
      presumed_inexequible_75: false,
      requires_additional_guarantee_85: false,
      blocking_tags,
      findings,
    };
  }

  const ratioPct = Math.round(((offered / estimated) * 100) * 100) / 100;
  const threshold75 = estimated * 0.75;
  const threshold85 = estimated * 0.85;

  const presumed75 = isWorks && offered < threshold75;
  const requires85Guarantee = isWorks && offered < threshold85;
  const additionalGuaranteeAmount = requires85Guarantee
    ? Math.round((threshold85 - offered) * 100) / 100
    : undefined;

  if (summaryAttempted && !priorDiligenceGranted) {
    blocking_tags.push("[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]");
    findings.push(
      `Desclassificação sumária por inexequibilidade vedada sem prévia diligência contraditória ao licitante (Súmula TCU nº 262 e Art. 59, § 2º da Lei 14.133/2021). Proposta em ${ratioPct}% do orçamento estimado.`
    );
  }

  if (presumed75 && !diligenceProven) {
    blocking_tags.push("[INEXEQUIBILITY_75_PCT_PRESUMPTION_DILIGENCE_REQUIRED]");
    findings.push(
      `Obras/Engenharia abaixo de 75% do valor orçado (${ratioPct}% — R$ ${offered.toFixed(
        2
      )} < R$ ${threshold75.toFixed(
        2
      )}): presunção relativa de inexequibilidade (Art. 59, § 4º da Lei 14.133/2021), exigindo abertura de diligência saneadora (Súmula TCU 262).`
    );
  }

  if (requires85Guarantee && !guaranteeOffered) {
    blocking_tags.push("[INEXEQUIBILITY_ADDITIONAL_GUARANTEE_85_PCT_REQUIRED]");
    findings.push(
      `Exigência legal de garantia adicional (Art. 59, § 5º da Lei 14.133/2021): proposta inferior a 85% do valor orçado (${ratioPct}%), devendo prestar garantia adicional equivalente à diferença (R$ ${(
        additionalGuaranteeAmount ?? 0
      ).toFixed(2)}).`
    );
  }

  return {
    is_engineering_or_works: isWorks,
    estimated_budget_value: estimated,
    offered_proposal_value: offered,
    ratio_pct: ratioPct,
    presumed_inexequible_75: presumed75,
    requires_additional_guarantee_85: requires85Guarantee,
    ...(additionalGuaranteeAmount !== undefined
      ? { additional_guarantee_amount: additionalGuaranteeAmount }
      : {}),
    blocking_tags,
    findings,
  };
}
