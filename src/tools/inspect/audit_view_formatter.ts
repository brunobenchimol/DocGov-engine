import { relative } from "node:path";
import { VERSION } from "../../constants/index.ts";
import {
  buildDocxCartography,
  renderCartographyMarkdownBlock,
  type DocumentCartography,
} from "../../core/cartography.ts";
import { formatBudgetAuditMarkdownBlock } from "../../core/budget_auditor.ts";
import type {
  BodyParagraphInfo,
  TableInfo,
  DocxTocMap,
  TocParagraphItem,
  TocFormCellItem,
  TocTableItem,
  DocxInspectionResult,
  PdfExtractionResult,
} from "../../types/index.ts";
import { scanPostCompileIntegrityAlerts } from "./integrity_scanner.ts";
import { detectTableSubtablesAndCheckboxes } from "./document_pipelines.ts";

// ============================================================================
// Formatação de Visão Linear de Auditoria e TOC Map (ENG-02, 07, 11)
// ============================================================================

export function buildTocMap(
  paragraphs: BodyParagraphInfo[],
  tables: TableInfo[]
): DocxTocMap {
  const sections: TocParagraphItem[] = [];
  const form_fields: TocFormCellItem[] = [];
  const tocTables: TocTableItem[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const text = p.text.trim();
    if (!text || text.length > 150) continue;

    const hasHeadingStyle =
      p.style !== null &&
      /^(?:Heading|Titulo|Título|T[ií]tulo|Header|Se[çc][ãa]o)/i.test(p.style);

    const isNumberedSection =
      /^(?:(?:\d+(?:\.\d+)*|[A-Z]|\b[IVXLCDM]+\b)[\.\-\)\s]|CL[ÁA]USULA|SE[ÇC][ãA]O|CAP[IÍ]TULO|ANEXO)\s+[A-ZÀ-Ú0-9]/i.test(
        text
      );

    const isCommonAdminHeader =
      /^(?:ESTUDO T[EÉ]CNICO PRELIMINAR|TERMO DE REFER[EÊ]NCIA|PROJETO B[AÁ]SICO|JUSTIFICATIVA|OBJETO(?:\s+DA\s+CONTRATA[ÇC][ãA]O)?|DISPOSI[ÇC][ÕO]ES GERAIS|MATRIZ DE RISCOS|CRONOGRAMA|PESQUISA DE PRE[ÇC]OS|CRIT[EÉ]RIOS DE HABILITA[ÇC][ãA]O|DISPOSI[ÇC][ÕO]ES FINAIS)\b/i.test(
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

  for (const tbl of tables) {
    for (let rIdx = 0; rIdx < tbl.rows.length; rIdx++) {
      const row = tbl.rows[rIdx];
      const physicalCells = row.cells.filter((c) => !c.isSpanPlaceholder);
      for (let cIdx = 0; cIdx < physicalCells.length; cIdx++) {
        const cell = physicalCells[cIdx];
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

          if (cIdx + 1 < physicalCells.length) {
            const nextCell = physicalCells[cIdx + 1];
            const nextPhysIdx = nextCell.physicalCellIndex ?? nextCell.cellIndex;
            suggestedTarget = `T${tbl.index}.R${row.rowIndex}.C${nextPhysIdx}`;
          } else if (rIdx + 1 < tbl.rows.length) {
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

  lines.push(...renderCartographyMarkdownBlock(cartography));

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

  lines.push("## Bloco 2: Conteúdo Integral Estruturado");
  lines.push("");

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
