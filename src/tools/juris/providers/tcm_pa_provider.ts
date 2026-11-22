// ============================================================================
// Conector Oficial do Tribunal de Contas dos Municípios do Estado do Pará (TCM-PA)
// docgov-engine — providers/tcm_pa_provider.ts (extends BaseJurisdictionProvider)
// 1º Conector Municipal da Onda 3 — Live Primary (WP REST JSON) + Curated Fallback
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
  getTcmPaCatalogItemById,
  searchTcmPaCatalog,
  normalizeTcmPaId,
  type TcmPaNormativeItem,
} from "./tcm_pa_catalog.ts";

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

  public readonly autoTriggerKeywords =
    /\b(tcm[- ]pa|tcm\/pa|tcmpa|tribunal\s+de\s+contas\s+dos\s+munic[íi]pios\s+do\s+estado\s+do\s+par[aá]|tribunal\s+de\s+contas\s+dos\s+munic[íi]pios\s+do\s+par[aá]|mural\s+de\s+licita[çc][õo]es\s+do\s+tcm[- ]?pa|geo[- ]?obras\s+tcm[- ]?pa|e[- ]?contas\s+analisador\s+tcm[- ]?pa|s[úu]mula(?:s)?\s*(?:n[º°o]\s*)?\d{1,3}\s*(?:do\s*)?(?:tcm[- ]pa|tcmpa)|resolu[çc][ãa]o\s*(?:n[º°o]\s*)?[\d.]+(?:\/\d{2,4})?\s*(?:do\s*)?(?:tcm[- ]pa|tcmpa)|instru[çc][ãa]o\s+normativa\s*(?:n[º°o]\s*)?\d{1,3}(?:\/\d{2,4})?\s*(?:do\s*)?(?:tcm[- ]pa|tcmpa)|ac[óo]rd[ãa]o\s*(?:n[º°o]\s*)?[\d.]+\/\d{2,4}\s*[- ]*(?:tcm[- ]pa|tcmpa))\b/i;

  protected getDefaultBaseUrl(): string {
    return "https://www.tcmpa.tc.br";
  }

  protected override searchCatalog(query: string, limit: number): RawJurisSearchResult[] {
    return searchTcmPaCatalog(query, limit).map((c) => this.mapCatalogItemToResult(c));
  }

  protected override shouldShortCircuitCatalog(query: string): boolean {
    return (
      /\b(?:ac[óo]rd[ãa]o|resolu[çc][ãa]o|consulta|s[úu]mula)\s*(?:n[º°o]\s*)?[\d.]+\b/i.test(query) ||
      /\bTCM[-_]?PA[-_](?:ACORDAO|AC|RESOLUCAO|IN|CONSULTA|SUMULA)[-_][\w.-]+\b/i.test(query)
    );
  }

  protected override findCatalogItemById(idOrRef: string): RawJurisFetchResult | null {
    const catItem = getTcmPaCatalogItemById(idOrRef);
    if (!catItem) return null;
    return {
      id: catItem.id,
      court: "TCM-PA",
      exists: true,
      source: "CURATED_CATALOG",
      rawTextOrJson: {
        tribunal: "TCM-PA",
        colegiado: catItem.colegiado,
        numero: catItem.numero,
        ano: catItem.ano,
        processo: catItem.processo,
        relator: catItem.relator,
        dataSessao: catItem.dataSessao,
        entidade: catItem.entidade,
        regimeLegal: catItem.regimeLegal,
        indexacao: catItem.indexacao,
        enunciado: catItem.enunciado,
        tese: catItem.enunciado,
        relatorio: catItem.relatorio,
        voto: catItem.voto,
        dispositivo: catItem.dispositivo,
        QUORUM: catItem.quorum,
        fonteOficialUrl: catItem.fonteOficialUrl,
        inteiroTeorTexto: catItem.inteiroTeorTexto,
        outcome: this.deriveOutcome(catItem.dispositivo),
      },
    };
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
      const ano = res.data.date
        ? Number(String(res.data.date).slice(0, 4))
        : new Date().getFullYear();
      const dataSessao = res.data.date
        ? String(res.data.date).slice(0, 10)
        : String(ano);

      return {
        id: `TCM-PA-DECISAO-${res.data.id}-${ano}`,
        court: "TCM-PA",
        exists: true,
        source: "LIVE",
        rawTextOrJson: {
          tribunal: "TCM-PA",
          colegiado: "Tribunal Pleno",
          numero: String(res.data.id),
          ano,
          processo: `WP-${res.data.id}`,
          relator: "Tribunal Pleno",
          dataSessao,
          entidade: "ORGAO_CONTRATANTE",
          regimeLegal: /14\.?133/.test(content) ? "LEI_14133_ADM_DIRETA" : "OUTRO",
          indexacao: ["JURISPRUDÊNCIA TCM-PA", "PORTAL OFICIAL"],
          enunciado: title,
          tese: title,
          relatorio: `DOS FATOS: ${content.slice(0, 900)}`,
          voto: `FUNDAMENTAÇÃO: ${content.slice(0, 1400)}`,
          dispositivo: content.slice(0, 400),
          QUORUM: "Tribunal Pleno do TCM-PA",
          fonteOficialUrl: res.data.link || `${baseUrl}/`,
          inteiroTeorTexto: `${title}\n\n${content}`,
          outcome: this.deriveOutcome(content),
        },
      };
    }
    return null;
  }

  private deriveOutcome(text: string): string {
    const lower = (text || "").toLowerCase();
    if (
      lower.includes("improcedente") ||
      lower.includes("regular") ||
      lower.includes("lícita") ||
      lower.includes("licita") ||
      lower.includes("autorizada") ||
      lower.includes("permitida")
    ) {
      return "IMPROCEDENTE_MANUTENCAO_CERTAME";
    }
    if (
      lower.includes("procedente") ||
      lower.includes("anular") ||
      lower.includes("suspende") ||
      lower.includes("cautelar") ||
      lower.includes("irregular") ||
      lower.includes("vedad")
    ) {
      return "PROCEDENTE_ANULACAO_DETERMINACAO";
    }
    return "IMPROCEDENTE_MANUTENCAO_CERTAME";
  }

  private mapCatalogItemToResult(item: TcmPaNormativeItem): RawJurisSearchResult {
    return {
      id: item.id,
      court: "TCM-PA",
      colegiado: item.colegiado,
      numero: item.numero,
      ano: item.ano,
      processo: item.processo,
      relator: item.relator,
      dataSessao: item.dataSessao,
      entidade: item.entidade,
      indexacao: item.indexacao.join("; "),
      tese: item.enunciado,
      dispositivo: item.dispositivo,
    };
  }

  private mapWpPostToResult(post: any): RawJurisSearchResult {
    const title = cleanHtmlAndNormalize(post.title?.rendered || "");
    const excerpt = cleanHtmlAndNormalize(
      post.excerpt?.rendered || post.content?.rendered || ""
    );
    const ano = post.date ? Number(String(post.date).slice(0, 4)) : new Date().getFullYear();
    const dataSessao = post.date ? String(post.date).slice(0, 10) : undefined;
    const isAdverse = /\b(suspend[ea]|anula|irregular|procedente|cautelar)\b/i.test(
      `${title} ${excerpt}`
    );

    return {
      id: `TCM-PA-DECISAO-${post.id}-${ano}`,
      court: "TCM-PA",
      colegiado: "Tribunal Pleno",
      numero: String(post.id),
      ano,
      processo: `WP-${post.id}`,
      relator: "Tribunal Pleno",
      dataSessao,
      entidade: "ORGAO_CONTRATANTE",
      indexacao: "TCM-PA; PORTAL OFICIAL; CONTROLE EXTERNO MUNICIPAL",
      tese: title || excerpt.slice(0, 220),
      dispositivo: isAdverse
        ? "Deliberação com determinação corretiva ou suspensão cautelar."
        : excerpt.slice(0, 220) || title,
      rawPayload: post,
    };
  }

  private mapWpSearchItemToResult(item: any): RawJurisSearchResult {
    const title = cleanHtmlAndNormalize(item.title || "");
    const yearMatch = title.match(/\b(20\d{2})\b/);
    const ano = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

    return {
      id: `TCM-PA-ATO-${item.id}-${ano}`,
      court: "TCM-PA",
      colegiado: "Tribunal Pleno",
      numero: String(item.id),
      ano,
      entidade: "ORGAO_CONTRATANTE",
      indexacao: `TCM-PA; ${String(item.subtype || "ATO_OFICIAL").toUpperCase()}`,
      tese: title,
      dispositivo: `Ato publicado pelo TCM-PA (${item.url || "portal oficial"}).`,
      rawPayload: item,
    };
  }

  protected mapMockHitToResult(hit: any): RawJurisSearchResult {
    return {
      id: hit.id || `TCM-PA-${hit.numero || "DECISAO"}`,
      court: "TCM-PA",
      colegiado: hit.colegiado || "Tribunal Pleno",
      numero: hit.numero ? String(hit.numero) : undefined,
      ano: hit.ano ? Number(hit.ano) : undefined,
      processo: hit.processo,
      relator: hit.relator || "Conselheiro Relator",
      dataSessao: hit.dataSessao || hit.data,
      entidade: hit.entidade || "ORGAO_CONTRATANTE",
      indexacao: Array.isArray(hit.indexacao) ? hit.indexacao.join("; ") : hit.indexacao,
      tese: hit.tese || hit.enunciado || hit.sumario,
      dispositivo: hit.dispositivo,
      rawPayload: hit,
    };
  }
}
