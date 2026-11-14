// ============================================================================
// Tipos e Contratos do Marco 8.6 (Gen5.6): PAS Federativo e Dosimetria LINDB
// docgov-engine v1.5.6 — src/contracts/pas_federative_types.ts
// ============================================================================

export type FederativeSphere = "FEDERAL" | "STATE" | "MUNICIPAL" | string;

export type SigningAuthorityRole =
  | "MINISTRO_DE_ESTADO"
  | "SECRETARIO_ESTADUAL"
  | "SECRETARIO_MUNICIPAL"
  | "AUTORIDADE_MAXIMA_AUTARQUIA_FUNDACAO"
  | "AUTORIDADE_MAXIMA"
  | "FISCAL_CONTRATO"
  | "GESTOR_CONTRATO"
  | "PREGOEIRO"
  | "DIRETOR_DEPARTAMENTO"
  | "ORDENADOR_DESPESA"
  | string;

export interface BenchmarkPrecedentRef {
  id?: string;
  court?: string;
  fine_pct?: number;
  duration_months?: number;
  summary?: string;
}

export interface RawDosimetryBenchmarkInput {
  proposed_fine_pct?: number;
  proposedFinePct?: number;
  fine_pct?: number;
  finePct?: number;
  multa_pct?: number;
  multaPct?: number;
  juris_precedent_id?: string | string[];
  jurisPrecedentId?: string | string[];
  benchmark_precedents?: Array<string | BenchmarkPrecedentRef>;
  benchmarkPrecedents?: Array<string | BenchmarkPrecedentRef>;
  benchmark_median_pct?: number;
  benchmarkMedianPct?: number;
  benchmark_range_pct?: [number, number] | { min?: number; max?: number };
  benchmarkRangePct?: [number, number] | { min?: number; max?: number };
  benchmark_max_pct?: number;
  benchmarkMaxPct?: number;
  benchmark_median_months?: number;
  benchmarkMedianMonths?: number;
  benchmark_max_months?: number;
  benchmarkMaxMonths?: number;
  nature_and_gravity_weighed?: boolean;
  natureAndGravityWeighed?: boolean;
  case_peculiarities_weighed?: boolean;
  casePeculiaritiesWeighed?: boolean;
  concrete_damage_proven?: boolean;
  concreteDamageProven?: boolean;
  is_primary_offender?: boolean;
  isPrimaryOffender?: boolean;
  has_integrity_program?: boolean;
  hasIntegrityProgram?: boolean;
  aggravating_factors?: string[];
  aggravatingFactors?: string[];
  mitigating_factors?: string[];
  mitigatingFactors?: string[];
  aggravating_factors_proven?: boolean;
  aggravatingFactorsProven?: boolean;
  lindb_art22_weighed?: boolean;
  lindbArt22Weighed?: boolean;
  art156_par1_weighed?: boolean;
  art156Par1Weighed?: boolean;
  has_jurisprudential_calibration?: boolean;
  hasJurisprudentialCalibration?: boolean;
}

export interface RawPasFederativeFields extends RawDosimetryBenchmarkInput {
  sphere?: FederativeSphere;
  esfera?: FederativeSphere;
  uf?: string;
  municipality?: string;
  municipio?: string;
  legal_regime?: "LEI_14133" | "LEI_13303" | string;
  legalRegime?: "LEI_14133" | "LEI_13303" | string;
  sanction_type?: string;
  sanctionType?: string;
  sanction_scope_claimed?: string;
  sanctionScopeClaimed?: string;
  territorial_scope?: string;
  territorialScope?: string;
  duration_months?: number;
  durationMonths?: number;
  debarment_months?: number;
  debarmentMonths?: number;
  signing_authority_role?: SigningAuthorityRole;
  signingAuthorityRole?: SigningAuthorityRole;
  authority_role?: SigningAuthorityRole;
  authorityRole?: SigningAuthorityRole;
  has_conclusive_legal_opinion?: boolean;
  hasConclusiveLegalOpinion?: boolean;
  conclusive_legal_opinion?: boolean;
  conclusiveLegalOpinion?: boolean;
  registries_commanded?: string[];
  registriesCommanded?: string[];
  mandatory_registries?: string[];
  mandatoryRegistries?: string[];
  external_control_court_notified?: boolean;
  externalControlCourtNotified?: boolean;
  art38_cross_debarment_applicable?: boolean;
  art38CrossDebarmentApplicable?: boolean;
  dosimetry_evaluation?: RawDosimetryBenchmarkInput;
  dosimetryEvaluation?: RawDosimetryBenchmarkInput;
  dosimetry_benchmark?: RawDosimetryBenchmarkInput;
  dosimetryBenchmark?: RawDosimetryBenchmarkInput;
}

export interface PasFederativeAnalysisSummary {
  sphere: string;
  uf?: string;
  municipality?: string;
  legal_regime: string;
  competent_audit_court: string;
  sanction_scope_claimed?: string;
  territorial_scope_ok: boolean;
  state_enterprise_regime_ok: boolean;
  duration_months?: number;
  max_legal_duration_months?: number;
  signing_authority_role?: string;
  authority_competent_ok: boolean;
  conclusive_legal_opinion_ok: boolean;
  required_registries: string[];
  registries_commanded: string[];
  missing_registries: string[];
  registries_ok: boolean;
}

export interface PasDosimetryCalibrationSummary {
  calibrated_with_precedents: boolean;
  lindb_art22_vectors_weighed: boolean;
  precedent_ids: string[];
  benchmark_median_pct?: number;
  benchmark_range_pct?: [number, number];
  benchmark_max_pct?: number;
  aggravating_factors_proven: boolean;
  proportionality_ok: boolean;
  outlier_detected: boolean;
}

export interface PasFederativeAndDosimetryResult {
  blocking_tags: string[];
  reasons: string[];
  competent_audit_court: string;
  federative_adequacy: PasFederativeAnalysisSummary;
  dosimetry_calibration: PasDosimetryCalibrationSummary;
}
