import {
  getAllElements,
  getDirectChildElements,
  extractParagraphText,
  setTableCellSingleParagraphText,
  resolvePhysicalTableCell,
  extractCellVMerge,
  extractCellGridSpan,
  extractCellText,
  normalizeTag,
} from "../../utils/xml.ts";
import { createSlotsManifestContractError } from "../../contracts/errors.ts";
import type {
  SlotsManifest,
  BuildDocxTemplateBreakdown,
} from "../../types/index.ts";

export interface TableDomSnapshot {
  tbl: Element;
  rows: Array<{
    tr: Element;
    cells: Element[];
  }>;
}

export function applyReplaceTableCellsRules(
  docXml: Document,
  manifest: SlotsManifest,
  originalBodyTables: TableDomSnapshot[],
  breakdown: BuildDocxTemplateBreakdown
): void {
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

      // ENG-11b (Fase 1): Auto-redirecionamento geométrico de checkbox C_k -> C_{k+1}
      const tcText = extractCellText(tc).trim();
      const tcColSpan = extractCellGridSpan(tc);
      const isCheckboxText =
        tcText.length <= 35 &&
        /^(?:[☐☑☒\u2610\u2611\u2612]|\[[\sxX]\]|\(x\)|\(\s*\)|sim\b|n[ãa]o\b|optante\b|n[ãa]o\s+optante\b|exclusiv[ao]\b|ampla\s+concorr[êe]ncia\b)/i.test(
          tcText
        );
      const isBooleanTag = /check|flag|opcao|sim_nao|habilitado|ativo|status/i.test(
        tag
      );

      const tcIdxInRow = rSnap.cells.indexOf(tc);
      const nextTc =
        tcIdxInRow >= 0 && tcIdxInRow + 1 < rSnap.cells.length
          ? rSnap.cells[tcIdxInRow + 1]
          : null;
      const nextIsMapped = nextTc
        ? manifest.replace_table_cells.some(
            (other) =>
              other !== rule &&
              other.table_index === table_index &&
              other.row_index === row_index &&
              (other.cell_index === tcIdxInRow + 1 ||
                resolvePhysicalTableCell(rSnap.cells, other.cell_index) ===
                  nextTc)
          )
        : false;

      if (
        isCheckboxText &&
        tcColSpan <= 2 &&
        !isBooleanTag &&
        nextTc &&
        !nextIsMapped &&
        (extractCellGridSpan(nextTc) >= 3 || rSnap.cells.length <= 3)
      ) {
        setTableCellSingleParagraphText(docXml, tc, "☒ Sim.");
        setTableCellSingleParagraphText(docXml, nextTc, normalizeTag(tag));
      } else {
        setTableCellSingleParagraphText(docXml, tc, normalizeTag(tag));
      }
      breakdown.replace_table_cells++;
    }
  }
}

export function applyTableRowLoopAndRemoveRules(
  docXml: Document,
  manifest: SlotsManifest,
  originalBodyTables: TableDomSnapshot[],
  breakdown: BuildDocxTemplateBreakdown
): void {
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

  // 2.5. remove_table_rows (ENG-07a — executado em ordem decrescente de from_row, Bottom-Up)
  if (manifest.remove_table_rows && manifest.remove_table_rows.length > 0) {
    const sortedRemoveRows = [...manifest.remove_table_rows].sort(
      (a, b) => b.from_row - a.from_row
    );
    for (const rule of sortedRemoveRows) {
      const { table_index, from_row, to_row } = rule;
      const tSnap = originalBodyTables[table_index];
      if (!tSnap) {
        throw new Error(
          `Tabela de índice ${table_index} não encontrada para 'remove_table_rows'`
        );
      }
      if (from_row < 0 || from_row >= tSnap.rows.length) {
        throw new Error(
          `Linha inicial 'from_row' (${from_row}) fora do intervalo da tabela ${table_index} (0..${tSnap.rows.length - 1})`
        );
      }

      const maxRow = Math.min(to_row, tSnap.rows.length - 1);

      // Proteção de <w:vMerge/>: se o intervalo removido continha uma célula com w:val="restart"
      // e a linha imediatamente posterior (maxRow + 1) tem w:vMerge continue, promove maxRow + 1 para restart!
      if (maxRow + 1 < tSnap.rows.length) {
        const nextRow = tSnap.rows[maxRow + 1];
        if (nextRow && nextRow.cells.length > 0) {
          const nextC0VMerge = extractCellVMerge(nextRow.cells[0]);
          if (nextC0VMerge === "continue") {
            let restartCellInRemoved: Element | null = null;
            for (let rIdx = from_row; rIdx <= maxRow; rIdx++) {
              const cand = tSnap.rows[rIdx];
              if (
                cand &&
                cand.cells.length > 0 &&
                extractCellVMerge(cand.cells[0]) === "restart"
              ) {
                restartCellInRemoved = cand.cells[0];
                break;
              }
            }
            if (restartCellInRemoved) {
              const tcPrList = getDirectChildElements(nextRow.cells[0], "w:tcPr");
              if (tcPrList.length > 0) {
                const vmList = getDirectChildElements(tcPrList[0], "w:vMerge");
                if (vmList.length > 0) {
                  vmList[0].setAttribute("w:val", "restart");
                }
              }
              const nextText = getAllElements(nextRow.cells[0], "w:p")
                .map(extractParagraphText)
                .join("\n")
                .trim();
              if (!nextText) {
                const origLabel = getAllElements(restartCellInRemoved, "w:p")
                  .map(extractParagraphText)
                  .join("\n")
                  .trim();
                if (origLabel) {
                  setTableCellSingleParagraphText(
                    docXml,
                    nextRow.cells[0],
                    origLabel
                  );
                }
              }
            }
          }
        }
      }

      let removedInRule = 0;
      for (let rIdx = maxRow; rIdx >= from_row; rIdx--) {
        const rowToRemove = tSnap.rows[rIdx]?.tr;
        if (rowToRemove && rowToRemove.parentNode === tSnap.tbl) {
          tSnap.tbl.removeChild(rowToRemove);
          removedInRule++;
        }
      }
      if (removedInRule > 0) {
        breakdown.remove_table_rows = (breakdown.remove_table_rows ?? 0) + 1;
      }
    }
  }
}
