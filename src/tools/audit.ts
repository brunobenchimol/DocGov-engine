import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { safeReadJsonFile } from "../utils/json.ts";
import {
  createAuditReportContractError,
  createRiskMatrixContractError,
  createComplianceChecklistContractError,
} from "../contracts/errors.ts";
import {
  convertDocxToPdf,
  resolveOutputPaths,
  safeUnlink,
} from "../utils/pdf_exporter.ts";
import { sanitizeXmlString } from "../utils/xml.ts";
import { generateTechnicalNoteDocx } from "./technical_note.ts";
import { VERSION } from "../constants/index.ts";
import type {
  AuditReportData,
  AuditFinding,
  AuditDocumentType,
  RiskItem,
  ComplianceChecklistItem,
  GenerateAuditDocxOptions,
  GenerateAuditDocxSyntheticResult,
} from "../types/index.ts";

// ============================================================================
// 3b. Geração Nativa de Relatório de Auditoria em Word (generate_audit_docx)
// ============================================================================

const VULNERABILITY_ENUM_LABELS: Record<string, string> = {
  V1_SINGULARIDADE:
    "Singularidade de Mercado / Especificação Proprietária",
  V2_EQUIVALENCIA: "Salvaguarda de Equivalência Técnica",
  V3_METRICA_HIPERESPECIFICA: "Métricas e Parâmetros de Desempenho",
  V4_HABILITACAO_ART67: "Critérios de Habilitação Técnica (Art. 67)",
  V5_FALSA_PLURALIDADE:
    "Levantamento de Mercado e Parcelamento do Objeto",
  V6_RESIDUO_TRANSPOSICAO:
    "Consistência Institucional do Órgão Destino",
};

function escapeXml(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function cleanHumanText(input: unknown): string {
  if (input === null || input === undefined) return "";
  let text = String(input);

  // 1. Remove todas as crases Markdown literais (`)
  text = text.replace(/`/g, "");

  // 2. Remove coordenadas técnicas de máquina ([T0:R30:C1], [T0:R30], [P034], etc.)
  text = text.replace(
    /\[\s*(?:T\d+\s*:\s*R\d+(?:\s*:\s*C\d+)?|P\d+)\s*\]\s*[-–—:]?\s*/gi,
    ""
  );
  text = text.replace(
    /\(\s*(?:T\d+\s*:\s*R\d+(?:\s*:\s*C\d+)?|P\d+)\s*\)\s*/gi,
    ""
  );

  // 3. Converte códigos de enum conhecidos (V1..V6) em títulos humanos legíveis
  for (const [code, humanLabel] of Object.entries(VULNERABILITY_ENUM_LABELS)) {
    const regex = new RegExp(`\\b${code}\\b\\s*[-–—:]?\\s*`, "gi");
    text = text.replace(regex, (match, offset, fullStr) => {
      const rest = fullStr.slice(offset + match.length).trim();
      return rest.length > 0 ? `${humanLabel} — ` : humanLabel;
    });
  }

  // Converte eventuais outros códigos V<num>_<CODIGO_MAIUSCULO> remanescentes
  text = text.replace(/\bV\d+_[A-Z0-9_]+\b/g, (code) => {
    const mapped = VULNERABILITY_ENUM_LABELS[code.toUpperCase()];
    if (mapped) return mapped;
    return code
      .replace(/^V\d+_/i, "")
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  });

  // 4. Simplifica caminhos de diretórios mantendo apenas o nome do arquivo
  text = text.replace(
    /(?:[A-Za-z]:[\\/]|(?:\.{0,2}[\\/])?(?:[\w.-]+[\\/])+)([\w.-]+\.(?:docx|json|pdf|md|txt|xlsx))\b/gi,
    "$1"
  );

  // 5. Normaliza espaços múltiplos na mesma linha preservando quebras \n
  text = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .join("\n")
    .trim();

  return text;
}

function formatReadableGlobalStatus(
  rawStatus: unknown,
  bloqueantes: number,
  alertas: number
): string {
  const cleaned = cleanHumanText(rawStatus);
  if (/reprovad|bloqueant|inapt|impr[oó]pri/i.test(cleaned) || bloqueantes > 0) {
    if (/reprovad/i.test(cleaned)) {
      return "REPROVADO — CONTÉM APONTAMENTOS BLOQUEANTES";
    }
  }
  if (/alerta|ressalva|aten[cç][aã]o|condicionad/i.test(cleaned)) {
    return "APTO COM ALERTAS PREVENTIVOS";
  }
  if (/apto|aprovad|conform/i.test(cleaned)) {
    return alertas > 0
      ? "APTO COM ALERTAS PREVENTIVOS"
      : "APTO PARA PUBLICAÇÃO";
  }
  if (bloqueantes > 0) {
    return "REPROVADO — CONTÉM APONTAMENTOS BLOQUEANTES";
  }
  if (alertas > 0) {
    return "APTO COM ALERTAS PREVENTIVOS";
  }
  return cleaned || "APTO PARA PUBLICAÇÃO";
}

function resolveFindingSeverityInfo(ap: AuditFinding): {
  label: string;
  color: string;
  bgFill: string;
} {
  const rawSev = String(
    ap.severidade ?? ap.status ?? ap.gravidade ?? ap.criticidade ?? ""
  );
  if (/bloqueante|cr[ií]tic|alta|grave|reprovad/i.test(rawSev)) {
    return {
      label: "BLOQUEANTE",
      color: "990000",
      bgFill: "FDECEA",
    };
  }
  if (/alerta|m[eé]dia|moderad|ressalva|preventiv/i.test(rawSev)) {
    return {
      label: "ALERTA PREVENTIVO",
      color: "995C00",
      bgFill: "FFF8E1",
    };
  }
  return {
    label: "CONFORME",
    color: "1B5E20",
    bgFill: "E8F5E9",
  };
}

function resolveFindingTitle(ap: AuditFinding): string {
  const rawTitle =
    ap.titulo_apontamento ??
    ap.titulo ??
    ap.vulnerabilidade ??
    ap.achado ??
    ap.descricao ??
    "Apontamento de Conformidade e Controle";
  return cleanHumanText(rawTitle) || "Apontamento de Conformidade e Controle";
}

function resolveFindingExcerpts(
  ap: AuditFinding
): Array<{ secao_legivel: string; texto_transcrito: string }> {
  const result: Array<{ secao_legivel: string; texto_transcrito: string }> = [];

  if (Array.isArray(ap.trechos_documento) && ap.trechos_documento.length > 0) {
    for (const t of ap.trechos_documento) {
      if (!t || typeof t !== "object") continue;
      const secao = cleanHumanText(
        t.secao_legivel ??
          t.secao ??
          t.localizacao ??
          ap.secao_legivel ??
          ap.localizacao ??
          "Seção analisada no documento"
      );
      const texto = cleanHumanText(
        t.texto_transcrito ??
          t.trecho_impugnado ??
          t.trecho ??
          t.texto ??
          ""
      );
      if (secao || texto) {
        result.push({
          secao_legivel: secao || "Seção analisada no documento",
          texto_transcrito:
            texto || "Trecho correspondente identificado na seção indicada.",
        });
      }
    }
  }

  if (result.length === 0) {
    const legacySecao = cleanHumanText(
      ap.secao_legivel ??
        ap.localizacao ??
        ap.secao ??
        "Seção analisada no documento"
    );
    const legacyTexto = cleanHumanText(
      ap.trecho_impugnado ??
        ap.texto_transcrito ??
        ap.trecho ??
        ap.vulnerabilidade ??
        ap.descricao ??
        ""
    );
    if (legacySecao || legacyTexto) {
      result.push({
        secao_legivel: legacySecao || "Seção analisada no documento",
        texto_transcrito:
          legacyTexto ||
          "Trecho correspondente identificado na seção indicada.",
      });
    }
  }

  return result;
}

function renderRunsWithInlineBoldXml(
  text: string,
  options: {
    fontSizeHalfPt?: number;
    color?: string;
    forceBold?: boolean;
    forceItalic?: boolean;
  } = {}
): string {
  const sz = options.fontSizeHalfPt ?? 22;
  const colorXml = options.color ? `<w:color w:val="${options.color}"/>` : "";
  const italicXml = options.forceItalic ? `<w:i/><w:iCs/>` : "";

  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  const runs: string[] = [];

  for (const seg of segments) {
    if (!seg) continue;
    const isMarkdownBold =
      seg.startsWith("**") && seg.endsWith("**") && seg.length > 4;
    const rawSegmentText = isMarkdownBold ? seg.slice(2, -2) : seg;
    const cleanedSegmentText = cleanHumanText(rawSegmentText);
    // Preserva espaço lateral caso o segmento original tivesse espaçamento adjacente ao negrito
    const leadingSpace = /^\s/.test(rawSegmentText) ? " " : "";
    const trailingSpace = /\s$/.test(rawSegmentText) ? " " : "";
    const finalSegText = `${leadingSpace}${cleanedSegmentText}${trailingSpace}`;

    if (!finalSegText) continue;

    const boldXml =
      options.forceBold || isMarkdownBold ? `<w:b/><w:bCs/>` : "";

    runs.push(`<w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${boldXml}${italicXml}${colorXml}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(finalSegText)}</w:t>
    </w:r>`);
  }

  return runs.join("");
}

function renderMultiLineParagraphsXml(
  rawText: unknown,
  options: {
    jc?: "both" | "left" | "center";
    spaceBefore?: number;
    spaceAfter?: number;
    fontSizeHalfPt?: number;
    color?: string;
    forceBold?: boolean;
    forceItalic?: boolean;
  } = {}
): string {
  const cleaned = cleanHumanText(rawText);
  if (!cleaned) return "";

  const jc = options.jc ?? "both";
  const before = options.spaceBefore ?? 0;
  const after = options.spaceAfter ?? 120;

  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines
    .map(
      (line) => `<w:p>
      <w:pPr>
        <w:jc w:val="${jc}"/>
        <w:spacing w:before="${before}" w:after="${after}" w:line="276" w:lineRule="auto"/>
      </w:pPr>
      ${renderRunsWithInlineBoldXml(line, options)}
    </w:p>`
    )
    .join("\n");
}

function renderLabelValueParagraphXml(
  label: string,
  value: unknown
): string {
  const cleanedVal = cleanHumanText(value);
  if (!cleanedVal) return "";
  return `<w:p>
    <w:pPr>
      <w:jc w:val="both"/>
      <w:spacing w:before="40" w:after="80" w:line="276" w:lineRule="auto"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(label)}: </w:t>
    </w:r>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(cleanedVal)}</w:t>
    </w:r>
  </w:p>`;
}


function renderRiskCardXml(risk: RiskItem, index: number): string {
  const numStr = String(index + 1).padStart(2, "0");
  const rawId = risk.id ? cleanHumanText(risk.id) : `RISCO-${numStr}`;
  const evento = cleanHumanText(risk.evento_risco || "Evento de risco não informado.");

  const rawNivel = (risk.nivel_risco || "MÉDIO").toUpperCase();
  let nivelLabel = "MÉDIO";
  let nivelColor = "B45309";
  let bgFill = "FEF3C7";

  if (rawNivel.includes("CRÍTICO") || rawNivel.includes("CRITICO")) {
    nivelLabel = "CRÍTICO";
    nivelColor = "900000";
    bgFill = "FEE2E2";
  } else if (rawNivel.includes("ALTO")) {
    nivelLabel = "ALTO";
    nivelColor = "B22222";
    bgFill = "FEE2E2";
  } else if (rawNivel.includes("BAIXO")) {
    nivelLabel = "BAIXO";
    nivelColor = "15803D";
    bgFill = "DCFCE7";
  }

  const fase = cleanHumanText(risk.fase || "Planejamento / Execução Contratual");
  const probabilidade = cleanHumanText(risk.probabilidade || "Média");
  const impacto = cleanHumanText(risk.impacto || "Médio");
  const alocacao = cleanHumanText(risk.alocacao || "CONTRATADA").toUpperCase();
  const acoesPrev = Array.isArray(risk.acoes_preventivas)
    ? risk.acoes_preventivas.map(cleanHumanText).filter(Boolean).join("; ")
    : cleanHumanText(risk.acoes_preventivas || "Não informadas.");
  const acoesCont = Array.isArray(risk.acoes_contingencia)
    ? risk.acoes_contingencia.map(cleanHumanText).filter(Boolean).join("; ")
    : cleanHumanText(risk.acoes_contingencia || "Não informadas.");
  const resp = cleanHumanText(risk.responsavel || "Fiscal do Contrato / Equipe de Planejamento");

  return `
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:top w:val="single" w:sz="12" w:space="4" w:color="${nivelColor}"/>
          <w:left w:val="single" w:sz="24" w:space="8" w:color="${nivelColor}"/>
          <w:bottom w:val="none"/>
          <w:right w:val="none"/>
        </w:pBdr>
        <w:shd w:val="clear" w:color="auto" w:fill="${bgFill}"/>
        <w:spacing w:before="240" w:after="80"/>
        <w:ind w:left="140" w:right="140"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="${nivelColor}"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(rawId)} — [NÍVEL: ${nivelLabel}] ${escapeXml(evento)}</w:t>
      </w:r>
    </w:p>
    ${renderLabelValueParagraphXml("• Fase da Contratação", fase)}
    ${renderLabelValueParagraphXml("• Probabilidade / Impacto", `${probabilidade} / ${impacto}`)}
    ${renderLabelValueParagraphXml("• Nível de Risco (Severidade)", nivelLabel)}
    ${renderLabelValueParagraphXml("• Alocação do Risco (Lei nº 14.133/2021, Art. 22)", `**${alocacao}**`)}
    ${renderLabelValueParagraphXml("• Ações Preventivas (Mitigação)", acoesPrev)}
    ${renderLabelValueParagraphXml("• Ações de Contingência", acoesCont)}
    ${renderLabelValueParagraphXml("• Responsável pelo Monitoramento", resp)}
  `;
}

function renderComplianceItemCardXml(item: ComplianceChecklistItem, index: number): string {
  const numStr = String(index + 1).padStart(2, "0");
  const rawId = item.id ? cleanHumanText(item.id) : `CHK-${numStr}`;
  const criterio = cleanHumanText(item.item_criterio || "Critério normativo não informado.");

  const rawStatus = (item.status || "CONFORME").toUpperCase();
  let statusLabel = "CONFORME";
  let statusColor = "15803D";
  let bgFill = "DCFCE7";

  if (rawStatus.includes("NÃO CONFORME") || rawStatus.includes("NAO CONFORME")) {
    statusLabel = "NÃO CONFORME";
    statusColor = "900000";
    bgFill = "FEE2E2";
  } else if (rawStatus.includes("PARCIAL")) {
    statusLabel = "PARCIALMENTE CONFORME";
    statusColor = "B45309";
    bgFill = "FEF3C7";
  } else if (
    rawStatus.includes("NÃO APLICÁVEL") ||
    rawStatus.includes("NAO APLICAVEL") ||
    rawStatus.includes("N/A")
  ) {
    statusLabel = "NÃO APLICÁVEL";
    statusColor = "6B7280";
    bgFill = "F3F4F6";
  }

  const baseLegal = cleanHumanText(item.fundamentacao_legal || "Legislação e Jurisprudência Aplicável");
  const evidencia = cleanHumanText(item.evidencia || "Verificação documental nos autos.");
  const recomendacao = cleanHumanText(item.recomendacao || "Sem recomendações adicionais.");

  return `
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:top w:val="single" w:sz="12" w:space="4" w:color="${statusColor}"/>
          <w:left w:val="single" w:sz="24" w:space="8" w:color="${statusColor}"/>
          <w:bottom w:val="none"/>
          <w:right w:val="none"/>
        </w:pBdr>
        <w:shd w:val="clear" w:color="auto" w:fill="${bgFill}"/>
        <w:spacing w:before="240" w:after="80"/>
        <w:ind w:left="140" w:right="140"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="${statusColor}"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(rawId)} — [${statusLabel}] ${escapeXml(criterio)}</w:t>
      </w:r>
    </w:p>
    ${renderLabelValueParagraphXml("• Requisito / Critério Normativo", criterio)}
    ${renderLabelValueParagraphXml("• Status de Conformidade", `**[${statusLabel}]**`)}
    ${renderLabelValueParagraphXml("• Fundamentação Legal / Jurisprudência (TCU/AGU/MGI)", baseLegal)}
    ${renderLabelValueParagraphXml("• Evidência Documental / Coordenadas", evidencia)}
    ${renderLabelValueParagraphXml("• Recomendação de Adequação", recomendacao)}
  `;
}

export async function generateAuditDocx(
  auditJsonPath: string,
  outputPath: string,
  options?: GenerateAuditDocxOptions
): Promise<{
  success: boolean;
  outputPath: string;
  pdf_path?: string;
  document_type?: AuditDocumentType;
  message: string;
}> {
  const resolvedAuditJson = resolve(auditJsonPath);
  const resolvedOutput = resolve(outputPath);

  const outputFormat = options?.outputFormat || "docx";
  if (!["docx", "pdf", "both"].includes(outputFormat)) {
    throw new Error(
      `Formato de saída inválido: '${outputFormat}'. Formatos suportados: 'docx', 'pdf' ou 'both'.`
    );
  }

  if (!existsSync(resolvedAuditJson)) {
    throw new Error(
      `Arquivo JSON de auditoria não encontrado: ${resolvedAuditJson}`
    );
  }

  const raw: AuditReportData =
    safeReadJsonFile<AuditReportData>(resolvedAuditJson);

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      createAuditReportContractError(
        "O arquivo de auditoria deve conter um objeto JSON válido."
      )
    );
  }

  // 1. Detecção do Tipo de Documento (Marco 5.4 & Marco 6.2)
  if (
    raw.document_type === "TECHNICAL_NOTE" ||
    raw.document_type === "EVOLUTION_REPORT" ||
    Array.isArray(raw.quadro_evolucao) ||
    Array.isArray(raw.clausulas_evolucao)
  ) {
    const techRes = await generateTechnicalNoteDocx(raw as any, resolvedOutput, options);
    return {
      success: true,
      outputPath: techRes.outputPath,
      document_type: "TECHNICAL_NOTE",
      ...(techRes.pdf_path ? { pdf_path: techRes.pdf_path } : {}),
      message: techRes.message,
    };
  }

  let documentType: AuditDocumentType = "AUDIT_REPORT";
  if (
    raw.document_type === "RISK_MATRIX" ||
    Array.isArray(raw.matriz_riscos) ||
    Array.isArray(raw.risk_matrix)
  ) {
    documentType = "RISK_MATRIX";
  } else if (
    raw.document_type === "COMPLIANCE_CHECKLIST" ||
    Array.isArray(raw.checklist_conformidade) ||
    Array.isArray(raw.compliance_checklist)
  ) {
    documentType = "COMPLIANCE_CHECKLIST";
  }

  const rawProcesso =
    raw.processo_id ??
    raw.processo ??
    raw.metadados?.processo_id ??
    raw.metadados?.numero_processo;

  if (documentType === "RISK_MATRIX") {
    if (!rawProcesso || typeof rawProcesso !== "string" || !rawProcesso.trim()) {
      throw new Error(
        createRiskMatrixContractError(
          "Campo obrigatório 'processo_id' ausente ou vazio."
        )
      );
    }
  } else if (documentType === "COMPLIANCE_CHECKLIST") {
    if (!rawProcesso || typeof rawProcesso !== "string" || !rawProcesso.trim()) {
      throw new Error(
        createComplianceChecklistContractError(
          "Campo obrigatório 'processo_id' ausente ou vazio."
        )
      );
    }
  } else {
    if (!rawProcesso || typeof rawProcesso !== "string" || !rawProcesso.trim()) {
      throw new Error(
        createAuditReportContractError(
          "Campo obrigatório 'processo_id' ausente ou vazio."
        )
      );
    }
  }

  const processoId = cleanHumanText(rawProcesso);
  const orgaoEntidade = cleanHumanText(
    raw.orgao_entidade ??
      raw.orgao ??
      raw.metadados?.orgao_entidade ??
      ""
  );
  const artefatoAuditado = cleanHumanText(
    raw.artefato_auditado ??
      raw.artefato ??
      raw.documento_auditado ??
      "N/A"
  );
  const regimeJuridico = cleanHumanText(
    raw.regime_juridico ?? raw.metadados?.regime_juridico ?? "Lei Federal nº 14.133/2021"
  );

  let documentXml = "";

  if (documentType === "RISK_MATRIX") {
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

  } else if (documentType === "COMPLIANCE_CHECKLIST") {
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

  } else {
    // 3. Relatório de Auditoria Padrão (AUDIT_REPORT)
    const rawResumo =
      raw.resumo_executivo ??
      raw.parecer_executivo ??
      raw.resumo;

    if (!rawResumo || typeof rawResumo !== "string" || !rawResumo.trim()) {
      throw new Error(
        createAuditReportContractError(
          "Campo obrigatório 'resumo_executivo' ausente ou vazio."
        )
      );
    }

    if (raw.apontamentos !== undefined && !Array.isArray(raw.apontamentos)) {
      throw new Error(
        createAuditReportContractError(
          "O campo 'apontamentos' deve ser uma lista (array) de achados de auditoria."
        )
      );
    }

    if (raw.achados !== undefined && !Array.isArray(raw.achados)) {
      throw new Error(
        createAuditReportContractError(
          "O campo 'achados' deve ser uma lista (array) de achados de auditoria."
        )
      );
    }

    const apontamentosList: AuditFinding[] = Array.isArray(raw.apontamentos)
      ? raw.apontamentos
      : Array.isArray(raw.achados)
        ? raw.achados
        : [];

    const bloqueantes =
      raw.contagem?.bloqueantes ??
      raw.resumo_contagem?.bloqueantes ??
      apontamentosList.filter(
        (a) => resolveFindingSeverityInfo(a).label === "BLOQUEANTE"
      ).length;
    const alertas =
      raw.contagem?.alertas ??
      raw.resumo_contagem?.alertas ??
      apontamentosList.filter(
        (a) => resolveFindingSeverityInfo(a).label === "ALERTA PREVENTIVO"
      ).length;
    const conformes =
      raw.contagem?.conformes ??
      raw.resumo_contagem?.conformes ??
      apontamentosList.filter(
        (a) => resolveFindingSeverityInfo(a).label === "CONFORME"
      ).length;

    const statusGlobalLegivel = formatReadableGlobalStatus(
      raw.status_global ?? raw.status ?? raw.parecer_global,
      bloqueantes,
      alertas
    );
    const diagnosticoGlobalTexto = `${statusGlobalLegivel} (${bloqueantes} Bloqueantes | ${alertas} Alertas | ${conformes} Conformes)`;

    const resumoExecutivo =
      raw.resumo_executivo ??
      raw.parecer_executivo ??
      raw.resumo ??
      "Sem resumo executivo informado.";

    // Construção das Fichas Verticais dos Apontamentos (Seção 3 - ZERO <w:tbl>)
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
        <w:t>PARECER DE AUDITORIA TÉCNICO-JURÍDICA E CONTROLE DE DIRECIONAMENTO</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:iCs/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="4B5563"/></w:rPr>
        <w:t>Auditoria Cega de Conformidade Legal e Competitividade (Controle Externo)</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>1. IDENTIFICAÇÃO E ESCOPO DA AUDITORIA</w:t>
      </w:r>
    </w:p>
    ${renderLabelValueParagraphXml("Processo", processoId)}
    ${orgaoEntidade ? renderLabelValueParagraphXml("Órgão / Entidade", orgaoEntidade) : ""}
    ${renderLabelValueParagraphXml("Documento Auditado", artefatoAuditado)}
    ${regimeJuridico ? renderLabelValueParagraphXml("Regime Jurídico", regimeJuridico) : ""}
    ${renderLabelValueParagraphXml("Diagnóstico Global", diagnosticoGlobalTexto)}
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="280" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>2. PARECER EXECUTIVO DE CONTROLE EXTERNO</w:t>
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
        <w:t>3. DETALHAMENTO INDIVIDUALIZADO DOS APONTAMENTOS (ID POR ID)</w:t>
      </w:r>
    </w:p>
    ${findingsCardsXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  }

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

  const outPaths = resolveOutputPaths(resolvedOutput, outputFormat);
  const outDir = dirname(outPaths.primaryOutputPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const outBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  let pdfPath: string | undefined;
  try {
    writeFileSync(outPaths.docxPath, outBuffer);

    if (outputFormat === "pdf" || outputFormat === "both") {
      const pdfRes = await convertDocxToPdf(outPaths.docxPath, outPaths.pdfPath, {
        timeoutMs: options?.pdfTimeoutMs,
      });
      pdfPath = pdfRes.pdfPath;
    }
  } finally {
    if (outPaths.isExclusivePdf && outPaths.tempDocxPath) {
      await safeUnlink(outPaths.tempDocxPath);
    }
  }

  let docTypeName = "Relatório de Auditoria";
  if (documentType === "RISK_MATRIX") {
    docTypeName = "Matriz de Gerenciamento de Riscos";
  } else if (documentType === "COMPLIANCE_CHECKLIST") {
    docTypeName = "Checklist de Conformidade Normativa";
  }

  let finalMessage: string;
  if (outputFormat === "pdf" && pdfPath) {
    finalMessage = `${docTypeName} (.pdf) gerado com sucesso em: ${pdfPath}`;
  } else if (outputFormat === "both" && pdfPath) {
    finalMessage = `${docTypeName} (.docx e .pdf) gerados com sucesso em: ${outPaths.docxPath} e ${pdfPath}`;
  } else {
    finalMessage = `${docTypeName} (.docx) gerado com sucesso em: ${outPaths.docxPath}`;
  }

  return {
    success: true,
    outputPath: outPaths.primaryOutputPath,
    document_type: documentType,
    ...(pdfPath ? { pdf_path: pdfPath } : {}),
    message: finalMessage,
  };
}

export function formatGenerateAuditDocxSyntheticResult(
  result: {
    outputPath: string;
    message: string;
    pdf_path?: string;
    document_type?: AuditDocumentType;
  },
  baseDir: string = process.cwd()
): GenerateAuditDocxSyntheticResult {
  const relOutput =
    relative(baseDir, result.outputPath).replace(/\\/g, "/") ||
    result.outputPath;
  const relPdf = result.pdf_path
    ? relative(baseDir, result.pdf_path).replace(/\\/g, "/")
    : undefined;

  const docType = result.document_type || "AUDIT_REPORT";
  let nextHint: string;

  if (docType === "RISK_MATRIX") {
    if (relPdf) {
      nextHint = `Ciclo de governança concluído: a matriz de riscos em layout vertical A4 está pronta em PDF (${relPdf}) para revisão e assinatura.`;
    } else {
      nextHint = "Ciclo de governança concluído: a matriz de riscos em layout vertical A4 (zero tabelas) está pronta em output/ para revisão e assinatura.";
    }
  } else if (docType === "COMPLIANCE_CHECKLIST") {
    if (relPdf) {
      nextHint = `Ciclo de controle preventivo concluído: o checklist de conformidade em layout vertical A4 está pronto em PDF (${relPdf}) para revisão e assinatura.`;
    } else {
      nextHint = "Ciclo de controle preventivo concluído: o checklist de conformidade em layout vertical A4 (zero tabelas) está pronto em output/ para revisão e assinatura.";
    }
  } else if (docType === "TECHNICAL_NOTE" || docType === "EVOLUTION_REPORT") {
    if (relPdf) {
      nextHint = `Ciclo de análise comparativa concluído: a nota técnica em layout vertical A4 está pronta em PDF (${relPdf}) para revisão e assinatura.`;
    } else {
      nextHint = `Ciclo de análise comparativa concluído: a nota técnica em layout vertical A4 está pronta em DOCX (${relOutput}) para revisão e assinatura.`;
    }
  } else {
    if (relPdf) {
      if (result.outputPath.endsWith(".pdf")) {
        nextHint = `Ciclo de auditoria concluído: o parecer em layout vertical A4 está pronto em PDF (${relPdf}) para revisão e assinatura.`;
      } else {
        nextHint = `Ciclo de auditoria concluído: o parecer em layout vertical A4 está pronto em PDF (${relPdf}) e DOCX (${relOutput}) para revisão e assinatura.`;
      }
    } else {
      nextHint =
        "Ciclo de auditoria concluído: o parecer em layout vertical A4 (zero tabelas) está pronto em output/ para revisão e assinatura.";
    }
  }

  const payload: GenerateAuditDocxSyntheticResult = {
    status: "success",
    engine_version: VERSION,
    ...(docType !== "AUDIT_REPORT" ? { document_type: docType } : {}),
    outputPath: relOutput,
    ...(relPdf ? { pdf_path: relPdf } : {}),
    message: result.message,
    next_step_hint: nextHint,
  };

  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 900) {
    payload.message = "Documento gerado com sucesso.";
  }

  return payload;
}

export const formatAuditDocxSyntheticResult =
  formatGenerateAuditDocxSyntheticResult;
