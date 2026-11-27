# 🗺️ ROADMAP OFICIAL — `docgov-engine` (v1.1.x+)

> **Memória Histórica:** Para o histórico consolidado de versões desde o commit inicial (`v0.0.1`) até o lançamento principal (`v1.0.0 — Clean Cut`) e releases consolidadas da série `v1.x` (`v1.1.0` a `v1.5.0`), consulte o [CHANGELOG.md](CHANGELOG.md).
> **Propósito deste Documento:** Fonte única da verdade sobre o planejamento arquitetural, evoluções funcionais e marcos estratégicos futuros do motor (`v1.5.x+`).
> **Natureza Standalone & Desacoplada:** O `docgov-engine` é um motor autônomo e determinístico. Embora sirva como fundação para a camada de agentes do ecossistema `docgov`, ele possui ciclo próprio de evolução e pode ser utilizado de forma independente via CLI ou MCP por qualquer cliente, agente de IA ou pipeline automatizado.
> **Política de Versionamento Pareado (Lockstep `Major.Minor` com o repositório `DocGov`) & Janelas de Amortecimento (*Buffered Releases*):**
> O par `Major.Minor` (`1.2.x` a `1.11.x+`) caminha em estrita sincronia funcional com o repositório irmão `DocGov`, agrupando conjuntos densos de funcionalidades por geração. A partir da série `v1.7.x`, adotamos a engenharia de **Releases Amortecidas** (`v1.7.0 -> v1.7.3 -> v1.7.4 -> v1.7.5 -> v1.7.6–1.7.9 -> v1.7.10 -> v1.7.12`, `v1.8.0 -> v1.8.3 -> v1.8.6`, `v1.9.0 -> v1.9.3 -> v1.9.6`, `v1.10.0 -> v1.10.3` e `v1.11.x+`), onde os saltos deliberados de versão reservam números de *patch* intermediários (`v1.7.1`/`1.7.2`, `v1.7.7`–`1.7.9`, `v1.7.11`, `v1.7.13`, `v1.8.1`–`1.8.2`, etc.) para absorver entregas incrementais de infraestrutura e *hotfixes* de *smoke tests* e *dogfooding* real, mantendo a linha de base de **16 tools MCP** na `v1.7.4` e mantendo cada ciclo de codificação e sua suíte de testes pequenos, coesos e à prova de regressões.
> **Regra para Agentes IA:** Sempre consulte e atualize os checkboxes (`[x]` / `[ ]`) deste `ROADMAP.md` ao planejar ou concluir cada marco evolutivo.

---

### 📊 Matriz de Gerações Pareadas (Lockstep DocGov $\leftrightarrow$ docgov-engine)

| Geração | Versão Pareada | Foco Funcional Estratégico no Motor | Status |
| :--- | :--- | :--- | :--- |
| **Geração 1** | `v1.1.x` | Auditoria Matemática de Planilhas (`Z10`/`Z12`), Diff Estrutural e Resiliência Multi-Arquivo | `[CONCLUÍDO]` |
| **Geração 2** | `v1.2.x` | Segurança Supply-Chain, Ingestão de `.xlsx`/`.csv`, Tabelas Multi-Página e OCR Headless | `[CONCLUÍDO]` |
| **Geração 3** | `v1.3.x` | Diff Semântico Granular, Evolução de Cláusulas e Nota Técnica Comparativa Padronizada | `[CONCLUÍDO]` |
| **Geração 4** | `v1.4.x` | Motor Determinístico Sob Demanda de Pesquisa, Validação e Fatiamento Anatômico de Jurisprudência (11 Cortes Homologadas até a `v1.4.6`; Demais Cortes via Trilha Contínua Sob Demanda) | `[CONCLUÍDO]` |
| **Geração 5** | `v1.5.0` | Fiscalização Contratual, Aditivos 25%/50%, Atas de Registro de Preços (ARP/Caronas 50%/200%), Batimento Tripartite/Quadripartite e Reajustes/Repactuação | `[CONCLUÍDO]` |
| **Geração 5.5** | `v1.5.5` | Processo Administrativo Sancionador (PAS), Glosa por ANS/IMR vs. Multa, Garantias e Saneamento Estatístico de Cesta de Preços (`CV <= 25%`) | `[CONCLUÍDO]` |
| **Geração 5.6** | `v1.5.6` | Adequação Federativa do PAS (Estadual/Municipal/Estatal) junto ao TCE/TCM Competente e Calibragem Jurisprudencial da Dosimetria Ancorada em Precedentes Sancionadores (LINDB Art. 22) | `[CONCLUÍDO]` |
| **Geração 6** | `v1.6.0` / `v1.6.4` | Seleção do Fornecedor 360º em TIC & Contratação Direta — Upgrade `unpdf@2.1+` Multimodal `assets/`, Perícia Forense Dual `PDF/DOCX`, Conluio em Propostas/Cotações, Inexequibilidade `< 75%` e Garantia Adicional `75%..85%`, Jogo de Planilha, Fase Recursal Art. 165 / Acórdão 1.211/2021, Mapa Arquitetural, Trava Lockstep & Teto MCP `<= 880B` | `[CONCLUÍDO]` |
| **Geração 6.5** | `v1.6.5` / `v1.6.6` / `v1.6.7` | **Eixo 1 (`[CONCLUÍDO]` na `v1.6.5`):** Regime de Dedicação Exclusiva de Mão de Obra (`DEMO` — Módulos 1–6, Anexo VI-B, Dec. 12.174/2024, Conta Vinculada vs. Fato Gerador, Expurgo APT & Repactuação via `docgov_audit_demo_regime`)<br>**Eixo 2 (`[CONCLUÍDO]` na `v1.6.6` / `v1.6.7`):** Obras e Serviços de Engenharia (BDI Acórdão TCU 2.622/2013, Súmulas 253/254, Desoneração CPRB Lei 14.973/2024, Curva ABC `SINAPI`/`SICRO`, *Front-Loading*, Contratação Integrada, Inexequibilidade 75%/85% & Hardening Black-Box via `docgov_audit_engineering_works`) | `[CONCLUÍDO]` |
| **Geração 7.0** | `v1.7.0` / `v1.7.1` / `v1.7.2` | 2ª Perna Anti-Fraude (Parte 1): Perícia Criptográfica `PKCS#7/CMS/PAdES` (`ICP-Brasil`/`Gov.br` & `/ByteRange`), Validador Algorítmico NF-e 44 Dígitos, Clones `w:rsid` `.docx`, Metadados `.xlsx`, Guarda `unknown_keys` Gen6, Smoke Real, Resiliência Unificada JURIS, Triagem A/B Estruturada do TST (4 Baldes), Refatoração Modular 100% Lei 9 & Polimentos R4 | `[CONCLUÍDO]` |
| **Geração 7.3** | `v1.7.3` | Higienização Estrutural JURIS, Acumulação com Lock (`juris_search_store`), Neutralidade Estrita (`NEUTRAL`/`AUTO` + Rebalanceamento `0..100`), Cache Dinâmico TTL 24h TST (`SUM`/`OJ`/`ACORDAO`) & Migração do Inteiro Teor para `state/` | `[CONCLUÍDO]` |
| **Geração 7.3 — Trilha A** | `v1.7.4` | Blindagem Real `ENG-10` (`resolve()` + `realpathSync()`), Escopos Efêmeros Isolados + Preservação de Subpastas Nomeadas, Proteção Cirúrgica `inputs/` -> `state/`, Sweep Lazy `>= 72h`, Caminhos Compactos MCP (`formatCompactMcpPath`) & Camada Universal de I/O (`fs_safe_io.ts` + lock externo `%TEMP%/docgov_locks/`) | `[CONCLUÍDO]` |
| **Geração 7.5 — Trilha A+** | `v1.7.5` | Otimização MCP Híbrido `<= 8 KB`, Lei 2 Bimodal (`INLINE` / `POINTER` / `SUMMARY`), *Write-Behind* controlado sobre `enqueueWrite`/`flushPendingWrites` & Paridade CLI/MCP | `[CONCLUÍDO]` |
| **Geração 7.6 — Trilha B (Etapa A)** | `v1.7.6` | Corte Limpo Global JURIS: Cache TTL 24h Universal (`juris_ttl_cache.ts`), Expurgo de Catálogos Congelados (`catalog_helper.ts`), Desarme de Vieses/Mutações (`STF`/`AGU`/`TCE-SP`/Slicer) & `precedent_triage_core.ts` | `[CONCLUÍDO]` |
| **Geração 7.7–7.9 — Trilha B** | `v1.7.7`–`v1.7.9` | Trilha B JURIS/AGU (`client_sphere`/`client_regime`, 4 fontes live AGU, `agu_precedent_triage.ts`, STF/STJ/TCE-CE/TCDF & reescrita de scrapers) + Janelas de Amortecimento (*buffers*) | `[PLANEJADO]` |
| **Geração 7.10** | `v1.7.10` *(hotfix `v1.7.11` \| `Assert 38`)* | Fechamento Gen 7 (16 tools MCP mantidas) — Travas Legais Binárias do Pregoeiro (Sessão & Habilitação) na Rota E: Art. 14/38, ME/EPP R$ 4,8M (Art. 4º §§ 1º–2º / LC 123), Balanço Art. 69 (`BigInt` + ECD/Junta), Subcontratação Art. 122 & `audit_coverage` em `state/` | `[PLANEJADO]` |
| **Geração 7.12** | `v1.7.12` *(hotfix `v1.7.13` \| `Assert 39`)* | Fechamento Gen 7 (16 tools MCP mantidas) — Governança & Auditoria de Prova de Conceito (`PoC`) Dual-Mode: Edital (visão Órgão + Inteligência Competitiva/Defesa) & Fase Externa (`Roteiro_e_Laudo_Pericial_PoC.docx/.pdf`, travas TCU `POC_ALL_BIDDERS_BURDEN_BLOCK` e `POC_SUBJECTIVE_CRITERIA_BLOCK`) | `[PLANEJADO]` |
| **Geração 8.0** | `v1.8.0` *(hotfix `1.8.1`–`1.8.2` \| `Assert 40`)* | Ciclo Contratual & **17ª Tool MCP** (`docgov_audit_contract_lifecycle`): Emissor Oficial de ACT (Art. 88, §§ 3º–4º), Livro-Razão PCA Cross-Caso (Art. 12, VII), Regime `SICX` (Art. 75, § 7º) & Encerramento/TRD | `[PLANEJADO]` |
| **Geração 8.3** | `v1.8.3` *(hotfix `1.8.4`–`1.8.5` \| `Assert 41`)* | Expansão da **17ª Tool MCP** — Mutabilidade Contratual Documental: Repactuação DEMO (Art. 135), Fato do Príncipe Tributário Objetivo (Art. 134) & Revisão/Reequilíbrio Híbrido (Art. 124, II, "d" / Art. 81, VI Lei 13.303) | `[PLANEJADO]` |
| **Geração 8.6** | `v1.8.6` *(hotfix `1.8.7`–`1.8.9` \| `Assert 42`)* | Reajuste em Sentido Estrito + Abertura Open-Data & **18ª Tool MCP** (`fetch_official_economic_indices`): Kernel Open-Data + `BACEN SGS/Olinda` & `IBGE SIDRA` (`IPCA`, `INPC`, `ICTI`, `IST`, `INCC`) plugados no motor `BigInt` de Reajuste | `[PLANEJADO]` |
| **Geração 9.0** | `v1.9.0` *(hotfix `1.9.1`–`1.9.2` \| `Assert 43`)* | Expansão Open Data & **19ª Tool MCP** (`fetch_supplier_integrity`): Certidão Consolidada TCU (*zero-key*) + APIs CGU (`CEIS/CNEP/CEPIM`) opcionais | `[PLANEJADO]` |
| **Geração 9.3** | `v1.9.3` *(hotfix `1.9.4`–`1.9.5` \| `Assert 44`)* | Expansão Open Data & **20ª Tool MCP** (`fetch_cnpj_profile`): Cascata resiliente `BrasilAPI -> MinhaReceita -> ReceitaWS` (QSA, abertura, endereço, CNAE, porte, situação cadastral) | `[PLANEJADO]` |
| **Geração 9.6** | `v1.9.6` *(hotfix `1.9.7`–`1.9.9` \| `Assert 45`)* | Expansão Open Data & **21ª Tool MCP** (`search_comprasgov_prices`): Catálogo `CATMAT/CATSER` flexível + Preços Homologados 12m (Compras.gov.br / PNCP + histórico multi-certame) | `[PLANEJADO]` |
| **Geração 10.0** | `v1.10.0` *(hotfix `1.10.1`–`1.10.2` \| `Assert 46`)* | Pilar Antifraude Dedicado (`ALERT-ONLY`) & **22ª Tool MCP** (`docgov_audit_antifraud_and_integrity`): Radar Antifraude v1 (Background Check, zero `REJECTED` automático, somente `ATTENTION_SIGNAL`: Grafo QSA/contato, Art. 160 sucessora, alinhamento de propostas, "coelho", fusão Gen7.0 & `audit_coverage`) | `[PLANEJADO]` |
| **Geração 10.3** | `v1.10.3` *(hotfix `1.10.4+` \| `Assert 47`)* | Expansão da **22ª Tool MCP** — Radar Antifraude v2 (`ALERT-ONLY` — Modo Auditoria / Controle Interno): grafo expandido opcional, sinais contábeis avançados, *screening* multi-certame (CADE/OCDE) & `Relatorio_Sinais_Integridade_e_Antifraude.docx/.pdf` | `[PLANEJADO]` |
| **Geração 11+** | `v1.11.x+` *(23ª Tool+ \| `Assert 48+`)* | Verticais Setoriais Profundas — iniciando por **Cloud FinOps & Licenciamento Enterprise de TIC** (`USN`, reservas plurianuais vs. sob demanda, travas *upfront*, *True-Up* e *egress fees*) | `[PLANEJADO]` |
| **Major** | `v2.0.0` | Breaking Changes Reais em contratos públicos ou arquitetura de ferramentas MCP | `[RESERVADO]` |

---

## 🔌 TRILHA CONTÍNUA DE CONECTORES JURISPRUDENCIAIS SOB DEMANDA (On-Demand Track — Patch `+0.0.1`)

> **Protocolo Operacional:** Conforme homologado a partir da `v1.4.6`, a esteira de novos tribunais de contas estaduais/municipais e tribunais regionais federais (TRFs) opera de forma contínua e independente de marcos funcionais maiores, seguindo o playbook de 2 fases e 4 micro-commits em [`docs/JURIS_CONNECTOR_PLAYBOOK.md`](docs/JURIS_CONNECTOR_PLAYBOOK.md).

### 🏛️ Tabela de Cobertura Federativa e Fila Prioritária de Homologação

| Nível / Onda | Tribunais / Cortes | Cobertura e Estratégia | Status |
| :--- | :--- | :--- | :--- |
| **1. Base Homologada (12/12)** | **Federais:** `TCU`, `STJ`, `STF`, `TST`, `AGU/CGU`<br>**Estaduais / DF:** `TCE-PA`, `TCE-CE`, `TCDF`, `TCE-SP`, `TCE-MG`, `TCE-PR`<br>**Municipal (Onda 3):** `[x] TCM-PA` (`v1.6.8`) | Arquitetura unificada de Resiliência Dupla (*Live Primary + Curated Fallback*), coexistência Estadual/Municipal (`sphere`), roteamento plug-and-play e Sub-Asserts do `DocGov`. | `[x] HOMOLOGADO` |
| **2. Onda 3 — Tribunais Municipais (1/5 Homologados)** | `[x] TCM-PA` (Municípios do Pará — `v1.6.8`)<br>`[ ] TCM-SP` (Capital de São Paulo)<br>`[ ] TCM-RIO` (Capital do Rio de Janeiro)<br>`[ ] TCM-BA` (Municípios da Bahia)<br>`[ ] TCM-GO` (Municípios de Goiás) | **🔥 Alta Prioridade:** Conectores especializados para as 5 cortes de contas municipais do Brasil, com coexistência por `sphere` (`STATE`/`MUNICIPAL`/`ALL`) e higiene de auto-trigger anti-colisão com TCEs homônimos. | `[ ] PRIORIDADE 1` |
| **3. Onda 2 Restante — Grandes Cortes Estaduais (6 TCEs)** | `[ ] TCE-RJ` (Rio de Janeiro)<br>`[ ] TCE-RS` (Rio Grande do Sul)<br>`[ ] TCE-PE` (Pernambuco)<br>`[ ] TCE-BA` (Bahia)<br>`[ ] TCE-SC` (Santa Catarina)<br>`[ ] TCE-AM` (Amazonas) | **🔥 Alta Prioridade:** Conectores com repertório normativo curado, Súmulas e busca live para os maiores tribunais estaduais restantes. | `[ ] PRIORIDADE 2` |
| **4. Onda 4 — Demais 15 TCEs Estaduais** | `GO`, `ES`, `MT`, `MS`, `MA`, `RN`, `PB`, `AL`, `SE`, `PI`, `RO`, `AC`, `AP`, `RR`, `TO` | **Graceful Fallback Ativo:** Operam com busca automática na camada federal e aviso amigável; homologáveis individualmente sob demanda via patch `+0.0.1`. | `[ ] SOB DEMANDA` |
| **5. Onda 5A — Justiça Federal Prioritária (`TRF-1`)** | `[ ] TRF-1` (Tribunal Regional Federal da 1ª Região) | **⚖️ Prioridade Complementar (Opt-In):** Prioridade inicial entre os TRFs. Atende parcialmente demandas de contratações públicas (mandados de segurança em licitações federais, sanções administrativas, execução contratual e teses relevantes antes de chegarem ao STJ/STF). Operará com `defaultFederal: false` (acionamento explícito ou citação direta `TRF-1`). | `[ ] PRIORIDADE 3 (COMPLEMENTAR)` |
| **6. Onda 5B — Demais TRFs (2ª a 6ª Regiões)** | `[ ] TRF-2`, `[ ] TRF-3`, `[ ] TRF-4`, `[ ] TRF-5`, `[ ] TRF-6` | **Baixa Prioridade / Sob Demanda Ocasional:** Cobertura parcial e pontual para temas específicos relevantes em contratações públicas; homologáveis sob demanda (ou via camada unificada CJF) mantendo `defaultFederal: false`. | `[ ] BAIXA PRIORIDADE / SOB DEMANDA` |

---

## ✅ STATUS BASE CONSOLIDADO E HOMOLOGADO (`v1.0.0` a `v1.5.6`)

As capacidades fundamentais do motor foram consolidadas e testadas com 100% de aprovação (detalhes exaustivos no [`CHANGELOG.md`](CHANGELOG.md)):

- [x] **`v1.0.0` (Clean Cut Standalone):** Arquitetura desacoplada, MCP stdio, cartografia por coordenadas, Radar Z1..Z14 e compilação básica OpenXML.
- [x] **Marco 4 — `v1.1.0`:** Auditoria aritmética de planilhas em centavos (`Z10`/`Z12`), tolerâncias `ROUNDING_WARNING` vs. `MATH_ERROR` e diff estrutural baseado no `toc_map`.
- [x] **Marco 5 — `v1.2.0`:** Auto-updater seguro com SHA-256, engenharia tabular multi-página, ingestão nativa de `.xlsx`/`.csv` e OCR headless com coordenadas homogêneas.
- [x] **Marco 6 — `v1.3.0` a `v1.3.11`:** Diff semântico token-level, Nota Técnica Comparativa em Word/PDF, guardrails de escopo (`ENG-10`), conectores PNCP (`fetch_pncp` e `search_pncp`), conversor de tabelas Markdown para `<w:tbl>`, reancoragem de prefixos multinível e teto físico da Lei 9 ($\le 500$ linhas).
- [x] **Marco 7 — `v1.4.0` a `v1.4.6`:** Motor de jurisprudência sob demanda (`search_juris` e `fetch_juris`), matriz normativa `Statutory Bridge` (Lei 13.303 $\leftrightarrow$ Lei 14.133), ranking de relevância (`0..100 pts`), fatiamento anatômico em 10 camadas, trava anti-alucinação e homologação de 11 Cortes Oficiais.
- [x] **Marco 8 — `v1.5.0`:** Núcleo de fiscalização contratual (`docgov_audit_contract_execution` / `--audit-contract`), limites de aditamento de 25%/50% sem compensação, batimento quadripartite, reajustes/repactuações e governança determinística de ARP (`docgov_govern_arp` / `--govern-arp`) com travas de carona 50%/200%, compatibilidade jurídica/federativa e compilação OpenXML.
- [x] **Marco 8.5 — `v1.5.5`:** Processo Administrativo Sancionador (PAS) com dosimetria graduada e contraditório de 15 dias úteis, segregação ANS/IMR vs. multa sancionatória (`0,5%`–`30%`), governança de Seguro-Garantia, motor estatístico anti-outlier de cesta de preços (IN SEGES 65/2021, `CV <= 25%`), matriz de álea extraordinária e compilação OpenXML DOCX/PDF de notificações prévias e pareceres de dosimetria.
- [x] **Marco 8.6 — `v1.5.6`:** Adequação Federativa e Jurisdicional do PAS (Estadual/Municipal/Estatal junto a TCU/TCDF/TCE/TCM, regime estrito da Lei 13.303/2016 e competência privativa para Declaração de Inidoneidade com parecer jurídico conclusivo), cadastros obrigatórios (`CEIS`/`CNEP`/`PNCP`), calibragem jurisprudencial da dosimetria (LINDB Art. 22 e Lei 14.133 Art. 156, § 1º) e Quadros Federativo e de Dosimetria em DOCX/PDF.

---

## ✅ MARCO 9 — `v1.6.0` / `v1.6.4`: Seleção do Fornecedor 360º em TIC, Perícia Multimodal (`unpdf@2.1+`), Contratação Direta & Governança Lockstep (Geração 6 — CONCLUÍDO)

- [x] **9.1. Engenharia de Modelos de Execução de TIC sem DEMO e Julgamento de Exequibilidade de TI:**
  - **Matriz de Descaracterização de DEMO:**
    - Bloqueio determinístico de gatilhos de subordinação direta, controle de frequência/ponto, pessoalidade nominal ou pagamento fixo mensal sem vinculação a resultados em contratos de `UST`, `HST`, `Hora-Técnica`, `PF` e `SQUADs` (`[ICT_HIDDEN_LABOR_DEDICATION_DEMO_TRAP_BLOCK]`).
  - **Métricas de Faturamento de TI e Travas Normativas:**
    - Validação de Unidade de Serviço Técnico (`UST`, `USM`, `UNS`) contra equivalência espúria de homem-hora puro sem catálogo de complexidade e produto (Súmula TCU nº 269 -> `[ICT_UST_RAW_HOUR_EQUIVALENCE_SUMULA269_BLOCK]`);
    - Hora de Serviço Técnico (`HST` / `Hora-Técnica`) com teto prévio estimativo e vinculação mandatória a Ordens de Serviço (`[ICT_UNBOUNDED_TECHNICAL_HOUR_PARADOX_BLOCK]`);
    - Pontos de Função (`PF` — IFPUG / NESMA / SNAP) com regras de contagem e `SQUADs` ágeis atrelados a entregáveis de sprints e Acordos de Nível de Serviço (ANS).
  - **Exequibilidade Paramétrica de Propostas de TI e Diligência Obrigatória:**
    - Comparação paramétrica do valor implícito da UST, PF, Hora-Técnica ou Squad frente ao piso salarial e encargos sociais dos perfis profissionais mínimos exigidos no TR (`[ICT_PROPOSAL_BELOW_PROFILE_FLOOR_INEXEQUIBLE]`);
    - Trava jurisprudencial vinculante da **Súmula TCU nº 262** (`[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]`): vedação absoluta de desclassificação sumária por inexequibilidade sem oportunidade prévia de diligência formal para comprovação da exequibilidade de custos pelo licitante.

- [x] **9.2.A. Habilitação Técnico-Operacional e Qualificação Econômico-Financeira em TIC:**
  - **Conversibilidade de Métricas e Regras de Capacidade Técnica (Súmula TCU nº 263):**
    - Admissão de conversibilidade paramétrica de atestados entre métricas correlatas de TI (`UST <-> Horas <-> PF <-> Postos`) e bloqueio de exigência restritiva de métrica exclusiva (`[ICT_ACT_RIGID_METRIC_RESTRICTION_BLOCK]`);
    - Teto máximo de exigência de atestados fixado em no máximo 50% dos quantitativos dos itens de maior relevância e valor significativo (`[TECH_CAPACITY_EXCEEDS_50PCT_BLOCK]`);
    - Vedação de exigência de capacidade técnico-operacional sobre parcelas irrelevantes ou inferiores a 4% do valor total estimado (`[IRRELEVANT_PARCEL_BELOW_4PCT_BLOCK]`);
    - Admissão mandatória de somatório de atestados técnicos (`[SUM_OF_CERTIFICATES_MANDATORY_BLOCK]`).
  - **Auditoria Contábil de Índices Econômico-Financeiros:**
    - Cálculo de Índices de Liquidez Geral (`ILG`), Liquidez Corrente (`ILC`), Solvência Geral (`ISG`) e Endividamento Geral (`EG`);
    - Teto máximo de 10% do valor estimado para exigência de Patrimônio Líquido ou Capital Social mínimo;
    - Vedação absoluta de exigência cumulativa de Capital Social e Patrimônio Líquido (`[CUMULATIVE_CAPITAL_AND_EQUITY_BLOCK]`).

- [x] **9.2.B. Motor Forense Anti-Fraude de Autenticidade, Cruzamento Público de CNPJ e Diligência de ACT (Art. 64 da Lei 14.133/2021, Art. 56, § 2º da Lei 13.303/2016 e Acórdãos TCU 1.385/2016 e 1.211/2021-Plenário):**
  - **Vetor 1 (Incompatibilidade de Porte e CNAE do Emissor/Licitante):** Cruzamento público de CNPJ (`BrasilAPI` / Receita Federal com fallback mockado) verificando se o emissor do ACT (ex.: MEI/ME de ramo alheio como padaria/varejo) possui CNAE, natureza jurídica e capital social compatíveis com o volume de TI/serviços atestado (`[ACT_ISSUER_CNAE_OR_SCALE_MISMATCH_SUSPICION]`);
  - **Vetor 2 (Cronologia Impossível e Status Cadastral do CNPJ):** Cruzamento entre Data de Abertura, Data de Baixa/Inaptidão/Suspensão do CNPJ e o período de execução ou data de assinatura do ACT (`[ACT_CHRONOLOGY_OR_INACTIVE_CNPJ_FRAUD_BLOCK]`);
  - **Vetor 3 (Rastreabilidade de Emissor Público no PNCP):** Verificação de existência do Contrato/ARP/Empenho citado quando o emissor do ACT for órgão público ou estatal (`[ACT_PUBLIC_CONTRACT_UNVERIFIED_IN_PNCP]`);
  - **Vetor 4 (Conflito Societário QSA, Parentesco e Contato):** Cruzamento de sócios/administradores em comum, mesmo endereço/CEP ou e-mail corporativo inválido/gratuito entre emissor e licitante (`[ACT_RELATED_PARTY_SELF_ATTESTATION_ALERT]`);
  - **Vetor 5 (Plágio Literal do Edital / Copy-Paste Trap):** Similaridade textual determinística (token LCS/Jaccard) detectando quando um ACT pretérito copia literalmente frases e especificações do TR do edital atual (`[ACT_LITERAL_EDITAL_PLAGIARISM_DETECTED]`);
  - **Vetor 6 (Plausibilidade Volumétrica Tempo vs. Esforço):** Auditoria da razão `Volume de UST/Horas/Itens ÷ Prazo de Execução` frente ao porte da licitante (`[ACT_IMPLAUSIBLE_VOLUME_TIME_RATIO_ALERT]`);
  - **Vetor 7 (Metadados Forenses de PDF e Assinatura Digital):** Divergência temporal entre a data impressa no texto do ACT e a data de criação do PDF / assinatura digital ICP-Brasil/Gov.br sem ressalva de 2ª via (`[ACT_FORENSIC_SIGNATURE_DATE_MISMATCH]`).

- [x] **9.3. Auditoria Determinística de Contratação Direta (Inexigibilidade e Dispensa):**
  - **Inexigibilidade de Licitação (Art. 74 da Lei 14.133/2021 e Art. 30 da Lei 13.303/2016):**
    - Verificação de inviabilidade de competição, singularidade do serviço e notória especialização;
    - Trava contra atestados de exclusividade genéricos ou emitidos por entidades sem legitimidade (`[INVALID_EXCLUSIVITY_CERTIFICATE_BLOCK]` — Súmula TCU nº 255);
    - Comprovação obrigatória de razoabilidade de preços praticados pelo fornecedor perante outros entes públicos ou privados com mínimo de 3 contratos/notas fiscais recentes (`[INEXIGIBILITY_PRICE_PROOF_INSUFFICIENT_BLOCK]`).
  - **Dispensa de Licitação por Valor (Art. 75, I e II da Lei 14.133/2021 e Art. 29, I e II da Lei 13.303/2016):**
    - Motor anti-fracionamento de despesa no exercício financeiro para a mesma unidade gestora e mesma linha de fornecimento/serviço por código PDM / CATMAT / CATSER (`[EXPENSE_FRAGMENTATION_BLOCK]`).

- [x] **9.4. Regime Especial de Oportunidade de Negócio e Parcerias Estratégicas nas Estatais (Art. 28, § 3º, II da Lei 13.303/2016):**
  - Checklist determinístico de requisitos para dispensa de licitação em oportunidades de negócio empresarial: comprovação de inviabilidade ou desvantagem de procedimento concorrencial comercial, justificação técnica da escolha do parceiro e matriz de compartilhamento de riscos e resultados econômicos (`[STATE_ENTERPRISE_PARTNERSHIP_UNJUSTIFIED_BLOCK]`).

- [x] **9.5. Compilação Documental Nativa `.docx`/`.pdf` da Fase Externa e Contratação Direta:**
  - `Parecer_Julgamento_Proposta_Habilitacao_e_Diligencia.docx/.pdf`: Minuta técnica padronizada de julgamento de conformidade de propostas, admissibilidade de atestados e resultado de diligências;
  - `Oficio_e_Email_Diligencia_Veracidade_ACT.docx/.pdf`: Minutas formais de diligência investigativa de veracidade de atestados em duas vias canônicas:
    - *Via A (Ao Emissor do ACT):* E-mail/Ofício de confirmação de autenticidade endereçado aos contatos oficiais cadastrados na Receita Federal;
    - *Via B (À Licitante — Lastro Material Obrigatório):* Requisição formal de apresentação de Notas Fiscais Eletrônicas (NF-e/NFS-e com chave de 44 dígitos), Contrato assinado à época, Ordens de Serviço e comprovantes de recolhimento fiscal/trabalhista (SEFIP/eSocial) ou bancários;
  - `Parecer_Instrucao_Inexigibilidade_Dispensa_ou_Oportunidade_Estatal.docx/.pdf`: Peça de instrução processual para contratações diretas, atestando a presença de todos os requisitos legais e a razoabilidade dos preços pactuados.

- [x] **9.6. Consolidação `v1.6.2` — Upgrade `unpdf@2.1+`, Perícia Forense Dual `PDF/DOCX`, Ponte Multimodal `assets/`, Obras `75%/85%`, Jogo de Planilha & Fase Recursal (Art. 165):**
  - [x] **Ponte Multimodal `unpdf@2.1+` (`inspectPages`, `extractImages`, `registerImageDecoders`):** Classificação em 5 classes canônicas (`BORN_DIGITAL`, `FULL_PAGE_SCAN`, `HYBRID_HEADER_SCAN_TRAP`, `EMBEDDED_VISUAL_ASSET`, `OCR_LAYER_EMBEDDED`), extração pura JS compatível com `bun build --compile` (sem `@napi-rs/canvas`), filtro anti-ruído + SHA-256 repetido, materialização em `cases/<id>/assets/<stem>/pag_XXX_img_YY.png` e âncoras `[PAG_XXX | ASSET_IMG_YY]` na `visao_auditoria_*.md` e `dossie_hotspots_*.md`;
  - [x] **Perícia Forense Dual `PDF/DOCX` (`getMeta` + `docProps/core.xml` & `app.xml`) & Detecção de Conluio:** Unificação em `DocumentForensicMeta`, scanner de assinaturas `/Type /Sig` e `/M (D:...)`, alerta `[PDF_EDITOR_MANIPULATION_TRACE]`, inventário cruzado no `bootstrap_case` (`indice_mestre_caso.md`), detecção de colusão entre licitantes (`forensic_collusion_auditor.ts`) e simulação de cotações na contratação direta (`[PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK]` e `[INEXIGIBILITY_OVERPRICING_ABOVE_SUPPLIER_MARKET_PROOF_BLOCK]`), além de auto-hidratação em ACT (`> 180` dias, colisão de autor e `[ACT_PDF_EDITING_SOFTWARE_TRACE_SUSPICION]`);
  - [x] **Inexequibilidade `< 75%`, Garantia Adicional `75%..85%`, Jogo de Planilha & Fase Recursal (Art. 165/168):** Regra paramétrica de inexequibilidade/garantia adicional e alerta de Jogo de Planilha (`inexequibility_evaluator.ts`), além de admissibilidade e julgamento de recursos/contrarrazões (`appeals_evaluator.ts` e `appeals_docx_sections.ts` compilando `Peca_Razoes_ou_Contrarrazoes_Recurso_Administrativo.docx/.pdf` e `Decisao_Pregoeiro_e_Encaminhamento_Autoridade_Superior.docx/.pdf`).

---

## ✅ MARCO 9.5 — `v1.6.5` / `v1.6.6`: Regime de Dedicação Exclusiva de Mão de Obra (DEMO) & Obras e Serviços de Engenharia (Geração 6.5 — CONCLUÍDO)

- [x] **9.5.1. Motor de Modelagem e Julgamento de Planilhas de Custos e Formação de Preços em Regime DEMO (IN SEGES 05/2017, Decreto 12.174/2024 e Arts. 121 e 135 da Lei 14.133/2021 — entregue via `docgov_audit_demo_regime` e `audit-demo-regime` na `v1.6.5`):**
  - **Auditoria Aritmética e Normativa dos Módulos 1 a 6 em Centavos Inteiros:**
    - *Módulo 1:* Composição da remuneração, salário-base vinculado à CCT e adicionais de insalubridade/periculosidade (trava Súmula 448 TST);
    - *Módulo 2:* Encargos previdenciários, FGTS, SAT/RAT x FAP comprovado (GFIP/FAPWeb) e benefícios mensais/diários (auxílio-transporte com teto 6% e alimentação);
    - *Módulo 3:* Provisão para rescisão (API, multa FGTS e Aviso Prévio Trabalhado `1,94%` no 1º ano com trava de expurgo obrigatório na 1ª prorrogação — Acórdão TCU 1.586/2018);
    - *Módulo 4:* Custo de reposição de profissional ausente em regime de substituição;
    - *Módulo 5:* Insumos de mão de obra (uniformes, EPIs, materiais e depreciação);
    - *Módulo 6:* Custos indiretos, tributos por dentro (`PIS/COFINS/ISS`), alíquota efetiva no Lucro Real (Acórdão TCU 1.214/2013), vedação ao Simples Nacional em cessão de mão de obra (Art. 17, XII da LC 123/2006, salvo Anexo IV em limpeza/vigilância) e produtividade por $m^2$ (Anexo VI-B da IN 05/2017);
  - **Governança de Conta Vinculada vs. Pagamento pelo Fato Gerador e Repactuação:**
    - Monitoramento das provisões retidas em Conta-Depósito Vinculada (Anexo XII da IN 05/2017) ou adoção do Pagamento pelo Fato Gerador com glosa preventiva, e memória de cálculo de Repactuação Anual por CCT.

- [x] **9.5.2. Motor de Obras e Serviços de Engenharia (Art. 59, §§ 4º e 5º da Lei 14.133/2021, Arts. 42–43 da Lei 13.303/2016 e Acórdão TCU 2.622/2013 — entregue via `docgov_audit_engineering_works` e `audit-engineering-works` na `v1.6.6`):**
  - **Auditoria de BDI Geral vs. BDI Diferenciado e Administração Local:**
    - Análise de quartis de Bonificação e Despesas Indiretas (BDI) segundo o Acórdão TCU nº 2.622/2013 por tipologia de obra e exigência de BDI Diferenciado reduzido para materiais/equipamentos relevantes (Súmula TCU 253);
    - Bloqueio de inclusão de Administração Local, Canteiro e Mobilização dentro do BDI (*bis in idem*) e trava de medição proporcional ao avanço físico;
  - **Tabelas Referenciais Oficiais (`SINAPI`/`SICRO`), Desoneração (CPRB) e Cronograma Físico-Financeiro:**
    - Cruzamento analítico Curva ABC com tabelas `SINAPI` e `SICRO` (validando simetria `Com Desoneração vs. Sem Desoneração` — Lei 14.973/2024);
    - Detecção de *front-loading* no cronograma físico-financeiro e matriz de riscos obrigatória em Contratação Integrada/Semi-Integrada.

---

## 🕵️♂️ SÉRIE `v1.7.x` (GERAÇÃO 7): PERÍCIA FORENSE GEN7.0, HIGIENIZAÇÃO JURIS, TRAVAS LEGAIS BINÁRIAS DO PREGOEIRO & PROVA DE CONCEITO DUAL-MODE (16 TOOLS MCP MANTIDAS)

> **Diretriz Transversal de Higiene de Tokens MCP & Blindagem de Contratos Gen5 (Eixo 5 — `[CONCLUÍDO NA v1.6.10 / v1.6.11]` | Trava Ativa para `v1.7.x`/`v1.8.x`):** Padronização de descrições enxutas em `getMcpToolsDefinition()` (`src/mcp/tools_definition.ts`, `src/demo_costs/audit_runner.ts`, `src/engineering/tool_definition.ts`) com teto estrito de `<= 600` caracteres (~150 tokens) por tool no `tools/list`, guarda determinística anti-regressão em `test/mcp_spec.test.ts`, smoke test determinístico via `StdioClientTransport` real (`test/mcp_stdio_smoke.test.ts`), *Exact Copy-Paste Error* e detector determinístico de `unknown_keys` em `docgov_audit_contract_execution` e `docgov_govern_arp` (`v1.6.11`), mantendo o detalhamento exaustivo de contratos no `--dump-spec` (`docs/especificacao_motor.md`) e o envelope de retorno MCP estritamente `< 900 bytes` (Lei 2).

### MARCO 10.1 — `v1.7.0` / `v1.7.1` (Geração 7.0 — `[CONCLUÍDO]`)

> **Entregue na `v1.7.0` & Consolidado na `v1.7.1`:** Os Pilares Anti-Fraude 1 e 5 (Perícia Pure-JS `ASN.1/DER/BER` `PKCS#7/PAdES` & `/ByteRange`, Validador Módulo 11 NF-e 44 Dígitos, Clones `w:rsid` em `.docx`, `forensic_meta` para `.xlsx` e guarda `unknown_keys` Gen6), somados ao **Hotfix `v1.7.1`** (hierarquia Gov.br + caminhamento encadeado X.509, Smoke Test com Corpus Público Real `smoke:real` e Resiliência Unificada JURIS com `BaseJurisdictionProvider` / `force_live`), foram integralmente concluídos e registrados no [`CHANGELOG.md`](CHANGELOG.md). *(Reserva remanescente de hotfix: `v1.7.2`)*.

### MARCO 10.1B — `v1.7.3` / `v1.7.4` (Geração 7.3 + Trilha A — `[CONCLUÍDO]`)

- [x] **10.1B.1. Acumulação, Desduplicação & Blindagem de Concorrência (`juris_search_store.ts`):** Mutex em memória + lockfile externo + escrita segura, `matched_queries[]`, `queries_history[]`, `total_hits` (rodada) + `total_accumulated`, sem truncar `results[]` e envelope `< 900B`.
- [x] **10.1B.2. Taxonomia Neutra & Fim de Mutação de Query no TST:** Defaults `NEUTRAL`/`AUTO`, rebalanceamento `0..100` em consulta livre, fim de `"ATI"`/`"CAIXA"` e `"ORGAO_CONTRATANTE"`, `NAO_APLICAVEL`/`NAO_IDENTIFICADO`, `outcome` judicial neutro e calibração `filterTstHitsByPertinence`.
- [x] **10.1B.3. Cache Dinâmico Live-Backed TTL 24h TST (`tst_ttl_cache.ts`):** Fim do catálogo estático congelado, suporte ao vivo a `SUM`/`OJ`/`ACORDAO` com `DOCGOV_JURIS_CACHE_DIR` (inclusive Mock Mode) e falha explícita `LIVE_FAILED` / `[LIVE_UNAVAILABLE]` sem cache `< 24h`.
- [x] **10.1B.4. Integridade do Dossiê & Migração `inputs/` -> `state/` (`anatomical_markdown.ts`):** Inteiro teor gravado em `state/juris_<shortname>/inteiro_teor_anatomico.md`, ordenação `1->6`, `truncateCleanBoundary` e links diretos.
- [x] **10.1B.5. Trilha A (`v1.7.4`) — Camada Universal de I/O (`fs_safe_io.ts`), Blindagem `ENG-10` & Escopos Efêmeros (`ephemeral_scope.ts`):** Lock externo exclusivo em `%TEMP%/docgov_locks/`, escrita adaptativa (direta + retry `3x` no Windows fora de `%TEMP%` e atômica `.tmp + rename` com fallback em POSIX/`%TEMP%`), `enqueueWrite`/`flushPendingWrites` no shutdown MCP, `isValidDocGovCaseScope()` anti-*traversal* e anti-*symlink*, fechamento de bypasses nos 4 compiladores e `inspect.ts --compare`, preservação de subpastas efêmeras nomeadas, sessões isoladas `<prefix>_<ts>_<rand4hex>`, proteção cirúrgica `inputs/` -> `state/`, sweep lazy `>= 72h`, `formatCompactMcpPath()` sem `../` e higiene zero-vazamento nos 15 arquivos de teste.

### MARCO 10.1C — `v1.7.5` (Trilha A+ — MCP Híbrido `<= 8 KB` & Write-Behind Controlado)

- [ ] **10.1C.1. Evolução MCP Híbrido 8 KB & Write-Behind:** Elevação controlada do teto MCP em modo híbrido mantendo compatibilidade de fluxos e ativação opcional de *write-behind* sobre `enqueueWrite()` / `flushPendingWrites()`.

### MARCO 10.1D — `v1.7.6`–`v1.7.9` (Trilha B JURIS/AGU + Janelas de Amortecimento)

- [ ] **10.1D.1. Trilha B JURIS/AGU & Buffers:** Ampliação da cobertura e resiliência consultiva AGU/jurisprudencial com reserva de *patch* `v1.7.6`–`v1.7.9`.

### MARCO 10.2 — `v1.7.10` (Geração 7.10 — Fechamento Gen 7: Travas Legais Binárias do Pregoeiro em Sessão & Habilitação — 16 Tools MCP Mantidas) *(Reserva de Hotfix: `v1.7.11` | `Assert 38`)*

- [ ] **10.2.1. Integração Determinística à Rota E (`docgov_evaluate_bidding_proposals` e, no que couber, `docgov_audit_direct_contracting`) — Sem Heurística Especulativa de Cartel:**
  - **Impedimentos Objetivos (Art. 14 da Lei nº 14.133/2021 e Art. 38 da Lei nº 13.303/2016):** Verificação objetiva de sanção vigente informada nos autos no CNPJ ou sócio majoritário, autoria de projeto (básico/executivo/TR) e vínculo funcional impeditivo;
  - **Travas Aritméticas ME/EPP (Art. 4º, §§ 1º–2º da Lei nº 14.133/2021 e LC nº 123/2006):** Bloqueio automático de usufruto indevido dos benefícios diferenciados quando o valor estimado do lote exceder `R$ 4.800.000,00` ou quando a soma de contratos declarados no ano-calendário ultrapassar `R$ 4.800.000,00`;
  - **Consistência Básica do Balanço Patrimonial (Art. 69 da Lei nº 14.133/2021):** Verificação da equação fundamental da contabilidade em `BigInt` em centavos (`Ativo == Passivo + Patrimônio Líquido`) somada à checagem condicional de autenticação documental sem falso positivo tributário (aceitando recibo/hash `ECD` ou registro na Junta Comercial conforme porte e regime tributário aplicável);
  - **Subcontratação Ilícita (Art. 122 da Lei nº 14.133/2021):** Bloqueio de subcontratação sobre parcela principal habilitatória e impedimento objetivo do Art. 122, § 3º (vínculo/impedimento do subcontratado);
  - **Transparência de Escopo (`audit_coverage` em `state/`):** Emissão de relatório detalhado de `audit_coverage` em disco (`state/`) explicitando regras verificadas, dados ausentes e cobertura efetiva sem inflar o retorno sintético MCP `< 900B` (Lei 2).

### MARCO 10.3 — `v1.7.12` (Geração 7.12 — Fechamento Gen 7: Governança & Auditoria de Prova de Conceito `PoC` — Dual-Mode — 16 Tools MCP Mantidas) *(Reserva de Hotfix: `v1.7.13` | `Assert 39`)*

- [ ] **10.3.1. Governança & Auditoria de Prova de Conceito (`PoC`) Dual-Mode (Análise de Edital + Fase Externa):**
  - **Modo Análise de Edital (Dual-View):** Acoplamento à trilha de análise de edital contemplando tanto a **visão do Órgão** (adequação e segurança jurídica do rito) quanto a **visão de Inteligência Competitiva / Defesa para Impugnação** contra exigência de PoC direcionada ou restritiva;
  - **Modo Fase Externa & Laudo Pericial:** Seleção exclusiva do **1º colocado provisório** para realização da PoC e compilação padronizada em `.docx`/`.pdf` de `Roteiro_e_Laudo_Pericial_PoC.docx/.pdf`;
  - **Travas Jurisprudenciais TCU Obrigatórias:** Vedação absoluta de exigência de PoC na fase de habilitação ou imposta a todos os licitantes (`[POC_ALL_BIDDERS_BURDEN_BLOCK]`), obrigatoriedade de roteiro objetivo com critérios binários `PASS/FAIL` (`[POC_SUBJECTIVE_CRITERIA_BLOCK]`) e validação de proporcionalidade de prazo e escopo amostral.

---

## ⚙️ SÉRIE `v1.8.x` (GERAÇÃO 8): CICLO CONTRATUAL COMPLETO & PONTE OPEN-DATA (TOTALMENTE DESACOPLADA DE FRAUDE)

> **Diretriz Estrutural da Geração 8:** A Geração 8 conclui integralmente a governança contratual determinística (ACT oficial, PCA cross-caso, regime `SICX`, encerramento/TRD, mutabilidade econômica e reajuste em sentido estrito plugado em dados oficiais `BACEN`/`IBGE`) de forma totalmente desacoplada do pilar antifraude (Geração 10). Mantém estritamente `description <= 600` chars e envelope `< 900B`.

### MARCO 11.1 — `v1.8.0` (Geração 8.0 — 17ª Tool MCP `docgov_audit_contract_lifecycle`: ACT Oficial, PCA Cross-Caso, `SICX` & Encerramento/TRD) *(Reserva de Hotfix: `v1.8.1`–`v1.8.2` | `Assert 40`)*

- [ ] **11.1.1. 17ª Ferramenta MCP `docgov_audit_contract_lifecycle` (CLI `audit-contract-lifecycle`):**
  - **Emissor Oficial de Atestado de Capacidade Técnica (ACT) pelo Órgão Contratante (Art. 88, §§ 3º e 4º da Lei nº 14.133/2021):** Cruzamento determinístico entre Edital/TR/Contrato e Medições/OS/NFs/TRD sem glosas impeditivas, consolidando métricas conversíveis (`UST`, `PF`, `Postos`, `Horas`, `Itens`, `SLAs/IMR`), bloqueando emissão sobre parcelas não executadas (`[ACT_ISSUANCE_UNEXECUTED_BALANCE_BLOCK]`) e compilando `Atestado_Capacidade_Tecnica_Oficial_Orgao.docx/.pdf`;
  - **Livro-Razão PCA Cross-Caso (Art. 12, VII) & Regime `SICX` (Art. 75, § 7º):** Livro-razão anual persistente por `UG/PDM/CATMAT/CATSER` para governança do Plano de Contratações Anual e anti-fracionamento *cross-caso*; validação estrita do Sistema de Compras Expressas (`SICX`) em bens e serviços comuns padronizados de pronta entrega, vedando objetos complexos ou customizados (`[SICX_COMPLEX_OR_CUSTOM_OBJECT_MISUSE_BLOCK]`);
  - **Encerramento Contratual & Termo de Recebimento Definitivo (TRD):** Auditoria de quitação para liberação de Conta-Depósito Vinculada/Seguro-Garantia, verificação de Plano de Transição contratual e compilação de `Termo_Recebimento_Definitivo_e_Encerramento.docx/.pdf`.

### MARCO 11.2 — `v1.8.3` (Geração 8.3 — Expansão da 17ª Tool: Mutabilidade Contratual Documental — Repactuação, Fato do Príncipe & Revisão Híbrida) *(Reserva de Hotfix: `v1.8.4`–`v1.8.5` | `Assert 41`)*

- [ ] **11.2.1. Mutabilidade Contratual Documental na `docgov_audit_contract_lifecycle`:**
  - **Repactuação DEMO (Art. 6º, LIX e Art. 135 da Lei nº 14.133/2021):** Variação aritmética determinística dos Módulos 1 a 6 em `BigInt` por nova CCT/ACT com expurgo obrigatório de itens não renováveis;
  - **Fato do Príncipe Tributário Objetivo (Art. 134 da Lei nº 14.133/2021):** Reflexo aritmético direto da criação ou alteração legal de alíquotas de `ISS`, `PIS`, `COFINS` ou `CPRB` pós-apresentação da proposta;
  - **Revisão / Reequilíbrio Econômico-Financeiro Híbrido (Art. 124, II, "d" da Lei nº 14.133/2021 / Art. 81, VI da Lei nº 13.303/2016):** O **mérito fático probatório** da álea extraordinária e extracontratual é exclusivo do Agente Cognitivo Tier 2 Pro (nunca parametrizado por índice arbitrário no motor), cabendo ao motor exclusivamente as travas objetivas: (a) Matriz de Riscos (`[EXTRAORDINARY_RISK_ALLOCATED_TO_CONTRACTOR_BLOCK]`), (b) delta documental de `NF-e` (`época da proposta vs. época do pleito`) em `BigInt` e (c) vedação de majoração oportunista da margem de lucro original (`[REBALANCE_OPPORTUNISTIC_PROFIT_MARGIN_INCREASE_BLOCK]`);
  - **Compilação Executiva:** Geração de `Parecer_Reequilibrio_Economico_Financeiro.docx/.pdf`.

### MARCO 11.3 — `v1.8.6` (Geração 8.6 — Última Dedicada da Gen 8: Reajuste em Sentido Estrito + Abertura do Open-Data & 18ª Tool MCP `fetch_official_economic_indices`) *(Reserva de Hotfix: `v1.8.7`–`v1.8.9` | `Assert 42`)*

- [ ] **11.3.1. Shared Open-Data Kernel (`src/tools/open_data/`) & 18ª Tool MCP `fetch_official_economic_indices`:**
  - **Kernel Open-Data:** Cliente HTTP padronizado com *timeout*, *backoff*, Cache Dual (Camada 1 Global com TTL estratificado + Camada 2 imutável em `<caseDir>/state/open_data/`), sinalização consultiva `live_degraded`, guarda `ENG-10`, referências `open_data_refs` em disco e envelope MCP `< 900B` (Lei 2);
  - **Coleta Oficial `BACEN SGS/Olinda` & `IBGE SIDRA`:** Coleta ao vivo + fallback curado para séries oficiais (`IPCA`, `INPC`, `ICTI`, `IST`, `INCC`, além de suporte complementar `IGP-M`/`PTAX`) operando sobre números-índice para exatidão decimal;
  - **Plugagem 100% no Motor `BigInt` de Reajuste em Sentido Estrito (Art. 6º, LVIII; Art. 25, § 7º; Art. 92, § 3º):** Validação automática do interregno mínimo de 12 meses da data do orçamento estimado e cálculo em `BigInt` do fator acumulado oficial (`[OFFICIAL_INDEX_ACCUMULATED_FACTOR_MISMATCH_BLOCK]`), abrindo a esteira natural da Geração 9.

---

## 🌐 SÉRIE `v1.9.x` (GERAÇÃO 9): EXPANSÃO OPEN DATA & OPEN CONECTORES GOVERNAMENTAIS

> **Padrão Arquitetural Obrigatório:** Todos os conectores da Geração 9 operam sob o padrão **Live API Primary + Curated/Deterministic Fallback** (zero dependência de internet na suíte `bun test` hermética e validação real via `bun run test:live` com seletor `--connector=<ID>`), reutilizando o **Shared Open-Data Kernel** inaugurado na `v1.8.6` (Cache Dual, `state/open_data/`, `open_data_refs`, `enrichment_available`, Whitelist `ENG-10` e envelope MCP `< 900B`).
> **Credencial CGU *Non-Blocking*:** Resolução em cadeia `DOCGOV_CGU_API_KEY` (Env) $\rightarrow$ `~/.docgov/credentials.json` (ou `DOCGOV_CREDENTIALS_FILE`, fora do Git) $\rightarrow$ *skip* gracioso com `[INTEGRITY_PARTIAL_COVERAGE_NO_CGU_KEY_WARNING]`.
> **Exclusões Explícitas:** Zero scraping de certidões (`CND`, `FGTS`, `CNDT`, `SICAF`, `SEFAZ`); zero API live para tabelas `SINAPI`/`SICRO` (ingestão local via `.xlsx` em `inputs/`); e zero ingestão de Diários Oficiais na `v1.9.x`.

### MARCO 12.1 — `v1.9.0` (Geração 9.0 — 19ª Tool MCP `fetch_supplier_integrity`: Certidão Consolidada TCU *Zero-Key* + APIs CGU Opcionais) *(Reserva de Hotfix: `v1.9.1`–`v1.9.2` | `Assert 43`)*

- [ ] **12.1.1. 19ª Ferramenta MCP `fetch_supplier_integrity` (CLI `--check-integrity`):**
  - Consulta primária *zero-key* à **Certidão Consolidada do `TCU`** (agregando `TCU Inidôneos`, `CNJ/CNCIAI` Improbidade e `CEIS/CNEP` para Pessoa Jurídica) somada ao enriquecimento opcional nas APIs do Portal da Transparência (`CGU` — `CEIS`, `CNEP` e `CEPIM`) por CNPJ e CPF/CNPJ de sócios quando houver credencial configurada;
  - Verificação automática de sanções vigentes e alcance federativo (`[LIVE_CEIS_IMPEDIMENT_ACTIVE_IN_SPHERE_BLOCK]` / `[LIVE_TCU_CNEP_NATIONAL_DEBARMENT_BLOCK]`) com persistência em `state/open_data/`.

### MARCO 12.2 — `v1.9.3` (Geração 9.3 — 20ª Tool MCP `fetch_cnpj_profile`: Cascata Resiliente `BrasilAPI -> MinhaReceita -> ReceitaWS`) *(Reserva de Hotfix: `v1.9.4`–`v1.9.5` | `Assert 44`)*

- [ ] **12.2.1. 20ª Ferramenta MCP `fetch_cnpj_profile` (CLI `--fetch-cnpj`):**
  - Hidratação automática cadastral e societária em cascata resiliente **`BrasilAPI` $\rightarrow$ `MinhaReceita` $\rightarrow$ `ReceitaWS`** a partir do CNPJ: `QSA` atual com data de entrada, data de abertura, endereço normalizado/CEP, `CNAE` principal e secundários, porte (`ME/EPP/Demais`), capital social e situação cadastral na RFB (`[LIVE_CNPJ_INACTIVE_OR_SUSPENDED_RFB_BLOCK]`).

### MARCO 12.3 — `v1.9.6` (Geração 9.6 — 21ª Tool MCP `search_comprasgov_prices`: Catálogo `CATMAT/CATSER` Flexível & Preços Homologados 12m) *(Reserva de Hotfix: `v1.9.7`–`v1.9.9` | `Assert 45`)*

- [ ] **12.3.1. 21ª Ferramenta MCP `search_comprasgov_prices` (CLI `--search-comprasgov`):**
  - **Catálogo `CATMAT/CATSER` Flexível (`WARNING`, Nunca `BLOCK`):** Consulta cirúrgica aos módulos de Compras.gov.br com *Loose Semantic & Lexical Matching*, alertas estritamente consultivos (`[CATMAT_CATSER_LOOSE_ALIGNMENT_WARNING]`, `[CATMAT_GENERIC_UMBRELLA_CODE_WARNING]`) e recomendador **Top-3 códigos PDM/CATMAT/CATSER** aderentes;
  - **Preços Homologados 12m (Compras.gov.br / PNCP + Histórico Multi-Certame):** Extração da série dos últimos 12 meses para alimentar a cesta estatística da `IN SEGES 65/2021` (`price_basket_auditor.ts`) e fornecer histórico multi-certame estruturado em `state/open_data/`.

---

## 🛡️ SÉRIE `v1.10.x` (GERAÇÃO 10): PILAR ANTIFRAUDE DEDICADO — OPCIONAL, TRANSVERSAL & `ALERT-ONLY`

> **Diretriz Inegociável da Geração 10 (`ALERT-ONLY`):** Nenhuma heurística relacional ou estatística da Geração 10 emite `REJECTED` automático nem bloqueia habilitação/adjudicação por presunção. Todos os achados operam estritamente em modo **`ATTENTION_SIGNAL` ("Luz Amarela")** para diligência apuratória e decisão humana/cognitiva fundamentada.

### MARCO 13.1 — `v1.10.0` (Geração 10.0 — 22ª Tool MCP `docgov_audit_antifraud_and_integrity`: Radar Antifraude v1 — *Background Check* & `ALERT-ONLY`) *(Reserva de Hotfix: `v1.10.1`–`v1.10.2` | `Assert 46`)*

- [ ] **13.1.1. 22ª Ferramenta MCP `docgov_audit_antifraud_and_integrity` (CLI `audit-antifraud`):**
  - **Grafo Societário QSA/Contato Auto-Hidratado (`v1.9.3`):** Cruzamento de sócios, endereços, telefones e domínios de e-mail entre concorrentes ou fornecedores de cotações emitindo exclusivamente `ATTENTION_SIGNAL`;
  - **Indício de Empresa Sucessora / Fantasma (Art. 160 da Lei nº 14.133/2021 — `v1.9.0` + `v1.9.3`):** Correlação de vínculos e endereço/CNAE contra sancionadas (`TCU/CEIS/CNEP`) para sinalização preventiva de abuso da personalidade jurídica;
  - **Padrões de Propostas & Fusão Gen7.0:** Alinhamento matemático de propostas, desistência estratégica "coelho" qualificada, fusão estruturada com os achados forenses da Gen7.0 (`PAdES`, `NF-e`, `w:rsidRoot`, metadados `.xlsx`) e registro transparente de `audit_coverage` em `state/`.

### MARCO 13.2 — `v1.10.3` (Geração 10.3 — Expansão da 22ª Tool: Radar Antifraude v2 — Modo Auditoria / Controle Interno & `ALERT-ONLY`) *(Reserva de Hotfix: `v1.10.4+` | `Assert 47`)*

- [ ] **13.2.1. Radar Antifraude v2 (Modo Auditoria / Controle Interno):**
  - **Grafo Expandido Opcional:** Análise facultativa de ex-sócios, parentesco composto com *blocklist* anti-homônimo e compartilhamento de contador/`CRC`;
  - **Sinais Contábeis Avançados:** Liquidez artificial com partes relacionadas/empréstimos a sócios, aumento relâmpago de capital social sem integralização e somatório de coligadas no enquadramento `ME/EPP`;
  - ***Screening* Estatístico Multi-Certame (CADE/OCDE via `v1.9.6`) & Relatório Executivo:** Triagem estatística longitudinal entre certames com compilação de `Relatorio_Sinais_Integridade_e_Antifraude.docx/.pdf` (sempre sob taxonomia `ATTENTION_SIGNAL` / `ALERT-ONLY`).

---

## 🧩 SÉRIE `v1.11.x+` (GERAÇÃO 11+): VERTICAIS SETORIAIS PROFUNDAS (ORDEM FUTURA)

### MARCO 14.1 — `v1.11.x+` (23ª Tool+ — Especialidades Setoriais Dedicadas no Patamar de Obras e DEMO) *(`Assert 48+`)*

- [ ] **14.1.1. Vertical Inicial — Cloud FinOps & Licenciamento Enterprise de TIC:**
  - Motor setorial dedicado equivalente em profundidade aos motores de Obras e DEMO, auditando métricas de Unidades de Serviço em Nuvem (`USN`), comparação econômica entre instâncias reservadas plurianuais vs. sob demanda, travas contra pagamento `100% upfront` sem desconto/salvaguarda contratual, riscos de *True-Up* em licenciamento corporativo e modelagem de taxas de transferência (*egress fees*).

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
