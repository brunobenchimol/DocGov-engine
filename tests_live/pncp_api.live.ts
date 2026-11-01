import { mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import os from "node:os";
import {
  searchPncpContracts,
  fetchPncpContract,
  resolveAndParsePncpIdentifier,
  formatSearchPncpSyntheticResult,
  formatFetchPncpSyntheticResult,
} from "../src/tools/pncp.ts";
import type { PncpSearchCandidate } from "../src/types/index.ts";

export interface LiveProbeResult {
  name: string;
  status: "PASS" | "FAIL";
  durationMs: number;
  details: string;
  error?: string;
}

/**
 * Caderno de Testes Online de Contrato para a API Oficial do PNCP (pncp.gov.br)
 * Executa sondas contra a API real para detectar Schema Drift, quebras de rotas ou bloqueios.
 */
export async function runPncpLiveProbes(): Promise<LiveProbeResult[]> {
  const probes: LiveProbeResult[] = [];
  const baseTemp = resolve(
    os.tmpdir(),
    `docgov_test_live_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  );
  const liveCaseDir = resolve(baseTemp, "cases", "live_pncp_case");

  mkdirSync(resolve(liveCaseDir, "inputs"), { recursive: true });
  mkdirSync(resolve(liveCaseDir, "state"), { recursive: true });

  let discoveredCandidates: PncpSearchCandidate[] = [];
  let candidateWithFiles: PncpSearchCandidate | null = null;

  try {
    // ------------------------------------------------------------------------
    // Sonda 1: searchPncpContracts (Busca Textual Multi-Query na API real)
    // ------------------------------------------------------------------------
    const startS1 = Date.now();
    try {
      const searchRes = await searchPncpContracts(
        liveCaseDir,
        "software | nuvem",
        { limit: 5, status: "todas", timeoutMs: 25000 }
      );
      const durationS1 = Date.now() - startS1;

      if (!searchRes || searchRes.candidates.length === 0) {
        probes.push({
          name: "Sonda 1: searchPncpContracts multi-query (GET /api/search/)",
          status: "FAIL",
          durationMs: durationS1,
          details: "Nenhum candidato retornado pela busca textual no PNCP.",
          error: "Busca textual retornou lista vazia de candidatos na API de produção.",
        });
      } else {
        discoveredCandidates = searchRes.candidates;
        const first = searchRes.candidates[0];

        // Validar integridade dos campos essenciais do contrato
        const missingFields: string[] = [];
        if (!first.pncp_id) missingFields.push("pncp_id");
        if (!first.orgao_cnpj) missingFields.push("orgao_cnpj");
        if (!first.orgao_nome) missingFields.push("orgao_nome");
        if (!first.titulo && !first.objeto) missingFields.push("titulo/objeto");

        // Validar payload sintético MCP
        const synthetic = formatSearchPncpSyntheticResult(searchRes);
        const payloadBytes = Buffer.byteLength(JSON.stringify(synthetic), "utf-8");

        if (missingFields.length > 0) {
          probes.push({
            name: "Sonda 1: searchPncpContracts multi-query (GET /api/search/)",
            status: "FAIL",
            durationMs: durationS1,
            details: `Campos ausentes no candidato: ${missingFields.join(", ")}`,
            error: "Schema Drift detectado na resposta de busca do PNCP.",
          });
        } else if (payloadBytes >= 1024) {
          probes.push({
            name: "Sonda 1: searchPncpContracts multi-query (GET /api/search/)",
            status: "FAIL",
            durationMs: durationS1,
            details: `Payload sintético MCP violou o teto: ${payloadBytes}B >= 1024B (Lei 2)`,
            error: "Violação de teto de payload MCP.",
          });
        } else {
          probes.push({
            name: "Sonda 1: searchPncpContracts multi-query (GET /api/search/)",
            status: "PASS",
            durationMs: durationS1,
            details: `Retornou ${searchRes.candidates.length} contratações reais. Top: ${first.pncp_id} (${first.orgao_nome}) [Payload: ${payloadBytes}B]`,
          });
        }
      }
    } catch (err: any) {
      probes.push({
        name: "Sonda 1: searchPncpContracts multi-query (GET /api/search/)",
        status: "FAIL",
        durationMs: Date.now() - startS1,
        details: `Exceção ao chamar /api/search/ no PNCP: ${err.message}`,
        error: err.message,
      });
    }

    // ------------------------------------------------------------------------
    // Sonda 2: searchPncpContracts com Filtros (UF e status)
    // ------------------------------------------------------------------------
    const startS2 = Date.now();
    try {
      const filteredRes = await searchPncpContracts(
        liveCaseDir,
        "computador",
        { limit: 3, uf: "DF", status: "todas", timeoutMs: 25000 }
      );
      const durationS2 = Date.now() - startS2;

      probes.push({
        name: "Sonda 2: searchPncpContracts com filtros de UF e status (GET /api/search/?uf=DF)",
        status: "PASS",
        durationMs: durationS2,
        details: `Busca filtrada por UF='DF' executada com sucesso. Retornou ${filteredRes.candidates.length} itens.`,
      });
    } catch (err: any) {
      probes.push({
        name: "Sonda 2: searchPncpContracts com filtros de UF e status (GET /api/search/?uf=DF)",
        status: "FAIL",
        durationMs: Date.now() - startS2,
        details: `Falha ao aplicar filtros na API do PNCP: ${err.message}`,
        error: err.message,
      });
    }

    // ------------------------------------------------------------------------
    // Sonda 3: Lookup Direto de Compra (/api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{seq})
    // ------------------------------------------------------------------------
    const startS3 = Date.now();
    const targetPncpId = discoveredCandidates[0]?.pncp_id;

    if (!targetPncpId) {
      probes.push({
        name: "Sonda 3: Lookup Direto de Compra (/api/consulta/v1/orgaos/...)",
        status: "FAIL",
        durationMs: 0,
        details: "Pulada porque a Sonda 1 não descobriu candidatos.",
        error: "Candidato de referência indisponível.",
      });
    } else {
      try {
        const directRes = await searchPncpContracts(
          liveCaseDir,
          targetPncpId,
          { limit: 1, timeoutMs: 25000 }
        );
        const durationS3 = Date.now() - startS3;

        if (directRes.candidates.length > 0 && directRes.candidates[0].pncp_id === targetPncpId) {
          probes.push({
            name: "Sonda 3: Lookup Direto de Compra (/api/consulta/v1/orgaos/...)",
            status: "PASS",
            durationMs: durationS3,
            details: `Metadados diretos de ${targetPncpId} consultados e parseados com sucesso.`,
          });
        } else {
          probes.push({
            name: "Sonda 3: Lookup Direto de Compra (/api/consulta/v1/orgaos/...)",
            status: "FAIL",
            durationMs: durationS3,
            details: `Lookup direto para ${targetPncpId} não retornou o candidato esperado.`,
            error: "Incompatibilidade no retorno da rota de metadados da compra.",
          });
        }
      } catch (err: any) {
        probes.push({
          name: "Sonda 3: Lookup Direto de Compra (/api/consulta/v1/orgaos/...)",
          status: "FAIL",
          durationMs: Date.now() - startS3,
          details: `Erro ao consultar compra direta no PNCP: ${err.message}`,
          error: err.message,
        });
      }
    }

    // ------------------------------------------------------------------------
    // Sonda 4: Verificação de Contrato da Rota de Anexos (/api/pncp/v1/.../arquivos)
    // ------------------------------------------------------------------------
    const startS4 = Date.now();
    let verifiedFilesEndpoint = false;

    for (const cand of discoveredCandidates) {
      const [cnpj, ano, seq] = cand.pncp_id.split("/");
      const filesUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`;

      try {
        const res = await fetch(filesUrl, {
          headers: { Accept: "application/json", "User-Agent": "docgov-engine/live-test" },
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const filesData: any = await res.json();
          if (Array.isArray(filesData) && filesData.length > 0) {
            candidateWithFiles = cand;
            verifiedFilesEndpoint = true;
            break;
          }
        }
      } catch {
        // Tenta o próximo candidato
      }
    }

    const durationS4 = Date.now() - startS4;
    if (verifiedFilesEndpoint && candidateWithFiles) {
      probes.push({
        name: "Sonda 4: Contrato de Lista de Arquivos (GET /api/pncp/v1/.../arquivos)",
        status: "PASS",
        durationMs: durationS4,
        details: `Rota de anexos validada com sucesso para ${candidateWithFiles.pncp_id}.`,
      });
    } else {
      probes.push({
        name: "Sonda 4: Contrato de Lista de Arquivos (GET /api/pncp/v1/.../arquivos)",
        status: "FAIL",
        durationMs: durationS4,
        details: "Nenhum candidato da lista continha anexos públicos acessíveis no endpoint /arquivos.",
        error: "Rota de arquivos vazia ou indisponível entre os candidatos descobertos.",
      });
    }

    // ------------------------------------------------------------------------
    // Sonda 5: fetchPncpContract E2E (Download Binário Real + Descompactação + Catálogo)
    // ------------------------------------------------------------------------
    const startS5 = Date.now();
    const fetchTargetId = candidateWithFiles?.pncp_id || targetPncpId;

    if (!fetchTargetId) {
      probes.push({
        name: "Sonda 5: fetchPncpContract E2E Real (Download Binário e Catálogo)",
        status: "FAIL",
        durationMs: 0,
        details: "Pulada porque não há ID de contratação disponível.",
        error: "ID de compra ausente.",
      });
    } else {
      try {
        const fetchRes = await fetchPncpContract(
          liveCaseDir,
          fetchTargetId,
          { shortname: "live_check", timeoutMs: 40000 }
        );
        const durationS5 = Date.now() - startS5;

        const targetSubdir = resolve(liveCaseDir, "inputs", "pncp_live_check");
        const metaPath = resolve(liveCaseDir, "state", "pncp_live_check_meta.json");
        const indexMdPath = resolve(liveCaseDir, "state", "indice_pncp_live_check.md");

        const hasSubdir = existsSync(targetSubdir);
        const hasMeta = existsSync(metaPath);
        const hasIndex = existsSync(indexMdPath);

        const synthetic = formatFetchPncpSyntheticResult(fetchRes);
        const payloadBytes = Buffer.byteLength(JSON.stringify(synthetic), "utf-8");

        if (fetchRes.status === "success" && hasSubdir && hasMeta && hasIndex && payloadBytes < 1024) {
          const filesCount = existsSync(targetSubdir) ? readdirSync(targetSubdir).length : 0;
          probes.push({
            name: "Sonda 5: fetchPncpContract E2E Real (Download Binário e Catálogo)",
            status: "PASS",
            durationMs: durationS5,
            details: `Download E2E concluído para ${fetchTargetId}. Arquivos salvos em inputs/pncp_live_check/ (${filesCount} arquivos). Payload: ${payloadBytes}B`,
          });
        } else {
          probes.push({
            name: "Sonda 5: fetchPncpContract E2E Real (Download Binário e Catálogo)",
            status: "FAIL",
            durationMs: durationS5,
            details: `Inconsistência nos artefatos gerados: status=${fetchRes.status}, subdir=${hasSubdir}, meta=${hasMeta}, index=${hasIndex}, payload=${payloadBytes}B`,
            error: "Falha na geração dos artefatos de inputs/ ou state/.",
          });
        }
      } catch (err: any) {
        probes.push({
          name: "Sonda 5: fetchPncpContract E2E Real (Download Binário e Catálogo)",
          status: "FAIL",
          durationMs: Date.now() - startS5,
          details: `Falha no download real de ${fetchTargetId}: ${err.message}`,
          error: err.message,
        });
      }
    }

    // ------------------------------------------------------------------------
    // Sonda 6: resolveAndParsePncpIdentifier com URLs oficiais reais
    // ------------------------------------------------------------------------
    const startS6 = Date.now();
    try {
      const sampleId = discoveredCandidates[0]?.pncp_id || "00394460000141/2026/15";
      const [sampleCnpj, sampleAno, sampleSeq] = sampleId.split("/");
      const officialUrl = `https://pncp.gov.br/app/editais/${sampleCnpj}/${sampleAno}/${sampleSeq}`;

      const parsed = await resolveAndParsePncpIdentifier(officialUrl, 10000);
      const durationS6 = Date.now() - startS6;

      if (parsed.cnpj === sampleCnpj && parsed.ano === sampleAno) {
        probes.push({
          name: "Sonda 6: resolveAndParsePncpIdentifier com URL oficial web",
          status: "PASS",
          durationMs: durationS6,
          details: `URL real parseada corretamente para ref canônica ${parsed.canonicalRef}.`,
        });
      } else {
        probes.push({
          name: "Sonda 6: resolveAndParsePncpIdentifier com URL oficial web",
          status: "FAIL",
          durationMs: durationS6,
          details: `Parsing divergente: esperado ${sampleId}, obtido ${parsed.canonicalRef}`,
          error: "Divergência de identificador parseado.",
        });
      }
    } catch (err: any) {
      probes.push({
        name: "Sonda 6: resolveAndParsePncpIdentifier com URL oficial web",
        status: "FAIL",
        durationMs: Date.now() - startS6,
        details: `Erro ao parsear URL oficial do PNCP: ${err.message}`,
        error: err.message,
      });
    }
  } finally {
    // Limpeza mandatória de dados temporários de teste
    if (existsSync(baseTemp)) {
      try {
        rmSync(baseTemp, { recursive: true, force: true });
      } catch {
        // Ignora eventual lock de diretório efêmero no Windows
      }
    }
  }

  return probes;
}
