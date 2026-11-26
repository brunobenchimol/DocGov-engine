// ============================================================================
// 9ª Ferramenta MCP: search_juris (CLI --search-juris)
// Busca Multi-Query Sob Demanda em APIs Oficiais de Controle Externo
// ============================================================================

import { existsSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { VERSION } from "../../constants/index.ts";
import { createJurisSearchContractError } from "../../contracts/errors.ts";
import { resolveEphemeralTargetDir } from "../../utils/ephemeral_scope.ts";
import {
  defaultJurisdictionRegistry,
  JurisdictionProviderRegistry,
} from "./provider_registry.ts";
import { expandQueryWithStatutoryBridge } from "./statutory_bridge.ts";
import { scoreJurisItem } from "./relevance_scorer.ts";
import {
  compactTstTriageToBudget,
  mergeTstTriageResults,
  type TstTriageResult,
} from "./tst_precedent_triage.ts";
import {
  buildLiveDegradedNotices,
  makeJurisDedupeKey,
  persistAccumulatedJurisSearch,
} from "./juris_search_store.ts";
import type {
  SearchJurisOptions,
  SearchJurisSyntheticResult,
  SearchJurisFileResult,
  JurisSearchResultItem,
  JurisSourceMode,
} from "./types.ts";

export async function searchJuris(
  options: SearchJurisOptions,
  registry: JurisdictionProviderRegistry = defaultJurisdictionRegistry
): Promise<{
  fileResult: SearchJurisFileResult;
  currentHits: JurisSearchResultItem[];
  jsonPath: string;
  mdPath: string;
}> {
  const qStr = options?.query || (options as any)?.queries;
  if (!options || !qStr || typeof qStr !== "string") {
    throw createJurisSearchContractError("Parâmetro 'query' ausente ou inválido.");
  }

  const rawQueries = qStr
    .split("|")
    .map((q: string) => q.trim())
    .filter((q: string) => q.length > 0);

  if (rawQueries.length === 0) {
    throw createJurisSearchContractError("Query de busca vazia.");
  }

  const stance = options.stance || "NEUTRAL";
  const regime = options.regime || "AUTO";
  const limit = options.limit || 10;

  // 1. Roteamento Jurisdicional e Graceful Fallback
  const { selectedProviders, routingInfo } = (registry || defaultJurisdictionRegistry).resolveRouting(
    options.courts,
    options.uf,
    qStr,
    options.sphere
  );

  // 2. Expansão via Statutory Bridge
  const allBridgeDescriptions = new Set<string>();
  for (const q of rawQueries) {
    const bridge = expandQueryWithStatutoryBridge(q, regime);
    for (const desc of bridge.appliedBridgeDescriptions) {
      allBridgeDescriptions.add(desc);
    }
  }
  const appliedBridges = Array.from(allBridgeDescriptions);

  // 3. Execução paralela por provedor com telemetria determinística (court_diagnostics)
  const courtDiagnostics: import("./types.ts").CourtDiagnostic[] = [];
  const rawHits: Array<{ raw: any; matchedQuery: string }> = [];
  const tstTriageParts: TstTriageResult[] = [];

  const providerTasks = selectedProviders.map(async (prov) => {
    const provStart = Date.now();
    let provHitsCount = 0;
    let provError: string | null = null;
    let provLiveError: string | null = null;
    let provSourceMode: JurisSourceMode | undefined;
    let provCacheHit = false;
    let provFetchedAt: string | undefined;
    let provStatus: "ok" | "error" = "ok";
    const isTst = prov.courtId === "TST";

    try {
      for (const q of rawQueries) {
        if (prov.searchWithDiagnostic) {
          const res = await prov.searchWithDiagnostic(q, {
            limit,
            colegiado: options.colegiado,
            force_live: options.force_live,
            ...(isTst && options.triage_mode ? { triage_mode: options.triage_mode } : {}),
          });
          for (const h of res.hits) {
            rawHits.push({ raw: h, matchedQuery: q });
          }
          provHitsCount += res.hits.length;
          if (isTst && res.tst_triage) {
            tstTriageParts.push(res.tst_triage);
          }
          if (res.diagnostic.status === "error") {
            provStatus = "error";
            if (!provError) provError = res.diagnostic.error;
          }
          if (res.diagnostic.live_error && !provLiveError) {
            provLiveError = res.diagnostic.live_error;
          }
          if (res.diagnostic.cache_hit) {
            provCacheHit = true;
            if (!provFetchedAt && res.diagnostic.fetched_at) {
              provFetchedAt = res.diagnostic.fetched_at;
            }
          }
          if (res.diagnostic.source_mode) {
            if (
              !provSourceMode ||
              res.diagnostic.source_mode === "CURATED_FALLBACK" ||
              res.diagnostic.source_mode === "CIRCUIT_OPEN_FALLBACK" ||
              res.diagnostic.source_mode === "LIVE_FAILED"
            ) {
              provSourceMode = res.diagnostic.source_mode;
            }
          }
        } else {
          const hits = await prov.search(q, {
            limit,
            colegiado: options.colegiado,
            force_live: options.force_live,
          });
          for (const h of hits) {
            rawHits.push({ raw: h, matchedQuery: q });
          }
          provHitsCount += hits.length;
          provSourceMode = provSourceMode || "LIVE";
        }
      }
    } catch (err: any) {
      provStatus = "error";
      provError = err?.message || String(err);
      provLiveError = provError;
      provSourceMode = "LIVE_FAILED";
    }

    const latency = Date.now() - provStart;
    if (provError && provHitsCount === 0) {
      provStatus = "error";
    }

    courtDiagnostics.push({
      court: prov.courtId,
      status: provStatus,
      hits: provHitsCount,
      latency_ms: latency,
      error: provError,
      source_mode: provSourceMode,
      live_error: provLiveError,
      ...(provCacheHit ? { cache_hit: true, ...(provFetchedAt ? { fetched_at: provFetchedAt } : {}) } : {}),
    });
  });

  await Promise.all(providerTasks);

  let finalTstTriage: TstTriageResult | undefined;
  if (tstTriageParts.length === 1) {
    finalTstTriage = tstTriageParts[0];
  } else if (tstTriageParts.length > 1) {
    finalTstTriage = mergeTstTriageResults(tstTriageParts, tstTriageParts[0].mode);
  }

  // 4. Desduplicação da Rodada Atual e Cálculo Determinístico do Score (0..100)
  const hitMap = new Map<string, JurisSearchResultItem>();

  for (const { raw, matchedQuery } of rawHits) {
    if (!raw || !raw.id) continue;
    const dedupeKey = makeJurisDedupeKey({ court: raw.court, id: raw.id });
    const existing = hitMap.get(dedupeKey);

    if (!existing) {
      const scoring = scoreJurisItem(raw, matchedQuery || rawQueries.join(" "), {
        stance,
        regime,
      });
      const teseClean = (raw.tese || "").replace(/\s+/g, " ").trim();
      const teseShort = teseClean.length > 180 ? `${teseClean.slice(0, 177)}...` : teseClean;

      const scoredItem: JurisSearchResultItem = {
        id: raw.id,
        court: raw.court,
        colegiado: raw.colegiado,
        numero: raw.numero,
        ano: raw.ano,
        processo: raw.processo,
        relator: raw.relator,
        dataSessao: raw.dataSessao,
        entidade: raw.entidade,
        indexacao: raw.indexacao,
        tese: teseClean,
        tese_short: teseShort,
        dispositivo: raw.dispositivo,
        outcome: scoring.outcome,
        stance_alignment: scoring.stance_alignment,
        relevance_score: scoring.relevance_score,
        score: scoring.score,
        origin: raw.origin || "LIVE",
        statutory_bridge_refs: scoring.statutoryBridgeRefs,
        matched_queries: [matchedQuery],
      };

      hitMap.set(dedupeKey, scoredItem);
    } else {
      const prevQueries = existing.matched_queries || [];
      if (matchedQuery && !prevQueries.includes(matchedQuery)) {
        existing.matched_queries = [...prevQueries, matchedQuery];
      }
      const rescoring = scoreJurisItem(raw, matchedQuery, { stance, regime });
      if (rescoring.relevance_score > existing.relevance_score) {
        existing.relevance_score = rescoring.relevance_score;
        existing.score = rescoring.score;
        existing.outcome = rescoring.outcome;
        existing.stance_alignment = rescoring.stance_alignment;
      }
    }
  }

  // Ordena rodada atual por relevance_score decrescente
  const currentHits = Array.from(hitMap.values()).sort(
    (a, b) => b.relevance_score - a.relevance_score
  );

  // 5. Determinação de Destino no Disco (com Whitelist ENG-10 e Preservação Efêmera Nomeada)
  const { targetDir, isEphemeral } = resolveEphemeralTargetDir({
    caseDir: options.caseDir,
    prefix: "juris_search",
    appendStateIfCase: true,
    appendStateIfNamedEphemeral: false,
  });

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const persisted = await persistAccumulatedJurisSearch({
    targetDir,
    isEphemeral,
    currentHits,
    currentRound: {
      engine_version: VERSION,
      timestamp: new Date().toISOString(),
      query: qStr,
      queries_executed: rawQueries,
      stance,
      regime,
      total_hits: currentHits.length,
      statutory_bridge_applied: appliedBridges,
      normative_bridge: appliedBridges,
      jurisdiction_routing: routingInfo,
      court_diagnostics: courtDiagnostics,
      ...(finalTstTriage ? { tst_triage: finalTstTriage } : {}),
      results: currentHits,
    },
  });

  return {
    fileResult: persisted.fileResult,
    currentHits,
    jsonPath: persisted.jsonPath,
    mdPath: persisted.mdPath,
  };
}

/**
 * Formata o retorno sintético MCP estritamente abaixo de 900 bytes (Lei 2).
 */
export function formatSearchJurisSyntheticResult(
  fileResult: SearchJurisFileResult,
  mdPath: string,
  baseDir: string = process.cwd(),
  currentHits?: JurisSearchResultItem[]
): SearchJurisSyntheticResult {
  const relMd = relative(baseDir, mdPath).replace(/\\/g, "/") || mdPath;
  const roundSource = currentHits ?? fileResult.results;

  const topHits = roundSource.slice(0, 3).map((h) => ({
    id: h.id,
    court: h.court,
    score: h.relevance_score,
    relevance_score: h.relevance_score,
    outcome: h.outcome || "DECISAO",
    tese_short: (h.tese_short || h.tese || "").slice(0, 110),
  }));

  const liveDegraded = buildLiveDegradedNotices(fileResult.court_diagnostics);

  const payload: SearchJurisSyntheticResult = {
    status: "success",
    engine_version: VERSION,
    queries_executed: fileResult.queries_executed.length,
    stance: fileResult.stance,
    regime: fileResult.regime,
    total_hits: fileResult.total_hits,
    total_accumulated: fileResult.total_accumulated ?? fileResult.results.length,
    statutory_bridge_applied: fileResult.statutory_bridge_applied.slice(0, 2),
    jurisdiction_routing: fileResult.jurisdiction_routing,
    ...(liveDegraded.length > 0 ? { live_degraded: liveDegraded } : {}),
    top_hits: topHits,
    ...(fileResult.tst_triage ? { tst_triage: structuredClone(fileResult.tst_triage) } : {}),
    results_md: relMd,
    next_step_hint: `Consulte ${relMd} e execute 'fetch_juris' nos leading cases escolhidos.`,
  };

  if (payload.tst_triage) {
    compactTstTriageToBudget(payload, relMd, 880);
    return payload;
  }

  // Poda Progressiva Rigorosa garantindo < 900 bytes (Lei 2)
  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 880) {
    payload.top_hits = payload.top_hits.slice(0, 1);
    if (payload.top_hits[0]) {
      payload.top_hits[0].tese_short = payload.top_hits[0].tese_short.slice(0, 70);
    }
    payload.statutory_bridge_applied = payload.statutory_bridge_applied.slice(0, 1);
  }

  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 880) {
    if (payload.jurisdiction_routing.fallback_notice) {
      payload.jurisdiction_routing.fallback_notice = `UF '${payload.jurisdiction_routing.unimplemented_uf_requested}' não implementada; fallback federal executado.`;
    }
    if (payload.top_hits[0]) {
      payload.top_hits[0].tese_short = payload.top_hits[0].tese_short.slice(0, 45);
    }
    payload.next_step_hint = `Consulte ${relMd}`;
  }

  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 880 && payload.live_degraded) {
    const courts = payload.live_degraded.map((s) => s.split("(")[0]).join(",");
    payload.live_degraded = [`${courts}(curated;force_live=true)`];
    if (payload.top_hits[0]) {
      payload.top_hits[0].tese_short = payload.top_hits[0].tese_short.slice(0, 30);
    }
  }

  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 880) {
    payload.statutory_bridge_applied = payload.statutory_bridge_applied.map((s) =>
      s.split(":")[0].slice(0, 8)
    );
    if (payload.jurisdiction_routing.fallback_notice) {
      payload.jurisdiction_routing.fallback_notice = `UF '${payload.jurisdiction_routing.unimplemented_uf_requested}' -> fallback federal.`;
    }
    if (payload.top_hits[0]) {
      payload.top_hits[0].tese_short = payload.top_hits[0].tese_short.slice(0, 18);
    }
  }

  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 880) {
    payload.top_hits = [];
    payload.statutory_bridge_applied = [];
  }

  return payload;
}
