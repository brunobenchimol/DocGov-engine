// ============================================================================
// Motor de Validação Cruzada Tripartite e Quadripartite (Gen5)
// docgov-engine v1.5.0 — src/contracts/tripartite_matcher.ts
// [TR / Edital] <-> [Proposta Vencedora] <-> [ARP] <-> [Contrato / OS / Fatura]
// ============================================================================

import type { RawContractInput, RawTripartiteItem } from "./types.ts";

export interface TripartiteAuditResult {
  blocking_tags: string[];
  items_analyzed: number;
  divergent_items_count: number;
  total_overpricing_value: number;
  items: Array<{
    item_id: string;
    description?: string;
    overpricing_detected: boolean;
    unit_divergence_pct?: number;
    qty_divergence?: number;
    reason?: string;
  }>;
}

export function matchTripartiteExecution(input: RawContractInput): TripartiteAuditResult {
  const blocking_tags: string[] = [];
  const rawItems: RawTripartiteItem[] =
    input.tripartite_items || input.tripartite || input.items || [];

  let items_analyzed = 0;
  let divergent_items_count = 0;
  let total_overpricing_value = 0;
  const items: TripartiteAuditResult["items"] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    items_analyzed++;

    const itemId = raw.item_id || raw.itemId || `ITEM-${i + 1}`;
    const desc = raw.description || `Item de fornecimento ${i + 1}`;

    // Resolução de preços unitários tolerante
    const proposalPrice = Number(
      raw.winning_proposal?.unit_price ??
      raw.winning_proposal?.unitPrice ??
      raw.proposal_unit_price ??
      raw.proposalUnitPrice ??
      raw.arp?.unit_price ??
      raw.arp?.unitPrice ??
      raw.arp_unit_price ??
      raw.arpUnitPrice ??
      raw.edital_tr?.unit_price ??
      raw.edital_tr?.unitPrice ??
      raw.tr_unit_price ??
      raw.trUnitPrice ??
      0
    );

    const contractOrInvoicePrice = Number(
      raw.contract_or_invoice?.unit_price ??
      raw.contract_or_invoice?.unitPrice ??
      raw.invoice_unit_price ??
      raw.invoiceUnitPrice ??
      raw.contract_unit_price ??
      raw.contractUnitPrice ??
      0
    );

    // Resolução de quantidades tolerante
    const homologatedQty = Number(
      raw.winning_proposal?.quantity ??
      raw.edital_tr?.quantity ??
      raw.homologated_qty ??
      raw.homologatedQty ??
      raw.contract_qty ??
      raw.contractQty ??
      0
    );

    const invoicedQty = Number(
      raw.contract_or_invoice?.quantity ??
      raw.invoiced_qty ??
      raw.invoicedQty ??
      raw.attested_qty ??
      raw.attestedQty ??
      0
    );

    let itemOverpriced = Boolean(raw.overpricing_detected ?? raw.overpricingDetected);
    let unitDivergencePct = 0;
    let qtyDivergence = 0;
    const reasons: string[] = [];

    // Detecção de sobrepreço unitário: Contrato/Fatura > Proposta/ARP/TR
    if (proposalPrice > 0 && contractOrInvoicePrice > proposalPrice + 0.001) {
      itemOverpriced = true;
      unitDivergencePct = ((contractOrInvoicePrice - proposalPrice) / proposalPrice) * 100;
      const unitDelta = contractOrInvoicePrice - proposalPrice;
      const effectiveQty = invoicedQty > 0 ? invoicedQty : (homologatedQty > 0 ? homologatedQty : 1);
      total_overpricing_value += unitDelta * effectiveQty;
      reasons.push(
        `Preço unitário faturado/contratado (R$ ${contractOrInvoicePrice.toFixed(2)}) superior ao homologado/proposta (R$ ${proposalPrice.toFixed(2)}) (+${unitDivergencePct.toFixed(2)}%)`
      );
    }

    // Detecção de superfaturamento quantitativo: Quantidade faturada > Quantidade homologada/contratada
    if (homologatedQty > 0 && invoicedQty > homologatedQty) {
      itemOverpriced = true;
      qtyDivergence = invoicedQty - homologatedQty;
      const priceToUse = contractOrInvoicePrice > 0 ? contractOrInvoicePrice : proposalPrice;
      total_overpricing_value += qtyDivergence * priceToUse;
      reasons.push(
        `Quantidade faturada/atestada (${invoicedQty}) excede a quantidade contratada/homologada (${homologatedQty})`
      );
    }

    if (raw.advance_payment_without_guarantee) {
      itemOverpriced = true;
      reasons.push("Pagamento antecipado atestado sem a prestação da garantia contratual correspondente");
    }

    if (raw.unauthorized_suppression) {
      itemOverpriced = true;
      reasons.push("Supressão fática unilateral de item essencial sem termo aditivo regular");
    }

    if (itemOverpriced) {
      divergent_items_count++;
    }

    items.push({
      item_id: itemId,
      description: desc,
      overpricing_detected: itemOverpriced,
      unit_divergence_pct: unitDivergencePct > 0 ? Number(unitDivergencePct.toFixed(2)) : undefined,
      qty_divergence: qtyDivergence > 0 ? qtyDivergence : undefined,
      reason: reasons.length > 0 ? reasons.join("; ") : undefined,
    });
  }

  if (divergent_items_count > 0) {
    blocking_tags.push("[TRIPARTITE_OVERPRICING_DETECTED]");
  }

  return {
    blocking_tags,
    items_analyzed,
    divergent_items_count,
    total_overpricing_value: Number(total_overpricing_value.toFixed(2)),
    items,
  };
}
