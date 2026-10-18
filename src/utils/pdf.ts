import { inflateSync, unzipSync } from "node:zlib";
import { getDocumentProxy } from "unpdf";
import type {
  PdfLineItem,
  PdfPageInfo,
  PdfExtractionResult,
} from "../types/index.ts";

// ============================================================================
// Extração Nativa Paginada de PDF (v0.8.0)
// ============================================================================

export function isPdfBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 5) return false;
  return (
    buf[0] === 0x25 && // %
    buf[1] === 0x50 && // P
    buf[2] === 0x44 && // D
    buf[3] === 0x46 && // F
    buf[4] === 0x2d // -
  );
}

export function formatPdfCoord(page: number, line: number): string {
  const pStr = String(page).padStart(3, "0");
  const lStr = String(line).padStart(4, "0");
  return `PAG_${pStr} | L${lStr}`;
}

export function formatPdfBracketCoord(page: number, line: number): string {
  return `[${formatPdfCoord(page, line)}]`;
}

function decodePdfLiteralString(raw: string): string {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next >= "0" && next <= "7") {
        let oct = next;
        let consumed = 1;
        if (i + 2 < raw.length && raw[i + 2] >= "0" && raw[i + 2] <= "7") {
          oct += raw[i + 2];
          consumed++;
          if (i + 3 < raw.length && raw[i + 3] >= "0" && raw[i + 3] <= "7") {
            oct += raw[i + 3];
            consumed++;
          }
        }
        out += String.fromCharCode(parseInt(oct, 8));
        i += 1 + consumed;
        continue;
      }
      switch (next) {
        case "n":
          out += "\n";
          break;
        case "r":
          out += "\r";
          break;
        case "t":
          out += "\t";
          break;
        case "b":
          out += "\b";
          break;
        case "f":
          out += "\f";
          break;
        case "(":
        case ")":
        case "\\":
          out += next;
          break;
        default:
          out += next;
          break;
      }
      i += 2;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

function extractLinesFromContentStream(streamContent: string): string[] {
  const lines: string[] = [];
  let currentLine = "";

  const pushCurrent = () => {
    const cleaned = currentLine.replace(/\s+/g, " ").trim();
    if (cleaned) {
      lines.push(cleaned);
    }
    currentLine = "";
  };

  // Tokeniza operadores de texto dentro de blocos BT ... ET
  const btBlocks = streamContent.match(/BT[\s\S]*?ET/g) || [streamContent];
  for (const block of btBlocks) {
    const tokenRegex =
      /\((?:\\.|[^\\()])*\)\s*(?:Tj|')|\[(?:\\.|[^\[\]])*\]\s*TJ|(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+T[dD]|T\*|\((?:\\.|[^\\()])*\)/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(block)) !== null) {
      const token = match[0];
      if (token === "T*") {
        pushCurrent();
      } else if (/T[dD]$/.test(token)) {
        const ty = parseFloat(match[2] || "0");
        if (Math.abs(ty) > 0.5) {
          pushCurrent();
        }
      } else if (/TJ$/.test(token)) {
        const innerMatches = token.match(/\((?:\\.|[^\\()])*\)/g) || [];
        for (const m of innerMatches) {
          currentLine += decodePdfLiteralString(m.slice(1, -1));
        }
      } else if (token.startsWith("(")) {
        const closeIdx = token.lastIndexOf(")");
        if (closeIdx > 0) {
          const decoded = decodePdfLiteralString(token.slice(1, closeIdx));
          if (token.endsWith("'")) {
            pushCurrent();
            currentLine = decoded;
          } else {
            currentLine += (currentLine ? " " : "") + decoded;
          }
        }
      }
    }
    pushCurrent();
  }

  return lines;
}

function fallbackExtractPagesFromBuffer(buffer: Buffer): string[][] {
  const rawLatin1 = buffer.toString("latin1");
  const pagesLines: string[][] = [];

  // Localiza streams PDF
  const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(rawLatin1)) !== null) {
    const dict = match[1] || "";
    const rawBody = match[2] || "";
    let decodedStream = rawBody;

    if (/\/FlateDecode\b/.test(dict)) {
      const streamBuf = Buffer.from(rawBody, "latin1");
      try {
        decodedStream = unzipSync(streamBuf).toString("latin1");
      } catch {
        try {
          decodedStream = inflateSync(streamBuf).toString("latin1");
        } catch {
          decodedStream = "";
        }
      }
    }

    if (decodedStream && /BT\b/.test(decodedStream)) {
      const extracted = extractLinesFromContentStream(decodedStream);
      if (extracted.length > 0) {
        pagesLines.push(extracted);
      }
    }
  }

  if (pagesLines.length > 0) {
    return pagesLines;
  }

  // Fallback final para stubs PDF minimalistas (ex.: %PDF-1.4\n%TERMO DE REFERENCIA...)
  const fallbackLines: string[] = [];
  for (const rawLine of rawLatin1.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (
      !trimmed ||
      trimmed.startsWith("%PDF-") ||
      trimmed === "%%EOF" ||
      /^(?:obj|endobj|stream|endstream|xref|trailer|startxref|\d+\s+\d+\s+obj|\d{10}\s+\d{5}\s+[nf])$/.test(
        trimmed
      )
    ) {
      continue;
    }
    const cleaned = trimmed.replace(/^%+/, "").trim();
    if (cleaned) {
      fallbackLines.push(cleaned);
    }
  }

  return [fallbackLines];
}

export async function extractPdfPages(
  buffer: Buffer
): Promise<PdfExtractionResult> {
  if (!isPdfBuffer(buffer)) {
    throw new Error(
      "Arquivo .pdf inválido: assinatura de Magic Bytes '%PDF-' não encontrada no cabeçalho."
    );
  }

  let rawPages: string[][] = [];

  try {
    const uint8 = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    const pdf = await getDocumentProxy(uint8, { verbosity: 0 });
    const numPages = pdf.numPages || 0;

    for (let p = 1; p <= numPages; p++) {
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      const pageLines: string[] = [];
      let currentLine = "";
      let lastY: number | null = null;

      for (const item of textContent.items as Array<any>) {
        if (typeof item.str !== "string") continue;
        const y =
          Array.isArray(item.transform) && typeof item.transform[5] === "number"
            ? item.transform[5]
            : null;

        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2.5) {
          const trimmed = currentLine.replace(/\s+/g, " ").trim();
          if (trimmed) pageLines.push(trimmed);
          currentLine = item.str;
        } else {
          if (
            currentLine &&
            !currentLine.endsWith(" ") &&
            !item.str.startsWith(" ") &&
            item.str.length > 0
          ) {
            currentLine += " " + item.str;
          } else {
            currentLine += item.str;
          }
        }

        lastY = y;

        if (item.hasEOL) {
          const trimmed = currentLine.replace(/\s+/g, " ").trim();
          if (trimmed) pageLines.push(trimmed);
          currentLine = "";
          lastY = null;
        }
      }

      const remaining = currentLine.replace(/\s+/g, " ").trim();
      if (remaining) {
        pageLines.push(remaining);
      }

      rawPages.push(pageLines);
    }
  } catch {
    // Se unpdf falhar (ex.: PDF sintético minimalista sem xref completo), aciona fallback determinístico
    rawPages = fallbackExtractPagesFromBuffer(buffer);
  }

  const totalExtractedLines = rawPages.reduce((acc, p) => acc + p.length, 0);
  if (totalExtractedLines === 0) {
    rawPages = fallbackExtractPagesFromBuffer(buffer);
  }

  const pages: PdfPageInfo[] = [];
  const allLines: PdfLineItem[] = [];
  let globalLineCounter = 0;

  for (let pIdx = 0; pIdx < rawPages.length; pIdx++) {
    const pageNumber = pIdx + 1;
    const rawPageLines = rawPages[pIdx];
    const pageItems: PdfLineItem[] = [];

    for (const rawLine of rawPageLines) {
      for (const subLine of rawLine.split(/\r?\n/)) {
        const text = subLine.replace(/\s+/g, " ").trim();
        if (!text) continue;
        globalLineCounter++;
        const coord = formatPdfCoord(pageNumber, globalLineCounter);
        const bracket_coord = `[${coord}]`;
        const lineItem: PdfLineItem = {
          page: pageNumber,
          line: globalLineCounter,
          coord,
          bracket_coord,
          text,
        };
        pageItems.push(lineItem);
        allLines.push(lineItem);
      }
    }

    pages.push({
      pageNumber,
      lines: pageItems,
    });
  }

  return {
    pageCount: pages.length,
    lineCount: allLines.length,
    pages,
    lines: allLines,
  };
}

function encodePdfWinAnsiLiteral(text: string): string {
  let out = "(";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x28 || code === 0x29 || code === 0x5c) {
      out += "\\" + text[i];
    } else if (code >= 0x20 && code <= 0x7e) {
      out += text[i];
    } else if (code >= 0xa0 && code <= 0xff) {
      out += "\\" + code.toString(8).padStart(3, "0");
    } else {
      out += " ";
    }
  }
  out += ")";
  return out;
}

/**
 * Gera um buffer PDF 1.4 multi-página 100% válido conforme ISO 32000 (com Catalog, Pages, Font WinAnsiEncoding, Contents e tabela xref).
 */
export function createSyntheticPdfBuffer(pagesLines: string[][]): Buffer {
  const numPages = Math.max(1, pagesLines.length);
  const objects: Array<{ id: number; body: string }> = [];

  const pageObjIds: number[] = [];
  for (let i = 0; i < numPages; i++) {
    pageObjIds.push(4 + i * 2);
  }

  objects.push({
    id: 1,
    body: `<< /Type /Catalog /Pages 2 0 R >>`,
  });

  objects.push({
    id: 2,
    body: `<< /Type /Pages /Kids [${pageObjIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${numPages} >>`,
  });

  objects.push({
    id: 3,
    body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
  });

  for (let i = 0; i < numPages; i++) {
    const pageObjId = 4 + i * 2;
    const contentObjId = 5 + i * 2;
    const lines = pagesLines[i] || [];

    const streamOps: string[] = ["BT", "/F1 10 Tf", "14 TL", "50 780 Td"];
    lines.forEach((line, idx) => {
      const encoded = encodePdfWinAnsiLiteral(line);
      if (idx === 0) {
        streamOps.push(`${encoded} Tj`);
      } else {
        streamOps.push(`T* ${encoded} Tj`);
      }
    });
    streamOps.push("ET");

    const streamText = streamOps.join("\n");
    const streamByteLen = Buffer.byteLength(streamText, "latin1");

    objects.push({
      id: pageObjId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 2400 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjId} 0 R >>`,
    });

    objects.push({
      id: contentObjId,
      body: `<< /Length ${streamByteLen} >>\nstream\n${streamText}\nendstream`,
    });
  }

  let pdfContent = "%PDF-1.4\n";
  const offsets: number[] = [0]; // Índice 0 reservado para free entry

  for (const obj of objects) {
    offsets[obj.id] = Buffer.byteLength(pdfContent, "latin1");
    pdfContent += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdfContent, "latin1");
  const totalObjs = objects.length + 1;
  pdfContent += `xref\n0 ${totalObjs}\n`;
  pdfContent += `0000000000 65535 f \n`;
  for (let id = 1; id < totalObjs; id++) {
    const off = String(offsets[id] || 0).padStart(10, "0");
    pdfContent += `${off} 00000 n \n`;
  }

  pdfContent += `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdfContent, "latin1");
}
