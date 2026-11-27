import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import {
  processDocument,
  formatFillDocxTemplateSyntheticResult,
} from "../src/index.ts";
import {
  insertHighlightInRPr,
  buildStyledRunProperties,
} from "../src/tools/openxml/rich_text_highlight.ts";
import { injectDocxCommentsIntoBuffer } from "../src/tools/openxml/docx_comments_injector.ts";
import { getAllElements, getDirectChildElements, sanitizeXmlString } from "../src/utils/xml.ts";
import { createSuiteTempDir } from "./helpers/fixtures.ts";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

async function buildCustomTemplateDocx(
  paragraphsXml: string,
  extraParts?: {
    numberingXml?: string;
    commentsXml?: string;
    extraRelsXml?: string;
    extraContentTypesXml?: string;
    tablesXml?: string;
  }
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  ${extraParts?.numberingXml ? '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' : ""}
  ${extraParts?.extraContentTypesXml ?? ""}
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${REL_NS}">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${REL_NS}">
  ${extraParts?.numberingXml ? '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' : ""}
  ${extraParts?.extraRelsXml ?? ""}
</Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}">
  <w:body>
    ${paragraphsXml}
    ${extraParts?.tablesXml ?? ""}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>
  </w:body>
</w:document>`
  );
  if (extraParts?.numberingXml) zip.file("word/numbering.xml", extraParts.numberingXml);
  if (extraParts?.commentsXml) zip.file("word/comments.xml", extraParts.commentsXml);
  return await zip.generateAsync({ type: "nodebuffer" });
}

describe("Testes Unitários: Feature A (Highlight CT_RPr) & Feature B (word/comments.xml)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("fill_highlight_comments");
  let parser: DOMParser;

  beforeAll(() => {
    parser = new DOMParser();
  });

  afterAll(() => {
    cleanup();
  });

  test("1. Auto-highlight [A DEFINIR]/[INSERIR] com e sem backticks, preservando rFonts/sz/i", async () => {
    const tplBuf = await buildCustomTemplateDocx(`
      <w:p>
        <w:r>
          <w:rPr><w:rFonts w:ascii="Calibri"/><w:i/><w:sz w:val="22"/></w:rPr>
          <w:t>{{texto_pendencias}}</w:t>
        </w:r>
      </w:p>
    `);
    const tplPath = resolve(tempDir, "t1.docx");
    const stPath = resolve(tempDir, "s1.json");
    const outPath = resolve(tempDir, "o1.docx");
    writeFileSync(tplPath, tplBuf);
    writeFileSync(
      stPath,
      JSON.stringify({
        texto_pendencias:
          "Órgão: ORGAO_CONTRATANTE — Valor: `[A DEFINIR: estimativa]` e prazo [INSERIR: dias úteis].",
      })
    );

    const res = await processDocument(tplPath, stPath, outPath);
    expect(res.success).toBe(true);

    const outZip = await JSZip.loadAsync(readFileSync(outPath));
    const docXml = parser.parseFromString(
      sanitizeXmlString(await outZip.file("word/document.xml")!.async("string")),
      "application/xml"
    );
    const runs = getAllElements(docXml, "w:r");
    const fullText = runs
      .map((r) => getDirectChildElements(r, "w:t").map((t) => t.textContent ?? "").join(""))
      .join("");

    expect(fullText).not.toContain("`");
    expect(fullText).toContain("[A DEFINIR: estimativa]");
    expect(fullText).toContain("[INSERIR: dias úteis]");

    const highlightedRuns = runs.filter((r) => {
      const rPr = getDirectChildElements(r, "w:rPr")[0];
      return rPr && getDirectChildElements(rPr, "w:highlight").length > 0;
    });
    expect(highlightedRuns.length).toBe(2);
    for (const r of highlightedRuns) {
      const rPr = getDirectChildElements(r, "w:rPr")[0];
      expect(getDirectChildElements(rPr, "w:highlight")[0].getAttribute("w:val")).toBe("yellow");
      expect(getDirectChildElements(rPr, "w:rFonts").length).toBe(1);
      expect(getDirectChildElements(rPr, "w:sz")[0].getAttribute("w:val")).toBe("22");
      expect(getDirectChildElements(rPr, "w:i").length).toBe(1);
    }
  });

  test("2. highlightPlaceholders: false desabilita auto-highlight mas mantém ==texto==", async () => {
    const tplBuf = await buildCustomTemplateDocx(
      `<w:p><w:r><w:t>{{conteudo}}</w:t></w:r></w:p>`
    );
    const tplPath = resolve(tempDir, "t2.docx");
    const stPath = resolve(tempDir, "s2.json");
    const outPath = resolve(tempDir, "o2.docx");
    writeFileSync(tplPath, tplBuf);
    writeFileSync(
      stPath,
      JSON.stringify({
        conteudo: "Trecho `[A DEFINIR: X]` sem amarelo e ==trecho marcado== com amarelo.",
      })
    );

    await processDocument(tplPath, stPath, outPath, {
      highlightPlaceholders: false,
      autoInspect: false,
    });

    const outZip = await JSZip.loadAsync(readFileSync(outPath));
    const docXml = parser.parseFromString(
      sanitizeXmlString(await outZip.file("word/document.xml")!.async("string")),
      "application/xml"
    );
    const runs = getAllElements(docXml, "w:r");
    const hlTexts = runs
      .filter((r) => getAllElements(r, "w:highlight").length > 0)
      .map((r) => getAllElements(r, "w:t").map((t) => t.textContent ?? "").join(""));

    expect(hlTexts).toEqual(["trecho marcado"]);
    const allText = runs.map((r) => getAllElements(r, "w:t").map((t) => t.textContent ?? "").join("")).join("");
    expect(allText).toContain("`[A DEFINIR: X]`");
  });

  test("3. Sintaxe ==[cor]texto== com cores válidas e fallback seguro para yellow", async () => {
    const tplBuf = await buildCustomTemplateDocx(
      `<w:p><w:r><w:t>{{cores}}</w:t></w:r></w:p>`
    );
    const tplPath = resolve(tempDir, "t3.docx");
    const stPath = resolve(tempDir, "s3.json");
    const outPath = resolve(tempDir, "o3.docx");
    writeFileSync(tplPath, tplBuf);
    writeFileSync(
      stPath,
      JSON.stringify({
        cores: "==[green]verde== ==[darkblue]azul== ==[roxo]inv1== ==[#FF0000]inv2== ==padrao==",
      })
    );

    await processDocument(tplPath, stPath, outPath, { autoInspect: false });
    const outZip = await JSZip.loadAsync(readFileSync(outPath));
    const docXml = parser.parseFromString(
      sanitizeXmlString(await outZip.file("word/document.xml")!.async("string")),
      "application/xml"
    );
    const hlPairs = getAllElements(docXml, "w:r")
      .filter((r) => getAllElements(r, "w:highlight").length > 0)
      .map((r) => ({
        text: getAllElements(r, "w:t").map((t) => t.textContent ?? "").join(""),
        val: getAllElements(r, "w:highlight")[0].getAttribute("w:val"),
      }));

    expect(hlPairs).toEqual([
      { text: "verde", val: "green" },
      { text: "azul", val: "darkBlue" },
      { text: "inv1", val: "yellow" },
      { text: "inv2", val: "yellow" },
      { text: "padrao", val: "yellow" },
    ]);
  });

  test("4. Ordem estrita CT_RPr (ISO/IEC 29500-1): <w:highlight> após szCs e antes de u/bdr/shd/vertAlign", () => {
    const doc = parser.parseFromString(
      `<w:document xmlns:w="${W_NS}"><w:rPr>` +
        `<w:rFonts w:ascii="Arial"/>` +
        `<w:color w:val="111111"/>` +
        `<w:sz w:val="24"/>` +
        `<w:szCs w:val="24"/>` +
        `<w:u w:val="single"/>` +
        `<w:bdr w:val="single"/>` +
        `<w:shd w:val="clear"/>` +
        `<w:vertAlign w:val="superscript"/>` +
        `</w:rPr></w:document>`,
      "application/xml"
    );
    const baseRPr = getAllElements(doc, "w:rPr")[0];
    const styled = buildStyledRunProperties(doc, baseRPr, {
      bold: true,
      highlightColor: "cyan",
    })!;
    const childOrder = getDirectChildElements(styled).map((el) => el.nodeName);

    expect(childOrder).toEqual([
      "w:rFonts",
      "w:b",
      "w:bCs",
      "w:color",
      "w:sz",
      "w:szCs",
      "w:highlight",
      "w:u",
      "w:bdr",
      "w:shd",
      "w:vertAlign",
    ]);

    const onlyHl = insertHighlightInRPr(doc, baseRPr, "green");
    const hlOrder = getDirectChildElements(onlyHl).map((el) => el.nodeName);
    expect(hlOrder.indexOf("w:highlight")).toBeGreaterThan(hlOrder.indexOf("w:szCs"));
    expect(hlOrder.indexOf("w:highlight")).toBeLessThan(hlOrder.indexOf("w:u"));
  });

  test("5. Comentários em template limpo: word/comments.xml, [Content_Types].xml, .rels, escape XML e mesmo <w:p>", async () => {
    const tplBuf = await buildCustomTemplateDocx(
      `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:t>{{clausula}}</w:t></w:r></w:p>`
    );
    const tplPath = resolve(tempDir, "t5.docx");
    const stPath = resolve(tempDir, "s5.json");
    const outPath = resolve(tempDir, "o5.docx");
    writeFileSync(tplPath, tplBuf);
    writeFileSync(
      stPath,
      JSON.stringify({
        clausula: "O MUNICIPIO_GENERICO definirá o prazo contratual de 12 meses.",
      })
    );

    const res = await processDocument(tplPath, stPath, outPath, {
      comments: [
        {
          slot_key: "clausula",
          anchor_text: "prazo contratual de 12 meses",
          author: "Auditor <TCU>",
          text: "Validar vigência & cronograma > Art. 105.",
        },
      ],
    });

    expect(res.comments_count).toBe(1);
    expect(res.comments_unmatched).toBeUndefined();

    const outZip = await JSZip.loadAsync(readFileSync(outPath));
    const commentsXml = await outZip.file("word/comments.xml")!.async("string");
    expect(commentsXml).toContain('w:id="1"');
    expect(commentsXml).toContain("Validar vigência &amp; cronograma &gt; Art. 105.");

    const ctXml = await outZip.file("[Content_Types].xml")!.async("string");
    expect(ctXml).toContain("/word/comments.xml");
    const relsXml = await outZip.file("word/_rels/document.xml.rels")!.async("string");
    expect(relsXml).toContain('Target="comments.xml"');

    const docXml = parser.parseFromString(
      sanitizeXmlString(await outZip.file("word/document.xml")!.async("string")),
      "application/xml"
    );
    const p = getAllElements(docXml, "w:p")[0];
    const pChildren = getDirectChildElements(p).map((e) => e.nodeName);
    expect(pChildren[0]).toBe("w:pPr");
    const startIdx = pChildren.indexOf("w:commentRangeStart");
    const endIdx = pChildren.indexOf("w:commentRangeEnd");
    expect(startIdx).toBeGreaterThan(0);
    expect(endIdx).toBeGreaterThan(startIdx);
    expect(getAllElements(p, "w:commentReference").length).toBe(1);
  });

  test("6. Template com comentários prévios (w:id=4 -> w:id=5) sem duplicar Override/Relationship", async () => {
    const donorComments = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="${W_NS}">
  <w:comment w:id="4" w:author="Doador" w:date="2026-01-01T00:00:00Z" w:initials="DO">
    <w:p><w:r><w:t>Comentário prévio do doador</w:t></w:r></w:p>
  </w:comment>
</w:comments>`;
    const tplBuf = await buildCustomTemplateDocx(
      `<w:p><w:commentRangeStart w:id="4"/><w:r><w:t>Texto prévio</w:t></w:r><w:commentRangeEnd w:id="4"/><w:r><w:commentReference w:id="4"/></w:r></w:p>
       <w:p><w:r><w:t>{{nova_clausula}}</w:t></w:r></w:p>`,
      {
        commentsXml: donorComments,
        extraContentTypesXml:
          '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>',
        extraRelsXml:
          '<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>',
      }
    );
    const tplPath = resolve(tempDir, "t6.docx");
    const stPath = resolve(tempDir, "s6.json");
    const outPath = resolve(tempDir, "o6.docx");
    writeFileSync(tplPath, tplBuf);
    writeFileSync(stPath, JSON.stringify({ nova_clausula: "Cláusula de garantia contratual." }));

    const res = await processDocument(tplPath, stPath, outPath, {
      comments: [{ anchor_text: "garantia contratual", text: "Exigir até 5%." }],
      autoInspect: false,
    });

    expect(res.comments_count).toBe(2);
    const outZip = await JSZip.loadAsync(readFileSync(outPath));
    const commentsDoc = parser.parseFromString(
      sanitizeXmlString(await outZip.file("word/comments.xml")!.async("string")),
      "application/xml"
    );
    const ids = getAllElements(commentsDoc, "w:comment").map((c) => c.getAttribute("w:id"));
    expect(ids).toEqual(["4", "5"]);

    const ctXml = await outZip.file("[Content_Types].xml")!.async("string");
    expect(ctXml.match(/\/word\/comments\.xml/g)?.length).toBe(1);
    const relsXml = await outZip.file("word/_rels/document.xml.rels")!.async("string");
    expect(relsXml.match(/Target="comments\.xml"/g)?.length).toBe(1);
  });

  test("7. anchor_text dividido em múltiplos <w:r>, slot_key com Markdown e fusão comments + _comments", async () => {
    const rawBuf = await buildCustomTemplateDocx(
      `<w:p><w:r><w:t>O valor </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>estimado global</w:t></w:r><w:r><w:t> será apurado.</w:t></w:r></w:p>`
    );
    const injected = await injectDocxCommentsIntoBuffer(
      rawBuf,
      [{ anchor_text: "valor estimado global será", text: "Dividido entre 3 runs." }]
    );
    expect(injected.commentsCount).toBe(1);
    expect(injected.unmatched).toEqual([]);

    const tplBuf = await buildCustomTemplateDocx(
      `<w:p><w:r><w:t>{{objeto}}</w:t></w:r></w:p>
       <w:p><w:r><w:t>{{justificativa}}</w:t></w:r></w:p>`
    );
    const tplPath = resolve(tempDir, "t7.docx");
    const stPath = resolve(tempDir, "s7.json");
    const outPath = resolve(tempDir, "o7.docx");
    writeFileSync(tplPath, tplBuf);
    writeFileSync(
      stPath,
      JSON.stringify({
        objeto: "**Contratação de serviço** para ==ORGAO_CONTRATANTE== `[A DEFINIR]`.",
        justificativa: "Necessidade contínua comprovada.",
        _comments: [
          {
            slot_key: "objeto",
            anchor_text: "serviço para ORGAO_CONTRATANTE",
            text: "Veio de _comments.",
          },
        ],
      })
    );

    const res = await processDocument(tplPath, stPath, outPath, {
      comments: [
        {
          slot_key: "justificativa",
          anchor_text: "Necessidade contínua",
          text: "Veio de options.comments.",
        },
      ],
    });
    expect(res.comments_count).toBe(2);
    expect(res.comments_unmatched).toBeUndefined();
  });

  test("8. anchor_text não encontrado (comments_unmatched) é fail-safe e respeita SUMMARY < 1024 B", async () => {
    const tplBuf = await buildCustomTemplateDocx(
      `<w:p><w:r><w:t>{{texto}}</w:t></w:r></w:p>`
    );
    const tplPath = resolve(tempDir, "t8.docx");
    const stPath = resolve(tempDir, "s8.json");
    const outPath = resolve(tempDir, "o8.docx");
    writeFileSync(tplPath, tplBuf);
    writeFileSync(stPath, JSON.stringify({ texto: "Parágrafo único do termo." }));

    const manyUnmatched = Array.from({ length: 20 }, (_, i) => ({
      anchor_text: `TRECHO_INEXISTENTE_LONGO_PARA_ESTRESSE_${i}_ABCDEFGHIJKLMN`,
      text: "Nota de revisão.",
    }));

    const res = await processDocument(tplPath, stPath, outPath, {
      comments: manyUnmatched,
    });
    expect(res.success).toBe(true);
    expect(res.comments_unmatched?.length).toBe(20);

    const synthetic = formatFillDocxTemplateSyntheticResult(res, tempDir);
    const jsonBytes = Buffer.byteLength(JSON.stringify(synthetic), "utf-8");
    expect(jsonBytes).toBeLessThan(1024);
    expect(synthetic.comments_unmatched).toBeDefined();

    const auditMd = readFileSync(res.visao_auditoria_path!, "utf-8");
    expect(auditMd).toContain("TRECHO_INEXISTENTE_LONGO_PARA_ESTRESSE_19_ABCDEFGHIJKLMN");
  });

  test("9. Preservação de <w:tbl>/<w:numPr> e visao_auditoria_*.md sem poluição nem falsos alertas", async () => {
    const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W_NS}">
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;
    const tplBuf = await buildCustomTemplateDocx(
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>1. OBJETO</w:t></w:r></w:p>
       <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>{{item_lista}}</w:t></w:r></w:p>`,
      {
        numberingXml,
        tablesXml: `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Descrição</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>{{celula}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`,
      }
    );
    const tplPath = resolve(tempDir, "t9.docx");
    const stPath = resolve(tempDir, "s9.json");
    const outPath = resolve(tempDir, "o9.docx");
    writeFileSync(tplPath, tplBuf);
    writeFileSync(
      stPath,
      JSON.stringify({
        item_lista: "Subitem de lista com [A DEFINIR: detalhe].",
        celula: "Entrega em 10 dias para ORGAO_CONTRATANTE.",
        _comments: [
          { anchor_text: "Entrega em 10 dias", text: "Conferir prazo de SLA." },
        ],
      })
    );

    const res = await processDocument(tplPath, stPath, outPath);
    const outZip = await JSZip.loadAsync(readFileSync(outPath));
    const docXml = parser.parseFromString(
      sanitizeXmlString(await outZip.file("word/document.xml")!.async("string")),
      "application/xml"
    );
    expect(getAllElements(docXml, "w:tbl").length).toBe(1);
    expect(getAllElements(docXml, "w:numPr").length).toBe(1);

    const auditMd = readFileSync(res.visao_auditoria_path!, "utf-8");
    expect(auditMd).toContain("Comentários nativos (word/comments.xml): 1");
    expect(auditMd).toContain("**[P1]** 1. Subitem de lista com [A DEFINIR: detalhe].");
    expect(auditMd).toContain("[T0.R0.C1] Entrega em 10 dias para ORGAO_CONTRATANTE.");
    expect(auditMd).not.toContain("⚠️ ALERTAS DE INTEGRIDADE PÓS-COMPILAÇÃO");
  });
});
