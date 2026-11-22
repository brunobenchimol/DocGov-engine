// ============================================================================
// Conector Oficial do Superior Tribunal de Justiça (STJ Provider)
// docgov-engine — providers/stj_provider.ts (extends BaseJurisdictionProvider)
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
import {
  getStjCatalogItemById,
  mapStjCatalogItemToFetch,
  searchStjCatalog,
} from "./stj_catalog.ts";

export class StjProvider extends BaseJurisdictionProvider {
  public readonly courtId = "STJ";
  public readonly tier = "FEDERAL" as const;
  public readonly defaultFederal = true;
  public readonly envOverrideKey = "DOCGOV_STJ_BASE_URL";
  protected override readonly mockEnvKeys = ["DOCGOV_JURIS_STJ_URL"];
  protected override readonly baseUrlEnvKeys = ["DOCGOV_STJ_BASE_URL"];
  protected override readonly mockFetchStyle = "path" as const;
  protected override readonly notFoundStyle = "null" as const;
  protected override readonly defaultLiveTimeoutMs = 6000;
  protected override readonly defaultFetchTimeoutMs = 6000;

  public readonly liveSmokeQuery = "licitação serviço técnico especializado";
  public readonly idPatterns = [
    /\bSTJ\b/i,
    /\bREsp\s*\d+/i,
    /\bSUMULA[-_]?STJ[-_]?\d+\b/i,
  ];

  private static cachedDataset: any[] | null = null;
  private static cachedDatasetUrl = "";
  private static cachedDatasetTimestamp = 0;
  private static readonly CACHE_TTL_MS = 1000 * 60 * 30;

  protected getDefaultBaseUrl(): string {
    return "https://dadosabertos.web.stj.jus.br/api/3/action";
  }

  protected override searchCatalog(query: string, limit: number): RawJurisSearchResult[] {
    return searchStjCatalog(query, limit);
  }

  protected override shouldShortCircuitCatalog(query: string): boolean {
    return /\bs[úu]mula\s*(?:n[º°o]\s*)?(?:333|645)\b/i.test(query);
  }

  protected override findCatalogItemById(idOrRef: string): RawJurisFetchResult | null {
    const entry = getStjCatalogItemById(idOrRef);
    return entry ? mapStjCatalogItemToFetch(entry) : null;
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const forceLive = ctx.options?.force_live === true;
    const items = await this.loadOrFetchRecentDataset(baseUrl, ctx.timeoutMs, forceLive);
    const { terms } = sanitizeQueryForCourt(query);

    const scoredItems = items
      .map((item) => {
        const textCorpus = `${item.ementa || ""} ${item.teseJuridica || ""} ${
          item.descricaoClasse || ""
        } ${item.termosAuxiliares || ""}`.toLowerCase();

        let matchScore = 0;
        for (const term of terms) {
          if (textCorpus.includes(term.toLowerCase())) {
            matchScore += 1;
          }
        }
        return { item, matchScore };
      })
      .filter((entry) => entry.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    return scoredItems.map((entry) => this.mapStjItemToResult(entry.item));
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const parsed = parseCanonicalAcordaoRef(idOrRef);
    const items = await this.loadOrFetchRecentDataset(baseUrl, ctx.timeoutMs, ctx.forceLive);
    const match = items.find((item) => {
      if (parsed.numero && String(item.numeroProcesso || "").trim() === parsed.numero) {
        return true;
      }
      if (item.id === idOrRef || item.numeroRegistro === idOrRef) {
        return true;
      }
      return false;
    });

    if (!match) return null;

    return {
      id: idOrRef,
      court: "STJ",
      exists: true,
      source: "LIVE",
      rawTextOrJson: match,
    };
  }

  private async loadOrFetchRecentDataset(
    baseUrl: string,
    timeoutMs: number,
    forceRefresh: boolean
  ): Promise<any[]> {
    const now = Date.now();
    if (
      !forceRefresh &&
      StjProvider.cachedDataset &&
      StjProvider.cachedDatasetUrl === baseUrl &&
      now - StjProvider.cachedDatasetTimestamp < StjProvider.CACHE_TTL_MS
    ) {
      return StjProvider.cachedDataset;
    }

    const pkgUrl = `${baseUrl}/package_show?id=espelhos-de-acordaos-primeira-secao`;
    const resPkg = await this.executeHttp(pkgUrl, { timeoutMs });
    this.assertHttpOk(resPkg, "Falha ao obter metadados do STJ CKAN");

    const resources = resPkg.data?.result?.resources || [];
    const jsonResources = resources.filter(
      (r: any) => r.format === "JSON" || (r.url && r.url.endsWith(".json"))
    );

    if (jsonResources.length === 0) {
      throw new Error("Nenhum recurso JSON encontrado no dataset da 1ª Seção do STJ");
    }

    const latestRes = jsonResources[jsonResources.length - 1];
    const resData = await this.executeHttp(latestRes.url, { timeoutMs });
    this.assertHttpOk(resData, "Falha ao baixar espelhos de acórdãos do STJ");

    const items = Array.isArray(resData.data) ? resData.data : [];
    StjProvider.cachedDataset = items;
    StjProvider.cachedDatasetUrl = baseUrl;
    StjProvider.cachedDatasetTimestamp = now;

    return items;
  }

  protected mapMockHitToResult(raw: any): RawJurisSearchResult {
    return this.mapStjItemToResult(raw);
  }

  private mapStjItemToResult(item: any): RawJurisSearchResult {
    const id =
      item.id ||
      `STJ-${item.siglaClasse || "RESP"}-${item.numeroProcesso || "SN"}-${
        item.numeroRegistro || 2024
      }`;
    const dataDec = item.dataDecisao || item.dataPublicacao || "";
    const ano = dataDec ? Number(String(dataDec).slice(0, 4)) : 2024;
    const col = item.nomeOrgaoJulgador || item.colegiado || "Primeira Seção";

    return {
      id,
      court: "STJ",
      colegiado: col,
      numero: String(item.numeroProcesso || "S/N"),
      ano,
      processo: `${item.siglaClasse || "Processo"} ${item.numeroProcesso || ""} (${
        item.numeroRegistro || ""
      })`.trim(),
      relator: item.ministroRelator || item.relator || "Ministro Relator",
      dataSessao: dataDec,
      entidade: item.entidade || "ORGAO_CONTRATANTE",
      indexacao: Array.isArray(item.termosAuxiliares)
        ? item.termosAuxiliares.join("; ")
        : item.termosAuxiliares || item.tema,
      tese:
        item.teseJuridica ||
        item.ementa ||
        "Tese fixada pelo Superior Tribunal de Justiça",
      dispositivo: item.decisao || item.dispositivo,
      rawPayload: item,
    };
  }
}
