// ============================================================================
// Catálogo Normativo Curado do Tribunal de Contas do Estado do Pará (TCE-PA)
// Atos normativos e prejulgados verificados (Lei 5)
// ============================================================================

import type { RawJurisFetchResult, RawJurisSearchResult } from "../types.ts";
import {
  mapNormativeCatalogToFetch,
  searchNormativeCatalog,
  type NormativeCatalogEntry,
} from "./catalog_helper.ts";

export const TCE_PA_CURATED_CATALOG: NormativeCatalogEntry[] = [
  {
    id: "TCE-PA-RESOLUCAO-19669-2024",
    aliases: ["RESOLUCAO-19669-2024-TCEPA", "TCEPA-RESOLUCAO-19669-2024"],
    court: "TCE-PA",
    numero: "19669",
    ano: 2024,
    colegiado: "Plenário",
    relator: "Normativo Plenário TCE-PA",
    dataSessao: "2024-01-01",
    indexacao: "Resolução 19.669/2024 TCE-PA; Suprimento de Fundos; Lei 14.133/2021",
    tese: "Resolução nº 19.669/2024 do TCE-PA: Regulamenta a concessão, aplicação e prestação de contas de suprimento de fundos em observância aos parâmetros de contratação direta e limites atualizados da Lei nº 14.133/2021.",
    dispositivo: "Adequa os procedimentos de pequenas despesas prontas de execução financeira às regras da Nova Lei de Licitações.",
    fundamentacao: "Previne o fracionamento de despesas e exige motivação formal e prestação de contas documentada.",
    keywords: [/19\.?669/i, /suprimento\s+de\s+fundos/i, /14\.?133/i, /licita[çc]/i, /despesa/i],
  },
  {
    id: "TCE-PA-PREJULGADO-21",
    aliases: ["PREJULGADO-21-TCEPA", "TCEPA-PREJULGADO-21"],
    court: "TCE-PA",
    numero: "21",
    ano: 2018,
    colegiado: "Plenário",
    relator: "Jurisprudência Vinculante TCE-PA",
    dataSessao: "2018-01-01",
    indexacao: "Prejulgado 21 TCE-PA; Regime Jurídico; Uniformização Vinculante",
    tese: "Prejulgado nº 21 do TCE-PA: Fixa entendimento normativo uniformizador de caráter vinculante no âmbito da Corte sobre interpretação do Regime Jurídico Único e contagem de tempo em atos sujeitos a registro.",
    dispositivo: "Orienta Câmaras e Plenário com efeito uniformizador equivalente a súmula administrativa nos termos regimentais.",
    fundamentacao: "Garante estabilidade decisória e isonomia no exame de legalidade dos atos administrativos submetidos ao TCE-PA.",
    keywords: [/prejulgado\s*(?:n[º°o]\s*)?21/i, /regime\s+jur[íi]dico/i, /uniformiza/i],
  },
];

export function normalizeTcePaCatalogId(idOrRef: string): string {
  const upper = idOrRef.trim().toUpperCase();
  if (/19\.?669/.test(upper)) return "TCE-PA-RESOLUCAO-19669-2024";
  if (/PREJULGADO\s*(?:N[º°O]\s*)?21\b/.test(upper) || upper.includes("TCE-PA-PREJULGADO-21")) {
    return "TCE-PA-PREJULGADO-21";
  }
  return upper;
}

export function getTcePaCatalogItemById(idOrRef: string): NormativeCatalogEntry | undefined {
  const norm = normalizeTcePaCatalogId(idOrRef);
  return TCE_PA_CURATED_CATALOG.find(
    (entry) => entry.id === norm || entry.aliases.includes(norm)
  );
}

export function searchTcePaCatalog(query: string, limit: number = 10): RawJurisSearchResult[] {
  return searchNormativeCatalog(TCE_PA_CURATED_CATALOG, query, limit, 2);
}

export function mapTcePaCatalogItemToFetch(entry: NormativeCatalogEntry): RawJurisFetchResult {
  return mapNormativeCatalogToFetch(entry);
}
