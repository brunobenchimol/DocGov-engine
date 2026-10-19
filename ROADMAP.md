# 🗺️ ROADMAP OFICIAL — `docgov-engine` (Rumo à `v1.0.0`)

> **Propósito deste Documento:** Fonte única de verdade sobre o estado evolutivo do motor MCP/CLI, separando as entregas já certificadas, as evoluções funcionais de PDF (`v0.9.x`) e a virada de chave arquitetural/nomenclatura (`v1.0.0 — Clean Cut`).
> **Regra para Agentes IA:** Sempre consulte e atualize os checkboxes (`[x]` / `[ ]`) deste `ROADMAP.md` ao concluir cada marco. **NÃO** antecipe mudanças de nomes da `v1.0.0` durante as versões `v0.9.x`.

---

## ✅ FASE 0 — Fundação Consolidada e Certificada (`v0.6.x` a `v0.8.1`) [CONCLUÍDO]
- [x] **v0.6.4 — Ingestão, Cache Cross-Órgão e Resiliência:** `bootstrap_case`, `inspect_docx`, `build_docx_template`, `fill_docx_template`, `generate_audit_docx`, Fingerprint SHA-256 (`EXACT` / `MODIFIED` / `NEW`), auto-healing de XML e *Exact Copy-Paste Errors*.
- [x] **v0.7.0 — Motor Híbrido de Lista Multinível:** Detecção de ancestralidade DOM (`isInsideTableCell`) gerando `<w:numPr>` nativo com `<w:startOverride>` no corpo do documento (`word/numbering.xml`) e *Hanging Indent* estático com `<w:tab/>` dentro de células de tabela.
- [x] **v0.7.2 / v0.7.3 — Sanitização Léxica Precoce e Telemetria:** Auto-normalização de índices numéricos de ponto (`{{itens.0.qtd}}` $\rightarrow$ `{{itens[0].qtd}}`), validação léxica de tags JS no `build_docx_template` e `"engine_version"` em todos os retornos MCP (`< 1024 bytes`).
- [x] **v0.8.0 / v0.8.1 — Inspeção Nativa de PDF e Cartografia de 14 Zonas:** Extração paginada `[PAG_XXX | LYYYY]`, Mapa Cartográfico Estrutural (`outline_headings` + `page_signals`) e Radar Determinístico das **14 Zonas de Impugnação (`Z1` a `Z14`)** separando Direcionamento Oculto (`Z7`), Marca Explícita/Padronização (`Z13`) e Métricas/Licenciamento (`Z14`).

---

## 🚧 MARCO 1 — `v0.9.0`: Inteligência Avançada de Leitura PDF e Multi-Documento [PRÓXIMO PASSO]
*(Importante: Manter nomes atuais de binários e tools MCP nesta versão para isolamento de testes).*

- [x] **1.1. Reconstrução Espacial de Tabelas e Colunas em PDF (`Y-Axis Line Grouping`):**
  - Agrupar itens de texto do PDF pela coordenada vertical `(y)` com tolerância fina e ordenar horizontalmente por `(x)`, separando colunas distintas com ` | ` (estilo tabela Markdown).
  - Evitar que planilhas de itens/preços (`Item | Descrição | Unid | Qtd | Valor`) e tabelas de *datasheets* saiam fragmentadas em linhas soltas.
- [x] **1.2. Geração Automática do Dossiê Executivo de Hotspots (`state/dossie_hotspots_<stem>.md`):**
  - Para documentos extensos (ex.: PDFs de 150 a 300 páginas), gerar automaticamente em `state/` um dossiê condensado contendo:
    1. O Mapa Cartográfico Completo (`outline_headings` + `page_signals`);
    2. Os blocos de texto expandidos (`±12 linhas` de contexto antes e depois) de todas as ocorrências das **14 Zonas (`Z1` a `Z14`)** e das páginas de especificações técnicas/tabelas de itens.
  - Permite que o Subagente Auditor faça a triagem de um edital de 300 páginas em **1 único turno de leitura**!
- [x] **1.3. Detector de Páginas Escaneadas / Sem Camada de Texto (`Scanned PDF Trap`):**
  - Calcular a densidade de caracteres extraídos por página.
  - Se houver páginas com zero (ou quase zero) caracteres extraíveis, retornar `"scanned_pages_detected": [p1, p2, ...]` no JSON da estrutura e inserir o marcador `[ALERTA CRÍTICO: PÁGINA ESCANEADA COMO IMAGEM — SEM CAMADA DE TEXTO EXTRAÍVEL]` na `visao_auditoria_<stem>.md`.
- [ ] **1.4. Índice Cartográfico Unificado do Caso (`state/indice_mestre_caso.md` no `bootstrap_case`):**
  - Quando a pasta `inputs/` contiver múltiplos arquivos (ex.: `Edital.pdf` + `Anexo_I_TR.pdf` + `Anexo_II_Especificacoes.pdf` + `Planilha.docx`), o `bootstrap_case` consolida um **`state/indice_mestre_caso.md`** mostrando quais arquivos compõem o processo e em qual arquivo/página está cada uma das 14 Zonas (`Z1` a `Z14`).

---

## 🖨️ MARCO 2 — `v0.9.5`: Geração e Exportação Nativa de PDF (`DOCX -> PDF` & Relatórios PDF)
*(Importante: Ainda mantendo compatibilidade de nomes antes do corte da v1.0.0).*

- [ ] **2.1. Pipeline Híbrido de Conversão `.docx` $\rightarrow$ `.pdf` (`src/utils/pdf_exporter.ts`):**
  - Implementar exportador capaz de gerar `.pdf` a partir dos `.docx` compilados:
    1. **Tier 1 (Windows com MS Word):** Automação silenciosa via PowerShell/COM (`SaveAs2` formato `wdFormatPDF = 17`) para fidelidade visual 100% idêntica ao Word (preservando brasões, cabeçalhos, tabelas e `numbering.xml`).
    2. **Tier 2 (Linux / WSL / Headless):** Conversão via `libreoffice --headless --convert-to pdf` se disponível no PATH.
    3. **Tier 3 (Standalone Pure-JS Fallback):** Renderizador PDF vetorial embutido via `pdf-lib` para garantir geração de PDF mesmo em ambientes sem Office instalado.
- [ ] **2.2. Suporte a `outputFormat: "docx" | "pdf" | "both"` nas Ferramentas de Saída:**
  - Adicionar o parâmetro opcional `outputFormat` (default `"docx"`, aceitando `"pdf"` ou `"both"`) em `fill_docx_template` e `generate_audit_docx`.
  - Quando `"pdf"` ou `"both"` for solicitado, entregar `output/<arquivo>.pdf` pronto e validado (`%PDF-`).

---

## 🚀 MARCO 3 — `v1.0.0`: O Grande Corte Limpo (`Clean Cut Refactoring` para `docgov-engine`)
*(Breaking Change planejado: executado de uma só vez após a certificação integral dos Marcos 1 e 2).*

- [ ] **3.1. Nova Identidade Unificada do Motor:**
  - Renomear pacote, banners, `--version` e constantes internas de `docgov-docx-engine` para **`docgov-engine v1.0.0`**.
  - Renomear binários gerados no build e no GitHub Actions para:
    - Windows: `docgov-engine.exe` (asset: `docgov-engine-win-x64.exe`)
    - Linux: `docgov-engine-linux` (asset: `docgov-engine-linux-x64`)
- [ ] **3.2. Padronização Semântica das Ferramentas MCP (`v1.0.0`):**
  - Ferramentas Agnósticas Multimodal (`.pdf` + `.docx`):
    1. `bootstrap_case` (ingere e mapeia toda a pasta `inputs/`)
    2. **`inspect_doc`** *(substitui `inspect_docx`; parâmetro principal passa a ser `filePath`, mantendo `docxPath` como fallback silencioso)*
  - Ferramentas Específicas de Template Word (`.docx` explícito):
    3. `build_docx_template`
    4. `fill_docx_template` (com suporte a `outputFormat: "docx" | "pdf" | "both"`)
  - Ferramenta de Emissão de Relatório de Auditoria / Impugnação (`.docx` e/ou `.pdf`):
    5. **`generate_audit_report`** *(ou mantendo alias `generate_audit_docx` com suporte a `outputFormat: "docx" | "pdf" | "both"`)*
- [ ] **3.3. Atualização do Auto-Updater (`--update`) e Repositório GitHub:**
  - Apontar o `--update` para o repositório renomeado `docgov-engine` e para os novos nomes de assets `docgov-engine-*`.
  - Renomear o repositório no GitHub (`docgov-docx-engine` $\rightarrow$ `docgov-engine`) e a pasta local de desenvolvimento.
