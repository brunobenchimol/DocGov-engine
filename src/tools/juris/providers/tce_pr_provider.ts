// ============================================================================
// Conector Oficial do Tribunal de Contas do Estado do Paraná (TCE-PR)
// docgov-engine v1.7.6 — providers/tce_pr_provider.ts (Corte Limpo, Cache TTL 24h)
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

export class TcePrProvider extends BaseJurisdictionProvider {
  public readonly courtId = "TCE-PR";
  public readonly tier = "STATE" as const;
  public readonly uf = "PR";
  public readonly defaultFederal = false;
  public readonly envOverrideKey = "DOCGOV_JURIS_TCE_PR_URL";
  protected override readonly mockEnvKeys = [
    "DOCGOV_JURIS_TCE_PR_URL",
    "DOCGOV_JURIS_TCEPR_URL",
    "DOCGOV_TCE_PR_BASE_URL",
  ];
  protected override readonly baseUrlEnvKeys = [
    "DOCGOV_JURIS_TCE_PR_URL",
    "DOCGOV_JURIS_TCEPR_URL",
    "DOCGOV_TCE_PR_BASE_URL",
  ];
  protected override readonly mockFetchStyle = "query" as const;
  protected override readonly notFoundStyle = "exists_false" as const;
  protected override readonly defaultLiveTimeoutMs = 3500;
  protected override readonly defaultFetchTimeoutMs = 4500;

  public readonly liveSmokeQuery =
    "licitação parcelamento do objeto | prejulgado 25 qualificação econômico-financeira";

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

  protected getDefaultBaseUrl(): string {
    return "https://viajuris.tce.pr.gov.br";
  }

  protected async executeLiveSearch(
    query: string,
    limit: number,
    ctx: LiveSearchContext
  ): Promise<RawJurisSearchResult[]> {
    const baseUrl = this.getBaseUrl();
    const { cleanQuery, shortQuery } = sanitizeQueryForCourt(query);
    const queryTerm = shortQuery || cleanQuery || query;
    const liveUrl = `${baseUrl}/Pesquisa/PesquisaAcordaos/Buscar`;

    const bodyParams = new URLSearchParams();
    bodyParams.set("TermoLivre", queryTerm);
    bodyParams.set("LinhasPorPagina", String(limit));
    bodyParams.set("PaginaAtual", "1");
    bodyParams.set("Ordenacao", "DATA_PUBLICACAO_DESC");

    const res = await this.executeHttp(liveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: bodyParams.toString(),
      timeoutMs: ctx.timeoutMs,
    });
    this.assertHttpOk(res);

    if (typeof res.text === "string" && res.text.includes("conteudo-acordao")) {
      return this.parseHtmlSearchResults(res.text, limit);
    }
    return [];
  }

  protected async executeLiveFetch(
    idOrRef: string,
    ctx: LiveFetchContext
  ): Promise<RawJurisFetchResult | null> {
    const acMatch = idOrRef.match(
      /^(?:TCE[-_]?PR[-_]?)?(?:ACORDAO|ATO)[-_](\d{1,7})[-_/](\d{2,4})$/i
    );
    if (!acMatch) return null;

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

    const res = await this.executeHttp(liveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: params.toString(),
      timeoutMs: ctx.timeoutMs,
    });
    if (res.status === 404) return null;
    this.assertHttpOk(res);

    if (typeof res.text === "string" && res.text.includes("conteudo-acordao")) {
      const parsed = this.parseHtmlSearchResults(res.text, 1)[0];
      if (parsed) {
        return {
          id: `TCE-PR-ACORDAO-${numAto}-${anoAto}`,
          court: "TCE-PR",
          exists: true,
          source: "LIVE",
          rawTextOrJson: {
            tribunal: "TCE-PR",
            colegiado: parsed.colegiado || "Tribunal Pleno",
            numero: numAto,
            ano: Number(anoAto),
            processo: parsed.processo,
            relator: parsed.relator || "Tribunal Pleno",
            dataSessao: parsed.dataSessao,
            entidade: "NAO_INFORMADA",
            indexacao: [parsed.indexacao || "JURISPRUDÊNCIA TCE-PR"],
            tese: parsed.tese,
            dispositivo: parsed.dispositivo,
            inteiroTeorTexto: `${parsed.tese}\n\n${parsed.dispositivo}`,
          },
        };
      }
    }
    return null;
  }

  protected mapMockHitToResult(hit: any): RawJurisSearchResult {
    const rawAno = hit.ano !== undefined && hit.ano !== null ? Number(hit.ano) : undefined;
    const ano = rawAno !== undefined && Number.isFinite(rawAno) ? rawAno : undefined;
    return {
      id: hit.id || `TCE-PR-${hit.numero || "DECISAO"}`,
      court: "TCE-PR",
      colegiado: hit.colegiado || "Tribunal Pleno",
      numero: hit.numero ? String(hit.numero) : undefined,
      ...(ano !== undefined ? { ano } : {}),
      processo: hit.processo,
      relator: hit.relator,
      dataSessao: hit.dataSessao,
      entidade: hit.entidade || "NAO_INFORMADA",
      indexacao: Array.isArray(hit.indexacao) ? hit.indexacao.join("; ") : hit.indexacao,
      tese: hit.tese || hit.enunciado || hit.sumario,
      dispositivo: hit.dispositivo,
      rawPayload: hit,
    };
  }

  private parseHtmlSearchResults(html: string, limit: number): RawJurisSearchResult[] {
    const results: RawJurisSearchResult[] = [];
    const blockRegex =
      /<div[^>]*class="[^"]*conteudo-acordao[^"]*"[\s\S]*?(?=<div[^>]*class="[^"]*conteudo-acordao|$)/gi;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(html)) !== null && results.length < limit) {
      const cleanBlock = cleanHtmlAndNormalize(match[0]);
      const acMatch = cleanBlock.match(/Ac[oó]rd[aã]o:?\s*(?:n[º°]?\s*)?(\d{1,7})\/(\d{2,4})/i);
      const numAto = acMatch ? acMatch[1] : undefined;
      const rawAno = acMatch ? acMatch[2] : undefined;
      const anoAto = rawAno
        ? rawAno.length === 2
          ? Number(`20${rawAno}`)
          : Number(rawAno)
        : undefined;

      const procMatch = cleanBlock.match(/Processo:\s*(\d+[\/\-]\d+)/i);
      const dataMatch = cleanBlock.match(/Data\s*(?:da\s*Sess[ãa]o)?:\s*(\d{2}\/\d{2}\/\d{4})/i);
      const relatorMatch = cleanBlock.match(/Relator:\s*([^\n\r.]+)/i);
      const ementaMatch = cleanBlock.match(/Ementa:\s*([\s\S]*?)(?:Tema:|$)/i);
      const ementa = ementaMatch ? ementaMatch[1].trim() : cleanBlock.slice(0, 300);

      const id =
        numAto && anoAto !== undefined
          ? `TCE-PR-ACORDAO-${numAto}-${anoAto}`
          : `TCE-PR-ATO-${results.length + 1}`;

      results.push({
        id,
        court: "TCE-PR",
        colegiado: cleanBlock.includes("Primeira Câmara")
          ? "1ª Câmara"
          : cleanBlock.includes("Segunda Câmara")
          ? "2ª Câmara"
          : "Tribunal Pleno",
        numero: numAto,
        ...(anoAto !== undefined ? { ano: anoAto } : {}),
        processo: procMatch ? procMatch[1] : undefined,
        relator: relatorMatch ? relatorMatch[1].trim() : "Tribunal Pleno",
        dataSessao: dataMatch ? dataMatch[1] : undefined,
        entidade: "NAO_INFORMADA",
        indexacao: "JURISPRUDÊNCIA TCE-PR; DELIBERAÇÃO PLENÁRIA",
        tese: ementa,
        dispositivo: ementa.slice(0, 300),
      });
    }

    return results;
  }
}
