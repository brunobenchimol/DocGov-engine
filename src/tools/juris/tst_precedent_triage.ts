// ============================================================================
// Triagem Estruturada A/B de Precedentes Trabalhistas (Exclusiva TST)
// docgov-engine — src/tools/juris/tst_precedent_triage.ts (Módulo Puro, 0 I/O)
// ============================================================================

import type { RawJurisSearchResult, SearchJurisSyntheticResult } from "./types.ts";
import { getTstCatalogItemById } from "./providers/tst_catalog.ts";

export type TstTriageMode = "triaged" | "raw" | "compare";
export type TstPrecedentBucket =
  | "erga_omnes"
  | "orientativas"
  | "inter_partes"
  | "unclassified";

export interface TstTriageItem { id: string; kind: string; year?: number; title: string; }
export interface TstTriageCounts {
  erga_omnes: number; orientativas: number; inter_partes: number; unclassified: number; filtered_out: number;
}
export interface TstTriageBuckets {
  erga_omnes: TstTriageItem[]; orientativas: TstTriageItem[]; inter_partes: TstTriageItem[]; unclassified: TstTriageItem[];
}
export interface TstRawDiff { raw_total: number; raw_top_ids: string[]; filtered_out_ids: string[]; }
export interface TstTriageResult {
  mode: "triaged" | "compare"; counts: TstTriageCounts; buckets: TstTriageBuckets; raw_diff?: TstRawDiff;
}

const BUCKET_ORDER: TstPrecedentBucket[] = ["erga_omnes", "orientativas", "inter_partes", "unclassified"];

const STOPWORDS_PT_LEGAL = new Set([
  "com", "sem", "para", "por", "dos", "das", "que", "uma", "uns", "nao", "sobre", "entre",
  "pela", "pelo", "pelas", "pelos", "como", "mais", "menos", "seja", "sao", "foi", "sera",
  "tribunal", "superior", "trabalho", "tst", "acordao", "decisao", "processo", "recurso",
  "lei", "art", "artigo", "publica", "publico", "administracao", "ente", "entes",
]);

const UNIFORMIZING_COLEG_RULES: Array<{ rx: RegExp; kind: string }> = [
  { rx: /\bSBDI[-_\s]?1\b|\bSDI[-_\s]?1T?\b|SUBSE[ÇC][ÃA]O\s+I\s+ESPECIALIZADA/i, kind: "SBDI-1" },
  { rx: /\bSBDI[-_\s]?2\b|\bSDI[-_\s]?2\b|SUBSE[ÇC][ÃA]O\s+II\s+ESPECIALIZADA/i, kind: "SBDI-2" },
  { rx: /\bSDC\b|SE[ÇC][ÃA]O\s+ESPECIALIZADA\s+EM\s+DISS[ÍI]DIOS\s+COLETIVOS/i, kind: "SDC" },
  { rx: /[ÓO]RG[ÃA]O\s+ESPECIAL/i, kind: "ORGAO_ESPECIAL" },
  { rx: /TRIBUNAL\s+PLENO|\bPLENO\b/i, kind: "PLENO" },
];

function emptyBuckets(): TstTriageBuckets {
  return { erga_omnes: [], orientativas: [], inter_partes: [], unclassified: [] };
}

function buildCounts(buckets: TstTriageBuckets, filteredOutCount: number): TstTriageCounts {
  return {
    erga_omnes: buckets.erga_omnes.length,
    orientativas: buckets.orientativas.length,
    inter_partes: buckets.inter_partes.length,
    unclassified: buckets.unclassified.length,
    filtered_out: filteredOutCount,
  };
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getStructuredFields(hit: RawJurisSearchResult): { idAndClass: string; colegiadoText: string } {
  const raw = hit.rawPayload || {};
  const idAndClass = [
    hit.id,
    hit.processo,
    raw?.classeProcessual?.sigla,
    raw?.classeProcessual?.descricao,
    raw?.codClasse,
    raw?.tipo,
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" ");

  const orgaoDesc = raw?.orgaoJudicante?.descricao;
  const col =
    typeof orgaoDesc === "string" && orgaoDesc.trim().length > 0
      ? orgaoDesc
      : typeof hit.colegiado === "string"
        ? hit.colegiado
        : "";

  return { idAndClass, colegiadoText: col.trim() };
}

export function classifyTstHit(hit: RawJurisSearchResult): { bucket: TstPrecedentBucket; kind: string } {
  const { idAndClass, colegiadoText } = getStructuredFields(hit);
  const combinedMeta = `${idAndClass} ${colegiadoText}`.trim();

  // 1. erga_omnes (exclusivamente SV, RG, IRR, IAC — NUNCA ArgInc)
  if (/(?:^|[\s\-_/])(?:SV|SUMULA[-_\s]?VINCULANTE)(?:[\s\-_/]|$)/i.test(idAndClass)) {
    return { bucket: "erga_omnes", kind: "SV" };
  }
  if (/(?:TEMA[-_\s]?\d+|REPERCUSS[ÃA]O\s+GERAL|(?:^|[\s\-_/])RG(?:[\s\-_/]|$))/i.test(combinedMeta)) {
    return { bucket: "erga_omnes", kind: "RG" };
  }
  if (/(?:^|[\s\-_/])IRR(?:[\s\-_/]|$)/i.test(idAndClass)) {
    return { bucket: "erga_omnes", kind: "IRR" };
  }
  if (/(?:^|[\s\-_/])IAC(?:[\s\-_/]|$)/i.test(idAndClass)) {
    return { bucket: "erga_omnes", kind: "IAC" };
  }

  // 2. ArgInc -> inter_partes ANTES de Pleno/Orgao Especial (Ajuste #1)
  if (/(?:^|[\s\-_/])ARGINC(?:[\s\-_/]|$)/i.test(idAndClass)) {
    return { bucket: "inter_partes", kind: "ARGINC" };
  }

  // 3. orientativas (Sumula comum, OJ, Embargos SBDI-1 e colegiados uniformizadores)
  if (/(?:^|[\s\-_/])(?:TST[-_\s]?)?S[ÚU]MULA(?:[-_\s]?TST)?[-_\s]?\d+/i.test(idAndClass)) {
    return { bucket: "orientativas", kind: "SUMULA" };
  }
  if (/(?:^|[\s\-_/])(?:TST[-_\s]?)?OJ\b/i.test(idAndClass)) {
    return { bucket: "orientativas", kind: "OJ" };
  }
  // Protecao de classes de Embargos (Ajuste #2 — antes de RR/AIRR, mesmo sem colegiado)
  if (/(?:^|[\s\-_/])(?:Ag-E-RR|E-ED-RR|E-Ag-RR|E-RRAg|E-RR|E-AIRR|Emb-RR)(?:[\s\-_/]|$)/i.test(idAndClass)) {
    return { bucket: "orientativas", kind: "SBDI-1" };
  }
  if (colegiadoText) {
    for (const rule of UNIFORMIZING_COLEG_RULES) {
      if (rule.rx.test(colegiadoText)) return { bucket: "orientativas", kind: rule.kind };
    }
  }

  // 4. inter_partes (Turmas 1a-8a, monocromaticas e classes recursais)
  if (colegiadoText && /\b[1-8][ªa°º]?\s*TURMA\b/i.test(colegiadoText)) {
    return { bucket: "inter_partes", kind: "TURMA" };
  }
  if (/MONOCR[ÁA]TIC[AO]|DECIS[ÃA]O\s+MONOCR[ÁA]TICA|PRESID[ÊE]NCIA/i.test(combinedMeta)) {
    return { bucket: "inter_partes", kind: "MONOCRATICA" };
  }
  if (/(?:^|[\s\-_/])(?:Ag-AIRR|Ag-RR|Ag-RRAg|ED-RR|ED-AIRR|RRAg|AIRR|RR)(?:[\s\-_/]|$)/i.test(idAndClass)) {
    return { bucket: "inter_partes", kind: "TURMA" };
  }

  // 5. Fallback defensivo: nunca chutar balde nem aceitar string generica "Turma"
  return { bucket: "unclassified", kind: "UNCLASSIFIED" };
}

function parseReliableYearValue(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    return raw >= 1940 && raw <= 2099 ? raw : undefined;
  }
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const isoMatch = trimmed.match(/^((?:19|20)\d{2})(?:-\d{2}-\d{2}|$)/);
  if (isoMatch) return parseInt(isoMatch[1], 10);
  const brMatch = trimmed.match(/^\d{2}\/\d{2}\/((?:19|20)\d{2})(?:\s|$)/);
  return brMatch ? parseInt(brMatch[1], 10) : undefined;
}

export function extractReliableYear(hit: RawJurisSearchResult): number | undefined {
  const raw = hit.rawPayload || {};
  const candidates = [
    hit.dataSessao,
    raw.dtaJulgamento,
    raw.dtaPublicacao,
    raw.dataJulgamento,
    raw.dataPublicacao,
  ];
  for (const cand of candidates) {
    const parsed = parseReliableYearValue(cand);
    if (parsed !== undefined) return parsed;
  }
  const isCurated = hit.origin === "CURATED_CATALOG" || raw.curated === true;
  return isCurated && typeof hit.ano === "number" ? parseReliableYearValue(hit.ano) : undefined;
}

export function tokenizeNormalized(text: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const tok of normalizeText(text).match(/[a-z0-9]{3,}/g) || []) {
    if (STOPWORDS_PT_LEGAL.has(tok) || seen.has(tok)) continue;
    seen.add(tok);
    tokens.push(tok);
  }
  return tokens;
}

function hasExplicitNormativeBypass(query: string): boolean {
  return (
    /\bs[úu]mula\s*(?:vinculante\s*)?(?:n[º°o]\s*)?\d+/i.test(query) ||
    /\boj\s*(?:n[º°o]\s*)?\d+/i.test(query) ||
    /\birr\s*(?:n[º°o]\s*)?\d+/i.test(query) ||
    /\btema\s*(?:n[º°o]\s*)?\d[\d.]*/i.test(query) ||
    /\b\d{1,7}-\d{2}\.\d{4}\.5\.\d{2}\.\d{4}\b/.test(query) ||
    /\b\d{7}\d{2}(?:19|20)\d{2}5\d{2}\d{4}\b/.test(query)
  );
}

function isCuratedExactMatch(hit: RawJurisSearchResult, query: string): boolean {
  const normQuery = normalizeText(query);
  if (hit.id && normQuery.includes(normalizeText(hit.id))) return true;
  const catItem = getTstCatalogItemById(hit.id);
  if (!catItem) return false;
  if (hit.origin === "CURATED_CATALOG" || hit.rawPayload?.curated === true) {
    return catItem.keywords.some((rx) => rx.test(query)) || normQuery.includes(normalizeText(catItem.numero));
  }
  return catItem.keywords.some((rx) => rx.test(query));
}

function tokenMatches(queryToken: string, hitTokens: string[]): boolean {
  if (hitTokens.includes(queryToken)) return true;
  if (queryToken.length < 5) return false;
  const stem = queryToken.slice(0, 5);
  return hitTokens.some((ht) => ht.startsWith(stem) || (ht.length >= 5 && queryToken.startsWith(ht.slice(0, 5))));
}

export function filterTstHitsByPertinence(
  hits: RawJurisSearchResult[],
  query: string
): { kept: RawJurisSearchResult[]; filteredOut: RawJurisSearchResult[]; bypassApplied: boolean } {
  if (hits.length === 0) return { kept: [], filteredOut: [], bypassApplied: false };
  if (hasExplicitNormativeBypass(query)) return { kept: hits, filteredOut: [], bypassApplied: true };

  const queryTokens = tokenizeNormalized(query);
  if (queryTokens.length === 0) return { kept: hits, filteredOut: [], bypassApplied: true };

  const kept: RawJurisSearchResult[] = [];
  const filteredOut: RawJurisSearchResult[] = [];

  for (const hit of hits) {
    if (isCuratedExactMatch(hit, query)) {
      kept.push(hit);
      continue;
    }
    const haystack = [hit.id, hit.processo, hit.indexacao, hit.tese, hit.dispositivo]
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .join(" ");
    const hitTokens = tokenizeNormalized(haystack);

    let matched = 0;
    for (const qt of queryTokens) {
      if (tokenMatches(qt, hitTokens)) matched++;
    }
    const ratio = matched / queryTokens.length;
    const isRelevant =
      queryTokens.length <= 2 ? matched >= 1 : matched >= 2 || ratio >= 0.4;

    if (isRelevant) kept.push(hit);
    else filteredOut.push(hit);
  }
  return { kept, filteredOut, bypassApplied: false };
}

function buildShortTitle(hit: RawJurisSearchResult, maxLen: number = 90): string {
  const source = (hit.indexacao || hit.tese || hit.processo || hit.id || "").replace(/\s+/g, " ").trim();
  if (!source) return hit.id;
  return source.length > maxLen ? `${source.slice(0, maxLen - 3)}...` : source;
}

export function triageTstPrecedents(
  hits: RawJurisSearchResult[],
  query: string,
  mode: "triaged" | "compare"
): { keptHits: RawJurisSearchResult[]; triage: TstTriageResult } {
  const { kept, filteredOut } = filterTstHitsByPertinence(hits, query);
  const buckets = emptyBuckets();

  for (const hit of kept) {
    const { bucket, kind } = classifyTstHit(hit);
    const year = extractReliableYear(hit);
    buckets[bucket].push({
      id: hit.id,
      kind,
      ...(year !== undefined ? { year } : {}),
      title: buildShortTitle(hit, 90),
    });
  }

  const triage: TstTriageResult = {
    mode,
    counts: buildCounts(buckets, filteredOut.length),
    buckets,
    ...(mode === "compare"
      ? {
          raw_diff: {
            raw_total: hits.length,
            raw_top_ids: hits.slice(0, 5).map((h) => h.id),
            filtered_out_ids: filteredOut.map((h) => h.id),
          },
        }
      : {}),
  };
  return { keptHits: kept, triage };
}

function pushUniqueIds(target: string[], seen: Set<string>, ids: string[], skip?: Set<string>): void {
  for (const id of ids) {
    const norm = id.toUpperCase();
    if (!seen.has(norm) && !skip?.has(norm)) { seen.add(norm); target.push(id); }
  }
}

export function mergeTstTriageResults(results: TstTriageResult[], mode: "triaged" | "compare"): TstTriageResult {
  const keptIds = new Set<string>();
  const buckets = emptyBuckets();
  for (const res of results) {
    for (const bKey of BUCKET_ORDER) {
      for (const item of res.buckets[bKey]) {
        const normId = item.id.toUpperCase();
        if (!keptIds.has(normId)) { keptIds.add(normId); buckets[bKey].push({ ...item }); }
      }
    }
  }

  const rawTopIds: string[] = [];
  const rawTopSeen = new Set<string>();
  const filteredOutIds: string[] = [];
  const filteredSeen = new Set<string>();
  for (const res of results) {
    if (!res.raw_diff) continue;
    pushUniqueIds(rawTopIds, rawTopSeen, res.raw_diff.raw_top_ids);
    pushUniqueIds(filteredOutIds, filteredSeen, res.raw_diff.filtered_out_ids, keptIds);
  }

  const filteredOutCount = mode === "compare"
    ? filteredOutIds.length
    : results.reduce((acc, r) => acc + r.counts.filtered_out, 0);
  const counts = buildCounts(buckets, filteredOutCount);
  const keptTotal = counts.erga_omnes + counts.orientativas + counts.inter_partes + counts.unclassified;

  return {
    mode,
    counts,
    buckets,
    ...(mode === "compare"
      ? { raw_diff: { raw_total: keptTotal + filteredOutIds.length, raw_top_ids: rawTopIds.slice(0, 5), filtered_out_ids: filteredOutIds } }
      : {}),
  };
}

function trimTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title;
  return maxLen <= 3 ? title.slice(0, maxLen) : `${title.slice(0, maxLen - 3)}...`;
}

function limitBuckets(
  source: TstTriageBuckets,
  caps: Record<TstPrecedentBucket, number>,
  titleMaxLen: number
): TstTriageBuckets {
  const out = emptyBuckets();
  for (const key of BUCKET_ORDER) {
    out[key] = source[key].slice(0, caps[key]).map((it) => ({
      ...it,
      title: trimTitle(it.title, titleMaxLen),
    }));
  }
  return out;
}

function limitBucketsByPriority(
  source: TstTriageBuckets,
  maxTotal: number,
  titleMaxLen: number
): TstTriageBuckets {
  const out = emptyBuckets();
  let remaining = maxTotal;
  for (const key of BUCKET_ORDER) {
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

export function compactTstTriageToBudget(
  payload: SearchJurisSyntheticResult,
  relMd: string,
  maxBytes: number = 880
): void {
  if (!payload.tst_triage) return;
  const fullBuckets = payload.tst_triage.buckets;
  const fullRawDiff = payload.tst_triage.raw_diff;
  const isCompare = payload.tst_triage.mode === "compare";
  const hasFiltered = payload.tst_triage.counts.filtered_out > 0;
  const byteSize = () => Buffer.byteLength(JSON.stringify(payload), "utf-8");

  // Estágio 0: top_hits vazio (substituído por buckets), previews iniciais
  payload.top_hits = [];
  payload.statutory_bridge_applied = payload.statutory_bridge_applied.slice(0, 1);
  payload.tst_triage.buckets = limitBuckets(
    fullBuckets,
    { erga_omnes: 2, orientativas: 2, inter_partes: 1, unclassified: 1 },
    36
  );
  if (fullRawDiff) {
    payload.tst_triage.raw_diff = {
      raw_total: fullRawDiff.raw_total,
      raw_top_ids: fullRawDiff.raw_top_ids.slice(0, 3),
      filtered_out_ids: fullRawDiff.filtered_out_ids.slice(0, 3),
    };
  }
  if (byteSize() <= maxBytes) return;

  // Estágio 1: limpar bridge, compactar live_degraded e hint (Ajuste #4)
  payload.statutory_bridge_applied = [];
  if (payload.live_degraded?.length) payload.live_degraded = ["TST(curated;force_live=true)"];
  payload.next_step_hint =
    (isCompare && hasFiltered) || relMd.length > 48 ? "Ver results_md" : `Consulte ${relMd}`;
  if (byteSize() <= maxBytes) return;

  // Estágio 2: 1 item/balde, title <= 20; em compare c/ filtered_out > 0 sacrifica raw_top_ids antes de filtered_out_ids
  payload.tst_triage.buckets = limitBuckets(
    fullBuckets,
    { erga_omnes: 1, orientativas: 1, inter_partes: 1, unclassified: 1 },
    20
  );
  if (fullRawDiff && payload.tst_triage.raw_diff) {
    payload.tst_triage.raw_diff = {
      raw_total: fullRawDiff.raw_total,
      raw_top_ids: fullRawDiff.raw_top_ids.slice(0, isCompare && hasFiltered ? 1 : 2),
      filtered_out_ids: fullRawDiff.filtered_out_ids.slice(0, 2),
    };
  }
  if (byteSize() <= maxBytes) return;

  // Estágio 3: máx 2 itens totais; em compare c/ filtered_out > 0 zera raw_top_ids antes de filtered_out_ids
  payload.tst_triage.buckets = limitBucketsByPriority(fullBuckets, 2, 14);
  if (fullRawDiff && payload.tst_triage.raw_diff) {
    payload.tst_triage.raw_diff = {
      raw_total: fullRawDiff.raw_total,
      raw_top_ids: isCompare && hasFiltered ? [] : fullRawDiff.raw_top_ids.slice(0, 1),
      filtered_out_ids: fullRawDiff.filtered_out_ids.slice(0, hasFiltered ? 2 : 0),
    };
  }
  if (byteSize() <= maxBytes) return;

  // Estágio 4: esvazia buckets em compare antes de reduzir filtered_out_ids < 1 (Ajuste #4)
  payload.next_step_hint = "Ver results_md";
  if (isCompare && hasFiltered) {
    payload.tst_triage.buckets = emptyBuckets();
    if (fullRawDiff) {
      payload.tst_triage.raw_diff = {
        raw_total: fullRawDiff.raw_total,
        raw_top_ids: [],
        filtered_out_ids: fullRawDiff.filtered_out_ids.slice(0, 1),
      };
    }
    if (byteSize() <= maxBytes) return;
  } else {
    payload.tst_triage.buckets = limitBucketsByPriority(fullBuckets, 1, 12);
    if (byteSize() <= maxBytes) return;
    payload.tst_triage.buckets = emptyBuckets();
    if (byteSize() <= maxBytes) return;
  }

  // Estágio 5: piso extremo garantindo < maxBytes (< 900B)
  if (fullRawDiff && payload.tst_triage.raw_diff) {
    if (hasFiltered && payload.tst_triage.raw_diff.filtered_out_ids.length > 0) {
      payload.tst_triage.raw_diff.filtered_out_ids = [
        payload.tst_triage.raw_diff.filtered_out_ids[0].slice(0, 20),
      ];
      if (byteSize() <= maxBytes) return;
    }
    payload.tst_triage.raw_diff = { raw_total: fullRawDiff.raw_total, raw_top_ids: [], filtered_out_ids: [] };
  }
}
