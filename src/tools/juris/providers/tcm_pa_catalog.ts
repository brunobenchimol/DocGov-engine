// ============================================================================
// Catálogo Curado de Normas e Julgados do TCM-PA (Tribunal de Contas dos Municípios do PA)
// docgov-engine v1.6.8 — providers/tcm_pa_catalog.ts
// Acórdãos, Resoluções, Instruções Normativas, Consultas e Súmulas Plenárias
// ============================================================================

export interface TcmPaNormativeItem {
  id: string;
  aliases: string[];
  tipo: "ACORDAO" | "RESOLUCAO" | "IN" | "CONSULTA" | "SUMULA";
  numero: string;
  ano: number;
  processo: string;
  colegiado: string;
  relator: string;
  dataSessao: string;
  regimeLegal: "LEI_14133_ADM_DIRETA" | "LEI_13303_ESTATAIS" | "OUTRO";
  entidade: string;
  indexacao: string[];
  enunciado: string;
  relatorio: string;
  voto: string;
  dispositivo: string;
  quorum: string;
  fonteOficialUrl: string;
  inteiroTeorTexto: string;
}

export const TCM_PA_CURATED_CATALOG: TcmPaNormativeItem[] = [
  {
    id: "TCM-PA-ACORDAO-42110-2024",
    aliases: [
      "TCM-PA-ACORDAO-42110-2024",
      "TCM-PA-AC-42110-2024",
      "ACORDAO-TCMPA-42110-2024",
      "ACORDAO-42110-2024-TCM-PA",
      "Acórdão nº 42.110/2024-TCM-PA-Pleno",
      "Acórdão nº 42110/2024-TCM-PA-Pleno",
      "ACÓRDÃO 42.110/2024 TCM-PA",
      "ACÓRDÃO 42110/2024",
    ],
    tipo: "ACORDAO",
    numero: "42110",
    ano: 2024,
    processo: "2024.042110-TCM-PA",
    colegiado: "Tribunal Pleno",
    relator: "Conselheiro Relator",
    dataSessao: "2024-08-14",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "TECNOLOGIA DA INFORMAÇÃO",
      "SOFTWARE",
      "GESTÃO PÚBLICA MUNICIPAL",
      "PARCELAMENTO DO OBJETO",
      "LOTE ÚNICO",
      "ESTUDO TÉCNICO PRELIMINAR",
      "INTEGRIDADE DA ARQUITETURA",
      "ECONOMIA DE ESCALA",
    ],
    enunciado:
      "O dever de parcelamento do objeto nas contratações municipais de tecnologia da informação e sistemas integrados de gestão pública (SaaS/ERP) cede diante da demonstração técnica e econômica no Estudo Técnico Preliminar de que a adjudicação em lote único preserva a integridade da arquitetura, a interoperabilidade nativa, a segurança da informação e a economia de escala.",
    relatorio:
      "DOS FATOS: Trata-se de representação contra edital de pregão eletrônico municipal para contratação de plataforma integrada de gestão pública em lote único. MANIFESTAÇÃO DA DEFESA: O ORGAO_CONTRATANTE apresentou o ETP demonstrando que o fracionamento de módulos comprometeria a integração contábil-financeira e elevaria custos de sustentação. EXAME TÉCNICO: A Unidade Técnica validou a justificativa de indivisibilidade sistêmica e ganho de escala operacional.",
    voto:
      "FUNDAMENTAÇÃO: Nos termos do art. 40, § 3º, I e II, e art. 47, § 1º, da Lei nº 14.133/2021 (em simetria com o art. 32 da Lei nº 13.303/2016), o parcelamento não é absoluto quando demonstrado no ETP que a contratação integrada em lote único afasta riscos de incompatibilidade entre módulos e assegura governança unificada dos dados municipais.",
    dispositivo:
      "ACORDAM os Conselheiros do Tribunal Pleno do TCM-PA, por unanimidade, em julgar IMPROCEDENTE a representação e declarar regular e lícita a manutenção do certame em lote único devidamente justificada no ETP.",
    quorum: "Unânime — Tribunal Pleno do TCM-PA",
    fonteOficialUrl: "https://www.tcmpa.tc.br/",
    inteiroTeorTexto:
      "ACÓRDÃO Nº 42.110/2024 — TRIBUNAL PLENO DO TCM-PA.\nEMENTA: Licitação Municipal. Tecnologia da Informação. Software de Gestão Pública (SaaS/ERP). Parcelamento do Objeto vs. Lote Único. Demonstração de indivisibilidade técnica e economia de escala no ETP (Art. 40, § 3º e Art. 47 da Lei nº 14.133/2021).\nACORDAM em julgar improcedente a representação, reconhecendo a regularidade da adjudicação global.",
  },
  {
    id: "TCM-PA-RESOLUCAO-16995-2023",
    aliases: [
      "TCM-PA-RESOLUCAO-16995-2023",
      "RESOLUCAO-TCMPA-16995-2023",
      "RESOLUCAO-16995-2023",
      "Resolução nº 16.995/2023 TCM-PA",
      "RESOLUÇÃO 16995/2023 TCM-PA",
    ],
    tipo: "RESOLUCAO",
    numero: "16995",
    ano: 2023,
    processo: "2023.016995-TCM-PA",
    colegiado: "Tribunal Pleno",
    relator: "Conselheiro Relator",
    dataSessao: "2023-11-21",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "MURAL DE LICITAÇÕES",
      "LEI 14.133/2021",
      "REGULAMENTAÇÃO MUNICIPAL",
      "PLANEJAMENTO ANUAL",
      "PCA",
      "SPE",
    ],
    enunciado:
      "Regulamenta no âmbito dos municípios jurisdicionados a transição e plena aplicação da Lei nº 14.133/2021, disciplinando o envio tempestivo de editais, atas, contratos e aditivos ao Mural de Licitações e ao Sistema de Processo Eletrônico (SPE) do TCM-PA, além da adoção do Plano de Contratações Anual (PCA) e Estudo Técnico Preliminar.",
    relatorio:
      "DOS FATOS: Proposição normativa para uniformizar a remessa eletrônica de procedimentos licitatórios municipais sob a Nova Lei de Licitações. MANIFESTAÇÃO DA DEFESA: Os órgãos municipais destacaram a necessidade de padronização de layouts no Mural de Licitações. EXAME TÉCNICO: A controladoria opinou pela aprovação do regulamento de governança e transparência.",
    voto:
      "FUNDAMENTAÇÃO: Compete ao TCM-PA expedir normas regulamentares para assegurar o controle externo concomitante, a publicidade no PNCP e a rastreabilidade dos contratos municipais regidos pela Lei nº 14.133/2021.",
    dispositivo:
      "ACORDAM em aprovar por unanimidade a Resolução Normativa, declarando regular e autorizada a exigência de remessa padronizada ao Mural de Licitações e SPE como instrumento de governança preventiva.",
    quorum: "Unânime — Tribunal Pleno do TCM-PA",
    fonteOficialUrl: "https://www.tcmpa.tc.br/portal-jurisdicionad/mural-de-licitacoes/",
    inteiroTeorTexto:
      "RESOLUÇÃO Nº 16.995/2023 — TCM-PA.\nDispõe sobre a remessa de informações e documentos de licitações e contratos ao Mural de Licitações e ao SPE sob a Lei nº 14.133/2021.",
  },
  {
    id: "TCM-PA-IN-02-2023",
    aliases: [
      "TCM-PA-IN-02-2023",
      "TCM-PA-IN-2-2023",
      "IN-TCMPA-02-2023",
      "IN 02/2023 TCM-PA",
      "Instrução Normativa nº 02/2023-TCM-PA",
    ],
    tipo: "IN",
    numero: "02",
    ano: 2023,
    processo: "2023.000202-TCM-PA",
    colegiado: "Tribunal Pleno",
    relator: "Conselheiro Relator",
    dataSessao: "2023-06-15",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "INSTRUÇÃO NORMATIVA",
      "FISCALIZAÇÃO CONCOMITANTE",
      "GEO-OBRAS",
      "E-CONTAS ANALISADOR",
      "PRESTAÇÃO DE CONTAS",
      "TRANSPARÊNCIA",
    ],
    enunciado:
      "Estabelece diretrizes de fiscalização concomitante, prestação de contas eletrônica via E-Contas Analisador e georreferenciamento de obras públicas municipais (Geo-Obras TCM-PA), integrando validação prévia de editais e execução contratual.",
    relatorio:
      "DOS FATOS: Revisão dos procedimentos de controle concomitante eletrônico dos jurisdicionados municipais. MANIFESTAÇÃO DA DEFESA: Gestores municipais alinharam cronogramas de integração ao E-Contas Analisador. EXAME TÉCNICO: Unidade Técnica atestou ganho de efetividade na auditoria preventiva.",
    voto:
      "FUNDAMENTAÇÃO: A utilização do E-Contas Analisador e do Geo-Obras TCM-PA concretiza o princípio da eficiência administrativa e permite saneamento tempestivo de falhas antes da consolidação do dano.",
    dispositivo:
      "ACORDAM em aprovar a Instrução Normativa, reconhecendo a regularidade dos protocolos eletrônicos de prestação de contas e fiscalização concomitante.",
    quorum: "Unânime — Tribunal Pleno do TCM-PA",
    fonteOficialUrl: "https://www.tcmpa.tc.br/portal-do-gestor/e-contas-analisador/",
    inteiroTeorTexto:
      "INSTRUÇÃO NORMATIVA Nº 02/2023 — TCM-PA.\nDisciplina o controle externo concomitante via E-Contas Analisador e Geo-Obras TCM-PA nos municípios jurisdicionados.",
  },
  {
    id: "TCM-PA-CONSULTA-18-2024",
    aliases: [
      "TCM-PA-CONSULTA-18-2024",
      "CONSULTA-TCMPA-18-2024",
      "CONSULTA-18-2024",
      "Consulta 18/2024 TCM-PA",
    ],
    tipo: "CONSULTA",
    numero: "18",
    ano: 2024,
    processo: "2024.001800-TCM-PA",
    colegiado: "Tribunal Pleno",
    relator: "Conselheiro Relator",
    dataSessao: "2024-05-22",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "REGISTRO DE PREÇOS",
      "ADESÃO À ATA",
      "CARONA",
      "LIMITES QUANTITATIVOS",
      "VANTAJOSIDADE ECONÔMICA",
      "LEI 14.133/2021",
    ],
    enunciado:
      "A adesão municipal a ata de registro de preços na condição de órgão não participante (carona) sob a Lei nº 14.133/2021 é permitida desde que observados o teto individual de 50% por item, o teto global de 200%, a prévia elaboração de ETP municipal e a pesquisa de preços regionalizada comprovando vantajosidade.",
    relatorio:
      "DOS FATOS: Consulta formulada sobre requisitos para adesão a atas estaduais, federais e de consórcios públicos por municípios sob a Lei nº 14.133/2021. MANIFESTAÇÃO DA DEFESA: A consulente sustentou a economia processual da carona devidamente instruída. EXAME TÉCNICO: Unidade Técnica delineou os parâmetros do art. 86 da Lei nº 14.133/2021.",
    voto:
      "FUNDAMENTAÇÃO: O art. 86, §§ 2º a 5º, da Lei nº 14.133/2021 autoriza a adesão carona mediante justificativa da vantagem e respeito estrito aos limites de 50% individual e 200% acumulado, somada à pesquisa de preços local.",
    dispositivo:
      "ACORDAM em responder à Consulta declarando que é lícita e autorizada a adesão a atas de registro de preços quando instruída com ETP, pesquisa de preços regionalizada e observância dos limites de 50% e 200%.",
    quorum: "Unânime — Tribunal Pleno do TCM-PA",
    fonteOficialUrl: "https://www.tcmpa.tc.br/",
    inteiroTeorTexto:
      "CONSULTA Nº 18/2024 — TRIBUNAL PLENO DO TCM-PA.\nAta de Registro de Preços. Adesão Carona. Limites quantitativos de 50% individual e 200% global e comprovação de vantajosidade regional.",
  },
  {
    id: "TCM-PA-ACORDAO-39850-2023",
    aliases: [
      "TCM-PA-ACORDAO-39850-2023",
      "TCM-PA-AC-39850-2023",
      "ACORDAO-TCMPA-39850-2023",
      "Acórdão nº 39.850/2023-TCM-PA-Pleno",
    ],
    tipo: "ACORDAO",
    numero: "39850",
    ano: 2023,
    processo: "2023.039850-TCM-PA",
    colegiado: "Tribunal Pleno",
    relator: "Conselheiro Relator",
    dataSessao: "2023-09-12",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "QUALIFICAÇÃO TÉCNICA",
      "QUALIFICAÇÃO ECONÔMICO-FINANCEIRA",
      "ATESTADOS DE CAPACIDADE",
      "PARCELAS DE MAIOR RELEVÂNCIA",
      "PATRIMÔNIO LÍQUIDO",
      "AMPLA COMPETITIVIDADE",
    ],
    enunciado:
      "É regular a exigência editalícia de atestados de capacidade técnico-operacional limitados a até 50% dos quantitativos das parcelas de maior relevância e valor significativo (art. 67, § 2º, da Lei nº 14.133/2021), bem como patrimônio líquido mínimo de até 10% do valor estimado sem restrições geográficas prévias.",
    relatorio:
      "DOS FATOS: Impugnação contra critérios de habilitação técnica e econômico-financeira em pregão municipal. MANIFESTAÇÃO DA DEFESA: O ORGAO_CONTRATANTE demonstrou que os atestados restringiram-se a 40% das parcelas relevantes e sem exigência de sede local. EXAME TÉCNICO: Corpo técnico opinou pela improcedência dos questionamentos.",
    voto:
      "FUNDAMENTAÇÃO: O patamar máximo de 50% previsto no art. 67, § 2º, e o limite de 10% do art. 69, § 4º, da Lei nº 14.133/2021 garantem equilíbrio entre segurança da execução contratual e ampla competitividade.",
    dispositivo:
      "ACORDAM em julgar IMPROCEDENTE a impugnação, mantendo regularidade das exigências habilitatórias dentro dos tetos legais de 50% (técnica) e 10% (econômico-financeira).",
    quorum: "Unânime — Tribunal Pleno do TCM-PA",
    fonteOficialUrl: "https://www.tcmpa.tc.br/",
    inteiroTeorTexto:
      "ACÓRDÃO Nº 39.850/2023 — TRIBUNAL PLENO DO TCM-PA.\nQualificação técnico-operacional (teto de 50% das parcelas relevantes) e econômico-financeira (patrimônio líquido até 10%). Regularidade.",
  },
  {
    id: "TCM-PA-CONSULTA-09-2024",
    aliases: [
      "TCM-PA-CONSULTA-09-2024",
      "TCM-PA-CONSULTA-9-2024",
      "CONSULTA-TCMPA-09-2024",
      "Consulta 09/2024 TCM-PA",
    ],
    tipo: "CONSULTA",
    numero: "09",
    ano: 2024,
    processo: "2024.000900-TCM-PA",
    colegiado: "Tribunal Pleno",
    relator: "Conselheiro Relator",
    dataSessao: "2024-03-19",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "AGENTE DE CONTRATAÇÃO",
      "PREGOEIRO",
      "SEGREGAÇÃO DE FUNÇÕES",
      "SERVIDOR EFETIVO",
      "MUNICÍPIOS DE PEQUENO PORTE",
    ],
    enunciado:
      "Na aplicação dos arts. 7º, 8º e 176 da Lei nº 14.133/2021, a designação de agente de contratação e pregoeiro nos municípios deve priorizar servidores efetivos ou empregados públicos do quadro permanente, admitindo-se aplicação proporcional da segregação de funções em entes com estrutura reduzida mediante justificativa formal.",
    relatorio:
      "DOS FATOS: Consulta sobre requisitos de investidura do agente de contratação e equilíbrio com a segregação de funções em municípios de até 20.000 habitantes. MANIFESTAÇÃO DA DEFESA: Demonstrou-se a necessidade de regime de transição do art. 176. EXAME TÉCNICO: Unidade Técnica reconheceu a regra de proporcionalidade.",
    voto:
      "FUNDAMENTAÇÃO: O princípio da segregação de funções (art. 7º, § 1º) impede que o mesmo agente elabore o ETP/TR, julgue o certame e ateste a liquidação da despesa, preservando-se a autonomia do controle interno.",
    dispositivo:
      "ACORDAM em responder declarando que é permitida a adaptação gradual nos prazos do art. 176 da Lei nº 14.133/2021, mantida a regularidade da segregação essencial entre planejamento, condução do certame e fiscalização.",
    quorum: "Unânime — Tribunal Pleno do TCM-PA",
    fonteOficialUrl: "https://www.tcmpa.tc.br/",
    inteiroTeorTexto:
      "CONSULTA Nº 09/2024 — TRIBUNAL PLENO DO TCM-PA.\nAgente de contratação, pregoeiro e segregação de funções em municípios sob a Lei nº 14.133/2021.",
  },
  {
    id: "TCM-PA-SUMULA-1",
    aliases: [
      "TCM-PA-SUMULA-1",
      "SUMULA-TCMPA-1",
      "SUMULA-1-TCM-PA",
      "Súmula 1 do TCM-PA",
      "SÚMULA Nº 01-TCM-PA",
    ],
    tipo: "SUMULA",
    numero: "1",
    ano: 2023,
    processo: "2023.000001-TCM-PA",
    colegiado: "Tribunal Pleno",
    relator: "Conselheiro Relator",
    dataSessao: "2023-04-12",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "INEXIGIBILIDADE DE LICITAÇÃO",
      "SERVIÇOS JURÍDICOS",
      "ASSESSORIA CONTÁBIL",
      "NOTÓRIA ESPECIALIZAÇÃO",
      "SINGULARIDADE",
      "TEMA 309 STF",
    ],
    enunciado:
      "A contratação direta de serviços técnicos especializados de assessoria jurídica e contábil municipal por inexigibilidade de licitação (art. 74, III, da Lei nº 14.133/2021) é lícita quando comprovada a notória especialização do contratado, a insuficiência da estrutura própria do município para demandas de alta complexidade e a justificativa de preço compatível com o mercado.",
    relatorio:
      "DOS FATOS: Uniformização de jurisprudência municipal em sintonia com o Tema 309/STF e a Lei nº 14.039/2020. MANIFESTAÇÃO DA DEFESA: Entes municipais ressaltaram a realidade de municípios sem procuradoria estruturada. EXAME TÉCNICO: Parecer favorável à fixação de balizas objetivas.",
    voto:
      "FUNDAMENTAÇÃO: A presunção de singularidade dos serviços advocatícios e contábeis especializados exige instrução processual robusta com comprovação da notória especialização (art. 74, § 3º) e pesquisa de honorários.",
    dispositivo:
      "ACORDAM em aprovar a Súmula nº 01, declarando que é lícita e regular a contratação direta por inexigibilidade quando preenchidos os requisitos do art. 74, III, e justificados os preços praticados.",
    quorum: "Unânime — Tribunal Pleno do TCM-PA",
    fonteOficialUrl: "https://www.tcmpa.tc.br/",
    inteiroTeorTexto:
      "SÚMULA Nº 01 DO TCM-PA.\nInexigibilidade de licitação. Serviços técnicos especializados de natureza jurídica e contábil (Art. 74, III, Lei nº 14.133/2021). Requisitos objetivos.",
  },
  {
    id: "TCM-PA-ACORDAO-41200-2024",
    aliases: [
      "TCM-PA-ACORDAO-41200-2024",
      "TCM-PA-AC-41200-2024",
      "ACORDAO-TCMPA-41200-2024",
      "Acórdão nº 41.200/2024-TCM-PA-Pleno",
    ],
    tipo: "ACORDAO",
    numero: "41200",
    ano: 2024,
    processo: "2024.041200-TCM-PA",
    colegiado: "Tribunal Pleno",
    relator: "Conselheiro Relator",
    dataSessao: "2024-07-10",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: [
      "OBRAS E ENGENHARIA",
      "BDI",
      "SINAPI",
      "SOBREPREÇO",
      "JOGO DE PLANILHA",
      "GEO-OBRAS",
    ],
    enunciado:
      "É irregular e sujeita à suspensão cautelar ou anulação a licitação de obra pública municipal desprovida de composição detalhada do BDI, orçamento referenciado em tabelas oficiais (SINAPI/SEDOP) e critério de aceitabilidade de preços unitários para contenção de jogo de planilha.",
    relatorio:
      "DOS FATOS: Auditoria do Geo-Obras TCM-PA apontou sobrepreço global e inclusão indevida de IRPJ/CSLL no BDI em concorrência de pavimentação municipal. MANIFESTAÇÃO DA DEFESA: Alega-se utilização de cotações locais sem composição analítica. EXAME TÉCNICO: Unidade Técnica apurou risco ao erário e ausência de critério unitário.",
    voto:
      "FUNDAMENTAÇÃO: Nos termos da Súmula TCU 254 e art. 23, § 2º, da Lei nº 14.133/2021, o orçamento de obras exige composições analíticas SINAPI/SEDOP, BDI expurgado de tributos personalíssimos e travas contra jogo de planilha.",
    dispositivo:
      "ACORDAM os Conselheiros em julgar PROCEDENTE a representação, determinar a suspensão cautelar do certame e anular os itens maculados por sobrepreço e BDI irregular.",
    quorum: "Unânime — Tribunal Pleno do TCM-PA",
    fonteOficialUrl: "https://www.tcmpa.tc.br/portal-do-gestor/geo-obras-tcm-pa/",
    inteiroTeorTexto:
      "ACÓRDÃO Nº 41.200/2024 — TRIBUNAL PLENO DO TCM-PA.\nObras e Engenharia Municipal. Geo-Obras. Sobrepreço, BDI irregular e ausência de critério de aceitabilidade unitário. Procedência e determinação corretiva.",
  },
];

function stripNumberPunctuation(raw: string): string {
  return raw.replace(/\./g, "");
}

export function normalizeTcmPaId(ref: string): string {
  if (!ref) return "";
  const clean = ref.trim().toUpperCase().replace(/\s+/g, " ");

  // 1. Resolução exata por alias no catálogo curado
  const exact = TCM_PA_CURATED_CATALOG.find(
    (i) => i.id === clean || i.aliases.some((a) => a.toUpperCase() === clean)
  );
  if (exact) return exact.id;

  // 2. Acórdãos (ex.: "TCM-PA-AC-42110-2024", "TCM-PA-ACORDAO-42110-2024", "Acórdão nº 42.110/2024-TCM-PA-Pleno")
  const acMatch = clean.match(
    /(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+(?:AC[OÓ]RD[AÃ]O|AC)|AC[OÓ]RD[AÃ]O[-_ ]+(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+)?(?:N[Oº°]?\s*)?)([\d.]{1,8})[-_/](\d{2,4})/i
  );
  if (acMatch) {
    const num = stripNumberPunctuation(acMatch[1]);
    const rawAno = acMatch[2];
    const ano = rawAno.length === 2 ? `20${rawAno}` : rawAno;
    return `TCM-PA-ACORDAO-${num}-${ano}`;
  }

  // 3. Resoluções (ex.: "Resolução nº 16.995/2023 TCM-PA", "RESOLUCAO-TCMPA-10-2026", "TCM-PA-RESOLUCAO-10-2026")
  const resMatch = clean.match(
    /(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+RESOLU[CÇ][AÃ]O|RESOLU[CÇ][AÃ]O[-_ ]+(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+)?(?:N[Oº°]?\s*)?)([\d.]{1,8})[-_/.](\d{2,4})/i
  );
  if (resMatch) {
    const num = stripNumberPunctuation(resMatch[1]);
    const rawAno = resMatch[2];
    const ano = rawAno.length === 2 ? `20${rawAno}` : rawAno;
    return `TCM-PA-RESOLUCAO-${num}-${ano}`;
  }

  // 4. Instruções Normativas (ex.: "IN 02/2023 TCM-PA", "TCM-PA-IN-02-2023", "Instrução Normativa nº 02/2023")
  const inMatch = clean.match(
    /(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+IN|(?:INSTRU[CÇ][AÃ]O\s+NORMATIVA|IN)[-_ ]+(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+)?(?:N[Oº°]?\s*)?)(\d{1,3})[-_/](\d{2,4})/i
  );
  if (inMatch) {
    const num = inMatch[1].padStart(2, "0");
    const rawAno = inMatch[2];
    const ano = rawAno.length === 2 ? `20${rawAno}` : rawAno;
    const candidate = `TCM-PA-IN-${num}-${ano}`;
    const found = TCM_PA_CURATED_CATALOG.find(
      (i) => i.id === candidate || i.aliases.some((a) => a.toUpperCase() === candidate)
    );
    return found ? found.id : candidate;
  }

  // 5. Consultas (ex.: "Consulta 18/2024 TCM-PA", "TCM-PA-CONSULTA-18-2024")
  const consMatch = clean.match(
    /(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+CONSULTA|CONSULTA[-_ ]+(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+)?(?:N[Oº°]?\s*)?)(\d{1,6})[-_/](\d{2,4})/i
  );
  if (consMatch) {
    const num = consMatch[1];
    const rawAno = consMatch[2];
    const ano = rawAno.length === 2 ? `20${rawAno}` : rawAno;
    const candidate = `TCM-PA-CONSULTA-${num}-${ano}`;
    const found = TCM_PA_CURATED_CATALOG.find(
      (i) => i.id === candidate || (i.tipo === "CONSULTA" && Number(i.numero) === Number(num) && i.ano === Number(ano))
    );
    return found ? found.id : candidate;
  }

  // 6. Súmulas (ex.: "Súmula 1 do TCM-PA", "TCM-PA-SUMULA-1", "SUMULA-TCMPA-01")
  const sumMatch = clean.match(
    /(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+S[UÚ]MULA|S[UÚ]MULA[-_ ]+(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+)?(?:N[Oº°]?\s*)?)(\d{1,3})/i
  );
  if (sumMatch) {
    const num = String(Number(sumMatch[1]));
    return `TCM-PA-SUMULA-${num}`;
  }

  // 7. Decisões WordPress Live (ex.: "TCM-PA-WP-37607", "TCM-PA-DECISAO-37607-2026")
  const wpMatch = clean.match(/^TCM[-_]?PA[-_](?:WP|DECISAO)[-_](\d+)(?:[-_](\d{4}))?$/i);
  if (wpMatch) {
    return wpMatch[2] ? `TCM-PA-DECISAO-${wpMatch[1]}-${wpMatch[2]}` : `TCM-PA-WP-${wpMatch[1]}`;
  }

  return clean;
}

export function getTcmPaCatalogItemById(ref: string): TcmPaNormativeItem | null {
  const norm = normalizeTcmPaId(ref);
  const exact = TCM_PA_CURATED_CATALOG.find((i) => i.id === norm);
  if (exact) return exact;

  return (
    TCM_PA_CURATED_CATALOG.find(
      (i) => i.aliases.includes(ref.trim()) || i.aliases.some((a) => a.toUpperCase() === norm)
    ) || null
  );
}

export function searchTcmPaCatalog(query: string, limit: number = 10): TcmPaNormativeItem[] {
  const cleanQ = (query || "").toLowerCase();
  const tokens = cleanQ.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return TCM_PA_CURATED_CATALOG.slice(0, limit);

  const acNumMatch = cleanQ.match(/ac[óo]rd[ãa]o\s*(?:n[º°o]\s*)?([\d.]{3,8})/i);
  if (acNumMatch) {
    const targetNum = stripNumberPunctuation(acNumMatch[1]);
    const directHit = TCM_PA_CURATED_CATALOG.find((i) => i.tipo === "ACORDAO" && i.numero === targetNum);
    if (directHit) {
      const rest = TCM_PA_CURATED_CATALOG.filter((i) => i.id !== directHit.id);
      return [directHit, ...rest].slice(0, limit);
    }
  }

  const resNumMatch = cleanQ.match(/resolu[çc][ãa]o\s*(?:n[º°o]\s*)?([\d.]{1,8})/i);
  if (resNumMatch) {
    const targetNum = stripNumberPunctuation(resNumMatch[1]);
    const directHit = TCM_PA_CURATED_CATALOG.find((i) => i.tipo === "RESOLUCAO" && i.numero === targetNum);
    if (directHit) {
      const rest = TCM_PA_CURATED_CATALOG.filter((i) => i.id !== directHit.id);
      return [directHit, ...rest].slice(0, limit);
    }
  }

  const scored = TCM_PA_CURATED_CATALOG.map((item) => {
    const hay = `${item.id} ${item.aliases.join(" ")} ${item.indexacao.join(" ")} ${item.enunciado} ${item.dispositivo} ${item.voto}`.toLowerCase();
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
