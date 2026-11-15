import { existsSync, readFileSync } from "node:fs";
import type { DocumentForensicMeta } from "../types/index.ts";
import { extractPdfPages } from "../utils/pdf.ts";
import {
  detectCrossDocumentForensicCollisions,
  type ForensicInventoryItem,
} from "../utils/pdf/forensic_cross_audit.ts";
import { extractDocxForensicMetaFromBuffer } from "../utils/pdf/docx_forensic_meta.ts";
import { resolveWorkspacePath } from "../utils/paths.ts";
import type {
  CompetingProposalMetaInput,
  ForensicCollusionEvaluation,
} from "./types.ts";

async function resolveProposalForensicMeta(
  item: CompetingProposalMetaInput
): Promise<DocumentForensicMeta | undefined> {
  if (item.forensic_meta) return item.forensic_meta;

  if (item.structure_json_path) {
    try {
      const p = resolveWorkspacePath(item.structure_json_path);
      if (existsSync(p)) {
        const parsed = JSON.parse(readFileSync(p, "utf-8"));
        if (parsed?.forensic_meta) return parsed.forensic_meta as DocumentForensicMeta;
      }
    } catch {
      // Ignore fallback read failure
    }
  }

  if (item.proposal_pdf_path) {
    try {
      const p = resolveWorkspacePath(item.proposal_pdf_path);
      if (existsSync(p)) {
        const buf = readFileSync(p);
        if (p.toLowerCase().endsWith(".docx")) {
          return await extractDocxForensicMetaFromBuffer(buf);
        }
        const extraction = await extractPdfPages(buf, {
          skipPageInspection: true,
          skipImageExtraction: true,
        });
        return extraction.forensic_meta;
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export async function auditCompetingProposalsCollusion(
  items: CompetingProposalMetaInput[] = []
): Promise<ForensicCollusionEvaluation> {
  if (!items || items.length < 2) {
    return {
      proposals_audited: items?.length || 0,
      collusion_pairs_count: 0,
      blocking_tags: [],
      findings: [],
    };
  }

  const resolved: ForensicInventoryItem[] = [];
  const metaList: Array<{ label: string; meta: DocumentForensicMeta }> = [];

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const meta = await resolveProposalForensicMeta(it);
    const label =
      it.proposal_file_name ||
      it.bidder_name ||
      it.bidder_cnpj ||
      `proposta_${idx + 1}`;
    resolved.push({ fileName: label, forensicMeta: meta });
    if (meta) {
      metaList.push({ label, meta });
    }
  }

  const tagsSet = new Set<string>();
  const findings: string[] = [];

  const collisions = detectCrossDocumentForensicCollisions(resolved);
  for (const col of collisions) {
    tagsSet.add("[BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT]");
    findings.push(col.reason);
  }

  // Checa proximidade temporal (< 120s) combinada com Creator/Producer idênticos entre propostas
  for (let i = 0; i < metaList.length; i++) {
    for (let j = i + 1; j < metaList.length; j++) {
      const a = metaList[i];
      const b = metaList[j];
      const dA = a.meta.creation_date_iso
        ? new Date(a.meta.creation_date_iso).getTime()
        : NaN;
      const dB = b.meta.creation_date_iso
        ? new Date(b.meta.creation_date_iso).getTime()
        : NaN;
      const sameTool =
        (a.meta.creator_tool &&
          b.meta.creator_tool &&
          a.meta.creator_tool.toLowerCase() === b.meta.creator_tool.toLowerCase()) ||
        (a.meta.producer &&
          b.meta.producer &&
          a.meta.producer.toLowerCase() === b.meta.producer.toLowerCase());

      if (!Number.isNaN(dA) && !Number.isNaN(dB)) {
        const deltaSec = Math.abs(dA - dB) / 1000;
        if (deltaSec <= 120 && sameTool) {
          tagsSet.add("[BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT]");
          findings.push(
            `Coincidência temporal suspeita entre '${a.label}' e '${b.label}': CreationDate com intervalo de ${Math.round(
              deltaSec
            )}s (<= 120s) usando mesma ferramenta ('${a.meta.creator_tool || a.meta.producer}').`
          );
        }
      }
    }
  }

  // Checa rastros de editores de manipulação entre propostas concorrentes
  for (const entry of metaList) {
    if (entry.meta.editing_software_traces.length > 0) {
      findings.push(
        `Rastro de software de edição externa (${entry.meta.editing_software_traces.join(
          ", "
        )}) detectado nos metadados de '${entry.label}'.`
      );
    }
  }

  return {
    proposals_audited: items.length,
    collusion_pairs_count: Math.max(collisions.length, tagsSet.size > 0 ? 1 : 0),
    blocking_tags: Array.from(tagsSet),
    findings: Array.from(new Set(findings)),
  };
}
