// ============================================================================
// Renderizador Markdown & Laudo Pericial OpenXML DOCX/PDF: Obras/Engenharia
// docgov-engine v1.6.6 — src/engineering/docx_renderer.ts
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
import type {
  EngineeringWorksAuditInput,
  EngineeringWorksAuditOutput,
} from "./types.ts";

interface EngineeringTagProse {
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

function describeEngineeringTagProse(tag: string): EngineeringTagProse {
  const map: Record<string, EngineeringTagProse> = {
    "[ENG_BDI_FORMULA_ALGEBRAIC_MISMATCH_BLOCK]": {
      title: "BDI — Divergência Algébrica na Fórmula Oficial",
      legalBasis: "Acórdão TCU nº 2.622/2013-Plenário (Fórmula Canônica do BDI)",
      recommendation: "Recalcular o BDI pela fórmula algébrica oficial a partir de AC, S, R, DF, L e tributos.",
    },
    "[ENG_BDI_ABOVE_TCU_2622_Q3_CEILING_BLOCK]": {
      title: "BDI Geral Acima do 3º Quartil Referencial",
      legalBasis: "Acórdão TCU nº 2.622/2013-Plenário (Tabela de Quartis por Tipologia)",
      recommendation: "Reduzir o BDI aos limites referenciais ou juntar justificativa técnico-econômica detalhada.",
    },
    "[ENG_BDI_SUMULA253_DIFFERENTIATED_MISSING_OR_EXCEEDED_BLOCK]": {
      title: "Ausência ou Extrapolação do BDI Diferenciado (Materiais/Equipamentos)",
      legalBasis: "Súmula TCU nº 253 e Acórdão TCU nº 2.622/2013 (teto 3ºQ = 16,80%)",
      recommendation: "Aplicar BDI Diferenciado reduzido para fornecimento relevante de materiais/equipamentos.",
    },
    "[ENG_BDI_ADMIN_LOCAL_CANTEIRO_MOBILIZACAO_BIS_IN_IDEM_BLOCK]": {
      title: "Bis in Idem — Administração Local, Canteiro ou Mobilização no BDI",
      legalBasis: "Acórdão TCU nº 2.622/2013-Plenário (Segregação de Custos Diretos)",
      recommendation: "Expurgar Administração Local, Canteiro e Mobilização do BDI e alocá-los na planilha direta.",
    },
    "[ENG_BDI_SUMULA254_IRPJ_CSLL_FORBIDDEN_BLOCK]": {
      title: "Inclusão Indevida de IRPJ/CSLL no BDI ou Planilha",
      legalBasis: "Súmula TCU nº 254 (Vedação de Tributos Diretos Personalíssimos)",
      recommendation: "Excluir imediatamente as parcelas de IRPJ e CSLL da composição de BDI e custos.",
    },
    "[ENG_ADMIN_LOCAL_NON_PROPORTIONAL_MEASUREMENT_BLOCK]": {
      title: "Medição Desproporcional de Administração Local",
      legalBasis: "Acórdão TCU nº 2.622/2013-Plenário (Critério de Medição Proporcional)",
      recommendation: "Vincular a medição da Administração Local estritamente ao percentual de avanço físico.",
    },
    "[ENG_CURVA_ABC_SINAPI_SICRO_MEDIAN_OVERPRICING_BLOCK]": {
      title: "Sobrepreço em Itens da Curva ABC Frente às Medianas SINAPI/SICRO",
      legalBasis: "Decreto Federal nº 7.983/2013 e Art. 23, § 2º da Lei nº 14.133/2021",
      recommendation: "Adequar preços unitários às medianas SINAPI/SICRO ou comprovar especificidade via nota técnica.",
    },
    "[ENG_CPRB_DESONERACAO_TAX_ASYMMETRY_LEI14973_BLOCK]": {
      title: "Assimetria Tributária na Desoneração da Folha / CPRB",
      legalBasis: "Lei Federal nº 14.973/2024 (Transição Gradual CPRB x INSS Folha)",
      recommendation: "Compatibilizar encargos SINAPI/SICRO (Com/Sem Desoneração) com a CPRB e INSS do exercício.",
    },
    "[ENG_SCHEDULE_FRONT_LOADING_CASHFLOW_MANIPULATION_BLOCK]": {
      title: "Front-Loading no Cronograma Físico-Financeiro",
      legalBasis: "Arts. 141 e 145 da Lei nº 14.133/2021 e Jurisprudência do TCU",
      recommendation: "Reequilibrar o cronograma físico-financeiro vedando antecipação de desembolso.",
    },
    "[ENG_INTEGRATED_CONTRACTING_RISK_MATRIX_MISSING_BLOCK]": {
      title: "Contratação Integrada/Semi-Integrada sem Matriz de Riscos",
      legalBasis: "Art. 22, § 3º e Art. 46 da Lei nº 14.133/2021; Art. 42, § 1º da Lei nº 13.303/2016",
      recommendation: "Elaborar Matriz de Alocação de Riscos objetiva antes da divulgação do edital.",
    },
    "[ENG_INTEGRATED_CONTRACTING_ILLEGAL_DESIGN_ADDENDUM_BLOCK]": {
      title: "Aditivo Vedado por Falha de Projeto em Regime Integrado",
      legalBasis: "Art. 46, § 8º da Lei nº 14.133/2021 e Art. 43, § 1º da Lei nº 13.303/2016",
      recommendation: "Indeferir pleito de aditamento contratual decorrente de omissão/erro de projeto da contratada.",
    },
    "[INEXEQUIBILITY_75_PCT_PRESUMPTION_DILIGENCE_REQUIRED]": {
      title: "Presunção Relativa de Inexequibilidade (< 75% do Orçamento)",
      legalBasis: "Art. 59, § 4º da Lei nº 14.133/2021 e Súmula TCU nº 262",
      recommendation: "Instaurar diligência contraditória para comprovação da exequibilidade dos custos.",
    },
    "[INEXEQUIBILITY_ADDITIONAL_GUARANTEE_85_PCT_REQUIRED]": {
      title: "Exigência Legal de Garantia Adicional (< 85% do Orçamento)",
      legalBasis: "Art. 59, § 5º da Lei nº 14.133/2021",
      recommendation: "Exigir garantia adicional equivalente à diferença entre 85% do orçamento e o valor proposto.",
    },
    "[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]": {
      title: "Vedação à Desclassificação Sumária sem Diligência Prévia",
      legalBasis: "Súmula TCU nº 262 e Art. 59, § 2º da Lei nº 14.133/2021",
      recommendation: "Conceder prazo razoável de diligência saneadora ao licitante antes de decidir pela desclassificação.",
    },
    "[UNIT_PRICE_OVERPRICING_JOGO_DE_PLANILHA_BLOCK]": {
      title: "Sobrepreço Unitário / Risco de Jogo de Planilha",
      legalBasis: "Art. 59 da Lei nº 14.133/2021, Decreto nº 7.983/2013 e Súmula TCU nº 259",
      recommendation: "Exigir readequação dos preços unitários superiores aos referenciais sem majoração do valor global.",
    },
  };

  return (
    map[tag] || {
      title: `Apontamento Técnico de Engenharia (${tag})`,
      legalBasis: "Acórdão TCU nº 2.622/2013, Decreto nº 7.983/2013 e Lei nº 14.133/2021",
      recommendation: "Sanear integralmente a inconsistência apontada nos autos.",
    }
  );
}

export function buildEngineeringAuditMarkdown(
  output: EngineeringWorksAuditOutput,
  _input: EngineeringWorksAuditInput
): string {
  const b = output.bdi_summary;
  const s = output.sinapi_schedule_summary;
  const x = output.inexequibility_summary;

  return [
    `# Dossiê Pericial de Obras e Serviços de Engenharia — ${output.case_id}`,
    `- **Status:** \`${output.status}\` | **Regime:** \`${output.contract_regime}\` | **Tipologia (Acórdão TCU nº 2.622/2013):** \`${output.work_typology}\` | **Execução:** \`${output.execution_regime}\``,
    `- **BDI Declarado vs. Calculado:** ${bpsToPctStr(b.declared_bdi_bps)} vs. ${bpsToPctStr(b.calculated_bdi_bps)} (Quartis 2.622/2013: 1ºQ=${bpsToPctStr(b.quartile_q1_bps)}, Médio=${bpsToPctStr(b.quartile_median_bps)}, 3ºQ=${bpsToPctStr(b.quartile_q3_bps)})`,
    `- **Súmula TCU nº 253 (BDI Diferenciado Equipamentos):** ${b.differentiated_equipment_bdi_bps !== undefined ? bpsToPctStr(b.differentiated_equipment_bdi_bps) : "Não informado"} (Teto 3ºQ: ${bpsToPctStr(b.equipment_q3_ceiling_bps)})`,
    `- **Referencial SINAPI/SICRO & Desoneração CPRB (Lei nº 14.973/2024):** Regime \`${s.cprb_regime}\` (Ano ${s.cprb_reference_year}) | Itens Curva ABC Sobrepreço: ${s.abc_overpriced_items_count}`,
    `- **Inexequibilidade / Garantia (Art. 59 §§ 4º–5º):** Orçado ${centsToBRL(x.estimated_budget_cents)} vs. Proposta ${centsToBRL(x.offered_proposal_cents)} (${x.ratio_pct ?? "N/A"}%) | Garantia Adicional: ${centsToBRL(x.additional_guarantee_cents)}`,
    "",
    "## Tags Bloqueantes Identificadas",
    ...(output.blocking_tags.length > 0
      ? output.blocking_tags.map((tag) => `- \`${tag}\``)
      : ["- Nenhuma inconformidade bloqueante detectada."]),
    "",
    "## Curva ABC SINAPI/SICRO (Decreto nº 7.983/2013)",
    ...(s.abc_items.length > 0
      ? [
          "| Item | Faixa | Fonte | Unit. Mediana | Unit. Proposto | Diferença Total |",
          "| :--- | :---: | :---: | ---: | ---: | ---: |",
          ...s.abc_items.map(
            (it) =>
              `| ${it.item_id} | ${it.abc_band} | ${it.reference_source} | ${centsToBRL(it.sinapi_sicro_median_unit_cents)} | ${centsToBRL(it.offered_unit_cents)} | ${centsToBRL(it.overpricing_cents)} |`
          ),
        ]
      : ["- Nenhum item de Curva ABC informado no escopo."]),
    "",
    "## Achados Periciais Detalhados",
    ...(output.findings.length > 0
      ? output.findings.map((f) => `- ${f}`)
      : ["- Orçamento de engenharia, BDI e cronograma em integral conformidade normativa."]),
  ].join("\n");
}

export async function compileEngineeringPericialDocxAndPdf(
  output: EngineeringWorksAuditOutput,
  _input: EngineeringWorksAuditInput,
  outDir: string,
  outputFormat: "docx" | "pdf" | "both" = "both"
): Promise<{ docx_path?: string; pdf_path?: string }> {
  const b = output.bdi_summary;
  const s = output.sinapi_schedule_summary;
  const x = output.inexequibility_summary;
  const shortLaw = formatShortLegalRegime(output.contract_regime);
  const tone = output.status === "CONFORME" ? "ok" : "danger";

  const bodyParts: Array<string | string[]> = [
    pDocHeader(
      `ORGAO_CONTRATANTE — PERÍCIA DE OBRAS E SERVIÇOS DE ENGENHARIA (${shortLaw})`,
      `LAUDO PERICIAL DE BDI, SINAPI/SICRO E CRONOGRAMA — ${output.case_id}`,
      `Acórdão TCU nº 2.622/2013 | Súmula TCU nº 253 | Decreto nº 7.983/2013 | Lei nº 14.973/2024 | Motor docgov-engine v${output.engine_version}`
    ),
    pHeading("1. Identificação Processual e Síntese Executiva", 1),
    pBody(
      `Auditoria técnico-matemática determinística do orçamento de engenharia, composição do BDI (Acórdão TCU nº 2.622/2013 e Súmulas TCU nº 253 e nº 254), Curva ABC frente às medianas SINAPI/SICRO (Decreto nº 7.983/2013), simetria tributária CPRB (Lei nº 14.973/2024), exequibilidade (Art. 59 §§ 4º e 5º) e cronograma físico-financeiro para o processo ${output.case_id}, sob a ${formatLegalRegime(output.contract_regime)}.`
    ),
    buildTableXml(
      ["Parâmetro Pericial", "Registro Apurado nos Autos"],
      [
        ["Identificador do Caso", output.case_id],
        ["Tipologia (Acórdão TCU 2.622/2013)", `${b.typology_label} (${output.work_typology})`],
        ["Regime de Execução", output.execution_regime],
        ["BDI Declarado vs. Calculado", `${bpsToPctStr(b.declared_bdi_bps)} vs. ${bpsToPctStr(b.calculated_bdi_bps)} (Q1=${bpsToPctStr(b.quartile_q1_bps)} | Med=${bpsToPctStr(b.quartile_median_bps)} | Q3=${bpsToPctStr(b.quartile_q3_bps)})`],
        ["Súmula TCU 253 (BDI Diferenciado)", b.differentiated_equipment_bdi_bps !== undefined ? `${bpsToPctStr(b.differentiated_equipment_bdi_bps)} (Teto Q3=${bpsToPctStr(b.equipment_q3_ceiling_bps)})` : `Não informado (Teto Q3=${bpsToPctStr(b.equipment_q3_ceiling_bps)})`],
        ["Regime Tributário SINAPI/SICRO & CPRB", `${s.cprb_regime} | Exercício ${s.cprb_reference_year} (Lei nº 14.973/2024)`],
        ["Orçado vs. Proposto (Art. 59 §§ 4º–5º)", `${centsToBRL(x.estimated_budget_cents)} vs. ${centsToBRL(x.offered_proposal_cents)} (${x.ratio_pct ?? "N/A"}%) | Garantia Adicional: ${centsToBRL(x.additional_guarantee_cents)}`],
        ["Resultado da Auditoria", `${output.status} (${output.blocking_tags.length} óbice(s))`],
      ],
      [3.5, 5.5]
    ),
    pCallout(
      `CONCLUSÃO PERICIAL — STATUS: ${output.status}`,
      output.blocking_tags.length > 0
        ? `Foram apurados ${output.blocking_tags.length} apontamento(s) impeditivo(s) no orçamento, BDI, Curva ABC SINAPI/SICRO, desoneração CPRB (Lei nº 14.973/2024), exequibilidade ou cronograma físico-financeiro.`
        : "Composição do BDI (Acórdão TCU 2.622/2013 e Súmula TCU 253), preços unitários SINAPI/SICRO, simetria CPRB (Lei nº 14.973/2024) e cronograma físico-financeiro em estrita conformidade normativa.",
      tone
    ),
    pHeading("2. Curva ABC Referencial SINAPI/SICRO (Decreto nº 7.983/2013)", 1),
  ];

  if (s.abc_items.length > 0) {
    bodyParts.push(
      buildTableXml(
        ["Item", "Faixa", "Fonte", "Mediana Ref.", "Unit. Proposto", "Delta Total"],
        s.abc_items.map((it) => [
          `${it.item_id} — ${it.description}`,
          it.abc_band,
          it.reference_source,
          centsToBRL(it.sinapi_sicro_median_unit_cents),
          centsToBRL(it.offered_unit_cents),
          centsToBRL(it.overpricing_cents),
        ]),
        [2.9, 0.7, 1.0, 1.4, 1.4, 1.6]
      )
    );
  } else {
    bodyParts.push(pBody("Não foram submetidos itens detalhados de Curva ABC SINAPI/SICRO nesta análise."));
  }

  bodyParts.push(pHeading("3. Apontamentos Bloqueantes e Dispositivo Pericial", 1));
  if (output.blocking_tags.length > 0) {
    bodyParts.push(
      buildTableXml(
        ["#", "Título & Base Legal", "Saneamento Recomendado", "Tag Bloqueante"],
        output.blocking_tags.map((tag, idx) => {
          const prose = describeEngineeringTagProse(tag);
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
      pBody("Não foram detectadas inconformidades normativas ou matemáticas bloqueantes no orçamento e cronograma examinados.")
    );
  }

  bodyParts.push(
    ...pSignatureBlock([
      "Engenharia Orçamentária / Equipe de Planejamento e Fiscalização",
      "Controle Interno / Assessoria Técnica — ORGAO_CONTRATANTE",
    ])
  );

  const outDocxPath = join(outDir, "laudo_pericial_obras_engenharia.docx");
  return await emitDocxAndPdf(bodyParts, outDocxPath, outputFormat);
}
