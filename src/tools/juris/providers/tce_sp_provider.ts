// ============================================================================
// Conector Oficial do Tribunal de Contas do Estado de São Paulo (TCE-SP)
// docgov-engine v1.4.4 — providers/tce_sp_provider.ts
// Súmulas Vinculantes, Decisões, Acórdãos e Deliberações Plenárias (UF: "SP")
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
  TCE_SP_CURATED_CATALOG,
  getTceSpCatalogItemById,
  searchTceSpCatalog,
  normalizeTceSpId,
  type TceSpNormativeItem,
} from "./tce_sp_catalog.ts";

export class TceSpProvider implements JurisdictionProvider {
  public readonly courtId = "TCE-SP";
  public readonly tier = "STATE" as const;
  public readonly uf = "SP";
  public readonly defaultFederal = false;
  public readonly envOverrideKey = "DOCGOV_JURIS_TCESP_URL";
  public readonly liveSmokeQuery = "recuperação judicial súmula 50 do tce-sp | atestado qualificação técnica";

  // Higiene estrita de idPatterns para evitar colisões entre UFs
  public readonly idPatterns = [
    /\b(?:SUMULA[-_]TCESP|TCE[-_]?SP[-_]SUMULA|SUMULA[-_]TCE[-_]?SP)[-_]\d{1,3}\b/i,
    /\bS[UÚ]MULA[-_]?\s*(?:N[Oº°]\s*)?(\d{1,3})\s*(?:DO\s*)?(?:TCE[-_]?SP|TCESP)\b/i,
    /\b(?:TCE[-_]?SP|TCESP)[-_](?:ACORDAO|PROC|TC|DELIBERACAO)[-_][\w/-]+\b/i,
    /\bTC[-_]\d{4,7}[/-]\d{3}[/-]\d{2}\b/i,
    /\bTCE[-_]?SP\b/i,
    /\bTCESP\b/i,
  ];

  // Auto-trigger exige menção expressa ao TCE-SP ou Súmula do TCE-SP
  public readonly autoTriggerKeywords =
    /\b(tce[- ]sp|tcesp|tribunal\s+de\s+contas\s+do\s+estado\s+de\s+s[ãa]o\s+paulo|tribunal\s+de\s+contas\s+de\s+s[ãa]o\s+paulo|s[úu]mula(?:s)?\s*(?:n[º°o]\s*)?\d{1,3}\s*(?:do\s*)?(?:tce[- ]sp|tcesp)|s[úu]mula(?:s)?\s+(?:tce[- ]sp|tcesp)\s*(?:n[º°o]\s*)?\d{1,3})\b/i;

  private getBaseUrl(): string {
    return (
      process.env.DOCGOV_JURIS_TCESP_URL ||
      process.env.DOCGOV_TCE_SP_BASE_URL ||
      process.env.DOCGOV_JURIS_BASE_URL ||
      "https://www.tce.sp.gov.br"
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
      process.env.DOCGOV_JURIS_TCESP_URL ||
      process.env.DOCGOV_TCE_SP_BASE_URL ||
      process.env.DOCGOV_JURIS_BASE_URL
    );

    // 1. Modo Mock Server (.NET Cross-Check / Sub-Assert 29.9)
    if (isMock) {
      const url = `${baseUrl}/search?court=TCE-SP&q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok) {
        return {
          hits: [],
          diagnostic: {
            court: "TCE-SP",
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
          court: "TCE-SP",
          status: "ok",
          hits: hits.length,
          latency_ms: res.latencyMs,
          error: null,
        },
      };
    }

    // 2. Busca Live com Resiliência Dupla (Catálogo Curado + Portal Oficial)
    const startTime = performance.now();
    const catalogHits = searchTceSpCatalog(query, limit);

    try {
      const { cleanQuery, shortQuery } = sanitizeQueryForCourt(query);
      const queryTerm = shortQuery || cleanQuery || query;
      const liveUrl = `${baseUrl}/jurisprudencia/pesquisar?acao=Executa&txtTdPalvs=${encodeURIComponent(
        queryTerm
      )}`;

      const res = await executeJurisHttpRequest(liveUrl, { timeoutMs: 7000 });
      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok && typeof res.text === "string" && res.text.includes("Foram encontrados")) {
        const liveHits = this.parseHtmlSearchResults(res.text, limit);
        if (liveHits.length > 0) {
          // Merge preferencial com o catálogo curado determinístico
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
              court: "TCE-SP",
              status: "ok",
              hits: merged.length,
              latency_ms: latencyMs,
              error: null,
            },
          };
        }
      }

      // Fallback gracioso para catálogo curado se live retornar 0 hits ou erro
      const fallbackHits = catalogHits.map((c) => this.mapCatalogItemToResult(c));
      return {
        hits: fallbackHits,
        diagnostic: {
          court: "TCE-SP",
          status: "ok",
          hits: fallbackHits.length,
          latency_ms: latencyMs,
          error: null,
        },
      };
    } catch {
      const latencyMs = Math.round(performance.now() - startTime);
      const fallbackHits = catalogHits.map((c) => this.mapCatalogItemToResult(c));
      return {
        hits: fallbackHits,
        diagnostic: {
          court: "TCE-SP",
          status: "ok",
          hits: fallbackHits.length,
          latency_ms: latencyMs,
          error: null,
        },
      };
    }
  }

  public async fetch(idOrRef: string): Promise<RawJurisFetchResult | null> {
    const isMock = !!(
      process.env.DOCGOV_JURIS_TCESP_URL ||
      process.env.DOCGOV_TCE_SP_BASE_URL ||
      process.env.DOCGOV_JURIS_BASE_URL
    );

    // 1. Modo Mock Server (.NET Cross-Check / Sub-Assert 29.9)
    if (isMock) {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/fetch?court=TCE-SP&id=${encodeURIComponent(idOrRef)}`;
      const res = await executeJurisHttpRequest(url);
      if (!res.ok) {
        // Trava anti-alucinação imediata para IDs não encontrados no mock
        return {
          id: idOrRef,
          court: "TCE-SP",
          exists: false,
          rawTextOrJson: null,
        };
      }
      const data = res.data;
      if (data && typeof data === "object") {
        if (data.exists === false) {
          return {
            id: idOrRef,
            court: "TCE-SP",
            exists: false,
            rawTextOrJson: null,
          };
        }
        if (data.exists === true && data.rawTextOrJson) {
          return {
            id: data.id || idOrRef,
            court: "TCE-SP",
            exists: true,
            rawTextOrJson: data.rawTextOrJson,
          };
        }
        return {
          id: data.id || idOrRef,
          court: "TCE-SP",
          exists: true,
          rawTextOrJson: data,
        };
      }
    }

    // 2. Consulta no Catálogo Curado Oficial (Súmulas e Processos Paradigmas)
    const catItem = getTceSpCatalogItemById(idOrRef);
    if (catItem) {
      return {
        id: catItem.id,
        court: "TCE-SP",
        exists: true,
        rawTextOrJson: {
          tribunal: "TCE-SP",
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
          outcome: catItem.dispositivo.toLowerCase().includes("vedad")
            ? "PROCEDENTE_ANULACAO_DETERMINACAO"
            : "IMPROCEDENTE_MANUTENCAO_CERTAME",
        },
      };
    }

    // 3. Consulta Live de Processo no Portal do TCE-SP (/jurisprudencia/exibir)
    const procMatch = idOrRef.match(/(\d{1,7})\s*[/_-]\s*(\d{3})\s*[/_-]\s*(\d{2})/);
    if (procMatch) {
      const procNum = `${procMatch[1]}/${procMatch[2]}/${procMatch[3]}`;
      const baseUrl = this.getBaseUrl();
      const exibirUrl = `${baseUrl}/jurisprudencia/exibir?proc=${encodeURIComponent(
        procNum
      )}&offset=0`;

      try {
        const res = await executeJurisHttpRequest(exibirUrl, { timeoutMs: 7000 });
        if (res.ok && typeof res.text === "string" && res.text.includes(procNum)) {
          const parsed = this.parseHtmlProcessDetails(res.text, procNum);
          if (parsed) {
            return {
              id: `TCE-SP-TC-${procNum.replace(/\//g, "-")}`,
              court: "TCE-SP",
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
      court: "TCE-SP",
      exists: false,
      rawTextOrJson: null,
    };
  }

  private mapCatalogItemToResult(item: TceSpNormativeItem): RawJurisSearchResult {
    const isVeda = item.dispositivo.toLowerCase().includes("vedad");
    return {
      id: item.id,
      court: "TCE-SP",
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
    const rawId = hit.id || hit.canonical_id || hit.numero || "TCESP-HIT";
    const cleanId = normalizeTceSpId(rawId);
    return {
      id: cleanId,
      court: "TCE-SP",
      colegiado: hit.colegiado || "Tribunal Pleno",
      numero: hit.numero || hit.numeroAcordao || "50",
      ano: hit.ano ? parseInt(String(hit.ano), 10) : 2019,
      relator: hit.relator || "Conselheiro Relator",
      dataSessao: hit.dataSessao || hit.data,
      entidade: hit.entidade || "ORGAO_CONTRATANTE",
      indexacao: Array.isArray(hit.indexacao)
        ? hit.indexacao.join("; ")
        : hit.indexacao || "LICITAÇÃO",
      tese: hit.tese || hit.enunciado || hit.ementa || "",
      dispositivo: hit.dispositivo || hit.outcome_summary || "",
      outcome: hit.outcome || "IMPROCEDENTE_MANUTENCAO_CERTAME",
      rawPayload: hit,
    };
  }

  private parseHtmlSearchResults(html: string, limit: number): RawJurisSearchResult[] {
    const results: RawJurisSearchResult[] = [];
    const cleanHtml = html.replace(/\r\n|\r|\n/g, " ");

    // Captura blocos de trechos localizados
    const trechoRegex = /<ul class="trechos-documento">\s*<li>(.*?)<\/li>/gi;
    const trechos: string[] = [];
    let tMatch: RegExpExecArray | null;
    while ((tMatch = trechoRegex.exec(cleanHtml)) !== null) {
      trechos.push(cleanHtmlAndNormalize(tMatch[1]));
    }

    // Captura linhas de processos ou súmulas
    const procRegex = /<td class="small\s*">\s*<a href="exibir\?proc=([\d/]+)&offset=\d+"\s*>(.*?)<\/a>/gi;
    let pMatch: RegExpExecArray | null;
    let idx = 0;

    while ((pMatch = procRegex.exec(cleanHtml)) !== null && results.length < limit) {
      const procNum = pMatch[1].trim();
      const trecho = trechos[idx] || "Precedente do TCE-SP";
      const isSúmula = trecho.toUpperCase().includes("SÚMULA");

      const sumNumMatch = trecho.match(/SÚMULA\s*(?:Nº|N°)?\s*(\d+)/i);
      const id = isSúmula && sumNumMatch
        ? `SUMULA-TCESP-${sumNumMatch[1]}`
        : `TCE-SP-PROC-${procNum.replace(/\//g, "-")}`;

      results.push({
        id,
        court: "TCE-SP",
        colegiado: "Tribunal Pleno",
        numero: isSúmula && sumNumMatch ? sumNumMatch[1] : procNum,
        ano: new Date().getFullYear(),
        relator: "Conselheiro Relator",
        entidade: "ORGAO_CONTRATANTE",
        indexacao: isSúmula ? "SÚMULA TCE-SP; LICITAÇÃO" : "PROCESSO TCE-SP; LICITAÇÃO",
        tese: trecho.slice(0, 350),
        dispositivo: trecho.slice(0, 200),
        outcome: trecho.toLowerCase().includes("vedad")
          ? "PROCEDENTE_ANULACAO_DETERMINACAO"
          : "IMPROCEDENTE_MANUTENCAO_CERTAME",
      });
      idx++;
    }

    return results;
  }

  private parseHtmlProcessDetails(html: string, procNum: string): any {
    const clean = html.replace(/\r\n|\r|\n/g, " ");
    const relatorMatch = clean.match(/Relator:\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i);
    const materiaMatch = clean.match(/Matéria:\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i);
    const exercicioMatch = clean.match(/Exercício:\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i);
    const objetoMatch = clean.match(/Objeto:\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i);

    const relator = relatorMatch ? cleanHtmlAndNormalize(relatorMatch[1]) : "Conselheiro Relator";
    const materia = materiaMatch ? cleanHtmlAndNormalize(materiaMatch[1]) : "LICITAÇÃO";
    const ano = exercicioMatch ? parseInt(cleanHtmlAndNormalize(exercicioMatch[1]), 10) : 2024;
    const objeto = objetoMatch ? cleanHtmlAndNormalize(objetoMatch[1]) : "";

    return {
      tribunal: "TCE-SP",
      colegiado: "Tribunal Pleno",
      numero: procNum,
      ano: isNaN(ano) ? 2024 : ano,
      processo: procNum,
      relator,
      entidade: "ORGAO_CONTRATANTE",
      regimeLegal: "LEI_14133_ADM_DIRETA",
      indexacao: [materia, "TCE-SP", "LICITAÇÃO"],
      tese: `Processo ${procNum}: Matéria ${materia}. Objeto: ${objeto}.`,
      dispositivo: `Decisão plenária nos autos do processo ${procNum}.`,
      inteiroTeorTexto: `TRIBUNAL DE CONTAS DO ESTADO DE SÃO PAULO\nProcesso: ${procNum}\nRelator: ${relator}\nMatéria: ${materia}\nObjeto: ${objeto}\nInteiro teor do procedimento submetido a julgamento.`,
      outcome: "IMPROCEDENTE_MANUTENCAO_CERTAME",
    };
  }
}
