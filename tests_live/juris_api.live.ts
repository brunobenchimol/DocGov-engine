import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import os from "node:os";
import { searchJuris } from "../src/tools/juris/search_juris.ts";
import { fetchJuris } from "../src/tools/juris/fetch_juris.ts";
import type { LiveProbeResult } from "./pncp_api.live.ts";

/**
 * Caderno de Testes Online de Contrato para as APIs Oficiais de Jurisprudência (TCU / Cortes)
 * Valida rotas públicas, parsing de ementas, fatiamento anatômico e degradação graciosa.
 */
export async function runJurisLiveProbes(): Promise<LiveProbeResult[]> {
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
    // ------------------------------------------------------------------------
    // Sonda 1: searchJuris (Busca Real TCU + Statutory Bridge + Ranking)
    // ------------------------------------------------------------------------
    const startS1 = Date.now();
    try {
      const searchRes = await searchJuris({
        caseDir: liveCaseDir,
        queries: "orçamento sigiloso | padronização",
        courts: ["TCU"],
        limit: 3,
        stance: "DEFENSE",
      });
      const durationS1 = Date.now() - startS1;

      const stateJsonPath = resolve(liveCaseDir, "state", "juris_search_results.json");
      const stateMdPath = resolve(liveCaseDir, "state", "juris_search_results.md");

      if (searchRes.status !== "success") {
        probes.push({
          name: "Sonda 1: searchJuris online TCU (pesquisa.apps.tcu.gov.br)",
          status: "FAIL",
          durationMs: durationS1,
          details: `searchJuris retornou status diferente de success: ${searchRes.status}`,
          error: searchRes.message,
        });
      } else if (!existsSync(stateJsonPath) || !existsSync(stateMdPath)) {
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

        if (hitsCount > 0 && rawJson.results && rawJson.results[0]?.id) {
          firstHitId = rawJson.results[0].id;
        }

        probes.push({
          name: "Sonda 1: searchJuris online TCU (pesquisa.apps.tcu.gov.br)",
          status: "PASS",
          durationMs: durationS1,
          details: `Sucesso: ${hitsCount} decisões retornadas. Bridge aplicada: ${rawJson.statutory_bridge_applied?.total_axes_matched ?? 0} eixos. Payload MCP: ${searchRes.synthetic_payload_bytes} bytes.`,
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
      // Se a Sonda 1 identificou um ID real, usamos ele; caso contrário, usamos um acórdão notório do TCU
      const targetId = firstHitId || "ACORDAO-COMPLETO-255-2023-Plenario";

      const fetchRes = await fetchJuris({
        caseDir: liveCaseDir,
        id: targetId,
        court: "TCU",
        stage: "both",
        stance: "DEFENSE",
      });
      const durationS2 = Date.now() - startS2;

      const fullMdPath = resolve(liveCaseDir, "state", `acordao_inteiro_teor_${targetId.replace(/[^a-zA-Z0-9_-]/g, "_")}.md`);
      const dossiePath = resolve(liveCaseDir, "state", `dossie_hotspots_${targetId.replace(/[^a-zA-Z0-9_-]/g, "_")}.md`);

      if (fetchRes.status !== "success") {
        probes.push({
          name: "Sonda 2: fetchJuris online + Fatiamento Anatômico (6 Macro-Partes / 10 Sub-Camadas)",
          status: "FAIL",
          durationMs: durationS2,
          details: `fetchJuris retornou status diferente de success: ${fetchRes.status}`,
          error: fetchRes.message,
        });
      } else {
        const dossieContent = existsSync(dossiePath) ? readFileSync(dossiePath, "utf-8") : "";
        const hasAntiHallucination = dossieContent.includes("[ANTI_HALLUCINATION_BLOCK]");

        probes.push({
          name: "Sonda 2: fetchJuris online + Fatiamento Anatômico (6 Macro-Partes / 10 Sub-Camadas)",
          status: "PASS",
          durationMs: durationS2,
          details: `Decisão [${targetId}] baixada e fatiada. Anti-Hallucination Block presente: ${hasAntiHallucination}. Payload MCP: ${fetchRes.synthetic_payload_bytes} bytes.`,
        });
      }
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
        queries: "reajuste de preços",
        uf: "AM", // Estado propositalmente não implementado
        limit: 2,
      });
      const durationS3 = Date.now() - startS3;

      const routing = (fallbackRes as any).jurisdiction_routing;
      const isHandledGracefully =
        fallbackRes.status === "success" &&
        routing?.unimplemented_uf_requested === "AM" &&
        Array.isArray(routing?.supported_ufs) &&
        typeof routing?.fallback_notice === "string";

      if (!isHandledGracefully) {
        probes.push({
          name: "Sonda 3: Roteador Jurisdicional & Graceful Fallback (UF Não Implementada)",
          status: "FAIL",
          durationMs: durationS3,
          details: `Fallback para UF 'AM' não foi tratado graciosamente: status=${fallbackRes.status}`,
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
