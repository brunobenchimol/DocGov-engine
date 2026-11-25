import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TstProvider } from "../../src/tools/juris/providers/tst_provider.ts";
import { buildTstCacheFilePath, TST_TTL_MS } from "../../src/tools/juris/providers/tst_ttl_cache.ts";
import { classifyTstHit } from "../../src/tools/juris/tst_precedent_triage.ts";
import { searchJuris } from "../../src/tools/juris/search_juris.ts";
import { JurisdictionProviderRegistry } from "../../src/tools/juris/provider_registry.ts";

describe("TST v1.7.3 — Cache Dinâmico TTL 24h, Súmulas/OJs Live & Zero Catálogo Estático", () => {
  const dirs: string[] = [];
  const origCache = process.env.DOCGOV_JURIS_CACHE_DIR;
  const origTstBase = process.env.DOCGOV_TST_BASE_URL;
  const origJurisBase = process.env.DOCGOV_JURIS_BASE_URL;

  afterEach(() => {
    if (origCache === undefined) delete process.env.DOCGOV_JURIS_CACHE_DIR;
    else process.env.DOCGOV_JURIS_CACHE_DIR = origCache;
    if (origTstBase === undefined) delete process.env.DOCGOV_TST_BASE_URL;
    else process.env.DOCGOV_TST_BASE_URL = origTstBase;
    if (origJurisBase === undefined) delete process.env.DOCGOV_JURIS_BASE_URL;
    else process.env.DOCGOV_JURIS_BASE_URL = origJurisBase;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function makeTempDir(prefix: string): string {
    const d = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(d);
    return d;
  }

  it("1. hit < 24h usa cache sem chamar HTTP, expirado >= 24h refaz fetch live, e force_live ignora cache válido", async () => {
    const cacheDir = makeTempDir("docgov-tst-ttl-");
    process.env.DOCGOV_JURIS_CACHE_DIR = cacheDir;

    let searchCalls = 0;
    let fetchCalls = 0;
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname.startsWith("/rest/pesquisa-textual")) {
          searchCalls++;
          return Response.json({
            registros: [
              {
                registro: {
                  id: `0000000000000000000000000000000${searchCalls}`,
                  numFormatado: `RR - 0000${searchCalls}00-10.2024.5.02.0001`,
                  orgaoJudicante: { descricao: "3ª Turma" },
                  dtaJulgamento: "2024-08-20",
                  ementa: `Teletrabalho retorno presencial chamada ${searchCalls}`,
                },
              },
            ],
          });
        }
        if (url.pathname.startsWith("/rest/documentos/")) {
          fetchCalls++;
          return Response.json({});
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    try {
      process.env.DOCGOV_TST_BASE_URL = `http://127.0.0.1:${server.port}`;
      const tst = new TstProvider();

      // 1a chamada: miss -> bate ao vivo e grava cache
      const r1 = await tst.searchWithDiagnostic("teletrabalho retorno presencial", { limit: 5 });
      expect(searchCalls).toBe(1);
      expect(r1.diagnostic.source_mode).toBe("LIVE");
      expect(r1.diagnostic.cache_hit).toBeUndefined();
      expect(r1.hits.length).toBe(1);

      // 2a chamada (< 24h): hit de cache -> ZERO chamada HTTP
      const r2 = await tst.searchWithDiagnostic("teletrabalho retorno presencial", { limit: 5 });
      expect(searchCalls).toBe(1);
      expect(r2.diagnostic.source_mode).toBe("LIVE");
      expect(r2.diagnostic.cache_hit).toBe(true);
      expect(r2.hits[0]?.id).toBe(r1.hits[0]?.id);

      // Expirar arquivo manualmente (>= 24h) -> força novo fetch ao vivo
      const cacheFile = buildTstCacheFilePath("search", "teletrabalho retorno presencial|5");
      const entry = JSON.parse(readFileSync(cacheFile, "utf-8"));
      entry.fetched_at = Date.now() - TST_TTL_MS - 1000;
      writeFileSync(cacheFile, JSON.stringify(entry), "utf-8");

      const r3 = await tst.searchWithDiagnostic("teletrabalho retorno presencial", { limit: 5 });
      expect(searchCalls).toBe(2);
      expect(r3.diagnostic.cache_hit).toBeUndefined();
      expect(r3.hits[0]?.id).not.toBe(r1.hits[0]?.id);

      // force_live: true ignora cache < 24h válido
      const r4 = await tst.searchWithDiagnostic("teletrabalho retorno presencial", { limit: 5, force_live: true });
      expect(searchCalls).toBe(3);
      expect(r4.diagnostic.cache_hit).toBeUndefined();
      expect(fetchCalls).toBe(0);
    } finally {
      server.stop(true);
    }
  });

  it("2. Mock Mode com DOCGOV_JURIS_CACHE_DIR ativo segue exatamente o fluxo TTL 24h (hit, expiração e 503 -> LIVE_FAILED)", async () => {
    const cacheDir = makeTempDir("docgov-tst-mock-ttl-");
    process.env.DOCGOV_JURIS_CACHE_DIR = cacheDir;

    let statusMode: 200 | 503 = 200;
    let mockSearchCalls = 0;
    let mockFetchCalls = 0;

    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/search") {
          mockSearchCalls++;
          if (statusMode === 503) return new Response("Unavailable", { status: 503 });
          return Response.json({
            items: [
              {
                id: `TST-RR-${mockSearchCalls}-2025`,
                numero: String(mockSearchCalls),
                ano: 2025,
                colegiado: "2ª Turma",
                ementa: "Teletrabalho retorno presencial mock live",
              },
            ],
          });
        }
        if (url.pathname.startsWith("/fetch/")) {
          mockFetchCalls++;
          if (statusMode === 503) return new Response("Unavailable", { status: 503 });
          return Response.json({
            id: "TST-RR-1-2025",
            numero: "1",
            ano: 2025,
            colegiado: "2ª Turma",
            ementa: "Teletrabalho retorno presencial",
            voto: "Fundamentação live.",
            dispositivo: "Nega provimento.",
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    try {
      process.env.DOCGOV_JURIS_BASE_URL = `http://127.0.0.1:${server.port}`;
      const tst = new TstProvider();

      // Search & Fetch populam cache em Mock Mode
      const s1 = await tst.searchWithDiagnostic("teletrabalho mock", { limit: 5 });
      expect(mockSearchCalls).toBe(1);
      expect(s1.diagnostic.source_mode).toBe("LIVE");

      const f1 = await tst.fetch("TST-RR-1-2025");
      expect(mockFetchCalls).toBe(1);
      expect(f1?.source).toBe("LIVE");

      // 503 ainda com cache < 24h -> serve cache sem erro
      statusMode = 503;
      const sCached = await tst.searchWithDiagnostic("teletrabalho mock", { limit: 5 });
      expect(mockSearchCalls).toBe(1);
      expect(sCached.diagnostic.cache_hit).toBe(true);

      // Expirar cache de search e fetch -> 503 falha sem fallback estático!
      const sCacheFile = buildTstCacheFilePath("search", "teletrabalho mock|5");
      const sEntry = JSON.parse(readFileSync(sCacheFile, "utf-8"));
      sEntry.fetched_at = Date.now() - TST_TTL_MS - 5000;
      writeFileSync(sCacheFile, JSON.stringify(sEntry), "utf-8");

      const sFail = await tst.searchWithDiagnostic("teletrabalho mock", { limit: 5 });
      expect(mockSearchCalls).toBe(2);
      expect(sFail.diagnostic.status).toBe("error");
      expect(sFail.diagnostic.source_mode).toBe("LIVE_FAILED");
      expect(sFail.hits).toEqual([]);

      const fCacheFile = buildTstCacheFilePath("fetch", "TST-RR-1-2025");
      const fEntry = JSON.parse(readFileSync(fCacheFile, "utf-8"));
      fEntry.fetched_at = Date.now() - TST_TTL_MS - 5000;
      writeFileSync(fCacheFile, JSON.stringify(fEntry), "utf-8");

      await expect(tst.fetch("TST-RR-1-2025")).rejects.toThrow(/\[LIVE_UNAVAILABLE\]/);
    } finally {
      server.stop(true);
    }
  });

  it("3. deve mapear Súmulas (SUM) e OJs (OJ) ao vivo para SUMULA-TST-* / OJ-TST-SDI1-* e triar em orientativas", async () => {
    const cacheDir = makeTempDir("docgov-tst-sumoj-");
    process.env.DOCGOV_JURIS_CACHE_DIR = cacheDir;
    const caseDir = join(makeTempDir("docgov-case-"), "cases", "tst_sum_oj");

    const capturedTipos: string[][] = [];
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname.startsWith("/rest/pesquisa-textual")) {
          const body: any = await req.json();
          capturedTipos.push(body.tipos || []);
          if (body.tipos?.includes("SUM")) {
            return Response.json({
              registros: [
                {
                  registro: {
                    id: 570,
                    numero: 331,
                    tipo: { codigoTipoJurisprudencia: "SUM", nome: "Súmula" },
                    titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS. LEGALIDADE.",
                    tese: "Item I cancelado pela Res. 225/2025. Itens IV e V responsabilidade subsidiária.",
                    situacao: { codigo: 2, descricao: "ALTERADA" },
                    observacao: "Res. 225/2025 DEJT 02/07/2025",
                    dtaPublicacao: "2025-07-02",
                  },
                },
              ],
            });
          }
          if (body.tipos?.includes("OJ")) {
            return Response.json({
              registros: [
                {
                  registro: {
                    id: 1240,
                    numero: 191,
                    tipo: { codigoTipoJurisprudencia: "OJ", nome: "Orientação Jurisprudencial" },
                    orgaoJudicante: { descricao: "Subseção I Especializada em Dissídios Individuais" },
                    titulo: "CONTRATO DE EMPREITADA. DONO DA OBRA.",
                    tese: "Diante da inexistência de previsão legal específica, o dono da obra não responde.",
                    dtaPublicacao: "2017-05-11",
                  },
                },
              ],
            });
          }
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    try {
      process.env.DOCGOV_TST_BASE_URL = `http://127.0.0.1:${server.port}`;
      const tst = new TstProvider();
      const reg = new JurisdictionProviderRegistry();
      reg.register(tst);

      const resSum = await searchJuris({ caseDir, query: "SUMULA-TST-331", courts: ["TST"] }, reg);
      expect(capturedTipos[0]).toEqual(["SUM"]);
      expect(resSum.fileResult.results[0]?.id).toBe("SUMULA-TST-331");
      expect(resSum.fileResult.results[0]?.tese).toContain("Res. 225/2025");
      expect(resSum.fileResult.tst_triage?.counts.orientativas).toBe(1);
      expect(resSum.fileResult.tst_triage?.counts.unclassified).toBe(0);

      const ojFetch = await tst.fetch("OJ-TST-SDI1-191");
      expect(ojFetch?.exists).toBe(true);
      expect(ojFetch?.source).toBe("LIVE");
      expect(ojFetch?.rawTextOrJson.id).toBe("OJ-TST-SDI1-191");
      expect(classifyTstHit({ id: "OJ-TST-SDI1-191", court: "TST", colegiado: "Subseção I Especializada em Dissídios Individuais" })).toEqual({
        bucket: "orientativas",
        kind: "OJ",
      });
    } finally {
      server.stop(true);
    }
  });
});
