import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  chmodSync,
} from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { spawn } from "node:child_process";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { createReport } from "docx-templates";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export const VERSION = "0.2.2";
export const GITHUB_REPO = "brunobenchimol/docgov-docx-engine";

// ============================================================================
// Interfaces e Tipos
// ============================================================================

export interface ParagraphNumberingInfo {
  numId: string;
  level: number;
}

export interface HeaderFooterParagraphInfo {
  part: string;
  index: number;
  paragraphIndex: number;
  style: string | null;
  text: string;
  numbering?: ParagraphNumberingInfo;
}

export interface BodyParagraphInfo {
  index: number;
  style: string | null;
  text: string;
  numbering?: ParagraphNumberingInfo;
}

export interface TableCellInfo {
  cellIndex: number;
  text: string;
}

export interface TableRowInfo {
  rowIndex: number;
  cells: TableCellInfo[];
}

export interface TableInfo {
  index: number;
  rows: TableRowInfo[];
}

export interface DocxInspectionResult {
  headers: HeaderFooterParagraphInfo[];
  footers: HeaderFooterParagraphInfo[];
  paragraphs: BodyParagraphInfo[];
  tables: TableInfo[];
}

export interface ReplaceParagraphRule {
  start_p: number;
  end_p: number;
  tag: string;
}

export interface LoopParagraphsRule {
  start_p: number;
  end_p: number;
  for_open_tag: string;
  for_close_tag: string;
  item_tag: string;
}

export interface ReplaceTableCellRule {
  table_index: number;
  row_index: number;
  cell_index: number;
  tag: string;
}

export interface LoopTableRowsRule {
  table_index: number;
  header_row_index: number;
  template_row_index: number;
  remove_from_row?: number;
  remove_to_row?: number;
  for_open_tag: string;
  for_close_tag: string;
  cell_tags: string[];
}

export interface ReplaceInlineRule {
  find: string;
  replace: string;
}

export interface SlotsManifest {
  replace_paragraphs?: ReplaceParagraphRule[];
  loop_paragraphs?: LoopParagraphsRule[];
  replace_table_cells?: ReplaceTableCellRule[];
  loop_table_rows?: LoopTableRowsRule[];
  replace_inline?: ReplaceInlineRule[];
}

export interface SelfUpdateOptions {
  checkOnly?: boolean;
  force?: boolean;
  targetPath?: string;
}

export interface SelfUpdateResult {
  updated: boolean;
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  targetPath: string;
  message: string;
}

// ============================================================================
// Utilitários Internos OpenXML / DOM
// ============================================================================

function isElementMatch(node: Node, tagName?: string): node is Element {
  if (node.nodeType !== 1) return false;
  if (!tagName) return true;
  const el = node as Element;
  const localTarget = tagName.includes(":") ? tagName.split(":")[1] : tagName;
  return (
    el.nodeName === tagName ||
    el.localName === localTarget ||
    el.nodeName.endsWith(`:${localTarget}`)
  );
}

function getDirectChildElements(parent: Node, tagName?: string): Element[] {
  const result: Element[] = [];
  if (!parent || !parent.childNodes) return result;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i];
    if (isElementMatch(child, tagName)) {
      result.push(child);
    }
  }
  return result;
}

function getAllElements(root: Node, tagName: string): Element[] {
  const result: Element[] = [];
  function walk(node: Node) {
    if (!node || !node.childNodes) return;
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (isElementMatch(child, tagName)) {
        result.push(child);
      }
      if (child.nodeType === 1) {
        walk(child);
      }
    }
  }
  walk(root);
  return result;
}

function extractParagraphText(p: Element): string {
  const parts: string[] = [];
  function walk(node: Node, insideWT: boolean) {
    if (!node || !node.childNodes) return;
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (
        isElementMatch(child, "w:br") ||
        isElementMatch(child, "w:cr")
      ) {
        parts.push("\n");
      } else if (child.nodeType === 3 && insideWT) {
        parts.push(child.nodeValue ?? "");
      } else if (child.nodeType === 1) {
        const nowInsideWT = insideWT || isElementMatch(child, "w:t");
        walk(child, nowInsideWT);
      }
    }
  }
  walk(p, isElementMatch(p, "w:t"));
  return parts.join("");
}

function extractParagraphStyle(p: Element): string | null {
  const pPrList = getDirectChildElements(p, "w:pPr");
  if (pPrList.length === 0) return null;
  const pStyleList = getDirectChildElements(pPrList[0], "w:pStyle");
  if (pStyleList.length === 0) return null;
  return (
    pStyleList[0].getAttribute("w:val") ||
    pStyleList[0].getAttribute("val") ||
    null
  );
}

function extractParagraphNumbering(
  p: Element
): ParagraphNumberingInfo | undefined {
  const pPrList = getDirectChildElements(p, "w:pPr");
  if (pPrList.length === 0) return undefined;
  const numPrList = getDirectChildElements(pPrList[0], "w:numPr");
  if (numPrList.length === 0) return undefined;
  const numIdEl = getDirectChildElements(numPrList[0], "w:numId")[0];
  const ilvlEl = getDirectChildElements(numPrList[0], "w:ilvl")[0];
  const numId =
    numIdEl?.getAttribute("w:val") || numIdEl?.getAttribute("val") || null;
  if (!numId || numId === "0") return undefined;
  const ilvlStr =
    ilvlEl?.getAttribute("w:val") || ilvlEl?.getAttribute("val") || "0";
  return {
    numId,
    level: parseInt(ilvlStr, 10) || 0,
  };
}

function extractCellText(tc: Element): string {
  const paragraphs = getDirectChildElements(tc, "w:p");
  if (paragraphs.length === 0) {
    return extractParagraphText(tc);
  }
  return paragraphs.map((p) => extractParagraphText(p)).join("\n");
}

function normalizeTag(tag: string): string {
  if (!tag) return "";
  return tag.includes("{{") ? tag : `{{${tag}}}`;
}

export function hasBoldProperty(rPr: Element | null): boolean {
  if (!rPr) return false;
  const bList = [
    ...getDirectChildElements(rPr, "w:b"),
    ...getDirectChildElements(rPr, "w:bCs"),
  ];
  if (bList.length === 0) return false;
  return bList.some((b) => {
    const val = b.getAttribute("w:val") || b.getAttribute("val");
    return val !== "0" && val !== "false";
  });
}

export function stripBoldFromRPr(rPr: Element): Element {
  const cloned = rPr.cloneNode(true) as Element;
  const toRemove = [
    ...getDirectChildElements(cloned, "w:b"),
    ...getDirectChildElements(cloned, "w:bCs"),
  ];
  for (const el of toRemove) {
    cloned.removeChild(el);
  }
  return cloned;
}

function stripBoldFromPPr(pPr: Element): Element {
  const cloned = pPr.cloneNode(true) as Element;
  const pRPrList = getDirectChildElements(cloned, "w:rPr");
  for (const pRPr of pRPrList) {
    const toRemove = [
      ...getDirectChildElements(pRPr, "w:b"),
      ...getDirectChildElements(pRPr, "w:bCs"),
    ];
    for (const el of toRemove) {
      pRPr.removeChild(el);
    }
  }
  return cloned;
}

function addBoldToRPr(doc: Document, baseRPr: Element | null): Element {
  const cloned = baseRPr
    ? stripBoldFromRPr(baseRPr)
    : doc.createElement("w:rPr");
  cloned.appendChild(doc.createElement("w:b"));
  cloned.appendChild(doc.createElement("w:bCs"));
  return cloned;
}

export function findBodyRunProperties(paragraphs: Element[]): Element | null {
  let firstRPr: Element | null = null;
  let hasNonBoldTextRun = false;

  for (const p of paragraphs) {
    if (!p) continue;
    const runs = getDirectChildElements(p, "w:r");
    for (const r of runs) {
      const text = getAllElements(r, "w:t")
        .map((t) => t.textContent ?? "")
        .join("")
        .trim();
      if (!text) continue;

      const rPrList = getDirectChildElements(r, "w:rPr");
      const rPr = rPrList.length > 0 ? rPrList[0] : null;

      if (!firstRPr && rPr) {
        firstRPr = rPr.cloneNode(true) as Element;
      }

      if (!hasBoldProperty(rPr)) {
        hasNonBoldTextRun = true;
        if (rPr) {
          // Preferir o <w:rPr> da primeira run de corpo (sem negrito)
          return rPr.cloneNode(true) as Element;
        }
      }
    }
  }

  // Se havia runs sem rPr explícito (texto normal) e a 1ª run tinha <w:b/>,
  // preserva fonte/tamanho da 1ª run mas remove <w:b/> e <w:bCs/>
  if (firstRPr && hasNonBoldTextRun && hasBoldProperty(firstRPr)) {
    return stripBoldFromRPr(firstRPr);
  }
  return firstRPr;
}

function findBodyParagraphProperties(paragraphs: Element[]): Element | null {
  let firstPPr: Element | null = null;
  for (const p of paragraphs) {
    if (!p) continue;
    const pPrList = getDirectChildElements(p, "w:pPr");
    const pPr = pPrList.length > 0 ? pPrList[0] : null;
    if (!firstPPr && pPr) {
      firstPPr = pPr.cloneNode(true) as Element;
    }
    const runs = getDirectChildElements(p, "w:r");
    const hasNonBoldRun = runs.some((r) => {
      const text = getAllElements(r, "w:t")
        .map((t) => t.textContent ?? "")
        .join("")
        .trim();
      if (!text) return false;
      const rPr = getDirectChildElements(r, "w:rPr")[0] ?? null;
      return !hasBoldProperty(rPr);
    });
    if (hasNonBoldRun && pPr) {
      return stripBoldFromPPr(pPr);
    }
  }
  return firstPPr ? stripBoldFromPPr(firstPPr) : null;
}

function setParagraphSingleRunText(
  doc: Document,
  p: Element,
  text: string,
  preferredRPr?: Element | null,
  preferredPPr?: Element | null
): void {
  const pPrList = getDirectChildElements(p, "w:pPr");
  let clonedPPr =
    preferredPPr !== undefined
      ? preferredPPr
      : pPrList.length > 0
        ? (pPrList[0].cloneNode(true) as Element)
        : null;

  const clonedRPr =
    preferredRPr !== undefined ? preferredRPr : findBodyRunProperties([p]);

  if (clonedPPr && !hasBoldProperty(clonedRPr)) {
    clonedPPr = stripBoldFromPPr(clonedPPr);
  }

  while (p.firstChild) {
    p.removeChild(p.firstChild);
  }

  if (clonedPPr) {
    p.appendChild(clonedPPr.cloneNode(true));
  }

  const r = doc.createElement("w:r");
  if (clonedRPr) {
    r.appendChild(clonedRPr.cloneNode(true));
  }

  const t = doc.createElement("w:t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = text;
  r.appendChild(t);

  p.appendChild(r);
}

function setTableCellSingleParagraphText(
  doc: Document,
  tc: Element,
  text: string
): void {
  const tcPrList = getDirectChildElements(tc, "w:tcPr");
  const clonedTcPr =
    tcPrList.length > 0 ? (tcPrList[0].cloneNode(true) as Element) : null;

  const existingParagraphs = getDirectChildElements(tc, "w:p");
  const firstP =
    existingParagraphs.length > 0
      ? existingParagraphs[0]
      : doc.createElement("w:p");
  const bodyRPr = findBodyRunProperties(existingParagraphs);
  const bodyPPr = findBodyParagraphProperties(existingParagraphs);

  setParagraphSingleRunText(doc, firstP, text, bodyRPr, bodyPPr);

  while (tc.firstChild) {
    tc.removeChild(tc.firstChild);
  }

  if (clonedTcPr) {
    tc.appendChild(clonedTcPr);
  }
  tc.appendChild(firstP);
}

function appendTextRunToTableCell(
  doc: Document,
  tc: Element,
  textToAppend: string
): void {
  const paragraphs = getDirectChildElements(tc, "w:p");
  let lastP: Element;
  if (paragraphs.length > 0) {
    lastP = paragraphs[paragraphs.length - 1];
  } else {
    lastP = doc.createElement("w:p");
    tc.appendChild(lastP);
  }

  const clonedRPr = findBodyRunProperties(paragraphs);
  const r = doc.createElement("w:r");
  if (clonedRPr) {
    r.appendChild(clonedRPr);
  }
  const t = doc.createElement("w:t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = textToAppend;
  r.appendChild(t);
  lastP.appendChild(r);
}

function applyInlineReplacementsToXmlDoc(
  xmlDoc: Document,
  rules: ReplaceInlineRule[]
): boolean {
  if (!rules || rules.length === 0) return false;
  let modified = false;
  const paragraphs = getAllElements(xmlDoc, "w:p");

  for (const p of paragraphs) {
    for (const rule of rules) {
      if (!rule.find) continue;
      const tNodes = getAllElements(p, "w:t");
      if (tNodes.length === 0) continue;

      const fullText = tNodes.map((t) => t.textContent ?? "").join("");
      if (!fullText.includes(rule.find)) continue;

      const updatedText = fullText.split(rule.find).join(rule.replace);
      tNodes[0].setAttribute("xml:space", "preserve");
      tNodes[0].textContent = updatedText;

      for (let i = 1; i < tNodes.length; i++) {
        const extraT = tNodes[i];
        const parentRun = extraT.parentNode as Element | null;
        if (parentRun && isElementMatch(parentRun, "w:r")) {
          parentRun.removeChild(extraT);
          const remainingChildren = getDirectChildElements(parentRun);
          const hasNonRPr = remainingChildren.some(
            (ch) => !isElementMatch(ch, "w:rPr")
          );
          if (!hasNonRPr && parentRun.parentNode) {
            parentRun.parentNode.removeChild(parentRun);
          }
        } else if (extraT.parentNode) {
          extraT.parentNode.removeChild(extraT);
        }
      }
      modified = true;
    }
  }

  return modified;
}

async function ensureContentTypesOverride(zip: JSZip): Promise<void> {
  const contentTypesPath = "[Content_Types].xml";
  const file = zip.file(contentTypesPath);
  const expectedPartName = "/word/document.xml";
  const expectedContentType =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

  if (!file) {
    const defaultXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="${expectedPartName}" ContentType="${expectedContentType}"/>
</Types>`;
    zip.file(contentTypesPath, defaultXml);
    return;
  }

  const xmlStr = await file.async("string");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
  const typesRoot = getAllElements(xmlDoc, "Types")[0] ?? xmlDoc.documentElement;
  if (!typesRoot) return;

  const overrides = getDirectChildElements(typesRoot, "Override");
  let found = false;
  for (const ov of overrides) {
    if (ov.getAttribute("PartName") === expectedPartName) {
      ov.setAttribute("ContentType", expectedContentType);
      found = true;
      break;
    }
  }

  if (!found) {
    const ov = xmlDoc.createElement("Override");
    ov.setAttribute("PartName", expectedPartName);
    ov.setAttribute("ContentType", expectedContentType);
    typesRoot.appendChild(ov);
  }

  const serializer = new XMLSerializer();
  zip.file(contentTypesPath, serializer.serializeToString(xmlDoc));
}

// ============================================================================
// 1. Função de Inspeção Estrutural (inspect_docx)
// ============================================================================

export async function inspectDocx(
  docxPath: string,
  outputPath?: string
): Promise<DocxInspectionResult> {
  const resolvedDocx = resolve(docxPath);
  if (!existsSync(resolvedDocx)) {
    throw new Error(`Arquivo .docx não encontrado: ${resolvedDocx}`);
  }

  const buffer = readFileSync(resolvedDocx);
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();

  const headers: HeaderFooterParagraphInfo[] = [];
  const footers: HeaderFooterParagraphInfo[] = [];

  const fileNames = Object.keys(zip.files).sort();

  for (const name of fileNames) {
    if (/^word\/header\d*\.xml$/i.test(name)) {
      const xmlStr = await zip.file(name)!.async("string");
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
      const xmlStr = await zip.file(name)!.async("string");
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
      `Estrutura OpenXML inválida (word/document.xml ausente): ${resolvedDocx}`
    );
  }

  const docXmlStr = await docFile.async("string");
  const docXml = parser.parseFromString(docXmlStr, "application/xml");
  const body = getAllElements(docXml, "w:body")[0];
  if (!body) {
    throw new Error(`Elemento <w:body> não encontrado em word/document.xml`);
  }

  const bodyParagraphs = getDirectChildElements(body, "w:p");
  const paragraphs: BodyParagraphInfo[] = bodyParagraphs.map((p, index) => {
    const numbering = extractParagraphNumbering(p);
    return {
      index,
      style: extractParagraphStyle(p),
      text: extractParagraphText(p),
      ...(numbering ? { numbering } : {}),
    };
  });

  const bodyTables = getDirectChildElements(body, "w:tbl");
  const tables: TableInfo[] = bodyTables.map((tbl, index) => {
    const trList = getDirectChildElements(tbl, "w:tr");
    return {
      index,
      rows: trList.map((tr, rowIndex) => {
        const tcList = getDirectChildElements(tr, "w:tc");
        return {
          rowIndex,
          cells: tcList.map((tc, cellIndex) => ({
            cellIndex,
            text: extractCellText(tc),
          })),
        };
      }),
    };
  });

  const result: DocxInspectionResult = {
    headers,
    footers,
    paragraphs,
    tables,
  };

  if (outputPath) {
    const resolvedOut = resolve(outputPath);
    writeFileSync(resolvedOut, JSON.stringify(result, null, 2), "utf-8");
  }

  return result;
}

// ============================================================================
// 2. Função Construtora de Template (build_docx_template)
// ============================================================================

export async function buildDocxTemplate(
  sourcePath: string,
  manifestPath: string,
  outputPath: string
): Promise<{ success: boolean; message: string }> {
  const resolvedSource = resolve(sourcePath);
  const resolvedManifest = resolve(manifestPath);
  const resolvedOutput = resolve(outputPath);

  if (!existsSync(resolvedSource)) {
    throw new Error(`Documento bruto não encontrado: ${resolvedSource}`);
  }
  if (!existsSync(resolvedManifest)) {
    throw new Error(
      `Manifesto de slots não encontrado: ${resolvedManifest}`
    );
  }

  const sourceBuffer = readFileSync(resolvedSource);
  const manifest: SlotsManifest = JSON.parse(
    readFileSync(resolvedManifest, "utf-8")
  );

  const zip = await JSZip.loadAsync(sourceBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error(
      `Estrutura OpenXML inválida (word/document.xml ausente): ${resolvedSource}`
    );
  }

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const docXmlStr = await docFile.async("string");
  const docXml = parser.parseFromString(docXmlStr, "application/xml");
  const body = getAllElements(docXml, "w:body")[0];
  if (!body) {
    throw new Error(`Elemento <w:body> não encontrado em word/document.xml`);
  }

  // Snapshot estático dos elementos originais para nunca deslocar índices
  const originalBodyParagraphs = getDirectChildElements(body, "w:p");
  const originalBodyTables = getDirectChildElements(body, "w:tbl").map(
    (tbl) => ({
      tbl,
      rows: getDirectChildElements(tbl, "w:tr").map((tr) => ({
        tr,
        cells: getDirectChildElements(tr, "w:tc"),
      })),
    })
  );

  // 2.1. replace_paragraphs
  if (manifest.replace_paragraphs && manifest.replace_paragraphs.length > 0) {
    for (const rule of manifest.replace_paragraphs) {
      const { start_p, end_p, tag } = rule;
      if (start_p < 0 || start_p >= originalBodyParagraphs.length) {
        throw new Error(
          `Índice start_p (${start_p}) fora do intervalo de parágrafos (0..${originalBodyParagraphs.length - 1})`
        );
      }
      const targetP = originalBodyParagraphs[start_p];
      const sliceEnd = Math.min(end_p, originalBodyParagraphs.length - 1);
      const paragraphRange = originalBodyParagraphs.slice(
        start_p,
        sliceEnd + 1
      );
      const bodyRPr = findBodyRunProperties(paragraphRange);
      const bodyPPr = findBodyParagraphProperties(paragraphRange);

      setParagraphSingleRunText(
        docXml,
        targetP,
        normalizeTag(tag),
        bodyRPr,
        bodyPPr
      );

      for (let i = start_p + 1; i <= sliceEnd; i++) {
        const pToRemove = originalBodyParagraphs[i];
        if (pToRemove && pToRemove.parentNode === body) {
          body.removeChild(pToRemove);
        }
      }
    }
  }

  // 2.1b. loop_paragraphs
  if (manifest.loop_paragraphs && manifest.loop_paragraphs.length > 0) {
    for (const rule of manifest.loop_paragraphs) {
      const { start_p, end_p, for_open_tag, for_close_tag, item_tag } = rule;
      if (start_p < 0 || start_p >= originalBodyParagraphs.length) {
        throw new Error(
          `Índice start_p (${start_p}) fora do intervalo de parágrafos (0..${originalBodyParagraphs.length - 1})`
        );
      }
      const targetP = originalBodyParagraphs[start_p];
      const sliceEnd = Math.min(end_p, originalBodyParagraphs.length - 1);
      const paragraphRange = originalBodyParagraphs.slice(
        start_p,
        sliceEnd + 1
      );
      const bodyRPr = findBodyRunProperties(paragraphRange);
      const bodyPPr = findBodyParagraphProperties(paragraphRange);

      const normalizedOpenTag = normalizeTag(for_open_tag).replace(
        /\bFOR\s+\$([a-zA-Z_]\w*)\s+IN\b/i,
        "FOR $1 IN"
      );
      const normalizedCloseTag = normalizeTag(for_close_tag).replace(
        /\bEND-FOR\s+\$([a-zA-Z_]\w*)\b/i,
        "END-FOR $1"
      );
      const forVarMatch = normalizedOpenTag.match(
        /\bFOR\s+([a-zA-Z_]\w*)\s+IN\b/i
      );
      const iteratorVar = forVarMatch ? forVarMatch[1] : null;
      let normalizedItemTag = normalizeTag(item_tag);
      if (iteratorVar && normalizedItemTag) {
        const varRegex = new RegExp(
          `(\\{\\{\\s*(?:INS\\s+|\\=\\s*)?)${iteratorVar}\\b`,
          "g"
        );
        normalizedItemTag = normalizedItemTag.replace(
          varRegex,
          `$1$${iteratorVar}`
        );
      }

      setParagraphSingleRunText(
        docXml,
        targetP,
        `${normalizedOpenTag}${normalizedItemTag}${normalizedCloseTag}`,
        bodyRPr,
        bodyPPr
      );

      for (let i = start_p + 1; i <= sliceEnd; i++) {
        const pToRemove = originalBodyParagraphs[i];
        if (pToRemove && pToRemove.parentNode === body) {
          body.removeChild(pToRemove);
        }
      }
    }
  }

  // 2.2. replace_table_cells
  if (manifest.replace_table_cells && manifest.replace_table_cells.length > 0) {
    for (const rule of manifest.replace_table_cells) {
      const { table_index, row_index, cell_index, tag } = rule;
      const tSnap = originalBodyTables[table_index];
      if (!tSnap) {
        throw new Error(`Tabela de índice ${table_index} não encontrada`);
      }
      const rSnap = tSnap.rows[row_index];
      if (!rSnap) {
        throw new Error(
          `Linha ${row_index} não encontrada na tabela ${table_index}`
        );
      }
      const tc = rSnap.cells[cell_index];
      if (!tc) {
        throw new Error(
          `Célula ${cell_index} não encontrada na linha ${row_index} da tabela ${table_index}`
        );
      }

      setTableCellSingleParagraphText(docXml, tc, normalizeTag(tag));
    }
  }

  // 2.3. loop_table_rows
  if (manifest.loop_table_rows && manifest.loop_table_rows.length > 0) {
    for (const rule of manifest.loop_table_rows) {
      const {
        table_index,
        header_row_index,
        template_row_index,
        remove_from_row,
        remove_to_row,
        for_open_tag,
        for_close_tag,
        cell_tags,
      } = rule;

      const tSnap = originalBodyTables[table_index];
      if (!tSnap) {
        throw new Error(`Tabela de índice ${table_index} não encontrada`);
      }
      const headerRow = tSnap.rows[header_row_index];
      if (!headerRow || headerRow.cells.length === 0) {
        throw new Error(
          `Linha de cabeçalho ${header_row_index} inválida na tabela ${table_index}`
        );
      }
      const templateRow = tSnap.rows[template_row_index];
      if (!templateRow || templateRow.cells.length === 0) {
        throw new Error(
          `Linha de template ${template_row_index} inválida na tabela ${table_index}`
        );
      }

      // Extrai o nome da variável iteradora do FOR (ex.: "r" em "{{FOR r IN gestao_riscos}}")
      const normalizedOpenTag = normalizeTag(for_open_tag).replace(
        /\bFOR\s+\$([a-zA-Z_]\w*)\s+IN\b/i,
        "FOR $1 IN"
      );
      const normalizedCloseTag = normalizeTag(for_close_tag).replace(
        /\bEND-FOR\s+\$([a-zA-Z_]\w*)\b/i,
        "END-FOR $1"
      );
      const forVarMatch = normalizedOpenTag.match(
        /\bFOR\s+([a-zA-Z_]\w*)\s+IN\b/i
      );
      const iteratorVar = forVarMatch ? forVarMatch[1] : null;

      // Anexa for_open_tag na última célula de header_row_index
      const lastHeaderCell = headerRow.cells[headerRow.cells.length - 1];
      appendTextRunToTableCell(docXml, lastHeaderCell, normalizedOpenTag);

      // Preenche cada célula de template_row_index com cell_tags e anexa for_close_tag na última célula
      const lastCellIdx = templateRow.cells.length - 1;
      for (let cIdx = 0; cIdx <= lastCellIdx; cIdx++) {
        const tc = templateRow.cells[cIdx];
        let cellTag = cell_tags[cIdx] ? normalizeTag(cell_tags[cIdx]) : "";
        if (iteratorVar && cellTag) {
          const varRegex = new RegExp(
            `(\\{\\{\\s*(?:INS\\s+|\\=\\s*)?)${iteratorVar}\\b`,
            "g"
          );
          cellTag = cellTag.replace(varRegex, `$1$${iteratorVar}`);
        }
        const finalCellContent =
          cIdx === lastCellIdx
            ? `${cellTag}${normalizedCloseTag}`
            : cellTag;
        setTableCellSingleParagraphText(docXml, tc, finalCellContent);
      }

      // Remove as linhas antigas de remove_from_row até remove_to_row
      if (remove_from_row !== undefined && remove_to_row !== undefined) {
        const maxRow = Math.min(remove_to_row, tSnap.rows.length - 1);
        for (let rIdx = remove_from_row; rIdx <= maxRow; rIdx++) {
          if (rIdx === header_row_index || rIdx === template_row_index) {
            continue;
          }
          const rowToRemove = tSnap.rows[rIdx]?.tr;
          if (rowToRemove && rowToRemove.parentNode === tSnap.tbl) {
            tSnap.tbl.removeChild(rowToRemove);
          }
        }
      }
    }
  }

  // 2.4. replace_inline (em word/document.xml, word/header*.xml e word/footer*.xml)
  if (manifest.replace_inline && manifest.replace_inline.length > 0) {
    applyInlineReplacementsToXmlDoc(docXml, manifest.replace_inline);

    const fileNames = Object.keys(zip.files).sort();
    for (const name of fileNames) {
      if (/^word\/(header|footer)\d*\.xml$/i.test(name)) {
        const partFile = zip.file(name)!;
        const partXmlStr = await partFile.async("string");
        const partXmlDoc = parser.parseFromString(
          partXmlStr,
          "application/xml"
        );
        if (
          applyInlineReplacementsToXmlDoc(partXmlDoc, manifest.replace_inline)
        ) {
          zip.file(name, serializer.serializeToString(partXmlDoc));
        }
      }
    }
  }

  // Atualiza word/document.xml no pacote ZIP
  zip.file("word/document.xml", serializer.serializeToString(docXml));

  // Garante Override em [Content_Types].xml
  await ensureContentTypesOverride(zip);

  const outBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  writeFileSync(resolvedOutput, outBuffer);

  return {
    success: true,
    message: `Template parametrizado gerado com sucesso em: ${resolvedOutput}`,
  };
}

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
  outputPath: string
): Promise<{ success: boolean; message: string }> {
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
  const rawStateData = JSON.parse(readFileSync(resolvedState, "utf-8"));
  const forLoopTargets = await extractTemplateForLoopTargets(templateBuffer);
  const stateData = normalizeNestedListsInState(rawStateData, forLoopTargets);

  const outputBuffer = await createReport({
    template: templateBuffer,
    data: stateData,
    cmdDelimiter: ["{{", "}}"],
    processLineBreaks: true,
    noSandbox: true,
  });

  const finalBuffer = await postProcessInjectedDocxBuffer(outputBuffer);
  writeFileSync(resolvedOutput, finalBuffer);
  return {
    success: true,
    message: `Documento gerado com sucesso em: ${resolvedOutput}`,
  };
}

// ============================================================================
// 4. Verificação de Versão e Auto-Atualização (Self-Update)
// ============================================================================

export function compareSemver(current: string, latest: string): number {
  const cleanCurrent = current.replace(/^v/i, "").trim();
  const cleanLatest = latest.replace(/^v/i, "").trim();

  const partsA = cleanCurrent.split(".").map((n) => parseInt(n, 10) || 0);
  const partsB = cleanLatest.split(".").map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const a = partsA[i] ?? 0;
    const b = partsB[i] ?? 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
}

export function getPlatformAssetName(platform: string = process.platform): string {
  return platform === "win32"
    ? "docgov-docx-windows-x64.exe"
    : "docgov-docx-linux-x64";
}

export function resolveSelfBinaryPath(customTargetPath?: string): string {
  if (customTargetPath) {
    return resolve(customTargetPath);
  }
  const execBase = basename(process.execPath).toLowerCase();
  if (
    execBase === "bun" ||
    execBase === "bun.exe" ||
    execBase === "node" ||
    execBase === "node.exe"
  ) {
    return resolve(
      process.platform === "win32"
        ? "./bin/docgov-docx.exe"
        : "./bin/docgov-docx"
    );
  }
  return resolve(process.execPath);
}

export function cleanupOldBinaryBackup(binaryPath?: string): void {
  try {
    const target = binaryPath ?? resolveSelfBinaryPath();
    const oldBackup = `${target}.old`;
    if (existsSync(oldBackup)) {
      unlinkSync(oldBackup);
    }
  } catch {
    // Ignora caso ainda esteja bloqueado pelo SO
  }
}

export async function fetchLatestReleaseInfo(
  repo: string = GITHUB_REPO
): Promise<{
  tag: string;
  version: string;
  downloadUrl: string;
  assetName: string;
}> {
  const assetName = getPlatformAssetName();

  // Tentativa 1: API oficial do GitHub
  try {
    const apiRes = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      {
        headers: {
          "User-Agent": `docgov-docx-engine/${VERSION}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (apiRes.ok) {
      const data = (await apiRes.json()) as {
        tag_name?: string;
        assets?: Array<{ name: string; browser_download_url: string }>;
      };
      if (data.tag_name) {
        const tag = data.tag_name;
        const version = tag.replace(/^v/i, "");
        const matchedAsset = data.assets?.find((a) => a.name === assetName);
        const downloadUrl =
          matchedAsset?.browser_download_url ??
          `https://github.com/${repo}/releases/download/${tag}/${assetName}`;
        return { tag, version, downloadUrl, assetName };
      }
    }
  } catch {
    // Prossegue para o fallback via redirecionamento HTTP
  }

  // Tentativa 2 (Fallback anti-Rate Limit): Redirecionamento de /releases/latest
  const redirectRes = await fetch(
    `https://github.com/${repo}/releases/latest`,
    {
      redirect: "follow",
      headers: {
        "User-Agent": `docgov-docx-engine/${VERSION}`,
      },
    }
  );

  if (!redirectRes.ok) {
    throw new Error(
      `Não foi possível consultar a última release em github.com/${repo} (HTTP ${redirectRes.status})`
    );
  }

  const finalUrl = redirectRes.url;
  const tagMatch = finalUrl.match(/\/releases\/tag\/([^/?#]+)/i);
  if (!tagMatch || !tagMatch[1]) {
    throw new Error(
      `Não foi possível identificar a versão mais recente a partir da URL: ${finalUrl}`
    );
  }

  const tag = decodeURIComponent(tagMatch[1]);
  const version = tag.replace(/^v/i, "");
  const downloadUrl = `https://github.com/${repo}/releases/download/${tag}/${assetName}`;
  return { tag, version, downloadUrl, assetName };
}

export function replaceBinaryOnDisk(
  targetPath: string,
  newBinaryBuffer: Uint8Array,
  minBytes: number = 1024
): void {
  if (newBinaryBuffer.byteLength < minBytes) {
    throw new Error(
      `Binário baixado inválido ou corrompido (${newBinaryBuffer.byteLength} bytes, mínimo esperado: ${minBytes} bytes)`
    );
  }

  const resolvedTarget = resolve(targetPath);
  const parentDir = dirname(resolvedTarget);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  const tempNewPath = `${resolvedTarget}.new`;
  const oldBackupPath = `${resolvedTarget}.old`;

  writeFileSync(tempNewPath, Buffer.from(newBinaryBuffer));

  if (process.platform !== "win32") {
    chmodSync(tempNewPath, 0o755);
    renameSync(tempNewPath, resolvedTarget);
    return;
  }

  // Estratégia Windows: renomeia o executável atual (mesmo em execução) para .old e move o .new para o destino
  if (existsSync(oldBackupPath)) {
    try {
      unlinkSync(oldBackupPath);
    } catch {
      // Ignora se já bloqueado
    }
  }

  if (existsSync(resolvedTarget)) {
    renameSync(resolvedTarget, oldBackupPath);
  }

  try {
    renameSync(tempNewPath, resolvedTarget);
  } catch (err) {
    // Rollback caso o rename do .new falhe
    if (!existsSync(resolvedTarget) && existsSync(oldBackupPath)) {
      try {
        renameSync(oldBackupPath, resolvedTarget);
      } catch {
        // Ignora erro de rollback
      }
    }
    throw err;
  }

  // Tenta remover o .old imediatamente; se for o próprio processo em execução, agenda limpeza em background
  if (existsSync(oldBackupPath)) {
    try {
      unlinkSync(oldBackupPath);
    } catch {
      try {
        const child = spawn(
          "cmd.exe",
          [
            "/c",
            `ping 127.0.0.1 -n 2 > nul & del /f /q "${oldBackupPath}"`,
          ],
          {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
          }
        );
        child.unref();
      } catch {
        // Será limpo automaticamente na próxima inicialização via cleanupOldBinaryBackup()
      }
    }
  }
}

export async function selfUpdate(
  options: SelfUpdateOptions = {}
): Promise<SelfUpdateResult> {
  const targetPath = resolveSelfBinaryPath(options.targetPath);
  const latest = await fetchLatestReleaseInfo();
  const cmp = compareSemver(VERSION, latest.version);
  const updateAvailable = cmp < 0;

  if (options.checkOnly) {
    const msg = updateAvailable
      ? `Nova versão disponível: v${latest.version} (atual: v${VERSION}). Execute 'docgov-docx --update' para atualizar.`
      : `Você já está na versão mais recente (v${VERSION}).`;
    return {
      updated: false,
      updateAvailable,
      currentVersion: VERSION,
      latestVersion: latest.version,
      targetPath,
      message: msg,
    };
  }

  if (!options.force && !updateAvailable) {
    return {
      updated: false,
      updateAvailable: false,
      currentVersion: VERSION,
      latestVersion: latest.version,
      targetPath,
      message: `Você já está na versão mais recente (v${VERSION}). Use '--force-update' para forçar a reinstalação.`,
    };
  }

  console.log(
    `Baixando ${latest.assetName} (v${latest.version}) de ${latest.downloadUrl} ...`
  );
  const res = await fetch(latest.downloadUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": `docgov-docx-engine/${VERSION}`,
    },
  });

  if (!res.ok) {
    throw new Error(
      `Falha ao baixar o binário da release v${latest.version} (HTTP ${res.status})`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  // Binário standalone Bun tem ~50-100MB; exigimos pelo menos 1 MB para evitar páginas de erro
  replaceBinaryOnDisk(targetPath, new Uint8Array(arrayBuffer), 1024 * 1024);

  return {
    updated: true,
    updateAvailable,
    currentVersion: VERSION,
    latestVersion: latest.version,
    targetPath,
    message: `Atualizado com sucesso para v${latest.version} em: ${targetPath}`,
  };
}

// ============================================================================
// Modo Servidor MCP (stdio)
// ============================================================================

async function runMcpServer() {
  const server = new Server(
    { name: "docgov-docx-engine", version: VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "inspect_docx",
          description:
            "Realiza a engenharia reversa estrutural de qualquer arquivo Word (.docx), extraindo cabeçalhos (headers), rodapés (footers), parágrafos indexados (0..N com estilo e texto) e tabelas indexadas (0..M com linhas e células).",
          inputSchema: {
            type: "object",
            required: ["docxPath"],
            properties: {
              docxPath: {
                type: "string",
                description: "Caminho do arquivo .docx a ser inspecionado",
              },
              outputPath: {
                type: "string",
                description:
                  "Caminho opcional onde o mapa estrutural JSON será gravado no disco",
              },
            },
          },
        },
        {
          name: "build_docx_template",
          description:
            "Transforma um documento Word (.docx) bruto (sem tags) em um template parametrizado com tags {{...}} a partir de um arquivo slots_manifest.json (suportando replace_paragraphs, replace_table_cells, loop_table_rows e replace_inline), preservando 100% da formatação visual.",
          inputSchema: {
            type: "object",
            required: ["sourcePath", "manifestPath", "outputPath"],
            properties: {
              sourcePath: {
                type: "string",
                description: "Caminho do arquivo .docx bruto original",
              },
              manifestPath: {
                type: "string",
                description:
                  "Caminho do arquivo slots_manifest.json com as regras de parametrização",
              },
              outputPath: {
                type: "string",
                description:
                  "Caminho onde o novo template .docx parametrizado será salvo",
              },
            },
          },
        },
        {
          name: "fill_docx_template",
          description:
            "Preenche um modelo Word (.docx) substituindo variáveis e tabelas com base no JSON de estado do processo, gerando uma minuta limpa sem código residual.",
          inputSchema: {
            type: "object",
            required: ["templatePath", "statePath", "outputPath"],
            properties: {
              templatePath: {
                type: "string",
                description: "Caminho do arquivo modelo .docx",
              },
              statePath: {
                type: "string",
                description: "Caminho do arquivo estado_caso.json",
              },
              outputPath: {
                type: "string",
                description: "Caminho onde o .docx final gerado será salvo",
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;

    try {
      if (toolName === "inspect_docx") {
        const { docxPath, outputPath } = request.params.arguments as {
          docxPath: string;
          outputPath?: string;
        };
        const inspection = await inspectDocx(docxPath, outputPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(inspection, null, 2),
            },
          ],
        };
      }

      if (toolName === "build_docx_template") {
        const { sourcePath, manifestPath, outputPath } = request.params
          .arguments as {
          sourcePath: string;
          manifestPath: string;
          outputPath: string;
        };
        const result = await buildDocxTemplate(
          sourcePath,
          manifestPath,
          outputPath
        );
        return {
          content: [{ type: "text", text: result.message }],
        };
      }

      if (toolName === "fill_docx_template") {
        const { templatePath, statePath, outputPath } = request.params
          .arguments as {
          templatePath: string;
          statePath: string;
          outputPath: string;
        };
        const result = await processDocument(
          templatePath,
          statePath,
          outputPath
        );
        return {
          content: [{ type: "text", text: result.message }],
        };
      }
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Falha ao executar ${toolName}: ${err.message}`,
          },
        ],
      };
    }

    throw new Error(`Ferramenta desconhecida: ${toolName}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ============================================================================
// Modo CLI (Linha de Comando)
// ============================================================================

async function runCli(args: string[]) {
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`docgov-docx-engine v${VERSION}`);
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
DocGov Docx Engine v${VERSION} — CLI & MCP Server

Uso:
  docgov-docx                                     Inicia como servidor MCP via stdio (padrão)
  docgov-docx --mcp                               Inicia como servidor MCP via stdio
  docgov-docx --inspect <arq.docx> [--out <mapa.json>]
  docgov-docx --build-template --source <bruto.docx> --manifest <slots_manifest.json> --out <template.docx>
  docgov-docx --inject --template <template.docx> --state <estado.json> --out <saida.docx>
  docgov-docx --check-update                      Verifica se há nova versão disponível no GitHub
  docgov-docx -u, --update                        Atualiza o binário para a versão mais recente (se houver)
  docgov-docx --force-update                      Força o download e reinstalação da última release
  docgov-docx -v, --version                       Exibe a versão do software
  docgov-docx -h, --help                          Exibe esta mensagem de ajuda
`);
    return;
  }

  // 0) Modo Auto-Atualização (--check-update, --update, -u, --force-update)
  if (
    args.includes("--check-update") ||
    args.includes("--update") ||
    args.includes("-u") ||
    args.includes("--force-update")
  ) {
    const checkOnly = args.includes("--check-update");
    const force = args.includes("--force-update");
    const outIdx = args.indexOf("--out");
    const customTarget = outIdx !== -1 ? args[outIdx + 1] : undefined;

    try {
      const res = await selfUpdate({
        checkOnly,
        force,
        targetPath: customTarget,
      });
      console.log(res.message);
    } catch (err: any) {
      console.error(`Erro na atualização: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 1) Modo --inspect
  if (args.includes("--inspect")) {
    const inspectIdx = args.indexOf("--inspect");
    const sourceIdx = args.indexOf("--source");
    const outIdx = args.indexOf("--out");

    let docxPath: string | undefined;
    if (sourceIdx !== -1 && args[sourceIdx + 1]) {
      docxPath = args[sourceIdx + 1];
    } else if (
      args[inspectIdx + 1] &&
      !args[inspectIdx + 1].startsWith("--")
    ) {
      docxPath = args[inspectIdx + 1];
    }

    const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;

    if (!docxPath) {
      console.error("Erro: Informe o caminho do arquivo .docx após --inspect.");
      process.exit(1);
    }

    try {
      const res = await inspectDocx(docxPath, outPath);
      console.log(JSON.stringify(res, null, 2));
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 2) Modo --build-template
  if (args.includes("--build-template")) {
    const sourceIdx = args.indexOf("--source");
    const manifestIdx = args.indexOf("--manifest");
    const outIdx = args.indexOf("--out");

    if (sourceIdx === -1 || manifestIdx === -1 || outIdx === -1) {
      console.error(
        "Erro: Parâmetros obrigatórios para --build-template: --source, --manifest e --out."
      );
      process.exit(1);
    }

    try {
      const res = await buildDocxTemplate(
        args[sourceIdx + 1],
        args[manifestIdx + 1],
        args[outIdx + 1]
      );
      console.log(res.message);
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 3) Modo --inject / --template
  const templateIdx = args.indexOf("--template");
  const stateIdx = args.indexOf("--state");
  const outIdx = args.indexOf("--out");

  if (templateIdx === -1 || stateIdx === -1 || outIdx === -1) {
    console.error(
      "Erro: Parâmetros obrigatórios ausentes: --template, --state e --out."
    );
    process.exit(1);
  }

  try {
    const res = await processDocument(
      args[templateIdx + 1],
      args[stateIdx + 1],
      args[outIdx + 1]
    );
    console.log(res.message);
  } catch (err: any) {
    console.error(`Erro: ${err.message}`);
    process.exit(1);
  }
}

// ============================================================================
// Entrada Principal
// ============================================================================

if (import.meta.main) {
  cleanupOldBinaryBackup();
  const args = process.argv.slice(2);

  // Se tiver flag explícita de CLI, roda CLI.
  // Caso contrário (sem args ou com --mcp), sobe como MCP server imediatamente.
  if (
    args.includes("--inspect") ||
    args.includes("--build-template") ||
    args.includes("--inject") ||
    args.includes("--template") ||
    args.includes("--check-update") ||
    args.includes("--update") ||
    args.includes("-u") ||
    args.includes("--force-update") ||
    args.includes("--help") ||
    args.includes("-h") ||
    args.includes("--version") ||
    args.includes("-v")
  ) {
    runCli(args);
  } else {
    runMcpServer();
  }
}
