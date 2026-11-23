import type {
  DocxInspectionResult,
  StructureFingerprint,
  TableFingerprint,
  FormFieldFingerprint,
} from "../types/index.ts";
// ============================================================================
// 1b. Cache Global de Templates, Fingerprint e Reancoragem Automática (v0.6.0)
// ============================================================================

export function normalizeStructuralText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeStructureFingerprint(
  inspection: DocxInspectionResult
): StructureFingerprint {
  const tables: TableFingerprint[] = (inspection.tables || []).map((tbl) => {
    let maxCols = 0;
    for (const r of tbl.rows) {
      const physicalCells = r.cells.filter((c) => !c.isSpanPlaceholder);
      if (physicalCells.length > maxCols) maxCols = physicalCells.length;
    }
    const firstRow = tbl.rows[0];
    const headers = firstRow
      ? firstRow.cells
          .filter((c) => !c.isSpanPlaceholder && c.rowSpan !== "continue")
          .map((c) => normalizeStructuralText(c.text))
          .filter((t) => t.length > 0)
      : [];
    return {
      index: tbl.index,
      rows: tbl.rows.length,
      cols: maxCols,
      coord: `T${tbl.index}`,
      headers,
    };
  });

  const sections: string[] = [];
  if (inspection.toc_map?.sections) {
    for (const s of inspection.toc_map.sections) {
      const norm = normalizeStructuralText(s.title);
      if (norm && !sections.includes(norm)) {
        sections.push(norm);
      }
    }
  }

  const form_fields: FormFieldFingerprint[] = [];
  if (inspection.toc_map?.form_fields) {
    const seenLabels = new Set<string>();
    for (const f of inspection.toc_map.form_fields) {
      const norm = normalizeStructuralText(f.title);
      // Evitar duplicações decorrentes de vMerge/gridSpan na mesma tabela
      const tableKey = f.coord.split(".")[0];
      const dedupKey = `${tableKey}:${norm}`;
      if (norm && !seenLabels.has(dedupKey)) {
        seenLabels.add(dedupKey);
        form_fields.push({
          coord: f.coord,
          label_normalized: norm,
          original_label: f.title,
          suggested_target_slot: f.suggested_target_slot,
        });
      }
    }
  }

  return {
    tables,
    sections,
    form_fields,
  };
}

export function computeStructuralSimilarity(
  fpA: StructureFingerprint,
  fpB: StructureFingerprint
): number {
  // Verificação de igualdade exata imediata
  if (
    fpA.tables.length === fpB.tables.length &&
    fpA.tables.every(
      (t, i) =>
        t.rows === fpB.tables[i]?.rows && t.cols === fpB.tables[i]?.cols
    ) &&
    fpA.sections.length === fpB.sections.length &&
    fpA.sections.every((s, i) => s === fpB.sections[i]) &&
    fpA.form_fields.length === fpB.form_fields.length &&
    fpA.form_fields.every(
      (f, i) => f.label_normalized === fpB.form_fields[i]?.label_normalized
    )
  ) {
    return 1.0;
  }

  // 1. Similaridade de campos de formulário (rótulos/perguntas)
  let formFieldsSim: number | null = null;
  const labelsA = fpA.form_fields.map((f) => f.label_normalized);
  const labelsB = fpB.form_fields.map((f) => f.label_normalized);
  if (labelsA.length === 0 && labelsB.length === 0) {
    formFieldsSim = null;
  } else if (labelsA.length === 0 || labelsB.length === 0) {
    formFieldsSim = 0;
  } else {
    const setA = new Set(labelsA);
    const setB = new Set(labelsB);
    let intersectCount = 0;
    for (const x of setA) {
      if (setB.has(x)) intersectCount++;
    }
    formFieldsSim = (2 * intersectCount) / (setA.size + setB.size);
  }

  // 2. Similaridade de seções
  let sectionsSim: number | null = null;
  const secA = new Set(fpA.sections);
  const secB = new Set(fpB.sections);
  if (secA.size === 0 && secB.size === 0) {
    sectionsSim = null;
  } else if (secA.size === 0 || secB.size === 0) {
    sectionsSim = 0;
  } else {
    let intersectCount = 0;
    for (const x of secA) {
      if (secB.has(x)) intersectCount++;
    }
    sectionsSim = (2 * intersectCount) / (secA.size + secB.size);
  }

  // 3. Similaridade de tabelas
  let tablesSim = 1.0;
  if (fpA.tables.length === 0 && fpB.tables.length === 0) {
    tablesSim = 1.0;
  } else if (fpA.tables.length === 0 || fpB.tables.length === 0) {
    tablesSim = 0;
  } else {
    let matched = 0;
    const maxLen = Math.max(fpA.tables.length, fpB.tables.length);
    for (const tB of fpB.tables) {
      const matchA = fpA.tables.find((tA) => {
        // Se houver coincidência substancial de cabeçalhos, tolera divergência de colunas por gridSpan
        if (tB.headers.length > 0 && tA.headers.length > 0) {
          const overlap = tB.headers.filter((h) => tA.headers.includes(h)).length;
          const hRatio = (2 * overlap) / (tA.headers.length + tB.headers.length);
          if (hRatio >= 0.5) {
            return true;
          }
        }
        if (tA.cols === tB.cols && tB.cols > 0) {
          if (tB.headers.length > 0 && tA.headers.length > 0) {
            const hOverlap = tB.headers.filter((h) =>
              tA.headers.includes(h)
            ).length;
            return hOverlap > 0 || tA.index === tB.index;
          }
          return tA.index === tB.index;
        }
        return false;
      });

      if (matchA) {
        const rowDiff = Math.abs(matchA.rows - tB.rows);
        const rowScore = Math.max(
          0,
          1 - rowDiff / Math.max(matchA.rows, tB.rows, 1)
        );
        matched += 0.5 + 0.5 * rowScore;
      }
    }
    tablesSim = Math.min(1, matched / maxLen);
  }

  let composite: number;
  if (formFieldsSim !== null && sectionsSim !== null) {
    composite = 0.5 * formFieldsSim + 0.3 * sectionsSim + 0.2 * tablesSim;
  } else if (formFieldsSim !== null) {
    composite = 0.7 * formFieldsSim + 0.3 * tablesSim;
  } else if (sectionsSim !== null) {
    composite = 0.7 * sectionsSim + 0.3 * tablesSim;
  } else {
    composite = tablesSim;
  }

  return Number(Math.min(1, Math.max(0, composite)).toFixed(4));
}
