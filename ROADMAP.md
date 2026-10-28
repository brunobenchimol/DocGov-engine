# 🗺️ ROADMAP OFICIAL — `docgov-engine` (v1.1.x+)

> **Memória Histórica:** Para o histórico consolidado de versões desde o commit inicial (`v0.0.1`) até o lançamento principal (`v1.0.0 — Clean Cut`) e releases consolidadas, consulte o [CHANGELOG.md](CHANGELOG.md).
> **Propósito deste Documento:** Fonte única da verdade sobre o planejamento arquitetural, evoluções funcionais e marcos estratégicos futuros do motor (`v1.1.x+`).
> **Natureza Standalone & Desacoplada:** O `docgov-engine` é um motor autônomo e determinístico. Embora sirva como fundação para a camada de agentes do ecossistema `docgov`, ele possui ciclo próprio de evolução e pode ser utilizado de forma independente via CLI ou MCP por qualquer cliente, agente de IA ou pipeline automatizado.
> **Política de Versionamento Pareado (Lockstep `Major.Minor` com o repositório `DocGov`):**
> O par `Major.Minor` (`1.2.x`, `1.3.x`, `1.4.x`) caminha em estrita sincronia funcional com o repositório irmão `DocGov`, agrupando conjuntos densos de funcionalidades por geração. Evoluções incrementais, hotfixes e melhorias internas de robustez utilizam exclusivamente o dígito `Patch` (`.x`), evitando inflação desnecessária de números de versão e assegurando previsibilidade arquitetural entre a engine e a camada de agentes.
> **Regra para Agentes IA:** Sempre consulte e atualize os checkboxes (`[x]` / `[ ]`) deste `ROADMAP.md` ao planejar ou concluir cada marco evolutivo.

---

### 📊 Matriz de Gerações Pareadas (Lockstep DocGov $\leftrightarrow$ docgov-engine)

| Geração | Versão Pareada | Foco Funcional Estratégico no Motor |
| :--- | :--- | :--- |
| **Geração 1** | `v1.1.x` | Auditoria Matemática de Planilhas (`Z10`/`Z12`), Diff Estrutural e Resiliência Multi-Arquivo |
| **Geração 2** | `v1.2.x` | Segurança Supply-Chain, Ingestão de `.xlsx`/`.csv`, Tabelas Multi-Página e OCR Headless |
| **Geração 3** | `v1.3.x` | Diff Semântico Granular, Evolução de Cláusulas e Nota Técnica Comparativa Padronizada |
| **Geração 4** | `v1.4.x` | Fiscalização Contratual, Aditivos 25%/50%, Reajustes e Validação Tripartite |
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

---

## 🎯 MARCO 7 — `v1.4.0`: Núcleo de Auditoria e Fiscalização Contratual Contínua, Aditivos 25%/50% e Validação Tripartite

- [ ] **7.1. Ingestão e Mapeamento de Contratos e Termos Aditivos:**
  - Cartografia pericial de instrumentos contratuais, vigências, garantias e termos aditivos de acréscimo/supressão.
  - Cálculo determinístico de limites legais de aditamento (25% para compras/serviços e 50% para reformas, conforme Lei nº 14.133/2021).

- [ ] **7.2. Motor de Validação Cruzada Tripartite (Edital $\leftrightarrow$ Proposta Vencedora $\leftrightarrow$ Contrato):**
  - Verificação automatizada de conformidade entre os itens exigidos no Termo de Referência, os preços cotados na proposta classificada e as cláusulas pactuadas no contrato administrativo.
  - Detecção de desvios de objeto, itens suprimidos sem amparo e divergências de especificação técnica.

- [ ] **7.3. Monitoramento e Histórico de Reajustes / Repactuações:**
  - Rastreamento de índices inflacionários contratuais (IPCA, INPC, IGP-M) e memória de cálculo de repactuação de mão de obra exclusiva.

---

## 🎯 VISÃO DE LONGO PRAZO / `v2.0.0`: Major Release Condicional (Breaking Changes Reais)

- Reservado estritamente para o momento em que houver **Breaking Changes** reais na API pública ou no protocolo MCP (ex.: redefinição arquitetural do padrão de ferramentas, quebra de contratos de slots ou descontinuação de comandos centrais), em estrita conformidade com o SemVer.
- Até que haja necessidade de quebra de compatibilidade retroativa, todas as evoluções funcionais continuam sendo entregues de forma incremental e aditiva na série `v1.x`.

---

## 🛡️ Estatuto de Governança para Agentes IA

Todo desenvolvimento e evolução dos marcos acima deve respeitar estritamente as **8 Leis Invioláveis de Engenharia** descritas no [`AGENTS.md`](AGENTS.md):
1. **Runtime Bun & Portabilidade:** Sem caminhos locais absolutos.
2. **Teto de Payload MCP (< 1024 bytes):** Margem segura recomendada `< 900 bytes`.
3. **Exact Copy-Paste Error:** Fail-fast com snippet de autocorreção imediata.
4. **Sincronia Obrigatória de Self-Discovery:** `--dump-spec`, `DOCX_ENGINE_INSTRUCTIONS` e documentação unificados.
5. **Neutralidade Institucional Absoluta:** Exclusivamente identificadores genéricos ou federais universais (`ORGAO_CONTRATANTE`, `MUNICIPIO_GENERICO`, `AGU`, `MGI`, `TCU`).
6. **Resiliência de Caminhos e Cache Global:** Resolução desacoplada de `process.cwd()`.
7. **Ritual de Qualidade e Release Automatizada:** Autodescoberta de esteira CI/CD externa, gatilho canônico por tag Git e proibição estrita de upload manual de binários locais.
8. **Disciplina Autônoma de Micro-Commits & Memória:** Fatiamento em commits atômicos, testes por commit e sincronia contínua de `CHANGELOG.md` e `ROADMAP.md`.
