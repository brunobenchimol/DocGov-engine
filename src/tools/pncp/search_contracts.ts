import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { VERSION } from "../../constants/index.ts";
import { withDirectoryLock, writeFileSafeSync } from "../../utils/fs_safe_io.ts";
import { createPncpSearchContractError } from "../../contracts/errors.ts";
import { resolveWorkspacePath } from "../../utils/paths.ts";
import { resolveEphemeralTargetDir } from "../../utils/ephemeral_scope.ts";
import { toShortDocPath } from "../inspect.ts";
import {
  parsePncpIdentifier,
  resolveAndParsePncpIdentifier,
} from "./identifier_and_redirects.ts";
import type {
  SearchPncpOptions,
  PncpSearchCandidate,
  SearchPncpResult,
  SearchPncpSyntheticResult,
  SearchPncpSyntheticCandidate,
} from "../../types/index.ts";
/**
 * 8ª Ferramenta MCP: search_pncp
 * Busca textual multi-query na API do PNCP (/api/search/) com desduplicação automática,
 * acumulação preservando o Objeto Completo em state/pncp_search_results.json e .md
 * e suporte a consultas isoladas ou múltiplas separadas por pipe '|'.
 */
export async function searchPncpContracts(
  caseDir: string,
  query: string | string[],
  options: SearchPncpOptions = {}
): Promise<SearchPncpResult> {
  if (!caseDir || typeof caseDir !== "string") {
    throw createPncpSearchContractError("Parâmetro 'caseDir' é obrigatório.");
  }

  const resolvedCaseDir = resolveWorkspacePath(caseDir);
  const { targetDir: stateDir } = resolveEphemeralTargetDir({
    caseDir: resolvedCaseDir,
    prefix: "pncp_search",
    appendStateIfCase: true,
    appendStateIfNamedEphemeral: false,
  });
  mkdirSync(stateDir, { recursive: true });

  // 1. Normalização de queries (suporta array ou string com separador '|')
  let rawQueries: string[] = [];
  if (Array.isArray(query)) {
    rawQueries = query.map((q) => String(q || "").trim()).filter(Boolean);
  } else if (typeof query === "string") {
    rawQueries = query
      .split("|")
      .map((q) => q.trim())
      .filter(Boolean);
  }

  if (rawQueries.length === 0) {
    throw createPncpSearchContractError(
      "Parâmetro 'query' deve conter ao menos um termo de busca válido."
    );
  }

  const baseUrl = (
    options.baseUrl ||
    process.env.DOCGOV_PNCP_BASE_URL ||
    "https://pncp.gov.br"
  ).replace(/\/+$/, "");

  const timeoutMs = options.timeoutMs || 30000;
  const limit = Math.min(Math.max(options.limit || 10, 1), 20);

  const headers = {
    Accept: "application/json, */*",
    "User-Agent": `docgov-engine/${VERSION}`,
  };

  const currentCandidates: PncpSearchCandidate[] = [];
  const seenCandidateIds = new Set<string>();

  // 2. Execução das buscas
  for (const q of rawQueries) {
    // Caso o termo seja um identificador direto ou URL de redirect do Google Grounding
    if (/^https?:\/\//i.test(q) || /^\d{14}/.test(q)) {
      try {
        const id = await resolveAndParsePncpIdentifier(q, timeoutMs);
        if (id) {
          // Consulta metadados diretamente para catalogar como candidato
          const metaUrl = `${baseUrl}/api/consulta/v1/orgaos/${id.cnpj}/compras/${id.ano}/${id.sequencial}`;
          const res = await fetch(metaUrl, {
            headers,
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (res.ok) {
            const meta = await res.json();
            const cand: PncpSearchCandidate = {
              pncp_id: id.canonicalRef,
              numero_controle_pncp:
                meta.numeroControlePNCP || meta.numero_controle_pncp,
              orgao_nome:
                meta.orgaoEntidade?.razaoSocial ||
                meta.nomeOrgao ||
                "Órgão de Referência",
              orgao_cnpj: id.cnpj,
              unidade_nome: meta.unidadeOrgao?.nomeUnidade,
              uf: meta.unidadeOrgao?.ufSigla,
              municipio_nome: meta.unidadeOrgao?.municipioNome,
              titulo:
                meta.objetoCompra || meta.objeto || `Contratação ${id.canonicalRef}`,
              objeto: meta.objetoCompra || meta.objeto || "Não informado",
              modalidade:
                meta.modalidadeNome ||
                meta.modalidade_licitacao_nome ||
                "Contratação Pública",
              valor_global:
                meta.valorTotalEstimado !== undefined
                  ? Number(meta.valorTotalEstimado)
                  : meta.valorTotalHomologado !== undefined
                  ? Number(meta.valorTotalHomologado)
                  : null,
              data_publicacao:
                meta.dataPublicacaoPncp || meta.data_publicacao_pncp,
              situacao_nome: meta.situacaoCompraNome || meta.situacao_nome,
              pncp_url: `https://pncp.gov.br/app/editais/${id.cnpj}/${id.ano}/${id.sequencial}`,
              matched_query: q,
            };

            if (!seenCandidateIds.has(cand.pncp_id)) {
              seenCandidateIds.add(cand.pncp_id);
              currentCandidates.push(cand);
            }
            continue;
          }
        }
      } catch {
        // Se não for identificador válido, prossegue para busca textual padrão
      }
    }

    // Consulta textual no endpoint público /api/search/
    let searchUrl = `${baseUrl}/api/search/?q=${encodeURIComponent(q)}&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=${limit}`;
    if (options.status && options.status !== "todas") {
      searchUrl += `&status=${encodeURIComponent(options.status)}`;
    }
    if (options.uf) {
      searchUrl += `&uf=${encodeURIComponent(options.uf.toUpperCase())}`;
    }

    try {
      const res = await fetch(searchUrl, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        continue;
      }

      const data: any = await res.json();
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];

      for (const item of rawList) {
        let cnpj =
          item.orgao_cnpj ||
          item.cnpj ||
          item.orgaoCnpj ||
          item.orgaoEntidade?.cnpj ||
          "";
        let ano = String(item.ano || item.anoCompra || "");
        let sequencial = String(
          item.numero_sequencial ||
            item.sequencialCompra ||
            item.sequencial ||
            ""
        ).replace(/^0+/, "");

        if (!cnpj || !ano || !sequencial) {
          const refString =
            item.numero_controle_pncp || item.item_url || item.url;
          if (refString) {
            try {
              const parsed = parsePncpIdentifier(refString);
              cnpj = cnpj || parsed.cnpj;
              ano = ano || parsed.ano;
              sequencial = sequencial || parsed.sequencial;
            } catch {}
          }
        }

        if (!cnpj || !ano) {
          continue;
        }

        sequencial = sequencial || "0";
        const pncp_id = `${cnpj}/${ano}/${sequencial}`;

        if (seenCandidateIds.has(pncp_id)) {
          continue;
        }

        const orgao_nome =
          item.orgao_nome ||
          item.nomeOrgao ||
          item.orgaoEntidade?.razaoSocial ||
          "Órgão Licitante";
        const unidade_nome = item.unidade_nome || item.unidadeOrgao?.nomeUnidade;
        const uf =
          item.uf ||
          item.unidade_uf ||
          item.orgao_uf ||
          item.unidadeOrgao?.ufSigla;
        const municipio_nome =
          item.municipio_nome || item.unidadeOrgao?.municipioNome;
        const modalidade =
          item.modalidade_licitacao_nome ||
          item.modalidadeNome ||
          item.modalidade ||
          "Contratação Pública";
        const titulo =
          item.title ||
          item.titulo ||
          item.numero_controle_pncp ||
          `Edital ${pncp_id}`;
        const objeto =
          item.description ||
          item.objeto ||
          item.objetoCompra ||
          item.title ||
          "Não informado";
        const valor_global =
          item.valor_global !== undefined && item.valor_global !== null
            ? Number(item.valor_global)
            : item.valorTotalEstimado !== undefined &&
              item.valorTotalEstimado !== null
            ? Number(item.valorTotalEstimado)
            : item.valor_total_estimado !== undefined &&
              item.valor_total_estimado !== null
            ? Number(item.valor_total_estimado)
            : null;
        const data_publicacao =
          item.data_publicacao_pncp ||
          item.dataPublicacaoPncp ||
          item.createdAt ||
          undefined;
        const situacao_nome =
          item.situacao_nome || item.situacaoCompraNome || undefined;

        // Filtro em memória de UF
        if (
          options.uf &&
          uf &&
          uf.trim().toUpperCase() !== options.uf.trim().toUpperCase()
        ) {
          continue;
        }

        // Filtro em memória de Modalidade
        if (
          options.modalidade &&
          !modalidade.toLowerCase().includes(options.modalidade.toLowerCase())
        ) {
          continue;
        }

        const candidate: PncpSearchCandidate = {
          pncp_id,
          numero_controle_pncp: item.numero_controle_pncp,
          orgao_nome,
          orgao_cnpj: cnpj,
          unidade_nome,
          uf,
          municipio_nome,
          titulo,
          objeto,
          modalidade,
          valor_global,
          data_publicacao,
          situacao_nome,
          pncp_url: `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${sequencial}`,
          matched_query: q,
        };

        seenCandidateIds.add(pncp_id);
        currentCandidates.push(candidate);

        if (currentCandidates.length >= limit * rawQueries.length) {
          break;
        }
      }
    } catch {
      // Falha individual na query não aborta as demais queries
    }
  }

  // 3. Acumulação e Mesclagem Concorrente Protegida por Lock
  const resultsJsonPath = resolve(stateDir, "pncp_search_results.json");
  const resultsMdPath = resolve(stateDir, "pncp_search_results.md");

  const allConsolidated = await withDirectoryLock(
    stateDir,
    "pncp_search",
    async () => {
      let accumulatedCandidates: PncpSearchCandidate[] = [];
      if (existsSync(resultsJsonPath)) {
        try {
          const existing = JSON.parse(readFileSync(resultsJsonPath, "utf-8"));
          if (Array.isArray(existing.candidates)) {
            accumulatedCandidates = existing.candidates;
          }
        } catch {}
      }

      const mergedMap = new Map<string, PncpSearchCandidate>();
      for (const c of currentCandidates) {
        mergedMap.set(c.pncp_id, c);
      }
      for (const c of accumulatedCandidates) {
        if (!mergedMap.has(c.pncp_id)) {
          mergedMap.set(c.pncp_id, c);
        }
      }

      const consolidated = Array.from(mergedMap.values());

      // 4. Gravação de state/pncp_search_results.json
      const jsonOutput = {
        updated_at: new Date().toISOString(),
        last_queries: rawQueries,
        total_candidates: consolidated.length,
        new_candidates_count: currentCandidates.length,
        candidates: consolidated,
      };
      writeFileSafeSync(resultsJsonPath, JSON.stringify(jsonOutput, null, 2));

      // 5. Gravação de state/pncp_search_results.md (Tabela Completa com Objeto Integral)
      let mdContent = `# Resultados da Busca PNCP — Painel de Oportunidades & Referências\n\n`;
      mdContent += `> Consolidação de editais e contratações públicas para pesquisa de mercado e benchmarking técnico (IN SEGES/ME nº 65/2021).\n`;
      mdContent += `> Consultas executadas: \`${rawQueries.join(" | ")}\` | Total acumulado no caso: **${consolidated.length}** referências.\n\n`;

      mdContent += `| ID Canônico PNCP | Órgão / UF | Modalidade | Valor Estimado | Publicação | Objeto Completo |\n`;
      mdContent += `| :--- | :--- | :---: | :---: | :---: | :--- |\n`;

      for (const c of consolidated) {
        const orgaoUf = `${c.orgao_nome}${c.uf ? ` (${c.uf})` : ""}`;
        const valorStr =
          c.valor_global !== null && c.valor_global !== undefined
            ? `R$ ${Number(c.valor_global).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}`
            : "—";
        const dataPub = c.data_publicacao ? c.data_publicacao.slice(0, 10) : "—";
        const safeObjeto = (c.objeto || "Não informado")
          .replace(/\r?\n/g, " ")
          .replace(/\|/g, "\\|");
        const displayObjeto =
          c.titulo && c.titulo !== c.objeto
            ? `**${c.titulo.replace(/\r?\n/g, " ").replace(/\|/g, "\\|")}**<br>${safeObjeto}`
            : safeObjeto;
        mdContent += `| \`${c.pncp_id}\` | ${orgaoUf} | ${c.modalidade} | ${valorStr} | ${dataPub} | ${displayObjeto} |\n`;
      }

      mdContent += `\n---\n*Para baixar os arquivos e anexos de qualquer referência acima, utilize a ferramenta \`fetch_pncp\` informando o \`pncp_id\` desejado.*\n`;
      writeFileSafeSync(resultsMdPath, mdContent);

      return consolidated;
    }
  );

  return {
    status: "success",
    caseDir: resolvedCaseDir,
    queriesExecuted: rawQueries,
    resultsCount: currentCandidates.length,
    totalAccumulatedCount: allConsolidated.length,
    candidates: currentCandidates,
    resultsJsonPath,
    resultsMdPath,
  };
}

/**
 * Formata o resultado sintético de search_pncp garantindo payload estrito < 900 bytes (Lei 2)
 */
export function formatSearchPncpSyntheticResult(
  result: SearchPncpResult
): SearchPncpSyntheticResult {
  const shortMdPath = toShortDocPath(result.resultsMdPath);
  const shortJsonPath = toShortDocPath(result.resultsJsonPath);

  let candidateLimit = 3;
  let maxObjetoLen = 60;

  const buildSynthetic = (
    limit: number,
    objLen: number
  ): SearchPncpSyntheticResult => {
    const topCandidates: SearchPncpSyntheticCandidate[] = result.candidates
      .slice(0, limit)
      .map((c) => ({
        pncp_id: c.pncp_id,
        orgao_uf: `${c.orgao_nome}${c.uf ? ` (${c.uf})` : ""}`,
        modalidade: c.modalidade,
        objeto_resumo:
          (c.objeto || "").length > objLen
            ? (c.objeto || "").slice(0, objLen - 3).trim() + "..."
            : c.objeto || "",
      }));

    return {
      status: "success",
      engine_version: VERSION,
      queries_executed: result.queriesExecuted,
      results_count: result.resultsCount,
      total_accumulated: result.totalAccumulatedCount,
      results_md_path: shortMdPath,
      results_json_path: shortJsonPath,
      top_candidates: topCandidates,
      next_step_hint: `${result.resultsCount} candidatos encontrados (${result.totalAccumulatedCount} acumulados). Consulte ${basename(result.resultsMdPath)} ou chame fetch_pncp.`,
    };
  };

  let synthetic = buildSynthetic(candidateLimit, maxObjetoLen);
  let jsonLen = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");

  // Se exceder a margem preventiva de 880 bytes, poda progressivamente
  if (jsonLen >= 880 && candidateLimit > 2) {
    candidateLimit = 2;
    synthetic = buildSynthetic(candidateLimit, maxObjetoLen);
    jsonLen = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
  }

  if (jsonLen >= 880) {
    maxObjetoLen = 45;
    synthetic = buildSynthetic(candidateLimit, maxObjetoLen);
    jsonLen = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
  }

  if (jsonLen >= 880 && candidateLimit > 1) {
    candidateLimit = 1;
    synthetic = buildSynthetic(candidateLimit, maxObjetoLen);
  }

  return synthetic;
}
