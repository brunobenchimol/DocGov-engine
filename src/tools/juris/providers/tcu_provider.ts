// ============================================================================
// Conector Oficial do Tribunal de Contas da União (TCU Provider)
// docgov-engine v1.4.0 — providers/tcu_provider.ts
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
      const url = `${baseUrl}/search?court=TCU&q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok) {
        return {
          hits: [],
          diagnostic: {
            court: "TCU",
            status: "error",
            hits: 0,
            latency_ms: res.latencyMs,
            error: res.error,
          },
        };
      }
      const data = res.data;
      const rawItems = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.resultado)
        ? data.resultado
        : Array.isArray(data?.documentos)
        ? data.documentos
        : [];

      const hits = rawItems.map((hit: any) => this.mapTcuDocToResult(hit));
      return {
        hits,
        diagnostic: {
          court: "TCU",
          status: "ok",
          hits: hits.length,
          latency_ms: res.latencyMs,
          error: null,
        },
      };
    }

    // 2. Modo Produção Oficial TCU REST
    const { cleanQuery, shortQuery } = sanitizeQueryForCourt(query);
    const queryToUse = cleanQuery || query;

    const t0 = performance.now();
    // Consulta em paralelo em Jurisprudência Selecionada e Acórdãos Completos
    const urlJurisSel = `${baseUrl}/jurisprudencia-selecionada/documento?termo=${encodeURIComponent(
      queryToUse
    )}&inicio=0&quantidade=${limit}`;
    const urlAcordaoComp = `${baseUrl}/acordao-completo/documento?termo=${encodeURIComponent(
      queryToUse
    )}&inicio=0&quantidade=${limit}`;

    const [resJuris, resAcordao] = await Promise.all([
      executeJurisHttpRequest(urlJurisSel),
      executeJurisHttpRequest(urlAcordaoComp),
    ]);

    let docsJuris: any[] = resJuris.ok && Array.isArray(resJuris.data?.documentos)
      ? resJuris.data.documentos
      : [];
    let docsAcordao: any[] = resAcordao.ok && Array.isArray(resAcordao.data?.documentos)
      ? resAcordao.data.documentos
      : [];

    // Fallback de alta revocação com query enxuta se nenhuma retornou resultados
    if (docsJuris.length === 0 && docsAcordao.length === 0 && shortQuery && shortQuery !== queryToUse) {
      const urlShortAcordao = `${baseUrl}/acordao-completo/documento?termo=${encodeURIComponent(
        shortQuery
      )}&inicio=0&quantidade=${limit}`;
      const resShort = await executeJurisHttpRequest(urlShortAcordao);
      if (resShort.ok && Array.isArray(resShort.data?.documentos)) {
        docsAcordao = resShort.data.documentos;
      }
    }

    const totalLatencyMs = Math.round(performance.now() - t0);
    const combinedMap = new Map<string, RawJurisSearchResult>();

    // Prioriza teses e enunciados da jurisprudência selecionada
    for (const doc of docsJuris) {
      const hit = this.mapTcuDocToResult(doc);
      combinedMap.set(hit.id, hit);
    }
    for (const doc of docsAcordao) {
      const hit = this.mapTcuDocToResult(doc);
      if (!combinedMap.has(hit.id)) {
        combinedMap.set(hit.id, hit);
      }
    }

    const hits = Array.from(combinedMap.values()).slice(0, limit);
    const hasError = !resJuris.ok && !resAcordao.ok;

    return {
      hits,
      diagnostic: {
        court: "TCU",
        status: hasError ? "error" : "ok",
        hits: hits.length,
        latency_ms: totalLatencyMs,
        error: hasError ? resAcordao.error || resJuris.error : null,
      },
    };
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    // 1. Modo Mock Server (.NET Assert 29)
    if (isMock) {
      const url = `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=TCU`;
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
        court: "TCU",
        exists: true,
        rawTextOrJson: item,
      };
    }

    // 2. Modo Produção Oficial TCU REST
    const parsed = parseCanonicalAcordaoRef(idOrRef);
    let exactDoc: any = null;

    if (parsed.numero && parsed.ano) {
      // Consulta direta por número e ano na base de acórdãos completos
      const url = `${baseUrl}/acordao-completo/documento?termo=${parsed.numero}/${parsed.ano}&quantidade=20`;
      const res = await executeJurisHttpRequest(url);
      if (res.ok && Array.isArray(res.data?.documentos)) {
        const docs = res.data.documentos;
        // Localiza documento exato pelo número e ano
        const matches = docs.filter(
          (d: any) =>
            String(d.NUMACORDAO || "").trim() === parsed.numero &&
            String(d.ANOACORDAO || "").trim() === String(parsed.ano)
        );
        if (matches.length > 0) {
          if (parsed.colegiado) {
            exactDoc =
              matches.find(
                (d: any) =>
                  String(d.COLEGIADO || "")
                    .toLowerCase()
                    .includes(parsed.colegiado!.toLowerCase())
              ) || matches[0];
          } else {
            exactDoc = matches[0];
          }
        }
      }
    }

    // Se ainda não encontrou (ou idOrRef foi uma KEY tipo ACORDAO-COMPLETO-2424300), busca por termo livre
    if (!exactDoc) {
      const urlFallback = `${baseUrl}/acordao-completo/documento?termo=${encodeURIComponent(
        idOrRef
      )}&quantidade=5`;
      const resFallback = await executeJurisHttpRequest(urlFallback);
      if (resFallback.ok && Array.isArray(resFallback.data?.documentos)) {
        exactDoc = resFallback.data.documentos[0];
      }
    }

    if (!exactDoc) {
      return null;
    }

    return {
      id: idOrRef,
      court: "TCU",
      exists: true,
      rawTextOrJson: exactDoc,
    };
  }

  private mapTcuDocToResult(doc: any): RawJurisSearchResult {
    const num = doc.NUMACORDAO || doc.numeroAcordao || doc.numero || "S/N";
    const ano = doc.ANOACORDAO || doc.anoAcordao || doc.ano || new Date().getFullYear();
    const col = doc.COLEGIADO || doc.colegiado || "Plenário";
    const id =
      doc.KEY ||
      doc.id ||
      `ACORDAO-TCU-${num}-${ano}-${String(col).toUpperCase().replace(/\s+/g, "_")}`;

    const procRaw = doc.PROC || doc.processo || "";
    const procClean = procRaw.replace(/<[^>]+>/g, "").trim() || undefined;

    const rawEntidade = Array.isArray(doc.ENTIDADE)
      ? doc.ENTIDADE.join("; ")
      : doc.ENTIDADE || doc.unidadeJurisdicionada || doc.entidade;

    const tese =
      doc.ENUNCIADO ||
      doc.enunciado ||
      doc.SUMARIO ||
      doc.sumario ||
      doc.tese ||
      doc.ASSUNTO;

    const indexacao =
      doc.INDEXACAO ||
      doc.indexacao ||
      [doc.AREA, doc.TEMA, doc.SUBTEMA].filter(Boolean).join(" / ");

    return {
      id,
      court: "TCU",
      colegiado: col,
      numero: String(num),
      ano: Number(ano),
      processo: procClean,
      relator: doc.RELATOR || doc.relator || doc.AUTORTESE,
      dataSessao: doc.DATASESSAO || doc.dataSessao || doc.DATASESSAOFORMATADA || doc.data,
      entidade: rawEntidade,
      indexacao,
      tese: typeof tese === "string" ? tese.replace(/<[^>]+>/g, "").trim() : tese,
      dispositivo: doc.ACORDAO || doc.acordao || doc.dispositivo,
      rawPayload: doc,
    };
  }
}
