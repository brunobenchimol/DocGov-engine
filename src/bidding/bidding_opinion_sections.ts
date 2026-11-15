// ============================================================================
// Seções 1 a 6 do Parecer Técnico-Jurídico de Julgamento TIC (Gen6)
// docgov-engine v1.6.1 — src/bidding/bidding_opinion_sections.ts
// ============================================================================

import type { BiddingProposalDossier } from "./types.ts";
import {
  pDocHeader,
  pHeading,
  pBody,
  pBullet,
  pCallout,
  buildTableXml,
  pSignatureBlock,
} from "./bidding_xml_primitives.ts";
import {
  isLei13303Regime,
  formatLegalRegime,
  formatShortLegalRegime,
  formatProposalDecision,
  formatDossierStatus,
  formatEvaluationStance,
  formatMetricFullName,
  translateForensicVectorName,
  formatBRL,
  formatNumberBR,
  formatPercentBR,
  formatIndexBR,
  formatDateBR,
  describeBiddingTagLegalProse,
} from "./bidding_legal_humanizer.ts";

function buildSection1ExecSummary(dossier: BiddingProposalDossier): string[] {
  const shortLaw = formatShortLegalRegime(dossier.legal_regime);
  const tone =
    dossier.decision === "APPROVED" ? "ok" : dossier.decision === "DILIGENCE_REQUIRED" ? "warn" : "danger";

  return [
    pDocHeader(
      `ORGAO_CONTRATANTE — COMISSÃO DE CONTRATAÇÃO E EQUIPE TÉCNICA DE TIC (${shortLaw})`,
      `PARECER TÉCNICO-JURÍDICO DE JULGAMENTO DE PROPOSTA, EXEQUIBILIDADE E HABILITAÇÃO EM TIC — ${dossier.process_id}`,
      `Análise Determinística de Conformidade e Auditoria Forense | Motor de Governança docgov-engine v${dossier.engine_version}`
    ),
    pHeading("1. Identificação Processual e Síntese Executiva do Julgamento", 1),
    pBody(
      `Submete-se à apreciação técnico-jurídica a proposta comercial e a documentação de habilitação apresentadas pela licitante ${dossier.bidder_name} (CNPJ nº ${dossier.bidder_cnpj}) no bojo do procedimento ${dossier.process_id}, regido pela ${formatLegalRegime(dossier.legal_regime)}, abrangendo a modelagem de execução em TIC sem dedicação exclusiva de mão de obra (Não-DEMO), a exequibilidade paramétrica por perfis profissionais, a conversibilidade técnico-operacional, os indicadores econômico-financeiros e a auditoria forense dos Atestados de Capacidade Técnica (ACT).`
    ),
    buildTableXml(
      ["Parâmetro de Julgamento", "Resultado Apurado nos Autos"],
      [
        ["Processo Administrativo / Licitatório", dossier.process_id],
        ["Licitante Proponente", `${dossier.bidder_name} (CNPJ: ${dossier.bidder_cnpj})`],
        ["Valor Global Estimado da Contratação", formatBRL(dossier.estimated_total_value ?? dossier.raw_context?.estimated_total_value)],
        ["Regime Jurídico Aplicável", formatLegalRegime(dossier.legal_regime)],
        ["Postura Analítica Adotada", formatEvaluationStance(dossier.evaluation_stance)],
        ["Situação Processual Consolidada", formatDossierStatus(dossier.status)],
        ["Decisão Técnica Recomendada", formatProposalDecision(dossier.decision)],
        [
          "Quantitativo de Óbices e Alertas",
          `${dossier.blocking_tags.length} apontamento(s) normativo(s) e ${dossier.act_forensics.total_alerts} alerta(s) forense(s) em ACT`,
        ],
      ],
      [3.4, 5.6]
    ),
    pCallout(
      `CONCLUSÃO SINTÉTICA — ${formatProposalDecision(dossier.decision)}`,
      dossier.blocking_tags.length > 0
        ? `Foram identificados ${dossier.blocking_tags.length} apontamento(s) normativo(s) e/ou forense(s) que impedem a adjudicação imediata sem prévio saneamento ou diligência formal, conforme detalhado nas seções técnicas e no quadro consolidado ao final deste parecer.`
        : "Todos os parâmetros técnicos de execução de TIC, exequibilidade, qualificação técnico-operacional, capacidade econômico-financeira e integridade forense dos atestados apresentaram plena conformidade legal.",
      tone
    ),
  ];
}

function buildSection2IctModel(dossier: BiddingProposalDossier): string[] {
  const ict = dossier.ict_execution;
  const model = dossier.raw_context?.ict_execution_model || {};
  const is13303 = isLei13303Regime(dossier.legal_regime);

  const allocationStatus = ict.demo_trap_detected
    ? "Irregular — Indício de Alocação Oculta de Mão de Obra (DEMO disfarçada)"
    : ict.non_demo_legitimacy_verified
    ? "Regular — Execução Legítima Orientada a Resultados e ANS (Não-DEMO)"
    : "Em Observação — Necessária comprovação de dispensa de conta vinculada via Índice TIC";

  const metricCompliance = ict.metric_compliance_ok
    ? "Conforme com a Súmula TCU nº 269 e jurisprudência aplicável"
    : "Não Conforme — Violação à métrica por resultado ou ausência de catálogo/teto";

  const parts: string[] = [
    pHeading("2. Análise do Modelo de Execução de TIC (Não-DEMO) e Métricas de Remuneração", 1),
    pBody(
      is13303
        ? "Nos termos do Art. 31 da Lei nº 13.303/2016, da Súmula TST nº 331 e dos Acórdãos TCU nº 1.508/2020 e nº 2.503/2024-Plenário, contratações de Tecnologia da Informação e Comunicação baseadas em resultados não podem mascarar locação permanente de mão de obra com subordinação direta ou controle de jornada, sob pena de responsabilidade trabalhista subsidiária e desvirtuamento do modelo licitatório."
        : "Nos termos dos Arts. 18 e 48 da Lei nº 14.133/2021, da Instrução Normativa SGD/ME nº 94/2022, da Súmula TCU nº 269 e dos Acórdãos TCU nº 1.508/2020 e nº 2.503/2024-Plenário, a contratação de serviços de TIC por resultado exige objetividade na mensuração de entregas, catálogo de atividades ponderado por complexidade e ausência de ingerência patronal sobre os profissionais da contratada."
    ),
    buildTableXml(
      ["Aspecto Avaliado do Modelo TIC", "Constatação Técnica"],
      [
        ["Métrica Principal de Remuneração", formatMetricFullName(ict.metric_type)],
        ["Classificação Quanto à Dedicação de Mão de Obra", allocationStatus],
        ["Conformidade da Métrica Adotada", metricCompliance],
        [
          "Controle de Horário / Pessoalidade Nominal na OS / Subordinação",
          model.requires_fixed_schedule_or_timeclock ||
          model.requires_named_individuals_in_os ||
          model.has_direct_hierarchical_subordination
            ? "Detectados elementos de pessoalidade ou subordinação direta (Vício DEMO)"
            : "Ausentes (gestão técnica autônoma pela contratada)",
        ],
        [
          "Catálogo Ponderado / Teto Prévio de OS / Vinculação a ANS",
          model.has_complexity_weighted_activity_catalog === false
            ? "Ausência de catálogo ponderado por complexidade (Paridade 1:1 ilícita)"
            : model.links_payment_to_sprint_throughput_and_ans === false
            ? "Pagamento desvinculado de entregáveis medidos e metas de ANS"
            : "Critérios de aferição de entregas e ANS compatíveis com os dados informados",
        ],
      ],
      [3.6, 5.4]
    ),
  ];

  for (const f of ict.findings) {
    if (!/piso paramétrico|Súmula TCU nº 262/i.test(f)) {
      parts.push(pBullet("Constatação do Modelo TIC", f));
    }
  }
  return parts;
}

function buildSection3Exequibility(dossier: BiddingProposalDossier): string[] {
  const ict = dossier.ict_execution;
  const profiles = dossier.raw_context?.proposal_exequibility?.profiles_breakdown || [];
  const floorVal = ict.parametric_floor_value;
  const offeredVal = ict.offered_unit_value;
  const diffPct =
    floorVal > 0 && offeredVal !== undefined ? ((offeredVal - floorVal) / floorVal) * 100 : null;

  const parts: string[] = [
    pHeading("3. Exequibilidade Paramétrica dos Perfis de TI e Rito da Súmula TCU nº 262", 1),
    pBody(
      `A aferição de exequibilidade em serviços técnicos de TIC não pode limitar-se a reduções lineares arbitrárias, devendo confrontar o valor unitário ofertado com o piso paramétrico derivado da remuneração mínima de mercado dos perfis profissionais exigidos, acrescido de encargos sociais, tributos e despesas administrativas (${isLei13303Regime(dossier.legal_regime) ? "Art. 56, § 2º da Lei nº 13.303/2016" : "Art. 59 da Lei nº 14.133/2021"} e Súmula TCU nº 262).`
    ),
  ];

  if (profiles.length > 0) {
    const profileRows = profiles.map((p) => {
      const sal = Number(p.salary_floor || 0);
      const enc = Number(p.social_charges_pct ?? 70);
      const tax = Number(p.taxes_and_admin_pct ?? 18);
      const units = Number(p.monthly_productive_units ?? 168);
      const unitCost = units > 0 ? (sal * (1 + enc / 100) * (1 + tax / 100)) / units : 0;
      return [
        p.profile_name,
        formatBRL(sal),
        formatPercentBR(enc, 1),
        formatPercentBR(tax, 1),
        `${formatNumberBR(units, 0)} unid.`,
        formatBRL(unitCost),
      ];
    });
    parts.push(
      buildTableXml(
        ["Perfil Profissional de TI", "Piso Salarial", "Encargos", "BDI/Tributos", "Base Mensal", "Custo Unitário"],
        profileRows,
        [2.6, 1.5, 1.1, 1.2, 1.3, 1.4]
      )
    );
  }

  parts.push(
    buildTableXml(
      ["Indicador de Exequibilidade", "Valor / Resultado Apurado"],
      [
        ["Métrica de Cotação", formatMetricFullName(ict.metric_type)],
        ["Piso Paramétrico Mínimo Apurado", floorVal > 0 ? formatBRL(floorVal) : "Não informado"],
        ["Valor Unitário Ofertado pela Licitante", offeredVal !== undefined ? formatBRL(offeredVal) : "Não informado"],
        [
          "Desvio Relativo Frente ao Piso Paramétrico",
          diffPct !== null ? `${formatPercentBR(diffPct, 2)} (${diffPct < 0 ? "abaixo do piso" : "igual ou acima do piso"})` : "Não aplicável",
        ],
        [
          "Diagnóstico de Exequibilidade",
          ict.is_exequible
            ? "Proposta compatível com o referencial paramétrico mínimo (Exequível)"
            : "Abaixo do piso paramétrico — risco de inexequibilidade (exige comprovação de custos)",
        ],
      ],
      [3.8, 5.2]
    ),
    pCallout(
      "MANDATO VINCULANTE DA SÚMULA TCU Nº 262 E ART. 59, § 2º DA LEI Nº 14.133/2021",
      ict.diligence_required
        ? `A presunção de inexequibilidade decorrente de oferta (${formatBRL(offeredVal)}) inferior ao piso paramétrico (${formatBRL(floorVal)}) é estritamente relativa. É VEDADA a desclassificação sumária da licitante sem que lhe seja previamente facultada diligência formal para demonstrar a viabilidade de sua planilha de custos e formação de preços.`
        : "Observa-se, em caráter permanente, que qualquer decisão de desclassificação por preço supostamente inexequível deve ser obrigatoriamente precedida de oportunidade de defesa e comprovação de exequibilidade em diligência formal, nos termos da Súmula TCU nº 262.",
      ict.diligence_required ? "danger" : "info"
    )
  );
  return parts;
}

function buildSection4Qualification(dossier: BiddingProposalDossier): string[] {
  const qual = dossier.qualification;
  const fin = dossier.raw_context?.financial_qualification || {};
  const tech = dossier.raw_context?.technical_qualification || {};
  const editalMetric = String(tech.edital_metric || dossier.ict_execution.metric_type || "UST").toUpperCase();
  const certs = tech.presented_certificates || [];
  const reqParcels = tech.required_parcels || [];

  const parts: string[] = [
    pHeading("4. Qualificação Técnico-Operacional (Conversibilidade) e Econômico-Financeira", 1),
    pHeading("4.1. Conversibilidade Paramétrica de Métricas em ACT e Teto Legal (Súmula TCU nº 263)", 2),
    pBody(
      `No julgamento da capacidade técnico-operacional, a exigência de atestados deve observar o equilíbrio entre a segurança contratual e a ampla competitividade (${formatShortLegalRegime(dossier.legal_regime)}), admitindo-se a equivalência paramétrica entre métricas correlatas de TIC (UST, Horas Técnicas, Pontos de Função, Postos e Chamados), o somatório de atestados quando inexistir indivisibilidade técnica justificada e o respeito aos limites de 50% (cinquenta por cento) de quantitativo e 4% (quatro por cento) de materialidade da parcela.`
    ),
  ];

  if (certs.length > 0) {
    const certRows = certs.map((c, idx) => [
      c.certificate_id || `ACT-${idx + 1}`,
      c.metric || editalMetric,
      formatNumberBR(c.quantity ?? 0, 2),
      c.conversion_factor_to_edital_metric !== undefined ? formatNumberBR(c.conversion_factor_to_edital_metric, 4) : "Tabela padrão",
      formatNumberBR(
        Number(c.quantity || 0) * (c.conversion_factor_to_edital_metric ?? 1),
        2
      ),
    ]);
    parts.push(
      buildTableXml(
        ["Atestado", "Métrica Original", "Qtd. Original", "Fator Conversão", `Qtd. em ${editalMetric}`],
        certRows,
        [2.2, 1.8, 1.6, 1.6, 1.9]
      )
    );
  }

  if (reqParcels.length > 0) {
    const parcelRows = reqParcels.map((p) => {
      const tot = Number(p.total_quantity || 0);
      const min = Number(p.required_minimum_quantity || 0);
      const pct = tot > 0 ? (min / tot) * 100 : 0;
      return [
        p.description || "Parcela de TIC",
        formatBRL(p.estimated_item_value),
        formatNumberBR(tot, 2),
        `${formatNumberBR(min, 2)} (${formatPercentBR(pct, 1)})`,
      ];
    });
    parts.push(
      buildTableXml(
        ["Parcela de Relevância Exigida", "Valor Estimado", "Qtd. Total Licitada", "Mínimo Exigido (%)"],
        parcelRows,
        [3.3, 1.8, 1.8, 2.2]
      )
    );
  }

  parts.push(
    pBody(
      `Total técnico convertido apurado na métrica do edital (${editalMetric}): ${formatNumberBR(qual.converted_total_quantity, 2)} (Conversão paramétrica aplicada: ${qual.conversion_applied ? "Sim" : "Não necessária"}; Conformidade das regras técnicas de habilitação: ${qual.tech_rules_ok ? "Conforme" : "Contém restrição ilegal detectada"}).`
    ),
    pHeading("4.2. Análise Contábil e Econômico-Financeira (Súmula TCU nº 275 e Teto de 10%)", 2),
    buildTableXml(
      ["Indicador Contábil", "Fórmula Aplicada", "Valor Apurado", "Parâmetro de Referência"],
      [
        ["Índice de Liquidez Geral (ILG)", "(AC + RLP) / (PC + PNC)", formatIndexBR(qual.financial_indices.ilg), ">= 1,00 (usuais em licitações)"],
        ["Índice de Liquidez Corrente (ILC)", "AC / PC", formatIndexBR(qual.financial_indices.ilc), ">= 1,00 (saúde financeira imediata)"],
        ["Índice de Solvência Geral (ISG)", "Ativo Total / (PC + PNC)", formatIndexBR(qual.financial_indices.isg), ">= 1,00 (cobertura patrimonial)"],
        ["Endividamento Geral (EG)", "(PC + PNC) / Ativo Total", formatIndexBR(qual.financial_indices.eg), "<= 0,50 a 1,00 (conforme edital)"],
        [
          "Capital Social / Patrimônio Líquido",
          "Teto <= 10% sem cumulação (Súmula TCU 275)",
          `CS: ${formatBRL(fin.capital_social)} | PL: ${formatBRL(fin.patrimonio_liquido)}`,
          qual.financial_rules_ok ? "Regular" : "Violação detectada (Cumulação ou > 10%)",
        ],
      ],
      [2.5, 2.2, 2.2, 2.2]
    )
  );
  return parts;
}

function buildSection5ActForensics(dossier: BiddingProposalDossier): string[] {
  const parts: string[] = [
    pHeading("5. Auditoria Pericial e Forense dos Atestados de Capacidade Técnica (7 Vetores Anti-Fraude)", 1),
  ];

  const items = dossier.act_forensics.items;
  const rawActs = dossier.raw_context?.act_forensic_items || [];
  if (items.length === 0) {
    parts.push(
      pBody("Nenhum Atestado de Capacidade Técnica foi submetido ao módulo de varredura forense nesta análise.")
    );
    return parts;
  }

  parts.push(
    pBody(
      `Foram submetidos à matriz forense de 7 (sete) vetores investigativos ${dossier.act_forensics.certificates_audited} atestado(s), resultando na detecção de ${dossier.act_forensics.total_alerts} alerta(s) crítico(s) de autenticidade e lastro operacional.`
    )
  );

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    const raw = rawActs[i] || {};
    const vectorsHuman =
      a.triggered_vectors.length > 0
        ? a.triggered_vectors.map((v) => translateForensicVectorName(v)).join("; ")
        : "Nenhum vetor suspeito acionado";

    parts.push(
      pHeading(`5.${i + 1}. Ficha Pericial do Atestado ${a.certificate_id} — ${a.issuer_name}`, 2),
      buildTableXml(
        ["Campo Pericial", "Dados Apurados"],
        [
          ["Emissor Declarado / CNPJ", `${a.issuer_name} (CNPJ: ${a.issuer_cnpj})`],
          [
            "Situação RFB / Porte / CNAE",
            `Situação: ${raw.issuer_cnpj_status || "Não informada"} | Porte: ${raw.issuer_porte || "Não informado"} | CNAE: ${raw.issuer_cnae_primary || "Não informado"}`,
          ],
          [
            "Cronologia (Abertura / Execução / Emissão / PDF)",
            `Abertura CNPJ: ${formatDateBR(raw.issuer_opening_date)} | Início Exec.: ${formatDateBR(raw.execution_start_date)} | Emissão ACT: ${formatDateBR(raw.act_issue_date)} | PDF/Assinatura: ${formatDateBR(raw.digital_signature_date || raw.pdf_creation_date)}`,
          ],
          [
            "Rastreabilidade PNCP / Volume Atestado",
            `PNCP verificado: ${raw.pncp_contract_verified === true ? "Sim" : raw.pncp_contract_verified === false ? "Não localizado" : "Não aplicável"} | Volume: ${raw.attested_volume !== undefined ? `${formatNumberBR(raw.attested_volume, 0)} unid. em ${raw.execution_months ?? "?"} meses` : "Não informado"}`,
          ],
          ["Vetores Forenses Acionados", vectorsHuman],
          ["Tags de Auditoria Vinculadas", a.blocking_tags.join(" ") || "CONFORME"],
        ],
        [3.1, 6.0]
      )
    );
    for (const d of a.details) {
      parts.push(pBullet("Detalhamento Pericial", d));
    }
  }
  return parts;
}

function buildSection6ConsolidatedConclusion(dossier: BiddingProposalDossier): string[] {
  const parts: string[] = [
    pHeading("6. Quadro Consolidado de Apontamentos, Recomendações e Dispositivo Conclusivo", 1),
  ];

  if (dossier.blocking_tags.length > 0) {
    const rows = dossier.blocking_tags.map((tag, idx) => {
      const info = describeBiddingTagLegalProse(tag, dossier);
      return [
        String(idx + 1).padStart(2, "0"),
        `${info.title}\nBase Legal: ${info.legalBasis}`,
        `${info.factualAnalysis}\nRecomendação: ${info.recommendation}`,
        tag,
      ];
    });
    parts.push(
      buildTableXml(
        ["Nº", "Tipificação Jurídica e Norma", "Análise Fática e Saneamento Recomendado", "Rastreabilidade"],
        rows,
        [0.6, 2.7, 3.9, 1.9]
      )
    );
  } else {
    parts.push(
      pCallout(
        "CONFORMIDADE PLENA VERIFICADA",
        "Não foram detectados óbices normativos, vícios de modelagem de TIC, indícios de inexequibilidade ou inconsistências forenses nos atestados apresentados, estando a instrução apta ao prosseguimento regular.",
        "ok"
      )
    );
  }

  parts.push(
    pHeading("Conclusão e Encaminhamento", 2),
    pBody(
      `Ante o exposto, com fundamento na ${formatLegalRegime(dossier.legal_regime)} e na jurisprudência vinculante do Tribunal de Contas da União, opina-se pela decisão: ${formatProposalDecision(dossier.decision)}, devendo o presente parecer integrar os autos do processo administrativo ${dossier.process_id} para fundamentação decisória da autoridade competente e adoção imediata das diligências recomendadas.`,
      true
    ),
    ...pSignatureBlock([
      "Pregoeiro(a) / Agente de Contratação",
      "Integrante Técnico de TIC — Equipe de Planejamento e Apoio",
    ])
  );
  return parts;
}

export function buildBiddingJudgmentOpinionXmlParts(dossier: BiddingProposalDossier): string[] {
  return [
    ...buildSection1ExecSummary(dossier),
    ...buildSection2IctModel(dossier),
    ...buildSection3Exequibility(dossier),
    ...buildSection4Qualification(dossier),
    ...buildSection5ActForensics(dossier),
    ...buildSection6ConsolidatedConclusion(dossier),
  ];
}
