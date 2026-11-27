// ============================================================================
// Highlight OpenXML (Auto-Highlight de Placeholders & ==texto==) + Ordem CT_RPr
// ============================================================================

export const VALID_WORD_HIGHLIGHT_COLORS = new Set<string>([
  "yellow",
  "green",
  "cyan",
  "magenta",
  "blue",
  "red",
  "darkBlue",
  "darkCyan",
  "darkGreen",
  "darkMagenta",
  "darkRed",
  "darkYellow",
  "darkGray",
  "lightGray",
  "black",
  "white",
]);

const HIGHLIGHT_COLOR_CANONICAL_MAP = new Map<string, string>(
  Array.from(VALID_WORD_HIGHLIGHT_COLORS, (c) => [c.toLowerCase(), c])
);

// Sequência estrita de CT_RPr conforme ISO/IEC 29500-1 (§17.3.2.28)
const CT_RPR_ORDER: readonly string[] = [
  "rStyle",
  "rFonts",
  "b",
  "bCs",
  "i",
  "iCs",
  "caps",
  "smallCaps",
  "strike",
  "dstrike",
  "outline",
  "shadow",
  "emboss",
  "imprint",
  "noProof",
  "snapToGrid",
  "vanish",
  "webHidden",
  "color",
  "spacing",
  "w",
  "kern",
  "position",
  "sz",
  "szCs",
  "highlight",
  "u",
  "effect",
  "bdr",
  "shd",
  "fitText",
  "vertAlign",
  "rtl",
  "cs",
  "em",
  "lang",
  "eastAsianLayout",
  "specVanish",
  "oMath",
  "rPrChange",
];

const PLACEHOLDER_PATTERN = /`?\[(?:A\s*DEFINIR|INSERIR)[^\]]*\]`?/;

export interface RichTextToken {
  text: string;
  bold: boolean;
  highlightColor?: string;
}

export interface RichTextOptions {
  highlightPlaceholders?: boolean;
}

export function normalizeWordHighlightColor(raw?: string): string {
  if (!raw || typeof raw !== "string") return "yellow";
  const key = raw.trim().toLowerCase();
  return HIGHLIGHT_COLOR_CANONICAL_MAP.get(key) ?? "yellow";
}

function getLocalTagName(node: Node): string {
  const name = (node as Element).localName || (node as Element).nodeName || "";
  const idx = name.indexOf(":");
  return idx >= 0 ? name.slice(idx + 1) : name;
}

function removeDirectChildrenByLocalName(parent: Element, localName: string): void {
  const toRemove: Node[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const ch = parent.childNodes[i];
    if (ch.nodeType === 1 && getLocalTagName(ch) === localName) {
      toRemove.push(ch);
    }
  }
  for (const ch of toRemove) {
    parent.removeChild(ch);
  }
}

function insertElementInRPrOrder(
  rPr: Element,
  newEl: Element,
  localName: string
): void {
  const targetIdx = CT_RPR_ORDER.indexOf(localName);
  if (targetIdx === -1) {
    rPr.appendChild(newEl);
    return;
  }

  for (let i = 0; i < rPr.childNodes.length; i++) {
    const ch = rPr.childNodes[i];
    if (ch.nodeType !== 1) continue;
    const chIdx = CT_RPR_ORDER.indexOf(getLocalTagName(ch));
    if (chIdx !== -1 && chIdx > targetIdx) {
      rPr.insertBefore(newEl, ch);
      return;
    }
  }

  rPr.appendChild(newEl);
}

export function insertHighlightInRPr(
  doc: Document,
  baseRPr: Element | null,
  color: string = "yellow"
): Element {
  const rPr = baseRPr
    ? (baseRPr.cloneNode(true) as Element)
    : doc.createElement("w:rPr");
  removeDirectChildrenByLocalName(rPr, "highlight");
  const highlightEl = doc.createElement("w:highlight");
  highlightEl.setAttribute("w:val", normalizeWordHighlightColor(color));
  insertElementInRPrOrder(rPr, highlightEl, "highlight");
  return rPr;
}

export function buildStyledRunProperties(
  doc: Document,
  baseRPr: Element | null,
  style: { bold?: boolean; highlightColor?: string }
): Element | null {
  if (!style.bold && !style.highlightColor) {
    return baseRPr ? (baseRPr.cloneNode(true) as Element) : null;
  }

  let rPr = baseRPr
    ? (baseRPr.cloneNode(true) as Element)
    : doc.createElement("w:rPr");

  if (style.bold) {
    removeDirectChildrenByLocalName(rPr, "b");
    removeDirectChildrenByLocalName(rPr, "bCs");
    insertElementInRPrOrder(rPr, doc.createElement("w:b"), "b");
    insertElementInRPrOrder(rPr, doc.createElement("w:bCs"), "bCs");
  }

  if (style.highlightColor) {
    rPr = insertHighlightInRPr(doc, rPr, style.highlightColor);
  }

  return rPr;
}

export function hasRichTextDirectives(
  text: string,
  highlightPlaceholders: boolean = true
): boolean {
  if (!text) return false;
  if (/\*\*[^*]+\*\*/.test(text)) return true;
  if (/==[\s\S]+?==/.test(text)) return true;
  if (highlightPlaceholders && PLACEHOLDER_PATTERN.test(text)) return true;
  return false;
}

function pushToken(out: RichTextToken[], token: RichTextToken): void {
  if (!token.text) return;
  const last = out[out.length - 1];
  if (
    last &&
    last.bold === token.bold &&
    last.highlightColor === token.highlightColor
  ) {
    last.text += token.text;
    return;
  }
  out.push(token);
}

function parseRichTextRecursive(
  input: string,
  bold: boolean,
  highlightColor: string | undefined,
  highlightPlaceholders: boolean,
  out: RichTextToken[]
): void {
  let i = 0;

  while (i < input.length) {
    const rest = input.slice(i);

    const boldIdx = rest.indexOf("**");
    const hlIdx = rest.indexOf("==");
    const phMatch = highlightPlaceholders ? PLACEHOLDER_PATTERN.exec(rest) : null;
    const phIdx = phMatch ? phMatch.index : -1;

    let bestType: "bold" | "highlight" | "placeholder" | null = null;
    let bestIdx = Number.POSITIVE_INFINITY;

    if (boldIdx !== -1 && boldIdx < bestIdx) {
      const closeIdx = rest.indexOf("**", boldIdx + 2);
      if (closeIdx > boldIdx + 2) {
        bestType = "bold";
        bestIdx = boldIdx;
      }
    }

    if (hlIdx !== -1 && hlIdx < bestIdx) {
      const closeIdx = rest.indexOf("==", hlIdx + 2);
      if (closeIdx > hlIdx + 2) {
        bestType = "highlight";
        bestIdx = hlIdx;
      }
    }

    if (phIdx !== -1 && phIdx < bestIdx) {
      bestType = "placeholder";
      bestIdx = phIdx;
    }

    if (!bestType) {
      pushToken(out, { text: rest, bold, highlightColor });
      break;
    }

    if (bestIdx > 0) {
      pushToken(out, {
        text: rest.slice(0, bestIdx),
        bold,
        highlightColor,
      });
    }

    if (bestType === "bold") {
      const closeIdx = rest.indexOf("**", bestIdx + 2);
      const inner = rest.slice(bestIdx + 2, closeIdx);
      parseRichTextRecursive(inner, true, highlightColor, highlightPlaceholders, out);
      i += closeIdx + 2;
    } else if (bestType === "highlight") {
      const closeIdx = rest.indexOf("==", bestIdx + 2);
      const rawInner = rest.slice(bestIdx + 2, closeIdx);
      let nextColor = highlightColor ?? "yellow";
      let inner = rawInner;

      const colorMatch = rawInner.match(/^\[([^\]]+)\]([\s\S]*)$/);
      if (
        colorMatch &&
        !/^(?:A\s*DEFINIR|INSERIR)\b/i.test(colorMatch[1].trim()) &&
        colorMatch[2].length > 0
      ) {
        nextColor = normalizeWordHighlightColor(colorMatch[1]);
        inner = colorMatch[2];
      }

      parseRichTextRecursive(inner, bold, nextColor, highlightPlaceholders, out);
      i += closeIdx + 2;
    } else if (phMatch) {
      const rawPh = phMatch[0];
      const cleanPh = rawPh.replace(/^`|`$/g, "");
      pushToken(out, {
        text: cleanPh,
        bold,
        highlightColor: highlightColor ?? "yellow",
      });
      i += bestIdx + rawPh.length;
    }
  }
}

export function tokenizeRichTextSegments(
  text: string,
  options?: RichTextOptions
): RichTextToken[] {
  if (!text) return [];
  const highlightPlaceholders = options?.highlightPlaceholders !== false;
  const tokens: RichTextToken[] = [];
  parseRichTextRecursive(text, false, undefined, highlightPlaceholders, tokens);
  return tokens;
}

export function stripRichTextMarkup(
  text: string,
  options?: RichTextOptions
): string {
  if (!text) return "";
  return tokenizeRichTextSegments(text, options)
    .map((t) => t.text)
    .join("");
}

export function appendStyledRichTextRuns(
  xmlDoc: Document,
  targetP: Element,
  text: string,
  normalRPr: Element | null,
  options?: RichTextOptions
): void {
  const tokens = tokenizeRichTextSegments(text, options);
  for (const tok of tokens) {
    const r = xmlDoc.createElement("w:r");
    const rPrToUse = buildStyledRunProperties(xmlDoc, normalRPr, {
      bold: tok.bold,
      highlightColor: tok.highlightColor,
    });
    if (rPrToUse) {
      r.appendChild(rPrToUse);
    }

    const t = xmlDoc.createElement("w:t");
    t.setAttribute("xml:space", "preserve");
    t.textContent = tok.text;
    r.appendChild(t);
    targetP.appendChild(r);
  }
}
