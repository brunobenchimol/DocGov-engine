// ============================================================================
// Compilador Tático OpenXML (docgov-engine v1.4.0)
// Geração Editorial A4 Vertical de Contrarrazões (DEFENSE) e Impugnação (ATTACK)
// ============================================================================

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { sanitizeXmlString } from "../../utils/xml.ts";
import { convertDocxToPdf, resolveOutputPaths, safeUnlink } from "../../utils/pdf_exporter.ts";
import { cleanHumanText } from "../audit.ts";
import { VERSION } from "../../constants/index.ts";

export interface TacticalDefenseInput {
  processo_id?: string;
  orgao_entidade?: string;
  objeto?: string;
  parecer_juridico_ref?: string;
  regime_juridico?: string;
  apontamentos_respondidos: Array<{
    id: string;
    item_edital?: string;
    apontamento_juridico: string;
    fundamentacao_tecnica: string;
    distinguishing_normativo?: string;
    precedentes_tcu: string[];
  }>;
  acordaos_autenticados?: Array<{
    id: string;
    tese: string;
    analise_unidade_tecnica?: string;
    ratio_decidendi?: string;
    dispositivo: string;
  }>;
  conclusao?: string;
  responsavel?: string;
}

export interface TacticalAttackInput {
  certame_id?: string;
  orgao_promotor?: string;
  objeto?: string;
  regime_juridico?: string;
  clausulas_impugnadas: Array<{
    zona_id: string; // ex: Z1, Z4
    item_edital: string;
    redacao_clausula: string;
    ilegalidade_apontada: string;
    dispositivo_violado: string;
    precedentes_condenatorios: string[];
  }>;
  pedidos_cautelares?: string[];
  conclusao?: string;
  representante?: string;
}

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

/**
 * Compila a Nota Técnica de Contrarrazões Jurídicas (Modo DEFENSE).
 * Zero tabelas (<w:tbl>), estritamente blocos verticais A4 editorial.
 */
export async function compileDefenseCounterReasoningDocx(
  data: TacticalDefenseInput,
  outputPath: string,
  options: { outputFormat?: "docx" | "pdf" | "both" } = {}
): Promise<{ outputPath: string; pdf_path?: string; message: string }> {
  const outPaths = resolveOutputPaths(outputPath, options.outputFormat);
  const outDir = dirname(outPaths.primaryOutputPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const regime = data.regime_juridico || "Lei Federal nº 13.303/2016 (Lei das Estatais)";
  const orgao = data.orgao_entidade || "EMPRESA_ESTATAL_DE_TI";
  const processo = data.processo_id || "PROCESSO_ADMINISTRATIVO";

  let body = "";

  // Cabeçalho
  body += `<w:p>
    <w:pPr><w:spacing w:before="120" w:after="80"/><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="1E3A8A"/></w:rPr><w:t>NOTA TÉCNICA DE CONTRARRAZÕES E JUSTIFICATIVAS TÉCNICO-JURÍDICAS</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:spacing w:before="0" w:after="240"/><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:i/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="4B5563"/></w:rPr><w:t>Defesa Prévia e Distinguishing Perante a Assessoria Jurídica / Órgãos de Controle</w:t></w:r>
  </w:p>`;

  // Bloco 1: Identificação
  body += `<w:p>
    <w:pPr><w:pBdr><w:left w:val="single" w:sz="36" w:space="15" w:color="1E3A8A"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F0F4F8"/><w:ind w:left="200" w:right="100"/><w:spacing w:before="120" w:after="80"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="1E3A8A"/></w:rPr><w:t>1. IDENTIFICAÇÃO DO PROCESSO E REGIME JURÍDICO APLICÁVEL</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:ind w:left="200"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Processo:</w:t></w:r><w:r><w:t xml:space="preserve"> ${escapeXml(processo)}</w:t></w:r></w:p>
  <w:p><w:pPr><w:ind w:left="200"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Entidade Contratante:</w:t></w:r><w:r><w:t xml:space="preserve"> ${escapeXml(orgao)}</w:t></w:r></w:p>
  <w:p><w:pPr><w:ind w:left="200"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Regime Normativo:</w:t></w:r><w:r><w:t xml:space="preserve"> ${escapeXml(regime)}</w:t></w:r></w:p>
  <w:p><w:pPr><w:ind w:left="200"/><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Parecer Jurídico Respondido:</w:t></w:r><w:r><w:t xml:space="preserve"> ${escapeXml(data.parecer_juridico_ref || "Apontamentos da Consultoria Jurídica")}</w:t></w:r></w:p>`;

  // Bloco 2: Quadro Sinóptico de Rebate Técnico-Jurídico
  body += `<w:p>
    <w:pPr><w:pBdr><w:left w:val="single" w:sz="36" w:space="15" w:color="059669"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="ECFDF5"/><w:ind w:left="200" w:right="100"/><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="059669"/></w:rPr><w:t>2. QUADRO DE REBATE TÉCNICO-JURÍDICO E DISTINGUISHING</w:t></w:r>
  </w:p>`;

  for (const item of data.apontamentos_respondidos || []) {
    body += `<w:p>
      <w:pPr><w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="059669"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F9FAFB"/><w:ind w:left="260" w:right="140"/><w:spacing w:before="120" w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:color w:val="DC2626"/></w:rPr><w:t xml:space="preserve">[Apontamento] ${escapeXml(item.id)}: </w:t></w:r>
      <w:r><w:t>${escapeXml(item.apontamento_juridico)}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:ind w:left="260" w:right="140"/><w:spacing w:before="40" w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:color w:val="059669"/></w:rPr><w:t xml:space="preserve">Fundamentação Técnica e Prática de Mercado: </w:t></w:r>
      <w:r><w:t>${escapeXml(item.fundamentacao_tecnica)}</w:t></w:r>
    </w:p>`;

    if (item.distinguishing_normativo) {
      body += `<w:p>
        <w:pPr><w:ind w:left="260" w:right="140"/><w:spacing w:before="40" w:after="60"/></w:pPr>
        <w:r><w:rPr><w:b/><w:color w:val="1E3A8A"/></w:rPr><w:t xml:space="preserve">Distinguishing Normativo: </w:t></w:r>
        <w:r><w:t>${escapeXml(item.distinguishing_normativo)}</w:t></w:r>
      </w:p>`;
    }
    if (item.precedentes_tcu && item.precedentes_tcu.length > 0) {
      body += `<w:p>
        <w:pPr><w:ind w:left="260" w:right="140"/><w:spacing w:before="40" w:after="120"/></w:pPr>
        <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Precedentes de Suporte TCU/TCE: </w:t></w:r>
        <w:r><w:rPr><w:color w:val="4B5563"/></w:rPr><w:t>${escapeXml(item.precedentes_tcu.join(" • "))}</w:t></w:r>
      </w:p>`;
    }
  }

  // Bloco 3: Transcrição Auditada dos Acórdãos
  if (data.acordaos_autenticados && data.acordaos_autenticados.length > 0) {
    body += `<w:p>
      <w:pPr><w:pBdr><w:left w:val="single" w:sz="36" w:space="15" w:color="4F46E5"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="EEF2FF"/><w:ind w:left="200" w:right="100"/><w:spacing w:before="180" w:after="80"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="4F46E5"/></w:rPr><w:t>3. PRECEDENTES AUTENTICADOS E RATIO DECIDENDI VINCULANTE</w:t></w:r>
    </w:p>`;

    for (const ac of data.acordaos_autenticados) {
      body += `<w:p>
        <w:pPr><w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="4F46E5"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F9FAFB"/><w:ind w:left="260" w:right="140"/><w:spacing w:before="100" w:after="60"/></w:pPr>
        <w:r><w:rPr><w:b/><w:color w:val="4F46E5"/></w:rPr><w:t xml:space="preserve">${escapeXml(ac.id)}: </w:t></w:r>
        <w:r><w:t>${escapeXml(ac.tese)}</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:ind w:left="300" w:right="140"/><w:spacing w:before="40" w:after="100"/></w:pPr>
        <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Dispositivo: </w:t></w:r>
        <w:r><w:t>${escapeXml(ac.dispositivo)}</w:t></w:r>
      </w:p>`;
    }
  }

  // Conclusão
  body += `<w:p>
    <w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>4. CONCLUSÃO E ENCAMINHAMENTO</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:spacing w:before="60" w:after="180"/></w:pPr>
    <w:r><w:t>${escapeXml(data.conclusao || "Diante do exposto, resta plenamente demonstrada a conformidade técnica e jurídica da modelagem proposta, solicitando-se o prosseguimento dos atos do certame.")}</w:t></w:r>
  </w:p>`;

  const docXml = buildEditorialA4PackageXml(body);
  const docxBuffer = await packageDocxZip(docXml);

  const finalDocxTarget = outPaths.isExclusivePdf && outPaths.tempDocxPath
    ? outPaths.tempDocxPath
    : outPaths.docxPath;
  writeFileSync(finalDocxTarget, docxBuffer);

  let pdfPath: string | undefined;
  if (options.outputFormat === "pdf" || options.outputFormat === "both") {
    const pdfRes = await convertDocxToPdf(outPaths.docxPath, outPaths.pdfPath);
    pdfPath = pdfRes.pdfPath;
  }

  if (outPaths.isExclusivePdf && outPaths.tempDocxPath) {
    await safeUnlink(outPaths.tempDocxPath);
  }

  return {
    outputPath: outPaths.primaryOutputPath,
    pdf_path: pdfPath,
    message: `Nota Técnica de Contrarrazões gerada com sucesso em: ${outPaths.primaryOutputPath}`,
  };
}

/**
 * Compila a Peça de Impugnação / Representação com Pedido Cautelar (Modo ATTACK).
 * Zero tabelas (<w:tbl>), estritamente blocos verticais A4 editorial.
 */
export async function compileAttackChallengeDocx(
  data: TacticalAttackInput,
  outputPath: string,
  options: { outputFormat?: "docx" | "pdf" | "both" } = {}
): Promise<{ outputPath: string; pdf_path?: string; message: string }> {
  const outPaths = resolveOutputPaths(outputPath, options.outputFormat);
  const outDir = dirname(outPaths.primaryOutputPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const certame = data.certame_id || "EDITAL_DE_LICITACAO";
  const promotor = data.orgao_promotor || "ORGAO_CONTRATANTE";

  let body = "";

  // Título
  body += `<w:p>
    <w:pPr><w:spacing w:before="120" w:after="80"/><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="991B1B"/></w:rPr><w:t>PEÇA DE IMPUGNAÇÃO / REPRESENTAÇÃO</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:spacing w:before="0" w:after="240"/><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="DC2626"/></w:rPr><w:t>COM PEDIDO DE MEDIDA CAUTELAR DE SUSPENSÃO DO CERTAME</w:t></w:r>
  </w:p>`;

  // Bloco 1: Qualificação
  body += `<w:p>
    <w:pPr><w:pBdr><w:left w:val="single" w:sz="36" w:space="15" w:color="991B1B"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FEF2F2"/><w:ind w:left="200" w:right="100"/><w:spacing w:before="120" w:after="80"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="991B1B"/></w:rPr><w:t>1. DO CERTAME IMPUGNADO E LEGITIMIDADE</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:ind w:left="200"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Processo / Edital:</w:t></w:r><w:r><w:t xml:space="preserve"> ${escapeXml(certame)}</w:t></w:r></w:p>
  <w:p><w:pPr><w:ind w:left="200"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Órgão Promotor:</w:t></w:r><w:r><w:t xml:space="preserve"> ${escapeXml(promotor)}</w:t></w:r></w:p>
  <w:p><w:pPr><w:ind w:left="200"/><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Objeto:</w:t></w:r><w:r><w:t xml:space="preserve"> ${escapeXml(data.objeto || "Contratação de Bens e Serviços de TI")}</w:t></w:r></w:p>`;

  // Bloco 2: Das Ilegalidades nas 14 Zonas
  body += `<w:p>
    <w:pPr><w:pBdr><w:left w:val="single" w:sz="36" w:space="15" w:color="DC2626"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FEF2F2"/><w:ind w:left="200" w:right="100"/><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="DC2626"/></w:rPr><w:t>2. DAS CLÁUSULAS RESTRITIVAS E ILEGALIDADES APONTADAS (RADAR Z1..Z14)</w:t></w:r>
  </w:p>`;

  for (const c of data.clausulas_impugnadas || []) {
    body += `<w:p>
      <w:pPr><w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="DC2626"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F9FAFB"/><w:ind w:left="260" w:right="140"/><w:spacing w:before="100" w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:color w:val="DC2626"/></w:rPr><w:t xml:space="preserve">[${escapeXml(c.zona_id)}] Item ${escapeXml(c.item_edital)}: </w:t></w:r>
      <w:r><w:t>${escapeXml(c.redacao_clausula)}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:ind w:left="260" w:right="140"/><w:spacing w:before="40" w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:color w:val="991B1B"/></w:rPr><w:t xml:space="preserve">Violação Jurídica: </w:t></w:r>
      <w:r><w:t>${escapeXml(c.ilegalidade_apontada)} (Dispositivo violado: ${escapeXml(c.dispositivo_violado)})</w:t></w:r>
    </w:p>`;

    if (c.precedentes_condenatorios && c.precedentes_condenatorios.length > 0) {
      body += `<w:p>
        <w:pPr><w:ind w:left="260" w:right="140"/><w:spacing w:before="40" w:after="120"/></w:pPr>
        <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Precedentes do TCU/TCE Anulando Cláusulas Idênticas: </w:t></w:r>
        <w:r><w:rPr><w:color w:val="4B5563"/></w:rPr><w:t>${escapeXml(c.precedentes_condenatorios.join(" • "))}</w:t></w:r>
      </w:p>`;
    }
  }

  // Bloco 3: Medida Cautelar e Pedidos
  body += `<w:p>
    <w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="991B1B"/></w:rPr><w:t>3. DOS REQUISITOS DA MEDIDA CAUTELAR E DOS PEDIDOS</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:spacing w:before="60" w:after="120"/></w:pPr>
    <w:r><w:t>Restam cabalmente comprovados o Fumus Boni Iuris (manifesta desconformidade com a jurisprudência sumulada) e o Periculum in Mora (iminência da abertura do certame com restrição competitiva).</w:t></w:r>
  </w:p>`;

  for (const pedido of data.pedidos_cautelares || [
    "A concessão liminar de medida cautelar determinando a suspensão imediata do certame;",
    "A determinação ao órgão promotor para republicação saneada do instrumento convocatório.",
  ]) {
    body += `<w:p><w:pPr><w:ind w:left="260"/><w:spacing w:after="60"/></w:pPr><w:r><w:t xml:space="preserve">• ${escapeXml(pedido)}</w:t></w:r></w:p>`;
  }

  const docXml = buildEditorialA4PackageXml(body);
  const docxBuffer = await packageDocxZip(docXml);

  const finalDocxTarget = outPaths.isExclusivePdf && outPaths.tempDocxPath
    ? outPaths.tempDocxPath
    : outPaths.docxPath;
  writeFileSync(finalDocxTarget, docxBuffer);

  let pdfPath: string | undefined;
  if (options.outputFormat === "pdf" || options.outputFormat === "both") {
    const pdfRes = await convertDocxToPdf(outPaths.docxPath, outPaths.pdfPath);
    pdfPath = pdfRes.pdfPath;
  }

  if (outPaths.isExclusivePdf && outPaths.tempDocxPath) {
    await safeUnlink(outPaths.tempDocxPath);
  }

  return {
    outputPath: outPaths.primaryOutputPath,
    pdf_path: pdfPath,
    message: `Peça de Impugnação gerada com sucesso em: ${outPaths.primaryOutputPath}`,
  };
}
