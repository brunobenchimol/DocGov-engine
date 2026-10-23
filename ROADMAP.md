# 🗺️ ROADMAP OFICIAL — `docgov-engine` (v1.1.0+)

> **Memória Histórica:** Para o histórico consolidado de versões desde o commit inicial (`v0.0.1`) até o lançamento principal (`v1.0.0 — Clean Cut`), consulte o [CHANGELOG.md](CHANGELOG.md).
> **Propósito deste Documento:** Fonte única da verdade sobre o planejamento arquitetural, evoluções funcionais e marcos estratégicos futuros do motor (`v1.1.0+`).
> **Regra para Agentes IA:** Sempre consulte e atualize os checkboxes (`[x]` / `[ ]`) deste `ROADMAP.md` ao planejar ou concluir cada marco evolutivo.

---

## 🎯 MARCO 4 — `v1.1.0`: Auditoria Matemática de Planilhas e Diff Estrutural Semântico

- [ ] **4.1. Auditoria Matemática Determinística de Planilhas Orçamentárias (`pdf` e `docx`):**
  - **Parsing e Extração de Linhas de Itens:** Extrair com precisão linhas de tabelas contendo identificadores, descrições, quantidades, unidades de medida e valores monetários (`Item | Descrição | Unid | Qtd | Valor Unit | Valor Total`).
  - **Validação Aritmética Determinística:**
    - Verificar produto de cada item: $\text{Qtd} \times \text{Valor Unitário} = \text{Valor Total}$ (com tolerância configurável de arredondamento cambial/centavos $\le R\$\,0,02$).
    - Verificar somatórios parciais de subtotais e soma global da planilha orçamentária.
    - Identificar potenciais distorções em alíquotas de BDI (Bonificação e Despesas Indiretas), encargos sociais e custos unitários de referência (ex.: SINAPI / SICRO).
  - **Emissão Estruturada de Inconsistências:**
    - Persistir relatório detalhado em `state/auditoria_orcamentaria_<stem>.json`.
    - Integrar alertas de erro de cálculo diretamente no `state/dossie_hotspots_<stem>.md` e na `state/visao_auditoria_<stem>.md`.
  - **Payload Sintético MCP:** Expor métricas sintéticas compactas (`total_items_checked`, `arithmetic_errors_count`, `divergence_sum`) mantendo a resposta estritamente abaixo de 900 bytes (Lei 2).

- [ ] **4.2. Diff Estrutural Semântico Multi-Versão (Comparador de Minutas e Editais Retificados):**
  - **Comparação Estrutural de Documentos:**
    - Analisar pares de documentos correlatos (ex.: `Edital_Original.pdf` vs. `Edital_Retificado.pdf` ou `Minuta_TR.docx` vs. `TR_Final.docx`).
    - Detectar seções adicionadas, modificadas, removidas ou reordenadas com base no `toc_map` e índices cartográficos.
  - **Rastreamento de Impacto nas 14 Zonas (`Z1` a `Z14`):**
    - Alertar especificamente alterações que introduzam ou suprimam cláusulas sensíveis (ex.: alteração de prazos em `Z6`, inserção de marcas em `Z13`, alterações de qualificação técnica em `Z2`).
  - **Emissão do Dossiê Comparativo:**
    - Gerar automaticamente `state/diff_documental_<stemA>_vs_<stemB>.md` com marcações visuais claras de acréscimo (`[+]`) e supressão (`[-]`).

---

## 🎯 MARCO 5 — `v1.2.0`: Engenharia Tabular Avançada & Pipeline OCR Headless

- [ ] **5.1. Extração Tabular Complexa Multi-Página com Quebras Estruturais:**
  - **Fusão Contínua de Cabeçalhos:** Detectar continuidade de tabelas que se estendem por múltiplas páginas consecutivas com repetição de cabeçalho.
  - **Resolução de Células Multilinha:** Agrupar linhas textuais pertencentes à mesma célula lógica, prevenindo o desalinhamento de colunas em descrições extensas de itens.
  - **Células Mescladas (`rowspan` / `colspan`):** Normalizar matrizes tabulares no espelho de leitura linear e no JSON estrutural.

- [ ] **5.2. Pipeline OCR Headless para PDFs Escaneados (`Scanned Trap` $\rightarrow$ OCR Automático):**
  - **Detecção e Fallback Silencioso:** Quando o detector de páginas escaneadas sinalizar páginas sem camada de texto (`scanned_pages_detected`), acionar pipeline determinístico de OCR vetorial.
  - **Arquitetura Desacoplada e Standalone:** Implementar engine leve baseada em WASM ou binário utilitário encapsulado, sem exigir dependências externas pesadas no sistema operacional host.
  - **Geração de Coordenadas Homogêneas:** Injetar o texto reconhecido pelo OCR diretamente na cartografia linear `[PAG_XXX | LYYYY]`, permitindo que o Radar das 14 Zonas examine documentos escaneados com o mesmo fluxo determinístico de PDFs digitais.

- [ ] **5.3. Geração Automática de Matriz de Risco e Checklist de Conformidade:**
  - Emissão parametrizada de Matrizes de Risco em Word via `generate_audit_docx`, com cruzamento automático da jurisprudência de órgãos de controle federal (TCU, AGU e MGI).

---

## 🎯 MARCO 6 — `v2.0.0`: Núcleo de Auditoria Contratual e Fiscalização Contínua

- [ ] **6.1. Ingestão e Mapeamento de Contratos e Termos Aditivos:**
  - Cartografia pericial de instrumentos contratuais, vigências, garantias e termos aditivos de acréscimo/supressão.
  - Cálculo determinístico de limites legais de aditamento (25% para compras/serviços e 50% para reformas).
- [ ] **6.2. Motor de Validação Cruzada Tripartite (Edital $\leftrightarrow$ Proposta Vencedora $\leftrightarrow$ Contrato):**
  - Verificação de conformidade entre os itens exigidos no Termo de Referência, os preços cotados na proposta classificada e as cláusulas pactuadas no contrato administrativo.
- [ ] **6.3. Monitoramento e Histórico de Reajustes / Repactuações:**
  - Rastreamento de índices inflacionários contratuais (IPCA, INPC, IGP-M) e memória de cálculo de repactuação de mão de obra exclusiva.

---

## 🛡️ Estatuto de Governança para Agentes IA

Todo desenvolvimento e evolução dos marcos acima deve respeitar estritamente as **7 Leis Invioláveis de Engenharia** descritas no [`AGENTS.md`](AGENTS.md):
1. **Runtime Bun & Portabilidade:** Sem caminhos locais absolutos.
2. **Teto de Payload MCP (< 1024 bytes):** Margem segura recomendada `< 900 bytes`.
3. **Exact Copy-Paste Error:** Fail-fast com snippet de autocorreção imediata.
4. **Sincronia Obrigatória de Self-Discovery:** `--dump-spec`, `DOCX_ENGINE_INSTRUCTIONS` e documentação unificados.
5. **Neutralidade Institucional Absoluta:** Exclusivamente identificadores genéricos ou federais universais (`ORGAO_CONTRATANTE`, `MUNICIPIO_GENERICO`, `AGU`, `MGI`, `TCU`).
6. **Resiliência de Caminhos e Cache Global:** Resolução desacoplada de `process.cwd()`.
7. **Ritual de Qualidade e Release:** SemVer, aprovação em testes automatizados, tags anotadas e changelog atualizado.
