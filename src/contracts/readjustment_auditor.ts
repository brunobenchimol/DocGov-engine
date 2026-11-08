// ============================================================================
// Monitoramento e Histórico de Reajustes / Repactuações (Gen5)
// docgov-engine v1.5.0 — src/contracts/readjustment_auditor.ts
// Validação do Interregno Mínimo de 12 Meses e Memória de Cálculo Auditável
// ============================================================================

import type { RawContractInput, RawReadjustmentItem } from "./types.ts";

export interface ReadjustmentAuditResult {
  blocking_tags: string[];
  events_analyzed: number;
  violations_count: number;
  events: Array<{
    id: string;
    type: string;
    months_elapsed: number;
    interregnum_ok: boolean;
    cct_proof_ok: boolean;
    applied_percentage?: number;
    justification?: string;
  }>;
}

function calculateMonthsBetween(startDateStr?: string, endDateStr?: string): number | null {
  if (!startDateStr || !endDateStr) return null;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 0;
  const days = diffMs / (1000 * 60 * 60 * 24);
  return Number((days / 30.4375).toFixed(1));
}

export function auditReadjustmentsAndRepactuations(input: RawContractInput): ReadjustmentAuditResult {
  const blocking_tags: string[] = [];

  const rawList: RawReadjustmentItem[] = [];
  if (Array.isArray(input.readjustments)) rawList.push(...input.readjustments);
  if (Array.isArray(input.reajustes)) rawList.push(...input.reajustes);
  if (input.readjustment && !Array.isArray(input.readjustment)) rawList.push(input.readjustment);
  if (input.reajuste && !Array.isArray(input.reajuste)) rawList.push(input.reajuste);

  let events_analyzed = 0;
  let violations_count = 0;
  const events: ReadjustmentAuditResult["events"] = [];

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    events_analyzed++;

    const id = item.id || `REAJ-${i + 1}`;
    const rawType = (item.type || "").toUpperCase();
    const isRepactuation = rawType.includes("REPACTUA") || rawType.includes("CCT") || (item.index_name || item.index || "").toUpperCase().includes("CCT");

    // Cálculo ou recuperação de meses transcorridos
    let monthsElapsed = Number(item.months_elapsed ?? item.interregnum_months ?? -1);
    if (monthsElapsed < 0) {
      const baseDate = item.base_date || item.budget_base_date;
      const reqDate = item.request_date || item.grant_date;
      const calculated = calculateMonthsBetween(baseDate, reqDate);
      monthsElapsed = calculated !== null ? calculated : 12; // default se não informado
    }

    const interregnumOk = monthsElapsed >= 12;

    // Repactuação exige comprovação de CCT homologada
    let cctProofOk = true;
    if (isRepactuation) {
      if (item.has_cct_proof === false || item.hasCctProof === false || item.cct_attached === false || item.cctAttached === false) {
        cctProofOk = false;
      }
    }

    const hasViolation = !interregnumOk || !cctProofOk;
    if (hasViolation) {
      violations_count++;
    }

    const justificationParts: string[] = [];
    if (!interregnumOk) {
      justificationParts.push(
        `Interregno de ${monthsElapsed} meses inferior ao prazo legal mínimo de 12 meses (365 dias)`
      );
    }
    if (!cctProofOk) {
      justificationParts.push(
        "Repactuação de mão de obra exclusiva desacompanhada da respectiva CCT/Acordo Coletivo de Trabalho homologado"
      );
    }

    events.push({
      id,
      type: isRepactuation ? "REPACTUACAO_CCT" : (item.type || "REAJUSTE_INDICE"),
      months_elapsed: monthsElapsed,
      interregnum_ok: interregnumOk,
      cct_proof_ok: cctProofOk,
      applied_percentage: item.applied_percentage,
      justification: justificationParts.length > 0 ? justificationParts.join("; ") : undefined,
    });
  }

  if (violations_count > 0) {
    blocking_tags.push("[READJUSTMENT_INTERREGNUM_VIOLATION_12M]");
  }

  return {
    blocking_tags,
    events_analyzed,
    violations_count,
    events,
  };
}
