# Especificação Técnica do Motor docgov-engine (v1.7.6)

Documento normativo e especificação canônica do motor standalone `docgov-engine` (`docgov-engine v1.7.6`) e servidor MCP para o ecossistema DocGov.

---

## 1. Diretrizes de Comunicação e Resiliência MCP

1. **Lei 2 Bimodal — MCP Híbrido `<= 8 KB` & Paridade Estreita CLI/MCP (v0.7.1 / v1.0.0 / v1.7.5):** Todo retorno das 16 ferramentas via `stdio` MCP (`JSON.stringify` minificado) e CLI segue contrato determinístico único (`src/config/mcp_limits.ts` + `src/utils/mcp_hybrid_output.ts`) com `engine_version`, `delivery_mode` (`"INLINE" | "POINTER" | "SUMMARY"`), `read_file_required`, `next_step_hint` e chaves de caminho legadas preservadas ao lado de `artifact_path`, `artifact_size_kb` e `artifact_lines`:
   - **Modo `INLINE` (`Buffer.byteLength(finalJson, "utf8") <= MCP_INLINE_MAX_BYTES`, default `8192 B`):** entrega 100% do Markdown principal normalizado (`\n`) em `inline_markdown` (`read_file_required: false`, `next_step_hint: "INLINE_INTEGRAL: usar inline_markdown; nao chamar read_file."`). Ferramentas idempotentes de saída única (`inspect_doc`, `fetch_juris` e dossiês `.md` das 6 tools Gen5/Gen6) disparam gravação assíncrona *write-behind* (`enqueueWrite`, erros isolados exclusivamente em `stderr`) com drenagem obrigatória via `flushPendingWrites()` no encerramento do servidor MCP e da CLI; operações *read-modify-write* (`search_juris`, `search_pncp`, `bootstrap_case`, `fetch_pncp`) executam escrita síncrona sob `withDirectoryLock`.
   - **Modo `POINTER` (`> MCP_INLINE_MAX_BYTES`):** realiza **`await` síncrono obrigatório** em disco do arquivo principal e de todos os `companionWrites` (ex.: `dossie_hotspots_*.md`, `inteiro_teor_anatomico.md`, aliases `.md` Gen6) antes de responder, omite `inline_markdown`, define `read_file_required: true` (`next_step_hint: "LER_DISCO: chamar read_file em artifact_path."`) e compacta o JSON final em `<= MCP_POINTER_MAX_BYTES` (`1024 B`, margem estrita `<= 880 B` em Gen5/Gen6 preservando `[+N_TAGS_NO_DOSSIE]`).
   - **Modo `SUMMARY` (Compiladores Binários):** `build_docx_template`, `fill_docx_template`, `generate_audit_docx` e `generate_technical_note_docx` operam com `delivery_mode: "SUMMARY"`, `read_file_required: false`, escrita síncrona e envelope `< 1 KB`. Mapas estruturais densos (`toc_map`, `outline_headings`, `page_signals`, `impugnation_zones`), índices mestres (`indice_mestre_caso.md`), relatórios de auditoria orçamentária (`auditoria_orcamentaria_*.json`), diffs documentais (`diff_documental_*.md` e `.json`), dossiês de hotspots (`dossie_hotspots_*.md`) e espelhos lineares de leitura integral (`visao_auditoria_*.md`) continuam persistidos em `state/`.
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
14. **Fiscalização Contratual, Aditivos 25%/50% sem Compensação, Batimento Quadripartite e Governança de ARP (Marco 8 — v1.5.0):** Motor de auditoria contínua de contratos administrativos e ARP com bloqueio determinístico de aditivo direto em ARP (`[ILLEGAL_ARP_ADDENDUM_BLOCK]`), vedação de compensação entre acréscimos e supressões (`[ADDENDUM_COMPENSATION_FORBIDDEN]`), limites de 25% (geral) e 50% (reforma), consensualidade em estatais (`[STATE_ENTERPRISE_UNILATERAL_ADDENDUM_BLOCK]`), batimento quadripartite contra sobrepreço (`[TRIPARTITE_OVERPRICING_DETECTED]`), interregno de 12 meses em reajustes/repactuações (`[READJUSTMENT_INTERREGNUM_VIOLATION_12M]`), e governança determinística de ARP com livro-razão (50% individual / 200% global acumulado), matriz jurídica e federativa e compilação nativa OpenXML DOCX/PDF de notas técnicas e estudos de vantajosidade via `docgov_audit_contract_execution` e `docgov_govern_arp`.
14a. **Processo Administrativo Sancionador (PAS), Glosa ANS/IMR vs. Multa, Seguro-Garantia e Cesta de Preços IN 65/2021 (Marco 8.5 — v1.5.5):** Extensão Gen 5.5 em `docgov_audit_contract_execution` com segregação matemática e jurídica entre glosa remuneratória ANS/IMR e multa punitiva (`[SLA_GLOSA_MISCLASSIFIED_AS_PENALTY_BLOCK]`), validação do piso legal de 0,5% e teto de 30% da multa (`[MULTA_BELOW_LEGAL_FLOOR_0_5PCT_OR_ABOVE_30PCT_BLOCK]`), contraditório mínimo de 15 dias úteis (`[PAS_CONTRADICTORY_15_DAYS_VIOLATION_BLOCK]`), notificação formal à seguradora em Seguro-Garantia (`[SURETY_INSURER_NOTIFICATION_REQUIRED_BLOCK]`), motor estatístico anti-outlier de cesta de preços com expurgo média +/- desvio padrão e bloqueio de média sob alta dispersão (`CV > 25%` -> `[PRICE_BASKET_HIGH_DISPERSION_USE_MEDIAN]`), auditoria de matriz de risco em álea extraordinária (`[EXTRAORDINARY_RISK_ALLOCATED_TO_CONTRACTOR_BLOCK]`) e compilação OpenXML DOCX/PDF de Notificação Prévia de PAS e Parecer de Dosimetria.
14b. **Adequação Federativa do PAS e Calibragem Jurisprudencial LINDB Art. 22 (Marco 8.6 — v1.5.6):** Extensão Gen 5.6 em `docgov_audit_contract_execution` com alcance territorial estrito do impedimento de licitar (Art. 156 § 4º Lei 14.133 -> `[PAS_SANCTION_TERRITORIAL_SCOPE_MISMATCH_BLOCK]`), regime estrito das empresas estatais (Art. 83 III e Art. 38 Lei 13.303, <= 24 meses sem declaração de inidoneidade -> `[PAS_STATE_ENTERPRISE_SANCTION_REGIME_MISMATCH_BLOCK]`), competência exclusiva e parecer jurídico conclusivo na declaração de inidoneidade (Art. 156 § 6º -> `[PAS_INCOMPETENT_AUTHORITY_FOR_DEBARMENT_BLOCK]`), resolução determinística do Tribunal de Contas competente (`TCU`, `TCDF`, `TCE-<UF>`, `TCM-SP`, `TCM-RIO`, `TCM-PA`, `TCM-BA`, `TCM-GO`) e comando obrigatório CEIS/CNEP/PNCP/TCE-TCM (`[PAS_EXTERNAL_CONTROL_REGISTRY_OMISSION_ALERT]`), calibragem jurisprudencial da dosimetria ancorada em precedentes e vetores da LINDB Art. 22 / Art. 156 § 1º (`[PAS_ARBITRARY_UNANCHORED_DOSIMETRY_ALERT]` e `[PAS_DISPROPORTIONATE_SANCTION_OUTLIER_BLOCK]`) e enriquecimento das minutas OpenXML/PDF com os Quadros de Enquadramento Jurisdicional e de Calibragem da Dosimetria.
14. **Resiliência de Caminhos MCP & Inspeção Linear MD/TXT (v1.3.1 — Lei 6):** Resolução canônica de caminhos de arquivos e pastas no servidor MCP desacoplada do CWD da IDE consumidora (`resolveWorkspacePath`), busca ascendente de workspace e priorização de localização do binário (`process.execPath`), eliminando gravação em pastas da IDE (`AppData/Local/Programs/antigravity`). Inspeção nativa linear de arquivos Markdown e Texto Puro (`.md` e `.txt`) gerando visão de auditoria e dossiê com Radar Z1..Z14, e guardrail fail-fast amigável que previne exceções crípticas de descompressão do JSZip.
15. **Blindagem de Governança, Paths Locais & Teto MCP (v1.3.2 — Leis 2, 6 e 8):** Guardrail de segurança ativa no `bootstrap_case` prevenindo inicialização acidental na raiz de repositórios Git, denylist estrita preservando todos os arquivos de governança (`AGENTS.md`, `README.md`, `CHANGELOG.md`, etc.) e código-fonte (`.ts`, `.py`, etc.), resolução de `.` e caminhos relativos locais respeitando `process.cwd()` sem desvio ascendente espúrio, e eliminação de duplicação de caminhos em `inspect_doc` garantindo payload sintético estritamente abaixo de 900 bytes.
16. **Classificador Estrutural libmagic msooxml & Descompactação Transparente (v1.3.3 — Leis 2, 4 e 6):** Identificação determinística de formatos inspirada no padrão Linux file(1) / libmagic (distinção nativa de containers ZIP para Word DOCX, Excel XLSX, PPTX e ODF vs arquivos compactados comuns), descompactação automática transparente de pacotes (.zip, .tar, .tar.gz, .tgz) em bootstrap_case com defesa Anti-Zip Slip, achatamento de subpastas, filtragem de lixo de sistema (__MACOSX, .DS_Store, Thumbs.db) e guardrail fail-fast amigável em inspect_doc orientando uso de bootstrap_case para pacotes múltiplos.
17. **Engenharia Tabular, Paridade Físico-Virtual e Template Matching (v1.3.6 — Leis 2, 3 e 4):** Fim da fusão horizontal de colunas em `loop_table_rows` (injetando tags delimitadoras fora da linha de dados, garantindo repetição estrita de linhas sem multiplicar colunas), alinhamento de coordenadas físicas (<w:tc>) vs virtuais (gridSpan) em `replace_table_cells` e `toc_map.form_fields`, auto-alinhamento de `cell_tags` quando C0 for `vMerge`, fail-fast estrito contra excesso de `cell_tags`, normalização de `vMerge` e `gridSpan` no fingerprint estrutural, ordenação de substituições bottom-up e exibição transparente de `template_match` e `form_fields` na visão de auditoria linear.
18. **Conversor Nativo de Tabelas Markdown para OpenXML `<w:tbl>`, Operador `remove_table_rows`, Scanner Anti-Contaminação e Normalização Unicode NFC (v1.3.7 — Leis 2, 3, 4 e 6):** Conversão automática de tabelas Markdown (`| Col1 | Col2 |\n| :--- | :--- |`) injetadas em variáveis de texto ou parágrafos adjacentes para elementos OpenXML `<w:tbl>` reais (com `<w:tblGrid>`, bordas corporativas `CBD5E1`, cabeçalho sombreado `F1F5F9`, alinhamentos por coluna e conformidade ECMA-376 de `<w:p/>` final em células); operador direto `remove_table_rows` em `slots_manifest.json` para poda bottom-up de linhas excedentes preservando/promovendo `<w:vMerge w:val="restart"/>`; detecção automática de subtabelas de itens numerados e grupos de checkboxes (`☒ Sim` / `☐ Não`) com coordenadas físicas na `visao_auditoria_*.md`; scanner pós-compilação (`post_compile_alerts`) detectando workarounds `"Item não aplicável"`, tabelas Markdown não convertidas, checkboxes contraditórios e contaminação de vocabulário de doador de Hardware em objetos puros de Software/Serviços (sem falsos-positivos em contratações mistas de Hardware+Software); e normalização universal Unicode `NFC` com resolução resiliente `NFC/NFD` no filesystem.
19. **Guardrail de Escopo DocGov com %TEMP% Efêmero, Redirecionamento C1->C2, Heading Guard e Detector de Órfãos (v1.3.8 — Leis 2, 3, 4, 6 e 8):** Guardrail canônico de governança bloqueando fail-fast as 6 ferramentas de processo (bootstrap, build, fill, audit, note, fetch) fora de árvores DocGov; isolamento de inspect_doc e search_pncp em subpasta efêmera de %TEMP% para exploração sem poluição do usuário; anotações semânticas em inspect_doc direcionando checkboxes curtos C_k para coordenadas vizinhas C_{k+1}; auto-redirecionamento geométrico em dois tempos (marcando ☒ Sim. em C_k e injetando tag/texto longo em C_{k+1}); preservação de cabeçalhos de seção via Heading Guard em replace_paragraphs quando start_p aponta para títulos de seção (preservando start_p e aplicando a partir de start_p + 1); saneamento de <w:numPr> herdado, descarte de linhas vazias e espaçamento vertical pós-parágrafo <w:spacing w:after="120"/> na expansão multilinha; sequenciamento contínuo em listas numéricas decimais simples (1. -> 2. -> 3.) no mesmo numId sem duplicações; e scanner pós-compilação detectando contaminação parcial de unidades físicas em linhas de software (PARTIAL_ITEM_ROW_CONTAMINATION) e linhas de total não recalculadas ou zeradas (UNCALCULATED_TOTAL_ROW).
20. **Reancoragem Contextual Multinível, Injeção Literal e Scanner de Anomalias (v1.3.9 — Leis 2, 3, 4 e 8):** Rastreamento de prefixo de seção pai (`activeSectionPrefix`) no `<w:body>` resolvendo títulos fixos literais ou via `numbering.xml`; reancoragem automática de itens multinível relativos (1.1, 1.2, 1.1.1) gerados pelo LLM sob seções 4.4, 5.1, 5.2, 6, etc.; prevenção de colisão com subseções irmãs existentes no template (ex.: introdução da Seção 2 convertendo itens conflitantes em Bullet '• ' estilizado com hanging indent); injeção literal determinística de cláusulas multi-decimais com `<w:tab/>` e `<w:spacing w:after="120"/>` sem nós `<w:numPr>` órfãos (eliminando o reset indesejado do Word para 1.1/1.1.1); listas simples mantidas no numbering nativo com sequenciamento estrito; e dois novos scanners pós-compilação: `MULTILEVEL_NUMBERING_RESET` (alertando sobre itens 1.1 sob seções >= 2) e `DUPLICATE_CONFLICTING_SLA_TABLES` (alertando sobre tabelas distintas de SLA de chamados com prazos divergentes para Severidade 1 herdadas do modelo doador).
21. **Modularidade Estrita, Decomposição em Submódulos e Economia de Tokens (v1.3.10 — Lei 9):** Decomposição estrutural pura dos monólitos do motor em submódulos coesos em subdiretórios de domínio (`src/tools/openxml/` e `src/tools/inspect/`) com teto físico estrito de 500 linhas por arquivo, preservação total de assinaturas e re-exports públicos com zero alteração funcional, e protocolo de leitura e testes cirúrgicos de baixo consumo de tokens.
22. **Herança Nativa de <w:numPr>, Fim do Bug de Pré-Varredura e Scanner Top-Down (v1.3.11 — Leis 2, 3, 4, 8 e 9):** Herança prioritária de <w:numPr> (numId e ilvl) da árvore nativa de numeração do template doador (preservando o sequenciamento contínuo das 19 seções do Word e impedindo reset espúrio para 1.), separação estrita do preScanResolver (Passada 1) prevenindo mutação indevida de contadores na compilação, contador top-down monotônico estrito por parágrafo-slot ('sectionChildCounters'), scanner de integridade pós-compilação detectando inconsistência de prefixo de seção ('SECTION_PREFIX_MISMATCH') e números duplicados de cláusula, e refinamento de 'UNCALCULATED_TOTAL_ROW' para aceitar preços unitários referenciais com total zerado sob orçamento sigiloso (RILC Art. 19).
23. **Motor Determinístico de Jurisprudência, Statutory Bridge e Fatiamento Anatômico (Marco 7 — v1.4.0):** 9ª e 10ª ferramentas MCP ('search_juris' e 'fetch_juris') e flags CLI ('--search-juris', '--fetch-juris'), matriz de equivalência normativa (Lei 13.303/2016 + RILC <-> Lei 14.133/2021 com 10 eixos normativos estruturados SB-01 a SB-10), motor de ranking de relevância determinístico (0..100 pts) com alinhamento tático DEFENSE/ATTACK, roteador de jurisdição modular com conectores para TCU, STJ, STF, TST, TCE-PA, TCE-CE e TCDF com degradação graciosa (graceful fallback) para UFs não implementadas, fatiamento anatômico em 6 Macro-Partes / 10 Sub-Camadas com trava anti-alucinação '[ANTI_HALLUCINATION_BLOCK]', compilador tático OpenXML para Notas de Contrarrazões e Peças de Impugnação em layout vertical A4 (zero tabelas), suporte unificado a 'DOCGOV_JURIS_BASE_URL' e payloads sintéticos estritamente abaixo de 900 bytes.
24. **Arquitetura Plug-and-Play de Provedores de Jurisprudência e Seletor --court (Patch v1.4.1 — Leis 2, 4, 8 e 9):** Desacoplamento 100% plug-and-play do JurisdictionProviderRegistry sem listas estáticas, autodescoberta dinâmica de UFs suportadas e cortes federais de fallback a partir de metadados declarativos na interface JurisdictionProvider, seletor isolado --court=<ID> em scripts/run_live_tests.ts e tests_live/juris_api.live.ts para testes de contrato por tribunal, correção do endpoint de busca do STF (POST /api/search/search eliminando HTTP 404), desestruturação de query nos provedores TCE-PA, TCE-CE e TCDF eliminando [object Object] e resiliência de cliente HTTP com alias body em JurisHttpResponse.
25. **Conector Nativo TST, Calibragem Tática do RelevanceScorer e Filtro STF (Patch v1.4.2 — Leis 2, 4, 8 e 9):** Novo conector federal isolado TstProvider (--court=TST) cobrindo terceirização na Administração Pública (Súmula 331 do TST, Tema 246 e Tema 1118) com ativação automática por palavras-chave semânticas (autoTriggerKeywords) e resolução direta por número CNJ no fetch_juris sem depender de cache; calibragem tática do RelevanceScorer com precedência de desfecho da Camada 5A, penalidade de inversão tática (-15 pts) para decisões adversas em postura DEFENSE e badge visual de distinguishing; e filtro anti-ruído tributário no StfProvider excluindo matérias fiscais e penais em consultas administrativas.
26. **Conector Federal AGU / CGU com Resiliência Dupla (Patch v1.4.3 — Leis 2, 4, 8 e 9):** Novo conector normativo e consultivo federal AguProvider (--court=AGU) cobrindo Orientações Normativas da Advocacia-Geral da União (ONs da AGU nº 01 a 107+), Súmulas da AGU (Súmula nº 01 a 87+) e Pareceres Referenciais da CNLCA/CGU sobre vigência, prorrogação contratual em serviços contínuos, limites de aditivos, dispensa de licitação e vedações a pagamento antecipado sob a Nova Lei de Licitações (Lei nº 14.133/2021); arquitetura de Resiliência Dupla com parsing ao vivo do portal oficial (gov.br/agu) e catálogo curado de alto valor embutido (agu_catalog.ts); acionamento contextual automático (autoTriggerKeywords) por termos como "orientacao normativa", "parecer referencial", "cnlca", "sumula agu"; fatiamento anatômico em 6 Macro-Partes / 10 Sub-Camadas com precedência normativa vinculante na Camada 5A (Dispositivo) e eficácia vinculante federal.
27. **Conector Estadual TCE-SP com Resiliência Dupla (Patch v1.4.4 — Leis 2, 4, 8 e 9):** Novo conector estadual isolado TceSpProvider (--court=TCE-SP, uf: "SP") cobrindo o Repertório Oficial de Súmulas do Tribunal de Contas do Estado de São Paulo (Súmulas nº 1 a 52) com foco nas súmulas de licitações, compras públicas e contratos (Súmula 14 — declaração de disponibilidade vs propriedade prévia; Súmula 15 — vedação a compromisso de terceiro alheio à disputa/carta de fabricante; Súmula 20 — somatório de atestados; Súmula 21 — indicação de marcas e padronização; Súmula 22 — taxa de edital; Súmula 24 — qualificação técnica operacional limitada a 50%; Súmula 25 — vínculo de responsável técnico; Súmula 27 — visita técnica prévia; Súmula 30 — atestados genéricos; Súmula 33 — vedação a carona em ARP; Súmula 44 — inexequibilidade e contraditório; Súmula 50 — recuperação judicial; Súmula 51 — alcance territorial da sanção de inidoneidade vs impedimento); busca live no portal oficial (tce.sp.gov.br/jurisprudencia/pesquisar) combinada com catálogo curado determinístico (tce_sp_catalog.ts); acionamento contextual por palavras-chave (autoTriggerKeywords) com higiene estrita anti-falso-positivo; compatibilidade com o modo mock (DOCGOV_JURIS_TCESP_URL, Sub-Assert 29.9 da suíte .NET); fatiamento anatômico nas 6 Macro-Partes / 10 Sub-Camadas e trava anti-alucinação estrita ([ANTI_HALLUCINATION_BLOCK]).
28. **Conector Estadual TCE-MG com Resiliência Dupla (Patch v1.4.5 — Leis 2, 4, 8 e 9):** Novo conector estadual isolado TceMgProvider (--court=TCE-MG, uf: "MG") cobrindo o Repertório Oficial de Súmulas e Consultas Normativas do Tribunal de Contas do Estado de Minas Gerais com força normativa e eficácia vinculante conforme art. 76 da LC Estadual nº 102/2008 (Súmula 114 — obrigatoriedade de parcelamento do objeto divisível; Súmula 126 — manutenção de frota, quarteirização e vedação a credenciamento prévio; Súmula 88 — dever de licitar e fracionamento de despesa; Súmula 79 — formalismo moderado na homologação; Consulta 1.160.667 — adesão carona a atas sob leis pretéritas na vigência da Lei 14.133/2021; Consulta 1.177.447 — ilegalidade de cobrança de taxa de carona por gerenciador ou consórcio público; Consulta 1.119.769 — consórcio público e adesão posterior de não consorciados; Consulta 1.148.573 — habilitação econômico-financeira e proporcionalidade de índices contábeis; Consulta 1.092.348 — qualificação técnica operacional limitada a 50% e vedação a vínculo prévio; Consulta 1.077.234 — desdobramento federativo de sanções de impedimento vs inidoneidade; Consulta 1.007.492 — serviços de TIC com medição por resultados, SLA e vedação a homem-hora puro); busca live no portal TCJuris (tcjuris.tce.mg.gov.br) combinada com catálogo curado determinístico (tce_mg_catalog.ts); acionamento contextual por palavras-chave (autoTriggerKeywords) com higiene estrita anti-falso-positivo; compatibilidade com modo mock (DOCGOV_JURIS_TCEMG_URL, Assert 29.10 da suíte .NET); fatiamento anatômico nas 6 Macro-Partes / 10 Sub-Camadas e trava anti-alucinação estrita ([ANTI_HALLUCINATION_BLOCK]).
29. **Conector Estadual TCE-PR com Resiliência Dupla (Patch v1.4.6 — Leis 2, 4, 8 e 9):** Novo conector estadual isolado TcePrProvider (--court=TCE-PR, uf: "PR") cobrindo o Repertório de Prejulgados Vinculantes, Súmulas e Consultas com Força Normativa do Tribunal de Contas do Estado do Paraná conforme LC Estadual nº 113/2005 (Prejulgado 28 — parcelamento de TIC, lote único e indivisibilidade de software; Prejulgado 25 — limites de qualificação econômico-financeira e vedação a cumulação de capital social com patrimônio líquido; Prejulgado 06 — limites de terceirização e fiscalização trabalhista; Prejulgado 26 — inexigibilidade de serviços jurídicos e contábeis; Prejulgado 11 — excepcionalidade de pagamento antecipado e garantias; Súmula 05 — vedação a taxa negativa/zero em frotas e vales; Súmula 08 — regularidade fiscal/trabalhista restrita à habilitação; Consulta 2804/2024 — formalismo moderado e saneamento de certidões sob a Lei 14.133/2021; Consulta 3154/2023 — carona em ARP 50%/200% sob a Nova Lei); busca live no portal ViaJuris (viajuris.tce.pr.gov.br) combinada com catálogo curado determinístico (tce_pr_catalog.ts); acionamento contextual por palavras-chave (autoTriggerKeywords) com higiene estrita anti-falso-positivo; compatibilidade com modo mock (DOCGOV_JURIS_TCE_PR_URL, Sub-Assert 29.11 da suíte .NET); fatiamento anatômico nas 6 Macro-Partes / 10 Sub-Camadas e trava anti-alucinação estrita ([ANTI_HALLUCINATION_BLOCK]).
30. **Orçamento Estrito de Tokens no Handshake MCP `tools/list` (Eixo 5 — v1.6.10 — Leis 2, 4 e 9):** Padronização de descrições enxutas (`<= 600` caracteres / ~150 tokens por ferramenta) em `getMcpToolsDefinition()` (`src/mcp/tools_definition.ts`, `src/demo_costs/audit_runner.ts` e `src/engineering/tool_definition.ts`), reduzindo a soma das `description`s em `-63,3%` (`20.793 -> 7.631` chars) e o payload total `tools/list` em `-29,0%` (`45.432 -> 32.256` chars, economia de ~3.294 tokens por handshake) com zero breaking changes em nomes, parâmetros ou `inputSchema`, delegando contratos JSON exaustivos ao `--dump-spec` (`docs/especificacao_motor.md`) sob guarda de teste determinístico anti-regressão em `test/mcp_spec.test.ts`.
31. **2ª Perna Anti-Fraude — Pilares 1 e 5, Hotfix PAdES Gov.br & Resiliência JURIS Unificada (Marco 10.1 — v1.7.0 / v1.7.1 — Leis 2, 3 e 9):** Perícia criptográfica Pure-JS `ASN.1/DER/BER` sobre assinaturas PDF `PKCS#7/CMS/PAdES` com reconhecimento da hierarquia oficial `Gov.br` (`AC Final/Intermediária/Raiz do Governo Federal do Brasil`), caminhamento encadeado real X.509 (`current.issuerDn === parent.subjectDn` contra certificados desconectados no `SET`) e auditoria matemática `/ByteRange` (`src/utils/pdf/asn1_der_parser.ts` e `src/utils/pdf/pades_signature_auditor.ts`), validador algorítmico Módulo 11 de chaves NF-e de 44 dígitos (`src/utils/forensics/nfe_key_validator.ts`), detector de clones `w:rsidRoot` / `w:rsidR` em `.docx` mesmo com `Author` lavado (`src/utils/pdf/docx_forensic_meta.ts` e `forensic_cross_audit.ts`), extração de `forensic_meta` para planilhas `.xlsx` (`src/utils/pdf/xlsx_forensic_meta.ts`), guarda determinística de `unknown_keys` na Gen6 (`src/utils/forensics/gen6_contract_guard.ts`) e superclasse única `BaseJurisdictionProvider` com transparência cognitiva (`live_degraded`, `source`) e `force_live` nos 12 conectores JURIS, preservando integralmente as 16 tools (`<= 600` chars) e envelopes MCP conformes à Lei 2.
32. **Otimização MCP Híbrido `8 KB`, Lei 2 Bimodal & Paridade Estreita CLI/MCP (`v1.7.5` — Trilha A+):** Centralização dos limites bimodais (`src/config/mcp_limits.ts`: `MCP_INLINE_MAX_BYTES = 8192` via env, `MCP_POINTER_MAX_BYTES = 1024`, margem de estresse `<= 880B`) e do construtor único (`src/utils/mcp_hybrid_output.ts`: `buildHybridMcpEnvelope` com `companionWrites` + `buildSummaryMcpEnvelope`), JSON minificado em 100% das respostas MCP (`src/mcp/server.ts`) e CLI (`src/cli/*.ts`), drenagem garantida de `flushPendingWrites()` em graceful shutdown MCP (`stdin` close/`SIGTERM`/`SIGINT`) e término CLI (`src/index.ts`), além de ajuste do orçamento de tags (`fitBlockingTagsToBudget(..., 880)`) sobre o JSON final já acrescido dos campos bimodais.
33. **Corte Limpo Global JURIS, Cache TTL 24h Universal & Desarme de Vieses (`v1.7.6` — Trilha B Etapa A):** Promoção de `juris_ttl_cache.ts` para todas as 12 cortes (`<DOCGOV_JURIS_CACHE_DIR|%TEMP%/docgov_juris_cache>/<court_lower>/`) via `fs_safe_io.ts`, ciclo global Live-First -> Grava TTL 24h -> `CACHE_TTL_FALLBACK` (`cache_hit: true`) -> `LIVE_FAILED` ativo em produção e Mock Server, expurgo de `catalog_helper.ts` e dos catálogos estáticos congelados, remoção integral de `autoTriggerKeywords` (dispatcher e providers), remoção da mutação ES no `stf_provider.ts`, remoção de fabricação de corpo/ano/entidade e hardcodes `Art. 40` / `"Por Maioria"` no `anatomical_slicer.ts`, e extração de `precedent_triage_core.ts` mantendo `tst_precedent_triage.ts < 260L`.

---

## 2. Ferramentas MCP Nativas (16 Tools)

### 2.1. bootstrap_case
Inicializa a governança de pastas do caso (`inputs/`, `state/`, `templates/`, `output/`, `assets/`), descompacta e ingere automaticamente arquivos compactados (`.zip`, `.tar`, `.tar.gz`, `.tgz`) presentes em `uploadsDir`, na raiz do caso ou em `inputs/` (com classificação `libmagic msooxml`, defesa Anti-Zip Slip e achatamento de pastas), preserva nomes legíveis, move e deduplica automaticamente documentos soltos na raiz para `inputs/` (preservando `context.json`), infere extensões por magic bytes (`PK\x03\x04` para .docx e `%PDF` para .pdf), aceita `fileRenameMap` opcional, realiza auto-batismo de uploads anônimos (`media_*` -> `<TIPO>_<ORGAO>_<hash4>.<ext>`), detecta páginas escaneadas e híbridas (`scanned_pages_detected`, `hybrid_scan_pages` via `unpdf@2.1+` `inspectPages`), materializa imagens visuais elegíveis em `assets/<stem>/pag_XXX_img_YY.png`, extrai metadados forenses tri-formato PDF/DOCX/XLSX (`forensic_meta`, incluindo `pades_signatures`, `rsid_root` e `rsid_sample`) e consolida o inventário cruzado em `state/indice_mestre_caso.md` (com detecção de conluio `[BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT]`, `[PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK]` e `[FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK]`), além de gravar `state/estrutura_<stem>.json`, `state/visao_auditoria_<stem>.md`, `state/dossie_hotspots_<stem>.md` e `state/auditoria_orcamentaria_<stem>.json`. Retorna envelope JSON bimodal (`INLINE <= 8192 B` com `inline_markdown` integral ou `POINTER <= 1024 B` com `read_file_required: true`) contendo `master_index_path`, `artifact_path`, `unpacked_archives_count` e `extracted_files_count`.

### 2.2. inspect_doc
Engenharia reversa estrutural completa de documentos individuais Word (`.docx`), PDF (`.pdf`), planilhas (`.xlsx`, `.csv`) e textos/markdown (`.md`, `.txt`) recebendo como parâmetro principal `filePath` (com suporte ao alias `docxPath`) e parâmetro opcional `compareWithPath` para diff documental multi-versão, com guardrail fail-fast amigável que rejeita pacotes compactados (`.zip`, `.tar`, etc.) orientando o uso de `bootstrap_case`. Em PDFs, executa agrupamento por eixo Y com separação de colunas por ` | `, classificação em 5 classes via `inspectPages` (`BORN_DIGITAL`, `FULL_PAGE_SCAN`, `HYBRID_HEADER_SCAN_TRAP`, `EMBEDDED_VISUAL_ASSET`, `OCR_LAYER_EMBEDDED`), materialização multimodal filtrada em `assets/<stem>/pag_XXX_img_YY.png` (ou `%TEMP%/docgov_ephemeral_inspect/assets/<stem>/` fora de caso) com âncoras `[PAG_XXX | ASSET_IMG_YY | tipo=... | coverage=NN% | WxHpx | path="..."]`, perícia criptográfica `PKCS#7/CMS/PAdES` e `/ByteRange` (`pades_signatures`, `[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]`, `[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]`) e metadados forenses PDF/DOCX/XLSX (`forensic_meta`, `rsid_root`/`rsid_sample` em `.docx`, `docProps` em `.xlsx` e rastros `Canva/iLovePDF/Sejda` -> `[PDF_EDITOR_MANIPULATION_TRACE]`). Constrói no topo do JSON o índice estrutural rápido (`toc_map`), a Cartografia Estrutural em 3 camadas (`outline_headings`, `page_signals` e `impugnation_zones` Z1..Z14), calcula `structure_fingerprint`, realiza busca 1-para-N no cache global (`core/registry/templates/`) e devolve no MCP/CLI envelope bimodal (`INLINE <= 8192 B` com `inline_markdown` e *write-behind* em `enqueueWrite`, ou `POINTER <= 1024 B` com `await` síncrono inclusive em `dossie_hotspots`) com `toc_summary`, `assets_extracted_count`, `hybrid_scan_pages_count`, `artifact_path`, `dossie_hotspots_path`, `budget_audit` e `diff_summary`.

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
  "remove_table_rows": [
    { "table_index": 0, "from_row": 27, "to_row": 44 }
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
- **Motor Híbrido de Lista Multinível Nativa (v0.7.0) & Parent Section Prefix Resolver (v1.3.9):**
  - Reancora automaticamente itens multinível pelo prefixo da seção ativa (`4.4.1.`, `5.1.1.`, `6.1.`) e previne colisão com subseções irmãs (convertendo para Bullet '• ').
  - Cláusulas multi-decimais utilizam injeção literal determinística com `<w:tab/>`, Hanging Indent (`<w:ind w:left w:hanging>`) e `<w:spacing w:after="120"/>` sem nós `<w:numPr>` órfãos, eliminando resets indesejados para 1.1/1.1.1 do Word.
  - Listas decimais simples de 1 nível fora de tabelas continuam utilizando `word/numbering.xml` com sequenciamento estrito.
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

### 2.7. fetch_pncp
Busca e ingere de forma determinística os metadados e todos os arquivos públicos de uma contratação de referência no Portal Nacional de Contratações Públicas (PNCP), com isolamento estrito na subpasta `inputs/pncp_<shortname>/`, descompactação in-place transparente (`.zip`, `.tar`, `.tar.gz`) via libmagic e catalogação leve para benchmarking técnico e pesquisa de mercado (IN SEGES/ME nº 65/2021).
- **Isolamento Físico Estrito:** Todos os arquivos externos baixados e seus membros extraídos residem exclusivamente em `inputs/pncp_<shortname>/`, sem nunca se misturarem com os documentos originais do usuário na raiz de `inputs/`.
- **Catalogação de Referência sem Auditoria:** Realiza extração estrutural leve de tópicos/seções em memória sem poluir `state/` com dossiês de auditoria ou Radar das 14 Zonas, gerando exclusivamente `state/pncp_<shortname>_meta.json` e `state/indice_pncp_<shortname>.md`.
- **Parsing Universal de Identificadores (3 Formatos + Redirects):** Suporta número de controle em edital (`00394460000141-1-000015/2026`), URLs do portal/API web, tupla simplificada (`00394460000141/2026/15`) e resolução nativa de URLs de redirecionamento do Google Grounding (`vertexaisearch.cloud.google.com/grounding-api-redirect/...`).
- **Validação Fail-Fast e Exact Copy-Paste Error:** Identificadores inválidos interrompem a execução imediatamente com mensagem canônica pronta para copiar e colar.
- **Retorno Sintético MCP (< 1 KB, margem < 900 bytes):** Devolve `status`, `engine_version`, `pncp_ref`, `target_dir`, `meta_path`, `index_path`, `files_downloaded`, `unpacked_archives_count`, `extracted_files_count`, `inspected_count` e `next_step_hint`.
- **Exemplo Canônico de Chamada para `fetch_pncp`:**
```json
{
  "caseDir": "cases/meu_caso_referencia",
  "pncpIdOrUrl": "00394460000141-1-000015/2026",
  "shortname": "orgao_referencia"
}
```

### 2.8. search_pncp
Realiza busca textual multi-query no endpoint oficial `/api/search/` do Portal Nacional de Contratações Públicas (PNCP) para descoberta de editais, termos de referência e contratações públicas de referência para benchmarking técnico e pesquisa de mercado (IN SEGES/ME nº 65/2021).
- **Multi-Query em Paralelo:** Permite fornecer termos múltiplos separados por pipe `|` (ex.: `"fábrica de software | sustentação de sistemas"`), executando as consultas simultaneamente via `Promise.all`.
- **Desduplicação Automática e Acumulação no Caso:** Normaliza e desduplica candidatos por `CNPJ/ANO/SEQUENCIAL` (`pncp_id`), acumulando os resultados em `cases/<slug>/state/pncp_search_results.json` e `state/pncp_search_results.md` sem perder buscas anteriores da mesma sessão.
- **Tabela Markdown com Objeto Integral:** O artefato `state/pncp_search_results.md` preserva o objeto completo de cada contratação sem truncamento, permitindo avaliação precisa de aderência sem estourar o contexto da LLM.
- **Suporte a URLs de Redirecionamento:** Aceita links de busca opacos do Google Grounding (`vertexaisearch.cloud.google.com/grounding-api-redirect/...`), resolvendo-os para inclusão imediata como candidato estruturado.
- **Retorno Sintético MCP (< 1 KB, margem < 900 bytes):** Devolve `status`, `engine_version`, `queries_executed`, `results_count`, `total_accumulated`, `results_md_path`, `results_json_path`, `top_candidates` e `next_step_hint`.
- **Exemplo Canônico de Chamada para `search_pncp`:**
```json
{
  "caseDir": "cases/meu_caso_referencia",
  "query": "fábrica de software | sustentação de sistemas",
  "status": "todas",
  "uf": "DF",
  "modalidade": "Pregão",
  "limit": 10
}
```

### 2.9. search_juris
Realiza busca multi-query sob demanda de jurisprudência em cortes de contas e superiores (TCU, STJ, STF, TST, AGU/CGU, TCE-PA, TCM-PA, TCE-CE, TCDF, TCE-SP, TCE-MG, TCE-PR) com acumulação concorrente protegida por mutex + lockfile (`juris_search.lock`, stale timeout 5s) + escrita atômica em `state/juris_search_results.json` e `.md`.
- **Acumulação & Desduplicação (`v1.7.3`):** Mescla buscas sequenciais/paralelas pela chave `${court}-${id}` preservando o maior `relevance_score`, acumulando `matched_queries[]`, `queries_executed[]` e `queries_history[]` sem truncar `results[]`, mantendo `query`, `total_hits`, `court_diagnostics` e `tst_triage` no topo estritamente da rodada atual e expondo `total_accumulated`.
- **Neutralidade Estrita & Rebalanceamento `0..100` (`v1.7.3`):** Defaults `stance: "NEUTRAL"` e `regime: "AUTO"`. Em consultas livres sem contexto licitatório (`NEUTRAL`/`AUTO`), redistribui os pontos entre `lexical (0..65)`, `quorum (0..20)` e `recency (0..15)` (zero penalidade `-15`, zero viés licitatório e `outcome` judicial neutro). `Statutory Bridge` (`SB-01..SB-10`) só expande quando houver evidência temática na query, e `isStateItEntity()` valida word-boundary estrito exclusivamente sobre o campo estruturado `entidade`.
- **Cache Dinâmico Live-Backed TTL 24h no TST (`v1.7.3`):** O conector `TST` não utiliza texto normativo estático congelado e não injeta termos administrativos na query. Opera ao vivo para `SUM`, `OJ` e `ACORDAO` com cache persistente TTL de 1 dia (`86_400_000 ms`) em `os.tmpdir()/docgov_juris_cache/tst` ou sob `DOCGOV_JURIS_CACHE_DIR` (inclusive quando `DOCGOV_JURIS_CACHE_DIR` estiver definido em Mock Mode), formato mínimo `{ fetched_at, ttl_ms, key, payload }`. Sem cache válido `< 24h`, falhas HTTP retornam `LIVE_FAILED` / `total_hits: 0` sem fallback congelado. Demais 11 conectores preservam integralmente `BaseJurisdictionProvider`.
- **Triagem A/B Exclusiva do Conector TST (`triage_mode` / `--triage-mode`):** Aceita `"triaged"` (padrão TST), `"raw"` ou `"compare"`, classificando em 4 baldes (`erga_omnes`, `orientativas` incluindo `SUMULA-TST-*` / `OJ-TST-*`, `inter_partes` e `unclassified`) com calibragem de pertinência para queries livres de 3+ termos.
- **Retorno Bimodal MCP/CLI (`INLINE <= 8192 B` / `POINTER <= 1024 B`):** Devolve `status`, `engine_version`, `delivery_mode`, `read_file_required`, `artifact_path`, `artifact_size_kb`, `artifact_lines`, `inline_markdown` (somente em `INLINE`), `queries_executed`, `stance`, `regime`, `total_hits` (rodada atual), `total_accumulated`, `statutory_bridge_applied`, `jurisdiction_routing`, `live_degraded` (quando aplicável), `top_hits` (rodada atual), `tst_triage` (rodada atual), `results_md` e `next_step_hint`.
- **Exemplo Canônico de Chamada para `search_juris`:**
```json
{
  "query": "lote único indivisibilidade software | adjudicação por preço global TI",
  "caseDir": "cases/meu_caso",
  "courts": ["TCU", "TCE-PA"],
  "uf": "PA",
  "stance": "DEFENSE",
  "regime": "13303",
  "limit": 10
}
```

### 2.10. fetch_juris
Verificador de autenticidade anti-alucinação e fatiador anatômico de acórdãos em 6 Macro-Partes / 10 Sub-Camadas semânticas (Cabeçalho, Ementa, Relatório, Fundamentação/Voto, Dispositivo e Fecho com Quórum).
- **Trava Anti-Alucinação Estrita, Neutralidade & Cache TTL 24h TST (`v1.7.3`):** Valida existência real na fonte oficial ou mock server (`[ANTI_HALLUCINATION_BLOCK]` em HTTP 404). No `TST`, resolve `SUMULA-TST-*`, `OJ-TST-*` e acórdãos ao vivo com cache TTL 24h (`DOCGOV_JURIS_CACHE_DIR`, `{ fetched_at, ttl_ms }`), lançando `[LIVE_UNAVAILABLE]` em falha sem cache válido `< 24h`. Classifica `regime_detected` em `"LEI_13303_ESTATAIS" | "LEI_14133_ADM_DIRETA" | "NAO_APLICAVEL" | "NAO_IDENTIFICADO"`.
- **Migração para `state/`, Ordenação `1 -> 6` e Corte Limpo:** Grava exclusivamente o Dossiê Fatiado em `state/dossie_juris_<shortname>.md` e o Inteiro Teor Estruturado em `state/juris_<shortname>/inteiro_teor_anatomico.md` (sem criar pastas em `inputs/`), em ordem sequencial `1 -> 2 -> 3 -> 4 -> 5 -> 6`, com `truncateCleanBoundary` em fronteira limpa, contagem de caracteres truncados e links Markdown diretos para `juris_<shortname>/inteiro_teor_anatomico.md`.
- **Retorno Bimodal MCP/CLI (`INLINE <= 8192 B` com `write-behind` / `POINTER <= 1024 B` com `await` síncrono inclusive em `inteiro_teor_anatomico.md`):** Devolve `status`, `engine_version`, `delivery_mode`, `read_file_required`, `artifact_path`, `artifact_size_kb`, `artifact_lines`, `inline_markdown` (somente em `INLINE`), `verified_authentic`, `source`, `canonical_id`, `court`, `colegiado`, `relator`, `regime_detected`, `outcome`, `layers_extracted`, `topics_matched`, `dossie_sliced_md`, `inteiro_teor_full_md` e `next_step_hint`.
- **Exemplo Canônico de Chamada para `fetch_juris`:**
```json
{
  "acordaoIdOrUrl": "Acórdão 1234/2024-TCU-Plenário",
  "caseDir": "cases/meu_caso",
  "shortname": "acordao_1234_2024",
  "topicFilter": "parcelamento | lote único",
  "stance": "DEFENSE"
}
```

### 2.11. docgov_audit_contract_execution (CLI: audit-contract)
Auditoria determinística e fiscalização contínua de contratos administrativos, termos aditivos, processo administrativo sancionador (PAS), adequação federativa, dosimetria LINDB Art. 22, glosa ANS/IMR, garantias e pesquisa de preços (Gen5 Marco 8, Gen5.5 Marco 8.5 & Gen5.6 Marco 8.6).
- **Parâmetros MCP / CLI:** `contractJsonPath` (ou `--file`), `caseDir`, `outputDir`, `auditType` (`"FULL"` | `"ADDENDUM_LIMITS"` | `"TRIPARTITE_MATCH"` | `"READJUSTMENT"` | `"PAS_SANCTIONS"` | `"PRICE_BASKET"`), `compilationMode` (`"NONE"` | `"PAS_NOTIFICATION"` | `"SANCTION_DOSIMETRY_OPINION"` | `"DOSIMETRY_OPINION"` | `"BOTH"`), `outputFormat` (`"docx"` | `"pdf"` | `"both"`).
- **Limites Rígidos de Aditamento:** Validação de 25% (compras, serviços e obras em geral) e 50% (reforma de edifícios e equipamentos) calculados isoladamente sobre o valor inicial atualizado (Art. 125 Lei 14.133 / Art. 81 Lei 13.303).
- **Vedação de Compensação:** Proibição de compensar supressões com acréscimos para mascarar estouro de limite (`[ADDENDUM_COMPENSATION_FORBIDDEN]`).
- **Bloqueio de Aditivo em ARP:** Bloqueio determinístico imediato se o instrumento alvo de aditamento for uma ARP (`[ILLEGAL_ARP_ADDENDUM_BLOCK]`).
- **Consensualidade em Estatais:** Bloqueio de aditivo unilateral na Lei 13.303/2016 (`[STATE_ENTERPRISE_UNILATERAL_ADDENDUM_BLOCK]`).
- **Batimento Quadripartite:** Cruzamento TR <-> Proposta <-> ARP <-> Contrato/Fatura contra sobrepreço unitário ou quantitativo (`[TRIPARTITE_OVERPRICING_DETECTED]`).
- **Reajuste e Repactuação:** Validação do interregno de 12 meses e exigência de CCT em mão de obra (`[READJUSTMENT_INTERREGNUM_VIOLATION_12M]`).
- **PAS, Glosa ANS/IMR vs. Multa e Seguro-Garantia (Marco 8.5):** Segregação entre ajuste remuneratório ANS/IMR e multa sancionatória (`[SLA_GLOSA_MISCLASSIFIED_AS_PENALTY_BLOCK]`), piso/teto legal de 0,5% a 30% (`[MULTA_BELOW_LEGAL_FLOOR_0_5PCT_OR_ABOVE_30PCT_BLOCK]`), dosimetria graduada (`ADVERTENCIA`, `MULTA`, `IMPEDIMENTO_LICITAR_CONTRATAR`, `DECLARACAO_INIDONEIDADE`), prazo mínimo de 15 dias úteis para contraditório (`[PAS_CONTRADICTORY_15_DAYS_VIOLATION_BLOCK]`) e notificação formal à seguradora em Seguro-Garantia (`[SURETY_INSURER_NOTIFICATION_REQUIRED_BLOCK]`).
- **Adequação Federativa do PAS & Dosimetria LINDB Art. 22 (Marco 8.6):** Alcance territorial estrito do impedimento (`[PAS_SANCTION_TERRITORIAL_SCOPE_MISMATCH_BLOCK]`), regime sancionatório estrito das Estatais <= 24m sem inidoneidade (`[PAS_STATE_ENTERPRISE_SANCTION_REGIME_MISMATCH_BLOCK]`), competência exclusiva e parecer conclusivo para inidoneidade (`[PAS_INCOMPETENT_AUTHORITY_FOR_DEBARMENT_BLOCK]`), resolução determinística do Tribunal de Contas competente (`competent_audit_court`: `TCU`/`TCDF`/`TCE-<UF>`/`TCM-<UF>`) e remessa obrigatória CEIS/CNEP/PNCP (`[PAS_EXTERNAL_CONTROL_REGISTRY_OMISSION_ALERT]`), além de ancoragem jurisprudencial da dosimetria (`[PAS_ARBITRARY_UNANCHORED_DOSIMETRY_ALERT]`) e bloqueio de outliers desproporcionais sem agravantes comprovadas (`[PAS_DISPROPORTIONATE_SANCTION_OUTLIER_BLOCK]`).
- **Cesta de Preços IN 65/2021 e Álea Extraordinária (Marco 8.5):** Cálculo determinístico de média aritmética, mediana, desvio padrão, coeficiente de variação (CV%), limites de expurgo e média saneada, bloqueando média simples sob alta dispersão (`CV > 25%` -> `[PRICE_BASKET_HIGH_DISPERSION_USE_MEDIAN]`), além de validação de matriz de risco em reequilíbrios (`[EXTRAORDINARY_RISK_ALLOCATED_TO_CONTRACTOR_BLOCK]`).
- **Schema de Entrada JSON (Objetos Aninhados + Aliases Naturais / Flat):**
  - *Raiz:* `contract_id`, `legal_regime` (`"LEI_14133"` | `"LEI_13303"`), `object_type` (`"SERVICE"` | `"WORK"` | `"ENGINEERING_REFORM"` | `"SUPPLY"`), `target_instrument` (`"CONTRACT"` | `"ARP"`), `sphere` (`"FEDERAL"` | `"STATE"` | `"MUNICIPAL"`), `uf`, `municipality`, `initial_value` (ou `updated_initial_value` / `original_value` / `initial_value_cents`), `signing_authority_role`, `has_conclusive_legal_opinion`, `has_surety_bond`, `insurer_notified`.
  - *`addendums[]` (alias `aditivos[]`):* `id` (`numero`), `type`, `value_increase` (`valueIncrease`, `increase_pct`, `gross_increase_pct`), `value_decrease` (`valueDecrease`, `decrease_pct`, `gross_decrease_pct`), `compensated_attempt` (`compensatedAttempt`), `is_unilateral` (`isUnilateral`, `unilateral`) / `is_consensual` (`isConsensual`), `justification`. *(Chaves divergentes como `addenda`, `addition_value`, `suppression_value`, `attempts_compensation` ou `compensation_attempted` são reportadas em `unknown_keys` sem alias silencioso).*
  - *`tripartite_items[]` (aliases `tripartite[]`, `items[]`):* `item_id`, `description`, `tr_unit_price` (`edital_tr.unit_price`), `proposal_unit_price` (`winning_proposal.unit_price`), `arp_unit_price` (`arp.unit_price`), `contract_unit_price`, `invoice_unit_price` (`contract_or_invoice.unit_price`), `homologated_qty` (`contract_qty`), `invoiced_qty` (`attested_qty`), `overpricing_detected`, `advance_payment_without_guarantee`.
  - *`readjustments[]` (alias `reajustes[]`, ou objeto singular `readjustment` / `reajuste`):* `id`, `type` (`"REAJUSTE_INDICE"` | `"REPACTUACAO_CCT"`), `index_name` (`index`), `base_date` (`budget_base_date`), `request_date` (`grant_date`), `months_elapsed` (`interregnum_months`), `applied_percentage`, `has_cct_proof` (`hasCctProof`, `cct_attached`, `cctAttached`).
  - *`pas_sanctions[]` (aliases `pas_processes[]`, `pas_evaluation`, `pas[]`, `sanctions[]` ou campos na raiz):* `process_id`, `sanction_type` / `penalty_type` (`"ADVERTENCIA"` | `"MULTA"` | `"IMPEDIMENTO_LICITAR_CONTRATAR"` | `"DECLARACAO_INIDONEIDADE"`), `sanction_scope_claimed` (`"OWN_ENTITY"` | `"FEDERATIVE_ENTITY"` | `"NATIONAL"` | `"ALL_SPHERES"`), `duration_months` (`debarment_months` / `debarment_years`), `fine_pct` (`fine_percentage`, `multa_pct`, `multa_percentual`, `multa_sancionatoria_proposta.percentual`), `opened_formal_pas`, `prior_notification_sent`, `defense_deadline_business_days` (`defense_business_days`, `defense_deadline_days`, `defense_period_days`, `contradictory_days`, `prazo_defesa_dias_uteis`, `prazo_defesa_dias`, `defense_days_type`), `sla_glosa_misclassified` (`is_imr_classified_as_sanction`, `is_sla_glosa` + `classified_as_penalty`, `glosa_ans_como_multa`, `ans_imr.classificado_como_multa`, `treated_as_penalty`), `has_surety_bond` / `seguro_garantia`, `insurer_notified` / `seguradora_notificada` (`garantia.seguradora_notificada`, `surety_bond.insurer_notified`), `signing_authority_role`, `has_conclusive_legal_opinion`, `registries_commanded` (`["CEIS", "CNEP", "PNCP", "TCE-<UF>"]`) e flags `register_pncp`, `register_ceis_cnep`, `notify_audit_court` / `external_control_court_notified`, além de `dosimetry_benchmark` / `dosimetry_evaluation` (ou direto no item: `juris_precedent_id`, `benchmark_precedents`, `jurisprudential_precedents`, `precedentes_citados`, `benchmark_range_pct`, `precedent_range_pct`, `precedent_min_pct`, `precedent_max_pct`, `benchmark_median_pct`, `precedent_median_pct`, `historical_average_fine_pct`, `precedent_fines_pct[]`, `benchmark_max_pct`, `lindb_art22_weighed`, `art156_par1_weighed`, `has_jurisprudential_calibration`, `aggravating_factors_proven`, `is_primary_offender`, `concrete_damage_proven`).
  - *`price_basket` (aliases `price_basket_items`, `cesta_precos`, `pesquisa_precos`):* array `[{ item_id, quotes | cotacoes | prices | values: [...], selected_method: "MEAN" | "MEDIAN" | "SANITIZED_MEAN", claimed_reference_price }]` ou objeto direto na raiz `{ cotacoes | quotes | prices | values: [...] }` (números ou objetos `{ valor | value | price | preco }`).
  - *`risk_matrix_events[]` (aliases `rebalance_requests[]`, `rebalance_events[]`, `reequilibrio`):* `id`, `event_description`, `event_nature` (`"EXTRAORDINARY_UNFORESEEN"` | `"ORDINARY_INFLATION"`), `risk_allocated_to` (`alocacao_matriz_riscos` / `risco_alocado`: `"CONTRACTOR"` | `"CONTRATADA"` | `"ADMINISTRATION"`), `is_extraordinary_unforeseeable`, `request_accepted`.
- **Detector Determinístico de `unknown_keys` (Lei 3):** Qualquer chave desconhecida na raiz ou nos arrays principais (`addendums[]`, `pas_sanctions[]`, `tripartite_items[]`, `readjustments[]`, `price_basket`, `risk_matrix_events[]`) é reportada em `unknown_keys` e `schema_warnings` no dossiê JSON em disco e no campo compacto `unknown_keys` do envelope bimodal (somente quando não vazio, respeitando `<= 880B` em `POINTER`).
- **Compilação OpenXML (`compilationMode` / `--mode` & `outputFormat` / `--format`):** Gera `Notificacao_Previa_Descumprimento_e_PAS.docx/.pdf` (`PAS_NOTIFICATION`) e/ou `Parecer_Dosimetria_Sancao_ou_Glosa_ANS.docx/.pdf` (`SANCTION_DOSIMETRY_OPINION`, alias `DOSIMETRY_OPINION`, ou `BOTH`) com Quadro de Enquadramento Jurisdicional e Quadro de Calibragem Jurisprudencial da Dosimetria (LINDB Art. 22).
- **Retorno Bimodal MCP/CLI (`INLINE <= 8192 B` / `POINTER <= 880 B`):** Devolve `status`, `engine_version`, `delivery_mode`, `read_file_required`, `artifact_path`, `artifact_size_kb`, `artifact_lines`, `inline_markdown` (em `INLINE`), `contract_id`, `legal_regime`, `blocking_tags` (com sentinela `[+N_TAGS_NO_DOSSIE]`), `unknown_keys` (opcional), `adherence_summary`, `compiled_artifacts`, `report_json_path`, `dossier_md_path` e `next_step_hint`.
- **Exemplo Canônico de Entrada para `docgov_audit_contract_execution`:**
```json
{
  "contract_id": "CT-001/2026",
  "legal_regime": "LEI_14133",
  "object_type": "SERVICE",
  "target_instrument": "CONTRACT",
  "sphere": "FEDERAL",
  "initial_value": 1000000,
  "addendums": [
    { "id": "TA-01", "value_increase": 200000, "value_decrease": 0 }
  ],
  "tripartite_items": [],
  "readjustments": [],
  "pas_sanctions": [],
  "price_basket": [],
  "risk_matrix_events": []
}
```

### 2.12. docgov_govern_arp (CLI: govern-arp)
Motor determinístico de governança de Ata de Registro de Preços e gestão de caronas (Gen5 Marco 8.4).
- **Parâmetros MCP / CLI:** `arpJsonPath`, `caseDir`, `outputDir`, `compilationMode` (`"ARP_ADHESION_GRANT_NOTE"` | `"ARP_ADVANTAGE_STUDY"` | `"NONE"`), `outputFormat` (`"docx"` | `"pdf"` | `"both"`).
- **Livro-Razão e Travas Matemáticas:** Trava individual de 50% por item (`[ARP_INDIVIDUAL_LIMIT_EXCEEDED_50PCT]`) e trava global acumulada de 200% do quantitativo registrado (`[ARP_GLOBAL_LIMIT_EXCEEDED_200PCT]`), preservando o saldo próprio intacto.
- **Matriz de Compatibilidade:** Simetria de regime (14.133 vs 13.303 - `[ARP_REGIME_ASYMMETRY_BLOCK]`) e vedação de carona ascendente (`[ARP_FEDERATIVE_ASCENDING_BLOCK]`).
- **Condicionantes de TIC:** Bloqueio de carona em lote único sem memória técnica (`[ARP_ICT_UMBRELLA_LOT_BLOCK]`).
- **Vigência e Desacoplamento:** Auditoria de vigência (12+12m), renovação no 2º ano (`[ARP_RENEWAL_WITHOUT_EDITAL_CLAUSE_BLOCK]`) e desacoplamento de contratos derivados (até 5 anos).
- **Schema de Entrada JSON (Objetos Aninhados + Normalização Flat):**
  - *Raiz:* `arp_number`, `managing_organ` (`{ name, sphere, legal_regime, is_state_enterprise }`), `adherent_sphere` / `manager_sphere`, `adherent_regime` / `manager_regime`, `is_tic` / `is_ict_arp`, `is_umbrella_or_single_lot`, `has_granulated_calculation_memory`.
  - *`validity` (alias `vigencia`):* `validity_months` (`arp_months`), `is_renewed_year_2` (`is_second_year_renewal`), `renew_quantities_second_year`, `has_edital_renewal_clause`, `has_advantage_proof`, `derived_contract_duration_months`.
  - *`items[]` e `adhesion_request` (ou flat na raiz):* `items[]` (`item_id`, `registered_quantity` / `registered_qty`, `unit_price`, `consumed_by_managing_and_participants` / `own_balance` / `manager_own_qty` + `participants_qty`, `previous_carona_adhesions` / `prior_adhesions_qty`, `requested_adhesion_qty` / `requestedQty`), `adhesion_request` (`requesting_organ: { name, sphere, legal_regime, is_state_enterprise }` ou alias `adherent_organ`, `items_requested[]`, `supplier_consent`, `market_price_comparison[]`, `etp_pdtic_alignment_summary`, `justification_no_bidding`).
- **Detector Determinístico de `unknown_keys` (Lei 3):** Chaves não reconhecidas na raiz ou estruturas aninhadas (`items[]`, `validity`, `managing_organ`, `adhesion_request` / `adhesions[]`, ou `requesting_organ` enviado como string em vez de objeto estruturado) são registradas em `unknown_keys` e `schema_warnings` no dossiê JSON em disco e expostas em `unknown_keys` no envelope bimodal (somente quando não vazio, `<= 880B` em `POINTER`).
- **Compilação Nativa OpenXML DOCX/PDF:** Modos `ARP_ADHESION_GRANT_NOTE` (`Nota_Tecnica_Anuencia_ou_Negativa_Adesao_ARP.docx/.pdf`) e `ARP_ADVANTAGE_STUDY` (`Estudo_Tecnico_Vantajosidade_Adesao_ARP.docx/.pdf`).
- **Retorno Bimodal MCP/CLI (`INLINE <= 8192 B` / `POINTER <= 880 B`):** Devolve `status`, `engine_version`, `delivery_mode`, `read_file_required`, `artifact_path`, `artifact_size_kb`, `artifact_lines`, `inline_markdown` (em `INLINE`), `arp_number`, `decision`, `blocking_tags`, `unknown_keys` (opcional), `ledger_summary`, `dossier_json_path`, `dossier_md_path`, caminhos compilados e `next_step_hint`.
- **Exemplo Canônico de Entrada para `docgov_govern_arp`:**
```json
{
  "arp_number": "ARP-001/2026",
  "managing_organ": {
    "name": "ORGAO_CONTRATANTE",
    "sphere": "FEDERAL",
    "legal_regime": "LEI_14133",
    "is_state_enterprise": false
  },
  "adherent_sphere": "FEDERAL",
  "adherent_regime": "LEI_14133",
  "validity": { "validity_months": 12, "is_renewed_year_2": false },
  "items": [
    {
      "item_id": "IT-01",
      "registered_quantity": 100,
      "unit_price": 500,
      "consumed_by_managing_and_participants": 20,
      "previous_carona_adhesions": 0,
      "requested_adhesion_qty": 30
    }
  ],
  "adhesion_request": {
    "requesting_organ": { "name": "ORGAO_A", "sphere": "FEDERAL", "legal_regime": "LEI_14133" },
    "supplier_consent": true
  }
}
```

### 2.13. docgov_evaluate_bidding_proposals (CLI: evaluate-proposals)
Motor determinístico da Fase Externa, Conluio Forense, Exequibilidade (75%/85%), Jogo de Planilha e Fase Recursal (Gen6 Marco 9 — `v1.7.6`).
- **Parâmetros MCP / CLI:** `proposalJsonPath` (aliases `bidding_json_path`, `input_json_path`, `biddingJsonPath`), `outputDir` (`output_dir`, `caseDir`, `case_dir`), `evaluationStance` (`evaluation_stance`: `"DEFENSE"` | `"ATTACK"`), `compilationMode` (`"PROPOSAL_JUDGMENT_OPINION"` | `"ACT_DILIGENCE_LETTER"` | `"JUDGMENT_OPINION"` | `"ACT_DILIGENCE_REPORT"` | `"BOTH"` | `"APPEAL_REASONS"` | `"APPEAL_COUNTER_REASONS"` | `"PREGOEIRO_DECISION"` | `"APPEALS_BUNDLE"` | `"ALL"` | `"NONE"`), `outputFormat` (`"docx"` | `"pdf"` | `"both"`).
- **Modelos TIC sem DEMO, Inexequibilidade (75%/85%), Jogo de Planilha & Súmula TCU 262:** Bloqueia descaracterização para alocação de postos (`[ICT_HIDDEN_LABOR_DEDICATION_DEMO_TRAP_BLOCK]`), UST = Hora-Homem pura (`[ICT_UST_RAW_HOUR_EQUIVALENCE_SUMULA269_BLOCK]`), HST sem teto em OS (`[ICT_UNBOUNDED_TECHNICAL_HOUR_PARADOX_BLOCK]`), PF/SQUAD sem vínculo com ANS, inexequibilidade < 75% (Art. 59 § 4º -> `[INEXEQUIBILITY_75_PCT_PRESUMPTION_DILIGENCE_REQUIRED]`), garantia adicional < 85% (Art. 59 § 5º -> `[INEXEQUIBILITY_ADDITIONAL_GUARANTEE_85_PCT_REQUIRED]`), sobrepreço unitário / Jogo de Planilha (`[UNIT_PRICE_OVERPRICING_JOGO_DE_PLANILHA_BLOCK]`) e desclassificação sumária sem diligência (`[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]`).
- **Conluio entre Propostas Concorrentes (`competing_proposals_meta[]`) & Motor Forense Anti-Fraude de ACT (7 Vetores + Pilares 1 e 5 `v1.7.0`):** Auto-hidratação por `act_pdf_path`/`act_structure_json_path`, divergência > 180 dias ou autoria coincidente (`[ACT_FORENSIC_SIGNATURE_DATE_MISMATCH]`), rastros `Canva/iLovePDF/Sejda` (`[ACT_PDF_EDITING_SOFTWARE_TRACE_SUSPICION]`), perícia criptográfica Pure-JS `PKCS#7/CMS/PAdES` e `/ByteRange` (`[FORENSIC_SIGNER_IDENTITY_MISMATCH_BLOCK]`, `[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]`, `[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]`), validador algorítmico Módulo 11 de NF-e 44 dígitos em diligências ACT Via B (`[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]`, `[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]`), detecção de clones `w:rsidRoot` / `w:rsidR` em `.docx` mesmo com `Author` apagado (`[FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK]`) e detecção de autoria compartilhada/criação simultânea em propostas PDF/DOCX/XLSX (`[BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT]`). Todas as 6 tags `[FORENSIC_*_BLOCK]` elevam `decision` para `"REJECTED"`.
- **Detector Determinístico de `unknown_keys` (Lei 3 — Zero Silent Aliases):** Chaves não reconhecidas na raiz ou nos arrays `act_forensic_items[]`, `diligence_nfe_keys[]` e `competing_proposals_meta[]` são reportadas em `unknown_keys` e `schema_warnings` no dossiê e no envelope bimodal MCP/CLI (`<= 880B` em `POINTER`) quando não vazio.
- **Fase Recursal Determinística (Art. 165, Art. 168 & Acórdão TCU 1.211/2021 via `appeal_context`):** Validação de intenção imediata (`[APPEAL_IMMEDIATE_INTENT_PRECLUSION_BLOCK]`), vedação de rejeição sumária de mérito da intenção (`[APPEAL_INTENTION_SUMMARY_REJECTION_ILLEGAL_BLOCK]`), prazo peremptório mínimo/máximo de 3 dias úteis (`[APPEAL_UNTIMELY_3_BUSINESS_DAYS_BLOCK]`, `[APPEAL_DEADLINE_3_BUSINESS_DAYS_VIOLATION]`), vinculação temática (`[APPEAL_THEMATIC_INNOVATION_OUTSIDE_INTENT_BLOCK]`), exceção para documento preexistente (`[NEW_DOCUMENT_PRECLUSION_EXCEPTION_ACORDAO_1211_2021]`), remessa hierárquica em 10 dias úteis (`[HIERARCHICAL_REMISSION_10_DAYS_MANDATORY]`) e efeito suspensivo automático, compilando `Peca_Razoes_ou_Contrarrazoes_Recurso_Administrativo.docx/.pdf` e `Decisao_Pregoeiro_e_Encaminhamento_Autoridade_Superior.docx/.pdf`.
- **Schema de Entrada JSON (Objetos Aninhados + Normalização Dual Flat):**
  - *Raiz:* `process_id`, `bidder_name`, `bidder_cnpj`, `legal_regime` (`"LEI_14133"` | `"LEI_13303"`), `evaluation_stance`, `estimated_total_value`; aceita também flags flat de topo (`metric_type`, `has_hidden_labor_dedication_trap`, `ust_equals_raw_hour_without_catalog`, `unbounded_technical_hour_os`, `below_profile_floor`, `offered_unit_value`, `parametric_profile_floor_value`, `sumula_262_diligence_opened`, `summary_disqualification_attempted`, `rejects_equivalent_metric_conversion`, `forbids_certificate_summation_without_justification`, `requires_cumulative_capital_and_equity`, `required_min_equity_or_capital_pct`).
  - *`ict_execution_model` (objeto):* `metric_type` (`UST`, `USM`, `UNS`, `HST`, `HORA_TECNICA`, `PF`, `SQUAD`), `is_demo_regime`, `requires_fixed_schedule_or_timeclock`, `requires_named_individuals_in_os`, `has_direct_hierarchical_subordination`, `has_fixed_monthly_payment_without_deliverables`, `has_complexity_weighted_activity_catalog`, `is_ust_equal_to_raw_hour`, `has_prior_closed_os_hour_ceiling`, `has_exceptional_hst_justification`, `links_payment_to_sprint_throughput_and_ans`, `disables_linked_account_and_uses_ict_index`.
  - *`proposal_exequibility` + Inexequibilidade 75%/85% & Jogo de Planilha (`inexequibility_evaluator.ts`):* `offered_unit_value`, `parametric_profile_floor_value`, `profiles_breakdown[]` (`profile_name`, `salary_floor`, `social_charges_pct`, `taxes_and_admin_pct`, `monthly_productive_units`), `summary_disqualification_attempted` (raiz ou aninhado), `prior_diligence_opportunity_granted` (alias raiz `sumula_262_diligence_opened`), `diligence_viability_proven`. Para Obras/Engenharia (< 75% / 75%..85%) e Jogo de Planilha: na raiz ou em `proposal_exequibility`, lê `is_engineering_or_works`, `object_category` (`/OBRA|ENGENHARIA/i`), `estimated_budget_value` (`estimated_total_value`), `offered_proposal_value` (`offered_total_value`), `additional_guarantee_offered`, flags booleanas `has_unit_price_overpricing` / `jogo_de_planilha_detected` / `unit_price_overpricing_detected` e arrays `unit_items[]` / `spreadsheet_items[]` / `items[]` (`{ item_id, description, estimated_unit_price | reference_unit_price, offered_unit_price | unit_price, quantity, estimated_quantity, offered_quantity }`). Tags: `[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]`, `[INEXEQUIBILITY_75_PCT_PRESUMPTION_DILIGENCE_REQUIRED]`, `[INEXEQUIBILITY_ADDITIONAL_GUARANTEE_85_PCT_REQUIRED]` e `[UNIT_PRICE_OVERPRICING_JOGO_DE_PLANILHA_BLOCK]`.
  - *`technical_qualification` (objeto):* `edital_metric`, `requires_identical_metric_only`, `allows_certificate_summation`, `indivisibility_technically_justified`, `required_parcels[]` (`description`, `estimated_item_value`, `total_quantity`, `required_minimum_quantity`), `presented_certificates[]` (`certificate_id`, `metric`, `quantity`, `conversion_factor_to_edital_metric`).
  - *`financial_qualification` (objeto):* `ativo_circulante`, `realizavel_longo_prazo`, `ativo_total`, `passivo_circulante`, `passivo_nao_circulante`, `patrimonio_liquido`, `capital_social`, `required_min_equity_or_capital_pct`, `requires_cumulative_capital_and_equity`.
  - *`act_forensic_items[]` (array — 7 Vetores + Pilares 1 e 5):* `certificate_id`, `issuer_name`, `issuer_cnpj`, `issuer_type` (`PUBLIC` | `STATE_ENTERPRISE` | `PRIVATE`), `issuer_porte`, `issuer_cnae_primary`, `issuer_cnae_compatible_with_ict`, `issuer_capital_social`, `issuer_cnpj_status`, `issuer_opening_date`, `issuer_status_date`, `execution_start_date`, `execution_end_date`, `act_issue_date`, `pncp_contract_verified`, `pncp_reference_id`, `issuer_qsa_partners[]`, `bidder_qsa_partners[]`, `same_address_or_cep`, `shared_or_free_email_domain`, `issuer_official_email`, `act_description_text`, `edital_tr_reference_text`, `attested_volume`, `execution_months`, `max_plausible_monthly_capacity`, `pdf_creation_date`, `pdf_mod_date`, `digital_signature_date`, `pdf_author`, `pdf_creator_tool`, `pdf_producer`, `editing_software_traces[]`, `act_pdf_path`, `act_structure_json_path`, `is_second_copy_declared`, `expected_signer_name`, `expected_signer_cpf_cnpj`, `pades_signatures[]`, `nfe_access_key`, `nfe_declared_issue_date`, `diligence_nfe_keys[]` (`string` ou `{ access_key, expected_cnpj, declared_issue_date }`, confrontando CNPJ contra `expected_cnpj || bidder_cnpj`).
  - *`competing_proposals_meta[]` (array — Conluio entre Propostas Concorrentes):* cada item aceita `bidder_name`, `bidder_cnpj`, `proposal_file_name`, `proposal_pdf_path` (extrai metadados de `.pdf`, `.docx` ou `.xlsx`), `structure_json_path` (lê `forensic_meta` persistido) e `forensic_meta` (`DocumentForensicMeta` direto). Dispara `[BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT]` por colisão de autoria (`author`/`last_modified_by`) ou proximidade temporal `<= 120s` em `creation_date_iso` com mesma ferramenta (`creator_tool`/`producer`), e `[FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK]` por `w:rsidRoot` / `w:rsidR` compartilhado em `.docx`.
  - *`appeal_context` (objeto + aliases flat opcionais na raiz — Fase Recursal Art. 165 & Acórdão TCU 1.211/2021):* `appeal_type` (`"RAZOES"` | `"CONTRARRAZOES"` | `"DECISAO_PREGOEIRO"`), `appellant_name`, `appellant_cnpj`, `counter_appellant_name`, `session_or_decision_date`, `reasons_filed_date`, `counter_reasons_filed_date`, `summary_reasons`, `summary_counter_reasons`; `intent_manifested_timely: false` -> `[APPEAL_IMMEDIATE_INTENT_PRECLUSION_BLOCK]`; `intent_summary_rejection_attempted: true` | `summary_merit_rejection_of_intent: true` -> `[APPEAL_INTENTION_SUMMARY_REJECTION_ILLEGAL_BLOCK]`; `reasons_business_days_elapsed > 3` | `counter_reasons_business_days_elapsed > 3` -> `[APPEAL_UNTIMELY_3_BUSINESS_DAYS_BLOCK]` + `[APPEAL_DEADLINE_3_BUSINESS_DAYS_VIOLATION]`; `deadline_less_than_3_business_days: true` | `edital_appeal_deadline_days < 3` -> `[APPEAL_DEADLINE_3_BUSINESS_DAYS_VIOLATION]`; `innovation_outside_intent: true` ou ausência de sobreposição léxica entre `declared_intent_scope` e `appeal_reasons_scope` -> `[APPEAL_THEMATIC_INNOVATION_OUTSIDE_INTENT_BLOCK]`; `pre_existing_document_submitted_on_appeal: true` | `acordao_1211_2021_applicable: true` | `new_document_for_preexisting_fact: true` -> `[NEW_DOCUMENT_PRECLUSION_EXCEPTION_ACORDAO_1211_2021]`; `reconsider_decision: false | "MANTER_E_ENCAMINHAR"` | `maintained_decision_without_hierarchical_remission: true` | `requires_hierarchical_remission: true` | `hierarchical_decision_days_elapsed > 10` -> `[HIERARCHICAL_REMISSION_10_DAYS_MANDATORY]`.
- **Compilação OpenXML DOCX/PDF:** Gera `Parecer_Julgamento_Proposta_Habilitacao_e_Diligencia.docx/.pdf`, `Oficio_e_Email_Diligencia_Veracidade_ACT.docx/.pdf` (Via A ao Emissor na RFB e Via B à Licitante exigindo NF-e/NFS-e 44 dígitos, Contrato, OS e SEFIP/eSocial), `Peca_Razoes_ou_Contrarrazoes_Recurso_Administrativo.docx/.pdf` e `Decisao_Pregoeiro_e_Encaminhamento_Autoridade_Superior.docx/.pdf`.

### 2.14. docgov_audit_direct_contracting (CLI: audit-direct-contracting)
Motor determinístico de Contratação Direta e Oportunidade Estatal (Gen6 Marco 9 — `v1.7.6`).
- **Parâmetros MCP / CLI:** `directContractingJsonPath` (aliases `direct_json_path`, `input_json_path`, `directJsonPath`), `outputDir` (`output_dir`, `caseDir`, `case_dir`), `compilationMode` (`"DIRECT_CONTRACTING_OPINION"` | `"NONE"`), `outputFormat` (`"docx"` | `"pdf"` | `"both"`).
- **Inexigibilidade (Art. 74 Lei 14.133 / Art. 30 Lei 13.303):** Bloqueio de atestado de exclusividade genérico (Súmula TCU 255 -> `[INVALID_EXCLUSIVITY_CERTIFICATE_BLOCK]`), exigência de mínimo de 3 NFs/contratos do fornecedor (`[INEXIGIBILITY_PRICE_PROOF_INSUFFICIENT_BLOCK]`), validador algorítmico Módulo 11 de NF-e 44 dígitos em `supplier_market_price_proofs[]` (`[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]`, `[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]`), detecção de sobrepreço acima da mediana saneada das NFs/contratos (`[INEXIGIBILITY_OVERPRICING_ABOVE_SUPPLIER_MARKET_PROOF_BLOCK]`) e verificação forense cruzada `quotations_forensic_meta[]` em PDF/DOCX/XLSX (`[PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK]` e `[FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK]`).
- **Dispensa por Valor (Art. 75 / Art. 29):** Controle anual anti-fracionamento por UG e ramo `PDM / CATMAT / CATSER` (`[EXPENSE_FRAGMENTATION_BLOCK]`).
- **Oportunidade de Negócio Estatal (Art. 28, § 3º, II Lei 13.303/2016):** Validação de objeto social, singularidade do parceiro, inviabilidade concorrencial e matriz de riscos/receitas (`[STATE_ENTERPRISE_PARTNERSHIP_UNJUSTIFIED_BLOCK]`).
- **Detector Determinístico de `unknown_keys` (Lei 3 — Zero Silent Aliases):** Chaves não reconhecidas na raiz ou nos arrays `supplier_market_price_proofs[]` e `quotations_forensic_meta[]` são reportadas em `unknown_keys` e `schema_warnings` no dossiê e no envelope bimodal MCP/CLI (`<= 880B` em `POINTER`) quando não vazio.
- **Schema de Entrada JSON (Objetos Aninhados + Normalização Dual Flat):**
  - *Raiz:* `process_id`, `contracting_modality` / `modality` (`INEXIGIBILIDADE` | `INEXIGIBILITY` | `DISPENSA_VALOR` | `DISPENSATION_BY_VALUE` | `OPORTUNIDADE_NEGOCIO_ESTATAL` | `STATE_ENTERPRISE_OPPORTUNITY`), `legal_regime`, `contracted_amount`, `supplier_cnpj`; aceita também flags flat de topo (`exclusivity_certificate_valid`, `price_proof_invoices_count`, `competition_infeasibility_proven`, `pdm_catmat_catser`, `prior_accumulated_spend_in_branch`, `current_proposed_spend`, `legal_annual_limit`, `has_partner_uniqueness_justification`, `is_ordinary_commodity_disguised`, `has_risk_and_revenue_sharing_matrix`).
  - *`inexigibility_details` (objeto):* `legal_hypothesis`, `competition_infeasibility_proven`, `notorious_specialization_proven`, `exclusivity_certificate` (`provided`, `issuer_entity`, `is_generic_or_self_declared`, `covers_only_local_scope_without_technical_justification`, `sumula_255_tcu_verified`), `supplier_market_price_proofs[]` (`type`, `identifier`, `unit_price`, `buyer`, `issue_date`, `pdf_path`, `structure_json_path`, `nfe_access_key`, `issuer_cnpj`).
  - *`dispensation_by_value_details` (objeto):* `managing_unit_code`, `financial_year`, `activity_branch_code` (`pdm_catmat_catser`), `is_engineering_or_maintenance`, `legal_annual_limit`, `prior_accumulated_spend_in_branch`, `current_proposed_spend`.
  - *`state_enterprise_opportunity_details` (objeto):* `is_linked_to_corporate_purpose`, `partner_competitive_singularity_proven`, `competitive_procedure_infeasibility_proven`, `has_risk_and_revenue_sharing_matrix`, `is_ordinary_commodity_disguised`.
- **Compilação OpenXML DOCX/PDF:** Gera `Parecer_Instrucao_Inexigibilidade_Dispensa_ou_Oportunidade_Estatal.docx/.pdf`.

### 2.15. docgov_audit_demo_regime (CLI: audit-demo-regime)
Motor determinístico em centavos inteiros e basis points para modelagem, julgamento de planilhas de custos e governança contratual no Regime de Dedicação Exclusiva de Mão de Obra (DEMO — Gen6.5 Marco 9.5.1 — `v1.7.6`).
- **Parâmetros MCP / CLI:** `demoJsonPath` (ou `--input <path_or_json>`), `workspaceDir` (`workspace_dir`, `--workspace <dir>`), `outputFormat` (`"docx"` | `"pdf"` | `"both"`) ou propriedades estruturadas do `DemoRegimeAuditInput` direto no payload.
- **Auditoria dos Módulos 1 a 6 (Anexo VII-D da IN SEGES nº 05/2017) & 16 Tags Bloqueantes (`[DEMO_*]`):**
  - *Módulo 1:* Salário-base vs. piso CCT (`[DEMO_MOD1_CCT_FLOOR_BELOW_NORMATIVE]`), periculosidade 30%, insalubridade (10%/20%/40%), laudo LTCAT e Súmula nº 448, II do TST em banheiros públicos de grande circulação (`[DEMO_MOD1_SUMULA448_TST_INSALUBRITY_VIOLATION]`).
  - *Módulo 2:* Submódulo 2.1 (13º `8,33%` + Férias/1/3 `12,10%`) e base CPP 20% + FGTS 8% (`[DEMO_MOD2_SUB21_CPP_FGTS_13TH_VACATION_ERROR]`), SAT/RAT × FAP (`[DEMO_MOD2_SUB22_SAT_RAT_FAP_MISMATCH]`) e Benefícios VT após desconto legal de 6% + VA mínimo CCT (`[DEMO_MOD2_SUB23_VT_6PCT_DEDUCTION_OR_VA_ERROR]`).
  - *Módulo 3:* Provisão rescisória (API, multa FGTS e APT de até `1,94%` no 1º ano -> `[DEMO_MOD3_RESCISAO_APT_FIRST_YEAR_OR_FGTS_PENALTY_ERROR]`).
  - *Módulo 4 & Módulo 5:* Reposição de profissional ausente (`[DEMO_MOD4_AUSENTES_REPLACEMENT_CALC_ERROR]`) e insumos/EPIs/depreciação (`[DEMO_MOD5_INSUMOS_EPI_DEPRECIATION_INCONSISTENT]`).
  - *Módulo 6:* Gross-Up por dentro `Total = (M1..M5 + CI + Lucro) / (1 - Tributos)` (`[DEMO_MOD6_GROSS_UP_FORMULA_MATH_ERROR]`), alíquota efetiva EFD-Contribuições no Lucro Real conforme Acórdão TCU 1.214/2013 (`[DEMO_MOD6_LUCRO_REAL_EFFECTIVE_RATE_ACORDAO_1214_VIOLATION]`) e vedação ao Simples Nacional Art. 17, XII LC 123/2006 salvo Anexo IV Limpeza/Vigilância com CPP 20% (`[DEMO_MOD6_SIMPLES_NACIONAL_ART17_XII_FORBIDDEN]`).
  - *Anexo VI-B & Decreto Federal nº 12.174/2024:* Faixas referenciais por m² (`INTERNA 800..1200`, `EXTERNA 1800..2700`, `ESQUADRIAS 300..380`, `FACHADA_VIDRO 130..160`, `HOSPITALAR 330..450` -> `[DEMO_ANEXO_VIB_M2_PRODUCTIVITY_OUT_OF_BOUNDS]`), vedação de corte salarial na redução de jornada 44h -> 40h (`[DEMO_DEC12174_WORKING_HOURS_REDUCTION_44_TO_40_SALARY_CUT_VIOLATION]`) e reserva de vagas/cláusulas para mulheres vítimas de violência doméstica (`[DEMO_DEC12174_DOMESTIC_VIOLENCE_QUOTA_OR_LABOR_CLAUSE_MISSING]`).
  - *Governança Contratual (Acórdão TCU 1.586/2018, Anexo XII & Art. 135):* Expurgo obrigatório de 90% do APT na 1ª prorrogação (`1,94% -> 0,194%` -> `[DEMO_EXEC_APT_FIRST_RENEWAL_PURGE_ACORDAO_1586_MISSING]`), retenção na Conta-Depósito Vinculada (`29,50%..31,33%`) vs. comprovação no Fato Gerador e interregno/limites de Repactuação CCT (`[DEMO_EXEC_LINKED_ACCOUNT_FATO_GERADOR_OR_REPACTUATION_BREACH]`).
- **Artefatos em `workspace_dir` & Guarda Bimodal (`INLINE <= 8192 B` / `POINTER <= 880B`):** Grava `demo_regime_audit.json`, `demo_regime_audit.md`, `laudo_pericial_planilha_demo.docx` e `laudo_pericial_planilha_demo.pdf`, devolvendo envelope bimodal com `artifact_path`, `inline_markdown` (em `INLINE`) e `<= 880 bytes` UTF-8 com sentinela `[+N_TAGS_NO_DOSSIE]` em `POINTER`.

### 2.16. docgov_audit_engineering_works (CLI: audit-engineering-works)
Motor determinístico para auditoria de Obras e Serviços de Engenharia (Geração 6.5 — Eixo 2 — `v1.7.6`).
- **Parâmetros MCP / CLI:** `engineeringJsonPath` (ou `--input <path_or_json>`), `workspaceDir` (`workspace_dir`, `--workspace <dir>`), `outputFormat` (`"docx"` | `"pdf"` | `"both"`) ou propriedades estruturadas de `EngineeringWorksAuditInput` direto no payload.
- **Auditoria de BDI & Súmulas TCU (Acórdão TCU 2.622/2013, Súmulas 253 e 254):**
  - *Fórmula Algébrica & Quartis por Tipologia:* Validação matemática de `BDI = ((1 + AC + S + R) * (1 + DF) * (1 + L)) / (1 - I) - 1` (`[ENG_BDI_FORMULA_ALGEBRAIC_MISMATCH_BLOCK]`) e confronto contra os quartis referenciais do Acórdão TCU nº 2.622/2013 (`CONSTRUCAO_EDIFICIOS`, `RODOVIARIA`, `REDES_AGUA_ESGOTO`, `REDES_ENERGIA_ELETRICA`, `PORTUARIA_MARITIMA`, `FORNECIMENTO_MATERIAIS_EQUIPAMENTOS` -> `[ENG_BDI_ABOVE_TCU_2622_Q3_CEILING_BLOCK]`).
  - *BDI Diferenciado & Vedações:* Exigência de BDI Diferenciado reduzido (3ºQ `16,80%`) para fornecimento relevante de materiais/equipamentos conforme Súmula TCU nº 253 (`[ENG_BDI_SUMULA253_DIFFERENTIATED_MISSING_OR_EXCEEDED_BLOCK]`), bloqueio de *bis in idem* de Administração Local/Canteiro/Mobilização no BDI (`[ENG_BDI_ADMIN_LOCAL_CANTEIRO_MOBILIZACAO_BIS_IN_IDEM_BLOCK]`), vedação de IRPJ/CSLL conforme Súmula TCU nº 254 (`[ENG_BDI_SUMULA254_IRPJ_CSLL_FORBIDDEN_BLOCK]`) e medição proporcional de Administração Local ao avanço físico (`[ENG_ADMIN_LOCAL_NON_PROPORTIONAL_MEASUREMENT_BLOCK]`).
- **Curva ABC SINAPI/SICRO, Desoneração CPRB (Lei 14.973/2024), Cronograma & Contratação Integrada:**
  - *Curva ABC (Decreto nº 7.983/2013):* Classificação nas Faixas A (`<= 80%`), B (`80%..95%`) e C e confronto unitário contra medianas `SINAPI`/`SICRO` (`[ENG_CURVA_ABC_SINAPI_SICRO_MEDIAN_OVERPRICING_BLOCK]`).
  - *Simetria Tributária CPRB (Lei nº 14.973/2024):* Validação de consistência entre tabela `DESONERADO`/`NAO_DESONERADO`, alíquota transicional de CPRB e INSS sobre folha (`2024..2028+` -> `[ENG_CPRB_DESONERACAO_TAX_ASYMMETRY_LEI14973_BLOCK]`).
  - *Cronograma & Matriz de Riscos:* Detecção de *front-loading* (`> 5%` de antecipação financeira -> `[ENG_SCHEDULE_FRONT_LOADING_CASHFLOW_MANIPULATION_BLOCK]`), exigência de Matriz de Alocação de Riscos em `CONTRATACAO_INTEGRADA`/`CONTRATACAO_SEMI_INTEGRADA` (`[ENG_INTEGRATED_CONTRACTING_RISK_MATRIX_MISSING_BLOCK]`) e bloqueio de aditivo por erro de projeto (`[ENG_INTEGRATED_CONTRACTING_ILLEGAL_DESIGN_ADDENDUM_BLOCK]`).
  - *Reaproveitamento de `inexequibility_evaluator.ts`:* Emissão integrada de `[INEXEQUIBILITY_75_PCT_PRESUMPTION_DILIGENCE_REQUIRED]`, `[INEXEQUIBILITY_ADDITIONAL_GUARANTEE_85_PCT_REQUIRED]`, `[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]` e `[UNIT_PRICE_OVERPRICING_JOGO_DE_PLANILHA_BLOCK]` (Art. 59 §§ 4º e 5º e Súmulas TCU 259 e 262).
- **Schema de Entrada JSON (Objetos Aninhados + Aliases Naturais / Flat):**
  - *Raiz:* `case_id`, `workspace_dir`, `contract_regime` (`"LEI_14133"` | `"LEI_13303"`), `work_typology` (`"CONSTRUCAO_EDIFICIOS"` | `"RODOVIARIA"` | `"REDES_AGUA_ESGOTO"` | `"REDES_ENERGIA_ELETRICA"` | `"PORTUARIA_MARITIMA"` | `"FORNECIMENTO_MATERIAIS_EQUIPAMENTOS"`), `execution_regime` (`"EMPREITADA_PRECO_UNITARIO"` | `"EMPREITADA_PRECO_GLOBAL"` | `"EMPREITADA_INTEGRAL"` | `"TAREFA"` | `"CONTRATACAO_INTEGRADA"` | `"CONTRATACAO_SEMI_INTEGRADA"`), `estimated_budget_cents` (`estimated_budget_value`), `offered_proposal_cents` (`offered_proposal_value`), `additional_guarantee_offered`, `summary_disqualification_attempted`, `prior_diligence_opportunity_granted` (`sumula_262_diligence_opened`), `diligence_viability_proven`, `has_unit_price_overpricing`, `output_format`.
  - *`bdi_evaluation` (aliases `bdi`, `bdi_composition`, `composicao_bdi` ou flat na raiz):* `central_admin_bps`/`_pct`, `insurance_and_guarantee_bps`/`_pct`, `risk_bps`/`_pct`, `financial_expenses_bps`/`_pct`, `profit_bps`/`_pct`, `pis_bps`/`_pct`, `cofins_bps`/`_pct`, `iss_bps`/`_pct`, `cprb_bps`/`_pct`, `irpj_bps`/`_pct`, `csll_bps`/`_pct`, `declared_bdi_bps`/`_pct`, `justification_above_q3_proven`, `includes_admin_local_in_bdi`, `includes_canteiro_or_mobilizacao_in_bdi`, `admin_local_in_bdi_bps`, `includes_irpj_or_csll`, `has_relevant_equipment_supply`, `relevant_equipment_share_bps`/`_pct`, `differentiated_equipment_bdi_bps`/`_pct`, `differentiated_bdi_justification_proven`, `admin_local_proportional_to_physical_progress`, `physical_progress_bps`/`_pct`, `admin_local_measured_bps`/`_pct`.
  - *`tax_desoneracao_cprb` (aliases `desoneracao_cprb`, `cprb_symmetry` ou flat na raiz):* `reference_year` (`2024..2028+`), `sinapi_sicro_table_regime` (`"DESONERADO"` | `"NAO_DESONERADO"`), `bdi_includes_cprb`, `applied_cprb_bps`/`_pct`, `payroll_inss_bps`/`_pct`.
  - *`curva_abc_items[]` (aliases `curva_abc`, `abc_items`, `budget_items`):* `item_id`, `description`, `reference_source` (`"SINAPI"` | `"SICRO"` | `"COTACAO_MERCADO"`), `quantity`, `sinapi_sicro_median_unit_cents` (`median_unit_cents` | `reference_unit_price`), `offered_unit_cents` (`unit_price_cents` | `offered_unit_price`), `specificity_justification_approved`.
  - *`schedule_and_risk` (aliases `scheduleAndRisk`, `cronograma_fisico_financeiro`, `cronograma`, `schedule`, `risk_matrix` ou flat na raiz):* `front_loading_detected` (aliases `has_front_loading`, `front_loading`), `schedule_stages[]` (aliases `stages[]`, `etapas_cronograma[]` com `stage_number`, `description`, `reference_physical_cumulative_bps`/`_pct` | `physical_cumulative_pct` | `physical_pct` e `financial_disbursement_cumulative_bps`/`_pct` | `financial_cumulative_pct` | `financial_pct`), `has_risk_allocation_matrix` (`risk_matrix_present`, `has_risk_matrix`), `has_anteprojeto_or_basic_design`, `attempts_design_error_addendum_without_legal_exception` (aliases `design_error_addendum_attempted`, `illegal_design_addendum`, `requests_design_error_addendum`, `aditivo_erro_projeto_sem_excecao`).
- **Artefatos em `workspace_dir` & Guarda Bimodal (`INLINE <= 8192 B` / `POINTER <= 880B`):** Grava `engineering_works_audit.json`, `engineering_works_audit.md`, `laudo_pericial_obras_engenharia.docx` e `laudo_pericial_obras_engenharia.pdf`, devolvendo envelope bimodal com `artifact_path`, `inline_markdown` (em `INLINE`) e `<= 880 bytes` UTF-8 com sentinela `[+N_TAGS_NO_DOSSIE]` em `POINTER`.
- **Exemplo Canônico de Entrada para `docgov_audit_engineering_works`:**
```json
{
  "workspace_dir": "cases/meu_caso/state",
  "case_id": "PROC-OBRAS-2026-001",
  "contract_regime": "LEI_14133",
  "work_typology": "CONSTRUCAO_EDIFICIOS",
  "execution_regime": "CONTRATACAO_SEMI_INTEGRADA",
  "estimated_budget_cents": 1000000000,
  "offered_proposal_cents": 820000000,
  "additional_guarantee_offered": true,
  "bdi_evaluation": {
    "central_admin_bps": 400,
    "insurance_and_guarantee_bps": 80,
    "risk_bps": 100,
    "financial_expenses_bps": 100,
    "profit_bps": 600,
    "pis_bps": 65,
    "cofins_bps": 300,
    "iss_bps": 200,
    "cprb_bps": 270,
    "declared_bdi_bps": 2359,
    "includes_admin_local_in_bdi": false,
    "includes_irpj_or_csll": false,
    "has_relevant_equipment_supply": true,
    "differentiated_equipment_bdi_bps": 1402,
    "admin_local_proportional_to_physical_progress": true
  },
  "tax_desoneracao_cprb": {
    "reference_year": 2026,
    "sinapi_sicro_table_regime": "DESONERADO",
    "bdi_includes_cprb": true,
    "applied_cprb_bps": 270,
    "payroll_inss_bps": 1000
  },
  "curva_abc_items": [
    {
      "item_id": "SINAPI-92775",
      "description": "Concreto Estrutural FCK 30MPa",
      "reference_source": "SINAPI",
      "quantity": 1000,
      "sinapi_sicro_median_unit_cents": 45000,
      "offered_unit_cents": 44500
    }
  ],
  "schedule_and_risk": {
    "front_loading_detected": false,
    "schedule_stages": [
      {
        "stage_number": 1,
        "reference_physical_cumulative_bps": 2000,
        "financial_disbursement_cumulative_bps": 2000
      }
    ],
    "has_risk_allocation_matrix": true,
    "attempts_design_error_addendum_without_legal_exception": false
  }
}
```

---

## 3. Cache Global, Rastreabilidade Temporal e Sanity Check (core/registry/templates/)
- Os templates homologados são armazenados em `core/registry/templates/<template_id>.json` com `created_at`, `updated_at`, `engine_version` e `slots_count`.
- Ao atualizar um template já existente no disco, o `created_at` original é preservado e `updated_at` é renovado.
- Caches legados sem `created_at` ou `updated_at` são aceitos sem erro e sem usar `mtime` do disco, reportando `"NÃO DISPONÍVEL"`, `age_days: null` e `cache_date_status: "UNKNOWN"` para informar ao usuário no Gate 1.
- O método `loadAllRegistryTemplates` executa normalização automática em cada entrada e descarta silenciosamente manifestos corrompidos com 0 regras.