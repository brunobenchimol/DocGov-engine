import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  chmodSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { resolve, dirname, basename, relative, extname } from "node:path";
import { spawn } from "node:child_process";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { createReport } from "docx-templates";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export const VERSION = "0.5.1";
export const GITHUB_REPO = "brunobenchimol/docgov-docx-engine";

// ============================================================================
// Autodescoberta MCP (Self-Discovery): Instruções e Guias Nativos
// ============================================================================

export const DOCX_ENGINE_INSTRUCTIONS = `
Servidor MCP standalone para manipulação, engenharia reversa, construção de templates, injeção de dados e auditoria técnico-jurídica de documentos Microsoft Word (.docx) no ecossistema DocGov.

### Ordem Canônica do Pipeline de Documentos (.docx):
1. **bootstrap_case**: Inicializa a estrutura de pastas do caso (inputs/, state/, output/), preserva nomes legíveis, infere extensões via magic bytes (PK\x03\x04 e %PDF), auto-batiza anexos opacos (media_*) com tipo semântico e hash curto (ex.: ETP_ORGAO_A_3b9d.docx) ou aplica 'fileRenameMap', copia e inspeciona imediatamente minutas .docx para inputs/ (gerando state/estrutura_<nome>.json com toc_map) e inicia salvaguarda assíncrona de PDFs.
2. **inspect_docx**: Realiza a engenharia reversa estrutural de qualquer .docx bruto, construindo no topo do JSON o índice estrutural rápido 'toc_map' (seções P..., campos de formulário T...R...C... com suggested_target_slot e resumo de tabelas) e devolvendo no MCP um 'toc_summary' conciso (< 1 KB).
3. **build_docx_template**: Transforma o .docx bruto em um template parametrizado com tags {{...}} a partir das regras do slots_manifest.json (com auto-reparo e diagnóstico cirúrgico de JSON), preservando 100% da formatação visual (<w:pPr>, <w:rPr>, estilos e tabelas).
4. **fill_docx_template**: Injeta os dados do estado_caso.json no template .docx gerado (com unflatten automático de chaves com notação de ponto, ex.: "etp.necessidade"), resolvendo variáveis simples, loops FOR em tabelas, blocos IF, quebras de linha em múltiplos parágrafos, negrito seletivo e listas recursivas multinível.
   - *Nota de Transição para Auditoria:* Após o preenchimento, execute 'inspect_docx' sobre a minuta gerada em output/ (gerando state/inspecao_output.json com toc_map) para fornecer o mapa estrutural atualizado ao agente auditor.
5. **generate_audit_docx**: Compila o relatório executivo de auditoria de controle externo a partir de relatorio_auditoria.json em layout vertical A4 (zero tabelas <w:tbl>, 100% largura útil), com fichas individualizadas e transcrições probatórias integrais.

### Sintaxe Suportada de Tags e Recursos de Resiliência:
- Variáveis Simples: {{variavel}} ou {{objeto.propriedade}}
- Notação de Ponto Resiliente: Chaves na raiz como "etp.necessidade" são automaticamente desaninhadas (unflattened) para resolver {{etp.necessidade}}.
- Loops em Tabelas e Listas: {{FOR item IN lista}} ... {{$item.prop}} ... {{END-FOR item}}
- Condicionais: {{IF condicao}} ... {{END-IF}}
- Negrito Seletivo: **texto em negrito** dentro de strings é convertido automaticamente em runs <w:b/> sem herança indevida do estilo do subtítulo.
- Quebras de Linha: Quebras '\\n' em variáveis de texto são desmembradas em parágrafos <w:p> reais preservando formatação de corpo.
- Listas Hierárquicas Multinível: Suporte nativo a subitens numerados (1.1, 1.1.1, 1.1.1.1, 1.1.1.1.1) com recuo progressivo <w:ind> e achatamento recursivo de árvores de subitens.
- Tolerância a JSON: Parser tolerante automático (safeReadJsonFile) com auto-reparo de BOM, trailing commas e quebras de linha literais em strings, além de diagnóstico cirúrgico com linha/coluna e snippet de 5 linhas numeradas com marcador <-- ERRO AQUI.
- Nomenclatura Semântica & Magic Bytes: Preservação de nomes humanos, auto-batismo de uploads anônimos (media_*) com prefixo semântico e hash curto de 4 caracteres, e inferência de extensão por magic bytes (PK\x03\x04 para .docx e %PDF para .pdf).
`.trim();

export const DOCX_WORKFLOW_GUIDE_TEXT = `
# Guia de Arquitetura e Engenharia de Templates Word (.docx) — docgov-docx

Este guia orienta agentes de IA e clientes MCP no ciclo completo de tratamento de documentos do ecossistema DocGov.

---

## 1. Pipeline Canônico de 5 Passos

### Passo 1: Inicialização do Caso (bootstrap_case)
- **Chamada:** \`bootstrap_case({ caseDir: "cases/<nome_caso>", uploadsDir: ".user_uploaded", fileRenameMap: { "media_179...": "ETP_Modelo.docx" } })\`
- **Efeito:**
  - Cria as pastas \`inputs/\`, \`state/\` e \`output/\`.
  - Resolve nomes legíveis: preserva nomes originais humanos, aceita \`fileRenameMap\` explícito ou realiza auto-batismo semântico de anexos opacos (\`media_*\` -> \`<TIPO>_<ORGAO>_<hash4>.<ext>\`) com inferência de extensão via magic bytes (\`PK\\x03\\x04\` para .docx e \`%PDF\` para .pdf).
  - Copia minutas \`.docx\` para \`inputs/\` e as inspeciona instantaneamente, gravando \`state/estrutura_<stem>.json\` com \`toc_map\`.
  - Inicia a cópia em segundo plano de PDFs volumosos (acompanhamento via \`state/salvaguarda_status.json\`).
  - Retorna um JSON sintético (< 1 KB) com status, contadores, \`ingested_files\` e referências dos arquivos.

### Passo 2: Mapeamento Estrutural (inspect_docx)
- **Chamada:** \`inspect_docx({ docxPath: "cases/<nome_caso>/inputs/modelo_etp.docx", outputPath: "cases/<nome_caso>/state/estrutura_etp.json", compact: true })\`
- **Efeito:**
  - Analisa o OpenXML bruto (\`document.xml\`, \`header1.xml\`, \`footer1.xml\`).
  - Constrói o índice estrutural rápido \`toc_map\` no topo do JSON contendo:
    - Seções/Títulos: \`{ "coord": "P12", "title": "1. OBJETO", "suggested_target_slot": "P13" }\`
    - Campos/Perguntas de Formulários: \`{ "coord": "T0.R4.C0", "title": "Qual a necessidade?", "suggested_target_slot": "T0.R5.C0" }\`
    - Tabelas: \`{ "table_index": 1, "rows": 15, "cols": 6, "headers": [...], "sample_row_coord": "T1.R1" }\`
  - Retorna um sumário executivo conciso (\`toc_summary\`) de tamanho < 1 KB no corpo da chamada MCP.

### Passo 3: Parametrização do Template (build_docx_template)
- **Chamada:** \`build_docx_template({ sourcePath: "cases/<nome_caso>/inputs/modelo_etp.docx", manifestPath: "cases/<nome_caso>/state/slots_manifest.json", outputPath: "cases/<nome_caso>/state/template_etp.docx" })\`
- **Tolerância a JSON:** Se o \`slots_manifest.json\` contiver trailing commas ou quebras em strings, o motor repara automaticamente o arquivo e o regrava limpo.
- **Estrutura do slots_manifest.json:**
\`\`\`json
{
  "replace_paragraphs": [
    { "start_p": 3, "end_p": 5, "tag": "{{estudo.descricao_necessidade}}" }
  ],
  "replace_table_cells": [
    { "table_index": 0, "row_index": 0, "cell_index": 1, "tag": "{{metadados.unidade_requisitante}}" }
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
    { "find": "Texto Antigo Fixo", "replace": "{{metadados.orgao}}" }
  ]
}
\`\`\`

### Passo 4: Injeção de Dados e Geração da Minuta (fill_docx_template)
- **Chamada:** \`fill_docx_template({ templatePath: "cases/<nome_caso>/state/template_etp.docx", statePath: "cases/<nome_caso>/state/estado_caso.json", outputPath: "cases/<nome_caso>/output/ETP_Final.docx" })\`
- **Recursos Nativos:**
  - Auto-saneamento de JSON e desaninhamento (*unflatten*) automático de chaves com notação de ponto (ex.: \`"etp.objeto": "..."\`).
  - Textos com \`**negrito**\` são renderizados em negrito seletivo (<w:b/>) sem contaminação do parágrafo.
  - Quebras \`\\n\` são convertidas em parágrafos reais <w:p>.
  - Listas multinível (\`1.1\`, \`1.1.1\`) são expandidas com indentação progressiva <w:ind>.

### Passo de Transição: Inspeção do Documento Gerado
- Antes de iniciar a auditoria externa, execute \`inspect_docx\` sobre \`output/ETP_Final.docx\` gerando \`state/inspecao_output.json\`.
- Isso garante coordenadas exatas e fidelidade textual para a análise de conformidade do auditor.

### Passo 5: Parecer Executivo de Auditoria (generate_audit_docx)
- **Chamada:** \`generate_audit_docx({ auditJsonPath: "cases/<nome_caso>/state/relatorio_auditoria.json", outputPath: "cases/<nome_caso>/output/Relatorio_Auditoria_ETP.docx" })\`
- **Características:**
  - Layout editorial vertical A4 corrido (ZERO tabelas <w:tbl>, 100% largura útil).
  - Sanitização de crases markdown, coordenadas técnicas e códigos de enum.
  - Fichas verticais individualizadas com múltiplos trechos probatórios transcritos em blocos de citação recuados.
`.trim();

// ============================================================================
// Interfaces e Tipos
// ============================================================================

export interface ParagraphNumberingInfo {
  numId: string;
  level: number;
}

export interface HeaderFooterParagraphInfo {
  part: string;
  index: number;
  paragraphIndex: number;
  style: string | null;
  text: string;
  numbering?: ParagraphNumberingInfo;
}

export interface BodyParagraphInfo {
  index: number;
  style: string | null;
  text: string;
  numbering?: ParagraphNumberingInfo;
}

export interface TableCellInfo {
  cellIndex: number;
  text: string;
}

export interface TableRowInfo {
  rowIndex: number;
  cells: TableCellInfo[];
}

export interface TableInfo {
  index: number;
  rows: TableRowInfo[];
}

export interface TocParagraphItem {
  coord: string;
  title: string;
  suggested_target_slot?: string;
}

export interface TocFormCellItem {
  coord: string;
  title: string;
  suggested_target_slot?: string;
}

export interface TocTableItem {
  table_index: number;
  rows: number;
  cols: number;
  headers: string[];
  sample_row_coord?: string;
}

export interface DocxTocMap {
  sections: TocParagraphItem[];
  form_fields: TocFormCellItem[];
  tables: TocTableItem[];
}

export interface DocxInspectionResult {
  toc_map?: DocxTocMap;
  headers: HeaderFooterParagraphInfo[];
  footers: HeaderFooterParagraphInfo[];
  paragraphs: BodyParagraphInfo[];
  tables: TableInfo[];
}

export interface ReplaceParagraphRule {
  start_p: number;
  end_p: number;
  tag: string;
}

export interface LoopParagraphsRule {
  start_p: number;
  end_p: number;
  for_open_tag: string;
  for_close_tag: string;
  item_tag: string;
}

export interface ReplaceTableCellRule {
  table_index: number;
  row_index: number;
  cell_index: number;
  tag: string;
}

export interface LoopTableRowsRule {
  table_index: number;
  header_row_index: number;
  template_row_index: number;
  remove_from_row?: number;
  remove_to_row?: number;
  for_open_tag: string;
  for_close_tag: string;
  cell_tags: string[];
}

export interface ReplaceInlineRule {
  find: string;
  replace: string;
}

export interface SlotsManifest {
  replace_paragraphs?: ReplaceParagraphRule[];
  loop_paragraphs?: LoopParagraphsRule[];
  replace_table_cells?: ReplaceTableCellRule[];
  loop_table_rows?: LoopTableRowsRule[];
  replace_inline?: ReplaceInlineRule[];
}

export interface SelfUpdateOptions {
  checkOnly?: boolean;
  force?: boolean;
  targetPath?: string;
}

export interface SelfUpdateResult {
  updated: boolean;
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  targetPath: string;
  message: string;
}

export interface BackgroundCopyInfo {
  status: "started" | "idle" | "completed";
  totalFiles: number;
  files: string[];
  message: string;
}

export interface SalvaguardaStatus {
  status: "in_progress" | "completed" | "partial_error";
  totalFiles: number;
  pendingFiles: string[];
  completedFiles: string[];
  failedFiles: Array<{ file: string; error: string }>;
  startedAt: string;
  updatedAt?: string;
}

export interface BackgroundCopyFileItem {
  source: string;
  target: string;
}

export type BackgroundCopyInput = string[] | BackgroundCopyFileItem[];

export interface IngestedFileSummary {
  original_name: string;
  saved_as: string;
  detected_type: string;
  structure_json?: string;
}

export interface IngestedFileSyntheticItem {
  original: string;
  saved_as: string;
  type: string;
  structure?: string;
}

export interface BootstrapCaseOptions {
  fileRenameMap?: Record<string, string>;
  waitBackground?: boolean;
  detachedCli?: boolean;
}

export interface BootstrapCaseInspectedDocx {
  fileName: string;
  docxPath: string;
  structurePath: string;
  tablesCount: number;
  paragraphsCount: number;
  compactStructure: DocxInspectionResult;
}

export interface BootstrapCaseResult {
  status: "success";
  caseDir: string;
  copiedFiles: string[];
  backgroundFiles: string[];
  backgroundCopy: BackgroundCopyInfo;
  inspectedDocx: BootstrapCaseInspectedDocx[];
  ingestedFiles?: IngestedFileSummary[];
}

export interface BootstrapCaseSyntheticDocx {
  filename: string;
  structure_json: string;
  tables_count: number;
  paragraphs_count: number;
}

export interface BootstrapCaseSyntheticResult {
  status: "success";
  caseDir: string;
  ingested_files?: IngestedFileSyntheticItem[];
  docx_inspected: BootstrapCaseSyntheticDocx[];
  background_copy: {
    status: "active" | "started" | "idle" | "completed" | "partial_error";
    message: string;
  };
  next_step_hint: string;
}

export interface InspectDocxSyntheticResult {
  status: "success";
  docxPath: string;
  outputPath: string;
  tables: number;
  rows: number;
  paragraphs: number;
  toc_summary?: Array<{
    coord: string;
    title: string;
    target?: string;
  }>;
  next_step_hint: string;
}

export interface AuditDocumentExcerpt {
  secao_legivel?: string;
  texto_transcrito?: string;
  [key: string]: any;
}

export interface AuditFinding {
  id?: string;
  severidade?: string;
  status?: string;
  titulo_apontamento?: string;
  vulnerabilidade?: string;
  base_legal?: string;
  localizacao?: string;
  trechos_documento?: AuditDocumentExcerpt[];
  trecho_impugnado?: string;
  risco_controle_externo?: string;
  analise_risco?: string;
  redacao_saneadora_sugerida?: string;
  redacao_saneadora?: string;
  [key: string]: any;
}

export interface AuditReportData {
  processo_id?: string;
  orgao_entidade?: string;
  artefato_auditado?: string;
  regime_juridico?: string;
  iteracao_auditoria?: number | string;
  status_global?: string;
  contagem?: {
    bloqueantes?: number;
    alertas?: number;
    conformes?: number;
  };
  resumo_executivo?: string;
  apontamentos?: AuditFinding[];
  [key: string]: any;
}

// ============================================================================
// Utilitários Internos OpenXML / DOM
// ============================================================================

function isElementMatch(node: Node, tagName?: string): node is Element {
  if (node.nodeType !== 1) return false;
  if (!tagName) return true;
  const el = node as Element;
  const localTarget = tagName.includes(":") ? tagName.split(":")[1] : tagName;
  return (
    el.nodeName === tagName ||
    el.localName === localTarget ||
    el.nodeName.endsWith(`:${localTarget}`)
  );
}

function getDirectChildElements(parent: Node, tagName?: string): Element[] {
  const result: Element[] = [];
  if (!parent || !parent.childNodes) return result;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i];
    if (isElementMatch(child, tagName)) {
      result.push(child);
    }
  }
  return result;
}

function getAllElements(root: Node, tagName: string): Element[] {
  const result: Element[] = [];
  function walk(node: Node) {
    if (!node || !node.childNodes) return;
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (isElementMatch(child, tagName)) {
        result.push(child);
      }
      if (child.nodeType === 1) {
        walk(child);
      }
    }
  }
  walk(root);
  return result;
}

function extractParagraphText(p: Element): string {
  const parts: string[] = [];
  function walk(node: Node, insideWT: boolean) {
    if (!node || !node.childNodes) return;
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (
        isElementMatch(child, "w:br") ||
        isElementMatch(child, "w:cr")
      ) {
        parts.push("\n");
      } else if (child.nodeType === 3 && insideWT) {
        parts.push(child.nodeValue ?? "");
      } else if (child.nodeType === 1) {
        const nowInsideWT = insideWT || isElementMatch(child, "w:t");
        walk(child, nowInsideWT);
      }
    }
  }
  walk(p, isElementMatch(p, "w:t"));
  return parts.join("");
}

function extractParagraphStyle(p: Element): string | null {
  const pPrList = getDirectChildElements(p, "w:pPr");
  if (pPrList.length === 0) return null;
  const pStyleList = getDirectChildElements(pPrList[0], "w:pStyle");
  if (pStyleList.length === 0) return null;
  return (
    pStyleList[0].getAttribute("w:val") ||
    pStyleList[0].getAttribute("val") ||
    null
  );
}

function extractParagraphNumbering(
  p: Element
): ParagraphNumberingInfo | undefined {
  const pPrList = getDirectChildElements(p, "w:pPr");
  if (pPrList.length === 0) return undefined;
  const numPrList = getDirectChildElements(pPrList[0], "w:numPr");
  if (numPrList.length === 0) return undefined;
  const numIdEl = getDirectChildElements(numPrList[0], "w:numId")[0];
  const ilvlEl = getDirectChildElements(numPrList[0], "w:ilvl")[0];
  const numId =
    numIdEl?.getAttribute("w:val") || numIdEl?.getAttribute("val") || null;
  if (!numId || numId === "0") return undefined;
  const ilvlStr =
    ilvlEl?.getAttribute("w:val") || ilvlEl?.getAttribute("val") || "0";
  return {
    numId,
    level: parseInt(ilvlStr, 10) || 0,
  };
}

function extractCellText(tc: Element): string {
  const paragraphs = getDirectChildElements(tc, "w:p");
  if (paragraphs.length === 0) {
    return extractParagraphText(tc);
  }
  return paragraphs.map((p) => extractParagraphText(p)).join("\n");
}

function normalizeTag(tag: string): string {
  if (!tag) return "";
  return tag.includes("{{") ? tag : `{{${tag}}}`;
}

export function hasBoldProperty(rPr: Element | null): boolean {
  if (!rPr) return false;
  const bList = [
    ...getDirectChildElements(rPr, "w:b"),
    ...getDirectChildElements(rPr, "w:bCs"),
  ];
  if (bList.length === 0) return false;
  return bList.some((b) => {
    const val = b.getAttribute("w:val") || b.getAttribute("val");
    return val !== "0" && val !== "false";
  });
}

export function stripBoldFromRPr(rPr: Element): Element {
  const cloned = rPr.cloneNode(true) as Element;
  const toRemove = [
    ...getDirectChildElements(cloned, "w:b"),
    ...getDirectChildElements(cloned, "w:bCs"),
  ];
  for (const el of toRemove) {
    cloned.removeChild(el);
  }
  return cloned;
}

function stripBoldFromPPr(pPr: Element): Element {
  const cloned = pPr.cloneNode(true) as Element;
  const pRPrList = getDirectChildElements(cloned, "w:rPr");
  for (const pRPr of pRPrList) {
    const toRemove = [
      ...getDirectChildElements(pRPr, "w:b"),
      ...getDirectChildElements(pRPr, "w:bCs"),
    ];
    for (const el of toRemove) {
      pRPr.removeChild(el);
    }
  }
  return cloned;
}

function addBoldToRPr(doc: Document, baseRPr: Element | null): Element {
  const cloned = baseRPr
    ? stripBoldFromRPr(baseRPr)
    : doc.createElement("w:rPr");
  cloned.appendChild(doc.createElement("w:b"));
  cloned.appendChild(doc.createElement("w:bCs"));
  return cloned;
}

export function findBodyRunProperties(paragraphs: Element[]): Element | null {
  let firstRPr: Element | null = null;
  let hasNonBoldTextRun = false;

  for (const p of paragraphs) {
    if (!p) continue;
    const runs = getDirectChildElements(p, "w:r");
    for (const r of runs) {
      const text = getAllElements(r, "w:t")
        .map((t) => t.textContent ?? "")
        .join("")
        .trim();
      if (!text) continue;

      const rPrList = getDirectChildElements(r, "w:rPr");
      const rPr = rPrList.length > 0 ? rPrList[0] : null;

      if (!firstRPr && rPr) {
        firstRPr = rPr.cloneNode(true) as Element;
      }

      if (!hasBoldProperty(rPr)) {
        hasNonBoldTextRun = true;
        if (rPr) {
          // Preferir o <w:rPr> da primeira run de corpo (sem negrito)
          return rPr.cloneNode(true) as Element;
        }
      }
    }
  }

  // Se havia runs sem rPr explícito (texto normal) e a 1ª run tinha <w:b/>,
  // preserva fonte/tamanho da 1ª run mas remove <w:b/> e <w:bCs/>
  if (firstRPr && hasNonBoldTextRun && hasBoldProperty(firstRPr)) {
    return stripBoldFromRPr(firstRPr);
  }
  return firstRPr;
}

function findBodyParagraphProperties(paragraphs: Element[]): Element | null {
  let firstPPr: Element | null = null;
  for (const p of paragraphs) {
    if (!p) continue;
    const pPrList = getDirectChildElements(p, "w:pPr");
    const pPr = pPrList.length > 0 ? pPrList[0] : null;
    if (!firstPPr && pPr) {
      firstPPr = pPr.cloneNode(true) as Element;
    }
    const runs = getDirectChildElements(p, "w:r");
    const hasNonBoldRun = runs.some((r) => {
      const text = getAllElements(r, "w:t")
        .map((t) => t.textContent ?? "")
        .join("")
        .trim();
      if (!text) return false;
      const rPr = getDirectChildElements(r, "w:rPr")[0] ?? null;
      return !hasBoldProperty(rPr);
    });
    if (hasNonBoldRun && pPr) {
      return stripBoldFromPPr(pPr);
    }
  }
  return firstPPr ? stripBoldFromPPr(firstPPr) : null;
}

function setParagraphSingleRunText(
  doc: Document,
  p: Element,
  text: string,
  preferredRPr?: Element | null,
  preferredPPr?: Element | null
): void {
  const pPrList = getDirectChildElements(p, "w:pPr");
  let clonedPPr =
    preferredPPr !== undefined
      ? preferredPPr
      : pPrList.length > 0
        ? (pPrList[0].cloneNode(true) as Element)
        : null;

  const clonedRPr =
    preferredRPr !== undefined ? preferredRPr : findBodyRunProperties([p]);

  if (clonedPPr && !hasBoldProperty(clonedRPr)) {
    clonedPPr = stripBoldFromPPr(clonedPPr);
  }

  while (p.firstChild) {
    p.removeChild(p.firstChild);
  }

  if (clonedPPr) {
    p.appendChild(clonedPPr.cloneNode(true));
  }

  const r = doc.createElement("w:r");
  if (clonedRPr) {
    r.appendChild(clonedRPr.cloneNode(true));
  }

  const t = doc.createElement("w:t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = text;
  r.appendChild(t);

  p.appendChild(r);
}

function setTableCellSingleParagraphText(
  doc: Document,
  tc: Element,
  text: string
): void {
  const tcPrList = getDirectChildElements(tc, "w:tcPr");
  const clonedTcPr =
    tcPrList.length > 0 ? (tcPrList[0].cloneNode(true) as Element) : null;

  const existingParagraphs = getDirectChildElements(tc, "w:p");
  const firstP =
    existingParagraphs.length > 0
      ? existingParagraphs[0]
      : doc.createElement("w:p");
  const bodyRPr = findBodyRunProperties(existingParagraphs);
  const bodyPPr = findBodyParagraphProperties(existingParagraphs);

  setParagraphSingleRunText(doc, firstP, text, bodyRPr, bodyPPr);

  while (tc.firstChild) {
    tc.removeChild(tc.firstChild);
  }

  if (clonedTcPr) {
    tc.appendChild(clonedTcPr);
  }
  tc.appendChild(firstP);
}

function appendTextRunToTableCell(
  doc: Document,
  tc: Element,
  textToAppend: string
): void {
  const paragraphs = getDirectChildElements(tc, "w:p");
  let lastP: Element;
  if (paragraphs.length > 0) {
    lastP = paragraphs[paragraphs.length - 1];
  } else {
    lastP = doc.createElement("w:p");
    tc.appendChild(lastP);
  }

  const clonedRPr = findBodyRunProperties(paragraphs);
  const r = doc.createElement("w:r");
  if (clonedRPr) {
    r.appendChild(clonedRPr);
  }
  const t = doc.createElement("w:t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = textToAppend;
  r.appendChild(t);
  lastP.appendChild(r);
}

function applyInlineReplacementsToXmlDoc(
  xmlDoc: Document,
  rules: ReplaceInlineRule[]
): boolean {
  if (!rules || rules.length === 0) return false;
  let modified = false;
  const paragraphs = getAllElements(xmlDoc, "w:p");

  for (const p of paragraphs) {
    for (const rule of rules) {
      if (!rule.find) continue;
      const tNodes = getAllElements(p, "w:t");
      if (tNodes.length === 0) continue;

      const fullText = tNodes.map((t) => t.textContent ?? "").join("");
      if (!fullText.includes(rule.find)) continue;

      const updatedText = fullText.split(rule.find).join(rule.replace);
      tNodes[0].setAttribute("xml:space", "preserve");
      tNodes[0].textContent = updatedText;

      for (let i = 1; i < tNodes.length; i++) {
        const extraT = tNodes[i];
        const parentRun = extraT.parentNode as Element | null;
        if (parentRun && isElementMatch(parentRun, "w:r")) {
          parentRun.removeChild(extraT);
          const remainingChildren = getDirectChildElements(parentRun);
          const hasNonRPr = remainingChildren.some(
            (ch) => !isElementMatch(ch, "w:rPr")
          );
          if (!hasNonRPr && parentRun.parentNode) {
            parentRun.parentNode.removeChild(parentRun);
          }
        } else if (extraT.parentNode) {
          extraT.parentNode.removeChild(extraT);
        }
      }
      modified = true;
    }
  }

  return modified;
}

async function ensureContentTypesOverride(zip: JSZip): Promise<void> {
  const contentTypesPath = "[Content_Types].xml";
  const file = zip.file(contentTypesPath);
  const expectedPartName = "/word/document.xml";
  const expectedContentType =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

  if (!file) {
    const defaultXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="${expectedPartName}" ContentType="${expectedContentType}"/>
</Types>`;
    zip.file(contentTypesPath, defaultXml);
    return;
  }

  const xmlStr = await file.async("string");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
  const typesRoot = getAllElements(xmlDoc, "Types")[0] ?? xmlDoc.documentElement;
  if (!typesRoot) return;

  const overrides = getDirectChildElements(typesRoot, "Override");
  let found = false;
  for (const ov of overrides) {
    if (ov.getAttribute("PartName") === expectedPartName) {
      ov.setAttribute("ContentType", expectedContentType);
      found = true;
      break;
    }
  }

  if (!found) {
    const ov = xmlDoc.createElement("Override");
    ov.setAttribute("PartName", expectedPartName);
    ov.setAttribute("ContentType", expectedContentType);
    typesRoot.appendChild(ov);
  }

  const serializer = new XMLSerializer();
  zip.file(contentTypesPath, serializer.serializeToString(xmlDoc));
}

// ============================================================================
// 1. Função de Inspeção Estrutural (inspect_docx) & Bootstrap de Caso
// ============================================================================

export function buildTocMap(
  paragraphs: BodyParagraphInfo[],
  tables: TableInfo[]
): DocxTocMap {
  const sections: TocParagraphItem[] = [];
  const form_fields: TocFormCellItem[] = [];
  const tocTables: TocTableItem[] = [];

  // 1. Mapeamento de Títulos e Seções em Parágrafos
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const text = p.text.trim();
    if (!text || text.length > 150) continue;

    const hasHeadingStyle =
      p.style !== null &&
      /^(?:Heading|Titulo|Título|T[ií]tulo|Header|Se[çc][ãa]o)/i.test(p.style);

    const isNumberedSection =
      /^(?:(?:\d+(?:\.\d+)*|[A-Z]|\b[IVXLCDM]+\b)[\.\-\)\s]|CL[ÁA]USULA|SE[ÇC][ÃA]O|CAP[IÍ]TULO|ANEXO)\s+[A-ZÀ-Ú0-9]/i.test(
        text
      );

    const isCommonAdminHeader =
      /^(?:ESTUDO T[EÉ]CNICO PRELIMINAR|TERMO DE REFER[EÊ]NCIA|PROJETO B[AÁ]SICO|JUSTIFICATIVA|OBJETO(?:\s+DA\s+CONTRATA[ÇC][ÃA]O)?|DISPOSI[ÇC][ÕO]ES GERAIS|MATRIZ DE RISCOS|CRONOGRAMA|PESQUISA DE PRE[ÇC]OS|CRIT[EÉ]RIOS DE HABILITA[ÇC][ÃA]O|DISPOSI[ÇC][ÕO]ES FINAIS)\b/i.test(
        text
      );

    const isAllCapsTitle =
      text.length >= 4 &&
      text.length <= 100 &&
      text === text.toUpperCase() &&
      /[A-ZÀ-Ú]/.test(text) &&
      !/[;,.]$/.test(text) &&
      !text.includes("\n");

    if (
      hasHeadingStyle ||
      isNumberedSection ||
      isCommonAdminHeader ||
      isAllCapsTitle
    ) {
      sections.push({
        coord: `P${p.index}`,
        title: text,
        suggested_target_slot:
          i + 1 < paragraphs.length ? `P${paragraphs[i + 1].index}` : undefined,
      });
    }
  }

  // 2. Mapeamento de Campos e Perguntas em Tabelas de Formulário
  for (const tbl of tables) {
    for (let rIdx = 0; rIdx < tbl.rows.length; rIdx++) {
      const row = tbl.rows[rIdx];
      for (let cIdx = 0; cIdx < row.cells.length; cIdx++) {
        const cell = row.cells[cIdx];
        const txt = cell.text.trim();
        if (!txt || txt.length > 250) continue;

        const isQuestion = txt.endsWith("?") || txt.includes("?");
        const isLabel =
          txt.endsWith(":") && txt.length <= 100 && !txt.includes("\n");
        const isNumberedPrompt =
          /^\d+(\.\d+)*\s+[A-ZÀ-Ú]/i.test(txt) && txt.length <= 100;
        const isTwoColKey =
          row.cells.length === 2 &&
          cIdx === 0 &&
          txt.length <= 100 &&
          !txt.includes("\n");

        if (isQuestion || isLabel || isNumberedPrompt || isTwoColKey) {
          let suggestedTarget: string | undefined;

          // Se houver célula adjacente à direita na mesma linha
          if (cIdx + 1 < row.cells.length) {
            suggestedTarget = `T${tbl.index}.R${row.rowIndex}.C${row.cells[cIdx + 1].cellIndex}`;
          } else if (rIdx + 1 < tbl.rows.length) {
            // Se for coluna única, o alvo costuma ser a linha imediatamente abaixo
            const nextRow = tbl.rows[rIdx + 1];
            const targetCell =
              nextRow.cells.find((c) => c.cellIndex === cell.cellIndex) ??
              nextRow.cells[0];
            if (targetCell) {
              suggestedTarget = `T${tbl.index}.R${nextRow.rowIndex}.C${targetCell.cellIndex}`;
            }
          }

          form_fields.push({
            coord: `T${tbl.index}.R${row.rowIndex}.C${cell.cellIndex}`,
            title: txt.length > 120 ? `${txt.slice(0, 117)}...` : txt,
            ...(suggestedTarget ? { suggested_target_slot: suggestedTarget } : {}),
          });
        }
      }
    }

    // 3. Resumo Estrutural das Tabelas
    const rowsCount = tbl.rows.length;
    let maxCols = 0;
    for (const r of tbl.rows) {
      if (r.cells.length > maxCols) maxCols = r.cells.length;
    }

    const firstRowCells = tbl.rows[0]?.cells ?? [];
    const headers = firstRowCells
      .map((c) => c.text.trim().replace(/\r?\n/g, " "))
      .filter((t) => t.length > 0);

    tocTables.push({
      table_index: tbl.index,
      rows: rowsCount,
      cols: maxCols,
      headers,
      sample_row_coord: rowsCount > 1 ? `T${tbl.index}.R1` : undefined,
    });
  }

  return {
    sections,
    form_fields,
    tables: tocTables,
  };
}

export function compactInspectionResult(
  full: DocxInspectionResult
): DocxInspectionResult {
  return {
    ...(full.toc_map ? { toc_map: full.toc_map } : {}),
    headers: full.headers.filter((h) => h.text.trim() !== ""),
    footers: full.footers.filter((f) => f.text.trim() !== ""),
    paragraphs: full.paragraphs.filter((p) => p.text.trim() !== ""),
    tables: full.tables.map((t) => ({
      index: t.index,
      rows: t.rows
        .map((r) => ({
          rowIndex: r.rowIndex,
          cells: r.cells.filter((c) => c.text.trim() !== ""),
        }))
        .filter((r) => r.cells.length > 0),
    })),
  };
}

export async function inspectDocx(
  docxPath: string,
  outputPath?: string,
  compact: boolean = false
): Promise<DocxInspectionResult> {
  const resolvedDocx = resolve(docxPath);
  if (!existsSync(resolvedDocx)) {
    throw new Error(`Arquivo .docx não encontrado: ${resolvedDocx}`);
  }

  const buffer = readFileSync(resolvedDocx);
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();

  const headers: HeaderFooterParagraphInfo[] = [];
  const footers: HeaderFooterParagraphInfo[] = [];

  const fileNames = Object.keys(zip.files).sort();

  for (const name of fileNames) {
    if (/^word\/header\d*\.xml$/i.test(name)) {
      const xmlStr = await zip.file(name)!.async("string");
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      const pList = getAllElements(xmlDoc, "w:p");
      pList.forEach((p, idx) => {
        headers.push({
          part: name,
          index: idx,
          paragraphIndex: idx,
          style: extractParagraphStyle(p),
          text: extractParagraphText(p),
        });
      });
    } else if (/^word\/footer\d*\.xml$/i.test(name)) {
      const xmlStr = await zip.file(name)!.async("string");
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      const pList = getAllElements(xmlDoc, "w:p");
      pList.forEach((p, idx) => {
        footers.push({
          part: name,
          index: idx,
          paragraphIndex: idx,
          style: extractParagraphStyle(p),
          text: extractParagraphText(p),
        });
      });
    }
  }

  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error(
      `Estrutura OpenXML inválida (word/document.xml ausente): ${resolvedDocx}`
    );
  }

  const docXmlStr = await docFile.async("string");
  const docXml = parser.parseFromString(docXmlStr, "application/xml");
  const body = getAllElements(docXml, "w:body")[0];
  if (!body) {
    throw new Error(`Elemento <w:body> não encontrado em word/document.xml`);
  }

  const bodyParagraphs = getDirectChildElements(body, "w:p");
  const paragraphs: BodyParagraphInfo[] = bodyParagraphs.map((p, index) => {
    const numbering = extractParagraphNumbering(p);
    return {
      index,
      style: extractParagraphStyle(p),
      text: extractParagraphText(p),
      ...(numbering ? { numbering } : {}),
    };
  });

  const bodyTables = getDirectChildElements(body, "w:tbl");
  const tables: TableInfo[] = bodyTables.map((tbl, index) => {
    const trList = getDirectChildElements(tbl, "w:tr");
    return {
      index,
      rows: trList.map((tr, rowIndex) => {
        const tcList = getDirectChildElements(tr, "w:tc");
        return {
          rowIndex,
          cells: tcList.map((tc, cellIndex) => ({
            cellIndex,
            text: extractCellText(tc),
          })),
        };
      }),
    };
  });

  const toc_map = buildTocMap(paragraphs, tables);

  const result: DocxInspectionResult = {
    toc_map,
    headers,
    footers,
    paragraphs,
    tables,
  };

  const finalResult = compact ? compactInspectionResult(result) : result;

  if (outputPath) {
    const resolvedOut = resolve(outputPath);
    const outDir = dirname(resolvedOut);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }
    writeFileSync(resolvedOut, JSON.stringify(finalResult, null, 2), "utf-8");
  }

  return finalResult;
}

// ============================================================================
// Autodescoberta e Auto-Batismo Semântico de Arquivos (v0.5.1)
// ============================================================================

export function detectFileExtensionFromBuffer(buf: Buffer): string | null {
  if (!buf || buf.length < 4) return null;
  // PK\x03\x04 -> .docx (Zip archive)
  if (
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    buf[2] === 0x03 &&
    buf[3] === 0x04
  ) {
    return ".docx";
  }
  // %PDF -> .pdf
  if (
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  ) {
    return ".pdf";
  }
  return null;
}

export function isOpaqueFileName(fileName: string): boolean {
  const base = basename(fileName);
  const stem = base.includes(".")
    ? base.substring(0, base.lastIndexOf("."))
    : base;
  const lower = stem.toLowerCase();

  if (
    lower.startsWith("media_") ||
    lower.startsWith("tmp_") ||
    lower.startsWith("upload_") ||
    lower.startsWith("file_")
  ) {
    return true;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(stem)) {
    return true;
  }

  const hexOnlyRegex = /^[0-9a-f]{16,}$/i;
  if (hexOnlyRegex.test(stem)) {
    return true;
  }

  return false;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
}

export function extractHash4(
  fileName: string,
  fallbackBuffer?: Buffer
): string {
  const base = basename(fileName);
  const stem = base.includes(".")
    ? base.substring(0, base.lastIndexOf("."))
    : base;

  const matches = stem.match(/[0-9a-zA-Z]{4,}$/);
  if (matches) {
    const matched = matches[0];
    return matched.slice(-4).toLowerCase();
  }

  if (fallbackBuffer && fallbackBuffer.length > 0) {
    let hash = 0;
    for (let i = 0; i < Math.min(fallbackBuffer.length, 1024); i++) {
      hash = ((hash << 5) - hash + fallbackBuffer[i]) | 0;
    }
    return (Math.abs(hash) % 0xffff).toString(16).padStart(4, "0");
  }

  return "0000";
}

function normalizeSearchText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-]+/g, " ")
    .toUpperCase();
}

function matchesWord(text: string, word: string): boolean {
  const pattern = new RegExp(`(^|[^A-Z0-9])${word}([^A-Z0-9]|$)`);
  return pattern.test(text);
}

export function extractSemanticTypeAndOrgan(rawContent: string): {
  docType?: string;
  organ?: string;
} {
  const text = normalizeSearchText(rawContent);

  let docType: string | undefined;
  if (
    text.includes("DOCUMENTO DE FORMALIZACAO DA DEMANDA") ||
    text.includes("FORMALIZACAO DA DEMANDA") ||
    matchesWord(text, "DFD")
  ) {
    docType = "DFD";
  } else if (
    text.includes("ESTUDO TECNICO PRELIMINAR") ||
    matchesWord(text, "ETP")
  ) {
    docType = "ETP";
  } else if (
    text.includes("TERMO DE REFERENCIA") ||
    text.includes("TERMO REFERENCIA") ||
    text.includes("PROJETO BASICO") ||
    matchesWord(text, "TR")
  ) {
    docType = "TR";
  } else if (
    text.includes("MATRIZ DE RISCO") ||
    text.includes("GERENCIAMENTO DE RISCO")
  ) {
    docType = "MATRIZ_RISCOS";
  } else if (text.includes("EDITAL")) {
    docType = "EDITAL";
  } else if (text.includes("MINUTA DE CONTRATO") || text.includes("CONTRATO")) {
    docType = "CONTRATO";
  }

    let organ: string | undefined;
  const organMatch = text.match(
    /\b(ORGAO_[A-Z0-9]+|SECRETARIA_[A-Z0-9]+|ENTIDADE_[A-Z0-9]+|DEPARTAMENTO_[A-Z0-9]+)\b/
  );
  if (organMatch) {
    organ = organMatch[1];
  } else if (
    matchesWord(text, "ORGAO A") ||
    text.includes("ORGAO PUBLICO CONTRATANTE")
  ) {
    organ = "ORGAO_A";
  } else if (
    matchesWord(text, "ORGAO B") ||
    text.includes("SECRETARIA EXECUTIVA DEMANDANTE")
  ) {
    organ = "ORGAO_B";
  } else if (
    matchesWord(text, "ORGAO C") ||
    text.includes("CONSULTORIA JURIDICA GERAL")
  ) {
    organ = "ORGAO_C";
  }

  return { docType, organ };
}

export async function detectDocxSemanticInfo(
  buf: Buffer
): Promise<{ docType?: string; organ?: string }> {
  try {
    const zip = await JSZip.loadAsync(buf);
    let combinedText = "";

    const coreFile = zip.file("docProps/core.xml");
    if (coreFile) {
      const coreXml = await coreFile.async("text");
      combinedText += " " + coreXml;
    }

    const docFile = zip.file("word/document.xml");
    if (docFile) {
      const docXml = await docFile.async("text");
      combinedText += " " + docXml.substring(0, 50000);
    }

    const headerFile =
      zip.file("word/header1.xml") || zip.file("word/header2.xml");
    if (headerFile) {
      const headerXml = await headerFile.async("text");
      combinedText += " " + headerXml;
    }

    return extractSemanticTypeAndOrgan(combinedText);
  } catch {
    return {};
  }
}

export function detectPdfSemanticInfo(
  buf: Buffer
): { docType?: string; organ?: string } {
  try {
    const textChunk = buf.toString("latin1", 0, Math.min(buf.length, 65536));
    return extractSemanticTypeAndOrgan(textChunk);
  } catch {
    return {};
  }
}

export async function resolveTargetFileName(
  originalFileName: string,
  fileBuffer: Buffer,
  fileRenameMap?: Record<string, string>
): Promise<{ targetFileName: string; detectedType: string; isOpaque: boolean }> {
  let currentExt = extname(originalFileName).toLowerCase();
  const magicExt = detectFileExtensionFromBuffer(fileBuffer);

  if (!currentExt && magicExt) {
    currentExt = magicExt;
  }

  // 1. Prioridade 1: fileRenameMap
  if (fileRenameMap) {
    let mapped = fileRenameMap[originalFileName];
    if (!mapped && originalFileName.includes(".")) {
      const stem = originalFileName.substring(
        0,
        originalFileName.lastIndexOf(".")
      );
      mapped = fileRenameMap[stem];
    }
    if (mapped) {
      let target = sanitizeFileName(mapped);
      if (!extname(target) && currentExt) {
        target += currentExt;
      }
      const typeInfo = extractSemanticTypeAndOrgan(target);
      return {
        targetFileName: target,
        detectedType:
          typeInfo.docType ||
          (currentExt === ".docx"
            ? "DOCX"
            : currentExt === ".pdf"
            ? "PDF"
            : "ANEXO"),
        isOpaque: false,
      };
    }
  }

  // 2. Prioridade 2: Preservação de Nomes Legíveis
  const isOpaque = isOpaqueFileName(originalFileName);
  if (!isOpaque) {
    let target = originalFileName;
    if (!extname(target) && currentExt) {
      target += currentExt;
    }
    const typeInfo = extractSemanticTypeAndOrgan(target);
    return {
      targetFileName: target,
      detectedType:
        typeInfo.docType ||
        (currentExt === ".docx"
          ? "DOCX"
          : currentExt === ".pdf"
          ? "PDF"
          : "ANEXO"),
      isOpaque: false,
    };
  }

  // 3. Prioridade 3: Auto-Batismo Semântico de Anexos Opacos (media_*)
  let semInfo: { docType?: string; organ?: string } = {};
  if (currentExt === ".docx") {
    semInfo = await detectDocxSemanticInfo(fileBuffer);
  } else if (currentExt === ".pdf") {
    semInfo = detectPdfSemanticInfo(fileBuffer);
  }

  const detectedType =
    semInfo.docType || (currentExt === ".docx" ? "DOC" : "ANEXO");
  const hash4 = extractHash4(originalFileName, fileBuffer);

  let targetStem = detectedType;
  if (semInfo.organ) {
    targetStem += `_${semInfo.organ}`;
  }
  targetStem += `_${hash4}`;

  const targetFileName = `${targetStem}${currentExt || ".bin"}`;
  return {
    targetFileName,
    detectedType,
    isOpaque: true,
  };
}

export const activeBackgroundCopies = new Map<string, Promise<void>>();

export async function executeBackgroundCopyTask(
  sourceDir: string,
  destDir: string,
  stateDir: string,
  files: BackgroundCopyInput
): Promise<void> {
  const statusFilePath = resolve(stateDir, "salvaguarda_status.json");
  const normalizedItems: BackgroundCopyFileItem[] = files.map((item) =>
    typeof item === "string" ? { source: item, target: item } : item
  );
  const pending = normalizedItems.map((i) => i.target);
  const completed: string[] = [];
  const failed: Array<{ file: string; error: string }> = [];

  const updateStatus = (status: SalvaguardaStatus["status"]) => {
    try {
      const data: SalvaguardaStatus = {
        status,
        totalFiles: normalizedItems.length,
        pendingFiles: pending.filter(
          (f) => !completed.includes(f) && !failed.some((x) => x.file === f)
        ),
        completedFiles: [...completed],
        failedFiles: [...failed],
        startedAt,
        updatedAt: new Date().toISOString(),
      };
      writeFileSync(statusFilePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // Ignora erro de gravação de status para não interromper I/O
    }
  };

  const startedAt = new Date().toISOString();
  updateStatus("in_progress");

  for (const item of normalizedItems) {
    const src = resolve(sourceDir, item.source);
    const dest = resolve(destDir, item.target);
    try {
      copyFileSync(src, dest);
      completed.push(item.target);
    } catch (err: any) {
      failed.push({ file: item.target, error: err.message });
    }
    updateStatus(
      completed.length + failed.length === normalizedItems.length
        ? failed.length === 0
          ? "completed"
          : "partial_error"
        : "in_progress"
    );
  }
}

export async function waitForBackgroundCopy(caseDir: string): Promise<void> {
  const resolved = resolve(caseDir);
  const active = activeBackgroundCopies.get(resolved);
  if (active) {
    await active;
  }
}

export async function bootstrapCase(
  caseDir: string,
  uploadsDir?: string,
  options: BootstrapCaseOptions = {}
): Promise<BootstrapCaseResult> {
  const resolvedCaseDir = resolve(caseDir);
  const inputsDir = resolve(resolvedCaseDir, "inputs");
  const stateDir = resolve(resolvedCaseDir, "state");
  const outputDir = resolve(resolvedCaseDir, "output");

  mkdirSync(inputsDir, { recursive: true });
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  const copiedFiles: string[] = [];
  const backgroundFiles: string[] = [];
  const ingestedFiles: IngestedFileSummary[] = [];
  const bgItems: BackgroundCopyFileItem[] = [];

  if (uploadsDir && existsSync(uploadsDir)) {
    const resolvedUploadsDir = resolve(uploadsDir);
    const entries = readdirSync(resolvedUploadsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith("~$")) {
        const srcPath = resolve(resolvedUploadsDir, entry.name);
        const buf = readFileSync(srcPath);

        const resolved = await resolveTargetFileName(
          entry.name,
          buf,
          options.fileRenameMap
        );

        let finalTarget = resolved.targetFileName;
        let counter = 1;
        const usedNames = new Set([
          ...copiedFiles,
          ...bgItems.map((b) => b.target),
        ]);
        while (usedNames.has(finalTarget)) {
          const ext = extname(finalTarget);
          const stem = ext ? finalTarget.slice(0, -ext.length) : finalTarget;
          finalTarget = `${stem}_${counter}${ext}`;
          counter++;
        }

        const isDocx =
          finalTarget.toLowerCase().endsWith(".docx") ||
          detectFileExtensionFromBuffer(buf) === ".docx";

        if (isDocx) {
          const destPath = resolve(inputsDir, finalTarget);
          copyFileSync(srcPath, destPath);
          copiedFiles.push(finalTarget);
          ingestedFiles.push({
            original_name: entry.name,
            saved_as: finalTarget,
            detected_type: resolved.detectedType,
          });
        } else {
          bgItems.push({
            source: entry.name,
            target: finalTarget,
          });
          backgroundFiles.push(finalTarget);
          ingestedFiles.push({
            original_name: entry.name,
            saved_as: finalTarget,
            detected_type: resolved.detectedType,
          });
        }
      }
    }

    // 2. Inicia cópia assíncrona não-bloqueante de PDFs e anexos pesados
    if (bgItems.length > 0) {
      if (options.detachedCli) {
        try {
          const binPath = resolveSelfBinaryPath();
          const child = spawn(
            binPath,
            [
              "--internal-bg-copy",
              "--source",
              resolvedUploadsDir,
              "--dest",
              inputsDir,
              "--state",
              stateDir,
              "--files",
              JSON.stringify(bgItems),
            ],
            {
              detached: true,
              stdio: "ignore",
              windowsHide: true,
            }
          );
          child.unref();
        } catch {
          // Fallback para execução in-process caso spawn falhe
          const bgPromise = executeBackgroundCopyTask(
            resolvedUploadsDir,
            inputsDir,
            stateDir,
            bgItems
          );
          activeBackgroundCopies.set(resolvedCaseDir, bgPromise);
          if (options.waitBackground) {
            await bgPromise;
          }
        }
      } else {
        const bgPromise = executeBackgroundCopyTask(
          resolvedUploadsDir,
          inputsDir,
          stateDir,
          bgItems
        );
        activeBackgroundCopies.set(resolvedCaseDir, bgPromise);
        if (options.waitBackground) {
          await bgPromise;
        }
      }
    }
  }

  // 3. Inspeciona todos os arquivos .docx encontrados em inputs/
  const inputEntries = readdirSync(inputsDir, { withFileTypes: true });
  const inspectedDocx: BootstrapCaseResult["inspectedDocx"] = [];
  for (const entry of inputEntries) {
    if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".docx") &&
      !entry.name.startsWith("~$")
    ) {
      const docxPath = resolve(inputsDir, entry.name);
      const base = entry.name.replace(/\.docx$/i, "");
      const structurePath = resolve(stateDir, `estrutura_${base}.json`);
      const full = await inspectDocx(docxPath, structurePath);
      const compact = compactInspectionResult(full);
      inspectedDocx.push({
        fileName: entry.name,
        docxPath,
        structurePath,
        tablesCount: compact.tables.length,
        paragraphsCount: compact.paragraphs.length,
        compactStructure: compact,
      });

      const relStructure = relative(resolvedCaseDir, structurePath).replace(
        /\\/g,
        "/"
      );
      const match = ingestedFiles.find((f) => f.saved_as === entry.name);
      if (match) {
        match.structure_json = relStructure;
      }
    }
  }

  const bgCopyInfo: BackgroundCopyInfo = {
    status: backgroundFiles.length > 0 ? "started" : "idle",
    totalFiles: backgroundFiles.length,
    files: backgroundFiles,
    message:
      backgroundFiles.length > 0
        ? `Salvaguarda de ${backgroundFiles.length} arquivo(s) volumoso(s) (.pdf e anexos) iniciada em segundo plano para inputs/. Acompanhe em state/salvaguarda_status.json.`
        : "Nenhum arquivo pesado pendente de cópia em segundo plano.",
  };

  return {
    status: "success",
    caseDir: resolvedCaseDir,
    copiedFiles,
    backgroundFiles,
    backgroundCopy: bgCopyInfo,
    inspectedDocx,
    ingestedFiles,
  };
}

export function formatBootstrapCaseSyntheticResult(
  res: BootstrapCaseResult,
  userCaseDir?: string
): BootstrapCaseSyntheticResult {
  const hasIngested = !!(res.ingestedFiles && res.ingestedFiles.length > 0);
  const docxLimit = res.ingestedFiles && res.ingestedFiles.length > 2 ? 0 : 1;

  return {
    status: "success",
    caseDir: userCaseDir ? userCaseDir.replace(/\\/g, "/") : res.caseDir,
    ...(hasIngested
      ? {
          ingested_files: res.ingestedFiles!.slice(0, 4).map((item) => ({
            original: item.original_name,
            saved_as: item.saved_as,
            type: item.detected_type,
            ...(item.structure_json ? { structure: item.structure_json } : {}),
          })),
        }
      : {}),
    docx_inspected: res.inspectedDocx.slice(0, docxLimit).map((item) => {
      const relPath = relative(res.caseDir, item.structurePath).replace(
        /\\/g,
        "/"
      );
      return {
        filename: item.fileName,
        structure_json: relPath,
        tables_count: item.tablesCount,
        paragraphs_count: item.paragraphsCount,
      };
    }),
    background_copy: {
      status:
        res.backgroundCopy.status === "started"
          ? "active"
          : res.backgroundCopy.status,
      message:
        res.backgroundFiles.length > 0
          ? "Salvaguarda ativa em segundo plano."
          : "Nenhum arquivo pesado pendente de cópia em segundo plano.",
    },
    next_step_hint:
      "Estrutura criada. Elabore o slots_manifest.json para 'build_docx_template'.",
  };
}

export function formatInspectDocxSyntheticResult(
  docxPath: string,
  outputPath: string,
  inspection: DocxInspectionResult
): InspectDocxSyntheticResult {
  let totalRows = 0;
  for (const table of inspection.tables) {
    totalRows += table.rows.length;
  }

  const toc_summary: Array<{ coord: string; title: string; target?: string }> =
    [];
  const tocMap = inspection.toc_map;
  if (tocMap) {
    // Adiciona até 2 seções principais
    for (const s of tocMap.sections.slice(0, 2)) {
      toc_summary.push({
        coord: s.coord,
        title: s.title.length > 25 ? `${s.title.slice(0, 22)}...` : s.title,
        ...(s.suggested_target_slot ? { target: s.suggested_target_slot } : {}),
      });
    }
    // Adiciona 1 campo de formulário principal
    for (const f of tocMap.form_fields.slice(0, 1)) {
      toc_summary.push({
        coord: f.coord,
        title: f.title.length > 25 ? `${f.title.slice(0, 22)}...` : f.title,
        ...(f.suggested_target_slot ? { target: f.suggested_target_slot } : {}),
      });
    }
    // Adiciona 1 tabela resumida
    if (tocMap.tables.length > 0) {
      const t = tocMap.tables[0];
      const headerSample = t.headers.slice(0, 2).join(", ");
      toc_summary.push({
        coord: `T${t.table_index}`,
        title: `Tbl (${t.rows}x${t.cols})${
          headerSample ? ` [${headerSample}]` : ""
        }`,
      });
    }
  }

  return {
    status: "success",
    docxPath,
    outputPath,
    tables: inspection.tables.length,
    rows: totalRows,
    paragraphs: inspection.paragraphs.length,
    ...(toc_summary.length > 0 ? { toc_summary } : {}),
    next_step_hint:
      "Inspeção gravada com toc_map. Próximo passo: elabore slots_manifest.json e chame 'build_docx_template'.",
  };
}

// ============================================================================
// Utilitários Resilientes de JSON (safeReadJsonFile, unflattenDotKeys)
// ============================================================================

export function sanitizeJsonString(raw: string): {
  sanitized: string;
  changed: boolean;
} {
  let text = raw;
  let changed = false;

  // 1. Remover BOM UTF-8 se presente
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
    changed = true;
  }

  // 2. Scanner de 1 passagem via state machine
  const chars: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        chars.push(ch);
        escape = false;
      } else if (ch === "\\") {
        chars.push(ch);
        escape = true;
      } else if (ch === '"') {
        chars.push(ch);
        inString = false;
      } else if (ch === "\r") {
        // Quebra literal não escapada em string JSON
        if (i + 1 < text.length && text[i + 1] === "\n") {
          i++; // consome \n
        }
        chars.push("\\n");
        changed = true;
      } else if (ch === "\n") {
        chars.push("\\n");
        changed = true;
      } else {
        chars.push(ch);
      }
    } else {
      // Fora de string
      if (ch === '"') {
        inString = true;
        chars.push(ch);
      } else if (ch === ",") {
        // Olhar à frente para o próximo token não-espaço
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) {
          j++;
        }
        if (j < text.length && (text[j] === "}" || text[j] === "]")) {
          // Trailing comma detectada: descarta a vírgula
          changed = true;
        } else {
          chars.push(ch);
        }
      } else {
        chars.push(ch);
      }
    }
  }

  return {
    sanitized: chars.join(""),
    changed,
  };
}

export function formatJsonErrorWithSnippet(
  filePath: string,
  raw: string,
  err: Error
): string {
  const msg = err.message || "";
  let targetLine = 1;
  let targetCol = 1;

  // Tentar encontrar "line X" e "column Y" na mensagem
  const lineMatch = msg.match(/(?:at line|line)\s*(\d+)/i);
  const colMatch = msg.match(/(?:column|col)\s*(\d+)/i);

  if (lineMatch) {
    targetLine = parseInt(lineMatch[1], 10);
    if (colMatch) {
      targetCol = parseInt(colMatch[1], 10);
    }
  } else {
    // Tentar encontrar "position X"
    const posMatch = msg.match(/(?:at position|position)\s*(\d+)/i);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const textUpToPos = raw.slice(0, Math.min(pos, raw.length));
      const lines = textUpToPos.split(/\r?\n/);
      targetLine = lines.length;
      targetCol = lines[lines.length - 1].length + 1;
    } else {
      const allLines = raw.split(/\r?\n/);
      targetLine = allLines.length;
      targetCol = allLines[allLines.length - 1].length;
    }
  }

  const allLines = raw.split(/\r?\n/);
  const startLine = Math.max(1, targetLine - 2);
  const endLine = Math.min(allLines.length, targetLine + 2);

  const snippetLines: string[] = [];
  for (let l = startLine; l <= endLine; l++) {
    const lineContent = allLines[l - 1] ?? "";
    if (l === targetLine) {
      snippetLines.push(`[Linha ${l}]: ${lineContent} <-- ERRO AQUI`);
    } else {
      snippetLines.push(`[Linha ${l}]: ${lineContent}`);
    }
  }

  return (
    `ERRO DE SINTAXE JSON em ${filePath} na Linha ${targetLine}, Coluna ${targetCol}. Trecho com erro:\n` +
    snippetLines.join("\n") +
    `\nCorrija diretamente esta linha usando replace_file_content.`
  );
}

export function safeReadJsonFile<T = any>(filePath: string): T {
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    throw new Error(`Arquivo JSON não encontrado: ${resolved}`);
  }

  const raw = readFileSync(resolved, "utf-8");

  // 1. Tentar parse padrão
  try {
    return JSON.parse(raw) as T;
  } catch (initialErr: any) {
    // 2. Tentar auto-saneamento
    const { sanitized, changed } = sanitizeJsonString(raw);
    if (changed) {
      try {
        const parsed = JSON.parse(sanitized) as T;
        // Se reparou com sucesso, regravar arquivo limpo no disco
        try {
          writeFileSync(resolved, sanitized, "utf-8");
        } catch {
          // Ignora se for read-only
        }
        return parsed;
      } catch {
        // Falha persistiu, segue para o diagnóstico cirúrgico
      }
    }

    // 3. Falha irrecuperável: emitir diagnóstico cirúrgico
    const formattedError = formatJsonErrorWithSnippet(
      resolved,
      raw,
      initialErr
    );
    throw new Error(formattedError);
  }
}

export function unflattenDotKeys(obj: any): any {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => unflattenDotKeys(item));
  }

  const result: Record<string, any> = { ...obj };

  for (const [key, value] of Object.entries(obj)) {
    const processedValue =
      typeof value === "object" && value !== null
        ? unflattenDotKeys(value)
        : value;

    if (key.includes(".")) {
      const parts = key.split(".");
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (
          !current[part] ||
          typeof current[part] !== "object" ||
          Array.isArray(current[part])
        ) {
          current[part] = {};
        }
        current = current[part];
      }
      const lastPart = parts[parts.length - 1];
      if (
        typeof processedValue === "object" &&
        processedValue !== null &&
        !Array.isArray(processedValue) &&
        typeof current[lastPart] === "object" &&
        current[lastPart] !== null &&
        !Array.isArray(current[lastPart])
      ) {
        current[lastPart] = { ...current[lastPart], ...processedValue };
      } else {
        current[lastPart] = processedValue;
      }
    } else {
      result[key] = processedValue;
    }
  }

  return result;
}

// ============================================================================
// 2. Função Construtora de Template (build_docx_template)
// ============================================================================

export async function buildDocxTemplate(
  sourcePath: string,
  manifestPath: string,
  outputPath: string
): Promise<{ success: boolean; message: string }> {
  const resolvedSource = resolve(sourcePath);
  const resolvedManifest = resolve(manifestPath);
  const resolvedOutput = resolve(outputPath);

  if (!existsSync(resolvedSource)) {
    throw new Error(`Documento bruto não encontrado: ${resolvedSource}`);
  }
  if (!existsSync(resolvedManifest)) {
    throw new Error(
      `Manifesto de slots não encontrado: ${resolvedManifest}`
    );
  }

  const sourceBuffer = readFileSync(resolvedSource);
  const manifest: SlotsManifest =
    safeReadJsonFile<SlotsManifest>(resolvedManifest);

  const zip = await JSZip.loadAsync(sourceBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error(
      `Estrutura OpenXML inválida (word/document.xml ausente): ${resolvedSource}`
    );
  }

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const docXmlStr = await docFile.async("string");
  const docXml = parser.parseFromString(docXmlStr, "application/xml");
  const body = getAllElements(docXml, "w:body")[0];
  if (!body) {
    throw new Error(`Elemento <w:body> não encontrado em word/document.xml`);
  }

  // Snapshot estático dos elementos originais para nunca deslocar índices
  const originalBodyParagraphs = getDirectChildElements(body, "w:p");
  const originalBodyTables = getDirectChildElements(body, "w:tbl").map(
    (tbl) => ({
      tbl,
      rows: getDirectChildElements(tbl, "w:tr").map((tr) => ({
        tr,
        cells: getDirectChildElements(tr, "w:tc"),
      })),
    })
  );

  // 2.1. replace_paragraphs
  if (manifest.replace_paragraphs && manifest.replace_paragraphs.length > 0) {
    for (const rule of manifest.replace_paragraphs) {
      const { start_p, end_p, tag } = rule;
      if (start_p < 0 || start_p >= originalBodyParagraphs.length) {
        throw new Error(
          `Índice start_p (${start_p}) fora do intervalo de parágrafos (0..${originalBodyParagraphs.length - 1})`
        );
      }
      const targetP = originalBodyParagraphs[start_p];
      const sliceEnd = Math.min(end_p, originalBodyParagraphs.length - 1);
      const paragraphRange = originalBodyParagraphs.slice(
        start_p,
        sliceEnd + 1
      );
      const bodyRPr = findBodyRunProperties(paragraphRange);
      const bodyPPr = findBodyParagraphProperties(paragraphRange);

      setParagraphSingleRunText(
        docXml,
        targetP,
        normalizeTag(tag),
        bodyRPr,
        bodyPPr
      );

      for (let i = start_p + 1; i <= sliceEnd; i++) {
        const pToRemove = originalBodyParagraphs[i];
        if (pToRemove && pToRemove.parentNode === body) {
          body.removeChild(pToRemove);
        }
      }
    }
  }

  // 2.1b. loop_paragraphs
  if (manifest.loop_paragraphs && manifest.loop_paragraphs.length > 0) {
    for (const rule of manifest.loop_paragraphs) {
      const { start_p, end_p, for_open_tag, for_close_tag, item_tag } = rule;
      if (start_p < 0 || start_p >= originalBodyParagraphs.length) {
        throw new Error(
          `Índice start_p (${start_p}) fora do intervalo de parágrafos (0..${originalBodyParagraphs.length - 1})`
        );
      }
      const targetP = originalBodyParagraphs[start_p];
      const sliceEnd = Math.min(end_p, originalBodyParagraphs.length - 1);
      const paragraphRange = originalBodyParagraphs.slice(
        start_p,
        sliceEnd + 1
      );
      const bodyRPr = findBodyRunProperties(paragraphRange);
      const bodyPPr = findBodyParagraphProperties(paragraphRange);

      const normalizedOpenTag = normalizeTag(for_open_tag).replace(
        /\bFOR\s+\$([a-zA-Z_]\w*)\s+IN\b/i,
        "FOR $1 IN"
      );
      const normalizedCloseTag = normalizeTag(for_close_tag).replace(
        /\bEND-FOR\s+\$([a-zA-Z_]\w*)\b/i,
        "END-FOR $1"
      );
      const forVarMatch = normalizedOpenTag.match(
        /\bFOR\s+([a-zA-Z_]\w*)\s+IN\b/i
      );
      const iteratorVar = forVarMatch ? forVarMatch[1] : null;
      let normalizedItemTag = normalizeTag(item_tag);
      if (iteratorVar && normalizedItemTag) {
        const varRegex = new RegExp(
          `(\\{\\{\\s*(?:INS\\s+|\\=\\s*)?)${iteratorVar}\\b`,
          "g"
        );
        normalizedItemTag = normalizedItemTag.replace(
          varRegex,
          `$1$${iteratorVar}`
        );
      }

      setParagraphSingleRunText(
        docXml,
        targetP,
        `${normalizedOpenTag}${normalizedItemTag}${normalizedCloseTag}`,
        bodyRPr,
        bodyPPr
      );

      for (let i = start_p + 1; i <= sliceEnd; i++) {
        const pToRemove = originalBodyParagraphs[i];
        if (pToRemove && pToRemove.parentNode === body) {
          body.removeChild(pToRemove);
        }
      }
    }
  }

  // 2.2. replace_table_cells
  if (manifest.replace_table_cells && manifest.replace_table_cells.length > 0) {
    for (const rule of manifest.replace_table_cells) {
      const { table_index, row_index, cell_index, tag } = rule;
      const tSnap = originalBodyTables[table_index];
      if (!tSnap) {
        throw new Error(`Tabela de índice ${table_index} não encontrada`);
      }
      const rSnap = tSnap.rows[row_index];
      if (!rSnap) {
        throw new Error(
          `Linha ${row_index} não encontrada na tabela ${table_index}`
        );
      }
      const tc = rSnap.cells[cell_index];
      if (!tc) {
        throw new Error(
          `Célula ${cell_index} não encontrada na linha ${row_index} da tabela ${table_index}`
        );
      }

      setTableCellSingleParagraphText(docXml, tc, normalizeTag(tag));
    }
  }

  // 2.3. loop_table_rows
  if (manifest.loop_table_rows && manifest.loop_table_rows.length > 0) {
    for (const rule of manifest.loop_table_rows) {
      const {
        table_index,
        header_row_index,
        template_row_index,
        remove_from_row,
        remove_to_row,
        for_open_tag,
        for_close_tag,
        cell_tags,
      } = rule;

      const tSnap = originalBodyTables[table_index];
      if (!tSnap) {
        throw new Error(`Tabela de índice ${table_index} não encontrada`);
      }
      const headerRow = tSnap.rows[header_row_index];
      if (!headerRow || headerRow.cells.length === 0) {
        throw new Error(
          `Linha de cabeçalho ${header_row_index} inválida na tabela ${table_index}`
        );
      }
      const templateRow = tSnap.rows[template_row_index];
      if (!templateRow || templateRow.cells.length === 0) {
        throw new Error(
          `Linha de template ${template_row_index} inválida na tabela ${table_index}`
        );
      }

      // Extrai o nome da variável iteradora do FOR (ex.: "r" em "{{FOR r IN gestao_riscos}}")
      const normalizedOpenTag = normalizeTag(for_open_tag).replace(
        /\bFOR\s+\$([a-zA-Z_]\w*)\s+IN\b/i,
        "FOR $1 IN"
      );
      const normalizedCloseTag = normalizeTag(for_close_tag).replace(
        /\bEND-FOR\s+\$([a-zA-Z_]\w*)\b/i,
        "END-FOR $1"
      );
      const forVarMatch = normalizedOpenTag.match(
        /\bFOR\s+([a-zA-Z_]\w*)\s+IN\b/i
      );
      const iteratorVar = forVarMatch ? forVarMatch[1] : null;

      // Anexa for_open_tag na última célula de header_row_index
      const lastHeaderCell = headerRow.cells[headerRow.cells.length - 1];
      appendTextRunToTableCell(docXml, lastHeaderCell, normalizedOpenTag);

      // Preenche cada célula de template_row_index com cell_tags e anexa for_close_tag na última célula
      const lastCellIdx = templateRow.cells.length - 1;
      for (let cIdx = 0; cIdx <= lastCellIdx; cIdx++) {
        const tc = templateRow.cells[cIdx];
        let cellTag = cell_tags[cIdx] ? normalizeTag(cell_tags[cIdx]) : "";
        if (iteratorVar && cellTag) {
          const varRegex = new RegExp(
            `(\\{\\{\\s*(?:INS\\s+|\\=\\s*)?)${iteratorVar}\\b`,
            "g"
          );
          cellTag = cellTag.replace(varRegex, `$1$${iteratorVar}`);
        }
        const finalCellContent =
          cIdx === lastCellIdx
            ? `${cellTag}${normalizedCloseTag}`
            : cellTag;
        setTableCellSingleParagraphText(docXml, tc, finalCellContent);
      }

      // Remove as linhas antigas de remove_from_row até remove_to_row
      if (remove_from_row !== undefined && remove_to_row !== undefined) {
        const maxRow = Math.min(remove_to_row, tSnap.rows.length - 1);
        for (let rIdx = remove_from_row; rIdx <= maxRow; rIdx++) {
          if (rIdx === header_row_index || rIdx === template_row_index) {
            continue;
          }
          const rowToRemove = tSnap.rows[rIdx]?.tr;
          if (rowToRemove && rowToRemove.parentNode === tSnap.tbl) {
            tSnap.tbl.removeChild(rowToRemove);
          }
        }
      }
    }
  }

  // 2.4. replace_inline (em word/document.xml, word/header*.xml e word/footer*.xml)
  if (manifest.replace_inline && manifest.replace_inline.length > 0) {
    applyInlineReplacementsToXmlDoc(docXml, manifest.replace_inline);

    const fileNames = Object.keys(zip.files).sort();
    for (const name of fileNames) {
      if (/^word\/(header|footer)\d*\.xml$/i.test(name)) {
        const partFile = zip.file(name)!;
        const partXmlStr = await partFile.async("string");
        const partXmlDoc = parser.parseFromString(
          partXmlStr,
          "application/xml"
        );
        if (
          applyInlineReplacementsToXmlDoc(partXmlDoc, manifest.replace_inline)
        ) {
          zip.file(name, serializer.serializeToString(partXmlDoc));
        }
      }
    }
  }

  // Atualiza word/document.xml no pacote ZIP
  zip.file("word/document.xml", serializer.serializeToString(docXml));

  // Garante Override em [Content_Types].xml
  await ensureContentTypesOverride(zip);

  const outBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  writeFileSync(resolvedOutput, outBuffer);

  return {
    success: true,
    message: `Template parametrizado gerado com sucesso em: ${resolvedOutput}`,
  };
}

// ============================================================================
// 3. Função Central de Injeção (fill_docx_template / processDocument)
// ============================================================================

export function detectHierarchicalListItem(line: string): {
  isListItem: boolean;
  hasExplicitMarker: boolean;
  level: number;
} {
  // 1) Numeração decimal multinível: 1.1, 1.1.1, 1.1.1.1, 1.1.1.1.1 ...
  const multiDecimalMatch = line.match(
    /^\s*(?:\*\*)?(\d+(?:\.\d+)+)\.?(?:\*\*)?(?:\s+|\s*[-–—:]\s*)/
  );
  if (multiDecimalMatch) {
    const segments = multiDecimalMatch[1].split(".");
    return {
      isListItem: true,
      hasExplicitMarker: true,
      level: Math.max(1, segments.length - 1),
    };
  }

  // 2) Alíneas (a), b)) ou numerais romanos em minúsculo (i), ii), iii))
  const alphaOrRomanMatch = line.match(
    /^(\s*)(?:\*\*)?(?:[a-z]|[ivxlcdm]+)\)(?:\*\*)?\s+/i
  );
  if (alphaOrRomanMatch) {
    const leadingSpaces = alphaOrRomanMatch[1].length;
    return {
      isListItem: true,
      hasExplicitMarker: true,
      level: Math.max(2, Math.floor(leadingSpaces / 2) + 2),
    };
  }

  // 3) Marcadores / Bullets (-, •, *)
  const bulletMatch = line.match(/^(\s*)(?:\*\*)?[-•*](?:\*\*)?\s+/);
  if (bulletMatch) {
    const leadingSpaces = bulletMatch[1].length;
    return {
      isListItem: true,
      hasExplicitMarker: true,
      level: Math.max(1, Math.floor(leadingSpaces / 2) + 1),
    };
  }

  // 4) Item decimal simples (1. Texto, 2) Texto)
  const singleDecimalMatch = line.match(
    /^\s*(?:\*\*)?(\d+)[\.\)](?:\*\*)?\s+/
  );
  if (singleDecimalMatch) {
    return {
      isListItem: true,
      hasExplicitMarker: true,
      level: 0,
    };
  }

  return {
    isListItem: false,
    hasExplicitMarker: false,
    level: 0,
  };
}

function buildLineParagraphProperties(
  xmlDoc: Document,
  basePPr: Element | null,
  listInfo: { isListItem: boolean; hasExplicitMarker: boolean; level: number }
): Element | null {
  if (!listInfo.isListItem) {
    return basePPr ? (basePPr.cloneNode(true) as Element) : null;
  }

  const pPr = basePPr
    ? (basePPr.cloneNode(true) as Element)
    : xmlDoc.createElement("w:pPr");

  // Se a linha já possui marcador explícito (ex.: 1.1.1, a), •), remove <w:numPr>
  // herdado do template para evitar dupla numeração pelo Word
  if (listInfo.hasExplicitMarker) {
    const numPrList = getDirectChildElements(pPr, "w:numPr");
    for (const numPr of numPrList) {
      pPr.removeChild(numPr);
    }
  }

  // Aplica recuo progressivo (<w:ind>) proporcional ao subnível (level >= 1)
  if (listInfo.level >= 1) {
    const leftTwips = listInfo.level * 360;
    const hangingTwips = 360;
    const existingIndList = getDirectChildElements(pPr, "w:ind");
    const ind =
      existingIndList.length > 0
        ? existingIndList[0]
        : xmlDoc.createElement("w:ind");

    ind.removeAttribute("w:firstLine");
    ind.removeAttribute("firstLine");
    ind.setAttribute("w:left", String(leftTwips));
    ind.setAttribute("w:hanging", String(hangingTwips));

    if (existingIndList.length === 0) {
      pPr.appendChild(ind);
    }
  }

  return pPr;
}

function flattenRecursiveItemsArray(
  items: any[],
  parentPrefix: string = "1"
): { lines: string[]; flatObjects: any[] } {
  const lines: string[] = [];
  const flatObjects: any[] = [];

  items.forEach((item, idx) => {
    const currentIndex = idx + 1;
    if (typeof item === "string") {
      lines.push(item);
      flatObjects.push({ texto: item });
      return;
    }

    if (typeof item === "object" && item !== null) {
      const explicitNum =
        item.numero ?? item.codigo ?? item.id ?? item.item ?? null;
      const computedNum = explicitNum
        ? String(explicitNum).trim()
        : `${parentPrefix}.${currentIndex}`;

      const titulo = item.titulo ?? item.rotulo ?? item.nome ?? "";
      const texto =
        item.texto ?? item.descricao ?? item.conteudo ?? item.valor ?? "";

      let formattedLine = "";
      if (titulo && texto) {
        formattedLine = `**${computedNum} ${titulo}:** ${texto}`;
      } else if (titulo) {
        formattedLine = `**${computedNum} ${titulo}**`;
      } else if (texto) {
        const textStr = String(texto).trim();
        const startsWithNum =
          textStr.startsWith(computedNum) ||
          textStr.startsWith(`**${computedNum}`);
        formattedLine = startsWithNum
          ? textStr
          : `**${computedNum}** ${textStr}`;
      } else {
        formattedLine = `**${computedNum}**`;
      }

      lines.push(formattedLine);

      const children =
        item.subitens ?? item.itens ?? item.children ?? item.filhos ?? null;

      const flatClone: Record<string, any> = {
        ...item,
        numero: computedNum,
        texto_formatado: formattedLine,
      };
      delete flatClone.subitens;
      delete flatClone.itens;
      delete flatClone.children;
      delete flatClone.filhos;
      flatObjects.push(flatClone);

      if (Array.isArray(children) && children.length > 0) {
        const childRes = flattenRecursiveItemsArray(children, computedNum);
        lines.push(...childRes.lines);
        flatObjects.push(...childRes.flatObjects);
      }
    }
  });

  return { lines, flatObjects };
}

function isHierarchicalListArray(arr: any[]): boolean {
  if (arr.length === 0) return false;
  if (arr.every((x) => typeof x === "string")) return true;
  return arr.some(
    (x) =>
      typeof x === "object" &&
      x !== null &&
      (Array.isArray(x.subitens) ||
        Array.isArray(x.itens) ||
        Array.isArray(x.children) ||
        Array.isArray(x.filhos))
  );
}

async function extractTemplateForLoopTargets(
  templateBuffer: Buffer
): Promise<Set<string>> {
  const targets = new Set<string>();
  try {
    const zip = await JSZip.loadAsync(templateBuffer);
    const fileNames = Object.keys(zip.files);
    for (const name of fileNames) {
      if (
        name === "word/document.xml" ||
        /^word\/(header|footer)\d*\.xml$/i.test(name)
      ) {
        const xmlStr = await zip.file(name)!.async("string");
        const matches = xmlStr.matchAll(
          /\bFOR\s+\$?[a-zA-Z_]\w*\s+IN\s+([a-zA-Z0-9_.$]+)/gi
        );
        for (const m of matches) {
          const fullExpr = m[1];
          targets.add(fullExpr);
          const lastProp = fullExpr.split(".").pop();
          if (lastProp) targets.add(lastProp);
        }
      }
    }
  } catch {
    // Ignora caso não seja possível extrair previamente
  }
  return targets;
}

export function normalizeNestedListsInState(
  data: any,
  forLoopTargets: Set<string> = new Set(),
  currentPath: string = ""
): any {
  if (Array.isArray(data)) {
    const propName = currentPath.split(".").pop() ?? "";
    const isUsedInForLoop =
      forLoopTargets.has(currentPath) || forLoopTargets.has(propName);

    const hasNestedSubitems = data.some(
      (x) =>
        typeof x === "object" &&
        x !== null &&
        (Array.isArray(x.subitens) ||
          Array.isArray(x.itens) ||
          Array.isArray(x.children) ||
          Array.isArray(x.filhos))
    );

    if (isUsedInForLoop) {
      if (hasNestedSubitems) {
        return flattenRecursiveItemsArray(data).flatObjects;
      }
      return data.map((item, idx) =>
        normalizeNestedListsInState(item, forLoopTargets, `${currentPath}[${idx}]`)
      );
    }

    if (isHierarchicalListArray(data)) {
      return flattenRecursiveItemsArray(data).lines.join("\n");
    }

    return data.map((item, idx) =>
      normalizeNestedListsInState(item, forLoopTargets, `${currentPath}[${idx}]`)
    );
  }

  if (typeof data === "object" && data !== null) {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      const nextPath = currentPath ? `${currentPath}.${k}` : k;
      result[k] = normalizeNestedListsInState(v, forLoopTargets, nextPath);
    }
    return result;
  }

  return data;
}

function postProcessRichTextAndLineBreaksInXmlDoc(xmlDoc: Document): boolean {
  let modified = false;
  const paragraphs = getAllElements(xmlDoc, "w:p");

  for (const p of paragraphs) {
    const parent = p.parentNode;
    if (!parent) continue;

    const hasBrElements =
      getAllElements(p, "w:br").length > 0 ||
      getAllElements(p, "w:cr").length > 0;
    const fullText = extractParagraphText(p);
    const hasLineBreaks = hasBrElements || /\r?\n/.test(fullText);
    const hasMarkdownBold = /\*\*[^*]+\*\*/.test(fullText);
    const singleLineListInfo = detectHierarchicalListItem(fullText);
    const hasMultiLevelItem =
      singleLineListInfo.isListItem && singleLineListInfo.level >= 1;
    const hasNumberingConflict =
      singleLineListInfo.hasExplicitMarker &&
      extractParagraphNumbering(p) !== undefined;

    if (
      !hasLineBreaks &&
      !hasMarkdownBold &&
      !hasMultiLevelItem &&
      !hasNumberingConflict
    ) {
      continue;
    }

    const pPrList = getDirectChildElements(p, "w:pPr");
    let basePPr =
      pPrList.length > 0 ? (pPrList[0].cloneNode(true) as Element) : null;
    const detectedRPr = findBodyRunProperties([p]);

    let normalRPr: Element | null;
    if (hasMarkdownBold) {
      normalRPr = detectedRPr ? stripBoldFromRPr(detectedRPr) : null;
      if (basePPr) {
        basePPr = stripBoldFromPPr(basePPr);
      }
    } else {
      normalRPr = detectedRPr ? (detectedRPr.cloneNode(true) as Element) : null;
    }

    const lines = fullText.split(/\r?\n/);

    for (const line of lines) {
      const newP = xmlDoc.createElement("w:p");
      const lineListInfo = detectHierarchicalListItem(line);
      const linePPr = buildLineParagraphProperties(
        xmlDoc,
        basePPr,
        lineListInfo
      );
      if (linePPr) {
        newP.appendChild(linePPr);
      }

      const segments = line.split(/(\*\*[^*]+\*\*)/g);
      for (const seg of segments) {
        if (!seg) continue;
        const isBoldSeg =
          seg.startsWith("**") && seg.endsWith("**") && seg.length > 4;
        const cleanText = isBoldSeg ? seg.slice(2, -2) : seg;

        const r = xmlDoc.createElement("w:r");
        const rPrToUse = isBoldSeg
          ? addBoldToRPr(xmlDoc, normalRPr)
          : normalRPr
            ? (normalRPr.cloneNode(true) as Element)
            : null;
        if (rPrToUse) {
          r.appendChild(rPrToUse);
        }

        const t = xmlDoc.createElement("w:t");
        t.setAttribute("xml:space", "preserve");
        t.textContent = cleanText;
        r.appendChild(t);
        newP.appendChild(r);
      }

      parent.insertBefore(newP, p);
    }

    parent.removeChild(p);
    modified = true;
  }

  return modified;
}

async function postProcessInjectedDocxBuffer(
  rawBuffer: Uint8Array
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(rawBuffer);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  let anyModified = false;

  const fileNames = Object.keys(zip.files).sort();
  for (const name of fileNames) {
    if (
      name === "word/document.xml" ||
      /^word\/(header|footer)\d*\.xml$/i.test(name)
    ) {
      const partFile = zip.file(name);
      if (!partFile) continue;
      const xmlStr = await partFile.async("string");
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      if (postProcessRichTextAndLineBreaksInXmlDoc(xmlDoc)) {
        zip.file(name, serializer.serializeToString(xmlDoc));
        anyModified = true;
      }
    }
  }

  if (!anyModified) {
    return Buffer.from(rawBuffer);
  }

  return await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
}

export async function processDocument(
  templatePath: string,
  statePath: string,
  outputPath: string
): Promise<{ success: boolean; message: string }> {
  const resolvedTemplate = resolve(templatePath);
  const resolvedState = resolve(statePath);
  const resolvedOutput = resolve(outputPath);

  if (!existsSync(resolvedTemplate)) {
    throw new Error(`Template não encontrado: ${resolvedTemplate}`);
  }
  if (!existsSync(resolvedState)) {
    throw new Error(
      `Arquivo de dados/estado não encontrado: ${resolvedState}`
    );
  }

  const templateBuffer = readFileSync(resolvedTemplate);
  const rawStateData = safeReadJsonFile<Record<string, any>>(resolvedState);
  const unflattenedState = unflattenDotKeys(rawStateData);
  const forLoopTargets = await extractTemplateForLoopTargets(templateBuffer);
  const stateData = normalizeNestedListsInState(
    unflattenedState,
    forLoopTargets
  );

  const outputBuffer = await createReport({
    template: templateBuffer,
    data: stateData,
    cmdDelimiter: ["{{", "}}"],
    processLineBreaks: true,
    noSandbox: true,
  });

  const finalBuffer = await postProcessInjectedDocxBuffer(outputBuffer);
  const outDir = dirname(resolvedOutput);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  writeFileSync(resolvedOutput, finalBuffer);
  return {
    success: true,
    message: `Documento gerado com sucesso em: ${resolvedOutput}`,
  };
}

// ============================================================================
// 3b. Geração Nativa de Relatório de Auditoria em Word (generate_audit_docx)
// ============================================================================

const VULNERABILITY_ENUM_LABELS: Record<string, string> = {
  V1_SINGULARIDADE:
    "Singularidade de Mercado / Especificação Proprietária",
  V2_EQUIVALENCIA: "Salvaguarda de Equivalência Técnica",
  V3_METRICA_HIPERESPECIFICA: "Métricas e Parâmetros de Desempenho",
  V4_HABILITACAO_ART67: "Critérios de Habilitação Técnica (Art. 67)",
  V5_FALSA_PLURALIDADE:
    "Levantamento de Mercado e Parcelamento do Objeto",
  V6_RESIDUO_TRANSPOSICAO:
    "Consistência Institucional do Órgão Destino",
};

function escapeXml(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function cleanHumanText(input: unknown): string {
  if (input === null || input === undefined) return "";
  let text = String(input);

  // 1. Remove todas as crases Markdown literais (`)
  text = text.replace(/`/g, "");

  // 2. Remove coordenadas técnicas de máquina ([T0:R30:C1], [T0:R30], [P034], etc.)
  text = text.replace(
    /\[\s*(?:T\d+\s*:\s*R\d+(?:\s*:\s*C\d+)?|P\d+)\s*\]\s*[-–—:]?\s*/gi,
    ""
  );
  text = text.replace(
    /\(\s*(?:T\d+\s*:\s*R\d+(?:\s*:\s*C\d+)?|P\d+)\s*\)\s*/gi,
    ""
  );

  // 3. Converte códigos de enum conhecidos (V1..V6) em títulos humanos legíveis
  for (const [code, humanLabel] of Object.entries(VULNERABILITY_ENUM_LABELS)) {
    const regex = new RegExp(`\\b${code}\\b\\s*[-–—:]?\\s*`, "gi");
    text = text.replace(regex, (match, offset, fullStr) => {
      const rest = fullStr.slice(offset + match.length).trim();
      return rest.length > 0 ? `${humanLabel} — ` : humanLabel;
    });
  }

  // Converte eventuais outros códigos V<num>_<CODIGO_MAIUSCULO> remanescentes
  text = text.replace(/\bV\d+_[A-Z0-9_]+\b/g, (code) => {
    const mapped = VULNERABILITY_ENUM_LABELS[code.toUpperCase()];
    if (mapped) return mapped;
    return code
      .replace(/^V\d+_/i, "")
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  });

  // 4. Simplifica caminhos de diretórios mantendo apenas o nome do arquivo
  text = text.replace(
    /(?:[A-Za-z]:[\\/]|(?:\.{0,2}[\\/])?(?:[\w.-]+[\\/])+)([\w.-]+\.(?:docx|json|pdf|md|txt|xlsx))\b/gi,
    "$1"
  );

  // 5. Normaliza espaços múltiplos na mesma linha preservando quebras \n
  text = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .join("\n")
    .trim();

  return text;
}

function formatReadableGlobalStatus(
  rawStatus: unknown,
  bloqueantes: number,
  alertas: number
): string {
  const cleaned = cleanHumanText(rawStatus);
  if (/reprovad|bloqueant|inapt|impr[oó]pri/i.test(cleaned) || bloqueantes > 0) {
    if (/reprovad/i.test(cleaned)) {
      return "REPROVADO — CONTÉM APONTAMENTOS BLOQUEANTES";
    }
  }
  if (/alerta|ressalva|aten[cç][aã]o|condicionad/i.test(cleaned)) {
    return "APTO COM ALERTAS PREVENTIVOS";
  }
  if (/apto|aprovad|conform/i.test(cleaned)) {
    return alertas > 0
      ? "APTO COM ALERTAS PREVENTIVOS"
      : "APTO PARA PUBLICAÇÃO";
  }
  if (bloqueantes > 0) {
    return "REPROVADO — CONTÉM APONTAMENTOS BLOQUEANTES";
  }
  if (alertas > 0) {
    return "APTO COM ALERTAS PREVENTIVOS";
  }
  return cleaned || "APTO PARA PUBLICAÇÃO";
}

function resolveFindingSeverityInfo(ap: AuditFinding): {
  label: string;
  color: string;
  bgFill: string;
} {
  const rawSev = String(
    ap.severidade ?? ap.status ?? ap.gravidade ?? ap.criticidade ?? ""
  );
  if (/bloqueante|cr[ií]tic|alta|grave|reprovad/i.test(rawSev)) {
    return {
      label: "BLOQUEANTE",
      color: "990000",
      bgFill: "FDECEA",
    };
  }
  if (/alerta|m[eé]dia|moderad|ressalva|preventiv/i.test(rawSev)) {
    return {
      label: "ALERTA PREVENTIVO",
      color: "995C00",
      bgFill: "FFF8E1",
    };
  }
  return {
    label: "CONFORME",
    color: "1B5E20",
    bgFill: "E8F5E9",
  };
}

function resolveFindingTitle(ap: AuditFinding): string {
  const rawTitle =
    ap.titulo_apontamento ??
    ap.titulo ??
    ap.vulnerabilidade ??
    ap.achado ??
    ap.descricao ??
    "Apontamento de Conformidade e Controle";
  return cleanHumanText(rawTitle) || "Apontamento de Conformidade e Controle";
}

function resolveFindingExcerpts(
  ap: AuditFinding
): Array<{ secao_legivel: string; texto_transcrito: string }> {
  const result: Array<{ secao_legivel: string; texto_transcrito: string }> = [];

  if (Array.isArray(ap.trechos_documento) && ap.trechos_documento.length > 0) {
    for (const t of ap.trechos_documento) {
      if (!t || typeof t !== "object") continue;
      const secao = cleanHumanText(
        t.secao_legivel ??
          t.secao ??
          t.localizacao ??
          ap.secao_legivel ??
          ap.localizacao ??
          "Seção analisada no documento"
      );
      const texto = cleanHumanText(
        t.texto_transcrito ??
          t.trecho_impugnado ??
          t.trecho ??
          t.texto ??
          ""
      );
      if (secao || texto) {
        result.push({
          secao_legivel: secao || "Seção analisada no documento",
          texto_transcrito:
            texto || "Trecho correspondente identificado na seção indicada.",
        });
      }
    }
  }

  if (result.length === 0) {
    const legacySecao = cleanHumanText(
      ap.secao_legivel ??
        ap.localizacao ??
        ap.secao ??
        "Seção analisada no documento"
    );
    const legacyTexto = cleanHumanText(
      ap.trecho_impugnado ??
        ap.texto_transcrito ??
        ap.trecho ??
        ap.vulnerabilidade ??
        ap.descricao ??
        ""
    );
    if (legacySecao || legacyTexto) {
      result.push({
        secao_legivel: legacySecao || "Seção analisada no documento",
        texto_transcrito:
          legacyTexto ||
          "Trecho correspondente identificado na seção indicada.",
      });
    }
  }

  return result;
}

function renderRunsWithInlineBoldXml(
  text: string,
  options: {
    fontSizeHalfPt?: number;
    color?: string;
    forceBold?: boolean;
    forceItalic?: boolean;
  } = {}
): string {
  const sz = options.fontSizeHalfPt ?? 22;
  const colorXml = options.color ? `<w:color w:val="${options.color}"/>` : "";
  const italicXml = options.forceItalic ? `<w:i/><w:iCs/>` : "";

  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  const runs: string[] = [];

  for (const seg of segments) {
    if (!seg) continue;
    const isMarkdownBold =
      seg.startsWith("**") && seg.endsWith("**") && seg.length > 4;
    const rawSegmentText = isMarkdownBold ? seg.slice(2, -2) : seg;
    const cleanedSegmentText = cleanHumanText(rawSegmentText);
    // Preserva espaço lateral caso o segmento original tivesse espaçamento adjacente ao negrito
    const leadingSpace = /^\s/.test(rawSegmentText) ? " " : "";
    const trailingSpace = /\s$/.test(rawSegmentText) ? " " : "";
    const finalSegText = `${leadingSpace}${cleanedSegmentText}${trailingSpace}`;

    if (!finalSegText) continue;

    const boldXml =
      options.forceBold || isMarkdownBold ? `<w:b/><w:bCs/>` : "";

    runs.push(`<w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${boldXml}${italicXml}${colorXml}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(finalSegText)}</w:t>
    </w:r>`);
  }

  return runs.join("");
}

function renderMultiLineParagraphsXml(
  rawText: unknown,
  options: {
    jc?: "both" | "left" | "center";
    spaceBefore?: number;
    spaceAfter?: number;
    fontSizeHalfPt?: number;
    color?: string;
    forceBold?: boolean;
    forceItalic?: boolean;
  } = {}
): string {
  const cleaned = cleanHumanText(rawText);
  if (!cleaned) return "";

  const jc = options.jc ?? "both";
  const before = options.spaceBefore ?? 0;
  const after = options.spaceAfter ?? 120;

  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines
    .map(
      (line) => `<w:p>
      <w:pPr>
        <w:jc w:val="${jc}"/>
        <w:spacing w:before="${before}" w:after="${after}" w:line="276" w:lineRule="auto"/>
      </w:pPr>
      ${renderRunsWithInlineBoldXml(line, options)}
    </w:p>`
    )
    .join("\n");
}

function renderLabelValueParagraphXml(
  label: string,
  value: unknown
): string {
  const cleanedVal = cleanHumanText(value);
  if (!cleanedVal) return "";
  return `<w:p>
    <w:pPr>
      <w:jc w:val="both"/>
      <w:spacing w:before="40" w:after="80" w:line="276" w:lineRule="auto"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(label)}: </w:t>
    </w:r>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(cleanedVal)}</w:t>
    </w:r>
  </w:p>`;
}

export async function generateAuditDocx(
  auditJsonPath: string,
  outputPath: string
): Promise<{ success: boolean; outputPath: string; message: string }> {
  const resolvedAuditJson = resolve(auditJsonPath);
  const resolvedOutput = resolve(outputPath);

  if (!existsSync(resolvedAuditJson)) {
    throw new Error(
      `Arquivo JSON de auditoria não encontrado: ${resolvedAuditJson}`
    );
  }

  const raw: AuditReportData =
    safeReadJsonFile<AuditReportData>(resolvedAuditJson);

  // Nota: metadados_agente nunca é lido nem impresso no relatório humano
  const processoId = cleanHumanText(
    raw.processo_id ??
      raw.processo ??
      raw.metadados?.processo_id ??
      raw.metadados?.numero_processo ??
      "N/A"
  );
  const orgaoEntidade = cleanHumanText(
    raw.orgao_entidade ??
      raw.orgao ??
      raw.metadados?.orgao_entidade ??
      ""
  );
  const artefatoAuditado = cleanHumanText(
    raw.artefato_auditado ??
      raw.artefato ??
      raw.documento_auditado ??
      "N/A"
  );
  const regimeJuridico = cleanHumanText(
    raw.regime_juridico ?? raw.metadados?.regime_juridico ?? ""
  );

  const apontamentosList: AuditFinding[] = Array.isArray(raw.apontamentos)
    ? raw.apontamentos
    : Array.isArray(raw.achados)
      ? raw.achados
      : [];

  const bloqueantes =
    raw.contagem?.bloqueantes ??
    raw.resumo_contagem?.bloqueantes ??
    apontamentosList.filter(
      (a) => resolveFindingSeverityInfo(a).label === "BLOQUEANTE"
    ).length;
  const alertas =
    raw.contagem?.alertas ??
    raw.resumo_contagem?.alertas ??
    apontamentosList.filter(
      (a) => resolveFindingSeverityInfo(a).label === "ALERTA PREVENTIVO"
    ).length;
  const conformes =
    raw.contagem?.conformes ??
    raw.resumo_contagem?.conformes ??
    apontamentosList.filter(
      (a) => resolveFindingSeverityInfo(a).label === "CONFORME"
    ).length;

  const statusGlobalLegivel = formatReadableGlobalStatus(
    raw.status_global ?? raw.status ?? raw.parecer_global,
    bloqueantes,
    alertas
  );
  const diagnosticoGlobalTexto = `${statusGlobalLegivel} (${bloqueantes} Bloqueantes | ${alertas} Alertas | ${conformes} Conformes)`;

  const resumoExecutivo =
    raw.resumo_executivo ??
    raw.parecer_executivo ??
    raw.resumo ??
    "Sem resumo executivo informado.";

  // Construção das Fichas Verticais dos Apontamentos (Seção 3 - ZERO <w:tbl>)
  const findingsCardsXml =
    apontamentosList.length > 0
      ? apontamentosList
          .map((ap, idx) => {
            const id = cleanHumanText(ap.id ?? ap.codigo ?? `AUD-0${idx + 1}`);
            const sev = resolveFindingSeverityInfo(ap);
            const titulo = resolveFindingTitle(ap);
            const baseLegal = cleanHumanText(
              ap.base_legal ??
                ap.fundamentacao_legal ??
                ap.norma ??
                "Lei Federal nº 14.133/2021"
            );
            const excerpts = resolveFindingExcerpts(ap);
            const analiseControleExterno =
              ap.risco_controle_externo ??
              ap.analise_risco ??
              ap.risco ??
              "Análise de controle externo não informada.";
            const redacaoSaneadora =
              ap.redacao_saneadora_sugerida ??
              ap.redacao_saneadora ??
              ap.recomendacao ??
              ap.acao_corretiva ??
              "Sem recomendação adicional.";

            const excerptsXml = excerpts
              .map((ex, exIdx) => {
                const trechoNum = exIdx + 1;
                return `
    <w:p>
      <w:pPr>
        <w:jc w:val="both"/>
        <w:spacing w:before="80" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:i/><w:iCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(`• Trecho ${trechoNum} — Localização no documento: ${ex.secao_legivel}`)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:left w:val="single" w:sz="18" w:space="12" w:color="888888"/>
        </w:pBdr>
        <w:ind w:left="720" w:right="360"/>
        <w:jc w:val="both"/>
        <w:spacing w:before="40" w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:iCs/><w:color w:val="333333"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(`"«${ex.texto_transcrito}»"`)}</w:t>
      </w:r>
    </w:p>`;
              })
              .join("\n");

            return `
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:left w:val="single" w:sz="24" w:space="8" w:color="${sev.color}"/>
        </w:pBdr>
        <w:shd w:val="clear" w:color="auto" w:fill="${sev.bgFill}"/>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:color w:val="${sev.color}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(`[${id}] ${sev.label} — ${titulo}`)}</w:t>
      </w:r>
    </w:p>
    ${renderLabelValueParagraphXml("Fundamentação Legal e Normativa", baseLegal)}
    <w:p>
      <w:pPr>
        <w:spacing w:before="120" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
        <w:t>A) Trecho(s) Analisado(s) no Documento Auditado:</w:t>
      </w:r>
    </w:p>
    ${excerptsXml}
    <w:p>
      <w:pPr>
        <w:spacing w:before="120" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
        <w:t>B) Análise Crítica de Controle Externo (Risco de Impugnação / Órgão de Controle):</w:t>
      </w:r>
    </w:p>
    ${renderMultiLineParagraphsXml(analiseControleExterno, { jc: "both", spaceAfter: 120 })}
    <w:p>
      <w:pPr>
        <w:spacing w:before="120" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
        <w:t>C) Providência / Redação Saneadora Recomendada:</w:t>
      </w:r>
    </w:p>
    ${renderMultiLineParagraphsXml(redacaoSaneadora, { jc: "both", spaceAfter: 120 })}
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="12" w:space="4" w:color="CCCCCC"/>
        </w:pBdr>
        <w:spacing w:before="80" w:after="160"/>
      </w:pPr>
    </w:p>`;
          })
          .join("\n")
      : renderMultiLineParagraphsXml(
          "Nenhuma impropriedade ou vulnerabilidade foi apontada na auditoria do documento.",
          { jc: "both", spaceAfter: 160 }
        );

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Title"/>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
        <w:t>PARECER DE AUDITORIA TÉCNICO-JURÍDICA E CONTROLE DE DIRECIONAMENTO</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="555555"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
        <w:t>Auditoria Cega de Conformidade Legal e Competitividade (Controle Externo)</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>1. IDENTIFICAÇÃO E ESCOPO DA AUDITORIA</w:t>
      </w:r>
    </w:p>
    ${renderLabelValueParagraphXml("Processo", processoId)}
    ${orgaoEntidade ? renderLabelValueParagraphXml("Órgão / Entidade", orgaoEntidade) : ""}
    ${renderLabelValueParagraphXml("Documento Auditado", artefatoAuditado)}
    ${regimeJuridico ? renderLabelValueParagraphXml("Regime Jurídico", regimeJuridico) : ""}
    ${renderLabelValueParagraphXml("Diagnóstico Global", diagnosticoGlobalTexto)}
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="280" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>2. PARECER EXECUTIVO DE CONTROLE EXTERNO</w:t>
      </w:r>
    </w:p>
    ${renderMultiLineParagraphsXml(resumoExecutivo, { jc: "both", spaceAfter: 140 })}
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="280" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>3. DETALHAMENTO INDIVIDUALIZADO DOS APONTAMENTOS (ID POR ID)</w:t>
      </w:r>
    </w:p>
    ${findingsCardsXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const docXml = parser.parseFromString(documentXml, "application/xml");

  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:jc w:val="both"/></w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:sz w:val="22"/>
      <w:szCs w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
</w:styles>`
  );

  zip.file("word/document.xml", serializer.serializeToString(docXml));

  const outDir = dirname(resolvedOutput);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const outBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  writeFileSync(resolvedOutput, outBuffer);

  return {
    success: true,
    outputPath: resolvedOutput,
    message: `Relatório de Auditoria (.docx) gerado com sucesso em: ${resolvedOutput}`,
  };
}


// ============================================================================
// 4. Verificação de Versão e Auto-Atualização (Self-Update)
// ============================================================================

export function compareSemver(current: string, latest: string): number {
  const cleanCurrent = current.replace(/^v/i, "").trim();
  const cleanLatest = latest.replace(/^v/i, "").trim();

  const partsA = cleanCurrent.split(".").map((n) => parseInt(n, 10) || 0);
  const partsB = cleanLatest.split(".").map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const a = partsA[i] ?? 0;
    const b = partsB[i] ?? 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
}

export function getPlatformAssetName(platform: string = process.platform): string {
  return platform === "win32"
    ? "docgov-docx-windows-x64.exe"
    : "docgov-docx-linux-x64";
}

export function resolveSelfBinaryPath(customTargetPath?: string): string {
  if (customTargetPath) {
    return resolve(customTargetPath);
  }
  const execBase = basename(process.execPath).toLowerCase();
  if (
    execBase === "bun" ||
    execBase === "bun.exe" ||
    execBase === "node" ||
    execBase === "node.exe"
  ) {
    return resolve(
      process.platform === "win32"
        ? "./bin/docgov-docx.exe"
        : "./bin/docgov-docx"
    );
  }
  return resolve(process.execPath);
}

export function cleanupOldBinaryBackup(binaryPath?: string): void {
  try {
    const target = binaryPath ?? resolveSelfBinaryPath();
    const oldBackup = `${target}.old`;
    if (existsSync(oldBackup)) {
      unlinkSync(oldBackup);
    }
  } catch {
    // Ignora caso ainda esteja bloqueado pelo SO
  }
}

export async function fetchLatestReleaseInfo(
  repo: string = GITHUB_REPO
): Promise<{
  tag: string;
  version: string;
  downloadUrl: string;
  assetName: string;
}> {
  const assetName = getPlatformAssetName();

  // Tentativa 1: API oficial do GitHub
  try {
    const apiRes = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      {
        headers: {
          "User-Agent": `docgov-docx-engine/${VERSION}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (apiRes.ok) {
      const data = (await apiRes.json()) as {
        tag_name?: string;
        assets?: Array<{ name: string; browser_download_url: string }>;
      };
      if (data.tag_name) {
        const tag = data.tag_name;
        const version = tag.replace(/^v/i, "");
        const matchedAsset = data.assets?.find((a) => a.name === assetName);
        const downloadUrl =
          matchedAsset?.browser_download_url ??
          `https://github.com/${repo}/releases/download/${tag}/${assetName}`;
        return { tag, version, downloadUrl, assetName };
      }
    }
  } catch {
    // Prossegue para o fallback via redirecionamento HTTP
  }

  // Tentativa 2 (Fallback anti-Rate Limit): Redirecionamento de /releases/latest
  const redirectRes = await fetch(
    `https://github.com/${repo}/releases/latest`,
    {
      redirect: "follow",
      headers: {
        "User-Agent": `docgov-docx-engine/${VERSION}`,
      },
    }
  );

  if (!redirectRes.ok) {
    throw new Error(
      `Não foi possível consultar a última release em github.com/${repo} (HTTP ${redirectRes.status})`
    );
  }

  const finalUrl = redirectRes.url;
  const tagMatch = finalUrl.match(/\/releases\/tag\/([^/?#]+)/i);
  if (!tagMatch || !tagMatch[1]) {
    throw new Error(
      `Não foi possível identificar a versão mais recente a partir da URL: ${finalUrl}`
    );
  }

  const tag = decodeURIComponent(tagMatch[1]);
  const version = tag.replace(/^v/i, "");
  const downloadUrl = `https://github.com/${repo}/releases/download/${tag}/${assetName}`;
  return { tag, version, downloadUrl, assetName };
}

export function replaceBinaryOnDisk(
  targetPath: string,
  newBinaryBuffer: Uint8Array,
  minBytes: number = 1024
): void {
  if (newBinaryBuffer.byteLength < minBytes) {
    throw new Error(
      `Binário baixado inválido ou corrompido (${newBinaryBuffer.byteLength} bytes, mínimo esperado: ${minBytes} bytes)`
    );
  }

  const resolvedTarget = resolve(targetPath);
  const parentDir = dirname(resolvedTarget);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  const tempNewPath = `${resolvedTarget}.new`;
  const oldBackupPath = `${resolvedTarget}.old`;

  writeFileSync(tempNewPath, Buffer.from(newBinaryBuffer));

  if (process.platform !== "win32") {
    chmodSync(tempNewPath, 0o755);
    renameSync(tempNewPath, resolvedTarget);
    return;
  }

  // Estratégia Windows: renomeia o executável atual (mesmo em execução) para .old e move o .new para o destino
  if (existsSync(oldBackupPath)) {
    try {
      unlinkSync(oldBackupPath);
    } catch {
      // Ignora se já bloqueado
    }
  }

  if (existsSync(resolvedTarget)) {
    renameSync(resolvedTarget, oldBackupPath);
  }

  try {
    renameSync(tempNewPath, resolvedTarget);
  } catch (err) {
    // Rollback caso o rename do .new falhe
    if (!existsSync(resolvedTarget) && existsSync(oldBackupPath)) {
      try {
        renameSync(oldBackupPath, resolvedTarget);
      } catch {
        // Ignora erro de rollback
      }
    }
    throw err;
  }

  // Tenta remover o .old imediatamente; se for o próprio processo em execução, agenda limpeza em background
  if (existsSync(oldBackupPath)) {
    try {
      unlinkSync(oldBackupPath);
    } catch {
      try {
        const child = spawn(
          "cmd.exe",
          [
            "/c",
            `ping 127.0.0.1 -n 2 > nul & del /f /q "${oldBackupPath}"`,
          ],
          {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
          }
        );
        child.unref();
      } catch {
        // Será limpo automaticamente na próxima inicialização via cleanupOldBinaryBackup()
      }
    }
  }
}

export async function selfUpdate(
  options: SelfUpdateOptions = {}
): Promise<SelfUpdateResult> {
  const targetPath = resolveSelfBinaryPath(options.targetPath);
  const latest = await fetchLatestReleaseInfo();
  const cmp = compareSemver(VERSION, latest.version);
  const updateAvailable = cmp < 0;

  if (options.checkOnly) {
    const msg = updateAvailable
      ? `Nova versão disponível: v${latest.version} (atual: v${VERSION}). Execute 'docgov-docx --update' para atualizar.`
      : `Você já está na versão mais recente (v${VERSION}).`;
    return {
      updated: false,
      updateAvailable,
      currentVersion: VERSION,
      latestVersion: latest.version,
      targetPath,
      message: msg,
    };
  }

  if (!options.force && !updateAvailable) {
    return {
      updated: false,
      updateAvailable: false,
      currentVersion: VERSION,
      latestVersion: latest.version,
      targetPath,
      message: `Você já está na versão mais recente (v${VERSION}). Use '--force-update' para forçar a reinstalação.`,
    };
  }

  console.log(
    `Baixando ${latest.assetName} (v${latest.version}) de ${latest.downloadUrl} ...`
  );
  const res = await fetch(latest.downloadUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": `docgov-docx-engine/${VERSION}`,
    },
  });

  if (!res.ok) {
    throw new Error(
      `Falha ao baixar o binário da release v${latest.version} (HTTP ${res.status})`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  // Binário standalone Bun tem ~50-100MB; exigimos pelo menos 1 MB para evitar páginas de erro
  replaceBinaryOnDisk(targetPath, new Uint8Array(arrayBuffer), 1024 * 1024);

  return {
    updated: true,
    updateAvailable,
    currentVersion: VERSION,
    latestVersion: latest.version,
    targetPath,
    message: `Atualizado com sucesso para v${latest.version} em: ${targetPath}`,
  };
}

// ============================================================================
// Modo Servidor MCP (stdio)
// ============================================================================

export function getMcpPromptsDefinition() {
  return [
    {
      name: "docx_workflow_guide",
      description:
        "Guia canônico e manual de arquitetura do docgov-docx: ordem do pipeline (1..5), sintaxe de tags, estrutura do slots_manifest.json e boas práticas de injeção.",
      arguments: [],
    },
  ];
}

export function getMcpToolsDefinition() {
  return [
    {
      name: "bootstrap_case",
      description:
        "Cria a estrutura de pastas do caso (inputs/, state/, output/), preserva nomes legíveis ou auto-batiza anexos opacos (media_*) com tipo semântico e hash curto (ex.: ETP_ORGAO_A_3b9d.docx), infere extensões via magic bytes (PK\\x03\\x04 e %PDF), aceita 'fileRenameMap' opcional, copia minutas .docx para inputs/ de forma síncrona imediata salvando mapas estruturais em state/estrutura_<nome>.json, e inicia salvaguarda assíncrona de PDFs/anexos pesados em segundo plano.\n" +
        "- Quando usar (Pré-condição): Primeiro passo obrigatório no ciclo de vida de qualquer caso/processo no DocGov.\n" +
        "- Pós-condição & Próximo Passo: Pastas criadas, arquivos batizados e minutas .docx inspecionadas. Próximo passo recomendado: inspecionar detalhes adicionais com 'inspect_docx' (se necessário) ou criar o 'slots_manifest.json' e chamar 'build_docx_template'.",
      inputSchema: {
        type: "object",
        required: ["caseDir"],
        properties: {
          caseDir: {
            type: "string",
            description:
              "Caminho absoluto ou relativo da pasta raiz do caso (ex.: 'C:/workspace/cases/caso_exemplo' ou 'cases/caso_exemplo'). As subpastas inputs/, state/ e output/ serão criadas dentro dele.",
          },
          uploadsDir: {
            type: "string",
            description:
              "Caminho opcional da pasta contendo os uploads originais do usuário (ex.: 'C:/workspace/.user_uploaded'). Arquivos .docx são copiados e inspecionados imediatamente; PDFs e outros anexos pesados são transferidos em segundo plano sem travar a chamada.",
          },
          fileRenameMap: {
            type: "object",
            description:
              "Mapeamento explícito opcional de nomes de arquivos originais para nomes canônicos (ex.: { 'media_1792069974647_14a93b9d': 'ETP_Modelo.docx' }). Se omitido, o motor preserva nomes legíveis ou auto-batiza anexos opacos com base no conteúdo e magic bytes.",
            additionalProperties: {
              type: "string",
            },
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    {
      name: "inspect_docx",
      description:
        "Realiza a engenharia reversa estrutural completa de um arquivo Word (.docx), construindo no topo do JSON o índice estrutural rápido 'toc_map' (seções P..., perguntas/campos de formulário T...R...C... com suggested_target_slot e resumo de tabelas) e gravando o JSON detalhado em outputPath com retorno de sumário sintético executivo 'toc_summary' (< 1 KB).\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após 'bootstrap_case' para descobrir os índices exatos de parágrafos e células que serão substituídos no modelo, OU após 'fill_docx_template' sobre o arquivo gerado em output/ para preparar o mapa estrutural para auditoria externa.\n" +
        "- Pós-condição & Próximo Passo: Grava em disco o mapa estrutural detalhado com toc_map. Próximo passo recomendado: consulte toc_summary ou toc_map para mapear as tags no 'slots_manifest.json' e chamar 'build_docx_template' (ou, na fase pós-geração, prosseguir para 'generate_audit_docx').",
      inputSchema: {
        type: "object",
        required: ["docxPath"],
        properties: {
          docxPath: {
            type: "string",
            description:
              "Caminho absoluto ou relativo do arquivo Word bruto a ser inspecionado (ex.: 'C:/workspace/cases/caso_exemplo/inputs/modelo_etp.docx' ou 'C:/workspace/cases/caso_exemplo/output/ETP_Exemplo.docx').",
          },
          outputPath: {
            type: "string",
            description:
              "Caminho onde o mapa estrutural JSON detalhado será gravado no disco (ex.: 'C:/workspace/cases/caso_exemplo/state/estrutura_etp.json' ou 'C:/workspace/cases/caso_exemplo/state/inspecao_output.json'). Se omitido, salva automaticamente como <docx>_estrutura.json.",
          },
          compact: {
            type: "boolean",
            description:
              "Se true (padrão), omite parágrafos e células vazias no JSON de saída para economizar espaço em disco, preservando intactos os índices originais 0-based e o toc_map.",
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    {
      name: "build_docx_template",
      description:
        "Transforma um documento Word (.docx) bruto em um template parametrizado com tags {{...}} a partir de regras definidas em um slots_manifest.json, com auto-reparo e diagnóstico cirúrgico de JSON, preservando 100% da formatação visual (<w:pPr>, <w:rPr>, estilos, cabeçalhos e tabelas). Suporta replace_paragraphs, replace_table_cells, loop_table_rows, loop_paragraphs e replace_inline.\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após 'inspect_docx' e após a elaboração do arquivo 'slots_manifest.json'.\n" +
        "- Pós-condição & Próximo Passo: Gera o template .docx parametrizado com tags em outputPath. Próximo passo recomendado: elaborar o 'estado_caso.json' com os dados do processo e chamar 'fill_docx_template'.",
      inputSchema: {
        type: "object",
        required: ["sourcePath", "manifestPath", "outputPath"],
        properties: {
          sourcePath: {
            type: "string",
            description:
              "Caminho do arquivo Word (.docx) bruto original, sem tags (ex.: 'C:/workspace/cases/caso_exemplo/inputs/modelo_etp.docx').",
          },
          manifestPath: {
            type: "string",
            description:
              "Caminho do arquivo JSON de manifesto contendo as regras de slots (ex.: 'C:/workspace/cases/caso_exemplo/state/slots_manifest.json'). Estrutura esperada: { replace_paragraphs: [{ start_p, end_p, tag }], replace_table_cells: [{ table_index, row_index, cell_index, tag }], loop_table_rows: [{ table_index, header_row_index, template_row_index, for_open_tag, for_close_tag, cell_tags: [...] }], replace_inline: [{ find, replace }] }.",
          },
          outputPath: {
            type: "string",
            description:
              "Caminho onde o novo arquivo template .docx parametrizado será salvo (ex.: 'C:/workspace/cases/caso_exemplo/state/template_etp.docx').",
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    {
      name: "fill_docx_template",
      description:
        "Injeta os dados de um estado_caso.json em um template Word (.docx) parametrizado com tags {{...}}, com auto-reparo de JSON, desaninhamento automático (unflatten) de chaves com notação de ponto (ex.: 'etp.necessidade'), resolvendo variáveis simples, loops FOR em tabelas, blocos condicionais IF, conversão de quebras \\n em parágrafos reais, negrito seletivo (**texto**) e expansão recursiva de listas multinível (1.1, 1.1.1, etc.).\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após 'build_docx_template' gerar o template e após a elaboração do 'estado_caso.json'.\n" +
        "- Pós-condição & Próximo Passo: Gera a minuta final do documento Word em outputPath. Próximo passo recomendado: para fins de auditoria externa, execute 'inspect_docx' sobre este arquivo gerado em output/ (gerando state/inspecao_output.json) antes de acionar a auditoria e 'generate_audit_docx'.",
      inputSchema: {
        type: "object",
        required: ["templatePath", "statePath", "outputPath"],
        properties: {
          templatePath: {
            type: "string",
            description:
              "Caminho do arquivo modelo Word (.docx) parametrizado com tags {{...}} gerado pelo build_docx_template (ex.: 'C:/workspace/cases/caso_exemplo/state/template_etp.docx').",
          },
          statePath: {
            type: "string",
            description:
              "Caminho do arquivo JSON contendo o estado do caso/processo com os dados a serem injetados nas tags (ex.: 'C:/workspace/cases/caso_exemplo/state/estado_caso.json'). Objeto contendo campos correspondentes às tags do template (ex.: { processo_id: '...', objeto: { descricao: '...' }, itens: [...] }).",
          },
          outputPath: {
            type: "string",
            description:
              "Caminho de saída onde o documento final compilado será gerado (ex.: 'C:/workspace/cases/caso_exemplo/output/ETP_Exemplo.docx').",
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    {
      name: "generate_audit_docx",
      description:
        "Gera um Relatório de Auditoria Técnico-Jurídica em formato Word (.docx) em layout editorial vertical corrido (folha A4 retrato, zero tabelas <w:tbl>, 100% largura útil), com sanitização automática de crases Markdown, coordenadas e códigos de enum, e transcrição integral de trechos probatórios (trechos_documento) em blocos de citação recuados.\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após a auditoria do documento gerado e consolidação do arquivo 'relatorio_auditoria.json'.\n" +
        "- Pós-condição & Próximo Passo: Gera o documento .docx executivo do parecer de auditoria em outputPath. Conclui formalmente o ciclo de auditoria do processo.",
      inputSchema: {
        type: "object",
        required: ["auditJsonPath", "outputPath"],
        properties: {
          auditJsonPath: {
            type: "string",
            description:
              "Caminho do arquivo relatorio_auditoria.json gerado pelo agente auditor (ex.: 'C:/workspace/cases/caso_exemplo/state/relatorio_auditoria.json'). Estrutura esperada: { processo_id, artefato_auditado, status_global, contagem: { bloqueantes, alertas, conformes }, resumo_executivo, apontamentos: [{ id, vulnerabilidade, status, base_legal, analise, redacao_saneadora, trechos_documento: [{ secao_legivel, texto_transcrito }] }] }.",
          },
          outputPath: {
            type: "string",
            description:
              "Caminho onde o arquivo .docx do parecer de auditoria executivo será salvo (ex.: 'C:/workspace/cases/caso_exemplo/output/Relatorio_Auditoria_ETP.docx').",
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
  ];
}

async function runMcpServer() {
  const server = new Server(
    { name: "docgov-docx-engine", version: VERSION },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
      instructions: DOCX_ENGINE_INSTRUCTIONS,
    }
  );

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: getMcpPromptsDefinition(),
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name;
    if (promptName === "docx_workflow_guide") {
      return {
        description: "Guia Canônico do Ciclo de Vida docgov-docx",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: DOCX_WORKFLOW_GUIDE_TEXT,
            },
          },
        ],
      };
    }
    throw new Error(`Prompt desconhecido: ${promptName}`);
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: getMcpToolsDefinition(),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;

    try {
      if (toolName === "bootstrap_case") {
        const { caseDir, uploadsDir, fileRenameMap } = request.params
          .arguments as {
          caseDir: string;
          uploadsDir?: string;
          fileRenameMap?: Record<string, string>;
        };
        const res = await bootstrapCase(caseDir, uploadsDir, { fileRenameMap });
        const synthetic = formatBootstrapCaseSyntheticResult(res, caseDir);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(synthetic, null, 2),
            },
          ],
        };
      }

      if (toolName === "inspect_docx") {
        const { docxPath, outputPath, compact } = request.params.arguments as {
          docxPath: string;
          outputPath?: string;
          compact?: boolean;
        };
        const resolvedDocx = resolve(docxPath);
        const effectiveOutputPath = outputPath
          ? resolve(outputPath)
          : resolve(
              dirname(resolvedDocx),
              `estrutura_${basename(resolvedDocx, ".docx")}.json`
            );

        const inspection = await inspectDocx(
          resolvedDocx,
          effectiveOutputPath,
          compact !== false
        );

        const synthetic = formatInspectDocxSyntheticResult(
          docxPath,
          effectiveOutputPath,
          inspection
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(synthetic, null, 2),
            },
          ],
        };
      }

      if (toolName === "build_docx_template") {
        const { sourcePath, manifestPath, outputPath } = request.params
          .arguments as {
          sourcePath: string;
          manifestPath: string;
          outputPath: string;
        };
        const result = await buildDocxTemplate(
          sourcePath,
          manifestPath,
          outputPath
        );
        const nextHint =
          "Próximo passo recomendado: elabore ou atualize o arquivo de estado (ex.: state/estado_caso.json) e chame 'fill_docx_template' para injetar os dados e gerar a minuta final.";
        return {
          content: [{ type: "text", text: `${result.message}\n${nextHint}` }],
        };
      }

      if (toolName === "fill_docx_template") {
        const { templatePath, statePath, outputPath } = request.params
          .arguments as {
          templatePath: string;
          statePath: string;
          outputPath: string;
        };
        const result = await processDocument(
          templatePath,
          statePath,
          outputPath
        );
        const nextHint =
          "Próximo passo recomendado: para fins de auditoria externa, execute 'inspect_docx' sobre este arquivo gerado em output/ (gerando state/inspecao_output.json) antes de acionar a auditoria e 'generate_audit_docx'.";
        return {
          content: [{ type: "text", text: `${result.message}\n${nextHint}` }],
        };
      }

      if (toolName === "generate_audit_docx") {
        const { auditJsonPath, outputPath } = request.params.arguments as {
          auditJsonPath: string;
          outputPath: string;
        };
        const result = await generateAuditDocx(auditJsonPath, outputPath);
        const nextHint =
          "Ciclo de auditoria concluído: o parecer em layout vertical A4 (zero tabelas) está pronto em output/ para revisão e assinatura.";
        return {
          content: [{ type: "text", text: `${result.message}\n${nextHint}` }],
        };
      }
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Falha ao executar ${toolName}: ${err.message}`,
          },
        ],
      };
    }

    throw new Error(`Ferramenta desconhecida: ${toolName}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ============================================================================
// Modo CLI (Linha de Comando)
// ============================================================================

async function runCli(args: string[]) {
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`docgov-docx-engine v${VERSION}`);
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
DocGov Docx Engine v${VERSION} — CLI & MCP Server

Uso:
  docgov-docx                                     Inicia como servidor MCP via stdio (padrão)
  docgov-docx --mcp                               Inicia como servidor MCP via stdio
  docgov-docx --bootstrap-case --case-dir <dir> [--uploads-dir <dir>] [--rename-map <json>] [--wait]
  docgov-docx --inspect <arq.docx> [--out <mapa.json>] [--compact]
  docgov-docx --build-template --source <bruto.docx> --manifest <slots_manifest.json> --out <template.docx>
  docgov-docx --inject --template <template.docx> --state <estado.json> --out <saida.docx>
  docgov-docx --generate-audit-docx --audit-json <auditoria.json> --out <parecer.docx>
  docgov-docx --check-update                      Verifica se há nova versão disponível no GitHub
  docgov-docx -u, --update                        Atualiza o binário para a versão mais recente (se houver)
  docgov-docx --force-update                      Força o download e reinstalação da última release
  docgov-docx -v, --version                       Exibe a versão do software
  docgov-docx -h, --help                          Exibe esta mensagem de ajuda
`);
    return;
  }

  // 0a) Modo interno de cópia em segundo plano desanexada
  if (args.includes("--internal-bg-copy")) {
    const sourceIdx = args.indexOf("--source");
    const destIdx = args.indexOf("--dest");
    const stateIdx = args.indexOf("--state");
    const filesIdx = args.indexOf("--files");
    if (
      sourceIdx !== -1 &&
      destIdx !== -1 &&
      stateIdx !== -1 &&
      filesIdx !== -1
    ) {
      try {
        const sourceDir = args[sourceIdx + 1];
        const destDir = args[destIdx + 1];
        const stateDir = args[stateIdx + 1];
        const files: BackgroundCopyInput = JSON.parse(args[filesIdx + 1]);
        await executeBackgroundCopyTask(sourceDir, destDir, stateDir, files);
      } catch {
        process.exit(1);
      }
    }
    return;
  }

  // 0) Modo Auto-Atualização (--check-update, --update, -u, --force-update)
  if (
    args.includes("--check-update") ||
    args.includes("--update") ||
    args.includes("-u") ||
    args.includes("--force-update")
  ) {
    const checkOnly = args.includes("--check-update");
    const force = args.includes("--force-update");
    const outIdx = args.indexOf("--out");
    const customTarget = outIdx !== -1 ? args[outIdx + 1] : undefined;

    try {
      const res = await selfUpdate({
        checkOnly,
        force,
        targetPath: customTarget,
      });
      console.log(res.message);
    } catch (err: any) {
      console.error(`Erro na atualização: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 0b) Modo --bootstrap-case
  if (args.includes("--bootstrap-case")) {
    const caseDirIdx = args.indexOf("--case-dir");
    const uploadsDirIdx = args.indexOf("--uploads-dir");
    const renameMapIdx = args.indexOf("--rename-map");
    const bootstrapIdx = args.indexOf("--bootstrap-case");
    const wait = args.includes("--wait");

    let caseDir: string | undefined;
    if (caseDirIdx !== -1 && args[caseDirIdx + 1]) {
      caseDir = args[caseDirIdx + 1];
    } else if (
      args[bootstrapIdx + 1] &&
      !args[bootstrapIdx + 1].startsWith("--")
    ) {
      caseDir = args[bootstrapIdx + 1];
    }

    const uploadsDir =
      uploadsDirIdx !== -1 ? args[uploadsDirIdx + 1] : undefined;

    let fileRenameMap: Record<string, string> | undefined;
    if (renameMapIdx !== -1 && args[renameMapIdx + 1]) {
      try {
        fileRenameMap = JSON.parse(args[renameMapIdx + 1]);
      } catch {
        console.error(
          "Aviso: Falha ao interpretar --rename-map como JSON válido."
        );
      }
    }

    if (!caseDir) {
      console.error(
        "Erro: Informe o diretório do caso usando --case-dir <dir>."
      );
      process.exit(1);
    }

    try {
      const res = await bootstrapCase(caseDir, uploadsDir, {
        waitBackground: wait,
        detachedCli: !wait,
        fileRenameMap,
      });
      const synthetic = formatBootstrapCaseSyntheticResult(res, caseDir);
      console.log(JSON.stringify(synthetic, null, 2));
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 1) Modo --inspect
  if (args.includes("--inspect")) {
    const inspectIdx = args.indexOf("--inspect");
    const sourceIdx = args.indexOf("--source");
    const outIdx = args.indexOf("--out");
    const compact = args.includes("--compact");

    let docxPath: string | undefined;
    if (sourceIdx !== -1 && args[sourceIdx + 1]) {
      docxPath = args[sourceIdx + 1];
    } else if (
      args[inspectIdx + 1] &&
      !args[inspectIdx + 1].startsWith("--")
    ) {
      docxPath = args[inspectIdx + 1];
    }

    const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;

    if (!docxPath) {
      console.error("Erro: Informe o caminho do arquivo .docx após --inspect.");
      process.exit(1);
    }

    try {
      const res = await inspectDocx(docxPath, outPath, compact);
      if (outPath) {
        const synthetic = formatInspectDocxSyntheticResult(
          docxPath,
          resolve(outPath),
          res
        );
        console.log(JSON.stringify(synthetic, null, 2));
      } else {
        console.log(JSON.stringify(res, null, 2));
      }
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 2) Modo --build-template
  if (args.includes("--build-template")) {
    const sourceIdx = args.indexOf("--source");
    const manifestIdx = args.indexOf("--manifest");
    const outIdx = args.indexOf("--out");

    if (sourceIdx === -1 || manifestIdx === -1 || outIdx === -1) {
      console.error(
        "Erro: Parâmetros obrigatórios para --build-template: --source, --manifest e --out."
      );
      process.exit(1);
    }

    try {
      const res = await buildDocxTemplate(
        args[sourceIdx + 1],
        args[manifestIdx + 1],
        args[outIdx + 1]
      );
      console.log(res.message);
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 2b) Modo --generate-audit / --generate-audit-docx
  if (
    args.includes("--generate-audit-docx") ||
    args.includes("--generate-audit")
  ) {
    const auditJsonIdx = args.indexOf("--audit-json");
    const stateIdx = args.indexOf("--state");
    const outIdx = args.indexOf("--out");
    const flagIdx = args.includes("--generate-audit-docx")
      ? args.indexOf("--generate-audit-docx")
      : args.indexOf("--generate-audit");

    let auditJsonPath: string | undefined;
    if (auditJsonIdx !== -1 && args[auditJsonIdx + 1]) {
      auditJsonPath = args[auditJsonIdx + 1];
    } else if (stateIdx !== -1 && args[stateIdx + 1]) {
      auditJsonPath = args[stateIdx + 1];
    } else if (
      flagIdx !== -1 &&
      args[flagIdx + 1] &&
      !args[flagIdx + 1].startsWith("--")
    ) {
      auditJsonPath = args[flagIdx + 1];
    }

    const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;

    if (!auditJsonPath || !outPath) {
      console.error(
        "Erro: Parâmetros obrigatórios para --generate-audit-docx: --audit-json e --out."
      );
      process.exit(1);
    }

    try {
      const res = await generateAuditDocx(auditJsonPath, outPath);
      console.log(res.message);
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 3) Modo --inject / --template
  const templateIdx = args.indexOf("--template");
  const stateIdx = args.indexOf("--state");
  const outIdx = args.indexOf("--out");

  if (templateIdx === -1 || stateIdx === -1 || outIdx === -1) {
    console.error(
      "Erro: Parâmetros obrigatórios ausentes: --template, --state e --out."
    );
    process.exit(1);
  }

  try {
    const res = await processDocument(
      args[templateIdx + 1],
      args[stateIdx + 1],
      args[outIdx + 1]
    );
    console.log(res.message);
  } catch (err: any) {
    console.error(`Erro: ${err.message}`);
    process.exit(1);
  }
}

// ============================================================================
// Entrada Principal
// ============================================================================

if (import.meta.main) {
  cleanupOldBinaryBackup();
  const args = process.argv.slice(2);

  // Se tiver flag explícita de CLI, roda CLI.
  // Caso contrário (sem args ou com --mcp), sobe como MCP server imediatamente.
  if (
    args.includes("--internal-bg-copy") ||
    args.includes("--bootstrap-case") ||
    args.includes("--inspect") ||
    args.includes("--build-template") ||
    args.includes("--inject") ||
    args.includes("--template") ||
    args.includes("--generate-audit-docx") ||
    args.includes("--generate-audit") ||
    args.includes("--check-update") ||
    args.includes("--update") ||
    args.includes("-u") ||
    args.includes("--force-update") ||
    args.includes("--help") ||
    args.includes("-h") ||
    args.includes("--version") ||
    args.includes("-v")
  ) {
    runCli(args);
  } else {
    runMcpServer();
  }
}


