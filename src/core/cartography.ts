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

// ============================================================================
// Cartografia Estrutural Determinística Sem IA & Radar das 14 Zonas (v0.8.1)
// ============================================================================

export interface IndexedLineEntry {
  coord: string; // Ex: "[PAG_001 | L0001]" ou "[P0]" ou "[T0.R1.C0]"
  text: string;
  page?: number;
  line?: number;
  isExplicitHeading?: boolean;
}

export const ALL_IMPUGNATION_ZONE_IDS: ImpugnationZoneId[] = [
  "Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO",
  "Z2_QUALIFICACAO_TECNICA_ATESTADOS",
  "Z3_QUALIFICACAO_ECONOMICA_GARANTIAS",
  "Z4_VISTORIA_VISITA_TECNICA",
  "Z5_AMOSTRA_POC_HOMOLOGACAO",
  "Z6_VINCULO_FABRICANTE_SOLIDARIEDADE",
  "Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP",
  "Z8_PRAZOS_ENTREGA_SLA_GARANTIA",
  "Z9_EQUIPE_CERTIFICACOES_SEDE",
  "Z10_PRECOS_EXEQUIBILIDADE_PLANILHA",
  "Z11_PAGAMENTO_REAJUSTE_IMR_SANCOES",
  "Z12_MAPA_CRUZADO_MULTIPECA",
  "Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO",
  "Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO",
];

interface KeywordRule {
  label: string;
  normalized: string;
  wordBoundary?: boolean;
  prefixMatch?: boolean;
}

const ZONE_DEFINITIONS: Array<{
  id: Exclude<ImpugnationZoneId, "Z12_MAPA_CRUZADO_MULTIPECA">;
  shortTheme: string;
  keywords: KeywordRule[];
}> = [
  {
    id: "Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO",
    shortTheme: "Agrupamento/Consórcio/Subcontratação",
    keywords: [
      { label: "lote único", normalized: "LOTE UNICO" },
      { label: "preço global", normalized: "PRECO GLOBAL" },
      { label: "agrupamento", normalized: "AGRUPAMENTO" },
      { label: "parcelamento", normalized: "PARCELAMENTO" },
      { label: "consórcio", normalized: "CONSORCIO" },
      { label: "subcontrata", normalized: "SUBCONTRATA", prefixMatch: true },
    ],
  },
  {
    id: "Z2_QUALIFICACAO_TECNICA_ATESTADOS",
    shortTheme: "Qualificação Técnica/Atestados",
    keywords: [
      { label: "atestado", normalized: "ATESTADO", prefixMatch: true },
      { label: "capacidade técnica", normalized: "CAPACIDADE TECNICA" },
      { label: "aptidão", normalized: "APTIDAO" },
      {
        label: "parcela de maior relevância",
        normalized: "PARCELA DE MAIOR RELEVANCIA",
      },
      { label: "50%", normalized: "50%" },
      { label: "somatório de atestados", normalized: "SOMATORIO DE ATESTADOS" },
      { label: "CAT", normalized: "CAT", wordBoundary: true },
      { label: "CREA", normalized: "CREA", wordBoundary: true },
      { label: "CAU", normalized: "CAU", wordBoundary: true },
      { label: "acervo", normalized: "ACERVO", wordBoundary: true },
    ],
  },
  {
    id: "Z3_QUALIFICACAO_ECONOMICA_GARANTIAS",
    shortTheme: "Qualificação Econômica/Garantias",
    keywords: [
      { label: "patrimônio líquido", normalized: "PATRIMONIO LIQUIDO" },
      { label: "capital social", normalized: "CAPITAL SOCIAL" },
      { label: "liquidez", normalized: "LIQUIDEZ" },
      { label: "endividamento", normalized: "ENDIVIDAMENTO" },
      { label: "garantia de proposta", normalized: "GARANTIA DE PROPOSTA" },
      { label: "garantia contratual", normalized: "GARANTIA CONTRATUAL" },
      { label: "caução", normalized: "CAUCAO" },
    ],
  },
  {
    id: "Z4_VISTORIA_VISITA_TECNICA",
    shortTheme: "Vistoria/Visita Técnica",
    keywords: [
      { label: "vistoria", normalized: "VISTORIA" },
      { label: "visita técnica", normalized: "VISITA TECNICA" },
      { label: "in loco", normalized: "IN LOCO", wordBoundary: true },
      {
        label: "declaração de conhecimento",
        normalized: "DECLARACAO DE CONHECIMENTO",
      },
    ],
  },
  {
    id: "Z5_AMOSTRA_POC_HOMOLOGACAO",
    shortTheme: "Amostra/PoC/Homologação",
    keywords: [
      { label: "amostra", normalized: "AMOSTRA", prefixMatch: true },
      { label: "prova de conceito", normalized: "PROVA DE CONCEITO" },
      { label: "PoC", normalized: "POC", wordBoundary: true },
      { label: "demonstração", normalized: "DEMONSTRACAO" },
      { label: "protótipo", normalized: "PROTOTIPO" },
      { label: "laudo", normalized: "LAUDO", wordBoundary: true },
    ],
  },
  {
    id: "Z6_VINCULO_FABRICANTE_SOLIDARIEDADE",
    shortTheme: "Vínculo Fabricante/Solidariedade",
    keywords: [
      { label: "fabricante", normalized: "FABRICANTE" },
      { label: "solidariedade", normalized: "SOLIDARIEDADE" },
      { label: "credenciamento", normalized: "CREDENCIAMENTO" },
      { label: "canal autorizado", normalized: "CANAL AUTORIZADO" },
      { label: "partner", normalized: "PARTNER", wordBoundary: true },
      { label: "parceiro oficial", normalized: "PARCEIRO OFICIAL" },
      {
        label: "declaração do fabricante",
        normalized: "DECLARACAO DO FABRICANTE",
      },
      { label: "carta do fabricante", normalized: "CARTA DO FABRICANTE" },
    ],
  },
  {
    id: "Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP",
    shortTheme: "Direcionamento Oculto / Datasheet Trap",
    keywords: [
      { label: "part number", normalized: "PART NUMBER" },
      { label: "P/N", normalized: "P/N", wordBoundary: true },
      { label: "SKU", normalized: "SKU", wordBoundary: true },
      { label: "datasheet", normalized: "DATASHEET" },
      { label: "dimensões exatas", normalized: "DIMENSOES EXATAS" },
      { label: "parâmetros de catálogo", normalized: "PARAMETROS DE CATALOGO" },
      { label: "catálogo do fabricante", normalized: "CATALOGO DO FABRICANTE" },
      { label: "frequência mínima", normalized: "FREQUENCIA MINIMA" },
      { label: "frequência de", normalized: "FREQUENCIA DE" },
      { label: "tolerância máxima", normalized: "TOLERANCIA MAXIMA" },
      { label: "tolerância de", normalized: "TOLERANCIA DE" },
      { label: "especificação técnica detalhada", normalized: "ESPECIFICACAO TECNICA DETALHADA" },
      { label: "GHz", normalized: "GHZ", wordBoundary: true },
      { label: "Gbps", normalized: "GBPS", wordBoundary: true },
      { label: "IOPS", normalized: "IOPS", wordBoundary: true },
      { label: "NVMe", normalized: "NVME", wordBoundary: true },
      { label: "throughput", normalized: "THROUGHPUT" },
      { label: "latência máxima", normalized: "LATENCIA MAXIMA" },
      { label: "MTBF", normalized: "MTBF", wordBoundary: true },
      { label: "rack 1U", normalized: "RACK 1U" },
      { label: "rack 2U", normalized: "RACK 2U" },
      { label: "SFP+", normalized: "SFP+" },
      { label: "SFP28", normalized: "SFP28" },
      { label: "Nutanix", normalized: "NUTANIX", wordBoundary: true },
      { label: "VMware", normalized: "VMWARE", wordBoundary: true },
    ],
  },
  {
    id: "Z8_PRAZOS_ENTREGA_SLA_GARANTIA",
    shortTheme: "Prazos/SLA/Garantia",
    keywords: [
      { label: "prazo de entrega", normalized: "PRAZO DE ENTREGA" },
      { label: "implantação", normalized: "IMPLANTACAO" },
      { label: "dias corridos", normalized: "DIAS CORRIDOS" },
      { label: "dias úteis", normalized: "DIAS UTEIS" },
      { label: "on-site", normalized: "ON-SITE" },
      { label: "SLA", normalized: "SLA", wordBoundary: true },
      { label: "nível de serviço", normalized: "NIVEL DE SERVICO" },
      { label: "tempo de atendimento", normalized: "TEMPO DE ATENDIMENTO" },
    ],
  },
  {
    id: "Z9_EQUIPE_CERTIFICACOES_SEDE",
    shortTheme: "Equipe/Certificações/Sede",
    keywords: [
      { label: "vínculo empregatício", normalized: "VINCULO EMPREGATICIO" },
      { label: "CTPS", normalized: "CTPS", wordBoundary: true },
      { label: "quadro permanente", normalized: "QUADRO PERMANENTE" },
      { label: "certificação", normalized: "CERTIFICACAO" },
      { label: "escritório local", normalized: "ESCRITORIO LOCAL" },
      { label: "filial", normalized: "FILIAL", wordBoundary: true },
    ],
  },
  {
    id: "Z10_PRECOS_EXEQUIBILIDADE_PLANILHA",
    shortTheme: "Preços/Exequibilidade/Planilha",
    keywords: [
      { label: "inexequível", normalized: "INEXEQUIVEL" },
      { label: "exequibilidade", normalized: "EXEQUIBILIDADE" },
      { label: "75%", normalized: "75%" },
      { label: "planilha de custos", normalized: "PLANILHA DE CUSTOS" },
      { label: "BDI", normalized: "BDI", wordBoundary: true },
      { label: "convenção coletiva", normalized: "CONVENCAO COLETIVA" },
      { label: "CCT", normalized: "CCT", wordBoundary: true },
    ],
  },
  {
    id: "Z11_PAGAMENTO_REAJUSTE_IMR_SANCOES",
    shortTheme: "Pagamento/Reajuste/IMR/Sanções",
    keywords: [
      { label: "medição de resultado", normalized: "MEDICAO DE RESULTADO" },
      { label: "IMR", normalized: "IMR", wordBoundary: true },
      { label: "glosa", normalized: "GLOSA", wordBoundary: true },
      { label: "reajuste", normalized: "REAJUSTE" },
      { label: "repactuação", normalized: "REPACTUACAO" },
      { label: "IPCA", normalized: "IPCA", wordBoundary: true },
      { label: "ICT", normalized: "ICT", wordBoundary: true },
      { label: "multa", normalized: "MULTA", wordBoundary: true },
      { label: "impedimento de licitar", normalized: "IMPEDIMENTO DE LICITAR" },
    ],
  },
  {
    id: "Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO",
    shortTheme: "Marca Explícita / Padronização de Nicho",
    keywords: [
      { label: "marca", normalized: "MARCA", wordBoundary: true },
      { label: "modelo", normalized: "MODELO", wordBoundary: true },
      { label: "fabricante", normalized: "FABRICANTE", wordBoundary: true },
      { label: "padronização", normalized: "PADRONIZACAO" },
      {
        label: "processo de padronização",
        normalized: "PROCESSO DE PADRONIZACAO",
      },
      { label: "parque instalado", normalized: "PARQUE INSTALADO" },
      { label: "parque atual", normalized: "PARQUE ATUAL" },
      { label: "compatibilidade com", normalized: "COMPATIBILIDADE COM" },
      { label: "interoperabilidade", normalized: "INTEROPERABILIDADE" },
      { label: "exclusivo", normalized: "EXCLUSIVO", prefixMatch: true },
      { label: "fornecedor exclusivo", normalized: "FORNECEDOR EXCLUSIVO" },
      { label: "equivalente", normalized: "EQUIVALENTE" },
      { label: "similar", normalized: "SIMILAR", wordBoundary: true },
      { label: "melhor qualidade", normalized: "MELHOR QUALIDADE" },
      { label: "Art. 41", normalized: "ART. 41", wordBoundary: true },
      { label: "Art. 43", normalized: "ART. 43", wordBoundary: true },
    ],
  },
  {
    id: "Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO",
    shortTheme: "Métricas / Unidade de Medida e Licenciamento",
    keywords: [
      { label: "unidade de medida", normalized: "UNIDADE DE MEDIDA" },
      { label: "métrica", normalized: "METRICA", prefixMatch: true },
      { label: "UST", normalized: "UST", wordBoundary: true },
      { label: "USM", normalized: "USM", wordBoundary: true },
      { label: "HST", normalized: "HST", wordBoundary: true },
      { label: "ponto de função", normalized: "PONTO DE FUNCAO" },
      { label: "PF", normalized: "PF", wordBoundary: true },
      { label: "IFPUG", normalized: "IFPUG", wordBoundary: true },
      { label: "SNAP", normalized: "SNAP", wordBoundary: true },
      { label: "hora técnica", normalized: "HORA TECNICA" },
      { label: "homem-hora", normalized: "HOMEM-HORA" },
      { label: "catálogo de serviços", normalized: "CATALOGO DE SERVICOS" },
      { label: "complexidade", normalized: "COMPLEXIDADE" },
      { label: "por core", normalized: "POR CORE" },
      { label: "por núcleo", normalized: "POR NUCLEO" },
      { label: "vCore", normalized: "VCORE", wordBoundary: true },
      { label: "por socket", normalized: "POR SOCKET" },
      { label: "usuário nomeado", normalized: "USUARIO NOMEADO" },
      { label: "named user", normalized: "NAMED USER" },
      { label: "usuário concorrente", normalized: "USUARIO CONCORRENTE" },
      { label: "concurrent user", normalized: "CONCURRENT USER" },
      { label: "subscrição", normalized: "SUBSCRICAO" },
      { label: "licenciamento", normalized: "LICENCIAMENTO" },
      { label: "EPS", normalized: "EPS", wordBoundary: true },
      { label: "vCPU", normalized: "VCPU", wordBoundary: true },
      { label: "Súmula 269", normalized: "SUMULA 269" },
    ],
  },
];

const BUDGET_SIGNALS: KeywordRule[] = [
  { label: "R$", normalized: "R$" },
  { label: "Valor Unitário", normalized: "VALOR UNITARIO" },
  { label: "Valor Total", normalized: "VALOR TOTAL" },
  { label: "CATMAT", normalized: "CATMAT", wordBoundary: true },
  { label: "CATSER", normalized: "CATSER", wordBoundary: true },
  {
    label: "Unidade de Fornecimento",
    normalized: "UNIDADE DE FORNECIMENTO",
  },
  { label: "Quantidade", normalized: "QUANTIDADE", wordBoundary: true },
  { label: "Lote", normalized: "LOTE", wordBoundary: true },
  { label: "Item", normalized: "ITEM", wordBoundary: true },
];

const TECH_SPEC_SIGNALS: KeywordRule[] = [
  { label: "GHz", normalized: "GHZ", wordBoundary: true },
  { label: "MHz", normalized: "MHZ", wordBoundary: true },
  { label: "GB", normalized: "GB", wordBoundary: true },
  { label: "TB", normalized: "TB", wordBoundary: true },
  { label: "Mbps", normalized: "MBPS", wordBoundary: true },
  { label: "Gbps", normalized: "GBPS", wordBoundary: true },
  { label: "IOPS", normalized: "IOPS", wordBoundary: true },
  { label: "kVA", normalized: "KVA", wordBoundary: true },
  { label: "BTU", normalized: "BTU", wordBoundary: true },
  { label: "mm", normalized: "MM", wordBoundary: true },
  { label: "cm", normalized: "CM", wordBoundary: true },
  { label: "kg", normalized: "KG", wordBoundary: true },
  { label: "ABNT", normalized: "ABNT", wordBoundary: true },
  { label: "NBR", normalized: "NBR", wordBoundary: true },
  { label: "ISO", normalized: "ISO", wordBoundary: true },
  { label: "IEC", normalized: "IEC", wordBoundary: true },
  { label: "IEEE", normalized: "IEEE", wordBoundary: true },
  { label: "SLA", normalized: "SLA", wordBoundary: true },
  { label: "24x7", normalized: "24X7" },
  { label: "part number", normalized: "PART NUMBER" },
  { label: "garantia de", normalized: "GARANTIA DE" },
];

function normalizeText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesKeywordRule(normalizedLine: string, rule: KeywordRule): boolean {
  if (rule.wordBoundary) {
    const pattern = new RegExp(
      `(^|[^A-Z0-9])${escapeRegex(rule.normalized)}([^A-Z0-9]|$)`
    );
    return pattern.test(normalizedLine);
  }
  if (rule.prefixMatch) {
    const pattern = new RegExp(
      `(^|[^A-Z0-9])${escapeRegex(rule.normalized)}[A-Z0-9]*`
    );
    return pattern.test(normalizedLine);
  }
  return normalizedLine.includes(rule.normalized);
}

function formatSnippet90(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 90) return clean;
  return `${clean.slice(0, 87)}...`;
}

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
