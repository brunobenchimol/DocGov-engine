import { VERSION } from "../constants/index.ts";
import {
  EXACT_COPY_PASTE_SLOTS_MANIFEST_SNIPPET,
  EXACT_COPY_PASTE_CANONICAL_SLOTS_MANIFEST_SNIPPET,
  EXACT_COPY_PASTE_AUDIT_REPORT_SNIPPET,
} from "../contracts/errors.ts";

// ============================================================================
// Especificação Técnica Integral em Markdown (--dump-spec v0.9.0)
// ============================================================================

export function generateEngineSpecMarkdown(): string {
  return `# Especificação Técnica do Motor docgov-docx-engine (v${VERSION})

Documento normativo e especificação canônica do motor standalone \`docgov-docx-engine\` (\`docgov-engine v${VERSION}\`) e servidor MCP para o ecossistema DocGov.

---

## 1. Diretrizes de Comunicação e Resiliência MCP

1. **Teto Estrito de Payload MCP (< 1024 bytes) e Identificação de Versão (v0.7.1 / v0.7.2 / v0.7.3 / v0.8.0 / v0.8.1 / v0.9.0):** Todo retorno de ferramenta via stdio MCP DEVE ser um JSON sintético conciso (< 1 KB) contendo o campo \`engine_version\` na raiz para dispensar consultas externas. Mapas estruturais densos (\`toc_map\`, \`outline_headings\`, \`page_signals\`, \`impugnation_zones\`), índices mestres (\`indice_mestre_caso.md\`), dossiês de hotspots (\`dossie_hotspots_*.md\`) e espelhos lineares de leitura integral (\`visao_auditoria_*.md\`) são persistidos no diretório \`state/\` do caso e apenas referenciados no payload sintético.
2. **Padrão Exact Copy-Paste Error (Zero Silent No-Op e Fail-Fast Estrito):** É expressamente proibido retornar \`status: "success"\` se \`applied_slots_count === 0\` ou se o manifesto contiver chaves desconhecidas ou inválidas. Ao detectar erro de validação em \`slots_manifest.json\` ou \`relatorio_auditoria.json\`, o motor interrompe a execução com mensagem imperativa acompanhada do snippet JSON canônico pronto para copiar e colar, eliminando leituras exploratórias cegas.
3. **Neutralidade Institucional Absoluta:** O motor e seus contratos utilizam exclusivamente identificadores canônicos universais e genéricos: \`ORGAO_CONTRATANTE\`, \`MUNICIPIO_GENERICO\`, \`ORGAO_A\`, \`ORGAO_B\`, \`AGU\`, \`MGI\`, \`TCU\`.
4. **Resiliência e Cache Global (core/registry/templates/):** O motor realiza matching 1-para-N contra o cache global, com suporte a rastreabilidade temporal (\`created_at\`, \`updated_at\`, \`age_days\`, \`cache_date_status\`, \`engine_version\`, \`slots_count\`), retrocompatibilidade estrita com caches legados sem datas, reancoragem automática de coordenadas (Auto-Offset) em caso de drift (75%-99%) e sanity check descartando entradas corrompidos.
5. **Extração Nativa e Reconstrução Colunar de PDF, Cartografia Estrutural Sem IA, Dossiê de Hotspots e Radar das 14 Zonas (v0.8.0 / v0.8.1 / v0.9.0):** Suporte avançado a arquivos \`.pdf\` e \`.docx\` com agrupamento de linhas no eixo Y (2.5pt) e colunas (\` | \` para gutters >= 18pt), detecção de armadilha de OCR em páginas escaneadas (< 25 chars), dossiê cirúrgico de pontos quentes (\`dossie_hotspots_*.md\` com contexto expandido de ±12 linhas), numeração paginada \`[PAG_XXX | LYYYY]\`, esqueleto de títulos (\`outline_headings\`), detector de densidade técnica e tabelas de itens (\`page_signals\`), radar determinístico das 14 Zonas Críticas de Impugnação (\`Z1\` a \`Z14\`, separando Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP, Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO e Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO, além de cruzamento multipeça \`Z12_MAPA_CRUZADO_MULTIPECA\`) e Índice Cartográfico Mestre Unificado Multi-Documento (\`indice_mestre_caso.md\`).

---

## 2. Ferramentas MCP Nativas (5 Tools)

### 2.1. bootstrap_case
Inicializa a governança de pastas do caso (\`inputs/\`, \`state/\`, \`templates/\`, \`output/\`), preserva nomes legíveis, infere extensões por magic bytes (\`PK\\x03\\x04\` para .docx e \`%PDF\` para .pdf), aceita \`fileRenameMap\` opcional, realiza auto-batismo de uploads anônimos (\`media_*\` -> \`<TIPO>_<ORGAO>_<hash4>.<ext>\`), detecta páginas escaneadas como imagem (\`scanned_pages_detected\`), inspeciona minutas \`.docx\` e editais/anexos \`.pdf\` (validando Magic Bytes \`%PDF-\`) imediatamente gerando \`state/estrutura_<stem>.json\`, \`state/visao_auditoria_<stem>.md\`, \`state/dossie_hotspots_<stem>.md\` e o consolidado multipeça \`state/indice_mestre_caso.md\` com matriz cruzada Z1..Z14 e alertas globais. Retorna sumário executivo sintético (< 1 KB) com \`master_index_path\`.

### 2.2. inspect_docx
Engenharia reversa estrutural completa de arquivos Word (\`.docx\`) e PDF (\`.pdf\`). Em PDFs, executa agrupamento por eixo Y com separação de colunas por \` | \` e detecta páginas escaneadas como imagem. Constrói no topo do JSON o índice estrutural rápido (\`toc_map\`), a Cartografia Estrutural em 3 camadas (\`outline_headings\`, \`page_signals\` e \`impugnation_zones\` Z1..Z14), calcula a impressão digital (\`structure_fingerprint\`), realiza busca 1-para-N no cache global (\`core/registry/templates/\`) com status \`EXACT\`, \`MODIFIED\` (reancoragem automática Auto-Offset gerando \`state/adapted_slots_manifest.json\` em drift 75%-99%) ou \`NEW\`, incluindo rastreabilidade temporal (\`created_at\`, \`updated_at\`, \`age_days\`, \`cache_date_status\`, \`engine_version\`, \`slots_count\`) para decisão informada no Gate 1. Reconstrói visualmente a numeração de listas nativas (\`word/numbering.xml\` + \`<w:numPr>\`), gera o espelho linear de auditoria \`state/visao_auditoria_<nome>.md\` (Bloco 1 Cartográfico + Radar Z1..Z14 e Bloco 2 integral paginado \`[PAG_XXX | LYYYY]\` ou \`[P...]\`), gera o dossiê executivo de pontos quentes \`state/dossie_hotspots_<nome>.md\` (com contexto expandido ±12 linhas) e devolve no MCP sumário sintético \`toc_summary\` (< 1 KB) com \`dossie_hotspots_path\`.

### 2.3. build_docx_template
Transforma documento Word (.docx) bruto em template parametrizado com tags \`{{...}}\` preservando 100% da formatação OpenXML (<w:pPr>, <w:rPr>, estilos, cabeçalhos e tabelas).
- **Resiliência de Diretórios e Zero ENOENT (v0.7.3):** Garante a criação recursiva automática de qualquer pasta pai de \`outputPath\` antes da gravação do arquivo.
- **Sanitização de Tags JS e Validação Léxica Precoce (v0.7.2):** Converte automaticamente notação de ponto numérico (ex.: \`itens.0.qtd\` -> \`itens[0].qtd\`). Valida a sintaxe léxica das tags antes de gravar o template: identificadores com hífen (kebab-case, ex.: \`{{meu-slot}}\`) ou iniciando por dígito (\`{{1_item}}\`) são barrados com Exact Copy-Paste Error sugerindo a forma canônica snake_case.
- **Validação Fail-Fast e Exact Copy-Paste Error (v0.6.2):** Proíbe chaves inventadas (ex.: \`loop_var\`, \`items_expr\`, \`cell_slots\`, \`row_index\` em \`loop_table_rows\`) e rejeita manifestos com 0 regras ou que resultem em 0 slots aplicados.
- **Contrato Canônico de \`slots_manifest.json\`:**
\`\`\`json
${EXACT_COPY_PASTE_SLOTS_MANIFEST_SNIPPET}
\`\`\`
- **Formato Canônico Detalhado com Arrays na Raiz:**
\`\`\`json
${EXACT_COPY_PASTE_CANONICAL_SLOTS_MANIFEST_SNIPPET}
\`\`\`

### 2.4. fill_docx_template
Injeta os dados de \`estado_caso.json\` no template .docx gerado.
- Desaninhamento (*unflatten*) automático e expansão de arrays indexados (ex.: \`"etp.necessidade"\`, \`"itens.0.qtd"\` ou \`"itens[0].qtd"\`).
- Auto-sanitização prévia de templates legados contendo tags com pontos numéricos antes da compilação pelo \`docx-templates\`.
- Negrito seletivo: strings com \`**texto**\` são convertidas em runs <w:b/> sem contaminação de estilo.
- Quebras de linha: \`\\n\` em variáveis geram múltiplos parágrafos <w:p> preservando estilos de corpo.
- **Motor Híbrido de Lista Multinível Nativa (v0.7.0):**
  - Fora de tabelas (\`<w:body>\`): gera \`word/numbering.xml\` (9 níveis decimais com \`<w:suff w:val="tab"/>\`), aplica \`<w:numPr>\` com \`<w:startOverride>\` sincronizado com o capítulo pai e remove o prefixo numérico literal do \`<w:t>\`.
  - Dentro de tabelas (\`<w:tc>\`) ou em alíneas/bullets: mantém o marcador literal separado por \`<w:r><w:tab/></w:r>\` e aplica *Hanging Indent* (\`<w:ind w:left w:hanging>\` + \`<w:tabs>\`).
- **Auto-Inspeção Integrada:** Salva automaticamente \`state/inspecao_<stem>.json\` e o espelho linear de auditoria \`state/visao_auditoria_<stem>.md\` na pasta \`state/\` do caso, dispensando rodar \`inspect_docx\` novamente.
- **Retorno Sintético MCP (< 1 KB):** Devolve \`status\`, \`engine_version\`, \`outputPath\`, \`inspection_path\`, \`visao_auditoria_path\` e \`next_step_hint\` que orienta o acionamento direto do auditor externo sobre a visão linear gerada.

### 2.5. generate_audit_docx
Compila o parecer executivo de auditoria de controle externo em layout vertical A4 (ZERO tabelas <w:tbl>, 100% largura útil), com sanitização de crases e enums, fichas verticais e transcrições integrais em blocos de citação recuados.
- **Validação Fail-Fast e Exact Copy-Paste Error (v0.6.2):** Campos obrigatórios \`processo_id\` e \`resumo_executivo\` devem ser strings não-vazias; \`apontamentos\` deve ser array.
- **Retorno Sintético MCP (< 1 KB):** Devolve JSON sintético com \`status\`, \`engine_version\`, \`outputPath\`, \`message\` e \`next_step_hint\`.
- **Contrato Canônico de \`relatorio_auditoria.json\`:**
\`\`\`json
${EXACT_COPY_PASTE_AUDIT_REPORT_SNIPPET}
\`\`\`

---

## 3. Cache Global, Rastreabilidade Temporal e Sanity Check (core/registry/templates/)
- Os templates homologados são armazenados em \`core/registry/templates/<template_id>.json\` com \`created_at\`, \`updated_at\`, \`engine_version\` e \`slots_count\`.
- Ao atualizar um template já existente no disco, o \`created_at\` original é preservado e \`updated_at\` é renovado.
- Caches legados sem \`created_at\` ou \`updated_at\` são aceitos sem erro e sem usar \`mtime\` do disco, reportando \`"NÃO DISPONÍVEL"\`, \`age_days: null\` e \`cache_date_status: "UNKNOWN"\` para informar ao usuário no Gate 1.
- O método \`loadAllRegistryTemplates\` executa normalização automática em cada entrada e descarta silenciosamente manifestos corrompidos com 0 regras.
`.trim();
}

