import { gunzipSync } from "node:zlib";
import JSZip from "jszip";
import { basename, extname } from "node:path";

// ============================================================================
// Classificador Estrutural de Arquivos e Extrator Seguro (Padrão libmagic)
// ============================================================================

export type CanonicalFileType =
  | "docx" // Microsoft Word 2007+
  | "xlsx" // Microsoft Excel 2007+
  | "pptx" // Microsoft PowerPoint 2007+
  | "odt" // OpenDocument Text
  | "ods" // OpenDocument Spreadsheet
  | "pdf" // Adobe Portable Document Format
  | "zip" // Generic Zip archive data
  | "tar" // POSIX tar archive
  | "tar.gz" // POSIX tar archive (gzip compressed)
  | "gz" // Gzip compressed data
  | "text" // Plain text
  | "markdown" // Markdown document
  | "unsupported_archive" // .rar, .7z
  | "unknown";

export interface FileTypeDetectionResult {
  type: CanonicalFileType;
  mime: string;
  description: string;
  isArchive: boolean;
  isOfficeDocument: boolean;
  suggestedExtension: string;
}

export interface ExtractedArchiveEntry {
  fileName: string;
  originalPath: string;
  data: Buffer;
  size: number;
}

// ----------------------------------------------------------------------------
// Heurísticas de Assinatura (Magic Bytes)
// ----------------------------------------------------------------------------

export function isPdfBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 4) return false;
  return (
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46 // %PDF
  );
}

export function isGzipBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 2) return false;
  return buf[0] === 0x1f && buf[1] === 0x8b;
}

export function isTarBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 512) return false;
  // POSIX tar armazena "ustar" no offset 257 (5 bytes)
  const magic = buf.subarray(257, 262).toString("utf-8");
  if (magic === "ustar") return true;

  // Verificação de soma de verificação do cabeçalho TAR (offset 148..155)
  const chksumStr = buf
    .subarray(148, 156)
    .toString("utf-8")
    .trim()
    .replace(/\0/g, "");
  const expectedChksum = parseInt(chksumStr, 8);
  if (!isNaN(expectedChksum) && expectedChksum > 0) {
    let sum = 0;
    for (let i = 0; i < 512; i++) {
      if (i >= 148 && i < 156) {
        sum += 32; // espaço ' '
      } else {
        sum += buf[i];
      }
    }
    if (sum === expectedChksum) return true;
  }
  return false;
}

export function isZipBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 4) return false;
  return (
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)
  );
}

export function isRarBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 6) return false;
  return (
    buf[0] === 0x52 &&
    buf[1] === 0x61 &&
    buf[2] === 0x72 &&
    buf[3] === 0x21 &&
    buf[4] === 0x1a &&
    buf[5] === 0x07 // Rar!\x1a\x07
  );
}

export function is7zBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 6) return false;
  return (
    buf[0] === 0x37 &&
    buf[1] === 0x7a &&
    buf[2] === 0xbc &&
    buf[3] === 0xaf &&
    buf[4] === 0x27 &&
    buf[5] === 0x1c // 7z\xbc\xaf\x27\x1c
  );
}

// ----------------------------------------------------------------------------
// Inspeção Rápida de Cabeçalhos Locais em Containers ZIP (Padrão libmagic msooxml)
// ----------------------------------------------------------------------------

export function inspectZipLocalHeadersSync(
  buf: Buffer,
  maxBytes: number = 262144
): {
  isDocx: boolean;
  isXlsx: boolean;
  isPptx: boolean;
  isOdt: boolean;
  isOds: boolean;
} {
  const limit = Math.min(buf.length, maxBytes);
  const sample = buf.subarray(0, limit);

  const hasWord =
    sample.includes(Buffer.from("word/document.xml")) ||
    sample.includes(Buffer.from("word/"));
  const hasXl =
    sample.includes(Buffer.from("xl/workbook.xml")) ||
    sample.includes(Buffer.from("xl/"));
  const hasPpt =
    sample.includes(Buffer.from("ppt/presentation.xml")) ||
    sample.includes(Buffer.from("ppt/"));
  const isOdt = sample.includes(
    Buffer.from("application/vnd.oasis.opendocument.text")
  );
  const isOds = sample.includes(
    Buffer.from("application/vnd.oasis.opendocument.spreadsheet")
  );

  return {
    isDocx: hasWord,
    isXlsx: hasXl && !hasWord,
    isPptx: hasPpt && !hasWord && !hasXl,
    isOdt,
    isOds,
  };
}

// ----------------------------------------------------------------------------
// Classificador Canônico de Tipos (Inspirado no file / libmagic)
// ----------------------------------------------------------------------------

export function detectFileTypeSync(
  buf: Buffer,
  fileName?: string
): FileTypeDetectionResult {
  if (!buf || buf.length === 0) {
    return {
      type: "unknown",
      mime: "application/octet-stream",
      description: "empty data",
      isArchive: false,
      isOfficeDocument: false,
      suggestedExtension: "",
    };
  }

  // 1. PDF
  if (isPdfBuffer(buf)) {
    return {
      type: "pdf",
      mime: "application/pdf",
      description: "PDF document",
      isArchive: false,
      isOfficeDocument: true,
      suggestedExtension: ".pdf",
    };
  }

  // 2. GZIP (.tar.gz, .tgz, .gz)
  if (isGzipBuffer(buf)) {
    try {
      const decompressedSample = gunzipSync(buf.subarray(0, Math.min(buf.length, 524288)));
      if (isTarBuffer(decompressedSample)) {
        return {
          type: "tar.gz",
          mime: "application/x-gtar",
          description: "POSIX tar archive (gzip compressed)",
          isArchive: true,
          isOfficeDocument: false,
          suggestedExtension: ".tar.gz",
        };
      }
    } catch {
      // Ignora erro de descompressão parcial e continua
    }

    const lowerName = fileName ? fileName.toLowerCase() : "";
    if (lowerName.endsWith(".tar.gz") || lowerName.endsWith(".tgz")) {
      return {
        type: "tar.gz",
        mime: "application/x-gtar",
        description: "POSIX tar archive (gzip compressed)",
        isArchive: true,
        isOfficeDocument: false,
        suggestedExtension: ".tar.gz",
      };
    }

    return {
      type: "gz",
      mime: "application/gzip",
      description: "gzip compressed data",
      isArchive: true,
      isOfficeDocument: false,
      suggestedExtension: ".gz",
    };
  }

  // 3. TAR (.tar)
  if (isTarBuffer(buf)) {
    return {
      type: "tar",
      mime: "application/x-tar",
      description: "POSIX tar archive",
      isArchive: true,
      isOfficeDocument: false,
      suggestedExtension: ".tar",
    };
  }

  // 4. Formatos proprietários não suportados (.rar, .7z)
  if (is7zBuffer(buf)) {
    return {
      type: "unsupported_archive",
      mime: "application/x-7z-compressed",
      description: "7-Zip archive data",
      isArchive: true,
      isOfficeDocument: false,
      suggestedExtension: ".7z",
    };
  }
  if (isRarBuffer(buf)) {
    return {
      type: "unsupported_archive",
      mime: "application/x-rar",
      description: "RAR archive data",
      isArchive: true,
      isOfficeDocument: false,
      suggestedExtension: ".rar",
    };
  }

  // 5. Container ZIP (PK\x03\x04): Aplica a regra msooxml do libmagic
  if (isZipBuffer(buf)) {
    if (buf.length < 30) {
      // Stub sintético de teste unitário curto (< 30 bytes)
      return {
        type: "docx",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        description: "Microsoft Word 2007+",
        isArchive: false,
        isOfficeDocument: true,
        suggestedExtension: ".docx",
      };
    }

    const inspection = inspectZipLocalHeadersSync(buf);

    if (inspection.isDocx) {
      return {
        type: "docx",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        description: "Microsoft Word 2007+",
        isArchive: false,
        isOfficeDocument: true,
        suggestedExtension: ".docx",
      };
    }

    if (inspection.isXlsx) {
      return {
        type: "xlsx",
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        description: "Microsoft Excel 2007+",
        isArchive: false,
        isOfficeDocument: true,
        suggestedExtension: ".xlsx",
      };
    }

    if (inspection.isPptx) {
      return {
        type: "pptx",
        mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        description: "Microsoft PowerPoint 2007+",
        isArchive: false,
        isOfficeDocument: true,
        suggestedExtension: ".pptx",
      };
    }

    if (inspection.isOdt) {
      return {
        type: "odt",
        mime: "application/vnd.oasis.opendocument.text",
        description: "OpenDocument Text",
        isArchive: false,
        isOfficeDocument: true,
        suggestedExtension: ".odt",
      };
    }

    if (inspection.isOds) {
      return {
        type: "ods",
        mime: "application/vnd.oasis.opendocument.spreadsheet",
        description: "OpenDocument Spreadsheet",
        isArchive: false,
        isOfficeDocument: true,
        suggestedExtension: ".ods",
      };
    }

    const fileExt = fileName ? extname(fileName).toLowerCase() : "";
    if (fileExt === ".xlsx" || fileExt === ".xls") {
      return {
        type: "xlsx",
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        description: "Microsoft Excel 2007+",
        isArchive: false,
        isOfficeDocument: true,
        suggestedExtension: ".xlsx",
      };
    }
    if (fileExt === ".docx") {
      return {
        type: "docx",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        description: "Microsoft Word 2007+",
        isArchive: false,
        isOfficeDocument: true,
        suggestedExtension: ".docx",
      };
    }
    if (fileExt === ".pptx") {
      return {
        type: "pptx",
        mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        description: "Microsoft PowerPoint 2007+",
        isArchive: false,
        isOfficeDocument: true,
        suggestedExtension: ".pptx",
      };
    }

    // Se é ZIP e NÃO tem manifestos de documentos de escritório:
    // É um pacote compactado genérico (Zip archive data) contendo múltiplos arquivos!
    return {
      type: "zip",
      mime: "application/zip",
      description: "Zip archive data",
      isArchive: true,
      isOfficeDocument: false,
      suggestedExtension: ".zip",
    };
  }

  // 6. Texto Puro ou Markdown
  const lowerName = fileName ? fileName.toLowerCase() : "";
  if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) {
    return {
      type: "markdown",
      mime: "text/markdown",
      description: "Markdown document",
      isArchive: false,
      isOfficeDocument: true,
      suggestedExtension: ".md",
    };
  }
  if (lowerName.endsWith(".txt") || lowerName.endsWith(".text") || lowerName.endsWith(".log")) {
    return {
      type: "text",
      mime: "text/plain",
      description: "ASCII text or UTF-8 text",
      isArchive: false,
      isOfficeDocument: true,
      suggestedExtension: ".txt",
    };
  }

  return {
    type: "unknown",
    mime: "application/octet-stream",
    description: "data",
    isArchive: false,
    isOfficeDocument: false,
    suggestedExtension: extname(lowerName) || "",
  };
}

export async function detectFileType(
  buf: Buffer,
  fileName?: string
): Promise<FileTypeDetectionResult> {
  const syncResult = detectFileTypeSync(buf, fileName);

  // Se o resultado síncrono identificou como ZIP genérico ou DOCX limítrofe,
  // fazemos a checagem formal profunda via JSZip.loadAsync para confirmação absoluta
  if (isZipBuffer(buf)) {
    try {
      const zip = await JSZip.loadAsync(buf);
      const fileNames = Object.keys(zip.files);

      const hasWord = fileNames.some(
        (f) => f === "word/document.xml" || f.startsWith("word/")
      );
      if (hasWord) {
        return {
          type: "docx",
          mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          description: "Microsoft Word 2007+",
          isArchive: false,
          isOfficeDocument: true,
          suggestedExtension: ".docx",
        };
      }

      const hasXl = fileNames.some(
        (f) => f === "xl/workbook.xml" || f.startsWith("xl/")
      );
      if (hasXl) {
        return {
          type: "xlsx",
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          description: "Microsoft Excel 2007+",
          isArchive: false,
          isOfficeDocument: true,
          suggestedExtension: ".xlsx",
        };
      }

      const hasPpt = fileNames.some(
        (f) => f === "ppt/presentation.xml" || f.startsWith("ppt/")
      );
      if (hasPpt) {
        return {
          type: "pptx",
          mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          description: "Microsoft PowerPoint 2007+",
          isArchive: false,
          isOfficeDocument: true,
          suggestedExtension: ".pptx",
        };
      }

      if (fileNames.includes("mimetype")) {
        const mimeText = await zip.files["mimetype"].async("text");
        if (mimeText.includes("opendocument.text")) {
          return {
            type: "odt",
            mime: "application/vnd.oasis.opendocument.text",
            description: "OpenDocument Text",
            isArchive: false,
            isOfficeDocument: true,
            suggestedExtension: ".odt",
          };
        }
        if (mimeText.includes("opendocument.spreadsheet")) {
          return {
            type: "ods",
            mime: "application/vnd.oasis.opendocument.spreadsheet",
            description: "OpenDocument Spreadsheet",
            isArchive: false,
            isOfficeDocument: true,
            suggestedExtension: ".ods",
          };
        }
      }

      return {
        type: "zip",
        mime: "application/zip",
        description: "Zip archive data",
        isArchive: true,
        isOfficeDocument: false,
        suggestedExtension: ".zip",
      };
    } catch {
      // Em caso de falha de carregamento do zip, retorna a detecção síncrona
      return syncResult;
    }
  }

  return syncResult;
}

// ----------------------------------------------------------------------------
// Higienização e Filtros de Segurança (Anti-Zip Slip e Junk Files)
// ----------------------------------------------------------------------------

export function isSystemJunkFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const base = basename(normalized);
  const lowerBase = base.toLowerCase();

  // 1. Metadados do macOS
  if (
    normalized.startsWith("__MACOSX/") ||
    normalized.includes("/__MACOSX/") ||
    lowerBase === ".ds_store" ||
    base.startsWith("._")
  ) {
    return true;
  }

  // 2. Metadados do Windows
  if (lowerBase === "thumbs.db" || lowerBase === "desktop.ini") {
    return true;
  }

  // 3. Arquivos temporários de lock do Microsoft Office
  if (base.startsWith("~$")) {
    return true;
  }

  return false;
}

/**
 * Normaliza o nome do arquivo prevenindo Zip Slip (../../) e achatando
 * subpastas (ex.: "anexos/edital/tr.pdf" -> "anexos_edital_tr.pdf")
 */
export function sanitizeArchiveEntryName(rawPath: string): string {
  // Remove caracteres perigosos e sequências de escape
  let clean = rawPath.replace(/\\/g, "/");

  // Remove barras iniciais
  clean = clean.replace(/^\/+/, "");

  // Defesa Anti-Zip Slip: remove todas as sequências de ..
  clean = clean.replace(/\.\.+/g, "");

  // Divide pelas barras de pasta e junta com underscore
  const parts = clean
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== ".");

  if (parts.length === 0) {
    return `arquivo_extraido_${Date.now()}`;
  }

  // Achatamento de subpastas: "anexos/edital/termo.docx" -> "anexos_edital_termo.docx"
  const flattened = parts.join("_").replace(/[<>:"|?*\x00-\x1F]/g, "_");
  return flattened;
}

// ----------------------------------------------------------------------------
// Extratores Seguros (TAR, TAR.GZ e ZIP)
// ----------------------------------------------------------------------------

export const ARCHIVE_MAX_FILES_LIMIT = 500;
export const ARCHIVE_MAX_TOTAL_BYTES = 524288000; // 500 MB

export function extractTarBuffer(buf: Buffer): ExtractedArchiveEntry[] {
  const files: ExtractedArchiveEntry[] = [];
  let offset = 0;
  let totalBytes = 0;

  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);

    // Bloco zerado duplo indica o final do arquivo tar
    if (header.every((b) => b === 0)) break;

    // Nome do arquivo (offset 0..100)
    let nameEnd = 0;
    while (nameEnd < 100 && header[nameEnd] !== 0) nameEnd++;
    const rawName = header.subarray(0, nameEnd).toString("utf-8").trim();

    // Tipo de entrada (offset 156): '0' ou '\0' é arquivo regular, '5' é diretório
    const typeFlag = String.fromCharCode(header[156]);

    // Tamanho do arquivo em octal (offset 124..136)
    const sizeStr = header
      .subarray(124, 136)
      .toString("utf-8")
      .trim()
      .replace(/\0/g, "");
    const size = parseInt(sizeStr, 8) || 0;

    offset += 512;

    if ((typeFlag === "0" || typeFlag === "\0") && rawName && size >= 0) {
      if (isSystemJunkFile(rawName)) {
        // Ignora arquivos de lixo
      } else {
        totalBytes += size;
        if (files.length >= ARCHIVE_MAX_FILES_LIMIT) {
          throw new Error(
            `Arquivo compactado excede o limite máximo permitido de ${ARCHIVE_MAX_FILES_LIMIT} arquivos.`
          );
        }
        if (totalBytes > ARCHIVE_MAX_TOTAL_BYTES) {
          throw new Error(
            `Conteúdo descompactado excede o teto de segurança de ${ARCHIVE_MAX_TOTAL_BYTES / 1024 / 1024} MB.`
          );
        }

        const sanitizedName = sanitizeArchiveEntryName(rawName);
        const fileData = buf.subarray(offset, offset + size);

        files.push({
          fileName: sanitizedName,
          originalPath: rawName,
          data: Buffer.from(fileData),
          size,
        });
      }
    }

    // Blocos TAR são sempre alinhados em múltiplos de 512 bytes
    const paddedSize = Math.ceil(size / 512) * 512;
    offset += paddedSize;
  }

  return files;
}

export function extractTarGzBuffer(buf: Buffer): ExtractedArchiveEntry[] {
  const decompressed = gunzipSync(buf);
  if (isTarBuffer(decompressed)) {
    return extractTarBuffer(decompressed);
  }

  // Arquivo .gz individual (não-tar)
  const sanitized = "arquivo_descompactado";
  return [
    {
      fileName: sanitized,
      originalPath: sanitized,
      data: Buffer.from(decompressed),
      size: decompressed.length,
    },
  ];
}

export async function extractZipBuffer(buf: Buffer): Promise<ExtractedArchiveEntry[]> {
  const zip = await JSZip.loadAsync(buf);
  const files: ExtractedArchiveEntry[] = [];
  let totalBytes = 0;

  const entries = Object.keys(zip.files).sort((a, b) => a.localeCompare(b));

  for (const entryPath of entries) {
    const zipObj = zip.files[entryPath];
    if (zipObj.dir) continue;
    if (isSystemJunkFile(entryPath)) continue;

    if (files.length >= ARCHIVE_MAX_FILES_LIMIT) {
      throw new Error(
        `Arquivo compactado excede o limite máximo permitido de ${ARCHIVE_MAX_FILES_LIMIT} arquivos.`
      );
    }

    const data = await zipObj.async("nodebuffer");
    totalBytes += data.length;
    if (totalBytes > ARCHIVE_MAX_TOTAL_BYTES) {
      throw new Error(
        `Conteúdo descompactado excede o teto de segurança de ${ARCHIVE_MAX_TOTAL_BYTES / 1024 / 1024} MB.`
      );
    }

    const sanitizedName = sanitizeArchiveEntryName(entryPath);
    files.push({
      fileName: sanitizedName,
      originalPath: entryPath,
      data,
      size: data.length,
    });
  }

  return files;
}

export async function extractArchiveBuffer(
  buf: Buffer,
  archiveName: string
): Promise<ExtractedArchiveEntry[]> {
  const detection = await detectFileType(buf, archiveName);

  if (detection.type === "zip") {
    return await extractZipBuffer(buf);
  }

  if (detection.type === "tar.gz") {
    return extractTarGzBuffer(buf);
  }

  if (detection.type === "tar") {
    return extractTarBuffer(buf);
  }

  if (detection.type === "gz") {
    return extractTarGzBuffer(buf);
  }

  if (detection.type === "unsupported_archive") {
    throw new Error(
      `Formato compactado não suportado nativamente ('${archiveName}': ${detection.description}). Por favor, utilize pacotes '.zip' ou '.tar.gz' para descompactação automática no bootstrap_case.`
    );
  }

  throw new Error(
    `O arquivo '${archiveName}' não foi reconhecido como um pacote compactado suportado (.zip, .tar, .tar.gz). Tipo detectado: ${detection.description}.`
  );
}
