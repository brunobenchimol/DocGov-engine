import { basename } from "node:path";
import type {
  DocxInspectionResult,
  StructuralDiffResult,
  StructuralDiffItem,
  StructuralDiffChangeType,
  GranularDiffChunk,
  ZoneDeltaReport,
  ImpugnationZoneId,
} from "../types/index.ts";
import { ALL_IMPUGNATION_ZONE_IDS } from "./cartography.ts";
import { VERSION } from "../constants/index.ts";

// ============================================================================
// Motor de Diff Estrutural e Semântico Multi-Versão (v1.1.0)
// ============================================================================

interface NormalizedBlock {
  coord: string;
  section_title: string;
  text: string;
  clean_text: string;
  words: Set<string>;
}

function normalizeForComparison(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDocumentBlocks(doc: DocxInspectionResult): NormalizedBlock[] {
  const blocks: NormalizedBlock[] = [];
  let currentSection = "Preâmbulo / Início";

  const sectionByCoord = new Map<string, string>();
  if (doc.toc_map?.sections) {
    for (const s of doc.toc_map.sections) {
      sectionByCoord.set(s.coord, s.title);
      sectionByCoord.set(`[${s.coord}]`, s.title);
    }
  }

  // 1. Parágrafos / Linhas
  if (doc.paragraphs) {
    for (const p of doc.paragraphs) {
      const coord = doc.doc_type === "pdf" ? `PAG` : `[P${p.index}]`;
      const rawText = p.text.trim();
      if (!rawText) continue;

      // Para PDFs com coordenada entre colchetes embutida: [PAG_001 | L0001]
      let cleanCoord = coord;
      let textWithoutCoord = rawText;
      const bracketMatch = /^(\[PAG_\d+\s*\|\s*L\d+\])\s*(.*)$/.exec(rawText);
      if (bracketMatch) {
        cleanCoord = bracketMatch[1];
        textWithoutCoord = bracketMatch[2].trim();
      }

      if (sectionByCoord.has(cleanCoord)) {
        currentSection = sectionByCoord.get(cleanCoord)!;
      }

      const clean = normalizeForComparison(textWithoutCoord);
      if (clean.length < 3) continue;

      const words = new Set(clean.split(" ").filter((w) => w.length > 2));
      blocks.push({
        coord: cleanCoord,
        section_title: currentSection,
        text: textWithoutCoord,
        clean_text: clean,
        words,
      });
    }
  }

  // 2. Tabelas (no caso DOCX)
  if (doc.tables && doc.tables.length > 0) {
    for (const tbl of doc.tables) {
      for (const r of tbl.rows) {
        const rowText = r.cells
          .map((c) => c.text.trim())
          .filter((t) => t.length > 0)
          .join(" | ");
        if (!rowText) continue;

        const coord = `[T${tbl.index}.R${r.rowIndex}]`;
        const clean = normalizeForComparison(rowText);
        if (clean.length < 3) continue;

        const words = new Set(clean.split(" ").filter((w) => w.length > 2));
        blocks.push({
          coord,
          section_title: `Tabela [T${tbl.index}]`,
          text: rowText,
          clean_text: clean,
          words,
        });
      }
    }
  }

  return blocks;
}

function computeWordSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) {
    if (b.has(w)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ============================================================================
// Motor de Token Diff Granular (Marco 6.1 — v1.3.0)
// ============================================================================

export function tokenizeDiffText(text: string): string[] {
  if (!text) return [];
  // Regex Unicode com flag gu preservando tokens jurídicos, moedas, números com ponto e ordinais
  const tokenRegex = /(?:R\$\s*[\d\.,]+|\d+(?:\.\d+)+|[\p{L}\p{N}_ºª§]+|\s+|[^\p{L}\p{N}_\s])/gu;
  const matches = text.match(tokenRegex);
  return matches ? matches.filter((t) => t.length > 0) : [];
}

export function coalesceDiffChunks(chunks: GranularDiffChunk[]): GranularDiffChunk[] {
  const result: GranularDiffChunk[] = [];
  for (const c of chunks) {
    if (!c.text) continue;
    if (result.length > 0 && result[result.length - 1].type === c.type) {
      result[result.length - 1].text += c.text;
    } else {
      result.push({ type: c.type, text: c.text });
    }
  }
  return result;
}

function splitTokensIntoSentences(tokens: string[]): string[][] {
  const sentences: string[][] = [];
  let current: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    current.push(t);
    if (/^[.;!?]+$/.test(t)) {
      sentences.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    sentences.push(current);
  }
  return sentences;
}

function computeChunkedSentenceLcsDiff(tokensOld: string[], tokensNew: string[]): GranularDiffChunk[] {
  const sentencesOld = splitTokensIntoSentences(tokensOld);
  const sentencesNew = splitTokensIntoSentences(tokensNew);

  const strOld = sentencesOld.map((s) => s.join(""));
  const strNew = sentencesNew.map((s) => s.join(""));

  const m = sentencesOld.length;
  const n = sentencesNew.length;
  const dp: Int32Array[] = [];
  for (let i = 0; i <= m; i++) {
    dp.push(new Int32Array(n + 1));
  }

  for (let i = 1; i <= m; i++) {
    const o = normalizeForComparison(strOld[i - 1]);
    for (let j = 1; j <= n; j++) {
      if (o === normalizeForComparison(strNew[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const sentenceChunks: Array<{ type: "MATCH" | "OLD_ONLY" | "NEW_ONLY"; oldIdx?: number; newIdx?: number }> = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalizeForComparison(strOld[i - 1]) === normalizeForComparison(strNew[j - 1])) {
      sentenceChunks.unshift({ type: "MATCH", oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      sentenceChunks.unshift({ type: "NEW_ONLY", newIdx: j - 1 });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      sentenceChunks.unshift({ type: "OLD_ONLY", oldIdx: i - 1 });
      i--;
    }
  }

  const allChunks: GranularDiffChunk[] = [];
  for (let idx = 0; idx < sentenceChunks.length; idx++) {
    const item = sentenceChunks[idx];
    const nextItem = idx + 1 < sentenceChunks.length ? sentenceChunks[idx + 1] : null;

    if (item.type === "MATCH") {
      const sNew = sentencesNew[item.newIdx!];
      allChunks.push({ type: "UNCHANGED", text: sNew.join("") });
    } else if (item.type === "OLD_ONLY" && nextItem && nextItem.type === "NEW_ONLY") {
      const sOld = sentencesOld[item.oldIdx!];
      const sNew = sentencesNew[nextItem.newIdx!];
      allChunks.push(...computeTokenLcsDiff(sOld, sNew));
      idx++;
    } else if (item.type === "OLD_ONLY") {
      const sOld = sentencesOld[item.oldIdx!];
      allChunks.push({ type: "REMOVED", text: sOld.join("") });
    } else if (item.type === "NEW_ONLY") {
      const sNew = sentencesNew[item.newIdx!];
      allChunks.push({ type: "ADDED", text: sNew.join("") });
    }
  }

  return coalesceDiffChunks(allChunks);
}

export function computeTokenLcsDiff(tokensOld: string[], tokensNew: string[]): GranularDiffChunk[] {
  const m = tokensOld.length;
  const n = tokensNew.length;

  if (m === 0 && n === 0) return [];
  if (m === 0) return [{ type: "ADDED", text: tokensNew.join("") }];
  if (n === 0) return [{ type: "REMOVED", text: tokensOld.join("") }];

  // Guardrail de complexidade para blocos massivos (m * n > 2.000.000)
  if (m * n > 2_000_000) {
    return computeChunkedSentenceLcsDiff(tokensOld, tokensNew);
  }

  const dp: Int32Array[] = [];
  for (let i = 0; i <= m; i++) {
    dp.push(new Int32Array(n + 1));
  }

  for (let i = 1; i <= m; i++) {
    const tOld = tokensOld[i - 1].toLowerCase();
    for (let j = 1; j <= n; j++) {
      if (tOld === tokensNew[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        const up = dp[i - 1][j];
        const left = dp[i][j - 1];
        dp[i][j] = up >= left ? up : left;
      }
    }
  }

  const rawChunks: GranularDiffChunk[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokensOld[i - 1].toLowerCase() === tokensNew[j - 1].toLowerCase()) {
      rawChunks.unshift({ type: "UNCHANGED", text: tokensNew[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawChunks.unshift({ type: "ADDED", text: tokensNew[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawChunks.unshift({ type: "REMOVED", text: tokensOld[i - 1] });
      i--;
    }
  }

  return coalesceDiffChunks(rawChunks);
}

export function formatChunksToMarkdown(chunks: GranularDiffChunk[]): string {
  let md = "";
  for (let idx = 0; idx < chunks.length; idx++) {
    const curr = chunks[idx];
    const next = idx + 1 < chunks.length ? chunks[idx + 1] : null;

    if (curr.type === "UNCHANGED") {
      md += curr.text;
    } else if (curr.type === "REMOVED" && next && next.type === "ADDED") {
      const remText = curr.text.trim();
      const addText = next.text.trim();
      const prefix = curr.text.startsWith(" ") ? " " : "";
      const suffix = next.text.endsWith(" ") ? " " : "";
      md += `${prefix}[~~${remText}~~ $\\rightarrow$ **${addText}**]${suffix}`;
      idx++;
    } else if (curr.type === "REMOVED") {
      const remText = curr.text.trim();
      const prefix = curr.text.startsWith(" ") ? " " : "";
      const suffix = curr.text.endsWith(" ") ? " " : "";
      md += `${prefix}~~${remText}~~${suffix}`;
    } else if (curr.type === "ADDED") {
      const addText = curr.text.trim();
      const prefix = curr.text.startsWith(" ") ? " " : "";
      const suffix = curr.text.endsWith(" ") ? " " : "";
      md += `${prefix}**${addText}**${suffix}`;
    }
  }
  return md;
}

export function generateGranularInlineDiff(
  oldText: string,
  newText: string
): { inline_diff: string; chunks: GranularDiffChunk[] } {
  const tokensOld = tokenizeDiffText(oldText);
  const tokensNew = tokenizeDiffText(newText);
  const chunks = computeTokenLcsDiff(tokensOld, tokensNew);
  const inline_diff = formatChunksToMarkdown(chunks);
  return { inline_diff, chunks };
}

export function generateInlineDiff(oldText: string, newText: string): string {
  return generateGranularInlineDiff(oldText, newText).inline_diff;
}

// ============================================================================
// Delta do Radar das 14 Zonas
// ============================================================================

export function computeZonesDelta(
  oldDoc: DocxInspectionResult,
  newDoc: DocxInspectionResult
): ZoneDeltaReport[] {
  const reports: ZoneDeltaReport[] = [];
  const oldZones = oldDoc.impugnation_zones || ({} as any);
  const newZones = newDoc.impugnation_zones || ({} as any);

  const ZONE_TITLES: Record<ImpugnationZoneId, string> = {
    Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO:
      "Z1: Agrupamento / Consórcio / Subcontratação",
    Z2_QUALIFICACAO_TECNICA_ATESTADOS: "Z2: Qualificação Técnica e Atestados",
    Z3_QUALIFICACAO_ECONOMICA_GARANTIAS:
      "Z3: Qualificação Econômica e Garantias",
    Z4_VISTORIA_VISITA_TECNICA: "Z4: Vistoria e Visita Técnica",
    Z5_AMOSTRA_POC_HOMOLOGACAO: "Z5: Amostra, Prova de Conceito e Homologação",
    Z6_VINCULO_FABRICANTE_SOLIDARIEDADE:
      "Z6: Vínculo com Fabricante e Solidariedade",
    Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP:
      "Z7: Direcionamento Oculto (Datasheet Trap)",
    Z8_PRAZOS_ENTREGA_SLA_GARANTIA: "Z8: Prazos, SLA e Garantia",
    Z9_EQUIPE_CERTIFICACOES_SEDE: "Z9: Equipe, Certificações e Sede",
    Z10_PRECOS_EXEQUIBILIDADE_PLANILHA: "Z10: Preços e Planilha Orçamentária",
    Z11_PAGAMENTO_REAJUSTE_IMR_SANCOES: "Z11: Pagamento, IMR e Sanções",
    Z12_MAPA_CRUZADO_MULTIPECA: "Z12: Mapa Cruzado Multipéça",
    Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO:
      "Z13: Marca Explícita e Padronização",
    Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO:
      "Z14: Métricas de Esforço e Licenciamento",
  };

  for (const zoneId of ALL_IMPUGNATION_ZONE_IDS) {
    const oldCount = (oldZones[zoneId] || []).length;
    const newCount = (newZones[zoneId] || []).length;

    if (oldCount === 0 && newCount === 0) continue;

    let status: "INTRODUCED" | "RESOLVED" | "RETAINED";
    let details = "";

    if (oldCount === 0 && newCount > 0) {
      status = "INTRODUCED";
      details = `🔴 NOVO RISCO: ${newCount} apontamento(s) introduzido(s) na versão revisada.`;
    } else if (oldCount > 0 && newCount === 0) {
      status = "RESOLVED";
      details = `🟢 SANEADO: ${oldCount} apontamento(s) anterior(es) eliminado(s) na versão revisada.`;
    } else {
      status = "RETAINED";
      const diff = newCount - oldCount;
      const diffStr =
        diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : `inalterado`;
      details = `🟡 MANTIDO: ${newCount} apontamento(s) presente(s) (${diffStr} em relação à versão anterior).`;
    }

    reports.push({
      zone_id: zoneId,
      zone_title: ZONE_TITLES[zoneId] || zoneId,
      status,
      old_occurrences_count: oldCount,
      new_occurrences_count: newCount,
      details,
    });
  }

  // Ordena por severidade: INTRODUCED primeiro, depois RESOLVED, depois RETAINED
  const order = { INTRODUCED: 0, RESOLVED: 1, RETAINED: 2 };
  reports.sort((a, b) => order[a.status] - order[b.status]);

  return reports;
}

// ============================================================================
// Orquestrador Central do Diff Estrutural
// ============================================================================

export function computeStructuralDiff(
  oldDoc: DocxInspectionResult,
  newDoc: DocxInspectionResult,
  oldPath: string,
  newPath: string
): StructuralDiffResult {
  const oldBlocks = extractDocumentBlocks(oldDoc);
  const newBlocks = extractDocumentBlocks(newDoc);

  const changes: StructuralDiffItem[] = [];
  const matchedNewIndices = new Set<number>();
  const matchedOldIndices = new Set<number>();

  // 1. Passe 1: Correspondência Exata
  for (let oIdx = 0; oIdx < oldBlocks.length; oIdx++) {
    const ob = oldBlocks[oIdx];
    for (let nIdx = 0; nIdx < newBlocks.length; nIdx++) {
      if (matchedNewIndices.has(nIdx)) continue;
      const nb = newBlocks[nIdx];
      if (ob.clean_text === nb.clean_text) {
        changes.push({
          change_type: "UNCHANGED",
          coord_old: ob.coord,
          coord_new: nb.coord,
          section_title: nb.section_title || ob.section_title,
          old_text: ob.text,
          new_text: nb.text,
          diff_chunks: [{ type: "UNCHANGED", text: nb.text }],
        });
        matchedOldIndices.add(oIdx);
        matchedNewIndices.add(nIdx);
        break;
      }
    }
  }

  // 2. Passe 2: Correspondência Parcial / Modificação (Jaccard >= 0.4 na mesma vizinhança ou seção)
  for (let oIdx = 0; oIdx < oldBlocks.length; oIdx++) {
    if (matchedOldIndices.has(oIdx)) continue;
    const ob = oldBlocks[oIdx];

    let bestMatchIdx = -1;
    let highestSim = 0;

    for (let nIdx = 0; nIdx < newBlocks.length; nIdx++) {
      if (matchedNewIndices.has(nIdx)) continue;
      const nb = newBlocks[nIdx];

      const sim = computeWordSimilarity(ob.words, nb.words);
      if (sim > highestSim && sim >= 0.4) {
        highestSim = sim;
        bestMatchIdx = nIdx;
      }
    }

    if (bestMatchIdx !== -1) {
      const nb = newBlocks[bestMatchIdx];
      const granular = generateGranularInlineDiff(ob.text, nb.text);
      changes.push({
        change_type: "MODIFIED",
        coord_old: ob.coord,
        coord_new: nb.coord,
        section_title: nb.section_title || ob.section_title,
        old_text: ob.text,
        new_text: nb.text,
        inline_diff: granular.inline_diff,
        diff_chunks: granular.chunks,
      });
      matchedOldIndices.add(oIdx);
      matchedNewIndices.add(bestMatchIdx);
    }
  }

  // 3. Passe 3: Itens Removidos da Versão Antiga
  for (let oIdx = 0; oIdx < oldBlocks.length; oIdx++) {
    if (!matchedOldIndices.has(oIdx)) {
      const ob = oldBlocks[oIdx];
      changes.push({
        change_type: "REMOVED",
        coord_old: ob.coord,
        section_title: ob.section_title,
        old_text: ob.text,
        diff_chunks: [{ type: "REMOVED", text: ob.text }],
      });
    }
  }

  // 4. Passe 4: Itens Adicionados na Nova Versão
  for (let nIdx = 0; nIdx < newBlocks.length; nIdx++) {
    if (!matchedNewIndices.has(nIdx)) {
      const nb = newBlocks[nIdx];
      changes.push({
        change_type: "ADDED",
        coord_new: nb.coord,
        section_title: nb.section_title,
        new_text: nb.text,
        diff_chunks: [{ type: "ADDED", text: nb.text }],
      });
    }
  }

  let totalAdded = 0;
  let totalRemoved = 0;
  let totalModified = 0;
  let totalUnchanged = 0;

  for (const c of changes) {
    if (c.change_type === "ADDED") totalAdded++;
    else if (c.change_type === "REMOVED") totalRemoved++;
    else if (c.change_type === "MODIFIED") totalModified++;
    else if (c.change_type === "UNCHANGED") totalUnchanged++;
  }

  const zonesDelta = computeZonesDelta(oldDoc, newDoc);

  return {
    old_path: oldPath,
    new_path: newPath,
    old_type: oldDoc.doc_type || "docx",
    new_type: newDoc.doc_type || "docx",
    total_added: totalAdded,
    total_removed: totalRemoved,
    total_modified: totalModified,
    total_unchanged: totalUnchanged,
    changes,
    zones_delta: zonesDelta,
  };
}

// ============================================================================
// Renderizador Markdown do Relatório de Diff
// ============================================================================

export function generateDiffReportMarkdown(
  diff: StructuralDiffResult
): string {
  const lines: string[] = [];
  const oldBase = basename(diff.old_path);
  const newBase = basename(diff.new_path);

  lines.push(
    `# 🔄 Relatório de Diff Estrutural e Semântico Multi-Versão (v1.1.0)`
  );
  lines.push(
    `> Comparação determinística entre versão anterior (**${oldBase}**) e nova versão (**${newBase}**).`
  );
  lines.push("");

  // Sumário Executivo
  lines.push("## 📊 Sumário Executivo de Alterações");
  lines.push(
    `- **Cláusulas / Linhas Adicionadas ([+]):** ${diff.total_added}`
  );
  lines.push(
    `- **Cláusulas / Linhas Removidas ([-]):** ${diff.total_removed}`
  );
  lines.push(
    `- **Cláusulas / Linhas Modificadas ([~]):** ${diff.total_modified}`
  );
  lines.push(
    `- **Cláusulas / Linhas Inalteradas ([=]):** ${diff.total_unchanged}`
  );
  lines.push("");

  // Impacto no Radar das 14 Zonas
  lines.push("## 🎯 Impacto no Radar das 14 Zonas de Impugnação (Delta Z1..Z14)");
  lines.push("");

  if (diff.zones_delta.length === 0) {
    lines.push("*(Nenhuma alteração detectada nas 14 Zonas de Impugnação).*");
  } else {
    lines.push(
      "| Zona | Status | Versão Anterior | Versão Nova | Diagnóstico do Risco |"
    );
    lines.push(
      "| :--- | :--- | :--- | :--- | :--- |"
    );
    for (const z of diff.zones_delta) {
      const badge =
        z.status === "INTRODUCED"
          ? "🔴 `INTRODUZIDO`"
          : z.status === "RESOLVED"
          ? "🟢 `SANEADO`"
          : "🟡 `MANTIDO`";
      lines.push(
        `| ${z.zone_title} | ${badge} | ${z.old_occurrences_count} | ${z.new_occurrences_count} | ${z.details} |`
      );
    }
  }
  lines.push("");

  // Quadro Comparativo ("Antes vs. Depois")
  lines.push("## 📝 Quadro Comparativo Detalhado de Alterações");
  lines.push("");

  const relevantChanges = diff.changes.filter(
    (c) => c.change_type !== "UNCHANGED"
  );

  if (relevantChanges.length === 0) {
    lines.push("*(Os dois documentos possuem conteúdo e redação idênticos).*");
  } else {
    lines.push(
      "| Tipo | Coord Anterior | Coord Nova | Seção / Cláusula | Redação / Destaque da Alteração |"
    );
    lines.push(
      "| :--- | :--- | :--- | :--- | :--- |"
    );

    for (const c of relevantChanges) {
      let icon = "";
      let detail = "";

      if (c.change_type === "ADDED") {
        icon = "🟢 `[+] ADICIONADO`";
        detail = `**Novo:** ${c.new_text}`;
      } else if (c.change_type === "REMOVED") {
        icon = "🔴 `[-] REMOVIDO`";
        detail = `~~${c.old_text}~~`;
      } else if (c.change_type === "MODIFIED") {
        icon = "🟡 `[~] ALTERADO`";
        detail = c.inline_diff || `~~${c.old_text}~~ $\\rightarrow$ **${c.new_text}**`;
      }

      const coordOld = c.coord_old || "-";
      const coordNew = c.coord_new || "-";
      const sec = c.section_title || "Geral";
      const safeDetail = detail.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

      lines.push(
        `| ${icon} | \`${coordOld}\` | \`${coordNew}\` | ${sec} | ${safeDetail} |`
      );
    }
  }

  lines.push("");
  return lines.join("\n").trim() + "\n";
}
