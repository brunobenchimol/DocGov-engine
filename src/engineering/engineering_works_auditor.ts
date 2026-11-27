// ============================================================================
// Orquestrador & Definição MCP: Obras e Serviços de Engenharia (Gen6.5 Eixo 2)
// docgov-engine v1.6.6 — src/engineering/engineering_works_auditor.ts
// Ferramenta MCP: docgov_audit_engineering_works | CLI: audit-engineering-works
// ============================================================================

import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { VERSION } from "../constants/index.ts";
import { writeFileSafeSync } from "../utils/fs_safe_io.ts";
import { buildHybridMcpEnvelope } from "../utils/mcp_hybrid_output.ts";
import { createEngineeringWorksContractError } from "../contracts/errors.ts";
import { evaluateProposalInexequibility } from "../bidding/inexequibility_evaluator.ts";
import type { UnitPriceItemInput } from "../bidding/types.ts";
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
import { evaluateBdiAcordao2622 } from "./bdi_acordao_2622_evaluator.ts";
import { evaluateSinapiSicroAndSchedule } from "./sinapi_sicro_schedule_evaluator.ts";
import {
  buildEngineeringAuditMarkdown,
  compileEngineeringPericialDocxAndPdf,
} from "./docx_renderer.ts";
import { normalizeEngineeringWorksInput } from "./input_normalizer.ts";
export { ENGINEERING_WORKS_TOOL_DEFINITION } from "./tool_definition.ts";
import type {
  AuditEngineeringWorksOptions,
  EngineeringWorksAuditInput,
  EngineeringWorksAuditOutput,
  EngineeringWorksSyntheticResult,
} from "./types.ts";

function parseInputTarget(
  inputOrPath: EngineeringWorksAuditInput | string
): { raw: EngineeringWorksAuditInput; sourceFilePath?: string } {
  if (typeof inputOrPath !== "string") {
    return { raw: inputOrPath || ({} as EngineeringWorksAuditInput) };
  }
  const trimmed = inputOrPath.trim();
  if (trimmed.startsWith("{")) {
    return { raw: JSON.parse(trimmed) as EngineeringWorksAuditInput };
  }
  const sourceFilePath = resolveWorkspacePath(trimmed);
  const raw = (safeReadJsonFile(sourceFilePath) || {}) as EngineeringWorksAuditInput;
  return { raw, sourceFilePath };
}

function toCents(centsVal?: number, brlVal?: number): number {
  if (typeof centsVal === "number" && Number.isFinite(centsVal)) {
    return Math.round(centsVal);
  }
  if (typeof brlVal === "number" && Number.isFinite(brlVal)) {
    return Math.round(brlVal * 100);
  }
  return 0;
}

async function buildCompactSyntheticResult(
  output: EngineeringWorksAuditOutput,
  mdContent: string,
  deferWrite: boolean
): Promise<EngineeringWorksSyntheticResult> {
  const basePayload: EngineeringWorksSyntheticResult = {
    status: output.status,
    engine_version: output.engine_version,
    case_id: output.case_id,
    work_typology: output.work_typology,
    blocking_tags: [...output.blocking_tags],
    calculated_bdi_bps: output.bdi_summary.calculated_bdi_bps,
    abc_overpriced_items_count:
      output.sinapi_schedule_summary.abc_overpriced_items_count,
    additional_guarantee_cents:
      output.inexequibility_summary.additional_guarantee_cents,
    json_path: toCompactWorkspacePath(output.artifacts.json_path),
    md_path: toCompactWorkspacePath(output.artifacts.md_path),
    docx_path: basename(output.artifacts.docx_path),
    pdf_path: basename(output.artifacts.pdf_path),
    next_step_hint:
      output.blocking_tags.length > 0
        ? `Auditoria Obras NAO_CONFORME (${output.blocking_tags.length} tag(s)). Veja engineering_works_audit.json.`
        : "Orçamento de Engenharia, BDI e Cronograma CONFORMES.",
  };

  const envelope = await buildHybridMcpEnvelope({
    basePayload,
    artifactPath: output.artifacts.md_path,
    displayArtifactPath: basePayload.md_path,
    markdownContent: mdContent,
    writeMode: "write_behind",
    deferWrite,
    pointerSafeMarginBytes: 870,
    compactForPointer: (synthetic, targetBytes) => {
      const minSizeOf = () => Buffer.byteLength(JSON.stringify(synthetic), "utf-8");
      if (minSizeOf() > targetBytes) {
        synthetic.json_path = basename(output.artifacts.json_path);
        synthetic.md_path = basename(output.artifacts.md_path);
      }
      if (minSizeOf() > targetBytes) {
        delete synthetic.pdf_path;
        delete synthetic.docx_path;
      }
      if (minSizeOf() > targetBytes) delete synthetic.md_path;
      if (minSizeOf() > targetBytes) {
        delete synthetic.work_typology;
        delete synthetic.calculated_bdi_bps;
        delete synthetic.abc_overpriced_items_count;
        delete synthetic.additional_guarantee_cents;
      }
      if (minSizeOf() > targetBytes && synthetic.case_id.length > 16) {
        synthetic.case_id = synthetic.case_id.slice(0, 16);
      }
      fitBlockingTagsToBudget(synthetic, targetBytes);
    },
  });

  return envelope.payload;
}

export function serializeEngineeringWorksSyntheticResult(
  s: EngineeringWorksSyntheticResult
): string {
  return serializeCompactSyntheticResult(s, 850);
}

export async function auditEngineeringWorks(
  inputOrPath: EngineeringWorksAuditInput | string,
  options: AuditEngineeringWorksOptions = {}
): Promise<{
  output: EngineeringWorksAuditOutput;
  synthetic: EngineeringWorksSyntheticResult;
}> {
  const { raw: unnormalizedRaw, sourceFilePath } = parseInputTarget(inputOrPath);
  const raw = normalizeEngineeringWorksInput(unnormalizedRaw);
  if (!raw.bdi_evaluation) {
    throw createEngineeringWorksContractError(
      "Objeto obrigatório 'bdi_evaluation' ausente ou sem parâmetros de BDI."
    );
  }

  let outDir: string;
  if (options.workspaceDir || raw.workspace_dir) {
    outDir = resolveWorkspacePath(options.workspaceDir || raw.workspace_dir);
  } else if (sourceFilePath) {
    outDir = redirectInputsDirToSiblingState(sourceFilePath) ?? dirname(sourceFilePath);
  } else {
    outDir = createIsolatedEphemeralDir("engineering_works");
  }
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const workTypology = raw.work_typology || "CONSTRUCAO_EDIFICIOS";
  const executionRegime = raw.execution_regime || "EMPREITADA_PRECO_UNITARIO";
  const contractRegime = raw.contract_regime || "LEI_14133";

  const bdiRes = evaluateBdiAcordao2622(workTypology, raw.bdi_evaluation);
  const sinapiRes = evaluateSinapiSicroAndSchedule({
    executionRegime,
    bdi: raw.bdi_evaluation,
    tax: raw.tax_desoneracao_cprb,
    curvaAbcItems: raw.curva_abc_items,
    scheduleAndRisk: raw.schedule_and_risk,
  });

  // Reaproveita inexequibility_evaluator.ts (75%/85%, Súmula 262 e Jogo de Planilha)
  const estimatedCents = toCents(
    raw.estimated_budget_cents,
    raw.estimated_budget_value
  );
  const offeredCents = toCents(
    raw.offered_proposal_cents,
    raw.offered_proposal_value
  );
  const mappedAbcUnitItems: UnitPriceItemInput[] = (raw.curva_abc_items || [])
    .filter((it) => !it.specificity_justification_approved)
    .map((it) => ({
      item_id: it.item_id,
      description: it.description,
      estimated_unit_price: it.sinapi_sicro_median_unit_cents / 100,
      offered_unit_price: it.offered_unit_cents / 100,
      quantity: it.quantity,
    }));
  const combinedUnitItems: UnitPriceItemInput[] = [
    ...mappedAbcUnitItems,
    ...(raw.unit_price_items || []),
  ];

  const inexeqRes = evaluateProposalInexequibility({
    is_engineering_or_works: true,
    estimated_budget_value: estimatedCents / 100,
    offered_proposal_value: offeredCents / 100,
    additional_guarantee_offered: raw.additional_guarantee_offered,
    summary_disqualification_attempted: raw.summary_disqualification_attempted,
    sumula_262_diligence_opened: raw.prior_diligence_opportunity_granted,
    has_unit_price_overpricing: raw.has_unit_price_overpricing,
    unit_items: combinedUnitItems,
    proposal_exequibility: {
      prior_diligence_opportunity_granted:
        raw.prior_diligence_opportunity_granted,
      diligence_viability_proven: raw.diligence_viability_proven,
      unit_items: combinedUnitItems,
    },
  });

  const blocking_tags = Array.from(
    new Set([
      ...bdiRes.blocking_tags,
      ...sinapiRes.blocking_tags,
      ...inexeqRes.blocking_tags,
    ])
  );
  const findings = [
    ...bdiRes.findings,
    ...sinapiRes.findings,
    ...inexeqRes.findings,
  ];
  const status: EngineeringWorksAuditOutput["status"] =
    blocking_tags.length > 0 ? "NAO_CONFORME" : "CONFORME";

  const jsonPath = join(outDir, "engineering_works_audit.json");
  const mdPath = join(outDir, "engineering_works_audit.md");
  const docxPath = join(outDir, "laudo_pericial_obras_engenharia.docx");
  const pdfPath = join(outDir, "laudo_pericial_obras_engenharia.pdf");

  const output: EngineeringWorksAuditOutput = {
    engine_version: VERSION,
    case_id: raw.case_id || "PROC-OBRAS-GENERICO",
    contract_regime: contractRegime,
    work_typology: workTypology,
    execution_regime: executionRegime,
    status,
    blocking_tags,
    findings,
    bdi_summary: bdiRes,
    sinapi_schedule_summary: sinapiRes,
    inexequibility_summary: {
      estimated_budget_cents: estimatedCents,
      offered_proposal_cents: offeredCents,
      ratio_pct: inexeqRes.ratio_pct,
      presumed_inexequible_75: inexeqRes.presumed_inexequible_75,
      requires_additional_guarantee_85:
        inexeqRes.requires_additional_guarantee_85,
      additional_guarantee_cents: Math.round(
        (inexeqRes.additional_guarantee_amount ?? 0) * 100
      ),
      unit_price_overpricing_detected: Boolean(
        inexeqRes.unit_price_overpricing_detected
      ),
    },
    artifacts: {
      json_path: jsonPath,
      md_path: mdPath,
      docx_path: docxPath,
      pdf_path: pdfPath,
    },
  };

  const outputFormat = options.outputFormat || raw.output_format || "both";
  const compiled = await compileEngineeringPericialDocxAndPdf(
    output,
    raw,
    outDir,
    outputFormat
  );
  if (compiled.docx_path) output.artifacts.docx_path = compiled.docx_path;
  if (compiled.pdf_path) output.artifacts.pdf_path = compiled.pdf_path;

  const mdContent = buildEngineeringAuditMarkdown(output, raw);
  writeFileSafeSync(jsonPath, JSON.stringify(output, null, 2));

  const synthetic = await buildCompactSyntheticResult(
    output,
    mdContent,
    Boolean(options.deferMarkdownWrite)
  );
  return { output, synthetic };
}
