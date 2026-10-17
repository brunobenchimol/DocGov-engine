export const VERSION = "0.6.4";
export const GITHUB_REPO = "brunobenchimol/docgov-docx-engine";

// ============================================================================
// Autodescoberta MCP (Self-Discovery): Instruções e Guias Nativos
// ============================================================================

export const DOCX_ENGINE_INSTRUCTIONS = `
Servidor MCP standalone para manipulação, engenharia reversa, construção de templates, injeção de dados e auditoria técnico-jurídica de documentos Microsoft Word (.docx) no ecossistema DocGov.

### Ordem Canônica do Pipeline de Documentos (.docx):
1. **bootstrap_case**: Inicializa a estrutura de pastas do caso (inputs/, state/, output/), preserva nomes legíveis, infere extensões via magic bytes (PK\\x03\\x04 e %PDF), auto-batiza anexos opacos (media_*) com tipo semântico e hash curto (ex.: ETP_ORGAO_A_3b9d.docx) ou aplica 'fileRenameMap', copia e inspeciona imediatamente minutas .docx para inputs/ (gerando state/estrutura_<nome>.json com toc_map) e inicia salvaguarda assíncrona de PDFs.
2. **inspect_docx**: Realiza a engenharia reversa estrutural de qualquer .docx bruto, construindo no topo do JSON o índice estrutural rápido 'toc_map' (seções P..., campos de formulário T...R...C... com suggested_target_slot e resumo de tabelas), calculando a impressão digital estrutural ('structure_fingerprint'), realizando matching 1-para-N contra o cache global ('core/registry/templates/') com rastreabilidade temporal (created_at, updated_at, age_days, cache_date_status, engine_version, slots_count), reancorando automaticamente coordenadas deslocadas (Auto-Offset gerando 'state/adapted_slots_manifest.json' em caso de drift 75%-99%), gerando a visão linear compacta de auditoria ('state/visao_auditoria_<nome>.md') e devolvendo no MCP um 'toc_summary' conciso (< 1 KB).
3. **build_docx_template**: Transforma o .docx bruto em um template parametrizado com tags {{...}} a partir das regras do slots_manifest.json (com auto-reparo e diagnóstico cirúrgico de JSON), preservando 100% da formatação visual (<w:pPr>, <w:rPr>, estilos e tabelas). Suporta coordenadas compactas (ex.: 'coord': 'T0.R1.C1' ou 'P2', com ou sem colchetes), array unificado 'slots', aliases, validação fail-fast estrita com padrão Exact Copy-Paste Error (Zero Silent No-Op com contagem de applied_slots_count) e a opção 'saveToRegistry: true' para homologar e persistir o manifesto no cache global cross-órgão.
4. **fill_docx_template**: Injeta os dados do estado_caso.json no template .docx gerado (com unflatten automático de chaves com notação de ponto, ex.: "etp.necessidade"), resolvendo variáveis simples, loops FOR em tabelas, blocos IF, quebras de linha em múltiplos parágrafos, negrito seletivo e listas recursivas multinível. Executa automaticamente a inspeção estrutural pós-compilação gravando 'state/inspecao_<stem>.json' e 'state/visao_auditoria_<stem>.md' na pasta state/ do caso para dispensar rodar inspect_docx novamente antes da auditoria externa.
5. **generate_audit_docx**: Compila o relatório executivo de auditoria de controle externo a partir de relatorio_auditoria.json em layout vertical A4 (zero tabelas <w:tbl>, 100% largura útil), com validação fail-fast com padrão Exact Copy-Paste Error, fichas individualizadas e transcrições probatórias integrais.

### Sintaxe Suportada de Tags e Recursos de Resiliência:
- Rastreabilidade Temporal do Cache & Retrocompatibilidade Estrita (v0.6.4): Gravação e leitura de 'created_at', 'updated_at', 'age_days', 'cache_date_status', 'engine_version' e 'slots_count' no cache global, preservando 'created_at' original em atualizações e suportando caches legados sem datas (reportando 'NÃO DISPONÍVEL' / 'age_days: null' sem usar mtime do disco) para decisão informada no Gate 1.
- Arquitetura Modular & Re-export Barrel (v0.6.3): Decomposição limpa do motor em submódulos especializados (types, core, tools, mcp, cli) mantendo 100% de compatibilidade retroativa e integridade de exportações.
- Especificação Técnica de Consumo (--dump-spec v0.6.4): Flag CLI para exportação da especificação normativa de consumo do motor em Markdown (UTF-8).
- Padrão Exact Copy-Paste Error (v0.6.2): Validação fail-fast estrita em slots_manifest.json e relatorio_auditoria.json. Caso ocorra erro de contrato ou 0 slots sejam aplicados, o motor interrompe com instrução imperativa e snippet JSON canônico completo pronto para copiar e colar.
- Coordenadas Compactas & Normalização Universal (v0.6.1): Suporte nativo a 'coord': 'T0.R1.C1' e 'coord': 'P2' (com ou sem colchetes), array unificado 'slots: [...]' ou array puro na raiz, aliases ('col_index', 'paragraph_index') e parsing automático para arrays canônicos.
- Validação Fail-Fast Zero Silent No-Op (v0.6.1): Rejeição imediata com erro descritivo caso o manifesto tenha 0 regras reconhecidas ou resulte em 0 slots aplicados no OpenXML, impedindo salvar templates vazios ou persistir lixo no cache.
- Sanity Check de Cache Global (v0.6.1): O carregamento em loadAllRegistryTemplates normaliza os manifestos e descarta silenciosamente entradas corrompidas com 0 regras.
- Cache Global Cross-Órgão & Matching 1-para-N (v0.6.0): Identificação automática de templates homologados (status EXACT, MODIFIED ou NEW) em core/registry/templates/.
- Reancoragem Automática de Coordenadas (Auto-Offset v0.6.0): Detecção de drift (75% a 99%) por emparelhamento de rótulos/perguntas de formulário e cabeçalhos de tabelas, gerando adapted_slots_manifest.json automaticamente.
- Visão Linear Compacta de Auditoria (v0.6.0): Geração de visao_auditoria_<doc>.md contendo ordenação sequencial estrita com marcadores técnicos [P...] e [T...R...C...], permitindo leitura cega integral em 1 único turno.
- Variáveis Simples: {{variavel}} ou {{objeto.propriedade}}
- Notação de Ponto Resiliente: Chaves na raiz como "etp.necessidade" são automaticamente desaninhadas (unflattened) para resolver {{etp.necessidade}}.
- Loops em Tabelas e Listas: {{FOR item IN lista}} ... {{$item.prop}} ... {{END-FOR item}}
- Condicionais: {{IF condicao}} ... {{END-IF}}
- Negrito Seletivo: **texto em negrito** dentro de strings é convertido automaticamente em runs <w:b/> sem herança indevida do estilo do subtítulo.
- Quebras de Linha: Quebras '\\n' em variáveis de texto são desmembradas em parágrafos <w:p> reais preservando formatação de corpo.
- Listas Hierárquicas Multinível: Suporte nativo a subitens numerados (1.1, 1.1.1, 1.1.1.1, 1.1.1.1.1) com recuo progressivo <w:ind> e achatamento recursivo de árvores de subitens.
- Tolerância a JSON: Parser tolerante automático (safeReadJsonFile) com auto-reparo de BOM, trailing commas e quebras de linha literais em strings, além de diagnóstico cirúrgico com linha/coluna e snippet de 5 linhas numeradas com marcador <-- ERRO AQUI.
- Nomenclatura Semântica & Magic Bytes: Preservação de nomes humanos, auto-batismo de uploads anônimos (media_*) com prefixo semântico e hash curto de 4 caracteres, e inferência de extensão por magic bytes (PK\\x03\\x04 para .docx e %PDF para .pdf).
`.trim();

export const DOCX_WORKFLOW_GUIDE_TEXT = `
# Guia de Arquitetura e Engenharia de Templates Word (.docx) — docgov-docx (v0.6.4)

Este guia orienta agentes de IA e clientes MCP no ciclo completo de tratamento de documentos do ecossistema DocGov.

---

## 1. Pipeline Canônico de 5 Passos

### Passo 1: Inicialização do Caso (bootstrap_case)
- **Chamada:** \`bootstrap_case({ caseDir: "cases/<nome_caso>", uploadsDir: ".user_uploaded", fileRenameMap: { "media_179...": "ETP_Modelo.docx" } })\`
- **Efeito:**
  - Cria as pastas \`inputs/\`, \`state/\` e \`output/\`.
  - Resolve nomes legíveis: preserva nomes originais humanos, aceita \`fileRenameMap\` explícito ou realiza auto-batismo semântico de anexos opacos (\`media_*\` -> \`<TIPO>_<ORGAO>_<hash4>.<ext>\`) com inferência de extensão via magic bytes (\`PK\\x03\\x04\` para .docx e \`%PDF\` para .pdf).
  - Copia minutas \`.docx\` para \`inputs/\` e as inspeciona instantaneamente, gravando \`state/estrutura_<stem>.json\` com \`toc_map\`, matching contra cache global e gerando \`state/visao_auditoria_<stem>.md\`.
  - Inicia a cópia em segundo plano de PDFs volumosos (acompanhamento via \`state/salvaguarda_status.json\`).
  - Retorna um JSON sintético (< 1 KB) com status, contadores, \`ingested_files\` e referências dos arquivos.

### Passo 2: Mapeamento Estrutural e Cache Global (inspect_docx)
- **Chamada:** \`inspect_docx({ docxPath: "cases/<nome_caso>/inputs/modelo_etp.docx", outputPath: "cases/<nome_caso>/state/estrutura_etp.json", compact: true })\`
- **Efeito:**
  - Analisa o OpenXML bruto (\`document.xml\`, \`header1.xml\`, \`footer1.xml\`).
  - Constrói o índice estrutural rápido \`toc_map\` no topo do JSON.
  - Extrai a impressão digital estrutural (\`structure_fingerprint\`) e compara contra todos os templates salvos em \`core/registry/templates/\`, expondo rastreabilidade temporal (\`created_at\`, \`updated_at\`, \`age_days\`, \`cache_date_status\`, \`engine_version\`, \`slots_count\`) com retrocompatibilidade para caches legados:
    - **EXACT (100%):** Devolve \`template_match: { status: "EXACT", registry_path: "...", created_at, updated_at, age_days, slots_count }\`.
    - **MODIFIED (75% a 99%):** Calcula deslocamento de linhas (*Auto-Offset*), gera automaticamente \`state/adapted_slots_manifest.json\` e devolve \`status: "MODIFIED"\`.
    - **NEW (< 75%):** Devolve \`status: "NEW"\`.
  - Gera em \`state/\` o espelho linear \`visao_auditoria_<nome_base>.md\` para leitura em turno único pelo auditor externo.
  - Retorna um sumário executivo conciso (\`toc_summary\`) de tamanho < 1 KB no corpo da chamada MCP com \`template_match\` e \`audit_view_path\`.

### Passo 3: Parametrização do Template (build_docx_template)
- **Chamada:** \`build_docx_template({ sourcePath: "cases/<nome_caso>/inputs/modelo_etp.docx", manifestPath: "cases/<nome_caso>/state/slots_manifest.json", outputPath: "cases/<nome_caso>/state/template_etp.docx", saveToRegistry: true })\`
- **Padrão Exact Copy-Paste Error (v0.6.2):** Se o manifesto contiver chaves inválidas (como \`loop_var\`, \`items_expr\`, \`cell_slots\` em \`loop_table_rows\` ou chaves desconhecidas na raiz) ou se 0 slots forem aplicados, o motor interrompe imediatamente com o padrão imperativo:
  *"NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:"*
  acompanhado do snippet canônico pronto para copiar e colar.
- **Normalização Universal & Coordenadas Compactas (v0.6.1):** Aceita coordenadas compactas diretamente do \`toc_map\` (ex.: \`"coord": "T0.R1.C1"\` ou \`"coord": "P3"\`, com ou sem colchetes \`[T0.R1.C1]\`), array raiz unificado \`slots: [...] \` ou array puro na raiz.
- **Validação Fail-Fast (Zero Silent No-Op v0.6.1):** Se o manifesto tiver 0 regras reconhecidas ou se 0 slots forem aplicados no OpenXML, a execução falha imediatamente com erro detalhado. O arquivo de saída não é gravado e o cache não é corrompido.
- **Tolerância a JSON:** Se o \`slots_manifest.json\` contiver trailing commas ou quebras em strings, o motor repara automaticamente o arquivo e o regrava limpo.
- **Homologação Global:** Com \`saveToRegistry: true\`, persiste o manifesto e a impressão digital no registro global \`core/registry/templates/<template_id>.json\` para reuso futuro.
- **Estruturas Suportadas de slots_manifest.json:**
  - *Estilo Compacto (Recomendado):*
\`\`\`json
{
  "slots": [
    { "coord": "P3", "tag": "{{estudo.descricao_necessidade}}" },
    { "coord": "T0.R0.C1", "tag": "{{metadados.unidade_requisitante}}" },
    { "find": "Texto Antigo Fixo", "replace": "{{metadados.orgao}}" }
  ]
}
\`\`\`
  - *Estilo Canônico Detalhado:*
\`\`\`json
{
  "replace_paragraphs": [
    { "start_p": 3, "end_p": 5, "tag": "{{estudo.descricao_necessidade}}" }
  ],
  "replace_table_cells": [
    { "table_index": 0, "row_index": 0, "cell_index": 1, "tag": "{{metadados.unidade_requisitante}}" }
  ],
  "loop_table_rows": [
    {
      "table_index": 1,
      "header_row_index": 0,
      "template_row_index": 1,
      "remove_from_row": 2,
      "remove_to_row": 6,
      "for_open_tag": "{{FOR r IN gestao_riscos}}",
      "for_close_tag": "{{END-FOR r}}",
      "cell_tags": ["{{$r.risco}}", "{{$r.mitigacao}}"]
    }
  ],
  "replace_inline": [
    { "find": "Texto Antigo Fixo", "replace": "{{metadados.orgao}}" }
  ]
}
\`\`\`

### Passo 4: Injeção de Dados e Auto-Inspeção Integrada (fill_docx_template)
- **Chamada:** \`fill_docx_template({ templatePath: "cases/<nome_caso>/state/template_etp.docx", statePath: "cases/<nome_caso>/state/estado_caso.json", outputPath: "cases/<nome_caso>/output/ETP_Final.docx" })\`
- **Recursos Nativos:**
  - Auto-saneamento de JSON e desaninhamento (*unflatten*) automático de chaves com notação de ponto (ex.: \`"etp.objeto": "..."\`).
  - Textos com \`**negrito**\` são renderizados em negrito seletivo (<w:b/>) sem contaminação do parágrafo.
  - Quebras \`\\n\` são convertidas em parágrafos reais <w:p>.
  - Listas multinível (\`1.1\`, \`1.1.1\`) são expandidas com indentação progressiva <w:ind>.
  - **Auto-Inspeção Integrada:** Grava automaticamente \`state/inspecao_<stem>.json\` e o espelho linear de auditoria \`state/visao_auditoria_<stem>.md\` na pasta \`state/\` do caso, dispensando rodar \`inspect_docx\` novamente.
  - Retorna payload sintético (< 1 KB) contendo \`status\`, \`outputPath\`, \`inspection_path\`, \`visao_auditoria_path\` e \`next_step_hint\` orientando acionar diretamente o Auditor Externo lendo a visão linear gerada.

### Passo de Transição: Leitura Integral para Auditoria Externa
- Graças à auto-inspeção integrada do \`fill_docx_template\`, o espelho linear \`state/visao_auditoria_<stem>.md\` já é gerado automaticamente em \`state/\`.
- O auditor externo pode ler o arquivo \`state/visao_auditoria_<stem>.md\` integralmente em **1 único turno** com as coordenadas técnicas \`[P...]\` e \`[T...R...C...]\` prontas para transcrição probatória, dispensando rodar \`inspect_docx\` novamente.

### Passo 5: Parecer Executivo de Auditoria (generate_audit_docx)
- **Chamada:** \`generate_audit_docx({ auditJsonPath: "cases/<nome_caso>/state/relatorio_auditoria.json", outputPath: "cases/<nome_caso>/output/Relatorio_Auditoria_ETP.docx" })\`
- **Características:**
  - Layout editorial vertical A4 corrido (ZERO tabelas <w:tbl>, 100% largura útil).
  - Padrão Exact Copy-Paste Error: rejeição fail-fast estrita caso campos obrigatórios (\`processo_id\`, \`resumo_executivo\`) estejam ausentes.
  - Sanitização de crases markdown, coordenadas técnicas e códigos de enum.
  - Fichas verticais individualizadas com múltiplos trechos probatórios transcritos em blocos de citação recuados.
`.trim();

