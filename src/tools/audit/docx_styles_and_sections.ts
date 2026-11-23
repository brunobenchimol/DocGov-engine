import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import {
  createRiskMatrixContractError,
  createComplianceChecklistContractError,
} from "../../contracts/errors.ts";
import { sanitizeXmlString } from "../../utils/xml.ts";
import type {
  AuditReportData,
  AuditFinding,
  RiskItem,
  ComplianceChecklistItem,
} from "../../types/index.ts";
import {
  escapeXml,
  cleanHumanText,
  resolveFindingSeverityInfo,
  resolveFindingTitle,
  resolveFindingExcerpts,
  renderMultiLineParagraphsXml,
  renderLabelValueParagraphXml,
  renderRiskCardXml,
  renderComplianceItemCardXml,
} from "./finding_formatters_and_cards.ts";

export interface AuditSectionHeaderContext {
  processoId: string;
  orgaoEntidade: string;
  artefatoAuditado: string;
  regimeJuridico: string;
}

export function buildRiskMatrixDocumentXml(
  raw: AuditReportData,
  ctx: AuditSectionHeaderContext
): string {
  const { processoId, orgaoEntidade, artefatoAuditado, regimeJuridico } = ctx;
  let documentXml = "";
    const riskList: RiskItem[] = Array.isArray(raw.matriz_riscos)
      ? raw.matriz_riscos
      : Array.isArray(raw.risk_matrix)
        ? raw.risk_matrix
        : [];

    if (riskList.length === 0) {
      throw new Error(
        createRiskMatrixContractError(
          "O campo 'matriz_riscos' (ou 'risk_matrix') deve conter ao menos 1 item de risco."
        )
      );
    }

    for (let i = 0; i < riskList.length; i++) {
      const r = riskList[i];
      if (!r || typeof r !== "object" || !r.evento_risco || !cleanHumanText(r.evento_risco)) {
        throw new Error(
          createRiskMatrixContractError(
            `O item de risco ${i + 1} deve conter o campo 'evento_risco' preenchido.`
          )
        );
      }
    }

    const resumoExecutivo =
      raw.resumo_executivo ??
      raw.parecer_executivo ??
      raw.resumo ??
      "Matriz de Gerenciamento de Riscos elaborada em conformidade com o Art. 18, X e Art. 22 da Lei Federal nº 14.133/2021.";

    const criticos = riskList.filter((r) =>
      (r.nivel_risco || "").toUpperCase().includes("CRITIC")
    ).length;
    const altos = riskList.filter((r) =>
      (r.nivel_risco || "").toUpperCase().includes("ALTO")
    ).length;
    const medios = riskList.filter(
      (r) =>
        (r.nivel_risco || "").toUpperCase().includes("MED") ||
        (r.nivel_risco || "").toUpperCase().includes("MÉD")
    ).length;
    const baixos = riskList.filter((r) =>
      (r.nivel_risco || "").toUpperCase().includes("BAIXO")
    ).length;

    const diagnosticoTexto = `${criticos} Críticos | ${altos} Altos | ${medios} Médios | ${baixos} Baixos (Total: ${riskList.length} riscos mapeados)`;
    const riskCardsXml = riskList.map((r, idx) => renderRiskCardXml(r, idx)).join("");

    documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Title"/>
        <w:spacing w:before="120" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
        <w:t>MATRIZ DE GERENCIAMENTO DE RISCOS</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:iCs/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="4B5563"/></w:rPr>
        <w:t>Alocação Contratual e Governança Preventiva (Lei nº 14.133/2021, Art. 18, X e Art. 22)</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>1. IDENTIFICAÇÃO E ESCOPO DA CONTRATAÇÃO</w:t>
      </w:r>
    </w:p>
    ${renderLabelValueParagraphXml("Processo", processoId)}
    ${orgaoEntidade ? renderLabelValueParagraphXml("Órgão / Entidade", orgaoEntidade) : ""}
    ${renderLabelValueParagraphXml("Documento Vinculado", artefatoAuditado)}
    ${renderLabelValueParagraphXml("Regime Jurídico", regimeJuridico)}
    ${renderLabelValueParagraphXml("Diagnóstico Geral de Riscos", diagnosticoTexto)}
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="280" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>2. DIRETRIZES METODOLÓGICAS E MAPA DE SEVERIDADE</w:t>
      </w:r>
    </w:p>
    ${renderMultiLineParagraphsXml(resumoExecutivo, { jc: "both", spaceAfter: 140 })}
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="280" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>3. MATRIZ DETALHADA DE RISCOS E ALOCAÇÃO CONTRATUAL</w:t>
      </w:r>
    </w:p>
    ${riskCardsXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  return documentXml;
}

export function buildComplianceChecklistDocumentXml(
  raw: AuditReportData,
  ctx: AuditSectionHeaderContext
): string {
  const { processoId, orgaoEntidade, artefatoAuditado, regimeJuridico } = ctx;
  let documentXml = "";
    const checkList: ComplianceChecklistItem[] = Array.isArray(raw.checklist_conformidade)
      ? raw.checklist_conformidade
      : Array.isArray(raw.compliance_checklist)
        ? raw.compliance_checklist
        : [];

    if (checkList.length === 0) {
      throw new Error(
        createComplianceChecklistContractError(
          "O campo 'checklist_conformidade' (ou 'compliance_checklist') deve conter ao menos 1 item."
        )
      );
    }

    for (let i = 0; i < checkList.length; i++) {
      const c = checkList[i];
      if (
        !c ||
        typeof c !== "object" ||
        !c.item_criterio ||
        !cleanHumanText(c.item_criterio) ||
        !c.status ||
        !cleanHumanText(c.status)
      ) {
        throw new Error(
          createComplianceChecklistContractError(
            `O item de conformidade ${i + 1} deve conter os campos 'item_criterio' e 'status' preenchidos.`
          )
        );
      }
    }

    const resumoExecutivo =
      raw.resumo_executivo ??
      raw.parecer_executivo ??
      raw.resumo ??
      "Checklist de Avaliação de Conformidade Normativa Preventiva com base na jurisprudência do TCU e diretrizes da AGU e MGI.";

    const conformes = checkList.filter(
      (c) => (c.status || "").toUpperCase() === "CONFORME"
    ).length;
    const naoConformes = checkList.filter(
      (c) =>
        (c.status || "").toUpperCase().includes("NÃO CONFORME") ||
        (c.status || "").toUpperCase().includes("NAO CONFORME")
    ).length;
    const parciais = checkList.filter((c) =>
      (c.status || "").toUpperCase().includes("PARCIAL")
    ).length;
    const naoAplicaveis = checkList.filter(
      (c) =>
        (c.status || "").toUpperCase().includes("APLIC") ||
        (c.status || "").toUpperCase().includes("N/A")
    ).length;

    const diagnosticoTexto = `${conformes} Conformes | ${naoConformes} Não Conformes | ${parciais} Parcialmente Conformes | ${naoAplicaveis} Não Aplicáveis (Total: ${checkList.length} itens)`;
    const checklistCardsXml = checkList
      .map((c, idx) => renderComplianceItemCardXml(c, idx))
      .join("");

    documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Title"/>
        <w:spacing w:before="120" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
        <w:t>CHECKLIST DE CONFORMIDADE NORMATIVA</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:iCs/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="4B5563"/></w:rPr>
        <w:t>Controle Preventivo e Alinhamento aos Padrões TCU, AGU e MGI</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>1. IDENTIFICAÇÃO DO PROCESSO LICITATÓRIO</w:t>
      </w:r>
    </w:p>
    ${renderLabelValueParagraphXml("Processo", processoId)}
    ${orgaoEntidade ? renderLabelValueParagraphXml("Órgão / Entidade", orgaoEntidade) : ""}
    ${renderLabelValueParagraphXml("Documento Auditado", artefatoAuditado)}
    ${renderLabelValueParagraphXml("Regime Jurídico", regimeJuridico)}
    ${renderLabelValueParagraphXml("Balanço de Conformidade", diagnosticoTexto)}
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="280" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>2. PARECER EXECUTIVO DE CONFORMIDADE</w:t>
      </w:r>
    </w:p>
    ${renderMultiLineParagraphsXml(resumoExecutivo, { jc: "both", spaceAfter: 140 })}
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="280" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>3. VERIFICAÇÃO INDIVIDUALIZADA DOS REQUISITOS NORMATIVOS</w:t>
      </w:r>
    </w:p>
    ${checklistCardsXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  return documentXml;
}

export function renderAuditFindingCardsXml(apontamentosList: AuditFinding[]): string {
    const findingsCardsXml =
      apontamentosList.length > 0
        ? apontamentosList
            .map((ap, idx) => {
              const id = cleanHumanText(ap.id ?? ap.codigo ?? `AUD-0${idx + 1}`);
              const sev = resolveFindingSeverityInfo(ap);
              const titulo = resolveFindingTitle(ap);
              const baseLegal = cleanHumanText(
                ap.base_legal ??
                  ap.fundamentacao_legal ??
                  ap.norma ??
                  "Lei Federal nº 14.133/2021"
              );
              const excerpts = resolveFindingExcerpts(ap);
              const analiseControleExterno =
                ap.risco_controle_externo ??
                ap.analise_risco ??
                ap.risco ??
                "Análise de controle externo não informada.";
              const redacaoSaneadora =
                ap.redacao_saneadora_sugerida ??
                ap.redacao_saneadora ??
                ap.recomendacao ??
                ap.acao_corretiva ??
                "Sem recomendação adicional.";

            const excerptsXml = excerpts
              .map((ex, exIdx) => {
                const trechoNum = exIdx + 1;
                return `
    <w:p>
      <w:pPr>
        <w:jc w:val="both"/>
        <w:spacing w:before="80" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:i/><w:iCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(`• Trecho ${trechoNum} — Localização no documento: ${ex.secao_legivel}`)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:left w:val="single" w:sz="18" w:space="12" w:color="888888"/>
        </w:pBdr>
        <w:ind w:left="720" w:right="360"/>
        <w:jc w:val="both"/>
        <w:spacing w:before="40" w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:iCs/><w:color w:val="333333"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(`"«${ex.texto_transcrito}»"`)}</w:t>
      </w:r>
    </w:p>`;
              })
              .join("\n");

            return `
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:left w:val="single" w:sz="24" w:space="8" w:color="${sev.color}"/>
        </w:pBdr>
        <w:shd w:val="clear" w:color="auto" w:fill="${sev.bgFill}"/>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:color w:val="${sev.color}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(`[${id}] ${sev.label} — ${titulo}`)}</w:t>
      </w:r>
    </w:p>
    ${renderLabelValueParagraphXml("Fundamentação Legal e Normativa", baseLegal)}
    <w:p>
      <w:pPr>
        <w:spacing w:before="120" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
        <w:t>A) Trecho(s) Analisado(s) no Documento Auditado:</w:t>
      </w:r>
    </w:p>
    ${excerptsXml}
    <w:p>
      <w:pPr>
        <w:spacing w:before="120" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
        <w:t>B) Análise Crítica de Controle Externo (Risco de Impugnação / Órgão de Controle):</w:t>
      </w:r>
    </w:p>
    ${renderMultiLineParagraphsXml(analiseControleExterno, { jc: "both", spaceAfter: 120 })}
    <w:p>
      <w:pPr>
        <w:spacing w:before="120" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
        <w:t>C) Recomendação de Redação Saneadora Preventiva:</w:t>
      </w:r>
    </w:p>
    ${renderMultiLineParagraphsXml(redacaoSaneadora, { jc: "both", spaceAfter: 180 })}`;
            })
            .join("")
        : `
      <w:p>
        <w:pPr><w:jc w:val="both"/><w:spacing w:before="120" w:after="120"/></w:pPr>
        <w:r>
          <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:iCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
          <w:t>Nenhum apontamento bloqueante ou alerta registrado nesta auditoria.</w:t>
        </w:r>
      </w:p>`;
  return findingsCardsXml;
}

export async function packageAuditDocxBuffer(documentXml: string): Promise<Buffer> {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const docXml = parser.parseFromString(
    sanitizeXmlString(documentXml),
    "application/xml"
  );

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

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:jc w:val="both"/></w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:sz w:val="22"/>
      <w:szCs w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
</w:styles>`
  );

  zip.file("word/document.xml", serializer.serializeToString(docXml));

  return await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
}
