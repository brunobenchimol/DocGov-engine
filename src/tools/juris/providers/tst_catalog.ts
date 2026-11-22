// ============================================================================
// Catálogo Normativo Curado do Tribunal Superior do Trabalho (TST)
// Precedentes trabalhistas estruturantes da Administração Pública (Lei 5)
// ============================================================================

import type { RawJurisFetchResult, RawJurisSearchResult } from "../types.ts";

export interface TstCatalogItem {
  id: string;
  aliases: string[];
  numero: string;
  ano: number;
  colegiado: string;
  relator: string;
  dataSessao: string;
  indexacao: string;
  tese: string;
  dispositivo: string;
  fundamentacao: string;
  keywords: RegExp[];
}

export const TST_CURATED_CATALOG: TstCatalogItem[] = [
  {
    id: "SUMULA-TST-331",
    aliases: ["SUMULA-331-TST", "TST-SUMULA-331"],
    numero: "331",
    ano: 2011,
    colegiado: "Tribunal Pleno",
    relator: "Jurisprudência Consolidada TST",
    dataSessao: "2011-05-31",
    indexacao: "Súmula 331; Terceirização; Responsabilidade Subsidiária; Administração Pública; Culpa in Vigilando",
    tese:
      "Súmula nº 331 do TST (itens IV, V e VI): Os entes integrantes da Administração Pública direta e indireta respondem subsidiariamente, nas mesmas condições do item IV, caso evidenciada a sua conduta culposa no cumprimento das obrigações da Lei nº 8.666/1993 (e Lei nº 14.133/2021), especialmente na fiscalização do cumprimento das obrigações contratuais e legais da prestadora de serviço como empregadora. A aludida responsabilidade não decorre de mero inadimplemento das obrigações trabalhistas assumidas pela empresa regularmente contratada.",
    dispositivo:
      "Responsabilidade subsidiária da Administração Pública condicionada à comprovação de falha na fiscalização contratual (culpa in vigilando), abrangendo todas as verbas decorrentes da condenação referentes ao período da prestação laboral.",
    fundamentacao:
      "Nos termos da revisão promovida pela Resolução nº 174/2011 do TST em consonância com a ADC 16/STF, é lícita a terceirização de atividades-meio e serviços especializados, mas impõe-se ao ORGAO_CONTRATANTE o dever objetivo de fiscalizar o adimplemento dos encargos trabalhistas e previdenciários pela EMPRESA_CONTRATADA.",
    keywords: [/s[úu]mula\s*331/i, /terceiriza[çc]/i, /subsidi[áa]ria/i, /culpa\s+in\s+vigilando/i, /demo/i, /posto/i],
  },
  {
    id: "OJ-TST-SDI1-191",
    aliases: ["OJ-191-SDI1", "TST-OJ-191"],
    numero: "191",
    ano: 2017,
    colegiado: "SBDI-1",
    relator: "Jurisprudência Consolidada SBDI-1/TST",
    dataSessao: "2017-05-11",
    indexacao: "OJ 191 SDI-1; Dono da Obra; Empreitada; Construção Civil; Obras de Engenharia",
    tese:
      "Orientação Jurisprudencial nº 191 da SBDI-1/TST: Diante da inexistência de previsão legal específica, o contrato de empreitada de construção civil entre o dono da obra e o empreiteiro não enseja responsabilidade solidária ou subsidiária nas obrigações trabalhistas contraídas pelo empreiteiro, salvo sendo o dono da obra uma empresa construtora ou incorporadora.",
    dispositivo:
      "Afastamento da responsabilidade subsidiária ou solidária do ente público contratante quando figurar estritamente como dono da obra em contrato de empreitada de obra certa de construção civil.",
    fundamentacao:
      "Consolidado no julgamento do IRR-190-53.2015.5.03.0090 pela SBDI-1 do TST: quando o ORGAO_CONTRATANTE não atua no ramo de construção civil ou incorporação imobiliária, o contrato de empreitada afasta a aplicação analógica da Súmula 331 do TST.",
    keywords: [/oj\s*191/i, /dono\s+da\s+obra/i, /empreitada/i, /constru[çc][aã]o\s+civil/i, /engenharia/i],
  },
  {
    id: "SUMULA-TST-363",
    aliases: ["SUMULA-363-TST", "TST-SUMULA-363"],
    numero: "363",
    ano: 2003,
    colegiado: "Tribunal Pleno",
    relator: "Jurisprudência Consolidada TST",
    dataSessao: "2003-11-21",
    indexacao: "Súmula 363; Contrato Nulo; Concurso Público; FGTS; Saldo de Salários",
    tese:
      "Súmula nº 363 do TST: A contratação de servidor público, após a CF/1988, sem prévia aprovação em concurso público, encontra óbice no respectivo art. 37, II e § 2º, somente lhe conferindo direito ao pagamento da contraprestação pactuada, em relação ao número de horas trabalhadas, respeitado o valor da hora do salário mínimo, e dos valores referentes aos depósitos do FGTS.",
    dispositivo:
      "Limitação dos efeitos patrimoniais em caso de reconhecimento de vínculo nulo com a Administração Pública direta ou indireta ao saldo salarial estrito e depósitos de FGTS.",
    fundamentacao:
      "Proteção ao art. 37, II e § 2º, da Constituição Federal, impedindo a convalidação de contratações irregulares ou equiparações remuneratórias sem concurso público em contratos administrativos.",
    keywords: [/s[úu]mula\s*363/i, /contrato\s+nulo/i, /concurso\s+p[úu]blico/i, /fgts/i],
  },
  {
    id: "TST-TEMA-246-TERCEIRIZACAO",
    aliases: ["TEMA-246-TST", "TST-ADC-16"],
    numero: "246",
    ano: 2017,
    colegiado: "SBDI-1 / STF Repercussão Geral",
    relator: "Precedente Vinculante (Tema 246 / ADC 16)",
    dataSessao: "2017-04-26",
    indexacao: "Tema 246; ADC 16; RE 760.931; Vedação de Transferência Automática; Lei 8.666 Art. 71",
    tese:
      "Tese do Tema 246 de Repercussão Geral aplicada pelo TST: O inadimplemento dos encargos trabalhistas dos empregados do contratado não transfere automaticamente ao Poder Público contratante a responsabilidade pelo seu pagamento, seja em caráter solidário ou subsidiário, nos termos do art. 71, § 1º, da Lei nº 8.666/1993 (e art. 121, § 2º, da Lei nº 14.133/2021).",
    dispositivo:
      "Proibição de responsabilização objetiva ou automática do ente público ou estatal contratante pelo mero inadimplemento da empresa terceirizada.",
    fundamentacao:
      "Em estrita observância à decisão vinculante do STF na ADC 16 e no RE 760.931 (Tema 246), as Turmas e a SBDI-1 do TST exigem demonstração concreta de omissão culposa na fiscalização contratual (ex.: ausência de retenção em Conta Vinculada, falta de conferência de FGTS/INSS ou descumprimento de rotinas da IN SEGES 05/2017).",
    keywords: [/tema\s*246/i, /adc\s*16/i, /760\.?931/i, /transfer[êe]ncia\s+autom[áa]tica/i, /responsabilidade/i],
  },
  {
    id: "TST-TEMA-1118-ONUS-PROVA",
    aliases: ["TEMA-1118-TST", "TST-TEMA-1118"],
    numero: "1118",
    ano: 2025,
    colegiado: "SBDI-1 / STF Repercussão Geral",
    relator: "Precedente Vinculante (Tema 1.118 / RE 1.298.647)",
    dataSessao: "2025-02-13",
    indexacao: "Tema 1118; RE 1.298.647; Ônus da Prova; Fiscalização; Terceirização; Culpa in Vigilando",
    tese:
      "Tese do Tema 1.118 de Repercussão Geral aplicada no TST: Não há responsabilidade subsidiária da Administração Pública por encargos trabalhistas gerados pelo inadimplemento de empresa prestadora de serviços contratada, se não houver comprovação nos autos de comportamento sistematicamente negligente do ente público ou estatal na fiscalização do contrato.",
    dispositivo:
      "A comprovação da falha sistemática na fiscalização incumbe à parte reclamante, exigindo do ORGAO_CONTRATANTE manutenção de dossiê documental regular da execução (guias, certidões e notificações contratuais).",
    fundamentacao:
      "Diretriz decisiva para contratos com Dedicação Exclusiva de Mão de Obra (DEMO): a fiscalização tempestiva documentada por meio de Conta Vinculada, Fato Gerador, glosas e notificações formais afasta a caracterização de culpa in vigilando.",
    keywords: [/tema\s*1\.?118/i, /1\.?298\.?647/i, /[ôo]nus\s+da\s+prova/i, /fiscaliza[çc][aã]o/i, /terceiriza/i, /demo/i],
  },
];

export function normalizeTstCatalogId(idOrRef: string): string {
  const upper = idOrRef.trim().toUpperCase();
  if (/S[ÚU]MULA\s*(?:N[º°O]\s*)?331/.test(upper) || upper.includes("SUMULA-TST-331")) {
    return "SUMULA-TST-331";
  }
  if (/OJ\s*(?:N[º°O]\s*)?191/.test(upper) || upper.includes("OJ-TST-SDI1-191")) {
    return "OJ-TST-SDI1-191";
  }
  if (/S[ÚU]MULA\s*(?:N[º°O]\s*)?363/.test(upper) || upper.includes("SUMULA-TST-363")) {
    return "SUMULA-TST-363";
  }
  if (/TEMA\s*246/.test(upper) || upper.includes("TST-TEMA-246")) {
    return "TST-TEMA-246-TERCEIRIZACAO";
  }
  if (/TEMA\s*1\.?118/.test(upper) || upper.includes("TST-TEMA-1118")) {
    return "TST-TEMA-1118-ONUS-PROVA";
  }
  return upper;
}

export function getTstCatalogItemById(idOrRef: string): TstCatalogItem | undefined {
  const norm = normalizeTstCatalogId(idOrRef);
  return TST_CURATED_CATALOG.find(
    (item) => item.id === norm || item.aliases.includes(norm)
  );
}

export function searchTstCatalog(query: string, limit: number = 10): RawJurisSearchResult[] {
  const scored = TST_CURATED_CATALOG.map((item) => {
    let score = 0;
    for (const rx of item.keywords) {
      if (rx.test(query)) score += 20;
    }
    if (/administra[çc][aã]o\s+p[úu]blica|terceiriza|trabalh|encargo/i.test(query)) {
      score += 5;
    }
    return { item, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const selected =
    scored.length > 0
      ? scored.slice(0, limit).map((e) => e.item)
      : TST_CURATED_CATALOG.slice(0, Math.min(limit, 3));

  return selected.map((item) => ({
    id: item.id,
    court: "TST",
    colegiado: item.colegiado,
    numero: item.numero,
    ano: item.ano,
    processo: item.id,
    relator: item.relator,
    dataSessao: item.dataSessao,
    entidade: "ORGAO_CONTRATANTE",
    indexacao: item.indexacao,
    tese: item.tese,
    dispositivo: item.dispositivo,
    origin: "CURATED_CATALOG",
    rawPayload: { curated: true, ...item },
  }));
}

export function mapTstCatalogItemToFetch(item: TstCatalogItem): RawJurisFetchResult {
  return {
    id: item.id,
    court: "TST",
    exists: true,
    source: "CURATED_CATALOG",
    rawTextOrJson: {
      id: item.id,
      tribunal: "TST",
      numero: item.numero,
      ano: item.ano,
      processo: item.id,
      colegiado: item.colegiado,
      relator: item.relator,
      dataSessao: item.dataSessao,
      entidade: "ORGAO_CONTRATANTE",
      indexacao: item.indexacao,
      ementa: item.tese,
      tese: item.tese,
      relatorio: `Precedente normativo consolidado do TST (${item.id} — ${item.colegiado}).`,
      voto: item.fundamentacao,
      acordao: item.dispositivo,
      dispositivo: item.dispositivo,
      inteiroTeorTexto: `${item.tese}\n\n${item.fundamentacao}\n\n${item.dispositivo}`,
      rawText: `${item.tese}\n\n${item.fundamentacao}\n\n${item.dispositivo}`,
    },
  };
}
