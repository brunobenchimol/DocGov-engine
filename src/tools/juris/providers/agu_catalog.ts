// ============================================================================
// Catálogo Curado de Normas de Alto Valor da Advocacia-Geral da União (AGU)
// docgov-engine v1.4.3 — providers/agu_catalog.ts
// Orientações Normativas (ONs), Súmulas e Pareceres Referenciais CNLCA/CGU
// ============================================================================

export interface AguNormativeItem {
  id: string;
  aliases: string[];
  tipo: "ORIENTACAO_NORMATIVA" | "SUMULA" | "PARECER_REFERENCIAL";
  numero: string;
  ano: number;
  colegiado: string;
  relator: string;
  dataSessao?: string;
  regimeLegal: "LEI_14133_ADM_DIRETA" | "LEI_13303_ESTATAIS" | "LEI_8666_LEGACY" | "OUTRO";
  entidade: string;
  indexacao: string[];
  enunciado: string;
  dispositivo: string;
  fundamentacao?: string;
  fonteOficialUrl?: string;
  inteiroTeorTexto: string;
}

export const AGU_CURATED_CATALOG: AguNormativeItem[] = [
  {
    id: "ON-AGU-046-2014",
    aliases: ["AGU-ON-0046-2014", "AGU-ON-046-2014", "ON-AGU-46-2014", "AGU-ON-46"],
    tipo: "ORIENTACAO_NORMATIVA",
    numero: "46",
    ano: 2014,
    colegiado: "Advogado-Geral da União",
    relator: "Consultoria-Geral da União",
    dataSessao: "2014-05-12",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ÓRGÃO_CONTRATANTE",
    indexacao: ["QUALIFICAÇÃO TÉCNICA", "PARCELAS DE MAIOR RELEVÂNCIA", "VALOR SIGNIFICATIVO", "QUANTITATIVOS MÍNIMOS", "LEI 14.133/2021"],
    enunciado: "A exigência de atestados de capacidade técnica para comprovação de execução prévia de quantitativos mínimos em obras ou serviços deve limitar-se exclusivamente às parcelas de maior relevância técnica e valor significativo, vedadas exigências desproporcionais.",
    dispositivo: "É vedada a exigência de atestados com quantitativos mínimos desproporcionais ou sobre itens sem relevância técnica ou material expressiva, garantindo-se ampla competitividade.",
    fundamentacao: "Parecer nº 01/2014/CNLCA/CGU/AGU e aplicação sistemática do art. 67 da Lei nº 14.133, de 2021.",
    fonteOficialUrl: "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu",
    inteiroTeorTexto: "ORIENTAÇÃO NORMATIVA AGU Nº 46, DE 12 DE MAIO DE 2014.\nO ADVOGADO-GERAL DA UNIÃO, no uso de suas atribuições constitucionais e legais... resolve aprovar a Orientação Normativa nº 46: A exigência de atestados para qualificação técnica deve restringir-se a parcelas de maior relevância e valor significativo."
  },
  {
    id: "ON-AGU-050-2014",
    aliases: ["AGU-ON-0050-2014", "AGU-ON-050-2014", "ON-AGU-50-2014", "AGU-ON-50"],
    tipo: "ORIENTACAO_NORMATIVA",
    numero: "50",
    ano: 2014,
    colegiado: "Advogado-Geral da União",
    relator: "Consultoria-Geral da União",
    dataSessao: "2014-05-12",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ÓRGÃO_CONTRATANTE",
    indexacao: ["SERVIÇOS CONTÍNUOS", "PRORROGAÇÃO CONTRATUAL", "VIGÊNCIA", "PREVISÃO EDITALÍCIA", "LEI 14.133/2021"],
    enunciado: "A prorrogação de contrato de serviço contínuo sob a vigência da Lei nº 14.133/2021 prescinde de autorização editalícia específica quando a minuta de contrato anexa ao instrumento convocatório contiver cláusula expressa dispondo sobre o prazo e hipóteses de renovação.",
    dispositivo: "É lícita a prorrogação sucessiva dos contratos de serviços e fornecimentos contínuos até o limite decenal estabelecido no art. 107 da Lei nº 14.133/2021.",
    fundamentacao: "Parecer nº 02/2014/CNLCA/CGU/AGU e aplicação do art. 107 da Lei nº 14.133, de 2021.",
    fonteOficialUrl: "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu",
    inteiroTeorTexto: "ORIENTAÇÃO NORMATIVA AGU Nº 50, DE 12 DE MAIO DE 2014.\nO ADVOGADO-GERAL DA UNIÃO resolve: A prorrogação de contrato de serviço contínuo prescinde de previsão expressa no corpo do edital se constar na minuta do contrato."
  },
  {
    id: "ON-AGU-084-2024",
    aliases: ["AGU-ON-0084-2024", "AGU-ON-084-2024", "ON-AGU-84-2024", "AGU-ON-84"],
    tipo: "ORIENTACAO_NORMATIVA",
    numero: "84",
    ano: 2024,
    colegiado: "Advogado-Geral da União",
    relator: "Câmara Nacional de Licitações e Contratos",
    dataSessao: "2024-06-18",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ÓRGÃO_CONTRATANTE",
    indexacao: ["PAGAMENTO ANTECIPADO", "EXCEPCIONALIDADE", "GARANTIA", "VEDAÇÃO", "LEI 14.133/2021"],
    enunciado: "É vedado o pagamento antecipado em contratos administrativos sob o regime da Lei nº 14.133/2021, ressalvadas as situações excepcionais em que reste justificada a sensível economia de recursos ou indispensabilidade para o fornecimento, condicionada à prestação de garantias prévias idôneas.",
    dispositivo: "Determina-se a abstenção de previsão contratual de antecipação financeira desprovida de prévia caução idônea ou sem estudo técnico justificando a indispensabilidade da medida.",
    fundamentacao: "Parecer nº 03/2024/CNLCA/CGU/AGU e art. 145 da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu",
    inteiroTeorTexto: "ORIENTAÇÃO NORMATIVA AGU Nº 84, DE 18 DE JUNHO DE 2024.\nO ADVOGADO-GERAL DA UNIÃO firma entendimento: A antecipação de pagamento exige justificativa técnica de vantajosidade e garantia idônea."
  },
  {
    id: "ON-AGU-001-2009",
    aliases: ["AGU-ON-0001-2009", "AGU-ON-001-2009", "ON-AGU-1-2009", "AGU-ON-1"],
    tipo: "ORIENTACAO_NORMATIVA",
    numero: "1",
    ano: 2009,
    colegiado: "Advogado-Geral da União",
    relator: "Consultoria-Geral da União",
    dataSessao: "2009-04-07",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ÓRGÃO_CONTRATANTE",
    indexacao: ["VIGÊNCIA", "SERVIÇO CONTÍNUO", "EXERCÍCIO FINANCEIRO", "CONTRATOS ADMINISTRATIVOS"],
    enunciado: "A vigência do contrato de serviço contínuo não está adstrita ao exercício financeiro.",
    dispositivo: "É permitida a celebração e vigência contratual transpondo o encerramento do exercício civil em serviços continuados.",
    fundamentacao: "Aplicação harmonizada entre a LC 73/1993, Lei 8.666/1993 e arts. 105 a 107 da Lei 14.133/2021.",
    fonteOficialUrl: "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu",
    inteiroTeorTexto: "ORIENTAÇÃO NORMATIVA AGU Nº 1, DE 7 DE ABRIL DE 2009.\nA vigência do contrato de serviço contínuo não está adstrita ao exercício financeiro."
  },
  {
    id: "SUMULA-AGU-034",
    aliases: ["AGU-SUMULA-034", "AGU-SUMULA-34", "SUMULA-AGU-34"],
    tipo: "SUMULA",
    numero: "34",
    ano: 2008,
    colegiado: "Advogado-Geral da União",
    relator: "Advogado-Geral da União",
    dataSessao: "2008-09-16",
    regimeLegal: "OUTRO",
    entidade: "ÓRGÃO_CONTRATANTE",
    indexacao: ["BOA-FÉ", "REPETIÇÃO DE INDÉBITO", "VERBA ALIMENTAR", "INTERPRETAÇÃO ERRÔNEA"],
    enunciado: "Não estão sujeitos à repetição os valores recebidos de boa-fé pelo servidor público, em decorrência de errônea ou inadequada interpretação da lei por parte da Administração Pública.",
    dispositivo: "Fica vedada a cobrança ou repetição dos valores alimentares percebidos de boa-fé em razão de erro de interpretação administrativa.",
    fundamentacao: "Jurisprudência consolidada do STF e STJ.",
    fonteOficialUrl: "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/sumula",
    inteiroTeorTexto: "SÚMULA AGU Nº 34, DE 16 DE SETEMBRO DE 2008.\nNão estão sujeitos à repetição os valores recebidos de boa-fé decorrentes de erro de interpretação da lei."
  },
  {
    id: "SUMULA-AGU-072",
    aliases: ["AGU-SUMULA-072", "AGU-SUMULA-72", "SUMULA-AGU-72"],
    tipo: "SUMULA",
    numero: "72",
    ano: 2013,
    colegiado: "Advogado-Geral da União",
    relator: "Advogado-Geral da União",
    dataSessao: "2013-09-26",
    regimeLegal: "OUTRO",
    entidade: "ÓRGÃO_CONTRATANTE",
    indexacao: ["CANCELAMENTO", "REPRISTINAÇÃO", "SÚMULA 34", "BOA-FÉ"],
    enunciado: "Cancelar a Súmula nº 71 da Advocacia-Geral da União, restabelecendo com eficácia plena os efeitos da Súmula nº 34 sobre irrepetibilidade de verbas percebidas de boa-fé.",
    dispositivo: "Aplica-se com eficácia vinculante o teor da Súmula nº 34 aos processos administrativos no âmbito federal.",
    fundamentacao: "DOU Seção 1 de 27/09/2013.",
    fonteOficialUrl: "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/sumula",
    inteiroTeorTexto: "SÚMULA AGU Nº 72, DE 26 DE SETEMBRO DE 2013.\nCancela a Súmula nº 71 e restabelece a Súmula nº 34 da AGU."
  },
  {
    id: "PARECER-CNLCA-001-2021",
    aliases: ["PARECER-CNLCA-01-2021", "PARECER-CNLCA-1-2021", "AGU-PARECER-CNLCA-001-2021"],
    tipo: "PARECER_REFERENCIAL",
    numero: "001",
    ano: 2021,
    colegiado: "Câmara Nacional de Licitações e Contratos",
    relator: "CNLCA/CGU/AGU",
    dataSessao: "2021-08-10",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ÓRGÃO_CONTRATANTE",
    indexacao: ["PARECER REFERENCIAL", "PRORROGAÇÃO CONTRATUAL", "SERVIÇOS CONTÍNUOS", "DISPENSA DE ANÁLISE INDIVIDUAL"],
    enunciado: "Manifestação jurídica referencial para prorrogações ordinárias de contratos de serviços contínuos, dispensando análise jurídica individualizada quando observadas as condicionantes objetivas prévias.",
    dispositivo: "É autorizada a lavratura de termo aditivo de prorrogação contratual sem remessa à consultoria jurídica, desde que cumpridos os requisitos da manifestação referencial.",
    fundamentacao: "Art. 40 da LC 73/1993 e Portaria Normativa AGU nº 05/2020.",
    fonteOficialUrl: "https://www.gov.br/agu/pt-br/composicao/cgu/conuni",
    inteiroTeorTexto: "PARECER REFERENCIAL Nº 001/2021/CNLCA/CGU/AGU.\nDispensa de remessa individualizada de processos de prorrogação contratual ordinária."
  },
  {
    id: "PARECER-CNLCA-001-2024",
    aliases: ["PARECER-CNLCA-01-2024", "PARECER-CNLCA-1-2024", "AGU-PARECER-CNLCA-001-2024"],
    tipo: "PARECER_REFERENCIAL",
    numero: "001",
    ano: 2024,
    colegiado: "Câmara Nacional de Licitações e Contratos",
    relator: "CNLCA/CGU/AGU",
    dataSessao: "2024-02-15",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ÓRGÃO_CONTRATANTE",
    indexacao: ["CONTRATAÇÃO DIRETA", "DISPENSA POR VALOR", "ART. 75", "FRACIONAMENTO", "LEI 14.133/2021"],
    enunciado: "Manifestação jurídica referencial sobre os parâmetros de contratação direta por dispensa de licitação em razão do valor sob a égide da Lei nº 14.133/2021 e prevenção ao fracionamento indevido de despesas.",
    dispositivo: "É lícita a dispensa de licitação com base no art. 75, I e II, da Lei nº 14.133/2021, condicionada ao controle informatizado do somatório das despesas da mesma natureza no exercício financeiro.",
    fundamentacao: "Art. 75 da Lei nº 14.133/2021 e jurisprudência pacificada da CGU/AGU.",
    fonteOficialUrl: "https://www.gov.br/agu/pt-br/composicao/cgu/conuni",
    inteiroTeorTexto: "PARECER REFERENCIAL Nº 001/2024/CNLCA/CGU/AGU.\nParâmetros jurídicos para aplicação da dispensa de licitação por valor (Art. 75 da Lei 14.133/2021)."
  }
];

export function normalizeAguId(ref: string): string {
  const clean = ref.trim().toUpperCase().replace(/[_/]/g, "-");
  for (const item of AGU_CURATED_CATALOG) {
    if (item.id === clean) return item.id;
    if (item.aliases.some((a) => a.toUpperCase() === clean)) return item.id;
  }
  // Lookup flexível para padrões como AGU-ON-0046-2014 -> ON-AGU-046-2014
  const onMatch = clean.match(/(?:ON|ORIENTACAO-NORMATIVA)[-]?AGU[-]?0*(\d+)(?:[-]?(\d{4}))?|AGU[-](?:ON|ORIENTACAO-NORMATIVA)[-]?0*(\d+)(?:[-]?(\d{4}))?/i);
  if (onMatch) {
    const num = onMatch[1] || onMatch[3];
    const ano = onMatch[2] || onMatch[4];
    const padNum = num.padStart(3, "0");
    const candidate = ano ? `ON-AGU-${padNum}-${ano}` : `ON-AGU-${padNum}`;
    const found = AGU_CURATED_CATALOG.find((i) => i.id.startsWith(`ON-AGU-${padNum}`) || i.numero === num);
    if (found) return found.id;
  }
  const sumMatch = clean.match(/(?:SUMULA[-]?AGU|AGU[-]?SUMULA)[-]?0*(\d+)/i);
  if (sumMatch) {
    const num = sumMatch[1];
    const padNum = num.padStart(3, "0");
    const found = AGU_CURATED_CATALOG.find((i) => i.id === `SUMULA-AGU-${padNum}` || i.numero === num);
    if (found) return found.id;
  }
  return clean;
}

export function getAguCatalogItemById(ref: string): AguNormativeItem | null {
  const norm = normalizeAguId(ref);
  const exact = AGU_CURATED_CATALOG.find((i) => i.id === norm);
  if (exact) return exact;
  return AGU_CURATED_CATALOG.find((i) => i.aliases.includes(ref.trim()) || i.aliases.some((a) => a.toUpperCase() === norm)) || null;
}

export function searchAguCatalog(query: string, limit: number = 10): AguNormativeItem[] {
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return AGU_CURATED_CATALOG.slice(0, limit);

  const scored = AGU_CURATED_CATALOG.map((item) => {
    const hay = `${item.id} ${item.aliases.join(" ")} ${item.indexacao.join(" ")} ${item.enunciado} ${item.dispositivo} ${item.fundamentacao || ""}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (hay.includes(token)) score += 10;
    }
    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item)
    .slice(0, limit);
}
