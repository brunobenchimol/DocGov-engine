# docgov-docx-engine — Motor Standalone `.docx` & Servidor MCP (`v0.3.3`)

Motor unificado para o **ciclo completo de documentos Microsoft Word (`.docx`)** e servidor **Model Context Protocol (MCP)** via `stdio`, projetado para o ecossistema **DocGov** e compatível com qualquer agente de IA (Google Antigravity, Claude Code, Claude Desktop, Cursor, VS Code Copilot e Windsurf).

Compilado em **binário standalone** (Windows `x64` e Linux `x64`) via Bun — não requer Node.js ou Bun instalado na máquina do usuário final.

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

## 2. Ciclo de Vida `.docx`: 5 Operações Integradas

O motor opera em dois modos (Servidor MCP por padrão ou CLI via flags), disponibilizando as **5 operações fundamentais**:

### A) Modo Servidor MCP (Padrão / `--mcp`)

Ao ser executado **sem argumentos** (ou com `--mcp`), o binário sobe um servidor MCP sobre `stdio` expondo **5 ferramentas**:

1. **`bootstrap_case`**
   - Cria a estrutura de diretórios do caso (`inputs/`, `state/`, `output/`), copia de forma síncrona imediata os modelos `.docx` de `uploadsDir` para `inputs/` e extrai seus mapas estruturais (`state/estrutura_<nome>.json`).
   - **Salvaguarda Assíncrona Não-Bloqueante:** Arquivos volumosos (`.pdf` e outros anexos pesados) têm a salvaguarda para `inputs/` iniciada em segundo plano sem congelar a chamada MCP ou CLI (evita timeouts e contenção de I/O em pastas sincronizadas na nuvem como Google Drive). O progresso da salvaguarda pode ser monitorado em `state/salvaguarda_status.json` (`in_progress`, `completed`, `partial_error`).
   - **Retorno Sintético Executivo (< 1 KB — `v0.3.3`):** Para economizar contexto e eliminar desvios por arquivos de log (`output.txt`), o retorno MCP devolve estritamente um JSON conciso com contadores (`tables_count`, `paragraphs_count`), referências em disco (`structure_json`) e status da salvaguarda (`background_copy`).
   - Parâmetros: `caseDir` (*obrigatório*), `uploadsDir` (*opcional*).

2. **`inspect_docx`**
   - Faz a engenharia reversa estrutural de qualquer `.docx` bruto (headers, footers, parágrafos indexados `0..N` e tabelas indexadas `0..M`).
   - **Persistência em Disco e Retorno Sintético (< 1 KB — `v0.3.3`):** O mapa estrutural detalhado é salvo no arquivo `outputPath` indicado (ou automaticamente em `<docx>_estrutura.json` caso omitido), enquanto a chamada MCP devolve apenas o sumário executivo conciso (`status`, `docxPath`, `outputPath`, `tables`, `rows`, `paragraphs`), evitando transferências volumosas (> 46 KB) de texto bruto.
   - Parâmetros: `docxPath` (*obrigatório*), `outputPath` (*opcional*), `compact` (*opcional*).

3. **`build_docx_template`**
   - Transforma um `.docx` bruto (sem tags) em um template parametrizado com tags `{{...}}` a partir de um arquivo `slots_manifest.json`, preservando 100% da formatação visual (`<w:pPr>`, `<w:rPr>` de corpo sem herança indevida de negrito de subtítulos, `<w:tblPr>`, cabeçalhos, rodapés e imagens).
   - Parâmetros: `sourcePath`, `manifestPath`, `outputPath` (*todos obrigatórios*).

4. **`fill_docx_template`**
   - Preenche um template `.docx` parametrizado injetando os dados de um arquivo JSON de estado (`{{...}}`, loops `FOR` em tabelas, conversão automática de `\n` em parágrafos `<w:p>` reais, negrito seletivo via `**texto**` e suporte nativo a **listas hierárquicas aninhadas em múltiplos níveis** como `1.1`, `1.1.1`, `1.1.1.1`, `1.1.1.1.1` com recuo `<w:ind>` progressivo e achatamento recursivo de árvores JSON `subitens`).
   - Parâmetros: `templatePath`, `statePath`, `outputPath` (*todos obrigatórios*).

5. **`generate_audit_docx`**
   - Gera nativamente um Parecer de Auditoria Técnico-Jurídica em Word (`.docx`) em layout editorial vertical corrido (folha A4 retrato, **zero tabelas** `<w:tbl>`, 100% da largura útil da página), sanitizando automaticamente crases Markdown, coordenadas de máquina (`[T0:...]`) e códigos de enum (`V1..V6`), e renderizando fichas verticais completas com múltiplos trechos transcritos (`trechos_documento`) em blocos de citação recuados.
   - Parâmetros: `auditJsonPath`, `outputPath` (*todos obrigatórios*).

---

### B) Modo CLI (Linha de Comando)

```powershell
# 1. Inicializar pasta do caso, copiar uploads e inspecionar modelos .docx (não-bloqueante para PDFs)
./docgov-docx --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded

# Opcional: aguardar cópia de PDFs em segundo plano antes de encerrar o comando
./docgov-docx --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded --wait

# 2. Inspecionar estrutura de um .docx bruto (opcionalmente com --compact)
./docgov-docx --inspect documento_bruto.docx --out estrutura.json --compact

# 3. Construir template parametrizado a partir de um .docx bruto + manifesto de slots
./docgov-docx --build-template --source documento_bruto.docx --manifest slots_manifest.json --out template.docx

# 4. Preencher template com o JSON de estado do processo
./docgov-docx --inject --template template.docx --state estado_caso.json --out minuta_final.docx

# 5. Gerar Relatório de Auditoria em Word (.docx) a partir do JSON de auditoria
./docgov-docx --generate-audit-docx --audit-json state/relatorio_auditoria.json --out output/Relatorio_Auditoria_ETP.docx

# 6. Verificar / Atualizar o próprio binário
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
| `--bootstrap-case` | Cria `inputs/`, `state/`, `output/` em `--case-dir`, copia e inspeciona `.docx` imediatamente e inicia salvaguarda de PDFs em background. |
| `--wait` | Aguarda a conclusão da cópia dos arquivos em segundo plano no `--bootstrap-case` antes de encerrar o CLI. |
| `--inspect <arq.docx>` | Extrai o mapa estrutural JSON (cabeçalhos, rodapés, parágrafos e tabelas) do `.docx`. |
| `--compact` | Filtra parágrafos e células vazias no `--inspect` preservando os índices originais 0-based. |
| `--build-template` | Gera um template `.docx` parametrizado a partir de `--source`, `--manifest` e `--out`. |
| `--inject` | Preenche um template `.docx` a partir de `--template`, `--state` e `--out`. |
| `--generate-audit-docx` | Gera um parecer de auditoria `.docx` executivo a partir de `--audit-json` e `--out`. |
| `--case-dir <dir>` | Caminho da pasta do caso (usado com `--bootstrap-case`). |
| `--uploads-dir <dir>` | Caminho opcional da pasta `.user_uploaded` (usado com `--bootstrap-case`). |
| `--audit-json <caminho>` | Caminho do arquivo `relatorio_auditoria.json` (usado com `--generate-audit-docx`). |
| `--source <caminho>` | Caminho do `.docx` bruto original (usado com `--build-template` ou `--inspect`). |
| `--manifest <caminho>` | Caminho do arquivo `slots_manifest.json` (usado com `--build-template`). |
| `--template <caminho>` | Caminho do arquivo modelo `.docx` de entrada (usado com `--inject`). |
| `--state <caminho>` | Caminho do arquivo `.json` contendo os dados a serem injetados (usado com `--inject`). |
| `--out <caminho>` | Caminho do arquivo de saída (`.json` no `--inspect`, `.docx` nos demais). |
| `--check-update` | Consulta o GitHub Releases e informa se há uma nova versão disponível. |
| `-u`, `--update` | Atualiza o próprio binário para a versão mais recente (caso haja atualização). |
| `--force-update` | Força o download e substituição do binário pela última release publicada. |
| `-v`, `--version` | Exibe a versão atual do binário (`docgov-docx-engine vX.Y.Z`). |
| `-h`, `--help` | Exibe o resumo de uso e parâmetros disponíveis. |

---

## 3. Estrutura do `slots_manifest.json` (`build_docx_template`)

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
      "find": "Órgão Público Contratante",
      "replace": "{{metadados.orgao_entidade}}"
    }
  ]
}
```

---

## 4. Configuração nos Principais Agentes MCP

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

## 5. Desenvolvimento e Compilação Local

Requer [Bun](https://bun.sh/) instalado:

```bash
# Instalar dependências
bun install

# Executar suíte de testes unitários e E2E
bun test

# Compilar binários standalone
bun run build:windows
bun run build:linux
```
