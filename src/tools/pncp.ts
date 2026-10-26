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
import { createPncpIdentifierContractError } from "../contracts/errors.ts";
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
} from "../types/index.ts";

// ============================================================================
// Conector Nativo PNCP (Portal Nacional de Contratações Públicas) — v1.3.4
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
  const id = parsePncpIdentifier(pncpIdOrUrl);
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
