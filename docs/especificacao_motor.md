# Especificação Técnica do Motor docgov-engine (v1.3.2)

Documento normativo e especificação canônica do motor standalone `docgov-engine` (`docgov-engine v1.3.2`) e servidor MCP para o ecossistema DocGov.

---

## 1. Diretrizes de Comunicação e Resiliência MCP

1. **Teto Estrito de Payload MCP (< 1024 bytes) e Identificação de Versão (v0.7.1 / v1.0.0 / v1.1.0 / v1.1.1):** Todo retorno de ferramenta via stdio MCP DEVE ser um JSON sintético conciso (< 1 KB, margem segura < 920 bytes) contendo o campo `engine_version` na raiz para dispensar consultas externas. Mapas estruturais densos (`toc_map`, `outline_headings`, `page_signals`, `impugnation_zones`), índices mestres (`indice_mestre_caso.md`), relatórios de auditoria orçamentária (`auditoria_orcamentaria_*.json`), diffs documentais (`diff_documental_*.md` e `.json`), dossiês de hotspots (`dossie_hotspots_*.md`) e espelhos lineares de leitura integral (`visao_auditoria_*.md`) são persistidos no diretório `state/` do caso e apenas referenciados no payload sintético.
2. **Padrão Exact Copy-Paste Error (Zero Silent No-Op e Fail-Fast Estrito):** É expressamente proibido retornar `status: "success"` se `applied_slots_count === 0` ou se o manifesto contiver chaves desconhecidas ou inválidas. Ao detectar erro de validação em `slots_manifest.json` ou `relatorio_auditoria.json`, o motor interrompe a execução com mensagem imperativa acompanhada do snippet JSON canônico pronto para copiar e colar, eliminando leituras exploratórias cegas.
3. **Neutralidade Institucional Absoluta:** O motor e seus contratos utilizam exclusivamente identificadores canônicos universais e genéricos: `ORGAO_CONTRATANTE`, `MUNICIPIO_GENERICO`, `ORGAO_A`, `ORGAO_B`, `AGU`, `MGI`, `TCU`.
4. **Resiliência e Cache Global (core/registry/templates/):** O motor realiza matching 1-para-N contra o cache global, com suporte a rastreabilidade temporal (`created_at`, `updated_at`, `age_days`, `cache_date_status`, `engine_version`, `slots_count`), retrocompatibilidade estrita com caches legados sem datas, reancoragem automática de coordenadas (Auto-Offset) em caso de drift (75%-99%) e sanity check descartando entradas corrompidos.
5. **Extração Nativa e Reconstrução Colunar de PDF, Cartografia Estrutural Sem IA, Dossiê de Hotspots e Radar das 14 Zonas (v0.8.0 / v0.8.1 / v0.9.0 / v1.0.0):** Suporte avançado a arquivos `.pdf` e `.docx` com agrupamento de linhas no eixo Y (2.5pt com suporte a micro-jitter) e colunas (` | ` para gutters >= 18pt e tokens curtos), detecção de armadilha de OCR em páginas escaneadas (< 25 chars), dossiê cirúrgico de pontos quentes (`dossie_hotspots_*.md` com contexto expandido de ±12 linhas com hotspots desacoplados da linha 1), numeração paginada `[PAG_XXX | LYYYY]`, esqueleto de títulos (`outline_headings`), detector de densidade técnica e tabelas de itens (`page_signals`), radar determinístico das 14 Zonas Críticas de Impugnação (`Z1` a `Z14`, separando Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP, Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO e Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO, além de cruzamento multipeça `Z12_MAPA_CRUZADO_MULTIPECA`) e Índice Cartográfico Mestre Unificado Multi-Documento (`indice_mestre_caso.md`).
6. **Pipeline Híbrido de Conversão DOCX para PDF (v0.9.5 / v1.0.0):** Conversão de alta fidelidade visual com seleção automática em 2 níveis: Tier 1 (MS Word COM via PowerShell no Windows/WSL Interop com 100% de fidelidade) e Tier 2 (Pure-JS standalone determinístico com pdf-lib + xmldom + JSZip sem dependências de SO). Disponível via parâmetro `outputFormat` ("docx" | "pdf" | "both") em fill_docx_template e generate_audit_docx e via flag `--format` na CLI, com resolução canônica de caminhos, isolamento de DOCX temporário no modo exclusivo PDF e fechamento COM determinístico liberando file locks.
7. **Auditoria Matemática Determinística de Planilhas Orçamentárias e Diff Estrutural Multi-Versão (v1.1.0):** Detecção automática de quadros de preços e itens em tabelas OpenXML (`.docx`) e tabelas colunares reconstruídas (`.pdf`), validação de linha a linha ($Qtd \times Unit = Total$) em centavos inteiros (BigInt/Math.round) com classificação em MATH_ERROR (> 2 centavos) e ROUNDING_WARNING (<= 2 centavos), validação de somatórios verticais (subtotais e total geral), cruzamento automático com menções de valor global no corpo textual injetados no Radar Z10/Z12 e persistência em `state/auditoria_orcamentaria_<stem>.json`. Suporte a Diff Estrutural e Semântico Multi-Versão entre minutas/editais (`oldPath` vs `newPath`) via parâmetro `compareWithPath` em inspect_doc ou flag `--diff <caminho>` na CLI, reportando seções adicionadas, removidas e modificadas (com marcação inline `~~antigo~~ ` -> `**novo**`), delta de zonas de impugnação (INTRODUCED, RESOLVED, RETAINED) e persistência em `state/diff_documental_<stem>.md` e `.json`.
8. **Sanitização XML BOM, Movimentação da Raiz e Resiliência Multi-Arquivo (v1.1.1):** Sanitização prévia universal de XML eliminando BOM UTF-8 (﻿) e whitespaces antes de tags XML no @xmldom/xmldom, movimentação automática e deduplicação de documentos soltos na raiz de cases/<slug>/ para inputs/ sem clonagem indevida (preservando context.json) e isolamento try/catch por arquivo em bootstrap_case garantindo a emissão de state/indice_mestre_caso.md com inventário de 100% dos insumos.
9. **Ingestão Nativa de Planilhas (.xlsx e .csv) e Engenharia Tabular Avançada Multi-Página (v1.2.0):** Parser leve de OpenXML Spreadsheet ('xl/worksheets' e 'xl/sharedStrings') sem dependências externas pesadas e com indexação estrita por coordenada de célula 'r="A1"' (eliminando deslocamento por células vazias), parser RFC 4180 de .csv, fusão contínua de tabelas multi-página com cabeçalho repetido em DOCX e PDF, resolução de células multilinha e normalização de 'gridSpan' e 'vMerge', submetendo automaticamente as tabelas ao budget_auditor determinístico (centavos inteiros nas zonas Z10 e Z12).
10. **Pipeline OCR Headless para PDFs Escaneados (v1.2.0):** Detecção automática de armadilhas de documento escaneado ('scanned_pages_detected') com fallback determinístico operando 100% offline dentro do binário Bun, injetando o texto extraído nas coordenadas homogêneas '[PAG_XXX | LYYYY]' para auditoria imediata pelo Radar das 14 Zonas e marcação 'ocr_applied: true'.
11. **Geração Parametrizada de Matriz de Riscos e Checklist de Conformidade (v1.2.0):** Emissão estruturada em layout vertical corrido A4 corporativo (zero tabelas <w:tbl>) de Matriz de Gerenciamento de Riscos (Art. 18, X e Art. 22 da Lei nº 14.133/2021) com severidade cromática e alocação contratual, e Checklist de Conformidade Normativa (TCU/AGU/MGI) com status e fundamentações legais em Word (.docx) e PDF via 'generate_audit_docx'.
12. **Segurança de Supply-Chain & Auto-Updater SHA-256 (v1.2.0):** Validação criptográfica de integridade SHA-256 antes da substituição de binários em disco no '--update' e suporte híbrido transparente a tokens em variáveis de ambiente ou arquivo local '.env'.
13. **Diff Semântico Granular em Nível de Token & Nota Técnica Comparativa Padronizada (Marco 6 — v1.3.0):** Motor de tokenização com regex Unicode `gu` preservando acentuação pt-BR, algoritmo LCS com guardrail de complexidade para cláusulas extensas (> 2.000.000 de comparações), blocos de diff granular com renderização markdown inline ({++inclusão++}, {--supressão--}), e gerador formal de Nota Técnica Comparativa ('Antes vs. Depois') em layout editorial vertical A4 (zero tabelas) com cards coloridos (verde/vermelho/azul), quadro de evolução com fundamentação técnica e jurídica individualizada por cláusula, delta das 14 zonas de impugnação e exportação para Word (.docx) e PDF via CLI ('--diff-report', '--generate-technical-note') e MCP ('generate_technical_note_docx').
14. **Resiliência de Caminhos MCP & Inspeção Linear MD/TXT (v1.3.1 — Lei 6):** Resolução canônica de caminhos de arquivos e pastas no servidor MCP desacoplada do CWD da IDE consumidora (`resolveWorkspacePath`), busca ascendente de workspace e priorização de localização do binário (`process.execPath`), eliminando gravação em pastas da IDE (`AppData/Local/Programs/antigravity`). Inspeção nativa linear de arquivos Markdown e Texto Puro (`.md` e `.txt`) gerando visão de auditoria e dossiê com Radar Z1..Z14, e guardrail fail-fast amigável que previne exceções crípticas de descompressão do JSZip.
15. **Blindagem de Governança, Paths Locais & Teto MCP (v1.3.2 — Leis 2, 6 e 8):** Guardrail de segurança ativa no `bootstrap_case` prevenindo inicialização acidental na raiz de repositórios Git, denylist estrita preservando todos os arquivos de governança (`AGENTS.md`, `README.md`, `CHANGELOG.md`, etc.) e código-fonte (`.ts`, `.py`, etc.), resolução de `.` e caminhos relativos locais respeitando `process.cwd()` sem desvio ascendente espúrio, e eliminação de duplicação de caminhos em `inspect_doc` garantindo payload sintético estritamente abaixo de 900 bytes.

---

## 2. Ferramentas MCP Nativas (6 Tools)

### 2.1. bootstrap_case
Inicializa a governança de pastas do caso (`inputs/`, `state/`, `templates/`, `output/`), preserva nomes legíveis, move e deduplica automaticamente documentos soltos na raiz para `inputs/` (preservando `context.json`), infere extensões por magic bytes (`PK\x03\x04` para .docx e `%PDF` para .pdf), aceita `fileRenameMap` opcional, realiza auto-batismo de uploads anônimos (`media_*` -> `<TIPO>_<ORGAO>_<hash4>.<ext>`), detecta páginas escaneadas como imagem (`scanned_pages_detected`), inspeciona minutas `.docx`, editais/anexos `.pdf` e arquivos `.md`/`.txt` com isolamento `try/catch` por arquivo gerando `state/estrutura_<stem>.json`, `state/visao_auditoria_<stem>.md`, `state/dossie_hotspots_<stem>.md`, `state/auditoria_orcamentaria_<stem>.json` e o consolidado multipeça `state/indice_mestre_caso.md` contendo o inventário de 100% dos arquivos com matriz cruzada Z1..Z14 e alertas globais. Retorna sumário executivo sintético (< 1 KB, margem segura < 920 bytes) com `master_index_path`.

### 2.2. inspect_doc
Engenharia reversa estrutural completa de arquivos Word (`.docx`), PDF (`.pdf`), planilhas (`.xlsx`, `.csv`) e textos/markdown (`.md`, `.txt`) recebendo como parâmetro principal `filePath` (com suporte ao alias `docxPath`) e parâmetro opcional `compareWithPath` para diff documental multi-versão. Em PDFs, executa agrupamento por eixo Y com separação de colunas por ` | ` e detecta páginas escaneadas como imagem. Constrói no topo do JSON o índice estrutural rápido (`toc_map`), a Cartografia Estrutural em 3 camadas (`outline_headings`, `page_signals` e `impugnation_zones` Z1..Z14), calcula a impressão digital (`structure_fingerprint`), realiza busca 1-para-N no cache global (`core/registry/templates/`) com status `EXACT`, `MODIFIED` (reancoragem automática Auto-Offset gerando `state/adapted_slots_manifest.json` em drift 75%-99%) ou `NEW`, incluindo rastreabilidade temporal (`created_at`, `updated_at`, `age_days`, `cache_date_status`, `engine_version`, `slots_count`) para decisão informada no Gate 1. Executa auditoria matemática determinística de planilhas orçamentárias (DOCX e PDF) integrando achados ao Radar Z10/Z12 e gerando `state/auditoria_orcamentaria_<stem>.json`. Caso `compareWithPath` seja fornecido, gera o diff documental completo em `state/diff_documental_<stem>.md` e `.json`. Reconstrói visualmente a numeração de listas nativas (`word/numbering.xml` + `<w:numPr>`), gera o espelho linear de auditoria `state/visao_auditoria_<nome>.md` (Bloco 1 Cartográfico + Radar Z1..Z14 + Auditoria Orçamentária e Bloco 2 integral paginado `[PAG_XXX | LYYYY]` ou `[P...]`), gera o dossiê executivo de pontos quentes `state/dossie_hotspots_<nome>.md` (com contexto expandido ±12 linhas) e devolve no MCP sumário sintético `toc_summary` (< 1 KB, margem segura < 920 bytes) com `dossie_hotspots_path`, métricas de `budget_audit` e `diff_summary`.

### 2.3. build_docx_template
Transforma documento Word (.docx) bruto em template parametrizado com tags `{{...}}` preservando 100% da formatação OpenXML (<w:pPr>, <w:rPr>, estilos, cabeçalhos e tabelas).
- **Resiliência de Diretórios e Zero ENOENT (v0.7.3):** Garante a criação recursiva automática de qualquer pasta pai de `outputPath` antes da gravação do arquivo.
- **Sanitização de Tags JS e Validação Léxica Precoce (v0.7.2):** Converte automaticamente notação de ponto numérico (ex.: `itens.0.qtd` -> `itens[0].qtd`). Valida a sintaxe léxica das tags antes de gravar o template: identificadores com hífen (kebab-case, ex.: `{{meu-slot}}`) ou iniciando por dígito (`{{1_item}}`) são barrados com Exact Copy-Paste Error sugerindo a forma canônica snake_case.
- **Validação Fail-Fast e Exact Copy-Paste Error (v0.6.2):** Proíbe chaves inventadas (ex.: `loop_var`, `items_expr`, `cell_slots`, `row_index` em `loop_table_rows`) e rejeita manifestos com 0 regras ou que resultem em 0 slots aplicados.
- **Contrato Canônico de `slots_manifest.json`:**
```json
{
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
}
```
- **Formato Canônico Detalhado com Arrays na Raiz:**
```json
{
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
}
```

### 2.4. fill_docx_template
Injeta os dados de `estado_caso.json` no template .docx gerado.
- Desaninhamento (*unflatten*) automático e expansão de arrays indexados (ex.: `"etp.necessidade"`, `"itens.0.qtd"` ou `"itens[0].qtd"`).
- Auto-sanitização prévia de templates legados contendo tags com pontos numéricos antes da compilação pelo `docx-templates`.
- Negrito seletivo: strings com `**texto**` são convertidas em runs <w:b/> sem contaminação de estilo.
- Quebras de linha: `\n` em variáveis geram múltiplos parágrafos <w:p> preservando estilos de corpo.
- **Motor Híbrido de Lista Multinível Nativa (v0.7.0):**
  - Fora de tabelas (`<w:body>`): gera `word/numbering.xml` (9 níveis decimais com `<w:suff w:val="tab"/>`), aplica `<w:numPr>` com `<w:startOverride>` sincronizado com o capítulo pai e remove o prefixo numérico literal do `<w:t>`.
  - Dentro de tabelas (`<w:tc>`) ou em alíneas/bullets: mantém o marcador literal separado por `<w:r><w:tab/></w:r>` e aplica *Hanging Indent* (`<w:ind w:left w:hanging>` + `<w:tabs>`).
- **Pipeline Híbrido de Exportação DOCX para PDF (v0.9.5 / v1.0.0):** Suporta `outputFormat: "docx" | "pdf" | "both"` com conversão de alta fidelidade visual (Tier 1 Word COM / Tier 2 Pure-JS).
- **Auto-Inspeção Integrada:** Salva automaticamente `state/inspecao_<stem>.json` e o espelho linear de auditoria `state/visao_auditoria_<stem>.md` na pasta `state/` do caso (auto-inspecionando o PDF gerado caso `outputFormat: "pdf"`), dispensando rodar `inspect_doc` novamente.
- **Retorno Sintético MCP (< 1 KB):** Devolve `status`, `engine_version`, `outputPath`, `pdf_path` (se gerado), `inspection_path`, `visao_auditoria_path` e `next_step_hint` que orienta o acionamento direto do auditor externo sobre a visão linear gerada.

### 2.5. generate_audit_docx
Compila o parecer executivo de auditoria de controle externo em layout vertical A4 (ZERO tabelas <w:tbl>, 100% largura útil), com sanitização de crases e enums, fichas verticais e transcrições integrais em blocos de citação recuados.
- **Validação Fail-Fast e Exact Copy-Paste Error (v0.6.2):** Campos obrigatórios `processo_id` e `resumo_executivo` devem ser strings não-vazias; `apontamentos` deve ser array.
- **Exportação para PDF (v0.9.5 / v1.0.0):** Suporta `outputFormat: "docx" | "pdf" | "both"` com conversão via Pipeline Híbrido.
- **Retorno Sintético MCP (< 1 KB):** Devolve JSON sintético com `status`, `engine_version`, `outputPath`, `pdf_path` (se gerado), `message` e `next_step_hint`.
- **Contrato Canônico de `relatorio_auditoria.json`:**
```json
{
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
}
```

### 2.6. generate_technical_note_docx
Gera Nota Técnica Comparativa de Evolução Documental ('Antes vs. Depois', Marco 6) em formato Word (.docx) e PDF em layout editorial vertical A4 (ZERO tabelas <w:tbl>, 100% largura útil), com destaque visual colorido por cards com bordas laterais (verde para inclusão, vermelho para supressão, azul para alteração), diff inline em nível de token e fundamentação técnica/jurídica individualizada por cláusula.
- **Modos Híbridos:** Suporta modo direto via `noteJsonPath` ou modo comparativo automático derivado a partir de `oldPath` e `newPath` (com enriquecimento opcional via `noteJsonPath`).
- **Validação Fail-Fast e Exact Copy-Paste Error:** Validação estrita de contrato impedindo geração com campos obrigatórios ausentes.
- **Exportação para PDF:** Suporta `outputFormat: "docx" | "pdf" | "both"` via Pipeline Híbrido (Tier 1 COM / Tier 2 Pure-JS).
- **Retorno Sintético MCP (< 1 KB, margem < 900 bytes):** Devolve `status`, `engine_version`, `document_type: "TECHNICAL_NOTE"`, `outputPath`, `pdf_path` (se gerado), `total_changes`, `message` e `next_step_hint`.
- **Contrato Canônico de `nota_tecnica.json`:**
```json
{
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
}
```

---

## 3. Cache Global, Rastreabilidade Temporal e Sanity Check (core/registry/templates/)
- Os templates homologados são armazenados em `core/registry/templates/<template_id>.json` com `created_at`, `updated_at`, `engine_version` e `slots_count`.
- Ao atualizar um template já existente no disco, o `created_at` original é preservado e `updated_at` é renovado.
- Caches legados sem `created_at` ou `updated_at` são aceitos sem erro e sem usar `mtime` do disco, reportando `"NÃO DISPONÍVEL"`, `age_days: null` e `cache_date_status: "UNKNOWN"` para informar ao usuário no Gate 1.
- O método `loadAllRegistryTemplates` executa normalização automática em cada entrada e descarta silenciosamente manifestos corrompidos com 0 regras.