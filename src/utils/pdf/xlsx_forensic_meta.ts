import JSZip from "jszip";
import type { DocumentForensicMeta } from "../../types/index.ts";
import { extractOoxmlCoreAppMeta } from "./docx_forensic_meta.ts";

export async function extractXlsxForensicMetaFromZip(
  zip: JSZip
): Promise<DocumentForensicMeta> {
  return extractOoxmlCoreAppMeta(zip, "xlsx");
}

export async function extractXlsxForensicMetaFromBuffer(
  buffer: Buffer
): Promise<DocumentForensicMeta> {
  const zip = await JSZip.loadAsync(buffer);
  return extractOoxmlCoreAppMeta(zip, "xlsx");
}
