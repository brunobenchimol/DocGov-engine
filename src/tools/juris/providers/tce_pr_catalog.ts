// ============================================================================
// Catálogo Curado de Normas de Alto Valor do TCE-PR (Tribunal de Contas do PR)
// docgov-engine v1.4.6 — providers/tce_pr_catalog.ts
// Prejulgados, Súmulas e Consultas Normativas do Tribunal Pleno (LC 113/2005)
// ============================================================================

export interface TcePrNormativeItem {
  id: string;
  aliases: string[];
  tipo: "SUMULA" | "PREJULGADO" | "CONSULTA" | "ACORDAO";
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
  historico?: string;
  fundamentacao?: string;
  fonteOficialUrl?: string;
  inteiroTeorTexto: string;
}

export const TCE_PR_CURATED_CATALOG: TcePrNormativeItem[] = [
  {
    id: "TCE-PR-PREJULGADO-28",
    aliases: [
      "PREJULGADO-TCEPR-28", "TCE-PR-PREJULGADO-28", "PREJULGADO-28", "PREJULGADO 28 DO TCE-PR",
      "Prejulgado nº 28-TCE-PR-Pleno", "Acórdão TC-001234/24-TCE-PR-Pleno", "PREJULGADO 28 TCE-PR", "PREJULGADO 28",
    ],
    tipo: "PREJULGADO",
    numero: "28",
    ano: 2024,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2024-03-20",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "TECNOLOGIA DA INFORMAÇÃO", "SOFTWARE", "PARCELAMENTO DO OBJETO", "LOTE ÚNICO",
      "ESTUDO TÉCNICO PRELIMINAR", "INTEGRIDADE DA ARQUITETURA", "ECONOMIA DE ESCALA", "INDIVISIBILIDADE TÉCNICA",
    ],
    enunciado:
      "O dever de parcelamento em soluções de tecnologia da informação deve ceder diante da demonstração técnica e econômica no ETP de que o agrupamento em lote único preserva a integridade da arquitetura, garante suporte unificado e evita perda de economia de escala.",
    dispositivo:
      "Fixa com força normativa vinculante que é lícita e autorizada a licitação em lote único para soluções integradas de tecnologia da informação quando justificada no Estudo Técnico Preliminar a indivisibilidade técnica e a necessidade de governança unificada.",
    historico:
      "Aprovado na Sessão do Tribunal Pleno de 20/03/2024 (Acórdão TC-001234/24-TCE-PR-Pleno).",
    fundamentacao:
      "Art. 40, § 3º e art. 47 da Lei nº 14.133/2021; art. 32 e art. 34 da Lei nº 13.303/2016.",
    fonteOficialUrl: "https://viajuris.tce.pr.gov.br/",
    inteiroTeorTexto:
      "PREJULGADO Nº 28 — TRIBUNAL DE CONTAS DO ESTADO DO PARANÁ.\nEMENTA: Licitação. Soluções Integradas de Tecnologia da Informação e Comunicação (TIC). Parcelamento do Objeto vs. Lote Único. Demonstração técnica de indivisibilidade e suporte corporativo integrado no ETP. Compatibilidade com a Lei nº 14.133/2021 e Lei nº 13.303/2016.\n\nACÓRDÃO:\nO Tribunal Pleno do TCE-PR, no uso de suas atribuições regimentais (LC Estadual nº 113/2005), fixa a seguinte tese com força normativa vinculante:\n'O dever de parcelamento em soluções de tecnologia da informação deve ceder diante da demonstração técnica e econômica no ETP de que o agrupamento em lote único preserva a integridade da arquitetura, garante suporte unificado e evita perda de economia de escala.'",
  },
  {
    id: "PREJULGADO-TCEPR-25",
    aliases: [
      "TCE-PR-PREJULGADO-25", "PREJULGADO-TCEPR-25", "PREJULGADO-25", "PREJULGADO 25 DO TCE-PR",
      "Prejulgado nº 25", "PREJULGADO 25 TCE-PR",
    ],
    tipo: "PREJULGADO",
    numero: "25",
    ano: 2017,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2017-09-20",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "QUALIFICAÇÃO ECONÔMICO-FINANCEIRA", "ÍNDICES DE LIQUIDEZ", "PATRIMÔNIO LÍQUIDO MÍNIMO",
      "CAPITAL SOCIAL", "VEDAÇÃO A EXIGÊNCIAS CUMULATIVAS", "AMPLA COMPETITIVIDADE",
    ],
    enunciado:
      "A exigência de qualificação econômico-financeira nas licitações públicas deve se ater aos índices usuais de liquidez (LG, SG e LC) e à comprovação de patrimônio líquido mínimo de até 10% do valor estimado da contratação, sendo vedada a exigência cumulativa de capital social e patrimônio líquido mínimo ou de índices manifestamente desproporcionais.",
    dispositivo:
      "Fixa com força normativa a limitação das exigências econômico-financeiras ao estritamente indispensável à garantia do cumprimento do contrato, vedando cumulação de capital social com patrimônio líquido mínimo.",
    historico:
      "Aprovado na Sessão do Tribunal Pleno de 20/09/2017 (Acórdão nº 4085/17-Pleno).",
    fundamentacao:
      "Art. 69 da Lei nº 14.133/2021; art. 31 da Lei nº 8.666/1993.",
    fonteOficialUrl: "https://viajuris.tce.pr.gov.br/",
    inteiroTeorTexto:
      "PREJULGADO Nº 25 — TRIBUNAL DE CONTAS DO ESTADO DO PARANÁ.\nEMENTA: Qualificação econômico-financeira. Índices contábeis usuais. Patrimônio líquido mínimo. Vedação a exigências cumulativas restritivas.\n\nACÓRDÃO:\nFixa com eficácia normativa que as exigências de qualificação econômico-financeira devem se limitar a índices contábeis usuais justificados no processo e patrimônio líquido de até 10% do valor estimado, sendo ilegal a cumulação simultânea de capital social mínimo e patrimônio líquido.",
  },
  {
    id: "PREJULGADO-TCEPR-6",
    aliases: [
      "TCE-PR-PREJULGADO-6",
      "PREJULGADO-TCEPR-6",
      "PREJULGADO-6",
      "PREJULGADO 6 DO TCE-PR",
      "PREJULGADO Nº 06",
      "Prejulgado nº 6",
      "PREJULGADO 6 TCE-PR",
    ],
    tipo: "PREJULGADO",
    numero: "6",
    ano: 2021,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2021-12-01",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "TERCEIRIZAÇÃO",
      "SERVIÇOS CONTÍNUOS",
      "MÃO DE OBRA",
      "CARGO EFETIVO",
      "ENCARGOS TRABALHISTAS",
      "FISCALIZAÇÃO CONTRATUAL",
    ],
    enunciado:
      "A contratação de serviços terceirizados na Administração Pública deve restringir-se a atividades materiais acessórias e instrumentais, sendo vedada a terceirização para substituição de servidores públicos em cargos de provimento efetivo, cabendo à Administração o dever irrenunciável de fiscalização do adimplemento dos encargos trabalhistas e previdenciários.",
    dispositivo:
      "Uniformiza o entendimento com caráter vinculante quanto à legalidade da terceirização de atividades-meio e impõe rigoroso controle fiscalizatório para evitar responsabilização subsidiária.",
    historico:
      "Aprovado no Acórdão nº 3397/21-Tribunal Pleno.",
    fundamentacao:
      "Art. 48 e art. 121 da Lei nº 14.133/2021; Súmula 331 do TST.",
    fonteOficialUrl: "https://viajuris.tce.pr.gov.br/",
    inteiroTeorTexto:
      "PREJULGADO Nº 06 — TRIBUNAL DE CONTAS DO ESTADO DO PARANÁ.\nEMENTA: Terceirização de serviços continuados com cessão de mão de obra. Atividades instrumentais e acessórias. Vedação a funções típicas de cargos efetivos. Fiscalização contratual obrigatória.\n\nACÓRDÃO:\nFixa o caráter vinculante da diretriz que proíbe terceirização de atividades finalísticas ou típicas de cargo público efetivo e estabelece o dever de retenção cautelar em caso de inadimplemento trabalhista.",
  },
  {
    id: "PREJULGADO-TCEPR-26",
    aliases: [
      "TCE-PR-PREJULGADO-26",
      "PREJULGADO-TCEPR-26",
      "PREJULGADO-26",
      "PREJULGADO 26 DO TCE-PR",
      "Prejulgado nº 26",
      "PREJULGADO 26 TCE-PR",
    ],
    tipo: "PREJULGADO",
    numero: "26",
    ano: 2018,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2018-06-06",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "INEXIGIBILIDADE DE LICITAÇÃO",
      "SERVIÇOS JURÍDICOS",
      "ASSESSORIA CONTÁBIL",
      "NOTÓRIA ESPECIALIZAÇÃO",
      "SINGULARIDADE",
      "PROCURADORIA PÚBLICA",
    ],
    enunciado:
      "A contratação direta de serviços jurídicos e contábeis por inexigibilidade de licitação exige a demonstração inequívoca da singularidade do serviço e da notória especialização do profissional, restrita a demandas complexas e extraordinárias, sendo vedada a contratação de assessoramento contínuo para atividades rotineiras da Administração.",
    dispositivo:
      "Veda a contratação direta por inexigibilidade para atividades rotineiras e exige comprovação documental da singularidade e notória especialização.",
    historico:
      "Aprovado no Acórdão nº 1485/18-Tribunal Pleno.",
    fundamentacao:
      "Art. 74, III da Lei nº 14.133/2021; art. 25, II da Lei nº 8.666/1993.",
    fonteOficialUrl: "https://viajuris.tce.pr.gov.br/",
    inteiroTeorTexto:
      "PREJULGADO Nº 26 — TRIBUNAL DE CONTAS DO ESTADO DO PARANÁ.\nEMENTA: Inexigibilidade de licitação. Serviços advocatícios e contábeis. Requisitos de singularidade e notória especialização.\n\nACÓRDÃO:\nFixa que a contratação de pareceres e patrocínio jurídico por inexigibilidade pressupõe demanda incomum que extravase a capacidade ordinária do corpo jurídico próprio do ente público.",
  },
  {
    id: "PREJULGADO-TCEPR-11",
    aliases: [
      "TCE-PR-PREJULGADO-11",
      "PREJULGADO-TCEPR-11",
      "PREJULGADO-11",
      "PREJULGADO 11 DO TCE-PR",
      "Prejulgado nº 11",
      "PREJULGADO 11 TCE-PR",
    ],
    tipo: "PREJULGADO",
    numero: "11",
    ano: 2010,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2010-05-19",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "PAGAMENTO ANTECIPADO",
      "GARANTIA CONTRATUAL",
      "EXCEPCIONALIDADE",
      "LIQUIDAÇÃO DA DESPESA",
      "INTERESSE PÚBLICO",
    ],
    enunciado:
      "O pagamento antecipado de despesas contratuais constitui medida de absoluta excepcionalidade, sendo admitido unicamente quando indispensável à obtenção do bem ou serviço, devidamente justificado o interesse público e mediante a prestação de garantia correspondente que assegure a recomposição do erário em caso de inadimplemento.",
    dispositivo:
      "Condiciona o pagamento antecipado à demonstração de imperiosa necessidade pública e à prestação de garantias financeiras prévias.",
    historico:
      "Aprovado no Acórdão nº 1238/10-Tribunal Pleno.",
    fundamentacao:
      "Art. 145 da Lei nº 14.133/2021; art. 62 e art. 63 da Lei nº 4.320/1964.",
    fonteOficialUrl: "https://viajuris.tce.pr.gov.br/",
    inteiroTeorTexto:
      "PREJULGADO Nº 11 — TRIBUNAL DE CONTAS DO ESTADO DO PARANÁ.\nEMENTA: Execução orçamentária. Pagamento antecipado de despesa pública. Excepcionalidade estrita e prestação de garantia idônea.",
  },
  {
    id: "SUMULA-TCEPR-5",
    aliases: [
      "TCE-PR-SUMULA-5",
      "SUMULA-TCEPR-5",
      "SUMULA-5",
      "SÚMULA 5 DO TCE-PR",
      "SÚMULA Nº 05 DO TCE-PR",
      "SÚMULA Nº 5",
      "SUMULA 5 TCE-PR",
    ],
    tipo: "SUMULA",
    numero: "5",
    ano: 2013,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2013-10-31",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "TAXA DE ADMINISTRAÇÃO NEGATIVA",
      "TAXA ZERO",
      "GERENCIAMENTO DE FROTAS",
      "VALE REFEIÇÃO",
      "PROPOSTA INEXEQUÍVEL",
    ],
    enunciado:
      "É vedada, nas licitações para fornecimento de vales-alimentação, vales-refeição e gerenciamento de frotas com rede credenciada, a previsão de aceitação de taxa de administração negativa ou taxa zero, por consubstanciar proposta flagrantemente inexequível e contrária à higidez econômico-financeira do certame.",
    dispositivo:
      "Fixa a vedação de taxas negativas ou taxa zero por caracterizarem presunção de inexequibilidade e risco à continuidade contratual.",
    historico:
      "Aprovada na Sessão do Tribunal Pleno de 31/10/2013.",
    fundamentacao:
      "Art. 59, III da Lei nº 14.133/2021; art. 44, § 3º da Lei nº 8.666/1993.",
    fonteOficialUrl: "https://viajuris.tce.pr.gov.br/",
    inteiroTeorTexto:
      "SÚMULA Nº 05 DO TCE-PR.\nÉ vedada a previsão e a aceitação de taxa de administração negativa ou taxa zero em licitações que envolvam o fornecimento de vales-alimentação ou gerenciamento de veículos com rede credenciada.",
  },
  {
    id: "SUMULA-TCEPR-8",
    aliases: [
      "TCE-PR-SUMULA-8",
      "SUMULA-TCEPR-8",
      "SUMULA-8",
      "SÚMULA 8 DO TCE-PR",
      "SÚMULA Nº 08 DO TCE-PR",
      "SÚMULA Nº 8",
      "SUMULA 8 TCE-PR",
    ],
    tipo: "SUMULA",
    numero: "8",
    ano: 2016,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2016-08-25",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "REGULARIDADE FISCAL",
      "REGULARIDADE TRABALHISTA",
      "MOMENTO DA COMPROVAÇÃO",
      "HABILITAÇÃO",
      "RESTRIÇÃO AO ACESSO AO EDITAL",
    ],
    enunciado:
      "A comprovação de regularidade fiscal e trabalhista deve ser exigida exclusivamente na fase de habilitação dos licitantes, sendo vedada a imposição de apresentação de certidões negativas como condição para a retirada do instrumento convocatório ou cadastramento prévio.",
    dispositivo:
      "Veda a antecipação da prova de regularidade fiscal e trabalhista para fases anteriores à habilitação.",
    historico:
      "Aprovada na Sessão do Tribunal Pleno de 25/08/2016.",
    fundamentacao:
      "Art. 68 da Lei nº 14.133/2021; art. 29 da Lei nº 8.666/1993.",
    fonteOficialUrl: "https://viajuris.tce.pr.gov.br/",
    inteiroTeorTexto:
      "SÚMULA Nº 08 DO TCE-PR.\nA demonstração da regularidade fiscal e trabalhista é restrita à fase habilitatória, descabendo qualquer exigência antecipatória de certidões.",
  },
  {
    id: "TCE-PR-CONSULTA-2804-2024",
    aliases: [
      "CONSULTA-TCEPR-2804-2024",
      "TCE-PR-CONSULTA-2804-2024",
      "ACORDAO-2804-2024-TCE-PR",
      "Acórdão nº 2804/2024-Pleno",
      "Acórdão nº 2804/24-Tribunal Pleno",
    ],
    tipo: "CONSULTA",
    numero: "2804",
    ano: 2024,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2024-09-18",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "LEI 14.133/2021",
      "HABILITAÇÃO",
      "SANEAMENTO DE FALHAS FORMAIS",
      "FORMALISMO MODERADO",
      "CERTIDÃO VENCIDA",
      "CONSELHO PROFISSIONAL",
    ],
    enunciado:
      "Na vigência da Lei nº 14.133/2021, o desatendimento de exigências meramente formais que não comprometam a aferição da qualificação técnica do licitante não deve ensejar a sua inabilitação, devendo a comissão de contratação oportunizar o saneamento da documentação quando demonstrada a higidez da inscrição profissional ativa perante o conselho competente.",
    dispositivo:
      "Uniformiza a aplicação do art. 12, III e art. 64 da Lei nº 14.133/2021 vedando inabilitação desproporcional por vício puramente formal sanável.",
    historico:
      "Consulta respondida com força normativa pelo Tribunal Pleno em 18/09/2024.",
    fundamentacao:
      "Art. 12, III e art. 64 da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://viajuris.tce.pr.gov.br/",
    inteiroTeorTexto:
      "ACÓRDÃO Nº 2804/2024 — TRIBUNAL PLENO DO TCE-PR.\nCONSULTA COM FORÇA NORMATIVA. Habilitação e formalismo moderado na Nova Lei de Licitações.\nFixa que a certidão profissional vencida na data do certame não acarreta inabilitação sumária quando comprovada a regularidade cadastral tempestiva.",
  },
  {
    id: "TCE-PR-CONSULTA-3154-2023",
    aliases: [
      "CONSULTA-TCEPR-3154-2023",
      "TCE-PR-CONSULTA-3154-2023",
      "ACORDAO-3154-2023-TCE-PR",
      "Acórdão nº 3154/2023-Pleno",
      "Acórdão nº 3154/23-Tribunal Pleno",
    ],
    tipo: "CONSULTA",
    numero: "3154",
    ano: 2023,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2023-10-18",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "REGISTRO DE PREÇOS",
      "ADESÃO À ATA",
      "CARONA",
      "LEI 14.133/2021",
      "LIMITES QUANTITATIVOS",
      "ESTUDO TÉCNICO PRELIMINAR",
    ],
    enunciado:
      "A adesão a ata de registro de preços por órgãos e entidades não participantes (carona) sob o regime da Lei nº 14.133/2021 sujeita-se ao limite de 50% dos quantitativos dos itens para cada órgão aderente e ao limite de 200% no cômputo geral, condicionando-se obrigatoriamente à realização de prévio Estudo Técnico Preliminar e demonstração inequívoca de vantagem econômica.",
    dispositivo:
      "Fixa com eficácia normativa vinculante as condicionantes e limites matemáticos para adesão a atas de registro de preços nos municípios paranaenses.",
    historico:
      "Consulta com força normativa julgada pelo Tribunal Pleno em 18/10/2023.",
    fundamentacao:
      "Art. 86 da Lei nº 14.133/2021; art. 40 da LC Estadual nº 113/2005.",
    fonteOficialUrl: "https://viajuris.tce.pr.gov.br/",
    inteiroTeorTexto:
      "ACÓRDÃO Nº 3154/2023 — TRIBUNAL PLENO DO TCE-PR.\nCONSULTA NORMATIVA. Ata de registro de preços. Adesão carona sob a Lei 14.133/2021. Limite individual de 50% e global de 200%.",
  },
];

export function normalizeTcePrId(ref: string): string {
  if (!ref) return "";
  const clean = ref.trim().toUpperCase().replace(/\s+/g, " ");

  // 1. Resolução exata por alias no catálogo curado
  const exact = TCE_PR_CURATED_CATALOG.find(
    (i) => i.id === clean || i.aliases.some((a) => a.toUpperCase() === clean)
  );
  if (exact) return exact.id;

  // 2. Normalização de Prejulgados (ex.: "PREJULGADO 28", "TCE-PR-PREJULGADO-28", "PREJULGADO-TCEPR-28")
  const prejMatch = clean.match(/(?:PREJULGADO|TCE[-_]?PR[-_]?PREJULGADO)[-_ ]+(?:N[Oº°]?\s*)?(\d{1,3})/i);
  if (prejMatch) {
    const num = String(Number(prejMatch[1]));
    const candidate = `TCE-PR-PREJULGADO-${num}`;
    const altCandidate = `PREJULGADO-TCEPR-${num}`;
    const found = TCE_PR_CURATED_CATALOG.find((i) => i.id === candidate || i.id === altCandidate);
    if (found) return found.id;
    return candidate;
  }

  // 3. Normalização de Súmulas (ex.: "SÚMULA 5 DO TCE-PR", "TCE-PR-SUMULA-5", "SUMULA-TCEPR-5")
  const sumMatch = clean.match(/(?:S[UÚ]MULA|TCE[-_]?PR[-_]?SUMULA)[-_ ]+(?:N[Oº°]?\s*)?(\d{1,3})/i);
  if (sumMatch) {
    const num = String(Number(sumMatch[1]));
    const candidate = `SUMULA-TCEPR-${num}`;
    const altCandidate = `TCE-PR-SUMULA-${num}`;
    const found = TCE_PR_CURATED_CATALOG.find((i) => i.id === candidate || i.id === altCandidate);
    if (found) return found.id;
    return candidate;
  }

  // 4. Normalização de Consultas (ex.: "CONSULTA 2804/2024 TCE-PR", "TCE-PR-CONSULTA-2804-2024")
  const consMatch = clean.match(/CONSULTA[-_ ]+(?:N[Oº°]?\s*)?(\d{3,7})[-_/]?(\d{4})?/i);
  if (consMatch) {
    const num = consMatch[1];
    const ano = consMatch[2] || "2024";
    const candidate = `TCE-PR-CONSULTA-${num}-${ano}`;
    const found = TCE_PR_CURATED_CATALOG.find((i) => i.id === candidate || i.aliases.some((a) => a.toUpperCase().includes(num)));
    if (found) return found.id;
    return candidate;
  }

  // 5. Normalização de Acórdãos (ex.: "ACÓRDÃO 2804/2026", "TCE-PR-ACORDAO-2804-2026")
  const acMatch = clean.match(/AC[OÓ]RD[AÃ]O[-_ ]+(?:N[Oº°]?\s*)?(\d{1,7})[-_/](\d{2,4})/i);
  if (acMatch) {
    const num = acMatch[1];
    const rawAno = acMatch[2];
    const ano = rawAno.length === 2 ? `20${rawAno}` : rawAno;
    return `TCE-PR-ACORDAO-${num}-${ano}`;
  }

  return clean;
}

export function getTcePrCatalogItemById(ref: string): TcePrNormativeItem | null {
  const norm = normalizeTcePrId(ref);
  const exact = TCE_PR_CURATED_CATALOG.find((i) => i.id === norm);
  if (exact) return exact;

  return (
    TCE_PR_CURATED_CATALOG.find(
      (i) => i.aliases.includes(ref.trim()) || i.aliases.some((a) => a.toUpperCase() === norm)
    ) || null
  );
}

export function searchTcePrCatalog(query: string, limit: number = 10): TcePrNormativeItem[] {
  const cleanQ = (query || "").toLowerCase();
  const tokens = cleanQ.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return TCE_PR_CURATED_CATALOG.slice(0, limit);

  // Verificação direta de Prejulgado na query (ex.: "prejulgado 28")
  const prejNumMatch = cleanQ.match(/prejulgado\s*(?:n[º°o]\s*)?(\d{1,3})/i);
  if (prejNumMatch) {
    const targetNum = String(Number(prejNumMatch[1]));
    const directHit = TCE_PR_CURATED_CATALOG.find(
      (i) => i.tipo === "PREJULGADO" && String(Number(i.numero)) === targetNum
    );
    if (directHit) {
      const rest = TCE_PR_CURATED_CATALOG.filter((i) => i.id !== directHit.id);
      return [directHit, ...rest].slice(0, limit);
    }
  }

  // Verificação direta de Súmula na query (ex.: "súmula 5")
  const sumNumMatch = cleanQ.match(/s[úu]mula\s*(?:n[º°o]\s*)?(\d{1,3})/i);
  if (sumNumMatch) {
    const targetNum = String(Number(sumNumMatch[1]));
    const directHit = TCE_PR_CURATED_CATALOG.find(
      (i) => i.tipo === "SUMULA" && String(Number(i.numero)) === targetNum
    );
    if (directHit) {
      const rest = TCE_PR_CURATED_CATALOG.filter((i) => i.id !== directHit.id);
      return [directHit, ...rest].slice(0, limit);
    }
  }

  // Verificação direta de Consulta na query (ex.: "consulta 2804")
  const consNumMatch = cleanQ.match(/consulta\s*(?:n[º°o]\s*)?(\d{3,7})/i);
  if (consNumMatch) {
    const targetNum = consNumMatch[1];
    const directHit = TCE_PR_CURATED_CATALOG.find(
      (i) => i.tipo === "CONSULTA" && i.numero === targetNum
    );
    if (directHit) {
      const rest = TCE_PR_CURATED_CATALOG.filter((i) => i.id !== directHit.id);
      return [directHit, ...rest].slice(0, limit);
    }
  }

  const scored = TCE_PR_CURATED_CATALOG.map((item) => {
    const hay = `${item.id} ${item.aliases.join(" ")} ${item.indexacao.join(" ")} ${item.enunciado} ${item.dispositivo} ${item.historico || ""} ${item.fundamentacao || ""}`.toLowerCase();
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
