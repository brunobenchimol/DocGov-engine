// ============================================================================
// Conector Oficial da Advocacia-Geral da União e CGU (AGU Provider)
// docgov-engine v1.7.6 — providers/agu_provider.ts (Corte Limpo, Cache TTL 24h)
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
    /\bAGU[-_]PARECER[-_][\w-]+\b/i,
    /\bAGU\b/i,
  ];

  protected getDefaultBaseUrl(): string {
    return "https://www.gov.br/agu/pt-br/composicao/cgu/cgu";
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
        : "NAO_IDENTIFICADO";
      const corpo = cleanHtmlAndNormalize(corpoMatch[1]);
      const searchable = `${title} ${regime} ${corpo}`.toLowerCase();

      let matchCount = 0;
      for (const t of tokens) {
        if (searchable.includes(t)) matchCount++;
      }

      if (tokens.length === 0 || matchCount > 0) {
        const numMatch = title.match(/(\d+)(?:\/(\d{4}))?/);
        const numero = numMatch ? numMatch[1] : "S/N";
        const ano = numMatch && numMatch[2] ? parseInt(numMatch[2], 10) : undefined;
        const canonicalId =
          ano !== undefined
            ? `ON-AGU-${numero.padStart(3, "0")}-${ano}`
            : `ON-AGU-${numero.padStart(3, "0")}`;

        hits.push({
          id: canonicalId,
          court: "AGU",
          colegiado: "Advogado-Geral da União",
          numero,
          ...(ano !== undefined ? { ano, dataSessao: String(ano) } : {}),
          relator: "Consultoria-Geral da União",
          entidade: "NAO_INFORMADA",
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
          : "NAO_IDENTIFICADO";
        const corpo = cleanHtmlAndNormalize(corpoMatch[1]);
        const ano = cardNumMatch[2] ? parseInt(cardNumMatch[2], 10) : undefined;

        return {
          id: idOrRef,
          court: "AGU",
          exists: true,
          source: "LIVE",
          rawTextOrJson: {
            id:
              ano !== undefined
                ? `ON-AGU-${num.padStart(3, "0")}-${ano}`
                : `ON-AGU-${num.padStart(3, "0")}`,
            court: "AGU",
            numero: num,
            ...(ano !== undefined ? { ano, dataSessao: String(ano) } : {}),
            colegiado: "Advogado-Geral da União",
            relator: "Consultoria-Geral da União",
            entidade: "NAO_INFORMADA",
            regimeLegal: regime.includes("14.133")
              ? "LEI_14133_ADM_DIRETA"
              : "NAO_IDENTIFICADO",
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

  protected mapMockHitToResult(h: any): RawJurisSearchResult {
    const tese = h.tese || h.enunciado || h.ementa || "";
    const dispositivo = h.dispositivo || h.conclusao || tese;
    const rawAno = h.ano !== undefined && h.ano !== null ? Number(h.ano) : undefined;
    const ano = rawAno !== undefined && Number.isFinite(rawAno) ? rawAno : undefined;
    const dataSessao = h.dataSessao || h.data || (ano !== undefined ? String(ano) : undefined);

    return {
      id:
        h.id ||
        `ON-AGU-${h.numero || "S/N"}${ano !== undefined ? `-${ano}` : ""}`,
      court: "AGU",
      colegiado: h.colegiado || "Advogado-Geral da União",
      numero: String(h.numero || "S/N"),
      ...(ano !== undefined ? { ano } : {}),
      processo: h.processo || "N/A",
      relator: h.relator || "Consultoria-Geral da União",
      ...(dataSessao !== undefined ? { dataSessao } : {}),
      entidade: h.entidade || "NAO_INFORMADA",
      indexacao: Array.isArray(h.indexacao)
        ? h.indexacao.join("; ")
        : h.indexacao || "AGU",
      tese,
      dispositivo,
      rawPayload: h,
    };
  }
}
