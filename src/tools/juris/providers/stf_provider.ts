// ============================================================================
// Conector Oficial do Supremo Tribunal Federal (STF Provider)
// docgov-engine v1.4.0 — providers/stf_provider.ts
// ============================================================================

import type {
  JurisdictionProvider,
  RawJurisSearchResult,
  RawJurisFetchResult,
  SearchJurisOptions,
  CourtDiagnostic,
} from "../types.ts";
import {
  executeJurisHttpRequest,
  sanitizeQueryForCourt,
  parseCanonicalAcordaoRef,
} from "./http_client.ts";

export class StfProvider implements JurisdictionProvider {
  public readonly courtId = "STF";

  private getBaseUrl(): string {
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    return (
      process.env.DOCGOV_STF_BASE_URL ||
      "https://jurisprudencia.stf.jus.br/api/search"
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
    const limit = options?.limit || 10;
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    // 1. Modo Mock Server (.NET Assert 29)
    if (isMock) {
      const url = `${baseUrl}/search?court=STF&q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok) {
        return {
          hits: [],
          diagnostic: {
            court: "STF",
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
        : Array.isArray(data?.result?.hits?.hits)
        ? data.result.hits.hits.map((h: any) => h._source || h)
        : [];

      const hits = rawHits.map((h: any) => this.mapStfHitToResult(h));
      return {
        hits,
        diagnostic: {
          court: "STF",
          status: "ok",
          hits: hits.length,
          latency_ms: res.latencyMs,
          error: null,
        },
      };
    }

    // 2. Modo Produção Oficial STF Elasticsearch
    const { cleanQuery } = sanitizeQueryForCourt(query);
    const queryTerm = cleanQuery || query;

    const endpoint = baseUrl.endsWith("/search") ? baseUrl : `${baseUrl}/search`;
    const bodyPayload = {
      query: {
        bool: {
          must: [{ query_string: { query: queryTerm } }],
          filter: [{ term: { base: "acordaos" } }],
        },
      },
      size: limit,
    };

    const res = await executeJurisHttpRequest(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
      timeoutMs: 8000,
    });

    if (!res.ok || !res.data) {
      return {
        hits: [],
        diagnostic: {
          court: "STF",
          status: "error",
          hits: 0,
          latency_ms: res.latencyMs,
          error: res.error,
        },
      };
    }

    const rawHits = res.data?.result?.hits?.hits || [];
    const hits = rawHits.map((h: any) => this.mapStfHitToResult(h._source || h));

    return {
      hits,
      diagnostic: {
        court: "STF",
        status: "ok",
        hits: hits.length,
        latency_ms: res.latencyMs,
        error: null,
      },
    };
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    // 1. Modo Mock Server (.NET Assert 29)
    if (isMock) {
      const url = `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=STF`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok || !res.data) return null;
      const item = Array.isArray(res.data)
        ? res.data[0]
        : Array.isArray(res.data?.items)
        ? res.data.items[0]
        : res.data;
      if (!item) return null;
      return {
        id: idOrRef,
        court: "STF",
        exists: true,
        rawTextOrJson: item,
      };
    }

    // 2. Modo Produção Oficial STF Elasticsearch
    const endpoint = baseUrl.endsWith("/search") ? baseUrl : `${baseUrl}/search`;
    const parsed = parseCanonicalAcordaoRef(idOrRef);
    const searchTerm = parsed.numero ? `${parsed.numero}` : idOrRef;

    const bodyPayload = {
      query: {
        bool: {
          must: [{ query_string: { query: searchTerm } }],
          filter: [{ term: { base: "acordaos" } }],
        },
      },
      size: 5,
    };

    const res = await executeJurisHttpRequest(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
      timeoutMs: 8000,
    });

    if (!res.ok || !res.data) return null;
    const rawHits = res.data?.result?.hits?.hits || [];
    if (rawHits.length === 0) return null;

    const item = rawHits[0]._source || rawHits[0];
    return {
      id: idOrRef,
      court: "STF",
      exists: true,
      rawTextOrJson: item,
    };
  }

  private mapStfHitToResult(hit: any): RawJurisSearchResult {
    const id = hit.id || hit.dg_unique || `STF-${hit.titulo || hit.numero || "ACORDAO"}`;
    const num = hit.processo_numero || hit.numero || "S/N";
    const dataStr = hit.julgamento_data || hit.publicacao_data || hit.dataSessao;
    const ano = dataStr ? Number(String(dataStr).slice(0, 4)) : hit.ano || 2024;
    const col = hit.orgao_julgador || hit.colegiado || "Tribunal Pleno";

    const tese =
      hit.documental_tese_texto ||
      hit.ementa_texto ||
      hit.tese ||
      hit.ementa ||
      "Tese fixada pelo Supremo Tribunal Federal";

    return {
      id,
      court: "STF",
      colegiado: col,
      numero: String(num),
      ano,
      processo: hit.titulo || hit.processo || `STF ${num}`,
      relator:
        hit.relator_acordao_nome ||
        hit.relator_processo_nome ||
        hit.relator ||
        "Ministro Relator",
      dataSessao: dataStr,
      entidade: hit.partes_lista_texto || hit.entidade || hit.partes,
      indexacao:
        hit.documental_indexacao_texto ||
        hit.documental_assunto_texto ||
        hit.indexacao,
      tese: typeof tese === "string" ? tese.replace(/<[^>]+>/g, "").trim() : tese,
      dispositivo: hit.acordao_ata || hit.dispositivo,
      rawPayload: hit,
    };
  }
}
