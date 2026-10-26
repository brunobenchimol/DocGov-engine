import { describe, test, expect, afterAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  bootstrapCase,
  formatBootstrapCaseSyntheticResult,
  waitForBackgroundCopy,
  VERSION,
} from "../src/index.ts";
import {
  createSampleRawDocx,
  createSuiteTempDir,
} from "./helpers/fixtures.ts";

describe("Testes Unitários: bootstrap_case (Estrutura, Magic Bytes, Salvaguarda)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("bootstrap");

  afterAll(() => {
    cleanup();
  });

  test("deve inicializar diretório do caso com inspeção síncrona imediata de .docx e salvaguarda assíncrona de PDFs (bootstrapCase v0.3.2)", async () => {
    const mockUploadsDir = resolve(tempDir, "mock_uploads");
    const mockCaseDir = resolve(tempDir, "mock_case_01");
    if (!existsSync(mockUploadsDir)) {
      mkdirSync(mockUploadsDir, { recursive: true });
    }

    const uploadedDocx = resolve(mockUploadsDir, "modelo_etp_base.docx");
    await createSampleRawDocx(uploadedDocx);
    writeFileSync(resolve(mockUploadsDir, "dfd_assinado.pdf"), "PDF_CONTENT");

    const res = await bootstrapCase(mockCaseDir, mockUploadsDir);

    expect(existsSync(resolve(mockCaseDir, "inputs"))).toBe(true);
    expect(existsSync(resolve(mockCaseDir, "state"))).toBe(true);
    expect(existsSync(resolve(mockCaseDir, "templates"))).toBe(true);
    expect(existsSync(resolve(mockCaseDir, "output"))).toBe(true);

    // .docx foi copiado imediatamente e inspecionado
    expect(res.status).toBe("success");
    expect(res.copiedFiles).toEqual(["modelo_etp_base.docx"]);
    expect(res.backgroundFiles).toEqual(["dfd_assinado.pdf"]);
    expect(res.backgroundCopy.status).toBe("started");
    expect(res.inspectedDocx.length).toBe(1);
    expect(res.inspectedDocx[0].fileName).toBe("modelo_etp_base.docx");
    expect(res.inspectedDocx[0].tablesCount).toBe(2);
    expect(res.inspectedDocx[0].paragraphsCount).toBe(5);
    expect(existsSync(res.inspectedDocx[0].structurePath)).toBe(true);
    expect(res.inspectedDocx[0].compactStructure.paragraphs.length).toBe(5);

    // Valida que o formato sintético gerado para a resposta MCP é conciso (< 1 KB)
    const syntheticMcp = formatBootstrapCaseSyntheticResult(res, "cases/caso_01");
    const syntheticJson = JSON.stringify(syntheticMcp, null, 2);
    expect(Buffer.byteLength(syntheticJson, "utf-8")).toBeLessThan(1024);
    expect(syntheticMcp.status).toBe("success");
    expect(syntheticMcp.engine_version).toBe(VERSION);
    expect(syntheticMcp.engine_version).toBe("1.3.4");
    expect(syntheticMcp.caseDir).toBe("cases/caso_01");
    expect(syntheticMcp.docx_inspected[0]).toEqual({
      filename: "modelo_etp_base.docx",
      structure_json: "state/estrutura_modelo_etp_base.json",
      tables_count: 2,
      paragraphs_count: 5,
    });
    expect(syntheticMcp.background_copy.status).toBe("active");
    expect(syntheticMcp.next_step_hint).toContain("build_docx_template");

    // O status inicial de salvaguarda foi gravado em state/salvaguarda_status.json
    const statusPath = resolve(mockCaseDir, "state", "salvaguarda_status.json");
    expect(existsSync(statusPath)).toBe(true);

    // Aguarda a conclusão da cópia em segundo plano
    await waitForBackgroundCopy(mockCaseDir);

    // Agora o PDF também existe em inputs/ e o status está completed
    expect(existsSync(resolve(mockCaseDir, "inputs", "dfd_assinado.pdf"))).toBe(true);
    const finalStatus = JSON.parse(readFileSync(statusPath, "utf-8"));
    expect(finalStatus.status).toBe("completed");
    expect(finalStatus.completedFiles).toContain("dfd_assinado.pdf");
  });

  test("deve executar bootstrapCase com auto-batismo de media_*, magic bytes e fileRenameMap com payload < 1024 bytes (v0.5.1)", async () => {
    const caseDir = resolve(tempDir, "case_v051_test");
    const uploadsDir = resolve(tempDir, "uploads_v051_test");
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    // 1. Arquivo opaco media_* sem extensão contendo buffer de .docx (ORGAO_A + ETP)
    const sampleDocxPath = resolve(tempDir, "sample_v051.docx");
    await createSampleRawDocx(sampleDocxPath);
    const docxBuf = readFileSync(sampleDocxPath);
    writeFileSync(resolve(uploadsDir, "media_1792069974647_14a93b9d"), docxBuf);

    // 2. Arquivo opaco media_* sem extensão contendo magic bytes %PDF com texto
    const pdfBuf = Buffer.from("%PDF-1.4\n%TERMO DE REFERENCIA ORGAO_B\n%%EOF");
    writeFileSync(resolve(uploadsDir, "media_9999999999999_fa12"), pdfBuf);

    // 3. Arquivo com nome humano legível
    writeFileSync(resolve(uploadsDir, "modelo_tr_legivel.docx"), docxBuf);

    // 4. Arquivo com override explícito via fileRenameMap
    writeFileSync(resolve(uploadsDir, "tmp_renamed_anexo"), pdfBuf);

    const res = await bootstrapCase(caseDir, uploadsDir, {
      fileRenameMap: { tmp_renamed_anexo: "DFD_Planejamento.pdf" },
      waitBackground: true,
    });

    expect(res.status).toBe("success");
    // Valida que o .docx foi batizado e copiado para inputs/
    expect(existsSync(resolve(caseDir, "inputs", "ETP_ORGAO_A_3b9d.docx"))).toBe(true);
    expect(existsSync(resolve(caseDir, "inputs", "modelo_tr_legivel.docx"))).toBe(true);

    // Valida que os mapas estruturais foram gerados em state/
    expect(existsSync(resolve(caseDir, "state", "estrutura_ETP_ORGAO_A_3b9d.json"))).toBe(true);
    expect(existsSync(resolve(caseDir, "state", "estrutura_modelo_tr_legivel.json"))).toBe(true);

    // Valida que os PDFs em background foram salvos com os nomes corretos
    expect(existsSync(resolve(caseDir, "inputs", "TR_ORGAO_B_fa12.pdf"))).toBe(true);
    expect(existsSync(resolve(caseDir, "inputs", "DFD_Planejamento.pdf"))).toBe(true);
    expect(existsSync(resolve(caseDir, "templates"))).toBe(true);

    // Valida ingestedFiles
    expect(res.ingestedFiles).toBeDefined();
    expect(res.ingestedFiles!.length).toBe(4);

    // Valida payload sintético MCP (< 1024 bytes estrito)
    const synthetic = formatBootstrapCaseSyntheticResult(res, "cases/v051");
    const jsonStr = JSON.stringify(synthetic, null, 2);
    const byteLength = Buffer.byteLength(jsonStr, "utf-8");

    expect(byteLength).toBeLessThan(1024);
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("1.3.4");
    expect(synthetic.ingested_files).toBeDefined();
    expect(synthetic.ingested_files!.length).toBe(4);

    // Como as entradas de uploads são ordenadas alfabeticamente:
    // 1. media_1792... -> ETP_ORGAO_A_3b9d.docx
    // 2. media_9999... -> TR_ORGAO_B_fa12.pdf
    // 3. modelo_tr_legivel.docx -> modelo_tr_legivel.docx
    // 4. tmp_renamed_anexo -> DFD_Planejamento.pdf
    expect(synthetic.ingested_files![0].saved_as).toBe("ETP_ORGAO_A_3b9d.docx");
    expect(synthetic.ingested_files![0].type).toBe("ETP");
    expect(synthetic.ingested_files![0].structure).toBe(
      "state/estrutura_ETP_ORGAO_A_3b9d.json"
    );

    // Valida também busca semântica resiliente por predicado
    const etpItem = synthetic.ingested_files!.find(
      (f) => f.saved_as === "ETP_ORGAO_A_3b9d.docx"
    );
    expect(etpItem).toBeDefined();
    expect(etpItem!.type).toBe("ETP");
    expect(etpItem!.structure).toBe("state/estrutura_ETP_ORGAO_A_3b9d.json");

    const trItem = synthetic.ingested_files!.find(
      (f) => f.saved_as === "TR_ORGAO_B_fa12.pdf"
    );
    expect(trItem).toBeDefined();
    expect(trItem!.type).toBe("TR");

    const renamedItem = synthetic.ingested_files!.find(
      (f) => f.saved_as === "DFD_Planejamento.pdf"
    );
    expect(renamedItem).toBeDefined();
    expect(renamedItem!.type).toBe("DFD");
  });

  test("deve mover documentos soltos na raiz de cases/<slug>/ para inputs/ com deduplicação automática e preservar context.json (v1.2.0)", async () => {
    const caseDir = resolve(tempDir, "caso_com_arquivos_na_raiz");
    mkdirSync(caseDir, { recursive: true });

    // 1. Cria 8 arquivos na raiz do caso (simulando caso real de 8 documentos / 19 MB)
    const docxNames = [
      "01 - DFD.docx",
      "02 - ETP.docx",
      "03 - Analise de Risco.docx",
      "04 - TR.docx",
      "04D - Matriz Responsabilidade.docx",
    ];
    for (const name of docxNames) {
      await createSampleRawDocx(resolve(caseDir, name));
    }

    // PDFs sintéticos com magic bytes
    const pdfNames = ["04A - Anexo Tecnico.pdf", "04C - Estudo Mercado.pdf"];
    for (const name of pdfNames) {
      writeFileSync(
        resolve(caseDir, name),
        Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")
      );
    }

    // Planilha de insumo adicional
    writeFileSync(
      resolve(caseDir, "04B - Planilha Custos.xlsx"),
      Buffer.from("PK\x03\x04-synthetic-xlsx-content")
    );

    // Arquivo de metadados do sistema que DEVE permanecer na raiz
    const contextJsonPath = resolve(caseDir, "context.json");
    writeFileSync(
      contextJsonPath,
      JSON.stringify({ caso_id: "caso_real_8_docs", orgao: "ORGAO_CONTRATANTE" }, null, 2),
      "utf-8"
    );

    // 2. Executa bootstrap_case apontando apenas para caseDir
    const res = await bootstrapCase(caseDir);

    expect(res.status).toBe("success");
    expect(existsSync(resolve(caseDir, "inputs"))).toBe(true);
    expect(existsSync(contextJsonPath)).toBe(true);

    // 3. Valida que todos os 8 documentos foram movidos para inputs/
    const allExpectedFiles = [
      ...docxNames,
      ...pdfNames,
      "04B - Planilha Custos.xlsx",
    ];

    for (const name of allExpectedFiles) {
      const inInputs = existsSync(resolve(caseDir, "inputs", name));
      const inRoot = existsSync(resolve(caseDir, name));

      expect(inInputs).toBe(true); // Está em inputs/
      expect(inRoot).toBe(false);  // Não está mais solto na raiz!
    }

    // 4. Cenário de Re-Execução / Idempotência:
    // Se o usuário acionar bootstrap_case novamente com uploadsDir apontando para caseDir,
    // o motor não deve falhar nem recriar arquivos duplicados na raiz
    const reRunRes = await bootstrapCase(caseDir, caseDir);
    expect(reRunRes.status).toBe("success");

    for (const name of allExpectedFiles) {
      expect(existsSync(resolve(caseDir, "inputs", name))).toBe(true);
      expect(existsSync(resolve(caseDir, name))).toBe(false);
    }
  });

  test("deve isolar falhas de inspeção por arquivo com try/catch e garantir inventário de 100% dos arquivos no state/indice_mestre_caso.md (v1.2.0)", async () => {
    const caseDir = resolve(tempDir, "caso_resiliencia_multi_arquivos");
    const inputsDir = resolve(caseDir, "inputs");
    mkdirSync(inputsDir, { recursive: true });

    // 1. Arquivos válidos
    await createSampleRawDocx(resolve(inputsDir, "01 - DFD_Valido.docx"));
    await createSampleRawDocx(resolve(inputsDir, "02 - ETP_Valido.docx"));
    writeFileSync(
      resolve(inputsDir, "03 - Edital_Valido.pdf"),
      Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")
    );

    // 2. Arquivos corrompidos / com erro intencional
    writeFileSync(
      resolve(inputsDir, "04 - Docx_Corrompido.docx"),
      Buffer.from("LIXO_BINARIO_NAO_OPENXML")
    );
    writeFileSync(
      resolve(inputsDir, "05 - Pdf_Sem_Magic_Bytes.pdf"),
      Buffer.from("TEXTO_NORMAL_SEM_PDF_HEADER")
    );

    // 3. Outro formato (Planilha de dados)
    writeFileSync(
      resolve(inputsDir, "06 - Planilha_Custos.xlsx"),
      Buffer.from("PK\x03\x04-synthetic-excel-spreadsheet-content")
    );

    // Executa bootstrap_case
    const res = await bootstrapCase(caseDir);

    expect(res.status).toBe("success");
    expect(res.inspectedDocx.length).toBe(2);
    expect(res.inspectedPdf!.length).toBe(1);
    expect(res.failed_inspections).toBeDefined();
    expect(res.failed_inspections!.length).toBe(2);
    expect(res.failed_inspections![0].fileName).toBe("04 - Docx_Corrompido.docx");
    expect(res.failed_inspections![1].fileName).toBe("05 - Pdf_Sem_Magic_Bytes.pdf");
    expect(res.other_files).toBeDefined();
    expect(res.other_files!.length).toBe(1);
    expect(res.other_files![0].fileName).toBe("06 - Planilha_Custos.xlsx");

    // 4. Valida que o índice mestre foi gravado e lista 100% dos 6 arquivos
    expect(res.indice_mestre_path).toBeDefined();
    expect(existsSync(res.indice_mestre_path!)).toBe(true);
    const masterMd = readFileSync(res.indice_mestre_path!, "utf-8");

    expect(masterMd).toContain("01 - DFD_Valido.docx");
    expect(masterMd).toContain("02 - ETP_Valido.docx");
    expect(masterMd).toContain("03 - Edital_Valido.pdf");
    expect(masterMd).toContain("04 - Docx_Corrompido.docx");
    expect(masterMd).toContain("05 - Pdf_Sem_Magic_Bytes.pdf");
    expect(masterMd).toContain("06 - Planilha_Custos.xlsx");

    // Badges de erro e de anexo presentes no markdown
    expect(masterMd).toContain("Falha de leitura");
    expect(masterMd).toContain("Anexo de dados (não inspecionado)");

    // 5. Valida payload sintético MCP (Lei 2 < 1024 bytes)
    const synthetic = formatBootstrapCaseSyntheticResult(res, "cases/resiliencia");
    const jsonStr = JSON.stringify(synthetic, null, 2);
    const byteLength = Buffer.byteLength(jsonStr, "utf-8");

    expect(byteLength).toBeLessThan(1024);
    expect(synthetic.inspection_errors_count).toBe(2);
    expect(synthetic.next_step_hint).toContain("2 ressalva(s)");
  });
});
