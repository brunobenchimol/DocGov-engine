import JSZip from "jszip";
import type { DocumentForensicMeta } from "../../types/index.ts";
import { detectPdfEditingSoftwareTraces } from "./forensic_meta.ts";

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractXmlTagText(xml: string | null, localName: string): string | null {
  if (!xml) return null;
  const re = new RegExp(
    `<(?:[A-Za-z0-9_]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${localName}>`,
    "i"
  );
  const match = xml.match(re);
  if (!match) return null;
  const cleaned = decodeXmlEntities(match[1].replace(/<[^>]+>/g, "")).trim();
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeIso(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

export async function extractDocxForensicMetaFromZip(
  zip: JSZip
): Promise<DocumentForensicMeta> {
  let coreXml: string | null = null;
  let appXml: string | null = null;

  const coreFile = zip.file("docProps/core.xml");
  if (coreFile) {
    try {
      coreXml = await coreFile.async("string");
    } catch {
      coreXml = null;
    }
  }

  const appFile = zip.file("docProps/app.xml");
  if (appFile) {
    try {
      appXml = await appFile.async("string");
    } catch {
      appXml = null;
    }
  }

  const title = extractXmlTagText(coreXml, "title");
  const author = extractXmlTagText(coreXml, "creator");
  const lastModifiedBy = extractXmlTagText(coreXml, "lastModifiedBy");
  const revisionRaw = extractXmlTagText(coreXml, "revision");
  const revisionCount =
    revisionRaw && /^\d+$/.test(revisionRaw) ? parseInt(revisionRaw, 10) : null;
  const creationDateIso = normalizeIso(extractXmlTagText(coreXml, "created"));
  const modDateIso = normalizeIso(extractXmlTagText(coreXml, "modified"));

  const application = extractXmlTagText(appXml, "Application");
  const company = extractXmlTagText(appXml, "Company");
  const template = extractXmlTagText(appXml, "Template");

  const hasDigitalSignature = zip
    .file(/^_xmlsignatures\//i)
    .some((entry) => !entry.dir);

  const editingSoftwareTraces = detectPdfEditingSoftwareTraces(application, null);
  const forensicAnomalies: string[] = [];
  if (editingSoftwareTraces.length > 0) {
    forensicAnomalies.push("[PDF_EDITOR_MANIPULATION_TRACE]");
  }

  return {
    source_format: "docx",
    title,
    author,
    last_modified_by: lastModifiedBy,
    creator_tool: application,
    producer: application,
    company,
    template,
    revision_count: revisionCount,
    creation_date_iso: creationDateIso,
    mod_date_iso: modDateIso,
    has_digital_signature: hasDigitalSignature,
    signature_date_iso: null,
    editing_software_traces: editingSoftwareTraces,
    forensic_anomalies: forensicAnomalies,
  };
}

export async function extractDocxForensicMetaFromBuffer(
  buffer: Buffer
): Promise<DocumentForensicMeta> {
  const zip = await JSZip.loadAsync(buffer);
  return extractDocxForensicMetaFromZip(zip);
}
