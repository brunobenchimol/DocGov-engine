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

export const DOSIMETRY_TRIGGER_KEYS = [
  "dosimetry_evaluation", "dosimetryEvaluation", "dosimetry_benchmark", "dosimetryBenchmark",
  "juris_precedent_id", "jurisPrecedentId", "benchmark_precedents", "benchmarkPrecedents",
  "jurisprudential_precedents", "jurisprudentialPrecedents", "precedentes_citados", "precedentesCitados",
  "benchmark_median_pct", "benchmarkMedianPct", "median_pct", "medianPct",
  "precedent_median_pct", "precedentMedianPct", "historical_average_fine_pct", "historicalAverageFinePct",
  "benchmark_range_pct", "benchmarkRangePct", "reference_range_pct", "referenceRangePct",
  "precedent_range_pct", "precedentRangePct", "precedent_min_pct", "precedentMinPct",
  "precedent_max_pct", "precedentMaxPct", "precedent_fines_pct", "precedentFinesPct",
  "benchmark_max_pct", "benchmarkMaxPct", "benchmark_median_months", "benchmarkMedianMonths",
  "benchmark_max_months", "benchmarkMaxMonths", "lindb_art22_weighed", "lindbArt22Weighed",
  "art156_par1_weighed", "art156Par1Weighed", "has_jurisprudential_calibration",
  "hasJurisprudentialCalibration", "aggravating_factors_proven", "aggravatingFactorsProven",
  "is_primary_offender", "isPrimaryOffender", "concrete_damage_proven", "concreteDamageProven",
  "nature_and_gravity_weighed", "natureAndGravityWeighed",
  "case_peculiarities_weighed", "casePeculiaritiesWeighed",
  "multa_sancionatoria_proposta", "multaSancionatoriaProposta",
];

export function normalizeToken(val: string | undefined): string {
  if (!val) return "";
  return val
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-/]+/g, "_");
}

export function normalizeSphere(sphereRaw?: string, ufRaw?: string, munRaw?: string): string {
  const tok = normalizeToken(sphereRaw);
  if (tok === "MUNICIPAL" || tok === "MUNICIPIO") return "MUNICIPAL";
  if (tok === "STATE" || tok === "ESTADUAL" || tok === "ESTADO" || tok === "DISTRITAL") {
    return "STATE";
  }
  if (tok === "FEDERAL" || tok === "UNIAO" || tok === "UNION") return "FEDERAL";
  if (munRaw && munRaw.trim()) return "MUNICIPAL";
  if (ufRaw && ufRaw.trim()) return "STATE";
  return "FEDERAL";
}

function collectPrecedentEntries(raw: unknown, ids: string[]): void {
  if (!raw) return;
  const list = Array.isArray(raw) ? raw : [raw];
  for (const entry of list) {
    if (typeof entry === "string" && entry.trim()) {
      ids.push(entry.trim());
    } else if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const label = obj.id || obj.acordao || obj.code || obj.ref || obj.summary || obj.numero;
      if (label && String(label).trim()) ids.push(String(label).trim());
    }
  }
}

export function extractPrecedentIds(bench: Record<string, any>): string[] {
  const ids: string[] = [];
  collectPrecedentEntries(bench.juris_precedent_id ?? bench.jurisPrecedentId, ids);
  collectPrecedentEntries(bench.benchmark_precedents ?? bench.benchmarkPrecedents, ids);
  collectPrecedentEntries(bench.jurisprudential_precedents ?? bench.jurisprudentialPrecedents, ids);
  collectPrecedentEntries(bench.precedentes_citados ?? bench.precedentesCitados, ids);
  return Array.from(new Set(ids));
}

export function parseRangePct(rawRange: unknown): [number, number] | undefined {
  if (!rawRange) return undefined;
  if (Array.isArray(rawRange) && rawRange.length >= 2) {
    const a = Number(rawRange[0]);
    const b = Number(rawRange[1]);
    return !isNaN(a) && !isNaN(b) ? [a, b] : undefined;
  }
  if (!Array.isArray(rawRange) && typeof rawRange === "object") {
    const obj = rawRange as { min?: unknown; max?: unknown };
    const a = obj.min !== undefined ? Number(obj.min) : undefined;
    const b = obj.max !== undefined ? Number(obj.max) : undefined;
    return a !== undefined && b !== undefined && !isNaN(a) && !isNaN(b) ? [a, b] : undefined;
  }
  return undefined;
}

export function resolveBenchmarkMetrics(benchAny: Record<string, any>): {
  precedentIds: string[];
  parsedRange: [number, number] | undefined;
  rawMedianPct: number | undefined;
  rawMaxPct: number | undefined;
} {
  const precedentIds = extractPrecedentIds(benchAny);
  const rawFinesArr = benchAny.precedent_fines_pct ?? benchAny.precedentFinesPct;
  const sortedFines = Array.isArray(rawFinesArr)
    ? rawFinesArr.map((v) => Number(v)).filter((n) => !isNaN(n) && n >= 0).sort((a, b) => a - b)
    : [];
  const finesMin = sortedFines.length >= 2 ? sortedFines[0] : undefined;
  const finesMax = sortedFines.length >= 1 ? sortedFines[sortedFines.length - 1] : undefined;
  const finesMedian =
    sortedFines.length === 0
      ? undefined
      : sortedFines.length % 2 === 1
        ? sortedFines[Math.floor(sortedFines.length / 2)]
        : Number(((sortedFines[sortedFines.length / 2 - 1] + sortedFines[sortedFines.length / 2]) / 2).toFixed(4));

  let parsedRange = parseRangePct(
    benchAny.benchmark_range_pct ??
      benchAny.benchmarkRangePct ??
      benchAny.reference_range_pct ??
      benchAny.referenceRangePct ??
      benchAny.precedent_range_pct ??
      benchAny.precedentRangePct
  );
  const pMin = benchAny.precedent_min_pct ?? benchAny.precedentMinPct;
  const pMax = benchAny.precedent_max_pct ?? benchAny.precedentMaxPct;
  if (!parsedRange && pMin !== undefined && pMax !== undefined && !isNaN(Number(pMin)) && !isNaN(Number(pMax))) {
    parsedRange = [Number(pMin), Number(pMax)];
  }
  if (!parsedRange && finesMin !== undefined && finesMax !== undefined) {
    parsedRange = [finesMin, finesMax];
  }

  const rawMed =
    benchAny.benchmark_median_pct ??
    benchAny.benchmarkMedianPct ??
    benchAny.median_pct ??
    benchAny.medianPct ??
    benchAny.precedent_median_pct ??
    benchAny.precedentMedianPct ??
    benchAny.historical_average_fine_pct ??
    benchAny.historicalAverageFinePct ??
    finesMedian;
  const rawMax = benchAny.benchmark_max_pct ?? benchAny.benchmarkMaxPct ?? pMax ?? finesMax;

  return {
    precedentIds,
    parsedRange,
    rawMedianPct: rawMed !== undefined && !isNaN(Number(rawMed)) ? Number(rawMed) : undefined,
    rawMaxPct: rawMax !== undefined && !isNaN(Number(rawMax)) ? Number(rawMax) : undefined,
  };
}
