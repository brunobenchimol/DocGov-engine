// ============================================================================
// Conector TCE-PA (Tribunal de Contas do Estado do Pará)
// Integração via HTTP/1.1 Resiliente (insecureHTTPParser) com Fallback Mock
// ============================================================================

import type {
  JurisdictionProvider,
  RawJurisSearchResult,
  RawJurisFetchResult,
  SearchJurisOptions,
  CourtDiagnostic,
} from "../types.ts";
import {
  executeLegacyHttp1Request,
  sanitizeQueryForCourt,
  parseCanonicalAcordaoRef,
} from "./http_client.ts";

export class TcePaProvider implements JurisdictionProvider {
  public readonly courtId = "TCE-PA";
  public readonly tier = "STATE" as const;
  public readonly uf = "PA";
  public readonly envOverrideKey = "DOCGOV_TCE_PA_BASE_URL";
  public readonly liveSmokeQuery = "licitação";
  public readonly idPatterns = [/\bTCE[-_\s]?PA\b/i];

  private getBaseUrl(): string {
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    return (
      process.env.DOCGOV_TCE_PA_BASE_URL || "https://www.tcepa.tc.br"
    ).replace(/\/+$/, "");
  }

  public async search(
    query: string,
    options?: Partial<SearchJurisOptions>
  ): Promise<RawJurisSearchResult[]> {
    const res = await this.searchWithDiagnostic(query, options);
    return res.hits;
  }

  public async searchWithDiagnostic(
    query: string,
    options?: Partial<SearchJurisOptions>
  ): Promise<{ hits: RawJurisSearchResult[]; diagnostic: CourtDiagnostic }> {
    const startTime = Date.now();
    const baseUrl = this.getBaseUrl();
    const limit = options?.limit || 10;
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    try {
      if (isMock) {
        const url = `${baseUrl}/search?court=TCE-PA&q=${encodeURIComponent(query)}&limit=${limit}`;
        const resp = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
        });
        if (!resp.ok) {
          return {
            hits: [],
            diagnostic: {
              court: this.courtId,
              status: "error",
              hits: 0,
              latency_ms: Date.now() - startTime,
              error: `HTTP ${resp.status}`,
            },
          };
        }
        const data = await resp.json();
        const hits = Array.isArray(data)
          ? data
          : Array.isArray(data.items)
          ? data.items
          : [];
        const mapped = this.mapMockHits(hits);
        return {
          hits: mapped,
          diagnostic: {
            court: this.courtId,
            status: "ok",
            hits: mapped.length,
            latency_ms: Date.now() - startTime,
            error: null,
          },
        };
      }

      // Conexão real contra TCE-PA via HTTP/1.1 legado
      const { cleanQuery, shortQuery } = sanitizeQueryForCourt(query);
      const queryTerm = (shortQuery || cleanQuery || query).slice(0, 50);
      const url = `${baseUrl}/index.php?option=com_search&searchword=${encodeURIComponent(
        queryTerm
      )}&searchphrase=any&ordering=newest&tmpl=component`;

      const response = await executeLegacyHttp1Request(url, {
        timeoutMs: 8000,
        isPlainHttp: url.startsWith("http://"),
      });

      if (response.status !== 200) {
        return {
          hits: [],
          diagnostic: {
            court: this.courtId,
            status: "error",
            hits: 0,
            latency_ms: Date.now() - startTime,
            error: `HTTP ${response.status}`,
          },
        };
      }

      const parsedHits = this.parseHtmlSearchResults(response.body, limit);
      return {
        hits: parsedHits,
        diagnostic: {
          court: this.courtId,
          status: "ok",
          hits: parsedHits.length,
          latency_ms: Date.now() - startTime,
          error: null,
        },
      };
    } catch (err: any) {
      return {
        hits: [],
        diagnostic: {
          court: this.courtId,
          status: "error",
          hits: 0,
          latency_ms: Date.now() - startTime,
          error: err?.message || String(err),
        },
      };
    }
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    if (isMock) {
      const url = `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=TCE-PA`;
      try {
        const resp = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        const item = Array.isArray(data) ? data[0] : data;
        if (!item) return null;
        return { id: idOrRef, court: "TCE-PA", exists: true, rawTextOrJson: item };
      } catch {
        return null;
      }
    }

    try {
      // Se for uma URL direta
      if (idOrRef.startsWith("http://") || idOrRef.startsWith("https://")) {
        const response = await executeLegacyHttp1Request(idOrRef, {
          timeoutMs: 8000,
          isPlainHttp: idOrRef.startsWith("http://"),
        });
        if (response.status !== 200) return null;
        const cleanText = this.stripHtml(response.body);
        return {
          id: idOrRef,
          court: "TCE-PA",
          exists: true,
          rawTextOrJson: { url: idOrRef, text: cleanText, html: response.body },
        };
      }

      // Resolução autônoma via busca
      const parsedRef = parseCanonicalAcordaoRef(idOrRef);
      const searchQuery = parsedRef
        ? `Acórdão ${parsedRef.numero}`
        : idOrRef;
      const searchRes = await this.search(searchQuery, { limit: 3 });
      if (searchRes.length > 0 && searchRes[0].processo && searchRes[0].processo.startsWith("http")) {
        return await this.fetch(searchRes[0].processo);
      }

      if (searchRes.length > 0) {
        return {
          id: idOrRef,
          court: "TCE-PA",
          exists: true,
          rawTextOrJson: searchRes[0].rawPayload || searchRes[0],
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  private mapMockHits(hits: any[]): RawJurisSearchResult[] {
    return hits.map((hit: any) => ({
      id: hit.id || `TCE-PA-${hit.numero || "SN"}-${hit.ano || 2024}`,
      court: "TCE-PA",
      colegiado: hit.colegiado || "Plenário",
      numero: String(hit.numero || "S/N"),
      ano: Number(hit.ano || 2024),
      processo: hit.processo,
      relator: hit.relator || "Conselheiro Relator",
      dataSessao: hit.dataSessao || hit.data,
      entidade: hit.entidade || hit.orgao,
      indexacao: hit.indexacao,
      tese: hit.tese || hit.ementa,
      dispositivo: hit.dispositivo,
      rawPayload: hit,
    }));
  }

  private parseHtmlSearchResults(html: string, limit: number): RawJurisSearchResult[] {
    const results: RawJurisSearchResult[] = [];
    const dtRegex = /<dt class="result-title">\s*(?:\d+\.\s*)?<a\s+href="([^"]+)">([\s\S]*?)<\/a>\s*<\/dt>(?:[\s\S]*?<dd class="result-text">([\s\S]*?)<\/dd>)?/gi;

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
