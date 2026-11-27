// ============================================================================
// Conector Oficial do Tribunal de Contas do Estado de São Paulo (TCE-SP)
// docgov-engine v1.7.6 — providers/tce_sp_provider.ts (Corte Limpo, Cache TTL 24h)
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
import { normalizeTceSpId } from "./tce_sp_catalog.ts";

export class TceSpProvider extends BaseJurisdictionProvider {
  public readonly courtId = "TCE-SP";
  public readonly tier = "STATE" as const;
  public readonly uf = "SP";
  public readonly defaultFederal = false;
  public readonly envOverrideKey = "DOCGOV_JURIS_TCESP_URL";
  protected override readonly mockEnvKeys = [
    "DOCGOV_JURIS_TCESP_URL",
    "DOCGOV_TCE_SP_BASE_URL",
  ];
  protected override readonly baseUrlEnvKeys = [
    "DOCGOV_JURIS_TCESP_URL",
    "DOCGOV_TCE_SP_BASE_URL",
  ];
  protected override readonly mockFetchStyle = "query" as const;
  protected override readonly notFoundStyle = "exists_false" as const;
  protected override readonly defaultLiveTimeoutMs = 5000;
  protected override readonly defaultFetchTimeoutMs = 7000;

  public readonly liveSmokeQuery =
    "recuperação judicial súmula 50 do tce-sp | atestado qualificação técnica";

  public readonly idPatterns = [
    /\b(?:SUMULA[-_]TCESP|TCE[-_]?SP[-_]SUMULA|SUMULA[-_]TCE[-_]?SP)[-_]\d{1,3}\b/i,
    /\bS[UÚ]MULA[-_]?\s*(?:N[Oº°]\s*)?(\d{1,3})\s*(?:DO\s*)?(?:TCE[-_]?SP|TCESP)\b/i,
    /\b(?:TCE[-_]?SP|TCESP)[-_](?:ACORDAO|PROC|TC|DELIBERACAO)[-_][\w/-]+\b/i,
    /\bTC[-_]\d{4,7}[./_-]\d{3}[./_-]\d{2}(?:-\d+)?\b/i,
    /\bTCE[-_]?SP\b/i,
    /\bTCESP\b/i,
  ];

  protected getDefaultBaseUrl(): string {
    return "https://www.tce.sp.gov.br";
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const { cleanQuery, shortQuery } = sanitizeQueryForCourt(query);
    const queryTerm = shortQuery || cleanQuery || query;
    const liveUrl = `${baseUrl}/jurisprudencia/pesquisar?acao=Executa&txtTdPalvs=${encodeURIComponent(
      queryTerm
    )}`;

    const res = await this.executeHttp(liveUrl, { timeoutMs: ctx.timeoutMs });
    this.assertHttpOk(res);

    if (typeof res.text === "string" && res.text.includes("Foram encontrados")) {
      return this.parseHtmlSearchResults(res.text, limit);
    }
    return [];
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    const procMatch = idOrRef.match(/(\d{1,7})\s*[./_-]\s*(\d{3})\s*[./_-]\s*(\d{2})/);
    if (!procMatch) return null;

    const procNum = `${procMatch[1]}/${procMatch[2]}/${procMatch[3]}`;
    const baseUrl = this.getBaseUrl();
    const exibirUrl = `${baseUrl}/jurisprudencia/exibir?proc=${encodeURIComponent(
      procNum
    )}&offset=0`;

    const res = await this.executeHttp(exibirUrl, { timeoutMs: ctx.timeoutMs });
    if (res.status === 404) return null;
    this.assertHttpOk(res);

    if (typeof res.text === "string" && res.text.includes(procNum)) {
      const parsed = this.parseHtmlProcessDetails(res.text, procNum);
      if (parsed) {
        return {
          id: `TCE-SP-TC-${procNum.replace(/\//g, "-")}`,
          court: "TCE-SP",
          exists: true,
          source: "LIVE",
          rawTextOrJson: parsed,
        };
      }
    }
    return null;
  }

  protected mapMockHitToResult(hit: any): RawJurisSearchResult {
    const rawId = hit.id || hit.canonical_id || hit.numero || "TCESP-HIT";
    const cleanId = normalizeTceSpId(rawId);
    const parsedAno =
      hit.ano !== undefined && hit.ano !== null ? parseInt(String(hit.ano), 10) : NaN;
    const ano = Number.isFinite(parsedAno) ? parsedAno : undefined;
    return {
      id: cleanId,
      court: "TCE-SP",
      colegiado: hit.colegiado || "Tribunal Pleno",
      numero: hit.numero ? String(hit.numero) : hit.numeroAcordao ? String(hit.numeroAcordao) : undefined,
      ...(ano !== undefined ? { ano } : {}),
      relator: hit.relator || "Conselheiro Relator",
      dataSessao: hit.dataSessao || hit.data,
      entidade: hit.entidade || "NAO_INFORMADA",
      indexacao: Array.isArray(hit.indexacao)
        ? hit.indexacao.join("; ")
        : hit.indexacao || "TCE-SP",
      tese: hit.tese || hit.enunciado || hit.ementa || "",
      dispositivo: hit.dispositivo || hit.outcome_summary || "",
      rawPayload: hit,
    };
  }

  private parseHtmlSearchResults(html: string, limit: number): RawJurisSearchResult[] {
    const results: RawJurisSearchResult[] = [];
    const cleanHtml = html.replace(/\r\n|\r|\n/g, " ");

    const trechoRegex = /<ul class="trechos-documento">\s*<li>(.*?)<\/li>/gi;
    const trechos: string[] = [];
    let tMatch: RegExpExecArray | null;
    while ((tMatch = trechoRegex.exec(cleanHtml)) !== null) {
      trechos.push(cleanHtmlAndNormalize(tMatch[1]));
    }

    const procRegex =
      /<td class="small\s*">\s*<a href="exibir\?proc=([\d/]+)&offset=\d+"\s*>(.*?)<\/a>/gi;
    let pMatch: RegExpExecArray | null;
    let idx = 0;

    while ((pMatch = procRegex.exec(cleanHtml)) !== null && results.length < limit) {
      const procNum = pMatch[1].trim();
      const trecho = trechos[idx] || "";
      const isSumula = trecho.toUpperCase().includes("SÚMULA");

      const sumNumMatch = trecho.match(/SÚMULA\s*(?:Nº|N°)?\s*(\d+)/i);
      const id =
        isSumula && sumNumMatch
          ? `SUMULA-TCESP-${sumNumMatch[1]}`
          : `TCE-SP-PROC-${procNum.replace(/\//g, "-")}`;

      results.push({
        id,
        court: "TCE-SP",
        colegiado: "Tribunal Pleno",
        numero: isSumula && sumNumMatch ? sumNumMatch[1] : procNum,
        relator: "Conselheiro Relator",
        entidade: "NAO_INFORMADA",
        indexacao: isSumula ? "SÚMULA TCE-SP" : "PROCESSO TCE-SP",
        tese: trecho.slice(0, 350),
        dispositivo: trecho.slice(0, 200),
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

    const relator = relatorMatch ? cleanHtmlAndNormalize(relatorMatch[1]) : undefined;
    const materia = materiaMatch ? cleanHtmlAndNormalize(materiaMatch[1]) : undefined;
    const parsedAno = exercicioMatch
      ? parseInt(cleanHtmlAndNormalize(exercicioMatch[1]), 10)
      : NaN;
    const ano = Number.isFinite(parsedAno) ? parsedAno : undefined;
    const objeto = objetoMatch ? cleanHtmlAndNormalize(objetoMatch[1]) : undefined;
    const realText = cleanHtmlAndNormalize(html);

    return {
      tribunal: "TCE-SP",
      colegiado: "Tribunal Pleno",
      numero: procNum,
      ...(ano !== undefined ? { ano } : {}),
      processo: procNum,
      ...(relator ? { relator } : {}),
      entidade: "NAO_INFORMADA",
      indexacao: [materia, "TCE-SP"].filter(Boolean),
      tese: objeto || realText.slice(0, 500),
      inteiroTeorTexto: realText,
      rawText: realText,
    };
  }
}
