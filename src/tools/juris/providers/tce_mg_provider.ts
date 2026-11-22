// ============================================================================
// Conector Oficial do Tribunal de Contas do Estado de Minas Gerais (TCE-MG)
// docgov-engine — providers/tce_mg_provider.ts (extends BaseJurisdictionProvider)
// Súmulas, Consultas Normativas, Decisões e Deliberações Plenárias (UF: "MG")
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
import { sanitizeQueryForCourt } from "./http_client.ts";
import { cleanHtmlAndNormalize } from "../anatomical_slicer.ts";
import {
  getTceMgCatalogItemById,
  searchTceMgCatalog,
  type TceMgNormativeItem,
} from "./tce_mg_catalog.ts";

export class TceMgProvider extends BaseJurisdictionProvider {
  public readonly courtId = "TCE-MG";
  public readonly tier = "STATE" as const;
  public readonly uf = "MG";
  public readonly defaultFederal = false;
  public readonly envOverrideKey = "DOCGOV_JURIS_TCEMG_URL";
  protected override readonly mockEnvKeys = [
    "DOCGOV_JURIS_TCEMG_URL",
    "DOCGOV_TCE_MG_BASE_URL",
  ];
  protected override readonly baseUrlEnvKeys = [
    "DOCGOV_JURIS_TCEMG_URL",
    "DOCGOV_TCE_MG_BASE_URL",
  ];
  protected override readonly mockFetchStyle = "query" as const;
  protected override readonly notFoundStyle = "exists_false" as const;
  protected override readonly defaultLiveTimeoutMs = 3500;
  protected override readonly defaultFetchTimeoutMs = 4500;

  public readonly liveSmokeQuery =
    "licitação parcelamento do objeto súmula 114 | consulta adesão ata carona";

  public readonly idPatterns = [
    /\b(?:SUMULA[-_]?TCEMG|TCE[-_]?MG[-_]SUMULA|SUMULA[-_]TCE[-_]?MG)[-_]\d{1,3}\b/i,
    /\bS[UÚ]MULA[-_]?\s*(?:N[Oº°]\s*)?(\d{1,3})\s*(?:DO\s*)?(?:TCE[-_]?MG|TCEMG)\b/i,
    /\bCONSULTA[-_]?(?:N[Oº°]\s*)?(\d{4,7})\s*(?:DO\s*)?(?:TCE[-_]?MG|TCEMG)?\b/i,
    /\b(?:CONSULTA|PROC|PROCESSO)[-_]?TCEMG[-_]\d{4,7}\b/i,
    /\bTCE[-_]?MG[-_]CONSULTA[-_]\d{4,7}\b/i,
    /\b(?:TCE[-_]?MG|TCEMG)[-_](?:ACORDAO|PROC|CONSULTA|DELIBERACAO|SUMULA)[-_][\w/-]+\b/i,
    /\bTCE[-_]?MG[-_]\d{1,7}\b/i,
    /\bTCE[-_]?MG\b/i,
    /\bTCEMG\b/i,
  ];

  public readonly autoTriggerKeywords =
    /\b(tce[- ]mg|tcemg|tribunal\s+de\s+contas\s+do\s+estado\s+de\s+minas\s+gerais|tribunal\s+de\s+contas\s+de\s+minas\s+gerais|s[úu]mula(?:s)?\s*(?:n[º°o]\s*)?\d{1,3}\s*(?:do\s*)?(?:tce[- ]mg|tcemg)|s[úu]mula(?:s)?\s+(?:tce[- ]mg|tcemg)\s*(?:n[º°o]\s*)?\d{1,3}|mapjuris|tcjuris|cemig|copasa|prodemge|lei\s+(?:estadual\s+)?14\.?184|decreto\s+(?:estadual\s+)?48\.?723|belo\s+horizonte|minas\s+gerais)\b/i;

  protected getDefaultBaseUrl(): string {
    return "https://tcjuris.tce.mg.gov.br";
  }

  protected override searchCatalog(query: string, limit: number): RawJurisSearchResult[] {
    return searchTceMgCatalog(query, limit).map((c) => this.mapCatalogItemToResult(c));
  }

  protected override shouldShortCircuitCatalog(query: string): boolean {
    return (
      /\bs[úu]mula\s*(?:n[º°o]\s*)?\d{1,3}\b/i.test(query) ||
      /\bconsulta\s*(?:n[º°o]\s*)?\d{4,7}\b/i.test(query)
    );
  }

  protected override findCatalogItemById(idOrRef: string): RawJurisFetchResult | null {
    const catItem = getTceMgCatalogItemById(idOrRef);
    if (!catItem) return null;
    return {
      id: catItem.id,
      court: "TCE-MG",
      exists: true,
      source: "CURATED_CATALOG",
      rawTextOrJson: {
        tribunal: "TCE-MG",
        colegiado: catItem.colegiado,
        numero: catItem.numero,
        ano: catItem.ano,
        relator: catItem.relator,
        dataSessao: catItem.dataSessao,
        entidade: catItem.entidade,
        regimeLegal: catItem.regimeLegal,
        indexacao: catItem.indexacao,
        tese: catItem.enunciado,
        dispositivo: catItem.dispositivo,
        historico: catItem.historico,
        fundamentacao: catItem.fundamentacao,
        fonteOficialUrl: catItem.fonteOficialUrl,
        inteiroTeorTexto: catItem.inteiroTeorTexto,
        outcome:
          catItem.dispositivo.toLowerCase().includes("vedad") ||
          catItem.dispositivo.toLowerCase().includes("irregular") ||
          catItem.dispositivo.toLowerCase().includes("nulidade")
            ? "PROCEDENTE_ANULACAO_DETERMINACAO"
            : "IMPROCEDENTE_MANUTENCAO_CERTAME",
      },
    };
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const { cleanQuery, shortQuery } = sanitizeQueryForCourt(query);
    const queryTerm = shortQuery || cleanQuery || query;
    const liveUrl = `${baseUrl}/Home/Busca`;

    const res = await this.executeHttp(liveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: `txtAssunto=${encodeURIComponent(queryTerm)}&page=1`,
      timeoutMs: ctx.timeoutMs,
    });
    this.assertHttpOk(res);

    if (typeof res.text === "string" && res.text.includes("Ocorreu um erro")) {
      throw new Error("Portal TCJuris retornou página de erro");
    }

    if (typeof res.text === "string") {
      return this.parseHtmlSearchResults(res.text, limit);
    }
    return [];
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    const procMatch = idOrRef.match(
      /^(?:TCE[-_]?MG[-_]?)?(?:PROC|PROCESSO|CONSULTA)[-_](\d{4,7})$/i
    );
    if (!procMatch) return null;

    const procNum = procMatch[1];
    const baseUrl = this.getBaseUrl();
    const detalhesUrl = `${baseUrl}/Home/Detalhes/${encodeURIComponent(procNum)}`;

    const res = await this.executeHttp(detalhesUrl, { timeoutMs: ctx.timeoutMs });
    if (res.status === 404) return null;
    this.assertHttpOk(res);

    if (typeof res.text === "string" && !res.text.includes("Ocorreu um erro")) {
      const parsed = this.parseHtmlProcessDetails(res.text, procNum);
      if (parsed) {
        return {
          id: `TCE-MG-PROC-${procNum}`,
          court: "TCE-MG",
          exists: true,
          source: "LIVE",
          rawTextOrJson: parsed,
        };
      }
    }
    return null;
  }

  private mapCatalogItemToResult(item: TceMgNormativeItem): RawJurisSearchResult {
    return {
      id: item.id,
      court: "TCE-MG",
      colegiado: item.colegiado,
      numero: item.numero,
      ano: item.ano,
      relator: item.relator,
      dataSessao: item.dataSessao,
      entidade: item.entidade,
      indexacao: item.indexacao.join("; "),
      tese: item.enunciado,
      dispositivo: item.dispositivo,
    };
  }

  protected mapMockHitToResult(hit: any): RawJurisSearchResult {
    return {
      id: hit.id || `TCE-MG-${hit.numero || "CONSULTA"}`,
      court: "TCE-MG",
      colegiado: hit.colegiado || "Tribunal Pleno",
      numero: hit.numero ? String(hit.numero) : undefined,
      ano: hit.ano ? Number(hit.ano) : undefined,
      processo: hit.processo,
      relator: hit.relator,
      dataSessao: hit.dataSessao,
      entidade: hit.entidade || "ORGAO_CONTRATANTE",
      indexacao: Array.isArray(hit.indexacao) ? hit.indexacao.join("; ") : hit.indexacao,
      tese: hit.tese || hit.enunciado || hit.sumario,
      dispositivo: hit.dispositivo,
      rawPayload: hit,
    };
  }

  private parseHtmlSearchResults(html: string, limit: number): RawJurisSearchResult[] {
    const results: RawJurisSearchResult[] = [];
    const blockRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(html)) !== null && results.length < limit) {
      const rowContent = match[1];
      const procMatch = rowContent.match(/\/Home\/Detalhes\/(\d{6,7})/i);
      if (!procMatch) continue;

      const procId = procMatch[1];
      const cleanRow = cleanHtmlAndNormalize(rowContent);
      const parts = cleanRow.split(/\s*\|\s*/);

      results.push({
        id: `TCE-MG-PROC-${procId}`,
        court: "TCE-MG",
        colegiado: "Tribunal Pleno",
        numero: procId,
        processo: procId,
        indexacao: "JURISPRUDÊNCIA TCE-MG; DELIBERAÇÃO PLENÁRIA",
        tese: cleanRow.slice(0, 300),
        dispositivo: parts[1] || cleanRow.slice(0, 200),
      });
    }

    return results;
  }

  private parseHtmlProcessDetails(html: string, procNum: string): any {
    const cleanText = cleanHtmlAndNormalize(html);
    if (!cleanText || cleanText.length < 50) return null;

    const relatorMatch = cleanText.match(/Relator:\s*([^\n\r.]+)/i);
    const dataMatch = cleanText.match(/Data\s*(?:da\s*Sess[ãa]o)?:\s*(\d{2}\/\d{2}\/\d{4})/i);

    return {
      tribunal: "TCE-MG",
      colegiado: "Tribunal Pleno",
      numero: procNum,
      processo: procNum,
      relator: relatorMatch ? relatorMatch[1].trim() : "Tribunal Pleno",
      dataSessao: dataMatch ? dataMatch[1] : undefined,
      entidade: "ORGAO_CONTRATANTE",
      regimeLegal: "LEI_14133_ADM_DIRETA",
      indexacao: ["JURISPRUDÊNCIA TCE-MG", "CONSULTA/DELIBERAÇÃO"],
      tese: cleanText.slice(0, 500),
      dispositivo: cleanText.slice(0, 300),
      inteiroTeorTexto: cleanText,
      outcome: cleanText.toLowerCase().includes("irregular")
        ? "PROCEDENTE_ANULACAO_DETERMINACAO"
        : "IMPROCEDENTE_MANUTENCAO_CERTAME",
    };
  }
}
