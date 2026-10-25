import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import {
  generateAuditDocx,
  formatGenerateAuditDocxSyntheticResult,
} from "../src/tools/audit.ts";

describe("Emissão Parametrizada de Matriz de Riscos e Checklist de Conformidade (Marco 5.4)", () => {
  const tmpDir = resolve("./test/fixtures/tmp_audit_matrix_test");

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

  it("1. Matriz de Riscos: deve gerar DOCX em layout vertical corrido A4 (zero tabelas), severidade cromática e alocação Art. 22", async () => {
    const riskJsonPath = resolve(tmpDir, "matriz_riscos.json");
    const outDocxPath = resolve(tmpDir, "matriz_riscos_saida.docx");

    const mockRiskData = {
      document_type: "RISK_MATRIX",
      processo_id: "08000.001234/2026-00",
      orgao_entidade: "ORGAO_CONTRATANTE",
      artefato_auditado: "Termo de Referência (TR)",
      regime_juridico: "Lei Federal nº 14.133/2021",
      resumo_executivo:
        "Matriz de Riscos estruturada para a contratação de serviços técnicos especializados em conformidade com o Art. 18, X e Art. 22 da Lei nº 14.133/2021.",
      matriz_riscos: [
        {
          id: "RISCO-01",
          evento_risco: "Atraso no fornecimento dos bens devido a entraves de importação",
          fase: "Execução Contratual",
          probabilidade: "Alta",
          impacto: "Alto",
          nivel_risco: "CRÍTICO",
          alocacao: "CONTRATADA",
          acoes_preventivas: "Exigência de cronograma físico-financeiro e comprovação de estoque prévio",
          acoes_contingencia: "Aplicação de multa moratória e convocação de fornecedor remanescente",
          responsavel: "Fiscal Técnico do Contrato",
        },
        {
          id: "RISCO-02",
          evento_risco: "Divergência técnica no aceite de entregáveis intermediários",
          fase: "Execução Contratual",
          probabilidade: "Média",
          impacto: "Médio",
          nivel_risco: "MÉDIO",
          alocacao: "COMPARTILHADO",
          acoes_preventivas: "Critérios objetivos de aceite com checklist bilateral",
          acoes_contingencia: "Mediação técnica pelo comitê de governança",
          responsavel: "Comitê de Fiscalização",
        },
      ],
    };

    writeFileSync(riskJsonPath, JSON.stringify(mockRiskData, null, 2), "utf-8");

    const result = await generateAuditDocx(riskJsonPath, outDocxPath);
    expect(result.success).toBe(true);
    expect(result.document_type).toBe("RISK_MATRIX");
    expect(existsSync(outDocxPath)).toBe(true);

    // Valida estrutura interna do Word XML (layout vertical sem tabelas)
    const fileBuf = readFileSync(outDocxPath);
    const zip = await JSZip.loadAsync(fileBuf);
    const docXml = await zip.file("word/document.xml")?.async("string");
    expect(docXml).toBeDefined();

    // 1. Zero tabelas (<w:tbl>)
    expect(docXml).not.toContain("<w:tbl");

    // 2. Cabeçalho e identificação
    expect(docXml).toContain("MATRIZ DE GERENCIAMENTO DE RISCOS");
    expect(docXml).toContain("08000.001234/2026-00");
    expect(docXml).toContain("ORGAO_CONTRATANTE");

    // 3. Riscos mapeados, severidade cromática e alocação
    expect(docXml).toContain("RISCO-01");
    expect(docXml).toContain("CRÍTICO");
    expect(docXml).toContain("900000"); // Cor vermelha do risco crítico
    expect(docXml).toContain("CONTRATADA");
    expect(docXml).toContain("RISCO-02");
    expect(docXml).toContain("COMPARTILHADO");

    // Valida teto MCP (< 900 bytes)
    const synthetic = formatGenerateAuditDocxSyntheticResult(result);
    const bytes = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(bytes).toBeLessThan(900);
    expect(synthetic.document_type).toBe("RISK_MATRIX");
    expect(synthetic.next_step_hint).toContain("matriz de riscos");
  });

  it("2. Matriz de Riscos: fail-fast estrito com Exact Copy-Paste Error em caso de omissão de campos obrigatórios", async () => {
    const invalidJsonPath = resolve(tmpDir, "invalid_risk.json");
    const outDocxPath = resolve(tmpDir, "out.docx");

    // Falta processo_id
    writeFileSync(
      invalidJsonPath,
      JSON.stringify(
        {
          document_type: "RISK_MATRIX",
          matriz_riscos: [{ evento_risco: "Falha geral" }],
        },
        null,
        2
      )
    );

    expect(generateAuditDocx(invalidJsonPath, outDocxPath)).rejects.toThrow(
      "Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:"
    );

    // Falta matriz_riscos
    writeFileSync(
      invalidJsonPath,
      JSON.stringify(
        {
          document_type: "RISK_MATRIX",
          processo_id: "08000.123/2026",
          matriz_riscos: [],
        },
        null,
        2
      )
    );

    expect(generateAuditDocx(invalidJsonPath, outDocxPath)).rejects.toThrow(
      "O campo 'matriz_riscos' (ou 'risk_matrix') deve conter ao menos 1 item de risco."
    );
  });

  it("3. Checklist de Conformidade: deve gerar DOCX em layout vertical corrido A4 com status e padrões TCU/AGU/MGI", async () => {
    const checklistJsonPath = resolve(tmpDir, "checklist_conformidade.json");
    const outDocxPath = resolve(tmpDir, "checklist_saida.docx");

    const mockChecklistData = {
      document_type: "COMPLIANCE_CHECKLIST",
      processo_id: "08000.009876/2026-11",
      orgao_entidade: "ORGAO_CONTRATANTE",
      artefato_auditado: "Edital de Pregão Eletrônico",
      regime_juridico: "Lei Federal nº 14.133/2021",
      resumo_executivo:
        "Avaliação preventiva de conformidade da minuta de edital e anexos com a jurisprudência sumulada do TCU e modelos padronizados da AGU.",
      checklist_conformidade: [
        {
          id: "CHK-01",
          item_criterio: "Previsão de cláusula de reajustamento de preços após 12 meses",
          status: "CONFORME",
          fundamentacao_legal: "Art. 25, § 7º da Lei nº 14.133/2021; Súmula TCU nº 282",
          evidencia: "[PAG_005 | L0042] Cláusula 12.1 da minuta",
          recomendacao: "Item regular. Manter redação.",
        },
        {
          id: "CHK-02",
          item_criterio: "Exigência de atestado de capacidade técnica com quantitativo máximo de 50%",
          status: "NÃO CONFORME",
          fundamentacao_legal: "Art. 67, § 2º da Lei nº 14.133/2021; Súmula TCU nº 263",
          evidencia: "[PAG_008 | L0015] Cláusula 9.3 exige 70% de atestação prévia",
          recomendacao: "Reduzir exigência para até 50% para não restringir a competitividade.",
        },
      ],
    };

    writeFileSync(
      checklistJsonPath,
      JSON.stringify(mockChecklistData, null, 2),
      "utf-8"
    );

    const result = await generateAuditDocx(checklistJsonPath, outDocxPath);
    expect(result.success).toBe(true);
    expect(result.document_type).toBe("COMPLIANCE_CHECKLIST");
    expect(existsSync(outDocxPath)).toBe(true);

    const fileBuf = readFileSync(outDocxPath);
    const zip = await JSZip.loadAsync(fileBuf);
    const docXml = await zip.file("word/document.xml")?.async("string");
    expect(docXml).toBeDefined();

    // 1. Zero tabelas
    expect(docXml).not.toContain("<w:tbl");

    // 2. Cabeçalho e itens
    expect(docXml).toContain("CHECKLIST DE CONFORMIDADE NORMATIVA");
    expect(docXml).toContain("08000.009876/2026-11");
    expect(docXml).toContain("CHK-01");
    expect(docXml).toContain("CONFORME");
    expect(docXml).toContain("15803D"); // Verde
    expect(docXml).toContain("CHK-02");
    expect(docXml).toContain("NÃO CONFORME");
    expect(docXml).toContain("900000"); // Vermelho

    // Valida teto MCP (< 900 bytes)
    const synthetic = formatGenerateAuditDocxSyntheticResult(result);
    const bytes = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(bytes).toBeLessThan(900);
    expect(synthetic.document_type).toBe("COMPLIANCE_CHECKLIST");
    expect(synthetic.next_step_hint).toContain("checklist de conformidade");
  });

  it("4. Checklist de Conformidade: fail-fast estrito com Exact Copy-Paste Error ao faltar status ou criterio", async () => {
    const invalidJsonPath = resolve(tmpDir, "invalid_checklist.json");
    const outDocxPath = resolve(tmpDir, "out.docx");

    writeFileSync(
      invalidJsonPath,
      JSON.stringify(
        {
          document_type: "COMPLIANCE_CHECKLIST",
          processo_id: "08000.999/2026",
          checklist_conformidade: [{ item_criterio: "Critério sem status" }],
        },
        null,
        2
      )
    );

    expect(generateAuditDocx(invalidJsonPath, outDocxPath)).rejects.toThrow(
      "Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:"
    );
  });
});
