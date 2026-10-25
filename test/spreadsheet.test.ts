import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import {
  columnLetterToIndex,
  columnIndexToLetter,
  parseCellReference,
  parseCsvBuffer,
  parseXlsxBuffer,
} from "../src/parsers/spreadsheet.ts";
import { inspectDoc, formatInspectDocSyntheticResult } from "../src/tools/inspect.ts";
import { bootstrapCase, formatBootstrapCaseSyntheticResult } from "../src/tools/bootstrap.ts";

describe("Engenharia Tabular e Ingestão Nativa de Planilhas (.xlsx e .csv) — Marco 5.2a", () => {
  const tmpDir = resolve("./test/fixtures/tmp_spreadsheet_test");

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

  it("1. Conversão e indexação de colunas e referências de célula", () => {
    expect(columnLetterToIndex("A")).toBe(0);
    expect(columnLetterToIndex("B")).toBe(1);
    expect(columnLetterToIndex("Z")).toBe(25);
    expect(columnLetterToIndex("AA")).toBe(26);
    expect(columnLetterToIndex("AB")).toBe(27);

    expect(columnIndexToLetter(0)).toBe("A");
    expect(columnIndexToLetter(1)).toBe("B");
    expect(columnIndexToLetter(25)).toBe("Z");
    expect(columnIndexToLetter(26)).toBe("AA");

    expect(parseCellReference("A1")).toEqual({ colIndex: 0, rowIndex: 0 });
    expect(parseCellReference("C5")).toEqual({ colIndex: 2, rowIndex: 4 });
    expect(parseCellReference("AA10")).toEqual({ colIndex: 26, rowIndex: 9 });
  });

  it("2. parseCsvBuffer deve analisar CSV com delimitador ';' e ',' respeitando RFC 4180", () => {
    const csvContent = `Item;Descrição;Unid;Qtd;Valor Unitário;Valor Total
1;Notebook Corporativo;UN;10;R$ 4.500,00;R$ 45.000,00
2;Monitor 27 Polegadas;UN;5;R$ 1.200,00;R$ 6.000,00
`;
    const res = parseCsvBuffer(Buffer.from(csvContent, "utf-8"));
    expect(res.format).toBe("csv");
    expect(res.sheets.length).toBe(1);
    expect(res.totalRows).toBe(3);

    const table = res.tables[0];
    expect(table.rows[0].cells[0].text).toBe("Item");
    expect(table.rows[0].cells[4].text).toBe("Valor Unitário");
    expect(table.rows[1].cells[1].text).toBe("Notebook Corporativo");
    expect(table.rows[1].cells[5].text).toBe("R$ 45.000,00");
  });

  it("3. parseXlsxBuffer deve manter alinhamento exato de colunas por r='A1' mesmo com células intermediárias vazias", async () => {
    // Cria arquivo XLSX sintético em memória com células puladas (ex.: A1, B1, D1 - C1 vazia)
    const zip = new JSZip();

    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`
    );

    zip.file(
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`
    );

    zip.file(
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Planilha Orçamentária" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
    );

    zip.file(
      "xl/sharedStrings.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="6" uniqueCount="6">
  <si><t>Item</t></si>
  <si><t>Descrição</t></si>
  <si><t>Qtd</t></si>
  <si><t>Valor Unitário</t></si>
  <si><t>Valor Total</t></si>
  <si><t>Serviço de Suporte</t></si>
</sst>`
    );

    // Linha 1: A1=Item, B1=Descrição, C1=Qtd, D1=Valor Unitário, E1=Valor Total
    // Linha 2: A2="1", B2="Serviço de Suporte", C2=vazia (pulada no XML), D2=500.00, E2=1000.00
    // Linha 3: A3="2", B3="Licença de Software", C3="10", D3="200,00", E3="2.000,00"
    zip.file(
      "xl/worksheets/sheet1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
      <c r="D1" t="s"><v>3</v></c>
      <c r="E1" t="s"><v>4</v></c>
    </row>
    <row r="2">
      <c r="A2"><v>1</v></c>
      <c r="B2" t="s"><v>5</v></c>
      <!-- Note que C2 (Qtd) foi propositalmente omitida pelo Excel! -->
      <c r="D2"><v>500.00</v></c>
      <c r="E2"><v>1000.00</v></c>
    </row>
    <row r="3">
      <c r="A3"><v>2</v></c>
      <c r="B3" t="inlineStr"><is><t>Licença de Software</t></is></c>
      <c r="C3"><v>10</v></c>
      <c r="D3"><v>200,00</v></c>
      <c r="E3"><v>2.000,00</v></c>
    </row>
  </sheetData>
</worksheet>`
    );

    const xlsxBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const res = await parseXlsxBuffer(xlsxBuffer);

    expect(res.format).toBe("xlsx");
    expect(res.sheets.length).toBe(1);
    expect(res.sheets[0].name).toBe("Planilha Orçamentária");

    const table = res.tables[0];
    // Linha 2: célula C2 (índice 2) deve existir vazia, e D2 (índice 3) deve conter 500.00
    const row2 = table.rows[1];
    expect(row2.cells[0].text).toBe("1");
    expect(row2.cells[1].text).toBe("Serviço de Suporte");
    expect(row2.cells[2].text).toBe(""); // Preservada vazia sem deslocar!
    expect(row2.cells[3].text).toBe("500.00"); // Alinhada na coluna D!
    expect(row2.cells[4].text).toBe("1000.00"); // Alinhada na coluna E!

    // Linha 3: inlineStr test
    const row3 = table.rows[2];
    expect(row3.cells[1].text).toBe("Licença de Software");
    expect(row3.cells[2].text).toBe("10");
    expect(row3.cells[3].text).toBe("200,00");
    expect(row3.cells[4].text).toBe("2.000,00");
  });

  it("4. inspectDoc com arquivo .csv deve auditar matematicamente e gerar visao_auditoria e dossie_hotspots", async () => {
    const csvContent = `Item;Descrição;Qtd;Valor Unitário;Valor Total
1;Impressora Multifuncional;2;R$ 1.500,00;R$ 3.000,00
2;Toner Preto Extra;4;R$ 250,00;R$ 1.000,00
3;Cabo de Rede Cat6;10;R$ 50,00;R$ 900,00
`;
    // Note que Item 3: 10 x R$ 50,00 = R$ 500,00, mas o Total declarado é R$ 900,00 (MATH_ERROR proposital!)
    const csvPath = resolve(tmpDir, "planilha_orcamentaria.csv");
    const outStructurePath = resolve(tmpDir, "estrutura_planilha.json");
    writeFileSync(csvPath, csvContent, "utf-8");

    const full = await inspectDoc(csvPath, outStructurePath);
    expect(full.doc_type).toBe("csv");
    expect(full.tables.length).toBe(1);
    expect(full.budget_audit).toBeDefined();
    expect(full.budget_audit!.has_budget_table).toBe(true);
    expect(full.budget_audit!.math_errors_count).toBe(1); // Detectou Item 3!
    expect(full.budget_audit!.tables[0].items[2].has_error).toBe(true);
    expect(full.budget_audit!.tables[0].items[2].discrepancy_severity).toBe("MATH_ERROR");

    // Verifica gravação dos artefatos em disco
    expect(existsSync(outStructurePath)).toBe(true);
    const auditViewPath = resolve(tmpDir, "visao_auditoria_planilha.md");
    expect(existsSync(auditViewPath)).toBe(true);
    const auditMd = readFileSync(auditViewPath, "utf-8");
    expect(auditMd).toContain("MATH_ERROR");
    expect(auditMd).toContain("ERROS ARITMÉTICOS");

    // Valida teto MCP (< 900 bytes)
    const synthetic = formatInspectDocSyntheticResult(csvPath, outStructurePath, full);
    const payloadBytes = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(payloadBytes).toBeLessThan(900);
    expect(synthetic.doc_type).toBe("csv");
  });

  it("5. bootstrap_case deve inspecionar automaticamente planilha .csv em inputs/ e listar no indice mestre", async () => {
    const caseDir = resolve(tmpDir, "caso_planilha");
    const inputsDir = resolve(caseDir, "inputs");
    mkdirSync(inputsDir, { recursive: true });

    const csvContent = `Item;Descrição;Qtd;Valor Unitário;Valor Total
1;Serviço Especializado;100;R$ 120,00;R$ 12.000,00
`;
    writeFileSync(resolve(inputsDir, "01_Orcamento.csv"), csvContent, "utf-8");

    const res = await bootstrapCase(caseDir);
    expect(res.status).toBe("success");
    expect(res.inspectedDocx.length).toBe(1);
    expect(res.inspectedDocx[0].fileName).toBe("01_Orcamento.csv");

    const masterMd = readFileSync(res.indice_mestre_path!, "utf-8");
    expect(masterMd).toContain("01_Orcamento.csv");
    expect(masterMd).toContain("state/visao_auditoria_01_Orcamento.md");
    expect(masterMd).not.toContain("não inspecionado");

    const synthetic = formatBootstrapCaseSyntheticResult(res, "cases/teste_planilha");
    const bytes = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(bytes).toBeLessThan(900);
  });
});
