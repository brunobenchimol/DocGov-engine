import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import {
  VERSION,
  formatBootstrapCaseSyntheticResult,
  formatInspectDocxSyntheticResult,
  inspectDocx,
  bootstrapCase,
  createSyntheticPdfBuffer,
  extractPdfPages,
  ALL_IMPUGNATION_ZONE_IDS,
} from "../src/index.ts";
import { createSampleRawDocx } from "./helpers/fixtures.ts";

describe("Testes Unitários e E2E v0.8.1 / v0.9.0: Suporte Nativo a PDF, Cartografia Sem IA (3 Camadas) e Radar das 14 Zonas de Impugnação", () => {
  const suiteDir = resolve(process.cwd(), "cases", "_test_temp_v080");

  const samplePagesLines: string[][] = [
    [
      "EDITAL DE PREGÃO ELETRÔNICO Nº 01/2026 - ORGAO_CONTRATANTE",
      "1. DO OBJETO E DO AGRUPAMENTO",
      "Aquisição em lote único pelo critério de menor preço global, vedado o consórcio e proibida a subcontratação.",
      "CLÁUSULA 2 - DA HABILITAÇÃO E QUALIFICAÇÃO TÉCNICA",
      "Exige-se atestado de capacidade técnica comprovando 50% da parcela de maior relevância com registro no CREA e CAT, vedado somatório de atestados.",
      "Exige-se patrimônio líquido mínimo, garantia de proposta prévia e caução como garantia contratual.",
      "Será obrigatória a vistoria e visita técnica in loco acompanhada de declaração de conhecimento.",
    ],
    [
      "ANEXO I - TERMO DE REFERÊNCIA",
      "Item 1 | CATMAT 150201 | Quantidade: 50 | Unidade de Fornecimento: UN | Valor Unitário: R$ 12.500,00 | Valor Total: R$ 625.000,00",
      "2.1. HOMOLOGAÇÃO E AMOSTRA",
      "O licitante provisoriamente vencedor deverá apresentar amostra para prova de conceito (PoC) e laudo técnico.",
      "Exige-se carta do fabricante, declaração do fabricante de canal autorizado partner e solidariedade.",
      "Equipamento da marca Alfa, modelo X100 exclusivo e proprietário para padronização, sem similar ou equivalente, processo de padronização conforme Art. 41 e Art. 43.",
      "O prazo de entrega será de 10 dias corridos com implantação on-site e SLA de tempo de atendimento.",
    ],
    [
      "ANEXO II - ESPECIFICAÇÕES TÉCNICAS",
      "Processador 3.8 GHz, 64 GB RAM, 4 TB NVMe, rede 10 Gbps, 50000 IOPS, nobreak 3 kVA, 12000 BTU, gabinete 450 mm x 60 cm, 12 kg, normas ABNT NBR ISO IEC IEEE, suporte 24x7, part number P/N SKU-900 e parâmetros de catálogo com dimensões exatas e garantia de 36 meses.",
      "A remuneração do desenvolvimento adotará métrica de unidade de medida em ponto de função (PF) e UST conforme catálogo de serviços, admitido licenciamento por subscrição de usuário nomeado e vCPU com observância da Súmula 269 do TCU.",
      "MINUTA DE CONTRATO",
      "Exige-se comprovação de vínculo empregatício via CTPS no quadro permanente, certificação técnica e escritório local ou filial no MUNICIPIO_GENERICO.",
      "Será desclassificada proposta inexequível inferior a 75% sem planilha de custos com BDI e convenção coletiva CCT.",
      "O pagamento observará o instrumento de medição de resultado (IMR) sujeito a glosa, reajuste pelo IPCA ou ICT, multa e impedimento de licitar.",
      "Na execução contratual, o prazo de entrega será de 30 dias úteis, admitida subcontratação parcial e exigido atestado de capacidade técnica com garantia contratual.",
    ],
  ];

  beforeAll(() => {
    if (!existsSync(suiteDir)) {
      mkdirSync(suiteDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(suiteDir)) {
      rmSync(suiteDir, { recursive: true, force: true });
    }
  });

  test("1. extractPdfPages deve extrair páginas 1..N e numerar globalmente as linhas com coordenada dupla [PAG_XXX | LYYYY]", async () => {
    const pdfBuffer = createSyntheticPdfBuffer(samplePagesLines);
    const extraction = await extractPdfPages(pdfBuffer);

    expect(extraction.pageCount).toBe(3);
    expect(extraction.lineCount).toBe(22);
    expect(extraction.lines[0].coord).toBe("PAG_001 | L0001");
    expect(extraction.lines[0].bracket_coord).toBe("[PAG_001 | L0001]");
    expect(extraction.lines[0].text).toContain(
      "EDITAL DE PREGÃO ELETRÔNICO Nº 01/2026 - ORGAO_CONTRATANTE"
    );

    // Primeira linha da página 2 deve ser PAG_002 | L0008
    const firstPage2 = extraction.pages[1].lines[0];
    expect(firstPage2.page).toBe(2);
    expect(firstPage2.bracket_coord).toBe("[PAG_002 | L0008]");
    expect(firstPage2.text).toBe("ANEXO I - TERMO DE REFERÊNCIA");

    // Primeira linha da página 3 deve ser PAG_003 | L0015
    const firstPage3 = extraction.pages[2].lines[0];
    expect(firstPage3.page).toBe(3);
    expect(firstPage3.bracket_coord).toBe("[PAG_003 | L0015]");
    expect(firstPage3.text).toBe("ANEXO II - ESPECIFICAÇÕES TÉCNICAS");
  });

  test("2. inspect_docx deve processar arquivo .pdf gerando state/estrutura_<stem>.json e state/visao_auditoria_<stem>.md com Cartografia e Radar Z1..Z14", async () => {
    const pdfPath = resolve(suiteDir, "edital_consolidado_orgao_a.pdf");
    const outJsonPath = resolve(
      suiteDir,
      "state",
      "estrutura_edital_consolidado_orgao_a.json"
    );
    writeFileSync(pdfPath, createSyntheticPdfBuffer(samplePagesLines));

    const result = await inspectDocx(pdfPath, outJsonPath, true);

    expect(result.doc_type).toBe("pdf");
    expect(result.page_count).toBe(3);
    expect(result.line_count).toBe(22);
    expect(existsSync(outJsonPath)).toBe(true);
    expect(result.audit_view_path).toBeDefined();
    expect(existsSync(result.audit_view_path!)).toBe(true);

    // Camada 1: outline_headings
    expect(result.outline_headings).toBeDefined();
    const headingTitles = result.outline_headings!.map((h) => h.title);
    expect(headingTitles).toContain(
      "EDITAL DE PREGÃO ELETRÔNICO Nº 01/2026 - ORGAO_CONTRATANTE"
    );
    expect(headingTitles).toContain(
      "CLÁUSULA 2 - DA HABILITAÇÃO E QUALIFICAÇÃO TÉCNICA"
    );
    expect(headingTitles).toContain("ANEXO I - TERMO DE REFERÊNCIA");
    expect(headingTitles).toContain("ANEXO II - ESPECIFICAÇÕES TÉCNICAS");
    expect(headingTitles).toContain("MINUTA DE CONTRATO");

    // Camada 2: page_signals
    expect(result.page_signals).toBeDefined();
    expect(result.page_signals!.length).toBeGreaterThanOrEqual(2);
    const page2Signal = result.page_signals!.find((s) => s.page === 2);
    expect(page2Signal).toBeDefined();
    expect(page2Signal!.budget_score).toBeGreaterThanOrEqual(4);
    expect(page2Signal!.matched_terms).toContain("R$");
    expect(page2Signal!.matched_terms).toContain("CATMAT");

    const page3Signal = result.page_signals!.find((s) => s.page === 3);
    expect(page3Signal).toBeDefined();
    expect(page3Signal!.tech_spec_score).toBeGreaterThanOrEqual(8);
    expect(page3Signal!.matched_terms).toContain("GHz");
    expect(page3Signal!.matched_terms).toContain("ABNT");

    // Camada 3: Radar das 14 Zonas de Impugnação (Z1..Z14)
    expect(result.impugnation_zones).toBeDefined();
    for (const zoneId of ALL_IMPUGNATION_ZONE_IDS) {
      const hits = result.impugnation_zones![zoneId];
      expect(Array.isArray(hits)).toBe(true);
      expect(hits.length).toBeGreaterThan(0);
      for (const hit of hits) {
        expect(hit.coord).toContain("[PAG_00");
        expect(hit.snippet.length).toBeLessThanOrEqual(90);
      }
    }

    // Verifica conteúdo da visao_auditoria_<stem>.md (Bloco 1 + Bloco 2)
    const auditMd = readFileSync(result.audit_view_path!, "utf-8");
    expect(auditMd).toContain(
      "## Bloco 1: Mapa Cartográfico Estrutural e Radar das 14 Zonas de Impugnação"
    );
    expect(auditMd).toContain("Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO");
    expect(auditMd).toContain("Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP");
    expect(auditMd).toContain("Z12_MAPA_CRUZADO_MULTIPECA");
    expect(auditMd).toContain("Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO");
    expect(auditMd).toContain("Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO");
    expect(auditMd).toContain("## Bloco 2: Conteúdo Integral Paginado");
    expect(auditMd).toContain("[PAG_001 | L0001]");
    expect(auditMd).toContain("[PAG_002 | L0008]");
    expect(auditMd).toContain("[PAG_003 | L0015]");

    // Verifica retorno sintético MCP < 1024 bytes (Lei 2)
    const synthetic = formatInspectDocxSyntheticResult(
      pdfPath,
      outJsonPath,
      result
    );
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.doc_type).toBe("pdf");
    expect(synthetic.page_count).toBe(3);
    expect(synthetic.line_count).toBe(22);
    const bytes = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(bytes).toBeLessThan(1024);
  });

  test("3. bootstrap_case deve inspecionar automaticamente arquivos .pdf em inputs/ (validando %PDF-) e manter payload MCP < 1024 bytes", async () => {
    const caseDir = resolve(suiteDir, "caso_licitacao_pdf");
    const uploadsDir = resolve(suiteDir, "uploads_licitacao_pdf");
    mkdirSync(uploadsDir, { recursive: true });

    const pdfUploadPath = resolve(uploadsDir, "edital_pregao_orgao_b.pdf");
    writeFileSync(pdfUploadPath, createSyntheticPdfBuffer(samplePagesLines));

    const docxUploadPath = resolve(uploadsDir, "minuta_etp_orgao_b.docx");
    await createSampleRawDocx(docxUploadPath);

    const res = await bootstrapCase(caseDir, uploadsDir);
    expect(res.status).toBe("success");
    expect(res.inspectedDocx.length).toBe(1);
    expect(res.inspectedPdf).toBeDefined();
    expect(res.inspectedPdf!.length).toBe(1);
    expect(res.inspectedPdf![0].fileName).toBe("edital_pregao_orgao_b.pdf");
    expect(res.inspectedPdf![0].pageCount).toBe(3);
    expect(res.inspectedPdf![0].lineCount).toBe(22);
    expect(res.inspectedPdf![0].activeZonesCount).toBe(14);

    const pdfStructurePath = resolve(
      caseDir,
      "state",
      "estrutura_edital_pregao_orgao_b.json"
    );
    const pdfAuditViewPath = resolve(
      caseDir,
      "state",
      "visao_auditoria_edital_pregao_orgao_b.md"
    );
    expect(existsSync(pdfStructurePath)).toBe(true);
    expect(existsSync(pdfAuditViewPath)).toBe(true);

    // Verifica que visao_auditoria_*.md do .docx também inclui o Bloco 1 Cartográfico + Radar Z1..Z14
    const docxAuditViewPath = resolve(
      caseDir,
      "state",
      "visao_auditoria_minuta_etp_orgao_b.md"
    );
    expect(existsSync(docxAuditViewPath)).toBe(true);
    const docxAuditMd = readFileSync(docxAuditViewPath, "utf-8");
    expect(docxAuditMd).toContain(
      "## Bloco 1: Mapa Cartográfico Estrutural e Radar das 14 Zonas de Impugnação"
    );
    expect(docxAuditMd).toContain("Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO");

    const synthetic = formatBootstrapCaseSyntheticResult(
      res,
      "cases/caso_licitacao_pdf"
    );
    expect(synthetic.engine_version).toBe(VERSION);
    const bytes = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(bytes).toBeLessThan(1024);
  });

  test("4. Binário compilado standalone (bun build --compile) deve extrair e inspecionar PDF sem erro de worker", () => {
    let binPath = resolve(
      __dirname,
      "..",
      "bin",
      process.platform === "win32" ? "docgov-engine.exe" : "docgov-engine"
    );
    if (!existsSync(binPath)) {
      binPath = resolve(
        __dirname,
        "..",
        "bin",
        process.platform === "win32" ? "docgov-docx.exe" : "docgov-docx"
      );
    }
    if (!existsSync(binPath)) {
      return;
    }

    const pdfPath = resolve(suiteDir, "edital_bin_standalone.pdf");
    const outJsonPath = resolve(suiteDir, "state", "estrutura_edital_bin_standalone.json");
    writeFileSync(pdfPath, createSyntheticPdfBuffer(samplePagesLines));

    const { execFileSync } = require("node:child_process");
    const stdout = execFileSync(
      binPath,
      ["--inspect", pdfPath, "--out", outJsonPath],
      { encoding: "utf-8" }
    );

    const parsed = JSON.parse(stdout);
    expect(parsed.status).toBe("success");
    expect(parsed.engine_version).toBe(VERSION);
    expect(parsed.doc_type).toBe("pdf");
    expect(parsed.page_count).toBe(3);
    expect(parsed.line_count).toBe(22);
    expect(existsSync(outJsonPath)).toBe(true);
  });
});
