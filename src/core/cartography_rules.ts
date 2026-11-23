import type { ImpugnationZoneId } from "../types/index.ts";
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

export interface KeywordRule {
  label: string;
  normalized: string;
  wordBoundary?: boolean;
  prefixMatch?: boolean;
}

export const ZONE_DEFINITIONS: Array<{
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

export const BUDGET_SIGNALS: KeywordRule[] = [
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

export const TECH_SPEC_SIGNALS: KeywordRule[] = [
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

export function normalizeText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchesKeywordRule(normalizedLine: string, rule: KeywordRule): boolean {
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

export function formatSnippet90(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 90) return clean;
  return `${clean.slice(0, 87)}...`;
}
