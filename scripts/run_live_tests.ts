import { appendFileSync, existsSync } from "node:fs";
import { runPncpLiveProbes, type LiveProbeResult } from "../tests_live/pncp_api.live.ts";
import { runGitHubUpdaterLiveProbes } from "../tests_live/github_updater.live.ts";
import { runJurisLiveProbes } from "../tests_live/juris_api.live.ts";

/**
 * Runner Central de Testes Online de Contrato de API (Live API Smoke Tests)
 * Suporta execução isolada por suite via flag --suite=all|pncp|updater|juris
 */
async function main() {
  const args = process.argv.slice(2);
  let suite = "all";
  let court: string | undefined = undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--suite=")) {
      suite = arg.split("=")[1].toLowerCase();
    } else if (arg === "--suite" && args[i + 1]) {
      suite = args[++i].toLowerCase();
    } else if (arg.startsWith("--court=")) {
      court = arg.split("=")[1].toUpperCase();
      if (suite === "all") suite = "juris";
    } else if (arg === "--court" && args[i + 1]) {
      court = args[++i].toUpperCase();
      if (suite === "all") suite = "juris";
    }
  }

  console.log("================================================================================");
  console.log(`🌐 DOCGOV-ENGINE: LIVE API CONTRACT SMOKE TESTS (Suite: ${suite.toUpperCase()}${court ? ` | Court: ${court}` : ""})`);
  console.log("================================================================================");
  console.log("Aviso: Esta suite executa requisições HTTPS REAIS contra pncp.gov.br, api.github.com e portais de jurisprudência.\n");

  const results: LiveProbeResult[] = [];
  const startTotal = Date.now();

  if (suite === "all" || suite === "pncp") {
    console.log("📡 Executando sondas de contrato da API do PNCP (pncp.gov.br)...");
    const pncpResults = await runPncpLiveProbes();
    results.push(...pncpResults);
  }

  if (suite === "all" || suite === "updater") {
    console.log("\n📦 Executando sondas de contrato do GitHub Updater (api.github.com)...");
    const updaterResults = await runGitHubUpdaterLiveProbes();
    results.push(...updaterResults);
  }

  if (suite === "all" || suite === "juris") {
    console.log(`\n⚖️ Executando sondas de contrato de Jurisprudência${court ? ` (Filtro: ${court})` : " (TCU / Cortes)"}...`);
    const jurisResults = await runJurisLiveProbes(court);
    results.push(...jurisResults);
  }

  const totalDuration = Date.now() - startTotal;

  console.log("\n--------------------------------------------------------------------------------");
  console.log("📋 RELATÓRIO EXECUTIVO DE SONDAS ONLINE:");
  console.log("--------------------------------------------------------------------------------\n");

  let failCount = 0;
  for (const res of results) {
    const icon = res.status === "PASS" ? "✅ PASS" : "❌ FAIL";
    console.log(`${icon} [${res.durationMs}ms] ${res.name}`);
    console.log(`   Detalhes: ${res.details}`);
    if (res.error) {
      console.log(`   ⚠️ Erro de Contrato: ${res.error}`);
    }
    console.log("");

    if (res.status === "FAIL") {
      failCount++;
    }
  }

  console.log("================================================================================");
  console.log(`Total de Sondas: ${results.length} | Aprovadas: ${results.length - failCount} | Falhas: ${failCount} | Tempo Total: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log("================================================================================");

  // Integração com painel do GitHub Actions via GITHUB_STEP_SUMMARY
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      let md = `## 🌐 Relatório de Testes Online de Contrato de API (Live API Smoke Tests)\n\n`;
      md += `**Status Global:** ${failCount === 0 ? "✅ **100% OPERACIONAL**" : "❌ **FALHAS DETECTADAS**"}\n`;
      md += `**Data/Hora da Execução:** ${new Date().toISOString()}\n`;
      md += `**Duração Total:** ${(totalDuration / 1000).toFixed(2)}s\n\n`;
      md += `| Status | Sonda | Duração | Detalhes |\n`;
      md += `| :---: | :--- | :---: | :--- |\n`;

      for (const res of results) {
        const badge = res.status === "PASS" ? "🟢 PASS" : "🔴 FAIL";
        md += `| ${badge} | ${res.name} | ${res.durationMs}ms | ${res.details}${res.error ? `<br/>*Erro: ${res.error}*` : ""} |\n`;
      }

      md += `\n---\n*Relatório gerado automaticamente por \`scripts/run_live_tests.ts\`.*\n`;
      appendFileSync(summaryPath, md, "utf-8");
    } catch (err: any) {
      console.error(`Falha ao gravar GITHUB_STEP_SUMMARY: ${err.message}`);
    }
  }

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Erro fatal no runner de testes online:", err);
  process.exit(1);
});
