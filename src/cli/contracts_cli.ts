// ============================================================================
// Handlers CLI: Fiscalização Contratual e Governança de ARP (Gen5.5)
// docgov-engine v1.5.5 — src/cli/contracts_cli.ts
// Comandos: audit-contract (--audit-contract) e govern-arp (--govern-arp)
// ============================================================================

import { resolveWorkspacePath } from "../utils/paths.ts";
import {
  auditContractExecution,
  serializeSyntheticAuditResult,
} from "../contracts/audit_contract_execution.ts";
import { governArpExecution } from "../arp/govern_arp.ts";
import {
  evaluateBiddingProposals,
  serializeBiddingSyntheticResult,
} from "../bidding/index.ts";
import {
  auditDirectContracting,
  serializeDirectContractingSyntheticResult,
} from "../direct_contracting/index.ts";
import type { ArpCompilationMode } from "../arp/types.ts";
import type { ContractCompilationMode } from "../contracts/types.ts";

function extractArg(args: string[], flags: string[]): string | undefined {
  for (const flag of flags) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) {
      return args[idx + 1];
    }
  }
  return undefined;
}

export async function handleContractsCli(args: string[]): Promise<boolean> {
  const isAuditContract =
    args.includes("audit-contract") ||
    args.includes("--audit-contract");

  const isGovernArp =
    args.includes("govern-arp") ||
    args.includes("--govern-arp");

  const isEvaluateProposals =
    args.includes("evaluate-proposals") ||
    args.includes("--evaluate-proposals");

  const isAuditDirect =
    args.includes("audit-direct-contracting") ||
    args.includes("--audit-direct-contracting");

  if (!isAuditContract && !isGovernArp && !isEvaluateProposals && !isAuditDirect) {
    return false;
  }

  // 1. Comando: audit-contract
  if (isAuditContract) {
    let inputPath = extractArg(args, [
      "--input",
      "--contract",
      "--contract-json",
      "-i",
    ]);

    // Suporte a 1º argumento posicional se for .json
    if (!inputPath) {
      const cmdIdx = args.findIndex((a) => a === "audit-contract" || a === "--audit-contract");
      if (cmdIdx !== -1 && args[cmdIdx + 1] && !args[cmdIdx + 1].startsWith("--")) {
        inputPath = args[cmdIdx + 1];
      }
    }

    if (!inputPath) {
      console.error("Erro: Informe o arquivo de dados contratuais usando --contract-json <arquivo.json> ou --input <arquivo.json>.");
      process.exit(1);
    }

    const outputDir = extractArg(args, ["--output-dir", "--output", "-o"]);
    const caseDir = extractArg(args, ["--case-dir", "-c"]);
    const auditType = extractArg(args, ["--type", "--audit-type"]) as any;
    const compilationMode = extractArg(args, ["--mode", "--compilation-mode"]) as ContractCompilationMode;
    const outputFormat = extractArg(args, ["--format", "--output-format"]) as "docx" | "pdf" | "both" | undefined;

    try {
      const { synthetic } = await auditContractExecution(inputPath, {
        caseDir,
        outputDir,
        auditType,
        compilationMode,
        outputFormat,
      });
      console.log(serializeSyntheticAuditResult(synthetic));
      return true;
    } catch (err: any) {
      console.error(`Erro ao executar auditoria contratual: ${err.message}`);
      process.exit(1);
    }
  }

  // 2. Comando: govern-arp
  if (isGovernArp) {
    let inputPath = extractArg(args, [
      "--input",
      "--arp",
      "--arp-json",
      "-i",
    ]);

    // Suporte a 1º argumento posicional se for .json
    if (!inputPath) {
      const cmdIdx = args.findIndex((a) => a === "govern-arp" || a === "--govern-arp");
      if (cmdIdx !== -1 && args[cmdIdx + 1] && !args[cmdIdx + 1].startsWith("--")) {
        inputPath = args[cmdIdx + 1];
      }
    }

    if (!inputPath) {
      console.error("Erro: Informe o arquivo de governança da ARP usando --arp-json <arquivo.json> ou --input <arquivo.json>.");
      process.exit(1);
    }

    const outputDir = extractArg(args, ["--output-dir", "--output", "-o"]);
    const caseDir = extractArg(args, ["--case-dir", "-c"]);
    const compilationMode = extractArg(args, ["--mode", "--compilation-mode"]) as ArpCompilationMode;
    const outputFormat = extractArg(args, ["--format", "--output-format"]) as any;

    try {
      const { synthetic } = await governArpExecution(inputPath, {
        caseDir,
        outputDir,
        compilationMode,
        outputFormat,
      });
      console.log(JSON.stringify(synthetic, null, 2));
      return true;
    } catch (err: any) {
      console.error(`Erro ao executar governança de ARP: ${err.message}`);
      process.exit(1);
    }
  }

  // 3. Comando Gen6: evaluate-proposals
  if (isEvaluateProposals) {
    let inputPath = extractArg(args, [
      "--input",
      "--bidding-json",
      "--proposal-json",
      "-i",
    ]);
    if (!inputPath) {
      const cmdIdx = args.findIndex(
        (a) => a === "evaluate-proposals" || a === "--evaluate-proposals"
      );
      if (cmdIdx !== -1 && args[cmdIdx + 1] && !args[cmdIdx + 1].startsWith("--")) {
        inputPath = args[cmdIdx + 1];
      }
    }
    if (!inputPath) {
      console.error(
        "Erro: Informe o JSON da proposta usando --bidding-json <arquivo.json> ou --input <arquivo.json>."
      );
      process.exit(1);
    }
    const outputDir = extractArg(args, ["--output-dir", "--output", "-o"]);
    const caseDir = extractArg(args, ["--case-dir", "-c"]);
    const evaluationStance = extractArg(args, ["--stance", "--evaluation-stance"]) as any;
    const compilationMode = extractArg(args, ["--mode", "--compilation-mode"]);
    const outputFormat = extractArg(args, ["--format", "--output-format"]) as any;

    try {
      const { synthetic } = await evaluateBiddingProposals(inputPath, {
        caseDir,
        outputDir,
        evaluationStance,
        compilationMode,
        outputFormat,
      });
      console.log(serializeBiddingSyntheticResult(synthetic));
      return true;
    } catch (err: any) {
      console.error(`Erro ao avaliar proposta TIC/ACT: ${err.message}`);
      process.exit(1);
    }
  }

  // 4. Comando Gen6: audit-direct-contracting
  if (isAuditDirect) {
    let inputPath = extractArg(args, [
      "--input",
      "--direct-json",
      "-i",
    ]);
    if (!inputPath) {
      const cmdIdx = args.findIndex(
        (a) => a === "audit-direct-contracting" || a === "--audit-direct-contracting"
      );
      if (cmdIdx !== -1 && args[cmdIdx + 1] && !args[cmdIdx + 1].startsWith("--")) {
        inputPath = args[cmdIdx + 1];
      }
    }
    if (!inputPath) {
      console.error(
        "Erro: Informe o JSON da contratação direta usando --direct-json <arquivo.json> ou --input <arquivo.json>."
      );
      process.exit(1);
    }
    const outputDir = extractArg(args, ["--output-dir", "--output", "-o"]);
    const caseDir = extractArg(args, ["--case-dir", "-c"]);
    const compilationMode = extractArg(args, ["--mode", "--compilation-mode"]);
    const outputFormat = extractArg(args, ["--format", "--output-format"]) as any;

    try {
      const { synthetic } = await auditDirectContracting(inputPath, {
        caseDir,
        outputDir,
        compilationMode,
        outputFormat,
      });
      console.log(serializeDirectContractingSyntheticResult(synthetic));
      return true;
    } catch (err: any) {
      console.error(`Erro ao auditar contratação direta: ${err.message}`);
      process.exit(1);
    }
  }

  return false;
}
