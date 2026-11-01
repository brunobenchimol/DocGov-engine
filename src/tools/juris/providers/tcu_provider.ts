// ============================================================================
// Conector Oficial do Tribunal de Contas da União (TCU Provider)
// ============================================================================

import type {
  JurisdictionProvider,
  RawJurisSearchResult,
  RawJurisFetchResult,
  SearchJurisOptions,
} from "../types.ts";

export class TcuProvider implements JurisdictionProvider {
  public readonly courtId = "TCU";

  private getBaseUrl(): string {
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    return (
      process.env.DOCGOV_TCU_BASE_URL ||
      "https://pesquisa.apps.tcu.gov.br/rest/publico/base"
    ).replace(/\/+$/, "");
  }

  public async search(
    query: string,
    options?: Partial<SearchJurisOptions>
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const limit = options?.limit || 10;
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    let url: string;
    if (isMock) {
      url = `${baseUrl}/search?court=TCU&q=${encodeURIComponent(query)}&limit=${limit}`;
    } else {
      url = `${baseUrl}/jurisprudencia-selecionada?termo=${encodeURIComponent(
        query
      )}&inicio=0&quantidade=${limit}`;
    }

    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
      });

      if (!resp.ok) {
        return [];
      }

      const data = await resp.json();
      const hits = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.resultado)
        ? data.resultado
        : [];

      return hits.map((hit: any) => {
        const num = hit.numeroAcordao || hit.numero || "S/N";
        const ano = hit.anoAcordao || hit.ano || new Date().getFullYear();
        const col = hit.colegiado || "Plenário";
        const id = hit.id || `ACORDAO-TCU-${num}-${ano}-${col.toUpperCase().replace(/\s+/g, "_")}`;

        return {
          id,
          court: "TCU",
          colegiado: col,
          numero: String(num),
          ano: Number(ano),
          processo: hit.processo,
          relator: hit.relator,
          dataSessao: hit.dataSessao || hit.data,
          entidade: hit.unidadeJurisdicionada || hit.entidade,
          indexacao: hit.indexacao,
          tese: hit.enunciado || hit.sumario || hit.tese,
          dispositivo: hit.acordao || hit.dispositivo,
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

    let url: string;
    if (isMock) {
      url = `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=TCU`;
    } else {
      const match = idOrRef.match(/(\d+)\/(\d{4})/);
      if (match) {
        url = `${baseUrl}/acordao-completo?numeroAcordao=${match[1]}&anoAcordao=${match[2]}`;
      } else {
        url = `${baseUrl}/publicacoes?termo=${encodeURIComponent(idOrRef)}&quantidade=1`;
      }
    }

    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
      });

      if (!resp.ok) {
        return null;
      }

      const data = await resp.json();
      if (!data) return null;

      const item = Array.isArray(data) ? data[0] : Array.isArray(data.items) ? data.items[0] : data;
      if (!item) return null;

      return {
        id: idOrRef,
        court: "TCU",
        exists: true,
        rawTextOrJson: item,
      };
    } catch {
      return null;
    }
  }
}
