// ============================================================================
// Avaliador de Curva ABC SINAPI/SICRO, Desoneração CPRB (Lei 14.973/2024),
// Cronograma Físico-Financeiro (Front-Loading) & Matriz de Riscos (Integrada)
// docgov-engine v1.6.6 — src/engineering/sinapi_sicro_schedule_evaluator.ts
// ============================================================================

import { toBps } from "./bdi_acordao_2622_evaluator.ts";
import type {
  EngineeringBdiInput,
  EngineeringCurvaAbcAnalyzedItem,
  EngineeringCurvaAbcItemInput,
  EngineeringExecutionRegime,
  EngineeringScheduleAndRiskInput,
  EngineeringSinapiScheduleSummary,
  EngineeringTaxDesoneracaoInput,
} from "./types.ts";

// Transição gradual de reoneração da folha — Lei Federal nº 14.973/2024
// 2024: 4,50% CPRB (0% INSS folha) | 2025: 3,60% CPRB (+5% INSS) |
// 2026: 2,70% CPRB (+10% INSS) | 2027: 1,80% CPRB (+15% INSS) | 2028+: 0% CPRB (20% INSS)
export function getExpectedLei14973TransitionBps(year: number): {
  cprb_bps: number;
  inss_payroll_bps: number;
} {
  if (year <= 2024) return { cprb_bps: 450, inss_payroll_bps: 0 };
  if (year === 2025) return { cprb_bps: 360, inss_payroll_bps: 500 };
  if (year === 2026) return { cprb_bps: 270, inss_payroll_bps: 1000 };
  if (year === 2027) return { cprb_bps: 180, inss_payroll_bps: 1500 };
  return { cprb_bps: 0, inss_payroll_bps: 2000 };
}

function fmtBpsPct(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(".", ",")}%`;
}

function analyzeCurvaAbc(items: EngineeringCurvaAbcItemInput[]): {
  analyzed: EngineeringCurvaAbcAnalyzedItem[];
  totalOfferedCents: number;
  totalReferenceCents: number;
  netOverpricingCents: number;
  overpricedCount: number;
} {
  const precomputed = items.map((it) => {
    const qty = Math.max(Number(it.quantity) || 0, 0);
    const refUnit = Math.round(Number(it.sinapi_sicro_median_unit_cents) || 0);
    const offUnit = Math.round(Number(it.offered_unit_cents) || 0);
    const offTotal = Math.round(qty * offUnit);
    const refTotal = Math.round(qty * refUnit);
    return {
      raw: it,
      qty,
      refUnit,
      offUnit,
      offTotal,
      refTotal,
    };
  });

  precomputed.sort((a, b) => b.offTotal - a.offTotal);
  const totalOfferedCents = precomputed.reduce((acc, p) => acc + p.offTotal, 0);
  const totalReferenceCents = precomputed.reduce((acc, p) => acc + p.refTotal, 0);

  let runningOffered = 0;
  let overpricedCount = 0;
  const analyzed: EngineeringCurvaAbcAnalyzedItem[] = precomputed.map((p) => {
    const prevCumBps =
      totalOfferedCents > 0
        ? Math.round((runningOffered / totalOfferedCents) * 10000)
        : 0;
    runningOffered += p.offTotal;
    const cumShareBps =
      totalOfferedCents > 0
        ? Math.round((runningOffered / totalOfferedCents) * 10000)
        : 0;

    let abcBand: "A" | "B" | "C" = "C";
    if (prevCumBps < 8000) {
      abcBand = "A";
    } else if (prevCumBps < 9500) {
      abcBand = "B";
    }

    const overpriced =
      p.refUnit > 0 &&
      p.offUnit > p.refUnit &&
      !p.raw.specificity_justification_approved;
    if (overpriced) overpricedCount++;

    return {
      item_id: p.raw.item_id,
      description: p.raw.description,
      reference_source: p.raw.reference_source || "SINAPI",
      abc_band: abcBand,
      quantity: p.qty,
      sinapi_sicro_median_unit_cents: p.refUnit,
      offered_unit_cents: p.offUnit,
      offered_total_cents: p.offTotal,
      reference_total_cents: p.refTotal,
      overpricing_cents: p.offTotal - p.refTotal,
      cumulative_share_bps: cumShareBps,
      overpriced_without_justification: overpriced,
    };
  });

  return {
    analyzed,
    totalOfferedCents,
    totalReferenceCents,
    netOverpricingCents: totalOfferedCents - totalReferenceCents,
    overpricedCount,
  };
}

function evaluateCprbSymmetry(
  tax: EngineeringTaxDesoneracaoInput | undefined,
  bdi: EngineeringBdiInput
): {
  tag?: string;
  finding?: string;
  regime: string;
  referenceYear: number;
} {
  const bdiCprbBps = toBps(bdi.cprb_bps, bdi.cprb_pct);
  const referenceYear = tax?.reference_year ?? 2026;
  const regime = tax?.sinapi_sicro_table_regime ?? "NAO_DESONERADO";

  if (!tax) {
    return { regime, referenceYear };
  }

  const appliedCprbBps = toBps(
    tax.applied_cprb_bps,
    tax.applied_cprb_pct,
    bdiCprbBps
  );
  const bdiIncludesCprb = Boolean(tax.bdi_includes_cprb) || bdiCprbBps > 0;
  const expectedTransition = getExpectedLei14973TransitionBps(referenceYear);

  // 1. Dupla incidência: tabela NÃO DESONERADA (encargos 20% INSS) + CPRB no BDI
  if (regime === "NAO_DESONERADO" && (bdiIncludesCprb || appliedCprbBps > 0)) {
    return {
      regime,
      referenceYear,
      tag: "[ENG_CPRB_DESONERACAO_TAX_ASYMMETRY_LEI14973_BLOCK]",
      finding: `Assimetria tributária grave (Lei nº 14.973/2024): planilha adota encargos SINAPI/SICRO NÃO DESONERADOS com incidência simultânea de CPRB (${fmtBpsPct(
        Math.max(appliedCprbBps, bdiCprbBps)
      )}) no BDI, gerando bitributação e sobrepreço.`,
    };
  }

  // 2. Divergência entre CPRB declarada no BDI e na tabela tributária
  if (Math.abs(bdiCprbBps - appliedCprbBps) > 5) {
    return {
      regime,
      referenceYear,
      tag: "[ENG_CPRB_DESONERACAO_TAX_ASYMMETRY_LEI14973_BLOCK]",
      finding: `Inconsistência de CPRB entre o BDI (${fmtBpsPct(
        bdiCprbBps
      )}) e a composição tributária declarada (${fmtBpsPct(
        appliedCprbBps
      )}) sob a Lei nº 14.973/2024.`,
    };
  }

  // 3. Regime DESONERADO: checar ausência de CPRB ou descasamento com a transição da Lei 14.973/2024
  if (regime === "DESONERADO") {
    if (referenceYear >= 2028 && (bdiIncludesCprb || appliedCprbBps > 0)) {
      return {
        regime,
        referenceYear,
        tag: "[ENG_CPRB_DESONERACAO_TAX_ASYMMETRY_LEI14973_BLOCK]",
        finding: `CPRB extinta a partir de 2028 (Lei nº 14.973/2024), mas cotada em ${fmtBpsPct(
          appliedCprbBps
        )} no exercício de ${referenceYear}.`,
      };
    }
    if (referenceYear <= 2027 && (!bdiIncludesCprb || appliedCprbBps <= 0)) {
      return {
        regime,
        referenceYear,
        tag: "[ENG_CPRB_DESONERACAO_TAX_ASYMMETRY_LEI14973_BLOCK]",
        finding: `Assimetria tributária (Lei nº 14.973/2024): encargos SINAPI/SICRO DESONERADOS em ${referenceYear} sem inclusão da CPRB transicional correspondente (${fmtBpsPct(
          expectedTransition.cprb_bps
        )}) no BDI.`,
      };
    }
    if (Math.abs(appliedCprbBps - expectedTransition.cprb_bps) > 15) {
      return {
        regime,
        referenceYear,
        tag: "[ENG_CPRB_DESONERACAO_TAX_ASYMMETRY_LEI14973_BLOCK]",
        finding: `Alíquota de CPRB (${fmtBpsPct(
          appliedCprbBps
        )}) incompatível com a transição gradual da Lei nº 14.973/2024 para ${referenceYear} (esperado: ${fmtBpsPct(
          expectedTransition.cprb_bps
        )}).`,
      };
    }
    if (
      tax.payroll_inss_bps !== undefined ||
      tax.payroll_inss_pct !== undefined
    ) {
      const payrollInssBps = toBps(tax.payroll_inss_bps, tax.payroll_inss_pct);
      if (Math.abs(payrollInssBps - expectedTransition.inss_payroll_bps) > 100) {
        return {
          regime,
          referenceYear,
          tag: "[ENG_CPRB_DESONERACAO_TAX_ASYMMETRY_LEI14973_BLOCK]",
          finding: `INSS sobre folha na planilha (${fmtBpsPct(
            payrollInssBps
          )}) diverge do escalonamento legal da Lei nº 14.973/2024 para ${referenceYear} (esperado: ${fmtBpsPct(
            expectedTransition.inss_payroll_bps
          )}).`,
        };
      }
    }
  }

  return { regime, referenceYear };
}

export function evaluateSinapiSicroAndSchedule(params: {
  executionRegime: EngineeringExecutionRegime;
  bdi: EngineeringBdiInput;
  tax?: EngineeringTaxDesoneracaoInput;
  curvaAbcItems?: EngineeringCurvaAbcItemInput[];
  scheduleAndRisk?: EngineeringScheduleAndRiskInput;
}): EngineeringSinapiScheduleSummary {
  const blocking_tags: string[] = [];
  const findings: string[] = [];

  // 1. Curva ABC contra medianas SINAPI/SICRO (Decreto nº 7.983/2013)
  const abcResult = analyzeCurvaAbc(params.curvaAbcItems || []);
  if (abcResult.overpricedCount > 0) {
    blocking_tags.push(
      "[ENG_CURVA_ABC_SINAPI_SICRO_MEDIAN_OVERPRICING_BLOCK]"
    );
    const topOver = abcResult.analyzed
      .filter((i) => i.overpriced_without_justification)
      .slice(0, 3)
      .map((i) => `${i.item_id} (Faixa ${i.abc_band}, ${i.reference_source})`)
      .join(", ");
    findings.push(
      `Curva ABC SINAPI/SICRO (Decreto nº 7.983/2013): ${abcResult.overpricedCount} item(ns) acima da mediana referencial sem nota técnica de especificidade aprovada (${topOver}).`
    );
  }

  // 2. Simetria tributária CPRB (Lei nº 14.973/2024)
  const cprbRes = evaluateCprbSymmetry(params.tax, params.bdi);
  if (cprbRes.tag && cprbRes.finding) {
    blocking_tags.push(cprbRes.tag);
    findings.push(cprbRes.finding);
  }

  // 3. Cronograma físico-financeiro (Detecção de Front-Loading > 5% = 500 bps)
  let maxGapBps = 0;
  const stages = params.scheduleAndRisk?.schedule_stages || [];
  for (const st of stages) {
    const physBps = toBps(
      st.reference_physical_cumulative_bps,
      st.reference_physical_cumulative_pct
    );
    const finBps = toBps(
      st.financial_disbursement_cumulative_bps,
      st.financial_disbursement_cumulative_pct
    );
    const gap = finBps - physBps;
    if (gap > maxGapBps) maxGapBps = gap;
  }
  if (
    Boolean(params.scheduleAndRisk?.front_loading_detected) ||
    maxGapBps > 500
  ) {
    blocking_tags.push(
      "[ENG_SCHEDULE_FRONT_LOADING_CASHFLOW_MANIPULATION_BLOCK]"
    );
    findings.push(
      maxGapBps > 500
        ? `Front-loading detectado no cronograma físico-financeiro: desembolso financeiro acumulado supera o avanço físico referencial em ${fmtBpsPct(
            maxGapBps
          )} (> 5,00%), caracterizando antecipação artificial de receita.`
        : "Front-loading sinalizado nas etapas iniciais do cronograma físico-financeiro com concentração desproporcional de desembolso."
    );
  }

  // 4. Contratação Integrada / Semi-Integrada (Art. 46 Lei 14.133 / Arts. 42-43 Lei 13.303)
  const isIntegrated =
    params.executionRegime === "CONTRATACAO_INTEGRADA" ||
    params.executionRegime === "CONTRATACAO_SEMI_INTEGRADA";

  if (isIntegrated && params.scheduleAndRisk?.has_risk_allocation_matrix !== true) {
    blocking_tags.push("[ENG_INTEGRATED_CONTRACTING_RISK_MATRIX_MISSING_BLOCK]");
    findings.push(
      `Regime de ${params.executionRegime} exige Matriz de Alocação de Riscos obrigatória (Art. 22, § 3º e Art. 46 da Lei nº 14.133/2021; Art. 42, § 1º da Lei nº 13.303/2016).`
    );
  }

  if (
    params.scheduleAndRisk
      ?.attempts_design_error_addendum_without_legal_exception
  ) {
    blocking_tags.push(
      "[ENG_INTEGRATED_CONTRACTING_ILLEGAL_DESIGN_ADDENDUM_BLOCK]"
    );
    findings.push(
      "Vedação de termo aditivo por falha ou omissão de projeto básico/executivo em Contratação Integrada ou Semi-Integrada fora das hipóteses legais excepcionais (Art. 46, § 8º da Lei nº 14.133/2021; Art. 43, § 1º da Lei nº 13.303/2016)."
    );
  }

  return {
    abc_total_offered_cents: abcResult.totalOfferedCents,
    abc_total_reference_cents: abcResult.totalReferenceCents,
    abc_net_overpricing_cents: abcResult.netOverpricingCents,
    abc_overpriced_items_count: abcResult.overpricedCount,
    abc_items: abcResult.analyzed,
    cprb_regime: cprbRes.regime,
    cprb_reference_year: cprbRes.referenceYear,
    max_front_loading_gap_bps: maxGapBps,
    integrated_or_semi_integrated: isIntegrated,
    blocking_tags,
    findings,
  };
}
