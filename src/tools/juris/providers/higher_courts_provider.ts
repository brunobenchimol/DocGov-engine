// ============================================================================
// Conectores das Cortes Superiores (STJ e STF Providers)
// ============================================================================

import type {
  JurisdictionProvider,
  RawJurisSearchResult,
  RawJurisFetchResult,
  SearchJurisOptions,
} from "../types.ts";

export class StjProvider implements JurisdictionProvider {
  public readonly courtId = "STJ";

  private getBaseUrl(): string {
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    return (
      process.env.DOCGOV_STJ_BASE_URL || "https://scon.stj.jus.br/api"
    ).replace(/\/+$/, "");
  }

  public async search(
    query: string,
    options?: Partial<SearchJurisOptions>
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const limit = options?.limit || 10;
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    const url = isMock
      ? `${baseUrl}/search?court=STJ&q=${encodeURIComponent(query)}&limit=${limit}`
      : `${baseUrl}/jurisprudencia?q=${encodeURIComponent(query)}&size=${limit}`;

    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
      });
      if (!resp.ok) return [];

      const data = await resp.json();
      const hits = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
        ? data.items
        : [];

      return hits.map((hit: any) => {
        const id = hit.id || `STJ-RESP-${hit.numero || "SN"}-${hit.ano || 2024}`;
        return {
          id,
          court: "STJ",
          colegiado: hit.colegiado || "Corte Especial",
          numero: String(hit.numero || "S/N"),
          ano: Number(hit.ano || 2024),
          processo: hit.processo,
          relator: hit.relator,
          dataSessao: hit.dataSessao || hit.data,
          entidade: hit.entidade || hit.partes,
          indexacao: hit.indexacao,
          tese: hit.tese || hit.ementa,
          dispositivo: hit.dispositivo,
          rawPayload: hit,
        };
      });
    } catch {
      return [];
    }
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    const url = isMock
      ? `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=STJ`
      : `${baseUrl}/jurisprudencia/${encodeURIComponent(idOrRef)}`;

    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const item = Array.isArray(data) ? data[0] : data;
      if (!item) return null;

      return {
        id: idOrRef,
        court: "STJ",
        exists: true,
        rawTextOrJson: item,
      };
    } catch {
      return null;
    }
  }
}

export class StfProvider implements JurisdictionProvider {
  public readonly courtId = "STF";

  private getBaseUrl(): string {
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    return (
      process.env.DOCGOV_STF_BASE_URL || "https://jurisprudencia.stf.jus.br/api"
    ).replace(/\/+$/, "");
  }

  public async search(
    query: string,
    options?: Partial<SearchJurisOptions>
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const limit = options?.limit || 10;
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    const url = isMock
      ? `${baseUrl}/search?court=STF&q=${encodeURIComponent(query)}&limit=${limit}`
      : `${baseUrl}/pesquisa?q=${encodeURIComponent(query)}&tamanho=${limit}`;

    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
      });
      if (!resp.ok) return [];

      const data = await resp.json();
      const hits = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
        ? data.items
        : [];

      return hits.map((hit: any) => {
        const id = hit.id || `STF-RE-${hit.numero || "SN"}-${hit.ano || 2024}`;
        return {
          id,
          court: "STF",
          colegiado: hit.colegiado || "Plenário",
          numero: String(hit.numero || "S/N"),
          ano: Number(hit.ano || 2024),
          processo: hit.processo,
          relator: hit.relator,
          dataSessao: hit.dataSessao || hit.data,
          entidade: hit.entidade || hit.partes,
          indexacao: hit.indexacao,
          tese: hit.tese || hit.ementa,
          dispositivo: hit.dispositivo,
          rawPayload: hit,
        };
      });
    } catch {
      return [];
    }
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    const url = isMock
      ? `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=STF`
      : `${baseUrl}/acordaos/${encodeURIComponent(idOrRef)}`;

    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const item = Array.isArray(data) ? data[0] : data;
      if (!item) return null;

      return {
        id: idOrRef,
        court: "STF",
        exists: true,
        rawTextOrJson: item,
      };
    } catch {
      return null;
    }
  }
}
