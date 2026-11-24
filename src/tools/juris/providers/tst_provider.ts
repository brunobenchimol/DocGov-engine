// ============================================================================
// Conector Oficial do Tribunal Superior do Trabalho (TST Provider)
// docgov-engine — providers/tst_provider.ts (extends BaseJurisdictionProvider)
// Súmula 331, OJ 191, Súmula 363, Tema 246 e Tema 1118 de Repercussão Geral
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
import { cleanHtmlAndNormalize } from "../anatomical_slicer.ts";
import { triageTstPrecedents } from "../tst_precedent_triage.ts";
import {
  getTstCatalogItemById,
  mapTstCatalogItemToFetch,
  searchTstCatalog,
} from "./tst_catalog.ts";

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

  protected override searchCatalog(query: string, limit: number): RawJurisSearchResult[] {
    return searchTstCatalog(query, limit);
  }

  protected override shouldShortCircuitCatalog(query: string): boolean {
    return /\b(s[úu]mula\s*(?:n[º°o]\s*)?(?:331|363)|oj\s*(?:n[º°o]\s*)?191|tema\s*(?:246|1\.?118))\b/i.test(
      query
    ) && !/\b(AIRR|RR|E-RR|Ag-AIRR)\b/i.test(query);
  }

  protected override findCatalogItemById(idOrRef: string): RawJurisFetchResult | null {
    const item = getTstCatalogItemById(idOrRef);
    return item ? mapTstCatalogItemToFetch(item) : null;
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const { cleanQuery } = sanitizeQueryForCourt(query);
    let queryTerm = cleanQuery || query;

    const hasAdminContext =
      /\b(administra[çc][aã]o\s+p[úu]blica|ente\s+p[úu]blico|estatal|subsidi[áa]ria|331|licita[çc][aã]o|13\.?303|14\.?133|8\.?666|terceiriza[çc][aã]o)\b/i.test(
        queryTerm
      );
    if (!hasAdminContext) {
      queryTerm = `${queryTerm} administração pública terceirização`;
    }

    const endpoint = `${baseUrl}/rest/pesquisa-textual/1/${limit}?a=${Math.random().toFixed(4)}`;
    const bodyPayload = {
      ou: "",
      e: queryTerm,
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
      orgaosJudicantes: [],
      ministros: [],
      convocados: [],
      classesProcessuais: [],
      codigosClassesPrecedentes: [],
      indicadores: [],
      assuntos: [],
      tipos: ["ACORDAO"],
      orgao: "TST",
      publicacaoInicial: null,
      publicacaoFinal: null,
      julgamentoInicial: null,
      julgamentoFinal: null,
      ordenacao: null,
      tiposPaginacao: ["ACORDAO"],
    };

    const res = await this.executeHttp(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(bodyPayload),
      timeoutMs: ctx.timeoutMs,
    });

    this.assertHttpOk(res);
    const rawRecords = res.data?.registros || [];
    return rawRecords.map((r: any) => this.mapTstHitToResult(r.registro || r));
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    let tstUuid: string | undefined;
    let initialRecord: any = null;

    if (/^[a-f0-9]{32}$/i.test(idOrRef.trim())) {
      tstUuid = idOrRef.trim();
    } else {
      const cnj = this.parseCnjLabor(idOrRef);
      const cleanRef = idOrRef.replace(/^TST-/i, "").trim();
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
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(searchBody),
        timeoutMs: ctx.timeoutMs,
      });

      if (searchRes.status === 404) return null;
      this.assertHttpOk(searchRes);

      const firstRec = searchRes.data?.registros?.[0]?.registro;
      if (firstRec && firstRec.id) {
        tstUuid = firstRec.id;
        initialRecord = firstRec;
      }
    }

    if (!tstUuid) return null;

    const docEndpoint = `${baseUrl}/rest/documentos/${tstUuid}`;
    const docRes = await this.executeHttp(docEndpoint, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
      timeoutMs: ctx.timeoutMs,
    });

    if (docRes.status === 404) return null;
    this.assertHttpOk(docRes);

    const htmlBody =
      docRes.body || (typeof docRes.data === "string" ? docRes.data : "");
    if (!htmlBody || htmlBody.length < 50) return null;

    return this.buildFetchResultFromHtml(idOrRef, tstUuid, initialRecord, htmlBody);
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
    const relatorioText = relatorioMatch ? relatorioMatch[0].trim() : undefined;

    const votoMatch = cleanFullText.match(
      /(?:V\s*O\s*T\s*O|FUNDAMENTAÇÃO|I\s*-\s*CONHECIMENTO)([\s\S]*?)(?=ISTO\s+POSTO|ACORDAM|$)/i
    );
    const votoText = votoMatch ? votoMatch[0].trim() : cleanFullText;

    const dispositivoMatch = cleanFullText.match(
      /(?:ISTO\s+POSTO[\s\S]*?)?(?:ACORDAM[\s\S]*?)(?=(?:Bras[íi]lia|Firmado\s+por|\n\s*Ministr[oa]|$))/i
    );
    const dispositivoText = dispositivoMatch
      ? dispositivoMatch[0].trim()
      : initialRecord?.dispositivo || undefined;

    const numFmt = initialRecord?.numFormatado
      ? String(initialRecord.numFormatado).replace(/\s+/g, " ")
      : idOrRef;
    const canonicalNum = numFmt.replace(/\s+/g, "");
    const relator =
      initialRecord?.nomRelatorSemTratamento ||
      initialRecord?.nomRelator ||
      "Ministro Relator";
    const colegiado = initialRecord?.orgaoJudicante?.descricao || "Turma";
    const dataSessao =
      initialRecord?.dtaJulgamento || initialRecord?.dtaPublicacao;
    const ano = dataSessao
      ? parseInt(String(dataSessao).slice(0, 4), 10)
      : initialRecord?.anoProc || new Date().getFullYear();
    const ementaText =
      initialRecord?.ementa ||
      initialRecord?.txtEmentaHighlight ||
      cleanFullText.slice(0, 1500);

    const mergedPayload = {
      ...(initialRecord || {}),
      id: `TST-${canonicalNum}`,
      numero: initialRecord?.numero ? String(initialRecord.numero) : canonicalNum,
      processo: numFmt,
      colegiado,
      relator,
      dataSessao,
      ano,
      ementa: ementaText,
      tese: ementaText,
      relatorio: relatorioText,
      voto: votoText,
      acordao: dispositivoText,
      dispositivo: dispositivoText,
      inteiroTeorHtml: htmlBody,
      inteiroTeorTexto: cleanFullText,
      rawText: cleanFullText,
      rawPayload: { ...(initialRecord || {}), tstUuid },
    };

    return {
      id: idOrRef,
      court: "TST",
      exists: true,
      source: "LIVE",
      rawTextOrJson: mergedPayload,
    };
  }

  private parseCnjLabor(ref: string): {
    numero: string;
    digito: string;
    ano: string;
    orgao: string;
    tribunal: string;
    vara: string;
    standardFormatted: string;
  } | null {
    const clean = ref.trim().replace(/^TST[-_]/i, "");

    const punctMatch = clean.match(
      /\b(\d{1,7})[-.](\d{2})[-.](\d{4})[-.]5[-.](\d{2})[-.](\d{4})\b/
    );
    if (punctMatch) {
      const numero = parseInt(punctMatch[1], 10).toString();
      const digito = punctMatch[2];
      const ano = punctMatch[3];
      const tribunal = punctMatch[4].padStart(2, "0");
      const vara = punctMatch[5].padStart(4, "0");
      return {
        numero,
        digito,
        ano,
        orgao: "5",
        tribunal,
        vara,
        standardFormatted: `${numero}-${digito}.${ano}.5.${tribunal}.${vara}`,
      };
    }

    const pure20Match = clean.match(
      /\b(\d{7})(\d{2})((?:19|20)\d{2})(5)(\d{2})(\d{4})\b/
    );
    if (pure20Match) {
      const numero = parseInt(pure20Match[1], 10).toString();
      const digito = pure20Match[2];
      const ano = pure20Match[3];
      const tribunal = pure20Match[5].padStart(2, "0");
      const vara = pure20Match[6].padStart(4, "0");
      return {
        numero,
        digito,
        ano,
        orgao: "5",
        tribunal,
        vara,
        standardFormatted: `${numero}-${digito}.${ano}.5.${tribunal}.${vara}`,
      };
    }

    return null;
  }

  protected mapMockHitToResult(raw: any): RawJurisSearchResult {
    return this.mapTstHitToResult(raw);
  }

  private mapTstHitToResult(reg: any): RawJurisSearchResult {
    const numFmt = reg.numFormatado ? String(reg.numFormatado).replace(/\s+/g, " ") : "";
    const canonicalNum = numFmt ? numFmt.replace(/\s+/g, "") : reg.numero || "S/N";
    const id = reg.id && /^TST-/i.test(String(reg.id)) ? String(reg.id) : `TST-${canonicalNum}`;

    const dataSessao = reg.dtaJulgamento || reg.dtaPublicacao;
    const ano = dataSessao
      ? parseInt(String(dataSessao).slice(0, 4), 10)
      : reg.anoProc || 2024;

    const colegiado = reg.orgaoJudicante?.descricao || reg.colegiado || "Turma";
    const relator =
      reg.nomRelatorSemTratamento ||
      reg.nomRelator ||
      reg.relator ||
      "Ministro Relator";

    const tags: string[] = [];
    if (Array.isArray(reg.temaProcs)) {
      for (const t of reg.temaProcs) {
        if (t && typeof t === "object" && t.desTemaProc) tags.push(t.desTemaProc);
      }
    }
    if (Array.isArray(reg.indicadores)) {
      for (const ind of reg.indicadores) {
        if (ind && typeof ind === "object" && ind.desIndicador) tags.push(ind.desIndicador);
      }
    }
    const indexacao = tags.join("; ") || reg.indexacao || "";

    const ementa = reg.ementa || reg.txtEmentaHighlight || reg.tese || "";
    const tese = typeof ementa === "string" ? cleanHtmlAndNormalize(ementa) : ementa;
    const dispositivo = reg.dispositivo ? cleanHtmlAndNormalize(reg.dispositivo) : undefined;

    return {
      id,
      court: "TST",
      colegiado,
      numero: String(reg.numero || reg.numProc || ""),
      ano,
      processo: numFmt || `TST ${canonicalNum}`,
      relator,
      dataSessao,
      entidade: reg.entidade || "ORGAO_CONTRATANTE",
      indexacao,
      tese,
      dispositivo,
      rawPayload: { ...reg, tstUuid: reg.id },
    };
  }
}
