import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { DocxCommentInput } from "../../types/index.ts";
import {
  sanitizeXmlString,
  getDirectChildElements,
  getAllElements,
  extractParagraphText,
} from "../../utils/xml/dom_and_tags.ts";
import { stripRichTextMarkup } from "./rich_text_highlight.ts";

// ============================================================================
// Injetor Nativo de Comentários OpenXML (word/comments.xml) — Feature B
// ============================================================================

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const COMMENTS_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml";
const COMMENTS_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";

export interface InjectDocxCommentsResult {
  buffer: Buffer;
  commentsCount: number;
  unmatched: string[];
}

interface ParagraphRunSegment {
  run: Element;
  tNode?: Element;
  text: string;
  rawStart: number;
  rawEnd: number;
  isVirtual: boolean;
}

export function extractCommentsFromState(
  rawState: Record<string, any> | null | undefined
): DocxCommentInput[] {
  if (!rawState || typeof rawState !== "object" || !Array.isArray(rawState._comments)) {
    return [];
  }
  const valid: DocxCommentInput[] = [];
  for (const item of rawState._comments) {
    if (!item || typeof item !== "object") continue;
    const anchor = typeof item.anchor_text === "string" ? item.anchor_text : "";
    const text = typeof item.text === "string" ? item.text : "";
    if (!anchor.trim() || !text.trim()) continue;
    valid.push({
      ...(typeof item.slot_key === "string" && item.slot_key.trim()
        ? { slot_key: item.slot_key.trim() }
        : {}),
      anchor_text: anchor,
      ...(typeof item.author === "string" && item.author.trim()
        ? { author: item.author.trim() }
        : {}),
      ...(typeof item.initials === "string" && item.initials.trim()
        ? { initials: item.initials.trim() }
        : {}),
      text,
    });
  }
  return valid;
}

export function stripReservedUnderscoreKeys(
  rawState: Record<string, any>
): Record<string, any> {
  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) {
    return rawState;
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(rawState)) {
    if (!k.startsWith("_")) clean[k] = v;
  }
  return clean;
}

function normalizeMatchText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function collectStringsRecursive(val: any, out: string[]): void {
  if (typeof val === "string") out.push(val);
  else if (Array.isArray(val)) val.forEach((item) => collectStringsRecursive(item, out));
  else if (val && typeof val === "object") {
    Object.values(val).forEach((v) => collectStringsRecursive(v, out));
  }
}

function resolveSlotScopeTexts(
  stateData: Record<string, any> | undefined,
  slotKey: string
): string[] {
  if (!stateData || !slotKey) return [];
  let target: any = stateData[slotKey];
  if (target === undefined && slotKey.includes(".")) {
    target = slotKey.split(".").reduce<any>(
      (cur, part) => (cur && typeof cur === "object" && part in cur ? cur[part] : undefined),
      stateData
    );
  }
  if (target === undefined || target === null) return [];

  const rawStrings: string[] = [];
  collectStringsRecursive(target, rawStrings);

  const lines: string[] = [];
  for (const raw of rawStrings) {
    for (const line of raw.split(/\r?\n/)) {
      const stripped = stripRichTextMarkup(line, { highlightPlaceholders: true });
      const norm = normalizeMatchText(stripped);
      if (norm) lines.push(norm);
    }
  }
  return lines;
}

function filterCandidateParagraphs(
  allParagraphs: Element[],
  slotKey: string | undefined,
  stateData: Record<string, any> | undefined
): Element[] {
  if (!slotKey || !slotKey.trim()) return allParagraphs;
  const slotLines = resolveSlotScopeTexts(stateData, slotKey.trim());
  if (slotLines.length === 0) return [];
  return allParagraphs.filter((p) => {
    const pNorm = normalizeMatchText(extractParagraphText(p));
    if (!pNorm) return false;
    return slotLines.some(
      (sLine) => pNorm.includes(sLine) || (pNorm.length >= 4 && sLine.includes(pNorm))
    );
  });
}

function buildParagraphRunSegments(p: Element): {
  segments: ParagraphRunSegment[];
  rawText: string;
} {
  const segments: ParagraphRunSegment[] = [];
  let rawText = "";

  for (const r of getDirectChildElements(p, "w:r")) {
    if (getDirectChildElements(r, "w:commentReference").length > 0) continue;
    const tNodes = getDirectChildElements(r, "w:t");
    if (tNodes.length > 0) {
      for (const tNode of tNodes) {
        const text = tNode.textContent ?? "";
        if (!text) continue;
        const rawStart = rawText.length;
        rawText += text;
        segments.push({ run: r, tNode, text, rawStart, rawEnd: rawText.length, isVirtual: false });
      }
    } else if (getDirectChildElements(r, "w:tab").length > 0) {
      const rawStart = rawText.length;
      rawText += " ";
      segments.push({ run: r, text: " ", rawStart, rawEnd: rawText.length, isVirtual: true });
    }
  }
  return { segments, rawText };
}

function findNormalizedSpanInRaw(
  rawText: string,
  anchorText: string
): { rawStart: number; rawEnd: number } | null {
  const needle = normalizeMatchText(anchorText);
  if (!needle) return null;

  const chars: string[] = [];
  const rawStarts: number[] = [];
  const rawEnds: number[] = [];
  let i = 0;
  while (i < rawText.length && /\s/.test(rawText[i])) i++;
  while (i < rawText.length) {
    if (/\s/.test(rawText[i])) {
      const wsStart = i;
      while (i < rawText.length && /\s/.test(rawText[i])) i++;
      if (i < rawText.length) {
        chars.push(" ");
        rawStarts.push(wsStart);
        rawEnds.push(i);
      }
    } else {
      chars.push(rawText[i]);
      rawStarts.push(i);
      rawEnds.push(i + 1);
      i++;
    }
  }

  const norm = chars.join("");
  if (!norm) return null;
  let matchIdx = norm.indexOf(needle);
  if (matchIdx === -1) matchIdx = norm.toLowerCase().indexOf(needle.toLowerCase());
  if (matchIdx === -1) return null;

  return { rawStart: rawStarts[matchIdx], rawEnd: rawEnds[matchIdx + needle.length - 1] };
}

function splitRunAtOffset(
  doc: Document,
  p: Element,
  seg: ParagraphRunSegment,
  splitOffset: number
): { leftRun: Element; rightRun: Element } {
  const baseRPr = getDirectChildElements(seg.run, "w:rPr")[0] ?? null;
  seg.tNode!.setAttribute("xml:space", "preserve");
  seg.tNode!.textContent = seg.text.slice(0, splitOffset);

  const rightRun = doc.createElement("w:r");
  if (baseRPr) rightRun.appendChild(baseRPr.cloneNode(true));
  const rightT = doc.createElement("w:t");
  rightT.setAttribute("xml:space", "preserve");
  rightT.textContent = seg.text.slice(splitOffset);
  rightRun.appendChild(rightT);

  if (seg.run.nextSibling) p.insertBefore(rightRun, seg.run.nextSibling);
  else p.appendChild(rightRun);
  return { leftRun: seg.run, rightRun };
}

function insertCommentRangeMarkers(
  doc: Document,
  p: Element,
  firstRun: Element,
  lastRun: Element,
  commentId: number
): boolean {
  const idStr = String(commentId);
  const rangeStart = doc.createElement("w:commentRangeStart");
  rangeStart.setAttribute("w:id", idStr);
  p.insertBefore(rangeStart, firstRun);

  const rangeEnd = doc.createElement("w:commentRangeEnd");
  rangeEnd.setAttribute("w:id", idStr);
  const refRun = doc.createElement("w:r");
  const commentRef = doc.createElement("w:commentReference");
  commentRef.setAttribute("w:id", idStr);
  refRun.appendChild(commentRef);

  const afterLast = lastRun.nextSibling;
  if (afterLast) {
    p.insertBefore(rangeEnd, afterLast);
    p.insertBefore(refRun, afterLast);
  } else {
    p.appendChild(rangeEnd);
    p.appendChild(refRun);
  }
  return true;
}

function anchorCommentInParagraph(
  doc: Document,
  p: Element,
  anchorText: string,
  commentId: number
): boolean {
  const { segments, rawText } = buildParagraphRunSegments(p);
  if (segments.length === 0) return false;
  const span = findNormalizedSpanInRaw(rawText, anchorText);
  if (!span) return false;

  const { rawStart, rawEnd } = span;
  for (const seg of segments) {
    if (seg.isVirtual || !seg.tNode) continue;
    if (seg.rawStart < rawStart && rawStart < seg.rawEnd) {
      const { rightRun } = splitRunAtOffset(doc, p, seg, rawStart - seg.rawStart);
      if (seg.rawStart < rawEnd && rawEnd < seg.rawEnd) {
        const rightT = getDirectChildElements(rightRun, "w:t")[0];
        const midLen = rawEnd - rawStart;
        const rightFullText = rightT.textContent ?? "";
        if (midLen < rightFullText.length) {
          splitRunAtOffset(
            doc,
            p,
            { run: rightRun, tNode: rightT, text: rightFullText, rawStart, rawEnd: seg.rawEnd, isVirtual: false },
            midLen
          );
        }
        return insertCommentRangeMarkers(doc, p, rightRun, rightRun, commentId);
      }
      break;
    }
  }

  for (const seg of buildParagraphRunSegments(p).segments) {
    if (seg.isVirtual || !seg.tNode) continue;
    if (seg.rawStart < rawEnd && rawEnd < seg.rawEnd) {
      splitRunAtOffset(doc, p, seg, rawEnd - seg.rawStart);
      break;
    }
  }

  const coveredRuns = buildParagraphRunSegments(p)
    .segments.filter((s) => !s.isVirtual && s.rawEnd > rawStart && s.rawStart < rawEnd)
    .map((s) => s.run);
  if (coveredRuns.length === 0) return false;
  return insertCommentRangeMarkers(
    doc,
    p,
    coveredRuns[0],
    coveredRuns[coveredRuns.length - 1],
    commentId
  );
}

function deriveInitials(author: string, explicitInitials?: string): string {
  if (explicitInitials?.trim()) return explicitInitials.trim().slice(0, 6);
  const letters = author
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  return (letters || "DG").slice(0, 4);
}

function getMaxCommentId(commentsDoc: Document): number {
  let maxId = 0;
  for (const el of getAllElements(commentsDoc, "w:comment")) {
    const parsed = Number.parseInt(el.getAttribute("w:id") || el.getAttribute("id") || "", 10);
    if (Number.isFinite(parsed) && parsed > maxId) maxId = parsed;
  }
  return maxId;
}

function appendCommentElement(
  commentsDoc: Document,
  commentsRoot: Element,
  commentId: number,
  item: DocxCommentInput
): void {
  const author = item.author?.trim() || "DocGov";
  const commentEl = commentsDoc.createElement("w:comment");
  commentEl.setAttribute("w:id", String(commentId));
  commentEl.setAttribute("w:author", author);
  commentEl.setAttribute("w:date", new Date().toISOString());
  commentEl.setAttribute("w:initials", deriveInitials(author, item.initials));

  for (const line of item.text.split(/\r?\n/)) {
    const p = commentsDoc.createElement("w:p");
    const r = commentsDoc.createElement("w:r");
    const t = commentsDoc.createElement("w:t");
    t.setAttribute("xml:space", "preserve");
    t.textContent = line;
    r.appendChild(t);
    p.appendChild(r);
    commentEl.appendChild(p);
  }
  commentsRoot.appendChild(commentEl);
}

async function ensureCommentsContentTypeAndRels(zip: JSZip): Promise<void> {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const ctFile = zip.file("[Content_Types].xml");
  if (ctFile) {
    const ctDoc = parser.parseFromString(sanitizeXmlString(await ctFile.async("string")), "application/xml");
    const typesRoot = getAllElements(ctDoc, "Types")[0] ?? ctDoc.documentElement;
    if (
      typesRoot &&
      !getDirectChildElements(typesRoot, "Override").some(
        (ov) => ov.getAttribute("PartName") === "/word/comments.xml"
      )
    ) {
      const ov = ctDoc.createElement("Override");
      ov.setAttribute("PartName", "/word/comments.xml");
      ov.setAttribute("ContentType", COMMENTS_CONTENT_TYPE);
      typesRoot.appendChild(ov);
      zip.file("[Content_Types].xml", serializer.serializeToString(ctDoc));
    }
  }

  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  if (!relsFile) {
    zip.file(
      relsPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${COMMENTS_REL_TYPE}" Target="comments.xml"/></Relationships>`
    );
    return;
  }

  const relsDoc = parser.parseFromString(sanitizeXmlString(await relsFile.async("string")), "application/xml");
  const relsRoot = getAllElements(relsDoc, "Relationships")[0] ?? relsDoc.documentElement;
  if (!relsRoot) return;

  const existingRels = getDirectChildElements(relsRoot, "Relationship");
  if (
    existingRels.some(
      (rel) =>
        rel.getAttribute("Type") === COMMENTS_REL_TYPE ||
        rel.getAttribute("Target") === "comments.xml" ||
        rel.getAttribute("Target") === "/word/comments.xml"
    )
  ) {
    return;
  }

  let maxRId = 0;
  for (const rel of existingRels) {
    const m = (rel.getAttribute("Id") || "").match(/^rId(\d+)$/i);
    if (m) maxRId = Math.max(maxRId, Number.parseInt(m[1], 10));
  }
  const newRel = relsDoc.createElement("Relationship");
  newRel.setAttribute("Id", `rId${maxRId + 1}`);
  newRel.setAttribute("Type", COMMENTS_REL_TYPE);
  newRel.setAttribute("Target", "comments.xml");
  relsRoot.appendChild(newRel);
  zip.file(relsPath, serializer.serializeToString(relsDoc));
}

export async function injectDocxCommentsIntoBuffer(
  docxBuffer: Buffer,
  comments: DocxCommentInput[],
  stateData?: Record<string, any>
): Promise<InjectDocxCommentsResult> {
  if (!comments || comments.length === 0) {
    return { buffer: docxBuffer, commentsCount: 0, unmatched: [] };
  }

  const zip = await JSZip.loadAsync(docxBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    return { buffer: docxBuffer, commentsCount: 0, unmatched: comments.map((c) => c.anchor_text) };
  }

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const docXml = parser.parseFromString(sanitizeXmlString(await docFile.async("string")), "application/xml");

  const existingCommentsFile = zip.file("word/comments.xml");
  const commentsXmlStr = existingCommentsFile
    ? sanitizeXmlString(await existingCommentsFile.async("string"))
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="${W_NS}"/>`;
  const commentsDoc = parser.parseFromString(commentsXmlStr, "application/xml");
  const commentsRoot = getAllElements(commentsDoc, "w:comments")[0] ?? commentsDoc.documentElement;

  let nextId = getMaxCommentId(commentsDoc) + 1;
  const allParagraphs = getAllElements(docXml, "w:p");
  const unmatched: string[] = [];
  let addedCount = 0;

  for (const item of comments) {
    const candidates = filterCandidateParagraphs(allParagraphs, item.slot_key, stateData);
    let anchored = false;
    for (const p of candidates) {
      if (anchorCommentInParagraph(docXml, p, item.anchor_text, nextId)) {
        appendCommentElement(commentsDoc, commentsRoot, nextId, item);
        nextId++;
        addedCount++;
        anchored = true;
        break;
      }
    }
    if (!anchored) {
      unmatched.push(item.slot_key ? `${item.slot_key}: ${item.anchor_text}` : item.anchor_text);
    }
  }

  const totalComments = getAllElements(commentsDoc, "w:comment").length;
  if (addedCount === 0) {
    return { buffer: docxBuffer, commentsCount: totalComments, unmatched };
  }

  zip.file("word/document.xml", serializer.serializeToString(docXml));
  zip.file("word/comments.xml", serializer.serializeToString(commentsDoc));
  await ensureCommentsContentTypeAndRels(zip);

  const outBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer: outBuffer, commentsCount: totalComments, unmatched };
}
