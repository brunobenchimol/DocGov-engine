// ============================================================================
// Cliente HTTP Resiliente e Utilitários para Conectores de Jurisprudência
// docgov-engine v1.4.0 — providers/http_client.ts
// ============================================================================

import http from "node:http";
import https from "node:https";
import type { CourtDiagnostic } from "../types.ts";

export interface JurisHttpOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number;
}

export interface JurisHttpResponse {
  ok: boolean;
  status: number;
  data: any;
  text: string;
  body: string; // alias para text
  latencyMs: number;
  error: string | null;
}

export interface ParsedAcordaoRef {
  court: string;
  numero?: string;
  ano?: number;
  colegiado?: string;
  rawIdOrKey: string;
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 DocGov-Engine/1.4.0";

/**
 * Cliente HTTP compartilhado com timeout, TLS tolerante (ICP-Brasil), retry leve e medição de latência.
 */
export async function executeJurisHttpRequest(
  url: string,
  options: JurisHttpOptions = {}
): Promise<JurisHttpResponse> {
  const method = options.method || "GET";
  const timeoutMs = options.timeoutMs || 10000;
  const maxRetries = options.retries !== undefined ? options.retries : 1;

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "User-Agent": DEFAULT_USER_AGENT,
    ...(options.headers || {}),
  };

  let attempt = 0;
  let lastError: string | null = null;
  let lastStatus = 0;
  let lastText = "";
  let lastData: any = null;

  while (attempt <= maxRetries) {
    const t0 = performance.now();
    try {
      const resp = await fetch(url, {
        method,
        headers,
        body: options.body,
        signal: AbortSignal.timeout(timeoutMs),
        // @ts-ignore
        tls: { rejectUnauthorized: false },
      });

      const t1 = performance.now();
      const latencyMs = Math.round(t1 - t0);
      lastStatus = resp.status;
      lastText = await resp.text();

      try {
        lastData = JSON.parse(lastText);
      } catch {
        lastData = null;
      }

      if (resp.ok) {
        return {
          ok: true,
          status: resp.status,
          data: lastData,
          text: lastText,
          body: lastText,
          latencyMs,
          error: null,
        };
      }

      lastError = `HTTP ${resp.status}`;
      // Não re-tenta 400 ou 404 (erro de contrato/não encontrado)
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 408) {
        return {
          ok: false,
          status: resp.status,
          data: lastData,
          text: lastText,
          body: lastText,
          latencyMs,
          error: lastError,
        };
      }
    } catch (err: any) {
      const t1 = performance.now();
      const latencyMs = Math.round(t1 - t0);
      lastError = err?.message || String(err);
      if (attempt === maxRetries) {
        return {
          ok: false,
          status: lastStatus,
          data: null,
          text: lastText,
          body: lastText,
          latencyMs,
          error: lastError,
        };
      }
    }
    attempt++;
  }

  return {
    ok: false,
    status: lastStatus,
    data: lastData,
    text: lastText,
    body: lastText,
    latencyMs: 0,
    error: lastError || "Falha desconhecida",
  };
}

/**
 * Cliente HTTP/1.1 legado com insecureHTTPParser (usado para appliances F5/BigIP como TCE-PA).
 * Proteção Mandatória: se a URL for HTTP (ex.: Mock Server local 127.0.0.1), usa node:http
 * ou fetch nativo para JAMAIS disparar handshake TLS contra HTTP em plaintext!
 */
export async function executeLegacyHttp1Request(
  targetUrl: string,
  options: JurisHttpOptions = {}
): Promise<JurisHttpResponse> {
  const t0 = performance.now();

  // Trava Técnica 1: Mock Server HTTP local ou porta não-TLS
  const isPlainHttp = targetUrl.startsWith("http://");
  if (isPlainHttp) {
    return executeJurisHttpRequest(targetUrl, options);
  }

  const timeoutMs = options.timeoutMs || 10000;
  const headers: Record<string, string> = {
    "User-Agent": DEFAULT_USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/json,*/*",
    "Accept-Encoding": "identity",
    Connection: "close",
    ...(options.headers || {}),
  };

  return new Promise((resolve) => {
    try {
      const req = https.get(
        targetUrl,
        {
          headers,
          rejectUnauthorized: false,
          // @ts-ignore
          insecureHTTPParser: true,
        },
        (res) => {
          res.setEncoding("utf8");
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            const latencyMs = Math.round(performance.now() - t0);
            const status = res.statusCode || 0;
            let data: any = null;
            try {
              data = JSON.parse(body);
            } catch {
              data = null;
            }
            resolve({
              ok: status >= 200 && status < 300,
              status,
              data,
              text: body,
              body,
              latencyMs,
              error: status >= 400 ? `HTTP ${status}` : null,
            });
          });
        }
      );

      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Timeout de ${timeoutMs}ms excedido`));
      });

      req.on("error", (err) => {
        const latencyMs = Math.round(performance.now() - t0);
        resolve({
          ok: false,
          status: 0,
          data: null,
          text: "",
          body: "",
          latencyMs,
          error: err.message,
        });
      });
    } catch (err: any) {
      resolve({
        ok: false,
        status: 0,
        data: null,
        text: "",
        body: "",
        latencyMs: 0,
        error: err?.message || String(err),
      });
    }
  });
}

/**
 * Sanitiza a query para os motores de busca (Solr, Elasticsearch, CKAN, etc.).
 * Gera a query limpa e uma variante enxuta sem stopwords para busca de alta revocação.
 */
export function sanitizeQueryForCourt(rawQuery: string): {
  cleanQuery: string;
  shortQuery: string;
  terms: string[];
} {
  const clean = (rawQuery || "")
    .replace(/[<>[\]{}\\^~?:!&|/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stopwords = new Set([
    "de", "do", "da", "dos", "das", "a", "o", "as", "os", "em", "no", "na", "nos", "nas",
    "por", "para", "com", "sem", "sob", "sobre", "e", "ou", "que", "se", "um", "uma",
    "uns", "umas", "solucao", "solução", "contratacao", "contratação", "aquisicao", "aquisição",
    "edital", "objeto"
  ]);

  const terms = clean
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !stopwords.has(t.toLowerCase()));

  const shortQuery = terms.slice(0, 6).join(" ");

  return {
    cleanQuery: clean,
    shortQuery: shortQuery || clean,
    terms,
  };
}

/**
 * Parser canônico universal de referências de acórdãos.
 * Extrai número, ano, colegiado e corte a partir de qualquer string informada.
 */
export function parseCanonicalAcordaoRef(
  idOrRef: string,
  customCourtDetector?: (ref: string) => string
): ParsedAcordaoRef {
  const ref = (idOrRef || "").trim();
  const upper = ref.toUpperCase();

  let court = "TCU";
  if (customCourtDetector) {
    court = customCourtDetector(ref);
  } else {
    const tceMatch = upper.match(/\bTCE[-_]?([A-Z]{2})\b/);
    if (tceMatch) {
      court = `TCE-${tceMatch[1]}`;
    } else if (/\bTCDF\b/.test(upper)) {
      court = "TCDF";
    } else if (/\bSTJ\b/.test(upper)) {
      court = "STJ";
    } else if (/\bSTF\b/.test(upper)) {
      court = "STF";
    } else if (/\bTST\b/.test(upper)) {
      court = "TST";
    } else if (/\b(AGU|CGU)\b/.test(upper)) {
      court = "AGU";
    } else {
      court = "TCU";
    }
  }

  let colegiado: string | undefined;
  if (/plen[aá]rio/i.test(ref)) colegiado = "Plenário";
  else if (/1[ªa]\s*c[aâ]mara/i.test(ref) || /primeira\s*c[aâ]mara/i.test(ref)) colegiado = "1ª Câmara";
  else if (/2[ªa]\s*c[aâ]mara/i.test(ref) || /segunda\s*c[aâ]mara/i.test(ref)) colegiado = "2ª Câmara";
  else if (/corte\s*especial/i.test(ref)) colegiado = "Corte Especial";
  else if (/1[ªa]\s*se[cç][aã]o/i.test(ref) || /primeira\s*se[cç][aã]o/i.test(ref)) colegiado = "Primeira Seção";
  else if (/1[ªa]\s*turma/i.test(ref) || /primeira\s*turma/i.test(ref)) colegiado = "Primeira Turma";

  // Match: "2403/2020", "2403-2020", "2403_2020"
  const numAnoMatch = ref.match(/(\d{1,7})\s*[/_-]\s*(\d{4})/);
  const numero = numAnoMatch ? numAnoMatch[1] : undefined;
  const ano = numAnoMatch ? parseInt(numAnoMatch[2], 10) : undefined;

  return {
    court,
    numero,
    ano,
    colegiado,
    rawIdOrKey: ref,
  };
}
