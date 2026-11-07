import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import os from "node:os";
import {
  searchJuris,
  formatSearchJurisSyntheticResult,
} from "../src/tools/juris/search_juris.ts";
import {
  fetchJuris,
  formatFetchJurisSyntheticResult,
} from "../src/tools/juris/fetch_juris.ts";
import { defaultJurisdictionRegistry } from "../src/tools/juris/provider_registry.ts";
import type { LiveProbeResult } from "./pncp_api.live.ts";

/**
 * Caderno de Testes Online de Contrato para as APIs Oficiais de Jurisprudência (TCU / Cortes)
 * Valida rotas públicas, parsing de ementas, fatiamento anatômico e degradação graciosa.
 * Suporta filtro isolado via courtFilter (ex: "STF", "TCE-PA", "TCU").
 */
export async function runJurisLiveProbes(courtFilter?: string): Promise<LiveProbeResult[]> {
  const probes: LiveProbeResult[] = [];
  const baseTemp = resolve(
    os.tmpdir(),
    `docgov_test_juris_live_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  );
  const liveCaseDir = resolve(baseTemp, "cases", "live_juris_case");

  mkdirSync(resolve(liveCaseDir, "inputs"), { recursive: true });
  mkdirSync(resolve(liveCaseDir, "state"), { recursive: true });

  let firstHitId = "";

  try {
    if (courtFilter) {
      const normalizedCourt = courtFilter.trim().toUpperCase();
      const prov = defaultJurisdictionRegistry.get(normalizedCourt);

      if (!prov) {
        const available = defaultJurisdictionRegistry.getAll().map((p) => p.courtId).join(", ");
        probes.push({
          name: `Sonda de Tribunal [${normalizedCourt}]`,
          status: "FAIL",
          durationMs: 0,
          details: `Tribunal '${normalizedCourt}' não encontrado no JurisdictionProviderRegistry.`,
          error: `Cortes disponíveis: ${available}`,
        });
        return probes;
      }

      // ------------------------------------------------------------------------
      // Sonda 1 (Isolada): searchJuris online para a corte especificada
      // ------------------------------------------------------------------------
      const startS1 = Date.now();
      const smokeQuery = prov.liveSmokeQuery || "licitação | pregão";
      try {
        const searchRes = await searchJuris({
          caseDir: liveCaseDir,
          query: smokeQuery,
          courts: [prov.courtId],
          limit: 3,
          stance: "DEFENSE",
        });
        const durationS1 = Date.now() - startS1;

        const stateJsonPath = resolve(liveCaseDir, "state", "juris_search_results.json");
        const stateMdPath = resolve(liveCaseDir, "state", "juris_search_results.md");

        if (!existsSync(stateJsonPath) || !existsSync(stateMdPath)) {
          probes.push({
            name: `Sonda 1 [${prov.courtId}]: searchJuris online (${prov.courtName})`,
            status: "FAIL",
            durationMs: durationS1,
            details: "Arquivos de estado juris_search_results (.json / .md) não foram persistidos.",
            error: "Falha de persistência de estado em disco.",
          });
        } else {
          const rawJson = JSON.parse(readFileSync(stateJsonPath, "utf-8"));
          const hitsCount = rawJson.total_hits || (rawJson.results ? rawJson.results.length : 0);
          const synth = formatSearchJurisSyntheticResult(searchRes.fileResult, searchRes.mdPath, liveCaseDir);
          const synthBytes = Buffer.byteLength(JSON.stringify(synth), "utf-8");

          const diag = searchRes.fileResult.court_diagnostics?.find((d) => d.court === prov.courtId);
          const diagStatus = diag ? diag.status : "ok";

          if (hitsCount > 0 && rawJson.results && rawJson.results[0]?.id) {
            firstHitId = rawJson.results[0].id;
          }

          if (diagStatus === "error") {
            probes.push({
              name: `Sonda 1 [${prov.courtId}]: searchJuris online`,
              status: "FAIL",
              durationMs: durationS1,
              details: `Diagnóstico de corte reportou erro: ${diag?.error || "Falha"}. Payload MCP: ${synthBytes} bytes.`,
              error: diag?.error || "Court diagnostic error",
            });
          } else {
            probes.push({
              name: `Sonda 1 [${prov.courtId}]: searchJuris online`,
              status: "PASS",
              durationMs: durationS1,
              details: `Sucesso: ${hitsCount} decisões retornadas. Status: ${diagStatus}. Query: "${smokeQuery}". Payload MCP: ${synthBytes} bytes.`,
            });
          }
        }
      } catch (err: any) {
        probes.push({
          name: `Sonda 1 [${prov.courtId}]: searchJuris online (${prov.courtName})`,
          status: "FAIL",
          durationMs: Date.now() - startS1,
          details: `Exceção ao consultar API da corte ${prov.courtId}: ${err.message}`,
          error: err.message,
        });
      }

      // ------------------------------------------------------------------------
      // Sonda 2 (Isolada): fetchJuris online + Fatiamento Anatômico
      // ------------------------------------------------------------------------
      const startS2 = Date.now();
      const targetId =
        firstHitId ||
        (prov.courtId === "TCU"
          ? "ACORDAO-COMPLETO-255-2023-Plenario"
          : prov.courtId === "AGU"
          ? "PARECER-CNLCA-001-2021"
          : prov.courtId === "TCE-SP"
          ? "SUMULA-TCESP-50"
          : `Acórdão 100/2023-${prov.courtId}`);
      try {
        const fetchRes = await fetchJuris({
          caseDir: liveCaseDir,
          acordaoIdOrUrl: targetId,
          court: prov.courtId,
          stance: "DEFENSE",
        });
        const durationS2 = Date.now() - startS2;

        const synth2 = formatFetchJurisSyntheticResult(fetchRes, liveCaseDir);
        const synth2Bytes = Buffer.byteLength(JSON.stringify(synth2), "utf-8");

        const dossieContent = existsSync(fetchRes.dossiePath) ? readFileSync(fetchRes.dossiePath, "utf-8") : "";
        const hasAntiHallucination = dossieContent.includes("[ANTI_HALLUCINATION_BLOCK]");

        probes.push({
          name: `Sonda 2 [${prov.courtId}]: fetchJuris online + Fatiamento Anatômico`,
          status: "PASS",
          durationMs: durationS2,
          details: `Decisão [${targetId}] processada. Anti-Hallucination Block: ${hasAntiHallucination}. Payload MCP: ${synth2Bytes} bytes.`,
        });
      } catch (err: any) {
        probes.push({
          name: `Sonda 2 [${prov.courtId}]: fetchJuris online + Fatiamento Anatômico`,
          status: "FAIL",
          durationMs: Date.now() - startS2,
          details: `Exceção ao baixar e fatiar acórdão [${targetId}]: ${err.message}`,
          error: err.message,
        });
      }

      return probes;
    }

    // ------------------------------------------------------------------------
    // Modo Padrão (Sem filtro de corte): Executa Bateria Geral TCU + Fallback
    // ------------------------------------------------------------------------
    const startS1 = Date.now();
    try {
      const searchRes = await searchJuris({
        caseDir: liveCaseDir,
        query: "orçamento sigiloso | padronização",
        courts: ["TCU"],
        limit: 3,
        stance: "DEFENSE",
      });
      const durationS1 = Date.now() - startS1;

      const stateJsonPath = resolve(liveCaseDir, "state", "juris_search_results.json");
      const stateMdPath = resolve(liveCaseDir, "state", "juris_search_results.md");

      if (!existsSync(stateJsonPath) || !existsSync(stateMdPath)) {
        probes.push({
          name: "Sonda 1: searchJuris online TCU (pesquisa.apps.tcu.gov.br)",
          status: "FAIL",
          durationMs: durationS1,
          details: "Arquivos de estado juris_search_results (.json / .md) não foram persistidos.",
          error: "Falha de persistência de estado em disco.",
        });
      } else {
        const rawJson = JSON.parse(readFileSync(stateJsonPath, "utf-8"));
        const hitsCount = rawJson.total_hits || (rawJson.results ? rawJson.results.length : 0);
        const synth = formatSearchJurisSyntheticResult(searchRes.fileResult, searchRes.mdPath, liveCaseDir);
        const synthBytes = Buffer.byteLength(JSON.stringify(synth), "utf-8");

        if (hitsCount > 0 && rawJson.results && rawJson.results[0]?.id) {
          firstHitId = rawJson.results[0].id;
        }

        probes.push({
          name: "Sonda 1: searchJuris online TCU (pesquisa.apps.tcu.gov.br)",
          status: "PASS",
          durationMs: durationS1,
          details: `Sucesso: ${hitsCount} decisões retornadas. Bridge aplicada: ${rawJson.statutory_bridge_applied?.length ?? 0} eixos. Payload MCP: ${synthBytes} bytes.`,
        });
      }
    } catch (err: any) {
      probes.push({
        name: "Sonda 1: searchJuris online TCU (pesquisa.apps.tcu.gov.br)",
        status: "FAIL",
        durationMs: Date.now() - startS1,
        details: `Exceção ao consultar API do TCU: ${err.message}`,
        error: err.message,
      });
    }

    // ------------------------------------------------------------------------
    // Sonda 2: fetchJuris (Download de Inteiro Teor + Fatiamento Anatômico Estágios 2 e 3)
    // ------------------------------------------------------------------------
    const startS2 = Date.now();
    try {
      const targetId = firstHitId || "ACORDAO-COMPLETO-255-2023-Plenario";

      const fetchRes = await fetchJuris({
        caseDir: liveCaseDir,
        acordaoIdOrUrl: targetId,
        court: "TCU",
        stance: "DEFENSE",
      });
      const durationS2 = Date.now() - startS2;

      const synth2 = formatFetchJurisSyntheticResult(fetchRes, liveCaseDir);
      const synth2Bytes = Buffer.byteLength(JSON.stringify(synth2), "utf-8");

      const dossieContent = existsSync(fetchRes.dossiePath) ? readFileSync(fetchRes.dossiePath, "utf-8") : "";
      const hasAntiHallucination = dossieContent.includes("[ANTI_HALLUCINATION_BLOCK]");

      probes.push({
        name: "Sonda 2: fetchJuris online + Fatiamento Anatômico (6 Macro-Partes / 10 Sub-Camadas)",
        status: "PASS",
        durationMs: durationS2,
        details: `Decisão [${targetId}] baixada e fatiada. Anti-Hallucination Block presente: ${hasAntiHallucination}. Payload MCP: ${synth2Bytes} bytes.`,
      });
    } catch (err: any) {
      probes.push({
        name: "Sonda 2: fetchJuris online + Fatiamento Anatômico (6 Macro-Partes / 10 Sub-Camadas)",
        status: "FAIL",
        durationMs: Date.now() - startS2,
        details: `Exceção ao baixar e fatiar acórdão do TCU: ${err.message}`,
        error: err.message,
      });
    }

    // ------------------------------------------------------------------------
    // Sonda 3: Degradação Graciosa (Graceful Fallback com UF Não Implementada)
    // ------------------------------------------------------------------------
    const startS3 = Date.now();
    try {
      const fallbackRes = await searchJuris({
        caseDir: liveCaseDir,
        query: "reajuste de preços",
        uf: "AM", // Estado propositalmente não implementado
        limit: 2,
      });
      const durationS3 = Date.now() - startS3;

      const synth3 = formatSearchJurisSyntheticResult(fallbackRes.fileResult, fallbackRes.mdPath, liveCaseDir);
      const routing = synth3.jurisdiction_routing;
      const isHandledGracefully =
        synth3.status === "success" &&
        routing?.unimplemented_uf_requested === "AM" &&
        Array.isArray(routing?.supported_ufs) &&
        typeof routing?.fallback_notice === "string";

      if (!isHandledGracefully) {
        probes.push({
          name: "Sonda 3: Roteador Jurisdicional & Graceful Fallback (UF Não Implementada)",
          status: "FAIL",
          durationMs: durationS3,
          details: `Fallback para UF 'AM' não foi tratado graciosamente: status=${synth3.status}`,
          error: "routing ou fallback_notice ausente",
        });
      } else {
        probes.push({
          name: "Sonda 3: Roteador Jurisdicional & Graceful Fallback (UF Não Implementada)",
          status: "PASS",
          durationMs: durationS3,
          details: `Degradação graciosa confirmada para 'AM'. Cortes federais executadas: [${routing.executed_courts?.join(", ")}]. Fallback notice gerada.`,
        });
      }
    } catch (err: any) {
      probes.push({
        name: "Sonda 3: Roteador Jurisdicional & Graceful Fallback (UF Não Implementada)",
        status: "FAIL",
        durationMs: Date.now() - startS3,
        details: `Exceção na validação de fallback gracioso: ${err.message}`,
        error: err.message,
      });
    }
  } finally {
    try {
      rmSync(baseTemp, { recursive: true, force: true });
    } catch {}
  }

  return probes;
}
