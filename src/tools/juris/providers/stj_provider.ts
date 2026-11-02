// ============================================================================
// Conector Oficial do Superior Tribunal de Justiça (STJ Provider)
// docgov-engine v1.4.0 — providers/stj_provider.ts
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

export class StjProvider implements JurisdictionProvider {
  public readonly courtId = "STJ";

  // Cache em memória de curta duração por sessão (Trava Técnica 2)
  private static cachedDataset: any[] | null = null;
  private static cachedDatasetTimestamp = 0;
  private static readonly CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutos

  private getBaseUrl(): string {
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    return (
      process.env.DOCGOV_STJ_BASE_URL ||
      "https://dadosabertos.web.stj.jus.br/api/3/action"
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
      const url = `${baseUrl}/search?court=STJ&q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok) {
        return {
          hits: [],
          diagnostic: {
            court: "STJ",
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
        : Array.isArray(data?.result?.results)
        ? data.result.results
        : [];

      const hits = rawHits.map((hit: any) => this.mapStjItemToResult(hit));
      return {
        hits,
        diagnostic: {
          court: "STJ",
          status: "ok",
          hits: hits.length,
          latency_ms: res.latencyMs,
          error: null,
        },
      };
    }

    // 2. Modo Produção Oficial STJ Dados Abertos CKAN (Trava Técnica 2: timeout estrito 6000ms)
    const t0 = performance.now();
    try {
      const items = await this.loadOrFetchRecentDataset(baseUrl);
      const { terms } = sanitizeQueryForCourt(query);

      // Filtra acórdãos em memória pelas palavras-chave da busca
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

      const hits = scoredItems.map((entry) => this.mapStjItemToResult(entry.item));
      const latencyMs = Math.round(performance.now() - t0);

      return {
        hits,
        diagnostic: {
          court: "STJ",
          status: "ok",
          hits: hits.length,
          latency_ms: latencyMs,
          error: null,
        },
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - t0);
      return {
        hits: [],
        diagnostic: {
          court: "STJ",
          status: "error",
          hits: 0,
          latency_ms: latencyMs,
          error: err?.message || "Timeout/Erro ao consultar CKAN STJ",
        },
      };
    }
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    // 1. Modo Mock Server (.NET Assert 29)
    if (isMock) {
      const url = `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=STJ`;
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
        court: "STJ",
        exists: true,
        rawTextOrJson: item,
      };
    }

    // 2. Modo Produção Oficial STJ
    const parsed = parseCanonicalAcordaoRef(idOrRef);
    try {
      const items = await this.loadOrFetchRecentDataset(baseUrl);
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
        rawTextOrJson: match,
      };
    } catch {
      return null;
    }
  }

  /**
   * Baixa exclusivamente 1 recurso JSON mais recente (1ª Seção) com timeout estrito de 6000ms.
   */
  private async loadOrFetchRecentDataset(baseUrl: string): Promise<any[]> {
    const now = Date.now();
    if (
      StjProvider.cachedDataset &&
      now - StjProvider.cachedDatasetTimestamp < StjProvider.CACHE_TTL_MS
    ) {
      return StjProvider.cachedDataset;
    }

    // Descoberta do recurso mais recente da 1ª Seção (Direito Público / Licitações)
    const pkgUrl = `${baseUrl}/package_show?id=espelhos-de-acordaos-primeira-secao`;
    const resPkg = await executeJurisHttpRequest(pkgUrl, { timeoutMs: 6000, retries: 0 });

    if (!resPkg.ok || !resPkg.data?.result) {
      throw new Error(`Falha ao obter metadados do STJ CKAN: ${resPkg.error}`);
    }

    const resources = resPkg.data.result.resources || [];
    const jsonResources = resources.filter(
      (r: any) => r.format === "JSON" || (r.url && r.url.endsWith(".json"))
    );

    if (jsonResources.length === 0) {
      throw new Error("Nenhum recurso JSON encontrado no dataset da 1ª Seção do STJ");
    }

    // Pega o recurso mais recente publicado
    const latestRes = jsonResources[jsonResources.length - 1];
    const resData = await executeJurisHttpRequest(latestRes.url, { timeoutMs: 6000, retries: 0 });

    if (!resData.ok || !resData.data) {
      throw new Error(`Falha ao baixar espelhos de acórdãos do STJ: ${resData.error}`);
    }

    const items = Array.isArray(resData.data) ? resData.data : [];
    StjProvider.cachedDataset = items;
    StjProvider.cachedDatasetTimestamp = now;

    return items;
  }

  private mapStjItemToResult(item: any): RawJurisSearchResult {
    const id =
      item.id ||
      `STJ-${item.siglaClasse || "RESP"}-${item.numeroProcesso || "SN"}-${item.numeroRegistro || 2024}`;
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
      entidade: item.entidade || "Administração Pública",
      indexacao: Array.isArray(item.termosAuxiliares)
        ? item.termosAuxiliares.join("; ")
        : item.termosAuxiliares || item.tema,
      tese: item.teseJuridica || item.ementa || "Tese fixada pelo Superior Tribunal de Justiça",
      dispositivo: item.decisao || item.dispositivo,
      rawPayload: item,
    };
  }
}
