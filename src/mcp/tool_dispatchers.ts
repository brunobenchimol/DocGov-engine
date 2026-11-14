// ============================================================================
// Dispatchers Modulares de Ferramentas MCP (Gen5.5 e Jurisprudência)
// docgov-engine v1.5.5 — src/mcp/tool_dispatchers.ts
// ============================================================================

import {
  searchJuris,
  formatSearchJurisSyntheticResult,
  fetchJuris,
  formatFetchJurisSyntheticResult,
} from "../tools/juris/index.ts";
import { auditContractExecution } from "../contracts/audit_contract_execution.ts";
import { governArpExecution } from "../arp/govern_arp.ts";
import { resolveWorkspacePath } from "../utils/paths.ts";

export async function dispatchModularTool(
  toolName: string,
  args: Record<string, any> = {}
): Promise<{ content: Array<{ type: "text"; text: string }> } | null> {
  // 1. Ferramenta Gen5 / Gen5.5: Fiscalização Contratual, Aditivos, PAS e Cesta
  if (toolName === "docgov_audit_contract_execution" || toolName === "audit_contract_execution") {
    const inputTarget = args.contractJsonPath || args.inputPath || args.contractPath || args.input || args;
    const { synthetic } = await auditContractExecution(inputTarget, {
      caseDir: args.caseDir,
      outputDir: args.outputDir,
      auditType: args.auditType || args.type,
      compilationMode: args.compilationMode || args.mode,
      outputFormat: args.outputFormat || args.format,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(synthetic, null, 2),
        },
      ],
    };
  }

  // 2. Ferramenta Gen5: Governança Determinística de ARP e Caronas
  if (toolName === "docgov_govern_arp" || toolName === "govern_arp") {
    const inputTarget = args.arpJsonPath || args.inputPath || args.arpPath || args.input || args;
    const { synthetic } = await governArpExecution(inputTarget, {
      caseDir: args.caseDir,
      outputDir: args.outputDir,
      compilationMode: args.compilationMode || args.mode,
      outputFormat: args.outputFormat || args.format,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(synthetic, null, 2),
        },
      ],
    };
  }

  // 3. Ferramenta Jurisprudência: Pesquisa Multicortes (Marco 7)
  if (toolName === "search_juris") {
    if (!args.query) {
      throw new Error("Parâmetro obrigatório 'query' não fornecido para search_juris.");
    }
    const res = await searchJuris({
      query: args.query,
      caseDir: args.caseDir,
      courts: args.courts,
      uf: args.uf,
      stance: args.stance,
      regime: args.regime,
      colegiado: args.colegiado,
      limit: args.limit,
    });
    const synthetic = formatSearchJurisSyntheticResult(res.fileResult, res.mdPath);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(synthetic, null, 2),
        },
      ],
    };
  }

  // 4. Ferramenta Jurisprudência: Captura Integral e Fatiamento Anatômico (Marco 7)
  if (toolName === "fetch_juris") {
    if (!args.acordaoIdOrUrl) {
      throw new Error("Parâmetro obrigatório 'acordaoIdOrUrl' não fornecido para fetch_juris.");
    }
    const res = await fetchJuris({
      acordaoIdOrUrl: args.acordaoIdOrUrl,
      caseDir: args.caseDir,
      shortname: args.shortname,
      topicFilter: args.topicFilter,
      stance: args.stance,
    });
    const synthetic = formatFetchJurisSyntheticResult(res);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(synthetic, null, 2),
        },
      ],
    };
  }

  return null;
}
