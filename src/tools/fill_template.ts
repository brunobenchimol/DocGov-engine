import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename, relative } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { createReport } from "docx-templates";
import { safeReadJsonFile, unflattenDotKeys, unflattenDotNotation } from "../utils/json.ts";
export { unflattenDotKeys, unflattenDotNotation };
import { inspectDocx } from "./inspect.ts";
import {
  convertDocxToPdf,
  resolveOutputPaths,
  safeUnlink,
} from "../utils/pdf_exporter.ts";
import { VERSION } from "../constants/index.ts";
import { buildSummaryMcpEnvelope } from "../utils/mcp_hybrid_output.ts";
import {
  assertDocGovCaseScope,
  isValidDocGovCaseScope,
} from "../utils/paths.ts";
import type {
  ProcessDocumentOptions,
  ProcessDocumentResult,
  FillDocxTemplateSyntheticResult,
} from "../types/index.ts";
import {
  NumberingManager,
  ensureNumberingPart,
  sanitizeXmlString,
} from "../utils/xml.ts";

// Submódulos OpenXML Extraídos (ENG-06, ENG-11, ENG-14 — Modularização v1.3.10)
export {
  appendRichTextRunsToParagraph,
  parseMarkdownTableRowCells,
  isMarkdownTablePipeRow,
  isMarkdownTableSeparatorLine,
  parseMarkdownTableAlignments,
  type MarkdownLineSegment,
  segmentLinesWithMarkdownTables,
  buildOpenXmlTableFromMarkdown,
  ensureTableCellEndsWithParagraph,
  convertSiblingParagraphMarkdownTables,
  autoRedirectGeometricCheckboxCells,
} from "./openxml/markdown_table_converter.ts";

export {
  type HierarchicalListItemInfo,
  splitMarkerFromLine,
  detectHierarchicalListItem,
  buildNativeNumberingParagraphProperties,
  buildHangingIndentParagraphProperties,
  applyParagraphAfterSpacing,
  extractSectionHeadingPrefix,
  type ReanchoredNumberingResult,
  reanchorMultilevelItem,
  postProcessRichTextAndLineBreaksInXmlDoc,
} from "./openxml/list_numbering_processor.ts";

import { postProcessRichTextAndLineBreaksInXmlDoc } from "./openxml/list_numbering_processor.ts";

import {
  extractTemplateForLoopTargets,
  sanitizeTemplateDocxBuffer,
  normalizeNestedListsInState,
} from "./openxml/template_state_normalizer.ts";
export {
  flattenRecursiveItemsArray,
  isHierarchicalListArray,
  extractTemplateForLoopTargets,
  sanitizeTemplateDocxBuffer,
  normalizeNestedListsInState,
} from "./openxml/template_state_normalizer.ts";
// ============================================================================
// Pós-Processamento OpenXML e Injeção Central
// ============================================================================

async function postProcessInjectedDocxBuffer(
  rawBuffer: Uint8Array
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(rawBuffer);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  let anyModified = false;

  const existingNumberingFile = zip.file("word/numbering.xml");
  const existingNumberingXml = existingNumberingFile
    ? await existingNumberingFile.async("string")
    : null;
  const numberingManager = new NumberingManager(existingNumberingXml);

  const fileNames = Object.keys(zip.files).sort();
  for (const name of fileNames) {
    if (
      name === "word/document.xml" ||
      /^word\/(header|footer)\d*\.xml$/i.test(name)
    ) {
      const partFile = zip.file(name);
      if (!partFile) continue;
      const xmlStr = sanitizeXmlString(await partFile.async("string"));
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      const managerForPart =
        name === "word/document.xml" ? numberingManager : undefined;
      if (
        postProcessRichTextAndLineBreaksInXmlDoc(
          xmlDoc,
          managerForPart,
          existingNumberingXml
        )
      ) {
        zip.file(name, serializer.serializeToString(xmlDoc));
        anyModified = true;
      }
    }
  }

  if (numberingManager.isModified()) {
    await ensureNumberingPart(zip, numberingManager);
    anyModified = true;
  }

  if (!anyModified) {
    return Buffer.from(rawBuffer);
  }

  return await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
}

export async function processDocument(
  templatePath: string,
  statePath: string,
  outputPath: string,
  options?: ProcessDocumentOptions
): Promise<ProcessDocumentResult> {
  const resolvedTemplate = resolve(templatePath);
  const resolvedState = resolve(statePath);
  const resolvedOutput = resolve(outputPath);

  if (!isValidDocGovCaseScope(resolvedOutput)) {
    assertDocGovCaseScope(resolvedOutput, "fill_docx_template");
  }

  if (!existsSync(resolvedTemplate)) {
    throw new Error(`Template não encontrado: ${resolvedTemplate}`);
  }
  if (!existsSync(resolvedState)) {
    throw new Error(
      `Arquivo de dados/estado não encontrado: ${resolvedState}`
    );
  }

  const rawTemplateBuffer = readFileSync(resolvedTemplate);
  const templateBuffer = await sanitizeTemplateDocxBuffer(rawTemplateBuffer);
  const rawStateData = safeReadJsonFile<Record<string, any>>(resolvedState);
  const unflattenedState = unflattenDotKeys(rawStateData);
  const forLoopTargets = await extractTemplateForLoopTargets(templateBuffer);
  const stateData = normalizeNestedListsInState(
    unflattenedState,
    forLoopTargets
  );

  const outputBuffer = await createReport({
    template: templateBuffer,
    data: stateData,
    cmdDelimiter: ["{{", "}}"],
    processLineBreaks: true,
    noSandbox: true,
  });

  const finalBuffer = await postProcessInjectedDocxBuffer(outputBuffer);

  const outputFormat = options?.outputFormat || "docx";
  if (!["docx", "pdf", "both"].includes(outputFormat)) {
    throw new Error(
      `Formato de saída inválido: '${outputFormat}'. Formatos suportados: 'docx', 'pdf' ou 'both'.`
    );
  }

  const outPaths = resolveOutputPaths(resolvedOutput, outputFormat);
  const outDir = dirname(outPaths.primaryOutputPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  let pdfPath: string | undefined;
  let tierUsed: string | undefined;
  const stem = basename(outPaths.primaryOutputPath).replace(/\.(docx|pdf)$/i, "");
  let inspectionPath: string | undefined;
  let auditViewPath: string | undefined;
  let nextHint: string;

  try {
    writeFileSync(outPaths.docxPath, finalBuffer);

    if (outputFormat === "pdf" || outputFormat === "both") {
      const pdfRes = await convertDocxToPdf(outPaths.docxPath, outPaths.pdfPath, {
        timeoutMs: options?.pdfTimeoutMs,
      });
      pdfPath = pdfRes.pdfPath;
      tierUsed = pdfRes.tierUsed;
    }

    if (options?.autoInspect !== false) {
      let stateDir: string;
      if (options?.stateDir) {
        stateDir = resolve(options.stateDir);
      } else {
        const outputDir = dirname(outPaths.primaryOutputPath);
        const parentDir = dirname(outputDir);
        const siblingState = resolve(parentDir, "state");
        const sameDirState = resolve(outputDir, "state");
        const stateParent = dirname(resolvedState);

        if (basename(outputDir).toLowerCase() === "output") {
          stateDir = siblingState;
        } else if (basename(stateParent).toLowerCase() === "state") {
          stateDir = stateParent;
        } else {
          stateDir = sameDirState;
        }
      }

      if (!existsSync(stateDir)) {
        mkdirSync(stateDir, { recursive: true });
      }

      inspectionPath = options?.inspectionOutputPath
        ? resolve(options.inspectionOutputPath)
        : resolve(stateDir, `inspecao_${stem}.json`);

      const inspectTarget =
        outPaths.isExclusivePdf && pdfPath ? pdfPath : outPaths.docxPath;
      const inspResult = await inspectDocx(inspectTarget, inspectionPath, true);
      auditViewPath =
        inspResult.audit_view_path ?? resolve(stateDir, `visao_auditoria_${stem}.md`);

      const relVisao =
        relative(process.cwd(), auditViewPath).replace(/\\/g, "/") ||
        auditViewPath;

      if (pdfPath) {
        const relPdf =
          relative(process.cwd(), pdfPath).replace(/\\/g, "/") || pdfPath;
        nextHint = `Documento compilado em PDF (${relPdf}) e visão linear de auditoria gerada automaticamente em ${relVisao}. Próximo: acione o Auditor Externo lendo diretamente a visão linear (dispensado rodar inspect_doc novamente).`;
      } else {
        nextHint = `Documento compilado e visão linear de auditoria gerada automaticamente em ${relVisao}. Próximo: acione o Auditor Externo lendo diretamente a visão linear (dispensado rodar inspect_doc novamente).`;
      }
    } else {
      const relOutput =
        relative(process.cwd(), outPaths.primaryOutputPath).replace(/\\/g, "/") ||
        outPaths.primaryOutputPath;
      if (pdfPath) {
        const relPdf =
          relative(process.cwd(), pdfPath).replace(/\\/g, "/") || pdfPath;
        if (outPaths.isExclusivePdf) {
          nextHint = `Documento compilado em PDF (${relPdf}). Próximo: execute 'inspect_doc' para gerar o espelho estrutural antes de auditar.`;
        } else {
          nextHint = `Documento compilado em PDF (${relPdf}) e DOCX (${relOutput}). Próximo: execute 'inspect_doc' para gerar o espelho estrutural antes de auditar.`;
        }
      } else {
        nextHint = `Documento compilado com sucesso em ${relOutput}. Próximo: execute 'inspect_doc' para gerar o espelho estrutural antes de auditar.`;
      }
    }
  } finally {
    if (outPaths.isExclusivePdf && outPaths.tempDocxPath) {
      await safeUnlink(outPaths.tempDocxPath);
    }
  }

  let finalMessage: string;
  if (outputFormat === "pdf" && pdfPath) {
    finalMessage = `Documento PDF gerado com sucesso em: ${pdfPath}`;
  } else if (outputFormat === "both" && pdfPath) {
    finalMessage = `Documentos (.docx e .pdf) gerados com sucesso em: ${outPaths.docxPath} e ${pdfPath}`;
  } else {
    finalMessage = `Documento gerado com sucesso em: ${outPaths.docxPath}`;
  }

  return {
    success: true,
    message: finalMessage,
    outputPath: outPaths.primaryOutputPath,
    ...(pdfPath ? { pdf_path: pdfPath } : {}),
    ...(tierUsed ? { tier_used: tierUsed } : {}),
    ...(inspectionPath ? { inspection_path: inspectionPath } : {}),
    ...(auditViewPath ? { visao_auditoria_path: auditViewPath } : {}),
    next_step_hint: nextHint,
  };
}

export const fillDocxTemplate = processDocument;

export function formatFillDocxTemplateSyntheticResult(
  result: ProcessDocumentResult,
  baseDir: string = process.cwd()
): FillDocxTemplateSyntheticResult {
  const relOutput =
    relative(baseDir, result.outputPath).replace(/\\/g, "/") ||
    result.outputPath;
  const relPdf = result.pdf_path
    ? relative(baseDir, result.pdf_path).replace(/\\/g, "/")
    : undefined;
  const relInspection = result.inspection_path
    ? relative(baseDir, result.inspection_path).replace(/\\/g, "/")
    : undefined;
  const relVisao = result.visao_auditoria_path
    ? relative(baseDir, result.visao_auditoria_path).replace(/\\/g, "/")
    : undefined;

  let nextHint: string;
  if (relVisao) {
    if (relPdf) {
      nextHint = `Documento compilado em PDF (${relPdf}) e visão linear de auditoria gerada automaticamente em ${relVisao}. Próximo: acione o Auditor Externo lendo diretamente a visão linear.`;
    } else {
      nextHint = `Documento compilado e visão linear de auditoria gerada automaticamente em ${relVisao}. Próximo: acione o Auditor Externo lendo diretamente a visão linear (dispensado rodar inspect_doc novamente).`;
    }
  } else {
    if (relPdf && result.outputPath.endsWith(".pdf")) {
      nextHint = `Documento compilado com sucesso em PDF (${relPdf}). Próximo: execute 'inspect_doc' para gerar o espelho estrutural antes de auditar.`;
    } else {
      nextHint = `Documento compilado com sucesso em ${relOutput}. Próximo: execute 'inspect_doc' para gerar o espelho estrutural antes de auditar.`;
    }
  }

  const payload: FillDocxTemplateSyntheticResult = {
    status: "success",
    engine_version: VERSION,
    outputPath: relOutput,
    ...(relPdf ? { pdf_path: relPdf } : {}),
    ...(relInspection ? { inspection_path: relInspection } : {}),
    ...(relVisao ? { visao_auditoria_path: relVisao } : {}),
    message: result.message,
    next_step_hint: nextHint,
  };

  const summary = buildSummaryMcpEnvelope(payload).payload;
  if (Buffer.byteLength(JSON.stringify(summary), "utf-8") >= 1000) {
    summary.message = "Documento compilado com sucesso.";
  }

  return summary;
}
