import { getDirectChildElements } from "../../utils/xml.ts";
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

export function splitMarkerFromLine(
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

export function buildNativeNumberingParagraphProperties(
  xmlDoc: Document,
  basePPr: Element | null,
  ilvl: number,
  numId: string
): Element {
  const pPr = basePPr
    ? (basePPr.cloneNode(true) as Element)
    : xmlDoc.createElement("w:pPr");

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

export function buildHangingIndentParagraphProperties(
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

  if (listInfo.hasExplicitMarker) {
    const numPrList = getDirectChildElements(pPr, "w:numPr");
    for (const numPr of numPrList) {
      pPr.removeChild(numPr);
    }
  }

  for (const oldPStyle of getDirectChildElements(pPr, "w:pStyle")) {
    const val =
      oldPStyle.getAttribute("w:val") ||
      oldPStyle.getAttribute("val") ||
      "";
    if (/^(?:Heading|Titulo|Título|T[ií]tulo|Header|Se[çc][ãa]o)/i.test(val)) {
      pPr.removeChild(oldPStyle);
    }
  }

  const effectiveLevel = Math.max(1, listInfo.level);
  const leftTwips = effectiveLevel * 360;
  const hangingTwips = Math.min(360 + (effectiveLevel - 1) * 120, leftTwips);

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

export function applyParagraphAfterSpacing(
  xmlDoc: Document,
  p: Element,
  afterTwips = 120
): void {
  let pPr = getDirectChildElements(p, "w:pPr")[0];
  if (!pPr) {
    pPr = xmlDoc.createElement("w:pPr");
    if (p.firstChild) {
      p.insertBefore(pPr, p.firstChild);
    } else {
      p.appendChild(pPr);
    }
  }
  const spacingList = getDirectChildElements(pPr, "w:spacing");
  let spacingEl = spacingList[0];
  if (!spacingEl) {
    spacingEl = xmlDoc.createElement("w:spacing");
    pPr.appendChild(spacingEl);
  }
  spacingEl.setAttribute("w:after", String(afterTwips));
}

export function extractSectionHeadingPrefix(
  text: string,
  numPrefix?: string | null,
  hasHeadingStyle?: boolean
): string | null {
  if (numPrefix) {
    const numClean = numPrefix.trim();
    const match = numClean.match(/^(\d+(?:\.\d+)*)/);
    if (match) {
      const candidateTitle = text.trim();
      const isTitleLike =
        hasHeadingStyle ||
        (candidateTitle.length >= 3 &&
          candidateTitle.length <= 150 &&
          (candidateTitle === candidateTitle.toUpperCase() ||
            /^(?:JUSTIFICATIVA|MOTIVA[ÇC][ÃA]O|OBJETO|ESPECIFICA|CRIT[EÉ]RIO|MODELO|GEST[AÃ]O|OBRIGA|RECEBIMENTO|PAGAMENTO|SAN[CÇ]|DISPOSI|GLOSS|ESTIMATIVA|VALOR|EQUIPE|VISTORIA|AMOSTRA|MATRIZ|SLA|N[IÍ]VEL|VIG[EÊ]NCIA|FISCALIZA|INFRAESTRUTURA|REQUISITO)/i.test(
              candidateTitle
            )));
      if (isTitleLike) {
        return match[1];
      }
    }
  }

  const trimmed = text.trim();
  const literalMatch = trimmed.match(
    /^(\d+(?:\.\d+)*)(?:[\.\-\)\s]+)\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s\-_/–—,.:;()'"ºª§]{2,})/
  );
  if (literalMatch) {
    const candidatePrefix = literalMatch[1];
    const candidateTitle = literalMatch[2].trim();
    if (
      hasHeadingStyle ||
      candidateTitle === candidateTitle.toUpperCase() ||
      /^(?:JUSTIFICATIVA|MOTIVA[ÇC][ÃA]O|OBJETO|ESPECIFICA|CRIT[EÉ]RIO|MODELO|GEST[AÃ]O|OBRIGA|RECEBIMENTO|PAGAMENTO|SAN[CÇ]|DISPOSI|GLOSS|ESTIMATIVA|VALOR|EQUIPE|VISTORIA|AMOSTRA|MATRIZ|SLA|N[IÍ]VEL|VIG[EÊ]NCIA|FISCALIZA|INFRAESTRUTURA|REQUISITO)/i.test(
        candidateTitle
      )
    ) {
      return candidatePrefix;
    }
  }

  return null;
}

export interface ReanchoredNumberingResult {
  isConvertedToBullet: boolean;
  newMarkerText: string;
  newRemainder: string;
  newLevel: number;
  segments: number[];
}

export function reanchorMultilevelItem(
  lineListInfo: HierarchicalListItemInfo,
  activeSectionPrefix: string | null,
  existingSectionPrefixes: Set<string>,
  sectionChildCounters?: Map<string, number>
): ReanchoredNumberingResult {
  if (lineListInfo.kind !== "multi_decimal" || !activeSectionPrefix) {
    return {
      isConvertedToBullet: false,
      newMarkerText: lineListInfo.markerText,
      newRemainder: lineListInfo.cleanRemainder,
      newLevel: lineListInfo.level,
      segments: lineListInfo.segments,
    };
  }

  const rawSegments = [...lineListInfo.segments];
  const activeSegments = activeSectionPrefix
    .split(".")
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n));

  if (activeSegments.length === 0) {
    return {
      isConvertedToBullet: false,
      newMarkerText: lineListInfo.markerText,
      newRemainder: lineListInfo.cleanRemainder,
      newLevel: lineListInfo.level,
      segments: lineListInfo.segments,
    };
  }

  const startsWithActive =
    rawSegments.length > activeSegments.length &&
    activeSegments.every((val, idx) => rawSegments[idx] === val);

  let targetSegments: number[];

  if (startsWithActive) {
    targetSegments = rawSegments;
  } else {
    if (rawSegments[0] === 1 && rawSegments.length >= 2) {
      if (rawSegments.length === 2) {
        targetSegments = [...activeSegments, rawSegments[1]];
      } else if (rawSegments.length === 3) {
        if (activeSegments.length >= 2 && rawSegments[1] === 1) {
          targetSegments = [...activeSegments, rawSegments[2]];
        } else {
          targetSegments = [...activeSegments, ...rawSegments.slice(1)];
        }
      } else {
        targetSegments = [...activeSegments, ...rawSegments.slice(1)];
      }
    } else {
      targetSegments = [...activeSegments, ...rawSegments.slice(1)];
    }
  }

  if (sectionChildCounters && targetSegments.length > 0) {
    const parentKey = targetSegments.slice(0, -1).join(".");
    const currentVal = targetSegments[targetSegments.length - 1];
    const lastCounter = sectionChildCounters.get(parentKey);

    if (lastCounter !== undefined) {
      if (currentVal <= lastCounter) {
        const nextVal = lastCounter + 1;
        sectionChildCounters.set(parentKey, nextVal);
        targetSegments[targetSegments.length - 1] = nextVal;
      } else {
        sectionChildCounters.set(parentKey, currentVal);
      }
    } else {
      sectionChildCounters.set(parentKey, currentVal);
    }
  }

  const candidatePrefixStr = targetSegments.join(".");
  if (existingSectionPrefixes.has(candidatePrefixStr)) {
    return {
      isConvertedToBullet: true,
      newMarkerText: "• ",
      newRemainder: lineListInfo.cleanRemainder,
      newLevel: 1,
      segments: [],
    };
  }

  let sep = ".";
  if (lineListInfo.markerText.endsWith(" -") || lineListInfo.markerText.endsWith(" –")) {
    sep = " -";
  } else if (lineListInfo.markerText.endsWith(":")) {
    sep = ":";
  }

  const newMarker = `${candidatePrefixStr}${sep}`;

  return {
    isConvertedToBullet: false,
    newMarkerText: newMarker,
    newRemainder: lineListInfo.cleanRemainder,
    newLevel: Math.max(1, targetSegments.length - activeSegments.length),
    segments: targetSegments,
  };
}
