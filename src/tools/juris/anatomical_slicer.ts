// ============================================================================
// Fatiador Anatômico de Acórdãos e Trava Anti-Alucinação (docgov-engine v1.4.0)
// Decomposição nas 6 Macro-Partes / 10 Sub-Camadas com Topic-Aware Windowing
// ============================================================================

import type {
  AnatomicalLayers,
  SlicedDossierResult,
  TopicSectionSlice,
  JurisStance,
} from "./types.ts";
import { isStateItEntity } from "./statutory_bridge.ts";
import { classifyDecisionOutcome } from "./relevance_scorer.ts";

/**
 * Remove tags HTML, entidades HTML e quebras redundantes.
 */
export function cleanHtmlAndNormalize(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Validação estrita de autenticidade (Trava Anti-Alucinação de Jurisprudência).
 */
export function assertAuthenticAcordao(
  exists: boolean,
  acordaoIdOrUrl: string,
  court: string = "TCU"
): void {
  if (!exists) {
    throw new Error(
      `[ANTI_HALLUCINATION_BLOCK] O julgado '${acordaoIdOrUrl}' NÃO EXISTE na base oficial do ${court}. É terminantemente proibido citar acórdãos não verificados. Execute 'search_juris' para localizar precedentes reais e verificados.`
    );
  }
}

/**
 * Divide texto longo em blocos de tópicos identificados por cabeçalhos ou numerais romanos/decimais.
 */
export function splitIntoTopicSlices(text: string): TopicSectionSlice[] {
  if (!text) return [];
  const lines = text.split("\n");
  const slices: TopicSectionSlice[] = [];
  let currentTitle = "Visão Geral";
  let currentBuffer: string[] = [];

  const topicHeaderRegex = /^(?:\s*)(?:[IVXLCDM]{1,6}|[0-9]{1,2}(?:\.[0-9]{1,2})?)\s*[-–.]\s+(.+)$/i;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(topicHeaderRegex);
    if (match && trimmed.length < 120 && !trimmed.endsWith(",")) {
      if (currentBuffer.length > 0) {
        slices.push({
          title: currentTitle,
          rawText: currentBuffer.join("\n").trim(),
        });
        currentBuffer = [];
      }
      currentTitle = trimmed;
    } else {
      currentBuffer.push(line);
    }
  }

  if (currentBuffer.length > 0) {
    slices.push({
      title: currentTitle,
      rawText: currentBuffer.join("\n").trim(),
    });
  }

  return slices;
}

/**
 * Decompõe um acórdão nas 6 Macro-Partes e 10 Sub-Camadas Anatômicas.
 */
export function sliceAcordaoAnatomically(
  rawInput: any,
  options: {
    court?: string;
    topicFilter?: string;
    stance?: JurisStance;
  } = {}
): SlicedDossierResult {
  const court = options.court || rawInput.tribunal || rawInput.court || "TCU";
  const rawText = typeof rawInput === "string" ? rawInput : "";
  const obj = typeof rawInput === "object" && rawInput !== null ? rawInput : {};

  // 1A. Metadados & Jurisdição
  const numeroMatch = rawText.match(/ACÓRDÃO\s+(?:Nº\s*)?(\d+)\/(\d{4})/i);
  const numero = obj.numero || obj.numeroAcordao || (numeroMatch ? numeroMatch[1] : "S/N");
  const ano = obj.ano || obj.anoAcordao || (numeroMatch ? parseInt(numeroMatch[2], 10) : new Date().getFullYear());
  const colegiado = obj.colegiado || (rawText.match(/TCU\s*-\s*(Plenário|1ª Câmara|2ª Câmara)/i)?.[1]) || "Plenário";
  const processo = obj.processo || rawText.match(/Processo\s*[:\s]*([0-9./-]+)/i)?.[1] || "N/A";
  const relator = obj.relator || rawText.match(/Relator\s*[:\s]*([^\n\r]+)/i)?.[1] || "Ministro Relator";
  const dataSessao = obj.dataSessao || obj.data || rawText.match(/Data\s*da\s*Sessão\s*[:\s]*([^\n\r]+)/i)?.[1];

  // 1B. Perfil da Entidade & Regime Legal
  const entidade = obj.unidadeJurisdicionada || obj.entidade || rawText.match(/Unidade\s+Jurisdicionada\s*[:\s]*([^\n\r]+)/i)?.[1] || "ÓRGÃO_CONTRATANTE";
  const fullContent = `${rawText} ${obj.relatorio || ""} ${obj.voto || ""} ${obj.sumario || ""} ${obj.enunciado || ""}`;
  const isItEntity = isStateItEntity(entidade) || isStateItEntity(fullContent);
  const mentions13303 = /\b13\.?303\b/i.test(fullContent) || isItEntity;
  const regimeLegal: "LEI_13303_ESTATAIS" | "LEI_14133_ADM_DIRETA" | "OUTRO" = mentions13303
    ? "LEI_13303_ESTATAIS"
    : /\b14\.?133\b/i.test(fullContent)
    ? "LEI_14133_ADM_DIRETA"
    : "OUTRO";

  // 2A. Indexação / Tags
  let indexingTags: string[] = [];
  if (Array.isArray(obj.indexacao)) {
    indexingTags = obj.indexacao.map(String);
  } else if (typeof obj.indexacao === "string") {
    indexingTags = obj.indexacao.split(/[;.\n]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 2);
  } else {
    const tagMatch = rawText.match(/^(?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s/,-]+\.\s*){2,}/m);
    if (tagMatch) {
      indexingTags = tagMatch[0].split(".").map((s) => s.trim()).filter((s) => s.length > 2);
    }
  }

  // 2B. Enunciado / Tese Fixada
  const enunciadoTese = cleanHtmlAndNormalize(
    obj.enunciado || obj.sumario || obj.tese || rawText.match(/SUMÁRIO\s*[:\s]*([\s\S]*?)(?:RELATÓRIO|VOTO|ACÓRDÃO)/i)?.[1] || "Tese jurídica fixada nos autos."
  );

  // 3. Relatório (3A, 3B, 3C)
  const relatorioRaw = cleanHtmlAndNormalize(obj.relatorio || rawText.match(/RELATÓRIO[\s\S]*?(?=VOTO|ACÓRDÃO|$)/i)?.[0] || "");
  let factualControversy = "";
  let defenseArguments = "";
  let technicalUnitAnalysis = "";

  const alegaMatch = relatorioRaw.match(/(?:ALEGAÇÕES|HISTÓRICO|DOS FATOS|OBJETO DA REPRESENTAÇÃO)[\s\S]*?(?=MANIFESTAÇÃO|OITIVA|EXAME TÉCNICO|ANÁLISE|$)/i);
  factualControversy = alegaMatch ? alegaMatch[0].trim() : relatorioRaw.slice(0, 1500);

  const defesaMatch = relatorioRaw.match(/(?:MANIFESTAÇÃO D[OA]|OITIVA PRÉVIA|ESCLARECIMENTOS|JUSTIFICATIVAS)[\s\S]*?(?=EXAME TÉCNICO|ANÁLISE TÉCNICA|CONCLUSÃO|$)/i);
  defenseArguments = defesaMatch ? defesaMatch[0].trim() : "";

  const audTiMatch = relatorioRaw.match(/(?:EXAME TÉCNICO|ANÁLISE TÉCNICA|PARECER DA (?:AUDTI|SEFTI|SELOG|UNIDADE TÉCNICA))[\s\S]*?(?=CONCLUSÃO|PROPOSTA DE ENCAMINHAMENTO|$)/i);
  technicalUnitAnalysis = audTiMatch ? audTiMatch[0].trim() : "";

  // 4A. Fundamentação / Ratio Decidendi
  const votoRaw = cleanHtmlAndNormalize(obj.voto || rawText.match(/VOTO[\s\S]*?(?=ACÓRDÃO|$)/i)?.[0] || "");
  const ratioDecidendi = votoRaw;

  // 5A. Dispositivo / Moduladores
  const acordaoRaw = cleanHtmlAndNormalize(obj.acordao || rawText.match(/ACÓRDÃO[\s\S]*$/i)?.[0] || "");
  const operativeCommands: string[] = [];
  const itemMatches = acordaoRaw.match(/\b9\.\d+[\s\S]*?(?=\b9\.\d+|$)/g);
  if (itemMatches && itemMatches.length > 0) {
    for (const m of itemMatches) {
      operativeCommands.push(m.trim());
    }
  } else {
    operativeCommands.push(acordaoRaw.slice(0, 800));
  }
  const outcomeSummary = classifyDecisionOutcome(acordaoRaw, enunciadoTese);

  // 6A. Quórum de Fecho
  const isUnanime = /\b(unânime|unanimidade)\b/i.test(acordaoRaw);
  const quorum = isUnanime ? "Unânime" : "Por Maioria";
  const closingQuorum = {
    quorum,
    votos: isUnanime ? "Votação unânime dos membros do colegiado" : "Decisão por maioria",
    data: dataSessao || String(ano),
  };

  const layers: AnatomicalLayers = {
    layer_1A_metadata: {
      tribunal: court,
      colegiado,
      numero: String(numero),
      ano: Number(ano),
      processo,
      relator,
      dataSessao,
    },
    layer_1B_entity_regime: {
      entidade,
      regimeLegal,
      isStateItEntity: isItEntity,
    },
    layer_2A_indexing_tags: indexingTags,
    layer_2B_enunciado_tese: enunciadoTese,
    layer_3A_factual_controversy: factualControversy,
    layer_3B_defense_arguments: defenseArguments,
    layer_3C_technical_unit_analysis: technicalUnitAnalysis,
    layer_4A_ratio_decidendi: ratioDecidendi,
    layer_5A_operative_commands: operativeCommands,
    outcome_summary: outcomeSummary,
    layer_6A_closing_quorum: closingQuorum,
  };

  // Topic-Aware Windowing (Estágio 2 vs Estágio 3)
  const allTopicSlices = [
    ...splitIntoTopicSlices(relatorioRaw),
    ...splitIntoTopicSlices(votoRaw),
  ];

  const filterTerms = options.topicFilter
    ? options.topicFilter.toLowerCase().split(/[|,\s]+/).filter((t) => t.length > 2)
    : [];

  const matchedSections: TopicSectionSlice[] = [];
  if (filterTerms.length > 0) {
    for (const slice of allTopicSlices) {
      const lower = slice.rawText.toLowerCase();
      if (filterTerms.some((term) => lower.includes(term))) {
        matchedSections.push(slice);
      }
    }
  }

  // Gera Markdown de Estágio 2 (Dossiê Fatiado)
  const canonicalId = `ACORDAO-${court}-${numero}-${ano}-${colegiado.toUpperCase().replace(/\s+/g, "_")}`;
  const dossieMarkdown = generateSlicedDossierMarkdown(canonicalId, layers, matchedSections, options.topicFilter);

  // Gera Markdown de Estágio 3 (Inteiro Teor Estruturado)
  const fullMarkdown = generateFullAnatomicalMarkdown(canonicalId, layers, relatorioRaw, votoRaw, acordaoRaw);

  return {
    layers,
    topicsMatched: matchedSections.length,
    matchedSections,
    dossieMarkdown,
    fullMarkdown,
  };
}

function generateSlicedDossierMarkdown(
  canonicalId: string,
  layers: AnatomicalLayers,
  matchedSlices: TopicSectionSlice[],
  topicFilter?: string
): string {
  const l1a = layers.layer_1A_metadata;
  const l1b = layers.layer_1B_entity_regime;

  let md = `# 🏛️ Dossiê Anatômico de Jurisprudência — ${canonicalId}\n\n`;
  md += `> **Classificação Tática:** \`${layers.outcome_summary}\` | **Regime:** \`${l1b.regimeLegal}\` ${l1b.isStateItEntity ? "(Estatal de TI)" : ""}\n`;
  md += `> **Filtro de Tópico Aplicado:** \`${topicFilter || "Nenhum (Visão Geral de Alta Densidade)"}\`\n\n`;

  md += `## 1. Cabeçalho & Perfil da Jurisdição\n`;
  md += `- **Tribunal / Colegiado:** ${l1a.tribunal} — ${l1a.colegiado}\n`;
  md += `- **Número / Ano:** ${l1a.numero}/${l1a.ano}\n`;
  md += `- **Processo:** ${l1a.processo || "N/A"}\n`;
  md += `- **Relator:** ${l1a.relator || "N/A"}\n`;
  md += `- **Unidade Jurisdicionada:** ${l1b.entidade || "N/A"}\n`;
  md += `- **Data da Sessão:** ${l1a.dataSessao || "N/A"}\n\n`;

  md += `## 2. Ementa & Tese Fixada\n`;
  if (layers.layer_2A_indexing_tags.length > 0) {
    md += `**Indexação:** \`${layers.layer_2A_indexing_tags.join(" • ")}\`\n\n`;
  }
  md += `> ${layers.layer_2B_enunciado_tese.replace(/\n/g, "\n> ")}\n\n`;

  md += `## 5. Dispositivo & Comando Decisório (Síntese Executiva)\n`;
  for (const cmd of layers.layer_5A_operative_commands) {
    md += `- ${cmd}\n`;
  }
  md += `\n**Quórum:** ${layers.layer_6A_closing_quorum.quorum} (${layers.layer_6A_closing_quorum.votos})\n\n`;

  md += `## 3 & 4. Janelas Anatômicas Fatiadas por Tópico (Alta Densidade)\n`;
  if (matchedSlices.length > 0) {
    for (const slice of matchedSlices) {
      md += `### 📌 ${slice.title}\n\n`;
      md += `${slice.rawText.slice(0, 3000)}\n\n`;
    }
  } else {
    if (layers.layer_3C_technical_unit_analysis) {
      md += `### 🔬 Análise da Unidade Técnica Especializada\n\n`;
      md += `${layers.layer_3C_technical_unit_analysis.slice(0, 2000)}\n\n`;
    }
    if (layers.layer_4A_ratio_decidendi) {
      md += `### ⚖️ Fundamentação e Ratio Decidendi do Relator\n\n`;
      md += `${layers.layer_4A_ratio_decidendi.slice(0, 3000)}\n\n`;
    }
  }

  return md.trim() + "\n";
}

function generateFullAnatomicalMarkdown(
  canonicalId: string,
  layers: AnatomicalLayers,
  relatorio: string,
  voto: string,
  acordao: string
): string {
  const l1a = layers.layer_1A_metadata;
  const l1b = layers.layer_1B_entity_regime;

  let md = `# Inteiro Teor Estruturado — ${canonicalId}\n\n`;
  md += `## 1. Identificação Processual e Metadados\n`;
  md += `- **Tribunal:** ${l1a.tribunal}\n`;
  md += `- **Colegiado:** ${l1a.colegiado}\n`;
  md += `- **Acórdão:** ${l1a.numero}/${l1a.ano}\n`;
  md += `- **Processo:** ${l1a.processo}\n`;
  md += `- **Relator:** ${l1a.relator}\n`;
  md += `- **Entidade:** ${l1b.entidade}\n`;
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
