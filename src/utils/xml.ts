import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { ParagraphNumberingInfo, ReplaceInlineRule } from "../types/index.ts";

// ============================================================================
// Utilitários Internos OpenXML / DOM
// ============================================================================

export function isElementMatch(node: Node, tagName?: string): node is Element {
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

export function getDirectChildElements(parent: Node, tagName?: string): Element[] {
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

export function getAllElements(root: Node, tagName: string): Element[] {
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

export function extractParagraphText(p: Element): string {
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

export function extractParagraphStyle(p: Element): string | null {
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

export function extractParagraphNumbering(
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

export function extractCellText(tc: Element): string {
  const paragraphs = getDirectChildElements(tc, "w:p");
  if (paragraphs.length === 0) {
    return extractParagraphText(tc);
  }
  return paragraphs.map((p) => extractParagraphText(p)).join("\n");
}

export function normalizeTag(tag: string): string {
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

export function stripBoldFromPPr(pPr: Element): Element {
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

export function addBoldToRPr(doc: Document, baseRPr: Element | null): Element {
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

export function findBodyParagraphProperties(paragraphs: Element[]): Element | null {
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

export function setParagraphSingleRunText(
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

export function setTableCellSingleParagraphText(
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

export function appendTextRunToTableCell(
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

export function applyInlineReplacementsToXmlDoc(
  xmlDoc: Document,
  rules: ReplaceInlineRule[]
): number {
  if (!rules || rules.length === 0) return 0;
  let count = 0;
  const paragraphs = getAllElements(xmlDoc, "w:p");

  for (const p of paragraphs) {
    for (const rule of rules) {
      if (!rule.find) continue;
      const tNodes = getAllElements(p, "w:t");
      if (tNodes.length === 0) continue;

      const fullText = tNodes.map((t) => t.textContent ?? "").join("");
      if (!fullText.includes(rule.find)) continue;

      const occurrences = fullText.split(rule.find).length - 1;
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
      count += occurrences;
    }
  }

  return count;
}

export async function ensureContentTypesOverride(zip: JSZip): Promise<void> {
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

