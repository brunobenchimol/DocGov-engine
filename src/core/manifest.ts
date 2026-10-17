import type { SlotsManifest } from "../types/index.ts";
import { createSlotsManifestContractError } from "../contracts/errors.ts";

// ============================================================================
// Normalizador Universal de Manifesto e Contagem de Regras (v0.6.2)
// ============================================================================

export function normalizeSlotsManifest(rawManifest: any): SlotsManifest {
  if (!rawManifest || typeof rawManifest !== "object") {
    return {};
  }

  const result: SlotsManifest = {
    replace_paragraphs: [],
    loop_paragraphs: [],
    replace_table_cells: [],
    loop_table_rows: [],
    replace_inline: [],
  };

  const tableCoordRegex =
    /^\s*\[?\s*T(\d+)\s*[\.:]\s*R(\d+)\s*[\.:]\s*C(\d+)\s*\]?\s*$/i;
  const paraCoordRegex =
    /^\s*\[?\s*P(\d+)(?:\s*(?:\.\.|[-.:])\s*P?(\d+))?\s*\]?\s*$/i;

  const ALLOWED_ROOT_KEYS = new Set([
    "slots",
    "replace_paragraphs",
    "loop_paragraphs",
    "replace_table_cells",
    "loop_table_rows",
    "replace_inline",
    "_shift_summary",
    "comment",
    "target_docx",
    "source_docx",
  ]);

  if (!Array.isArray(rawManifest)) {
    for (const k of Object.keys(rawManifest)) {
      if (!ALLOWED_ROOT_KEYS.has(k)) {
        throw new Error(
          createSlotsManifestContractError(
            `Chave raiz desconhecida ou não suportada: "${k}".`
          )
        );
      }
    }
  }

  const ALLOWED_LOOP_TABLE_KEYS = new Set([
    "table_index",
    "table",
    "header_row_index",
    "template_row_index",
    "remove_from_row",
    "remove_to_row",
    "for_open_tag",
    "for_close_tag",
    "cell_tags",
  ]);

  const ALLOWED_REPLACE_PARA_KEYS = new Set([
    "start_p",
    "end_p",
    "tag",
    "coord",
    "paragraph_index",
    "p_index",
    "paragraph",
  ]);

  const ALLOWED_REPLACE_CELL_KEYS = new Set([
    "table_index",
    "table",
    "row_index",
    "row",
    "cell_index",
    "col_index",
    "column_index",
    "cell",
    "col",
    "tag",
    "coord",
  ]);

  const ALLOWED_REPLACE_INLINE_KEYS = new Set(["find", "replace"]);

  const ALLOWED_LOOP_PARA_KEYS = new Set([
    "start_p",
    "end_p",
    "for_open_tag",
    "for_close_tag",
    "item_tag",
    "tag",
    "coord",
    "paragraph_index",
    "p_index",
    "paragraph",
  ]);

  const ALLOWED_SLOTS_ITEM_KEYS = new Set([
    "coord",
    "tag",
    "item_tag",
    "for_open_tag",
    "for_close_tag",
    "find",
    "replace",
    "table_index",
    "table",
    "row_index",
    "row",
    "cell_index",
    "col_index",
    "column_index",
    "cell",
    "col",
    "start_p",
    "end_p",
    "paragraph_index",
    "p_index",
    "paragraph",
    "header_row_index",
    "template_row_index",
    "remove_from_row",
    "remove_to_row",
    "cell_tags",
  ]);

  const validateRuleKeys = (
    rule: any,
    allowedSet: Set<string>,
    context: string
  ) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      throw new Error(
        createSlotsManifestContractError(
          `Item inválido em '${context}': esperado objeto de regra, recebido ${typeof rule}.`
        )
      );
    }
    for (const k of Object.keys(rule)) {
      if (!allowedSet.has(k)) {
        let hint = "";
        if (
          k === "loop_var" ||
          k === "items_expr" ||
          k === "cell_slots" ||
          k === "row_index"
        ) {
          hint = ` Não invente propriedades como 'loop_var', 'items_expr', 'cell_slots' ou 'row_index' em '${context}'.`;
        }
        throw new Error(
          createSlotsManifestContractError(
            `Propriedade desconhecida ou proibida "${k}" encontrada em '${context}'.${hint}`
          )
        );
      }
    }
  };

  const processRule = (rule: any, context: string = "slots") => {
    if (!rule || typeof rule !== "object") return;

    // 1. Regra com coord explícita (ex.: "T0.R1.C1", "[T0.R1.C1]", "P2", "[P2]", "P2-P4")
    if (typeof rule.coord === "string" && rule.coord.trim()) {
      const coordStr = rule.coord.trim();
      const tMatch = coordStr.match(tableCoordRegex);
      if (tMatch) {
        result.replace_table_cells!.push({
          table_index: parseInt(tMatch[1], 10),
          row_index: parseInt(tMatch[2], 10),
          cell_index: parseInt(tMatch[3], 10),
          tag: rule.tag !== undefined ? String(rule.tag) : "",
        });
        return;
      }

      const pMatch = coordStr.match(paraCoordRegex);
      if (pMatch) {
        const start_p = parseInt(pMatch[1], 10);
        const end_p =
          pMatch[2] !== undefined ? parseInt(pMatch[2], 10) : start_p;
        if (rule.for_open_tag && rule.for_close_tag) {
          result.loop_paragraphs!.push({
            start_p,
            end_p,
            for_open_tag: String(rule.for_open_tag),
            for_close_tag: String(rule.for_close_tag),
            item_tag:
              rule.item_tag !== undefined
                ? String(rule.item_tag)
                : rule.tag !== undefined
                ? String(rule.tag)
                : "",
          });
        } else {
          result.replace_paragraphs!.push({
            start_p,
            end_p,
            tag: rule.tag !== undefined ? String(rule.tag) : "",
          });
        }
        return;
      }

      throw new Error(
        createSlotsManifestContractError(
          `Coordenada inválida "${rule.coord}" em '${context}'. Formatos suportados: "T0.R1.C1" (tabela) ou "P2", "P2-P4" (parágrafo).`
        )
      );
    }

    // 2. Regra inline ({ find, replace })
    if (typeof rule.find === "string" && rule.replace !== undefined) {
      result.replace_inline!.push({
        find: rule.find,
        replace: String(rule.replace),
      });
      return;
    }

    // 3. Regra de tabela canônica ou com aliases
    const rawT = rule.table_index ?? rule.table;
    const rawR = rule.row_index ?? rule.row;
    const rawC =
      rule.cell_index ?? rule.col_index ?? rule.column_index ?? rule.col;

    // Se for loop de tabela
    if (
      rawT !== undefined &&
      (rule.header_row_index !== undefined ||
        (rule.for_open_tag && Array.isArray(rule.cell_tags)))
    ) {
      result.loop_table_rows!.push({
        table_index: Number(rawT),
        header_row_index: Number(rule.header_row_index ?? 0),
        template_row_index: Number(
          rule.template_row_index ?? Number(rule.header_row_index ?? 0) + 1
        ),
        remove_from_row:
          rule.remove_from_row !== undefined
            ? Number(rule.remove_from_row)
            : undefined,
        remove_to_row:
          rule.remove_to_row !== undefined
            ? Number(rule.remove_to_row)
            : undefined,
        for_open_tag: String(rule.for_open_tag ?? ""),
        for_close_tag: String(rule.for_close_tag ?? ""),
        cell_tags: Array.isArray(rule.cell_tags)
          ? rule.cell_tags.map(String)
          : [],
      });
      return;
    }

    // Se for replace_table_cells
    if (rawT !== undefined && rawR !== undefined && rawC !== undefined) {
      result.replace_table_cells!.push({
        table_index: Number(rawT),
        row_index: Number(rawR),
        cell_index: Number(rawC),
        tag: rule.tag !== undefined ? String(rule.tag) : "",
      });
      return;
    }

    // 4. Regra de parágrafo canônica ou com aliases
    const rawStartP =
      rule.start_p ?? rule.paragraph_index ?? rule.p_index ?? rule.paragraph;
    if (rawStartP !== undefined) {
      const start_p = Number(rawStartP);
      const end_p = rule.end_p !== undefined ? Number(rule.end_p) : start_p;
      if (rule.for_open_tag && rule.for_close_tag) {
        result.loop_paragraphs!.push({
          start_p,
          end_p,
          for_open_tag: String(rule.for_open_tag),
          for_close_tag: String(rule.for_close_tag),
          item_tag:
            rule.item_tag !== undefined
              ? String(rule.item_tag)
              : rule.tag !== undefined
              ? String(rule.tag)
              : "",
        });
      } else {
        result.replace_paragraphs!.push({
          start_p,
          end_p,
          tag: rule.tag !== undefined ? String(rule.tag) : "",
        });
      }
      return;
    }

    throw new Error(
      createSlotsManifestContractError(
        `Regra não reconhecida em '${context}': ${JSON.stringify(rule)}. Verifique as propriedades obrigatórias.`
      )
    );
  };

  // Se a raiz for um array puro
  if (Array.isArray(rawManifest)) {
    for (const item of rawManifest) {
      validateRuleKeys(item, ALLOWED_SLOTS_ITEM_KEYS, "slots");
      processRule(item, "slots");
    }
  } else {
    // Se contiver a propriedade 'slots'
    if (Array.isArray(rawManifest.slots)) {
      for (const item of rawManifest.slots) {
        validateRuleKeys(item, ALLOWED_SLOTS_ITEM_KEYS, "slots");
        processRule(item, "slots");
      }
    } else if (rawManifest.slots !== undefined) {
      throw new Error(
        createSlotsManifestContractError(
          `Propriedade 'slots' deve ser uma lista (array) de regras.`
        )
      );
    }

    // Se contiver arrays canônicos (ou variantes)
    if (Array.isArray(rawManifest.replace_paragraphs)) {
      for (const item of rawManifest.replace_paragraphs) {
        validateRuleKeys(item, ALLOWED_REPLACE_PARA_KEYS, "replace_paragraphs");
        processRule(item, "replace_paragraphs");
      }
    }
    if (Array.isArray(rawManifest.loop_paragraphs)) {
      for (const item of rawManifest.loop_paragraphs) {
        validateRuleKeys(item, ALLOWED_LOOP_PARA_KEYS, "loop_paragraphs");
        processRule(item, "loop_paragraphs");
      }
    }
    if (Array.isArray(rawManifest.replace_table_cells)) {
      for (const item of rawManifest.replace_table_cells) {
        validateRuleKeys(
          item,
          ALLOWED_REPLACE_CELL_KEYS,
          "replace_table_cells"
        );
        processRule(item, "replace_table_cells");
      }
    }
    if (Array.isArray(rawManifest.loop_table_rows)) {
      for (const item of rawManifest.loop_table_rows) {
        validateRuleKeys(item, ALLOWED_LOOP_TABLE_KEYS, "loop_table_rows");
        processRule(item, "loop_table_rows");
      }
    }
    if (Array.isArray(rawManifest.replace_inline)) {
      for (const item of rawManifest.replace_inline) {
        validateRuleKeys(item, ALLOWED_REPLACE_INLINE_KEYS, "replace_inline");
        processRule(item, "replace_inline");
      }
    }
  }

  // Limpa arrays vazios para manter o manifesto enxuto e canônico
  const cleaned: SlotsManifest = {};
  if (result.replace_paragraphs!.length > 0)
    cleaned.replace_paragraphs = result.replace_paragraphs;
  if (result.loop_paragraphs!.length > 0)
    cleaned.loop_paragraphs = result.loop_paragraphs;
  if (result.replace_table_cells!.length > 0)
    cleaned.replace_table_cells = result.replace_table_cells;
  if (result.loop_table_rows!.length > 0)
    cleaned.loop_table_rows = result.loop_table_rows;
  if (result.replace_inline!.length > 0)
    cleaned.replace_inline = result.replace_inline;

  return cleaned;
}

export function countManifestRules(manifest: SlotsManifest): number {
  if (!manifest || typeof manifest !== "object") return 0;
  let count = 0;
  if (manifest.replace_paragraphs) count += manifest.replace_paragraphs.length;
  if (manifest.loop_paragraphs) count += manifest.loop_paragraphs.length;
  if (manifest.replace_table_cells) count += manifest.replace_table_cells.length;
  if (manifest.loop_table_rows) count += manifest.loop_table_rows.length;
  if (manifest.replace_inline) count += manifest.replace_inline.length;
  return count;
}

