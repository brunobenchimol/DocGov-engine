import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { resolve, dirname, basename } from "node:path";
import JSZip from "jszip";
import {
  computeStructureFingerprint,
  findBestTemplateMatch,
  reanchorSlotsManifest,
  extractCacheTemporalMetadata,
} from "../core/registry.ts";
import { isPdfBuffer } from "../utils/pdf.ts";
import { extractDocxForensicMetaFromZip } from "../utils/pdf/docx_forensic_meta.ts";
import { detectFileTypeSync } from "../utils/archives.ts";
import { buildDocxCartography } from "../core/cartography.ts";
import {
  auditDocumentBudget,
  injectBudgetAuditIntoImpugnationZones,
  formatBudgetAuditMarkdownBlock,
} from "../core/budget_auditor.ts";
import {
  computeStructuralDiff,
  generateDiffReportMarkdown,
} from "../core/structural_diff.ts";
import {
  resolveExistingPathNfc,
  isValidDocGovCaseScope,
} from "../utils/paths.ts";
import { resolveInspectOutputDir } from "../utils/ephemeral_scope.ts";
import type {
  DocxInspectionResult,
  TemplateMatchResult,
} from "../types/index.ts";

// ============================================================================
// Re-exports dos Submódulos Extraídos (Modularização v1.3.10)
// ============================================================================

export type { InspectResult } from "../types/index.ts";
export { scanPostCompileIntegrityAlerts } from "./inspect/integrity_scanner.ts";
export {
  buildTocMap,
  compactInspectionResult,
  toShortDocPath,
  generatePdfLinearAuditViewMarkdown,
  generateLinearAuditViewMarkdown,
  generateTextLinearAuditViewMarkdown,
} from "./inspect/audit_view_formatter.ts";
export {
  detectTableSubtablesAndCheckboxes,
  isZipBuffer,
  isTextOrMarkdownFile,
  formatInspectDocSyntheticResult,
  formatInspectDocxSyntheticResult,
} from "./inspect/document_pipelines.ts";
export {
  inspectSpreadsheetDocument,
  inspectPdfDocument,
  inspectTextOrMarkdownDocument,
} from "./inspect/non_docx_pipeline.ts";

import { scanPostCompileIntegrityAlerts } from "./inspect/integrity_scanner.ts";
import {
  buildTocMap,
  compactInspectionResult,
  generateLinearAuditViewMarkdown,
} from "./inspect/audit_view_formatter.ts";
import {
  detectTableSubtablesAndCheckboxes,
  isZipBuffer,
  isTextOrMarkdownFile,
} from "./inspect/document_pipelines.ts";
import {
  inspectSpreadsheetDocument,
  inspectPdfDocument,
  inspectTextOrMarkdownDocument,
} from "./inspect/non_docx_pipeline.ts";
import { extractDocxXmlParts } from "./inspect/docx_xml_extractor.ts";
import {
  attachTransientInspectMarkdown,
  writeOrDeferMarkdownArtifact,
} from "./inspect/markdown_artifacts.ts";
export { buildInspectHybridEnvelope } from "./inspect/markdown_artifacts.ts";

// ============================================================================
// Utilitários Internos de Diff Estrutural
// ============================================================================

async function applyStructuralDiffIfRequested(
  currentResult: DocxInspectionResult,
  currentPath: string,
  outDir: string,
  outputPath?: string,
  compareWithPath?: string
): Promise<void> {
  if (!compareWithPath) return;
  const resolvedOld = resolve(compareWithPath);
  if (!existsSync(resolvedOld)) {
    throw new Error(`Arquivo de comparação não encontrado: ${resolvedOld}`);
  }
  const oldInspection = await inspectDocx(resolvedOld, undefined, true, {
    skipAuditArtifacts: true,
    skipOutputWrite: true,
  });
  const diff = computeStructuralDiff(
    oldInspection,
    currentResult,
    resolvedOld,
    currentPath
  );

  const diffOutDir = outDir;
  const diffBase = outputPath
    ? basename(resolve(outputPath), ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      )
    : basename(currentPath).replace(/\.(?:docx|pdf|md|markdown|txt|text|log)$/i, "");
  const diffMdPath = resolve(diffOutDir, `diff_documental_${diffBase}.md`);
  const diffJsonPath = resolve(diffOutDir, `diff_documental_${diffBase}.json`);
  if (!existsSync(diffOutDir)) {
    mkdirSync(diffOutDir, { recursive: true });
  }
  const diffMd = generateDiffReportMarkdown(diff);
  writeFileSync(diffMdPath, diffMd, "utf-8");
  diff.diff_report_path = diffMdPath;
  writeFileSync(diffJsonPath, JSON.stringify(diff, null, 2), "utf-8");
  currentResult.diff_result = diff;
}

// ============================================================================
// Inspeção Estrutural Central (inspectDocx / inspectDoc)
// ============================================================================

export async function inspectDocx(
  docxPath: string,
  outputPath?: string,
  compact: boolean = false,
  options: {
    registryDir?: string;
    compareWithPath?: string;
    skipAuditArtifacts?: boolean;
    skipOutputWrite?: boolean;
    deferMarkdownWrite?: boolean;
    commentsUnmatched?: string[];
  } = {}
): Promise<DocxInspectionResult> {
  const resolvedDocx = resolveExistingPathNfc(resolve(docxPath));
  if (!existsSync(resolvedDocx)) {
    throw new Error(`Arquivo não encontrado: ${resolvedDocx}`);
  }

  const buffer = readFileSync(resolvedDocx);

  const fileType = detectFileTypeSync(buffer, resolvedDocx);
  if (fileType.isArchive) {
    throw new Error(
      `O arquivo '${basename(
        resolvedDocx
      )}' é um pacote compactado (${fileType.description}). A ferramenta 'inspect_doc' opera exclusivamente em documentos individuais (.docx, .pdf, .xlsx, .csv, .md, .txt). Para descompactar e inspecionar automaticamente múltiplos arquivos de um pacote, utilize 'bootstrap_case'.`
    );
  }

  const inScope =
    isValidDocGovCaseScope(resolvedDocx) ||
    Boolean(outputPath && isValidDocGovCaseScope(outputPath));

  const lowerPath = resolvedDocx.toLowerCase();
  if (
    lowerPath.endsWith(".xlsx") ||
    lowerPath.endsWith(".xls") ||
    lowerPath.endsWith(".csv")
  ) {
    return await inspectSpreadsheetDocument(resolvedDocx, buffer, outputPath, inScope, options);
  }

  if (isPdfBuffer(buffer) || lowerPath.endsWith(".pdf")) {
    const pdfStem = outputPath
      ? basename(resolve(outputPath), ".json").replace(/^(?:estrutura_|inspecao_)/, "")
      : basename(resolvedDocx).replace(/\.pdf$/i, "");
    const pdfScope = options.skipOutputWrite
      ? { outDir: dirname(resolvedDocx), targetOutputPath: undefined }
      : resolveInspectOutputDir({
          resolvedSource: resolvedDocx,
          outputPath,
          inScope,
          baseStem: pdfStem,
          prefix: "inspect",
        });
    const res = await inspectPdfDocument(resolvedDocx, buffer, outputPath, inScope, {
      ...options,
      resolvedOutDir: pdfScope.outDir,
      resolvedTargetOutputPath: pdfScope.targetOutputPath,
    });
    await applyStructuralDiffIfRequested(
      res,
      resolvedDocx,
      pdfScope.outDir,
      outputPath,
      options.compareWithPath
    );
    return res;
  }

  if (isTextOrMarkdownFile(resolvedDocx, buffer)) {
    const txtStem = outputPath
      ? basename(resolve(outputPath), ".json").replace(/^(?:estrutura_|inspecao_)/, "")
      : basename(resolvedDocx).replace(/\.(?:md|markdown|txt|text|log)$/i, "");
    const txtScope = options.skipOutputWrite
      ? { outDir: dirname(resolvedDocx), targetOutputPath: undefined }
      : resolveInspectOutputDir({
          resolvedSource: resolvedDocx,
          outputPath,
          inScope,
          baseStem: txtStem,
          prefix: "inspect",
        });
    const res = await inspectTextOrMarkdownDocument(resolvedDocx, buffer, outputPath, compact, inScope, {
      ...options,
      resolvedOutDir: txtScope.outDir,
      resolvedTargetOutputPath: txtScope.targetOutputPath,
    });
    await applyStructuralDiffIfRequested(
      res,
      resolvedDocx,
      txtScope.outDir,
      outputPath,
      options.compareWithPath
    );
    return res;
  }

  if (!isZipBuffer(buffer)) {
    throw new Error(
      `Formato de arquivo não suportado ou corrompido: '${basename(
        resolvedDocx
      )}'. O docgov-engine aceita nativamente documentos .docx, .pdf, .xlsx, .csv, .md e .txt. Se este for um anexo original do processo, certifique-se de que o arquivo binário intacto está presente na pasta .user_uploaded ou inputs/.`
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err: any) {
    throw new Error(
      `Falha na descompressão do pacote OpenXML/ZIP '${basename(
        resolvedDocx
      )}': ${err?.message || "arquivo corrompido"}. Certifique-se de que o arquivo .docx original intacto está presente na pasta .user_uploaded ou inputs/.`
    );
  }

  const { headers, footers, paragraphs, tables, commentsCount } = await extractDocxXmlParts(zip, resolvedDocx);

  const toc_map = buildTocMap(paragraphs, tables);
  const docxCartography = buildDocxCartography(paragraphs, tables, toc_map);

  const budgetAudit = auditDocumentBudget({
    docxTables: tables,
    docxParagraphs: paragraphs,
  });
  const baseStem = outputPath
    ? basename(resolve(outputPath), ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      )
    : basename(resolvedDocx, ".docx");

  const { outDir, targetOutputPath } = options.skipOutputWrite
    ? { outDir: dirname(resolvedDocx), targetOutputPath: undefined }
    : resolveInspectOutputDir({
        resolvedSource: resolvedDocx,
        outputPath,
        inScope,
        baseStem,
        prefix: "inspect",
      });

  if (!options.skipOutputWrite && !existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  if (budgetAudit.has_budget_table) {
    injectBudgetAuditIntoImpugnationZones(
      budgetAudit,
      docxCartography.impugnation_zones
    );

    if (!options.skipAuditArtifacts) {
      const budgetAuditPath = resolve(
        outDir,
        `auditoria_orcamentaria_${baseStem}.json`
      );
      writeFileSync(budgetAuditPath, JSON.stringify(budgetAudit, null, 2), "utf-8");
    }
  }

  const docxForensicMeta = await extractDocxForensicMetaFromZip(zip);

  const detectedTabular = detectTableSubtablesAndCheckboxes(tables);

  const rawResult: DocxInspectionResult = {
    doc_type: "docx",
    forensic_meta: docxForensicMeta,
    outline_headings: docxCartography.outline_headings,
    page_signals: docxCartography.page_signals,
    impugnation_zones: docxCartography.impugnation_zones,
    toc_map,
    ...(detectedTabular.subtables.length > 0
      ? { detected_subtables: detectedTabular.subtables }
      : {}),
    ...(detectedTabular.checkboxes.length > 0
      ? { detected_checkboxes: detectedTabular.checkboxes }
      : {}),
    headers,
    footers,
    paragraphs,
    tables,
    ...(commentsCount !== undefined && commentsCount > 0 ? { comments_count: commentsCount } : {}),
    ...(options.commentsUnmatched && options.commentsUnmatched.length > 0
      ? { comments_unmatched: options.commentsUnmatched }
      : {}),
    ...(budgetAudit.has_budget_table ? { budget_audit: budgetAudit } : {}),
  };

  const postCompileAlerts = scanPostCompileIntegrityAlerts(rawResult);
  if (postCompileAlerts.length > 0) {
    rawResult.post_compile_alerts = postCompileAlerts;
  }

  const structure_fingerprint = computeStructureFingerprint(rawResult);
  rawResult.structure_fingerprint = structure_fingerprint;

  const match = findBestTemplateMatch(
    structure_fingerprint,
    resolvedDocx,
    options.registryDir
  );
  let template_match: TemplateMatchResult;

  if (match.entry) {
    const meta = extractCacheTemporalMetadata(match.entry);
    if (match.similarity >= 0.995) {
      template_match = {
        status: "EXACT",
        similarity: 1.0,
        template_id: match.entry.template_id,
        registry_path: match.entry.registry_path,
        created_at: meta.created_at,
        updated_at: meta.updated_at,
        age_days: meta.age_days,
        cache_date_status: meta.cache_date_status,
        engine_version: meta.engine_version,
        slots_count: meta.slots_count,
        message:
          meta.cache_date_status === "KNOWN"
            ? `Template idêntico (100%) localizado no registro global: '${match.entry.template_id}' (atualizado em ${meta.updated_at.slice(0, 10)}, ${meta.slots_count} slots).`
            : `Template idêntico (100%) localizado no registro global: '${match.entry.template_id}' (data de criação não disponível no cache legado, ${meta.slots_count} slots).`,
      };
    } else if (match.similarity >= 0.75) {
      const adapted = reanchorSlotsManifest(
        match.entry,
        structure_fingerprint,
        rawResult
      );
      const adaptedFileName = `adapted_slots_manifest_${baseStem.normalize("NFC")}.json`;
      const adaptedPath = resolve(outDir, adaptedFileName);
      if (!options.skipOutputWrite && !options.skipAuditArtifacts) {
        writeFileSync(adaptedPath, JSON.stringify(adapted, null, 2), "utf-8");
      }

      template_match = {
        status: "MODIFIED",
        similarity: match.similarity,
        template_id: match.entry.template_id,
        registry_path: match.entry.registry_path,
        adapted_manifest_path: adaptedPath,
        shift_summary:
          adapted._shift_summary ||
          "Coordenadas reancoradas automaticamente por rótulos de formulário.",
        created_at: meta.created_at,
        updated_at: meta.updated_at,
        age_days: meta.age_days,
        cache_date_status: meta.cache_date_status,
        engine_version: meta.engine_version,
        slots_count: meta.slots_count,
        message: `Template base '${
          match.entry.template_id
        }' compatível com drift (${Math.round(
          match.similarity * 100
        )}%). Manifesto adaptado gerado em state/${adaptedFileName}.`,
      };
    } else {
      template_match = {
        status: "NEW",
        similarity: match.similarity,
        message: `Minuta inédita (< 75% de similaridade com templates registrados). Maior similaridade: ${Math.round(
          match.similarity * 100
        )}% ('${
          match.entry.template_id
        }'). Elabore um novo slots_manifest.json.`,
      };
    }
  } else {
    template_match = {
      status: "NEW",
      similarity: 0,
      message:
        "Nenhum template salvo no registro global de templates. Elabore um novo slots_manifest.json.",
    };
  }
  rawResult.template_match = template_match;

  let transientAuditMd: string | undefined;
  if (!options.skipAuditArtifacts) {
    const auditViewPath = resolve(
      outDir,
      `visao_auditoria_${baseStem.normalize("NFC")}.md`
    );

    let auditMd = generateLinearAuditViewMarkdown(
      basename(resolvedDocx).normalize("NFC"),
      rawResult
    );
    if (budgetAudit.has_budget_table) {
      auditMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
    }
    writeOrDeferMarkdownArtifact(auditViewPath, auditMd, options.deferMarkdownWrite);
    rawResult.audit_view_path = auditViewPath;
    transientAuditMd = auditMd;
  }

  await applyStructuralDiffIfRequested(
    rawResult,
    resolvedDocx,
    outDir,
    outputPath,
    options.compareWithPath
  );

  const finalResult = compact ? compactInspectionResult(rawResult) : rawResult;
  if (transientAuditMd !== undefined) {
    attachTransientInspectMarkdown(finalResult, transientAuditMd);
  }

  if (targetOutputPath) {
    const nfcOutPath = resolve(
      outDir,
      basename(targetOutputPath).normalize("NFC")
    );
    writeFileSync(nfcOutPath, JSON.stringify(finalResult, null, 2), "utf-8");
  }

  return finalResult;
}

export const inspectDoc = inspectDocx;
