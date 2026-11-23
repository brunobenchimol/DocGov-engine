import type {
  PdfExtractionResult,
  BodyParagraphInfo,
  TableInfo,
  DocxTocMap,
  OutlineHeadingItem,
  PageSignalItem,
  ImpugnationZoneId,
  ImpugnationZoneHit,
  ImpugnationZonesMap,
  DocumentCartography,
} from "../types/index.ts";
import {
  type IndexedLineEntry,
  ALL_IMPUGNATION_ZONE_IDS,
  ZONE_DEFINITIONS,
  BUDGET_SIGNALS,
  TECH_SPEC_SIGNALS,
  normalizeText,
  matchesKeywordRule,
  formatSnippet90,
} from "./cartography_rules.ts";

export { type IndexedLineEntry, ALL_IMPUGNATION_ZONE_IDS } from "./cartography_rules.ts";
export * from "./cartography_markdown.ts";
export function isHeadingCandidate(
  text: string,
  isExplicitHeading: boolean = false
): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length > 140) return false;
  if (isExplicitHeading) return true;

  const norm = normalizeText(trimmed);

  // Palavras-chave estruturais de peças e seções licitatórias
  const structuralKeywordsRegex =
    /^(?:EDITAL\b|PREAMBULO\b|CLAUSULA\b|SECAO\b|CAPITULO\b|ANEXO\b|APENDICE\b|TERMO DE REFERENCIA\b|ESTUDO TECNICO PRELIMINAR\b|PROJETO BASICO\b|ESPECIFICACOES TECNICAS\b|ESPECIFICACAO TECNICA\b|MINUTA DE CONTRATO\b|MINUTA DO CONTRATO\b|ATA DE REGISTRO\b|HABILITACAO\b|DA HABILITACAO\b|QUALIFICACAO\b|DA QUALIFICACAO\b|OBJETO\b|DO OBJETO\b|OBRIGACOES\b|DAS OBRIGACOES\b|SANCOES\b|DAS SANCOES\b)/;

  if (structuralKeywordsRegex.test(norm)) {
    return true;
  }

  // Numeração hierárquica no início (ex.: "1. OBJETO", "1.1. HABILITAÇÃO", "II - DAS OBRIGAÇÕES")
  const numberedHeadingRegex =
    /^(?:(?:\d{1,2}(?:\.\d{1,2}){0,3})\.?|\b(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\b[\.\-\)])\s+[A-Z]/;
  if (numberedHeadingRegex.test(norm)) {
    // Evita confundir frases comuns muito longas terminadas em ponto final sem cara de título
    const hasStructuralTerm =
      /\b(?:EDITAL|PREAMBULO|CLAUSULA|SECAO|CAPITULO|ANEXO|APENDICE|TERMO DE REFERENCIA|ESTUDO TECNICO PRELIMINAR|ESPECIFICACOES TECNICAS|MINUTA DE CONTRATO|ATA DE REGISTRO|HABILITACAO|QUALIFICACAO|OBJETO|OBRIGACOES|SANCOES|GARANTIA|VISTORIA|AMOSTRA|PRAZO|PAGAMENTO|REAJUSTE|SUBCONTRATACAO|CONSORCIO|JULGAMENTO|RECURSOS|IMPUGNACAO|DOTACAO|VIGENCIA|FISCALIZACAO|RECEBIMENTO|ESTIMATIVA|NECESSIDADE|RISCOS)\b/.test(
        norm
      );
    const isUpperCaseLine =
      trimmed === trimmed.toUpperCase() && /[A-ZÀ-Ú]/.test(trimmed);
    if (hasStructuralTerm || isUpperCaseLine || trimmed.length <= 95) {
      return true;
    }
  }

  return false;
}

export function detectOutlineHeadings(
  entries: IndexedLineEntry[]
): OutlineHeadingItem[] {
  const headings: OutlineHeadingItem[] = [];
  for (const entry of entries) {
    const trimmed = entry.text.replace(/\s+/g, " ").trim();
    if (isHeadingCandidate(trimmed, entry.isExplicitHeading)) {
      headings.push({
        coord: entry.coord,
        title: trimmed,
        ...(entry.page !== undefined ? { page: entry.page } : {}),
        ...(entry.line !== undefined ? { line: entry.line } : {}),
      });
    }
  }
  return headings;
}

export function detectPageSignals(
  entries: IndexedLineEntry[]
): PageSignalItem[] {
  // Agrupa por página (em PDF) ou em blocos lógicos (em DOCX)
  const groups = new Map<
    string,
    { page?: number; items: IndexedLineEntry[] }
  >();

  for (const entry of entries) {
    const key =
      entry.page !== undefined
        ? `PAG_${String(entry.page).padStart(3, "0")}`
        : entry.coord.startsWith("[T")
        ? entry.coord.split(".")[0] + "]"
        : "CORPO_DOCX";
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(entry);
    } else {
      groups.set(key, { page: entry.page, items: [entry] });
    }
  }

  const signals: PageSignalItem[] = [];

  for (const [, group] of groups.entries()) {
    let budgetScore = 0;
    let techScore = 0;
    const matchedSet = new Set<string>();
    let firstMatchedCoord: string | null = null;
    let lastMatchedCoord: string | null = null;

    for (const item of group.items) {
      const norm = normalizeText(item.text);
      let lineMatched = false;

      for (const rule of BUDGET_SIGNALS) {
        if (matchesKeywordRule(norm, rule)) {
          budgetScore++;
          matchedSet.add(rule.label);
          lineMatched = true;
        }
      }

      for (const rule of TECH_SPEC_SIGNALS) {
        if (matchesKeywordRule(norm, rule)) {
          techScore++;
          matchedSet.add(rule.label);
          lineMatched = true;
        }
      }

      if (lineMatched) {
        if (!firstMatchedCoord) firstMatchedCoord = item.coord;
        lastMatchedCoord = item.coord;
      }
    }

    if (budgetScore > 0 || techScore > 0) {
      const startCoord = firstMatchedCoord || group.items[0].coord;
      const endCoord =
        lastMatchedCoord || group.items[group.items.length - 1].coord;
      const coord_range =
        startCoord === endCoord ? startCoord : `${startCoord}..${endCoord}`;

      let signal_type: PageSignalItem["signal_type"] = "MISTO";
      if (budgetScore > 0 && techScore === 0) {
        signal_type = "ORCAMENTO_ITENS";
      } else if (techScore > 0 && budgetScore === 0) {
        signal_type = "ESPECIFICACAO_TECNICA";
      }

      signals.push({
        ...(group.page !== undefined ? { page: group.page } : {}),
        coord_range,
        signal_type,
        budget_score: budgetScore,
        tech_spec_score: techScore,
        matched_terms: Array.from(matchedSet),
      });
    }
  }

  return signals;
}

export function detectImpugnationZones(
  entries: IndexedLineEntry[],
  headings: OutlineHeadingItem[]
): ImpugnationZonesMap {
  const zones: ImpugnationZonesMap = {
    Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO: [],
    Z2_QUALIFICACAO_TECNICA_ATESTADOS: [],
    Z3_QUALIFICACAO_ECONOMICA_GARANTIAS: [],
    Z4_VISTORIA_VISITA_TECNICA: [],
    Z5_AMOSTRA_POC_HOMOLOGACAO: [],
    Z6_VINCULO_FABRICANTE_SOLIDARIEDADE: [],
    Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP: [],
    Z8_PRAZOS_ENTREGA_SLA_GARANTIA: [],
    Z9_EQUIPE_CERTIFICACOES_SEDE: [],
    Z10_PRECOS_EXEQUIBILIDADE_PLANILHA: [],
    Z11_PAGAMENTO_REAJUSTE_IMR_SANCOES: [],
    Z12_MAPA_CRUZADO_MULTIPECA: [],
    Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO: [],
    Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO: [],
  };

  const headingByCoord = new Map<string, string>();
  for (const h of headings) {
    headingByCoord.set(h.coord, h.title);
  }

  let currentSection = "INICIO_DOCUMENTO";

  // Rastreia ocorrências por zona em diferentes regiões/seções para Z12_MAPA_CRUZADO_MULTIPECA
  const zoneRegions = new Map<
    Exclude<ImpugnationZoneId, "Z12_MAPA_CRUZADO_MULTIPECA">,
    Array<{
      coord: string;
      section: string;
      page?: number;
      lineIdx: number;
      keyword: string;
      snippet: string;
    }>
  >();

  entries.forEach((entry, idx) => {
    if (headingByCoord.has(entry.coord)) {
      currentSection = headingByCoord.get(entry.coord)!;
    }

    const norm = normalizeText(entry.text);
    const snippet = formatSnippet90(entry.text);

    for (const zDef of ZONE_DEFINITIONS) {
      const matchedKeywords: string[] = [];
      for (const kw of zDef.keywords) {
        if (matchesKeywordRule(norm, kw)) {
          matchedKeywords.push(kw.label);
        }
      }

      if (matchedKeywords.length > 0) {
        const primaryKeyword = matchedKeywords.join(", ");
        zones[zDef.id].push({
          coord: entry.coord,
          keyword: primaryKeyword,
          snippet,
          section: currentSection,
        });

        const list = zoneRegions.get(zDef.id) || [];
        list.push({
          coord: entry.coord,
          section: currentSection,
          page: entry.page,
          lineIdx: idx,
          keyword: primaryKeyword,
          snippet,
        });
        zoneRegions.set(zDef.id, list);
      }
    }
  });

  // Popula Z12_MAPA_CRUZADO_MULTIPECA quando o mesmo tema/zona aparece em seções/peças ou páginas distintas
  for (const zDef of ZONE_DEFINITIONS) {
    const occs = zoneRegions.get(zDef.id);
    if (!occs || occs.length < 2) continue;

    const first = occs[0];
    // Procura ocorrência posterior em outra seção estrutural, outra página ou distante (>= 3 linhas)
    const distant = occs.find(
      (o) =>
        o.coord !== first.coord &&
        (o.section !== first.section ||
          (o.page !== undefined && first.page !== undefined && o.page !== first.page) ||
          Math.abs(o.lineIdx - first.lineIdx) >= 3)
    );

    if (distant) {
      const crossSnippet = formatSnippet90(
        `${zDef.shortTheme} em ${first.coord} (${first.section}) e ${distant.coord} (${distant.section})`
      );
      zones.Z12_MAPA_CRUZADO_MULTIPECA.push({
        coord: `${first.coord} <-> ${distant.coord}`,
        keyword: zDef.shortTheme,
        snippet: crossSnippet,
        section: `${first.section} -> ${distant.section}`,
      });
    }
  }

  return zones;
}

export function buildPdfCartography(
  extraction: PdfExtractionResult
): DocumentCartography {
  const entries: IndexedLineEntry[] = extraction.lines.map((l) => ({
    coord: l.bracket_coord,
    text: l.text,
    page: l.page,
    line: l.line,
  }));

  const outline_headings = detectOutlineHeadings(entries);
  const page_signals = detectPageSignals(entries);
  const impugnation_zones = detectImpugnationZones(entries, outline_headings);

  return {
    outline_headings,
    page_signals,
    impugnation_zones,
  };
}

export function buildDocxCartography(
  paragraphs: BodyParagraphInfo[],
  tables: TableInfo[],
  tocMap?: DocxTocMap
): DocumentCartography {
  const entries: IndexedLineEntry[] = [];
  const tocSectionCoords = new Set(
    (tocMap?.sections || []).map((s) => `[${s.coord}]`)
  );

  for (const p of paragraphs) {
    const txt = p.text.trim();
    if (!txt) continue;
    const coord = `[P${p.index}]`;
    entries.push({
      coord,
      text: txt,
      isExplicitHeading: tocSectionCoords.has(coord),
    });
  }

  for (const tbl of tables) {
    for (const row of tbl.rows) {
      const nonEmpty = row.cells.filter((c) => c.text.trim() !== "");
      if (nonEmpty.length === 0) continue;
      const joined = nonEmpty
        .map((c) => c.text.trim().replace(/\r?\n/g, " "))
        .join(" | ");
      entries.push({
        coord: `[T${tbl.index}.R${row.rowIndex}]`,
        text: joined,
      });
    }
  }

  const outline_headings = detectOutlineHeadings(entries);
  const page_signals = detectPageSignals(entries);
  const impugnation_zones = detectImpugnationZones(entries, outline_headings);

  return {
    outline_headings,
    page_signals,
    impugnation_zones,
  };
}
