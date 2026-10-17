import { VERSION } from "../constants/index.ts";
import {
  EXACT_COPY_PASTE_SLOTS_MANIFEST_SNIPPET,
  EXACT_COPY_PASTE_CANONICAL_SLOTS_MANIFEST_SNIPPET,
  EXACT_COPY_PASTE_AUDIT_REPORT_SNIPPET,
} from "../contracts/errors.ts";

// ============================================================================
// Especificação Técnica Integral em Markdown (--dump-spec v0.6.3)
// ============================================================================

export function generateEngineSpecMarkdown(): string {
  return `# Especificação Técnica do Motor docgov-docx-engine (v${VERSION})

Documento normativo e especificação canônica do motor standalone \`docgov-docx-engine\` e servidor MCP para o ecossistema DocGov.

---

## 1. Diretrizes de Comunicação e Resiliência MCP

1. **Teto Estrito de Payload MCP (< 1024 bytes):** Todo retorno de ferramenta via stdio MCP DEVE ser um JSON sintético conciso (< 1 KB) para evitar truncamento em logs e buffers das IDEs consumidoras. Mapas estruturais densos (\`toc_map\`) e espelhos lineares de leitura integral (\`visao_auditoria_*.md\`) são persistidos no diretório \`state/\` do caso e apenas referenciados no payload sintético.
2. **Padrão Exact Copy-Paste Error (Zero Silent No-Op e Fail-Fast Estrito):** É expressamente proibido retornar \`status: "success"\` se \`applied_slots_count === 0\` ou se o manifesto contiver chaves desconhecidas ou inválidas. Ao detectar erro de validação em \`slots_manifest.json\` ou \`relatorio_auditoria.json\`, o motor interrompe a execução com mensagem imperativa acompanhada do snippet JSON canônico pronto para copiar e colar, eliminando leituras exploratórias cegas.
3. **Neutralidade Institucional Absoluta:** O motor e seus contratos utilizam exclusivamente identificadores canônicos universais e genéricos: \`ORGAO_CONTRATANTE\`, \`MUNICIPIO_GENERICO\`, \`ORGAO_A\`, \`ORGAO_B\`, \`AGU\`, \`MGI\`, \`TCU\`.
4. **Resiliência e Cache Global (core/registry/templates/):** O motor realiza matching 1-para-N contra o cache global, com suporte a reancoragem automática de coordenadas (Auto-Offset) em caso de drift (75%-99%) e sanity check descartando entradas corrompidas.

---

## 2. Ferramentas MCP Nativas (5 Tools)

### 2.1. bootstrap_case
Inicializa a governança de pastas do caso (\`inputs/\`, \`state/\`, \`output/\`), preserva nomes legíveis, infere extensões por magic bytes (\`PK\\x03\\x04\` para .docx e \`%PDF\` para .pdf), aceita \`fileRenameMap\` opcional, realiza auto-batismo de uploads anônimos (\`media_*\` -> \`<TIPO>_<ORGAO>_<hash4>.<ext>\`), inspeciona minutas \`.docx\` imediatamente gerando \`state/estrutura_<stem>.json\` com \`toc_map\`, e inicia salvaguarda assíncrona de PDFs. Retorna sumário executivo sintético (< 1 KB).

### 2.2. inspect_docx
Engenharia reversa estrutural completa de arquivos Word (.docx). Constrói no topo do JSON o índice estrutural rápido (\`toc_map\`), calcula a impressão digital (\`structure_fingerprint\`), realiza busca 1-para-N no cache global (\`core/registry/templates/\`) com status \`EXACT\`, \`MODIFIED\` (reancoragem automática Auto-Offset gerando \`state/adapted_slots_manifest.json\` em drift 75%-99%) ou \`NEW\`. Gera o espelho linear de auditoria \`state/visao_auditoria_<nome>.md\` para leitura cega em turno único e devolve no MCP sumário sintético \`toc_summary\` (< 1 KB).

### 2.3. build_docx_template
Transforma documento Word (.docx) bruto em template parametrizado com tags \`{{...}}\` preservando 100% da formatação OpenXML (<w:pPr>, <w:rPr>, estilos, cabeçalhos e tabelas).
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
- Desaninhamento (*unflatten*) automático de chaves com notação de ponto (ex.: \`"etp.necessidade"\`).
- Negrito seletivo: strings com \`**texto**\` são convertidas em runs <w:b/> sem contaminação de estilo.
- Quebras de linha: \`\\n\` em variáveis geram múltiplos parágrafos <w:p> preservando estilos de corpo.
- Listas multinível (\`1.1\`, \`1.1.1\`) são expandidas com indentação progressiva <w:ind>.

### 2.5. generate_audit_docx
Compila o parecer executivo de auditoria de controle externo em layout vertical A4 (ZERO tabelas <w:tbl>, 100% largura útil), com sanitização de crases e enums, fichas verticais e transcrições integrais em blocos de citação recuados.
- **Validação Fail-Fast e Exact Copy-Paste Error (v0.6.2):** Campos obrigatórios \`processo_id\` e \`resumo_executivo\` devem ser strings não-vazias; \`apontamentos\` deve ser array.
- **Contrato Canônico de \`relatorio_auditoria.json\`:**
\`\`\`json
${EXACT_COPY_PASTE_AUDIT_REPORT_SNIPPET}
\`\`\`

---

## 3. Cache Global e Sanity Check (core/registry/templates/)
- Os templates homologados são armazenados em \`core/registry/templates/<template_id>.json\`.
- O método \`loadAllRegistryTemplates\` executa normalização automática em cada entrada e descarta silenciosamente manifestos corrompidos com 0 regras.
`.trim();
}

