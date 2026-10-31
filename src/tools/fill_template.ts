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
  sanitizeTemplateTagExpression,
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

// ============================================================================
// Normalização e Preparação de Listas no Estado do Caso
// ============================================================================

export function flattenRecursiveItemsArray(
  items: any[],
  parentPrefix: string = "1"
): { lines: string[]; flatObjects: any[] } {
  const lines: string[] = [];
  const flatObjects: any[] = [];

  items.forEach((item, idx) => {
    const currentIndex = idx + 1;
    if (typeof item === "string") {
      lines.push(item);
      flatObjects.push({ texto: item });
      return;
    }

    if (typeof item === "object" && item !== null) {
      const explicitNum =
        item.numero ?? item.codigo ?? item.id ?? item.item ?? null;
      const computedNum = explicitNum
        ? String(explicitNum).trim()
        : `${parentPrefix}.${currentIndex}`;

      const titulo = item.titulo ?? item.rotulo ?? item.nome ?? "";
      const texto =
        item.texto ?? item.descricao ?? item.conteudo ?? item.valor ?? "";

      let formattedLine = "";
      if (titulo && texto) {
        formattedLine = `**${computedNum} ${titulo}:** ${texto}`;
      } else if (titulo) {
        formattedLine = `**${computedNum} ${titulo}**`;
      } else if (texto) {
        const textStr = String(texto).trim();
        const startsWithNum =
          textStr.startsWith(computedNum) ||
          textStr.startsWith(`**${computedNum}`);
        formattedLine = startsWithNum
          ? textStr
          : `**${computedNum}** ${textStr}`;
      } else {
        formattedLine = `**${computedNum}**`;
      }

      lines.push(formattedLine);

      const children =
        item.subitens ?? item.itens ?? item.children ?? item.filhos ?? null;

      const flatClone: Record<string, any> = {
        ...item,
        numero: computedNum,
        texto_formatado: formattedLine,
      };
      delete flatClone.subitens;
      delete flatClone.itens;
      delete flatClone.children;
      delete flatClone.filhos;
      flatObjects.push(flatClone);

      if (Array.isArray(children) && children.length > 0) {
        const childRes = flattenRecursiveItemsArray(children, computedNum);
        lines.push(...childRes.lines);
        flatObjects.push(...childRes.flatObjects);
      }
    }
  });

  return { lines, flatObjects };
}

export function isHierarchicalListArray(arr: any[]): boolean {
  if (arr.length === 0) return false;
  if (arr.every((x) => typeof x === "string")) return true;
  return arr.some(
    (x) =>
      typeof x === "object" &&
      x !== null &&
      (Array.isArray(x.subitens) ||
        Array.isArray(x.itens) ||
        Array.isArray(x.children) ||
        Array.isArray(x.filhos))
  );
}

export async function extractTemplateForLoopTargets(
  templateBuffer: Buffer
): Promise<Set<string>> {
  const targets = new Set<string>();
  try {
    const zip = await JSZip.loadAsync(templateBuffer);
    const fileNames = Object.keys(zip.files);
    for (const name of fileNames) {
      if (
        name === "word/document.xml" ||
        /^word\/(header|footer)\d*\.xml$/i.test(name)
      ) {
        const xmlStr = await zip.file(name)!.async("string");
        const matches = xmlStr.matchAll(
          /\bFOR\s+\$?[a-zA-Z_]\w*\s+IN\s+([a-zA-Z0-9_.$]+)/gi
        );
        for (const m of matches) {
          const fullExpr = m[1];
          targets.add(fullExpr);
          const lastProp = fullExpr.split(".").pop();
          if (lastProp) targets.add(lastProp);
        }

        const tagMatches = xmlStr.matchAll(/\{\{([\s\S]*?)\}\}/g);
        for (const tm of tagMatches) {
          const content = tm[1];
          const indexedProps = content.matchAll(
            /([a-zA-Z_$][\w$]*)(?:\[\d+\]|\.\d+)/g
          );
          for (const ip of indexedProps) {
            targets.add(ip[1]);
          }
        }
      }
    }
  } catch {
    // Ignora caso não seja possível extrair previamente
  }
  return targets;
}

export async function sanitizeTemplateDocxBuffer(
  rawBuffer: Buffer
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(rawBuffer);
  let modified = false;
  const fileNames = Object.keys(zip.files);
  for (const name of fileNames) {
    if (
      name === "word/document.xml" ||
      /^word\/(header|footer)\d*\.xml$/i.test(name)
    ) {
      const xmlStr = await zip.file(name)!.async("string");
      if (xmlStr.includes("{{")) {
        const sanitizedXml = xmlStr.replace(
          /\{\{([\s\S]*?)\}\}/g,
          (_match, expr) => `{{${sanitizeTemplateTagExpression(expr)}}}`
        );
        if (sanitizedXml !== xmlStr) {
          zip.file(name, sanitizedXml);
          modified = true;
        }
      }
    }
  }
  if (!modified) return rawBuffer;
  return await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
}

export function normalizeNestedListsInState(
  data: any,
  forLoopTargets: Set<string> = new Set(),
  currentPath: string = ""
): any {
  if (Array.isArray(data)) {
    const propName = currentPath.split(".").pop() ?? "";
    const isUsedInForLoop =
      forLoopTargets.has(currentPath) || forLoopTargets.has(propName);

    const hasNestedSubitems = data.some(
      (x) =>
        typeof x === "object" &&
        x !== null &&
        (Array.isArray(x.subitens) ||
          Array.isArray(x.itens) ||
          Array.isArray(x.children) ||
          Array.isArray(x.filhos))
    );

    if (isUsedInForLoop) {
      if (hasNestedSubitems) {
        return flattenRecursiveItemsArray(data).flatObjects;
      }
      return data.map((item, idx) =>
        normalizeNestedListsInState(item, forLoopTargets, `${currentPath}[${idx}]`)
      );
    }

    if (isHierarchicalListArray(data)) {
      return flattenRecursiveItemsArray(data).lines.join("\n");
    }

    return data.map((item, idx) =>
      normalizeNestedListsInState(item, forLoopTargets, `${currentPath}[${idx}]`)
    );
  }

  if (typeof data === "object" && data !== null) {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      const nextPath = currentPath ? `${currentPath}.${k}` : k;
      result[k] = normalizeNestedListsInState(v, forLoopTargets, nextPath);
    }
    return result;
  }

  return data;
}

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

  const inScope =
    isValidDocGovCaseScope(resolvedTemplate) ||
    isValidDocGovCaseScope(resolvedOutput) ||
    isValidDocGovCaseScope(resolvedState);
  if (!inScope) {
    assertDocGovCaseScope(resolvedTemplate, "fill_docx_template");
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

  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 1000) {
    payload.message = "Documento compilado com sucesso.";
  }

  return payload;
}
