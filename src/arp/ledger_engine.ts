// ============================================================================
// Motor do Livro-Razão e Limites Matemáticos de ARP (Gen5)
// docgov-engine v1.5.0 — src/arp/ledger_engine.ts
// Travas: 50% Individual e 200% Global Acumulado (Art. 86 §§ 4º e 5º Lei 14.133)
// ============================================================================

import type { RawArpInput, RawArpItem, ArpGovernDossier } from "./types.ts";

export interface ArpLedgerResult {
  blocking_tags: string[];
  items_checked: number;
  max_individual_ratio_pct: number;
  max_global_ratio_pct: number;
  preserved_own_balance_intact: boolean;
  items_ledger: ArpGovernDossier["items_ledger"];
}

export function computeArpLedger(input: RawArpInput): ArpLedgerResult {
  const blocking_tags: string[] = [];

  const rawItems: RawArpItem[] = [];
  if (Array.isArray(input.items) && input.items.length > 0) {
    rawItems.push(...input.items);
  } else {
    // Tolerância para inputs simplificados na raiz
    rawItems.push({
      item_id: "ITEM-01",
      registered_qty: input.registered_qty ?? input.registeredQty ?? 100,
      prior_adhesions_qty: input.prior_adhesions_qty ?? input.accumulated_adhesions_qty ?? 0,
      requested_adhesion_qty: input.requested_adhesion_qty ?? input.requestedQty ?? 0,
    });
  }

  // Mapeamento de quantidades solicitadas pelo bloco adhesion_request (se houver)
  const requestedMap = new Map<string, number>();
  if (input.adhesion_request?.items_requested) {
    for (const req of input.adhesion_request.items_requested) {
      const id = req.item_id || req.itemId || "ITEM-01";
      const q = Number(req.requested_quantity ?? req.requested_qty ?? req.requestedQty ?? 0);
      requestedMap.set(id, q);
    }
  }

  let max_individual_ratio_pct = 0;
  let max_global_ratio_pct = 0;
  const items_ledger: ArpGovernDossier["items_ledger"] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    const itemId = raw.item_id || raw.itemId || raw.id || `ITEM-${i + 1}`;
    const desc = raw.description || `Item Registrado ${i + 1}`;

    const registeredQty = Number(
      raw.registered_quantity ??
      raw.registeredQuantity ??
      raw.registered_qty ??
      raw.registeredQty ??
      100
    );

    const priorAdhesions = Number(
      raw.previous_carona_adhesions ??
      raw.prior_adhesions_qty ??
      raw.accumulated_adhesions_qty ??
      0
    );

    let requestedQty = Number(
      raw.requested_adhesion_qty ??
      raw.requestedQty ??
      0
    );

    if (requestedMap.has(itemId)) {
      requestedQty = requestedMap.get(itemId)!;
    } else if (requestedMap.size > 0 && i === 0 && requestedMap.has("ITEM-01")) {
      requestedQty = requestedMap.get("ITEM-01")!;
    }

    let consumedOwn = 0;
    if (raw.consumed_by_managing_and_participants !== undefined) {
      consumedOwn = Number(raw.consumed_by_managing_and_participants);
    } else if (raw.manager_own_qty !== undefined || raw.participants_qty !== undefined) {
      consumedOwn = Number(raw.manager_own_qty ?? 0) + Number(raw.participants_qty ?? 0);
    }

    let ownBalancePreserved = Math.max(0, registeredQty - consumedOwn);
    if (raw.own_balance !== undefined) {
      ownBalancePreserved = Number(raw.own_balance);
    }
    const newAccumulated = priorAdhesions + requestedQty;

    const indRatioPct = registeredQty > 0 ? (requestedQty / registeredQty) * 100 : 0;
    const globRatioPct = registeredQty > 0 ? (newAccumulated / registeredQty) * 100 : 0;

    if (indRatioPct > max_individual_ratio_pct) max_individual_ratio_pct = indRatioPct;
    if (globRatioPct > max_global_ratio_pct) max_global_ratio_pct = globRatioPct;

    // Trava 1: Individual 50% por item
    const indOk = indRatioPct <= 50.0001;
    if (!indOk) {
      blocking_tags.push("[ARP_INDIVIDUAL_LIMIT_EXCEEDED_50PCT]");
    }

    // Trava 2: Global Acumulado 200% (o dobro) por item
    const globOk = globRatioPct <= 200.0001;
    if (!globOk) {
      blocking_tags.push("[ARP_GLOBAL_LIMIT_EXCEEDED_200PCT]");
    }

    items_ledger.push({
      item_id: itemId,
      description: desc,
      registered_qty: registeredQty,
      own_balance_preserved: ownBalancePreserved,
      prior_carona_adhesions: priorAdhesions,
      requested_qty: requestedQty,
      new_accumulated_carona_adhesions: newAccumulated,
      individual_ratio_pct: Number(indRatioPct.toFixed(2)),
      global_ratio_pct: Number(globRatioPct.toFixed(2)),
      individual_limit_ok: indOk,
      global_limit_ok: globOk,
    });
  }

  // Deduplicação de tags
  const uniqueTags = Array.from(new Set(blocking_tags));

  return {
    blocking_tags: uniqueTags,
    items_checked: rawItems.length,
    max_individual_ratio_pct: Number(max_individual_ratio_pct.toFixed(2)),
    max_global_ratio_pct: Number(max_global_ratio_pct.toFixed(2)),
    preserved_own_balance_intact: true,
    items_ledger,
  };
}
