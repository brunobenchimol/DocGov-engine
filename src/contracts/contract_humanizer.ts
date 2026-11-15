// ============================================================================
// Formatador Jurídico Vernáculo para Peças de PAS, Dosimetria e ANS (Gen5.6+)
// docgov-engine — src/contracts/contract_humanizer.ts
// Traduz enums de sistema para português jurídico administrativo formal.
// ============================================================================

import type { ContractAuditReport } from "./types.ts";

export interface LegalProseBlock {
  title: string;
  body: string;
}

export function isLei13303Regime(regime?: string): boolean {
  const norm = (regime || "").toUpperCase();
  return norm.includes("13303") || norm.includes("ESTATAL");
}

export function humanizeLegalRegime(regime?: string): string {
  if (isLei13303Regime(regime)) {
    return "Lei Federal nº 13.303/2016 (Estatuto Jurídico das Empresas Estatais e RILC)";
  }
  return "Lei Federal nº 14.133/2021 (Nova Lei de Licitações e Contratos Administrativos)";
}

export function humanizeShortRegime(regime?: string): string {
  return isLei13303Regime(regime) ? "Lei nº 13.303/2016" : "Lei nº 14.133/2021";
}

export function humanizeObjectType(objectType?: string): string {
  const norm = (objectType || "").trim().toUpperCase();
  if (["SERVICE", "SERVICES", "SERVICO", "SERVICOS", "SERVIÇO", "SERVIÇOS"].includes(norm)) {
    return "Prestação de Serviços";
  }
  if (["WORK", "WORKS", "ENGINEERING", "OBRA", "OBRAS", "ENGENHARIA"].includes(norm)) {
    return "Obras e Serviços de Engenharia";
  }
  if (["SUPPLY", "GOODS", "COMPRA", "COMPRAS", "FORNECIMENTO"].includes(norm)) {
    return "Fornecimento de Bens";
  }
  if (!norm) return "Prestação de Serviços / Fornecimento";
  return objectType!.trim();
}

export function humanizeAuditStatus(status?: string): string {
  const norm = (status || "").trim().toUpperCase();
  if (norm === "BLOCKED" || norm === "BLOQUEADO") {
    return "IMPEDIMENTO TÉCNICO-JURÍDICO IDENTIFICADO (RECOMENDAÇÃO DE NÃO ASSINATURA / RETIFICAÇÃO)";
  }
  if (norm === "WARNING" || norm === "ALERTA") {
    return "RESSALVAS TÉCNICO-JURÍDICAS IDENTIFICADAS (RECOMENDAÇÃO DE SANEAMENTO PRÉVIO)";
  }
  return "CONFORME / APTO AO PROSSEGUIMENTO";
}

export function humanizeSphere(sphere?: string): string {
  const norm = (sphere || "").trim().toUpperCase();
  if (norm === "STATE" || norm === "ESTADUAL" || norm === "ESTADO" || norm === "DISTRITAL") {
    return "Estadual";
  }
  if (norm === "MUNICIPAL" || norm === "MUNICIPIO" || norm === "MUNICÍPIO") {
    return "Municipal";
  }
  return "Federal";
}

export function humanizeContractingEntity(entity?: string): string {
  const raw = (entity || "").trim();
  const norm = raw.toUpperCase();
  if (!raw || norm === "ORGAO_CONTRATANTE" || norm === "ORGAO CONTRATANTE") {
    return "Órgão / Entidade Pública Contratante";
  }
  return raw;
}

export function humanizeSphereAndRegimeCell(
  sphere?: string,
  uf?: string,
  municipality?: string,
  regime?: string
): string {
  const sp = humanizeSphere(sphere);
  const reg = humanizeShortRegime(regime);
  const cleanUf = uf ? uf.trim().toUpperCase() : "";
  const cleanMun = (municipality || "").trim();
  const munLabel =
    !cleanMun || cleanMun.toUpperCase() === "MUNICIPIO_GENERICO"
      ? "Município Auditado"
      : cleanMun;

  if (sp === "Municipal") {
    const loc = cleanUf ? `${munLabel} / UF: ${cleanUf}` : munLabel;
    return `Esfera Municipal (${loc}) — ${reg}`;
  }
  if (sp === "Estadual") {
    const ufPart = cleanUf ? ` (UF: ${cleanUf})` : "";
    return `Esfera Estadual${ufPart} — ${reg}`;
  }
  return `Esfera Federal — ${reg}`;
}

export function humanizeSanctionType(sanction?: string): string {
  const norm = (sanction || "").trim().toUpperCase();
  if (!norm) return "Não especificada";
  if (norm.includes("INIDONEIDADE") || norm === "DEBARMENT") {
    return "Declaração de Inidoneidade para Licitar ou Contratar";
  }
  if (norm.includes("SUSPENSAO") || norm.includes("SUSPENSÃO")) {
    return "Suspensão Temporária de Participação em Licitação e Impedimento de Contratar (Art. 83, III da Lei nº 13.303/2016)";
  }
  if (norm.includes("IMPEDIMENTO")) {
    return "Impedimento de Licitar e Contratar";
  }
  if (norm.includes("ADVERTENCIA") || norm.includes("ADVERTÊNCIA")) {
    return "Advertência";
  }
  if (norm === "MULTA" || norm === "FINE") {
    return "Multa Contratual / Sancionatória";
  }
  if (norm === "NONE_REMUNERATORY_GLOSA_ONLY") {
    return "Glosa Estritamente Remuneratória por ANS/IMR (Sem Penalidade Sancionatória)";
  }
  return sanction!.replace(/_/g, " ");
}

export function humanizeSanctionScope(scope?: string): string {
  const norm = (scope || "").trim().toUpperCase();
  if (!norm) return "Restrito ao âmbito do órgão ou entidade sancionadora";
  if (
    ["ALL_SPHERES", "NATIONAL", "UNION", "NACIONAL", "AMBITO_NACIONAL", "ALL_FEDERATIVE_ENTITIES", "COUNTRYWIDE", "TODAS_AS_ESFERAS"].includes(norm)
  ) {
    return "Âmbito Nacional (União, Estados, DF e Municípios)";
  }
  if (norm === "FEDERATIVE_ENTITY" || norm === "ENTE_FEDERATIVO") {
    return "Restrito à Esfera do Ente Federativo Sancionador";
  }
  if (norm === "OWN_ENTITY" || norm === "PROPRIA_ENTIDADE") {
    return "Restrito à Própria Entidade Estatal Sancionadora";
  }
  if (norm === "CONTRACTUAL" || norm === "CONTRACT_BILLING") {
    return "Âmbito Estritamente Contratual";
  }
  if (norm === "STATE" || norm === "ESTADUAL") return "Âmbito Estadual";
  if (norm === "MUNICIPAL") return "Âmbito Municipal";
  return scope!.replace(/_/g, " ");
}

export function humanizeAuthorityRole(role?: string): string {
  const norm = (role || "").trim().toUpperCase().replace(/[\s\-]+/g, "_");
  if (!norm) return "Não informada nos autos";
  const map: Record<string, string> = {
    ORDENADOR_DESPESA: "Ordenador de Despesa",
    ORDENADOR_DE_DESPESA: "Ordenador de Despesa",
    GESTOR_CONTRATO: "Gestor do Contrato",
    GESTOR_DO_CONTRATO: "Gestor do Contrato",
    FISCAL_CONTRATO: "Fiscal do Contrato",
    FISCAL_DO_CONTRATO: "Fiscal do Contrato",
    PREGOEIRO: "Pregoeiro",
    DIRETOR_DEPARTAMENTO: "Diretor de Departamento",
    DIRETOR_DE_DEPARTAMENTO: "Diretor de Departamento",
    SECRETARIO_ESTADUAL: "Secretário de Estado",
    SECRETARIO_MUNICIPAL: "Secretário Municipal",
    MINISTRO_DE_ESTADO: "Ministro de Estado",
    MINISTRO_ESTADO: "Ministro de Estado",
    MINISTRO: "Ministro de Estado",
    AUTORIDADE_MAXIMA: "Autoridade Máxima da Entidade",
    AUTORIDADE_MAXIMA_AUTARQUIA_FUNDACAO: "Autoridade Máxima da Entidade",
  };
  if (map[norm]) return map[norm];
  return norm
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function humanizePriceBasketMethod(method?: string): string {
  const norm = (method || "").trim().toUpperCase();
  if (norm === "MEDIAN" || norm === "MEDIANA") return "Mediana Amostral";
  if (norm === "MEAN" || norm === "MEDIA" || norm === "MÉDIA") return "Média Aritmética Simples";
  if (norm === "SANITIZED_MEAN" || norm === "MEDIA_SANEADA") return "Média Aritmética Saneada";
  return method || "Mediana Amostral";
}

export function describeBlockingTagLegalProse(
  tag: string,
  index: number,
  isLei13303: boolean
): LegalProseBlock {
  const prefix = `${index}. `;
  switch (tag) {
    case "[PAS_CONTRADICTORY_15_DAYS_VIOLATION_BLOCK]":
      return {
        title: `${prefix}Violação ao Prazo Mínimo de Contraditório e Ampla Defesa`,
        body: isLei13303
          ? `O procedimento sancionatório desrespeitou a garantia constitucional do contraditório prévio (Art. 5º, LV da CRFB/88) e o rito disciplinado pelo Art. 83, § 2º da Lei nº 13.303/2016 e pelo Regulamento Interno de Licitações e Contratos (RILC), em parâmetro harmônico ao prazo de 15 (quinze) dias úteis consagrado nos Arts. 157 e 158 da Lei nº 14.133/2021. Recomenda-se a expedição de notificação prévia regular e concessão integral do prazo mínimo legal para defesa prévia antes de qualquer deliberação punitiva. (Ref. de Auditoria: ${tag})`
          : `O procedimento sancionatório desrespeitou a garantia constitucional do contraditório e da ampla defesa (Art. 5º, LV da CRFB/88) e o prazo legal mínimo de 15 (quinze) dias úteis exigido pelos Arts. 157 e 158 da Lei Federal nº 14.133/2021, seja por ausência de abertura formal de Processo Administrativo Sancionador (PAS), ausência de notificação prévia ou concessão de prazo defensivo inferior ao mínimo legal. Recomenda-se a anulação dos atos decisórios prematuros e a reabertura integral do prazo de 15 (quinze) dias úteis. (Ref. de Auditoria: ${tag})`,
      };
    case "[PAS_STATE_ENTERPRISE_SANCTION_REGIME_MISMATCH_BLOCK]":
      return {
        title: `${prefix}Incompatibilidade de Regime Sancionatório em Empresa Estatal`,
        body: `Contrato celebrado por empresa pública ou sociedade de economia mista rege-se estritamente pelo Art. 83, inciso III c/c Art. 38 da Lei Federal nº 13.303/2016, que limita a penalidade restritiva máxima à suspensão temporária de participação em licitação e impedimento de contratar com a própria entidade sancionadora por prazo não superior a 2 (dois) anos (24 meses), vedada a imposição de Declaração de Inidoneidade da Lei nº 14.133/2021 ou a extensão unilateral para outros entes. Recomenda-se o imediato reenquadramento da sanção no regime da Lei nº 13.303/2016 e do respectivo RILC. (Ref. de Auditoria: ${tag})`,
      };
    case "[PAS_SANCTION_TERRITORIAL_SCOPE_MISMATCH_BLOCK]":
      return {
        title: `${prefix}Extrapolação do Alcance Territorial ou Temporal do Impedimento de Licitar`,
        body: `Nos termos do Art. 156, inciso III e § 4º da Lei Federal nº 14.133/2021 e da jurisprudência consolidada dos Tribunais de Contas (a exemplo da Súmula nº 51 do TCE-SP), a penalidade de impedimento de licitar e contratar produz efeitos estritamente no âmbito da Administração Pública direta e indireta do ente federativo que aplicou a sanção, pelo prazo máximo de 3 (três) anos (36 meses). É vedada a extensão de efeitos à União ou a âmbito nacional por ente estadual ou municipal. Recomenda-se a retificação expressa do alcance e/ou da duração máxima. (Ref. de Auditoria: ${tag})`,
      };
    case "[PAS_INCOMPETENT_AUTHORITY_FOR_DEBARMENT_BLOCK]":
      return {
        title: `${prefix}Incompetência da Autoridade Signatária e/ou Ausência de Parecer Jurídico Conclusivo`,
        body: `Consoante o Art. 156, § 6º da Lei Federal nº 14.133/2021, a aplicação da Declaração de Inidoneidade constitui competência exclusiva de Ministro de Estado, Secretário Estadual ou Secretário Municipal (ou da Autoridade Máxima de autarquia ou fundação), devendo ser obrigatoriamente precedida de análise jurídica conclusiva. Decisão proferida por ordenador de despesa, gestor, fiscal de contrato ou desprovida de parecer jurídico padece de nulidade insanável por vício de competência. Recomenda-se o encaminhamento dos autos à autoridade máxima competente após manifestação jurídica formal. (Ref. de Auditoria: ${tag})`,
      };
    case "[PAS_EXTERNAL_CONTROL_REGISTRY_OMISSION_ALERT]":
      return {
        title: `${prefix}Omissão de Comando de Registro nos Cadastros de Controle Externo`,
        body: `Em observância ao Art. 161 da Lei Federal nº 14.133/2021 e às normas de publicidade e transparência do controle externo, a decisão sancionatória deve conter comando expresso determinando a inscrição da penalidade nos cadastros obrigatórios (CEIS, CNEP, PNCP — quando aplicável — e sistema eletrônico da Corte de Contas competente). Recomenda-se o aditamento do dispositivo decisório com a determinação expressa de remessa eletrônica aos cadastros omitidos. (Ref. de Auditoria: ${tag})`,
      };
    case "[PAS_ARBITRARY_UNANCHORED_DOSIMETRY_ALERT]":
      return {
        title: `${prefix}Ausência de Calibragem Jurisprudencial e Motivação na Dosimetria (LINDB Art. 22)`,
        body: `Nos termos do Art. 22, §§ 2º e 3º da Lei de Introdução às Normas do Direito Brasileiro (LINDB) e do Art. 156, § 1º da Lei nº 14.133/2021${isLei13303 ? " (aplicável de forma sistemática à dosimetria nas estatais sob o RILC)" : ""}, a dosimetria sancionadora não pode fundar-se em arbítrio desvinculado de parâmetros comparativos. Constatou-se carência de ancoragem em precedentes sancionadores da Corte de Contas e/ou omissão na ponderação concreta dos vetores legais (natureza, gravidade, danos comprovados e antecedentes). Recomenda-se instruir os autos com memória comparativa de precedentes e motivação analítica. (Ref. de Auditoria: ${tag})`,
      };
    case "[PAS_DISPROPORTIONATE_SANCTION_OUTLIER_BLOCK]":
      return {
        title: `${prefix}Desproporcionalidade Sancionatória e Excesso de Dosimetria sem Agravantes Comprovadas`,
        body: `À luz do princípio constitucional da proporcionalidade e do Art. 22, § 2º da LINDB (c/c Art. 156, § 1º da Lei nº 14.133/2021), a penalidade proposta configura excesso punitivo injustificado (outlier), por superar a faixa referencial de precedentes ou aproximar-se do patamar máximo sancionatório sem que constem circunstâncias agravantes formalmente comprovadas no processo. Recomenda-se a revisão e redução proporcional da penalidade proposta. (Ref. de Auditoria: ${tag})`,
      };
    case "[SURETY_INSURER_NOTIFICATION_REQUIRED_BLOCK]":
      return {
        title: `${prefix}Omissão de Comunicação Formal à Seguradora ou Irregularidade no Seguro-Garantia`,
        body: isLei13303
          ? `Nos termos do Art. 70 da Lei Federal nº 13.303/2016 e das cláusulas contratuais de garantia securitária (em simetria ao Art. 102 da Lei nº 14.133/2021), a instauração de procedimento apuratório por inadimplemento em contrato garantido por Seguro-Garantia exige comunicação formal tempestiva à seguradora e manutenção da vigência da apólice. Recomenda-se notificar imediatamente a companhia seguradora sobre a expectativa de sinistro. (Ref. de Auditoria: ${tag})`
          : `Consoante o Art. 102 da Lei Federal nº 14.133/2021, havendo garantia contratual na modalidade Seguro-Garantia e configuração de inadimplemento contratual, é obrigatória a comprovação de vigência da apólice e a expedição de notificação formal à seguradora, sob pena de decaimento ou prejuízo à execução da cobertura. Recomenda-se intimar imediatamente a seguradora e regularizar o endosso vigente. (Ref. de Auditoria: ${tag})`,
      };
    case "[SLA_GLOSA_MISCLASSIFIED_AS_PENALTY_BLOCK]":
      return {
        title: `${prefix}Confusão Conceitual entre Glosa Retributiva de ANS/IMR e Multa Sancionatória`,
        body: `A redução proporcional de pagamento decorrente do não atingimento de metas em Acordo de Níveis de Serviço (ANS) ou Instrumento de Medição de Resultados (IMR) possui natureza estritamente remuneratória (adequação contraprestacional ao serviço efetivamente entregue), não se confundindo com multa sancionatória prevista ${isLei13303 ? "no Art. 83 da Lei nº 13.303/2016" : "no Art. 156 da Lei nº 14.133/2021"}. Recomenda-se o estorno ou reclassificação técnica do lançamento, evitando o bis in idem punitivo. (Ref. de Auditoria: ${tag})`,
      };
    case "[MULTA_BELOW_LEGAL_FLOOR_0_5PCT_OR_ABOVE_30PCT_BLOCK]":
      return {
        title: `${prefix}Violação aos Limites Legais de Alíquota de Multa Sancionatória`,
        body: isLei13303
          ? `O percentual de multa pecuniária proposto extrapola o limite máximo aceito de 30% (trinta por cento) sobre o valor contratual ou contraria a moderação sancionatória prevista na Lei nº 13.303/2016 e no RILC. Recomenda-se a imediata readequação da alíquota aos parâmetros normativos e contratuais. (Ref. de Auditoria: ${tag})`
          : `Nos termos do Art. 156, § 3º da Lei Federal nº 14.133/2021, a sanção de multa administrativa não poderá ser inferior a 0,5% (meio por cento) nem superior a 30% (trinta por cento) do valor do contrato licitado ou celebrado. Recomenda-se o ajuste imediato da dosimetria pecuniária para dentro da faixa legal cogente. (Ref. de Auditoria: ${tag})`,
      };
    case "[PRICE_BASKET_HIGH_DISPERSION_USE_MEDIAN]":
      return {
        title: `${prefix}Distorção Estatística em Cesta de Preços por Alta Dispersão (IN SEGES nº 65/2021)`,
        body: `A pesquisa de preços analisada apresenta coeficiente de variação superior a 25% (alta dispersão), evidenciando contaminação da média aritmética simples por valores discrepantes (outliers). Em conformidade com a IN SEGES/ME nº 65/2021 e as boas práticas do controle externo, impõe-se a adoção da Mediana Amostral ou da Média Saneada como parâmetro de vantajosidade econômica. (Ref. de Auditoria: ${tag})`,
      };
    case "[EXTRAORDINARY_RISK_ALLOCATED_TO_CONTRACTOR_BLOCK]":
      return {
        title: `${prefix}Improcedência de Reequilíbrio por Risco Alocado à Contratada na Matriz de Riscos`,
        body: isLei13303
          ? `Nos termos do Art. 42, inciso X e Art. 69, inciso X c/c Art. 81 da Lei nº 13.303/2016, eventos ordinários ou riscos expressamente alocados à contratada na Matriz de Riscos contratual não autorizam revisão extraordinária dos preços pactuados. Recomenda-se o indeferimento do pleito de reequilíbrio. (Ref. de Auditoria: ${tag})`
          : `Consoante os Arts. 22, 103 e 124, inciso II, alínea "d" da Lei nº 14.133/2021, o restabelecimento do equilíbrio econômico-financeiro é incabível quando o evento alegado integrar álea ordinária ou estiver expressamente alocado à contratada na Matriz de Riscos. Recomenda-se o indeferimento técnico do pedido revisional. (Ref. de Auditoria: ${tag})`,
      };
    default:
      return {
        title: `${prefix}Apontamento Técnico-Jurídico de Conformidade Contratual`,
        body: `Foi identificado apontamento obstativo na verificação determinística da execução contratual sob ${humanizeShortRegime(isLei13303 ? "LEI_13303" : "LEI_14133")}, demandando revisão e saneamento formal nos autos do processo administrativo previamente à prática de ato decisório definitivo. (Ref. de Auditoria: ${tag})`,
      };
  }
}

export function buildFederativeTableRows(report: ContractAuditReport): string[][] {
  const pasList = report.pas_sanctions_analysis?.processes || [];
  const defaultCourt = report.pas_sanctions_analysis?.competent_audit_court || "TCU";
  if (pasList.length === 0) {
    return [[
      "Procedimento Padrão",
      humanizeSphereAndRegimeCell(undefined, undefined, undefined, report.legal_regime),
      defaultCourt,
      "Alcance restrito ao ente sancionador (Art. 156, § 4º da Lei nº 14.133/2021)",
      `Cadastros Obrigatórios: CEIS, CNEP, PNCP, ${defaultCourt}`,
    ]];
  }
  return pasList.map((p) => {
    const f = p.federative_adequacy;
    const court = f?.competent_audit_court || p.competent_audit_court || defaultCourt;
    const rowRegime = f?.legal_regime || report.legal_regime;
    const sphereLabel = humanizeSphereAndRegimeCell(f?.sphere, f?.uf, f?.municipality, rowRegime);
    const claimedScope = humanizeSanctionScope(f?.sanction_scope_claimed || p.recommended_scope);
    const terrText = f
      ? f.territorial_scope_ok
        ? `Alcance Pretendido: ${claimedScope} (Regular)`
        : `Alcance Pretendido: ${claimedScope} (Irregular — restrito à esfera do ente sancionador)`
      : `Alcance Aplicável: ${claimedScope}`;
    const estatalText = f
      ? f.state_enterprise_regime_ok
        ? isLei13303Regime(rowRegime) ? "Regime Estatal (Lei nº 13.303/2016): Regular" : "Regime Jurídico: Regular"
        : "Regime Estatal (Lei nº 13.303/2016): Irregular (extrapola o Art. 83, III)"
      : "";
    const authName = humanizeAuthorityRole(f?.signing_authority_role);
    const authText = f
      ? f.authority_competent_ok
        ? f.signing_authority_role ? `Autoridade: ${authName} (Competente)` : `Autoridade: ${authName}`
        : `Autoridade: ${authName} (Incompetente para Declaração de Inidoneidade)`
      : `Autoridade: ${authName}`;
    const opinionText = f
      ? f.conclusive_legal_opinion_ok ? "Parecer Jurídico: Presente" : "Parecer Jurídico: Ausente (Obrigatório no Art. 156, § 6º)"
      : "Parecer Jurídico: Não informado";
    const reqList = f?.required_registries?.length ? f.required_registries.join(", ") : `CEIS, CNEP, PNCP, ${court}`;
    const regStatus = f
      ? f.registries_ok
        ? `Cadastros Obrigatórios: ${reqList} — Comando de inscrição regular`
        : `Cadastros Obrigatórios: ${reqList} — Omissão de comando em ${f.missing_registries.join(", ")}`
      : `Cadastros Obrigatórios: ${reqList}`;
    return [p.process_id, sphereLabel, court, [terrText, estatalText, authText, opinionText].filter(Boolean).join("; "), regStatus];
  });
}

export function buildDosimetryTableRows(report: ContractAuditReport): string[][] {
  const pasList = report.pas_sanctions_analysis?.processes || [];
  if (pasList.length === 0) {
    return [[
      "Procedimento Padrão",
      "Sem penalidade pecuniária especificada",
      "Precedentes da Corte de Contas",
      "Faixa proporcional (Art. 156, § 1º)",
      "Precedentes: Não parametrizados; LINDB Art. 22: Pendente de instrução; Diagnóstico: NÃO CALIBRADA / CARENTE DE MOTIVAÇÃO (LINDB Art. 22)",
    ]];
  }
  return pasList.map((p) => {
    const d = p.dosimetry_calibration;
    const sanctionLabel = humanizeSanctionType(p.proposed_sanction || p.recommended_sanction);
    const penaltyCol = p.fine_pct !== undefined ? `${sanctionLabel} (Alíquota de ${p.fine_pct}%)` : sanctionLabel;
    const precedents = d && d.precedent_ids.length > 0 ? d.precedent_ids.join(", ") : "Ausente (Sem precedentes formais informados)";
    const faixa = d?.benchmark_range_pct
      ? `Faixa de ${d.benchmark_range_pct[0]}% a ${d.benchmark_range_pct[1]}% (Mediana de ${d.benchmark_median_pct ?? "não informada"}%)`
      : d?.benchmark_median_pct !== undefined
        ? `Mediana Referencial de ${d.benchmark_median_pct}%`
        : "Não parametrizada nos autos";
    const precText = d?.calibrated_with_precedents ? "Ancorada em precedentes" : "Ausente";
    const lindbText = d?.lindb_art22_vectors_weighed ? "Ponderada" : "Omitida";
    const aggText = d?.aggravating_factors_proven ? "Comprovadas" : "Não comprovadas";
    let diagText: string;
    if (!d) {
      diagText = "NÃO CALIBRADA / CARENTE DE MOTIVAÇÃO (LINDB Art. 22)";
    } else if (d.outlier_detected) {
      diagText = !d.calibrated_with_precedents || !d.lindb_art22_vectors_weighed
        ? "DESPROPORCIONAL / OUTLIER — NÃO CALIBRADA (LINDB Art. 22)"
        : "DESPROPORCIONAL / OUTLIER (EXCESSO SEM AGRAVANTES)";
    } else if (!d.calibrated_with_precedents || !d.lindb_art22_vectors_weighed) {
      diagText = "NÃO CALIBRADA / CARENTE DE MOTIVAÇÃO (LINDB Art. 22)";
    } else {
      diagText = "PROPORCIONAL E CALIBRADA";
    }
    const lindbCol = `Precedentes: ${precText}; LINDB Art. 22: ${lindbText}; Agravantes: ${aggText}; Diagnóstico: ${diagText}`;
    return [p.process_id, penaltyCol, precedents, faixa, lindbCol];
  });
}
