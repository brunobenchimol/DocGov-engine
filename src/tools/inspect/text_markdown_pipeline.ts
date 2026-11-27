// ============================================================================
// Pipeline de Inspeção para Texto Puro e Markdown (.md / .txt)
// Extraído de non_docx_pipeline.ts para manter folga segura <= 500L (Lei 9)
// ============================================================================

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import {
  buildDocxCartography,
  generateHotspotsDossierMarkdown,
  type IndexedLineEntry,
} from "../../core/cartography.ts";
import { resolveInspectOutputDir } from "../../utils/ephemeral_scope.ts";
import type {
  BodyParagraphInfo,
  DocxInspectionResult,
  PdfExtractionResult,
} from "../../types/index.ts";
import {
  buildTocMap,
  generateTextLinearAuditViewMarkdown,
} from "./audit_view_formatter.ts";
import {
  attachTransientInspectMarkdown,
  writeOrDeferMarkdownArtifact,
} from "./markdown_artifacts.ts";

export async function inspectTextOrMarkdownDocument(
  resolvedDocx: string,
  buffer: Buffer,
  outputPath?: string,
  compact: boolean = false,
  inScope?: boolean,
  options: {
    compareWithPath?: string;
    skipAuditArtifacts?: boolean;
    skipOutputWrite?: boolean;
    deferMarkdownWrite?: boolean;
    resolvedOutDir?: string;
    resolvedTargetOutputPath?: string;
  } = {}
): Promise<DocxInspectionResult> {
  const isMd =
    resolvedDocx.toLowerCase().endsWith(".md") ||
    resolvedDocx.toLowerCase().endsWith(".markdown");
  const textContent = buffer.toString("utf-8");
  const rawLines = textContent.split(/\r?\n/);

  const paragraphs: BodyParagraphInfo[] = rawLines.map((line, idx) => {
    const trimmed = line.trim();
    let style: string | null = null;
    let text = trimmed;

    const mdHeadingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (mdHeadingMatch) {
      const level = mdHeadingMatch[1].length;
      style = `Heading ${level}`;
      text = mdHeadingMatch[2].trim();
    } else if (
      /^(?:(?:\d+(?:\.\d+)*|[A-Z]|\b[IVXLCDM]+\b)[\.\-\)\s]|CL[ÁA]USULA|SE[ÇC][ãA]O|CAP[IÍ]TULO|ANEXO)\s+[A-ZÀ-Ú0-9]/i.test(
        trimmed
      ) ||
      /^(?:ESTUDO T[EÉ]CNICO PRELIMINAR|TERMO DE REFER[EÊ]NCIA|PROJETO B[AÁ]SICO|JUSTIFICATIVA|OBJETO|DISPOSI[ÇC][ÕO]ES)\b/i.test(
        trimmed
      )
    ) {
      style = "Heading 1";
    }

    return {
      part: "text",
      index: idx,
      paragraphIndex: idx,
      style,
      text,
    };
  });

  const toc_map = buildTocMap(paragraphs, []);
  const cartography = buildDocxCartography(paragraphs, [], toc_map);
  const baseStem = outputPath
    ? basename(resolve(outputPath), ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      )
    : basename(resolvedDocx).replace(/\.(?:md|markdown|txt|text|log)$/i, "");

  const scopeOut = options.skipOutputWrite
    ? { outDir: dirname(resolvedDocx), targetOutputPath: undefined }
    : options.resolvedOutDir
    ? {
        outDir: options.resolvedOutDir,
        targetOutputPath: options.resolvedTargetOutputPath,
      }
    : resolveInspectOutputDir({
        resolvedSource: resolvedDocx,
        outputPath,
        inScope: Boolean(inScope),
        baseStem,
        prefix: "inspect",
      });
  const outDir = scopeOut.outDir;
  const targetOutputPath = scopeOut.targetOutputPath;

  if (!options.skipOutputWrite && !existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const auditViewPath = resolve(outDir, `visao_auditoria_${baseStem}.md`);
  const dossieHotspotsPath = resolve(outDir, `dossie_hotspots_${baseStem}.md`);

  let transientTextAuditMd: string | undefined;
  let transientTextDossieMd: string | undefined;
  if (!options.skipAuditArtifacts) {
    const auditMd = generateTextLinearAuditViewMarkdown(
      basename(resolvedDocx),
      paragraphs,
      cartography,
      isMd
    );
    writeOrDeferMarkdownArtifact(
      auditViewPath,
      auditMd,
      options.deferMarkdownWrite
    );
    transientTextAuditMd = auditMd;
  }

  const textLines: IndexedLineEntry[] = paragraphs.map((p) => ({
    coord: `[P${p.index}]`,
    text: p.text,
    line: p.index + 1,
    isExplicitHeading: Boolean(p.style && p.style.startsWith("Heading")),
  }));

  const fakeExtraction: PdfExtractionResult = {
    pageCount: Math.max(1, Math.ceil(paragraphs.length / 45)),
    lineCount: paragraphs.length,
    lines: textLines,
  };

  if (!options.skipAuditArtifacts) {
    const dossieMd = generateHotspotsDossierMarkdown(
      basename(resolvedDocx),
      fakeExtraction,
      cartography
    );
    writeOrDeferMarkdownArtifact(
      dossieHotspotsPath,
      dossieMd,
      options.deferMarkdownWrite
    );
    transientTextDossieMd = dossieMd;
  }

  const textResult: DocxInspectionResult = {
    doc_type: isMd ? "markdown" : "text",
    format: isMd ? "markdown" : "plain_text",
    page_count: fakeExtraction.pageCount,
    line_count: paragraphs.length,
    ...(options.skipAuditArtifacts
      ? {}
      : {
          audit_view_path: auditViewPath,
          dossie_hotspots_path: dossieHotspotsPath,
        }),
    cartography,
    headers: [],
    footers: [],
    paragraphs: compact ? paragraphs.filter((p) => p.text.length > 0) : paragraphs,
    tables: [],
    toc_map,
  };

  if (transientTextAuditMd !== undefined || transientTextDossieMd !== undefined) {
    attachTransientInspectMarkdown(
      textResult,
      transientTextAuditMd,
      transientTextDossieMd
    );
  }
  if (targetOutputPath) {
    writeFileSync(targetOutputPath, JSON.stringify(textResult, null, 2), "utf-8");
  }

  return textResult;
}
