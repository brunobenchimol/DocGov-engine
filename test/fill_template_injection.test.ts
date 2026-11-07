import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import {
  processDocument,
  inspectDocx,
  buildDocxTemplate,
  detectHierarchicalListItem,
  type SlotsManifest,
} from "../src/index.ts";
import {
  MINIMAL_DOCX_BASE64,
  createSampleRawDocx,
  createSuiteTempDir,
} from "./helpers/fixtures.ts";

describe("Testes Unitários: fill_docx_template (Injeção de Slots, Loops e E2E)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("fill_template_injection");
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
    expect(tplInspection.tables[1].rows.length).toBe(4);

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

    const outZip = await JSZip.loadAsync(readFileSync(nestedOutPath));
    const outXml = await outZip.file("word/document.xml")!.async("string");
    expect(outXml).not.toContain("<w:numPr>");
    expect(outXml).not.toContain('w:val="5"');
    expect(outXml).toContain("1.1");
    expect(outXml).toContain("1.1.1");
    expect(outXml).toContain("<w:tab/>");
    expect(outXml).toContain('w:left="360"');
    expect(outXml).toContain('w:left="720"');
    expect(outXml).toContain('w:left="1080"');
    expect(outXml).toContain('w:left="1440"');
  });
});
