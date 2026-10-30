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
  isElementMatch,
  getAllElements,
  getDirectChildElements,
  extractParagraphText,
  extractParagraphNumbering,
  findBodyRunProperties,
  stripBoldFromRPr,
  stripBoldFromPPr,
  addBoldToRPr,
  isInsideTableCell,
  NumberingManager,
  ensureNumberingPart,
  sanitizeTemplateTagExpression,
  sanitizeXmlString,
} from "../utils/xml.ts";

// ============================================================================
// 3. Função Central de Injeção (fill_docx_template / processDocument)
// ============================================================================

export interface HierarchicalListItemInfo {
  isListItem: boolean;
  hasExplicitMarker: boolean;
  level: number;
  kind: "multi_decimal" | "single_decimal" | "alpha_or_roman" | "bullet" | "none";
  markerText: string;
  markerBold: boolean;
  cleanRemainder: string;
  segments: number[];
  chapterNumber?: number;
}

function splitMarkerFromLine(
  line: string,
  fullMatch: string,
  openBold: string | undefined,
  rawMarker: string,
  closeBold: string | undefined,
  trailingSep?: string
): { markerText: string; markerBold: boolean; cleanRemainder: string } {
  const afterMatch = line.slice(fullMatch.length);
  const hadOpenBold = Boolean(openBold);
  const hadCloseBold = Boolean(closeBold);
  const markerBold = hadOpenBold;
  const effectiveMarker = trailingSep ? `${rawMarker}${trailingSep}` : rawMarker;

  // Se abriu ** antes do marcador mas não fechou ** logo após o marcador,
  // reabre ** no início do restante para preservar o negrito do título (ex.: "**4.1.1 Título:** Texto")
  const cleanRemainder =
    hadOpenBold && !hadCloseBold ? `**${afterMatch}` : afterMatch;

  return {
    markerText: effectiveMarker,
    markerBold,
    cleanRemainder,
  };
}

export function detectHierarchicalListItem(
  line: string
): HierarchicalListItemInfo {
  // 1) Numeração decimal multinível: 1.1, 1.1.1, 1.1.1.1, 1.1.1.1.1 ...
  const multiDecimalMatch = line.match(
    /^\s*(\*\*)?(\d+(?:\.\d+)+)(\.)?(\*\*)?(?:\s+|\s*([-–—:])\s*)/
  );
  if (multiDecimalMatch) {
    const rawNum = multiDecimalMatch[2];
    const trailingDot = multiDecimalMatch[3] ?? "";
    const sep = multiDecimalMatch[5] ?? "";
    const segments = rawNum.split(".").map((n) => parseInt(n, 10));
    const split = splitMarkerFromLine(
      line,
      multiDecimalMatch[0],
      multiDecimalMatch[1],
      `${rawNum}${trailingDot}`,
      multiDecimalMatch[4],
      sep
    );
    return {
      isListItem: true,
      hasExplicitMarker: true,
      level: Math.max(1, segments.length - 1),
      kind: "multi_decimal",
      markerText: split.markerText,
      markerBold: split.markerBold,
      cleanRemainder: split.cleanRemainder,
      segments,
      chapterNumber: segments[0],
    };
  }

  // 2) Alíneas (a), b)) ou numerais romanos em minúsculo (i), ii), iii))
  const alphaOrRomanMatch = line.match(
    /^(\s*)(\*\*)?((?:[a-z]|[ivxlcdm]+)\))(\*\*)?\s+/i
  );
  if (alphaOrRomanMatch) {
    const leadingSpaces = alphaOrRomanMatch[1].length;
    const split = splitMarkerFromLine(
      line,
      alphaOrRomanMatch[0],
      alphaOrRomanMatch[2],
      alphaOrRomanMatch[3],
      alphaOrRomanMatch[4]
    );
    return {
      isListItem: true,
      hasExplicitMarker: true,
      level: Math.max(2, Math.floor(leadingSpaces / 2) + 2),
      kind: "alpha_or_roman",
      markerText: split.markerText,
      markerBold: split.markerBold,
      cleanRemainder: split.cleanRemainder,
      segments: [],
    };
  }

  // 3) Marcadores / Bullets (-, •, *)
  const bulletMatch = line.match(/^(\s*)(\*\*)?([-•*])(\*\*)?\s+/);
  if (bulletMatch) {
    const leadingSpaces = bulletMatch[1].length;
    const split = splitMarkerFromLine(
      line,
      bulletMatch[0],
      bulletMatch[2],
      bulletMatch[3],
      bulletMatch[4]
    );
    return {
      isListItem: true,
      hasExplicitMarker: true,
      level: Math.max(1, Math.floor(leadingSpaces / 2) + 1),
      kind: "bullet",
      markerText: split.markerText,
      markerBold: split.markerBold,
      cleanRemainder: split.cleanRemainder,
      segments: [],
    };
  }

  // 4) Item decimal simples (1. Texto, 2) Texto)
  const singleDecimalMatch = line.match(
    /^\s*(\*\*)?((\d+)[\.\)])(\*\*)?\s+/
  );
  if (singleDecimalMatch) {
    const numVal = parseInt(singleDecimalMatch[3], 10);
    const split = splitMarkerFromLine(
      line,
      singleDecimalMatch[0],
      singleDecimalMatch[1],
      singleDecimalMatch[2],
      singleDecimalMatch[4]
    );
    return {
      isListItem: true,
      hasExplicitMarker: true,
      level: 0,
      kind: "single_decimal",
      markerText: split.markerText,
      markerBold: split.markerBold,
      cleanRemainder: split.cleanRemainder,
      segments: [numVal],
      chapterNumber: numVal,
    };
  }

  return {
    isListItem: false,
    hasExplicitMarker: false,
    level: 0,
    kind: "none",
    markerText: "",
    markerBold: false,
    cleanRemainder: line,
    segments: [],
  };
}

function buildNativeNumberingParagraphProperties(
  xmlDoc: Document,
  basePPr: Element | null,
  ilvl: number,
  numId: string
): Element {
  const pPr = basePPr
    ? (basePPr.cloneNode(true) as Element)
    : xmlDoc.createElement("w:pPr");

  // Remove <w:numPr> e <w:ind> antigos para que o <w:numPr> nativo governe o recuo via numbering.xml
  for (const oldNumPr of getDirectChildElements(pPr, "w:numPr")) {
    pPr.removeChild(oldNumPr);
  }
  for (const oldInd of getDirectChildElements(pPr, "w:ind")) {
    pPr.removeChild(oldInd);
  }

  const numPr = xmlDoc.createElement("w:numPr");
  const ilvlEl = xmlDoc.createElement("w:ilvl");
  ilvlEl.setAttribute("w:val", String(Math.max(0, Math.min(8, ilvl))));
  const numIdEl = xmlDoc.createElement("w:numId");
  numIdEl.setAttribute("w:val", numId);
  numPr.appendChild(ilvlEl);
  numPr.appendChild(numIdEl);

  pPr.appendChild(numPr);
  return pPr;
}

function buildHangingIndentParagraphProperties(
  xmlDoc: Document,
  basePPr: Element | null,
  listInfo: HierarchicalListItemInfo
): Element | null {
  if (!listInfo.isListItem) {
    return basePPr ? (basePPr.cloneNode(true) as Element) : null;
  }

  const pPr = basePPr
    ? (basePPr.cloneNode(true) as Element)
    : xmlDoc.createElement("w:pPr");

  // Remove <w:numPr> herdado do template para evitar conflito em tabelas
  if (listInfo.hasExplicitMarker) {
    const numPrList = getDirectChildElements(pPr, "w:numPr");
    for (const numPr of numPrList) {
      pPr.removeChild(numPr);
    }
  }

  const effectiveLevel = Math.max(1, listInfo.level);
  const leftTwips = effectiveLevel * 360;
  const hangingTwips = Math.min(360 + (effectiveLevel - 1) * 120, leftTwips);

  // Aplica <w:tabs><w:tab w:val="left" w:pos="..."/></w:tabs> para alinhamento vertical da 2ª linha
  const existingTabsList = getDirectChildElements(pPr, "w:tabs");
  for (const oldTabs of existingTabsList) {
    pPr.removeChild(oldTabs);
  }
  const tabsEl = xmlDoc.createElement("w:tabs");
  const tabEl = xmlDoc.createElement("w:tab");
  tabEl.setAttribute("w:val", "left");
  tabEl.setAttribute("w:pos", String(leftTwips));
  tabsEl.appendChild(tabEl);
  pPr.appendChild(tabsEl);

  // Aplica <w:ind w:left="..." w:hanging="..."/>
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

        // Reconhece também variáveis indexadas (ex.: itens[0] ou itens.0) para preservar arrays sem colapso
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

function appendRichTextRunsToParagraph(
  xmlDoc: Document,
  targetP: Element,
  textWithMarkdownBold: string,
  normalRPr: Element | null
): void {
  const segments = textWithMarkdownBold.split(/(\*\*[^*]+\*\*)/g);
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
    targetP.appendChild(r);
  }
}

// ============================================================================
// Conversor Nativo de Tabelas Markdown para OpenXML <w:tbl> (ENG-06 — v1.3.7)
// ============================================================================

export function parseMarkdownTableRowCells(line: string): string[] {
  let clean = line.trim();
  if (clean.startsWith("|")) {
    clean = clean.slice(1);
  }
  if (clean.endsWith("|")) {
    clean = clean.slice(0, -1);
  }
  return clean.split("|").map((c) => c.trim());
}

export function isMarkdownTablePipeRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const pipeCount = (trimmed.match(/\|/g) || []).length;
  const cells = parseMarkdownTableRowCells(trimmed);
  if (cells.length < 2) return false;
  return (trimmed.startsWith("|") && trimmed.endsWith("|")) || pipeCount >= 2;
}

export function isMarkdownTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const cells = parseMarkdownTableRowCells(trimmed);
  if (cells.length < 2) return false;
  return cells.every((c) => /^:?-{2,}:?$/.test(c));
}

export function parseMarkdownTableAlignments(
  sepLine: string
): Array<"left" | "center" | "right"> {
  const cells = parseMarkdownTableRowCells(sepLine);
  return cells.map((c) => {
    if (c.startsWith(":") && c.endsWith(":")) return "center";
    if (c.endsWith(":")) return "right";
    return "left";
  });
}

export type MarkdownLineSegment =
  | { type: "line"; line: string }
  | { type: "table"; lines: string[] };

export function segmentLinesWithMarkdownTables(
  lines: string[]
): MarkdownLineSegment[] {
  const segments: MarkdownLineSegment[] = [];
  let i = 0;
  while (i < lines.length) {
    if (
      i + 1 < lines.length &&
      isMarkdownTablePipeRow(lines[i]) &&
      !isMarkdownTableSeparatorLine(lines[i]) &&
      isMarkdownTableSeparatorLine(lines[i + 1])
    ) {
      const tableLines: string[] = [lines[i], lines[i + 1]];
      let j = i + 2;
      while (j < lines.length && isMarkdownTablePipeRow(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }
      segments.push({ type: "table", lines: tableLines });
      i = j;
    } else {
      segments.push({ type: "line", line: lines[i] });
      i++;
    }
  }
  return segments;
}

export function buildOpenXmlTableFromMarkdown(
  xmlDoc: Document,
  tableLines: string[],
  normalRPr: Element | null
): Element {
  const headerCells = parseMarkdownTableRowCells(tableLines[0]);
  const alignments = parseMarkdownTableAlignments(tableLines[1]);
  const dataRows = tableLines
    .slice(2)
    .filter((l) => !isMarkdownTableSeparatorLine(l))
    .map(parseMarkdownTableRowCells);

  const colCount = Math.max(
    headerCells.length,
    alignments.length,
    ...dataRows.map((r) => r.length),
    1
  );
  const totalWidthDxa = 9000;
  const colWidthDxa = Math.max(500, Math.floor(totalWidthDxa / colCount));

  const tbl = xmlDoc.createElement("w:tbl");

  // 1. <w:tblPr> com largura A4 útil, bordas corporativas CBD5E1 e padding interno
  const tblPr = xmlDoc.createElement("w:tblPr");
  const tblW = xmlDoc.createElement("w:tblW");
  tblW.setAttribute("w:w", String(totalWidthDxa));
  tblW.setAttribute("w:type", "dxa");
  tblPr.appendChild(tblW);

  const tblBorders = xmlDoc.createElement("w:tblBorders");
  for (const side of ["top", "left", "bottom", "right", "insideH", "insideV"]) {
    const bEl = xmlDoc.createElement(`w:${side}`);
    bEl.setAttribute("w:val", "single");
    bEl.setAttribute("w:sz", "4");
    bEl.setAttribute("w:space", "0");
    bEl.setAttribute("w:color", "CBD5E1");
    tblBorders.appendChild(bEl);
  }
  tblPr.appendChild(tblBorders);

  const tblCellMar = xmlDoc.createElement("w:tblCellMar");
  for (const [side, val] of [
    ["top", "80"],
    ["left", "120"],
    ["bottom", "80"],
    ["right", "120"],
  ] as const) {
    const mEl = xmlDoc.createElement(`w:${side}`);
    mEl.setAttribute("w:w", val);
    mEl.setAttribute("w:type", "dxa");
    tblCellMar.appendChild(mEl);
  }
  tblPr.appendChild(tblCellMar);
  tbl.appendChild(tblPr);

  // 2. <w:tblGrid>
  const tblGrid = xmlDoc.createElement("w:tblGrid");
  for (let c = 0; c < colCount; c++) {
    const gridCol = xmlDoc.createElement("w:gridCol");
    gridCol.setAttribute("w:w", String(colWidthDxa));
    tblGrid.appendChild(gridCol);
  }
  tbl.appendChild(tblGrid);

  // 3. Linha de Cabeçalho (R0) com <w:tblHeader/>, sombreado F1F5F9 e negrito <w:b/>
  const headerTr = xmlDoc.createElement("w:tr");
  const headerTrPr = xmlDoc.createElement("w:trPr");
  headerTrPr.appendChild(xmlDoc.createElement("w:tblHeader"));
  headerTr.appendChild(headerTrPr);

  const headerBoldRPr = addBoldToRPr(xmlDoc, normalRPr);

  for (let c = 0; c < colCount; c++) {
    const tc = xmlDoc.createElement("w:tc");
    const tcPr = xmlDoc.createElement("w:tcPr");
    const tcW = xmlDoc.createElement("w:tcW");
    tcW.setAttribute("w:w", String(colWidthDxa));
    tcW.setAttribute("w:type", "dxa");
    tcPr.appendChild(tcW);

    const shd = xmlDoc.createElement("w:shd");
    shd.setAttribute("w:val", "clear");
    shd.setAttribute("w:color", "auto");
    shd.setAttribute("w:fill", "F1F5F9");
    tcPr.appendChild(shd);
    tc.appendChild(tcPr);

    const p = xmlDoc.createElement("w:p");
    const pPr = xmlDoc.createElement("w:pPr");
    const jc = xmlDoc.createElement("w:jc");
    jc.setAttribute("w:val", alignments[c] ?? "left");
    pPr.appendChild(jc);
    p.appendChild(pPr);

    const rawHdr = (headerCells[c] ?? "").trim();
    const cleanHdr =
      rawHdr.startsWith("**") && rawHdr.endsWith("**") && rawHdr.length > 4
        ? rawHdr.slice(2, -2)
        : rawHdr;
    appendRichTextRunsToParagraph(xmlDoc, p, cleanHdr, headerBoldRPr);
    tc.appendChild(p);
    headerTr.appendChild(tc);
  }
  tbl.appendChild(headerTr);

  // 4. Linhas de Dados (R1..RN)
  for (const rowCells of dataRows) {
    const tr = xmlDoc.createElement("w:tr");
    for (let c = 0; c < colCount; c++) {
      const tc = xmlDoc.createElement("w:tc");
      const tcPr = xmlDoc.createElement("w:tcPr");
      const tcW = xmlDoc.createElement("w:tcW");
      tcW.setAttribute("w:w", String(colWidthDxa));
      tcW.setAttribute("w:type", "dxa");
      tcPr.appendChild(tcW);
      tc.appendChild(tcPr);

      const p = xmlDoc.createElement("w:p");
      const pPr = xmlDoc.createElement("w:pPr");
      const jc = xmlDoc.createElement("w:jc");
      jc.setAttribute("w:val", alignments[c] ?? "left");
      pPr.appendChild(jc);
      p.appendChild(pPr);

      const cellText = (rowCells[c] ?? "").trim();
      appendRichTextRunsToParagraph(xmlDoc, p, cellText, normalRPr);
      tc.appendChild(p);
      tr.appendChild(tc);
    }
    tbl.appendChild(tr);
  }

  return tbl;
}

function ensureTableCellEndsWithParagraph(xmlDoc: Document, tc: Node): void {
  if (!isElementMatch(tc, "w:tc")) return;
  const childElements = getDirectChildElements(tc);
  if (
    childElements.length === 0 ||
    !isElementMatch(childElements[childElements.length - 1], "w:p")
  ) {
    tc.appendChild(xmlDoc.createElement("w:p"));
  }
}

function convertSiblingParagraphMarkdownTables(xmlDoc: Document): boolean {
  let modified = false;
  const containers: Element[] = [
    ...getAllElements(xmlDoc, "w:body"),
    ...getAllElements(xmlDoc, "w:tc"),
  ];

  for (const container of containers) {
    const directChildren = getDirectChildElements(container);
    let i = 0;
    while (i < directChildren.length) {
      const child = directChildren[i];
      if (!isElementMatch(child, "w:p")) {
        i++;
        continue;
      }
      const line0 = extractParagraphText(child);
      if (
        i + 1 < directChildren.length &&
        isElementMatch(directChildren[i + 1], "w:p") &&
        isMarkdownTablePipeRow(line0) &&
        !isMarkdownTableSeparatorLine(line0)
      ) {
        const line1 = extractParagraphText(directChildren[i + 1]);
        if (isMarkdownTableSeparatorLine(line1)) {
          const tableLines: string[] = [line0, line1];
          const tableParas: Element[] = [child, directChildren[i + 1]];
          let j = i + 2;
          while (
            j < directChildren.length &&
            isElementMatch(directChildren[j], "w:p")
          ) {
            const nextLine = extractParagraphText(directChildren[j]);
            if (isMarkdownTablePipeRow(nextLine)) {
              tableLines.push(nextLine);
              tableParas.push(directChildren[j]);
              j++;
            } else {
              break;
            }
          }

          const detectedRPr = findBodyRunProperties(tableParas);
          const normalRPr = detectedRPr ? stripBoldFromRPr(detectedRPr) : null;
          const tblEl = buildOpenXmlTableFromMarkdown(
            xmlDoc,
            tableLines,
            normalRPr
          );

          container.insertBefore(tblEl, child);
          for (const tp of tableParas) {
            if (tp.parentNode === container) {
              container.removeChild(tp);
            }
          }
          ensureTableCellEndsWithParagraph(xmlDoc, container);
          modified = true;
          i = j;
          continue;
        }
      }
      i++;
    }
  }

  return modified;
}

function postProcessRichTextAndLineBreaksInXmlDoc(
  xmlDoc: Document,
  numberingManager?: NumberingManager
): boolean {
  let modified = false;
  const paragraphs = getAllElements(xmlDoc, "w:p");

  // Controla a instância <w:num> ativa para listas decimais no <w:body>
  let activeBodyChapter: number | null = null;
  let activeBodyNumId: string | null = null;
  const usedSubLevel1InCurrentNum = new Set<number>();

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
    const hasListItem = singleLineListInfo.isListItem;
    const hasNumberingConflict =
      singleLineListInfo.hasExplicitMarker &&
      extractParagraphNumbering(p) !== undefined;

    if (
      !hasLineBreaks &&
      !hasMarkdownBold &&
      !hasListItem &&
      !hasNumberingConflict
    ) {
      continue;
    }

    const insideTable = isInsideTableCell(p);
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
    const segments = segmentLinesWithMarkdownTables(lines);

    for (const seg of segments) {
      if (seg.type === "table") {
        const tblRPr = detectedRPr ? stripBoldFromRPr(detectedRPr) : null;
        const tblEl = buildOpenXmlTableFromMarkdown(xmlDoc, seg.lines, tblRPr);
        parent.insertBefore(tblEl, p);
        continue;
      }

      const line = seg.line;
      const newP = xmlDoc.createElement("w:p");
      const lineListInfo = detectHierarchicalListItem(line);

      const isDecimalListOutsideTable =
        !insideTable &&
        numberingManager !== undefined &&
        lineListInfo.isListItem &&
        (lineListInfo.kind === "multi_decimal" ||
          lineListInfo.kind === "single_decimal");

      if (isDecimalListOutsideTable && numberingManager) {
        // Modo 1: Fora de Tabela (<w:body>) — Lista Multinível Nativa com word/numbering.xml + <w:numPr>
        const chapter = lineListInfo.chapterNumber ?? 1;
        const subLvl1 =
          lineListInfo.segments.length > 1 ? lineListInfo.segments[1] : null;

        const shouldAllocateNewNum =
          activeBodyNumId === null ||
          activeBodyChapter !== chapter ||
          (lineListInfo.level === 1 &&
            subLvl1 !== null &&
            usedSubLevel1InCurrentNum.has(subLvl1));

        if (shouldAllocateNewNum) {
          activeBodyNumId = numberingManager.createMultilevelDecimalNum(
            chapter,
            lineListInfo.segments
          );
          activeBodyChapter = chapter;
          usedSubLevel1InCurrentNum.clear();
        }

        if (subLvl1 !== null) {
          usedSubLevel1InCurrentNum.add(subLvl1);
        }

        const nativePPr = buildNativeNumberingParagraphProperties(
          xmlDoc,
          basePPr,
          lineListInfo.level,
          activeBodyNumId!
        );
        newP.appendChild(nativePPr);

        // Limpa o prefixo numérico literal do <w:t> (usa cleanRemainder)
        appendRichTextRunsToParagraph(
          xmlDoc,
          newP,
          lineListInfo.cleanRemainder,
          normalRPr
        );
      } else if (lineListInfo.isListItem) {
        // Modo 2: Dentro de Tabela (<w:tc>) ou Alíneas/Bullets — Hanging Indent Estático com <w:tab/>
        const hangingPPr = buildHangingIndentParagraphProperties(
          xmlDoc,
          basePPr,
          lineListInfo
        );
        if (hangingPPr) {
          newP.appendChild(hangingPPr);
        }

        // Run 1: Marcador literal
        const markerRun = xmlDoc.createElement("w:r");
        const markerRPr = lineListInfo.markerBold
          ? addBoldToRPr(xmlDoc, normalRPr)
          : normalRPr
            ? (normalRPr.cloneNode(true) as Element)
            : null;
        if (markerRPr) {
          markerRun.appendChild(markerRPr);
        }
        const markerT = xmlDoc.createElement("w:t");
        markerT.setAttribute("xml:space", "preserve");
        markerT.textContent = lineListInfo.markerText;
        markerRun.appendChild(markerT);
        newP.appendChild(markerRun);

        // Run 2: Tabulação <w:r><w:tab/></w:r>
        const tabRun = xmlDoc.createElement("w:r");
        if (normalRPr) {
          tabRun.appendChild(normalRPr.cloneNode(true));
        }
        tabRun.appendChild(xmlDoc.createElement("w:tab"));
        newP.appendChild(tabRun);

        // Runs seguintes: Corpo do parágrafo sem o prefixo literal
        appendRichTextRunsToParagraph(
          xmlDoc,
          newP,
          lineListInfo.cleanRemainder,
          normalRPr
        );
      } else {
        // Parágrafo comum sem marcador de lista
        if (basePPr) {
          newP.appendChild(basePPr.cloneNode(true));
        }
        appendRichTextRunsToParagraph(xmlDoc, newP, line, normalRPr);
      }

      parent.insertBefore(newP, p);
    }

    parent.removeChild(p);
    ensureTableCellEndsWithParagraph(xmlDoc, parent);
    modified = true;
  }

  // Segunda passagem: converte tabelas Markdown formadas por parágrafos <w:p> irmãos consecutivos
  if (convertSiblingParagraphMarkdownTables(xmlDoc)) {
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
      if (postProcessRichTextAndLineBreaksInXmlDoc(xmlDoc, managerForPart)) {
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

  // Garante cumprimento estrito da Lei 2 (< 1024 bytes UTF-8)
  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 1000) {
    payload.message = "Documento compilado com sucesso.";
  }

  return payload;
}

