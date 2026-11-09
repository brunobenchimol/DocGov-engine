// ============================================================================
// Handlers CLI: Fiscalização Contratual e Governança de ARP (Gen5)
// docgov-engine v1.5.0 — src/cli/contracts_cli.ts
// Comandos: audit-contract (--audit-contract) e govern-arp (--govern-arp)
// ============================================================================

import { resolveWorkspacePath } from "../utils/paths.ts";
import { auditContractExecution } from "../contracts/audit_contract_execution.ts";
import { governArpExecution } from "../arp/govern_arp.ts";
import type { ArpCompilationMode } from "../arp/types.ts";

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

  if (!isAuditContract && !isGovernArp) {
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

    try {
      const { synthetic } = await auditContractExecution(inputPath, {
        caseDir,
        outputDir,
        auditType,
      });
      console.log(JSON.stringify(synthetic, null, 2));
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

  return false;
}
