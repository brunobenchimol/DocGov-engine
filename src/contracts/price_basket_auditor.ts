// ============================================================================
// Motor Estatístico Anti-Outlier de Cesta de Preços e Álea Extraordinária (Gen5.5)
// docgov-engine v1.5.5 — src/contracts/price_basket_auditor.ts
// IN SEGES/ME nº 65/2021, RILC, Art. 22 e Art. 124, II, "d" da Lei 14.133/2021
// ============================================================================

import type {
  RawContractInput,
  RawPriceBasketItem,
  RawRebalanceRequest,
  PriceBasketAnalysisItem,
  RebalanceAnalysisItem,
} from "./types.ts";

export interface PriceBasketAndRebalanceResult {
  blocking_tags: string[];
  price_basket_analysis: {
    items_analyzed: number;
    high_dispersion_warnings_count: number;
    items: PriceBasketAnalysisItem[];
  };
  extraordinary_rebalance_analysis: {
    events_analyzed: number;
    violations_count: number;
    events: RebalanceAnalysisItem[];
  };
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function analyzeBasketItem(
  item: RawPriceBasketItem,
  index: number
): { analysis: PriceBasketAnalysisItem; triggerHighDispersion: boolean } | null {
  const rawQuotes = item.quotes || item.cotacoes || item.samples || [];
  const quotes = rawQuotes.map((q) => Number(q)).filter((q) => !isNaN(q) && q > 0);
  if (quotes.length < 2) return null;

  const n = quotes.length;
  const sorted = [...quotes].sort((a, b) => a - b);
  const sum = quotes.reduce((acc, q) => acc + q, 0);
  const mean = sum / n;

  const median =
    n % 2 === 1
      ? sorted[Math.floor(n / 2)]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

  const variance =
    quotes.reduce((acc, q) => acc + Math.pow(q - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const cvPct = mean > 0 ? (stdDev / mean) * 100 : 0;

  const lowerBound = mean - stdDev;
  const upperBound = mean + stdDev;

  const outliersRemoved = quotes.filter((q) => q < lowerBound || q > upperBound);
  const sanitizedQuotes = quotes.filter((q) => q >= lowerBound && q <= upperBound);
  const sanitizedMean =
    sanitizedQuotes.length > 0
      ? sanitizedQuotes.reduce((acc, q) => acc + q, 0) / sanitizedQuotes.length
      : median;

  const highDispersion = cvPct > 25.0;
  const metric = (
    item.selected_metric ||
    item.selectedMetric ||
    item.selected_method ||
    item.selectedMethod ||
    ""
  ).toUpperCase();

  const rawClaimed =
    item.claimed_reference_price ??
    item.claimedReferencePrice ??
    item.proposed_unit_price ??
    item.proposedUnitPrice;
  const claimed = rawClaimed !== undefined ? Number(rawClaimed) : undefined;

  const usesSimpleMeanByMetric =
    metric === "MEAN" || metric === "MEDIA" || metric === "SIMPLE_MEAN";
  const usesSimpleMeanByPrice =
    claimed !== undefined &&
    !isNaN(claimed) &&
    metric !== "MEDIAN" &&
    metric !== "MEDIANA" &&
    metric !== "SANITIZED_MEAN" &&
    metric !== "MEDIA_SANEADA" &&
    Math.abs(claimed - mean) < Math.abs(claimed - median) &&
    Math.abs(claimed - median) > 1.0;
  const noMethodChosen = metric === "" && claimed === undefined;

  const triggerHighDispersion =
    highDispersion &&
    (usesSimpleMeanByMetric || usesSimpleMeanByPrice || noMethodChosen);

  const recommendedMethod = highDispersion ? "MEDIAN" : metric || "MEAN";
  const recommendedReferencePrice = highDispersion ? round2(median) : round2(mean);

  return {
    analysis: {
      item_id: item.item_id || item.itemId || `BASKET-${index + 1}`,
      description: item.description,
      quotes_count: n,
      mean: round2(mean),
      median: round2(median),
      std_dev: round2(stdDev),
      cv_pct: round2(cvPct),
      lower_bound: round2(lowerBound),
      upper_bound: round2(upperBound),
      outliers_removed: outliersRemoved.map(round2),
      sanitized_mean: round2(sanitizedMean),
      high_dispersion: highDispersion,
      selected_metric: metric || undefined,
      recommended_method: recommendedMethod,
      recommended_reference_price: recommendedReferencePrice,
    },
    triggerHighDispersion,
  };
}

export function auditPriceBasketAndRebalance(
  input: RawContractInput
): PriceBasketAndRebalanceResult {
  const blockingTagsSet = new Set<string>();

  // 1. Auditoria Estatística Anti-Outlier da Cesta de Preços (IN 65/2021)
  const rawBasketList: RawPriceBasketItem[] = [
    ...toArray(input.price_basket),
    ...toArray(input.priceBasket),
    ...toArray(input.cesta_precos),
  ];

  const basketItems: PriceBasketAnalysisItem[] = [];
  let highDispersionWarningsCount = 0;

  for (let i = 0; i < rawBasketList.length; i++) {
    const analyzed = analyzeBasketItem(rawBasketList[i], i);
    if (!analyzed) continue;

    basketItems.push(analyzed.analysis);
    if (analyzed.triggerHighDispersion) {
      highDispersionWarningsCount++;
      blockingTagsSet.add("[PRICE_BASKET_HIGH_DISPERSION_USE_MEDIAN]");
    }
  }

  // 2. Auditoria de Reequilíbrio Econômico-Financeiro (Álea Extraordinária)
  const rawRebalanceList: RawRebalanceRequest[] = [
    ...toArray(input.rebalance_claim),
    ...toArray(input.rebalanceClaim),
    ...toArray(input.rebalance_request),
    ...toArray(input.rebalanceRequest),
    ...toArray(input.rebalance_requests),
    ...toArray(input.rebalanceRequests),
    ...toArray(input.reequilibrio),
  ];

  const rebalanceEvents: RebalanceAnalysisItem[] = [];
  let rebalanceViolationsCount = 0;

  for (let i = 0; i < rawRebalanceList.length; i++) {
    const req = rawRebalanceList[i];
    const id = req.id || `REEQ-${i + 1}`;
    const desc = req.event_description || req.eventDescription;
    const rawRiskTo = (req.risk_allocated_to || req.riskAllocatedTo || "UNSPECIFIED").toUpperCase();
    const isExtraordinary = req.is_extraordinary_unforeseeable ?? req.isExtraordinaryUnforeseeable;
    const isOrdinaryInflation = req.is_ordinary_inflation ?? req.isOrdinaryInflation;
    const rawNature = (req.event_nature || req.eventNature || "").toUpperCase();

    const riskAllocatedToContractor =
      rawRiskTo === "CONTRACTOR" || rawRiskTo === "CONTRATADA";

    const isOrdinaryEvent =
      isExtraordinary === false ||
      isOrdinaryInflation === true ||
      rawNature.includes("ORDINARY") ||
      rawNature.includes("ORDINARIA") ||
      rawNature.includes("INFLATION") ||
      rawNature.includes("INFLACAO");

    const eligible = !riskAllocatedToContractor && !isOrdinaryEvent;
    const reasons: string[] = [];

    if (riskAllocatedToContractor) {
      reasons.push("Evento expressamente alocado à contratada na Matriz de Riscos (Art. 22, § 2º)");
    }
    if (isOrdinaryEvent) {
      reasons.push(
        "Oscilação ordinária/inflacionária não configura álea extraordinária e extracontratual (Art. 124, II, 'd')"
      );
    }

    if (!eligible) {
      rebalanceViolationsCount++;
      blockingTagsSet.add("[EXTRAORDINARY_RISK_ALLOCATED_TO_CONTRACTOR_BLOCK]");
    }

    rebalanceEvents.push({
      id,
      event_description: desc,
      event_nature: rawNature || (isOrdinaryEvent ? "ORDINARY_INFLATION" : "EXTRAORDINARY"),
      risk_allocated_to: rawRiskTo,
      extraordinary_unforeseeable: !isOrdinaryEvent,
      eligible_for_revision: eligible,
      reason: reasons.length > 0 ? reasons.join("; ") : undefined,
    });
  }

  return {
    blocking_tags: Array.from(blockingTagsSet),
    price_basket_analysis: {
      items_analyzed: basketItems.length,
      high_dispersion_warnings_count: highDispersionWarningsCount,
      items: basketItems,
    },
    extraordinary_rebalance_analysis: {
      events_analyzed: rebalanceEvents.length,
      violations_count: rebalanceViolationsCount,
      events: rebalanceEvents,
    },
  };
}
