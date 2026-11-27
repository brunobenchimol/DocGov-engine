// ============================================================================
// Conector Oficial do Tribunal Superior do Trabalho (TST Provider)
// docgov-engine v1.7.6 — providers/tst_provider.ts (Cache Global TTL 24h via Base)
// ============================================================================

import type {
  CourtDiagnostic,
  RawJurisFetchResult,
  RawJurisSearchResult,
  SearchJurisOptions,
  TstTriageMode,
  TstTriageResult,
} from "../types.ts";
import {
  BaseJurisdictionProvider,
  type LiveFetchContext,
  type LiveSearchContext,
} from "./base_provider.ts";
import { sanitizeQueryForCourt } from "./http_client.ts";
import { triageTstPrecedents } from "../tst_precedent_triage.ts";
import { parseTstNormativeRef } from "./tst_catalog.ts";
import {
  buildTstFetchResultFromHtml,
  buildTstNormativeFetchResult,
  mapTstRecordToResult,
  parseCnjLaborRef,
} from "./tst_mapper.ts";

export class TstProvider extends BaseJurisdictionProvider {
  public readonly courtId = "TST";
  public readonly tier = "FEDERAL" as const;
  public readonly defaultFederal = false;
  public readonly envOverrideKey = "DOCGOV_TST_BASE_URL";
  protected override readonly mockEnvKeys = ["DOCGOV_JURIS_TST_URL"];
  protected override readonly baseUrlEnvKeys = ["DOCGOV_TST_BASE_URL"];
  protected override readonly mockFetchStyle = "path" as const;
  protected override readonly notFoundStyle = "null" as const;
  protected override readonly defaultLiveTimeoutMs = 5000;
  protected override readonly defaultFetchTimeoutMs = 7000;

  public readonly liveSmokeQuery =
    "terceirização responsabilidade subsidiária administração pública";
  public readonly idPatterns = [
    /\bTST\b/i,
    /\b(?:AIRR|RR|E-RR|RO|Ag-AIRR|Ag-RR|ED-Ag-RR|Ag-RRAg|EDCiv-RR)\b/i,
    /\bOJ[-_\s]?TST\b/i,
    /\b\d{1,7}-\d{2}\.\d{4}\.5\.\d{2}\.\d{4}\b/,
    /\b\d{7}\d{2}(?:19|20)\d{2}5\d{2}\d{4}\b/,
  ];

  protected getDefaultBaseUrl(): string {
    return "https://jurisprudencia-backend.tst.jus.br";
  }

  protected async fetchTstLegacy(
    query: string,
    options?: Partial<SearchJurisOptions>
  ): Promise<{ hits: RawJurisSearchResult[]; diagnostic: CourtDiagnostic }> {
    return super.searchWithDiagnostic(query, options);
  }

  public override async searchWithDiagnostic(
    query: string,
    options?: Partial<SearchJurisOptions>
  ): Promise<{
    hits: RawJurisSearchResult[];
    diagnostic: CourtDiagnostic;
    tst_triage?: TstTriageResult;
  }> {
    const mode: TstTriageMode =
      options?.triage_mode === "raw" || options?.triage_mode === "compare"
        ? options.triage_mode
        : "triaged";
    const legacy = await this.fetchTstLegacy(query, options);
    if (mode === "raw") return legacy;

    const { keptHits, triage } = triageTstPrecedents(legacy.hits, query, mode);
    return {
      hits: keptHits,
      diagnostic: { ...legacy.diagnostic, hits: keptHits.length },
      tst_triage: triage,
    };
  }

  private buildSearchPayload(queryTerm: string, tipos: string[]) {
    return {
      ou: "",
      e: queryTerm,
      termoExato: "",
      naoContem: "",
      ementa: "",
      dispositivo: "",
      numeracaoUnica: { numero: "", ano: "", digito: "", orgao: "5", tribunal: "", vara: "" },
      orgaosJudicantes: [],
      ministros: [],
      convocados: [],
      classesProcessuais: [],
      codigosClassesPrecedentes: [],
      indicadores: [],
      assuntos: [],
      tipos,
      orgao: "TST",
      publicacaoInicial: null,
      publicacaoFinal: null,
      julgamentoInicial: null,
      julgamentoFinal: null,
      ordenacao: null,
      tiposPaginacao: tipos,
    };
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const { cleanQuery } = sanitizeQueryForCourt(query);
    const rawTerm = cleanQuery || query;
    const normRef = parseTstNormativeRef(rawTerm);

    let tipos = ["ACORDAO"];
    let searchTerm = rawTerm;

    if (normRef?.kind === "SUM") {
      tipos = ["SUM"];
      searchTerm = normRef.numero;
    } else if (normRef?.kind === "OJ") {
      tipos = ["OJ"];
      searchTerm = normRef.numero;
    } else if (normRef?.kind === "ACORDAO") {
      tipos = ["ACORDAO"];
      searchTerm = normRef.queryTerm;
    } else if (/\bs[úu]mula\b/i.test(rawTerm)) {
      tipos = ["SUM", "ACORDAO"];
    } else if (/\boj\b|orienta[çc][aã]o\s+jurisprudencial/i.test(rawTerm)) {
      tipos = ["OJ", "ACORDAO"];
    }

    const endpoint = `${baseUrl}/rest/pesquisa-textual/1/${limit}?a=${Math.random().toFixed(4)}`;
    const res = await this.executeHttp(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(this.buildSearchPayload(searchTerm, tipos)),
      timeoutMs: ctx.timeoutMs,
    });

    this.assertHttpOk(res);
    let rawRecords = (res.data?.registros || []).map((r: any) => r.registro || r);
    if ((normRef?.kind === "SUM" || normRef?.kind === "OJ") && rawRecords.length > 1) {
      const exact = rawRecords.filter((r: any) => String(r?.numero || "") === normRef.numero);
      if (exact.length > 0) rawRecords = exact;
    }
    return rawRecords.map((r: any) => this.mapTstHitToResult(r));
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const normRef = parseTstNormativeRef(idOrRef);

    if (normRef && (normRef.kind === "SUM" || normRef.kind === "OJ")) {
      const searchEndpoint = `${baseUrl}/rest/pesquisa-textual/1/10?a=${Math.random().toFixed(4)}`;
      const searchRes = await this.executeHttp(searchEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(this.buildSearchPayload(normRef.numero, [normRef.kind])),
        timeoutMs: ctx.timeoutMs,
      });
      if (searchRes.status === 404) return null;
      this.assertHttpOk(searchRes);
      const recs = (searchRes.data?.registros || []).map((r: any) => r.registro || r);
      const match = recs.find((r: any) => String(r?.numero || "") === normRef.numero);
      if (!match) return null;
      return buildTstNormativeFetchResult(idOrRef, normRef.kind, match);
    }

    let tstUuid: string | undefined;
    let initialRecord: any = null;

    if (/^[a-f0-9]{32}$/i.test(idOrRef.trim())) {
      tstUuid = idOrRef.trim();
    } else {
      const cnj = parseCnjLaborRef(idOrRef);
      const cleanRef =
        normRef?.kind === "ACORDAO"
          ? normRef.queryTerm
          : idOrRef.replace(/^TST-/i, "").trim();
      const searchEndpoint = `${baseUrl}/rest/pesquisa-textual/1/5?a=${Math.random().toFixed(4)}`;
      const searchBody = cnj
        ? {
            ou: "",
            e: "",
            termoExato: "",
            naoContem: "",
            ementa: "",
            dispositivo: "",
            numeracaoUnica: {
              numero: cnj.numero,
              digito: cnj.digito,
              ano: cnj.ano,
              orgao: "5",
              tribunal: cnj.tribunal,
              vara: cnj.vara,
            },
            tipos: ["ACORDAO"],
            orgao: "TST",
          }
        : {
            ou: "",
            e: cleanRef,
            termoExato: "",
            naoContem: "",
            ementa: "",
            dispositivo: "",
            numeracaoUnica: {
              numero: "",
              ano: "",
              digito: "",
              orgao: "5",
              tribunal: "",
              vara: "",
            },
            tipos: ["ACORDAO"],
            orgao: "TST",
          };

      const searchRes = await this.executeHttp(searchEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(searchBody),
        timeoutMs: ctx.timeoutMs,
      });

      if (searchRes.status === 404) return null;
      this.assertHttpOk(searchRes);
      const firstRec =
        searchRes.data?.registros?.[0]?.registro || searchRes.data?.registros?.[0];
      if (firstRec && firstRec.id) {
        tstUuid = String(firstRec.id);
        initialRecord = firstRec;
      }
    }

    if (!tstUuid) return null;
    const docRes = await this.executeHttp(`${baseUrl}/rest/documentos/${tstUuid}`, {
      method: "GET",
      headers: { Accept: "text/html,application/xhtml+xml,text/plain,*/*" },
      timeoutMs: ctx.timeoutMs,
    });
    if (docRes.status === 404) return null;
    this.assertHttpOk(docRes);

    const htmlBody = docRes.body || (typeof docRes.data === "string" ? docRes.data : "");
    if (!htmlBody || htmlBody.length < 50) return null;
    return buildTstFetchResultFromHtml(idOrRef, tstUuid, initialRecord, htmlBody);
  }

  protected mapMockHitToResult(raw: any): RawJurisSearchResult {
    return this.mapTstHitToResult(raw);
  }

  private mapTstHitToResult(reg: any): RawJurisSearchResult {
    return mapTstRecordToResult(reg);
  }
}
