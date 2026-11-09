// ============================================================================
// Orquestrador: Auditoria e Fiscalização Contratual Contínua (Gen5)
// docgov-engine v1.5.0 — src/contracts/audit_contract_execution.ts
// Ferramenta MCP: docgov_audit_contract_execution | CLI: audit-contract
// ============================================================================

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { VERSION } from "../constants/index.ts";
import { safeReadJsonFile } from "../utils/json.ts";
import { resolveWorkspacePath, getEphemeralInspectDir } from "../utils/paths.ts";
import { auditContractAddendums } from "./addendum_auditor.ts";
import { matchTripartiteExecution } from "./tripartite_matcher.ts";
import { auditReadjustmentsAndRepactuations } from "./readjustment_auditor.ts";
import type {
  RawContractInput,
  AuditContractOptions,
  ContractAuditReport,
  AuditContractSyntheticResult,
} from "./types.ts";

export async function auditContractExecution(
  inputOrPath: RawContractInput | string,
  options: AuditContractOptions = {}
): Promise<{ report: ContractAuditReport; synthetic: AuditContractSyntheticResult }> {
  let rawData: RawContractInput;
  let sourceFilePath: string | undefined;

  if (typeof inputOrPath === "string") {
    sourceFilePath = resolveWorkspacePath(inputOrPath);
    rawData = (safeReadJsonFile(sourceFilePath) || {}) as RawContractInput;
  } else {
    rawData = inputOrPath || {};
  }

  const contractId = rawData.contract_id || rawData.contractId || "CONTRATO_GENERICO";
  const legalRegime = rawData.legal_regime || rawData.legalRegime || "LEI_14133";
  const objectType = rawData.object_type || rawData.objectType || rawData.contract_type || rawData.contractType || "SERVICE";
  const targetInstrument = rawData.target_instrument || rawData.targetInstrument || "CONTRACT";

  // Execução dos 3 módulos determinísticos
  const addendumRes = auditContractAddendums(rawData);
  const tripartiteRes = matchTripartiteExecution(rawData);
  const readjustmentRes = auditReadjustmentsAndRepactuations(rawData);

  // Consolidação de tags de bloqueio determinísticas
  const blockingTagsSet = new Set<string>();
  addendumRes.blocking_tags.forEach((t) => blockingTagsSet.add(t));
  tripartiteRes.blocking_tags.forEach((t) => blockingTagsSet.add(t));
  readjustmentRes.blocking_tags.forEach((t) => blockingTagsSet.add(t));
  const blocking_tags = Array.from(blockingTagsSet);

  const status: "success" | "blocked" | "warning" =
    blocking_tags.length > 0 ? "blocked" : "success";

  // Resolução do diretório de saída
  let outDir: string;
  if (options.outputDir) {
    outDir = resolveWorkspacePath(options.outputDir);
  } else if (options.caseDir) {
    outDir = resolveWorkspacePath(join(options.caseDir, "state"));
  } else if (sourceFilePath) {
    outDir = dirname(sourceFilePath);
  } else {
    outDir = join(getEphemeralInspectDir(), `contract_audit_${Date.now()}`);
  }

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const report: ContractAuditReport = {
    status,
    engine_version: VERSION,
    contract_id: contractId,
    legal_regime: legalRegime,
    object_type: objectType,
    target_instrument: targetInstrument,
    blocking_tags,
    adherence_summary: {
      gross_increase_pct: addendumRes.gross_increase_pct,
      gross_decrease_pct: addendumRes.gross_decrease_pct,
      legal_limit_pct: addendumRes.legal_limit_pct,
      compensation_attempted: addendumRes.compensation_attempted,
      tripartite_overpricing_count: tripartiteRes.divergent_items_count,
      readjustment_violations_count: readjustmentRes.violations_count,
    },
    addendums_analysis: {
      total_increase: addendumRes.total_increase,
      total_decrease: addendumRes.total_decrease,
      initial_base_value: addendumRes.initial_base_value,
      is_reform: addendumRes.is_reform,
      has_unilateral_state_enterprise: addendumRes.has_unilateral_state_enterprise,
      has_direct_arp_addendum: addendumRes.has_direct_arp_addendum,
      details: addendumRes.details,
    },
    tripartite_analysis: {
      items_analyzed: tripartiteRes.items_analyzed,
      divergent_items_count: tripartiteRes.divergent_items_count,
      total_overpricing_value: tripartiteRes.total_overpricing_value,
      items: tripartiteRes.items,
    },
    readjustment_analysis: {
      events_analyzed: readjustmentRes.events_analyzed,
      violations_count: readjustmentRes.violations_count,
      events: readjustmentRes.events,
    },
  };

  const reportJsonPath = join(outDir, "relatorio_fiscalizacao_contratual.json");
  writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), "utf8");

  const dossierMd = generateDossierMarkdown(report);
  const dossierMdPath = join(outDir, "dossie_fiscalizacao_contratual.md");
  writeFileSync(dossierMdPath, dossierMd, "utf8");

  const synthetic: AuditContractSyntheticResult = {
    status,
    engine_version: VERSION,
    contract_id: contractId,
    legal_regime: legalRegime,
    blocking_tags,
    adherence_summary: {
      gross_increase_pct: addendumRes.gross_increase_pct,
      gross_decrease_pct: addendumRes.gross_decrease_pct,
      legal_limit_pct: addendumRes.legal_limit_pct,
      tripartite_overpricing_count: tripartiteRes.divergent_items_count,
      readjustment_violations_count: readjustmentRes.violations_count,
    },
    report_json_path: reportJsonPath.replace(/\\/g, "/"),
    dossier_md_path: dossierMdPath.replace(/\\/g, "/"),
    next_step_hint:
      blocking_tags.length > 0
        ? `Bloqueio determinístico ativo (${blocking_tags.length} apontamentos). Inspecione o dossiê pericial gerado.`
        : "Auditoria concluída com conformidade plena.",
  };

  return { report, synthetic };
}

function generateDossierMarkdown(report: ContractAuditReport): string {
  const lines: string[] = [];
  lines.push(`# Dossiê Pericial de Fiscalização Contratual — docgov-engine v${report.engine_version}`);
  lines.push(`\n**Instrumento:** \`${report.contract_id}\` | **Regime:** \`${report.legal_regime}\` | **Tipo:** \`${report.object_type}\``);
  lines.push(`**Status Geral:** **${report.status.toUpperCase()}**`);

  if (report.blocking_tags.length > 0) {
    lines.push(`\n## ⚠️ Apontamentos Críticos e Tags de Bloqueio`);
    report.blocking_tags.forEach((tag) => lines.push(`- \`${tag}\``));
  }

  lines.push(`\n## 1. Auditoria de Aditamentos (Art. 125 Lei 14.133 / Art. 81 Lei 13.303)`);
  lines.push(`- **Acréscimo Bruto Acumulado:** ${report.adherence_summary.gross_increase_pct}% (Limite Legal: ${report.adherence_summary.legal_limit_pct}%)`);
  lines.push(`- **Supressão Bruta Acumulada:** ${report.adherence_summary.gross_decrease_pct}%`);
  lines.push(`- **Tentativa de Compensação:** ${report.adherence_summary.compensation_attempted ? "DETECTADA (VEDADA)" : "Não detectada"}`);

  lines.push(`\n## 2. Batimento Tripartite / Quadripartite`);
  lines.push(`- **Itens Analisados:** ${report.tripartite_analysis.items_analyzed}`);
  lines.push(`- **Divergências / Sobrepreço:** ${report.tripartite_analysis.divergent_items_count} item(ns)`);
  if (report.tripartite_analysis.total_overpricing_value > 0) {
    lines.push(`- **Impacto Financeiro Estimado:** R$ ${report.tripartite_analysis.total_overpricing_value.toFixed(2)}`);
  }

  lines.push(`\n## 3. Reajustes e Repactuações`);
  lines.push(`- **Eventos Analisados:** ${report.readjustment_analysis.events_analyzed}`);
  lines.push(`- **Violações de Interregno/CCT:** ${report.readjustment_analysis.violations_count}`);

  return lines.join("\n");
}
