// ============================================================================
// Avaliador de BDI (Acórdão TCU 2.622/2013) & Súmulas 253 e 254
// docgov-engine v1.6.6 — src/engineering/bdi_acordao_2622_evaluator.ts
// ============================================================================

import type {
  EngineeringBdiEvaluationSummary,
  EngineeringBdiInput,
  EngineeringWorkTypology,
} from "./types.ts";

export interface Acordao2622QuartileSpec {
  q1_bps: number;
  median_bps: number;
  q3_bps: number;
  label: string;
}

export const ACORDAO_2622_BDI_QUARTILES: Record<
  EngineeringWorkTypology,
  Acordao2622QuartileSpec
> = {
  CONSTRUCAO_EDIFICIOS: {
    q1_bps: 2034,
    median_bps: 2212,
    q3_bps: 2500,
    label: "Construção de Edifícios",
  },
  RODOVIARIA: {
    q1_bps: 1960,
    median_bps: 2097,
    q3_bps: 2423,
    label: "Obras Rodoviárias e Ferroviárias",
  },
  REDES_AGUA_ESGOTO: {
    q1_bps: 2076,
    median_bps: 2418,
    q3_bps: 2644,
    label: "Redes de Abastecimento de Água e Coleta de Esgoto",
  },
  REDES_ENERGIA_ELETRICA: {
    q1_bps: 2400,
    median_bps: 2584,
    q3_bps: 2786,
    label: "Redes de Energia Elétrica",
  },
  PORTUARIA_MARITIMA: {
    q1_bps: 2280,
    median_bps: 2748,
    q3_bps: 3095,
    label: "Obras Portuárias, Marítimas e Fluviais",
  },
  FORNECIMENTO_MATERIAIS_EQUIPAMENTOS: {
    q1_bps: 1110,
    median_bps: 1402,
    q3_bps: 1680,
    label: "Fornecimento de Materiais e Equipamentos (Mero Fornecimento)",
  },
};

export function toBps(bpsVal?: number, pctVal?: number, fallback = 0): number {
  if (typeof bpsVal === "number" && Number.isFinite(bpsVal)) {
    return Math.round(bpsVal);
  }
  if (typeof pctVal === "number" && Number.isFinite(pctVal)) {
    return Math.round(pctVal * 100);
  }
  return fallback;
}

function fmtBpsPct(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(".", ",")}%`;
}

export function calculateOfficialTcu2622BdiBps(bdi: EngineeringBdiInput): {
  calculated_bdi_bps: number;
  tax_sum_bps: number;
  denominator_invalid: boolean;
} {
  const ac = toBps(bdi.central_admin_bps, bdi.central_admin_pct) / 10000;
  const s =
    toBps(bdi.insurance_and_guarantee_bps, bdi.insurance_and_guarantee_pct) /
    10000;
  const r = toBps(bdi.risk_bps, bdi.risk_pct) / 10000;
  const df =
    toBps(bdi.financial_expenses_bps, bdi.financial_expenses_pct) / 10000;
  const l = toBps(bdi.profit_bps, bdi.profit_pct) / 10000;

  const pisBps = toBps(bdi.pis_bps, bdi.pis_pct);
  const cofinsBps = toBps(bdi.cofins_bps, bdi.cofins_pct);
  const issBps = toBps(bdi.iss_bps, bdi.iss_pct);
  const cprbBps = toBps(bdi.cprb_bps, bdi.cprb_pct);
  const taxSumBps = pisBps + cofinsBps + issBps + cprbBps;
  const i = taxSumBps / 10000;

  if (1 - i <= 0) {
    return {
      calculated_bdi_bps: 0,
      tax_sum_bps: taxSumBps,
      denominator_invalid: true,
    };
  }

  const ratio = ((1 + ac + s + r) * (1 + df) * (1 + l)) / (1 - i) - 1;
  return {
    calculated_bdi_bps: Math.round(ratio * 10000),
    tax_sum_bps: taxSumBps,
    denominator_invalid: false,
  };
}

export function evaluateBdiAcordao2622(
  workTypology: EngineeringWorkTypology,
  bdi: EngineeringBdiInput
): EngineeringBdiEvaluationSummary {
  const quartile =
    ACORDAO_2622_BDI_QUARTILES[workTypology] ||
    ACORDAO_2622_BDI_QUARTILES.CONSTRUCAO_EDIFICIOS;
  const equipmentSpec =
    ACORDAO_2622_BDI_QUARTILES.FORNECIMENTO_MATERIAIS_EQUIPAMENTOS;

  const blocking_tags: string[] = [];
  const findings: string[] = [];

  const { calculated_bdi_bps, denominator_invalid } =
    calculateOfficialTcu2622BdiBps(bdi);
  const declaredBdiBps = toBps(
    bdi.declared_bdi_bps,
    bdi.declared_bdi_pct,
    calculated_bdi_bps
  );

  // 1. Validação algébrica da fórmula oficial do Acórdão TCU nº 2.622/2013
  if (denominator_invalid || Math.abs(declaredBdiBps - calculated_bdi_bps) > 5) {
    blocking_tags.push("[ENG_BDI_FORMULA_ALGEBRAIC_MISMATCH_BLOCK]");
    findings.push(
      denominator_invalid
        ? "Fórmula oficial do BDI (Acórdão TCU nº 2.622/2013) com denominador tributário (1 - I) <= 0 inválido."
        : `Divergência algébrica na fórmula do BDI (Acórdão TCU nº 2.622/2013): BDI declarado (${fmtBpsPct(
            declaredBdiBps
          )}) difere do BDI calculado a partir das parcelas (${fmtBpsPct(
            calculated_bdi_bps
          )}).`
    );
  }

  // 2. Controle do 3º Quartil por tipologia (Acórdão TCU nº 2.622/2013)
  const effectiveBdiBps = Math.max(declaredBdiBps, calculated_bdi_bps);
  if (
    effectiveBdiBps > quartile.q3_bps &&
    !bdi.justification_above_q3_proven
  ) {
    blocking_tags.push("[ENG_BDI_ABOVE_TCU_2622_Q3_CEILING_BLOCK]");
    findings.push(
      `BDI de ${fmtBpsPct(
        effectiveBdiBps
      )} excede o 3º Quartil referencial do Acórdão TCU nº 2.622/2013 para ${
        quartile.label
      } (${fmtBpsPct(quartile.q3_bps)}) sem justificativa técnica comprovada.`
    );
  }

  // 3. Súmula TCU nº 253 (BDI Diferenciado para fornecimento relevante de materiais/equipamentos)
  const eqShareBps = toBps(
    bdi.relevant_equipment_share_bps,
    bdi.relevant_equipment_share_pct
  );
  const hasRelevantEquipment =
    Boolean(bdi.has_relevant_equipment_supply) || eqShareBps >= 1000;
  const diffEqBdiBps =
    bdi.differentiated_equipment_bdi_bps !== undefined ||
    bdi.differentiated_equipment_bdi_pct !== undefined
      ? toBps(
          bdi.differentiated_equipment_bdi_bps,
          bdi.differentiated_equipment_bdi_pct
        )
      : undefined;

  if (hasRelevantEquipment) {
    const missingDiff = diffEqBdiBps === undefined;
    const equalToFullGeneral =
      diffEqBdiBps !== undefined &&
      declaredBdiBps > equipmentSpec.q3_bps &&
      diffEqBdiBps >= declaredBdiBps;
    const aboveEqQ3 =
      diffEqBdiBps !== undefined &&
      diffEqBdiBps > equipmentSpec.q3_bps &&
      !bdi.differentiated_bdi_justification_proven;

    if (missingDiff || equalToFullGeneral || aboveEqQ3) {
      blocking_tags.push(
        "[ENG_BDI_SUMULA253_DIFFERENTIATED_MISSING_OR_EXCEEDED_BLOCK]"
      );
      findings.push(
        missingDiff
          ? "Fornecimento relevante de materiais/equipamentos sem definição de BDI Diferenciado reduzido (Súmula TCU nº 253 e Acórdão TCU nº 2.622/2013)."
          : `BDI Diferenciado para materiais/equipamentos (${fmtBpsPct(
              diffEqBdiBps!
            )}) viola a Súmula TCU nº 253 (teto 3º Quartil de ${fmtBpsPct(
              equipmentSpec.q3_bps
            )} ou equiparação indevida ao BDI Geral de ${fmtBpsPct(
              declaredBdiBps
            )}).`
      );
    }
  }

  // 4. Bloqueio de bis in idem (Administração Local, Canteiro e Mobilização no BDI)
  if (
    Boolean(bdi.includes_admin_local_in_bdi) ||
    Boolean(bdi.includes_canteiro_or_mobilizacao_in_bdi) ||
    (bdi.admin_local_in_bdi_bps ?? 0) > 0
  ) {
    blocking_tags.push(
      "[ENG_BDI_ADMIN_LOCAL_CANTEIRO_MOBILIZACAO_BIS_IN_IDEM_BLOCK]"
    );
    findings.push(
      "Inclusão indevida de Administração Local, Instalação de Canteiro ou Mobilização/Desmobilização na taxa de BDI (bis in idem vedado pelo Acórdão TCU nº 2.622/2013; custos devem figurar na planilha direta)."
    );
  }

  // 5. Súmula TCU nº 254 (Vedação de IRPJ e CSLL no BDI ou orçamento)
  const irpjBps = toBps(bdi.irpj_bps, bdi.irpj_pct);
  const csllBps = toBps(bdi.csll_bps, bdi.csll_pct);
  if (Boolean(bdi.includes_irpj_or_csll) || irpjBps > 0 || csllBps > 0) {
    blocking_tags.push("[ENG_BDI_SUMULA254_IRPJ_CSLL_FORBIDDEN_BLOCK]");
    findings.push(
      `Inclusão ilícita de IRPJ (${fmtBpsPct(irpjBps)}) e/ou CSLL (${fmtBpsPct(
        csllBps
      )}) na composição do BDI ou planilha orçamentária (vedação expressa da Súmula TCU nº 254).`
    );
  }

  // 6. Medição proporcional de Administração Local ao avanço físico (Acórdão TCU 2.622/2013)
  const hasProgressData =
    (bdi.physical_progress_bps !== undefined ||
      bdi.physical_progress_pct !== undefined) &&
    (bdi.admin_local_measured_bps !== undefined ||
      bdi.admin_local_measured_pct !== undefined);
  const physicalBps = toBps(bdi.physical_progress_bps, bdi.physical_progress_pct);
  const adminMeasuredBps = toBps(
    bdi.admin_local_measured_bps,
    bdi.admin_local_measured_pct
  );
  if (
    bdi.admin_local_proportional_to_physical_progress === false ||
    (hasProgressData && adminMeasuredBps > physicalBps + 200)
  ) {
    blocking_tags.push("[ENG_ADMIN_LOCAL_NON_PROPORTIONAL_MEASUREMENT_BLOCK]");
    findings.push(
      hasProgressData && adminMeasuredBps > physicalBps + 200
        ? `Medição de Administração Local (${fmtBpsPct(
            adminMeasuredBps
          )}) desproporcional ao avanço físico efetivo da obra (${fmtBpsPct(
            physicalBps
          )}), violando o critério de medição proporcional do Acórdão TCU nº 2.622/2013.`
        : "Critério de pagamento fixo mensal de Administração Local desvinculado da execução física da obra (violação ao Acórdão TCU nº 2.622/2013)."
    );
  }

  return {
    work_typology: workTypology,
    typology_label: quartile.label,
    quartile_q1_bps: quartile.q1_bps,
    quartile_median_bps: quartile.median_bps,
    quartile_q3_bps: quartile.q3_bps,
    declared_bdi_bps: declaredBdiBps,
    calculated_bdi_bps,
    ...(diffEqBdiBps !== undefined
      ? { differentiated_equipment_bdi_bps: diffEqBdiBps }
      : {}),
    equipment_q3_ceiling_bps: equipmentSpec.q3_bps,
    blocking_tags,
    findings,
  };
}
