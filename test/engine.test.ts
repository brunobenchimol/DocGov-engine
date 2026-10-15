import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import {
  processDocument,
  inspectDocx,
  compactInspectionResult,
  bootstrapCase,
  formatBootstrapCaseSyntheticResult,
  formatInspectDocxSyntheticResult,
  waitForBackgroundCopy,
  generateAuditDocx,
  cleanHumanText,
  buildDocxTemplate,
  compareSemver,
  replaceBinaryOnDisk,
  detectHierarchicalListItem,
  DOCX_ENGINE_INSTRUCTIONS,
  DOCX_WORKFLOW_GUIDE_TEXT,
  getMcpPromptsDefinition,
  getMcpToolsDefinition,
  sanitizeJsonString,
  formatJsonErrorWithSnippet,
  safeReadJsonFile,
  unflattenDotKeys,
  buildTocMap,
  type SlotsManifest,
} from "../src/index.ts";

// Base64 de um .docx OpenXML válido contendo as tags {{processo_id}} e {{objeto.descricao}}
const MINIMAL_DOCX_BASE64 =
  "UEsDBBQAAAAIADGvSl15bjPX6AAAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH1QyU7DMBD9" +
  "FWuuKHHggBCK0wPLETiUDxjZk8SqN3nc0v49Tlt6QIXjzFv1+tXeO7GjzDYGBbdtB4KCjsaGScHn" +
  "+rV5AMEFg0EXAyk4EMNq6NeHRCyqNrCCuZT0KCXrmTxyGxOFiowxeyz1zJNMqDc4kbzrunupYygU" +
  "SlMWDxj6Zxpx64p42df3qUcmxyCeTsQlSwGm5KzGUnG5C+ZXSnNOaKvyyOHZJr6pBJBXExbk74Cz" +
  "7r0Ok60h8YG5vKGvLPkVs5Em6q2vyvZ/mys94zhaTRf94pZy1MRcF/euvSAebfjpL49zD99QSwME" +
  "FAAAAAgAMa9KXZv9N+qtAAAAKQEAAAsAAABfcmVscy8ucmVsc43POw7CMAwG4KtE3mlaBoRQ0y4I" +
  "qSsqB7ASN61oHkrCo7cnAwNFDIy2f3+W6/ZpZnanECdnBVRFCYysdGqyWsClP232wGJCq3B2lgQs" +
  "FKFt6jPNmPJKHCcfWTZsFDCm5A+cRzmSwVg4TzZPBhcMplwGzT3KK2ri27Lc8fBpwNpknRIQOlUB" +
  "6xdP/9huGCZJRydvhmz6ceIrkWUMmpKAhwuKq3e7yCzwpuarF5sXUEsDBBQAAAAIADGvSl3nkdAq" +
  "rwAAAO8AAAARAAAAd29yZC9kb2N1bWVudC54bWxFjsEKwjAMhl+l9O46PYiMbd58Aj1LbeOsrElp" +
  "qlPG3t11Cl6+n5D8H6n3L9+LJ0R2hI1cF6UUgIasw66Rp+NhtZOCk0are0Jo5BtY7tt6qCyZhwdM" +
  "YhYgV0MjbymFSik2N/CaCwqA8+5K0es0j7FTA0UbIhlgnv2+V5uy3CqvHcqsvJB95wwZMSO14/gr" +
  "0NnZaRIrMY50uUOiwgKb6IymaapVvs2MC8PCr0/9f20/UEsBAhQAFAAAAAgAMa9KXXluM9foAAAA" +
  "rQEAABMAAAAAAAAAAAAAAAAAAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAAUAAAACAAxr0pd" +
  "m/036q0AAAApAQAACwAAAAAAAAAAAAAAAAAZAQAAX3JlbHMvLnJlbHNQSwECFAAUAAAACAAxr0pd" +
  "55HQKq8AAADvAAAAEQAAAAAAAAAAAAAAAADvAQAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAMA" +
  "AwC5AAAAzQIAAAAA";

async function createSampleRawDocx(targetPath: string): Promise<void> {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
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
  <Relationship Id="rIdHeader1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`
  );

  zip.file(
    "word/header1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:pStyle w:val="Header"/></w:pPr>
    <w:r><w:t>Órgão Público </w:t></w:r>
    <w:r><w:t>Contratante (ORGAO_A)</w:t></w:r>
  </w:p>
</w:hdr>`
  );

  zip.file(
    "word/footer1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:pStyle w:val="Footer"/></w:pPr>
    <w:r><w:t>Processo Administrativo nº 000/2026</w:t></w:r>
  </w:p>
</w:ftr>`
  );

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>ESTUDO TÉCNICO PRELIMINAR</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Normal"/></w:pPr>
      <w:r><w:t>Órgão: Órgão Público </w:t></w:r>
      <w:r><w:t>Contratante (ORGAO_A)</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>1. DESCRIÇÃO DA NECESSIDADE</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="BodyText"/></w:pPr>
      <w:r><w:rPr><w:i/></w:rPr><w:t>Texto original parágrafo 1 a substituir.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="BodyText"/></w:pPr>
      <w:r><w:t>Texto original parágrafo 2 a remover.</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Unidade Requisitante</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Diretoria Antiga</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Responsável</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Servidor Antigo</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:b/><w:t>Risco</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:b/><w:t>Mitigação</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Risco antigo 1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Mitigação antiga 1</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Risco antigo 2</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Mitigação antiga 2</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Risco antigo 3</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Mitigação antiga 3</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rIdHeader1"/>
      <w:footerReference w:type="default" r:id="rIdFooter1"/>
    </w:sectPr>
  </w:body>
</w:document>`
  );

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(targetPath, buf);
}

describe("DocGov Docx Engine v0.1.0", () => {
  const tempDir = resolve("./temp_test_run");
  const templatePath = resolve(tempDir, "template_input.docx");
  const statePath = resolve(tempDir, "state_input.json");
  const outputPath = resolve(tempDir, "resultado_final.docx");

  // Arquivos do teste E2E (inspect -> build-template -> fill)
  const rawDocxPath = resolve(tempDir, "bruto_sem_tags.docx");
  const inspectJsonPath = resolve(tempDir, "inspecao.json");
  const manifestPath = resolve(tempDir, "slots_manifest.json");
  const builtTemplatePath = resolve(tempDir, "template_parametrizado.docx");
  const e2eStatePath = resolve(tempDir, "e2e_state.json");
  const e2eFinalDocxPath = resolve(tempDir, "e2e_final.docx");

  beforeAll(async () => {
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
    writeFileSync(templatePath, Buffer.from(MINIMAL_DOCX_BASE64, "base64"));

    const mockState = {
      processo_id: "POC-2026-PA-001",
      objeto: {
        descricao: "Contratação de plataforma em nuvem para o Órgão Y",
      },
    };
    writeFileSync(statePath, JSON.stringify(mockState, null, 2), "utf-8");

    await createSampleRawDocx(rawDocxPath);
  });

  afterAll(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
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
    expect(tplInspection.paragraphs.length).toBe(4); // Parágrafo 4 foi consolidado no 3
    expect(tplInspection.paragraphs[3].style).toBe("BodyText");
    expect(tplInspection.paragraphs[3].text).toBe(
      "{{estudo.descricao_necessidade}}"
    );
    expect(tplInspection.headers[0].text).toBe("{{metadados.orgao_entidade}}");
    expect(tplInspection.footers[0].text).toBe(
      "Processo Administrativo nº {{metadados.numero_processo}}"
    );
    expect(tplInspection.tables[1].rows.length).toBe(2); // Linhas 2 e 3 removidas

    // 3. Preencher o template construído com dados reais (fill_docx_template)
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

    // 4. Inspecionar documento final gerado para comprovar substituição completa
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

    // Tabela 1 deve ter 1 linha de cabeçalho + 2 linhas geradas pelo loop FOR
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

  test("deve comparar versões SemVer corretamente (compareSemver)", () => {
    expect(compareSemver("0.1.0", "0.2.0")).toBe(-1);
    expect(compareSemver("v0.2.0", "0.2.0")).toBe(0);
    expect(compareSemver("0.10.0", "0.2.0")).toBe(1);
    expect(compareSemver("1.0.0", "0.9.9")).toBe(1);
  });

  test("deve substituir binário em disco com segurança (replaceBinaryOnDisk)", () => {
    const fakeBinPath = resolve(tempDir, "fake-docgov-docx.exe");
    writeFileSync(fakeBinPath, "VERSAO_ANTIGA_CONTEUDO_INICIAL");

    const newPayload = new Uint8Array(2048).fill(65); // 2048 bytes de 'A'
    replaceBinaryOnDisk(fakeBinPath, newPayload, 1024);

    expect(existsSync(fakeBinPath)).toBe(true);
    expect(existsSync(`${fakeBinPath}.new`)).toBe(false);
    expect(readFileSync(fakeBinPath).byteLength).toBe(2048);

    // Deve rejeitar payload menor que o mínimo exigido
    expect(() =>
      replaceBinaryOnDisk(fakeBinPath, new Uint8Array(10), 1024)
    ).toThrow("Binário baixado inválido ou corrompido");
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
    // Célula onde o 1º parágrafo é um subtítulo em negrito (<w:b/>) e o 2º é corpo normal (sem <w:b/>)
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

    // Verifica que o template parametrizado NÃO herdou <w:b/> na tag {{etp.justificativa}}
    const tplZip = await JSZip.loadAsync(readFileSync(mixedTplPath));
    const tplXml = await tplZip.file("word/document.xml")!.async("string");
    expect(tplXml).not.toContain("<w:b/>");
    expect(tplXml).toContain("{{etp.justificativa}}");

    // Injeta texto com múltiplos parágrafos (\n) e negrito seletivo (**...**)
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

    // Verifica no XML final que foram criados 2 <w:p> e que o <w:b/> está apenas nos rótulos
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
    // Parágrafo com <w:numPr> nativo do Word para validar detecção no inspect_docx e limpeza de conflito
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

    // Estado contendo árvore recursiva aninhada até o nível 1.1.1.1.1
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

    // Verifica no XML que <w:numPr> conflitante foi removido e que os recuos <w:ind> são progressivos (360, 720, 1080, 1440)
    const outZip = await JSZip.loadAsync(readFileSync(nestedOutPath));
    const outXml = await outZip.file("word/document.xml")!.async("string");
    expect(outXml).not.toContain("<w:numPr>");
    expect(outXml).toContain('w:left="360"');
    expect(outXml).toContain('w:left="720"');
    expect(outXml).toContain('w:left="1080"');
    expect(outXml).toContain('w:left="1440"');
  });

  test("deve filtrar parágrafos e células vazias no modo compacto preservando os índices originais (compactInspectionResult)", () => {
    const fullMock = {
      headers: [
        { part: "word/header1.xml", index: 0, paragraphIndex: 0, style: null, text: "   " },
        { part: "word/header1.xml", index: 1, paragraphIndex: 1, style: "Header", text: "Cabeçalho Oficial" },
      ],
      footers: [
        { part: "word/footer1.xml", index: 0, paragraphIndex: 0, style: null, text: "" },
      ],
      paragraphs: [
        { index: 0, style: null, text: "" },
        { index: 1, style: "Heading1", text: "1. OBJETO" },
        { index: 2, style: null, text: "   \n  " },
        { index: 3, style: "BodyText", text: "Texto do parágrafo 3." },
      ],
      tables: [
        {
          index: 0,
          rows: [
            {
              rowIndex: 0,
              cells: [
                { cellIndex: 0, text: "" },
                { cellIndex: 1, text: "   " },
              ],
            },
            {
              rowIndex: 1,
              cells: [
                { cellIndex: 0, text: "Unidade Requisitante" },
                { cellIndex: 1, text: "" },
                { cellIndex: 2, text: "Diretoria de TI" },
              ],
            },
          ],
        },
      ],
    };

    const compacted = compactInspectionResult(fullMock);

    expect(compacted.headers.length).toBe(1);
    expect(compacted.headers[0].index).toBe(1);
    expect(compacted.footers.length).toBe(0);

    // Deve manter apenas os parágrafos 1 e 3 com seus índices originais intactos
    expect(compacted.paragraphs.length).toBe(2);
    expect(compacted.paragraphs[0].index).toBe(1);
    expect(compacted.paragraphs[1].index).toBe(3);

    // Deve omitir a rowIndex 0 (toda vazia) e manter a rowIndex 1 apenas com cellIndex 0 e 2
    expect(compacted.tables[0].rows.length).toBe(1);
    expect(compacted.tables[0].rows[0].rowIndex).toBe(1);
    expect(compacted.tables[0].rows[0].cells).toEqual([
      { cellIndex: 0, text: "Unidade Requisitante" },
      { cellIndex: 2, text: "Diretoria de TI" },
    ]);
  });

  test("deve inicializar diretório do caso com inspeção síncrona imediata de .docx e salvaguarda assíncrona de PDFs (bootstrapCase v0.3.2)", async () => {
    const mockUploadsDir = resolve(tempDir, "mock_uploads");
    const mockCaseDir = resolve(tempDir, "mock_case_01");
    mkdirSync(mockUploadsDir, { recursive: true });

    // Cria um .docx e um .pdf simulado na pasta de uploads
    const uploadedDocx = resolve(mockUploadsDir, "modelo_etp_base.docx");
    await createSampleRawDocx(uploadedDocx);
    writeFileSync(resolve(mockUploadsDir, "dfd_assinado.pdf"), "PDF_CONTENT");

    const res = await bootstrapCase(mockCaseDir, mockUploadsDir);

    expect(existsSync(resolve(mockCaseDir, "inputs"))).toBe(true);
    expect(existsSync(resolve(mockCaseDir, "state"))).toBe(true);
    expect(existsSync(resolve(mockCaseDir, "output"))).toBe(true);

    // .docx foi copiado imediatamente e inspecionado
    expect(res.status).toBe("success");
    expect(res.copiedFiles).toEqual(["modelo_etp_base.docx"]);
    expect(res.backgroundFiles).toEqual(["dfd_assinado.pdf"]);
    expect(res.backgroundCopy.status).toBe("started");
    expect(res.inspectedDocx.length).toBe(1);
    expect(res.inspectedDocx[0].fileName).toBe("modelo_etp_base.docx");
    expect(res.inspectedDocx[0].tablesCount).toBe(2);
    expect(res.inspectedDocx[0].paragraphsCount).toBe(5);
    expect(existsSync(res.inspectedDocx[0].structurePath)).toBe(true);
    expect(res.inspectedDocx[0].compactStructure.paragraphs.length).toBe(5);

    // Valida que o formato sintético gerado para a resposta MCP é conciso (< 1 KB)
    const syntheticMcp = formatBootstrapCaseSyntheticResult(res, "cases/caso_01");
    const syntheticJson = JSON.stringify(syntheticMcp, null, 2);
    expect(Buffer.byteLength(syntheticJson, "utf-8")).toBeLessThan(1024);
    expect(syntheticMcp.status).toBe("success");
    expect(syntheticMcp.caseDir).toBe("cases/caso_01");
    expect(syntheticMcp.docx_inspected[0]).toEqual({
      filename: "modelo_etp_base.docx",
      structure_json: "state/estrutura_modelo_etp_base.json",
      tables_count: 2,
      paragraphs_count: 5,
    });
    expect(syntheticMcp.background_copy.status).toBe("active");
    expect(syntheticMcp.next_step_hint).toContain("build_docx_template");

    // O status inicial de salvaguarda foi gravado em state/salvaguarda_status.json
    const statusPath = resolve(mockCaseDir, "state", "salvaguarda_status.json");
    expect(existsSync(statusPath)).toBe(true);

    // Aguarda a conclusão da cópia em segundo plano
    await waitForBackgroundCopy(mockCaseDir);

    // Agora o PDF também existe em inputs/ e o status está completed
    expect(existsSync(resolve(mockCaseDir, "inputs", "dfd_assinado.pdf"))).toBe(true);
    const finalStatus = JSON.parse(readFileSync(statusPath, "utf-8"));
    expect(finalStatus.status).toBe("completed");
    expect(finalStatus.completedFiles).toContain("dfd_assinado.pdf");
  });

  test("deve gerar sumário sintético executivo (< 1 KB) para inspect_docx persistindo o JSON detalhado no disco (v0.3.3)", async () => {
    const rawDocxPath = resolve(tempDir, "sample_raw_for_inspect.docx");
    const outJsonPath = resolve(tempDir, "state", "estrutura_inspect.json");
    await createSampleRawDocx(rawDocxPath);

    const fullInspection = await inspectDocx(rawDocxPath, outJsonPath, true);
    expect(existsSync(outJsonPath)).toBe(true);

    const syntheticInspect = formatInspectDocxSyntheticResult(
      rawDocxPath,
      outJsonPath,
      fullInspection
    );
    const jsonStr = JSON.stringify(syntheticInspect, null, 2);

    expect(Buffer.byteLength(jsonStr, "utf-8")).toBeLessThan(1024);
    expect(syntheticInspect.status).toBe("success");
    expect(syntheticInspect.docxPath).toBe(rawDocxPath);
    expect(syntheticInspect.outputPath).toBe(outJsonPath);
    expect(syntheticInspect.tables).toBe(2);
    expect(syntheticInspect.rows).toBe(6); // Tabela 1: 2 linhas, Tabela 2: 4 linhas
    expect(syntheticInspect.paragraphs).toBe(5);
    expect(syntheticInspect.next_step_hint).toContain("build_docx_template");
  });

  test("deve gerar relatório de auditoria em layout vertical corrido A4 (ZERO tabelas), múltiplos trechos por ID e sanitização de texto (generateAuditDocx v0.3.1)", async () => {
    const auditJsonPath = resolve(tempDir, "relatorio_auditoria_etp.json");
    const auditDocxPath = resolve(tempDir, "Relatorio_Auditoria_ETP.docx");

    // Testa diretamente a sanitização de crases, coordenadas, caminhos e enums
    expect(
      cleanHumanText(
        "No arquivo `cases/caso_exemplo/output/ETP_Exemplo.docx` [T0:R30:C1] [P034] ocorreu `V5_FALSA_PLURALIDADE`"
      )
    ).toBe(
      "No arquivo ETP_Exemplo.docx ocorreu Levantamento de Mercado e Parcelamento do Objeto"
    );

    const mockAuditData = {
      processo_id: "`PROC-2026/12345`",
      orgao_entidade: "Secretaria Executiva Demandante (ORGAO_DEMANDANTE)",
      artefato_auditado: "cases/caso_exemplo/output/ETP_Exemplo.docx",
      regime_juridico: "Lei Federal nº 14.133/2021 e Regulamento Local",
      iteracao_auditoria: 1,
      status_global: "APTO COM ALERTAS",
      contagem: {
        bloqueantes: 0,
        alertas: 2,
        conformes: 12,
      },
      resumo_executivo:
        "**Parecer Preliminar:** O documento `cases/caso_exemplo/output/ETP_Exemplo.docx` apresenta aderência geral.\nContudo, exige saneamento preventivo nos trechos destacados.",
      apontamentos: [
        {
          id: "AUD-01",
          severidade: "ALERTA",
          vulnerabilidade: "V5_FALSA_PLURALIDADE",
          base_legal: "Lei nº 14.133/2021, art. 18, § 1º, IV e VI; Súmula de Jurisprudência nº 247",
          trechos_documento: [
            {
              secao_legivel: "[T0:R30:C1] Seção 4 — Levantamento de Mercado",
              texto_transcrito:
                "Foram identificadas `apenas duas soluções` proprietárias que atendem integralmente ao lote único.",
            },
            {
              secao_legivel: "[P034] Seção 8 — Justificativa para o Não Parcelamento",
              texto_transcrito:
                "O agrupamento em lote único mostra-se mais conveniente para a gestão contratual.",
            },
          ],
          risco_controle_externo:
            "Risco elevado de questionamento pelo Órgão de Controle em razão da combinação entre levantamento restrito (`[T0:R30:C1]`) e ausência de demonstração técnica de inviabilidade de parcelamento (`[P034]`).",
          redacao_saneadora_sugerida:
            "**Reestruturar a justificativa** demonstrando, com dados objetivos de mercado, a inviabilidade técnica ou perda de economia de escala na divisão em itens.",
        },
        {
          id: "AUD-02",
          severidade: "BLOQUEANTE",
          titulo_apontamento: "Exigência de Marca ou Especificação Restritiva",
          base_legal: "Lei nº 14.133/2021, art. 41, I",
          localizacao: "[T0:R12:C1] Seção 3 — Requisitos da Contratação",
          trecho_impugnado:
            "Processador exclusivo da linha ` Modelo X-Pro 9900 ` sem menção a equivalência.",
          analise_risco:
            "Configura direcionamento vedado pelo art. 41 da Lei nº 14.133/2021.",
          redacao_saneadora:
            "Inserir a expressão **«ou equivalente, ou similar, ou de melhor qualidade»** acompanhada de parâmetros objetivos de desempenho.",
        },
      ],
      metadados_agente: {
        coordenada_interna: "[T0:R30:C1]",
        token_debug: "SEGREDO_DE_MAQUINA_NAO_IMPRIMIR",
      },
    };
    writeFileSync(auditJsonPath, JSON.stringify(mockAuditData, null, 2), "utf-8");

    const res = await generateAuditDocx(auditJsonPath, auditDocxPath);
    expect(res.success).toBe(true);
    expect(existsSync(auditDocxPath)).toBe(true);

    // 1. Verifica no XML bruto que NÃO há <w:tbl>, NÃO há crases (`), NÃO há coordenadas [T0:...] e NÃO há metadados_agente
    const auditZip = await JSZip.loadAsync(readFileSync(auditDocxPath));
    const auditXml = await auditZip.file("word/document.xml")!.async("string");
    expect(auditXml).not.toContain("<w:tbl");
    expect(auditXml).not.toContain("`");
    expect(auditXml).not.toContain("[T0:");
    expect(auditXml).not.toContain("[P034]");
    expect(auditXml).not.toContain("V5_FALSA_PLURALIDADE");
    expect(auditXml).not.toContain("SEGREDO_DE_MAQUINA_NAO_IMPRIMIR");
    expect(auditXml).not.toContain("cases/caso_exemplo/output/");

    // 2. Inspeciona a estrutura gerada via inspectDocx
    const auditInspection = await inspectDocx(auditDocxPath);
    expect(auditInspection.tables.length).toBe(0);

    const allParagraphTexts = auditInspection.paragraphs.map((p) => p.text);

    // Cabeçalho Institucional
    expect(allParagraphTexts[0]).toBe(
      "PARECER DE AUDITORIA TÉCNICO-JURÍDICA E CONTROLE DE DIRECIONAMENTO"
    );
    expect(allParagraphTexts[1]).toBe(
      "Auditoria Cega de Conformidade Legal e Competitividade (Controle Externo)"
    );

    // Seção 1: Identificação e Escopo
    expect(allParagraphTexts).toContain("1. IDENTIFICAÇÃO E ESCOPO DA AUDITORIA");
    expect(allParagraphTexts).toContain("Processo: PROC-2026/12345");
    expect(allParagraphTexts).toContain("Documento Auditado: ETP_Exemplo.docx");
    expect(allParagraphTexts).toContain(
      "Diagnóstico Global: APTO COM ALERTAS PREVENTIVOS (0 Bloqueantes | 2 Alertas | 12 Conformes)"
    );

    // Seção 2: Parecer Executivo
    expect(allParagraphTexts).toContain("2. PARECER EXECUTIVO DE CONTROLE EXTERNO");
    expect(allParagraphTexts).toContain(
      "Parecer Preliminar: O documento ETP_Exemplo.docx apresenta aderência geral."
    );

    // Seção 3: Fichas Verticais Individualizadas com múltiplos trechos transcritos
    expect(allParagraphTexts).toContain(
      "3. DETALHAMENTO INDIVIDUALIZADO DOS APONTAMENTOS (ID POR ID)"
    );
    expect(allParagraphTexts).toContain(
      "[AUD-01] ALERTA PREVENTIVO — Levantamento de Mercado e Parcelamento do Objeto"
    );
    expect(allParagraphTexts).toContain(
      "• Trecho 1 — Localização no documento: Seção 4 — Levantamento de Mercado"
    );
    expect(allParagraphTexts).toContain(
      '"«Foram identificadas apenas duas soluções proprietárias que atendem integralmente ao lote único.»"'
    );
    expect(allParagraphTexts).toContain(
      "• Trecho 2 — Localização no documento: Seção 8 — Justificativa para o Não Parcelamento"
    );
    expect(allParagraphTexts).toContain(
      '"«O agrupamento em lote único mostra-se mais conveniente para a gestão contratual.»"'
    );
    expect(allParagraphTexts).toContain(
      "[AUD-02] BLOQUEANTE — Exigência de Marca ou Especificação Restritiva"
    );
  });

  test("deve implementar as 4 camadas nativas de Autodescoberta (Self-Discovery) no servidor MCP (v0.4.0)", () => {
    // 1. Camada 1: instructions contendo pipeline canônico e sintaxe
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("1. **bootstrap_case**");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("2. **inspect_docx**");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("3. **build_docx_template**");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("4. **fill_docx_template**");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("5. **generate_audit_docx**");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("{{FOR item IN lista}}");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("1.1, 1.1.1");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("inspecao_output.json");

    // 2. Camada 2: ListTools enriquecido com pré/pós-condições, descriptions em todas as propriedades e annotations
    const tools = getMcpToolsDefinition();
    expect(tools.length).toBe(5);
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toEqual([
      "bootstrap_case",
      "inspect_docx",
      "build_docx_template",
      "fill_docx_template",
      "generate_audit_docx",
    ]);

    for (const tool of tools) {
      // Descrição rica com pré-condição e pós-condição
      expect(tool.description).toBeDefined();
      expect(tool.description!.length).toBeGreaterThan(50);
      expect(tool.description).toContain("Quando usar");
      expect(tool.description).toContain("Próximo Passo");

      // Todas as propriedades do inputSchema devem conter descrição semântica
      expect(tool.inputSchema.properties).toBeDefined();
      for (const [, propDef] of Object.entries(
        tool.inputSchema.properties as Record<string, { description?: string }>
      )) {
        expect(propDef.description).toBeDefined();
        expect(propDef.description!.length).toBeGreaterThan(10);
      }

      // Anotações nativas do protocolo MCP
      expect(tool.annotations).toBeDefined();
      expect(typeof tool.annotations!.readOnlyHint).toBe("boolean");
      expect(typeof tool.annotations!.destructiveHint).toBe("boolean");
      expect(typeof tool.annotations!.idempotentHint).toBe("boolean");
    }

    // Validação específica da recomendação de transição no fill_docx_template
    const fillTool = tools.find((t) => t.name === "fill_docx_template")!;
    expect(fillTool.description).toContain("inspecao_output.json");

    // 3. Camada 3: Capacitador prompts nativo (ListPrompts e GetPrompt)
    const prompts = getMcpPromptsDefinition();
    expect(prompts.length).toBe(1);
    expect(prompts[0].name).toBe("docx_workflow_guide");
    expect(prompts[0].description).toBeDefined();
    expect(DOCX_WORKFLOW_GUIDE_TEXT).toContain("Guia de Arquitetura");
    expect(DOCX_WORKFLOW_GUIDE_TEXT).toContain("slots_manifest.json");
    expect(DOCX_WORKFLOW_GUIDE_TEXT).toContain("inspecao_output.json");

    // 4. Camada 4: Next Step Hints nas ferramentas
    const bootstrapSynthetic = formatBootstrapCaseSyntheticResult({
      status: "success",
      caseDir: "cases/test",
      copiedFiles: [],
      backgroundFiles: [],
      backgroundCopy: { status: "idle", totalFiles: 0, files: [], message: "" },
      inspectedDocx: [],
    });
    expect(bootstrapSynthetic.next_step_hint).toContain("build_docx_template");

    const inspectSynthetic = formatInspectDocxSyntheticResult(
      "test.docx",
      "test_estrutura.json",
      { headers: [], footers: [], paragraphs: [], tables: [] }
    );
    expect(inspectSynthetic.next_step_hint).toContain("build_docx_template");
  });

  test("deve construir o índice estrutural rápido (toc_map) no topo da inspeção e expor toc_summary compacto (< 1 KB) no MCP (v0.5.0)", async () => {
    const rawDocxPath = resolve(tempDir, "sample_raw_for_toc.docx");
    const outJsonPath = resolve(tempDir, "state", "estrutura_com_toc.json");
    await createSampleRawDocx(rawDocxPath);

    const inspection = await inspectDocx(rawDocxPath, outJsonPath, true);
    expect(existsSync(outJsonPath)).toBe(true);

    // 1. Verifica se toc_map está presente e estruturado
    expect(inspection.toc_map).toBeDefined();
    const toc = inspection.toc_map!;

    // 2. Seções identificadas
    expect(toc.sections.length).toBeGreaterThanOrEqual(2);
    const titulos = toc.sections.map((s) => s.title);
    expect(titulos).toContain("ESTUDO TÉCNICO PRELIMINAR");
    expect(titulos).toContain("1. DESCRIÇÃO DA NECESSIDADE");
    const secObj = toc.sections.find((s) => s.title === "1. DESCRIÇÃO DA NECESSIDADE");
    expect(secObj?.coord).toBe("P2");
    expect(secObj?.suggested_target_slot).toBe("P3");

    // 3. Campos de formulário em tabelas
    expect(toc.form_fields.length).toBeGreaterThanOrEqual(2);
    const ffLabels = toc.form_fields.map((f) => f.title);
    expect(ffLabels).toContain("Unidade Requisitante");
    expect(ffLabels).toContain("Responsável");
    const reqField = toc.form_fields.find((f) => f.title === "Unidade Requisitante");
    expect(reqField?.coord).toBe("T0.R0.C0");
    expect(reqField?.suggested_target_slot).toBe("T0.R0.C1");

    // 4. Resumo das tabelas
    expect(toc.tables.length).toBe(2);
    expect(toc.tables[1].table_index).toBe(1);
    expect(toc.tables[1].headers).toEqual(["Risco", "Mitigação"]);
    expect(toc.tables[1].sample_row_coord).toBe("T1.R1");

    // 5. Verifica se no arquivo gerado no disco o toc_map está gravado no topo
    const fileContent = readFileSync(outJsonPath, "utf-8");
    const tocMapPos = fileContent.indexOf('"toc_map"');
    const paragraphsPos = fileContent.indexOf('"paragraphs"');
    expect(tocMapPos).toBeGreaterThan(-1);
    expect(paragraphsPos).toBeGreaterThan(-1);
    expect(tocMapPos).toBeLessThan(paragraphsPos);

    // 6. Verifica o retorno sintético com toc_summary e teto estrito (< 1024 bytes)
    const synthetic = formatInspectDocxSyntheticResult(
      rawDocxPath,
      outJsonPath,
      inspection
    );
    expect(synthetic.toc_summary).toBeDefined();
    expect(synthetic.toc_summary!.length).toBeGreaterThan(0);
    const jsonStr = JSON.stringify(synthetic, null, 2);
    expect(Buffer.byteLength(jsonStr, "utf-8")).toBeLessThan(1024);
  });

  test("deve auto-sanear arquivos JSON (BOM, trailing commas, quebras de linha literais em strings) regravando em disco sem interromper a execução (safeReadJsonFile v0.5.0)", () => {
    // 1. Arquivo com BOM UTF-8
    const bomFilePath = resolve(tempDir, "teste_bom.json");
    writeFileSync(bomFilePath, "\uFEFF{\n  \"parametro\": \"valor_com_bom\"\n}", "utf-8");
    const resBom = safeReadJsonFile<{ parametro: string }>(bomFilePath);
    expect(resBom.parametro).toBe("valor_com_bom");

    // 2. Arquivo com trailing commas (em objeto e array)
    const trailingCommaPath = resolve(tempDir, "teste_trailing_comma.json");
    const rawTrailing = `{\n  "objeto": {\n    "descricao": "Item Com Trailing Comma",\n  },\n  "itens": [\n    1,\n    2,\n  ],\n}`;
    writeFileSync(trailingCommaPath, rawTrailing, "utf-8");
    const resTrailing = safeReadJsonFile<{ objeto: { descricao: string }; itens: number[] }>(trailingCommaPath);
    expect(resTrailing.objeto.descricao).toBe("Item Com Trailing Comma");
    expect(resTrailing.itens).toEqual([1, 2]);

    // O arquivo em disco deve ter sido regravado limpo (sem a vírgula antes de })
    const diskContent = readFileSync(trailingCommaPath, "utf-8");
    expect(diskContent).not.toMatch(/,\s*}/);
    expect(diskContent).not.toMatch(/,\s*]/);

    // 3. Arquivo com quebra de linha literal não escapada dentro de string JSON
    const unescapedNewlinePath = resolve(tempDir, "teste_unescaped_newline.json");
    const rawNewline = "{\n  \"justificativa\": \"Linha 1 da justificativa\nLinha 2 da justificativa com quebra crua\"\n}";
    writeFileSync(unescapedNewlinePath, rawNewline, "utf-8");
    const resNewline = safeReadJsonFile<{ justificativa: string }>(unescapedNewlinePath);
    expect(resNewline.justificativa).toBe("Linha 1 da justificativa\nLinha 2 da justificativa com quebra crua");
  });

  test("deve emitir diagnóstico cirúrgico com linha, coluna e snippet de 5 linhas numeradas com marcador <-- ERRO AQUI em falhas irrecuperáveis de JSON (v0.5.0)", () => {
    const corruptPath = resolve(tempDir, "teste_corrupt.json");
    const corruptContent = `{\n  "linha1": "ok",\n  "linha2": "ok",\n  "linha3": "ok",\n  "chave_com_erro": [\n    sem_aspas: 123\n  ],\n  "linha7": "ok",\n  "linha8": "ok"\n}`;
    writeFileSync(corruptPath, corruptContent, "utf-8");

    try {
      safeReadJsonFile(corruptPath);
      throw new Error("Deveria ter falhado com erro sintático");
    } catch (err: any) {
      const msg = err.message;
      expect(msg).toContain("ERRO DE SINTAXE JSON em");
      expect(msg).toContain("na Linha");
      expect(msg).toContain("Trecho com erro:");
      expect(msg).toContain("<-- ERRO AQUI");
      expect(msg).toContain("Corrija diretamente esta linha usando replace_file_content.");
    }
  });

  test("deve desaninhar (unflatten) automaticamente chaves na raiz com notação de ponto no estado_caso.json e injetar com sucesso nos templates (v0.5.0)", async () => {
    // 1. Teste unitário de unflattenDotKeys
    const flatObj = {
      processo_id: "POC-2026-DOT-01",
      "objeto.descricao": "Fornecimento de infraestrutura",
      "metadados.unidade.sigla": "DEMANDANTE",
      "metadados.unidade.codigo": 123,
    };
    const nested = unflattenDotKeys(flatObj);
    expect(nested.processo_id).toBe("POC-2026-DOT-01");
    expect(nested.objeto?.descricao).toBe("Fornecimento de infraestrutura");
    expect(nested.metadados?.unidade?.sigla).toBe("DEMANDANTE");
    expect(nested.metadados?.unidade?.codigo).toBe(123);
    // Preserva também a chave flat original
    expect(nested["objeto.descricao"]).toBe("Fornecimento de infraestrutura");

    // 2. Teste E2E de preenchimento de template Word usando chaves flat com ponto
    const dotStatePath = resolve(tempDir, "state_com_ponto.json");
    const dotOutDocx = resolve(tempDir, "resultado_com_ponto.docx");
    writeFileSync(
      dotStatePath,
      JSON.stringify(
        {
          processo_id: "PROC-PONTO-2026",
          "objeto.descricao": "Objeto preenchido via notação de ponto resiliente",
        },
        null,
        2
      ),
      "utf-8"
    );

    const result = await processDocument(templatePath, dotStatePath, dotOutDocx);
    expect(result.success).toBe(true);
    expect(existsSync(dotOutDocx)).toBe(true);
  });

  test("deve expor autodescoberta e resiliência v0.5.0 nas instruções e ferramentas do servidor MCP (v0.5.0)", () => {
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("toc_map");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("safeReadJsonFile");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("unflatten");

    const tools = getMcpToolsDefinition();
    const inspectTool = tools.find((t) => t.name === "inspect_docx")!;
    expect(inspectTool.description).toContain("toc_map");
    expect(inspectTool.description).toContain("toc_summary");

    const fillTool = tools.find((t) => t.name === "fill_docx_template")!;
    expect(fillTool.description).toContain("unflatten");

    const buildTool = tools.find((t) => t.name === "build_docx_template")!;
    expect(buildTool.description).toContain("auto-reparo");
  });
});


