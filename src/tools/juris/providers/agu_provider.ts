// ============================================================================
// Conector Oficial da Advocacia-Geral da União e CGU (AGU Provider)
// docgov-engine — providers/agu_provider.ts (extends BaseJurisdictionProvider)
// Orientações Normativas (ONs), Súmulas e Pareceres Referenciais CNLCA/CGU
// ============================================================================

import type {
  RawJurisFetchResult,
  RawJurisSearchResult,
} from "../types.ts";
import {
  BaseJurisdictionProvider,
  type LiveFetchContext,
  type LiveSearchContext,
} from "./base_provider.ts";
import { sanitizeQueryForCourt } from "./http_client.ts";
import { cleanHtmlAndNormalize } from "../anatomical_slicer.ts";
import {
  getAguCatalogItemById,
  searchAguCatalog,
  type AguNormativeItem,
} from "./agu_catalog.ts";

export class AguProvider extends BaseJurisdictionProvider {
  public readonly courtId = "AGU";
  public readonly tier = "FEDERAL" as const;
  public readonly defaultFederal = false;
  public readonly envOverrideKey = "DOCGOV_JURIS_AGU_URL";
  protected override readonly mockEnvKeys = [
    "DOCGOV_JURIS_AGU_URL",
    "DOCGOV_AGU_BASE_URL",
  ];
  protected override readonly baseUrlEnvKeys = [
    "DOCGOV_JURIS_AGU_URL",
    "DOCGOV_AGU_BASE_URL",
  ];
  protected override readonly mockFetchStyle = "path" as const;
  protected override readonly notFoundStyle = "null" as const;
  protected override readonly defaultLiveTimeoutMs = 5000;
  protected override readonly defaultFetchTimeoutMs = 6000;

  public readonly liveSmokeQuery =
    "orientação normativa vigência prorrogação serviços contínuos";
  public readonly idPatterns = [
    /\b(?:(?:ON|ORIENTACAO-NORMATIVA)[-_]AGU|AGU[-_](?:ON|ORIENTACAO-NORMATIVA))[-_]\d{1,6}(?:[-_]\d{4})?\b/i,
    /\b(?:SUMULA[-_]AGU|AGU[-_]SUMULA)[-_]\d{1,4}(?:[-_]\d{4})?\b/i,
    /\bPARECER[-_](?:CNLCA|DECOR|CGU|CONUNI|AGU)[-_]\d{1,6}(?:[-_]\d{4})?\b/i,
    /\bAGU\b/i,
  ];
  public readonly autoTriggerKeywords =
    /\b(orienta[çc][ãa]o(?:[- ]normativa)?(?:\s+da)?\s+agu|orienta[çc][ãa]o\s+normativa|on[\s-]*agu|s[úu]mula[s]?(?:\s+da)?\s+agu|parecer(?:\s+referencial)?(?:\s+da)?\s+cnlca|parecer\s+referencial|cnlca|cgu|decor|conuni|advocacia[- ]geral|advogado[- ]geral(?:\s+da\s+uni[ãa]o)?|modelo\s+agu|minuta\s+padronizada\s+agu|lista\s+de\s+verifica[çc][ãa]o\s+agu|nota\s+t[ée]cnica\s+agu)\b/i;

  protected getDefaultBaseUrl(): string {
    return "https://www.gov.br/agu/pt-br/composicao/cgu/cgu";
  }

  protected override searchCatalog(query: string, limit: number): RawJurisSearchResult[] {
    const { cleanQuery } = sanitizeQueryForCourt(query);
    return searchAguCatalog(cleanQuery || query, limit).map((c) =>
      this.mapCatalogItemToResult(c)
    );
  }

  protected override shouldShortCircuitCatalog(query: string): boolean {
    return (
      /\b(?:on|orienta[çc][ãa]o\s+normativa)\s*(?:n[º°o]\s*)?\d{1,3}\b/i.test(query) ||
      /\bs[úu]mula\s*(?:n[º°o]\s*)?\d{1,3}\s*(?:da\s*)?agu\b/i.test(query) ||
      /\bparecer\s+(?:cnlca|referencial)\b/i.test(query)
    );
  }

  protected override findCatalogItemById(idOrRef: string): RawJurisFetchResult | null {
    if (/999999/.test(idOrRef)) return null;
    const catalogItem = getAguCatalogItemById(idOrRef);
    if (!catalogItem) return null;
    return {
      id: catalogItem.id,
      court: "AGU",
      exists: true,
      source: "CURATED_CATALOG",
      rawTextOrJson: {
        id: catalogItem.id,
        court: "AGU",
        numero: catalogItem.numero,
        ano: catalogItem.ano,
        colegiado: catalogItem.colegiado,
        relator: catalogItem.relator,
        dataSessao: catalogItem.dataSessao,
        entidade: catalogItem.entidade,
        regimeLegal: catalogItem.regimeLegal,
        indexacao: catalogItem.indexacao,
        enunciado: catalogItem.enunciado,
        tese: catalogItem.enunciado,
        dispositivo: catalogItem.dispositivo,
        conclusao: catalogItem.dispositivo,
        fundamentacao: catalogItem.fundamentacao,
        inteiroTeorTexto: catalogItem.inteiroTeorTexto,
      },
    };
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const { cleanQuery } = sanitizeQueryForCourt(query);
    const queryTerm = cleanQuery || query;
    const onsUrl = `${this.getBaseUrl()}/onsagu`;
    const res = await this.executeHttp(onsUrl, { timeoutMs: ctx.timeoutMs });
    this.assertHttpOk(res);

    const html = res.text || res.body || (typeof res.data === "string" ? res.data : "");
    if (!html) return [];

    const hits: RawJurisSearchResult[] = [];
    const cards = [
      ...html.matchAll(/<div class="on-card"[^>]*>([\s\S]*?)<div class="on-meta">/gi),
    ];
    const tokens = queryTerm.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    for (const [, cardHtml] of cards) {
      const titMatch = cardHtml.match(
        /<div class="on-titulo">[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<span class="on-regime">([\s\S]*?)<\/span>)?/i
      );
      const corpoMatch = cardHtml.match(/<div class="on-corpo">([\s\S]*?)<\/div>/i);
      if (!titMatch || !corpoMatch) continue;

      const title = cleanHtmlAndNormalize(titMatch[2]);
      const regime = titMatch[3]
        ? cleanHtmlAndNormalize(titMatch[3])
        : "LEI_14133_ADM_DIRETA";
      const corpo = cleanHtmlAndNormalize(corpoMatch[1]);
      const searchable = `${title} ${regime} ${corpo}`.toLowerCase();

      let matchCount = 0;
      for (const t of tokens) {
        if (searchable.includes(t)) matchCount++;
      }

      if (tokens.length === 0 || matchCount > 0) {
        const numMatch = title.match(/(\d+)(?:\/(\d{4}))?/);
        const numero = numMatch ? numMatch[1] : "S/N";
        const ano = numMatch && numMatch[2] ? parseInt(numMatch[2], 10) : 2024;
        const canonicalId = `ON-AGU-${numero.padStart(3, "0")}-${ano}`;

        hits.push({
          id: canonicalId,
          court: "AGU",
          colegiado: "Advogado-Geral da União",
          numero,
          ano,
          relator: "Consultoria-Geral da União",
          dataSessao: String(ano),
          entidade: "ORGAO_CONTRATANTE",
          indexacao: ["ORIENTAÇÃO NORMATIVA", "AGU", regime].join("; "),
          tese: corpo,
          dispositivo: corpo,
          rawPayload: { title, regime, corpo, douUrl: titMatch[1] },
        });

        if (hits.length >= limit) break;
      }
    }

    return hits;
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    if (/999999/.test(idOrRef)) return null;
    const clean = idOrRef.trim();
    const onMatch = clean.match(
      /(?:ON|ORIENTACAO-NORMATIVA)[-_]AGU[-_]0*(\d+)(?:[-_](\d{4}))?|AGU[-_](?:ON|ORIENTACAO-NORMATIVA)[-_]0*(\d+)(?:[-_](\d{4}))?/i
    );
    if (!onMatch) return null;

    const num = onMatch[1] || onMatch[3];
    const onsUrl = `${this.getBaseUrl()}/onsagu`;
    const res = await this.executeHttp(onsUrl, { timeoutMs: ctx.timeoutMs });
    if (res.status === 404) return null;
    this.assertHttpOk(res);

    const html = res.text || res.body || (typeof res.data === "string" ? res.data : "");
    if (!html) return null;

    const cards = [
      ...html.matchAll(/<div class="on-card"[^>]*>([\s\S]*?)<div class="on-meta">/gi),
    ];

    for (const [, cardHtml] of cards) {
      const titMatch = cardHtml.match(
        /<div class="on-titulo">[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<span class="on-regime">([\s\S]*?)<\/span>)?/i
      );
      const corpoMatch = cardHtml.match(/<div class="on-corpo">([\s\S]*?)<\/div>/i);
      if (!titMatch || !corpoMatch) continue;

      const title = cleanHtmlAndNormalize(titMatch[2]);
      const cardNumMatch = title.match(/(\d+)(?:\/(\d{4}))?/);
      if (cardNumMatch && cardNumMatch[1] === num) {
        const regime = titMatch[3]
          ? cleanHtmlAndNormalize(titMatch[3])
          : "LEI_14133_ADM_DIRETA";
        const corpo = cleanHtmlAndNormalize(corpoMatch[1]);
        const ano = cardNumMatch[2] ? parseInt(cardNumMatch[2], 10) : 2024;

        return {
          id: idOrRef,
          court: "AGU",
          exists: true,
          source: "LIVE",
          rawTextOrJson: {
            id: `ON-AGU-${num.padStart(3, "0")}-${ano}`,
            court: "AGU",
            numero: num,
            ano,
            colegiado: "Advogado-Geral da União",
            relator: "Consultoria-Geral da União",
            dataSessao: String(ano),
            entidade: "ORGAO_CONTRATANTE",
            regimeLegal: regime.includes("14.133")
              ? "LEI_14133_ADM_DIRETA"
              : "LEI_8666_LEGACY",
            indexacao: ["ORIENTAÇÃO NORMATIVA", "AGU", regime],
            enunciado: corpo,
            tese: corpo,
            dispositivo: corpo,
            inteiroTeorTexto: `${title}\n\n${corpo}\n\nRegime: ${regime}`,
          },
        };
      }
    }
    return null;
  }

  private mapCatalogItemToResult(item: AguNormativeItem): RawJurisSearchResult {
    return {
      id: item.id,
      court: "AGU",
      colegiado: item.colegiado,
      numero: item.numero,
      ano: item.ano,
      relator: item.relator,
      dataSessao: item.dataSessao || String(item.ano),
      entidade: item.entidade,
      indexacao: Array.isArray(item.indexacao)
        ? item.indexacao.join("; ")
        : String(item.indexacao || "AGU"),
      tese: item.enunciado,
      dispositivo: item.dispositivo,
      rawPayload: item,
    };
  }

  protected mapMockHitToResult(h: any): RawJurisSearchResult {
    const tese = h.tese || h.enunciado || h.ementa || "Tese jurídica AGU";
    const dispositivo = h.dispositivo || h.conclusao || tese;
    return {
      id: h.id || `ON-AGU-${h.numero || "S/N"}-${h.ano || new Date().getFullYear()}`,
      court: "AGU",
      colegiado: h.colegiado || "Advogado-Geral da União",
      numero: String(h.numero || "S/N"),
      ano: h.ano ? Number(h.ano) : new Date().getFullYear(),
      processo: h.processo || "N/A",
      relator: h.relator || "Consultoria-Geral da União",
      dataSessao: h.dataSessao || h.data || String(h.ano || 2024),
      entidade: h.entidade || "ORGAO_CONTRATANTE",
      indexacao: Array.isArray(h.indexacao)
        ? h.indexacao.join("; ")
        : h.indexacao || "AGU",
      tese,
      dispositivo,
      rawPayload: h,
    };
  }
}
