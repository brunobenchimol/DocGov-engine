import { describe, test, expect, afterAll } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import {
  inspectDocx,
  compactInspectionResult,
  formatInspectDocxSyntheticResult,
  VERSION,
} from "../src/index.ts";
import {
  createSampleRawDocx,
  createSuiteTempDir,
} from "./helpers/fixtures.ts";

describe("Testes Unitários: inspect_docx (Mapeamento Estrutural, TOC, Visão Linear)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("inspect");

  afterAll(() => {
    cleanup();
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
    expect(syntheticInspect.engine_version).toBe(VERSION);
    expect(syntheticInspect.engine_version).toBe("1.3.7");
    expect(syntheticInspect.filePath).toBe(rawDocxPath);
    expect(syntheticInspect.docxPath).toBe(rawDocxPath);
    expect(syntheticInspect.outputPath).toBe(outJsonPath);
    expect(syntheticInspect.tables).toBe(2);
    expect(syntheticInspect.rows).toBe(6); // Tabela 1: 2 linhas, Tabela 2: 4 linhas
    expect(syntheticInspect.paragraphs).toBe(5);
    expect(syntheticInspect.next_step_hint).toContain("build_docx_template");
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
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("1.3.7");
    expect(Buffer.byteLength(jsonStr, "utf-8")).toBeLessThan(1024);
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

  test("deve formatar synthetic inspect_doc com budget_audit respeitando a margem segura (< 900 bytes) (v1.1.0)", () => {
    const mockInspection: any = {
      doc_type: "docx",
      tables: [{ index: 0, rows: [{}, {}, {}] }],
      paragraphs: [{ index: 0, text: "A" }, { index: 1, text: "B" }],
      toc_map: {
        sections: [
          { coord: "P0", title: "1. OBJETO DO TERMO DE REFERÊNCIA" },
          { coord: "P1", title: "2. JUSTIFICATIVA E MOTIVAÇÃO" },
        ],
        form_fields: [{ coord: "T0.R1.C1", title: "Órgão Requisitante" }],
        tables: [{ table_index: 0, rows: 3, cols: 5, headers: ["Item", "Qtd"] }],
      },
      budget_audit: {
        has_budget_table: true,
        tables_checked: 1,
        total_items_checked: 5,
        math_errors_count: 1,
        rounding_warnings_count: 0,
        net_divergence_cents: 5000,
      },
      audit_view_path: "state/visao_auditoria_exemplo.md",
      dossie_hotspots_path: "state/dossie_hotspots_exemplo.md",
    };

    const synthetic = formatInspectDocxSyntheticResult(
      "inputs/exemplo.docx",
      "state/estrutura_exemplo.json",
      mockInspection
    );

    expect(synthetic.budget_audit).toBeDefined();
    expect(synthetic.budget_audit!.tables_checked).toBe(1);
    expect(synthetic.budget_audit!.math_errors).toBe(1);
    expect(synthetic.budget_audit!.divergence).toBe("R$ 50,00");

    const jsonStr = JSON.stringify(synthetic, null, 2);
    expect(Buffer.byteLength(jsonStr, "utf-8")).toBeLessThan(900);
  });

  test("deve emitir erro fail-fast explicativo se o agente passar um arquivo .zip ou .tar em inspect_doc (v1.3.3)", async () => {
    const zipPath = resolve(tempDir, "pacote_teste.zip");
    const zip = new (await import("jszip")).default();
    zip.file("arquivo1.txt", "conteudo 1");
    zip.file("arquivo2.txt", "conteudo 2");
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(zipPath, zipBuf);

    expect(inspectDocx(zipPath)).rejects.toThrow(
      "é um pacote compactado"
    );
    expect(inspectDocx(zipPath)).rejects.toThrow(
      "utilize 'bootstrap_case'"
    );
  });

  test("v1.3.6: deve indexar tabelas estritamente por células físicas <w:tc> (sem placeholders fantasmas), anotar span e vMerge na visão linear e expor template_match + form_fields no Bloco 1 (ENG-02a & ENG-04)", async () => {
    const docxPath = resolve(tempDir, "sample_physical_cells_gridspan.docx");
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
    // Tabela com linha 0: C0 com gridSpan=3 ("Processo Administrativo:"), C1 ("2026/001")
    // Linha 1: C0 com vMerge restart ("Itens da Demanda"), C1 ("Item 1"), C2 ("10 un")
    // Linha 2: C0 com vMerge continue, C1 ("Item 2"), C2 ("20 un")
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>ESTUDO TÉCNICO PRELIMINAR - ORGAO_CONTRATANTE</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc>
          <w:tcPr><w:gridSpan w:val="3"/></w:tcPr>
          <w:p><w:r><w:t>Processo Administrativo:</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>2026/001</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:vMerge w:val="restart"/></w:tcPr>
          <w:p><w:r><w:t>Itens da Demanda:</w:t></w:r></w:p>
        </w:tc>
        <w:tc><w:p><w:r><w:t>Item 1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>10 un</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:vMerge w:val="continue"/></w:tcPr>
          <w:p><w:r><w:t></w:t></w:r></w:p>
        </w:tc>
        <w:tc><w:p><w:r><w:t>Item 2</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>20 un</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    );

    const docxBuf = await zip.generateAsync({ type: "nodebuffer" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(docxPath, docxBuf);

    const res = await inspectDocx(docxPath);
    expect(res.tables.length).toBe(1);
    const tbl = res.tables[0];

    // Linha 0 possui 2 células físicas reais (<w:tc>) e placeholders na grade lógica
    const physRow0 = tbl.rows[0].cells.filter((c) => !c.isSpanPlaceholder);
    expect(physRow0.length).toBe(2);
    expect(physRow0[0].physicalCellIndex).toBe(0);
    expect(physRow0[0].colSpan).toBe(3);
    expect(physRow0[1].physicalCellIndex).toBe(1);
    expect(physRow0[1].virtualColIndex).toBe(3);

    // Linha 1 e Linha 2 possuem 3 células físicas reais
    expect(tbl.rows[1].cells.length).toBe(3);
    expect(tbl.rows[1].cells[0].rowSpan).toBe("restart");
    expect(tbl.rows[2].cells.length).toBe(3);
    expect(tbl.rows[2].cells[0].rowSpan).toBe("continue");

    // Form fields não devem duplicar o rótulo da linha 2 com vMerge continue
    const demandLabels = res.toc_map?.form_fields.filter((f) =>
      f.title.includes("Itens da Demanda")
    );
    expect(demandLabels?.length).toBe(1);

    // Visão linear de auditoria gerada
    expect(res.audit_view_path).toBeDefined();
    const md = readFileSync(res.audit_view_path!, "utf-8");

    // Bloco 1 deve expor template_match e toc_map.form_fields
    expect(md).toContain("### Diagnóstico de Cache de Template (template_match)");
    expect(md).toContain("### Campos de Formulário e Coordenadas Físicas Sugeridas (toc_map.form_fields)");
    expect(md).toContain("Processo Administrativo");

    // Bloco 2 deve expor coordenadas físicas reais com (span=3) e [vMerge]
    expect(md).toContain("[T0.R0.C0] Processo Administrativo: (span=3)");
    expect(md).toContain("[T0.R0.C1] 2026/001");
    expect(md).toContain("[T0.R2.C0]");
    expect(md).toContain("[vMerge]");
  });

  test("v1.3.7: deve detectar subtabelas de itens numerados, checkboxes com coordenadas físicas e alertas pós-compilação anti-contaminação de doador sem falso-positivo em contratações mistas (ENG-07b, ENG-08 & ENG-09)", async () => {
    const JSZip = (await import("jszip")).default;
    const { writeFileSync } = await import("node:fs");

    // 1. Documento de Software Puro contaminado por termos de Hardware doador, "Item não aplicável" e checkboxes contraditórios
    // Usamos também nome com caracteres NFD para testar ENG-09 no inspectDocx!
    const nfdFileName = "Relato\u0301rio_Contaminac\u0327a\u0303o_Software.docx";
    const nfcFileName = nfdFileName.normalize("NFC");
    const nfdDocxPath = resolve(tempDir, nfdFileName);
    const nfcLookupPath = resolve(tempDir, nfcFileName);

    const zip1 = new JSZip();
    zip1.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    );
    zip1.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );
    zip1.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>1.1 Objeto: Subscrição de licenças de software Red Hat OpenShift, treinamento oficial e suporte técnico especializado para o ORGAO_CONTRATANTE.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Critério de sustentabilidade herdado indevidamente: Conformidade com diretiva RoHS (ausência de mercúrio, chumbo e cádmio) e Portaria nº 170 do INMETRO, além de discos NVMe e memória DDR5 oriundos da ARP 90015/2024.</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Item</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Descrição</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Qtd</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Subscrição Red Hat OpenShift Container Platform</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>10</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>2</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Treinamento Oficial Red Hat</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>2</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>3</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Item não aplicável ao escopo</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>0</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>4</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Item não aplicável</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>0</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>6.3 Há necessidade de transição contratual?</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>☒ Sim</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>☒ Não</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    );

    writeFileSync(nfdDocxPath, await zip1.generateAsync({ type: "nodebuffer" }));

    // ENG-09: Chamando inspectDocx passando o caminho em NFC mesmo quando o arquivo foi gravado com string NFD
    const res1 = await inspectDocx(nfcLookupPath);

    // ENG-07b: Subtabela de itens R1..R4 detectada + Checkboxes detectados
    expect(res1.detected_subtables).toBeDefined();
    expect(res1.detected_subtables!.length).toBe(1);
    expect(res1.detected_subtables![0].start_row).toBe(1);
    expect(res1.detected_subtables![0].end_row).toBe(4);
    expect(res1.detected_subtables![0].item_count).toBe(4);

    expect(res1.detected_checkboxes).toBeDefined();
    expect(res1.detected_checkboxes!.length).toBe(1);
    expect(res1.detected_checkboxes![0].options.length).toBe(2);
    expect(res1.detected_checkboxes![0].options[0].coord).toBe("T0.R5.C1");
    expect(res1.detected_checkboxes![0].options[1].coord).toBe("T0.R5.C2");

    // ENG-08: Alertas de integridade pós-compilação disparados
    expect(res1.post_compile_alerts).toBeDefined();
    const codes1 = res1.post_compile_alerts!.map((a) => a.code);
    expect(codes1).toContain("UNREMOVED_ITEM_WORKAROUND");
    expect(codes1).toContain("CONTRADICTORY_CHECKBOXES");
    expect(codes1).toContain("HARDWARE_DONOR_CONTAMINATION");

    const auditMd1 = readFileSync(res1.audit_view_path!, "utf-8");
    expect(auditMd1).toContain(
      "## ⚠️ ALERTAS DE INTEGRIDADE PÓS-COMPILAÇÃO (AÇÃO OBRIGATÓRIA DO AUDITOR)"
    );
    expect(auditMd1).toContain("### Subtabelas de Itens e Checkboxes Detectados");
    expect(auditMd1).toContain("remove_table_rows");
    expect(basename(res1.audit_view_path!)).toBe(
      basename(res1.audit_view_path!).normalize("NFC")
    );

    // 2. Contratação Mista Legítima (Hardware HCI + Software) -> NÃO deve disparar falso-positivo HARDWARE_DONOR_CONTAMINATION
    const mixedDocxPath = resolve(tempDir, "Contratacao_Mista_HCI_Hardware_Software.docx");
    const zip2 = new JSZip();
    zip2.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    );
    zip2.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );
    zip2.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>1.1 Objeto: Aquisição de appliances de infraestrutura hiperconvergente (HCI) e servidores físicos em rack com subscrição de software de virtualização e suporte técnico.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Os equipamentos deverão possuir discos NVMe, memória DDR5, interfaces SFP+, conformidade RoHS e certificação INMETRO.</w:t></w:r></w:p>
  </w:body>
</w:document>`
    );
    writeFileSync(mixedDocxPath, await zip2.generateAsync({ type: "nodebuffer" }));

    const res2 = await inspectDocx(mixedDocxPath);
    const hwAlerts2 = (res2.post_compile_alerts || []).filter(
      (a) => a.code === "HARDWARE_DONOR_CONTAMINATION"
    );
    expect(hwAlerts2.length).toBe(0);
  });
});
