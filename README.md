# docgov-docx-engine — Motor Standalone `.docx` & Servidor MCP (`v0.6.4`)

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

## 2. Autodescoberta, Cache Global e Resiliência Nativa no MCP (`v0.6.4`)

O servidor MCP é **100% autodescritivo, autoexplicativo e dotado de inteligência estrutural nativa**:

1. **Rastreabilidade Temporal do Cache & Retrocompatibilidade Estrita (v0.6.4):** Persiste e expõe `created_at`, `updated_at`, `age_days`, `cache_date_status`, `engine_version` e `slots_count` no cache global (`core/registry/templates/`), preservando o `created_at` original em atualizações e suportando caches legados sem datas (reportando `"NÃO DISPONÍVEL"` e `age_days: null` sem usar `mtime` do disco) para decisão informada do usuário no Gate 1.
2. **Arquitetura Modular & Re-export Barrel (v0.6.3):** Código estruturado em submódulos desacoplados de responsabilidade única (`types/`, `constants/`, `contracts/`, `utils/`, `core/`, `tools/`, `mcp/`, `cli/`), preservando 100% de integridade das exportações públicas e compatibilidade retroativa.
3. **`instructions` no Handshake Inicial:** No momento da conexão, o servidor entrega ao LLM o propósito do motor, a **ordem canônica do pipeline (1..5)**, a sintaxe de tags suportada (`{{variavel}}`, loops `FOR`, condicionais `IF`, negrito seletivo `**...**` e listas multinível `1.1`), além do funcionamento do cache global e auto-offset.
4. **Padrão Exact Copy-Paste Error (v0.6.2):** Validação fail-fast estrita em `slots_manifest.json` e `relatorio_auditoria.json`. Em caso de erro de contrato (propriedades inventadas como `loop_var`, `cell_slots`, chaves desconhecidas na raiz ou `applied_slots_count === 0`), o motor interrompe a execução com a instrução mandatória:
   > *"NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:"*
   acompanhada do snippet JSON canônico completo e pronto para copiar e colar.
5. **Exportação de Especificação de Consumo (`--dump-spec` v0.6.4):** Exporta a especificação técnica integral do motor em Markdown (UTF-8), servindo como fonte única da verdade para sincronização de agentes de IA consumidores sem doc drift.
6. **Estatuto de Governança do Motor (`AGENTS.md`):** Define as 7 Leis Invioláveis de Engenharia deste motor MCP (Bun runtime, payload < 1024b, Exact Copy-Paste Error, self-discovery sync, neutralidade institucional, resiliência de cache e ritual de release).
7. **Coordenadas Compactas & Normalização Universal (v0.6.1):** Suporte nativo a coordenadas extraídas do `toc_map` (`"coord": "T0.R1.C1"`, `"coord": "P2"` ou `"P2-P4"`, com ou sem colchetes `[T0.R1.C1]`), lista unificada `slots: [...]` ou array puro na raiz do manifesto, além de aliases (`col_index`, `paragraph_index`).
8. **Validação Fail-Fast Zero Silent No-Op (v0.6.1):** Se o manifesto tiver 0 regras reconhecidas ou se 0 tags forem aplicadas no OpenXML (`applied_slots_count === 0`), o motor falha imediatamente com erro descritivo mostrando o schema esperado, impedindo a gravação de arquivos vazios e rejeitando salvar no cache global.
9. **Sanity Check do Cache Global (v0.6.1):** Ao carregar templates em `core/registry/templates/`, o motor normaliza os manifestos e descarta silenciosamente entradas corrompidas ou com 0 regras.
10. **Cache Global de Templates Cross-Órgão (`core/registry/templates/`):** Compara o documento de entrada contra todos os templates homologados salvos no cache (independentemente do órgão de origem), calculando a impressão digital estrutural (`structure_fingerprint`) com similaridade ponderada. Retorna `EXACT` (100%), `MODIFIED` (75% a 99%) ou `NEW` (< 75%).
11. **Reancoragem Automática de Coordenadas (`Auto-Offset` / `adapted_manifest`):** Se a minuta sofrer alterações estruturais (como inclusão/remoção de linhas em tabelas de formulário ou parágrafos), o motor ajusta automaticamente as coordenadas dos slots por correspondência semântica de rótulos/perguntas, gerando o `adapted_slots_manifest.json`.
12. **Visão Linear Compacta de Auditoria (`visao_auditoria_<nome_base>.md`):** Um espelho textual ultracompacto gerado pelo `inspect_docx` e `bootstrap_case` contendo a lista sequencial exata de cabeçalhos/rodapés (`[H0]`/`[F0]`), parágrafos (`[P0]`) e células (`[T0.R0.C0]`), permitindo leitura em **1 único turno** pelo auditor.
13. **Preservação de Nomes Legíveis & Auto-Batismo Semântico de Anexos:** Em uploads com hashes opacos (`media_*`), o motor inspeciona o conteúdo para auto-batizar os arquivos (`<TIPO>_<ORGAO>_<hash4>.<ext>`), preserva nomes legíveis e aceita `fileRenameMap`.
14. **Inferência de Extensão por Magic Bytes:** Identifica arquivos enviados sem extensão inspecionando os primeiros bytes (`PK\x03\x04` para `.docx` e `%PDF` para `.pdf`).
15. **Índice Estrutural Rápido (`toc_map` & `toc_summary`):** `inspect_docx` constrói no topo do JSON de inspeção o mapa de seções (`P...`), campos/perguntas de formulários (`T...R...C...` com `suggested_target_slot`) e tabelas dimensionadas, devolvendo no payload MCP um sumário executivo conciso (`toc_summary` < 1 KB).
16. **Parser Tolerante com Auto-Saneamento de JSON (`safeReadJsonFile`):** Remove silenciosamente BOM UTF-8, *trailing commas* e quebras de linha literais em strings JSON.
17. **Diagnóstico Cirúrgico com Snippet de 5 Linhas:** Se o JSON possuir erro estrutural irrecuperável, a ferramenta informa a linha/coluna exatas com um trecho de 5 linhas numeradas marcando `<-- ERRO AQUI`.
18. **Desaninhamento Automático de Chaves (*Unflattening*):** Chaves na raiz como `"etp.necessidade": "..."` são automaticamente desaninhadas para `{ etp: { necessidade: "..." } }`.

---

## 3. Ciclo de Vida `.docx`: 5 Operações Integradas

O motor opera em dois modos (Servidor MCP por padrão ou CLI via flags), disponibilizando as **5 operações fundamentais**:

### A) Modo Servidor MCP (Padrão / `--mcp`)

Ao ser executado **sem argumentos** (ou com `--mcp`), o binário sobe um servidor MCP sobre `stdio` expondo **5 ferramentas**:

1. **`bootstrap_case`**
   - Cria a estrutura de diretórios do caso (`inputs/`, `state/`, `output/`), preserva nomes legíveis ou auto-batiza anexos opacos (`media_*`), infere extensões via magic bytes, aceita mapeamento opcional `fileRenameMap`, copia de forma síncrona imediata os modelos `.docx` de `uploadsDir` para `inputs/`, extrai seus mapas estruturais (`state/estrutura_<nome>.json`), gera a **Visão Linear de Auditoria** (`state/visao_auditoria_<nome>.md`) e avalia match no Cache Global.
   - **Salvaguarda Assíncrona Não-Bloqueante:** Arquivos volumosos (`.pdf` e outros anexos pesados) têm a salvaguarda para `inputs/` iniciada em segundo plano sem congelar a chamada MCP ou CLI (evita timeouts e contenção de I/O em pastas sincronizadas na nuvem como Google Drive). O progresso da salvaguarda pode ser monitorado em `state/salvaguarda_status.json` (`in_progress`, `completed`, `partial_error`).
   - **Retorno Sintético com `ingested_files` (< 1 KB):** Devolve um JSON conciso com contadores, referências em disco, mapa de arquivos ingeridos (`ingested_files`) e a orientação do próximo passo recomendado.
   - Parâmetros: `caseDir` (*obrigatório*), `uploadsDir` (*opcional*), `fileRenameMap` (*opcional*).

2. **`inspect_docx`**
   - Faz a engenharia reversa estrutural de qualquer `.docx` bruto (headers, footers, parágrafos indexados `0..N` e tabelas indexadas `0..M`).
   - **Índice Estrutural Rápido (`toc_map`):** Salva no topo do JSON em `outputPath` o mapa de seções, perguntas de formulários e tabelas.
   - **Visão Linear Compacta de Auditoria (`audit_view_path`):** Salva automaticamente `state/visao_auditoria_<nome>.md` com espelho sequencial integral formatado com coordenadas canônicas para auditoria em **turno único**.
   - **Busca 1-para-N no Cache Global & Auto-Offset:** Compara a impressão digital contra o registro global de templates (`core/registry/templates/`). Se houver match exato (`EXACT`) ou drift (`MODIFIED`), devolve os caminhos do template e do manifesto reancorado (`adapted_manifest_path`), poupando a recriação do manifesto de slots.
   - **Retorno Sintético (`toc_summary` < 1 KB):** A chamada MCP devolve as coordenadas e títulos chave (`toc_summary`), status, contadores e `next_step_hint`, evitando arquivos temporários de log.
   - Parâmetros: `docxPath` (*obrigatório*), `outputPath` (*opcional*), `compact` (*opcional*).

3. **`build_docx_template`**
   - Transforma um `.docx` bruto (sem tags) em um template parametrizado com tags `{{...}}` a partir de um arquivo `slots_manifest.json`, preservando 100% da formatação visual (`<w:pPr>`, `<w:rPr>` de corpo sem herança indevida de negrito de subtítulos, `<w:tblPr>`, cabeçalhos, rodapés e imagens).
   - **Coordenadas Compactas & Array Unificado (`v0.6.1`):** Suporta diretamente coordenadas do `toc_map` (ex.: `"coord": "T0.R1.C1"` ou `"coord": "P2"`, com ou sem colchetes), array raiz unificado `slots: [...]` ou array puro na raiz, além de aliases (`col_index`, `paragraph_index`).
   - **Validação Fail-Fast Zero Silent No-Op (`v0.6.1`):** Garante que manifestos com 0 regras ou que resultem em 0 tags aplicadas falhem imediatamente com erro descritivo. Retorna payload sintético no MCP com `applied_slots_count` e `breakdown` detalhado.
   - **Homologação no Cache Global (`saveToRegistry`):** Quando habilitado (`true`), persiste o manifesto e a impressão digital estrutural no repositório compartilhado de templates (`core/registry/templates/<templateId>.json`), permitindo reaproveitamento e auto-offset em futuros órgãos.
   - Suportado pelo parser tolerante de JSON com auto-reparo e diagnóstico cirúrgico.
   - Parâmetros: `sourcePath`, `manifestPath`, `outputPath` (*obrigatórios*), `saveToRegistry` (*opcional*), `templateId` (*opcional*).

4. **`fill_docx_template`**
   - Preenche um template `.docx` parametrizado injetando os dados de um arquivo JSON de estado (`{{...}}`, loops `FOR` em tabelas, conversão automática de `\n` em parágrafos `<w:p>` reais, negrito seletivo via `**texto**` e suporte nativo a **listas hierárquicas aninhadas em múltiplos níveis** como `1.1`, `1.1.1`, `1.1.1.1`, `1.1.1.1.1` com recuo `<w:ind>` progressivo e achatamento recursivo de árvores JSON `subitens`).
   - Suporta desaninhamento automático de chaves com notação de ponto (`"etp.necessidade"`).
   - **Auto-Inspeção Integrada:** Após salvar a minuta compilada em `outputPath`, executa automaticamente a inspeção estrutural gerando `state/inspecao_<stem>.json` e o espelho linear de auditoria `state/visao_auditoria_<stem>.md` na pasta `state/` do caso, dispensando rodar `inspect_docx` manualmente.
   - Retorna um payload sintético MCP (< 1 KB) contendo `status`, `outputPath`, `inspection_path`, `visao_auditoria_path` e `next_step_hint` que orienta acionar diretamente o Auditor Externo lendo a visão linear gerada.
   - Parâmetros: `templatePath`, `statePath`, `outputPath` (*obrigatórios*), `autoInspect` (*opcional, padrão true*).

5. **`generate_audit_docx`**
   - Gera nativamente um Parecer de Auditoria Técnico-Jurídica em Word (`.docx`) em layout editorial vertical corrido (folha A4 retrato, **zero tabelas** `<w:tbl>`, 100% da largura útil da página), sanitizando automaticamente crases Markdown, coordenadas de máquina (`[T0:...]`) e códigos de enum (`V1..V6`), e renderizando fichas verticais completas com múltiplos trechos transcritos (`trechos_documento`) em blocos de citação recuados.
   - Parâmetros: `auditJsonPath`, `outputPath` (*todos obrigatórios*).

---

### B) Modo CLI (Linha de Comando)

```powershell
# 1. Inicializar pasta do caso, copiar uploads e inspecionar modelos .docx (não-bloqueante para PDFs)
./docgov-docx --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded

# Com mapeamento explícito de nomes de arquivos
./docgov-docx --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded --rename-map '{"media_1792069974647_14a93b9d": "ETP_Modelo.docx"}'

# Opcional: aguardar cópia de PDFs em segundo plano antes de encerrar o comando
./docgov-docx --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded --wait

# 2. Inspecionar estrutura de um .docx bruto (opcionalmente com --compact)
./docgov-docx --inspect documento_bruto.docx --out estrutura.json --compact

# 3. Construir template parametrizado a partir de um .docx bruto + manifesto de slots (e salvar no registro global)
./docgov-docx --build-template --source documento_bruto.docx --manifest slots_manifest.json --out template.docx --save-to-registry --template-id etp_padrao_v1

# 4. Preencher template com o JSON de estado do processo
./docgov-docx --inject --template template.docx --state estado_caso.json --out minuta_final.docx

# 5. Gerar Relatório de Auditoria em Word (.docx) a partir do JSON de auditoria
./docgov-docx --generate-audit-docx --audit-json state/relatorio_auditoria.json --out output/Relatorio_Auditoria_ETP.docx

# 6. Exportar especificação técnica normativa em Markdown
./docgov-docx --dump-spec especificação_motor.md

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
| `--bootstrap-case` | Cria `inputs/`, `state/`, `output/` em `--case-dir`, copia e inspeciona `.docx` imediatamente, gera `visao_auditoria_<nome>.md` e inicia salvaguarda de PDFs em background. |
| `--wait` | Aguarda a conclusão da cópia dos arquivos em segundo plano no `--bootstrap-case` antes de encerrar o CLI. |
| `--inspect <arq.docx>` | Extrai o mapa estrutural JSON (`toc_map`), gera `visao_auditoria_<nome>.md` e busca correspondência no Cache Global. |
| `--compact` | Filtra parágrafos e células vazias no `--inspect` preservando os índices originais 0-based. |
| `--build-template` | Gera um template `.docx` parametrizado a partir de `--source`, `--manifest` e `--out`. |
| `--save-to-registry` | Persiste o manifesto homologado no Cache Global de templates (`core/registry/templates/`) para reaproveitamento cross-órgão. |
| `--template-id <id>` | Identificador semântico customizado do template ao salvar no registro (opcional). |
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

O motor suporta tanto a **notação compacta universal** (baseada nas coordenadas do `toc_map` e `visao_auditoria.md`) quanto a **notação canônica verbosa**:

### A) Notação Compacta Universal (Recomendada — `v0.6.1`)
```json
{
  "slots": [
    { "coord": "P3", "tag": "{{estudo.descricao_necessidade}}" },
    { "coord": "T0.R0.C1", "tag": "{{metadados.unidade_requisitante}}" },
    { "coord": "P12-P14", "tag": "{{estudo.justificativa}}" },
    { "find": "Órgão Público Contratante", "replace": "{{metadados.orgao_entidade}}" }
  ]
}
```
> **Dica:** Aceita coordenadas com ou sem colchetes (`"T0.R0.C1"` ou `"[T0.R0.C1]"`), ranges de parágrafo (`"P12-P14"`), aliases (`col_index`, `paragraph_index`) e até mesmo um array puro na raiz `[ { "coord": "...", "tag": "..." } ]`.

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

# Disparar validação de CI no GitHub Actions sob demanda (manual)
gh workflow run ci.yml
```
