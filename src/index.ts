import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { createReport } from "docx-templates";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export const VERSION = "0.1.0";

// ============================================================================
// Interfaces e Tipos
// ============================================================================

export interface HeaderFooterParagraphInfo {
  part: string;
  index: number;
  paragraphIndex: number;
  style: string | null;
  text: string;
}

export interface BodyParagraphInfo {
  index: number;
  style: string | null;
  text: string;
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

export interface DocxInspectionResult {
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
  replace_table_cells?: ReplaceTableCellRule[];
  loop_table_rows?: LoopTableRowsRule[];
  replace_inline?: ReplaceInlineRule[];
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
  const tNodes = getAllElements(p, "w:t");
  return tNodes.map((t) => t.textContent ?? "").join("");
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

function extractCellText(tc: Element): string {
  const paragraphs = getDirectChildElements(tc, "w:p");
  if (paragraphs.length === 0) {
    return getAllElements(tc, "w:t")
      .map((t) => t.textContent ?? "")
      .join("");
  }
  return paragraphs.map((p) => extractParagraphText(p)).join("\n");
}

function normalizeTag(tag: string): string {
  if (!tag) return "";
  return tag.includes("{{") ? tag : `{{${tag}}}`;
}

function findFirstRunProperties(paragraphs: Element[]): Element | null {
  for (const p of paragraphs) {
    if (!p) continue;
    const runs = getDirectChildElements(p, "w:r");
    for (const r of runs) {
      const rPrList = getDirectChildElements(r, "w:rPr");
      if (rPrList.length > 0) {
        return rPrList[0].cloneNode(true) as Element;
      }
    }
  }
  return null;
}

function setParagraphSingleRunText(
  doc: Document,
  p: Element,
  text: string,
  fallbackRPr?: Element | null
): void {
  const pPrList = getDirectChildElements(p, "w:pPr");
  const clonedPPr =
    pPrList.length > 0 ? (pPrList[0].cloneNode(true) as Element) : null;

  const clonedRPr = findFirstRunProperties([p]) ?? fallbackRPr ?? null;

  while (p.firstChild) {
    p.removeChild(p.firstChild);
  }

  if (clonedPPr) {
    p.appendChild(clonedPPr);
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
  const fallbackRPr = findFirstRunProperties(existingParagraphs);

  setParagraphSingleRunText(doc, firstP, text, fallbackRPr);

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

  const clonedRPr = findFirstRunProperties(paragraphs);
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
          // Remove o <w:r> se restar apenas <w:rPr> (sem <w:drawing>, <w:pict>, <w:br>, <w:tab>)
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
// 1. Função de Inspeção Estrutural (inspect_docx)
// ============================================================================

export async function inspectDocx(
  docxPath: string,
  outputPath?: string
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
  const paragraphs: BodyParagraphInfo[] = bodyParagraphs.map((p, index) => ({
    index,
    style: extractParagraphStyle(p),
    text: extractParagraphText(p),
  }));

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

  const result: DocxInspectionResult = {
    headers,
    footers,
    paragraphs,
    tables,
  };

  if (outputPath) {
    const resolvedOut = resolve(outputPath);
    writeFileSync(resolvedOut, JSON.stringify(result, null, 2), "utf-8");
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
  const manifest: SlotsManifest = JSON.parse(
    readFileSync(resolvedManifest, "utf-8")
  );

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
      const fallbackRPr = findFirstRunProperties(paragraphRange);

      setParagraphSingleRunText(
        docXml,
        targetP,
        normalizeTag(tag),
        fallbackRPr
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
  const stateData = JSON.parse(readFileSync(resolvedState, "utf-8"));

  const outputBuffer = await createReport({
    template: templateBuffer,
    data: stateData,
    cmdDelimiter: ["{{", "}}"],
    processLineBreaks: true,
    noSandbox: true,
  });

  writeFileSync(resolvedOutput, Buffer.from(outputBuffer));
  return {
    success: true,
    message: `Documento gerado com sucesso em: ${resolvedOutput}`,
  };
}

// ============================================================================
// Modo Servidor MCP (stdio)
// ============================================================================

async function runMcpServer() {
  const server = new Server(
    { name: "docgov-docx-engine", version: VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "inspect_docx",
          description:
            "Realiza a engenharia reversa estrutural de qualquer arquivo Word (.docx), extraindo cabeçalhos (headers), rodapés (footers), parágrafos indexados (0..N com estilo e texto) e tabelas indexadas (0..M com linhas e células).",
          inputSchema: {
            type: "object",
            required: ["docxPath"],
            properties: {
              docxPath: {
                type: "string",
                description: "Caminho do arquivo .docx a ser inspecionado",
              },
              outputPath: {
                type: "string",
                description:
                  "Caminho opcional onde o mapa estrutural JSON será gravado no disco",
              },
            },
          },
        },
        {
          name: "build_docx_template",
          description:
            "Transforma um documento Word (.docx) bruto (sem tags) em um template parametrizado com tags {{...}} a partir de um arquivo slots_manifest.json (suportando replace_paragraphs, replace_table_cells, loop_table_rows e replace_inline), preservando 100% da formatação visual.",
          inputSchema: {
            type: "object",
            required: ["sourcePath", "manifestPath", "outputPath"],
            properties: {
              sourcePath: {
                type: "string",
                description: "Caminho do arquivo .docx bruto original",
              },
              manifestPath: {
                type: "string",
                description:
                  "Caminho do arquivo slots_manifest.json com as regras de parametrização",
              },
              outputPath: {
                type: "string",
                description:
                  "Caminho onde o novo template .docx parametrizado será salvo",
              },
            },
          },
        },
        {
          name: "fill_docx_template",
          description:
            "Preenche um modelo Word (.docx) substituindo variáveis e tabelas com base no JSON de estado do processo, gerando uma minuta limpa sem código residual.",
          inputSchema: {
            type: "object",
            required: ["templatePath", "statePath", "outputPath"],
            properties: {
              templatePath: {
                type: "string",
                description: "Caminho do arquivo modelo .docx",
              },
              statePath: {
                type: "string",
                description: "Caminho do arquivo estado_caso.json",
              },
              outputPath: {
                type: "string",
                description: "Caminho onde o .docx final gerado será salvo",
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;

    try {
      if (toolName === "inspect_docx") {
        const { docxPath, outputPath } = request.params.arguments as {
          docxPath: string;
          outputPath?: string;
        };
        const inspection = await inspectDocx(docxPath, outputPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(inspection, null, 2),
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
        return {
          content: [{ type: "text", text: result.message }],
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
        return {
          content: [{ type: "text", text: result.message }],
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
  docgov-docx --inspect <arq.docx> [--out <mapa.json>]
  docgov-docx --build-template --source <bruto.docx> --manifest <slots_manifest.json> --out <template.docx>
  docgov-docx --inject --template <template.docx> --state <estado.json> --out <saida.docx>
  docgov-docx -v, --version                       Exibe a versão do software
  docgov-docx -h, --help                          Exibe esta mensagem de ajuda
`);
    return;
  }

  // 1) Modo --inspect
  if (args.includes("--inspect")) {
    const inspectIdx = args.indexOf("--inspect");
    const sourceIdx = args.indexOf("--source");
    const outIdx = args.indexOf("--out");

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
      const res = await inspectDocx(docxPath, outPath);
      console.log(JSON.stringify(res, null, 2));
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
  const args = process.argv.slice(2);

  // Se tiver flag explícita de CLI, roda CLI.
  // Caso contrário (sem args ou com --mcp), sobe como MCP server imediatamente.
  if (
    args.includes("--inspect") ||
    args.includes("--build-template") ||
    args.includes("--inject") ||
    args.includes("--template") ||
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
