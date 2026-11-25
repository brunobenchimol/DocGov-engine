// ============================================================================
// Normalização de Aliases Normativos do TST (Sem Texto Estático Congelado)
// docgov-engine v1.7.3 — providers/tst_catalog.ts
// ============================================================================

export interface TstNormativeRef {
  kind: "SUM" | "OJ" | "ACORDAO";
  numero: string;
  canonicalId: string;
  queryTerm: string;
}

/**
 * Converte identificadores ou referências normativas do TST (ex.: SUMULA-TST-331,
 * OJ-TST-SDI1-191, TST-TEMA-246, TST-TEMA-1118) em parâmetros de consulta ao vivo,
 * sem servir texto normativo estático congelado no binário.
 */
export function parseTstNormativeRef(input: string): TstNormativeRef | null {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();

  const sumulaMatch =
    upper.match(/\bSUMULA[-_\s]+TST[-_\s]+(\d+)\b/) ||
    upper.match(/\bTST[-_\s]+SUMULA[-_\s]+(\d+)\b/) ||
    upper.match(/\bS[ÚU]MULA\s*(?:N[º°O]\s*)?(\d+)\b/);
  if (sumulaMatch && !/\bVINCULANTE\b/i.test(upper)) {
    const num = String(parseInt(sumulaMatch[1], 10));
    return {
      kind: "SUM",
      numero: num,
      canonicalId: `SUMULA-TST-${num}`,
      queryTerm: num,
    };
  }

  const ojMatch =
    upper.match(/\bOJ[-_\s]+TST[-_\s]+(?:SDI1[-_\s]+)?(\d+)\b/) ||
    upper.match(/\bTST[-_\s]+OJ[-_\s]+(?:SDI1[-_\s]+)?(\d+)\b/) ||
    upper.match(/\bOJ[-_\s]+(\d+)(?:[-_\s]+SDI1)?\b/) ||
    upper.match(/\bOJ\s*(?:N[º°O]\s*)?(\d+)\b/);
  if (ojMatch) {
    const num = String(parseInt(ojMatch[1], 10));
    return {
      kind: "OJ",
      numero: num,
      canonicalId: `OJ-TST-SDI1-${num}`,
      queryTerm: num,
    };
  }

  if (/\bTEMA[-_\s]*246\b|\bTST[-_\s]*ADC[-_\s]*16\b/i.test(upper)) {
    return {
      kind: "ACORDAO",
      numero: "246",
      canonicalId: "TST-TEMA-246",
      queryTerm: "Tema 246 RE 760931 responsabilidade subsidiaria",
    };
  }

  if (/\bTEMA[-_\s]*1\.?118\b/i.test(upper)) {
    return {
      kind: "ACORDAO",
      numero: "1118",
      canonicalId: "TST-TEMA-1118",
      queryTerm: "Tema 1118 RE 1298647 onus da prova fiscalizacao",
    };
  }

  return null;
}

export function normalizeTstCatalogId(idOrRef: string): string {
  const parsed = parseTstNormativeRef(idOrRef);
  if (parsed) return parsed.canonicalId;
  return String(idOrRef || "").trim().toUpperCase();
}

export function matchesTstNormativeAlias(hitId: string, query: string): boolean {
  const refFromHit = parseTstNormativeRef(hitId);
  if (!refFromHit) return false;
  const refFromQuery = parseTstNormativeRef(query);
  if (refFromQuery && refFromQuery.canonicalId === refFromHit.canonicalId) {
    return true;
  }
  const normQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (refFromHit.kind === "SUM" && refFromHit.numero === "331") {
    return /sumula\s*331|terceirizac|subsidiaria|culpa\s+in\s+vigilando/.test(normQuery);
  }
  if (refFromHit.kind === "OJ" && refFromHit.numero === "191") {
    return /oj\s*191|dono\s+da\s+obra|empreitada/.test(normQuery);
  }
  return normQuery.includes(refFromHit.numero);
}
