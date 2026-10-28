// ============================================================================
// Padrão Exact Copy-Paste Error (Fail-Safe Estrito v0.6.2)
// ============================================================================

import type { TechnicalNoteData, EvolutionClauseItem } from "../types/index.ts";

export const EXACT_COPY_PASTE_SLOTS_MANIFEST_SNIPPET = `{
  "slots": [
    { "coord": "P3", "tag": "{{estudo.necessidade}}" },
    { "coord": "T0.R0.C1", "tag": "{{metadados.unidade}}" },
    { "find": "Texto Antigo Fixo", "replace": "{{metadados.orgao}}" }
  ],
  "loop_table_rows": [
    {
      "table_index": 1,
      "header_row_index": 0,
      "template_row_index": 1,
      "remove_from_row": 2,
      "remove_to_row": 6,
      "for_open_tag": "{{FOR item IN lista_itens}}",
      "for_close_tag": "{{END-FOR item}}",
      "cell_tags": [
        "{{$item.numero}}",
        "{{$item.descricao}}",
        "{{$item.valor}}"
      ]
    }
  ]
}`;

export const EXACT_COPY_PASTE_CANONICAL_SLOTS_MANIFEST_SNIPPET = `{
  "replace_paragraphs": [
    { "start_p": 3, "end_p": 5, "tag": "{{estudo.necessidade}}" }
  ],
  "replace_table_cells": [
    { "table_index": 0, "row_index": 0, "cell_index": 1, "tag": "{{metadados.unidade}}" }
  ],
  "loop_table_rows": [
    {
      "table_index": 1,
      "header_row_index": 0,
      "template_row_index": 1,
      "remove_from_row": 2,
      "remove_to_row": 6,
      "for_open_tag": "{{FOR item IN lista_itens}}",
      "for_close_tag": "{{END-FOR item}}",
      "cell_tags": ["{{$item.numero}}", "{{$item.descricao}}", "{{$item.valor}}"]
    }
  ],
  "remove_table_rows": [
    { "table_index": 0, "from_row": 27, "to_row": 44 }
  ],
  "replace_inline": [
    { "find": "Texto Antigo Fixo", "replace": "{{metadados.orgao}}" }
  ]
}`;

export function createSlotsManifestContractError(reason: string): string {
  return [
    `Erro de validação no manifesto de slots: ${reason}`,
    `NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:`,
    EXACT_COPY_PASTE_SLOTS_MANIFEST_SNIPPET,
    "",
    "Também é aceito o formato canônico com os arrays na raiz:",
    EXACT_COPY_PASTE_CANONICAL_SLOTS_MANIFEST_SNIPPET,
  ].join("\n");
}

export const EXACT_COPY_PASTE_AUDIT_REPORT_SNIPPET = `{
  "processo_id": "08000.001234/2026-00",
  "orgao_entidade": "ORGAO_CONTRATANTE",
  "artefato_auditado": "Estudo Técnico Preliminar (ETP)",
  "regime_juridico": "Lei Federal nº 14.133/2021",
  "status_global": "APROVADO_COM_RESSALVAS",
  "contagem": {
    "bloqueantes": 0,
    "alertas": 2,
    "conformes": 8
  },
  "resumo_executivo": "A auditoria técnica identificou 2 alertas preventivos e 0 apontamentos bloqueantes...",
  "apontamentos": [
    {
      "id": "AUD-01",
      "severidade": "ALERTA",
      "titulo_apontamento": "Necessidade de refinamento da estimativa de quantidades",
      "base_legal": "Art. 18, § 1º, IV da Lei nº 14.133/2021",
      "trechos_documento": [
        {
          "rotulo": "Item 4.1 da Minuta",
          "texto": "Texto literal transcrito entre aspas...",
          "origem": "minuta_etp.docx"
        }
      ],
      "risco_controle_externo": "Risco de sobrepreço ou dimensionamento inadequado da contratação.",
      "redacao_saneadora_sugerida": "Incluir memória de cálculo detalhada com base no histórico de consumo."
    }
  ]
}`;

export function createAuditReportContractError(reason: string): string {
  return [
    `Erro de validação no relatório de auditoria JSON: ${reason}`,
    `NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:`,
    EXACT_COPY_PASTE_AUDIT_REPORT_SNIPPET,
  ].join("\n");
}

export const EXACT_COPY_PASTE_RISK_MATRIX_SNIPPET = `{
  "document_type": "RISK_MATRIX",
  "processo_id": "08000.001234/2026-00",
  "orgao_entidade": "ORGAO_CONTRATANTE",
  "artefato_auditado": "Termo de Referência (TR)",
  "regime_juridico": "Lei Federal nº 14.133/2021",
  "resumo_executivo": "Matriz de Riscos elaborada conforme Art. 18, X e Art. 22 da Lei nº 14.133/2021...",
  "matriz_riscos": [
    {
      "id": "RISCO-01",
      "evento_risco": "Atraso no fornecimento dos bens devido a entraves de importação",
      "fase": "Execução Contratual",
      "probabilidade": "Média",
      "impacto": "Alto",
      "nivel_risco": "ALTO",
      "alocacao": "CONTRATADA",
      "acoes_preventivas": "Exigência de comprovação de canal logístico estabelecido e cronograma de importação",
      "acoes_contingencia": "Aplicação de penalidades contratuais e convocação do remanescente",
      "responsavel": "Fiscal Técnico do Contrato"
    }
  ]
}`;

export function createRiskMatrixContractError(reason: string): string {
  return [
    `Erro de validação na Matriz de Riscos JSON: ${reason}`,
    `NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:`,
    EXACT_COPY_PASTE_RISK_MATRIX_SNIPPET,
  ].join("\n");
}

export const EXACT_COPY_PASTE_COMPLIANCE_CHECKLIST_SNIPPET = `{
  "document_type": "COMPLIANCE_CHECKLIST",
  "processo_id": "08000.001234/2026-00",
  "orgao_entidade": "ORGAO_CONTRATANTE",
  "artefato_auditado": "Edital de Pregão Eletrônico",
  "regime_juridico": "Lei Federal nº 14.133/2021",
  "resumo_executivo": "Avaliação de conformidade normativa preventiva com enunciados do TCU e AGU...",
  "checklist_conformidade": [
    {
      "id": "CHK-01",
      "item_criterio": "Previsão expressa de critérios objetivos de habilitação técnica e econômico-financeira",
      "status": "CONFORME",
      "fundamentacao_legal": "Art. 67 e 69 da Lei nº 14.133/2021; Súmula TCU nº 263",
      "evidencia": "[PAG_004 | L0035] Cláusula 8.2 da minuta do edital",
      "recomendacao": "Manter a redação atual que assegura ampla competitividade."
    }
  ]
}`;

export function createComplianceChecklistContractError(reason: string): string {
  return [
    `Erro de validação no Checklist de Conformidade JSON: ${reason}`,
    `NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:`,
    EXACT_COPY_PASTE_COMPLIANCE_CHECKLIST_SNIPPET,
  ].join("\n");
}

export const EXACT_COPY_PASTE_TECHNICAL_NOTE_SNIPPET = `{
  "document_type": "TECHNICAL_NOTE",
  "processo_id": "08000.001234/2026-00",
  "orgao_entidade": "ORGAO_CONTRATANTE",
  "artefato_auditado": "Termo de Referência (TR)",
  "versao_anterior": "Minuta Original v1.0",
  "versao_nova": "Minuta Saneada v2.0",
  "regime_juridico": "Lei Federal nº 14.133/2021",
  "resumo_executivo": "A presente Nota Técnica demonstra as alterações saneadoras promovidas no Termo de Referência...",
  "quadro_evolucao": [
    {
      "id": "EVO-01",
      "slot_id": "P14",
      "coordenada": "[P14]",
      "secao_titulo": "Cláusula 5ª — Do Prazo de Entrega e Garantia",
      "tipo_alteracao": "MODIFICACAO",
      "redacao_anterior": "O prazo de entrega será impreterivelmente de 10 dias corridos...",
      "redacao_nova": "O prazo de entrega será de até 30 (trinta) dias úteis nos termos do Art. 111...",
      "justificativa_tecnica": "Adequação ao prazo de fabricação apurado na pesquisa de mercado...",
      "fundamentacao_juridica": "Art. 18, inc. X e Art. 40, § 1º da Lei nº 14.133/2021; Acórdão TCU nº 1234/2023-Plenário",
      "apontamento_origem_id": "AUD-02",
      "impacto_risco": "Eliminação de risco de direcionamento e restrição indevida (Zona Z8)"
    }
  ],
  "conclusao_encaminhamento": "Submete-se à Consultoria Jurídica com parecer favorável ao prosseguimento."
}`;

export function createTechnicalNoteContractError(reason: string): string {
  return [
    `Erro de validação na Nota Técnica Comparativa JSON: ${reason}`,
    `NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:`,
    EXACT_COPY_PASTE_TECHNICAL_NOTE_SNIPPET,
  ].join("\n");
}

export function validateTechnicalNoteData(raw: unknown): TechnicalNoteData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      createTechnicalNoteContractError("O arquivo JSON deve conter um objeto raiz válido.")
    );
  }

  const obj = raw as Record<string, any>;

  if (!obj.processo_id || typeof obj.processo_id !== "string" || !obj.processo_id.trim()) {
    throw new Error(
      createTechnicalNoteContractError("Campo obrigatório 'processo_id' ausente ou inválido.")
    );
  }

  if (!obj.orgao_entidade || typeof obj.orgao_entidade !== "string" || !obj.orgao_entidade.trim()) {
    throw new Error(
      createTechnicalNoteContractError("Campo obrigatório 'orgao_entidade' ausente ou inválido.")
    );
  }

  if (!obj.artefato_auditado || typeof obj.artefato_auditado !== "string" || !obj.artefato_auditado.trim()) {
    throw new Error(
      createTechnicalNoteContractError("Campo obrigatório 'artefato_auditado' ausente ou inválido.")
    );
  }

  if (!obj.resumo_executivo || typeof obj.resumo_executivo !== "string" || !obj.resumo_executivo.trim()) {
    throw new Error(
      createTechnicalNoteContractError("Campo obrigatório 'resumo_executivo' ausente ou inválido.")
    );
  }

  const items = obj.quadro_evolucao || obj.clausulas_evolucao;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(
      createTechnicalNoteContractError("Campo obrigatório 'quadro_evolucao' deve ser uma lista não vazia de alterações.")
    );
  }

  const normalizedItems: EvolutionClauseItem[] = [];
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    if (!it || typeof it !== "object" || Array.isArray(it)) {
      throw new Error(
        createTechnicalNoteContractError(`Item ${idx + 1} do 'quadro_evolucao' é inválido.`)
      );
    }

    const id = String(it.id || `EVO-${String(idx + 1).padStart(2, "0")}`).trim();
    const secao_titulo = String(it.secao_titulo || it.secao || it.titulo || `Cláusula ${idx + 1}`).trim();

    let rawTipo = String(it.tipo_alteracao || it.tipo || "MODIFICACAO").toUpperCase().trim();
    if (/inclus|adicion|inser/i.test(rawTipo)) rawTipo = "INCLUSAO";
    else if (/supress|remov|exclu/i.test(rawTipo)) rawTipo = "SUPRESSAO";
    else rawTipo = "MODIFICACAO";

    const justificativa_tecnica = String(
      it.justificativa_tecnica || it.justificativa || it.motivacao || ""
    ).trim();
    if (!justificativa_tecnica) {
      throw new Error(
        createTechnicalNoteContractError(
          `Item '${id}' está sem 'justificativa_tecnica'. Toda alteração em processo licitatório exige motivação expressa.`
        )
      );
    }

    const fundamentacao_juridica = String(
      it.fundamentacao_juridica || it.fundamentacao || it.base_legal || ""
    ).trim();
    if (!fundamentacao_juridica) {
      throw new Error(
        createTechnicalNoteContractError(
          `Item '${id}' está sem 'fundamentacao_juridica'. Indique o artigo da Lei 14.133/2021 ou parecer/acórdão correlato.`
        )
      );
    }

    normalizedItems.push({
      ...it,
      id,
      secao_titulo,
      tipo_alteracao: rawTipo as any,
      justificativa_tecnica,
      fundamentacao_juridica,
    });
  }

  return {
    ...obj,
    document_type: "TECHNICAL_NOTE",
    processo_id: String(obj.processo_id).trim(),
    orgao_entidade: String(obj.orgao_entidade).trim(),
    artefato_auditado: String(obj.artefato_auditado).trim(),
    resumo_executivo: String(obj.resumo_executivo).trim(),
    quadro_evolucao: normalizedItems,
  };
}

// ============================================================================
// Contrato de Identificador PNCP (v1.3.4 — Exact Copy-Paste Error)
// ============================================================================

export const EXACT_COPY_PASTE_PNCP_ID_SNIPPET = `{
  "caseDir": "cases/meu_caso_referencia",
  "pncpIdOrUrl": "00394460000141-1-000015/2026",
  "shortname": "orgao_referencia"
}`;

export function createPncpIdentifierContractError(invalidInput: string): Error {
  return new Error(
    `Identificador PNCP inválido: "${invalidInput}".\n` +
      `NÃO faça leituras exploratórias no repositório. Reescreva imediatamente a chamada utilizando estritamente um dos 3 formatos canônicos aceitos (ou URL de redirecionador Google Grounding):\n` +
      `  1. Número de Controle PNCP: "00394460000141-1-000015/2026"\n` +
      `  2. URL do Portal/API PNCP:  "https://pncp.gov.br/app/editais/00394460000141/2026/15"\n` +
      `  3. Tupla Simplificada:      "00394460000141/2026/15"\n\n` +
      `Dica: Caso possua apenas termos textuais ou objeto da contratação, utilize a ferramenta 'search_pncp'.\n\n` +
      `Exemplo de payload canônico para fetch_pncp:\n${EXACT_COPY_PASTE_PNCP_ID_SNIPPET}`
  );
}

// ============================================================================
// Contrato de Busca PNCP (v1.3.5 — Exact Copy-Paste Error)
// ============================================================================

export const EXACT_COPY_PASTE_PNCP_SEARCH_SNIPPET = `{
  "caseDir": "cases/meu_caso_referencia",
  "query": "fábrica de software | sustentação de sistemas",
  "status": "todas",
  "uf": "DF",
  "modalidade": "Pregão",
  "limit": 10
}`;

export function createPncpSearchContractError(reason: string): Error {
  return new Error(
    `Erro nos parâmetros de busca no PNCP: ${reason}\n` +
      `NÃO faça leituras exploratórias no repositório. Reescreva imediatamente a chamada utilizando estritamente o contrato abaixo:\n` +
      EXACT_COPY_PASTE_PNCP_SEARCH_SNIPPET
  );
}


