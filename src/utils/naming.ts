import { basename, extname } from "node:path";
import JSZip from "jszip";

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
    /\b(ORGAO_[A-Z0-9]+|SECRETARIA_[A-Z0-9]+|DEPARTAMENTO_[A-Z0-9]+|ENTIDADE_[A-Z0-9]+)\b/
  );
  if (organMatch) {
    organ = organMatch[1];
  } else if (
    text.includes("ADVOCACIA GERAL DA UNIAO") ||
    matchesWord(text, "AGU")
  ) {
    organ = "AGU";
  } else if (
    text.includes("MINISTERIO DA GESTAO") ||
    matchesWord(text, "MGI")
  ) {
    organ = "MGI";
  } else if (
    text.includes("TRIBUNAL DE CONTAS DA UNIAO") ||
    matchesWord(text, "TCU")
  ) {
    organ = "TCU";
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

