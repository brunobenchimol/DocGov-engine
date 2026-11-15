// ============================================================================
// Seções 1 a 3 do Parecer de Contratação Direta & Oportunidade Estatal (Gen6)
// docgov-engine v1.6.1 — src/direct_contracting/direct_contracting_sections.ts
// ============================================================================

import type { DirectContractingAuditDossier } from "./types.ts";
import {
  pDocHeader,
  pHeading,
  pBody,
  pCallout,
  buildTableXml,
  pSignatureBlock,
} from "../bidding/bidding_xml_primitives.ts";
import {
  isLei13303Regime,
  formatLegalRegime,
  formatShortLegalRegime,
  formatBRL,
  formatBRLAllowZero,
  formatDateBR,
} from "../bidding/bidding_legal_humanizer.ts";

interface DirectTagProse {
  title: string;
  legalBasis: string;
  factualAnalysis: string;
  recommendation: string;
}

function formatDirectModality(modality: string): string {
  switch (modality) {
    case "INEXIGIBILIDADE":
      return "Inexigibilidade de Licitação (Fornecedor Exclusivo / Notória Especialização)";
    case "DISPENSA_VALOR":
      return "Dispensa de Licitação em Razão do Valor (Controle de Fracionamento)";
    case "OPORTUNIDADE_NEGOCIO_ESTATAL":
      return "Oportunidade de Negócio Estratégico em Empresa Estatal (Art. 28, § 3º, II, Lei nº 13.303/2016)";
    default:
      return modality;
  }
}

function formatDirectDecision(decision: string): string {
  return decision === "APPROVED"
    ? "Aprovada — Instrução Processual Apta ao Prosseguimento da Contratação Direta"
    : "Reprovada — Instrução Bloqueada até Saneamento Integral dos Óbices Legais";
}

function formatDirectStatus(status: string): string {
  if (status === "success") return "Regular e Conforme";
  if (status === "warning") return "Em Alerta Preventivo";
  return "Bloqueada por Inconformidade Normativa";
}

function describeDirectTagLegalProse(
  tag: string,
  dossier: DirectContractingAuditDossier
): DirectTagProse {
  const is13303 = isLei13303Regime(dossier.legal_regime);
  const inex = dossier.inexigibility_summary;
  const disp = dossier.dispensation_summary;
  const certIssuer = dossier.raw_context?.inexigibility_details?.exclusivity_certificate?.issuer_entity;

  switch (tag) {
    case "[INEXIGIBILITY_COMPETITION_VIABILITY_UNPROVEN_BLOCK]":
      return {
        title: "Ausência de Comprovação Objetiva da Inviabilidade de Competição",
        legalBasis: is13303
          ? "Art. 30, caput e § 3º da Lei Federal nº 13.303/2016 e Princípio da Motivação"
          : "Art. 74, caput e inciso I da Lei Federal nº 14.133/2021 e Jurisprudência do TCU",
        factualAnalysis:
          "Os autos não demonstram tecnicamente que apenas o fornecedor selecionado é capaz de atender às necessidades da Administração, subsistindo indicativos de pluralidade de soluções ou fornecedores no mercado.",
        recommendation:
          "Elaborar Estudo Técnico Preliminar (ETP) robusto demonstrando tecnicamente a singularidade da solução ou instaurar procedimento licitatório competitivo.",
      };
    case "[INVALID_EXCLUSIVITY_CERTIFICATE_BLOCK]":
      return {
        title: "Atestado de Exclusividade Inválido, Genérico ou sem Abrangência Adequada",
        legalBasis: is13303
          ? "Art. 30, I da Lei nº 13.303/2016 e Súmula TCU nº 255"
          : "Art. 74, § 1º da Lei Federal nº 14.133/2021 e Súmula TCU nº 255",
        factualAnalysis: `O certificado de exclusividade${certIssuer ? ` (emissor declarado: ${certIssuer})` : ""} apresenta vício de validade: autodeclaração genérica, emissão sem legitimidade comprovada nos termos da Súmula TCU nº 255 ou restrição territorial injustificada.`,
        recommendation:
          "Obter atestado idôneo expedido por sindicato, federação, confederação patronal ou entidade equivalente com abrangência territorial compatível e realizar confirmação de autenticidade junto ao emissor (Súmula TCU nº 255).",
      };
    case "[INEXIGIBILITY_PRICE_PROOF_INSUFFICIENT_BLOCK]":
      return {
        title: "Insuficiência de Comprovação da Razoabilidade e Compatibilidade de Preços",
        legalBasis: is13303
          ? "Art. 30, § 3º, III e Art. 31 da Lei nº 13.303/2016"
          : "Art. 23, § 4º e Art. 72, VII da Lei Federal nº 14.133/2021; Art. 7º da IN SEGES/ME nº 65/2021",
        factualAnalysis: `Foram juntados apenas ${inex?.valid_market_price_proofs_count ?? 0} documento(s) comprobatório(s) de preços praticados pelo mesmo fornecedor, abaixo do mínimo de 3 (três) Notas Fiscais ou contratos vigentes celebrados com terceiros.`,
        recommendation:
          "Anexar no mínimo 3 (três) Notas Fiscais eletrônicas ou contratos recentes celebrados pelo contratado com outros órgãos públicos ou entes privados em condições análogas, ou justificativa formal de ausência de histórico.",
      };
    case "[EXPENSE_FRAGMENTATION_BLOCK]": {
      const accum = formatBRLAllowZero(disp?.accumulated_total_in_branch);
      const limit = formatBRLAllowZero(disp?.legal_annual_limit);
      const excess =
        disp !== undefined
          ? formatBRLAllowZero(Math.max(0, disp.accumulated_total_in_branch - disp.legal_annual_limit))
          : "Não apurado";
      return {
        title: "Fracionamento Ilícito de Despesa na Mesma Unidade Gestora e Ramo de Atividade",
        legalBasis: is13303
          ? "Art. 29, incisos I e II da Lei Federal nº 13.303/2016 e Jurisprudência do TCU"
          : "Art. 75, incisos I e II e § 1º da Lei Federal nº 14.133/2021",
        factualAnalysis: `Na Unidade Gestora ${disp?.managing_unit_code || "UG"} (exercício ${disp?.financial_year || ""}), o somatório anual para o ramo/PDM ${disp?.activity_branch_code || "PDM"} atingiu ${accum}, ultrapassando em ${excess} o teto legal vigente de ${limit}.`,
        recommendation:
          "Suspender imediatamente a contratação direta por valor, planejar a demanda anual consolidada da UG para o respectivo ramo PDM/CATMAT/CATSER e instaurar licitação regular.",
      };
    }
    case "[STATE_ENTERPRISE_PARTNERSHIP_UNJUSTIFIED_BLOCK]":
      return {
        title: "Desatendimento aos Requisitos da Oportunidade de Negócio em Empresa Estatal",
        legalBasis: "Art. 28, § 3º, inciso II e § 4º da Lei Federal nº 13.303/2016 e Jurisprudência do TCU",
        factualAnalysis:
          "A instrução falhou em comprovar cumulativamente a vinculação ao objeto social da estatal, a singularidade do parceiro privado, a inviabilidade de procedimento competitivo, a matriz formal de compartilhamento de riscos e receitas e/ou a não caracterização de compra comum disfarçada.",
        recommendation:
          "Reestruturar a governança da parceria com matriz detalhada de riscos/retornos ou converter a demanda em certame competitivo ordinário sob o RILC.",
      };
    default:
      return {
        title: `Apontamento Normativo (${tag})`,
        legalBasis: formatLegalRegime(dossier.legal_regime),
        factualAnalysis: "Irregularidade apontada durante a verificação determinística de contratação direta.",
        recommendation: "Sanear integralmente o óbice registrado nos autos antes da ratificação pela autoridade.",
      };
  }
}

function buildSection1Summary(dossier: DirectContractingAuditDossier): string[] {
  const shortLaw = formatShortLegalRegime(dossier.legal_regime);
  const disp = dossier.raw_context?.dispensation_by_value_details;
  const displayAmount =
    dossier.contracted_amount ??
    disp?.current_proposed_spend ??
    dossier.raw_context?.current_proposed_spend;
  const tone = dossier.decision === "APPROVED" ? "ok" : "danger";

  return [
    pDocHeader(
      `ORGAO_CONTRATANTE — ASSESSORIA JURÍDICA E CONTROLE INTERNO (${shortLaw})`,
      `PARECER DE AUDITORIA DE INSTRUÇÃO PROCESSUAL — ${dossier.process_id}`,
      `${formatDirectModality(dossier.modality)} | Motor Determinístico docgov-engine v${dossier.engine_version}`
    ),
    pHeading("1. Identificação Processual e Síntese Executiva", 1),
    pBody(
      `Examina-se a instrução administrativa do processo nº ${dossier.process_id}, formalizado na modalidade de ${formatDirectModality(dossier.modality)}, sob a égide da ${formatLegalRegime(dossier.legal_regime)}, com vistas à verificação da conformidade dos requisitos autorizadores da exceção ao dever constitucional de licitar (Art. 37, inciso XXI da CRFB/88).`
    ),
    buildTableXml(
      ["Elemento da Instrução Processual", "Dados e Resultado Apurado"],
      [
        ["Processo Administrativo", dossier.process_id],
        ["Modalidade de Contratação Direta / Parceria", formatDirectModality(dossier.modality)],
        ["Regime Jurídico Regente", formatLegalRegime(dossier.legal_regime)],
        ["Valor Proposto / Contratado", displayAmount !== undefined ? formatBRL(displayAmount) : "Não informado nos autos"],
        ["Situação da Instrução", formatDirectStatus(dossier.status)],
        ["Decisão Técnico-Jurídica", formatDirectDecision(dossier.decision)],
        ["Total de Óbices Bloqueantes", `${dossier.blocking_tags.length} apontamento(s)`],
      ],
      [3.5, 5.5]
    ),
    pCallout(
      `SÍNTESE DECISÓRIA — ${formatDirectDecision(dossier.decision)}`,
      dossier.blocking_tags.length > 0
        ? `Foram identificados ${dossier.blocking_tags.length} óbice(s) legal(is) bloqueante(s) que impedem a ratificação, autorização ou assinatura contratual sem o prévio saneamento instrutório discriminado neste parecer.`
        : "Todos os requisitos normativos e documentais da modalidade analisada foram integralmente atendidos, estando a instrução processual regular para deliberação superior.",
      tone
    ),
  ];
}

function buildSection2ModalityAudit(dossier: DirectContractingAuditDossier): string[] {
  const parts: string[] = [
    pHeading("2. Exame Analítico dos Requisitos Normativos da Modalidade", 1),
  ];

  if (dossier.inexigibility_summary) {
    const s = dossier.inexigibility_summary;
    const inexRaw = dossier.raw_context?.inexigibility_details || {};
    const certRaw = inexRaw.exclusivity_certificate || {};
    const proofs = inexRaw.supplier_market_price_proofs || [];

    parts.push(
      pBody(
        `A contratação direta por inexigibilidade fundamenta-se na impossibilidade fática ou jurídica de competição (${isLei13303Regime(dossier.legal_regime) ? "Art. 30 da Lei nº 13.303/2016" : "Art. 74 da Lei nº 14.133/2021"}), exigindo simultaneamente comprovação objetiva da exclusividade (Súmula TCU nº 255) e demonstração da compatibilidade do preço contratado com os valores praticados pelo próprio fornecedor no mercado (Art. 23, § 4º da Lei nº 14.133/2021 e IN SEGES/ME nº 65/2021).`
      ),
      buildTableXml(
        ["Requisito Legal da Inexigibilidade", "Verificação nos Autos", "Resultado"],
        [
          [
            "Inviabilidade Objetiva de Competição",
            inexRaw.legal_hypothesis || "Enquadramento técnico da inviabilidade",
            s.competition_infeasibility_proven ? "Comprovada" : "Não comprovada (Óbice)",
          ],
          [
            "Atestado de Exclusividade (Súmula TCU nº 255)",
            `Emissor: ${certRaw.issuer_entity || "Não informado"} | Verificação: ${certRaw.sumula_255_tcu_verified === false ? "Pendente/Falha" : "Verificada"}`,
            s.exclusivity_valid ? "Válido" : "Inválido ou Genérico (Óbice)",
          ],
          [
            "Provas de Preço no Mercado (Mínimo 3 NFs/Contratos)",
            `${s.valid_market_price_proofs_count} documento(s) hábil(eis) apresentado(s)`,
            s.valid_market_price_proofs_count >= 3 ? "Suficiente (>= 3)" : "Insuficiente (< 3)",
          ],
        ],
        [3.0, 3.8, 2.2]
      )
    );

    if (proofs.length > 0) {
      parts.push(
        buildTableXml(
          ["Tipo", "Identificador", "Tomador / Comprador", "Data Emissão", "Valor Unitário"],
          proofs.map((p) => [
            p.type || "Documento Fiscal",
            p.identifier || "N/A",
            p.buyer || "Não informado",
            formatDateBR(p.issue_date),
            formatBRL(p.unit_price),
          ]),
          [1.6, 2.0, 2.6, 1.4, 1.5]
        )
      );
    }
  }

  if (dossier.dispensation_summary) {
    const d = dossier.dispensation_summary;
    const rawDisp = dossier.raw_context?.dispensation_by_value_details || {};
    const prior = Number(rawDisp.prior_accumulated_spend_in_branch ?? dossier.raw_context?.prior_accumulated_spend_in_branch ?? 0);
    const current = Number(rawDisp.current_proposed_spend ?? dossier.raw_context?.current_proposed_spend ?? dossier.contracted_amount ?? 0);
    const excess = Math.max(0, d.accumulated_total_in_branch - d.legal_annual_limit);

    parts.push(
      pBody(
        `Nos termos do ${isLei13303Regime(dossier.legal_regime) ? "Art. 29, incisos I e II da Lei nº 13.303/2016" : "Art. 75, incisos I e II e § 1º da Lei nº 14.133/2021"}, o enquadramento de dispensa pelo baixo valor exige o somatório rigoroso do que for despendido no mesmo exercício financeiro pela respectiva Unidade Gestora (UG), com objetos de mesma natureza ou ramo de atividade (código PDM/CATMAT/CATSER), visando prevenir o fracionamento ilícito da despesa.`
      ),
      buildTableXml(
        ["Parâmetro de Controle Orçamentário (Dispensa por Valor)", "Valor / Registro Apurado"],
        [
          ["Unidade Gestora (UG) Responsável", d.managing_unit_code],
          ["Exercício Financeiro de Referência", String(d.financial_year)],
          ["Ramo de Atividade (PDM / CATMAT / CATSER)", d.activity_branch_code],
          ["Gasto Prévio Acumulado no Mesmo Ramo (Exercício)", formatBRLAllowZero(prior)],
          ["Valor da Nova Contratação Proposta", formatBRLAllowZero(current)],
          ["Somatório Anual Consolidado no Ramo", formatBRLAllowZero(d.accumulated_total_in_branch)],
          ["Limite Legal Anual Aplicável", formatBRLAllowZero(d.legal_annual_limit)],
          [
            "Situação Quanto ao Fracionamento de Despesa",
            d.fragmentation_detected
              ? `IRREGULAR — Excesso de ${formatBRLAllowZero(excess)} acima do teto legal`
              : "REGULAR — Despesa consolidada compatível com o limite anual",
          ],
        ],
        [4.2, 4.8]
      )
    );
  }

  if (dossier.state_opportunity_summary) {
    const o = dossier.state_opportunity_summary;
    parts.push(
      pBody(
        "A contratação direta fundada em oportunidade de negócio prevista no Art. 28, § 3º, inciso II e § 4º da Lei Federal nº 13.303/2016 constitui hipótese excepcionalíssima de atuação empresarial competitiva das empresas públicas e sociedades de economia mista, condicionada à presença cumulativa de cinco requisitos cumulativos e à vedação estrita ao desvirtuamento de compras rotineiras ou commodities."
      ),
      buildTableXml(
        ["Requisito Legal Cumulativo (Art. 28, §§ 3º e 4º, Lei nº 13.303/2016)", "Resultado Verificado"],
        [
          ["1. Vinculação direta ao objeto social estratégico da estatal", o.linked_to_corporate_purpose ? "Atendido" : "Não comprovado (Óbice)"],
          ["2. Singularidade competitiva e técnica específica do parceiro privado", o.partner_singularity_proven ? "Comprovada" : "Não comprovada (Óbice)"],
          ["3. Inviabilidade demonstrada de procedimento competitivo licitatório", o.competitive_infeasibility_proven ? "Demonstrada" : "Não demonstrada (Óbice)"],
          ["4. Matriz objetiva de compartilhamento de riscos e receitas entre partes", o.risk_revenue_matrix_present ? "Presente nos autos" : "Ausente (Óbice)"],
          ["5. Ausência de compra comum ou commodity disfarçada de parceria", o.ordinary_commodity_disguised ? "VIOLAÇÃO — Compra comum disfarçada detectada" : "Regular (Objeto genuíno de parceria)"],
        ],
        [5.2, 3.8]
      )
    );
  }

  return parts;
}

function buildSection3BlockingConclusion(dossier: DirectContractingAuditDossier): string[] {
  const parts: string[] = [
    pHeading("3. Consolidação de Óbices Normativos, Recomendações e Conclusão", 1),
  ];

  if (dossier.blocking_tags.length > 0) {
    const rows = dossier.blocking_tags.map((tag, idx) => {
      const info = describeDirectTagLegalProse(tag, dossier);
      return [
        String(idx + 1).padStart(2, "0"),
        `${info.title}\nBase Legal: ${info.legalBasis}`,
        `${info.factualAnalysis}\nSaneamento Recomendado: ${info.recommendation}`,
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
        "CONFORMIDADE NORMATIVA INTEGRAL",
        "Instrução processual em estrita conformidade com os requisitos legais aplicáveis, não tendo sido detectados vícios de instrução, fracionamento de despesa ou desatendimento às exigências jurisprudenciais.",
        "ok"
      )
    );
  }

  parts.push(
    pHeading("Dispositivo Conclusivo", 2),
    pBody(
      `À vista do exposto, sob o prisma estritamente técnico-jurídico da ${formatLegalRegime(dossier.legal_regime)}, manifesta-se este parecer pela decisão: ${formatDirectDecision(dossier.decision)}, submetendo-se os autos do processo ${dossier.process_id} à consideração da Autoridade Competente / Ordenador de Despesa para deliberação ou imediato cumprimento das medidas saneadoras apontadas.`,
      true
    ),
    ...pSignatureBlock([
      "Assessoria Jurídica / Área de Conformidade em Contratações",
      "Ordenador de Despesa / Autoridade Competente — ORGAO_CONTRATANTE",
    ])
  );

  return parts;
}

export function buildDirectContractingOpinionXmlParts(
  dossier: DirectContractingAuditDossier
): string[] {
  return [
    ...buildSection1Summary(dossier),
    ...buildSection2ModalityAudit(dossier),
    ...buildSection3BlockingConclusion(dossier),
  ];
}
