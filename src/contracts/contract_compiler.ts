// ============================================================================
// Compilador Nativo OpenXML DOCX e PDF: PAS, Dosimetria e Glosa ANS (Gen5.5)
// docgov-engine v1.5.5 — src/contracts/contract_compiler.ts
// Modos: PAS_NOTIFICATION, SANCTION_DOSIMETRY_OPINION / DOSIMETRY_OPINION, BOTH
// ============================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { sanitizeXmlString } from "../utils/xml.ts";
import { convertDocxToPdf, resolveOutputPaths, safeUnlink } from "../utils/pdf_exporter.ts";
import { cleanHumanText } from "../tools/audit.ts";
import type { ContractAuditReport } from "./types.ts";

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
<Types xmlns="http://schemas.openxmlformats.org/package/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-officedocument.relationships+xml"/>
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
  const sz = level === 1 ? "30" : "24";
  const spaceBefore = level === 1 ? "320" : "220";
  return `<w:p>
    <w:pPr><w:spacing w:before="${spaceBefore}" w:after="120" w:line="276" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:color w:val="1E3A8A"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r>
  </w:p>`;
}

function pBody(text: string, bold = false): string {
  const bTag = bold ? "<w:b/>" : "";
  return `<w:p>
    <w:pPr><w:spacing w:before="60" w:after="100" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>
    <w:r><w:rPr>${bTag}<w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="1F2937"/></w:rPr><w:t>${escapeXml(cleanHumanText(text))}</w:t></w:r>
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

async function emitCompiledDocument(
  parts: string[],
  outputPath: string,
  outputFormat: "docx" | "pdf" | "both" = "both"
): Promise<{ docx_path?: string; pdf_path?: string }> {
  const documentXml = buildEditorialA4PackageXml(parts.join("\n"));
  const buffer = await packageDocxZip(documentXml);
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, buffer);

  let pdfPath: string | undefined;
  let docxPath: string | undefined = resolvedOutput;
  if (outputFormat === "pdf" || outputFormat === "both") {
    const { pdfPath: targetPdf } = resolveOutputPaths(resolvedOutput, outputFormat);
    const converted = await convertDocxToPdf(resolvedOutput, targetPdf);
    if (converted) pdfPath = converted.pdfPath || targetPdf;
    if (outputFormat === "pdf") {
      safeUnlink(resolvedOutput);
      docxPath = undefined;
    }
  }
  return { docx_path: docxPath, pdf_path: pdfPath };
}

export async function compilePasNotificationDocx(
  report: ContractAuditReport,
  outputPath: string,
  options: { outputFormat?: "docx" | "pdf" | "both" } = {}
): Promise<{ docx_path?: string; pdf_path?: string }> {
  const parts: string[] = [];
  parts.push(pHeading("NOTIFICAÇÃO PRÉVIA DE DESCUMPRIMENTO CONTRATUAL E INSTAURAÇÃO DE PAS", 1));
  parts.push(pBody(`Entidade Contratante: ORGAO_CONTRATANTE | Contrato: ${report.contract_id}`, true));
  parts.push(pBody(`Regime Jurídico: ${report.legal_regime} | Tipo de Objeto: ${report.object_type}`));

  parts.push(pHeading("1. Fatos e Apontamentos Determinísticos Detectados", 2));
  if (report.blocking_tags.length > 0) {
    report.blocking_tags.forEach((tag) => parts.push(pCallout("APONTAMENTO CRÍTICO", tag, true)));
  } else {
    parts.push(pBody("Registro preventivo de ocorrência contratual para apuração formal em Processo Administrativo Sancionador."));
  }

  const pasList = report.pas_sanctions_analysis?.processes || [];
  pasList.forEach((p) => {
    parts.push(pBody(`• Processo ${p.process_id}: Sanção sugerida=${p.recommended_sanction} | Escopo=${p.recommended_scope}${p.justification ? ` | Obs: ${p.justification}` : ""}`));
  });

  parts.push(pHeading("2. Contraditório e Ampla Defesa (Arts. 157 e 158 da Lei nº 14.133/2021)", 2));
  parts.push(pBody("Fica a Contratada formalmente notificada para apresentação de Defesa Prévia / Alegações Finais no prazo legal mínimo de 15 (quinze) dias úteis, assegurado acesso integral aos autos."));

  parts.push(pHeading("3. Comunicação à Seguradora e Garantias (Art. 102)", 2));
  parts.push(pBody("Havendo apólice de Seguro-Garantia vigente, expeça-se comunicação formal concomitante à Seguradora sobre a expectativa de sinistro e abertura do PAS."));

  return emitCompiledDocument(parts, outputPath, options.outputFormat || "both");
}

export async function compileSanctionDosimetryOpinionDocx(
  report: ContractAuditReport,
  outputPath: string,
  options: { outputFormat?: "docx" | "pdf" | "both" } = {}
): Promise<{ docx_path?: string; pdf_path?: string }> {
  const parts: string[] = [];
  parts.push(pHeading("PARECER DE DOSIMETRIA DE SANÇÃO ADMINISTRATIVA OU GLOSA POR ANS/IMR", 1));
  parts.push(pBody(`Contrato Auditado: ${report.contract_id} | Regime: ${report.legal_regime}`, true));
  parts.push(pBody(`Status da Auditoria Determinística: ${report.status.toUpperCase()}`, true));

  parts.push(pHeading("1. Segregação entre Glosa por ANS/IMR e Multa Punitiva", 2));
  const pasList = report.pas_sanctions_analysis?.processes || [];
  if (pasList.length === 0) {
    parts.push(pBody("Nenhum evento de PAS ou glosa por ANS/IMR submetido nesta execução."));
  } else {
    pasList.forEach((p) => {
      parts.push(pBody(`• ${p.process_id}: Recomendação=${p.recommended_sanction} (${p.recommended_scope}) | Multa=${p.fine_pct !== undefined ? `${p.fine_pct}%` : "N/A"} [Faixa ${p.legal_floor_pct}%..${p.legal_ceiling_pct}%] | Glosa ANS=${p.remuneratory_glosa_value !== undefined ? `R$ ${p.remuneratory_glosa_value}` : "N/A"} | Contraditório 15d=${p.contradictory_15_days_ok ? "OK" : "VIOLADO"} | Seguradora=${p.insurer_notification_ok ? "OK" : "PENDENTE"}`));
    });
  }

  const basketItems = report.price_basket_analysis?.items || [];
  if (basketItems.length > 0) {
    parts.push(pHeading("2. Saneamento Estatístico de Cesta de Preços (IN SEGES 65/2021)", 2));
    basketItems.forEach((b) => {
      parts.push(pBody(`• Item ${b.item_id}: Média=${b.mean} | Mediana=${b.median} | Desvio Padrão=${b.std_dev} | CV=${b.cv_pct}% | Média Saneada=${b.sanitized_mean} | Recomendado=${b.recommended_method} (${b.recommended_reference_price})`));
    });
  }

  parts.push(pHeading("3. Conclusão e Enquadramento Jurídico", 2));
  if (report.blocking_tags.length > 0) {
    report.blocking_tags.forEach((tag) => parts.push(pCallout("ÓBICE DETECTADO", tag, true)));
  } else {
    parts.push(pCallout("PARECER CONFORME", "Dosimetria e critérios remuneratórios de ANS/IMR em estrita conformidade legal.", false));
  }

  return emitCompiledDocument(parts, outputPath, options.outputFormat || "both");
}

export async function compileContractExecutionArtifacts(
  report: ContractAuditReport,
  outDir: string,
  mode?: string,
  outputFormat: "docx" | "pdf" | "both" = "both"
): Promise<ContractAuditReport["compiled_artifacts"] | undefined> {
  const normMode = (mode || "NONE").toUpperCase();
  if (normMode === "NONE" || !normMode) return undefined;

  const artifacts: NonNullable<ContractAuditReport["compiled_artifacts"]> = {};
  if (normMode === "PAS_NOTIFICATION" || normMode === "BOTH") {
    const res = await compilePasNotificationDocx(
      report,
      join(outDir, "Notificacao_Previa_Descumprimento_e_PAS.docx"),
      { outputFormat }
    );
    artifacts.pas_notification_docx_path = res.docx_path;
    artifacts.pas_notification_pdf_path = res.pdf_path;
  }

  if (
    normMode === "SANCTION_DOSIMETRY_OPINION" ||
    normMode === "DOSIMETRY_OPINION" ||
    normMode === "BOTH"
  ) {
    const res = await compileSanctionDosimetryOpinionDocx(
      report,
      join(outDir, "Parecer_Dosimetria_Sancao_ou_Glosa_ANS.docx"),
      { outputFormat }
    );
    artifacts.dosimetry_opinion_docx_path = res.docx_path;
    artifacts.dosimetry_opinion_pdf_path = res.pdf_path;
  }

  return Object.keys(artifacts).length > 0 ? artifacts : undefined;
}
