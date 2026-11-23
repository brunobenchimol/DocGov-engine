import type {
  BodyParagraphInfo,
  PdfLineItem,
  BudgetTableAudit,
  BudgetItemAudit,
  BudgetTextCrossCheck,
  BudgetDiscrepancySeverity,
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

export interface ColumnMapping {
  itemCol: number;
  descCol: number;
  unitCol: number;
  qtdCol: number;
  unitValCol: number;
  totalValCol: number;
}

export function detectColumnMapping(headers: string[]): ColumnMapping | null {
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

export function isSummaryRow(rowText: string): boolean {
  const norm = rowText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return /^(?:TOTAL|VALOR\s*GLOBAL|TOTAL\s*GERAL|VALOR\s*TOTAL|SUBTOTAL)\b/.test(
    norm.trim()
  );
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
