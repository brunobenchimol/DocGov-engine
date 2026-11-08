// ============================================================================
// Testes Unitários: Batimento Tripartite e Reajustes/Repactuações (Gen5)
// docgov-engine v1.5.0 — test/contracts/tripartite_and_readjustment.test.ts
// ============================================================================

import { describe, it, expect } from "bun:test";
import { matchTripartiteExecution } from "../../src/contracts/tripartite_matcher.ts";
import { auditReadjustmentsAndRepactuations } from "../../src/contracts/readjustment_auditor.ts";
import { auditContractExecution } from "../../src/contracts/audit_contract_execution.ts";

describe("Fiscalização Contratual — Batimento Tripartite e Reajustes (Marcos 8.2 e 8.3)", () => {
  it("deve aprovar execução com conformidade plena entre TR, Proposta, ARP e Fatura", () => {
    const res = matchTripartiteExecution({
      tripartite_items: [
        {
          item_id: "ITEM-01",
          winning_proposal: { quantity: 100, unit_price: 50.0 },
          contract_or_invoice: { quantity: 100, unit_price: 50.0 },
        },
      ],
    });

    expect(res.blocking_tags).toHaveLength(0);
    expect(res.divergent_items_count).toBe(0);
    expect(res.total_overpricing_value).toBe(0);
  });

  it("deve detectar sobrepreço unitário no batimento tripartite e emitir [TRIPARTITE_OVERPRICING_DETECTED]", () => {
    const res = matchTripartiteExecution({
      tripartite_items: [
        {
          item_id: "ITEM-01",
          description: "Estação de Trabalho",
          winning_proposal: { quantity: 50, unit_price: 4000.0 },
          contract_or_invoice: { quantity: 50, unit_price: 4500.0 }, // +500 por unidade
        },
      ],
    });

    expect(res.blocking_tags).toContain("[TRIPARTITE_OVERPRICING_DETECTED]");
    expect(res.divergent_items_count).toBe(1);
    expect(res.total_overpricing_value).toBe(25000.0);
    expect(res.items[0].reason).toContain("Preço unitário faturado/contratado");
  });

  it("deve detectar superfaturamento quantitativo no faturamento", () => {
    const res = matchTripartiteExecution({
      tripartite_items: [
        {
          item_id: "ITEM-02",
          winning_proposal: { quantity: 100, unit_price: 10.0 },
          contract_or_invoice: { quantity: 130, unit_price: 10.0 }, // +30 unidades faturadas
        },
      ],
    });

    expect(res.blocking_tags).toContain("[TRIPARTITE_OVERPRICING_DETECTED]");
    expect(res.items[0].qty_divergence).toBe(30);
    expect(res.total_overpricing_value).toBe(300.0);
  });

  it("deve validar o interregno legal de 12 meses para reajustes e emitir [READJUSTMENT_INTERREGNUM_VIOLATION_12M] se violado", () => {
    const resEarly = auditReadjustmentsAndRepactuations({
      readjustments: [
        {
          id: "REAJ-01",
          type: "REAJUSTE_INDICE",
          months_elapsed: 8, // < 12 meses
        },
      ],
    });

    expect(resEarly.blocking_tags).toContain("[READJUSTMENT_INTERREGNUM_VIOLATION_12M]");
    expect(resEarly.violations_count).toBe(1);

    const resRegular = auditReadjustmentsAndRepactuations({
      readjustments: [
        {
          id: "REAJ-02",
          type: "REAJUSTE_INDICE",
          months_elapsed: 12,
        },
      ],
    });

    expect(resRegular.blocking_tags).toHaveLength(0);
    expect(resRegular.violations_count).toBe(0);
  });

  it("deve exigir comprovação formal de CCT homologada em repactuações de mão de obra", () => {
    const resNoCct = auditReadjustmentsAndRepactuations({
      readjustments: [
        {
          id: "REPAC-01",
          type: "REPACTUACAO_CCT",
          months_elapsed: 13,
          has_cct_proof: false, // sem CCT
        },
      ],
    });

    expect(resNoCct.blocking_tags).toContain("[READJUSTMENT_INTERREGNUM_VIOLATION_12M]");
    expect(resNoCct.violations_count).toBe(1);

    const resWithCct = auditReadjustmentsAndRepactuations({
      readjustments: [
        {
          id: "REPAC-02",
          type: "REPACTUACAO_CCT",
          months_elapsed: 12,
          has_cct_proof: true,
        },
      ],
    });

    expect(resWithCct.blocking_tags).toHaveLength(0);
    expect(resWithCct.violations_count).toBe(0);
  });

  it("deve consolidar múltiplas anomalias em auditContractExecution com payload < 900 bytes", async () => {
    const { report, synthetic } = await auditContractExecution({
      contract_id: "CT-MULTI-09",
      legal_regime: "LEI_14133",
      object_type: "SERVICE",
      initial_value: 500000,
      tripartite_items: [
        {
          item_id: "ITEM-A",
          winning_proposal: { quantity: 10, unit_price: 100 },
          contract_or_invoice: { quantity: 10, unit_price: 120 },
        },
      ],
      readjustments: [
        {
          id: "REAJ-A",
          type: "REAJUSTE_INDICE",
          months_elapsed: 6,
        },
      ],
    });

    expect(report.status).toBe("blocked");
    expect(synthetic.blocking_tags).toContain("[TRIPARTITE_OVERPRICING_DETECTED]");
    expect(synthetic.blocking_tags).toContain("[READJUSTMENT_INTERREGNUM_VIOLATION_12M]");

    const byteLen = Buffer.byteLength(JSON.stringify(synthetic), "utf-8");
    expect(byteLen).toBeLessThan(900);
  });
});
