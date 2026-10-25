import type {
  TableInfo,
  BodyParagraphInfo,
  PdfLineItem,
  BudgetAuditReport,
  BudgetTableAudit,
  BudgetItemAudit,
  BudgetTextCrossCheck,
  BudgetDiscrepancySeverity,
  ImpugnationZonesMap,
} from "../types/index.ts";

// ============================================================================
// Motor de Auditoria Matemática Determinística de Planilhas Orçamentárias
// ============================================================================

export function formatCentsToCurrency(cents: number): string {
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const integerPart = Math.floor(absCents / 100);
  const decimalPart = absCents % 100;
  const formattedInt = integerPart
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const formattedDec = decimalPart.toString().padStart(2, "0");
  const sign = isNegative ? "-" : "";
  return `${sign}R$ ${formattedInt},${formattedDec}`;
}

export function parseMonetaryValueToCents(
  text: string
): { cents: number; raw: string; isValid: boolean } {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return { cents: 0, raw: clean, isValid: false };

  // Remove símbolos monetários e prefixos
  const stripped = clean
    .replace(/^R?\$?\s*/i, "")
    .replace(/\s*(?:reais|real)$/i, "")
    .trim();

  // Padrão brasileiro: 1.234,56 ou 1234,56 ou 0,50
  const ptBrMatch = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(stripped);
  if (ptBrMatch) {
    const intPartStr = ptBrMatch[1].replace(/\./g, "");
    const decPartStr = (ptBrMatch[2] || "").padEnd(2, "0").slice(0, 2);
    const intPart = parseInt(intPartStr, 10);
    const decPart = decPartStr ? parseInt(decPartStr, 10) : 0;
    const cents = intPart * 100 + decPart;
    return { cents, raw: clean, isValid: true };
  }

  // Padrão internacional com ponto decimal: 1234.56 ou 1,234.56
  const intlMatch = /^(\d{1,3}(?:,\d{3})+|\d+)\.(\d{1,2})$/.exec(stripped);
  if (intlMatch) {
    const intPartStr = intlMatch[1].replace(/,/g, "");
    const decPartStr = intlMatch[2].padEnd(2, "0").slice(0, 2);
    const intPart = parseInt(intPartStr, 10);
    const decPart = parseInt(decPartStr, 10);
    const cents = intPart * 100 + decPart;
    return { cents, raw: clean, isValid: true };
  }

  // Número puro sem separador decimal (ex.: "1500")
  if (/^\d+$/.test(stripped)) {
    const intPart = parseInt(stripped, 10);
    return { cents: intPart * 100, raw: clean, isValid: true };
  }

  return { cents: 0, raw: clean, isValid: false };
}

export function parseQuantity(
  text: string
): { value: number; raw: string; isValid: boolean } {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return { value: 0, raw: clean, isValid: false };

  // Remove caracteres não numéricos comuns em quantidades (unidades anexadas como "10 un", "5 pcs")
  const numToken = clean.split(" ")[0].trim();

  // Quantidade em pt-BR com vírgula: "2,5" ou "1.500"
  if (/^\d+(?:,\d+)?$/.test(numToken)) {
    const val = parseFloat(numToken.replace(",", "."));
    return { value: val, raw: clean, isValid: !isNaN(val) };
  }

  // Quantidade com ponto como milhar: "1.000"
  if (/^\d{1,3}(?:\.\d{3})+$/.test(numToken)) {
    const val = parseInt(numToken.replace(/\./g, ""), 10);
    return { value: val, raw: clean, isValid: !isNaN(val) };
  }

  // Float internacional: "2.5"
  if (/^\d+\.\d+$/.test(numToken)) {
    const val = parseFloat(numToken);
    return { value: val, raw: clean, isValid: !isNaN(val) };
  }

  // Inteiro simples
  if (/^\d+$/.test(numToken)) {
    const val = parseInt(numToken, 10);
    return { value: val, raw: clean, isValid: !isNaN(val) };
  }

  return { value: 0, raw: clean, isValid: false };
}

interface ColumnMapping {
  itemCol: number;
  descCol: number;
  unitCol: number;
  qtdCol: number;
  unitValCol: number;
  totalValCol: number;
}

function detectColumnMapping(headers: string[]): ColumnMapping | null {
  let itemCol = -1;
  let descCol = -1;
  let unitCol = -1;
  let qtdCol = -1;
  let unitValCol = -1;
  let totalValCol = -1;

  for (let c = 0; c < headers.length; c++) {
    const h = headers[c]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .trim();

    if (/^(?:ITEM|N[ºO°]|N|NUM|CODIGO)\b/.test(h) && itemCol === -1) {
      itemCol = c;
    } else if (
      /^(?:DESCRICAO|ESPECIFICACAO|OBJETO|DISCRIMINACAO|SERVICO|PRODUTO)\b/.test(
        h
      ) &&
      descCol === -1
    ) {
      descCol = c;
    } else if (/^(?:UNID|UNIDADE|UND|MEDIDA)\b/.test(h) && unitCol === -1) {
      unitCol = c;
    } else if (/^(?:QTD|QUANTIDADE|QUANT|QTDE)\b/.test(h) && qtdCol === -1) {
      qtdCol = c;
    } else if (
      /(?:VALOR\s*UNIT|V\.?\s*UNIT|PRECO\s*UNIT|UNITARIO)\b/.test(h) &&
      unitValCol === -1
    ) {
      unitValCol = c;
    } else if (
      /(?:VALOR\s*TOTAL|V\.?\s*TOTAL|PRECO\s*TOTAL|VALOR\s*GLOBAL|TOTAL)\b/.test(
        h
      ) &&
      totalValCol === -1
    ) {
      totalValCol = c;
    }
  }

  // Uma tabela é considerada orçamentária se possuir ao menos Qtd + Valor Unitário + Valor Total,
  // ou se possuir Valor Unitário + Valor Total + Descrição
  if (qtdCol !== -1 && unitValCol !== -1 && totalValCol !== -1) {
    return { itemCol, descCol, unitCol, qtdCol, unitValCol, totalValCol };
  }

  return null;
}

function isSummaryRow(rowText: string): boolean {
  const norm = rowText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return /^(?:TOTAL|VALOR\s*GLOBAL|TOTAL\s*GERAL|VALOR\s*TOTAL|SUBTOTAL)\b/.test(
    norm.trim()
  );
}

// ============================================================================
// Auditoria em Tabelas Word (DOCX)
// ============================================================================

export function auditDocxTables(tables: TableInfo[]): BudgetTableAudit[] {
  const auditedTables: BudgetTableAudit[] = [];

  for (const table of tables) {
    if (!table.rows || table.rows.length < 2) continue;

    // Localiza linha de cabeçalho nas primeiras 3 linhas
    let colMap: ColumnMapping | null = null;
    let headerRowIdx = -1;
    let headerSample: string[] = [];

    for (let r = 0; r < Math.min(3, table.rows.length); r++) {
      const row = table.rows[r];
      const cellTexts = row.cells.map((c) => c.text.trim());
      const detected = detectColumnMapping(cellTexts);
      if (detected) {
        colMap = detected;
        headerRowIdx = r;
        headerSample = cellTexts;
        break;
      }
    }

    if (!colMap || headerRowIdx === -1) continue;

    const items: BudgetItemAudit[] = [];
    let itemsWithMathErrors = 0;
    let itemsWithRoundingWarnings = 0;
    let sumDeclaredCents = 0;
    let sumExpectedCents = 0;
    let tableDeclaredTotalRowCents: number | undefined;
    let tableDeclaredTotalRowRaw: string | undefined;

    for (let r = headerRowIdx + 1; r < table.rows.length; r++) {
      const row = table.rows[r];
      const cells = row.cells;
      const rowFullText = cells.map((c) => c.text).join(" ").trim();
      if (!rowFullText) continue;

      // Verifica se é linha de Total Geral / Subtotal
      if (isSummaryRow(rowFullText)) {
        for (let c = cells.length - 1; c >= 0; c--) {
          const parsed = parseMonetaryValueToCents(cells[c].text);
          if (parsed.isValid && parsed.cents > 0) {
            tableDeclaredTotalRowCents = parsed.cents;
            tableDeclaredTotalRowRaw = parsed.raw;
            break;
          }
        }
        continue;
      }

      const itemCoord = `[T${table.index}.R${r}]`;
      const itemNum =
        colMap.itemCol !== -1 && cells[colMap.itemCol]
          ? cells[colMap.itemCol].text.trim()
          : `Item ${items.length + 1}`;
      const desc =
        colMap.descCol !== -1 && cells[colMap.descCol]
          ? cells[colMap.descCol].text.trim()
          : `Linha ${r}`;

      const qtdCell = cells[colMap.qtdCol]?.text || "";
      const unitCell = cells[colMap.unitValCol]?.text || "";
      const totalCell = cells[colMap.totalValCol]?.text || "";

      const parsedQtd = parseQuantity(qtdCell);
      const parsedUnit = parseMonetaryValueToCents(unitCell);
      const parsedTotal = parseMonetaryValueToCents(totalCell);

      if (!parsedQtd.isValid || !parsedUnit.isValid || !parsedTotal.isValid) {
        continue;
      }

      // Cálculo determinístico em centavos inteiros
      const expectedTotalCents = Math.round(
        parsedQtd.value * parsedUnit.cents
      );
      const diffCents = parsedTotal.cents - expectedTotalCents;
      const absDiff = Math.abs(diffCents);

      let severity: BudgetDiscrepancySeverity | undefined;
      let hasError = false;

      if (absDiff > 0) {
        hasError = true;
        if (absDiff <= 2) {
          severity = "ROUNDING_WARNING";
          itemsWithRoundingWarnings++;
        } else {
          severity = "MATH_ERROR";
          itemsWithMathErrors++;
        }
      }

      sumDeclaredCents += parsedTotal.cents;
      sumExpectedCents += expectedTotalCents;

      items.push({
        item_number: itemNum,
        description: desc.length > 70 ? `${desc.slice(0, 67)}...` : desc,
        coord: itemCoord,
        quantity: parsedQtd.value,
        quantity_raw: parsedQtd.raw,
        unit_cents: parsedUnit.cents,
        unit_raw: parsedUnit.raw,
        declared_total_cents: parsedTotal.cents,
        declared_total_raw: parsedTotal.raw,
        expected_total_cents: expectedTotalCents,
        diff_cents: diffCents,
        discrepancy_severity: severity,
        formatted_diff:
          diffCents !== 0 ? formatCentsToCurrency(diffCents) : undefined,
        has_error: hasError,
      });
    }

    if (items.length === 0) continue;

    let tableTotalDiscrepancyCents: number | undefined;
    let tableTotalDiscrepancySeverity: BudgetDiscrepancySeverity | undefined;

    if (tableDeclaredTotalRowCents !== undefined) {
      tableTotalDiscrepancyCents =
        tableDeclaredTotalRowCents - sumExpectedCents;
      const absTableDiff = Math.abs(tableTotalDiscrepancyCents);
      if (absTableDiff > 0) {
        tableTotalDiscrepancySeverity =
          absTableDiff <= 2 ? "ROUNDING_WARNING" : "MATH_ERROR";
      }
    }

    auditedTables.push({
      table_coord: `T${table.index}`,
      header_sample: headerSample,
      total_items: items.length,
      items_with_math_errors: itemsWithMathErrors,
      items_with_rounding_warnings: itemsWithRoundingWarnings,
      items,
      sum_declared_cents: sumDeclaredCents,
      sum_expected_cents: sumExpectedCents,
      table_declared_total_row_cents: tableDeclaredTotalRowCents,
      table_declared_total_row_raw: tableDeclaredTotalRowRaw,
      table_total_discrepancy_cents: tableTotalDiscrepancyCents,
      table_total_discrepancy_severity: tableTotalDiscrepancySeverity,
    });
  }

  return auditedTables;
}

// ============================================================================
// Auditoria em Tabelas PDF (Linhas com ' | ')
// ============================================================================

export function auditPdfLines(lines: PdfLineItem[]): BudgetTableAudit[] {
  const auditedTables: BudgetTableAudit[] = [];
  let currentHeaderMap: ColumnMapping | null = null;
  let currentHeaderSample: string[] = [];
  let currentTableCoord = "";
  let currentItems: BudgetItemAudit[] = [];
  let currentSumDeclared = 0;
  let currentSumExpected = 0;
  let currentItemsWithMathErrors = 0;
  let currentItemsWithRoundingWarnings = 0;
  let currentTotalRowCents: number | undefined;
  let currentTotalRowRaw: string | undefined;

  const flushTable = () => {
    if (currentHeaderMap && currentItems.length > 0) {
      let tableTotalDiscrepancyCents: number | undefined;
      let tableTotalDiscrepancySeverity: BudgetDiscrepancySeverity | undefined;

      if (currentTotalRowCents !== undefined) {
        tableTotalDiscrepancyCents =
          currentTotalRowCents - currentSumExpected;
        const absDiff = Math.abs(tableTotalDiscrepancyCents);
        if (absDiff > 0) {
          tableTotalDiscrepancySeverity =
            absDiff <= 2 ? "ROUNDING_WARNING" : "MATH_ERROR";
        }
      }

      auditedTables.push({
        table_coord: currentTableCoord,
        header_sample: currentHeaderSample,
        total_items: currentItems.length,
        items_with_math_errors: currentItemsWithMathErrors,
        items_with_rounding_warnings: currentItemsWithRoundingWarnings,
        items: currentItems,
        sum_declared_cents: currentSumDeclared,
        sum_expected_cents: currentSumExpected,
        table_declared_total_row_cents: currentTotalRowCents,
        table_declared_total_row_raw: currentTotalRowRaw,
        table_total_discrepancy_cents: tableTotalDiscrepancyCents,
        table_total_discrepancy_severity: tableTotalDiscrepancySeverity,
      });
    }

    currentHeaderMap = null;
    currentHeaderSample = [];
    currentTableCoord = "";
    currentItems = [];
    currentSumDeclared = 0;
    currentSumExpected = 0;
    currentItemsWithMathErrors = 0;
    currentItemsWithRoundingWarnings = 0;
    currentTotalRowCents = undefined;
    currentTotalRowRaw = undefined;
  };

  for (const line of lines) {
    if (!line.text.includes(" | ")) {
      // Se tivermos itens acumulados e a linha de texto não contiver separador colunar,
      // verifica se é continuação multilinha da descrição do item anterior
      if (
        currentItems.length > 0 &&
        !isSummaryRow(line.text) &&
        !/^(?:CL[ÁA]USULA|SE[ÇC][ÃA]O|CAP[IÍ]TULO|ANEXO|OBJETO|VALOR)\b/i.test(line.text.trim()) &&
        line.text.trim().length > 0 &&
        line.text.trim().length < 120
      ) {
        const lastItem = currentItems[currentItems.length - 1];
        lastItem.description = `${lastItem.description} ${line.text.trim()}`
          .replace(/\s+/g, " ")
          .trim();
        if (lastItem.description.length > 120) {
          lastItem.description = `${lastItem.description.slice(0, 117)}...`;
        }
      }
      continue;
    }

    const cols = line.text.split(" | ").map((c) => c.trim());
    if (cols.length < 3) continue;

    const detectedMap = detectColumnMapping(cols);
    if (detectedMap) {
      // Se for repetição de cabeçalho idêntico na página seguinte (fusão contínua multi-página):
      const isRepeatedMultiPageHeader =
        currentHeaderMap !== null &&
        currentItems.length > 0 &&
        currentHeaderMap.itemCol === detectedMap.itemCol &&
        currentHeaderMap.qtdCol === detectedMap.qtdCol &&
        currentHeaderMap.unitValCol === detectedMap.unitValCol &&
        currentHeaderMap.totalValCol === detectedMap.totalValCol;

      if (isRepeatedMultiPageHeader) {
        // Tabela contínua multi-página: não encerra a tabela, apenas ignora a linha de cabeçalho repetido
        continue;
      }

      // Novo cabeçalho de tabela distinta detectado
      flushTable();
      currentHeaderMap = detectedMap;
      currentHeaderSample = cols;
      currentTableCoord = `PAG_${String(line.page).padStart(3, "0")}`;
      continue;
    }

    if (!currentHeaderMap) continue;

    // Verifica se é linha de Total / Subtotal
    if (isSummaryRow(line.text)) {
      for (let c = cols.length - 1; c >= 0; c--) {
        const parsed = parseMonetaryValueToCents(cols[c]);
        if (parsed.isValid && parsed.cents > 0) {
          currentTotalRowCents = parsed.cents;
          currentTotalRowRaw = parsed.raw;
          break;
        }
      }
      continue;
    }

    const itemNum =
      currentHeaderMap.itemCol !== -1 && cols[currentHeaderMap.itemCol]
        ? cols[currentHeaderMap.itemCol]
        : `Item ${currentItems.length + 1}`;
    const desc =
      currentHeaderMap.descCol !== -1 && cols[currentHeaderMap.descCol]
        ? cols[currentHeaderMap.descCol]
        : line.text;

    const qtdCell = cols[currentHeaderMap.qtdCol] || "";
    const unitCell = cols[currentHeaderMap.unitValCol] || "";
    const totalCell = cols[currentHeaderMap.totalValCol] || "";

    const parsedQtd = parseQuantity(qtdCell);
    const parsedUnit = parseMonetaryValueToCents(unitCell);
    const parsedTotal = parseMonetaryValueToCents(totalCell);

    if (!parsedQtd.isValid || !parsedUnit.isValid || !parsedTotal.isValid) {
      // Suporte a células multilinha: agrega fragmento textual à descrição do item anterior
      if (currentItems.length > 0 && currentHeaderMap.descCol !== -1) {
        const continuationText = cols[currentHeaderMap.descCol] || line.text.replace(/^[| ]+|[| ]+$/g, "");
        if (continuationText && continuationText.length > 0 && !/^(?:Item|\d+)\b/i.test(continuationText)) {
          const lastItem = currentItems[currentItems.length - 1];
          lastItem.description = `${lastItem.description} ${continuationText}`.replace(/\s+/g, " ").trim();
          if (lastItem.description.length > 120) {
            lastItem.description = `${lastItem.description.slice(0, 117)}...`;
          }
        }
      }
      continue;
    }

    const expectedTotalCents = Math.round(
      parsedQtd.value * parsedUnit.cents
    );
    const diffCents = parsedTotal.cents - expectedTotalCents;
    const absDiff = Math.abs(diffCents);

    let severity: BudgetDiscrepancySeverity | undefined;
    let hasError = false;

    if (absDiff > 0) {
      hasError = true;
      if (absDiff <= 2) {
        severity = "ROUNDING_WARNING";
        currentItemsWithRoundingWarnings++;
      } else {
        severity = "MATH_ERROR";
        currentItemsWithMathErrors++;
      }
    }

    currentSumDeclared += parsedTotal.cents;
    currentSumExpected += expectedTotalCents;

    currentItems.push({
      item_number: itemNum,
      description: desc.length > 70 ? `${desc.slice(0, 67)}...` : desc,
      coord: line.bracket_coord,
      quantity: parsedQtd.value,
      quantity_raw: parsedQtd.raw,
      unit_cents: parsedUnit.cents,
      unit_raw: parsedUnit.raw,
      declared_total_cents: parsedTotal.cents,
      declared_total_raw: parsedTotal.raw,
      expected_total_cents: expectedTotalCents,
      diff_cents: diffCents,
      discrepancy_severity: severity,
      formatted_diff:
        diffCents !== 0 ? formatCentsToCurrency(diffCents) : undefined,
      has_error: hasError,
    });
  }

  flushTable();
  return auditedTables;
}

// ============================================================================
// Cruzamento Textual de Valor Global
// ============================================================================

export function checkTextGlobalValues(
  paragraphs: Array<{ coord: string; text: string }>,
  totalExpectedCents: number
): BudgetTextCrossCheck[] {
  const crossChecks: BudgetTextCrossCheck[] = [];
  if (totalExpectedCents === 0) return crossChecks;

  // Regex flexível de menções de valor global estimado no corpo do documento
  const globalRegex =
    /(?:valor\s+(?:(?:total|global|estimado)\s*)+(?:da\s+contrata[çc][ãa]o\s*)?(?:(?:[eé]\s+de|[eé]|de|no\s+montante\s+de)\s*)?(?:R\$\s*)?)([\d\.,]+)/gi;

  for (const p of paragraphs) {
    let match: RegExpExecArray | null;
    while ((match = globalRegex.exec(p.text)) !== null) {
      const rawVal = match[1];
      const parsed = parseMonetaryValueToCents(rawVal);
      if (!parsed.isValid || parsed.cents < 10000) continue; // Descarta valores minúsculos (< R$ 100)

      const diffCents = parsed.cents - totalExpectedCents;
      const absDiff = Math.abs(diffCents);

      if (absDiff > 0) {
        const severity: BudgetDiscrepancySeverity =
          absDiff <= 2 ? "ROUNDING_WARNING" : "MATH_ERROR";

        crossChecks.push({
          text_coord: p.coord,
          snippet: p.text.length > 90 ? `${p.text.slice(0, 87)}...` : p.text,
          text_value_cents: parsed.cents,
          text_value_raw: parsed.raw,
          table_sum_cents: totalExpectedCents,
          diff_cents: diffCents,
          discrepancy_severity: severity,
        });
      }
    }
  }

  return crossChecks;
}

// ============================================================================
// Orquestrador Central da Auditoria Orçamentária
// ============================================================================

export function auditDocumentBudget(options: {
  docxTables?: TableInfo[];
  docxParagraphs?: BodyParagraphInfo[];
  pdfLines?: PdfLineItem[];
}): BudgetAuditReport {
  let tables: BudgetTableAudit[] = [];

  if (options.docxTables && options.docxTables.length > 0) {
    tables = auditDocxTables(options.docxTables);
  } else if (options.pdfLines && options.pdfLines.length > 0) {
    tables = auditPdfLines(options.pdfLines);
  }

  let totalItemsChecked = 0;
  let mathErrorsCount = 0;
  let roundingWarningsCount = 0;
  let totalDeclaredCents = 0;
  let totalExpectedCents = 0;

  for (const t of tables) {
    totalItemsChecked += t.total_items;
    mathErrorsCount += t.items_with_math_errors;
    roundingWarningsCount += t.items_with_rounding_warnings;
    totalDeclaredCents += t.sum_declared_cents;
    totalExpectedCents += t.sum_expected_cents;
  }

  const netDivergenceCents = totalDeclaredCents - totalExpectedCents;

  // Cruzamento com o corpo do texto
  const textEntries: Array<{ coord: string; text: string }> = [];
  if (options.docxParagraphs) {
    for (const p of options.docxParagraphs) {
      textEntries.push({ coord: `[P${p.index}]`, text: p.text });
    }
  } else if (options.pdfLines) {
    for (const l of options.pdfLines) {
      if (!l.text.includes(" | ")) {
        textEntries.push({ coord: l.bracket_coord, text: l.text });
      }
    }
  }

  const textCrossChecks = checkTextGlobalValues(
    textEntries,
    totalExpectedCents
  );

  return {
    has_budget_table: tables.length > 0,
    tables_checked: tables.length,
    total_items_checked: totalItemsChecked,
    math_errors_count: mathErrorsCount,
    rounding_warnings_count: roundingWarningsCount,
    total_declared_cents: totalDeclaredCents,
    total_expected_cents: totalExpectedCents,
    net_divergence_cents: netDivergenceCents,
    tables,
    text_cross_checks: textCrossChecks,
  };
}

// ============================================================================
// Injeção Automática no Radar das 14 Zonas (Z10 e Z12)
// ============================================================================

export function injectBudgetAuditIntoImpugnationZones(
  report: BudgetAuditReport,
  zones: ImpugnationZonesMap
): void {
  if (!report.has_budget_table) return;

  // Injeção de erros de cálculo na Z10_PRECOS_EXEQUIBILIDADE_PLANILHA
  for (const table of report.tables) {
    for (const item of table.items) {
      if (item.has_error) {
        const isMathError = item.discrepancy_severity === "MATH_ERROR";
        const label = isMathError
          ? "ERRO ARITMÉTICO NA PLANILHA"
          : "ALERTA DE ARREDONDAMENTO NA PLANILHA";

        zones.Z10_PRECOS_EXEQUIBILIDADE_PLANILHA.push({
          coord: item.coord,
          keyword: label,
          snippet: `${item.item_number} (${item.description}): Qtd ${item.quantity_raw} x Unit ${item.unit_raw} = Decl ${item.declared_total_raw} | Esperado: ${formatCentsToCurrency(item.expected_total_cents)} (Dif: ${formatCentsToCurrency(item.diff_cents)})`,
          section: `PLANILHA_ORCAMENTARIA_${table.table_coord}`,
        });
      }
    }

    // Divergência na linha de Total Geral da tabela
    if (
      table.table_total_discrepancy_cents &&
      table.table_total_discrepancy_cents !== 0
    ) {
      const isMathError =
        table.table_total_discrepancy_severity === "MATH_ERROR";
      const label = isMathError
        ? "DIVERGÊNCIA NO TOTAL GERAL DA PLANILHA"
        : "ALERTA DE ARREDONDAMENTO NO TOTAL GERAL DA PLANILHA";

      zones.Z10_PRECOS_EXEQUIBILIDADE_PLANILHA.push({
        coord: table.table_coord,
        keyword: label,
        snippet: `Total Declarado: ${table.table_declared_total_row_raw} vs Soma Calculada dos Itens: ${formatCentsToCurrency(table.sum_expected_cents)} (Dif: ${formatCentsToCurrency(table.table_total_discrepancy_cents)})`,
        section: `PLANILHA_ORCAMENTARIA_${table.table_coord}`,
      });
    }
  }

  // Injeção de divergências entre Planilha e Texto na Z12_MAPA_CRUZADO_MULTIPECA
  for (const cross of report.text_cross_checks) {
    zones.Z12_MAPA_CRUZADO_MULTIPECA.push({
      coord: `${cross.text_coord} <-> PLANILHA`,
      keyword: "DIVERGÊNCIA VALOR GLOBAL TEXTO VS PLANILHA",
      snippet: `Texto declara ${cross.text_value_raw} em ${cross.text_coord}, mas somatório da planilha é ${formatCentsToCurrency(cross.table_sum_cents)} (Dif: ${formatCentsToCurrency(cross.diff_cents)})`,
      section: "CRUZAMENTO_VALOR_GLOBAL_TEXTO_VS_PLANILHA",
    });
  }
}

// ============================================================================
// Renderizador do Bloco Markdown de Auditoria Orçamentária
// ============================================================================

export function formatBudgetAuditMarkdownBlock(
  report: BudgetAuditReport
): string {
  if (!report.has_budget_table) {
    return "";
  }

  const lines: string[] = [];
  lines.push("## 📊 Auditoria Matemática de Planilha Orçamentária (v1.1.0)");
  lines.push("");

  const statusBadge =
    report.math_errors_count > 0
      ? "🔴 **ERROS ARITMÉTICOS DETECTADOS**"
      : report.rounding_warnings_count > 0
      ? "🟡 **ALERTAS DE ARREDONDAMENTO DETECTADOS**"
      : "🟢 **PLANILHA 100% CONFORME E ARITMETICAMENTE EXATA**";

  lines.push(`**Status Global:** ${statusBadge}`);
  lines.push(
    `- **Tabelas Inspecionadas:** ${report.tables_checked} | **Total de Itens Auditados:** ${report.total_items_checked}`
  );
  lines.push(
    `- **Erros Aritméticos Bloqueantes (> R$ 0,02):** ${report.math_errors_count} item(ns)`
  );
  lines.push(
    `- **Alertas de Arredondamento (≤ R$ 0,02):** ${report.rounding_warnings_count} item(ns)`
  );
  lines.push(
    `- **Valor Global Declarado:** ${formatCentsToCurrency(report.total_declared_cents)} | **Valor Global Calculado:** ${formatCentsToCurrency(report.total_expected_cents)}`
  );
  if (report.net_divergence_cents !== 0) {
    lines.push(
      `- **Divergência Líquida Acumulada:** \`${formatCentsToCurrency(report.net_divergence_cents)}\``
    );
  }
  lines.push("");

  for (const table of report.tables) {
    lines.push(`### Tabela Orçamentária \`${table.table_coord}\``);
    lines.push(
      `*Cabeçalho:* \`${table.header_sample.slice(0, 5).join(" | ")}\``
    );
    lines.push(
      `*Somatório Itens:* Declarado: \`${formatCentsToCurrency(table.sum_declared_cents)}\` | Calculado: \`${formatCentsToCurrency(table.sum_expected_cents)}\``
    );
    if (table.table_declared_total_row_raw) {
      lines.push(
        `*Linha Total Geral:* \`${table.table_declared_total_row_raw}\`${table.table_total_discrepancy_cents ? ` (Divergência: \`${formatCentsToCurrency(table.table_total_discrepancy_cents)}\`)` : ""}`
      );
    }
    lines.push("");

    const erroneousItems = table.items.filter((i) => i.has_error);
    if (erroneousItems.length > 0) {
      lines.push(
        "| Coord | Item | Qtd | Valor Unit. | Declarado | Calculado Exato | Divergência | Severidade |"
      );
      lines.push(
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |"
      );
      for (const item of erroneousItems) {
        const sev =
          item.discrepancy_severity === "MATH_ERROR"
            ? "🔴 `MATH_ERROR`"
            : "🟡 `ROUNDING_WARNING`";
        lines.push(
          `| \`${item.coord}\` | ${item.item_number} | ${item.quantity_raw} | ${item.unit_raw} | ${item.declared_total_raw} | ${formatCentsToCurrency(item.expected_total_cents)} | \`${item.formatted_diff}\` | ${sev} |`
        );
      }
      lines.push("");
    } else {
      lines.push("*(Todos os itens conferidos estão aritmeticamente exatos).*");
      lines.push("");
    }
  }

  if (report.text_cross_checks.length > 0) {
    lines.push(
      "### ⚠️ Divergências entre Planilha e Menções no Texto (Cruzamento Z12)"
    );
    lines.push("");
    for (const cross of report.text_cross_checks) {
      lines.push(
        `- **Coord:** \`${cross.text_coord}\` | **Valor no Texto:** \`${cross.text_value_raw}\` | **Soma da Planilha:** \`${formatCentsToCurrency(cross.table_sum_cents)}\` | **Divergência:** \`${formatCentsToCurrency(cross.diff_cents)}\``
      );
      lines.push(`  *Trecho:* "${cross.snippet}"`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
