import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { extractPdfPages } from "./pdf.ts";
import { sanitizeXmlString } from "./xml.ts";

// ============================================================================
// 1. Tipos e Contratos do Pipeline Híbrido de Exportação PDF (v0.9.5 / v0.9.6)
// ============================================================================

export type PdfExportTier = "word" | "purejs";

export interface ResolvedOutputPaths {
  docxPath: string;
  pdfPath?: string;
  tempDocxPath?: string;
  primaryOutputPath: string;
  isExclusivePdf: boolean;
}

/**
 * Resolução Canônica de Caminhos de Saída (CORR-04 / v0.9.6):
 * Remove extensões .docx/.pdf duplicadas e, em modo exclusivo PDF ('pdf'),
 * direciona o DOCX intermediário para um arquivo temporário único a ser
 * deletado após a compilação, prevenindo sobrescrita ZIP e resíduos em disco.
 */
export function resolveOutputPaths(
  rawOutPath: string,
  format: "docx" | "pdf" | "both" = "docx"
): ResolvedOutputPaths {
  const resolved = resolve(rawOutPath);
  const dir = dirname(resolved);
  const rawName = basename(resolved);
  const baseStem = rawName.replace(/\.(docx|pdf)$/i, "");
  const basePath = resolve(dir, baseStem);

  if (format === "pdf") {
    const pdfPath = `${basePath}.pdf`;
    const tempDocxPath = `${basePath}.__tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.docx`;
    return {
      docxPath: tempDocxPath,
      tempDocxPath,
      pdfPath,
      primaryOutputPath: pdfPath,
      isExclusivePdf: true,
    };
  } else if (format === "both") {
    const docxPath = `${basePath}.docx`;
    const pdfPath = `${basePath}.pdf`;
    return {
      docxPath,
      pdfPath,
      primaryOutputPath: docxPath,
      isExclusivePdf: false,
    };
  } else {
    const docxPath = `${basePath}.docx`;
    return {
      docxPath,
      primaryOutputPath: docxPath,
      isExclusivePdf: false,
    };
  }
}

/**
 * Remoção Assíncrona Resiliente de Arquivo (CORR-05 / v0.9.6):
 * Tolera eventuais file locks temporários do SO/antivírus através de retry com backoff.
 */
export async function safeUnlink(
  filePath?: string,
  retries: number = 4,
  delayMs: number = 100
): Promise<void> {
  if (!filePath) return;
  for (let i = 0; i < retries; i++) {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      return;
    } catch {
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}

/**
 * Remoção Síncrona Resiliente de Arquivo (CORR-05 / v0.9.6).
 */
export function safeUnlinkSync(
  filePath?: string,
  retries: number = 3,
  delayMs: number = 100
): void {
  if (!filePath) return;
  for (let i = 0; i < retries; i++) {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      return;
    } catch {
      if (i < retries - 1) {
        try {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
        } catch {
          // SharedArrayBuffer indisponível em runtime limitado
        }
      }
    }
  }
}

export interface ConvertDocxToPdfOptions {
  timeoutMs?: number;
  forceTier?: PdfExportTier;
  keepDocx?: boolean;
}

export interface ConvertDocxToPdfResult {
  success: boolean;
  pdfPath: string;
  tierUsed: PdfExportTier;
  byteLength: number;
  pageCount: number;
  warning?: string;
}

// ============================================================================
// 2. Sanitizador de Caracteres para Fontes Padrão WinAnsi (pdf-lib)
// ============================================================================

export function sanitizeTextForPdf(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/•/g, "*")
    .replace(/…/g, "...")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\x00-\xFF]/g, (char) => {
      const decomposed = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return /^[\x00-\xFF]$/.test(decomposed) ? decomposed : "";
    });
}

// ============================================================================
// 3. Tier 1: Automação Silenciosa via MS Word COM (Windows ou WSL Interop)
// ============================================================================

function isWindowsOrWsl(): { isWindows: boolean; isWsl: boolean } {
  if (process.platform === "win32") {
    return { isWindows: true, isWsl: false };
  }
  if (process.platform === "linux") {
    try {
      const version = readFileSync("/proc/version", "utf-8").toLowerCase();
      if (version.includes("microsoft") || version.includes("wsl")) {
        return { isWindows: false, isWsl: true };
      }
    } catch {
      // ignora
    }
  }
  return { isWindows: false, isWsl: false };
}

export function convertViaWordCom(
  docxPath: string,
  pdfPath: string,
  timeoutMs: number = 30000
): boolean {
  const { isWindows, isWsl } = isWindowsOrWsl();
  if (!isWindows && !isWsl) {
    return false;
  }

  let winDocx = docxPath;
  let winPdf = pdfPath;

  if (isWsl) {
    try {
      winDocx = execFileSync("wslpath", ["-w", docxPath], {
        encoding: "utf-8",
      }).trim();
      winPdf = execFileSync("wslpath", ["-w", pdfPath], {
        encoding: "utf-8",
      }).trim();
    } catch {
      return false;
    }
  }

  const escapedDocx = winDocx.replace(/'/g, "''");
  const escapedPdf = winPdf.replace(/'/g, "''");

  const psScript = `
$ErrorActionPreference = 'Stop'
$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = $word.Documents.Open('${escapedDocx}')
  try {
    $doc.SaveAs2('${escapedPdf}', 17) # 17 = wdFormatPDF
  } finally {
    if ($doc -ne $null) {
      $doc.Close([ref]0) # 0 = wdDoNotSaveChanges
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
      $doc = $null
    }
  }
} finally {
  if ($word -ne $null) {
    $word.Quit([ref]0)
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    $word = $null
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
`.trim();

  try {
    const cmd = isWindows ? "powershell" : "powershell.exe";
    const res = spawnSync(
      cmd,
      ["-NoProfile", "-NonInteractive", "-Command", psScript],
      {
        timeout: timeoutMs,
        encoding: "utf-8",
        windowsHide: true,
      }
    );

    if (res.status === 0 && existsSync(pdfPath)) {
      const header = Buffer.alloc(5);
      const fd = readFileSync(pdfPath);
      if (fd.subarray(0, 5).toString("utf-8") === "%PDF-") {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ============================================================================
// 4. Tier 2: Renderizador Vetorial Standalone Pure-JS (pdf-lib + OpenXML DOM)
// ============================================================================

interface ParsedRun {
  text: string;
  bold: boolean;
  italic: boolean;
  fontSize: number;
}

interface ParsedParagraph {
  type: "paragraph";
  isHeading: boolean;
  runs: ParsedRun[];
  fullText: string;
}

interface ParsedTable {
  type: "table";
  rows: string[][];
}

type ParsedBlock = ParsedParagraph | ParsedTable;

export async function parseDocxBlocks(docxBuffer: Buffer): Promise<ParsedBlock[]> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("Arquivo DOCX inválido: 'word/document.xml' não encontrado.");
  }

  const xmlText = sanitizeXmlString(await docFile.async("string"));
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const body = doc.getElementsByTagName("w:body")[0];
  if (!body) return [];

  const blocks: ParsedBlock[] = [];
  const childNodes = body.childNodes;

  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i] as any;
    if (node.nodeType !== 1) continue;
    const tagName = node.tagName || node.nodeName;

    if (tagName === "w:p") {
      const pPr = node.getElementsByTagName("w:pPr")[0];
      let isHeading = false;
      if (pPr) {
        const pStyle = pPr.getElementsByTagName("w:pStyle")[0];
        const val = pStyle?.getAttribute("w:val") || "";
        if (/heading|titulo|header/i.test(val)) {
          isHeading = true;
        }
      }

      const runs: ParsedRun[] = [];
      const rNodes = node.getElementsByTagName("w:r");
      let pText = "";

      for (let r = 0; r < rNodes.length; r++) {
        const rNode = rNodes[r];
        const rPr = rNode.getElementsByTagName("w:rPr")[0];
        const boldNode = rPr?.getElementsByTagName("w:b")[0];
        const boldVal = boldNode?.getAttribute("w:val");
        const bold = Boolean(boldNode && boldVal !== "0" && boldVal !== "false");

        const italicNode = rPr?.getElementsByTagName("w:i")[0];
        const italic = Boolean(italicNode);

        const szNode = rPr?.getElementsByTagName("w:sz")[0];
        const szVal = szNode ? parseInt(szNode.getAttribute("w:val") || "21", 10) : 21;
        const fontSize = isHeading ? 14 : Math.max(9, Math.min(18, Math.round(szVal / 2)));

        let runText = "";
        const tNodes = rNode.getElementsByTagName("w:t");
        for (let t = 0; t < tNodes.length; t++) {
          runText += tNodes[t].textContent || "";
        }

        if (runText) {
          const clean = sanitizeTextForPdf(runText);
          if (clean) {
            runs.push({ text: clean, bold, italic, fontSize });
            pText += clean;
          }
        }
      }

      if (runs.length > 0 || isHeading) {
        blocks.push({
          type: "paragraph",
          isHeading,
          runs,
          fullText: pText,
        });
      }
    } else if (tagName === "w:tbl") {
      const rows: string[][] = [];
      const trNodes = node.getElementsByTagName("w:tr");

      for (let r = 0; r < trNodes.length; r++) {
        const trNode = trNodes[r];
        const rowCells: string[] = [];
        const tcNodes = trNode.getElementsByTagName("w:tc");

        for (let c = 0; c < tcNodes.length; c++) {
          const tcNode = tcNodes[c];
          let cellText = "";
          const tNodes = tcNode.getElementsByTagName("w:t");
          for (let t = 0; t < tNodes.length; t++) {
            cellText += (tNodes[t].textContent || "") + " ";
          }
          rowCells.push(sanitizeTextForPdf(cellText.trim()));
        }

        if (rowCells.some((c) => c.length > 0)) {
          rows.push(rowCells);
        }
      }

      if (rows.length > 0) {
        blocks.push({
          type: "table",
          rows,
        });
      }
    }
  }

  return blocks;
}

export async function convertViaPureJs(
  docxPath: string,
  pdfPath: string
): Promise<boolean> {
  const docxBuffer = readFileSync(docxPath);
  const blocks = await parseDocxBlocks(docxBuffer);

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 50;
  const marginY = 50;
  const usableWidth = pageWidth - marginX * 2;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - marginY;

  function ensureVerticalSpace(requiredHeight: number): void {
    if (currentY - requiredHeight < marginY) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - marginY;
    }
  }

  for (const block of blocks) {
    if (block.type === "paragraph") {
      const isHeading = block.isHeading;
      const baseFontSize = isHeading ? 13 : 10;
      const lineHeight = isHeading ? 18 : 14;

      // Se for heading, quebra espaço antes
      if (isHeading) {
        ensureVerticalSpace(lineHeight * 2);
        currentY -= 6;
      }

      // Constrói palavras com formatação
      interface FormattedWord {
        text: string;
        bold: boolean;
        fontSize: number;
        width: number;
      }

      const words: FormattedWord[] = [];
      for (const run of block.runs) {
        const font = run.bold || isHeading ? fontBold : fontRegular;
        const runFontSize = isHeading ? 13 : run.fontSize || baseFontSize;
        const rawWords = run.text.split(" ").filter((w) => w.length > 0);

        for (const w of rawWords) {
          const wordWidth = font.widthOfTextAtSize(w + " ", runFontSize);
          words.push({
            text: w,
            bold: run.bold || isHeading,
            fontSize: runFontSize,
            width: wordWidth,
          });
        }
      }

      if (words.length === 0) {
        currentY -= lineHeight * 0.6;
        continue;
      }

      // Quebra de palavras em linhas respeitando usableWidth
      const lines: FormattedWord[][] = [];
      let currentLine: FormattedWord[] = [];
      let currentLineWidth = 0;

      for (const word of words) {
        if (currentLineWidth + word.width > usableWidth && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = [word];
          currentLineWidth = word.width;
        } else {
          currentLine.push(word);
          currentLineWidth += word.width;
        }
      }
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }

      // Renderiza as linhas
      for (const line of lines) {
        ensureVerticalSpace(lineHeight);
        let cursorX = marginX;

        for (const w of line) {
          const font = w.bold ? fontBold : fontRegular;
          currentPage.drawText(w.text, {
            x: cursorX,
            y: currentY - w.fontSize,
            size: w.fontSize,
            font,
            color: isHeading ? rgb(0.1, 0.15, 0.3) : rgb(0.15, 0.15, 0.15),
          });
          cursorX += w.width;
        }

        currentY -= lineHeight;
      }

      currentY -= 4; // espaçamento pós-parágrafo
    } else if (block.type === "table") {
      const rows = block.rows;
      if (rows.length === 0) continue;

      const numCols = Math.max(...rows.map((r) => r.length), 1);
      const colWidth = usableWidth / numCols;
      const cellPadding = 5;
      const cellFontSize = 8.5;
      const cellLineHeight = 11;

      ensureVerticalSpace(20);
      currentY -= 6;

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        const isHeader = rIdx === 0;
        const font = isHeader ? fontBold : fontRegular;

        // Calcula altura necessária para a linha com quebra de células
        let maxLinesInRow = 1;
        const cellWrappedLines: string[][] = [];

        for (let cIdx = 0; cIdx < numCols; cIdx++) {
          const cellContent = row[cIdx] || "";
          const rawWords = cellContent.split(" ").filter((w) => w.length > 0);
          const cellLines: string[] = [];
          let currentCellLine = "";

          for (const w of rawWords) {
            const testLine = currentCellLine ? `${currentCellLine} ${w}` : w;
            const testWidth = font.widthOfTextAtSize(testLine, cellFontSize);
            if (testWidth > colWidth - cellPadding * 2 && currentCellLine) {
              cellLines.push(currentCellLine);
              currentCellLine = w;
            } else {
              currentCellLine = testLine;
            }
          }
          if (currentCellLine) {
            cellLines.push(currentCellLine);
          }
          if (cellLines.length === 0) cellLines.push("");

          cellWrappedLines.push(cellLines);
          if (cellLines.length > maxLinesInRow) {
            maxLinesInRow = cellLines.length;
          }
        }

        const rowHeight = maxLinesInRow * cellLineHeight + cellPadding * 2;
        ensureVerticalSpace(rowHeight);

        // Fundo do cabeçalho
        if (isHeader) {
          currentPage.drawRectangle({
            x: marginX,
            y: currentY - rowHeight,
            width: usableWidth,
            height: rowHeight,
            color: rgb(0.93, 0.94, 0.96),
          });
        }

        // Desenha textos de cada célula
        for (let cIdx = 0; cIdx < numCols; cIdx++) {
          const cellLines = cellWrappedLines[cIdx] || [];
          const cellX = marginX + cIdx * colWidth + cellPadding;
          let cellY = currentY - cellPadding - cellFontSize;

          for (const lineText of cellLines) {
            currentPage.drawText(lineText, {
              x: cellX,
              y: cellY,
              size: cellFontSize,
              font,
              color: isHeader ? rgb(0.1, 0.15, 0.3) : rgb(0.2, 0.2, 0.2),
            });
            cellY -= cellLineHeight;
          }
        }

        // Borda horizontal inferior da linha
        currentPage.drawLine({
          start: { x: marginX, y: currentY - rowHeight },
          end: { x: marginX + usableWidth, y: currentY - rowHeight },
          thickness: isHeader ? 1.0 : 0.5,
          color: isHeader ? rgb(0.6, 0.65, 0.7) : rgb(0.8, 0.8, 0.8),
        });

        currentY -= rowHeight;
      }

      currentY -= 8; // espaçamento pós-tabela
    }
  }

  const pdfBytes = await pdfDoc.save();
  const outDir = dirname(pdfPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  writeFileSync(pdfPath, Buffer.from(pdfBytes));

  return existsSync(pdfPath) && statSync(pdfPath).size > 0;
}

// ============================================================================
// 5. Orquestrador Central Híbrido: convertDocxToPdf
// ============================================================================

export async function convertDocxToPdf(
  docxPath: string,
  pdfPath?: string,
  options?: ConvertDocxToPdfOptions
): Promise<ConvertDocxToPdfResult> {
  const resolvedDocx = resolve(docxPath);
  if (!existsSync(resolvedDocx)) {
    throw new Error(`Arquivo .docx de origem não encontrado: ${resolvedDocx}`);
  }

  const resolvedPdf = pdfPath
    ? resolve(pdfPath.replace(/\.pdf\.pdf$/i, ".pdf"))
    : resolve(
        dirname(resolvedDocx),
        `${basename(resolvedDocx).replace(/\.(docx|pdf)$/i, "")}.pdf`
      );

  const outDir = dirname(resolvedPdf);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const forceTier = options?.forceTier;
  let tierUsed: PdfExportTier = "purejs";
  let converted = false;
  let warning: string | undefined;

  // Cenário 1: Forçado para Pure-JS
  if (forceTier === "purejs") {
    converted = await convertViaPureJs(resolvedDocx, resolvedPdf);
    tierUsed = "purejs";
  } else if (forceTier === "word") {
    // Cenário 2: Forçado para Word COM
    converted = convertViaWordCom(resolvedDocx, resolvedPdf, options?.timeoutMs);
    tierUsed = "word";
    if (!converted) {
      throw new Error(
        `Falha na conversão via MS Word COM (forceTier='word'): certifique-se de que o Microsoft Word está instalado e acessível.`
      );
    }
  } else {
    // Cenário 3: Modo Híbrido Automático (Word COM -> Pure-JS Fallback)
    const wordSuccess = convertViaWordCom(
      resolvedDocx,
      resolvedPdf,
      options?.timeoutMs || 25000
    );

    if (wordSuccess) {
      converted = true;
      tierUsed = "word";
    } else {
      converted = await convertViaPureJs(resolvedDocx, resolvedPdf);
      tierUsed = "purejs";
      warning =
        "MS Word COM não disponível ou sem suporte neste ambiente; PDF gerado com sucesso via Pure-JS Standalone Fallback.";
    }
  }

  if (!converted || !existsSync(resolvedPdf)) {
    throw new Error(`Falha crítica na exportação de PDF para: ${resolvedPdf}`);
  }

  // Sanity check de Magic Bytes
  const headerBuf = readFileSync(resolvedPdf, { flag: "r" });
  if (headerBuf.subarray(0, 5).toString("utf-8") !== "%PDF-") {
    throw new Error(
      `Arquivo gerado em ${resolvedPdf} não possui cabeçalho válido (%PDF-).`
    );
  }

  // Extrai contagem real de páginas via leitor do motor
  let pageCount = 1;
  try {
    const extraction = await extractPdfPages(headerBuf);
    pageCount = extraction.pageCount;
  } catch {
    pageCount = 1;
  }

  const byteLength = statSync(resolvedPdf).size;

  return {
    success: true,
    pdfPath: resolvedPdf,
    tierUsed,
    byteLength,
    pageCount,
    ...(warning ? { warning } : {}),
  };
}
