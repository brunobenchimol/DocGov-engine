// ============================================================================
// Conector TCE-CE (Tribunal de Contas do Estado do Ceará)
// Integração via API REST Contexto (contexto-api.tce.ce.gov.br)
// ============================================================================

import type {
  JurisdictionProvider,
  RawJurisSearchResult,
  RawJurisFetchResult,
  SearchJurisOptions,
  CourtDiagnostic,
} from "../types.ts";
import {
  sanitizeQueryForCourt,
  parseCanonicalAcordaoRef,
} from "./http_client.ts";

export class TceCeProvider implements JurisdictionProvider {
  public readonly courtId = "TCE-CE";

  private getBaseUrl(): string {
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    return (
      process.env.DOCGOV_TCE_CE_BASE_URL || "https://contexto-api.tce.ce.gov.br"
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
        const url = `${baseUrl}/search?court=TCE-CE&q=${encodeURIComponent(query)}&limit=${limit}`;
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

      // Conexão real contra a API Contexto do TCE-CE
      const cleanQ = sanitizeQueryForCourt(query, "TCE-CE");
      const url = `${baseUrl}/documentos/buscar-jurisprudencia`;

      const requestBody = {
        filtros: [{ query_string: { query: cleanQ } }],
        searchAfterSort: null,
        buscaPalavraExata: false,
        buscaPesquisaExata: false,
        sort: "desc",
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "DocGov-Engine/1.4.0",
        },
        body: JSON.stringify(requestBody),
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

      const json = await resp.json();
      const rawHits = Array.isArray(json?.data?.lista) ? json.data.lista : [];
      const mapped = rawHits.slice(0, limit).map((hit: any) => this.mapTceCeHit(hit));

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
      const url = `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=TCE-CE`;
      try {
        const resp = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        const item = Array.isArray(data) ? data[0] : data;
        if (!item) return null;
        return { id: idOrRef, court: "TCE-CE", exists: true, rawTextOrJson: item };
      } catch {
        return null;
      }
    }

    try {
      const parsedRef = parseCanonicalAcordaoRef(idOrRef);
      const searchQuery = parsedRef
        ? `nrdocumento:${parsedRef.numero} AND nranodocumento:${parsedRef.ano}`
        : idOrRef;

      const searchRes = await this.search(searchQuery, { limit: 5 });
      if (searchRes.length > 0) {
        // Se houver número/ano, busca match exato
        if (parsedRef) {
          const exact = searchRes.find(
            (r) => r.numero === parsedRef.numero && r.ano === parsedRef.ano
          );
          if (exact) {
            return {
              id: idOrRef,
              court: "TCE-CE",
              exists: true,
              rawTextOrJson: exact.rawPayload || exact,
            };
          }
        }
        return {
          id: idOrRef,
          court: "TCE-CE",
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
      id: hit.id || `TCE-CE-${hit.numero || "SN"}-${hit.ano || 2024}`,
      court: "TCE-CE",
      colegiado: hit.colegiado || "Pleno",
      numero: String(hit.numero || "S/N"),
      ano: Number(hit.ano || 2024),
      processo: hit.processo,
      relator: hit.relator || "Conselheiro Relator",
      dataSessao: hit.dataSessao || hit.data,
      entidade: hit.entidade || hit.jurisdicionado,
      indexacao: hit.indexacao,
      tese: hit.tese || hit.ementa,
      dispositivo: hit.dispositivo,
      rawPayload: hit,
    }));
  }

  private mapTceCeHit(hit: any): RawJurisSearchResult {
    const numero = String(hit.nrdocumento || hit.iddocumento || "S/N");
    const ano = Number(hit.nranodocumento || 2024);
    const id = `TCE-CE-Acórdão-${numero}-${ano}`;
    const tese = hit.tesauro_ementa_documento || hit.dssumula || (hit.conteudo ? hit.conteudo.slice(0, 300) : "");
    const dispositivo = hit.conteudo ? hit.conteudo.slice(0, 400) : tese;

    return {
      id,
      court: "TCE-CE",
      colegiado: hit.tpespeciecategoria || "Pleno",
      numero,
      ano,
      processo: hit.nrprocesso || String(hit.idprocesso || ""),
      relator: hit.nmmembrorelator || "Conselheiro Relator",
      dataSessao: hit.dtsessao,
      entidade: hit.dsentidade,
      indexacao: hit.dsdocumento || hit.nmtipodocumento,
      tese,
      dispositivo,
      rawPayload: hit,
    };
  }
}
