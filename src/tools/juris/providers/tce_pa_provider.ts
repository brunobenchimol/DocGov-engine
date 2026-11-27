// ============================================================================
// Conector TCE-PA (Tribunal de Contas do Estado do Pará)
// docgov-engine v1.7.6 — providers/tce_pa_provider.ts (Corte Limpo, Cache TTL 24h)
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

  protected getDefaultBaseUrl(): string {
    return "https://www.tcepa.tc.br";
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
    const rawAno = hit.ano !== undefined && hit.ano !== null ? Number(hit.ano) : undefined;
    const ano = rawAno !== undefined && Number.isFinite(rawAno) ? rawAno : undefined;
    return {
      id: hit.id || `TCE-PA-${hit.numero || "SN"}${ano !== undefined ? `-${ano}` : ""}`,
      court: "TCE-PA",
      colegiado: hit.colegiado || "Plenário",
      numero: String(hit.numero || "S/N"),
      ...(ano !== undefined ? { ano } : {}),
      processo: hit.processo,
      relator: hit.relator || "Conselheiro Relator",
      dataSessao: hit.dataSessao || hit.data,
      entidade: hit.entidade || hit.orgao || "NAO_INFORMADA",
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
      const ano = numMatch && numMatch[2] ? Number(numMatch[2]) : undefined;
      const id = `TCE-PA-${numero}${ano !== undefined ? `-${ano}` : ""}`;

      results.push({
        id,
        court: "TCE-PA",
        colegiado: "Plenário",
        numero,
        ...(ano !== undefined ? { ano } : {}),
        processo: fullUrl,
        relator: "Conselheiro Relator",
        entidade: "NAO_INFORMADA",
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
