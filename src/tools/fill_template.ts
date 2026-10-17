import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename, relative } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { createReport } from "docx-templates";
import { safeReadJsonFile, unflattenDotKeys } from "../utils/json.ts";
import { inspectDocx } from "./inspect.ts";
import type {
  ProcessDocumentOptions,
  ProcessDocumentResult,
  FillDocxTemplateSyntheticResult,
} from "../types/index.ts";
import {
  getAllElements,
  getDirectChildElements,
  extractParagraphText,
  extractParagraphNumbering,
  findBodyRunProperties,
  stripBoldFromRPr,
  stripBoldFromPPr,
  addBoldToRPr,
} from "../utils/xml.ts";

// ============================================================================
// 3. Função Central de Injeção (fill_docx_template / processDocument)
// ============================================================================

export function detectHierarchicalListItem(line: string): {
  isListItem: boolean;
  hasExplicitMarker: boolean;
  level: number;
} {
  // 1) Numeração decimal multinível: 1.1, 1.1.1, 1.1.1.1, 1.1.1.1.1 ...
  const multiDecimalMatch = line.match(
    /^\s*(?:\*\*)?(\d+(?:\.\d+)+)\.?(?:\*\*)?(?:\s+|\s*[-–—:]\s*)/
  );
  if (multiDecimalMatch) {
    const segments = multiDecimalMatch[1].split(".");
    return {
      isListItem: true,
      hasExplicitMarker: true,
      level: Math.max(1, segments.length - 1),
    };
  }

  // 2) Alíneas (a), b)) ou numerais romanos em minúsculo (i), ii), iii))
  const alphaOrRomanMatch = line.match(
    /^(\s*)(?:\*\*)?(?:[a-z]|[ivxlcdm]+)\)(?:\*\*)?\s+/i
  );
  if (alphaOrRomanMatch) {
    const leadingSpaces = alphaOrRomanMatch[1].length;
    return {
      isListItem: true,
      hasExplicitMarker: true,
      level: Math.max(2, Math.floor(leadingSpaces / 2) + 2),
    };
  }

  // 3) Marcadores / Bullets (-, •, *)
  const bulletMatch = line.match(/^(\s*)(?:\*\*)?[-•*](?:\*\*)?\s+/);
  if (bulletMatch) {
    const leadingSpaces = bulletMatch[1].length;
    return {
      isListItem: true,
      hasExplicitMarker: true,
      level: Math.max(1, Math.floor(leadingSpaces / 2) + 1),
    };
  }

  // 4) Item decimal simples (1. Texto, 2) Texto)
  const singleDecimalMatch = line.match(
    /^\s*(?:\*\*)?(\d+)[\.\)](?:\*\*)?\s+/
  );
  if (singleDecimalMatch) {
    return {
      isListItem: true,
      hasExplicitMarker: true,
      level: 0,
    };
  }

  return {
    isListItem: false,
    hasExplicitMarker: false,
    level: 0,
  };
}

function buildLineParagraphProperties(
  xmlDoc: Document,
  basePPr: Element | null,
  listInfo: { isListItem: boolean; hasExplicitMarker: boolean; level: number }
): Element | null {
  if (!listInfo.isListItem) {
    return basePPr ? (basePPr.cloneNode(true) as Element) : null;
  }

  const pPr = basePPr
    ? (basePPr.cloneNode(true) as Element)
    : xmlDoc.createElement("w:pPr");

  // Se a linha já possui marcador explícito (ex.: 1.1.1, a), •), remove <w:numPr>
  // herdado do template para evitar dupla numeração pelo Word
  if (listInfo.hasExplicitMarker) {
    const numPrList = getDirectChildElements(pPr, "w:numPr");
    for (const numPr of numPrList) {
      pPr.removeChild(numPr);
    }
  }

  // Aplica recuo progressivo (<w:ind>) proporcional ao subnível (level >= 1)
  if (listInfo.level >= 1) {
    const leftTwips = listInfo.level * 360;
    const hangingTwips = 360;
    const existingIndList = getDirectChildElements(pPr, "w:ind");
    const ind =
      existingIndList.length > 0
        ? existingIndList[0]
        : xmlDoc.createElement("w:ind");

    ind.removeAttribute("w:firstLine");
    ind.removeAttribute("firstLine");
    ind.setAttribute("w:left", String(leftTwips));
    ind.setAttribute("w:hanging", String(hangingTwips));

    if (existingIndList.length === 0) {
      pPr.appendChild(ind);
    }
  }

  return pPr;
}

function flattenRecursiveItemsArray(
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

function isHierarchicalListArray(arr: any[]): boolean {
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

async function extractTemplateForLoopTargets(
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
      }
    }
  } catch {
    // Ignora caso não seja possível extrair previamente
  }
  return targets;
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

function postProcessRichTextAndLineBreaksInXmlDoc(xmlDoc: Document): boolean {
  let modified = false;
  const paragraphs = getAllElements(xmlDoc, "w:p");

  for (const p of paragraphs) {
    const parent = p.parentNode;
    if (!parent) continue;

    const hasBrElements =
      getAllElements(p, "w:br").length > 0 ||
      getAllElements(p, "w:cr").length > 0;
    const fullText = extractParagraphText(p);
    const hasLineBreaks = hasBrElements || /\r?\n/.test(fullText);
    const hasMarkdownBold = /\*\*[^*]+\*\*/.test(fullText);
    const singleLineListInfo = detectHierarchicalListItem(fullText);
    const hasMultiLevelItem =
      singleLineListInfo.isListItem && singleLineListInfo.level >= 1;
    const hasNumberingConflict =
      singleLineListInfo.hasExplicitMarker &&
      extractParagraphNumbering(p) !== undefined;

    if (
      !hasLineBreaks &&
      !hasMarkdownBold &&
      !hasMultiLevelItem &&
      !hasNumberingConflict
    ) {
      continue;
    }

    const pPrList = getDirectChildElements(p, "w:pPr");
    let basePPr =
      pPrList.length > 0 ? (pPrList[0].cloneNode(true) as Element) : null;
    const detectedRPr = findBodyRunProperties([p]);

    let normalRPr: Element | null;
    if (hasMarkdownBold) {
      normalRPr = detectedRPr ? stripBoldFromRPr(detectedRPr) : null;
      if (basePPr) {
        basePPr = stripBoldFromPPr(basePPr);
      }
    } else {
      normalRPr = detectedRPr ? (detectedRPr.cloneNode(true) as Element) : null;
    }

    const lines = fullText.split(/\r?\n/);

    for (const line of lines) {
      const newP = xmlDoc.createElement("w:p");
      const lineListInfo = detectHierarchicalListItem(line);
      const linePPr = buildLineParagraphProperties(
        xmlDoc,
        basePPr,
        lineListInfo
      );
      if (linePPr) {
        newP.appendChild(linePPr);
      }

      const segments = line.split(/(\*\*[^*]+\*\*)/g);
      for (const seg of segments) {
        if (!seg) continue;
        const isBoldSeg =
          seg.startsWith("**") && seg.endsWith("**") && seg.length > 4;
        const cleanText = isBoldSeg ? seg.slice(2, -2) : seg;

        const r = xmlDoc.createElement("w:r");
        const rPrToUse = isBoldSeg
          ? addBoldToRPr(xmlDoc, normalRPr)
          : normalRPr
            ? (normalRPr.cloneNode(true) as Element)
            : null;
        if (rPrToUse) {
          r.appendChild(rPrToUse);
        }

        const t = xmlDoc.createElement("w:t");
        t.setAttribute("xml:space", "preserve");
        t.textContent = cleanText;
        r.appendChild(t);
        newP.appendChild(r);
      }

      parent.insertBefore(newP, p);
    }

    parent.removeChild(p);
    modified = true;
  }

  return modified;
}

async function postProcessInjectedDocxBuffer(
  rawBuffer: Uint8Array
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(rawBuffer);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  let anyModified = false;

  const fileNames = Object.keys(zip.files).sort();
  for (const name of fileNames) {
    if (
      name === "word/document.xml" ||
      /^word\/(header|footer)\d*\.xml$/i.test(name)
    ) {
      const partFile = zip.file(name);
      if (!partFile) continue;
      const xmlStr = await partFile.async("string");
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      if (postProcessRichTextAndLineBreaksInXmlDoc(xmlDoc)) {
        zip.file(name, serializer.serializeToString(xmlDoc));
        anyModified = true;
      }
    }
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

  if (!existsSync(resolvedTemplate)) {
    throw new Error(`Template não encontrado: ${resolvedTemplate}`);
  }
  if (!existsSync(resolvedState)) {
    throw new Error(
      `Arquivo de dados/estado não encontrado: ${resolvedState}`
    );
  }

  const templateBuffer = readFileSync(resolvedTemplate);
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
  const outDir = dirname(resolvedOutput);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  writeFileSync(resolvedOutput, finalBuffer);

  const stem = basename(resolvedOutput, ".docx");
  let inspectionPath: string | undefined;
  let auditViewPath: string | undefined;
  let nextHint: string;

  if (options?.autoInspect !== false) {
    let stateDir: string;
    if (options?.stateDir) {
      stateDir = resolve(options.stateDir);
    } else {
      const outputDir = dirname(resolvedOutput);
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

    const inspResult = await inspectDocx(resolvedOutput, inspectionPath, true);
    auditViewPath =
      inspResult.audit_view_path ?? resolve(stateDir, `visao_auditoria_${stem}.md`);

    const relVisao =
      relative(process.cwd(), auditViewPath).replace(/\\/g, "/") ||
      auditViewPath;
    nextHint = `Documento compilado e visão linear de auditoria gerada automaticamente em ${relVisao}. Próximo: acione o Auditor Externo lendo diretamente a visão linear (dispensado rodar inspect_docx novamente).`;
  } else {
    const relOutput =
      relative(process.cwd(), resolvedOutput).replace(/\\/g, "/") ||
      resolvedOutput;
    nextHint = `Documento compilado com sucesso em ${relOutput}. Próximo: execute 'inspect_docx' para gerar o espelho estrutural antes de auditar.`;
  }

  return {
    success: true,
    message: `Documento gerado com sucesso em: ${resolvedOutput}`,
    outputPath: resolvedOutput,
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
  const relInspection = result.inspection_path
    ? relative(baseDir, result.inspection_path).replace(/\\/g, "/")
    : undefined;
  const relVisao = result.visao_auditoria_path
    ? relative(baseDir, result.visao_auditoria_path).replace(/\\/g, "/")
    : undefined;

  const nextHint = relVisao
    ? `Documento compilado e visão linear de auditoria gerada automaticamente em ${relVisao}. Próximo: acione o Auditor Externo lendo diretamente a visão linear (dispensado rodar inspect_docx novamente).`
    : `Documento compilado com sucesso em ${relOutput}. Próximo: execute 'inspect_docx' para gerar o espelho estrutural antes de auditar.`;

  const payload: FillDocxTemplateSyntheticResult = {
    status: "success",
    outputPath: relOutput,
    ...(relInspection ? { inspection_path: relInspection } : {}),
    ...(relVisao ? { visao_auditoria_path: relVisao } : {}),
    message: result.message,
    next_step_hint: nextHint,
  };

  // Garante cumprimento estrito da Lei 2 (< 1024 bytes UTF-8)
  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 1000) {
    payload.message = "Documento compilado com sucesso.";
  }

  return payload;
}

