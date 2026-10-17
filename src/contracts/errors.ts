// ============================================================================
// Padrão Exact Copy-Paste Error (Fail-Safe Estrito v0.6.2)
// ============================================================================

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

