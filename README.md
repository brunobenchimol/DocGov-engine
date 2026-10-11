# docgov-docx-engine — Motor Standalone `.docx` & Servidor MCP

Motor de injeção cirúrgica em templates Microsoft Word (`.docx`) e servidor **Model Context Protocol (MCP)** via `stdio`, projetado para o ecossistema **DocGov** e compatível com qualquer agente de IA (Google Antigravity, Claude Code, Claude Desktop, Cursor, VS Code Copilot e Windsurf).

Compilado em **binário standalone** (Windows `x64` e Linux `x64`) via Bun — não requer Node.js ou Bun instalado na máquina do usuário final.

---

## 1. Download Rápido (Binário Pré-Compilado)

### Windows (PowerShell)
```powershell
curl.exe -fL "https://github.com/brunobenchimol/docgov-docx-engine/releases/latest/download/docgov-docx-windows-x64.exe" -o docgov-docx.exe
```

### Linux / WSL (Bash)
```bash
curl -fL "https://github.com/brunobenchimol/docgov-docx-engine/releases/latest/download/docgov-docx-linux-x64" -o docgov-docx
chmod +x docgov-docx
```

---

## 2. Modos de Uso

### A) Modo CLI (Linha de Comando)

Substitui tags delimitadas por `{{` e `}}` no documento `.docx` preservando integralmente estilos tipográficos, margens, cabeçalhos, tabelas e cláusulas *boilerplate*:

```powershell
./docgov-docx --inject --template modelo.docx --state estado_caso.json --out resultado.docx
```

### B) Modo Servidor MCP (Padrão / `--mcp`)

Ao ser executado **sem argumentos** (ou com a flag opcional `--mcp`), o binário inicia imediatamente um servidor MCP sobre `stdio` expondo a ferramenta **`fill_docx_template`**:

- **Ferramenta:** `fill_docx_template`
- **Parâmetros obrigatórios:**
  - `templatePath` (`string`): Caminho para o modelo `.docx`.
  - `statePath` (`string`): Caminho para o arquivo `.json` com os dados.
  - `outputPath` (`string`): Caminho de saída do `.docx` preenchido.

---

## 3. Configuração nos Principais Agentes MCP

Como o modo MCP é o padrão quando nenhum argumento é passado, basta apontar para o executável (a flag `--mcp` é opcional):

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

## 4. Desenvolvimento e Compilação Local

Requer [Bun](https://bun.sh/) instalado:

```bash
# Instalar dependências
bun install

# Executar suíte de testes unitários
bun test

# Compilar binários standalone
bun run build:windows
bun run build:linux
```

