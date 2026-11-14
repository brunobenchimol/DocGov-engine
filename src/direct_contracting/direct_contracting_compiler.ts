// ============================================================================
// Compilador OpenXML DOCX/PDF: Contratação Direta & Estatais (Gen6)
// docgov-engine v1.6.0 — src/direct_contracting/direct_contracting_compiler.ts
// ============================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { sanitizeXmlString } from "../utils/xml.ts";
import { convertDocxToPdf, resolveOutputPaths, safeUnlink } from "../utils/pdf_exporter.ts";
import { cleanHumanText } from "../tools/audit.ts";
import type { DirectContractingAuditDossier } from "./types.ts";

function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pHeading(text: string, level = 1): string {
  const sz = level === 1 ? "28" : "24";
  return `<w:p><w:pPr><w:spacing w:before="240" w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:color w:val="1E3A8A"/></w:rPr><w:t>${esc(text)}</w:t></w:r></w:p>`;
}

function pBody(text: string, bold = false): string {
  const b = bold ? "<w:b/>" : "";
  return `<w:p><w:pPr><w:spacing w:before="40" w:after="80"/></w:pPr><w:r><w:rPr>${b}<w:sz w:val="21"/><w:szCs w:val="21"/><w:color w:val="1F2937"/></w:rPr><w:t>${esc(cleanHumanText(text))}</w:t></w:r></w:p>`;
}

export async function compileDirectContractingOpinion(
  dossier: DirectContractingAuditDossier,
  outDir: string,
  mode?: string,
  outputFormat: "docx" | "pdf" | "both" = "both"
): Promise<{ opinion_docx_path?: string; opinion_pdf_path?: string } | undefined> {
  const norm = (mode || "NONE").toUpperCase();
  if (norm === "NONE" || !norm) return undefined;

  const parts: string[] = [
    pHeading(`PARECER DE INSTRUÇÃO PROCESSUAL — ${dossier.modality} (${dossier.process_id})`, 1),
    pBody(`Regime Jurídico: ${dossier.legal_regime} | Decisão: ${dossier.decision} | Status: ${dossier.status}`, true),
    pHeading("1. Enquadramento Normativo e Requisitos Auditados", 2),
  ];

  if (dossier.inexigibility_summary) {
    const s = dossier.inexigibility_summary;
    parts.push(
      pBody(`• Inviabilidade de Competição Comprovada: ${s.competition_infeasibility_proven ? "SIM" : "NÃO"}`),
      pBody(`• Atestado de Exclusividade (Súmula TCU 255): ${s.exclusivity_valid ? "VÁLIDO" : "INVÁLIDO / GENÉRICO"}`),
      pBody(`• Provas de Preço no Mercado (mín. 3 NFs/Contratos): ${s.valid_market_price_proofs_count} documento(s)`)
    );
  }
  if (dossier.dispensation_summary) {
    const d = dossier.dispensation_summary;
    parts.push(
      pBody(`• Unidade Gestora: ${d.managing_unit_code} | Exercício: ${d.financial_year} | Ramo (PDM/CATMAT/CATSER): ${d.activity_branch_code}`),
      pBody(`• Somatório Acumulado: R$ ${d.accumulated_total_in_branch.toFixed(2)} | Teto Legal: R$ ${d.legal_annual_limit.toFixed(2)} | Fracionamento: ${d.fragmentation_detected ? "DETECTADO" : "NÃO DETECTADO"}`)
    );
  }
  if (dossier.state_opportunity_summary) {
    const o = dossier.state_opportunity_summary;
    parts.push(
      pBody(`• Objeto Social: ${o.linked_to_corporate_purpose ? "SIM" : "NÃO"} | Singularidade do Parceiro: ${o.partner_singularity_proven ? "SIM" : "NÃO"}`),
      pBody(`• Inviabilidade Concorrencial: ${o.competitive_infeasibility_proven ? "SIM" : "NÃO"} | Matriz Riscos/Receitas: ${o.risk_revenue_matrix_present ? "SIM" : "NÃO"} | Compra Comum Disfarçada: ${o.ordinary_commodity_disguised ? "SIM (VEDADO)" : "NÃO"}`)
    );
  }

  parts.push(pHeading("2. Conclusão e Bloqueios Normativos", 2));
  if (dossier.blocking_tags.length > 0) {
    dossier.blocking_tags.forEach((t) => parts.push(pBody(`• ${t}`, true)));
    dossier.findings.forEach((f) => parts.push(pBody(f)));
  } else {
    parts.push(pBody("Instrução processual em estrita conformidade com os requisitos legais aplicáveis."));
  }

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${parts.join("\n")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1418"/></w:sectPr></w:body>
</w:document>`;

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(
    parser.parseFromString(sanitizeXmlString(docXml), "application/xml")
  );

  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default ContentType="application/vnd.openxmlformats-package.relationships+xml" Extension="rels"/><Default ContentType="application/xml" Extension="xml"/><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" PartName="/word/document.xml"/><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml" PartName="/word/styles.xml"/></Types>`);
  zip.folder("_rels")!.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  const word = zip.folder("word")!;
  word.file("document.xml", serialized);
  word.file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`);

  const buf = (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
  const outPath = join(outDir, "Parecer_Instrucao_Inexigibilidade_Dispensa_ou_Oportunidade_Estatal.docx");
  const resolved = resolveOutputPaths(outPath, outputFormat);
  mkdirSync(dirname(resolved.docxPath), { recursive: true });
  writeFileSync(resolved.docxPath, buf);

  let pdfOut: string | undefined;
  if (outputFormat === "pdf" || outputFormat === "both") {
    const res = await convertDocxToPdf(resolved.docxPath, resolved.pdfPath!);
    if (res.success && res.pdfPath) pdfOut = res.pdfPath;
  }
  if (resolved.isExclusivePdf && resolved.tempDocxPath) {
    await safeUnlink(resolved.tempDocxPath);
  }
  return {
    opinion_docx_path: resolved.isExclusivePdf ? undefined : resolved.docxPath,
    opinion_pdf_path: pdfOut,
  };
}
