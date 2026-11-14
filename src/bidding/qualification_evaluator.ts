// ============================================================================
// Módulo 9.2.A: Habilitação Técnica (Conversibilidade) e Econômico-Financeira
// docgov-engine v1.6.0 — src/bidding/qualification_evaluator.ts
// ============================================================================

import type {
  RawBiddingProposalInput,
  QualificationEvaluation,
} from "./types.ts";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const DEFAULT_CONVERSION_FACTORS: Record<string, Record<string, number>> = {
  UST: { UST: 1, USM: 1, UNS: 1, HORAS_TECNICAS: 1, HST: 1, PF: 12, POSTOS: 168, CHAMADOS: 0.5 },
  HORAS_TECNICAS: { HORAS_TECNICAS: 1, HST: 1, UST: 1, PF: 12, POSTOS: 168, CHAMADOS: 0.5 },
  HST: { HST: 1, HORAS_TECNICAS: 1, UST: 1, PF: 12, POSTOS: 168, CHAMADOS: 0.5 },
  PF: { PF: 1, UST: 1 / 12, HORAS_TECNICAS: 1 / 12, HST: 1 / 12, POSTOS: 14 },
  POSTOS: { POSTOS: 1, HORAS_TECNICAS: 1 / 168, HST: 1 / 168, UST: 1 / 168 },
  CHAMADOS: { CHAMADOS: 1, UST: 2, HORAS_TECNICAS: 2 },
};

export function evaluateQualification(
  raw: RawBiddingProposalInput
): QualificationEvaluation {
  const tech = raw.technical_qualification || {};
  const fin = raw.financial_qualification || {};
  const estimatedTotal = Number(raw.estimated_total_value || 0);

  const blocking_tags: string[] = [];
  const findings: string[] = [];

  const editalMetric = String(
    tech.edital_metric || raw.ict_execution_model?.metric_type || raw.metric_type || "UST"
  ).toUpperCase();

  // 1. Conversibilidade de Métricas em ACT
  const rigidMetric =
    Boolean(raw.rejects_equivalent_metric_conversion) ||
    Boolean(tech.requires_identical_metric_only);

  if (rigidMetric) {
    blocking_tags.push("[ICT_ACT_RIGID_METRIC_RESTRICTION_BLOCK]");
    findings.push(
      "Restrição indevida à competitividade: exigência de atestado exclusivamente na métrica do edital, vedando a conversibilidade paramétrica entre métricas correlatas de TIC (UST <-> Horas <-> PF <-> Postos <-> Chamados)."
    );
  }

  let convertedTotal = 0;
  let conversionApplied = false;
  for (const cert of tech.presented_certificates || []) {
    const qty = Number(cert.quantity || 0);
    const certMetric = String(cert.metric || editalMetric).toUpperCase();
    const factor =
      cert.conversion_factor_to_edital_metric ??
      DEFAULT_CONVERSION_FACTORS[editalMetric]?.[certMetric] ??
      1;
    if (certMetric !== editalMetric) {
      conversionApplied = true;
    }
    convertedTotal += qty * factor;
  }
  convertedTotal = round2(convertedTotal);

  // 2. Súmula TCU 263 e Art. 67 da Lei 14.133/2021
  let techRulesOk = !rigidMetric;
  for (const parcel of tech.required_parcels || []) {
    const totalQty = Number(parcel.total_quantity || 0);
    const reqMinQty = Number(parcel.required_minimum_quantity || 0);
    const itemVal = Number(parcel.estimated_item_value || 0);

    if (totalQty > 0 && reqMinQty > totalQty * 0.5) {
      techRulesOk = false;
      if (!blocking_tags.includes("[TECH_CAPACITY_EXCEEDS_50PCT_BLOCK]")) {
        blocking_tags.push("[TECH_CAPACITY_EXCEEDS_50PCT_BLOCK]");
        findings.push(
          `Exigência de quantitativo mínimo (${reqMinQty}/${totalQty}) superior ao teto legal de 50% (Art. 67, § 2º, Lei 14.133/2021 e Súmula TCU 263) na parcela '${parcel.description || "TIC"}'.`
        );
      }
    }

    if (estimatedTotal > 0 && itemVal > 0 && itemVal / estimatedTotal < 0.04) {
      techRulesOk = false;
      if (!blocking_tags.includes("[IRRELEVANT_PARCEL_BELOW_4PCT_BLOCK]")) {
        blocking_tags.push("[IRRELEVANT_PARCEL_BELOW_4PCT_BLOCK]");
        findings.push(
          `Exigência de qualificação técnico-operacional sobre parcela financeiramente irrelevante (< 4% do valor total estimado) em '${parcel.description || "TIC"}'.`
        );
      }
    }
  }

  const forbidsSummation =
    Boolean(raw.forbids_certificate_summation_without_justification) ||
    (tech.allows_certificate_summation === false &&
      !tech.indivisibility_technically_justified);

  if (forbidsSummation) {
    techRulesOk = false;
    blocking_tags.push("[SUM_OF_CERTIFICATES_MANDATORY_BLOCK]");
    findings.push(
      "Vedação imotivada ao somatório de atestados de capacidade técnica sem demonstração técnica de indivisibilidade do objeto."
    );
  }

  // 3. Qualificação Econômico-Financeira (ILG, ILC, ISG, EG, Teto 10% e CS+PL)
  const ac = fin.ativo_circulante;
  const rlp = Number(fin.realizavel_longo_prazo || 0);
  const at = fin.ativo_total;
  const pc = fin.passivo_circulante;
  const pnc = Number(fin.passivo_nao_circulante || 0);

  const passivoExigivelTotal =
    pc !== undefined ? Number(pc) + pnc : undefined;

  const ilg =
    ac !== undefined && passivoExigivelTotal && passivoExigivelTotal > 0
      ? round2((Number(ac) + rlp) / passivoExigivelTotal)
      : null;
  const ilc =
    ac !== undefined && pc && Number(pc) > 0
      ? round2(Number(ac) / Number(pc))
      : null;
  const isg =
    at !== undefined && passivoExigivelTotal && passivoExigivelTotal > 0
      ? round2(Number(at) / passivoExigivelTotal)
      : null;
  const eg =
    at !== undefined && Number(at) > 0 && passivoExigivelTotal !== undefined
      ? round2(passivoExigivelTotal / Number(at))
      : null;

  let financialRulesOk = true;

  const cumulativeCapAndEquity =
    Boolean(raw.requires_cumulative_capital_and_equity) ||
    Boolean(fin.requires_cumulative_capital_and_equity);

  if (cumulativeCapAndEquity) {
    financialRulesOk = false;
    blocking_tags.push("[CUMULATIVE_CAPITAL_AND_EQUITY_BLOCK]");
    findings.push(
      "Exigência cumulativa ilegal de Capital Social mínimo e Patrimônio Líquido mínimo (Súmula TCU nº 275 / Art. 69, § 4º da Lei 14.133/2021)."
    );
  }

  const reqEquityPct = Number(
    fin.required_min_equity_or_capital_pct ?? raw.required_min_equity_or_capital_pct ?? 0
  );
  if (reqEquityPct > 10.0) {
    financialRulesOk = false;
    blocking_tags.push("[FINANCIAL_EQUITY_EXCEEDS_10PCT_CAP_BLOCK]");
    findings.push(
      `Exigência de Patrimônio Líquido/Capital Social mínimo (${reqEquityPct}%) superior ao teto legal de 10% do valor estimado da contratação.`
    );
  }

  return {
    converted_total_quantity: convertedTotal,
    conversion_applied: conversionApplied,
    tech_rules_ok: techRulesOk,
    financial_indices: { ilg, ilc, isg, eg },
    financial_rules_ok: financialRulesOk,
    blocking_tags,
    findings,
  };
}
