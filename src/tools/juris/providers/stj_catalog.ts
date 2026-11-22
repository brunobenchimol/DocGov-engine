// ============================================================================
// Catálogo Normativo Curado do Superior Tribunal de Justiça (STJ)
// Súmulas consolidadas aplicáveis a licitações e empresas estatais (Lei 5)
// ============================================================================

import type { RawJurisFetchResult, RawJurisSearchResult } from "../types.ts";
import {
  mapNormativeCatalogToFetch,
  searchNormativeCatalog,
  type NormativeCatalogEntry,
} from "./catalog_helper.ts";

export const STJ_CURATED_CATALOG: NormativeCatalogEntry[] = [
  {
    id: "SUMULA-STJ-333",
    aliases: ["STJ-SUMULA-333", "SUMULA-333-STJ"],
    court: "STJ",
    numero: "333",
    ano: 2006,
    colegiado: "Primeira Seção",
    relator: "Jurisprudência Consolidada STJ",
    dataSessao: "2006-12-13",
    indexacao: "Súmula 333 STJ; Mandado de Segurança; Sociedade de Economia Mista; Empresa Pública",
    tese: "Súmula nº 333 do STJ: Cabe mandado de segurança contra ato praticado em licitação promovida por sociedade de economia mista ou empresa pública.",
    dispositivo: "Reconhece natureza de autoridade aos atos de comissão ou agente de licitação em empresas estatais.",
    fundamentacao: "Embora regidas pelo direito privado quanto às atividades econômicas, as empresas públicas e sociedades de economia mista submetem-se ao controle constitucional e legal nos procedimentos licitatórios.",
    keywords: [/s[úu]mula\s*333/i, /mandado\s+de\s+seguran[çc]a/i, /economia\s+mista/i, /empresa\s+p[úu]blica/i, /13\.?303/i, /licita/i],
  },
  {
    id: "SUMULA-STJ-645",
    aliases: ["STJ-SUMULA-645", "SUMULA-645-STJ"],
    court: "STJ",
    numero: "645",
    ano: 2021,
    colegiado: "Terceira Seção",
    relator: "Jurisprudência Consolidada STJ",
    dataSessao: "2021-02-24",
    indexacao: "Súmula 645 STJ; Fraude à Licitação; Crime Formal; Competitividade",
    tese: "Súmula nº 645 do STJ: O crime de fraude à competitividade do procedimento licitatório tem natureza formal, consumando-se independentemente da demonstração de prejuízo efetivo ao erário ou de obtenção da vantagem.",
    dispositivo: "Consolida a tutela penal e sancionatória da lisura e competitividade do certame público.",
    fundamentacao: "A proteção jurídica alcança a integridade do processo competitivo desde a frustração deliberada do caráter competitivo.",
    keywords: [/s[úu]mula\s*645/i, /fraude/i, /competitividade/i, /licita[çc][aã]o/i, /san[çc][aã]o/i],
  },
];

export function normalizeStjCatalogId(idOrRef: string): string {
  const upper = idOrRef.trim().toUpperCase();
  const m = upper.match(/S[ÚU]MULA\s*(?:N[º°O]\s*)?(333|645)|STJ[-_]SUMULA[-_](333|645)|SUMULA[-_](333|645)[-_]STJ|SUMULA[-_]STJ[-_](333|645)/);
  if (m) {
    const num = m[1] || m[2] || m[3] || m[4];
    return `SUMULA-STJ-${num}`;
  }
  return upper;
}

export function getStjCatalogItemById(idOrRef: string): NormativeCatalogEntry | undefined {
  const norm = normalizeStjCatalogId(idOrRef);
  return STJ_CURATED_CATALOG.find(
    (entry) => entry.id === norm || entry.aliases.includes(norm)
  );
}

export function searchStjCatalog(query: string, limit: number = 10): RawJurisSearchResult[] {
  return searchNormativeCatalog(STJ_CURATED_CATALOG, query, limit, 2);
}

export function mapStjCatalogItemToFetch(entry: NormativeCatalogEntry): RawJurisFetchResult {
  return mapNormativeCatalogToFetch(entry);
}
