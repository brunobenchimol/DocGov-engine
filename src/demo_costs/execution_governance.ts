// ============================================================================
// Governança Contratual DEMO: APT (Acórdão 1.586/2018), Conta Vinculada
// (Anexo XII IN 05/2017), Fato Gerador & Repactuação (Art. 135 Lei 14.133)
// docgov-engine v1.6.5 — src/demo_costs/execution_governance.ts
// ============================================================================

import type { DemoExecutionSummary, DemoRegimeAuditInput } from "./types.ts";

export interface ExecutionGovernanceResult {
  apt_renewal_purge_monthly_savings_cents: number;
  linked_account_monthly_provision_cents: number;
  blocking_tags: string[];
  findings: string[];
  summary: DemoExecutionSummary;
}

function formatCents(cents: number): string {
  const val = (cents / 100).toFixed(2);
  const [intPart, decPart] = val.split(".");
  return `R$ ${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decPart}`;
}

export function evaluateDemoExecutionGovernance(
  input: DemoRegimeAuditInput,
  module1_cents: number,
  total_sub22_bps: number
): ExecutionGovernanceResult {
  const blocking_tags: string[] = [];
  const findings: string[] = [];
  const exec = input.execution_governance;

  const aptFirstYearBps = Math.round(
    Number(input.module3_termination.apt_first_year_bps || 0)
  );
  const isFirstRenewal = exec?.is_first_renewal_or_after_12m === true;
  const renewalAptBps =
    exec?.renewal_apt_bps !== undefined && exec?.renewal_apt_bps !== null
      ? Math.round(Number(exec.renewal_apt_bps))
      : undefined;

  // 1. Expurgo de 90% do Aviso Prévio Trabalhado na 1ª prorrogação (1,94% -> 0,194%)
  let apt_renewal_purge_monthly_savings_cents = 0;
  if (isFirstRenewal) {
    if (renewalAptBps === undefined || renewalAptBps > 20) {
      blocking_tags.push("[DEMO_EXEC_APT_FIRST_RENEWAL_PURGE_ACORDAO_1586_MISSING]");
      const currentAptBps = renewalAptBps ?? aptFirstYearBps;
      const targetPurgedBps = Math.min(19, Math.round(aptFirstYearBps * 0.1));
      const deltaBps = Math.max(0, currentAptBps - targetPurgedBps);
      apt_renewal_purge_monthly_savings_cents = Math.round(
        (module1_cents * deltaBps * (10000 + total_sub22_bps)) / 100000000
      );
      findings.push(
        `Execução (Acórdão TCU nº 1.586/2018): Ausência de expurgo de 90% do Aviso Prévio Trabalhado na 1ª prorrogação (APT mantido em ${(currentAptBps / 100).toFixed(3)}%, teto pós-expurgo <= 0,194%). Glosa devida: ${formatCents(apt_renewal_purge_monthly_savings_cents)}/mês.`
      );
    } else {
      const deltaBps = Math.max(0, aptFirstYearBps - renewalAptBps);
      apt_renewal_purge_monthly_savings_cents = Math.round(
        (module1_cents * deltaBps * (10000 + total_sub22_bps)) / 100000000
      );
    }
  }

  // 2. Conta-Depósito Vinculada (Anexo XII) vs. Fato Gerador & Repactuação (Art. 135)
  const sub21RefBps = 833 + 1210; // 13º (8,33%) + Férias e 1/3 (12,10%)
  const sub22OnSub21Bps = Math.round((sub21RefBps * total_sub22_bps) / 10000);
  const linkedAccountComputedBps = sub21RefBps + 400 + sub22OnSub21Bps;

  let linked_account_monthly_provision_cents = 0;
  let breachReasons: string[] = [];

  if (exec) {
    if (exec.mitigation_mechanism === "CONTA_VINCULADA") {
      linked_account_monthly_provision_cents = Math.round(
        (module1_cents * linkedAccountComputedBps) / 10000
      );
      const retained =
        exec.linked_account_retained_bps !== undefined &&
        exec.linked_account_retained_bps !== null
          ? Math.round(Number(exec.linked_account_retained_bps))
          : undefined;
      if (retained === undefined || retained < 2950 || retained > 3133) {
        breachReasons.push(
          `retenção da Conta-Depósito Vinculada (${retained !== undefined ? (retained / 100).toFixed(2) + "%" : "ausente"}) fora da faixa normativa Anexo XII (29,50% a 31,33%)`
        );
      }
    } else if (exec.mitigation_mechanism === "FATO_GERADOR") {
      linked_account_monthly_provision_cents = 0;
      const unprovenCents = Math.round(
        Number(exec.fato_gerador_unproven_events_paid_cents || 0)
      );
      if (unprovenCents > 0) {
        breachReasons.push(
          `pagamento pelo Fato Gerador com eventos sem comprovação efetiva (${formatCents(unprovenCents)})`
        );
      }
    }

    if (exec.repactuation) {
      const rep = exec.repactuation;
      if (Number(rep.months_since_last_cct_date_base || 0) < 12) {
        breachReasons.push(
          `repactuação por CCT com interregno inferior a 12 meses (${rep.months_since_last_cct_date_base} meses — Art. 135 § 3º Lei 14.133/2021)`
        );
      }
      if (rep.module5_reajusted_by_cct_salary_index === true) {
        breachReasons.push(
          "reajuste ilícito de insumos/equipamentos (Módulo 5) pelo índice salarial da CCT"
        );
      }
      if (rep.indirect_or_profit_rate_increased === true) {
        breachReasons.push(
          "majoração indevida da taxa percentual de Custos Indiretos ou Lucro na repactuação"
        );
      }
    }
  }

  if (breachReasons.length > 0) {
    blocking_tags.push(
      "[DEMO_EXEC_LINKED_ACCOUNT_FATO_GERADOR_OR_REPACTUATION_BREACH]"
    );
    findings.push(
      `Governança de Execução DEMO: ${breachReasons.join("; ")}.`
    );
  }

  return {
    apt_renewal_purge_monthly_savings_cents,
    linked_account_monthly_provision_cents,
    blocking_tags,
    findings,
    summary: {
      mitigation_mechanism: exec?.mitigation_mechanism || "NOT_SPECIFIED",
      is_first_renewal_or_after_12m: isFirstRenewal,
      apt_first_year_bps: aptFirstYearBps,
      ...(renewalAptBps !== undefined ? { renewal_apt_bps: renewalAptBps } : {}),
      apt_renewal_purge_annual_savings_cents:
        apt_renewal_purge_monthly_savings_cents * 12,
      linked_account_computed_bps: linkedAccountComputedBps,
      ...(exec?.linked_account_retained_bps !== undefined
        ? {
            linked_account_retained_bps: Math.round(
              Number(exec.linked_account_retained_bps)
            ),
          }
        : {}),
      repactuation_checked: Boolean(exec?.repactuation),
    },
  };
}
