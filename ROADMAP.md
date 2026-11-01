# 🗺️ ROADMAP OFICIAL — `docgov-engine` (v1.1.x+)

> **Memória Histórica:** Para o histórico consolidado de versões desde o commit inicial (`v0.0.1`) até o lançamento principal (`v1.0.0 — Clean Cut`) e releases consolidadas, consulte o [CHANGELOG.md](CHANGELOG.md).
> **Propósito deste Documento:** Fonte única da verdade sobre o planejamento arquitetural, evoluções funcionais e marcos estratégicos futuros do motor (`v1.1.x+`).
> **Natureza Standalone & Desacoplada:** O `docgov-engine` é um motor autônomo e determinístico. Embora sirva como fundação para a camada de agentes do ecossistema `docgov`, ele possui ciclo próprio de evolução e pode ser utilizado de forma independente via CLI ou MCP por qualquer cliente, agente de IA ou pipeline automatizado.
> **Política de Versionamento Pareado (Lockstep `Major.Minor` com o repositório `DocGov`):**
> O par `Major.Minor` (`1.2.x`, `1.3.x`, `1.4.x`, `1.5.x`) caminha em estrita sincronia funcional com o repositório irmão `DocGov`, agrupando conjuntos densos de funcionalidades por geração. Evoluções incrementais, hotfixes e melhorias internas de robustez utilizam exclusivamente o dígito `Patch` (`.x`), evitando inflação desnecessária de números de versão e assegurando previsibilidade arquitetural entre a engine e a camada de agentes.
> **Regra para Agentes IA:** Sempre consulte e atualize os checkboxes (`[x]` / `[ ]`) deste `ROADMAP.md` ao planejar ou concluir cada marco evolutivo.

---

### 📊 Matriz de Gerações Pareadas (Lockstep DocGov $\leftrightarrow$ docgov-engine)

| Geração | Versão Pareada | Foco Funcional Estratégico no Motor |
| :--- | :--- | :--- |
| **Geração 1** | `v1.1.x` | Auditoria Matemática de Planilhas (`Z10`/`Z12`), Diff Estrutural e Resiliência Multi-Arquivo |
| **Geração 2** | `v1.2.x` | Segurança Supply-Chain, Ingestão de `.xlsx`/`.csv`, Tabelas Multi-Página e OCR Headless |
| **Geração 3** | `v1.3.x` | Diff Semântico Granular, Evolução de Cláusulas e Nota Técnica Comparativa Padronizada |
| **Geração 4** | `v1.4.x` | Motor Determinístico Sob Demanda de Pesquisa, Validação e Fatiamento Anatômico de Jurisprudência (TCU, TCEs & Ponte Lei 13.303/2016 $\leftrightarrow$ Lei 14.133/2021) |
| **Geração 5** | `v1.5.x` | Fiscalização Contratual, Aditivos 25%/50%, Reajustes e Validação Tripartite |
| **Major** | `v2.0.0` | Breaking Changes Reais em contratos públicos ou arquitetura de ferramentas MCP |

---

## 🎯 MARCO 4 — `v1.1.0`: Auditoria Matemática de Planilhas Orçamentárias (`pdf` e `docx`)

- [x] **4.1. Parsing e Extração Tabular de Linhas de Itens Orçamentários:**
  - Extrair com precisão linhas de tabelas contendo identificadores, descrições, quantidades, unidades de medida e valores monetários (`Item | Descrição | Unid | Qtd | Valor Unit | Valor Total`).
  - Normalização determinística de formatos numéricos brasileiros (`1.234,56`) e internacionais (`1,234.56`).

- [x] **4.2. Validação Aritmética Determinística:**
  - Verificar produto de cada item: $\text{Qtd} \times \text{Valor Unitário} = \text{Valor Total}$ (com detecção estrita de divergências em centavos, categorizadas em `ROUNDING_WARNING` para $\le R\$\,0,02$ e `MATH_ERROR` para $> R\$\,0,02$).
  - Verificar somatórios parciais de subtotais e soma global da planilha orçamentária.
  - Identificar potenciais distorções e inconsistências matemáticas contra valores declarados no texto (Z12).

- [x] **4.3. Emissão Estruturada de Inconsistências Aritméticas:**
  - Persistir relatório detalhado em `state/auditoria_orcamentaria_<stem>.json`.
  - Integrar alertas de erro de cálculo diretamente no `state/dossie_hotspots_<stem>.md` e na `state/visao_auditoria_<stem>.md` (Radar Z10 e Z12).
  - **Payload Sintético MCP:** Expor métricas sintéticas compactas (`total_items_checked`, `arithmetic_errors_count`, `divergence_sum`) mantendo a resposta estritamente abaixo de 900 bytes (Lei 2).

- [x] **4.4. Diff Estrutural Rápido de Documentos:**
  - Comparação posicional e semântica de seções e títulos com base no `toc_map` entre versões sucessivas de minutas e editais retificados (`state/diff_documental_<stem>.md` e `.json`) com delta do Radar das 14 Zonas (`INTRODUCED`, `RESOLVED`, `RETAINED`).

- [x] **4.5. Patch `v1.1.1` — Hotfix de Sanitização XML BOM, Deduplicação da Raiz e Resiliência Multi-Arquivo:**
  - Sanitização universal de UTF-8 BOM (`\uFEFF`) e whitespaces antes de tags XML no `@xmldom/xmldom`.
  - Movimentação automática e deduplicação de documentos soltos na raiz para `inputs/` sem clonagem de disco e preservando `context.json`.
  - Isolamento `try/catch` por documento em `bootstrap_case` com inventário probatório de 100% dos insumos no `indice_mestre_caso.md`.

---

## 🎯 MARCO 5 — `v1.2.0`: Segurança Supply-Chain, Engenharia Tabular/Planilhas e Pipeline OCR Headless

- [x] **5.1. Segurança de Supply-Chain, `.env` Fallback e Checksum `SHA-256` no `--update`:**
  - **Autenticação Híbrida e Transparente no Auto-Updater:** Suporte nativo à leitura automática de variável de ambiente (`DOCGOV_GITHUB_TOKEN` ou `GH_TOKEN`) com fallback gracioso para arquivo `.env` local na raiz da aplicação, permitindo que as rotinas de auto-atualização (`--update`, `--check-update`, `--force-update`) operem de modo transparente tanto em repositório público quanto privado sem necessidade de alteração de código ou flags manuais.
  - **Validação Criptográfica de Integridade (`SHA256SUMS.txt`):** Download e conferência estrita do checksum SHA-256 antes da substituição do binário em disco, impedindo atualizações corrompidas ou adulteradas em trânsito.

- [x] **5.2. Engenharia Tabular Avançada Multi-Página & Ingestão Nativa de Planilhas (`.xlsx` / `.csv`):**
  - **Fusão Contínua de Cabeçalhos:** Detectar continuidade de tabelas que se estendem por múltiplas páginas consecutivas com repetição de cabeçalho.
  - **Resolução de Células Multilinha:** Agrupar linhas textuais pertencentes à mesma célula lógica, prevenindo o desalinhamento de colunas em descrições extensas de itens.
  - **Células Mescladas (`rowspan` / `colspan`):** Normalizar matrizes tabulares no espelho de leitura linear e no JSON estrutural.
  - **Ingestão Nativa de Planilhas Orçamentárias (`.xlsx` e `.csv`):** Suporte nativo à leitura direta de planilhas de insumo em `inspect_doc` e `bootstrap_case`, integrando-as diretamente ao `budget_auditor.ts` (cálculo em centavos inteiros nas zonas `Z10` e `Z12`).

- [x] **5.3. Pipeline OCR Headless para PDFs Escaneados (`Scanned Trap` $\rightarrow$ OCR Automático):**
  - **Detecção e Fallback Silencioso:** Quando o detector de páginas escaneadas sinalizar páginas sem camada de texto (`scanned_pages_detected > 0`), acionar pipeline determinístico de OCR vetorial.
  - **Arquitetura Desacoplada e Standalone:** Implementar engine leve baseada em WASM ou binário utilitário encapsulado, sem exigir dependências externas pesadas no sistema operacional host.
  - **Geração de Coordenadas Homogêneas:** Injetar o texto reconhecido pelo OCR diretamente na cartografia linear `[PAG_XXX | LYYYY]`, permitindo que o Radar das 14 Zonas examine documentos escaneados com o mesmo fluxo determinístico de PDFs digitais.

- [x] **5.4. Geração Parametrizada de Matriz de Risco e Checklist de Conformidade:**
  - Emissão estruturada de Matrizes de Risco e Checklist de Conformidade em Word (`.docx`) e PDF via `generate_audit_docx`, com cruzamento automático da jurisprudência de órgãos de controle federal (TCU, AGU e MGI).

---

## 🎯 MARCO 6 — `v1.3.0`: Motor de Diff Semântico, Evolução de Cláusulas e Nota Técnica Comparativa Padronizada

- [x] **6.1. Mapeamento de Evolução de Cláusulas e Histórico Cirúrgico ("Antes vs. Depois"):**
  - Registro estruturado do ciclo de vida de alterações em slots e cláusulas durante o saneamento documental:
    - *Slot ID / Coordenada da Cláusula;*
    - *Redação Anterior (Original);*
    - *Nova Redação Saneadora;*
    - *Fundamentação Técnica e Justificativa Jurídica (Artigos da Lei 14.133/2021, Jurisprudência TCU, Pareceres AGU).*
  - Cálculo de diff semântico e granular de texto (inserções, supressões e substituições parciais) com marcação visual clara (`[+]` / `[-]`).

- [x] **6.2. Geração da Nota Técnica Comparativa Padronizada (`.docx` e `.pdf`):**
  - Emissão automatizada em `output/Nota_Tecnica_Evolucao_<Artefato>.docx` e `.pdf` contendo o quadro de alterações e a justificativa motivada.
  - Layout formal de alta fidelidade visual para instrução de processo administrativo, submissão à Procuradoria / Consultoria Jurídica e órgãos de Controle Interno.
  - Suporte completo via CLI (`docgov-engine --diff-report ...`) e ferramenta MCP especializada, alimentando nativamente o Workbench Mode do ecossistema consumidor.

- [x] **6.3. Patch `v1.3.1` — Resiliência de Caminhos MCP (Lei 6), Inspeção Linear MD/TXT e Anti-JSZip:**
  - Resolução canônica de caminhos `resolveWorkspacePath` desacoplada do CWD da IDE consumidora (`AppData/Local/Programs/antigravity`), garantindo integridade de caminhos relativos `"cases/..."`.
  - Suporte nativo à inspeção linear de minutas e despachos em Markdown e Texto Puro (`.md` e `.txt`) gerando visão de auditoria e dossiê com Radar Z1..Z14.
  - Prevenção do erro críptico do JSZip através de guardrail de verificação de magic bytes (`isZipBuffer`) e mensagens instrutivas apontando para `.user_uploaded`.

- [x] **6.4. Patch `v1.3.2` — Blindagem de Governança, Resolução de Paths Locais e Otimização do Teto MCP:**
  - Guardrail de segurança ativa no `bootstrap_case` prevenindo inicialização acidental na raiz de repositórios Git, associado a denylist estrita de governança (`AGENTS.md`, `README.md`, `CHANGELOG.md`, `ROADMAP.md`, locks e configs) e descarte de extensões de código/script (`.ts`, `.py`, etc.).
  - Preservação estrita de `process.cwd()` em `resolveWorkspacePath` para `.` e caminhos relativos locais (`./uploads`, `inputs/minuta.docx`) fora de pastas de IDE.
  - Eliminação da concorrência redundante `docxPath`/`filePath` em `inspect_doc`, encurtamento protetivo de caminhos longos (`toShortDocPath`) e poda progressiva mantendo payload sintético estritamente abaixo de 900 bytes (Lei 2).
  - Orquestrador consolidado de build `bun run build:all` sincronizando binários, checksums SHA-256 e especificação técnica em um único comando.

- [x] **6.5. Patch `v1.3.3` — Classificador Estrutural libmagic msooxml e Descompactação Automática de Pacotes no bootstrap_case:**
  - Classificador determinístico de formatos inspirado na regra `msooxml` do Linux `file(1)` / `libmagic`, diferenciando com precisão containers ZIP de documentos Office (`.docx`, `.xlsx`, `.pptx`, `.odt`, `.ods`) de arquivos compactados de usuário comuns (`.zip`).
  - Suporte completo a POSIX TAR (`.tar`) e GZIP (`.tar.gz`, `.tgz`), além de detecção amigável de formatos compactados proprietários (`.7z`, `.rar`).
  - Descompactação automática e transparente em `bootstrap_case` para pacotes em `uploadsDir`, na raiz de `caseDir` e em `inputs/`, com proteção Anti-Zip Slip, achatamento de subpastas, filtragem de lixo de sistema (`__MACOSX`, `.DS_Store`, `Thumbs.db`) e guardrail de Zip Bomb.
  - Relatório consolidado no `state/indice_mestre_caso.md` e guardrail fail-fast em `inspect_doc` orientando o uso de `bootstrap_case` para pacotes compactados.

- [x] **6.6. Patch `v1.3.4` — Conector Nativo PNCP (`fetch_pncp`) com Isolamento em Subpasta e Catalogação de Referência:**
  - 7ª Ferramenta MCP e CLI `--fetch-pncp` para ingestão determinística e sem consumo de tokens de minutas e arquivos públicos de contratações do PNCP.
  - Parsing universal e tolerante de identificadores PNCP nos 3 formatos (Número de controle, URLs web/REST e tupla CNPJ/ANO/SEQUENCIAL) com fail-fast e Exact Copy-Paste Error (Lei 3).
  - Isolamento físico estrito em subpasta dedicada (`cases/<slug>/inputs/pncp_<shortname>/`) prevenindo contaminação com minutas do caso sob auditoria.
  - Descompactação automática de arquivos compactados baixados via classificador `libmagic msooxml`.
  - Catalogação estrutural em memória para benchmarking/pesquisa de mercado com supressão de arquivos de auditoria em `state/` (sem Radar 14 zonas e sem dossiês externos por padrão), gerando `state/indice_pncp_<shortname>.md` e `state/pncp_<shortname>_meta.json`.
  - Flag `skipAuditArtifacts` em `inspectDocx` e payload sintético conciso estritamente abaixo do teto MCP (< 900 bytes — Lei 2).

- [x] **6.7. Patch `v1.3.5` — Busca Textual Multi-Query no PNCP (`search_pncp`) e Resolvedor de Redirects:**
  - 8ª Ferramenta MCP e CLI `--search-pncp` para descoberta de editais e contratações de referência na API pública `/api/search/` do PNCP.
  - Suporte nativo a multi-query paralela (`"termo1 | termo2"`), desduplicação automática por `CNPJ/ANO/SEQUENCIAL`, filtros de `status`, `uf` e `modalidade`.
  - Acumulação transparente no caso em `state/pncp_search_results.json` e painel legível em `state/pncp_search_results.md` com o Objeto Completo de cada certame.
  - Resolvedor nativo de redirects HTTP (`resolvePncpRedirectUrl`) em `fetch_pncp` e `search_pncp` para extração automática de identificadores de links opacos do Google Grounding (`vertexaisearch.cloud.google.com/grounding-api-redirect/...`).
  - Padrão Exact Copy-Paste Error (`createPncpSearchContractError`) e payload sintético otimizado com poda progressiva (< 900 bytes — Lei 2).

- [x] **6.8. Patch `v1.3.6` — Correção Estrutural de Engenharia Tabular e Template Matching (`ENG-01` a `ENG-05`):**
  - Fim da fusão horizontal de colunas em `loop_table_rows` (19 para 38 colunas) isolando tags em linhas `<w:tr>` dedicadas e preservando `<w:vMerge/>` em `C0`.
  - Alinhamento de coordenadas físicas `<w:tc>` vs. virtuais de `gridSpan` em `toc_map.form_fields` e fallback automático em `replace_table_cells`.
  - Fail-fast estrito contra excesso de `cell_tags` com auto-alinhamento se `C0` for `vMerge`.
  - Normalização de `vMerge` e `gridSpan` no fingerprint estrutural e relato do candidato de maior similaridade em `status: "NEW"`.
  - Exibição de `template_match` e `form_fields` no Bloco 1 da `visao_auditoria_*.md` e execução bottom-up em `build_docx_template`.

- [x] **6.9. Patch `v1.3.7` — Conversor de Tabelas Markdown para OpenXML `<w:tbl>`, Operador `remove_table_rows`, Scanner Anti-Contaminação e Normalização NFC (`ENG-06` a `ENG-09`):**
  - Conversão nativa automática de tabelas Markdown (`| Col1 | Col2 |\n| :--- | :--- |`) em elementos OpenXML `<w:tbl>` reais em `fill_docx_template` com `<w:tblGrid>`, bordas corporativas, cabeçalho sombreado, alinhamentos por coluna e `<w:p/>` final em células `<w:tc>`.
  - Operador declarativo `remove_table_rows` em `slots_manifest.json` executado em ordem Bottom-Up com preservação e promoção automática de `<w:vMerge w:val="restart"/>`.
  - Detecção automática de subtabelas de itens numerados (`1..N`) e grupos de checkboxes (`☒ Sim` / `☐ Não`) com coordenadas físicas no Bloco 1 da `visao_auditoria_*.md`.
  - Scanner pós-compilação (`scanPostCompileIntegrityAlerts`) alertando sobre workarounds `"Item não aplicável"`, tabelas Markdown residuais, checkboxes contraditórios e contaminação semântica de doador de Hardware em contratações puras de Software/Serviços (sem falsos-positivos em contratações mistas).
  - Normalização universal Unicode `NFC` e lookup resiliente `NFC/NFD` (`resolveExistingPathNfc`) em `bootstrap_case`, `inspect_doc` e utilitários de arquivos.

- [x] **6.10. Patch `v1.3.8` — Guardrail de Escopo DocGov com %TEMP% Efêmero, Redirecionamento Geométrico C1->C2, Heading Guard e Detector de Órfãos (`ENG-10` a `ENG-13`):**
  - Validador canônico `assertDocGovCaseScope` bloqueando fail-fast as 6 ferramentas de processo (`bootstrap_case`, `build_docx_template`, `fill_docx_template`, `generate_audit_docx`, `generate_technical_note_docx`, `fetch_pncp`) fora de árvores de caso DocGov.
  - Isolamento de exploração em `%TEMP%/docgov_ephemeral_inspect/` para `inspect_doc` e `search_pncp` sem tocar pastas externas do usuário.
  - Auto-redirecionamento geométrico C1->C2 em colunas de checkbox (`☒ Sim.` em C1 e `{{tag}}`/texto discursivo longo em C2).
  - Heading Guard em `replace_paragraphs` preservando títulos de seção (`1. OBJETO`) intactos no Word quando `start_p` aponta para cabeçalho.
  - Saneamento de `<w:numPr>` herdado, descarte de linhas vazias, espaçamento vertical `<w:spacing w:after="120"/>` e sequenciamento contínuo em listas decimais simples consecutivas (1. -> 2. -> 3.).
  - Scanner pós-compilação detectando contaminação parcial de unidades físicas em linhas de software (`PARTIAL_ITEM_ROW_CONTAMINATION`) e linhas de total desatualizadas ou zeradas (`UNCALCULATED_TOTAL_ROW`).

- [x] **6.11. Patch `v1.3.9` — Reancoragem de Prefixos Multinível, Injeção Literal e Scanner de Anomalias (`ENG-14` e `ENG-15`):**
  - Parent Section Prefix Resolver (`ENG-14a`): rastreamento contextual do prefixo da seção ativa (`activeSectionPrefix`) no `<w:body>` resolvendo títulos literais e via numbering.xml, com reancoragem automática de itens multinível relativos (1.1, 1.2, 1.1.1) para seções 4.4, 5.1, 5.2, 6, etc.
  - Prevenção determinística de colisão com subseções irmãs: mapeamento de títulos fixos existentes no template (`existingSectionPrefixes`) convertendo itens conflitantes em Bullet '• ' estilizado com hanging indent (ex.: introdução da Seção 2).
  - Injeção literal determinística com Hanging Indent (`ENG-14b`): cláusulas multi-decimais utilizam injeção literal no primeiro run `<w:t>` com `<w:tab/>`, `<w:spacing w:after="120"/>` e recuo estático, eliminando nós `<w:numPr>` órfãos e erradicando o reset do Word para 1.1/1.1.1.
  - Scanners de anomalia pós-compilação (`ENG-15`): `MULTILEVEL_NUMBERING_RESET` (alertando sobre itens 1.1 sob seções >= 2) e `DUPLICATE_CONFLICTING_SLA_TABLES` (alertando sobre tabelas distintas de SLA de chamados com prazos divergentes para Severidade 1 herdadas do modelo doador).

- [x] **6.12. Patch `v1.3.10` — Decomposição Modular, Teto de 500 Linhas e Instituição da Lei 9 de Economia de Tokens:**
  - Decomposição pura dos monólitos `fill_template.ts` e `inspect.ts` em submódulos coesos em subdiretórios de domínio (`src/tools/openxml/` e `src/tools/inspect/`) com zero alteração funcional.
  - Teto físico estrito de 500 linhas por arquivo em 100% dos arquivos TypeScript de `src/`, com re-exports retrocompatíveis nas raízes de ferramentas.
  - Instituição da **Lei 9 de Governança no Estatuto (`AGENTS.md`)**: Modularidade Estrita, Teto de 500 Linhas e Economia de Tokens (inspeção cirúrgica com `read_file` delimitado e testes direcionados).

- [x] **6.13. Patch `v1.3.11` — Herança Nativa de `<w:numPr>`, Fim do Bug de Pré-Varredura e Scanner Top-Down (`ENG-16`):**
  - Herança prioritária de `<w:numPr>` (`numId`, `ilvl`) na árvore de numeração nativa do template doador, preservando o sequenciamento contínuo das 19 seções do Word e impedindo reset espúrio para 1.
  - Limpeza de prefixos literais duplicados em `<w:t>` ao herdar numeração nativa, com preservação de subtítulos intermediários em negrito sem nó `<w:numPr>`.
  - Separação mandatória entre `preScanResolver` e `numberingResolver` eliminando a contaminação de contadores entre passadas (`10.2.2.` e `10.3.1.1.` na Seção 5).
  - Filtro em `extractSectionHeadingPrefix` garantindo que apenas títulos autênticos atualizem o prefixo de seção pai, e escopo de contador monotônico por parágrafo-slot (`sectionChildCounters`).
  - Scanner de integridade pós-compilação detectando `SECTION_PREFIX_MISMATCH` e números duplicados de cláusula, e refinamento de `UNCALCULATED_TOTAL_ROW` para estimativas sob orçamento sigiloso (RILC Art. 19).

- [x] **6.14. Suíte Online de Testes de Contrato de API (`Live API Smoke & Contract Suite`):**
  - Isolamento estrito de testes de rede fora do `bun test` via `bunfig.toml` (`[test] root = "./test"`).
  - Caderno de testes online do PNCP (`tests_live/pncp_api.live.ts`) com 6 sondas de rede reais cobrindo busca textual, filtros de UF/status, lookup direto de compra, rota de arquivos, download binário E2E de editais/anexos e resolução de URLs.
  - Caderno de testes online do GitHub Updater (`tests_live/github_updater.live.ts`) com 3 sondas cobrindo consulta à API de releases, checagem lógica de novas versões e download de `SHA256SUMS.txt`.
  - Runner central CLI (`scripts/run_live_tests.ts`) com atalhos `bun run test:live`, `test:live:pncp`, `test:live:updater` e workflow GitHub Actions com agendamento semanal e disparo manual (`live_api_smoke.yml`).

---

## 🎯 MARCO 7 — `v1.4.0`: Motor Determinístico Sob Demanda de Pesquisa, Validação e Fatiamento Anatômico de Jurisprudência (TCU, TCEs & Ponte Lei 13.303/2016 $\leftrightarrow$ Lei 14.133/2021)

- [ ] **7.1. 9ª Ferramenta MCP `search_juris` (CLI `--search-juris`) — Busca Multi-Query e Estágio 1 do Funil (Triagem Rápida por `Cabeçalho + Ementa + Dispositivo` & Ranking `0..100 pts`):**
  - Ferramenta de acionamento sob demanda (ideal para Co-Autoria/Workbench Mode e Pesquisa Jurídica Livre, sem obrigatoriedade de execução automática no pipeline padrão).
  - Integração nativa com os endpoints públicos REST do TCU (`pesquisa.apps.tcu.gov.br/rest/publico/base/jurisprudencia-selecionada`, `/acordao-completo` e `/publicacoes`), suportando múltiplas queries em paralelo separadas por `|` (`Promise.all`), filtros por colegiado (`Plenário`, `1ª Câmara`, `2ª Câmara`), ano e foco em Estatais (`Lei 13.303/2016`) ou Administração Direta (`Lei 14.133/2021`).
  - **Ficha de Triagem Rápida (Estágio 1 do Funil — Sem Download de Textos Longos):** Em vez de baixar textos longos na busca inicial, `search_juris` extrai para cada *hit* a Ficha de Triagem Rápida composta por:
    1. *Cabeçalho & Perfil:* Tribunal, Colegiado (`Plenário` vs `Câmara`), Número/Ano, Processo, Relator, Data da Sessão, Entidade Julgada e Regime Legal (`Lei 13.303/2016` vs `Lei 14.133/2021`);
    2. *Ementa Completa:* Indexação/Titulação (tags em caixa alta) + Enunciado/Tese jurídica fixada;
    3. *Dispositivo / Desfecho:* Síntese do comando decisório (Procedente, Improcedente, Cautelar Deferida/Negada, Anulação, Determinação ou Ciência/Recomendação).
  - **Motor de Ranking de Relevância (`relevance_score: 0..100 pts`):** Ordenação automática determinística dos *hits* em `state/juris_search_results.md` e `.json` combinando 5 pesos:
    - *(a) Aderência Léxica na Ementa/Tese (`0..35 pts`)*;
    - *(b) Alinhamento Tático do Dispositivo com o `stance` (`0..25 pts`):* Em `stance: "DEFENSE"`, pontua mais alto quando o dispositivo julga a representação improcedente, nega cautelar ou mantém o certame; em `stance: "ATTACK"`, pontua mais alto quando suspende cautelarmente, anula ou expede determinação corretiva;
    - *(c) Afinidade de Regime Jurídico (`0..20 pts`):* Bônus para mesma lei de regência (`Lei 13.303/2016` em estatais) ou equivalência direta na matriz `Statutory Bridge`;
    - *(d) Peso do Colegiado e Quórum (`0..10 pts`):* `Plenário / Unânime` > `Câmaras / Maioria`;
    - *(e) Contemporaneidade (`0..10 pts`):* Prioridade para julgados recentes (2021–2026).
  - **Seleção Explícita de Escopo (`courts` e `uf`):** Suporte aos parâmetros opcionais `courts` (ex.: `["TCU", "STJ", "STF", "TCE-PA"]`) e `uf` (ex.: `"PA"`, `"CE"`, `"DF"`). Quando nenhum estado ou tribunal específico for solicitado, pesquisa por padrão apenas na camada nacional (`TCU`, e opcionalmente `STJ`/`STF`), evitando varreduras desnecessárias e lentas em todos os estados.
  - **Suporte a Pesquisa Livre (`Standalone`):** Quando acionada dentro de um caso, grava em `cases/<slug>/state/juris_search_results.json` e `.md`; quando acionada em pesquisa livre fora de `cases/<slug>` (`caseDir` omitido ou externo), faz parte da *whitelist* do Guardrail de Escopo (`ENG-10`), gravando automaticamente em `%TEMP%/docgov_ephemeral_inspect/` sem poluir diretórios do usuário (com retorno sintético MCP $< 900$ bytes).

- [ ] **7.2. Matriz Determinística de Equivalência Normativa (`Statutory Bridge: Lei 13.303/2016 + RILC <-> Lei 14.133/2021`):**
  - Expansor léxico-normativo embutido em `search_juris` que mapeia automaticamente os institutos da Lei das Estatais (`Lei 13.303/2016`, arts. 28 a 84) para seus correlatos na `Lei 14.133/2021` e Súmulas do TCU (`247`, `255`, `263`, `269`, `270`), destacando precedentes específicos de empresas estatais de TI (Serpro, Dataprev, BB Tecnologia, Petrobras, Prodepa, Proderj, etc.) e preservando as prerrogativas empresariais próprias da Lei 13.303/16 (como orçamento nativamente sigiloso do Art. 34 e vigência quinquenal direta do Art. 71).

- [ ] **7.3. 10ª Ferramenta MCP `fetch_juris` (CLI `--fetch-juris`) — Estágios 2 e 3 do Funil (Fatiador Anatômico em 6 Macro-Partes / 10 Sub-Camadas + Inteiro Teor Estruturado):**
  - Recebe o identificador de um acórdão (ex.: `"Acórdão 1234/2024-TCU-Plenário"` ou URL/ID de TCE estadual), verifica sua existência real na base oficial (bloqueando citações alucinadas por LLM) e baixa o inteiro teor isolado em `cases/<slug>/inputs/juris_<shortname>/` (ou em `%TEMP%/docgov_ephemeral_inspect/` em modo de pesquisa livre).
  - **Fatiador Anatômico Avançado (`AnatomicalSlicer` — 6 Macro-Partes / 10 Sub-Camadas com `Topic-Aware Windowing`):** Decompõe os acórdãos selecionados nas 6 macro-partes clássicas desdobradas em 10 sub-camadas semânticas com fatiamento interno por tópico:
    - **1. Cabeçalho:** `1A. Metadados & Jurisdição` | `1B. Perfil da Entidade & Regime Legal (13.303 vs 14.133)`;
    - **2. Ementa:** `2A. Indexação / Titulação (Tags)` | `2B. Enunciado / Sumário (Tese Fixada)`;
    - **3. Relatório (Fatiado por Tópico `I, II, III...`):** `3A. Alegações / Controvérsia Fática` | `3B. Argumentos de Defesa do Gestor/Órgão` | `3C. Análise Técnica da Unidade Especializada (AudTI / Sefti / Engenharia)`;
    - **4. Fundamentação (Voto / Motivação):** `4A. Ratio Decidendi & Distinguishing do Ministro Relator por Tópico`;
    - **5. Dispositivo:** `5A. Comando Decisório e Moduladores (Itens 9.1, 9.2... Procedência, Cautelar, Determinação, Ciência)`;
    - **6. Acórdão (Sentido Estrito / Fecho):** `6A. Quórum de Votação (Unânime vs Maioria), Declarações de Voto e Data da Sessão`.
  - **Dupla Saída Persistida em Disco (`SLICED` + `FULL`):**
    - **Estágio 2 (`state/dossie_juris_<shortname>.md` — Dossiê Fatiado por Tópico):** Contém o índice interno de tópicos do acórdão e as 10 sub-camadas filtradas para o tema da controvérsia, sem poluir a janela de contexto do LLM com dezenas de páginas irrelevantes;
    - **Estágio 3 (`inputs/juris_<shortname>/inteiro_teor_anatomico.md` — Inteiro Teor Limpo e Estruturado):** Preserva 100% do texto integral do acórdão organizado nas 6 macro-partes / 10 camadas (sem ruído de HTML), permitindo ao agente realizar a leitura integral do caso quando o *hit* for positivo (*Leading Case*) para confirmar a aderência fática total ao processo em tela.
  - **Testes Online de Contrato de API (`tests_live/juris_api.live.ts`):** Validação em cadeia autodescoberta (`search_juris` com ranking de Ementa+Dispositivo $\rightarrow$ `fetch_juris` validando as 10 camadas anatômicas e o inteiro teor estruturado).

- [ ] **7.4. Suporte Dual Tático (`stance: "DEFENSE" | "ATTACK" | "BOTH"`) e Compilação Sob Demanda de Contrarrazões Jurídicas ou Impugnação:**
  - Classificação e apoio tático para **Modo Defesa** (precedentes que autorizam a modelagem do gestor ou rebatem parecer jurídico restritivo via *distinguishing*) e **Modo Ataque** (precedentes que suspendem ou anulam cláusulas restritivas de editais nas 14 Zonas).
  - Expansão de `generate_technical_note_docx` / `generate_audit_docx` para compilar, quando solicitado pelo usuário, `Nota_Tecnica_Contrarrazoes_Juridicas.docx/.pdf` (defesa técnica perante Assessoria Jurídica / PGE / Controle Interno) ou `Peca_Impugnacao_Representacao.docx/.pdf` (ataque fundamentado a edital externo).

- [ ] **7.5. Roteador Jurisdicional Modular (`JurisdictionProviderRegistry`) e Degradação Graciosa por UF:**
  - **Seleção Explícita de Escopo (`courts` e `uf`):** `search_juris` deve aceitar os parâmetros opcionais `courts` (ex.: `["TCU", "STJ", "STF", "TCE-PA"]`) e `uf` (ex.: `"PA"`, `"CE"`, `"DF"`). Se nenhum estado for solicitado, pesquisa por padrão apenas na camada nacional (`TCU`, e opcionalmente `STJ`/`STF`), evitando varreduras desnecessárias em todos os estados.
  - **Arquitetura de Conectores Plugáveis (*Adapter Pattern*) — Cobertura Inicial `v1.4.0`:**
    - *Camada Federal / Cortes Superiores:* Conectores nativos para **`TCU`** (Tribunal de Contas da União), **`STJ`** (Superior Tribunal de Justiça) e **`STF`** (Supremo Tribunal Federal);
    - *Camada Estadual (Primeira Onda de TCEs):* Conectores nativos dedicados para os Tribunais de Contas de **`PA` (`TCE-PA`)**, **`CE` (`TCE-CE`)** e **`DF` (`TCDF`)**.
  - **Degradação Graciosa (*Graceful Fallback*) para UFs Não Implementadas (Zero Travamento):**
    - Caso o agente ou usuário solicite pesquisa em uma `uf` cujo conector estadual ainda não esteja implementado no binário (ex.: `uf: "AM"` ou `"PR"`), o motor **JAMAIS deve falhar ou abortar a execução**: deve executar normalmente a pesquisa na camada federal (`TCU`/`STJ`/`STF`) e retornar no payload sintético MCP e no cabeçalho de `juris_search_results.md` o bloco `jurisdiction_routing: { executed_courts, unimplemented_uf_requested, supported_ufs: ["PA", "CE", "DF"], fallback_notice }`, permitindo que o agente dê feedback claro ao usuário sem interromper o trabalho.

---

## 🎯 MARCO 8 — `v1.5.0`: Núcleo de Auditoria e Fiscalização Contratual Contínua, Aditivos 25%/50% e Validação Tripartite

- [ ] **8.1. Ingestão e Mapeamento de Contratos e Termos Aditivos:**
  - Cartografia pericial de instrumentos contratuais, vigências, garantias e termos aditivos de acréscimo/supressão.
  - Cálculo determinístico de limites legais de aditamento (25% para compras/serviços e 50% para reformas, conforme Lei nº 14.133/2021).

- [ ] **8.2. Motor de Validação Cruzada Tripartite (Edital $\leftrightarrow$ Proposta Vencedora $\leftrightarrow$ Contrato):**
  - Verificação automatizada de conformidade entre os itens exigidos no Termo de Referência, os preços cotados na proposta classificada e as cláusulas pactuadas no contrato administrativo.
  - Detecção de desvios de objeto, itens suprimidos sem amparo e divergências de especificação técnica.

- [ ] **8.3. Monitoramento e Histórico de Reajustes / Repactuações:**
  - Rastreamento de índices inflacionários contratuais (IPCA, INPC, IGP-M) e memória de cálculo de repactuação de mão de obra exclusiva.

---

## 🎯 VISÃO DE LONGO PRAZO / `v2.0.0`: Major Release Condicional (Breaking Changes Reais)

- Reservado estritamente para o momento em que houver **Breaking Changes** reais na API pública ou no protocolo MCP (ex.: redefinição arquitetural do padrão de ferramentas, quebra de contratos de slots ou descontinuação de comandos centrais), em estrita conformidade com o SemVer.
- Até que haja necessidade de quebra de compatibilidade retroativa, todas as evoluções funcionais continuam sendo entregues de forma incremental e aditiva na série `v1.x`.

---

## 🛡️ Estatuto de Governança para Agentes IA

Todo desenvolvimento e evolução dos marcos acima deve respeitar estritamente as **9 Leis Invioláveis de Engenharia** descritas no [`AGENTS.md`](AGENTS.md):
1. **Runtime Bun & Portabilidade:** Sem caminhos locais absolutos.
2. **Teto de Payload MCP (< 1024 bytes):** Margem segura recomendada `< 900 bytes`.
3. **Exact Copy-Paste Error:** Fail-fast com snippet de autocorreção imediata.
4. **Sincronia Obrigatória de Self-Discovery:** `--dump-spec`, `DOCX_ENGINE_INSTRUCTIONS` e documentação unificados.
5. **Neutralidade Institucional Absoluta:** Exclusivamente identificadores genéricos ou federais universais (`ORGAO_CONTRATANTE`, `MUNICIPIO_GENERICO`, `AGU`, `MGI`, `TCU`).
6. **Resiliência de Caminhos e Cache Global:** Resolução desacoplada de `process.cwd()`.
7. **Ritual de Qualidade e Release Automatizada:** Autodescoberta de esteira CI/CD externa, gatilho canônico por tag Git e proibição estrita de upload manual de binários locais.
8. **Disciplina Autônoma de Micro-Commits & Memória:** Fatiamento em commits atômicos, testes por commit e sincronia contínua de `CHANGELOG.md` e `ROADMAP.md`.
9. **Modularidade Estrita, Teto de 500 Linhas e Economia de Tokens:** Arquivos $\le 500$ linhas, submódulos coesos de domínio, inspeção cirúrgica por faixas de linha e testes restritos durante micro-commits.
