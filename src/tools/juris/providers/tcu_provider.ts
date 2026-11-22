// ============================================================================
// Conector Oficial do Tribunal de Contas da União (TCU Provider)
// docgov-engine — providers/tcu_provider.ts (extends BaseJurisdictionProvider)
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
  getTcuCatalogItemById,
  mapTcuCatalogItemToFetch,
  searchTcuCatalog,
} from "./tcu_catalog.ts";

export class TcuProvider extends BaseJurisdictionProvider {
  public readonly courtId = "TCU";
  public readonly tier = "FEDERAL" as const;
  public readonly defaultFederal = true;
  public readonly envOverrideKey = "DOCGOV_TCU_BASE_URL";
  protected override readonly mockEnvKeys = ["DOCGOV_JURIS_TCU_URL"];
  protected override readonly baseUrlEnvKeys = ["DOCGOV_TCU_BASE_URL"];
  protected override readonly mockFetchStyle = "path" as const;
  protected override readonly notFoundStyle = "null" as const;
  protected override readonly defaultLiveTimeoutMs = 5000;
  protected override readonly defaultFetchTimeoutMs = 7000;

  public readonly liveSmokeQuery = "orçamento sigiloso padronização";
  public readonly idPatterns = [
    /\bTCU\b/i,
    /\bAcórdão\s+\d+[/_-]\d+[-_\s]*TCU/i,
    /\bSUMULA[-_]?TCU[-_]?\d{3}\b/i,
  ];

  protected getDefaultBaseUrl(): string {
    return "https://pesquisa.apps.tcu.gov.br/rest/publico/base";
  }

  protected override searchCatalog(query: string, limit: number): RawJurisSearchResult[] {
    return searchTcuCatalog(query, limit);
  }

  protected override shouldShortCircuitCatalog(query: string): boolean {
    return /\bs[úu]mula\s*(?:n[º°o]\s*)?(?:177|222|247|250|253|254|263|269|272)\b/i.test(query);
  }

  protected override findCatalogItemById(idOrRef: string): RawJurisFetchResult | null {
    const entry = getTcuCatalogItemById(idOrRef);
    return entry ? mapTcuCatalogItemToFetch(entry) : null;
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const { cleanQuery, shortQuery } = sanitizeQueryForCourt(query);
    const queryToUse = cleanQuery || query;

    const urlJurisSel = `${baseUrl}/jurisprudencia-selecionada/documento?termo=${encodeURIComponent(
      queryToUse
    )}&inicio=0&quantidade=${limit}`;
    const urlAcordaoComp = `${baseUrl}/acordao-completo/documento?termo=${encodeURIComponent(
      queryToUse
    )}&inicio=0&quantidade=${limit}`;

    const [resJuris, resAcordao] = await Promise.all([
      this.executeHttp(urlJurisSel, { timeoutMs: ctx.timeoutMs }),
      this.executeHttp(urlAcordaoComp, { timeoutMs: ctx.timeoutMs }),
    ]);

    if (!resJuris.ok && !resAcordao.ok) {
      this.assertHttpOk(resAcordao);
    }

    const docsJuris: any[] =
      resJuris.ok && Array.isArray(resJuris.data?.documentos)
        ? resJuris.data.documentos
        : [];
    let docsAcordao: any[] =
      resAcordao.ok && Array.isArray(resAcordao.data?.documentos)
        ? resAcordao.data.documentos
        : [];

    if (
      docsJuris.length === 0 &&
      docsAcordao.length === 0 &&
      shortQuery &&
      shortQuery !== queryToUse
    ) {
      const urlShortAcordao = `${baseUrl}/acordao-completo/documento?termo=${encodeURIComponent(
        shortQuery
      )}&inicio=0&quantidade=${limit}`;
      const resShort = await this.executeHttp(urlShortAcordao, {
        timeoutMs: ctx.timeoutMs,
      });
      if (resShort.ok && Array.isArray(resShort.data?.documentos)) {
        docsAcordao = resShort.data.documentos;
      }
    }

    const combinedMap = new Map<string, RawJurisSearchResult>();
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

    return Array.from(combinedMap.values()).slice(0, limit);
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const parsed = parseCanonicalAcordaoRef(idOrRef);
    const deadline = Date.now() + ctx.timeoutMs;
    let exactDoc: any = null;
    let lastTransientError: string | null = null;

    const remainingTimeout = (): number => {
      const left = deadline - Date.now();
      return left > 200 ? left : 0;
    };

    const queryTcu = async (url: string): Promise<any[] | null> => {
      const left = remainingTimeout();
      if (left <= 0) {
        throw new Error(lastTransientError || "TCU fetch timeout budget exceeded");
      }
      const res = await this.executeHttp(url, { timeoutMs: left });
      if (res.ok) {
        return Array.isArray(res.data?.documentos) ? res.data.documentos : [];
      }
      if (res.status === 404 || res.status === 400) return [];
      lastTransientError = res.error || `HTTP ${res.status || 0}`;
      return null;
    };

    // 1. Lookup direto por KEY se prefixado
    if (idOrRef.toUpperCase().startsWith("JURISPRUDENCIA-SELECIONADA-")) {
      const docs = await queryTcu(
        `${baseUrl}/jurisprudencia-selecionada/documento?filtro=KEY:${encodeURIComponent(idOrRef)}`
      );
      if (docs && docs.length > 0) exactDoc = docs[0];
    } else if (idOrRef.toUpperCase().startsWith("ACORDAO-COMPLETO-")) {
      const docs = await queryTcu(
        `${baseUrl}/acordao-completo/documento?filtro=KEY:${encodeURIComponent(idOrRef)}`
      );
      if (docs && docs.length > 0) exactDoc = docs[0];
    }

    // 2. Consulta direta por número/ano
    if (!exactDoc && parsed.numero && parsed.ano) {
      const docs = await queryTcu(
        `${baseUrl}/acordao-completo/documento?termo=${parsed.numero}/${parsed.ano}&quantidade=20`
      );
      if (docs && docs.length > 0) {
        const matches = docs.filter(
          (d: any) =>
            String(d.NUMACORDAO || "").trim() === parsed.numero &&
            String(d.ANOACORDAO || "").trim() === String(parsed.ano)
        );
        if (matches.length > 0) {
          exactDoc = parsed.colegiado
            ? matches.find((d: any) =>
                String(d.COLEGIADO || "")
                  .toLowerCase()
                  .includes(parsed.colegiado!.toLowerCase())
              ) || matches[0]
            : matches[0];
        }
      }
    }

    // 3. Fallback por filtro KEY e termo livre respeitando o orçamento único
    if (!exactDoc && !lastTransientError) {
      const docsKeyAc = await queryTcu(
        `${baseUrl}/acordao-completo/documento?filtro=KEY:${encodeURIComponent(idOrRef)}`
      );
      if (docsKeyAc && docsKeyAc.length > 0) {
        exactDoc = docsKeyAc[0];
      } else {
        const docsKeyJur = await queryTcu(
          `${baseUrl}/jurisprudencia-selecionada/documento?filtro=KEY:${encodeURIComponent(idOrRef)}`
        );
        if (docsKeyJur && docsKeyJur.length > 0) exactDoc = docsKeyJur[0];
      }
    }

    if (!exactDoc && !lastTransientError) {
      const docsFb = await queryTcu(
        `${baseUrl}/acordao-completo/documento?termo=${encodeURIComponent(idOrRef)}&quantidade=5`
      );
      if (docsFb && docsFb.length > 0) exactDoc = docsFb[0];
    }

    if (!exactDoc && lastTransientError) {
      throw new Error(lastTransientError);
    }

    if (!exactDoc) return null;

    return {
      id: idOrRef,
      court: "TCU",
      exists: true,
      source: "LIVE",
      rawTextOrJson: exactDoc,
    };
  }

  protected mapMockHitToResult(raw: any): RawJurisSearchResult {
    return this.mapTcuDocToResult(raw);
  }

  private mapTcuDocToResult(doc: any): RawJurisSearchResult {
    const num = doc.NUMACORDAO || doc.numeroAcordao || doc.numero;
    const ano = doc.ANOACORDAO || doc.anoAcordao || doc.ano;
    const col = doc.COLEGIADO || doc.colegiado || "Plenário";
    const id =
      num && ano && num !== "S/N"
        ? `Acórdão ${num}/${ano}-TCU-${col}`
        : doc.KEY ||
          doc.id ||
          `ACORDAO-TCU-${num || "SN"}-${ano || 2024}-${String(col)
            .toUpperCase()
            .replace(/\s+/g, "_")}`;

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
