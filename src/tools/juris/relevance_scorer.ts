// ============================================================================
// Motor de Ranking Determinístico de Jurisprudência (0..100 pts)
// ============================================================================

import type { JurisSearchResultItem, JurisStance, JurisLegalRegime } from "./types.ts";
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
}

export interface ScoreResult {
  relevance_score: number;
  score: number; // alias
  breakdown: ScoreBreakdown;
  outcome: string;
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
 * Classifica o comando do dispositivo em outcome semântico.
 */
export function classifyDecisionOutcome(dispositivo?: string, tese?: string): string {
  const combined = `${dispositivo || ""} ${tese || ""}`.toLowerCase();

  if (/\b((?:deferir|conceder|adotar)\s+(?:a\s+)?medida\s+cautelar|cautelar\s+deferida|medida\s+cautelar\s+adotada|suspens[aã]o\s+cautelar)\b/i.test(combined)) {
    return "CAUTELAR_DEFERIDA";
  }
  if (/\b((?:indeferir|negar|revogar)\s+(?:a\s+)?medida\s+cautelar|cautelar\s+indeferida|revogar\s+a\s+medida\s+cautelar)\b/i.test(combined)) {
    return "CAUTELAR_INDEFERIDA";
  }
  if (/\b(anular|anulação|determinar\s+a\s+anulação|procedente|parcialmente\s+procedente)\b/i.test(combined)) {
    return "PROCEDENTE / DETERMINACAO";
  }
  if (/\b(improcedente|não\s+procedente|arquivamento|regularidade|é\s+lícit[oa])\b/i.test(combined)) {
    return "IMPROCEDENTE / MANUTENCAO_CERTAME";
  }
  if (/\b(dar\s+ciência|recomendação)\b/i.test(combined)) {
    return "CIENCIA / RECOMENDACAO";
  }
  return "DECISAO_ORDINARIA";
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

  // 2. Alinhamento Tático do Dispositivo com o stance (0..25 pts)
  let stanceScore = 0;
  const isDefenseFavorable = /\b(improcedente|não\s+procedente|indeferir\s+a\s+medida\s+cautelar|regularidade|é\s+lícit[oa]|é\s+admissível|não\s+configura\s+restrição|justificadamente|negar\s+provimento)\b/i.test(
    searchableText
  );
  const isAttackFavorable = /\b(procedente|parcialmente\s+procedente|deferir\s+a\s+medida\s+cautelar|suspender|anular|determinar\s+a\s+anulação|restringe\s+a\s+competitividade|irregularidade|dar\s+ciência|abstenha-se)\b/i.test(
    searchableText
  );

  if (stance === "DEFENSE") {
    if (isDefenseFavorable) stanceScore = 25;
    else if (!isAttackFavorable) stanceScore = 12;
    else stanceScore = 4;
  } else if (stance === "ATTACK") {
    if (isAttackFavorable) stanceScore = 25;
    else if (!isDefenseFavorable) stanceScore = 12;
    else stanceScore = 4;
  } else {
    // stance === "BOTH"
    stanceScore = isDefenseFavorable || isAttackFavorable ? 20 : 10;
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

  const total = Math.min(100, Math.max(0, lexicalScore + stanceScore + regimeScore + quorumScore + recencyScore));
  const outcome = classifyDecisionOutcome(item.dispositivo, item.tese);

  return {
    relevance_score: total,
    score: total,
    breakdown: {
      lexical: lexicalScore,
      stanceAlignment: stanceScore,
      legalRegime: regimeScore,
      quorum: quorumScore,
      recency: recencyScore,
    },
    outcome,
    statutoryBridgeRefs: bridgeRefs,
  };
}
