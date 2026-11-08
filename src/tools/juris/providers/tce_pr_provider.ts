// ============================================================================
// Conector Oficial do Tribunal de Contas do Estado do Paraná (TCE-PR)
// docgov-engine v1.4.6 — providers/tce_pr_provider.ts
// Prejulgados, Súmulas e Consultas Normativas do Tribunal Pleno / ViaJuris
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
  TCE_PR_CURATED_CATALOG,
  getTcePrCatalogItemById,
  searchTcePrCatalog,
  normalizeTcePrId,
  type TcePrNormativeItem,
} from "./tce_pr_catalog.ts";

export class TcePrProvider implements JurisdictionProvider {
  public readonly courtId = "TCE-PR";
  public readonly tier = "STATE" as const;
  public readonly uf = "PR";
  public readonly defaultFederal = false;
  public readonly envOverrideKey = "DOCGOV_JURIS_TCE_PR_URL";
  public readonly liveSmokeQuery = "licitação parcelamento do objeto | prejulgado 25 qualificação econômico-financeira";

  // Higiene de idPatterns para suporte à suíte de testes e cross-check .NET (Sub-Assert 29.11)
  public readonly idPatterns = [
    /\b(?:PREJULGADO[-_]?TCEPR|TCE[-_]?PR[-_]PREJULGADO|PREJULGADO[-_]TCE[-_]?PR)[-_]\d{1,3}\b/i,
    /\bPREJULGADO[-_]?\s*(?:N[Oº°]\s*)?(\d{1,3})\s*(?:DO\s*)?(?:TCE[-_]?PR|TCEPR)\b/i,
    /\b(?:SUMULA[-_]?TCEPR|TCE[-_]?PR[-_]SUMULA|SUMULA[-_]TCE[-_]?PR)[-_]\d{1,3}\b/i,
    /\bS[UÚ]MULA[-_]?\s*(?:N[Oº°]\s*)?(\d{1,3})\s*(?:DO\s*)?(?:TCE[-_]?PR|TCEPR)\b/i,
    /\bCONSULTA[-_]?(?:N[Oº°]\s*)?(\d{3,7})[-_/]?(\d{2,4})?\s*(?:DO\s*)?(?:TCE[-_]?PR|TCEPR)?\b/i,
    /\b(?:TCE[-_]?PR|TCEPR)[-_](?:ACORDAO|PROC|PROCESSO|CONSULTA|PREJULGADO|SUMULA)[-_][\w/-]+\b/i,
    /\bTCE[-_]?PR[-_]\d{1,7}\b/i,
    /\bTCE[-_]?PR\b/i,
    /\bTCEPR\b/i,
  ];

  // Auto-trigger com higiene estrita: exclui 'parana' isolado para evitar falso-positivo em endereços genéricos
  public readonly autoTriggerKeywords =
    /\b(tce[- ]pr|tce\/pr|tcepr|tribunal\s+de\s+contas\s+do\s+estado\s+do\s+paran[aá]|tribunal\s+de\s+contas\s+do\s+paran[aá]|viajuris|prejulgado\s*(?:n[º°o]\s*)?\d{1,3}\s*(?:do\s*)?(?:tce[- ]pr|tcepr)|s[úu]mula(?:s)?\s*(?:n[º°o]\s*)?\d{1,3}\s*(?:do\s*)?(?:tce[- ]pr|tcepr)|curitiba|celepar|sanepar|copel|lei\s+(?:estadual\s+)?15\.?608|decreto\s+(?:estadual\s+)?10\.?086)\b/i;

  private getBaseUrl(): string {
    return (
      process.env.DOCGOV_JURIS_TCE_PR_URL ||
      process.env.DOCGOV_JURIS_TCEPR_URL ||
      process.env.DOCGOV_TCE_PR_BASE_URL ||
      process.env.DOCGOV_JURIS_BASE_URL ||
      "https://viajuris.tce.pr.gov.br"
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
      process.env.DOCGOV_JURIS_TCE_PR_URL ||
      process.env.DOCGOV_JURIS_TCEPR_URL ||
      process.env.DOCGOV_TCE_PR_BASE_URL ||
      process.env.DOCGOV_JURIS_BASE_URL
    );

    // 1. Modo Mock Server (.NET Cross-Check / Sub-Assert 29.11)
    if (isMock) {
      const url = `${baseUrl}/search?court=TCE-PR&q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok) {
        return {
          hits: [],
          diagnostic: {
            court: "TCE-PR",
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
          court: "TCE-PR",
          status: "ok",
          hits: hits.length,
          latency_ms: res.latencyMs,
          error: null,
        },
      };
    }

    // 2. Busca com Resiliência Dupla (Catálogo Curado Determinístico + Portal Oficial ViaJuris)
    const startTime = performance.now();
    const catalogHits = searchTcePrCatalog(query, limit);

    // Acionamento instantâneo do catálogo curado se houver menção direta a Prejulgado ou Súmula
    const hasDirectNormativeMatch =
      /\bprejulgado\s*(?:n[º°o]\s*)?\d{1,3}\b/i.test(query) ||
      /\bs[úu]mula\s*(?:n[º°o]\s*)?\d{1,3}\b/i.test(query);

    if (hasDirectNormativeMatch && catalogHits.length > 0) {
      const hits = catalogHits.map((c) => this.mapCatalogItemToResult(c));
      return {
        hits,
        diagnostic: {
          court: "TCE-PR",
          status: "ok",
          hits: hits.length,
          latency_ms: Math.round(performance.now() - startTime),
          error: null,
        },
      };
    }

    try {
      const { cleanQuery, shortQuery } = sanitizeQueryForCourt(query);
      const queryTerm = shortQuery || cleanQuery || query;
      const liveUrl = `${baseUrl}/Pesquisa/PesquisaAcordaos/Buscar`;

      const bodyParams = new URLSearchParams();
      bodyParams.set("TermoLivre", queryTerm);
      bodyParams.set("LinhasPorPagina", String(limit));
      bodyParams.set("PaginaAtual", "1");
      bodyParams.set("Ordenacao", "DATA_PUBLICACAO_DESC");

      // Chamada live com timeout defensivo estrito (3500ms, 0 retries para evitar hang de rede)
      const res = await executeJurisHttpRequest(liveUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: bodyParams.toString(),
        timeoutMs: 3500,
        retries: 0,
      });
      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok && typeof res.text === "string" && res.text.includes("conteudo-acordao")) {
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
              court: "TCE-PR",
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
          court: "TCE-PR",
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
          court: "TCE-PR",
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
      process.env.DOCGOV_JURIS_TCE_PR_URL ||
      process.env.DOCGOV_JURIS_TCEPR_URL ||
      process.env.DOCGOV_TCE_PR_BASE_URL ||
      process.env.DOCGOV_JURIS_BASE_URL
    );

    // 1. Modo Mock Server (.NET Cross-Check / Sub-Assert 29.11)
    if (isMock) {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/fetch?court=TCE-PR&id=${encodeURIComponent(idOrRef)}`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok) {
        return {
          id: idOrRef,
          court: "TCE-PR",
          exists: false,
          rawTextOrJson: null,
        };
      }
      const data = res.data;
      if (data && typeof data === "object") {
        if (data.exists === false) {
          return {
            id: idOrRef,
            court: "TCE-PR",
            exists: false,
            rawTextOrJson: null,
          };
        }
        if (data.exists === true && data.rawTextOrJson) {
          return {
            id: data.id || idOrRef,
            court: "TCE-PR",
            exists: true,
            rawTextOrJson: data.rawTextOrJson,
          };
        }
        return {
          id: data.id || idOrRef,
          court: "TCE-PR",
          exists: true,
          rawTextOrJson: data,
        };
      }
    }

    // 2. Consulta no Catálogo Curado Oficial (Prejulgados, Súmulas e Consultas)
    const catItem = getTcePrCatalogItemById(idOrRef);
    if (catItem) {
      return {
        id: catItem.id,
        court: "TCE-PR",
        exists: true,
        rawTextOrJson: {
          tribunal: "TCE-PR",
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
            catItem.dispositivo.toLowerCase().includes("ilegal") ||
            catItem.dispositivo.toLowerCase().includes("proíbe") ||
            catItem.dispositivo.toLowerCase().includes("infração")
              ? "PROCEDENTE_ANULACAO_DETERMINACAO"
              : "IMPROCEDENTE_MANUTENCAO_CERTAME",
        },
      };
    }

    // 3. Consulta Live de Acórdão no Portal ViaJuris via NUMERO_ATO e ANO_ATO
    const acMatch = idOrRef.match(/^(?:TCE[-_]?PR[-_]?)?(?:ACORDAO|ATO)[-_](\d{1,7})[-_/](\d{2,4})$/i);
    if (acMatch) {
      const numAto = acMatch[1];
      const rawAno = acMatch[2];
      const anoAto = rawAno.length === 2 ? `20${rawAno}` : rawAno;
      const baseUrl = this.getBaseUrl();
      const liveUrl = `${baseUrl}/Pesquisa/PesquisaAcordaos/Buscar`;

      const params = new URLSearchParams();
      params.set("NUMERO_ATO", numAto);
      params.set("ANO_ATO", anoAto);
      params.set("LinhasPorPagina", "1");
      params.set("PaginaAtual", "1");

      try {
        const res = await executeJurisHttpRequest(liveUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: params.toString(),
          timeoutMs: 3500,
          retries: 0,
        });

        if (res.ok && typeof res.text === "string" && res.text.includes("conteudo-acordao")) {
          const parsed = this.parseHtmlSearchResults(res.text, 1)[0];
          if (parsed) {
            return {
              id: `TCE-PR-ACORDAO-${numAto}-${anoAto}`,
              court: "TCE-PR",
              exists: true,
              rawTextOrJson: {
                tribunal: "TCE-PR",
                colegiado: parsed.colegiado || "Tribunal Pleno",
                numero: numAto,
                ano: Number(anoAto),
                processo: parsed.processo,
                relator: parsed.relator || "Tribunal Pleno",
                dataSessao: parsed.dataSessao,
                entidade: "ORGAO_CONTRATANTE",
                regimeLegal: "LEI_14133_ADM_DIRETA",
                indexacao: [parsed.indexacao || "JURISPRUDÊNCIA TCE-PR"],
                tese: parsed.tese,
                dispositivo: parsed.dispositivo,
                inteiroTeorTexto: `${parsed.tese}\n\n${parsed.dispositivo}`,
                outcome: parsed.outcome,
              },
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
      court: "TCE-PR",
      exists: false,
      rawTextOrJson: null,
    };
  }

  private mapCatalogItemToResult(item: TcePrNormativeItem): RawJurisSearchResult {
    const isVeda =
      item.dispositivo.toLowerCase().includes("vedad") ||
      item.dispositivo.toLowerCase().includes("ilegal") ||
      item.dispositivo.toLowerCase().includes("proíbe");

    return {
      id: item.id,
      court: "TCE-PR",
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
      rawOutcome.toLowerCase().includes("procedente") ||
      rawOutcome.toLowerCase().includes("cautelar");

    return {
      id: hit.id || `TCE-PR-${hit.numero || "DECISAO"}`,
      court: "TCE-PR",
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
    const blockRegex = /<div[^>]*class="[^"]*conteudo-acordao[^"]*"[\s\S]*?(?=<div[^>]*class="[^"]*conteudo-acordao|$)/gi;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(html)) !== null && results.length < limit) {
      const block = match[0];
      const cleanBlock = cleanHtmlAndNormalize(block);

      // Extrai número do acórdão e ano (ex.: "Acórdão: 2804/2026", "Acórdão nº 2804/26")
      const acMatch = cleanBlock.match(/Ac[oó]rd[aã]o:?\s*(?:n[º°]?\s*)?(\d{1,7})\/(\d{2,4})/i);
      const numAto = acMatch ? acMatch[1] : undefined;
      const rawAno = acMatch ? acMatch[2] : undefined;
      const anoAto = rawAno ? (rawAno.length === 2 ? Number(`20${rawAno}`) : Number(rawAno)) : undefined;

      // Extrai processo e data da sessão
      const procMatch = cleanBlock.match(/Processo:\s*(\d+[\/\-]\d+)/i);
      const dataMatch = cleanBlock.match(/Data\s*(?:da\s*Sess[ãa]o)?:\s*(\d{2}\/\d{2}\/\d{4})/i);

      // Extrai relator
      const relatorMatch = cleanBlock.match(/Relator:\s*([^\n\r.]+)/i);

      // Extrai ementa e tema
      const ementaMatch = cleanBlock.match(/Ementa:\s*([\s\S]*?)(?:Tema:|$)/i);
      const ementa = ementaMatch ? ementaMatch[1].trim() : cleanBlock.slice(0, 300);

      const id = numAto && anoAto ? `TCE-PR-ACORDAO-${numAto}-${anoAto}` : `TCE-PR-ATO-${results.length + 1}`;

      const isAdverse =
        cleanBlock.toLowerCase().includes("procedente") ||
        cleanBlock.toLowerCase().includes("cautelar de suspens") ||
        cleanBlock.toLowerCase().includes("anulação") ||
        cleanBlock.toLowerCase().includes("irregular");

      results.push({
        id,
        court: "TCE-PR",
        colegiado: cleanBlock.includes("Primeira Câmara")
          ? "1ª Câmara"
          : cleanBlock.includes("Segunda Câmara")
          ? "2ª Câmara"
          : "Tribunal Pleno",
        numero: numAto,
        ano: anoAto,
        processo: procMatch ? procMatch[1] : undefined,
        relator: relatorMatch ? relatorMatch[1].trim() : "Tribunal Pleno",
        dataSessao: dataMatch ? dataMatch[1] : undefined,
        indexacao: "JURISPRUDÊNCIA TCE-PR; DELIBERAÇÃO PLENÁRIA",
        tese: ementa,
        dispositivo: ementa.slice(0, 300),
        outcome: isAdverse ? "PROCEDENTE_ANULACAO_DETERMINACAO" : "IMPROCEDENTE_MANUTENCAO_CERTAME",
      });
    }

    return results;
  }
}
