// ============================================================================
// Tipos & Contratos Canônicos: Regime DEMO (Geração 6.5 — Eixo 1)
// docgov-engine v1.6.5 — src/demo_costs/types.ts
// IN SEGES 05/2017 | Decreto Federal nº 12.174/2024 | Lei nº 14.133/2021
// ============================================================================

export const DEMO_BLOCKING_TAGS = [
  "[DEMO_MOD1_CCT_FLOOR_BELOW_NORMATIVE]",
  "[DEMO_MOD1_SUMULA448_TST_INSALUBRITY_VIOLATION]",
  "[DEMO_MOD2_SUB21_CPP_FGTS_13TH_VACATION_ERROR]",
  "[DEMO_MOD2_SUB22_SAT_RAT_FAP_MISMATCH]",
  "[DEMO_MOD2_SUB23_VT_6PCT_DEDUCTION_OR_VA_ERROR]",
  "[DEMO_MOD3_RESCISAO_APT_FIRST_YEAR_OR_FGTS_PENALTY_ERROR]",
  "[DEMO_MOD4_AUSENTES_REPLACEMENT_CALC_ERROR]",
  "[DEMO_MOD5_INSUMOS_EPI_DEPRECIATION_INCONSISTENT]",
  "[DEMO_MOD6_GROSS_UP_FORMULA_MATH_ERROR]",
  "[DEMO_MOD6_LUCRO_REAL_EFFECTIVE_RATE_ACORDAO_1214_VIOLATION]",
  "[DEMO_MOD6_SIMPLES_NACIONAL_ART17_XII_FORBIDDEN]",
  "[DEMO_ANEXO_VIB_M2_PRODUCTIVITY_OUT_OF_BOUNDS]",
  "[DEMO_DEC12174_WORKING_HOURS_REDUCTION_44_TO_40_SALARY_CUT_VIOLATION]",
  "[DEMO_DEC12174_DOMESTIC_VIOLENCE_QUOTA_OR_LABOR_CLAUSE_MISSING]",
  "[DEMO_EXEC_APT_FIRST_RENEWAL_PURGE_ACORDAO_1586_MISSING]",
  "[DEMO_EXEC_LINKED_ACCOUNT_FATO_GERADOR_OR_REPACTUATION_BREACH]",
] as const;

export type DemoBlockingTag = (typeof DEMO_BLOCKING_TAGS)[number];

export type DemoServiceCategory =
  | "LIMPEZA"
  | "VIGILANCIA"
  | "APOIO_ADMINISTRATIVO"
  | "OUTROS_DEMO";

export type DemoTaxRegime =
  | "LUCRO_REAL"
  | "LUCRO_PRESUMIDO"
  | "SIMPLES_NACIONAL";

export type DemoInsalubrityDegree = "NONE" | "MIN_10" | "MED_20" | "MAX_40";

export type DemoProductivityAreaType =
  | "INTERNA"
  | "EXTERNA"
  | "ESQUADRIAS"
  | "FACHADA_VIDRO"
  | "HOSPITALAR";

export interface DemoModule1Input {
  base_salary_cents: number;
  cct_floor_cents: number;
  insalubrity_degree?: DemoInsalubrityDegree;
  is_high_traffic_public_restroom?: boolean;
  has_technical_ltcat_report?: boolean;
  danger_pay_30pct?: boolean;
  night_shift_additional_cents?: number;
}

export interface DemoModule2Input {
  sub21_13th_vacation_bps: number;
  sub22_inss_sistema_s_fgts_base_bps: number;
  rat_pct: number;
  fap_factor: number;
  declared_rat_x_fap_bps: number;
  vt_daily_tariff_cents: number;
  working_days: number;
  vt_employer_net_cents: number;
  va_monthly_cents: number;
  cct_min_va_cents: number;
}

export interface DemoModule3Input {
  api_bps: number;
  fgts_penalty_bps: number;
  apt_first_year_bps: number;
  sub22_incidence_on_m3_bps: number;
}

export interface DemoModule4Input {
  sub41_ausentes_bps: number;
  sub22_incidence_on_m4_bps: number;
  declared_module4_cents: number;
}

export interface DemoModule5Input {
  uniforms_epi_materials_depreciation_cents: number;
  is_manifestly_inconsistent_or_missing?: boolean;
}

export interface DemoModule6Input {
  indirect_costs_bps: number;
  profit_bps: number;
  pis_declared_bps: number;
  cofins_declared_bps: number;
  iss_declared_bps: number;
  efd_effective_pis_bps?: number;
  efd_effective_cofins_bps?: number;
  declared_gross_up_total_cents: number;
}

export interface DemoProductivityM2Input {
  area_type: DemoProductivityAreaType;
  proposed_m2_per_worker: number;
  has_technical_justification?: boolean;
}

export interface DemoDecree12174Input {
  weekly_hours_reduced_44_to_40?: boolean;
  nominal_salary_reduced?: boolean;
  has_domestic_violence_victim_quota_and_protective_clauses?: boolean;
}

export interface DemoRepactuationInput {
  months_since_last_cct_date_base: number;
  module5_reajusted_by_cct_salary_index?: boolean;
  indirect_or_profit_rate_increased?: boolean;
}

export interface DemoExecutionGovernanceInput {
  is_first_renewal_or_after_12m?: boolean;
  renewal_apt_bps?: number;
  mitigation_mechanism: "CONTA_VINCULADA" | "FATO_GERADOR";
  linked_account_retained_bps?: number;
  fato_gerador_unproven_events_paid_cents?: number;
  repactuation?: DemoRepactuationInput;
}

export interface DemoRegimeAuditInput {
  workspace_dir: string;
  case_id: string;
  contract_regime?: "LEI_14133" | "LEI_13303";
  service_category: DemoServiceCategory;
  tax_regime: DemoTaxRegime;
  simples_anexo_iv_compliant?: boolean;
  module1_remuneration: DemoModule1Input;
  module2_charges_benefits: DemoModule2Input;
  module3_termination: DemoModule3Input;
  module4_replacement: DemoModule4Input;
  module5_inputs: DemoModule5Input;
  module6_indirect_profit_taxes: DemoModule6Input;
  productivity_m2?: DemoProductivityM2Input;
  decree_12174_compliance?: DemoDecree12174Input;
  execution_governance?: DemoExecutionGovernanceInput;
  output_format?: "docx" | "pdf" | "both";
}

export interface DemoCalculatedTotalsCents {
  module1_cents: number;
  module2_cents: number;
  module3_cents: number;
  module4_cents: number;
  module5_cents: number;
  module6_cents: number;
  total_monthly_per_post_cents: number;
  apt_renewal_purge_monthly_savings_cents: number;
  linked_account_monthly_provision_cents: number;
}

export interface DemoSheetBreakdown {
  base_salary_cents: number;
  insalubrity_cents: number;
  danger_pay_cents: number;
  night_shift_additional_cents: number;
  sub21_cents: number;
  sub22_cents: number;
  total_sub22_bps: number;
  expected_rat_x_fap_bps: number;
  sub23_cents: number;
  vt_gross_cents: number;
  vt_deduction_6pct_cents: number;
  expected_vt_net_cents: number;
  expected_m4_cents: number;
  soma_m1_m5_cents: number;
  indirect_costs_cents: number;
  profit_cents: number;
  tax_total_bps: number;
  taxes_cents: number;
  expected_total_post_cents: number;
  expected_m6_cents: number;
  anexo_vib_range?: [number, number];
}

export interface DemoExecutionSummary {
  mitigation_mechanism: "CONTA_VINCULADA" | "FATO_GERADOR" | "NOT_SPECIFIED";
  is_first_renewal_or_after_12m: boolean;
  apt_first_year_bps: number;
  renewal_apt_bps?: number;
  apt_renewal_purge_annual_savings_cents: number;
  linked_account_computed_bps: number;
  linked_account_retained_bps?: number;
  repactuation_checked: boolean;
}

export interface DemoRegimeAuditOutput {
  engine_version: string;
  case_id: string;
  contract_regime: "LEI_14133" | "LEI_13303";
  service_category: DemoServiceCategory;
  tax_regime: DemoTaxRegime;
  status: "CONFORME" | "NAO_CONFORME";
  blocking_tags: string[];
  findings: string[];
  calculated_totals_cents: DemoCalculatedTotalsCents;
  sheet_breakdown: DemoSheetBreakdown;
  execution_summary: DemoExecutionSummary;
  artifacts: {
    json_path: string;
    md_path: string;
    docx_path: string;
    pdf_path: string;
  };
}

export interface DemoRegimeSyntheticResult {
  status: "CONFORME" | "NAO_CONFORME";
  engine_version: string;
  case_id: string;
  blocking_tags: string[];
  total_monthly_per_post_cents?: number;
  json_path: string;
  md_path?: string;
  docx_path?: string;
  pdf_path?: string;
  next_step_hint?: string;
}

export interface AuditDemoRegimeOptions {
  workspaceDir?: string;
  outputFormat?: "docx" | "pdf" | "both";
}
