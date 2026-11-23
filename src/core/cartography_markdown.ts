import type {
  ImpugnationZoneId,
  DocumentCartography,
  ExtractedPdfImageAsset,
} from "../types/index.ts";
import { VERSION } from "../constants/index.ts";
import { formatAssetAnchorLine } from "../utils/pdf/forensic_cross_audit.ts";
import { ALL_IMPUGNATION_ZONE_IDS } from "./cartography_rules.ts";
export function renderCartographyMarkdownBlock(
  cartography: DocumentCartography
): string[] {
  const lines: string[] = [];

  lines.push("## Bloco 1: Mapa Cartográfico Estrutural e Radar das 14 Zonas de Impugnação");
  lines.push("");

  // 1.1 Esqueleto de Títulos e Fronteiras
  lines.push("### 1.1. Esqueleto de Títulos e Fronteiras (`outline_headings`)");
  if (cartography.outline_headings.length === 0) {
    lines.push("- *(Nenhum título estrutural destacado)*");
  } else {
    for (const h of cartography.outline_headings) {
      lines.push(`- **${h.coord}** ${h.title}`);
    }
  }
  lines.push("");

  // 1.2 Densidade Técnica e Tabelas de Itens
  lines.push("### 1.2. Densidade Técnica e Tabelas de Itens (`page_signals`)");
  if (cartography.page_signals.length === 0) {
    lines.push("- *(Sem sinais de alta densidade orçamentária/técnica)*");
  } else {
    for (const sig of cartography.page_signals) {
      const pageLabel =
        sig.page !== undefined
          ? `PAG_${String(sig.page).padStart(3, "0")} (${sig.coord_range})`
          : sig.coord_range;
      lines.push(
        `- **${pageLabel}** [${sig.signal_type}] (Orçamento: ${
          sig.budget_score
        }, Spec Técnica: ${sig.tech_spec_score}) — Termos: ${sig.matched_terms.join(
          ", "
        )}`
      );
    }
  }
  lines.push("");

  // 1.3 Radar Léxico das 14 Zonas de Impugnação
  lines.push("### 1.3. Radar Léxico das 14 Zonas de Impugnação (`Z1` a `Z14`)");
  for (const zoneId of ALL_IMPUGNATION_ZONE_IDS) {
    const hits = cartography.impugnation_zones[zoneId] || [];
    if (hits.length === 0) {
      lines.push(`- **${zoneId}**: *(0 ocorrências)*`);
    } else {
      lines.push(`- **${zoneId}** (${hits.length} ocorrência(s)):`);
      for (const hit of hits) {
        lines.push(`  - \`${hit.coord}\` [${hit.keyword}]: "${hit.snippet}"`);
      }
    }
  }
  lines.push("");

  return lines;
}

/**
 * Geração do Dossiê Executivo de Hotspots (state/dossie_hotspots_<stem>.md v0.9.0):
 * Condensa em um único arquivo o Mapa Cartográfico Completo e janelas expandidas (±12 linhas de contexto)
 * de todas as ocorrências das 14 Zonas de Impugnação (Z1..Z14) e seções de alta densidade técnica/orçamentária.
 */
export function generateHotspotsDossierMarkdown(
  docName: string,
  extraction: PdfExtractionResult,
  cartography: DocumentCartography,
  extractedImagesManifest?: Array<Omit<ExtractedPdfImageAsset, "png_data">>
): string {
  const lines: string[] = [];
  lines.push(`# Dossiê Executivo de Hotspots: ${docName}`);
  lines.push(
    `> Dossiê condensado gerado por docgov-engine v${VERSION} (${extraction.pageCount} página(s), ${extraction.lineCount} linha(s)).`
  );
  lines.push(
    `> Consolidação do Mapa Cartográfico e das janelas de contexto (±12 linhas) das 14 Zonas de Impugnação (Z1..Z14) e seções de alta densidade técnica/orçamentária para triagem em turno único.`
  );
  lines.push("");

  // Bloco 1: Mapa Cartográfico Completo
  lines.push(...renderCartographyMarkdownBlock(cartography));

  // Bloco 2: Janelas Expandidas dos Hotspots
  lines.push("## Bloco 2: Janelas Expandidas dos Hotspots (±12 Linhas de Contexto)");
  lines.push("");

  const lineIndexByBracket = new Map<string, number>();
  extraction.lines.forEach((l, idx) => {
    lineIndexByBracket.set(l.bracket_coord, idx);
  });

  interface TargetTrigger {
    lineIdx: number;
    zoneId?: ImpugnationZoneId;
    keyword?: string;
    signalType?: string;
  }

  const triggersByLine = new Map<number, TargetTrigger[]>();

  const addTrigger = (lineIdx: number, trigger: TargetTrigger) => {
    const list = triggersByLine.get(lineIdx) || [];
    list.push(trigger);
    triggersByLine.set(lineIdx, list);
  };

  // 1. Coleta triggers exclusivamente das Zonas de Impugnação (CORR-01: sem ancoragem cega de page_signals na Linha 1)
  for (const zoneId of ALL_IMPUGNATION_ZONE_IDS) {
    const hits = cartography.impugnation_zones[zoneId] || [];
    for (const hit of hits) {
      const singleCoord =
        hit.coord.startsWith("[") && hit.coord.endsWith("]")
          ? hit.coord
          : `[${hit.coord}]`;
      if (lineIndexByBracket.has(singleCoord)) {
        const lIdx = lineIndexByBracket.get(singleCoord)!;
        addTrigger(lIdx, { lineIdx: lIdx, zoneId, keyword: hit.keyword });
      } else {
        const matches = hit.coord.match(/\[PAG_\d+\s*\|\s*L\d+\]/g);
        if (matches) {
          for (const m of matches) {
            if (lineIndexByBracket.has(m)) {
              const lIdx = lineIndexByBracket.get(m)!;
              addTrigger(lIdx, { lineIdx: lIdx, zoneId, keyword: hit.keyword });
            }
          }
        }
      }
    }
  }

  const triggerLineIndices = Array.from(triggersByLine.keys()).sort(
    (a, b) => a - b
  );

  const assetsByPage = new Map<number, Array<Omit<ExtractedPdfImageAsset, "png_data">>>();
  for (const asset of extractedImagesManifest || []) {
    const list = assetsByPage.get(asset.page) || [];
    list.push(asset);
    assetsByPage.set(asset.page, list);
  }
  const emittedAssetPages = new Set<number>();

  if (triggerLineIndices.length === 0) {
    lines.push(
      "- *(Nenhum ponto de atenção ou zona de impugnação detectada nos parâmetros do radar)*"
    );
    if (assetsByPage.size > 0) {
      lines.push("");
      lines.push("### Anexos Visuais Extraídos (Assets Multimodais)");
      for (const pageNum of Array.from(assetsByPage.keys()).sort((a, b) => a - b)) {
        for (const asset of assetsByPage.get(pageNum) || []) {
          lines.push(`- ${formatAssetAnchorLine(asset)}`);
        }
      }
    }
    lines.push("");
    return lines.join("\n").trim() + "\n";
  }

  // 3. Constrói intervalos ±12 linhas e funde sobreposições
  interface HotspotInterval {
    start: number;
    end: number;
    triggers: TargetTrigger[];
  }

  const rawIntervals: HotspotInterval[] = triggerLineIndices.map((lIdx) => ({
    start: Math.max(0, lIdx - 12),
    end: Math.min(extraction.lines.length - 1, lIdx + 12),
    triggers: triggersByLine.get(lIdx) || [],
  }));

  const mergedIntervals: HotspotInterval[] = [];

  for (const curr of rawIntervals) {
    if (mergedIntervals.length === 0) {
      mergedIntervals.push(curr);
    } else {
      const last = mergedIntervals[mergedIntervals.length - 1];
      if (curr.start <= last.end + 1) {
        last.end = Math.max(last.end, curr.end);
        last.triggers.push(...curr.triggers);
      } else {
        mergedIntervals.push(curr);
      }
    }
  }

  // 4. Renderiza cada bloco de hotspot expandido
  for (let bIdx = 0; bIdx < mergedIntervals.length; bIdx++) {
    const block = mergedIntervals[bIdx];
    const startCoord = extraction.lines[block.start].bracket_coord;
    const endCoord = extraction.lines[block.end].bracket_coord;

    const triggerLabels = new Set<string>();
    for (const t of block.triggers) {
      if (t.zoneId) triggerLabels.add(t.zoneId);
      if (t.signalType) triggerLabels.add(t.signalType);
    }

    const headerTags = Array.from(triggerLabels).join(", ");
    lines.push(
      `### Hotspot ${bIdx + 1}: ${startCoord} .. ${endCoord} [${headerTags}]`
    );
    lines.push("");

    const blockPages = new Set<number>();
    for (let i = block.start; i <= block.end; i++) {
      blockPages.add(extraction.lines[i].page);
    }
    for (const pNum of Array.from(blockPages).sort((a, b) => a - b)) {
      const pAssets = assetsByPage.get(pNum);
      if (pAssets && pAssets.length > 0 && !emittedAssetPages.has(pNum)) {
        emittedAssetPages.add(pNum);
        for (const asset of pAssets) {
          lines.push(`- ${formatAssetAnchorLine(asset)}`);
        }
      }
    }

    for (let i = block.start; i <= block.end; i++) {
      const lineItem = extraction.lines[i];
      const triggersOnLine = triggersByLine.get(i);

      if (triggersOnLine && triggersOnLine.length > 0) {
        const markerNotes = triggersOnLine
          .map((t) =>
            t.zoneId ? `${t.zoneId} ("${t.keyword}")` : t.signalType
          )
          .join(" | ");
        lines.push(
          `- **${lineItem.bracket_coord}** ${lineItem.text}   *(ALVO: ${markerNotes})*`
        );
      } else {
        lines.push(`- ${lineItem.bracket_coord} ${lineItem.text}`);
      }
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  }

  const remainingAssetPages = Array.from(assetsByPage.keys())
    .filter((p) => !emittedAssetPages.has(p))
    .sort((a, b) => a - b);
  if (remainingAssetPages.length > 0) {
    lines.push("### Anexos Visuais Adicionais (Páginas Escaneadas / Visuais)");
    for (const pNum of remainingAssetPages) {
      for (const asset of assetsByPage.get(pNum) || []) {
        lines.push(`- ${formatAssetAnchorLine(asset)}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}
