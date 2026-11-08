// ============================================================================
// Testes Unitários: Limites de Aditamento e Governança Contratual (Gen5)
// docgov-engine v1.5.0 — test/contracts/addendum_limits.test.ts
// ============================================================================

import { describe, it, expect } from "bun:test";
import { auditContractAddendums } from "../../src/contracts/addendum_auditor.ts";
import { auditContractExecution } from "../../src/contracts/audit_contract_execution.ts";

describe("Fiscalização Contratual — Limites de Aditamento e Vedações (Marco 8.1)", () => {
  it("deve aprovar aditivo de compras/serviços dentro do limite geral de 25%", () => {
    const res = auditContractAddendums({
      contract_id: "CT-SERV-01",
      object_type: "SERVICE",
      legal_regime: "LEI_14133",
      initial_value: 1000000,
      addendums: [
        { id: "TA-01", value_increase: 200000, value_decrease: 0, is_consensual: true },
      ],
    });

    expect(res.blocking_tags).toHaveLength(0);
    expect(res.gross_increase_pct).toBe(20.0);
    expect(res.legal_limit_pct).toBe(25.0);
  });

  it("deve bloquear aditivo de compras/serviços que ultrapasse o limite de 25%", () => {
    const res = auditContractAddendums({
      contract_id: "CT-COMPRAS-02",
      object_type: "PURCHASE",
      legal_regime: "LEI_14133",
      initial_value: 1000000,
      addendums: [
        { id: "TA-01", value_increase: 280000, value_decrease: 0 },
      ],
    });

    expect(res.blocking_tags).toContain("[ADDENDUM_LIMIT_EXCEEDED_25PCT]");
    expect(res.gross_increase_pct).toBe(28.0);
  });

  it("deve admitir até 50% de acréscimo para reformas de edifícios e equipamentos", () => {
    const resReform = auditContractAddendums({
      contract_id: "CT-OBRA-03",
      object_type: "BUILDING_REFORM",
      legal_regime: "LEI_14133",
      initial_value: 2000000,
      addendums: [
        { id: "TA-01", value_increase: 800000 }, // 40% < 50%
      ],
    });

    expect(resReform.is_reform).toBe(true);
    expect(resReform.legal_limit_pct).toBe(50.0);
    expect(resReform.blocking_tags).toHaveLength(0);

    const resOverReform = auditContractAddendums({
      contract_id: "CT-OBRA-04",
      object_type: "EQUIPMENT_REFORM",
      legal_regime: "LEI_14133",
      initial_value: 1000000,
      addendums: [
        { id: "TA-01", value_increase: 550000 }, // 55% > 50%
      ],
    });

    expect(resOverReform.blocking_tags).toContain("[ADDENDUM_LIMIT_EXCEEDED_50PCT]");
    expect(resOverReform.gross_increase_pct).toBe(55.0);
  });

  it("deve vedar expressamente a compensação entre acréscimos e supressões para mascarar limites", () => {
    // Acréscimo bruto de 32% com supressão de 10% (saldo líquido 22% <= 25%)
    const res = auditContractAddendums({
      contract_id: "CT-ENG-05",
      object_type: "WORK",
      legal_regime: "LEI_14133",
      initial_value: 1000000,
      addendums: [
        { id: "TA-01", value_increase: 320000, value_decrease: 100000 },
      ],
    });

    expect(res.compensation_attempted).toBe(true);
    expect(res.blocking_tags).toContain("[ADDENDUM_COMPENSATION_FORBIDDEN]");
    expect(res.blocking_tags).toContain("[ADDENDUM_LIMIT_EXCEEDED_25PCT]");
  });

  it("deve emitir [STATE_ENTERPRISE_UNILATERAL_ADDENDUM_BLOCK] se houver aditivo unilateral na Lei 13.303/2016", () => {
    const resUnilateral = auditContractAddendums({
      contract_id: "CT-ESTATAL-06",
      object_type: "SERVICE",
      legal_regime: "LEI_13303",
      initial_value: 500000,
      addendums: [
        { id: "TA-01", value_increase: 50000, is_unilateral: true },
      ],
    });

    expect(resUnilateral.blocking_tags).toContain("[STATE_ENTERPRISE_UNILATERAL_ADDENDUM_BLOCK]");

    const resConsensual = auditContractAddendums({
      contract_id: "CT-ESTATAL-07",
      object_type: "SERVICE",
      legal_regime: "LEI_13303",
      initial_value: 500000,
      is_consensual: true,
      addendums: [
        { id: "TA-01", value_increase: 50000, is_unilateral: false },
      ],
    });

    expect(resConsensual.blocking_tags).not.toContain("[STATE_ENTERPRISE_UNILATERAL_ADDENDUM_BLOCK]");
  });

  it("deve emitir [ILLEGAL_ARP_ADDENDUM_BLOCK] caso o alvo de aditamento quantitativo seja diretamente uma ARP", () => {
    const resArp = auditContractAddendums({
      contract_id: "ARP-2024-99",
      target_instrument: "ARP",
      is_arp_direct_addendum: true,
      initial_value: 1000000,
      addendums: [
        { id: "TA-ARP-01", value_increase: 250000 },
      ],
    });

    expect(resArp.blocking_tags).toContain("[ILLEGAL_ARP_ADDENDUM_BLOCK]");
  });

  it("deve integrar a orquestração completa em auditContractExecution gerando relatórios em disco", async () => {
    const { report, synthetic } = await auditContractExecution({
      contract_id: "CT-INTEGRADO-08",
      legal_regime: "LEI_14133",
      object_type: "SERVICE",
      initial_value: 1000000,
      addendums: [
        { id: "TA-01", value_increase: 300000, value_decrease: 80000 },
      ],
    });

    expect(report.status).toBe("blocked");
    expect(synthetic.status).toBe("blocked");
    expect(synthetic.blocking_tags).toContain("[ADDENDUM_COMPENSATION_FORBIDDEN]");
    expect(synthetic.blocking_tags).toContain("[ADDENDUM_LIMIT_EXCEEDED_25PCT]");
    expect(synthetic.adherence_summary.gross_increase_pct).toBe(30.0);
    expect(synthetic.report_json_path).toBeTruthy();
    expect(synthetic.dossier_md_path).toBeTruthy();

    const byteLength = Buffer.byteLength(JSON.stringify(synthetic), "utf-8");
    expect(byteLength).toBeLessThan(900);
  });
});
