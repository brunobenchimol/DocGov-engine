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
| **Geração 5.5** | `v1.5.5` | Processo Administrativo Sancionador (PAS), Glosa por ANS/IMR vs. Multa, Garantias e Saneamento Estatístico de Cesta de Preços (`CV <= 25%`) | `[PRÓXIMO FOCO ATIVO]` |
| **Geração 6** | `v1.6.0` | Seleção do Fornecedor 360º — Fase Externa (Julgamento de Propostas, Inexequibilidade Art. 59 / Súmula 262, Habilitação Técnica 50% / Súmula 263 e Índices Contábeis) & Contratação Direta (Inexigibilidade Súmula 255, Dispensa Anti-Fracionamento e Oportunidade de Negócio Estatal Art. 28 §3º II) | `[PLANEJADO]` |
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

## ✅ STATUS BASE CONSOLIDADO E HOMOLOGADO (`v1.0.0` a `v1.5.0`)

As capacidades fundamentais do motor foram consolidadas e testadas com 100% de aprovação (detalhes exaustivos no [`CHANGELOG.md`](CHANGELOG.md)):

- [x] **`v1.0.0` (Clean Cut Standalone):** Arquitetura desacoplada, MCP stdio, cartografia por coordenadas, Radar Z1..Z14 e compilação básica OpenXML.
- [x] **Marco 4 — `v1.1.0`:** Auditoria aritmética de planilhas em centavos (`Z10`/`Z12`), tolerâncias `ROUNDING_WARNING` vs. `MATH_ERROR` e diff estrutural baseado no `toc_map`.
- [x] **Marco 5 — `v1.2.0`:** Auto-updater seguro com SHA-256, engenharia tabular multi-página, ingestão nativa de `.xlsx`/`.csv` e OCR headless com coordenadas homogêneas.
- [x] **Marco 6 — `v1.3.0` a `v1.3.11`:** Diff semântico token-level, Nota Técnica Comparativa em Word/PDF, guardrails de escopo (`ENG-10`), conectores PNCP (`fetch_pncp` e `search_pncp`), conversor de tabelas Markdown para `<w:tbl>`, reancoragem de prefixos multinível e teto físico da Lei 9 ($\le 500$ linhas).
- [x] **Marco 7 — `v1.4.0` a `v1.4.6`:** Motor de jurisprudência sob demanda (`search_juris` e `fetch_juris`), matriz normativa `Statutory Bridge` (Lei 13.303 $\leftrightarrow$ Lei 14.133), ranking de relevância (`0..100 pts`), fatiamento anatômico em 10 camadas, trava anti-alucinação e homologação de 11 Cortes Oficiais.
- [x] **Marco 8 — `v1.5.0`:** Núcleo de fiscalização contratual (`docgov_audit_contract_execution` / `--audit-contract`), limites de aditamento de 25%/50% sem compensação, batimento quadripartite, reajustes/repactuações e governança determinística de ARP (`docgov_govern_arp` / `--govern-arp`) com travas de carona 50%/200%, compatibilidade jurídica/federativa e compilação OpenXML.

---

## 🎯 MARCO 8.5 — `v1.5.5`: Processo Administrativo Sancionador (PAS), Glosa por ANS/IMR vs. Multa, Garantias e Saneamento Estatístico de Cesta de Preços (Geração 5.5 — PRÓXIMO FOCO ATIVO)

- [ ] **8.5.1. Calculadora de Glosa por ANS/IMR vs. Multa e Dosimetria de Sanções (PAS):**
  - **Distinção Conceitual e Operacional Estrita:** Segregação matemática entre Glosa por Inexecução Parcial (faturamento proporcional com base em Acordo de Nível de Serviço — ANS / Instrumento de Medição de Resultado — IMR) e Aplicação de Sanção Administrativa (Arts. 155 a 163 da Lei nº 14.133/2021 e Art. 83 da Lei nº 13.303/2016).
  - **Dosimetria Determinística de Penalidades:**
    - *Advertência:* Para descumprimentos de menor gravidade sem prejuízo financeiro direto;
    - *Multa Compensatória e Moratória:* Cálculo parametrizado de percentuais (0,5% a 30% sobre o valor do contrato ou da fatura/parcela inadimplida);
    - *Impedimento de Licitar e Contratar:* Prazo de até 3 anos no âmbito da Administração Pública direta e indireta do ente federativo;
    - *Declaração de Inidoneidade:* Prazo de 3 a 6 anos com eficácia perante toda a Administração Pública nacional.
  - **Checklist Processual de Contraditório e Ampla Defesa:**
    - Verificação de expedição de Notificação Prévia de Descumprimento com concessão do prazo legal de 15 (quinze) dias úteis para defesa prévia;
    - Intimação obrigatória da seguradora em contratos garantidos por Seguro-Garantia (Art. 102 da Lei nº 14.133/2021) para opção de assunção da execução contratual;
    - Cálculo determinístico de limites de retenção cautelar preventiva sobre créditos devidos à contratada.

- [ ] **8.5.2. Motor Estatístico Anti-Outlier de Cesta de Preços (IN SEGES/ME nº 65/2021 e RILC) no `budget_auditor`:**
  - **Tratamento Matemático da Cesta de Preços (Mínimo de 3 Fontes Válidas):**
    - Ingestão determinística de amostras de pesquisa de mercado (painel de preços PNCP, compras públicas similares, tabelas oficiais e cotações diretas);
    - Cálculo exato em centavos inteiros (`BigInt`) de Média aritmética, Mediana, Desvio Padrão ($\sigma$) e Coeficiente de Variação ($CV = \sigma / \mu$);
    - **Trava de Alta Dispersão (`[PRICE_BASKET_HIGH_DISPERSION_USE_MEDIAN]`):** Emissão mandatória de alerta determinístico quando o Coeficiente de Variação ultrapassar 25% ($CV > 25\%$), impondo o uso da Mediana como valor de referência para neutralizar distorções estatísticas (critério jurisprudencial consolidado do TCU e Art. 3º da IN 65/2021);
    - Expurgo automatizado de cotações inexequíveis ou excessivamente elevadas através de método interquartílico (IQR).
  - **Auditoria de Reequilíbrio Econômico-Financeiro (Álea Extraordinária):**
    - Segregação analítica entre inflação ordinária (coberta por Reajuste por índice contratual) e desequilíbrios provocados por fatos imprevisíveis ou previsíveis de consequências incalculáveis (Art. 124, II, "d" da Lei nº 14.133/2021 e Art. 81, VI da Lei nº 13.303/2016).

- [ ] **8.5.3. Compilação Documental Nativa OpenXML `.docx`/`.pdf` de Sanções e Glosas:**
  - `Notificacao_Previa_Descumprimento_e_PAS.docx/.pdf`: Peça formal de notificação e instauração do PAS com especificação de cláusulas infringidas, cálculo de glosa/multa proposta e prazo legal de defesa;
  - `Parecer_Dosimetria_Sancao_ou_Glosa_ANS.docx/.pdf`: Relatório conclusivo de fiscalização com matriz de dosimetria, análise de justificativas apresentadas e recomendação de penalidade ou glosa direta.

---

## 🎯 MARCO 9 — `v1.6.0`: Seleção do Fornecedor 360º — Fase Externa da Licitação & Contratação Direta (Geração 6 — PLANEJADO)

- [ ] **9.1. Motor de Julgamento de Propostas, Inexequibilidade e Diligência Obrigatória:**
  - **Cálculo Determinístico de Limiar de Inexequibilidade Relativa:**
    - Aplicação do critério legal de presunção de inexequibilidade em obras e serviços de engenharia ($< 75\%$ do valor orçado pela Administração — Art. 59, § 4º da Lei nº 14.133/2021);
    - Trava jurisprudencial vinculante da **Súmula TCU nº 262** (`[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]`): proibição expressa de desclassificação sumária de proposta sem a oportunidade prévia de diligência e comprovação de exequibilidade dos custos pelo licitante;
    - Exigência automática de garantia adicional correspondente à diferença entre 85% do valor orçado e o valor da proposta para ofertas entre 75% e 85% (Art. 59, § 5º).

- [ ] **9.2. Validador Determinístico de Habilitação Técnica e Econômico-Financeira:**
  - **Limites de Qualificação Técnico-Operacional e Técnico-Profissional:**
    - Teto máximo de exigência de atestados fixado em no máximo 50% dos quantitativos dos itens de maior relevância e valor significativo ($\ge 4\%$ do valor total — Art. 67, §§ 1º e 2º da Lei nº 14.133/2021 e Súmula TCU nº 263);
    - Admissão mandatória de somatório de atestados para comprovação de capacidade técnica (`[SUM_OF_CERTIFICATES_MANDATORY_BLOCK]`), salvo justificativa técnica excepcional expressa no edital.
  - **Auditoria Contábil de Índices Econômico-Financeiros:**
    - Cálculo de Índices de Liquidez Geral (`ILG`), Liquidez Corrente (`ILC`), Solvência Geral (`ISG`) e Endividamento Geral (`EG`);
    - Teto máximo de 10% do valor estimado para exigência de Patrimônio Líquido ou Capital Social mínimo;
    - Vedação absoluta de exigência cumulativa de Capital Social e Patrimônio Líquido (`[CUMULATIVE_CAPITAL_AND_EQUITY_BLOCK]`).

- [ ] **9.3. Auditoria Determinística de Contratação Direta (Inexigibilidade e Dispensa):**
  - **Inexigibilidade de Licitação (Art. 74 da Lei 14.133/2021 e Art. 30 da Lei 13.303/2016):**
    - Verificação de inviabilidade de competição, singularidade do serviço e notória especialização;
    - Trava contra atestados de exclusividade genéricos ou emitidos por entidades sem legitimidade (`[INVALID_EXCLUSIVITY_CERTIFICATE_BLOCK]` — Súmula TCU nº 255);
    - Comprovação obrigatória de razoabilidade de preços praticados pelo fornecedor perante outros entes públicos ou privados (mínimo de 3 contratos/notas fiscais recentes — Art. 23, § 4º).
  - **Dispensa de Licitação por Valor (Art. 75, I e II da Lei 14.133/2021 e Art. 29, I e II da Lei 13.303/2016):**
    - Motor anti-fracionamento de despesa no exercício financeiro para a mesma unidade gestora e mesma linha de fornecimento/serviço (código PDM / CATMAT / CATSER — `[EXPENSE_FRAGMENTATION_BLOCK]`).

- [ ] **9.4. Regime Especial de Oportunidade de Negócio e Parcerias Estratégicas nas Estatais (Art. 28, § 3º, II da Lei 13.303/2016):**
  - Checklist determinístico de requisitos para dispensa de licitação em oportunidades de negócio empresarial: comprovação de inviabilidade ou desvantagem de procedimento concorrencial comercial, justificação técnica da escolha do parceiro e matriz de compartilhamento de riscos e resultados econômicos.

- [ ] **9.5. Compilação Documental Nativa `.docx`/`.pdf` da Fase Externa e Contratação Direta:**
  - `Parecer_Julgamento_Proposta_Habilitacao_e_Diligencia.docx/.pdf`: Minuta técnica padronizada de julgamento de conformidade de propostas, admissibilidade de atestados e resultado de diligências;
  - `Parecer_Instrucao_Inexigibilidade_Dispensa_ou_Oportunidade_Estatal.docx/.pdf`: Peça de instrução processual para contratações diretas, atestando a presença de todos os requisitos legais e a razoabilidade dos preços pactuados.

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
