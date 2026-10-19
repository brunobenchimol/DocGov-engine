# docgov-docx-engine — Motor Standalone `.docx` / `.pdf` & Servidor MCP (`v0.8.1`)

Motor unificado para o **ciclo completo de documentos Microsoft Word (`.docx`) e extração/auditoria determinística de Editais e Termos de Referência em PDF (`.pdf`)**, além de servidor **Model Context Protocol (MCP)** via `stdio`, projetado para o ecossistema **DocGov** e compatível com qualquer agente de IA (Google Antigravity, Claude Code, Claude Desktop, Cursor, VS Code Copilot e Windsurf).

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

## 2. Destaques da Versão `v0.8.0` / `v0.8.1`

A versão `v0.8.0` / `v0.8.1` traz a evolução para auditoria direta e inteligência competitiva de licitações, onde a imensa maioria dos Editais, TRs e Minutas são disponibilizados em `.pdf` extensos (150 a 300+ páginas):

1. **Extração Nativa Paginada de PDF (`src/utils/pdf.ts`):**
   - Extração determinística por página (`1..N`) via `unpdf`, sem workers externos ou dependências de canvas nativo, 100% compatível com binários standalone compilados via `bun build --compile`.
   - **Coordenada Dupla Global:** Cada linha não vazia do PDF é indexada com coordenadas absolutas de página e linha global:
     ```text
     [PAG_001 | L0001] EDITAL DE PREGÃO ELETRÔNICO Nº 01/2026 — ORGAO_CONTRATANTE
     [PAG_001 | L0002] PROCESSO ADMINISTRATIVO Nº 001/2026
     ...
     [PAG_012 | L0348] 1. DO OBJETO: Prestação de serviços continuados de TI...
     ```
   - Validação estrita de Magic Bytes (`%PDF-`).

2. **Cartografia Estrutural Sem IA em 3 Camadas (`src/core/cartography.ts`):**
   Análise heurística 100% determinística aplicável tanto a `.pdf` quanto a `.docx`:
   - **Camada 1 — Esqueleto de Títulos e Fronteiras (`outline_headings`):** Detecta linhas curtas ($\le 140$ caracteres) iniciadas por numeração hierárquica (`1.`, `1.1.`, algarismos romanos) ou palavras-chave estruturais (`EDITAL`, `PREÂMBULO`, `CLÁUSULA`, `SEÇÃO`, `CAPÍTULO`, `ANEXO`, `APÊNDICE`, `TERMO DE REFERÊNCIA`, `ESTUDO TÉCNICO PRELIMINAR`, `ESPECIFICAÇÕES TÉCNICAS`, `MINUTA DE CONTRATO`, `ATA DE REGISTRO`, `HABILITAÇÃO`, `QUALIFICAÇÃO`, `OBJETO`, `OBRIGAÇÕES`, `SANÇÕES`).
   - **Camada 2 — Detector de Densidade Técnica e Tabelas de Itens (`page_signals`):**
     * **Sinais de Orçamento e Itens:** `R$`, `Valor Unitário`, `Valor Total`, `CATMAT`, `CATSER`, `Unidade de Fornecimento`, `Quantidade`, `Lote`, `Item`.
     * **Sinais de Datasheet Técnico:** unidades de medida e termos normativos (`GHz`, `MHz`, `GB`, `TB`, `Mbps`, `Gbps`, `IOPS`, `kVA`, `BTU`, `mm`, `cm`, `kg`, `ABNT`, `NBR`, `ISO`, `IEC`, `IEEE`, `SLA`, `24x7`, `part number`, `garantia de`).
   - **Camada 3 — Radar Léxico das 14 Zonas de Impugnação (`impugnation_zones`):**
     Varre as linhas do documento e agrupa coordenadas e snippets curtos nas 14 zonas críticas (`Z1` a `Z14`):
     * `Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO`: lote único, preço global, agrupamento, consórcio, subcontratação.
     * `Z2_QUALIFICACAO_TECNICA_ATESTADOS`: atestados, capacidade técnica, parcela de maior relevância, 50%, CAT, CREA, CAU.
     * `Z3_QUALIFICACAO_ECONOMICA_GARANTIAS`: patrimônio líquido, capital social, liquidez, garantia de proposta/contratual.
     * `Z4_VISTORIA_VISITA_TECNICA`: vistoria prévia, visita técnica, in loco, declaração de conhecimento.
     * `Z5_AMOSTRA_POC_HOMOLOGACAO`: amostra, prova de conceito (PoC), demonstração, protótipo, laudo.
     * `Z6_VINCULO_FABRICANTE_SOLIDARIEDADE`: fabricante, carta/declaração de solidariedade, credenciamento, parceria oficial.
     * `Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP`: armadilhas técnicas em catálogos/datasheets, números de peça (`part number`, `P/N`, `SKU`), dimensões exatas, parâmetros de catálogo, especificações densas de hardware (`GHz`, `Gbps`, `IOPS`, `NVMe`, `throughput`, `latência máxima`, `MTBF`, `rack 1U`, `rack 2U`, `SFP+`, `SFP28`, `Nutanix`, `VMware`).
     * `Z8_PRAZOS_ENTREGA_SLA_GARANTIA`: prazo de entrega, implantação, dias corridos/úteis, on-site, SLA, tempo de atendimento.
     * `Z9_EQUIPE_CERTIFICACOES_SEDE`: vínculo empregatício em CTPS, quadro permanente, certificações, sede ou escritório local.
     * `Z10_PRECOS_EXEQUIBILIDADE_PLANILHA`: inexequibilidade, 75%, planilha analítica de custos, BDI, CCT.
     * `Z11_PAGAMENTO_REAJUSTE_IMR_SANCOES`: Instrumento de Medição de Resultado (IMR), glosa, reajuste, IPCA, ICT, multas, sanções.
     * `Z12_MAPA_CRUZADO_MULTIPECA`: identifica termos que se repetem em peças/seções distintas (ex.: regras de habilitação ou prazos citados tanto no Edital quanto no Termo de Referência e na Minuta de Contrato), permitindo checar inconsistências textuais entre peças.
     * `Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO`: indicação direta de marca, modelo ou fabricante exclusivo, processo formal de padronização, parque instalado/atual, compatibilidade, interoperabilidade, equivalente, similar, melhor qualidade, referências ao Art. 41 e Art. 43 da Lei 14.133/2021.
     * `Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO`: métricas de esforço e unidades de medição de serviços e software (UST, USM, HST, ponto de função, PF, IFPUG, SNAP, hora técnica, homem-hora, catálogo de serviços, complexidade, licenciamento por core/núcleo/vCore/socket/vCPU, usuário nomeado/concorrente, subscrição, EPS, Súmula 269 TCU).

3. **Espelho de Auditoria Estruturado em 2 Blocos (`state/visao_auditoria_<stem>.md`):**
   - **Bloco 1 (Topo):** Mapa Cartográfico Estrutural (`outline_headings` e `page_signals`) e o Radar das 14 Zonas de Impugnação (`Z1` a `Z14`) com coordenadas e snippets.
   - **Bloco 2 (Corpo):** Conteúdo integral paginado `[PAG_XXX | LYYYY]` (para PDF) ou indexado por parágrafos/células `[P...]`/`[T...]` (para DOCX), permitindo leitura cega e cirúrgica pelo auditor em **turno único**.

4. **Integração Transparente em `bootstrap_case` e `inspect_docx`:**
   - `bootstrap_case` inspeciona automaticamente todos os arquivos `.pdf` e `.docx` em `inputs/`, gerando `state/estrutura_<stem>.json` e `state/visao_auditoria_<stem>.md` de cada um.
   - `inspect_docx` aceita tanto `.docx` quanto `.pdf` (detectando extensão ou magic bytes `%PDF-`), gerando a cartografia e o espelho linear de leitura.

---

## 3. Autodescoberta, Cache Global e Recursos de Resiliência

O servidor MCP é **100% autodescritivo, autoexplicativo e dotado de inteligência estrutural nativa**:

1. **Rastreabilidade de Versão em Todos os Retornos (`v0.8.0` / `v0.8.1`):** Inclusão mandatória do campo `"engine_version": "0.8.1"` na raiz do payload JSON sintético retornado por todas as 5 ferramentas MCP.
2. **Resiliência de Diretórios e Zero ENOENT:** Criação recursiva de pastas (`mkdirSync(..., { recursive: true })`) em todas as ferramentas que gravam arquivos (`build_docx_template`, `fill_docx_template`, `generate_audit_docx`, `inspect_docx`, `bootstrap_case`), prevenindo falhas caso pastas como `templates/` ou `output/` ainda não existam.
3. **Motor Híbrido de Lista Multinível Nativa (`v0.7.0`):**
   - **Fora de tabelas (`<w:body>`):** Cria ou atualiza `word/numbering.xml` com definição multinível de 9 níveis decimais escalonados (`%1.`, `%1.%2.`, `%1.%2.%3.`), insere `<w:pPr><w:numPr>` com `<w:startOverride>` sincronizado com o capítulo pai e limpa o prefixo numérico literal do `<w:t>` para permitir edição contínua com `ENTER` automático no Microsoft Word.
   - **Dentro de tabelas (`<w:tc>`):** Aplica *Hanging Indent* estático (`<w:ind w:left w:hanging>` + `<w:tabs>`) separando o marcador numérico literal com `<w:r><w:tab/></w:r>`.
   - **Sincronia visual:** O `NumberingResolver` reconstrói visualmente a numeração exata tanto no `inspect_docx` quanto no espelho `state/visao_auditoria_*.md`.
4. **Sanitização de Tags JS e Validação Léxica Precoce:**
   - **Auto-normalização:** Converte automaticamente acessos numéricos por ponto (ex.: `{{itens.0.qtd}}`) em notação canônica de colchetes (`{{itens[0].qtd}}`).
   - **Validação precoce fail-fast:** Intercepta no `build_docx_template` tags com hífens fora de comandos (`{{meu-slot-invalido}}`) ou iniciando por dígito (`{{1_item}}`), rejeitando a execução com *Exact Copy-Paste Error* e sugerindo o identificador corrigido em `snake_case`.
   - **Expansão de arrays (*unflatten*):** Chaves planas como `"itens.0.qtd": "10"` são expandidas automaticamente em arrays de objetos compatíveis.
5. **Rastreabilidade Temporal do Cache & Retrocompatibilidade Estrita:** Persiste e expõe `created_at`, `updated_at`, `age_days`, `cache_date_status`, `engine_version` e `slots_count` no cache global (`core/registry/templates/`), preservando o `created_at` original em atualizações e suportando caches legados sem datas (reportando `"NÃO DISPONÍVEL"` e `age_days: null`) para decisão informada do usuário no Gate 1.
6. **Padrão Exact Copy-Paste Error:** Validação fail-fast estrita em `slots_manifest.json` e `relatorio_auditoria.json`. Em caso de erro de contrato ou `applied_slots_count === 0`, o motor interrompe a execução com a instrução mandatória:
   > *"NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:"*
   acompanhada do snippet JSON canônico completo e pronto para copiar e colar.
7. **Exportação de Especificação de Consumo (`--dump-spec` `v0.8.1`):** Exporta a especificação técnica integral do motor em Markdown (UTF-8), servindo como fonte única da verdade para sincronização de agentes de IA consumidores sem doc drift.
8. **Estatuto de Governança do Motor (`AGENTS.md`):** Define as 7 Leis Invioláveis de Engenharia deste motor MCP (Bun runtime, payload < 1024b, Exact Copy-Paste Error, self-discovery sync, neutralidade institucional, resiliência de cache e ritual de release).
9. **Coordenadas Compactas & Normalização Universal:** Suporte nativo a coordenadas extraídas do `toc_map` (`"coord": "T0.R1.C1"`, `"coord": "P2"` ou `"P2-P4"`, com ou sem colchetes `[T0.R1.C1]`), lista unificada `slots: [...]` ou array puro na raiz do manifesto, além de aliases (`col_index`, `paragraph_index`).
10. **Cache Global de Templates Cross-Órgão (`core/registry/templates/`):** Compara o documento de entrada contra todos os templates homologados salvos no cache, calculando a impressão digital estrutural (`structure_fingerprint`) com similaridade ponderada. Retorna `EXACT` (100%), `MODIFIED` (75% a 99%) ou `NEW` (< 75%).
11. **Reancoragem Automática de Coordenadas (`Auto-Offset` / `adapted_manifest`):** Se a minuta sofrer alterações estruturais, o motor ajusta automaticamente as coordenadas dos slots por correspondência semântica de rótulos/perguntas, gerando o `adapted_slots_manifest.json`.
12. **Preservação de Nomes Legíveis & Auto-Batismo Semântico de Anexos:** Em uploads com hashes opacos (`media_*`), o motor inspeciona o conteúdo para auto-batizar os arquivos (`<TIPO>_<ORGAO>_<hash4>.<ext>`), preserva nomes legíveis e aceita `fileRenameMap`.
13. **Inferência de Extensão por Magic Bytes:** Identifica arquivos enviados sem extensão inspecionando os primeiros bytes (`PK\x03\x04` para `.docx` e `%PDF` para `.pdf`).
14. **Auto-Inspeção Integrada no Preenchimento:** O `fill_docx_template` executa automaticamente a inspeção estrutural pós-compilação gravando `state/inspecao_<stem>.json` e `state/visao_auditoria_<stem>.md`, dispensando rodar `inspect_docx` novamente antes da auditoria externa.

---

## 4. Ciclo de Vida do Caso: 5 Ferramentas Integradas

O motor opera em dois modos (Servidor MCP por padrão ou CLI via flags), disponibilizando as **5 ferramentas fundamentais**:

### A) Modo Servidor MCP (Padrão / `--mcp`)

Ao ser executado **sem argumentos** (ou com `--mcp`), o binário sobe um servidor MCP sobre `stdio` expondo **5 ferramentas**:

1. **`bootstrap_case`**
   - Cria a estrutura de diretórios do caso (`inputs/`, `state/`, `templates/`, `output/`), preserva nomes legíveis ou auto-batiza anexos opacos (`media_*`), infere extensões via magic bytes, aceita mapeamento opcional `fileRenameMap`.
   - Copia de forma síncrona imediata os modelos `.docx` e documentos `.pdf` de `uploadsDir` para `inputs/`, extrai seus mapas estruturais (`state/estrutura_<nome>.json`), gera a **Visão Linear de Auditoria** (`state/visao_auditoria_<nome>.md` com Bloco 1 Cartográfico + Radar Z1..Z12) e avalia correspondência no Cache Global.
   - **Salvaguarda Assíncrona Não-Bloqueante:** Outros anexos pesados têm a salvaguarda iniciada em segundo plano sem congelar a chamada MCP ou CLI. O status pode ser acompanhado em `state/salvaguarda_status.json`.
   - **Retorno Sintético com `engine_version` (< 1 KB):** Devolve um JSON conciso com `engine_version`, status, contadores, referências em disco e o próximo passo recomendado.
   - Parâmetros: `caseDir` (*obrigatório*), `uploadsDir` (*opcional*), `fileRenameMap` (*opcional*).

2. **`inspect_docx`**
   - Realiza a engenharia reversa de arquivos `.docx` ou `.pdf`.
   - **Para PDF:** Extrai todas as páginas, numera linhas globalmente com coordenada dupla `[PAG_XXX | LYYYY]`, constrói a Cartografia Estrutural em 3 camadas e o Radar das 12 Zonas de Impugnação (`Z1` a `Z12`), persistindo `state/estrutura_<stem>.json` e `state/visao_auditoria_<stem>.md`.
   - **Para DOCX:** Mapeia headers, footers, parágrafos, tabelas, constrói o `toc_map`, calcula o `structure_fingerprint`, busca no Cache Global e gera a `visao_auditoria_<stem>.md` também enriquecida com o Bloco 1 Cartográfico + Radar Z1..Z12.
   - **Retorno Sintético (`toc_summary` < 1 KB):** Devolve `engine_version`, `doc_type`, contadores, resumo do TOC, status do cache e `next_step_hint`.
   - Parâmetros: `docxPath` (*obrigatório*), `outputPath` (*opcional*), `compact` (*opcional*).

3. **`build_docx_template`**
   - Transforma um `.docx` bruto (sem tags) em um template parametrizado com tags `{{...}}` a partir de um arquivo `slots_manifest.json`, preservando 100% da formatação visual (`<w:pPr>`, `<w:rPr>`, estilos, cabeçalhos e tabelas).
   - Valida fail-fast com *Exact Copy-Paste Error* contra propriedades inventadas ou `applied_slots_count === 0`.
   - Suporta `saveToRegistry: true` para homologar o template no Cache Global cross-órgão.
   - Parâmetros: `sourcePath`, `manifestPath`, `outputPath` (*obrigatórios*), `saveToRegistry` (*opcional*), `templateId` (*opcional*).

4. **`fill_docx_template`**
   - Preenche um template `.docx` parametrizado injetando os dados de um arquivo JSON de estado (`{{...}}`, loops `FOR`, condicionais `IF`, quebras `\n` em parágrafos reais, negrito `**...**` e listas hierárquicas multinível híbridas).
   - Executa **auto-inspeção integrada**, gravando automaticamente `state/inspecao_<stem>.json` e `state/visao_auditoria_<stem>.md` para auditoria externa imediata.
   - Parâmetros: `templatePath`, `statePath`, `outputPath` (*obrigatórios*), `autoInspect` (*opcional, padrão true*).

5. **`generate_audit_docx`**
   - Gera um Parecer de Auditoria Técnico-Jurídica em Word (`.docx`) em layout editorial vertical corrido (folha A4 retrato, **zero tabelas** `<w:tbl>`, 100% da largura útil da página), com fichas individualizadas e transcrições literais de evidências.
   - Parâmetros: `auditJsonPath`, `outputPath` (*todos obrigatórios*).

---

### B) Modo CLI (Linha de Comando)

```powershell
# 1. Inicializar pasta do caso, copiar uploads e inspecionar documentos (.docx e .pdf)
./docgov-docx --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded

# Com mapeamento explícito de nomes de arquivos
./docgov-docx --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded --rename-map '{"media_1792069974647_14a93b9d": "Edital_Pregao.pdf"}'

# 2. Inspecionar estrutura de um arquivo (.docx ou .pdf) gerando a Cartografia e o Radar Z1..Z12
./docgov-docx --inspect edital_licitacao.pdf --out state/estrutura_edital.json
./docgov-docx --inspect modelo_etp.docx --out state/estrutura_etp.json --compact

# 3. Construir template parametrizado a partir de um .docx bruto + slots_manifest.json
./docgov-docx --build-template --source modelo_etp.docx --manifest slots_manifest.json --out template.docx --save-to-registry --template-id etp_padrao_v1

# 4. Preencher template com o JSON de estado do processo
./docgov-docx --inject --template template.docx --state estado_caso.json --out minuta_final.docx

# 5. Gerar Parecer de Auditoria em Word (.docx) a partir do JSON de auditoria
./docgov-docx --generate-audit-docx --audit-json state/relatorio_auditoria.json --out output/Relatorio_Auditoria_ETP.docx

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
| `--bootstrap-case` | Cria `inputs/`, `state/`, `templates/`, `output/` em `--case-dir`, copia e inspeciona `.docx` e `.pdf` imediatamente, gerando a Cartografia Estrutural e o Radar das 12 Zonas. |
| `--wait` | Aguarda a conclusão da cópia dos arquivos pesados em segundo plano no `--bootstrap-case`. |
| `--inspect <arq.docx\|.pdf>` | Extrai mapa estrutural (`state/estrutura_<stem>.json`), gera `state/visao_auditoria_<stem>.md` (Bloco 1 Cartografia/Radar + Bloco 2 Integral) e busca correspondência no Cache Global. |
| `--compact` | Filtra parágrafos e células vazias no `--inspect` preservando os índices originais 0-based. |
| `--build-template` | Gera um template `.docx` parametrizado a partir de `--source`, `--manifest` e `--out`. |
| `--save-to-registry` | Persiste o manifesto homologado no Cache Global de templates (`core/registry/templates/`). |
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
    { "find": "Órgão Contratante", "replace": "{{metadados.orgao_entidade}}" }
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
      "find": "Órgão Contratante",
      "replace": "{{metadados.orgao_entidade}}"
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

# Executar suíte completa de testes unitários e E2E (60 testes em 9 arquivos)
bun test

# Executar suítes específicas por domínio
bun test test/engine.test.ts        # Testes E2E v0.8.0 / v0.8.1 (PDF, Cartografia, Radar Z1..Z14 e binário compilado)
bun test test/bootstrap.test.ts     # Ingestão de pastas, salvaguarda e magic bytes
bun test test/inspect.test.ts       # Engenharia reversa estrutural, toc_map e visão linear
bun test test/build_template.test.ts# Parametrização OpenXML e validação fail-fast
bun test test/fill_template.test.ts # Injeção de dados, listas multinível e auto-inspeção
bun test test/audit.test.ts         # Geração de parecer de auditoria vertical A4
bun test test/mcp_spec.test.ts      # Self-Discovery, --dump-spec e barrel

# Compilar binários standalone
bun run build:windows
bun run build:linux

# Disparar validação de CI no GitHub Actions sob demanda (manual)
gh workflow run ci.yml
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
