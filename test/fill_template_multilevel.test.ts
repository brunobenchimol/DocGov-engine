import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import {
  processDocument,
  inspectDocx,
  buildDocxTemplate,
  formatFillDocxTemplateSyntheticResult,
  VERSION,
} from "../src/index.ts";
import {
  createSampleRawDocx,
  createSuiteTempDir,
} from "./helpers/fixtures.ts";

describe("Testes Unitários: fill_docx_template (Auto-Inspeção, Listas Multinível Híbridas e Conversão Markdown)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("fill_template_multilevel");

  afterAll(() => {
    cleanup();
  });

  test("deve executar auto-inspeção integrada em fill_docx_template gerando inspecao_<stem>.json e visao_auditoria_<stem>.md, retornando payload sintético < 1024b (v0.6.4)", async () => {
    const caseFolder = resolve(tempDir, "auto_inspect_case");
    const inputsDir = resolve(caseFolder, "inputs");
    const stateDir = resolve(caseFolder, "state");
    const outputDir = resolve(caseFolder, "output");
    mkdirSync(inputsDir, { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });

    // 1. Cria template de teste
    const rawDocx = resolve(inputsDir, "modelo_etp.docx");
    const templateDocx = resolve(stateDir, "template_etp.docx");
    const manifestPath = resolve(stateDir, "slots_manifest.json");
    await createSampleRawDocx(rawDocx);

    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          slots: [
            { coord: "P3", tag: "{{estudo.necessidade}}" },
            { coord: "T0.R0.C1", tag: "{{metadados.unidade}}" },
          ],
        },
        null,
        2
      ),
      "utf-8"
    );

    await buildDocxTemplate(rawDocx, manifestPath, templateDocx);

    // 2. Prepara estado do caso
    const stateJson = resolve(stateDir, "estado_caso.json");
    writeFileSync(
      stateJson,
      JSON.stringify(
        {
          estudo: { necessidade: "Necessidade validada e aprovada pelo órgão." },
          metadados: { unidade: "Coordenação de Tecnologia e Governança" },
        },
        null,
        2
      ),
      "utf-8"
    );

    // 3. Executa fill_docx_template (default: autoInspect = true)
    const finalDocx = resolve(outputDir, "ETP_Final.docx");
    const result = await processDocument(templateDocx, stateJson, finalDocx);

    expect(result.success).toBe(true);
    expect(existsSync(finalDocx)).toBe(true);

    const expectedInspectionPath = resolve(stateDir, "inspecao_ETP_Final.json");
    const expectedAuditViewPath = resolve(stateDir, "visao_auditoria_ETP_Final.md");

    expect(result.inspection_path).toBe(expectedInspectionPath);
    expect(result.visao_auditoria_path).toBe(expectedAuditViewPath);
    expect(existsSync(expectedInspectionPath)).toBe(true);
    expect(existsSync(expectedAuditViewPath)).toBe(true);

    const auditViewContent = readFileSync(expectedAuditViewPath, "utf-8");
    expect(auditViewContent).toContain("ETP_Final.docx");
    expect(auditViewContent).toContain("Necessidade validada e aprovada pelo órgão.");
    expect(auditViewContent).toContain("Coordenação de Tecnologia e Governança");

    expect(result.next_step_hint).toContain("Documento compilado e visão linear de auditoria gerada automaticamente em");
    expect(result.next_step_hint).toContain("visao_auditoria_ETP_Final.md");
    expect(result.next_step_hint).toContain("Próximo: acione o Auditor Externo lendo diretamente a visão linear (dispensado rodar inspect_doc novamente).");

    const synthetic = formatFillDocxTemplateSyntheticResult(result);
    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.outputPath).toContain("ETP_Final.docx");
    expect(synthetic.inspection_path).toContain("inspecao_ETP_Final.json");
    expect(synthetic.visao_auditoria_path).toContain("visao_auditoria_ETP_Final.md");
    expect(synthetic.next_step_hint).toBe(result.next_step_hint);

    const payloadBytes = Buffer.byteLength(JSON.stringify(synthetic), "utf-8");
    expect(payloadBytes).toBeLessThan(1024);

    // 4. Cenário com autoInspect: false
    const finalDocxNoInspect = resolve(outputDir, "ETP_NoInspect.docx");
    const resultNoInspect = await processDocument(
      templateDocx,
      stateJson,
      finalDocxNoInspect,
      { autoInspect: false }
    );

    expect(resultNoInspect.success).toBe(true);
    expect(existsSync(finalDocxNoInspect)).toBe(true);
    expect(resultNoInspect.inspection_path).toBeUndefined();
    expect(resultNoInspect.visao_auditoria_path).toBeUndefined();
    expect(existsSync(resolve(stateDir, "inspecao_ETP_NoInspect.json"))).toBe(false);
    expect(existsSync(resolve(stateDir, "visao_auditoria_ETP_NoInspect.md"))).toBe(false);
    expect(resultNoInspect.next_step_hint).toContain("inspect_doc");

    const syntheticNoInspect = formatFillDocxTemplateSyntheticResult(resultNoInspect);
    expect(syntheticNoInspect.status).toBe("success");
    expect(syntheticNoInspect.engine_version).toBe(VERSION);
    expect(syntheticNoInspect.inspection_path).toBeUndefined();
    expect(syntheticNoInspect.visao_auditoria_path).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(syntheticNoInspect), "utf-8")).toBeLessThan(1024);
  });

  test("Motor Híbrido v0.7.0: Fora de tabela (<w:body>) deve criar word/numbering.xml (9 níveis + startOverride do capítulo pai + limpeza do prefixo literal) e dentro de tabela (<w:tc>) deve aplicar Hanging Indent com <w:r><w:tab/></w:r>, sincronizando inspect_docx e visao_auditoria", async () => {
    const hybridFolder = resolve(tempDir, "hybrid_list_v070_case");
    const inputsDir = resolve(hybridFolder, "inputs");
    const stateDir = resolve(hybridFolder, "state");
    const outputDir = resolve(hybridFolder, "output");
    mkdirSync(inputsDir, { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });

    const rawDocx = resolve(inputsDir, "modelo_tr_orgao_contratante.docx");
    const templateDocx = resolve(stateDir, "template_tr.docx");
    const manifestFile = resolve(stateDir, "slots_manifest.json");
    const stateFile = resolve(stateDir, "estado_caso.json");
    const finalDocx = resolve(outputDir, "TR_ORGAO_CONTRATANTE.docx");

    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );
    zip.file(
      "word/_rels/document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`
    );
    zip.file(
      "word/numbering.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>4. REQUISITOS DA CONTRATAÇÃO (ORGAO_CONTRATANTE)</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="BodyText"/></w:pPr>
      <w:r><w:t>Placeholder de subitens do capítulo 4 no texto corrido.</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Obrigações Específicas (MUNICIPIO_GENERICO)</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Placeholder de subitens dentro de célula de tabela.</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    );
    writeFileSync(rawDocx, await zip.generateAsync({ type: "nodebuffer" }));

    writeFileSync(
      manifestFile,
      JSON.stringify(
        {
          slots: [
            { coord: "P1", tag: "{{tr.requisitos_cap4}}" },
            { coord: "T0.R0.C1", tag: "{{tr.obrigacoes_tabela}}" },
          ],
        },
        null,
        2
      ),
      "utf-8"
    );
    await buildDocxTemplate(rawDocx, manifestFile, templateDocx);

    const stateData = {
      tr: {
        requisitos_cap4: [
          "**4.1. Sustentabilidade Ambiental:** A contratada deverá observar diretrizes federais.",
          "**4.1.1. Logística Reversa:** Descarte ambientalmente adequado de insumos.",
          "**4.1.2. Eficiência Energética:** Equipamentos com selo de baixo consumo.",
          "**4.2. Subcontratação:** Não será admitida a subcontratação do objeto principal.",
        ].join("\n"),
        obrigacoes_tabela: [
          "**1.1. Prazo de Entrega:** Até 15 dias úteis na sede do ORGAO_A.",
          "**1.1.1. Local de Recebimento:** Almoxarifado Central do ORGAO_B.",
          "  a) Conferência provisória no ato da entrega;",
          "  - Termo de recebimento definitivo em 5 dias.",
        ].join("\n"),
      },
    };
    writeFileSync(stateFile, JSON.stringify(stateData, null, 2), "utf-8");

    const fillRes = await processDocument(templateDocx, stateFile, finalDocx);
    expect(fillRes.success).toBe(true);
    expect(existsSync(finalDocx)).toBe(true);

    const outZip = await JSZip.loadAsync(readFileSync(finalDocx));
    const ctXml = await outZip.file("[Content_Types].xml")!.async("string");
    const relsXml = await outZip
      .file("word/_rels/document.xml.rels")!
      .async("string");
    const numXml = await outZip.file("word/numbering.xml")!.async("string");
    const docXml = await outZip.file("word/document.xml")!.async("string");

    expect(ctXml).toContain('PartName="/word/numbering.xml"');
    expect(ctXml).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"
    );
    expect(relsXml).toContain(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering"
    );
    expect(relsXml).toContain('Target="numbering.xml"');

    expect(numXml).toContain('w:abstractNumId="1"');
    expect(numXml).toContain('w:numId="1"');

    // ENG-14b: multi_decimal fora de tabela grava o número literal reancorado no <w:t> com <w:tab/> e sem <w:numPr> órfão
    expect(docXml).toContain("4.1.1.");
    expect(docXml).toContain("4.1.2.");
    expect(docXml).toContain("Sustentabilidade Ambiental:");
    expect(docXml).toContain("Logística Reversa:");
    expect(docXml).not.toContain('<w:numPr>');

    expect(docXml).toContain("4.1.1.");
    expect(docXml).toContain("<w:tab/>");
    expect(docXml).toContain('<w:tab w:val="left" w:pos="720"/>');
    expect(docXml).toContain('w:hanging="480"');

    const finalInsp = await inspectDocx(finalDocx);
    expect(finalInsp.paragraphs[0].text).toBe(
      "4. REQUISITOS DA CONTRATAÇÃO (ORGAO_CONTRATANTE)"
    );
    expect(finalInsp.paragraphs[1].text).toBe(
      "4.1. Sustentabilidade Ambiental: A contratada deverá observar diretrizes federais."
    );
    expect(finalInsp.paragraphs[2].text).toBe(
      "4.1.1. Logística Reversa: Descarte ambientalmente adequado de insumos."
    );
    expect(finalInsp.paragraphs[3].text).toBe(
      "4.1.2. Eficiência Energética: Equipamentos com selo de baixo consumo."
    );
    expect(finalInsp.paragraphs[4].text).toBe(
      "4.2. Subcontratação: Não será admitida a subcontratação do objeto principal."
    );

    const tableCellText = finalInsp.tables[0].rows[0].cells[1].text;
    expect(tableCellText).toContain(
      "4.1. Prazo de Entrega: Até 15 dias úteis na sede do ORGAO_A."
    );
    expect(tableCellText).toContain(
      "4.1.1. Local de Recebimento: Almoxarifado Central do ORGAO_B."
    );
    expect(tableCellText).toContain(
      "a) Conferência provisória no ato da entrega;"
    );
    expect(tableCellText).toContain(
      "- Termo de recebimento definitivo em 5 dias."
    );

    const auditMd = readFileSync(fillRes.visao_auditoria_path!, "utf-8");
    expect(auditMd).toContain(
      "4.1. Sustentabilidade Ambiental: A contratada deverá observar diretrizes federais."
    );
    expect(auditMd).toContain(
      "4.1.1. Logística Reversa: Descarte ambientalmente adequado de insumos."
    );
    expect(auditMd).toContain(
      "4.1.2. Eficiência Energética: Equipamentos com selo de baixo consumo."
    );
    expect(auditMd).toContain(
      "4.2. Subcontratação: Não será admitida a subcontratação do objeto principal."
    );
    expect(auditMd).toContain(
      "4.1. Prazo de Entrega: Até 15 dias úteis"
    );
  });

  test("v0.9.5: fillDocxTemplate com outputFormat: 'pdf' e 'both' deve exportar PDF (%PDF-) e manter payload < 1024 bytes", async () => {
    const testCase = resolve(tempDir, "output_format_case");
    const inputDir = resolve(testCase, "inputs");
    const stateDir = resolve(testCase, "state");
    const outputDir = resolve(testCase, "output");
    mkdirSync(inputDir, { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });

    const sourceDocx = resolve(inputDir, "template_base.docx");
    await createSampleRawDocx(sourceDocx);

    const stateJson = resolve(stateDir, "estado.json");
    writeFileSync(
      stateJson,
      JSON.stringify({
        processo_id: "PROC-2026/01",
        objeto: { descricao: "Contratação de Solução de Infraestrutura" },
      }),
      "utf-8"
    );

    // 1. Teste com outputFormat: "pdf"
    const finalDocx = resolve(outputDir, "Documento_Final.docx");
    const expectedPdf = resolve(outputDir, "Documento_Final.pdf");

    const resPdf = await processDocument(sourceDocx, stateJson, finalDocx, {
      outputFormat: "pdf",
      autoInspect: true,
    });

    expect(resPdf.success).toBe(true);
    expect(resPdf.pdf_path).toBe(expectedPdf);
    expect(existsSync(expectedPdf)).toBe(true);
    expect(readFileSync(expectedPdf).subarray(0, 5).toString("utf-8")).toBe("%PDF-");
    expect(resPdf.visao_auditoria_path).toBeDefined();
    expect(existsSync(resPdf.visao_auditoria_path!)).toBe(true);

    const syntheticPdf = formatFillDocxTemplateSyntheticResult(resPdf, testCase);
    expect(syntheticPdf.status).toBe("success");
    expect(syntheticPdf.pdf_path).toBe("output/Documento_Final.pdf");
    expect(Buffer.byteLength(JSON.stringify(syntheticPdf, null, 2), "utf-8")).toBeLessThan(1024);

    // 2. Teste com outputFormat: "both"
    const bothDocx = resolve(outputDir, "Documento_Both.docx");
    const bothPdf = resolve(outputDir, "Documento_Both.pdf");

    const resBoth = await processDocument(sourceDocx, stateJson, bothDocx, {
      outputFormat: "both",
      autoInspect: true,
    });

    expect(resBoth.success).toBe(true);
    expect(existsSync(bothDocx)).toBe(true);
    expect(existsSync(bothPdf)).toBe(true);
    expect(resBoth.pdf_path).toBe(bothPdf);

    const syntheticBoth = formatFillDocxTemplateSyntheticResult(resBoth, testCase);
    expect(syntheticBoth.status).toBe("success");
    expect(syntheticBoth.outputPath).toBe("output/Documento_Both.docx");
    expect(syntheticBoth.pdf_path).toBe("output/Documento_Both.pdf");
    expect(Buffer.byteLength(JSON.stringify(syntheticBoth, null, 2), "utf-8")).toBeLessThan(1024);

    // 3. Teste com formato inválido deve lançar erro
    let threwInvalid = false;
    try {
      await processDocument(sourceDocx, stateJson, resolve(outputDir, "invalido.docx"), {
        outputFormat: "invalido" as any,
      });
    } catch (err: any) {
      threwInvalid = true;
      expect(err.message).toContain("Formato de saída inválido");
    }
    expect(threwInvalid).toBe(true);
  }, 30000);

  test("ENG-06: fill_docx_template deve converter tabelas Markdown (| Col1 | Col2 |) em elementos <w:tbl> reais do OpenXML com <w:tblGrid>, bordas CBD5E1, cabeçalho F1F5F9 e alinhamentos", async () => {
    const rawDocx = resolve(tempDir, "eng06_raw.docx");
    const tplDocx = resolve(tempDir, "eng06_tpl.docx");
    const manifestJson = resolve(tempDir, "eng06_manifest.json");
    const stateJson = resolve(tempDir, "eng06_state.json");
    const outDocx = resolve(tempDir, "eng06_final.docx");

    await createSampleRawDocx(rawDocx);

    writeFileSync(
      manifestJson,
      JSON.stringify(
        {
          replace_paragraphs: [
            { start_p: 3, end_p: 4, tag: "{{estudo.catalogo_uns}}" },
          ],
          replace_table_cells: [
            { table_index: 0, row_index: 0, cell_index: 1, tag: "{{metadados.tabela_interna}}" },
          ],
        },
        null,
        2
      ),
      "utf-8"
    );

    const buildRes = await buildDocxTemplate(rawDocx, manifestJson, tplDocx);
    expect(buildRes.success).toBe(true);

    const markdownWithTable = [
      "Abaixo apresenta-se a Tabela de Conversão de Catálogo:",
      "| Código SKU | Descrição do Item | Métrica | Fator UNS |",
      "| :--- | :--- | :---: | ---: |",
      "| SKU-001 | **Subscrição Enterprise** Nível 1 | Anual | 1,50 |",
      "| SKU-002 | Suporte Técnico Especializado | Mensal | 2,75 |",
      "Observação final após a tabela convertida.",
    ].join("\n");

    const nestedMarkdownTable = [
      "| Perfil | UST |",
      "| :--- | ---: |",
      "| Arquiteto | 120 |",
    ].join("\n");

    writeFileSync(
      stateJson,
      JSON.stringify(
        {
          estudo: {
            catalogo_uns: markdownWithTable,
          },
          metadados: {
            tabela_interna: nestedMarkdownTable,
          },
        },
        null,
        2
      ),
      "utf-8"
    );

    const fillRes = await processDocument(tplDocx, stateJson, outDocx, {
      autoInspect: false,
    });
    expect(fillRes.success).toBe(true);

    const zip = await JSZip.loadAsync(readFileSync(outDocx));
    const docXmlStr = await zip.file("word/document.xml")!.async("string");

    // 1. Não deve restar nenhuma linha separadora de tabela Markdown crua (| :--- |)
    expect(docXmlStr).not.toContain(":---");
    expect(docXmlStr).not.toContain("---:");
    expect(docXmlStr).not.toContain(":---:");

    // 2. Deve conter elementos <w:tblGrid>, bordas CBD5E1 e sombreado F1F5F9 no cabeçalho
    expect(docXmlStr).toContain("w:color=\"CBD5E1\"");
    expect(docXmlStr).toContain("w:fill=\"F1F5F9\"");
    expect(docXmlStr).toContain("<w:tblHeader/>");
    expect(docXmlStr).toContain("w:val=\"center\"");
    expect(docXmlStr).toContain("w:val=\"right\"");

    // 3. Conformidade ECMA-376: toda célula <w:tc> que recebeu tabela aninhada termina obrigatoriamente com <w:p>
    expect(docXmlStr).not.toContain("</w:tbl></w:tc>");

    // 4. Inspeção do documento gerado deve enxergar a nova tabela no <w:body> (eram 2 tabelas no modelo, agora são 3!)
    const finalInsp = await inspectDocx(outDocx);
    expect(finalInsp.tables.length).toBe(3);

    const convertedTbl = finalInsp.tables.find(
      (t) => t.rows.length === 3 && t.rows[0].cells[0]?.text.includes("Código SKU")
    );
    expect(convertedTbl).toBeDefined();
    expect(convertedTbl!.rows[1].cells[0].text).toBe("SKU-001");
    expect(convertedTbl!.rows[1].cells[1].text).toBe("Subscrição Enterprise Nível 1");
    expect(convertedTbl!.rows[1].cells[3].text).toBe("1,50");
    expect(convertedTbl!.rows[2].cells[0].text).toBe("SKU-002");
  });
});
