import { writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";

// Base64 de um .docx OpenXML válido contendo as tags {{processo_id}} e {{objeto.descricao}}
export const MINIMAL_DOCX_BASE64 =
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

export async function createSampleRawDocx(targetPath: string): Promise<void> {
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

export async function createDriftedRawDocx(targetPath: string): Promise<void> {
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

export function createSuiteTempDir(suiteName: string): {
  tempDir: string;
  cleanup: () => void;
} {
  const tempDir = resolve(`./temp_test_${suiteName}`);
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  return {
    tempDir,
    cleanup: () => {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    },
  };
}
