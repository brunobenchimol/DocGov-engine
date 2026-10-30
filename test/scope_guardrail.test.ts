import { describe, test, expect, afterAll, beforeAll } from "bun:test";
import { existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import os from "node:os";
import {
  isValidDocGovCaseScope,
  assertDocGovCaseScope,
  getEphemeralInspectDir,
} from "../src/utils/paths.ts";
import { bootstrapCase } from "../src/tools/bootstrap.ts";
import { buildDocxTemplate } from "../src/tools/build_template.ts";
import { fillDocxTemplate } from "../src/tools/fill_template.ts";
import { generateAuditDocx } from "../src/tools/audit.ts";
import { generateTechnicalNoteDocx } from "../src/tools/technical_note.ts";
import { fetchPncpContract, searchPncpContracts } from "../src/tools/pncp.ts";
import { inspectDocx } from "../src/tools/inspect.ts";
import { createSampleRawDocx } from "./helpers/fixtures.ts";

describe("Testes Unitários v1.3.8: Guardrail de Escopo DocGov e Isolamento Efêmero (%TEMP%) (ENG-10)", () => {
  const outsideDir = resolve(os.tmpdir(), "outside_scope_test_" + Date.now());
  const outsideDocx = resolve(outsideDir, "anexo_externo.docx");
  const outsideJson = resolve(outsideDir, "relatorio.json");
  const outsideOutput = resolve(outsideDir, "saida.docx");

  beforeAll(async () => {
    if (!existsSync(outsideDir)) {
      mkdirSync(outsideDir, { recursive: true });
    }
    await createSampleRawDocx(outsideDocx);
    writeFileSync(outsideJson, JSON.stringify({ processo_id: "001" }, null, 2), "utf-8");
  });

  afterAll(() => {
    if (existsSync(outsideDir)) {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  // --------------------------------------------------------------------------
  // 1. Validador Canônico de Escopo (isValidDocGovCaseScope)
  // --------------------------------------------------------------------------
  test("1. isValidDocGovCaseScope: deve reconhecer caminhos legítimos do ecossistema DocGov", () => {
    expect(isValidDocGovCaseScope("cases/meu_caso")).toBe(true);
    expect(isValidDocGovCaseScope("C:/workspace/cases/caso_01/inputs/edital.pdf")).toBe(true);
    expect(isValidDocGovCaseScope("/app/cases/slug/state/estrutura.json")).toBe(true);
    expect(isValidDocGovCaseScope("cases\\caso_teste\\output\\doc.docx")).toBe(true);
    expect(isValidDocGovCaseScope("/work/eval/doc.docx")).toBe(true);
    expect(isValidDocGovCaseScope("/evals/test.docx")).toBe(true);
    expect(isValidDocGovCaseScope("templates/modelo.docx")).toBe(true);
    expect(isValidDocGovCaseScope("inputs/anexo.pdf")).toBe(true);
    expect(isValidDocGovCaseScope("state/estrutura.json")).toBe(true);
    expect(isValidDocGovCaseScope("output/final.docx")).toBe(true);
    expect(isValidDocGovCaseScope("/tmp/DocGov.EngineTests/sample.docx")).toBe(true);
    expect(isValidDocGovCaseScope("/tmp/docgov_test_xyz/doc.docx")).toBe(true);
    expect(isValidDocGovCaseScope("C:/tests/case_assert/doc.docx")).toBe(true);
  });

  test("2. isValidDocGovCaseScope: deve rejeitar pastas arbitrárias do SO fora de escopo", () => {
    expect(isValidDocGovCaseScope("C:/Users/bruno/Downloads/edital.pdf")).toBe(false);
    expect(isValidDocGovCaseScope("/tmp/outside_scope_test/anexo.docx")).toBe(false);
    expect(isValidDocGovCaseScope("C:/Users/arbitrary/document.docx")).toBe(false);
    expect(isValidDocGovCaseScope("/home/user/documentos/edital.pdf")).toBe(false);
    expect(isValidDocGovCaseScope(outsideDir)).toBe(false);
    expect(isValidDocGovCaseScope(outsideDocx)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 2. Bloqueio Fail-Fast nas 6 Ferramentas de Processo
  // --------------------------------------------------------------------------
  test("3. assertDocGovCaseScope: deve lançar erro exato com mensagem padronizada", () => {
    const expectedMsg = `Operação bloqueada fora de escopo DocGov: '${outsideDir}' não pertence a um diretório de caso 'cases/<slug>/'. Esta ferramenta é exclusiva para instrução processual dentro do ecossistema DocGov.`;
    expect(() => assertDocGovCaseScope(outsideDir, "bootstrap_case")).toThrow(expectedMsg);
  });

  test("4. bootstrap_case: deve ser bloqueado fora de escopo", async () => {
    await expect(bootstrapCase(outsideDir)).rejects.toThrow(
      "Operação bloqueada fora de escopo DocGov:"
    );
  });

  test("5. build_docx_template: deve ser bloqueado fora de escopo", async () => {
    await expect(
      buildDocxTemplate(outsideDocx, outsideJson, outsideOutput)
    ).rejects.toThrow("Operação bloqueada fora de escopo DocGov:");
  });

  test("6. fill_docx_template: deve ser bloqueado fora de escopo", async () => {
    await expect(
      fillDocxTemplate(outsideDocx, outsideJson, outsideOutput)
    ).rejects.toThrow("Operação bloqueada fora de escopo DocGov:");
  });

  test("7. generate_audit_docx: deve ser bloqueado fora de escopo", async () => {
    await expect(
      generateAuditDocx(outsideJson, outsideOutput)
    ).rejects.toThrow("Operação bloqueada fora de escopo DocGov:");
  });

  test("8. generate_technical_note_docx: deve ser bloqueado fora de escopo", async () => {
    await expect(
      generateTechnicalNoteDocx(outsideJson, outsideOutput)
    ).rejects.toThrow("Operação bloqueada fora de escopo DocGov:");
  });

  test("9. fetch_pncp: deve ser bloqueado fora de escopo", async () => {
    await expect(
      fetchPncpContract(outsideDir, "00394460000141-1-000015/2026")
    ).rejects.toThrow("Operação bloqueada fora de escopo DocGov:");
  });

  // --------------------------------------------------------------------------
  // 3. Exceções Autorizadas: Isolamento Efêmero em %TEMP% (inspect_doc e search_pncp)
  // --------------------------------------------------------------------------
  test("10. inspect_doc: deve redirecionar artefatos para %TEMP%/docgov_ephemeral_inspect/ sem poluir pasta externa", async () => {
    const ephemeralDir = getEphemeralInspectDir();
    expect(existsSync(ephemeralDir)).toBe(true);

    const result = await inspectDocx(outsideDocx);
    expect(result.doc_type).toBe("docx");
    expect(result.paragraphs.length).toBeGreaterThan(0);

    // Garante que não criou state/ ou arquivos markdown dentro da pasta outsideDir
    expect(existsSync(resolve(outsideDir, "state"))).toBe(false);
    expect(existsSync(resolve(outsideDir, "visao_auditoria_anexo_externo.md"))).toBe(false);

    // Garante que os artefatos foram gravados na pasta efêmera
    expect(result.audit_view_path).toBeDefined();
    expect(result.audit_view_path!.startsWith(ephemeralDir)).toBe(true);
    expect(existsSync(result.audit_view_path!)).toBe(true);
  });

  test("11. search_pncp: deve acumular resultados em %TEMP%/docgov_ephemeral_inspect/ quando caseDir for fora de escopo", async () => {
    const ephemeralDir = getEphemeralInspectDir();
    const result = await searchPncpContracts(outsideDir, "00394460000141/2026/15", {
      limit: 1,
    });

    expect(result.status).toBe("success");
    // Garante que não criou state/ na pasta externa
    expect(existsSync(resolve(outsideDir, "state"))).toBe(false);
    // Garante que gravou em %TEMP%/docgov_ephemeral_inspect/
    expect(existsSync(resolve(ephemeralDir, "pncp_search_results.md"))).toBe(true);
    expect(existsSync(resolve(ephemeralDir, "pncp_search_results.json"))).toBe(true);
  });
});
