import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { runCli } from "../src/cli/index.ts";
import { EXACT_COPY_PASTE_TECHNICAL_NOTE_SNIPPET } from "../src/contracts/errors.ts";

describe("Orquestrador Multi-Arquivo e Flags CLI (Marco 6.2 — v1.3.0)", () => {
  const tmpDir = resolve("./test/fixtures/tmp_diff_cli_test");

  beforeEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  async function createSimpleDocx(textParagraphs: string[]): Promise<Buffer> {
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

    const bodyXml = textParagraphs
      .map(
        (t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
      )
      .join("");

    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`
    );

    return await zip.generateAsync({ type: "nodebuffer" });
  }

  it("1. CLI deve exibir --diff-report e --generate-technical-note no --help", async () => {
    let output = "";
    const originalLog = console.log;
    console.log = (msg?: any) => {
      output += String(msg) + "\n";
    };

    try {
      await runCli(["--help"]);
      expect(output).toContain("--diff-report");
      expect(output).toContain("--generate-technical-note");
    } finally {
      console.log = originalLog;
    }
  });

  it("2. CLI --diff-report deve orquestrar comparação entre dois arquivos e gerar Nota Técnica DOCX", async () => {
    const docOldPath = resolve(tmpDir, "Minuta_v1.docx");
    const docNewPath = resolve(tmpDir, "Minuta_v2.docx");
    const outDocxPath = resolve(tmpDir, "Nota_Tecnica_Comparativa.docx");

    const bufOld = await createSimpleDocx([
      "1. OBJETO DA CONTRATAÇÃO",
      "Aquisição de equipamentos de tecnologia da informação.",
      "Prazo de entrega de 10 dias corridos sob pena de rescisão contratual.",
    ]);
    const bufNew = await createSimpleDocx([
      "1. OBJETO DA CONTRATAÇÃO",
      "Aquisição de equipamentos de tecnologia da informação e comunicação.",
      "Prazo de entrega de até 30 dias úteis admitida prorrogação nos termos da lei.",
    ]);

    writeFileSync(docOldPath, bufOld);
    writeFileSync(docNewPath, bufNew);

    await runCli([
      "--diff-report",
      "--old",
      docOldPath,
      "--new",
      docNewPath,
      "--out",
      outDocxPath,
    ]);

    expect(existsSync(outDocxPath)).toBe(true);
  });

  it("3. CLI --generate-technical-note deve gerar Nota Técnica formal a partir de JSON", async () => {
    const jsonPath = resolve(tmpDir, "nota.json");
    const outDocxPath = resolve(tmpDir, "Nota_Tecnica_Direta.docx");

    writeFileSync(jsonPath, EXACT_COPY_PASTE_TECHNICAL_NOTE_SNIPPET, "utf-8");

    await runCli([
      "--generate-technical-note",
      "--note-json",
      jsonPath,
      "--out",
      outDocxPath,
    ]);

    expect(existsSync(outDocxPath)).toBe(true);
  });
});
