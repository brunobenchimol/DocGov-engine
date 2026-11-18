# Arquitetura e Índice de Módulos — docgov-engine (v1.6.4)

Este documento é o **Mapa Canônico de Navegação para Agentes IA e Desenvolvedores**. Consulte-o antes de buscar arquivos no repositório para localizar exatamente os módulos de implementação (`src/`), scripts (`scripts/`) e suítes de validação (`test/`, `tests_live/`) de cada domínio.

> **Memória Evolutiva Executiva:** Para uma radiografia cumulativa concisa de todas as capacidades e ferramentas já consolidadas por geração (`Geração 1` a `Geração 6.5`), consulte [`docs/CAPABILITIES_EVOLUTION_HISTORY.md`](CAPABILITIES_EVOLUTION_HISTORY.md).

---

## 1. Pontos de Entrada, CLI, MCP & Contratos Base

| Camada | Arquivo | Responsabilidade Principal |
| :--- | :--- | :--- |
| Barrel / Entry | `src/index.ts` | Ponto de entrada único (MCP stdio por padrão ou CLI por flags) e barrel de exportações públicas. |
| Constantes & Guias | `src/constants/index.ts` | `VERSION`, `DOCX_ENGINE_INSTRUCTIONS` e `DOCX_WORKFLOW_GUIDE_TEXT`. |
| Tipagem Global | `src/types/index.ts` | Interfaces compartilhadas (`SlotsManifest`, `InspectionResult`, `PdfExtractionResult`, `DocumentForensicMeta`, etc.). |
| CLI Core | `src/cli/index.ts` | Parser principal da CLI (`--help`, `--version`, documentos, template, diff). |
| CLI Conectores | `src/cli/connectors_cli.ts` | Subcomandos `--search-pncp`, `--fetch-pncp`, `--search-juris`, `--fetch-juris`, `--dump-spec` e `--update`. |
| CLI Gen5 / Gen6 | `src/cli/contracts_cli.ts` | Subcomandos `audit-contract`, `govern-arp`, `evaluate-proposals` e `audit-direct-contracting`. |
| MCP Server | `src/mcp/server.ts` | Servidor JSON-RPC 2.0 sobre `stdio` (`initialize`, `tools/list`, `tools/call`, `prompts/*`). |
| MCP Schemas | `src/mcp/tools_definition.ts` | Definição JSON Schema e metadados das **14 ferramentas MCP nativas**. |
| MCP Dispatcher | `src/mcp/tool_dispatchers.ts` | Roteamento tipado de chamadas MCP para os motores de domínio. |
| Self-Discovery Spec | `src/mcp/spec.ts` | Gerador `generateEngineSpecMarkdown()` que alimenta `--dump-spec` e `docs/especificacao_motor.md`. |

---

## 2. Matriz Completa: Ferramentas MCP (#1 a #14) -> CLI -> Código (`src/`) -> Testes (`test/` / `tests_live/`)

| # | Ferramenta MCP | Comando CLI Equivalente | Módulos `src/` Responsáveis | Suítes de Teste Correspondentes |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `bootstrap_case` | `--bootstrap-case` | `src/tools/bootstrap.ts`, `src/utils/archives.ts`, `src/utils/naming.ts`, `src/utils/pdf/forensic_cross_audit.ts` | `test/bootstrap.test.ts`, `test/bootstrap_archives.test.ts`, `test/bootstrap_guardrails.test.ts`, `test/workspace_paths.test.ts`, `test/pdf_unpdf_v2_multimodal_forensics.test.ts` |
| 2 | `inspect_doc` | `--inspect`, `--diff` | `src/tools/inspect.ts`, `src/tools/inspect/document_pipelines.ts`, `src/tools/inspect/non_docx_pipeline.ts`, `src/tools/inspect/audit_view_formatter.ts`, `src/tools/inspect/integrity_scanner.ts`, `src/core/cartography.ts`, `src/core/budget_auditor.ts`, `src/core/structural_diff.ts`, `src/parsers/spreadsheet.ts` | `test/inspect.test.ts`, `test/inspect_text_md.test.ts`, `test/inspect_payload_ceiling.test.ts`, `test/engine_pdf_cartography.test.ts`, `test/engine_pdf_spatial.test.ts`, `test/budget_auditor.test.ts`, `test/spreadsheet.test.ts`, `test/structural_diff.test.ts`, `test/semantic_diff.test.ts`, `test/checkbox_redirect_orphans.test.ts`, `test/numbering_anomaly_scanners.test.ts`, `test/pdf_unpdf_v2_multimodal_forensics.test.ts` |
| 3 | `build_docx_template` | `--build-template` | `src/tools/build_template.ts`, `src/core/manifest.ts`, `src/core/registry.ts` | `test/build_template_contracts.test.ts`, `test/build_template_tables.test.ts`, `test/registry.test.ts`, `test/registry_matching.test.ts`, `test/tables_fusion.test.ts` |
| 4 | `fill_docx_template` | `--inject` | `src/tools/fill_template.ts`, `src/tools/openxml/list_numbering_processor.ts`, `src/tools/openxml/markdown_table_converter.ts`, `src/utils/pdf_exporter.ts` | `test/fill_template_injection.test.ts`, `test/fill_template_multilevel.test.ts`, `test/heading_guard_numbering.test.ts`, `test/numbering_reanchoring.test.ts`, `test/pdf_exporter.test.ts`, `test/xml_sanitizer.test.ts`, `test/blackbox_compliance_v096.test.ts` |
| 5 | `generate_audit_docx` | `--generate-audit-docx` | `src/tools/audit.ts`, `src/utils/pdf_exporter.ts`, `src/utils/xml.ts` | `test/audit.test.ts`, `test/audit_matrix_checklist.test.ts`, `test/engine_mcp_ceiling.test.ts` |
| 6 | `generate_technical_note_docx` | `--diff-report`, `--generate-technical-note` | `src/tools/technical_note.ts`, `src/core/structural_diff.ts`, `src/utils/pdf_exporter.ts` | `test/technical_note.test.ts`, `test/technical_note_contract.test.ts`, `test/mcp_technical_note.test.ts`, `test/diff_report_cli.test.ts` |
| 7 | `fetch_pncp` | `--fetch-pncp` | `src/tools/pncp.ts`, `src/utils/archives.ts` | `test/pncp_fetch.test.ts`, `test/archives.test.ts`, `tests_live/pncp_api.live.ts` |
| 8 | `search_pncp` | `--search-pncp` | `src/tools/pncp.ts` | `test/pncp_search.test.ts`, `tests_live/pncp_api.live.ts` |
| 9 | `search_juris` | `--search-juris` | `src/tools/juris/search_juris.ts`, `src/tools/juris/provider_registry.ts`, `src/tools/juris/statutory_bridge.ts`, `src/tools/juris/relevance_scorer.ts`, `src/tools/juris/tactical_compiler.ts`, `src/tools/juris/types.ts`, `src/tools/juris/index.ts` | `test/juris/core_and_scorer.test.ts`, `test/juris/routing_and_tools.test.ts`, `test/juris/federal_courts.test.ts`, `test/juris/state_courts.test.ts`, `tests_live/juris_api.live.ts` |
| 10 | `fetch_juris` | `--fetch-juris` | `src/tools/juris/fetch_juris.ts`, `src/tools/juris/anatomical_slicer.ts`, `src/tools/juris/provider_registry.ts`, `src/tools/juris/providers/http_client.ts` | `test/juris/anatomical_slicer.test.ts`, `test/juris/routing_and_tools.test.ts`, `test/juris/federal_courts.test.ts`, `test/juris/state_courts.test.ts`, `tests_live/juris_api.live.ts` |
| 11 | `docgov_audit_contract_execution` | `audit-contract`, `--audit-contract` | `src/contracts/audit_contract_execution.ts`, `src/contracts/addendum_auditor.ts`, `src/contracts/tripartite_matcher.ts`, `src/contracts/readjustment_auditor.ts`, `src/contracts/pas_sanction_auditor.ts`, `src/contracts/pas_federative_dosimetry.ts`, `src/contracts/pas_federative_types.ts`, `src/contracts/price_basket_auditor.ts`, `src/contracts/contract_compiler.ts`, `src/contracts/contract_humanizer.ts`, `src/contracts/errors.ts`, `src/contracts/types.ts` | `test/contracts/addendum_limits.test.ts`, `test/contracts/tripartite_and_readjustment.test.ts`, `test/contracts/gen5_5_pas_and_basket.test.ts`, `test/contracts/pas_federative_v156.test.ts`, `test/contracts_arp_mcp_cli.test.ts` |
| 12 | `docgov_govern_arp` | `govern-arp`, `--govern-arp` | `src/arp/govern_arp.ts`, `src/arp/ledger_engine.ts`, `src/arp/compatibility_matrix.ts`, `src/arp/arp_compiler.ts`, `src/arp/types.ts` | `test/arp/arp_ledger_limits.test.ts`, `test/arp/arp_matrix_and_compiler.test.ts`, `test/contracts_arp_mcp_cli.test.ts` |
| 13 | `docgov_evaluate_bidding_proposals` | `evaluate-proposals`, `--evaluate-proposals` | `src/bidding/index.ts`, `src/bidding/evaluate_bidding_proposals.ts`, `src/bidding/ict_execution_models.ts`, `src/bidding/inexequibility_evaluator.ts`, `src/bidding/qualification_evaluator.ts`, `src/bidding/act_forensic_auditor.ts`, `src/bidding/forensic_collusion_auditor.ts`, `src/bidding/appeals_evaluator.ts`, `src/bidding/bidding_docx_compiler.ts`, `src/bidding/bidding_legal_humanizer.ts`, `src/bidding/bidding_opinion_sections.ts`, `src/bidding/act_diligence_letter_sections.ts`, `src/bidding/appeals_docx_sections.ts`, `src/bidding/bidding_xml_primitives.ts`, `src/bidding/types.ts` | `test/bidding_gen6.test.ts`, `test/bidding_inexeq_appeals_v164.test.ts` |
| 14 | `docgov_audit_direct_contracting` | `audit-direct-contracting`, `--audit-direct-contracting` | `src/direct_contracting/index.ts`, `src/direct_contracting/audit_direct_contracting.ts`, `src/direct_contracting/direct_contracting_auditor.ts`, `src/direct_contracting/direct_contracting_compiler.ts`, `src/direct_contracting/direct_contracting_sections.ts`, `src/direct_contracting/types.ts` | `test/direct_contracting_gen6.test.ts` |

### Conectores Jurisdicionais (`src/tools/juris/providers/`)
- **Camada Federal:** `src/tools/juris/providers/tcu_provider.ts`, `src/tools/juris/providers/stj_provider.ts`, `src/tools/juris/providers/stf_provider.ts`, `src/tools/juris/providers/tst_provider.ts`, `src/tools/juris/providers/agu_provider.ts`, `src/tools/juris/providers/agu_catalog.ts`.
- **Camada Estadual / Distrital:** `src/tools/juris/providers/tce_pa_provider.ts`, `src/tools/juris/providers/tce_ce_provider.ts`, `src/tools/juris/providers/tcdf_provider.ts`, `src/tools/juris/providers/tce_sp_provider.ts`, `src/tools/juris/providers/tce_sp_catalog.ts`, `src/tools/juris/providers/tce_mg_provider.ts`, `src/tools/juris/providers/tce_mg_catalog.ts`, `src/tools/juris/providers/tce_pr_provider.ts`, `src/tools/juris/providers/tce_pr_catalog.ts`.

---

## 3. Infraestrutura Transversal, Utilitários & Scripts

- **Pipeline PDF `unpdf@2.1+`, Ponte Multimodal `assets/` & Perícia Forense Dual:**
  - `src/utils/pdf.ts` (reconstrução espacial `[PAG_XXX | LYYYY]`, fallback e orquestração), `src/utils/pdf/stream_fallback.ts`, `src/utils/pdf/page_inspector.ts` (5 classes de página via `inspectPages`), `src/utils/pdf/image_extractor.ts` (`extractImages` + filtro anti-brasão SHA-256), `src/utils/pdf/forensic_meta.ts`, `src/utils/pdf/docx_forensic_meta.ts`, `src/utils/pdf/forensic_cross_audit.ts` (materialização em `assets/` e cruzamento anti-conluio).
  - Validação: `test/ocr.test.ts`, `test/pdf_unpdf_v2_multimodal_forensics.test.ts`.
- **Utilitários, Core & Auto-Atualização:**
  - `src/core/ocr.ts`, `src/core/updater.ts`, `src/utils/json.ts`, `src/utils/paths.ts`, `src/utils/xml.ts`, `src/utils/pdf_exporter.ts`.
  - Testes transversais: `test/utils.test.ts`, `test/updater.test.ts`, `test/engine_resilience.test.ts`, `test/scope_guardrail.test.ts`, `test/mcp_dispatch.test.ts`, `test/mcp_spec.test.ts`, `test/version.test.ts`, `test/distribution.test.ts`.
  - Live Test do Updater: `tests_live/github_updater.live.ts`.
- **Scripts de Build, Auditoria & Distribuição (`scripts/`):**
  - `scripts/check_lines.ts`: auditoria física da Lei 9 (`<= 500` linhas).
  - `scripts/build_all.ts`: compilação cross-platform de binários standalone Windows/Linux.
  - `scripts/generate_sha256sums.ts`: geração de `SHA256SUMS.txt` para releases.
  - `scripts/run_live_tests.ts`: executor de sondas reais PNCP, GitHub e Jurisprudência (`--court=<ID>`).
  - `scripts/smoke_test_fixture.ts`, `scripts/install.sh`, `scripts/install.ps1`.

---

## 4. Governança Física de Linhas (Lei 9 & `scripts/check_lines.ts`)

- **Diretórios com enforcement estrito automático (`<= 500` linhas em `bun run check:lines`):**
  - Código: `src/tools/juris`, `src/utils/pdf`, `src/contracts`, `src/arp`, `src/bidding`, `src/direct_contracting`;
  - Testes e Automação: `test`, `tests_live`, `scripts`.
- **Pastas legadas/raiz de `src/` atualmente fora da varredura automática de `scripts/check_lines.ts`:**
  - `src/index.ts`, `src/cli/`, `src/constants/`, `src/types/`, `src/mcp/`, `src/core/`, `src/parsers/`, `src/tools/` (raiz, `src/tools/inspect/`, `src/tools/openxml/`) e `src/utils/` (arquivos raiz como `archives.ts`, `pdf.ts`, `pdf_exporter.ts`, `xml.ts`).
- **Diretriz de Manutenção Segura:**
  1. **Não expandir monólitos legados in-place:** novas features devem nascer em subdiretórios modulares ou submódulos coesos (`<= 500` linhas).
  2. **Não refatorar arquivos estáveis próximos do teto sem necessidade funcional:** preserva-se a estabilidade de arquivos próximos a 500 linhas (ex.: `src/contracts/pas_sanction_auditor.ts`, `src/tools/juris/providers/tce_pr_catalog.ts`, `test/fill_template_multilevel.test.ts`, `test/contracts/pas_federative_v156.test.ts`, `test/inspect.test.ts`) evitando churn desnecessário.
