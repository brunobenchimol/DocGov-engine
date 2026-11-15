// ============================================================================
// Compilador OpenXML DOCX/PDF: Contratação Direta & Estatais (Gen6)
// docgov-engine v1.6.1 — src/direct_contracting/direct_contracting_compiler.ts
// ============================================================================

import { join } from "node:path";
import type { DirectContractingAuditDossier } from "./types.ts";
import { emitDocxAndPdf } from "../bidding/bidding_xml_primitives.ts";
import { buildDirectContractingOpinionXmlParts } from "./direct_contracting_sections.ts";

export async function compileDirectContractingOpinion(
  dossier: DirectContractingAuditDossier,
  outDir: string,
  mode?: string,
  outputFormat: "docx" | "pdf" | "both" = "both"
): Promise<{ opinion_docx_path?: string; opinion_pdf_path?: string } | undefined> {
  const norm = (mode || "NONE").toUpperCase();
  if (norm === "NONE" || !norm) return undefined;

  const parts = buildDirectContractingOpinionXmlParts(dossier);
  const outPath = join(
    outDir,
    "Parecer_Instrucao_Inexigibilidade_Dispensa_ou_Oportunidade_Estatal.docx"
  );
  const res = await emitDocxAndPdf(parts, outPath, outputFormat);

  return {
    opinion_docx_path: res.docx_path,
    opinion_pdf_path: res.pdf_path,
  };
}
