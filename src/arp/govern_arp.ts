// ============================================================================
// Orquestrador: Governança Determinística de ARP e Caronas (Gen5)
// docgov-engine v1.5.0 — src/arp/govern_arp.ts
// Ferramenta MCP: docgov_govern_arp | CLI: govern-arp
// ============================================================================

import { mkdirSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
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
import { computeArpLedger } from "./ledger_engine.ts";
import { evaluateArpCompatibility } from "./compatibility_matrix.ts";
import {
  compileArpAdhesionGrantNote,
  compileArpAdvantageStudy,
} from "./arp_compiler.ts";
import {
  hasRecognizedArpGovernanceInput,
  createArpGovernanceContractError,
  detectArpGovernanceUnknownKeys,
} from "../contracts/gen5_contract_errors.ts";
import type {
  RawArpInput,
  ArpGovernOptions,
  ArpGovernDossier,
  ArpGovernSyntheticResult,
} from "./types.ts";

export async function governArpExecution(
  inputOrPath: RawArpInput | string,
  options: ArpGovernOptions = {}
): Promise<{ dossier: ArpGovernDossier; synthetic: ArpGovernSyntheticResult }> {
  let rawData: RawArpInput;
  let sourceFilePath: string | undefined;

  if (typeof inputOrPath === "string") {
    sourceFilePath = resolveWorkspacePath(inputOrPath);
    rawData = (safeReadJsonFile(sourceFilePath) || {}) as RawArpInput;
  } else {
    rawData = inputOrPath || {};
  }

  if (!hasRecognizedArpGovernanceInput(rawData)) {
    throw createArpGovernanceContractError(
      "Nenhum campo de ARP reconhecido foi fornecido no JSON de entrada para docgov_govern_arp."
    );
  }

  const unknownKeys = detectArpGovernanceUnknownKeys(rawData);
  const arpNumber = rawData.arp_number || rawData.arpNumber || "ARP-GENERICA";

  // Execução do livro-razão e matriz de compatibilidade
  const ledgerRes = computeArpLedger(rawData);
  const compatRes = evaluateArpCompatibility(rawData);

  // Consolidação de tags de bloqueio
  const blockingTagsSet = new Set<string>();
  ledgerRes.blocking_tags.forEach((t) => blockingTagsSet.add(t));
  compatRes.blocking_tags.forEach((t) => blockingTagsSet.add(t));
  const blocking_tags = Array.from(blockingTagsSet);

  const decision: "APPROVED" | "REJECTED" =
    blocking_tags.length > 0 ? "REJECTED" : "APPROVED";
  const status: "success" | "blocked" | "warning" =
    blocking_tags.length > 0 ? "blocked" : "success";

  // Resolução do diretório de saída
  let outDir: string;
  if (options.outputDir || rawData.outputDir) {
    outDir = resolveWorkspacePath(options.outputDir || rawData.outputDir!);
  } else if (options.caseDir || rawData.caseDir) {
    outDir = resolveWorkspacePath(join(options.caseDir || rawData.caseDir!, "state"));
  } else if (sourceFilePath) {
    outDir = redirectInputsDirToSiblingState(sourceFilePath) ?? dirname(sourceFilePath);
  } else {
    outDir = createIsolatedEphemeralDir("arp_govern");
  }

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Resolução de modo de compilação
  const rawMode = (
    options.compilationMode ||
    options.mode ||
    rawData.compilation_mode ||
    rawData.compilationMode ||
    rawData.mode ||
    "NONE"
  ).toUpperCase();

  const compilation: ArpGovernDossier["compilation"] = {
    mode: rawMode,
  };

  const dossier: ArpGovernDossier = {
    status,
    engine_version: VERSION,
    arp_number: arpNumber,
    decision,
    blocking_tags,
    ledger_summary: {
      items_checked: ledgerRes.items_checked,
      max_individual_ratio_pct: ledgerRes.max_individual_ratio_pct,
      max_global_ratio_pct: ledgerRes.max_global_ratio_pct,
      preserved_own_balance_intact: ledgerRes.preserved_own_balance_intact,
    },
    items_ledger: ledgerRes.items_ledger,
    compatibility_analysis: compatRes.compatibility_analysis,
    validity_analysis: compatRes.validity_analysis,
    compilation,
    ...(unknownKeys.length > 0
      ? {
          unknown_keys: unknownKeys,
          schema_warnings: [
            `Chaves desconhecidas ignoradas pelo parser determinístico (consulte --dump-spec): ${unknownKeys.join(", ")}`,
          ],
        }
      : {}),
  };

  const dossierJsonPath = join(outDir, "dossie_governanca_arp.json");
  writeFileSafeSync(dossierJsonPath, JSON.stringify(dossier, null, 2));

  const visaoMd = generateArpVisionMarkdown(dossier);
  const visaoMdPath = join(outDir, "visao_governanca_arp.md");

  // Compilação opcional DOCX/PDF
  let compiledDocxPath: string | undefined;
  let compiledPdfPath: string | undefined;
  const outFormat = options.outputFormat || options.format || rawData.output_format || rawData.outputFormat || rawData.format || "both";

  if (rawMode === "ARP_ADHESION_GRANT_NOTE") {
    const docxOut = join(outDir, "Nota_Tecnica_Anuencia_ou_Negativa_Adesao_ARP.docx");
    const compRes = await compileArpAdhesionGrantNote(dossier, docxOut, { outputFormat: outFormat });
    compiledDocxPath = compRes.docx_path;
    compiledPdfPath = compRes.pdf_path;
    compilation.docx_path = compiledDocxPath;
    compilation.pdf_path = compiledPdfPath;
  } else if (rawMode === "ARP_ADVANTAGE_STUDY") {
    const docxOut = join(outDir, "Estudo_Tecnico_Vantajosidade_Adesao_ARP.docx");
    const compRes = await compileArpAdvantageStudy(dossier, docxOut, { outputFormat: outFormat });
    compiledDocxPath = compRes.docx_path;
    compiledPdfPath = compRes.pdf_path;
    compilation.docx_path = compiledDocxPath;
    compilation.pdf_path = compiledPdfPath;
  }

  const synthetic = await buildCompactArpSyntheticResult(
    {
      status,
      engine_version: VERSION,
      arp_number: arpNumber,
      decision,
      blocking_tags: [...blocking_tags],
      ...(unknownKeys.length > 0 ? { unknown_keys: unknownKeys.slice(0, 5) } : {}),
      ledger_summary: {
        items_checked: ledgerRes.items_checked,
        max_individual_ratio_pct: ledgerRes.max_individual_ratio_pct,
        max_global_ratio_pct: ledgerRes.max_global_ratio_pct,
        preserved_own_balance_intact: ledgerRes.preserved_own_balance_intact,
      },
      dossier_json_path: toCompactWorkspacePath(dossierJsonPath),
      dossier_md_path: toCompactWorkspacePath(visaoMdPath),
      ...(compiledDocxPath ? { compiled_document_path: toCompactWorkspacePath(compiledDocxPath) } : {}),
      ...(compiledPdfPath ? { compiled_pdf_path: toCompactWorkspacePath(compiledPdfPath) } : {}),
      next_step_hint:
        blocking_tags.length > 0
          ? `Adesão indeferida (${blocking_tags.length} óbices legais). Inspecione a visão de governança.`
          : "Adesão regular e livro-razão atualizado.",
    },
    dossierJsonPath,
    visaoMdPath,
    visaoMd,
    Boolean(options.deferMarkdownWrite),
    compiledDocxPath,
    compiledPdfPath
  );

  return { dossier, synthetic };
}

async function buildCompactArpSyntheticResult(
  basePayload: ArpGovernSyntheticResult,
  dossierJsonPath: string,
  visaoMdPath: string,
  visaoMd: string,
  deferWrite: boolean,
  compiledDocxPath?: string,
  compiledPdfPath?: string
): Promise<ArpGovernSyntheticResult> {
  const envelope = await buildHybridMcpEnvelope({
    basePayload,
    artifactPath: visaoMdPath,
    displayArtifactPath: basePayload.dossier_md_path,
    markdownContent: visaoMd,
    writeMode: "write_behind",
    deferWrite,
    compactForPointer: (synthetic, targetBytes) => {
      const minSizeOf = () => Buffer.byteLength(JSON.stringify(synthetic), "utf-8");
      if (minSizeOf() > targetBytes && compiledDocxPath) {
        synthetic.compiled_document_path = basename(compiledDocxPath);
      }
      if (minSizeOf() > targetBytes && compiledPdfPath) {
        synthetic.compiled_pdf_path = basename(compiledPdfPath);
      }
      if (minSizeOf() > targetBytes) {
        synthetic.dossier_json_path = basename(dossierJsonPath);
        synthetic.dossier_md_path = basename(visaoMdPath);
      }
      if (minSizeOf() > targetBytes) {
        delete synthetic.compiled_pdf_path;
        delete synthetic.compiled_document_path;
      }
      if (minSizeOf() > targetBytes) {
        delete synthetic.ledger_summary;
      }
      if (minSizeOf() > targetBytes && synthetic.unknown_keys) {
        delete synthetic.unknown_keys;
      }
      if (minSizeOf() > targetBytes && synthetic.arp_number.length > 20) {
        synthetic.arp_number = synthetic.arp_number.slice(0, 20);
      }
      fitBlockingTagsToBudget(synthetic, targetBytes);
    },
  });

  return envelope.payload;
}

export function serializeArpSyntheticResult(
  synthetic: ArpGovernSyntheticResult
): string {
  return serializeCompactSyntheticResult(synthetic, 850);
}

function generateArpVisionMarkdown(dossier: ArpGovernDossier): string {
  const lines: string[] = [];
  lines.push(`# Visão de Governança de Ata de Registro de Preços — docgov-engine v${dossier.engine_version}`);
  lines.push(`\n**ARP:** \`${dossier.arp_number}\` | **Decisão:** **${dossier.decision}** | **Status:** \`${dossier.status}\``);

  if (dossier.blocking_tags.length > 0) {
    lines.push(`\n## ⚠️ Vedações Legais e Óbices Ativos`);
    dossier.blocking_tags.forEach((tag) => lines.push(`- \`${tag}\``));
  }

  if (dossier.unknown_keys && dossier.unknown_keys.length > 0) {
    lines.push(`\n## ⚠️ Aviso de Schema (unknown_keys Ignoradas)`);
    dossier.unknown_keys.forEach((k) => lines.push(`- \`${k}\``));
  }

  lines.push(`\n## 1. Livro-Razão de Quantitativos e Travas (Art. 86 §§ 4º e 5º da Lei 14.133/2021)`);
  lines.push(`- **Saldo Próprio Inviolável:** ${dossier.ledger_summary.preserved_own_balance_intact ? "PRESERVADO" : "COMPROMETIDO"}`);
  lines.push(`- **Pico de Razão Individual (Trava 50%):** ${dossier.ledger_summary.max_individual_ratio_pct}%`);
  lines.push(`- **Pico de Razão Global (Trava 200%):** ${dossier.ledger_summary.max_global_ratio_pct}%`);

  lines.push(`\n| Item | Registrado | Saldo Próprio | Caronas Anteriores | Solicitado | Acumulado | Indiv % | Global % |`);
  lines.push(`| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |`);
  dossier.items_ledger.forEach((it) => {
    lines.push(`| ${it.item_id} | ${it.registered_qty} | ${it.own_balance_preserved} | ${it.prior_carona_adhesions} | ${it.requested_qty} | ${it.new_accumulated_carona_adhesions} | ${it.individual_ratio_pct}% | ${it.global_ratio_pct}% |`);
  });

  lines.push(`\n## 2. Matriz de Compatibilidade Jurídica e Federativa`);
  lines.push(`- **Regime:** Gerenciador=\`${dossier.compatibility_analysis.manager_regime}\` vs Aderente=\`${dossier.compatibility_analysis.adherent_regime}\` (${dossier.compatibility_analysis.regime_ok ? "Compatível" : "INCOMPATÍVEL"})`);
  lines.push(`- **Esfera:** Gerenciador=\`${dossier.compatibility_analysis.manager_sphere}\` vs Aderente=\`${dossier.compatibility_analysis.adherent_sphere}\` (${dossier.compatibility_analysis.federative_ok ? "Compatível" : "VEDAÇÃO ASCENDENTE"})`);

  lines.push(`\n## 3. Gestão de Vigência e Desacoplamento Contratual`);
  lines.push(`- **Vigência da Ata:** ${dossier.validity_analysis.validity_months} meses`);
  lines.push(`- **Renovação Ano 2:** ${dossier.validity_analysis.is_second_year_renewal ? (dossier.validity_analysis.renewal_ok ? "Regular" : "IRREGULAR") : "Não solicitada"}`);
  lines.push(`- **Desacoplamento Contratos Derivados:** Duração de até ${dossier.validity_analysis.derived_contract_duration_months} meses (${dossier.validity_analysis.derived_contract_decoupled_valid ? "Válido até 60m" : "Excede 60m"})`);

  return lines.join("\n");
}
