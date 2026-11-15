import { createHash } from "node:crypto";
import { extractImages, registerImageDecoders } from "unpdf";
import type {
  ExtractedPdfImageAsset,
  PdfPageClass,
  PdfPageInspectionDetail,
} from "../../types/index.ts";

export const MAX_EXTRACTED_IMAGES_PER_DOC = 20;

const ELIGIBLE_IMAGE_CLASSES = new Set<PdfPageClass>([
  "FULL_PAGE_SCAN",
  "HYBRID_HEADER_SCAN_TRAP",
  "EMBEDDED_VISUAL_ASSET",
]);

let imageDecodersInitialized = false;

export function ensurePdfImageDecodersRegistered(): void {
  if (imageDecodersInitialized) return;
  try {
    registerImageDecoders();
    imageDecodersInitialized = true;
  } catch {
    imageDecodersInitialized = true;
  }
}

export interface ImageExtractionOutput {
  extracted_images: ExtractedPdfImageAsset[];
  skipped_decorative_images_count: number;
}

interface CandidateAsset {
  page: number;
  page_class: PdfPageClass;
  coverage_pct: number;
  width: number;
  height: number;
  sha256: string;
  png_data: Buffer;
}

export async function extractRelevantPdfImages(params: {
  pdfProxy: any | null;
  pageDetails: PdfPageInspectionDetail[];
  maxImages?: number;
}): Promise<ImageExtractionOutput> {
  const { pdfProxy, pageDetails, maxImages = MAX_EXTRACTED_IMAGES_PER_DOC } = params;
  if (!pdfProxy || pageDetails.length === 0) {
    return { extracted_images: [], skipped_decorative_images_count: 0 };
  }

  const eligiblePages = pageDetails.filter((d) => ELIGIBLE_IMAGE_CLASSES.has(d.page_class));
  if (eligiblePages.length === 0) {
    return { extracted_images: [], skipped_decorative_images_count: 0 };
  }

  ensurePdfImageDecodersRegistered();

  let skippedDecorative = 0;
  const candidates: CandidateAsset[] = [];
  const distinctPagesBySha256 = new Map<string, Set<number>>();

  for (const detail of eligiblePages) {
    let rawImages: Array<{ data: Uint8Array; width: number; height: number }> = [];
    try {
      rawImages = await extractImages(pdfProxy, detail.page, { format: "png" });
    } catch {
      continue;
    }

    for (const img of rawImages) {
      if (!img?.data || img.data.length === 0) continue;
      const w = Number(img.width) || 0;
      const h = Number(img.height) || 0;

      if (w < 220 || h < 150 || w * h < 45000) {
        skippedDecorative++;
        continue;
      }

      const buf = Buffer.from(img.data);
      const sha256 = createHash("sha256").update(buf).digest("hex");

      let pageSet = distinctPagesBySha256.get(sha256);
      if (!pageSet) {
        pageSet = new Set<number>();
        distinctPagesBySha256.set(sha256, pageSet);
      }
      pageSet.add(detail.page);

      candidates.push({
        page: detail.page,
        page_class: detail.page_class,
        coverage_pct: Math.round(detail.image_coverage * 100),
        width: w,
        height: h,
        sha256,
        png_data: buf,
      });
    }
  }

  const extracted_images: ExtractedPdfImageAsset[] = [];
  const perPageCounter = new Map<number, number>();

  for (const cand of candidates) {
    const pagesCount = distinctPagesBySha256.get(cand.sha256)?.size ?? 0;
    if (pagesCount >= 3) {
      skippedDecorative++;
      continue;
    }

    if (extracted_images.length >= maxImages) {
      break;
    }

    const nextIdx = (perPageCounter.get(cand.page) || 0) + 1;
    perPageCounter.set(cand.page, nextIdx);

    extracted_images.push({
      page: cand.page,
      asset_index: nextIdx,
      asset_id: `ASSET_IMG_${String(nextIdx).padStart(2, "0")}`,
      page_class: cand.page_class,
      coverage_pct: cand.coverage_pct,
      width: cand.width,
      height: cand.height,
      sha256: cand.sha256,
      png_data: cand.png_data,
    });
  }

  return {
    extracted_images,
    skipped_decorative_images_count: skippedDecorative,
  };
}
