import type { GranularDiffChunk } from "../types/index.ts";
export function normalizeForComparison(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
