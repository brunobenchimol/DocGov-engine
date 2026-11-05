// ============================================================================
// Conector Oficial do Tribunal Superior do Trabalho (TST Provider)
// docgov-engine v1.4.2 — providers/tst_provider.ts
// Súmula 331, Terceirização, Tema 246 e Tema 1118 de Repercussão Geral
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
} from "./http_client.ts";
import { cleanHtmlAndNormalize } from "../anatomical_slicer.ts";

export class TstProvider implements JurisdictionProvider {
  public readonly courtId = "TST";
  public readonly tier = "FEDERAL" as const;
  public readonly defaultFederal = false;
  public readonly envOverrideKey = "DOCGOV_TST_BASE_URL";
  public readonly liveSmokeQuery =
    "terceirização responsabilidade subsidiária administração pública súmula 331";
  public readonly idPatterns = [
    /\bTST\b/i,
    /\b(?:AIRR|RR|E-RR|RO|Ag-AIRR|Ag-RR|ED-Ag-RR|Ag-RRAg|EDCiv-RR)\b/i,
    /\b\d{1,7}-\d{2}\.\d{4}\.5\.\d{2}\.\d{4}\b/,
    /\b\d{7}\d{2}(?:19|20)\d{2}5\d{2}\d{4}\b/,
  ];
  public readonly autoTriggerKeywords =
    /\b(terceiriza[çc][aã]o|s[úu]mula\s*331|responsabilidade\s+subsidi[áa]ria|encargos\s+trabalhistas|posto[s]?\s+de\s+trabalho|dedica[çc][aã]o\s+exclusiva|m[aã]o\s+de\s+obra|culpa\s+in\s+vigilando|tema\s*(?:246|1118)|pejotiza[çc][aã]o|aloca[çc][aã]o\s+de\s+profissionais)\b/i;

  private getBaseUrl(): string {
    if (process.env.DOCGOV_JURIS_BASE_URL) {
      return process.env.DOCGOV_JURIS_BASE_URL.replace(/\/+$/, "");
    }
    return (
      process.env.DOCGOV_TST_BASE_URL ||
      "https://jurisprudencia-backend.tst.jus.br"
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
    const limit = Math.min(options?.limit || 10, 20);
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    // 1. Modo Mock Server (.NET Assert 29)
    if (isMock) {
      const url = `${baseUrl}/search?court=TST&q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok) {
        return {
          hits: [],
          diagnostic: {
            court: "TST",
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
        : Array.isArray(data?.registros)
        ? data.registros.map((r: any) => r.registro || r)
        : [];

      const hits = rawHits.map((h: any) => this.mapTstHitToResult(h));
      return {
        hits,
        diagnostic: {
          court: "TST",
          status: "ok",
          hits: hits.length,
          latency_ms: res.latencyMs,
          error: null,
        },
      };
    }

    // 2. Modo Produção Oficial REST do TST
    const { cleanQuery } = sanitizeQueryForCourt(query);
    let queryTerm = cleanQuery || query;

    // Âncora contextual para evitar litígios trabalhistas estritamente privados
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

    const res = await executeJurisHttpRequest(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(bodyPayload),
      timeoutMs: 8000,
    });

    if (!res.ok || !res.data) {
      return {
        hits: [],
        diagnostic: {
          court: "TST",
          status: "error",
          hits: 0,
          latency_ms: res.latencyMs,
          error: res.error,
        },
      };
    }

    const rawRecords = res.data?.registros || [];
    const hits = rawRecords.map((r: any) =>
      this.mapTstHitToResult(r.registro || r)
    );

    return {
      hits,
      diagnostic: {
        court: "TST",
        status: "ok",
        hits: hits.length,
        latency_ms: res.latencyMs,
        error: null,
      },
    };
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const baseUrl = this.getBaseUrl();
    const isMock = !!process.env.DOCGOV_JURIS_BASE_URL;

    // 1. Modo Mock Server (.NET Assert 29)
    if (isMock) {
      const url = `${baseUrl}/fetch/${encodeURIComponent(idOrRef)}?court=TST`;
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
        court: "TST",
        exists: true,
        rawTextOrJson: item,
      };
    }

    // 2. Modo Produção Oficial TST REST
    let tstUuid: string | undefined;
    let initialRecord: any = null;

    // Se o identificador for um hash direto de 32 chars
    if (/^[a-f0-9]{32}$/i.test(idOrRef.trim())) {
      tstUuid = idOrRef.trim();
    } else {
      // Extrai numeração CNJ ou busca via pesquisa textual
      const cleanRef = idOrRef.replace(/^TST-/i, "").trim();
      const cnjMatch = cleanRef.match(
        /(\d{1,7})[-.](\d{2})[-.](\d{4})[-.]5[-.](\d{2})[-.](\d{4})/
      );

      const searchEndpoint = `${baseUrl}/rest/pesquisa-textual/1/5?a=${Math.random().toFixed(4)}`;
      let searchBody: any;

      if (cnjMatch) {
        searchBody = {
          ou: "",
          e: "",
          termoExato: "",
          naoContem: "",
          ementa: "",
          dispositivo: "",
          numeracaoUnica: {
            numero: parseInt(cnjMatch[1], 10),
            digito: parseInt(cnjMatch[2], 10),
            ano: parseInt(cnjMatch[3], 10),
            orgao: "5",
            tribunal: parseInt(cnjMatch[4], 10),
            vara: parseInt(cnjMatch[5], 10),
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
      } else {
        searchBody = {
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
      }

      const searchRes = await executeJurisHttpRequest(searchEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(searchBody),
        timeoutMs: 8000,
      });

      const firstRec = searchRes.data?.registros?.[0]?.registro;
      if (firstRec && firstRec.id) {
        tstUuid = firstRec.id;
        initialRecord = firstRec;
      }
    }

    if (!tstUuid) {
      return null;
    }

    // Baixa o HTML do inteiro teor
    const docEndpoint = `${baseUrl}/rest/documentos/${tstUuid}`;
    const docRes = await executeJurisHttpRequest(docEndpoint, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
      timeoutMs: 8000,
    });

    const htmlBody = docRes.body || (typeof docRes.data === "string" ? docRes.data : "");
    const cleanFullText = cleanHtmlAndNormalize(htmlBody);

    const mergedPayload = {
      ...(initialRecord || {}),
      tstUuid,
      inteiroTeorHtml: htmlBody,
      inteiroTeorTexto: cleanFullText,
      ementa: initialRecord?.ementa || cleanFullText.slice(0, 1500),
      dispositivo: initialRecord?.dispositivo || "",
    };

    return {
      id: idOrRef,
      court: "TST",
      exists: true,
      rawTextOrJson: mergedPayload,
    };
  }

  private mapTstHitToResult(reg: any): RawJurisSearchResult {
    const numFmt = reg.numFormatado ? String(reg.numFormatado).replace(/\s+/g, " ") : "";
    const canonicalNum = numFmt ? numFmt.replace(/\s+/g, "") : reg.numero || "S/N";
    const id = `TST-${canonicalNum}`;

    const dataSessao = reg.dtaJulgamento || reg.dtaPublicacao;
    const ano = dataSessao
      ? parseInt(String(dataSessao).slice(0, 4), 10)
      : reg.anoProc || 2024;

    const colegiado = reg.orgaoJudicante?.descricao || "Turma";
    const relator =
      reg.nomRelatorSemTratamento ||
      reg.nomRelator ||
      "Ministro Relator";

    // Extrai temas ou palavras-chave com resiliência a nulos
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
    const indexacao = tags.join("; ");

    const ementa = reg.ementa || reg.txtEmentaHighlight || "";
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
      entidade: reg.entidade || "ADMINISTRAÇÃO PÚBLICA",
      indexacao,
      tese,
      dispositivo,
      rawPayload: { ...reg, tstUuid: reg.id },
    };
  }
}
