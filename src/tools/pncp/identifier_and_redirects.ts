import { resolve } from "node:path";
import { VERSION } from "../../constants/index.ts";
import { createPncpIdentifierContractError } from "../../contracts/errors.ts";
import type { PncpIdentifier } from "../../types/index.ts";
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
export function extractFileNameFromHeaderOrMeta(
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
