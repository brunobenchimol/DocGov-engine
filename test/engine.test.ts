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
} from "../src/index.ts";
import { createSampleRawDocx } from "./helpers/fixtures.ts";

describe("Testes Unitários v0.7.3: engine_version e Teto Estrito MCP (< 1024 bytes) nas 5 Ferramentas", () => {
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
    expect(synthetic.engine_version).toBe("0.7.3");
    expect(synthetic).toHaveProperty("engine_version");

    const json = JSON.stringify(synthetic, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");
    expect(bytes).toBeLessThan(1024);
  });

  test("2. inspect_docx deve conter 'engine_version' na raiz e payload < 1024 bytes", () => {
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
    expect(synthetic.engine_version).toBe("0.7.3");
    expect(synthetic).toHaveProperty("engine_version");

    const json = JSON.stringify(synthetic, null, 2);
    const bytes = Buffer.byteLength(json, "utf-8");
    expect(bytes).toBeLessThan(1024);
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
    expect(synthetic.engine_version).toBe("0.7.3");
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
    expect(synthetic.engine_version).toBe("0.7.3");
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
    expect(synthetic.engine_version).toBe("0.7.3");
    expect(synthetic).toHaveProperty("engine_version");
    expect(synthetic.next_step_hint).toContain("Ciclo de auditoria concluído");

    // Verifica também o alias exportado
    const aliasSynthetic = formatAuditDocxSyntheticResult({
      outputPath: "output/Relatorio_Auditoria_DFD.docx",
      message: "Relatório de Auditoria (.docx) gerado com sucesso em: output/Relatorio_Auditoria_DFD.docx",
    });
    expect(aliasSynthetic.engine_version).toBe("0.7.3");

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
      expect(p.engine_version).toBe("0.7.3");
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
      "template_ETP_SEDUC.docx"
    );

    const result = await buildDocxTemplate(rawDocx, manifestFile, deepTemplatePath);
    expect(result.success).toBe(true);
    expect(result.applied_slots_count).toBe(1);
    expect(existsSync(deepTemplatePath)).toBe(true);
  });
});
