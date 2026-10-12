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
  buildDocxTemplate,
  compareSemver,
  replaceBinaryOnDisk,
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
});
