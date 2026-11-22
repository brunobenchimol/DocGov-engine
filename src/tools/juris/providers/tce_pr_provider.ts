// ============================================================================
// Conector Oficial do Tribunal de Contas do Estado do Paraná (TCE-PR)
// docgov-engine — providers/tce_pr_provider.ts (extends BaseJurisdictionProvider)
// Prejulgados, Súmulas e Consultas Normativas do Tribunal Pleno / ViaJuris
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
  getTcePrCatalogItemById,
  searchTcePrCatalog,
  type TcePrNormativeItem,
} from "./tce_pr_catalog.ts";

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

  public readonly autoTriggerKeywords =
    /\b(tce[- ]pr|tce\/pr|tcepr|tribunal\s+de\s+contas\s+do\s+estado\s+do\s+paran[aá]|tribunal\s+de\s+contas\s+do\s+paran[aá]|viajuris|prejulgado\s*(?:n[º°o]\s*)?\d{1,3}\s*(?:do\s*)?(?:tce[- ]pr|tcepr)|s[úu]mula(?:s)?\s*(?:n[º°o]\s*)?\d{1,3}\s*(?:do\s*)?(?:tce[- ]pr|tcepr)|curitiba|celepar|sanepar|copel|lei\s+(?:estadual\s+)?15\.?608|decreto\s+(?:estadual\s+)?10\.?086)\b/i;

  protected getDefaultBaseUrl(): string {
    return "https://viajuris.tce.pr.gov.br";
  }

  protected override searchCatalog(query: string, limit: number): RawJurisSearchResult[] {
    return searchTcePrCatalog(query, limit).map((c) => this.mapCatalogItemToResult(c));
  }

  protected override shouldShortCircuitCatalog(query: string): boolean {
    return (
      /\bprejulgado\b/i.test(query) ||
      /\bs[úu]mula\s*(?:n[º°o]\s*)?\d{1,3}\b/i.test(query)
    );
  }

  protected override findCatalogItemById(idOrRef: string): RawJurisFetchResult | null {
    const catItem = getTcePrCatalogItemById(idOrRef);
    if (!catItem) return null;
    return {
      id: catItem.id,
      court: "TCE-PR",
      exists: true,
      source: "CURATED_CATALOG",
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
            entidade: "ORGAO_CONTRATANTE",
            regimeLegal: "LEI_14133_ADM_DIRETA",
            indexacao: [parsed.indexacao || "JURISPRUDÊNCIA TCE-PR"],
            tese: parsed.tese,
            dispositivo: parsed.dispositivo,
            inteiroTeorTexto: `${parsed.tese}\n\n${parsed.dispositivo}`,
            outcome: "IMPROCEDENTE_MANUTENCAO_CERTAME",
          },
        };
      }
    }
    return null;
  }

  private mapCatalogItemToResult(item: TcePrNormativeItem): RawJurisSearchResult {
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
    };
  }

  protected mapMockHitToResult(hit: any): RawJurisSearchResult {
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
        numAto && anoAto
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
        ano: anoAto,
        processo: procMatch ? procMatch[1] : undefined,
        relator: relatorMatch ? relatorMatch[1].trim() : "Tribunal Pleno",
        dataSessao: dataMatch ? dataMatch[1] : undefined,
        indexacao: "JURISPRUDÊNCIA TCE-PR; DELIBERAÇÃO PLENÁRIA",
        tese: ementa,
        dispositivo: ementa.slice(0, 300),
      });
    }

    return results;
  }
}
