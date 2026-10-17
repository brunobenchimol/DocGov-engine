import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { safeReadJsonFile } from "../utils/json.ts";
import { normalizeSlotsManifest, countManifestRules } from "./manifest.ts";
import type {
  DocxInspectionResult,
  StructureFingerprint,
  TableFingerprint,
  FormFieldFingerprint,
  TemplateRegistryEntry,
  SlotsManifest,
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
      if (r.cells.length > maxCols) maxCols = r.cells.length;
    }
    const firstRow = tbl.rows[0];
    const headers = firstRow
      ? firstRow.cells
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
    for (const f of inspection.toc_map.form_fields) {
      const norm = normalizeStructuralText(f.title);
      if (norm) {
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

export function getTemplateRegistryDir(
  hintPath?: string,
  customDir?: string
): string {
  if (customDir) {
    return resolve(customDir);
  }
  if (process.env.DOCGOV_REGISTRY_DIR) {
    return resolve(process.env.DOCGOV_REGISTRY_DIR);
  }
  if (hintPath) {
    try {
      let current = resolve(hintPath);
      if (existsSync(current)) {
        const st = statSync(current);
        if (st.isFile()) {
          current = dirname(current);
        }
      } else if (extname(current)) {
        current = dirname(current);
      }

      // Procura subindo até a raiz do workspace (onde houver core/registry, cases ou package.json)
      let checkDir = current;
      for (let i = 0; i < 6; i++) {
        const regCandidate = resolve(checkDir, "core", "registry", "templates");
        if (existsSync(regCandidate)) {
          return regCandidate;
        }
        const casesCandidate = resolve(checkDir, "cases");
        const pkgCandidate = resolve(checkDir, "package.json");
        if (existsSync(casesCandidate) || existsSync(pkgCandidate)) {
          return resolve(checkDir, "core", "registry", "templates");
        }
        const parent = dirname(checkDir);
        if (parent === checkDir) break;
        checkDir = parent;
      }
    } catch {
      // fallback
    }
  }

  try {
    const metaDir = (import.meta as any).dir || process.cwd();
    // Busca multi-nível para funcionar tanto em src/core quanto em bin/ ou src/
    for (const rel of [
      "../core/registry/templates",
      "../../core/registry/templates",
      "../../../core/registry/templates",
      "core/registry/templates",
    ]) {
      const candidate = resolve(metaDir, rel);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  } catch {
    // fallback
  }

  return resolve(process.cwd(), "core", "registry", "templates");
}

export function saveTemplateToRegistry(
  templateId: string,
  manifest: SlotsManifest,
  fingerprint: StructureFingerprint,
  hintPath?: string,
  registryDir?: string
): string {
  const cleanId = templateId.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  const dir = getTemplateRegistryDir(hintPath, registryDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const filePath = resolve(dir, `${cleanId}.json`);
  const normalizedManifest = normalizeSlotsManifest(manifest);
  const entry: TemplateRegistryEntry = {
    template_id: cleanId,
    created_at: new Date().toISOString(),
    structure_fingerprint: fingerprint,
    manifest: normalizedManifest,
  };
  writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");
  return filePath;
}

export function loadAllRegistryTemplates(
  hintPath?: string,
  registryDir?: string
): TemplateRegistryEntry[] {
  const dir = getTemplateRegistryDir(hintPath, registryDir);
  if (!existsSync(dir)) return [];
  const entries: TemplateRegistryEntry[] = [];
  try {
    const files = readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
      if (f.isFile() && f.name.toLowerCase().endsWith(".json")) {
        const fullPath = resolve(dir, f.name);
        try {
          const item = safeReadJsonFile<TemplateRegistryEntry>(fullPath);
          if (
            item &&
            item.template_id &&
            item.structure_fingerprint &&
            item.manifest
          ) {
            item.manifest = normalizeSlotsManifest(item.manifest);
            const ruleCount = countManifestRules(item.manifest);
            if (ruleCount > 0) {
              item.registry_path = fullPath;
              entries.push(item);
            }
          }
        } catch {
          // ignora template com erro
        }
      }
    }
  } catch {
    // ignora erro de leitura
  }
  return entries;
}

export function findBestTemplateMatch(
  incomingFp: StructureFingerprint,
  hintPath?: string,
  registryDir?: string
): { entry?: TemplateRegistryEntry; similarity: number } {
  const templates = loadAllRegistryTemplates(hintPath, registryDir);
  if (templates.length === 0) {
    return { similarity: 0 };
  }
  let bestEntry: TemplateRegistryEntry | undefined;
  let bestSim = 0;
  for (const t of templates) {
    const sim = computeStructuralSimilarity(incomingFp, t.structure_fingerprint);
    if (sim > bestSim) {
      bestSim = sim;
      bestEntry = t;
    }
  }
  return { entry: bestEntry, similarity: bestSim };
}

export function reanchorSlotsManifest(
  cachedEntry: TemplateRegistryEntry,
  incomingFp: StructureFingerprint,
  incomingInspection: DocxInspectionResult
): SlotsManifest & { _shift_summary?: string } {
  const normalizedManifest = normalizeSlotsManifest(cachedEntry.manifest);
  const adapted: SlotsManifest & { _shift_summary?: string } = JSON.parse(
    JSON.stringify(normalizedManifest)
  );
  const shiftsDetected: string[] = [];

  // 1. replace_table_cells (Reancoragem por correspondência de rótulo)
  if (adapted.replace_table_cells && adapted.replace_table_cells.length > 0) {
    for (const rule of adapted.replace_table_cells) {
      const origTargetCoord = `T${rule.table_index}.R${rule.row_index}.C${rule.cell_index}`;

      const cachedPrompt = cachedEntry.structure_fingerprint.form_fields.find(
        (f) =>
          f.suggested_target_slot === origTargetCoord ||
          f.coord ===
            `T${rule.table_index}.R${rule.row_index}.C${rule.cell_index - 1}` ||
          f.coord ===
            `T${rule.table_index}.R${rule.row_index - 1}.C${rule.cell_index}`
      );

      if (cachedPrompt) {
        const incomingPrompt = incomingFp.form_fields.find(
          (f) => f.label_normalized === cachedPrompt.label_normalized
        );
        if (incomingPrompt) {
          let newTable = rule.table_index;
          let newRow = rule.row_index;
          let newCol = rule.cell_index;

          if (incomingPrompt.suggested_target_slot) {
            const m = incomingPrompt.suggested_target_slot.match(
              /^T(\d+)\.R(\d+)\.C(\d+)$/
            );
            if (m) {
              newTable = parseInt(m[1], 10);
              newRow = parseInt(m[2], 10);
              newCol = parseInt(m[3], 10);
            }
          } else {
            const mOrig = cachedPrompt.coord.match(/^T(\d+)\.R(\d+)\.C(\d+)$/);
            const mIn = incomingPrompt.coord.match(/^T(\d+)\.R(\d+)\.C(\d+)$/);
            if (mOrig && mIn) {
              const deltaR = parseInt(mIn[2], 10) - parseInt(mOrig[2], 10);
              newRow = rule.row_index + deltaR;
              newTable = parseInt(mIn[1], 10);
            }
          }

          if (
            newRow !== rule.row_index ||
            newCol !== rule.cell_index ||
            newTable !== rule.table_index
          ) {
            shiftsDetected.push(
              `T${rule.table_index}.R${rule.row_index}.C${rule.cell_index} -> T${newTable}.R${newRow}.C${newCol} ('${cachedPrompt.original_label}')`
            );
            rule.table_index = newTable;
            rule.row_index = newRow;
            rule.cell_index = newCol;
          }
        }
      }
    }
  }

  // 2. loop_table_rows (Reancoragem por correspondência de cabeçalho)
  if (adapted.loop_table_rows && adapted.loop_table_rows.length > 0) {
    for (const rule of adapted.loop_table_rows) {
      const cachedT = cachedEntry.structure_fingerprint.tables.find(
        (t) => t.index === rule.table_index
      );
      const incomingT = incomingInspection.tables.find(
        (t) => t.index === rule.table_index
      );

      if (cachedT && incomingT && cachedT.headers.length > 0) {
        let newHeaderRow = -1;
        for (let rIdx = 0; rIdx < incomingT.rows.length; rIdx++) {
          const rowTexts = incomingT.rows[rIdx].cells.map((c) =>
            normalizeStructuralText(c.text)
          );
          const matchCount = cachedT.headers.filter((h) =>
            rowTexts.some((rt) => rt.includes(h) || h.includes(rt))
          ).length;
          if (matchCount >= Math.min(2, cachedT.headers.length)) {
            newHeaderRow = rIdx;
            break;
          }
        }

        if (newHeaderRow !== -1 && newHeaderRow !== rule.header_row_index) {
          const delta = newHeaderRow - rule.header_row_index;
          shiftsDetected.push(
            `T${rule.table_index} (loop): cabeçalho deslocado em ${
              delta > 0 ? "+" + delta : delta
            } linha(s) (R${rule.header_row_index} -> R${newHeaderRow})`
          );
          rule.header_row_index += delta;
          rule.template_row_index += delta;
          if (rule.remove_from_row !== undefined) rule.remove_from_row += delta;
          if (rule.remove_to_row !== undefined) rule.remove_to_row += delta;
        }
      }
    }
  }

  // 3. replace_paragraphs e loop_paragraphs
  const adjustParagraphRule = (
    rule: { start_p: number; end_p: number },
    ruleType: string
  ) => {
    const origSection = cachedEntry.structure_fingerprint.sections[0];
    if (origSection && incomingFp.sections.includes(origSection)) {
      if (
        incomingInspection.toc_map &&
        incomingInspection.toc_map.sections.length > 0
      ) {
        const matchingSec = incomingInspection.toc_map.sections.find(
          (s) => normalizeStructuralText(s.title) === origSection
        );
        if (matchingSec) {
          const newP = parseInt(matchingSec.coord.replace(/^P/, ""), 10);
          const origP = rule.start_p > 0 ? rule.start_p - 1 : 0;
          const delta = newP - origP;
          if (delta !== 0 && Math.abs(delta) < 20) {
            shiftsDetected.push(
              `${ruleType}: parágrafos P${rule.start_p}..P${
                rule.end_p
              } deslocados em ${delta > 0 ? "+" + delta : delta}`
            );
            rule.start_p += delta;
            rule.end_p += delta;
          }
        }
      }
    }
  };

  if (adapted.replace_paragraphs) {
    for (const r of adapted.replace_paragraphs) {
      adjustParagraphRule(r, "replace_paragraphs");
    }
  }
  if (adapted.loop_paragraphs) {
    for (const r of adapted.loop_paragraphs) {
      adjustParagraphRule(r, "loop_paragraphs");
    }
  }

  adapted._shift_summary =
    shiftsDetected.length > 0
      ? shiftsDetected.join("; ")
      : "Nenhum deslocamento necessário.";

  return adapted;
}

