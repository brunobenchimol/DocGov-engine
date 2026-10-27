import {
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  readFileSync,
} from "node:fs";
import { resolve, join, basename, extname } from "node:path";
import { VERSION } from "../constants/index.ts";
import {
  createPncpIdentifierContractError,
  createPncpSearchContractError,
} from "../contracts/errors.ts";
import { resolveWorkspacePath } from "../utils/paths.ts";
import { detectFileType, extractArchiveBuffer } from "../utils/archives.ts";
import { inspectDoc, toShortDocPath } from "./inspect.ts";
import type {
  PncpIdentifier,
  FetchPncpOptions,
  FetchPncpResult,
  FetchPncpSyntheticResult,
  PncpDownloadedFileSummary,
  UnpackedArchiveSummary,
  SearchPncpOptions,
  PncpSearchCandidate,
  SearchPncpResult,
  SearchPncpSyntheticResult,
  SearchPncpSyntheticCandidate,
} from "../types/index.ts";

// ============================================================================
// Conector Nativo PNCP (Portal Nacional de Contratações Públicas) — v1.3.5
// ============================================================================

/**
 * Faz o parsing universal de identificadores PNCP nos 3 formatos canônicos aceitos:
 * 1. Número de Controle PNCP (impresso em editais): "00394460000141-1-000015/2026"
 * 2. URL do Portal Web ou API: "https://pncp.gov.br/app/editais/00394460000141/2026/15"
 * 3. Tupla Simplificada: "00394460000141/2026/15"
 */
export function parsePncpIdentifier(input: string): PncpIdentifier {
  if (!input || typeof input !== "string") {
    throw createPncpIdentifierContractError(String(input || ""));
  }

  const trimmed = input.trim();

  // Formato 1: Número de Controle PNCP (ex: 00394460000141-1-000015/2026)
  const controlMatch = trimmed.match(/^(\d{14})-\d+-0*(\d+)\/(\d{4})$/);
  if (controlMatch) {
    const cnpj = controlMatch[1];
    const sequencial = controlMatch[2] || "0";
    const ano = controlMatch[3];
    return {
      cnpj,
      ano,
      sequencial,
      canonicalRef: `${cnpj}/${ano}/${sequencial}`,
    };
  }

  // Formato 2: URL do Portal Web ou API REST do PNCP
  // Suporta:
  // - https://pncp.gov.br/app/editais/00394460000141/2026/15
  // - https://pncp.gov.br/app/compras/00394460000141/2026/15
  // - https://pncp.gov.br/api/pncp/v1/orgaos/00394460000141/compras/2026/15
  // - https://pncp.gov.br/api/consulta/v1/orgaos/00394460000141/compras/2026/15
  const urlMatch1 = trimmed.match(
    /\/(?:editais|compras)\/(\d{14})\/(\d{4})\/0*(\d+)/i
  );
  if (urlMatch1) {
    const cnpj = urlMatch1[1];
    const ano = urlMatch1[2];
    const sequencial = urlMatch1[3] || "0";
    return {
      cnpj,
      ano,
      sequencial,
      canonicalRef: `${cnpj}/${ano}/${sequencial}`,
    };
  }

  const urlMatch2 = trimmed.match(
    /\/orgaos\/(\d{14})\/compras\/(\d{4})\/0*(\d+)/i
  );
  if (urlMatch2) {
    const cnpj = urlMatch2[1];
    const ano = urlMatch2[2];
    const sequencial = urlMatch2[3] || "0";
    return {
      cnpj,
      ano,
      sequencial,
      canonicalRef: `${cnpj}/${ano}/${sequencial}`,
    };
  }

  // Formato 3: Tupla Simplificada CNPJ/ANO/SEQUENCIAL (ex: 00394460000141/2026/15)
  const tupleMatch = trimmed.match(/^(\d{14})\/(\d{4})\/0*(\d+)$/);
  if (tupleMatch) {
    const cnpj = tupleMatch[1];
    const ano = tupleMatch[2];
    const sequencial = tupleMatch[3] || "0";
    return {
      cnpj,
      ano,
      sequencial,
      canonicalRef: `${cnpj}/${ano}/${sequencial}`,
    };
  }

  // Fail-Fast estrito (Lei 3 — Exact Copy-Paste Error)
  throw createPncpIdentifierContractError(trimmed);
}

/**
 * Resolve URLs de redirecionamento HTTP (ex: links opacos do Google Grounding
 * 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/...' ou encurtadores),
 * inspecionando o cabeçalho 'Location' com redirect 'manual' para extrair a URL de destino
 * sem abrir conexões externas desnecessárias quando o destino for o PNCP.
 */
export async function resolvePncpRedirectUrl(
  inputUrl: string,
  timeoutMs = 15000
): Promise<string> {
  if (!inputUrl || typeof inputUrl !== "string") {
    return String(inputUrl || "");
  }

  const trimmed = inputUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Se já possui o padrão canônico do PNCP, não requer resolução de redirect
  if (
    /\/(?:editais|compras)\/\d{14}\/\d{4}\/\d+/i.test(trimmed) ||
    /\/orgaos\/\d{14}\/compras\/\d{4}\/\d+/i.test(trimmed)
  ) {
    return trimmed;
  }

  let currentUrl = trimmed;
  const maxHops = 5;

  for (let hop = 0; hop < maxHops; hop++) {
    try {
      let res: Response;
      try {
        res = await fetch(currentUrl, {
          method: "HEAD",
          redirect: "manual",
          headers: {
            "User-Agent": `docgov-engine/${VERSION}`,
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        res = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          headers: {
            "User-Agent": `docgov-engine/${VERSION}`,
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
      }

      const status = res.status;
      const location = res.headers.get("location");

      if ([301, 302, 303, 307, 308].includes(status) && location) {
        let nextUrl: string;
        try {
          nextUrl = new URL(location, currentUrl).href;
        } catch {
          nextUrl = location;
        }

        // Se o Location apontar para um edital/compra do PNCP, retorna imediatamente!
        if (
          /\/(?:editais|compras)\/\d{14}\/\d{4}\/\d+/i.test(nextUrl) ||
          /\/orgaos\/\d{14}\/compras\/\d{4}\/\d+/i.test(nextUrl)
        ) {
          return nextUrl;
        }

        currentUrl = nextUrl;
        continue;
      }

      if (res.url && res.url !== currentUrl) {
        return res.url;
      }

      break;
    } catch {
      break;
    }
  }

  return currentUrl;
}

/**
 * Tenta fazer o parsing síncrono do identificador PNCP; se falhar e a entrada for
 * uma URL HTTP/HTTPS, resolve eventuais redirects (ex: Google Grounding) e repete o parsing.
 */
export async function resolveAndParsePncpIdentifier(
  input: string,
  timeoutMs = 15000
): Promise<PncpIdentifier> {
  if (!input || typeof input !== "string") {
    throw createPncpIdentifierContractError(String(input || ""));
  }

  const trimmed = input.trim();
  try {
    return parsePncpIdentifier(trimmed);
  } catch (syncErr) {
    if (/^https?:\/\//i.test(trimmed)) {
      const resolvedUrl = await resolvePncpRedirectUrl(trimmed, timeoutMs);
      if (resolvedUrl !== trimmed) {
        return parsePncpIdentifier(resolvedUrl);
      }
    }
    throw syncErr;
  }
}

/**
 * Sanitiza o shortname garantindo nome seguro para a subpasta isolada em inputs/pncp_<shortname>/
 */
export function sanitizePncpShortname(
  raw?: string,
  id?: PncpIdentifier
): string {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    if (id) {
      return `${id.cnpj}_${id.ano}_${id.sequencial}`;
    }
    return "contratacao";
  }

  let cleaned = raw
    .trim()
    .replace(/^pncp_+/i, "") // remove prefixo redundante
    .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  if (!cleaned) {
    if (id) {
      return `${id.cnpj}_${id.ano}_${id.sequencial}`;
    }
    return "contratacao";
  }

  return cleaned;
}

/**
 * Extrai o nome de arquivo a partir do header Content-Disposition ou metadados
 */
function extractFileNameFromHeaderOrMeta(
  contentDisposition: string | null,
  fallbackMetaName?: string,
  seqDoc?: number | string
): string {
  if (contentDisposition) {
    // Tenta formato RFC 5987: filename*=UTF-8''...
    const utf8Match = contentDisposition.match(
      /filename\*=(?:UTF-8|utf-8)''([^;]+)/i
    );
    if (utf8Match && utf8Match[1]) {
      try {
        return decodeURIComponent(utf8Match[1].trim());
      } catch {
        return utf8Match[1].trim();
      }
    }

    // Tenta formato padrão: filename="nome.ext" ou filename=nome.ext
    const stdMatch = contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
    if (stdMatch && stdMatch[1]) {
      return stdMatch[1].trim();
    }
  }

  if (fallbackMetaName && fallbackMetaName.trim()) {
    return fallbackMetaName.trim();
  }

  return `anexo_pncp_${seqDoc || Date.now()}`;
}

/**
 * Conector Nativo PNCP:
 * Baixa metadados e arquivos de uma contratação do PNCP com isolamento estrito
 * na subpasta `cases/<slug>/inputs/pncp_<shortname>/` e catalogação leve de benchmarking.
 */
export async function fetchPncpContract(
  caseDir: string,
  pncpIdOrUrl: string,
  options: FetchPncpOptions = {}
): Promise<FetchPncpResult> {
  const resolvedCaseDir = resolveWorkspacePath(caseDir);
  const id = await resolveAndParsePncpIdentifier(pncpIdOrUrl, options.timeoutMs);
  const shortname = sanitizePncpShortname(options.shortname, id);

  const targetDir = resolve(resolvedCaseDir, "inputs", `pncp_${shortname}`);
  const stateDir = resolve(resolvedCaseDir, "state");

  mkdirSync(targetDir, { recursive: true });
  mkdirSync(stateDir, { recursive: true });

  const baseUrl = (
    options.baseUrl ||
    process.env.DOCGOV_PNCP_BASE_URL ||
    "https://pncp.gov.br"
  ).replace(/\/+$/, "");

  const timeoutMs = options.timeoutMs || 30000;
  const headers = {
    Accept: "application/json, */*",
    "User-Agent": `docgov-engine/${VERSION}`,
  };

  // 1. Consulta Metadados da Contratação
  let contractMeta: Record<string, any> = {};
  const metaUrl1 = `${baseUrl}/api/consulta/v1/orgaos/${id.cnpj}/compras/${id.ano}/${id.sequencial}`;
  const metaUrl2 = `${baseUrl}/api/pncp/v1/orgaos/${id.cnpj}/compras/${id.ano}/${id.sequencial}`;

  try {
    const res1 = await fetch(metaUrl1, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res1.ok) {
      contractMeta = await res1.json();
    } else if (res1.status === 404) {
      const res2 = await fetch(metaUrl2, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res2.ok) {
        contractMeta = await res2.json();
      } else {
        throw new Error(
          `Falha ao consultar metadados da compra no PNCP (HTTP ${res2.status}): ${res2.statusText}`
        );
      }
    } else {
      throw new Error(
        `Falha ao consultar metadados da compra no PNCP (HTTP ${res1.status}): ${res1.statusText}`
      );
    }
  } catch (err: any) {
    throw new Error(
      `Erro de conexão ao buscar metadados no PNCP (${id.canonicalRef}): ${err.message}`
    );
  }

  // 2. Consulta Lista de Arquivos/Anexos
  let rawFilesList: any[] = [];
  const filesUrl1 = `${baseUrl}/api/pncp/v1/orgaos/${id.cnpj}/compras/${id.ano}/${id.sequencial}/arquivos`;
  const filesUrl2 = `${baseUrl}/api/consulta/v1/orgaos/${id.cnpj}/compras/${id.ano}/${id.sequencial}/arquivos`;

  try {
    const res1 = await fetch(filesUrl1, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res1.ok) {
      rawFilesList = await res1.json();
    } else if (res1.status === 404) {
      const res2 = await fetch(filesUrl2, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res2.ok) {
        rawFilesList = await res2.json();
      } else {
        // Pode ser uma compra válida que não possui anexos cadastrados
        rawFilesList = [];
      }
    } else {
      rawFilesList = [];
    }
  } catch {
    rawFilesList = [];
  }

  if (!Array.isArray(rawFilesList)) {
    rawFilesList = [];
  }

  const downloadedFiles: PncpDownloadedFileSummary[] = [];
  const unpackedArchives: UnpackedArchiveSummary[] = [];
  let filesDownloadedCount = 0;

  // 3. Download Binário dos Anexos para inputs/pncp_<shortname>/
  for (const item of rawFilesList) {
    const seqDoc = item.sequencialDocumento ?? item.sequencial ?? item.id;
    let downloadUrl: string;

    if (item.url && typeof item.url === "string") {
      if (item.url.startsWith("http://") || item.url.startsWith("https://")) {
        // Se a base configurada for um servidor local mockado em testes, reancora para a porta local
        if (
          baseUrl.includes("127.0.0.1") ||
          baseUrl.includes("localhost")
        ) {
          try {
            const parsedUrl = new URL(item.url);
            downloadUrl = `${baseUrl}${parsedUrl.pathname}${parsedUrl.search}`;
          } catch {
            downloadUrl = item.url;
          }
        } else {
          downloadUrl = item.url;
        }
      } else {
        downloadUrl = `${baseUrl}/${item.url.replace(/^\/+/, "")}`;
      }
    } else {
      downloadUrl = `${baseUrl}/api/pncp/v1/orgaos/${id.cnpj}/compras/${id.ano}/${id.sequencial}/arquivos/${seqDoc}`;
    }

    try {
      const fileRes = await fetch(downloadUrl, {
        headers: { Accept: "*/*", "User-Agent": `docgov-engine/${VERSION}` },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!fileRes.ok) {
        continue;
      }

      filesDownloadedCount++;
      const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
      const disposition = fileRes.headers.get("content-disposition");
      const fallbackName =
        item.nomeArquivo ||
        item.titulo ||
        item.nome ||
        `anexo_${seqDoc || Date.now()}`;

      let candidateName = extractFileNameFromHeaderOrMeta(
        disposition,
        fallbackName,
        seqDoc
      );

      // Classifica tipo estrutural via libmagic
      const detection = await detectFileType(fileBuffer, candidateName);

      // Se não possui extensão ou se é diferente da detectada, anexa a extensão sugerida
      const currentExt = extname(candidateName).toLowerCase();
      if (!currentExt && detection.suggestedExtension) {
        candidateName = `${candidateName}${detection.suggestedExtension}`;
      }

      const initialSavePath = resolve(targetDir, candidateName);
      writeFileSync(initialSavePath, fileBuffer);

      if (detection.isArchive) {
        // Descompactação automática in-place
        try {
          const extractedEntries = await extractArchiveBuffer(
            fileBuffer,
            candidateName
          );
          const savedEntries: Array<{
            originalEntryName: string;
            savedAs: string;
            size: number;
          }> = [];

          for (const entry of extractedEntries) {
            const entryPath = resolve(targetDir, entry.fileName);
            writeFileSync(entryPath, entry.data);
            savedEntries.push({
              originalEntryName: entry.originalPath,
              savedAs: entry.fileName,
              size: entry.size,
            });
          }

          unpackedArchives.push({
            archiveName: candidateName,
            archiveType: detection.type as "zip" | "tar" | "tar.gz",
            extractedCount: savedEntries.length,
            files: savedEntries,
          });

          downloadedFiles.push({
            sequencialDocumento: seqDoc,
            originalTitle: item.titulo || candidateName,
            savedAs: candidateName,
            detectedType: detection.type,
            size: fileBuffer.length,
            wasArchive: true,
            extractedFiles: savedEntries.map((e) => e.savedAs),
          });

          // Remove o pacote compactado bruto após a extração para evitar duplicidade
          if (existsSync(initialSavePath)) {
            unlinkSync(initialSavePath);
          }
        } catch (unpErr: any) {
          console.error("DEBUG unpErr:", unpErr);
          downloadedFiles.push({
            sequencialDocumento: seqDoc,
            originalTitle: item.titulo || candidateName,
            savedAs: candidateName,
            detectedType: detection.type,
            size: fileBuffer.length,
            wasArchive: true,
            extractedFiles: [],
          });
        }
      } else {
        downloadedFiles.push({
          sequencialDocumento: seqDoc,
          originalTitle: item.titulo || candidateName,
          savedAs: candidateName,
          detectedType: detection.type,
          size: fileBuffer.length,
          wasArchive: false,
        });
      }
    } catch {
      // Falhas individuais de download não abortam os demais arquivos
    }
  }

  // 4. Catalogação Leve de Referência (em memória, sem gravar arquivos de auditoria em state/)
  const allFilesInTargetDir = readdirSync(targetDir);
  let inspectedCount = 0;
  const failedInspections: Array<{ fileName: string; error: string }> = [];

  for (const fileName of allFilesInTargetDir) {
    const ext = extname(fileName).toLowerCase();
    const isDoc = [
      ".docx",
      ".pdf",
      ".xlsx",
      ".xls",
      ".csv",
      ".md",
      ".txt",
    ].includes(ext);

    if (isDoc) {
      const fullFilePath = resolve(targetDir, fileName);
      try {
        const inMemoryInspection = await inspectDoc(
          fullFilePath,
          undefined,
          true,
          { skipAuditArtifacts: true }
        );
        inspectedCount++;

        // Coleta resumo leve de tópicos/seções para o catálogo
        const headings: string[] = [];
        if (inMemoryInspection.outline_headings) {
          for (const h of inMemoryInspection.outline_headings.slice(0, 5)) {
            headings.push(`${h.coord ? `[${h.coord}] ` : ""}${h.title}`);
          }
        } else if (inMemoryInspection.toc_map?.sections) {
          for (const s of inMemoryInspection.toc_map.sections.slice(0, 5)) {
            headings.push(`${s.coord ? `[${s.coord}] ` : ""}${s.title}`);
          }
        }

        // Associa os tópicos ao resumo do arquivo
        const existingSummary = downloadedFiles.find(
          (f) =>
            f.savedAs === fileName ||
            (f.extractedFiles && f.extractedFiles.includes(fileName))
        );

        if (existingSummary && existingSummary.savedAs === fileName) {
          existingSummary.headingsPreview = headings;
          existingSummary.sectionsCount =
            inMemoryInspection.toc_map?.sections?.length || headings.length;
        } else {
          // Arquivo originado de descompactação
          downloadedFiles.push({
            originalTitle: fileName,
            savedAs: fileName,
            detectedType: inMemoryInspection.doc_type || ext.replace(/^\./, ""),
            size: readFileSync(fullFilePath).length,
            wasArchive: false,
            headingsPreview: headings,
            sectionsCount:
              inMemoryInspection.toc_map?.sections?.length || headings.length,
          });
        }
      } catch (insErr: any) {
        failedInspections.push({ fileName, error: insErr.message });
      }
    }
  }

  // 5. Persistência dos 2 Artefatos de Catálogo de Referência em state/
  const metaPath = resolve(stateDir, `pncp_${shortname}_meta.json`);
  const indexPath = resolve(stateDir, `indice_pncp_${shortname}.md`);

  const metaData = {
    pncp_ref: id.canonicalRef,
    shortname,
    fetched_at: new Date().toISOString(),
    contract: contractMeta,
    files_downloaded_count: downloadedFiles.length,
    unpacked_archives: unpackedArchives,
    files_catalog: downloadedFiles,
  };
  writeFileSync(metaPath, JSON.stringify(metaData, null, 2), "utf-8");

  // Geração do Markdown do Catálogo de Referência (sem auditoria nem Radar Z1..Z14)
  const orgaoNome =
    contractMeta.orgaoEntidade?.razaoSocial ||
    contractMeta["orgaoSub-rogado"]?.razaoSocial ||
    contractMeta.nomeOrgao ||
    "Órgão de Referência PNCP";
  const objeto = contractMeta.objetoCompra || contractMeta.objeto || "Não informado";
  const modalidade =
    contractMeta.modalidadeNome ||
    contractMeta.modalidadeId ||
    "Contratação Pública";
  const valorTotal =
    contractMeta.valorTotalEstimado !== undefined
      ? `R$ ${Number(contractMeta.valorTotalEstimado).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}`
      : contractMeta.valorTotalHomologado !== undefined
      ? `R$ ${Number(contractMeta.valorTotalHomologado).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}`
      : "Não informado";

  let mdContent = `# Catálogo de Insumos PNCP — ${shortname}\n\n`;
  mdContent += `> Documento de referência externa baixado via conector PNCP para benchmarking técnico e pesquisa de mercado (IN SEGES/ME nº 65/2021).\n\n`;
  mdContent += `## 1. Dados da Contratação de Referência\n`;
  mdContent += `- **Referência Canônica PNCP:** \`${id.canonicalRef}\`\n`;
  mdContent += `- **Órgão/Entidade:** ${orgaoNome}\n`;
  mdContent += `- **CNPJ:** \`${id.cnpj}\`\n`;
  mdContent += `- **Ano / Sequencial:** \`${id.ano} / ${id.sequencial}\`\n`;
  mdContent += `- **Modalidade:** ${modalidade}\n`;
  mdContent += `- **Valor Estimado/Homologado:** ${valorTotal}\n`;
  mdContent += `- **Objeto:** ${objeto}\n\n`;

  mdContent += `## 2. Inventário de Arquivos Disponíveis em \`inputs/pncp_${shortname}/\`\n\n`;
  mdContent += `| Arquivo | Formato | Tamanho (KB) | Status | Tópicos / Seções Identificados |\n`;
  mdContent += `| :--- | :---: | :---: | :---: | :--- |\n`;

  for (const f of downloadedFiles) {
    const sizeKb = (f.size / 1024).toFixed(1);
    const status = f.wasArchive ? "Pacote Descompactado" : "Pronto p/ Leitura";
    const sampleHeadings =
      f.headingsPreview && f.headingsPreview.length > 0
        ? f.headingsPreview.slice(0, 3).join("; ")
        : "—";
    mdContent += `| \`${f.savedAs}\` | \`${f.detectedType}\` | ${sizeKb} | ${status} | ${sampleHeadings} |\n`;
  }

  if (unpackedArchives.length > 0) {
    mdContent += `\n### Pacotes Compactados Extraídos\n\n`;
    for (const arc of unpackedArchives) {
      mdContent += `- **Pacote:** \`${arc.archiveName}\` (${arc.archiveType.toUpperCase()}) — **${arc.extractedCount}** arquivos extraídos diretamente em \`inputs/pncp_${shortname}/\`.\n`;
    }
  }

  mdContent += `\n---\n*Catálogo gerado deterministicamente por docgov-engine v${VERSION}.*\n`;
  writeFileSync(indexPath, mdContent, "utf-8");

  return {
    status: "success",
    pncpRef: id.canonicalRef,
    shortname,
    caseDir: resolvedCaseDir,
    targetDir,
    metaPath,
    indexPath,
    contractMeta,
    downloadedFiles,
    unpackedArchives,
    filesDownloadedCount,
    inspectedCount,
    failedInspections,
  };
}

/**
 * Formata o resultado sintético de fetch_pncp garantindo payload estrito < 900 bytes (Lei 2)
 */
export function formatFetchPncpSyntheticResult(
  result: FetchPncpResult
): FetchPncpSyntheticResult {
  const shortTargetDir = toShortDocPath(result.targetDir);
  const shortMetaPath = toShortDocPath(result.metaPath);
  const shortIndexPath = toShortDocPath(result.indexPath);

  const extractedCount = result.unpackedArchives.reduce(
    (sum, a) => sum + a.extractedCount,
    0
  );

  const targetDirName = basename(result.targetDir);
  const indexBaseName = basename(result.indexPath);

  const synthetic: FetchPncpSyntheticResult = {
    status: "success",
    engine_version: VERSION,
    pncp_ref: result.pncpRef,
    target_dir: shortTargetDir,
    meta_path: shortMetaPath,
    index_path: shortIndexPath,
    files_downloaded: result.filesDownloadedCount ?? result.downloadedFiles.length,
    unpacked_archives_count: result.unpackedArchives.length,
    extracted_files_count: extractedCount,
    inspected_count: result.inspectedCount,
    ...(result.failedInspections.length > 0
      ? { inspection_errors_count: result.failedInspections.length }
      : {}),
    next_step_hint: `Insumos PNCP prontos em ${targetDirName}. Consulte ${indexBaseName}.`,
  };

  return synthetic;
}

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
  const stateDir = resolve(resolvedCaseDir, "state");
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

  // 3. Acumulação e Mesclagem com Buscas Anteriores no Caso
  const resultsJsonPath = resolve(stateDir, "pncp_search_results.json");
  const resultsMdPath = resolve(stateDir, "pncp_search_results.md");

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

  const allConsolidated = Array.from(mergedMap.values());

  // 4. Gravação de state/pncp_search_results.json
  const jsonOutput = {
    updated_at: new Date().toISOString(),
    last_queries: rawQueries,
    total_candidates: allConsolidated.length,
    new_candidates_count: currentCandidates.length,
    candidates: allConsolidated,
  };
  writeFileSync(resultsJsonPath, JSON.stringify(jsonOutput, null, 2), "utf-8");

  // 5. Gravação de state/pncp_search_results.md (Tabela Completa com Objeto Integral)
  let mdContent = `# Resultados da Busca PNCP — Painel de Oportunidades & Referências\n\n`;
  mdContent += `> Consolidação de editais e contratações públicas para pesquisa de mercado e benchmarking técnico (IN SEGES/ME nº 65/2021).\n`;
  mdContent += `> Consultas executadas: \`${rawQueries.join(" | ")}\` | Total acumulado no caso: **${allConsolidated.length}** referências.\n\n`;

  mdContent += `| ID Canônico PNCP | Órgão / UF | Modalidade | Valor Estimado | Publicação | Objeto Completo |\n`;
  mdContent += `| :--- | :--- | :---: | :---: | :---: | :--- |\n`;

  for (const c of allConsolidated) {
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
  writeFileSync(resultsMdPath, mdContent, "utf-8");

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
