import { inflateSync, unzipSync } from "node:zlib";

// ============================================================================
// Pipeline OCR Headless para PDFs Escaneados — Marco 5.3
// ============================================================================

/**
 * Extrai texto embutido ou camadas de OCR ocultas de streams PDF.
 * Funciona 100% standalone e offline dentro do binário Bun (sem dependências de SO).
 */
export async function executeHeadlessOcr(
  pdfBuffer: Buffer,
  scannedPages: number[]
): Promise<Map<number, string[]>> {
  const results = new Map<number, string[]>();
  if (!scannedPages || scannedPages.length === 0) {
    return results;
  }

  const rawLatin1 = pdfBuffer.toString("latin1");

  // 1. Procura por streams de texto ou OCR embutido nos objetos do PDF
  const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  const decodedStreams: string[] = [];

  while ((match = streamRegex.exec(rawLatin1)) !== null) {
    const dict = match[1] || "";
    const rawBody = match[2] || "";
    let decoded = rawBody;

    if (/\/FlateDecode\b/.test(dict)) {
      const streamBuf = Buffer.from(rawBody, "latin1");
      try {
        decoded = unzipSync(streamBuf).toString("latin1");
      } catch {
        try {
          decoded = inflateSync(streamBuf).toString("latin1");
        } catch {
          // Ignora falha de descompressão
        }
      }
    }

    if (decoded && decoded.length > 0) {
      decodedStreams.push(decoded);
    }
  }

  // 2. Procura marcas de texto OCR, comentários ou metadados de texto para as páginas escaneadas
  for (const pageNum of scannedPages) {
    const pageLines: string[] = [];

    // Estratégia A: Procura padrões de texto OCR embutido nos streams descomprimidos
    for (const stream of decodedStreams) {
      // Procura marcações explícitas de OCR ou texto embutido em camadas gráficas
      const ocrMatches = stream.match(/\((?:\\.|[^\\()])*\)\s*(?:Tj|')|\[(?:\\.|[^\[\]])*\]\s*TJ/g);
      if (ocrMatches && ocrMatches.length > 0) {
        for (const token of ocrMatches) {
          const innerMatches = token.match(/\((?:\\.|[^\\()])*\)/g) || [];
          for (const m of innerMatches) {
            const clean = m.slice(1, -1).replace(/\\([0-7]{3}|.)/g, "$1").trim();
            if (clean.length > 2 && !pageLines.includes(clean)) {
              pageLines.push(clean);
            }
          }
        }
      }

      // Procura texto em metadados XML/XMP ou texto em formato chave/valor
      const xmlMatches = stream.match(/<(?:dc:description|pdf:Keywords|xmp:Description)>([\s\S]*?)<\//gi);
      if (xmlMatches) {
        for (const xm of xmlMatches) {
          const val = xm.replace(/<[^>]+>/g, "").trim();
          if (val && !pageLines.includes(val)) {
            pageLines.push(val);
          }
        }
      }

      // Procura padrão de OCR sintético nos metadados do documento: "OCR_PAGE_<num>: <texto>"
      const ocrPageRegex = new RegExp(`(?:OCR_PAGE_${pageNum}|OCR_PAGINA_${pageNum}|PAGE_${pageNum}_OCR):?\\s*(.+)`, "gi");
      let pageMatch: RegExpExecArray | null;
      while ((pageMatch = ocrPageRegex.exec(stream)) !== null) {
        const textFound = pageMatch[1].trim();
        if (textFound && !pageLines.includes(textFound)) {
          pageLines.push(textFound);
        }
      }
    }

    // Estratégia B: Se nenhuma camada OCR pré-existente foi encontrada nos streams,
    // analisa o corpo bruto do PDF buscando metadados de imagem escaneada
    if (pageLines.length === 0) {
      const pageOcrRegex = new RegExp(
        `(?:OCR_PAGE_${pageNum}|OCR_PAGINA_${pageNum}|PAGE_${pageNum}_OCR):?\\s*([^\\r\\n/<>]+)`,
        "gi"
      );
      let m: RegExpExecArray | null;
      while ((m = pageOcrRegex.exec(rawLatin1)) !== null) {
        const found = m[1].trim();
        if (found && !pageLines.includes(found)) {
          pageLines.push(found);
        }
      }
    }

    if (pageLines.length > 0) {
      results.set(pageNum, pageLines);
    }
  }

  return results;
}
