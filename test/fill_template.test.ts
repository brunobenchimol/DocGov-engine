import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import {
  processDocument,
  inspectDocx,
  buildDocxTemplate,
  detectHierarchicalListItem,
  formatFillDocxTemplateSyntheticResult,
  type SlotsManifest,
  VERSION,
} from "../src/index.ts";
import {
  MINIMAL_DOCX_BASE64,
  createSampleRawDocx,
  createSuiteTempDir,
} from "./helpers/fixtures.ts";

describe("Testes Unitários: fill_docx_template (Injeção, Listas Multinível v0.7.0, Auto-Inspeção)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("fill_template");
  const templatePath = resolve(tempDir, "template_input.docx");
  const statePath = resolve(tempDir, "state_input.json");
  const outputPath = resolve(tempDir, "resultado_final.docx");

  // Arquivos do teste E2E
  const rawDocxPath = resolve(tempDir, "bruto_sem_tags.docx");
  const inspectJsonPath = resolve(tempDir, "inspecao.json");
  const manifestPath = resolve(tempDir, "slots_manifest.json");
  const builtTemplatePath = resolve(tempDir, "template_parametrizado.docx");
  const e2eStatePath = resolve(tempDir, "e2e_state.json");
  const e2eFinalDocxPath = resolve(tempDir, "e2e_final.docx");

  beforeAll(async () => {
    writeFileSync(templatePath, Buffer.from(MINIMAL_DOCX_BASE64, "base64"));

    const mockState = {
      processo_id: "POC-2026-001",
      objeto: {
        descricao: "Contratação de plataforma em nuvem para o Órgão Y",
      },
    };
    writeFileSync(statePath, JSON.stringify(mockState, null, 2), "utf-8");

    await createSampleRawDocx(rawDocxPath);
  });

  afterAll(() => {
    cleanup();
  });

  test("deve processar o template básico e injetar variáveis sem erros", async () => {
    const result = await processDocument(templatePath, statePath, outputPath);

    expect(result.success).toBe(true);
    expect(existsSync(outputPath)).toBe(true);
  });

  test("deve lançar erro se o template não existir", async () => {
    expect(
      processDocument("caminho_inexistente.docx", statePath, outputPath)
    ).rejects.toThrow("Template não encontrado");
  });

  test("Fluxo Completo E2E: inspect_docx -> build_docx_template -> fill_docx_template", async () => {
    // 1. Inspecionar documento bruto (sem tags)
    const inspection = await inspectDocx(rawDocxPath, inspectJsonPath);

    expect(existsSync(inspectJsonPath)).toBe(true);
    expect(inspection.headers.length).toBe(1);
    expect(inspection.headers[0].text).toBe(
      "Órgão Público Contratante (ORGAO_A)"
    );
    expect(inspection.footers.length).toBe(1);
    expect(inspection.footers[0].text).toBe(
      "Processo Administrativo nº 000/2026"
    );

    expect(inspection.paragraphs.length).toBe(5);
    expect(inspection.paragraphs[0]).toEqual({
      index: 0,
      style: "Heading1",
      text: "ESTUDO TÉCNICO PRELIMINAR",
    });
    expect(inspection.paragraphs[3]).toEqual({
      index: 3,
      style: "BodyText",
      text: "Texto original parágrafo 1 a substituir.",
    });

    expect(inspection.tables.length).toBe(2);
    expect(inspection.tables[0].rows.length).toBe(2);
    expect(inspection.tables[1].rows.length).toBe(4);

    // 2. Construir template parametrizado via slots_manifest.json
    const manifest: SlotsManifest = {
      replace_paragraphs: [
        {
          start_p: 3,
          end_p: 4,
          tag: "{{estudo.descricao_necessidade}}",
        },
      ],
      replace_table_cells: [
        {
          table_index: 0,
          row_index: 0,
          cell_index: 1,
          tag: "{{metadados.unidade_requisitante}}",
        },
        {
          table_index: 0,
          row_index: 1,
          cell_index: 1,
          tag: "{{metadados.responsavel}}",
        },
      ],
      loop_table_rows: [
        {
          table_index: 1,
          header_row_index: 0,
          template_row_index: 1,
          remove_from_row: 2,
          remove_to_row: 3,
          for_open_tag: "{{FOR r IN gestao_riscos}}",
          for_close_tag: "{{END-FOR r}}",
          cell_tags: ["{{$r.risco}}", "{{$r.mitigacao}}"],
        },
      ],
      replace_inline: [
        {
          find: "Órgão Público Contratante (ORGAO_A)",
          replace: "{{metadados.orgao_entidade}}",
        },
        {
          find: "000/2026",
          replace: "{{metadados.numero_processo}}",
        },
      ],
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    const buildRes = await buildDocxTemplate(
      rawDocxPath,
      manifestPath,
      builtTemplatePath
    );
    expect(buildRes.success).toBe(true);
    expect(existsSync(builtTemplatePath)).toBe(true);

    // Verificar estrutura do template construído
    const tplInspection = await inspectDocx(builtTemplatePath);
    expect(tplInspection.paragraphs.length).toBe(4);
    expect(tplInspection.paragraphs[3].style).toBe("BodyText");
    expect(tplInspection.paragraphs[3].text).toBe(
      "{{estudo.descricao_necessidade}}"
    );
    expect(tplInspection.headers[0].text).toBe("{{metadados.orgao_entidade}}");
    expect(tplInspection.footers[0].text).toBe(
      "Processo Administrativo nº {{metadados.numero_processo}}"
    );
    expect(tplInspection.tables[1].rows.length).toBe(2);

    // 3. Preencher o template construído com dados reais
    const e2eState = {
      metadados: {
        orgao_entidade: "Departamento de Administração Geral (ORGAO_DEMANDANTE)",
        numero_processo: "PROC-2026/88990",
        unidade_requisitante: "Diretoria de Governança e Tecnologia",
        responsavel: "Bruno Benchimol",
      },
      estudo: {
        descricao_necessidade:
          "Necessidade de modernização da infraestrutura de automação documental.",
      },
      gestao_riscos: [
        {
          risco: "Indisponibilidade temporária do serviço",
          mitigacao: "Arquitetura redundante multi-zona",
        },
        {
          risco: "Atraso na migração de modelos legados",
          mitigacao: "Uso do motor automatizado build_docx_template",
        },
      ],
    };
    writeFileSync(e2eStatePath, JSON.stringify(e2eState, null, 2), "utf-8");

    const fillRes = await processDocument(
      builtTemplatePath,
      e2eStatePath,
      e2eFinalDocxPath
    );
    expect(fillRes.success).toBe(true);
    expect(existsSync(e2eFinalDocxPath)).toBe(true);

    // 4. Inspecionar documento final gerado
    const finalInspection = await inspectDocx(e2eFinalDocxPath);

    expect(finalInspection.headers[0].text).toBe(
      "Departamento de Administração Geral (ORGAO_DEMANDANTE)"
    );
    expect(finalInspection.footers[0].text).toBe(
      "Processo Administrativo nº PROC-2026/88990"
    );
    expect(finalInspection.paragraphs[1].text).toBe(
      "Órgão: Departamento de Administração Geral (ORGAO_DEMANDANTE)"
    );
    expect(finalInspection.paragraphs[3].text).toBe(
      "Necessidade de modernização da infraestrutura de automação documental."
    );
    expect(finalInspection.tables[0].rows[0].cells[1].text).toBe(
      "Diretoria de Governança e Tecnologia"
    );
    expect(finalInspection.tables[0].rows[1].cells[1].text).toBe(
      "Bruno Benchimol"
    );

    expect(finalInspection.tables[1].rows.length).toBe(3);
    expect(finalInspection.tables[1].rows[1].cells[0].text).toBe(
      "Indisponibilidade temporária do serviço"
    );
    expect(finalInspection.tables[1].rows[1].cells[1].text).toBe(
      "Arquitetura redundante multi-zona"
    );
    expect(finalInspection.tables[1].rows[2].cells[0].text).toBe(
      "Atraso na migração de modelos legados"
    );
    expect(finalInspection.tables[1].rows[2].cells[1].text).toBe(
      "Uso do motor automatizado build_docx_template"
    );
  });

  test("deve evitar herança indevida de negrito e renderizar **negrito** seletivo e quebras \\n em múltiplos <w:p>", async () => {
    const mixedDocxPath = resolve(tempDir, "mixed_bold.docx");
    const mixedManifestPath = resolve(tempDir, "mixed_manifest.json");
    const mixedTplPath = resolve(tempDir, "mixed_tpl.docx");
    const mixedStatePath = resolve(tempDir, "mixed_state.json");
    const mixedOutPath = resolve(tempDir, "mixed_out.docx");

    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
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
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:tbl>
      <w:tr>
        <w:tc>
          <w:p>
            <w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:b/><w:bCs/></w:rPr><w:t>Levantamento de Mercado</w:t></w:r>
          </w:p>
          <w:p>
            <w:r><w:rPr><w:rFonts w:ascii="Arial"/></w:rPr><w:t>Texto normal do corpo da célula.</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    );
    writeFileSync(mixedDocxPath, await zip.generateAsync({ type: "nodebuffer" }));

    const manifest: SlotsManifest = {
      replace_table_cells: [
        {
          table_index: 0,
          row_index: 0,
          cell_index: 0,
          tag: "{{etp.justificativa}}",
        },
      ],
    };
    writeFileSync(mixedManifestPath, JSON.stringify(manifest, null, 2));

    await buildDocxTemplate(mixedDocxPath, mixedManifestPath, mixedTplPath);

    const tplZip = await JSZip.loadAsync(readFileSync(mixedTplPath));
    const tplXml = await tplZip.file("word/document.xml")!.async("string");
    expect(tplXml).not.toContain("<w:b/>");
    expect(tplXml).toContain("{{etp.justificativa}}");

    const state = {
      etp: {
        justificativa:
          "**Alternativa 1:** Solução em nuvem.\n**Alternativa 2:** Solução local.",
      },
    };
    writeFileSync(mixedStatePath, JSON.stringify(state, null, 2));

    await processDocument(mixedTplPath, mixedStatePath, mixedOutPath);

    const outInspect = await inspectDocx(mixedOutPath);
    expect(outInspect.tables[0].rows[0].cells[0].text).toBe(
      "Alternativa 1: Solução em nuvem.\nAlternativa 2: Solução local."
    );

    const outZip = await JSZip.loadAsync(readFileSync(mixedOutPath));
    const outXml = await outZip.file("word/document.xml")!.async("string");
    expect(outXml).not.toContain("**");
    expect(outXml).toContain("<w:b/>");
    expect(outXml).toContain("Alternativa 1:");
    expect(outXml).toContain(" Solução em nuvem.");
  });

  test("deve processar listas iterativas aninhadas multinível (1.1, 1.1.1, 1.1.1.1, 1.1.1.1.1) com recuo progressivo e achatamento de árvore JSON", async () => {
    expect(detectHierarchicalListItem("1.1 Item nível 1").level).toBe(1);
    expect(detectHierarchicalListItem("1.1.1 Item nível 2").level).toBe(2);
    expect(detectHierarchicalListItem("1.1.1.1 Item nível 3").level).toBe(3);
    expect(detectHierarchicalListItem("1.1.1.1.1 Item nível 4").level).toBe(4);

    const nestedRawPath = resolve(tempDir, "nested_raw.docx");
    const nestedManifestPath = resolve(tempDir, "nested_manifest.json");
    const nestedTplPath = resolve(tempDir, "nested_tpl.docx");
    const nestedStatePath = resolve(tempDir, "nested_state.json");
    const nestedOutPath = resolve(tempDir, "nested_out.docx");

    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
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
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="ListParagraph"/>
        <w:numPr><w:ilvl w:val="1"/><w:numId w:val="5"/></w:numPr>
      </w:pPr>
      <w:r><w:t>Item de lista original a ser substituído por árvore multinível</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`
    );
    writeFileSync(
      nestedRawPath,
      await zip.generateAsync({ type: "nodebuffer" })
    );

    const rawInspect = await inspectDocx(nestedRawPath);
    expect(rawInspect.paragraphs[0].numbering).toEqual({
      numId: "5",
      level: 1,
    });

    const manifest: SlotsManifest = {
      replace_paragraphs: [
        {
          start_p: 0,
          end_p: 0,
          tag: "{{tr.especificacoes_hierarquicas}}",
        },
      ],
    };
    writeFileSync(nestedManifestPath, JSON.stringify(manifest, null, 2));
    await buildDocxTemplate(nestedRawPath, nestedManifestPath, nestedTplPath);

    const nestedState = {
      tr: {
        especificacoes_hierarquicas: [
          {
            numero: "1.1",
            titulo: "Infraestrutura de Nuvem",
            texto: "Requisitos gerais do ambiente.",
            subitens: [
              {
                numero: "1.1.1",
                titulo: "Computação",
                texto: "Instâncias dedicadas.",
                subitens: [
                  {
                    numero: "1.1.1.1",
                    titulo: "Processamento",
                    texto: "Mínimo de 16 vCPUs.",
                    subitens: [
                      {
                        numero: "1.1.1.1.1",
                        titulo: "Arquitetura",
                        texto: "Compatível com x86_64 de última geração.",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    writeFileSync(nestedStatePath, JSON.stringify(nestedState, null, 2));

    await processDocument(nestedTplPath, nestedStatePath, nestedOutPath);

    const outInspect = await inspectDocx(nestedOutPath);
    expect(outInspect.paragraphs.length).toBe(4);
    expect(outInspect.paragraphs[0].text).toBe(
      "1.1 Infraestrutura de Nuvem: Requisitos gerais do ambiente."
    );
    expect(outInspect.paragraphs[1].text).toBe(
      "1.1.1 Computação: Instâncias dedicadas."
    );
    expect(outInspect.paragraphs[2].text).toBe(
      "1.1.1.1 Processamento: Mínimo de 16 vCPUs."
    );
    expect(outInspect.paragraphs[3].text).toBe(
      "1.1.1.1.1 Arquitetura: Compatível com x86_64 de última geração."
    );

    // Verifica que no <w:body> (v0.7.0) <w:numPr> nativo foi aplicado em document.xml e os recuos progressivos estão em word/numbering.xml
    const outZip = await JSZip.loadAsync(readFileSync(nestedOutPath));
    const outXml = await outZip.file("word/document.xml")!.async("string");
    const numXml = await outZip.file("word/numbering.xml")!.async("string");
    expect(outXml).toContain("<w:numPr>");
    expect(outXml).not.toContain('w:val="5"');
    expect(numXml).toContain('w:left="360"');
    expect(numXml).toContain('w:left="720"');
    expect(numXml).toContain('w:left="1080"');
    expect(numXml).toContain('w:left="1440"');
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
    expect(result.next_step_hint).toContain("Próximo: acione o Auditor Externo lendo diretamente a visão linear (dispensado rodar inspect_docx novamente).");

    const synthetic = formatFillDocxTemplateSyntheticResult(result);
    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("0.9.6");
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
    expect(resultNoInspect.next_step_hint).toContain("inspect_docx");

    const syntheticNoInspect = formatFillDocxTemplateSyntheticResult(resultNoInspect);
    expect(syntheticNoInspect.status).toBe("success");
    expect(syntheticNoInspect.engine_version).toBe(VERSION);
    expect(syntheticNoInspect.engine_version).toBe("0.9.6");
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

    expect(numXml).toContain('w:lvlText w:val="%1."');
    expect(numXml).toContain('w:lvlText w:val="%1.%2."');
    expect(numXml).toContain('w:lvlText w:val="%1.%2.%3."');
    expect(numXml).toContain('w:lvlText w:val="%1.%2.%3.%4.%5.%6.%7.%8.%9."');
    expect(numXml).toContain('<w:suff w:val="tab"/>');
    expect(numXml).toContain('<w:startOverride w:val="4"/>');

    expect(docXml).not.toContain("4.1.1.");
    expect(docXml).not.toContain("4.1.2.");
    expect(docXml).toContain("Sustentabilidade Ambiental:");
    expect(docXml).toContain("Logística Reversa:");
    expect(docXml).toContain('<w:ilvl w:val="1"/>');
    expect(docXml).toContain('<w:ilvl w:val="2"/>');

    expect(docXml).toContain("1.1.1.");
    expect(docXml).toContain("<w:tab/>");
    expect(docXml).toContain('<w:tab w:val="left" w:pos="720"/>');
    expect(docXml).toContain('w:hanging="480"');

    const finalInsp = await inspectDocx(finalDocx);
    expect(finalInsp.paragraphs[0].text).toBe(
      "4. REQUISITOS DA CONTRATAÇÃO (ORGAO_CONTRATANTE)"
    );
    expect(finalInsp.paragraphs[1].text).toBe(
      "4.1 Sustentabilidade Ambiental: A contratada deverá observar diretrizes federais."
    );
    expect(finalInsp.paragraphs[2].text).toBe(
      "4.1.1 Logística Reversa: Descarte ambientalmente adequado de insumos."
    );
    expect(finalInsp.paragraphs[3].text).toBe(
      "4.1.2 Eficiência Energética: Equipamentos com selo de baixo consumo."
    );
    expect(finalInsp.paragraphs[4].text).toBe(
      "4.2 Subcontratação: Não será admitida a subcontratação do objeto principal."
    );

    const tableCellText = finalInsp.tables[0].rows[0].cells[1].text;
    expect(tableCellText).toContain(
      "1.1. Prazo de Entrega: Até 15 dias úteis na sede do ORGAO_A."
    );
    expect(tableCellText).toContain(
      "1.1.1. Local de Recebimento: Almoxarifado Central do ORGAO_B."
    );
    expect(tableCellText).toContain(
      "a) Conferência provisória no ato da entrega;"
    );
    expect(tableCellText).toContain(
      "- Termo de recebimento definitivo em 5 dias."
    );

    const auditMd = readFileSync(fillRes.visao_auditoria_path!, "utf-8");
    expect(auditMd).toContain(
      "4.1 Sustentabilidade Ambiental: A contratada deverá observar diretrizes federais."
    );
    expect(auditMd).toContain(
      "4.1.1 Logística Reversa: Descarte ambientalmente adequado de insumos."
    );
    expect(auditMd).toContain(
      "4.1.2 Eficiência Energética: Equipamentos com selo de baixo consumo."
    );
    expect(auditMd).toContain(
      "4.2 Subcontratação: Não será admitida a subcontratação do objeto principal."
    );
    expect(auditMd).toContain(
      "1.1. Prazo de Entrega: Até 15 dias úteis na sede do ORGAO_A."
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
});
