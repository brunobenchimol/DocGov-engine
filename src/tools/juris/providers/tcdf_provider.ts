// ============================================================================
// Conector TCDF (Tribunal de Contas do Distrito Federal)
// docgov-engine v1.7.6 — providers/tcdf_provider.ts (Corte Limpo, Cache TTL 24h)
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

export class TcdfProvider extends BaseJurisdictionProvider {
  public readonly courtId = "TCDF";
  public readonly tier = "STATE" as const;
  public readonly uf = "DF";
  public readonly envOverrideKey = "DOCGOV_TCDF_BASE_URL";
  protected override readonly mockEnvKeys = ["DOCGOV_JURIS_TCDF_URL"];
  protected override readonly baseUrlEnvKeys = ["DOCGOV_TCDF_BASE_URL"];
  protected override readonly mockFetchStyle = "path" as const;
  protected override readonly notFoundStyle = "null" as const;
  protected override readonly defaultLiveTimeoutMs = 6000;
  protected override readonly defaultFetchTimeoutMs = 7000;

  public readonly liveSmokeQuery = "licitação";
  public readonly idPatterns = [
    /\bTCDF\b/i,
    /\bSUMULA[-_]?TCDF[-_]?\d+\b/i,
  ];

  protected getDefaultBaseUrl(): string {
    return "https://api-busca-publica.tc.df.gov.br";
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const { cleanQuery } = sanitizeQueryForCourt(query);
    const cleanQ = cleanQuery || query;
    const url = `${baseUrl}/jurisprudencia/?q=${encodeURIComponent(
      cleanQ
    )}&from=0&maxPerPage=${limit}`;

    const response = await executeLegacyHttp1Request(url, {
      timeoutMs: ctx.timeoutMs,
      isPlainHttp: url.startsWith("http://"),
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json =
      response.data || (response.body ? JSON.parse(response.body) : null);
    const hitsArray = Array.isArray(json?.data?.hits?.hits)
      ? json.data.hits.hits
      : Array.isArray(json?.data?.data?.hits?.hits)
      ? json.data.data.hits.hits
      : [];

    return hitsArray.map((h: any) => this.mapTcdfSource(h._source || h));
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    const parsedRef = parseCanonicalAcordaoRef(idOrRef);
    const searchQuery = parsedRef?.numero ? parsedRef.numero : idOrRef;

    const searchRes = await this.executeLiveSearch(searchQuery, 5, {
      timeoutMs: ctx.timeoutMs,
    });
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
            source: "LIVE",
            rawTextOrJson: exact.rawPayload || exact,
          };
        }
      }
      return {
        id: idOrRef,
        court: "TCDF",
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
      id: hit.id || `TCDF-${hit.numero || "SN"}${ano !== undefined ? `-${ano}` : ""}`,
      court: "TCDF",
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

  private mapTcdfSource(src: any): RawJurisSearchResult {
    const numero = String(src.documento_numero || "S/N");
    const rawAno =
      src.documento_ano !== undefined && src.documento_ano !== null
        ? Number(src.documento_ano)
        : undefined;
    const ano = rawAno !== undefined && Number.isFinite(rawAno) ? rawAno : undefined;
    const id = `TCDF-Decisão-${numero}${ano !== undefined ? `-${ano}` : ""}`;
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
      ...(ano !== undefined ? { ano } : {}),
      processo: src.processo_numero_completo || src.processo_numero,
      relator: src.processo_relator || "Conselheiro Relator",
      dataSessao: src.sessao_data,
      entidade: src.orgao || src.entidade || "NAO_INFORMADA",
      indexacao: src.jurisprudencia_assunto || src.jurisprudencia_tipo_descricao,
      tese,
      dispositivo,
      rawPayload: src,
    };
  }
}
