// ============================================================================
// Orquestrador: Contratação Direta & Oportunidade Estatal (Gen6)
// docgov-engine v1.6.0 — src/direct_contracting/audit_direct_contracting.ts
// Ferramenta MCP: docgov_audit_direct_contracting | CLI: audit-direct-contracting
// ============================================================================

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, basename, relative } from "node:path";
import { VERSION } from "../constants/index.ts";
import { safeReadJsonFile } from "../utils/json.ts";
import { resolveWorkspacePath, getEphemeralInspectDir } from "../utils/paths.ts";
import { evaluateDirectContractingRules } from "./direct_contracting_auditor.ts";
import { compileDirectContractingOpinion } from "./direct_contracting_compiler.ts";
import type {
  RawDirectContractingInput,
  AuditDirectContractingOptions,
  DirectContractingAuditDossier,
  DirectContractingSyntheticResult,
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
  dossier: DirectContractingAuditDossier,
  jsonPath: string,
  mdPath: string
): DirectContractingSyntheticResult {
  const synthetic: DirectContractingSyntheticResult = {
    status: dossier.status,
    engine_version: dossier.engine_version,
    process_id: dossier.process_id,
    modality: dossier.modality,
    decision: dossier.decision,
    blocking_tags: dossier.blocking_tags,
    ...(dossier.compiled_artifacts?.opinion_docx_path
      ? { docx_path: basename(dossier.compiled_artifacts.opinion_docx_path) }
      : {}),
    ...(dossier.compiled_artifacts?.opinion_pdf_path
      ? { pdf_path: basename(dossier.compiled_artifacts.opinion_pdf_path) }
      : {}),
    dossier_json_path: toCompactPath(jsonPath),
    dossier_md_path: toCompactPath(mdPath),
    next_step_hint:
      dossier.blocking_tags.length > 0
        ? `Instrução bloqueada (${dossier.blocking_tags.length} tag(s)).`
        : "Instrução de contratação direta conforme.",
  };

  const sizeOf = (o: unknown) => Buffer.byteLength(JSON.stringify(o, null, 2), "utf-8");
  const minSizeOf = (o: unknown) => Buffer.byteLength(JSON.stringify(o), "utf-8");

  if (sizeOf(synthetic) > 850) {
    delete synthetic.next_step_hint;
  }
  if (sizeOf(synthetic) > 850) {
    synthetic.dossier_json_path = basename(jsonPath);
    synthetic.dossier_md_path = basename(mdPath);
  }
  if (minSizeOf(synthetic) > 850 && synthetic.process_id.length > 20) {
    synthetic.process_id = synthetic.process_id.slice(0, 20);
  }
  return synthetic;
}

export function serializeDirectContractingSyntheticResult(
  s: DirectContractingSyntheticResult
): string {
  const pretty = JSON.stringify(s, null, 2);
  if (Buffer.byteLength(pretty, "utf-8") < 900) return pretty;
  return JSON.stringify(s);
}

function buildDossierMarkdown(d: DirectContractingAuditDossier): string {
  return [
    `# Dossiê de Auditoria de Contratação Direta / Oportunidade Estatal — ${d.process_id}`,
    `- **Modalidade:** \`${d.modality}\` | **Regime:** \`${d.legal_regime}\``,
    `- **Decisão:** **${d.decision}** | **Status:** \`${d.status}\``,
    "",
    "## Tags de Bloqueio",
    ...(d.blocking_tags.length > 0 ? d.blocking_tags.map((t) => `- \`${t}\``) : ["- Nenhuma."]),
    "",
    "## Achados",
    ...(d.findings.length > 0 ? d.findings.map((f) => `- ${f}`) : ["- Conformidade integral."]),
  ].join("\n");
}

export async function auditDirectContracting(
  inputOrPath: RawDirectContractingInput | string,
  options: AuditDirectContractingOptions = {}
): Promise<{
  dossier: DirectContractingAuditDossier;
  synthetic: DirectContractingSyntheticResult;
}> {
  let raw: RawDirectContractingInput;
  let sourceFilePath: string | undefined;

  if (typeof inputOrPath === "string") {
    sourceFilePath = resolveWorkspacePath(inputOrPath);
    raw = (safeReadJsonFile(sourceFilePath) || {}) as RawDirectContractingInput;
  } else {
    raw = inputOrPath || {};
  }

  const processId = raw.process_id || "PROC-DIRETA-GENERICO";
  const evalRes = evaluateDirectContractingRules(raw);

  const decision: DirectContractingAuditDossier["decision"] =
    evalRes.blocking_tags.length > 0 ? "REJECTED" : "APPROVED";
  const status: DirectContractingAuditDossier["status"] =
    evalRes.blocking_tags.length > 0 ? "blocked" : "success";

  let outDir: string;
  if (options.outputDir || raw.outputDir || raw.output_dir) {
    outDir = resolveWorkspacePath(options.outputDir || raw.outputDir || raw.output_dir!);
  } else if (options.caseDir || raw.caseDir || raw.case_dir) {
    outDir = resolveWorkspacePath(join(options.caseDir || raw.caseDir || raw.case_dir!, "state"));
  } else if (sourceFilePath) {
    outDir = dirname(sourceFilePath);
  } else {
    outDir = join(getEphemeralInspectDir(), `direct_contracting_${Date.now()}`);
  }
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const compilationMode = String(
    options.compilationMode || raw.compilationMode || raw.compilation_mode || raw.mode || "NONE"
  ).toUpperCase();
  const outputFormat = (options.outputFormat || raw.outputFormat || raw.output_format || raw.format || "both") as
    | "docx"
    | "pdf"
    | "both";

  const amountRaw =
    raw.contracted_amount ??
    raw.contracted_Amount ??
    raw.dispensation_by_value_details?.current_proposed_spend ??
    raw.current_proposed_spend;

  const dossier: DirectContractingAuditDossier = {
    status,
    engine_version: VERSION,
    process_id: processId,
    modality: evalRes.modality,
    legal_regime: evalRes.legal_regime,
    decision,
    ...(amountRaw !== undefined ? { contracted_amount: Number(amountRaw) } : {}),
    blocking_tags: evalRes.blocking_tags,
    findings: evalRes.findings,
    ...(evalRes.inexigibility_summary ? { inexigibility_summary: evalRes.inexigibility_summary } : {}),
    ...(evalRes.dispensation_summary ? { dispensation_summary: evalRes.dispensation_summary } : {}),
    ...(evalRes.state_opportunity_summary ? { state_opportunity_summary: evalRes.state_opportunity_summary } : {}),
    raw_context: raw,
  };

  dossier.compiled_artifacts = await compileDirectContractingOpinion(
    dossier,
    outDir,
    compilationMode,
    outputFormat
  );

  const jsonContent = JSON.stringify(dossier, null, 2);
  const mdContent = buildDossierMarkdown(dossier);

  const jsonPrimary = join(outDir, "dossie_contratacao_direta.json");
  const jsonAlias = join(outDir, "relatorio_contratacao_direta.json");
  const mdPrimary = join(outDir, "visao_contratacao_direta.md");
  const mdAlias = join(outDir, "dossie_contratacao_direta.md");

  writeFileSync(jsonPrimary, jsonContent, "utf8");
  writeFileSync(jsonAlias, jsonContent, "utf8");
  writeFileSync(mdPrimary, mdContent, "utf8");
  writeFileSync(mdAlias, mdContent, "utf8");

  const synthetic = buildCompactSyntheticResult(dossier, jsonPrimary, mdPrimary);
  return { dossier, synthetic };
}
