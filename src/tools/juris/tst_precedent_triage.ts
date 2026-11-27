// ============================================================================
// Triagem Estruturada A/B de Precedentes Trabalhistas (Exclusiva TST)
// docgov-engine v1.7.6 — src/tools/juris/tst_precedent_triage.ts (< 260L, 0 I/O)
// ============================================================================

import type { RawJurisSearchResult, SearchJurisSyntheticResult } from "./types.ts";
import { matchesTstNormativeAlias } from "./providers/tst_catalog.ts";
import {
  asCleanText,
  buildShortTitle,
  extractReliableYear,
  filterHitsByPertinence,
  limitBucketsByPriorityGeneric,
  limitBucketsGeneric,
  normalizeText,
  pushUniqueIds,
  tokenizeNormalized,
  type TriageBucketItem,
} from "./precedent_triage_core.ts";

export { asCleanText, extractReliableYear, tokenizeNormalized };

export type TstTriageMode = "triaged" | "raw" | "compare";
export type TstPrecedentBucket =
  | "erga_omnes"
  | "orientativas"
  | "inter_partes"
  | "unclassified";

export type TstTriageItem = TriageBucketItem;
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
const UNIFORMIZING_COLEG_RULES: Array<{ rx: RegExp; kind: string }> = [
  { rx: /\bSBDI[-_\s]?1\b|\bSDI[-_\s]?1T?\b|SUBSE[ÇC][ÃA]O\s+I\s+ESPECIALIZADA/i, kind: "SBDI-1" },
  { rx: /\bSBDI[-_\s]?2\b|\bSDI[-_\s]?2\b|SUBSE[ÇC][ÃA]O\s+II\s+ESPECIALIZADA/i, kind: "SBDI-2" },
  { rx: /\bSDC\b|SE[ÇC][ÃA]O\s+ESPECIALIZADA\s+EM\s+DISS[ÍI]DIOS\s+COLETIVOS/i, kind: "SDC" },
  { rx: /[ÓO]RG[ÃA]O\s+ESPECIAL/i, kind: "ORGAO_ESPECIAL" },
  { rx: /TRIBUNAL\s+PLENO|\bPLENO\b/i, kind: "PLENO" },
];
const TST_LEXICAL_EQUIVALENCES: Record<string, string[]> = {
  teletrabalho: ["remoto", "home", "distancia", "virtual"],
  presencial: ["fisico", "sede", "estabelecimento"],
  retorno: ["reversao", "volta", "retornar"],
};

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

export function classifyTstHit(hit: RawJurisSearchResult): { bucket: TstPrecedentBucket; kind: string } {
  const raw = hit.rawPayload || {};
  const idAndClass = [
    hit.id, hit.processo, raw?.classeProcessual?.sigla, raw?.classeProcessual?.descricao, raw?.codClasse, raw?.tipo,
  ].map((v) => asCleanText(v)).filter((v) => v.length > 0).join(" ");
  const orgaoDesc = asCleanText(raw?.orgaoJudicante?.descricao);
  const colegiadoText = orgaoDesc.length > 0 ? orgaoDesc : asCleanText(hit.colegiado);
  const combinedMeta = `${idAndClass} ${colegiadoText}`.trim();

  if (/(?:^|[\s\-_/])(?:SV|SUMULA[-_\s]?VINCULANTE)(?:[\s\-_/]|$)/i.test(idAndClass)) return { bucket: "erga_omnes", kind: "SV" };
  if (/(?:TEMA[-_\s]?\d+|REPERCUSS[ÃA]O\s+GERAL|(?:^|[\s\-_/])RG(?:[\s\-_/]|$))/i.test(combinedMeta)) return { bucket: "erga_omnes", kind: "RG" };
  if (/(?:^|[\s\-_/])IRR(?:[\s\-_/]|$)/i.test(idAndClass)) return { bucket: "erga_omnes", kind: "IRR" };
  if (/(?:^|[\s\-_/])IAC(?:[\s\-_/]|$)/i.test(idAndClass)) return { bucket: "erga_omnes", kind: "IAC" };
  if (/(?:^|[\s\-_/])ARGINC(?:[\s\-_/]|$)/i.test(idAndClass)) return { bucket: "inter_partes", kind: "ARGINC" };
  if (/(?:^|[\s\-_/])(?:TST[-_\s]?)?S[ÚU]MULA(?:[-_\s]?TST)?[-_\s]?\d+/i.test(idAndClass)) return { bucket: "orientativas", kind: "SUMULA" };
  if (/(?:^|[\s\-_/])(?:TST[-_\s]?)?OJ\b/i.test(idAndClass)) return { bucket: "orientativas", kind: "OJ" };
  if (/(?:^|[\s\-_/])(?:Ag-E-RR|E-ED-RR|E-Ag-RR|E-RRAg|E-RR|E-AIRR|Emb-RR)(?:[\s\-_/]|$)/i.test(idAndClass)) {
    return { bucket: "orientativas", kind: "SBDI-1" };
  }
  if (colegiadoText) {
    for (const rule of UNIFORMIZING_COLEG_RULES) {
      if (rule.rx.test(colegiadoText)) return { bucket: "orientativas", kind: rule.kind };
    }
  }
  if (colegiadoText && /\b[1-8][ªa°º]?\s*TURMA\b/i.test(colegiadoText)) return { bucket: "inter_partes", kind: "TURMA" };
  if (/MONOCR[ÁA]TIC[AO]|DECIS[ÃA]O\s+MONOCR[ÁA]TICA|PRESID[ÊE]NCIA/i.test(combinedMeta)) return { bucket: "inter_partes", kind: "MONOCRATICA" };
  if (/(?:^|[\s\-_/])(?:Ag-AIRR|Ag-RR|Ag-RRAg|ED-RR|ED-AIRR|RRAg|AIRR|RR)(?:[\s\-_/]|$)/i.test(idAndClass)) {
    return { bucket: "inter_partes", kind: "TURMA" };
  }
  return { bucket: "unclassified", kind: "UNCLASSIFIED" };
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

function isTstNormativeExactMatch(hit: RawJurisSearchResult, query: string): boolean {
  const normQuery = normalizeText(query);
  const hitId = asCleanText(hit.id);
  if (hitId && normQuery.includes(normalizeText(hitId))) return true;
  return hitId ? matchesTstNormativeAlias(hitId, query) : false;
}

export function filterTstHitsByPertinence(
  hits: RawJurisSearchResult[],
  query: string
): { kept: RawJurisSearchResult[]; filteredOut: RawJurisSearchResult[]; bypassApplied: boolean } {
  return filterHitsByPertinence(hits, query, {
    lexicalEquivalences: TST_LEXICAL_EQUIVALENCES,
    hasBypass: hasExplicitNormativeBypass,
    isExactMatch: isTstNormativeExactMatch,
  });
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
      id: asCleanText(hit.id),
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
            raw_top_ids: hits.slice(0, 5).map((h) => asCleanText(h.id)),
            filtered_out_ids: filteredOut.map((h) => asCleanText(h.id)),
          },
        }
      : {}),
  };
  return { keptHits: kept, triage };
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
  const filteredOutCount = mode === "compare" ? filteredOutIds.length : results.reduce((acc, r) => acc + r.counts.filtered_out, 0);
  const counts = buildCounts(buckets, filteredOutCount);
  const keptTotal = counts.erga_omnes + counts.orientativas + counts.inter_partes + counts.unclassified;
  return {
    mode,
    counts,
    buckets,
    ...(mode === "compare" ? { raw_diff: { raw_total: keptTotal + filteredOutIds.length, raw_top_ids: rawTopIds.slice(0, 5), filtered_out_ids: filteredOutIds } } : {}),
  };
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

  payload.top_hits = [];
  payload.statutory_bridge_applied = payload.statutory_bridge_applied.slice(0, 1);
  payload.tst_triage.buckets = limitBucketsGeneric(BUCKET_ORDER, fullBuckets, { erga_omnes: 2, orientativas: 2, inter_partes: 1, unclassified: 1 }, 36);
  if (fullRawDiff) {
    payload.tst_triage.raw_diff = { raw_total: fullRawDiff.raw_total, raw_top_ids: fullRawDiff.raw_top_ids.slice(0, 3), filtered_out_ids: fullRawDiff.filtered_out_ids.slice(0, 3) };
  }
  if (byteSize() <= maxBytes) return;

  payload.statutory_bridge_applied = [];
  if (payload.live_degraded?.length) payload.live_degraded = ["TST(ttl_cache;force_live=true)"];
  payload.next_step_hint = (isCompare && hasFiltered) || relMd.length > 48 ? "Ver results_md" : `Consulte ${relMd}`;
  if (byteSize() <= maxBytes) return;

  payload.tst_triage.buckets = limitBucketsGeneric(BUCKET_ORDER, fullBuckets, { erga_omnes: 1, orientativas: 1, inter_partes: 1, unclassified: 1 }, 20);
  if (fullRawDiff && payload.tst_triage.raw_diff) {
    payload.tst_triage.raw_diff = { raw_total: fullRawDiff.raw_total, raw_top_ids: fullRawDiff.raw_top_ids.slice(0, isCompare && hasFiltered ? 1 : 2), filtered_out_ids: fullRawDiff.filtered_out_ids.slice(0, 2) };
  }
  if (byteSize() <= maxBytes) return;

  payload.tst_triage.buckets = limitBucketsByPriorityGeneric(BUCKET_ORDER, fullBuckets, 2, 14);
  if (fullRawDiff && payload.tst_triage.raw_diff) {
    payload.tst_triage.raw_diff = { raw_total: fullRawDiff.raw_total, raw_top_ids: isCompare && hasFiltered ? [] : fullRawDiff.raw_top_ids.slice(0, 1), filtered_out_ids: fullRawDiff.filtered_out_ids.slice(0, hasFiltered ? 2 : 0) };
  }
  if (byteSize() <= maxBytes) return;

  payload.next_step_hint = "Ver results_md";
  if (isCompare && hasFiltered) {
    payload.tst_triage.buckets = emptyBuckets();
    if (fullRawDiff) payload.tst_triage.raw_diff = { raw_total: fullRawDiff.raw_total, raw_top_ids: [], filtered_out_ids: fullRawDiff.filtered_out_ids.slice(0, 1) };
    if (byteSize() <= maxBytes) return;
  } else {
    payload.tst_triage.buckets = limitBucketsByPriorityGeneric(BUCKET_ORDER, fullBuckets, 1, 12);
    if (byteSize() <= maxBytes) return;
    payload.tst_triage.buckets = emptyBuckets();
    if (byteSize() <= maxBytes) return;
  }

  if (fullRawDiff && payload.tst_triage.raw_diff) {
    if (hasFiltered && payload.tst_triage.raw_diff.filtered_out_ids.length > 0) {
      payload.tst_triage.raw_diff.filtered_out_ids = [payload.tst_triage.raw_diff.filtered_out_ids[0].slice(0, 20)];
      if (byteSize() <= maxBytes) return;
    }
    payload.tst_triage.raw_diff = { raw_total: fullRawDiff.raw_total, raw_top_ids: [], filtered_out_ids: [] };
  }
}
