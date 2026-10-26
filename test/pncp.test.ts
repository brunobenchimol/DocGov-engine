import { describe, test, expect, afterAll } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import JSZip from "jszip";
import {
  parsePncpIdentifier,
  sanitizePncpShortname,
  fetchPncpContract,
  formatFetchPncpSyntheticResult,
} from "../src/tools/pncp.ts";
import { createSuiteTempDir, MINIMAL_DOCX_BASE64 } from "./helpers/fixtures.ts";
import { VERSION } from "../src/constants/index.ts";

describe("Testes Unitários v1.3.4: Conector Nativo PNCP (fetch_pncp)", () => {
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
});
