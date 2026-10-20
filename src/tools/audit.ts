import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { safeReadJsonFile } from "../utils/json.ts";
import { createAuditReportContractError } from "../contracts/errors.ts";
import { convertDocxToPdf } from "../utils/pdf_exporter.ts";
import { VERSION } from "../constants/index.ts";
import type {
  AuditReportData,
  AuditFinding,
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

export async function generateAuditDocx(
  auditJsonPath: string,
  outputPath: string,
  options?: GenerateAuditDocxOptions
): Promise<{
  success: boolean;
  outputPath: string;
  pdf_path?: string;
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

  const rawProcesso =
    raw.processo_id ??
    raw.processo ??
    raw.metadados?.processo_id ??
    raw.metadados?.numero_processo;

  if (!rawProcesso || typeof rawProcesso !== "string" || !rawProcesso.trim()) {
    throw new Error(
      createAuditReportContractError(
        "Campo obrigatório 'processo_id' ausente ou vazio."
      )
    );
  }

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

  // Nota: metadados_agente nunca é lido nem impresso no relatório humano
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
    raw.regime_juridico ?? raw.metadados?.regime_juridico ?? ""
  );

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
        <w:t>C) Providência / Redação Saneadora Recomendada:</w:t>
      </w:r>
    </w:p>
    ${renderMultiLineParagraphsXml(redacaoSaneadora, { jc: "both", spaceAfter: 120 })}
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="12" w:space="4" w:color="CCCCCC"/>
        </w:pBdr>
        <w:spacing w:before="80" w:after="160"/>
      </w:pPr>
    </w:p>`;
          })
          .join("\n")
      : renderMultiLineParagraphsXml(
          "Nenhuma impropriedade ou vulnerabilidade foi apontada na auditoria do documento.",
          { jc: "both", spaceAfter: 160 }
        );

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Title"/>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="80"/>
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
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="555555"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
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

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const docXml = parser.parseFromString(documentXml, "application/xml");

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

  const outDir = dirname(resolvedOutput);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const outBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  writeFileSync(resolvedOutput, outBuffer);

  let pdfPath: string | undefined;
  if (outputFormat === "pdf" || outputFormat === "both") {
    const targetPdfPath = resolvedOutput.replace(/\.docx$/i, "") + ".pdf";
    const pdfRes = await convertDocxToPdf(resolvedOutput, targetPdfPath, {
      timeoutMs: options?.pdfTimeoutMs,
    });
    pdfPath = pdfRes.pdfPath;
  }

  let finalMessage: string;
  if (outputFormat === "pdf" && pdfPath) {
    finalMessage = `Relatório de Auditoria (.pdf) gerado com sucesso em: ${pdfPath}`;
  } else if (outputFormat === "both" && pdfPath) {
    finalMessage = `Relatórios de Auditoria (.docx e .pdf) gerados com sucesso em: ${resolvedOutput} e ${pdfPath}`;
  } else {
    finalMessage = `Relatório de Auditoria (.docx) gerado com sucesso em: ${resolvedOutput}`;
  }

  return {
    success: true,
    outputPath: resolvedOutput,
    ...(pdfPath ? { pdf_path: pdfPath } : {}),
    message: finalMessage,
  };
}

export function formatGenerateAuditDocxSyntheticResult(
  result: { outputPath: string; message: string; pdf_path?: string },
  baseDir: string = process.cwd()
): GenerateAuditDocxSyntheticResult {
  const relOutput =
    relative(baseDir, result.outputPath).replace(/\\/g, "/") ||
    result.outputPath;
  const relPdf = result.pdf_path
    ? relative(baseDir, result.pdf_path).replace(/\\/g, "/")
    : undefined;

  let nextHint: string;
  if (relPdf) {
    nextHint = `Ciclo de auditoria concluído: o parecer em layout vertical A4 está pronto em PDF (${relPdf}) e DOCX (${relOutput}) para revisão e assinatura.`;
  } else {
    nextHint =
      "Ciclo de auditoria concluído: o parecer em layout vertical A4 (zero tabelas) está pronto em output/ para revisão e assinatura.";
  }

  const payload: GenerateAuditDocxSyntheticResult = {
    status: "success",
    engine_version: VERSION,
    outputPath: relOutput,
    ...(relPdf ? { pdf_path: relPdf } : {}),
    message: result.message,
    next_step_hint: nextHint,
  };

  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 1000) {
    payload.message = "Relatório de Auditoria gerado com sucesso.";
  }

  return payload;
}

export const formatAuditDocxSyntheticResult =
  formatGenerateAuditDocxSyntheticResult;

