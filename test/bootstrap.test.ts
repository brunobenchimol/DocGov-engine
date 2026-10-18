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
    expect(syntheticMcp.engine_version).toBe("0.7.2");
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

    // Valida ingestedFiles
    expect(res.ingestedFiles).toBeDefined();
    expect(res.ingestedFiles!.length).toBe(4);

    // Valida payload sintético MCP (< 1024 bytes estrito)
    const synthetic = formatBootstrapCaseSyntheticResult(res, "cases/v051");
    const jsonStr = JSON.stringify(synthetic, null, 2);
    const byteLength = Buffer.byteLength(jsonStr, "utf-8");

    expect(byteLength).toBeLessThan(1024);
    expect(synthetic.engine_version).toBe(VERSION);
    expect(synthetic.engine_version).toBe("0.7.2");
    expect(synthetic.ingested_files).toBeDefined();
    expect(synthetic.ingested_files!.length).toBe(4);
    expect(synthetic.ingested_files![0].saved_as).toBe("ETP_ORGAO_A_3b9d.docx");
    expect(synthetic.ingested_files![0].type).toBe("ETP");
    expect(synthetic.ingested_files![0].structure).toBe("state/estrutura_ETP_ORGAO_A_3b9d.json");
  });
});
