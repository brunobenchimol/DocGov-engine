import { describe, test, expect, afterAll } from "bun:test";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildDocxTemplate,
  formatBuildDocxTemplateSyntheticResult,
  normalizeSlotsManifest,
  countManifestRules,
  inspectDocx,
  processDocument,
  safeReadJsonFile,
  EXACT_COPY_PASTE_SLOTS_MANIFEST_SNIPPET,
  type SlotsManifest,
  type TemplateRegistryEntry,
  VERSION,
} from "../src/index.ts";
import {
  MINIMAL_DOCX_BASE64,
  createSampleRawDocx,
  createSuiteTempDir,
} from "./helpers/fixtures.ts";

describe("Testes Unitários: build_docx_template (Coordenadas Compactas, Fail-Fast, Contratos)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("build_template");

  afterAll(() => {
    cleanup();
  });

  test("deve normalizar manifesto com coordenadas compactas, aliases e array na raiz (normalizeSlotsManifest & countManifestRules v0.6.1)", () => {
    // 1. Array puro na raiz com coordenadas compactas
    const rawArray = [
      { coord: "T0.R1.C1", tag: "{{campo_tabela}}" },
      { coord: "[T1.R2.C0]", tag: "{{campo_com_colchetes}}" },
      { coord: "P3", tag: "{{paragrafo_simples}}" },
      { coord: "[P4-P6]", tag: "{{paragrafo_faixa}}" },
      { coord: "P7..P8", tag: "{{paragrafo_pontos}}" },
      { find: "Texto Antigo", replace: "{{texto_novo}}" },
    ];
    const norm1 = normalizeSlotsManifest(rawArray);
    expect(norm1.replace_table_cells?.length).toBe(2);
    expect(norm1.replace_table_cells?.[0]).toEqual({
      table_index: 0,
      row_index: 1,
      cell_index: 1,
      tag: "{{campo_tabela}}",
    });
    expect(norm1.replace_table_cells?.[1]).toEqual({
      table_index: 1,
      row_index: 2,
      cell_index: 0,
      tag: "{{campo_com_colchetes}}",
    });
    expect(norm1.replace_paragraphs?.length).toBe(3);
    expect(norm1.replace_paragraphs?.[0]).toEqual({
      start_p: 3,
      end_p: 3,
      tag: "{{paragrafo_simples}}",
    });
    expect(norm1.replace_paragraphs?.[1]).toEqual({
      start_p: 4,
      end_p: 6,
      tag: "{{paragrafo_faixa}}",
    });
    expect(norm1.replace_paragraphs?.[2]).toEqual({
      start_p: 7,
      end_p: 8,
      tag: "{{paragrafo_pontos}}",
    });
    expect(norm1.replace_inline?.length).toBe(1);
    expect(norm1.replace_inline?.[0]).toEqual({
      find: "Texto Antigo",
      replace: "{{texto_novo}}",
    });
    expect(countManifestRules(norm1)).toBe(6);

    // 2. Objeto com chave unificada 'slots' e aliases
    const rawSlotsObj = {
      slots: [
        { table_index: 0, row_index: 0, col_index: 1, tag: "{{alias_col}}" },
        { paragraph_index: 5, tag: "{{alias_p}}" },
      ],
    };
    const norm2 = normalizeSlotsManifest(rawSlotsObj);
    expect(norm2.replace_table_cells?.length).toBe(1);
    expect(norm2.replace_table_cells?.[0].cell_index).toBe(1);
    expect(norm2.replace_paragraphs?.length).toBe(1);
    expect(norm2.replace_paragraphs?.[0].start_p).toBe(5);
    expect(norm2.replace_paragraphs?.[0].end_p).toBe(5);
    expect(countManifestRules(norm2)).toBe(2);

    // 3. Manifesto canônico preservado
    const rawCanonical: SlotsManifest = {
      replace_paragraphs: [{ start_p: 1, end_p: 2, tag: "{{can}}" }],
      replace_inline: [{ find: "A", replace: "B" }],
    };
    const norm3 = normalizeSlotsManifest(rawCanonical);
    expect(norm3.replace_paragraphs?.length).toBe(1);
    expect(norm3.replace_inline?.length).toBe(1);
    expect(countManifestRules(norm3)).toBe(2);

    // 4. Manifesto vazio ou nulo
    expect(countManifestRules(normalizeSlotsManifest({}))).toBe(0);
    expect(countManifestRules(normalizeSlotsManifest(null))).toBe(0);
  });

  test("deve construir template com coordenadas compactas e retornar contagem e breakdown (buildDocxTemplate v0.6.1)", async () => {
    const rawDocx = resolve(tempDir, "compact_coords_sample.docx");
    const manifestFile = resolve(tempDir, "compact_coords_manifest.json");
    const outDocx = resolve(tempDir, "compact_coords_out.docx");
    await createSampleRawDocx(rawDocx);

    // Manifesto usando a notação compacta moderna que o LLM vê no toc_map
    const compactManifest = {
      slots: [
        { coord: "P3", tag: "{{necessidade_injetada}}" },
        { coord: "[T0.R0.C1]", tag: "{{unidade_injetada}}" },
        { find: "Órgão Público Contratante", replace: "{{orgao_injetado}}" },
      ],
    };
    writeFileSync(
      manifestFile,
      JSON.stringify(compactManifest, null, 2),
      "utf-8"
    );

    const result = await buildDocxTemplate(rawDocx, manifestFile, outDocx);

    expect(result.success).toBe(true);
    expect(result.applied_slots_count).toBe(4);
    expect(result.breakdown).toEqual({
      replace_paragraphs: 1,
      loop_paragraphs: 0,
      replace_table_cells: 1,
      loop_table_rows: 0,
      replace_inline: 2,
    });
    expect(existsSync(outDocx)).toBe(true);

    const synthetic = formatBuildDocxTemplateSyntheticResult(outDocx, result);
    expect(synthetic.status).toBe("success");
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("1.3.8");
    expect(synthetic.applied_slots_count).toBe(4);
    expect(synthetic.breakdown.replace_paragraphs).toBe(1);
    expect(synthetic.breakdown.replace_table_cells).toBe(1);
    expect(synthetic.breakdown.replace_inline).toBe(2);
    expect(synthetic.next_step_hint).toContain("fill_docx_template");
    expect(Buffer.byteLength(JSON.stringify(synthetic), "utf-8")).toBeLessThan(1024);

    // Injeta dados no template construído com coordenadas compactas e valida output
    const stateFile = resolve(tempDir, "compact_coords_state.json");
    const finalDocx = resolve(tempDir, "compact_coords_final.docx");
    writeFileSync(
      stateFile,
      JSON.stringify(
        {
          necessidade_injetada: "Necessidade aprovada com sucesso.",
          unidade_injetada: "Diretoria de Compras e Logística",
          orgao_injetado: "Secretaria de Gestão e Planejamento",
        },
        null,
        2
      ),
      "utf-8"
    );

    await processDocument(outDocx, stateFile, finalDocx);
    expect(existsSync(finalDocx)).toBe(true);

    const insp = await inspectDocx(finalDocx);
    const p3 = insp.paragraphs.find((p) => p.index === 3);
    expect(p3?.text).toContain("Necessidade aprovada com sucesso.");

    const t0 = insp.tables.find((t) => t.index === 0);
    expect(t0?.rows[0].cells[1].text).toContain("Diretoria de Compras e Logística");
  });

  test("deve suportar saveToRegistry em build_docx_template (v0.6.0)", async () => {
    const rawDocx = resolve(tempDir, "build_registry_sample.docx");
    const manifestFile = resolve(tempDir, "build_registry_manifest.json");
    const outDocx = resolve(tempDir, "build_registry_out.docx");
    const customRegistry = resolve(tempDir, "test_build_reg");

    await createSampleRawDocx(rawDocx);
    const mockManifest: SlotsManifest = {
      replace_table_cells: [
        { table_index: 0, row_index: 0, cell_index: 1, tag: "{{unidade}}" },
      ],
    };
    writeFileSync(manifestFile, JSON.stringify(mockManifest, null, 2), "utf-8");

    const result = await buildDocxTemplate(rawDocx, manifestFile, outDocx, {
      saveToRegistry: true,
      templateId: "etp_homologado_build_test",
      registryDir: customRegistry,
    });

    expect(result.success).toBe(true);
    expect(result.registryPath).toBeDefined();
    expect(existsSync(result.registryPath!)).toBe(true);
    expect(result.registryPath!).toContain("etp_homologado_build_test.json");

    const savedEntry: TemplateRegistryEntry = safeReadJsonFile(result.registryPath!);
    expect(savedEntry.template_id).toBe("etp_homologado_build_test");
    expect(savedEntry.manifest.replace_table_cells?.length).toBe(1);
    expect(savedEntry.structure_fingerprint.tables.length).toBe(2);
  });

  test("deve aplicar Fail-Fast estrito (Zero Silent No-Op) rejeitando manifestos vazios ou com 0 slots aplicados sem corromper disco ou cache (v0.6.1)", async () => {
    const rawDocx = resolve(tempDir, "fail_fast_sample.docx");
    const emptyManifestFile = resolve(tempDir, "empty_manifest.json");
    const noOpManifestFile = resolve(tempDir, "noop_manifest.json");
    const outDocxEmpty = resolve(tempDir, "fail_fast_empty_out.docx");
    const outDocxNoOp = resolve(tempDir, "fail_fast_noop_out.docx");
    const customRegistry = resolve(tempDir, "test_fail_fast_reg");

    await createSampleRawDocx(rawDocx);

    // Caso A: Manifesto vazio ou com chaves desconhecidas (0 regras configuradas)
    writeFileSync(
      emptyManifestFile,
      JSON.stringify({ chave_invalida: [1, 2, 3] }, null, 2),
      "utf-8"
    );

    let errorA: any;
    try {
      await buildDocxTemplate(rawDocx, emptyManifestFile, outDocxEmpty, {
        saveToRegistry: true,
        templateId: "template_corrompido_a",
        registryDir: customRegistry,
      });
    } catch (e: any) {
      errorA = e;
    }

    expect(errorA).toBeDefined();
    expect(errorA.message).toContain("NÃO faça leituras exploratórias no repositório");
    expect(errorA.message).toContain("Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errorA.message).toContain("chave_invalida");
    expect(existsSync(outDocxEmpty)).toBe(false);
    expect(
      existsSync(resolve(customRegistry, "template_corrompido_a.json"))
    ).toBe(false);

    // Caso B: Manifesto com regra configurada mas que produz 0 substituições (ex.: find não bate)
    writeFileSync(
      noOpManifestFile,
      JSON.stringify(
        {
          replace_inline: [
            { find: "TEXTO_QUE_NAO_EXISTE_XYZ_123", replace: "tag" },
          ],
        },
        null,
        2
      ),
      "utf-8"
    );

    let errorB: any;
    try {
      await buildDocxTemplate(rawDocx, noOpManifestFile, outDocxNoOp, {
        saveToRegistry: true,
        templateId: "template_corrompido_b",
        registryDir: customRegistry,
      });
    } catch (e: any) {
      errorB = e;
    }

    expect(errorB).toBeDefined();
    expect(errorB.message).toContain("0 slots foram aplicados no documento");
    expect(errorB.message).toContain("NÃO faça leituras exploratórias no repositório");
    expect(errorB.message).toContain("Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(existsSync(outDocxNoOp)).toBe(false);
    expect(
      existsSync(resolve(customRegistry, "template_corrompido_b.json"))
    ).toBe(false);
  });

  test("deve aplicar Exact Copy-Paste Error estrito em slots_manifest.json com propriedades inventadas ou chaves raiz desconhecidas (v0.6.2)", () => {
    // 1. Chave raiz desconhecida
    let errRoot: any;
    try {
      normalizeSlotsManifest({ minhas_regras: [{ coord: "P1", tag: "{{tag}}" }] });
    } catch (e: any) {
      errRoot = e;
    }
    expect(errRoot).toBeDefined();
    expect(errRoot.message).toContain("NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errRoot.message).toContain("minhas_regras");
    expect(errRoot.message).toContain(EXACT_COPY_PASTE_SLOTS_MANIFEST_SNIPPET);

    // 2. Chaves proibidas em loop_table_rows (loop_var, items_expr, cell_slots, row_index)
    let errLoop: any;
    try {
      normalizeSlotsManifest({
        loop_table_rows: [
          {
            table_index: 1,
            loop_var: "r",
            items_expr: "gestao_riscos",
            cell_slots: ["{{$r.risco}}"],
          },
        ],
      });
    } catch (e: any) {
      errLoop = e;
    }
    expect(errLoop).toBeDefined();
    expect(errLoop.message).toContain("NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errLoop.message).toContain("loop_var");
    expect(errLoop.message).toContain("Não invente propriedades como 'loop_var', 'items_expr', 'cell_slots' ou 'row_index'");

    // 3. Propriedade desconhecida no array slots
    let errSlotsItem: any;
    try {
      normalizeSlotsManifest({
        slots: [{ coord: "P1", tag: "{{tag}}", invalid_custom_field: true }],
      });
    } catch (e: any) {
      errSlotsItem = e;
    }
    expect(errSlotsItem).toBeDefined();
    expect(errSlotsItem.message).toContain("NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errSlotsItem.message).toContain("invalid_custom_field");
  });

  test("deve criar pastas pais recursivamente sem lançar ENOENT ao gravar template em caminho inexistente (Zero ENOENT v0.7.3)", async () => {
    const rawDocx = resolve(tempDir, "enoent_source.docx");
    const manifestFile = resolve(tempDir, "enoent_manifest.json");
    // Caminho com subpastas inexistentes aninhadas
    const nestedOutDocx = resolve(
      tempDir,
      "nested_cases",
      "case_001",
      "templates",
      "template_ETP.docx"
    );

    await createSampleRawDocx(rawDocx);
    const mockManifest: SlotsManifest = {
      replace_table_cells: [
        { table_index: 0, row_index: 0, cell_index: 1, tag: "{{unidade_requisitante}}" },
      ],
    };
    writeFileSync(manifestFile, JSON.stringify(mockManifest, null, 2), "utf-8");

    // Deve criar nested_cases/case_001/templates/ automaticamente e gravar sem erro
    const result = await buildDocxTemplate(rawDocx, manifestFile, nestedOutDocx);

    expect(result.success).toBe(true);
    expect(result.applied_slots_count).toBe(1);
    expect(existsSync(nestedOutDocx)).toBe(true);
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

    // Cria tabela monolítica com 2 subtabelas de itens (R1..R5 e R7..R10) e C0 com vMerge
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

    // Preenche itens 1 e 2 da Subtabela 1 (R1, R2) e Subtabela 2 (R7, R8) usando coordenadas originais
    // e remove as linhas excedentes R3..R5 e R9..R10!
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
    // Original tinha 11 linhas (R0..R10); removeu 3 da Subtabela 1 + 2 da Subtabela 2 = restam 6 linhas!
    expect(tbl.rows.length).toBe(6);

    // Verifica que os slots foram injetados nas linhas corretas e o vMerge restart foi preservado
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
