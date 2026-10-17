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
  formatBuildDocxTemplateSyntheticResult,
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
  detectFileExtensionFromBuffer,
  isOpaqueFileName,
  extractHash4,
  extractSemanticTypeAndOrgan,
  resolveTargetFileName,
  type SlotsManifest,
  normalizeStructuralText,
  normalizeSlotsManifest,
  countManifestRules,
  type BuildDocxTemplateResult,
  computeStructureFingerprint,
  computeStructuralSimilarity,
  getTemplateRegistryDir,
  saveTemplateToRegistry,
  loadAllRegistryTemplates,
  findBestTemplateMatch,
  reanchorSlotsManifest,
  isValidIsoDate,
  extractCacheTemporalMetadata,
  generateLinearAuditViewMarkdown,
  VERSION,
  generateEngineSpecMarkdown,
  createSlotsManifestContractError,
  createAuditReportContractError,
  EXACT_COPY_PASTE_SLOTS_MANIFEST_SNIPPET,
  EXACT_COPY_PASTE_AUDIT_REPORT_SNIPPET,
  type StructureFingerprint,
  type TemplateRegistryEntry,
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

async function createDriftedRawDocx(targetPath: string): Promise<void> {
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
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>ESTUDO TÉCNICO PRELIMINAR</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Normal"/></w:pPr>
      <w:r><w:t>Órgão: Órgão Público Contratante (ORGAO_A)</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>1. DESCRIÇÃO DA NECESSIDADE</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="BodyText"/></w:pPr>
      <w:r><w:t>Texto original parágrafo 1 a substituir.</w:t></w:r>
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
        <w:tc><w:p><w:r><w:t>Setor Demandante Inserido</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Coordenação Nova</w:t></w:r></w:p></w:tc>
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
    </w:tbl>
  </w:body>
</w:document>`
  );

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(targetPath, buf);
}

describe("DocGov Docx Engine v0.6.4", () => {
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

  test("deve classificar nomes opacos vs legíveis corretamente (isOpaqueFileName v0.5.1)", () => {
    expect(isOpaqueFileName("media_1792069974647_14a93b9d")).toBe(true);
    expect(isOpaqueFileName("media_1791815270384_d0baeff4.docx")).toBe(true);
    expect(isOpaqueFileName("tmp_12345.pdf")).toBe(true);
    expect(isOpaqueFileName("upload_9999.docx")).toBe(true);
    expect(isOpaqueFileName("file_001.bin")).toBe(true);
    expect(isOpaqueFileName("550e8400-e29b-41d4-a716-446655440000.docx")).toBe(true);
    expect(isOpaqueFileName("14a93b9d0123456789abcdef.docx")).toBe(true);

    expect(isOpaqueFileName("ETP_Modelo.docx")).toBe(false);
    expect(isOpaqueFileName("modelo_etp_base.docx")).toBe(false);
    expect(isOpaqueFileName("dfd_assinado.pdf")).toBe(false);
    expect(isOpaqueFileName("Termo_de_Referencia_Padrao.docx")).toBe(false);
    expect(isOpaqueFileName("Edital_01_2026.pdf")).toBe(false);
  });

  test("deve inferir extensão via magic bytes em arquivos sem extensão (detectFileExtensionFromBuffer v0.5.1)", () => {
    // 50 4B 03 04 -> .docx
    const docxMagicBuf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    expect(detectFileExtensionFromBuffer(docxMagicBuf)).toBe(".docx");

    // 25 50 44 46 -> .pdf
    const pdfMagicBuf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    expect(detectFileExtensionFromBuffer(pdfMagicBuf)).toBe(".pdf");

    // Outros buffers ou curto
    expect(detectFileExtensionFromBuffer(Buffer.from([0x00, 0x01]))).toBeNull();
    expect(detectFileExtensionFromBuffer(Buffer.from("PLAIN TEXT"))).toBeNull();
  });

  test("deve extrair hash curto de 4 caracteres de nomes opacos (extractHash4 v0.5.1)", () => {
    expect(extractHash4("media_1792069974647_14a93b9d")).toBe("3b9d");
    expect(extractHash4("media_1791815270384_d0baeff4.docx")).toBe("eff4");
    expect(extractHash4("tmp_abc1234")).toBe("1234");
  });

  test("deve resolver nomes de arquivos respeitando as 3 regras: fileRenameMap, preservação de nomes legíveis e auto-batismo semântico (resolveTargetFileName v0.5.1)", async () => {
    const rawDocxBuf = Buffer.from(MINIMAL_DOCX_BASE64, "base64");

    // Regra 1: Prioridade fileRenameMap
    const res1 = await resolveTargetFileName(
      "media_1792069974647_14a93b9d",
      rawDocxBuf,
      { "media_1792069974647_14a93b9d": "ETP_Minuta.docx" }
    );
    expect(res1.targetFileName).toBe("ETP_Minuta.docx");
    expect(res1.detectedType).toBe("ETP");
    expect(res1.isOpaque).toBe(false);

    // Regra 2: Preservação de nome legível humano (com extensão)
    const res2 = await resolveTargetFileName("ETP_Modelo.docx", rawDocxBuf);
    expect(res2.targetFileName).toBe("ETP_Modelo.docx");
    expect(res2.detectedType).toBe("ETP");
    expect(res2.isOpaque).toBe(false);

    // Regra 2b: Preservação de nome legível sem extensão inferida por magic bytes
    const res2b = await resolveTargetFileName("Termo_Referencia_Juridico", rawDocxBuf);
    expect(res2b.targetFileName).toBe("Termo_Referencia_Juridico.docx");
    expect(res2b.detectedType).toBe("TR");
    expect(res2b.isOpaque).toBe(false);

    // Regra 3: Auto-batismo de arquivo opaco media_*
    const sampleDocxPath = resolve(tempDir, "auto_name_sample.docx");
    await createSampleRawDocx(sampleDocxPath);
    const sampleDocxBuf = readFileSync(sampleDocxPath);
    const res3 = await resolveTargetFileName(
      "media_1792069974647_14a93b9d",
      sampleDocxBuf
    );
    // Deve conter tipo ETP, órgão ORGAO_A (pois createSampleRawDocx contém 'Órgão Público Contratante (ORGAO_A)' e 'Estudo Técnico Preliminar') e hash 3b9d
    expect(res3.targetFileName).toBe("ETP_ORGAO_A_3b9d.docx");
    expect(res3.detectedType).toBe("ETP");
    expect(res3.isOpaque).toBe(true);
  });

  test("deve executar bootstrapCase com auto-batismo de media_*, magic bytes e fileRenameMap com payload < 1024 bytes (v0.5.1)", async () => {
    const caseDir = resolve(tempDir, "case_v051_test");
    const uploadsDir = resolve(tempDir, "uploads_v051_test");
    mkdirSync(uploadsDir, { recursive: true });

    // 1. Arquivo opaco media_* sem extensão contendo buffer de .docx (ORGAO_A + ETP)
    const sampleDocxPath = resolve(tempDir, "sample_v051.docx");
    await createSampleRawDocx(sampleDocxPath);
    const docxBuf = readFileSync(sampleDocxPath);
    writeFileSync(resolve(uploadsDir, "media_1792069974647_14a93b9d"), docxBuf);

    // 2. Arquivo opaco media_* sem extensão contendo magic bytes %PDF com texto
    const pdfBuf = Buffer.from("%PDF-1.4\n%TERMO DE REFERENCIA ORGAO_B\n%%EOF");
    writeFileSync(resolve(uploadsDir, "media_9999999999999_fa12"), pdfBuf);

    // 3. Arquivo com nome humano legível
    writeFileSync(resolve(uploadsDir, "modelo_tr_legivel.docx"), docxBuf);

    // 4. Arquivo com override explícito via fileRenameMap
    writeFileSync(resolve(uploadsDir, "tmp_renamed_anexo"), pdfBuf);

    const res = await bootstrapCase(caseDir, uploadsDir, {
      fileRenameMap: { tmp_renamed_anexo: "DFD_Planejamento.pdf" },
      waitBackground: true,
    });

    expect(res.status).toBe("success");
    // Valida que o .docx foi batizado e copiado para inputs/
    expect(existsSync(resolve(caseDir, "inputs", "ETP_ORGAO_A_3b9d.docx"))).toBe(true);
    expect(existsSync(resolve(caseDir, "inputs", "modelo_tr_legivel.docx"))).toBe(true);

    // Valida que os mapas estruturais foram gerados em state/
    expect(existsSync(resolve(caseDir, "state", "estrutura_ETP_ORGAO_A_3b9d.json"))).toBe(true);
    expect(existsSync(resolve(caseDir, "state", "estrutura_modelo_tr_legivel.json"))).toBe(true);

    // Valida que os PDFs em background foram salvos com os nomes corretos
    expect(existsSync(resolve(caseDir, "inputs", "TR_ORGAO_B_fa12.pdf"))).toBe(true);
    expect(existsSync(resolve(caseDir, "inputs", "DFD_Planejamento.pdf"))).toBe(true);

    // Valida ingestedFiles
    expect(res.ingestedFiles).toBeDefined();
    expect(res.ingestedFiles!.length).toBe(4);

    // Valida payload sintético MCP (< 1024 bytes estrito)
    const synthetic = formatBootstrapCaseSyntheticResult(res, "cases/v051");
    const jsonStr = JSON.stringify(synthetic, null, 2);
    const byteLength = Buffer.byteLength(jsonStr, "utf-8");

    expect(byteLength).toBeLessThan(1024);
    expect(synthetic.ingested_files).toBeDefined();
    expect(synthetic.ingested_files!.length).toBe(4);
    expect(synthetic.ingested_files![0].saved_as).toBe("ETP_ORGAO_A_3b9d.docx");
    expect(synthetic.ingested_files![0].type).toBe("ETP");
    expect(synthetic.ingested_files![0].structure).toBe("state/estrutura_ETP_ORGAO_A_3b9d.json");
  });

  test("deve documentar suporte a fileRenameMap e auto-batismo nas ferramentas MCP (v0.5.1)", () => {
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("media_*");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("fileRenameMap");

    const tools = getMcpToolsDefinition();
    const bootstrapTool = tools.find((t) => t.name === "bootstrap_case")!;
    expect(bootstrapTool.description).toContain("fileRenameMap");
    expect(bootstrapTool.description).toContain("media_*");
    expect(bootstrapTool.inputSchema.properties.fileRenameMap).toBeDefined();
  });

  // ==========================================================================
  // Testes de Recursos da v0.6.0
  // ==========================================================================

  test("deve calcular impressão digital estrutural (structure_fingerprint) e normalizar textos (v0.6.0)", async () => {
    // 1. normalizeStructuralText
    expect(normalizeStructuralText("  1. DESCRIÇÃO DA NECESSIDADE?!  ")).toBe(
      "1 descricao da necessidade"
    );
    expect(normalizeStructuralText("Órgão: Responsável - (Coordenação)")).toBe(
      "orgao responsavel coordenacao"
    );

    // 2. computeStructureFingerprint a partir de um docx inspecionado
    const sampleDocx = resolve(tempDir, "fp_sample.docx");
    await createSampleRawDocx(sampleDocx);
    const inspection = await inspectDocx(sampleDocx);
    const fp = computeStructureFingerprint(inspection);

    expect(fp.tables.length).toBe(2);
    expect(fp.tables[0].rows).toBe(2);
    expect(fp.tables[0].cols).toBe(2);
    expect(fp.tables[0].headers).toContain("unidade requisitante");
    expect(fp.tables[1].rows).toBe(4);
    expect(fp.tables[1].cols).toBe(2);
    expect(fp.tables[1].headers).toContain("risco");
    expect(fp.tables[1].headers).toContain("mitigacao");

    expect(fp.sections.length).toBeGreaterThan(0);
    expect(fp.sections).toContain("estudo tecnico preliminar");
    expect(fp.sections).toContain("1 descricao da necessidade");

    expect(fp.form_fields.length).toBeGreaterThan(0);
    expect(
      fp.form_fields.some((f) => f.label_normalized === "unidade requisitante")
    ).toBe(true);
    expect(
      fp.form_fields.some((f) => f.label_normalized === "responsavel")
    ).toBe(true);
  });

  test("deve calcular similaridade estrutural determinística (computeStructuralSimilarity v0.6.0)", async () => {
    const docxA = resolve(tempDir, "sim_doc_a.docx");
    const docxB = resolve(tempDir, "sim_doc_b.docx");
    await createSampleRawDocx(docxA);
    await createSampleRawDocx(docxB);

    const inspA = await inspectDocx(docxA);
    const inspB = await inspectDocx(docxB);
    const fpA = computeStructureFingerprint(inspA);
    const fpB = computeStructureFingerprint(inspB);

    // 1. Comparação entre documentos idênticos -> 1.0 (100%)
    const exactSim = computeStructuralSimilarity(fpA, fpB);
    expect(exactSim).toBe(1.0);

    // 2. Comparação com drift (inserção de linha extra na tabela) -> entre 0.75 e 0.995
    const docxDrift = resolve(tempDir, "sim_doc_drift.docx");
    await createDriftedRawDocx(docxDrift);
    const inspDrift = await inspectDocx(docxDrift);
    const fpDrift = computeStructureFingerprint(inspDrift);

    const driftSim = computeStructuralSimilarity(fpDrift, fpA);
    expect(driftSim).toBeGreaterThanOrEqual(0.75);
    expect(driftSim).toBeLessThan(0.995);

    // 3. Comparação com documento vazio/diferente -> < 0.75
    const minimalDocx = resolve(tempDir, "sim_doc_minimal.docx");
    writeFileSync(minimalDocx, Buffer.from(MINIMAL_DOCX_BASE64, "base64"));
    const inspMinimal = await inspectDocx(minimalDocx);
    const fpMinimal = computeStructureFingerprint(inspMinimal);

    const diffSim = computeStructuralSimilarity(fpMinimal, fpA);
    expect(diffSim).toBeLessThan(0.75);
  });

  test("deve resolver diretório do registro global e persistir templates (saveTemplateToRegistry & loadAllRegistryTemplates v0.6.0)", async () => {
    const customRegDir = resolve(tempDir, "custom_registry");
    const resolvedDir = getTemplateRegistryDir(undefined, customRegDir);
    expect(resolvedDir).toBe(customRegDir);

    const sampleDocx = resolve(tempDir, "reg_sample.docx");
    await createSampleRawDocx(sampleDocx);
    const insp = await inspectDocx(sampleDocx);
    const fp = computeStructureFingerprint(insp);

    const mockManifest: SlotsManifest = {
      replace_table_cells: [
        { table_index: 0, row_index: 0, cell_index: 1, tag: "{{unidade}}" },
        { table_index: 0, row_index: 1, cell_index: 1, tag: "{{responsavel}}" },
      ],
    };

    const savedPath = saveTemplateToRegistry(
      "etp_padrao_teste",
      mockManifest,
      fp,
      undefined,
      customRegDir
    );
    expect(existsSync(savedPath)).toBe(true);
    expect(savedPath).toContain("etp_padrao_teste.json");

    const all = loadAllRegistryTemplates(undefined, customRegDir);
    expect(all.length).toBe(1);
    expect(all[0].template_id).toBe("etp_padrao_teste");
    expect(all[0].manifest.replace_table_cells?.length).toBe(2);
    expect(all[0].structure_fingerprint.tables.length).toBe(2);
  });

  test("Busca 1-para-N no Cache Global e Auto-Offset: EXACT, MODIFIED (reancoragem automática) e NEW (v0.6.0)", async () => {
    const testRegDir = resolve(tempDir, "cases_test", "core", "registry", "templates");
    mkdirSync(testRegDir, { recursive: true });

    // Salva template base no registro
    const baseDocx = resolve(tempDir, "base_template_case.docx");
    await createSampleRawDocx(baseDocx);
    const baseInsp = await inspectDocx(baseDocx);
    const baseFp = computeStructureFingerprint(baseInsp);

    const baseManifest: SlotsManifest = {
      replace_paragraphs: [
        { start_p: 3, end_p: 4, tag: "{{necessidade.texto}}" },
      ],
      replace_table_cells: [
        { table_index: 0, row_index: 0, cell_index: 1, tag: "{{unidade_requisitante}}" },
        { table_index: 0, row_index: 1, cell_index: 1, tag: "{{responsavel}}" },
      ],
      loop_table_rows: [
        {
          table_index: 1,
          header_row_index: 0,
          template_row_index: 1,
          remove_from_row: 2,
          remove_to_row: 3,
          for_open_tag: "{{FOR r IN riscos}}",
          for_close_tag: "{{END-FOR r}}",
          cell_tags: ["{{$r.risco}}", "{{$r.mitigacao}}"],
        },
      ],
    };

    saveTemplateToRegistry(
      "etp_homologado_master",
      baseManifest,
      baseFp,
      undefined,
      testRegDir
    );

    // 1. Cenário EXACT (100%): novo documento idêntico ao registrado
    const exactDocx = resolve(tempDir, "doc_exact.docx");
    await createSampleRawDocx(exactDocx);
    const exactOut = resolve(tempDir, "state", "estrutura_exact.json");
    const exactInsp = await inspectDocx(exactDocx, exactOut, true, {
      registryDir: testRegDir,
    });

    expect(exactInsp.template_match).toBeDefined();
    expect(exactInsp.template_match?.status).toBe("EXACT");
    expect(exactInsp.template_match?.template_id).toBe("etp_homologado_master");
    expect(exactInsp.template_match?.similarity).toBe(1.0);

    // 2. Cenário MODIFIED com Auto-Offset: novo documento com 1 linha inserida na Tabela 0
    const driftDocx = resolve(tempDir, "doc_drift_case.docx");
    await createDriftedRawDocx(driftDocx);
    const driftOut = resolve(tempDir, "state", "estrutura_drift.json");
    const driftInsp = await inspectDocx(driftDocx, driftOut, true, {
      registryDir: testRegDir,
    });

    expect(driftInsp.template_match).toBeDefined();
    expect(driftInsp.template_match?.status).toBe("MODIFIED");
    expect(driftInsp.template_match?.similarity).toBeGreaterThanOrEqual(0.75);
    expect(driftInsp.template_match?.similarity).toBeLessThan(0.995);
    expect(driftInsp.template_match?.template_id).toBe("etp_homologado_master");
    expect(driftInsp.template_match?.adapted_manifest_path).toBeDefined();

    // Valida que o adapted_slots_manifest.json foi gravado em disco
    const adaptedManifestPath = driftInsp.template_match!.adapted_manifest_path!;
    expect(existsSync(adaptedManifestPath)).toBe(true);

    const adaptedManifest: SlotsManifest & { _shift_summary?: string } =
      safeReadJsonFile(adaptedManifestPath);

    // A regra da Unidade Requisitante manteve row_index = 0
    expect(adaptedManifest.replace_table_cells?.[0].row_index).toBe(0);
    // A regra do Responsável foi automaticamente reancorada de row_index 1 para 2!
    expect(adaptedManifest.replace_table_cells?.[1].row_index).toBe(2);
    expect(adaptedManifest.replace_table_cells?.[1].cell_index).toBe(1);
    expect(adaptedManifest._shift_summary).toContain("Responsável");

    // 3. Cenário NEW (< 75%): minuta inédita
    const minimalDocx = resolve(tempDir, "doc_new_unrelated.docx");
    writeFileSync(minimalDocx, Buffer.from(MINIMAL_DOCX_BASE64, "base64"));
    const newOut = resolve(tempDir, "state", "estrutura_new.json");
    const newInsp = await inspectDocx(minimalDocx, newOut, true, {
      registryDir: testRegDir,
    });

    expect(newInsp.template_match).toBeDefined();
    expect(newInsp.template_match?.status).toBe("NEW");
    expect(newInsp.template_match?.similarity).toBeLessThan(0.75);
  });

  test("deve gerar a Visão Linear Compacta de Auditoria (visao_auditoria_<doc>.md) para turno único (v0.6.0)", async () => {
    const rawDocx = resolve(tempDir, "audit_view_sample.docx");
    const outJson = resolve(tempDir, "state", "estrutura_audit_view.json");
    await createSampleRawDocx(rawDocx);

    const insp = await inspectDocx(rawDocx, outJson, true);

    expect(insp.audit_view_path).toBeDefined();
    expect(existsSync(insp.audit_view_path!)).toBe(true);
    expect(insp.audit_view_path!).toContain("visao_auditoria_audit_view.md");

    const mdContent = readFileSync(insp.audit_view_path!, "utf-8");

    // Valida títulos e seções
    expect(mdContent).toContain("# Visão Linear de Auditoria: audit_view_sample.docx");
    expect(mdContent).toContain("## Cabeçalhos e Rodapés");
    expect(mdContent).toContain("[H0] Órgão Público Contratante (ORGAO_A)");
    expect(mdContent).toContain("[F0] Processo Administrativo nº 000/2026");

    expect(mdContent).toContain("## Parágrafos e Seções");
    expect(mdContent).toContain("**[P0]** ESTUDO TÉCNICO PRELIMINAR");
    expect(mdContent).toContain("[P1] Órgão: Órgão Público Contratante (ORGAO_A)");
    expect(mdContent).toContain("**[P2]** 1. DESCRIÇÃO DA NECESSIDADE");
    expect(mdContent).toContain("[P3] Texto original parágrafo 1 a substituir.");

    expect(mdContent).toContain("## Tabelas");
    expect(mdContent).toContain("### Tabela [T0] (2 linhas x 2 colunas)");
    expect(mdContent).toContain("[T0.R0.C0] Unidade Requisitante -> [T0.R0.C1] Diretoria Antiga");
    expect(mdContent).toContain("[T0.R1.C0] Responsável -> [T0.R1.C1] Servidor Antigo");

    expect(mdContent).toContain("### Tabela [T1] (4 linhas x 2 colunas)");
    expect(mdContent).toContain("[T1.R0.C0] Risco -> [T1.R0.C1] Mitigação");
    expect(mdContent).toContain("[T1.R1.C0] Risco antigo 1 -> [T1.R1.C1] Mitigação antiga 1");

    // Valida que o tamanho do arquivo é muito compacto (< 10 KB para este caso)
    expect(Buffer.byteLength(mdContent, "utf-8")).toBeLessThan(10240);
  });

  test("deve suportar saveToRegistry em build_docx_template (v0.6.0)", async () => {
    const rawDocx = resolve(tempDir, "build_registry_sample.docx");
    const manifestFile = resolve(tempDir, "build_registry_manifest.json");
    const outDocx = resolve(tempDir, "build_registry_out.docx");
    const customRegistry = resolve(tempDir, "test_build_reg");

    await createSampleRawDocx(rawDocx);
    const mockManifest: SlotsManifest = {
      replace_table_cells: [
        { table_index: 0, row_index: 0, cell_index: 1, tag: "{{unidade}}" },
      ],
    };
    writeFileSync(manifestFile, JSON.stringify(mockManifest, null, 2), "utf-8");

    const result = await buildDocxTemplate(rawDocx, manifestFile, outDocx, {
      saveToRegistry: true,
      templateId: "etp_homologado_build_test",
      registryDir: customRegistry,
    });

    expect(result.success).toBe(true);
    expect(result.registryPath).toBeDefined();
    expect(existsSync(result.registryPath!)).toBe(true);
    expect(result.registryPath!).toContain("etp_homologado_build_test.json");

    const savedEntry: TemplateRegistryEntry = safeReadJsonFile(result.registryPath!);
    expect(savedEntry.template_id).toBe("etp_homologado_build_test");
    expect(savedEntry.manifest.replace_table_cells?.length).toBe(1);
    expect(savedEntry.structure_fingerprint.tables.length).toBe(2);
  });

  test("deve expor versão 0.6.4 e novos recursos v0.6.4 nas instruções e ferramentas MCP", () => {
    expect(VERSION).toBe("0.6.4");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("v0.6.4");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Rastreabilidade Temporal do Cache");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Exact Copy-Paste Error");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("--dump-spec");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Arquitetura Modular");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Coordenadas Compactas");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Zero Silent No-Op");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Sanity Check");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("structure_fingerprint");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Auto-Offset");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("saveToRegistry");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("visao_auditoria");

    const tools = getMcpToolsDefinition();
    const inspectTool = tools.find((t) => t.name === "inspect_docx")!;
    expect(inspectTool.description).toContain("structure_fingerprint");
    expect(inspectTool.description).toContain("created_at");
    expect(inspectTool.description).toContain("Auto-Offset");
    expect(inspectTool.description).toContain("visao_auditoria");

    const buildTool = tools.find((t) => t.name === "build_docx_template")!;
    expect(buildTool.description).toContain("Exact Copy-Paste Error");
    expect(buildTool.description).toContain("Zero Silent No-Op");
    expect(buildTool.description).toContain("saveToRegistry");
    expect(buildTool.inputSchema.properties.manifestPath.description).toContain(
      "coord"
    );
    expect(buildTool.inputSchema.properties.saveToRegistry).toBeDefined();
    expect(buildTool.inputSchema.properties.templateId).toBeDefined();

    const auditTool = tools.find((t) => t.name === "generate_audit_docx")!;
    expect(auditTool.description).toContain("Exact Copy-Paste Error");
  });

  test("deve normalizar manifesto com coordenadas compactas, aliases e array na raiz (normalizeSlotsManifest & countManifestRules v0.6.1)", () => {
    // 1. Array puro na raiz com coordenadas compactas
    const rawArray = [
      { coord: "T0.R1.C1", tag: "{{campo_tabela}}" },
      { coord: "[T1.R2.C0]", tag: "{{campo_com_colchetes}}" },
      { coord: "P3", tag: "{{paragrafo_simples}}" },
      { coord: "[P4-P6]", tag: "{{paragrafo_faixa}}" },
      { coord: "P7..P8", tag: "{{paragrafo_pontos}}" },
      { find: "Texto Antigo", replace: "{{texto_novo}}" },
    ];
    const norm1 = normalizeSlotsManifest(rawArray);
    expect(norm1.replace_table_cells?.length).toBe(2);
    expect(norm1.replace_table_cells?.[0]).toEqual({
      table_index: 0,
      row_index: 1,
      cell_index: 1,
      tag: "{{campo_tabela}}",
    });
    expect(norm1.replace_table_cells?.[1]).toEqual({
      table_index: 1,
      row_index: 2,
      cell_index: 0,
      tag: "{{campo_com_colchetes}}",
    });
    expect(norm1.replace_paragraphs?.length).toBe(3);
    expect(norm1.replace_paragraphs?.[0]).toEqual({
      start_p: 3,
      end_p: 3,
      tag: "{{paragrafo_simples}}",
    });
    expect(norm1.replace_paragraphs?.[1]).toEqual({
      start_p: 4,
      end_p: 6,
      tag: "{{paragrafo_faixa}}",
    });
    expect(norm1.replace_paragraphs?.[2]).toEqual({
      start_p: 7,
      end_p: 8,
      tag: "{{paragrafo_pontos}}",
    });
    expect(norm1.replace_inline?.length).toBe(1);
    expect(norm1.replace_inline?.[0]).toEqual({
      find: "Texto Antigo",
      replace: "{{texto_novo}}",
    });
    expect(countManifestRules(norm1)).toBe(6);

    // 2. Objeto com chave unificada 'slots' e aliases
    const rawSlotsObj = {
      slots: [
        { table_index: 0, row_index: 0, col_index: 1, tag: "{{alias_col}}" },
        { paragraph_index: 5, tag: "{{alias_p}}" },
      ],
    };
    const norm2 = normalizeSlotsManifest(rawSlotsObj);
    expect(norm2.replace_table_cells?.length).toBe(1);
    expect(norm2.replace_table_cells?.[0].cell_index).toBe(1);
    expect(norm2.replace_paragraphs?.length).toBe(1);
    expect(norm2.replace_paragraphs?.[0].start_p).toBe(5);
    expect(norm2.replace_paragraphs?.[0].end_p).toBe(5);
    expect(countManifestRules(norm2)).toBe(2);

    // 3. Manifesto canônico preservado
    const rawCanonical: SlotsManifest = {
      replace_paragraphs: [{ start_p: 1, end_p: 2, tag: "{{can}}" }],
      replace_inline: [{ find: "A", replace: "B" }],
    };
    const norm3 = normalizeSlotsManifest(rawCanonical);
    expect(norm3.replace_paragraphs?.length).toBe(1);
    expect(norm3.replace_inline?.length).toBe(1);
    expect(countManifestRules(norm3)).toBe(2);

    // 4. Manifesto vazio ou nulo
    expect(countManifestRules(normalizeSlotsManifest({}))).toBe(0);
    expect(countManifestRules(normalizeSlotsManifest(null))).toBe(0);
  });

  test("deve construir template com coordenadas compactas e retornar contagem e breakdown (buildDocxTemplate v0.6.1)", async () => {
    const rawDocx = resolve(tempDir, "compact_coords_sample.docx");
    const manifestFile = resolve(tempDir, "compact_coords_manifest.json");
    const outDocx = resolve(tempDir, "compact_coords_out.docx");
    await createSampleRawDocx(rawDocx);

    // Manifesto usando a notação compacta moderna que o LLM vê no toc_map
    const compactManifest = {
      slots: [
        { coord: "P3", tag: "{{necessidade_injetada}}" },
        { coord: "[T0.R0.C1]", tag: "{{unidade_injetada}}" },
        { find: "Órgão Público Contratante", replace: "{{orgao_injetado}}" },
      ],
    };
    writeFileSync(
      manifestFile,
      JSON.stringify(compactManifest, null, 2),
      "utf-8"
    );

    const result = await buildDocxTemplate(rawDocx, manifestFile, outDocx);

    expect(result.success).toBe(true);
    expect(result.applied_slots_count).toBe(4);
    expect(result.breakdown).toEqual({
      replace_paragraphs: 1,
      loop_paragraphs: 0,
      replace_table_cells: 1,
      loop_table_rows: 0,
      replace_inline: 2,
    });
    expect(existsSync(outDocx)).toBe(true);

    const synthetic = formatBuildDocxTemplateSyntheticResult(outDocx, result);
    expect(synthetic.status).toBe("success");
    expect(synthetic.applied_slots_count).toBe(4);
    expect(synthetic.breakdown.replace_paragraphs).toBe(1);
    expect(synthetic.breakdown.replace_table_cells).toBe(1);
    expect(synthetic.breakdown.replace_inline).toBe(2);
    expect(synthetic.next_step_hint).toContain("fill_docx_template");
    expect(Buffer.byteLength(JSON.stringify(synthetic), "utf-8")).toBeLessThan(1024);

    // Injeta dados no template construído com coordenadas compactas e valida output
    const stateFile = resolve(tempDir, "compact_coords_state.json");
    const finalDocx = resolve(tempDir, "compact_coords_final.docx");
    writeFileSync(
      stateFile,
      JSON.stringify(
        {
          necessidade_injetada: "Necessidade aprovada com sucesso.",
          unidade_injetada: "Diretoria de Compras e Logística",
          orgao_injetado: "Secretaria de Gestão e Planejamento",
        },
        null,
        2
      ),
      "utf-8"
    );

    await processDocument(outDocx, stateFile, finalDocx);
    expect(existsSync(finalDocx)).toBe(true);

    const insp = await inspectDocx(finalDocx);
    const p3 = insp.paragraphs.find((p) => p.index === 3);
    expect(p3?.text).toContain("Necessidade aprovada com sucesso.");

    const t0 = insp.tables.find((t) => t.index === 0);
    expect(t0?.rows[0].cells[1].text).toContain("Diretoria de Compras e Logística");
  });

  test("deve aplicar Fail-Fast estrito (Zero Silent No-Op) rejeitando manifestos vazios ou com 0 slots aplicados sem corromper disco ou cache (v0.6.1)", async () => {
    const rawDocx = resolve(tempDir, "fail_fast_sample.docx");
    const emptyManifestFile = resolve(tempDir, "empty_manifest.json");
    const noOpManifestFile = resolve(tempDir, "noop_manifest.json");
    const outDocxEmpty = resolve(tempDir, "fail_fast_empty_out.docx");
    const outDocxNoOp = resolve(tempDir, "fail_fast_noop_out.docx");
    const customRegistry = resolve(tempDir, "test_fail_fast_reg");

    await createSampleRawDocx(rawDocx);

    // Caso A: Manifesto vazio ou com chaves desconhecidas (0 regras configuradas)
    writeFileSync(
      emptyManifestFile,
      JSON.stringify({ chave_invalida: [1, 2, 3] }, null, 2),
      "utf-8"
    );

    let errorA: any;
    try {
      await buildDocxTemplate(rawDocx, emptyManifestFile, outDocxEmpty, {
        saveToRegistry: true,
        templateId: "template_corrompido_a",
        registryDir: customRegistry,
      });
    } catch (e: any) {
      errorA = e;
    }

    expect(errorA).toBeDefined();
    expect(errorA.message).toContain("NÃO faça leituras exploratórias no repositório");
    expect(errorA.message).toContain("Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errorA.message).toContain("chave_invalida");
    expect(existsSync(outDocxEmpty)).toBe(false);
    expect(
      existsSync(resolve(customRegistry, "template_corrompido_a.json"))
    ).toBe(false);

    // Caso B: Manifesto com regra configurada mas que produz 0 substituições (ex.: find não bate)
    writeFileSync(
      noOpManifestFile,
      JSON.stringify(
        {
          replace_inline: [
            { find: "TEXTO_QUE_NAO_EXISTE_XYZ_123", replace: "tag" },
          ],
        },
        null,
        2
      ),
      "utf-8"
    );

    let errorB: any;
    try {
      await buildDocxTemplate(rawDocx, noOpManifestFile, outDocxNoOp, {
        saveToRegistry: true,
        templateId: "template_corrompido_b",
        registryDir: customRegistry,
      });
    } catch (e: any) {
      errorB = e;
    }

    expect(errorB).toBeDefined();
    expect(errorB.message).toContain("0 slots foram aplicados no documento");
    expect(errorB.message).toContain("NÃO faça leituras exploratórias no repositório");
    expect(errorB.message).toContain("Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(existsSync(outDocxNoOp)).toBe(false);
    expect(
      existsSync(resolve(customRegistry, "template_corrompido_b.json"))
    ).toBe(false);
  });

  test("deve realizar sanity check no Cache Global descartando templates corrompidos com 0 regras (loadAllRegistryTemplates v0.6.1)", () => {
    const regDir = resolve(tempDir, "test_sanity_registry");
    mkdirSync(regDir, { recursive: true });

    // Template válido
    const validEntry = {
      template_id: "template_valido_v1",
      created_at: new Date().toISOString(),
      structure_fingerprint: {
        sections: ["1. OBJETO"],
        form_fields: [],
        tables: [],
        total_paragraphs: 10,
        total_tables: 1,
      },
      manifest: {
        slots: [{ coord: "P1", tag: "{{objeto}}" }],
      },
    };
    writeFileSync(
      resolve(regDir, "template_valido_v1.json"),
      JSON.stringify(validEntry, null, 2),
      "utf-8"
    );

    // Template corrompido/defeituoso (0 regras)
    const corruptedEntry = {
      template_id: "template_defeituoso_v1",
      created_at: new Date().toISOString(),
      structure_fingerprint: {
        sections: ["2. JUSTIFICATIVA"],
        form_fields: [],
        tables: [],
        total_paragraphs: 10,
        total_tables: 1,
      },
      manifest: {
        slots: [],
      },
    };
    writeFileSync(
      resolve(regDir, "template_defeituoso_v1.json"),
      JSON.stringify(corruptedEntry, null, 2),
      "utf-8"
    );

    const loaded = loadAllRegistryTemplates(undefined, regDir);
    expect(loaded.length).toBe(1);
    expect(loaded[0].template_id).toBe("template_valido_v1");
  });

  test("deve aplicar Exact Copy-Paste Error estrito em slots_manifest.json com propriedades inventadas ou chaves raiz desconhecidas (v0.6.2)", () => {
    // 1. Chave raiz desconhecida
    let errRoot: any;
    try {
      normalizeSlotsManifest({ minhas_regras: [{ coord: "P1", tag: "{{tag}}" }] });
    } catch (e: any) {
      errRoot = e;
    }
    expect(errRoot).toBeDefined();
    expect(errRoot.message).toContain("NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errRoot.message).toContain("minhas_regras");
    expect(errRoot.message).toContain(EXACT_COPY_PASTE_SLOTS_MANIFEST_SNIPPET);

    // 2. Chaves proibidas em loop_table_rows (loop_var, items_expr, cell_slots, row_index)
    let errLoop: any;
    try {
      normalizeSlotsManifest({
        loop_table_rows: [
          {
            table_index: 1,
            loop_var: "r",
            items_expr: "gestao_riscos",
            cell_slots: ["{{$r.risco}}"],
          },
        ],
      });
    } catch (e: any) {
      errLoop = e;
    }
    expect(errLoop).toBeDefined();
    expect(errLoop.message).toContain("NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errLoop.message).toContain("loop_var");
    expect(errLoop.message).toContain("Não invente propriedades como 'loop_var', 'items_expr', 'cell_slots' ou 'row_index'");

    // 3. Propriedade desconhecida no array slots
    let errSlotsItem: any;
    try {
      normalizeSlotsManifest({
        slots: [{ coord: "P1", tag: "{{tag}}", invalid_custom_field: true }],
      });
    } catch (e: any) {
      errSlotsItem = e;
    }
    expect(errSlotsItem).toBeDefined();
    expect(errSlotsItem.message).toContain("NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errSlotsItem.message).toContain("invalid_custom_field");
  });

  test("deve aplicar Exact Copy-Paste Error estrito em relatorio_auditoria.json caso processo_id ou resumo_executivo estejam ausentes ou inválidos (v0.6.2)", async () => {
    const invalidAuditPath = resolve(tempDir, "invalid_audit.json");
    const outAuditDocx = resolve(tempDir, "out_invalid_audit.docx");

    // 1. Arquivo sem processo_id
    writeFileSync(
      invalidAuditPath,
      JSON.stringify({ resumo_executivo: "Resumo sem ID" }),
      "utf-8"
    );
    let errAudit1: any;
    try {
      await generateAuditDocx(invalidAuditPath, outAuditDocx);
    } catch (e: any) {
      errAudit1 = e;
    }
    expect(errAudit1).toBeDefined();
    expect(errAudit1.message).toContain("NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errAudit1.message).toContain("processo_id");
    expect(errAudit1.message).toContain(EXACT_COPY_PASTE_AUDIT_REPORT_SNIPPET);
    expect(errAudit1.message).toContain("ORGAO_CONTRATANTE");

    // 2. Arquivo sem resumo_executivo
    writeFileSync(
      invalidAuditPath,
      JSON.stringify({ processo_id: "08000.001/2026" }),
      "utf-8"
    );
    let errAudit2: any;
    try {
      await generateAuditDocx(invalidAuditPath, outAuditDocx);
    } catch (e: any) {
      errAudit2 = e;
    }
    expect(errAudit2).toBeDefined();
    expect(errAudit2.message).toContain("NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errAudit2.message).toContain("resumo_executivo");

    // 3. Campo apontamentos não-array
    writeFileSync(
      invalidAuditPath,
      JSON.stringify({
        processo_id: "08000.001/2026",
        resumo_executivo: "Resumo válido",
        apontamentos: "não sou um array",
      }),
      "utf-8"
    );
    let errAudit3: any;
    try {
      await generateAuditDocx(invalidAuditPath, outAuditDocx);
    } catch (e: any) {
      errAudit3 = e;
    }
    expect(errAudit3).toBeDefined();
    expect(errAudit3.message).toContain("NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errAudit3.message).toContain("apontamentos");
  });

  test("deve exportar especificação técnica integral em Markdown (--dump-spec v0.6.4)", () => {
    const spec = generateEngineSpecMarkdown();
    expect(spec).toContain("# Especificação Técnica do Motor docgov-docx-engine (v0.6.4)");
    expect(spec).toContain("Diretrizes de Comunicação e Resiliência MCP");
    expect(spec).toContain("Teto Estrito de Payload MCP (< 1024 bytes)");
    expect(spec).toContain("Padrão Exact Copy-Paste Error (Zero Silent No-Op e Fail-Fast Estrito)");
    expect(spec).toContain("Neutralidade Institucional Absoluta");
    expect(spec).toContain("Resiliência e Cache Global (core/registry/templates/)");
    expect(spec).toContain("created_at");
    expect(spec).toContain("updated_at");
    expect(spec).toContain("age_days");

    // Governança interna do repositório NÃO deve vazar para a especificação do consumidor
    expect(spec).not.toContain("Runtime e Testes Padronizados via Bun");
    expect(spec).not.toContain("Ritual de Qualidade e Release");

    // 5 ferramentas
    expect(spec).toContain("2.1. bootstrap_case");
    expect(spec).toContain("2.2. inspect_docx");
    expect(spec).toContain("2.3. build_docx_template");
    expect(spec).toContain("2.4. fill_docx_template");
    expect(spec).toContain("2.5. generate_audit_docx");

    // Snippets canônicos
    expect(spec).toContain("ORGAO_CONTRATANTE");
    expect(spec).toContain("slots");
    expect(spec).toContain("loop_table_rows");
  });

  test("deve garantir integridade de todas as exportações públicas via barrel em src/index.ts (v0.6.4)", async () => {
    const barrel = await import("../src/index.ts");

    // Ferramentas do Pipeline
    expect(typeof barrel.bootstrapCase).toBe("function");
    expect(typeof barrel.inspectDocx).toBe("function");
    expect(typeof barrel.buildDocxTemplate).toBe("function");
    expect(typeof barrel.processDocument).toBe("function");
    expect(typeof barrel.generateAuditDocx).toBe("function");

    // Servidor MCP e Especificação
    expect(typeof barrel.runMcpServer).toBe("function");
    expect(typeof barrel.getMcpToolsDefinition).toBe("function");
    expect(typeof barrel.getMcpPromptsDefinition).toBe("function");
    expect(typeof barrel.generateEngineSpecMarkdown).toBe("function");

    // CLI
    expect(typeof barrel.runCli).toBe("function");

    // Core e Normalizadores
    expect(typeof barrel.normalizeSlotsManifest).toBe("function");
    expect(typeof barrel.countManifestRules).toBe("function");
    expect(typeof barrel.computeStructureFingerprint).toBe("function");
    expect(typeof barrel.computeStructuralSimilarity).toBe("function");
    expect(typeof barrel.saveTemplateToRegistry).toBe("function");
    expect(typeof barrel.loadAllRegistryTemplates).toBe("function");
    expect(typeof barrel.findBestTemplateMatch).toBe("function");
    expect(typeof barrel.reanchorSlotsManifest).toBe("function");
    expect(typeof barrel.isValidIsoDate).toBe("function");
    expect(typeof barrel.extractCacheTemporalMetadata).toBe("function");
    expect(typeof barrel.compareSemver).toBe("function");

    // Utilitários
    expect(typeof barrel.safeReadJsonFile).toBe("function");
    expect(typeof barrel.sanitizeJsonString).toBe("function");
    expect(typeof barrel.formatJsonErrorWithSnippet).toBe("function");
    expect(typeof barrel.unflattenDotKeys).toBe("function");
    expect(typeof barrel.resolveTargetFileName).toBe("function");
    expect(typeof barrel.detectFileExtensionFromBuffer).toBe("function");

    // Contratos de Erro
    expect(typeof barrel.createSlotsManifestContractError).toBe("function");
    expect(typeof barrel.createAuditReportContractError).toBe("function");

    // Constantes
    expect(barrel.VERSION).toBe("0.6.4");
  });

  test("deve gravar e ler rastreabilidade temporal no cache (created_at, updated_at, age_days, engine_version, slots_count), preservando created_at ao atualizar e orientando Gate 1 (v0.6.4)", async () => {
    const regDir = resolve(tempDir, "test_temporal_trace_registry");
    mkdirSync(regDir, { recursive: true });

    const sampleDocx = resolve(tempDir, "temporal_sample.docx");
    await createSampleRawDocx(sampleDocx);
    const inspInitial = await inspectDocx(sampleDocx);
    const fp = inspInitial.structure_fingerprint!;

    // 1. Grava primeiro cache com 2 slots
    const manifestV1: SlotsManifest = {
      slots: [
        { coord: "P3", tag: "{{necessidade}}" },
        { coord: "T0.R0.C1", tag: "{{unidade}}" },
      ],
    };
    const savedPath = saveTemplateToRegistry(
      "etp_temporal_v1",
      manifestV1,
      fp,
      undefined,
      regDir
    );

    const diskEntryV1 = safeReadJsonFile<TemplateRegistryEntry>(savedPath);
    expect(isValidIsoDate(diskEntryV1.created_at)).toBe(true);
    expect(isValidIsoDate(diskEntryV1.updated_at)).toBe(true);
    expect(diskEntryV1.engine_version).toBe("0.6.4");
    expect(diskEntryV1.slots_count).toBe(2);

    // Simula que o template foi criado há 5 dias atrás no disco e agora recebe uma atualização com 3 slots
    const fiveDaysAgoIso = new Date(Date.now() - 5 * 86_400_000).toISOString();
    diskEntryV1.created_at = fiveDaysAgoIso;
    diskEntryV1.updated_at = fiveDaysAgoIso;
    writeFileSync(savedPath, JSON.stringify(diskEntryV1, null, 2), "utf-8");

    const manifestV2: SlotsManifest = {
      slots: [
        { coord: "P3", tag: "{{necessidade}}" },
        { coord: "T0.R0.C1", tag: "{{unidade}}" },
        { coord: "T0.R1.C1", tag: "{{responsavel}}" },
      ],
    };
    saveTemplateToRegistry(
      "etp_temporal_v1",
      manifestV2,
      fp,
      undefined,
      regDir
    );

    const diskEntryV2 = safeReadJsonFile<TemplateRegistryEntry>(savedPath);
    // Preserva o created_at original (5 dias atrás) e atualiza updated_at e slots_count (3)
    expect(diskEntryV2.created_at).toBe(fiveDaysAgoIso);
    expect(diskEntryV2.updated_at).not.toBe(fiveDaysAgoIso);
    expect(isValidIsoDate(diskEntryV2.updated_at)).toBe(true);
    expect(diskEntryV2.engine_version).toBe("0.6.4");
    expect(diskEntryV2.slots_count).toBe(3);

    // Inspeciona documento contra esse cache atualizado
    const outInspectJson = resolve(tempDir, "state", "estrutura_temporal.json");
    const matchedInsp = await inspectDocx(sampleDocx, outInspectJson, true, {
      registryDir: regDir,
    });

    expect(matchedInsp.template_match).toBeDefined();
    expect(matchedInsp.template_match?.status).toBe("EXACT");
    expect(matchedInsp.template_match?.created_at).toBe(fiveDaysAgoIso);
    expect(matchedInsp.template_match?.updated_at).toBe(diskEntryV2.updated_at);
    expect(matchedInsp.template_match?.age_days).toBe(0);
    expect(matchedInsp.template_match?.cache_date_status).toBe("KNOWN");
    expect(matchedInsp.template_match?.engine_version).toBe("0.6.4");
    expect(matchedInsp.template_match?.slots_count).toBe(3);

    const synthetic = formatInspectDocxSyntheticResult(
      sampleDocx,
      outInspectJson,
      matchedInsp
    );
    const expectedDateYmd = diskEntryV2.updated_at!.slice(0, 10);
    expect(synthetic.template_match?.created_at).toBe(fiveDaysAgoIso);
    expect(synthetic.template_match?.updated_at).toBe(diskEntryV2.updated_at);
    expect(synthetic.template_match?.age_days).toBe(0);
    expect(synthetic.template_match?.cache_date_status).toBe("KNOWN");
    expect(synthetic.template_match?.engine_version).toBe("0.6.4");
    expect(synthetic.template_match?.slots_count).toBe(3);
    expect(synthetic.next_step_hint).toContain(
      `Cache reconhecido (EXACT, criado/atualizado em ${expectedDateYmd}, 3 slots). Informe a data ao usuário no Gate 1.`
    );
    expect(Buffer.byteLength(JSON.stringify(synthetic), "utf-8")).toBeLessThan(
      1024
    );
  });

  test("deve garantir 100% de retrocompatibilidade com cache legado sem created_at/updated_at/engine_version sem usar mtime do disco (v0.6.4)", async () => {
    const regDir = resolve(tempDir, "test_legacy_cache_registry");
    mkdirSync(regDir, { recursive: true });

    const sampleDocx = resolve(tempDir, "legacy_cache_sample.docx");
    await createSampleRawDocx(sampleDocx);
    const inspInitial = await inspectDocx(sampleDocx);
    const fp = inspInitial.structure_fingerprint!;

    // Grava manualmente um JSON de cache legado SEM created_at, updated_at, engine_version ou slots_count
    const legacyCacheJson = {
      template_id: "etp_legado_sem_data",
      structure_fingerprint: fp,
      manifest: {
        replace_paragraphs: [{ start_p: 3, end_p: 3, tag: "{{necessidade}}" }],
        replace_table_cells: [
          { table_index: 0, row_index: 0, cell_index: 1, tag: "{{unidade}}" },
        ],
      },
    };
    writeFileSync(
      resolve(regDir, "etp_legado_sem_data.json"),
      JSON.stringify(legacyCacheJson, null, 2),
      "utf-8"
    );

    const loaded = loadAllRegistryTemplates(undefined, regDir);
    expect(loaded.length).toBe(1);
    expect(loaded[0].template_id).toBe("etp_legado_sem_data");
    expect(loaded[0].created_at).toBe("NÃO DISPONÍVEL");
    expect(loaded[0].updated_at).toBe("NÃO DISPONÍVEL");
    expect(loaded[0].engine_version).toBe("NÃO DISPONÍVEL");
    expect(loaded[0].slots_count).toBe(2);

    const outInspectJson = resolve(tempDir, "state", "estrutura_legacy.json");
    const matchedInsp = await inspectDocx(sampleDocx, outInspectJson, true, {
      registryDir: regDir,
    });

    expect(matchedInsp.template_match).toBeDefined();
    expect(matchedInsp.template_match?.status).toBe("EXACT");
    expect(matchedInsp.template_match?.created_at).toBe("NÃO DISPONÍVEL");
    expect(matchedInsp.template_match?.updated_at).toBe("NÃO DISPONÍVEL");
    expect(matchedInsp.template_match?.age_days).toBeNull();
    expect(matchedInsp.template_match?.cache_date_status).toBe("UNKNOWN");
    expect(matchedInsp.template_match?.engine_version).toBe("NÃO DISPONÍVEL");
    expect(matchedInsp.template_match?.slots_count).toBe(2);

    const synthetic = formatInspectDocxSyntheticResult(
      sampleDocx,
      outInspectJson,
      matchedInsp
    );
    expect(synthetic.template_match?.created_at).toBe("NÃO DISPONÍVEL");
    expect(synthetic.template_match?.updated_at).toBe("NÃO DISPONÍVEL");
    expect(synthetic.template_match?.age_days).toBeNull();
    expect(synthetic.template_match?.cache_date_status).toBe("UNKNOWN");
    expect(synthetic.template_match?.engine_version).toBe("NÃO DISPONÍVEL");
    expect(synthetic.template_match?.slots_count).toBe(2);
    expect(synthetic.next_step_hint).toContain(
      "Cache reconhecido (EXACT, data de criação não disponível no cache legado). Informe ao usuário no Gate 1 que a data do cache é desconhecida para que ele decida entre usar ou atualizar."
    );
    expect(Buffer.byteLength(JSON.stringify(synthetic), "utf-8")).toBeLessThan(
      1024
    );
  });
});


