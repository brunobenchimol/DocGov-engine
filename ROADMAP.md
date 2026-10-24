# 🗺️ ROADMAP OFICIAL — `docgov-engine` (v1.1.0+)

> **Memória Histórica:** Para o histórico consolidado de versões desde o commit inicial (`v0.0.1`) até o lançamento principal (`v1.0.0 — Clean Cut`), consulte o [CHANGELOG.md](CHANGELOG.md).
> **Propósito deste Documento:** Fonte única da verdade sobre o planejamento arquitetural, evoluções funcionais e marcos estratégicos futuros do motor (`v1.1.0+`).
> **Natureza Standalone & Desacoplada:** O `docgov-engine` é um motor autônomo e determinístico. Embora sirva como fundação para a camada de agentes do ecossistema `docgov`, ele possui ciclo próprio de evolução e pode ser utilizado de forma independente via CLI ou MCP por qualquer cliente, agente de IA ou pipeline automatizado.
> **Regra para Agentes IA:** Sempre consulte e atualize os checkboxes (`[x]` / `[ ]`) deste `ROADMAP.md` ao planejar ou concluir cada marco evolutivo.

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

---

## 🎯 MARCO 5 — `v1.2.0`: Engenharia Tabular Avançada Multi-Página & Pipeline OCR Headless

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

## 🎯 MARCO 6 — `v1.3.0`: Motor de Diff Semântico, Evolução de Cláusulas e Nota Técnica Comparativa

- [ ] **6.1. Mapeamento de Evolução de Cláusulas e Histórico Cirúrgico ("Antes vs. Depois"):**
  - Registro estruturado do ciclo de vida de alterações em slots e cláusulas durante o saneamento documental:
    - *Slot ID / Coordenada da Cláusula;*
    - *Redação Anterior (Original);*
    - *Nova Redação Saneadora;*
    - *Fundamentação Técnica e Justificativa Jurídica (Artigos da Lei 14.133/2021, Jurisprudência TCU, Pareceres AGU).*
  - Cálculo de diff semântico e granular de texto (inserções, supressões e substituições parciais) com marcação visual clara (`[+]` / `[-]`).

- [ ] **6.2. Geração da Nota Técnica Comparativa Padronizada (`.docx` e `.pdf`):**
  - Emissão automatizada em `output/Nota_Tecnica_Evolucao_<Artefato>.docx` e `.pdf` contendo o quadro de alterações e a justificativa motivada.
  - Layout formal de alta fidelidade visual para instrução de processo administrativo, submissão à Procuradoria / Consultoria Jurídica e órgãos de Controle Interno.
  - Suporte completo via CLI (`docgov-engine --diff-report ...`) e ferramenta MCP especializada, alimentando nativamente o Workbench Mode do ecossistema consumidor.

---

## 🎯 MARCO 7 — `v1.4.0`: Núcleo de Auditoria e Fiscalização Contratual Contínua

- [ ] **7.1. Ingestão e Mapeamento de Contratos e Termos Aditivos:**
  - Cartografia pericial de instrumentos contratuais, vigências, garantias e termos aditivos de acréscimo/supressão.
  - Cálculo determinístico de limites legais de aditamento (25% para compras/serviços e 50% para reformas, conforme Lei nº 14.133/2021).

- [ ] **7.2. Motor de Validação Cruzada Tripartite (Edital $\leftrightarrow$ Proposta Vencedora $\leftrightarrow$ Contrato):**
  - Verificação automatizada de conformidade entre os itens exigidos no Termo de Referência, os preços cotados na proposta classificada e as cláusulas pactuadas no contrato administrativo.
  - Detecção de desvios de objeto, itens suprimidos sem amparo e divergências de especificação técnica.

- [ ] **7.3. Monitoramento e Histórico de Reajustes / Repactuações:**
  - Rastreamento de índices inflacionários contratuais (IPCA, INPC, IGP-M) e memória de cálculo de repactuação de mão de obra exclusiva.

---

## 🎯 VISÃO DE LONGO PRAZO / `v2.0.0` (Major Release Condicional)

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
7. **Ritual de Qualidade e Release:** SemVer, aprovação em testes automatizados, tags anotadas e changelog atualizado.
8. **Disciplina Autônoma de Micro-Commits & Memória:** Fatiamento em commits atômicos, testes por commit e sincronia contínua de `CHANGELOG.md` e `ROADMAP.md`.
