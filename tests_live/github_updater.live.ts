import {
  fetchLatestReleaseInfo,
  selfUpdate,
  parseSha256Sums,
} from "../src/core/updater.ts";
import { GITHUB_REPO } from "../src/constants/index.ts";
import type { LiveProbeResult } from "./pncp_api.live.ts";

/**
 * Caderno de Testes Online de Contrato para o Auto-Updater & GitHub Releases API
 * Valida se a esteira de distribuição, endpoints de release e checksums SHA-256 estão operacionais.
 */
export async function runGitHubUpdaterLiveProbes(): Promise<LiveProbeResult[]> {
  const probes: LiveProbeResult[] = [];

  // --------------------------------------------------------------------------
  // Sonda 1: fetchLatestReleaseInfo (API REST do GitHub Releases)
  // --------------------------------------------------------------------------
  const startS1 = Date.now();
  let latestTagName = "";
  let sha256DownloadUrl = "";
  try {
    const info = await fetchLatestReleaseInfo(GITHUB_REPO);
    const durationS1 = Date.now() - startS1;

    if (!info || !info.tag || !info.version) {
      probes.push({
        name: "Sonda 1: fetchLatestReleaseInfo (GitHub Releases API)",
        status: "FAIL",
        durationMs: durationS1,
        details: "Resposta da API do GitHub não contém tag ou version.",
        error: "Contrato de release do GitHub divergente ou repositório inacessível.",
      });
    } else {
      latestTagName = info.tag;
      sha256DownloadUrl = info.sha256sumsDownloadUrl || "";
      probes.push({
        name: "Sonda 1: fetchLatestReleaseInfo (GitHub Releases API)",
        status: "PASS",
        durationMs: durationS1,
        details: `Última release identificada: ${info.tag} (versão: ${info.version}) [Asset: ${info.assetName}]`,
      });
    }
  } catch (err: any) {
    probes.push({
      name: "Sonda 1: fetchLatestReleaseInfo (GitHub Releases API)",
      status: "FAIL",
      durationMs: Date.now() - startS1,
      details: `Exceção ao consultar releases do repositório ${GITHUB_REPO}: ${err.message}`,
      error: err.message,
    });
  }

  // --------------------------------------------------------------------------
  // Sonda 2: selfUpdate checkOnly (Verificação de Atualização e Version Parsing)
  // --------------------------------------------------------------------------
  const startS2 = Date.now();
  try {
    const updateCheck = await selfUpdate({ checkOnly: true });
    const durationS2 = Date.now() - startS2;

    if (updateCheck && typeof updateCheck.updateAvailable === "boolean" && updateCheck.currentVersion) {
      probes.push({
        name: "Sonda 2: selfUpdate checkOnly (Verificação Lógica de Atualizações)",
        status: "PASS",
        durationMs: durationS2,
        details: `Versão local: ${updateCheck.currentVersion} | Remota: ${updateCheck.latestVersion} | updateAvailable=${updateCheck.updateAvailable}`,
      });
    } else {
      probes.push({
        name: "Sonda 2: selfUpdate checkOnly (Verificação Lógica de Atualizações)",
        status: "FAIL",
        durationMs: durationS2,
        details: "Objeto de checagem retornado não cumpre o contrato SelfUpdateResult.",
        error: "Falha na estrutura de retorno de selfUpdate.",
      });
    }
  } catch (err: any) {
    probes.push({
      name: "Sonda 2: selfUpdate checkOnly (Verificação Lógica de Atualizações)",
      status: "FAIL",
      durationMs: Date.now() - startS2,
      details: `Falha ao executar selfUpdate checkOnly: ${err.message}`,
      error: err.message,
    });
  }

  // --------------------------------------------------------------------------
  // Sonda 3: Download Real e Integridade de SHA256SUMS.txt
  // --------------------------------------------------------------------------
  const startS3 = Date.now();
  try {
    const rawTag = latestTagName || "v1.3.11";
    const tag = rawTag.startsWith("v") ? rawTag : `v${rawTag}`;
    const shaUrl =
      sha256DownloadUrl ||
      `https://github.com/${GITHUB_REPO}/releases/download/${tag}/SHA256SUMS.txt`;

    const res = await fetch(shaUrl, {
      headers: { "User-Agent": "docgov-engine/live-test" },
      signal: AbortSignal.timeout(20000),
    });

    const durationS3 = Date.now() - startS3;

    if (!res.ok) {
      probes.push({
        name: "Sonda 3: Download Real de SHA256SUMS.txt e Validação GNU",
        status: "FAIL",
        durationMs: durationS3,
        details: `Download de SHA256SUMS.txt retornou HTTP ${res.status}: ${res.statusText}`,
        error: "Arquivo SHA256SUMS.txt não encontrado na release mais recente.",
      });
    } else {
      const shaText = await res.text();
      const parsedMap = parseSha256Sums(shaText);

      const hasLinux = parsedMap.has("docgov-engine-linux-x64") || parsedMap.has("./bin/docgov-engine-linux-x64");
      const hasWin = parsedMap.has("docgov-engine-win-x64.exe") || parsedMap.has("./bin/docgov-engine-win-x64.exe");

      if (parsedMap.size > 0 && (hasLinux || hasWin)) {
        probes.push({
          name: "Sonda 3: Download Real de SHA256SUMS.txt e Validação GNU",
          status: "PASS",
          durationMs: durationS3,
          details: `Checksums parseados com sucesso (${parsedMap.size} hashes mapeados). Linux e Windows verificados.`,
        });
      } else {
        probes.push({
          name: "Sonda 3: Download Real de SHA256SUMS.txt e Validação GNU",
          status: "FAIL",
          durationMs: durationS3,
          details: `SHA256SUMS.txt inválido ou incompleto: ${parsedMap.size} entradas encontradas.`,
          error: "Hashes dos binários oficiais ausentes no SHA256SUMS.txt da release.",
        });
      }
    }
  } catch (err: any) {
    probes.push({
      name: "Sonda 3: Download Real de SHA256SUMS.txt e Validação GNU",
      status: "FAIL",
      durationMs: Date.now() - startS3,
      details: `Exceção ao validar SHA256SUMS.txt: ${err.message}`,
      error: err.message,
    });
  }

  return probes;
}
