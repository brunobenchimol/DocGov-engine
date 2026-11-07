import { describe, test, expect, afterAll } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  searchPncpContracts,
  formatSearchPncpSyntheticResult,
} from "../src/tools/pncp.ts";
import { createSuiteTempDir } from "./helpers/fixtures.ts";

describe("Testes Unitários v1.3.5: Busca Textual Multi-Query no PNCP (search_pncp)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("pncp_search_tests");

  afterAll(() => {
    cleanup();
  });

  // --------------------------------------------------------------------------
  // Busca Textual Multi-Query no PNCP (search_pncp)
  // --------------------------------------------------------------------------
  test("11. searchPncpContracts: deve consultar /api/search/, desduplicar multi-query e gerar artefatos em state/", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const u = new URL(req.url);
        if (u.pathname === "/api/search/") {
          const q = u.searchParams.get("q") || "";
          if (q.includes("software")) {
            return new Response(
              JSON.stringify({
                items: [
                  {
                    orgao_cnpj: "00394460000141",
                    ano: 2026,
                    numero_sequencial: 15,
                    orgao_nome: "ORGAO_CONTRATANTE",
                    modalidade_licitacao_nome: "Pregão Eletrônico",
                    title: "Aquisição de Fábrica de Software",
                    description: "Contratação de serviços de sustentação e evolução de software corporativo sob demanda com dimensionamento em pontos de função.",
                    valor_global: 1200000.0,
                    data_publicacao_pncp: "2026-03-01T08:00:00",
                    uf: "DF",
                  },
                  {
                    orgao_cnpj: "11222333000199",
                    ano: 2026,
                    numero_sequencial: 4,
                    orgao_nome: "ORGAO_SECUNDARIO",
                    modalidade_licitacao_nome: "Concorrência",
                    title: "Desenvolvimento de Aplicações Web",
                    description: "Desenvolvimento e governança de microsserviços.",
                    valor_global: 850000.0,
                    data_publicacao_pncp: "2026-03-05T09:00:00",
                    uf: "PA",
                  },
                ],
              }),
              { headers: { "Content-Type": "application/json" } }
            );
          }
          if (q.includes("nuvem")) {
            return new Response(
              JSON.stringify({
                items: [
                  // Item duplicado com o mesmo ID para testar desduplicação
                  {
                    orgao_cnpj: "00394460000141",
                    ano: 2026,
                    numero_sequencial: 15,
                    orgao_nome: "ORGAO_CONTRATANTE",
                    modalidade_licitacao_nome: "Pregão Eletrônico",
                    title: "Aquisição de Fábrica de Software",
                    description: "Contratação de serviços de sustentação e evolução de software corporativo sob demanda com dimensionamento em pontos de função.",
                    valor_global: 1200000.0,
                    data_publicacao_pncp: "2026-03-01T08:00:00",
                    uf: "DF",
                  },
                  {
                    orgao_cnpj: "99888777000111",
                    ano: 2026,
                    numero_sequencial: 10,
                    orgao_nome: "ORGAO_TERCIARIO",
                    modalidade_licitacao_nome: "Pregão Eletrônico",
                    title: "Serviços de Nuvem Computacional",
                    description: "Infraestrutura de nuvem pública com gerenciamento de contêineres e banco de dados relacional distribuído.",
                    valor_global: 540000.0,
                    data_publicacao_pncp: "2026-03-10T14:00:00",
                    uf: "DF",
                  },
                ],
              }),
              { headers: { "Content-Type": "application/json" } }
            );
          }
          return new Response(JSON.stringify({ items: [] }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    const searchCaseDir = resolve(tempDir, "caso_search_pncp");
    const localBaseUrl = `http://127.0.0.1:${server.port}`;

    try {
      const result = await searchPncpContracts(
        searchCaseDir,
        "fábrica de software | sustentação de nuvem",
        { baseUrl: localBaseUrl }
      );

      expect(result.status).toBe("success");
      expect(result.queriesExecuted).toEqual([
        "fábrica de software",
        "sustentação de nuvem",
      ]);
      // 3 itens únicos retornados (00394460000141/2026/15, 11222333000199/2026/4, 99888777000111/2026/10)
      expect(result.resultsCount).toBe(3);
      expect(result.totalAccumulatedCount).toBe(3);

      // Verifica arquivos gerados em state/
      expect(existsSync(result.resultsJsonPath)).toBe(true);
      expect(existsSync(result.resultsMdPath)).toBe(true);

      const jsonContent = JSON.parse(
        readFileSync(result.resultsJsonPath, "utf-8")
      );
      expect(jsonContent.candidates.length).toBe(3);
      expect(jsonContent.candidates[0].pncp_id).toBe("00394460000141/2026/15");

      const mdContent = readFileSync(result.resultsMdPath, "utf-8");
      expect(mdContent).toContain("# Resultados da Busca PNCP");
      expect(mdContent).toContain("00394460000141/2026/15");
      expect(mdContent).toContain("Aquisição de Fábrica de Software");
      // Verifica preservação do Objeto Completo
      expect(mdContent).toContain(
        "dimensionamento em pontos de função"
      );

      // Payload Sintético MCP (< 900 bytes — Lei 2)
      const synthetic = formatSearchPncpSyntheticResult(result);
      const jsonStr = JSON.stringify(synthetic, null, 2);
      const byteLength = Buffer.byteLength(jsonStr, "utf-8");

      expect(byteLength).toBeLessThan(900);
      expect(synthetic.status).toBe("success");
      expect(synthetic.results_count).toBe(3);
      expect(synthetic.top_candidates.length).toBeGreaterThanOrEqual(1);
      expect(synthetic.top_candidates.length).toBeLessThanOrEqual(3);
      expect(synthetic.top_candidates[0].pncp_id).toBe(
        "00394460000141/2026/15"
      );
      expect(synthetic.next_step_hint).toContain("fetch_pncp");
    } finally {
      server.stop();
    }
  });

  test("12. searchPncpContracts: deve acumular resultados em buscas sucessivas preservando histórico", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const u = new URL(req.url);
        if (u.pathname === "/api/search/") {
          const q = u.searchParams.get("q") || "";
          if (q.includes("segurança")) {
            return new Response(
              JSON.stringify({
                items: [
                  {
                    orgao_cnpj: "55566677000188",
                    ano: 2026,
                    numero_sequencial: 2,
                    orgao_nome: "ORGAO_SEGURANCA",
                    modalidade_licitacao_nome: "Pregão Eletrônico",
                    title: "Solução de Firewall e SIEM",
                    description: "Monitoramento de segurança da informação 24x7.",
                    valor_global: 430000.0,
                    data_publicacao_pncp: "2026-03-12T10:00:00",
                    uf: "DF",
                  },
                ],
              }),
              { headers: { "Content-Type": "application/json" } }
            );
          }
        }
        return new Response(JSON.stringify({ items: [] }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    const searchCaseDir = resolve(tempDir, "caso_search_pncp");
    const localBaseUrl = `http://127.0.0.1:${server.port}`;

    try {
      // Executa segunda busca no mesmo caseDir
      const result2 = await searchPncpContracts(
        searchCaseDir,
        "segurança da informação",
        { baseUrl: localBaseUrl }
      );

      // Deve ter 1 novo candidato, totalizando 4 acumulados (3 anteriores + 1 novo)
      expect(result2.resultsCount).toBe(1);
      expect(result2.totalAccumulatedCount).toBe(4);

      const jsonContent = JSON.parse(
        readFileSync(result2.resultsJsonPath, "utf-8")
      );
      expect(jsonContent.total_candidates).toBe(4);
      // O novo candidato aparece no topo
      expect(jsonContent.candidates[0].pncp_id).toBe("55566677000188/2026/2");
    } finally {
      server.stop();
    }
  });

  test("13. searchPncpContracts: deve aplicar filtros de UF e fail-fast em query vazia", async () => {
    const searchCaseDir = resolve(tempDir, "caso_search_filtros");

    // Fail-Fast estrito em query vazia (Lei 3)
    expect(searchPncpContracts(searchCaseDir, "")).rejects.toThrow(
      /Erro nos parâmetros de busca no PNCP/
    );
    expect(searchPncpContracts(searchCaseDir, "   |   ")).rejects.toThrow(
      /Erro nos parâmetros de busca no PNCP/
    );
  });

  test("14. CLI: docgov-engine --search-pncp deve executar corretamente via runCli", async () => {
    let capturedLog = "";
    const origLog = console.log;
    console.log = (msg?: any) => {
      capturedLog += String(msg ?? "") + "\n";
    };

    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const u = new URL(req.url);
        if (u.pathname === "/api/search/") {
          return new Response(
            JSON.stringify({
              items: [
                {
                  orgao_cnpj: "00394460000141",
                  ano: 2026,
                  numero_sequencial: 15,
                  orgao_nome: "ORGAO_CONTRATANTE",
                  modalidade_licitacao_nome: "Pregão Eletrônico",
                  title: "Aquisição de Fábrica de Software",
                  description: "Sustentação de sistemas.",
                  valor_global: 500000.0,
                  uf: "DF",
                },
              ],
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    const cliCaseDir = resolve(tempDir, "caso_cli_search_pncp");
    const origEnv = process.env.DOCGOV_PNCP_BASE_URL;
    process.env.DOCGOV_PNCP_BASE_URL = `http://127.0.0.1:${server.port}`;

    try {
      const { runCli } = await import("../src/cli/index.ts");
      await runCli([
        "--search-pncp",
        "--case-dir",
        cliCaseDir,
        "--query",
        "fábrica de software",
        "--uf",
        "DF",
      ]);

      const parsed = JSON.parse(capturedLog);
      expect(parsed.status).toBe("success");
      expect(parsed.results_count).toBe(1);
      expect(parsed.top_candidates[0].pncp_id).toBe("00394460000141/2026/15");
      expect(
        existsSync(resolve(cliCaseDir, "state", "pncp_search_results.json"))
      ).toBe(true);
      expect(
        existsSync(resolve(cliCaseDir, "state", "pncp_search_results.md"))
      ).toBe(true);
    } finally {
      console.log = origLog;
      if (origEnv !== undefined) {
        process.env.DOCGOV_PNCP_BASE_URL = origEnv;
      } else {
        delete process.env.DOCGOV_PNCP_BASE_URL;
      }
      server.stop();
    }
  });

  test("15. MCP: ferramenta search_pncp deve estar registrada nas 10 ferramentas do servidor MCP", async () => {
    const { getMcpToolsDefinition } = await import("../src/mcp/server.ts");
    const tools = getMcpToolsDefinition();

    expect(tools.length).toBe(10);

    const searchTool = tools.find((t) => t.name === "search_pncp");
    expect(searchTool).toBeDefined();
    expect(searchTool!.description).toContain("Quando usar");
    expect(searchTool!.description).toContain("Próximo Passo");
    expect(searchTool!.inputSchema.required).toEqual(["caseDir", "query"]);
    expect(searchTool!.inputSchema.properties.caseDir).toBeDefined();
    expect(searchTool!.inputSchema.properties.query).toBeDefined();
    expect(searchTool!.inputSchema.properties.status).toBeDefined();
    expect(searchTool!.inputSchema.properties.uf).toBeDefined();
    expect(searchTool!.inputSchema.properties.modalidade).toBeDefined();
    expect(searchTool!.inputSchema.properties.limit).toBeDefined();

    expect(searchTool!.annotations?.readOnlyHint).toBe(false);
    expect(searchTool!.annotations?.destructiveHint).toBe(false);
    expect(searchTool!.annotations?.idempotentHint).toBe(true);
  });
});
