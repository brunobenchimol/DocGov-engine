# Changelog

Todas as mudanças notáveis no projeto **`docgov-engine`** estão documentadas neste arquivo.

O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/), e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.7.2] - 2026-11-23 — Triagem A/B Estruturada do Conector TST (4 Baldes), Refatoração Modular 100% Lei 9 & Polimentos R4

### Added
- **Triagem A/B Estruturada Exclusiva do Conector TST (`src/tools/juris/tst_precedent_triage.ts`, `src/tools/juris/providers/tst_provider.ts`, `src/tools/juris/search_juris.ts`, `src/tools/juris/types.ts`, `src/mcp/tools_definition.ts`, `src/mcp/tool_dispatchers.ts`, `src/cli/connectors_cli.ts`, `test/juris/tst_precedent_triage.test.ts`):**
  - Módulo puro (`<= 500L`, zero I/O e zero acoplamento a `BaseJurisdictionProvider`) introduzindo o parâmetro opcional `triage_mode?: "triaged" | "raw" | "compare"` (CLI `--triage-mode`, padrão `"triaged"` apenas para `TST`; ignorado silenciosamente com **0 bytes** de alteração nos outros 11 conectores);
  - Coleta base única (`TstProvider.fetchTstLegacy`) preservando integralmente o comportamento `v1.7.1` em `"raw"` e executando exatamente **1 única consulta subjacente** também no modo `"compare"` (`raw_diff` + baldes);
  - Classificação determinística estrita por metadados estruturados (sem inspecionar texto livre da ementa) em 4 baldes (`erga_omnes` [`SV`, `RG`, `IRR`, `IAC`], `orientativas` [`SUMULA`, `OJ`, Embargos `E-RR`/`Ag-E-RR` -> `SBDI-1`, `SBDI-2`, `SDC`, `ORGAO_ESPECIAL`, `PLENO`], `inter_partes` [Turmas `1ª..8ª`, `MONOCRATICA`, `ArgInc` mesmo quando julgada no `Tribunal Pleno`] e fallback defensivo `unclassified`), extração confiável de `year` (omitido se ausente), piso mínimo de pertinência (`filtered_out` com bypass normativo/catálogo), agregação multi-query (`|`) sem duplo filtro, isolamento em consultas multi-corte e compactação progressiva garantindo `< 900B` (preservando `filtered_out_ids` antes de zerar em `"compare"`);
  - Manutenção das **16 tools MCP** com `search_juris.description` em **516 caracteres** (`<= 600`).
- **Resumo Compacto `forensic_meta` no Topo de `visao_auditoria_*.md` (`src/utils/pdf/forensic_cross_audit.ts`, `src/tools/inspect/audit_view_formatter.ts`, `src/parsers/spreadsheet.ts`, `src/tools/inspect/non_docx_pipeline.ts`):** Inclusão de bloco compacto legível no início do espelho de leitura linear para PDF, DOCX e XLSX (`source_format`, `author`, `last_modified_by`, `creation_date_iso`, `mod_date_iso`, `rsid_root`/`rsid_unique_count` em `.docx` e linha resumida por assinatura `pades_signatures` em `.pdf`), evitando leituras exploratórias de JSONs extensos e preservando o teto MCP `< 900B` inalterado.

### Changed
- **Refatoração Modular Integral dos 19 Arquivos Legados & Cobertura Total `100% src/` (`scripts/check_lines.ts`, `docs/ARCHITECTURE_AND_MODULES.md`):**
  - **Domínio de Tipos (`src/types/`):** fatiamento de `src/types/index.ts` em `document_and_inspection.ts`, `template_and_bootstrap.ts` e `audit_diff_and_pncp.ts` com barrel retrocompatível;
  - **Utilitários Raiz (`src/utils/`):** extração de `xml/{dom_and_tags,formatting_and_inline,numbering_manager}.ts`, `archives/magic_detector.ts` e `pdf/purejs_docx_renderer.ts`;
  - **Core (`src/core/`):** decomposição de `cartography.ts` (`cartography_rules.ts`, `cartography_markdown.ts`), `budget_auditor.ts` (`budget_pdf_scanner.ts`), `structural_diff.ts` (`token_lcs_diff.ts`), `registry.ts` (`structure_fingerprint.ts`) e `updater.ts` (`updater_crypto_and_env.ts`);
  - **Ferramentas & OpenXML (`src/tools/`):** fatiamento de `inspect/{toc_and_compactor,subtable_checkbox_detector,docx_xml_extractor}.ts`, `openxml/{multilevel_reanchoring,template_state_normalizer,table_slot_builder,technical_note_xml_cards}.ts`, `pncp/{identifier_and_redirects,fetch_contract,search_contracts}.ts`, `audit/{finding_formatters_and_cards,docx_styles_and_sections}.ts` e `bootstrap/{archive_and_bg_copy,file_ingestion_worker,master_index_renderer}.ts` com preservação integral 1:1 de contratos e símbolos exportados;
  - **Enforcement Universal Lei 9 (`scripts/check_lines.ts`):** `all` atualizado para auditar `100%` de `src/`, `test/`, `tests_live/` e `scripts/` sob o teto estrito `<= 500` linhas (somando-se à inclusão prévia de `src/cli`, `src/mcp`, `src/parsers` e `src/constants`).

### Fixed
- **Dicionário Jurídico das 6 Tags `v1.7.0` no Parecer DOCX da Rota E (`src/bidding/bidding_legal_humanizer.ts`):** Mapeamento explícito de `[FORENSIC_SIGNER_IDENTITY_MISMATCH_BLOCK]`, `[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]`, `[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]`, `[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]`, `[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]` e `[FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK]` com fundamentação legal específica (Lei nº 14.133/2021 Arts. 5º, 64, 67 e 155, VIII–X; MP nº 2.200-2/2001 / Lei nº 14.063/2020; Ajuste SINIEF nº 07/2005; Arts. 337-F/337-I CP) e recomendações coerentes de rejeição/inabilitação e PAS (eliminando o fallback genérico *"Sanear integralmente o apontamento"*).
- **Deduplicação de Chaves NF-e na Auditoria de ACT (`src/bidding/act_forensic_auditor.ts`):** Normalização e deduplicação prévia entre `nfe_access_key` e `diligence_nfe_keys[]` no mesmo atestado, impedindo linhas idênticas duplicadas na Seção 5.1 do parecer e na PARTE I do Ofício de Diligência.
- **Coerência Textual do Ofício de Diligência com `total_alerts === 0` (`src/bidding/act_diligence_letter_sections.ts`):** Substituição da frase contraditória *"identificou 0 alerta(s) objetivo(s) ... exigindo a imediata deflagração"* por redação coerente de verificação facultativa/preventiva de rotina (Art. 64 da Lei nº 14.133/2021) quando `CONFORME`, mantendo a redação investigativa incisiva quando `total_alerts >= 1`.

---

## [1.7.1] - 2026-11-22 — Hotfix PAdES Gov.br & Cadeia X.509 Encadeada, Smoke Test com Corpus Público Real & Resiliência de Conectores JURIS

### Added
- **Smoke Test Automatizado com Corpus Público Real (`scripts/discover_real_corpus.ts`, `scripts/run_real_smoke.ts`, `scripts/real_corpus_manifest.json`):** Suite *on-demand* (`smoke:real:discover` + `smoke:real`, LGPD-limpa e sem viés de seleção por cadeia/anomalia) cobrindo 6 artefatos públicos reais (`.pdf` PAdES único Gov.br e co-assinado PNCP, 2 modelos `.docx` distintos AGU para `w:rsid`, planilha `.xlsx` Compras.gov.br e chave NF-e modelo 55 do Portal da Transparência) com controles negativos, mutações isoladas em `os.tmpdir()` e chamadas integradas a `evaluateBiddingProposals` / `auditDirectContracting` (`< 900B`).
- **Superclasse Única de Conectores (`BaseJurisdictionProvider` — `src/tools/juris/providers/base_provider.ts` & `catalog_helper.ts`):** Padrão *Template Method* centralizando orçamento defensivo (`retries: 0`), Circuit Breaker de 30s (automaticamente desabilitado em `isMockMode() === true`, com `resetCircuit()` / `resetAllCircuits()`), resolução unificada de Mock Server (`mockFetchStyle: "path" | "query"` e `notFoundStyle: "null" | "exists_false"`), degradação graciosa em HTTP `5xx` (quando `!force_live`) e trava anti-alucinação em HTTP `404` (`[ANTI_HALLUCINATION_BLOCK]`).
- **Camada de Transparência Cognitiva (`src/tools/juris/types.ts`, `search_juris.ts`, `fetch_juris.ts`):** Exposição inequívoca da origem dos precedentes com `live_degraded` no envelope sintético MCP de `search_juris`, `source: "LIVE" | "CURATED_CATALOG"` em `fetch_juris` (e cabeçalho dos dossiês), além de `origin`, `source_mode` e `live_error` em `state/juris_search_results.json`/`.md`, com poda progressiva garantindo `< 880B` (Lei 2 `< 900B`).
- **Válvula de Retry Consciente (`force_live` / `--force-live`):** Parâmetro opcional em `search_juris`, `fetch_juris`, `tools_definition.ts`, `tool_dispatchers.ts` e CLI (`src/cli/connectors_cli.ts`, `src/cli/index.ts`), ignorando circuit breaker e *short-circuit* de catálogo com janela estendida única (`9000ms`, `retries: 0`) e falha explícita (`LIVE_FAILED` / `[LIVE_UNAVAILABLE]`) sem degradação silenciosa.
- **7 Novos Catálogos Normativos Curados Verificados (Lei 5 & Anti-Alucinação):** Criação de `tst_catalog.ts`, `tcu_catalog.ts`, `stf_catalog.ts`, `stj_catalog.ts`, `tcdf_catalog.ts`, `tce_ce_catalog.ts` e `tce_pa_catalog.ts` com súmulas, OJs, temas vinculantes e atos normativos verificados em fontes oficiais.
- **Runner Live Anti-Falso-Verde (`tests_live/juris_api.live.ts`, `tests_live/pncp_api.live.ts`, `scripts/run_live_tests.ts`):** Novo status `WARN (DEGRADED -> CURATED)` sempre que uma sonda live degradar ao catálogo curado por erro/timeout da API real, e `getCanonicalFallbackId` alinhado a IDs curados verificados.

### Changed
- **Migração 12/12 dos Conectores para `BaseJurisdictionProvider`:** Unificação integral de `TST`, `AGU`, `TCE-SP`, `TCE-MG`, `TCE-PR`, `TCM-PA`, `TCU`, `STF`, `STJ`, `TCDF`, `TCE-CE` e `TCE-PA`, com precedência **Live-First** no *merge* de buscas abertas (reservando *Curated-First* para *short-circuit* normativo explícito e fallback).
- **Endurecimento Global de Transporte & Playbook (`docs/JURIS_CONNECTOR_PLAYBOOK.md`, `docs/ARCHITECTURE_AND_MODULES.md`, `src/constants/index.ts`, `src/mcp/spec.ts`):** Imposição de `retries: 0` e teto de timeout na classe base, além dos 6 guardrails obrigatórios no Playbook para novos conectores (proibição de fabricação de acórdãos, hooks obrigatórios, prevenção de armadilha `liveSmokeQuery`, fallback `WARN`, testes `503`/`force_live`/`404` e leitura seletiva atualizada).

### Fixed
- **Hotfix PAdES Gov.br & Caminhamento Encadeado X.509 (`src/utils/pdf/pades_signature_auditor.ts`, `test/pades_signature_auditor.test.ts`):** Inclusão da hierarquia oficial Gov.br (`AC Final / Intermediária / Raiz do Governo Federal do Brasil`, `Secretaria de Governo Digital`) em `TRUSTED_ICP_ISSUER_REGEX` e implementação de caminhamento encadeado real em `parsedCms.certificates` (`current.issuerDn === parent.subjectDn`, profundidade máx. 5 e proteção anti-ciclo), mantendo bloqueio estrito contra certificados ICP-Brasil soltos/não vinculados no `SET` e eliminando o falso-positivo em assinaturas oficiais Gov.br (`12/12 PASS` no smoke test real).
- **Resiliência do `TST`, `TCU`, `TCE-CE`, `AGU` e `TCE-SP`:** Correção da falha em cascata do `TST` sob oscilação momentânea do portal, eliminação do pior caso de hang sequencial (`~100s` potenciais) no `TcuProvider.fetch` via orçamento único de deadline, correção do `fetch()` POST sem `AbortSignal.timeout()` no `TceCeProvider` e eliminação do `retries: 1` herdado silenciosamente por `AGU` e `TCE-SP`.

---

## [1.7.0] - 2026-11-21 — Geração 7.0 (Parte 1): Perícia Criptográfica `PKCS#7/PAdES` & `/ByteRange`, Validador NF-e 44 Dígitos, Clones `w:rsid` & Forense `.xlsx`

### Added
- **Pilar Anti-Fraude 1 — Parser Pure-JS `ASN.1/DER/BER` & Auditor `PKCS#7/CMS/PAdES` (`src/utils/pdf/asn1_der_parser.ts`, `src/utils/pdf/pades_signature_auditor.ts`, `src/utils/pdf/forensic_meta.ts`, `src/bidding/act_forensic_auditor.ts`):**
  - Parser binário Pure-JS `ASN.1/DER` com suporte a BER *Indefinite-Length* (`0x80`...`0x00 0x00`), recorte exato pelo TLV raiz (sem *strip* cego de `0x00`) e re-parsing de `OCTET STRING` em `SubjectAlternativeName` (`2.5.29.17`) extraindo OIDs oficiais ICP-Brasil `2.16.76.1.3.1` (CPF após `DDMMAAAA`) e `2.16.76.1.3.3` (CNPJ), além de seleção obrigatória do certificado folha via `SignerInfo.sid` (`issuer` + `serialNumber`);
  - Validação de cadeia `ICP-Brasil` / `Gov.br` contra certificados autoassinados ou não confiáveis (`[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]`), confronto de identidade X.509 sem falsos-positivos entre e-CPF de diretor PF e CNPJ da PJ (`[FORENSIC_SIGNER_IDENTITY_MISMATCH_BLOCK]`) e auditoria matemática de `/ByteRange` via `node:crypto` (`SHA-256`/`384`/`512`/`SHA-1`) diferenciando co-assinaturas visuais legítimas em `/Subtype /Form` de modificações incrementais suspeitas pós-assinatura (`[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]`).
- **Pilar Anti-Fraude 5.1 — Validador Algorítmico NF-e 44 Dígitos (`src/utils/forensics/nfe_key_validator.ts`):**
  - Decomposição posicional estrita (`UF[2] + AAMM[4] + CNPJ[14] + Modelo[2] + Série[3] + Número[9] + Emissão[1] + Código[8] + DV[1]`), validação das 27 UFs IBGE, mês `01..12`, modelos `55`/`65` e recálculo exato do Dígito Verificador Módulo 11 (`[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]`);
  - Confronto de `CNPJ` e `AAMM` (formatos `YYYY-MM-DD`, `DD/MM/YYYY` e `YYYY-MM`) em diligências ACT Via B (`diligence_nfe_keys[]` usando `expected_cnpj || bidder_cnpj`, nunca `issuer_cnpj`) e em `supplier_market_price_proofs[]` de Contratação Direta (`[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]`).
- **Pilar Anti-Fraude 5.2 & 5.3 — Clones `w:rsid` em `.docx` & `forensic_meta` em `.xlsx` (`src/utils/pdf/docx_forensic_meta.ts`, `src/utils/pdf/xlsx_forensic_meta.ts`, `src/utils/pdf/forensic_cross_audit.ts`, `src/tools/inspect/non_docx_pipeline.ts`, `src/tools/bootstrap.ts`):**
  - Extração de `w:rsidRoot` (`word/settings.xml`, ignorando `00000000`/vazio) e `w:rsidR` (`word/document.xml`) para detecção cruzada de clonagem mesmo com `Author` apagado (`[FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK]`);
  - Extração unificada de `docProps/core.xml` e `docProps/app.xml` para planilhas `.xlsx` (`source_format: "xlsx"`) em `inspect_doc`, `bootstrap_case` (`Inventário Forense de Metadados (PDF, DOCX & XLSX)`), `forensic_collusion_auditor.ts` e `audit_direct_contracting.ts`.
- **Guarda Determinística de `unknown_keys` na Gen6 (Lei 3 — `src/utils/forensics/gen6_contract_guard.ts`):**
  - Detector determinístico de chaves não reconhecidas em `docgov_evaluate_bidding_proposals` e `docgov_audit_direct_contracting` (incluindo todos os novos campos `v1.7.0` na *allowlist* sem aliases silenciosos), gravando `unknown_keys` e `schema_warnings` nos dossiês em disco e expondo `unknown_keys` no envelope MCP apenas quando não vazio (`< 900B`).
- **Suítes de Testes Modulares & Smoke `stdio` (`test/pades_signature_auditor.test.ts`, `test/nfe_key_validator.test.ts`, `test/rsid_and_xlsx_forensics.test.ts`, `test/mcp_stdio_smoke.test.ts`):**
  - Cobertura ponta a ponta das 6 novas tags, `unknown_keys` na Gen6, manutenção de **16 tools MCP** com `description <= 600` chars e envelopes `< 900B`.
- **Runner Compacto de Testes (`scripts/run_tests.ts` — `bun run test`):**
  - Wrapper determinístico consolidado de `## [Unreleased]` com saída compacta padrão (~95% de economia de tokens na suíte completa), heartbeat anti-travamento, preservação integral de falhas, ranking *Top 3* arquivos mais lentos e modo completo sob demanda (`bun run test:verbose`). *(Commit `1000793`)*

### Changed
- **Elevação de Decisão & Auditoria Física Lei 9 (`src/bidding/evaluate_bidding_proposals.ts`, `scripts/check_lines.ts`, `src/mcp/spec.ts`):**
  - Todas as 6 novas tags forenses `[FORENSIC_*_BLOCK]` elevam `decision` para `"REJECTED"` em `docgov_evaluate_bidding_proposals`;
  - Diretório `src/utils/forensics` registrado na verificação automática de teto `<= 500` linhas em `scripts/check_lines.ts` e especificação sincronizada em `src/mcp/spec.ts` (`--dump-spec`).

## [1.6.11] - 2026-11-19 — Blindagem de Contratos Gen5 (`Exact Copy-Paste Error` & Detector de `unknown_keys`), Smoke Test MCP `stdio` Real & Automação de Release Notes

### Added
- **Detector Determinístico de `unknown_keys` em Execução Contratual e ARP (`src/contracts/gen5_contract_errors.ts`, `src/contracts/audit_contract_execution.ts`, `src/arp/govern_arp.ts`):** Inspeção determinística de chaves desconhecidas no objeto raiz e nos arrays/estruturas principais de `docgov_audit_contract_execution` (`addendums[]`, `pas_sanctions[]`, `tripartite_items[]`, `readjustments[]`, `price_basket`, `risk_matrix_events[]`) e `docgov_govern_arp` (`items[]`, `validity`, `managing_organ`, `adhesion_request` / `adhesions[]`, incluindo detecção de `requesting_organ` enviado como string em vez de objeto estruturado), **sem criar aliases silenciosos** (Lei 3). Grava `unknown_keys` e `schema_warnings` nos dossiês JSON e Markdown em disco e inclui o campo compacto `unknown_keys` no envelope sintético MCP **somente quando não for vazio**, respeitando estritamente o teto `< 900B` (Lei 2).
- **Guardas `Exact Copy-Paste Error` para Ferramentas Gen5 (`49fb4e9`, `316d078` — `src/contracts/gen5_contract_errors.ts`):** Validação *fail-fast* (`hasRecognizedContractExecutionInput` e `hasRecognizedArpGovernanceInput`) em `docgov_audit_contract_execution` e `docgov_govern_arp`, emitindo a mensagem imperativa da Lei 3 acompanhada dos snippets JSON canônicos `EXACT_COPY_PASTE_CONTRACT_EXECUTION_SNIPPET` e `EXACT_COPY_PASTE_ARP_GOVERNANCE_SNIPPET`.
- **Suíte Determinística de Fumaça MCP via `stdio` Real (`c16287c` — `test/mcp_stdio_smoke.test.ts`):** Validação ponta a ponta do processo real do servidor MCP via `StdioClientTransport` cobrindo handshake `initialize`, orçamento de tokens em `tools/list` (`16/16 <= 600` chars), `prompts/get` (`docx_workflow_guide`), `tools/call` com entradas válidas, *Exact Copy-Paste Error* e detecção determinística de `unknown_keys` (ex.: `addendums[0].compensation_attempted` e `adhesions[0]`) mantendo o envelope MCP `< 900B`.
- **Automação & Dupla Defesa de Release Notes (`1d27178`, `734de3a`, `51966a0` — `scripts/extract_release_notes.ts`, `.github/workflows/release.yml`, `AGENTS.md`, `docs/JURIS_CONNECTOR_PLAYBOOK.md`, `test/distribution.test.ts`):** Extração determinística de título (`vX.Y.Z — <Subtítulo>`) e corpo editorial a partir da seção correspondente do `CHANGELOG.md` diretamente no pipeline de release (com `Full Changelog` e bloco de verificação oficial), somada à conferência obrigatória pelo agente via `gh release view` / `gh release edit` na Lei 7, DoD Global e Playbook de Conectores.

### Changed
- **Paridade Estrita `spec.ts` vs. Parsers Reais & Lockstep (`v1.6.11`):** Alinhamento integral entre `src/mcp/spec.ts` (`docs/especificacao_motor.md`), `src/contracts/addendum_auditor.ts`, `src/contracts/tripartite_matcher.ts`, `src/contracts/readjustment_auditor.ts`, `src/arp/govern_arp.ts` e `src/contracts/gen5_contract_errors.ts` (documentando `addendums[]`, `value_increase`, `value_decrease`, `compensated_attempt` e `adhesion_request.requesting_organ` estruturado como contrato canônico), além do bump SemVer para `1.6.11` em `package.json`, `src/constants/index.ts`, `src/mcp/tools_definition.ts`, `README.md`, `ROADMAP.md`, `docs/ARCHITECTURE_AND_MODULES.md` e `docs/CAPABILITIES_EVOLUTION_HISTORY.md`.

## [1.6.10] - 2026-11-18 — Higiene Arquitetural (Eixo 5): Orçamento Estrito de Tokens no Handshake MCP (`tools/list`) & Trava Automatizada

### Changed
- **Enxugamento Cirúrgico de Descrições no `tools/list` (`src/mcp/tools_definition.ts`, `src/demo_costs/audit_runner.ts`, `src/engineering/tool_definition.ts`):** Redução das 14 definições de ferramentas acima de `600` caracteres (`bootstrap_case`, `inspect_doc`, `build_docx_template`, `fill_docx_template`, `generate_audit_docx`, `generate_technical_note_docx`, `fetch_pncp`, `search_pncp`, `search_juris`, `fetch_juris`, `docgov_audit_contract_execution`, `docgov_govern_arp`, `docgov_audit_demo_regime` e `docgov_audit_engineering_works`) para o orçamento estrito `<= 600` caracteres (~150 tokens por tool), reduzindo a soma das `description`s de `20.793` para `7.631` chars (`-63,3%`) e o payload total `tools/list` de `45.432` chars (`46.236 B`, ~`11.358` tokens) para `32.256` chars (`32.712 B`, ~`8.064` tokens, `-29,0%`), com **zero breaking changes** em nomes, propriedades/enums de `inputSchema` ou `annotations`.
- **Preservação do Handshake `initialize` (`src/constants/index.ts`):** `DOCX_ENGINE_INSTRUCTIONS` mantém-se livre de regras internas de orçamento de tokens para não inflar o handshake `initialize`.
- **Self-Discovery & Lockstep (`v1.6.10`):** Sincronização de `VERSION` (`1.6.10`), `package.json`, `src/mcp/spec.ts` (item 30), `docs/especificacao_motor.md`, `README.md`, `ROADMAP.md`, `docs/ARCHITECTURE_AND_MODULES.md` e `docs/CAPABILITIES_EVOLUTION_HISTORY.md`.

### Added
- **Trava Automatizada Anti-Regressão no Handshake MCP (`test/mcp_spec.test.ts`):** Teste determinístico garantindo que 100% das ferramentas retornadas por `getMcpToolsDefinition()` respeitem `description.length <= 600` caracteres (blindando as futuras séries `v1.7.x` e `v1.8.x`).

## [1.6.8] - 2026-11-18 — Conector Municipal `TCM-PA` (1º Conector da Onda 3) & Coexistência Estadual/Municipal na Mesma UF

### Added
- **Catálogo Normativo Curado do TCM-PA (`src/tools/juris/providers/tcm_pa_catalog.ts`):** Repertório de 8 precedentes municipais (`TCM-PA-ACORDAO-42110-2024` como Precedente Canônico Principal SSOT para lote único/software em gestão municipal com `stance_alignment: "FAVORABLE"`, além de `TCM-PA-RESOLUCAO-16995-2023`, `TCM-PA-IN-02-2023`, `TCM-PA-CONSULTA-18-2024`, `TCM-PA-ACORDAO-39850-2023`, `TCM-PA-CONSULTA-09-2024`, `TCM-PA-SUMULA-1` e `TCM-PA-ACORDAO-41200-2024`) com todas as 10 sub-camadas anatômicas (`1A`..`6A`) e normalização bidirecional `normalizeTcmPaId` (incluindo forma abreviada `TCM-PA-AC-42110-2024`).
- **Conector Municipal `TcmPaProvider` (`src/tools/juris/providers/tcm_pa_provider.ts`):** 12ª corte oficial e 1º conector da Onda 3 Municipal (`tier: "MUNICIPAL"`, `uf: "PA"`), operando em Resiliência Dupla com *Live Primary* na API REST JSON oficial de `tcmpa.tc.br` (`/wp-json/wp/v2/posts` e `/wp-json/wp/v2/search`, `timeoutMs: 3500`, `retries: 0`), *Curated Fallback*, suporte a mock via `DOCGOV_JURIS_TCM_PA_URL` (rotas `/search` e `/fetch` com HTTP 404 disparando `[ANTI_HALLUCINATION_BLOCK]`) e `autoTriggerKeywords` cirúrgico sem termos geográficos isolados.
- **Arquitetura de Coexistência Onda 3 na Mesma UF (`src/tools/juris/types.ts`, `provider_registry.ts`, `search_juris.ts`, `tools_definition.ts`, `connectors_cli.ts`):** Adição de `JurisdictionTier: "MUNICIPAL"` e parâmetro opcional `sphere: "STATE" | "MUNICIPAL" | "ALL"` (MCP e CLI `--sphere`). Preserva `TCE-PA` como padrão retrocompatível para `uf: "PA"` isolado, suporta promoção automática via `autoTriggerKeywords` do `TCM-PA`, atalho `uf: "TCM-PA"`, fan-out `sphere: "ALL"`, `supported_ufs` estritamente deduplicado (`["PA", "CE", "DF", "SP", "MG", "PR"]`) e blindagem de `detectCourtFromRef` / `getDefaultFederalProviders`.
- **Suíte Modular da Onda 3 (`test/juris/municipal_courts.test.ts`) & Live Probe (`tests_live/juris_api.live.ts`):** Cobertura unitária e com mock HTTP real para coexistência `TCE-PA` vs. `TCM-PA`, normalização, fatiamento em 10 sub-camadas, trava anti-alucinação e teto MCP `< 900B`, além de registro do `TCM-PA` na suíte online (`--court=TCM-PA`).

### Changed
- **Documentação & Self-Discovery (`v1.6.8`):** Documentada a Seção `2.4` (Padrão Arquitetural Onda 3) em `docs/JURIS_CONNECTOR_PLAYBOOK.md`, isolado `autoTriggerKeywords` em `tce_pa_provider.ts` e sincronizados `VERSION` (`1.6.8`), `package.json`, `DOCX_ENGINE_INSTRUCTIONS`, `DOCX_WORKFLOW_GUIDE_TEXT`, `src/mcp/spec.ts`, `docs/especificacao_motor.md`, `docs/ARCHITECTURE_AND_MODULES.md`, `docs/CAPABILITIES_EVOLUTION_HISTORY.md`, `README.md` e `ROADMAP.md`.

## [1.6.7] - 2026-11-18 — Hardening Black-Box, Normalização Dual & Self-Discovery Completo da Tool 16 (`docgov_audit_engineering_works`)

### Added
- **Normalizador Dual Aninhado + Flat/Aliases (`src/engineering/input_normalizer.ts`):** Mapeamento determinístico de chaves *flat* na raiz e sinônimos naturais para `bdi_evaluation`, `tax_desoneracao_cprb`, `curva_abc_items` e `schedule_and_risk` (`cronograma_fisico_financeiro`, `stages`, `physical_pct`/`financial_pct`, `front_loading_detected`, `has_risk_allocation_matrix`, `attempts_design_error_addendum_without_legal_exception`, `design_error_addendum_attempted`, `illegal_design_addendum`, `aditivo_erro_projeto_sem_excecao`).
- **Contrato Exact Copy-Paste Error para Engenharia (`src/contracts/errors.ts`):** Adicionados `EXACT_COPY_PASTE_ENGINEERING_WORKS_SNIPPET` e `createEngineeringWorksContractError` (Lei 3), substituindo o erro genérico quando `bdi_evaluation` estiver ausente.
- **Módulo Dedicado de Schema MCP (`src/engineering/tool_definition.ts`):** Extraído e expandido `ENGINEERING_WORKS_TOOL_DEFINITION.inputSchema` com declaração explícita de `properties` e `items` de todos os subcampos aninhados (`bdi_evaluation`, `tax_desoneracao_cprb`, `curva_abc_items`, `unit_price_items`, `schedule_and_risk` e `has_unit_price_overpricing`), mantendo todos os arquivos abaixo de 500 linhas (Lei 9).
- **Testes Black-Box em `test/engineering_works.test.ts`:** Validação de disparo de `[ENG_SCHEDULE_FRONT_LOADING_CASHFLOW_MANIPULATION_BLOCK]` e `[ENG_INTEGRATED_CONTRACTING_ILLEGAL_DESIGN_ADDENDUM_BLOCK]` via aliases e chaves *flat*, *Exact Copy-Paste Error* e presença completa dos subcampos em `inputSchema` e `--dump-spec`.

### Changed
- **Self-Discovery Integral no `--dump-spec` (`src/mcp/spec.ts` / `docs/especificacao_motor.md`):** Expansão da seção `2.16. docgov_audit_engineering_works` com o Schema de Entrada JSON completo (Raiz, `bdi_evaluation`, `tax_desoneracao_cprb`, `curva_abc_items[]`, `schedule_and_risk` e aliases aceitos) e o snippet JSON canônico copiável.
- **Lockstep Documental (`v1.6.7`):** Atualização de `VERSION` (`1.6.7`), `package.json`, `DOCX_ENGINE_INSTRUCTIONS`, `README.md`, `ROADMAP.md`, `docs/ARCHITECTURE_AND_MODULES.md` e `docs/CAPABILITIES_EVOLUTION_HISTORY.md`.

## [1.6.6] - 2026-11-18 — Geração 6.5 (Eixo 2): Obras e Serviços de Engenharia (Acórdão TCU 2.622/2013, Súmula 253, SINAPI/SICRO, CPRB Lei 14.973/2024) & 16ª Tool MCP `docgov_audit_engineering_works`

### Added
- **Domínio Modular `src/engineering/` (`<= 500` linhas por arquivo — Lei 9):**
  - `src/engineering/types.ts`: contrato `EngineeringWorksAuditInput`, `EngineeringWorksAuditOutput` (`CONFORME` / `NAO_CONFORME`, `bdi_summary`, `sinapi_schedule_summary`, `inexequibility_summary`, `artifacts`) e catálogo completo de **11 tags bloqueantes `[ENG_*]` + 4 tags de inexequibilidade/jogo de planilha** (`15` tags no total).
  - `src/engineering/bdi_acordao_2622_evaluator.ts`: tabela oficial de quartis do **Acórdão TCU nº 2.622/2013** por tipologia (`CONSTRUCAO_EDIFICIOS`, `RODOVIARIA`, `REDES_AGUA_ESGOTO`, `REDES_ENERGIA_ELETRICA`, `PORTUARIA_MARITIMA`, `FORNECIMENTO_MATERIAIS_EQUIPAMENTOS`), validação algébrica da fórmula canônica do BDI, exigência de BDI Diferenciado reduzido (**Súmula TCU nº 253**, 3ºQ `16,80%`), bloqueio de *bis in idem* de Administração Local/Canteiro/Mobilização dentro do BDI, vedação de IRPJ/CSLL (**Súmula TCU nº 254**) e medição proporcional de Administração Local ao avanço físico.
  - `src/engineering/sinapi_sicro_schedule_evaluator.ts`: Curva ABC (Faixas A/B/C) frente às medianas `SINAPI`/`SICRO` (Decreto nº 7.983/2013), auditoria da simetria tributária Com/Sem Desoneração e transição gradual de CPRB x INSS folha (`2024..2028+` — **Lei nº 14.973/2024**), detector de *front-loading* (`> 5%`) no cronograma físico-financeiro e validação de Matriz de Alocação de Riscos e vedação de aditivo por erro de projeto em Contratação Integrada/Semi-Integrada (Art. 46 da Lei nº 14.133/2021 e Arts. 42–43 da Lei nº 13.303/2016).
  - `src/engineering/docx_renderer.ts` & `src/engineering/engineering_works_auditor.ts`: orquestração integrando `evaluateProposalInexequibility` de `src/bidding/inexequibility_evaluator.ts` (`< 75%`, garantia adicional `< 85%`, Súmula TCU 262 e Jogo de Planilha Súmula 259), emissão de `engineering_works_audit.json`, `engineering_works_audit.md`, `laudo_pericial_obras_engenharia.docx` e `laudo_pericial_obras_engenharia.pdf` em `workspace_dir` com guarda determinística `<= 880B` no `stdout` (`[+N_TAGS_NO_DOSSIE]`).
- **16ª Ferramenta MCP `docgov_audit_engineering_works` & CLI `audit-engineering-works`:** Registrada em `src/mcp/tools_definition.ts`, `src/mcp/tool_dispatchers.ts`, `src/cli/contracts_cli.ts`, `src/cli/index.ts`, `src/index.ts` e auditada em `scripts/check_lines.ts`.
- **Suíte Unitária & Estresse (`test/engineering_works.test.ts`):** Cobertura para cenários `CONFORME` (Semi-Integrada `SINAPI`/`SICRO` Desonerado 2026 com garantia adicional 85% e Rodoviária `SICRO` Não Desonerado via MCP) e estresse extremo disparando simultaneamente todas as **15 tags** via MCP e CLI (`stdout <= 880` bytes UTF-8).

### Changed
- **Lockstep Documental e Self-Discovery (`v1.6.6`):** Sincronização de `VERSION` (`1.6.6`), `package.json`, `DOCX_ENGINE_INSTRUCTIONS`, `DOCX_WORKFLOW_GUIDE_TEXT`, `src/mcp/spec.ts`, `docs/especificacao_motor.md`, `docs/ARCHITECTURE_AND_MODULES.md`, `docs/CAPABILITIES_EVOLUTION_HISTORY.md`, `README.md`, `ROADMAP.md` (item `9.5.2` marcado como `[x]`, fechando 100% da Geração 6.5), `test/mcp_spec.test.ts` e `test/version.test.ts`.

## [1.6.5] - 2026-11-17 — Geração 6.5 (Eixo 1): Regime DEMO (Módulos 1–6, Conta Vinculada, Decreto 12.174/2024) & 15ª Tool MCP `docgov_audit_demo_regime`

### Added
- **Domínio Modular `src/demo_costs/` (`<= 500` linhas por arquivo — Lei 9):**
  - `src/demo_costs/types.ts`: contrato `DemoRegimeAuditInput`, `DemoRegimeAuditOutput` (`CONFORME` / `NAO_CONFORME`, `calculated_totals_cents`, `artifacts`) e catálogo das **16 tags canônicas bloqueantes (`[DEMO_*]`)**.
  - `src/demo_costs/sheet_calculator.ts`: calculadora determinística em centavos inteiros e basis points para os **Módulos 1 a 6** do Anexo VII-D da IN SEGES/MPDG nº 05/2017 (piso CCT, Súmula nº 448, II TST + LTCAT, 13º/Férias + base CPP 20%/FGTS 8%, SAT/RAT × FAP, VT com desconto de 6% + VA CCT, API/multa FGTS/APT `<= 1,94%`, reposição de ausentes, insumos/EPIs/depreciação, fórmula Gross-Up "por dentro", alíquota efetiva EFD-Contribuições no Lucro Real conforme Acórdão TCU nº 1.214/2013 e vedação ao Simples Nacional Art. 17, XII LC nº 123/2006 salvo Anexo IV em limpeza/vigilância), produtividade por $m^2$ (Anexo VI-B) e Decreto Federal nº 12.174/2024 (vedação de corte remuneratório em `44h -> 40h` e cota/cláusulas para vítimas de violência doméstica).
  - `src/demo_costs/execution_governance.ts`: expurgo de 90% do Aviso Prévio Trabalhado na 1ª prorrogação (`1,94% -> 0,194%` — Acórdão TCU nº 1.586/2018), Conta-Depósito Vinculada (Anexo XII: `29,50%..31,33%`) vs. Pagamento pelo Fato Gerador e memória de Repactuação Anual por CCT (Art. 135 da Lei nº 14.133/2021).
  - `src/demo_costs/docx_renderer.ts` & `src/demo_costs/audit_runner.ts`: emissão de `demo_regime_audit.json`, `demo_regime_audit.md`, `laudo_pericial_planilha_demo.docx` e `laudo_pericial_planilha_demo.pdf` em `workspace_dir` com guarda determinística `<= 880B` no `stdout` (`[+N_TAGS_NO_DOSSIE]` sob estresse extremo sem perda no disco).
- **15ª Ferramenta MCP `docgov_audit_demo_regime` & CLI `audit-demo-regime`:** Registrada em `src/mcp/tools_definition.ts`, `src/mcp/tool_dispatchers.ts`, `src/cli/contracts_cli.ts`, `src/cli/index.ts`, `src/index.ts` e auditada em `scripts/check_lines.ts`.
- **Suíte Unitária & Estresse (`test/demo_regime.test.ts`):** Cobertura para cenários `CONFORME` (Lucro Real EFD e Simples Nacional Anexo IV) e estresse extremo disparando simultaneamente todas as **16 tags `[DEMO_*]`** via MCP e CLI (`stdout <= 880` bytes UTF-8).

### Changed
- **Lockstep Documental e Self-Discovery (`v1.6.5`):** Sincronização de `VERSION` (`1.6.5`), `package.json`, `DOCX_ENGINE_INSTRUCTIONS`, `DOCX_WORKFLOW_GUIDE_TEXT`, `src/mcp/spec.ts`, `docs/especificacao_motor.md`, `docs/ARCHITECTURE_AND_MODULES.md`, `docs/CAPABILITIES_EVOLUTION_HISTORY.md`, `README.md`, `ROADMAP.md` (item `9.5.1` marcado como `[x]`), `AGENTS.md`, `test/mcp_spec.test.ts` e `test/version.test.ts`.

## [1.6.4] - 2026-11-16 — Guarda MCP `<= 880B` Sob Estresse Máximo, Jogo de Planilha, Fase Recursal Completa & Schema no `--dump-spec`

### Added
- **Paridade Completa de Jogo de Planilha (`src/bidding/inexequibility_evaluator.ts`):** Detecção determinística de `[UNIT_PRICE_OVERPRICING_JOGO_DE_PLANILHA_BLOCK]` via array `unit_items[]` / `spreadsheet_items[]` / `items[]` (`offered_unit_price > estimated_unit_price` ou `unit_price > reference_unit_price`) e/ou flags diretas (`has_unit_price_overpricing`, `jogo_de_planilha_detected`, `unit_price_overpricing_detected`).
- **Paridade Completa da Fase Recursal Art. 165 & Acórdão TCU 1.211/2021 (`src/bidding/appeals_evaluator.ts`):** Suporte em `appeal_context` (e aliases flat na raiz) para `[APPEAL_INTENTION_SUMMARY_REJECTION_ILLEGAL_BLOCK]`, `[APPEAL_DEADLINE_3_BUSINESS_DAYS_VIOLATION]`, `[NEW_DOCUMENT_PRECLUSION_EXCEPTION_ACORDAO_1211_2021]` e `[HIERARCHICAL_REMISSION_10_DAYS_MANDATORY]`, além da humanização correspondente em `src/bidding/bidding_legal_humanizer.ts` com 100% de retrocompatibilidade.
- **Testes Unitários de Teto Extremo e Fase Externa (`test/contracts_arp_mcp_cli.test.ts` e `test/bidding_inexeq_appeals_v164.test.ts`):** Cobertura para estresse de 17+ tags simultâneas em `docgov_audit_contract_execution` + 6 tags `REJECTED` com DOCX/PDF em `docgov_govern_arp` sob `%TEMP%` longo (`< 900B`), Jogo de Planilha e novos marcadores recursais.

### Fixed
- **Teto Estrito MCP `<= 880B` em `docgov_audit_contract_execution`, `docgov_govern_arp`, `docgov_evaluate_bidding_proposals` e `docgov_audit_direct_contracting` (Lei 2):**
  - Implementados `buildCompactArpSyntheticResult` e `serializeArpSyntheticResult` em `src/arp/govern_arp.ts` e aplicados no dispatcher MCP (`src/mcp/tool_dispatchers.ts`), reduzindo payloads com 6 tags + caminhos compilados de ~1099B para `< 880B` sem perder tags.
  - Extraídos helpers compartilhados (`toCompactWorkspacePath`, `serializeCompactSyntheticResult`, `fitBlockingTagsToBudget`) em `src/utils/json.ts`, unificando os 4 orquestradores Gen5/Gen6 e corrigindo os dispatchers `search_juris`/`fetch_juris` em `src/mcp/tool_dispatchers.ts`.
  - Adicionada guarda determinística `<= 880B` em `src/contracts/audit_contract_execution.ts`, `src/bidding/evaluate_bidding_proposals.ts` e `src/direct_contracting/audit_direct_contracting.ts`: preserva 100% das tags sempre que o envelope minificado couber em `<= 880B` (removendo antes campos redundantes/secundários como `proposal_decision`, `compiled_docs_count`, `act_forensic_alerts_count`, `docx_path`, `pdf_path` e `modality`); no overflow extremo (`14+` tags em `Gen6-D` ou `17+` em `Gen5-A`), compacta apenas a cauda de `blocking_tags` com `"[+N_TAGS_NO_DOSSIE]"` mantendo todas as tags íntegras nos arquivos `.json`/`.md` gravados em disco.

### Changed
- **Documentação Integral de Schema no `--dump-spec` (`src/mcp/spec.ts` / `docs/especificacao_motor.md` — Lei 4):** Documentados todos os subcampos e aliases de `inexequibility_evaluator.ts` (75%/85% e Jogo de Planilha), `competing_proposals_meta[]` e `appeal_context` na seção `2.13. docgov_evaluate_bidding_proposals`.

## [1.6.3] - 2026-11-15 — Higienização Estrutural, Mapa Arquitetural (`ARCHITECTURE_AND_MODULES.md`) & Trava Permanente de Lockstep

### Added
- **Mapa Arquitetural Canônico (`docs/ARCHITECTURE_AND_MODULES.md`):** Novo índice de navegação rápida para agentes IA e desenvolvedores mapeando todas as **14 ferramentas MCP**, comandos CLI, arquivos `src/` responsáveis, suítes `test/` / `tests_live/` e escopo exato da auditoria física da Lei 9 (`scripts/check_lines.ts`).
- **Trava Automatizada de Lockstep Documental (`test/version.test.ts`):** Validação contínua no `bun test` garantindo sincronia de `VERSION` em `package.json`, `README.md` (versão, `engine_version`, contagem e nomes das 14 ferramentas MCP e subcomandos CLI), `CHANGELOG.md`, `ROADMAP.md`, igualdade exata de `docs/especificacao_motor.md` com `--dump-spec`, existência física de todos os caminhos citados em `docs/ARCHITECTURE_AND_MODULES.md` e ausência de `ENGINEERING.md` duplicado.
- **Enforcement da Lei 9 em CI/CD:** Adicionado passo `bun run check:lines` nos workflows `.github/workflows/ci.yml` e `.github/workflows/release.yml`.

### Changed
- **Alinhamento Self-Discovery (`v1.6.3`):** Atualização de `src/mcp/spec.ts`, `src/mcp/tools_definition.ts` (listando todas as 11 cortes homologadas em `search_juris`), `src/constants/index.ts` (`DOCX_WORKFLOW_GUIDE_TEXT` sincronizado com `v${VERSION}` e Passos 1–14), `PROTECTED_ROOT_FILES` em `src/tools/bootstrap.ts` (incluindo `"bun.lock"`), `AGENTS.md` (Leis 4, 7 e DoD) e `README.md` completo para Geração 6 (`14` ferramentas MCP e CLI).

### Removed
- **Higienização de Duplicata e Código Morto:** Removido `ENGINEERING.md` duplicado na raiz (mantendo `AGENTS.md` como estatuto único) e removidos os 2 shims órfãos sem importadores (`src/tools/juris/providers/higher_courts_provider.ts` e `src/tools/juris/providers/state_tces_provider.ts`).

## [1.6.2] - 2026-11-15 — Upgrade `unpdf@2.1+`, Perícia Forense Dual `PDF/DOCX`, Ponte Multimodal `assets/` & Fase Externa/Recursal (Gen6)

### Added
- **Classificação Multimodal de Páginas & Extração Pura JS de Imagens (`src/utils/pdf/`):**
  - Upgrade de `unpdf` para `^2.1.0` (`unpdf@2.2.1`) sem dependência de `@napi-rs/canvas`, mantendo 100% de compatibilidade com `bun build --compile`.
  - Modularização de `src/utils/pdf.ts` (`<= 400` linhas) em submódulos coesos sob a Lei 9 (`src/utils/pdf/stream_fallback.ts`, `page_inspector.ts`, `image_extractor.ts`, `forensic_meta.ts`, `docx_forensic_meta.ts`, `forensic_cross_audit.ts`).
  - Classificação em 5 classes canônicas (`BORN_DIGITAL`, `FULL_PAGE_SCAN`, `HYBRID_HEADER_SCAN_TRAP`, `EMBEDDED_VISUAL_ASSET`, `OCR_LAYER_EMBEDDED`), filtro anti-ruído (`width < 220 || height < 150 || area < 45000` e SHA-256 repetido em `>= 3` páginas), teto `MAX_EXTRACTED_IMAGES_PER_DOC = 20`, materialização em `cases/<id>/assets/<stem>/pag_XXX_img_YY.png` (ou `%TEMP%/docgov_ephemeral_inspect/assets/<stem>/`), injeção de âncoras `[PAG_XXX | ASSET_IMG_YY | tipo=... | coverage=NN% | WxHpx | path="..."]` em `visao_auditoria_*.md` e `dossie_hotspots_*.md`, e omissão de inspeção pesada em `pdf_exporter.ts` pós-exportação.
- **Perícia Forense Dual `PDF/DOCX` & Detecção de Conluio em `bootstrap_case`:**
  - Extração unificada `DocumentForensicMeta` para `.pdf` (`getMeta`, `extractLinks`, scanner `/Type /Sig` + `/M (D:...`) e `.docx` (`docProps/core.xml` + `docProps/app.xml`), detectando rastros `Canva`, `iLovePDF`, `Sejda`, `Smallpdf`, `CorelDRAW`, `Photoshop`, `PDFescape`, `Nitro` e `PhantomPDF` (`[PDF_EDITOR_MANIPULATION_TRACE]`).
  - Tabela `### 🔍 Inventário Forense de Metadados (PDF & DOCX) e Cobertura Visual Multimodal` e alertas cruzados `[BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT]` / `[PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK]` em `state/indice_mestre_caso.md`.
- **Evolução Gen6 — Conluio, Obras 75%/85%, Recursal Art. 165 & Sobrepreço na Inexigibilidade:**
  - `forensic_collusion_auditor.ts`, `inexequibility_evaluator.ts` (Art. 59 §§ 4º e 5º + garantia adicional 85% + Súmula TCU 262), `appeals_evaluator.ts` & `appeals_docx_sections.ts` (compilando `Peca_Razoes_ou_Contrarrazoes_Recurso_Administrativo.docx/.pdf` e `Decisao_Pregoeiro_e_Encaminhamento_Autoridade_Superior.docx/.pdf`).
  - Auto-hidratação em `act_forensic_auditor.ts` (`> 180` dias, colisão de `Author` com licitante, `[ACT_PDF_EDITING_SOFTWARE_TRACE_SUSPICION]`) e auditoria de sobrepreço/cotações simuladas em `direct_contracting_auditor.ts` (`[PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK]`, `[INEXIGIBILITY_OVERPRICING_ABOVE_SUPPLIER_MARKET_PROOF_BLOCK]`).
- **Nova Suíte Unitária Multimodal (`test/pdf_unpdf_v2_multimodal_forensics.test.ts`):**
  - Cobertura de ponta a ponta das 5 classes de página, extração/materialização de PNGs, rastros de editores, metadados DOCX, detecção de conluio no `bootstrap_case` e teto `< 900B`.

### Fixed
- **Bloco de Assinatura na Fase Recursal (`src/bidding/appeals_docx_sections.ts` e `bidding_xml_primitives.ts`):**
  - Corrigido spread ausente (`...pSignatureBlock([...])`) e passagem de `string[]` nas peças `Peca_Razoes_ou_Contrarrazoes_Recurso_Administrativo.docx` e `Decisao_Pregoeiro_e_Encaminhamento_Autoridade_Superior.docx`, além de normalização defensiva em `pSignatureBlock` e `bodyParts.flat().join("\n")` em `emitDocxAndPdf` evitando iteração por caractere ou junção `</w:p>,<w:p>`.

## [1.6.1] - 2026-11-15 — Reformulação Jurídico-Pericial Integral dos Compiladores DOCX/PDF (Geração 6 & Gen5.5/5.6) + Schemas `--dump-spec`

### Changed
- **Compilação Jurídico-Pericial da Geração 6 — Eixo TIC & Diligência ACT (`src/bidding/`):**
  - Substituição integral dos relatórios telegráficos por redação técnico-jurídica oficial em português, modularizada sob a Lei 9 em `bidding_xml_primitives.ts`, `bidding_legal_humanizer.ts`, `bidding_opinion_sections.ts` e `act_diligence_letter_sections.ts`.
  - **Formatação Determinística pt-BR e Interpolação Fática:** Valores monetários (`R$ 1.234,56`), índices contábeis/percentuais (`176,53%`), datas brasileiras (`DD/MM/AAAA`), tradução por extenso de regimes (`Lei Federal nº 14.133/2021` / `Lei Federal nº 13.303/2016`), decisões, métricas TIC e todos os 7 Vetores Forenses de ACT (`VETOR_1`..`VETOR_7`), acompanhados de dicionário jurídico completo das 19 tags do Eixo A (`describeBiddingTagLegalProse`).
  - **`Parecer_Julgamento_Proposta_Habilitacao_e_Diligencia.docx/.pdf`:** Estruturado em 6 seções periciais formais (Síntese Executiva, Modelo TIC Não-DEMO, Exequibilidade Paramétrica por Perfis e Súmula TCU nº 262, Qualificação Técnica com Conversibilidade + Quadro Contábil `ILG/ILC/ISG/EG`, Fichas Periciais por ACT e Quadro Consolidado com Dispositivo Conclusivo e assinatura).
  - **`Oficio_e_Email_Diligencia_Veracidade_ACT.docx/.pdf`:** Estruturado em 3 partes operacionais (Parte I Quadro Diagnóstico Forense, Parte II **VIA A** direta ao Emissor via contatos cadastrais da Receita Federal com prazo de 3 a 5 dias úteis e advertência dos Arts. 299 e 337-I do Código Penal, e Parte III **VIA B** à Licitante exigindo NF-e/NFS-e de 44 dígitos, Contrato/aditivos, OS/medições, SEFIP/GFIP/eSocial, comprovantes bancários e Súmula TCU 262).
- **Compilação Jurídico-Pericial da Geração 6 — Contratação Direta & Oportunidade Estatal (`src/direct_contracting/direct_contracting_sections.ts` & `direct_contracting_compiler.ts`):**
  - Estruturação de `Parecer_Instrucao_Inexigibilidade_Dispensa_ou_Oportunidade_Estatal.docx/.pdf` em 3 seções formais cobrindo **Inexigibilidade** (Art. 74 / Art. 30, Súmula TCU nº 255 e quadro de 3 NFs/contratos do Art. 23, § 4º), **Dispensa por Valor** (tabela de UG, exercício, PDM/CATMAT/CATSER, gasto prévio, proposto, consolidado, limite legal e excesso em `R$`) e **Oportunidade de Negócio Estatal** (tabela dos 5 requisitos cumulativos do Art. 28, § 3º, II e § 4º da Lei nº 13.303/2016), com quadro analítico das 5 tags do Eixo B.
- **Consolidação dos Hotfixes de Execução Contratual, PAS, Dosimetria e Self-Discovery (Gen5.5/5.6 & Gen6):**
  - Humanização jurídico-administrativa completa dos relatórios de Execução Contratual, Notificação Prévia/PAS e Parecer de Dosimetria (`src/contracts/contract_humanizer.ts`), calibração da tabela da LINDB Art. 22 eliminando falsos status `"PROPORCIONAL"` e normalização de aliases naturais de agentes nas ferramentas 2.11 e 2.12.
  - Detalhamento explícito dos schemas JSON de entrada (raiz e objetos aninhados) nas seções 2.11, 2.12, 2.13 e 2.14 do manifesto `--dump-spec` (`src/mcp/spec.ts`).

### Fixed
- Ampliação das suítes `test/bidding_gen6.test.ts` e `test/direct_contracting_gen6.test.ts` validando estrutura de seções formais, tabelas `<w:tbl>`, valores em `R$` pt-BR, regimes completos e preservação integral das tags de rastreabilidade.

## [1.6.0] - 2026-11-14 — Marco 9 (Geração 6): Seleção do Fornecedor 360º em TIC sem DEMO, Exequibilidade de Perfis de TI, Conversibilidade, Motor Forense Anti-Fraude de ACT (7 Vetores) & Contratação Direta / Oportunidade Estatal

### Added
- **Tool MCP #13 `docgov_evaluate_bidding_proposals` & CLI `evaluate-proposals` (`src/bidding/`):**
  - **Modelos de Execução de TIC sem DEMO & Exequibilidade (`ict_execution_models.ts`):** Matriz de descaracterização de alocação disfarçada de mão de obra (`[ICT_HIDDEN_LABOR_DEDICATION_DEMO_TRAP_BLOCK]`), travas de `UST`/`USM`/`UNS` (Súmula TCU 269 -> `[ICT_UST_RAW_HOUR_EQUIVALENCE_SUMULA269_BLOCK]`), `HST`/`Hora-Técnica` com teto prévio fechado em OS (`[ICT_UNBOUNDED_TECHNICAL_HOUR_PARADOX_BLOCK]`), `PF`/`SQUADs` vinculados a entregáveis/ANS e exequibilidade paramétrica de perfis profissionais de TI com trava vinculante da Súmula TCU 262 (`[ICT_PROPOSAL_BELOW_PROFILE_FLOOR_INEXEQUIBLE]` e `[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]`).
  - **Habilitação Técnica (Conversibilidade) & Econômico-Financeira (`qualification_evaluator.ts`):** Conversibilidade paramétrica entre métricas correlatas (`UST <-> Horas <-> PF <-> Postos <-> Chamados`, `[ICT_ACT_RIGID_METRIC_RESTRICTION_BLOCK]`), travas Súmula TCU 263 (teto 50%, relevância mínima 4%, somatório obrigatório de atestados) e auditoria contábil de `ILG`, `ILC`, `ISG`, `EG`, teto de 10% e vedação cumulativa `CS + PL` (`[CUMULATIVE_CAPITAL_AND_EQUITY_BLOCK]`).
  - **Motor Forense Anti-Fraude de ACT — 7 Vetores Determinísticos (`act_forensic_auditor.ts`):** Vetor 1 (Porte/CNAE), Vetor 2 (Cronologia/Status CNPJ), Vetor 3 (Rastreabilidade PNCP), Vetor 4 (Conflito Societário QSA/Contato), Vetor 5 (Plágio Literal do Edital via Jaccard), Vetor 6 (Plausibilidade Volumétrica Esforço vs. Tempo) e Vetor 7 (Metadados PDF/ICP-Brasil).
  - **Compilação OpenXML DOCX/PDF (`bidding_docx_compiler.ts`):** Geração de `Parecer_Julgamento_Proposta_Habilitacao_e_Diligencia.docx/.pdf` e `Oficio_e_Email_Diligencia_Veracidade_ACT.docx/.pdf` com tabelas `<w:tbl>`, **Via A** (ao Emissor na Receita Federal) e **Via B** (à Licitante exigindo NF-e/NFS-e de 44 dígitos, Contrato, OS e SEFIP/eSocial).
- **Tool MCP #14 `docgov_audit_direct_contracting` & CLI `audit-direct-contracting` (`src/direct_contracting/`):**
  - **Inexigibilidade & Dispensa por Valor (`direct_contracting_auditor.ts`):** Súmula TCU 255 (`[INVALID_EXCLUSIVITY_CERTIFICATE_BLOCK]`), comprovação mínima de 3 NFs/contratos do fornecedor no mercado (`[INEXIGIBILITY_PRICE_PROOF_INSUFFICIENT_BLOCK]`) e controle anti-fracionamento anual por UG e código `PDM / CATMAT / CATSER` (`[EXPENSE_FRAGMENTATION_BLOCK]`).
  - **Oportunidade de Negócio e Parcerias Estratégicas em Estatais (Art. 28, § 3º, II da Lei 13.303/2016):** Validação de objeto social, singularidade do parceiro, inviabilidade concorrencial e matriz de riscos/receitas (`[STATE_ENTERPRISE_PARTNERSHIP_UNJUSTIFIED_BLOCK]`), com compilação de `Parecer_Instrucao_Inexigibilidade_Dispensa_ou_Oportunidade_Estatal.docx/.pdf`.
- **Suítes Unitárias Modulares & Governança (Leis 2, 4, 8 e 9):**
  - Criação de `test/bidding_gen6.test.ts` e `test/direct_contracting_gen6.test.ts`, expansão de `scripts/check_lines.ts` para auditar `src/bidding` e `src/direct_contracting` e retorno sintético MCP estritamente `< 900 bytes`.

## [1.5.6] - 2026-11-14 — Marco 8.6 (Geração 5.6): Adequação Federativa do PAS (Estadual/Municipal/Estatal) junto ao TCE/TCM Competente & Calibragem Jurisprudencial da Dosimetria (LINDB Art. 22)

### Added
- **Adequação Federativa e Jurisdicional do PAS (`src/contracts/pas_federative_dosimetry.ts` & `src/contracts/pas_federative_types.ts`):**
  - **Alcance Territorial Estrito do Impedimento (Art. 156, § 4º Lei 14.133/2021):** Bloqueio de entes Estaduais ou Municipais que pretendam alcance nacional/União/todas as esferas ou prazo superior a 36 meses (`[PAS_SANCTION_TERRITORIAL_SCOPE_MISMATCH_BLOCK]`).
  - **Regime Sancionatório Estrito das Empresas Estatais (Art. 83, III e Art. 38 Lei 13.303/2016):** Restrição à suspensão temporária com a própria estatal por até 24 meses, bloqueando prazos superiores, invocação de `DECLARACAO_INIDONEIDADE` da Lei 14.133 ou extensão indevida além da entidade sancionadora (`[PAS_STATE_ENTERPRISE_SANCTION_REGIME_MISMATCH_BLOCK]`).
  - **Competência Exclusiva e Parecer Conclusivo para Inidoneidade (Art. 156, § 6º):** Exigência estrita de Ministro de Estado, Secretário Estadual/Municipal ou Autoridade Máxima de Autarquia/Fundação acompanhada de parecer jurídico conclusivo (`[PAS_INCOMPETENT_AUTHORITY_FOR_DEBARMENT_BLOCK]`).
  - **Resolução Determinística de Corte de Contas Competente (`competent_audit_court`) e Remessa Obrigatória (Art. 161):** Mapeamento determinístico (`FEDERAL` -> `TCU`; `STATE` -> `TCDF`/`TCE-<UF>`; `MUNICIPAL` -> `TCM-SP`, `TCM-RIO`, `TCM-PA`, `TCM-BA`, `TCM-GO`, demais `TCE-<UF>`) e conferência de comando expresso em `CEIS`, `CNEP`, `PNCP` e `<TCE/TCM>` (`[PAS_EXTERNAL_CONTROL_REGISTRY_OMISSION_ALERT]`).
- **Calibragem Jurisprudencial da Dosimetria (`Art. 156, § 1º` + `LINDB Art. 22, §§ 2º e 3º`):**
  - Verificação de ancoragem em precedentes sancionadores da Corte de Contas e ponderação dos vetores da LINDB Art. 22 (`[PAS_ARBITRARY_UNANCHORED_DOSIMETRY_ALERT]`).
  - Detecção determinística de outliers desproporcionais de multa ou prazo acima da faixa referencial/mediana sem agravantes formalmente comprovadas (`[PAS_DISPROPORTIONATE_SANCTION_OUTLIER_BLOCK]`).
- **Enriquecimento OpenXML/PDF (`src/contracts/contract_compiler.ts`):**
  - Inclusão do **Quadro de Enquadramento Jurisdicional e Federativo** e do **Quadro de Calibragem Jurisprudencial da Dosimetria (LINDB Art. 22 / Art. 156, § 1º)** em `Notificacao_Previa_Descumprimento_e_PAS.docx/.pdf` e `Parecer_Dosimetria_Sancao_ou_Glosa_ANS.docx/.pdf`.
- **Suíte Unitária & Lockstep (`test/contracts/pas_federative_v156.test.ts`):**
  - Cobertura integral dos sub-asserts `30.13a` a `30.16`, mantendo 100% de retrocompatibilidade com a `v1.5.5`, payload MCP `< 900 bytes` e teto físico de 500 linhas (Lei 9).

### Changed
- **Sincronização Self-Discovery & Governança (Leis 4, 8 e 9):**
  - Atualização em lockstep da versão `1.5.6` em `package.json`, `src/constants/index.ts` (`VERSION` e `DOCX_ENGINE_INSTRUCTIONS`), `src/mcp/spec.ts`, `src/mcp/tools_definition.ts`, `docs/especificacao_motor.md`, `README.md` e `ROADMAP.md`, mantendo exatamente 12 ferramentas MCP.

## [1.5.5] - 2026-11-13 — Marco 8.5 (Geração 5.5): PAS, Glosa ANS/IMR vs. Multa, Seguro-Garantia, Cesta de Preços IN 65/2021 & Álea Extraordinária

### Added
- **Auditoria Determinística de PAS, Glosa ANS/IMR vs. Multa e Garantias (`src/contracts/pas_sanction_auditor.ts`):**
  - Segregação matemática e jurídica entre glosa remuneratória por ANS/IMR e penalidade sancionatória, emitindo `[SLA_GLOSA_MISCLASSIFIED_AS_PENALTY_BLOCK]` em tentativas de punição disfarçada ou aplicação de desconto fora das faixas do IMR sem PAS formal.
  - Validação do piso legal de `0,5%` e teto de `30%` sobre o valor do contrato para multas na Lei 14.133/2021 (Art. 156, § 3º) e regime da Lei 13.303/2016 (`[MULTA_BELOW_LEGAL_FLOOR_0_5PCT_OR_ABOVE_30PCT_BLOCK]`).
  - Motor de dosimetria graduada determinística (`ADVERTENCIA`, `MULTA`, `IMPEDIMENTO_LICITAR_CONTRATAR` até 3 anos restrito ao ente sancionador, e `DECLARACAO_INIDONEIDADE` de 3 a 6 anos exclusiva para infrações graves do Art. 155, VIII a XII).
  - Verificação obrigatória de abertura formal do PAS / notificação prévia e concessão de prazo mínimo de **15 dias úteis** para contraditório (Arts. 157 e 158 da Lei 14.133/2021), emitindo `[PAS_CONTRADICTORY_15_DAYS_VIOLATION_BLOCK]`.
  - Verificação de notificação formal à seguradora e vigência de apólice em contratos garantidos por Seguro-Garantia (Art. 102 Lei 14.133), emitindo `[SURETY_INSURER_NOTIFICATION_REQUIRED_BLOCK]`.
- **Motor Estatístico Anti-Outlier de Cesta de Preços & Álea Extraordinária (`src/contracts/price_basket_auditor.ts`):**
  - Cálculo determinístico sobre amostras de cotação (IN SEGES/ME nº 65/2021 & RILC): Média Aritmética ($\mu$), Mediana, Desvio Padrão ($\sigma$), Coeficiente de Variação ($CV = (\sigma/\mu)\times 100$), limites de expurgo ($\mu \pm \sigma$) e Média Saneada.
  - Bloqueio determinístico de uso da média simples em alta dispersão (`CV > 25%` -> `[PRICE_BASKET_HIGH_DISPERSION_USE_MEDIAN]`).
  - Auditoria de matriz de risco em pleitos de reequilíbrio econômico-financeiro / álea extraordinária (`[EXTRAORDINARY_RISK_ALLOCATED_TO_CONTRACTOR_BLOCK]`).
- **Compilador Nativo OpenXML DOCX/PDF de PAS e Dosimetria (`src/contracts/contract_compiler.ts`):**
  - Geração determinística em layout editorial corporativo A4 com tipografia limpa para `Notificacao_Previa_Descumprimento_e_PAS.docx/.pdf` (`PAS_NOTIFICATION`) e `Parecer_Dosimetria_Sancao_ou_Glosa_ANS.docx/.pdf` (`SANCTION_DOSIMETRY_OPINION` e alias canônico `DOSIMETRY_OPINION`), ou ambos (`BOTH`).
- **Suíte Unitária & Lockstep (`test/contracts/gen5_5_pas_and_basket.test.ts`):**
  - Cobertura integral dos sub-asserts `30.9a`, `30.9b`, `30.10`, `30.11a`, `30.11b` e `30.12`, mantendo 100% de compatibilidade com schemas `snake_case` e `camelCase` e garantindo payload sintético MCP estritamente `< 900 bytes`.

### Changed
- **Evolução sem Inflação de Tools MCP (`docgov_audit_contract_execution` & CLI `audit-contract`):**
  - Preservação das 12 ferramentas MCP canônicas e retrocompatibilidade total com a `v1.5.0`, estendendo `src/contracts/audit_contract_execution.ts`, `src/cli/contracts_cli.ts` (`--mode`, `--format`) e `src/mcp/tool_dispatchers.ts` (`compilationMode`, `outputFormat`).
  - Atualização de autodescoberta e documentação sincronizada (`--dump-spec`, `DOCX_ENGINE_INSTRUCTIONS`, `getMcpToolsDefinition()`, `README.md`, `ROADMAP.md` e `VERSION = "1.5.5"`).

## [1.5.0] - 2026-11-08

### Adicionado
- **Geração 5 (Marco 8) — Fiscalização Contratual, Aditivos 25%/50%, Batimento Quadripartite, Reajustes/Repactuações e Governança de ARP:**
  - **Auditoria de Limites de Aditamento e Vedações Rígidas (`src/contracts/addendum_auditor.ts`):**
    - Cálculo isolado de acréscimos e supressões (25% para compras, serviços e obras; 50% para reformas de edifícios ou equipamentos — Art. 125 da Lei nº 14.133/2021 e Art. 81 da Lei nº 13.303/2016);
    - Vedação matemática expressa de compensação mútua entre acréscimos e supressões para mascarar estouro de limite (`[ADDENDUM_COMPENSATION_FORBIDDEN]`);
    - Bloqueio determinístico imediato de aditamento quantitativo aplicado diretamente sobre a Ata de Registro de Preços (`[ILLEGAL_ARP_ADDENDUM_BLOCK]`);
    - Validação de consensualidade obrigatória em contratos de empresas estatais da Lei 13.303/2016 (`[STATE_ENTERPRISE_UNILATERAL_ADDENDUM_BLOCK]`);
    - Emissão de tags canônicas `[ADDENDUM_LIMIT_EXCEEDED_25PCT]` e `[ADDENDUM_LIMIT_EXCEEDED_50PCT]`.
  - **Motor de Batimento Quadripartite e Detecção de Sobrepreço (`src/contracts/tripartite_matcher.ts`):**
    - Cruzamento encadeado de conformidade: `[TR / Edital] <-> [Proposta Vencedora] <-> [ARP] <-> [Contrato Derivado / OS / Fatura]`;
    - Detecção automatizada de divergência de preço unitário (contratado/faturado > proposta/TR), superfaturamento quantitativo (faturado > homologado/contratado), pagamento antecipado sem garantia e supressão arbitrária (`[TRIPARTITE_OVERPRICING_DETECTED]`).
  - **Monitoramento de Reajustes e Repactuações (`src/contracts/readjustment_auditor.ts`):**
    - Verificação do interregno legal mínimo de 12 meses (365 dias) contado da data-base do orçamento ou da CCT anterior (`[READJUSTMENT_INTERREGNUM_VIOLATION_12M]`);
    - Exigência de comprovação formal de CCT homologada para repactuações de mão de obra exclusiva;
    - Memória de cálculo auditável de reajuste por índices (IPCA, INPC, IGP-M, ICT).
  - **Motor de Governança Determinística de ARP e Gestão de Caronas (`src/arp/`):**
    - *Livro-Razão Automatizado (`src/arp/ledger_engine.ts`):* Travas matemáticas estritas de 50% individual por item (`[ARP_INDIVIDUAL_LIMIT_EXCEEDED_50PCT]`) e 200% global acumulado de caronas sobre o quantitativo registrado (`[ARP_GLOBAL_LIMIT_EXCEEDED_200PCT]`), preservando intacto o saldo próprio do Gerenciador e Participantes;
    - *Matriz de Compatibilidade Jurídica e Federativa (`src/arp/compatibility_matrix.ts`):* Verificação de simetria de regime (14.133 vs 13.303 — `[ARP_REGIME_ASYMMETRY_BLOCK]`), bloqueio de adesão ascendente vedada de União/Estados em atas municipais (`[ARP_FEDERATIVE_ASCENDING_BLOCK]`), e condicionantes de soluções de TIC em lote único/guarda-chuva sem memória de cálculo (`[ARP_ICT_UMBRELLA_LOT_BLOCK]`);
    - *Vigência e Desacoplamento Contratual:* Monitoramento da vigência da ARP (12+12 meses), trava de renovação de quantitativos no 2º ano sem previsão editalícia (`[ARP_RENEWAL_WITHOUT_EDITAL_CLAUSE_BLOCK]`) e validação do desacoplamento autônomo dos contratos derivados celebrados dentro da validade da ata (vigência de até 5 anos / 60 meses);
    - *Compilador Nativo OpenXML DOCX e PDF (`src/arp/arp_compiler.ts`):* Geração editorial A4 de `Nota_Tecnica_Anuencia_ou_Negativa_Adesao_ARP.docx/.pdf` (visão Órgão Gerenciador) e `Estudo_Tecnico_Vantajosidade_Adesao_ARP.docx/.pdf` (visão Órgão Aderente/Carona).
  - **Exposição MCP e CLI com Teto Estrito de Payload (< 900 bytes):**
    - Ferramentas MCP `docgov_audit_contract_execution` e `docgov_govern_arp` com retorno sintético em stdout estritamente abaixo de 900 bytes (Lei 2);
    - Comandos CLI `audit-contract` e `govern-arp` (com aliases `--audit-contract` e `--govern-arp`);
    - Modularização de dispatchers (`src/mcp/tool_dispatchers.ts` e `src/cli/contracts_cli.ts`) preservando `src/mcp/server.ts` (449 linhas) e `src/cli/index.ts` (476 linhas) confortavelmente sob o teto da Lei 9 (<= 500 linhas);
    - Atualização de `--dump-spec` e sincronização integral de especificações técnicas;
    - Interoperabilidade Lockstep certificada para o Assert 30 da suíte C# `DocGov`.

## [1.4.6] - 2026-11-08

### Adicionado
- **Conector Estadual TCE-PR (`src/tools/juris/providers/tce_pr_provider.ts`) e Catálogo Curado (`tce_pr_catalog.ts`) (Marco 7.10):**
  - Conector nativo dedicado ao **Tribunal de Contas do Estado do Paraná (`TCE-PR` / UF: "PR")**, integrando o Repertório Oficial de Prejulgados Vinculantes, Súmulas e Consultas com Força Normativa do Tribunal Pleno conforme LC Estadual nº 113/2005 (Lei Orgânica do TCE-PR), além de busca live no portal ViaJuris (`https://viajuris.tce.pr.gov.br`).
  - **Estratégia de Resiliência Dupla:**
    - *Live Primary:* Consulta direta ao endpoint AJAX oficial do ViaJuris (`POST /Pesquisa/PesquisaAcordaos/Buscar`) com timeout defensivo de 3500ms, zero retries e parsing estruturado de ementas, relatórios, números de processo/acórdão e links oficiais para visualização e download de PDFs;
    - *Catálogo Curado Determinístico (`tce_pr_catalog.ts`):* Base canônica imutável com 9 precedentes de alto valor normativo: Prejulgado 28 (parcelamento do objeto em TIC, lote único e indivisibilidade técnica no ETP sob as Leis 14.133/2021 e 13.303/2016); Prejulgado 25 (limites de qualificação econômico-financeira, índices de liquidez, patrimônio líquido de até 10% e vedação a cumulação com capital social); Prejulgado 06 (limites de terceirização de mão de obra e fiscalização trabalhista); Prejulgado 26 (inexigibilidade para serviços jurídicos e contábeis, notória especialização e singularidade); Prejulgado 11 (excepcionalidade de pagamento antecipado e indispensabilidade de garantia contratual); Súmula 05 (vedação a taxa negativa ou taxa zero em gerenciamento de frotas e vales-alimentação); Súmula 08 (regularidade fiscal e trabalhista restrita à habilitação); Consulta 2804/2024 (formalismo moderado e saneamento de certidões vencidas com conselho profissional ativo sob a Lei 14.133/2021); Consulta 3154/2023 (limites de 50%/200% para adesão carona a atas de registro de preços e prévio ETP).
  - **Higiene Estrita de Auto-Trigger e idPatterns (Zero Falso-Positivo entre UFs):**
    - `autoTriggerKeywords` com regex cirúrgica ativada por termos inequívocos (`tce-pr`, `tce/pr`, `tcepr`, `tribunal de contas do estado do parana`, `tribunal de contas do parana`, `viajuris`, `prejulgado ... tce-pr`, `sumula ... tce-pr`, `curitiba`, `celepar`, `sanepar`, `copel`, `lei estadual 15.608`, `decreto estadual 10.086`), com exclusão proposital do termo isolado "parana" para prevenir falso-positivo em endereços genéricos;
    - `idPatterns` e `normalizeTcePrId` com suporte bidirecional robusto a `TCE-PR-PREJULGADO-<N>`, `PREJULGADO-TCEPR-<N>`, `SUMULA-TCEPR-<N>`, `TCE-PR-SUMULA-<N>`, `TCE-PR-CONSULTA-<N>-<ANO>` e `TCE-PR-ACORDAO-<N>-<ANO>`.
  - **Compatibilidade Rigorosa com a Suíte .NET (`DocGov` Sub-Assert 29.11):**
    - Suporte a `DOCGOV_JURIS_TCE_PR_URL` (com aliases `DOCGOV_JURIS_TCEPR_URL` e `DOCGOV_TCE_PR_BASE_URL`) no modo mock;
    - Suporte canônico a payloads JSON do `JurisMockServer` e trava anti-alucinação estrita (`[ANTI_HALLUCINATION_BLOCK]`) barrando com fail-fast identificadores inexistentes (ex.: `TCE-PR-999999`).
  - **Fatiamento Anatômico nas 6 Macro-Partes / 10 Sub-Camadas:**
    - Camadas 1A a 6A estruturadas com Tribunal Pleno, Conselheiro Relator e entidade genérica `ORGAO_CONTRATANTE` (Lei 5 de Neutralidade Institucional);
    - Camada 5A (Dispositivo) com precedência decisória para alinhamento tático `FAVORABLE` sob `stance: "DEFENSE"` para o Prejulgado 28 (lote único de software).
  - **Teto Estrito MCP (< 900 bytes):** Retornos sintéticos em conformidade com a Lei 2 (814 bytes na busca e 672 bytes no fatiamento anatômico).

## [1.4.5] - 2026-11-07

### Adicionado
- **Auto-Discovery Dinâmico de Conectores no Runner Online `test:live:juris` (`tests_live/juris_api.live.ts` e `scripts/run_live_tests.ts`):**
  - Descoberta automática de todos os conectores ativos através de `defaultJurisdictionRegistry.getAllProviders()` ao executar `bun run test:live:juris` (sem `--court` ou com `--court=ALL`), eliminando sondas fixas e homologando automaticamente qualquer nova corte adicionada ao registro;
  - Execução de 21 sondas de rede (2 sondas por conector: `searchJuris` com `liveSmokeQuery` + `fetchJuris` com fatiamento anatômico do top hit ou fallback canônico + 1 Sonda Dinâmica de `Graceful Fallback`);
  - **Diagnóstico Transparente de Origem:** Exibição explícita do canal de resposta de cada corte no relatório executivo (`[API Live Direta]`, `[Híbrido (Live + Curado)]`, `[Fallback Curado Local]`, `[Catálogo Normativo Curado]` e `[Graceful Fallback]`), com latência real da API e bytes do envelope MCP (< 900B);
  - **Filtro Multi-Corte e Pontual:** Suporte a execução por tribunal isolado (`--court=TCE-MG`) com tempo de resposta < 3s, múltiplas cortes separadas por vírgula (`--court=TCE-SP,TCE-MG`) ou execução explícita de todas (`--court=ALL`);
  - **Sonda Dinâmica de Graceful Fallback:** Resolução em tempo de execução da primeira UF brasileira ainda não suportada via `defaultJurisdictionRegistry.getSupportedUfs()` (atualmente `AC`), garantindo perenidade do teste conforme novas UFs forem adicionadas.
- **Conector Estadual TCE-MG (`src/tools/juris/providers/tce_mg_provider.ts`) e Catálogo Curado (`tce_mg_catalog.ts`) (Marco 7.10):**
  - Conector nativo dedicado ao **Tribunal de Contas do Estado de Minas Gerais (`TCE-MG` / UF: "MG")**, integrando o Repertório Oficial de Súmulas e Consultas do Tribunal Pleno dotadas de força normativa e eficácia vinculante conforme art. 76 da Lei Orgânica do TCE-MG (LC Estadual nº 102/2008), além de busca live no portal TCJuris (`https://tcjuris.tce.mg.gov.br`).
  - **Estratégia de Resiliência Dupla:**
    - *Live Primary:* Consulta defensiva ao endpoint oficial do TCJuris (`/Home/Busca` e `/Home/Detalhes/{id}`) com timeout estrito de 3000ms e zero retries;
    - *Catálogo Curado Determinístico (`tce_mg_catalog.ts`):* Base canônica imutável com as principais Súmulas e Consultas Normativas do Tribunal Pleno (Súmula 114 — parcelamento obrigatório do objeto divisível; Súmula 126 — manutenção de frota, quarteirização e vedação a credenciamento prévio; Súmula 88 — dever de licitar e fracionamento de despesa; Súmula 79 — formalismo moderado na homologação; Consulta 1.160.667 — adesão carona a atas sob leis pretéritas na vigência da Lei 14.133/2021; Consulta 1.177.447 — ilegalidade de cobrança de taxa de carona por gerenciador ou consórcio público; Consulta 1.119.769 — consórcio público e adesão posterior de não consorciados; Consulta 1.148.573 — habilitação econômico-financeira e proporcionalidade de índices contábeis; Consulta 1.092.348 — qualificação técnica operacional limitada a 50% e vedação a vínculo prévio; Consulta 1.077.234 — desdobramento federativo de sanções de impedimento vs inidoneidade; Consulta 1.007.492 — serviços de TIC com medição por resultados, SLA e vedação a homem-hora puro).
  - **Higiene Estrita de Auto-Trigger e idPatterns (Zero Falso-Positivo entre UFs):**
    - `autoTriggerKeywords` exige menção explícita a termos mineiros (`tce-mg`, `tcemg`, `tribunal de contas de minas gerais`, `minas gerais`, `belo horizonte`, `mapjuris`, `tcjuris`, `cemig`, `copasa`, `prodemge`, `lei 14.184`, `decreto 48.723`, `súmula <N> do tce-mg`), prevenindo falso-positivo com buscas genéricas;
    - `idPatterns` e `normalizeTceMgId` com suporte a prefixos inequívocos (`SUMULA-TCEMG-...`, `CONSULTA-TCEMG-...`, `TCE-MG-CONSULTA-...`, `TCE-MG-...`, `TCEMG`).
  - **Compatibilidade Rigorosa com a Suíte .NET (`DocGov` Assert 29.10):**
    - Suporte a `DOCGOV_JURIS_TCEMG_URL`, `DOCGOV_TCE_MG_BASE_URL` ou `DOCGOV_JURIS_BASE_URL` no modo mock;
    - Suporte canônico ao formato de consulta mockada `TCE-MG-CONSULTA-123456` e trava anti-alucinação estrita (`[ANTI_HALLUCINATION_BLOCK]`) barrando com fail-fast identificadores inexistentes (ex.: `TCE-MG-999999`).
  - **Fatiamento Anatômico nas 6 Macro-Partes / 10 Sub-Camadas:**
    - Camadas 1A a 6A estruturadas com colegiado Tribunal Pleno, Conselheiro Relator e entidade genérica `ORGAO_CONTRATANTE` (Lei 5 de Neutralidade Institucional);
    - Camada 5A (Dispositivo) com precedência decisória para alinhamento tático no `RelevanceScorer`.
  - **Teto Estrito MCP (< 900 bytes):** Retornos sintéticos em conformidade com a Lei 2 (814 bytes na busca live e 672 bytes no fatiamento anatômico).
  - **Sonda Online de Contrato:** Integração ao runner `bun scripts/run_live_tests.ts --suite=juris --court=TCE-MG` com 100% de aprovação (Sondas 1 e 2 em 0.30s).

### Modificado
- **Hardening Estrutural de Governança de Testes e Extensão da Lei 9:**
  - Decomposição modular de 6 monólitos históricos de teste que ultrapassavam o teto físico:
    - `test/juris.test.ts` (900+ linhas) decomposto no subdiretório `test/juris/` (`anatomical_slicer.test.ts`, `core_and_scorer.test.ts`, `federal_courts.test.ts`, `routing_and_tools.test.ts`, `state_courts.test.ts`);
    - `test/engine.test.ts` decomposto em `test/engine_mcp_ceiling.test.ts`, `test/engine_resilience.test.ts`, `test/engine_pdf_cartography.test.ts` e `test/engine_pdf_spatial.test.ts`;
    - `test/fill_template.test.ts` decomposto em `test/fill_template_injection.test.ts` e `test/fill_template_multilevel.test.ts`;
    - `test/build_template.test.ts` decomposto em `test/build_template_contracts.test.ts` e `test/build_template_tables.test.ts`;
    - `test/pncp.test.ts` decomposto em `test/pncp_fetch.test.ts` e `test/pncp_search.test.ts`;
    - `test/multilevel_section_numbering.test.ts` decomposto em `test/numbering_reanchoring.test.ts` e `test/numbering_anomaly_scanners.test.ts`;
    - `test/inspect.test.ts` e `test/registry.test.ts` enquadrados com extração de `test/registry_matching.test.ts`.
  - **Extensão da Lei 9 (Teto Estrito $\le 500$ Linhas) no `scripts/check_lines.ts`:**
    - Atualização do verificador de conformidade para auditar 100% dos arquivos `.ts` em `test/`, `tests_live/`, `scripts/` e `src/tools/juris/` (83 arquivos auditados, 0 violações).
  - **Atualização do `ENGINEERING.md` e `AGENTS.md`:**
    - Registro formal da governança modular de testes na Lei 9 e no Definition of Done (DoD).
  - **Expansão do `ROADMAP.md` (Marco 7.10):**
    - Sincronização da tabela da esteira `v1.4.5` a `v1.4.18+` em Lockstep Estrito com o `DocGov`, incluindo Onda 2 (Grandes Cortes Estaduais: `TCE-MG`, `TCE-PR`, `TCE-RJ`, `TCE-RS`, `TCE-PE`, `TCE-BA`, `TCE-SC`, `TCE-AM`) e Onda 3 (os 5 TCMs: `TCM-SP`, `TCM-RIO`, `TCM-BA`, `TCM-GO`, `TCM-PA`).

## [1.4.4] - 2026-11-07

### Adicionado
- **Conector Estadual TCE-SP (`src/tools/juris/providers/tce_sp_provider.ts`) e Catálogo Curado (`tce_sp_catalog.ts`) (Marco 7.9):**
  - Conector nativo dedicado ao **Tribunal de Contas do Estado de São Paulo (`TCE-SP` / UF: "SP")**, cobrindo o Repertório Oficial de Súmulas do TCE-SP (Súmulas nº 1 a 52) e busca live de acórdãos, decisões, deliberações plenárias e boletins de jurisprudência no portal oficial (`https://www.tce.sp.gov.br/jurisprudencia/pesquisar`).
  - **Estratégia de Resiliência Dupla:**
    - *Live Primary:* Consulta e parsing estruturado de HTML em `https://www.tce.sp.gov.br/jurisprudencia/pesquisar?acao=Executa` com mapeamento direto de trechos localizados, processos e acórdãos em formato leve (< 7000ms);
    - *Catálogo Curado Determinístico (`tce_sp_catalog.ts`):* Base canônica imutável com as Súmulas de alto valor para compras públicas, TIC e finanças (Súmula 14 — disponibilidade vs propriedade prévia; Súmula 15 — vedação a carta de fabricante/compromisso de terceiro; Súmulas 20, 21, 22, 23, 24 — limitação de 50% em qualificação operacional; Súmulas 25, 27, 30, 33 — vedação a carona em ARP; Súmula 44 — inexequibilidade e contraditório; Súmula 50 — recuperação judicial; Súmula 51 — alcance da inidoneidade vs impedimento), assegurando execução determinística e instantânea (< 5ms) offline/airgap ou sob instabilidades de rede governamental.
  - **Higiene Estrita de Auto-Trigger e idPatterns (Zero Falso-Positivo entre UFs):**
    - `autoTriggerKeywords` exige menção explícita a `tce-sp`, `tcesp`, `tribunal de contas de são paulo` ou `súmula <N> do tce-sp`, impedindo que buscas genéricas por números de súmula em outras UFs acionem indevidamente a corte paulista;
    - `idPatterns` restrito a prefixos inequívocos (`SUMULA-TCESP-...`, `TCE-SP-TC-...`, `TC-...`, `TCESP`), prevenindo colisões de números processuais.
  - **Fatiamento Anatômico nas 6 Macro-Partes / 10 Sub-Camadas:**
    - Camadas 1A a 6A mapeadas integralmente com colegiado Tribunal Pleno / Câmaras, Conselheiro Relator e entidade canônica `ORGAO_CONTRATANTE` (preservando estritamente a Lei 5 de Neutralidade Institucional Absoluta);
    - Camada 5A (Dispositivo) com precedência decisória para alinhamento tático no `RelevanceScorer` (`FAVORABLE` para enunciados autorizativos e `ADVERSE_DISTINGUISHING_REQUIRED` para restrições ou vedações peremptórias).
  - **Compatibilidade Rigorosa com a Suíte .NET (`DocGov` Sub-Assert 29.9):**
    - Suporte a `DOCGOV_JURIS_TCESP_URL`, `DOCGOV_TCE_SP_BASE_URL` ou `DOCGOV_JURIS_BASE_URL` no modo mock;
    - Suporte canônico ao acórdão paradigma de TIC `TCE-SP-TC-000123-2024` com tolerância dupla a payloads mockados (`items`, `results` ou `{ exists: true, rawTextOrJson }`);
    - Trava anti-alucinação imediata (`[ANTI_HALLUCINATION_BLOCK]`) barrando com fail-fast identificadores inexistentes (ex.: `TCE-SP-999999` ou `SUMULA-TCESP-999`).
  - **Teto Estrito MCP (< 900 bytes):** Retornos sintéticos em conformidade com a Lei 2 (790 bytes na busca live e 641 bytes no fatiamento anatômico).
  - **Sonda Online de Contrato:** Integração ao runner `bun scripts/run_live_tests.ts --suite=juris --court=TCE-SP`, validando search e fetch online em < 3.5s.

## [1.4.3] - 2026-11-06

### Adicionado
- **Conector Federal AGU / CGU (`src/tools/juris/providers/agu_provider.ts`) e Catálogo Curado (`agu_catalog.ts`) (Marco 7.8):**
  - Mapeamento direto e autônomo das **Orientações Normativas (ONs da AGU nº 01 a 107+)**, **Súmulas vinculantes da AGU (Súmula nº 01 a 87+)** e **Pareceres Referenciais da CNLCA/CGU** sobre vigência, prorrogação contratual em serviços contínuos, limites legais de alteração (art. 125 da Lei nº 14.133/2021), parâmetros de contratação direta por dispensa de licitação (art. 75) e vedação a pagamento antecipado sem garantia idônea.
  - **Estratégia de Resiliência Dupla:**
    - *Live Primary:* Parsing rápido do HTML oficial do portal `gov.br/agu` (`/onsagu` e `/sumula`) com suporte completo aos cabeçalhos de navegador e isolamento de requisições;
    - *Catálogo Normativo Curado:* Submódulo determinístico (`agu_catalog.ts`) contendo o dataset oficial imutável de alto valor para contratações públicas (ONs 01/2009, 46/2014, 50/2014, 84/2024, 107/2026, Súmulas 34, 72, 87 e Pareceres CNLCA 01/2021, 01/2024), assegurando execução instantânea offline/airgap ou sob instabilidades governamentais (ex.: erro 503 no CONUNI).
  - **Ativação Contextual Plug-and-Play (`autoTriggerKeywords`):** Convocação automática da AGU quando a query textual envolve orientações normativas, súmulas da AGU, pareceres referenciais da CNLCA, CGU, CONUNI ou DECOR, mantendo `defaultFederal: false` para não inflar pesquisas ordinárias.
  - **Fatiamento Anatômico nas 6 Macro-Partes / 10 Sub-Camadas:**
    - Camada 1A/1B: Enquadramento institucional em `AGU`, colegiado `Advogado-Geral da União` ou `CNLCA/CGU/AGU` e entidade `ADMINISTRAÇÃO_PÚBLICA_FEDERAL`;
    - Camada 5A (Dispositivo) com precedência máxima: Projeção do comando normativo vinculante na camada 5A, permitindo ao `RelevanceScorer` classificar comandos autorizativos ("é lícita", "prescinde", "não está adstrita", "dispensada") como `IMPROCEDENTE / MANUTENCAO_CERTAME` (`FAVORABLE`) e restrições peremptórias ("é vedado", "determina-se", "abstenção") como `PROCEDENTE / DETERMINACAO` (`ADVERSE_DISTINGUISHING_REQUIRED`);
    - Camada 6A (Fecho & Quórum): Atribuição de eficácia vinculante federal nos termos do art. 40 da Lei Complementar nº 73/1993 com pontuação máxima de quórum (10 pts).
  - **Compatibilidade Rigorosa com a Suíte .NET (`DocGov`):**
    - Resolução de URL por `DOCGOV_JURIS_AGU_URL`, `DOCGOV_AGU_BASE_URL` ou `DOCGOV_JURIS_BASE_URL`;
    - Regex universal de IDs suportando variações de prefixos (`ON-AGU-...`, `AGU-ON-...`, `SUMULA-AGU-...`, `PARECER-CNLCA-...`) e números de 1 a 6 dígitos;
    - Trava anti-alucinação estrita que barra IDs inválidos ou inexistentes (ex.: `AGU-ON-999999`) com `[ANTI_HALLUCINATION_BLOCK]`.
  - **Script de Verificação de Teto Físico (`scripts/check_lines.ts`):** Auditoria automatizada garantindo conformidade com a Lei 9 ($\le 500$ linhas) em 100% dos submódulos do domínio de jurisprudência.
  - **Teto Estrito MCP (< 900 bytes):** Retorno sintético enxuto tanto na busca (775 bytes) quanto no fatiamento (703 bytes).

## [1.4.2] - 2026-11-02

### Adicionado
- **Conector Federal Isolado TST (`src/tools/juris/providers/tst_provider.ts`) (Marco 7.7):**
  - Integração nativa com a jurisprudência trabalhista unificada do Tribunal Superior do Trabalho via REST (`https://jurisprudencia-backend.tst.jus.br/rest/pesquisa-textual`), focado em Súmula 331, Tema 246 e Tema 1118 de Repercussão Geral, responsabilidade subsidiária da Administração Pública e de Empresas Estatais e fiscalização de encargos trabalhistas em terceirização de TI e serviços contínuos.
  - Ativação condicional declarativa (`autoTriggerKeywords`) no padrão plug-and-play da `v1.4.1`: TST participa automaticamente de buscas quando a query textual contém termos como `terceirização`, `súmula 331`, `responsabilidade subsidiária`, `tema 246`, `tema 1118`, `mão de obra`, `dedicação exclusiva`, sem inchar buscas ordinárias de TI/bens comuns.
  - Resolução autônoma por número de processo CNJ (`XXXXXXX-XX.XXXX.5.XX.XXXX`) no `fetch_juris` com lookup textual no backend do TST para identificação do hash de 32 caracteres e download do HTML do inteiro teor, sem depender de cache prévio em memória.
- **Calibragem Tática do `RelevanceScorer` (Precedência de Desfecho & Distinguishing):**
  - Precedência estrita da Camada 5A (Dispositivo e comando decisório) sobre enunciados e ementas gerais.
  - Penalidade de inversão tática de `-15 pts` quando o desfecho do acórdão for adverso à tese do gestor em `stance: "DEFENSE"` (ex.: condenação, anulação de certame ou determinação corretiva).
  - Classificação explícita `stance_alignment: "FAVORABLE" | "ADVERSE_DISTINGUISHING_REQUIRED" | "NEUTRAL"` em cada resultado retornado.
  - Inclusão do badge visual `⚠️ [ADVERSO — EXIGE DISTINGUISHING]` na tabela ranqueada de `juris_search_results.md`.
- **Sonda Online de Contrato para o TST:**
  - Inclusão de sonda dedicada para o conector do TST no runner de live tests (`bun scripts/run_live_tests.ts --suite=juris --court=TST`), validando tempo de resposta (< 1000ms) e teto MCP (< 900 bytes).

### Corrigido
- **Hotfix Crítico no Conector TST (`TstProvider`) e Fatiamento Anatômico (`AnatomicalSlicer`):**
  - **Resolução Precisa de CNJ Trabalhista (`J = 5`):** Implementação de parser robusto para CNJ pontuado (`NNNNNNN-DD.AAAA.5.TR.OOOO`) e não-pontuado (20 dígitos numéricos puros), formatando `numeracaoUnica` com strings normalizadas (`tribunal: "05"`, `vara: "0033"`) para consulta exata ao backend do TST, eliminando a falha de busca por tipos numéricos incorretos.
  - **Eliminação de Crash por Elementos Nulos:** Saneamento defensivo com *safe navigation* em `reg.temaProcs` e `reg.indicadores`, evitando o crash fatal `TypeError: null is not an object (evaluating 't.desTemaProc')` quando a API do TST retorna arrays contendo `[ null ]`.
  - **Roteamento Determinístico de CNJ Trabalhista:** Adição de padrões regex do CNJ trabalhista (`.5.` e 20 dígitos numéricos) em `TstProvider.idPatterns`, `detectCourtFromRef` e `parseCanonicalAcordaoRef`, impedindo o redirecionamento indevido de processos trabalhistas para o TCU.
  - **Extração Real de HTML com Tolerância a Tipografia Forense Espaçada:** Suporte a letras espaçadas (`V O T O`, `R E L A T Ó R I O`, `A C Ó R D Ã O`, `ISTO POSTO` e `ACORDAM`), assegurando a extração integral dos votos dos ministros (> 25.000 caracteres) e do dispositivo real nos acórdãos do TST.
  - **Mapeamento Completo de Metadados e Fallbacks:** Inclusão de `obj.ementa` na cadeia de fallbacks do `AnatomicalSlicer` e mapeamento fiel de `processo` (`numFormatado`), `colegiado` (turmas do TST), `relator` e `dataSessao`, erradicando placeholders falsos e avisos de conteúdo vazio (`(VAZIO — ZERO CONTEÚDO EXTRAÍDO)`).
- **Filtro Anti-Ruído de Domínio Administrativo no `StfProvider`:**
  - Injeção mandatória de cláusula `must` administrativa e cláusula `must_not` para ruídos tributários `(ICMS AND ISS) OR bitributação` na query Elasticsearch da jurisprudência do STF.
  - Otimização severa de rede no `StfProvider`: exclusão do campo pesado `inteiro_teor_texto` no `_source` durante a fase de busca, reduzindo o payload de rede de ~870 KB para ~15 KB.
  - Aplicação de penalidade de ruído tributário/penal (`-25 pts`) no `RelevanceScorer`, expurgando precedentes fiscais irrelevantes (como ADI 1945 sobre software de prateleira) do topo das buscas de contratações públicas.

## [1.4.1] - 2026-11-02

### Adicionado
- **Arquitetura Plug-and-Play no `JurisdictionProviderRegistry` (Marco 7.6):**
  - Desacoplamento integral do registro de conectores: eliminação de listas estáticas ou arrays hardcoded de cortes e UFs no núcleo do motor.
  - Metadados declarativos na interface `JurisdictionProvider` (`tier: "FEDERAL" | "STATE"`, `uf`, `defaultFederal`, `envOverrideKey`, `liveSmokeQuery`, `idPatterns`).
  - Autodescoberta dinâmica de UFs suportadas (`getSupportedUfs()`) e cortes federais de fallback (`getDefaultFederalProviders()`) a partir dos conectores registrados.
  - Preservação retrocompatível transparente de `SUPPORTED_UFS` e `UF_TO_COURT_MAP` via proxies dinâmicos em tempo de execução.
- **Seletor de Tribunal Isolado (`--court=<ID>`) em Live Tests:**
  - Suporte à flag `--court=<CORTE>` (ex.: `--court=STF`, `--court=TCE-PA`, `--court=TCE-CE`, `--court=TCDF`) em `scripts/run_live_tests.ts`.
  - Execução isolada em `tests_live/juris_api.live.ts` de sondas de contrato específicas (Busca Online + Download com Fatiamento Anatômico) para o tribunal selecionado, com validação de latência e teto MCP (< 900 bytes).

### Corrigido
- **Correção da Rota de Busca do STF (HTTP 404):**
  - Ajuste do endpoint de busca estruturada da API pública do STF para `POST /api/search/search`, resolvendo a divergência de URL que resultava em erro 404.
- **Sanitização de Queries e Eliminação de `[object Object]` em TCEs Estaduais:**
  - Desestruturação correta do retorno de `sanitizeQueryForCourt` nos provedores do `TCE-PA`, `TCE-CE` e `TCDF`, eliminando a serialização acidental de objetos em texto.
  - Limitação de tamanho de query para Joomla `com_search` no `TCE-PA` e suporte a busca por `parsedRef.numero` no `fetch` do `TCE-CE` e `TCDF`.
- **Resiliência do Cliente HTTP (`JurisHttpResponse`):**
  - Adição de propriedade e alias `body` apontando para o texto da resposta em `JurisHttpResponse`.
  - Tratamento tolerante para respostas de busca pública do TCDF suportando tanto `json.data.hits.hits` quanto `json.data.data.hits.hits`.

## [1.4.0] - 2026-11-01

### Adicionado
- **Motor Determinístico Sob Demanda de Pesquisa, Validação e Fatiamento Anatômico de Jurisprudência (Marco 7 / Geração 4):**
  - **Reengenharia Estrutural dos 6 Provedores de Jurisprudência (`src/tools/juris/providers/`):**
    - Isolamento estrito de 1 arquivo por tribunal: `tcu_provider.ts`, `stj_provider.ts`, `stf_provider.ts`, `tce_pa_provider.ts`, `tce_ce_provider.ts`, `tcdf_provider.ts`, com re-exports transparentes de retrocompatibilidade em `higher_courts_provider.ts` e `state_tces_provider.ts`.
    - Conexão operacional com endpoints públicos reais das cortes:
      - **TCU:** Consulta unificada nas rotas `/acordao-completo/documento` e `/jurisprudencia-selecionada/documento`, mapeamento de campos em caixa-alta (`NUMACORDAO`, `ANOACORDAO`, `RELATOR`, `ACORDAO`, `PROC`, `ENTIDADE`), suporte a resolução autônoma direta no `fetch_juris` (ex.: `"Acórdão 2403/2020-TCU-Plenário"`) e fallback de query simplificada.
      - **STF:** Busca estruturada Elasticsearch via `https://jurisprudencia.stf.jus.br/api/search/search` filtrada na base canônica `acordaos`.
      - **STJ:** Integração resiliente com o CKAN de Dados Abertos (`dadosabertos.web.stj.jus.br`), download focado de 1 recurso JSON mais recente (1ª Seção / matéria administrativa de contratos), cache em memória de sessão e timeout estrito de 6000ms sem bloqueio concorrente de outras cortes.
      - **TCE-CE:** Integração nativa com a API Contexto (`contexto-api.tce.ce.gov.br/documentos/buscar-jurisprudencia`) via filtros estruturados `query_string` e extração de acórdãos, relatores, ementas e dispositivos.
      - **TCDF:** Conexão com API Busca Pública (`api-busca-publica.tc.df.gov.br/jurisprudencia/`) com tolerância a certificados intermediários ausentes na cadeia TLS oficial.
      - **TCE-PA:** Comunicação via HTTP/1.1 legado (`insecureHTTPParser: true`) contornando buffers não-conformes de F5 BigIP (`https://www.tcepa.tc.br/index.php?option=com_search`), com parsing tolerante de HTML (`<dt class="result-title">` e `<dd class="result-text">`) e guarda estrita para tráfego local `http://` contra o Mock Server de testes.
    - **Telemetria Transparente e Diagnóstico de Conectores (`court_diagnostics`):**
      - Mapeamento determinístico de latência (`latency_ms`), status (`ok` ou `error`), contagem de precedentes recuperados e mensagens de erro por tribunal.
      - Persistência estruturada no arquivo canônico `state/juris_search_results.json` e tabela visual de diagnóstico em `state/juris_search_results.md`.
      - Preservação estrita do Teto Sintético MCP (< 900 bytes, Lei 2).
  - **9ª Ferramenta MCP `search_juris` e CLI `--search-juris`:** Busca multi-query sob demanda (`|`) em APIs oficiais de controle externo e cortes superiores (TCU, STJ, STF, TCE-PA, TCE-CE, TCDF), com suporte a pesquisa dentro de caso (`state/juris_search_results.json` e `.md`) ou isolada em `%TEMP%/docgov_ephemeral_inspect/` via Guardrail de Escopo. Retorno sintético MCP conciso estritamente $< 900$ bytes (Lei 2).
  - **Matriz de Equivalência Normativa (`Statutory Bridge` Lei 13.303/2016 + RILC $\leftrightarrow$ Lei 14.133/2021):** 10 eixos normativos canônicos (`SB-01` a `SB-10`) mapeando padronização de TI (Art. 47 vs Art. 41), lote único/indivisibilidade (Art. 32 vs Art. 40 + Súmula 247), qualificação técnica/atestados (Art. 58 vs Art. 67 + Súmulas 263/269), vigência quinquenal (Art. 71 vs Arts. 106/107), orçamento sigiloso (Art. 34 vs Art. 24), oportunidade de negócio (Art. 28 §3º II), catálogo padronizado (Art. 48 vs Art. 19 II), sobrepreço (Art. 31 vs Art. 23), sanções (Art. 83 vs Art. 156) e matriz de riscos (Art. 42 X vs Art. 22), com reconhecimento de empresas públicas de TI (`Serpro`, `Dataprev`, `BB Tecnologia`, etc.) e distinção das prerrogativas da Lei 13.303/16.
  - **Motor de Ranking de Relevância Determinístico (`0..100 pts`):** Ordenação ponderada em 5 dimensões: aderência léxica na ementa/tese (`0..35 pts`), alinhamento tático do dispositivo com postura `DEFENSE` ou `ATTACK` (`0..25 pts`), afinidade de regime legal (`0..20 pts`), peso de colegiado e quórum (`0..10 pts`) e contemporaneidade (`0..10 pts`).
  - **10ª Ferramenta MCP `fetch_juris` e CLI `--fetch-juris`:** Download e fatiamento anatômico de acórdãos com trava anti-alucinação estrita (`assertAuthenticAcordao` barrando precedentes inventados com `[ANTI_HALLUCINATION_BLOCK]`).
  - **Fatiador Anatômico em 6 Macro-Partes e 10 Sub-Camadas (`AnatomicalSlicer`):** Decomposição estrutural em Metadados (`1A`), Regime/Entidade (`1B`), Indexação (`2A`), Enunciado/Tese (`2B`), Controvérsia Fática (`3A`), Argumentos de Defesa (`3B`), Análise da Unidade Técnica AudTI/Sefti (`3C`), Ratio Decidendi/Distinguishing (`4A`), Dispositivo Operativo (`5A`) e Fecho com Quórum (`6A`). Dupla saída: Dossiê Fatiado por tópico no Estágio 2 (`state/dossie_juris_<shortname>.md`) e Inteiro Teor Estruturado no Estágio 3 (`inputs/juris_<shortname>/inteiro_teor_anatomico.md`).
  - **Roteador Jurisdicional Modular (`JurisdictionProviderRegistry`) & Graceful Fallback:** Conectores nativos para camada federal (`TCU`, `STJ`, `STF`) e estadual (`TCE-PA`, `TCE-CE`, `TCDF`). Tratamento gracioso com fallback automático para camada federal caso solicitada UF não implementada (ex.: `"AM"` ou `"PR"`), sem travar a execução.
  - **Compilador Tático OpenXML (Lockstep C# Assert 29.6):** Geração sob demanda de Nota de Contrarrazões Jurídicas (`compileDefenseCounterReasoningDocx`) e Peça de Impugnação/Representação (`compileAttackChallengeDocx`) em layout vertical A4 corporativo com zero tabelas `<w:tbl>` e cards com bordas laterais coloridas.
  - **Unificação de Variáveis de Ambiente para Mock Server (.NET Assert 29):** Suporte global à variável `DOCGOV_JURIS_BASE_URL` permitindo mock unificado de todos os 6 provedores, além das variáveis específicas por corte (`DOCGOV_TCU_BASE_URL`, `DOCGOV_STJ_BASE_URL`, etc.).
  - **Alinhamento de Contrato com Lockstep C#:** Exposição simultânea de `statutory_bridge_applied` e alias `normative_bridge` no JSON de busca, bem como `relevance_score` e alias `score` em cada item retornado.
  - **Caderno de Testes Online de Jurisprudência (`tests_live/juris_api.live.ts`):** 3 sondas online para APIs oficiais de tribunais, cobrindo busca textual, download de acórdão com fatiamento anatômico e degradação graciosa com UF não implementada.

### Corrigido
- **Hotfix no Handler MCP de `inspect_doc` e `build_docx_template` (`src/mcp/server.ts`):**
  - Correção na ordem dos argumentos na chamada a `formatInspectDocSyntheticResult`: o objeto de resultado da inspeção era passado no 1º argumento e o `outputPath` (muitas vezes omitido/undefined) no 3º argumento esperado para a inspeção, provocando a falha `undefined is not an object (evaluating 'r.tables')`.
  - Tipagem TypeScript estrita: introduzido o alias `InspectResult = DocxInspectionResult`, remoção de qualquer tipagem frouxa ou permissiva e assinatura `formatInspectDocSyntheticResult(filePath: string, outputPath: string | undefined, inspection: InspectResult)`.
  - Correção na chamada de `formatBuildDocxTemplateSyntheticResult(resolvedOutput, res)` no handler de `build_docx_template`, suprindo o argumento `outputPath` faltante.
  - Extração das funções `handleCallToolRequest` e `handleCallTool` em `src/mcp/server.ts` e inclusão de suíte de testes de regressão de dispatch MCP em `test/mcp_dispatch.test.ts`.

### Modificado
- **Modularização de CLI e Servidor MCP (Lei 9 de Governança):**
  - Extração de `src/mcp/tools_definition.ts` (303 linhas), reduzindo `src/mcp/server.ts` de 799 para 478 linhas.
  - Extração de `src/cli/connectors_cli.ts` (296 linhas), reduzindo `src/cli/index.ts` de 642 para 467 linhas.
  - 100% dos novos submódulos e arquivos em `src/` em estrita conformidade com o teto de 500 linhas.
- **Sincronização de SemVer e Self-Discovery (Lei 4):**
  - Atualização do número de versão para `1.4.0` em `package.json`, `src/constants/index.ts`, `src/mcp/spec.ts`, `docs/especificacao_motor.md`, `README.md` e `ROADMAP.md`.

### Adicionado
- **Caderno de Testes Online de Contrato de API (`Live API Smoke & Contract Suite` — `tests_live/`):**
  - Isolamento estrito em 3 camadas via `bunfig.toml` (`[test] root = "./test"`), runner próprio (`scripts/run_live_tests.ts`) e suíte `tests_live/*.live.ts`, garantindo que o `bun test` padrão permaneça 100% offline e determinístico.
  - **Sondas de Contrato da API Oficial do PNCP (`tests_live/pncp_api.live.ts`):** 6 sondas de rede reais cobrindo busca textual multi-query (`/api/search/`), filtros de UF e status, lookup direto de compra (`/api/consulta/v1/.../compras/...`), rota de anexos (`/api/pncp/v1/.../arquivos`), `fetchPncpContract` E2E com download binário real de editais/anexos governamentais e descompactação em pasta temporária, e validação de URLs web oficiais.
  - **Sondas de Contrato do GitHub Updater (`tests_live/github_updater.live.ts`):** 3 sondas cobrindo consulta à API de releases (`fetchLatestReleaseInfo`), checagem lógica de novas versões (`selfUpdate checkOnly`) e download/parsing do arquivo de checksums oficial `SHA256SUMS.txt`.
  - **Workflow de Monitoramento Agendado e Manual (`.github/workflows/live_api_smoke.yml`):** Disparo sob demanda (`workflow_dispatch`) e agendamento semanal automático (`schedule` toda segunda-feira às 09:00 BRT) com emissão de relatório executivo em Markdown via `$GITHUB_STEP_SUMMARY`.

## [1.3.11] - 2026-10-31

### Adicionado
- **Herança Nativa de `<w:numPr>` na Árvore de Numeração do Word (`ENG-16` / Regra Prioritária A):**
  - Quando o parágrafo-slot do template já pertence a uma lista multinível nativa do Word (`ilvl >= 1` registrado em `word/numbering.xml`), o motor herda diretamente o `<w:numId>` e ajusta o nível relativo `targetIlvl = Math.min(templateIlvl + deltaLevel, 8)`.
  - Limpeza automática de prefixos literais duplicados nos runs de texto (`<w:t>`), delegando a renderização visual da numeração à árvore nativa do Word sem duplicar números no documento final.
  - Subtítulos intermediários em negrito sem numeração são preservados como parágrafos limpos sem nós `<w:numPr>`, mantendo espaçamento vertical `<w:spacing w:after="120"/>`.
- **Scanner Pós-Compilação de Inconsistência de Seção e Cláusulas Duplicadas (`ENG-16`):**
  - Alerta `SECTION_PREFIX_MISMATCH`: Identifica parágrafos de cláusula cujo prefixo numérico divirja da seção pai ativa (ex.: `10.2.x` sob a Seção 5).
  - Alerta `DUPLICATE_CLAUSE_NUMBER`: Sinaliza cláusulas irmãs com numeração idêntica no mesmo nível hierárquico.

### Modificado
- **Isolamento de Estado do Resolvedor de Pré-Varredura e Contador Top-Down Monotônico (`ENG-16`):**
  - Separação mandatória entre `preScanResolver` (Passada 1 de mapeamento de títulos) e `numberingResolver` (Passada 2 de injeção), erradicando a contaminação de estado que causava anomalias como `10.2.2.` e `10.3.1.1.` na Seção 5.
  - Filtro estrito em `extractSectionHeadingPrefix`: apenas títulos reais com formatação/estilo de cabeçalho ou caixa alta atualizam o prefixo pai ativo, ignorando cláusulas ordinárias do corpo.
  - Escopo do contador monotônico `sectionChildCounters` isolado por parágrafo-slot no caminho de fallback literal (`ENG-14a/b`), impedindo herança indevida de contadores entre seções ou tabelas.
  - Refinamento em `UNCALCULATED_TOTAL_ROW`: suprime falsos-positivos quando itens possuem preço unitário de referência mas o valor total permanece zerado por se tratar de orçamento sigiloso aguardando formalização de propostas (RILC Art. 19).
- **Sincronização de SemVer e Self-Discovery (Lei 4):**
  - Atualização do número de versão para `1.3.11` em `package.json`, `src/constants/index.ts`, `src/mcp/spec.ts`, `docs/especificacao_motor.md` e 9 arquivos de teste.

### Adicionado
- **Consagração da Lei 9 de Engenharia no Estatuto (`AGENTS.md`):**
  - *Lei 9: Modularidade Estrita, Teto de 500 Linhas e Economia de Tokens:* Nenhum arquivo `.ts` em `src/` deve ultrapassar 500 linhas de código (margem preventiva de 450 linhas).
  - Instituição do protocolo de leitura e testes cirúrgicos para IA: inspeção com filtros direcionados de linhas (`read_file` com `StartLine`/`EndLine`) e execução restrita de testes do módulo em micro-commits (`bun test test/<feature>.test.ts`), reservando a suíte integral para o release final.
  - Atualização do Definition of Done (DoD item 9) garantindo verificação estrita de contagem física de linhas em todo commit.

### Modificado
- **Refatoração Estrutural Pura e Decomposição de Monólitos em Submódulos Coesos (Zero Alteração Funcional):**
  - **Submódulo `src/tools/openxml/` (decomposição de `fill_template.ts`):**
    - `src/tools/openxml/markdown_table_converter.ts` (391 linhas): Extração pura do parser de tabelas Markdown, construtor OpenXML `<w:tbl>` (`buildOpenXmlTableFromMarkdown`), substituidor de parágrafos irmãos e auto-redirecionamento geométrico de células de checkbox.
    - `src/tools/openxml/list_numbering_processor.ts` (475 linhas): Extração pura do detector e processador de listas multinível, formatador de propriedades OpenXML com *Hanging Indent* (`buildHangingIndentParagraphProperties`), propriedades nativas de numeração (`buildNativeNumberingParagraphProperties`), extrator de prefixo de seção pai (`extractSectionHeadingPrefix`), resolvedor de reancoragem (`reanchorMultilevelItem`) e pós-processamento de quebras de linha e texto rico.
    - `src/tools/fill_template.ts` (434 linhas $\le 500$ linhas): Mantido como orquestrador principal e ponto de entrada, re-exportando 100% dos símbolos públicos para garantir retrocompatibilidade absoluta sem quebrar testes legados ou consumidores externos.
  - **Submódulo `src/tools/inspect/` (decomposição de `inspect.ts`):**
    - `src/tools/inspect/integrity_scanner.ts` (434 linhas): Extração pura do scanner de integridade pós-compilação (`scanPostCompileIntegrityAlerts`) e dos 8 detectores especializados (`ENG-08`, `ENG-13`, `ENG-15`).
    - `src/tools/inspect/audit_view_formatter.ts` (434 linhas): Extração pura dos geradores de visão linear de auditoria para Markdown (`generateLinearAuditViewMarkdown`, `generatePdfLinearAuditViewMarkdown`, `generateTextLinearAuditViewMarkdown`), construção de `toc_map` e compactadores de resultado sintético.
    - `src/tools/inspect/document_pipelines.ts` (448 linhas): Extração pura de detecção de subtabelas e checkboxes em tabelas (`detectTableSubtablesAndCheckboxes`), helpers de classificação de arquivos (`isZipBuffer`, `isTextOrMarkdownFile`) e formatadores de retorno sintético.
    - `src/tools/inspect/non_docx_pipeline.ts` (357 linhas): Extração pura dos pipelines de inspeção estrutural de planilhas (`inspectSpreadsheetDocument`), documentos PDF (`inspectPdfDocument`) e arquivos de texto puro / Markdown (`inspectTextOrMarkdownDocument`).
    - `src/tools/inspect.ts` (434 linhas $\le 500$ linhas): Reduzido de 2.474 para 434 linhas, atuando como orquestrador central do AST OpenXML DOCX, fingerprinting e cache global, com re-export de todas as funções públicas.
- **Sincronização de SemVer e Self-Discovery (Lei 4):**
  - Atualização do número de versão para `1.3.10` em `package.json`, `src/constants/index.ts`, `src/mcp/spec.ts`, `docs/especificacao_motor.md` e 9 arquivos de teste.

## [1.3.9] - 2026-10-31

### Adicionado
- **Parent Section Prefix Resolver & Reancoragem Contextual Multinível (`ENG-14a`):**
  - Rastreamento dinâmico da seção ativa (`activeSectionPrefix`) no `<w:body>` resolvendo títulos estruturais literais (`2. JUSTIFICATIVA`, `4.4 CRITÉRIOS...`, `5.1 MODELO...`, `5.2 MATRIZ...`, `6. GESTÃO...`) e cabeçalhos nativos do Word via `numberingResolver` (`createNumberingResolver`).
  - Reancoragem automática de itens multinível relativos (`1.1.`, `1.2.`, `1.1.1.`) gerados pelo LLM para o prefixo da seção pai real: na Seção `4.4` $\rightarrow$ `4.4.1.`, `4.4.2.`; na Seção `5.1` $\rightarrow$ `5.1.1.`, `5.1.2.`; na Seção `5.2` $\rightarrow$ `5.2.1.`; na Seção `6` $\rightarrow$ `6.1.`, `6.2.`.
  - Mapeamento prévio de títulos fixos do template (`existingSectionPrefixes`) e prevenção determinística de colisão com subseções irmãs: na introdução da Seção 2, itens numerados que colidiriam com `2.1` fixo são convertidos automaticamente em Bullet estilizado (`• `) com negrito e hanging indent, eliminando duplicações na árvore do documento.
- **Injeção Literal Determinística sem `<w:numPr>` Órfão (`ENG-14b`):**
  - Separação limpa entre listas simples de 1 nível (`single_decimal`: `1.`, `2.`, `3.`) e listas multinível (`multi_decimal`).
  - Cláusulas multi-decimais (`X.Y.`, `X.Y.Z.`) utilizam injeção literal com número reancorado no primeiro run `<w:t>`, tabulação nativa `<w:r><w:tab/></w:r>`, recuo estático *Hanging Indent* (`<w:ind w:left w:hanging>` e `<w:tabs><w:tab w:val="left"/>`), espaçamento vertical pós-parágrafo `<w:spacing w:after="120"/>` e eliminação incondicional de nós `<w:numPr>`, erradicando o bug em que o Word reiniciava a numeração para `1.1` ou `1.1.1`.
- **Scanner Pós-Compilação de Anomalias de Numeração e SLA (`ENG-15`):**
  - Alerta `MULTILEVEL_NUMBERING_RESET`: Detecta parágrafos iniciando em `1.1.` ou `1.1.1.` sob seções de nível superior $\ge 2$ (ex.: Seção 2, 4, 5, 6), sinalizando desancoragem ou reset indesejado sem falsos-positivos na Seção 1 (`DO OBJETO`).
  - Alerta `DUPLICATE_CONFLICTING_SLA_TABLES`: Detecta tabelas distintas de SLA / Chamados no mesmo documento com prazos divergentes para Severidade 1 / Crítica (ex.: Tabela de Hardware do doador com 4 horas vs Tabela de Software com 1 hora), instruindo a harmonização de prazos ou remoção de linhas residuais via `remove_table_rows`.

## [1.3.8] - 2026-10-30

### Adicionado
- **Guardrail Canônico de Escopo DocGov com Isolamento Efêmero em `%TEMP%` (`ENG-10`):**
  - Implementação de `isValidDocGovCaseScope` e `assertDocGovCaseScope` em `src/utils/paths.ts` com bloqueio fail-fast estrito nas 6 ferramentas de processo (`bootstrap_case`, `build_docx_template`, `fill_docx_template`, `generate_audit_docx`, `generate_technical_note_docx` e `fetch_pncp`), com mensagem imperativa canônica caso invocadas fora de árvores de caso DocGov (`/cases/<slug>`).
  - Isolamento transparente de exploração e benchmark em `%TEMP%/docgov_ephemeral_inspect/` para `inspect_doc` e `search_pncp`, permitindo inspecionar arquivos avulsos e pesquisar editais sem violar diretórios do usuário.
  - Atualização dos prompts das 8 ferramentas MCP com a diretriz explícita `- Quando NÃO usar (Fora de Escopo): ...`.
- **Auto-Redirecionamento Geométrico em Colunas de Checkbox (`ENG-11`):**
  - Fase 1 (`inspect_doc` / `ENG-11a`): Detecção de pares `C_k` (checkbox curto `[☒☑☐◻□]|\bSim\b|\bNão\b`, `colSpan <= 2`) e `C_{k+1}` (célula ampla `colSpan >= 4`), anotando `[Checkbox Curto]` e apontando `suggested_target_slot = C_{k+1}` (`[Texto Discursivo / Especificar]`) no `toc_map.form_fields` e na visão linear.
  - Fase 2 (`build_docx_template` / `ENG-11b`): Auto-redirecionamento no template ao receber regra de substituição discursiva em `C_k`, marcando `☒ Sim.` em `C_k` e posicionando a `{{tag}}` em `C_{k+1}`.
  - Fase 3 (`fill_docx_template` / `ENG-11b`): Pós-processamento de segurança em tabelas transferindo textos longos ($> 45$ chars) acidentalmente injetados em células estreitas `C_k` para `C_{k+1}` e restaurando `☒ Sim.` em `C_k`.
- **Detector Pós-Compilação de Células Órfãs e Totais Zerados (`ENG-13`):**
  - Alerta `PARTIAL_ITEM_ROW_CONTAMINATION`: Detecta linhas de itens de software que retêm unidades físicas espúrias do doador de hardware (`servidores`, `GB`, `TB`, `Rack`).
  - Alerta `UNCALCULATED_TOTAL_ROW`: Detecta linhas de `TOTAL` ou `VALOR GLOBAL` preenchidas com `R$ 0,00` ou `[A DEFINIR]` enquanto os itens possuem valores definidos.
- **Heading Guard em `replace_paragraphs` (`ENG-12a`):**
  - Preservação determinística de títulos de seção quando `start_p` aponta para cabeçalhos (`Heading*`, `Titulo*` ou numerações de seção `1. OBJETO`) com `end_p > start_p`, mantendo `start_p` intacto e aplicando o slot em `start_p + 1`.
- **Saneamento de `<w:numPr>`, Espaçamento e Sequenciamento de Listas (`ENG-12b` e `ENG-12c`):**
  - Descarte de linhas vazias na expansão multilinha prevenindo parágrafos vazios numerados (`2.`, `4.`).
  - Remoção de `<w:numPr>` e estilos de título herdados de parágrafos comuns de texto discursivo.
  - Aplicação de espaçamento vertical nativo `<w:spacing w:after="120"/>` (6pt) em todos os parágrafos gerados na expansão.
  - Sequenciamento contínuo de listas decimais simples consecutivas (`1.` -> `2.` -> `3.`) compartilhando o mesmo `numId` no Word sem repetições.

## [1.3.7] - 2026-10-27

### Adicionado
- **Conversor Nativo de Tabelas Markdown para OpenXML `<w:tbl>` (`ENG-06`):**
  - Detecção automática em `fill_docx_template` de blocos de tabelas em sintaxe Markdown (`| Col1 | Col2 |\n| :--- | :--- |\n| val1 | val2 |`), tanto dentro de valores multilinha (`\n`) injetados em parágrafos ou células quanto em sequências de parágrafos `<w:p>` irmãos consecutivos.
  - Conversão determinística para elementos OpenXML `<w:tbl>` reais, com `<w:tblPr>` (`w:tblW w:type="pct" w:w="5000"`), bordas corporativas suaves (`CBD5E1`), `<w:tblGrid>` calculado proporcionalmente à largura das colunas, cabeçalho `<w:tblHeader/>` sombreado (`F1F5F9`) em negrito, alinhamentos por coluna (`:---` left, `:---:` center, `---:` right), negrito seletivo (`**...**`) dentro das células e conformidade estrita com a regra ECMA-376 garantindo `<w:p/>` final quando a tabela é injetada dentro de uma célula `<w:tc>`.
- **Operador Direto `remove_table_rows` e Detector de Subtabelas e Checkboxes (`ENG-07`):**
  - Novo operador declarativo `"remove_table_rows": [{ "table_index": 0, "from_row": 27, "to_row": 44 }]` no `slots_manifest.json` (`build_docx_template`), executado em ordem Bottom-Up logo após `replace_table_cells`.
  - Proteção automática de mesclagens verticais (`<w:vMerge/>`): preserva células `restart` ou promove automaticamente a próxima linha sobrevivente (`continue` $\rightarrow$ `restart` com transferência do rótulo textual) caso a linha inicial do bloco mesclado esteja na faixa removida.
  - Detector automático `detectTableSubtablesAndCheckboxes` em `inspect_doc`, expondo `detected_subtables` e `detected_checkboxes` no JSON estrutural e renderizando a seção `### Subtabelas de Itens e Checkboxes Detectados` no Bloco 1 da `visao_auditoria_*.md` com instruções de poda limpa e coordenadas físicas exatas de cada opção `☒`/`☐`.
- **Scanner Pós-Compilação Anti-Contaminação de Doador (`ENG-08`):**
  - Scanner determinístico `scanPostCompileIntegrityAlerts` integrado ao `inspect_doc` (e à auto-inspeção do `fill_docx_template`), estampando o bloco de destaque `## ⚠️ ALERTAS DE INTEGRIDADE PÓS-COMPILAÇÃO (AÇÃO OBRIGATÓRIA DO AUDITOR)` no topo do Bloco 1 da `visao_auditoria_*.md` quando detectadas anomalias:
    1. `UNREMOVED_ITEM_WORKAROUND`: linhas preenchidas com `"Item não aplicável"` em vez de exclusão física via `remove_table_rows`;
    2. `RAW_MARKDOWN_TABLE`: separadores de tabela Markdown (`| :--- |`) não convertidos;
    3. `CONTRADICTORY_CHECKBOXES`: opções `☒ Sim` e `☒ Não` marcadas simultaneamente para a mesma pergunta (ou ambas desmarcadas `☐` em documento compilado);
    4. `HARDWARE_DONOR_CONTAMINATION`: heurística de duas pontas que detecta vazamento de vocabulário físico de hardware (`RoHS`, `mercúrio`, `chumbo`, `cádmio`, `Portaria nº 170`, `INMETRO`, `ANATEL`, `NVMe`, `DDR4`, `DDR5`, `SFP+`, `escassez global de chips`, `Next Business Day`, `Nvidia RTX`) em contratações cujo Objeto principal é exclusivamente Software/Serviços, ou vazamento de artefatos/atas doadoras (`ARP 90015/2024`, `R$ 68.776.988,00`, `PAN-OS`/`Collector` em documento Red Hat) e contradições internas diretas, evitando falsos-positivos em contratações mistas legítimas de Hardware+Software.
- **Normalização Universal Unicode `NFC` e Lookup Resiliente `NFC/NFD` (`ENG-09`):**
  - Aplicação sistemática de `.normalize("NFC")` na extração de pacotes (`.zip`, `.tar.gz`), sanitização e resolução de nomes (`sanitizeArchiveEntryName`, `sanitizeFileName`, `resolveTargetFileName`), ingestão em `inputs/` no `bootstrap_case` e geração de artefatos em `state/` (`estrutura_*.json`, `visao_auditoria_*.md`).
  - Função `resolveExistingPathNfc` integrada a `resolveWorkspacePath` e `inspectDocx` para localizar arquivos no disco mesmo quando há divergência entre `NFD` (macOS APFS/HFS+) e `NFC` (Windows/Linux).

## [1.3.6] - 2026-10-27

### Corrigido
- **Fim da Fusão Horizontal de Colunas em `loop_table_rows` (`ENG-01`):**
  - Isolamento estrito de loops iterativos de tabela: as tags delimitadoras `{{FOR item IN ...}}` e `{{END-FOR item}}` são agora injetadas em elementos `<w:tr>` dedicados em volta da `template_row_index` em vez de cruzar o cabeçalho (`header_row_index`) ou ocupar células da mesma linha.
  - Elimina a mutação indevida que duplicava a contagem de colunas de 19 para 38 células físicas.
  - Preserva intactas as propriedades OpenXML de células verticais mescladas (`<w:vMerge w:val="continue"/>`) na primeira célula (`C0`).
- **Alinhamento de Coordenadas Físicas vs. Virtuais (`<w:tc>` vs `gridSpan` — `ENG-02`):**
  - Identificação e exposição de `physicalCellIndex` e `virtualColIndex` em `TableCellInfo`, garantindo que referências em `toc_map.form_fields` apontem para a célula física real do OpenXML pronta para copiar e colar em `slots_manifest.json`.
  - Fallback automático e transparente em `replace_table_cells` (`resolvePhysicalTableCell`), mapeando índices virtuais de colunas afetadas por `gridSpan` para a célula física correta caso o usuário forneça a coordenada visual da tabela.
  - Fail-Fast Estrito com Exact Copy-Paste Error (`ENG-02c`): rejeição imediata se `cell_tags.length` exceder o total de células físicas da linha em `loop_table_rows`, com auto-alinhamento inteligente se `C0` for uma célula mesclada com `vMerge`.
- **Normalização de `vMerge` e `gridSpan` no Cálculo de Fingerprint Estrutural (`ENG-03`):**
  - `computeStructureFingerprint` desconsidera células de continuação vertical (`rowSpan: "continue"`) e placeholders de mesclagem horizontal (`isSpanPlaceholder`), evitando inflação artificial da contagem de colunas e deduplicando campos de formulário idênticos (`seenLabels`).
  - `computeStructuralSimilarity` opera sobre conjuntos únicos de rótulos e tolera variações de colunas decorrentes de `gridSpan` quando os cabeçalhos de tabela possuem alta similaridade ($\ge 0.5$).
  - `findBestTemplateMatch` retorna o candidato de maior similaridade mesmo em status `NEW` (`< 75%`), permitindo ao usuário e agente identificar no Gate 1 o quão próximo está o template existente mais relevante.
- **Exposição de `template_match` e `form_fields` Físicos na Visão Linear de Auditoria (`ENG-04`):**
  - Inclusão no Bloco 1 da `visao_auditoria_*.md` do status de compatibilidade com o cache global (`template_match`) e da tabela detalhada de `Campos de Formulário Mapeados (toc_map.form_fields)` com a Coordenada Física de Alvo pronta para uso.
- **Ordem Bottom-Up Estrita na Construção de Templates (`ENG-05`):**
  - Execução preliminar de `replace_table_cells` antes de qualquer manipulação de linhas, seguida de substituições e loops em ordem decrescente de índice (`descending`), evitando deslocamentos espúrios de coordenadas.

### Adicionado
- **Busca Textual Multi-Query no PNCP (`search_pncp` — 8ª Ferramenta MCP e CLI `--search-pncp`):**
  - Descoberta automatizada e de alta velocidade de contratações de referência na API oficial pública `/api/search/` do Portal Nacional de Contratações Públicas.
  - **Suporte Multi-Query em Paralelo:** Permite fornecer termos combinados separados por pipe `|` (ex.: `"fábrica de software | sustentação de sistemas"`), executando as consultas em paralelo via `Promise.all` com desduplicação automática pelo trio canônico `CNPJ/ANO/SEQUENCIAL`.
  - **Filtros Estruturados:** Suporte opcional a parâmetros `status` (`"todas" | "recebendo_proposta" | "encerradas"`), `uf` (sigla estadual) e `modalidade` (ex.: `"Pregão"`, `"Concorrência"`).
  - **Acumulação Inteligente no Caso:** Preserva e mescla candidatos de buscas sucessivas no arquivo `cases/<slug>/state/pncp_search_results.json` mantendo os mais recentes no topo.
  - **Painel Executivo Markdown com Objeto Integral:** Gravação de `state/pncp_search_results.md` com tabela consolidada exibindo ID PNCP, Órgão, Modalidade, Valor Estimado, Data e o **Objeto Completo** (sem truncamento) para que o agente ou auditor selecione contratações compatíveis com segurança.
  - **Padrão Exact Copy-Paste Error (Lei 3):** Validação fail-fast precoce para parâmetros de busca vazios com snippet pronto para copiar e colar (`createPncpSearchContractError`).
  - **Teto Estrito de Payload MCP com Poda Progressiva (< 900 bytes — Lei 2):** Resposta sintética otimizada contendo contadores, caminhos e até 3 top candidatos, aplicando poda preventiva automática em caso de caminhos extensos para assegurar que a resposta permaneça estritamente abaixo de 880 bytes.
- **Resolvedor Nativo de Redirects HTTP (`resolvePncpRedirectUrl`):**
  - Resolução automática e transparente de URLs de redirecionamento opacas do Google Grounding (`https://vertexaisearch.cloud.google.com/grounding-api-redirect/...`) e encurtadores em `fetch_pncp` e `search_pncp`.
  - Mecanismo baseado em `redirect: "manual"` com inspeção do cabeçalho `Location` que retorna imediatamente a URL canônica do PNCP sem a necessidade de abrir conexões de rede externas adicionais, viabilizando testes 100% determinísticos e offline.

## [1.3.4] - 2026-10-26

### Adicionado
- **Conector Nativo PNCP (`fetch_pncp` — 7ª Ferramenta MCP e CLI `--fetch-pncp`):**
  - Ingestão determinística e sem consumo de tokens de metadados e todos os arquivos públicos de contratações de referência no Portal Nacional de Contratações Públicas (PNCP) para benchmarking técnico e pesquisa de mercado (IN SEGES/ME nº 65/2021).
  - **Parsing Universal de Identificadores (`parsePncpIdentifier`):** Suporte automático e tolerante aos 3 formatos padrão utilizados no Brasil:
    1. Número de controle em editais (ex.: `00394460000141-1-000015/2026`);
    2. URLs web do portal ou endpoints REST da API (`/app/editais/`, `/app/compras/`, `/api/pncp/v1/`, `/api/consulta/v1/`);
    3. Tupla simplificada `CNPJ/ANO/SEQUENCIAL` (ex.: `00394460000141/2026/15`).
  - **Isolamento Físico Estrito (`cases/<slug>/inputs/pncp_<shortname>/`):** Todos os documentos e anexos externos baixados residem exclusivamente dentro de uma subpasta dedicada, garantindo isolamento total e impedindo contaminação com minutas do caso sob auditoria.
  - **Descompactação Automática Integrada (`libmagic msooxml`):** Pacotes `.zip`, `.tar`, `.tar.gz` ou `.tgz` baixados são descompactados in-place com defesa Anti-Zip Slip, achatamento seguro de subpastas e descarte de arquivos espúrios (`__MACOSX`, `.DS_Store`).
  - **Catalogação Estrutural Leve de Benchmarking:** Extração de tópicos e seções em memória sem poluição de arquivos de auditoria em `state/` (sem `visao_auditoria_`, sem `dossie_hotspots_` e sem Radar das 14 Zonas), gerando exclusivamente o catálogo executivo `state/indice_pncp_<shortname>.md` e o manifesto de metadados `state/pncp_<shortname>_meta.json`.
  - **Padrão Exact Copy-Paste Error (Lei 3):** Validação fail-fast de identificadores PNCP com snippet pronto para copiar e colar em caso de formato inválido.
  - **Teto Estrito de Payload MCP (< 900 bytes — Lei 2):** Resposta sintética concisa informando contadores de arquivos baixados, descompactados e inspecionados com referências aos caminhos gerados.
  - **Flag `skipAuditArtifacts` em `inspectDocx`:** Permite inspeção de arquivos sob demanda sem gerar relatórios de auditoria em disco.

## [1.3.3] - 2026-10-26

### Adicionado
- **Classificador Estrutural de Formatos inspirado no padrão Linux `file(1)` / `libmagic` (`src/utils/archives.ts`):**
  - Implementada heurística canônica alinhada à regra `msooxml` do Linux `file`: em arquivos com magic bytes `PK\x03\x04`, inspeciona os nomes das entradas nos cabeçalhos locais para diferenciar deterministamente contêineres do Microsoft Office (`word/document.xml` -> `.docx`, `xl/workbook.xml` -> `.xlsx`, `ppt/presentation.xml` -> `.pptx`, `mimetype` ODF -> `.odt`/`.ods`) de arquivos compactados comuns (`zip`).
  - Suporte completo a formatos compactados padrão POSIX TAR (`.tar`) via detecção do magic `ustar` no offset 257 e validação do checksum octal de cabeçalho de 512 bytes.
  - Suporte a GZIP (`.tar.gz` / `.tgz`) via magic `\x1f\x8b` com descompressão segura via `node:zlib` e inspeção do fluxo TAR interno.
  - Detecção precoce e amigável de arquivos compactados proprietários (`.7z`, `.rar`).
- **Descompactação Automática e Ingestão Transparente em `bootstrap_case` (`src/tools/bootstrap.ts`):**
  - Descompactação automática de pacotes compactados (`.zip`, `.tar`, `.tar.gz`, `.tgz`) fornecidos em `uploadsDir`, soltos na raiz de `caseDir` ou adicionados diretamente em `inputs/`, permitindo o envio de lote consolidado em uma única operação.
  - **Defesa Anti-Zip Slip e Achatamento de Subpastas:** Sanitização rigorosa via `sanitizeArchiveEntryName` barrando sequências de escape (`../`) e achatando a hierarquia interna (ex.: `anexos/edital/tr.docx` -> `anexos_edital_tr.docx`), preservando o contexto das pastas originais.
  - **Filtragem de Metadados e Lixo de Sistema:** Descarte automático e silencioso de arquivos de sistema (`__MACOSX`, `.DS_Store`, `._*`, `Thumbs.db`, `desktop.ini`, `~$*`).
  - **Guardrail de Prevenção contra Zip Bomb:** Limites de segurança integrados bloqueando pacotes com mais de 500 arquivos ou extração superior a 500 MB descompactados.
  - **Relatório no Índice Mestre (`state/indice_mestre_caso.md`):** Tabela executiva documentando cada pacote descompactado, formato original, contagem de arquivos e nomes gravados em `inputs/`.
  - **Metadados MCP Sintéticos (< 900 bytes — Lei 2):** Inclusão de `unpacked_archives_count` e `extracted_files_count` na resposta JSON mantendo o tamanho estritamente abaixo do teto.
- **Guardrail Instrutivo em `inspect_doc` para Pacotes Compactados (`src/tools/inspect.ts`):**
  - Rejeição fail-fast precoce caso um arquivo `.zip`, `.tar` ou `.tar.gz` seja fornecido a `inspect_doc`, emitindo instrução orientando que a ferramenta opera exclusivamente em documentos individuais e direcionando o agente a utilizar `bootstrap_case`.

## [1.3.2] - 2026-10-25

### Corrigido
- **Guardrail de Segurança Ativa e Anti-Sequestro de Governança no `bootstrap_case` (`src/tools/bootstrap.ts`):**
  - Implementado guardrail de segurança com erro fail-fast imperativo caso `caseDir` aponte acidentalmente para a raiz de um repositório de desenvolvimento (detectado pela presença de `.git`, `core/skills` ou `src/index.ts` + `package.json`), bloqueando imediatamente a execução espúria e orientando a especificar uma subpasta (`cases/<slug>`).
  - Expansão estrita de `PROTECTED_ROOT_FILES` contemplando arquivos de governança (`AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `ROADMAP.md`, `LICENSE`, `CONTRIBUTING.md`), manifestos e locks (`package.json`, `tsconfig.json`, `bun.lockb`, `package-lock.json`, etc.), arquivos de ambiente e metadados de caso.
  - Filtro incondicional descartando qualquer extensão de código-fonte ou script (`.ts`, `.js`, `.mjs`, `.cjs`, `.sh`, `.ps1`, `.bat`, `.cmd`, `.py`, `.cs`, etc.), garantindo que arquivos do projeto nunca sejam tratados como minutas ou movidos para `inputs/`.
- **Preservação de `process.cwd()` para Caminhos Locais em `resolveWorkspacePath` (`src/utils/paths.ts` — Lei 6):**
  - Ajuste na resolução de `.` e `./` para apontar estritamente para `process.cwd()` quando executado em diretórios de trabalho legítimos (fora de pastas de instalação de IDEs como `AppData/Local/Programs/antigravity`).
  - Resolução de caminhos relativos locais sem prefixo `cases/` (ex.: `./uploads`, `inputs/minuta.docx`) diretamente contra `process.cwd()`, impedindo o desvio indevido para a raiz do repositório pai.
- **Otimização do Teto de Payload MCP em `inspect_doc` (< 900 bytes — Lei 2):**
  - Eliminação da duplicação concorrente de `docxPath` e `filePath` (~134 caracteres cada) quando o payload sintético se aproxima do teto seguro (< 900 bytes), resolvendo o estouro observado de 1090 bytes.
  - Relativização protetiva de caminhos absolutos longos via `toShortDocPath`, descarte seletivo de `dossie_path` e encurtamento progressivo de `next_step_hint`, mantendo o payload consistentemente entre 750B e 875B mesmo em casos corporativos com caminhos profundos e `template_match` completo.

### Adicionado
- **Orquestrador Consolidado de Build, Checksums e Self-Discovery (`scripts/build_all.ts`):**
  - Implementado o comando unificado `bun run build:all` (com atalho `bun run build`) que compila os binários Linux e Windows, normaliza nomes canônicos de release de forma cross-platform via `node:fs` (`docgov-engine-linux-x64` e `docgov-engine-win-x64.exe`), recalcula `bin/SHA256SUMS.txt` e sincroniza a especificação Markdown `docs/especificacao_motor.md` (`--dump-spec`) em uma única execução rápida (~8 segundos).
  - Adicionado atalho rápido `bun run dump:spec` para sincronização direta do documento de especificação técnica.

### Alterado
- **Blindagem Normativa da Lei 7 & Autodescoberta de Pipelines Externos (`AGENTS.md`):**
  - Reformulação da Lei 7 consagrando o princípio agnóstico de autodescoberta de pipelines de CI/CD (GitHub Actions, GitLab CI ou similares), estabelecendo o push de tag Git como gatilho canônico exclusivo de release.
  - Proibição terminante de uploads manuais locais de binários (`gh release create`), eliminando concorrência com a esteira externa, garantindo compilação em runners remotos limpos e dispensando solicitações de bypass de sandbox.
  - Inclusão de teste automatizado de conformidade de governança em `test/distribution.test.ts`.

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
