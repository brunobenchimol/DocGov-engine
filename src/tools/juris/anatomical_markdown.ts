// ============================================================================
// Renderização Markdown e Corte Limpo do Dossiê Anatômico (docgov-engine v1.7.3)
// ============================================================================

import type { AnatomicalLayers, TopicSectionSlice } from "./types.ts";

export interface CleanTruncationResult {
  text: string;
  truncated: boolean;
  shownChars: number;
  totalChars: number;
}

/**
 * Recua o limite de corte para uma fronteira limpa (parágrafo, sentença, quebra
 * de linha ou espaço), evitando partir palavras ou frases ao meio.
 */
export function truncateCleanBoundary(
  raw: string,
  maxChars: number
): CleanTruncationResult {
  const text = (raw || "").trim();
  const totalChars = text.length;
  if (totalChars <= maxChars || maxChars <= 0) {
    return { text, truncated: false, shownChars: totalChars, totalChars };
  }

  const minFloor = Math.floor(maxChars * 0.5);
  const slice = text.slice(0, maxChars + 1);

  const paraBreak = slice.lastIndexOf("\n\n");
  if (paraBreak >= minFloor) {
    const cut = text.slice(0, paraBreak).trimEnd();
    return { text: cut, truncated: true, shownChars: cut.length, totalChars };
  }

  let bestSentenceEnd = -1;
  const sentenceRe = /[.;?!](?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = sentenceRe.exec(slice)) !== null) {
    if (m.index + 1 <= maxChars && m.index + 1 >= minFloor) {
      bestSentenceEnd = m.index + 1;
    }
  }
  if (bestSentenceEnd > 0) {
    const cut = text.slice(0, bestSentenceEnd).trimEnd();
    return { text: cut, truncated: true, shownChars: cut.length, totalChars };
  }

  const lineBreak = slice.lastIndexOf("\n");
  if (lineBreak >= minFloor) {
    const cut = text.slice(0, lineBreak).trimEnd();
    return { text: cut, truncated: true, shownChars: cut.length, totalChars };
  }

  const wordSpace = slice.lastIndexOf(" ");
  const cutIdx = wordSpace > 0 ? wordSpace : maxChars;
  const cut = text.slice(0, cutIdx).trimEnd();
  return { text: cut, truncated: true, shownChars: cut.length, totalChars };
}

function formatTruncationNotice(
  res: CleanTruncationResult,
  fullRelLink?: string
): string {
  const linkPart = fullRelLink
    ? ` Leia a íntegra em [Inteiro Teor Anatômico](${fullRelLink}).`
    : "";
  return `\n\n> *[Trecho truncado em fronteira limpa: exibindo ${res.shownChars} de ${res.totalChars} caracteres.${linkPart}]*`;
}

export function generateSlicedDossierMarkdown(
  canonicalId: string,
  layers: AnatomicalLayers,
  matchedSlices: TopicSectionSlice[],
  topicFilter?: string,
  fullRelLink?: string
): string {
  const l1a = layers.layer_1A_metadata;
  const l1b = layers.layer_1B_entity_regime;
  const entidadeDisplay =
    l1b.entidade && l1b.entidade !== "NAO_INFORMADA" ? l1b.entidade : "N/A";

  let md = `# 🏛️ Dossiê Anatômico de Jurisprudência — ${canonicalId}\n\n`;
  md += `> **Classificação Tática:** \`${layers.outcome_summary}\` | **Regime:** \`${l1b.regimeLegal}\` ${l1b.isStateItEntity ? "(Estatal de TI)" : ""}\n`;
  md += `> **Filtro de Tópico Aplicado:** \`${topicFilter || "Nenhum (Visão Geral de Alta Densidade)"}\`\n`;
  if (fullRelLink) {
    md += `> **Inteiro Teor Completo:** [Inteiro Teor Anatômico](${fullRelLink})\n`;
  }
  md += "\n";

  md += `## 1. Cabeçalho & Perfil da Jurisdição\n`;
  md += `- **Tribunal / Colegiado:** ${l1a.tribunal} — ${l1a.colegiado}\n`;
  md += `- **Número / Ano:** ${l1a.ano !== undefined ? `${l1a.numero}/${l1a.ano}` : l1a.numero}\n`;
  md += `- **Processo:** ${l1a.processo || "N/A"}\n`;
  md += `- **Relator:** ${l1a.relator || "N/A"}\n`;
  md += `- **Unidade Jurisdicionada:** ${entidadeDisplay}\n`;
  md += `- **Data da Sessão:** ${l1a.dataSessao || "N/A"}\n\n`;

  md += `## 2. Ementa & Tese Fixada\n`;
  if (layers.layer_2A_indexing_tags.length > 0) {
    md += `**Indexação:** \`${layers.layer_2A_indexing_tags.join(" • ")}\`\n\n`;
  }
  md += `> ${layers.layer_2B_enunciado_tese.replace(/\n/g, "\n> ")}\n\n`;

  if (matchedSlices.length > 0) {
    md += `## 3 & 4. Janelas Anatômicas Fatiadas por Tópico (Alta Densidade)\n`;
    for (const slice of matchedSlices) {
      md += `### 📌 ${slice.title}\n\n`;
      const cut = truncateCleanBoundary(slice.rawText, 3000);
      md += `${cut.text}`;
      if (cut.truncated) md += formatTruncationNotice(cut, fullRelLink);
      md += `\n\n`;
    }
  } else {
    md += `## 3. Relatório & Análise Técnica\n`;
    const techText =
      layers.layer_3C_technical_unit_analysis || layers.layer_3A_factual_controversy;
    if (techText) {
      if (layers.layer_3C_technical_unit_analysis) {
        md += `### 🔬 Análise da Unidade Técnica Especializada\n\n`;
      }
      const cutTech = truncateCleanBoundary(techText, 2000);
      md += `${cutTech.text}`;
      if (cutTech.truncated) md += formatTruncationNotice(cutTech, fullRelLink);
      md += `\n\n`;
    } else {
      md += `_Relatório não destacado separadamente no registro._\n\n`;
    }

    md += `## 4. Fundamentação & Ratio Decidendi\n`;
    if (layers.layer_4A_ratio_decidendi) {
      const cutRatio = truncateCleanBoundary(layers.layer_4A_ratio_decidendi, 3000);
      md += `${cutRatio.text}`;
      if (cutRatio.truncated) md += formatTruncationNotice(cutRatio, fullRelLink);
      md += `\n\n`;
    } else {
      md += `_Fundamentação disponível na íntegra do julgado._\n\n`;
    }
  }

  md += `## 5. Dispositivo & Comando Decisório (Síntese Executiva)\n`;
  for (const cmd of layers.layer_5A_operative_commands) {
    md += `- ${cmd}\n`;
  }
  md += `\n`;

  md += `## 6. Quórum & Fecho\n`;
  md += `- **Quórum:** ${layers.layer_6A_closing_quorum.quorum} (${layers.layer_6A_closing_quorum.votos})\n`;
  md += `- **Data:** ${layers.layer_6A_closing_quorum.data || l1a.dataSessao || "N/A"}\n`;

  if (fullRelLink) {
    md += `\n---\n*Íntegra estruturada do julgado disponível em [${fullRelLink}](${fullRelLink}).*\n`;
  }

  return md.trim() + "\n";
}

export function generateFullAnatomicalMarkdown(
  canonicalId: string,
  layers: AnatomicalLayers,
  relatorio: string,
  voto: string,
  acordao: string
): string {
  const l1a = layers.layer_1A_metadata;
  const l1b = layers.layer_1B_entity_regime;
  const entidadeDisplay =
    l1b.entidade && l1b.entidade !== "NAO_INFORMADA" ? l1b.entidade : "N/A";

  let md = `# Inteiro Teor Estruturado — ${canonicalId}\n\n`;
  md += `## 1. Identificação Processual e Metadados\n`;
  md += `- **Tribunal:** ${l1a.tribunal}\n`;
  md += `- **Colegiado:** ${l1a.colegiado}\n`;
  md += `- **Acórdão:** ${l1a.ano !== undefined ? `${l1a.numero}/${l1a.ano}` : l1a.numero}\n`;
  md += `- **Processo:** ${l1a.processo}\n`;
  md += `- **Relator:** ${l1a.relator}\n`;
  md += `- **Entidade:** ${entidadeDisplay}\n`;
  md += `- **Regime Legal Identificado:** ${l1b.regimeLegal}\n\n`;

  md += `## 2. Ementa e Tese Jurídica\n`;
  md += `${layers.layer_2B_enunciado_tese}\n\n`;

  md += `## 3. Relatório\n\n`;
  md += `${relatorio || "(Relatório não disponível no registro)"}\n\n`;

  md += `## 4. Voto / Fundamentação\n\n`;
  md += `${voto || "(Voto não disponível no registro)"}\n\n`;

  md += `## 5. Acórdão / Dispositivo\n\n`;
  md += `${acordao || "(Dispositivo não disponível no registro)"}\n\n`;

  md += `## 6. Fecho e Quórum\n`;
  md += `- **Quórum:** ${layers.layer_6A_closing_quorum.quorum}\n`;
  md += `- **Data da Sessão:** ${l1a.dataSessao || "N/A"}\n`;

  return md.trim() + "\n";
}
