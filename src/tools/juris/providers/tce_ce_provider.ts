// ============================================================================
// Conector TCE-CE (Tribunal de Contas do Estado do Ceará)
// docgov-engine v1.7.6 — providers/tce_ce_provider.ts (Corte Limpo, Cache TTL 24h)
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
  parseCanonicalAcordaoRef,
  sanitizeQueryForCourt,
} from "./http_client.ts";

export class TceCeProvider extends BaseJurisdictionProvider {
  public readonly courtId = "TCE-CE";
  public readonly tier = "STATE" as const;
  public readonly uf = "CE";
  public readonly envOverrideKey = "DOCGOV_TCE_CE_BASE_URL";
  protected override readonly mockEnvKeys = ["DOCGOV_JURIS_TCE_CE_URL"];
  protected override readonly baseUrlEnvKeys = ["DOCGOV_TCE_CE_BASE_URL"];
  protected override readonly mockFetchStyle = "path" as const;
  protected override readonly notFoundStyle = "null" as const;
  protected override readonly defaultLiveTimeoutMs = 5000;
  protected override readonly defaultFetchTimeoutMs = 6000;

  public readonly liveSmokeQuery = "licitação software";
  public readonly idPatterns = [
    /\bTCE[-_\s]?CE\b/i,
    /\bSUMULA[-_]?TCECE[-_]?\d+\b/i,
  ];

  protected getDefaultBaseUrl(): string {
    return "https://contexto-api.tce.ce.gov.br";
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const { cleanQuery } = sanitizeQueryForCourt(query);
    const cleanQ = cleanQuery || query;
    const url = `${baseUrl}/documentos/buscar-jurisprudencia`;

    const requestBody = {
      filtros: [{ query_string: { query: cleanQ } }],
      searchAfterSort: null,
      buscaPalavraExata: false,
      buscaPesquisaExata: false,
      sort: "desc",
    };

    const res = await this.executeHttp(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
      timeoutMs: ctx.timeoutMs,
    });

    this.assertHttpOk(res);
    const rawHits = Array.isArray(res.data?.data?.lista) ? res.data.data.lista : [];
    return rawHits.slice(0, limit).map((hit: any) => this.mapTceCeHit(hit));
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
            court: "TCE-CE",
            exists: true,
            source: "LIVE",
            rawTextOrJson: exact.rawPayload || exact,
          };
        }
      }
      return {
        id: idOrRef,
        court: "TCE-CE",
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
      id: hit.id || `TCE-CE-${hit.numero || "SN"}${ano !== undefined ? `-${ano}` : ""}`,
      court: "TCE-CE",
      colegiado: hit.colegiado || "Pleno",
      numero: String(hit.numero || "S/N"),
      ...(ano !== undefined ? { ano } : {}),
      processo: hit.processo,
      relator: hit.relator || "Conselheiro Relator",
      dataSessao: hit.dataSessao || hit.data,
      entidade: hit.entidade || hit.jurisdicionado || "NAO_INFORMADA",
      indexacao: hit.indexacao,
      tese: hit.tese || hit.ementa,
      dispositivo: hit.dispositivo,
      rawPayload: hit,
    };
  }

  private mapTceCeHit(hit: any): RawJurisSearchResult {
    const numero = String(hit.nrdocumento || hit.iddocumento || "S/N");
    const rawAno =
      hit.nranodocumento !== undefined && hit.nranodocumento !== null
        ? Number(hit.nranodocumento)
        : undefined;
    const ano = rawAno !== undefined && Number.isFinite(rawAno) ? rawAno : undefined;
    const id = `TCE-CE-Acórdão-${numero}${ano !== undefined ? `-${ano}` : ""}`;
    const tese =
      hit.tesauro_ementa_documento ||
      hit.dssumula ||
      (hit.conteudo ? hit.conteudo.slice(0, 300) : "");
    const dispositivo = hit.conteudo ? hit.conteudo.slice(0, 400) : tese;

    return {
      id,
      court: "TCE-CE",
      colegiado: hit.tpespeciecategoria || "Pleno",
      numero,
      ...(ano !== undefined ? { ano } : {}),
      processo: hit.nrprocesso || String(hit.idprocesso || ""),
      relator: hit.nmmembrorelator || "Conselheiro Relator",
      dataSessao: hit.dtsessao,
      entidade: hit.dsentidade || "NAO_INFORMADA",
      indexacao: hit.dsdocumento || hit.nmtipodocumento,
      tese,
      dispositivo,
      rawPayload: hit,
    };
  }
}
