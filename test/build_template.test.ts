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
    expect(synthetic.engine_version).toBe("1.2.0");
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
});
