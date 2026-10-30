import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { resolve } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { sanitizeXmlString, inspectDocx } from "../src/index.ts";

describe("Testes Unitários v1.1.1: Sanitização Universal de XML BOM e Whitespaces Iniciais", () => {
  const tempDir = resolve(__dirname, "..", "docgov_test_xml_sanitizer");

  beforeAll(() => {
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("1. sanitizeXmlString deve remover UTF-8 BOM (\\uFEFF) no início da string", () => {
    const rawXml = "\uFEFF<?xml version=\"1.0\" encoding=\"UTF-8\"?><root><item>Teste</item></root>";
    const sanitized = sanitizeXmlString(rawXml);

    expect(sanitized.startsWith("<?xml")).toBe(true);
    expect(sanitized.charCodeAt(0)).not.toBe(0xfeff);

    // Sem a sanitização, @xmldom/xmldom lança erro fatal 'processing instruction at position 1...'
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized, "application/xml");
    expect(doc.documentElement.nodeName).toBe("root");
  });

  test("2. sanitizeXmlString deve remover quebras de linha e espaços em branco antes de <?xml", () => {
    const rawXml = "\r\n  \t  \n  <?xml version=\"1.0\" encoding=\"UTF-8\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body/></w:document>";
    const sanitized = sanitizeXmlString(rawXml);

    expect(sanitized.startsWith("<?xml")).toBe(true);

    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized, "application/xml");
    expect(doc.documentElement.nodeName).toBe("w:document");
  });

  test("3. sanitizeXmlString deve remover BOM combinado com quebras de linha e espaços antes da declaração", () => {
    const rawXml = "\uFEFF\r\n   \n\t  <?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<Types/>";
    const sanitized = sanitizeXmlString(rawXml);

    expect(sanitized.startsWith("<?xml")).toBe(true);
    expect(sanitized.indexOf("<")).toBe(0);

    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized, "application/xml");
    expect(doc.documentElement.nodeName).toBe("Types");
  });

  test("4. sanitizeXmlString deve preservar XMLs válidos que começam diretamente com elemento sem declaração <?xml", () => {
    const rawXml = "   \n  <w:numbering xmlns:w=\"http://example.com\"><w:abstractNum/></w:numbering>";
    const sanitized = sanitizeXmlString(rawXml);

    expect(sanitized.startsWith("<w:numbering")).toBe(true);
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized, "application/xml");
    expect(doc.documentElement.nodeName).toBe("w:numbering");
  });

  test("5. sanitizeXmlString deve ser resiliente a valores nulos ou vazios", () => {
    expect(sanitizeXmlString("")).toBe("");
    expect(sanitizeXmlString(null as any)).toBe(null);
    expect(sanitizeXmlString(undefined as any)).toBe(undefined);
  });

  test("6. inspectDocx deve inspecionar com sucesso arquivo .docx real cujo word/document.xml e [Content_Types].xml contêm BOM e whitespaces iniciais", async () => {
    const zip = new JSZip();

    // Injeta BOM e quebras de linha intencionais antes de <?xml em todos os arquivos XML críticos
    const documentXmlWithBom = `\uFEFF\r\n  \n  <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>1. OBJETO DA CONTRATAÇÃO</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Aquisição de soluções integradas de tecnologia conforme especificações do Termo de Referência.</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Item</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Descrição</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Valor Total</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Servidor de Aplicação</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>R$ 10.000,00</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

    const contentTypesXmlWithBom = `\uFEFF\r\n <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsXmlWithBom = `\uFEFF <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    zip.file("word/document.xml", documentXmlWithBom);
    zip.file("[Content_Types].xml", contentTypesXmlWithBom);
    zip.file("_rels/.rels", relsXmlWithBom);

    const docxPath = resolve(tempDir, "doc_com_bom_e_whitespace.docx");
    const outJsonPath = resolve(tempDir, "estrutura_doc_com_bom.json");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(docxPath, buffer);

    // Inspeciona o arquivo DOCX. Sem a correção, o inspectDocx aborta com:
    // 'processing instruction at position 1 is an xml declaration which is only at the start of the document'
    const inspection = await inspectDocx(docxPath, outJsonPath);

    expect(inspection).toBeDefined();
    expect(inspection.paragraphs.length).toBe(2);
    expect(inspection.tables.length).toBe(1);
    expect(inspection.paragraphs[0].text).toContain("1. OBJETO DA CONTRATAÇÃO");
    expect(inspection.tables[0].rows.length).toBe(2);
    expect(existsSync(outJsonPath)).toBe(true);
    expect(inspection.audit_view_path).toBeDefined();
    expect(existsSync(inspection.audit_view_path!)).toBe(true);
  });
});
