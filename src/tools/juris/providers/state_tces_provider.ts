// ============================================================================
// Conectores dos Tribunais de Contas Estaduais (1ª Onda: PA, CE, DF)
// ============================================================================

import type {
  JurisdictionProvider,
  RawJurisSearchResult,
  RawJurisFetchResult,
  SearchJurisOptions,
} from "../types.ts";

export class TcePaProvider implements JurisdictionProvider {
  public readonly courtId = "TCE-PA";

  private getBaseUrl(): string {
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    return (
      process.env.DOCGOV_TCE_PA_BASE_URL || "https://www.tcepa.tc.br/api/jurisprudencia"
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
      ? `${baseUrl}/search?court=TCE-PA&q=${encodeURIComponent(query)}&limit=${limit}`
      : `${baseUrl}/pesquisa?q=${encodeURIComponent(query)}&limite=${limit}`;

    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      const hits = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];

      return hits.map((hit: any) => ({
        id: hit.id || `TCE-PA-${hit.numero || "SN"}-${hit.ano || 2024}`,
        court: "TCE-PA",
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
    } catch {
      return [];
    }
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;
    const url = isMock
      ? `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=TCE-PA`
      : `${baseUrl}/acordaos/${encodeURIComponent(idOrRef)}`;

    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const item = Array.isArray(data) ? data[0] : data;
      if (!item) return null;
      return { id: idOrRef, court: "TCE-PA", exists: true, rawTextOrJson: item };
    } catch {
      return null;
    }
  }
}

export class TceCeProvider implements JurisdictionProvider {
  public readonly courtId = "TCE-CE";

  private getBaseUrl(): string {
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    return (
      process.env.DOCGOV_TCE_CE_BASE_URL || "https://www.tce.ce.gov.br/api/jurisprudencia"
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
      ? `${baseUrl}/search?court=TCE-CE&q=${encodeURIComponent(query)}&limit=${limit}`
      : `${baseUrl}/busca?termo=${encodeURIComponent(query)}&tamanho=${limit}`;

    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      const hits = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];

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
    } catch {
      return [];
    }
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;
    const url = isMock
      ? `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=TCE-CE`
      : `${baseUrl}/decisoes/${encodeURIComponent(idOrRef)}`;

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
}

export class TcdfProvider implements JurisdictionProvider {
  public readonly courtId = "TCDF";

  private getBaseUrl(): string {
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    return (
      process.env.DOCGOV_TCDF_BASE_URL || "https://www.tc.df.gov.br/api/jurisprudencia"
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
      ? `${baseUrl}/search?court=TCDF&q=${encodeURIComponent(query)}&limit=${limit}`
      : `${baseUrl}/pesquisar?q=${encodeURIComponent(query)}&limit=${limit}`;

    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "DocGov-Engine/1.4.0" },
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      const hits = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];

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
    } catch {
      return [];
    }
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;
    const url = isMock
      ? `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=TCDF`
      : `${baseUrl}/consultas/${encodeURIComponent(idOrRef)}`;

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
}
