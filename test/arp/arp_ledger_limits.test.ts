// ============================================================================
// Testes Unitários: Livro-Razão e Limites 50%/200% de ARP (Gen5)
// docgov-engine v1.5.0 — test/arp/arp_ledger_limits.test.ts
// ============================================================================

import { describe, it, expect } from "bun:test";
import { computeArpLedger } from "../../src/arp/ledger_engine.ts";
import { governArpExecution } from "../../src/arp/govern_arp.ts";

describe("Governança de ARP — Livro-Razão e Travas 50% / 200% (Marco 8.4)", () => {
  it("deve aprovar pedido de carona dentro das travas individual (<= 50%) e global (<= 200%)", () => {
    const res = computeArpLedger({
      arp_number: "ARP-01/2024",
      items: [
        {
          item_id: "ITEM-A",
          registered_qty: 100,
          consumed_by_managing_and_participants: 30, // saldo próprio = 70
          previous_carona_adhesions: 120, // 120% acumulado anterior
          requested_adhesion_qty: 40, // 40% individual <= 50%, novo total = 160% <= 200%
        },
      ],
    });

    expect(res.blocking_tags).toHaveLength(0);
    expect(res.max_individual_ratio_pct).toBe(40.0);
    expect(res.max_global_ratio_pct).toBe(160.0);
    expect(res.preserved_own_balance_intact).toBe(true);
    expect(res.items_ledger[0].own_balance_preserved).toBe(70);
  });

  it("deve bloquear pedido que ultrapassar a trava individual de 50% por item", () => {
    const res = computeArpLedger({
      arp_number: "ARP-02/2024",
      items: [
        {
          item_id: "ITEM-B",
          registered_qty: 100,
          previous_carona_adhesions: 0,
          requested_adhesion_qty: 55, // 55% > 50%
        },
      ],
    });

    expect(res.blocking_tags).toContain("[ARP_INDIVIDUAL_LIMIT_EXCEEDED_50PCT]");
    expect(res.max_individual_ratio_pct).toBe(55.0);
  });

  it("deve bloquear pedido que fizer o acumulado de caronas ultrapassar o teto global de 200%", () => {
    const res = computeArpLedger({
      arp_number: "ARP-03/2024",
      items: [
        {
          item_id: "ITEM-C",
          registered_qty: 100,
          previous_carona_adhesions: 180, // já concedeu 180%
          requested_adhesion_qty: 30, // 30% individual OK, mas 180 + 30 = 210% > 200%
        },
      ],
    });

    expect(res.blocking_tags).toContain("[ARP_GLOBAL_LIMIT_EXCEEDED_200PCT]");
    expect(res.blocking_tags).not.toContain("[ARP_INDIVIDUAL_LIMIT_EXCEEDED_50PCT]");
    expect(res.max_global_ratio_pct).toBe(210.0);
  });

  it("deve emitir ambos os bloqueios quando ultrapassar individual (50%) e global (200%) simultaneamente", () => {
    const res = computeArpLedger({
      arp_number: "ARP-04/2024",
      items: [
        {
          item_id: "ITEM-D",
          registered_qty: 100,
          previous_carona_adhesions: 160,
          requested_adhesion_qty: 60, // 60 > 50% e 160 + 60 = 220 > 200%
        },
      ],
    });

    expect(res.blocking_tags).toContain("[ARP_INDIVIDUAL_LIMIT_EXCEEDED_50PCT]");
    expect(res.blocking_tags).toContain("[ARP_GLOBAL_LIMIT_EXCEEDED_200PCT]");
  });

  it("deve preservar o saldo próprio inviolável do órgão gerenciador e participantes", () => {
    const res = computeArpLedger({
      arp_number: "ARP-05/2024",
      items: [
        {
          item_id: "ITEM-E",
          registered_qty: 500,
          manager_own_qty: 200,
          participants_qty: 100,
          previous_carona_adhesions: 600, // 120%
          requested_adhesion_qty: 200, // 40% <= 50%
        },
      ],
    });

    expect(res.preserved_own_balance_intact).toBe(true);
    expect(res.items_ledger[0].own_balance_preserved).toBe(200); // 500 - 300 = 200
  });

  it("deve orquestrar governArpExecution com status blocked e payload < 900 bytes", async () => {
    const { dossier, synthetic } = await governArpExecution({
      arp_number: "ARP-ORQ-01",
      registered_qty: 100,
      prior_adhesions_qty: 170,
      requested_adhesion_qty: 45, // 170 + 45 = 215% > 200%
    });

    expect(dossier.status).toBe("blocked");
    expect(dossier.decision).toBe("REJECTED");
    expect(synthetic.decision).toBe("REJECTED");
    expect(synthetic.blocking_tags).toContain("[ARP_GLOBAL_LIMIT_EXCEEDED_200PCT]");

    const byteLength = Buffer.byteLength(JSON.stringify(synthetic), "utf-8");
    expect(byteLength).toBeLessThan(900);
  });
});
