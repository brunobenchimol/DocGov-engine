// ============================================================================
// Humanizador Jurídico-Pericial & Formatador pt-BR: Eixo TIC & ACT (Gen6)
// docgov-engine v1.6.1 — src/bidding/bidding_legal_humanizer.ts
// ============================================================================

import type { BiddingProposalDossier } from "./types.ts";

export interface BiddingTagLegalProse {
  title: string;
  legalBasis: string;
  factualAnalysis: string;
  recommendation: string;
}

export function isLei13303Regime(regime?: string): boolean {
  const norm = (regime || "").trim().toUpperCase();
  return norm.includes("13303") || norm.includes("13.303") || norm.includes("ESTATAL");
}

export function formatLegalRegime(regime?: string): string {
  if (isLei13303Regime(regime)) {
    return "Lei Federal nº 13.303/2016 (Estatuto Jurídico das Empresas Estatais e RILC)";
  }
  return "Lei Federal nº 14.133/2021 (Nova Lei de Licitações e Contratos Administrativos)";
}

export function formatShortLegalRegime(regime?: string): string {
  return isLei13303Regime(regime) ? "Lei nº 13.303/2016" : "Lei nº 14.133/2021";
}

export function formatNumberBR(value?: number | null, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Não informado";
  }
  const num = Number(value);
  const sign = num < 0 ? "-" : "";
  const fixed = Math.abs(num).toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimals > 0 ? `${sign}${grouped},${decPart}` : `${sign}${grouped}`;
}

export function formatBRL(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(Number(value)) || Number(value) <= 0) {
    return "Não informado";
  }
  return `R$ ${formatNumberBR(value, 2)}`;
}

export function formatBRLAllowZero(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Não informado";
  }
  return `R$ ${formatNumberBR(value, 2)}`;
}

export function formatPercentBR(value?: number | null, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Não informado";
  }
  return `${formatNumberBR(value, decimals)}%`;
}

export function formatIndexBR(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Não informado no balanço";
  }
  return formatNumberBR(value, 2);
}

export function formatDateBR(raw?: string): string {
  if (!raw || !raw.trim()) return "Não informada";
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return raw.trim();
}

export function formatProposalDecision(decision: string): string {
  switch (decision) {
    case "APPROVED":
      return "Aprovada e Habilitada para Prosseguimento do Certame";
    case "DILIGENCE_REQUIRED":
      return "Suspensa para Diligência Saneadora Obrigatória (Rito da Súmula TCU nº 262 / Art. 64 da Lei nº 14.133/2021)";
    case "REJECTED":
      return "Reprovada / Inabilitada por Óbice Normativo ou Indício Forense Bloqueante";
    default:
      return decision;
  }
}

export function formatDossierStatus(status: string): string {
  switch (status) {
    case "success":
      return "Regular e Conforme";
    case "warning":
      return "Em Diligência Obrigatória / Alerta Preventivo";
    case "blocked":
      return "Bloqueada por Inconformidade Técnica, Financeira ou Forense";
    default:
      return status;
  }
}

export function formatEvaluationStance(stance: string): string {
  if (stance === "ATTACK") {
    return "Impugnativa / Fiscalizatória (Controle Crítico e Contraditório Técnico)";
  }
  return "Defensiva / Saneadora (Segurança Jurídica do Julgamento e Conservação da Competitividade)";
}

export function formatMetricFullName(metric?: string): string {
  const m = (metric || "UST").trim().toUpperCase();
  const map: Record<string, string> = {
    UST: "Unidade de Serviço Técnico (UST)",
    USM: "Unidade de Serviço de Monitoramento (USM)",
    UNS: "Unidade de Nível de Serviço (UNS)",
    HST: "Hora de Serviço Técnico (HST)",
    HORA_TECNICA: "Hora Técnica Remunerada por Entregável",
    HORAS_TECNICAS: "Horas Técnicas",
    PF: "Pontos de Função (PF)",
    SQUAD: "Equipe Ágil Dedicada por Resultados (Squad)",
    POSTOS: "Postos de Trabalho",
    CHAMADOS: "Chamados Técnicos Encerrados",
  };
  return map[m] || m;
}

export function translateForensicVectorName(vec: string): string {
  const map: Record<string, string> = {
    VETOR_1_PORTE_CNAE: "Vetor 1 — Incompatibilidade de Porte e Objeto Social (CNAE/RFB)",
    VETOR_2_CRONOLOGIA_CNPJ: "Vetor 2 — Anomalia Cronológica e Situação Cadastral do CNPJ Emissor",
    VETOR_3_PNCP_NAO_LOCALIZADO: "Vetor 3 — Ausência de Lastro Público no PNCP ou Portais Oficiais",
    VETOR_4_QSA_E_CONTATO: "Vetor 4 — Conflito Societário (QSA), Endereço ou E-mail Cruzado",
    VETOR_5_PLAGIO_EDITAL: "Vetor 5 — Similitude Textual Literal com o Termo de Referência",
    VETOR_6_VOLUME_PRAZO: "Vetor 6 — Desproporção Volumétrica entre Esforço Atestado e Prazo",
    VETOR_7_METADADOS_PDF: "Vetor 7 — Divergência Cronológica em Metadados PDF / Assinatura Digital",
    VETOR_7_SOFTWARES_EDICAO: "Vetor 7 — Rastro de Software de Edição Externa no PDF do ACT",
    VETOR_7_CRIPTOGRAFIA_PADES: "Vetor 7 — Perícia Criptográfica PKCS#7/PAdES e /ByteRange",
    VETOR_7_NFE_44_DIGITOS: "Vetor 7 — Validação Algorítmica da Chave NF-e de 44 Dígitos",
  };
  return map[vec] || vec.replace(/_/g, " ");
}

function summarizeActItemsForTag(dossier: BiddingProposalDossier, tag: string): string {
  const affected = dossier.act_forensics.items.filter((it) => it.blocking_tags.includes(tag));
  if (affected.length === 0) return "Nos atestados submetidos ao exame pericial";
  return affected
    .map((a) => `${a.certificate_id} (Emissor: ${a.issuer_name}, CNPJ ${a.issuer_cnpj})`)
    .join("; ");
}

export function describeBiddingTagLegalProse(
  tag: string,
  dossier: BiddingProposalDossier
): BiddingTagLegalProse {
  const is13303 = isLei13303Regime(dossier.legal_regime);
  const offered = formatBRL(dossier.ict_execution.offered_unit_value);
  const floor = formatBRL(dossier.ict_execution.parametric_floor_value);
  const metric = formatMetricFullName(dossier.ict_execution.metric_type);
  const reqPct =
    dossier.raw_context?.financial_qualification?.required_min_equity_or_capital_pct ??
    dossier.raw_context?.required_min_equity_or_capital_pct;
  const affectedActs = summarizeActItemsForTag(dossier, tag);

  switch (tag) {
    case "[ICT_HIDDEN_LABOR_DEDICATION_DEMO_TRAP_BLOCK]":
      return {
        title: "Desvirtuamento de Contratação de TIC para Alocação Disfarçada de Mão de Obra (DEMO)",
        legalBasis: is13303
          ? "Art. 31 da Lei nº 13.303/2016, Súmula TST nº 331 e Acórdãos TCU nº 2.503/2024 e nº 1.508/2020-Plenário"
          : "Art. 18, Art. 48 e Art. 121 da Lei nº 14.133/2021, IN SGD/ME nº 94/2022, Súmula TST nº 331 e Acórdãos TCU nº 1.508/2020 e nº 2.503/2024-Plenário",
        factualAnalysis: `Embora formalmente modelada na métrica ${metric}, a contratação apresenta elementos típicos de dedicação exclusiva de mão de obra (controle de horário/ponto, pessoalidade nominal na OS, subordinação direta ou remuneração mensal fixa desvinculada de entregas), atraindo risco solidário/subsidiário trabalhista sem conta vinculada.`,
        recommendation:
          "Expurgar exigências de pessoalidade nominal, controle de jornada e subordinação hierárquica, vinculando integralmente o faturamento a Ordens de Serviço e Acordos de Nível de Serviço (ANS).",
      };
    case "[ICT_UST_RAW_HOUR_EQUIVALENCE_SUMULA269_BLOCK]":
      return {
        title: "Emprego Ilícito de UST/USM/UNS como Mera Equivalência Linear de Hora-Homem",
        legalBasis: "Súmula TCU nº 269 e Art. 11 da Lei nº 14.133/2021 (ou Art. 31 da Lei nº 13.303/2016)",
        factualAnalysis: `A modelagem baseada em ${metric} carece de catálogo de atividades ponderado por complexidade técnica e criticidade, operando na prática em paridade direta 1:1 com a hora trabalhada simples.`,
        recommendation:
          "Instituir catálogo objetivo de serviços com fatores de complexidade (UST = esforço padrão x complexidade x criticidade) antes do prosseguimento contratual.",
      };
    case "[ICT_UNBOUNDED_TECHNICAL_HOUR_PARADOX_BLOCK]":
      return {
        title: "Paradoxo do Lucro-Incompetência em Contratação por Hora Técnica (HST) sem Teto Fechado",
        legalBasis: "Súmula TCU nº 269, Acórdão TCU nº 1.508/2020-Plenário e Princípio da Eficiência (Art. 37, CRFB/88)",
        factualAnalysis: `Adotou-se a métrica ${metric} sem justificativa técnica excepcional de inviabilidade de medição por resultado e sem teto prévio fechado de horas máximas por Ordem de Serviço.`,
        recommendation:
          "Migrar a unidade de medida para entregas mensuráveis por resultado/ANS ou justificar excepcionalmente a HST com fixação prévia e vinculante de limite máximo de horas em cada OS.",
      };
    case "[ICT_AGILE_OR_PF_WITHOUT_ANS_DELIVERABLE_LINK_BLOCK]":
      return {
        title: "Modelagem em Pontos de Função / Squad sem Vinculação Efetiva a Entregáveis e ANS",
        legalBasis: "Acórdãos TCU nº 1.508/2020 e nº 2.503/2024-Plenário; IN SGD/ME nº 94/2022",
        factualAnalysis: `A execução em ${metric} não vincula o pagamento à produtividade efetivamente entregue (Throughput/Velocity ou contagem validada) nem à incidência objetiva de descontos por Acordo de Níveis de Serviço (ANS).`,
        recommendation:
          "Alterar os critérios de medição para atrelar o pagamento mensal ao atingimento de metas de entrega e qualidade em ANS.",
      };
    case "[ICT_PROPOSAL_BELOW_PROFILE_FLOOR_INEXEQUIBLE]":
      return {
        title: "Indício Matemático de Inexequibilidade abaixo do Piso Paramétrico dos Perfis de TI",
        legalBasis: is13303
          ? "Art. 56, inciso V e §§ 2º e 3º da Lei nº 13.303/2016 e Súmula TCU nº 262"
          : "Art. 59, inciso III e § 2º da Lei nº 14.133/2021 e Súmula TCU nº 262",
        factualAnalysis: `O valor unitário ofertado pela licitante ${dossier.bidder_name} (${offered}) situa-se abaixo do piso paramétrico mínimo apurado para os perfis profissionais de TI (${floor}), considerando pisos salariais de mercado, encargos sociais e BDI/tributos.`,
        recommendation:
          "Exigir demonstração analítica da composição de custos unitários (custos salariais, encargos, regime tributário e margem operacional) por meio de diligência formal antes da decisão definitiva.",
      };
    case "[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]":
      return {
        title: "Vedação de Desclassificação Sumária e Obrigatoriedade de Diligência Prévia",
        legalBasis: is13303
          ? "Súmula TCU nº 262 e Art. 56, § 2º da Lei nº 13.303/2016"
          : "Súmula TCU nº 262 e Art. 59, § 2º c/c Art. 64 da Lei nº 14.133/2021",
        factualAnalysis: `Diante de oferta inferior ao referencial paramétrico (${offered} versus piso de ${floor}), a tentativa de exclusão imediata da licitante sem oportunizar a comprovação de exequibilidade configura nulidade processual por presunção absoluta ilícita.`,
        recommendation:
          "Suspender a adjudicação e intimar formalmente a licitante para comprovar, em prazo razoável, a viabilidade econômica de sua planilha de formação de preços.",
      };
    case "[ICT_ACT_RIGID_METRIC_RESTRICTION_BLOCK]":
      return {
        title: "Restrição Indevida à Competitividade por Recusa de Conversibilidade de Métricas de ACT",
        legalBasis: is13303
          ? "Art. 31 e Art. 58, II da Lei nº 13.303/2016 e Princípio do Formalismo Moderado (TCU)"
          : "Art. 67 da Lei nº 14.133/2021, Art. 37, XXI da CRFB/88 e Jurisprudência Consolidada do TCU",
        factualAnalysis: `Constatou-se exigência de atestados exclusivamente na métrica do edital (${dossier.raw_context?.technical_qualification?.edital_metric || dossier.ict_execution.metric_type}), rejeitando a conversão paramétrica equivalente de atestados em horas técnicas, PF, postos ou chamados.`,
        recommendation:
          "Admitir o cômputo dos atestados por equivalência técnica e paramétrica objetiva (quantidade total convertida apurada: " +
          formatNumberBR(dossier.qualification.converted_total_quantity, 2) +
          ").",
      };
    case "[TECH_CAPACITY_EXCEEDS_50PCT_BLOCK]":
      return {
        title: "Exigência de Quantitativo Técnico Mínimo Superior ao Teto Legal de 50%",
        legalBasis: "Art. 67, § 2º da Lei nº 14.133/2021 e Súmula TCU nº 263",
        factualAnalysis:
          "O instrumento convocatório impôs comprovação de experiência anterior em quantitativo superior ao máximo de 50% (cinquenta por cento) das parcelas de maior relevância e valor significativo.",
        recommendation:
          "Reduzir o critério de aferição da capacidade técnico-operacional ao limite legal máximo de 50% do quantitativo licitado.",
      };
    case "[IRRELEVANT_PARCEL_BELOW_4PCT_BLOCK]":
      return {
        title: "Exigência de Habilitação Técnica sobre Parcela Financeiramente Irrelevante (< 4%)",
        legalBasis: "Art. 67, § 1º da Lei nº 14.133/2021 e Súmula TCU nº 263",
        factualAnalysis:
          "Identificou-se requisição de atestado técnico vinculada a item ou parcela cujo valor estimado representa menos de 4% (quatro por cento) do valor total estimado da contratação.",
        recommendation:
          "Afastar a exigência de comprovação técnica específica sobre parcela de baixa materialidade econômica.",
      };
    case "[SUM_OF_CERTIFICATES_MANDATORY_BLOCK]":
      return {
        title: "Vedação Imotivada ao Somatório de Atestados de Capacidade Técnica",
        legalBasis: is13303
          ? "Art. 58 da Lei nº 13.303/2016 e Jurisprudência do TCU sobre Ampla Competitividade"
          : "Art. 67 da Lei nº 14.133/2021 e Acórdãos TCU nº 1.211/2021 e nº 1.865/2012-Plenário",
        factualAnalysis:
          "O critério editalício proibiu o somatório de atestados distintos sem apresentar justificativa técnica objetiva de indivisibilidade operacional do objeto.",
        recommendation:
          "Permitir o somatório dos quantitativos atestados compatíveis em características e complexidade.",
      };
    case "[CUMULATIVE_CAPITAL_AND_EQUITY_BLOCK]":
      return {
        title: "Exigência Cumulativa Ilegal de Capital Social Mínimo e Patrimônio Líquido Mínimo",
        legalBasis: "Art. 69, § 4º da Lei nº 14.133/2021 e Súmula TCU nº 275",
        factualAnalysis:
          "A habilitação econômico-financeira impôs simultaneamente Capital Social mínimo e Patrimônio Líquido mínimo, exigência vedada pela Súmula TCU nº 275 por configurar dupla garantia cumulativa.",
        recommendation:
          "Aplicar a exigência de forma estritamente alternativa (Capital Social mínimo OU Patrimônio Líquido mínimo).",
      };
    case "[FINANCIAL_EQUITY_EXCEEDS_10PCT_CAP_BLOCK]":
      return {
        title: "Exigência de Patrimônio Líquido ou Capital Social Superior ao Teto de 10%",
        legalBasis: "Art. 69, § 4º da Lei nº 14.133/2021 (ou Art. 58, III da Lei nº 13.303/2016)",
        factualAnalysis: `Exigiu-se comprovação de capital social ou patrimônio líquido no percentual de ${reqPct !== undefined ? formatPercentBR(reqPct, 1) : "índice superior ao teto legal"}, ultrapassando o máximo de 10,0% do valor estimado da contratação.`,
        recommendation:
          "Adequar a exigência financeira ao limite legal máximo de 10% do valor estimado.",
      };
    case "[ACT_ISSUER_CNAE_OR_SCALE_MISMATCH_SUSPICION]":
      return {
        title: "Incompatibilidade de Porte Empresarial e Objeto Social (CNAE) do Emissor de ACT",
        legalBasis: is13303
          ? "Art. 56, § 2º da Lei nº 13.303/2016 e Acórdão TCU nº 1.385/2016-Plenário"
          : "Art. 64 da Lei nº 14.133/2021 e Acórdãos TCU nº 1.385/2016 e nº 1.211/2021-Plenário",
        factualAnalysis: `Em relação a ${affectedActs}, verificou-se incongruência entre o objeto de TIC atestado (e/ou volume contratado) e o CNAE principal ou porte cadastral (ex.: MEI) do emissor na base da Receita Federal.`,
        recommendation:
          "Promover diligência direta ao emissor (Via A) e exigir lastro fiscal/operacional da licitante (Via B) para demonstrar a real prestação do serviço.",
      };
    case "[ACT_CHRONOLOGY_OR_INACTIVE_CNPJ_FRAUD_BLOCK]":
      return {
        title: "Anomalia Cronológica Impossível ou Situação Cadastral Inativa do CNPJ Emissor",
        legalBasis: is13303
          ? "Art. 56, § 2º e Art. 83 da Lei nº 13.303/2016; Arts. 299 e 337-I do Código Penal"
          : "Art. 64 e Art. 155, VIII da Lei nº 14.133/2021; Arts. 299 e 337-I do Código Penal",
        factualAnalysis: `Detectada inconsistência grave em ${affectedActs}: execução iniciada em data anterior à abertura do CNPJ na Receita Federal ou emissão de atestado quando a empresa já se encontrava em situação BAIXADA, INAPTA, SUSPENSA ou NULA.`,
        recommendation:
          "Desconsiderar imediatamente o atestado para fins de habilitação caso não sanado cabalmente, intimar a licitante em contraditório e avaliar instauração de PAS e comunicação ao Ministério Público.",
      };
    case "[ACT_PUBLIC_CONTRACT_UNVERIFIED_IN_PNCP]":
      return {
        title: "Inexistência de Lastro Público do Atestado no PNCP ou Portais de Transparência",
        legalBasis: "Art. 94 e Art. 174 da Lei nº 14.133/2021; Acórdão TCU nº 1.385/2016-Plenário",
        factualAnalysis: `Em ${affectedActs}, o emissor figura como ente público ou estatal sem localização de contrato, ata de registro de preços ou empenho correspondente no Portal Nacional de Contratações Públicas (PNCP).`,
        recommendation:
          "Oficiar o órgão/entidade emissor pelos canais oficiais para confirmação expressa do contrato, empenhos e notas fiscais correspondentes.",
      };
    case "[ACT_RELATED_PARTY_SELF_ATTESTATION_ALERT]":
      return {
        title: "Indício de Conflito Societário (QSA), Auto-Atestação ou Vínculo Cruzado com o Emissor",
        legalBasis: "Princípio da Moralidade e Impessoalidade (Art. 37, CRFB/88) e Acórdão TCU nº 1.385/2016-Plenário",
        factualAnalysis: `Apontado em ${affectedActs} compartilhamento de sócios no Quadro de Sócios e Administradores (QSA), coincidência de endereço/CEP ou domínio de e-mail compartilhado/gratuito entre emissor e licitante.`,
        recommendation:
          "Exigir prova robusta e independente da efetiva execução financeira e trabalhista (extratos bancários, NF-e com chave de 44 dígitos e eSocial/SEFIP).",
      };
    case "[ACT_LITERAL_EDITAL_PLAGIARISM_DETECTED]":
      return {
        title: "Similitude Textual Literal (Plágio de Termo de Referência) no Conteúdo do ACT",
        legalBasis: is13303
          ? "Art. 56, § 2º da Lei nº 13.303/2016 e Acórdão TCU nº 1.211/2021-Plenário"
          : "Art. 64 e Art. 155, VIII da Lei nº 14.133/2021 e Acórdão TCU nº 1.211/2021-Plenário",
        factualAnalysis: `Identificada em ${affectedActs} elevada coincidência vocabular (>= 75% pelo índice de Jaccard) entre a descrição técnica do atestado pretérito e o texto do Termo de Referência da licitação atual.`,
        recommendation:
          "Instaurar diligência dupla (Vias A e B) para verificar se o documento foi confeccionado sob medida após a publicação do edital.",
      };
    case "[ACT_IMPLAUSIBLE_VOLUME_TIME_RATIO_ALERT]":
      return {
        title: "Desproporção Matemática entre o Volume Atestado e o Prazo de Execução",
        legalBasis: is13303
          ? "Art. 56, § 2º da Lei nº 13.303/2016"
          : "Art. 64 e Art. 67 da Lei nº 14.133/2021",
        factualAnalysis: `Em ${affectedActs}, a média mensal de produção técnica declarada excede a capacidade operacional plausível para o período de vigência informado.`,
        recommendation:
          "Requisitar memórias de medição mensal, Ordens de Serviço e registros GFIP/SEFIP/eSocial que comprovem a equipe efetivamente alocada à época.",
      };
    case "[ACT_FORENSIC_SIGNATURE_DATE_MISMATCH]":
      return {
        title: "Divergência Cronológica em Metadados do Arquivo PDF ou Assinatura Digital",
        legalBasis: is13303
          ? "Art. 56, § 2º da Lei nº 13.303/2016 e MP nº 2.200-2/2001"
          : "Art. 64 e Art. 155, VIII da Lei nº 14.133/2021 e MP nº 2.200-2/2001",
        factualAnalysis: `Identificada em ${affectedActs} discrepância cronológica nos metadados do arquivo PDF/assinatura digital ou coincidência com a proponente, sem ressalva expressa de segunda via.`,
        recommendation:
          "Intimar emissor e licitante a apresentarem o documento nato-digital original assinado à época ou comprovação documental de reemissão legítima.",
      };
    case "[ACT_PDF_EDITING_SOFTWARE_TRACE_SUSPICION]":
      return {
        title: "Indício de Manipulação Documental por Software de Edição Externa em ACT",
        legalBasis: "Art. 64 e Art. 155, VIII da Lei nº 14.133/2021; Arts. 299 e 337-I do Código Penal",
        factualAnalysis: `Detectado rastro de editor gráfico/PDF externo (como Canva, iLovePDF ou Sejda) em ${affectedActs}, suscitando diligência de autenticidade.`,
        recommendation:
          "Exigir apresentação das notas fiscais eletrônicas originárias, contrato original e verificação direta junto ao emissor.",
      };
    case "[BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT]":
      return {
        title: "Alerta Forense de Possível Conluio entre Propostas Concorrentes por Metadados Compartilhados",
        legalBasis: "Art. 5º e Art. 155, IX da Lei nº 14.133/2021; Súmulas e Acórdãos do TCU sobre Fraude à Licitação",
        factualAnalysis:
          "Identificada coincidência de autoria (Author/LastModifiedBy) ou criação temporal quase simultânea (<= 120s) com ferramenta comum entre arquivos de propostas supostamente independentes.",
        recommendation:
          "Submeter à diligência apuratória e avaliar abertura de processo de apuração de responsabilidade / remessa aos órgãos de controle.",
      };
    case "[INEXEQUIBILITY_75_PCT_PRESUMPTION_DILIGENCE_REQUIRED]":
    case "[INEXEQUIBILITY_ADDITIONAL_GUARANTEE_85_PCT_REQUIRED]":
      return {
        title: "Controle de Exequibilidade (75%) e Garantia Adicional (85%) em Obras e Engenharia",
        legalBasis: "Art. 59, §§ 4º e 5º da Lei nº 14.133/2021 e Súmula TCU nº 262",
        factualAnalysis:
          "Oferta situada abaixo dos limiares objetivos de 75% (presunção relativa de inexequibilidade com diligência obrigatória) ou 85% (exigência de garantia adicional pela diferença).",
        recommendation:
          "Abrir diligência de exequibilidade antes de qualquer desclassificação e condicionar a contratação à prestação da garantia adicional devida.",
      };
    case "[UNIT_PRICE_OVERPRICING_JOGO_DE_PLANILHA_BLOCK]":
      return {
        title: "Sobrepreço Unitário / Indício de Jogo de Planilha (Art. 59 / Súmula TCU 259)",
        legalBasis: "Art. 59, III da Lei nº 14.133/2021 e Súmula TCU nº 259",
        factualAnalysis:
          "Foram identificados itens unitários cotados acima dos preços referenciais estimados na planilha orçamentária, caracterizando risco de jogo de planilha em eventuais aditivos.",
        recommendation:
          "Promover negociação de adequação dos preços unitários aos referenciais estimados ou desclassificar a proposta caso mantido o sobrepreço unitário.",
      };
    case "[APPEAL_IMMEDIATE_INTENT_PRECLUSION_BLOCK]":
    case "[APPEAL_INTENTION_SUMMARY_REJECTION_ILLEGAL_BLOCK]":
    case "[APPEAL_UNTIMELY_3_BUSINESS_DAYS_BLOCK]":
    case "[APPEAL_DEADLINE_3_BUSINESS_DAYS_VIOLATION]":
    case "[APPEAL_THEMATIC_INNOVATION_OUTSIDE_INTENT_BLOCK]":
      return {
        title: "Óbice Formal de Admissibilidade ou Prazo Recursal (Art. 165 da Lei 14.133/2021)",
        legalBasis: "Art. 165, I, § 1º, I e § 4º da Lei nº 14.133/2021",
        factualAnalysis:
          "Constatada preclusão de intenção imediata, rejeição sumária ilegal de mérito da intenção, violação/intempestividade frente ao prazo de 3 dias úteis ou inovação temática estranha aos motivos registrados.",
        recommendation:
          "Regularizar o juízo de admissibilidade motivado e assegurar estrita observância ao prazo legal de 3 dias úteis.",
      };
    case "[NEW_DOCUMENT_PRECLUSION_EXCEPTION_ACORDAO_1211_2021]":
    case "[HIERARCHICAL_REMISSION_10_DAYS_MANDATORY]":
      return {
        title: "Diligência Documental Recursal (Acórdão TCU 1.211/2021) e Remessa Hierárquica (10 Dias)",
        legalBasis: "Art. 64 e Art. 165, § 2º da Lei nº 14.133/2021; Acórdão TCU nº 1.211/2021-Plenário",
        factualAnalysis:
          "Identificada necessidade de admissão em diligência de documento comprobatório de condição preexistente (Acórdão 1.211/2021) ou obrigatoriedade de remessa à Autoridade Superior (decisão mantida, prazo de 10 dias úteis).",
        recommendation:
          "Conhecer o documento preexistente via diligência saneadora ou encaminhar imediatamente os autos à Autoridade Superior no efeito suspensivo.",
      };
    case "[FORENSIC_SIGNER_IDENTITY_MISMATCH_BLOCK]":
      return {
        title: "Divergência de Identidade Criptográfica do Signatário X.509/ICP-Brasil",
        legalBasis: is13303
          ? "Art. 56, § 2º e Art. 83 da Lei nº 13.303/2016; MP nº 2.200-2/2001; Lei nº 14.063/2020"
          : "Arts. 5º, 64, 67 e 155, VIII e X da Lei nº 14.133/2021; MP nº 2.200-2/2001; Lei nº 14.063/2020; Art. 337-I do Código Penal",
        factualAnalysis: `O certificado digital ICP-Brasil/Gov.br extraído de ${affectedActs} apresenta titularidade (CN/CPF/CNPJ) incompatível com o signatário ou emissor esperado.`,
        recommendation:
          "Rejeitar/inabilitar o atestado impugnado, instaurar Processo Administrativo Sancionador (PAS — Art. 155, VIII/X) e comunicar os órgãos de controle e o Ministério Público diante de indício de falsidade documental.",
      };
    case "[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]":
      return {
        title: "Assinatura Digital com Certificado Autoassinado ou Fora da Cadeia ICP-Brasil/Gov.br",
        legalBasis: is13303
          ? "Art. 56, § 2º da Lei nº 13.303/2016; MP nº 2.200-2/2001 (ICP-Brasil); Lei nº 14.063/2020"
          : "Arts. 5º, 64, 67 e 155, VIII da Lei nº 14.133/2021; MP nº 2.200-2/2001 (ICP-Brasil); Lei nº 14.063/2020",
        factualAnalysis: `Identificada em ${affectedActs} assinatura PAdES lastreada em certificado autoassinado ou sem encadeamento válido a Autoridade Certificadora confiável ICP-Brasil/Gov.br.`,
        recommendation:
          "Negar eficácia probatória ao documento, proceder à rejeição/inabilitação da proposta quanto ao atestado, instaurar PAS e comunicar os órgãos de controle caso subsistam indícios de fraude.",
      };
    case "[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]":
      return {
        title: "Adulteração Incremental Pós-Assinatura Digital ou Divergência de Hash /ByteRange",
        legalBasis: is13303
          ? "Art. 56, § 2º e Art. 83 da Lei nº 13.303/2016; MP nº 2.200-2/2001; Lei nº 14.063/2020; Arts. 299 e 337-I do Código Penal"
          : "Arts. 5º, 64, 67 e 155, VIII e X da Lei nº 14.133/2021; MP nº 2.200-2/2001; Lei nº 14.063/2020; Arts. 299 e 337-I do Código Penal",
        factualAnalysis: `Constatada em ${affectedActs} divergência criptográfica entre o hash de /ByteRange e o messageDigest assinado ou injeção suspeita de conteúdo após o bloco de assinatura.`,
        recommendation:
          "Determinar a imediata rejeição/inabilitação da licitante, preservar a cadeia de custódia digital do arquivo, instaurar PAS e comunicar os órgãos de controle externo e o Ministério Público.",
      };
    case "[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]":
      return {
        title: "Chave de Acesso NF-e de 44 Dígitos Matematicamente Inválida (Módulo 11 / Estrutura Fiscal)",
        legalBasis: is13303
          ? "Art. 56, § 2º e Art. 83 da Lei nº 13.303/2016; Ajuste SINIEF nº 07/2005; Art. 337-I do Código Penal"
          : "Arts. 5º, 64, 67 e 155, VIII e X da Lei nº 14.133/2021; Ajuste SINIEF nº 07/2005; Art. 337-I do Código Penal",
        factualAnalysis: `Em ${affectedActs}, a chave de acesso NF-e apresentada em diligência apresentou falha estrutural ou no Dígito Verificador (Módulo 11), indicando documento fiscal inexistente ou adulterado.`,
        recommendation:
          "Promover a rejeição/inabilitação imediata, instaurar PAS por apresentação de documento falso e encaminhar comunicação aos órgãos de controle e à autoridade fazendária.",
      };
    case "[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]":
      return {
        title: "Divergência de CNPJ Emitente ou Competência (AAMM) na Chave NF-e de 44 Dígitos",
        legalBasis: is13303
          ? "Art. 56, § 2º e Art. 83 da Lei nº 13.303/2016; Ajuste SINIEF nº 07/2005; Art. 337-I do Código Penal"
          : "Arts. 5º, 64, 67 e 155, VIII e X da Lei nº 14.133/2021; Ajuste SINIEF nº 07/2005; Art. 337-I do Código Penal",
        factualAnalysis: `Em ${affectedActs}, o CNPJ emitente ou a competência (AAMM) embutidos na chave NF-e de 44 dígitos divergem dos dados declarados pela licitante no atestado ou na diligência.`,
        recommendation:
          "Promover a rejeição/inabilitação do atestado por incompatibilidade do lastro fiscal, instaurar PAS para apuração de responsabilidade e comunicar os órgãos de controle.",
      };
    case "[FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK]":
      return {
        title: "Indício Objetivo de Conluio por Clonagem de Identificadores OpenXML (w:rsidRoot / w:rsidR)",
        legalBasis: is13303
          ? "Art. 31 e Art. 83 da Lei nº 13.303/2016; Arts. 337-F e 337-I do Código Penal"
          : "Arts. 5º e 155, IX e X da Lei nº 14.133/2021; Arts. 337-F e 337-I do Código Penal",
        factualAnalysis:
          "Detectada identidade de sessão de edição OpenXML (w:rsidRoot ou sobreposição relevante de w:rsidR) entre arquivos .docx de proponentes distintos, mesmo após eventual remoção do metadado Author.",
        recommendation:
          "Bloquear/rejeitar as propostas envolvidas por forte indício de frustração à competitividade, instaurar imediatamente PAS e encaminhar representação ao Tribunal de Contas competente e ao Ministério Público.",
      };
    default:
      return {
        title: `Apontamento Técnico-Normativo (${tag})`,
        legalBasis: formatLegalRegime(dossier.legal_regime),
        factualAnalysis:
          "Foi identificado apontamento específico pelos módulos de conformidade e auditoria do motor determinístico durante a análise dos autos.",
        recommendation:
          "Sanear integralmente o apontamento registrado nos autos antes da homologação ou assinatura do contrato.",
      };
  }
}
