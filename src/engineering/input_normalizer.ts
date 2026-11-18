// ============================================================================
// Normalizador Dual (Aninhado + Flat/Aliases): Obras e Engenharia (v1.6.7)
// docgov-engine — src/engineering/input_normalizer.ts
// ============================================================================

import type {
  EngineeringBdiInput,
  EngineeringCurvaAbcItemInput,
  EngineeringScheduleAndRiskInput,
  EngineeringScheduleStageInput,
  EngineeringTaxDesoneracaoInput,
  EngineeringWorksAuditInput,
} from "./types.ts";

function pickFirstDefined<T>(...vals: Array<T | undefined>): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function normalizeBdiInput(raw: Record<string, any>): EngineeringBdiInput | undefined {
  const src =
    raw.bdi_evaluation ||
    raw.bdi ||
    raw.bdi_composition ||
    raw.composicao_bdi;

  const hasFlatBdi =
    raw.declared_bdi_bps !== undefined ||
    raw.declared_bdi_pct !== undefined ||
    raw.central_admin_bps !== undefined ||
    raw.central_admin_pct !== undefined ||
    raw.includes_admin_local_in_bdi !== undefined ||
    raw.includes_irpj_or_csll !== undefined ||
    raw.differentiated_equipment_bdi_bps !== undefined ||
    raw.differentiated_equipment_bdi_pct !== undefined ||
    raw.admin_local_proportional_to_physical_progress !== undefined;

  if (!src && !hasFlatBdi) return undefined;
  const b: Record<string, any> = typeof src === "object" && src !== null ? src : {};

  return {
    central_admin_bps: pickFirstDefined(b.central_admin_bps, b.ac_bps, b.administracao_central_bps, raw.central_admin_bps),
    central_admin_pct: pickFirstDefined(b.central_admin_pct, b.ac_pct, b.administracao_central_pct, raw.central_admin_pct),
    insurance_and_guarantee_bps: pickFirstDefined(b.insurance_and_guarantee_bps, b.insurance_bps, b.guarantee_bps, b.seguro_garantia_bps, raw.insurance_and_guarantee_bps),
    insurance_and_guarantee_pct: pickFirstDefined(b.insurance_and_guarantee_pct, b.insurance_pct, b.guarantee_pct, b.seguro_garantia_pct, raw.insurance_and_guarantee_pct),
    risk_bps: pickFirstDefined(b.risk_bps, b.risco_bps, raw.risk_bps),
    risk_pct: pickFirstDefined(b.risk_pct, b.risco_pct, raw.risk_pct),
    financial_expenses_bps: pickFirstDefined(b.financial_expenses_bps, b.df_bps, b.despesas_financeiras_bps, raw.financial_expenses_bps),
    financial_expenses_pct: pickFirstDefined(b.financial_expenses_pct, b.df_pct, b.despesas_financeiras_pct, raw.financial_expenses_pct),
    profit_bps: pickFirstDefined(b.profit_bps, b.l_bps, b.lucro_bps, raw.profit_bps),
    profit_pct: pickFirstDefined(b.profit_pct, b.l_pct, b.lucro_pct, raw.profit_pct),
    pis_bps: pickFirstDefined(b.pis_bps, raw.pis_bps),
    pis_pct: pickFirstDefined(b.pis_pct, raw.pis_pct),
    cofins_bps: pickFirstDefined(b.cofins_bps, raw.cofins_bps),
    cofins_pct: pickFirstDefined(b.cofins_pct, raw.cofins_pct),
    iss_bps: pickFirstDefined(b.iss_bps, raw.iss_bps),
    iss_pct: pickFirstDefined(b.iss_pct, raw.iss_pct),
    cprb_bps: pickFirstDefined(b.cprb_bps, raw.cprb_bps),
    cprb_pct: pickFirstDefined(b.cprb_pct, raw.cprb_pct),
    irpj_bps: pickFirstDefined(b.irpj_bps, raw.irpj_bps),
    irpj_pct: pickFirstDefined(b.irpj_pct, raw.irpj_pct),
    csll_bps: pickFirstDefined(b.csll_bps, raw.csll_bps),
    csll_pct: pickFirstDefined(b.csll_pct, raw.csll_pct),
    declared_bdi_bps: pickFirstDefined(b.declared_bdi_bps, b.bdi_declarado_bps, raw.declared_bdi_bps),
    declared_bdi_pct: pickFirstDefined(b.declared_bdi_pct, b.bdi_declarado_pct, raw.declared_bdi_pct),
    justification_above_q3_proven: pickFirstDefined(b.justification_above_q3_proven, b.justificativa_acima_q3_aprovada, raw.justification_above_q3_proven),
    includes_admin_local_in_bdi: pickFirstDefined(b.includes_admin_local_in_bdi, b.admin_local_no_bdi, raw.includes_admin_local_in_bdi, raw.admin_local_no_bdi),
    includes_canteiro_or_mobilizacao_in_bdi: pickFirstDefined(b.includes_canteiro_or_mobilizacao_in_bdi, b.canteiro_mobilizacao_no_bdi, raw.includes_canteiro_or_mobilizacao_in_bdi),
    admin_local_in_bdi_bps: pickFirstDefined(b.admin_local_in_bdi_bps, raw.admin_local_in_bdi_bps),
    includes_irpj_or_csll: pickFirstDefined(b.includes_irpj_or_csll, b.irpj_csll_no_bdi, raw.includes_irpj_or_csll, raw.irpj_csll_no_bdi),
    has_relevant_equipment_supply: pickFirstDefined(b.has_relevant_equipment_supply, b.fornecimento_relevante_equipamentos, raw.has_relevant_equipment_supply),
    relevant_equipment_share_bps: pickFirstDefined(b.relevant_equipment_share_bps, raw.relevant_equipment_share_bps),
    relevant_equipment_share_pct: pickFirstDefined(b.relevant_equipment_share_pct, raw.relevant_equipment_share_pct),
    differentiated_equipment_bdi_bps: pickFirstDefined(b.differentiated_equipment_bdi_bps, b.bdi_diferenciado_bps, raw.differentiated_equipment_bdi_bps),
    differentiated_equipment_bdi_pct: pickFirstDefined(b.differentiated_equipment_bdi_pct, b.bdi_diferenciado_pct, raw.differentiated_equipment_bdi_pct),
    differentiated_bdi_justification_proven: pickFirstDefined(b.differentiated_bdi_justification_proven, raw.differentiated_bdi_justification_proven),
    admin_local_proportional_to_physical_progress: pickFirstDefined(b.admin_local_proportional_to_physical_progress, b.admin_local_proporcional_avanco_fisico, raw.admin_local_proportional_to_physical_progress),
    physical_progress_bps: pickFirstDefined(b.physical_progress_bps, b.avanco_fisico_bps, raw.physical_progress_bps),
    physical_progress_pct: pickFirstDefined(b.physical_progress_pct, b.avanco_fisico_pct, raw.physical_progress_pct),
    admin_local_measured_bps: pickFirstDefined(b.admin_local_measured_bps, b.admin_local_medida_bps, raw.admin_local_measured_bps),
    admin_local_measured_pct: pickFirstDefined(b.admin_local_measured_pct, b.admin_local_medida_pct, raw.admin_local_measured_pct),
  };
}

function normalizeTaxInput(raw: Record<string, any>): EngineeringTaxDesoneracaoInput | undefined {
  const src =
    raw.tax_desoneracao_cprb ||
    raw.desoneracao_cprb ||
    raw.cprb_symmetry ||
    raw.tax_symmetry;

  const hasFlatTax =
    raw.sinapi_sicro_table_regime !== undefined ||
    raw.table_regime !== undefined ||
    raw.bdi_includes_cprb !== undefined ||
    raw.applied_cprb_bps !== undefined ||
    raw.applied_cprb_pct !== undefined;

  if (!src && !hasFlatTax) return undefined;
  const t: Record<string, any> = typeof src === "object" && src !== null ? src : {};
  const regime = pickFirstDefined(
    t.sinapi_sicro_table_regime,
    t.table_regime,
    t.regime_tabela,
    raw.sinapi_sicro_table_regime,
    raw.table_regime,
    "NAO_DESONERADO"
  ) as "DESONERADO" | "NAO_DESONERADO";

  return {
    reference_year: pickFirstDefined(t.reference_year, t.ano_referencia, raw.reference_year),
    sinapi_sicro_table_regime: regime,
    bdi_includes_cprb: pickFirstDefined(t.bdi_includes_cprb, raw.bdi_includes_cprb),
    applied_cprb_bps: pickFirstDefined(t.applied_cprb_bps, t.cprb_bps, raw.applied_cprb_bps),
    applied_cprb_pct: pickFirstDefined(t.applied_cprb_pct, t.cprb_pct, raw.applied_cprb_pct),
    payroll_inss_bps: pickFirstDefined(t.payroll_inss_bps, t.inss_folha_bps, raw.payroll_inss_bps),
    payroll_inss_pct: pickFirstDefined(t.payroll_inss_pct, t.inss_folha_pct, raw.payroll_inss_pct),
  };
}

function normalizeCurvaAbcItems(raw: Record<string, any>): EngineeringCurvaAbcItemInput[] | undefined {
  const list =
    raw.curva_abc_items ||
    raw.curva_abc ||
    raw.abc_items ||
    raw.itens_curva_abc ||
    raw.budget_items;
  if (!Array.isArray(list)) return undefined;

  return list.map((it: Record<string, any>, idx: number) => {
    const medianCents = pickFirstDefined(
      it.sinapi_sicro_median_unit_cents,
      it.median_unit_cents,
      it.reference_unit_cents,
      it.sinapi_median_unit_cents,
      typeof it.reference_unit_price === "number" ? Math.round(it.reference_unit_price * 100) : undefined,
      typeof it.estimated_unit_price === "number" ? Math.round(it.estimated_unit_price * 100) : undefined,
      0
    )!;
    const offeredCents = pickFirstDefined(
      it.offered_unit_cents,
      it.unit_price_cents,
      it.proposta_unit_cents,
      typeof it.offered_unit_price === "number" ? Math.round(it.offered_unit_price * 100) : undefined,
      typeof it.unit_price === "number" ? Math.round(it.unit_price * 100) : undefined,
      0
    )!;

    return {
      item_id: String(it.item_id || it.code || `ITEM-${idx + 1}`),
      description: String(it.description || it.descricao || "Item de Engenharia"),
      reference_source: it.reference_source || it.source || "SINAPI",
      quantity: Number(it.quantity ?? it.quantidade ?? 1),
      sinapi_sicro_median_unit_cents: medianCents,
      offered_unit_cents: offeredCents,
      specificity_justification_approved: Boolean(
        it.specificity_justification_approved ?? it.justificativa_especificidade_aprovada
      ),
    };
  });
}

function normalizeScheduleAndRisk(raw: Record<string, any>): EngineeringScheduleAndRiskInput | undefined {
  const src =
    raw.schedule_and_risk ||
    raw.scheduleAndRisk ||
    raw.cronograma_fisico_financeiro ||
    raw.cronograma ||
    raw.schedule ||
    raw.risk_matrix;

  const s: Record<string, any> = typeof src === "object" && src !== null ? src : {};
  const rawStages = pickFirstDefined(
    s.schedule_stages,
    s.stages,
    s.etapas,
    s.etapas_cronograma,
    raw.schedule_stages,
    raw.stages,
    raw.etapas_cronograma,
    raw.cronograma_etapas
  );

  const schedule_stages: EngineeringScheduleStageInput[] | undefined = Array.isArray(rawStages)
    ? rawStages.map((st: Record<string, any>, idx: number) => ({
        stage_number: Number(st.stage_number ?? st.stage ?? st.etapa ?? st.period ?? idx + 1),
        description: st.description ?? st.descricao,
        reference_physical_cumulative_bps: pickFirstDefined(
          st.reference_physical_cumulative_bps,
          st.physical_cumulative_bps,
          st.avanco_fisico_acumulado_bps
        ),
        reference_physical_cumulative_pct: pickFirstDefined(
          st.reference_physical_cumulative_pct,
          st.physical_cumulative_pct,
          st.physical_progress_pct,
          st.avanco_fisico_acumulado_pct,
          st.physical_pct
        ),
        financial_disbursement_cumulative_bps: pickFirstDefined(
          st.financial_disbursement_cumulative_bps,
          st.financial_cumulative_bps,
          st.desembolso_financeiro_acumulado_bps
        ),
        financial_disbursement_cumulative_pct: pickFirstDefined(
          st.financial_disbursement_cumulative_pct,
          st.financial_cumulative_pct,
          st.financial_disbursement_pct,
          st.desembolso_financeiro_acumulado_pct,
          st.financial_pct
        ),
      }))
    : undefined;

  const frontLoading = pickFirstDefined(
    s.front_loading_detected,
    s.has_front_loading,
    s.front_loading,
    raw.front_loading_detected,
    raw.has_front_loading,
    raw.front_loading
  );
  const hasRiskMatrix = pickFirstDefined(
    s.has_risk_allocation_matrix,
    s.risk_matrix_present,
    s.has_risk_matrix,
    s.matriz_riscos_presente,
    raw.has_risk_allocation_matrix,
    raw.has_risk_matrix,
    raw.matriz_riscos_presente
  );
  const hasAnteprojeto = pickFirstDefined(
    s.has_anteprojeto_or_basic_design,
    raw.has_anteprojeto_or_basic_design
  );
  const attemptsDesignAddendum = pickFirstDefined(
    s.attempts_design_error_addendum_without_legal_exception,
    s.design_error_addendum_attempted,
    s.illegal_design_addendum,
    s.requests_design_error_addendum,
    s.aditivo_erro_projeto_sem_excecao,
    s.aditivo_falha_projeto,
    raw.attempts_design_error_addendum_without_legal_exception,
    raw.design_error_addendum_attempted,
    raw.illegal_design_addendum,
    raw.requests_design_error_addendum,
    raw.aditivo_erro_projeto_sem_excecao,
    raw.aditivo_falha_projeto
  );

  if (
    !src &&
    schedule_stages === undefined &&
    frontLoading === undefined &&
    hasRiskMatrix === undefined &&
    hasAnteprojeto === undefined &&
    attemptsDesignAddendum === undefined
  ) {
    return undefined;
  }

  return {
    front_loading_detected: frontLoading,
    schedule_stages,
    has_risk_allocation_matrix: hasRiskMatrix,
    has_anteprojeto_or_basic_design: hasAnteprojeto,
    attempts_design_error_addendum_without_legal_exception: attemptsDesignAddendum,
  };
}

export function normalizeEngineeringWorksInput(rawObj: any): EngineeringWorksAuditInput {
  const raw: Record<string, any> = rawObj && typeof rawObj === "object" ? rawObj : {};
  const bdi_evaluation = normalizeBdiInput(raw);

  return {
    workspace_dir: pickFirstDefined(raw.workspace_dir, raw.workspaceDir, raw.output_dir, raw.outputDir),
    case_id: pickFirstDefined(raw.case_id, raw.process_id),
    contract_regime: pickFirstDefined(raw.contract_regime, raw.legal_regime),
    work_typology: pickFirstDefined(raw.work_typology, raw.typology, raw.tipologia_obra, "CONSTRUCAO_EDIFICIOS"),
    execution_regime: pickFirstDefined(raw.execution_regime, raw.regime_execucao),
    estimated_budget_cents: pickFirstDefined(raw.estimated_budget_cents, raw.estimated_total_cents),
    estimated_budget_value: pickFirstDefined(raw.estimated_budget_value, raw.estimated_total_value),
    offered_proposal_cents: pickFirstDefined(raw.offered_proposal_cents, raw.offered_total_cents),
    offered_proposal_value: pickFirstDefined(raw.offered_proposal_value, raw.offered_total_value),
    additional_guarantee_offered: pickFirstDefined(raw.additional_guarantee_offered, raw.garantia_adicional_ofertada),
    summary_disqualification_attempted: pickFirstDefined(raw.summary_disqualification_attempted, raw.desclassificacao_sumaria_tentada),
    prior_diligence_opportunity_granted: pickFirstDefined(
      raw.prior_diligence_opportunity_granted,
      raw.sumula_262_diligence_opened,
      raw.diligencia_previa_concedida
    ),
    diligence_viability_proven: pickFirstDefined(raw.diligence_viability_proven, raw.exequibilidade_comprovada_diligencia),
    has_unit_price_overpricing: pickFirstDefined(
      raw.has_unit_price_overpricing,
      raw.jogo_de_planilha_detected,
      raw.unit_price_overpricing_detected
    ),
    bdi_evaluation: bdi_evaluation as EngineeringBdiInput,
    tax_desoneracao_cprb: normalizeTaxInput(raw),
    curva_abc_items: normalizeCurvaAbcItems(raw),
    unit_price_items: raw.unit_price_items || raw.unit_items,
    schedule_and_risk: normalizeScheduleAndRisk(raw),
    output_format: pickFirstDefined(raw.output_format, raw.outputFormat),
  };
}
