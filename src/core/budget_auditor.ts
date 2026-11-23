import type {
  TableInfo,
  BodyParagraphInfo,
  PdfLineItem,
  BudgetAuditReport,
  BudgetTableAudit,
  BudgetItemAudit,
  BudgetDiscrepancySeverity,
  ImpugnationZonesMap,
} from "../types/index.ts";
import {
  formatCentsToCurrency,
  parseMonetaryValueToCents,
  parseQuantity,
  type ColumnMapping,
  detectColumnMapping,
  isSummaryRow,
  auditPdfLines,
  checkTextGlobalValues,
} from "./budget_pdf_scanner.ts";

export {
  formatCentsToCurrency,
  parseMonetaryValueToCents,
  parseQuantity,
  auditPdfLines,
  checkTextGlobalValues,
} from "./budget_pdf_scanner.ts";
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
