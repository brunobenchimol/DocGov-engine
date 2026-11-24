# 🗺️ ROADMAP OFICIAL — `docgov-engine` (v1.1.x+)

> **Memória Histórica:** Para o histórico consolidado de versões desde o commit inicial (`v0.0.1`) até o lançamento principal (`v1.0.0 — Clean Cut`) e releases consolidadas da série `v1.x` (`v1.1.0` a `v1.5.0`), consulte o [CHANGELOG.md](CHANGELOG.md).
> **Propósito deste Documento:** Fonte única da verdade sobre o planejamento arquitetural, evoluções funcionais e marcos estratégicos futuros do motor (`v1.5.x+`).
> **Natureza Standalone & Desacoplada:** O `docgov-engine` é um motor autônomo e determinístico. Embora sirva como fundação para a camada de agentes do ecossistema `docgov`, ele possui ciclo próprio de evolução e pode ser utilizado de forma independente via CLI ou MCP por qualquer cliente, agente de IA ou pipeline automatizado.
> **Política de Versionamento Pareado (Lockstep `Major.Minor` com o repositório `DocGov`) & Janelas de Amortecimento (*Buffered Releases*):**
> O par `Major.Minor` (`1.2.x` a `1.8.x`) caminha em estrita sincronia funcional com o repositório irmão `DocGov`, agrupando conjuntos densos de funcionalidades por geração. A partir da série `v1.7.x`, adotamos a engenharia de **Releases Amortecidas** (`v1.7.0 -> v1.7.3 -> v1.7.5 -> v1.7.8 -> v1.7.10` e `v1.8.0 -> v1.8.3 -> v1.8.5 -> v1.8.8`), onde os saltos deliberados de versão reservam números de *patch* intermediários (`v1.7.1`/`1.7.2`, `v1.7.4`, `v1.8.1`/`1.8.2`, etc.) para absorver *hotfixes* de *smoke tests* e *dogfooding* real, mantendo cada ciclo de codificação e sua suíte de testes pequenos, coesos e à prova de regressões.
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
| **Geração 7.3** | `v1.7.3` *(hotfix `1.7.4`)* | 2ª Perna Anti-Fraude (Parte 2): Grafo Multi-CNPJ de Conluio Societário (`QSA`/Endereço/Contato) & Detector de Empresa Sucessora/Fantasma em Fraude à Sanção (Art. 160 / Acórdão TCU 2.218/2011) | `[PLANEJADO]` |
| **Geração 7.5** | `v1.7.5` *(hotfix `1.7.6–1.7.7`)* | 2ª Perna Anti-Fraude (Parte 3) & 15ª Tool MCP: Perícia Contábil Anti-Maquiagem de Balanço, Fraude ME/EPP (LC 123/2006 / R$ 4,8M), Subcontratação Ilícita (Art. 122) & `docgov_audit_antifraud_and_integrity` | `[PLANEJADO]` |
| **Geração 7.8** | `v1.7.8` *(hotfix `1.7.9`)* | Fechamento do Ciclo Contratual & 16ª Tool MCP: Mutabilidade Econômica (Reajuste/Repactuação/Fato do Príncipe vs. Revisão Art. 124, II, "d"), PCA Multi-Caso & Regime SICX (Art. 75, § 7º), Emissor Oficial de ACT (Art. 88, §§ 3º–4º), Encerramento/TRD & `docgov_audit_rebalance_and_closeout` | `[PLANEJADO]` |
| **Geração 7.10** | `v1.7.10` *(hotfix `1.7.11+`)* | Modalidades Avançadas de TIC & 17ª Tool MCP: Governança de Prova de Conceito (`PoC`), Licenciamento Enterprise & FinOps de Nuvem (`USN`) via `docgov_evaluate_poc_and_cloud_finops` | `[PLANEJADO]` |
| **Geração 8.0** | `v1.8.0` *(hotfix `1.8.1–1.8.2`)* | **[Fase 1 — Oficial]** Conectores de Dados Abertos (Parte 1): Shared Open-Data Kernel & Índices Econômicos Oficiais (`Banco Central SGS/Olinda + IBGE SIDRA` — IPCA, INPC, IGP-M, ICTI, IST, INCC, PTAX) via `fetch_official_economic_indices` | `[PLANEJADO]` |
| **Geração 8.3** | `v1.8.3` *(hotfix `1.8.4`)* | **[Fase 1 — Oficial]** Conectores de Dados Abertos (Parte 2): Integridade e Sanções ao Vivo (`TCU Certidão Consolidada zero-key [TCU + CEIS + CNEP + CNJ/CNCIAI]` & `CGU` opcional Env/Disco) via `fetch_supplier_integrity` | `[PLANEJADO]` |
| **Geração 8.5** | `v1.8.5` *(hotfix `1.8.6–1.8.7`)* | **[Fase 2 — Opt-In]** Conectores de Dados Abertos (Parte 3): Hidratação Cadastral RFB/CNPJ (`fetch_cnpj_profile` — `BrasilAPI → MinhaReceita → ReceitaWS`) & ME/EPP *Sniper* Opt-In (`PNCP Contratos`) | `[PLANEJADO]` |
| **Geração 8.8** | `v1.8.8` *(hotfix `1.8.9+`)* | **[Fase 2 — Opt-In]** Conectores de Dados Abertos (Parte 4): Catálogo `CATMAT/CATSER` Híbrido (*Loose Matching* `WARNING` + Top-3 Sugestões) & Painel de Preços Homologados 12m (`API Dados Abertos Compras.gov.br`) via `search_comprasgov_prices` | `[PLANEJADO]` |
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

## 🕵️♂️ SÉRIE `v1.7.x` (GERAÇÃO 7): 2ª PERNA DE BLINDAGEM ANTI-FRAUDE, FECHAMENTO DO CICLO CONTRATUAL & MODALIDADES AVANÇADAS DE TIC (Eixos 1, 2 e 5)

> **Diretriz Transversal de Higiene de Tokens MCP & Blindagem de Contratos Gen5 (Eixo 5 — `[CONCLUÍDO NA v1.6.10 / v1.6.11]` | Trava Ativa para `v1.7.x`/`v1.8.x`):** Padronização de descrições enxutas em `getMcpToolsDefinition()` (`src/mcp/tools_definition.ts`, `src/demo_costs/audit_runner.ts`, `src/engineering/tool_definition.ts`) com teto estrito de `<= 600` caracteres (~150 tokens) por tool no `tools/list`, guarda determinística anti-regressão em `test/mcp_spec.test.ts`, smoke test determinístico via `StdioClientTransport` real (`test/mcp_stdio_smoke.test.ts`), *Exact Copy-Paste Error* e detector determinístico de `unknown_keys` em `docgov_audit_contract_execution` e `docgov_govern_arp` (`v1.6.11`), mantendo o detalhamento exaustivo de contratos no `--dump-spec` (`docs/especificacao_motor.md`) e o envelope de retorno MCP estritamente `< 900 bytes` (Lei 2).

### MARCO 10.1 — `v1.7.0` / `v1.7.1` (Geração 7.0 — `[CONCLUÍDO]`)

> **Entregue na `v1.7.0` & Consolidado na `v1.7.1`:** Os Pilares Anti-Fraude 1 e 5 (Perícia Pure-JS `ASN.1/DER/BER` `PKCS#7/PAdES` & `/ByteRange`, Validador Módulo 11 NF-e 44 Dígitos, Clones `w:rsid` em `.docx`, `forensic_meta` para `.xlsx` e guarda `unknown_keys` Gen6), somados ao **Hotfix `v1.7.1`** (hierarquia Gov.br + caminhamento encadeado X.509, Smoke Test com Corpus Público Real `smoke:real` e Resiliência Unificada JURIS com `BaseJurisdictionProvider` / `force_live`), foram integralmente concluídos e registrados no [`CHANGELOG.md`](CHANGELOG.md). *(Reserva remanescente de hotfix: `v1.7.2`)*.

### MARCO 10.2 — `v1.7.3` (Geração 7.3 — Rede de Conluio Societário QSA, Cartel Familiar & Sucessão Fraudulenta em Sanções) *(Reserva de Hotfix: `v1.7.4`)*

- [ ] **10.2.1. Pilar Anti-Fraude 2 (`collusion_graph_auditor.ts`):**
  - Grafo multi-CNPJ cruzando quadro societário (`QSA`), sobrenomes familiares combinados com mesmo endereço/CEP, telefone, domínio de e-mail ou contador entre concorrentes de licitação ou fornecedores de cotações preliminares (`[BID_RIGGING_SHARED_QSA_OR_ADDRESS_NETWORK_BLOCK]`).
- [ ] **10.2.2. Detector de Empresa Sucessora / Fantasma em Fraude à Sanção (Art. 160 da Lei 14.133/2021 e Acórdão TCU 2.218/2011-Plenário):**
  - Cruzamento de sócios, ex-sócios, cônjuges/parentes, endereço e CNAE da licitante contra empresas sancionadas no `CEIS / CNEP / TCU Inidôneos` para detectar abuso da personalidade jurídica (`[SANCTION_EVASION_SUCCESSOR_COMPANY_ALERT]`).

### MARCO 10.3 — `v1.7.5` (Geração 7.5 — Perícia Contábil Anti-Maquiagem de Balanço, Fraude ME/EPP LC 123/2006, Subcontratação Ilícita & 15ª Tool MCP) *(Reserva de Hotfix: `v1.7.6`–`v1.7.7`)*

- [ ] **10.3.1. Pilar Anti-Fraude 3 (Auditoria Forense de Balanço Patrimonial):**
  - Verificação da equação fundamental da contabilidade (`Ativo != Passivo + PL` -> `[FINANCIAL_BALANCE_SHEET_EQUATION_FRAUD_BLOCK]`);
  - Expurgo de liquidez artificial inflada por créditos com partes relacionadas/empréstimos a sócios (`[FINANCIAL_ARTIFICIAL_LIQUIDITY_RELATED_PARTIES_ALERT]`);
  - Detecção de aumento relâmpago de capital social às vésperas do certame sem integralização (`[FINANCIAL_UNINTEGRALIZED_CAPITAL_SPIKE_ALERT]`);
  - Exigência de recibo/hash do SPED Contábil `ECD` ou registro na Junta Comercial (`[FINANCIAL_MISSING_SPED_ECD_HASH_BLOCK]`).
- [ ] **10.3.2. Pilar Anti-Fraude 4 (Fraude ao Enquadramento ME/EPP & Subcontratação Irregular Art. 122):**
  - Auditoria do somatório de receitas brutas/contratos públicos e empresas coligadas contra o teto da LC 123/2006 (`[ME_EPP_REVENUE_CAP_FRAUD_BLOCK]`);
  - Aplicação da trava do Art. 4º, § 1º da Lei 14.133/2021 quando o lote excede R$ 4,8M (`[ME_EPP_LOT_EXCEEDS_4_8M_BENEFIT_FORBIDDEN_BLOCK]`);
  - Bloqueio de subcontratação de parcela principal habilitatória (`[ILLEGAL_CORE_PARCEL_SUBCONTRACTING_BLOCK]`) e vedação de subcontratação com vínculo/impedimento do Art. 122, § 3º (`[SUBCONTRACTING_CONFLICT_OF_INTEREST_ART122_BLOCK]`).
- [ ] **10.3.3. 15ª Ferramenta MCP `docgov_audit_antifraud_and_integrity` (CLI `audit-antifraud`):**
  - Consolida os 5 pilares da 2ª Perna Anti-Fraude e compila em `.docx`/`.pdf` o `Laudo_Pericial_Forense_Integridade_e_Antifraude.docx/.pdf`.

### MARCO 10.4 — `v1.7.8` (Geração 7.8 — Mutabilidade Econômica Art. 124/134/135, PCA & Regime SICX, Emissor Oficial de ACT & Encerramento Contratual) *(Reserva de Hotfix: `v1.7.9`)*

- [ ] **10.4.1. 16ª Ferramenta MCP `docgov_audit_rebalance_and_closeout` (CLI `audit-rebalance-closeout`):**
  - **Dogmática Jurídica da Mutabilidade Econômica — Separação Estrita Determinístico (Motor) vs. Subjetivo (Agente Tier 2 / Pro) (Art. 37, XXI da CF/88 e Lei nº 14.133/2021):**
    - *100% Determinístico no Motor (`BigInt` em centavos):* (1) **Reajuste em Sentido Estrito** (Art. 6º, LVIII e Art. 92, § 3º — Álea Ordinária Inflacionária: interregno de 12 meses da data do orçamento estimado do Art. 25, § 7º e fator acumulado do índice contratual `IPCA`, `INPC`, `ICTI`, `IST`, `INCC`); (2) **Repactuação** (Art. 6º, LIX e Art. 135 — Álea Ordinária Mão de Obra `DEMO`: variação dos Módulos 1 a 6 por nova CCT/ACT com expurgo de itens não renováveis); e (3) **Fato do Príncipe Tributário Objetivo** (Art. 134: reflexo aritmético direto de criação/alteração de alíquota legal de `ISS`, `PIS/COFINS` ou `CPRB` pós-proposta);
    - *Híbrido na Revisão / Reequilíbrio Stricto Sensu (Art. 124, II, "d" / Art. 81, VI da Lei nº 13.303/2016 — Álea Extraordinária e Extracontratual):* o **mérito fático probatório** (caso fortuito, força maior, desastres naturais ou choques imprevistos) é exclusivo do Agente Cognitivo Tier 2 / Pro (nunca parametrizado por índice arbitrário no motor), cabendo ao `docgov-engine` exclusivamente as travas objetivas de admissibilidade: (a) não alocação do evento à contratada na Matriz de Riscos (`[EXTRAORDINARY_RISK_ALLOCATED_TO_CONTRACTOR_BLOCK]`), (b) exatidão aritmética em centavos da planilha de custos comprovados (`NF-e época da proposta vs. NF-e atual`) e (c) bloqueio de majoração oportunista da margem de lucro original (`[REBALANCE_OPPORTUNISTIC_PROFIT_MARGIN_INCREASE_BLOCK]`);
  - **Governança de PCA Multi-Caso & Regime `SICX` (Sistema de Compras Expressas / E-Commerce Público — Art. 75, § 7º):**
    - Livro-razão anual persistente por `UG/PDM/CATMAT/CATSER` para governança do PCA (Art. 12, VII) e anti-fracionamento *cross-caso*;
    - Validação de enquadramento estrito do `SICX` em bens e serviços comuns padronizados de pronta entrega (bloqueando objetos complexos ou customizados de TIC/engenharia -> `[SICX_COMPLEX_OR_CUSTOM_OBJECT_MISUSE_BLOCK]`), controle automático de teto anual e anti-fracionamento por Unidade Gestora e classe `PDM/CATMAT/CATSER`, além de verificação de vantajosidade eletrônica em marketplace governamental;
  - **Emissor Oficial de Atestado de Capacidade Técnica (ACT) pelo Órgão Contratante (Art. 88, §§ 3º e 4º da Lei nº 14.133/2021) & Encerramento Contratual:**
    - Cruzamento determinístico entre Edital/TR/Contrato e Medições/OS/NFs/TRD sem glosas impeditivas, consolidando métricas conversíveis (`UST`, `PF`, `Postos`, `Horas`, `Itens`, `SLAs/IMR`) e bloqueando emissão sobre parcelas não executadas ou com saldo pendente (`[ACT_ISSUANCE_UNEXECUTED_BALANCE_BLOCK]`);
    - Compilação de `Atestado_Capacidade_Tecnica_Oficial_Orgao.docx/.pdf` (quadro analítico de parcelas executadas, ID canônico do Contrato no PNCP e histórico de ANS), além da auditoria de quitação para liberação de Conta Vinculada/Seguro-Garantia, Plano de Transição de TI e compilação de `Termo_Recebimento_Definitivo_e_Encerramento.docx/.pdf` e `Parecer_Reequilibrio_Economico_Financeiro.docx/.pdf`.

### MARCO 10.5 — `v1.7.10` (Geração 7.10 — Governança de Prova de Conceito PoC, Procedimentos Auxiliares & FinOps de Nuvem / Licenciamento Enterprise) *(Reserva de Hotfix: `v1.7.11+`)*

- [ ] **10.5.1. 17ª Ferramenta MCP `docgov_evaluate_poc_and_cloud_finops` (CLI `evaluate-poc-cloud`):**
  - Motor determinístico de Prova de Conceito (bloqueando exigência de PoC na fase de habilitação ou de todos os licitantes `[POC_ALL_BIDDERS_BURDEN_BLOCK]`, exigindo roteiro binário objetivo `[POC_SUBJECTIVE_CRITERIA_BLOCK]` e compilando `Roteiro_e_Laudo_Pericial_PoC.docx/.pdf`);
  - Auditoria de Licenciamento de Software e FinOps de Nuvem (métricas de Unidades de Serviço em Nuvem `USN`, comparação reserva plurianual vs. sob demanda, bloqueio de pagamento 100% *upfront* sem desconto/salvaguarda e riscos de *True-Up* / *egress fees*).

---

## 🌐 SÉRIE `v1.8.x` (GERAÇÃO 8): CONECTORES DE DADOS ABERTOS GOVERNAMENTAIS COM RESILIÊNCIA DUPLA (Eixo 3)

> **Padrão Arquitetural Obrigatório:** Todos os conectores da Geração 8 operam estritamente sob o padrão **Live API Primary + Curated/Deterministic Fallback**, garantindo zero dependência de internet na suíte `bun test` hermética e validação real contra as APIs públicas via `bun run test:live` com seletor `--connector=<ID>`.

- **Estruturação em 2 Fases:**
  - **Fase 1 — Conectores Oficiais Sólidos (`v1.8.0` e `v1.8.3`):** APIs institucionais de alta estabilidade para índices econômicos oficiais (`BACEN`/`IBGE`) e integridade sancionatória (`TCU` *zero-key* + enriquecimento `CGU`);
  - **Fase 2 — Conectores Sensíveis / Opt-In Sob Demanda (`v1.8.5` e `v1.8.8`):** Hidratação cadastral RFB/CNPJ, teto de faturamento ME/EPP *Sniper* e catálogo/preços homologados `Compras.gov.br`.
- **Fronteira Determinístico vs. Cognitivo:** O motor **nunca** dispara chamadas de rede em cascata por conta própria; cada conector retorna envelope sintético MCP `< 900B` (Lei 2) com `artifact_path` + campo consultivo `enrichment_available`, cabendo aos motores analíticos (Gen 5/6/7) consumir os JSONs completos direto do disco via `open_data_refs`.
- **Whitelist `ENG-10` & Cache Dual:** Aplicação obrigatória de whitelist `ENG-10` nas 4 tools combinada ao **Cache Dual**:
  - *Camada 1 (Global):* TTL `365d+` para histórico imutável com janela `24h` nos últimos `45d`; `30d` para perfis CNPJ/preços; `90d` para catálogo `CATMAT/CATSER`; e `24h` para sanções/ME-EPP;
  - *Camada 2 (Por Caso):* Snapshot imutável persistido em `<caseDir>/state/open_data/`.
- **Credencial CGU *Non-Blocking*:** Resolução em cadeia `DOCGOV_CGU_API_KEY` (Env) $\rightarrow$ `~/.docgov/credentials.json` (ou `DOCGOV_CREDENTIALS_FILE`, fora do Git) $\rightarrow$ *skip* gracioso (tanto em produção quanto na suíte `tests_live/`).
- **Exclusões Explícitas (`v1.8.x`):** Zero scraping de certidões (`CND`, `FGTS`, `CNDT`, `SICAF`, `SEFAZ`); zero API live para tabelas `SINAPI` (mensal) e `SICRO` (trimestral) — ingestão local via `.xlsx` em `inputs/`; e zero ingestão de Diários Oficiais na `v1.8.x`.
- **Nota de Revisão Pré-Execução:** Revalidar disponibilidade, limites de taxa e contratos das APIs em novo brainstorm ao concluir a `v1.7.x`.

### MARCO 11.1 — `v1.8.0` (Geração 8.0 — Fase 1 [Oficial]: Shared Open-Data Kernel & Índices Econômicos Oficiais: `Banco Central SGS/Olinda + IBGE SIDRA`) *(Reserva de Hotfix: `v1.8.1`–`v1.8.2`)*

- [ ] **11.1.1. Shared Open-Data Kernel (`src/tools/open_data/`):**
  - Cliente HTTP padronizado com *timeout*, *backoff* e isolamento offline, implementando o Cache Dual (Camada 1 Global + Camada 2 `<caseDir>/state/open_data/`), guarda `ENG-10`, referências `open_data_refs` em disco e sinalização consultiva `enrichment_available` no envelope `< 900B` (Lei 2).
- [ ] **11.1.2. Ferramenta `fetch_official_economic_indices` (CLI `--fetch-indices`):**
  - Consulta as APIs oficiais do `BACEN` (`bcdata.sgs` e **BCB Olinda** para `PTAX`) e `IBGE` (`SIDRA` operando sobre **números-índice** para exatidão decimal) para calcular ao centavo o fator acumulado exato no interregno contratual de **IPCA, INPC, IGP-M, ICTI (Ipea), IST (Anatel), INCC e PTAX**;
  - Suporte nativo a **tabelas históricas curadas embutidas + sync live opcional** para `ICTI (Ipea)` e `IST (Anatel)`, barrando pleitos de reajuste ou reequilíbrio com índices divergentes da série oficial (`[OFFICIAL_INDEX_ACCUMULATED_FACTOR_MISMATCH_BLOCK]`).

### MARCO 11.2 — `v1.8.3` (Geração 8.3 — Fase 1 [Oficial]: Conector de Integridade e Sanções: `TCU Certidão Consolidada + CEIS + CNEP + CEPIM + TCU Inidôneos/Inabilitados`) *(Reserva de Hotfix: `v1.8.4`)*

- [ ] **11.2.1. Ferramenta `fetch_supplier_integrity` (CLI `--check-integrity`):**
  - **Camada *Zero-Key* (`TCU Certidão Consolidada`) + Enriquecimento Opcional `CGU`:** Consulta a Certidão Consolidada do `TCU` (*zero-key*, que já traz agregados `CEIS + CNEP` para Pessoa Jurídica, além de `TCU Inidôneos/Inabilitados` e `CNJ/CNCIAI` Improbidade) e, mediante credencial *non-blocking* (`DOCGOV_CGU_API_KEY` $\rightarrow$ `~/.docgov/credentials.json` / `DOCGOV_CREDENTIALS_FILE` $\rightarrow$ *skip* gracioso), complementa via API do Portal da Transparência (`CGU` — `CEIS + CNEP + CEPIM`) por CNPJ da licitante e CPF/CNPJ de seus sócios (`QSA`); na ausência de chave CGU, prossegue normalmente emitindo alerta consultivo `[INTEGRITY_PARTIAL_COVERAGE_NO_CGU_KEY_WARNING]` sem bloquear o fluxo;
  - Verifica sanções vigentes e alcance federativo (`[LIVE_CEIS_IMPEDIMENT_ACTIVE_IN_SPHERE_BLOCK]` / `[LIVE_TCU_CNEP_NATIONAL_DEBARMENT_BLOCK]`), alimentando automaticamente o detector de sucessão fraudulenta da `v1.7.3` via `open_data_refs`.

### MARCO 11.3 — `v1.8.5` (Geração 8.5 — Fase 2 [Opt-In]: Conector Cadastral Receita Federal / CNPJ Público & ME/EPP *Sniper* Opt-In) *(Reserva de Hotfix: `v1.8.6`–`v1.8.7`)*

- [ ] **11.3.1. Ferramenta `fetch_cnpj_profile` (CLI `--fetch-cnpj`) — Cascata Mono-Usuário `BrasilAPI → MinhaReceita → ReceitaWS`:**
  - Hidratação automática ao vivo de dados societários e cadastrais em cascata (`BrasilAPI → MinhaReceita → ReceitaWS`, como 3º fallback de emergência) a partir apenas do CNPJ, cobrindo 100% dos dados do Cartão CNPJ (situação cadastral, data de abertura, capital social, porte ME/EPP, Simples/MEI, CNAE principal/secundários, QSA completo com `data_entrada_sociedade`/CPF mascarado e endereço/CEP/e-mail na RFB), alimentando sem fricção os 7 Vetores de ACT (Geração 6) e o Grafo de Conluio Societário (Geração 7.3) via `open_data_refs` (`[LIVE_CNPJ_INACTIVE_OR_SUSPENDED_RFB_BLOCK]` e `[LIVE_QSA_AUTO_HYDRATED_COLLUSION_MATCH]`).
- [ ] **11.3.2. Teto de Faturamento ME/EPP *Sniper* Opt-In (`PNCP Contratos` + `Despesas CGU`):**
  - Opera exclusivamente sob disparo explícito (`check_public_revenue_cap: false` por padrão $\rightarrow$ sinalização consultiva via `enrichment_available`), consultando o acumulado contratual no `PNCP Contratos` e em despesas públicas `CGU` somente quando acionado para confrontar o teto da LC nº 123/2006 (`v1.7.5`).

### MARCO 11.4 — `v1.8.8` (Geração 8.8 — Fase 2 [Opt-In]: Conector Catálogo `CATMAT/CATSER` Híbrido & Painel de Preços Homologados 12m: `API Dados Abertos Compras.gov.br`) *(Reserva de Hotfix: `v1.8.9+`)*

- [ ] **11.4.1. Ferramenta `search_comprasgov_prices` (CLI `--search-comprasgov`):**
  - **Fluxo Híbrido Anti-Lentidão & Janela Estrita de 12 Meses (`IN SEGES 65/2021`):** Recebe códigos candidatos já levantados do TR ou via `search_web` pelo agente para consulta cirúrgica nos módulos `/modulo-material`, `/modulo-servico` e `/modulo-pesquisa-preco` de `dadosabertos.compras.gov.br` e extrai séries de preços praticados nos **últimos 12 meses** em licitações homologadas para alimentar diretamente o cálculo estatístico da `IN SEGES 65/2021` (`price_basket_auditor.ts`);
  - **Matching Flexível (*Loose Semantic & Lexical Range*) com Severidade Estritamente Consultiva (`WARNING`, Nunca `BLOCK`):** avalia aderência por faixa (*range*) de classe/família/PDM (reconhecendo que itens compostos ou de TIC nem sempre possuem encaixe 1:1 perfeito no catálogo federal), emitindo exclusivamente alertas consultivos em caso de baixa aderência semântica ou uso de código abrangente (`[CATMAT_CATSER_LOOSE_ALIGNMENT_WARNING]` e `[CATMAT_GENERIC_UMBRELLA_CODE_WARNING]`), jamais bloqueando a minuta ou reprovando a contratação;
  - **Motor Recomendador (`Top-3 Suggested Codes`):** sempre que identificar código sub-ótimo ou com baixa aderência, retorna automaticamente os **Top 3 códigos PDM/CATMAT/CATSER mais aderentes** do catálogo oficial (código, descrição oficial, PDM e unidade de fornecimento) para apoiar a decisão do gestor.

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
