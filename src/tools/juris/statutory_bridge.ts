// ============================================================================
// Matriz de Equivalência Normativa (Statutory Bridge)
// Lei 13.303/2016 + RILC <-> Lei 14.133/2021 + Súmulas do TCU
// ============================================================================

import type { StatutoryBridgeMapping, JurisLegalRegime } from "./types.ts";

export const STATE_IT_ENTITIES = [
  "SERPRO",
  "DATAPREV",
  "BB TECNOLOGIA",
  "BBTS",
  "PETROBRAS",
  "CAIXA",
  "BNDES",
  "PRODEPA",
  "PRODERJ",
  "PRODAM",
  "PRODESP",
  "CELEPAR",
  "PROCERGS",
  "PRODABEL",
  "EMPREL",
  "ETICE",
  "ATI",
] as const;

export const STATUTORY_BRIDGES: StatutoryBridgeMapping[] = [
  {
    id: "SB-01",
    topic: "Padronização / Marca / Homologação Prévia",
    art13303: "Art. 47, I e II; Art. 64 (Pré-qualificação permanente)",
    art14133: "Art. 41, I, 'a' a 'd'; Art. 42",
    sumulasTcu: ["Súmula TCU 270"],
    keywords: [
      "padronização",
      "marca",
      "indicação de marca",
      "homologação prévia",
      "prova de conceito",
      "poc",
      "pré-qualificação",
      "similaridade",
      "equivalência técnica",
    ],
    distinguishingNote:
      "Na Lei 13.303/2016 (Art. 47), a padronização e indicação de marca admitem maior flexibilidade técnica justificada pela compatibilidade operacional do parque computacional de empresas estatais de TI em regime concorrencial.",
  },
  {
    id: "SB-02",
    topic: "Parcelamento vs. Lote Único / Solução Integrada de TI",
    art13303: "Art. 32, III; Art. 54, §1º",
    art14133: "Art. 40, V, 'b' e §§ 2º e 3º",
    sumulasTcu: ["Súmula TCU 247"],
    keywords: [
      "parcelamento",
      "lote único",
      "solução integrada",
      "indivisibilidade",
      "adjudicação por preço global",
      "interdependência",
      "responsabilidade única",
      "sla integrado",
    ],
    distinguishingNote:
      "A Súmula TCU 247 e a jurisprudência das estatais autorizam o lote único quando a divisão do objeto em múltiplos lotes comprometer a integridade sistêmica, a arquitetura de segurança ou a eficiência gerencial de SLA único.",
  },
  {
    id: "SB-03",
    topic: "Qualificação Técnica / Atestados e Parcelas de Maior Relevância",
    art13303: "Art. 58, II",
    art14133: "Art. 67, §§ 1º e 2º",
    sumulasTcu: ["Súmula TCU 263"],
    keywords: [
      "qualificação técnica",
      "capacidade técnico-operacional",
      "capacidade técnico-profissional",
      "parcelas de maior relevância",
      "atestados",
      "quantitativo mínimo",
      "habilitação técnica",
    ],
    distinguishingNote:
      "Na Lei 13.303/2016 (Art. 58), a habilitação técnica vincula-se estritamente às garantias indispensáveis ao cumprimento do contrato, vedando-se exigências desproporcionais ou não aderentes à complexidade da entrega.",
  },
  {
    id: "SB-04",
    topic: "Orçamento Estimado Sigiloso",
    art13303: "Art. 34 (Regra Geral Nativa)",
    art14133: "Art. 24 (Excepcional e Justificado)",
    sumulasTcu: [],
    keywords: [
      "orçamento sigiloso",
      "orçamento estimado",
      "sigilo do orçamento",
      "valor estimado",
      "preço máximo",
      "divulgação do orçamento",
    ],
    distinguishingNote:
      "Distinguishing estrutural: nas empresas estatais (Art. 34 da Lei 13.303/16), o caráter sigiloso do orçamento é a regra legal geral direta, dispensando a motivação de excepcionalidade exigida pelo Art. 24 da Lei 14.133/21.",
  },
  {
    id: "SB-05",
    topic: "Vigência Contratual Direta de até 5 Anos",
    art13303: "Art. 71 (Direta de até 5 anos)",
    art14133: "Art. 106 e Art. 107",
    sumulasTcu: [],
    keywords: [
      "vigência",
      "duração do contrato",
      "prazo contratual",
      "5 anos",
      "60 meses",
      "serviços contínuos",
      "prorrogação",
    ],
    distinguishingNote:
      "No regime das estatais (Art. 71 da Lei 13.303/16), os contratos podem ser celebrados diretamente por prazo de até 5 anos (60 meses) conforme praxe comercial e vantajosidade de mercado, independentemente de renovações anuais sucessivas.",
  },
  {
    id: "SB-06",
    topic: "Inexigibilidade / Fornecedor Exclusivo / Notória Especialização",
    art13303: "Art. 30, I e II",
    art14133: "Art. 74 e Art. 79",
    sumulasTcu: ["Súmula TCU 255"],
    keywords: [
      "inexigibilidade",
      "fornecedor exclusivo",
      "inviabilidade de competição",
      "notória especialização",
      "carta de exclusividade",
      "credenciamento",
    ],
    distinguishingNote:
      "A contratação direta por inexigibilidade em estatais fundamenta-se no Art. 30 da Lei 13.303/16, amparada pela Súmula TCU 255 na exigência de atestado idôneo de exclusividade ou inviabilidade de competição.",
  },
  {
    id: "SB-07",
    topic: "Inaplicabilidade de Licitação — Oportunidade de Negócio e Comercialização",
    art13303: "Art. 28, § 3º, I e II",
    art14133: "Sem equivalente na Administração Direta",
    sumulasTcu: [],
    keywords: [
      "oportunidade de negócio",
      "parceria estratégica",
      "comercialização",
      "inaplicabilidade de licitação",
      "regime concorrencial",
      "sociedade de propósito específico",
      "spe",
    ],
    distinguishingNote:
      "Instituto exclusivo das empresas estatais (Art. 28, § 3º da Lei 13.303/16): afasta o procedimento licitatório para a comercialização de serviços próprios ou parcerias vinculadas à oportunidade de negócio sob regime de mercado.",
  },
  {
    id: "SB-08",
    topic: "Matriz de Riscos e Equilíbrio Econômico-Financeiro",
    art13303: "Art. 42, X; Art. 69, X; Art. 81, VI e § 8º",
    art14133: "Art. 22 e Art. 103",
    sumulasTcu: [],
    keywords: [
      "matriz de riscos",
      "alocação de riscos",
      "reequilíbrio econômico-financeiro",
      "álea ordinária",
      "álea extraordinária",
      "compartilhamento de riscos",
    ],
    distinguishingNote:
      "Na Lei 13.303/16, a matriz de riscos é cláusula mandatória e vinculante: veda-se aditamento contratual fundamentado em eventos cujo risco tenha sido previamente alocado à parte contratada (Art. 81, § 8º).",
  },
  {
    id: "SB-09",
    topic: "Aditivos Contratuais (Acordo Bilateral vs. Unilateral)",
    art13303: "Art. 72 e Art. 81 (Sempre por acordo entre as partes)",
    art14133: "Art. 124, I e Art. 125",
    sumulasTcu: [],
    keywords: [
      "aditivo",
      "acréscimo",
      "supressão",
      "25%",
      "50%",
      "alteração contratual",
      "acordo bilateral",
    ],
    distinguishingNote:
      "Distinguishing das estatais: na Lei 13.303/16 inexiste prerrogativa de alteração unilateral mandatória da Administração. Todo aditamento quantitativo ou qualitativo decorre de acordo bilateral formal entre as partes (Art. 81).",
  },
  {
    id: "SB-10",
    topic: "Regime de Contratação de TI / Métrica de Software (UST, PF, Subscrição)",
    art13303: "Art. 31 e RILC",
    art14133: "Art. 6º, XXII; IN SGD/MGI",
    sumulasTcu: ["Súmula TCU 269"],
    keywords: [
      "ust",
      "ponto de função",
      "unidade de serviço técnico",
      "métrica de software",
      "subscrição",
      "homem-hora",
      "alocação de postos",
      "nível de serviço",
      "sla",
    ],
    distinguishingNote:
      "A Súmula TCU 269 veda expressamente o pagamento por mera disponibilização de profissionais de TI sem vinculação a resultados mensuráveis ou ordens de serviço formais, tanto na Lei 13.303/16 quanto na Lei 14.133/21.",
  },
];

/**
 * Verifica se o nome da entidade corresponde a uma empresa pública de TI ou estatal relevante.
 */
export function isStateItEntity(entityName?: string): boolean {
  if (!entityName) return false;
  const upper = entityName.toUpperCase();
  return STATE_IT_ENTITIES.some((itEntity) => upper.includes(itEntity));
}

/**
 * Localiza pontes normativas que tenham aderência aos termos de um texto ou query.
 */
export function findStatutoryBridgesForText(text: string): StatutoryBridgeMapping[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return STATUTORY_BRIDGES.filter((bridge) => {
    return bridge.keywords.some((kw) => lower.includes(kw.toLowerCase()));
  });
}

/**
 * Expande a query de busca com sinônimos e institutos da ponte normativa.
 */
export function expandQueryWithStatutoryBridge(
  query: string,
  regime: JurisLegalRegime = "BOTH"
): {
  expandedTerms: string[];
  appliedBridgeIds: string[];
  appliedBridgeDescriptions: string[];
} {
  const matches = findStatutoryBridgesForText(query);
  const terms = new Set<string>();
  const ids: string[] = [];
  const descriptions: string[] = [];

  for (const bridge of matches) {
    ids.push(bridge.id);
    descriptions.push(
      `${bridge.topic} (${bridge.art13303} <-> ${bridge.art14133}${
        bridge.sumulasTcu.length > 0 ? " + " + bridge.sumulasTcu.join(", ") : ""
      })`
    );

    if (regime === "13303" || regime === "BOTH") {
      terms.add("13.303");
      terms.add("Lei das Estatais");
      if (bridge.id === "SB-04") terms.add("Art. 34");
      if (bridge.id === "SB-05") terms.add("Art. 71");
      if (bridge.id === "SB-07") terms.add("Art. 28");
    }

    if (regime === "14133" || regime === "BOTH") {
      terms.add("14.133");
      terms.add("Nova Lei de Licitações");
    }

    for (const sumula of bridge.sumulasTcu) {
      terms.add(sumula);
    }
  }

  return {
    expandedTerms: Array.from(terms),
    appliedBridgeIds: ids,
    appliedBridgeDescriptions: descriptions,
  };
}

/**
 * Retorna a nota técnica de distinguishing para um instituto específico.
 */
export function getDistinguishingNote(bridgeId: string): string | null {
  const bridge = STATUTORY_BRIDGES.find((b) => b.id === bridgeId);
  return bridge?.distinguishingNote || null;
}
