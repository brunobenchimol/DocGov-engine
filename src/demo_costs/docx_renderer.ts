// ============================================================================
// Renderizador Markdown & Laudo Pericial OpenXML DOCX/PDF: Regime DEMO
// docgov-engine v1.6.5 — src/demo_costs/docx_renderer.ts
// ============================================================================

import { join } from "node:path";
import {
  buildTableXml,
  emitDocxAndPdf,
  pBody,
  pCallout,
  pDocHeader,
  pHeading,
  pSignatureBlock,
} from "../bidding/bidding_xml_primitives.ts";
import {
  formatBRLAllowZero,
  formatLegalRegime,
  formatShortLegalRegime,
} from "../bidding/bidding_legal_humanizer.ts";
import { ANEXO_VIB_PRODUCTIVITY_BOUNDS } from "./sheet_calculator.ts";
import type {
  DemoRegimeAuditInput,
  DemoRegimeAuditOutput,
} from "./types.ts";

interface DemoTagProse {
  title: string;
  legalBasis: string;
  recommendation: string;
}

function centsToBRL(cents: number): string {
  return formatBRLAllowZero(cents / 100);
}

function bpsToPctStr(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(".", ",")}%`;
}

function describeDemoTagProse(tag: string): DemoTagProse {
  const map: Record<string, DemoTagProse> = {
    "[DEMO_MOD1_CCT_FLOOR_BELOW_NORMATIVE]": {
      title: "Módulo 1 — Salário-Base Inferior ao Piso Normativo da CCT",
      legalBasis: "Art. 121 da Lei nº 14.133/2021 e Anexo VII-D da IN SEGES nº 05/2017",
      recommendation: "Adequação imediata do salário-base ao piso vigente na Convenção Coletiva de Trabalho.",
    },
    "[DEMO_MOD1_SUMULA448_TST_INSALUBRITY_VIOLATION]": {
      title: "Módulo 1 — Violação à Súmula nº 448, II do TST / LTCAT / Cumulação Ilícita",
      legalBasis: "Súmula nº 448, item II do TST e Art. 193, § 2º da CLT",
      recommendation: "Cotar grau máximo (40%) com laudo LTCAT para banheiros de grande circulação e vedar cumulação com periculosidade.",
    },
    "[DEMO_MOD2_SUB21_CPP_FGTS_13TH_VACATION_ERROR]": {
      title: "Módulo 2 — Erro em 13º/Férias (Submódulo 2.1) ou Base CPP/FGTS (Submódulo 2.2)",
      legalBasis: "Anexo VII-D da IN SEGES nº 05/2017 e Art. 18, § 5º-C da LC nº 123/2006",
      recommendation: "Ajustar Submódulo 2.1 (~20,43%) e garantir incidência integral de 20% CPP + 8% FGTS.",
    },
    "[DEMO_MOD2_SUB22_SAT_RAT_FAP_MISMATCH]": {
      title: "Módulo 2.2 — Inconsistência na Multiplicação SAT/RAT × FAP",
      legalBasis: "Decreto nº 3.048/1999 e Anexo VII-D da IN SEGES nº 05/2017",
      recommendation: "Comprovar RAT (1%–3%) e FAP (0,5–2,0) via GFIP/FAPWeb e corrigir o produto declarado.",
    },
    "[DEMO_MOD2_SUB23_VT_6PCT_DEDUCTION_OR_VA_ERROR]": {
      title: "Módulo 2.3 — Erro no Desconto Legal de 6% do Vale-Transporte ou Piso de VA",
      legalBasis: "Lei nº 7.418/1985 (desconto de 6% do salário-base) e CCT aplicável",
      recommendation: "Recalcular VT líquido do empregador abatendo 6% do salário-base e assegurar VA mínimo da CCT.",
    },
    "[DEMO_MOD3_RESCISAO_APT_FIRST_YEAR_OR_FGTS_PENALTY_ERROR]": {
      title: "Módulo 3 — Provisão Rescisória Irregular (APT > 1,94% no 1º Ano ou Multa FGTS)",
      legalBasis: "Anexo VII-D da IN SEGES nº 05/2017 e Acórdão TCU nº 1.586/2018-Plenário",
      recommendation: "Limitar APT do 1º ano a 1,94% e ajustar provisão de multa do FGTS na faixa normativa.",
    },
    "[DEMO_MOD4_AUSENTES_REPLACEMENT_CALC_ERROR]": {
      title: "Módulo 4 — Erro no Cálculo de Reposição de Profissional Ausente",
      legalBasis: "Submódulo 4.1 do Anexo VII-D da IN SEGES nº 05/2017",
      recommendation: "Recalcular o custo do substituto com incidência integral do Submódulo 2.2.",
    },
    "[DEMO_MOD5_INSUMOS_EPI_DEPRECIATION_INCONSISTENT]": {
      title: "Módulo 5 — Insumos, Uniformes, EPIs ou Depreciação Inconsistentes",
      legalBasis: "Módulo 5 do Anexo VII-D da IN SEGES nº 05/2017",
      recommendation: "Detalhar memória de cálculo de uniformes, EPIs, materiais e depreciação compatível com o objeto.",
    },
    "[DEMO_MOD6_GROSS_UP_FORMULA_MATH_ERROR]": {
      title: "Módulo 6 — Erro Matemático na Fórmula de Tributos 'Por Dentro' (Gross-Up)",
      legalBasis: "Anexo VII-D da IN SEGES nº 05/2017 (divisão por 1 - Alíquota Total)",
      recommendation: "Corrigir cálculo por dentro: Total = (M1..M5 + CI + Lucro) / (1 - AlíquotaTotal).",
    },
    "[DEMO_MOD6_LUCRO_REAL_EFFECTIVE_RATE_ACORDAO_1214_VIOLATION]": {
      title: "Módulo 6 — Lucro Real sem Alíquota Efetiva EFD-Contribuições (Acórdão 1.214/2013)",
      legalBasis: "Acórdão TCU nº 1.214/2013-Plenário",
      recommendation: "Apresentar EFD-Contribuições dos últimos 12 meses e cotar a alíquota média efetiva de PIS/COFINS.",
    },
    "[DEMO_MOD6_SIMPLES_NACIONAL_ART17_XII_FORBIDDEN]": {
      title: "Módulo 6 — Vedação ao Simples Nacional em Cessão de Mão de Obra",
      legalBasis: "Art. 17, inciso XII e Art. 18, § 5º-C da Lei Complementar nº 123/2006",
      recommendation: "Exigir desenquadramento do Simples ou comprovação estrita de enquadramento no Anexo IV (Limpeza/Vigilância).",
    },
    "[DEMO_ANEXO_VIB_M2_PRODUCTIVITY_OUT_OF_BOUNDS]": {
      title: "Anexo VI-B — Produtividade por m² Fora da Faixa Referencial sem Justificativa",
      legalBasis: "Anexo VI-B da IN SEGES/MPDG nº 05/2017",
      recommendation: "Adequar produtividade à faixa paramétrica por tipo de área ou apresentar estudo técnico detalhado.",
    },
    "[DEMO_DEC12174_WORKING_HOURS_REDUCTION_44_TO_40_SALARY_CUT_VIOLATION]": {
      title: "Decreto nº 12.174/2024 — Redução Ilícita de Remuneração na Jornada 44h -> 40h",
      legalBasis: "Decreto Federal nº 12.174/2024 e Art. 7º, VI da CRFB/88",
      recommendation: "Garantir irredutibilidade salarial e de benefícios na adequação da jornada semanal para 40 horas.",
    },
    "[DEMO_DEC12174_DOMESTIC_VIOLENCE_QUOTA_OR_LABOR_CLAUSE_MISSING]": {
      title: "Decreto nº 12.174/2024 — Ausência de Cota/Cláusula Protetiva (Violência Doméstica)",
      legalBasis: "Decreto Federal nº 12.174/2024 e Art. 25, § 9º da Lei nº 14.133/2021",
      recommendation: "Incluir cláusulas trabalhistas protetivas e reserva de vagas para mulheres vítimas de violência doméstica.",
    },
    "[DEMO_EXEC_APT_FIRST_RENEWAL_PURGE_ACORDAO_1586_MISSING]": {
      title: "Execução — Omissão do Expurgo de 90% do APT na 1ª Prorrogação",
      legalBasis: "Acórdão TCU nº 1.586/2018-Plenário (redução de 1,94% para 0,194%)",
      recommendation: "Aplicar glosa contratual imediata reduzindo o APT para no máximo 0,194% a partir do 2º ano.",
    },
    "[DEMO_EXEC_LINKED_ACCOUNT_FATO_GERADOR_OR_REPACTUATION_BREACH]": {
      title: "Execução — Irregularidade em Conta Vinculada (Anexo XII), Fato Gerador ou Repactuação",
      legalBasis: "Anexo XII da IN SEGES nº 05/2017 e Art. 135 da Lei nº 14.133/2021",
      recommendation: "Regularizar retenção (29,50%–31,33%), exigir comprovação no Fato Gerador ou respeitar interregno/limites da repactuação.",
    },
  };

  return (
    map[tag] || {
      title: `Apontamento Normativo (${tag})`,
      legalBasis: "IN SEGES/MPDG nº 05/2017 e Lei Federal nº 14.133/2021",
      recommendation: "Sanear integralmente a inconformidade apontada nos autos.",
    }
  );
}

export function buildDemoAuditMarkdown(
  output: DemoRegimeAuditOutput,
  input: DemoRegimeAuditInput
): string {
  const t = output.calculated_totals_cents;
  const b = output.sheet_breakdown;
  const e = output.execution_summary;

  return [
    `# Dossiê Técnico-Pericial de Auditoria DEMO — ${output.case_id}`,
    `- **Status:** \`${output.status}\` | **Regime:** \`${output.contract_regime}\` | **Categoria:** \`${output.service_category}\` | **Regime Tributário:** \`${output.tax_regime}\``,
    `- **Total Mensal por Posto (Gross-Up):** **${centsToBRL(t.total_monthly_per_post_cents)}**`,
    "",
    "## Tags Bloqueantes Identificadas",
    ...(output.blocking_tags.length > 0
      ? output.blocking_tags.map((tag) => `- \`${tag}\``)
      : ["- Nenhuma inconformidade bloqueante detectada."]),
    "",
    "## Memória de Cálculo dos Módulos 1 a 6 (Centavos Inteiros)",
    "| Módulo | Descrição Normativa (Anexo VII-D) | Valor Apurado |",
    "| :--- | :--- | ---: |",
    `| Módulo 1 | Composição da Remuneração (Salário + Adicionais) | ${centsToBRL(t.module1_cents)} |`,
    `| Módulo 2 | Encargos e Benefícios (Sub 2.1=${centsToBRL(b.sub21_cents)}, Sub 2.2=${centsToBRL(b.sub22_cents)}, Sub 2.3=${centsToBRL(b.sub23_cents)}) | ${centsToBRL(t.module2_cents)} |`,
    `| Módulo 3 | Provisão para Rescisão (API + Multa FGTS + APT) | ${centsToBRL(t.module3_cents)} |`,
    `| Módulo 4 | Custo de Reposição do Profissional Ausente | ${centsToBRL(t.module4_cents)} |`,
    `| Módulo 5 | Insumos Diversos (Uniformes, EPIs, Depreciação) | ${centsToBRL(t.module5_cents)} |`,
    `| Módulo 6 | Custos Indiretos (${centsToBRL(b.indirect_costs_cents)}), Lucro (${centsToBRL(b.profit_cents)}) e Tributos Por Dentro (${centsToBRL(b.taxes_cents)}) | ${centsToBRL(t.module6_cents)} |`,
    `| **TOTAL** | **Valor Mensal Total por Posto de Trabalho** | **${centsToBRL(t.total_monthly_per_post_cents)}** |`,
    "",
    "## Governança de Execução Contratual, Anexo VI-B e Decreto nº 12.174/2024",
    `- **Mecanismo Mitigador:** \`${e.mitigation_mechanism}\` | **Provisão Mensal Conta Vinculada:** ${centsToBRL(t.linked_account_monthly_provision_cents)} (${bpsToPctStr(e.linked_account_computed_bps)})`,
    `- **Expurgo APT 1ª Prorrogação (Acórdão TCU 1.586/2018):** Economia Mensal ${centsToBRL(t.apt_renewal_purge_monthly_savings_cents)} | Anual ${centsToBRL(e.apt_renewal_purge_annual_savings_cents)}`,
    ...(input.productivity_m2
      ? [
          `- **Produtividade Anexo VI-B:** ${input.productivity_m2.area_type} = ${input.productivity_m2.proposed_m2_per_worker} m² (Faixa: ${ANEXO_VIB_PRODUCTIVITY_BOUNDS[input.productivity_m2.area_type].join("..")} m²)`,
        ]
      : []),
    "",
    "## Achados Periciais Detalhados",
    ...(output.findings.length > 0
      ? output.findings.map((f) => `- ${f}`)
      : ["- Planilha DEMO e parâmetros de execução em integral conformidade normativa."]),
  ].join("\n");
}

export async function compileDemoPericialDocxAndPdf(
  output: DemoRegimeAuditOutput,
  input: DemoRegimeAuditInput,
  outDir: string,
  outputFormat: "docx" | "pdf" | "both" = "both"
): Promise<{ docx_path?: string; pdf_path?: string }> {
  const t = output.calculated_totals_cents;
  const b = output.sheet_breakdown;
  const e = output.execution_summary;
  const shortLaw = formatShortLegalRegime(output.contract_regime);
  const tone = output.status === "CONFORME" ? "ok" : "danger";

  const bodyParts: Array<string | string[]> = [
    pDocHeader(
      `ORGAO_CONTRATANTE — CONTROLE INTERNO E PERÍCIA DE CUSTOS (${shortLaw})`,
      `LAUDO PERICIAL DE PLANILHA DE CUSTOS E EXECUÇÃO DEMO — ${output.case_id}`,
      `IN SEGES/MPDG nº 05/2017 | Decreto nº 12.174/2024 | Motor docgov-engine v${output.engine_version}`
    ),
    pHeading("1. Identificação Processual e Síntese Executiva", 1),
    pBody(
      `Trata-se de auditoria matemático-normativa determinística da Planilha de Custos e Formação de Preços (Anexo VII-D da IN SEGES/MPDG nº 05/2017) e da governança contratual do regime de Dedicação Exclusiva de Mão de Obra (DEMO) para o processo ${output.case_id}, sob a égide da ${formatLegalRegime(output.contract_regime)} e do Decreto Federal nº 12.174/2024.`
    ),
    buildTableXml(
      ["Parâmetro Pericial", "Registro Apurado nos Autos"],
      [
        ["Identificador do Caso", output.case_id],
        ["Categoria do Serviço DEMO", output.service_category],
        ["Regime Tributário da Contratada", output.tax_regime],
        ["Valor Mensal Total por Posto (Gross-Up)", centsToBRL(t.total_monthly_per_post_cents)],
        ["Resultado da Auditoria", output.status],
        ["Total de Óbices Bloqueantes", `${output.blocking_tags.length} apontamento(s)`],
      ],
      [3.6, 5.4]
    ),
    pCallout(
      `CONCLUSÃO SINTÉTICA — STATUS: ${output.status}`,
      output.blocking_tags.length > 0
        ? `Foram detectados ${output.blocking_tags.length} óbice(s) normativo(s) ou aritmético(s) impeditivo(s), exigindo saneamento integral da planilha ou glosa de faturamento antes da aceitação ou prorrogação contratual.`
        : "Planilha de custos, produtividade por m², cláusulas do Decreto nº 12.174/2024 e mecanismos de mitigação de risco trabalhista validados em estrita conformidade normativa.",
      tone
    ),
    pHeading("2. Quadro Analítico dos Módulos 1 a 6 (Centavos Inteiros & Gross-Up)", 1),
    buildTableXml(
      ["Módulo", "Composição e Parâmetros Aplicados", "Valor Mensal"],
      [
        [
          "Módulo 1",
          `Remuneração (Salário-base ${centsToBRL(b.base_salary_cents)}, Insalubridade ${centsToBRL(b.insalubrity_cents)}, Periculosidade ${centsToBRL(b.danger_pay_cents)}, Noturno ${centsToBRL(b.night_shift_additional_cents)})`,
          centsToBRL(t.module1_cents),
        ],
        [
          "Módulo 2",
          `Sub 2.1 (${centsToBRL(b.sub21_cents)}) + Sub 2.2 (${centsToBRL(b.sub22_cents)}, alíquota ${bpsToPctStr(b.total_sub22_bps)}) + Sub 2.3 VT/VA (${centsToBRL(b.sub23_cents)})`,
          centsToBRL(t.module2_cents),
        ],
        [
          "Módulo 3",
          `Provisão Rescisória (API ${bpsToPctStr(input.module3_termination.api_bps)}, Multa FGTS ${bpsToPctStr(input.module3_termination.fgts_penalty_bps)}, APT 1º ano ${bpsToPctStr(input.module3_termination.apt_first_year_bps)})`,
          centsToBRL(t.module3_cents),
        ],
        [
          "Módulo 4",
          `Reposição de Profissional Ausente (esperado ${centsToBRL(b.expected_m4_cents)})`,
          centsToBRL(t.module4_cents),
        ],
        [
          "Módulo 5",
          "Insumos Diversos (Uniformes, EPIs, Materiais e Depreciação)",
          centsToBRL(t.module5_cents),
        ],
        [
          "Módulo 6",
          `Custos Indiretos (${centsToBRL(b.indirect_costs_cents)}), Lucro (${centsToBRL(b.profit_cents)}) e Tributos Por Dentro (${bpsToPctStr(b.tax_total_bps)} = ${centsToBRL(b.taxes_cents)})`,
          centsToBRL(t.module6_cents),
        ],
        [
          "TOTAL DO POSTO",
          `Soma M1..M5 (${centsToBRL(b.soma_m1_m5_cents)}) + Módulo 6 com Gross-Up`,
          centsToBRL(t.total_monthly_per_post_cents),
        ],
      ],
      [1.8, 5.4, 1.8]
    ),
    pHeading("3. Produtividade Anexo VI-B (m²) e Decreto Federal nº 12.174/2024", 1),
    buildTableXml(
      ["Eixo Normativo", "Parâmetro Verificado", "Situação"],
      [
        [
          "Produtividade Anexo VI-B (m²)",
          input.productivity_m2
            ? `Área ${input.productivity_m2.area_type}: ${input.productivity_m2.proposed_m2_per_worker} m²/posto (Faixa ${ANEXO_VIB_PRODUCTIVITY_BOUNDS[input.productivity_m2.area_type].join("–")} m²)`
            : "Não informada no escopo da análise",
          output.blocking_tags.includes("[DEMO_ANEXO_VIB_M2_PRODUCTIVITY_OUT_OF_BOUNDS]")
            ? "Fora da faixa sem justificativa"
            : "Conforme / Não aplicável",
        ],
        [
          "Jornada 44h -> 40h (Dec. 12.174/2024)",
          input.decree_12174_compliance?.weekly_hours_reduced_44_to_40
            ? "Redução de jornada semanal para 40h declarada"
            : "Jornada padrão sem redução 44h->40h",
          output.blocking_tags.includes(
            "[DEMO_DEC12174_WORKING_HOURS_REDUCTION_44_TO_40_SALARY_CUT_VIOLATION]"
          )
            ? "VIOLAÇÃO — Corte salarial ilícito"
            : "Irredutibilidade preservada",
        ],
        [
          "Cota Violência Doméstica (Dec. 12.174/2024)",
          "Reserva de vagas e cláusulas protetivas trabalhistas",
          output.blocking_tags.includes(
            "[DEMO_DEC12174_DOMESTIC_VIOLENCE_QUOTA_OR_LABOR_CLAUSE_MISSING]"
          )
            ? "AUSENTE — Óbice contratual"
            : "Prevista nos autos",
        ],
      ],
      [2.8, 3.8, 2.4]
    ),
    pHeading("4. Conta-Depósito Vinculada (Anexo XII), Expurgo APT (Acórdão 1.586/2018) e Repactuação (Art. 135)", 1),
    buildTableXml(
      ["Instituto de Governança Contratual", "Memória Apurada"],
      [
        ["Mecanismo de Mitigação de Risco", e.mitigation_mechanism],
        [
          "Provisão Mensal Conta-Depósito Vinculada (Anexo XII)",
          `${centsToBRL(t.linked_account_monthly_provision_cents)} (Referência calculada: ${bpsToPctStr(e.linked_account_computed_bps)}; Retido declarado: ${e.linked_account_retained_bps !== undefined ? bpsToPctStr(e.linked_account_retained_bps) : "N/A"})`,
        ],
        [
          "Expurgo de APT na 1ª Prorrogação (Acórdão TCU 1.586/2018)",
          `1ª Renovação=${e.is_first_renewal_or_after_12m ? "Sim" : "Não"} | Economia Mensal=${centsToBRL(t.apt_renewal_purge_monthly_savings_cents)} | Economia Anual=${centsToBRL(e.apt_renewal_purge_annual_savings_cents)}`,
        ],
        [
          "Repactuação Anual por CCT (Art. 135 Lei nº 14.133/2021)",
          input.execution_governance?.repactuation
            ? `Interregno=${input.execution_governance.repactuation.months_since_last_cct_date_base} meses | Reajuste ilícito M5=${Boolean(input.execution_governance.repactuation.module5_reajusted_by_cct_salary_index)} | Majoração CI/Lucro=${Boolean(input.execution_governance.repactuation.indirect_or_profit_rate_increased)}`
            : "Sem pleito de repactuação submetido",
        ],
      ],
      [3.6, 5.4]
    ),
    pHeading("5. Apontamentos Bloqueantes e Dispositivo Pericial", 1),
  ];

  if (output.blocking_tags.length > 0) {
    bodyParts.push(
      buildTableXml(
        ["#", "Título & Base Legal", "Saneamento Recomendado", "Tag Bloqueante"],
        output.blocking_tags.map((tag, idx) => {
          const prose = describeDemoTagProse(tag);
          return [
            String(idx + 1).padStart(2, "0"),
            `${prose.title}\nBase: ${prose.legalBasis}`,
            prose.recommendation,
            tag,
          ];
        }),
        [0.6, 3.2, 2.8, 2.4]
      )
    );
  } else {
    bodyParts.push(
      pBody(
        "Não foram constatadas inconsistências matemáticas ou jurídicas bloqueantes na planilha de custos nem nos controles de execução contratual DEMO examinados."
      )
    );
  }

  bodyParts.push(
    ...pSignatureBlock([
      "Equipe de Planejamento / Fiscalização Contratual DEMO",
      "Controle Interno / Assessoria Técnica — ORGAO_CONTRATANTE",
    ])
  );

  const outDocxPath = join(outDir, "laudo_pericial_planilha_demo.docx");
  return await emitDocxAndPdf(bodyParts, outDocxPath, outputFormat);
}
