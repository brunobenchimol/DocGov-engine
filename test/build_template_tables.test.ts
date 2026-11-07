import { describe, test, expect, afterAll } from "bun:test";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildDocxTemplate,
  inspectDocx,
  processDocument,
} from "../src/index.ts";
import {
  MINIMAL_DOCX_BASE64,
  createSuiteTempDir,
} from "./helpers/fixtures.ts";

describe("Testes Unitários: build_docx_template (Tabelas Avançadas, Loops e Manipulação de Linhas)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("build_template_tables");

  afterAll(() => {
    cleanup();
  });

  test("ENG-01: loop_table_rows deve manter FOR e END-FOR estritamente na template_row_index, gerar 3 <w:tr> distintos, manter contagem exata de colunas (sem fusão 19->38) e preservar <w:vMerge/>", async () => {
    const rawDocx = resolve(tempDir, "eng01_raw.docx");
    const manifestFile = resolve(tempDir, "eng01_manifest.json");
    const tplDocx = resolve(tempDir, "eng01_tpl.docx");
    const stateFile = resolve(tempDir, "eng01_state.json");
    const finalDocx = resolve(tempDir, "eng01_final.docx");

    const zip = new (await import("jszip")).default();
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
    // Tabela:
    // Linha 0 (cabeçalho): C0 (gridSpan=2: "Especificação"), C1 ("Qtd"), C2 ("Unitário"), C3 ("Total") -> 4 células físicas, grade de 5
    // Linha 1 (template): C0 (vMerge continue), C1 ("Item Antigo"), C2 ("1"), C3 ("100"), C4 ("100") -> 5 células físicas
    // Linha 2 (linha antiga a remover): 5 células físicas
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Termo de Referência - ORGAO_A</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>Especificação</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Qtd</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Unitário</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Total</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:vMerge w:val="continue"/></w:tcPr><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Item Antigo</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>100</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>100</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:vMerge w:val="continue"/></w:tcPr><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Item Removível</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>2</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>200</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>400</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    );
    writeFileSync(rawDocx, await zip.generateAsync({ type: "nodebuffer" }));

    // Manifesto usando loop_table_rows
    writeFileSync(
      manifestFile,
      JSON.stringify(
        {
          loop_table_rows: [
            {
              table_index: 0,
              header_row_index: 0,
              template_row_index: 1,
              remove_from_row: 2,
              remove_to_row: 2,
              for_open_tag: "{{FOR item IN itens}}",
              for_close_tag: "{{END-FOR item}}",
              cell_tags: [
                "",
                "{{$item.desc}}",
                "{{$item.qtd}}",
                "{{$item.unit}}",
                "{{$item.total}}",
              ],
            },
          ],
        },
        null,
        2
      )
    );

    const buildRes = await buildDocxTemplate(rawDocx, manifestFile, tplDocx);
    expect(buildRes.success).toBe(true);

    // Inspeciona o XML do template gerado
    const tplZip = await (await import("jszip")).default.loadAsync(
      await (await import("node:fs")).promises.readFile(tplDocx)
    );
    const tplDocXml = await tplZip.file("word/document.xml")!.async("string");

    // Cabeçalho (R0) NUNCA deve conter {{FOR item IN
    const trBlocks = tplDocXml.split("</w:tr>");
    expect(trBlocks[0]).not.toContain("{{FOR item IN itens}}");
    // Template deve conter FOR e END-FOR isolados (fora do cabeçalho)
    expect(tplDocXml).toContain("{{FOR item IN itens}}");
    expect(tplDocXml).toContain("{{END-FOR item}}");

    // Preenche com 3 itens
    writeFileSync(
      stateFile,
      JSON.stringify(
        {
          itens: [
            { desc: "Item Alfa", qtd: "1", unit: "100", total: "100" },
            { desc: "Item Beta", qtd: "2", unit: "200", total: "400" },
            { desc: "Item Gama", qtd: "3", unit: "300", total: "900" },
          ],
        },
        null,
        2
      )
    );

    const fillRes = await processDocument(tplDocx, stateFile, finalDocx);
    expect(fillRes.success).toBe(true);

    const finalInsp = await inspectDocx(finalDocx);
    expect(finalInsp.tables.length).toBe(1);
    const finalTbl = finalInsp.tables[0];

    // 1. Foram gerados 3 elementos <w:tr> distintos para os 3 itens (+ 1 cabeçalho = 4 linhas)!
    expect(finalTbl.rows.length).toBe(4);

    // 2. Cada linha gerada possui exatamente 5 células físicas (<w:tc>), e NÃO 10 (zero fusão horizontal de colunas!)
    for (let r = 1; r <= 3; r++) {
      const physicalCells = finalTbl.rows[r].cells.filter((c) => !c.isSpanPlaceholder);
      expect(physicalCells.length).toBe(5);
      // 3. A célula C0 com <w:vMerge/> permaneceu com rowSpan continue e texto vazio
      expect(physicalCells[0].rowSpan).toBe("continue");
      expect(physicalCells[0].text.trim()).toBe("");
    }

    // Conteúdo dos itens injetados
    expect(finalTbl.rows[1].cells[1].text).toBe("Item Alfa");
    expect(finalTbl.rows[2].cells[1].text).toBe("Item Beta");
    expect(finalTbl.rows[3].cells[1].text).toBe("Item Gama");
  });

  test("ENG-02b: replace_table_cells deve mapear coordenada virtual deslocada por gridSpan para a célula física correta", async () => {
    const rawDocx = resolve(tempDir, "eng02b_raw.docx");
    const manifestFile = resolve(tempDir, "eng02b_manifest.json");
    const tplDocx = resolve(tempDir, "eng02b_tpl.docx");
    const stateFile = resolve(tempDir, "eng02b_state.json");
    const finalDocx = resolve(tempDir, "eng02b_final.docx");

    const zip = new (await import("jszip")).default();
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
    // Linha 0: C0 com gridSpan=3 ("Processo:"), C1 ("2026/001"). Físico: 2 células. Virtual: C0..C2 e C3.
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:tbl>
      <w:tr>
        <w:tc><w:tcPr><w:gridSpan w:val="3"/></w:tcPr><w:p><w:r><w:t>Processo Administrativo:</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>2026/001</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    );
    writeFileSync(rawDocx, await zip.generateAsync({ type: "nodebuffer" }));

    // Manifesto fornecendo coordenada virtual T0.R0.C3 (onde só existem 2 células físicas, 0 e 1)
    writeFileSync(
      manifestFile,
      JSON.stringify(
        {
          replace_table_cells: [
            {
              table_index: 0,
              row_index: 0,
              cell_index: 3, // virtual
              tag: "{{numero_processo}}",
            },
          ],
        },
        null,
        2
      )
    );

    const buildRes = await buildDocxTemplate(rawDocx, manifestFile, tplDocx);
    expect(buildRes.success).toBe(true);
    expect(buildRes.applied_slots_count).toBe(1);

    writeFileSync(
      stateFile,
      JSON.stringify({ numero_processo: "PROC-9988/2026" }, null, 2)
    );
    await processDocument(tplDocx, stateFile, finalDocx);

    const insp = await inspectDocx(finalDocx);
    // A célula física 1 recebeu o valor injetado
    const physCells = insp.tables[0].rows[0].cells.filter(
      (c) => !c.isSpanPlaceholder
    );
    expect(physCells[1].text).toContain("PROC-9988/2026");
  });

  test("ENG-02c: loop_table_rows deve emitir Fail-Fast se cell_tags exceder contagem de células físicas e auto-alinhar se C0 for vMerge", async () => {
    const rawDocx = resolve(tempDir, "eng02c_raw.docx");
    const invalidManifest = resolve(tempDir, "eng02c_invalid_manifest.json");
    const autoAlignManifest = resolve(tempDir, "eng02c_align_manifest.json");
    const outDocx = resolve(tempDir, "eng02c_out.docx");

    const zip = new (await import("jszip")).default();
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
    // Tabela com linha 1 tendo 3 células físicas (C0 com vMerge continue, C1 e C2)
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Cabeçalho</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Col1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Col2</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:vMerge w:val="continue"/></w:tcPr><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Dado 1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Dado 2</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    );
    writeFileSync(rawDocx, await zip.generateAsync({ type: "nodebuffer" }));

    // Caso 1: Forneceu 4 tags para uma linha com 3 células físicas -> Fail-Fast
    writeFileSync(
      invalidManifest,
      JSON.stringify(
        {
          loop_table_rows: [
            {
              table_index: 0,
              header_row_index: 0,
              template_row_index: 1,
              for_open_tag: "{{FOR item IN itens}}",
              for_close_tag: "{{END-FOR item}}",
              cell_tags: ["t1", "t2", "t3", "t4"],
            },
          ],
        },
        null,
        2
      )
    );

    let errExceed: any;
    try {
      await buildDocxTemplate(rawDocx, invalidManifest, outDocx);
    } catch (e: any) {
      errExceed = e;
    }
    expect(errExceed).toBeDefined();
    expect(errExceed.message).toContain("foram fornecidas 4 tag(s)");
    expect(errExceed.message).toContain("possui apenas 3 célula(s) física(s)");
    expect(errExceed.message).toContain("NÃO faça leituras exploratórias no repositório");

    // Caso 2: Forneceu exatamente as 2 tags de dados (omitindo C0 vMerge) -> Auto-alinhamento
    writeFileSync(
      autoAlignManifest,
      JSON.stringify(
        {
          loop_table_rows: [
            {
              table_index: 0,
              header_row_index: 0,
              template_row_index: 1,
              for_open_tag: "{{FOR item IN itens}}",
              for_close_tag: "{{END-FOR item}}",
              cell_tags: ["{{$item.c1}}", "{{$item.c2}}"],
            },
          ],
        },
        null,
        2
      )
    );

    const alignRes = await buildDocxTemplate(
      rawDocx,
      autoAlignManifest,
      outDocx
    );
    expect(alignRes.success).toBe(true);
    expect(alignRes.applied_slots_count).toBe(1);
  });

  test("ENG-07a: remove_table_rows deve remover linhas excedentes em ordem Bottom-Up após replace_table_cells preservando <w:vMerge/>", async () => {
    const rawDocx = resolve(tempDir, "eng07a_raw.docx");
    const manifestJson = resolve(tempDir, "eng07a_manifest.json");
    const outDocx = resolve(tempDir, "eng07a_tpl.docx");

    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(Buffer.from(MINIMAL_DOCX_BASE64, "base64"));

    const buildItemRowXml = (itemNum: number, isRestart: boolean, groupLabel: string, desc: string) => `
      <w:tr>
        <w:tc>
          <w:tcPr><w:vMerge${isRestart ? ' w:val="restart"' : ""}/></w:tcPr>
          <w:p><w:r><w:t>${isRestart ? groupLabel : ""}</w:t></w:r></w:p>
        </w:tc>
        <w:tc><w:p><w:r><w:t>${itemNum}</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${desc}</w:t></w:r></w:p></w:tc>
      </w:tr>`;

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Seção</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Item</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Descrição</w:t></w:r></w:p></w:tc>
      </w:tr>
      ${buildItemRowXml(1, true, "1.1 Quadro Resumo", "Item Doador 1")}
      ${buildItemRowXml(2, false, "", "Item Doador 2")}
      ${buildItemRowXml(3, false, "", "Item Doador 3")}
      ${buildItemRowXml(4, false, "", "Item Doador 4 Excedente")}
      ${buildItemRowXml(5, false, "", "Item Doador 5 Excedente")}
      <w:tr>
        <w:tc><w:p><w:r><w:t>Seção 2</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Item</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Especificação</w:t></w:r></w:p></w:tc>
      </w:tr>
      ${buildItemRowXml(1, true, "2.1 Bens e Serviços", "Espec Doador 1")}
      ${buildItemRowXml(2, false, "", "Espec Doador 2")}
      ${buildItemRowXml(3, false, "", "Espec Doador 3 Excedente")}
      ${buildItemRowXml(4, false, "", "Espec Doador 4 Excedente")}
    </w:tbl>
  </w:body>
</w:document>`;

    zip.file("word/document.xml", docXml);
    writeFileSync(rawDocx, await zip.generateAsync({ type: "nodebuffer" }));

    writeFileSync(
      manifestJson,
      JSON.stringify(
        {
          replace_table_cells: [
            { table_index: 0, row_index: 1, cell_index: 2, tag: "{{sub1.item1}}" },
            { table_index: 0, row_index: 2, cell_index: 2, tag: "{{sub1.item2}}" },
            { table_index: 0, row_index: 7, cell_index: 2, tag: "{{sub2.item1}}" },
            { table_index: 0, row_index: 8, cell_index: 2, tag: "{{sub2.item2}}" },
          ],
          remove_table_rows: [
            { table_index: 0, from_row: 3, to_row: 5 },
            { table_index: 0, from_row: 9, to_row: 10 },
          ],
        },
        null,
        2
      ),
      "utf-8"
    );

    const buildRes = await buildDocxTemplate(rawDocx, manifestJson, outDocx);
    expect(buildRes.success).toBe(true);
    expect(buildRes.breakdown.replace_table_cells).toBe(4);
    expect(buildRes.breakdown.remove_table_rows).toBe(2);

    const insp = await inspectDocx(outDocx);
    expect(insp.tables.length).toBe(1);
    const tbl = insp.tables[0];
    expect(tbl.rows.length).toBe(6);

    expect(tbl.rows[1].cells[0].rowSpan).toBe("restart");
    expect(tbl.rows[1].cells[0].text).toBe("1.1 Quadro Resumo");
    expect(tbl.rows[1].cells[2].text).toBe("{{sub1.item1}}");
    expect(tbl.rows[2].cells[0].rowSpan).toBe("continue");
    expect(tbl.rows[2].cells[2].text).toBe("{{sub1.item2}}");

    expect(tbl.rows[4].cells[0].rowSpan).toBe("restart");
    expect(tbl.rows[4].cells[0].text).toBe("2.1 Bens e Serviços");
    expect(tbl.rows[4].cells[2].text).toBe("{{sub2.item1}}");
    expect(tbl.rows[5].cells[0].rowSpan).toBe("continue");
    expect(tbl.rows[5].cells[2].text).toBe("{{sub2.item2}}");
  });
});
