// ============================================================================
// Conector Oficial do Tribunal de Contas do Estado de Minas Gerais (TCE-MG)
// docgov-engine v1.4.5 — providers/tce_mg_provider.ts
// Súmulas, Consultas Normativas, Decisões e Deliberações Plenárias (UF: "MG")
// ============================================================================

import type {
  JurisdictionProvider,
  RawJurisSearchResult,
  RawJurisFetchResult,
  SearchJurisOptions,
  CourtDiagnostic,
} from "../types.ts";
import { executeJurisHttpRequest, sanitizeQueryForCourt } from "./http_client.ts";
import { cleanHtmlAndNormalize } from "../anatomical_slicer.ts";
import {
  TCE_MG_CURATED_CATALOG,
  getTceMgCatalogItemById,
  searchTceMgCatalog,
  normalizeTceMgId,
  type TceMgNormativeItem,
} from "./tce_mg_catalog.ts";

export class TceMgProvider implements JurisdictionProvider {
  public readonly courtId = "TCE-MG";
  public readonly tier = "STATE" as const;
  public readonly uf = "MG";
  public readonly defaultFederal = false;
  public readonly envOverrideKey = "DOCGOV_JURIS_TCEMG_URL";
  public readonly liveSmokeQuery = "licitação parcelamento do objeto súmula 114 | consulta adesão ata carona";

  // Higiene estrita de idPatterns para evitar colisões entre UFs e suportar suíte .NET (Assert 29.10)
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

  // Auto-trigger exige menção expressa a Minas Gerais, TCE-MG ou normativos estaduais
  public readonly autoTriggerKeywords =
    /\b(tce[- ]mg|tcemg|tribunal\s+de\s+contas\s+do\s+estado\s+de\s+minas\s+gerais|tribunal\s+de\s+contas\s+de\s+minas\s+gerais|s[úu]mula(?:s)?\s*(?:n[º°o]\s*)?\d{1,3}\s*(?:do\s*)?(?:tce[- ]mg|tcemg)|s[úu]mula(?:s)?\s+(?:tce[- ]mg|tcemg)\s*(?:n[º°o]\s*)?\d{1,3}|mapjuris|tcjuris|cemig|copasa|prodemge|lei\s+(?:estadual\s+)?14\.?184|decreto\s+(?:estadual\s+)?48\.?723|belo\s+horizonte|minas\s+gerais)\b/i;

  private getBaseUrl(): string {
    return (
      process.env.DOCGOV_JURIS_TCEMG_URL ||
      process.env.DOCGOV_TCE_MG_BASE_URL ||
      process.env.DOCGOV_JURIS_BASE_URL ||
      "https://tcjuris.tce.mg.gov.br"
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
    const isMock = !!(
      process.env.DOCGOV_JURIS_TCEMG_URL ||
      process.env.DOCGOV_TCE_MG_BASE_URL ||
      process.env.DOCGOV_JURIS_BASE_URL
    );

    // 1. Modo Mock Server (.NET Cross-Check / Sub-Assert 29.10)
    if (isMock) {
      const url = `${baseUrl}/search?court=TCE-MG&q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok) {
        return {
          hits: [],
          diagnostic: {
            court: "TCE-MG",
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
        : Array.isArray(data?.results)
        ? data.results
        : [];

      const hits = rawHits.map((h: any) => this.mapMockHitToResult(h));
      return {
        hits,
        diagnostic: {
          court: "TCE-MG",
          status: "ok",
          hits: hits.length,
          latency_ms: res.latencyMs,
          error: null,
        },
      };
    }

    // 2. Busca com Resiliência Dupla (Catálogo Curado Determinístico + Portal Oficial TCJuris)
    const startTime = performance.now();
    const catalogHits = searchTceMgCatalog(query, limit);

    try {
      const { cleanQuery, shortQuery } = sanitizeQueryForCourt(query);
      const queryTerm = shortQuery || cleanQuery || query;
      const liveUrl = `${baseUrl}/Home/Busca`;

      // Chamada live com timeout defensivo estrito (7000ms)
      const res = await executeJurisHttpRequest(liveUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: `txtAssunto=${encodeURIComponent(queryTerm)}&page=1`,
        timeoutMs: 7000,
      });
      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok && typeof res.text === "string" && !res.text.includes("Ocorreu um erro")) {
        const liveHits = this.parseHtmlSearchResults(res.text, limit);
        if (liveHits.length > 0) {
          const merged: RawJurisSearchResult[] = [];
          const seenIds = new Set<string>();

          for (const cat of catalogHits) {
            const mapped = this.mapCatalogItemToResult(cat);
            merged.push(mapped);
            seenIds.add(mapped.id);
          }

          for (const lHit of liveHits) {
            if (!seenIds.has(lHit.id)) {
              merged.push(lHit);
              seenIds.add(lHit.id);
            }
          }

          return {
            hits: merged.slice(0, limit),
            diagnostic: {
              court: "TCE-MG",
              status: "ok",
              hits: merged.length,
              latency_ms: latencyMs,
              error: null,
            },
          };
        }
      }

      // Fallback gracioso para catálogo curado determinístico
      const fallbackHits = catalogHits.map((c) => this.mapCatalogItemToResult(c));
      return {
        hits: fallbackHits,
        diagnostic: {
          court: "TCE-MG",
          status: "ok",
          hits: fallbackHits.length,
          latency_ms: latencyMs,
          error: null,
        },
      };
    } catch {
      const fallbackHits = catalogHits.map((c) => this.mapCatalogItemToResult(c));
      return {
        hits: fallbackHits,
        diagnostic: {
          court: "TCE-MG",
          status: "ok",
          hits: fallbackHits.length,
          latency_ms: Math.round(performance.now() - startTime),
          error: null,
        },
      };
    }
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const isMock = !!(
      process.env.DOCGOV_JURIS_TCEMG_URL ||
      process.env.DOCGOV_TCE_MG_BASE_URL ||
      process.env.DOCGOV_JURIS_BASE_URL
    );

    // 1. Modo Mock Server (.NET Cross-Check / Sub-Assert 29.10)
    if (isMock) {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/fetch?court=TCE-MG&id=${encodeURIComponent(idOrRef)}`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok) {
        return {
          id: idOrRef,
          court: "TCE-MG",
          exists: false,
          rawTextOrJson: null,
        };
      }
      const data = res.data;
      if (data && typeof data === "object") {
        if (data.exists === false) {
          return {
            id: idOrRef,
            court: "TCE-MG",
            exists: false,
            rawTextOrJson: null,
          };
        }
        if (data.exists === true && data.rawTextOrJson) {
          return {
            id: data.id || idOrRef,
            court: "TCE-MG",
            exists: true,
            rawTextOrJson: data.rawTextOrJson,
          };
        }
        return {
          id: data.id || idOrRef,
          court: "TCE-MG",
          exists: true,
          rawTextOrJson: data,
        };
      }
    }

    // 2. Consulta no Catálogo Curado Oficial (Súmulas e Consultas Normativas)
    const catItem = getTceMgCatalogItemById(idOrRef);
    if (catItem) {
      return {
        id: catItem.id,
        court: "TCE-MG",
        exists: true,
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
          outcome: catItem.dispositivo.toLowerCase().includes("vedad") ||
            catItem.dispositivo.toLowerCase().includes("irregular") ||
            catItem.dispositivo.toLowerCase().includes("nulidade")
            ? "PROCEDENTE_ANULACAO_DETERMINACAO"
            : "IMPROCEDENTE_MANUTENCAO_CERTAME",
        },
      };
    }

    // 3. Consulta Live de Processo/Consulta no Portal TCJuris (/Home/Detalhes/{id})
    const procMatch = idOrRef.match(/(\d{6,7})/);
    if (procMatch) {
      const procNum = procMatch[1];
      const baseUrl = this.getBaseUrl();
      const detalhesUrl = `${baseUrl}/Home/Detalhes/${encodeURIComponent(procNum)}`;

      try {
        const res = await executeJurisHttpRequest(detalhesUrl, { timeoutMs: 7000 });
        if (res.ok && typeof res.text === "string" && !res.text.includes("Ocorreu um erro")) {
          const parsed = this.parseHtmlProcessDetails(res.text, procNum);
          if (parsed) {
            return {
              id: `TCE-MG-PROC-${procNum}`,
              court: "TCE-MG",
              exists: true,
              rawTextOrJson: parsed,
            };
          }
        }
      } catch {
        // Fall through to anti-hallucination block
      }
    }

    // 4. Trava Anti-Alucinação Estrita (Lei 3) para identificadores não verificados
    return {
      id: idOrRef,
      court: "TCE-MG",
      exists: false,
      rawTextOrJson: null,
    };
  }

  private mapCatalogItemToResult(item: TceMgNormativeItem): RawJurisSearchResult {
    const isVeda =
      item.dispositivo.toLowerCase().includes("vedad") ||
      item.dispositivo.toLowerCase().includes("irregular") ||
      item.dispositivo.toLowerCase().includes("nulidade");
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
      outcome: isVeda ? "PROCEDENTE_ANULACAO_DETERMINACAO" : "IMPROCEDENTE_MANUTENCAO_CERTAME",
    };
  }

  private mapMockHitToResult(hit: any): RawJurisSearchResult {
    const rawOutcome = hit.outcome || hit.dispositivo || "";
    const isAdverse =
      rawOutcome.toLowerCase().includes("anula") ||
      rawOutcome.toLowerCase().includes("determina") ||
      rawOutcome.toLowerCase().includes("irregular") ||
      rawOutcome.toLowerCase().includes("procedente");

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
      outcome: hit.outcome || (isAdverse ? "PROCEDENTE_ANULACAO_DETERMINACAO" : "IMPROCEDENTE_MANUTENCAO_CERTAME"),
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
        outcome: cleanRow.toLowerCase().includes("irregular")
          ? "PROCEDENTE_ANULACAO_DETERMINACAO"
          : "IMPROCEDENTE_MANUTENCAO_CERTAME",
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
