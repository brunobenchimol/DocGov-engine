// ============================================================================
// Catálogo Normativo Curado do Tribunal de Contas do Estado do Ceará (TCE-CE)
// Súmulas verificadas de licitações e engenharia (Lei 5)
// ============================================================================

import type { RawJurisFetchResult, RawJurisSearchResult } from "../types.ts";
import {
  mapNormativeCatalogToFetch,
  searchNormativeCatalog,
  type NormativeCatalogEntry,
} from "./catalog_helper.ts";

export const TCE_CE_CURATED_CATALOG: NormativeCatalogEntry[] = [
  {
    id: "SUMULA-TCECE-2",
    aliases: ["TCE-CE-SUMULA-2", "SUMULA-2-TCE-CE"],
    court: "TCE-CE",
    numero: "2",
    ano: 2017,
    colegiado: "Pleno",
    relator: "Jurisprudência Consolidada TCE-CE",
    dataSessao: "2017-03-16",
    indexacao: "Súmula 2 TCE-CE; Capacidade Técnico-Operacional; Parcelas Relevantes; Competitividade",
    tese: "Súmula nº 02 do TCE-CE: Restringe a competitividade do certame licitatório de obras e serviços de engenharia a exigência editalícia de comprovação de capacidade técnico-operacional para parcelas de menor relevância técnica e valor pouco significativo.",
    dispositivo: "Veda exigência de atestados operacionais sobre itens secundários ou financeiramente irrelevantes do objeto.",
    fundamentacao: "Assegura proporcionalidade na habilitação técnica em consonância com a vedação constitucional de exigências impertinentes.",
    keywords: [/s[úu]mula\s*0?2/i, /capacidade\s+t[ée]cnico/i, /menor\s+relev[âa]ncia/i, /competitividade/i, /engenharia/i, /obra/i],
  },
  {
    id: "SUMULA-TCECE-3",
    aliases: ["TCE-CE-SUMULA-3", "SUMULA-3-TCE-CE"],
    court: "TCE-CE",
    numero: "3",
    ano: 2017,
    colegiado: "Pleno",
    relator: "Jurisprudência Consolidada TCE-CE",
    dataSessao: "2017-03-16",
    indexacao: "Súmula 3 TCE-CE; Qualificação Técnico-Profissional; Quadro Permanente",
    tese: "Súmula nº 03 do TCE-CE: Restringe a competitividade do certame de obras e serviços de engenharia cláusula editalícia que afaste o prestador de serviços contratado do conceito de quadro permanente da licitante para qualificação técnico-profissional.",
    dispositivo: "Admite comprovação de vínculo do responsável técnico mediante contrato de prestação de serviços sem vínculo celetista prévio.",
    fundamentacao: "Elimina barreiras formais desnecessárias à participação de empresas que mantêm profissionais autônomos ou contratados.",
    keywords: [/s[úu]mula\s*0?3/i, /quadro\s+permanente/i, /t[ée]cnico[- ]profissional/i, /prestador\s+de\s+servi[çc]os/i, /software/i],
  },
];

export function normalizeTceCeCatalogId(idOrRef: string): string {
  const upper = idOrRef.trim().toUpperCase();
  const m = upper.match(/S[ÚU]MULA\s*(?:N[º°O]\s*)?0?(2|3)|TCE[-_]?CE[-_]SUMULA[-_]0?(2|3)|SUMULA[-_]0?(2|3)[-_]TCE[-_]?CE|SUMULA[-_]TCECE[-_]0?(2|3)/);
  if (m) {
    const num = m[1] || m[2] || m[3] || m[4];
    return `SUMULA-TCECE-${num}`;
  }
  return upper;
}

export function getTceCeCatalogItemById(idOrRef: string): NormativeCatalogEntry | undefined {
  const norm = normalizeTceCeCatalogId(idOrRef);
  return TCE_CE_CURATED_CATALOG.find(
    (entry) => entry.id === norm || entry.aliases.includes(norm)
  );
}

export function searchTceCeCatalog(query: string, limit: number = 10): RawJurisSearchResult[] {
  return searchNormativeCatalog(TCE_CE_CURATED_CATALOG, query, limit, 2);
}

export function mapTceCeCatalogItemToFetch(entry: NormativeCatalogEntry): RawJurisFetchResult {
  return mapNormativeCatalogToFetch(entry);
}
