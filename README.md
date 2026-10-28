# docgov-engine — Motor Standalone Determinístico & Servidor MCP (v1.3.7)

Motor unificado para o **ciclo completo de documentos Microsoft Word (`.docx`), planilhas (`.xlsx`/`.csv`), minutas e notas técnicas em Markdown/Texto (`.md`/`.txt`) e engenharia reversa/cartografia/auditoria determinística de Editais, Termos de Referência e anexos em PDF (`.pdf`)**, além de servidor **Model Context Protocol (MCP)** via `stdio`, projetado para o ecossistema **DocGov** e compatível com qualquer agente de IA (Google Antigravity, Claude Code, Claude Desktop, Cursor, VS Code Copilot e Windsurf).

Compilado em **binário standalone** (Windows `x64` e Linux `x64`) via Bun — não requer Node.js, Bun ou interpretadores externos instalados na máquina do usuário final.

---

## 1. Instalação Rápida e Auto-Atualização

### Instalação Automática em 1 Linha (Recomendado)

#### Windows (PowerShell)
Instala o binário em `$env:LOCALAPPDATA\docgov\bin\docgov-engine.exe`, valida a integridade do arquivo (> 50 MB), testa `--version` e exibe o snippet pronto para MCP:
```powershell
irm https://raw.githubusercontent.com/brunobenchimol/DocGov-engine/main/scripts/install.ps1 | iex
```

#### Linux / WSL (Bash)
Instala o binário em `~/.docgov/bin/docgov-engine`, concede permissão de execução, valida a versão e orienta sobre o PATH:
```bash
curl -fsSL https://raw.githubusercontent.com/brunobenchimol/DocGov-engine/main/scripts/install.sh | bash
```

---

### Download Manual Direto (Alternativa)

#### Windows (PowerShell)
```powershell
curl.exe -fL "https://github.com/brunobenchimol/DocGov-engine/releases/latest/download/docgov-engine-win-x64.exe" -o docgov-engine.exe
.\docgov-engine.exe -v
```

#### Linux / WSL (Bash)
```bash
curl -fL "https://github.com/brunobenchimol/DocGov-engine/releases/latest/download/docgov-engine-linux-x64" -o docgov-engine
chmod +x docgov-engine
./docgov-engine -v
```

---

### Configuração no Claude Desktop ou Antigravity MCP

Adicione ao seu arquivo de configuração MCP (`claude_desktop_config.json` ou similar):

#### Windows
```json
{
  "mcpServers": {
    "docgov-engine": {
      "command": "C:\\caminho\\para\\docgov-engine.exe",
      "args": []
    }
  }
}
```

#### Linux / WSL
```json
{
  "mcpServers": {
    "docgov-engine": {
      "command": "/caminho/para/docgov-engine",
      "args": []
    }
  }
}
```

### Auto-Atualização do Binário (`Self-Update`)
Depois de baixado pela primeira vez, o próprio binário consegue verificar novas releases no GitHub e atualizar a si mesmo:
```powershell
# Verificar se há uma nova versão disponível
./docgov-engine --check-update

# Atualizar automaticamente para a versão mais recente (se houver)
./docgov-engine --update

# Forçar download e reinstalação da última release
./docgov-engine --force-update
```

---

## 2. Destaques da Versão `v1.3.7` (Geração 3 — Tabelas Markdown para OpenXML, `remove_table_rows`, Scanner Anti-Contaminação e NFC) e Marcos Anteriores

A versão **`v1.3.7`** entrega 4 recursos determinísticos (`ENG-06` a `ENG-09`) para geração de tabelas de alta complexidade, poda limpa de subtabelas em modelos monolíticos, detecção automática de contaminação de minutas doadoras e resiliência multiplataforma Unicode `NFC`:

### Novidades da `v1.3.7` (`ENG-06` a `ENG-09`):
1. **Conversor Nativo de Tabelas Markdown para OpenXML `<w:tbl>` (`ENG-06`):**
   - `fill_docx_template` detecta automaticamente blocos de tabelas Markdown (`| Col1 | Col2 |\n| :--- | :--- |\n| val1 | val2 |`) tanto dentro de strings multilinha quanto entre parágrafos `<w:p>` adjacentes e os converte nativamente em elementos OpenXML `<w:tbl>` reais, com `<w:tblGrid>` proporcional, bordas corporativas (`CBD5E1`), cabeçalho sombreado (`F1F5F9`) em negrito, alinhamentos por coluna (`:---`, `:---:`, `---:`), negrito seletivo e parágrafo final `<w:p/>` obrigatório em `<w:tc>` (ECMA-376).
2. **Operador Direto `remove_table_rows` e Detector de Subtabelas/Checkboxes (`ENG-07`):**
   - Suporte ao operador `"remove_table_rows": [{ "table_index": 0, "from_row": 27, "to_row": 44 }]` no `slots_manifest.json`, executado em ordem Bottom-Up com preservação e promoção automática de `<w:vMerge w:val="restart"/>`.
   - `inspect_doc` detecta automaticamente subtabelas de itens numerados (`1..N`) e grupos de checkboxes (`☒ Sim` / `☐ Não`) com coordenadas físicas exatas, exibindo orientações de poda limpa no Bloco 1 da `visao_auditoria_*.md`.
3. **Scanner Pós-Compilação Anti-Contaminação de Doador (`ENG-08`):**
   - Estampa `## ⚠️ ALERTAS DE INTEGRIDADE PÓS-COMPILAÇÃO (AÇÃO OBRIGATÓRIA DO AUDITOR)` no topo do Bloco 1 da `visao_auditoria_*.md` ao detectar workarounds `"Item não aplicável"`, tabelas Markdown residuais não convertidas, checkboxes contraditórios (`☒ Sim` e `☒ Não` simultâneos) ou vazamento de vocabulário de minuta doadora de Hardware (`RoHS`, `INMETRO`, `ANATEL`, `NVMe`, `DDR5`, `ARP 90015/2024`) em contratações puras de Software/Serviços (sem falsos-positivos em contratações mistas legítimas de Hardware+Software).
4. **Normalização Universal Unicode `NFC` e Lookup Resiliente `NFC/NFD` (`ENG-09`):**
   - Normalização `.normalize("NFC")` em todos os nomes de arquivos extraídos de `.zip`/`.tar.gz`, copiados para `inputs/` e gerados em `state/`, combinada com resolução resiliente `resolveExistingPathNfc` que localiza arquivos em disco independentemente de a codificação do filesystem ser `NFD` (macOS) ou `NFC` (Windows/Linux).

---

## 2.1. Destaques da Versão `v1.3.6` (Geração 3 — Engenharia Tabular e Template Matching) e Marcos Anteriores

A versão **`v1.3.6`** resolve 5 atritos estruturais (`ENG-01` a `ENG-05`) na manipulação de tabelas OpenXML complexas com células mescladas (`vMerge` e `gridSpan`), garantindo fidelidade geométrica e paridade entre coordenadas físicas e virtuais:

### Novidades da `v1.3.6` — Engenharia Tabular e Template Matching (`ENG-01` a `ENG-05`):
1. **Fim da Fusão Horizontal de Colunas em `loop_table_rows` (`ENG-01`):**
   - Injeção das tags delimitadoras `{{FOR item IN ...}}` e `{{END-FOR item}}` em linhas `<w:tr>` dedicadas isoladas da linha de dados, eliminando a duplicação indevida de colunas (19 para 38 células físicas) e preservando intactas as propriedades de `<w:vMerge/>` em `C0`.
2. **Alinhamento de Coordenadas Físicas vs. Virtuais (`<w:tc>` vs `gridSpan` — `ENG-02`):**
   - Exposição de `physicalCellIndex` e `virtualColIndex` em `TableCellInfo`, permitindo que os agentes copiem diretamente a coordenada física real exibida no Bloco 1 da `visao_auditoria_*.md` para o `slots_manifest.json`.
   - Fallback automático e transparente em `replace_table_cells` (`resolvePhysicalTableCell`), convertendo índices virtuais de colunas mescladas por `gridSpan` para a célula física correta caso o usuário forneça a coordenada visual.
   - Fail-Fast Estrito com Exact Copy-Paste Error (`ENG-02c`) quando `cell_tags.length` ultrapassa a contagem física da linha, com auto-alinhamento inteligente se `C0` for `vMerge`.
3. **Normalização de `vMerge` e `gridSpan` no Cálculo de Fingerprint Estrutural (`ENG-03`):**
   - Descarte de placeholders (`isSpanPlaceholder`) e continuação vertical (`rowSpan: "continue"`) na contagem de colunas e deduplicação de campos de formulário idênticos.
   - Comparação tolerante de tabelas quando os cabeçalhos coincidem ($\ge 0.5$) e retorno do candidato de maior similaridade mesmo em status `NEW` (`< 75%`).
4. **Exposição de `template_match` e `form_fields` Físicos na Visão Linear de Auditoria (`ENG-04`):**
   - O Bloco 1 da `visao_auditoria_*.md` agora inclui o resumo do matching contra o registro global e a tabela de campos de formulário mapeados com coordenadas físicas de alvo prontas para uso.
5. **Ordem Bottom-Up Estrita na Construção de Templates (`ENG-05`):**
   - Substituições e loops executados em ordem decrescente de índice, prevenindo desvios espúrios de coordenadas no documento.

---

## 2.1. Destaques da Versão `v1.3.5` (Geração 3 — Busca PNCP & Redirect Resolver) e Marcos Anteriores

A versão **`v1.3.5`** expande o conector PNCP com a **8ª ferramenta MCP oficial (`search_pncp`)** e o resolvedor automático de URLs de redirecionamento:

### Novidades da `v1.3.5` — Busca Multi-Query PNCP e Redirect Resolver (`search_pncp` e `--search-pncp`):
1. **Busca Textual Multi-Query no PNCP (8ª Ferramenta MCP e CLI `--search-pncp`):**
   - Descoberta instantânea de contratações de referência a partir de termos de busca, objetos ou órgãos na API oficial `/api/search/` do PNCP.
   - **Multi-Query em Paralelo:** Permite fornecer termos combinados separados por pipe `|` (ex.: `"fábrica de software | sustentação de sistemas"`), executando as consultas em paralelo com desduplicação automática por `CNPJ/ANO/SEQUENCIAL`.
   - **Acumulação Inteligente e Tabela com Objeto Completo:** Preserva buscas anteriores da mesma sessão em `state/pncp_search_results.json` e gera tabela Markdown executiva em `state/pncp_search_results.md` com o **Objeto Integral** de cada edital para análise precisa de compatibilidade.
   - **Payload Sintético MCP (< 900 bytes — Lei 2):** Retorno compacto contendo caminhos estruturados, contagens e top candidatos com `next_step_hint` direcionando ao `fetch_pncp`.
2. **Resolvedor Nativo de Redirects do Google Grounding (`resolvePncpRedirectUrl`):**
   - Resolução transparente de URLs de redirecionamento opacas (`https://vertexaisearch.cloud.google.com/grounding-api-redirect/...`) geradas pelo Google Grounding (`search_web`), inspecionando o cabeçalho `Location` com `redirect: "manual"` e extraindo diretamente o identificador canônico `CNPJ/ANO/SEQUENCIAL`.

---

## 2.1. Destaques da Versão `v1.3.4` (Geração 3 — Conector Nativo PNCP) e Marcos Anteriores

A versão **`v1.3.4`** trouxe a 7ª ferramenta MCP oficial e o comando CLI de captura e catalogação isolada de contratações públicas de referência do Portal Nacional de Contratações Públicas:

### Novidades da `v1.3.4` — Conector Nativo PNCP (`fetch_pncp` e `--fetch-pncp`):
1. **Conector Nativo PNCP (7ª Ferramenta MCP e CLI `--fetch-pncp`):**
   - Ingestão determinística e sem consumo de tokens de metadados e todos os arquivos públicos de contratações de referência no Portal Nacional de Contratações Públicas (PNCP) para benchmarking técnico e pesquisa de mercado (IN SEGES/ME nº 65/2021).
   - **Isolamento Físico Estrito:** Todos os arquivos externos baixados residem exclusivamente na subpasta `cases/<slug>/inputs/pncp_<shortname>/`, sem nunca se misturarem com os documentos originais do caso na raiz de `inputs/`.
   - **Descompactação Automática Integrada:** Pacotes `.zip`, `.tar`, `.tar.gz` ou `.tgz` baixados do PNCP são descompactados in-place via classificador estrutural `libmagic msooxml` com defesa Anti-Zip Slip e descarte de lixo de sistema (`__MACOSX`, `.DS_Store`).
   - **Catálogo de Referência Dedicado:** Catalogação estrutural leve em memória e geração exclusiva de `state/indice_pncp_<shortname>.md` e `state/pncp_<shortname>_meta.json`, mantendo `state/` limpo de falsos achados de auditoria externa.
   - **Payload Sintético MCP (< 900 bytes — Lei 2):** Retorno conciso com confirmação de download, caminhos isolados e contadores.

---

## 2.1. Destaques da Versão `v1.3.0` (Geração 2 — Marco 6: Diff Semântico e Nota Técnica) e Marcos Anteriores

A versão **`v1.3.0`** consolida o **Marco 6 do ROADMAP**, trazendo capacidades avançadas de rastreabilidade de alterações contratuais e governança formal de evolução de minutas:

### Novidades da `v1.3.0` — Marco 6 do ROADMAP:
1. **Diff Semântico Granular em Nível de Token (Marco 6.1):**
   - Tokenizador com regex Unicode `gu` (`/(?:R\$\s*[\d\.,]+|\d+(?:\.\d+)+|[\p{L}\p{N}_ºª§]+|\s+|[^\p{L}\p{N}_\s])/gu`), preservando caracteres acentuados do português (`ç`, `ã`, `é`), quantias monetárias, ordinais e pontuações sem fragmentação indevida.
   - Algoritmo LCS (*Longest Common Subsequence*) com guardrail de complexidade para blocos extensos ($m \times n > 2.000.000$, particionamento por sentenças `/(?<=[.;!?])\s+/`), garantindo performance instantânea.
   - Agrupamento em blocos contíguos (`diff_chunks`) e renderização em markdown inline ({++inclusão++}, {--supressão--}).
2. **Nota Técnica Comparativa Padronizada de Evolução de Cláusulas (Marco 6.2):**
   - Relatório executivo formal ("Antes vs. Depois") para instrução processual de alterações contratuais (Art. 124 a 136 Lei 14.133/2021).
   - Layout editorial vertical A4 corrido (zero tabelas `<w:tbl>`, 100% largura útil), com cards visuais com bordas laterais coloridas por tipo de alteração (verde para inclusão, vermelho para supressão, azul para alteração).
   - Quadro de evolução com fundamentação técnica e jurídica individualizada por cláusula alterada, resumo executivo, contagem de alterações e delta do Radar das 14 Zonas de Impugnação.
   - Exportação em Word (`.docx`) e PDF via Pipeline Híbrido.
3. **Novos Comandos CLI e Ferramenta MCP Híbrida:**
   - CLI: `--diff-report --old <base> --new <revisado> --out <nota.docx> [--format <docx|pdf|both>] [--data <nota.json>]` e `--generate-technical-note --note-json <nota.json> --out <nota.docx>`.
   - MCP Tool: `generate_technical_note_docx` com suporte híbrido direto (`noteJsonPath`) ou comparativo automático (`oldPath` + `newPath`), mantendo o teto estrito de payload (< 900 bytes, Lei 2).

---

### Novidades da `v1.2.0` — Marco 5 do ROADMAP:
1. **Segurança de Supply-Chain & Auto-Updater SHA-256 (Marco 5.1):** Validação criptográfica de integridade SHA-256 (`SHA256SUMS.txt`) antes da substituição de binários em disco no `--update`, com suporte híbrido transparente a credenciais `DOCGOV_GITHUB_TOKEN` / `GH_TOKEN` e fallback para arquivo local `.env` em repositórios públicos ou privados.
2. **Ingestão Nativa de Planilhas Orçamentárias `.xlsx` e `.csv` (Marco 5.2a):** Leitor OpenXML Spreadsheet nativo e leve sem dependências externas, indexação estrita por coordenada `r="A1"` (imune a desalinhamento por células vazias) e parser CSV RFC 4180, integrados diretamente ao `budget_auditor.ts` ($	ext{Qtd} \times \text{Unit} = \text{Total}$ em centavos inteiros nas zonas Z10/Z12).
3. **Engenharia Tabular Avançada Multi-Página & Mesclagem (Marco 5.2b):** Fusão de tabelas contínuas com cabeçalho repetido em DOCX e PDF, agrupamento de células multilinha e normalização de `gridSpan` (colspan) e `vMerge` (rowspan) do OpenXML.
4. **Pipeline OCR Headless para PDFs Escaneados (Marco 5.3):** Recuperação determinística de texto em páginas escaneadas (`scanned_pages_detected`) operando 100% offline embutido no binário Bun com injeção em `[PAG_XXX | LYYYY]` e marcação `ocr_applied: true`.
5. **Geração Parametrizada de Matriz de Riscos e Checklist de Conformidade (Marco 5.4):** Emissão em layout editorial vertical corrido A4 corporativo de Matriz de Gerenciamento de Riscos (Lei nº 14.133/2021) e Checklist de Conformidade Normativa (TCU/AGU/MGI) em Word e PDF via `generate_audit_docx`.

---
## 2.1. Destaques da Versão `v1.1.1` (Hotfix Arquitetural)

A versão **`v1.1.1`** introduz correções críticas de robustez para ingestão em casos reais com múltiplos insumos volumosos:

### Novidades da `v1.1.1` — Sanitização XML BOM, Deduplicação da Raiz e Resiliência Multi-Arquivo
1. **Sanitização Universal de XML BOM e Whitespaces Iniciais:**
   - Remoção automática de UTF-8 Byte Order Mark (`\uFEFF`) e caracteres em branco/quebras de linha antes da tag raiz ou de `<?xml` em todos os parsers OpenXML (`inspect`, `build_template`, `fill_template`, `audit`, `xml.ts`, `pdf_exporter.ts`).
   - Eliminação definitiva do erro fatal `processing instruction at position 1 is an xml declaration which is only at the start of the document` disparado pelo `@xmldom/xmldom` (`sax.js:922`).
2. **Movimentação Limpa e Deduplicação da Raiz do Caso para `inputs/`:**
   - Detecção automática de documentos soltos colocados diretamente na raiz de `cases/<slug>/` durante `bootstrap_case`.
   - Movimentação segura para `inputs/` ou deduplicação imediata quando já existirem em `inputs/`, preservando arquivos de sistema (`context.json`, `metadata.json`, `README.md`) e garantindo zero duplicação de espaço em disco.
3. **Resiliência Multi-Arquivo com Isolamento `try/catch` por Documento:**
   - Cada arquivo `.docx` e `.pdf` é inspecionado de forma isolada; falhas de parsing em um anexo específico não abortam mais o bootstrap do caso.
   - Geração garantida do `state/indice_mestre_caso.md` com inventário probatório de 100% dos insumos (incluindo status `⚠️ Falha de leitura` e anexos de dados `.xlsx`/`.csv`).
4. **Métricas de Ressalva no Payload MCP (Lei 2):**
   - Retorno sintético enriquecido com `inspection_errors_count` mantendo payload estritamente abaixo de 900 bytes.

### Novidades da `v1.1.0` — Auditoria Matemática de Planilhas e Diff Estrutural
1. **Auditoria Matemática Determinística de Planilhas Orçamentárias (`.docx` e `.pdf`):**
   - Módulo autônomo `src/core/budget_auditor.ts` com aritmética estrita em **centavos inteiros (`BigInt` / `Math.round`)**, eliminando imprecisões de ponto flutuante IEEE 754.
   - Detecção inteligente de colunas orçamentárias (`Item`, `Descrição`, `Unid`, `Qtd`, `Valor Unitário`, `Valor Total`) em tabelas OpenXML e grades colunares PDF.
   - **Dupla Verificação Determinística:** Checagem horizontal linha a linha ($\text{Qtd} \times \text{Unit} = \text{Total}$) classificando divergências em `ROUNDING_WARNING` ($\le R\$\,0,02$) e `MATH_ERROR` ($> R\$\,0,02$).
   - **Verificação Vertical:** Validação de subtotais e somatório do Total Geral da planilha.
   - **Cruzamento com o Texto:** Busca automática por valores globais no corpo do documento (`"valor estimado de R$..."`) e cruzamento com a soma da planilha.
   - **Integração ao Radar das 14 Zonas:** Achados injetados automaticamente em `Z10_PRECOS_EXEQUIBILIDADE_PLANILHA` e `Z12_MAPA_CRUZADO_MULTIPECA`.
   - **Persistência de Evidências:** Gravação de `state/auditoria_orcamentaria_<stem>.json` e inclusão de bloco executivo na visão de auditoria e no dossiê de hotspots.
2. **Motor de Diff Estrutural e Semântico Multi-Versão (`src/core/structural_diff.ts`):**
   - Comparação analítica entre versões de minutas e editais retificados (`oldPath` vs `newPath`).
   - Mapeamento granular de títulos e seções: `ADDED`, `REMOVED` e `MODIFIED` (com realce de mudanças inline `~~antigo~~` $\rightarrow$ `**novo**`).
   - **Delta do Radar das 14 Zonas:** Rastreamento de pontos quentes introduzidos (`INTRODUCED`), sanados (`RESOLVED`) e mantidos (`RETAINED`).
   - **Persistência de Diffs:** Gravação de `state/diff_documental_<stem>.md` e `state/diff_documental_<stem>.json`.
   - **Exposição MCP & CLI:** Disponível via parâmetro `compareWithPath` em `inspect_doc` e flag `--diff <caminho>` na CLI.
3. **Respeito Estrito à Lei 2 (Teto MCP < 1024 bytes):** Retorno sintético enriquecido com métricas orçamentárias e de diff com payload médio entre 400 e 600 bytes (margem garantida $< 900$ bytes).

### Novidades da `v1.0.0` — Clean Cut & Ferramenta Multimodal
1. **Identidade Oficial Unificada:** Transição completa para `docgov-engine v1.0.0` em todos os binários (`./bin/docgov-engine.exe` e `./bin/docgov-engine`), servidor MCP (`name: "docgov-engine"`), banners CLI e especificações normativas.
2. **Nova Ferramenta Multimodal `inspect_doc`:** Substituição semântica de `inspect_docx` por `inspect_doc`, recebendo o parâmetro principal `filePath` para arquivos `.docx` e `.pdf`, mantendo resiliência total com o alias `docxPath` e retrocompatibilidade estrita.
3. **Margem de Segurança Estrita MCP (< 920 bytes):** Redução estratégica das mensagens de salvaguarda e ajuste do gatilho de corte sintético em `bootstrap_case` e `inspect_doc` para `< 900 bytes`, garantindo folga segura abaixo de 920 bytes contra o teto de 1024 bytes (Lei 2).
4. **Sincronização Integral de Self-Discovery (Lei 4):** `--dump-spec`, `DOCX_ENGINE_INSTRUCTIONS` e documentação alinhados na versão canônica `v1.0.0`.

### Novidades e Correções Anteriores (`v0.9.6`) — Conformidade Contratual Black-Box
1. **CORR-01 (Cartografia e Dossiê Hotspots):** Desacoplamento de `page_signals` dos gatilhos de contexto no `dossie_hotspots_<stem>.md`. A Linha 1 não vira mais `ALVO` falso e linhas introdutórias distantes (`L01..L08`) não vazam mais no recorte cirúrgico de $\pm 12$ linhas quando o hotspot real está em linhas posteriores.
2. **CORR-02 (Reconstrução Espacial de Tabela com Y-Jitter):** Tolerância a micro-variações no eixo vertical ($\Delta Y \le 2.5\text{pt}$) com preservação estrita do separador colunar ` | ` entre todas as células de tabelas e planilhas.
3. **CORR-03 (Ordenação X e Gutter de Tokens Curtos):** Clamping de largura segura (`effectiveWidth`) para tokens curtos (`01`, `02`, `UN`), garantindo que a distância horizontal até a próxima coluna não seja engolida e que itens fora de ordem no stream PDF sejam separados por ` | `.
4. **CORR-04 (Modo Exclusivo PDF sem Sobrescrita ZIP):** Resolução canônica de caminhos (`resolveOutputPaths`), isolamento de DOCX temporário (`__tmp_*.docx`) removido confiavelmente após compilação e eliminação definitiva de extensões duplicadas (`.pdf.pdf`).
5. **CORR-05 (Liberação Determinística Word COM e Resiliência contra File Locks):** Liberação de handles COM (`$doc` e `$word`) no script PowerShell com `ReleaseComObject` e `GC::WaitForPendingFinalizers`, acompanhado de rotina de remoção com retries e backoff (`safeUnlink`) contra locks temporários no Windows.

### Recursos Consolidados das Versões Anteriores (`v0.9.0` e `v0.9.5`)
- **Pipeline Híbrido DOCX $\rightarrow$ PDF (`src/utils/pdf_exporter.ts`):** Tier 1 (Word COM alta fidelidade) e Tier 2 (Pure-JS standalone `pdf-lib` + `jszip`).
- **Suporte a `outputFormat: "docx" | "pdf" | "both"`** em `fill_docx_template` e `generate_audit_docx`.
- **Reconstrução Espacial de Tabelas e Colunas (`Y-Axis Line Grouping`):** Agrupa texto por coordenadas verticais ($y$) e ordena por ($x$), separando colunas por ` | `.
- **Dossiê Executivo de Hotspots (`state/dossie_hotspots_<stem>.md`):** Recorte cirúrgico de $\pm 12$ linhas nas 14 Zonas de Impugnação (`Z1` a `Z14`).
- **Detector de Páginas Escaneadas (`Scanned PDF Trap`):** Detecção de páginas sem OCR / escaneadas como imagem.
- **Índice Cartográfico Mestre Unificado (`state/indice_mestre_caso.md`):** Consolidação multipeça no `bootstrap_case`.

---

## 3. Autodescoberta, Cache Global e Recursos de Resiliência

O servidor MCP é **100% autodescritivo, autoexplicativo e dotado de inteligência estrutural nativa**:

1. **Rastreabilidade de Versão em Todos os Retornos (`v1.1.0`):** Inclusão mandatória do campo `"engine_version": "1.1.0"` na raiz do payload JSON sintético retornado por todas as 5 ferramentas MCP.
2. **Teto Estrito de Payload MCP ($< 1024$ bytes com margem segura $< 900$ bytes):** Todo retorno de ferramenta via stdio MCP é um JSON sintético conciso, referenciando arquivos detalhados gravados em disco (`state/`).
3. **Resiliência de Diretórios e Zero ENOENT:** Criação recursiva de pastas (`mkdirSync(..., { recursive: true })`) em todas as ferramentas que gravam arquivos (`build_docx_template`, `fill_docx_template`, `generate_audit_docx`, `inspect_doc`, `bootstrap_case`).
4. **Motor Híbrido de Lista Multinível Nativa (`v0.7.0`):**
   - **Fora de tabelas (`<w:body>`):** Cria ou atualiza `word/numbering.xml` com definição multinível de 9 níveis decimais escalonados (`%1.`, `%1.%2.`, `%1.%2.%3.`), insere `<w:pPr><w:numPr>` com `<w:startOverride>` sincronizado com o capítulo pai e limpa o prefixo numérico literal do `<w:t>`.
   - **Dentro de tabelas (`<w:tc>`):** Aplica *Hanging Indent* estático (`<w:ind w:left w:hanging>` + `<w:tabs>`) separando o marcador numérico literal com `<w:r><w:tab/></w:r>`.
5. **Sanitização de Tags JS e Validação Léxica Precoce:**
   - Auto-normaliza acessos numéricos por ponto (`{{itens.0.qtd}}` $\rightarrow$ `{{itens[0].qtd}}`).
   - Valida precocemente no `build_docx_template` barrando identificadores com hífen ou dígitos iniciais com *Exact Copy-Paste Error*.
   - Desaninha (*unflatten*) chaves planas como `"itens.0.qtd": "10"` em arrays de objetos compatíveis.
6. **Rastreabilidade Temporal do Cache & Retrocompatibilidade Estrita:** Persiste e expõe `created_at`, `updated_at`, `age_days`, `cache_date_status`, `engine_version` e `slots_count` no cache global (`core/registry/templates/`), preservando o `created_at` original em atualizações.
7. **Padrão Exact Copy-Paste Error:** Validação fail-fast estrita em `slots_manifest.json` e `relatorio_auditoria.json`. Em caso de erro de contrato ou `applied_slots_count === 0`, o motor interrompe a execução com a instrução mandatória:
   > *"NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:"*
   acompanhada do snippet JSON canônico completo e pronto para copiar e colar.
8. **Exportação de Especificação Técnica Integral (`--dump-spec`):** Exporta a especificação técnica integral do motor em Markdown (UTF-8) para alinhamento instantâneo com agentes consumidores.
9. **Radar das 14 Zonas de Impugnação (`Z1` a `Z14`):** Varre as linhas de `.pdf` e `.docx` identificando atestados, prazos, garantias, marcas exclusivas, datasheets direcionados, métricas, orçamentos e cruzamento multipeça.
10. **Auto-Inspeção Integrada no Preenchimento:** O `fill_docx_template` executa automaticamente a inspeção estrutural pós-compilação gravando `state/inspecao_<stem>.json` e `state/visao_auditoria_<stem>.md`, dispensando rodar `inspect_doc` novamente.
11. **Auditoria Matemática de Planilhas Orçamentárias (`v1.1.0`):** Realiza a checagem aritmética exata em centavos inteiros ($Qtd \times Unit = Total$, subtotais e total geral) e o cruzamento com menções textuais de valor global no Radar `Z10`/`Z12`, persistindo `state/auditoria_orcamentaria_<stem>.json`.
12. **Diff Estrutural e Semântico Multi-Versão (`v1.1.0`):** Compara versões sucessivas de documentos através do parâmetro `compareWithPath` no `inspect_doc` ou da flag `--diff` na CLI, computando seções adicionadas/removidas/modificadas (com inline diff) e o delta de zonas de risco (`INTRODUCED`, `RESOLVED`, `RETAINED`) em `state/diff_documental_<stem>.md`.

---

## 4. Ciclo de Vida do Caso: 6 Ferramentas Integradas

O motor opera em dois modos (Servidor MCP por padrão ou CLI via flags), disponibilizando as **6 ferramentas fundamentais**:

### A) Modo Servidor MCP (Padrão / `--mcp`)

Ao ser executado **sem argumentos** (ou com `--mcp`), o binário inicia um servidor MCP sobre `stdio` expondo as seguintes ferramentas:

1. **`bootstrap_case`**
   - Cria a estrutura de diretórios do caso (`inputs/`, `state/`, `templates/`, `output/`), preserva nomes legíveis ou auto-batiza anexos opacos (`media_*`), infere extensões via magic bytes, aceita `fileRenameMap`.
   - Copia de forma síncrona imediata os modelos `.docx` e documentos `.pdf` de `uploadsDir` para `inputs/`, extrai seus mapas estruturais (`state/estrutura_<nome>.json`), gera a **Visão Linear de Auditoria** (`state/visao_auditoria_<nome>.md`), o **Dossiê de Hotspots** (`state/dossie_hotspots_<nome>.md`), o relatório de **Auditoria Orçamentária** (`state/auditoria_orcamentaria_<nome>.json`, se houver tabelas de itens) e o **Índice Mestre do Caso** (`state/indice_mestre_caso.md`).
   - Parâmetros: `caseDir` (*obrigatório*), `uploadsDir` (*opcional*), `fileRenameMap` (*opcional*).

2. **`inspect_doc`**
   - Realiza a engenharia reversa de arquivos `.docx` ou `.pdf`.
   - **Para PDF:** Extrai todas as páginas, numera linhas com coordenada dupla `[PAG_XXX | LYYYY]`, reconstrói colunas com ` | `, constrói a Cartografia Estrutural em 3 camadas e o Radar das 14 Zonas (`Z1` a `Z14`), gerando `state/estrutura_<stem>.json`, `state/visao_auditoria_<stem>.md` e `state/dossie_hotspots_<stem>.md`.
   - **Para DOCX:** Mapeia parágrafos, tabelas, constrói `toc_map`, calcula `structure_fingerprint`, busca no Cache Global e gera `state/visao_auditoria_<stem>.md`.
   - **Auditoria Orçamentária Automática:** Realiza checagem determinística em centavos de preços e quantitativos, alimentando o Radar Z10/Z12 e gerando `state/auditoria_orcamentaria_<stem>.json`.
   - **Diff Multi-Versão (`compareWithPath`):** Quando fornecido caminho de documento anterior/retificado, calcula as divergências textuais e estruturais com delta das 14 zonas em `state/diff_documental_<stem>.md` e `.json`.
   - Parâmetros: `filePath` (*obrigatório*, com alias retrocompatível `docxPath`), `compareWithPath` (*opcional*), `outputPath` (*opcional*), `compact` (*opcional*).

3. **`build_docx_template`**
   - Transforma um `.docx` bruto (sem tags) em um template parametrizado com tags `{{...}}` a partir de um arquivo `slots_manifest.json`, preservando 100% da formatação visual (`<w:pPr>`, `<w:rPr>`, estilos, cabeçalhos e tabelas).
   - Valida fail-fast com *Exact Copy-Paste Error* contra propriedades inventadas ou `applied_slots_count === 0`.
   - Suporta `saveToRegistry: true` para homologar o template no Cache Global cross-órgão.
   - Parâmetros: `sourcePath`, `manifestPath`, `outputPath` (*obrigatórios*), `saveToRegistry` (*opcional*), `templateId` (*opcional*).

4. **`fill_docx_template`**
   - Preenche um template `.docx` parametrizado injetando os dados de um arquivo JSON de estado (`{{...}}`, loops `FOR`, condicionais `IF`, quebras `\n` em parágrafos reais, negrito `**...**` e listas hierárquicas multinível híbridas).
   - **Exportação Híbrida para PDF (v0.9.5 / v1.0.0):** Suporta `outputFormat: "docx" | "pdf" | "both"`. Em modo `"pdf"`, converte via Word COM ou Pure-JS e auto-inspeciona o PDF gerado.
   - Executa **auto-inspeção integrada**, gravando `state/inspecao_<stem>.json` e `state/visao_auditoria_<stem>.md`.
   - Parâmetros: `templatePath`, `statePath`, `outputPath` (*obrigatórios*), `autoInspect` (*opcional*), `outputFormat` (*opcional*).

5. **`generate_audit_docx`**
   - Gera um Parecer de Auditoria Técnico-Jurídica em layout editorial vertical corrido (folha A4 retrato, **zero tabelas** `<w:tbl>`, 100% da largura útil da página), com fichas individualizadas e transcrições literais de evidências.
   - **Exportação para PDF (v0.9.5 / v1.0.0):** Suporta `outputFormat: "docx" | "pdf" | "both"`.
   - Parâmetros: `auditJsonPath`, `outputPath` (*obrigatórios*), `outputFormat` (*opcional*).

6. **`generate_technical_note_docx`**
   - Gera Nota Técnica Comparativa de Evolução Documental ('Antes vs. Depois', Marco 6) em Word (`.docx`) e PDF em layout editorial vertical corrido (folha A4 retrato, **zero tabelas** `<w:tbl>`, 100% largura útil), com destaque visual colorido por cards com bordas laterais (verde para inclusão, vermelho para supressão, azul para alteração), diff granular inline em nível de token e fundamentação técnica/jurídica individualizada por cláusula alterada.
   - **Modos Híbridos:** Suporta modo direto via `noteJsonPath` ou modo comparativo automático derivado a partir de `oldPath` e `newPath` (com enriquecimento opcional de justificativas via `noteJsonPath`).
   - **Exportação para PDF:** Suporta `outputFormat: "docx" | "pdf" | "both"`.
   - Parâmetros: `outputPath` (*obrigatório*), `noteJsonPath` (*opcional se oldPath/newPath fornecidos*), `oldPath` (*opcional*), `newPath` (*opcional*), `outputFormat` (*opcional*).

---

### B) Modo CLI (Linha de Comando)

```powershell
# 1. Inicializar pasta do caso, copiar uploads e inspecionar documentos (.docx e .pdf)
./docgov-engine --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded

# Com mapeamento explícito de nomes de arquivos
./docgov-engine --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded --rename-map '{"media_1792069974647_14a93b9d": "Edital_Pregao.pdf"}'

# 2. Inspecionar estrutura de um arquivo (.docx ou .pdf) gerando Cartografia, Radar Z1..Z14, Auditoria Orçamentária e Dossiê
./docgov-engine --inspect edital_licitacao.pdf --out state/estrutura_edital.json
./docgov-engine --inspect modelo_etp.docx --out state/estrutura_etp.json --compact

# Inspecionar comparando com versão anterior (Diff Estrutural e Semântico Multi-Versão)
./docgov-engine --inspect edital_v2.pdf --diff edital_v1.pdf

# 2. Inspecionar estrutura de um arquivo (.docx ou .pdf) gerando Cartografia, Radar Z1..Z14 e Dossiê de Hotspots
./docgov-engine --inspect edital_licitacao.pdf --out state/estrutura_edital.json
./docgov-engine --inspect modelo_etp.docx --out state/estrutura_etp.json --compact

# 3. Construir template parametrizado a partir de um .docx bruto + slots_manifest.json
./docgov-engine --build-template --source modelo_etp.docx --manifest slots_manifest.json --out template.docx --save-to-registry --template-id etp_padrao_v1

# 4. Preencher template com o JSON de estado (gerando .docx e/ou .pdf)
./docgov-engine --inject --template template.docx --state estado_caso.json --out minuta_final.docx
./docgov-engine --inject --template template.docx --state estado_caso.json --out minuta_final.docx --format both
./docgov-engine --inject --template template.docx --state estado_caso.json --out minuta_final.pdf --format pdf

# 5. Gerar Parecer de Auditoria em Word (.docx) ou PDF a partir do JSON de auditoria
./docgov-engine --generate-audit-docx --audit-json state/relatorio_auditoria.json --out output/Relatorio_Auditoria_ETP.docx
./docgov-engine --generate-audit-docx --audit-json state/relatorio_auditoria.json --out output/Relatorio_Auditoria_ETP.pdf --format pdf

# 6. Gerar Nota Técnica Comparativa de Evolução de Cláusulas (Marco 6)
# 6a. Comparando arquivos diretamente (DOCX ou PDF)
./docgov-engine --diff-report --old inputs/minuta_v1.docx --new inputs/minuta_v2.docx --out output/Nota_Tecnica.docx --format both
# 6b. A partir de JSON estruturado de nota técnica
./docgov-engine --generate-technical-note --note-json state/nota_tecnica.json --out output/Nota_Tecnica.docx --format pdf

# 7. Exportar especificação técnica normativa em Markdown
./docgov-engine --dump-spec especificacao_motor.md

# 8. Verificar / Atualizar o próprio binário
./docgov-engine --check-update
./docgov-engine --update
./docgov-engine --force-update

# Verificar a versão instalada e exibir ajuda
./docgov-engine -v
./docgov-engine -h
```

| Parâmetro | Descrição |
| :--- | :--- |
| *(sem argumentos)* ou `--mcp` | Inicia o servidor MCP via `stdio` (comportamento padrão). |
| `--dump-spec [caminho.md]` | Exporta a especificação técnica integral do motor em Markdown (UTF-8). |
| `--bootstrap-case` | Cria `inputs/`, `state/`, `templates/`, `output/` em `--case-dir`, copia e inspeciona `.docx` e `.pdf` imediatamente, gerando a Cartografia, o Radar Z1..Z14, o Dossiê de Hotspots e o Índice Mestre. |
| `--wait` | Aguarda a conclusão da cópia dos arquivos pesados em segundo plano no `--bootstrap-case`. |
| `--inspect <arq.docx\|.pdf>` | Extrai mapa estrutural (`state/estrutura_<stem>.json`), gera `state/visao_auditoria_<stem>.md`, `state/dossie_hotspots_<stem>.md`, executa auditoria orçamentária e busca no Cache Global. |
| `--diff <caminho>` | Compara o documento inspecionado com versão anterior/retificada gerando `state/diff_documental_<stem>.md` e `.json` (usado com `--inspect`). |
| `--compact` | Filtra parágrafos e células vazias no `--inspect` preservando os índices originais 0-based. |
| `--build-template` | Gera um template `.docx` parametrizado a partir de `--source`, `--manifest` e `--out`. |
| `--save-to-registry` | Persiste o manifesto homologado no Cache Global de templates (`core/registry/templates/`). |
| `--template-id <id>` | Identificador semântico customizado do template ao salvar no registro (opcional). |
| `--inject` | Preenche um template `.docx` a partir de `--template`, `--state` e `--out`. |
| `--generate-audit-docx` | Gera um parecer de auditoria executivo a partir de `--audit-json` e `--out`. |
| `--diff-report` | Orquestra a geração de Nota Técnica Comparativa a partir de `--old` e `--new` para `--out`. |
| `--generate-technical-note` | Gera a Nota Técnica Comparativa a partir de `--note-json` e `--out`. |
| `--old <caminho>` | Caminho do documento base/anterior (.docx, .pdf ou .json) usado com `--diff-report`. |
| `--new <caminho>` | Caminho do documento revisado/novo (.docx, .pdf ou .json) usado com `--diff-report`. |
| `--note-json <caminho>` | Caminho do arquivo `nota_tecnica.json` (usado com `--generate-technical-note`). |
| `--data <caminho>` | Caminho de dados adicionais/justificativas JSON para enriquecer o `--diff-report` (opcional). |
| `--format <docx\|pdf\|both>` | Seleciona o formato de saída nos comandos `--inject`, `--generate-audit-docx`, `--diff-report` e `--generate-technical-note` (padrão: `docx`). |
| `--case-dir <dir>` | Caminho da pasta do caso (usado com `--bootstrap-case`). |
| `--uploads-dir <dir>` | Caminho opcional da pasta `.user_uploaded` (usado com `--bootstrap-case`). |
| `--audit-json <caminho>` | Caminho do arquivo `relatorio_auditoria.json` (usado com `--generate-audit-docx`). |
| `--source <caminho>` | Caminho do `.docx` bruto original (usado com `--build-template` ou `--inspect`). |
| `--manifest <caminho>` | Caminho do arquivo `slots_manifest.json` (usado com `--build-template`). |
| `--template <caminho>` | Caminho do arquivo modelo `.docx` de entrada (usado com `--inject`). |
| `--state <caminho>` | Caminho do arquivo `.json` contendo os dados a serem injetados (usado com `--inject`). |
| `--out <caminho>` | Caminho do arquivo de saída. |
| `--check-update` | Consulta o GitHub Releases e informa se há uma nova versão disponível. |
| `-u`, `--update` | Atualiza o próprio binário para a versão mais recente. |
| `--force-update` | Força o download e substituição do binário pela última release publicada. |
| `-v`, `--version` | Exibe a versão atual do binário (`docgov-engine vX.Y.Z`). |
| `-h`, `--help` | Exibe o resumo de uso e parâmetros disponíveis. |

---

## 5. Estrutura do `slots_manifest.json` (`build_docx_template`)

O motor suporta tanto a **notação compacta universal** (baseada nas coordenadas do `toc_map` e `visao_auditoria.md`) quanto a **notação canônica verbosa**, sempre com nomes de variáveis em `snake_case` e suporte automático a acessos indexados (`itens[0].qtd`):

### A) Notação Compacta Universal (Recomendada)
```json
{
  "slots": [
    { "coord": "P3", "tag": "{{estudo.descricao_necessidade}}" },
    { "coord": "T0.R0.C1", "tag": "{{metadados.unidade_requisitante}}" },
    { "coord": "T1.R1.C1", "tag": "{{itens[0].descricao}}: {{itens[0].qtd}} unidades" },
    { "coord": "P12-P14", "tag": "{{estudo.justificativa}}" },
    { "find": "Texto Antigo Fixo", "replace": "{{metadados.orgao}}" }
  ]
}
```
> **Dica:** Aceita coordenadas com ou sem colchetes (`"T0.R0.C1"` ou `"[T0.R0.C1]"`), ranges de parágrafo (`"P12-P14"`), aliases (`col_index`, `paragraph_index`), auto-conversão de `itens.0.qtd` para `itens[0].qtd` e array puro na raiz `[ { "coord": "...", "tag": "..." } ]`.

### B) Notação Canônica Detalhada
```json
{
  "replace_paragraphs": [
    {
      "start_p": 3,
      "end_p": 5,
      "tag": "{{estudo.descricao_necessidade}}"
    }
  ],
  "replace_table_cells": [
    {
      "table_index": 0,
      "row_index": 0,
      "cell_index": 1,
      "tag": "{{metadados.unidade_requisitante}}"
    },
    {
      "table_index": 1,
      "row_index": 1,
      "cell_index": 1,
      "tag": "{{itens[0].descricao}}: {{itens[0].qtd}}"
    }
  ],
  "loop_table_rows": [
    {
      "table_index": 1,
      "header_row_index": 0,
      "template_row_index": 1,
      "remove_from_row": 2,
      "remove_to_row": 6,
      "for_open_tag": "{{FOR r IN gestao_riscos}}",
      "for_close_tag": "{{END-FOR r}}",
      "cell_tags": ["{{$r.risco}}", "{{$r.mitigacao}}"]
    }
  ],
  "replace_inline": [
    {
      "find": "Texto Antigo Fixo",
      "replace": "{{metadados.orgao}}"
    }
  ]
}
```

---

## 6. Configuração nos Principais Agentes MCP

Como o modo MCP é o padrão quando nenhum argumento é passado, basta apontar para o executável:

### Google Antigravity (AGY)
Edite `~/.gemini/config/mcp_config.json` (ou acesse **Additional Options (...) > MCP Servers**):
```json
{
  "mcpServers": {
    "docgov": {
      "command": "C:/caminho/para/docgov-engine.exe",
      "args": []
    }
  }
}
```

### Claude Code (CLI)
```powershell
# Windows
claude mcp add docgov -- "C:\caminho\para\docgov-engine.exe"

# Linux / macOS
claude mcp add docgov -- "/caminho/para/docgov-engine"
```

### Claude Desktop / Cursor / Windsurf
No arquivo `claude_desktop_config.json`, `.cursor/mcp.json` ou `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "docgov": {
      "command": "C:/caminho/para/docgov-engine.exe",
      "args": []
    }
  }
}
```

---

## 7. Desenvolvimento, Testes e Governança

Requer [Bun](https://bun.sh/) instalado:

```bash
# Instalar dependências
bun install

# Executar suíte completa de testes unitários e E2E
bun test

# Executar suítes específicas por domínio
bun test test/pdf_exporter.test.ts  # Testes do Pipeline Híbrido DOCX -> PDF (Word COM e Pure-JS)
bun test test/engine.test.ts        # Testes E2E (PDF, Cartografia, Radar Z1..Z14 e binário standalone)
bun test test/bootstrap.test.ts     # Ingestão de pastas, salvaguarda, magic bytes e determinismo
bun test test/inspect.test.ts       # Engenharia reversa estrutural, toc_map e visão linear
bun test test/build_template.test.ts# Parametrização OpenXML e validação fail-fast
bun test test/fill_template.test.ts # Injeção de dados, exportação para PDF e auto-inspeção
bun test test/audit.test.ts         # Parecer de auditoria vertical A4 e exportação para PDF
bun test test/registry.test.ts      # Cache global, matching 1-para-N e rastreabilidade temporal
bun test test/mcp_spec.test.ts      # Self-Discovery, --dump-spec e barrel
bun test test/utils.test.ts         # Parsers de JSON, naming e updater

# Consolidação Completa de Build, Checksums e Self-Discovery (Recomendado)
bun run build:all        # Compila Linux e Windows, normaliza nomes canônicos, gera SHA256SUMS.txt e atualiza spec
bun run build            # Atalho equivalente a build:all
bun run dump:spec        # Regenera diretamente docs/especificacao_motor.md (--dump-spec)

# Compilar binários individuais (opcional)
bun run build:windows
bun run build:linux
```

> ℹ️ **Nota de Distribuição & Release:** Os comandos locais `bun run build:all` e `bun run build:*` destinam-se a desenvolvimento local e execução de smoke tests. A compilação oficial multi-plataforma (`ubuntu-24.04` e `windows-latest`), o cálculo de checksums (`SHA256SUMS.txt`) e a publicação de releases são **100% automatizados pela esteira externa de CI/CD** ao receber o push de tags `v*`.

### Estatuto de Governança (`AGENTS.md`)
O motor é governado pelas **8 Leis Invioláveis de Engenharia**:
1. Runtime e testes padronizados via Bun (`bun test`).
2. Teto estrito de payload MCP ($< 1024$ bytes UTF-8, com margem de segurança $< 920$ bytes).
3. Padrão Exact Copy-Paste Error (Zero Silent No-Op e Fail-Fast estrito).
4. Sincronia obrigatória de Self-Discovery (`--dump-spec`, `DOCX_ENGINE_INSTRUCTIONS`, etc.).
5. Neutralidade institucional absoluta (zero menções a localidades ou órgãos específicos).
6. Resiliência de caminhos e cache global (`core/registry/templates/`).
7. Ritual de qualidade e release automatizada via pipeline externo (autodescoberta de CI/CD, gatilho exclusivo por tag Git e proibição estrita de upload manual de binários locais).
8. Disciplina autônoma de micro-commits atômicos, reversibilidade e memória evolutiva (`CHANGELOG.md` & `ROADMAP.md`).
