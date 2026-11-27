// ============================================================================
// Persistência Concorrente, Lock e Acumulação de search_juris (docgov-engine)
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withDirectoryLock, writeFileSafeSync } from "../../utils/fs_safe_io.ts";
import type {
  CourtDiagnostic,
  JurisQueryHistoryEntry,
  JurisSearchResultItem,
  SearchJurisFileResult,
  TstTriageResult,
} from "./types.ts";

export { writeFileSafeSync as writeFileAtomicSync };

function mergeUniqueStrings(a: string[], b: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of [...a, ...b]) {
    const trimmed = String(s || "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function makeJurisDedupeKey(item: Pick<JurisSearchResultItem, "court" | "id">): string {
  return `${item.court}-${item.id}`.toUpperCase();
}

export async function persistAccumulatedJurisSearch(params: {
  targetDir: string;
  isEphemeral: boolean;
  currentRound: Omit<SearchJurisFileResult, "total_accumulated" | "queries_history">;
  currentHits: JurisSearchResultItem[];
}): Promise<{
  fileResult: SearchJurisFileResult;
  jsonPath: string;
  mdPath: string;
  mdContent: string;
}> {
  const { targetDir, isEphemeral, currentRound, currentHits } = params;

  return withDirectoryLock(targetDir, "juris_search", async () => {
    const jsonPath = join(targetDir, "juris_search_results.json");
    const mdPath = join(targetDir, "juris_search_results.md");

      let prevResults: JurisSearchResultItem[] = [];
      let prevQueriesExecuted: string[] = [];
      let prevHistory: JurisQueryHistoryEntry[] = [];

      if (existsSync(jsonPath)) {
        try {
          const parsed = JSON.parse(readFileSync(jsonPath, "utf-8"));
          if (Array.isArray(parsed?.results)) prevResults = parsed.results;
          if (Array.isArray(parsed?.queries_executed)) {
            prevQueriesExecuted = parsed.queries_executed;
          }
          if (Array.isArray(parsed?.queries_history)) {
            prevHistory = parsed.queries_history;
          }
        } catch {
          // Se JSON anterior estiver corrompido, reinicia acumulação limpa
        }
      }

      const mergedMap = new Map<string, JurisSearchResultItem>();
      const prevKeys = new Set<string>();

      for (const prev of prevResults) {
        if (!prev || !prev.id || !prev.court) continue;
        const key = makeJurisDedupeKey(prev);
        prevKeys.add(key);
        const existingQueries = Array.isArray(prev.matched_queries)
          ? prev.matched_queries
          : [];
        mergedMap.set(key, {
          ...prev,
          matched_queries: mergeUniqueStrings(existingQueries, []),
        });
      }

      let newHitsCount = 0;
      for (const curr of currentHits) {
        if (!curr || !curr.id || !curr.court) continue;
        const key = makeJurisDedupeKey(curr);
        const currQueries = Array.isArray(curr.matched_queries)
          ? curr.matched_queries
          : currentRound.queries_executed;

        if (!prevKeys.has(key) && !mergedMap.has(key)) {
          newHitsCount++;
        }

        const existing = mergedMap.get(key);
        if (!existing) {
          mergedMap.set(key, {
            ...curr,
            matched_queries: mergeUniqueStrings(currQueries, []),
          });
        } else {
          const combinedQueries = mergeUniqueStrings(
            existing.matched_queries || [],
            currQueries
          );
          const winner =
            curr.relevance_score >= existing.relevance_score ? curr : existing;
          mergedMap.set(key, {
            ...winner,
            matched_queries: combinedQueries,
          });
        }
      }

      const consolidatedResults = Array.from(mergedMap.values()).sort(
        (a, b) => b.relevance_score - a.relevance_score
      );

      const accumulatedQueries = mergeUniqueStrings(
        prevQueriesExecuted,
        currentRound.queries_executed
      );

      const historyEntry: JurisQueryHistoryEntry = {
        timestamp: currentRound.timestamp,
        query: currentRound.query,
        courts: currentRound.jurisdiction_routing.executed_courts,
        stance: currentRound.stance,
        regime: currentRound.regime,
        new_hits: newHitsCount,
        ...(currentRound.tst_triage ? { tst_triage: currentRound.tst_triage } : {}),
      };

      const queriesHistory = [...prevHistory, historyEntry];

      const fileResult: SearchJurisFileResult = {
        engine_version: currentRound.engine_version,
        timestamp: currentRound.timestamp,
        query: currentRound.query,
        queries_executed: accumulatedQueries,
        queries_history: queriesHistory,
        stance: currentRound.stance,
        regime: currentRound.regime,
        total_hits: currentHits.length,
        total_accumulated: consolidatedResults.length,
        statutory_bridge_applied: currentRound.statutory_bridge_applied,
        normative_bridge: currentRound.normative_bridge,
        jurisdiction_routing: currentRound.jurisdiction_routing,
        court_diagnostics: currentRound.court_diagnostics,
        ...(currentRound.tst_triage ? { tst_triage: currentRound.tst_triage } : {}),
        results: consolidatedResults,
      };

      writeFileSafeSync(jsonPath, JSON.stringify(fileResult, null, 2));
      const mdContent = generateJurisSearchMarkdown(fileResult, isEphemeral);
      writeFileSafeSync(mdPath, mdContent);

      return { fileResult, jsonPath, mdPath, mdContent };
  });
}

export function buildLiveDegradedNotices(
  diagnostics?: CourtDiagnostic[]
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
  md += `> **Query Atual:** \`${res.query}\` | **Stance:** \`${res.stance}\` | **Regime:** \`${res.regime}\`\n`;
  md += `> **Precedentes na Rodada:** ${res.total_hits} | **Total Acumulado Único:** ${res.total_accumulated} | **Cortes:** \`${res.jurisdiction_routing.executed_courts.join(", ")}\`\n`;

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

  if (res.queries_history && res.queries_history.length > 1) {
    md += `## 🗂️ Histórico de Buscas Acumuladas (${res.queries_history.length} rodadas)\n\n`;
    for (const h of res.queries_history) {
      md += `- \`${h.timestamp}\` | \`${h.query}\` (\`${h.courts.join(",")}\`, novos hits: **${h.new_hits}**)\n`;
    }
    md += "\n";
  }

  if (res.statutory_bridge_applied.length > 0) {
    md += `## 🌉 Pontes Normativas Aplicadas (Statutory Bridge)\n`;
    for (const b of res.statutory_bridge_applied) {
      md += `- ${b}\n`;
    }
    md += "\n";
  }

  if (res.court_diagnostics && res.court_diagnostics.length > 0) {
    md += `## 📡 Telemetria e Diagnóstico dos Conectores (Rodada Atual)\n\n`;
    md += `| Corte | Status | Modo / Origem | Precedentes | Latência | Detalhe / Diagnóstico |\n`;
    md += `| :---: | :---: | :---: | :---: | :---: | :--- |\n`;
    for (const d of res.court_diagnostics) {
      const statusIcon = d.status === "ok" ? "✅ OK" : "⚠️ FALHA";
      const modeLabel = d.cache_hit ? `${d.source_mode || "LIVE"} (CACHE_24H)` : d.source_mode || "LIVE";
      const rawDetail = d.error || d.live_error || "Conexão e parser operacionais";
      const detail = rawDetail.replace(/\|/g, "/");
      md += `| \`${d.court}\` | ${statusIcon} | \`${modeLabel}\` | ${d.hits} | ${d.latency_ms}ms | ${detail} |\n`;
    }
    md += "\n";
  }

  if (res.tst_triage) {
    md += renderTstTriageMarkdownSection(res.tst_triage);
  }

  md += `## 🏆 Precedentes Consolidados (${res.results.length})\n\n`;
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
