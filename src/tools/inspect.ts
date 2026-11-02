import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { resolve, dirname, basename } from "node:path";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import {
  getAllElements,
  getDirectChildElements,
  extractParagraphStyle,
  extractParagraphText,
  extractParagraphNumbering,
  extractCellText,
  extractCellGridSpan,
  extractCellVMerge,
  createNumberingResolver,
  sanitizeXmlString,
} from "../utils/xml.ts";
import {
  computeStructureFingerprint,
  findBestTemplateMatch,
  reanchorSlotsManifest,
  extractCacheTemporalMetadata,
} from "../core/registry.ts";
import { isPdfBuffer } from "../utils/pdf.ts";
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
  getEphemeralInspectDir,
} from "../utils/paths.ts";
import type {
  BodyParagraphInfo,
  TableInfo,
  TableRowInfo,
  TableCellInfo,
  DocxInspectionResult,
  HeaderFooterParagraphInfo,
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

// ============================================================================
// Utilitários Internos de Diff Estrutural
// ============================================================================

async function applyStructuralDiffIfRequested(
  currentResult: DocxInspectionResult,
  currentPath: string,
  outputPath?: string,
  compareWithPath?: string
): Promise<void> {
  if (!compareWithPath) return;
  const resolvedOld = resolve(compareWithPath);
  if (!existsSync(resolvedOld)) {
    throw new Error(`Arquivo de comparação não encontrado: ${resolvedOld}`);
  }
  const oldInspection = await inspectDocx(resolvedOld, undefined, true);
  const diff = computeStructuralDiff(
    oldInspection,
    currentResult,
    resolvedOld,
    currentPath
  );

  const diffOutDir = outputPath
    ? dirname(resolve(outputPath))
    : dirname(currentPath);
  const diffBase = outputPath
    ? basename(resolve(outputPath), ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      )
    : basename(currentPath).replace(/\.(?:docx|pdf)$/i, "");
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
    const res = await inspectPdfDocument(resolvedDocx, buffer, outputPath, inScope, options);
    await applyStructuralDiffIfRequested(res, resolvedDocx, outputPath, options.compareWithPath);
    return res;
  }

  if (isTextOrMarkdownFile(resolvedDocx, buffer)) {
    const res = await inspectTextOrMarkdownDocument(resolvedDocx, buffer, outputPath, compact, inScope, options);
    await applyStructuralDiffIfRequested(res, resolvedDocx, outputPath, options.compareWithPath);
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

  const parser = new DOMParser();
  const headers: HeaderFooterParagraphInfo[] = [];
  const footers: HeaderFooterParagraphInfo[] = [];
  const fileNames = Object.keys(zip.files).sort();

  for (const name of fileNames) {
    if (/^word\/header\d*\.xml$/i.test(name)) {
      const xmlStr = sanitizeXmlString(await zip.file(name)!.async("string"));
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      const pList = getAllElements(xmlDoc, "w:p");
      pList.forEach((p, idx) => {
        headers.push({
          part: name,
          index: idx,
          paragraphIndex: idx,
          style: extractParagraphStyle(p),
          text: extractParagraphText(p),
        });
      });
    } else if (/^word\/footer\d*\.xml$/i.test(name)) {
      const xmlStr = sanitizeXmlString(await zip.file(name)!.async("string"));
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      const pList = getAllElements(xmlDoc, "w:p");
      pList.forEach((p, idx) => {
        footers.push({
          part: name,
          index: idx,
          paragraphIndex: idx,
          style: extractParagraphStyle(p),
          text: extractParagraphText(p),
        });
      });
    }
  }

  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error(
      `Estrutura OpenXML inválida ('word/document.xml' ausente no pacote ZIP): '${basename(
        resolvedDocx
      )}'. O arquivo parece ser um arquivo ZIP genérico e não um documento Microsoft Word (.docx) válido. Verifique os arquivos originais em .user_uploaded ou inputs/.`
    );
  }

  const docXmlStr = sanitizeXmlString(await docFile.async("string"));
  const docXml = parser.parseFromString(docXmlStr, "application/xml");
  const body = getAllElements(docXml, "w:body")[0];
  if (!body) {
    throw new Error(`Elemento <w:body> não encontrado em word/document.xml`);
  }

  const numberingFile = zip.file("word/numbering.xml");
  const numberingXmlStr = numberingFile
    ? await numberingFile.async("string")
    : null;
  const numberingResolver = createNumberingResolver(numberingXmlStr);

  const bodyParagraphs = getDirectChildElements(body, "w:p");
  const paragraphs: BodyParagraphInfo[] = bodyParagraphs.map((p, index) => {
    const numbering = extractParagraphNumbering(p);
    let text = extractParagraphText(p);
    if (numbering) {
      const trimmed = text.trim();
      const isTemplateTag = /^\{\{[\s\S]*\}\}$/.test(trimmed);
      if (trimmed && !isTemplateTag) {
        const computedPrefix = numberingResolver.formatParagraphPrefix(
          numbering.numId,
          numbering.level
        );
        if (
          computedPrefix &&
          !trimmed.startsWith(computedPrefix) &&
          !trimmed.startsWith(`${computedPrefix}.`)
        ) {
          text = `${computedPrefix} ${text.trimStart()}`;
        }
      }
    }
    return {
      index,
      style: extractParagraphStyle(p),
      text,
      ...(numbering ? { numbering } : {}),
    };
  });

  const bodyTables = getDirectChildElements(body, "w:tbl");
  const rawTables: TableInfo[] = bodyTables.map((tbl, index) => {
    const trList = getDirectChildElements(tbl, "w:tr");
    const activeVMerges = new Map<number, string>();

    const rows: TableRowInfo[] = trList.map((tr, rowIndex) => {
      const tcList = getDirectChildElements(tr, "w:tc");
      const cells: TableCellInfo[] = [];
      let currentVirtualCol = 0;

      for (let physicalIdx = 0; physicalIdx < tcList.length; physicalIdx++) {
        const tc = tcList[physicalIdx];
        const span = extractCellGridSpan(tc);
        const vMerge = extractCellVMerge(tc);
        let text = extractCellText(tc);

        if (vMerge === "restart") {
          activeVMerges.set(currentVirtualCol, text);
        } else if (vMerge === "continue") {
          if (!text.trim() && activeVMerges.has(currentVirtualCol)) {
            text = activeVMerges.get(currentVirtualCol) || "";
          }
        } else {
          activeVMerges.delete(currentVirtualCol);
        }

        cells.push({
          cellIndex: currentVirtualCol,
          physicalCellIndex: physicalIdx,
          virtualColIndex: currentVirtualCol,
          text,
          ...(span > 1 ? { colSpan: span } : {}),
          ...(vMerge ? { rowSpan: vMerge } : {}),
        });

        for (let s = 1; s < span; s++) {
          cells.push({
            cellIndex: currentVirtualCol + s,
            physicalCellIndex: physicalIdx,
            virtualColIndex: currentVirtualCol + s,
            text: "",
            isSpanPlaceholder: true,
          });
        }

        currentVirtualCol += span;
      }

      return {
        rowIndex,
        cells,
      };
    });

    return {
      index,
      rows,
    };
  });

  const tables: TableInfo[] = [];
  for (let t = 0; t < rawTables.length; t++) {
    const current = rawTables[t];
    if (tables.length === 0) {
      tables.push(current);
      continue;
    }
    const prev = tables[tables.length - 1];
    const prevHeader = prev.rows[0]?.cells.map((c) => c.text.trim()) ?? [];
    const currHeader = current.rows[0]?.cells.map((c) => c.text.trim()) ?? [];

    const isSameCols = prev.rows[0]?.cells.length === current.rows[0]?.cells.length;
    const isRepeatedHeader =
      isSameCols &&
      prevHeader.length > 0 &&
      currHeader.length > 0 &&
      prevHeader.join("|") === currHeader.join("|");

    if (isSameCols && isRepeatedHeader) {
      const dataRows = current.rows.slice(1);
      const startRowIdx = prev.rows.length;
      for (let r = 0; r < dataRows.length; r++) {
        prev.rows.push({
          rowIndex: startRowIdx + r,
          cells: dataRows[r].cells,
        });
      }
    } else {
      tables.push({
        ...current,
        index: tables.length,
      });
    }
  }

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

  const outDir = inScope
    ? (outputPath ? dirname(resolve(outputPath)) : dirname(resolvedDocx))
    : getEphemeralInspectDir();

  const targetOutputPath = inScope
    ? (outputPath ? resolve(outputPath) : undefined)
    : resolve(
        outDir,
        outputPath ? basename(outputPath) : `estrutura_${baseStem}.json`
      );

  if (!existsSync(outDir)) {
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

  const detectedTabular = detectTableSubtablesAndCheckboxes(tables);

  const rawResult: DocxInspectionResult = {
    doc_type: "docx",
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
      const adaptedPath = resolve(outDir, "adapted_slots_manifest.json");
      writeFileSync(adaptedPath, JSON.stringify(adapted, null, 2), "utf-8");

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
        )}%). Manifesto adaptado gerado em state/adapted_slots_manifest.json.`,
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
    writeFileSync(auditViewPath, auditMd, "utf-8");
    rawResult.audit_view_path = auditViewPath;
  }

  await applyStructuralDiffIfRequested(
    rawResult,
    resolvedDocx,
    outputPath,
    options.compareWithPath
  );

  const finalResult = compact ? compactInspectionResult(rawResult) : rawResult;

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
