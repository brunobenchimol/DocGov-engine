// ============================================================================
// Calculadora Determinística de Planilha DEMO — Módulos 1 a 6 (Anexo VII-D)
// docgov-engine v1.6.5 — src/demo_costs/sheet_calculator.ts
// Aritmética exclusiva em centavos inteiros e basis points (10000 bps = 100%)
// ============================================================================

import type {
  DemoProductivityAreaType,
  DemoRegimeAuditInput,
  DemoSheetBreakdown,
} from "./types.ts";

export const ANEXO_VIB_PRODUCTIVITY_BOUNDS: Record<
  DemoProductivityAreaType,
  [number, number]
> = {
  INTERNA: [800, 1200],
  EXTERNA: [1800, 2700],
  ESQUADRIAS: [300, 380],
  FACHADA_VIDRO: [130, 160],
  HOSPITALAR: [330, 450],
};

export interface SheetCalculationResult {
  module1_cents: number;
  module2_cents: number;
  module3_cents: number;
  module4_cents: number;
  module5_cents: number;
  module6_cents: number;
  total_monthly_per_post_cents: number;
  total_sub22_bps: number;
  blocking_tags: string[];
  findings: string[];
  breakdown: DemoSheetBreakdown;
}

function formatCentsPtBr(cents: number): string {
  const val = (cents / 100).toFixed(2);
  const [intPart, decPart] = val.split(".");
  return `R$ ${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decPart}`;
}

export function calculateDemoCostSheet(
  input: DemoRegimeAuditInput
): SheetCalculationResult {
  const blocking_tags: string[] = [];
  const findings: string[] = [];

  // --------------------------------------------------------------------------
  // MÓDULO 1 — Composição da Remuneração (Anexo VII-D + Súmula 448 TST)
  // --------------------------------------------------------------------------
  const m1 = input.module1_remuneration;
  const base_salary_cents = Math.round(Number(m1.base_salary_cents || 0));
  const cct_floor_cents = Math.round(Number(m1.cct_floor_cents || 0));
  const insalubrity_degree = m1.insalubrity_degree || "NONE";
  const insalubrity_bps =
    insalubrity_degree === "MAX_40"
      ? 4000
      : insalubrity_degree === "MED_20"
        ? 2000
        : insalubrity_degree === "MIN_10"
          ? 1000
          : 0;
  const insalubrity_cents = Math.round((base_salary_cents * insalubrity_bps) / 10000);
  const danger_pay_cents = m1.danger_pay_30pct
    ? Math.round(base_salary_cents * 0.3)
    : 0;
  const night_shift_additional_cents = Math.round(
    Number(m1.night_shift_additional_cents || 0)
  );
  const module1_cents =
    base_salary_cents +
    danger_pay_cents +
    insalubrity_cents +
    night_shift_additional_cents;

  if (base_salary_cents <= 0 || base_salary_cents < cct_floor_cents) {
    blocking_tags.push("[DEMO_MOD1_CCT_FLOOR_BELOW_NORMATIVE]");
    findings.push(
      `Módulo 1: Salário-base (${formatCentsPtBr(base_salary_cents)}) inferior ao piso normativo da CCT vigente (${formatCentsPtBr(cct_floor_cents)}).`
    );
  }

  const sumula448Violation =
    (m1.is_high_traffic_public_restroom === true &&
      (insalubrity_degree !== "MAX_40" || m1.has_technical_ltcat_report === false)) ||
    (insalubrity_degree !== "NONE" && m1.has_technical_ltcat_report === false) ||
    (m1.danger_pay_30pct === true && insalubrity_degree !== "NONE");

  if (sumula448Violation) {
    blocking_tags.push("[DEMO_MOD1_SUMULA448_TST_INSALUBRITY_VIOLATION]");
    findings.push(
      `Módulo 1: Violação à Súmula nº 448, II do TST / Art. 193 § 2º CLT (grau=${insalubrity_degree}, banheiro_grande_circulacao=${Boolean(m1.is_high_traffic_public_restroom)}, laudo_LTCAT=${m1.has_technical_ltcat_report !== false}).`
    );
  }

  // --------------------------------------------------------------------------
  // MÓDULO 2 — Encargos e Benefícios (Submódulos 2.1, 2.2 e 2.3)
  // --------------------------------------------------------------------------
  const m2 = input.module2_charges_benefits;
  const sub21_bps = Math.round(Number(m2.sub21_13th_vacation_bps || 0));
  const sub21_cents = Math.round((module1_cents * sub21_bps) / 10000);

  const sub22_base_bps = Math.round(
    Number(m2.sub22_inss_sistema_s_fgts_base_bps || 0)
  );
  const declared_rat_x_fap_bps = Math.round(
    Number(m2.declared_rat_x_fap_bps || 0)
  );
  const total_sub22_bps = sub22_base_bps + declared_rat_x_fap_bps;
  const sub22_cents = Math.round(
    ((module1_cents + sub21_cents) * total_sub22_bps) / 10000
  );

  if (sub21_bps < 2000 || sub21_bps > 2100 || sub22_base_bps < 2800 || sub22_base_bps > 4000) {
    blocking_tags.push("[DEMO_MOD2_SUB21_CPP_FGTS_13TH_VACATION_ERROR]");
    findings.push(
      `Módulo 2: Submódulo 2.1 (${(sub21_bps / 100).toFixed(2)}%, ref. 20,43%) ou base CPP 20% + FGTS 8% (${(sub22_base_bps / 100).toFixed(2)}%, mín. 28,00%) inconsistente.`
    );
  }

  const rat_pct = Number(m2.rat_pct || 0);
  const fap_factor = Number(m2.fap_factor || 0);
  const expected_rat_x_fap_bps = Math.round(rat_pct * fap_factor * 100);
  if (
    rat_pct < 1 ||
    rat_pct > 3 ||
    fap_factor < 0.5 ||
    fap_factor > 2.0 ||
    Math.abs(declared_rat_x_fap_bps - expected_rat_x_fap_bps) > 1
  ) {
    blocking_tags.push("[DEMO_MOD2_SUB22_SAT_RAT_FAP_MISMATCH]");
    findings.push(
      `Módulo 2.2: Divergência de SAT/RAT × FAP (declarado ${(declared_rat_x_fap_bps / 100).toFixed(2)}% vs. esperado ${(expected_rat_x_fap_bps / 100).toFixed(2)}% para RAT=${rat_pct}% e FAP=${fap_factor}).`
    );
  }

  const vt_daily_tariff_cents = Math.round(Number(m2.vt_daily_tariff_cents || 0));
  const working_days = Math.round(Number(m2.working_days || 0));
  const vt_gross_cents = vt_daily_tariff_cents * working_days;
  const vt_deduction_6pct_cents = Math.round((base_salary_cents * 600) / 10000);
  const expected_vt_net_cents = Math.max(0, vt_gross_cents - vt_deduction_6pct_cents);
  const vt_employer_net_cents = Math.round(Number(m2.vt_employer_net_cents || 0));
  const va_monthly_cents = Math.round(Number(m2.va_monthly_cents || 0));
  const cct_min_va_cents = Math.round(Number(m2.cct_min_va_cents || 0));

  if (
    working_days <= 0 ||
    Math.abs(vt_employer_net_cents - expected_vt_net_cents) > 2 ||
    va_monthly_cents < cct_min_va_cents
  ) {
    blocking_tags.push("[DEMO_MOD2_SUB23_VT_6PCT_DEDUCTION_OR_VA_ERROR]");
    findings.push(
      `Módulo 2.3: Benefícios divergentes — VT empregador (${formatCentsPtBr(vt_employer_net_cents)} vs. líquido esperado ${formatCentsPtBr(expected_vt_net_cents)} após desconto de 6%) ou VA (${formatCentsPtBr(va_monthly_cents)} vs. piso CCT ${formatCentsPtBr(cct_min_va_cents)}).`
    );
  }

  const sub23_cents = vt_employer_net_cents + va_monthly_cents;
  const module2_cents = sub21_cents + sub22_cents + sub23_cents;

  // --------------------------------------------------------------------------
  // MÓDULO 3 — Provisão para Rescisão (API, Multa FGTS e APT 1º ano <= 1,94%)
  // --------------------------------------------------------------------------
  const m3 = input.module3_termination;
  const api_bps = Math.round(Number(m3.api_bps || 0));
  const fgts_penalty_bps = Math.round(Number(m3.fgts_penalty_bps || 0));
  const apt_first_year_bps = Math.round(Number(m3.apt_first_year_bps || 0));
  const sub22_incidence_on_m3_bps = Math.round(
    Number(m3.sub22_incidence_on_m3_bps || 0)
  );
  const m3_total_bps =
    api_bps + fgts_penalty_bps + apt_first_year_bps + sub22_incidence_on_m3_bps;
  const module3_cents = Math.round((module1_cents * m3_total_bps) / 10000);

  if (
    api_bps <= 0 ||
    apt_first_year_bps <= 0 ||
    apt_first_year_bps > 194 ||
    fgts_penalty_bps < 300 ||
    fgts_penalty_bps > 450 ||
    sub22_incidence_on_m3_bps < 0
  ) {
    blocking_tags.push("[DEMO_MOD3_RESCISAO_APT_FIRST_YEAR_OR_FGTS_PENALTY_ERROR]");
    findings.push(
      `Módulo 3: Provisão rescisória irregular — APT 1º ano=${(apt_first_year_bps / 100).toFixed(2)}% (teto 1,94%), multa FGTS=${(fgts_penalty_bps / 100).toFixed(2)}% (faixa 3,00%-4,50%) ou API=${(api_bps / 100).toFixed(2)}%.`
    );
  }

  // --------------------------------------------------------------------------
  // MÓDULO 4 — Reposição do Profissional Ausente
  // --------------------------------------------------------------------------
  const m4 = input.module4_replacement;
  const sub41_ausentes_bps = Math.round(Number(m4.sub41_ausentes_bps || 0));
  const sub22_incidence_on_m4_bps = Math.round(
    Number(m4.sub22_incidence_on_m4_bps || 0)
  );
  const declared_module4_cents = Math.round(Number(m4.declared_module4_cents || 0));
  const expected_m4_cents = Math.round(
    (module1_cents * (sub41_ausentes_bps + sub22_incidence_on_m4_bps)) / 10000
  );
  const module4_cents = declared_module4_cents;

  if (
    sub41_ausentes_bps <= 0 ||
    sub22_incidence_on_m4_bps <= 0 ||
    Math.abs(declared_module4_cents - expected_m4_cents) > 5
  ) {
    blocking_tags.push("[DEMO_MOD4_AUSENTES_REPLACEMENT_CALC_ERROR]");
    findings.push(
      `Módulo 4: Custo de reposição do profissional ausente inconsistente (declarado ${formatCentsPtBr(declared_module4_cents)} vs. esperado ${formatCentsPtBr(expected_m4_cents)}).`
    );
  }

  // --------------------------------------------------------------------------
  // MÓDULO 5 — Insumos Diversos (Uniformes, EPIs, Materiais e Depreciação)
  // --------------------------------------------------------------------------
  const m5 = input.module5_inputs;
  const module5_cents = Math.round(
    Number(m5.uniforms_epi_materials_depreciation_cents || 0)
  );
  if (m5.is_manifestly_inconsistent_or_missing === true || module5_cents <= 0) {
    blocking_tags.push("[DEMO_MOD5_INSUMOS_EPI_DEPRECIATION_INCONSISTENT]");
    findings.push(
      `Módulo 5: Insumos/EPIs/depreciação ausentes ou manifestamente inconsistentes (${formatCentsPtBr(module5_cents)}).`
    );
  }

  // --------------------------------------------------------------------------
  // MÓDULO 6 — Custos Indiretos, Lucro e Tributos "Por Dentro" (Gross-Up)
  // --------------------------------------------------------------------------
  const m6 = input.module6_indirect_profit_taxes;
  const soma_m1_m5_cents =
    module1_cents + module2_cents + module3_cents + module4_cents + module5_cents;
  const indirect_costs_bps = Math.round(Number(m6.indirect_costs_bps || 0));
  const profit_bps = Math.round(Number(m6.profit_bps || 0));
  const pis_declared_bps = Math.round(Number(m6.pis_declared_bps || 0));
  const cofins_declared_bps = Math.round(Number(m6.cofins_declared_bps || 0));
  const iss_declared_bps = Math.round(Number(m6.iss_declared_bps || 0));

  const indirect_costs_cents = Math.round(
    (soma_m1_m5_cents * indirect_costs_bps) / 10000
  );
  const profit_cents = Math.round(
    ((soma_m1_m5_cents + indirect_costs_cents) * profit_bps) / 10000
  );
  const tax_total_bps = pis_declared_bps + cofins_declared_bps + iss_declared_bps;

  let expected_total_post_cents: number;
  let expected_m6_cents: number;
  if (tax_total_bps < 0 || tax_total_bps >= 10000) {
    expected_m6_cents = indirect_costs_cents + profit_cents;
    expected_total_post_cents = soma_m1_m5_cents + expected_m6_cents;
  } else {
    expected_total_post_cents = Math.round(
      (soma_m1_m5_cents + indirect_costs_cents + profit_cents) /
        (1 - tax_total_bps / 10000)
    );
    expected_m6_cents = expected_total_post_cents - soma_m1_m5_cents;
  }

  const taxes_cents = Math.max(
    0,
    expected_m6_cents - indirect_costs_cents - profit_cents
  );
  const declared_gross_up_total_cents = Math.round(
    Number(m6.declared_gross_up_total_cents || 0)
  );
  const grossUpValid =
    tax_total_bps >= 0 &&
    tax_total_bps < 10000 &&
    (Math.abs(declared_gross_up_total_cents - expected_total_post_cents) <= 25 ||
      Math.abs(declared_gross_up_total_cents - expected_m6_cents) <= 25);

  if (!grossUpValid) {
    blocking_tags.push("[DEMO_MOD6_GROSS_UP_FORMULA_MATH_ERROR]");
    findings.push(
      `Módulo 6: Erro na fórmula do Gross-Up de tributos por dentro (declarado ${formatCentsPtBr(declared_gross_up_total_cents)} vs. total posto ${formatCentsPtBr(expected_total_post_cents)} / Módulo 6 ${formatCentsPtBr(expected_m6_cents)}).`
    );
  }

  // Tag 10: Lucro Real — Alíquota Efetiva EFD-Contribuições (Acórdão TCU 1.214/2013)
  const hasEfdPis =
    m6.efd_effective_pis_bps !== undefined && m6.efd_effective_pis_bps !== null;
  const hasEfdCofins =
    m6.efd_effective_cofins_bps !== undefined &&
    m6.efd_effective_cofins_bps !== null;
  const efdPisMismatch =
    hasEfdPis && Math.abs(pis_declared_bps - Number(m6.efd_effective_pis_bps)) > 1;
  const efdCofinsMismatch =
    hasEfdCofins &&
    Math.abs(cofins_declared_bps - Number(m6.efd_effective_cofins_bps)) > 1;
  const lucroRealViolation =
    (input.tax_regime === "LUCRO_REAL" &&
      (!hasEfdPis ||
        !hasEfdCofins ||
        (pis_declared_bps >= 165 && cofins_declared_bps >= 760))) ||
    efdPisMismatch ||
    efdCofinsMismatch;

  if (lucroRealViolation) {
    blocking_tags.push("[DEMO_MOD6_LUCRO_REAL_EFFECTIVE_RATE_ACORDAO_1214_VIOLATION]");
    findings.push(
      `Módulo 6: Violação ao Acórdão TCU nº 1.214/2013 no Lucro Real (PIS=${(pis_declared_bps / 100).toFixed(2)}% / COFINS=${(cofins_declared_bps / 100).toFixed(2)}% sem lastro ou divergente da alíquota efetiva EFD-Contribuições).`
    );
  }

  // Tag 11: Simples Nacional — Art. 17, XII LC 123/2006 (salvo Anexo IV Limpeza/Vigilância)
  const isAllowedAnexoIV =
    input.service_category === "LIMPEZA" || input.service_category === "VIGILANCIA";
  const simplesViolation =
    (input.tax_regime === "SIMPLES_NACIONAL" &&
      (!isAllowedAnexoIV || input.simples_anexo_iv_compliant !== true)) ||
    input.simples_anexo_iv_compliant === false;

  if (simplesViolation) {
    blocking_tags.push("[DEMO_MOD6_SIMPLES_NACIONAL_ART17_XII_FORBIDDEN]");
    findings.push(
      `Módulo 6: Vedação ao Simples Nacional em cessão de mão de obra (Art. 17, XII, LC nº 123/2006) — categoria=${input.service_category}, anexo_iv_compliant=${String(input.simples_anexo_iv_compliant)}.`
    );
  }

  // --------------------------------------------------------------------------
  // PRODUTIVIDADE ANEXO VI-B (m²) & DECRETO FEDERAL Nº 12.174/2024
  // --------------------------------------------------------------------------
  let anexo_vib_range: [number, number] | undefined;
  if (input.productivity_m2) {
    const prod = input.productivity_m2;
    const range = ANEXO_VIB_PRODUCTIVITY_BOUNDS[prod.area_type];
    anexo_vib_range = range;
    if (
      range &&
      (prod.proposed_m2_per_worker < range[0] ||
        prod.proposed_m2_per_worker > range[1]) &&
      prod.has_technical_justification !== true
    ) {
      blocking_tags.push("[DEMO_ANEXO_VIB_M2_PRODUCTIVITY_OUT_OF_BOUNDS]");
      findings.push(
        `Produtividade Anexo VI-B: Área ${prod.area_type} com ${prod.proposed_m2_per_worker} m²/posto fora da faixa referencial [${range[0]}..${range[1]} m²] sem justificativa técnica.`
      );
    }
  }

  if (input.decree_12174_compliance) {
    const dec = input.decree_12174_compliance;
    if (dec.weekly_hours_reduced_44_to_40 === true && dec.nominal_salary_reduced === true) {
      blocking_tags.push(
        "[DEMO_DEC12174_WORKING_HOURS_REDUCTION_44_TO_40_SALARY_CUT_VIOLATION]"
      );
      findings.push(
        "Decreto nº 12.174/2024: Redução da jornada semanal de 44h para 40h acompanhada de redução ilícita da remuneração nominal."
      );
    }
    if (dec.has_domestic_violence_victim_quota_and_protective_clauses === false) {
      blocking_tags.push(
        "[DEMO_DEC12174_DOMESTIC_VIOLENCE_QUOTA_OR_LABOR_CLAUSE_MISSING]"
      );
      findings.push(
        "Decreto nº 12.174/2024: Ausência de cláusula protetiva trabalhista ou reserva de vagas para mulheres vítimas de violência doméstica."
      );
    }
  }

  return {
    module1_cents,
    module2_cents,
    module3_cents,
    module4_cents,
    module5_cents,
    module6_cents: expected_m6_cents,
    total_monthly_per_post_cents: expected_total_post_cents,
    total_sub22_bps,
    blocking_tags,
    findings,
    breakdown: {
      base_salary_cents,
      insalubrity_cents,
      danger_pay_cents,
      night_shift_additional_cents,
      sub21_cents,
      sub22_cents,
      total_sub22_bps,
      expected_rat_x_fap_bps,
      sub23_cents,
      vt_gross_cents,
      vt_deduction_6pct_cents,
      expected_vt_net_cents,
      expected_m4_cents,
      soma_m1_m5_cents,
      indirect_costs_cents,
      profit_cents,
      tax_total_bps,
      taxes_cents,
      expected_total_post_cents,
      expected_m6_cents,
      ...(anexo_vib_range ? { anexo_vib_range } : {}),
    },
  };
}
