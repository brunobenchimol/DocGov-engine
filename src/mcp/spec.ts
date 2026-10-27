import { VERSION } from "../constants/index.ts";
import {
  EXACT_COPY_PASTE_SLOTS_MANIFEST_SNIPPET,
  EXACT_COPY_PASTE_CANONICAL_SLOTS_MANIFEST_SNIPPET,
  EXACT_COPY_PASTE_AUDIT_REPORT_SNIPPET,
  EXACT_COPY_PASTE_RISK_MATRIX_SNIPPET,
  EXACT_COPY_PASTE_COMPLIANCE_CHECKLIST_SNIPPET,
  EXACT_COPY_PASTE_TECHNICAL_NOTE_SNIPPET,
  EXACT_COPY_PASTE_PNCP_ID_SNIPPET,
  EXACT_COPY_PASTE_PNCP_SEARCH_SNIPPET,
} from "../contracts/errors.ts";

// ============================================================================
// Especificação Técnica Integral em Markdown (--dump-spec v1.1.1)
// ============================================================================

export function generateEngineSpecMarkdown(): string {
  return `# Especificação Técnica do Motor docgov-engine (v${VERSION})

Documento normativo e especificação canônica do motor standalone \`docgov-engine\` (\`docgov-engine v${VERSION}\`) e servidor MCP para o ecossistema DocGov.

---

## 1. Diretrizes de Comunicação e Resiliência MCP

1. **Teto Estrito de Payload MCP (< 1024 bytes) e Identificação de Versão (v0.7.1 / v1.0.0 / v1.1.0 / v1.1.1):** Todo retorno de ferramenta via stdio MCP DEVE ser um JSON sintético conciso (< 1 KB, margem segura < 920 bytes) contendo o campo \`engine_version\` na raiz para dispensar consultas externas. Mapas estruturais densos (\`toc_map\`, \`outline_headings\`, \`page_signals\`, \`impugnation_zones\`), índices mestres (\`indice_mestre_caso.md\`), relatórios de auditoria orçamentária (\`auditoria_orcamentaria_*.json\`), diffs documentais (\`diff_documental_*.md\` e \`.json\`), dossiês de hotspots (\`dossie_hotspots_*.md\`) e espelhos lineares de leitura integral (\`visao_auditoria_*.md\`) são persistidos no diretório \`state/\` do caso e apenas referenciados no payload sintético.
2. **Padrão Exact Copy-Paste Error (Zero Silent No-Op e Fail-Fast Estrito):** É expressamente proibido retornar \`status: "success"\` se \`applied_slots_count === 0\` ou se o manifesto contiver chaves desconhecidas ou inválidas. Ao detectar erro de validação em \`slots_manifest.json\` ou \`relatorio_auditoria.json\`, o motor interrompe a execução com mensagem imperativa acompanhada do snippet JSON canônico pronto para copiar e colar, eliminando leituras exploratórias cegas.
3. **Neutralidade Institucional Absoluta:** O motor e seus contratos utilizam exclusivamente identificadores canônicos universais e genéricos: \`ORGAO_CONTRATANTE\`, \`MUNICIPIO_GENERICO\`, \`ORGAO_A\`, \`ORGAO_B\`, \`AGU\`, \`MGI\`, \`TCU\`.
4. **Resiliência e Cache Global (core/registry/templates/):** O motor realiza matching 1-para-N contra o cache global, com suporte a rastreabilidade temporal (\`created_at\`, \`updated_at\`, \`age_days\`, \`cache_date_status\`, \`engine_version\`, \`slots_count\`), retrocompatibilidade estrita com caches legados sem datas, reancoragem automática de coordenadas (Auto-Offset) em caso de drift (75%-99%) e sanity check descartando entradas corrompidos.
5. **Extração Nativa e Reconstrução Colunar de PDF, Cartografia Estrutural Sem IA, Dossiê de Hotspots e Radar das 14 Zonas (v0.8.0 / v0.8.1 / v0.9.0 / v1.0.0):** Suporte avançado a arquivos \`.pdf\` e \`.docx\` com agrupamento de linhas no eixo Y (2.5pt com suporte a micro-jitter) e colunas (\` | \` para gutters >= 18pt e tokens curtos), detecção de armadilha de OCR em páginas escaneadas (< 25 chars), dossiê cirúrgico de pontos quentes (\`dossie_hotspots_*.md\` com contexto expandido de ±12 linhas com hotspots desacoplados da linha 1), numeração paginada \`[PAG_XXX | LYYYY]\`, esqueleto de títulos (\`outline_headings\`), detector de densidade técnica e tabelas de itens (\`page_signals\`), radar determinístico das 14 Zonas Críticas de Impugnação (\`Z1\` a \`Z14\`, separando Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP, Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO e Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO, além de cruzamento multipeça \`Z12_MAPA_CRUZADO_MULTIPECA\`) e Índice Cartográfico Mestre Unificado Multi-Documento (\`indice_mestre_caso.md\`).
6. **Pipeline Híbrido de Conversão DOCX para PDF (v0.9.5 / v1.0.0):** Conversão de alta fidelidade visual com seleção automática em 2 níveis: Tier 1 (MS Word COM via PowerShell no Windows/WSL Interop com 100% de fidelidade) e Tier 2 (Pure-JS standalone determinístico com pdf-lib + xmldom + JSZip sem dependências de SO). Disponível via parâmetro \`outputFormat\` ("docx" | "pdf" | "both") em fill_docx_template e generate_audit_docx e via flag \`--format\` na CLI, com resolução canônica de caminhos, isolamento de DOCX temporário no modo exclusivo PDF e fechamento COM determinístico liberando file locks.
7. **Auditoria Matemática Determinística de Planilhas Orçamentárias e Diff Estrutural Multi-Versão (v1.1.0):** Detecção automática de quadros de preços e itens em tabelas OpenXML (\`.docx\`) e tabelas colunares reconstruídas (\`.pdf\`), validação de linha a linha ($Qtd \\times Unit = Total$) em centavos inteiros (BigInt/Math.round) com classificação em MATH_ERROR (> 2 centavos) e ROUNDING_WARNING (<= 2 centavos), validação de somatórios verticais (subtotais e total geral), cruzamento automático com menções de valor global no corpo textual injetados no Radar Z10/Z12 e persistência em \`state/auditoria_orcamentaria_<stem>.json\`. Suporte a Diff Estrutural e Semântico Multi-Versão entre minutas/editais (\`oldPath\` vs \`newPath\`) via parâmetro \`compareWithPath\` em inspect_doc ou flag \`--diff <caminho>\` na CLI, reportando seções adicionadas, removidas e modificadas (com marcação inline \`~~antigo~~ \` -> \`**novo**\`), delta de zonas de impugnação (INTRODUCED, RESOLVED, RETAINED) e persistência em \`state/diff_documental_<stem>.md\` e \`.json\`.
8. **Sanitização XML BOM, Movimentação da Raiz e Resiliência Multi-Arquivo (v1.1.1):** Sanitização prévia universal de XML eliminando BOM UTF-8 (\uFEFF) e whitespaces antes de tags XML no @xmldom/xmldom, movimentação automática e deduplicação de documentos soltos na raiz de cases/<slug>/ para inputs/ sem clonagem indevida (preservando context.json) e isolamento try/catch por arquivo em bootstrap_case garantindo a emissão de state/indice_mestre_caso.md com inventário de 100% dos insumos.
9. **Ingestão Nativa de Planilhas (.xlsx e .csv) e Engenharia Tabular Avançada Multi-Página (v1.2.0):** Parser leve de OpenXML Spreadsheet ('xl/worksheets' e 'xl/sharedStrings') sem dependências externas pesadas e com indexação estrita por coordenada de célula 'r="A1"' (eliminando deslocamento por células vazias), parser RFC 4180 de .csv, fusão contínua de tabelas multi-página com cabeçalho repetido em DOCX e PDF, resolução de células multilinha e normalização de 'gridSpan' e 'vMerge', submetendo automaticamente as tabelas ao budget_auditor determinístico (centavos inteiros nas zonas Z10 e Z12).
10. **Pipeline OCR Headless para PDFs Escaneados (v1.2.0):** Detecção automática de armadilhas de documento escaneado ('scanned_pages_detected') com fallback determinístico operando 100% offline dentro do binário Bun, injetando o texto extraído nas coordenadas homogêneas '[PAG_XXX | LYYYY]' para auditoria imediata pelo Radar das 14 Zonas e marcação 'ocr_applied: true'.
11. **Geração Parametrizada de Matriz de Riscos e Checklist de Conformidade (v1.2.0):** Emissão estruturada em layout vertical corrido A4 corporativo (zero tabelas <w:tbl>) de Matriz de Gerenciamento de Riscos (Art. 18, X e Art. 22 da Lei nº 14.133/2021) com severidade cromática e alocação contratual, e Checklist de Conformidade Normativa (TCU/AGU/MGI) com status e fundamentações legais em Word (.docx) e PDF via 'generate_audit_docx'.
12. **Segurança de Supply-Chain & Auto-Updater SHA-256 (v1.2.0):** Validação criptográfica de integridade SHA-256 antes da substituição de binários em disco no '--update' e suporte híbrido transparente a tokens em variáveis de ambiente ou arquivo local '.env'.
13. **Diff Semântico Granular em Nível de Token & Nota Técnica Comparativa Padronizada (Marco 6 — v1.3.0):** Motor de tokenização com regex Unicode \`gu\` preservando acentuação pt-BR, algoritmo LCS com guardrail de complexidade para cláusulas extensas (> 2.000.000 de comparações), blocos de diff granular com renderização markdown inline ({++inclusão++}, {--supressão--}), e gerador formal de Nota Técnica Comparativa ('Antes vs. Depois') em layout editorial vertical A4 (zero tabelas) com cards coloridos (verde/vermelho/azul), quadro de evolução com fundamentação técnica e jurídica individualizada por cláusula, delta das 14 zonas de impugnação e exportação para Word (.docx) e PDF via CLI ('--diff-report', '--generate-technical-note') e MCP ('generate_technical_note_docx').
14. **Resiliência de Caminhos MCP & Inspeção Linear MD/TXT (v1.3.1 — Lei 6):** Resolução canônica de caminhos de arquivos e pastas no servidor MCP desacoplada do CWD da IDE consumidora (\`resolveWorkspacePath\`), busca ascendente de workspace e priorização de localização do binário (\`process.execPath\`), eliminando gravação em pastas da IDE (\`AppData/Local/Programs/antigravity\`). Inspeção nativa linear de arquivos Markdown e Texto Puro (\`.md\` e \`.txt\`) gerando visão de auditoria e dossiê com Radar Z1..Z14, e guardrail fail-fast amigável que previne exceções crípticas de descompressão do JSZip.
15. **Blindagem de Governança, Paths Locais & Teto MCP (v1.3.2 — Leis 2, 6 e 8):** Guardrail de segurança ativa no \`bootstrap_case\` prevenindo inicialização acidental na raiz de repositórios Git, denylist estrita preservando todos os arquivos de governança (\`AGENTS.md\`, \`README.md\`, \`CHANGELOG.md\`, etc.) e código-fonte (\`.ts\`, \`.py\`, etc.), resolução de \`.\` e caminhos relativos locais respeitando \`process.cwd()\` sem desvio ascendente espúrio, e eliminação de duplicação de caminhos em \`inspect_doc\` garantindo payload sintético estritamente abaixo de 900 bytes.
16. **Classificador Estrutural libmagic msooxml & Descompactação Transparente (v1.3.3 — Leis 2, 4 e 6):** Identificação determinística de formatos inspirada no padrão Linux file(1) / libmagic (distinção nativa de containers ZIP para Word DOCX, Excel XLSX, PPTX e ODF vs arquivos compactados comuns), descompactação automática transparente de pacotes (.zip, .tar, .tar.gz, .tgz) em bootstrap_case com defesa Anti-Zip Slip, achatamento de subpastas, filtragem de lixo de sistema (__MACOSX, .DS_Store, Thumbs.db) e guardrail fail-fast amigável em inspect_doc orientando uso de bootstrap_case para pacotes múltiplos.
17. **Engenharia Tabular, Paridade Físico-Virtual e Template Matching (v1.3.6 — Leis 2, 3 e 4):** Fim da fusão horizontal de colunas em \`loop_table_rows\` (injetando tags delimitadoras fora da linha de dados, garantindo repetição estrita de linhas sem multiplicar colunas), alinhamento de coordenadas físicas (<w:tc>) vs virtuais (gridSpan) em \`replace_table_cells\` e \`toc_map.form_fields\`, auto-alinhamento de \`cell_tags\` quando C0 for \`vMerge\`, fail-fast estrito contra excesso de \`cell_tags\`, normalização de \`vMerge\` e \`gridSpan\` no fingerprint estrutural, ordenação de substituições bottom-up e exibição transparente de \`template_match\` e \`form_fields\` na visão de auditoria linear.

---

## 2. Ferramentas MCP Nativas (8 Tools)

### 2.1. bootstrap_case
Inicializa a governança de pastas do caso (\`inputs/\`, \`state/\`, \`templates/\`, \`output/\`), descompacta e ingere automaticamente arquivos compactados (\`.zip\`, \`.tar\`, \`.tar.gz\`, \`.tgz\`) presentes em \`uploadsDir\`, na raiz do caso ou em \`inputs/\` (com classificação \`libmagic msooxml\`, defesa Anti-Zip Slip e achatamento de pastas), preserva nomes legíveis, move e deduplica automaticamente documentos soltos na raiz para \`inputs/\` (preservando \`context.json\`), infere extensões por magic bytes (\`PK\\x03\\x04\` para .docx e \`%PDF\` para .pdf), aceita \`fileRenameMap\` opcional, realiza auto-batismo de uploads anônimos (\`media_*\` -> \`<TIPO>_<ORGAO>_<hash4>.<ext>\`), detecta páginas escaneadas como imagem (\`scanned_pages_detected\`), inspeciona minutas \`.docx\`, editais/anexos \`.pdf\` e arquivos \`.md\`/\`.txt\` com isolamento \`try/catch\` por arquivo gerando \`state/estrutura_<stem>.json\`, \`state/visao_auditoria_<stem>.md\`, \`state/dossie_hotspots_<stem>.md\`, \`state/auditoria_orcamentaria_<stem>.json\` e o consolidado multipeça \`state/indice_mestre_caso.md\` contendo o inventário de 100% dos arquivos com matriz cruzada Z1..Z14 e alertas globais. Retorna sumário executivo sintético (< 1 KB, margem segura < 920 bytes) com \`master_index_path\`, \`unpacked_archives_count\` e \`extracted_files_count\`.

### 2.2. inspect_doc
Engenharia reversa estrutural completa de documentos individuais Word (\`.docx\`), PDF (\`.pdf\`), planilhas (\`.xlsx\`, \`.csv\`) e textos/markdown (\`.md\`, \`.txt\`) recebendo como parâmetro principal \`filePath\` (com suporte ao alias \`docxPath\`) e parâmetro opcional \`compareWithPath\` para diff documental multi-versão, com guardrail fail-fast amigável que rejeita pacotes compactados (\`.zip\`, \`.tar\`, etc.) orientando o uso de \`bootstrap_case\`. Em PDFs, executa agrupamento por eixo Y com separação de colunas por \` | \` e detecta páginas escaneadas como imagem. Constrói no topo do JSON o índice estrutural rápido (\`toc_map\`), a Cartografia Estrutural em 3 camadas (\`outline_headings\`, \`page_signals\` e \`impugnation_zones\` Z1..Z14), calcula a impressão digital (\`structure_fingerprint\`), realiza busca 1-para-N no cache global (\`core/registry/templates/\`) com status \`EXACT\`, \`MODIFIED\` (reancoragem automática Auto-Offset gerando \`state/adapted_slots_manifest.json\` em drift 75%-99%) ou \`NEW\`, incluindo rastreabilidade temporal (\`created_at\`, \`updated_at\`, \`age_days\`, \`cache_date_status\`, \`engine_version\`, \`slots_count\`) para decisão informada no Gate 1. Executa auditoria matemática determinística de planilhas orçamentárias (DOCX e PDF) integrando achados ao Radar Z10/Z12 e gerando \`state/auditoria_orcamentaria_<stem>.json\`. Caso \`compareWithPath\` seja fornecido, gera o diff documental completo em \`state/diff_documental_<stem>.md\` e \`.json\`. Reconstrói visualmente a numeração de listas nativas (\`word/numbering.xml\` + \`<w:numPr>\`), gera o espelho linear de auditoria \`state/visao_auditoria_<nome>.md\` (Bloco 1 Cartográfico + Radar Z1..Z14 + Auditoria Orçamentária e Bloco 2 integral paginado \`[PAG_XXX | LYYYY]\` ou \`[P...]\`), gera o dossiê executivo de pontos quentes \`state/dossie_hotspots_<nome>.md\` (com contexto expandido ±12 linhas) e devolve no MCP sumário sintético \`toc_summary\` (< 1 KB, margem segura < 920 bytes) com \`dossie_hotspots_path\`, métricas de \`budget_audit\` e \`diff_summary\`.

### 2.3. build_docx_template
Transforma documento Word (.docx) bruto em template parametrizado com tags \`{{...}}\` preservando 100% da formatação OpenXML (<w:pPr>, <w:rPr>, estilos, cabeçalhos e tabelas).
- **Resiliência de Diretórios e Zero ENOENT (v0.7.3):** Garante a criação recursiva automática de qualquer pasta pai de \`outputPath\` antes da gravação do arquivo.
- **Sanitização de Tags JS e Validação Léxica Precoce (v0.7.2):** Converte automaticamente notação de ponto numérico (ex.: \`itens.0.qtd\` -> \`itens[0].qtd\`). Valida a sintaxe léxica das tags antes de gravar o template: identificadores com hífen (kebab-case, ex.: \`{{meu-slot}}\`) ou iniciando por dígito (\`{{1_item}}\`) são barrados com Exact Copy-Paste Error sugerindo a forma canônica snake_case.
- **Validação Fail-Fast e Exact Copy-Paste Error (v0.6.2):** Proíbe chaves inventadas (ex.: \`loop_var\`, \`items_expr\`, \`cell_slots\`, \`row_index\` em \`loop_table_rows\`) e rejeita manifestos com 0 regras ou que resultem em 0 slots aplicados.
- **Contrato Canônico de \`slots_manifest.json\`:**
\`\`\`json
${EXACT_COPY_PASTE_SLOTS_MANIFEST_SNIPPET}
\`\`\`
- **Formato Canônico Detalhado com Arrays na Raiz:**
\`\`\`json
${EXACT_COPY_PASTE_CANONICAL_SLOTS_MANIFEST_SNIPPET}
\`\`\`

### 2.4. fill_docx_template
Injeta os dados de \`estado_caso.json\` no template .docx gerado.
- Desaninhamento (*unflatten*) automático e expansão de arrays indexados (ex.: \`"etp.necessidade"\`, \`"itens.0.qtd"\` ou \`"itens[0].qtd"\`).
- Auto-sanitização prévia de templates legados contendo tags com pontos numéricos antes da compilação pelo \`docx-templates\`.
- Negrito seletivo: strings com \`**texto**\` são convertidas em runs <w:b/> sem contaminação de estilo.
- Quebras de linha: \`\\n\` em variáveis geram múltiplos parágrafos <w:p> preservando estilos de corpo.
- **Motor Híbrido de Lista Multinível Nativa (v0.7.0):**
  - Fora de tabelas (\`<w:body>\`): gera \`word/numbering.xml\` (9 níveis decimais com \`<w:suff w:val="tab"/>\`), aplica \`<w:numPr>\` com \`<w:startOverride>\` sincronizado com o capítulo pai e remove o prefixo numérico literal do \`<w:t>\`.
  - Dentro de tabelas (\`<w:tc>\`) ou em alíneas/bullets: mantém o marcador literal separado por \`<w:r><w:tab/></w:r>\` e aplica *Hanging Indent* (\`<w:ind w:left w:hanging>\` + \`<w:tabs>\`).
- **Pipeline Híbrido de Exportação DOCX para PDF (v0.9.5 / v1.0.0):** Suporta \`outputFormat: "docx" | "pdf" | "both"\` com conversão de alta fidelidade visual (Tier 1 Word COM / Tier 2 Pure-JS).
- **Auto-Inspeção Integrada:** Salva automaticamente \`state/inspecao_<stem>.json\` e o espelho linear de auditoria \`state/visao_auditoria_<stem>.md\` na pasta \`state/\` do caso (auto-inspecionando o PDF gerado caso \`outputFormat: "pdf"\`), dispensando rodar \`inspect_doc\` novamente.
- **Retorno Sintético MCP (< 1 KB):** Devolve \`status\`, \`engine_version\`, \`outputPath\`, \`pdf_path\` (se gerado), \`inspection_path\`, \`visao_auditoria_path\` e \`next_step_hint\` que orienta o acionamento direto do auditor externo sobre a visão linear gerada.

### 2.5. generate_audit_docx
Compila o parecer executivo de auditoria de controle externo em layout vertical A4 (ZERO tabelas <w:tbl>, 100% largura útil), com sanitização de crases e enums, fichas verticais e transcrições integrais em blocos de citação recuados.
- **Validação Fail-Fast e Exact Copy-Paste Error (v0.6.2):** Campos obrigatórios \`processo_id\` e \`resumo_executivo\` devem ser strings não-vazias; \`apontamentos\` deve ser array.
- **Exportação para PDF (v0.9.5 / v1.0.0):** Suporta \`outputFormat: "docx" | "pdf" | "both"\` com conversão via Pipeline Híbrido.
- **Retorno Sintético MCP (< 1 KB):** Devolve JSON sintético com \`status\`, \`engine_version\`, \`outputPath\`, \`pdf_path\` (se gerado), \`message\` e \`next_step_hint\`.
- **Contrato Canônico de \`relatorio_auditoria.json\`:**
\`\`\`json
${EXACT_COPY_PASTE_AUDIT_REPORT_SNIPPET}
\`\`\`

### 2.6. generate_technical_note_docx
Gera Nota Técnica Comparativa de Evolução Documental ('Antes vs. Depois', Marco 6) em formato Word (.docx) e PDF em layout editorial vertical A4 (ZERO tabelas <w:tbl>, 100% largura útil), com destaque visual colorido por cards com bordas laterais (verde para inclusão, vermelho para supressão, azul para alteração), diff inline em nível de token e fundamentação técnica/jurídica individualizada por cláusula.
- **Modos Híbridos:** Suporta modo direto via \`noteJsonPath\` ou modo comparativo automático derivado a partir de \`oldPath\` e \`newPath\` (com enriquecimento opcional via \`noteJsonPath\`).
- **Validação Fail-Fast e Exact Copy-Paste Error:** Validação estrita de contrato impedindo geração com campos obrigatórios ausentes.
- **Exportação para PDF:** Suporta \`outputFormat: "docx" | "pdf" | "both"\` via Pipeline Híbrido (Tier 1 COM / Tier 2 Pure-JS).
- **Retorno Sintético MCP (< 1 KB, margem < 900 bytes):** Devolve \`status\`, \`engine_version\`, \`document_type: "TECHNICAL_NOTE"\`, \`outputPath\`, \`pdf_path\` (se gerado), \`total_changes\`, \`message\` e \`next_step_hint\`.
- **Contrato Canônico de \`nota_tecnica.json\`:**
\`\`\`json
${EXACT_COPY_PASTE_TECHNICAL_NOTE_SNIPPET}
\`\`\`

### 2.7. fetch_pncp
Busca e ingere de forma determinística os metadados e todos os arquivos públicos de uma contratação de referência no Portal Nacional de Contratações Públicas (PNCP), com isolamento estrito na subpasta \`inputs/pncp_<shortname>/\`, descompactação in-place transparente (\`.zip\`, \`.tar\`, \`.tar.gz\`) via libmagic e catalogação leve para benchmarking técnico e pesquisa de mercado (IN SEGES/ME nº 65/2021).
- **Isolamento Físico Estrito:** Todos os arquivos externos baixados e seus membros extraídos residem exclusivamente em \`inputs/pncp_<shortname>/\`, sem nunca se misturarem com os documentos originais do usuário na raiz de \`inputs/\`.
- **Catalogação de Referência sem Auditoria:** Realiza extração estrutural leve de tópicos/seções em memória sem poluir \`state/\` com dossiês de auditoria ou Radar das 14 Zonas, gerando exclusivamente \`state/pncp_<shortname>_meta.json\` e \`state/indice_pncp_<shortname>.md\`.
- **Parsing Universal de Identificadores (3 Formatos + Redirects):** Suporta número de controle em edital (\`00394460000141-1-000015/2026\`), URLs do portal/API web, tupla simplificada (\`00394460000141/2026/15\`) e resolução nativa de URLs de redirecionamento do Google Grounding (\`vertexaisearch.cloud.google.com/grounding-api-redirect/...\`).
- **Validação Fail-Fast e Exact Copy-Paste Error:** Identificadores inválidos interrompem a execução imediatamente com mensagem canônica pronta para copiar e colar.
- **Retorno Sintético MCP (< 1 KB, margem < 900 bytes):** Devolve \`status\`, \`engine_version\`, \`pncp_ref\`, \`target_dir\`, \`meta_path\`, \`index_path\`, \`files_downloaded\`, \`unpacked_archives_count\`, \`extracted_files_count\`, \`inspected_count\` e \`next_step_hint\`.
- **Exemplo Canônico de Chamada para \`fetch_pncp\`:**
\`\`\`json
${EXACT_COPY_PASTE_PNCP_ID_SNIPPET}
\`\`\`

### 2.8. search_pncp
Realiza busca textual multi-query no endpoint oficial \`/api/search/\` do Portal Nacional de Contratações Públicas (PNCP) para descoberta de editais, termos de referência e contratações públicas de referência para benchmarking técnico e pesquisa de mercado (IN SEGES/ME nº 65/2021).
- **Multi-Query em Paralelo:** Permite fornecer termos múltiplos separados por pipe \`|\` (ex.: \`"fábrica de software | sustentação de sistemas"\`), executando as consultas simultaneamente via \`Promise.all\`.
- **Desduplicação Automática e Acumulação no Caso:** Normaliza e desduplica candidatos por \`CNPJ/ANO/SEQUENCIAL\` (\`pncp_id\`), acumulando os resultados em \`cases/<slug>/state/pncp_search_results.json\` e \`state/pncp_search_results.md\` sem perder buscas anteriores da mesma sessão.
- **Tabela Markdown com Objeto Integral:** O artefato \`state/pncp_search_results.md\` preserva o objeto completo de cada contratação sem truncamento, permitindo avaliação precisa de aderência sem estourar o contexto da LLM.
- **Suporte a URLs de Redirecionamento:** Aceita links de busca opacos do Google Grounding (\`vertexaisearch.cloud.google.com/grounding-api-redirect/...\`), resolvendo-os para inclusão imediata como candidato estruturado.
- **Retorno Sintético MCP (< 1 KB, margem < 900 bytes):** Devolve \`status\`, \`engine_version\`, \`queries_executed\`, \`results_count\`, \`total_accumulated\`, \`results_md_path\`, \`results_json_path\`, \`top_candidates\` e \`next_step_hint\`.
- **Exemplo Canônico de Chamada para \`search_pncp\`:**
\`\`\`json
${EXACT_COPY_PASTE_PNCP_SEARCH_SNIPPET}
\`\`\`

---

## 3. Cache Global, Rastreabilidade Temporal e Sanity Check (core/registry/templates/)
- Os templates homologados são armazenados em \`core/registry/templates/<template_id>.json\` com \`created_at\`, \`updated_at\`, \`engine_version\` e \`slots_count\`.
- Ao atualizar um template já existente no disco, o \`created_at\` original é preservado e \`updated_at\` é renovado.
- Caches legados sem \`created_at\` ou \`updated_at\` são aceitos sem erro e sem usar \`mtime\` do disco, reportando \`"NÃO DISPONÍVEL"\`, \`age_days: null\` e \`cache_date_status: "UNKNOWN"\` para informar ao usuário no Gate 1.
- O método \`loadAllRegistryTemplates\` executa normalização automática em cada entrada e descarta silenciosamente manifestos corrompidos com 0 regras.
`.trim();
}
