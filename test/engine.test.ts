import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import JSZip from "jszip";
import {
  VERSION,
  formatBootstrapCaseSyntheticResult,
  formatInspectDocxSyntheticResult,
  formatBuildDocxTemplateSyntheticResult,
  formatFillDocxTemplateSyntheticResult,
  formatGenerateAuditDocxSyntheticResult,
  formatAuditDocxSyntheticResult,
  sanitizeTemplateTagExpression,
  validateTemplateTagSyntax,
  unflattenDotKeys,
  unflattenDotNotation,
  buildDocxTemplate,
  fillDocxTemplate,
  inspectDocx,
  bootstrapCase,
  createSyntheticPdfBuffer,
  extractPdfPages,
  ALL_IMPUGNATION_ZONE_IDS,
} from "../src/index.ts";
import { createSampleRawDocx } from "./helpers/fixtures.ts";

describe("Testes Unitários v1.0.0: engine_version e Teto Estrito MCP (< 1024 bytes) nas 5 Ferramentas", () => {
  test("1. bootstrap_case deve conter 'engine_version' na raiz e payload < 1024 bytes", () => {
    const synthetic = formatBootstrapCaseSyntheticResult(
      {
        status: "success",
        caseDir: "cases/caso_contratacao_01",
        copiedFiles: ["minuta_edital.docx"],
        backgroundFiles: ["termo_referencia.pdf"],
        backgroundCopy: {
          status: "started",
          totalFiles: 1,
          files: ["termo_referencia.pdf"],
          message: "Salvaguarda ativa",
        },
        inspectedDocx: [
          {
            fileName: "minuta_edital.docx",
            structurePath: "cases/caso_contratacao_01/state/estrutura_minuta_edital.json",
            tablesCount: 3,
            paragraphsCount: 42,
            compactStructure: {
              headers: [],
              footers: [],
              paragraphs: [],
              tables: [],
            },
          },
        ],
      },
      "cases/caso_contratacao_01"
    );

    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("1.3.3");
    expect(synthetic).toHaveProperty("engine_version");

    const json = JSON.stringify(synthetic, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");
    expect(bytes).toBeLessThan(920);
  });

  test("2. inspect_doc deve conter 'engine_version' na raiz e payload < 1024 bytes", () => {
    const synthetic = formatInspectDocxSyntheticResult(
      "inputs/modelo_dfd.docx",
      "state/estrutura_dfd.json",
      {
        headers: [],
        footers: [],
        paragraphs: [
          { index: 0, style: "Heading1", text: "1. OBJETO DO DFD" },
          { index: 1, style: null, text: "Aquisição de estações de trabalho" },
        ],
        tables: [
          {
            index: 0,
            rows: [
              {
                rowIndex: 0,
                cells: [
                  { cellIndex: 0, text: "Item" },
                  { cellIndex: 1, text: "Descrição" },
                ],
              },
            ],
          },
        ],
        toc_map: {
          sections: [
            {
              coord: "P0",
              title: "1. OBJETO DO DFD",
              suggested_target_slot: "P1",
            },
          ],
          form_fields: [],
          tables: [
            {
              table_index: 0,
              rows: 1,
              cols: 2,
              headers: ["Item", "Descrição"],
              sample_row_coord: "T0.R0",
            },
          ],
        },
      }
    );

    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("1.3.3");
    expect(synthetic.filePath).toBe("inputs/modelo_dfd.docx");
    expect(synthetic.docxPath).toBe("inputs/modelo_dfd.docx");
    expect(synthetic).toHaveProperty("engine_version");

    const json = JSON.stringify(synthetic, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");
    expect(bytes).toBeLessThan(920);
  });

  test("3. build_docx_template deve conter 'engine_version' na raiz e payload < 1024 bytes", () => {
    const synthetic = formatBuildDocxTemplateSyntheticResult(
      "state/template_dfd.docx",
      {
        success: true,
        message: "Template parametrizado gerado com sucesso em: state/template_dfd.docx (5 slots aplicados)",
        applied_slots_count: 5,
        breakdown: {
          replace_paragraphs: 2,
          loop_paragraphs: 0,
          replace_table_cells: 2,
          loop_table_rows: 1,
          replace_inline: 0,
        },
      }
    );

    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("1.3.3");
    expect(synthetic).toHaveProperty("engine_version");

    const json = JSON.stringify(synthetic, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");
    expect(bytes).toBeLessThan(1024);
  });

  test("4. fill_docx_template deve conter 'engine_version' na raiz e payload < 1024 bytes", () => {
    const synthetic = formatFillDocxTemplateSyntheticResult({
      success: true,
      message: "Minuta gerada com sucesso com motor híbrido v0.7.0",
      outputPath: "output/DFD_Final.docx",
      inspection_path: "state/inspecao_DFD_Final.json",
      visao_auditoria_path: "state/visao_auditoria_DFD_Final.md",
      next_step_hint: "Próximo: acione o Auditor Externo.",
    });

    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("1.3.3");
    expect(synthetic).toHaveProperty("engine_version");

    const json = JSON.stringify(synthetic, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");
    expect(bytes).toBeLessThan(1024);
  });

  test("5. generate_audit_docx deve conter 'engine_version' na raiz e payload < 1024 bytes", () => {
    const synthetic = formatGenerateAuditDocxSyntheticResult({
      outputPath: "output/Relatorio_Auditoria_DFD.docx",
      message: "Relatório de Auditoria (.docx) gerado com sucesso em: output/Relatorio_Auditoria_DFD.docx",
    });

    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("1.3.3");
    expect(synthetic).toHaveProperty("engine_version");
    expect(synthetic.next_step_hint).toContain("Ciclo de auditoria concluído");

    // Verifica também o alias exportado
    const aliasSynthetic = formatAuditDocxSyntheticResult({
      outputPath: "output/Relatorio_Auditoria_DFD.docx",
      message: "Relatório de Auditoria (.docx) gerado com sucesso em: output/Relatorio_Auditoria_DFD.docx",
    });
    expect(aliasSynthetic.engine_version).toBe(VERSION);

    const json = JSON.stringify(synthetic, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");
    expect(bytes).toBeLessThan(1024);
  });

  test("Garantia Cross-Tool: todas as 5 ferramentas retornam payload sintético com engine_version idêntico e < 1024 bytes", () => {
    const payloads = [
      formatBootstrapCaseSyntheticResult({
        status: "success",
        caseDir: "cases/c1",
        copiedFiles: [],
        backgroundFiles: [],
        backgroundCopy: { status: "idle", totalFiles: 0, files: [], message: "" },
        inspectedDocx: [],
      }),
      formatInspectDocxSyntheticResult("doc.docx", "est.json", {
        headers: [],
        footers: [],
        paragraphs: [],
        tables: [],
      }),
      formatBuildDocxTemplateSyntheticResult("tpl.docx", {
        success: true,
        message: "OK",
        applied_slots_count: 1,
        breakdown: {
          replace_paragraphs: 1,
          loop_paragraphs: 0,
          replace_table_cells: 0,
          loop_table_rows: 0,
          replace_inline: 0,
        },
      }),
      formatFillDocxTemplateSyntheticResult({
        success: true,
        message: "OK",
        outputPath: "out.docx",
        next_step_hint: "hint",
      }),
      formatGenerateAuditDocxSyntheticResult({
        outputPath: "audit.docx",
        message: "OK",
      }),
    ];

    expect(payloads.length).toBe(5);
    for (const p of payloads) {
      expect(p.engine_version).toBe(VERSION);
      expect(p.status).toBe("success");
      const bytes = Buffer.byteLength(JSON.stringify(p, null, 2), "utf-8");
      expect(bytes).toBeLessThan(1024);
    }
  });
});

describe("Testes Unitários e E2E v0.7.2: Sanitização de Tags JS, Validação Precoce e Unflatten", () => {
  const tempDir = resolve(process.cwd(), "cases", "_test_temp_v072");

  beforeAll(() => {
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("1. sanitizeTemplateTagExpression deve auto-normalizar acessos numéricos por ponto para colchetes", () => {
    expect(sanitizeTemplateTagExpression("itens.0.qtd")).toBe("itens[0].qtd");
    expect(sanitizeTemplateTagExpression("{{itens.0.qtd}}")).toBe("{{itens[0].qtd}}");
    expect(sanitizeTemplateTagExpression("{{grupos.1.itens.2.nome}}")).toBe("{{grupos[1].itens[2].nome}}");
    expect(sanitizeTemplateTagExpression("{{FOR item IN itens.0.lista}}")).toBe("{{FOR item IN itens[0].lista}}");
    expect(sanitizeTemplateTagExpression("{{itens[0].qtd}}")).toBe("{{itens[0].qtd}}");
    expect(sanitizeTemplateTagExpression("{{valor_total}}")).toBe("{{valor_total}}");
  });

  test("2. validateTemplateTagSyntax deve validar tags corretas e barrar sintaxes inválidas com Exact Copy-Paste Error", () => {
    // Válidas
    expect(() => validateTemplateTagSyntax("{{itens[0].qtd}}")).not.toThrow();
    expect(() => validateTemplateTagSyntax("{{item.nome}}")).not.toThrow();
    expect(() => validateTemplateTagSyntax("{{FOR item IN itens[0].lista}}")).not.toThrow();
    expect(() => validateTemplateTagSyntax("{{END-FOR item}}")).not.toThrow();
    expect(() => validateTemplateTagSyntax("{{IF condicao}}")).not.toThrow();
    expect(() => validateTemplateTagSyntax("{{END-IF}}")).not.toThrow();
    expect(() => validateTemplateTagSyntax("{{$item.campo}}")).not.toThrow();

    // Inválidas: hífen em identificador (kebab-case)
    expect(() => validateTemplateTagSyntax("{{meu-slot-invalido}}")).toThrow(
      /Identificador com hífen inválido "meu-slot-invalido"/
    );
    expect(() => validateTemplateTagSyntax("{{meu-slot-invalido}}")).toThrow(
      /Sugestão de correção: "{{meu_slot_invalido}}"/
    );

    // Inválidas: iniciando por dígito
    expect(() => validateTemplateTagSyntax("{{1_item}}")).toThrow(
      /Identificador iniciando por dígito "1_item"/
    );
    expect(() => validateTemplateTagSyntax("{{1_item}}")).toThrow(
      /Sugestão de correção: "{{item_1}}"/
    );

    // Inválidas: chaves desbalanceadas
    expect(() => validateTemplateTagSyntax("{{meu_slot")).toThrow(/Chaves desbalanceadas/);
    expect(() => validateTemplateTagSyntax("meu_slot}}")).toThrow(/Chaves desbalanceadas/);

    // Inválidas: tag vazia
    expect(() => validateTemplateTagSyntax("{{}}")).toThrow(/Tag vazia/);
  });

  test("3. unflattenDotKeys e unflattenDotNotation devem expandir notações com ponto numérico e colchetes em arrays", () => {
    const flatState = {
      "itens.0.qtd": "10",
      "itens.0.nome": "Item Alfa",
      "itens.1.qtd": "20",
      "itens.1.nome": "Item Beta",
      "config.empresa.nome": "ORGAO_CONTRATANTE",
    };

    const unflattened = unflattenDotKeys(flatState);
    expect(Array.isArray(unflattened.itens)).toBe(true);
    expect(unflattened.itens.length).toBe(2);
    expect(unflattened.itens[0]).toEqual({ qtd: "10", nome: "Item Alfa" });
    expect(unflattened.itens[1]).toEqual({ qtd: "20", nome: "Item Beta" });
    expect(unflattened.config.empresa.nome).toBe("ORGAO_CONTRATANTE");
    expect(unflattened["itens.0.qtd"]).toBe("10");

    // Teste com notação explícita de colchetes
    const bracketState = {
      "itens[0].qtd": "99",
      "itens[0].nome": "Item Bracket",
    };
    const unflattenedBracket = unflattenDotNotation(bracketState);
    expect(Array.isArray(unflattenedBracket.itens)).toBe(true);
    expect(unflattenedBracket.itens[0]).toEqual({ qtd: "99", nome: "Item Bracket" });
  });

  test("4. build_docx_template + fill_docx_template E2E: sanitização de 'itens.0.qtd' e injeção com JSON aninhado e plano", async () => {
    const rawDocx = resolve(tempDir, "sample_v072.docx");
    const manifestFile = resolve(tempDir, "slots_manifest_v072.json");
    const templateDocx = resolve(tempDir, "template_v072.docx");
    await createSampleRawDocx(rawDocx);

    // Manifesto com tags usando notação de ponto numérico (itens.0.qtd, itens.1.qtd)
    writeFileSync(
      manifestFile,
      JSON.stringify(
        {
          slots: [
            { coord: "P2", tag: "{{itens.0.nome}}: {{itens.0.qtd}} unidades" },
            { coord: "T0.R0.C1", tag: "{{itens.1.nome}} - {{itens.1.qtd}}" },
          ],
        },
        null,
        2
      ),
      "utf-8"
    );

    // 1. build_docx_template deve normalizar automaticamente para [0] e [1] no template
    const buildRes = await buildDocxTemplate(rawDocx, manifestFile, templateDocx);
    expect(buildRes.success).toBe(true);
    expect(buildRes.applied_slots_count).toBe(2);

    // Inspeciona o XML do template gerado para provar que foi gravado como [0] e [1]
    const zip = await JSZip.loadAsync(readFileSync(templateDocx));
    const docXml = await zip.file("word/document.xml")!.async("string");
    expect(docXml).toContain("itens[0].nome");
    expect(docXml).toContain("itens[0].qtd");
    expect(docXml).toContain("itens[1].nome");
    expect(docXml).toContain("itens[1].qtd");
    expect(docXml).not.toContain("itens.0.qtd");
    expect(docXml).not.toContain("itens.1.qtd");

    // 2. Preenchimento Cenário A: estado com array aninhado
    const stateNestedFile = resolve(tempDir, "state_nested_v072.json");
    const outNestedDocx = resolve(tempDir, "out_nested_v072.docx");
    writeFileSync(
      stateNestedFile,
      JSON.stringify(
        {
          itens: [
            { nome: "Cadeira Ergonômica", qtd: "15" },
            { nome: "Mesa Digital", qtd: "30" },
          ],
        },
        null,
        2
      ),
      "utf-8"
    );

    const fillNestedRes = await fillDocxTemplate(templateDocx, stateNestedFile, outNestedDocx);
    expect(fillNestedRes.success).toBe(true);

    const inspNested = await inspectDocx(outNestedDocx);
    expect(inspNested.paragraphs[2].text).toBe("Cadeira Ergonômica: 15 unidades");
    expect(inspNested.tables[0].rows[0].cells[1].text).toContain("Mesa Digital - 30");

    // 3. Preenchimento Cenário B: estado com chaves planas dot-notation
    const stateFlatFile = resolve(tempDir, "state_flat_v072.json");
    const outFlatDocx = resolve(tempDir, "out_flat_v072.docx");
    writeFileSync(
      stateFlatFile,
      JSON.stringify(
        {
          "itens.0.nome": "Monitor 4K",
          "itens.0.qtd": "8",
          "itens.1.nome": "Teclado Mecânico",
          "itens.1.qtd": "12",
        },
        null,
        2
      ),
      "utf-8"
    );

    const fillFlatRes = await fillDocxTemplate(templateDocx, stateFlatFile, outFlatDocx);
    expect(fillFlatRes.success).toBe(true);

    const inspFlat = await inspectDocx(outFlatDocx);
    expect(inspFlat.paragraphs[2].text).toBe("Monitor 4K: 8 unidades");
    expect(inspFlat.tables[0].rows[0].cells[1].text).toContain("Teclado Mecânico - 12");
  });

  test("5. build_docx_template deve barrar tags com identificadores inválidos com Exact Copy-Paste Error", async () => {
    const rawDocx = resolve(tempDir, "sample_invalid_tag.docx");
    const invalidManifestFile = resolve(tempDir, "invalid_tag_manifest.json");
    const outDocx = resolve(tempDir, "invalid_tag_out.docx");
    await createSampleRawDocx(rawDocx);

    // Caso 1: tag com kebab-case
    writeFileSync(
      invalidManifestFile,
      JSON.stringify(
        {
          slots: [
            { coord: "P2", tag: "{{meu-slot-invalido}}" },
          ],
        },
        null,
        2
      ),
      "utf-8"
    );

    let errKebab: any;
    try {
      await buildDocxTemplate(rawDocx, invalidManifestFile, outDocx);
    } catch (e: any) {
      errKebab = e;
    }
    expect(errKebab).toBeDefined();
    expect(errKebab.message).toContain("Identificador com hífen inválido \"meu-slot-invalido\"");
    expect(errKebab.message).toContain("Sugestão de correção: \"{{meu_slot_invalido}}\"");
    expect(errKebab.message).toContain("NÃO faça leituras exploratórias no repositório");

    // Caso 2: tag iniciando por dígito
    writeFileSync(
      invalidManifestFile,
      JSON.stringify(
        {
          slots: [
            { coord: "P2", tag: "{{1_item}}" },
          ],
        },
        null,
        2
      ),
      "utf-8"
    );

    let errDigit: any;
    try {
      await buildDocxTemplate(rawDocx, invalidManifestFile, outDocx);
    } catch (e: any) {
      errDigit = e;
    }
    expect(errDigit).toBeDefined();
    expect(errDigit.message).toContain("Identificador iniciando por dígito \"1_item\"");
    expect(errDigit.message).toContain("Sugestão de correção: \"{{item_1}}\"");
  });
});

describe("Testes Unitários e E2E v0.7.3: Resiliência de Diretórios e Zero ENOENT", () => {
  const suiteDir = resolve(process.cwd(), "cases", "_test_temp_v073");

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

  test("1. bootstrap_case deve criar a pasta templates/ junto com inputs/, state/ e output/", async () => {
    const testCaseDir = resolve(suiteDir, "caso_inicializacao");
    const testUploadsDir = resolve(suiteDir, "uploads_inicializacao");
    mkdirSync(testUploadsDir, { recursive: true });

    const docxSource = resolve(testUploadsDir, "modelo_etp.docx");
    await createSampleRawDocx(docxSource);

    const res = await bootstrapCase(testCaseDir, testUploadsDir);
    expect(res.status).toBe("success");
    expect(existsSync(resolve(testCaseDir, "inputs"))).toBe(true);
    expect(existsSync(resolve(testCaseDir, "state"))).toBe(true);
    expect(existsSync(resolve(testCaseDir, "templates"))).toBe(true);
    expect(existsSync(resolve(testCaseDir, "output"))).toBe(true);
  });

  test("2. build_docx_template deve criar recursivamente a pasta templates/ inexistente sem erro ENOENT", async () => {
    const rawDocx = resolve(suiteDir, "fonte_bruta.docx");
    await createSampleRawDocx(rawDocx);

    const manifestFile = resolve(suiteDir, "manifesto_enoent.json");
    writeFileSync(
      manifestFile,
      JSON.stringify(
        {
          slots: [
            { coord: "P2", tag: "{{necessidade_processada}}" },
          ],
        },
        null,
        2
      ),
      "utf-8"
    );

    // Caminho onde nem templates/ nem a pasta do caso existem previamente
    const deepTemplatePath = resolve(
      suiteDir,
      "caso_sem_pastas",
      "templates",
      "template_ETP_ORGAO_A.docx"
    );

    const result = await buildDocxTemplate(rawDocx, manifestFile, deepTemplatePath);
    expect(result.success).toBe(true);
    expect(result.applied_slots_count).toBe(1);
    expect(existsSync(deepTemplatePath)).toBe(true);
  });
});

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

describe("Testes Unitários v0.9.0: Reconstrução Espacial de Tabelas e Colunas em PDF (Y-Axis Line Grouping)", () => {
  test("1. reconstructLinesFromTextItems deve ordenar linhas por Y decrescente mesmo quando os itens chegam fora de ordem e separar colunas com ' | '", () => {
    const items = [
      // Linha 2 (Y=700) emitida em ordem aleatória de colunas
      { str: "R$ 5.000,00", transform: [1, 0, 0, 1, 450, 700], width: 60, height: 10 },
      { str: "Item 01", transform: [1, 0, 0, 1, 50, 700], width: 40, height: 10 },
      { str: "Notebook Corporativo", transform: [1, 0, 0, 1, 150, 700], width: 120, height: 10 },
      { str: "50 UN", transform: [1, 0, 0, 1, 350, 700], width: 35, height: 10 },
      // Linha 1 (Y=750) no topo
      { str: "EDITAL DE PREGÃO ELETRÔNICO", transform: [1, 0, 0, 1, 50, 750], width: 200, height: 12 },
    ];

    const { reconstructLinesFromTextItems } = require("../src/index.ts");
    const lines = reconstructLinesFromTextItems(items);

    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("EDITAL DE PREGÃO ELETRÔNICO");
    expect(lines[1]).toBe("Item 01 | Notebook Corporativo | 50 UN | R$ 5.000,00");
  });

  test("2. reconstructLinesFromTextItems deve manter texto corrido contínuo com espaço normal quando gap < 18pt", () => {
    const itemsContinuous = [
      { str: "A", transform: [1, 0, 0, 1, 50, 700], width: 10, height: 10 },
      { str: "contratação", transform: [1, 0, 0, 1, 65, 700], width: 60, height: 10 },
      { str: "em", transform: [1, 0, 0, 1, 130, 700], width: 15, height: 10 },
      { str: "lote", transform: [1, 0, 0, 1, 150, 700], width: 25, height: 10 },
      { str: "único", transform: [1, 0, 0, 1, 180, 700], width: 30, height: 10 },
    ];

    const { reconstructLinesFromTextItems } = require("../src/index.ts");
    const lines = reconstructLinesFromTextItems(itemsContinuous);

    expect(lines.length).toBe(1);
    expect(lines[0]).toBe("A contratação em lote único");
  });

  test("3. reconstructLinesFromTextItems deve eliminar duplicatas exatas de sobreposição (bold/shadowing)", () => {
    const itemsShadow = [
      { str: "TERMO DE REFERÊNCIA", transform: [1, 0, 0, 1, 50, 700], width: 140, height: 10 },
      { str: "TERMO DE REFERÊNCIA", transform: [1, 0, 0, 1, 50.5, 700.2], width: 140, height: 10 },
    ];

    const { reconstructLinesFromTextItems } = require("../src/index.ts");
    const lines = reconstructLinesFromTextItems(itemsShadow);

    expect(lines.length).toBe(1);
    expect(lines[0]).toBe("TERMO DE REFERÊNCIA");
  });

  test("4. inspectDocx em arquivo .pdf deve gerar automaticamente state/dossie_hotspots_<stem>.md com Bloco 1 e Bloco 2 (±12 linhas)", async () => {
    const suiteDir = resolve(process.cwd(), "cases", "_test_temp_v090_dossie");
    mkdirSync(resolve(suiteDir, "state"), { recursive: true });

    const pdfPath = resolve(suiteDir, "edital_dossie_teste.pdf");
    const outJsonPath = resolve(suiteDir, "state", "estrutura_edital_dossie_teste.json");
    const samplePages = [
      [
        "EDITAL DE PREGÃO ELETRÔNICO Nº 01/2026 - ORGAO_CONTRATANTE",
        "PREÂMBULO",
        "1. DO OBJETO DA LICITAÇÃO",
        "O presente pregão tem por objeto a contratação em lote único de soluções corporativas.",
        "CLÁUSULA 2 - DA HABILITAÇÃO E QUALIFICAÇÃO TÉCNICA",
        "Apresentação de atestado de capacidade técnica emitido por pessoa jurídica.",
        "MINUTA DE CONTRATO",
      ],
      [
        "ANEXO I - TERMO DE REFERÊNCIA",
        "Especificação de fornecimento em lote único e subcontratação vedada.",
        "Prazo de entrega em 30 dias corridos com SLA de atendimento em 4 horas.",
        "Exigência de patrimônio líquido mínimo e garantia contratual de 5%.",
        "Vistoria técnica presencial in loco facultativa com declaração de conhecimento.",
        "Apresentação de amostra e prova de conceito PoC em 5 dias úteis.",
        "Exigência de carta de credenciamento do fabricante oficial.",
      ],
      [
        "ANEXO II - ESPECIFICAÇÕES TÉCNICAS E DATASHEET",
        "Processador com frequência mínima de 3.2 GHz, 128 GB de memória RAM.",
        "Armazenamento de 2 TB NVMe com taxa de transferência de 10 Gbps e 100.000 IOPS.",
        "Equipamento deve possuir certificação ABNT NBR ISO 9001 e garantia on-site de 36 meses.",
        "Padronização com o parque instalado de marca Dell ou equivalente.",
        "Métrica de faturamento por unidade de medida UST conforme catálogo de serviços.",
        "Pagamento mediante medição de resultado com IMR e índice de reajuste IPCA.",
      ],
    ];

    writeFileSync(pdfPath, createSyntheticPdfBuffer(samplePages));

    const result = await inspectDocx(pdfPath, outJsonPath, true);
    expect(result.dossie_hotspots_path).toBeDefined();
    expect(existsSync(result.dossie_hotspots_path!)).toBe(true);

    const dossieContent = readFileSync(result.dossie_hotspots_path!, "utf-8");
    expect(dossieContent).toContain("# Dossiê Executivo de Hotspots: edital_dossie_teste.pdf");
    expect(dossieContent).toContain("## Bloco 1: Mapa Cartográfico Estrutural e Radar das 14 Zonas de Impugnação");
    expect(dossieContent).toContain("## Bloco 2: Janelas Expandidas dos Hotspots (±12 Linhas de Contexto)");
    expect(dossieContent).toContain("### Hotspot 1:");
    expect(dossieContent).toContain("*(ALVO:");
    expect(dossieContent).toContain("Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO");

    // Verifica que o payload sintético inclui dossie_path e respeita o teto de 1024 bytes (Lei 2)
    const synthetic = formatInspectDocxSyntheticResult(pdfPath, outJsonPath, result);
    expect(synthetic.dossie_path).toBeDefined();
    expect(synthetic.dossie_path).toContain("dossie_hotspots_edital_dossie_teste.md");
    const byteLen = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(byteLen).toBeLessThan(1024);

    rmSync(suiteDir, { recursive: true, force: true });
  });

  test("5. generateHotspotsDossierMarkdown deve fundir intervalos contíguos de hotspots em bloco unificado", () => {
    const { generateHotspotsDossierMarkdown } = require("../src/index.ts");
    const dummyExtraction = {
      pageCount: 1,
      lineCount: 20,
      pages: [
        {
          pageNumber: 1,
          lines: Array.from({ length: 20 }, (_, i) => ({
            page: 1,
            line: i + 1,
            coord: `PAG_001 | L${String(i + 1).padStart(4, "0")}`,
            bracket_coord: `[PAG_001 | L${String(i + 1).padStart(4, "0")}]`,
            text: `Linha de teste ${i + 1} com conteúdo licitatório genérico.`,
          })),
        },
      ],
      lines: Array.from({ length: 20 }, (_, i) => ({
        page: 1,
        line: i + 1,
        coord: `PAG_001 | L${String(i + 1).padStart(4, "0")}`,
        bracket_coord: `[PAG_001 | L${String(i + 1).padStart(4, "0")}]`,
        text: `Linha de teste ${i + 1} com conteúdo licitatório genérico.`,
      })),
    };

    const dummyCartography = {
      outline_headings: [],
      page_signals: [],
      impugnation_zones: {
        Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO: [
          { coord: "[PAG_001 | L0005]", keyword: "lote único", snippet: "lote único", section: "SECAO_A" },
        ],
        Z2_QUALIFICACAO_TECNICA_ATESTADOS: [
          { coord: "[PAG_001 | L0008]", keyword: "atestado", snippet: "atestado", section: "SECAO_A" },
        ],
        Z3_QUALIFICACAO_ECONOMICA_GARANTIAS: [],
        Z4_VISTORIA_VISITA_TECNICA: [],
        Z5_AMOSTRA_POC_HOMOLOGACAO: [],
        Z6_VINCULO_FABRICANTE_SOLIDARIEDADE: [],
        Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP: [],
        Z8_PRAZOS_ENTREGA_SLA_GARANTIA: [],
        Z9_EQUIPE_CERTIFICACOES_SEDE: [],
        Z10_PRECOS_EXEQUIBILIDADE_PLANILHA: [],
        Z11_PAGAMENTO_REAJUSTE_IMR_SANCOES: [],
        Z12_MAPA_CRUZADO_MULTIPECA: [],
        Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO: [],
        Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO: [],
      },
    };

    const md = generateHotspotsDossierMarkdown("teste.pdf", dummyExtraction, dummyCartography);
    // Linha 5 e Linha 8 estão dentro do intervalo de ±12 linhas (distância 3), logo devem ser fundidas em 1 único Hotspot
    expect(md).toContain("### Hotspot 1: [PAG_001 | L0001] .. [PAG_001 | L0020]");
    expect(md).not.toContain("### Hotspot 2:");
  });

  test("6. Detector de Páginas Escaneadas (Scanned PDF Trap): deve detectar densidade < 25 chars, retornar scanned_pages_detected e inserir marcador de alerta crítico", async () => {
    const suiteDir = resolve(process.cwd(), "cases", "_test_temp_v090_scanned");
    mkdirSync(resolve(suiteDir, "state"), { recursive: true });

    const pdfPath = resolve(suiteDir, "edital_com_pagina_escaneada.pdf");
    const outJsonPath = resolve(suiteDir, "state", "estrutura_edital_com_pagina_escaneada.json");

    // Página 1: Normal (> 25 chars)
    // Página 2: Escaneada (vazia ou quase vazia: "1" ou "")
    // Página 3: Normal (> 25 chars)
    const pagesContent = [
      [
        "EDITAL DE PREGÃO ELETRÔNICO Nº 01/2026 - ORGAO_CONTRATANTE",
        "PREÂMBULO E REGRAS GERAIS DE CONTRATAÇÃO PÚBLICA",
      ],
      [
        "2", // Apenas número de página isolado (1 char, < 25 chars)
      ],
      [
        "ANEXO I - TERMO DE REFERÊNCIA E DETALHAMENTO DO OBJETO",
        "ESPECIFICAÇÕES TÉCNICAS E CONDIÇÕES DE FORNECIMENTO",
      ],
    ];

    writeFileSync(pdfPath, createSyntheticPdfBuffer(pagesContent));

    const result = await inspectDocx(pdfPath, outJsonPath, true);

    expect(result.scanned_pages_detected).toBeDefined();
    expect(result.scanned_pages_detected).toEqual([2]);

    // Verifica que o marcador de alerta crítico foi injetado na visao_auditoria_*.md
    expect(result.audit_view_path).toBeDefined();
    const auditMd = readFileSync(result.audit_view_path!, "utf-8");
    expect(auditMd).toContain("[ALERTA CRÍTICO: PÁGINA ESCANEADA COMO IMAGEM — SEM CAMADA DE TEXTO EXTRAÍVEL]");
    expect(auditMd).toContain("### Página 002");

    // Verifica que o retorno sintético MCP expõe scanned_pages e o hint de alerta
    const synthetic = formatInspectDocxSyntheticResult(pdfPath, outJsonPath, result);
    expect(synthetic.scanned_pages).toEqual([2]);
    expect(synthetic.next_step_hint).toContain("ALERTA: páginas escaneadas detectadas (2)");
    const byteLen = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(byteLen).toBeLessThan(1024);

    rmSync(suiteDir, { recursive: true, force: true });
  });

  test("7. bootstrapCase com múltiplos arquivos deve consolidar state/indice_mestre_caso.md mapeando documentos e dispersão das 14 Zonas", async () => {
    const suiteDir = resolve(process.cwd(), "cases", "_test_temp_v090_master");
    const uploadsDir = resolve(suiteDir, "uploads");
    const caseDir = resolve(suiteDir, "caso_multi_doc");

    mkdirSync(uploadsDir, { recursive: true });

    // Arquivo 1: Edital em PDF (Z1, Z2, Z7)
    const editalPages = [
      [
        "EDITAL DE LICITAÇÃO Nº 10/2026 - ORGAO_CONTRATANTE",
        "PREÂMBULO",
        "Contratação em lote único com vedação de consórcio.",
        "CLÁUSULA DE QUALIFICAÇÃO TÉCNICA",
        "Apresentação de atestado de capacidade técnica.",
      ],
      [
        "ESPECIFICAÇÕES TÉCNICAS E DATASHEET",
        "Equipamento com processador de 3.2 GHz e memória NVMe.",
        "Apresentação do datasheet do fabricante.",
      ],
    ];
    writeFileSync(resolve(uploadsDir, "Edital.pdf"), createSyntheticPdfBuffer(editalPages));

    // Arquivo 2: TR em PDF (Z1, Z4, Z8)
    const trPages = [
      [
        "ANEXO I - TERMO DE REFERÊNCIA",
        "Contratação por preço global em lote único.",
        "Vistoria técnica presencial in loco facultativa.",
        "Prazo de entrega de 30 dias corridos com SLA de atendimento.",
      ],
    ];
    writeFileSync(resolve(uploadsDir, "Anexo_I_TR.pdf"), createSyntheticPdfBuffer(trPages));

    // Arquivo 3: Minuta em DOCX (Z3, Z11)
    await createSampleRawDocx(resolve(uploadsDir, "Minuta_Contrato.docx"));

    const res = await bootstrapCase(caseDir, uploadsDir);

    expect(res.status).toBe("success");
    expect(res.inspectedPdf).toBeDefined();
    expect(res.inspectedPdf!.length).toBe(2);
    expect(res.inspectedDocx.length).toBe(1);

    expect(res.indice_mestre_path).toBeDefined();
    expect(existsSync(res.indice_mestre_path!)).toBe(true);

    const masterMd = readFileSync(res.indice_mestre_path!, "utf-8");
    expect(masterMd).toContain("# 🗺️ Índice Mestre Cartográfico do Processo: caso_multi_doc");
    expect(masterMd).toContain("## 1. Inventário de Documentos do Processo");
    expect(masterMd).toContain("Edital.pdf");
    expect(masterMd).toContain("Anexo_I_TR.pdf");
    expect(masterMd).toContain("Minuta_Contrato.docx");

    expect(masterMd).toContain("## 2. Matriz Cruzada das 14 Zonas de Impugnação (Z1 a Z14)");
    // Z1 deve ser detectada tanto em Edital.pdf quanto em Anexo_I_TR.pdf
    expect(masterMd).toContain("Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO");
    expect(masterMd).toContain("Edital.pdf");
    expect(masterMd).toContain("Anexo_I_TR.pdf");

    // Z7 detectada em Edital.pdf
    expect(masterMd).toContain("Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP");

    expect(masterMd).toContain("## 3. Alertas Globais e Sinais de Alta Densidade Técnica/Orçamentária");
    expect(masterMd).toContain("### 3.1. Alerta de Páginas Escaneadas (Scanned PDF Trap)");

    // Retorno sintético deve conter master_index_path e manter teto < 1024 bytes (Lei 2)
    const synthetic = formatBootstrapCaseSyntheticResult(res, "cases/caso_multi_doc");
    expect(synthetic.master_index_path).toBe("state/indice_mestre_caso.md");
    const byteLen = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(byteLen).toBeLessThan(1024);

    rmSync(suiteDir, { recursive: true, force: true });
  });
});


