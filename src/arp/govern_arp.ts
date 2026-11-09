// ============================================================================
// Orquestrador: Governança Determinística de ARP e Caronas (Gen5)
// docgov-engine v1.5.0 — src/arp/govern_arp.ts
// Ferramenta MCP: docgov_govern_arp | CLI: govern-arp
// ============================================================================

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { VERSION } from "../constants/index.ts";
import { safeReadJsonFile } from "../utils/json.ts";
import { resolveWorkspacePath, getEphemeralInspectDir } from "../utils/paths.ts";
import { computeArpLedger } from "./ledger_engine.ts";
import { evaluateArpCompatibility } from "./compatibility_matrix.ts";
import {
  compileArpAdhesionGrantNote,
  compileArpAdvantageStudy,
} from "./arp_compiler.ts";
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
    outDir = dirname(sourceFilePath);
  } else {
    outDir = join(getEphemeralInspectDir(), `arp_govern_${Date.now()}`);
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
  };

  const dossierJsonPath = join(outDir, "dossie_governanca_arp.json");
  writeFileSync(dossierJsonPath, JSON.stringify(dossier, null, 2), "utf8");

  const visaoMd = generateArpVisionMarkdown(dossier);
  const visaoMdPath = join(outDir, "visao_governanca_arp.md");
  writeFileSync(visaoMdPath, visaoMd, "utf8");

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

  const synthetic: ArpGovernSyntheticResult = {
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
    dossier_json_path: dossierJsonPath.replace(/\\/g, "/"),
    dossier_md_path: visaoMdPath.replace(/\\/g, "/"),
    compiled_document_path: compiledDocxPath ? compiledDocxPath.replace(/\\/g, "/") : undefined,
    compiled_pdf_path: compiledPdfPath ? compiledPdfPath.replace(/\\/g, "/") : undefined,
    next_step_hint:
      blocking_tags.length > 0
        ? `Adesão indeferida (${blocking_tags.length} óbices legais). Inspecione a visão de governança gerada.`
        : "Adesão regular e livro-razão atualizado.",
  };

  return { dossier, synthetic };
}

function generateArpVisionMarkdown(dossier: ArpGovernDossier): string {
  const lines: string[] = [];
  lines.push(`# Visão de Governança de Ata de Registro de Preços — docgov-engine v${dossier.engine_version}`);
  lines.push(`\n**ARP:** \`${dossier.arp_number}\` | **Decisão:** **${dossier.decision}** | **Status:** \`${dossier.status}\``);

  if (dossier.blocking_tags.length > 0) {
    lines.push(`\n## ⚠️ Vedações Legais e Óbices Ativos`);
    dossier.blocking_tags.forEach((tag) => lines.push(`- \`${tag}\``));
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
