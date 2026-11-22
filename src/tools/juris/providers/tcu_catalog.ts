// ============================================================================
// Catálogo Normativo Curado do Tribunal de Contas da União (TCU)
// Súmulas consolidadas aplicáveis a licitações e contratos (Lei 5)
// ============================================================================

import type { RawJurisFetchResult, RawJurisSearchResult } from "../types.ts";
import {
  mapNormativeCatalogToFetch,
  searchNormativeCatalog,
  type NormativeCatalogEntry,
} from "./catalog_helper.ts";

export const TCU_CURATED_CATALOG: NormativeCatalogEntry[] = [
  {
    id: "SUMULA-TCU-177",
    aliases: ["TCU-SUMULA-177", "SUMULA-177-TCU"],
    court: "TCU",
    numero: "177",
    ano: 1982,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCU",
    dataSessao: "1982-11-16",
    indexacao: "Súmula 177 TCU; Definição do Objeto; Especificação Técnica",
    tese: "Súmula nº 177 do TCU: A definição do objeto da licitação deve ser precisa, suficiente e clara, vedadas especificações excessivas, irrelevantes ou desnecessárias que limitem a competição.",
    dispositivo: "Determina clareza objetiva e proporcionalidade nas especificações técnicas de editais.",
    fundamentacao: "Evita direcionamento e restrição injustificada da competitividade no planejamento da contratação pública.",
    keywords: [/s[úu]mula\s*177/i, /objeto/i, /especifica[çc]/i, /or[çc]amento/i, /padroniza/i],
  },
  {
    id: "SUMULA-TCU-222",
    aliases: ["TCU-SUMULA-222", "SUMULA-222-TCU"],
    court: "TCU",
    numero: "222",
    ano: 1994,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCU",
    dataSessao: "1994-12-06",
    indexacao: "Súmula 222 TCU; Caráter Normativo; Administração Federal",
    tese: "Súmula nº 222 do TCU: As decisões do TCU relativas à aplicação de normas gerais de licitação sobre as quais cabe privativamente à União legislar devem ser acatadas pelos administradores públicos.",
    dispositivo: "Reconhece força orientadora e vinculante às interpretações gerais de licitações fixadas pelo TCU.",
    fundamentacao: "Uniformiza a aplicação das normas gerais de contratações públicas e orienta gestores e órgãos de controle.",
    keywords: [/s[úu]mula\s*222/i, /normas\s+gerais/i, /decis[õo]es\s+do\s+tcu/i],
  },
  {
    id: "SUMULA-TCU-247",
    aliases: ["TCU-SUMULA-247", "SUMULA-247-TCU"],
    court: "TCU",
    numero: "247",
    ano: 2004,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCU",
    dataSessao: "2004-11-10",
    indexacao: "Súmula 247 TCU; Parcelamento; Adjudicação por Item; Lote Único",
    tese: "Súmula nº 247 do TCU: É obrigatória a admissão da adjudicação por item, e não por preço global, nos editais cujo objeto seja divisível, salvo comprovação técnica de prejuízo ao conjunto ou perda de economia de escala.",
    dispositivo: "Exige justificativa técnica e econômica robusta para agrupamento em lote único ou adjudicação global.",
    fundamentacao: "Regra geral de ampliação da competitividade mediante parcelamento, admitindo exceção motivada quando houver indivisibilidade operacional.",
    keywords: [/s[úu]mula\s*247/i, /parcelamento/i, /lote\s+[úu]nico/i, /adjudica[çc][aã]o/i, /pre[çc]o\s+global/i],
  },
  {
    id: "SUMULA-TCU-250",
    aliases: ["TCU-SUMULA-250", "SUMULA-250-TCU"],
    court: "TCU",
    numero: "250",
    ano: 2007,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCU",
    dataSessao: "2007-07-04",
    indexacao: "Súmula 250 TCU; Contratação Direta; Remanescente de Obra",
    tese: "Súmula nº 250 do TCU: A contratação de remanescente de obra, serviço ou fornecimento resultante de rescisão contratual exige atendimento à ordem de classificação e às mesmas condições da licitante vencedora.",
    dispositivo: "Limita a contratação direta de remanescente ao aproveitamento das condições e preços atualizados da proposta vencedora.",
    fundamentacao: "Preserva a vinculação ao certame originário e impede reabertura de negociação vantajosa ao particular.",
    keywords: [/s[úu]mula\s*250/i, /remanescente/i, /rescis[aã]o/i],
  },
  {
    id: "SUMULA-TCU-253",
    aliases: ["TCU-SUMULA-253", "SUMULA-253-TCU"],
    court: "TCU",
    numero: "253",
    ano: 2010,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCU",
    dataSessao: "2010-03-31",
    indexacao: "Súmula 253 TCU; BDI Diferenciado; Obras de Engenharia; Fornecimento",
    tese: "Súmula nº 253 do TCU: Comprovada a inviabilidade técnico-econômica de parcelamento, os itens de fornecimento de materiais e equipamentos de natureza específica com percentual expressivo no orçamento devem adotar BDI reduzido.",
    dispositivo: "Impõe aplicação de BDI diferenciado para fornecimento de equipamentos relevantes em obras e serviços de engenharia.",
    fundamentacao: "Evita incidência de despesas indiretas integrais de execução de obra sobre simples intermediação de equipamentos.",
    keywords: [/s[úu]mula\s*253/i, /bdi/i, /engenharia/i, /equipamento/i, /obra/i],
  },
  {
    id: "SUMULA-TCU-254",
    aliases: ["TCU-SUMULA-254", "SUMULA-254-TCU"],
    court: "TCU",
    numero: "254",
    ano: 2010,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCU",
    dataSessao: "2010-03-31",
    indexacao: "Súmula 254 TCU; BDI; Vedação IRPJ e CSLL",
    tese: "Súmula nº 254 do TCU: O IRPJ e a CSLL não se consubstanciam em despesa indireta passível de inclusão na taxa de BDI do orçamento-base da licitação, por serem tributos de natureza direta e personalíssima.",
    dispositivo: "Veda o repasse direto de IRPJ e CSLL na composição do BDI referencial da Administração.",
    fundamentacao: "Impede que o erário custeie tributos incidentes sobre o lucro líquido da contratada no orçamento estimado.",
    keywords: [/s[úu]mula\s*254/i, /irpj/i, /csll/i, /bdi/i],
  },
  {
    id: "SUMULA-TCU-263",
    aliases: ["TCU-SUMULA-263", "SUMULA-263-TCU"],
    court: "TCU",
    numero: "263",
    ano: 2011,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCU",
    dataSessao: "2011-01-19",
    indexacao: "Súmula 263 TCU; Qualificação Técnica; Atestados; Parcelas Relevantes",
    tese: "Súmula nº 263 do TCU: Para comprovação da capacidade técnico-operacional, é lícita a exigência de quantitativos mínimos executados em empreendimentos anteriores, desde que limitada às parcelas de maior relevância e valor significativo e devidamente justificada.",
    dispositivo: "Condiciona exigências quantitativas em atestados à relevância técnica e financeira proporcional ao objeto.",
    fundamentacao: "Equilibra segurança na execução contratual e ampla participação de licitantes qualificadas.",
    keywords: [/s[úu]mula\s*263/i, /atestado/i, /capacidade/i, /qualifica[çc][aã]o\s+t[ée]cnica/i, /relev[âa]ncia/i],
  },
  {
    id: "SUMULA-TCU-269",
    aliases: ["TCU-SUMULA-269", "SUMULA-269-TCU"],
    court: "TCU",
    numero: "269",
    ano: 2012,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCU",
    dataSessao: "2012-03-07",
    indexacao: "Súmula 269 TCU; TIC; Serviços por Resultados; Níveis de Serviço",
    tese: "Súmula nº 269 do TCU: Nas contratações de prestação de serviços de tecnologia da informação, a remuneração deve estar vinculada a resultados ou ao atendimento de níveis de serviço, admitindo-se outra métrica apenas mediante justificativa.",
    dispositivo: "Prioriza remuneração por entrega e SLA/ANS em contratos de TIC, vedando simples alocação injustificada de postos.",
    fundamentacao: "Direciona a governança de contratos de TIC à eficiência mensurável e mitigação de pagamento por mera disponibilidade.",
    keywords: [/s[úu]mula\s*269/i, /tic/i, /tecnologia/i, /resultado/i, /sla/i, /software/i],
  },
  {
    id: "SUMULA-TCU-272",
    aliases: ["TCU-SUMULA-272", "SUMULA-272-TCU"],
    court: "TCU",
    numero: "272",
    ano: 2012,
    colegiado: "Plenário",
    relator: "Jurisprudência Consolidada TCU",
    dataSessao: "2012-05-30",
    indexacao: "Súmula 272 TCU; Habilitação; Custos Prévios; Competitividade",
    tese: "Súmula nº 272 do TCU: No edital de licitação, é vedada a inclusão de exigências de habilitação e de quesitos de pontuação técnica para cujo atendimento os licitantes tenham de incorrer em custos que não sejam necessários anteriormente à celebração do contrato.",
    dispositivo: "Proíbe exigir infraestrutura instalada, equipe contratada ou despesas prévias como condição de habilitação.",
    fundamentacao: "Requisitos operacionais de execução devem ser exigidos na assinatura contratual, não como barreira prévia à disputa.",
    keywords: [/s[úu]mula\s*272/i, /habilita[çc][aã]o/i, /custo[s]?\s+pr[ée]vio/i, /infraestrutura/i],
  },
];

export function normalizeTcuCatalogId(idOrRef: string): string {
  const upper = idOrRef.trim().toUpperCase();
  const m = upper.match(/S[ÚU]MULA\s*(?:N[º°O]\s*)?(\d{3})|TCU[-_]SUMULA[-_](\d{3})|SUMULA[-_](\d{3})[-_]TCU|SUMULA[-_]TCU[-_](\d{3})/);
  if (m) {
    const num = m[1] || m[2] || m[3] || m[4];
    return `SUMULA-TCU-${num}`;
  }
  return upper;
}

export function getTcuCatalogItemById(idOrRef: string): NormativeCatalogEntry | undefined {
  const norm = normalizeTcuCatalogId(idOrRef);
  return TCU_CURATED_CATALOG.find(
    (entry) => entry.id === norm || entry.aliases.includes(norm)
  );
}

export function searchTcuCatalog(query: string, limit: number = 10): RawJurisSearchResult[] {
  return searchNormativeCatalog(TCU_CURATED_CATALOG, query, limit, 3);
}

export function mapTcuCatalogItemToFetch(entry: NormativeCatalogEntry): RawJurisFetchResult {
  return mapNormativeCatalogToFetch(entry);
}
