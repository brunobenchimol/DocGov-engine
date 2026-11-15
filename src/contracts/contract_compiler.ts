// ============================================================================
// Compilador Nativo OpenXML DOCX e PDF: PAS, Dosimetria e Glosa ANS (Gen5.6)
// docgov-engine v1.5.6 — src/contracts/contract_compiler.ts
// Modos: PAS_NOTIFICATION, SANCTION_DOSIMETRY_OPINION / DOSIMETRY_OPINION, BOTH
// ============================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { sanitizeXmlString } from "../utils/xml.ts";
import { convertDocxToPdf, resolveOutputPaths, safeUnlink } from "../utils/pdf_exporter.ts";
import { cleanHumanText } from "../tools/audit.ts";
import {
  isLei13303Regime,
  humanizeLegalRegime,
  humanizeShortRegime,
  humanizeObjectType,
  humanizeAuditStatus,
  humanizeContractingEntity,
  humanizeSanctionType,
  humanizeSanctionScope,
  humanizePriceBasketMethod,
  describeBlockingTagLegalProse,
  buildFederativeTableRows,
  buildDosimetryTableRows,
} from "./contract_humanizer.ts";
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
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default ContentType="application/vnd.openxmlformats-package.relationships+xml" Extension="rels"/>
  <Default ContentType="application/xml" Extension="xml"/>
  <Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" PartName="/word/document.xml"/>
  <Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml" PartName="/word/styles.xml"/>
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
  const sz = level === 1 ? "30" : level === 2 ? "24" : "22";
  const spaceBefore = level === 1 ? "320" : level === 2 ? "220" : "180";
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

function pSimpleTable(headers: string[], rows: string[][]): string {
  const cols = Math.max(headers.length, 1);
  const totalWidth = 9072;
  const colWidth = Math.floor(totalWidth / cols);
  const gridCols = Array.from({ length: cols }, () => `<w:gridCol w:w="${colWidth}"/>`).join("");

  const renderRow = (cells: string[], isHeader: boolean): string => {
    const shd = isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/>` : "";
    const bTag = isHeader ? "<w:b/>" : "";
    const txtColor = isHeader ? "1E3A8A" : "1F2937";
    const tcs = Array.from({ length: cols }, (_, idx) => {
      const val = cells[idx] ?? "";
      return `<w:tc>
        <w:tcPr><w:tcW w:w="${colWidth}" w:type="dxa"/>${shd}</w:tcPr>
        <w:p><w:pPr><w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${bTag}<w:sz w:val="19"/><w:szCs w:val="19"/><w:color w:val="${txtColor}"/></w:rPr><w:t>${escapeXml(val)}</w:t></w:r></w:p>
      </w:tc>`;
    }).join("");
    return `<w:tr>${tcs}</w:tr>`;
  };

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${totalWidth}" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${gridCols}</w:tblGrid>
    ${renderRow(headers, true)}
    ${rows.map((r) => renderRow(r, false)).join("\n")}
  </w:tbl>`;
}

function buildFederativeAndDosimetryXmlSections(report: ContractAuditReport): string[] {
  const parts: string[] = [];

  parts.push(pHeading("Quadro de Enquadramento Jurisdicional e Federativo (Remessa CEIS / CNEP / PNCP)", 3));
  parts.push(
    pBody(
      "Enquadramento federativo e jurisdicional quanto ao alcance territorial da sanção, à competência legal da autoridade signatária, à existência de parecer jurídico conclusivo e à remessa obrigatória aos cadastros de controle externo (CEIS, CNEP, PNCP e Corte de Contas competente)."
    )
  );
  parts.push(
    pSimpleTable(
      ["Processo", "Esfera e Regime Jurídico", "Corte Competente", "Alcance Territorial, Autoridade e Parecer", "Cadastros e Controle Externo"],
      buildFederativeTableRows(report)
    )
  );

  parts.push(
    pHeading(
      "Quadro de Calibragem Jurisprudencial da Dosimetria (Art. 156, § 1º da Lei nº 14.133/2021 e Art. 22, §§ 2º e 3º da LINDB)",
      3
    )
  );
  parts.push(
    pBody(
      "Análise de calibragem e proporcionalidade da sanção proposta à luz dos precedentes da Corte de Contas competente e dos vetores previstos no Art. 22, §§ 2º e 3º da LINDB e no Art. 156, § 1º da Lei nº 14.133/2021 (natureza e gravidade da infração, danos comprovados, antecedentes do contratado, atenuantes e agravantes comprovadas)."
    )
  );
  parts.push(
    pSimpleTable(
      ["Processo", "Penalidade Proposta", "Precedentes de Referência", "Faixa / Mediana Referencial", "LINDB Art. 22 e Diagnóstico de Proporcionalidade"],
      buildDosimetryTableRows(report)
    )
  );

  return parts;
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
  const is13303 = isLei13303Regime(report.legal_regime);
  const parts: string[] = [];
  parts.push(
    pHeading(
      "NOTIFICAÇÃO PRÉVIA DE DESCUMPRIMENTO CONTRATUAL E INSTAURAÇÃO DE PROCESSO ADMINISTRATIVO SANCIONADOR (PAS)",
      1
    )
  );
  parts.push(
    pBody(
      `Entidade Contratante: ${humanizeContractingEntity()} | Instrumento Contratual: ${report.contract_id}`,
      true
    )
  );
  parts.push(
    pBody(
      `Regime Jurídico Aplicável: ${humanizeLegalRegime(report.legal_regime)} | Natureza do Objeto: ${humanizeObjectType(report.object_type)}`
    )
  );
  parts.push(pBody(`Situação da Auditoria Técnica: ${humanizeAuditStatus(report.status)}`, true));

  parts.push(pHeading("1. Síntese Fática e Fundamentação Jurídica dos Apontamentos Detectados", 2));
  const pasList = report.pas_sanctions_analysis?.processes || [];
  pasList.forEach((p) => {
    const fineTxt = p.fine_pct !== undefined ? ` com alíquota proposta de ${p.fine_pct}%` : "";
    const obsTxt = p.justification ? ` Síntese da instrução: ${p.justification}.` : "";
    parts.push(
      pBody(
        `• Processo ${p.process_id}: Penalidade enquadrada como ${humanizeSanctionType(p.recommended_sanction)}, com alcance ${humanizeSanctionScope(p.recommended_scope)}${fineTxt}.${obsTxt}`
      )
    );
  });

  if (report.blocking_tags.length > 0) {
    report.blocking_tags.forEach((tag, idx) => {
      const prose = describeBlockingTagLegalProse(tag, idx + 1, is13303);
      parts.push(pCallout(prose.title, prose.body, true));
    });
  } else {
    parts.push(
      pBody(
        "Registro preventivo de ocorrência contratual para apuração formal em Processo Administrativo Sancionador, sem óbices preliminares impeditivos detectados na instrução."
      )
    );
  }

  parts.push(
    pHeading(
      is13303
        ? "2. Garantia ao Contraditório e Ampla Defesa (Arts. 82 a 84 da Lei nº 13.303/2016 e RILC c/c Arts. 157 e 158 da Lei nº 14.133/2021)"
        : "2. Garantia ao Contraditório e Ampla Defesa (Arts. 157 e 158 da Lei nº 14.133/2021)",
      2
    )
  );
  parts.push(
    pBody(
      is13303
        ? "Em observância ao devido processo legal administrativo (Art. 5º, LV da CRFB/88), ao disposto nos Arts. 82 a 84 da Lei Federal nº 13.303/2016 e ao Regulamento Interno de Licitações e Contratos (RILC), em consonância com o parâmetro mínimo de 15 (quinze) dias úteis previsto nos Arts. 157 e 158 da Lei nº 14.133/2021, fica a Contratada formalmente notificada para apresentar Defesa Prévia e produzir provas, assegurado acesso integral aos autos."
        : "Em observância ao devido processo legal administrativo (Art. 5º, LV da CRFB/88) e aos Arts. 157 e 158 da Lei Federal nº 14.133/2021, fica a Contratada formalmente notificada para apresentação de Defesa Prévia e eventuais Alegações Finais no prazo legal mínimo de 15 (quinze) dias úteis, assegurado acesso integral aos autos."
    )
  );

  parts.push(
    pHeading(
      is13303
        ? "3. Comunicação à Seguradora e Execução de Garantias (Art. 70 da Lei nº 13.303/2016 c/c Art. 102 da Lei nº 14.133/2021)"
        : "3. Comunicação à Seguradora e Execução de Garantias (Art. 102 da Lei nº 14.133/2021)",
      2
    )
  );
  parts.push(
    pBody(
      is13303
        ? "Havendo apólice de Seguro-Garantia vigente nos termos do Art. 70 da Lei Federal nº 13.303/2016 (em simetria ao Art. 102 da Lei nº 14.133/2021), expeça-se comunicação formal concomitante à sociedade seguradora sobre a expectativa de sinistro e a instauração do processo apuratório."
        : "Havendo apólice de Seguro-Garantia vigente nos termos do Art. 102 da Lei Federal nº 14.133/2021, expeça-se comunicação formal concomitante à companhia seguradora sobre a expectativa de sinistro e a abertura do Processo Administrativo Sancionador."
    )
  );

  parts.push(pHeading("4. Enquadramento Jurisdicional, Cadastros Obrigatórios e Calibragem da Dosimetria", 2));
  parts.push(...buildFederativeAndDosimetryXmlSections(report));

  return emitCompiledDocument(parts, outputPath, options.outputFormat || "both");
}

export async function compileSanctionDosimetryOpinionDocx(
  report: ContractAuditReport,
  outputPath: string,
  options: { outputFormat?: "docx" | "pdf" | "both" } = {}
): Promise<{ docx_path?: string; pdf_path?: string }> {
  const is13303 = isLei13303Regime(report.legal_regime);
  const parts: string[] = [];
  parts.push(
    pHeading("PARECER TÉCNICO-JURÍDICO DE DOSIMETRIA DE SANÇÃO ADMINISTRATIVA OU GLOSA POR ANS/IMR", 1)
  );
  parts.push(
    pBody(
      `Entidade Contratante: ${humanizeContractingEntity()} | Instrumento Contratual: ${report.contract_id}`,
      true
    )
  );
  parts.push(
    pBody(
      `Regime Jurídico Aplicável: ${humanizeLegalRegime(report.legal_regime)} | Natureza do Objeto: ${humanizeObjectType(report.object_type)}`
    )
  );
  parts.push(pBody(`Conclusão Preliminar da Auditoria: ${humanizeAuditStatus(report.status)}`, true));

  parts.push(
    pHeading("1. Análise de Segregação entre Glosa Remuneratória por ANS/IMR e Penalidade Sancionatória", 2)
  );
  const pasList = report.pas_sanctions_analysis?.processes || [];
  if (pasList.length === 0) {
    parts.push(pBody("Nenhum evento sancionador ou glosa por ANS/IMR foi submetido para exame nesta instrução."));
  } else {
    pasList.forEach((p) => {
      const fineInfo =
        p.fine_pct !== undefined
          ? `Alíquota de multa proposta de ${p.fine_pct}% (limites normativos: piso de ${p.legal_floor_pct}% e teto de ${p.legal_ceiling_pct}%)`
          : "Sem aplicação de multa pecuniária";
      const glosaInfo =
        p.remuneratory_glosa_value !== undefined
          ? ` | Glosa estritamente remuneratória apurada em R$ ${p.remuneratory_glosa_value.toFixed(2)}`
          : "";
      const contradInfo = p.contradictory_15_days_ok
        ? "Contraditório prévio de 15 dias úteis observado"
        : "Contraditório prévio violado (exige regularização)";
      const insurerInfo = p.insurer_notification_ok
        ? "Comunicação à seguradora regular ou dispensável"
        : "Comunicação à seguradora pendente (exige intimação imediata)";
      parts.push(
        pBody(
          `• Processo ${p.process_id}: Sanção indicada como ${humanizeSanctionType(p.recommended_sanction)}, com alcance ${humanizeSanctionScope(p.recommended_scope)}. ${fineInfo}${glosaInfo}. ${contradInfo}; ${insurerInfo}.`
        )
      );
    });
  }

  const basketItems = report.price_basket_analysis?.items || [];
  if (basketItems.length > 0) {
    parts.push(pHeading("1.1. Saneamento Estatístico de Cesta de Preços Referenciais (IN SEGES/ME nº 65/2021)", 3));
    basketItems.forEach((b) => {
      parts.push(
        pBody(
          `• Item ${b.item_id}: Média aritmética simples de ${b.mean}; Mediana amostral de ${b.median}; Desvio padrão de ${b.std_dev} (Coeficiente de Variação de ${b.cv_pct}%); Média saneada após expurgo de ${b.sanitized_mean}. Metodologia tecnicamente indicada: ${humanizePriceBasketMethod(b.recommended_method)}, no valor referencial de R$ ${b.recommended_reference_price}.`
        )
      );
    });
  }

  parts.push(pHeading("2. Enquadramento Jurisdicional e Calibragem da Dosimetria (LINDB Art. 22 e Art. 156)", 2));
  parts.push(...buildFederativeAndDosimetryXmlSections(report));

  parts.push(pHeading("3. Conclusão, Enquadramento Jurídico e Determinações de Saneamento", 2));
  if (report.blocking_tags.length > 0) {
    parts.push(
      pBody(
        `Diante dos elementos analisados sob a égide da ${humanizeShortRegime(report.legal_regime)} e dos parâmetros determinísticos aplicáveis, conclui-se pela existência de óbices impeditivos ao prosseguimento ou à assinatura da sanção nos termos propostos, impondo-se o cumprimento integral das recomendações jurídicas fundamentadas a seguir:`
      )
    );
    report.blocking_tags.forEach((tag, idx) => {
      const prose = describeBlockingTagLegalProse(tag, idx + 1, is13303);
      parts.push(pCallout(prose.title, prose.body, true));
    });
  } else {
    parts.push(
      pCallout(
        "CONCLUSÃO TÉCNICO-JURÍDICA FAVORÁVEL",
        "A dosimetria proposta, a competência da autoridade signatária, o rito de contraditório e os critérios remuneratórios de ANS/IMR encontram-se em estrita conformidade legal, estando o feito apto ao regular prosseguimento.",
        false
      )
    );
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
