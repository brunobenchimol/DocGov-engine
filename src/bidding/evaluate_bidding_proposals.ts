// ============================================================================
// Orquestrador: Seleção do Fornecedor 360º TIC & ACT Forense (Gen6)
// docgov-engine v1.6.0 — src/bidding/evaluate_bidding_proposals.ts
// Ferramenta MCP: docgov_evaluate_bidding_proposals | CLI: evaluate-proposals
// ============================================================================

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, basename, relative } from "node:path";
import { VERSION } from "../constants/index.ts";
import { safeReadJsonFile } from "../utils/json.ts";
import { resolveWorkspacePath, getEphemeralInspectDir } from "../utils/paths.ts";
import { evaluateIctExecutionAndExequibility } from "./ict_execution_models.ts";
import { evaluateQualification } from "./qualification_evaluator.ts";
import { auditActForensics } from "./act_forensic_auditor.ts";
import { compileBiddingArtifacts } from "./bidding_docx_compiler.ts";
import type {
  RawBiddingProposalInput,
  EvaluateBiddingOptions,
  BiddingProposalDossier,
  BiddingSyntheticResult,
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
  dossier: BiddingProposalDossier,
  jsonPath: string,
  mdPath: string
): BiddingSyntheticResult {
  const compiledNames = Object.values(dossier.compiled_artifacts || {})
    .filter((v): v is string => Boolean(v))
    .map((p) => basename(p));

  const synthetic: BiddingSyntheticResult = {
    status: dossier.status,
    engine_version: dossier.engine_version,
    process_id: dossier.process_id,
    decision: dossier.decision,
    proposal_decision: dossier.decision,
    blocking_tags: dossier.blocking_tags,
    act_forensic_alerts_count: dossier.act_forensics.total_alerts,
    compiled_docs_count: compiledNames.length,
    dossier_json_path: toCompactPath(jsonPath),
    dossier_md_path: toCompactPath(mdPath),
    ...(compiledNames.length > 0 ? { compiled_artifacts: compiledNames } : {}),
    next_step_hint:
      dossier.blocking_tags.length > 0
        ? `Bloqueio/diligência (${dossier.blocking_tags.length} tag(s)). Veja dossiê.`
        : "Seleção TIC e ACT conformes.",
  };

  const sizeOf = (o: unknown) => Buffer.byteLength(JSON.stringify(o, null, 2), "utf-8");
  const minSizeOf = (o: unknown) => Buffer.byteLength(JSON.stringify(o), "utf-8");

  if (sizeOf(synthetic) > 850 && synthetic.compiled_artifacts) {
    delete synthetic.compiled_artifacts;
  }
  if (sizeOf(synthetic) > 850) {
    synthetic.next_step_hint = "Veja dossie_julgamento_proposta_tic.md.";
  }
  if (sizeOf(synthetic) > 850) {
    synthetic.dossier_json_path = basename(jsonPath);
    synthetic.dossier_md_path = basename(mdPath);
    delete synthetic.next_step_hint;
  }
  if (minSizeOf(synthetic) > 850 && synthetic.process_id.length > 20) {
    synthetic.process_id = synthetic.process_id.slice(0, 20);
  }
  return synthetic;
}

export function serializeBiddingSyntheticResult(s: BiddingSyntheticResult): string {
  const pretty = JSON.stringify(s, null, 2);
  if (Buffer.byteLength(pretty, "utf-8") < 900) return pretty;
  return JSON.stringify(s);
}

function buildDossierMarkdown(d: BiddingProposalDossier): string {
  return [
    `# Dossiê de Seleção do Fornecedor 360º em TIC & ACT Forense — ${d.process_id}`,
    `- **Licitante:** ${d.bidder_name} (\`${d.bidder_cnpj}\`)`,
    `- **Regime:** ${d.legal_regime} | **Postura:** ${d.evaluation_stance}`,
    `- **Decisão:** **${d.decision}** | **Status:** \`${d.status}\``,
    "",
    "## Tags de Bloqueio / Alerta",
    ...(d.blocking_tags.length > 0 ? d.blocking_tags.map((t) => `- \`${t}\``) : ["- Nenhuma."]),
    "",
    "## 1. Modelo TIC sem DEMO & Exequibilidade",
    `- Métrica: \`${d.ict_execution.metric_type}\` | Piso Paramétrico: \`${d.ict_execution.parametric_floor_value}\` | Ofertado: \`${d.ict_execution.offered_unit_value ?? "N/A"}\``,
    ...d.ict_execution.findings.map((f) => `- ${f}`),
    "",
    "## 2. Habilitação Técnica (Conversibilidade) & Econômico-Financeira",
    `- Qtd Convertida: \`${d.qualification.converted_total_quantity}\` | ILG=\`${d.qualification.financial_indices.ilg}\` | ILC=\`${d.qualification.financial_indices.ilc}\` | ISG=\`${d.qualification.financial_indices.isg}\` | EG=\`${d.qualification.financial_indices.eg}\``,
    ...d.qualification.findings.map((f) => `- ${f}`),
    "",
    "## 3. Motor Forense Anti-Fraude de ACT (7 Vetores)",
    `- Atestados Auditados: \`${d.act_forensics.certificates_audited}\` | Alertas: \`${d.act_forensics.total_alerts}\``,
    ...d.act_forensics.items.flatMap((it) => [
      `### ${it.certificate_id} — ${it.issuer_name} (${it.issuer_cnpj})`,
      ...it.details.map((det) => `- ${det}`),
    ]),
  ].join("\n");
}

export async function evaluateBiddingProposals(
  inputOrPath: RawBiddingProposalInput | string,
  options: EvaluateBiddingOptions = {}
): Promise<{ dossier: BiddingProposalDossier; synthetic: BiddingSyntheticResult }> {
  let raw: RawBiddingProposalInput;
  let sourceFilePath: string | undefined;

  if (typeof inputOrPath === "string") {
    sourceFilePath = resolveWorkspacePath(inputOrPath);
    raw = (safeReadJsonFile(sourceFilePath) || {}) as RawBiddingProposalInput;
  } else {
    raw = inputOrPath || {};
  }

  const processId = raw.process_id || "PROC-TIC-GENERICO";
  const bidderName = raw.bidder_name || "LICITANTE_GENERICA";
  const bidderCnpj = raw.bidder_cnpj || "00.000.000/0001-00";
  const legalRegime = String(raw.legal_regime || "LEI_14133").toUpperCase();
  const stance = String(options.evaluationStance || raw.evaluation_stance || "DEFENSE").toUpperCase() === "ATTACK" ? "ATTACK" : "DEFENSE";

  const ictRes = evaluateIctExecutionAndExequibility(raw);
  const qualRes = evaluateQualification(raw);
  const actRes = auditActForensics(raw.act_forensic_items || []);

  const tagsSet = new Set<string>([
    ...ictRes.blocking_tags,
    ...qualRes.blocking_tags,
    ...actRes.blocking_tags,
  ]);
  const blocking_tags = Array.from(tagsSet);

  let decision: BiddingProposalDossier["decision"] = "APPROVED";
  if (blocking_tags.includes("[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]") || actRes.total_alerts > 0) {
    decision = "DILIGENCE_REQUIRED";
  }
  if (
    ictRes.demo_trap_detected ||
    !ictRes.metric_compliance_ok ||
    !qualRes.tech_rules_ok ||
    !qualRes.financial_rules_ok ||
    blocking_tags.includes("[ACT_CHRONOLOGY_OR_INACTIVE_CNPJ_FRAUD_BLOCK]")
  ) {
    decision = "REJECTED";
  }

  const status: BiddingProposalDossier["status"] =
    blocking_tags.length > 0 ? "blocked" : "success";

  let outDir: string;
  if (options.outputDir || raw.outputDir || raw.output_dir) {
    outDir = resolveWorkspacePath(options.outputDir || raw.outputDir || raw.output_dir!);
  } else if (options.caseDir || raw.caseDir || raw.case_dir) {
    outDir = resolveWorkspacePath(join(options.caseDir || raw.caseDir || raw.case_dir!, "state"));
  } else if (sourceFilePath) {
    outDir = dirname(sourceFilePath);
  } else {
    outDir = join(getEphemeralInspectDir(), `bidding_gen6_${Date.now()}`);
  }
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const compilationMode = String(
    options.compilationMode || raw.compilationMode || raw.compilation_mode || raw.mode || "NONE"
  ).toUpperCase();
  const outputFormat = (options.outputFormat || raw.outputFormat || raw.output_format || raw.format || "both") as
    | "docx"
    | "pdf"
    | "both";

  const dossier: BiddingProposalDossier = {
    status,
    engine_version: VERSION,
    process_id: processId,
    bidder_name: bidderName,
    bidder_cnpj: bidderCnpj,
    legal_regime: legalRegime,
    evaluation_stance: stance,
    decision,
    blocking_tags,
    ...(raw.estimated_total_value !== undefined ? { estimated_total_value: Number(raw.estimated_total_value) } : {}),
    ict_execution: ictRes,
    qualification: qualRes,
    act_forensics: actRes,
    raw_context: raw,
  };

  dossier.compiled_artifacts = await compileBiddingArtifacts(
    dossier,
    outDir,
    compilationMode,
    outputFormat
  );

  const jsonContent = JSON.stringify(dossier, null, 2);
  const mdContent = buildDossierMarkdown(dossier);

  const jsonPrimary = join(outDir, "dossie_julgamento_proposta_tic.json");
  const jsonAlias = join(outDir, "relatorio_julgamento_tic.json");
  const mdPrimary = join(outDir, "visao_julgamento_proposta_tic.md");
  const mdAlias = join(outDir, "dossie_julgamento_tic.md");

  writeFileSync(jsonPrimary, jsonContent, "utf8");
  writeFileSync(jsonAlias, jsonContent, "utf8");
  writeFileSync(mdPrimary, mdContent, "utf8");
  writeFileSync(mdAlias, mdContent, "utf8");

  const synthetic = buildCompactSyntheticResult(dossier, jsonPrimary, mdPrimary);
  return { dossier, synthetic };
}
