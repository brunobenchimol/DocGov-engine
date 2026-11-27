// ============================================================================
// Helpers de Artefatos Markdown & Envelope Híbrido de inspect_doc (Lei 2 Bimodal)
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import { writeFileSafeSync } from "../../utils/fs_safe_io.ts";
import { formatCompactMcpPath } from "../../utils/json.ts";
import {
  buildHybridMcpEnvelope,
  buildSummaryMcpEnvelope,
  type BuiltMcpEnvelope,
  type CompanionWriteItem,
} from "../../utils/mcp_hybrid_output.ts";
import type {
  DocxInspectionResult,
  InspectDocSyntheticResult,
  InspectResult,
} from "../../types/index.ts";
import { formatInspectDocSyntheticResult } from "./document_pipelines.ts";
import { toShortDocPath } from "./toc_and_compactor.ts";

const TRANSIENT_AUDIT_MD = Symbol("docgov_transient_audit_md");
const TRANSIENT_DOSSIE_MD = Symbol("docgov_transient_dossie_md");

export function attachTransientInspectMarkdown(
  target: DocxInspectionResult,
  auditMd?: string,
  dossieMd?: string
): void {
  if (auditMd !== undefined) {
    Object.defineProperty(target, TRANSIENT_AUDIT_MD, {
      value: auditMd,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  if (dossieMd !== undefined) {
    Object.defineProperty(target, TRANSIENT_DOSSIE_MD, {
      value: dossieMd,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
}

export function readTransientInspectMarkdown(target: InspectResult): {
  auditMd?: string;
  dossieMd?: string;
} {
  return {
    auditMd: (target as any)?.[TRANSIENT_AUDIT_MD],
    dossieMd: (target as any)?.[TRANSIENT_DOSSIE_MD],
  };
}

export function writeOrDeferMarkdownArtifact(
  filePath: string,
  content: string,
  deferWrite?: boolean
): void {
  if (!deferWrite) {
    writeFileSafeSync(filePath, content);
  }
}

export async function buildInspectHybridEnvelope(args: {
  filePath: string;
  outputPath?: string;
  inspection: InspectResult;
  deferWrite?: boolean;
}): Promise<BuiltMcpEnvelope<InspectDocSyntheticResult>> {
  const synthetic = formatInspectDocSyntheticResult(
    args.filePath,
    args.outputPath,
    args.inspection
  );

  const auditPath = args.inspection.audit_view_path;
  const transient = readTransientInspectMarkdown(args.inspection);
  let auditMd = transient.auditMd;
  if (auditMd === undefined && auditPath && existsSync(auditPath)) {
    auditMd = readFileSync(auditPath, "utf8");
  }

  if (!auditPath || auditMd === undefined) {
    return buildSummaryMcpEnvelope(synthetic);
  }

  const companionWrites: CompanionWriteItem[] = [];
  if (args.inspection.dossie_hotspots_path) {
    let dossieMd = transient.dossieMd;
    if (dossieMd === undefined && existsSync(args.inspection.dossie_hotspots_path)) {
      dossieMd = readFileSync(args.inspection.dossie_hotspots_path, "utf8");
    }
    if (dossieMd !== undefined) {
      companionWrites.push({
        filePath: args.inspection.dossie_hotspots_path,
        content: dossieMd,
      });
    }
  }

  const displayArtifactPath =
    synthetic.audit_view_path || formatCompactMcpPath(auditPath);

  return await buildHybridMcpEnvelope({
    basePayload: synthetic,
    artifactPath: auditPath,
    displayArtifactPath,
    markdownContent: auditMd,
    writeMode: "write_behind",
    deferWrite: args.deferWrite !== false,
    companionWrites,
    compactForPointer: (payload, targetBytes) => {
      const sizeOf = () => Buffer.byteLength(JSON.stringify(payload), "utf8");
      while (
        Array.isArray(payload.toc_summary) &&
        payload.toc_summary.length > 0 &&
        sizeOf() > targetBytes
      ) {
        payload.toc_summary.pop();
      }
      if (Array.isArray(payload.toc_summary) && payload.toc_summary.length === 0) {
        delete payload.toc_summary;
      }
      if (sizeOf() > targetBytes && payload.docxPath && payload.filePath) {
        delete payload.docxPath;
      }
      if (sizeOf() > targetBytes) {
        payload.filePath = toShortDocPath(payload.filePath);
        if (payload.outputPath) payload.outputPath = toShortDocPath(payload.outputPath);
        if (payload.audit_view_path) {
          payload.audit_view_path = toShortDocPath(payload.audit_view_path);
        }
        if (payload.dossie_path) {
          payload.dossie_path = toShortDocPath(payload.dossie_path);
        }
      }
      if (sizeOf() > targetBytes && payload.dossie_path) {
        delete payload.dossie_path;
      }
      if (sizeOf() > targetBytes && payload.outputPath) {
        delete payload.outputPath;
      }
    },
  });
}
