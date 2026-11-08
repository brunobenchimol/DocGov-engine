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
import type { JurisdictionProvider } from "../src/tools/juris/types.ts";
import type { LiveProbeResult } from "./pncp_api.live.ts";

/**
 * Retorna um ID canônico de teste para cada corte caso a busca preliminar não retorne ID.
 */
function getCanonicalFallbackId(courtId: string): string {
  switch (courtId) {
    case "TCU": return "ACORDAO-COMPLETO-255-2023-Plenario";
    case "STJ": return "1467577";
    case "STF": return "sjur505834";
    case "TST": return "TST-AIRR-0000590-72.2025.5.10.0009";
    case "AGU": return "PARECER-CNLCA-001-2021";
    case "TCE-PA": return "TCE-PA-1-2024";
    case "TCE-CE": return "TCE-CE-Acórdão-5741-2026";
    case "TCDF": return "TCDF-Decisão-1038-2020";
    case "TCE-SP": return "SUMULA-TCESP-30";
    case "TCE-MG": return "CONSULTA-TCEMG-1119769";
    default: return `Acórdão 100/2023-${courtId}`;
  }
}

/**
 * Classifica a origem real dos resultados (Live API, Híbrido ou Fallback Curado).
 */
function classifyOrigin(
  courtId: string,
  results: any[]
): "API Live Direta" | "Híbrido (Live + Curado)" | "Fallback Curado Local" {
  if (!results || results.length === 0) return "API Live Direta";
  const curatedPattern = /^(SUMULA|CONSULTA|ON-AGU|PARECER)/i;
  const allCurated = results.every((r) => curatedPattern.test(r.id || ""));
  const someCurated = results.some((r) => curatedPattern.test(r.id || ""));

  if (allCurated && ["AGU", "TCE-SP", "TCE-MG"].includes(courtId)) {
    return "Fallback Curado Local";
  }
  if (someCurated) {
    return "Híbrido (Live + Curado)";
  }
  return "API Live Direta";
}

/**
 * Caderno de Testes Online de Contrato para as APIs Oficiais de Jurisprudência
 * Auto-Discovery dinâmico via JurisdictionProviderRegistry.
 * Suporta execução completa (todas as cortes) ou filtro isolado (ex.: "TCE-MG", "TCE-PA,TCE-SP").
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

  const isFullSuite = !courtFilter || courtFilter.trim().toUpperCase() === "ALL";
  let targetProviders: JurisdictionProvider[] = [];

  if (isFullSuite) {
    targetProviders = defaultJurisdictionRegistry.getAllProviders();
  } else {
    const courtTokens = courtFilter!
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    for (const token of courtTokens) {
      const prov = defaultJurisdictionRegistry.get(token);
      if (!prov) {
        const available = defaultJurisdictionRegistry.getAllCourts().join(", ");
        probes.push({
          name: `Sonda de Tribunal [${token}]`,
          status: "FAIL",
          durationMs: 0,
          details: `Tribunal '${token}' não encontrado no JurisdictionProviderRegistry.`,
          error: `Cortes disponíveis: ${available}`,
        });
      } else {
        targetProviders.push(prov);
      }
    }
  }

  if (targetProviders.length === 0 && probes.length > 0) {
    return probes;
  }

  try {
    for (const prov of targetProviders) {
      let firstHitId = "";

      // ------------------------------------------------------------------------
      // Sonda 1: searchJuris online + Statutory Bridge
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
            name: `Sonda [${prov.courtId}] 1: searchJuris (${prov.courtId})`,
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
          const diagLatency = diag ? `${diag.latency_ms}ms` : `${durationS1}ms`;

          if (hitsCount > 0 && rawJson.results && rawJson.results[0]?.id) {
            firstHitId = rawJson.results[0].id;
          }

          const origin = classifyOrigin(prov.courtId, rawJson.results || []);

          if (diagStatus === "error") {
            probes.push({
              name: `Sonda [${prov.courtId}] 1: searchJuris (${prov.courtId})`,
              status: "FAIL",
              durationMs: durationS1,
              details: `[${origin}] Diagnóstico reportou erro: ${diag?.error || "Falha"}. Payload MCP: ${synthBytes}B.`,
              error: diag?.error || "Court diagnostic error",
            });
          } else if (synthBytes >= 900) {
            probes.push({
              name: `Sonda [${prov.courtId}] 1: searchJuris (${prov.courtId})`,
              status: "FAIL",
              durationMs: durationS1,
              details: `[${origin}] Payload MCP excedeu teto da Lei 2: ${synthBytes}B >= 900B.`,
              error: `MCP Payload ceiling exceeded: ${synthBytes} bytes`,
            });
          } else {
            probes.push({
              name: `Sonda [${prov.courtId}] 1: searchJuris (${prov.courtId})`,
              status: "PASS",
              durationMs: durationS1,
              details: `[${origin}] ${hitsCount} hits (Top: ${firstHitId || "N/A"}). Latência API: ${diagLatency}. Payload MCP: ${synthBytes}B.`,
            });
          }
        }
      } catch (err: any) {
        probes.push({
          name: `Sonda [${prov.courtId}] 1: searchJuris (${prov.courtId})`,
          status: "FAIL",
          durationMs: Date.now() - startS1,
          details: `Exceção ao consultar API da corte ${prov.courtId}: ${err.message}`,
          error: err.message,
        });
      }

      // ------------------------------------------------------------------------
      // Sonda 2: fetchJuris online + Fatiamento Anatômico
      // ------------------------------------------------------------------------
      const startS2 = Date.now();
      const targetId = firstHitId || getCanonicalFallbackId(prov.courtId);
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

        const fetchOrigin = /^(SUMULA|CONSULTA|ON-AGU|PARECER)/i.test(targetId)
          ? "Catálogo Normativo Curado"
          : "API Live Direta";

        if (hasAntiHallucination) {
          probes.push({
            name: `Sonda [${prov.courtId}] 2: fetchJuris (${prov.courtId})`,
            status: "FAIL",
            durationMs: durationS2,
            details: `[${fetchOrigin}] Decisão [${targetId}] bloqueada por Anti-Hallucination. Payload MCP: ${synth2Bytes}B.`,
            error: "Anti-Hallucination block triggered unexpectedly for genuine ID",
          });
        } else if (synth2Bytes >= 900) {
          probes.push({
            name: `Sonda [${prov.courtId}] 2: fetchJuris (${prov.courtId})`,
            status: "FAIL",
            durationMs: durationS2,
            details: `[${fetchOrigin}] Payload MCP excedeu teto da Lei 2: ${synth2Bytes}B >= 900B.`,
            error: `MCP Payload ceiling exceeded: ${synth2Bytes} bytes`,
          });
        } else {
          probes.push({
            name: `Sonda [${prov.courtId}] 2: fetchJuris (${prov.courtId})`,
            status: "PASS",
            durationMs: durationS2,
            details: `[${fetchOrigin}] Decisão [${targetId}] baixada e fatiada. Anti-Hallucination: false. Payload MCP: ${synth2Bytes}B.`,
          });
        }
      } catch (err: any) {
        probes.push({
          name: `Sonda [${prov.courtId}] 2: fetchJuris (${prov.courtId})`,
          status: "FAIL",
          durationMs: Date.now() - startS2,
          details: `Exceção ao baixar e fatiar decisão [${targetId}]: ${err.message}`,
          error: err.message,
        });
      }
    }

    // ------------------------------------------------------------------------
    // Sonda Dinâmica de Roteador Jurisdicional & Graceful Fallback (Apenas Suite Completa)
    // ------------------------------------------------------------------------
    if (isFullSuite) {
      const startS3 = Date.now();
      const ALL_BR_UFS = [
        "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
        "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
        "RO", "RR", "RS", "SC", "SE", "SP", "TO",
      ];
      const supported = new Set(defaultJurisdictionRegistry.getSupportedUfs());
      const targetUf = ALL_BR_UFS.find((uf) => !supported.has(uf)) || "ZZ";

      try {
        const fallbackRes = await searchJuris({
          caseDir: liveCaseDir,
          query: "reajuste de preços",
          uf: targetUf,
          limit: 2,
        });
        const durationS3 = Date.now() - startS3;

        const synth3 = formatSearchJurisSyntheticResult(
          fallbackRes.fileResult,
          fallbackRes.mdPath,
          liveCaseDir
        );
        const synth3Bytes = Buffer.byteLength(JSON.stringify(synth3), "utf-8");
        const routing = synth3.jurisdiction_routing;
        const isHandledGracefully =
          synth3.status === "success" &&
          routing?.unimplemented_uf_requested === targetUf &&
          Array.isArray(routing?.supported_ufs) &&
          typeof routing?.fallback_notice === "string";

        if (!isHandledGracefully) {
          probes.push({
            name: `Sonda [Fallback] 3: Roteador Jurisdicional & Graceful Fallback (UF: ${targetUf})`,
            status: "FAIL",
            durationMs: durationS3,
            details: `[Graceful Fallback] Fallback para UF '${targetUf}' não foi tratado graciosamente: status=${synth3.status}`,
            error: "routing ou fallback_notice ausente",
          });
        } else if (synth3Bytes >= 900) {
          probes.push({
            name: `Sonda [Fallback] 3: Roteador Jurisdicional & Graceful Fallback (UF: ${targetUf})`,
            status: "FAIL",
            durationMs: durationS3,
            details: `[Graceful Fallback] Payload MCP excedeu teto da Lei 2: ${synth3Bytes}B >= 900B.`,
            error: `MCP Payload ceiling exceeded: ${synth3Bytes} bytes`,
          });
        } else {
          probes.push({
            name: `Sonda [Fallback] 3: Roteador Jurisdicional & Graceful Fallback (UF: ${targetUf})`,
            status: "PASS",
            durationMs: durationS3,
            details: `[Graceful Fallback] Degradação graciosa confirmada para '${targetUf}'. Cortes federais: [${routing.executed_courts?.join(", ")}]. Payload MCP: ${synth3Bytes}B.`,
          });
        }
      } catch (err: any) {
        probes.push({
          name: `Sonda [Fallback] 3: Roteador Jurisdicional & Graceful Fallback (UF: ${targetUf})`,
          status: "FAIL",
          durationMs: Date.now() - startS3,
          details: `Exceção na validação de fallback gracioso: ${err.message}`,
          error: err.message,
        });
      }
    }
  } finally {
    try {
      rmSync(baseTemp, { recursive: true, force: true });
    } catch {}
  }

  return probes;
}
