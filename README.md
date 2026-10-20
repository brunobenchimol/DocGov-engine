# docgov-docx-engine — Motor Standalone `.docx` / `.pdf` & Servidor MCP (`v0.9.5`)

Motor unificado para o **ciclo completo de documentos Microsoft Word (`.docx`) e engenharia reversa/cartografia/auditoria determinística de Editais, Termos de Referência e anexos em PDF (`.pdf`)**, além de servidor **Model Context Protocol (MCP)** via `stdio`, projetado para o ecossistema **DocGov** e compatível com qualquer agente de IA (Google Antigravity, Claude Code, Claude Desktop, Cursor, VS Code Copilot e Windsurf).

Compilado em **binário standalone** (Windows `x64` e Linux `x64`) via Bun — não requer Node.js, Bun ou interpretadores externos instalados na máquina do usuário final.

---

## 1. Download Rápido e Auto-Atualização

### Windows (PowerShell)
```powershell
curl.exe -fL "https://github.com/brunobenchimol/docgov-docx-engine/releases/latest/download/docgov-docx-windows-x64.exe" -o docgov-docx.exe
.\docgov-docx.exe -v
```

### Linux / WSL (Bash)
```bash
curl -fL "https://github.com/brunobenchimol/docgov-docx-engine/releases/latest/download/docgov-docx-linux-x64" -o docgov-docx
chmod +x docgov-docx
./docgov-docx -v
```

### Auto-Atualização do Binário (`Self-Update`)
Depois de baixado pela primeira vez, o próprio binário consegue verificar novas releases no GitHub e atualizar a si mesmo:
```powershell
# Verificar se há uma nova versão disponível
./docgov-docx --check-update

# Atualizar automaticamente para a versão mais recente (se houver)
./docgov-docx --update

# Forçar download e reinstalação da última release
./docgov-docx --force-update
```

---

## 2. Destaques da Versão `v0.9.5` (Marco 2) e `v0.9.0` (Marco 1)

As versões `v0.9.0` e `v0.9.5` consolidam o motor tanto para **auditoria profunda e leitura de PDFs complexos** quanto para **geração e exportação de alta fidelidade visual para PDF**:

### Novidades da `v0.9.5` — Exportação Híbrida DOCX $\rightarrow$ PDF e Relatórios
1. **Pipeline Híbrido de Conversão DOCX para PDF (`src/utils/pdf_exporter.ts`):**
   - **Tier 1 (Fidelidade Máxima via MS Word COM):** Automação silenciosa via PowerShell/COM (`SaveAs2` com `wdFormatPDF = 17`) no Windows e WSL Interop. Preserva 100% da fidelidade visual original do Microsoft Word (brasões, cabeçalhos, tabelas, formatações complexas e numeração nativa de `numbering.xml`).
   - **Tier 2 (Fallback Standalone Pure-JS Determinístico):** Renderizador vetorial nativo em puro TypeScript (`pdf-lib` + `@xmldom/xmldom` + `jszip`). Converte parágrafos, cabeçalhos e tabelas OpenXML para PDF sem exigir Word, LibreOffice ou qualquer dependência de sistema operacional externa.
2. **Suporte a `outputFormat` nas Ferramentas de Saída:**
   - `fill_docx_template` aceita `outputFormat: "docx" | "pdf" | "both"`. Quando `"pdf"` ou `"both"` é solicitado, entrega `output/<arquivo>.pdf` pronto e validado (`%PDF-`).
   - `generate_audit_docx` aceita `outputFormat: "docx" | "pdf" | "both"`, emitindo pareceres técnicos de auditoria diretamente em PDF.
   - Quando `outputFormat: "pdf"` é usado no `fill_docx_template`, o motor executa **auto-inspeção diretamente no arquivo PDF gerado**.
3. **Integração na CLI com `--format`:**
   - Adicionada a flag `--format <docx|pdf|both>` (ou `-f`) para comandos `--inject` e `--generate-audit-docx`.
4. **Determinismo Universal de Sistema de Arquivos:**
   - Todas as leituras de diretórios (`uploadsDir`, `inputsDir` e cache global) possuem ordenação alfabética determinística (`readdirSync().sort()`), garantindo comportamento 100% idêntico entre Linux (ext4), Windows (NTFS) e macOS.

### Recursos Consolidados da `v0.9.0` — Leitura Avançada de PDF e Multi-Documento
1. **Reconstrução Espacial de Tabelas e Colunas (`Y-Axis Line Grouping`):**
   - Agrupa itens de texto pela coordenada vertical `(y)` com tolerância de 2.5pt e ordena horizontalmente por `(x)`, separando colunas distintas com ` | ` (estilo Markdown).
   - Impede que tabelas orçamentárias (`Item | Descrição | Unid | Qtd | Valor`) ou *datasheets* técnicos fiquem fragmentados em linhas soltas.
2. **Dossiê Executivo de Hotspots (`state/dossie_hotspots_<stem>.md`):**
   - Extrai automaticamente um dossiê cirúrgico contendo o mapa de títulos e **$\pm$12 linhas de contexto expandido** em torno de cada ocorrência das 14 Zonas de Impugnação (`Z1` a `Z14`) e áreas de densidade técnica, permitindo triagem de editais de 300 páginas em **1 único turno de leitura**.
3. **Detector de Páginas Escaneadas (`Scanned PDF Trap`):**
   - Avalia a densidade de texto por página. Caso haja páginas com $< 25$ caracteres extraíveis, retorna `scanned_pages_detected: [p1, p2, ...]` e insere alertas críticos na visão linear de auditoria.
4. **Índice Cartográfico Mestre Unificado (`state/indice_mestre_caso.md`):**
   - No `bootstrap_case`, se `inputs/` contiver múltiplos arquivos (ex.: `Edital.pdf` + `Termo_Referencia.pdf` + `Minuta.docx`), o motor consolida uma matriz cruzada indicando em qual documento e em qual página/linha cada zona (`Z1` a `Z14`) se manifesta.

---

## 3. Autodescoberta, Cache Global e Recursos de Resiliência

O servidor MCP é **100% autodescritivo, autoexplicativo e dotado de inteligência estrutural nativa**:

1. **Rastreabilidade de Versão em Todos os Retornos (`v0.9.5`):** Inclusão mandatória do campo `"engine_version": "0.9.5"` na raiz do payload JSON sintético retornado por todas as 5 ferramentas MCP.
2. **Teto Estrito de Payload MCP ($< 1024$ bytes):** Todo retorno de ferramenta via stdio MCP é um JSON sintético conciso, referenciando arquivos detalhados gravados em disco (`state/`).
3. **Resiliência de Diretórios e Zero ENOENT:** Criação recursiva de pastas (`mkdirSync(..., { recursive: true })`) em todas as ferramentas que gravam arquivos (`build_docx_template`, `fill_docx_template`, `generate_audit_docx`, `inspect_docx`, `bootstrap_case`).
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
9. **Radar das 14 Zonas de Impugnação (`Z1` a `Z14`):** Varre as linhas de `.pdf` e `.docx` identificando atestados, prazos, garantias, marcas exclusivas, datasheets direcionados, métricas e cruzamento multipeça.
10. **Auto-Inspeção Integrada no Preenchimento:** O `fill_docx_template` executa automaticamente a inspeção estrutural pós-compilação gravando `state/inspecao_<stem>.json` e `state/visao_auditoria_<stem>.md`, dispensando rodar `inspect_docx` novamente.

---

## 4. Ciclo de Vida do Caso: 5 Ferramentas Integradas

O motor opera em dois modos (Servidor MCP por padrão ou CLI via flags), disponibilizando as **5 ferramentas fundamentais**:

### A) Modo Servidor MCP (Padrão / `--mcp`)

Ao ser executado **sem argumentos** (ou com `--mcp`), o binário inicia um servidor MCP sobre `stdio` expondo as seguintes ferramentas:

1. **`bootstrap_case`**
   - Cria a estrutura de diretórios do caso (`inputs/`, `state/`, `templates/`, `output/`), preserva nomes legíveis ou auto-batiza anexos opacos (`media_*`), infere extensões via magic bytes, aceita `fileRenameMap`.
   - Copia de forma síncrona imediata os modelos `.docx` e documentos `.pdf` de `uploadsDir` para `inputs/`, extrai seus mapas estruturais (`state/estrutura_<nome>.json`), gera a **Visão Linear de Auditoria** (`state/visao_auditoria_<nome>.md`), o **Dossiê de Hotspots** (`state/dossie_hotspots_<nome>.md`) e o **Índice Mestre do Caso** (`state/indice_mestre_caso.md`).
   - Parâmetros: `caseDir` (*obrigatório*), `uploadsDir` (*opcional*), `fileRenameMap` (*opcional*).

2. **`inspect_docx`**
   - Realiza a engenharia reversa de arquivos `.docx` ou `.pdf`.
   - **Para PDF:** Extrai todas as páginas, numera linhas com coordenada dupla `[PAG_XXX | LYYYY]`, reconstrói colunas com ` | `, constrói a Cartografia Estrutural em 3 camadas e o Radar das 14 Zonas (`Z1` a `Z14`), gerando `state/estrutura_<stem>.json`, `state/visao_auditoria_<stem>.md` e `state/dossie_hotspots_<stem>.md`.
   - **Para DOCX:** Mapeia parágrafos, tabelas, constrói `toc_map`, calcula `structure_fingerprint`, busca no Cache Global e gera `state/visao_auditoria_<stem>.md`.
   - Parâmetros: `docxPath` (*obrigatório*), `outputPath` (*opcional*), `compact` (*opcional*).

3. **`build_docx_template`**
   - Transforma um `.docx` bruto (sem tags) em um template parametrizado com tags `{{...}}` a partir de um arquivo `slots_manifest.json`, preservando 100% da formatação visual (`<w:pPr>`, `<w:rPr>`, estilos, cabeçalhos e tabelas).
   - Valida fail-fast com *Exact Copy-Paste Error* contra propriedades inventadas ou `applied_slots_count === 0`.
   - Suporta `saveToRegistry: true` para homologar o template no Cache Global cross-órgão.
   - Parâmetros: `sourcePath`, `manifestPath`, `outputPath` (*obrigatórios*), `saveToRegistry` (*opcional*), `templateId` (*opcional*).

4. **`fill_docx_template`**
   - Preenche um template `.docx` parametrizado injetando os dados de um arquivo JSON de estado (`{{...}}`, loops `FOR`, condicionais `IF`, quebras `\n` em parágrafos reais, negrito `**...**` e listas hierárquicas multinível híbridas).
   - **Exportação Híbrida para PDF (v0.9.5):** Suporta `outputFormat: "docx" | "pdf" | "both"`. Em modo `"pdf"`, converte via Word COM ou Pure-JS e auto-inspeciona o PDF gerado.
   - Executa **auto-inspeção integrada**, gravando `state/inspecao_<stem>.json` e `state/visao_auditoria_<stem>.md`.
   - Parâmetros: `templatePath`, `statePath`, `outputPath` (*obrigatórios*), `autoInspect` (*opcional*), `outputFormat` (*opcional*).

5. **`generate_audit_docx`**
   - Gera um Parecer de Auditoria Técnico-Jurídica em layout editorial vertical corrido (folha A4 retrato, **zero tabelas** `<w:tbl>`, 100% da largura útil da página), com fichas individualizadas e transcrições literais de evidências.
   - **Exportação para PDF (v0.9.5):** Suporta `outputFormat: "docx" | "pdf" | "both"`.
   - Parâmetros: `auditJsonPath`, `outputPath` (*obrigatórios*), `outputFormat` (*opcional*).

---

### B) Modo CLI (Linha de Comando)

```powershell
# 1. Inicializar pasta do caso, copiar uploads e inspecionar documentos (.docx e .pdf)
./docgov-docx --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded

# Com mapeamento explícito de nomes de arquivos
./docgov-docx --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded --rename-map '{"media_1792069974647_14a93b9d": "Edital_Pregao.pdf"}'

# 2. Inspecionar estrutura de um arquivo (.docx ou .pdf) gerando Cartografia, Radar Z1..Z14 e Dossiê de Hotspots
./docgov-docx --inspect edital_licitacao.pdf --out state/estrutura_edital.json
./docgov-docx --inspect modelo_etp.docx --out state/estrutura_etp.json --compact

# 3. Construir template parametrizado a partir de um .docx bruto + slots_manifest.json
./docgov-docx --build-template --source modelo_etp.docx --manifest slots_manifest.json --out template.docx --save-to-registry --template-id etp_padrao_v1

# 4. Preencher template com o JSON de estado (gerando .docx e/ou .pdf)
./docgov-docx --inject --template template.docx --state estado_caso.json --out minuta_final.docx
./docgov-docx --inject --template template.docx --state estado_caso.json --out minuta_final.docx --format both
./docgov-docx --inject --template template.docx --state estado_caso.json --out minuta_final.pdf --format pdf

# 5. Gerar Parecer de Auditoria em Word (.docx) ou PDF a partir do JSON de auditoria
./docgov-docx --generate-audit-docx --audit-json state/relatorio_auditoria.json --out output/Relatorio_Auditoria_ETP.docx
./docgov-docx --generate-audit-docx --audit-json state/relatorio_auditoria.json --out output/Relatorio_Auditoria_ETP.pdf --format pdf

# 6. Exportar especificação técnica normativa em Markdown
./docgov-docx --dump-spec especificacao_motor.md

# 7. Verificar / Atualizar o próprio binário
./docgov-docx --check-update
./docgov-docx --update
./docgov-docx --force-update

# Verificar a versão instalada e exibir ajuda
./docgov-docx -v
./docgov-docx -h
```

| Parâmetro | Descrição |
| :--- | :--- |
| *(sem argumentos)* ou `--mcp` | Inicia o servidor MCP via `stdio` (comportamento padrão). |
| `--dump-spec [caminho.md]` | Exporta a especificação técnica integral do motor em Markdown (UTF-8). |
| `--bootstrap-case` | Cria `inputs/`, `state/`, `templates/`, `output/` em `--case-dir`, copia e inspeciona `.docx` e `.pdf` imediatamente, gerando a Cartografia, o Radar Z1..Z14, o Dossiê de Hotspots e o Índice Mestre. |
| `--wait` | Aguarda a conclusão da cópia dos arquivos pesados em segundo plano no `--bootstrap-case`. |
| `--inspect <arq.docx\|.pdf>` | Extrai mapa estrutural (`state/estrutura_<stem>.json`), gera `state/visao_auditoria_<stem>.md`, `state/dossie_hotspots_<stem>.md` e busca no Cache Global. |
| `--compact` | Filtra parágrafos e células vazias no `--inspect` preservando os índices originais 0-based. |
| `--build-template` | Gera um template `.docx` parametrizado a partir de `--source`, `--manifest` e `--out`. |
| `--save-to-registry` | Persiste o manifesto homologado no Cache Global de templates (`core/registry/templates/`). |
| `--template-id <id>` | Identificador semântico customizado do template ao salvar no registro (opcional). |
| `--inject` | Preenche um template `.docx` a partir de `--template`, `--state` e `--out`. |
| `--generate-audit-docx` | Gera um parecer de auditoria executivo a partir de `--audit-json` e `--out`. |
| `--format <docx\|pdf\|both>` | Seleciona o formato de saída nos comandos `--inject` e `--generate-audit-docx` (padrão: `docx`). |
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
| `-v`, `--version` | Exibe a versão atual do binário (`docgov-docx-engine vX.Y.Z`). |
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
    "docgov_docx": {
      "command": "C:/caminho/para/docgov-docx.exe",
      "args": []
    }
  }
}
```

### Claude Code (CLI)
```powershell
# Windows
claude mcp add docgov_docx -- "C:\caminho\para\docgov-docx.exe"

# Linux / macOS
claude mcp add docgov_docx -- "/caminho/para/docgov-docx"
```

### Claude Desktop / Cursor / Windsurf
No arquivo `claude_desktop_config.json`, `.cursor/mcp.json` ou `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "docgov_docx": {
      "command": "C:/caminho/para/docgov-docx.exe",
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

# Executar suíte completa de testes unitários e E2E (77 testes em 10 arquivos)
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

# Compilar binários standalone
bun run build:windows
bun run build:linux
```

### Estatuto de Governança (`AGENTS.md`)
O motor é governado pelas **7 Leis Invioláveis de Engenharia**:
1. Runtime e testes padronizados via Bun (`bun test`).
2. Teto estrito de payload MCP ($< 1024$ bytes UTF-8).
3. Padrão Exact Copy-Paste Error (Zero Silent No-Op e Fail-Fast estrito).
4. Sincronia obrigatória de Self-Discovery (`--dump-spec`, `DOCX_ENGINE_INSTRUCTIONS`, etc.).
5. Neutralidade institucional absoluta (zero menções a localidades ou órgãos específicos).
6. Resiliência de caminhos e cache global (`core/registry/templates/`).
7. Ritual de qualidade e release (SemVer, 100% testes aprovados, tag anotada `vX.Y.Z`).
