// ============================================================================
// CLI Handlers para Conectores Externos (PNCP e Jurisprudência v1.4.0)
// ============================================================================

import {
  fetchPncpContract,
  formatFetchPncpSyntheticResult,
  searchPncpContracts,
  formatSearchPncpSyntheticResult,
} from "../tools/pncp.ts";
import {
  searchJuris,
  formatSearchJurisSyntheticResult,
  fetchJuris,
  formatFetchJurisSyntheticResult,
} from "../tools/juris/index.ts";
import { generateEngineSpecMarkdown } from "../mcp/spec.ts";
import { selfUpdate } from "../core/updater.ts";
import { executeBackgroundCopyTask } from "../tools/bootstrap.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { BackgroundCopyInput } from "../types/index.ts";

export async function handleMaintenanceCli(args: string[]): Promise<boolean> {
  // Modo --dump-spec
  if (args.includes("--dump-spec")) {
    const specIdx = args.indexOf("--dump-spec");
    const outIdx = args.indexOf("--out");
    let outputPath: string | undefined;
    if (outIdx !== -1 && args[outIdx + 1] && !args[outIdx + 1].startsWith("--")) {
      outputPath = args[outIdx + 1];
    } else if (args[specIdx + 1] && !args[specIdx + 1].startsWith("--")) {
      outputPath = args[specIdx + 1];
    }

    const specMarkdown = generateEngineSpecMarkdown();
    if (outputPath) {
      const resolved = resolve(outputPath);
      mkdirSync(dirname(resolved), { recursive: true });
      writeFileSync(resolved, specMarkdown, "utf8");
      console.log(`Especificação técnica do motor gravada com sucesso em: ${resolved}`);
    } else {
      process.stdout.write(specMarkdown + "\n");
    }
    return true;
  }

  // Modo interno de cópia em segundo plano desanexada
  if (args.includes("--internal-bg-copy")) {
    const sourceIdx = args.indexOf("--source");
    const destIdx = args.indexOf("--dest");
    const stateIdx = args.indexOf("--state");
    const filesIdx = args.indexOf("--files");
    if (sourceIdx !== -1 && destIdx !== -1 && stateIdx !== -1 && filesIdx !== -1) {
      try {
        const sourceDir = args[sourceIdx + 1];
        const destDir = args[destIdx + 1];
        const stateDir = args[stateIdx + 1];
        const files: BackgroundCopyInput = JSON.parse(args[filesIdx + 1]);
        await executeBackgroundCopyTask(sourceDir, destDir, stateDir, files);
      } catch {
        process.exit(1);
      }
    }
    return true;
  }

  // Modo Auto-Atualização (--check-update, --update, -u, --force-update)
  if (
    args.includes("--check-update") ||
    args.includes("--update") ||
    args.includes("-u") ||
    args.includes("--force-update")
  ) {
    const checkOnly = args.includes("--check-update");
    const force = args.includes("--force-update");
    const outIdx = args.indexOf("--out");
    const customTarget = outIdx !== -1 ? args[outIdx + 1] : undefined;

    try {
      const res = await selfUpdate({
        checkOnly,
        force,
        targetPath: customTarget,
      });
      console.log(res.message);
    } catch (err: any) {
      console.error(`Erro na atualização: ${err.message}`);
      process.exit(1);
    }
    return true;
  }

  return false;
}

export async function handleConnectorsCli(args: string[]): Promise<boolean> {
  // 1) Modo --fetch-pncp
  if (args.includes("--fetch-pncp")) {
    const fetchIdx = args.indexOf("--fetch-pncp");
    const caseDirIdx = args.indexOf("--case-dir");
    const pncpIdx = args.indexOf("--pncp");
    const shortnameIdx = args.indexOf("--shortname");

    let caseDir: string | undefined;
    if (caseDirIdx !== -1 && args[caseDirIdx + 1] && !args[caseDirIdx + 1].startsWith("--")) {
      caseDir = args[caseDirIdx + 1];
    }

    let pncpIdOrUrl: string | undefined;
    if (pncpIdx !== -1 && args[pncpIdx + 1] && !args[pncpIdx + 1].startsWith("--")) {
      pncpIdOrUrl = args[pncpIdx + 1];
    } else if (args[fetchIdx + 1] && !args[fetchIdx + 1].startsWith("--")) {
      pncpIdOrUrl = args[fetchIdx + 1];
    }

    let shortname: string | undefined;
    if (shortnameIdx !== -1 && args[shortnameIdx + 1] && !args[shortnameIdx + 1].startsWith("--")) {
      shortname = args[shortnameIdx + 1];
    }

    if (!caseDir) {
      console.error("Erro: Informe o diretório do caso usando --case-dir <dir>.");
      process.exit(1);
    }
    if (!pncpIdOrUrl) {
      console.error("Erro: Informe o identificador ou URL do PNCP usando --pncp <id_ou_url>.");
      process.exit(1);
    }

    try {
      const res = await fetchPncpContract(caseDir, pncpIdOrUrl, { shortname });
      const synthetic = formatFetchPncpSyntheticResult(res);
      console.log(JSON.stringify(synthetic, null, 2));
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return true;
  }

  // 2) Modo --search-pncp
  if (args.includes("--search-pncp")) {
    const searchIdx = args.indexOf("--search-pncp");
    const caseDirIdx = args.indexOf("--case-dir");
    const queryIdx = args.indexOf("--query");
    const statusIdx = args.indexOf("--status");
    const ufIdx = args.indexOf("--uf");
    const modalidadeIdx = args.indexOf("--modalidade");
    const limitIdx = args.indexOf("--limit");

    let caseDir: string | undefined;
    if (caseDirIdx !== -1 && args[caseDirIdx + 1] && !args[caseDirIdx + 1].startsWith("--")) {
      caseDir = args[caseDirIdx + 1];
    }

    let query: string | undefined;
    if (queryIdx !== -1 && args[queryIdx + 1] && !args[queryIdx + 1].startsWith("--")) {
      query = args[queryIdx + 1];
    } else if (args[searchIdx + 1] && !args[searchIdx + 1].startsWith("--")) {
      query = args[searchIdx + 1];
    }

    const status = statusIdx !== -1 && args[statusIdx + 1] && !args[statusIdx + 1].startsWith("--")
      ? (args[statusIdx + 1] as any)
      : undefined;
    const uf = ufIdx !== -1 && args[ufIdx + 1] && !args[ufIdx + 1].startsWith("--")
      ? args[ufIdx + 1]
      : undefined;
    const modalidade = modalidadeIdx !== -1 && args[modalidadeIdx + 1] && !args[modalidadeIdx + 1].startsWith("--")
      ? args[modalidadeIdx + 1]
      : undefined;
    const limit = limitIdx !== -1 && args[limitIdx + 1] && !args[limitIdx + 1].startsWith("--")
      ? parseInt(args[limitIdx + 1], 10)
      : undefined;

    if (!caseDir) {
      console.error("Erro: Informe o diretório do caso usando --case-dir <dir>.");
      process.exit(1);
    }
    if (!query) {
      console.error("Erro: Informe o termo de busca usando --query <termo>.");
      process.exit(1);
    }

    try {
      const res = await searchPncpContracts(caseDir, query, { status, uf, modalidade, limit });
      const synthetic = formatSearchPncpSyntheticResult(res);
      console.log(JSON.stringify(synthetic, null, 2));
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return true;
  }

  // 3) Modo --search-juris
  if (args.includes("--search-juris")) {
    const searchIdx = args.indexOf("--search-juris");
    const queryIdx = args.indexOf("--query");
    const caseDirIdx = args.indexOf("--case-dir");
    const courtsIdx = args.indexOf("--courts");
    const ufIdx = args.indexOf("--uf");
    const stanceIdx = args.indexOf("--stance");
    const regimeIdx = args.indexOf("--regime");
    const limitIdx = args.indexOf("--limit");

    let query: string | undefined;
    if (queryIdx !== -1 && args[queryIdx + 1] && !args[queryIdx + 1].startsWith("--")) {
      query = args[queryIdx + 1];
    } else if (args[searchIdx + 1] && !args[searchIdx + 1].startsWith("--")) {
      query = args[searchIdx + 1];
    }

    if (!query) {
      console.error("Erro: Informe a expressão de busca usando --search-juris <query> ou --query <query>.");
      process.exit(1);
    }

    const caseDir = caseDirIdx !== -1 && args[caseDirIdx + 1] && !args[caseDirIdx + 1].startsWith("--")
      ? args[caseDirIdx + 1]
      : undefined;
    const courts = courtsIdx !== -1 && args[courtsIdx + 1] && !args[courtsIdx + 1].startsWith("--")
      ? args[courtsIdx + 1].split(",").map((s) => s.trim())
      : undefined;
    const uf = ufIdx !== -1 && args[ufIdx + 1] && !args[ufIdx + 1].startsWith("--")
      ? args[ufIdx + 1]
      : undefined;
    const stance = stanceIdx !== -1 && args[stanceIdx + 1] && !args[stanceIdx + 1].startsWith("--")
      ? (args[stanceIdx + 1] as any)
      : undefined;
    const regime = regimeIdx !== -1 && args[regimeIdx + 1] && !args[regimeIdx + 1].startsWith("--")
      ? (args[regimeIdx + 1] as any)
      : undefined;
    const limit = limitIdx !== -1 && args[limitIdx + 1] && !args[limitIdx + 1].startsWith("--")
      ? parseInt(args[limitIdx + 1], 10)
      : undefined;

    try {
      const res = await searchJuris({ query, caseDir, courts, uf, stance, regime, limit });
      const synthetic = formatSearchJurisSyntheticResult(res.fileResult, res.mdPath);
      console.log(JSON.stringify(synthetic, null, 2));
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return true;
  }

  // 4) Modo --fetch-juris
  if (args.includes("--fetch-juris")) {
    const fetchIdx = args.indexOf("--fetch-juris");
    const idIdx = args.indexOf("--id");
    const caseDirIdx = args.indexOf("--case-dir");
    const shortnameIdx = args.indexOf("--shortname");
    const topicIdx = args.indexOf("--topic");
    const stanceIdx = args.indexOf("--stance");

    let acordaoId: string | undefined;
    if (idIdx !== -1 && args[idIdx + 1] && !args[idIdx + 1].startsWith("--")) {
      acordaoId = args[idIdx + 1];
    } else if (args[fetchIdx + 1] && !args[fetchIdx + 1].startsWith("--")) {
      acordaoId = args[fetchIdx + 1];
    }

    if (!acordaoId) {
      console.error("Erro: Informe o identificador do acórdão usando --fetch-juris <id> ou --id <id>.");
      process.exit(1);
    }

    const caseDir = caseDirIdx !== -1 && args[caseDirIdx + 1] && !args[caseDirIdx + 1].startsWith("--")
      ? args[caseDirIdx + 1]
      : undefined;
    const shortname = shortnameIdx !== -1 && args[shortnameIdx + 1] && !args[shortnameIdx + 1].startsWith("--")
      ? args[shortnameIdx + 1]
      : undefined;
    const topicFilter = topicIdx !== -1 && args[topicIdx + 1] && !args[topicIdx + 1].startsWith("--")
      ? args[topicIdx + 1]
      : undefined;
    const stance = stanceIdx !== -1 && args[stanceIdx + 1] && !args[stanceIdx + 1].startsWith("--")
      ? (args[stanceIdx + 1] as any)
      : undefined;

    try {
      const res = await fetchJuris({ acordaoIdOrUrl: acordaoId, caseDir, shortname, topicFilter, stance });
      const synthetic = formatFetchJurisSyntheticResult(res);
      console.log(JSON.stringify(synthetic, null, 2));
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return true;
  }

  return false;
}
