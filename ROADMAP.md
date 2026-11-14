# 🗺️ ROADMAP OFICIAL — `docgov-engine` (v1.1.x+)

> **Memória Histórica:** Para o histórico consolidado de versões desde o commit inicial (`v0.0.1`) até o lançamento principal (`v1.0.0 — Clean Cut`) e releases consolidadas da série `v1.x` (`v1.1.0` a `v1.5.0`), consulte o [CHANGELOG.md](CHANGELOG.md).
> **Propósito deste Documento:** Fonte única da verdade sobre o planejamento arquitetural, evoluções funcionais e marcos estratégicos futuros do motor (`v1.5.x+`).
> **Natureza Standalone & Desacoplada:** O `docgov-engine` é um motor autônomo e determinístico. Embora sirva como fundação para a camada de agentes do ecossistema `docgov`, ele possui ciclo próprio de evolução e pode ser utilizado de forma independente via CLI ou MCP por qualquer cliente, agente de IA ou pipeline automatizado.
> **Política de Versionamento Pareado (Lockstep `Major.Minor` com o repositório `DocGov`):**
> O par `Major.Minor` (`1.2.x`, `1.3.x`, `1.4.x`, `1.5.x`, `1.6.x`) caminha em estrita sincronia funcional com o repositório irmão `DocGov`, agrupando conjuntos densos de funcionalidades por geração. Evoluções incrementais, hotfixes e melhorias internas de robustez utilizam exclusivamente o dígito `Patch` (`.x`), evitando inflação desnecessária de números de versão e assegurando previsibilidade arquitetural entre a engine e a camada de agentes.
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
| **Geração 6** | `v1.6.0` | Seleção do Fornecedor 360º em TIC & Contratação Direta — Modelos de Mão de Obra sem DEMO (`UST`, `HST`, `Hora-Técnica`, `PF`, `SQUADs`), Exequibilidade de Perfis de TI, Conversibilidade de Atestados, Motor Forense Anti-Fraude de ACT (7 Vetores + CNPJ/CNAE) e Contratação Direta / Oportunidade de Negócio Estatal | `[PRÓXIMO FOCO ATIVO]` |
| **Geração 6.5** | `v1.6.5` | Regime de Dedicação Exclusiva de Mão de Obra (`DEMO` — Planilha de Custos Módulos 1 a 6, Conta Vinculada vs. Fato Gerador) & Julgamento de Obras e Serviços de Engenharia (Inexequibilidade 75%/85%, BDI Acórdão TCU 2.622/2013 e SINAPI/SICRO) | `[PLANEJADO]` |
| **Major** | `v2.0.0` | Breaking Changes Reais em contratos públicos ou arquitetura de ferramentas MCP | `[RESERVADO]` |

---

## 🔌 TRILHA CONTÍNUA DE CONECTORES JURISPRUDENCIAIS SOB DEMANDA (On-Demand Track — Patch `+0.0.1`)

> **Protocolo Operacional:** Conforme homologado a partir da `v1.4.6`, a esteira de novos tribunais de contas estaduais e municipais opera de forma contínua e independente de marcos funcionais maiores, seguindo o playbook de 2 fases e 4 micro-commits em [`docs/JURIS_CONNECTOR_PLAYBOOK.md`](docs/JURIS_CONNECTOR_PLAYBOOK.md).

### 🏛️ Tabela de Cobertura Federativa e Fila Prioritária de Homologação

| Nível / Onda | Tribunais de Contas | Cobertura e Estratégia | Status |
| :--- | :--- | :--- | :--- |
| **1. Base Homologada (11/11)** | **Federais:** `TCU`, `STJ`, `STF`, `TST`, `AGU/CGU`<br>**Estaduais / DF:** `TCE-PA`, `TCE-CE`, `TCDF`, `TCE-SP`, `TCE-MG`, `TCE-PR` | Arquitetura unificada de Resiliência Dupla (*Live Primary + Curated Fallback*), roteamento plug-and-play e Sub-Asserts do `DocGov`. | `[x] HOMOLOGADO` |
| **2. Onda 3 — Tribunais Municipais (5 TCMs)** | `[ ] TCM-PA` (Municípios do Pará)<br>`[ ] TCM-SP` (Capital de São Paulo)<br>`[ ] TCM-RIO` (Capital do Rio de Janeiro)<br>`[ ] TCM-BA` (Municípios da Bahia)<br>`[ ] TCM-GO` (Municípios de Goiás) | **🔥 Alta Prioridade:** Conectores especializados para as 5 cortes de contas municipais do Brasil, com higiene de auto-trigger anti-colisão com TCEs homônimos. | `[ ] PRIORIDADE 1` |
| **3. Onda 2 Restante — Grandes Cortes Estaduais (6 TCEs)** | `[ ] TCE-RJ` (Rio de Janeiro)<br>`[ ] TCE-RS` (Rio Grande do Sul)<br>`[ ] TCE-PE` (Pernambuco)<br>`[ ] TCE-BA` (Bahia)<br>`[ ] TCE-SC` (Santa Catarina)<br>`[ ] TCE-AM` (Amazonas) | **🔥 Alta Prioridade:** Conectores com repertório normativo curado, Súmulas e busca live para os maiores tribunais estaduais restantes. | `[ ] PRIORIDADE 2` |
| **4. Onda 4 — Demais 15 TCEs Estaduais** | `GO`, `ES`, `MT`, `MS`, `MA`, `RN`, `PB`, `AL`, `SE`, `PI`, `RO`, `AC`, `AP`, `RR`, `TO` | **Graceful Fallback Ativo:** Operam com busca automática na camada federal e aviso amigável; homologáveis individualmente sob demanda via patch `+0.0.1`. | `[ ] SOB DEMANDA` |

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

## 🎯 MARCO 9 — `v1.6.0`: Seleção do Fornecedor 360º em TIC & Contratação Direta (Geração 6 — PRÓXIMO FOCO ATIVO)

- [ ] **9.1. Engenharia de Modelos de Execução de TIC sem DEMO e Julgamento de Exequibilidade de TI:**
  - **Matriz de Descaracterização de DEMO:**
    - Bloqueio determinístico de gatilhos de subordinação direta, controle de frequência/ponto, pessoalidade nominal ou pagamento fixo mensal sem vinculação a resultados em contratos de `UST`, `HST`, `Hora-Técnica`, `PF` e `SQUADs` (`[ICT_HIDDEN_LABOR_DEDICATION_DEMO_TRAP_BLOCK]`).
  - **Métricas de Faturamento de TI e Travas Normativas:**
    - Validação de Unidade de Serviço Técnico (`UST`, `USM`, `UNS`) contra equivalência espúria de homem-hora puro sem catálogo de complexidade e produto (Súmula TCU nº 269 -> `[ICT_UST_RAW_HOUR_EQUIVALENCE_SUMULA269_BLOCK]`);
    - Hora de Serviço Técnico (`HST` / `Hora-Técnica`) com teto prévio estimativo e vinculação mandatória a Ordens de Serviço (`[ICT_UNBOUNDED_TECHNICAL_HOUR_PARADOX_BLOCK]`);
    - Pontos de Função (`PF` — IFPUG / NESMA / SNAP) com regras de contagem e `SQUADs` ágeis atrelados a entregáveis de sprints e Acordos de Nível de Serviço (ANS).
  - **Exequibilidade Paramétrica de Propostas de TI e Diligência Obrigatória:**
    - Comparação paramétrica do valor implícito da UST, PF, Hora-Técnica ou Squad frente ao piso salarial e encargos sociais dos perfis profissionais mínimos exigidos no TR (`[ICT_PROPOSAL_BELOW_PROFILE_FLOOR_INEXEQUIBLE]`);
    - Trava jurisprudencial vinculante da **Súmula TCU nº 262** (`[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]`): vedação absoluta de desclassificação sumária por inexequibilidade sem oportunidade prévia de diligência formal para comprovação da exequibilidade de custos pelo licitante.

- [ ] **9.2.A. Habilitação Técnico-Operacional e Qualificação Econômico-Financeira em TIC:**
  - **Conversibilidade de Métricas e Regras de Capacidade Técnica (Súmula TCU nº 263):**
    - Admissão de conversibilidade paramétrica de atestados entre métricas correlatas de TI (`UST <-> Horas <-> PF <-> Postos`) e bloqueio de exigência restritiva de métrica exclusiva (`[ICT_ACT_RIGID_METRIC_RESTRICTION_BLOCK]`);
    - Teto máximo de exigência de atestados fixado em no máximo 50% dos quantitativos dos itens de maior relevância e valor significativo (`[TECH_CAPACITY_EXCEEDS_50PCT_BLOCK]`);
    - Vedação de exigência de capacidade técnico-operacional sobre parcelas irrelevantes ou inferiores a 4% do valor total estimado (`[IRRELEVANT_PARCEL_BELOW_4PCT_BLOCK]`);
    - Admissão mandatória de somatório de atestados técnicos (`[SUM_OF_CERTIFICATES_MANDATORY_BLOCK]`).
  - **Auditoria Contábil de Índices Econômico-Financeiros:**
    - Cálculo de Índices de Liquidez Geral (`ILG`), Liquidez Corrente (`ILC`), Solvência Geral (`ISG`) e Endividamento Geral (`EG`);
    - Teto máximo de 10% do valor estimado para exigência de Patrimônio Líquido ou Capital Social mínimo;
    - Vedação absoluta de exigência cumulativa de Capital Social e Patrimônio Líquido (`[CUMULATIVE_CAPITAL_AND_EQUITY_BLOCK]`).

- [ ] **9.2.B. Motor Forense Anti-Fraude de Autenticidade, Cruzamento Público de CNPJ e Diligência de ACT (Art. 64 da Lei 14.133/2021, Art. 56, § 2º da Lei 13.303/2016 e Acórdãos TCU 1.385/2016 e 1.211/2021-Plenário):**
  - **Vetor 1 (Incompatibilidade de Porte e CNAE do Emissor/Licitante):** Cruzamento público de CNPJ (`BrasilAPI` / Receita Federal com fallback mockado) verificando se o emissor do ACT (ex.: MEI/ME de ramo alheio como padaria/varejo) possui CNAE, natureza jurídica e capital social compatíveis com o volume de TI/serviços atestado (`[ACT_ISSUER_CNAE_OR_SCALE_MISMATCH_SUSPICION]`);
  - **Vetor 2 (Cronologia Impossível e Status Cadastral do CNPJ):** Cruzamento entre Data de Abertura, Data de Baixa/Inaptidão/Suspensão do CNPJ e o período de execução ou data de assinatura do ACT (`[ACT_CHRONOLOGY_OR_INACTIVE_CNPJ_FRAUD_BLOCK]`);
  - **Vetor 3 (Rastreabilidade de Emissor Público no PNCP):** Verificação de existência do Contrato/ARP/Empenho citado quando o emissor do ACT for órgão público ou estatal (`[ACT_PUBLIC_CONTRACT_UNVERIFIED_IN_PNCP]`);
  - **Vetor 4 (Conflito Societário QSA, Parentesco e Contato):** Cruzamento de sócios/administradores em comum, mesmo endereço/CEP ou e-mail corporativo inválido/gratuito entre emissor e licitante (`[ACT_RELATED_PARTY_SELF_ATTESTATION_ALERT]`);
  - **Vetor 5 (Plágio Literal do Edital / Copy-Paste Trap):** Similaridade textual determinística (token LCS/Jaccard) detectando quando um ACT pretérito copia literalmente frases e especificações do TR do edital atual (`[ACT_LITERAL_EDITAL_PLAGIARISM_DETECTED]`);
  - **Vetor 6 (Plausibilidade Volumétrica Tempo vs. Esforço):** Auditoria da razão `Volume de UST/Horas/Itens ÷ Prazo de Execução` frente ao porte da licitante (`[ACT_IMPLAUSIBLE_VOLUME_TIME_RATIO_ALERT]`);
  - **Vetor 7 (Metadados Forenses de PDF e Assinatura Digital):** Divergência temporal entre a data impressa no texto do ACT e a data de criação do PDF / assinatura digital ICP-Brasil/Gov.br sem ressalva de 2ª via (`[ACT_FORENSIC_SIGNATURE_DATE_MISMATCH]`).

- [ ] **9.3. Auditoria Determinística de Contratação Direta (Inexigibilidade e Dispensa):**
  - **Inexigibilidade de Licitação (Art. 74 da Lei 14.133/2021 e Art. 30 da Lei 13.303/2016):**
    - Verificação de inviabilidade de competição, singularidade do serviço e notória especialização;
    - Trava contra atestados de exclusividade genéricos ou emitidos por entidades sem legitimidade (`[INVALID_EXCLUSIVITY_CERTIFICATE_BLOCK]` — Súmula TCU nº 255);
    - Comprovação obrigatória de razoabilidade de preços praticados pelo fornecedor perante outros entes públicos ou privados com mínimo de 3 contratos/notas fiscais recentes (`[INEXIGIBILITY_PRICE_PROOF_INSUFFICIENT_BLOCK]`).
  - **Dispensa de Licitação por Valor (Art. 75, I e II da Lei 14.133/2021 e Art. 29, I e II da Lei 13.303/2016):**
    - Motor anti-fracionamento de despesa no exercício financeiro para a mesma unidade gestora e mesma linha de fornecimento/serviço por código PDM / CATMAT / CATSER (`[EXPENSE_FRAGMENTATION_BLOCK]`).

- [ ] **9.4. Regime Especial de Oportunidade de Negócio e Parcerias Estratégicas nas Estatais (Art. 28, § 3º, II da Lei 13.303/2016):**
  - Checklist determinístico de requisitos para dispensa de licitação em oportunidades de negócio empresarial: comprovação de inviabilidade ou desvantagem de procedimento concorrencial comercial, justificação técnica da escolha do parceiro e matriz de compartilhamento de riscos e resultados econômicos (`[STATE_ENTERPRISE_PARTNERSHIP_UNJUSTIFIED_BLOCK]`).

- [ ] **9.5. Compilação Documental Nativa `.docx`/`.pdf` da Fase Externa e Contratação Direta:**
  - `Parecer_Julgamento_Proposta_Habilitacao_e_Diligencia.docx/.pdf`: Minuta técnica padronizada de julgamento de conformidade de propostas, admissibilidade de atestados e resultado de diligências;
  - `Oficio_e_Email_Diligencia_Veracidade_ACT.docx/.pdf`: Minutas formais de diligência investigativa de veracidade de atestados em duas vias canônicas:
    - *Via A (Ao Emissor do ACT):* E-mail/Ofício de confirmação de autenticidade endereçado aos contatos oficiais cadastrados na Receita Federal;
    - *Via B (À Licitante — Lastro Material Obrigatório):* Requisição formal de apresentação de Notas Fiscais Eletrônicas (NF-e/NFS-e com chave de 44 dígitos), Contrato assinado à época, Ordens de Serviço e comprovantes de recolhimento fiscal/trabalhista (SEFIP/eSocial) ou bancários;
  - `Parecer_Instrucao_Inexigibilidade_Dispensa_ou_Oportunidade_Estatal.docx/.pdf`: Peça de instrução processual para contratações diretas, atestando a presença de todos os requisitos legais e a razoabilidade dos preços pactuados.

---

## 🎯 MARCO 9.5 — `v1.6.5`: Regime de Dedicação Exclusiva de Mão de Obra (DEMO) & Obras e Serviços de Engenharia (Geração 6.5 — PLANEJADO)

- [ ] **9.5.1. Motor de Modelagem e Julgamento de Planilhas de Custos e Formação de Preços em Regime DEMO (IN SEGES 05/2017 e Art. 121 da Lei 14.133/2021):**
  - **Auditoria Aritmética e Normativa dos Módulos 1 a 6:**
    - *Módulo 1:* Composição da remuneração e salário-base vinculado à Convenção Coletiva de Trabalho (CCT);
    - *Módulo 2:* Encargos previdenciários, FGTS, SAT/RAT e contribuições sociais;
    - *Módulo 3:* Provisão para rescisão (férias, 13º e aviso prévio indenizado/trabalhado);
    - *Módulo 4:* Custo de reposição de profissional ausente em regime de substituição;
    - *Módulo 5:* Insumos de mão de obra (uniformes, EPIs, exames médicos e benefícios);
    - *Módulo 6:* Custos indiretos, despesas administrativas, tributos (PIS/COFINS/ISS) e taxa de lucro;
  - **Governança de Conta Vinculada vs. Pagamento pelo Fato Gerador:**
    - Monitoramento das provisões retidas em Conta-Depósito Vinculada bloqueada para movimentação direta ou adoção do Pagamento pelo Fato Gerador com glosa preventiva.

- [ ] **9.5.2. Motor de Obras e Serviços de Engenharia (Art. 59, §§ 4º e 5º da Lei 14.133/2021 e Acórdão TCU 2.622/2013):**
  - **Inexequibilidade Relativa e Garantia Adicional em Engenharia:**
    - Trava matemática de presunção de inexequibilidade relativa para ofertas abaixo de 75% do orçamento-base da Administração;
    - Cálculo automático de exigência de garantia adicional para propostas classificadas entre 75% e 85% do valor orçado;
  - **Auditoria de BDI e Tabelas Referenciais Oficiais:**
    - Análise de faixas de Bonificação e Despesas Indiretas (BDI) segundo os parâmetros do Acórdão TCU nº 2.622/2013 para obras civis, rodoviárias, portuárias e materiais/equipamentos de natureza diferenciada;
    - Cruzamento analítico com tabelas referenciais oficiais SINAPI e SICRO.

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
