import { existsSync, readFileSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { extractPdfPages } from "./pdf.ts";
import {
  sanitizeTextForPdf,
  parseDocxBlocks,
  convertViaPureJs,
} from "./pdf/purejs_docx_renderer.ts";

export { sanitizeTextForPdf, parseDocxBlocks, convertViaPureJs };

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
// 2. Tier 1: Automação Silenciosa via MS Word COM (Windows ou WSL Interop)
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
// 3. Orquestrador Central Híbrido: convertDocxToPdf
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
    const extraction = await extractPdfPages(headerBuf, {
      skipPageInspection: true,
      skipImageExtraction: true,
      skipForensicMeta: true,
    });
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
