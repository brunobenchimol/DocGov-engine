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
  resolvePhysicalTableCell,
  extractCellVMerge,
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

  // 2.1. replace_table_cells (aplicado primeiro para evitar interferência de remoção de linhas)
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
      const tc = resolvePhysicalTableCell(rSnap.cells, cell_index);
      if (!tc) {
        throw new Error(
          `Célula ${cell_index} não encontrada na linha ${row_index} da tabela ${table_index} (a linha possui ${rSnap.cells.length} células físicas)`
        );
      }

      setTableCellSingleParagraphText(docXml, tc, normalizeTag(tag));
      breakdown.replace_table_cells++;
    }
  }

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

  // 2.4. loop_table_rows (ordem decrescente de remoção/template — Bottom-Up)
  if (manifest.loop_table_rows && manifest.loop_table_rows.length > 0) {
    const sortedLoopRows = [...manifest.loop_table_rows].sort(
      (a, b) =>
        (b.remove_from_row ?? b.template_row_index) -
        (a.remove_from_row ?? a.template_row_index)
    );
    for (const rule of sortedLoopRows) {
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

      // Auto-alinhamento se C0 tem vMerge e o manifesto enviou exatamente as tags das colunas de dados
      let effectiveCellTags = [...cell_tags];
      const c0HasVMerge =
        templateRow.cells.length > 1 &&
        extractCellVMerge(templateRow.cells[0]) !== null;

      if (
        c0HasVMerge &&
        cell_tags.length === templateRow.cells.length - 1 &&
        cell_tags[0] !== ""
      ) {
        effectiveCellTags = ["", ...cell_tags];
      }

      // Validação Fail-Fast estrita de contagem de colunas físicas (ENG-02c)
      if (effectiveCellTags.length > templateRow.cells.length) {
        const cellSummary = templateRow.cells
          .map((tc, idx) => `C${idx}`)
          .join(", ");
        throw new Error(
          createSlotsManifestContractError(
            `Regra 'loop_table_rows' na tabela ${table_index}: foram fornecidas ${effectiveCellTags.length} tag(s) em 'cell_tags', porém a linha de template ${template_row_index} possui apenas ${templateRow.cells.length} célula(s) física(s) (<w:tc>: ${cellSummary}). Ajuste o array 'cell_tags' para corresponder exatamente à contagem física de células da linha.`
          )
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

      // Injeta for_open_tag em linha <w:tr> dedicada imediatamente antes de templateRow
      // e for_close_tag em linha <w:tr> dedicada imediatamente após templateRow.
      // Este é o padrão canônico do docx-templates para repetição de linhas de tabela (<w:tr>),
      // eliminando completamente a fusão horizontal de colunas e repetindo a linha inteira!
      const forTr = docXml.createElement("w:tr");
      const forTc = docXml.createElement("w:tc");
      setTableCellSingleParagraphText(docXml, forTc, normalizedOpenTag);
      forTr.appendChild(forTc);
      tSnap.tbl.insertBefore(forTr, templateRow.tr);

      // Preenche cada célula física de templateRow com as tags correspondentes
      for (let cIdx = 0; cIdx < templateRow.cells.length; cIdx++) {
        const tc = templateRow.cells[cIdx];
        let cellTag = effectiveCellTags[cIdx]
          ? normalizeTag(effectiveCellTags[cIdx])
          : "";
        if (iteratorVar && cellTag) {
          const varRegex = new RegExp(
            `(\\{\\{\\s*(?:INS\\s+|\\=\\s*)?)${iteratorVar}\\b`,
            "g"
          );
          cellTag = cellTag.replace(varRegex, `$1$${iteratorVar}`);
        }
        setTableCellSingleParagraphText(docXml, tc, cellTag);
      }

      const endForTr = docXml.createElement("w:tr");
      const endForTc = docXml.createElement("w:tc");
      setTableCellSingleParagraphText(docXml, endForTc, normalizedCloseTag);
      endForTr.appendChild(endForTc);
      tSnap.tbl.insertBefore(endForTr, templateRow.tr.nextSibling);

      // Remove as linhas antigas de remove_from_row até remove_to_row em ordem decrescente (Bottom-Up)
      if (remove_from_row !== undefined && remove_to_row !== undefined) {
        const maxRow = Math.min(remove_to_row, tSnap.rows.length - 1);
        for (let rIdx = maxRow; rIdx >= remove_from_row; rIdx--) {
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

