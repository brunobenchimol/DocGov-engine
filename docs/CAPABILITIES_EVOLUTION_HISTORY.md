# Memória Evolutiva Executiva — `docgov-engine` (`v0.1` a `v1.7.0`)

---

## 1. Propósito e Regra de Manutenção Contínua

Este documento constitui a **Radiografia Histórica e Funcional Cumulativa** do `docgov-engine`. Ele funciona como o elo executivo de baixo consumo de tokens entre o registro exaustivo do [`CHANGELOG.md`](../CHANGELOG.md) e o planejamento estratégico do [`ROADMAP.md`](../ROADMAP.md), permitindo que arquitetos e agentes de IA compreendam integralmente todas as ferramentas, motores e travas já construídos no repositório em poucos segundos.

> **Regra de Ouro de Atualização (Lei 4 e Lei 8):** Ao concluir qualquer marco evolutivo significativo (`v1.6.5`, `v1.7.0`, `v1.7.3`, `v1.7.5`, `v1.7.8`, `v1.7.10`, `v1.8.0`, `v1.8.3`, `v1.8.5`, `v1.8.8`, etc.), o agente **DEVE** realizar um append resumido (10 a 15 linhas) na Seção 2 documentando as novas ferramentas MCP/CLI, motores de domínio, tags de bloqueio e entregáveis gerados naquela geração, preservando o documento conciso e de leitura rápida.

---

## 2. Radiografia Evolutiva das Gerações (`v0.1` a `v1.7.0`)

### Geração 1 (`v0.1` a `v1.1.0` — Fundação OpenXML, Cartografia Sem IA e Radar Pericial)
- **Tools MCP:** `bootstrap_case`, `inspect_doc`, `build_docx_template`, `fill_docx_template`, `generate_audit_docx`.
- **Capacidades:**
  - Isolamento de workspace por caso (`inputs/`, `state/`, `output/`), higienização/deduplicação da raiz e inventário `indice_mestre_caso.md`;
  - Mapeamento determinístico de coordenadas (`[P...]`, `[T...R...C...]`, `[PAG_XXX | LYYYY]`), espelho `visao_auditoria_*.md` e `dossie_hotspots_*.md` (janela `±12` linhas);
  - Radar Pericial das **14 Zonas de Impugnação (`Z1` a `Z14`)** sem dependência de LLM;
  - Cache Global Cross-Órgão (`core/registry/templates/`) com Auto-Offset posicional e sanity check;
  - Injeção OpenXML com listas multinível `<w:numPr>`, *hanging indent* em tabelas e exportação híbrida DOCX/PDF (Word COM + Pure-JS);
  - Compilação editorial vertical A4 de relatórios de auditoria (zero `<w:tbl>`).

### Geração 2 (`v1.1.0` a `v1.2.5` — Matemática em Centavos, Planilhas, OCR e Pacotes Compactados)
- **Motores:** `budget_auditor.ts`, parser `.xlsx`/`.csv`, `archives.ts`, `ocr.ts`, `updater.ts`.
- **Capacidades:**
  - Auditoria aritmética de planilhas em centavos inteiros (`BigInt`: `Qtd x Unit = Total`, subtotais, total geral e cruzamento com valor global nas zonas `Z10`/`Z12`), classificando `MATH_ERROR` (`> 2` centavos) vs. `ROUNDING_WARNING` (`<= 2` centavos);
  - Ingestão nativa de `.xlsx` (por coordenada `r="A1"`) e `.csv` (RFC 4180); fusão de tabelas multi-página e normalização de `gridSpan`/`vMerge`;
  - Descompactação segura via `libmagic msooxml` (`.zip`, `.tar.gz`, `.tgz`, `.tar`) com defesa Anti-Zip Slip;
  - OCR Headless offline mantendo coordenadas homogêneas `[PAG_XXX | LYYYY]`;
  - Emissão de `RISK_MATRIX` e `COMPLIANCE_CHECKLIST`; auto-updater seguro com verificação criptográfica SHA-256.

### Geração 3 (`v1.3.0` a `v1.3.12` — Diff Semântico, PNCP, Engenharia OpenXML Avançada e Modularidade)
- **Tools MCP:** `generate_technical_note_docx`, `fetch_pncp`, `search_pncp`.
- **Capacidades:**
  - Diff semântico *token-level* (`compareWithPath`, algoritmo LCS Unicode e delta das 14 zonas: `INTRODUCED`, `RESOLVED`, `RETAINED`);
  - Nota Técnica Comparativa "Antes vs. Depois" com cards coloridos;
  - Busca multi-query (`|`) no PNCP e download isolado em `inputs/pncp_<shortname>/` com resolução de redirects `302`;
  - Conversor nativo de tabelas Markdown para `<w:tbl>` (`ENG-06`) e poda `remove_table_rows` *bottom-up*;
  - Guardrail de Escopo (`ENG-10`) com `%TEMP%/docgov_ephemeral_inspect/`, auto-redirecionamento de checkboxes `C1->C2` (`ENG-11`) e *Heading Guard* (`ENG-12`);
  - Scanners de integridade pós-compilação (`PARTIAL_ITEM_ROW_CONTAMINATION`, `UNCALCULATED_TOTAL_ROW`, `MULTILEVEL_NUMBERING_RESET`, `DUPLICATE_CONFLICTING_SLA_TABLES`, `SECTION_PREFIX_MISMATCH`, `DUPLICATE_CLAUSE_NUMBER` — `ENG-13..16`);
  - Herança nativa de `templateNumId` e decomposição modular sob teto físico `<= 500` linhas (Lei 9).

### Geração 4 (`v1.4.0` a `v1.4.6` — Inteligência Jurisprudencial Multi-Corte e Contraditório Tático)
- **Tools MCP:** `search_juris`, `fetch_juris` + `JurisdictionProviderRegistry` plug-and-play.
- **Capacidades:**
  - Funil em 3 estágios com ranking determinístico (`0..100` pts) e calibragem tática (`FAVORABLE` vs. `ADVERSE_DISTINGUISHING_REQUIRED`) conforme postura `DEFENSE`/`ATTACK`;
  - Ponte Normativa `Statutory Bridge` (`SB-01` a `SB-10`: Lei 13.303/2016 + RILC $\leftrightarrow$ Lei 14.133/2021);
  - Trava `[ANTI_HALLUCINATION_BLOCK]` e fatiamento anatômico em 6 Macro-Partes / 10 Sub-Camadas (`1A..6A`);
  - Compilador OpenXML de `Nota_Tecnica_Contrarrazoes_Juridicas` e `Peca_Impugnacao_Representacao`;
  - **11 cortes homologadas:** `TCU`, `STJ`, `STF`, `TST`, `AGU`, `TCE-PA`, `TCE-CE`, `TCDF`, `TCE-SP`, `TCE-MG`, `TCE-PR` com Resiliência Dupla (*Live Primary + Curated Fallback*), seletor `--court=<ID>` e *Graceful Fallback* por UF.

### Geração 5, 5.5 e 5.6 (`v1.5.0` a `v1.5.6` — Fiscalização Contratual, PAS Federativo, LINDB Art. 22, Cesta IN 65/2021 e Governança de ARP)
- **Tools MCP:** `docgov_audit_contract_execution`, `docgov_govern_arp`.
- **Capacidades:**
  - Limites de aditivos de 25% e 50% (Art. 125) sem compensação entre acréscimos e supressões (`[ADDENDUM_COMPENSATION_FORBIDDEN]`); consensualidade obrigatória em estatais (`[STATE_ENTERPRISE_UNILATERAL_ADDENDUM_BLOCK]`) e bloqueio de aditivo direto em ARP (`[ILLEGAL_ARP_ADDENDUM_BLOCK]`);
  - Batimento quadripartite (`TR <-> Proposta <-> ARP <-> Contrato/Fatura`) e interregno de 12 meses em reajustes/repactuações;
  - **PAS Federativo:** contraditório de 15 dias úteis, multa `0,5%..30%`, segregação glosa ANS/IMR vs. sanção, notificação de seguradora (Art. 102), alcance territorial Estadual/Municipal vs. Estatal `<= 2` anos vs. Inidoneidade, remessa `CEIS/CNEP/PNCP/TCE-TCM` e calibragem jurisprudencial da dosimetria pela LINDB Art. 22;
  - Cesta de Preços `IN 65/2021` (expurgo de outliers e trava `CV > 25%` exigindo mediana/média saneada) e bloqueio de álea alocada à contratada;
  - Governança de ARP com livro-razão de caronas (50% individual / 200% global), simetria de regime (`14.133` vs. `13.303`), vedação de carona ascendente e compilação das peças oficiais em DOCX/PDF.

### Geração 6 (`v1.6.0` a `v1.6.4` — Seleção do Fornecedor 360º, Ponte Multimodal `unpdf@2.1+`, 1ª Perna Forense Dual, Recursos Art. 165 e Contratação Direta)
- **Tools MCP:** `docgov_evaluate_bidding_proposals`, `docgov_audit_direct_contracting`.
- **Capacidades:**
  - Julgamento de TIC sem DEMO (`UST/HST/PF/SQUAD`), bloqueio de DEMO oculto, Súmula TCU 269 (`1 UST != 1h`), teto de HST em OS e exequibilidade paramétrica frente ao piso salarial;
  - Habilitação técnica Súmula TCU 263 (conversibilidade de métricas, teto 50% sobre parcelas `>= 4%`, somatório de atestados e vedação de cumulação Capital Social + PL);
  - Inexequibilidade `< 75%`, garantia adicional `75%..85%` (Art. 59, §§ 4º–5º), Súmula TCU 262 (diligência obrigatória) e Jogo de Planilha unitário;
  - **1ª Perna Forense Anti-Fraude:** 7 Vetores de ACT (CNAE/porte, CNPJ inativo/cronologia, PNCP público, QSA Emissor-Licitante, plágio literal do TR, volume/tempo e data de assinatura) + Ponte Multimodal `unpdf@2.1+` (`inspectPages` em 5 classes incluindo `HYBRID_HEADER_SCAN_TRAP` e extração de PNGs em `assets/` com filtro anti-brasão SHA-256) + Perícia Forense Dual `PDF/DOCX` (`getMeta` + `docProps` detectando editores `Canva/iLovePDF/Sejda` e conluio de autoria em propostas/cotações);
  - Fase Recursal Art. 165 / Acórdão TCU 1.211/2021 (`APPEALS_BUNDLE`);
  - Contratação Direta: Inexigibilidade (Súmula 255 / mínimo 3 NFs / sobrepreço), Dispensa anti-fracionamento por UG/PDM e Oportunidade de Negócio Estatal (Art. 28, § 3º, II da Lei 13.303/2016).

### Geração 6.5 (`v1.6.5` a `v1.6.7` — Concluída: Regime DEMO Módulos 1 a 6 & Obras e Serviços de Engenharia)
- **Tools MCP:** `docgov_audit_demo_regime` (CLI `audit-demo-regime` — `v1.6.5`) e `docgov_audit_engineering_works` (CLI `audit-engineering-works` — `v1.6.6`).
- **Capacidades Entregues (Eixo 1 — `v1.6.5`):**
  - Auditoria matemática em centavos inteiros e basis points para Planilhas DEMO (Módulos 1 a 6 do Anexo VII-D da IN SEGES nº 05/2017): piso CCT, Súmula nº 448, II TST + LTCAT, 13º/Férias + CPP 20%/FGTS 8%, SAT/RAT × FAP, VT 6% + VA CCT, APT 1º ano `<= 1,94%`, reposição de ausentes, insumos/EPIs e Gross-Up "por dentro";
  - Trava de alíquota efetiva EFD-Contribuições no Lucro Real (Acórdão TCU 1.214/2013), vedação ao Simples Nacional em cessão de mão de obra (Art. 17, XII LC 123/2006) salvo Anexo IV em limpeza/vigilância, produtividade $m^2$ (Anexo VI-B) e proteção salarial `44h -> 40h` + reserva de vagas (Decreto nº 12.174/2024);
  - Governança contratual: expurgo de 90% do APT na 1ª prorrogação (`1,94% -> 0,194%`, Acórdão TCU 1.586/2018), Conta-Depósito Vinculada (Anexo XII: `29,50%..31,33%`) vs. Fato Gerador e Repactuação CCT (Art. 135), compilando `demo_regime_audit.json/.md` e `laudo_pericial_planilha_demo.docx/.pdf` com guarda `<= 880B` no `stdout` sob as **16 tags `[DEMO_*]`**.
- **Capacidades Entregues (Eixo 2 — `v1.6.6`):**
  - Auditoria de BDI por tipologia e fórmula algébrica oficial (Acórdão TCU nº 2.622/2013), BDI Diferenciado reduzido para materiais/equipamentos relevantes (Súmula TCU nº 253), bloqueio de *bis in idem* (Administração Local/Canteiro/Mobilização no BDI), vedação de IRPJ/CSLL (Súmula TCU nº 254) e medição proporcional da Administração Local ao avanço físico;
  - Curva ABC (`Faixas A/B/C`) contra medianas `SINAPI`/`SICRO` (Decreto nº 7.983/2013), simetria tributária Com/Sem Desoneração e escalonamento gradual de CPRB x INSS (`2024..2028+`, Lei nº 14.973/2024), detecção de *front-loading* (`> 5%`) no cronograma físico-financeiro, Matriz de Riscos em Contratação Integrada/Semi-Integrada (Art. 46 Lei 14.133/2021 e Arts. 42–43 Lei 13.303/2016) e reaproveitamento nativo de `inexequibility_evaluator.ts` (`< 75%`, garantia adicional `< 85%`, Súmula 262 e Jogo de Planilha), compilando `engineering_works_audit.json/.md` e `laudo_pericial_obras_engenharia.docx/.pdf` com guarda `<= 880B` sob **15 tags simultâneas**.

### Trilha Contínua Jurisprudencial — Onda 3 Municipal (`v1.6.8` — Conector `TCM-PA` & Coexistência `TCE`/`TCM`)
- **Conector Homologado:** `TCM-PA` (12ª corte oficial e 1º tribunal municipal da Onda 3), inaugurando `tier: "MUNICIPAL"` com catálogo normativo de 8 precedentes (`TCM-PA-ACORDAO-42110-2024` como SSOT `.NET`), Live Primary na API REST JSON `/wp-json/wp/v2/posts` + `/wp-json/wp/v2/search` de `tcmpa.tc.br` e mock via `DOCGOV_JURIS_TCM_PA_URL`.
- **Arquitetura de Coexistência na Mesma UF (`PA`):** Parâmetro `sphere: "STATE" | "MUNICIPAL" | "ALL"` (default `"STATE"` preservando `TCE-PA`), promoção automática por `autoTriggerKeywords` sem termos geográficos isolados, atalho `uf: "TCM-PA"` e `supported_ufs` estritamente deduplicado (`["PA", "CE", "DF", "SP", "MG", "PR"]`).

### Higiene Arquitetural — Eixo 5 (`v1.6.10` — Orçamento Estrito de Tokens no Handshake MCP `tools/list`)
- **Enxugamento Cirúrgico (`<= 600` chars / ~150 tokens por tool):** Otimização das 14 descrições acima do teto em `src/mcp/tools_definition.ts` (12 tools), `src/demo_costs/audit_runner.ts` (`docgov_audit_demo_regime`) e `src/engineering/tool_definition.ts` (`docgov_audit_engineering_works`), reduzindo a soma das `description`s em `-63,3%` (`20.793 -> 7.631` chars) e o payload `tools/list` total em `-29,0%` (`45.432 -> 32.256` chars / `~11.358 -> ~8.064` tokens).
- **Zero Breaking Changes & Preservação do `initialize`:** Todos os nomes de ferramentas, `inputSchema`, enums e `annotations` permanecem 100% intactos, assim como `DOCX_ENGINE_INSTRUCTIONS` (sem inflação de regra interna), delegando contratos exaustivos ao `--dump-spec`.
- **Trava Anti-Regressão (`test/mcp_spec.test.ts`):** Validação determinística contínua garantindo `description.length <= 600` em 100% das tools para blindar as futuras séries `v1.7.x` e `v1.8.x`.

### Blindagem de Contratos Gen5, Detector de `unknown_keys` & Smoke Test MCP via `stdio` Real (`v1.6.11`)
- **Exact Copy-Paste Error & Detector Determinístico de `unknown_keys` (`src/contracts/gen5_contract_errors.ts`):** Bloqueio *fail-fast* com snippet JSON canônico copiável para entradas vazias/inválidas em `docgov_audit_contract_execution` e `docgov_govern_arp` (`49fb4e9`, `316d078`), somado à detecção de chaves desconhecidas na raiz e arrays principais (`addendums[]`, `pas_sanctions[]`, `tripartite_items[]`, `readjustments[]`, `price_basket`, `risk_matrix_events[]`, `items[]`, `adhesion_request` / `adhesions[]`) sem criar aliases silenciosos (Lei 3). Registra `unknown_keys` e `schema_warnings` nos dossiês JSON/MD em disco e expõe `unknown_keys` no envelope MCP somente quando não vazio (`< 900B`, Lei 2).
- **Paridade Estrita `spec.ts` vs. Parsers `.ts` & Smoke Test `stdio` Real (`test/mcp_stdio_smoke.test.ts`):** Alinhamento 100% entre `--dump-spec` e os parsers reais (`addendums`, `value_increase`, `value_decrease`, `compensated_attempt`, `requesting_organ` estruturado), validado ponta a ponta via `StdioClientTransport` real (`c16287c`), além da automação e Dupla Defesa de Release Notes (`scripts/extract_release_notes.ts` e `.github/workflows/release.yml`).

### Geração 7.0 (`v1.7.0` — 2ª Perna Anti-Fraude Parte 1: Perícia `PKCS#7/PAdES`, NF-e 44 Dígitos, Clones `w:rsid` & `.xlsx`)
- **Tools MCP Enriquecidas (16 mantidas, `<= 600` chars):** `bootstrap_case`, `inspect_doc`, `docgov_evaluate_bidding_proposals` e `docgov_audit_direct_contracting` + runner compacto `scripts/run_tests.ts`.
- **Motores (`<= 500` linhas):** `src/utils/pdf/asn1_der_parser.ts`, `src/utils/pdf/pades_signature_auditor.ts`, `src/utils/pdf/xlsx_forensic_meta.ts`, `src/utils/forensics/nfe_key_validator.ts` e `src/utils/forensics/gen6_contract_guard.ts`.
- **Capacidades & 6 Novas Tags Bloqueantes (elevando `decision` para `"REJECTED"`):**
  - **Pilar 1 (Pure-JS `ASN.1/DER/BER` & `/ByteRange`):** Recorte pelo TLV raiz (sem *strip* cego de `0x00`), suporte a BER *indefinite-length*, seleção do certificado folha via `SignerInfo.sid`, extração de ICP-Brasil `2.16.76.1.3.1`/`.3` (`SAN OCTET STRING`), verificação de cadeia (`[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]`), confronto de identidade X.509 sem falso-positivo PF vs. PJ (`[FORENSIC_SIGNER_IDENTITY_MISMATCH_BLOCK]`) e detecção de adulteração incremental vs. co-assinatura visual benigna `/Subtype /Form` (`[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]`).
  - **Pilar 5 (NF-e 44 Dígitos, `w:rsid` & `.xlsx`):** Decomposição e recálculo Módulo 11 (`[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]`), confronto CNPJ/AAMM com `bidder_cnpj` no ACT Via B e `supplier_market_price_proofs[]` (`[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]`), clones `.docx` por `w:rsidRoot` / `w:rsidR` mesmo com `Author` limpo (`[FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK]`), `forensic_meta` para `.xlsx` e guarda `unknown_keys` na Gen6 (`< 900B`).

### Hotfix & Consolidação (`v1.7.1` — PAdES Gov.br / Cadeia X.509 Encadeada, Smoke Test Público Real & Resiliência Unificada JURIS)
- **Hotfix PAdES Gov.br (`pades_signature_auditor.ts`):** Inclusão de `AC Final/Intermediária/Raiz do Governo Federal do Brasil` e `Secretaria de Governo Digital` em `TRUSTED_ICP_ISSUER_REGEX` com caminhamento encadeado real em `SignedData.certificates` (`current.issuerDn === parent.subjectDn`, máx. 5 níveis, anti-ciclo e bloqueio de certificados desconectados no `SET`).
- **Smoke Test com Corpus Público Real (`scripts/discover_real_corpus.ts`, `scripts/run_real_smoke.ts`):** Runner *on-demand* LGPD-limpo e sem viés de seleção validado em **12/12 PASS** sobre PDFs reais do PNCP (Gov.br único e co-assinado), `.docx` da AGU (`w:rsid`), `.xlsx` do Compras.gov.br e NF-e modelo 55 do Portal da Transparência.
- **Resiliência Unificada dos Conectores JURIS (`BaseJurisdictionProvider`):** Migração 12/12 dos tribunais com `retries: 0`, Circuit Breaker 30s, 7 novos catálogos curados verificados, transparência cognitiva (`live_degraded`, `source`), válvula `force_live` / `--force-live` (`9000ms`) e status `WARN` no runner live.

### `v1.7.2` — Triagem A/B Estruturada do Conector TST (4 Baldes), Refatoração Modular 100% Lei 9 & Polimentos R4
- **Triagem A/B Exclusiva TST (`src/tools/juris/tst_precedent_triage.ts`, `tst_provider.ts`, `search_juris.ts`):** Parâmetro opcional `triage_mode` (`"triaged"` padrão TST | `"raw"` legado | `"compare"` 1 única consulta com `raw_diff`), classificação estrita por metadados estruturados em 4 baldes (`erga_omnes` [SV, RG, IRR, IAC], `orientativas` [Súmula, OJ, Embargos `E-RR`/`Ag-E-RR`, SBDI-1/2, SDC, Órgão Especial, Pleno], `inter_partes` [Turmas 1ª–8ª, Monocráticas, `ArgInc` mesmo no Pleno] e `unclassified`), extração segura de `year` sem datas inventadas, filtro determinístico de pertinência (`filtered_out`) com bypass normativo/catálogo e compactação `< 900B` com zero impacto nos demais 11 conectores.
- **Refatoração Modular 100% `src/` & Polimentos R4:** Decomposição integral dos 19 arquivos legados sob teto universal `<= 500` linhas em `scripts/check_lines.ts`, resumo `forensic_meta` no topo de `visao_auditoria_*.md`, dicionário jurídico das 6 tags `v1.7.0` na Rota E, deduplicação de chaves NF-e no ACT e coerência textual do Ofício de Diligência quando `total_alerts === 0`.

### Geração 7.3 (`v1.7.3` — Higienização Estrutural JURIS, Acumulação com Lock, Neutralidade, Cache TTL 24h TST & Migração para `state/`)
- **Acumulação Concorrente & Desduplicação (`juris_search_store.ts`, `search_juris.ts`):** Mutex em memória + lockfile `juris_search.lock` (stale 5s) + escrita atômica preservando todos os resultados únicos (`matched_queries[]`, `queries_history[]`, `total_accumulated`) mantendo topo do JSON e envelope MCP `< 900B` restritos à rodada atual.
- **Neutralidade Estrita & Rebalanceamento `0..100` (`statutory_bridge.ts`, `relevance_scorer.ts`, `tst_precedent_triage.ts`):** Defaults `NEUTRAL`/`AUTO` (`lexical 0..65`, `quorum 0..20`, `recency 0..15` em consultas livres), fim da injeção licitatória no TST e do falso positivo `"ATI"`/`"CAIXA"`/`"ORGAO_CONTRATANTE"`, `regime_detected` `NAO_APLICAVEL`/`NAO_IDENTIFICADO` e `outcome` judicial neutro.
- **Cache Dinâmico Live-Backed TTL 24h TST & Dossiê em `state/` (`tst_ttl_cache.ts`, `tst_mapper.ts`, `anatomical_markdown.ts`, `fetch_juris.ts`):** Eliminação de texto estático congelado, suporte live para `SUM`/`OJ`/`ACORDAO` com `DOCGOV_JURIS_CACHE_DIR`, `LIVE_FAILED`/`[LIVE_UNAVAILABLE]` em HTTP `5xx` sem cache `< 24h`, inteiro teor em `state/juris_<shortname>/inteiro_teor_anatomico.md`, ordenação `1->6`, `truncateCleanBoundary` e links diretos.

### Geração 7.3 — Trilha A (`v1.7.4` — Blindagem `ENG-10`, Escopos Efêmeros Isolados, Proteção de `inputs/` & Camada Universal de I/O)
- **Camada Universal de I/O (`src/utils/fs_safe_io.ts`, `src/mcp/server.ts`):** Extração e generalização de `withDirectoryLock()` com lockfile exclusivamente em `%TEMP%/docgov_locks/` (zero `.lock` em pastas do usuário), `writeFileSafeSync`/`Async` (UTF-8 sem BOM, `\n`, `Bun.sleepSync()`, escrita direta + retry `3x` no Windows fora de `%TEMP%` para Google Drive/OneDrive e `.tmp + rename` com fallback em POSIX/`%TEMP%`), fila `enqueueWrite`/`flushPendingWrites` conectada ao shutdown MCP e migração de `juris_search_store.ts`, `search_contracts.ts`, `registry.ts`, `json.ts` e `archive_and_bg_copy.ts`.
- **Blindagem Real `ENG-10` & Escopos Efêmeros (`src/utils/paths.ts`, `src/utils/ephemeral_scope.ts`):** Endurecimento de `isValidDocGovCaseScope()` contra *path traversal* (`..`), *symlinks* (`realpathSync`) e `docgov_ephemeral_inspect`, fechamento dos bypasses nos 4 compiladores e `inspect.ts --compare`, preservação de subpastas efêmeras nomeadas, sessões isoladas `<prefix>_<ts>_<rand4hex>`, redirecionamento cirúrgico `inputs/` -> `state/`, sweep lazy `>= 72h` (`.last_sweep`), `adapted_slots_manifest_<stem>.json`, `formatCompactMcpPath()` sem `../` e higiene zero-vazamento nos 15 arquivos de teste.
