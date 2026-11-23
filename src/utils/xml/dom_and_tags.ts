import type { ParagraphNumberingInfo } from "../../types/index.ts";
import { createSlotsManifestContractError } from "../../contracts/errors.ts";

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
