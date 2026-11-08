// ============================================================================
// Catálogo Curado de Normas de Alto Valor do TCE-MG (Tribunal de Contas de MG)
// docgov-engine v1.4.5 — providers/tce_mg_catalog.ts
// Súmulas e Consultas do Tribunal Pleno com Força Normativa (LC 102/2008, art. 76)
// ============================================================================

export interface TceMgNormativeItem {
  id: string;
  aliases: string[];
  tipo: "SUMULA" | "CONSULTA" | "ACORDAO";
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

export const TCE_MG_CURATED_CATALOG: TceMgNormativeItem[] = [
  {
    id: "SUMULA-TCEMG-114",
    aliases: ["TCE-MG-SUMULA-114", "SUMULA-TCEMG-114", "TCE-MG-114", "SÚMULA 114 DO TCE-MG", "SUMULA-114-TCEMG", "SUMULA 114 TCEMG"],
    tipo: "SUMULA",
    numero: "114",
    ano: 2011,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2011-09-14",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "PARCELAMENTO DO OBJETO", "DIVISIBILIDADE", "ITENS OU LOTES", "AMPLA PARTICIPAÇÃO", "ECONOMIA DE ESCALA"],
    enunciado: "É obrigatória a realização de licitação por itens ou lotes quando o objeto for divisível, desde que não haja prejuízo para o conjunto ou perda de economia de escala, visando propiciar a ampla participação de licitantes que, embora não disponham de capacidade para a totalidade do objeto, possam concorrer para itens ou lotes isolados.",
    dispositivo: "Determina a obrigatoriedade do parcelamento do objeto em itens ou lotes divisíveis, salvo comprovação técnica de perda de economia de escala ou prejuízo ao conjunto da contratação.",
    historico: "Aprovada na Sessão do Tribunal Pleno de 14/09/2011 (DOC de 23/09/2011).",
    fundamentacao: "Art. 40, V, b e art. 47, II da Lei nº 14.133/2021; art. 23, § 1º da Lei nº 8.666/1993.",
    fonteOficialUrl: "https://www.tce.mg.gov.br/jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 114 DO TRIBUNAL DE CONTAS DO ESTADO DE MINAS GERAIS.\nÉ obrigatória a realização de licitação por itens ou lotes quando o objeto for divisível, desde que não haja prejuízo para o conjunto ou perda de economia de escala, visando propiciar a ampla participação de licitantes que, embora não disponham de capacidade para a totalidade do objeto, possam concorrer para itens ou lotes isolados.",
  },
  {
    id: "SUMULA-TCEMG-126",
    aliases: ["TCE-MG-SUMULA-126", "SUMULA-TCEMG-126", "TCE-MG-126", "SÚMULA 126 DO TCE-MG", "SUMULA-126-TCEMG", "SUMULA 126 TCEMG"],
    tipo: "SUMULA",
    numero: "126",
    ano: 2017,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2017-10-18",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "MANUTENÇÃO DE FROTA", "SISTEMA INFORMATIZADO", "REDE CREDENCIADA", "QUARTEIRIZAÇÃO", "MAIOR DESCONTO", "VEDAÇÃO A CREDENCIAMENTO PRÉVIO"],
    enunciado: "Nos procedimentos licitatórios para contratação de serviços de manutenção de frota de veículos, sob o regime de gestão compartilhada com o uso de sistema informatizado e rede credenciada (sistema de quarteirização), o critério de julgamento deve recair sobre o maior percentual de desconto sobre a tabela referencial de preços, sendo vedada a exigência de prévio credenciamento de oficinas mecânicas antes da assinatura do contrato.",
    dispositivo: "É vedada a exigência de credenciamento prévio da rede de oficinas na fase de habilitação, devendo o critério de julgamento recair sobre maior desconto da tabela referencial.",
    historico: "Aprovada na Sessão do Tribunal Pleno de 18/10/2017 (DOC de 27/10/2017).",
    fundamentacao: "Art. 34, art. 67 e art. 11 da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.mg.gov.br/jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 126 DO TRIBUNAL DE CONTAS DO ESTADO DE MINAS GERAIS.\nNos procedimentos licitatórios para contratação de serviços de manutenção de frota de veículos, sob o regime de gestão compartilhada com o uso de sistema informatizado e rede credenciada (sistema de quarteirização), o critério de julgamento deve recair sobre o maior percentual de desconto sobre a tabela referencial de preços, sendo vedada a exigência de prévio credenciamento de oficinas mecânicas antes da assinatura do contrato.",
  },
  {
    id: "SUMULA-TCEMG-88",
    aliases: ["TCE-MG-SUMULA-88", "SUMULA-TCEMG-88", "TCE-MG-88", "SÚMULA 88 DO TCE-MG", "SUMULA-88-TCEMG"],
    tipo: "SUMULA",
    numero: "88",
    ano: 2008,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2008-04-16",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["ORDENAÇÃO DE DESPESA", "DEVER DE LICITAR", "DISPENSA INDEVIDA", "FRACIONAMENTO DE DESPESA", "RESPONSABILIZAÇÃO", "MULTA"],
    enunciado: "A ordenação de despesa sem o prévio e regular procedimento licitatório, ressalvadas as hipóteses legalmente previstas de dispensa e inexigibilidade, constitui grave infração à norma legal e enseja a aplicação de multa, além da responsabilização civil e penal do agente público ordenador.",
    dispositivo: "Fixa a responsabilidade pessoal do ordenador de despesa e imposição de sanção de multa em caso de contratação direta sem prévio procedimento licitatório fora das hipóteses legais.",
    historico: "Aprovada na Sessão do Tribunal Pleno de 16/04/2008 (DOC de 25/04/2008).",
    fundamentacao: "Art. 72 e art. 73 da Lei nº 14.133/2021; art. 89 da Lei nº 8.666/1993.",
    fonteOficialUrl: "https://www.tce.mg.gov.br/jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 88 DO TRIBUNAL DE CONTAS DO ESTADO DE MINAS GERAIS.\nA ordenação de despesa sem o prévio e regular procedimento licitatório, ressalvadas as hipóteses legalmente previstas de dispensa e inexigibilidade, constitui grave infração à norma legal e enseja a aplicação de multa, além da responsabilização civil e penal do agente público ordenador.",
  },
  {
    id: "SUMULA-TCEMG-79",
    aliases: ["TCE-MG-SUMULA-79", "SUMULA-TCEMG-79", "TCE-MG-79", "SÚMULA 79 DO TCE-MG", "SUMULA-79-TCEMG"],
    tipo: "SUMULA",
    numero: "79",
    ano: 2006,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2006-11-22",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["CONTRATO ADMINISTRATIVO", "HOMOLOGAÇÃO", "FORMALISMO MODERADO", "ASSINATURA DO CONTRATO", "AUTORIDADE COMPETENTE"],
    enunciado: "Nos processos de fiscalização de contratos administrativos decorrentes de procedimento licitatório, a assinatura do instrumento de contrato pela autoridade competente para a homologação do certame supre a ausência do ato formal autônomo de homologação, desde que atendidos todos os pressupostos legais e não demonstrado prejuízo à Administração ou a terceiros.",
    dispositivo: "Reconhece a eficácia confirmatória da assinatura do contrato pela autoridade competente, suprindo omissão formal autônoma do ato de homologação.",
    historico: "Aprovada na Sessão do Tribunal Pleno de 22/11/2006 (DOC de 01/12/2006).",
    fundamentacao: "Art. 12 e art. 71 da Lei nº 14.133/2021; princípio da instrumentalidade das formas.",
    fonteOficialUrl: "https://www.tce.mg.gov.br/jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 79 DO TRIBUNAL DE CONTAS DO ESTADO DE MINAS GERAIS.\nNos processos de fiscalização de contratos administrativos decorrentes de procedimento licitatório, a assinatura do instrumento de contrato pela autoridade competente para a homologação do certame supre a ausência do ato formal autônomo de homologação, desde que atendidos todos os pressupostos legais e não demonstrado prejuízo à Administração ou a terceiros.",
  },
  {
    id: "CONSULTA-TCEMG-1160667",
    aliases: ["CONSULTA-1160667-TCEMG", "CONSULTA 1160667 TCE-MG", "PROCESSO 1160667 TCE-MG", "TCE-MG-CONSULTA-1160667", "CONSULTA-TCEMG-1160667"],
    tipo: "CONSULTA",
    numero: "1160667",
    ano: 2024,
    colegiado: "Tribunal Pleno",
    relator: "Cons. Substituto Adonias Monteiro",
    dataSessao: "2024-04-17",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["CONSULTA", "FORÇA NORMATIVA", "ADESÃO A ATA", "CARONA", "REGISTRO DE PREÇOS", "DIREITO INTERTEMPORAL", "LEI 14.133/2021", "LEI 8.666/1993"],
    enunciado: "É lícita a adesão tardia por órgão não participante ('carona') a ata de registro de preços regida pela legislação anterior (Lei nº 8.666/1993, Lei nº 10.520/2002 ou Lei nº 12.462/2011), mesmo após o marco temporal de revogação definitiva das referidas normas em 30/12/2023, desde que a ata esteja vigente, haja previsão originária no edital e sejam estritamente observados os limites legais e temporais fixados no diploma de regência da ata.",
    dispositivo: "Fixa tese com eficácia normativa reconhecendo a validade jurídica de adesões a atas de registro de preços pretéritas durante a vigência do instrumento, sob planejamento vinculado.",
    historico: "Consulta respondida pelo Tribunal Pleno em 17/04/2024. Força normativa nos termos do art. 76 da LC nº 102/2008.",
    fundamentacao: "Art. 86 da Lei nº 14.133/2021 c/c art. 191 da Lei nº 14.133/2021 e art. 76 da LC nº 102/2008.",
    fonteOficialUrl: "https://tcjuris.tce.mg.gov.br/Home/Detalhes/1160667",
    inteiroTeorTexto: "TRIBUNAL DE CONTAS DO ESTADO DE MINAS GERAIS - TRIBUNAL PLENO\nProcesso nº 1.160.667 - Natureza: Consulta. Relator: Conselheiro Substituto Adonias Monteiro.\nEMENTA: CONSULTA COM FORÇA NORMATIVA. SISTEMA DE REGISTRO DE PREÇOS. ADESÃO ('CARONA') A ATA CELEBRADA SOB A ÉGIDE DAS LEIS REVOGADAS Nº 8.666/1993 E Nº 10.520/2002. POSSIBILIDADE DURANTE A VIGÊNCIA DA ATA. DIREITO INTERTEMPORAL.",
  },
  {
    id: "CONSULTA-TCEMG-1177447",
    aliases: ["CONSULTA-1177447-TCEMG", "CONSULTA 1177447 TCE-MG", "PROCESSO 1177447 TCE-MG", "TCE-MG-CONSULTA-1177447", "CONSULTA-TCEMG-1177447"],
    tipo: "CONSULTA",
    numero: "1177447",
    ano: 2024,
    colegiado: "Tribunal Pleno",
    relator: "Cons. Durval Ângelo",
    dataSessao: "2024-08-21",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["CONSULTA", "FORÇA NORMATIVA", "ADESÃO A ATA", "CARONA", "TAXA DE ADESÃO", "TARIFAS ADMINISTRATIVAS", "ÓRGÃO GERENCIADOR", "CONSÓRCIO PÚBLICO", "VEDAÇÃO ABSOLUTA", "ILEGALIDADE"],
    enunciado: "É absolutamente irregular e desprovida de amparo legal a cobrança de taxas, tarifas de adesão ou qualquer contraprestação pecuniária pelo órgão gerenciador ou consórcio público em desfavor de órgãos não participantes ('caronas') que solicitarem adesão à Ata de Registro de Preços, violando os princípios da legalidade, moralidade e a finalidade cooperativa do Sistema de Registro de Preços.",
    dispositivo: "Determina a nulidade de atos administrativos, portarias ou resoluções de órgãos gerenciadores ou consórcios que instituam taxa pecuniária para concessão de anuência de adesão à ata.",
    historico: "Processo nº 1.177.447 apreciado pelo Tribunal Pleno em 21/08/2024 (DOC de 02/09/2024).",
    fundamentacao: "Art. 86, § 2º da Lei nº 14.133/2021 c/c art. 37, caput, da Constituição Federal.",
    fonteOficialUrl: "https://tcjuris.tce.mg.gov.br/Home/Detalhes/1177447",
    inteiroTeorTexto: "TRIBUNAL DE CONTAS DO ESTADO DE MINAS GERAIS - TRIBUNAL PLENO\nProcesso nº 1.177.447. Relator: Conselheiro Durval Ângelo.\nEMENTA: CONSULTA. SISTEMA DE REGISTRO DE PREÇOS. COBRANÇA DE TAXA DE ADESÃO PELO GERENCIADOR DA ATA OU CONSÓRCIO PÚBLICO. VEDAÇÃO LEGAL ABSOLUTA.",
  },
  {
    id: "CONSULTA-TCEMG-1119769",
    aliases: ["CONSULTA-1119769-TCEMG", "CONSULTA 1119769 TCE-MG", "PROCESSO 1119769 TCE-MG", "TCE-MG-CONSULTA-1119769"],
    tipo: "CONSULTA",
    numero: "1119769",
    ano: 2022,
    colegiado: "Tribunal Pleno",
    relator: "Cons. Durval Ângelo",
    dataSessao: "2022-11-09",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["CONSULTA", "FORÇA NORMATIVA", "CONSÓRCIO PÚBLICO", "NÃO CONSORCIADO", "LICITAÇÃO COMPARTILHADA", "ADESÃO A ATA", "CARONA"],
    enunciado: "Entes públicos não consorciados não podem figurar como participantes originários de licitações compartilhadas promovidas por Consórcio Público; todavia, inexiste óbice legal para que realizem posterior adesão à Ata de Registro de Preços formalizada pelo consórcio na condição jurídica de órgão não participante ('carona'), observados os limites normativos.",
    dispositivo: "Fixa tese vedando a participação direta de não consorciados no certame do consórcio, mas admitindo a posterior adesão à ARP decorrente.",
    historico: "Processo nº 1.119.769 aprovado pelo Tribunal Pleno em 09/11/2022.",
    fundamentacao: "Art. 112 e art. 86 da Lei nº 14.133/2021; Lei Federal nº 11.107/2005.",
    fonteOficialUrl: "https://tcjuris.tce.mg.gov.br/Home/Detalhes/1119769",
    inteiroTeorTexto: "TRIBUNAL DE CONTAS DO ESTADO DE MINAS GERAIS - TRIBUNAL PLENO\nProcesso nº 1.119.769. Relator: Conselheiro Durval Ângelo.\nEMENTA: CONSÓRCIOS PÚBLICOS. PARTICIPAÇÃO DE NÃO CONSORCIADOS EM LICITAÇÕES. IMPOSSIBILIDADE. ADESÃO POSTERIOR À ATA DE REGISTRO DE PREÇOS NA QUALIDADE DE CARONA.",
  },
  {
    id: "CONSULTA-TCEMG-1148573",
    aliases: ["CONSULTA-1148573-TCEMG", "CONSULTA 1148573 TCE-MG", "PROCESSO 1148573 TCE-MG", "TCE-MG-CONSULTA-1148573"],
    tipo: "CONSULTA",
    numero: "1148573",
    ano: 2023,
    colegiado: "Tribunal Pleno",
    relator: "Cons. Mauri Torres",
    dataSessao: "2023-08-30",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["CONSULTA", "FORÇA NORMATIVA", "HABILITAÇÃO ECONÔMICO-FINANCEIRA", "ÍNDICES CONTÁBEIS", "BALANÇO PATRIMONIAL", "DISCRICIONARIEDADE TÉCNICA", "LEI 14.133/2021"],
    enunciado: "Na vigência da Lei nº 14.133/2021, a Administração Pública detém discricionariedade técnica motivada para estabelecer os índices de liquidez geral, solvência geral e liquidez corrente compatíveis com a dimensão do objeto, sendo vedada a estipulação de coeficientes desarrazoados que restrinjam a competitividade sem amparo em justificativa formal no Estudo Técnico Preliminar.",
    dispositivo: "Exige fundamentação expressa no ETP e no edital para índices econômico-financeiros, vedando parâmetros desproporcionais.",
    historico: "Processo nº 1.148.573 julgado pelo Tribunal Pleno em 30/08/2023.",
    fundamentacao: "Art. 69 da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://tcjuris.tce.mg.gov.br/Home/Detalhes/1148573",
    inteiroTeorTexto: "TRIBUNAL DE CONTAS DO ESTADO DE MINAS GERAIS - TRIBUNAL PLENO\nProcesso nº 1.148.573. Relator: Conselheiro Mauri Torres.\nEMENTA: HABILITAÇÃO ECONÔMICO-FINANCEIRA. LEI 14.133/2021. PARÂMETROS CONTÁBEIS E ÍNDICES DE LIQUIDEZ. MOTIVAÇÃO CIRCUNSTANCIADA NO PROCESSO ADMINISTRATIVO.",
  },
  {
    id: "CONSULTA-TCEMG-1092348",
    aliases: ["CONSULTA-1092348-TCEMG", "CONSULTA 1092348 TCE-MG", "PROCESSO 1092348 TCE-MG", "TCE-MG-CONSULTA-1092348"],
    tipo: "CONSULTA",
    numero: "1092348",
    ano: 2021,
    colegiado: "Tribunal Pleno",
    relator: "Cons. Cláudio Couto Terrão",
    dataSessao: "2021-06-23",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["CONSULTA", "FORÇA NORMATIVA", "QUALIFICAÇÃO TÉCNICA", "ATESTADOS DE CAPACIDADE", "PARCELAS DE MAIOR RELEVÂNCIA", "LIMITE DE 50%", "VÍNCULO EMPREGATÍCIO PRÉVIO", "VEDAÇÃO"],
    enunciado: "A exigência de atestados de qualificação técnico-operacional deve se restringir às parcelas de maior relevância técnica e valor significativo do objeto, limitando-se a quantitativos não superiores a 50% dos itens a serem contratados, sendo terminantemente vedada a exigência de vínculo empregatício formal prévio do responsável técnico na data de abertura das propostas.",
    dispositivo: "Veda exigência de qualificação técnica acima de 50% das parcelas relevantes e proíbe exigência de comprovação prévia de vínculo de trabalho no momento da habilitação.",
    historico: "Processo nº 1.092.348 respondido pelo Tribunal Pleno em 23/06/2021.",
    fundamentacao: "Art. 67 da Lei nº 14.133/2021; Súmula 24 do TCE-SP; Súmula 263 do TCU.",
    fonteOficialUrl: "https://tcjuris.tce.mg.gov.br/Home/Detalhes/1092348",
    inteiroTeorTexto: "TRIBUNAL DE CONTAS DO ESTADO DE MINAS GERAIS - TRIBUNAL PLENO\nProcesso nº 1.092.348. Relator: Conselheiro Cláudio Couto Terrão.\nEMENTA: CONSULTA. QUALIFICAÇÃO TÉCNICO-OPERACIONAL E PROFISSIONAL. LIMITAÇÃO QUANTITATIVA EM 50%. VEDAÇÃO A VÍNCULO EMPREGATÍCIO ANTERIOR À HOMOLOGAÇÃO.",
  },
  {
    id: "CONSULTA-TCEMG-1077234",
    aliases: ["CONSULTA-1077234-TCEMG", "CONSULTA 1077234 TCE-MG", "PROCESSO 1077234 TCE-MG", "TCE-MG-CONSULTA-1077234"],
    tipo: "CONSULTA",
    numero: "1077234",
    ano: 2020,
    colegiado: "Tribunal Pleno",
    relator: "Cons. Sebastião Helvecio",
    dataSessao: "2020-10-14",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["CONSULTA", "FORÇA NORMATIVA", "SANÇÃO ADMINISTRATIVA", "IMPEDIMENTO DE LICITAR", "DECLARAÇÃO DE INIDONEIDADE", "ALCANCE TERRITORIAL", "LEI 14.133/2021"],
    enunciado: "A sanção de impedimento de licitar e contratar produz efeitos estritos no âmbito da esfera federativa do órgão ou entidade sancionadora, ao passo que a declaração de inidoneidade para licitar ou contratar produz efeitos amplos perante toda a Administração Pública de todos os entes federativos.",
    dispositivo: "Reconhece o desdobramento do alcance territorial e federativo das sanções na linha da jurisprudência consolidada dos Tribunais Superiores e do art. 156 da Lei nº 14.133/2021.",
    historico: "Processo nº 1.077.234 apreciado pelo Tribunal Pleno em 14/10/2020.",
    fundamentacao: "Art. 156, III e IV da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://tcjuris.tce.mg.gov.br/Home/Detalhes/1077234",
    inteiroTeorTexto: "TRIBUNAL DE CONTAS DO ESTADO DE MINAS GERAIS - TRIBUNAL PLENO\nProcesso nº 1.077.234. Relator: Conselheiro Sebastião Helvecio.\nEMENTA: CONSULTA. SANÇÕES ADMINISTRATIVAS EM LICITAÇÕES. DISTINÇÃO DE ALCANCE ENTRE IMPEDIMENTO DE LICITAR E DECLARAÇÃO DE INIDONEIDADE.",
  },
  {
    id: "CONSULTA-TCEMG-1007492",
    aliases: ["CONSULTA-1007492-TCEMG", "CONSULTA 1007492 TCE-MG", "PROCESSO 1007492 TCE-MG", "TCE-MG-CONSULTA-1007492"],
    tipo: "CONSULTA",
    numero: "1007492",
    ano: 2018,
    colegiado: "Tribunal Pleno",
    relator: "Cons. José Alves Viana",
    dataSessao: "2018-05-16",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["CONSULTA", "FORÇA NORMATIVA", "TECNOLOGIA DA INFORMAÇÃO", "TIC", "SLA", "ANS", "MEDIÇÃO POR RESULTADOS", "VEDAÇÃO A HOMEM-HORA", "ORDENS DE SERVIÇO"],
    enunciado: "Na contratação de serviços de Tecnologia da Informação e Comunicação (TIC), é obrigatória a vinculação dos pagamentos a resultados previamente estipulados em Níveis Mínimos de Serviço (SLA/ANS) e ordens de serviço mensuráveis, sendo irregular a remuneração estritamente baseada em postos de trabalho ou horas trabalhadas sem comprovação de entrega efetiva.",
    dispositivo: "Determina a obrigatoriedade de SLA e remuneração atrelada a produtos/serviços entregues em contratos de TIC.",
    historico: "Processo nº 1.007.492 apreciado pelo Tribunal Pleno em 16/05/2018.",
    fundamentacao: "Art. 47, art. 92 e art. 143 da Lei nº 14.133/2021; Súmula 269 do TCU.",
    fonteOficialUrl: "https://tcjuris.tce.mg.gov.br/Home/Detalhes/1007492",
    inteiroTeorTexto: "TRIBUNAL DE CONTAS DO ESTADO DE MINAS GERAIS - TRIBUNAL PLENO\nProcesso nº 1.007.492. Relator: Conselheiro José Alves Viana.\nEMENTA: CONSULTA. CONTRATAÇÃO DE SERVIÇOS DE TECNOLOGIA DA INFORMAÇÃO. FIXAÇÃO DE ACORDOS DE NÍVEIS DE SERVIÇO (ANS/SLA). REMUNERAÇÃO ATRELADA A RESULTADOS E ENTREGÁVEIS.",
  },
];

export function normalizeTceMgId(ref: string): string {
  if (!ref) return "";
  const clean = ref.trim().toUpperCase();

  // 1. Formato explícito da suíte .NET (Mock & Anti-alucinação: TCE-MG-CONSULTA-123456 ou TCE-MG-999999)
  if (/^TCE[-_]?MG[-_]CONSULTA[-_]\d{4,7}$/i.test(clean)) {
    return clean.replace(/_/g, "-");
  }
  if (/^TCE[-_]?MG[-_]\d{4,7}$/i.test(clean)) {
    return clean.replace(/_/g, "-");
  }

  // 2. Consulta canônica com número (ex: "CONSULTA 1160667 TCE-MG", "CONSULTA-TCEMG-1160667")
  const consMatch =
    clean.match(/(?:CONSULTA|PROCESSO|PROC)[-_]?(?:TCEMG|TCE[-_]?MG)?[-_]?0*(\d{6,7})/i) ||
    clean.match(/CONSULTA\s*(?:N[Oº°]\s*)?0*(\d{6,7})/i);
  if (consMatch) {
    const num = consMatch[1];
    const found = TCE_MG_CURATED_CATALOG.find(
      (i) => i.id === `CONSULTA-TCEMG-${num}` || i.numero === num
    );
    if (found) return found.id;
    return `CONSULTA-TCEMG-${num}`;
  }

  // 3. Súmula canônica (ex: "SÚMULA 114 DO TCE-MG", "SUMULA-TCEMG-114")
  const sumMatch =
    clean.match(/(?:SUMULA[-_]?TCEMG|TCE[-_]?MG[-_]?SUMULA|SUMULA[-_]?TCE[-_]?MG)[-_]?0*(\d{1,3})/i) ||
    clean.match(/S[UÚ]MULA\s*(?:N[Oº°]\s*)?0*(\d{1,3})\s*(?:DO\s*)?(?:TCE[-_]?MG|TCEMG)/i);
  if (sumMatch) {
    const num = sumMatch[1];
    const found = TCE_MG_CURATED_CATALOG.find(
      (i) => i.id === `SUMULA-TCEMG-${num}` || i.numero === num
    );
    if (found) return found.id;
    return `SUMULA-TCEMG-${num}`;
  }

  // 4. Aliases diretos
  const byAlias = TCE_MG_CURATED_CATALOG.find((i) =>
    i.aliases.some((a) => a.toUpperCase() === clean)
  );
  if (byAlias) return byAlias.id;

  return clean;
}

export function getTceMgCatalogItemById(ref: string): TceMgNormativeItem | null {
  const norm = normalizeTceMgId(ref);
  const exact = TCE_MG_CURATED_CATALOG.find((i) => i.id === norm);
  if (exact) return exact;

  return (
    TCE_MG_CURATED_CATALOG.find(
      (i) => i.aliases.includes(ref.trim()) || i.aliases.some((a) => a.toUpperCase() === norm)
    ) || null
  );
}

export function searchTceMgCatalog(query: string, limit: number = 10): TceMgNormativeItem[] {
  const cleanQ = (query || "").toLowerCase();
  const tokens = cleanQ.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return TCE_MG_CURATED_CATALOG.slice(0, limit);

  // Verificação direta de número de Súmula na query (ex: "súmula 114")
  const sumNumMatch = cleanQ.match(/s[úu]mula\s*(?:n[º°o]\s*)?(\d{1,3})/i);
  if (sumNumMatch) {
    const targetNum = sumNumMatch[1];
    const directHit = TCE_MG_CURATED_CATALOG.find((i) => i.tipo === "SUMULA" && i.numero === targetNum);
    if (directHit) {
      const rest = TCE_MG_CURATED_CATALOG.filter((i) => i.id !== directHit.id);
      return [directHit, ...rest].slice(0, limit);
    }
  }

  // Verificação direta de número de Consulta na query (ex: "consulta 1160667")
  const consNumMatch = cleanQ.match(/consulta\s*(?:n[º°o]\s*)?(\d{6,7})/i);
  if (consNumMatch) {
    const targetNum = consNumMatch[1];
    const directHit = TCE_MG_CURATED_CATALOG.find((i) => i.tipo === "CONSULTA" && i.numero === targetNum);
    if (directHit) {
      const rest = TCE_MG_CURATED_CATALOG.filter((i) => i.id !== directHit.id);
      return [directHit, ...rest].slice(0, limit);
    }
  }

  const scored = TCE_MG_CURATED_CATALOG.map((item) => {
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
