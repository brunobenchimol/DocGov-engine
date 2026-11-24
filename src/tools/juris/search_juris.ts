// ============================================================================
// 9ª Ferramenta MCP: search_juris (CLI --search-juris)
// Busca Multi-Query Sob Demanda em APIs Oficiais de Controle Externo
// ============================================================================

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { VERSION } from "../../constants/index.ts";
import { createJurisSearchContractError } from "../../contracts/errors.ts";
import {
  resolveWorkspacePath,
  isValidDocGovCaseScope,
  getEphemeralInspectDir,
} from "../../utils/paths.ts";
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

  const stance = options.stance || "DEFENSE";
  const regime = options.regime || "BOTH";
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
  const rawHits: any[] = [];
  const tstTriageParts: TstTriageResult[] = [];

  const providerTasks = selectedProviders.map(async (prov) => {
    const provStart = Date.now();
    let provHits: any[] = [];
    let provError: string | null = null;
    let provLiveError: string | null = null;
    let provSourceMode: JurisSourceMode | undefined;
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
          provHits.push(...res.hits);
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
          provHits.push(...hits);
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
    if (provError && provHits.length === 0) {
      provStatus = "error";
    }

    courtDiagnostics.push({
      court: prov.courtId,
      status: provStatus,
      hits: provHits.length,
      latency_ms: latency,
      error: provError,
      source_mode: provSourceMode,
      live_error: provLiveError,
    });

    rawHits.push(...provHits);
  });

  await Promise.all(providerTasks);

  let finalTstTriage: TstTriageResult | undefined;
  if (tstTriageParts.length === 1) {
    finalTstTriage = tstTriageParts[0];
  } else if (tstTriageParts.length > 1) {
    finalTstTriage = mergeTstTriageResults(tstTriageParts, tstTriageParts[0].mode);
  }

  // 4. Desduplicação e Cálculo Determinístico do Score (0..100)
  const hitMap = new Map<string, JurisSearchResultItem>();

  for (const raw of rawHits) {
    if (!raw || !raw.id) continue;
    const dedupeKey = `${raw.court}-${raw.id}`.toUpperCase();

    if (!hitMap.has(dedupeKey)) {
      const scoring = scoreJurisItem(raw, rawQueries.join(" "), { stance, regime });
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
      };

      hitMap.set(dedupeKey, scoredItem);
    }
  }

  // Ordena por relevance_score decrescente
  const rankedItems = Array.from(hitMap.values()).sort(
    (a, b) => b.relevance_score - a.relevance_score
  );
  const finalHits = rankedItems.slice(0, Math.max(limit, 10));

  // 5. Determinação de Destino no Disco (com Whitelist ENG-10)
  let targetDir: string;
  let isEphemeral = false;

  if (options.caseDir) {
    const resolvedCase = resolveWorkspacePath(options.caseDir);
    if (isValidDocGovCaseScope(resolvedCase)) {
      targetDir = join(resolvedCase, "state");
    } else {
      targetDir = getEphemeralInspectDir();
      isEphemeral = true;
    }
  } else {
    targetDir = getEphemeralInspectDir();
    isEphemeral = true;
  }

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const jsonPath = join(targetDir, "juris_search_results.json");
  const mdPath = join(targetDir, "juris_search_results.md");

  const fileResult: SearchJurisFileResult = {
    engine_version: VERSION,
    timestamp: new Date().toISOString(),
    query: options.query,
    queries_executed: rawQueries,
    stance,
    regime,
    total_hits: rankedItems.length,
    statutory_bridge_applied: appliedBridges,
    normative_bridge: appliedBridges, // alias para conformidade com .NET Gen4
    jurisdiction_routing: routingInfo,
    court_diagnostics: courtDiagnostics,
    ...(finalTstTriage ? { tst_triage: finalTstTriage } : {}),
    results: finalHits,
  };

  writeFileSync(jsonPath, JSON.stringify(fileResult, null, 2), "utf-8");

  const markdownContent = generateJurisSearchMarkdown(fileResult, isEphemeral);
  writeFileSync(mdPath, markdownContent, "utf-8");

  return {
    fileResult,
    jsonPath,
    mdPath,
  };
}

function buildLiveDegradedNotices(
  diagnostics?: import("./types.ts").CourtDiagnostic[]
): string[] {
  if (!diagnostics || diagnostics.length === 0) return [];
  const notices: string[] = [];
  for (const d of diagnostics) {
    const mode = d.source_mode;
    if (mode === "CURATED_FALLBACK") {
      const reason = /timeout|timed out/i.test(d.live_error || "")
        ? "timeout"
        : d.live_error
        ? d.live_error.slice(0, 18).replace(/\s+/g, " ")
        : "fallback";
      notices.push(`${d.court}(${reason}->curated; retry com force_live=true)`);
    } else if (mode === "CIRCUIT_OPEN_FALLBACK") {
      notices.push(`${d.court}(circuit_open->curated; retry com force_live=true)`);
    } else if (mode === "CURATED_SHORT_CIRCUIT") {
      notices.push(`${d.court}(short_circuit->curated; force_live=true p/ live)`);
    } else if (mode === "LIVE_FAILED") {
      const errShort = (d.live_error || d.error || "err").slice(0, 22);
      notices.push(`${d.court}(live_failed:${errShort})`);
    }
  }
  return notices;
}

function generateJurisSearchMarkdown(
  res: SearchJurisFileResult,
  isEphemeral: boolean
): string {
  let md = `# ⚖️ Resultado da Pesquisa de Jurisprudência — docgov-engine v${res.engine_version}\n\n`;
  md += `> **Query:** \`${res.query}\` | **Stance Tático:** \`${res.stance}\` | **Regime:** \`${res.regime}\`\n`;
  md += `> **Total de Precedentes Encontrados:** ${res.total_hits} | **Cortes Consultadas:** \`${res.jurisdiction_routing.executed_courts.join(", ")}\`\n`;

  const degradedNotices = buildLiveDegradedNotices(res.court_diagnostics);
  if (degradedNotices.length > 0) {
    md += `> ⚠️ **Aviso de Origem Curada / Degradação Live:** \`${degradedNotices.join(" | ")}\`\n`;
  }
  if (res.jurisdiction_routing.fallback_notice) {
    md += `> ⚠️ **Aviso de Graceful Fallback:** ${res.jurisdiction_routing.fallback_notice}\n`;
  }
  if (isEphemeral) {
    md += `> ℹ️ **Modo Pesquisa Livre (Standalone):** Arquivo gravado isoladamente em diretório efêmero temporário.\n`;
  }
  md += "\n";

  if (res.statutory_bridge_applied.length > 0) {
    md += `## 🌉 Pontes Normativas Aplicadas (Statutory Bridge)\n`;
    for (const b of res.statutory_bridge_applied) {
      md += `- ${b}\n`;
    }
    md += "\n";
  }

  if (res.court_diagnostics && res.court_diagnostics.length > 0) {
    md += `## 📡 Telemetria e Diagnóstico dos Conectores (Court Diagnostics)\n\n`;
    md += `| Corte | Status | Modo / Origem | Precedentes | Latência | Detalhe / Diagnóstico |\n`;
    md += `| :---: | :---: | :---: | :---: | :---: | :--- |\n`;
    for (const d of res.court_diagnostics) {
      const statusIcon = d.status === "ok" ? "✅ OK" : "⚠️ FALHA";
      const modeLabel = d.source_mode || "LIVE";
      const rawDetail = d.error || d.live_error || "Conexão e parser operacionais";
      const detail = rawDetail.replace(/\|/g, "/");
      md += `| \`${d.court}\` | ${statusIcon} | \`${modeLabel}\` | ${d.hits} | ${d.latency_ms}ms | ${detail} |\n`;
    }
    md += "\n";
  }

  if (res.tst_triage) {
    md += renderTstTriageMarkdownSection(res.tst_triage);
  }

  md += `## 🏆 Precedentes Ranqueados (Top ${res.results.length})\n\n`;
  md += `| Score | Corte | Origem | Identificador | Desfecho / Comando | Tese Fixada / Ementa |\n`;
  md += `| :---: | :---: | :---: | :--- | :--- | :--- |\n`;

  for (const item of res.results) {
    const teseMini = (item.tese_short || item.tese || "").slice(0, 140).replace(/\|/g, "/");
    const adverseNotice =
      item.stance_alignment === "ADVERSE_DISTINGUISHING_REQUIRED"
        ? " ⚠️ `[ADVERSO — EXIGE DISTINGUISHING]`"
        : "";
    const outcomeCol = `\`${item.outcome || "DECISAO"}\`${adverseNotice}`;
    const originCol = `\`${item.origin || "LIVE"}\``;
    md += `| **${item.relevance_score} pts** | \`${item.court}\` | ${originCol} | **${item.id}** | ${outcomeCol} | ${teseMini} |\n`;
  }

  md += `\n---\n*Para fatiar e validar o inteiro teor de qualquer precedente acima, acione \`fetch_juris\` informando o identificador.*`;
  return md;
}

function renderTstTriageMarkdownSection(triage: TstTriageResult): string {
  const c = triage.counts;
  let md = `## ⚖️ Triagem Estruturada TST (4 Baldes — modo \`${triage.mode}\`)\n\n`;
  md += `> **Contagens:** \`erga_omnes=${c.erga_omnes}\` | \`orientativas=${c.orientativas}\` | \`inter_partes=${c.inter_partes}\` | \`unclassified=${c.unclassified}\` | \`filtered_out=${c.filtered_out}\`\n\n`;
  const bucketLabels: Array<[keyof TstTriageResult["buckets"], string]> = [
    ["erga_omnes", "Erga Omnes (SV, RG, IRR, IAC)"],
    ["orientativas", "Orientativas (Súmulas, OJs, SBDI/SDC/Pleno)"],
    ["inter_partes", "Inter Partes (Turmas, Monocráticas, ArgInc)"],
    ["unclassified", "Não Classificados (Fallback Defensivo)"],
  ];
  for (const [key, label] of bucketLabels) {
    const items = triage.buckets[key];
    if (items.length === 0) continue;
    md += `### ${label} (${items.length})\n`;
    for (const it of items) {
      md += `- **${it.id}** [\`${it.kind}\`${it.year ? `, ${it.year}` : ""}]: ${it.title}\n`;
    }
    md += "\n";
  }
  if (triage.raw_diff) {
    md += `### Diff Modo Compare (\`raw_total=${triage.raw_diff.raw_total}\`)\n`;
    md += `- **raw_top_ids:** ${triage.raw_diff.raw_top_ids.join(", ") || "nenhum"}\n`;
    md += `- **filtered_out_ids:** ${triage.raw_diff.filtered_out_ids.join(", ") || "nenhum"}\n\n`;
  }
  return md;
}

/**
 * Formata o retorno sintético MCP estritamente abaixo de 900 bytes (Lei 2).
 */
export function formatSearchJurisSyntheticResult(
  fileResult: SearchJurisFileResult,
  mdPath: string,
  baseDir: string = process.cwd()
): SearchJurisSyntheticResult {
  const relMd = relative(baseDir, mdPath).replace(/\\/g, "/") || mdPath;

  const topHits = fileResult.results.slice(0, 3).map((h) => ({
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
