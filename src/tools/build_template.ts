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
  findBodyRunProperties,
  findBodyParagraphProperties,
  setParagraphSingleRunText,
  setTableCellSingleParagraphText,
  appendTextRunToTableCell,
  applyInlineReplacementsToXmlDoc,
  ensureContentTypesOverride,
  normalizeTag,
} from "../utils/xml.ts";
import { inspectDocx } from "./inspect.ts";
import {
  computeStructureFingerprint,
  saveTemplateToRegistry,
} from "../core/registry.ts";
import { VERSION } from "../constants/index.ts";
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

  const docXmlStr = await docFile.async("string");
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

  // 2.1. replace_paragraphs
  if (manifest.replace_paragraphs && manifest.replace_paragraphs.length > 0) {
    for (const rule of manifest.replace_paragraphs) {
      const { start_p, end_p, tag } = rule;
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

      setParagraphSingleRunText(
        docXml,
        targetP,
        normalizeTag(tag),
        bodyRPr,
        bodyPPr
      );

      for (let i = start_p + 1; i <= sliceEnd; i++) {
        const pToRemove = originalBodyParagraphs[i];
        if (pToRemove && pToRemove.parentNode === body) {
          body.removeChild(pToRemove);
        }
      }
      breakdown.replace_paragraphs++;
    }
  }

  // 2.1b. loop_paragraphs
  if (manifest.loop_paragraphs && manifest.loop_paragraphs.length > 0) {
    for (const rule of manifest.loop_paragraphs) {
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

  // 2.2. replace_table_cells
  if (manifest.replace_table_cells && manifest.replace_table_cells.length > 0) {
    for (const rule of manifest.replace_table_cells) {
      const { table_index, row_index, cell_index, tag } = rule;
      const tSnap = originalBodyTables[table_index];
      if (!tSnap) {
        throw new Error(`Tabela de índice ${table_index} não encontrada`);
      }
      const rSnap = tSnap.rows[row_index];
      if (!rSnap) {
        throw new Error(
          `Linha ${row_index} não encontrada na tabela ${table_index}`
        );
      }
      const tc = rSnap.cells[cell_index];
      if (!tc) {
        throw new Error(
          `Célula ${cell_index} não encontrada na linha ${row_index} da tabela ${table_index}`
        );
      }

      setTableCellSingleParagraphText(docXml, tc, normalizeTag(tag));
      breakdown.replace_table_cells++;
    }
  }

  // 2.3. loop_table_rows
  if (manifest.loop_table_rows && manifest.loop_table_rows.length > 0) {
    for (const rule of manifest.loop_table_rows) {
      const {
        table_index,
        header_row_index,
        template_row_index,
        remove_from_row,
        remove_to_row,
        for_open_tag,
        for_close_tag,
        cell_tags,
      } = rule;

      const tSnap = originalBodyTables[table_index];
      if (!tSnap) {
        throw new Error(`Tabela de índice ${table_index} não encontrada`);
      }
      const headerRow = tSnap.rows[header_row_index];
      if (!headerRow || headerRow.cells.length === 0) {
        throw new Error(
          `Linha de cabeçalho ${header_row_index} inválida na tabela ${table_index}`
        );
      }
      const templateRow = tSnap.rows[template_row_index];
      if (!templateRow || templateRow.cells.length === 0) {
        throw new Error(
          `Linha de template ${template_row_index} inválida na tabela ${table_index}`
        );
      }

      // Extrai o nome da variável iteradora do FOR (ex.: "r" em "{{FOR r IN gestao_riscos}}")
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

      // Anexa for_open_tag na última célula de header_row_index
      const lastHeaderCell = headerRow.cells[headerRow.cells.length - 1];
      appendTextRunToTableCell(docXml, lastHeaderCell, normalizedOpenTag);

      // Preenche cada célula de template_row_index com cell_tags e anexa for_close_tag na última célula
      const lastCellIdx = templateRow.cells.length - 1;
      for (let cIdx = 0; cIdx <= lastCellIdx; cIdx++) {
        const tc = templateRow.cells[cIdx];
        let cellTag = cell_tags[cIdx] ? normalizeTag(cell_tags[cIdx]) : "";
        if (iteratorVar && cellTag) {
          const varRegex = new RegExp(
            `(\\{\\{\\s*(?:INS\\s+|\\=\\s*)?)${iteratorVar}\\b`,
            "g"
          );
          cellTag = cellTag.replace(varRegex, `$1$${iteratorVar}`);
        }
        const finalCellContent =
          cIdx === lastCellIdx
            ? `${cellTag}${normalizedCloseTag}`
            : cellTag;
        setTableCellSingleParagraphText(docXml, tc, finalCellContent);
      }

      // Remove as linhas antigas de remove_from_row até remove_to_row
      if (remove_from_row !== undefined && remove_to_row !== undefined) {
        const maxRow = Math.min(remove_to_row, tSnap.rows.length - 1);
        for (let rIdx = remove_from_row; rIdx <= maxRow; rIdx++) {
          if (rIdx === header_row_index || rIdx === template_row_index) {
            continue;
          }
          const rowToRemove = tSnap.rows[rIdx]?.tr;
          if (rowToRemove && rowToRemove.parentNode === tSnap.tbl) {
            tSnap.tbl.removeChild(rowToRemove);
          }
        }
      }
      breakdown.loop_table_rows++;
    }
  }

  // 2.4. replace_inline (em word/document.xml, word/header*.xml e word/footer*.xml)
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
        const partXmlStr = await partFile.async("string");
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

