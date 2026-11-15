import { getDocumentProxy } from "unpdf";
import { executeHeadlessOcr } from "../core/ocr.ts";
import type {
  DocumentForensicMeta,
  ExtractedPdfImageAsset,
  PdfExtractionResult,
  PdfLineItem,
  PdfPageInfo,
  PdfPageInspectionDetail,
} from "../types/index.ts";
import { extractPdfForensicMeta } from "./pdf/forensic_meta.ts";
import {
  extractRelevantPdfImages,
  MAX_EXTRACTED_IMAGES_PER_DOC,
} from "./pdf/image_extractor.ts";
import { inspectPdfPagesDetailed } from "./pdf/page_inspector.ts";
import {
  createSyntheticPdfBuffer,
  fallbackExtractPagesFromBuffer,
} from "./pdf/stream_fallback.ts";

export { createSyntheticPdfBuffer };

export interface ExtractPdfOptions {
  skipPageInspection?: boolean;
  skipImageExtraction?: boolean;
  skipForensicMeta?: boolean;
  maxImages?: number;
}

export function isPdfBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 5) return false;
  return (
    buf[0] === 0x25 && // %
    buf[1] === 0x50 && // P
    buf[2] === 0x44 && // D
    buf[3] === 0x46 && // F
    buf[4] === 0x2d // -
  );
}

export function formatPdfCoord(page: number, line: number): string {
  const pStr = String(page).padStart(3, "0");
  const lStr = String(line).padStart(4, "0");
  return `PAG_${pStr} | L${lStr}`;
}

export function formatPdfBracketCoord(page: number, line: number): string {
  return `[${formatPdfCoord(page, line)}]`;
}

export interface RawPdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

/**
 * Reconstrução Espacial de Linhas e Colunas em PDF (Y-Axis Line Grouping v0.9.0 / v0.9.6):
 * Agrupa itens pela coordenada vertical (y) com tolerância fina (deltaY <= 2.5pt),
 * ordena horizontalmente por (x) e detecta colunas distintas de tabelas/planilhas
 * separando-as por ' | ' com suporte resiliente a Y-jitter e tokens curtos.
 */
export function reconstructLinesFromTextItems(
  items: Array<any>,
  yTolerance: number = 2.5,
  colGapThreshold: number = 18
): string[] {
  const validItems: RawPdfTextItem[] = [];

  for (const raw of items) {
    if (typeof raw?.str !== "string" || raw.str.length === 0) continue;

    const x =
      Array.isArray(raw.transform) && typeof raw.transform[4] === "number"
        ? raw.transform[4]
        : 0;
    const y =
      Array.isArray(raw.transform) && typeof raw.transform[5] === "number"
        ? raw.transform[5]
        : 0;
    const fontSize =
      typeof raw.height === "number" && raw.height > 0
        ? raw.height
        : (Array.isArray(raw.transform) && Math.abs(raw.transform[0])) || 10;
    const width =
      typeof raw.width === "number" && raw.width > 0
        ? raw.width
        : raw.str.length * fontSize * 0.55;
    const height =
      typeof raw.height === "number" && raw.height > 0 ? raw.height : fontSize;

    validItems.push({ str: raw.str, x, y, width, height, fontSize });
  }

  if (validItems.length === 0) return [];

  validItems.sort((a, b) => {
    if (Math.abs(b.y - a.y) > yTolerance) {
      return b.y - a.y;
    }
    return a.x - b.x;
  });

  interface LineCluster {
    anchorY: number;
    avgY: number;
    items: RawPdfTextItem[];
  }

  const clusters: LineCluster[] = [];

  for (const it of validItems) {
    let matchedCluster: LineCluster | null = null;
    for (const c of clusters) {
      if (Math.abs(c.anchorY - it.y) <= yTolerance) {
        matchedCluster = c;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.items.push(it);
      const n = matchedCluster.items.length;
      matchedCluster.avgY = (matchedCluster.avgY * (n - 1) + it.y) / n;
    } else {
      clusters.push({ anchorY: it.y, avgY: it.y, items: [it] });
    }
  }

  clusters.sort((a, b) => b.avgY - a.avgY);

  const lines: string[] = [];

  for (const cluster of clusters) {
    cluster.items.sort((a, b) => a.x - b.x);

    let lineText = "";
    let prevItem: RawPdfTextItem | null = null;

    for (const item of cluster.items) {
      const itemStr = item.str;
      if (!itemStr && itemStr !== "") continue;

      if (
        prevItem &&
        Math.abs(item.x - prevItem.x) <= 1.0 &&
        Math.abs(item.y - prevItem.y) <= 1.0 &&
        itemStr.trim() === prevItem.str.trim()
      ) {
        continue;
      }

      if (!prevItem) {
        lineText = itemStr;
      } else {
        const estimatedPrevWidth = Math.max(
          1,
          prevItem.str.length * prevItem.fontSize * 0.55
        );
        const effectivePrevWidth =
          prevItem.width > 0
            ? Math.min(prevItem.width, estimatedPrevWidth)
            : estimatedPrevWidth;

        const prevEnd = prevItem.x + effectivePrevWidth;
        const gap = item.x - prevEnd;
        const deltaX = item.x - prevItem.x;

        const prevTrimmed = lineText.trim();
        const currTrimmed = itemStr.trim();

        const isShortToken = prevItem.str.trim().length <= 4;
        const isColumnGutter =
          (gap >= colGapThreshold || (isShortToken && deltaX >= 35)) &&
          prevTrimmed.length > 0 &&
          currTrimmed.length > 0;

        if (isColumnGutter) {
          if (prevTrimmed.endsWith("|") || currTrimmed.startsWith("|")) {
            lineText += (lineText.endsWith(" ") ? "" : " ") + currTrimmed;
          } else {
            lineText += " | " + currTrimmed;
          }
        } else if (
          lineText &&
          !lineText.endsWith(" ") &&
          !itemStr.startsWith(" ") &&
          !/^[,\.;:\?!\)\]]/.test(currTrimmed) &&
          gap > 1.0
        ) {
          lineText += " " + itemStr;
        } else {
          lineText += itemStr;
        }
      }

      prevItem = item;
    }

    const cleaned = lineText.replace(/\s+/g, " ").trim();
    if (cleaned) {
      lines.push(cleaned);
    }
  }

  return lines;
}

export async function extractPdfPages(
  buffer: Buffer,
  options?: ExtractPdfOptions
): Promise<PdfExtractionResult> {
  if (!isPdfBuffer(buffer)) {
    throw new Error(
      "Arquivo .pdf inválido: assinatura de Magic Bytes '%PDF-' não encontrada no cabeçalho."
    );
  }

  let rawPages: string[][] = [];
  let pdfProxy: any | null = null;
  let usedFallbackStream = false;

  try {
    const uint8 = new Uint8Array(buffer.slice(0));
    pdfProxy = await getDocumentProxy(uint8, { verbosity: 0 });
    const numPages = pdfProxy.numPages || 0;

    for (let p = 1; p <= numPages; p++) {
      const page = await pdfProxy.getPage(p);
      const textContent = await page.getTextContent();
      const pageLines = reconstructLinesFromTextItems(
        textContent.items as Array<any>
      );
      rawPages.push(pageLines);
    }
  } catch {
    pdfProxy = null;
  }

  if (rawPages.length === 0) {
    rawPages = fallbackExtractPagesFromBuffer(buffer);
    usedFallbackStream = true;
  }

  let pageInspectionSummary: PdfPageInspectionDetail[] | undefined;
  let scanned_pages_detected: number[] = [];
  let hybrid_scan_pages: number[] = [];
  let extractedImages: ExtractedPdfImageAsset[] | undefined;
  let skippedDecorativeImagesCount: number | undefined;
  let forensicMeta: DocumentForensicMeta | undefined;

  try {
    if (!options?.skipPageInspection) {
      const inspection = await inspectPdfPagesDetailed({
        pdfProxy,
        rawPages,
        sourceBuffer: buffer,
        usedFallbackStream,
      });
      pageInspectionSummary = inspection.details;
      scanned_pages_detected = inspection.scanned_pages_detected;
      hybrid_scan_pages = inspection.hybrid_scan_pages;
    }

    if (!options?.skipImageExtraction && pageInspectionSummary) {
      const imgOut = await extractRelevantPdfImages({
        pdfProxy,
        pageDetails: pageInspectionSummary,
        maxImages: options?.maxImages ?? MAX_EXTRACTED_IMAGES_PER_DOC,
      });
      extractedImages = imgOut.extracted_images;
      skippedDecorativeImagesCount = imgOut.skipped_decorative_images_count;
    }

    if (!options?.skipForensicMeta) {
      forensicMeta = await extractPdfForensicMeta({
        pdfProxy,
        sourceBuffer: buffer,
      });
    }
  } finally {
    try {
      await pdfProxy?.destroy?.();
    } catch {
      // Ignore cleanup failure
    }
  }

  const pages: PdfPageInfo[] = [];
  const allLines: PdfLineItem[] = [];
  let globalLineCounter = 0;

  for (let i = 0; i < rawPages.length; i++) {
    const pageNumber = i + 1;
    const pageLines = rawPages[i] || [];
    const pageItems: PdfLineItem[] = [];

    for (const rawText of pageLines) {
      const subLines = rawText.split(/\r?\n/);
      for (const sub of subLines) {
        const text = sub.replace(/\s+/g, " ").trim();
        if (!text) continue;
        globalLineCounter++;
        const coord = formatPdfCoord(pageNumber, globalLineCounter);
        const bracket_coord = `[${coord}]`;

        const item: PdfLineItem = {
          page: pageNumber,
          line: globalLineCounter,
          coord,
          bracket_coord,
          text,
        };
        pageItems.push(item);
        allLines.push(item);
      }
    }

    if (options?.skipPageInspection) {
      const pageTotalChars = pageItems.reduce((acc, l) => acc + l.text.length, 0);
      if (pageTotalChars < 25) {
        scanned_pages_detected.push(pageNumber);
      }
    }

    pages.push({ pageNumber, lines: pageItems });
  }

  let ocrApplied = false;
  let ocrPagesApplied: number[] = [];

  if (scanned_pages_detected.length > 0 && !options?.skipPageInspection) {
    const ocrMap = await executeHeadlessOcr(buffer, scanned_pages_detected);

    for (const [pageNum, ocrLines] of ocrMap.entries()) {
      if (ocrLines && ocrLines.length > 0) {
        ocrPagesApplied.push(pageNum);
        const targetPage = pages.find((p) => p.pageNumber === pageNum);
        if (targetPage) {
          const existingChars = targetPage.lines.reduce(
            (acc, l) => acc + l.text.length,
            0
          );
          if (existingChars < 25) {
            for (const oldLine of targetPage.lines) {
              const idx = allLines.indexOf(oldLine);
              if (idx !== -1) allLines.splice(idx, 1);
            }
            targetPage.lines = [];
          }
          for (const rawLine of ocrLines) {
            for (const subLine of rawLine.split(/\r?\n/)) {
              const text = subLine.replace(/\s+/g, " ").trim();
              if (!text) continue;
              globalLineCounter++;
              const coord = formatPdfCoord(pageNum, globalLineCounter);
              const bracket_coord = `[${coord}]`;
              const lineItem: PdfLineItem = {
                page: pageNum,
                line: globalLineCounter,
                coord,
                bracket_coord,
                text,
              };
              targetPage.lines.push(lineItem);
              allLines.push(lineItem);
            }
          }
        }
      }
    }
    if (ocrPagesApplied.length > 0) {
      ocrApplied = true;
    }
  }

  return {
    pageCount: pages.length,
    lineCount: allLines.length,
    pages,
    lines: allLines,
    scanned_pages_detected,
    ...(hybrid_scan_pages.length > 0 ? { hybrid_scan_pages } : {}),
    ...(pageInspectionSummary ? { page_inspection_summary: pageInspectionSummary } : {}),
    ...(extractedImages && extractedImages.length > 0
      ? { extracted_images: extractedImages }
      : {}),
    ...(typeof skippedDecorativeImagesCount === "number"
      ? { skipped_decorative_images_count: skippedDecorativeImagesCount }
      : {}),
    ...(forensicMeta
      ? { forensic_meta: forensicMeta, pdf_forensic_meta: forensicMeta }
      : {}),
    ...(ocrApplied ? { ocr_applied: true, ocr_pages: ocrPagesApplied } : {}),
  };
}
