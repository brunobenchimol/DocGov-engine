// ============================================================================
// Núcleo Puro de Triagem e Compactação de Precedentes (0 I/O — v1.7.6)
// docgov-engine — src/tools/juris/precedent_triage_core.ts
// ============================================================================

import type { RawJurisSearchResult } from "./types.ts";

export interface TriageBucketItem {
  id: string;
  kind: string;
  year?: number;
  title: string;
}

export const DEFAULT_STOPWORDS_PT_LEGAL = new Set([
  "com", "sem", "para", "por", "dos", "das", "que", "uma", "uns", "nao", "sobre", "entre",
  "pela", "pelo", "pelas", "pelos", "como", "mais", "menos", "seja", "sao", "foi", "sera",
  "tribunal", "superior", "trabalho", "tst", "acordao", "decisao", "processo", "recurso",
  "lei", "art", "artigo", "publica", "publico", "administracao", "ente", "entes",
]);

export function asCleanText(val: unknown): string {
  if (typeof val === "string") return val.replace(/\s+/g, " ").trim();
  if (Array.isArray(val)) {
    return val.map((item) => asCleanText(item)).filter((s) => s.length > 0).join("; ");
  }
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return "";
}

export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function tokenizeNormalized(
  text: string,
  stopwords: Set<string> = DEFAULT_STOPWORDS_PT_LEGAL
): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const tok of normalizeText(text).match(/[a-z0-9]{3,}/g) || []) {
    if (stopwords.has(tok) || seen.has(tok)) continue;
    seen.add(tok);
    tokens.push(tok);
  }
  return tokens;
}

export function parseReliableYearValue(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    return raw >= 1940 && raw <= 2099 ? raw : undefined;
  }
  if (typeof raw === "boolean" || raw == null) return undefined;
  const trimmed = Array.isArray(raw)
    ? asCleanText(raw)
    : typeof raw === "string"
    ? raw.trim()
    : "";
  if (!trimmed) return undefined;
  const isoMatch = trimmed.match(/^((?:19|20)\d{2})(?:-\d{2}-\d{2}|$)/);
  if (isoMatch) return parseInt(isoMatch[1], 10);
  const brMatch = trimmed.match(/^\d{2}\/\d{2}\/((?:19|20)\d{2})(?:\s|$)/);
  return brMatch ? parseInt(brMatch[1], 10) : undefined;
}

export function extractReliableYear(
  hit: RawJurisSearchResult,
  extraDateFields: string[] = []
): number | undefined {
  const raw = hit.rawPayload || {};
  const candidates: unknown[] = [
    hit.dataSessao,
    raw.dtaJulgamento,
    raw.dtaPublicacao,
    raw.dataJulgamento,
    raw.dataPublicacao,
    ...extraDateFields.map((f) => raw[f]),
  ];
  for (const cand of candidates) {
    const parsed = parseReliableYearValue(cand);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

export function extractAssuntosText(raw: any): string {
  const arr = raw?.assuntos;
  if (!Array.isArray(arr)) return asCleanText(arr);
  return arr
    .map((a: any) =>
      typeof a === "string"
        ? a
        : asCleanText(a?.descricao || a?.desAssunto || a?.nome || a?.titulo)
    )
    .filter(Boolean)
    .join(" ");
}

export function tokenMatches(
  queryToken: string,
  hitTokens: string[],
  lexicalEquivalences: Record<string, string[]> = {}
): boolean {
  if (hitTokens.includes(queryToken)) return true;
  const eqs = lexicalEquivalences[queryToken];
  if (eqs && eqs.some((eq) => hitTokens.includes(eq))) return true;
  if (queryToken.length < 5) return false;
  const stem = queryToken.slice(0, 5);
  return hitTokens.some(
    (ht) => ht.startsWith(stem) || (ht.length >= 5 && queryToken.startsWith(ht.slice(0, 5)))
  );
}

export interface PertinenceFilterConfig {
  stopwords?: Set<string>;
  lexicalEquivalences?: Record<string, string[]>;
  hasBypass?: (query: string) => boolean;
  isExactMatch?: (hit: RawJurisSearchResult, query: string) => boolean;
  buildHaystack?: (hit: RawJurisSearchResult) => string;
}

function defaultBuildHaystack(hit: RawJurisSearchResult): string {
  const raw = hit.rawPayload || {};
  return [
    hit.id,
    hit.processo,
    hit.indexacao,
    hit.tese,
    hit.dispositivo,
    raw.titulo,
    raw.txtEmentaHighlight,
    extractAssuntosText(raw),
  ]
    .map((s) => asCleanText(s))
    .filter((s) => s.length > 0)
    .join(" ");
}

export function filterHitsByPertinence(
  hits: RawJurisSearchResult[],
  query: string,
  config: PertinenceFilterConfig = {}
): { kept: RawJurisSearchResult[]; filteredOut: RawJurisSearchResult[]; bypassApplied: boolean } {
  if (hits.length === 0) return { kept: [], filteredOut: [], bypassApplied: false };
  if (config.hasBypass?.(query)) return { kept: hits, filteredOut: [], bypassApplied: true };

  const stopwords = config.stopwords ?? DEFAULT_STOPWORDS_PT_LEGAL;
  const queryTokens = tokenizeNormalized(query, stopwords);
  if (queryTokens.length === 0) return { kept: hits, filteredOut: [], bypassApplied: true };

  const lexicalEq = config.lexicalEquivalences ?? {};
  const haystackFn = config.buildHaystack ?? defaultBuildHaystack;
  const kept: RawJurisSearchResult[] = [];
  const filteredOut: RawJurisSearchResult[] = [];

  for (const hit of hits) {
    if (config.isExactMatch?.(hit, query)) {
      kept.push(hit);
      continue;
    }
    const hitTokens = tokenizeNormalized(haystackFn(hit), stopwords);
    let matched = 0;
    let strongMatch = false;
    for (const qt of queryTokens) {
      if (tokenMatches(qt, hitTokens, lexicalEq)) {
        matched++;
        if (qt.length >= 8) strongMatch = true;
      }
    }
    const ratio = matched / queryTokens.length;
    const isRelevant =
      queryTokens.length <= 2 ? matched >= 1 : matched >= 2 || ratio >= 0.4 || strongMatch;
    if (isRelevant) kept.push(hit);
    else filteredOut.push(hit);
  }
  return { kept, filteredOut, bypassApplied: false };
}

export function buildShortTitle(hit: RawJurisSearchResult, maxLen: number = 90): string {
  const hitId = asCleanText(hit.id);
  const source =
    asCleanText(hit.indexacao) || asCleanText(hit.tese) || asCleanText(hit.processo) || hitId;
  if (!source) return hitId;
  return source.length > maxLen ? `${source.slice(0, maxLen - 3)}...` : source;
}

export function pushUniqueIds(
  target: string[],
  seen: Set<string>,
  ids: string[],
  skip?: Set<string>
): void {
  for (const id of ids) {
    const norm = id.toUpperCase();
    if (!seen.has(norm) && !skip?.has(norm)) {
      seen.add(norm);
      target.push(id);
    }
  }
}

export function trimTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title;
  return maxLen <= 3 ? title.slice(0, maxLen) : `${title.slice(0, maxLen - 3)}...`;
}

export function limitBucketsGeneric<K extends string>(
  order: readonly K[],
  source: Record<K, TriageBucketItem[]>,
  caps: Record<K, number>,
  titleMaxLen: number
): Record<K, TriageBucketItem[]> {
  const out = {} as Record<K, TriageBucketItem[]>;
  for (const key of order) {
    out[key] = source[key].slice(0, caps[key]).map((it) => ({
      ...it,
      title: trimTitle(it.title, titleMaxLen),
    }));
  }
  return out;
}

export function limitBucketsByPriorityGeneric<K extends string>(
  order: readonly K[],
  source: Record<K, TriageBucketItem[]>,
  maxTotal: number,
  titleMaxLen: number
): Record<K, TriageBucketItem[]> {
  const out = {} as Record<K, TriageBucketItem[]>;
  for (const key of order) out[key] = [];
  let remaining = maxTotal;
  for (const key of order) {
    if (remaining <= 0) break;
    const take = Math.min(source[key].length, remaining);
    out[key] = source[key].slice(0, take).map((it) => ({
      ...it,
      title: trimTitle(it.title, titleMaxLen),
    }));
    remaining -= take;
  }
  return out;
}
