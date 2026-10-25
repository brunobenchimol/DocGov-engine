import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { sanitizeXmlString } from "../utils/xml.ts";
import type { TableInfo, TableRowInfo, TableCellInfo } from "../types/index.ts";

// ============================================================================
// Ingestão Nativa de Planilhas (.xlsx e .csv) — Marco 5.2a
// ============================================================================

export interface SpreadsheetSheetInfo {
  index: number;
  name: string;
  table: TableInfo;
}

export interface SpreadsheetExtractionResult {
  format: "xlsx" | "csv";
  sheets: SpreadsheetSheetInfo[];
  tables: TableInfo[];
  totalRows: number;
}

/**
 * Converte letras de coluna em índice zero-based:
 * A -> 0, B -> 1, ..., Z -> 25, AA -> 26, AB -> 27...
 */
export function columnLetterToIndex(colStr: string): number {
  let col = 0;
  const upper = colStr.toUpperCase().trim();
  for (let i = 0; i < upper.length; i++) {
    const code = upper.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      col = col * 26 + (code - 64);
    }
  }
  return Math.max(0, col - 1);
}

/**
 * Converte índice zero-based em letra de coluna:
 * 0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA...
 */
export function columnIndexToLetter(colIndex: number): string {
  let temp = colIndex + 1;
  let letter = "";
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

/**
 * Extrai índice de coluna e linha (ambos 0-based) de referências como "A1", "C25", "AA10".
 */
export function parseCellReference(r: string): { colIndex: number; rowIndex: number } {
  const match = r.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return { colIndex: 0, rowIndex: 0 };
  return {
    colIndex: columnLetterToIndex(match[1]),
    rowIndex: Math.max(0, parseInt(match[2], 10) - 1),
  };
}

/**
 * Extrai lista de strings compartilhadas de xl/sharedStrings.xml.
 */
export function parseSharedStrings(xmlContent: string): string[] {
  const sanitized = sanitizeXmlString(xmlContent);
  const doc = new DOMParser().parseFromString(sanitized, "application/xml");
  const siList = doc.getElementsByTagName("si");
  const result: string[] = [];

  for (let i = 0; i < siList.length; i++) {
    const si = siList[i];
    const tList = si.getElementsByTagName("t");
    let text = "";
    for (let j = 0; j < tList.length; j++) {
      text += tList[j].textContent || "";
    }
    result.push(text);
  }

  return result;
}

/**
 * Parser nativo e ultraleve de planilhas OpenXML (.xlsx).
 * Utiliza exclusivamente JSZip e @xmldom/xmldom (zero dependências pesadas externas).
 * Preenche estritamente colunas vazias por referência r="A1" para evitar deslocamento colunar.
 */
export async function parseXlsxBuffer(buffer: Buffer): Promise<SpreadsheetExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);

  // 1. Carrega sharedStrings.xml (se existir)
  let sharedStrings: string[] = [];
  const sharedStringsFile = zip.file("xl/sharedStrings.xml") || zip.file("xl/SharedStrings.xml");
  if (sharedStringsFile) {
    const rawXml = await sharedStringsFile.async("string");
    sharedStrings = parseSharedStrings(rawXml);
  }

  // 2. Mapeia nomes das abas em xl/workbook.xml e relacionamentos em xl/_rels/workbook.xml.rels
  interface SheetMeta {
    name: string;
    sheetId: string;
    rId: string;
    targetPath: string;
  }
  const sheetsMeta: SheetMeta[] = [];

  const relsFile = zip.file("xl/_rels/workbook.xml.rels");
  const relsMap = new Map<string, string>();
  if (relsFile) {
    const relsXml = sanitizeXmlString(await relsFile.async("string"));
    const relsDoc = new DOMParser().parseFromString(relsXml, "application/xml");
    const relElements = relsDoc.getElementsByTagName("Relationship");
    for (let i = 0; i < relElements.length; i++) {
      const el = relElements[i];
      const id = el.getAttribute("Id");
      const target = el.getAttribute("Target");
      if (id && target) {
        // Normaliza caminho relativo para a raiz do zip (ex.: worksheets/sheet1.xml -> xl/worksheets/sheet1.xml)
        const normalizedTarget = target.startsWith("/")
          ? target.slice(1)
          : target.startsWith("xl/")
            ? target
            : `xl/${target}`;
        relsMap.set(id, normalizedTarget);
      }
    }
  }

  const wbFile = zip.file("xl/workbook.xml");
  if (wbFile) {
    const wbXml = sanitizeXmlString(await wbFile.async("string"));
    const wbDoc = new DOMParser().parseFromString(wbXml, "application/xml");
    const sheetEls = wbDoc.getElementsByTagName("sheet");
    for (let i = 0; i < sheetEls.length; i++) {
      const el = sheetEls[i];
      const name = el.getAttribute("name") || `Aba_${i + 1}`;
      const sheetId = el.getAttribute("sheetId") || String(i + 1);
      const rId =
        el.getAttribute("r:id") ||
        el.getAttribute("id") ||
        `rId${i + 1}`;
      const targetPath = relsMap.get(rId) || `xl/worksheets/sheet${i + 1}.xml`;
      sheetsMeta.push({ name, sheetId, rId, targetPath });
    }
  }

  // Fallback se workbook.xml não contiver sheets
  if (sheetsMeta.length === 0) {
    // Procura arquivos sheet*.xml diretamente no ZIP
    const sheetFiles = Object.keys(zip.files).filter((k) =>
      /^xl\/worksheets\/sheet\d+\.xml$/i.test(k)
    );
    for (let i = 0; i < sheetFiles.length; i++) {
      sheetsMeta.push({
        name: `Planilha_${i + 1}`,
        sheetId: String(i + 1),
        rId: `rId${i + 1}`,
        targetPath: sheetFiles[i],
      });
    }
  }

  const sheets: SpreadsheetSheetInfo[] = [];
  const tables: TableInfo[] = [];
  let totalRows = 0;

  for (let sIdx = 0; sIdx < sheetsMeta.length; sIdx++) {
    const meta = sheetsMeta[sIdx];
    const sheetFile = zip.file(meta.targetPath);
    if (!sheetFile) continue;

    const sheetXml = sanitizeXmlString(await sheetFile.async("string"));
    const sheetDoc = new DOMParser().parseFromString(sheetXml, "application/xml");

    const rowEls = sheetDoc.getElementsByTagName("row");
    const tableRows: TableRowInfo[] = [];

    for (let r = 0; r < rowEls.length; r++) {
      const rowEl = rowEls[r];
      const rowAttr = rowEl.getAttribute("r");
      const logicalRowIndex = rowAttr
        ? Math.max(0, parseInt(rowAttr, 10) - 1)
        : r;

      const cellEls = rowEl.getElementsByTagName("c");
      if (cellEls.length === 0) continue;

      // Mapeia células pela coordenada colIndex extraída de r="A1"
      const cellMap = new Map<number, string>();
      let maxCol = 0;

      for (let c = 0; c < cellEls.length; c++) {
        const cEl = cellEls[c];
        const cellRef = cEl.getAttribute("r");
        let colIdx = c;
        if (cellRef) {
          colIdx = parseCellReference(cellRef).colIndex;
        }
        if (colIdx > maxCol) maxCol = colIdx;

        const cellType = cEl.getAttribute("t");
        let valText = "";

        if (cellType === "s") {
          // Shared string index
          const vEl = cEl.getElementsByTagName("v")[0];
          if (vEl && vEl.textContent) {
            const strIdx = parseInt(vEl.textContent.trim(), 10);
            valText = sharedStrings[strIdx] ?? "";
          }
        } else if (cellType === "inlineStr") {
          // Inline string
          const isEl = cEl.getElementsByTagName("is")[0];
          if (isEl) {
            const tEls = isEl.getElementsByTagName("t");
            for (let t = 0; t < tEls.length; t++) {
              valText += tEls[t].textContent || "";
            }
          }
        } else {
          // Número, fórmula ou string simples em <v>
          const vEl = cEl.getElementsByTagName("v")[0];
          if (vEl && vEl.textContent) {
            valText = vEl.textContent.trim();
          }
        }

        cellMap.set(colIdx, valText);
      }

      // Constrói array completo de colunas de 0 até maxCol garantindo alinhamento por r="A1"
      const cells: TableCellInfo[] = [];
      for (let c = 0; c <= maxCol; c++) {
        cells.push({
          cellIndex: c,
          text: cellMap.get(c) || "",
        });
      }

      // Adiciona linha se tiver pelo menos uma célula não vazia
      if (cells.some((c) => c.text.trim() !== "")) {
        tableRows.push({
          rowIndex: logicalRowIndex,
          cells,
        });
      }
    }

    const table: TableInfo = {
      index: sIdx,
      rows: tableRows,
    };

    sheets.push({
      index: sIdx,
      name: meta.name,
      table,
    });
    tables.push(table);
    totalRows += tableRows.length;
  }

  return {
    format: "xlsx",
    sheets,
    tables,
    totalRows,
  };
}

/**
 * Parser nativo de arquivos CSV aderente à RFC 4180.
 * Suporta delimitadores vírgula (,), ponto e vírgula (;) e tabulação (\t),
 * decodificando corretamente arquivos UTF-8 (com ou sem BOM) e Latin1.
 */
export function parseCsvBuffer(buffer: Buffer): SpreadsheetExtractionResult {
  // Detecta UTF-8 BOM (\uFEFF)
  let text: string;
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    text = buffer.subarray(3).toString("utf-8");
  } else {
    // Tenta UTF-8; se contiver caracteres inválidos, faz fallback para latin1
    try {
      const utf8Candidate = buffer.toString("utf-8");
      // Verifica sequência de substituição unicode
      if (utf8Candidate.includes("\ufffd")) {
        text = buffer.toString("latin1");
      } else {
        text = utf8Candidate;
      }
    } catch {
      text = buffer.toString("latin1");
    }
  }

  // Remove eventuais BOMs residuais
  text = text.replace(/^\uFEFF/, "");

  // Autodetecção do delimitador analisando as 10 primeiras linhas
  const sampleLines = text.split(/\r?\n/).slice(0, 10).filter((l) => l.trim().length > 0);
  let semiCount = 0;
  let commaCount = 0;
  let tabCount = 0;

  for (const line of sampleLines) {
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      if (!inQuotes) {
        if (ch === ";") semiCount++;
        else if (ch === ",") commaCount++;
        else if (ch === "\t") tabCount++;
      }
    }
  }

  let delimiter = ";";
  if (tabCount > semiCount && tabCount > commaCount) {
    delimiter = "\t";
  } else if (commaCount > semiCount) {
    delimiter = ",";
  }

  // Parser RFC 4180 com suporte a aspas duplas e quebras de linha dentro de células
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    const nextCh = text[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (nextCh === '"') {
          // Aspas escapadas ("") dentro de célula citada
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // Fecha citação
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += ch;
        i++;
        continue;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (ch === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = "";
        i++;
        continue;
      } else if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && nextCh === "\n") {
          i++;
        }
        currentRow.push(currentCell.trim());
        currentCell = "";
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        currentCell += ch;
        i++;
      }
    }
  }

  // Última célula pendente
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  const tableRows: TableRowInfo[] = rows.map((cols, rIdx) => ({
    rowIndex: rIdx,
    cells: cols.map((txt, cIdx) => ({
      cellIndex: cIdx,
      text: txt,
    })),
  }));

  const table: TableInfo = {
    index: 0,
    rows: tableRows,
  };

  const sheets: SpreadsheetSheetInfo[] = [
    {
      index: 0,
      name: "CSV",
      table,
    },
  ];

  return {
    format: "csv",
    sheets,
    tables: [table],
    totalRows: tableRows.length,
  };
}

/**
 * Gera a Visão Linear de Auditoria em Markdown para planilhas (.xlsx e .csv).
 */
export function generateSpreadsheetLinearAuditViewMarkdown(
  docName: string,
  result: SpreadsheetExtractionResult
): string {
  const lines: string[] = [];
  lines.push(`# Visão Linear de Auditoria: ${docName}`);
  lines.push(
    `> Planilha de dados inspecionada por docgov-engine (${result.sheets.length} aba(s), ${result.totalRows} linha(s) de dados).`
  );
  lines.push("");

  for (const sheet of result.sheets) {
    const sheetPrefix = sheet.name.replace(/[^a-zA-Z0-9_-]/g, "_").toUpperCase();
    lines.push(`## Aba: ${sheet.name} (${sheet.table.rows.length} linhas)`);
    lines.push("");

    for (const r of sheet.table.rows) {
      const parts = r.cells.map(
        (c) =>
          `[${sheetPrefix} | R${r.rowIndex + 1}.C${c.cellIndex + 1}] ${c.text || "[vazio]"}`
      );
      lines.push(`- ${parts.join(" | ")}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

/**
 * Gera o Dossiê de Hotspots para planilhas (.xlsx e .csv).
 */
export function generateSpreadsheetHotspotsDossierMarkdown(
  docName: string,
  result: SpreadsheetExtractionResult
): string {
  const lines: string[] = [];
  lines.push(`# Dossiê Executivo de Hotspots Orçamentários: ${docName}`);
  lines.push(
    `> Extração tabular de insumos orçamentários (${result.sheets.length} aba(s), ${result.totalRows} linha(s)).`
  );
  lines.push("");

  lines.push("## Amostra Estrutural das Primeiras Linhas");
  for (const sheet of result.sheets) {
    const sheetPrefix = sheet.name.replace(/[^a-zA-Z0-9_-]/g, "_").toUpperCase();
    lines.push(`### Aba: ${sheet.name}`);
    const sampleRows = sheet.table.rows.slice(0, 15);
    for (const r of sampleRows) {
      const parts = r.cells.map(
        (c) =>
          `[${sheetPrefix} | R${r.rowIndex + 1}.C${c.cellIndex + 1}] ${c.text || "[vazio]"}`
      );
      lines.push(`- ${parts.join(" | ")}`);
    }
    if (sheet.table.rows.length > 15) {
      lines.push(`- *... [${sheet.table.rows.length - 15} linha(s) adicionais omitidas na amostra]*`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}
