// ============================================================================
// Motor de Ranking Determinístico de Jurisprudência (0..100 pts)
// ============================================================================

import type { JurisSearchResultItem, JurisStance, JurisLegalRegime, StanceAlignment } from "./types.ts";
import { findStatutoryBridgesForText, isStateItEntity } from "./statutory_bridge.ts";

const STOPWORDS = new Set([
  "de", "a", "o", "da", "do", "em", "para", "com", "por", "sobre", "uma", "um",
  "os", "as", "dos", "das", "na", "no", "nas", "nos", "ao", "aos", "à", "às",
  "que", "e", "ou", "se", "como", "mas", "pelo", "pela", "pelos", "pelas",
  "acórdão", "tcu", "plenário", "tribunal", "união", "contas", "processo",
]);

export interface ScoreBreakdown {
  lexical: number;
  stanceAlignment: number;
  legalRegime: number;
  quorum: number;
  recency: number;
  tacticalPenalty?: number;
  domainNoisePenalty?: number;
}

export interface ScoreResult {
  relevance_score: number;
  score: number; // alias
  breakdown: ScoreBreakdown;
  outcome: string;
  stance_alignment: StanceAlignment;
  statutoryBridgeRefs: string[];
}

/**
 * Tokeniza texto removendo pontuação e stopwords.
 */
export function tokenizeQuery(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Classifica o comando do dispositivo em outcome semântico, com precedência da camada 5A (dispositivo).
 */
export function classifyDecisionOutcome(dispositivo?: string, tese?: string): string {
  const dispClean = (dispositivo || "").toLowerCase();
  const teseClean = (tese || "").toLowerCase();

  // 1. Precedência da Camada 5A (Dispositivo)
  if (dispClean.length > 0) {
    if (/\b((?:deferir|conceder|adotar)\s+(?:a\s+)?medida\s+cautelar|cautelar\s+deferida|medida\s+cautelar\s+adotada|suspens[aã]o\s+cautelar)\b/i.test(dispClean)) {
      return "CAUTELAR_DEFERIDA";
    }
    if (/\b((?:indeferir|negar|revogar)\s+(?:a\s+)?medida\s+cautelar|cautelar\s+indeferida|revogar\s+a\s+medida\s+cautelar)\b/i.test(dispClean)) {
      return "CAUTELAR_INDEFERIDA";
    }
    if (/\b(anular|anula[çc][aã]o|determinar\s+a\s+anula[çc][aã]o|procedente|parcialmente\s+procedente|manter\s+(?:a\s+)?responsabilidade\s+subsidi[áa]ria)\b/i.test(dispClean)) {
      return "PROCEDENTE / DETERMINACAO";
    }
    if (/\b(improcedente|n[aã]o\s+procedente|arquivamento|regularidade|é\s+l[íi]cit[oa]|excluir\s+(?:a\s+)?responsabilidade\s+subsidi[áa]ria|afastar\s+(?:a\s+)?responsabilidade\s+subsidi[áa]ria)\b/i.test(dispClean)) {
      return "IMPROCEDENTE / MANUTENCAO_CERTAME";
    }
    if (/\b(dar\s+ci[êe]ncia|recomenda[çc][aã]o)\b/i.test(dispClean)) {
      return "CIENCIA / RECOMENDACAO";
    }
  }

  // 2. Fallback para a Ementa / Tese (Camada 2B)
  const combined = `${dispClean} ${teseClean}`.trim();
  if (/\b((?:deferir|conceder|adotar)\s+(?:a\s+)?medida\s+cautelar|cautelar\s+deferida|medida\s+cautelar\s+adotada|suspens[aã]o\s+cautelar)\b/i.test(combined)) {
    return "CAUTELAR_DEFERIDA";
  }
  if (/\b((?:indeferir|negar|revogar)\s+(?:a\s+)?medida\s+cautelar|cautelar\s+indeferida|revogar\s+a\s+medida\s+cautelar)\b/i.test(combined)) {
    return "CAUTELAR_INDEFERIDA";
  }
  if (/\b(anular|anula[çc][aã]o|determinar\s+a\s+anula[çc][aã]o|procedente|parcialmente\s+procedente)\b/i.test(combined)) {
    return "PROCEDENTE / DETERMINACAO";
  }
  if (/\b(improcedente|n[aã]o\s+procedente|arquivamento|regularidade|é\s+l[íi]cit[oa])\b/i.test(combined)) {
    return "IMPROCEDENTE / MANUTENCAO_CERTAME";
  }
  if (/\b(dar\s+ci[êe]ncia|recomenda[çc][aã]o)\b/i.test(combined)) {
    return "CIENCIA / RECOMENDACAO";
  }
  return "DECISAO_ORDINARIA";
}

/**
 * Detecta se o julgado trata exclusivamente de Direito Tributário ou Penal puro sem correlação com licitações.
 */
export function isPureTaxOrCriminalNoise(
  indexacao?: string,
  tese?: string,
  dispositivo?: string
): boolean {
  const text = `${indexacao || ""} ${tese || ""} ${dispositivo || ""}`.toLowerCase();
  const hasTaxKeywords = /\b(icms|issqn|bitributa[çc][aã]o|fato\s+gerador\s+tribut[áa]rio|incid[êe]ncia\s+tribut[áa]ria|imposto\s+sobre\s+opera[çc][õo]es|imposto\s+sobre\s+servi[çc]os|cr[ée]dito\s+tribut[áa]rio|execu[çc][aã]o\s+fiscal)\b/i.test(text);
  if (!hasTaxKeywords) return false;

  const hasAdminKeywords = /\b(licita[çc][aã]o|licitat[óo]ri[oa]|edital|preg[aã]o|contrato[s]?\s+administrativo[s]?|13\.?303|14\.?133|8\.?666|terceiriza[çc][aã]o|s[úu]mula\s*331|tribunal\s+de\s+contas|certame|registro\s+de\s+pre[çc]os|bdi)\b/i.test(text);
  return !hasAdminKeywords;
}

/**
 * Calcula a pontuação determinística de 0 a 100 pontos para um item de jurisprudência.
 */
export function scoreJurisItem(
  item: Partial<JurisSearchResultItem>,
  query: string,
  options: {
    stance?: JurisStance;
    regime?: JurisLegalRegime;
  } = {}
): ScoreResult {
  const stance = options.stance || "DEFENSE";
  const regime = options.regime || "BOTH";

  const searchableText = `${item.indexacao || ""} ${item.tese || ""} ${item.dispositivo || ""}`.toLowerCase();
  const queryTokens = tokenizeQuery(query);

  // 1. Aderência Léxica (0..35 pts)
  let lexicalScore = 0;
  if (queryTokens.length > 0) {
    let matchedCount = 0;
    for (const token of queryTokens) {
      if (searchableText.includes(token)) {
        matchedCount++;
      }
    }
    const ratio = matchedCount / queryTokens.length;
    lexicalScore += Math.round(ratio * 25);

    // Bônus de frase/bigrama exato (+10 pts)
    const normalizedQuery = query.toLowerCase().trim();
    if (normalizedQuery.length > 5 && searchableText.includes(normalizedQuery)) {
      lexicalScore += 10;
    } else {
      // Checa sub-frases de 2 palavras
      for (let i = 0; i < queryTokens.length - 1; i++) {
        const bigram = `${queryTokens[i]} ${queryTokens[i + 1]}`;
        if (searchableText.includes(bigram)) {
          lexicalScore += 5;
          break;
        }
      }
    }
  }
  lexicalScore = Math.min(35, Math.max(0, lexicalScore));

  // 2. Alinhamento Tático do Dispositivo com o stance (0..25 pts) com Precedência de Desfecho
  const outcome = classifyDecisionOutcome(item.dispositivo, item.tese);
  const dispText = (item.dispositivo || "").toLowerCase();

  const isPrimaryAdverseToDefense =
    outcome === "CAUTELAR_DEFERIDA" ||
    outcome === "PROCEDENTE / DETERMINACAO" ||
    /\b(determinar\s+a\s+anula[çc][aã]o|anular|suspens[aã]o\s+cautelar|abstenha-se\s+de\s+contratar|manter\s+(?:a\s+)?responsabilidade\s+subsidi[áa]ria)\b/i.test(dispText);

  const isPrimaryFavorableToDefense =
    !isPrimaryAdverseToDefense &&
    (outcome === "IMPROCEDENTE / MANUTENCAO_CERTAME" ||
      outcome === "CAUTELAR_INDEFERIDA" ||
      /\b(julgar\s+improcedente|manuten[çc][aã]o\s+do\s+certame|indeferir\s+a\s+medida\s+cautelar|excluir\s+(?:a\s+)?responsabilidade|afastar\s+(?:a\s+)?responsabilidade)\b/i.test(dispText));

  let stanceScore = 0;
  let tacticalPenalty = 0;
  let stanceAlignment: StanceAlignment = "NEUTRAL";

  if (stance === "DEFENSE") {
    if (isPrimaryAdverseToDefense) {
      stanceScore = 0;
      tacticalPenalty = -15;
      stanceAlignment = "ADVERSE_DISTINGUISHING_REQUIRED";
    } else if (isPrimaryFavorableToDefense) {
      stanceScore = 25;
      stanceAlignment = "FAVORABLE";
    } else {
      const isDefenseFavorable = /\b(improcedente|n[aã]o\s+procedente|indeferir\s+a\s+medida\s+cautelar|regularidade|é\s+l[íi]cit[oa]|é\s+admiss[íi]vel|n[aã]o\s+configura\s+restri[çc][aã]o|justificadamente|negar\s+provimento)\b/i.test(
        searchableText
      );
      if (isDefenseFavorable) {
        stanceScore = 18;
        stanceAlignment = "FAVORABLE";
      } else {
        stanceScore = 8;
        stanceAlignment = "NEUTRAL";
      }
    }
  } else if (stance === "ATTACK") {
    if (isPrimaryAdverseToDefense) {
      stanceScore = 25;
      stanceAlignment = "FAVORABLE";
    } else if (isPrimaryFavorableToDefense) {
      stanceScore = 0;
      tacticalPenalty = -15;
      stanceAlignment = "ADVERSE_DISTINGUISHING_REQUIRED";
    } else {
      const isAttackFavorable = /\b(procedente|parcialmente\s+procedente|deferir\s+a\s+medida\s+cautelar|suspender|anular|determinar\s+a\s+anula[çc][aã]o|restringe\s+a\s+competitividade|irregularidade|dar\s+ci[êe]ncia|abstenha-se)\b/i.test(
        searchableText
      );
      if (isAttackFavorable) {
        stanceScore = 18;
        stanceAlignment = "FAVORABLE";
      } else {
        stanceScore = 8;
        stanceAlignment = "NEUTRAL";
      }
    }
  } else {
    // stance === "BOTH"
    stanceScore = isPrimaryFavorableToDefense || isPrimaryAdverseToDefense ? 20 : 10;
    stanceAlignment = "NEUTRAL";
  }

  // 3. Afinidade de Regime Jurídico (0..20 pts)
  let regimeScore = 0;
  const bridges = findStatutoryBridgesForText(searchableText);
  const bridgeRefs = bridges.map((b) => b.id);
  const hasStateEntity = isStateItEntity(item.entidade) || isStateItEntity(searchableText);
  const mentions13303 = /\b13\.?303\b/i.test(searchableText) || hasStateEntity;
  const mentions14133 = /\b14\.?133\b/i.test(searchableText);

  if (regime === "13303") {
    if (mentions13303) regimeScore = 20;
    else if (bridgeRefs.length > 0) regimeScore = 14;
    else regimeScore = 6;
  } else if (regime === "14133") {
    if (mentions14133) regimeScore = 20;
    else if (bridgeRefs.length > 0) regimeScore = 14;
    else regimeScore = 6;
  } else {
    // regime === "BOTH"
    if (mentions13303 || mentions14133 || bridgeRefs.length > 0) regimeScore = 18;
    else regimeScore = 10;
  }

  // 4. Peso do Colegiado e Quórum (0..10 pts)
  let quorumScore = 5;
  const colegiado = (item.colegiado || "").toLowerCase();
  if (colegiado.includes("plenário") || colegiado.includes("corte especial")) {
    quorumScore = 10;
  } else if (colegiado.includes("câmara") || colegiado.includes("turma")) {
    quorumScore = 7;
  }

  // 5. Contemporaneidade (0..10 pts)
  let recencyScore = 4;
  const ano = item.ano || (item.dataSessao ? parseInt(item.dataSessao.slice(0, 4), 10) : 0);
  if (ano >= 2023) recencyScore = 10;
  else if (ano >= 2021) recencyScore = 8;
  else if (ano >= 2018) recencyScore = 6;
  else if (ano >= 2016) recencyScore = 4;
  else if (ano > 0) recencyScore = 2;

  // 6. Penalidade Anti-Ruído Tributário / Penal (-25 pts)
  let domainNoisePenalty = 0;
  if (isPureTaxOrCriminalNoise(item.indexacao, item.tese, item.dispositivo)) {
    domainNoisePenalty = -25;
  }

  const rawSum = lexicalScore + stanceScore + regimeScore + quorumScore + recencyScore + tacticalPenalty + domainNoisePenalty;
  const total = Math.min(100, Math.max(0, rawSum));

  return {
    relevance_score: total,
    score: total,
    breakdown: {
      lexical: lexicalScore,
      stanceAlignment: stanceScore,
      legalRegime: regimeScore,
      quorum: quorumScore,
      recency: recencyScore,
      tacticalPenalty: tacticalPenalty !== 0 ? tacticalPenalty : undefined,
      domainNoisePenalty: domainNoisePenalty !== 0 ? domainNoisePenalty : undefined,
    },
    outcome,
    stance_alignment: stanceAlignment,
    statutoryBridgeRefs: bridgeRefs,
  };
}
