import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { ParagraphNumberingInfo, ReplaceInlineRule } from "../types/index.ts";
import { createSlotsManifestContractError } from "../contracts/errors.ts";

/**
 * Sanitiza strings XML removendo UTF-8 BOM (\uFEFF) e quaisquer espaços, quebras de linha
 * ou caracteres antes do primeiro elemento ou declaração XML ('<'), garantindo que
 * '<?xml' esteja estritamente na posição 0 para evitar fatalError do @xmldom/xmldom
 * ('processing instruction at position X is an xml declaration which is only at the start of the document').
 */
export function sanitizeXmlString(xml: string): string {
  if (!xml || typeof xml !== "string") return xml;
  // 1. Remove UTF-8 BOM (\uFEFF)
  let clean = xml.replace(/^\uFEFF/, "");
  // 2. Localiza o primeiro '<'
  const firstTagIdx = clean.indexOf("<");
  if (firstTagIdx > 0) {
    clean = clean.substring(firstTagIdx);
  }
  return clean;
}

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

export function isInsideTableCell(node: Node | null): boolean {
  let curr: Node | null = node ? node.parentNode : null;
  while (curr) {
    if (isElementMatch(curr, "w:tc")) {
      return true;
    }
    curr = curr.parentNode;
  }
  return false;
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
      } else if (isElementMatch(child, "w:tab")) {
        const prev = parts.length > 0 ? parts[parts.length - 1] : "";
        if (prev && !prev.endsWith(" ") && !prev.endsWith("\n")) {
          parts.push(" ");
        }
      } else if (child.nodeType === 3 && insideWT) {
        const val = child.nodeValue ?? "";
        if (
          val.startsWith(" ") &&
          parts.length > 0 &&
          parts[parts.length - 1] === " "
        ) {
          parts.push(val.slice(1));
        } else {
          parts.push(val);
        }
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

export function extractCellGridSpan(tc: Element): number {
  const tcPr = getDirectChildElements(tc, "w:tcPr")[0];
  if (!tcPr) return 1;
  const gridSpanEl = getDirectChildElements(tcPr, "w:gridSpan")[0];
  if (!gridSpanEl) return 1;
  const val = gridSpanEl.getAttribute("w:val") || gridSpanEl.getAttribute("val");
  const span = val ? parseInt(val, 10) : 1;
  return isNaN(span) || span < 1 ? 1 : span;
}

export function extractCellVMerge(tc: Element): "restart" | "continue" | null {
  const tcPr = getDirectChildElements(tc, "w:tcPr")[0];
  if (!tcPr) return null;
  const vMergeEl = getDirectChildElements(tcPr, "w:vMerge")[0];
  if (!vMergeEl) return null;
  const val = vMergeEl.getAttribute("w:val") || vMergeEl.getAttribute("val");
  if (!val || val === "continue") return "continue";
  if (val === "restart") return "restart";
  return "continue";
}

/**
 * Resolve o elemento <w:tc> físico correspondente a um índice de célula solicitado.
 * Se o índice estiver dentro da contagem de células físicas, retorna cells[requestedIndex].
 * Caso o índice exceda o número de <w:tc> físicos (deslocamento virtual por <w:gridSpan>),
 * calcula o span acumulado de cada célula física e mapeia para a célula correspondente.
 */
export function resolvePhysicalTableCell(
  cells: Element[],
  requestedIndex: number
): Element | undefined {
  if (!cells || cells.length === 0 || requestedIndex < 0) return undefined;
  if (requestedIndex < cells.length) {
    return cells[requestedIndex];
  }

  let currentVirtual = 0;
  for (let i = 0; i < cells.length; i++) {
    const tc = cells[i];
    const span = extractCellGridSpan(tc);
    if (requestedIndex >= currentVirtual && requestedIndex < currentVirtual + span) {
      return tc;
    }
    currentVirtual += span;
  }

  return undefined;
}

export function sanitizeTemplateTagExpression(tag: string): string {
  if (!tag) return "";
  let current = tag;
  let prev = "";
  // Converte acessos numéricos por ponto (.N) após identificadores ou ']' em [N]
  // Ex: itens.0.qtd -> itens[0].qtd, grupos.1.itens.2.nome -> grupos[1].itens[2].nome
  while (current !== prev) {
    prev = current;
    current = current.replace(
      /([a-zA-Z_$][\w$]*|\])\.(\d+)(?=\.|\[|\s|\}|$)/g,
      "$1[$2]"
    );
  }
  return current;
}

export function suggestSnakeCaseTag(expr: string): string {
  if (!expr) return "";
  // 1. Substituir hifens em identificadores por underscore (kebab-case -> snake_case)
  let fixed = expr.replace(/([a-zA-Z_$][\w$]*)-([a-zA-Z0-9_$-]+)/g, (match) =>
    match.replace(/-/g, "_")
  );
  // 2. Corrigir identificadores iniciando com dígito (ex.: 1_item -> item_1, 1item -> item_1)
  fixed = fixed.replace(
    /(^|[\s.{\[])(\d+)_?([a-zA-Z_$][\w$]*)/g,
    (match, prefix, num, rest) => {
      if (prefix === "[" || /^\d+$/.test(match.trim())) return match;
      return `${prefix}${rest}_${num}`;
    }
  );
  return fixed.includes("{{") ? fixed : `{{${fixed}}}`;
}

export function validateTemplateTagSyntax(
  tag: string,
  contextLabel: string = "tag"
): void {
  if (!tag) return;
  const trimmed = tag.trim();

  // 1. Verificar balanceamento de chaves {{ e }}
  const openCount = (trimmed.match(/\{\{/g) || []).length;
  const closeCount = (trimmed.match(/\}\}/g) || []).length;
  if (
    (trimmed.includes("{{") || trimmed.includes("}}")) &&
    openCount !== closeCount
  ) {
    throw new Error(
      createSlotsManifestContractError(
        `Chaves desbalanceadas na tag "${trimmed}" em '${contextLabel}'. Toda tag deve abrir com '{{' e fechar com '}}'.`
      )
    );
  }

  // 2. Extrair blocos {{...}} ou avaliar a expressão inteira se não houver delimitadores
  const tagBlocks: string[] = [];
  const matches = [...trimmed.matchAll(/\{\{([\s\S]*?)\}\}/g)];
  if (matches.length > 0) {
    for (const m of matches) {
      tagBlocks.push(m[1].trim());
    }
  } else if (!trimmed.includes("{{") && !trimmed.includes("}}")) {
    tagBlocks.push(trimmed);
  }

  const validateTokens = (expr: string) => {
    // Quebra a expressão por delimitadores de caminho (., [, ], parênteses e operadores)
    const tokens = expr
      .split(/[\s.\[\]()+\/*=!,&|?:<>]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    for (const token of tokens) {
      // Ignora literais numéricos puros (ex.: 0, 10), literais string ou comandos permitidos
      if (/^\d+$/.test(token)) continue;
      if (/^["'].*["']$/.test(token)) continue;
      if (/^(?:FOR|IN|END-FOR|IF|END-IF|INS|null|true|false|undefined)$/i.test(token)) {
        continue;
      }

      // 1. Identificadores com hífen (kebab-case) são proibidos fora de comandos
      if (token.includes("-")) {
        const suggestion = suggestSnakeCaseTag(trimmed);
        throw new Error(
          createSlotsManifestContractError(
            `Identificador com hífen inválido "${token}" na tag "${trimmed}" em '${contextLabel}'. O docx-templates requer identificadores JavaScript válidos (use snake_case em vez de kebab-case). Sugestão de correção: "${suggestion}".`
          )
        );
      }

      // 2. Identificadores que começam com dígito (ex.: 1_item)
      if (/^\d+[a-zA-Z_$]/.test(token)) {
        const suggestion = suggestSnakeCaseTag(trimmed);
        throw new Error(
          createSlotsManifestContractError(
            `Identificador iniciando por dígito "${token}" na tag "${trimmed}" em '${contextLabel}'. Identificadores JavaScript não podem começar com números. Sugestão de correção: "${suggestion}".`
          )
        );
      }

      // 3. Formato geral de identificador JS ($ e _ permitidos)
      if (!/^\$?[a-zA-Z_$][\w$]*$/.test(token)) {
        const suggestion = suggestSnakeCaseTag(trimmed);
        throw new Error(
          createSlotsManifestContractError(
            `Identificador inválido "${token}" na tag "${trimmed}" em '${contextLabel}'. Use nomes compatíveis com JavaScript. Sugestão de correção: "${suggestion}".`
          )
        );
      }
    }
  };

  for (const block of tagBlocks) {
    if (!block) {
      throw new Error(
        createSlotsManifestContractError(
          `Tag vazia "{{}}" detectada em '${contextLabel}'. Forneça uma expressão válida.`
        )
      );
    }

    // Comandos especiais
    if (/^END-IF$/i.test(block)) continue;
    if (/^IF\s+/i.test(block)) {
      validateTokens(block.replace(/^IF\s+/i, "").trim());
      continue;
    }
    if (/^FOR\s+/i.test(block)) {
      const forMatch = block.match(
        /^FOR\s+(\$?[a-zA-Z0-9_$-]+)\s+IN\s+([\s\S]+)$/i
      );
      if (!forMatch) {
        throw new Error(
          createSlotsManifestContractError(
            `Sintaxe de comando FOR inválida: "{{${block}}}" em '${contextLabel}'. Formato canônico: "{{FOR item IN lista_itens}}".`
          )
        );
      }
      validateTokens(forMatch[1]);
      validateTokens(forMatch[2].trim());
      continue;
    }
    if (/^END-FOR/i.test(block)) {
      const endForMatch = block.match(
        /^END-FOR(?:\s+(\$?[a-zA-Z0-9_$-]+))?$/i
      );
      if (!endForMatch) {
        throw new Error(
          createSlotsManifestContractError(
            `Sintaxe de comando END-FOR inválida: "{{${block}}}" em '${contextLabel}'. Formato canônico: "{{END-FOR item}}".`
          )
        );
      }
      if (endForMatch[1]) {
        validateTokens(endForMatch[1]);
      }
      continue;
    }

    // Expressão regular de variável
    let expr = block;
    if (/^(?:INS|=)\s+/i.test(expr)) {
      expr = expr.replace(/^(?:INS|=)\s+/i, "").trim();
    }
    validateTokens(expr);
  }
}

export function normalizeTag(tag: string): string {
  if (!tag) return "";
  const sanitized = sanitizeTemplateTagExpression(tag.trim());
  return sanitized.includes("{{") ? sanitized : `{{${sanitized}}}`;
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

// ============================================================================
// Motor de Lista Multinível Nativa (word/numbering.xml + NumberingResolver v0.7.0)
// ============================================================================

const NUMBERING_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml";
const NUMBERING_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering";
const WORD_MAIN_NS =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export class NumberingManager {
  private xmlDoc: Document;
  private root: Element;
  private nextAbstractNumId: number = 100;
  private nextNumId: number = 100;
  private modified: boolean = false;

  constructor(existingXmlStr?: string | null) {
    const parser = new DOMParser();
    const cleanExisting = sanitizeXmlString(existingXmlStr || "");
    if (cleanExisting && cleanExisting.trim()) {
      this.xmlDoc = parser.parseFromString(cleanExisting, "application/xml");
      const existingRoot =
        getAllElements(this.xmlDoc, "w:numbering")[0] ??
        this.xmlDoc.documentElement;
      if (existingRoot) {
        this.root = existingRoot;
      } else {
        this.xmlDoc = parser.parseFromString(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:numbering xmlns:w="${WORD_MAIN_NS}"/>`,
          "application/xml"
        );
        this.root = this.xmlDoc.documentElement!;
      }
    } else {
      this.xmlDoc = parser.parseFromString(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:numbering xmlns:w="${WORD_MAIN_NS}"/>`,
        "application/xml"
      );
      this.root = this.xmlDoc.documentElement!;
    }

    // Descobre os maiores IDs já existentes para preservar 100% das listas originais
    const abstractNums = getDirectChildElements(this.root, "w:abstractNum");
    for (const an of abstractNums) {
      const idVal = parseInt(
        an.getAttribute("w:abstractNumId") ||
          an.getAttribute("abstractNumId") ||
          "0",
        10
      );
      if (!isNaN(idVal) && idVal >= this.nextAbstractNumId) {
        this.nextAbstractNumId = idVal + 1;
      }
    }

    const nums = getDirectChildElements(this.root, "w:num");
    for (const n of nums) {
      const idVal = parseInt(
        n.getAttribute("w:numId") || n.getAttribute("numId") || "0",
        10
      );
      if (!isNaN(idVal) && idVal >= this.nextNumId) {
        this.nextNumId = idVal + 1;
      }
    }
  }

  public isModified(): boolean {
    return this.modified;
  }

  /**
   * Cria um <w:abstractNum> de 9 níveis (%1. até %1..%9.) e um <w:num> com <w:startOverride>
   * sincronizado com o capítulo pai (e subníveis iniciais opcionais).
   */
  public createMultilevelDecimalNum(
    chapterStart: number,
    initialSegments?: number[]
  ): string {
    const safeChapter =
      Number.isFinite(chapterStart) && chapterStart >= 1
        ? Math.floor(chapterStart)
        : 1;
    const abstractNumId = String(this.nextAbstractNumId++);
    const numId = String(this.nextNumId++);

    const abstractNumEl = this.xmlDoc.createElement("w:abstractNum");
    abstractNumEl.setAttribute("w:abstractNumId", abstractNumId);

    const multiLevelType = this.xmlDoc.createElement("w:multiLevelType");
    multiLevelType.setAttribute("w:val", "multilevel");
    abstractNumEl.appendChild(multiLevelType);

    for (let ilvl = 0; ilvl <= 8; ilvl++) {
      const lvlEl = this.xmlDoc.createElement("w:lvl");
      lvlEl.setAttribute("w:ilvl", String(ilvl));

      const startEl = this.xmlDoc.createElement("w:start");
      const levelStart =
        ilvl === 0
          ? safeChapter
          : initialSegments &&
              initialSegments.length > ilvl &&
              initialSegments[ilvl] >= 1
            ? initialSegments[ilvl]
            : 1;
      startEl.setAttribute("w:val", String(levelStart));
      lvlEl.appendChild(startEl);

      const numFmtEl = this.xmlDoc.createElement("w:numFmt");
      numFmtEl.setAttribute("w:val", "decimal");
      lvlEl.appendChild(numFmtEl);

      const suffEl = this.xmlDoc.createElement("w:suff");
      suffEl.setAttribute("w:val", "tab");
      lvlEl.appendChild(suffEl);

      const placeholders: string[] = [];
      for (let k = 1; k <= ilvl + 1; k++) {
        placeholders.push(`%${k}`);
      }
      const lvlTextEl = this.xmlDoc.createElement("w:lvlText");
      lvlTextEl.setAttribute("w:val", `${placeholders.join(".")}.`);
      lvlEl.appendChild(lvlTextEl);

      const lvlJcEl = this.xmlDoc.createElement("w:lvlJc");
      lvlJcEl.setAttribute("w:val", "left");
      lvlEl.appendChild(lvlJcEl);

      // Recuos escalonados em twips para os 9 níveis
      const leftTwips = (ilvl + 1) * 360;
      const hangingTwips = Math.min(360 + ilvl * 120, leftTwips);

      const pPrEl = this.xmlDoc.createElement("w:pPr");
      const tabsEl = this.xmlDoc.createElement("w:tabs");
      const tabEl = this.xmlDoc.createElement("w:tab");
      tabEl.setAttribute("w:val", "num");
      tabEl.setAttribute("w:pos", String(leftTwips));
      tabsEl.appendChild(tabEl);
      pPrEl.appendChild(tabsEl);

      const indEl = this.xmlDoc.createElement("w:ind");
      indEl.setAttribute("w:left", String(leftTwips));
      indEl.setAttribute("w:hanging", String(hangingTwips));
      pPrEl.appendChild(indEl);

      lvlEl.appendChild(pPrEl);
      abstractNumEl.appendChild(lvlEl);
    }

    // Insere <w:abstractNum> antes do primeiro <w:num> para respeitar a ordem do schema OOXML
    const firstNum = getDirectChildElements(this.root, "w:num")[0] ?? null;
    if (firstNum) {
      this.root.insertBefore(abstractNumEl, firstNum);
    } else {
      this.root.appendChild(abstractNumEl);
    }

    // Cria <w:num> referenciando o abstractNumId com <w:lvlOverride w:ilvl="0"><w:startOverride>
    const numEl = this.xmlDoc.createElement("w:num");
    numEl.setAttribute("w:numId", numId);

    const absRefEl = this.xmlDoc.createElement("w:abstractNumId");
    absRefEl.setAttribute("w:val", abstractNumId);
    numEl.appendChild(absRefEl);

    const maxOverrideLevel =
      initialSegments && initialSegments.length > 1
        ? Math.min(8, initialSegments.length - 1)
        : 0;

    for (let lvl = 0; lvl <= maxOverrideLevel; lvl++) {
      const overrideVal =
        lvl === 0
          ? safeChapter
          : initialSegments && initialSegments[lvl] >= 1
            ? initialSegments[lvl]
            : 1;
      if (lvl === 0 || overrideVal > 1) {
        const lvlOverrideEl = this.xmlDoc.createElement("w:lvlOverride");
        lvlOverrideEl.setAttribute("w:ilvl", String(lvl));
        const startOverrideEl = this.xmlDoc.createElement("w:startOverride");
        startOverrideEl.setAttribute("w:val", String(overrideVal));
        lvlOverrideEl.appendChild(startOverrideEl);
        numEl.appendChild(lvlOverrideEl);
      }
    }

    this.root.appendChild(numEl);
    this.modified = true;
    return numId;
  }

  public serialize(): string {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(this.xmlDoc);
  }
}

export async function ensureNumberingPart(
  zip: JSZip,
  manager: NumberingManager
): Promise<void> {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  // 1. Grava word/numbering.xml
  zip.file("word/numbering.xml", manager.serialize());

  // 2. Garante Override em [Content_Types].xml
  await ensureContentTypesOverride(zip);
  const ctFile = zip.file("[Content_Types].xml");
  if (ctFile) {
    const ctXmlStr = sanitizeXmlString(await ctFile.async("string"));
    const ctDoc = parser.parseFromString(ctXmlStr, "application/xml");
    const typesRoot =
      getAllElements(ctDoc, "Types")[0] ?? ctDoc.documentElement;
    if (typesRoot) {
      const overrides = getDirectChildElements(typesRoot, "Override");
      let hasNumberingOverride = false;
      for (const ov of overrides) {
        if (ov.getAttribute("PartName") === "/word/numbering.xml") {
          ov.setAttribute("ContentType", NUMBERING_CONTENT_TYPE);
          hasNumberingOverride = true;
          break;
        }
      }
      if (!hasNumberingOverride) {
        const ov = ctDoc.createElement("Override");
        ov.setAttribute("PartName", "/word/numbering.xml");
        ov.setAttribute("ContentType", NUMBERING_CONTENT_TYPE);
        typesRoot.appendChild(ov);
      }
      zip.file("[Content_Types].xml", serializer.serializeToString(ctDoc));
    }
  }

  // 3. Garante Relationship em word/_rels/document.xml.rels
  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  if (!relsFile) {
    const defaultRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdNumbering1" Type="${NUMBERING_REL_TYPE}" Target="numbering.xml"/>
</Relationships>`;
    zip.file(relsPath, defaultRelsXml);
    return;
  }

  const relsXmlStr = sanitizeXmlString(await relsFile.async("string"));
  const relsDoc = parser.parseFromString(relsXmlStr, "application/xml");
  const relsRoot =
    getAllElements(relsDoc, "Relationships")[0] ?? relsDoc.documentElement;
  if (!relsRoot) return;

  const relationships = getDirectChildElements(relsRoot, "Relationship");
  const usedIds = new Set<string>();
  let hasNumberingRel = false;

  for (const rel of relationships) {
    const id = rel.getAttribute("Id");
    if (id) usedIds.add(id);
    const type = rel.getAttribute("Type") || "";
    const target = rel.getAttribute("Target") || "";
    if (
      type === NUMBERING_REL_TYPE ||
      target === "numbering.xml" ||
      target === "/word/numbering.xml"
    ) {
      hasNumberingRel = true;
    }
  }

  if (!hasNumberingRel) {
    let idx = 1;
    while (usedIds.has(`rIdNumbering${idx}`)) {
      idx++;
    }
    const relEl = relsDoc.createElement("Relationship");
    relEl.setAttribute("Id", `rIdNumbering${idx}`);
    relEl.setAttribute("Type", NUMBERING_REL_TYPE);
    relEl.setAttribute("Target", "numbering.xml");
    relsRoot.appendChild(relEl);
    zip.file(relsPath, serializer.serializeToString(relsDoc));
  }
}

export interface NumberingResolver {
  formatParagraphPrefix(numId: string, ilvl: number): string | null;
}

export function createNumberingResolver(
  numberingXmlStr?: string | null
): NumberingResolver {
  interface LevelDef {
    start: number;
    numFmt: string;
    lvlText: string;
  }
  interface AbstractNumDef {
    levels: Map<number, LevelDef>;
  }
  interface NumDef {
    abstractNumId: string;
    startOverrides: Map<number, number>;
  }

  const abstractNums = new Map<string, AbstractNumDef>();
  const nums = new Map<string, NumDef>();
  const activeCounters = new Map<string, Map<number, number>>();

  const cleanNumbering = sanitizeXmlString(numberingXmlStr || "");
  if (cleanNumbering && cleanNumbering.trim()) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanNumbering, "application/xml");
    const root =
      getAllElements(xmlDoc, "w:numbering")[0] ?? xmlDoc.documentElement;

    if (root) {
      for (const an of getDirectChildElements(root, "w:abstractNum")) {
        const absId =
          an.getAttribute("w:abstractNumId") ||
          an.getAttribute("abstractNumId");
        if (!absId) continue;

        const levels = new Map<number, LevelDef>();
        for (const lvl of getDirectChildElements(an, "w:lvl")) {
          const ilvlStr =
            lvl.getAttribute("w:ilvl") || lvl.getAttribute("ilvl");
          if (ilvlStr === null) continue;
          const ilvl = parseInt(ilvlStr, 10);
          if (isNaN(ilvl)) continue;

          const startEl = getDirectChildElements(lvl, "w:start")[0];
          const startVal = parseInt(
            startEl?.getAttribute("w:val") ||
              startEl?.getAttribute("val") ||
              "1",
            10
          );

          const numFmtEl = getDirectChildElements(lvl, "w:numFmt")[0];
          const numFmt =
            numFmtEl?.getAttribute("w:val") ||
            numFmtEl?.getAttribute("val") ||
            "decimal";

          const lvlTextEl = getDirectChildElements(lvl, "w:lvlText")[0];
          const lvlText =
            lvlTextEl?.getAttribute("w:val") ||
            lvlTextEl?.getAttribute("val") ||
            `%${ilvl + 1}.`;

          levels.set(ilvl, {
            start: isNaN(startVal) ? 1 : startVal,
            numFmt,
            lvlText,
          });
        }
        abstractNums.set(absId, { levels });
      }

      for (const n of getDirectChildElements(root, "w:num")) {
        const numId = n.getAttribute("w:numId") || n.getAttribute("numId");
        if (!numId) continue;
        const absRefEl = getDirectChildElements(n, "w:abstractNumId")[0];
        const absId =
          absRefEl?.getAttribute("w:val") || absRefEl?.getAttribute("val");
        if (!absId) continue;

        const startOverrides = new Map<number, number>();
        for (const ov of getDirectChildElements(n, "w:lvlOverride")) {
          const ilvlStr = ov.getAttribute("w:ilvl") || ov.getAttribute("ilvl");
          if (ilvlStr === null) continue;
          const ilvl = parseInt(ilvlStr, 10);
          const startOvEl = getDirectChildElements(ov, "w:startOverride")[0];
          const startOvVal = parseInt(
            startOvEl?.getAttribute("w:val") ||
              startOvEl?.getAttribute("val") ||
              "",
            10
          );
          if (!isNaN(ilvl) && !isNaN(startOvVal)) {
            startOverrides.set(ilvl, startOvVal);
          }
        }

        nums.set(numId, { abstractNumId: absId, startOverrides });
      }
    }
  }

  function getInitialStart(numDef: NumDef, absDef: AbstractNumDef, lvl: number): number {
    if (numDef.startOverrides.has(lvl)) {
      return numDef.startOverrides.get(lvl)!;
    }
    const lvlDef = absDef.levels.get(lvl);
    return lvlDef ? lvlDef.start : 1;
  }

  return {
    formatParagraphPrefix(numId: string, ilvl: number): string | null {
      const numDef = nums.get(numId);
      if (!numDef) return null;
      const absDef = abstractNums.get(numDef.abstractNumId);
      if (!absDef) return null;

      let counters = activeCounters.get(numId);
      if (!counters) {
        counters = new Map<number, number>();
        activeCounters.set(numId, counters);
      }

      // Garante que todos os níveis ancestrais (< ilvl) já estejam inicializados
      // (ex.: quando o bloco começa diretamente em ilvl=1 para "4.1.")
      for (let k = 0; k < ilvl; k++) {
        if (!counters.has(k)) {
          counters.set(k, getInitialStart(numDef, absDef, k));
        }
      }

      // Atualiza o nível atual
      if (!counters.has(ilvl)) {
        counters.set(ilvl, getInitialStart(numDef, absDef, ilvl));
      } else {
        counters.set(ilvl, counters.get(ilvl)! + 1);
      }

      // Reseta níveis mais profundos (> ilvl) para que reiniciem quando voltarem a aparecer
      for (const existingLvl of Array.from(counters.keys())) {
        if (existingLvl > ilvl) {
          counters.delete(existingLvl);
        }
      }

      const lvlDef = absDef.levels.get(ilvl);
      if (!lvlDef || lvlDef.numFmt === "bullet") {
        return null;
      }

      let formatted = lvlDef.lvlText;
      for (let k = 0; k <= ilvl; k++) {
        const val = counters.get(k) ?? getInitialStart(numDef, absDef, k);
        formatted = formatted.replace(new RegExp(`%${k + 1}`, "g"), String(val));
      }

      // Por compatibilidade com o texto limpo de inspect_docx (ex: "1.1 Título" ou "4.1.1 Título"),
      // removemos o ponto final do prefixo em listas multinível (ilvl >= 1) se o lvlText terminar com "."
      if (ilvl >= 1 && formatted.endsWith(".")) {
        formatted = formatted.slice(0, -1);
      }

      return formatted;
    },
  };
}


