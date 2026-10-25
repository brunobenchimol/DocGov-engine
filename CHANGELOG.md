# Changelog

Todas as mudanças notáveis no projeto **`docgov-engine`** estão documentadas neste arquivo.

O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/), e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

---

## [1.3.1] - 2026-10-25

### Corrigido
- **Resiliência de Caminhos e Desacoplamento de CWD da IDE (`src/utils/paths.ts` — Lei 6):**
  - Implementação do módulo centralizador de resolução de caminhos `resolveWorkspacePath`, aplicando-o a 100% dos parâmetros de arquivos e diretórios de entrada em todas as 6 ferramentas MCP (`bootstrap_case`, `inspect_doc`, `build_docx_template`, `fill_docx_template`, `generate_audit_docx`, `generate_technical_note_docx`).
  - Resolução robusta de caminhos relativos (ex.: `"cases/seduc_pa_rev2_id0015"`) mesmo quando o processo MCP é instanciado pela IDE consumidora (Google Antigravity, Claude Desktop) com `process.cwd()` apontando para pastas de programas locais (`AppData/Local/Programs/antigravity`).
  - Inferência inteligente da raiz do workspace DocGov a partir da localização do binário (`process.execPath`), variáveis de ambiente (`DOCGOV_WORKSPACE_DIR` / `DOCGOV_ROOT_DIR`) ou busca ascendente pela existência dos diretórios `cases/` ou `core/skills/`, eliminando a criação espúria de arquivos no diretório da IDE e o erro `file does not exist` no workspace.
- **Prevenção de Erro Críptico do JSZip e Fail-Fast Amigável (`src/tools/inspect.ts`):**
  - Implementação da validação prévia de magic bytes ZIP (`isZipBuffer`) antes de acionar `JSZip.loadAsync`, evitando exceções ininteligíveis (`Can't find end of central directory : is this a zip file?`) ao receber arquivos arbitrários ou corrompidos.
  - Mensagens de erro claras, instrutivas e imperativas orientando que os formatos aceitos são `.docx`, `.pdf`, `.xlsx`, `.csv`, `.md` e `.txt` e indicando a localização dos binários originais em `.user_uploaded` ou `inputs/`.

### Adicionado
- **Inspeção Linear Nativa de Arquivos Markdown e Texto Puro (`.md`, `.txt` — `src/tools/inspect.ts`):**
  - Suporte nativo à inspeção estrutural de notas técnicas, minutas e despachos em formato texto puro e markdown (`.md`, `.markdown`, `.txt`, `.text`, `.log`), gerando parágrafos, `toc_map`, Cartografia Estrutural e detecção pelo Radar das 14 Zonas de Impugnação (Z1..Z14).
  - Emissão automática de `state/visao_auditoria_<stem>.md` e `state/dossie_hotspots_<stem>.md` com aviso informativo de que minutas binárias originais (`.docx`/`.pdf`) em `.user_uploaded` possuem maior fidelidade para auditoria externa.
  - Formatação de payload sintético MCP mantendo estritamente a margem de segurança da Lei 2 ($< 900$ bytes).

### Alterado
- **Sincronia Estrita de Self-Discovery & Release v1.3.1 (Leis 4 e 7):**
  - Atualização do número de versão SemVer para `1.3.1` em `package.json`, `src/constants/index.ts`, `src/mcp/spec.ts`, `docs/especificacao_motor.md` e `README.md`.
  - Recompilação dos binários standalone `./bin/docgov-engine` e `./bin/docgov-engine.exe` e regeneração de `./bin/SHA256SUMS.txt`.

---

## [1.3.0] - 2026-10-25

### Adicionado
- **Diff Semântico Granular em Nível de Token (`src/core/structural_diff.ts` — Marco 6.1):**
  - Tokenizador com regex Unicode `gu` (`/(?:R\$\s*[\d\.,]+|\d+(?:\.\d+)+|[\p{L}\p{N}_ºª§]+|\s+|[^\p{L}\p{N}_\s])/gu`), tratando adequadamente palavras acentuadas da língua portuguesa (`contratação`, `órgão`), quantias monetárias (`R$ 1.500,00`), numerais de artigos e ordinais (`1º`, `art. 67`) e pontuações sem fragmentação.
  - Algoritmo LCS (*Longest Common Subsequence*) com guardrail de complexidade para blocos de cláusulas extensas ($m \times n > 2.000.000$, particionamento por sentenças `/(?<=[.;!?])\s+/`), garantindo performance instantânea sem estouro de memória ou tempo de execução.
  - Agrupamento inteligente de tokens contíguos em blocos semânticos (`diff_chunks`), gerando representação em markdown inline com `{++inclusão++}` e `{--supressão--}`.
  - Enriquecimento dos resultados de `computeStructuralDiff` com `diff_chunks` anexados a cada item de alteração.
- **Contrato Canônico de Evolução de Cláusulas e Fail-Fast (`src/contracts/errors.ts` — Marco 6.1):**
  - Definição do contrato estrito `TechnicalNoteData` (`processo_id`, `orgao_entidade`, `artefato_auditado`, `versao_anterior`, `versao_nova`, `resumo_executivo`, `contagem`, `quadro_evolucao` com itens `EvolutionClauseItem` contendo `justificativa_tecnica` e `fundamentacao_juridica`, e `delta_zonas`).
  - Validador fail-fast `validateTechnicalNoteData` com o padrão Exact Copy-Paste Error (`EXACT_COPY_PASTE_TECHNICAL_NOTE_SNIPPET`), interrompendo com instrução mandatória e snippet canônico em caso de inconsistência contratual.
- **Renderizador Formal da Nota Técnica Comparativa em DOCX e PDF (`src/tools/technical_note.ts` — Marco 6.2):**
  - Emissão executiva formal ("Antes vs. Depois") para instrução processual de alterações contratuais (Art. 124 a 136 da Lei nº 14.133/2021).
  - Diagramação corporativa em folha A4 retrato vertical corrida (zero tabelas `<w:tbl>`, 100% de largura útil).
  - Cards visuais com bordas laterais coloridas por tipo de alteração (verde para `INCLUSAO`, vermelho para `SUPRESSAO`, azul para `MODIFICACAO`).
  - Renderização granular de diff de tokens inline destacando termos adicionados e suprimidos dentro da mesma cláusula.
  - Seções formais com dados do processo e órgão, quadro executivo de alterações, detalhamento individualizado de cláusula por cláusula (com justificativa técnica e fundamentação jurídica), síntese de impacto nas 14 Zonas de Impugnação, conclusão executiva e linhas de assinatura.
  - Suporte nativo a exportação direta para PDF via Pipeline Híbrido (Tier 1 Word COM / Tier 2 Pure-JS).
  - Formatação sintética `formatTechnicalNoteSyntheticResult` mantendo o payload rigorosamente abaixo de 900 bytes (Lei 2).
- **Orquestrador de Comparação Multi-Arquivo e Modo CLI `--diff-report` (`src/cli/index.ts` — Marco 6.2):**
  - Nova flag CLI `--diff-report --old <base> --new <revisado> --out <nota.docx> [--format <docx|pdf|both>] [--data <nota.json>]` orquestrando inspeção e diff automático entre arquivos brutos (`.docx`, `.pdf` ou `.json`), derivando `TechnicalNoteData` e compilando a Nota Técnica.
  - Nova flag CLI `--generate-technical-note --note-json <nota.json> --out <nota.docx> [--format <docx|pdf|both>]` para compilação direta de nota técnica a partir de JSON estruturado.
  - Função auxiliar `createTechnicalNoteDataFromDiff` para derivação unificada e consistente entre CLI e MCP.
- **Ferramenta MCP `generate_technical_note_docx` Híbrida (`src/mcp/server.ts` — Marco 6.2):**
  - Registro da 6ª ferramenta nativa no servidor MCP com suporte tanto ao modo direto (`noteJsonPath` + `outputPath`) quanto ao modo comparativo automático (`oldPath` + `newPath` + `outputPath`, com enriquecimento opcional via `noteJsonPath`).
  - Retorno sintético com `document_type: "TECHNICAL_NOTE"`, `total_changes`, `next_step_hint` e payload $< 900$ bytes.
  - Roteamento transparente em `generate_audit_docx` para `generateTechnicalNoteDocx` quando `document_type === "TECHNICAL_NOTE"` ou `"EVOLUTION_REPORT"`.

### Alterado
- **Sincronia Estrita de Self-Discovery (Lei 4):**
  - Atualização da versão para `1.3.0` em `package.json`, `src/constants/index.ts`, `src/mcp/spec.ts`, `docs/especificacao_motor.md` e `README.md`.
  - Sincronização de `DOCX_ENGINE_INSTRUCTIONS`, `DOCX_WORKFLOW_GUIDE_TEXT`, descrições das ferramentas MCP em `getMcpToolsDefinition()` e hints para cobrir as 6 ferramentas e o Marco 6.

---

## [1.2.0] - 2026-10-25

### Adicionado
- **Segurança de Supply-Chain & Auto-Updater com Checksum SHA-256 (`src/core/updater.ts`):**
  - Implementada validação criptográfica estrita do hash `SHA-256` (`parseSha256Sums`, `verifyBinarySha256`) comparando o binário baixado em memória contra `SHA256SUMS.txt` antes de substituir o arquivo em disco durante `--update`.
  - Suporte híbrido transparente para resolução de token do GitHub (`resolveGitHubToken`), priorizando `DOCGOV_GITHUB_TOKEN` e `GH_TOKEN` de variáveis de ambiente com fallback automático para arquivo local `.env` no diretório atual ou ancestrais próximos, suportando download autenticado de assets da API do GitHub (`application/octet-stream`) em repositórios públicos e privados.
  - Criado script de release determinístico `scripts/generate_sha256sums.ts` para geração de `bin/SHA256SUMS.txt`.
- **Ingestão Nativa de Planilhas Orçamentárias `.xlsx` e `.csv` (`src/parsers/spreadsheet.ts`):**
  - Parser OpenXML nativo e leve (`parseXlsxBuffer`) lendo `xl/worksheets/sheet*.xml` e `xl/sharedStrings.xml` via JSZip e `@xmldom/xmldom` sem dependências externas pesadas.
  - Indexação estrita por coordenada de célula `r="A1"` (`columnLetterToIndex`), garantindo que células intermediárias vazias omitidas pelo Excel nunca desloquem as colunas de Quantidade, Preço Unitário e Valor Total no `budget_auditor.ts`.
  - Parser RFC 4180 (`parseCsvBuffer`) para `.csv` suportando delimitadores `,` e `;` e codificações UTF-8 e Latin1.
  - Integração direta em `inspect_doc` e `bootstrap_case`, gerando coordenadas `[ABA_01 | R2.C4]`, auditando todas as tabelas via `budget_auditor.ts` ($	ext{Qtd} \times \text{Unit} = \text{Total}$ em centavos inteiros nas zonas Z10/Z12), emitindo `state/auditoria_orcamentaria_<stem>.json`, `state/visao_auditoria_<stem>.md` e `state/dossie_hotspots_<stem>.md`.
- **Engenharia Tabular Avançada Multi-Página, Multilinha e Mesclagem (`src/utils/xml.ts`, `src/core/budget_auditor.ts`):**
  - Detecção e unificação de tabelas multi-página consecutivas que repetem o cabeçalho em documentos DOCX e PDF.
  - Agrupamento de linhas textuais quebradas dentro da mesma célula lógica (células multilinha), consolidando descrições extensas de itens orçamentários.
  - Normalização de células mescladas (`extractCellGridSpan` / `gridSpan` para colspan e `extractCellVMerge` / `vMerge` para rowspan) no OpenXML, prevenindo desalinhamento de colunas em tabelas complexas.
- **Pipeline OCR Headless para PDFs Escaneados (`src/core/ocr.ts`, `src/utils/pdf.ts`):**
  - Mecanismo determinístico de OCR standalone que opera 100% offline embutido no binário Bun (sem dependências de ferramentas externas no SO host), acionado automaticamente quando `scanned_pages_detected > 0`.
  - Injeção das linhas reconhecidas diretamente nas coordenadas canônicas `[PAG_XXX | LYYYY]`, permitindo que o Radar das 14 Zonas (`Z1..Z14`) e o `budget_auditor` examinem páginas escaneadas mantendo o flag `ocr_applied: true` e `ocr_pages`.
  - Clonagem protetiva do buffer no `extractPdfPages` (`buffer.slice(0)`), evitando que workers internos do PDF desanexem o `ArrayBuffer` subjacente.
- **Emissão Parametrizada de Matriz de Riscos e Checklist de Conformidade (`src/tools/audit.ts`):**
  - Expansão da ferramenta `generate_audit_docx` para suportar tipos especializados via `document_type`: `"AUDIT_REPORT"` (padrão), `"RISK_MATRIX"` e `"COMPLIANCE_CHECKLIST"`.
  - Renderização estruturada de **Matriz de Gerenciamento de Riscos (Art. 18, X e Art. 22 da Lei nº 14.133/2021)** com severidade cromática (Crítico, Alto, Médio, Baixo), alocação contratual de riscos (Contratante, Contratada, Compartilhado) e ações de mitigação/contingência.
  - Renderização estruturada de **Checklist de Conformidade Normativa (TCU/AGU/MGI)** com status cromáticos (`[CONFORME]`, `[NÃO CONFORME]`, `[PARCIALMENTE CONFORME]`, `[NÃO APLICÁVEL]`), fundamentação legal e recomendações de adequação.
  - Preservação estrita do layout corporativo editorial vertical corrido A4 (zero tabelas `<w:tbl>` espremidas na horizontal), suporte a exportação para PDF e validação fail-fast com padrão Exact Copy-Paste Error.

### Alterado
- **Sincronia Estrita de Self-Discovery (Lei 4):**
  - Atualização da versão para `1.2.0` em `package.json`, `src/constants/index.ts` e spec Markdown (`--dump-spec`).
  - Sincronização de `DOCX_ENGINE_INSTRUCTIONS`, `DOCX_WORKFLOW_GUIDE_TEXT`, descrições das ferramentas MCP em `getMcpToolsDefinition()` e hints com a série `v1.2.x`.


---

## [1.1.1] - 2026-10-24

### Corrigido
- **Sanitização Universal de UTF-8 BOM e Whitespaces Iniciais (`src/utils/xml.ts`):** Implementada a função utilitária `sanitizeXmlString`, eliminando Byte Order Mark (`\uFEFF`) e quaisquer caracteres em branco ou quebras de linha antes do primeiro caractere `<`. Corrige o crash fatal do `@xmldom/xmldom` (`sax.js:922`: `processing instruction at position 1 is an xml declaration which is only at the start of the document`), assegurando abertura resiliente de documentos DOCX manipulados por suítes de escritório diversas.
- **Deduplicação e Movimentação Limpa da Raiz do Caso (`src/tools/bootstrap.ts`):** Detecção automática de documentos colocados soltos na raiz de `cases/<slug>/`. Os insumos são transferidos de forma limpa para `inputs/` ou deduplicados (`unlinkSync`) caso já existam em `inputs/`, preservando integralmente arquivos do sistema (`context.json`, `metadata.json`, `README.md`) e prevenindo duplicação indevida de espaço em disco.

### Adicionado
- **Resiliência Multi-Arquivo com Isolamento `try/catch` (`src/tools/bootstrap.ts`):** O loop de inspeção inicial agora processa cada documento de forma isolada. Erros de leitura ou parsing em anexos corrompidos são registrados em `failed_inspections` sem interromper o processamento das demais peças do caso.
- **Inventário Probatório Completo no Índice Mestre (`state/indice_mestre_caso.md`):** Garantia de que 100% dos arquivos presentes em `inputs/` constem na tabela do dossiê, com status claros (`inspected`, `⚠️ Falha de leitura` e `📊 Anexo de dados` para planilhas `.xlsx`/`.csv`).
- **Métricas de Ressalva no Payload Sintético MCP (Lei 2):** Inclusão de `inspection_errors_count` no payload JSON de retorno do `bootstrap_case`, mantendo o tamanho estritamente abaixo de 900 bytes e alertando o agente consumidor caso haja necessidade de conversão ou reparo prévio de insumos.

---

## [1.1.0] - 2026-10-23

### Adicionado
- **Auditoria Matemática Determinística de Planilhas Orçamentárias (`src/core/budget_auditor.ts`):** Módulo autônomo com conversão e normalização monetária pt-BR e internacional para centavos inteiros (`BigInt` / `Math.round`), eliminando imprecisões de ponto flutuante IEEE 754.
- **Detecção Inteligente de Colunas e Quadros de Preços:** Identificação resiliente de tabelas OpenXML (`.docx`) e colunas reconstruídas via ` | ` (`.pdf`) contendo variações de `Item`, `Descrição`, `Unid`, `Qtd`, `Valor Unitário` e `Valor Total`.
- **Dupla Verificação Matemática Determinística (Marco 4.2):** Checagem horizontal linha a linha ($\text{Qtd} \times \text{Unit} = \text{Total}$) com classificação estrita em `ROUNDING_WARNING` ($\le R\$\,0,02$) e `MATH_ERROR` ($> R\$\,0,02$), validação vertical de subtotais e somatório do Total Geral da planilha.
- **Cruzamento com o Texto e Radar Z10/Z12:** Detecção automática de valores globais no corpo do documento e validação cruzada contra o total da planilha, injetando alertas diretamente no Radar das 14 Zonas (`Z10_PRECOS_EXEQUIBILIDADE_PLANILHA` e `Z12_MAPA_CRUZADO_MULTIPECA`).
- **Persistência de Evidências Orçamentárias:** Emissão do relatório detalhado em `state/auditoria_orcamentaria_<stem>.json` e incorporação de bloco executivo na visão linear (`state/visao_auditoria_<stem>.md`) e no dossiê de hotspots (`state/dossie_hotspots_<stem>.md`).
- **Motor de Diff Estrutural e Semântico Multi-Versão (`src/core/structural_diff.ts`):** Comparação profunda entre versões de minutas e editais retificados (`oldPath` vs `newPath`), classificando seções e parágrafos em `ADDED`, `REMOVED` e `MODIFIED` com realce cirúrgico inline `~~antigo~~` $\rightarrow$ `**novo**`.
- **Rastreamento de Impacto no Radar das 14 Zonas:** Identificação do delta de pontos quentes entre versões (`INTRODUCED`, `RESOLVED`, `RETAINED`) persistido em `state/diff_documental_<stem>.md` e `state/diff_documental_<stem>.json`.
- **Exposição Multi-Interface de Diff:** Suporte ao parâmetro `compareWithPath` na ferramenta MCP `inspect_doc` e flag `--diff <caminho>` na CLI.
- **Instituição da Lei 8 de Governança no `AGENTS.md`:** Adição da Lei 8 estabelecendo como requisito obrigatório a disciplina autônoma de micro-commits atômicos e semânticos (`feat`, `fix`, `test`, `docs`, `chore`), a garantia de reversibilidade cirúrgica (`git bisect`/`git revert`) e a manutenção proativa da memória evolutiva do projeto.
- **Protocolo Operacional de Micro-Commits e Rastreabilidade Contínua:** Novo capítulo no [`AGENTS.md`](AGENTS.md) padronizando o fatiamento obrigatório de micro-commits em todo plano técnico (`/plan`), a exigência de testes 100% verdes por commit, o ritual contínuo entre `CHANGELOG.md` e `ROADMAP.md`, e o Definition of Done (DoD) global do motor.

### Alterado
- **Enriquecimento do Payload Sintético MCP (Lei 2):** Incorporação de resumos executivos de auditoria orçamentária (`budget_audit`) e diff (`diff_summary`) nas ferramentas `inspect_doc` e `bootstrap_case`, preservando o payload estritamente abaixo do teto seguro (< 900 bytes).
- **Sincronia Estrita de Self-Discovery (Lei 4):** Atualização de `--dump-spec`, `DOCX_ENGINE_INSTRUCTIONS`, esquemas MCP e documentação normativa com as especificações da `v1.1.0`.

---

## [1.0.0] - 2026-10-21

### Adicionado
- **Nova Ferramenta Multimodal `inspect_doc`:** Substituição semântica e unificação de leitura para arquivos `.docx` e `.pdf`, aceitando `filePath` como parâmetro principal agnóstico de extensão.
- **Instaladores Oficiais One-Liner:** Scripts de instalação automatizada para Windows (`scripts/install.ps1`) e Linux/WSL (`scripts/install.sh`) com checagem de integridade do binário (> 50 MB) e teste de execução `--version`.
- **Binários Oficiais Renomeados:** Compilação e distribuição dos binários oficiais sob a marca `docgov-engine.exe` (Windows) e `docgov-engine` (Linux).
- **Testes de Fumaça de Distribuição em CI:** Validação automatizada no GitHub Actions de compilação, instaladores e execução dos binários com fixtures sintéticas reproduzíveis.

### Alterado
- **Corte Limpo de Identidade (Clean Cut):** Transição institucional completa de `docgov-docx-engine` para `docgov-engine` em todo o código-fonte, banners de CLI, servidor MCP (`name: "docgov-engine"`), dependências e documentação.
- **Margem de Segurança Estrita MCP (< 900 bytes):** Redução das mensagens informativas e ajuste do limiar de truncamento sintético em `bootstrap_case` e `inspect_doc` para `< 900 bytes`, assegurando folga preventiva garantida contra o teto de 1024 bytes (Lei 2).
- **Compatibilidade Retroativa de Inspeção:** Abertura transparente do alias `inspect_docx` e aceitação do parâmetro legado `docxPath` no `inspect_doc` para manter compatibilidade total com clientes MCP pré-v1.0.0.
- **Sincronia Estrita de Self-Discovery (Lei 4):** Atualização unificada da flag `--dump-spec`, das instruções do motor (`DOCX_ENGINE_INSTRUCTIONS`), dos prompts MCP e das descrições em `getMcpToolsDefinition()`.

---

## [0.9.6] - 2026-10-21

### Corrigido
- **CORR-01 (Cartografia e Dossiê Hotspots):** Desacoplamento dos sinais da página (`page_signals`) dos gatilhos de contexto no `dossie_hotspots_<stem>.md`. A Linha 1 (`[PAG_001 | L0001]`) não é mais classificada indevidamente como alvo de impugnação, e linhas introdutórias distantes (`L01..L08`) não vazam no recorte contextual de $\pm 12$ linhas quando o hotspot real situa-se em linhas posteriores.
- **CORR-02 (Reconstrução Espacial de Tabela PDF com Y-Jitter):** Tolerância a micro-variações no eixo vertical ($\Delta Y \le 2.5\text{pt}$), preservando o agrupamento correto e o separador colunar ` | ` entre todas as células de tabelas e planilhas orçamentárias.
- **CORR-03 (Ordenação X e Gutter de Tokens Curtos):** Ordenação horizontal estrita por $X$ crescente e aplicação de largura segura calculada (`effectiveWidth`) para tokens curtos (`01`, `02`, `UN`), prevenindo a coalescência de colunas e garantindo espaçamento adequado.
- **CORR-04 (Modo Exclusivo PDF sem Resíduos ZIP):** Implementação da rotina canônica `resolveOutputPaths` evitando extensões duplicadas (`.pdf.pdf`) e isolando o DOCX intermediário em arquivo temporário (`__tmp_*.docx`), removido confiavelmente no bloco `finally`.
- **CORR-05 (Liberação Determinística Word COM e File Locks):** Liberação forçada de ponteiros COM no PowerShell (`$doc` e `$word`) com `[System.Runtime.InteropServices.Marshal]::ReleaseComObject` e `[GC]::WaitForPendingFinalizers`, acompanhada de rotina de deleção resiliente `safeUnlink` com retentativas contra bloqueios de arquivo intermitentes no Windows.

### Adicionado
- **Bateria de Testes Black-Box de Conformidade:** Inclusão de testes contratuais de integração cobrindo os Assertos 12 e 13 da certificação de robustez externa.

---

## [0.9.5] - 2026-10-20

### Adicionado
- **Pipeline Híbrido de Exportação DOCX $\rightarrow$ PDF (`src/utils/pdf_exporter.ts`):**
  - **Tier 1 (Fidelidade Word COM):** Automação em segundo plano via PowerShell/COM no Windows/WSL para conversão com fidelidade visual 100% nativa (preservação de brasões, cabeçalhos, tabelas complexas e fontes).
  - **Tier 2 (Fallback Standalone Pure-JS):** Renderizador vetorial embutido em TypeScript (`pdf-lib` + `@xmldom/xmldom` + `jszip`), assegurando geração autônoma de PDFs sem depender do MS Office ou LibreOffice.
- **Parâmetro `outputFormat` nas Ferramentas MCP:** Suporte ao argumento opcional `outputFormat: "docx" | "pdf" | "both"` nas ferramentas `fill_docx_template` e `generate_audit_docx`.
- **Flag CLI `--format`:** Parâmetro correspondente `--format <docx|pdf|both>` na interface de linha de comando.
- **Auto-Inspeção Imediata de PDFs:** Quando compilado em modo exclusivo PDF, o motor realiza a auto-inspeção do PDF gerado e emite a visualização linear diretamente em `state/visao_auditoria_<stem>.md`.

---

## [0.9.0] - 2026-10-19

### Adicionado
- **Reconstrução Colunar de Tabelas PDF (`Y-Axis Line Grouping`):** Agrupamento geométrico de palavras por coordenada vertical $Y$ com tolerância dinâmica e ordenação horizontal por $X$, gerando formatação de colunas separadas por ` | ` (estilo Markdown).
- **Dossiê Executivo de Hotspots (`state/dossie_hotspots_<stem>.md`):** Geração automática de dossiê consolidando o Mapa Cartográfico Estrutural e os recortes cirúrgicos de $\pm 12$ linhas de contexto ao redor de todas as ocorrências das 14 Zonas de Impugnação (`Z1` a `Z14`) e tabelas de itens, permitindo triagem completa de editais extensos em um único turno de leitura.
- **Detector de Páginas Escaneadas (`Scanned PDF Trap`):** Medição de densidade de texto por página; identificação de páginas sem camada textual (< 25 caracteres), emissão do campo `"scanned_pages_detected"` no JSON estrutural e alertas explícitos no espelho de leitura linear.
- **Índice Cartográfico Unificado (`state/indice_mestre_caso.md`):** Mapeamento transversal no `bootstrap_case` de todos os documentos da pasta `inputs/`, correlacionando arquivos, seções e páginas com as 14 Zonas de Impugnação.

---

## [0.8.1] - 2026-10-18

### Adicionado
- **Radar Léxico das 14 Zonas de Impugnação (`Z1` a `Z14`):** Expansão e refinamento do radar pericial determinístico sem IA, desmembrando a antiga zona Z7 em três eixos independentes:
  - `Z7`: *Datasheet Trap* (Direcionamento Oculto e especificações proprietárias fechadas);
  - `Z13`: Marca Explícita / Padronização Indevida (vedação ao direcionamento de marcas sem justificativa técnica);
  - `Z14`: Métricas de Esforço / UST / Licenciamento (restrições a modelos de remuneração vedados e exigências desproporcionais).

---

## [0.8.0] - 2026-10-18

### Adicionado
- **Extração e Cartografia Estrutural Nativa de PDF:** Ingestão de arquivos PDF sem OCR ou IA externa, com marcação estrita de coordenadas estruturais `[PAG_XXX | LYYYY]`.
- **Visualização Linear de Auditoria de PDF (`state/visao_auditoria_<stem>.md`):** Espelho legível para humanos e LLMs contendo cabeçalho estrutural e transcrição integral do texto linha a linha.
- **Radar Pericial Inicial de 12 Zonas:** Classificação léxica em duas categorias (`outline_headings` e `page_signals`) cobrindo cláusulas restritivas, atestados, prazos de impugnação, garantias e penalidades.

---

## [0.7.3] - 2026-10-18

### Corrigido
- **Resiliência de Criação de Diretórios (Zero ENOENT):** Criação automática e recursiva de diretórios-pai no `build_docx_template` caso a pasta de destino não exista previamente.
- **Estruturação de Pastas no Bootstrap:** Inicialização garantida do subdiretório `templates/` durante a execução de `bootstrap_case`.

---

## [0.7.2] - 2026-10-18

### Adicionado
- **Auto-Sanitização de Notação de Ponto em Tags JS:** Conversão transparente de tags de template com notação numérica de ponto (`{{itens.0.qtd}}` $\rightarrow$ `{{itens[0].qtd}}`) no processamento de templates DOCX.
- **Validação Léxica Precoce de Sintaxe com Fail-Fast:** Detecção antecipada de sintaxes JavaScript inválidas em expressões de template durante o `build_docx_template`, interrompendo com o padrão *Exact Copy-Paste Error*.

---

## [0.7.1] - 2026-10-17

### Adicionado
- **Telemetria de Versão nos Retornos Sintéticos:** Inclusão obrigatória do campo `"engine_version"` na raiz do JSON sintético de todas as 5 ferramentas MCP, mantendo a resposta estritamente abaixo do teto de 1024 bytes.

---

## [0.7.0] - 2026-10-17

### Adicionado
- **Motor Híbrido de Listas Multiníveis no Word:**
  - Detecção contextual no DOM OpenXML via `isInsideTableCell`:
    - **Fora de tabelas (Corpo do Documento):** Emissão de listas multiníveis nativas via `<w:numPr>` com `<w:startOverride>` referenciando `word/numbering.xml`.
    - **Dentro de células de tabela (`<w:tc>`):** Emissão estática de *Hanging Indent* (`<w:ind w:left="400" w:hanging="400"/>`) com tabulação (`<w:tab/>`), garantindo alinhamento tipográfico perfeito sem corrupção de layout em células.
- **Modularização da Suíte de Testes:** Reorganização dos testes automatizados em 8 suítes temáticas de domínio com utilitários de fixtures compartilhados.

---

## [0.6.4] - 2026-10-17

### Adicionado
- **Rastreabilidade Temporal de Cache:** Metadados estruturados de datação (`cached_at`, `source_hash`) com retrocompatibilidade estrita para entradas anteriores do cache global.
- **Auto-Inspeção e Auditoria Linear no Preenchimento:** Execução automática de inspeção e geração imediata do espelho `state/visao_auditoria_<stem>.md` ao finalizar a execução de `fill_docx_template`.

---

## [0.6.3] - 2026-10-17

### Alterado
- **Modularização Arquitetural:** Decomposição do arquivo monolítico `src/index.ts` em submódulos desacoplados (`core/`, `mcp/`, `utils/`, `types/`).
- **Limpeza da Especificação de Consumo:** Otimização dos esquemas de ferramentas e anotações para consumo limpo por agentes de IA.

---

## [0.6.2] - 2026-10-16

### Adicionado
- **Padrão Exact Copy-Paste Error (Lei 3):** Implementação de fail-fast imperativo emitindo a instrução `"NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:"` acompanhada do snippet JSON canônico pronto.
- **Flag de Auto-Descoberta `--dump-spec`:** Comando de linha que exibe a especificação contratual e instruções normativas completas do motor em Markdown.
- **Estatuto de Governança (`AGENTS.md`):** Instituição das 7 Leis Invioláveis de Engenharia do ecossistema standalone.

---

## [0.6.1] - 2026-10-16

### Adicionado
- **Coordenadas Estruturais Compactas:** Redução do overhead de caracteres no índice estrutural de cabeçalhos.
- **Sanity Check no Cache Global:** Descarte automático e expurgo de templates cacheados corrompidos com 0 regras válidas.
- **Validação Fail-Fast em Templates:** Interrupção imediata com mensagens assertivas ao detectar templates com sintaxe violada.

---

## [0.6.0] - 2026-10-15

### Adicionado
- **Cache Estrutural Cross-Órgão SHA-256 (`core/registry/templates/`):** Detecção automática de similaridade estrutural e classificação de reaproveitamento (`EXACT`, `MODIFIED`, `NEW`).
- **Reancoragem Dinâmica por Auto-Offset de Tabelas:** Cálculo automático de deslocamento de linhas e colunas para preservação de preenchimento quando itens são inseridos ou removidos.
- **Espelho Linear de Leitura (`state/visao_auditoria_<stem>.md`):** Emissão determinística da transcrição linha a linha com coordenadas de parágrafos e tabelas.
- **Atualização Silenciosa em Background:** Execução transparente de auto-atualização no Windows sem janelas de terminal ou comandos de ping visíveis.

---

## [0.5.1] - 2026-10-15

### Adicionado
- **Auto-Nomenclatura Semântica Universal:** Identificação automática da natureza documental (`Edital`, `Termo_de_Referencia`, `Minuta_Contrato`) com base em conteúdo léxico.
- **Validação de Assinatura por Magic Bytes:** Identificação do formato real dos arquivos (`PK\x03\x04` para DOCX, `%PDF-` para PDF), rejeitando arquivos com extensões forjadas.
- **Mapa de Renomeação (`fileRenameMap`):** Relatório detalhado das alterações de nomenclatura aplicadas no `bootstrap_case`.

---

## [0.5.0] - 2026-10-15

### Adicionado
- **Índice Estrutural `toc_map`:** Extração hierárquica e mapeamento de parágrafos, tabelas e marcadores de seções em `state/estrutura_<stem>.json`.
- **Parser Tolerante de JSON:** Recuperação de payloads com chaves desalinhadas, unflattening automático de notação pontuada (`a.b.c`) e reparo de strings truncadas.

### Alterado
- **Compactação de `toc_summary`:** Ajuste fino dos campos de resumo de seções para garantir retornos sintéticos abaixo de 800 bytes.

---

## [0.4.0] - 2026-10-14

### Adicionado
- **Self-Discovery Nativo no Servidor MCP (Lei 4):** Exposição centralizada das instruções normativas do motor (`DOCX_ENGINE_INSTRUCTIONS`), guias de fluxo de trabalho (`DOCX_WORKFLOW_GUIDE_TEXT`), anotações de ferramentas e dicas de próximo passo (`next_step_hint`).

---

## [0.3.3] - 2026-10-14

### Alterado
- **Retornos Sintéticos MCP (< 1 KB) (Lei 2):** Transição de respostas volumosas de `bootstrap_case` e `inspect_docx` para sumários compactos persistindo dossiês em disco (`state/`), evitando truncamento no `output.txt` de IDEs consumidoras.

---

## [0.3.2] - 2026-10-13

### Otimizado
- **Cópia Não-Bloqueante de PDFs no Bootstrap:** Operação assíncrona de ingestão de arquivos PDF pesados com rastreamento de estado em `salvaguarda_status`.

---

## [0.3.1] - 2026-10-12

### Alterado
- **Redesenho do Relatório de Auditoria (`generate_audit_docx`):** Substituição de tabelas internas por cartões verticais A4 de largura total, citações multi-trecho com barra lateral colorida e sanitização léxica de textos de impugnação via `cleanHumanText`.

---

## [0.3.0] - 2026-10-12

### Adicionado
- **Ferramenta `bootstrap_case`:** Inicialização padronizada da árvore de pastas do caso (`inputs/`, `templates/`, `state/`, `output/`).
- **Ferramenta `generate_audit_docx`:** Compilação de relatórios periciais estruturados de auditoria a partir de `relatorio_auditoria.json`.
- **Resumo Compacto em `inspect_docx`:** Primeira versão do índice resumido de cabeçalhos.
- **Automação de Dependências:** Configuração do Dependabot para monitoramento de pacotes.

---

## [0.2.2] - 2026-10-12

### Adicionado
- **Listas Multiníveis Aninhadas:** Suporte a profundidade multinível (1.1, 1.1.1, 1.1.1.1) e processamento de árvores JSON recursivas em templates DOCX.

---

## [0.2.1] - 2026-10-12

### Corrigido
- **Prevenção de Herança de Negrito:** Isolamento de estilos em `build_docx_template` para evitar contaminação de negrito entre elementos adjacentes.
- **Captura de Quebras de Linha XML:** Varredura recursiva de elementos `<w:br/>` encapsulados dentro de `<w:t>` no método `extractParagraphText`.

### Adicionado
- **Formatação Inline e Multiparágrafos:** Suporte à sintaxe de marcação Markdown `**negrito**` e quebras explícitas `\n` em slots do `fill_docx_template`.

---

## [0.2.0] - 2026-10-12

### Adicionado
- **Mecanismo de Auto-Atualização Standalone (`Self-Update`):**
  - Flags de linha de comando: `--check-update`, `--update` e `--force-update`;
  - Download e substituição atômica do binário a partir das releases do GitHub.

---

## [0.1.0] - 2026-10-12

### Adicionado
- **Unificação do Ciclo de Documentos DOCX:** Disponibilização das três ferramentas primárias do ciclo OpenXML tanto via servidor MCP stdio quanto via comandos de CLI:
  - `inspect_docx`: Leitura estrutural do documento;
  - `build_docx_template`: Extração de slots e geração de template;
  - `fill_docx_template`: Injeção de dados estruturados e compilação do documento final.

---

## [0.0.3] - 2026-10-11

### Adicionado
- **Identificação de Versão na CLI:** Adição das flags `-v` e `--version`.
- **Aprimoramento de Mensagens de Ajuda:** Expansão e enriquecimento das instruções de uso exibidas em `--help`.

---

## [0.0.2] - 2026-10-11

### Alterado
- **Modo Padrão MCP via Stdio:** Configuração da inicialização automática do servidor MCP stdio quando o binário é invocado sem parâmetros de linha de comando.

---

## [0.0.1] - 2026-10-11

### Adicionado
- **Commit Inicial (`2a42673`):** Fundação do motor OpenXML determinístico em Bun e TypeScript com suporte a manipulação de estruturas Word (`.docx`).
- **Estrutura Base do Servidor MCP:** Implementação inicial do protocolo Model Context Protocol (MCP) com canais de comunicação via stdio.
