import {
  isInsideTableCell,
  extractParagraphNumbering,
  extractParagraphText,
  getDirectChildElements,
  getAllElements,
  findBodyRunProperties,
  stripBoldFromRPr,
  stripBoldFromPPr,
  addBoldToRPr,
  createNumberingResolver,
  NumberingManager,
} from "../../utils/xml.ts";
import {
  appendRichTextRunsToParagraph,
  segmentLinesWithMarkdownTables,
  buildOpenXmlTableFromMarkdown,
  ensureTableCellEndsWithParagraph,
  convertSiblingParagraphMarkdownTables,
  autoRedirectGeometricCheckboxCells,
} from "./markdown_table_converter.ts";
import {
  detectHierarchicalListItem,
  buildNativeNumberingParagraphProperties,
  buildHangingIndentParagraphProperties,
  applyParagraphAfterSpacing,
  extractSectionHeadingPrefix,
  reanchorMultilevelItem,
} from "./multilevel_reanchoring.ts";

import {
  hasRichTextDirectives,
  type RichTextOptions,
} from "./rich_text_highlight.ts";

export {
  type HierarchicalListItemInfo,
  splitMarkerFromLine,
  detectHierarchicalListItem,
  buildNativeNumberingParagraphProperties,
  buildHangingIndentParagraphProperties,
  applyParagraphAfterSpacing,
  extractSectionHeadingPrefix,
  type ReanchoredNumberingResult,
  reanchorMultilevelItem,
} from "./multilevel_reanchoring.ts";
export function postProcessRichTextAndLineBreaksInXmlDoc(
  xmlDoc: Document,
  numberingManager?: NumberingManager,
  existingNumberingXml?: string | null,
  options?: RichTextOptions
): boolean {
  const highlightPlaceholders = options?.highlightPlaceholders !== false;
  const richTextOpts: RichTextOptions = { highlightPlaceholders };
  let modified = false;
  const paragraphs = getAllElements(xmlDoc, "w:p");

  const existingSectionPrefixes = new Set<string>();
  const preScanResolver = createNumberingResolver(existingNumberingXml);

  for (const p of paragraphs) {
    const pPrList = getDirectChildElements(p, "w:pPr");
    const hasHeadingStyle =
      pPrList.length > 0 &&
      getDirectChildElements(pPrList[0], "w:pStyle").some((s) => {
        const val = s.getAttribute("w:val") || s.getAttribute("val") || "";
        return /^(?:Heading|Titulo|Título|T[ií]tulo|Header|Se[çc][ãa]o)/i.test(val);
      });
    const pNum = extractParagraphNumbering(p);
    const numPrefix =
      pNum && preScanResolver
        ? preScanResolver.formatParagraphPrefix(pNum.numId, pNum.level)
        : null;
    const pText = extractParagraphText(p);
    const headingPrefix = extractSectionHeadingPrefix(
      pText,
      numPrefix,
      hasHeadingStyle
    );
    if (headingPrefix) {
      existingSectionPrefixes.add(headingPrefix);
    }
  }

  let activeSectionPrefix: string | null = null;
  let activeBodyChapter: number | null = null;
  let activeBodyNumId: string | null = null;
  let activeSingleDecimalNumber: number | null = null;
  const usedSubLevel1InCurrentNum = new Set<number>();
  const numberingResolver = createNumberingResolver(existingNumberingXml);

  for (const p of paragraphs) {
    const parent = p.parentNode;
    if (!parent) continue;

    const pPrList = getDirectChildElements(p, "w:pPr");
    const hasHeadingStyle =
      pPrList.length > 0 &&
      getDirectChildElements(pPrList[0], "w:pStyle").some((s) => {
        const val = s.getAttribute("w:val") || s.getAttribute("val") || "";
        return /^(?:Heading|Titulo|Título|T[ií]tulo|Header|Se[çc][ãa]o)/i.test(val);
      });

    const fullText = extractParagraphText(p);

    const pNum = extractParagraphNumbering(p);
    const numPrefix =
      pNum && numberingResolver
        ? numberingResolver.formatParagraphPrefix(pNum.numId, pNum.level)
        : null;
    const headingPrefix = extractSectionHeadingPrefix(
      fullText,
      numPrefix,
      hasHeadingStyle
    );
    if (headingPrefix) {
      activeSectionPrefix = headingPrefix;
      activeBodyNumId = null;
      activeBodyChapter = null;
      activeSingleDecimalNumber = null;
    }

    const hasBrElements =
      getAllElements(p, "w:br").length > 0 ||
      getAllElements(p, "w:cr").length > 0;
    const hasLineBreaks = hasBrElements || /\r?\n/.test(fullText);
    const hasMarkdownBold = /\*\*[^*]+\*\*/.test(fullText);
    const hasRichText = hasRichTextDirectives(fullText, highlightPlaceholders);
    const singleLineListInfo = detectHierarchicalListItem(fullText);
    const hasListItem = !hasHeadingStyle && singleLineListInfo.isListItem;
    const hasNumberingConflict =
      !hasHeadingStyle &&
      singleLineListInfo.hasExplicitMarker &&
      extractParagraphNumbering(p) !== undefined;

    if (
      !hasLineBreaks &&
      !hasRichText &&
      !hasListItem &&
      !hasNumberingConflict
    ) {
      continue;
    }

    const insideTable = isInsideTableCell(p);
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
    let insertedCount = 0;

    const templateNum = extractParagraphNumbering(p);
    const isRegisteredInNumberingXml =
      existingNumberingXml !== undefined &&
      existingNumberingXml !== null &&
      templateNum?.numId !== undefined &&
      existingNumberingXml.includes(`w:numId="${templateNum.numId}"`);

    const hasTemplateNumInheritance =
      !insideTable &&
      !hasHeadingStyle &&
      templateNum !== undefined &&
      templateNum.level >= 1 &&
      isRegisteredInNumberingXml;
    const templateNumId = templateNum?.numId;
    const templateIlvl = templateNum?.level ?? 0;

    const sectionChildCounters = new Map<string, number>();

    let minNumericLevel = 0;
    if (hasTemplateNumInheritance) {
      const numericLevels: number[] = [];
      for (const seg of segments) {
        if (seg.type === "table" || seg.line.trim() === "") continue;
        const info = detectHierarchicalListItem(seg.line);
        if (
          info.isListItem &&
          (info.kind === "single_decimal" || info.kind === "multi_decimal")
        ) {
          numericLevels.push(info.level);
        }
      }
      minNumericLevel = numericLevels.length > 0 ? Math.min(...numericLevels) : 0;
    }

    for (const seg of segments) {
      if (seg.type === "table") {
        const tblRPr = detectedRPr ? stripBoldFromRPr(detectedRPr) : null;
        const tblEl = buildOpenXmlTableFromMarkdown(
          xmlDoc,
          seg.lines,
          tblRPr,
          richTextOpts
        );
        parent.insertBefore(tblEl, p);
        insertedCount++;
        continue;
      }

      const line = seg.line;
      if (line.trim() === "") {
        continue;
      }

      const newP = xmlDoc.createElement("w:p");
      let lineListInfo = detectHierarchicalListItem(line);

      if (hasTemplateNumInheritance && templateNumId) {
        activeSingleDecimalNumber = null;
        if (
          lineListInfo.isListItem &&
          (lineListInfo.kind === "single_decimal" ||
            lineListInfo.kind === "multi_decimal")
        ) {
          const deltaLevel = Math.max(0, lineListInfo.level - minNumericLevel);
          const targetIlvl = Math.min(templateIlvl + deltaLevel, 8);
          const nativePPr = buildNativeNumberingParagraphProperties(
            xmlDoc,
            basePPr,
            targetIlvl,
            templateNumId
          );
          newP.appendChild(nativePPr);
          appendRichTextRunsToParagraph(
            xmlDoc,
            newP,
            lineListInfo.cleanRemainder,
            normalRPr,
            richTextOpts
          );
        } else if (
          lineListInfo.isListItem &&
          (lineListInfo.kind === "bullet" ||
            lineListInfo.kind === "alpha_lower" ||
            lineListInfo.kind === "alpha_upper")
        ) {
          const targetIlvl = Math.min(templateIlvl + 1, 8);
          const nativePPr = buildNativeNumberingParagraphProperties(
            xmlDoc,
            basePPr,
            targetIlvl,
            templateNumId
          );
          newP.appendChild(nativePPr);
          appendRichTextRunsToParagraph(
            xmlDoc,
            newP,
            lineListInfo.cleanRemainder,
            normalRPr,
            richTextOpts
          );
        } else {
          if (basePPr) {
            const cleanPPr = basePPr.cloneNode(true) as Element;
            for (const oldNumPr of getDirectChildElements(cleanPPr, "w:numPr")) {
              cleanPPr.removeChild(oldNumPr);
            }
            newP.appendChild(cleanPPr);
          }
          appendRichTextRunsToParagraph(xmlDoc, newP, line, normalRPr, richTextOpts);
        }
      } else {
        if (lineListInfo.isListItem && lineListInfo.kind === "multi_decimal") {
          const reanchorRes = reanchorMultilevelItem(
            lineListInfo,
            activeSectionPrefix,
            existingSectionPrefixes,
            sectionChildCounters
          );
          if (reanchorRes.isConvertedToBullet) {
            lineListInfo = {
              ...lineListInfo,
              isListItem: true,
              hasExplicitMarker: true,
              kind: "bullet",
              level: 1,
              markerText: "• ",
              markerBold: true,
              segments: [],
            };
          } else {
            lineListInfo = {
              ...lineListInfo,
              markerText: reanchorRes.newMarkerText,
              level: reanchorRes.newLevel,
              segments: reanchorRes.segments,
            };
          }
        }

        const isSingleDecimalListOutsideTable =
          !insideTable &&
          numberingManager !== undefined &&
          lineListInfo.isListItem &&
          lineListInfo.kind === "single_decimal";

        if (isSingleDecimalListOutsideTable && numberingManager) {
          const chapter = lineListInfo.chapterNumber ?? 1;
          const subLvl1 =
            lineListInfo.segments.length > 1 ? lineListInfo.segments[1] : null;

          const isSequentialSingleDecimal =
            lineListInfo.kind === "single_decimal" &&
            activeBodyNumId !== null &&
            activeSingleDecimalNumber !== null &&
            lineListInfo.segments[0] === activeSingleDecimalNumber + 1;

          const shouldAllocateNewNum =
            !isSequentialSingleDecimal &&
            (activeBodyNumId === null ||
              activeBodyChapter !== chapter ||
              (lineListInfo.level === 1 &&
                subLvl1 !== null &&
                usedSubLevel1InCurrentNum.has(subLvl1)));

          if (shouldAllocateNewNum) {
            activeBodyNumId = numberingManager.createMultilevelDecimalNum(
              chapter,
              lineListInfo.segments
            );
            activeBodyChapter = chapter;
            usedSubLevel1InCurrentNum.clear();
          }

          if (lineListInfo.kind === "single_decimal") {
            activeSingleDecimalNumber = lineListInfo.segments[0];
          } else {
            activeSingleDecimalNumber = null;
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

          appendRichTextRunsToParagraph(
            xmlDoc,
            newP,
            lineListInfo.cleanRemainder,
            normalRPr,
            richTextOpts
          );
        } else if (lineListInfo.isListItem) {
          activeSingleDecimalNumber = null;
          const hangingPPr = buildHangingIndentParagraphProperties(
            xmlDoc,
            basePPr,
            lineListInfo
          );
          if (hangingPPr) {
            newP.appendChild(hangingPPr);
          }

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

          const tabRun = xmlDoc.createElement("w:r");
          if (normalRPr) {
            tabRun.appendChild(normalRPr.cloneNode(true));
          }
          tabRun.appendChild(xmlDoc.createElement("w:tab"));
          newP.appendChild(tabRun);

          appendRichTextRunsToParagraph(
            xmlDoc,
            newP,
            lineListInfo.cleanRemainder,
            normalRPr,
            richTextOpts
          );
        } else {
          activeBodyNumId = null;
          activeBodyChapter = null;
          activeSingleDecimalNumber = null;

          if (basePPr) {
            const cleanPPr = basePPr.cloneNode(true) as Element;
            for (const oldNumPr of getDirectChildElements(cleanPPr, "w:numPr")) {
              cleanPPr.removeChild(oldNumPr);
            }
            for (const oldPStyle of getDirectChildElements(cleanPPr, "w:pStyle")) {
              const val =
                oldPStyle.getAttribute("w:val") ||
                oldPStyle.getAttribute("val") ||
                "";
              if (/^(?:Heading|Titulo|Título|T[ií]tulo|Header|Se[çc][ãa]o)/i.test(val)) {
                cleanPPr.removeChild(oldPStyle);
              }
            }
            newP.appendChild(cleanPPr);
          }
          appendRichTextRunsToParagraph(xmlDoc, newP, line, normalRPr, richTextOpts);
        }
      }

      applyParagraphAfterSpacing(xmlDoc, newP, 120);

      parent.insertBefore(newP, p);
      insertedCount++;
    }

    if (insertedCount === 0) {
      const fallbackP = xmlDoc.createElement("w:p");
      if (basePPr) {
        const cleanPPr = basePPr.cloneNode(true) as Element;
        for (const oldNumPr of getDirectChildElements(cleanPPr, "w:numPr")) {
          cleanPPr.removeChild(oldNumPr);
        }
        fallbackP.appendChild(cleanPPr);
      }
      parent.insertBefore(fallbackP, p);
    }

    parent.removeChild(p);
    ensureTableCellEndsWithParagraph(xmlDoc, parent);
    modified = true;
  }

  if (convertSiblingParagraphMarkdownTables(xmlDoc, richTextOpts)) {
    modified = true;
  }

  if (autoRedirectGeometricCheckboxCells(xmlDoc)) {
    modified = true;
  }

  return modified;
}
