import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { inspectDoc } from "../src/tools/inspect.ts";
import { auditDocumentBudget } from "../src/core/budget_auditor.ts";
import type { PdfLineItem } from "../src/types/index.ts";

describe("Engenharia Tabular Avançada: Fusão Multi-Página, Multilinha e rowspan/colspan (Marco 5.2b)", () => {
  const tmpDir = resolve("./test/fixtures/tmp_tables_test");

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

  it("1. DOCX com w:gridSpan (colspan) deve normalizar colunas subsequentes sem deslocar valores orçamentários", async () => {
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

    // Tabela com linha de cabeçalho mesclada: Célula 0 ocupa 2 colunas (Item + Descrição) via gridSpan="2"
    // e depois Qtd, Unit, Total.
    // Linha de dados: Item, Descrição, Qtd, Unit, Total (5 colunas)
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Termo de Referência</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc>
          <w:tcPr><w:gridSpan w:val="2"/></w:tcPr>
          <w:p><w:r><w:t>Item e Descrição Detalhada</w:t></w:r></w:p>
        </w:tc>
        <w:tc><w:p><w:r><w:t>Qtd</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Valor Unitário</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Valor Total</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Servidor de Aplicação</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>2</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>R$ 15.000,00</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>R$ 30.000,00</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    );

    const docxBuf = await zip.generateAsync({ type: "nodebuffer" });
    const docxPath = resolve(tmpDir, "tabela_gridspan.docx");
    const outPath = resolve(tmpDir, "estrutura_gridspan.json");
    writeFileSync(docxPath, docxBuf);

    const res = await inspectDoc(docxPath, outPath);
    expect(res.tables.length).toBe(1);

    // Linha 0 deve ter célula 0 com colSpan: 2 e placeholder na coluna 1
    const row0 = res.tables[0].rows[0];
    expect(row0.cells[0].colSpan).toBe(2);
    expect(row0.cells[1].isSpanPlaceholder).toBe(true);
    expect(row0.cells[2].text).toBe("Qtd"); // Coluna 2 corretamente alinhada com Qtd!
    expect(row0.cells[3].text).toBe("Valor Unitário");
    expect(row0.cells[4].text).toBe("Valor Total");

    // Linha 1 de dados (5 células)
    const row1 = res.tables[0].rows[1];
    expect(row1.cells[0].text).toBe("1");
    expect(row1.cells[2].text).toBe("2");
    expect(row1.cells[3].text).toBe("R$ 15.000,00");
    expect(row1.cells[4].text).toBe("R$ 30.000,00");
  });

  it("2. DOCX com w:vMerge (rowspan) deve propagar texto da célula mesclada verticalmente", async () => {
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
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Lote</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Item</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Descrição</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:vMerge w:val="restart"/></w:tcPr>
          <w:p><w:r><w:t>Lote 01</w:t></w:r></w:p>
        </w:tc>
        <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Item A</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:vMerge w:val="continue"/></w:tcPr>
          <w:p/>
        </w:tc>
        <w:tc><w:p><w:r><w:t>2</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Item B</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    );

    const docxBuf = await zip.generateAsync({ type: "nodebuffer" });
    const docxPath = resolve(tmpDir, "tabela_vmerge.docx");
    const outPath = resolve(tmpDir, "estrutura_vmerge.json");
    writeFileSync(docxPath, docxBuf);

    const res = await inspectDoc(docxPath, outPath);
    expect(res.tables.length).toBe(1);

    const table = res.tables[0];
    expect(table.rows[1].cells[0].text).toBe("Lote 01");
    expect(table.rows[1].cells[0].rowSpan).toBe("restart");

    // Na linha 2, a célula com vMerge="continue" herda o texto da célula superior
    expect(table.rows[2].cells[0].text).toBe("Lote 01");
    expect(table.rows[2].cells[0].rowSpan).toBe("continue");
  });

  it("3. Fusão de tabelas consecutivas com cabeçalho repetido no DOCX", async () => {
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

    // Duas tabelas <w:tbl> consecutivas com cabeçalho idêntico:
    // Tbl 1: Cabeçalho + Item 1
    // Tbl 2: Cabeçalho repetido + Item 2
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Item</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Descrição</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Serviço de Nuvem</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Item</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Descrição</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>2</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Serviço de Backup</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    );

    const docxBuf = await zip.generateAsync({ type: "nodebuffer" });
    const docxPath = resolve(tmpDir, "tabelas_consecutivas.docx");
    const outPath = resolve(tmpDir, "estrutura_consecutivas.json");
    writeFileSync(docxPath, docxBuf);

    const res = await inspectDoc(docxPath, outPath);
    // As duas tabelas devem ser unificadas em uma única tabela lógica!
    expect(res.tables.length).toBe(1);
    expect(res.tables[0].rows.length).toBe(3); // 1 cabeçalho + Item 1 + Item 2
    expect(res.tables[0].rows[1].cells[1].text).toBe("Serviço de Nuvem");
    expect(res.tables[0].rows[2].cells[1].text).toBe("Serviço de Backup");
  });

  it("4. PDF Multi-Página com cabeçalho repetido e célula multilinha deve auditar itens como tabela unificada", () => {
    const lines: PdfLineItem[] = [
      // Página 1: Cabeçalho e Item 1 com descrição multilinha
      { page: 1, line: 1, coord: "PAG_001 | L0001", bracket_coord: "[PAG_001 | L0001]", text: "Item | Descrição | Qtd | Valor Unitário | Valor Total" },
      { page: 1, line: 2, coord: "PAG_001 | L0002", bracket_coord: "[PAG_001 | L0002]", text: "1 | Servidor Rack de Alta Densidade | 4 | R$ 10.000,00 | R$ 40.000,00" },
      { page: 1, line: 3, coord: "PAG_001 | L0003", bracket_coord: "[PAG_001 | L0003]", text: "com 2x Processadores Intel Xeon e 128GB RAM" },
      // Página 2: Cabeçalho repetido e Item 2
      { page: 2, line: 1, coord: "PAG_002 | L0001", bracket_coord: "[PAG_002 | L0001]", text: "Item | Descrição | Qtd | Valor Unitário | Valor Total" },
      { page: 2, line: 2, coord: "PAG_002 | L0002", bracket_coord: "[PAG_002 | L0002]", text: "2 | Switch Gerenciável 48 Portas | 2 | R$ 5.000,00 | R$ 10.000,00" },
    ];

    const audit = auditDocumentBudget({ pdfLines: lines });
    expect(audit.has_budget_table).toBe(true);
    // Deve unificar em 1 única tabela orçamentária
    expect(audit.tables.length).toBe(1);
    expect(audit.total_items_checked).toBe(2);
    expect(audit.math_errors_count).toBe(0);

    // O Item 1 deve ter agregado a linha descritiva subsequente (multilinha)
    const item1 = audit.tables[0].items[0];
    expect(item1.description).toContain("Servidor Rack de Alta Densidade");
    expect(item1.description).toContain("Processadores Intel Xeon");

    const item2 = audit.tables[0].items[1];
    expect(item2.item_number).toBe("2");
    expect(item2.expected_total_cents).toBe(1000000); // R$ 10.000,00 em centavos
  });
});
