// ============================================================================
// Orquestrador: Seleção do Fornecedor 360º TIC & ACT Forense (Gen6)
// docgov-engine v1.6.0 — src/bidding/evaluate_bidding_proposals.ts
// Ferramenta MCP: docgov_evaluate_bidding_proposals | CLI: evaluate-proposals
// ============================================================================

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { VERSION } from "../constants/index.ts";
import {
  fitBlockingTagsToBudget,
  safeReadJsonFile,
  serializeCompactSyntheticResult,
  toCompactWorkspacePath,
} from "../utils/json.ts";
import { resolveWorkspacePath } from "../utils/paths.ts";
import {
  createIsolatedEphemeralDir,
  redirectInputsDirToSiblingState,
} from "../utils/ephemeral_scope.ts";
import { evaluateIctExecutionAndExequibility } from "./ict_execution_models.ts";
import { evaluateQualification } from "./qualification_evaluator.ts";
import {
  auditActForensics,
  hydrateActForensicsItems,
} from "./act_forensic_auditor.ts";
import { auditCompetingProposalsCollusion } from "./forensic_collusion_auditor.ts";
import { evaluateProposalInexequibility } from "./inexequibility_evaluator.ts";
import { evaluateAdministrativeAppeal } from "./appeals_evaluator.ts";
import { compileBiddingArtifacts } from "./bidding_docx_compiler.ts";
import {
  buildUnknownKeySchemaWarnings,
  detectBiddingUnknownKeys,
} from "../utils/forensics/gen6_contract_guard.ts";
import type {
  RawBiddingProposalInput,
  EvaluateBiddingOptions,
  BiddingProposalDossier,
  BiddingSyntheticResult,
} from "./types.ts";

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
    blocking_tags: [...dossier.blocking_tags],
    act_forensic_alerts_count: dossier.act_forensics.total_alerts,
    compiled_docs_count: compiledNames.length,
    dossier_json_path: toCompactWorkspacePath(jsonPath),
    dossier_md_path: toCompactWorkspacePath(mdPath),
    ...(compiledNames.length > 0 ? { compiled_artifacts: compiledNames } : {}),
    ...(dossier.unknown_keys && dossier.unknown_keys.length > 0
      ? { unknown_keys: dossier.unknown_keys.slice(0, 6) }
      : {}),
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
  if (sizeOf(synthetic) > 850) {
    if (minSizeOf(synthetic) > 880 && synthetic.unknown_keys) {
      delete synthetic.unknown_keys;
    }
    if (minSizeOf(synthetic) > 880) {
      delete synthetic.proposal_decision;
    }
    if (minSizeOf(synthetic) > 880) {
      delete synthetic.compiled_docs_count;
    }
    if (minSizeOf(synthetic) > 880) {
      delete synthetic.act_forensic_alerts_count;
    }
    if (minSizeOf(synthetic) > 880 && synthetic.process_id.length > 16) {
      synthetic.process_id = synthetic.process_id.slice(0, 16);
    }
    fitBlockingTagsToBudget(synthetic, 880);
  }
  return synthetic;
}

export function serializeBiddingSyntheticResult(s: BiddingSyntheticResult): string {
  return serializeCompactSyntheticResult(s, 850);
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
    ...(d.schema_warnings && d.schema_warnings.length > 0
      ? ["", "## Avisos de Contrato (Lei 3 — unknown_keys)", ...d.schema_warnings.map((w) => `- ${w}`)]
      : []),
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
  const hydratedActs = await hydrateActForensicsItems(raw.act_forensic_items || []);
  const actRes = auditActForensics(hydratedActs, { bidderName, bidderCnpj: raw.bidder_cnpj });
  const collusionRes = await auditCompetingProposalsCollusion(
    raw.competing_proposals_meta || []
  );
  const inexRes = evaluateProposalInexequibility(raw);
  const appealsRes = evaluateAdministrativeAppeal(raw.appeal_context, raw);
  const unknownKeys = detectBiddingUnknownKeys(raw);
  const schemaWarnings = buildUnknownKeySchemaWarnings(unknownKeys);

  const tagsSet = new Set<string>([
    ...ictRes.blocking_tags,
    ...qualRes.blocking_tags,
    ...actRes.blocking_tags,
    ...collusionRes.blocking_tags,
    ...inexRes.blocking_tags,
    ...appealsRes.blocking_tags,
  ]);
  const blocking_tags = Array.from(tagsSet);

  let decision: BiddingProposalDossier["decision"] = "APPROVED";
  if (
    blocking_tags.includes("[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]") ||
    blocking_tags.includes("[INEXEQUIBILITY_75_PCT_PRESUMPTION_DILIGENCE_REQUIRED]") ||
    blocking_tags.includes("[INEXEQUIBILITY_ADDITIONAL_GUARANTEE_85_PCT_REQUIRED]") ||
    blocking_tags.includes("[NEW_DOCUMENT_PRECLUSION_EXCEPTION_ACORDAO_1211_2021]") ||
    blocking_tags.includes("[HIERARCHICAL_REMISSION_10_DAYS_MANDATORY]") ||
    actRes.total_alerts > 0 ||
    collusionRes.blocking_tags.length > 0
  ) {
    decision = "DILIGENCE_REQUIRED";
  }
  if (
    ictRes.demo_trap_detected ||
    !ictRes.metric_compliance_ok ||
    !qualRes.tech_rules_ok ||
    !qualRes.financial_rules_ok ||
    blocking_tags.includes("[UNIT_PRICE_OVERPRICING_JOGO_DE_PLANILHA_BLOCK]") ||
    blocking_tags.includes("[ACT_CHRONOLOGY_OR_INACTIVE_CNPJ_FRAUD_BLOCK]") ||
    blocking_tags.includes("[FORENSIC_SIGNER_IDENTITY_MISMATCH_BLOCK]") ||
    blocking_tags.includes("[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]") ||
    blocking_tags.includes("[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]") ||
    blocking_tags.includes("[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]") ||
    blocking_tags.includes("[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]") ||
    blocking_tags.includes("[FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK]") ||
    blocking_tags.includes("[APPEAL_IMMEDIATE_INTENT_PRECLUSION_BLOCK]") ||
    blocking_tags.includes("[APPEAL_INTENTION_SUMMARY_REJECTION_ILLEGAL_BLOCK]") ||
    blocking_tags.includes("[APPEAL_UNTIMELY_3_BUSINESS_DAYS_BLOCK]") ||
    blocking_tags.includes("[APPEAL_DEADLINE_3_BUSINESS_DAYS_VIOLATION]") ||
    blocking_tags.includes("[APPEAL_THEMATIC_INNOVATION_OUTSIDE_INTENT_BLOCK]")
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
    outDir = redirectInputsDirToSiblingState(sourceFilePath) ?? dirname(sourceFilePath);
  } else {
    outDir = createIsolatedEphemeralDir("bidding_gen6");
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
    ...(collusionRes.proposals_audited > 0 ? { forensic_collusion: collusionRes } : {}),
    ...(inexRes.estimated_budget_value || inexRes.unit_price_overpricing_detected
      ? { inexequibility_check: inexRes }
      : {}),
    ...(appealsRes.evaluated ? { appeals_evaluation: appealsRes } : {}),
    ...(unknownKeys.length > 0 ? { unknown_keys: unknownKeys, schema_warnings: schemaWarnings } : {}),
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
