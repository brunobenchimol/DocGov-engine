// ============================================================================
// Orquestrador: Auditoria e Fiscalização Contratual Contínua (Gen5.5)
// docgov-engine v1.5.5 — src/contracts/audit_contract_execution.ts
// Ferramenta MCP: docgov_audit_contract_execution | CLI: audit-contract
// ============================================================================

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative, basename } from "node:path";
import { VERSION } from "../constants/index.ts";
import { safeReadJsonFile } from "../utils/json.ts";
import { resolveWorkspacePath, getEphemeralInspectDir } from "../utils/paths.ts";
import { auditContractAddendums } from "./addendum_auditor.ts";
import { matchTripartiteExecution } from "./tripartite_matcher.ts";
import { auditReadjustmentsAndRepactuations } from "./readjustment_auditor.ts";
import { auditPasSanctionsAndGuarantees } from "./pas_sanction_auditor.ts";
import { auditPriceBasketAndRebalance } from "./price_basket_auditor.ts";
import { compileContractExecutionArtifacts } from "./contract_compiler.ts";
import type {
  RawContractInput,
  AuditContractOptions,
  ContractAuditReport,
  AuditContractSyntheticResult,
} from "./types.ts";

function toCompactPath(absPath: string): string {
  const normAbs = absPath.replace(/\\/g, "/");
  const normCwd = process.cwd().replace(/\\/g, "/").replace(/\/$/, "");
  if (normAbs.startsWith(`${normCwd}/`)) {
    const rel = relative(normCwd, normAbs).replace(/\\/g, "/");
    if (rel && rel.length < normAbs.length) return rel;
  }
  return normAbs;
}

function buildCompactSyntheticResult(
  report: ContractAuditReport,
  reportJsonPath: string,
  dossierMdPath: string
): AuditContractSyntheticResult {
  const compiledNames = Object.values(report.compiled_artifacts || {})
    .filter((v): v is string => Boolean(v))
    .map((p) => basename(p));

  const s = report.adherence_summary;
  const synthetic: AuditContractSyntheticResult = {
    status: report.status,
    engine_version: report.engine_version,
    contract_id: report.contract_id,
    legal_regime: report.legal_regime,
    blocking_tags: report.blocking_tags,
    adherence_summary: {
      gross_increase_pct: s.gross_increase_pct,
      gross_decrease_pct: s.gross_decrease_pct,
      legal_limit_pct: s.legal_limit_pct,
      tripartite_overpricing_count: s.tripartite_overpricing_count,
      readjustment_violations_count: s.readjustment_violations_count,
      ...(s.pas_violations_count ? { pas_violations_count: s.pas_violations_count } : {}),
      ...(s.price_basket_warnings_count
        ? { price_basket_warnings_count: s.price_basket_warnings_count }
        : {}),
      ...(s.rebalance_violations_count
        ? { rebalance_violations_count: s.rebalance_violations_count }
        : {}),
    },
    report_json_path: toCompactPath(reportJsonPath),
    dossier_md_path: toCompactPath(dossierMdPath),
    ...(compiledNames.length > 0 ? { compiled_artifacts: compiledNames } : {}),
    next_step_hint:
      report.blocking_tags.length > 0
        ? `Bloqueio ativo (${report.blocking_tags.length} apontamento(s)). Inspecione o dossiê.`
        : "Auditoria concluída com conformidade plena.",
  };

  const sizeOf = (obj: unknown) =>
    Buffer.byteLength(JSON.stringify(obj, null, 2), "utf-8");
  const minSizeOf = (obj: unknown) =>
    Buffer.byteLength(JSON.stringify(obj), "utf-8");

  if (sizeOf(synthetic) > 850 && synthetic.compiled_artifacts) {
    delete synthetic.compiled_artifacts;
  }
  if (sizeOf(synthetic) > 850) {
    synthetic.next_step_hint = "Veja dossie_fiscalizacao_contratual.md.";
  }
  if (sizeOf(synthetic) > 850) {
    synthetic.adherence_summary = {
      gross_increase_pct: s.gross_increase_pct,
      gross_decrease_pct: s.gross_decrease_pct,
      legal_limit_pct: s.legal_limit_pct,
      tripartite_overpricing_count: s.tripartite_overpricing_count,
      readjustment_violations_count: s.readjustment_violations_count,
    };
  }
  if (sizeOf(synthetic) > 850) {
    synthetic.report_json_path = basename(reportJsonPath);
    synthetic.dossier_md_path = basename(dossierMdPath);
    synthetic.next_step_hint = "Veja dossiê.";
  }
  if (sizeOf(synthetic) > 850) {
    synthetic.adherence_summary = {
      legal_limit_pct: s.legal_limit_pct,
    };
  }

  // Quando há muitas tags longas (ex.: estresse de 12+ tags), compacta em JSON minificado mantendo todas as tags
  if (sizeOf(synthetic) > 850) {
    if (minSizeOf(synthetic) > 850) {
      delete synthetic.next_step_hint;
    }
    if (minSizeOf(synthetic) > 850) {
      delete synthetic.adherence_summary;
    }
    if (minSizeOf(synthetic) > 850) {
      delete synthetic.legal_regime;
    }
    if (minSizeOf(synthetic) > 850 && synthetic.contract_id.length > 24) {
      synthetic.contract_id = synthetic.contract_id.slice(0, 24);
    }
  }

  return synthetic;
}

export function serializeSyntheticAuditResult(
  synthetic: AuditContractSyntheticResult
): string {
  const pretty = JSON.stringify(synthetic, null, 2);
  if (Buffer.byteLength(pretty, "utf-8") <= 850) {
    return pretty;
  }
  return JSON.stringify(synthetic);
}

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
  const objectType =
    rawData.object_type ||
    rawData.objectType ||
    rawData.contract_type ||
    rawData.contractType ||
    "SERVICE";
  const targetInstrument = rawData.target_instrument || rawData.targetInstrument || "CONTRACT";

  // Execução dos 5 módulos determinísticos (Gen5 + Gen5.5)
  const addendumRes = auditContractAddendums(rawData);
  const tripartiteRes = matchTripartiteExecution(rawData);
  const readjustmentRes = auditReadjustmentsAndRepactuations(rawData);
  const pasRes = auditPasSanctionsAndGuarantees(rawData);
  const basketRes = auditPriceBasketAndRebalance(rawData);

  // Consolidação de tags de bloqueio determinísticas
  const blockingTagsSet = new Set<string>();
  addendumRes.blocking_tags.forEach((t) => blockingTagsSet.add(t));
  tripartiteRes.blocking_tags.forEach((t) => blockingTagsSet.add(t));
  readjustmentRes.blocking_tags.forEach((t) => blockingTagsSet.add(t));
  pasRes.blocking_tags.forEach((t) => blockingTagsSet.add(t));
  basketRes.blocking_tags.forEach((t) => blockingTagsSet.add(t));
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
      pas_violations_count: pasRes.violations_count,
      price_basket_warnings_count:
        basketRes.price_basket_analysis.high_dispersion_warnings_count,
      rebalance_violations_count:
        basketRes.extraordinary_rebalance_analysis.violations_count,
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
    pas_sanctions_analysis: {
      processes_analyzed: pasRes.processes_analyzed,
      violations_count: pasRes.violations_count,
      competent_audit_court: pasRes.competent_audit_court,
      processes: pasRes.processes,
    },
    price_basket_analysis: basketRes.price_basket_analysis,
    extraordinary_rebalance_analysis: basketRes.extraordinary_rebalance_analysis,
  };

  // Compilação opcional DOCX/PDF (Marco 8.5)
  const compilationMode =
    options.compilationMode ||
    options.mode ||
    rawData.compilation_mode ||
    rawData.compilationMode ||
    rawData.mode ||
    "NONE";
  const outputFormat =
    options.outputFormat ||
    options.format ||
    rawData.output_format ||
    rawData.outputFormat ||
    rawData.format ||
    "both";

  const compiledArtifacts = await compileContractExecutionArtifacts(
    report,
    outDir,
    compilationMode,
    outputFormat
  );
  if (compiledArtifacts) {
    report.compiled_artifacts = compiledArtifacts;
  }

  const reportJsonPath = join(outDir, "relatorio_fiscalizacao_contratual.json");
  writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), "utf8");

  const dossierMd = generateDossierMarkdown(report);
  const dossierMdPath = join(outDir, "dossie_fiscalizacao_contratual.md");
  writeFileSync(dossierMdPath, dossierMd, "utf8");

  const synthetic = buildCompactSyntheticResult(report, reportJsonPath, dossierMdPath);
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

  if (report.pas_sanctions_analysis && report.pas_sanctions_analysis.processes_analyzed > 0) {
    lines.push(`\n## 4. Processo Administrativo Sancionador (PAS), Adequação Federativa, Glosa ANS/IMR e Garantias`);
    lines.push(
      `- **Processos/Glosas Analisados:** ${report.pas_sanctions_analysis.processes_analyzed} | **Violações:** ${report.pas_sanctions_analysis.violations_count}` +
        (report.pas_sanctions_analysis.competent_audit_court
          ? ` | **Corte de Contas Competente:** \`${report.pas_sanctions_analysis.competent_audit_court}\``
          : "")
    );
    report.pas_sanctions_analysis.processes.forEach((p) => {
      const fedInfo = p.federative_adequacy
        ? ` | Esfera=${p.federative_adequacy.sphere} | Corte=${p.federative_adequacy.competent_audit_court} | EscopoOK=${p.federative_adequacy.territorial_scope_ok ? "OK" : "BLOQ"} | Cadastros=${p.federative_adequacy.registries_ok ? "OK" : "OMISSÃO"}`
        : "";
      const calInfo = p.dosimetry_calibration
        ? ` | CalibragemLINDB=${p.dosimetry_calibration.calibrated_with_precedents && p.dosimetry_calibration.lindb_art22_vectors_weighed ? "OK" : "PENDENTE"} | Proporcional=${p.dosimetry_calibration.proportionality_ok ? "OK" : "OUTLIER"}`
        : "";
      lines.push(
        `- **${p.process_id}:** Sugestão=\`${p.recommended_sanction}\` (${p.recommended_scope}) | Multa=${p.fine_pct !== undefined ? `${p.fine_pct}%` : "N/A"} | Contraditório 15d=${p.contradictory_15_days_ok ? "OK" : "VIOLADO"} | Seguradora=${p.insurer_notification_ok ? "OK" : "PENDENTE"}${fedInfo}${calInfo}${p.justification ? ` | ${p.justification}` : ""}`
      );
    });
  }

  const basketCount = report.price_basket_analysis?.items_analyzed || 0;
  const rebalCount = report.extraordinary_rebalance_analysis?.events_analyzed || 0;
  if (basketCount > 0 || rebalCount > 0) {
    lines.push(`\n## 5. Cesta de Preços (IN 65/2021) e Reequilíbrio / Matriz de Riscos`);
    report.price_basket_analysis?.items.forEach((b) => {
      lines.push(`- **Cesta ${b.item_id}:** Média=${b.mean} | Mediana=${b.median} | Desvio Padrão=${b.std_dev} | CV=${b.cv_pct}% | Média Saneada=${b.sanitized_mean} | Método Recomendado=\`${b.recommended_method}\` (${b.recommended_reference_price})`);
    });
    report.extraordinary_rebalance_analysis?.events.forEach((e) => {
      lines.push(`- **Reequilíbrio ${e.id}:** Natureza=\`${e.event_nature}\` | Risco=\`${e.risk_allocated_to}\` | Elegível=${e.eligible_for_revision ? "SIM" : "NÃO"}${e.reason ? ` | ${e.reason}` : ""}`);
    });
  }

  return lines.join("\n");
}
