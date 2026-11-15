// ============================================================================
// Compilador OpenXML DOCX/PDF: Julgamento TIC & Diligência ACT (Gen6)
// docgov-engine v1.6.1 — src/bidding/bidding_docx_compiler.ts
// ============================================================================

import { join } from "node:path";
import type { BiddingProposalDossier } from "./types.ts";
import { emitDocxAndPdf } from "./bidding_xml_primitives.ts";
import { buildBiddingJudgmentOpinionXmlParts } from "./bidding_opinion_sections.ts";
import { buildActDiligenceLetterXmlParts } from "./act_diligence_letter_sections.ts";

export async function compileBiddingArtifacts(
  dossier: BiddingProposalDossier,
  outDir: string,
  mode?: string,
  outputFormat: "docx" | "pdf" | "both" = "both"
): Promise<BiddingProposalDossier["compiled_artifacts"] | undefined> {
  const norm = (mode || "NONE").toUpperCase();
  if (norm === "NONE" || !norm) return undefined;

  const artifacts: NonNullable<BiddingProposalDossier["compiled_artifacts"]> = {};
  const wantJudgment =
    norm === "PROPOSAL_JUDGMENT_OPINION" || norm === "JUDGMENT_OPINION" || norm === "BOTH";
  const wantDiligence =
    norm === "ACT_DILIGENCE_LETTER" || norm === "ACT_DILIGENCE_REPORT" || norm === "BOTH";

  if (wantJudgment) {
    const parts = buildBiddingJudgmentOpinionXmlParts(dossier);
    const res = await emitDocxAndPdf(
      parts,
      join(outDir, "Parecer_Julgamento_Proposta_Habilitacao_e_Diligencia.docx"),
      outputFormat
    );
    artifacts.judgment_opinion_docx_path = res.docx_path;
    artifacts.judgment_opinion_pdf_path = res.pdf_path;
  }

  if (wantDiligence) {
    const parts = buildActDiligenceLetterXmlParts(dossier);
    const res = await emitDocxAndPdf(
      parts,
      join(outDir, "Oficio_e_Email_Diligencia_Veracidade_ACT.docx"),
      outputFormat
    );
    artifacts.act_diligence_docx_path = res.docx_path;
    artifacts.act_diligence_pdf_path = res.pdf_path;
  }

  return Object.keys(artifacts).length > 0 ? artifacts : undefined;
}
