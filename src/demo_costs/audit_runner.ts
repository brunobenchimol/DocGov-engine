// ============================================================================
// Orquestrador & Definição MCP: Regime DEMO (Geração 6.5 — Eixo 1)
// docgov-engine v1.6.5 — src/demo_costs/audit_runner.ts
// Ferramenta MCP: docgov_audit_demo_regime | CLI: audit-demo-regime
// ============================================================================

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { VERSION } from "../constants/index.ts";
import {
  fitBlockingTagsToBudget,
  safeReadJsonFile,
  serializeCompactSyntheticResult,
  toCompactWorkspacePath,
} from "../utils/json.ts";
import { getEphemeralInspectDir, resolveWorkspacePath } from "../utils/paths.ts";
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
    "Quando usar: Para auditar matematicamente em centavos inteiros planilhas de custos DEMO (Módulos 1 a 6 do Anexo VII-D da IN SEGES 05/2017, piso CCT, Súmula 448 TST, SAT/RAT x FAP, VT 6%, APT 1º ano <= 1,94%, reposição de ausentes, insumos/EPIs, Gross-Up de tributos por dentro, alíquota efetiva EFD-Contribuições no Lucro Real conforme Acórdão TCU 1.214/2013, vedação ao Simples Nacional Art. 17 XII LC 123/2006 salvo Anexo IV em limpeza/vigilância), produtividade por m² (Anexo VI-B), Decreto Federal nº 12.174/2024 (jornada 44h->40h sem corte remuneratório e cota de violência doméstica) e governança da execução contratual (expurgo de 90% do APT na 1ª prorrogação conforme Acórdão TCU 1.586/2018, Conta-Depósito Vinculada Anexo XII vs. Fato Gerador e Repactuação Anual por CCT Art. 135 Lei 14.133/2021). Próximo Passo: Inspecione demo_regime_audit.json, demo_regime_audit.md e o laudo pericial compilado laudo_pericial_planilha_demo.docx/.pdf no workspace_dir. Retorno sintético <= 880 bytes.",
  inputSchema: {
    type: "object",
    properties: {
      demoJsonPath: {
        type: "string",
        description: "Caminho do arquivo JSON contendo os dados da planilha DEMO e governança contratual.",
      },
      inputPath: {
        type: "string",
        description: "Alias para demoJsonPath ou string JSON inline.",
      },
      workspaceDir: {
        type: "string",
        description: "Diretório de saída onde os artefatos JSON, MD, DOCX e PDF serão gravados.",
      },
      workspace_dir: {
        type: "string",
        description: "Alias canônico de workspaceDir para persistência dos artefatos.",
      },
      case_id: {
        type: "string",
        description: "Identificador do processo ou caso administrativo auditado.",
      },
      contract_regime: {
        type: "string",
        enum: ["LEI_14133", "LEI_13303"],
        description: "Regime jurídico regente do contrato (LEI_14133 ou LEI_13303).",
      },
      service_category: {
        type: "string",
        enum: ["LIMPEZA", "VIGILANCIA", "APOIO_ADMINISTRATIVO", "OUTROS_DEMO"],
        description: "Categoria do serviço continuado com dedicação exclusiva de mão de obra.",
      },
      tax_regime: {
        type: "string",
        enum: ["LUCRO_REAL", "LUCRO_PRESUMIDO", "SIMPLES_NACIONAL"],
        description: "Regime de tributação da licitante ou contratada.",
      },
      simples_anexo_iv_compliant: {
        type: "boolean",
        description: "Indica conformidade estrita no Anexo IV do Simples Nacional com CPP 20%.",
      },
      module1_remuneration: {
        type: "object",
        description: "Dados do Módulo 1 (salário-base, piso CCT, adicionais e LTCAT).",
      },
      module2_charges_benefits: {
        type: "object",
        description: "Dados do Módulo 2 (Submódulos 2.1, 2.2 RAT x FAP e 2.3 VT/VA).",
      },
      module3_termination: {
        type: "object",
        description: "Dados do Módulo 3 (API, multa FGTS e APT do 1º ano).",
      },
      module4_replacement: {
        type: "object",
        description: "Dados do Módulo 4 (reposição de profissional ausente e encargos).",
      },
      module5_inputs: {
        type: "object",
        description: "Dados do Módulo 5 (uniformes, EPIs, materiais e depreciação).",
      },
      module6_indirect_profit_taxes: {
        type: "object",
        description: "Dados do Módulo 6 (custos indiretos, lucro, PIS/COFINS/ISS e EFD).",
      },
      productivity_m2: {
        type: "object",
        description: "Parâmetros opcionais de produtividade por m² segundo o Anexo VI-B.",
      },
      decree_12174_compliance: {
        type: "object",
        description: "Parâmetros opcionais de conformidade ao Decreto Federal nº 12.174/2024.",
      },
      execution_governance: {
        type: "object",
        description: "Parâmetros opcionais de execução (expurgo APT, Conta Vinculada/Fato Gerador, Repactuação).",
      },
      outputFormat: {
        type: "string",
        enum: ["docx", "pdf", "both"],
        description: "Formato de emissão do laudo pericial (padrão: both).",
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

function buildCompactSyntheticResult(
  output: DemoRegimeAuditOutput
): DemoRegimeSyntheticResult {
  const synthetic: DemoRegimeSyntheticResult = {
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

  const sizeOf = (o: unknown) =>
    Buffer.byteLength(JSON.stringify(o, null, 2), "utf-8");
  const minSizeOf = (o: unknown) =>
    Buffer.byteLength(JSON.stringify(o), "utf-8");

  if (sizeOf(synthetic) > 850) {
    delete synthetic.next_step_hint;
  }
  if (sizeOf(synthetic) > 850) {
    synthetic.json_path = basename(output.artifacts.json_path);
    synthetic.md_path = basename(output.artifacts.md_path);
  }
  if (minSizeOf(synthetic) > 880) {
    delete synthetic.pdf_path;
    delete synthetic.docx_path;
  }
  if (minSizeOf(synthetic) > 880) {
    delete synthetic.md_path;
  }
  if (minSizeOf(synthetic) > 880) {
    delete synthetic.total_monthly_per_post_cents;
  }
  if (minSizeOf(synthetic) > 880 && synthetic.case_id.length > 16) {
    synthetic.case_id = synthetic.case_id.slice(0, 16);
  }
  fitBlockingTagsToBudget(synthetic, 880);
  return synthetic;
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
    outDir = dirname(sourceFilePath);
  } else {
    outDir = join(getEphemeralInspectDir(), `demo_regime_${Date.now()}`);
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
  writeFileSync(mdPath, mdContent, "utf-8");
  writeFileSync(jsonPath, JSON.stringify(output, null, 2), "utf-8");

  const synthetic = buildCompactSyntheticResult(output);
  return { output, synthetic };
}
