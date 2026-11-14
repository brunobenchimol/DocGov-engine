// ============================================================================
// Compilador OpenXML DOCX/PDF: Julgamento TIC & Diligência ACT (Gen6)
// docgov-engine v1.6.0 — src/bidding/bidding_docx_compiler.ts
// ============================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { sanitizeXmlString } from "../utils/xml.ts";
import { convertDocxToPdf, resolveOutputPaths, safeUnlink } from "../utils/pdf_exporter.ts";
import { cleanHumanText } from "../tools/audit.ts";
import type { BiddingProposalDossier } from "./types.ts";

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

function buildTableXml(headers: string[], rows: string[][]): string {
  const colW = Math.floor(9072 / Math.max(headers.length, 1));
  const grid = headers.map(() => `<w:gridCol w:w="${colW}"/>`).join("");
  const makeCell = (txt: string, isHeader = false) => {
    const shd = isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/>` : "";
    const b = isHeader ? "<w:b/>" : "";
    return `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${shd}</w:tcPr><w:p><w:r><w:rPr>${b}<w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${esc(cleanHumanText(txt))}</w:t></w:r></w:p></w:tc>`;
  };
  const headerRow = `<w:tr>${headers.map((h) => makeCell(h, true)).join("")}</w:tr>`;
  const bodyRows = rows.map((r) => `<w:tr>${r.map((c) => makeCell(c, false)).join("")}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="9072" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="94A3B8"/><w:left w:val="single" w:sz="6" w:color="94A3B8"/><w:bottom w:val="single" w:sz="6" w:color="94A3B8"/><w:right w:val="single" w:sz="6" w:color="94A3B8"/><w:insideH w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:color="CBD5E1"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${headerRow}${bodyRows}</w:tbl>`;
}

async function emitDocxAndPdf(
  bodyParts: string[],
  outPath: string,
  outputFormat: "docx" | "pdf" | "both"
): Promise<{ docx_path?: string; pdf_path?: string }> {
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyParts.join("\n")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1418"/></w:sectPr></w:body>
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
    docx_path: resolved.isExclusivePdf ? undefined : resolved.docxPath,
    pdf_path: pdfOut,
  };
}

export async function compileBiddingArtifacts(
  dossier: BiddingProposalDossier,
  outDir: string,
  mode?: string,
  outputFormat: "docx" | "pdf" | "both" = "both"
): Promise<BiddingProposalDossier["compiled_artifacts"] | undefined> {
  const norm = (mode || "NONE").toUpperCase();
  if (norm === "NONE" || !norm) return undefined;

  const artifacts: NonNullable<BiddingProposalDossier["compiled_artifacts"]> = {};
  const wantJudgment = norm === "PROPOSAL_JUDGMENT_OPINION" || norm === "JUDGMENT_OPINION" || norm === "BOTH";
  const wantDiligence = norm === "ACT_DILIGENCE_LETTER" || norm === "ACT_DILIGENCE_REPORT" || norm === "BOTH";

  if (wantJudgment) {
    const parts: string[] = [
      pHeading(`PARECER TÉCNICO DE JULGAMENTO DE PROPOSTA E HABILITAÇÃO EM TIC — ${dossier.process_id}`, 1),
      pBody(`Licitante: ${dossier.bidder_name} (CNPJ: ${dossier.bidder_cnpj}) | Regime: ${dossier.legal_regime} | Decisão: ${dossier.decision}`, true),
      pHeading("1. Modelo de Execução TIC (Não-DEMO) e Exequibilidade (Súmula TCU 262 / 269)", 2),
      buildTableXml(
        ["Métrica", "Não-DEMO", "Piso Paramétrico", "Ofertado", "Exequível"],
        [[
          dossier.ict_execution.metric_type,
          dossier.ict_execution.non_demo_legitimacy_verified ? "SIM" : "NÃO (ALERTA DEMO)",
          String(dossier.ict_execution.parametric_floor_value),
          String(dossier.ict_execution.offered_unit_value ?? "N/A"),
          dossier.ict_execution.is_exequible ? "SIM" : "DILIGÊNCIA OBRIGATÓRIA",
        ]]
      ),
      pHeading("2. Qualificação Técnica (Conversibilidade) e Econômico-Financeira", 2),
      buildTableXml(
        ["ILG", "ILC", "ISG", "EG", "Qtd Convertida ACT"],
        [[
          String(dossier.qualification.financial_indices.ilg ?? "N/A"),
          String(dossier.qualification.financial_indices.ilc ?? "N/A"),
          String(dossier.qualification.financial_indices.isg ?? "N/A"),
          String(dossier.qualification.financial_indices.eg ?? "N/A"),
          String(dossier.qualification.converted_total_quantity),
        ]]
      ),
      pHeading("3. Apontamentos e Tags de Bloqueio", 2),
      ...(dossier.blocking_tags.length > 0
        ? dossier.blocking_tags.map((t) => pBody(`• ${t}`))
        : [pBody("Nenhum óbice normativo ou forense identificado.")]),
    ];
    const res = await emitDocxAndPdf(
      parts,
      join(outDir, "Parecer_Julgamento_Proposta_Habilitacao_e_Diligencia.docx"),
      outputFormat
    );
    artifacts.judgment_opinion_docx_path = res.docx_path;
    artifacts.judgment_opinion_pdf_path = res.pdf_path;
  }

  if (wantDiligence) {
    const actRows = dossier.act_forensics.items.map((a) => [
      a.certificate_id,
      `${a.issuer_name} (${a.issuer_cnpj})`,
      a.triggered_vectors.join(", ") || "NENHUM",
      a.blocking_tags.join(" ") || "CONFORME",
    ]);
    const parts: string[] = [
      pHeading(`OFÍCIO E E-MAIL DE DILIGÊNCIA INVESTIGATIVA DE VERACIDADE DE ACT — ${dossier.process_id}`, 1),
      pBody(`Fundamentação: Art. 64 da Lei nº 14.133/2021, Art. 56, § 2º da Lei nº 13.303/2016 e Acórdãos TCU 1.385/2016 e 1.211/2021-Plenário.`, true),
      pHeading("Quadro Forense dos Atestados Auditados", 2),
      buildTableXml(
        ["Atestado", "Emissor / CNPJ", "Vetores Acionados", "Tags de Bloqueio"],
        actRows.length > 0 ? actRows : [["N/A", "N/A", "N/A", "SEM ATESTADOS"]]
      ),
      pHeading("VIA A — Diligência Direta ao Emissor do ACT (Contatos Oficiais Receita Federal)", 2),
      pBody("Encaminha-se o presente Ofício/E-mail de confirmação de autenticidade ao Emissor constante dos registros oficiais da Receita Federal do Brasil (RFB), solicitando confirmação formal da emissão do Atestado de Capacidade Técnica, período de execução, objeto e volume faturado."),
      pHeading("VIA B — Intimação à Licitante para Lastro Material Obrigatório", 2),
      pBody(`Intima-se a licitante ${dossier.bidder_name} a apresentar, em prazo improrrogável de diligência, o lastro material comprobatório integral: Notas Fiscais Eletrônicas (NF-e / NFS-e com chave de acesso de 44 dígitos), Contrato original assinado à época, respectivas Ordens de Serviço (OS) e comprovantes de recolhimento trabalhista/previdenciário (SEFIP / eSocial) ou extratos bancários vinculados.`),
    ];
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
