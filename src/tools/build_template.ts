import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { safeReadJsonFile } from "../utils/json.ts";
import { normalizeSlotsManifest, countManifestRules } from "../core/manifest.ts";
import { createSlotsManifestContractError } from "../contracts/errors.ts";
import {
  getAllElements,
  getDirectChildElements,
  extractParagraphStyle,
  extractParagraphText,
  findBodyRunProperties,
  findBodyParagraphProperties,
  setParagraphSingleRunText,
  applyInlineReplacementsToXmlDoc,
  ensureContentTypesOverride,
  normalizeTag,
  sanitizeXmlString,
} from "../utils/xml.ts";
import { inspectDocx } from "./inspect.ts";
import {
  computeStructureFingerprint,
  saveTemplateToRegistry,
} from "../core/registry.ts";
import { VERSION } from "../constants/index.ts";
import {
  assertDocGovCaseScope,
  isValidDocGovCaseScope,
} from "../utils/paths.ts";
import {
  applyReplaceTableCellsRules,
  applyTableRowLoopAndRemoveRules,
} from "./openxml/table_slot_builder.ts";
import type {
  SlotsManifest,
  BuildDocxTemplateBreakdown,
  BuildDocxTemplateResult,
  BuildDocxTemplateOptions,
  BuildDocxTemplateSyntheticResult,
} from "../types/index.ts";

// ============================================================================
// 2. Função Construtora de Template (build_docx_template)
// ============================================================================

export async function buildDocxTemplate(
  sourcePath: string,
  manifestPath: string,
  outputPath: string,
  options: BuildDocxTemplateOptions = {}
): Promise<BuildDocxTemplateResult> {
  const resolvedSource = resolve(sourcePath);
  const resolvedManifest = resolve(manifestPath);
  const resolvedOutput = resolve(outputPath);

  const inScope =
    isValidDocGovCaseScope(resolvedSource) ||
    isValidDocGovCaseScope(resolvedOutput) ||
    isValidDocGovCaseScope(resolvedManifest);
  if (!inScope) {
    assertDocGovCaseScope(resolvedSource, "build_docx_template");
  }

  if (!existsSync(resolvedSource)) {
    throw new Error(`Documento bruto não encontrado: ${resolvedSource}`);
  }
  if (!existsSync(resolvedManifest)) {
    throw new Error(
      `Manifesto de slots não encontrado: ${resolvedManifest}`
    );
  }

  const sourceBuffer = readFileSync(resolvedSource);
  const rawManifest = safeReadJsonFile<any>(resolvedManifest);
  const manifest: SlotsManifest = normalizeSlotsManifest(rawManifest);
  const configuredRulesCount = countManifestRules(manifest);

  if (configuredRulesCount === 0) {
    throw new Error(
      createSlotsManifestContractError(
        `Nenhuma regra válida reconhecida no arquivo ${resolvedManifest}. O manifesto está vazio ou estruturado incorretamente.`
      )
    );
  }

  const breakdown: BuildDocxTemplateBreakdown = {
    replace_paragraphs: 0,
    loop_paragraphs: 0,
    replace_table_cells: 0,
    loop_table_rows: 0,
    replace_inline: 0,
  };

  const zip = await JSZip.loadAsync(sourceBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error(
      `Estrutura OpenXML inválida (word/document.xml ausente): ${resolvedSource}`
    );
  }

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const docXmlStr = sanitizeXmlString(await docFile.async("string"));
  const docXml = parser.parseFromString(docXmlStr, "application/xml");
  const body = getAllElements(docXml, "w:body")[0];
  if (!body) {
    throw new Error(`Elemento <w:body> não encontrado em word/document.xml`);
  }

  // Snapshot estático dos elementos originais para nunca deslocar índices
  const originalBodyParagraphs = getDirectChildElements(body, "w:p");
  const originalBodyTables = getDirectChildElements(body, "w:tbl").map(
    (tbl) => ({
      tbl,
      rows: getDirectChildElements(tbl, "w:tr").map((tr) => ({
        tr,
        cells: getDirectChildElements(tr, "w:tc"),
      })),
    })
  );

  applyReplaceTableCellsRules(docXml, manifest, originalBodyTables, breakdown);

  // 2.2. replace_paragraphs (ordem decrescente de start_p)
  if (manifest.replace_paragraphs && manifest.replace_paragraphs.length > 0) {
    const sortedReplaceP = [...manifest.replace_paragraphs].sort(
      (a, b) => b.start_p - a.start_p
    );
    for (const rule of sortedReplaceP) {
      const { start_p, end_p, tag } = rule;
      if (start_p < 0 || start_p >= originalBodyParagraphs.length) {
        throw new Error(
          `Índice start_p (${start_p}) fora do intervalo de parágrafos (0..${originalBodyParagraphs.length - 1})`
        );
      }
      const sliceEnd = Math.min(end_p, originalBodyParagraphs.length - 1);

      // ENG-12a: Heading Guard — Quando end_p > start_p e start_p for título de seção,
      // preserva start_p intacto e aplica o slot a partir de start_p + 1
      let effectiveStartP = start_p;
      if (sliceEnd > start_p) {
        const startElement = originalBodyParagraphs[start_p];
        const style = extractParagraphStyle(startElement);
        const text = extractParagraphText(startElement).trim();
        const hasHeadingStyle =
          style !== null &&
          /^(?:Heading|Titulo|Título|T[ií]tulo|Header|Se[çc][ãa]o)/i.test(style);
        const isNumberedSection =
          /^(?:(?:\d+(?:\.\d+)*|[A-Z]|\b[IVXLCDM]+\b)[\.\-\)\s]|CL[ÁA]USULA|SE[ÇC][ÃA]O|CAP[IÍ]TULO|ANEXO)\s+[A-ZÀ-Ú0-9]/i.test(
            text
          );
        const isCommonAdminHeader =
          /^(?:ESTUDO T[EÉ]CNICO PRELIMINAR|TERMO DE REFER[EÊ]NCIA|PROJETO B[AÁ]SICO|JUSTIFICATIVA|OBJETO(?:\s+DA\s+CONTRATA[ÇC][ÃA]O)?|DISPOSI[ÇC][ÕO]ES GERAIS|MATRIZ DE RISCOS|CRONOGRAMA|PESQUISA DE PRE[ÇC]OS|CRIT[EÉ]RIOS DE HABILITA[ÇC][ÃA]O|DISPOSI[ÇC][ÕO]ES FINAIS)\b/i.test(
            text
          );
        const isAllCapsTitle =
          text.length >= 4 &&
          text.length <= 100 &&
          text === text.toUpperCase() &&
          /[A-ZÀ-Ú]/.test(text) &&
          !/[;,.]$/.test(text) &&
          !text.includes("\n");

        if (
          hasHeadingStyle ||
          isNumberedSection ||
          isCommonAdminHeader ||
          isAllCapsTitle
        ) {
          effectiveStartP = start_p + 1;
        }
      }

      const targetP = originalBodyParagraphs[effectiveStartP];
      const paragraphRange = originalBodyParagraphs.slice(
        effectiveStartP,
        sliceEnd + 1
      );
      const bodyRPr = findBodyRunProperties(paragraphRange);
      const bodyPPr = findBodyParagraphProperties(paragraphRange);

      setParagraphSingleRunText(
        docXml,
        targetP,
        normalizeTag(tag),
        bodyRPr,
        bodyPPr
      );

      for (let i = effectiveStartP + 1; i <= sliceEnd; i++) {
        const pToRemove = originalBodyParagraphs[i];
        if (pToRemove && pToRemove.parentNode === body) {
          body.removeChild(pToRemove);
        }
      }
      breakdown.replace_paragraphs++;
    }
  }

  // 2.3. loop_paragraphs (ordem decrescente de start_p)
  if (manifest.loop_paragraphs && manifest.loop_paragraphs.length > 0) {
    const sortedLoopP = [...manifest.loop_paragraphs].sort(
      (a, b) => b.start_p - a.start_p
    );
    for (const rule of sortedLoopP) {
      const { start_p, end_p, for_open_tag, for_close_tag, item_tag } = rule;
      if (start_p < 0 || start_p >= originalBodyParagraphs.length) {
        throw new Error(
          `Índice start_p (${start_p}) fora do intervalo de parágrafos (0..${originalBodyParagraphs.length - 1})`
        );
      }
      const targetP = originalBodyParagraphs[start_p];
      const sliceEnd = Math.min(end_p, originalBodyParagraphs.length - 1);
      const paragraphRange = originalBodyParagraphs.slice(
        start_p,
        sliceEnd + 1
      );
      const bodyRPr = findBodyRunProperties(paragraphRange);
      const bodyPPr = findBodyParagraphProperties(paragraphRange);

      const normalizedOpenTag = normalizeTag(for_open_tag).replace(
        /\bFOR\s+\$([a-zA-Z_]\w*)\s+IN\b/i,
        "FOR $1 IN"
      );
      const normalizedCloseTag = normalizeTag(for_close_tag).replace(
        /\bEND-FOR\s+\$([a-zA-Z_]\w*)\b/i,
        "END-FOR $1"
      );
      const forVarMatch = normalizedOpenTag.match(
        /\bFOR\s+([a-zA-Z_]\w*)\s+IN\b/i
      );
      const iteratorVar = forVarMatch ? forVarMatch[1] : null;
      let normalizedItemTag = normalizeTag(item_tag);
      if (iteratorVar && normalizedItemTag) {
        const varRegex = new RegExp(
          `(\\{\\{\\s*(?:INS\\s+|\\=\\s*)?)${iteratorVar}\\b`,
          "g"
        );
        normalizedItemTag = normalizedItemTag.replace(
          varRegex,
          `$1$${iteratorVar}`
        );
      }

      setParagraphSingleRunText(
        docXml,
        targetP,
        `${normalizedOpenTag}${normalizedItemTag}${normalizedCloseTag}`,
        bodyRPr,
        bodyPPr
      );

      for (let i = start_p + 1; i <= sliceEnd; i++) {
        const pToRemove = originalBodyParagraphs[i];
        if (pToRemove && pToRemove.parentNode === body) {
          body.removeChild(pToRemove);
        }
      }
      breakdown.loop_paragraphs++;
    }
  }

  applyTableRowLoopAndRemoveRules(docXml, manifest, originalBodyTables, breakdown);

  // 2.6. replace_inline (em word/document.xml, word/header*.xml e word/footer*.xml)
  if (manifest.replace_inline && manifest.replace_inline.length > 0) {
    const docInlineCount = applyInlineReplacementsToXmlDoc(
      docXml,
      manifest.replace_inline
    );
    breakdown.replace_inline += docInlineCount;

    const fileNames = Object.keys(zip.files).sort();
    for (const name of fileNames) {
      if (/^word\/(header|footer)\d*\.xml$/i.test(name)) {
        const partFile = zip.file(name)!;
        const partXmlStr = sanitizeXmlString(await partFile.async("string"));
        const partXmlDoc = parser.parseFromString(
          partXmlStr,
          "application/xml"
        );
        const partInlineCount = applyInlineReplacementsToXmlDoc(
          partXmlDoc,
          manifest.replace_inline
        );
        if (partInlineCount > 0) {
          breakdown.replace_inline += partInlineCount;
          zip.file(name, serializer.serializeToString(partXmlDoc));
        }
      }
    }
  }

  // Validação Fail-Fast (Zero Silent No-Op v0.6.1)
  const applied_slots_count =
    breakdown.replace_paragraphs +
    breakdown.loop_paragraphs +
    breakdown.replace_table_cells +
    breakdown.loop_table_rows +
    (breakdown.remove_table_rows ?? 0) +
    breakdown.replace_inline;

  if (applied_slots_count === 0) {
    throw new Error(
      createSlotsManifestContractError(
        `0 slots foram aplicados no documento '${basename(resolvedSource)}'. Nenhuma das ${configuredRulesCount} regra(s) do manifesto (${resolvedManifest}) produziu alterações no OpenXML. Verifique se as coordenadas ou textos de busca existem no documento.`
      )
    );
  }

  // Atualiza word/document.xml no pacote ZIP
  zip.file("word/document.xml", serializer.serializeToString(docXml));

  // Garante Override em [Content_Types].xml
  await ensureContentTypesOverride(zip);

  const outBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  const outDir = dirname(resolvedOutput);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  writeFileSync(resolvedOutput, outBuffer);

  let registryMsg = "";
  let registryPath: string | undefined;
  if (options.saveToRegistry) {
    const insp = await inspectDocx(resolvedSource, undefined, false, {
      registryDir: options.registryDir,
    });
    const fp = insp.structure_fingerprint || computeStructureFingerprint(insp);
    const templateId = options.templateId || basename(resolvedSource, ".docx");
    registryPath = saveTemplateToRegistry(
      templateId,
      manifest,
      fp,
      resolvedSource,
      options.registryDir
    );
    registryMsg = `\nTemplate homologado salvo no registro global: ${registryPath}`;
  }

  return {
    success: true,
    message: `Template parametrizado gerado com sucesso em: ${resolvedOutput} (${applied_slots_count} slots aplicados)${registryMsg}`,
    ...(registryPath ? { registryPath } : {}),
    applied_slots_count,
    breakdown,
  };
}

export function formatBuildDocxTemplateSyntheticResult(
  outputPath: string,
  result: BuildDocxTemplateResult
): BuildDocxTemplateSyntheticResult {
  return {
    status: "success",
    engine_version: VERSION,
    outputPath: resolve(outputPath),
    applied_slots_count: result.applied_slots_count,
    breakdown: result.breakdown,
    ...(result.registryPath ? { registryPath: result.registryPath } : {}),
    message: result.message,
    next_step_hint:
      "Próximo passo recomendado: elabore ou atualize o arquivo de estado (ex.: state/estado_caso.json) e chame 'fill_docx_template' para injetar os dados e gerar a minuta final.",
  };
}
