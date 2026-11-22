// ============================================================================
// Catálogo Normativo Curado do Supremo Tribunal Federal (STF)
// Súmulas, Súmulas Vinculantes e Temas de Repercussão Geral (Lei 5)
// ============================================================================

import type { RawJurisFetchResult, RawJurisSearchResult } from "../types.ts";
import {
  mapNormativeCatalogToFetch,
  searchNormativeCatalog,
  type NormativeCatalogEntry,
} from "./catalog_helper.ts";

export const STF_CURATED_CATALOG: NormativeCatalogEntry[] = [
  {
    id: "SUMULA-STF-473",
    aliases: ["STF-SUMULA-473", "SUMULA-473-STF"],
    court: "STF",
    numero: "473",
    ano: 1969,
    colegiado: "Tribunal Pleno",
    relator: "Jurisprudência Consolidada STF",
    dataSessao: "1969-12-03",
    indexacao: "Súmula 473 STF; Autotutela; Anulação; Revogação",
    tese: "Súmula nº 473 do STF: Consagra o poder-dever de autotutela administrativa para anular atos eivados de vício de legalidade e revogar atos por conveniência e oportunidade, ressalvados os direitos adquiridos e o controle judicial.",
    dispositivo: "Autoriza a anulação de edital ou ato contratual ilegal e a revogação motivada por interesse público superveniente.",
    fundamentacao: "Princípio da legalidade administrativa e revisão interna de atos no âmbito das contratações públicas.",
    keywords: [/s[úu]mula\s*473/i, /autotutela/i, /anula[çc][aã]o/i, /revoga[çc][aã]o/i],
  },
  {
    id: "SUMULA-VINCULANTE-STF-10",
    aliases: ["SV-10-STF", "STF-SV-10"],
    court: "STF",
    numero: "10",
    ano: 2008,
    colegiado: "Tribunal Pleno",
    relator: "Jurisprudência Vinculante STF",
    dataSessao: "2008-06-18",
    indexacao: "Súmula Vinculante 10; Reserva de Plenário; Art. 97 CF",
    tese: "Súmula Vinculante nº 10 do STF: Viola a cláusula de reserva de plenário decisão de órgão fracionário que afasta a incidência de lei ou ato normativo do Poder Público sem declarar expressamente sua inconstitucionalidade.",
    dispositivo: "Impede o afastamento fracionário de norma legal aplicável à Administração sem observância do art. 97 da CF.",
    fundamentacao: "Garante segurança jurídica e estabilidade normativa frente a interpretações que esvaziem comandos legais federais.",
    keywords: [/s[úu]mula\s+vinculante\s*10/i, /sv\s*10/i, /reserva\s+de\s+plen[áa]rio/i],
  },
  {
    id: "SUMULA-VINCULANTE-STF-13",
    aliases: ["SV-13-STF", "STF-SV-13"],
    court: "STF",
    numero: "13",
    ano: 2008,
    colegiado: "Tribunal Pleno",
    relator: "Jurisprudência Vinculante STF",
    dataSessao: "2008-08-21",
    indexacao: "Súmula Vinculante 13; Nepotismo; Moralidade; Impessoalidade",
    tese: "Súmula Vinculante nº 13 do STF: Veda a nomeação de cônjuge, companheiro ou parente até o terceiro grau para cargo em comissão, confiança ou função gratificada na Administração direta e indireta, inclusive mediante designações recíprocas.",
    dispositivo: "Aplica os princípios da moralidade e impessoalidade para proibir práticas de nepotismo direto ou cruzado.",
    fundamentacao: "Decorre diretamente do art. 37, caput, da Constituição Federal, alcançando órgãos públicos e entidades estatais.",
    keywords: [/s[úu]mula\s+vinculante\s*13/i, /sv\s*13/i, /nepotismo/i, /moralidade/i],
  },
  {
    id: "STF-ADC-16",
    aliases: ["ADC-16-STF", "ADC-16"],
    court: "STF",
    numero: "16",
    ano: 2010,
    colegiado: "Tribunal Pleno",
    relator: "Min. Cezar Peluso",
    dataSessao: "2010-11-24",
    indexacao: "ADC 16; Responsabilidade Subsidiária; Terceirização; Art. 71 Lei 8.666",
    tese: "ADC nº 16/DF: Declarou constitucional o art. 71, § 1º, da Lei nº 8.666/1993, vedando a transferência automática de encargos trabalhistas inadimplidos pela contratada ao ente público sem comprovação de falha fiscalizatória.",
    dispositivo: "Condiciona eventual responsabilização subsidiária à apuração de conduta omissiva na fiscalização do contrato.",
    fundamentacao: "A regularidade formal da licitação não dispensa a Administração de acompanhar a execução trabalhista, mas impede condenação objetiva.",
    keywords: [/adc\s*16/i, /terceiriza/i, /subsidi[áa]ria/i, /encargos\s+trabalhistas/i],
  },
  {
    id: "STF-TEMA-246",
    aliases: ["TEMA-246-STF", "RE-760931"],
    court: "STF",
    numero: "246",
    ano: 2017,
    colegiado: "Tribunal Pleno",
    relator: "Min. Luiz Fux (Redator p/ Acórdão)",
    dataSessao: "2017-04-26",
    indexacao: "Tema 246 STF; RE 760.931; Repercussão Geral; Terceirização",
    tese: "Tema 246/STF (RE 760.931): O inadimplemento dos encargos trabalhistas dos empregados da contratada não transfere automaticamente ao Poder Público a responsabilidade pelo pagamento, nem solidária nem subsidiariamente.",
    dispositivo: "Reafirma a proibição de responsabilização automática de órgãos e estatais por dívidas trabalhistas de terceirizadas.",
    fundamentacao: "Exige demonstração de nexo entre a conduta omissiva da Administração e o dano trabalhista.",
    keywords: [/tema\s*246/i, /760\.?931/i, /terceiriza/i, /subsidi[áa]ria/i],
  },
  {
    id: "STF-TEMA-1118",
    aliases: ["TEMA-1118-STF", "RE-1298647"],
    court: "STF",
    numero: "1118",
    ano: 2025,
    colegiado: "Tribunal Pleno",
    relator: "Min. Nunes Marques",
    dataSessao: "2025-02-13",
    indexacao: "Tema 1118 STF; RE 1.298.647; Ônus da Prova; Culpa in Vigilando",
    tese: "Tema 1.118/STF (RE 1.298.647): Exige comprovação de comportamento sistematicamente negligente do ente público na fiscalização do contrato terceirizado para cogitar responsabilidade subsidiária, afastando presunção automática contra o contratante.",
    dispositivo: "Confere segurança jurídica à fiscalização documentada de contratos administrativos de prestação de serviços (DEMO).",
    fundamentacao: "A atuação regular de fiscalização, com exigência de certidões e adoção de medidas corretivas tempestivas, elide culpa administrativa.",
    keywords: [/tema\s*1\.?118/i, /1\.?298\.?647/i, /[ôo]nus\s+da\s+prova/i, /fiscaliza/i],
  },
  {
    id: "STF-ADI-5624",
    aliases: ["ADI-5624-STF", "ADI-5624"],
    court: "STF",
    numero: "5624",
    ano: 2019,
    colegiado: "Tribunal Pleno",
    relator: "Min. Ricardo Lewandowski",
    dataSessao: "2019-06-06",
    indexacao: "ADI 5624; Lei 13.303/2016; Empresas Estatais; Controle Acionário",
    tese: "ADI nº 5.624/DF: Fixou balizas constitucionais para a governança e alienação de ativos de empresas públicas e sociedades de economia mista sob o regime da Lei nº 13.303/2016, distinguindo controle da matriz e operações de subsidiárias.",
    dispositivo: "Delimitou exigência de autorização legislativa e procedimento competitivo conforme a natureza da operação societária estatal.",
    fundamentacao: "Interpretação conforme a Constituição aplicável ao estatuto jurídico das estatais federais e subnacionais.",
    keywords: [/adi\s*5\.?624/i, /13\.?303/i, /estatais/i, /estatal/i, /economia\s+mista/i],
  },
];

export function normalizeStfCatalogId(idOrRef: string): string {
  const upper = idOrRef.trim().toUpperCase();
  if (/S[ÚU]MULA\s*(?:N[º°O]\s*)?473/.test(upper) || upper.includes("SUMULA-STF-473")) {
    return "SUMULA-STF-473";
  }
  if (/(?:S[ÚU]MULA\s+VINCULANTE|SV)\s*(?:N[º°O]\s*)?10\b/.test(upper) || upper.includes("SUMULA-VINCULANTE-STF-10")) {
    return "SUMULA-VINCULANTE-STF-10";
  }
  if (/(?:S[ÚU]MULA\s+VINCULANTE|SV)\s*(?:N[º°O]\s*)?13\b/.test(upper) || upper.includes("SUMULA-VINCULANTE-STF-13")) {
    return "SUMULA-VINCULANTE-STF-13";
  }
  if (/ADC\s*16\b/.test(upper) || upper.includes("STF-ADC-16")) return "STF-ADC-16";
  if (/TEMA\s*246\b|RE\s*760\.?931/.test(upper) || upper.includes("STF-TEMA-246")) {
    return "STF-TEMA-246";
  }
  if (/TEMA\s*1\.?118\b|RE\s*1\.?298\.?647/.test(upper) || upper.includes("STF-TEMA-1118")) {
    return "STF-TEMA-1118";
  }
  if (/ADI\s*5\.?624\b/.test(upper) || upper.includes("STF-ADI-5624")) return "STF-ADI-5624";
  return upper;
}

export function getStfCatalogItemById(idOrRef: string): NormativeCatalogEntry | undefined {
  const norm = normalizeStfCatalogId(idOrRef);
  return STF_CURATED_CATALOG.find(
    (entry) => entry.id === norm || entry.aliases.includes(norm)
  );
}

export function searchStfCatalog(query: string, limit: number = 10): RawJurisSearchResult[] {
  return searchNormativeCatalog(STF_CURATED_CATALOG, query, limit, 3);
}

export function mapStfCatalogItemToFetch(entry: NormativeCatalogEntry): RawJurisFetchResult {
  return mapNormativeCatalogToFetch(entry);
}
