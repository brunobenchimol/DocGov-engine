// ============================================================================
// Conector Oficial do Supremo Tribunal Federal (STF Provider)
// docgov-engine v1.7.6 — providers/stf_provider.ts (Corte Limpo, Zero Viés ES)
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

export class StfProvider extends BaseJurisdictionProvider {
  public readonly courtId = "STF";
  public readonly tier = "FEDERAL" as const;
  public readonly defaultFederal = true;
  public readonly envOverrideKey = "DOCGOV_STF_BASE_URL";
  protected override readonly mockEnvKeys = ["DOCGOV_JURIS_STF_URL"];
  protected override readonly baseUrlEnvKeys = ["DOCGOV_STF_BASE_URL"];
  protected override readonly mockFetchStyle = "path" as const;
  protected override readonly notFoundStyle = "null" as const;
  protected override readonly defaultLiveTimeoutMs = 5000;
  protected override readonly defaultFetchTimeoutMs = 7000;

  public readonly liveSmokeQuery = "licitação contrato administrativo";
  public readonly idPatterns = [
    /\bSTF\b/i,
    /\bRE\s*\d+/i,
    /\bADI\s*\d+/i,
    /\b(?:SV|SUMULA[-_]VINCULANTE|ADC)[-_]?(?:STF[-_]?)?\d+\b/i,
    /\bSTF[-_]TEMA[-_]\d+\b/i,
  ];

  protected getDefaultBaseUrl(): string {
    return "https://jurisprudencia.stf.jus.br/api/search/search";
  }

  private getSearchEndpoint(baseUrl: string): string {
    if (baseUrl.endsWith("/search/search")) return baseUrl;
    if (baseUrl.endsWith("/search")) return `${baseUrl}/search`;
    return `${baseUrl}/api/search/search`;
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const { cleanQuery } = sanitizeQueryForCourt(query);
    const queryTerm = cleanQuery || query;

    const endpoint = this.getSearchEndpoint(baseUrl);
    const bodyPayload = {
      query: {
        bool: {
          must: [{ query_string: { query: queryTerm } }],
          filter: [{ term: { base: "acordaos" } }],
        },
      },
      _source: {
        excludes: ["inteiro_teor_texto", "documental_observacao_html"],
      },
      size: limit,
    };

    const res = await this.executeHttp(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
      timeoutMs: ctx.timeoutMs,
    });

    this.assertHttpOk(res);
    const rawHits = res.data?.result?.hits?.hits || [];
    return rawHits.map((h: any) => this.mapStfHitToResult(h._source || h));
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const endpoint = this.getSearchEndpoint(baseUrl);
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

    const res = await this.executeHttp(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
      timeoutMs: ctx.timeoutMs,
    });

    if (res.status === 404) return null;
    this.assertHttpOk(res);

    const rawHits = res.data?.result?.hits?.hits || [];
    if (rawHits.length === 0) return null;

    const item = rawHits[0]._source || rawHits[0];
    return {
      id: idOrRef,
      court: "STF",
      exists: true,
      source: "LIVE",
      rawTextOrJson: item,
    };
  }

  protected mapMockHitToResult(raw: any): RawJurisSearchResult {
    return this.mapStfHitToResult(raw);
  }

  private mapStfHitToResult(hit: any): RawJurisSearchResult {
    const id = hit.id || hit.dg_unique || `STF-${hit.titulo || hit.numero || "ACORDAO"}`;
    const num = hit.processo_numero || hit.numero || "S/N";
    const dataStr = hit.julgamento_data || hit.publicacao_data || hit.dataSessao;
    const rawAno = dataStr
      ? Number(String(dataStr).slice(0, 4))
      : hit.ano !== undefined && hit.ano !== null
      ? Number(hit.ano)
      : undefined;
    const ano = rawAno !== undefined && Number.isFinite(rawAno) && rawAno > 1900 ? rawAno : undefined;
    const col = hit.orgao_julgador || hit.colegiado || "Tribunal Pleno";

    const tese =
      hit.documental_tese_texto ||
      hit.ementa_texto ||
      hit.tese ||
      hit.ementa ||
      "";

    return {
      id,
      court: "STF",
      colegiado: col,
      numero: String(num),
      ...(ano !== undefined ? { ano } : {}),
      processo: hit.titulo || hit.processo || `STF ${num}`,
      relator:
        hit.relator_acordao_nome ||
        hit.relator_processo_nome ||
        hit.relator ||
        "Ministro Relator",
      dataSessao: dataStr,
      entidade: hit.partes_lista_texto || hit.entidade || hit.partes || "NAO_INFORMADA",
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
