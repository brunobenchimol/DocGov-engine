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

    // 1. Formato pontuado (ex.: 959-81.2015.5.05.0033 ou 0000959-81.2015.5.05.0033)
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

    // 2. Formato 20 dígitos puros (ex.: 00009598120155050033)
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

      const searchRes = await executeJurisHttpRequest(searchEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(searchBody),
        timeoutMs: 10000,
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
      timeoutMs: 12000,
    });

    const htmlBody =
      docRes.body || (typeof docRes.data === "string" ? docRes.data : "");
    if (!htmlBody || htmlBody.length < 50) {
      return null;
    }
    const cleanFullText = cleanHtmlAndNormalize(htmlBody);

    // Extrai seções com suporte à tipografia forense brasileira (letras espaçadas)
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

    // Metadados reais
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
