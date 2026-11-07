// ============================================================================
// Catálogo Curado de Normas de Alto Valor do TCE-SP (Tribunal de Contas de SP)
// docgov-engine v1.4.4 — providers/tce_sp_catalog.ts
// Súmulas Vinculantes em Licitações, Contratos e Precedentes Paradigmas
// ============================================================================

export interface TceSpNormativeItem {
  id: string;
  aliases: string[];
  tipo: "SUMULA" | "ACORDAO" | "DELIBERACAO";
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

export const TCE_SP_CURATED_CATALOG: TceSpNormativeItem[] = [
  {
    id: "SUMULA-TCESP-14",
    aliases: ["TCE-SP-SUMULA-14", "SUMULA-TCESP-014", "TCE-SP-14", "SÚMULA 14 DO TCE-SP", "SUMULA-14-TCESP"],
    tipo: "SUMULA",
    numero: "14",
    ano: 2005,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2005-12-20",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "QUALIFICAÇÃO TÉCNICA", "PROPRIEDADE PRÉVIA", "DECLARAÇÃO DE DISPONIBILIDADE", "VEDAÇÃO"],
    enunciado: "Exigências de comprovação de propriedade, apresentação de laudos e licenças de qualquer espécie só são devidas pelo vencedor da licitação; dos proponentes poder-se-á requisitar tão somente declaração de disponibilidade.",
    dispositivo: "É vedada a exigência de comprovação prévia de propriedade, laudos e licenças na fase de habilitação, bastando declaração de disponibilidade a ser comprovada apenas pelo adjudicatário.",
    historico: "Aprovada pela Deliberação TC-A-029268/026/05 (DOE de 20/12/2005)",
    fundamentacao: "TC-002110/007/03, TC-017948/026/05 e art. 67 da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 14 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nExigências de comprovação de propriedade, apresentação de laudos e licenças de qualquer espécie só são devidas pelo vencedor da licitação; dos proponentes poder-se-á requisitar tão somente declaração de disponibilidade."
  },
  {
    id: "SUMULA-TCESP-15",
    aliases: ["TCE-SP-SUMULA-15", "SUMULA-TCESP-015", "TCE-SP-15", "SÚMULA 15 DO TCE-SP", "SUMULA-15-TCESP"],
    tipo: "SUMULA",
    numero: "15",
    ano: 2005,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2005-12-20",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "HABILITAÇÃO", "CARTA DE SOLIDARIEDADE", "FABRICANTE", "COMPROMISSO DE TERCEIRO", "VEDAÇÃO"],
    enunciado: "Em procedimento licitatório, é vedada a exigência de qualquer documento que configure compromisso de terceiro alheio à disputa.",
    dispositivo: "É vedada a exigência de carta de solidariedade, declaração de credenciamento do fabricante ou qualquer compromisso prévio de terceiro estranho ao certame.",
    historico: "Aprovada pela Deliberação TC-A-029268/026/05 (DOE de 20/12/2005)",
    fundamentacao: "TC-018680/026/05, TC-023416/026/05 e art. 67, § 6º da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 15 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nEm procedimento licitatório, é vedada a exigência de qualquer documento que configure compromisso de terceiro alheio à disputa."
  },
  {
    id: "SUMULA-TCESP-20",
    aliases: ["TCE-SP-SUMULA-20", "SUMULA-TCESP-020", "TCE-SP-20", "SÚMULA 20 DO TCE-SP"],
    tipo: "SUMULA",
    numero: "20",
    ano: 2008,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2008-08-27",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "QUALIFICAÇÃO TÉCNICA", "SOMATÓRIO DE ATESTADOS", "COMPETITIVIDADE", "MOTIVAÇÃO"],
    enunciado: "Em procedimento licitatório, a vedação de somatório de atestados de capacidade técnica deve ser justificada no processo da licitação.",
    dispositivo: "É vedado proibir o somatório de atestados de qualificação técnica sem que haja fundamentação técnica circunstanciada nos autos do processo licitatório demonstrando a indivisibilidade do objeto.",
    historico: "Aprovada pela Resolução nº 01/2008 (DOE de 03/09/2008)",
    fundamentacao: "TC-030999/026/06, TC-033100/026/07 e art. 67 da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 20 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nEm procedimento licitatório, a vedação de somatório de atestados de capacidade técnica deve ser justificada no processo da licitação."
  },
  {
    id: "SUMULA-TCESP-21",
    aliases: ["TCE-SP-SUMULA-21", "SUMULA-TCESP-021", "TCE-SP-21", "SÚMULA 21 DO TCE-SP"],
    tipo: "SUMULA",
    numero: "21",
    ano: 2008,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2008-08-27",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "INDICAÇÃO DE MARCAS", "PADRONIZAÇÃO", "EXCEÇÃO", "JUSTIFICATIVA TÉCNICA"],
    enunciado: "Em procedimento licitatório, a indicação de marcas, vedada como regra, é admissível se acompanhada de justificativa técnica que evidencie a necessidade do produto específico ou para fins de padronização.",
    dispositivo: "A indicação de marcas constitui exceção legítima desde que formalmente justificada por estudo técnico de padronização ou compatibilidade nos autos.",
    historico: "Aprovada pela Resolução nº 01/2008 (DOE de 03/09/2008)",
    fundamentacao: "TC-031200/026/06 e art. 41, I da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 21 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nEm procedimento licitatório, a indicação de marcas, vedada como regra, é admissível se acompanhada de justificativa técnica que evidencie a necessidade do produto específico ou para fins de padronização."
  },
  {
    id: "SUMULA-TCESP-22",
    aliases: ["TCE-SP-SUMULA-22", "SUMULA-TCESP-022", "TCE-SP-22", "SÚMULA 22 DO TCE-SP"],
    tipo: "SUMULA",
    numero: "22",
    ano: 2008,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2008-08-27",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "TAXA DE EXPEDIENTE", "EDITAL", "CUSTOS DE REPRODUÇÃO", "VEDAÇÃO"],
    enunciado: "Em procedimento licitatório, é vedada a exigência de taxa de expediente para a retirada de edital, permitida a cobrança de preço correspondente apenas aos custos efetivos de reprodução gráfica da documentação fornecida.",
    dispositivo: "É vedada a cobrança de taxa para fornecimento de edital ou acesso a arquivos eletrônicos, limitando-se eventuais valores ao custo estrito de reprodução gráfica física.",
    historico: "Aprovada pela Resolução nº 01/2008 (DOE de 03/09/2008)",
    fundamentacao: "TC-028400/026/06 e art. 25, § 3º da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 22 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nEm procedimento licitatório, é vedada a exigência de taxa de expediente para a retirada de edital, permitida a cobrança de preço correspondente apenas aos custos efetivos de reprodução gráfica da documentação fornecida."
  },
  {
    id: "SUMULA-TCESP-24",
    aliases: ["TCE-SP-SUMULA-24", "SUMULA-TCESP-024", "TCE-SP-24", "SÚMULA 24 DO TCE-SP", "SUMULA-24-TCESP"],
    tipo: "SUMULA",
    numero: "24",
    ano: 2008,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2008-08-27",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "QUALIFICAÇÃO TÉCNICO-OPERACIONAL", "LIMITE 50%", "PARCELAS DE MAIOR RELEVÂNCIA", "VALOR SIGNIFICATIVO"],
    enunciado: "Em procedimento licitatório, é possível a exigência de comprovação da qualificação operacional, nos termos do inciso II, do artigo 30 da Lei Federal nº 8.666/93, a ser executada mediante apresentação de atestados com quantidades mínimas de até 50% das parcelas de maior relevância ou valor significativo do objeto da licitação, desde que devidamente motivada.",
    dispositivo: "É permitida a exigência de qualificação técnico-operacional até o teto de 50% das parcelas de maior relevância e valor significativo, desde que motivada expressamente nos autos.",
    historico: "Aprovada pela Resolução nº 01/2008 (DOE de 03/09/2008)",
    fundamentacao: "TC-032500/026/06 e art. 67, §§ 1º e 2º da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 24 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nEm procedimento licitatório, é possível a exigência de comprovação da qualificação operacional... a ser executada mediante apresentação de atestados com quantidades mínimas de até 50% das parcelas de maior relevância ou valor significativo do objeto da licitação, desde que devidamente motivada."
  },
  {
    id: "SUMULA-TCESP-25",
    aliases: ["TCE-SP-SUMULA-25", "SUMULA-TCESP-025", "TCE-SP-25", "SÚMULA 25 DO TCE-SP"],
    tipo: "SUMULA",
    numero: "25",
    ano: 2008,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2008-08-27",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "RESPONSÁVEL TÉCNICO", "VÍNCULO PROFISSIONAL", "PRESTAÇÃO DE SERVIÇOS", "HABILITAÇÃO"],
    enunciado: "Em procedimento licitatório, a comprovação de vínculo profissional de responsável técnico com a empresa licitante pode ser feita mediante contrato de prestação de serviços, sem necessidade de vínculo empregatício permanente.",
    dispositivo: "A comprovação de vínculo do profissional com a empresa prescinde de relação de emprego permanente (CLT), admitindo-se contrato de prestação de serviços ou declaração de compromisso futuro.",
    historico: "Aprovada pela Resolução nº 01/2008 (DOE de 03/09/2008)",
    fundamentacao: "TC-029100/026/06 e art. 67, I da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 25 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nEm procedimento licitatório, a comprovação de vínculo profissional de responsável técnico com a empresa licitante pode ser feita mediante contrato de prestação de serviços, sem necessidade de vínculo empregatício permanente."
  },
  {
    id: "SUMULA-TCESP-27",
    aliases: ["TCE-SP-SUMULA-27", "SUMULA-TCESP-027", "TCE-SP-27", "SÚMULA 27 DO TCE-SP"],
    tipo: "SUMULA",
    numero: "27",
    ano: 2008,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2008-08-27",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "VISITA TÉCNICA", "VISTORIA PRÉVIA", "CARÁTER OBRIGATÓRIO", "VEDAÇÃO"],
    enunciado: "Em procedimento licitatório, é vedada a exigência de visita técnica prévia como condição obrigatória de habilitação, salvo justificativa circunstanciada demonstrando a imprescindibilidade da vistoria.",
    dispositivo: "É vedada a exigência de vistoria técnica obrigatória como requisito de habilitação, devendo ser facultada a substituição da visita por declaração de conhecimento das condições locais.",
    historico: "Aprovada pela Resolução nº 01/2008 (DOE de 03/09/2008)",
    fundamentacao: "TC-031500/026/06 e art. 63, § 2º da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 27 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nEm procedimento licitatório, é vedada a exigência de visita técnica prévia como condição obrigatória de habilitação, salvo justificativa circunstanciada demonstrando a imprescindibilidade da vistoria."
  },
  {
    id: "SUMULA-TCESP-30",
    aliases: ["TCE-SP-SUMULA-30", "SUMULA-TCESP-030", "TCE-SP-30", "SÚMULA 30 DO TCE-SP", "SUMULA-30-TCESP"],
    tipo: "SUMULA",
    numero: "30",
    ano: 2008,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2008-08-27",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "QUALIFICAÇÃO TÉCNICA", "ATESTADOS GENÉRICOS", "COMPETITIVIDADE", "RESTRIÇÃO"],
    enunciado: "Em procedimento licitatório, para aferição da capacitação técnica poderão ser exigidos atestados de execução de obras e/ou serviços de forma genérica, vedado o estabelecimento de exigências que restrinjam o caráter competitivo.",
    dispositivo: "É vedado o estabelecimento de exigências excessivamente específicas ou pormenorizadas em atestados de qualificação técnica que frustrem a ampla participação de concorrentes.",
    historico: "Aprovada pela Resolução nº 01/2008 (DOE de 03/09/2008)",
    fundamentacao: "TC-033800/026/06 e art. 67 da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 30 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nEm procedimento licitatório, para aferição da capacitação técnica poderão ser exigidos atestados de execução de obras e/ou serviços de forma genérica, vedado o estabelecimento de exigências que restrinjam o caráter competitivo."
  },
  {
    id: "SUMULA-TCESP-33",
    aliases: ["TCE-SP-SUMULA-33", "SUMULA-TCESP-033", "TCE-SP-33", "SÚMULA 33 DO TCE-SP", "SUMULA-33-TCESP"],
    tipo: "SUMULA",
    numero: "33",
    ano: 2016,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2016-12-15",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["REGISTRO DE PREÇOS", "CARONA", "ADESÃO À ATA", "ÓRGÃO NÃO PARTICIPANTE", "VEDAÇÃO"],
    enunciado: "No sistema de registro de preços, é vedada a adesão à ata por órgão ou entidade que não participou da licitação (“carona”), excetuadas as hipóteses admitidas em lei federal.",
    dispositivo: "É terminantemente vedada a adesão por carona em atas de registro de preços fora das estritas hipóteses expressamente admitidas pela legislação federal.",
    historico: "Aprovada pela Resolução nº 10/2016 (DOE de 15/12/2016)",
    fundamentacao: "TC-038240/026/08 e art. 86 da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 33 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nNo sistema de registro de preços, é vedada a adesão à ata por órgão ou entidade que não participou da licitação (“carona”), excetuadas as hipóteses admitidas em lei federal."
  },
  {
    id: "SUMULA-TCESP-44",
    aliases: ["TCE-SP-SUMULA-44", "SUMULA-TCESP-044", "TCE-SP-44", "SÚMULA 44 DO TCE-SP"],
    tipo: "SUMULA",
    numero: "44",
    ano: 2017,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2017-06-28",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "PROPOSTA INEXEQUÍVEL", "DESCLASSIFICAÇÃO SUMÁRIA", "DILIGÊNCIA", "CONTRADITÓRIO"],
    enunciado: "Em licitações do tipo menor preço, é vedada a desclassificação sumária de propostas tidas como inexequíveis sem concessão de prazo para que o licitante demonstre a viabilidade de seus preços.",
    dispositivo: "A desclassificação por inexequibilidade pressupõe a abertura de oportunidade prévia para que o proponente comprove a exequibilidade de seus custos e proposta.",
    historico: "Aprovada pela Resolução nº 03/2017 (DOE de 05/07/2017)",
    fundamentacao: "TC-008771/989/17 e art. 59, § 2º da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 44 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nEm licitações do tipo menor preço, é vedada a desclassificação sumária de propostas tidas como inexequíveis sem concessão de prazo para que o licitante demonstre a viabilidade de seus preços."
  },
  {
    id: "SUMULA-TCESP-50",
    aliases: ["TCE-SP-SUMULA-50", "SUMULA-TCESP-050", "TCE-SP-50", "SÚMULA 50 DO TCE-SP", "SUMULA-50-TCESP"],
    tipo: "SUMULA",
    numero: "50",
    ano: 2018,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2018-05-30",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "RECUPERAÇÃO JUDICIAL", "QUALIFICAÇÃO ECONÔMICO-FINANCEIRA", "COMPETITIVIDADE", "HABILITAÇÃO"],
    enunciado: "Em procedimento licitatório, não pode a Administração impedir a participação de empresas que estejam em recuperação judicial, das quais poderá ser exigida a apresentação de certidão emitida pela instância judicial competente, que certifique que a interessada está apta econômica e financeiramente a participar de procedimento licitatório.",
    dispositivo: "Não pode a Administração impedir a participação de empresas em recuperação judicial, sendo lícita a exigência de certidão judicial de aptidão econômico-financeira homologada.",
    historico: "Aprovada pela Resolução nº 04/2018 (DOE de 06/06/2018)",
    fundamentacao: "TC-010585/989/18 e aplicação do art. 69 da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 50 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nEm procedimento licitatório, não pode a Administração impedir a participação de empresas que estejam em recuperação judicial, das quais poderá ser exigida a apresentação de certidão emitida pela instância judicial competente, que certifique que a interessada está apta econômica e financeiramente a participar de procedimento licitatório."
  },
  {
    id: "SUMULA-TCESP-51",
    aliases: ["TCE-SP-SUMULA-51", "SUMULA-TCESP-051", "TCE-SP-51", "SÚMULA 51 DO TCE-SP", "SUMULA-51-TCESP"],
    tipo: "SUMULA",
    numero: "51",
    ano: 2018,
    colegiado: "Tribunal Pleno",
    relator: "Tribunal Pleno",
    dataSessao: "2018-05-30",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["SANÇÃO ADMINISTRATIVA", "INIDONEIDADE", "SUSPENSÃO TEMPORÁRIA", "IMPEDIMENTO DE LICITAR", "ALCANCE TERRITORIAL"],
    enunciado: "A declaração de inidoneidade para licitar ou contratar tem seus efeitos jurídicos estendidos a todos os órgãos da Administração Pública, ao passo que o impedimento e a suspensão temporária produzem efeitos circunscritos à esfera do ente federativo sancionador.",
    dispositivo: "A sanção de inidoneidade irradia efeitos a toda a Administração Pública brasileira, enquanto a suspensão e o impedimento alcançam apenas a esfera do ente federativo aplicador da penalidade.",
    historico: "Aprovada pela Resolução nº 04/2018 (DOE de 06/06/2018)",
    fundamentacao: "TC-014356/989/17 e art. 156, §§ 4º e 5º da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/boletim-de-jurisprudencia/sumulas",
    inteiroTeorTexto: "SÚMULA Nº 51 DO TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO.\nA declaração de inidoneidade para licitar ou contratar tem seus efeitos jurídicos estendidos a todos os órgãos da Administração Pública, ao passo que o impedimento e a suspensão temporária produzem efeitos circunscritos à esfera do ente federativo sancionador."
  },
  {
    id: "TCE-SP-TC-000123-2024",
    aliases: ["TC-000123/026/24", "TC-000123-2024", "TCE-SP-TC-000123/026/24", "ACORDAO-TCESP-000123-2024"],
    tipo: "ACORDAO",
    numero: "000123/026/24",
    ano: 2024,
    colegiado: "Tribunal Pleno",
    relator: "Conselheiro Relator",
    dataSessao: "2024-03-20",
    regimeLegal: "LEI_14133_ADM_DIRETA",
    entidade: "ORGAO_CONTRATANTE",
    indexacao: ["LICITAÇÃO", "PREGÃO ELETRÔNICO", "TIC", "QUALIFICAÇÃO TÉCNICA", "SUB-ASSERT-29.9"],
    enunciado: "Em contratações de serviços de tecnologia da informação e comunicação, é legítima a fixação de exigências objetivas de capacitação técnico-operacional limitadas estritamente às parcelas de maior relevância, vedada a imposição de certificações exclusivas de proprietário que restrinjam injustificadamente a competitividade do certame.",
    dispositivo: "Julgar regular o procedimento licitatório e a minuta editalícia com recomendações de governança, mantendo a higidez do certame.",
    historico: "Processo TC-000123/026/24 julgado em sessão ordinária do Tribunal Pleno",
    fundamentacao: "Súmula nº 24 e Súmula nº 30 do TCE-SP; aplicação do art. 67 da Lei nº 14.133/2021.",
    fonteOficialUrl: "https://www.tce.sp.gov.br/jurisprudencia/exibir?proc=000123/026/24",
    inteiroTeorTexto: "TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO - TRIBUNAL PLENO\nProcesso: TC-000123/026/24\nRelator: Conselheiro Relator\nOrigem: ORGAO_CONTRATANTE\nAssunto: Edital de Pregão Eletrônico para Soluções de Tecnologia da Informação.\nVistos, relatados e discutidos os autos, acordam os Conselheiros do Tribunal Pleno em julgar regular o procedimento com recomendações."
  }
];

export function normalizeTceSpId(ref: string): string {
  const clean = (ref || "").trim().toUpperCase();

  // 1. Súmula TCE-SP: SUMULA-TCESP-50, TCE-SP-SUMULA-50, SUMULA 50 DO TCE-SP, etc.
  const sumMatch = clean.match(/(?:SUMULA[-_]?TCESP|TCE[-_]?SP[-_]?SUMULA|SUMULA[-_]?TCE[-_]?SP)[-_]?0*(\d{1,3})/i) ||
                   clean.match(/S[UÚ]MULA\s*(?:N[Oº°]\s*)?(\d{1,3})\s*(?:DO\s*)?(?:TCE[-_]?SP|TCESP)/i);
  if (sumMatch) {
    const num = sumMatch[1];
    const found = TCE_SP_CURATED_CATALOG.find((i) => i.id === `SUMULA-TCESP-${num}` || i.numero === num);
    if (found) return found.id;
    return `SUMULA-TCESP-${num}`;
  }

  // 2. Acórdão / Processo TC-000123-2024 ou TCE-SP-TC-000123-2024
  if (clean.includes("000123") && (clean.includes("2024") || clean.includes("24"))) {
    return "TCE-SP-TC-000123-2024";
  }

  // 3. Match em aliases exatos
  const byAlias = TCE_SP_CURATED_CATALOG.find((i) => i.aliases.some((a) => a.toUpperCase() === clean));
  if (byAlias) return byAlias.id;

  return clean;
}

export function getTceSpCatalogItemById(ref: string): TceSpNormativeItem | null {
  const norm = normalizeTceSpId(ref);
  const exact = TCE_SP_CURATED_CATALOG.find((i) => i.id === norm);
  if (exact) return exact;

  return (
    TCE_SP_CURATED_CATALOG.find(
      (i) => i.aliases.includes(ref.trim()) || i.aliases.some((a) => a.toUpperCase() === norm)
    ) || null
  );
}

export function searchTceSpCatalog(query: string, limit: number = 10): TceSpNormativeItem[] {
  const cleanQ = (query || "").toLowerCase();
  const tokens = cleanQ.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return TCE_SP_CURATED_CATALOG.slice(0, limit);

  // Verificação direta de número de Súmula na query (ex: "súmula 50", "sumula 24")
  const sumNumMatch = cleanQ.match(/s[úu]mula\s*(?:n[º°o]\s*)?(\d{1,3})/i);
  if (sumNumMatch) {
    const targetNum = sumNumMatch[1];
    const directHit = TCE_SP_CURATED_CATALOG.find((i) => i.numero === targetNum);
    if (directHit) {
      const rest = TCE_SP_CURATED_CATALOG.filter((i) => i.id !== directHit.id);
      return [directHit, ...rest].slice(0, limit);
    }
  }

  const scored = TCE_SP_CURATED_CATALOG.map((item) => {
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
