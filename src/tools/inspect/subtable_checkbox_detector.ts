import type {
  TableInfo,
  DetectedItemSubtable,
  DetectedCheckboxGroup,
} from "../../types/index.ts";
// ============================================================================
// Detecção de Subtabelas de Itens e Checkboxes (ENG-07b, ENG-11)
// ============================================================================

export function detectTableSubtablesAndCheckboxes(tables: TableInfo[]): {
  subtables: DetectedItemSubtable[];
  checkboxes: DetectedCheckboxGroup[];
} {
  const subtables: DetectedItemSubtable[] = [];
  const checkboxes: DetectedCheckboxGroup[] = [];

  for (const tbl of tables) {
    let currentStartRow = -1;
    let currentEndRow = -1;
    let currentHeaderRow: number | undefined;
    let currentLabel = "";
    let currentCount = 0;
    let lastItemNumber = 0;

    const flushSubtable = () => {
      if (currentCount >= 2 && currentStartRow >= 0 && currentEndRow >= currentStartRow) {
        subtables.push({
          table_index: tbl.index,
          label: currentLabel || `Subtabela de Itens (T${tbl.index})`,
          ...(currentHeaderRow !== undefined ? { header_row: currentHeaderRow } : {}),
          start_row: currentStartRow,
          end_row: currentEndRow,
          item_count: currentCount,
          sample_coords: [
            `T${tbl.index}.R${currentStartRow}`,
            `T${tbl.index}.R${currentEndRow}`,
          ],
        });
      }
      currentStartRow = -1;
      currentEndRow = -1;
      currentHeaderRow = undefined;
      currentLabel = "";
      currentCount = 0;
      lastItemNumber = 0;
    };

    for (let rIdx = 0; rIdx < tbl.rows.length; rIdx++) {
      const row = tbl.rows[rIdx];
      const physicalCells = row.cells.filter((c) => !c.isSpanPlaceholder);
      if (physicalCells.length < 2) {
        flushSubtable();
        continue;
      }

      let detectedItemNum: number | null = null;
      let labelCandidate = "";

      for (let cIdx = 0; cIdx < Math.min(physicalCells.length, 3); cIdx++) {
        const cell = physicalCells[cIdx];
        const txt = cell.text.trim().replace(/\r?\n/g, " ");
        if (cIdx === 0 && (cell.rowSpan === "restart" || cell.rowSpan === "continue") && txt && !/^(?:item\s*)?0*\d{1,3}[\.\)]?$/i.test(txt)) {
          labelCandidate = txt;
          continue;
        }
        const m = txt.match(/^(?:item\s*)?0*(\d{1,3})[\.\)]?$/i);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num >= 1 && num <= 500) {
            detectedItemNum = num;
            break;
          }
        }
      }

      if (detectedItemNum !== null) {
        if (currentCount === 0) {
          if (detectedItemNum === 1 || (rIdx > 0 && /item|descri[çc][ãa]o|especifica[çc][ãa]o|unid|qtd|quant/i.test(tbl.rows[rIdx - 1].cells.map((c) => c.text).join(" ")))) {
            currentStartRow = row.rowIndex;
            currentEndRow = row.rowIndex;
            currentCount = 1;
            lastItemNumber = detectedItemNum;
            if (rIdx > 0) {
              const prevRowText = tbl.rows[rIdx - 1].cells
                .filter((c) => !c.isSpanPlaceholder)
                .map((c) => c.text.trim())
                .join(" ");
              if (/item|descri[çc][ãa]o|especifica[çc][ãa]o|unid|qtd|quant|catmat|catser|sku/i.test(prevRowText)) {
                currentHeaderRow = tbl.rows[rIdx - 1].rowIndex;
              }
            }
            if (labelCandidate) {
              currentLabel = labelCandidate;
            } else if (currentHeaderRow !== undefined) {
              const hdrCells = tbl.rows[rIdx - 1].cells.filter((c) => !c.isSpanPlaceholder);
              if (hdrCells[0] && (hdrCells[0].rowSpan === "restart" || hdrCells[0].rowSpan === "continue") && hdrCells[0].text.trim()) {
                currentLabel = hdrCells[0].text.trim().replace(/\r?\n/g, " ");
              }
            }
          }
        } else if (detectedItemNum === lastItemNumber + 1) {
          currentEndRow = row.rowIndex;
          currentCount++;
          lastItemNumber = detectedItemNum;
          if (!currentLabel && labelCandidate) {
            currentLabel = labelCandidate;
          }
        } else if (detectedItemNum === 1) {
          flushSubtable();
          currentStartRow = row.rowIndex;
          currentEndRow = row.rowIndex;
          currentCount = 1;
          lastItemNumber = 1;
          if (labelCandidate) currentLabel = labelCandidate;
        } else {
          flushSubtable();
        }
      } else {
        const rowTextJoined = physicalCells.map((c) => c.text.trim()).join(" ");
        if (
          currentCount >= 1 &&
          /item\s+n[ãa]o\s+aplic[áa]vel|n[ãa]o\s+aplic[áa]vel\s+ao\s+escopo/i.test(rowTextJoined)
        ) {
          currentEndRow = row.rowIndex;
          currentCount++;
          lastItemNumber++;
        } else {
          flushSubtable();
        }
      }
    }
    flushSubtable();

    const checkboxTokenRegex =
      /(?:([☒☑✓✔])|([☐◻□])|\[\s*([xX✓✔])\s*\]|\[\s*()\s*\]|\(\s*([xX✓✔])\s*\)|\(\s*()\s*\))\s*(Sim|N[ãa]o|[A-Za-zÀ-ÿ0-9][^☒☐☑\[\(\r\n]{0,40})/gi;

    type RawCheckboxCellHit = {
      rowIndex: number;
      physicalCellIndex: number;
      coord: string;
      promptCandidate: string;
      options: Array<{
        label: string;
        coord: string;
        checked: boolean;
        raw_text: string;
      }>;
    };

    const hits: RawCheckboxCellHit[] = [];

    for (let rIdx = 0; rIdx < tbl.rows.length; rIdx++) {
      const row = tbl.rows[rIdx];
      const physicalCells = row.cells.filter((c) => !c.isSpanPlaceholder);
      let rowPromptCandidate = "";

      for (const c of physicalCells) {
        const t = c.text.trim().replace(/\r?\n/g, " ");
        if (
          t &&
          !/[☒☑☐◻□]|\[\s*[xX ]?\s*\]/.test(t) &&
          t.length >= 4 &&
          !rowPromptCandidate
        ) {
          rowPromptCandidate = t;
        }
      }

      for (const cell of physicalCells) {
        if (cell.rowSpan === "continue") continue;
        const rawText = cell.text.trim();
        if (!rawText) continue;

        const physIdx = cell.physicalCellIndex ?? cell.cellIndex;
        const coord = `T${tbl.index}.R${row.rowIndex}.C${physIdx}`;
        const cellOptions: RawCheckboxCellHit["options"] = [];

        let match: RegExpExecArray | null;
        checkboxTokenRegex.lastIndex = 0;
        while ((match = checkboxTokenRegex.exec(rawText)) !== null) {
          const isChecked = Boolean(match[1] || match[3] || match[5]);
          const labelRaw = (match[7] || "").trim().replace(/[.;,:]+$/, "");
          if (!labelRaw) continue;
          cellOptions.push({
            label: labelRaw,
            coord,
            checked: isChecked,
            raw_text: match[0].trim(),
          });
        }

        if (cellOptions.length > 0) {
          hits.push({
            rowIndex: row.rowIndex,
            physicalCellIndex: physIdx,
            coord,
            promptCandidate:
              rowPromptCandidate || `T${tbl.index}.R${row.rowIndex}`,
            options: cellOptions,
          });
        }
      }
    }

    let hIdx = 0;
    while (hIdx < hits.length) {
      const curr = hits[hIdx];
      const combinedOptions = [...curr.options];
      let prompt = curr.promptCandidate;

      while (hIdx + 1 < hits.length) {
        const next = hits[hIdx + 1];
        const sameRow = next.rowIndex === curr.rowIndex;
        const adjRow =
          next.rowIndex === curr.rowIndex + 1 &&
          curr.options.length === 1 &&
          next.options.length === 1 &&
          /^(?:sim|n[ãa]o)$/i.test(curr.options[0].label) &&
          /^(?:sim|n[ãa]o)$/i.test(next.options[0].label);

        if (sameRow || adjRow) {
          combinedOptions.push(...next.options);
          if (
            (!prompt || prompt.startsWith(`T${tbl.index}.R`)) &&
            next.promptCandidate &&
            !next.promptCandidate.startsWith(`T${tbl.index}.R`)
          ) {
            prompt = next.promptCandidate;
          }
          hIdx++;
        } else {
          break;
        }
      }

      checkboxes.push({
        table_index: tbl.index,
        prompt: prompt.length > 120 ? `${prompt.slice(0, 117)}...` : prompt,
        options: combinedOptions,
      });
      hIdx++;
    }
  }

  return { subtables, checkboxes };
}
