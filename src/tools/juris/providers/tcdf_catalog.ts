// ============================================================================
// Catálogo Normativo Curado do Tribunal de Contas do Distrito Federal (TCDF)
// Súmulas consolidadas aplicáveis a licitações e contratos (Lei 5)
// ============================================================================

import type { RawJurisFetchResult, RawJurisSearchResult } from "../types.ts";
import {
  mapNormativeCatalogToFetch,
  searchNormativeCatalog,
  type NormativeCatalogEntry,
} from "./catalog_helper.ts";

export const TCDF_CURATED_CATALOG: NormativeCatalogEntry[] = [
  {
    id: "SUMULA-TCDF-13",
    aliases: ["TCDF-SUMULA-13", "SUMULA-13-TCDF"],
    court: "TCDF",
    numero: "13",
    ano: 1978,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCDF",
    dataSessao: "1978-01-01",
    indexacao: "Súmula 13 TCDF; Formalização Contratual; Modalidade Licitatória",
    tese: "Súmula nº 13 do TCDF: Os termos contratuais devem indicar obrigatoriamente a modalidade e o número da licitação correspondente, ou o fundamento legal específico da dispensa ou inexigibilidade.",
    dispositivo: "Exige rastreabilidade formal do procedimento licitatório ou de contratação direta no instrumento contratual.",
    fundamentacao: "Assegura controle administrativo e transparência na formalização dos ajustes firmados pelo ente contratante.",
    keywords: [/s[úu]mula\s*13/i, /contrato/i, /modalidade/i, /dispensa/i, /inexigibilidade/i],
  },
  {
    id: "SUMULA-TCDF-68",
    aliases: ["TCDF-SUMULA-68", "SUMULA-68-TCDF"],
    court: "TCDF",
    numero: "68",
    ano: 2023,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCDF",
    dataSessao: "2023-12-06",
    indexacao: "Súmula 68 TCDF; Inexigibilidade; Setor Artístico; Lei 14.133",
    tese: "Súmula nº 68 do TCDF (atualizada à luz da Lei nº 14.133/2021): Na contratação direta de profissional do setor artístico por inexigibilidade, exige-se comprovação documental de consagração pela crítica ou opinião pública e pesquisa prévia de preços.",
    dispositivo: "Condiciona a inexigibilidade artística à instrução probatória de consagração e justificativa de preço.",
    fundamentacao: "Atualização normativa promovida pela Decisão TCDF nº 5315/2023 em harmonia com o art. 74, II, da Lei nº 14.133/2021.",
    keywords: [/s[úu]mula\s*68/i, /inexigibilidade/i, /art[íi]stico/i, /consagra/i],
  },
  {
    id: "SUMULA-TCDF-69",
    aliases: ["TCDF-SUMULA-69", "SUMULA-69-TCDF"],
    court: "TCDF",
    numero: "69",
    ano: 2023,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCDF",
    dataSessao: "2023-12-06",
    indexacao: "Súmula 69 TCDF; Inexigibilidade; Exclusividade; Inviabilidade de Competição",
    tese: "Súmula nº 69 do TCDF (atualizada): A inexigibilidade de licitação fundada em exclusividade de fornecedor exige atestados idôneos emitidos por órgãos de registro de comércio, sindicatos ou entidades equivalentes.",
    dispositivo: "Impõe comprovação objetiva e idônea da inviabilidade de competição antes da contratação direta.",
    fundamentacao: "Previne contratações diretas sem demonstração efetiva de exclusividade comercial ou técnica.",
    keywords: [/s[úu]mula\s*69/i, /exclusividade/i, /inexigibilidade/i, /inviabilidade/i],
  },
  {
    id: "SUMULA-TCDF-70",
    aliases: ["TCDF-SUMULA-70", "SUMULA-70-TCDF"],
    court: "TCDF",
    numero: "70",
    ano: 2002,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCDF",
    dataSessao: "2002-01-01",
    indexacao: "Súmula 70 TCDF; Vedação ao Fracionamento; Serviços Públicos",
    tese: "Súmula nº 70 do TCDF: Reconhece a inviabilidade de competição em serviços públicos concedidos em regime de exclusividade e veda expressamente o fracionamento de despesas com o fim de dispensar licitação.",
    dispositivo: "Proíbe o parcelamento artificial de contratações para enquadramento indevido em dispensa por valor.",
    fundamentacao: "Garante planejamento anual consolidado das despesas de mesma natureza e respeito aos limites de dispensa.",
    keywords: [/s[úu]mula\s*70/i, /fracionamento/i, /dispensa/i, /licita[çc][aã]o/i],
  },
  {
    id: "SUMULA-TCDF-109",
    aliases: ["TCDF-SUMULA-109", "SUMULA-109-TCDF"],
    court: "TCDF",
    numero: "109",
    ano: 2008,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCDF",
    dataSessao: "2008-01-01",
    indexacao: "Súmula 109 TCDF; Dispensa; Instituição de Pesquisa/Ensino; Subcontratação",
    tese: "Súmula nº 109 do TCDF: A dispensa de licitação para contratação de instituição voltada a pesquisa, ensino ou desenvolvimento institucional exige estrita pertinência temática e veda a subcontratação do objeto.",
    dispositivo: "Proíbe subcontratação em ajustes celebrados por dispensa institucional e exige vínculo direto ao objeto estatutário.",
    fundamentacao: "Impede o uso de entidades sem fins lucrativos como meras intermediárias na execução de serviços gerais ou de TI.",
    keywords: [/s[úu]mula\s*109/i, /subcontrata/i, /institui[çc][aã]o/i, /pesquisa/i, /ensino/i],
  },
];

export function normalizeTcdfCatalogId(idOrRef: string): string {
  const upper = idOrRef.trim().toUpperCase();
  const m = upper.match(/S[ÚU]MULA\s*(?:N[º°O]\s*)?(13|68|69|70|109)|TCDF[-_]SUMULA[-_](13|68|69|70|109)|SUMULA[-_](13|68|69|70|109)[-_]TCDF|SUMULA[-_]TCDF[-_](13|68|69|70|109)/);
  if (m) {
    const num = m[1] || m[2] || m[3] || m[4];
    return `SUMULA-TCDF-${num}`;
  }
  return upper;
}

export function getTcdfCatalogItemById(idOrRef: string): NormativeCatalogEntry | undefined {
  const norm = normalizeTcdfCatalogId(idOrRef);
  return TCDF_CURATED_CATALOG.find(
    (entry) => entry.id === norm || entry.aliases.includes(norm)
  );
}

export function searchTcdfCatalog(query: string, limit: number = 10): RawJurisSearchResult[] {
  return searchNormativeCatalog(TCDF_CURATED_CATALOG, query, limit, 3);
}

export function mapTcdfCatalogItemToFetch(entry: NormativeCatalogEntry): RawJurisFetchResult {
  return mapNormativeCatalogToFetch(entry);
}
