// ============================================================================
// Conector TCE-PA (Tribunal de Contas do Estado do Pará)
// docgov-engine — providers/tce_pa_provider.ts (extends BaseJurisdictionProvider)
// Integração via HTTP/1.1 Resiliente (insecureHTTPParser) com Catálogo Curado
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
import {
  executeLegacyHttp1Request,
  parseCanonicalAcordaoRef,
  sanitizeQueryForCourt,
} from "./http_client.ts";
import {
  getTcePaCatalogItemById,
  mapTcePaCatalogItemToFetch,
  searchTcePaCatalog,
} from "./tce_pa_catalog.ts";

export class TcePaProvider extends BaseJurisdictionProvider {
  public readonly courtId = "TCE-PA";
  public readonly tier = "STATE" as const;
  public readonly uf = "PA";
  public readonly envOverrideKey = "DOCGOV_TCE_PA_BASE_URL";
  protected override readonly mockEnvKeys = ["DOCGOV_JURIS_TCE_PA_URL"];
  protected override readonly baseUrlEnvKeys = ["DOCGOV_TCE_PA_BASE_URL"];
  protected override readonly mockFetchStyle = "path" as const;
  protected override readonly notFoundStyle = "null" as const;
  protected override readonly defaultLiveTimeoutMs = 6000;
  protected override readonly defaultFetchTimeoutMs = 7000;

  public readonly liveSmokeQuery = "licitação";
  public readonly idPatterns = [/\bTCE[-_\s]?PA\b/i, /\bTCEPA\b/i];
  // Auto-trigger estrito exclusivo do TCE-PA (sem 'pará' ou 'pa' isolados para evitar colisão com TCM-PA)
  public readonly autoTriggerKeywords =
    /\b(tce[- ]pa|tce\/pa|tcepa|tribunal\s+de\s+contas\s+do\s+estado\s+do\s+par[aá]|tribunal\s+de\s+contas\s+do\s+par[aá])\b/i;

  protected getDefaultBaseUrl(): string {
    return "https://www.tcepa.tc.br";
  }

  protected override searchCatalog(query: string, limit: number): RawJurisSearchResult[] {
    return searchTcePaCatalog(query, limit);
  }

  protected override shouldShortCircuitCatalog(query: string): boolean {
    return (
      /\bresolu[çc][aã]o\s*(?:n[º°o]\s*)?19\.?669\b/i.test(query) ||
      /\bprejulgado\s*(?:n[º°o]\s*)?21\b/i.test(query)
    );
  }

  protected override findCatalogItemById(idOrRef: string): RawJurisFetchResult | null {
    const entry = getTcePaCatalogItemById(idOrRef);
    return entry ? mapTcePaCatalogItemToFetch(entry) : null;
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const { cleanQuery, shortQuery } = sanitizeQueryForCourt(query);
    const queryTerm = (shortQuery || cleanQuery || query).slice(0, 50);
    const url = `${baseUrl}/index.php?option=com_search&searchword=${encodeURIComponent(
      queryTerm
    )}&searchphrase=any&ordering=newest&tmpl=component`;

    const response = await executeLegacyHttp1Request(url, {
      timeoutMs: ctx.timeoutMs,
      isPlainHttp: url.startsWith("http://"),
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    return this.parseHtmlSearchResults(response.body, limit);
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    if (idOrRef.startsWith("http://") || idOrRef.startsWith("https://")) {
      const response = await executeLegacyHttp1Request(idOrRef, {
        timeoutMs: ctx.timeoutMs,
        isPlainHttp: idOrRef.startsWith("http://"),
      });
      if (response.status === 404) return null;
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`);
      }
      const cleanText = this.stripHtml(response.body);
      return {
        id: idOrRef,
        court: "TCE-PA",
        exists: true,
        source: "LIVE",
        rawTextOrJson: { url: idOrRef, text: cleanText, html: response.body },
      };
    }

    const parsedRef = parseCanonicalAcordaoRef(idOrRef);
    const searchQuery = parsedRef ? `Acórdão ${parsedRef.numero}` : idOrRef;
    const searchRes = await this.executeLiveSearch(searchQuery, 3, {
      timeoutMs: ctx.timeoutMs,
    });

    if (
      searchRes.length > 0 &&
      searchRes[0].processo &&
      searchRes[0].processo.startsWith("http")
    ) {
      return await this.executeLiveFetch(searchRes[0].processo, ctx);
    }

    if (searchRes.length > 0) {
      return {
        id: idOrRef,
        court: "TCE-PA",
        exists: true,
        source: "LIVE",
        rawTextOrJson: searchRes[0].rawPayload || searchRes[0],
      };
    }

    return null;
  }

  protected mapMockHitToResult(hit: any): RawJurisSearchResult {
    return {
      id: hit.id || `TCE-PA-${hit.numero || "SN"}-${hit.ano || 2024}`,
      court: "TCE-PA",
      colegiado: hit.colegiado || "Plenário",
      numero: String(hit.numero || "S/N"),
      ano: Number(hit.ano || 2024),
      processo: hit.processo,
      relator: hit.relator || "Conselheiro Relator",
      dataSessao: hit.dataSessao || hit.data,
      entidade: hit.entidade || hit.orgao || "ORGAO_CONTRATANTE",
      indexacao: hit.indexacao,
      tese: hit.tese || hit.ementa,
      dispositivo: hit.dispositivo,
      rawPayload: hit,
    };
  }

  private parseHtmlSearchResults(html: string, limit: number): RawJurisSearchResult[] {
    const results: RawJurisSearchResult[] = [];
    const dtRegex =
      /<dt class="result-title">\s*(?:\d+\.\s*)?<a\s+href="([^"]+)">([\s\S]*?)<\/a>\s*<\/dt>(?:[\s\S]*?<dd class="result-text">([\s\S]*?)<\/dd>)?/gi;

    let match;
    let idx = 0;
    while ((match = dtRegex.exec(html)) !== null && results.length < limit) {
      idx++;
      const href = match[1].trim();
      const rawTitle = this.stripHtml(match[2]).trim();
      const rawSnippet = match[3] ? this.stripHtml(match[3]).trim() : "";

      const fullUrl = href.startsWith("http")
        ? href
        : `https://www.tcepa.tc.br${href.startsWith("/") ? "" : "/"}${href}`;

      const numMatch = rawTitle.match(/acórdão\s*(?:n[º°]?\s*)?(\d+)(?:\/(\d{4}))?/i);
      const numero = numMatch ? numMatch[1] : String(idx);
      const ano = numMatch && numMatch[2] ? Number(numMatch[2]) : 2024;
      const id = `TCE-PA-${numero}-${ano}`;

      results.push({
        id,
        court: "TCE-PA",
        colegiado: "Plenário",
        numero,
        ano,
        processo: fullUrl,
        relator: "Conselheiro Relator",
        entidade: "ESTADO_DO_PARA",
        indexacao: rawTitle,
        tese: rawSnippet || rawTitle,
        dispositivo: rawTitle,
        rawPayload: { url: fullUrl, title: rawTitle, snippet: rawSnippet },
      });
    }

    return results;
  }

  private stripHtml(str: string): string {
    return str
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }
}
