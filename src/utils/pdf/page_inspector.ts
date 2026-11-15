import { inspectPages, type PageInspection } from "unpdf";
import type { PdfPageClass, PdfPageInspectionDetail } from "../../types/index.ts";

export interface PageInspectionOutput {
  details: PdfPageInspectionDetail[];
  scanned_pages_detected: number[];
  hybrid_scan_pages: number[];
}

export function classifyPdfPage(params: {
  visibleChars: number;
  invisibleTextLength: number;
  imageCount: number;
  imageCoverage: number;
}): PdfPageClass {
  const { visibleChars, invisibleTextLength, imageCount, imageCoverage } = params;

  if (imageCoverage >= 0.4 && invisibleTextLength >= 30) {
    return "OCR_LAYER_EMBEDDED";
  }

  if (
    imageCount >= 1 &&
    imageCoverage >= 0.65 &&
    visibleChars < 25 &&
    invisibleTextLength < 30
  ) {
    return "FULL_PAGE_SCAN";
  }

  if (
    imageCount >= 1 &&
    imageCoverage >= 0.55 &&
    visibleChars >= 25 &&
    visibleChars <= 500 &&
    invisibleTextLength < 30
  ) {
    return "HYBRID_HEADER_SCAN_TRAP";
  }

  if (
    imageCount >= 1 &&
    imageCoverage >= 0.18 &&
    imageCoverage < 0.55 &&
    visibleChars >= 25
  ) {
    return "EMBEDDED_VISUAL_ASSET";
  }

  if (imageCoverage < 0.18 || (visibleChars >= 350 && imageCoverage < 0.55)) {
    return "BORN_DIGITAL";
  }

  if (imageCount >= 1 && visibleChars < 25) {
    return "FULL_PAGE_SCAN";
  }

  return "BORN_DIGITAL";
}

export async function inspectPdfPagesDetailed(params: {
  pdfProxy: any | null;
  rawPages: string[][];
  sourceBuffer: Buffer;
  usedFallbackStream: boolean;
}): Promise<PageInspectionOutput> {
  const { pdfProxy, rawPages, sourceBuffer, usedFallbackStream } = params;
  let inspectedPages: PageInspection[] = [];
  let inspectionSucceeded = false;

  if (pdfProxy) {
    try {
      const result = await inspectPages(pdfProxy);
      if (Array.isArray(result?.pages)) {
        inspectedPages = result.pages;
        inspectionSucceeded = true;
      }
    } catch {
      inspectionSucceeded = false;
    }
  }

  const rawLatin1 = sourceBuffer.toString("latin1");
  const hasRawImageOrOcrHint =
    /\/Subtype\s*\/Image\b|\/Im\d+\s+Do\b|OCR_PAGE_\d+|PAGE_\d+_OCR/i.test(rawLatin1);

  const details: PdfPageInspectionDetail[] = [];
  const scanned_pages_detected: number[] = [];
  const hybrid_scan_pages: number[] = [];

  for (let i = 0; i < rawPages.length; i++) {
    const pageNumber = i + 1;
    const rawLines = rawPages[i] || [];
    const visibleChars = rawLines.reduce((acc, line) => acc + line.trim().length, 0);
    const joinedText = rawLines.join(" ");
    const isExplicitBlankSeparator = /\b(?:em branco|intencionalmente vazia|blank page)\b/i.test(
      joinedText
    );
    const insp = inspectedPages[i];

    const imageCount = insp?.imageCount ?? 0;
    const imageCoverage =
      typeof insp?.imageCoverage === "number"
        ? Math.min(1, Math.max(0, insp.imageCoverage))
        : 0;
    const invisibleTextLength = insp?.invisibleTextLength ?? 0;

    let pageClass = classifyPdfPage({
      visibleChars,
      invisibleTextLength,
      imageCount,
      imageCoverage,
    });

    const lowVisibleTextLegacyTrap =
      visibleChars < 25 &&
      invisibleTextLength < 30 &&
      !isExplicitBlankSeparator &&
      (usedFallbackStream || !inspectionSucceeded || hasRawImageOrOcrHint || imageCount === 0);

    if (
      pageClass === "BORN_DIGITAL" &&
      visibleChars < 25 &&
      invisibleTextLength < 30 &&
      (usedFallbackStream || !inspectionSucceeded || hasRawImageOrOcrHint)
    ) {
      pageClass = "FULL_PAGE_SCAN";
    }

    details.push({
      page: pageNumber,
      page_class: pageClass,
      visible_chars: visibleChars,
      invisible_text_length: invisibleTextLength,
      image_count: imageCount,
      image_coverage: Number(imageCoverage.toFixed(4)),
    });

    if (pageClass === "FULL_PAGE_SCAN" || lowVisibleTextLegacyTrap) {
      scanned_pages_detected.push(pageNumber);
    } else if (pageClass === "HYBRID_HEADER_SCAN_TRAP") {
      scanned_pages_detected.push(pageNumber);
      hybrid_scan_pages.push(pageNumber);
    }
  }

  return {
    details,
    scanned_pages_detected,
    hybrid_scan_pages,
  };
}
