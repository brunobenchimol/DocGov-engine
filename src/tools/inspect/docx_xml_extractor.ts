import { basename } from "node:path";
import type JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import {
  getAllElements,
  getDirectChildElements,
  extractParagraphStyle,
  extractParagraphText,
  extractParagraphNumbering,
  extractCellText,
  extractCellGridSpan,
  extractCellVMerge,
  createNumberingResolver,
  sanitizeXmlString,
} from "../../utils/xml.ts";
import type {
  BodyParagraphInfo,
  TableInfo,
  TableRowInfo,
  TableCellInfo,
  HeaderFooterParagraphInfo,
} from "../../types/index.ts";

export interface DocxXmlExtractionOutput {
  headers: HeaderFooterParagraphInfo[];
  footers: HeaderFooterParagraphInfo[];
  paragraphs: BodyParagraphInfo[];
  tables: TableInfo[];
  commentsCount?: number;
}

export async function extractDocxXmlParts(
  zip: JSZip,
  resolvedDocx: string
): Promise<DocxXmlExtractionOutput> {
  const parser = new DOMParser();
  const headers: HeaderFooterParagraphInfo[] = [];
  const footers: HeaderFooterParagraphInfo[] = [];
  const fileNames = Object.keys(zip.files).sort();

  for (const name of fileNames) {
    if (/^word\/header\d*\.xml$/i.test(name)) {
      const xmlStr = sanitizeXmlString(await zip.file(name)!.async("string"));
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
      const xmlStr = sanitizeXmlString(await zip.file(name)!.async("string"));
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
      `Estrutura OpenXML inválida ('word/document.xml' ausente no pacote ZIP): '${basename(
        resolvedDocx
      )}'. O arquivo parece ser um arquivo ZIP genérico e não um documento Microsoft Word (.docx) válido. Verifique os arquivos originais em .user_uploaded ou inputs/.`
    );
  }

  const docXmlStr = sanitizeXmlString(await docFile.async("string"));
  const docXml = parser.parseFromString(docXmlStr, "application/xml");
  const body = getAllElements(docXml, "w:body")[0];
  if (!body) {
    throw new Error(`Elemento <w:body> não encontrado em word/document.xml`);
  }

  const numberingFile = zip.file("word/numbering.xml");
  const numberingXmlStr = numberingFile
    ? await numberingFile.async("string")
    : null;
  const numberingResolver = createNumberingResolver(numberingXmlStr);

  const bodyParagraphs = getDirectChildElements(body, "w:p");
  const paragraphs: BodyParagraphInfo[] = bodyParagraphs.map((p, index) => {
    const numbering = extractParagraphNumbering(p);
    let text = extractParagraphText(p);
    if (numbering) {
      const trimmed = text.trim();
      const isTemplateTag = /^\{\{[\s\S]*\}\}$/.test(trimmed);
      if (trimmed && !isTemplateTag) {
        const computedPrefix = numberingResolver.formatParagraphPrefix(
          numbering.numId,
          numbering.level
        );
        if (
          computedPrefix &&
          !trimmed.startsWith(computedPrefix) &&
          !trimmed.startsWith(`${computedPrefix}.`)
        ) {
          text = `${computedPrefix} ${text.trimStart()}`;
        }
      }
    }
    return {
      index,
      style: extractParagraphStyle(p),
      text,
      ...(numbering ? { numbering } : {}),
    };
  });

  const bodyTables = getDirectChildElements(body, "w:tbl");
  const rawTables: TableInfo[] = bodyTables.map((tbl, index) => {
    const trList = getDirectChildElements(tbl, "w:tr");
    const activeVMerges = new Map<number, string>();

    const rows: TableRowInfo[] = trList.map((tr, rowIndex) => {
      const tcList = getDirectChildElements(tr, "w:tc");
      const cells: TableCellInfo[] = [];
      let currentVirtualCol = 0;

      for (let physicalIdx = 0; physicalIdx < tcList.length; physicalIdx++) {
        const tc = tcList[physicalIdx];
        const span = extractCellGridSpan(tc);
        const vMerge = extractCellVMerge(tc);
        let text = extractCellText(tc);

        if (vMerge === "restart") {
          activeVMerges.set(currentVirtualCol, text);
        } else if (vMerge === "continue") {
          if (!text.trim() && activeVMerges.has(currentVirtualCol)) {
            text = activeVMerges.get(currentVirtualCol) || "";
          }
        } else {
          activeVMerges.delete(currentVirtualCol);
        }

        cells.push({
          cellIndex: currentVirtualCol,
          physicalCellIndex: physicalIdx,
          virtualColIndex: currentVirtualCol,
          text,
          ...(span > 1 ? { colSpan: span } : {}),
          ...(vMerge ? { rowSpan: vMerge } : {}),
        });

        for (let s = 1; s < span; s++) {
          cells.push({
            cellIndex: currentVirtualCol + s,
            physicalCellIndex: physicalIdx,
            virtualColIndex: currentVirtualCol + s,
            text: "",
            isSpanPlaceholder: true,
          });
        }

        currentVirtualCol += span;
      }

      return {
        rowIndex,
        cells,
      };
    });

    return {
      index,
      rows,
    };
  });

  const tables: TableInfo[] = [];
  for (let t = 0; t < rawTables.length; t++) {
    const current = rawTables[t];
    if (tables.length === 0) {
      tables.push(current);
      continue;
    }
    const prev = tables[tables.length - 1];
    const prevHeader = prev.rows[0]?.cells.map((c) => c.text.trim()) ?? [];
    const currHeader = current.rows[0]?.cells.map((c) => c.text.trim()) ?? [];

    const isSameCols = prev.rows[0]?.cells.length === current.rows[0]?.cells.length;
    const isRepeatedHeader =
      isSameCols &&
      prevHeader.length > 0 &&
      currHeader.length > 0 &&
      prevHeader.join("|") === currHeader.join("|");

    if (isSameCols && isRepeatedHeader) {
      const dataRows = current.rows.slice(1);
      const startRowIdx = prev.rows.length;
      for (let r = 0; r < dataRows.length; r++) {
        prev.rows.push({
          rowIndex: startRowIdx + r,
          cells: dataRows[r].cells,
        });
      }
    } else {
      tables.push({
        ...current,
        index: tables.length,
      });
    }
  }
  let commentsCount: number | undefined;
  const commentsFile = zip.file("word/comments.xml");
  if (commentsFile) {
    try {
      const commentsXmlStr = sanitizeXmlString(await commentsFile.async("string"));
      const commentsDoc = parser.parseFromString(commentsXmlStr, "application/xml");
      const count = getAllElements(commentsDoc, "w:comment").length;
      if (count > 0) commentsCount = count;
    } catch {
      // Ignora caso word/comments.xml esteja malformado
    }
  }

  return {
    headers,
    footers,
    paragraphs,
    tables,
    ...(commentsCount !== undefined ? { commentsCount } : {}),
  };
}
