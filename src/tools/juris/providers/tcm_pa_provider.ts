// ============================================================================
// Conector Oficial do Tribunal de Contas dos Municípios do Estado do Pará (TCM-PA)
// docgov-engine v1.7.6 — providers/tcm_pa_provider.ts (Corte Limpo, Cache TTL 24h)
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
import { normalizeTcmPaId } from "./tcm_pa_catalog.ts";

export class TcmPaProvider extends BaseJurisdictionProvider {
  public readonly courtId = "TCM-PA";
  public readonly tier = "MUNICIPAL" as const;
  public readonly uf = "PA";
  public readonly defaultFederal = false;
  public readonly envOverrideKey = "DOCGOV_JURIS_TCM_PA_URL";
  protected override readonly mockEnvKeys = [
    "DOCGOV_JURIS_TCM_PA_URL",
    "DOCGOV_JURIS_TCMPA_URL",
    "DOCGOV_TCM_PA_BASE_URL",
  ];
  protected override readonly baseUrlEnvKeys = [
    "DOCGOV_JURIS_TCM_PA_URL",
    "DOCGOV_JURIS_TCMPA_URL",
    "DOCGOV_TCM_PA_BASE_URL",
  ];
  protected override readonly mockFetchStyle = "query" as const;
  protected override readonly notFoundStyle = "exists_false" as const;
  protected override readonly defaultLiveTimeoutMs = 3500;
  protected override readonly defaultFetchTimeoutMs = 4500;

  public readonly liveSmokeQuery = "lote unico software | licitacao";

  public readonly idPatterns = [
    /\b(?:TCM[-_]?PA|TCMPA)[-_](?:ACORDAO|AC|RESOLUCAO|IN|CONSULTA|SUMULA|DECISAO|PROC|WP)[-_][\w/.-]+\b/i,
    /\b(?:ACORDAO|RESOLUCAO|IN|CONSULTA|SUMULA)[-_]?(?:TCM[-_]?PA|TCMPA)[-_][\w/.-]+\b/i,
    /\b(?:AC[OÓ]RD[AÃ]O|RESOLU[CÇ][AÃ]O|INSTRU[CÇ][AÃ]O\s+NORMATIVA|CONSULTA|S[UÚ]MULA)[-_ ]*(?:N[Oº°]?\s*)?[\d.]+(?:\/\d{2,4})?\s*[- ]*(?:DO\s*)?(?:TCM[-_]?PA|TCMPA)(?:[-_ ]*PLENO)?\b/i,
    /\bTCM[-_]?PA[-_]\d{1,7}\b/i,
    /\bTCM[-_]?PA\b/i,
    /\bTCMPA\b/i,
  ];

  protected getDefaultBaseUrl(): string {
    return "https://www.tcmpa.tc.br";
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const { cleanQuery, shortQuery } = sanitizeQueryForCourt(query);
    const queryTerm = (shortQuery || cleanQuery || query).slice(0, 60);
    const postsUrl = `${baseUrl}/wp-json/wp/v2/posts?search=${encodeURIComponent(
      queryTerm
    )}&per_page=${limit}&_fields=id,date,link,title,excerpt,content`;

    const res = await this.executeHttp(postsUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      timeoutMs: ctx.timeoutMs,
    });
    this.assertHttpOk(res);

    if (Array.isArray(res.data) && res.data.length > 0) {
      return res.data.map((p: any) => this.mapWpPostToResult(p));
    }

    const searchUrl = `${baseUrl}/wp-json/wp/v2/search?search=${encodeURIComponent(
      queryTerm
    )}&per_page=${limit}`;
    const resSearch = await this.executeHttp(searchUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      timeoutMs: ctx.timeoutMs,
    });
    this.assertHttpOk(resSearch);

    if (Array.isArray(resSearch.data) && resSearch.data.length > 0) {
      return resSearch.data.map((s: any) => this.mapWpSearchItemToResult(s));
    }
    return [];
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    const normalized = normalizeTcmPaId(idOrRef);
    const wpMatch = normalized.match(/^TCM-PA-(?:WP|DECISAO)-(\d+)(?:-(\d{4}))?$/i);
    if (!wpMatch) return null;

    const wpId = wpMatch[1];
    const baseUrl = this.getBaseUrl();
    const liveUrl = `${baseUrl}/wp-json/wp/v2/posts/${wpId}?_fields=id,date,link,title,excerpt,content`;
    const res = await this.executeHttp(liveUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      timeoutMs: ctx.timeoutMs,
    });
    if (res.status === 404) return null;
    this.assertHttpOk(res);

    if (res.data && res.data.id) {
      const title = cleanHtmlAndNormalize(
        res.data.title?.rendered || `Deliberação TCM-PA ${wpId}`
      );
      const content = cleanHtmlAndNormalize(
        res.data.content?.rendered || res.data.excerpt?.rendered || title
      );
      const rawAno = res.data.date ? Number(String(res.data.date).slice(0, 4)) : undefined;
      const ano = rawAno !== undefined && Number.isFinite(rawAno) ? rawAno : undefined;
      const dataSessao = res.data.date ? String(res.data.date).slice(0, 10) : undefined;

      return {
        id: `TCM-PA-DECISAO-${res.data.id}${ano !== undefined ? `-${ano}` : ""}`,
        court: "TCM-PA",
        exists: true,
        source: "LIVE",
        rawTextOrJson: {
          tribunal: "TCM-PA",
          colegiado: "Tribunal Pleno",
          numero: String(res.data.id),
          ...(ano !== undefined ? { ano } : {}),
          processo: `WP-${res.data.id}`,
          relator: "Tribunal Pleno",
          ...(dataSessao ? { dataSessao } : {}),
          entidade: "NAO_INFORMADA",
          indexacao: ["JURISPRUDÊNCIA TCM-PA", "PORTAL OFICIAL"],
          enunciado: title,
          tese: title,
          relatorio: content.slice(0, 900),
          voto: content.slice(0, 1400),
          dispositivo: content.slice(0, 400),
          fonteOficialUrl: res.data.link || `${baseUrl}/`,
          inteiroTeorTexto: `${title}\n\n${content}`,
        },
      };
    }
    return null;
  }

  private mapWpPostToResult(post: any): RawJurisSearchResult {
    const title = cleanHtmlAndNormalize(post.title?.rendered || "");
    const excerpt = cleanHtmlAndNormalize(
      post.excerpt?.rendered || post.content?.rendered || ""
    );
    const rawAno = post.date ? Number(String(post.date).slice(0, 4)) : undefined;
    const ano = rawAno !== undefined && Number.isFinite(rawAno) ? rawAno : undefined;
    const dataSessao = post.date ? String(post.date).slice(0, 10) : undefined;

    return {
      id: `TCM-PA-DECISAO-${post.id}${ano !== undefined ? `-${ano}` : ""}`,
      court: "TCM-PA",
      colegiado: "Tribunal Pleno",
      numero: String(post.id),
      ...(ano !== undefined ? { ano } : {}),
      processo: `WP-${post.id}`,
      relator: "Tribunal Pleno",
      ...(dataSessao ? { dataSessao } : {}),
      entidade: "NAO_INFORMADA",
      indexacao: "TCM-PA; PORTAL OFICIAL",
      tese: title || excerpt.slice(0, 220),
      dispositivo: excerpt.slice(0, 220) || title,
      rawPayload: post,
    };
  }

  private mapWpSearchItemToResult(item: any): RawJurisSearchResult {
    const title = cleanHtmlAndNormalize(item.title || "");
    const yearMatch = title.match(/\b((?:19|20)\d{2})\b/);
    const ano = yearMatch ? Number(yearMatch[1]) : undefined;

    return {
      id: `TCM-PA-ATO-${item.id}${ano !== undefined ? `-${ano}` : ""}`,
      court: "TCM-PA",
      colegiado: "Tribunal Pleno",
      numero: String(item.id),
      ...(ano !== undefined ? { ano } : {}),
      entidade: "NAO_INFORMADA",
      indexacao: `TCM-PA; ${String(item.subtype || "ATO_OFICIAL").toUpperCase()}`,
      tese: title,
      dispositivo: title,
      rawPayload: item,
    };
  }

  protected mapMockHitToResult(hit: any): RawJurisSearchResult {
    const rawAno = hit.ano !== undefined && hit.ano !== null ? Number(hit.ano) : undefined;
    const ano = rawAno !== undefined && Number.isFinite(rawAno) ? rawAno : undefined;
    return {
      id: hit.id || `TCM-PA-${hit.numero || "DECISAO"}`,
      court: "TCM-PA",
      colegiado: hit.colegiado || "Tribunal Pleno",
      numero: hit.numero ? String(hit.numero) : undefined,
      ...(ano !== undefined ? { ano } : {}),
      processo: hit.processo,
      relator: hit.relator || "Conselheiro Relator",
      dataSessao: hit.dataSessao || hit.data,
      entidade: hit.entidade || "NAO_INFORMADA",
      indexacao: Array.isArray(hit.indexacao) ? hit.indexacao.join("; ") : hit.indexacao,
      tese: hit.tese || hit.enunciado || hit.sumario,
      dispositivo: hit.dispositivo,
      rawPayload: hit,
    };
  }
}
