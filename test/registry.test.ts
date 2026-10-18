import { describe, test, expect, afterAll } from "bun:test";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  inspectDocx,
  computeStructureFingerprint,
  computeStructuralSimilarity,
  normalizeStructuralText,
  saveTemplateToRegistry,
  loadAllRegistryTemplates,
  getTemplateRegistryDir,
  safeReadJsonFile,
  isValidIsoDate,
  formatInspectDocxSyntheticResult,
  type SlotsManifest,
  type TemplateRegistryEntry,
  VERSION,
} from "../src/index.ts";
import {
  MINIMAL_DOCX_BASE64,
  createSampleRawDocx,
  createDriftedRawDocx,
  createSuiteTempDir,
} from "./helpers/fixtures.ts";

describe("Testes Unitários: Cache Global & Registry (Fingerprint, Matching 1-para-N, Datas)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("registry");

  afterAll(() => {
    cleanup();
  });

  test("deve calcular impressão digital estrutural (structure_fingerprint) e normalizar textos (v0.6.0)", async () => {
    // 1. normalizeStructuralText
    expect(normalizeStructuralText("  1. DESCRIÇÃO DA NECESSIDADE?!  ")).toBe(
      "1 descricao da necessidade"
    );
    expect(normalizeStructuralText("Órgão: Responsável - (Coordenação)")).toBe(
      "orgao responsavel coordenacao"
    );

    // 2. computeStructureFingerprint a partir de um docx inspecionado
    const sampleDocx = resolve(tempDir, "fp_sample.docx");
    await createSampleRawDocx(sampleDocx);
    const inspection = await inspectDocx(sampleDocx);
    const fp = computeStructureFingerprint(inspection);

    expect(fp.tables.length).toBe(2);
    expect(fp.tables[0].rows).toBe(2);
    expect(fp.tables[0].cols).toBe(2);
    expect(fp.tables[0].headers).toContain("unidade requisitante");
    expect(fp.tables[1].rows).toBe(4);
    expect(fp.tables[1].cols).toBe(2);
    expect(fp.tables[1].headers).toContain("risco");
    expect(fp.tables[1].headers).toContain("mitigacao");

    expect(fp.sections.length).toBeGreaterThan(0);
    expect(fp.sections).toContain("estudo tecnico preliminar");
    expect(fp.sections).toContain("1 descricao da necessidade");

    expect(fp.form_fields.length).toBeGreaterThan(0);
    expect(
      fp.form_fields.some((f) => f.label_normalized === "unidade requisitante")
    ).toBe(true);
    expect(
      fp.form_fields.some((f) => f.label_normalized === "responsavel")
    ).toBe(true);
  });

  test("deve calcular similaridade estrutural determinística (computeStructuralSimilarity v0.6.0)", async () => {
    const docxA = resolve(tempDir, "sim_doc_a.docx");
    const docxB = resolve(tempDir, "sim_doc_b.docx");
    await createSampleRawDocx(docxA);
    await createSampleRawDocx(docxB);

    const inspA = await inspectDocx(docxA);
    const inspB = await inspectDocx(docxB);
    const fpA = computeStructureFingerprint(inspA);
    const fpB = computeStructureFingerprint(inspB);

    // 1. Comparação entre documentos idênticos -> 1.0 (100%)
    const exactSim = computeStructuralSimilarity(fpA, fpB);
    expect(exactSim).toBe(1.0);

    // 2. Comparação com drift (inserção de linha extra na tabela) -> entre 0.75 e 0.995
    const docxDrift = resolve(tempDir, "sim_doc_drift.docx");
    await createDriftedRawDocx(docxDrift);
    const inspDrift = await inspectDocx(docxDrift);
    const fpDrift = computeStructureFingerprint(inspDrift);

    const driftSim = computeStructuralSimilarity(fpDrift, fpA);
    expect(driftSim).toBeGreaterThanOrEqual(0.75);
    expect(driftSim).toBeLessThan(0.995);

    // 3. Comparação com documento vazio/diferente -> < 0.75
    const minimalDocx = resolve(tempDir, "sim_doc_minimal.docx");
    writeFileSync(minimalDocx, Buffer.from(MINIMAL_DOCX_BASE64, "base64"));
    const inspMinimal = await inspectDocx(minimalDocx);
    const fpMinimal = computeStructureFingerprint(inspMinimal);

    const diffSim = computeStructuralSimilarity(fpMinimal, fpA);
    expect(diffSim).toBeLessThan(0.75);
  });

  test("deve resolver diretório do registro global e persistir templates (saveTemplateToRegistry & loadAllRegistryTemplates v0.6.0)", async () => {
    const customRegDir = resolve(tempDir, "custom_registry");
    const resolvedDir = getTemplateRegistryDir(undefined, customRegDir);
    expect(resolvedDir).toBe(customRegDir);

    const sampleDocx = resolve(tempDir, "reg_sample.docx");
    await createSampleRawDocx(sampleDocx);
    const insp = await inspectDocx(sampleDocx);
    const fp = computeStructureFingerprint(insp);

    const mockManifest: SlotsManifest = {
      replace_table_cells: [
        { table_index: 0, row_index: 0, cell_index: 1, tag: "{{unidade}}" },
        { table_index: 0, row_index: 1, cell_index: 1, tag: "{{responsavel}}" },
      ],
    };

    const savedPath = saveTemplateToRegistry(
      "etp_padrao_teste",
      mockManifest,
      fp,
      undefined,
      customRegDir
    );
    expect(existsSync(savedPath)).toBe(true);
    expect(savedPath).toContain("etp_padrao_teste.json");

    const all = loadAllRegistryTemplates(undefined, customRegDir);
    expect(all.length).toBe(1);
    expect(all[0].template_id).toBe("etp_padrao_teste");
    expect(all[0].manifest.replace_table_cells?.length).toBe(2);
    expect(all[0].structure_fingerprint.tables.length).toBe(2);
  });

  test("Busca 1-para-N no Cache Global e Auto-Offset: EXACT, MODIFIED (reancoragem automática) e NEW (v0.6.0)", async () => {
    const testRegDir = resolve(tempDir, "cases_test", "core", "registry", "templates");
    mkdirSync(testRegDir, { recursive: true });

    // Salva template base no registro
    const baseDocx = resolve(tempDir, "base_template_case.docx");
    await createSampleRawDocx(baseDocx);
    const baseInsp = await inspectDocx(baseDocx);
    const baseFp = computeStructureFingerprint(baseInsp);

    const baseManifest: SlotsManifest = {
      replace_paragraphs: [
        { start_p: 3, end_p: 4, tag: "{{necessidade.texto}}" },
      ],
      replace_table_cells: [
        { table_index: 0, row_index: 0, cell_index: 1, tag: "{{unidade_requisitante}}" },
        { table_index: 0, row_index: 1, cell_index: 1, tag: "{{responsavel}}" },
      ],
      loop_table_rows: [
        {
          table_index: 1,
          header_row_index: 0,
          template_row_index: 1,
          remove_from_row: 2,
          remove_to_row: 3,
          for_open_tag: "{{FOR r IN riscos}}",
          for_close_tag: "{{END-FOR r}}",
          cell_tags: ["{{$r.risco}}", "{{$r.mitigacao}}"],
        },
      ],
    };

    saveTemplateToRegistry(
      "etp_homologado_master",
      baseManifest,
      baseFp,
      undefined,
      testRegDir
    );

    // 1. Cenário EXACT (100%): novo documento idêntico ao registrado
    const exactDocx = resolve(tempDir, "doc_exact.docx");
    await createSampleRawDocx(exactDocx);
    const exactOut = resolve(tempDir, "state", "estrutura_exact.json");
    const exactInsp = await inspectDocx(exactDocx, exactOut, true, {
      registryDir: testRegDir,
    });

    expect(exactInsp.template_match).toBeDefined();
    expect(exactInsp.template_match?.status).toBe("EXACT");
    expect(exactInsp.template_match?.template_id).toBe("etp_homologado_master");
    expect(exactInsp.template_match?.similarity).toBe(1.0);

    // 2. Cenário MODIFIED com Auto-Offset: novo documento com 1 linha inserida na Tabela 0
    const driftDocx = resolve(tempDir, "doc_drift_case.docx");
    await createDriftedRawDocx(driftDocx);
    const driftOut = resolve(tempDir, "state", "estrutura_drift.json");
    const driftInsp = await inspectDocx(driftDocx, driftOut, true, {
      registryDir: testRegDir,
    });

    expect(driftInsp.template_match).toBeDefined();
    expect(driftInsp.template_match?.status).toBe("MODIFIED");
    expect(driftInsp.template_match?.similarity).toBeGreaterThanOrEqual(0.75);
    expect(driftInsp.template_match?.similarity).toBeLessThan(0.995);
    expect(driftInsp.template_match?.template_id).toBe("etp_homologado_master");
    expect(driftInsp.template_match?.adapted_manifest_path).toBeDefined();

    // Valida que o adapted_slots_manifest.json foi gravado em disco
    const adaptedManifestPath = driftInsp.template_match!.adapted_manifest_path!;
    expect(existsSync(adaptedManifestPath)).toBe(true);

    const adaptedManifest: SlotsManifest & { _shift_summary?: string } =
      safeReadJsonFile(adaptedManifestPath);

    // A regra da Unidade Requisitante manteve row_index = 0
    expect(adaptedManifest.replace_table_cells?.[0].row_index).toBe(0);
    // A regra do Responsável foi automaticamente reancorada de row_index 1 para 2!
    expect(adaptedManifest.replace_table_cells?.[1].row_index).toBe(2);
    expect(adaptedManifest.replace_table_cells?.[1].cell_index).toBe(1);
    expect(adaptedManifest._shift_summary).toContain("Responsável");

    // 3. Cenário NEW (< 75%): minuta inédita
    const minimalDocx = resolve(tempDir, "doc_new_unrelated.docx");
    writeFileSync(minimalDocx, Buffer.from(MINIMAL_DOCX_BASE64, "base64"));
    const newOut = resolve(tempDir, "state", "estrutura_new.json");
    const newInsp = await inspectDocx(minimalDocx, newOut, true, {
      registryDir: testRegDir,
    });

    expect(newInsp.template_match).toBeDefined();
    expect(newInsp.template_match?.status).toBe("NEW");
    expect(newInsp.template_match?.similarity).toBeLessThan(0.75);
  });

  test("deve realizar sanity check no Cache Global descartando templates corrompidos com 0 regras (loadAllRegistryTemplates v0.6.1)", () => {
    const regDir = resolve(tempDir, "test_sanity_registry");
    mkdirSync(regDir, { recursive: true });

    // Template válido
    const validEntry = {
      template_id: "template_valido_v1",
      created_at: new Date().toISOString(),
      structure_fingerprint: {
        sections: ["1. OBJETO"],
        form_fields: [],
        tables: [],
        total_paragraphs: 10,
        total_tables: 1,
      },
      manifest: {
        slots: [{ coord: "P1", tag: "{{objeto}}" }],
      },
    };
    writeFileSync(
      resolve(regDir, "template_valido_v1.json"),
      JSON.stringify(validEntry, null, 2),
      "utf-8"
    );

    // Template corrompido/defeituoso (0 regras)
    const corruptedEntry = {
      template_id: "template_defeituoso_v1",
      created_at: new Date().toISOString(),
      structure_fingerprint: {
        sections: ["2. JUSTIFICATIVA"],
        form_fields: [],
        tables: [],
        total_paragraphs: 10,
        total_tables: 1,
      },
      manifest: {
        slots: [],
      },
    };
    writeFileSync(
      resolve(regDir, "template_defeituoso_v1.json"),
      JSON.stringify(corruptedEntry, null, 2),
      "utf-8"
    );

    const loaded = loadAllRegistryTemplates(undefined, regDir);
    expect(loaded.length).toBe(1);
    expect(loaded[0].template_id).toBe("template_valido_v1");
  });

  test("deve gravar e ler rastreabilidade temporal no cache (created_at, updated_at, age_days, engine_version, slots_count), preservando created_at ao atualizar e orientando Gate 1 (v0.6.4)", async () => {
    const regDir = resolve(tempDir, "test_temporal_trace_registry");
    mkdirSync(regDir, { recursive: true });

    const sampleDocx = resolve(tempDir, "temporal_sample.docx");
    await createSampleRawDocx(sampleDocx);
    const inspInitial = await inspectDocx(sampleDocx);
    const fp = inspInitial.structure_fingerprint!;

    // 1. Grava primeiro cache com 2 slots
    const manifestV1: SlotsManifest = {
      slots: [
        { coord: "P3", tag: "{{necessidade}}" },
        { coord: "T0.R0.C1", tag: "{{unidade}}" },
      ],
    };
    const savedPath = saveTemplateToRegistry(
      "etp_temporal_v1",
      manifestV1,
      fp,
      undefined,
      regDir
    );

    const diskEntryV1 = safeReadJsonFile<TemplateRegistryEntry>(savedPath);
    expect(isValidIsoDate(diskEntryV1.created_at)).toBe(true);
    expect(isValidIsoDate(diskEntryV1.updated_at)).toBe(true);
    expect(diskEntryV1.engine_version).toBe(VERSION);
    expect(diskEntryV1.slots_count).toBe(2);

    // Simula que o template foi criado há 5 dias atrás no disco e agora recebe uma atualização com 3 slots
    const fiveDaysAgoIso = new Date(Date.now() - 5 * 86_400_000).toISOString();
    diskEntryV1.created_at = fiveDaysAgoIso;
    diskEntryV1.updated_at = fiveDaysAgoIso;
    writeFileSync(savedPath, JSON.stringify(diskEntryV1, null, 2), "utf-8");

    const manifestV2: SlotsManifest = {
      slots: [
        { coord: "P3", tag: "{{necessidade}}" },
        { coord: "T0.R0.C1", tag: "{{unidade}}" },
        { coord: "T0.R1.C1", tag: "{{responsavel}}" },
      ],
    };
    saveTemplateToRegistry(
      "etp_temporal_v1",
      manifestV2,
      fp,
      undefined,
      regDir
    );

    const diskEntryV2 = safeReadJsonFile<TemplateRegistryEntry>(savedPath);
    // Preserva o created_at original (5 dias atrás) e atualiza updated_at e slots_count (3)
    expect(diskEntryV2.created_at).toBe(fiveDaysAgoIso);
    expect(diskEntryV2.updated_at).not.toBe(fiveDaysAgoIso);
    expect(isValidIsoDate(diskEntryV2.updated_at)).toBe(true);
    expect(diskEntryV2.engine_version).toBe(VERSION);
    expect(diskEntryV2.slots_count).toBe(3);

    // Inspeciona documento contra esse cache atualizado
    const outInspectJson = resolve(tempDir, "state", "estrutura_temporal.json");
    const matchedInsp = await inspectDocx(sampleDocx, outInspectJson, true, {
      registryDir: regDir,
    });

    expect(matchedInsp.template_match).toBeDefined();
    expect(matchedInsp.template_match?.status).toBe("EXACT");
    expect(matchedInsp.template_match?.created_at).toBe(fiveDaysAgoIso);
    expect(matchedInsp.template_match?.updated_at).toBe(diskEntryV2.updated_at);
    expect(matchedInsp.template_match?.age_days).toBe(0);
    expect(matchedInsp.template_match?.cache_date_status).toBe("KNOWN");
    expect(matchedInsp.template_match?.engine_version).toBe(VERSION);
    expect(matchedInsp.template_match?.slots_count).toBe(3);

    const synthetic = formatInspectDocxSyntheticResult(
      sampleDocx,
      outInspectJson,
      matchedInsp
    );
    const expectedDateYmd = diskEntryV2.updated_at!.slice(0, 10);
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.template_match?.created_at).toBe(fiveDaysAgoIso);
    expect(synthetic.template_match?.updated_at).toBe(diskEntryV2.updated_at);
    expect(synthetic.template_match?.age_days).toBe(0);
    expect(synthetic.template_match?.cache_date_status).toBe("KNOWN");
    expect(synthetic.template_match?.engine_version).toBe(VERSION);
    expect(synthetic.template_match?.slots_count).toBe(3);
    expect(synthetic.next_step_hint).toContain(
      `Cache reconhecido (EXACT, criado/atualizado em ${expectedDateYmd}, 3 slots). Informe a data ao usuário no Gate 1.`
    );
    expect(Buffer.byteLength(JSON.stringify(synthetic), "utf-8")).toBeLessThan(
      1024
    );
  });

  test("deve garantir 100% de retrocompatibilidade com cache legado sem created_at/updated_at/engine_version sem usar mtime do disco (v0.6.4)", async () => {
    const regDir = resolve(tempDir, "test_legacy_cache_registry");
    mkdirSync(regDir, { recursive: true });

    const sampleDocx = resolve(tempDir, "legacy_cache_sample.docx");
    await createSampleRawDocx(sampleDocx);
    const inspInitial = await inspectDocx(sampleDocx);
    const fp = inspInitial.structure_fingerprint!;

    // Grava manualmente um JSON de cache legado SEM created_at, updated_at, engine_version ou slots_count
    const legacyCacheJson = {
      template_id: "etp_legado_sem_data",
      structure_fingerprint: fp,
      manifest: {
        replace_paragraphs: [{ start_p: 3, end_p: 3, tag: "{{necessidade}}" }],
        replace_table_cells: [
          { table_index: 0, row_index: 0, cell_index: 1, tag: "{{unidade}}" },
        ],
      },
    };
    writeFileSync(
      resolve(regDir, "etp_legado_sem_data.json"),
      JSON.stringify(legacyCacheJson, null, 2),
      "utf-8"
    );

    const loaded = loadAllRegistryTemplates(undefined, regDir);
    expect(loaded.length).toBe(1);
    expect(loaded[0].template_id).toBe("etp_legado_sem_data");
    expect(loaded[0].created_at).toBe("NÃO DISPONÍVEL");
    expect(loaded[0].updated_at).toBe("NÃO DISPONÍVEL");
    expect(loaded[0].engine_version).toBe("NÃO DISPONÍVEL");
    expect(loaded[0].slots_count).toBe(2);

    const outInspectJson = resolve(tempDir, "state", "estrutura_legacy.json");
    const matchedInsp = await inspectDocx(sampleDocx, outInspectJson, true, {
      registryDir: regDir,
    });

    expect(matchedInsp.template_match).toBeDefined();
    expect(matchedInsp.template_match?.status).toBe("EXACT");
    expect(matchedInsp.template_match?.created_at).toBe("NÃO DISPONÍVEL");
    expect(matchedInsp.template_match?.updated_at).toBe("NÃO DISPONÍVEL");
    expect(matchedInsp.template_match?.age_days).toBeNull();
    expect(matchedInsp.template_match?.cache_date_status).toBe("UNKNOWN");
    expect(matchedInsp.template_match?.engine_version).toBe("NÃO DISPONÍVEL");
    expect(matchedInsp.template_match?.slots_count).toBe(2);

    const synthetic = formatInspectDocxSyntheticResult(
      sampleDocx,
      outInspectJson,
      matchedInsp
    );
    expect(synthetic.template_match?.created_at).toBe("NÃO DISPONÍVEL");
    expect(synthetic.template_match?.updated_at).toBe("NÃO DISPONÍVEL");
    expect(synthetic.template_match?.age_days).toBeNull();
    expect(synthetic.template_match?.cache_date_status).toBe("UNKNOWN");
    expect(synthetic.template_match?.engine_version).toBe("NÃO DISPONÍVEL");
    expect(synthetic.template_match?.slots_count).toBe(2);
    expect(synthetic.next_step_hint).toContain(
      "Cache reconhecido (EXACT, data de criação não disponível no cache legado). Informe ao usuário no Gate 1 que a data do cache é desconhecida para que ele decida entre usar ou atualizar."
    );
    expect(Buffer.byteLength(JSON.stringify(synthetic), "utf-8")).toBeLessThan(
      1024
    );
  });
});
