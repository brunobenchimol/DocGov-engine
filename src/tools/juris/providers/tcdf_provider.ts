// ============================================================================
// Conector TCDF (Tribunal de Contas do Distrito Federal)
// Integração via API REST Busca Pública (api-busca-publica.tc.df.gov.br)
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

export class TcdfProvider implements JurisdictionProvider {
  public readonly courtId = "TCDF";
  public readonly tier = "STATE" as const;
  public readonly uf = "DF";
  public readonly envOverrideKey = "DOCGOV_TCDF_BASE_URL";
  public readonly liveSmokeQuery = "licitação";
  public readonly idPatterns = [/\bTCDF\b/i];

  private getBaseUrl(): string {
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    return (
      process.env.DOCGOV_TCDF_BASE_URL || "https://api-busca-publica.tc.df.gov.br"
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
        const url = `${baseUrl}/search?court=TCDF&q=${encodeURIComponent(query)}&limit=${limit}`;
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

      // Conexão real contra a API Busca Pública do TCDF
      // Nota: o servidor do TCDF possui certificado intermediário ausente na cadeia padrão,
      // logo usamos executeLegacyHttp1Request com rejectUnauthorized: false resiliente.
      const { cleanQuery } = sanitizeQueryForCourt(query);
      const cleanQ = cleanQuery || query;
      const url = `${baseUrl}/jurisprudencia/?q=${encodeURIComponent(
        cleanQ
      )}&from=0&maxPerPage=${limit}`;

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

      const json = JSON.parse(response.body);
      const hitsArray = Array.isArray(json?.data?.data?.hits?.hits)
        ? json.data.data.hits.hits
        : [];
      const mapped = hitsArray.map((h: any) => this.mapTcdfSource(h._source || h));

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
      const url = `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=TCDF`;
      try {
        const resp = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        const item = Array.isArray(data) ? data[0] : data;
        if (!item) return null;
        return { id: idOrRef, court: "TCDF", exists: true, rawTextOrJson: item };
      } catch {
        return null;
      }
    }

    try {
      const parsedRef = parseCanonicalAcordaoRef(idOrRef);
      const searchQuery = parsedRef
        ? `documento_numero:"${parsedRef.numero}" AND documento_ano:${parsedRef.ano}`
        : idOrRef;

      const searchRes = await this.search(searchQuery, { limit: 5 });
      if (searchRes.length > 0) {
        if (parsedRef) {
          const exact = searchRes.find(
            (r) => r.numero === parsedRef.numero && r.ano === parsedRef.ano
          );
          if (exact) {
            return {
              id: idOrRef,
              court: "TCDF",
              exists: true,
              rawTextOrJson: exact.rawPayload || exact,
            };
          }
        }
        return {
          id: idOrRef,
          court: "TCDF",
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
      id: hit.id || `TCDF-${hit.numero || "SN"}-${hit.ano || 2024}`,
      court: "TCDF",
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

  private mapTcdfSource(src: any): RawJurisSearchResult {
    const numero = String(src.documento_numero || "S/N");
    const ano = Number(src.documento_ano || 2024);
    const id = `TCDF-Decisão-${numero}-${ano}`;
    const tese =
      src.jurisprudencia_ementa ||
      src.jurisprudencia_excerto ||
      src.jurisprudencia_ementa_voto ||
      "";
    const dispositivo = src.jurisprudencia_decisao || tese;

    return {
      id,
      court: "TCDF",
      colegiado: src.sessao_tipo || "Plenário",
      numero,
      ano,
      processo: src.processo_numero_completo || src.processo_numero,
      relator: src.processo_relator || "Conselheiro Relator",
      dataSessao: src.sessao_data,
      entidade: "DISTRITO_FEDERAL",
      indexacao: src.jurisprudencia_assunto || src.jurisprudencia_tipo_descricao,
      tese,
      dispositivo,
      rawPayload: src,
    };
  }
}
