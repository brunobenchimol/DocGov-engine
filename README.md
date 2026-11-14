# docgov-engine — Motor Standalone Determinístico & Servidor MCP (v1.5.6)

[![Continuous Integration](https://github.com/brunobenchimol/DocGov-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/brunobenchimol/DocGov-engine/actions/workflows/ci.yml)
[![Live API Contract Smoke Tests](https://github.com/brunobenchimol/DocGov-engine/actions/workflows/live_api_smoke.yml/badge.svg)](https://github.com/brunobenchimol/DocGov-engine/actions/workflows/live_api_smoke.yml)

Motor unificado para o **ciclo completo de documentos Microsoft Word (`.docx`), planilhas (`.xlsx`/`.csv`), minutas e notas técnicas em Markdown/Texto (`.md`/`.txt`) e engenharia reversa/cartografia/auditoria determinística de Editais, Termos de Referência e anexos em PDF (`.pdf`)**, além de servidor **Model Context Protocol (MCP)** via `stdio`, projetado para o ecossistema **DocGov** e compatível com qualquer agente de IA (Google Antigravity, Claude Code, Claude Desktop, Cursor, VS Code Copilot e Windsurf).

Compilado em **binário standalone** (Windows `x64` e Linux `x64`) via Bun — não requer Node.js, Bun ou interpretadores externos instalados na máquina do usuário final.

---

## 1. Instalação Rápida e Auto-Atualização

### Instalação Automática em 1 Linha (Recomendado)

#### Windows (PowerShell)
Instala o binário em `$env:LOCALAPPDATA\docgov\bin\docgov-engine.exe`, valida a integridade do arquivo (> 50 MB), testa `--version` e exibe o snippet pronto para MCP:
```powershell
irm https://raw.githubusercontent.com/brunobenchimol/DocGov-engine/main/scripts/install.ps1 | iex
```

#### Linux / WSL (Bash)
Instala o binário em `~/.docgov/bin/docgov-engine`, concede permissão de execução, valida a versão e orienta sobre o PATH:
```bash
curl -fsSL https://raw.githubusercontent.com/brunobenchimol/DocGov-engine/main/scripts/install.sh | bash
```

---

### Download Manual Direto (Alternativa)

#### Windows (PowerShell)
```powershell
curl.exe -fL "https://github.com/brunobenchimol/DocGov-engine/releases/latest/download/docgov-engine-win-x64.exe" -o docgov-engine.exe
.\docgov-engine.exe -v
```

#### Linux / WSL (Bash)
```bash
curl -fL "https://github.com/brunobenchimol/DocGov-engine/releases/latest/download/docgov-engine-linux-x64" -o docgov-engine
chmod +x docgov-engine
./docgov-engine -v
```

---

### Configuração no Claude Desktop ou Antigravity MCP

Adicione ao seu arquivo de configuração MCP (`claude_desktop_config.json` ou similar):

#### Windows
```json
{
  "mcpServers": {
    "docgov-engine": {
      "command": "C:\\caminho\\para\\docgov-engine.exe",
      "args": []
    }
  }
}
```

#### Linux / WSL
```json
{
  "mcpServers": {
    "docgov-engine": {
      "command": "/caminho/para/docgov-engine",
      "args": []
    }
  }
}
```

### Auto-Atualização do Binário (`Self-Update`)
Depois de baixado pela primeira vez, o próprio binário consegue verificar novas releases no GitHub e atualizar a si mesmo:
```powershell
# Verificar se há uma nova versão disponível
./docgov-engine --check-update

# Atualizar automaticamente para a versão mais recente (se houver)
./docgov-engine --update

# Forçar download e reinstalação da última release
./docgov-engine --force-update
```

---

## 2. Destaques da Série `v1.5.x` e `v1.4.x` — Versão Atual `v1.5.6` (Geração 5.6 — PAS Federativo & Dosimetria LINDB Art. 22)

A versão **`v1.5.6`** evolui a **Geração 5 do docgov-engine** sem inflação de ferramentas MCP (mantendo as **12 ferramentas canônicas**), adicionando ao motor `docgov_audit_contract_execution` a suíte **Marco 8.6 (Geração 5.6)**: adequação federativa e jurisdicional do PAS (Estadual, Municipal e Empresas Estatais da Lei 13.303/2016) com resolução determinística do Tribunal de Contas competente (`TCU`, `TCDF`, `TCE-<UF>`, `TCM-<UF>`), remessa obrigatória (`CEIS`, `CNEP`, `PNCP`, `<TCE/TCM>`), validação de competência exclusiva e parecer conclusivo na declaração de inidoneidade (Art. 156, § 6º), e calibragem jurisprudencial da dosimetria ancorada em precedentes e vetores da LINDB Art. 22 com quadros estruturados OpenXML/PDF.

### 🚀 Principais Inovações da Geração 5.6 (`v1.5.6` — Marco 8.6), Geração 5.5 (`v1.5.5` — Marco 8.5) e Geração 5 (`v1.5.0` — Marco 8):
1. **11ª Ferramenta MCP `docgov_audit_contract_execution` & CLI `--audit-contract` (Fiscalização Contratual, Aditivos, Reajustes, PAS Federativo e Dosimetria):**
   - **Adequação Federativa do PAS & Dosimetria LINDB Art. 22 (Marco 8.6):** Alcance territorial estrito do impedimento (Art. 156, § 4º — `[PAS_SANCTION_TERRITORIAL_SCOPE_MISMATCH_BLOCK]`), regime estrito das Estatais `<= 24` meses sem inidoneidade (Art. 83, III Lei 13.303 — `[PAS_STATE_ENTERPRISE_SANCTION_REGIME_MISMATCH_BLOCK]`), competência exclusiva e parecer jurídico conclusivo na inidoneidade (`[PAS_INCOMPETENT_AUTHORITY_FOR_DEBARMENT_BLOCK]`), resolução de `competent_audit_court` e cadastros `CEIS`/`CNEP`/`PNCP`/`TCE-TCM` (`[PAS_EXTERNAL_CONTROL_REGISTRY_OMISSION_ALERT]`), e calibragem jurisprudencial LINDB Art. 22 com detecção de outliers (`[PAS_ARBITRARY_UNANCHORED_DOSIMETRY_ALERT]` e `[PAS_DISPROPORTIONATE_SANCTION_OUTLIER_BLOCK]`).
   - **Limites Legais de Aditamento Sem Compensação:** Cálculo isolado de acréscimos e supressões de 25% (obras, compras e serviços em geral) e 50% (reforma de edifício ou de equipamento) nos termos do Art. 125 da Lei nº 14.133/2021 e Art. 81 da Lei nº 13.303/2016. Vedação matemática absoluta de compensação entre acréscimos e supressões (`[ADDENDUM_COMPENSATION_FORBIDDEN]`).
   - **Consensualidade Obrigatória no Regime das Estatais:** Bloqueio determinístico de alterações unilaterais em empresas estatais sem comprovação de acordo bilateral (`[STATE_ENTERPRISE_UNILATERAL_ADDENDUM_BLOCK]`).
   - **Bloqueio Determinístico de Aditivo em ARP:** Bloqueio mandatório se o instrumento alvo de aditivo quantitativo for diretamente uma Ata de Registro de Preços (`[ILLEGAL_ARP_ADDENDUM_BLOCK]`).
   - **Batimento Cruzado Tripartite e Quadripartite:** Confronto integral `[TR/Edital] <-> [Proposta] <-> [ARP] <-> [Contrato / OS / Fatura]`, detectando sobrepreço unitário/global (`[TRIPARTITE_OVERPRICING_DETECTED]`), desvios de especificação e pagamentos antecipados sem garantia.
   - **Monitoramento de Reajustes e Repactuações:** Validação estrita do interregno mínimo de 12 meses (365 dias) a partir da data-base do orçamento ou da CCT (`[READJUSTMENT_INTERREGNUM_VIOLATION_12M]`).
2. **12ª Ferramenta MCP `docgov_govern_arp` & CLI `--govern-arp` (Governança Determinística de ARP e Caronas):**
   - **Travas matemáticas de carona de 50% individual e 200% global acumulada (o dobro):** Trava individual por item de 50% para órgãos não participantes (`[ARP_INDIVIDUAL_LIMIT_EXCEEDED_50PCT]`) e livro-razão de controle global bloqueando adesões acumuladas que excedam 200% (o dobro) do quantitativo registrado na Ata (`[ARP_GLOBAL_LIMIT_EXCEEDED_200PCT]`), resguardando os quantitativos do órgão gerenciador e participantes.
   - **Matriz de compatibilidade jurídica e federativa:** Verificação de simetria legal entre órgãos (`Lei 14.133` vs `Lei 13.303` — `[ARP_REGIME_ASYMMETRY_BLOCK]`), bloqueio ascendente vedado (União e Estados aderindo a ARP Municipal — Art. 86, § 3º e § 8º da Lei nº 14.133/2021 — `[ARP_FEDERATIVE_ASCENDING_BLOCK]`) e condicionantes de TIC em lote único (`[ARP_ICT_UMBRELLA_LOT_BLOCK]`).
   - **Vigência 12+12 meses e renovação de saldo:** Monitoramento da vigência da ARP (12 meses prorrogáveis por igual período), auditoria de cláusula editalícia e comprovação de vantagem econômica para renovação de saldos no 2º ano (`[ARP_RENEWAL_WITHOUT_EDITAL_CLAUSE_BLOCK]`), e rastreamento do desacoplamento da vigência autônoma de contratos derivados (de até 5 anos / 60 meses).
   - **Compilação nativa OpenXML `.docx`/`.pdf` de ARP:** Geração automatizada de `Nota_Tecnica_Anuencia_ou_Negativa_Adesao_ARP.docx/.pdf` (para o órgão gerenciador) e `Estudo_Tecnico_Vantajosidade_Adesao_ARP.docx/.pdf` (para o órgão aderente).

### 🏛️ Destaques da Geração 4 (`v1.4.x` — 11 Cortes Homologadas & Conectores Plug-and-Play):
1. **9ª Ferramenta MCP `search_juris` & CLI `--search-juris` (Triagem Rápida & Ranking):**
   - Busca textual sob demanda em APIs oficiais de controle externo com suporte a multi-query paralela com separador pipe `|` (`Promise.all`).
   - **Estágio 1 do Funil:** Extrai apenas a Ficha de Triagem Rápida (`Cabeçalho + Ementa + Dispositivo`) sem download antecipado de textos longos.
   - Suporte a execução dentro de casos (`state/juris_search_results.json` e `.md`) ou em modo livre isolado em pasta temporária segura (`%TEMP%/docgov_ephemeral_inspect/`).
   - Retorno sintético MCP conciso estritamente $< 900$ bytes (Lei 2).
2. **Matriz de Equivalência Normativa (`Statutory Bridge: Lei 13.303/16 + RILC <-> Lei 14.133/21`):**
   - 10 eixos normativos canônicos (`SB-01` a `SB-10`) mapeando equivalências entre a Lei das Estatais e a Lei Geral de Licitações (padronização, lote único/indivisibilidade, atestados técnicos, vigência de 5 anos, orçamento sigiloso, etc.).
   - Reconhecimento automático de empresas públicas estratégicas de TI (`Serpro`, `Dataprev`, `BB Tecnologia`, `Petrobras`, etc.) com distinguishing pró-estatais.
3. **Motor de Ranking de Relevância Determinístico (`0..100 pts`):**
   - Ordenação ponderada em 5 dimensões: aderência léxica (`0..35 pts`), alinhamento tático com postura `DEFENSE` ou `ATTACK` (`0..25 pts`), afinidade de regime legal (`0..20 pts`), peso de colegiado/quórum (`0..10 pts`) e contemporaneidade (`0..10 pts`).
4. **10ª Ferramenta MCP `fetch_juris` & CLI `--fetch-juris` (Fatiamento Anatômico e Dossiê):**
   - **Trava Anti-Alucinação Estrita:** Bloqueio mandatório de precedentes fictícios com `[ANTI_HALLUCINATION_BLOCK]`.
   - **Fatiador Anatômico Avançado (`AnatomicalSlicer`):** Decomposição em 6 Macro-Partes e 10 Sub-Camadas semânticas (Cabeçalho, Ementa, Controvérsia Fática, Argumentos de Defesa, Análise da Unidade Técnica AudTI/Sefti, Ratio Decidendi, Dispositivo e Fecho com Quórum).
   - **Saída Dupla:** Dossiê Fatiado por tópico no Estágio 2 (`state/dossie_juris_<shortname>.md`) e Inteiro Teor Estruturado no Estágio 3 (`inputs/juris_<shortname>/inteiro_teor_anatomico.md`).
5. **Arquitetura 100% Plug-and-Play de Provedores (`JurisdictionProviderRegistry`):**
   - Desacoplamento integral de cortes e UFs: novos tribunais são registrados declarativamente com metadados (`tier`, `uf`, `defaultFederal`, `envOverrideKey`, `liveSmokeQuery`, `idPatterns`).
   - Política evolutiva canônica: **1 Conector / UF = 1 Patch Release**.
   - Cortes operacionais ativas: Camada Federal (**TCU**, **STJ**, **STF**, **TST**, **AGU**) e Estadual/Distrital (**TCE-PA**, **TCE-CE**, **TCDF**, **TCE-SP**, **TCE-MG**, **TCE-PR**).
   - **Resiliência Dupla:** Conectores com *Live Primary* (busca em APIs oficiais públicas) e *Catálogo Normativo Curado Local* (Súmulas e Consultas vinculantes determinísticas instantâneas).
   - **Graceful Fallback:** Caso solicitada UF não implementada (ex.: `RJ` ou `RS`), o motor executa automaticamente a camada federal e reporta `unimplemented_uf_requested` no payload sintético sem travar a execução.
6. **Compilador Tático OpenXML (Lockstep C# Assert 29.6):**
   - Compilação sob demanda de Nota de Contrarrazões Jurídicas (`compileDefenseCounterReasoningDocx`) e Peça de Impugnação/Representação (`compileAttackChallengeDocx`) em layout vertical A4 corporativo com zero tabelas `<w:tbl>` e cards com bordas laterais coloridas.
7. **Auto-Discovery Dinâmico e Seletor de Tribunal (`--court=<ID>`) em Live Tests:**
   - Varre dinamicamente todos os conectores registrados no `JurisdictionProviderRegistry` (`bun run test:live:juris`), executando 23 sondas (2 sondas por corte em 11 cortes + 1 de Graceful Fallback) com diagnóstico claro de origem (`[API Live Direta]`, `[Híbrido]`, `[Fallback Curado Local]`), ou permite auditoria cirúrgica de tribunais específicos (`--court=TCE-MG`, `--court=TCE-SP,TCE-MG`, `--court=ALL`).

---

### 🏛️ Pilares de Capacidades do Motor DocGov (Visão Consolidada)

1. **Governança de Casos & Ingestão Multimodal (`bootstrap_case`):**
   - Inicialização padronizada de diretórios (`inputs/`, `state/`, `templates/`, `output/`).
   - Descompactação automática de arquivos compactados (`.zip`, `.tar`, `.tar.gz`, `.tgz`) com classificação `libmagic msooxml`, proteção Anti-Zip Slip e descarte de lixo de sistema (`__MACOSX`, `.DS_Store`).
   - Auto-batismo de uploads anônimos (`media_*`) com nomes semânticos e identificação de extensões via magic bytes (`PK\x03\x04` e `%PDF`).
   - Geração do Índice Mestre do Caso (`state/indice_mestre_caso.md`).
2. **Engenharia Reversa Estrutural & Cartografia Sem IA (`inspect_doc`):**
   - Suporte nativo a `.docx`, `.pdf`, planilhas `.xlsx`/`.csv` e textos `.md`/`.txt`.
   - Cartografia em 3 camadas: `outline_headings`, `page_signals` e **Radar das 14 Zonas de Impugnação (`Z1` a `Z14`)**.
   - Agrupamento no eixo Y e reconstrução de colunas com ` | ` em PDFs, gerando coordenada de leitura `[PAG_XXX | LYYYY]`.
   - Dossiê de Hotspots (`state/dossie_hotspots_<stem>.md`) com contexto cirúrgico de $\pm 12$ linhas nas zonas críticas.
   - Matching 1-para-N contra Cache Global (`core/registry/templates/`) e auto-reancoragem de coordenadas (Auto-Offset).
3. **Auditoria Matemática Orçamentária & Diff Semântico:**
   - Auditoria aritmética em **centavos inteiros (`BigInt`)** de planilhas orçamentárias ($\text{Qtd} \times \text{Unit} = \text{Total}$, subtotais e total geral), integrando divergências às zonas `Z10`/`Z12` (`state/auditoria_orcamentaria_<stem>.json`).
   - Diff semântico granular em nível de token (algoritmo LCS com regex Unicode) entre versões de minutas e editais (`state/diff_documental_<stem>.md`).
4. **Parametrização & Injeção OpenXML de Alta Fidelidade:**
   - `build_docx_template`: criação de templates com coordenadas compactas (`T0.R1.C1`, `P3`, etc.), operador `remove_table_rows` e fail-fast com Exact Copy-Paste Error.
   - `fill_docx_template`: injeção de dados (`{{...}}`, loops, condicionais), conversão nativa de tabelas Markdown para elementos OpenXML `<w:tbl>`, herança nativa de `<w:numPr>` na árvore de numeração, reancoragem contextual de prefixos multinível e exportação híbrida para PDF (Word COM e Pure-JS).
   - `generate_audit_docx` & `generate_technical_note_docx`: relatórios executivos e notas comparativas em layout vertical corrido A4 (zero tabelas `<w:tbl>`).
5. **Conectores Externos Oficiais (PNCP & Jurisprudência):**
   - `fetch_pncp` e `search_pncp`: descoberta e download determinístico de contratações públicas de referência do Portal Nacional de Contratações Públicas (IN SEGES/ME nº 65/2021) com isolamento estrito em subpastas e resolução de redirects.
   - `search_juris` e `fetch_juris`: pesquisa e fatiamento anatômico de julgados em cortes de contas e tribunais superiores (11 cortes homologadas).
6. **Fiscalização Contratual, Aditivos, PAS/ANS-IMR, Cesta de Preços IN 65/2021 e Governança de ARP (Gerações 5 & 5.5):**
   - `docgov_audit_contract_execution`: auditoria de limites de aditamento de 25%/50% sem compensação, consensualidade em estatais, batimento quadripartite, reajustes com interregno de 12 meses, PAS com contraditório mínimo de 15 dias úteis e dosimetria, segregação glosa ANS/IMR vs. multa (`0,5%`–`30%`), notificação de Seguro-Garantia, saneamento estatístico de cesta de preços (`CV <= 25%`), álea extraordinária e compilação OpenXML DOCX/PDF de notificações e pareceres de dosimetria.
   - `docgov_govern_arp`: governança determinística de Atas de Registro de Preços, livro-razão de caronas (50%/200%), compatibilidade jurídica/federativa e compilação de notas técnicas OpenXML.

> ℹ️ **Histórico Completo de Versões Anteriores:** Para a cronologia detalhada de cada marco, patch e correção histórica (da `v0.0.1` à versão atual), consulte o arquivo canônico [`CHANGELOG.md`](CHANGELOG.md).

---

## 3. Autodescoberta, Cache Global e Recursos de Resiliência

O servidor MCP é **100% autodescritivo, autoexplicativo e dotado de inteligência estrutural nativa**:

1. **Rastreabilidade de Versão em Todos os Retornos (`v1.5.6`):** Inclusão mandatória do campo `"engine_version": "1.5.6"` na raiz do payload JSON sintético retornado por todas as 12 ferramentas MCP.
2. **Teto Estrito de Payload MCP ($< 1024$ bytes com margem segura $< 900$ bytes):** Todo retorno de ferramenta via stdio MCP é um JSON sintético conciso, referenciando arquivos detalhados gravados em disco (`state/`).
3. **Resiliência de Diretórios e Zero ENOENT:** Criação recursiva de pastas (`mkdirSync(..., { recursive: true })`) em todas as ferramentas que gravam arquivos (`build_docx_template`, `fill_docx_template`, `generate_audit_docx`, `inspect_doc`, `bootstrap_case`, `fetch_pncp`, `fetch_juris`).
4. **Motor Híbrido de Lista Multinível Nativa:**
   - **Fora de tabelas (`<w:body>`):** Cria ou atualiza `word/numbering.xml` com definição multinível de 9 níveis decimais escalonados (`%1.`, `%1.%2.`, `%1.%2.%3.`), insere `<w:pPr><w:numPr>` com `<w:startOverride>` sincronizado com o capítulo pai e limpa o prefixo numérico literal do `<w:t>`, com herança nativa de `<w:numPr>` da árvore do template sem reset para 1.
   - **Dentro de tabelas (`<w:tc>`):** Aplica *Hanging Indent* estático (`<w:ind w:left w:hanging>` + `<w:tabs>`) separando o marcador numérico literal com `<w:r><w:tab/></w:r>`.
5. **Sanitização de Tags JS e Validação Léxica Precoce:**
   - Auto-normaliza acessos numéricos por ponto (`{{itens.0.qtd}}` $\rightarrow$ `{{itens[0].qtd}}`).
   - Valida precocemente no `build_docx_template` barrando identificadores com hífen ou dígitos iniciais com *Exact Copy-Paste Error*.
   - Desaninha (*unflatten*) chaves planas como `"itens.0.qtd": "10"` em arrays de objetos compatíveis.
6. **Rastreabilidade Temporal do Cache & Retrocompatibilidade Estrita:** Persiste e expõe `created_at`, `updated_at`, `age_days`, `cache_date_status`, `engine_version` e `slots_count` no cache global (`core/registry/templates/`), preservando o `created_at` original em atualizações.
7. **Padrão Exact Copy-Paste Error:** Validação fail-fast estrita em `slots_manifest.json` e `relatorio_auditoria.json`. Em caso de erro de contrato ou `applied_slots_count === 0`, o motor interrompe a execução com a instrução mandatória:
   > *"NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:"*
   acompanhada do snippet JSON canônico completo e pronto para copiar e colar.
8. **Exportação de Especificação Técnica Integral (`--dump-spec`):** Exporta a especificação técnica integral do motor em Markdown (UTF-8) para alinhamento instantâneo com agentes consumidores.
9. **Radar das 14 Zonas de Impugnação (`Z1` a `Z14`):** Varre as linhas de `.pdf` e `.docx` identificando atestados, prazos, garantias, marcas exclusivas, datasheets direcionados, métricas, orçamentos e cruzamento multipeça.
10. **Auto-Inspeção Integrada no Preenchimento:** O `fill_docx_template` executa automaticamente a inspeção estrutural pós-compilação gravando `state/inspecao_<stem>.json` e `state/visao_auditoria_<stem>.md`, dispensando rodar `inspect_doc` novamente.
11. **Auditoria Matemática de Planilhas Orçamentárias:** Realiza a checagem aritmética exata em centavos inteiros ($Qtd \times Unit = Total$, subtotais e total geral) e o cruzamento com menções textuais de valor global no Radar `Z10`/`Z12`, persistindo `state/auditoria_orcamentaria_<stem>.json`.
12. **Diff Estrutural e Semântico Multi-Versão:** Compara versões sucessivas de documentos através do parâmetro `compareWithPath` no `inspect_doc` ou da flag `--diff` na CLI, computando seções adicionadas/removidas/modificadas (com inline diff) e o delta de zonas de risco (`INTRODUCED`, `RESOLVED`, `RETAINED`) em `state/diff_documental_<stem>.md`.
13. **Trava Anti-Alucinação de Jurisprudência (`[ANTI_HALLUCINATION_BLOCK]`):** Bloqueio fail-fast em `fetch_juris` contra citações de julgados inventados ou inexistentes nas bases de dados oficiais dos tribunais.

---

## 4. Ciclo de Vida do Caso: 12 Ferramentas Nativas Integradas

O motor opera em dois modos (Servidor MCP por padrão ou CLI via flags), disponibilizando as **12 ferramentas fundamentais**:

### A) Modo Servidor MCP (Padrão / `--mcp`)

Ao ser executado **sem argumentos** (ou com `--mcp`), o binário inicia um servidor MCP sobre `stdio` expondo as seguintes ferramentas:

1. **`bootstrap_case`**
   - Cria a estrutura de diretórios do caso (`inputs/`, `state/`, `templates/`, `output/`), preserva nomes legíveis ou auto-batiza anexos opacos (`media_*`), infere extensões via magic bytes, aceita `fileRenameMap`.
   - Descompacta pacotes compactados (`.zip`, `.tar`, `.tar.gz`, `.tgz`) via `libmagic msooxml` com defesa Anti-Zip Slip.
   - Copia de forma síncrona imediata os modelos `.docx` e documentos `.pdf` de `uploadsDir` para `inputs/`, extrai seus mapas estruturais (`state/estrutura_<nome>.json`), gera a **Visão Linear de Auditoria** (`state/visao_auditoria_<nome>.md`), o **Dossiê de Hotspots** (`state/dossie_hotspots_<nome>.md`), o relatório de **Auditoria Orçamentária** (`state/auditoria_orcamentaria_<nome>.json`, se houver tabelas de itens) e o **Índice Mestre do Caso** (`state/indice_mestre_caso.md`).
   - Parâmetros: `caseDir` (*obrigatório*), `uploadsDir` (*opcional*), `fileRenameMap` (*opcional*).

2. **`inspect_doc`**
   - Realiza a engenharia reversa de arquivos `.docx`, `.pdf`, `.xlsx`, `.csv`, `.md` ou `.txt`.
   - **Para PDF:** Extrai todas as páginas, numera linhas com coordenada dupla `[PAG_XXX | LYYYY]`, reconstrói colunas com ` | `, constrói a Cartografia Estrutural em 3 camadas e o Radar das 14 Zonas (`Z1` a `Z14`), gerando `state/estrutura_<stem>.json`, `state/visao_auditoria_<stem>.md` e `state/dossie_hotspots_<stem>.md`.
   - **Para DOCX:** Mapeia parágrafos, tabelas, constrói `toc_map`, calcula `structure_fingerprint`, busca no Cache Global e gera `state/visao_auditoria_<stem>.md`.
   - **Auditoria Orçamentária Automática:** Realiza checagem determinística em centavos de preços e quantitativos, alimentando o Radar Z10/Z12 e gerando `state/auditoria_orcamentaria_<stem>.json`.
   - **Diff Multi-Versão (`compareWithPath`):** Quando fornecido caminho de documento anterior/retificado, calcula as divergências textuais e estruturais com delta das 14 zonas em `state/diff_documental_<stem>.md` e `.json`.
   - Parâmetros: `filePath` (*obrigatório*, com alias retrocompatível `docxPath`), `compareWithPath` (*opcional*), `outputPath` (*opcional*), `compact` (*opcional*).

3. **`build_docx_template`**
   - Transforma um `.docx` bruto (sem tags) em um template parametrizado com tags `{{...}}` a partir de um arquivo `slots_manifest.json`, preservando 100% da formatação visual (`<w:pPr>`, `<w:rPr>`, estilos, cabeçalhos e tabelas).
   - Valida fail-fast com *Exact Copy-Paste Error* contra propriedades inventadas ou `applied_slots_count === 0`.
   - Suporta `saveToRegistry: true` para homologar o template no Cache Global cross-órgão.
   - Parâmetros: `sourcePath`, `manifestPath`, `outputPath` (*obrigatórios*), `saveToRegistry` (*opcional*), `templateId` (*opcional*).

4. **`fill_docx_template`**
   - Preenche um template `.docx` parametrizado injetando os dados de um arquivo JSON de estado (`{{...}}`, loops `FOR`, condicionais `IF`, quebras `\n` em parágrafos reais, conversão de tabelas Markdown para elementos OpenXML `<w:tbl>`, negrito `**...**` e listas hierárquicas multinível híbridas).
   - **Exportação Híbrida para PDF:** Suporta `outputFormat: "docx" | "pdf" | "both"`. Em modo `"pdf"`, converte via Word COM ou Pure-JS e auto-inspeciona o PDF gerado.
   - Executa **auto-inspeção integrada**, gravando `state/inspecao_<stem>.json` e `state/visao_auditoria_<stem>.md`.
   - Parâmetros: `templatePath`, `statePath`, `outputPath` (*obrigatórios*), `autoInspect` (*opcional*), `outputFormat` (*opcional*).

5. **`generate_audit_docx`**
   - Gera um Parecer de Auditoria Técnico-Jurídica em layout editorial vertical corrido (folha A4 retrato, **zero tabelas** `<w:tbl>`, 100% da largura útil da página), com fichas individualizadas e transcrições literais de evidências.
   - **Exportação para PDF:** Suporta `outputFormat: "docx" | "pdf" | "both"`.
   - Parâmetros: `auditJsonPath`, `outputPath` (*obrigatórios*), `outputFormat` (*opcional*).

6. **`generate_technical_note_docx`**
   - Gera Nota Técnica Comparativa de Evolução Documental ('Antes vs. Depois', Marco 6) em Word (`.docx`) e PDF em layout editorial vertical corrido (folha A4 retrato, **zero tabelas** `<w:tbl>`, 100% largura útil), com destaque visual colorido por cards com bordas laterais (verde para inclusão, vermelho para supressão, azul para alteração), diff granular inline em nível de token e fundamentação técnica/jurídica individualizada por cláusula alterada.
   - **Modos Híbridos:** Suporta modo direto via `noteJsonPath` ou modo comparativo automático derivado a partir de `oldPath` e `newPath`.
   - **Exportação para PDF:** Suporta `outputFormat: "docx" | "pdf" | "both"`.
   - Parâmetros: `outputPath` (*obrigatório*), `noteJsonPath` (*opcional se oldPath/newPath fornecidos*), `oldPath` (*opcional*), `newPath` (*opcional*), `outputFormat` (*opcional*).

7. **`fetch_pncp`**
   - Conector nativo PNCP para download determinístico de contratações públicas de referência para benchmarking técnico e pesquisa de mercado (IN SEGES/ME nº 65/2021).
   - Isolamento estrito dos arquivos baixados em `cases/<slug>/inputs/pncp_<shortname>/` com descompactação automática transparente e catalogação de referência (`state/indice_pncp_<shortname>.md` e `state/pncp_<shortname>_meta.json`).
   - Parâmetros: `caseDir`, `pncpIdOrUrl` (*obrigatórios*), `shortname` (*opcional*).

8. **`search_pncp`**
   - Busca textual multi-query no endpoint oficial `/api/search/` do PNCP com desduplicação por `CNPJ/ANO/SEQUENCIAL`, acumulação em `state/pncp_search_results.json` e tabela consolidada com Objeto Completo em `state/pncp_search_results.md`.
   - Parâmetros: `caseDir`, `query` (*obrigatórios*), `status`, `uf`, `modalidade`, `limit` (*opcionais*).

9. **`search_juris`**
   - Busca sob demanda em APIs oficiais de jurisprudência (TCU, STJ, STF, TST, AGU, TCE-PA, TCE-CE, TCDF, TCE-SP, TCE-MG, TCE-PR) com multi-query paralela (`|`), Statutory Bridge (Lei 13.303/2016 $\leftrightarrow$ Lei 14.133/2021), ranking determinístico (`0..100 pts`), postura tática `DEFENSE`/`ATTACK`, auto-trigger trabalhista para TST e degradação graciosa com graceful fallback por UF.
   - Persiste Ficha de Triagem Rápida em `state/juris_search_results.json` e painel em `.md` com retorno sintético MCP conciso (< 900 bytes).
   - Parâmetros: `query` (*obrigatório*), `caseDir`, `courts`, `uf`, `stance`, `regime`, `limit` (*opcionais*).

10. **`fetch_juris`**
    - Download oficial e fatiamento anatômico em 6 Macro-Partes / 10 Sub-Camadas pelo `AnatomicalSlicer` com trava anti-alucinação estrita (`[ANTI_HALLUCINATION_BLOCK]`).
    - Grava o Dossiê Fatiado por tópico no Estágio 2 (`state/dossie_juris_<shortname>.md`) e o Inteiro Teor Estruturado no Estágio 3 (`inputs/juris_<shortname>/inteiro_teor_anatomico.md`).
    - Parâmetros: `acordaoIdOrUrl` (*obrigatório*), `caseDir`, `court`, `shortname`, `topicFilter`, `stance` (*opcionais*).

11. **`docgov_audit_contract_execution`**
    - Auditoria determinística e fiscalização contínua de contratos administrativos, limites de aditamento (25%/50% isolados, sem compensação mútua), batimento quadripartite (`[TR <-> Proposta <-> ARP <-> Contrato/Fatura]`) com bloqueio de aditivo direto em ARP, consensualidade em estatais e monitoramento de reajustes/repactuações com interregno de 12 meses.
    - Grava `relatorio_fiscalizacao_contratual.json` e `dossie_fiscalizacao_contratual.md` em disco com payload sintético MCP < 900 bytes.
    - Parâmetros: `contractJsonPath` (*obrigatório*), `caseDir`, `outputDir`, `auditType` (*opcionais*).

12. **`docgov_govern_arp`**
    - Motor determinístico de governança de Ata de Registro de Preços e gestão de caronas: livro-razão com travas de 50% individual e 200% global acumulada, matriz de compatibilidade federativa/jurídica (vedação de carona ascendente e simetria 14.133 vs 13.303), condicionantes de TIC, auditoria de vigência (12+12m) e compilação nativa OpenXML DOCX/PDF de notas técnicas de adesão e estudos de vantajosidade.
    - Grava `dossie_governanca_arp.json`, `visao_governanca_arp.md` e minutas DOCX/PDF com payload sintético MCP < 900 bytes.
    - Parâmetros: `arpJsonPath` (*obrigatório*), `caseDir`, `outputDir`, `compilationMode`, `outputFormat` (*opcionais*).

---

### B) Modo CLI (Linha de Comando)

```powershell
# 1. Inicializar pasta do caso, copiar uploads e inspecionar documentos (.docx e .pdf)
./docgov-engine --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded

# Com mapeamento explícito de nomes de arquivos
./docgov-engine --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded --rename-map '{"media_1792069974647_14a93b9d": "Edital_Pregao.pdf"}'

# 2. Inspecionar estrutura de um arquivo (.docx ou .pdf) gerando Cartografia, Radar Z1..Z14, Auditoria Orçamentária e Dossiê
./docgov-engine --inspect edital_licitacao.pdf --out state/estrutura_edital.json
./docgov-engine --inspect modelo_etp.docx --out state/estrutura_etp.json --compact

# Inspecionar comparando com versão anterior (Diff Estrutural e Semântico Multi-Versão)
./docgov-engine --inspect edital_v2.pdf --diff edital_v1.pdf

# 3. Construir template parametrizado a partir de um .docx bruto + slots_manifest.json
./docgov-engine --build-template --source modelo_etp.docx --manifest slots_manifest.json --out template.docx --save-to-registry --template-id etp_padrao_v1

# 4. Preencher template com o JSON de estado (gerando .docx e/ou .pdf)
./docgov-engine --inject --template template.docx --state estado_caso.json --out minuta_final.docx
./docgov-engine --inject --template template.docx --state estado_caso.json --out minuta_final.docx --format both
./docgov-engine --inject --template template.docx --state estado_caso.json --out minuta_final.pdf --format pdf

# 5. Gerar Parecer de Auditoria em Word (.docx) ou PDF a partir do JSON de auditoria
./docgov-engine --generate-audit-docx --audit-json state/relatorio_auditoria.json --out output/Relatorio_Auditoria_ETP.docx
./docgov-engine --generate-audit-docx --audit-json state/relatorio_auditoria.json --out output/Relatorio_Auditoria_ETP.pdf --format pdf

# 6. Gerar Nota Técnica Comparativa de Evolução de Cláusulas (Marco 6)
# 6a. Comparando arquivos diretamente (DOCX ou PDF)
./docgov-engine --diff-report --old inputs/minuta_v1.docx --new inputs/minuta_v2.docx --out output/Nota_Tecnica.docx --format both
# 6b. A partir de JSON estruturado de nota técnica
./docgov-engine --generate-technical-note --note-json state/nota_tecnica.json --out output/Nota_Tecnica.docx --format pdf

# 7. Consultar Editais e Contratações Públicas no PNCP (Geração 4)
./docgov-engine --search-pncp --case-dir cases/caso_exemplo --query "notebooks educacionais" --uf SP --limit 10
./docgov-engine --fetch-pncp --case-dir cases/caso_exemplo --pncp "00394460000141-1-000001/2026" --shortname edital_pncp

# 8. Pesquisar e Extrair Jurisprudência com Análise Anatômica (Geração 4)
# 8a. Pesquisa federada com ranking por relevância, análise de controvérsia e Statutory Bridge
./docgov-engine --search-juris --query "padronização de marca TI" --courts "TCU,STJ,STF,TCE-PA" --stance DIVERGENTE
./docgov-engine --search-juris --query "sobrepreço BDI engenharia" --uf PA --limit 5

# 8b. Resolução canônica de acórdão e fatiamento anatômico estrutural (RELATORIO, VOTO, DISPOSITIVO)
./docgov-engine --fetch-juris --court TCU --id "Acórdão 1234/2023 - Plenário"
./docgov-engine --fetch-juris --court STJ --id "REsp 1.987.654/DF" --topic "vantajosidade econômica"

# 9. Exportar especificação técnica normativa em Markdown
./docgov-engine --dump-spec especificacao_motor.md

# 10. Verificar / Atualizar o próprio binário
./docgov-engine --check-update
./docgov-engine --update
./docgov-engine --force-update

# 11. Auditar Execução Contratual, PAS, ANS/IMR e Cesta de Preços IN 65/2021 (Geração 5 & 5.5)
./docgov-engine audit-contract --contract-json state/contrato_execucao.json --type FULL --mode BOTH --format both --output-dir state/

# 12. Governar Ata de Registro de Preços, Caronas e Vantajosidade (Geração 5)
./docgov-engine --govern-arp --arp-json state/arp_registro.json --mode FULL --output-dir state/

# Verificar a versão instalada e exibir ajuda
./docgov-engine -v
./docgov-engine -h
```

| Parâmetro | Descrição |
| :--- | :--- |
| *(sem argumentos)* ou `--mcp` | Inicia o servidor MCP via `stdio` (comportamento padrão). |
| `--dump-spec [caminho.md]` | Exporta a especificação técnica integral do motor em Markdown (UTF-8). |
| `--bootstrap-case` | Cria `inputs/`, `state/`, `templates/`, `output/` em `--case-dir`, copia e inspeciona `.docx` e `.pdf` imediatamente, gerando a Cartografia, o Radar Z1..Z14, o Dossiê de Hotspots e o Índice Mestre. |
| `--wait` | Aguarda a conclusão da cópia dos arquivos pesados em segundo plano no `--bootstrap-case`. |
| `--inspect <arq.docx\|.pdf>` | Extrai mapa estrutural (`state/estrutura_<stem>.json`), gera `state/visao_auditoria_<stem>.md`, `state/dossie_hotspots_<stem>.md`, executa auditoria orçamentária e busca no Cache Global. |
| `--diff <caminho>` | Compara o documento inspecionado com versão anterior/retificada gerando `state/diff_documental_<stem>.md` e `.json` (usado com `--inspect`). |
| `--compact` | Filtra parágrafos e células vazias no `--inspect` preservando os índices originais 0-based. |
| `--build-template` | Gera um template `.docx` parametrizado a partir de `--source`, `--manifest` e `--out`. |
| `--save-to-registry` | Persiste o manifesto homologado no Cache Global de templates (`core/registry/templates/`). |
| `--template-id <id>` | Identificador semântico customizado do template ao salvar no registro (opcional). |
| `--inject` | Preenche um template `.docx` a partir de `--template`, `--state` e `--out`. |
| `--generate-audit-docx` | Gera um parecer de auditoria executivo a partir de `--audit-json` e `--out`. |
| `--diff-report` | Orquestra a geração de Nota Técnica Comparativa a partir de `--old` e `--new` para `--out`. |
| `--generate-technical-note` | Gera a Nota Técnica Comparativa a partir de `--note-json` e `--out`. |
| `--search-pncp` | Executa busca textual e facetada de contratações públicas no PNCP a partir de `--query` e `--case-dir`. |
| `--fetch-pncp` | Obtém metadados, itens e arquivos de uma contratação específica no PNCP via `--pncp`. |
| `--search-juris` | Executa busca jurisprudencial federada multissistema com relevância, controvérsia e ponte normativa. |
| `--fetch-juris` | Resolução canônica e fatiamento anatômico estrutural de acórdão via `--id` (e opcionalmente `--court`). |
| `--audit-contract` / `audit-contract` | Executa auditoria determinística de execução contratual, aditivos de 25%/50% sem compensação, reajustes e batimento tripartite/quadripartite a partir de `--contract-json`. |
| `--govern-arp` / `govern-arp` | Executa governança de Ata de Registro de Preços, livro-razão de caronas (50%/200%), compatibilidade jurídica e compilação de notas técnicas a partir de `--arp-json`. |
| `--contract-json <caminho>` | Caminho do arquivo JSON de dados contratuais para auditoria (usado com `--audit-contract`). |
| `--arp-json <caminho>` | Caminho do arquivo JSON da Ata de Registro de Preços para governança e controle de caronas (usado com `--govern-arp`). |
| `--type <tipo>` | Tipo de auditoria contratual (`FULL`, `ADDENDUM_LIMITS`, `TRIPARTITE_MATCH`, `READJUSTMENT` — padrão: `FULL`). |
| `--mode <modo>` | Modo de governança de ARP (`FULL`, `LIMITS_LEDGER`, `COMPATIBILITY_MATRIX`, `COMPILER` — padrão: `FULL`). |
| `--output-dir <dir>` | Diretório de destino para gravação de relatórios e artefatos em disco (usado com `--audit-contract` e `--govern-arp`). |
| `--query <termo>` | Termo ou expressão de busca textual (usado com `--search-pncp` e `--search-juris`). |
| `--pncp <id_ou_url>` | Identificador PNCP canônico (`CNPJ-tipo-sequencial/ano`) ou link da contratação no PNCP. |
| `--courts <lista>` | Lista de cortes separada por vírgula para consulta jurisprudencial (ex.: `TCU,STJ,STF,TST,AGU,TCE-PA,TCE-CE,TCDF,TCE-SP,TCE-MG,TCE-PR`). |
| `--court <id>` | Sigla da corte/tribunal de destino (usado com `--fetch-juris`). |
| `--uf <UF>` | Sigla da Unidade Federativa para filtro territorial no PNCP ou resolução automática de TCE no Juris. |
| `--id <acordao>` | Identificador ou citação canônica do acórdão/processo (usado com `--fetch-juris`). |
| `--stance <filtro>` | Filtro de posicionamento / controvérsia (`ALL`, `FAVORAVEL`, `CONTRARIO`, `DIVERGENTE`). |
| `--regime <lei>` | Filtro de regime licitatório (`LEI_14133`, `LEI_8666`, `TODOS`). |
| `--shortname <nome>` | Prefixo ou apelido legível para os arquivos gravados no caso. |
| `--topic <termo>` | Tópico temático de interesse para focar o fatiamento anatômico no `--fetch-juris`. |
| `--limit <n>` | Limite máximo de registros a retornar na consulta (padrão: 10). |
| `--old <caminho>` | Caminho do documento base/anterior (.docx, .pdf ou .json) usado com `--diff-report`. |
| `--new <caminho>` | Caminho do documento revisado/novo (.docx, .pdf ou .json) usado com `--diff-report`. |
| `--note-json <caminho>` | Caminho do arquivo `nota_tecnica.json` (usado com `--generate-technical-note`). |
| `--data <caminho>` | Caminho de dados adicionais/justificativas JSON para enriquecer o `--diff-report` (opcional). |
| `--format <docx\|pdf\|both>` | Seleciona o formato de saída nos comandos `--inject`, `--generate-audit-docx`, `--diff-report` e `--generate-technical-note` (padrão: `docx`). |
| `--case-dir <dir>` | Caminho da pasta do caso (usado com `--bootstrap-case`, `--search-pncp`, `--fetch-pncp`, etc.). |
| `--uploads-dir <dir>` | Caminho opcional da pasta `.user_uploaded` (usado com `--bootstrap-case`). |
| `--audit-json <caminho>` | Caminho do arquivo `relatorio_auditoria.json` (usado com `--generate-audit-docx`). |
| `--source <caminho>` | Caminho do `.docx` bruto original (usado com `--build-template` ou `--inspect`). |
| `--manifest <caminho>` | Caminho do arquivo `slots_manifest.json` (usado com `--build-template`). |
| `--template <caminho>` | Caminho do arquivo modelo `.docx` de entrada (usado com `--inject`). |
| `--state <caminho>` | Caminho do arquivo `.json` contendo os dados a serem injetados (usado com `--inject`). |
| `--out <caminho>` | Caminho do arquivo de saída. |
| `--check-update` | Consulta o GitHub Releases e informa se há uma nova versão disponível. |
| `-u`, `--update` | Atualiza o próprio binário para a versão mais recente. |
| `--force-update` | Força o download e substituição do binário pela última release publicada. |
| `-v`, `--version` | Exibe a versão atual do binário (`docgov-engine vX.Y.Z`). |
| `-h`, `--help` | Exibe o resumo de uso e parâmetros disponíveis. |

---

## 5. Estrutura do `slots_manifest.json` (`build_docx_template`)

O motor suporta tanto a **notação compacta universal** (baseada nas coordenadas do `toc_map` e `visao_auditoria.md`) quanto a **notação canônica verbosa**, sempre com nomes de variáveis em `snake_case` e suporte automático a acessos indexados (`itens[0].qtd`):

### A) Notação Compacta Universal (Recomendada)
```json
{
  "slots": [
    { "coord": "P3", "tag": "{{estudo.descricao_necessidade}}" },
    { "coord": "T0.R0.C1", "tag": "{{metadados.unidade_requisitante}}" },
    { "coord": "T1.R1.C1", "tag": "{{itens[0].descricao}}: {{itens[0].qtd}} unidades" },
    { "coord": "P12-P14", "tag": "{{estudo.justificativa}}" },
    { "find": "Texto Antigo Fixo", "replace": "{{metadados.orgao}}" }
  ]
}
```
> **Dica:** Aceita coordenadas com ou sem colchetes (`"T0.R0.C1"` ou `"[T0.R0.C1]"`), ranges de parágrafo (`"P12-P14"`), aliases (`col_index`, `paragraph_index`), auto-conversão de `itens.0.qtd` para `itens[0].qtd` e array puro na raiz `[ { "coord": "...", "tag": "..." } ]`.

### B) Notação Canônica Detalhada
```json
{
  "replace_paragraphs": [
    {
      "start_p": 3,
      "end_p": 5,
      "tag": "{{estudo.descricao_necessidade}}"
    }
  ],
  "replace_table_cells": [
    {
      "table_index": 0,
      "row_index": 0,
      "cell_index": 1,
      "tag": "{{metadados.unidade_requisitante}}"
    },
    {
      "table_index": 1,
      "row_index": 1,
      "cell_index": 1,
      "tag": "{{itens[0].descricao}}: {{itens[0].qtd}}"
    }
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
    {
      "find": "Texto Antigo Fixo",
      "replace": "{{metadados.orgao}}"
    }
  ]
}
```

---

## 6. Configuração nos Principais Agentes MCP

Como o modo MCP é o padrão quando nenhum argumento é passado, basta apontar para o executável:

### Google Antigravity (AGY)
Edite `~/.gemini/config/mcp_config.json` (ou acesse **Additional Options (...) > MCP Servers**):
```json
{
  "mcpServers": {
    "docgov": {
      "command": "C:/caminho/para/docgov-engine.exe",
      "args": []
    }
  }
}
```

### Claude Code (CLI)
```powershell
# Windows
claude mcp add docgov -- "C:\caminho\para\docgov-engine.exe"

# Linux / macOS
claude mcp add docgov -- "/caminho/para/docgov-engine"
```

### Claude Desktop / Cursor / Windsurf
No arquivo `claude_desktop_config.json`, `.cursor/mcp.json` ou `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "docgov": {
      "command": "C:/caminho/para/docgov-engine.exe",
      "args": []
    }
  }
}
```

---

## 7. Desenvolvimento, Testes e Governança

O desenvolvimento e a validação do `docgov-engine` utilizam o runtime [Bun](https://bun.sh/).

### Instalação de Dependências
```bash
bun install
```

---

### A) Testes Unitários e Herméticos (100% Offline e Determinístico)

A suíte hermética é rápida, isolada e não faz chamadas externas de rede, garantindo reprodução instantânea em qualquer ambiente:

```bash
# Executar a bateria completa de testes herméticos e contratos locais
bun test
```

#### Comandos Seletivos por Domínio (Copiar e Colar)

Para focar no domínio em desenvolvimento ou acelerar ciclos de micro-commit, execute apenas a suíte correspondente:

```bash
# 0. Auditoria física de linhas (Lei 9 <= 500 linhas em 100% do repositório: src/, test/, tests_live/ e scripts/)
bun run check:lines

# 1. Jurisprudência (Core/Scorer, Roteamento/Tools, Slicer Anatômico, Cortes Federais e Cortes Estaduais)
bun test test/juris/core_and_scorer.test.ts test/juris/routing_and_tools.test.ts test/juris/anatomical_slicer.test.ts
bun test test/juris/federal_courts.test.ts
bun test test/juris/state_courts.test.ts
bun test test/juris/state_courts.test.ts -t "TCE-MG"

# 2. Portal Nacional de Contratações Públicas (PNCP)
bun test test/pncp_search.test.ts test/pncp_fetch.test.ts

# 3. Ingestão de Pastas, Bootstrap de Casos e Salvaguardas
bun test test/bootstrap.test.ts test/bootstrap_guardrails.test.ts

# 4. Inspeção Estrutural, Cartografia de Documentos e Radar Z1..Z14
bun test test/inspect.test.ts test/inspect_text_md.test.ts

# 5. Auditoria Orçamentária e Análise de Planilhas
bun test test/budget_auditor.test.ts test/spreadsheet.test.ts

# 6. Engenharia Reversa e Preenchimento de Templates OpenXML
bun test test/build_template_contracts.test.ts test/build_template_tables.test.ts
bun test test/fill_template_injection.test.ts test/fill_template_multilevel.test.ts

# 7. Parecer de Auditoria Executivo e Notas Técnicas Comparativas
bun test test/audit.test.ts test/technical_note.test.ts

# 8. Comparador Documental e Diff Estrutural / Semântico Multi-Versão
bun test test/structural_diff.test.ts test/semantic_diff.test.ts

# 9. Pipeline Híbrido de Exportação DOCX -> PDF (Pure-JS + Word COM)
bun test test/pdf_exporter.test.ts

# 10. Cache Global de Templates e Registro de Minutas
bun test test/registry.test.ts test/registry_matching.test.ts

# 11. Dispatcher MCP (JSON-RPC stdio) e Self-Discovery Normativo
bun test test/mcp_dispatch.test.ts test/mcp_spec.test.ts

# 12. Fiscalização Contratual, PAS/ANS-IMR, Cesta IN 65/2021 e Governança de ARP (Gerações 5 & 5.5)
bun test test/contracts/ test/arp/ test/contracts_arp_mcp_cli.test.ts
```

---

### B) Sondas Online de Contrato de API (Live API Smoke Tests)

As suítes de **Live Smoke Tests** executam requisições HTTPS REAIS contra os portais públicos oficiais (`pncp.gov.br`, `api.github.com` e portais de tribunais), atestando a conectividade, a conformidade de schemas e a resiliência contra mudanças de APIs públicas.

#### Execução Geral ou por Suíte
```bash
# Executar todas as sondas de rede (PNCP + GitHub + Jurisprudência)
bun run test:live

# Executar a suíte de Jurisprudência com Auto-Discovery Dinâmico (todos os 11 conectores + Fallback gracioso = 23 sondas)
bun run test:live:juris

# Executar apenas as sondas da API oficial do PNCP (pncp.gov.br)
bun run test:live:pncp

# Executar apenas as sondas do GitHub Updater e Checksums
bun run test:live:updater
```

#### 🔍 Rastreabilidade e Diagnóstico Real de Origem no Relatório Executivo
O runner `test:live:juris` avalia cada conector e explicita no relatório executivo o diagnóstico exato da resposta:
- `[API Live Direta]`: Resposta obtida diretamente da API REST/JSON ou portal web oficial do tribunal;
- `[Híbrido (Live + Curado)]`: Resultados combinados entre a API oficial ao vivo e o catálogo normativo local;
- `[Fallback Curado Local]`: Atendimento pelo catálogo determinístico curado (Súmulas/Consultas/Orientações Normativas) quando o portal externo exige sessão/CAPTCHA ou a query foca em enunciados sumulados;
- `[Catálogo Normativo Curado]`: Extração e fatiamento anatômico de enunciado normativo curado em `fetchJuris`;
- `[Graceful Fallback]`: Confirmação de degradação graciosa para UF não implementada (ex.: `AC`), acionando a camada federal e gerando `fallback_notice`.

#### 🚀 Isolamento Cirúrgico por Tribunal (`--court=<ID>`) (Copiar e Colar)

Para auditar individualmente um único conector (ou grupo de cortes) sem executar consultas contra as demais, utilize o runner com a flag `--court` (< 3s por corte):

```bash
# Tribunal de Contas da União (TCU)
bun scripts/run_live_tests.ts --suite=juris --court=TCU

# Superior Tribunal de Justiça (STJ)
bun scripts/run_live_tests.ts --suite=juris --court=STJ

# Supremo Tribunal Federal (STF)
bun scripts/run_live_tests.ts --suite=juris --court=STF

# Tribunal Superior do Trabalho (TST — Terceirização e Súmula 331)
bun scripts/run_live_tests.ts --suite=juris --court=TST

# Advocacia-Geral da União (AGU — Pareceres Vinculantes, Orientações Normativas e Súmulas)
bun scripts/run_live_tests.ts --suite=juris --court=AGU

# Tribunal de Contas do Estado do Pará (TCE-PA)
bun scripts/run_live_tests.ts --suite=juris --court=TCE-PA

# Tribunal de Contas do Estado do Ceará (TCE-CE)
bun scripts/run_live_tests.ts --suite=juris --court=TCE-CE

# Tribunal de Contas do Distrito Federal (TCDF)
bun scripts/run_live_tests.ts --suite=juris --court=TCDF

# Tribunal de Contas do Estado de São Paulo (TCE-SP — Súmulas e Decisões)
bun scripts/run_live_tests.ts --suite=juris --court=TCE-SP

# Tribunal de Contas do Estado de Minas Gerais (TCE-MG — Súmulas e Consultas Normativas)
bun scripts/run_live_tests.ts --suite=juris --court=TCE-MG

# Tribunal de Contas do Estado do Paraná (TCE-PR — Prejulgados, Súmulas e Consultas)
bun scripts/run_live_tests.ts --suite=juris --court=TCE-PR

# Multi-Corte (Filtro por lista separada por vírgula)
bun scripts/run_live_tests.ts --suite=juris --court=TCE-SP,TCE-MG,TCE-PR

# Execução explícita de todas as cortes via flag
bun scripts/run_live_tests.ts --suite=juris --court=ALL
```

---

### C) Compilação Local e Self-Discovery

```bash
# Consolidação Completa: Compila Linux e Windows, normaliza binários, gera SHA256SUMS.txt e atualiza docs/especificacao_motor.md
bun run build

# Regenerar diretamente a especificação técnica normativa (--dump-spec)
bun run dump:spec

# Compilar binário isolado para a plataforma atual (opcional)
bun run build:windows
bun run build:linux
```

> ℹ️ **Nota de Distribuição & Release:** Os comandos locais `bun run build` e `bun run build:*` destinam-se a desenvolvimento local e smoke tests. A compilação oficial multi-plataforma (`ubuntu-24.04` e `windows-latest`), o cálculo de checksums (`SHA256SUMS.txt`) e a publicação de releases são **100% automatizados pela esteira externa de CI/CD** ao receber o push de tags anotadas `v*`.

---

### Estatuto de Governança (`AGENTS.md`)

O desenvolvimento do motor é estritamente regido pelas **9 Leis Invioláveis de Engenharia**:

1. **Runtime e Testes Padronizados via Bun:** Todos os comandos e testes utilizam Bun (`bun test`). Zero caminhos absolutos hardcoded no repositório.
2. **Teto Estrito de Payload MCP (< 1024 bytes):** Respostas sintéticas de ferramentas via `stdio` MCP mantêm-se abaixo de 1024 bytes (margem segura $< 920$ bytes) para prevenir truncamento em IDEs consumidoras. Dossiês e mapas completos são persistidos em disco.
3. **Padrão Exact Copy-Paste Error:** Proibido retornar `success` com 0 alterações aplicadas. Detecções de violação de contrato abortam imediatamente fornecendo o snippet canônico exato pronto para substituição.
4. **Sincronia Obrigatória de Self-Discovery:** Qualquer alteração em ferramentas ou parâmetros atualiza no mesmo commit: `--dump-spec`, `DOCX_ENGINE_INSTRUCTIONS`, `getMcpToolsDefinition()` e dicas contextuais.
5. **Neutralidade Institucional Absoluta:** Proibido utilizar nomes ou identificadores de órgãos, entidades ou localidades específicas em código, fixtures ou testes. Apenas identificadores genéricos universais (`ORGAO_CONTRATANTE`, `TCU`, `AGU`, etc.).
6. **Resiliência de Caminhos e Cache Global:** Resolução de diretórios independente de `process.cwd()`, com fallback para `DOCGOV_REGISTRY_DIR` e sanity checks contra entradas corrompidas.
7. **Ritual de Qualidade e Release Automatizada via Pipeline Externo:** Zero releases locais (`gh release create` local proibido). Push da tag anotada `v*` como gatilho canônico exclusivo para runners remotos de CI/CD.
8. **Disciplina Autônoma de Micro-Commits Atômicos:** Todo avanço é fatiado em micro-commits sequenciais (`feat`, `fix`, `test`, `docs`) 100% verdes, com atualização contínua de `CHANGELOG.md` e `ROADMAP.md`.
9. **Modularidade Estrita, Teto de 500 Linhas e Economia de Tokens:** Nenhum arquivo `.ts` em `src/` ultrapassa 500 linhas. Leitura fatiada (*target-lines only*) e execução cirúrgica de testes durante ciclos intermediários.
