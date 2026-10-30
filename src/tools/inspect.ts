import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { resolve, dirname, basename, relative, isAbsolute } from "node:path";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import {
  getAllElements,
  getDirectChildElements,
  extractParagraphStyle,
  extractParagraphText,
  extractParagraphNumbering,
  extractCellText,
  extractCellGridSpan,
  extractCellVMerge,
  createNumberingResolver,
  sanitizeXmlString,
} from "../utils/xml.ts";
import {
  computeStructureFingerprint,
  findBestTemplateMatch,
  reanchorSlotsManifest,
  extractCacheTemporalMetadata,
} from "../core/registry.ts";
import { isPdfBuffer, extractPdfPages } from "../utils/pdf.ts";
import { detectFileTypeSync } from "../utils/archives.ts";
import {
  buildPdfCartography,
  buildDocxCartography,
  renderCartographyMarkdownBlock,
  generateHotspotsDossierMarkdown,
  type IndexedLineEntry,
} from "../core/cartography.ts";
import {
  auditDocumentBudget,
  injectBudgetAuditIntoImpugnationZones,
  formatBudgetAuditMarkdownBlock,
  formatCentsToCurrency,
} from "../core/budget_auditor.ts";
import {
  computeStructuralDiff,
  generateDiffReportMarkdown,
} from "../core/structural_diff.ts";
import {
  parseXlsxBuffer,
  parseCsvBuffer,
  generateSpreadsheetLinearAuditViewMarkdown,
  generateSpreadsheetHotspotsDossierMarkdown,
} from "../parsers/spreadsheet.ts";
import { VERSION } from "../constants/index.ts";
import {
  resolveExistingPathNfc,
  isValidDocGovCaseScope,
  getEphemeralInspectDir,
} from "../utils/paths.ts";
import type {
  BodyParagraphInfo,
  TableInfo,
  TableRowInfo,
  TableCellInfo,
  DocxTocMap,
  TocParagraphItem,
  TocFormCellItem,
  TocTableItem,
  DocxInspectionResult,
  HeaderFooterParagraphInfo,
  TemplateMatchResult,
  InspectDocSyntheticResult,
  InspectDocxSyntheticResult,
  PdfExtractionResult,
  DocumentCartography,
  DetectedItemSubtable,
  DetectedCheckboxGroup,
  PostCompileIntegrityAlert,
} from "../types/index.ts";

// ============================================================================
// Mapeamento Estrutural e Sumário (TOC Map & Compact Inspection)
// ============================================================================

export function buildTocMap(
  paragraphs: BodyParagraphInfo[],
  tables: TableInfo[]
): DocxTocMap {
  const sections: TocParagraphItem[] = [];
  const form_fields: TocFormCellItem[] = [];
  const tocTables: TocTableItem[] = [];

  // 1. Mapeamento de Títulos e Seções em Parágrafos
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const text = p.text.trim();
    if (!text || text.length > 150) continue;

    const hasHeadingStyle =
      p.style !== null &&
      /^(?:Heading|Titulo|Título|T[ií]tulo|Header|Se[çc][ãa]o)/i.test(p.style);

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
      sections.push({
        coord: `P${p.index}`,
        title: text,
        suggested_target_slot:
          i + 1 < paragraphs.length ? `P${paragraphs[i + 1].index}` : undefined,
      });
    }
  }

  // 2. Mapeamento de Campos e Perguntas em Tabelas de Formulário
  for (const tbl of tables) {
    for (let rIdx = 0; rIdx < tbl.rows.length; rIdx++) {
      const row = tbl.rows[rIdx];
      const physicalCells = row.cells.filter((c) => !c.isSpanPlaceholder);
      for (let cIdx = 0; cIdx < physicalCells.length; cIdx++) {
        const cell = physicalCells[cIdx];
        // Células mescladas verticalmente como continuação não devem ser novos form_fields
        if (cell.rowSpan === "continue") continue;
        const txt = cell.text.trim();
        if (!txt || txt.length > 250) continue;

        const isCheckboxText =
          txt.length <= 35 &&
          /^(?:[☐☑☒\u2610\u2611\u2612]|\[[\sxX]\]|\(x\)|\(\s*\)|sim\b|n[ãa]o\b|optante\b|n[ãa]o\s+optante\b|exclusiv[ao]\b|ampla\s+concorr[êe]ncia\b)/i.test(
            txt
          );

        if (
          isCheckboxText &&
          (cell.colSpan ?? 1) <= 2 &&
          cIdx + 1 < physicalCells.length
        ) {
          const nextCell = physicalCells[cIdx + 1];
          if (
            (nextCell.colSpan ?? 1) >= 3 ||
            physicalCells.length <= 3 ||
            cIdx === 1
          ) {
            const currentPhysIdx = cell.physicalCellIndex ?? cell.cellIndex;
            const nextPhysIdx = nextCell.physicalCellIndex ?? nextCell.cellIndex;
            const targetCoord = `T${tbl.index}.R${row.rowIndex}.C${nextPhysIdx}`;

            form_fields.push({
              coord: `T${tbl.index}.R${row.rowIndex}.C${currentPhysIdx}`,
              title: `[Checkbox Curto] ${txt}`,
              suggested_target_slot: targetCoord,
            });

            form_fields.push({
              coord: targetCoord,
              title: `[Texto Discursivo / Especificar] ${
                nextCell.text.trim().slice(0, 50) || "(vazio)"
              }`,
            });
            cIdx++;
            continue;
          }
        }

        const isQuestion = txt.endsWith("?") || txt.includes("?");
        const isLabel =
          txt.endsWith(":") && txt.length <= 100 && !txt.includes("\n");
        const isNumberedPrompt =
          /^\d+(\.\d+)*\s+[A-ZÀ-Ú]/i.test(txt) && txt.length <= 100;
        const isTwoColKey =
          physicalCells.length === 2 &&
          cIdx === 0 &&
          txt.length <= 100 &&
          !txt.includes("\n");

        if (isQuestion || isLabel || isNumberedPrompt || isTwoColKey) {
          let suggestedTarget: string | undefined;
          const currentPhysIdx = cell.physicalCellIndex ?? cell.cellIndex;

          // Se houver célula física adjacente à direita na mesma linha
          if (cIdx + 1 < physicalCells.length) {
            const nextCell = physicalCells[cIdx + 1];
            const nextPhysIdx = nextCell.physicalCellIndex ?? nextCell.cellIndex;
            suggestedTarget = `T${tbl.index}.R${row.rowIndex}.C${nextPhysIdx}`;
          } else if (rIdx + 1 < tbl.rows.length) {
            // Se for coluna única, o alvo costuma ser a linha imediatamente abaixo
            const nextRow = tbl.rows[rIdx + 1];
            const nextPhysicalCells = nextRow.cells.filter((c) => !c.isSpanPlaceholder);
            const targetCell =
              nextPhysicalCells.find((c) => (c.physicalCellIndex ?? c.cellIndex) === currentPhysIdx) ??
              nextPhysicalCells[0];
            if (targetCell) {
              const targetPhysIdx = targetCell.physicalCellIndex ?? targetCell.cellIndex;
              suggestedTarget = `T${tbl.index}.R${nextRow.rowIndex}.C${targetPhysIdx}`;
            }
          }

          form_fields.push({
            coord: `T${tbl.index}.R${row.rowIndex}.C${currentPhysIdx}`,
            title: txt.length > 120 ? `${txt.slice(0, 117)}...` : txt,
            ...(suggestedTarget ? { suggested_target_slot: suggestedTarget } : {}),
          });
        }
      }
    }

    // 3. Resumo Estrutural das Tabelas
    const rowsCount = tbl.rows.length;
    let maxCols = 0;
    for (const r of tbl.rows) {
      if (r.cells.length > maxCols) maxCols = r.cells.length;
    }

    const firstRowCells = tbl.rows[0]?.cells ?? [];
    const headers = firstRowCells
      .map((c) => c.text.trim().replace(/\r?\n/g, " "))
      .filter((t) => t.length > 0);

    tocTables.push({
      table_index: tbl.index,
      rows: rowsCount,
      cols: maxCols,
      headers,
      sample_row_coord: rowsCount > 1 ? `T${tbl.index}.R1` : undefined,
    });
  }

  return {
    sections,
    form_fields,
    tables: tocTables,
  };
}

export function compactInspectionResult(
  full: DocxInspectionResult
): DocxInspectionResult {
  return {
    ...(full.doc_type ? { doc_type: full.doc_type } : {}),
    ...(full.page_count !== undefined ? { page_count: full.page_count } : {}),
    ...(full.line_count !== undefined ? { line_count: full.line_count } : {}),
    ...(full.outline_headings
      ? { outline_headings: full.outline_headings }
      : {}),
    ...(full.page_signals ? { page_signals: full.page_signals } : {}),
    ...(full.impugnation_zones
      ? { impugnation_zones: full.impugnation_zones }
      : {}),
    ...(full.toc_map ? { toc_map: full.toc_map } : {}),
    ...(full.detected_subtables && full.detected_subtables.length > 0
      ? { detected_subtables: full.detected_subtables }
      : {}),
    ...(full.detected_checkboxes && full.detected_checkboxes.length > 0
      ? { detected_checkboxes: full.detected_checkboxes }
      : {}),
    ...(full.post_compile_alerts && full.post_compile_alerts.length > 0
      ? { post_compile_alerts: full.post_compile_alerts }
      : {}),
    ...(full.structure_fingerprint
      ? { structure_fingerprint: full.structure_fingerprint }
      : {}),
    ...(full.template_match ? { template_match: full.template_match } : {}),
    ...(full.audit_view_path ? { audit_view_path: full.audit_view_path } : {}),
    headers: full.headers.filter((h) => h.text.trim() !== ""),
    footers: full.footers.filter((f) => f.text.trim() !== ""),
    paragraphs: full.paragraphs.filter((p) => p.text.trim() !== ""),
    tables: full.tables.map((t) => ({
      index: t.index,
      rows: t.rows
        .map((r) => ({
          rowIndex: r.rowIndex,
          cells: r.cells.filter((c) => c.text.trim() !== ""),
        }))
        .filter((r) => r.cells.length > 0),
    })),
  };
}

// ============================================================================
// Detector de Subtabelas de Itens, Checkboxes e Scanner Anti-Contaminação (ENG-07b / ENG-08)
// ============================================================================

export function detectTableSubtablesAndCheckboxes(tables: TableInfo[]): {
  subtables: DetectedItemSubtable[];
  checkboxes: DetectedCheckboxGroup[];
} {
  const subtables: DetectedItemSubtable[] = [];
  const checkboxes: DetectedCheckboxGroup[] = [];

  for (const tbl of tables) {
    // 1. Detecção de Subtabelas de Itens Numerados Sequencialmente (1, 2, 3... N)
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

      // Verifica se alguma das primeiras 2 células ativas (ou a célula logo após um vMerge lateral) é um índice numérico de item
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
          // Início de nova sequência (preferencialmente começando em 1)
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
        // Verifica se é uma linha de item residual onde o usuário/agente escreveu "Item não aplicável" mantendo a mesma estrutura de colunas da subtabela ativa
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

    // 2. Detecção de Checkboxes (☒ / ☐ / [X] / [ ]) com Coordenadas Físicas
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

    // Agrupa hits que pertençam à mesma pergunta (mesma linha ou linhas adjacentes Sim/Não)
    let hIdx = 0;
    while (hIdx < hits.length) {
      const curr = hits[hIdx];
      const combinedOptions = [...curr.options];
      let prompt = curr.promptCandidate;

      // Se este hit tem apenas 1 opção (ex.: "Sim") e o próximo hit está na mesma linha ou na linha imediatamente seguinte com "Não"
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

export function scanPostCompileIntegrityAlerts(
  inspection: DocxInspectionResult
): PostCompileIntegrityAlert[] {
  const alerts: PostCompileIntegrityAlert[] = [];

  // 1. Detecção de "Item não aplicável" / workarounds de linhas excedentes não removidas (ENG-07 / ENG-08)
  const workaroundRegex =
    /\b(?:item\s+n[ãa]o\s+aplic[áa]vel|n[ãa]o\s+aplic[áa]vel\s+ao\s+escopo|item\s+suprimido|linha\s+n[ãa]o\s+utilizada)\b/i;

  for (const tbl of inspection.tables || []) {
    const affectedRows: number[] = [];
    const affectedCoords: string[] = [];
    for (const r of tbl.rows) {
      const physicalCells = r.cells.filter((c) => !c.isSpanPlaceholder);
      for (const c of physicalCells) {
        if (c.rowSpan === "continue") continue;
        if (workaroundRegex.test(c.text)) {
          affectedRows.push(r.rowIndex);
          affectedCoords.push(
            `T${tbl.index}.R${r.rowIndex}.C${c.physicalCellIndex ?? c.cellIndex}`
          );
          break;
        }
      }
    }
    if (affectedRows.length > 0) {
      const minRow = Math.min(...affectedRows);
      const maxRow = Math.max(...affectedRows);
      alerts.push({
        code: "UNREMOVED_ITEM_WORKAROUND",
        severity: "CRITICAL",
        coords: affectedCoords.slice(0, 8),
        message: `Detectadas ${affectedRows.length} linha(s) de tabela preenchidas com workaround textual ("Item não aplicável") em T${tbl.index}.R${minRow}..R${maxRow} em vez de exclusão física da linha.`,
        remediation_hint: `Adicione "remove_table_rows": [{ "table_index": ${tbl.index}, "from_row": ${minRow}, "to_row": ${maxRow} }] no slots_manifest.json e regere o template com build_docx_template.`,
      });
    }
  }

  // 2. Detecção de tabelas Markdown residuais não convertidas (| :--- |)
  const rawMdCoords: string[] = [];
  const rawMdSeparatorRegex = /\|\s*:?-{3,}:?\s*\|/;
  for (const p of inspection.paragraphs || []) {
    if (rawMdSeparatorRegex.test(p.text)) {
      rawMdCoords.push(`P${p.index}`);
    }
  }
  for (const tbl of inspection.tables || []) {
    for (const r of tbl.rows) {
      for (const c of r.cells.filter((cell) => !cell.isSpanPlaceholder)) {
        if (c.rowSpan === "continue") continue;
        if (rawMdSeparatorRegex.test(c.text)) {
          rawMdCoords.push(
            `T${tbl.index}.R${r.rowIndex}.C${c.physicalCellIndex ?? c.cellIndex}`
          );
        }
      }
    }
  }
  if (rawMdCoords.length > 0) {
    alerts.push({
      code: "RAW_MARKDOWN_TABLE",
      severity: "CRITICAL",
      coords: rawMdCoords.slice(0, 8),
      message: `Detectada sintaxe de tabela Markdown crua ('| :--- |') não convertida em OpenXML <w:tbl> nas coordenadas: ${rawMdCoords.slice(0, 5).join(", ")}.`,
      remediation_hint: `Garanta que a tabela Markdown possua linha de cabeçalho e linha separadora '| :--- | :--- |' contíguas e reprocesse via fill_docx_template.`,
    });
  }

  // 3. Detecção de Checkboxes Contraditórios (☒ Sim e ☒ Não marcados juntos, ou ambos ☐ em documento compilado)
  const allDocText = [
    ...(inspection.paragraphs || []).map((p) => p.text),
    ...(inspection.tables || []).flatMap((t) =>
      t.rows.flatMap((r) =>
        r.cells.filter((c) => !c.isSpanPlaceholder).map((c) => c.text)
      )
    ),
  ].join("\n");
  const hasUncompiledTags = /\{\{[A-Z0-9_]+\}\}/.test(allDocText);

  const checkboxes =
    inspection.detected_checkboxes ??
    detectTableSubtablesAndCheckboxes(inspection.tables || []).checkboxes;

  for (const group of checkboxes) {
    const simOpt = group.options.find((o) => /^sim$/i.test(o.label));
    const naoOpt = group.options.find((o) => /^n[ãa]o$/i.test(o.label));
    if (simOpt && naoOpt) {
      if (simOpt.checked && naoOpt.checked) {
        alerts.push({
          code: "CONTRADICTORY_CHECKBOXES",
          severity: "CRITICAL",
          coords: Array.from(new Set([simOpt.coord, naoOpt.coord])),
          message: `Checkboxes contraditórios marcados simultaneamente (☒ Sim e ☒ Não) para '${group.prompt}' (${simOpt.coord} e ${naoOpt.coord}).`,
          remediation_hint: `Mapeie ambas as coordenadas físicas (${simOpt.coord} e ${naoOpt.coord}) no slots_manifest.json e desmarque a opção incorreta com '☐'.`,
        });
      } else if (!simOpt.checked && !naoOpt.checked && !hasUncompiledTags) {
        alerts.push({
          code: "CONTRADICTORY_CHECKBOXES",
          severity: "HIGH",
          coords: Array.from(new Set([simOpt.coord, naoOpt.coord])),
          message: `Grupo de checkboxes (☐ Sim / ☐ Não) sem nenhuma opção assinalada para '${group.prompt}' (${simOpt.coord} e ${naoOpt.coord}).`,
          remediation_hint: `Assinale '☒ Sim' ou '☒ Não' na coordenada física correspondente (${simOpt.coord} ou ${naoOpt.coord}).`,
        });
      }
    }
  }

  // 4. Detecção de Contaminação Semântica de Doador de Hardware (ENG-08 com Refinamento de 2 Pontas)
  // Coleta o texto do Objeto principal (parágrafos de Objeto ou linhas iniciais T0.R0..R12 da tabela resumo)
  const objectSegments: string[] = [];
  for (let i = 0; i < (inspection.paragraphs || []).length; i++) {
    const p = inspection.paragraphs[i];
    if (/objeto|descri[çc][ãa]o\s+da\s+solu[çc][ãa]o|especifica[çc][ãa]o\s+do\s+objeto/i.test(p.text)) {
      objectSegments.push(p.text);
      if (i + 1 < inspection.paragraphs.length) {
        objectSegments.push(inspection.paragraphs[i + 1].text);
      }
    }
  }
  if ((inspection.tables || []).length > 0) {
    const t0 = inspection.tables[0];
    for (const r of t0.rows.slice(0, 12)) {
      const rowTxt = r.cells
        .filter((c) => !c.isSpanPlaceholder && c.rowSpan !== "continue")
        .map((c) => c.text.trim())
        .join(" ");
      if (
        /1\.1\b|objeto|natureza|descri[çc][ãa]o|subscri[çc][ãa]o|licenciamento|software|equipamento|appliance|servidor/i.test(
          rowTxt
        )
      ) {
        objectSegments.push(rowTxt);
      }
    }
  }

  const objectCorpus =
    objectSegments.length > 0
      ? objectSegments.join(" ")
      : (inspection.paragraphs || [])
          .slice(0, 10)
          .map((p) => p.text)
          .join(" ");

  const hasSoftwareServiceObject =
    /\b(?:subscri[çc][ãa]o|subscri[çc][õo]es|licen[çc]a|licenciamento|software|saas|paas|red\s*hat|openshift|ansible|rhel|treinamento|capacita[çc][ãa]o|suporte\s+t[ée]cnico|consultoria|ust|uns)\b/i.test(
      objectCorpus
    );
  const hasHardwareInObject =
    /\b(?:servidor(?:es)?\s+f[ií]sico|appliance(?:s)?|equipamento(?:s)?\s+de\s+inform[áa]tica|switch(?:es)?|storage\s+f[ií]sico|rack|chassi|blade|hci|hiperconverg[êe]n|nutanix|exagrid|fonte\s+redundante|gabinete)\b/i.test(
      objectCorpus
    );

  const isPureSoftwareServiceObject =
    hasSoftwareServiceObject && !hasHardwareInObject;

  const hardwareDonorTermsRegex =
    /\b(?:RoHS|merc[úu]rio|chumbo|c[áa]dmio|Portaria\s+n[º°]?\s*170|INMETRO|ANATEL|NVMe|DDR4|DDR5|SFP\+|escassez\s+global\s+de\s+chips|Next\s+Business\s+Day|Nvidia\s+RTX)\b/i;

  const isRedHatDoc = /\b(?:Red\s*Hat|OpenShift|RHEL|Ansible)\b/i.test(allDocText);
  const specificDonorLeakRegex = isRedHatDoc
    ? /(?:ARP\s*(?:N[º°]?\s*)?90015\/2024|R\$\s*68\.776\.988,00|\bPAN-OS\b|\bCollector\b)/i
    : /(?:ARP\s*(?:N[º°]?\s*)?90015\/2024|R\$\s*68\.776\.988,00)/i;

  const contaminatedCoords: string[] = [];
  const matchedTerms = new Set<string>();

  const inspectSegmentForContamination = (coord: string, text: string) => {
    if (!text) return;
    if (isPureSoftwareServiceObject) {
      const mHw = text.match(hardwareDonorTermsRegex);
      if (mHw) {
        contaminatedCoords.push(coord);
        matchedTerms.add(mHw[0]);
      }
    }
    const mLeak = text.match(specificDonorLeakRegex);
    if (mLeak) {
      if (!contaminatedCoords.includes(coord)) contaminatedCoords.push(coord);
      matchedTerms.add(mLeak[0]);
    }
  };

  for (const p of inspection.paragraphs || []) {
    inspectSegmentForContamination(`P${p.index}`, p.text);
  }
  for (const tbl of inspection.tables || []) {
    for (const r of tbl.rows) {
      for (const c of r.cells.filter((cell) => !cell.isSpanPlaceholder)) {
        if (c.rowSpan === "continue") continue;
        inspectSegmentForContamination(
          `T${tbl.index}.R${r.rowIndex}.C${c.physicalCellIndex ?? c.cellIndex}`,
          c.text
        );
      }
    }
  }

  // Ponta (b) adicional: contradição interna direta ("possui equipamentos/bens de informática (hardware)" vs "natureza estritamente intangível")
  const hasHardwareAffirmation =
    /possui\s+(?:equipamentos|bens\s+de\s+inform[áa]tica)\s*\(?hardware\)?|aquisi[çc][ãa]o\s+de\s+equipamentos\s*\(?hardware\)?/i.test(
      allDocText
    );
  const hasStrictIntangibleAffirmation =
    /natureza\s+estritamente\s+intang[ií]vel|exclusivamente\s+de\s+software\s+e\s+servi[çc]os\s+intang[ií]veis/i.test(
      allDocText
    );

  if (hasHardwareAffirmation && hasStrictIntangibleAffirmation) {
    matchedTerms.add(
      "Contradição interna: afirmação de 'hardware/equipamentos' coexistindo com 'natureza estritamente intangível'"
    );
  }

  if (contaminatedCoords.length > 0 || (hasHardwareAffirmation && hasStrictIntangibleAffirmation)) {
    alerts.push({
      code: "HARDWARE_DONOR_CONTAMINATION",
      severity: "CRITICAL",
      coords: contaminatedCoords.slice(0, 10),
      message: `Detectado vazamento de vocabulário de minuta doadora de Hardware/Ata externa em contratação de Software/Serviços (${Array.from(
        matchedTerms
      )
        .slice(0, 6)
        .join(", ")}) nas coordenadas: ${
        contaminatedCoords.slice(0, 6).join(", ") || "corpo do documento"
      }.`,
      remediation_hint: `Mapeie todas as células/parágrafos residuais listados acima no slots_manifest.json e substitua o texto herdado do modelo doador pelo conteúdo aderente ao objeto da contratação.`,
    });
  }

  // 5. Detecção de Contaminação Parcial em Linhas de Itens (ENG-13: PARTIAL_ITEM_ROW_CONTAMINATION)
  const itemRowContaminatedCoords: string[] = [];
  const itemRowMatchedTerms = new Set<string>();
  const hardwareUnitRegex = /\b(?:servidor(?:es)?|GB|TB|Rack|chassi|blade|gabinete)\b/i;
  const softwareItemRegex = /\b(?:UNS|UST|Subscri[çc][ãa]o|Licen[çc]a|Software|RHEL|OpenShift|Ansible)\b/i;

  for (const tbl of inspection.tables || []) {
    for (const r of tbl.rows) {
      const physicalCells = r.cells.filter(
        (c) => !c.isSpanPlaceholder && c.rowSpan !== "continue"
      );
      if (physicalCells.length < 3) continue;

      const hasSoftware = physicalCells.some((c) => softwareItemRegex.test(c.text));
      if (!hasSoftware) continue;

      for (const c of physicalCells) {
        if (c.text.trim().length <= 25 && hardwareUnitRegex.test(c.text)) {
          const m = c.text.match(hardwareUnitRegex);
          if (m) {
            itemRowContaminatedCoords.push(
              `T${tbl.index}.R${r.rowIndex}.C${c.physicalCellIndex ?? c.cellIndex}`
            );
            itemRowMatchedTerms.add(m[0]);
          }
        }
      }
    }
  }

  if (itemRowContaminatedCoords.length > 0) {
    alerts.push({
      code: "PARTIAL_ITEM_ROW_CONTAMINATION",
      severity: "HIGH",
      coords: itemRowContaminatedCoords.slice(0, 10),
      message: `Detectada contaminação parcial em linha de item: células de unidade/métrica contêm resíduo de hardware (${Array.from(
        itemRowMatchedTerms
      ).join(", ")}) em item de software/serviço nas coordenadas: ${itemRowContaminatedCoords
        .slice(0, 6)
        .join(", ")}.`,
      remediation_hint: `Substitua a unidade de hardware do doador pela métrica de software contratada (ex.: UNS, UST, Subscrição, Mês) no slots_manifest.json.`,
    });
  }

  // 6. Detecção de Linhas de Total Geral Zeradas ou Indefinidas (ENG-13: UNCALCULATED_TOTAL_ROW)
  for (const tbl of inspection.tables || []) {
    let hasNonZeroItems = false;
    let totalRowCoord: string | undefined;

    for (const r of tbl.rows) {
      const rowText = r.cells
        .filter((c) => !c.isSpanPlaceholder && c.rowSpan !== "continue")
        .map((c) => c.text.trim())
        .join(" ");

      const isTotalRow = /\b(?:TOTAL\s+GERAL|VALOR\s+TOTAL(?:\s+GERAL)?|TOTAL\s+GLOBAL)\b/i.test(
        rowText
      );

      if (isTotalRow) {
        const isZeroOrUndefined =
          /R\$\s*0(?:,00)?\b|\b0,00\b|\[A\s+DEFINIR\]|\bA\s+DEFINIR\b/i.test(
            rowText
          );
        if (isZeroOrUndefined) {
          totalRowCoord = `T${tbl.index}.R${r.rowIndex}`;
        }
      } else {
        if (
          /R\$\s*[1-9]\d*(?:[.,]\d{2})?|\b(?:UNS|UST|Subscri[çc][ãa]o)\b/i.test(
            rowText
          )
        ) {
          hasNonZeroItems = true;
        }
      }
    }

    if (totalRowCoord && hasNonZeroItems) {
      alerts.push({
        code: "UNCALCULATED_TOTAL_ROW",
        severity: "HIGH",
        coords: [totalRowCoord],
        message: `Linha de total ${totalRowCoord} está zerada ou indefinida (R$ 0,00 / [A DEFINIR]), divergindo do somatório dos itens da tabela.`,
        remediation_hint: `Calcule o somatório total dos itens no estado_caso.json ou slots_manifest.json para que a linha de Total Geral reflita o valor real da contratação.`,
      });
    }
  }

  return alerts;
}

export function generatePdfLinearAuditViewMarkdown(
  docName: string,
  extraction: PdfExtractionResult,
  cartography: DocumentCartography
): string {
  const lines: string[] = [];
  lines.push(`# Visão Linear de Auditoria: ${docName}`);
  lines.push(
    `> Espelho estrutural paginado gerado por docgov-engine v${VERSION} (${extraction.pageCount} página(s), ${extraction.lineCount} linha(s)).`
  );
  if (
    extraction.scanned_pages_detected &&
    extraction.scanned_pages_detected.length > 0
  ) {
    if (extraction.ocr_applied && extraction.ocr_pages && extraction.ocr_pages.length > 0) {
      lines.push(
        `> 🔍 **PIPELINE OCR HEADLESS APLICADO (Marco 5.3):** Texto recuperado com sucesso nas página(s) escaneada(s): ${extraction.ocr_pages.join(
          ", "
        )}.`
      );
    } else {
      lines.push(
        `> ⚠️ **ALERTA CRÍTICO: DETECTADA(S) PÁGINA(S) ESCANEADA(S) COMO IMAGEM — SEM CAMADA DE TEXTO EXTRAÍVEL:** Página(s) ${extraction.scanned_pages_detected.join(
          ", "
        )}.`
      );
    }
  }
  lines.push("");

  // Bloco 1: Mapa Cartográfico Estrutural + Radar das 14 Zonas de Impugnação
  lines.push(...renderCartographyMarkdownBlock(cartography));

  // Bloco 2: Conteúdo Integral Paginado [PAG_XXX | LYYYY]
  lines.push("## Bloco 2: Conteúdo Integral Paginado");
  lines.push("");

  const headingCoords = new Set(
    cartography.outline_headings.map((h) => h.coord)
  );
  const scannedSet = new Set(extraction.scanned_pages_detected || []);

  for (const page of extraction.pages) {
    lines.push(
      `### Página ${String(page.pageNumber).padStart(3, "0")}`
    );
    if (scannedSet.has(page.pageNumber)) {
      lines.push(
        "- **[ALERTA CRÍTICO: PÁGINA ESCANEADA COMO IMAGEM — SEM CAMADA DE TEXTO EXTRAÍVEL]**"
      );
    }
    if (page.lines.length === 0) {
      if (!scannedSet.has(page.pageNumber)) {
        lines.push("- *(Página sem texto extraível)*");
      }
    } else {
      for (const l of page.lines) {
        if (headingCoords.has(l.bracket_coord)) {
          lines.push(`- **${l.bracket_coord}** ${l.text}`);
        } else {
          lines.push(`- ${l.bracket_coord} ${l.text}`);
        }
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

export function generateLinearAuditViewMarkdown(
  docName: string,
  inspection: DocxInspectionResult
): string {
  const lines: string[] = [];
  lines.push(`# Visão Linear de Auditoria: ${docName.normalize("NFC")}`);
  lines.push(
    `> Espelho estrutural gerado por docgov-docx v${VERSION} para leitura integral em turno único.`
  );
  lines.push("");

  // Alertas de Integridade Pós-Compilação e Anti-Contaminação de Doador (ENG-08)
  const postCompileAlerts =
    inspection.post_compile_alerts ??
    scanPostCompileIntegrityAlerts(inspection);

  if (postCompileAlerts.length > 0) {
    lines.push(
      "## ⚠️ ALERTAS DE INTEGRIDADE PÓS-COMPILAÇÃO (AÇÃO OBRIGATÓRIA DO AUDITOR)"
    );
    lines.push(
      "> O scanner determinístico de integridade detectou anomalias estruturais ou contaminação de vocabulário de minuta doadora que exigem correção imediata:"
    );
    lines.push("");
    for (const alert of postCompileAlerts) {
      lines.push(
        `- **[${alert.severity} | \`${alert.code}\`]** ${alert.message}`
      );
      if (alert.coords.length > 0) {
        lines.push(
          `  - **Coordenadas Afetadas:** ${alert.coords
            .map((c) => `\`${c}\``)
            .join(", ")}`
        );
      }
      lines.push(`  - **Ação Corretiva:** ${alert.remediation_hint}`);
    }
    lines.push("");
  }

  // Bloco 1: Mapa Cartográfico Estrutural + Radar das 14 Zonas de Impugnação
  const cartography: DocumentCartography =
    inspection.outline_headings &&
    inspection.page_signals &&
    inspection.impugnation_zones
      ? {
          outline_headings: inspection.outline_headings,
          page_signals: inspection.page_signals,
          impugnation_zones: inspection.impugnation_zones,
        }
      : buildDocxCartography(
          inspection.paragraphs || [],
          inspection.tables || [],
          inspection.toc_map
        );

  lines.push(...renderCartographyMarkdownBlock(cartography));

  // Subseções de Template Match e Form Fields (ENG-04)
  if (inspection.template_match) {
    const tm = inspection.template_match;
    lines.push("### Diagnóstico de Cache de Template (template_match)");
    lines.push(
      `- **Status:** \`${tm.status}\` (${Math.round(
        tm.similarity * 100
      )}% de similaridade)`
    );
    if (tm.template_id) {
      lines.push(`- **Template Base:** \`${tm.template_id}\``);
    }
    if (tm.adapted_manifest_path) {
      lines.push(
        `- **Manifesto Adaptado:** \`${toShortDocPath(tm.adapted_manifest_path)}\``
      );
    }
    if (tm.shift_summary) {
      lines.push(`- **Reancoragem:** ${tm.shift_summary}`);
    }
    lines.push(`- **Mensagem:** ${tm.message || "Template processado."}`);
    lines.push("");
  }

  if (
    inspection.toc_map?.form_fields &&
    inspection.toc_map.form_fields.length > 0
  ) {
    lines.push(
      "### Campos de Formulário e Coordenadas Físicas Sugeridas (toc_map.form_fields)"
    );
    for (const ff of inspection.toc_map.form_fields) {
      const target = ff.suggested_target_slot
        ? ` -> Coordenada alvo física: \`${ff.suggested_target_slot}\``
        : "";
      lines.push(`- [\`${ff.coord}\`] ${ff.title}${target}`);
    }
    lines.push("");
  }

  // Subtabelas de Itens e Checkboxes Detectados (ENG-07b)
  const detectedSubtables =
    inspection.detected_subtables ??
    detectTableSubtablesAndCheckboxes(inspection.tables || []).subtables;
  const detectedCheckboxes =
    inspection.detected_checkboxes ??
    detectTableSubtablesAndCheckboxes(inspection.tables || []).checkboxes;

  if (detectedSubtables.length > 0 || detectedCheckboxes.length > 0) {
    lines.push("### Subtabelas de Itens e Checkboxes Detectados");
    for (const sub of detectedSubtables) {
      const hdrStr =
        sub.header_row !== undefined ? ` (Cabeçalho: R${sub.header_row})` : "";
      lines.push(
        `- **[Subtabela \`T${sub.table_index}\` | \`R${sub.start_row}..R${sub.end_row}\`]** ${sub.label}${hdrStr} — **${sub.item_count} itens numerados**.`
      );
      lines.push(
        `  - 💡 *Poda de Linhas Excedentes:* Se a contratação possuir menos de ${sub.item_count} itens, **NUNCA** preencha as linhas restantes com "Item não aplicável". Remova as linhas excedentes no \`slots_manifest.json\` usando: \`"remove_table_rows": [{ "table_index": ${sub.table_index}, "from_row": <primeira_linha_excedente>, "to_row": ${sub.end_row} }]\`.`
      );
    }
    for (const cb of detectedCheckboxes) {
      const optsSummary = cb.options
        .map(
          (o) =>
            `${o.checked ? "☒" : "☐"} ${o.label} (\`${o.coord}\`)`
        )
        .join(" | ");
      lines.push(
        `- **[Checkboxes \`T${cb.table_index}\`]** ${cb.prompt} -> ${optsSummary}`
      );
    }
    lines.push("");
  }

  // Bloco 2: Conteúdo Integral do Documento (.docx)
  lines.push("## Bloco 2: Conteúdo Integral Estruturado");
  lines.push("");

  // 1. Cabeçalhos e Rodapés
  const hasHf =
    (inspection.headers && inspection.headers.length > 0) ||
    (inspection.footers && inspection.footers.length > 0);
  if (hasHf) {
    lines.push("## Cabeçalhos e Rodapés");
    if (inspection.headers) {
      for (const h of inspection.headers) {
        if (h.text.trim()) {
          lines.push(`- [H${h.paragraphIndex}] ${h.text.trim()}`);
        }
      }
    }
    if (inspection.footers) {
      for (const f of inspection.footers) {
        if (f.text.trim()) {
          lines.push(`- [F${f.paragraphIndex}] ${f.text.trim()}`);
        }
      }
    }
    lines.push("");
  }

  // 2. Parágrafos e Seções
  if (inspection.paragraphs && inspection.paragraphs.length > 0) {
    lines.push("## Parágrafos e Seções");
    for (const p of inspection.paragraphs) {
      const txt = p.text.trim();
      if (!txt) continue;
      const isHeading = inspection.toc_map?.sections.some(
        (s) => s.coord === `P${p.index}`
      );
      if (isHeading) {
        lines.push(`- **[P${p.index}]** ${txt}`);
      } else {
        lines.push(`- [P${p.index}] ${txt}`);
      }
    }
    lines.push("");
  }

  // 3. Tabelas
  if (inspection.tables && inspection.tables.length > 0) {
    lines.push("## Tabelas");
    for (const tbl of inspection.tables) {
      let maxCols = 0;
      for (const r of tbl.rows) {
        if (r.cells.length > maxCols) maxCols = r.cells.length;
      }
      lines.push(
        `### Tabela [T${tbl.index}] (${tbl.rows.length} linhas x ${maxCols} colunas)`
      );

      for (const r of tbl.rows) {
        const physicalCells = r.cells.filter((c) => !c.isSpanPlaceholder);
        const nonEmptyCells = physicalCells.filter((c) => c.text.trim() !== "");
        if (nonEmptyCells.length === 0) continue;

        if (physicalCells.length === 2) {
          const c0 = physicalCells[0];
          const c1 = physicalCells[1];
          const t0 = c0.text.trim().replace(/\r?\n/g, " ");
          const t1 = c1.text.trim().replace(/\r?\n/g, " ");
          const span0 =
            c0.colSpan && c0.colSpan > 1 ? ` (span=${c0.colSpan})` : "";
          const span1 =
            c1.colSpan && c1.colSpan > 1 ? ` (span=${c1.colSpan})` : "";
          const vm0 = c0.rowSpan === "continue" ? " [vMerge]" : "";
          const vm1 = c1.rowSpan === "continue" ? " [vMerge]" : "";
          const idx0 = c0.physicalCellIndex ?? c0.cellIndex;
          const idx1 = c1.physicalCellIndex ?? c1.cellIndex;
          lines.push(
            `- [T${tbl.index}.R${r.rowIndex}.C${idx0}] ${t0}${span0}${vm0} -> [T${tbl.index}.R${r.rowIndex}.C${idx1}] ${t1 || "[vazio]"}${span1}${vm1}`
          );
        } else {
          const rowParts = physicalCells.map((c) => {
            const spanStr =
              c.colSpan && c.colSpan > 1 ? ` (span=${c.colSpan})` : "";
            const vmStr = c.rowSpan === "continue" ? " [vMerge]" : "";
            const txt = c.text.trim().replace(/\r?\n/g, " ") || "[vazio]";
            const cIdx = c.physicalCellIndex ?? c.cellIndex;
            return `[T${tbl.index}.R${r.rowIndex}.C${cIdx}] ${txt}${spanStr}${vmStr}`;
          });
          lines.push(`- [T${tbl.index}.R${r.rowIndex}] ${rowParts.join(" | ")}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim() + "\n";
}

// ============================================================================
// 1. Função de Inspeção Estrutural (inspect_docx — suporta .docx e .pdf)
// ============================================================================

async function applyStructuralDiffIfRequested(
  currentResult: DocxInspectionResult,
  currentPath: string,
  outputPath?: string,
  compareWithPath?: string
): Promise<void> {
  if (!compareWithPath) return;
  const resolvedOld = resolve(compareWithPath);
  if (!existsSync(resolvedOld)) {
    throw new Error(`Arquivo de comparação não encontrado: ${resolvedOld}`);
  }
  const oldInspection = await inspectDocx(resolvedOld, undefined, true);
  const diff = computeStructuralDiff(
    oldInspection,
    currentResult,
    resolvedOld,
    currentPath
  );

  const diffOutDir = outputPath
    ? dirname(resolve(outputPath))
    : dirname(currentPath);
  const diffBase = outputPath
    ? basename(resolve(outputPath), ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      )
    : basename(currentPath).replace(/\.(?:docx|pdf)$/i, "");
  const diffMdPath = resolve(diffOutDir, `diff_documental_${diffBase}.md`);
  const diffJsonPath = resolve(diffOutDir, `diff_documental_${diffBase}.json`);
  if (!existsSync(diffOutDir)) {
    mkdirSync(diffOutDir, { recursive: true });
  }
  const diffMd = generateDiffReportMarkdown(diff);
  writeFileSync(diffMdPath, diffMd, "utf-8");
  diff.diff_report_path = diffMdPath;
  writeFileSync(diffJsonPath, JSON.stringify(diff, null, 2), "utf-8");
  currentResult.diff_result = diff;
}

export function isZipBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 4) return false;
  return (
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)
  );
}

export function isTextOrMarkdownFile(filePath: string, buf: Buffer): boolean {
  const lower = filePath.toLowerCase();
  if (
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".text") ||
    lower.endsWith(".log")
  ) {
    return true;
  }
  // Se for extensão conhecida de arquivo binário estruturado, não deve ser tratado como texto puro
  if (
    lower.endsWith(".docx") ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".zip") ||
    lower.endsWith(".tar") ||
    lower.endsWith(".gz")
  ) {
    return false;
  }
  if (isZipBuffer(buf) || isPdfBuffer(buf)) {
    return false;
  }
  const checkLen = Math.min(buf.length, 512);
  for (let i = 0; i < checkLen; i++) {
    if (buf[i] === 0x00) {
      return false;
    }
  }
  return true;
}

export function generateTextLinearAuditViewMarkdown(
  fileName: string,
  paragraphs: BodyParagraphInfo[],
  cartography: DocumentCartography,
  isMarkdown: boolean
): string {
  let md = `# Visão Linear de Auditoria — ${fileName}\n\n`;
  md += `> ℹ️ **AVISO DE INGESTÃO:** Documento de ${
    isMarkdown ? "Markdown (.md)" : "Texto Puro (.txt)"
  } inspecionado com sucesso. Para máxima fidelidade visual, metadados OpenXML e parametrização de templates, recomenda-se que as minutas originais em formato binário (.docx / .pdf) estejam presentes na pasta .user_uploaded ou inputs/.\n\n`;
  md += renderCartographyMarkdownBlock(cartography);
  md += "\n\n---\n\n## Bloco 2: Leitura Sequencial Integral\n\n";

  for (const p of paragraphs) {
    if (!p.text) continue;
    md += `[P${p.index}] ${p.text}\n\n`;
  }

  return md;
}

export async function inspectDocx(
  docxPath: string,
  outputPath?: string,
  compact: boolean = false,
  options: {
    registryDir?: string;
    compareWithPath?: string;
    skipAuditArtifacts?: boolean;
  } = {}
): Promise<DocxInspectionResult> {
  const resolvedDocx = resolveExistingPathNfc(resolve(docxPath));
  if (!existsSync(resolvedDocx)) {
    throw new Error(`Arquivo não encontrado: ${resolvedDocx}`);
  }

  const buffer = readFileSync(resolvedDocx);

  const fileType = detectFileTypeSync(buffer, resolvedDocx);
  if (fileType.isArchive) {
    throw new Error(
      `O arquivo '${basename(
        resolvedDocx
      )}' é um pacote compactado (${fileType.description}). A ferramenta 'inspect_doc' opera exclusivamente em documentos individuais (.docx, .pdf, .xlsx, .csv, .md, .txt). Para descompactar e inspecionar automaticamente múltiplos arquivos de um pacote, utilize 'bootstrap_case'.`
    );
  }

  const inScope =
    isValidDocGovCaseScope(resolvedDocx) ||
    Boolean(outputPath && isValidDocGovCaseScope(outputPath));

  const lowerPath = resolvedDocx.toLowerCase();
  const isSpreadsheet =
    lowerPath.endsWith(".xlsx") ||
    lowerPath.endsWith(".xls") ||
    lowerPath.endsWith(".csv");

  if (isSpreadsheet) {
    const isCsv = lowerPath.endsWith(".csv");
    const extraction = isCsv
      ? parseCsvBuffer(buffer)
      : await parseXlsxBuffer(buffer);

    // Auditoria Matemática Orçamentária
    const budgetAudit = auditDocumentBudget({ docxTables: extraction.tables });

    const baseStem = outputPath
      ? basename(resolve(outputPath), ".json").replace(
          /^(?:estrutura_|inspecao_)/,
          ""
        )
      : basename(resolvedDocx).replace(/\.(?:xlsx|xls|csv)$/i, "");

    const outDir = inScope
      ? (outputPath ? dirname(resolve(outputPath)) : dirname(resolvedDocx))
      : getEphemeralInspectDir();

    const targetOutputPath = inScope
      ? (outputPath ? resolve(outputPath) : undefined)
      : resolve(
          outDir,
          outputPath ? basename(outputPath) : `estrutura_${baseStem}.json`
        );

    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const auditViewPath = resolve(outDir, `visao_auditoria_${baseStem}.md`);
    const dossieHotspotsPath = resolve(outDir, `dossie_hotspots_${baseStem}.md`);
    const budgetAuditPath = resolve(
      outDir,
      `auditoria_orcamentaria_${baseStem}.json`
    );

    if (!options.skipAuditArtifacts) {
      let auditMd = generateSpreadsheetLinearAuditViewMarkdown(
        basename(resolvedDocx),
        extraction
      );
      if (budgetAudit.has_budget_table) {
        auditMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
      }
      writeFileSync(auditViewPath, auditMd, "utf-8");

      let dossieMd = generateSpreadsheetHotspotsDossierMarkdown(
        basename(resolvedDocx),
        extraction
      );
      if (budgetAudit.has_budget_table) {
        dossieMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
        writeFileSync(budgetAuditPath, JSON.stringify(budgetAudit, null, 2), "utf-8");
      }
      writeFileSync(dossieHotspotsPath, dossieMd, "utf-8");
    }

    const toc_map: DocxTocMap = {
      sections: extraction.sheets.map((s) => ({
        coord: `ABA_${s.index + 1}`,
        title: s.name,
      })),
      form_fields: [],
      tables: extraction.tables.map((t) => ({
        table_index: t.index,
        rows: t.rows.length,
        cols: t.rows[0]?.cells.length ?? 0,
        headers: t.rows[0]?.cells.map((c) => c.text) ?? [],
        sample_row_coord: t.rows.length > 1 ? `T${t.index}.R1` : undefined,
      })),
    };

    const result: DocxInspectionResult = {
      doc_type: isCsv ? "csv" : "xlsx",
      format: extraction.format,
      page_count: extraction.sheets.length,
      line_count: extraction.totalRows,
      ...(options.skipAuditArtifacts ? {} : {
        audit_view_path: auditViewPath,
        dossie_hotspots_path: dossieHotspotsPath,
      }),
      headers: [],
      footers: [],
      paragraphs: [],
      tables: extraction.tables,
      toc_map,
      budget_audit: budgetAudit,
    };

    if (targetOutputPath) {
      writeFileSync(targetOutputPath, JSON.stringify(result, null, 2), "utf-8");
    }

    return result;
  }

  const isPdf =
    isPdfBuffer(buffer) || resolvedDocx.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    if (!isPdfBuffer(buffer)) {
      throw new Error(
        `Arquivo .pdf inválido (Magic Bytes '%PDF-' ausentes): ${resolvedDocx}`
      );
    }

    const extraction = await extractPdfPages(buffer);
    const cartography = buildPdfCartography(extraction);

    const baseStem = outputPath
      ? basename(resolve(outputPath), ".json").replace(
          /^(?:estrutura_|inspecao_)/,
          ""
        )
      : basename(resolvedDocx).replace(/\.pdf$/i, "");

    const outDir = inScope
      ? (outputPath ? dirname(resolve(outputPath)) : dirname(resolvedDocx))
      : getEphemeralInspectDir();

    const targetOutputPath = inScope
      ? (outputPath ? resolve(outputPath) : undefined)
      : resolve(
          outDir,
          outputPath ? basename(outputPath) : `estrutura_${baseStem}.json`
        );

    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    // Auditoria Matemática Orçamentária (v1.1.0)
    const budgetAudit = auditDocumentBudget({ pdfLines: extraction.lines });
    if (budgetAudit.has_budget_table) {
      injectBudgetAuditIntoImpugnationZones(
        budgetAudit,
        cartography.impugnation_zones
      );

      if (!options.skipAuditArtifacts) {
        const budgetAuditPath = resolve(
          outDir,
          `auditoria_orcamentaria_${baseStem}.json`
        );
        writeFileSync(
          budgetAuditPath,
          JSON.stringify(budgetAudit, null, 2),
          "utf-8"
        );
      }
    }

    let auditViewPath: string | undefined;
    let dossieHotspotsPath: string | undefined;

    if (!options.skipAuditArtifacts) {
      auditViewPath = resolve(outDir, `visao_auditoria_${baseStem}.md`);

      let auditMd = generatePdfLinearAuditViewMarkdown(
        basename(resolvedDocx),
        extraction,
        cartography
      );
      if (budgetAudit.has_budget_table) {
        auditMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
      }
      writeFileSync(auditViewPath, auditMd, "utf-8");

      // Geração do Dossiê Executivo de Hotspots (v0.9.0)
      dossieHotspotsPath = resolve(outDir, `dossie_hotspots_${baseStem}.md`);

      let dossieMd = generateHotspotsDossierMarkdown(
        basename(resolvedDocx),
        extraction,
        cartography
      );
      if (budgetAudit.has_budget_table) {
        dossieMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
      }
      writeFileSync(dossieHotspotsPath, dossieMd, "utf-8");
    }

    const toc_map: DocxTocMap = {
      sections: cartography.outline_headings.map((h) => ({
        coord: h.coord,
        title: h.title,
      })),
      form_fields: [],
      tables: [],
    };

    const paragraphs: BodyParagraphInfo[] = extraction.lines.map((l, idx) => ({
      index: idx,
      style: null,
      text: `${l.bracket_coord} ${l.text}`,
    }));

    const pdfResult: DocxInspectionResult = {
      doc_type: "pdf",
      page_count: extraction.pageCount,
      line_count: extraction.lineCount,
      outline_headings: cartography.outline_headings,
      page_signals: cartography.page_signals,
      impugnation_zones: cartography.impugnation_zones,
      toc_map,
      ...(auditViewPath ? { audit_view_path: auditViewPath } : {}),
      ...(dossieHotspotsPath ? { dossie_hotspots_path: dossieHotspotsPath } : {}),
      ...(extraction.scanned_pages_detected
        ? { scanned_pages_detected: extraction.scanned_pages_detected }
        : {}),
      ...(extraction.ocr_applied
        ? { ocr_applied: true, ocr_pages: extraction.ocr_pages }
        : {}),
      headers: [],
      footers: [],
      paragraphs,
      tables: [],
      ...(budgetAudit.has_budget_table ? { budget_audit: budgetAudit } : {}),
    };

    await applyStructuralDiffIfRequested(
      pdfResult,
      resolvedDocx,
      outputPath,
      options.compareWithPath
    );

    if (targetOutputPath) {
      writeFileSync(targetOutputPath, JSON.stringify(pdfResult, null, 2), "utf-8");
    }

    return pdfResult;
  }

  const isTextOrMd = isTextOrMarkdownFile(resolvedDocx, buffer);
  if (isTextOrMd) {
    const isMd =
      lowerPath.endsWith(".md") || lowerPath.endsWith(".markdown");
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
        /^(?:(?:\d+(?:\.\d+)*|[A-Z]|\b[IVXLCDM]+\b)[\.\-\)\s]|CL[ÁA]USULA|SE[ÇC][ÃA]O|CAP[IÍ]TULO|ANEXO)\s+[A-ZÀ-Ú0-9]/i.test(
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

    const outDir = inScope
      ? (outputPath ? dirname(resolve(outputPath)) : dirname(resolvedDocx))
      : getEphemeralInspectDir();

    const targetOutputPath = inScope
      ? (outputPath ? resolve(outputPath) : undefined)
      : resolve(
          outDir,
          outputPath ? basename(outputPath) : `estrutura_${baseStem}.json`
        );

    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const auditViewPath = resolve(outDir, `visao_auditoria_${baseStem}.md`);
    const dossieHotspotsPath = resolve(outDir, `dossie_hotspots_${baseStem}.md`);

    if (!options.skipAuditArtifacts) {
      const auditMd = generateTextLinearAuditViewMarkdown(
        basename(resolvedDocx),
        paragraphs,
        cartography,
        isMd
      );
      writeFileSync(auditViewPath, auditMd, "utf-8");
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
      writeFileSync(dossieHotspotsPath, dossieMd, "utf-8");
    }

    const textResult: DocxInspectionResult = {
      doc_type: isMd ? "markdown" : "text",
      format: isMd ? "markdown" : "plain_text",
      page_count: fakeExtraction.pageCount,
      line_count: paragraphs.length,
      ...(options.skipAuditArtifacts ? {} : {
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

    await applyStructuralDiffIfRequested(
      textResult,
      resolvedDocx,
      outputPath,
      options.compareWithPath
    );

    if (targetOutputPath) {
      writeFileSync(targetOutputPath, JSON.stringify(textResult, null, 2), "utf-8");
    }

    return textResult;
  }

  if (!isZipBuffer(buffer)) {
    throw new Error(
      `Formato de arquivo não suportado ou corrompido: '${basename(
        resolvedDocx
      )}'. O docgov-engine aceita nativamente documentos .docx, .pdf, .xlsx, .csv, .md e .txt. Se este for um anexo original do processo, certifique-se de que o arquivo binário intacto está presente na pasta .user_uploaded ou inputs/.`
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err: any) {
    throw new Error(
      `Falha na descompressão do pacote OpenXML/ZIP '${basename(
        resolvedDocx
      )}': ${err?.message || "arquivo corrompido"}. Certifique-se de que o arquivo .docx original intacto está presente na pasta .user_uploaded ou inputs/.`
    );
  }

  const parser = new DOMParser();

  const headers: HeaderFooterParagraphInfo[] = [];
  const footers: HeaderFooterParagraphInfo[] = [];

  const fileNames = Object.keys(zip.files).sort();

  for (const name of fileNames) {
    if (/^word\/header\d*\.xml$/i.test(name)) {
      const xmlStr = sanitizeXmlString(await zip.file(name)!.async("string"));
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      const pList = getAllElements(xmlDoc, "w:p");
      pList.forEach((p, idx) => {
        headers.push({
          part: name,
          index: idx,
          paragraphIndex: idx,
          style: extractParagraphStyle(p),
          text: extractParagraphText(p),
        });
      });
    } else if (/^word\/footer\d*\.xml$/i.test(name)) {
      const xmlStr = sanitizeXmlString(await zip.file(name)!.async("string"));
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      const pList = getAllElements(xmlDoc, "w:p");
      pList.forEach((p, idx) => {
        footers.push({
          part: name,
          index: idx,
          paragraphIndex: idx,
          style: extractParagraphStyle(p),
          text: extractParagraphText(p),
        });
      });
    }
  }

  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error(
      `Estrutura OpenXML inválida ('word/document.xml' ausente no pacote ZIP): '${basename(
        resolvedDocx
      )}'. O arquivo parece ser um arquivo ZIP genérico e não um documento Microsoft Word (.docx) válido. Verifique os arquivos originais em .user_uploaded ou inputs/.`
    );
  }

  const docXmlStr = sanitizeXmlString(await docFile.async("string"));
  const docXml = parser.parseFromString(docXmlStr, "application/xml");
  const body = getAllElements(docXml, "w:body")[0];
  if (!body) {
    throw new Error(`Elemento <w:body> não encontrado em word/document.xml`);
  }

  const numberingFile = zip.file("word/numbering.xml");
  const numberingXmlStr = numberingFile
    ? await numberingFile.async("string")
    : null;
  const numberingResolver = createNumberingResolver(numberingXmlStr);

  const bodyParagraphs = getDirectChildElements(body, "w:p");
  const paragraphs: BodyParagraphInfo[] = bodyParagraphs.map((p, index) => {
    const numbering = extractParagraphNumbering(p);
    let text = extractParagraphText(p);
    if (numbering) {
      const trimmed = text.trim();
      const isTemplateTag = /^\{\{[\s\S]*\}\}$/.test(trimmed);
      if (trimmed && !isTemplateTag) {
        const computedPrefix = numberingResolver.formatParagraphPrefix(
          numbering.numId,
          numbering.level
        );
        if (
          computedPrefix &&
          !trimmed.startsWith(computedPrefix) &&
          !trimmed.startsWith(`${computedPrefix}.`)
        ) {
          text = `${computedPrefix} ${text.trimStart()}`;
        }
      }
    }
    return {
      index,
      style: extractParagraphStyle(p),
      text,
      ...(numbering ? { numbering } : {}),
    };
  });

  const bodyTables = getDirectChildElements(body, "w:tbl");
  const rawTables: TableInfo[] = bodyTables.map((tbl, index) => {
    const trList = getDirectChildElements(tbl, "w:tr");
    const activeVMerges = new Map<number, string>();

    const rows: TableRowInfo[] = trList.map((tr, rowIndex) => {
      const tcList = getDirectChildElements(tr, "w:tc");
      const cells: TableCellInfo[] = [];
      let currentVirtualCol = 0;

      for (let physicalIdx = 0; physicalIdx < tcList.length; physicalIdx++) {
        const tc = tcList[physicalIdx];
        const span = extractCellGridSpan(tc);
        const vMerge = extractCellVMerge(tc);
        let text = extractCellText(tc);

        if (vMerge === "restart") {
          activeVMerges.set(currentVirtualCol, text);
        } else if (vMerge === "continue") {
          if (!text.trim() && activeVMerges.has(currentVirtualCol)) {
            text = activeVMerges.get(currentVirtualCol) || "";
          }
        } else {
          activeVMerges.delete(currentVirtualCol);
        }

        cells.push({
          cellIndex: currentVirtualCol,
          physicalCellIndex: physicalIdx,
          virtualColIndex: currentVirtualCol,
          text,
          ...(span > 1 ? { colSpan: span } : {}),
          ...(vMerge ? { rowSpan: vMerge } : {}),
        });

        // Se span > 1 (gridSpan), preenche colunas lógicas intermediárias com células vazias
        // para manter alinhamento estrito das colunas subsequentes na grade do budget_auditor
        for (let s = 1; s < span; s++) {
          cells.push({
            cellIndex: currentVirtualCol + s,
            physicalCellIndex: physicalIdx,
            virtualColIndex: currentVirtualCol + s,
            text: "",
            isSpanPlaceholder: true,
          });
        }

        currentVirtualCol += span;
      }

      return {
        rowIndex,
        cells,
      };
    });

    return {
      index,
      rows,
    };
  });

  // Unificação de tabelas consecutivas com mesma grade/repetição de cabeçalho
  const tables: TableInfo[] = [];
  for (let t = 0; t < rawTables.length; t++) {
    const current = rawTables[t];
    if (tables.length === 0) {
      tables.push(current);
      continue;
    }
    const prev = tables[tables.length - 1];
    const prevHeader = prev.rows[0]?.cells.map((c) => c.text.trim()) ?? [];
    const currHeader = current.rows[0]?.cells.map((c) => c.text.trim()) ?? [];

    const isSameCols = prev.rows[0]?.cells.length === current.rows[0]?.cells.length;
    const isRepeatedHeader =
      isSameCols &&
      prevHeader.length > 0 &&
      currHeader.length > 0 &&
      prevHeader.join("|") === currHeader.join("|");

    if (isSameCols && isRepeatedHeader) {
      // Mescla linhas da tabela seguinte na tabela anterior (omitindo o cabeçalho repetido)
      const dataRows = current.rows.slice(1);
      const startRowIdx = prev.rows.length;
      for (let r = 0; r < dataRows.length; r++) {
        prev.rows.push({
          rowIndex: startRowIdx + r,
          cells: dataRows[r].cells,
        });
      }
    } else {
      tables.push({
        ...current,
        index: tables.length,
      });
    }
  }

  const toc_map = buildTocMap(paragraphs, tables);
  const docxCartography = buildDocxCartography(paragraphs, tables, toc_map);

  // Auditoria Matemática Orçamentária (v1.1.0)
  const budgetAudit = auditDocumentBudget({
    docxTables: tables,
    docxParagraphs: paragraphs,
  });
  const baseStem = outputPath
    ? basename(resolve(outputPath), ".json").replace(
        /^(?:estrutura_|inspecao_)/,
        ""
      )
    : basename(resolvedDocx, ".docx");

  const outDir = inScope
    ? (outputPath ? dirname(resolve(outputPath)) : dirname(resolvedDocx))
    : getEphemeralInspectDir();

  const targetOutputPath = inScope
    ? (outputPath ? resolve(outputPath) : undefined)
    : resolve(
        outDir,
        outputPath ? basename(outputPath) : `estrutura_${baseStem}.json`
      );

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  if (budgetAudit.has_budget_table) {
    injectBudgetAuditIntoImpugnationZones(
      budgetAudit,
      docxCartography.impugnation_zones
    );

    if (!options.skipAuditArtifacts) {
      const budgetAuditPath = resolve(
        outDir,
        `auditoria_orcamentaria_${baseStem}.json`
      );
      writeFileSync(
        budgetAuditPath,
        JSON.stringify(budgetAudit, null, 2),
        "utf-8"
      );
    }
  }

  const detectedTabular = detectTableSubtablesAndCheckboxes(tables);

  const rawResult: DocxInspectionResult = {
    doc_type: "docx",
    outline_headings: docxCartography.outline_headings,
    page_signals: docxCartography.page_signals,
    impugnation_zones: docxCartography.impugnation_zones,
    toc_map,
    ...(detectedTabular.subtables.length > 0
      ? { detected_subtables: detectedTabular.subtables }
      : {}),
    ...(detectedTabular.checkboxes.length > 0
      ? { detected_checkboxes: detectedTabular.checkboxes }
      : {}),
    headers,
    footers,
    paragraphs,
    tables,
    ...(budgetAudit.has_budget_table ? { budget_audit: budgetAudit } : {}),
  };

  const postCompileAlerts = scanPostCompileIntegrityAlerts(rawResult);
  if (postCompileAlerts.length > 0) {
    rawResult.post_compile_alerts = postCompileAlerts;
  }

  // Cálculo da Impressão Digital Estrutural (v0.6.0)
  const structure_fingerprint = computeStructureFingerprint(rawResult);
  rawResult.structure_fingerprint = structure_fingerprint;

  // Matching 1-para-N contra o Cache Global de Templates (v0.6.0)
  const match = findBestTemplateMatch(
    structure_fingerprint,
    resolvedDocx,
    options.registryDir
  );
  let template_match: TemplateMatchResult;

  if (match.entry) {
    const meta = extractCacheTemporalMetadata(match.entry);
    if (match.similarity >= 0.995) {
      template_match = {
        status: "EXACT",
        similarity: 1.0,
        template_id: match.entry.template_id,
        registry_path: match.entry.registry_path,
        created_at: meta.created_at,
        updated_at: meta.updated_at,
        age_days: meta.age_days,
        cache_date_status: meta.cache_date_status,
        engine_version: meta.engine_version,
        slots_count: meta.slots_count,
        message:
          meta.cache_date_status === "KNOWN"
            ? `Template idêntico (100%) localizado no registro global: '${match.entry.template_id}' (atualizado em ${meta.updated_at.slice(0, 10)}, ${meta.slots_count} slots).`
            : `Template idêntico (100%) localizado no registro global: '${match.entry.template_id}' (data de criação não disponível no cache legado, ${meta.slots_count} slots).`,
      };
    } else if (match.similarity >= 0.75) {
      const adapted = reanchorSlotsManifest(
        match.entry,
        structure_fingerprint,
        rawResult
      );
      const adaptedPath = resolve(outDir, "adapted_slots_manifest.json");
      writeFileSync(adaptedPath, JSON.stringify(adapted, null, 2), "utf-8");

      template_match = {
        status: "MODIFIED",
        similarity: match.similarity,
        template_id: match.entry.template_id,
        registry_path: match.entry.registry_path,
        adapted_manifest_path: adaptedPath,
        shift_summary:
          adapted._shift_summary ||
          "Coordenadas reancoradas automaticamente por rótulos de formulário.",
        created_at: meta.created_at,
        updated_at: meta.updated_at,
        age_days: meta.age_days,
        cache_date_status: meta.cache_date_status,
        engine_version: meta.engine_version,
        slots_count: meta.slots_count,
        message: `Template base '${
          match.entry.template_id
        }' compatível com drift (${Math.round(
          match.similarity * 100
        )}%). Manifesto adaptado gerado em state/adapted_slots_manifest.json.`,
      };
    } else {
      template_match = {
        status: "NEW",
        similarity: match.similarity,
        message: `Minuta inédita (< 75% de similaridade com templates registrados). Maior similaridade: ${Math.round(
          match.similarity * 100
        )}% ('${
          match.entry.template_id
        }'). Elabore um novo slots_manifest.json.`,
      };
    }
  } else {
    template_match = {
      status: "NEW",
      similarity: 0,
      message:
        "Nenhum template salvo no registro global de templates. Elabore um novo slots_manifest.json.",
    };
  }
  rawResult.template_match = template_match;

  // Geração da Visão Linear Compacta de Auditoria (v0.6.0 / v0.8.0 / v0.8.1 com Cartografia + Z1..Z14)
  if (!options.skipAuditArtifacts) {
    const auditViewPath = resolve(
      outDir,
      `visao_auditoria_${baseStem.normalize("NFC")}.md`
    );

    let auditMd = generateLinearAuditViewMarkdown(
      basename(resolvedDocx).normalize("NFC"),
      rawResult
    );
    if (budgetAudit.has_budget_table) {
      auditMd += "\n\n" + formatBudgetAuditMarkdownBlock(budgetAudit);
    }
    writeFileSync(auditViewPath, auditMd, "utf-8");
    rawResult.audit_view_path = auditViewPath;
  }

  await applyStructuralDiffIfRequested(
    rawResult,
    resolvedDocx,
    outputPath,
    options.compareWithPath
  );

  const finalResult = compact ? compactInspectionResult(rawResult) : rawResult;

  if (targetOutputPath) {
    const nfcOutPath = resolve(
      outDir,
      basename(targetOutputPath).normalize("NFC")
    );
    writeFileSync(nfcOutPath, JSON.stringify(finalResult, null, 2), "utf-8");
  }

  return finalResult;
}

export function toShortDocPath(p: string): string {
  if (!p) return p;
  const idx = p.search(/[\\/]cases[\\/]/i);
  if (idx !== -1) {
    return p.slice(idx + 1).replace(/\\/g, "/");
  }
  try {
    const rel = relative(process.cwd(), p).replace(/\\/g, "/");
    if (!rel.startsWith("../..") && !rel.includes(":/") && !rel.includes(":\\")) {
      return rel;
    }
  } catch {
    // Mantém caminho original formatado
  }
  return p.replace(/\\/g, "/");
}

export function formatInspectDocSyntheticResult(
  filePath: string,
  outputPath: string,
  inspection: DocxInspectionResult
): InspectDocSyntheticResult {
  let totalRows = 0;
  for (const table of inspection.tables) {
    totalRows += table.rows.length;
  }

  const toc_summary: Array<{ coord: string; title: string; target?: string }> =
    [];
  const tocMap = inspection.toc_map;
  if (tocMap) {
    // Adiciona até 2 seções principais
    for (const s of tocMap.sections.slice(0, 2)) {
      toc_summary.push({
        coord: s.coord,
        title: s.title.length > 25 ? `${s.title.slice(0, 22)}...` : s.title,
        ...(s.suggested_target_slot ? { target: s.suggested_target_slot } : {}),
      });
    }
    // Adiciona 1 campo de formulário principal
    for (const f of tocMap.form_fields.slice(0, 1)) {
      toc_summary.push({
        coord: f.coord,
        title: f.title.length > 25 ? `${f.title.slice(0, 22)}...` : f.title,
        ...(f.suggested_target_slot ? { target: f.suggested_target_slot } : {}),
      });
    }
    // Adiciona 1 tabela resumida
    if (tocMap.tables.length > 0) {
      const t = tocMap.tables[0];
      const headerSample = t.headers.slice(0, 2).join(", ");
      toc_summary.push({
        coord: `T${t.table_index}`,
        title: `Tbl (${t.rows}x${t.cols})${
          headerSample ? ` [${headerSample}]` : ""
        }`,
      });
    }
  }

  const relAuditPath = inspection.audit_view_path
    ? toShortDocPath(inspection.audit_view_path)
    : undefined;

  const relDossiePath = inspection.dossie_hotspots_path
    ? toShortDocPath(inspection.dossie_hotspots_path)
    : undefined;

  const conciseMatch: TemplateMatchResult | undefined = inspection.template_match
    ? {
        status: inspection.template_match.status,
        similarity: inspection.template_match.similarity,
        ...(inspection.template_match.template_id
          ? { template_id: inspection.template_match.template_id }
          : {}),
        ...(inspection.template_match.adapted_manifest_path
          ? {
              adapted_manifest_path: toShortDocPath(
                inspection.template_match.adapted_manifest_path
              ),
            }
          : {}),
        ...(inspection.template_match.created_at !== undefined
          ? { created_at: inspection.template_match.created_at }
          : {}),
        ...(inspection.template_match.updated_at !== undefined
          ? { updated_at: inspection.template_match.updated_at }
          : {}),
        ...(inspection.template_match.age_days !== undefined
          ? { age_days: inspection.template_match.age_days }
          : {}),
        ...(inspection.template_match.cache_date_status !== undefined
          ? { cache_date_status: inspection.template_match.cache_date_status }
          : {}),
        ...(inspection.template_match.engine_version !== undefined
          ? { engine_version: inspection.template_match.engine_version }
          : {}),
        ...(inspection.template_match.slots_count !== undefined
          ? { slots_count: inspection.template_match.slots_count }
          : {}),
      }
    : undefined;

  let nextHint =
    inspection.doc_type === "pdf"
      ? inspection.scanned_pages_detected &&
        inspection.scanned_pages_detected.length > 0
        ? `ALERTA: páginas escaneadas detectadas (${inspection.scanned_pages_detected.join(
            ", "
          )}). Leia visao_auditoria_*.md ou siga para 'generate_audit_docx'.`
        : "PDF inspecionado com Cartografia e Radar Z1..Z14. Leia visao_auditoria_*.md ou siga para 'build_docx_template' / 'generate_audit_docx'."
      : inspection.doc_type === "markdown" || inspection.doc_type === "text"
      ? "Texto/MD inspecionado com Cartografia e Radar Z1..Z14. Consulte visao_auditoria_*.md. Minutas binárias originais em .user_uploaded têm prioridade."
      : "Inspeção gravada com toc_map. Próximo passo: elabore slots_manifest.json e chame 'build_docx_template'.";
  if (
    inspection.template_match?.status === "EXACT" ||
    inspection.template_match?.status === "MODIFIED"
  ) {
    const st = inspection.template_match.status;
    const slots = inspection.template_match.slots_count ?? 0;
    if (
      inspection.template_match.cache_date_status === "KNOWN" &&
      inspection.template_match.updated_at &&
      inspection.template_match.updated_at !== "NÃO DISPONÍVEL"
    ) {
      const dateStr = inspection.template_match.updated_at.slice(0, 10);
      nextHint = `Cache reconhecido (${st}, criado/atualizado em ${dateStr}, ${slots} slots). Informe a data ao usuário no Gate 1. Próximo: 'build_docx_template'.`;
    } else {
      nextHint = `Cache reconhecido (${st}, data de criação não disponível no cache legado). Informe ao usuário no Gate 1 que a data do cache é desconhecida para que ele decida entre usar ou atualizar. Próximo: 'build_docx_template'.`;
    }
  }

  if (
    inspection.budget_audit?.has_budget_table &&
    inspection.budget_audit.math_errors_count > 0
  ) {
    nextHint = `ALERTA: ${inspection.budget_audit.math_errors_count} erro(s) matemático(s) na planilha. Consulte visao_auditoria_*.md.`;
  }

  if (inspection.diff_result) {
    const diff = inspection.diff_result;
    nextHint = `Diff concluído (+${diff.total_added} / -${diff.total_removed} / ~${diff.total_modified}). Relatório: ${relative(
      process.cwd(),
      diff.diff_report_path || ""
    ).replace(/\\/g, "/")}.`;
  }

  const buildPayload = (
    summaryItems: Array<{ coord: string; title: string; target?: string }>
  ): InspectDocSyntheticResult => ({
    status: "success",
    engine_version: VERSION,
    filePath,
    docxPath: filePath,
    outputPath,
    ...(inspection.doc_type && inspection.doc_type !== "docx"
      ? {
          doc_type: inspection.doc_type,
          page_count: inspection.page_count,
          line_count: inspection.line_count,
        }
      : {}),
    tables: inspection.tables.length,
    rows: totalRows,
    paragraphs: inspection.paragraphs.length,
    ...(conciseMatch ? { template_match: conciseMatch } : {}),
    ...(relAuditPath ? { audit_view_path: relAuditPath } : {}),
    ...(relDossiePath ? { dossie_path: relDossiePath } : {}),
    ...(inspection.budget_audit && inspection.budget_audit.has_budget_table
      ? {
          budget_audit: {
            tables_checked: inspection.budget_audit.tables_checked,
            items_checked: inspection.budget_audit.total_items_checked,
            math_errors: inspection.budget_audit.math_errors_count,
            rounding_warnings:
              inspection.budget_audit.rounding_warnings_count,
            ...(inspection.budget_audit.net_divergence_cents !== 0
              ? {
                  divergence: formatCentsToCurrency(
                    inspection.budget_audit.net_divergence_cents
                  ),
                }
              : {}),
          },
        }
      : {}),
    ...(inspection.diff_result
      ? {
          diff_summary: {
            added: inspection.diff_result.total_added,
            removed: inspection.diff_result.total_removed,
            modified: inspection.diff_result.total_modified,
            report: inspection.diff_result.diff_report_path
              ? relative(
                  process.cwd(),
                  inspection.diff_result.diff_report_path
                ).replace(/\\/g, "/")
              : undefined,
          },
        }
      : {}),
    ...(inspection.scanned_pages_detected &&
    inspection.scanned_pages_detected.length > 0
      ? { scanned_pages: inspection.scanned_pages_detected }
      : {}),
    ...(inspection.ocr_applied ? { ocr_applied: true } : {}),
    ...(summaryItems.length > 0 ? { toc_summary: summaryItems } : {}),
    next_step_hint: nextHint,
  });

  // Garante cumprimento estrito da Lei 2 (< 1024 bytes UTF-8 com folga segura < 900 bytes)
  const currentSummary = [...toc_summary];
  let result = buildPayload(currentSummary);

  // 1. Reduz itens de toc_summary enquanto payload for >= 900 bytes
  while (
    currentSummary.length > 0 &&
    Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 900
  ) {
    currentSummary.pop();
    result = buildPayload(currentSummary);
  }

  // 2. Se o payload ainda estiver >= 900 bytes e filePath e docxPath estiverem presentes,
  // descarta a chave redundante docxPath (elimina duplicação concorrente de caminhos)
  if (
    Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 900 &&
    result.docxPath &&
    result.filePath
  ) {
    delete result.docxPath;
  }

  // 3. Se ainda estiver >= 900 bytes, relativiza/encurta caminhos longos
  if (Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 900) {
    result.filePath = toShortDocPath(result.filePath);
    result.outputPath = toShortDocPath(result.outputPath);
    if (result.audit_view_path) {
      result.audit_view_path = toShortDocPath(result.audit_view_path);
    }
    if (result.dossie_path) {
      result.dossie_path = toShortDocPath(result.dossie_path);
    }
    if (result.template_match?.adapted_manifest_path) {
      result.template_match.adapted_manifest_path = toShortDocPath(
        result.template_match.adapted_manifest_path
      );
    }
  }

  // 4. Se ainda estiver >= 900 bytes, descarta dossie_path
  if (
    Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 900 &&
    result.dossie_path
  ) {
    delete result.dossie_path;
  }

  // 5. Se ainda estiver >= 900 bytes, encurta next_step_hint
  if (
    Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 900 &&
    result.next_step_hint &&
    result.next_step_hint.length > 55
  ) {
    if (result.next_step_hint.includes("Cache reconhecido")) {
      const st = result.template_match?.status ?? "EXACT";
      const slots = result.template_match?.slots_count ?? 0;
      result.next_step_hint = `Cache ${st} (${slots} slots). Siga para 'build_docx_template'.`;
    } else {
      result.next_step_hint = "Inspeção gravada. Siga para 'build_docx_template'.";
    }
  }

  return result;

  return result;
}

export const formatInspectDocxSyntheticResult = formatInspectDocSyntheticResult;
export const inspectDoc = inspectDocx;

