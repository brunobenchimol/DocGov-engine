// ============================================================================
// Conector Oficial do Tribunal Superior do Trabalho (TST Provider)
// docgov-engine v1.7.3 — providers/tst_provider.ts (Cache Dinâmico TTL 24h)
// ============================================================================

import type {
  CourtDiagnostic,
  FetchProviderOptions,
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
import { cleanHtmlAndNormalize } from "../anatomical_slicer.ts";
import { triageTstPrecedents } from "../tst_precedent_triage.ts";
import { parseTstNormativeRef } from "./tst_catalog.ts";
import { readTstTtlCache, writeTstTtlCache } from "./tst_ttl_cache.ts";

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
  public readonly autoTriggerKeywords =
    /\b(terceiriza[çc][aã]o|s[úu]mula\s*331|oj\s*191|dono\s+da\s+obra|responsabilidade\s+subsidi[áa]ria|encargos\s+trabalhistas|posto[s]?\s+de\s+trabalho|dedica[çc][aã]o\s+exclusiva|m[aã]o\s+de\s+obra|culpa\s+in\s+vigilando|tema\s*(?:246|1\.?118)|pejotiza[çc][aã]o|aloca[çc][aã]o\s+de\s+profissionais)\b/i;

  protected getDefaultBaseUrl(): string {
    return "https://jurisprudencia-backend.tst.jus.br";
  }

  private shouldUseTtlCache(): boolean {
    return !this.isMockMode() || Boolean(process.env.DOCGOV_JURIS_CACHE_DIR?.trim());
  }

  protected async fetchTstLegacy(
    query: string,
    options?: Partial<SearchJurisOptions>
  ): Promise<{ hits: RawJurisSearchResult[]; diagnostic: CourtDiagnostic }> {
    const limit = Math.min(options?.limit || 10, 20);
    const forceLive = options?.force_live === true;
    const startMs = Date.now();
    const useCache = this.shouldUseTtlCache();
    const cacheKey = `${query}|${limit}`;

    if (useCache && !forceLive) {
      const cached = readTstTtlCache<RawJurisSearchResult[]>("search", cacheKey);
      if (cached) {
        const hits = cached.payload.map((h) => ({ ...h, origin: "LIVE" as const }));
        return {
          hits,
          diagnostic: {
            court: "TST",
            status: "ok",
            hits: hits.length,
            latency_ms: Math.max(0, Date.now() - startMs),
            error: null,
            source_mode: "LIVE",
            live_error: null,
            cache_hit: true,
            fetched_at: new Date(cached.fetched_at).toISOString(),
          },
        };
      }
    }

    const timeoutMs = forceLive ? this.forceLiveTimeoutMs : this.defaultLiveTimeoutMs;
    try {
      const rawHits = this.isMockMode()
        ? await this.executeMockSearchOnly(query, limit, timeoutMs)
        : await this.executeLiveSearch(query, limit, { timeoutMs, options });
      const hits = rawHits.map((h) => ({ ...h, origin: "LIVE" as const }));
      if (useCache) {
        writeTstTtlCache("search", cacheKey, hits);
      }
      return {
        hits,
        diagnostic: {
          court: "TST",
          status: "ok",
          hits: hits.length,
          latency_ms: Math.max(0, Date.now() - startMs),
          error: null,
          source_mode: "LIVE",
          live_error: null,
        },
      };
    } catch (err: any) {
      const liveError = err?.message || String(err);
      return {
        hits: [],
        diagnostic: {
          court: "TST",
          status: "error",
          hits: 0,
          latency_ms: Math.max(0, Date.now() - startMs),
          error: liveError,
          source_mode: "LIVE_FAILED",
          live_error: liveError,
        },
      };
    }
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

  public override async fetch(
    idOrRef: string,
    options?: FetchProviderOptions
  ): Promise<RawJurisFetchResult | null> {
    const forceLive = options?.force_live === true;
    const useCache = this.shouldUseTtlCache();

    if (useCache && !forceLive) {
      const cached = readTstTtlCache<RawJurisFetchResult>("fetch", idOrRef);
      if (cached) {
        return {
          ...cached.payload,
          source: "LIVE",
          cache_hit: true,
          fetched_at: new Date(cached.fetched_at).toISOString(),
        };
      }
    }

    const timeoutMs = forceLive ? this.forceLiveTimeoutMs : this.defaultFetchTimeoutMs;
    try {
      const res = this.isMockMode()
        ? await this.executeMockFetchOnly(idOrRef, timeoutMs)
        : await this.executeLiveFetch(idOrRef, { timeoutMs, forceLive });

      if (!res || !res.exists) return null;
      const normalized: RawJurisFetchResult = { ...res, source: "LIVE" };
      if (useCache) {
        writeTstTtlCache("fetch", idOrRef, normalized);
      }
      return normalized;
    } catch (err: any) {
      const liveError = err?.message || String(err);
      throw new Error(
        `[LIVE_UNAVAILABLE] Falha ao consultar '${idOrRef}' no TST sem cache TTL 24h válido: ${liveError}`
      );
    }
  }

  private async executeMockSearchOnly(
    query: string,
    limit: number,
    timeoutMs: number
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/search?court=TST&q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await this.executeHttp(url, { timeoutMs });
    this.assertHttpOk(res);
    const data = res.data;
    const rawHits = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.registros)
      ? data.registros.map((r: any) => r.registro || r)
      : [];
    return rawHits.slice(0, limit).map((h: any) => this.mapMockHitToResult(h));
  }

  private async executeMockFetchOnly(
    idOrRef: string,
    timeoutMs: number
  ): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=TST`;
    const res = await this.executeHttp(url, { timeoutMs });
    if (res.status === 404 || res.status === 400) return null;
    this.assertHttpOk(res);
    const data = res.data;
    if (!data || (typeof data === "object" && data.exists === false)) return null;
    const item =
      typeof data === "object" && data.exists === true && data.rawTextOrJson
        ? data.rawTextOrJson
        : Array.isArray(data)
        ? data[0]
        : Array.isArray(data?.items)
        ? data.items[0]
        : data;
    if (!item) return null;
    return {
      id: (typeof data === "object" && data.id) || idOrRef,
      court: "TST",
      exists: true,
      source: "LIVE",
      rawTextOrJson: item,
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
      return this.buildNormativeFetchResult(idOrRef, normRef.kind, match);
    }

    let tstUuid: string | undefined;
    let initialRecord: any = null;

    if (/^[a-f0-9]{32}$/i.test(idOrRef.trim())) {
      tstUuid = idOrRef.trim();
    } else {
      const cnj = this.parseCnjLabor(idOrRef);
      const cleanRef = normRef?.kind === "ACORDAO" ? normRef.queryTerm : idOrRef.replace(/^TST-/i, "").trim();
      const searchEndpoint = `${baseUrl}/rest/pesquisa-textual/1/5?a=${Math.random().toFixed(4)}`;
      const searchBody = cnj
        ? {
            ou: "", e: "", termoExato: "", naoContem: "", ementa: "", dispositivo: "",
            numeracaoUnica: { numero: cnj.numero, digito: cnj.digito, ano: cnj.ano, orgao: "5", tribunal: cnj.tribunal, vara: cnj.vara },
            tipos: ["ACORDAO"], orgao: "TST",
          }
        : {
            ou: "", e: cleanRef, termoExato: "", naoContem: "", ementa: "", dispositivo: "",
            numeracaoUnica: { numero: "", ano: "", digito: "", orgao: "5", tribunal: "", vara: "" },
            tipos: ["ACORDAO"], orgao: "TST",
          };

      const searchRes = await this.executeHttp(searchEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(searchBody),
        timeoutMs: ctx.timeoutMs,
      });

      if (searchRes.status === 404) return null;
      this.assertHttpOk(searchRes);
      const firstRec = searchRes.data?.registros?.[0]?.registro || searchRes.data?.registros?.[0];
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
    return this.buildFetchResultFromHtml(idOrRef, tstUuid, initialRecord, htmlBody);
  }

  private buildNormativeFetchResult(
    idOrRef: string,
    kind: "SUM" | "OJ",
    rec: any
  ): RawJurisFetchResult {
    const mapped = this.mapTstHitToResult(rec);
    const titulo = cleanHtmlAndNormalize(rec.titulo || "");
    const tese = cleanHtmlAndNormalize(rec.tese || "");
    const obs = cleanHtmlAndNormalize(rec.observacao || "");
    const hist = cleanHtmlAndNormalize(rec.historico || "");
    const sit = rec.situacao?.descricao ? `Situação: ${rec.situacao.descricao}` : "";
    const fullText = [titulo, sit, tese, obs ? `Observação: ${obs}` : "", hist ? `Histórico: ${hist}` : ""]
      .filter(Boolean)
      .join("\n\n");

    return {
      id: idOrRef,
      court: "TST",
      exists: true,
      source: "LIVE",
      rawTextOrJson: {
        ...rec,
        id: mapped.id,
        tribunal: "TST",
        numero: String(rec.numero || mapped.numero),
        ano: mapped.ano,
        processo: mapped.id,
        colegiado: mapped.colegiado,
        relator: kind === "SUM" ? "Tribunal Pleno TST" : "SBDI-1 TST",
        dataSessao: mapped.dataSessao,
        entidade: "NAO_INFORMADA",
        indexacao: mapped.indexacao,
        ementa: mapped.tese,
        tese: mapped.tese,
        voto: [obs, hist].filter(Boolean).join("\n\n") || tese,
        dispositivo: sit || titulo || tese,
        inteiroTeorTexto: fullText,
        rawText: fullText,
      },
    };
  }

  private buildFetchResultFromHtml(
    idOrRef: string,
    tstUuid: string,
    initialRecord: any,
    htmlBody: string
  ): RawJurisFetchResult {
    const cleanFullText = cleanHtmlAndNormalize(htmlBody);
    const relatorioMatch = cleanFullText.match(
      /(?:R\s*E\s*L\s*A\s*T\s*Ó\s*R\s*I\s*O|Vistos,\s*relatados[\s\S]*?)([\s\S]*?)(?=V\s*O\s*T\s*O|I\s*-\s*CONHECIMENTO|FUNDAMENTAÇÃO|ISTO\s+POSTO|ACORDAM|$)/i
    );
    const votoMatch = cleanFullText.match(
      /(?:V\s*O\s*T\s*O|FUNDAMENTAÇÃO|I\s*-\s*CONHECIMENTO)([\s\S]*?)(?=ISTO\s+POSTO|ACORDAM|$)/i
    );
    const dispositivoMatch = cleanFullText.match(
      /(?:ISTO\s+POSTO[\s\S]*?)?(?:ACORDAM[\s\S]*?)(?=(?:Bras[íi]lia|Firmado\s+por|\n\s*Ministr[oa]|$))/i
    );

    const numFmt = initialRecord?.numFormatado ? String(initialRecord.numFormatado).replace(/\s+/g, " ") : idOrRef;
    const canonicalNum = numFmt.replace(/\s+/g, "");
    const dataSessao = initialRecord?.dtaJulgamento || initialRecord?.dtaPublicacao;
    const ano = dataSessao ? parseInt(String(dataSessao).slice(0, 4), 10) : initialRecord?.anoProc || new Date().getFullYear();
    const ementaText = initialRecord?.ementa || initialRecord?.txtEmentaHighlight || cleanFullText.slice(0, 1500);

    return {
      id: idOrRef,
      court: "TST",
      exists: true,
      source: "LIVE",
      rawTextOrJson: {
        ...(initialRecord || {}),
        id: `TST-${canonicalNum}`,
        numero: initialRecord?.numero ? String(initialRecord.numero) : canonicalNum,
        processo: numFmt,
        colegiado: initialRecord?.orgaoJudicante?.descricao || "Turma",
        relator: initialRecord?.nomRelatorSemTratamento || initialRecord?.nomRelator || "Ministro Relator",
        dataSessao,
        ano,
        entidade: initialRecord?.entidade || "NAO_INFORMADA",
        ementa: ementaText,
        tese: ementaText,
        relatorio: relatorioMatch ? relatorioMatch[0].trim() : undefined,
        voto: votoMatch ? votoMatch[0].trim() : cleanFullText,
        acordao: dispositivoMatch ? dispositivoMatch[0].trim() : initialRecord?.dispositivo,
        dispositivo: dispositivoMatch ? dispositivoMatch[0].trim() : initialRecord?.dispositivo,
        inteiroTeorHtml: htmlBody,
        inteiroTeorTexto: cleanFullText,
        rawText: cleanFullText,
        rawPayload: { ...(initialRecord || {}), tstUuid },
      },
    };
  }

  private parseCnjLabor(ref: string) {
    const clean = ref.trim().replace(/^TST[-_]/i, "");
    const punctMatch = clean.match(/\b(\d{1,7})[-.](\d{2})[-.](\d{4})[-.]5[-.](\d{2})[-.](\d{4})\b/);
    if (punctMatch) {
      return {
        numero: parseInt(punctMatch[1], 10).toString(),
        digito: punctMatch[2],
        ano: punctMatch[3],
        orgao: "5",
        tribunal: punctMatch[4].padStart(2, "0"),
        vara: punctMatch[5].padStart(4, "0"),
      };
    }
    const pure20Match = clean.match(/\b(\d{7})(\d{2})((?:19|20)\d{2})(5)(\d{2})(\d{4})\b/);
    if (pure20Match) {
      return {
        numero: parseInt(pure20Match[1], 10).toString(),
        digito: pure20Match[2],
        ano: pure20Match[3],
        orgao: "5",
        tribunal: pure20Match[5].padStart(2, "0"),
        vara: pure20Match[6].padStart(4, "0"),
      };
    }
    return null;
  }

  protected mapMockHitToResult(raw: any): RawJurisSearchResult {
    return this.mapTstHitToResult(raw);
  }

  private mapTstHitToResult(reg: any): RawJurisSearchResult {
    const tipoCode = String(reg.tipo?.codigoTipoJurisprudencia || reg.tipo || "").toUpperCase();
    const dataSessao = reg.dtaJulgamento || reg.dtaPublicacao || reg.dataPublicacao;
    const ano = dataSessao ? parseInt(String(dataSessao).slice(0, 4), 10) : reg.anoProc || new Date().getFullYear();

    if (tipoCode === "SUM" || tipoCode === "OJ") {
      const numStr = String(reg.numero || "").trim();
      const orgaoDesc = reg.orgaoJudicante?.descricao || (tipoCode === "SUM" ? "Tribunal Pleno" : "SBDI-1");
      const isSdi1 = /subse[çc][ãa]o\s+i\b|sbdi[-_\s]?1/i.test(orgaoDesc);
      const id =
        tipoCode === "SUM"
          ? numStr ? `SUMULA-TST-${numStr}` : `SUMULA-TST-${reg.id}`
          : numStr ? (isSdi1 ? `OJ-TST-SDI1-${numStr}` : `OJ-TST-${numStr}`) : `OJ-TST-${reg.id}`;
      const titulo = cleanHtmlAndNormalize(reg.titulo || "");
      const sit = reg.situacao?.descricao ? `Situação: ${reg.situacao.descricao}` : "";
      const obs = cleanHtmlAndNormalize(reg.observacao || "");
      const teseClean = cleanHtmlAndNormalize(reg.tese || reg.teseHighlight || "");
      return {
        id,
        court: "TST",
        colegiado: orgaoDesc,
        numero: numStr,
        ano,
        processo: id,
        relator: tipoCode === "SUM" ? "Tribunal Pleno TST" : orgaoDesc,
        dataSessao,
        entidade: reg.entidade || "NAO_INFORMADA",
        indexacao: [titulo, sit].filter(Boolean).join("; "),
        tese: [titulo, teseClean, obs ? `Observação: ${obs}` : ""].filter(Boolean).join(" — "),
        dispositivo: sit || titulo || undefined,
        rawPayload: { ...reg },
      };
    }

    const numFmt = reg.numFormatado ? String(reg.numFormatado).replace(/\s+/g, " ") : "";
    const canonicalNum = numFmt ? numFmt.replace(/\s+/g, "") : reg.numero || "S/N";
    const id = reg.id && /^TST-/i.test(String(reg.id)) ? String(reg.id) : `TST-${canonicalNum}`;
    const tags: string[] = [];
    if (Array.isArray(reg.temaProcs)) {
      for (const t of reg.temaProcs) if (t && typeof t === "object" && t.desTemaProc) tags.push(t.desTemaProc);
    }
    if (Array.isArray(reg.indicadores)) {
      for (const ind of reg.indicadores) if (ind && typeof ind === "object" && ind.desIndicador) tags.push(ind.desIndicador);
    }
    const ementa = reg.ementa || reg.txtEmentaHighlight || reg.tese || "";
    return {
      id,
      court: "TST",
      colegiado: reg.orgaoJudicante?.descricao || reg.colegiado || "Turma",
      numero: String(reg.numero || reg.numProc || ""),
      ano,
      processo: numFmt || `TST ${canonicalNum}`,
      relator: reg.nomRelatorSemTratamento || reg.nomRelator || reg.relator || "Ministro Relator",
      dataSessao,
      entidade: reg.entidade || "NAO_INFORMADA",
      indexacao: tags.join("; ") || reg.indexacao || "",
      tese: typeof ementa === "string" ? cleanHtmlAndNormalize(ementa) : ementa,
      dispositivo: reg.dispositivo ? cleanHtmlAndNormalize(reg.dispositivo) : undefined,
      rawPayload: { ...reg, tstUuid: reg.id },
    };
  }
}
