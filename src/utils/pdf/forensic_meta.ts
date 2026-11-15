import { extractLinks, getMeta } from "unpdf";
import type { DocumentForensicMeta } from "../../types/index.ts";

export const SUSPECT_PDF_EDITOR_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "Canva", regex: /\bcanva\b/i },
  { label: "iLovePDF", regex: /ilovepdf/i },
  { label: "Sejda", regex: /\bsejda\b/i },
  { label: "Smallpdf", regex: /smallpdf/i },
  { label: "CorelDRAW", regex: /corel\s*draw/i },
  { label: "Photoshop", regex: /photoshop/i },
  { label: "PDFescape", regex: /pdfescape/i },
  { label: "Nitro", regex: /\bnitro\b/i },
  { label: "PhantomPDF", regex: /phantompdf/i },
];

function cleanMetaString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    return parsePdfRawDateToIso(value.trim());
  }
  return null;
}

export function parsePdfRawDateToIso(raw: string): string | null {
  const m = raw.match(/^(?:D:)?(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (m) {
    const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }
  return null;
}

export function detectPdfEditingSoftwareTraces(
  creatorTool: string | null,
  producer: string | null
): string[] {
  const combined = [creatorTool || "", producer || ""].join(" ");
  if (!combined.trim()) return [];
  const traces: string[] = [];
  for (const pat of SUSPECT_PDF_EDITOR_PATTERNS) {
    if (pat.regex.test(combined) && !traces.includes(pat.label)) {
      traces.push(pat.label);
    }
  }
  return traces;
}

export async function extractPdfForensicMeta(params: {
  pdfProxy: any | null;
  sourceBuffer: Buffer;
}): Promise<DocumentForensicMeta> {
  const { pdfProxy, sourceBuffer } = params;

  let title: string | null = null;
  let author: string | null = null;
  let creatorTool: string | null = null;
  let producer: string | null = null;
  let creationDateIso: string | null = null;
  let modDateIso: string | null = null;
  let isSignaturesPresent = false;
  let linksDetectedCount = 0;

  if (pdfProxy) {
    try {
      const metaRes = await getMeta(pdfProxy, { parseDates: true });
      const info = metaRes?.info;
      if (info) {
        title = cleanMetaString(info.Title);
        author = cleanMetaString(info.Author);
        creatorTool = cleanMetaString(info.Creator);
        producer = cleanMetaString(info.Producer);
        creationDateIso = toIsoDate(info.CreationDate);
        modDateIso = toIsoDate(info.ModDate);
        isSignaturesPresent = Boolean(info.IsSignaturesPresent);
      }
    } catch {
      // Silencioso: fallback para scanner de buffer
    }

    try {
      const linkRes = await extractLinks(pdfProxy);
      if (Array.isArray(linkRes?.links)) {
        linksDetectedCount = linkRes.links.reduce(
          (acc, pageLinks) => acc + (Array.isArray(pageLinks) ? pageLinks.length : 0),
          0
        );
      }
    } catch {
      linksDetectedCount = 0;
    }
  }

  const rawLatin1 = sourceBuffer.toString("latin1");
  const hasSigObject = /\/Type\s*\/Sig\b/.test(rawLatin1);
  const sigDateMatch = rawLatin1.match(/\/M\s*\(D:(\d{8,14})/);
  const signatureDateIso = sigDateMatch ? parsePdfRawDateToIso(sigDateMatch[1]) : null;
  const hasDigitalSignature = isSignaturesPresent || hasSigObject || Boolean(signatureDateIso);

  const editingSoftwareTraces = detectPdfEditingSoftwareTraces(creatorTool, producer);
  const forensicAnomalies: string[] = [];
  if (editingSoftwareTraces.length > 0) {
    forensicAnomalies.push("[PDF_EDITOR_MANIPULATION_TRACE]");
  }

  return {
    source_format: "pdf",
    title,
    author,
    last_modified_by: null,
    creator_tool: creatorTool,
    producer,
    company: null,
    template: null,
    revision_count: null,
    creation_date_iso: creationDateIso,
    mod_date_iso: modDateIso,
    has_digital_signature: hasDigitalSignature,
    signature_date_iso: signatureDateIso,
    editing_software_traces: editingSoftwareTraces,
    forensic_anomalies: forensicAnomalies,
    ...(linksDetectedCount > 0 ? { links_detected_count: linksDetectedCount } : {}),
  };
}
