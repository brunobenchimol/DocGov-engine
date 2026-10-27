export const VERSION = "1.3.6";
export const GITHUB_REPO = "brunobenchimol/DocGov-engine";

// ============================================================================
// Autodescoberta MCP (Self-Discovery): Instruções e Guias Nativos
// ============================================================================

export const DOCX_ENGINE_INSTRUCTIONS = `
Servidor MCP standalone determinístico (docgov-engine v1.3.6) para manipulação, engenharia reversa estrutural de documentos PDF (.pdf com agrupamento Y e colunas), planilhas (.xlsx/.csv), minutas Markdown/Texto (.md/.txt) e Microsoft Word (.docx), engenharia tabular avançada com paridade de coordenadas físicas vs virtuais (v1.3.6), eliminação de fusão horizontal de colunas em loop_table_rows (v1.3.6), normalização de vMerge e gridSpan em fingerprints estruturais e relato de similaridade em status NEW (v1.3.6), conector nativo PNCP (fetch_pncp) e busca textual multi-query (search_pncp) com isolamento em subpasta e catalogação de referência (v1.3.5), descompactação automática e transparente de pacotes (.zip, .tar, .tar.gz, .tgz) via libmagic msooxml com defesa Anti-Zip Slip e guardrails em bootstrap_case, Cartografia Estrutural Sem IA, Dossiê de Hotspots, Índice Cartográfico Mestre Unificado, Radar Determinístico das 14 Zonas de Impugnação (Z1 a Z14), Auditoria Matemática Determinística de Planilhas Orçamentárias (Z10/Z12), Diff Estrutural e Semântico Multi-Versão (compareWithPath), Diff Semântico Granular em Nível de Token (Marco 6.1), Nota Técnica Comparativa Padronizada em DOCX e PDF (Marco 6.2), blindagem de caminhos locais e guardrails de governança no bootstrap (v1.3.2), resiliência de caminhos MCP desacoplada de CWD (Lei 6), teto estrito MCP otimizado (< 900B), sanitização universal de XML BOM e whitespaces iniciais, movimentação limpa e deduplicação da raiz do caso para inputs/, isolamento de inspeção por arquivo com try/catch, construção de templates, injeção de dados, conversão híbrida para PDF e auditoria técnico-jurídica no ecossistema DocGov.

### Ordem Canônica do Pipeline de Documentos (.pdf e .docx):
1. **bootstrap_case**: Inicializa a estrutura completa de pastas do caso (inputs/, state/, templates/, output/), descompacta automaticamente pacotes compactados (.zip, .tar, .tar.gz, .tgz) via libmagic msooxml com defesa Anti-Zip Slip e achatamento seguro, preserva nomes legíveis, infere extensões via magic bytes (PK\\x03\\x04 e %PDF), auto-batiza anexos opacos (media_*) com tipo semântico e hash curto (ex.: ETP_ORGAO_A_3b9d.docx) ou aplica 'fileRenameMap', copia e inspeciona imediatamente minutas .docx e editais/anexos .pdf (validando Magic Bytes %PDF-) em inputs/, detecta páginas escaneadas como imagem ('scanned_pages_detected'), gerando state/estrutura_<nome>.json (com toc_map, outline_headings, page_signals e impugnation_zones Z1..Z14), state/visao_auditoria_<nome>.md (com Bloco 1 Cartográfico + Radar das 14 Zonas e Bloco 2 paginado [PAG_XXX | LYYYY] ou [P...]), state/dossie_hotspots_<nome>.md (contexto cirúrgico expandido ±12 linhas) e o consolidado multi-documento state/indice_mestre_caso.md (matriz cruzada de zonas Z1..Z14 e alertas globais), além de salvaguarda de anexos e auditoria orçamentária automática (state/auditoria_orcamentaria_<nome>.json).
2. **inspect_doc**: Realiza a engenharia reversa estrutural completa de qualquer documento individual .docx, .pdf, .xlsx, .csv, .md ou .txt via parâmetro 'filePath' (ou alias 'docxPath', com agrupamento Y e separação colunar com ' | ') e guardrail instrutivo que rejeita pacotes compactados orientando a usar 'bootstrap_case', construindo no topo do JSON o índice estrutural rápido 'toc_map', a Cartografia Estrutural em 3 camadas ('outline_headings', 'page_signals' e 'impugnation_zones' Z1..Z14), executando a Auditoria Matemática de Planilhas Orçamentárias (com injeção automática em Z10 e Z12 e gravação de 'state/auditoria_orcamentaria_<nome>.json'), suportando comparação estrutural multi-versão ('compareWithPath') gerando 'state/diff_documental_<nome>.md' e '.json', calculando a impressão digital estrutural ('structure_fingerprint' para .docx), detectando páginas escaneadas como imagem ('scanned_pages_detected'), gerando o dossiê executivo de pontos quentes ('state/dossie_hotspots_<nome>.md' com ±12 linhas de contexto), realizando matching 1-para-N contra o cache global ('core/registry/templates/') com rastreabilidade temporal (created_at, updated_at, age_days, cache_date_status, engine_version, slots_count), reancorando automaticamente coordenadas deslocadas (Auto-Offset gerando 'state/adapted_slots_manifest.json' em caso de drift 75%-99%), reconstruindo visualmente a numeração de listas nativas ('word/numbering.xml' + '<w:numPr>'), gerando a visão linear compacta de auditoria ('state/visao_auditoria_<nome>.md' com Bloco 1: Mapa Cartográfico + Radar Z1..Z14 e Bloco 2: texto integral [PAG_XXX | LYYYY] ou [P...]) e devolvendo no MCP um 'toc_summary' conciso (< 1 KB, margem de segurança < 920 bytes).
3. **build_docx_template**: Transforma o .docx bruto em um template parametrizado com tags {{...}} a partir das regras do slots_manifest.json (com auto-reparo e diagnóstico cirúrgico de JSON), preservando 100% da formatação visual (<w:pPr>, <w:rPr>, estilos e tabelas). Suporta coordenadas compactas (ex.: 'coord': 'T0.R1.C1' ou 'P2', com ou sem colchetes), array unificado 'slots', aliases, auto-normalização de índices numéricos de ponto (ex.: 'itens.0.qtd' -> 'itens[0].qtd'), validação léxica precoce de tags JS com padrão Exact Copy-Paste Error (Zero Silent No-Op com contagem de applied_slots_count), criação recursiva automática de diretórios pais (Zero ENOENT) e a opção 'saveToRegistry: true' para homologar e persistir o manifesto no cache global cross-órgão.
4. **fill_docx_template**: Injeta os dados do estado_caso.json no template .docx gerado (com unflatten automático de chaves com notação de ponto ou colchetes, ex.: "etp.necessidade" ou "itens.0.qtd"), resolvendo variáveis simples, loops FOR em tabelas, blocos IF, quebras de linha em múltiplos parágrafos, negrito seletivo e listas recursivas multinível via Motor Híbrido (v0.7.0: lista nativa 'word/numbering.xml' + '<w:numPr>' com '<w:startOverride>' fora de tabelas e Hanging Indent estático com '<w:tab/>' dentro de tabelas). Suporta 'outputFormat: \"docx\" | \"pdf\" | \"both\"' (v0.9.5 / v1.0.0), convertendo via Pipeline Híbrido (Tier 1 Word COM / Tier 2 Pure-JS com resolução canônica de caminhos sem duplicações e DOCX temporário isolado em modo exclusivo PDF) e auto-inspecionando o documento gerado (incluindo o PDF quando selecionado) em 'state/inspecao_<stem>.json' e 'state/visao_auditoria_<stem>.md' para dispensar rodar inspect_doc novamente antes da auditoria externa.
5. **generate_audit_docx**: Compila o relatório executivo de auditoria de controle externo a partir de relatorio_auditoria.json em layout vertical A4 (zero tabelas <w:tbl>, 100% largura útil), com validação fail-fast com padrão Exact Copy-Paste Error, fichas individualizadas, transcrições probatórias integrais e suporte a 'outputFormat: \"docx\" | \"pdf\" | \"both\"' (v0.9.5 / v1.0.0 com modo exclusivo PDF limpo).
6. **generate_technical_note_docx**: Compila a Nota Técnica Comparativa de Evolução Documental ('Antes vs. Depois', Marco 6) a partir de 'noteJsonPath' ou derivação automática entre 'oldPath' e 'newPath' em layout vertical A4 (zero tabelas <w:tbl>, 100% largura útil), com destaque visual colorido por cards com bordas laterais (verde para inclusão, vermelho para supressão, azul para alteração), renderização granular de diff de tokens inline e fundamentação técnica/jurídica individualizada por cláusula alterada, com suporte a 'outputFormat: \"docx\" | \"pdf\" | \"both\"'.
7. **fetch_pncp**: Conector nativo PNCP (Portal Nacional de Contratações Públicas) para download determinístico de contratações públicas de referência para benchmarking técnico e pesquisa de mercado (IN SEGES/ME nº 65/2021), com suporte a número de controle, URL, tupla ou links de redirecionamento do Google Grounding (vertexaisearch.cloud.google.com/grounding-api-redirect/...), isolamento estrito na subpasta 'inputs/pncp_<shortname>/', descompactação in-place transparente (.zip, .tar, .tar.gz) e catalogação leve sem misturar com as minutas sob auditoria do caso, gerando state/indice_pncp_<shortname>.md e state/pncp_<shortname>_meta.json com retorno sintético < 900 bytes.
8. **search_pncp**: Busca textual multi-query no endpoint oficial /api/search/ do PNCP para descoberta de contratações similares por termos de objeto, órgão ou modalidade (aceitando consultas paralelas separadas por '|' ou links Google Grounding), com desduplicação por CNPJ/ANO/SEQUENCIAL, acumulação em state/pncp_search_results.json e tabela consolidada com Objeto Completo em state/pncp_search_results.md, devolvendo retorno sintético < 900 bytes com os top candidatos e 'next_step_hint' direcionando ao 'fetch_pncp'.

### Sintaxe Suportada de Tags e Recursos de Resiliência (Geração 3 — v1.3.6):
- **Engenharia Tabular, Paridade Físico-Virtual e Template Matching (v1.3.6 — Leis 2, 3 e 4):** Fim da fusão horizontal de colunas em 'loop_table_rows' (injetando tags delimitadoras fora da linha de dados, garantindo repetição estrita de linhas sem multiplicar colunas), alinhamento de coordenadas físicas (<w:tc>) vs virtuais (gridSpan) em 'replace_table_cells' e 'toc_map.form_fields', auto-alinhamento de cell_tags quando C0 for vMerge, fail-fast estrito contra excesso de cell_tags, normalização de vMerge e gridSpan no fingerprint estrutural, ordenação de substituições bottom-up e exibição transparente de template_match e form_fields na visão de auditoria linear.
- **Busca Textual Multi-Query no PNCP & Resolvedor Nativo de Redirects (v1.3.5 — Leis 2, 4 e 5):** 8ª ferramenta MCP 'search_pncp' e flag CLI '--search-pncp' para descoberta textual de editais de referência no PNCP com suporte a consultas paralelas com pipe ('|'), desduplicação determinística, tabela Markdown com Objeto Integral e acumulação em 'state/pncp_search_results.md' e '.json', além de resolução automática e transparente de links de redirecionamento HTTP opacos do Google Grounding ('vertexaisearch.cloud.google.com/grounding-api-redirect/...') em 'fetch_pncp' e 'search_pncp' mantendo payload sintético estritamente abaixo de 900 bytes.
- **Conector Nativo PNCP & Catalogação Isolada de Referência (v1.3.4 — Leis 2, 4 e 5):** Download determinístico e sem consumo de tokens de editais, termos de referência e planilhas públicas do Portal Nacional de Contratações Públicas (PNCP) a partir de qualquer formato de identificador (número de controle, URL ou tupla), com isolamento físico estrito em subpastas dedicadas (\`inputs/pncp_<shortname>/\`), descompactação transparente in-place e catálogo de benchmarking em \`state/indice_pncp_<shortname>.md\` livre de poluição de auditoria.
- **Classificador Estrutural libmagic msooxml & Descompactação Transparente (v1.3.3 — Leis 2, 4 e 6):** Identificação determinística de arquivos baseada em regras canônicas do Linux file(1) / libmagic (distinção nativa de containers ZIP para Word DOCX, Excel XLSX, PPTX e ODF vs arquivos compactados comuns), descompactação automática transparente de pacotes (.zip, .tar, .tar.gz, .tgz) em bootstrap_case com defesa Anti-Zip Slip, achatamento de subpastas, filtragem de lixo de sistema (__MACOSX, .DS_Store, Thumbs.db) e guardrail fail-fast amigável em inspect_doc orientando uso de bootstrap_case para pacotes múltiplos.
- **Blindagem de Governança, Paths Locais & Teto MCP (v1.3.2 — Leis 2, 6 e 8):** Guardrail de segurança ativa no \`bootstrap_case\` prevenindo inicialização acidental na raiz de repositórios Git, denylist estrita preservando todos os arquivos de governança (\`AGENTS.md\`, \`README.md\`, \`CHANGELOG.md\`, etc.) e código-fonte (\`.ts\`, \`.py\`, etc.), resolução de \`.\` e caminhos relativos locais respeitando \`process.cwd()\` sem desvio ascendente espúrio, e eliminação de duplicação de caminhos em \`inspect_doc\` garantindo payload sintético estritamente abaixo de 900 bytes.
- **Resiliência de Caminhos MCP Desacoplada de CWD (v1.3.1 — Lei 6):** Resolução canônica de caminhos de arquivos e pastas no servidor MCP independente do diretório de inicialização da IDE consumidora (\`process.cwd()\`), garantindo que referências relativas como \`cases/<slug>\` sejam resolvidas com sucesso contra a raiz do projeto DocGov ou a localização do binário (\`process.execPath\`), eliminando criação indevida de arquivos em pastas de sistema (\`AppData/Local/Programs/antigravity\`).
- **Inspeção Linear Nativa de Arquivos Markdown e Texto (.md/.txt) & Guardrail Anti-JSZip (v1.3.1):** Suporte nativo à inspeção estrutural de notas técnicas, minutas e despachos em formato texto puro e markdown (\`.md\`, \`.txt\`), gerando visão de auditoria (\`visao_auditoria_*.md\`) e dossiê executivo com Radar das 14 Zonas de Impugnação (\`dossie_hotspots_*.md\`), acompanhado de guardrail fail-fast amigável que previne quebras crípticas de descompressão do JSZip para arquivos não-ZIP/PDF.
- **Diff Semântico Granular em Nível de Token & LCS com Guardrail (v1.3.0):** Comparação refinada em nível de palavras e pontuações preservando caracteres acentuados da língua portuguesa (regex Unicode \`gu\`), guardrail de complexidade com divisão por sentenças para cláusulas extensas (> 2.000.000 comparações), agrupamento inteligente de blocos (\`diff_chunks\`) e renderização com markdown semântico (\`{++inclusão++}\`, \`{--supressão--}\`).
- **Nota Técnica Comparativa Padronizada em DOCX e PDF (v1.3.0):** Relatório formal executivo para instrução processual de alterações contratuais (Art. 124 a 136 Lei 14.133/2021) em layout editorial vertical A4 (zero tabelas), cards com bordas laterais coloridas por tipo de alteração (verde/vermelho/azul), quadro de evolução com justificativas técnicas e jurídicas, delta das 14 zonas de impugnação, e suporte a conversão direta para PDF via CLI ('--diff-report', '--generate-technical-note') e MCP ('generate_technical_note_docx').
- **Segurança de Supply-Chain & Auto-Updater SHA-256 (v1.2.0):** Validação criptográfica de integridade SHA-256 do binário baixado contra 'SHA256SUMS.txt' antes da substituição em disco no '--update', com suporte híbrido transparente a credenciais 'DOCGOV_GITHUB_TOKEN' / 'GH_TOKEN' e fallback para arquivo local '.env' em repositórios públicos ou privados.
- **Ingestão Nativa de Planilhas Orçamentárias .xlsx e .csv (v1.2.0):** Parser determinístico leve de OpenXML Spreadsheet ('xl/worksheets' e 'xl/sharedStrings') sem dependências externas, com indexação estrita por coordenada de célula 'r="A1"' prevenindo deslocamento de colunas em células vazias, e parser CSV RFC 4180 com detecção de delimitador e encoding, submetendo todas as tabelas diretamente ao 'budget_auditor.ts' (Qtd x Unit = Total em centavos inteiros nas zonas Z10/Z12).
- **Engenharia Tabular Avançada Multi-Página & Mesclagem (v1.2.0):** Detecção de tabelas contínuas que se estendem por múltiplas páginas consecutivas com cabeçalho repetido no DOCX e PDF, agrupamento de células multilinha e normalização de 'gridSpan' (colspan) e 'vMerge' (rowspan) do OpenXML.
- **Pipeline OCR Headless para PDFs Escaneados (v1.2.0):** Recuperação automática de texto em páginas escaneadas ('scanned_pages_detected') operando 100% offline dentro do binário Bun com injeção em coordenadas homogêneas '[PAG_XXX | LYYYY]', submetendo o conteúdo ao Radar das 14 Zonas e gerando visão linear com badge 'ocr_applied: true'.
- **Emissão Parametrizada de Matriz de Riscos e Checklist de Conformidade (v1.2.0):** Geração estruturada de Matriz de Riscos (Lei 14.133/2021) e Checklist de Conformidade Normativa (TCU/AGU/MGI) em layout vertical corrido A4 corporativo em Word e PDF via 'generate_audit_docx'.
- Sanitização Universal de XML BOM e Whitespaces Iniciais (v1.1.1): Remoção automática de UTF-8 BOM (\uFEFF) e whitespaces/quebras de linha antes do primeiro '<' em todos os arquivos XML internos de DOCX, garantindo que '<?xml' inicie na posição 0 e eliminando falhas fatais do @xmldom/xmldom.
- Movimentação Limpa e Deduplicação da Raiz do Caso (v1.1.1): Varrimento automático da raiz de cases/<slug>/ movendo documentos (.docx, .pdf, .xlsx, .csv, etc.) para inputs/ e removendo cópias redundantes sem duplicação de disco, preservando arquivos do sistema (context.json).
- Isolamento try/catch por Arquivo e Inventário Completo no Índice Mestre (v1.1.1): Proteção individual contra falhas de extração em arquivos corrompidos ou não-suportados, garantindo a geração contínua de state/indice_mestre_caso.md com o inventário probatório de 100% dos arquivos de inputs/.
- Auditoria Matemática de Planilhas Orçamentárias (v1.1.0): Validação determinística em centavos inteiros (BigInt/Math.round) de tabelas de itens e preços em .docx e .pdf (Qtd x Valor Unitário = Valor Total), separando MATH_ERROR (> R$ 0,02) e ROUNDING_WARNING (<= R$ 0,02), somatório de itens vs. linha de Total Geral, cruzamento textual de valores globais (Z12) e injeção automática no Radar Z10/Z12 com persistência em 'state/auditoria_orcamentaria_<stem>.json'.
- Diff Estrutural e Semântico Multi-Versão (v1.1.0): Comparação determinística entre documentos via 'compareWithPath' (MCP) e flag '--diff' (CLI), detectando cláusulas adicionadas ([+]), removidas ([-]) e modificadas ([~] com destaque inline), além de mapear o delta do Radar das 14 Zonas (riscos introduzidos vs. saneados) e gerar 'state/diff_documental_<stem>.md' e '.json'.
- Pipeline Híbrido de Exportação DOCX para PDF (v0.9.5 / v1.0.0): Conversão de alta fidelidade visual com seleção automática em 2 níveis: Tier 1 (MS Word COM via PowerShell no Windows/WSL Interop com 100% de fidelidade) e Tier 2 (Pure-JS standalone determinístico com pdf-lib + xmldom + JSZip sem dependências de SO). Inclui isolamento de DOCX temporário no modo exclusivo PDF, fechamento COM determinístico e resolução canônica de caminhos eliminando extensões repetidas (.pdf.pdf).
- Resiliência de Diretórios & Zero ENOENT (v0.7.3): Criação recursiva mandatória do diretório pai em 'build_docx_template' e inclusão antecipada da pasta 'templates/' na árvore canônica criada por 'bootstrap_case', eliminando em definitivo falhas ENOENT de gravação.
- Sanitização de Tags JS & Validação Léxica Precoce (v0.7.2): Auto-normalização de índices numéricos por ponto ('itens.0.qtd' -> 'itens[0].qtd') em manifestos e templates OpenXML, unflatten bidirecional em JSON plano/aninhado e validação precoce no 'build_docx_template' barrando variáveis com hífen ou dígitos iniciais com padrão Exact Copy-Paste Error e sugestão snake_case.
- Rastreabilidade de Versão MCP (v0.7.1 / v1.0.0): Inclusão do campo 'engine_version' na raiz do payload JSON sintético retornado por todas as 5 ferramentas MCP (bootstrap_case, inspect_doc, build_docx_template, fill_docx_template e generate_audit_docx) para consumo imediato pelo agente com teto estrito (< 1024 bytes, margem < 920 bytes).
- Motor Híbrido de Lista Multinível Nativa (v0.7.0): Fora de tabelas (<w:body>), desmembra subitens decimais (ex.: 4.1, 4.1.1) em lista multinível nativa do Word ('word/numbering.xml' de 9 níveis com '<w:suff w:val="tab"/>', '<w:numPr>' e '<w:startOverride>' sincronizado com o capítulo pai, limpando o prefixo literal do '<w:t>'). Dentro de tabelas (<w:tc>) ou em alíneas/bullets, aplica Hanging Indent estático ('<w:ind w:left w:hanging>' + '<w:tabs>') separando o número literal com '<w:r><w:tab/></w:r>'.
- Rastreabilidade Temporal do Cache & Retrocompatibilidade Estrita (v0.6.4): Gravação e leitura de 'created_at', 'updated_at', 'age_days', 'cache_date_status', 'engine_version' e 'slots_count' no cache global, preservando 'created_at' original em atualizações e suportando caches legados sem datas (reportando 'NÃO DISPONÍVEL' / 'age_days: null' sem usar mtime do disco) para decisão informada no Gate 1.
- Arquitetura Modular & Re-export Barrel (v0.6.3): Decomposição limpa do motor em submódulos especializados (types, core, tools, mcp, cli) mantendo 100% de compatibilidade retroativa e integridade de exportações.
- Especificação Técnica de Consumo (--dump-spec v1.0.0): Flag CLI para exportação da especificação normativa de consumo do motor em Markdown (UTF-8).
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
# Guia de Arquitetura e Engenharia de Documentos (.pdf e .docx) — docgov-engine (v1.0.0)

Este guia orienta agentes de IA e clientes MCP no ciclo completo de tratamento e auditoria de documentos (.pdf e .docx) do ecossistema DocGov.

---

## 1. Pipeline Canônico de 5 Passos

### Passo 1: Inicialização do Caso (bootstrap_case)
- **Chamada:** \`bootstrap_case({ caseDir: "cases/<nome_caso>", uploadsDir: ".user_uploaded", fileRenameMap: { "media_179...": "ETP_Modelo.docx" } })\`
- **Efeito:**
  - Cria as pastas \`inputs/\`, \`state/\`, \`templates/\` e \`output/\`.
  - Descompacta e ingere automaticamente arquivos compactados (\`.zip\`, \`.tar\`, \`.tar.gz\`, \`.tgz\`) presentes em \`uploadsDir\`, na raiz do caso ou em \`inputs/\`, com classificação \`libmagic msooxml\`, defesa Anti-Zip Slip e achatamento de pastas.
  - Resolve nomes legíveis: preserva nomes originais humanos, aceita \`fileRenameMap\` explícito ou realiza auto-batismo semântico de anexos opacos (\`media_*\` -> \`<TIPO>_<ORGAO>_<hash4>.<ext>\`) com inferência de extensão via magic bytes (\`PK\\x03\\x04\` para .docx e \`%PDF\` para .pdf).
  - Copia e inspeciona instantaneamente todos os arquivos \`.docx\` e \`.pdf\` (validando Magic Bytes \`%PDF-\`) em \`inputs/\`, detectando páginas escaneadas como imagem (\`scanned_pages_detected\`), gravando \`state/estrutura_<stem>.json\` (com \`outline_headings\`, \`page_signals\`, \`impugnation_zones\` Z1..Z14 e \`toc_map\`), \`state/visao_auditoria_<stem>.md\` (Bloco 1 Cartográfico + Radar Z1..Z14 e Bloco 2 paginado \`[PAG_XXX | LYYYY]\` ou \`[P...]\`), \`state/dossie_hotspots_<stem>.md\` (contexto expandido cirúrgico ±12 linhas) e o consolidado multipeça \`state/indice_mestre_caso.md\` (inventário, matriz cruzada Z1..Z14 e alertas globais).
  - Retorna um JSON sintético (< 1 KB, margem de segurança < 920 bytes) com status, contadores, \`master_index_path\`, \`ingested_files\` e referências dos arquivos.

### Passo 2: Mapeamento Estrutural, Cartografia PDF/DOCX e Cache Global (inspect_doc)
- **Chamada:** \`inspect_doc({ filePath: "cases/<nome_caso>/inputs/edital_licitacao.pdf", outputPath: "cases/<nome_caso>/state/estrutura_edital.json", compact: true })\`
- **Efeito:**
  - Suporta transparentemente documentos individuais \`.docx\`, \`.pdf\`, \`.xlsx\`, \`.csv\`, \`.md\` e \`.txt\`. Emite erro fail-fast instrutivo caso receba pacotes compactados (\`.zip\`, \`.tar\`, etc.), orientando o uso de \`bootstrap_case\`. Em PDFs, executa agrupamento Y (tolerância 2.5pt) e separação de colunas \` | \`. Aceita também \`docxPath\` para compatibilidade retroativa.
  - Executa a Cartografia Estrutural Determinística em 3 camadas (\`outline_headings\`, \`page_signals\` e Radar das 14 Zonas de Impugnação \`impugnation_zones\` Z1..Z14).
  - Em arquivos \`.docx\`, extrai a impressão digital estrutural (\`structure_fingerprint\`) e compara contra todos os templates salvos em \`core/registry/templates/\`, expondo rastreabilidade temporal (\`created_at\`, \`updated_at\`, \`age_days\`, \`cache_date_status\`, \`engine_version\`, \`slots_count\`) com retrocompatibilidade para caches legados:
    - **EXACT (100%):** Devolve \`template_match: { status: "EXACT", registry_path: "...", created_at, updated_at, age_days, slots_count }\`.
    - **MODIFIED (75% a 99%):** Calcula deslocamento de linhas (*Auto-Offset*), gera automaticamente \`state/adapted_slots_manifest.json\` e devolve \`status: "MODIFIED"\`.
    - **NEW (< 75%):** Devolve \`status: "NEW"\`.
  - Gera em \`state/\` o espelho linear \`visao_auditoria_<nome_base>.md\` (Bloco 1: Mapa Cartográfico + Radar das 14 Zonas e Bloco 2: Conteúdo Integral) e o dossiê executivo cirúrgico \`dossie_hotspots_<nome_base>.md\` (Bloco 1: Resumo Cartográfico e Bloco 2: Contexto expandido ±12 linhas de todas as ocorrências de Z1..Z14 e sinais técnicos/orçamentários).
  - Retorna um sumário executivo conciso (\`toc_summary\`) de tamanho < 1 KB (margem de segurança < 920 bytes) no corpo da chamada MCP com \`template_match\`, \`audit_view_path\` e \`dossie_hotspots_path\`.

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
  - **Pipeline Híbrido de Exportação DOCX para PDF (v0.9.5 / v1.0.0):**
    - Suporta \`outputFormat: "docx" | "pdf" | "both"\`.
    - Seleção automática em 2 níveis: **Tier 1** (MS Word COM via PowerShell no Windows/WSL Interop com 100% de fidelidade visual) com fallback transparente para **Tier 2** (Pure-JS standalone determinístico via pdf-lib + xmldom + JSZip sem dependências de SO).
    - Quando \`outputFormat: "pdf"\`, a auto-inspeção analisa diretamente o arquivo \`.pdf\` gerado.
  - **Auto-Inspeção Integrada:** Grava automaticamente \`state/inspecao_<stem>.json\` e o espelho linear de auditoria \`state/visao_auditoria_<stem>.md\` na pasta \`state/\` do caso, dispensando rodar \`inspect_doc\` novamente.
  - Retorna payload sintético (< 1 KB) contendo \`status\`, \`outputPath\`, \`pdf_path\` (se gerado), \`inspection_path\`, \`visao_auditoria_path\` e \`next_step_hint\` orientando acionar diretamente o Auditor Externo lendo a visão linear gerada.

### Passo de Transição: Leitura Integral para Auditoria Externa
- Graças à auto-inspeção integrada do \`fill_docx_template\`, o espelho linear \`state/visao_auditoria_<stem>.md\` já é gerado automaticamente em \`state/\`.
- O auditor externo pode ler o arquivo \`state/visao_auditoria_<stem>.md\` integralmente em **1 único turno** com as coordenadas técnicas \`[P...]\` e \`[T...R...C...]\` prontas para transcrição probatória, dispensando rodar \`inspect_doc\` novamente.

### Passo 5: Parecer Executivo de Auditoria (generate_audit_docx)
- **Chamada:** \`generate_audit_docx({ auditJsonPath: "cases/<nome_caso>/state/relatorio_auditoria.json", outputPath: "cases/<nome_caso>/output/Relatorio_Auditoria_ETP.docx", outputFormat: "docx" | "pdf" | "both" })\`
- **Características:**
  - Layout editorial vertical A4 corrido (ZERO tabelas <w:tbl>, 100% largura útil).
  - Padrão Exact Copy-Paste Error: rejeição fail-fast estrita caso campos obrigatórios (\`processo_id\`, \`resumo_executivo\`) estejam ausentes.
  - Sanitização de crases markdown, coordenadas técnicas e códigos de enum.
  - Fichas verticais individualizadas com múltiplos trechos probatórios transcritos em blocos de citação recuados.
  - Suporte a conversão direta para PDF via \`outputFormat: "docx" | "pdf" | "both"\` (v0.9.5 / v1.0.0), retornando \`pdf_path\` no JSON sintético mantendo o payload < 1024 bytes.

### Passo 6: Nota Técnica Comparativa Padronizada (generate_technical_note_docx)
- **Chamada Direta:** \`generate_technical_note_docx({ noteJsonPath: "cases/<nome_caso>/state/nota_tecnica.json", outputPath: "cases/<nome_caso>/output/Nota_Tecnica_Evolucao.docx", outputFormat: "docx" | "pdf" | "both" })\`
- **Chamada Comparativa:** \`generate_technical_note_docx({ oldPath: "cases/<nome_caso>/inputs/minuta_v1.docx", newPath: "cases/<nome_caso>/inputs/minuta_v2.docx", outputPath: "cases/<nome_caso>/output/Nota_Tecnica_Evolucao.docx", outputFormat: "both" })\`
- **Características:**
  - Layout editorial vertical A4 corrido (ZERO tabelas <w:tbl>, 100% largura útil).
  - Cards visuais com bordas laterais coloridas (verde para inclusão, vermelho para supressão, azul para alteração).
  - Diff granular em nível de token com destaque inline ({++inclusão++}, {--supressão--}).
  - Quadro de evolução com justificativas técnicas e jurídicas individualizadas por cláusula alterada.
  - Delta do Radar das 14 Zonas de Impugnação (sinalização de vulnerabilidades saneadas vs. introduzidas).
  - Suporte a conversão direta para PDF via \`outputFormat: "docx" | "pdf" | "both"\`, retornando \`pdf_path\` no JSON sintético estritamente < 900 bytes.

### Passo 7: Insumos de Referência Externa (fetch_pncp)
- **Chamada:** \`fetch_pncp({ caseDir: "cases/<nome_caso>", pncpIdOrUrl: "00394460000141-1-000015/2026", shortname?: "orgao_referencia" })\`
- **Características:**
  - Download binário determinístico e isolado em \`cases/<nome_caso>/inputs/pncp_<shortname>/\` (zero mistura com documentos do caso).
  - Suporte nativo a resolução de links de redirect do Google Grounding (\`vertexaisearch.cloud.google.com/grounding-api-redirect/...\`).
  - Descompactação automática in-place de pacotes compactados (.zip, .tar, .tar.gz) via libmagic com defesa Anti-Zip Slip e descarte de lixo de sistema.
  - Catalogação estrutural leve em memória e geração exclusiva de \`state/indice_pncp_<shortname>.md\` e \`state/pncp_<shortname>_meta.json\` (sem poluição de auditoria em \`state/\`).
  - Retorno sintético conciso estritamente < 900 bytes (Lei 2).

### Passo 8: Busca Textual de Oportunidades & Benchmarking (search_pncp)
- **Chamada:** \`search_pncp({ caseDir: "cases/<nome_caso>", query: "fábrica de software | sustentação de sistemas", status: "todas", uf: "DF", limit: 10 })\`
- **Características:**
  - Consulta multi-query paralela no endpoint oficial /api/search/ do PNCP.
  - Desduplicação por CNPJ/ANO/SEQUENCIAL e acumulação de buscas no caso.
  - Geração de painel executivo \`state/pncp_search_results.md\` com Objeto Completo e \`state/pncp_search_results.json\`.
  - Retorno sintético < 900 bytes com top candidatos e \`next_step_hint\` direcionando para download via \`fetch_pncp\`.
`.trim();
