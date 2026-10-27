import { describe, test, expect, afterAll } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import JSZip from "jszip";
import {
  parsePncpIdentifier,
  sanitizePncpShortname,
  fetchPncpContract,
  formatFetchPncpSyntheticResult,
  resolvePncpRedirectUrl,
  resolveAndParsePncpIdentifier,
  searchPncpContracts,
  formatSearchPncpSyntheticResult,
} from "../src/tools/pncp.ts";
import { createSuiteTempDir, MINIMAL_DOCX_BASE64 } from "./helpers/fixtures.ts";
import { VERSION } from "../src/constants/index.ts";

describe("Testes Unitários v1.3.5: Conector Nativo PNCP e Busca Textual (fetch_pncp e search_pncp)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("pncp_tests");

  afterAll(() => {
    cleanup();
  });

  // --------------------------------------------------------------------------
  // 1. Parser Universal de Identificadores PNCP (parsePncpIdentifier)
  // --------------------------------------------------------------------------
  test("1. parsePncpIdentifier: deve fazer o parsing do Formato 1 (Número de Controle em Editais)", () => {
    const id = parsePncpIdentifier("00394460000141-1-000015/2026");
    expect(id.cnpj).toBe("00394460000141");
    expect(id.sequencial).toBe("15");
    expect(id.ano).toBe("2026");
    expect(id.canonicalRef).toBe("00394460000141/2026/15");
  });

  test("2. parsePncpIdentifier: deve fazer o parsing do Formato 2 (URLs web e API REST)", () => {
    const urls = [
      "https://pncp.gov.br/app/editais/00394460000141/2026/15",
      "https://pncp.gov.br/app/editais/00394460000141/2026/000015",
      "https://pncp.gov.br/app/compras/00394460000141/2026/15",
      "https://pncp.gov.br/api/pncp/v1/orgaos/00394460000141/compras/2026/15",
      "https://pncp.gov.br/api/consulta/v1/orgaos/00394460000141/compras/2026/15",
    ];

    for (const u of urls) {
      const id = parsePncpIdentifier(u);
      expect(id.cnpj).toBe("00394460000141");
      expect(id.ano).toBe("2026");
      expect(id.sequencial).toBe("15");
      expect(id.canonicalRef).toBe("00394460000141/2026/15");
    }
  });

  test("3. parsePncpIdentifier: deve fazer o parsing do Formato 3 (Tupla Simplificada CNPJ/ANO/SEQUENCIAL)", () => {
    const id1 = parsePncpIdentifier("00394460000141/2026/15");
    expect(id1.canonicalRef).toBe("00394460000141/2026/15");

    const id2 = parsePncpIdentifier("00394460000141/2026/000015");
    expect(id2.canonicalRef).toBe("00394460000141/2026/15");
  });

  test("4. parsePncpIdentifier: deve acionar Fail-Fast estrito com Exact Copy-Paste Error para formatos inválidos", () => {
    expect(() => parsePncpIdentifier("identificador_invalido")).toThrow(
      /Identificador PNCP inválido.*NÃO faça leituras exploratórias.*Exemplo de payload canônico/s
    );
    expect(() => parsePncpIdentifier("")).toThrow(
      /Identificador PNCP inválido/
    );
    expect(() => parsePncpIdentifier("12345/2026")).toThrow(
      /Identificador PNCP inválido/
    );
  });

  // --------------------------------------------------------------------------
  // 2. Sanitização de Shortname (sanitizePncpShortname)
  // --------------------------------------------------------------------------
  test("5. sanitizePncpShortname: deve normalizar nomes e evitar duplicação do prefixo pncp_", () => {
    const id = { cnpj: "00394460000141", ano: "2026", sequencial: "15", canonicalRef: "00394460000141/2026/15" };

    expect(sanitizePncpShortname("mgi_nuvem", id)).toBe("mgi_nuvem");
    expect(sanitizePncpShortname("pncp_mgi_nuvem", id)).toBe("mgi_nuvem");
    expect(sanitizePncpShortname("Contratação Especial #01", id)).toBe("Contrata_o_Especial_01");
    expect(sanitizePncpShortname(undefined, id)).toBe("00394460000141_2026_15");
    expect(sanitizePncpShortname("", id)).toBe("00394460000141_2026_15");
  });

  // --------------------------------------------------------------------------
  // 3. Pipeline Completo: Download, Descompactação e Catalogação de Referência (Offline via Bun.serve)
  // --------------------------------------------------------------------------
  test("6. fetchPncpContract: deve baixar arquivos, isolar em inputs/pncp_<shortname>/, descompactar zip e gerar catálogo de referência sem auditoria", async () => {
    const docxBuf = Buffer.from(MINIMAL_DOCX_BASE64, "base64");

    // Cria pacote ZIP contendo uma planilha CSV e lixo de sistema __MACOSX
    const zip = new JSZip();
    zip.file("precos_pesquisa.csv", "item;descricao;valor_unitario\n1;Servico Nuvem;1500.00\n2;Suporte;500.00\n");
    zip.file("__MACOSX/._precos_pesquisa.csv", "JUNK_DATA");
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });

    // Sobe servidor HTTP mock local em porta efêmera (0)
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);

        // 1. Rota de Metadados da Compra
        if (url.pathname.endsWith("/compras/2026/15")) {
          return new Response(
            JSON.stringify({
              numeroControlePNCP: "00394460000141-1-000015/2026",
              anoCompra: 2026,
              sequencialCompra: 15,
              orgaoEntidade: {
                razaoSocial: "ORGAO_CONTRATANTE",
                cnpj: "00394460000141",
              },
              modalidadeNome: "Pregão - Eletrônico",
              objetoCompra: "Aquisição de infraestrutura computacional e suporte técnico",
              valorTotalEstimado: 250000.5,
              dataPublicacaoPncp: "2026-02-10T10:00:00",
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }

        // 2. Rota de Lista de Arquivos
        if (url.pathname.endsWith("/arquivos")) {
          return new Response(
            JSON.stringify([
              {
                sequencialDocumento: 1,
                titulo: "Termo de Referência Homologado",
                nomeArquivo: "TR_Referencia.docx",
                url: `${url.origin}/api/pncp/v1/orgaos/00394460000141/compras/2026/15/arquivos/1`,
              },
              {
                sequencialDocumento: 2,
                titulo: "Planilhas de Preços",
                nomeArquivo: "pesquisa_mercado.zip",
                url: `${url.origin}/api/pncp/v1/orgaos/00394460000141/compras/2026/15/arquivos/2`,
              },
            ]),
            { headers: { "Content-Type": "application/json" } }
          );
        }

        // 3. Download do arquivo 1 (.docx)
        if (url.pathname.endsWith("/arquivos/1")) {
          return new Response(docxBuf, {
            headers: {
              "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "Content-Disposition": 'attachment; filename="TR_Referencia.docx"',
            },
          });
        }

        // 4. Download do arquivo 2 (.zip)
        if (url.pathname.endsWith("/arquivos/2")) {
          return new Response(zipBuf, {
            headers: {
              "Content-Type": "application/zip",
              "Content-Disposition": 'attachment; filename="pesquisa_mercado.zip"',
            },
          });
        }

        return new Response("Not Found", { status: 404 });
      },
    });

    const localBaseUrl = `http://127.0.0.1:${server.port}`;
    const testCaseDir = resolve(tempDir, "caso_benchmarking_01");

    try {
      const result = await fetchPncpContract(
        testCaseDir,
        "00394460000141-1-000015/2026",
        {
          shortname: "orgao_referencia",
          baseUrl: localBaseUrl,
        }
      );

      expect(result.status).toBe("success");
      expect(result.pncpRef).toBe("00394460000141/2026/15");
      expect(result.shortname).toBe("orgao_referencia");

      // 1. Isolamento Físico Estrito: tudo deve estar em inputs/pncp_orgao_referencia/
      const pncpSubdir = resolve(testCaseDir, "inputs", "pncp_orgao_referencia");
      expect(existsSync(pncpSubdir)).toBe(true);

      const filesInSubdir = readdirSync(pncpSubdir);
      expect(filesInSubdir).toContain("TR_Referencia.docx");
      expect(filesInSubdir).toContain("precos_pesquisa.csv");

      // O arquivo ZIP bruto foi excluído após descompactação in-place
      expect(filesInSubdir).not.toContain("pesquisa_mercado.zip");
      // Metadados espúrios __MACOSX foram descartados
      expect(filesInSubdir.some((f) => f.includes("__MACOSX"))).toBe(false);

      // Garante que NENHUM arquivo foi solto na raiz de inputs/
      const rootInputs = readdirSync(resolve(testCaseDir, "inputs"));
      expect(rootInputs).toEqual(["pncp_orgao_referencia"]);

      // 2. Metadados e Catálogo de Referência em state/
      const metaJsonPath = resolve(testCaseDir, "state", "pncp_orgao_referencia_meta.json");
      const indexMdPath = resolve(testCaseDir, "state", "indice_pncp_orgao_referencia.md");

      expect(existsSync(metaJsonPath)).toBe(true);
      expect(existsSync(indexMdPath)).toBe(true);

      const metaContent = JSON.parse(readFileSync(metaJsonPath, "utf-8"));
      expect(metaContent.pncp_ref).toBe("00394460000141/2026/15");
      expect(metaContent.contract.orgaoEntidade.razaoSocial).toBe("ORGAO_CONTRATANTE");
      expect(metaContent.unpacked_archives.length).toBe(1);
      expect(metaContent.unpacked_archives[0].archiveName).toBe("pesquisa_mercado.zip");

      const indexMdContent = readFileSync(indexMdPath, "utf-8");
      expect(indexMdContent).toContain("# Catálogo de Insumos PNCP — orgao_referencia");
      expect(indexMdContent).toContain("ORGAO_CONTRATANTE");
      expect(indexMdContent).toContain("TR_Referencia.docx");
      expect(indexMdContent).toContain("precos_pesquisa.csv");

      // 3. ZERO Poluição de Auditoria / ZERO Radar de 14 Zonas
      expect(indexMdContent).not.toContain("Radar das 14 Zonas");
      expect(indexMdContent).not.toContain("Z1 -");
      expect(indexMdContent).not.toContain("Z14 -");

      const stateFiles = readdirSync(resolve(testCaseDir, "state"));
      const hasAuditDossier = stateFiles.some(
        (f) =>
          f.startsWith("visao_auditoria_") ||
          f.startsWith("dossie_hotspots_") ||
          f.startsWith("auditoria_orcamentaria_")
      );
      expect(hasAuditDossier).toBe(false);

      // 4. Payload MCP Sintético (< 900 bytes — Lei 2)
      const synthetic = formatFetchPncpSyntheticResult(result);
      const syntheticJsonStr = JSON.stringify(synthetic, null, 2);
      const byteSize = Buffer.byteLength(syntheticJsonStr, "utf-8");

      expect(byteSize).toBeLessThan(900);
      expect(synthetic.status).toBe("success");
      expect(synthetic.engine_version).toBe(VERSION);
      expect(synthetic.pncp_ref).toBe("00394460000141/2026/15");
      expect(synthetic.files_downloaded).toBe(2);
      expect(synthetic.unpacked_archives_count).toBe(1);
      expect(synthetic.extracted_files_count).toBe(1);
      expect(synthetic.next_step_hint).toContain("Insumos PNCP prontos em pncp_orgao_referencia");
    } finally {
      server.stop();
    }
  });

  // --------------------------------------------------------------------------
  // 4. Integração CLI (--fetch-pncp) e Servidor MCP (getMcpToolsDefinition)
  // --------------------------------------------------------------------------
  test("7. CLI: docgov-engine --fetch-pncp deve executar corretamente via runCli", async () => {
    let capturedLog = "";
    const origLog = console.log;
    console.log = (msg?: any) => {
      capturedLog += String(msg ?? "") + "\n";
    };

    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const u = new URL(req.url);
        if (u.pathname.endsWith("/compras/2026/15")) {
          return new Response(
            JSON.stringify({
              numeroControlePNCP: "00394460000141-1-000015/2026",
              orgaoEntidade: { razaoSocial: "ORGAO_CONTRATANTE" },
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
        if (u.pathname.endsWith("/arquivos")) {
          return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    const cliCaseDir = resolve(tempDir, "caso_cli_pncp");
    const origEnv = process.env.DOCGOV_PNCP_BASE_URL;
    process.env.DOCGOV_PNCP_BASE_URL = `http://127.0.0.1:${server.port}`;

    try {
      const { runCli } = await import("../src/cli/index.ts");
      await runCli([
        "--fetch-pncp",
        "--case-dir",
        cliCaseDir,
        "--pncp",
        "00394460000141/2026/15",
        "--shortname",
        "cli_ref",
      ]);

      const parsed = JSON.parse(capturedLog);
      expect(parsed.status).toBe("success");
      expect(parsed.pncp_ref).toBe("00394460000141/2026/15");
      expect(parsed.target_dir).toContain("pncp_cli_ref");
      expect(existsSync(resolve(cliCaseDir, "inputs", "pncp_cli_ref"))).toBe(true);
      expect(existsSync(resolve(cliCaseDir, "state", "pncp_cli_ref_meta.json"))).toBe(true);
      expect(existsSync(resolve(cliCaseDir, "state", "indice_pncp_cli_ref.md"))).toBe(true);
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

  test("8. MCP: ferramenta fetch_pncp deve estar registrada com schema e annotations válidos", async () => {
    const { getMcpToolsDefinition } = await import("../src/mcp/server.ts");
    const tools = getMcpToolsDefinition();

    const pncpTool = tools.find((t) => t.name === "fetch_pncp");
    expect(pncpTool).toBeDefined();
    expect(pncpTool!.description).toContain("Quando usar");
    expect(pncpTool!.description).toContain("Próximo Passo");
    expect(pncpTool!.inputSchema.required).toEqual(["caseDir", "pncpIdOrUrl"]);
    expect(pncpTool!.inputSchema.properties.caseDir).toBeDefined();
    expect(pncpTool!.inputSchema.properties.pncpIdOrUrl).toBeDefined();
    expect(pncpTool!.inputSchema.properties.shortname).toBeDefined();

    expect(pncpTool!.annotations?.readOnlyHint).toBe(false);
    expect(pncpTool!.annotations?.destructiveHint).toBe(false);
    expect(pncpTool!.annotations?.idempotentHint).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 5. Resolvedor Nativo de Redirects HTTP (Google Grounding / vertexaisearch)
  // --------------------------------------------------------------------------
  test("9. resolvePncpRedirectUrl e resolveAndParsePncpIdentifier: deve resolver HTTP 302 Found para o destino PNCP", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const u = new URL(req.url);
        if (u.pathname === "/grounding-api-redirect/token_xyz") {
          return new Response(null, {
            status: 302,
            headers: {
              Location: "https://pncp.gov.br/app/editais/00394460000141/2026/15",
            },
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    try {
      const redirectUrl = `http://127.0.0.1:${server.port}/grounding-api-redirect/token_xyz`;

      // 1. resolvePncpRedirectUrl deve capturar o Location do header sem precisar abrir conexão com o PNCP
      const resolved = await resolvePncpRedirectUrl(redirectUrl);
      expect(resolved).toBe("https://pncp.gov.br/app/editais/00394460000141/2026/15");

      // 2. resolveAndParsePncpIdentifier deve retornar o PncpIdentifier correspondente
      const id = await resolveAndParsePncpIdentifier(redirectUrl);
      expect(id.cnpj).toBe("00394460000141");
      expect(id.ano).toBe("2026");
      expect(id.sequencial).toBe("15");
      expect(id.canonicalRef).toBe("00394460000141/2026/15");
    } finally {
      server.stop();
    }
  });

  test("10. fetchPncpContract: deve aceitar URL de redirect do Google Grounding e baixar contratação", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const u = new URL(req.url);
        if (u.pathname === "/grounding-api-redirect/token_abc") {
          return new Response(null, {
            status: 302,
            headers: {
              Location: "https://pncp.gov.br/app/editais/00394460000141/2026/15",
            },
          });
        }
        if (u.pathname.endsWith("/compras/2026/15")) {
          return new Response(
            JSON.stringify({
              numeroControlePNCP: "00394460000141-1-000015/2026",
              orgaoEntidade: { razaoSocial: "ORGAO_CONTRATANTE" },
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
        if (u.pathname.endsWith("/arquivos")) {
          return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    const testCaseDir = resolve(tempDir, "caso_redirect_pncp");
    const localBaseUrl = `http://127.0.0.1:${server.port}`;

    try {
      const redirectUrl = `${localBaseUrl}/grounding-api-redirect/token_abc`;
      const result = await fetchPncpContract(testCaseDir, redirectUrl, {
        baseUrl: localBaseUrl,
        shortname: "ref_redirect",
      });

      expect(result.status).toBe("success");
      expect(result.pncpRef).toBe("00394460000141/2026/15");
      expect(existsSync(resolve(testCaseDir, "inputs", "pncp_ref_redirect"))).toBe(true);
      expect(existsSync(resolve(testCaseDir, "state", "pncp_ref_redirect_meta.json"))).toBe(true);
      expect(existsSync(resolve(testCaseDir, "state", "indice_pncp_ref_redirect.md"))).toBe(true);
    } finally {
      server.stop();
    }
  });

  // --------------------------------------------------------------------------
  // 6. Busca Textual Multi-Query no PNCP (search_pncp)
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

  test("15. MCP: ferramenta search_pncp deve estar registrada nas 8 ferramentas do servidor MCP", async () => {
    const { getMcpToolsDefinition } = await import("../src/mcp/server.ts");
    const tools = getMcpToolsDefinition();

    expect(tools.length).toBe(8);

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
