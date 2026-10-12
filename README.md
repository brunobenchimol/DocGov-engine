# docgov-docx-engine — Motor Standalone `.docx` & Servidor MCP (`v0.2.0`)

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

## 2. Ciclo de Vida `.docx`: 3 Operações Integradas

O motor opera em dois modos (Servidor MCP por padrão ou CLI via flags), disponibilizando as **3 operações fundamentais**:

### A) Modo Servidor MCP (Padrão / `--mcp`)

Ao ser executado **sem argumentos** (ou com `--mcp`), o binário sobe um servidor MCP sobre `stdio` expondo **3 ferramentas**:

1. **`inspect_docx`**
   - Faz a engenharia reversa estrutural de qualquer `.docx` bruto, retornando um JSON com `headers`, `footers`, `paragraphs` (`index: 0..N`, `style`, `text`) e `tables` (`index: 0..M`, `rows`, `cells`).
   - Parâmetros: `docxPath` (*obrigatório*), `outputPath` (*opcional*).

2. **`build_docx_template`**
   - Transforma um `.docx` bruto (sem tags) em um template parametrizado com tags `{{...}}` a partir de um arquivo `slots_manifest.json`, preservando 100% da formatação visual (`<w:pPr>`, `<w:rPr>`, `<w:tblPr>`, cabeçalhos, rodapés e imagens).
   - Parâmetros: `sourcePath`, `manifestPath`, `outputPath` (*todos obrigatórios*).

3. **`fill_docx_template`**
   - Preenche um template `.docx` parametrizado injetando os dados de um arquivo JSON de estado (`{{...}}`, loops `FOR` em tabelas e quebras de linha).
   - Parâmetros: `templatePath`, `statePath`, `outputPath` (*todos obrigatórios*).

---

### B) Modo CLI (Linha de Comando)

```powershell
# 1. Inspecionar estrutura de um .docx bruto
./docgov-docx --inspect documento_bruto.docx --out estrutura.json

# 2. Construir template parametrizado a partir de um .docx bruto + manifesto de slots
./docgov-docx --build-template --source documento_bruto.docx --manifest slots_manifest.json --out template.docx

# 3. Preencher template com o JSON de estado do processo
./docgov-docx --inject --template template.docx --state estado_caso.json --out minuta_final.docx

# 4. Verificar / Atualizar o próprio binário
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
| `--inspect <arq.docx>` | Extrai o mapa estrutural JSON (cabeçalhos, rodapés, parágrafos e tabelas) do `.docx`. |
| `--build-template` | Gera um template `.docx` parametrizado a partir de `--source`, `--manifest` e `--out`. |
| `--inject` | Preenche um template `.docx` a partir de `--template`, `--state` e `--out`. |
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
      "find": "Defensoria Pública do Estado do Pará",
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
