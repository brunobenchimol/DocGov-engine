export const VERSION = "0.9.5";
export const GITHUB_REPO = "brunobenchimol/docgov-docx-engine";

// ============================================================================
// Autodescoberta MCP (Self-Discovery): Instruções e Guias Nativos
// ============================================================================

export const DOCX_ENGINE_INSTRUCTIONS = `
Servidor MCP standalone determinístico (docgov-engine / docgov-docx-engine v0.9.5) para manipulação, engenharia reversa estrutural de documentos PDF (.pdf com agrupamento Y e colunas) e Microsoft Word (.docx), Cartografia Estrutural Sem IA, Dossiê de Hotspots, Índice Cartográfico Mestre Unificado, Radar Determinístico das 14 Zonas de Impugnação (Z1 a Z14), construção de templates, injeção de dados, conversão híbrida para PDF e auditoria técnico-jurídica no ecossistema DocGov.

### Ordem Canônica do Pipeline de Documentos (.pdf e .docx):
1. **bootstrap_case**: Inicializa a estrutura completa de pastas do caso (inputs/, state/, templates/, output/), preserva nomes legíveis, infere extensões via magic bytes (PK\\x03\\x04 e %PDF), auto-batiza anexos opacos (media_*) com tipo semântico e hash curto (ex.: ETP_ORGAO_A_3b9d.docx) ou aplica 'fileRenameMap', copia e inspeciona imediatamente minutas .docx e editais/anexos .pdf (validando Magic Bytes %PDF-) em inputs/, detecta páginas escaneadas como imagem ('scanned_pages_detected'), gerando state/estrutura_<nome>.json (com toc_map, outline_headings, page_signals e impugnation_zones Z1..Z14), state/visao_auditoria_<nome>.md (com Bloco 1 Cartográfico + Radar das 14 Zonas e Bloco 2 paginado [PAG_XXX | LYYYY] ou [P...]), state/dossie_hotspots_<nome>.md (contexto cirúrgico expandido ±12 linhas) e o consolidado multi-documento state/indice_mestre_caso.md (matriz cruzada de zonas Z1..Z14 e alertas globais), além de salvaguarda de anexos.
2. **inspect_docx**: Realiza a engenharia reversa estrutural completa de qualquer arquivo .docx ou .pdf bruto (com agrupamento Y e separação colunar com ' | '), construindo no topo do JSON o índice estrutural rápido 'toc_map', a Cartografia Estrutural em 3 camadas ('outline_headings', 'page_signals' e 'impugnation_zones' Z1..Z14), calculando a impressão digital estrutural ('structure_fingerprint' para .docx), detectando páginas escaneadas como imagem ('scanned_pages_detected'), gerando o dossiê executivo de pontos quentes ('state/dossie_hotspots_<nome>.md' com ±12 linhas de contexto), realizando matching 1-para-N contra o cache global ('core/registry/templates/') com rastreabilidade temporal (created_at, updated_at, age_days, cache_date_status, engine_version, slots_count), reancorando automaticamente coordenadas deslocadas (Auto-Offset gerando 'state/adapted_slots_manifest.json' em caso de drift 75%-99%), reconstruindo visualmente a numeração de listas nativas ('word/numbering.xml' + '<w:numPr>'), gerando a visão linear compacta de auditoria ('state/visao_auditoria_<nome>.md' com Bloco 1: Mapa Cartográfico + Radar Z1..Z14 e Bloco 2: texto integral [PAG_XXX | LYYYY] ou [P...]) e devolvendo no MCP um 'toc_summary' conciso (< 1 KB).
3. **build_docx_template**: Transforma o .docx bruto em um template parametrizado com tags {{...}} a partir das regras do slots_manifest.json (com auto-reparo e diagnóstico cirúrgico de JSON), preservando 100% da formatação visual (<w:pPr>, <w:rPr>, estilos e tabelas). Suporta coordenadas compactas (ex.: 'coord': 'T0.R1.C1' ou 'P2', com ou sem colchetes), array unificado 'slots', aliases, auto-normalização de índices numéricos de ponto (ex.: 'itens.0.qtd' -> 'itens[0].qtd'), validação léxica precoce de tags JS com padrão Exact Copy-Paste Error (Zero Silent No-Op com contagem de applied_slots_count), criação recursiva automática de diretórios pais (Zero ENOENT) e a opção 'saveToRegistry: true' para homologar e persistir o manifesto no cache global cross-órgão.
4. **fill_docx_template**: Injeta os dados do estado_caso.json no template .docx gerado (com unflatten automático de chaves com notação de ponto ou colchetes, ex.: "etp.necessidade" ou "itens.0.qtd"), resolvendo variáveis simples, loops FOR em tabelas, blocos IF, quebras de linha em múltiplos parágrafos, negrito seletivo e listas recursivas multinível via Motor Híbrido (v0.7.0: lista nativa 'word/numbering.xml' + '<w:numPr>' com '<w:startOverride>' fora de tabelas e Hanging Indent estático com '<w:tab/>' dentro de tabelas). Suporta 'outputFormat: \"docx\" | \"pdf\" | \"both\"' (v0.9.5), convertendo via Pipeline Híbrido (Tier 1 Word COM / Tier 2 Pure-JS) e auto-inspecionando o documento gerado (incluindo o PDF quando selecionado) em 'state/inspecao_<stem>.json' e 'state/visao_auditoria_<stem>.md' para dispensar rodar inspect_docx novamente antes da auditoria externa.
5. **generate_audit_docx**: Compila o relatório executivo de auditoria de controle externo a partir de relatorio_auditoria.json em layout vertical A4 (zero tabelas <w:tbl>, 100% largura útil), com validação fail-fast com padrão Exact Copy-Paste Error, fichas individualizadas, transcrições probatórias integrais e suporte a 'outputFormat: \"docx\" | \"pdf\" | \"both\"' (v0.9.5).

### Sintaxe Suportada de Tags e Recursos de Resiliência:
- Pipeline Híbrido de Exportação DOCX para PDF (v0.9.5): Conversão de alta fidelidade visual com seleção automática em 2 níveis: Tier 1 (MS Word COM via PowerShell no Windows/WSL Interop com 100% de fidelidade) e Tier 2 (Pure-JS standalone determinístico com pdf-lib + xmldom + JSZip sem dependências de SO). Suportado nas ferramentas fill_docx_template e generate_audit_docx via parâmetro outputFormat ('docx' | 'pdf' | 'both') e na CLI via flag --format.
- Extração Avançada de PDF, Reconstrução de Colunas & Dossiê de Hotspots (v0.9.0): Agrupamento de linhas no eixo Y (2.5pt de tolerância) e separador de colunas (' | ' para gutters >= 18pt), geração de dossiê cirúrgico de pontos quentes ('state/dossie_hotspots_<stem>.md' com ±12 linhas de contexto nas 14 zonas e densidades técnicas), detecção de armadilhas de OCR ('scanned_pages_detected' para < 25 chars/página) e Índice Cartográfico Mestre Unificado Multi-Documento ('state/indice_mestre_caso.md') no bootstrap_case.
- Suporte Nativo a PDF, Cartografia Estrutural Sem IA & Radar das 14 Zonas de Impugnação (v0.8.0 / v0.8.1): Extração paginada de arquivos .pdf com coordenada dupla [PAG_XXX | LYYYY], analisador heurístico em 3 camadas (Camada 1: 'outline_headings', Camada 2: 'page_signals' para tabelas de orçamento/itens e especificações técnicas/datasheet, Camada 3: 'impugnation_zones' Z1..Z14 separando Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP, Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO e Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO, além de cruzamento multipeça Z12_MAPA_CRUZADO_MULTIPECA) integrado tanto em 'bootstrap_case' quanto em 'inspect_docx' (.pdf e .docx).
- Resiliência de Diretórios & Zero ENOENT (v0.7.3): Criação recursiva mandatória do diretório pai em 'build_docx_template' e inclusão antecipada da pasta 'templates/' na árvore canônica criada por 'bootstrap_case', eliminando em definitivo falhas ENOENT de gravação.
- Sanitização de Tags JS & Validação Léxica Precoce (v0.7.2): Auto-normalização de índices numéricos por ponto ('itens.0.qtd' -> 'itens[0].qtd') em manifestos e templates OpenXML, unflatten bidirecional em JSON plano/aninhado e validação precoce no 'build_docx_template' barrando variáveis com hífen ou dígitos iniciais com padrão Exact Copy-Paste Error e sugestão snake_case.
- Rastreabilidade de Versão MCP (v0.7.1 / v0.7.2 / v0.7.3 / v0.8.0 / v0.8.1 / v0.9.0 / v0.9.5): Inclusão do campo 'engine_version' na raiz do payload JSON sintético retornado por todas as 5 ferramentas MCP (bootstrap_case, inspect_docx, build_docx_template, fill_docx_template e generate_audit_docx) para consumo imediato pelo agente.
- Motor Híbrido de Lista Multinível Nativa (v0.7.0): Fora de tabelas (<w:body>), desmembra subitens decimais (ex.: 4.1, 4.1.1) em lista multinível nativa do Word ('word/numbering.xml' de 9 níveis com '<w:suff w:val="tab"/>', '<w:numPr>' e '<w:startOverride>' sincronizado com o capítulo pai, limpando o prefixo literal do '<w:t>'). Dentro de tabelas (<w:tc>) ou em alíneas/bullets, aplica Hanging Indent estático ('<w:ind w:left w:hanging>' + '<w:tabs>') separando o número literal com '<w:r><w:tab/></w:r>'.
- Rastreabilidade Temporal do Cache & Retrocompatibilidade Estrita (v0.6.4): Gravação e leitura de 'created_at', 'updated_at', 'age_days', 'cache_date_status', 'engine_version' e 'slots_count' no cache global, preservando 'created_at' original em atualizações e suportando caches legados sem datas (reportando 'NÃO DISPONÍVEL' / 'age_days: null' sem usar mtime do disco) para decisão informada no Gate 1.
- Arquitetura Modular & Re-export Barrel (v0.6.3): Decomposição limpa do motor em submódulos especializados (types, core, tools, mcp, cli) mantendo 100% de compatibilidade retroativa e integridade de exportações.
- Especificação Técnica de Consumo (--dump-spec v0.9.5): Flag CLI para exportação da especificação normativa de consumo do motor em Markdown (UTF-8).
- Padrão Exact Copy-Paste Error (v0.6.2): Validação fail-fast estrita em slots_manifest.json e relatorio_auditoria.json. Caso ocorra erro de contrato ou 0 slots sejam aplicados, o motor interrompe com instrução imperativa e snippet JSON canônico completo pronto para copiar e colar.
- Coordenadas Compactas & Normalização Universal (v0.6.1): Suporte nativo a 'coord': 'T0.R1.C1' e 'coord': 'P2' (com ou sem colchetes), array unificado 'slots: [...]' ou array puro na raiz, aliases ('col_index', 'paragraph_index') e parsing automático para arrays canônicos.
- Validação Fail-Fast Zero Silent No-Op (v0.6.1): Rejeição imediata com erro descritivo caso o manifesto tenha 0 regras reconhecidas ou resulte em 0 slots aplicados no OpenXML, impedindo salvar templates vazios ou persistir lixo no cache.
- Sanity Check de Cache Global (v0.6.1): O carregamento em loadAllRegistryTemplates normaliza os manifestos e descarta silenciosamente entradas corrompidas com 0 regras.
- Cache Global Cross-Órgão & Matching 1-para-N (v0.6.0): Identificação automática de templates homologados (status EXACT, MODIFIED ou NEW) em core/registry/templates/.
- Reancoragem Automática de Coordenadas (Auto-Offset v0.6.0): Detecção de drift (75% a 99%) por emparelhamento de rótulos/perguntas de formulário e cabeçalhos de tabelas, gerando adapted_slots_manifest.json automaticamente.
- Visão Linear Compacta de Auditoria & Dossiê de Hotspots (v0.6.0 / v0.8.0 / v0.8.1 / v0.9.0): Geração de visao_auditoria_<doc>.md contendo no Bloco 1 o Mapa Cartográfico Estrutural e Radar das 14 Zonas de Impugnação (Z1..Z14) e no Bloco 2 a ordenação sequencial estrita com marcadores técnicos [PAG_XXX | LYYYY], [P...] e [T...R...C...], complementado pelo dossie_hotspots_<doc>.md com recortes cirúrgicos contíguos de ±12 linhas.
- Variáveis Simples: {{variavel}} ou {{objeto.propriedade}}
- Notação de Ponto Resiliente: Chaves na raiz como "etp.necessidade" ou "itens.0.qtd" são automaticamente desaninhadas (unflattened) para resolver {{etp.necessidade}} ou {{itens[0].qtd}}.
- Loops em Tabelas e Listas: {{FOR item IN lista}} ... {{$item.prop}} ... {{END-FOR item}}
- Condicionais: {{IF condicao}} ... {{END-IF}}
- Negrito Seletivo: **texto em negrito** dentro de strings é convertido automaticamente em runs <w:b/> sem herança indevida do estilo do subtítulo.
- Quebras de Linha: Quebras '\\n' em variáveis de texto são desmembradas em parágrafos <w:p> reais preservando formatação de corpo.
- Listas Hierárquicas Multinível: Suporte nativo híbrido a subitens numerados (1.1, 1.1.1, 1.1.1.1, 1.1.1.1.1) com 'word/numbering.xml' fora de tabelas, Hanging Indent com '<w:tab/>' dentro de tabelas e achatamento recursivo de árvores de subitens.
- Tolerância a JSON: Parser tolerante automático (safeReadJsonFile) com auto-reparo de BOM, trailing commas e quebras de linha literais em strings, além de diagnóstico cirúrgico com linha/coluna e snippet de 5 linhas numeradas com marcador <-- ERRO AQUI.
- Nomenclatura Semântica & Magic Bytes: Preservação de nomes humanos, auto-batismo de uploads anônimos (media_*) com prefixo semântico e hash curto de 4 caracteres, e inferência de extensão por magic bytes (PK\\x03\\x04 para .docx e %PDF para .pdf).
`.trim();

export const DOCX_WORKFLOW_GUIDE_TEXT = `
# Guia de Arquitetura e Engenharia de Documentos (.pdf e .docx) — docgov-engine / docgov-docx (v0.9.5)

Este guia orienta agentes de IA e clientes MCP no ciclo completo de tratamento e auditoria de documentos (.pdf e .docx) do ecossistema DocGov.

---

## 1. Pipeline Canônico de 5 Passos

### Passo 1: Inicialização do Caso (bootstrap_case)
- **Chamada:** \`bootstrap_case({ caseDir: "cases/<nome_caso>", uploadsDir: ".user_uploaded", fileRenameMap: { "media_179...": "ETP_Modelo.docx" } })\`
- **Efeito:**
  - Cria as pastas \`inputs/\`, \`state/\`, \`templates/\` e \`output/\`.
  - Resolve nomes legíveis: preserva nomes originais humanos, aceita \`fileRenameMap\` explícito ou realiza auto-batismo semântico de anexos opacos (\`media_*\` -> \`<TIPO>_<ORGAO>_<hash4>.<ext>\`) com inferência de extensão via magic bytes (\`PK\\x03\\x04\` para .docx e \`%PDF\` para .pdf).
  - Copia e inspeciona instantaneamente todos os arquivos \`.docx\` e \`.pdf\` (validando Magic Bytes \`%PDF-\`) em \`inputs/\`, detectando páginas escaneadas como imagem (\`scanned_pages_detected\`), gravando \`state/estrutura_<stem>.json\` (com \`outline_headings\`, \`page_signals\`, \`impugnation_zones\` Z1..Z14 e \`toc_map\`), \`state/visao_auditoria_<stem>.md\` (Bloco 1 Cartográfico + Radar Z1..Z14 e Bloco 2 paginado \`[PAG_XXX | LYYYY]\` ou \`[P...]\`), \`state/dossie_hotspots_<stem>.md\` (contexto expandido cirúrgico ±12 linhas) e o consolidado multipeça \`state/indice_mestre_caso.md\` (inventário, matriz cruzada Z1..Z14 e alertas globais).
  - Retorna um JSON sintético (< 1 KB) com status, contadores, \`master_index_path\`, \`ingested_files\` e referências dos arquivos.

### Passo 2: Mapeamento Estrutural, Cartografia PDF/DOCX e Cache Global (inspect_docx)
- **Chamada:** \`inspect_docx({ docxPath: "cases/<nome_caso>/inputs/edital_licitacao.pdf", outputPath: "cases/<nome_caso>/state/estrutura_edital.json", compact: true })\`
- **Efeito:**
  - Suporta transparentemente tanto arquivos \`.pdf\` (com agrupamento Y com tolerância 2.5pt, separador de colunas \` | \` e detecção de páginas escaneadas com aviso crítico) quanto \`.docx\` (\`document.xml\`, \`header1.xml\`, \`footer1.xml\`, \`numbering.xml\`).
  - Executa a Cartografia Estrutural Determinística em 3 camadas (\`outline_headings\`, \`page_signals\` e Radar das 14 Zonas de Impugnação \`impugnation_zones\` Z1..Z14).
  - Em arquivos \`.docx\`, extrai a impressão digital estrutural (\`structure_fingerprint\`) e compara contra todos os templates salvos em \`core/registry/templates/\`, expondo rastreabilidade temporal (\`created_at\`, \`updated_at\`, \`age_days\`, \`cache_date_status\`, \`engine_version\`, \`slots_count\`) com retrocompatibilidade para caches legados:
    - **EXACT (100%):** Devolve \`template_match: { status: "EXACT", registry_path: "...", created_at, updated_at, age_days, slots_count }\`.
    - **MODIFIED (75% a 99%):** Calcula deslocamento de linhas (*Auto-Offset*), gera automaticamente \`state/adapted_slots_manifest.json\` e devolve \`status: "MODIFIED"\`.
    - **NEW (< 75%):** Devolve \`status: "NEW"\`.
  - Gera em \`state/\` o espelho linear \`visao_auditoria_<nome_base>.md\` (Bloco 1: Mapa Cartográfico + Radar das 14 Zonas e Bloco 2: Conteúdo Integral) e o dossiê executivo cirúrgico \`dossie_hotspots_<nome_base>.md\` (Bloco 1: Resumo Cartográfico e Bloco 2: Contexto expandido ±12 linhas de todas as ocorrências de Z1..Z14 e sinais técnicos/orçamentários).
  - Retorna um sumário executivo conciso (\`toc_summary\`) de tamanho < 1 KB no corpo da chamada MCP com \`template_match\`, \`audit_view_path\` e \`dossie_hotspots_path\`.

### Passo 3: Parametrização do Template (build_docx_template)
- **Chamada:** \`build_docx_template({ sourcePath: "cases/<nome_caso>/inputs/modelo_etp.docx", manifestPath: "cases/<nome_caso>/state/slots_manifest.json", outputPath: "cases/<nome_caso>/templates/template_etp.docx", saveToRegistry: true })\`
- **Resiliência de Diretórios (Zero ENOENT v0.7.3):** Garante a criação recursiva automática de qualquer pasta pai de \`outputPath\` antes da gravação do arquivo.
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
- **Chamada:** \`fill_docx_template({ templatePath: "cases/<nome_caso>/state/template_etp.docx", statePath: "cases/<nome_caso>/state/estado_caso.json", outputPath: "cases/<nome_caso>/output/ETP_Final.docx", outputFormat: "docx" | "pdf" | "both" })\`
- **Recursos Nativos:**
  - Auto-saneamento de JSON e desaninhamento (*unflatten*) automático de chaves com notação de ponto (ex.: \`"etp.objeto": "..."\`).
  - Textos com \`**negrito**\` são renderizados em negrito seletivo (<w:b/>) sem contaminação do parágrafo.
  - Quebras \`\\n\` são convertidas em parágrafos reais <w:p>.
  - **Motor Híbrido de Lista Multinível Nativa (v0.7.0):**
    - Fora de tabelas (\`<w:body>\`): gera lista multinível nativa em \`word/numbering.xml\` (9 níveis) com \`<w:numPr>\` e \`<w:startOverride>\` sincronizado com o capítulo pai, limpando o prefixo numérico literal do \`<w:t>\`.
    - Dentro de tabelas (\`<w:tc>\`): mantém o marcador literal separado por \`<w:r><w:tab/></w:r>\` com *Hanging Indent* (\`<w:ind w:left w:hanging>\` + \`<w:tabs>\`).
  - **Pipeline Híbrido de Exportação DOCX para PDF (v0.9.5):**
    - Suporta \`outputFormat: "docx" | "pdf" | "both"\`.
    - Seleção automática em 2 níveis: **Tier 1** (MS Word COM via PowerShell no Windows/WSL Interop com 100% de fidelidade visual) com fallback transparente para **Tier 2** (Pure-JS standalone determinístico via pdf-lib + xmldom + JSZip sem dependências de SO).
    - Quando \`outputFormat: "pdf"\`, a auto-inspeção analisa diretamente o arquivo \`.pdf\` gerado.
  - **Auto-Inspeção Integrada:** Grava automaticamente \`state/inspecao_<stem>.json\` e o espelho linear de auditoria \`state/visao_auditoria_<stem>.md\` na pasta \`state/\` do caso, dispensando rodar \`inspect_docx\` novamente.
  - Retorna payload sintético (< 1 KB) contendo \`status\`, \`outputPath\`, \`pdf_path\` (se gerado), \`inspection_path\`, \`visao_auditoria_path\` e \`next_step_hint\` orientando acionar diretamente o Auditor Externo lendo a visão linear gerada.

### Passo de Transição: Leitura Integral para Auditoria Externa
- Graças à auto-inspeção integrada do \`fill_docx_template\`, o espelho linear \`state/visao_auditoria_<stem>.md\` já é gerado automaticamente em \`state/\`.
- O auditor externo pode ler o arquivo \`state/visao_auditoria_<stem>.md\` integralmente em **1 único turno** com as coordenadas técnicas \`[P...]\` e \`[T...R...C...]\` prontas para transcrição probatória, dispensando rodar \`inspect_docx\` novamente.

### Passo 5: Parecer Executivo de Auditoria (generate_audit_docx)
- **Chamada:** \`generate_audit_docx({ auditJsonPath: "cases/<nome_caso>/state/relatorio_auditoria.json", outputPath: "cases/<nome_caso>/output/Relatorio_Auditoria_ETP.docx", outputFormat: "docx" | "pdf" | "both" })\`
- **Características:**
  - Layout editorial vertical A4 corrido (ZERO tabelas <w:tbl>, 100% largura útil).
  - Padrão Exact Copy-Paste Error: rejeição fail-fast estrita caso campos obrigatórios (\`processo_id\`, \`resumo_executivo\`) estejam ausentes.
  - Sanitização de crases markdown, coordenadas técnicas e códigos de enum.
  - Fichas verticais individualizadas com múltiplos trechos probatórios transcritos em blocos de citação recuados.
  - Suporte a conversão direta para PDF via \`outputFormat: "docx" | "pdf" | "both"\` (v0.9.5), retornando \`pdf_path\` no JSON sintético mantendo o payload < 1024 bytes.
`.trim();


