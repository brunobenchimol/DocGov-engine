import { gunzipSync } from "node:zlib";
import JSZip from "jszip";
import { basename } from "node:path";
import {
  type FileTypeDetectionResult,
  type ExtractedArchiveEntry,
  isTarBuffer,
  isZipBuffer,
  detectFileTypeSync,
} from "./archives/magic_detector.ts";

export * from "./archives/magic_detector.ts";

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
  return flattened.normalize("NFC");
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
