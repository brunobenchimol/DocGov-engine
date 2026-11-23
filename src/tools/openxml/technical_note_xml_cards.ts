import { generateGranularInlineDiff } from "../../core/structural_diff.ts";
import { cleanHumanText } from "../audit/finding_formatters_and_cards.ts";
import type {
  EvolutionClauseItem,
  GranularDiffChunk,
  ZoneDeltaReport,
} from "../../types/index.ts";
export function escapeXml(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderRunsWithInlineBoldXml(
  text: string,
  options: {
    fontSizeHalfPt?: number;
    color?: string;
    forceBold?: boolean;
    forceItalic?: boolean;
  } = {}
): string {
  const sz = options.fontSizeHalfPt ?? 22;
  const colorXml = options.color ? `<w:color w:val="${options.color}"/>` : "";
  const italicXml = options.forceItalic ? `<w:i/><w:iCs/>` : "";

  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  const runs: string[] = [];

  for (const seg of segments) {
    if (!seg) continue;
    const isMarkdownBold =
      seg.startsWith("**") && seg.endsWith("**") && seg.length > 4;
    const rawSegmentText = isMarkdownBold ? seg.slice(2, -2) : seg;
    const cleanedSegmentText = cleanHumanText(rawSegmentText);
    const leadingSpace = /^\s/.test(rawSegmentText) ? " " : "";
    const trailingSpace = /\s$/.test(rawSegmentText) ? " " : "";
    const finalSegText = `${leadingSpace}${cleanedSegmentText}${trailingSpace}`;

    if (!finalSegText) continue;

    const boldXml =
      options.forceBold || isMarkdownBold ? `<w:b/><w:bCs/>` : "";

    runs.push(`<w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${boldXml}${italicXml}${colorXml}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(finalSegText)}</w:t>
    </w:r>`);
  }

  return runs.join("");
}

export function renderMultiLineParagraphsXml(
  rawText: unknown,
  options: {
    jc?: "both" | "left" | "center";
    spaceBefore?: number;
    spaceAfter?: number;
    fontSizeHalfPt?: number;
    color?: string;
    indLeft?: number;
    indRight?: number;
    forceBold?: boolean;
    forceItalic?: boolean;
  } = {}
): string {
  const cleaned = cleanHumanText(rawText);
  if (!cleaned) return "";

  const jc = options.jc ?? "both";
  const before = options.spaceBefore ?? 0;
  const after = options.spaceAfter ?? 120;
  const indXml =
    options.indLeft || options.indRight
      ? `<w:ind ${options.indLeft ? `w:left="${options.indLeft}"` : ""} ${
          options.indRight ? `w:right="${options.indRight}"` : ""
        }/>`
      : "";

  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines
    .map(
      (line) => `<w:p>
      <w:pPr>
        <w:jc w:val="${jc}"/>
        ${indXml}
        <w:spacing w:before="${before}" w:after="${after}" w:line="276" w:lineRule="auto"/>
      </w:pPr>
      ${renderRunsWithInlineBoldXml(line, options)}
    </w:p>`
    )
    .join("\n");
}

export function renderLabelValueParagraphXml(
  label: string,
  value: unknown
): string {
  const cleanedVal = cleanHumanText(value);
  if (!cleanedVal) return "";
  return `<w:p>
    <w:pPr>
      <w:jc w:val="both"/>
      <w:spacing w:before="40" w:after="80" w:line="276" w:lineRule="auto"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(label)}: </w:t>
    </w:r>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(cleanedVal)}</w:t>
    </w:r>
  </w:p>`;
}

export function renderDiffChunksXml(chunks: GranularDiffChunk[]): string {
  if (!chunks || chunks.length === 0) return "";
  const runs: string[] = [];

  for (const c of chunks) {
    if (!c.text) continue;
    if (c.type === "UNCHANGED") {
      runs.push(`<w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="4B5563"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(c.text)}</w:t>
      </w:r>`);
    } else if (c.type === "REMOVED") {
      runs.push(`<w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:strike/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="DC2626"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(c.text)}</w:t>
      </w:r>`);
    } else if (c.type === "ADDED") {
      runs.push(`<w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="16A34A"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(c.text)}</w:t>
      </w:r>`);
    }
  }

  return runs.join("");
}

export function renderDeltaZonasXml(deltas?: ZoneDeltaReport[]): string {
  if (!deltas || deltas.length === 0) return "";

  const itemsXml = deltas
    .map((z) => {
      let badgeLabel = "MANTIDO";
      let badgeColor = "B45309";
      let badgeFill = "FFFBEB";

      if (z.status === "RESOLVED") {
        badgeLabel = "SANEADO";
        badgeColor = "15803D";
        badgeFill = "F0FDF4";
      } else if (z.status === "INTRODUCED") {
        badgeLabel = "INTRODUZIDO";
        badgeColor = "B91C1C";
        badgeFill = "FEF2F2";
      }

      return `<w:p>
        <w:pPr>
          <w:pBdr><w:left w:val="single" w:sz="18" w:space="10" w:color="${badgeColor}"/></w:pBdr>
          <w:shd w:val="clear" w:color="auto" w:fill="${badgeFill}"/>
          <w:ind w:left="200" w:right="100"/>
          <w:spacing w:before="60" w:after="60" w:line="260" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="${badgeColor}"/></w:rPr>
          <w:t xml:space="preserve">[${badgeLabel}] ${escapeXml(z.zone_title)}: </w:t>
        </w:r>
        <w:r>
          <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="374151"/></w:rPr>
          <w:t xml:space="preserve">${escapeXml(z.details || `Ocorrências: ${z.old_occurrences_count} -> ${z.new_occurrences_count}`)}</w:t>
        </w:r>
      </w:p>`;
    })
    .join("\n");

  return `<w:p>
    <w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:before="260" w:after="120"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
      <w:t>3. IMPACTO NO RADAR DE CONTROLE EXTERNO (DELTA Z1..Z14)</w:t>
    </w:r>
  </w:p>
  ${itemsXml}`;
}

export function renderClauseCardXml(item: EvolutionClauseItem, index: number): string {
  const numStr = String(index + 1).padStart(2, "0");
  const rawId = item.id ? cleanHumanText(item.id) : `EVO-${numStr}`;
  const secao = cleanHumanText(item.secao_titulo || `Cláusula ${index + 1}`);

  let badgeText = "MODIFICAÇÃO";
  let badgeColor = "2563EB";
  let badgeFill = "EFF6FF";

  if (item.tipo_alteracao === "INCLUSAO") {
    badgeText = "INCLUSÃO";
    badgeColor = "16A34A";
    badgeFill = "F0FDF4";
  } else if (item.tipo_alteracao === "SUPRESSAO") {
    badgeText = "SUPRESSÃO";
    badgeColor = "DC2626";
    badgeFill = "FEF2F2";
  }

  const coordStr = item.coordenada || item.slot_id ? ` (${cleanHumanText(item.coordenada || item.slot_id)})` : "";

  // Card Header
  const headerXml = `<w:p>
    <w:pPr>
      <w:pBdr><w:left w:val="single" w:sz="36" w:space="15" w:color="${badgeColor}"/></w:pBdr>
      <w:shd w:val="clear" w:color="auto" w:fill="${badgeFill}"/>
      <w:ind w:left="200" w:right="100"/>
      <w:spacing w:before="240" w:after="80"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="${badgeColor}"/></w:rPr>
      <w:t xml:space="preserve">[${badgeText}] ${escapeXml(rawId)} — ${escapeXml(secao)}${escapeXml(coordStr)}</w:t>
    </w:r>
  </w:p>`;

  // Sub-bloco A: Redação Anterior
  let anteriorXml = "";
  if (item.redacao_anterior && item.tipo_alteracao !== "INCLUSAO") {
    anteriorXml = `<w:p>
      <w:pPr><w:spacing w:before="80" w:after="40"/><w:ind w:left="200"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="990000"/></w:rPr>
        <w:t>A) Redação Anterior (Original):</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="DC2626"/></w:pBdr>
        <w:shd w:val="clear" w:color="auto" w:fill="FEF2F2"/>
        <w:ind w:left="360" w:right="180"/>
        <w:spacing w:before="40" w:after="100" w:line="260" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="7F1D1D"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(cleanHumanText(item.redacao_anterior))}</w:t>
      </w:r>
    </w:p>`;
  }

  // Sub-bloco B: Nova Redação Saneadora
  let novaXml = "";
  if (item.redacao_nova && item.tipo_alteracao !== "SUPRESSAO") {
    novaXml = `<w:p>
      <w:pPr><w:spacing w:before="80" w:after="40"/><w:ind w:left="200"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="16A34A"/></w:rPr>
        <w:t>B) Nova Redação Saneadora:</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="16A34A"/></w:pBdr>
        <w:shd w:val="clear" w:color="auto" w:fill="F0FDF4"/>
        <w:ind w:left="360" w:right="180"/>
        <w:spacing w:before="40" w:after="100" w:line="260" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="14532D"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(cleanHumanText(item.redacao_nova))}</w:t>
      </w:r>
    </w:p>`;
  }

  // Sub-bloco C: Destaque do Diff Cirúrgico (Chunks)
  let diffXml = "";
  if (item.tipo_alteracao === "MODIFICACAO" && item.redacao_anterior && item.redacao_nova) {
    let chunks = item.diff_chunks;
    if (!chunks || chunks.length === 0) {
      chunks = generateGranularInlineDiff(item.redacao_anterior, item.redacao_nova).chunks;
    }

    if (chunks && chunks.length > 0) {
      diffXml = `<w:p>
        <w:pPr><w:spacing w:before="80" w:after="40"/><w:ind w:left="200"/></w:pPr>
        <w:r>
          <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="4B5563"/></w:rPr>
          <w:t>C) Comparação Cirúrgica das Alterações (Diff Inline):</w:t>
        </w:r>
      </w:p>
      <w:p>
        <w:pPr>
          <w:shd w:val="clear" w:color="auto" w:fill="F9FAFB"/>
          <w:ind w:left="360" w:right="180"/>
          <w:spacing w:before="40" w:after="100" w:line="260" w:lineRule="auto"/>
        </w:pPr>
        ${renderDiffChunksXml(chunks)}
      </w:p>`;
    }
  }

  // Sub-bloco D: Justificativa Técnica
  const justificativaXml = `<w:p>
    <w:pPr><w:spacing w:before="80" w:after="40"/><w:ind w:left="200"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="1E40AF"/></w:rPr>
      <w:t>D) Justificativa Técnica e Motivação Administrativa:</w:t>
    </w:r>
  </w:p>
  ${renderMultiLineParagraphsXml(item.justificativa_tecnica, {
    indLeft: 360,
    indRight: 180,
    spaceAfter: 100,
    fontSizeHalfPt: 20,
  })}`;

  // Sub-bloco E: Fundamentação Jurídica
  const fundamentacaoXml = `<w:p>
    <w:pPr><w:spacing w:before="80" w:after="40"/><w:ind w:left="200"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="1E40AF"/></w:rPr>
      <w:t>E) Fundamentação Jurídica (Lei 14.133/2021, TCU, AGU):</w:t>
    </w:r>
  </w:p>
  <w:p>
    <w:pPr>
      <w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="2563EB"/></w:pBdr>
      <w:shd w:val="clear" w:color="auto" w:fill="EFF6FF"/>
      <w:ind w:left="360" w:right="180"/>
      <w:spacing w:before="40" w:after="160" w:line="260" w:lineRule="auto"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="1E3A8A"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(cleanHumanText(item.fundamentacao_juridica))}</w:t>
    </w:r>
  </w:p>`;

  return `${headerXml}
  ${anteriorXml}
  ${novaXml}
  ${diffXml}
  ${justificativaXml}
  ${fundamentacaoXml}`;
}
