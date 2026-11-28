// ============================================================================
// Orquestrador & Definição MCP: Regime DEMO (Geração 6.5 — Eixo 1)
// docgov-engine v1.6.5 — src/demo_costs/audit_runner.ts
// Ferramenta MCP: docgov_audit_demo_regime | CLI: audit-demo-regime
// ============================================================================

import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { VERSION } from "../constants/index.ts";
import { writeFileSafeSync } from "../utils/fs_safe_io.ts";
import { buildHybridMcpEnvelope } from "../utils/mcp_hybrid_output.ts";
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
import { calculateDemoCostSheet } from "./sheet_calculator.ts";
import { evaluateDemoExecutionGovernance } from "./execution_governance.ts";
import {
  buildDemoAuditMarkdown,
  compileDemoPericialDocxAndPdf,
} from "./docx_renderer.ts";
import type {
  AuditDemoRegimeOptions,
  DemoRegimeAuditInput,
  DemoRegimeAuditOutput,
  DemoRegimeSyntheticResult,
} from "./types.ts";

export const DEMO_REGIME_TOOL_DEFINITION = {
  name: "docgov_audit_demo_regime",
  description:
    "Auditoria em centavos de planilhas DEMO (Módulos 1–6 IN 05/2017, CCT, RAT×FAP, APT, Gross-Up, EFD), m², Dec. 12.174/2024 e execução.\n" +
    "- Quando usar: Auditar planilhas de mão de obra exclusiva e sua execução.\n" +
    "- Próximo Passo: Use inline_markdown ou read_file; <=8KB/<=880B.",
  inputSchema: {
    type: "object",
    properties: {
      demoJsonPath: {
        type: "string",
        description: "Caminho do JSON DEMO.",
      },
      inputPath: {
        type: "string",
        description: "Alias ou JSON inline.",
      },
      workspaceDir: {
        type: "string",
        description: "Diretório de saída.",
      },
      workspace_dir: {
        type: "string",
        description: "Alias para workspaceDir.",
      },
      case_id: {
        type: "string",
        description: "ID do caso ou processo.",
      },
      contract_regime: {
        type: "string",
        enum: ["LEI_14133", "LEI_13303"],
        description: "Regime jurídico contratual.",
      },
      service_category: {
        type: "string",
        enum: ["LIMPEZA", "VIGILANCIA", "APOIO_ADMINISTRATIVO", "OUTROS_DEMO"],
        description: "Categoria do serviço DEMO.",
      },
      tax_regime: {
        type: "string",
        enum: ["LUCRO_REAL", "LUCRO_PRESUMIDO", "SIMPLES_NACIONAL"],
        description: "Regime tributário da licitante.",
      },
      simples_anexo_iv_compliant: {
        type: "boolean",
        description: "Simples Anexo IV c/ CPP 20%.",
      },
      module1_remuneration: {
        type: "object",
        description: "Módulo 1 (salário, CCT, LTCAT).",
      },
      module2_charges_benefits: {
        type: "object",
        description: "Módulo 2 (2.1, RAT×FAP, VT/VA).",
      },
      module3_termination: {
        type: "object",
        description: "Módulo 3 (API, FGTS, APT 1º ano).",
      },
      module4_replacement: {
        type: "object",
        description: "Módulo 4 (reposição de ausentes).",
      },
      module5_inputs: {
        type: "object",
        description: "Módulo 5 (uniformes, EPI, insumo).",
      },
      module6_indirect_profit_taxes: {
        type: "object",
        description: "Módulo 6 (indiretos, lucro, tributos).",
      },
      productivity_m2: {
        type: "object",
        description: "Produtividade m² (Anexo VI-B).",
      },
      decree_12174_compliance: {
        type: "object",
        description: "Conformidade Dec. 12.174/2024.",
      },
      execution_governance: {
        type: "object",
        description: "Execução (APT, Conta Vinc., Repact.).",
      },
      outputFormat: {
        type: "string",
        enum: ["docx", "pdf", "both"],
        description: "Formato do laudo (padrão: both).",
      },
    },
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
};

function parseInputTarget(
  inputOrPath: DemoRegimeAuditInput | string
): { raw: DemoRegimeAuditInput; sourceFilePath?: string } {
  if (typeof inputOrPath !== "string") {
    return { raw: inputOrPath || ({} as DemoRegimeAuditInput) };
  }
  const trimmed = inputOrPath.trim();
  if (trimmed.startsWith("{")) {
    return { raw: JSON.parse(trimmed) as DemoRegimeAuditInput };
  }
  const sourceFilePath = resolveWorkspacePath(trimmed);
  const raw = (safeReadJsonFile(sourceFilePath) || {}) as DemoRegimeAuditInput;
  return { raw, sourceFilePath };
}

async function buildCompactSyntheticResult(
  output: DemoRegimeAuditOutput,
  mdContent: string,
  deferWrite: boolean
): Promise<DemoRegimeSyntheticResult> {
  const basePayload: DemoRegimeSyntheticResult = {
    status: output.status,
    engine_version: output.engine_version,
    case_id: output.case_id,
    blocking_tags: [...output.blocking_tags],
    total_monthly_per_post_cents:
      output.calculated_totals_cents.total_monthly_per_post_cents,
    json_path: toCompactWorkspacePath(output.artifacts.json_path),
    md_path: toCompactWorkspacePath(output.artifacts.md_path),
    docx_path: basename(output.artifacts.docx_path),
    pdf_path: basename(output.artifacts.pdf_path),
    next_step_hint:
      output.blocking_tags.length > 0
        ? `Auditoria DEMO NAO_CONFORME (${output.blocking_tags.length} tag(s)). Veja demo_regime_audit.json.`
        : "Planilha DEMO e governança contratual CONFORMES.",
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
      if (minSizeOf() > targetBytes) {
        delete synthetic.md_path;
      }
      if (minSizeOf() > targetBytes) {
        delete synthetic.total_monthly_per_post_cents;
      }
      if (minSizeOf() > targetBytes && synthetic.case_id.length > 16) {
        synthetic.case_id = synthetic.case_id.slice(0, 16);
      }
      fitBlockingTagsToBudget(synthetic, targetBytes);
    },
  });

  return envelope.payload;
}

export function serializeDemoRegimeSyntheticResult(
  s: DemoRegimeSyntheticResult
): string {
  return serializeCompactSyntheticResult(s, 850);
}

export async function auditDemoRegime(
  inputOrPath: DemoRegimeAuditInput | string,
  options: AuditDemoRegimeOptions = {}
): Promise<{
  output: DemoRegimeAuditOutput;
  synthetic: DemoRegimeSyntheticResult;
}> {
  const { raw, sourceFilePath } = parseInputTarget(inputOrPath);

  if (!raw.module1_remuneration || !raw.module2_charges_benefits || !raw.module6_indirect_profit_taxes) {
    throw new Error(
      "Contrato inválido para docgov_audit_demo_regime: forneça 'module1_remuneration', 'module2_charges_benefits', 'module3_termination', 'module4_replacement', 'module5_inputs' e 'module6_indirect_profit_taxes'."
    );
  }

  let outDir: string;
  if (options.workspaceDir || raw.workspace_dir) {
    outDir = resolveWorkspacePath(options.workspaceDir || raw.workspace_dir);
  } else if (sourceFilePath) {
    outDir = redirectInputsDirToSiblingState(sourceFilePath) ?? dirname(sourceFilePath);
  } else {
    outDir = createIsolatedEphemeralDir("demo_regime");
  }
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const sheetRes = calculateDemoCostSheet(raw);
  const execRes = evaluateDemoExecutionGovernance(
    raw,
    sheetRes.module1_cents,
    sheetRes.total_sub22_bps
  );

  const blocking_tags = Array.from(
    new Set([...sheetRes.blocking_tags, ...execRes.blocking_tags])
  );
  const findings = [...sheetRes.findings, ...execRes.findings];
  const status: DemoRegimeAuditOutput["status"] =
    blocking_tags.length > 0 ? "NAO_CONFORME" : "CONFORME";

  const jsonPath = join(outDir, "demo_regime_audit.json");
  const mdPath = join(outDir, "demo_regime_audit.md");
  const docxPath = join(outDir, "laudo_pericial_planilha_demo.docx");
  const pdfPath = join(outDir, "laudo_pericial_planilha_demo.pdf");

  const output: DemoRegimeAuditOutput = {
    engine_version: VERSION,
    case_id: raw.case_id || "PROC-DEMO-GENERICO",
    contract_regime: raw.contract_regime || "LEI_14133",
    service_category: raw.service_category || "OUTROS_DEMO",
    tax_regime: raw.tax_regime || "LUCRO_REAL",
    status,
    blocking_tags,
    findings,
    calculated_totals_cents: {
      module1_cents: sheetRes.module1_cents,
      module2_cents: sheetRes.module2_cents,
      module3_cents: sheetRes.module3_cents,
      module4_cents: sheetRes.module4_cents,
      module5_cents: sheetRes.module5_cents,
      module6_cents: sheetRes.module6_cents,
      total_monthly_per_post_cents: sheetRes.total_monthly_per_post_cents,
      apt_renewal_purge_monthly_savings_cents:
        execRes.apt_renewal_purge_monthly_savings_cents,
      linked_account_monthly_provision_cents:
        execRes.linked_account_monthly_provision_cents,
    },
    sheet_breakdown: sheetRes.breakdown,
    execution_summary: execRes.summary,
    artifacts: {
      json_path: jsonPath,
      md_path: mdPath,
      docx_path: docxPath,
      pdf_path: pdfPath,
    },
  };

  const outputFormat = options.outputFormat || raw.output_format || "both";
  const compiled = await compileDemoPericialDocxAndPdf(
    output,
    raw,
    outDir,
    outputFormat
  );
  if (compiled.docx_path) output.artifacts.docx_path = compiled.docx_path;
  if (compiled.pdf_path) output.artifacts.pdf_path = compiled.pdf_path;

  const mdContent = buildDemoAuditMarkdown(output, raw);
  writeFileSafeSync(jsonPath, JSON.stringify(output, null, 2));

  const synthetic = await buildCompactSyntheticResult(
    output,
    mdContent,
    Boolean(options.deferMarkdownWrite)
  );
  return { output, synthetic };
}
