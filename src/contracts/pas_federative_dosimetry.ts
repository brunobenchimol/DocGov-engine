// ============================================================================
// Adequação Federativa do PAS e Calibragem Jurisprudencial LINDB Art. 22 (Gen5.6)
// docgov-engine v1.5.6 — src/contracts/pas_federative_dosimetry.ts
// Art. 156 §§ 1º, 4º e 6º e Art. 161 da Lei 14.133/2021;
// Art. 38 e Art. 83, III da Lei 13.303/2016; Art. 22 §§ 2º e 3º da LINDB.
// ============================================================================

import type {
  RawDosimetryBenchmarkInput,
  PasFederativeAnalysisSummary,
  PasDosimetryCalibrationSummary,
  PasFederativeAndDosimetryResult,
} from "./pas_federative_types.ts";

export * from "./pas_federative_types.ts";

const VALID_DEBARMENT_ROLES = new Set([
  "MINISTRO_DE_ESTADO",
  "MINISTRO_ESTADO",
  "MINISTRO",
  "SECRETARIO_ESTADUAL",
  "SECRETARIO_MUNICIPAL",
  "AUTORIDADE_MAXIMA_AUTARQUIA_FUNDACAO",
  "AUTORIDADE_MAXIMA",
]);

const ALWAYS_OVERBROAD_IMPEDIMENT_SPHERES = new Set([
  "NATIONAL",
  "NACIONAL",
  "ALL_SPHERES",
  "TODAS_AS_ESFERAS",
  "ALL_FEDERATIVE_ENTITIES",
  "AMBITO_NACIONAL",
  "COUNTRYWIDE",
]);

const UNION_SPHERES = new Set(["UNION", "UNIAO", "FEDERAL"]);
const TCM_STATE_UFS = new Set(["PA", "BA", "GO"]);

const DOSIMETRY_TRIGGER_KEYS = [
  "dosimetry_evaluation", "dosimetryEvaluation", "dosimetry_benchmark", "dosimetryBenchmark",
  "juris_precedent_id", "jurisPrecedentId", "benchmark_precedents", "benchmarkPrecedents",
  "benchmark_median_pct", "benchmarkMedianPct", "benchmark_range_pct", "benchmarkRangePct",
  "benchmark_max_pct", "benchmarkMaxPct", "benchmark_median_months", "benchmarkMedianMonths",
  "benchmark_max_months", "benchmarkMaxMonths", "lindb_art22_weighed", "lindbArt22Weighed",
  "art156_par1_weighed", "art156Par1Weighed", "has_jurisprudential_calibration",
  "hasJurisprudentialCalibration", "aggravating_factors_proven", "aggravatingFactorsProven",
  "is_primary_offender", "isPrimaryOffender", "concrete_damage_proven", "concreteDamageProven",
  "nature_and_gravity_weighed", "natureAndGravityWeighed",
  "case_peculiarities_weighed", "casePeculiaritiesWeighed",
];

function normalizeToken(val: string | undefined): string {
  if (!val) return "";
  return val
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-/]+/g, "_");
}

function normalizeSphere(sphereRaw?: string, ufRaw?: string, munRaw?: string): string {
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

export function resolveCompetentAuditCourt(
  sphereRaw?: string,
  ufRaw?: string,
  municipalityRaw?: string
): string {
  const sphere = normalizeSphere(sphereRaw, ufRaw, municipalityRaw);
  const uf = (ufRaw || "").trim().toUpperCase();
  const mun = normalizeToken(municipalityRaw);

  if (sphere === "FEDERAL") return "TCU";
  if (sphere === "STATE") {
    if (uf === "DF") return "TCDF";
    return uf ? `TCE-${uf}` : "TCU";
  }
  if (mun === "SAO_PAULO" || (mun === "CAPITAL" && uf === "SP")) return "TCM-SP";
  if (mun === "RIO_DE_JANEIRO" || (mun === "CAPITAL" && uf === "RJ")) return "TCM-RIO";
  if (TCM_STATE_UFS.has(uf)) return `TCM-${uf}`;
  if (uf === "DF") return "TCDF";
  return uf ? `TCE-${uf}` : "TCU";
}

function extractPrecedentIds(bench: RawDosimetryBenchmarkInput): string[] {
  const ids: string[] = [];
  const rawSingle = bench.juris_precedent_id ?? bench.jurisPrecedentId;
  if (Array.isArray(rawSingle)) {
    rawSingle.forEach((v) => typeof v === "string" && v.trim() && ids.push(v.trim()));
  } else if (typeof rawSingle === "string" && rawSingle.trim()) {
    ids.push(rawSingle.trim());
  }
  const rawList = bench.benchmark_precedents ?? bench.benchmarkPrecedents;
  if (Array.isArray(rawList)) {
    for (const entry of rawList) {
      if (typeof entry === "string" && entry.trim()) ids.push(entry.trim());
      else if (entry && typeof entry === "object") {
        const label = entry.id || entry.summary;
        if (label && String(label).trim()) ids.push(String(label).trim());
      }
    }
  }
  return Array.from(new Set(ids));
}

function parseRangePct(
  rawRange: [number, number] | { min?: number; max?: number } | undefined
): [number, number] | undefined {
  if (!rawRange) return undefined;
  if (Array.isArray(rawRange) && rawRange.length >= 2) {
    const a = Number(rawRange[0]);
    const b = Number(rawRange[1]);
    return !isNaN(a) && !isNaN(b) ? [a, b] : undefined;
  }
  if (!Array.isArray(rawRange) && typeof rawRange === "object") {
    const a = rawRange.min !== undefined ? Number(rawRange.min) : undefined;
    const b = rawRange.max !== undefined ? Number(rawRange.max) : undefined;
    return a !== undefined && b !== undefined && !isNaN(a) && !isNaN(b) ? [a, b] : undefined;
  }
  return undefined;
}

export function evaluatePasFederativeAndDosimetry(
  item: Record<string, any>,
  rootInput: Record<string, any>,
  effectiveFinePct: number | undefined,
  isPureRemuneratoryGlosa: boolean
): PasFederativeAndDosimetryResult {
  const rawSphere = item.sphere ?? item.esfera ?? rootInput.sphere ?? rootInput.esfera;
  const rawUf = item.uf ?? rootInput.uf;
  const rawMun = item.municipality ?? item.municipio ?? rootInput.municipality ?? rootInput.municipio;
  const sphere = normalizeSphere(rawSphere, rawUf, rawMun);
  const uf = rawUf ? String(rawUf).trim().toUpperCase() : undefined;
  const municipality = rawMun ? String(rawMun).trim() : undefined;

  const legalRegime = String(
    item.legal_regime || item.legalRegime || rootInput.legal_regime || rootInput.legalRegime || "LEI_14133"
  ).toUpperCase();
  const isLei13303 = legalRegime.includes("13303") || legalRegime.includes("ESTATAL");
  const competentCourt = resolveCompetentAuditCourt(rawSphere, rawUf, rawMun);

  const sanctionType = normalizeToken(
    String(
      item.sanction_type || item.sanctionType || item.penalty_type ||
      item.penaltyType || item.proposed_sanction || item.proposedSanction || ""
    )
  );
  const rawScopeClaimed =
    item.sanction_scope_claimed ?? item.sanctionScopeClaimed ?? item.sanction_scope ??
    item.sanctionScope ?? item.territorial_scope ?? item.territorialScope;
  const scopeClaimed = rawScopeClaimed !== undefined ? normalizeToken(String(rawScopeClaimed)) : undefined;

  const rawMonths = item.duration_months ?? item.durationMonths ?? item.debarment_months ?? item.debarmentMonths;
  const rawYears = item.debarment_years ?? item.debarmentYears;
  const durationMonths =
    rawMonths !== undefined ? Number(rawMonths) : rawYears !== undefined ? Number(rawYears) * 12 : undefined;

  const rawAuthority =
    item.signing_authority_role ?? item.signingAuthorityRole ?? item.authority_role ?? item.authorityRole;
  const authorityRole = rawAuthority !== undefined ? normalizeToken(String(rawAuthority)) : undefined;
  const hasOpinion =
    item.has_conclusive_legal_opinion ?? item.hasConclusiveLegalOpinion ??
    item.conclusive_legal_opinion ?? item.conclusiveLegalOpinion;

  const rawRegistries =
    item.registries_commanded ?? item.registriesCommanded ?? item.mandatory_registries ?? item.mandatoryRegistries;
  const courtNotifiedFlag = item.external_control_court_notified ?? item.externalControlCourtNotified;

  const blockingTags: string[] = [];
  const reasons: string[] = [];
  let territorialScopeOk = true;
  let stateEnterpriseRegimeOk = true;
  let authorityCompetentOk = true;
  let conclusiveLegalOpinionOk = hasOpinion !== false;
  let registriesOk = true;

  const requiredRegistries = isLei13303
    ? ["CEIS", "CNEP", competentCourt]
    : ["CEIS", "CNEP", "PNCP", competentCourt];
  const commandedList: string[] = Array.isArray(rawRegistries)
    ? rawRegistries.map((r) => String(r).trim().toUpperCase()).filter(Boolean)
    : [];
  const missingRegistries: string[] = [];

  if (!isPureRemuneratoryGlosa) {
    // 1. Alcance Territorial do Impedimento (Art. 156, § 4º Lei 14.133)
    if (!isLei13303 && sanctionType.includes("IMPEDIMENTO")) {
      const hasOverbroadScope = Boolean(
        scopeClaimed &&
          (ALWAYS_OVERBROAD_IMPEDIMENT_SPHERES.has(scopeClaimed) ||
            (sphere !== "FEDERAL" && UNION_SPHERES.has(scopeClaimed)) ||
            (sphere === "MUNICIPAL" && (scopeClaimed === "STATE" || scopeClaimed === "ESTADUAL")))
      );
      const exceeds36Months = durationMonths !== undefined && !isNaN(durationMonths) && durationMonths > 36;
      if (hasOverbroadScope || exceeds36Months) {
        territorialScopeOk = false;
        blockingTags.push("[PAS_SANCTION_TERRITORIAL_SCOPE_MISMATCH_BLOCK]");
        reasons.push(
          `Impedimento de licitar na esfera ${sphere} restringe-se ao ente sancionador e ao teto de 36 meses (Art. 156, § 4º Lei 14.133/2021)`
        );
      }
    }

    // 2. Regime Sancionatório Estrito das Empresas Estatais (Art. 83, III e Art. 38 Lei 13.303)
    if (isLei13303) {
      const art38Cross = Boolean(item.art38_cross_debarment_applicable ?? item.art38CrossDebarmentApplicable);
      const exceeds24Months = durationMonths !== undefined && !isNaN(durationMonths) && durationMonths > 24;
      const invokesDebarment = sanctionType.includes("INIDONEIDADE") || sanctionType.includes("LEI_14133");
      const overbroadStateEnterpriseScope = Boolean(
        scopeClaimed &&
          !art38Cross &&
          (ALWAYS_OVERBROAD_IMPEDIMENT_SPHERES.has(scopeClaimed) ||
            UNION_SPHERES.has(scopeClaimed) ||
            scopeClaimed === "STATE" ||
            scopeClaimed === "ESTADUAL" ||
            scopeClaimed === "MUNICIPAL")
      );
      if (exceeds24Months || invokesDebarment || overbroadStateEnterpriseScope) {
        stateEnterpriseRegimeOk = false;
        blockingTags.push("[PAS_STATE_ENTERPRISE_SANCTION_REGIME_MISMATCH_BLOCK]");
        reasons.push(
          "Sob a Lei 13.303/2016 (Art. 83, III), a suspensão restringe-se à própria estatal sancionadora por até 24 meses, vedada declaração de inidoneidade"
        );
      }
    }

    // 3. Competência Exclusiva para Declaração de Inidoneidade (Art. 156, § 6º Lei 14.133)
    if (sanctionType.includes("INIDONEIDADE") || sanctionType === "DEBARMENT") {
      const roleInvalid = authorityRole !== undefined ? !VALID_DEBARMENT_ROLES.has(authorityRole) : !isLei13303;
      const opinionMissing = hasOpinion === false || (!isLei13303 && hasOpinion !== true);
      if (roleInvalid) authorityCompetentOk = false;
      if (opinionMissing) conclusiveLegalOpinionOk = false;
      if (roleInvalid || opinionMissing) {
        blockingTags.push("[PAS_INCOMPETENT_AUTHORITY_FOR_DEBARMENT_BLOCK]");
        reasons.push(
          "Declaração de Inidoneidade exige autoridade máxima competente (Ministro/Secretário/Autoridade Máxima) e parecer jurídico conclusivo (Art. 156, § 6º)"
        );
      }
    }

    // 4. Cadastros Obrigatórios (CEIS, CNEP, PNCP e Corte de Contas Competente)
    if (Array.isArray(rawRegistries) || courtNotifiedFlag === false) {
      const normCommanded = commandedList.map((c) => normalizeToken(c));
      const normCourt = normalizeToken(competentCourt);
      for (const req of requiredRegistries) {
        if (req === competentCourt && courtNotifiedFlag === true) continue;
        const normReq = normalizeToken(req);
        const matched = normCommanded.some(
          (c) => c === normReq || (req === competentCourt && c.includes(normCourt))
        );
        if (!matched) missingRegistries.push(req);
      }
      if (courtNotifiedFlag === false && !missingRegistries.includes(competentCourt)) {
        missingRegistries.push(competentCourt);
      }
      if (missingRegistries.length > 0) {
        registriesOk = false;
        blockingTags.push("[PAS_EXTERNAL_CONTROL_REGISTRY_OMISSION_ALERT]");
        reasons.push(
          `Omissão de comando obrigatório nos cadastros/remessa de controle externo (${missingRegistries.join(", ")})`
        );
      }
    }
  }

  // 5 & 6. Calibragem Jurisprudencial da Dosimetria (Art. 156, § 1º + LINDB Art. 22)
  const bench: RawDosimetryBenchmarkInput = {
    ...(rootInput.dosimetry_benchmark || rootInput.dosimetryBenchmark || {}),
    ...(rootInput.dosimetry_evaluation || rootInput.dosimetryEvaluation || {}),
    ...item,
    ...(item.dosimetry_benchmark || item.dosimetryBenchmark || {}),
    ...(item.dosimetry_evaluation || item.dosimetryEvaluation || {}),
  };

  const hasDosimetryContext = Boolean(
    !isPureRemuneratoryGlosa &&
      DOSIMETRY_TRIGGER_KEYS.some((k) => item[k] !== undefined || rootInput[k] !== undefined)
  );

  const precedentIds = extractPrecedentIds(bench);
  const parsedRange = parseRangePct(bench.benchmark_range_pct ?? bench.benchmarkRangePct);
  const rawMedianPct = bench.benchmark_median_pct ?? bench.benchmarkMedianPct;
  const rawMaxPct = bench.benchmark_max_pct ?? bench.benchmarkMaxPct;
  const rawMedianMonths = bench.benchmark_median_months ?? bench.benchmarkMedianMonths;
  const rawMaxMonths = bench.benchmark_max_months ?? bench.benchmarkMaxMonths;

  const isLowPrimaryNoDamage =
    normalizeToken(item.infraction_severity || item.infractionSeverity) === "LOW" &&
    (bench.is_primary_offender ?? bench.isPrimaryOffender) === true &&
    (bench.concrete_damage_proven ?? bench.concreteDamageProven) === false;

  const effectiveRange: [number, number] | undefined =
    parsedRange ?? (isLowPrimaryNoDamage ? [2, 5] : undefined);
  const benchmarkMedianPct =
    rawMedianPct !== undefined ? Number(rawMedianPct) : isLowPrimaryNoDamage ? 3.5 : undefined;
  const benchmarkMaxPct =
    rawMaxPct !== undefined ? Number(rawMaxPct) : effectiveRange ? effectiveRange[1] : undefined;

  const explicitCalFlag = bench.has_jurisprudential_calibration ?? bench.hasJurisprudentialCalibration;
  const hasPrecedentAnchor =
    explicitCalFlag === false
      ? false
      : precedentIds.length > 0 ||
        parsedRange !== undefined ||
        rawMedianPct !== undefined ||
        rawMaxPct !== undefined ||
        rawMedianMonths !== undefined ||
        rawMaxMonths !== undefined ||
        explicitCalFlag === true;

  const lindbWeighed =
    (bench.lindb_art22_weighed ?? bench.lindbArt22Weighed) !== false &&
    (bench.art156_par1_weighed ?? bench.art156Par1Weighed) !== false &&
    (bench.nature_and_gravity_weighed ?? bench.natureAndGravityWeighed) !== false &&
    (bench.case_peculiarities_weighed ?? bench.casePeculiaritiesWeighed) !== false;

  const rawAggList = bench.aggravating_factors ?? bench.aggravatingFactors;
  const aggProvenFlag = bench.aggravating_factors_proven ?? bench.aggravatingFactorsProven;
  const aggravatingFactorsProven =
    aggProvenFlag === true ||
    (aggProvenFlag !== false && Array.isArray(rawAggList) && rawAggList.length > 0);

  let proportionalityOk = true;
  let outlierDetected = false;

  if (hasDosimetryContext) {
    if (!hasPrecedentAnchor || !lindbWeighed) {
      blockingTags.push("[PAS_ARBITRARY_UNANCHORED_DOSIMETRY_ALERT]");
      reasons.push(
        "Dosimetria sancionadora sem ancoragem em precedentes do Tribunal de Contas ou sem ponderação dos vetores da LINDB Art. 22 / Art. 156 § 1º"
      );
    }

    if (!aggravatingFactorsProven) {
      const fineOutlier =
        effectiveFinePct !== undefined &&
        ((benchmarkMaxPct !== undefined && effectiveFinePct > benchmarkMaxPct) ||
          (benchmarkMedianPct !== undefined && effectiveFinePct > benchmarkMedianPct * 2));
      const monthsOutlier =
        durationMonths !== undefined &&
        ((rawMaxMonths !== undefined && durationMonths > Number(rawMaxMonths)) ||
          (rawMedianMonths !== undefined && durationMonths > Number(rawMedianMonths) * 2));

      if (fineOutlier || monthsOutlier) {
        outlierDetected = true;
        proportionalityOk = false;
        blockingTags.push("[PAS_DISPROPORTIONATE_SANCTION_OUTLIER_BLOCK]");
        reasons.push(
          "Outlier desproporcional de dosimetria: penalidade excede a faixa referencial de precedentes sem circunstância agravante formalmente comprovada (LINDB Art. 22)"
        );
      }
    }
  }

  const federativeAdequacy: PasFederativeAnalysisSummary = {
    sphere,
    ...(uf ? { uf } : {}),
    ...(municipality ? { municipality } : {}),
    legal_regime: legalRegime,
    competent_audit_court: competentCourt,
    ...(scopeClaimed ? { sanction_scope_claimed: scopeClaimed } : {}),
    territorial_scope_ok: territorialScopeOk,
    state_enterprise_regime_ok: stateEnterpriseRegimeOk,
    ...(durationMonths !== undefined && !isNaN(durationMonths) ? { duration_months: durationMonths } : {}),
    max_legal_duration_months: isLei13303
      ? sanctionType.includes("SUSPENS") || sanctionType.includes("IMPEDIMENTO") || durationMonths !== undefined
        ? 24
        : undefined
      : sanctionType.includes("INIDONEIDADE")
        ? 72
        : sanctionType.includes("IMPEDIMENTO")
          ? 36
          : undefined,
    ...(authorityRole ? { signing_authority_role: authorityRole } : {}),
    authority_competent_ok: authorityCompetentOk,
    conclusive_legal_opinion_ok: conclusiveLegalOpinionOk,
    required_registries: requiredRegistries,
    registries_commanded: commandedList,
    missing_registries: missingRegistries,
    registries_ok: registriesOk,
  };

  const dosimetryCalibration: PasDosimetryCalibrationSummary = {
    calibrated_with_precedents: hasPrecedentAnchor,
    lindb_art22_vectors_weighed: lindbWeighed,
    precedent_ids: precedentIds,
    ...(benchmarkMedianPct !== undefined ? { benchmark_median_pct: benchmarkMedianPct } : {}),
    ...(effectiveRange ? { benchmark_range_pct: effectiveRange } : {}),
    ...(benchmarkMaxPct !== undefined ? { benchmark_max_pct: benchmarkMaxPct } : {}),
    aggravating_factors_proven: aggravatingFactorsProven,
    proportionality_ok: proportionalityOk,
    outlier_detected: outlierDetected,
  };

  return {
    blocking_tags: blockingTags,
    reasons,
    competent_audit_court: competentCourt,
    federative_adequacy: federativeAdequacy,
    dosimetry_calibration: dosimetryCalibration,
  };
}
