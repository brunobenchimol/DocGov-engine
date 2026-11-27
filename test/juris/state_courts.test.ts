import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultJurisdictionRegistry } from "../../src/tools/juris/provider_registry.ts";
import { TceSpProvider } from "../../src/tools/juris/providers/tce_sp_provider.ts";
import { normalizeTceSpId } from "../../src/tools/juris/providers/tce_sp_catalog.ts";
import { TceMgProvider } from "../../src/tools/juris/providers/tce_mg_provider.ts";
import { TcePrProvider } from "../../src/tools/juris/providers/tce_pr_provider.ts";
import { assertAuthenticAcordao } from "../../src/tools/juris/anatomical_slicer.ts";
import { searchJuris, formatSearchJurisSyntheticResult } from "../../src/tools/juris/search_juris.ts";
import { fetchJuris, formatFetchJurisSyntheticResult } from "../../src/tools/juris/index.ts";

describe("Jurisprudência v1.7.6 — Cortes de Contas Estaduais (Corte Limpo, Zero Catálogo Estático)", () => {
  const dirs: string[] = [];
  const origTcdf = process.env.DOCGOV_TCDF_BASE_URL;
  const origTceCe = process.env.DOCGOV_TCE_CE_BASE_URL;
  const origTcePa = process.env.DOCGOV_TCE_PA_BASE_URL;
  const origTceSp = process.env.DOCGOV_JURIS_TCESP_URL;
  const origTceMg = process.env.DOCGOV_JURIS_TCEMG_URL;
  const origTcePr = process.env.DOCGOV_JURIS_TCE_PR_URL;
  const origCache = process.env.DOCGOV_JURIS_CACHE_DIR;

  function makeTempDir(prefix: string): string {
    const d = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(d);
    return d;
  }

  afterEach(() => {
    if (origTcdf === undefined) delete process.env.DOCGOV_TCDF_BASE_URL;
    else process.env.DOCGOV_TCDF_BASE_URL = origTcdf;
    if (origTceCe === undefined) delete process.env.DOCGOV_TCE_CE_BASE_URL;
    else process.env.DOCGOV_TCE_CE_BASE_URL = origTceCe;
    if (origTcePa === undefined) delete process.env.DOCGOV_TCE_PA_BASE_URL;
    else process.env.DOCGOV_TCE_PA_BASE_URL = origTcePa;
    if (origTceSp === undefined) delete process.env.DOCGOV_JURIS_TCESP_URL;
    else process.env.DOCGOV_JURIS_TCESP_URL = origTceSp;
    if (origTceMg === undefined) delete process.env.DOCGOV_JURIS_TCEMG_URL;
    else process.env.DOCGOV_JURIS_TCEMG_URL = origTceMg;
    if (origTcePr === undefined) delete process.env.DOCGOV_JURIS_TCE_PR_URL;
    else process.env.DOCGOV_JURIS_TCE_PR_URL = origTcePr;
    if (origCache === undefined) delete process.env.DOCGOV_JURIS_CACHE_DIR;
    else process.env.DOCGOV_JURIS_CACHE_DIR = origCache;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
    defaultJurisdictionRegistry.resetAllCircuits();
  });

  it("Roteamento explícito por UF, zero autoTriggerKeywords e normalização pura TCE-SP", () => {
    const tcesp = new TceSpProvider();
    const tcemg = new TceMgProvider();
    const tcepr = new TcePrProvider();
    expect(tcesp.uf).toBe("SP");
    expect(tcemg.uf).toBe("MG");
    expect(tcepr.uf).toBe("PR");

    // Roteamento explícito por UF
    expect(defaultJurisdictionRegistry.resolveRouting(undefined, "SP").routingInfo.executed_courts).toContain("TCE-SP");
    expect(defaultJurisdictionRegistry.resolveRouting(undefined, "MG").routingInfo.executed_courts).toContain("TCE-MG");
    expect(defaultJurisdictionRegistry.resolveRouting(undefined, "PR").routingInfo.executed_courts).toContain("TCE-PR");

    // Zero auto-trigger por keyword sem UF/courts
    const noAuto = defaultJurisdictionRegistry.resolveRouting(
      undefined,
      undefined,
      "súmula 50 do tce-sp súmula 114 do tce-mg prejulgado 28 do tce-pr"
    );
    expect(noAuto.routingInfo.executed_courts).toEqual(["TCU", "STJ", "STF"]);

    // Normalizador puro TCE-SP (sem IDs sintéticos)
    expect(normalizeTceSpId("SÚMULA 50 DO TCE-SP")).toBe("SUMULA-TCESP-50");
    expect(normalizeTceSpId("TCE-SP-SUMULA-24")).toBe("SUMULA-TCESP-24");
    expect(normalizeTceSpId("SUMULA-TCESP-033")).toBe("SUMULA-TCESP-33");
    expect(normalizeTceSpId("TC-014892.989.24-3")).toBe("TCE-SP-TC-014892-2024");
    expect(normalizeTceSpId("TCE-SP-TC-014892-2024")).toBe("TCE-SP-TC-014892-2024");
  });

  it("TCE-SP HTML parser retorna apenas texto real (zero 5 linhas sintéticas, zero ano 2024/ORGAO_CONTRATANTE)", async () => {
    process.env.DOCGOV_JURIS_CACHE_DIR = makeTempDir("docgov-tcesp-html-");
    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(
          `<html><body><table>
            <tr><td>Relator:</td><td>Conselheiro Teste Real</td></tr>
            <tr><td>Matéria:</td><td>Licitação</td></tr>
            <tr><td>Objeto:</td><td>Pregão Eletrônico Real</td></tr>
          </table><p>Processo 014892/989/24 julgado conforme texto oficial da fonte.</p></body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      },
    });

    try {
      process.env.DOCGOV_TCE_SP_BASE_URL = `http://127.0.0.1:${server.port}`;
      const tcesp = new TceSpProvider();
      const fetched = await tcesp.fetch("TC-014892.989.24-3");
      expect(fetched?.exists).toBe(true);
      expect(fetched?.rawTextOrJson.ano).toBeUndefined();
      expect(fetched?.rawTextOrJson.entidade).toBe("NAO_INFORMADA");
      expect(fetched?.rawTextOrJson.inteiroTeorTexto).not.toContain(
        "Inteiro teor do procedimento submetido a julgamento."
      );
      expect(fetched?.rawTextOrJson.inteiroTeorTexto).toContain("julgado conforme texto oficial da fonte");
    } finally {
      delete process.env.DOCGOV_TCE_SP_BASE_URL;
      server.stop(true);
    }
  });

  it("Mock Server TCE-SP, TCE-MG e TCE-PR: search/fetch, anti-alucinação 404 e teto MCP < 900B", async () => {
    process.env.DOCGOV_JURIS_CACHE_DIR = makeTempDir("docgov-state-mock-");
    const caseDir = join(makeTempDir("docgov-state-case-"), "cases", "state_mock");

    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        const court = url.searchParams.get("court") || "TCE-SP";
        if (url.pathname === "/search") {
          return Response.json({
            items: [
              {
                id: `${court}-ACORDAO-101-2025`,
                numero: "101",
                ano: 2025,
                colegiado: "Tribunal Pleno",
                tese: "Precedente estadual mock para testes de integração.",
                dispositivo: "Julgada regular a licitação.",
              },
            ],
          });
        }
        if (url.pathname === "/fetch") {
          const id = url.searchParams.get("id") || "";
          if (id.includes("999999")) return new Response(JSON.stringify({ exists: false }), { status: 404 });
          return Response.json({
            id,
            tribunal: court,
            colegiado: "Tribunal Pleno",
            numero: "101",
            ano: 2025,
            enunciado: "Precedente estadual mock.",
            dispositivo: "Julgada regular a licitação.",
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    try {
      process.env.DOCGOV_JURIS_TCESP_URL = `http://127.0.0.1:${server.port}`;
      process.env.DOCGOV_JURIS_TCEMG_URL = `http://127.0.0.1:${server.port}`;
      process.env.DOCGOV_JURIS_TCE_PR_URL = `http://127.0.0.1:${server.port}`;

      for (const court of ["TCE-SP", "TCE-MG", "TCE-PR"] as const) {
        const sRes = await searchJuris({
          caseDir: join(caseDir, court),
          query: "licitação",
          courts: [court],
          limit: 3,
          stance: "DEFENSE",
        });
        const synthS = formatSearchJurisSyntheticResult(sRes.fileResult, sRes.mdPath, caseDir);
        expect(Buffer.byteLength(JSON.stringify(synthS), "utf-8")).toBeLessThan(900);

        const fRes = await fetchJuris({
          caseDir: join(caseDir, court),
          acordaoIdOrUrl: `${court}-ACORDAO-101-2025`,
          court,
        });
        const synthF = formatFetchJurisSyntheticResult(fRes, caseDir);
        expect(Buffer.byteLength(JSON.stringify(synthF), "utf-8")).toBeLessThan(900);

        const prov = defaultJurisdictionRegistry.get(court)!;
        const missing = await prov.fetch(`${court}-999999`);
        expect(missing?.exists).toBe(false);
        expect(() => assertAuthenticAcordao(false, `${court}-999999`, court)).toThrow(
          /\[ANTI_HALLUCINATION_BLOCK\]/
        );
      }
    } finally {
      server.stop(true);
    }
  });

  it("TCDF, TCE-CE e TCE-PA — HTTP 503 sem cache quente retorna LIVE_FAILED / [LIVE_UNAVAILABLE]", async () => {
    process.env.DOCGOV_JURIS_CACHE_DIR = makeTempDir("docgov-state-503-");
    const server503 = Bun.serve({
      port: 0,
      fetch() {
        return new Response("Service Unavailable", { status: 503 });
      },
    });

    try {
      process.env.DOCGOV_TCDF_BASE_URL = `http://127.0.0.1:${server503.port}`;
      process.env.DOCGOV_TCE_CE_BASE_URL = `http://127.0.0.1:${server503.port}`;
      process.env.DOCGOV_TCE_PA_BASE_URL = `http://127.0.0.1:${server503.port}`;

      for (const court of ["TCDF", "TCE-CE", "TCE-PA"] as const) {
        const prov = defaultJurisdictionRegistry.get(court)!;
        const deg = await prov.searchWithDiagnostic!("licitação");
        expect(deg.diagnostic.status).toBe("error");
        expect(deg.diagnostic.source_mode).toBe("LIVE_FAILED");
        expect(deg.hits).toEqual([]);
        await expect(prov.fetch(`${court}-999999`)).rejects.toThrow(/\[LIVE_UNAVAILABLE\]/);
      }
    } finally {
      server503.stop(true);
    }
  });
});
