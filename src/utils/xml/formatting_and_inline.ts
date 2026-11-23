import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { ReplaceInlineRule } from "../../types/index.ts";
import {
  sanitizeXmlString,
  isElementMatch,
  getDirectChildElements,
  getAllElements,
} from "./dom_and_tags.ts";

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

  const xmlStr = sanitizeXmlString(await file.async("string"));
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
