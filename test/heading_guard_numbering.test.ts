import { describe, test, expect, afterAll } from "bun:test";
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { buildDocxTemplate } from "../src/tools/build_template.ts";
import { fillDocxTemplate } from "../src/tools/fill_template.ts";
import { createSuiteTempDir } from "./helpers/fixtures.ts";
import { getAllElements, extractParagraphText, getDirectChildElements } from "../src/utils/xml.ts";

describe("Testes Unitários v1.3.8: Heading Guard, Saneamento de numPr e Sequenciamento de Listas (ENG-12)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("heading_guard_numbering");

  afterAll(() => {
    cleanup();
  });

  async function createDocxWithHeadingAndBody(filePath: string): Promise<void> {
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
  <Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`
    );
    zip.file(
      "word/numbering.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1">
    <w:multiLevelType w:val="multilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="1"/>
  </w:num>
</w:numbering>`
    );

    // Documento com título de seção em P1 e parágrafos descritivos em P2 e P3
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>ESTUDO TÉCNICO PRELIMINAR</w:t></w:r></w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:r><w:t>1. OBJETO DA CONTRATAÇÃO</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="1"/>
        </w:numPr>
      </w:pPr>
      <w:r><w:t>Aquisição de soluções legadas de tecnologia.</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>Detalhamento adicional da demanda.</w:t></w:r></w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:r><w:t>2. JUSTIFICATIVA DA CONTRATAÇÃO</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

    zip.file("word/document.xml", docXml);
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    writeFileSync(filePath, buf);
  }

  // --------------------------------------------------------------------------
  // 1. ENG-12a: Heading Guard em replace_paragraphs
  // --------------------------------------------------------------------------
  test("1. ENG-12a: replace_paragraphs com start_p apontando para título de seção preserva o título intacto", async () => {
    const rawDocx = resolve(tempDir, "doc_raw.docx");
    const templateDocx = resolve(tempDir, "doc_template.docx");
    const manifestPath = resolve(tempDir, "slots_manifest.json");

    await createDocxWithHeadingAndBody(rawDocx);

    // O agente aponta start_p: 1 (onde está "1. OBJETO DA CONTRATAÇÃO") até end_p: 3
    const manifest = {
      replace_paragraphs: [
        {
          start_p: 1,
          end_p: 3,
          tag: "objeto_detalhado",
        },
      ],
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const result = await buildDocxTemplate(rawDocx, manifestPath, templateDocx);
    expect(result.success).toBe(true);
    expect(result.breakdown.replace_paragraphs).toBe(1);

    // Inspeciona o word/document.xml resultante
    const zip = await JSZip.loadAsync(readFileSync(templateDocx));
    const xmlDoc = new DOMParser().parseFromString(
      await zip.file("word/document.xml")!.async("string"),
      "application/xml"
    );
    const paragraphs = getAllElements(xmlDoc, "w:p");

    // P0: "ESTUDO TÉCNICO PRELIMINAR"
    expect(extractParagraphText(paragraphs[0])).toContain("ESTUDO TÉCNICO PRELIMINAR");

    // P1: Título preservado intacto pelo Heading Guard!
    expect(extractParagraphText(paragraphs[1])).toBe("1. OBJETO DA CONTRATAÇÃO");

    // P2: Tag aplicada no corpo (antigo P2), e P3 foi expurgado
    expect(extractParagraphText(paragraphs[2])).toBe("{{objeto_detalhado}}");

    // P3: Agora é o antigo P4 "2. JUSTIFICATIVA DA CONTRATAÇÃO"
    expect(extractParagraphText(paragraphs[3])).toBe("2. JUSTIFICATIVA DA CONTRATAÇÃO");
  });

  // --------------------------------------------------------------------------
  // 2. ENG-12b: Expansão Multilinha, Descarte de Linhas Vazias e Limpeza de numPr
  // --------------------------------------------------------------------------
  test("2. ENG-12b: fill_docx_template descarta linhas vazias, remove numPr herdado de parágrafos comuns e aplica spacing", async () => {
    const templateDocx = resolve(tempDir, "doc_template.docx");
    const filledDocx = resolve(tempDir, "doc_filled.docx");
    const dataPath = resolve(tempDir, "slots_data.json");

    // Injeta texto discursivo multilinhas com quebras duplas "\n\n"
    const data = {
      objeto_detalhado:
        "Primeiro parágrafo discursivo da contratação.\n\nSegundo parágrafo discursivo detalhando serviços.",
    };
    writeFileSync(dataPath, JSON.stringify(data, null, 2));

    const fillResult = await fillDocxTemplate(templateDocx, dataPath, filledDocx);
    expect(fillResult.success).toBe(true);

    const zip = await JSZip.loadAsync(readFileSync(filledDocx));
    const xmlDoc = new DOMParser().parseFromString(
      await zip.file("word/document.xml")!.async("string"),
      "application/xml"
    );
    const paragraphs = getAllElements(xmlDoc, "w:p");

    // P1: "1. OBJETO DA CONTRATAÇÃO"
    expect(extractParagraphText(paragraphs[1])).toBe("1. OBJETO DA CONTRATAÇÃO");

    // P2: Primeiro parágrafo
    const p2Text = extractParagraphText(paragraphs[2]);
    expect(p2Text).toBe("Primeiro parágrafo discursivo da contratação.");
    // Garante que <w:numPr> herdado do template foi REMOVIDO
    expect(getDirectChildElements(paragraphs[2], "w:pPr")[0]).toBeDefined();
    expect(getAllElements(paragraphs[2], "w:numPr").length).toBe(0);
    // Garante espaçamento <w:spacing w:after="120"/>
    const p2Spacing = getAllElements(paragraphs[2], "w:spacing")[0];
    expect(p2Spacing).toBeDefined();
    expect(p2Spacing.getAttribute("w:after")).toBe("120");

    // P3: Segundo parágrafo (sem parágrafo vazio intermediário)
    const p3Text = extractParagraphText(paragraphs[3]);
    expect(p3Text).toBe("Segundo parágrafo discursivo detalhando serviços.");
    expect(getAllElements(paragraphs[3], "w:numPr").length).toBe(0);
    const p3Spacing = getAllElements(paragraphs[3], "w:spacing")[0];
    expect(p3Spacing).toBeDefined();
    expect(p3Spacing.getAttribute("w:after")).toBe("120");

    // P4: "2. JUSTIFICATIVA DA CONTRATAÇÃO"
    expect(extractParagraphText(paragraphs[4])).toBe("2. JUSTIFICATIVA DA CONTRATAÇÃO");
  });

  // --------------------------------------------------------------------------
  // 3. ENG-12c: Sequenciamento Estrito de Listas Decimais Simples (1. -> 2. -> 3.)
  // --------------------------------------------------------------------------
  test("3. ENG-12c: listas decimais simples consecutivas compartilham o mesmo numId", async () => {
    const templateDocx = resolve(tempDir, "doc_template.docx");
    const filledDocx = resolve(tempDir, "doc_filled_list.docx");
    const dataPath = resolve(tempDir, "slots_data_list.json");

    // Injeta 3 itens consecutivos de lista decimal simples
    const data = {
      objeto_detalhado:
        "1. Solução de infraestrutura em nuvem.\n2. Serviços de suporte técnico 24x7.\n3. Treinamento oficial da equipe.",
    };
    writeFileSync(dataPath, JSON.stringify(data, null, 2));

    const fillResult = await fillDocxTemplate(templateDocx, dataPath, filledDocx);
    expect(fillResult.success).toBe(true);

    const zip = await JSZip.loadAsync(readFileSync(filledDocx));
    const xmlDoc = new DOMParser().parseFromString(
      await zip.file("word/document.xml")!.async("string"),
      "application/xml"
    );
    const paragraphs = getAllElements(xmlDoc, "w:p");

    // P2, P3 e P4 são os itens da lista
    const item1 = paragraphs[2];
    const item2 = paragraphs[3];
    const item3 = paragraphs[4];

    expect(extractParagraphText(item1)).toContain("Solução de infraestrutura em nuvem.");
    expect(extractParagraphText(item2)).toContain("Serviços de suporte técnico 24x7.");
    expect(extractParagraphText(item3)).toContain("Treinamento oficial da equipe.");

    const numPr1 = getAllElements(item1, "w:numPr")[0];
    const numPr2 = getAllElements(item2, "w:numPr")[0];
    const numPr3 = getAllElements(item3, "w:numPr")[0];

    expect(numPr1).toBeDefined();
    expect(numPr2).toBeDefined();
    expect(numPr3).toBeDefined();

    const numId1 = getAllElements(numPr1, "w:numId")[0]?.getAttribute("w:val");
    const numId2 = getAllElements(numPr2, "w:numId")[0]?.getAttribute("w:val");
    const numId3 = getAllElements(numPr3, "w:numId")[0]?.getAttribute("w:val");

    // Devem compartilhar o mesmo numId permitindo progressão nativa contínua
    expect(numId1).toBeDefined();
    expect(numId2).toBe(numId1);
    expect(numId3).toBe(numId1);

    // Todos devem ter <w:spacing w:after="120"/>
    expect(getAllElements(item1, "w:spacing")[0]?.getAttribute("w:after")).toBe("120");
    expect(getAllElements(item2, "w:spacing")[0]?.getAttribute("w:after")).toBe("120");
    expect(getAllElements(item3, "w:spacing")[0]?.getAttribute("w:after")).toBe("120");
  });
});
