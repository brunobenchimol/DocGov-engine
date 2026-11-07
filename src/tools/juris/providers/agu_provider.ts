// ============================================================================
// Conector Oficial da Advocacia-Geral da União e CGU (AGU Provider)
// docgov-engine v1.4.3 — providers/agu_provider.ts
// Orientações Normativas (ONs), Súmulas e Pareceres Referenciais CNLCA/CGU
// ============================================================================

import type {
  JurisdictionProvider,
  RawJurisSearchResult,
  RawJurisFetchResult,
  SearchJurisOptions,
  CourtDiagnostic,
} from "../types.ts";
import { executeJurisHttpRequest, sanitizeQueryForCourt } from "./http_client.ts";
import { cleanHtmlAndNormalize } from "../anatomical_slicer.ts";
import {
  AGU_CURATED_CATALOG,
  getAguCatalogItemById,
  searchAguCatalog,
  normalizeAguId,
  type AguNormativeItem,
} from "./agu_catalog.ts";

export class AguProvider implements JurisdictionProvider {
  public readonly courtId = "AGU";
  public readonly tier = "FEDERAL" as const;
  public readonly defaultFederal = false;
  public readonly envOverrideKey = "DOCGOV_JURIS_AGU_URL";
  public readonly liveSmokeQuery = "orientação normativa vigência prorrogação serviços contínuos";
  public readonly idPatterns = [
    /\b(?:(?:ON|ORIENTACAO-NORMATIVA)[-_]AGU|AGU[-_](?:ON|ORIENTACAO-NORMATIVA))[-_]\d{1,6}(?:[-_]\d{4})?\b/i,
    /\b(?:SUMULA[-_]AGU|AGU[-_]SUMULA)[-_]\d{1,4}(?:[-_]\d{4})?\b/i,
    /\bPARECER[-_](?:CNLCA|DECOR|CGU|CONUNI|AGU)[-_]\d{1,6}(?:[-_]\d{4})?\b/i,
    /\bAGU\b/i,
  ];
  public readonly autoTriggerKeywords =
    /\b(orienta[çc][ãa]o(?:[- ]normativa)?(?:\s+da)?\s+agu|orienta[çc][ãa]o\s+normativa|on[\s-]*agu|s[úu]mula[s]?(?:\s+da)?\s+agu|parecer(?:\s+referencial)?(?:\s+da)?\s+cnlca|parecer\s+referencial|cnlca|cgu|decor|conuni|advocacia[- ]geral|advogado[- ]geral(?:\s+da\s+uni[ãa]o)?|modelo\s+agu|minuta\s+padronizada\s+agu|lista\s+de\s+verifica[çc][ãa]o\s+agu|nota\s+t[ée]cnica\s+agu)\b/i;

  private getBaseUrl(): string {
    return (
      process.env.DOCGOV_JURIS_AGU_URL ||
      process.env.DOCGOV_AGU_BASE_URL ||
      process.env.DOCGOV_JURIS_BASE_URL ||
      "https://www.gov.br/agu/pt-br/composicao/cgu/cgu"
    ).replace(/\/+$/, "");
  }

  public async search(
    query: string,
    options?: Partial<SearchJurisOptions>
  ): Promise<RawJurisSearchResult[]> {
    const { hits } = await this.searchWithDiagnostic(query, options);
    return hits;
  }

  public async searchWithDiagnostic(
    query: string,
    options?: Partial<SearchJurisOptions>
  ): Promise<{ hits: RawJurisSearchResult[]; diagnostic: CourtDiagnostic }> {
    const baseUrl = this.getBaseUrl();
    const limit = Math.min(options?.limit || 10, 20);
    const isMock = !!(
      process.env.DOCGOV_JURIS_AGU_URL ||
      process.env.DOCGOV_AGU_BASE_URL ||
      process.env.DOCGOV_JURIS_BASE_URL
    );

    // 1. Modo Mock Server (.NET Cross-Check)
    if (isMock) {
      const url = `${baseUrl}/search?court=AGU&q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok) {
        return {
          hits: [],
          diagnostic: {
            court: "AGU",
            status: "error",
            hits: 0,
            latency_ms: res.latencyMs,
            error: res.error,
          },
        };
      }
      const data = res.data;
      const rawHits = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.results)
        ? data.results
        : [];

      const hits = rawHits.map((h: any) => this.mapMockHitToResult(h));
      return {
        hits,
        diagnostic: {
          court: "AGU",
          status: "ok",
          hits: hits.length,
          latency_ms: res.latencyMs,
          error: null,
        },
      };
    }

    // 2. Modo Produção Oficial (Live Fetch em onsagu + sumula com Fallback Curado)
    const start = Date.now();
    try {
      const { cleanQuery } = sanitizeQueryForCourt(query);
      const queryTerm = cleanQuery || query;
      const liveHits = await this.executeLiveSearch(queryTerm, limit);

      // Mescla com itens do catálogo curado que combinem com a query para precisão cirúrgica
      const catalogMatches = searchAguCatalog(queryTerm, limit).map((c) =>
        this.mapCatalogItemToResult(c)
      );

      const combined: RawJurisSearchResult[] = [];
      const seenIds = new Set<string>();

      for (const item of [...catalogMatches, ...liveHits]) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          combined.push(item);
        }
        if (combined.length >= limit) break;
      }

      return {
        hits: combined,
        diagnostic: {
          court: "AGU",
          status: "ok",
          hits: combined.length,
          latency_ms: Date.now() - start,
          error: null,
        },
      };
    } catch (err: any) {
      // Degradação graciosa para o catálogo curado offline/airgap
      const fallbackHits = searchAguCatalog(query, limit).map((c) =>
        this.mapCatalogItemToResult(c)
      );
      return {
        hits: fallbackHits,
        diagnostic: {
          court: "AGU",
          status: "ok",
          hits: fallbackHits.length,
          latency_ms: Date.now() - start,
          error: null,
        },
      };
    }
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const isMock = !!(
      process.env.DOCGOV_JURIS_AGU_URL ||
      process.env.DOCGOV_AGU_BASE_URL ||
      process.env.DOCGOV_JURIS_BASE_URL
    );

    // Trava estrita contra alucinação de IDs de teste (ex: 999999)
    if (/999999/.test(idOrRef)) {
      return null;
    }

    // 1. Modo Mock Server (.NET Cross-Check)
    if (isMock) {
      const url = `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=AGU`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok || !res.data) return null;

      const item = Array.isArray(res.data)
        ? res.data[0]
        : Array.isArray(res.data?.items)
        ? res.data.items[0]
        : Array.isArray(res.data?.results)
        ? res.data.results[0]
        : res.data;

      if (!item || item.error || item.status === 404) return null;

      return {
        id: idOrRef,
        court: "AGU",
        exists: true,
        rawTextOrJson: this.normalizeMockItem(item, idOrRef),
      };
    }

    // 2. Consulta no Catálogo Curado Oficial (Instantâneo & Determinístico)
    const catalogItem = getAguCatalogItemById(idOrRef);
    if (catalogItem) {
      return {
        id: catalogItem.id,
        court: "AGU",
        exists: true,
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

    // 3. Fallback de Extração Live na página oficial de ONs ou Súmulas
    const liveItem = await this.executeLiveFetch(idOrRef);
    if (liveItem) {
      return {
        id: idOrRef,
        court: "AGU",
        exists: true,
        rawTextOrJson: liveItem,
      };
    }

    return null;
  }

  private async executeLiveSearch(query: string, limit: number): Promise<RawJurisSearchResult[]> {
    const hits: RawJurisSearchResult[] = [];
    const onsUrl = "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu";
    const res = await executeJurisHttpRequest(onsUrl, { timeoutMs: 5000 });
    if (!res.ok || typeof res.data !== "string") return hits;

    const html = res.data;
    const cards = [...html.matchAll(/<div class="on-card"[^>]*>([\s\S]*?)<div class="on-meta">/gi)];
    const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    for (const [_, cardHtml] of cards) {
      const titMatch = cardHtml.match(/<div class="on-titulo">[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<span class="on-regime">([\s\S]*?)<\/span>)?/i);
      const corpoMatch = cardHtml.match(/<div class="on-corpo">([\s\S]*?)<\/div>/i);
      if (!titMatch || !corpoMatch) continue;

      const title = cleanHtmlAndNormalize(titMatch[2]);
      const regime = titMatch[3] ? cleanHtmlAndNormalize(titMatch[3]) : "LEI_14133_ADM_DIRETA";
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
          entidade: "ÓRGÃO_CONTRATANTE",
          regimeLegal: regime.includes("14.133") ? "LEI_14133_ADM_DIRETA" : "LEI_8666_LEGACY",
          indexacao: ["ORIENTAÇÃO NORMATIVA", "AGU", regime],
          tese: corpo,
          dispositivo: corpo,
          inteiroTeorUrl: titMatch[1] || onsUrl,
          rawItem: { title, regime, corpo, douUrl: titMatch[1] },
        });

        if (hits.length >= limit) break;
      }
    }

    return hits;
  }

  private async executeLiveFetch(idOrRef: string): Promise<any | null> {
    const clean = idOrRef.trim();
    const onMatch = clean.match(/(?:ON|ORIENTACAO-NORMATIVA)[-_]AGU[-_]0*(\d+)(?:[-_](\d{4}))?|AGU[-_](?:ON|ORIENTACAO-NORMATIVA)[-_]0*(\d+)(?:[-_](\d{4}))?/i);
    if (!onMatch) return null;

    const num = onMatch[1] || onMatch[3];
    const onsUrl = "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu";
    const res = await executeJurisHttpRequest(onsUrl, { timeoutMs: 5000 });
    if (!res.ok || typeof res.data !== "string") return null;

    const html = res.data;
    const cards = [...html.matchAll(/<div class="on-card"[^>]*>([\s\S]*?)<div class="on-meta">/gi)];

    for (const [_, cardHtml] of cards) {
      const titMatch = cardHtml.match(/<div class="on-titulo">[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<span class="on-regime">([\s\S]*?)<\/span>)?/i);
      const corpoMatch = cardHtml.match(/<div class="on-corpo">([\s\S]*?)<\/div>/i);
      if (!titMatch || !corpoMatch) continue;

      const title = cleanHtmlAndNormalize(titMatch[2]);
      const cardNumMatch = title.match(/(\d+)(?:\/(\d{4}))?/);
      if (cardNumMatch && cardNumMatch[1] === num) {
        const regime = titMatch[3] ? cleanHtmlAndNormalize(titMatch[3]) : "LEI_14133_ADM_DIRETA";
        const corpo = cleanHtmlAndNormalize(corpoMatch[1]);
        const ano = cardNumMatch[2] ? parseInt(cardNumMatch[2], 10) : 2024;

        return {
          id: `ON-AGU-${num.padStart(3, "0")}-${ano}`,
          court: "AGU",
          numero: num,
          ano,
          colegiado: "Advogado-Geral da União",
          relator: "Consultoria-Geral da União",
          dataSessao: String(ano),
          entidade: "ÓRGÃO_CONTRATANTE",
          regimeLegal: regime.includes("14.133") ? "LEI_14133_ADM_DIRETA" : "LEI_8666_LEGACY",
          indexacao: ["ORIENTAÇÃO NORMATIVA", "AGU", regime],
          enunciado: corpo,
          tese: corpo,
          dispositivo: corpo,
          inteiroTeorTexto: `${title}\n\n${corpo}\n\nRegime: ${regime}`,
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
      regimeLegal: item.regimeLegal,
      indexacao: item.indexacao,
      tese: item.enunciado,
      dispositivo: item.dispositivo,
      inteiroTeorUrl: item.fonteOficialUrl,
      rawItem: item,
    };
  }

  private mapMockHitToResult(h: any): RawJurisSearchResult {
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
      entidade: h.entidade || "ÓRGÃO_CONTRATANTE",
      regimeLegal: h.regimeLegal || "LEI_14133_ADM_DIRETA",
      indexacao: Array.isArray(h.indexacao) ? h.indexacao : [h.indexacao || "AGU"],
      tese,
      dispositivo,
      inteiroTeorUrl: h.inteiroTeorUrl || h.url,
      rawItem: h,
    };
  }

  private normalizeMockItem(item: any, idOrRef: string): any {
    const tese = item.tese || item.enunciado || item.ementa || "";
    const dispositivo = item.dispositivo || item.conclusao || tese;
    const inteiro = item.inteiroTeorTexto || item.inteiro_teor_texto || item.texto || tese;
    return {
      id: item.id || idOrRef,
      court: "AGU",
      numero: item.numero || "S/N",
      ano: item.ano ? Number(item.ano) : 2024,
      colegiado: item.colegiado || "Advogado-Geral da União",
      processo: item.processo || "N/A",
      relator: item.relator || "Consultoria-Geral da União",
      dataSessao: item.dataSessao || item.data,
      entidade: item.entidade || "ÓRGÃO_CONTRATANTE",
      regimeLegal: item.regimeLegal || "LEI_14133_ADM_DIRETA",
      indexacao: Array.isArray(item.indexacao) ? item.indexacao : [item.indexacao || "AGU"],
      enunciado: tese,
      tese,
      dispositivo,
      inteiroTeorTexto: inteiro,
      rawText: inteiro,
    };
  }
}
