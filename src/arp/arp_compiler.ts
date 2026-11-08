// ============================================================================
// Compilador Nativo OpenXML DOCX e PDF: Governança de ARP (Gen5)
// docgov-engine v1.5.0 — src/arp/arp_compiler.ts
// Modos: ARP_ADHESION_GRANT_NOTE e ARP_ADVANTAGE_STUDY
// ============================================================================

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { sanitizeXmlString } from "../utils/xml.ts";
import { convertDocxToPdf, resolveOutputPaths, safeUnlink } from "../utils/pdf_exporter.ts";
import { cleanHumanText } from "../tools/audit.ts";
import { VERSION } from "../constants/index.ts";
import type { ArpGovernDossier } from "./types.ts";

function escapeXml(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildEditorialA4PackageXml(bodyContentXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyContentXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

async function packageDocxZip(documentXml: string): Promise<Buffer> {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const doc = parser.parseFromString(sanitizeXmlString(documentXml), "application/xml");
  const serialized = serializer.serializeToString(doc);

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  zip.folder("_rels")!.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  const wordFolder = zip.folder("word")!;
  wordFolder.file("document.xml", serialized);
  wordFolder.file(
    "styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="1F2937"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
</w:styles>`
  );

  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

function pHeading(text: string, level = 1): string {
  const sz = level === 1 ? "32" : level === 2 ? "26" : "24";
  const spaceBefore = level === 1 ? "360" : "240";
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="${spaceBefore}" w:after="120" w:line="276" w:lineRule="auto"/>
      <w:jc w:val="left"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:color w:val="1E3A8A"/></w:rPr>
      <w:t>${escapeXml(text)}</w:t>
    </w:r>
  </w:p>`;
}

function pBody(text: string, bold = false): string {
  const bTag = bold ? "<w:b/>" : "";
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="60" w:after="100" w:line="276" w:lineRule="auto"/>
      <w:jc w:val="both"/>
    </w:pPr>
    <w:r>
      <w:rPr>${bTag}<w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="1F2937"/></w:rPr>
      <w:t>${escapeXml(cleanHumanText(text))}</w:t>
    </w:r>
  </w:p>`;
}

function pCallout(title: string, message: string, isBlock = false): string {
  const color = isBlock ? "B91C1C" : "15803D";
  return `<w:p>
    <w:pPr>
      <w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="${color}"/></w:pBdr>
      <w:spacing w:before="120" w:after="120" w:line="276" w:lineRule="auto"/>
      <w:ind w:left="240"/>
    </w:pPr>
    <w:r><w:rPr><w:b/><w:color w:val="${color}"/></w:rPr><w:t>${escapeXml(title)}: </w:t></w:r>
    <w:r><w:rPr><w:color w:val="1F2937"/></w:rPr><w:t>${escapeXml(message)}</w:t></w:r>
  </w:p>`;
}

export async function compileArpAdhesionGrantNote(
  dossier: ArpGovernDossier,
  outputPath: string,
  options: { outputFormat?: "docx" | "pdf" | "both" } = {}
): Promise<{ docx_path: string; pdf_path?: string }> {
  const parts: string[] = [];

  parts.push(pHeading("NOTA TÉCNICA DE ANUÊNCIA / INDEFERIMENTO DE ADESÃO A ARP", 1));
  parts.push(pBody(`Instrumento de Registro de Preços: ${dossier.arp_number}`, true));
  parts.push(pBody(`Órgão Gerenciador: ${dossier.compatibility_analysis.manager_sphere} (${dossier.compatibility_analysis.manager_regime})`));
  parts.push(pBody(`Órgão Aderente Solicitante: ${dossier.compatibility_analysis.adherent_sphere} (${dossier.compatibility_analysis.adherent_regime})`));
  parts.push(pBody(`Decisão Determinística da Governança: ${dossier.decision}`, true));

  if (dossier.blocking_tags.length > 0) {
    parts.push(pHeading("1. Apontamentos Críticos e Vedações Legais", 2));
    dossier.blocking_tags.forEach((tag) => {
      parts.push(pCallout("VEDAÇÃO LEGAL", tag, true));
    });
  }

  parts.push(pHeading("2. Extrato do Livro-Razão e Travas Matemáticas (Art. 86 §§ 4º e 5º)", 2));
  parts.push(pBody(`Preservação do Saldo Próprio do Gerenciador/Participantes: INTACTO (${dossier.ledger_summary.preserved_own_balance_intact ? "CONFIRMADO" : "VIOLADO"})`, true));
  parts.push(pBody(`Maior Razão Individual Verificada: ${dossier.ledger_summary.max_individual_ratio_pct}% (Teto Legal: 50%)`));
  parts.push(pBody(`Maior Razão Global Acumulada Verificada: ${dossier.ledger_summary.max_global_ratio_pct}% (Teto Legal: 200%)`));

  dossier.items_ledger.forEach((item) => {
    parts.push(pBody(`• Item ${item.item_id}: Registrado=${item.registered_qty} | Solicitado=${item.requested_qty} (${item.individual_ratio_pct}%) | Acumulado=${item.new_accumulated_carona_adhesions} (${item.global_ratio_pct}%) | Saldo Próprio=${item.own_balance_preserved}`));
  });

  parts.push(pHeading("3. Conclusão e Despacho Decisório", 2));
  if (dossier.decision === "APPROVED") {
    parts.push(pCallout("DESPACHO DE ANUÊNCIA", "Autoriza-se a adesão pleiteada pelo Órgão Não Participante, abatendo-se o quantitativo exclusivamente do saldo global de caronas da ARP.", false));
  } else {
    parts.push(pCallout("DESPACHO DE INDEFERIMENTO", `Indefere-se o pedido de carona em razão da incidência de óbice(s) legal(is): ${dossier.blocking_tags.join(", ")}.`, true));
  }

  const documentXml = buildEditorialA4PackageXml(parts.join("\n"));
  const buffer = await packageDocxZip(documentXml);

  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, buffer);

  let pdfPath: string | undefined;
  const format = options.outputFormat || "both";
  if (format === "pdf" || format === "both") {
    const { pdfPath: pPath } = resolveOutputPaths(resolvedOutput);
    const converted = await convertDocxToPdf(resolvedOutput, pPath);
    if (converted) pdfPath = pPath;
    if (format === "pdf") safeUnlink(resolvedOutput);
  }

  return { docx_path: resolvedOutput, pdf_path: pdfPath };
}

export async function compileArpAdvantageStudy(
  dossier: ArpGovernDossier,
  outputPath: string,
  options: { outputFormat?: "docx" | "pdf" | "both" } = {}
): Promise<{ docx_path: string; pdf_path?: string }> {
  const parts: string[] = [];

  parts.push(pHeading("ESTUDO TÉCNICO DE VANTAJOSIDADE E INSTRUÇÃO DE ADESÃO À ARP", 1));
  parts.push(pBody(`Ata de Registro de Preços Alvo: ${dossier.arp_number}`, true));
  parts.push(pBody(`Órgão Solicitante da Carona: ${dossier.compatibility_analysis.adherent_sphere} (${dossier.compatibility_analysis.adherent_regime})`));
  parts.push(pBody(`Órgão Gerenciador da Ata: ${dossier.compatibility_analysis.manager_sphere} (${dossier.compatibility_analysis.manager_regime})`));

  parts.push(pHeading("1. Justificativa da Necessidade e Identidade do Objeto", 2));
  parts.push(pBody("O presente estudo instrui a solicitação de adesão comprovando a perfeita correspondência técnica entre a necessidade pública do órgão solicitante e os itens registrados na ARP gerenciada."));

  parts.push(pHeading("2. Demonstração da Vantajosidade Econômica e Celeridade", 2));
  parts.push(pBody("A adesão à presente Ata revela-se manifestamente vantajosa sob o aspecto de economicidade e eficiência operacional frente aos custos e prazos de deflagração de certame licitatório próprio."));

  parts.push(pHeading("3. Regularidade de Limites e Conformidade Normativa", 2));
  parts.push(pBody(`Verificação da Trava Individual de 50%: ${dossier.ledger_summary.max_individual_ratio_pct <= 50 ? "CONFORME" : "NÃO CONFORME"}`));
  parts.push(pBody(`Verificação da Trava Global de 200%: ${dossier.ledger_summary.max_global_ratio_pct <= 200 ? "CONFORME" : "NÃO CONFORME"}`));

  if (dossier.blocking_tags.length > 0) {
    parts.push(pHeading("4. Apontamentos Impeditivos", 2));
    dossier.blocking_tags.forEach((tag) => parts.push(pCallout("ÓBICE DETECTADO", tag, true)));
  } else {
    parts.push(pHeading("4. Parecer Conclusivo", 2));
    parts.push(pCallout("PARECER FAVORÁVEL", "Recomenda-se o prosseguimento da contratação via adesão à Ata de Registro de Preços.", false));
  }

  const documentXml = buildEditorialA4PackageXml(parts.join("\n"));
  const buffer = await packageDocxZip(documentXml);

  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, buffer);

  let pdfPath: string | undefined;
  const format = options.outputFormat || "both";
  if (format === "pdf" || format === "both") {
    const { pdfPath: pPath } = resolveOutputPaths(resolvedOutput);
    const converted = await convertDocxToPdf(resolvedOutput, pPath);
    if (converted) pdfPath = pPath;
    if (format === "pdf") safeUnlink(resolvedOutput);
  }

  return { docx_path: resolvedOutput, pdf_path: pdfPath };
}
