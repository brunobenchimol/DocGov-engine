import type {
  AuditFinding,
  RiskItem,
  ComplianceChecklistItem,
} from "../../types/index.ts";
export const VULNERABILITY_ENUM_LABELS: Record<string, string> = {
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

export function escapeXml(value: unknown): string {
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

export function formatReadableGlobalStatus(
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

export function resolveFindingSeverityInfo(ap: AuditFinding): {
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

export function resolveFindingTitle(ap: AuditFinding): string {
  const rawTitle =
    ap.titulo_apontamento ??
    ap.titulo ??
    ap.vulnerabilidade ??
    ap.achado ??
    ap.descricao ??
    "Apontamento de Conformidade e Controle";
  return cleanHumanText(rawTitle) || "Apontamento de Conformidade e Controle";
}

export function resolveFindingExcerpts(
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

export function renderRunsWithInlineBoldXml(
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

export function renderMultiLineParagraphsXml(
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

export function renderLabelValueParagraphXml(
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


export function renderRiskCardXml(risk: RiskItem, index: number): string {
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

export function renderComplianceItemCardXml(item: ComplianceChecklistItem, index: number): string {
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
