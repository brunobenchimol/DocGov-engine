import { describe, test, expect, afterAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import {
  generateAuditDocx,
  formatGenerateAuditDocxSyntheticResult,
  cleanHumanText,
  inspectDocx,
  EXACT_COPY_PASTE_AUDIT_REPORT_SNIPPET,
  VERSION,
} from "../src/index.ts";
import { createSuiteTempDir } from "./helpers/fixtures.ts";

describe("Testes Unitários: generate_audit_docx (Layout A4, Zero Tabelas, Copy-Paste Error)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("audit");

  afterAll(() => {
    cleanup();
  });

  test("deve gerar relatório de auditoria em layout vertical corrido A4 (ZERO tabelas), múltiplos trechos por ID e sanitização de texto (generateAuditDocx v0.3.1)", async () => {
    const auditJsonPath = resolve(tempDir, "relatorio_auditoria_etp.json");
    const auditDocxPath = resolve(tempDir, "Relatorio_Auditoria_ETP.docx");

    expect(
      cleanHumanText(
        "No arquivo `cases/caso_exemplo/output/ETP_Exemplo.docx` [T0:R30:C1] [P034] ocorreu `V5_FALSA_PLURALIDADE`"
      )
    ).toBe(
      "No arquivo ETP_Exemplo.docx ocorreu Levantamento de Mercado e Parcelamento do Objeto"
    );

    const mockAuditData = {
      processo_id: "`PROC-2026/12345`",
      orgao_entidade: "Secretaria Executiva Demandante (ORGAO_DEMANDANTE)",
      artefato_auditado: "cases/caso_exemplo/output/ETP_Exemplo.docx",
      regime_juridico: "Lei Federal nº 14.133/2021 e Regulamento Local",
      iteracao_auditoria: 1,
      status_global: "APTO COM ALERTAS",
      contagem: {
        bloqueantes: 0,
        alertas: 2,
        conformes: 12,
      },
      resumo_executivo:
        "**Parecer Preliminar:** O documento `cases/caso_exemplo/output/ETP_Exemplo.docx` apresenta aderência geral.\nContudo, exige saneamento preventivo nos trechos destacados.",
      apontamentos: [
        {
          id: "AUD-01",
          severidade: "ALERTA",
          vulnerabilidade: "V5_FALSA_PLURALIDADE",
          base_legal: "Lei nº 14.133/2021, art. 18, § 1º, IV e VI; Súmula de Jurisprudência nº 247",
          trechos_documento: [
            {
              secao_legivel: "[T0:R30:C1] Seção 4 — Levantamento de Mercado",
              texto_transcrito:
                "Foram identificadas `apenas duas soluções` proprietárias que atendem integralmente ao lote único.",
            },
            {
              secao_legivel: "[P034] Seção 8 — Justificativa para o Não Parcelamento",
              texto_transcrito:
                "O agrupamento em lote único mostra-se mais conveniente para a gestão contratual.",
            },
          ],
          risco_controle_externo:
            "Risco elevado de questionamento pelo Órgão de Controle em razão da combinação entre levantamento restrito (`[T0:R30:C1]`) e ausência de demonstração técnica de inviabilidade de parcelamento (`[P034]`).",
          redacao_saneadora_sugerida:
            "**Reestruturar a justificativa** demonstrando, com dados objetivos de mercado, a inviabilidade técnica ou perda de economia de escala na divisão em itens.",
        },
        {
          id: "AUD-02",
          severidade: "BLOQUEANTE",
          titulo_apontamento: "Exigência de Marca ou Especificação Restritiva",
          base_legal: "Lei nº 14.133/2021, art. 41, I",
          localizacao: "[T0:R12:C1] Seção 3 — Requisitos da Contratação",
          trecho_impugnado:
            "Processador exclusivo da linha ` Modelo X-Pro 9900 ` sem menção a equivalência.",
          analise_risco:
            "Configura direcionamento vedado pelo art. 41 da Lei nº 14.133/2021.",
          redacao_saneadora:
            "Inserir a expressão **«ou equivalente, ou similar, ou de melhor qualidade»** acompanhada de parâmetros objetivos de desempenho.",
        },
      ],
      metadados_agente: {
        coordenada_interna: "[T0:R30:C1]",
        token_debug: "SEGREDO_DE_MAQUINA_NAO_IMPRIMIR",
      },
    };
    writeFileSync(auditJsonPath, JSON.stringify(mockAuditData, null, 2), "utf-8");

    const res = await generateAuditDocx(auditJsonPath, auditDocxPath);
    expect(res.success).toBe(true);
    expect(existsSync(auditDocxPath)).toBe(true);

    const syntheticAudit = formatGenerateAuditDocxSyntheticResult(res);
    expect(syntheticAudit.status).toBe("success");
    expect(syntheticAudit.engine_version).toBe(VERSION);
    expect(syntheticAudit.engine_version).toBe("0.7.1");
    expect(syntheticAudit.outputPath).toContain("Relatorio_Auditoria_ETP.docx");
    expect(syntheticAudit.next_step_hint).toContain("Ciclo de auditoria concluído");
    expect(
      Buffer.byteLength(JSON.stringify(syntheticAudit, null, 2), "utf-8")
    ).toBeLessThan(1024);

    const auditZip = await JSZip.loadAsync(readFileSync(auditDocxPath));
    const auditXml = await auditZip.file("word/document.xml")!.async("string");
    expect(auditXml).not.toContain("<w:tbl");
    expect(auditXml).not.toContain("`");
    expect(auditXml).not.toContain("[T0:");
    expect(auditXml).not.toContain("[P034]");
    expect(auditXml).not.toContain("V5_FALSA_PLURALIDADE");
    expect(auditXml).not.toContain("SEGREDO_DE_MAQUINA_NAO_IMPRIMIR");
    expect(auditXml).not.toContain("cases/caso_exemplo/output/");

    const auditInspection = await inspectDocx(auditDocxPath);
    expect(auditInspection.tables.length).toBe(0);

    const allParagraphTexts = auditInspection.paragraphs.map((p) => p.text);

    expect(allParagraphTexts[0]).toBe(
      "PARECER DE AUDITORIA TÉCNICO-JURÍDICA E CONTROLE DE DIRECIONAMENTO"
    );
    expect(allParagraphTexts[1]).toBe(
      "Auditoria Cega de Conformidade Legal e Competitividade (Controle Externo)"
    );

    expect(allParagraphTexts).toContain("1. IDENTIFICAÇÃO E ESCOPO DA AUDITORIA");
    expect(allParagraphTexts).toContain("Processo: PROC-2026/12345");
    expect(allParagraphTexts).toContain("Documento Auditado: ETP_Exemplo.docx");
    expect(allParagraphTexts).toContain(
      "Diagnóstico Global: APTO COM ALERTAS PREVENTIVOS (0 Bloqueantes | 2 Alertas | 12 Conformes)"
    );

    expect(allParagraphTexts).toContain("2. PARECER EXECUTIVO DE CONTROLE EXTERNO");
    expect(allParagraphTexts).toContain(
      "Parecer Preliminar: O documento ETP_Exemplo.docx apresenta aderência geral."
    );

    expect(allParagraphTexts).toContain(
      "3. DETALHAMENTO INDIVIDUALIZADO DOS APONTAMENTOS (ID POR ID)"
    );
    expect(allParagraphTexts).toContain(
      "[AUD-01] ALERTA PREVENTIVO — Levantamento de Mercado e Parcelamento do Objeto"
    );
    expect(allParagraphTexts).toContain(
      "• Trecho 1 — Localização no documento: Seção 4 — Levantamento de Mercado"
    );
    expect(allParagraphTexts).toContain(
      '"«Foram identificadas apenas duas soluções proprietárias que atendem integralmente ao lote único.»"'
    );
    expect(allParagraphTexts).toContain(
      "• Trecho 2 — Localização no documento: Seção 8 — Justificativa para o Não Parcelamento"
    );
    expect(allParagraphTexts).toContain(
      '"«O agrupamento em lote único mostra-se mais conveniente para a gestão contratual.»"'
    );
    expect(allParagraphTexts).toContain(
      "[AUD-02] BLOQUEANTE — Exigência de Marca ou Especificação Restritiva"
    );
  });

  test("deve aplicar Exact Copy-Paste Error estrito em relatorio_auditoria.json caso processo_id ou resumo_executivo estejam ausentes ou inválidos (v0.6.2)", async () => {
    const invalidAuditPath = resolve(tempDir, "invalid_audit.json");
    const outAuditDocx = resolve(tempDir, "out_invalid_audit.docx");

    // 1. Arquivo sem processo_id
    writeFileSync(
      invalidAuditPath,
      JSON.stringify({ resumo_executivo: "Resumo sem ID" }),
      "utf-8"
    );
    let errAudit1: any;
    try {
      await generateAuditDocx(invalidAuditPath, outAuditDocx);
    } catch (e: any) {
      errAudit1 = e;
    }
    expect(errAudit1).toBeDefined();
    expect(errAudit1.message).toContain("NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errAudit1.message).toContain("processo_id");
    expect(errAudit1.message).toContain(EXACT_COPY_PASTE_AUDIT_REPORT_SNIPPET);
    expect(errAudit1.message).toContain("ORGAO_CONTRATANTE");

    // 2. Arquivo sem resumo_executivo
    writeFileSync(
      invalidAuditPath,
      JSON.stringify({ processo_id: "08000.001/2026" }),
      "utf-8"
    );
    let errAudit2: any;
    try {
      await generateAuditDocx(invalidAuditPath, outAuditDocx);
    } catch (e: any) {
      errAudit2 = e;
    }
    expect(errAudit2).toBeDefined();
    expect(errAudit2.message).toContain("NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errAudit2.message).toContain("resumo_executivo");

    // 3. Campo apontamentos não-array
    writeFileSync(
      invalidAuditPath,
      JSON.stringify({
        processo_id: "08000.001/2026",
        resumo_executivo: "Resumo válido",
        apontamentos: "não sou um array",
      }),
      "utf-8"
    );
    let errAudit3: any;
    try {
      await generateAuditDocx(invalidAuditPath, outAuditDocx);
    } catch (e: any) {
      errAudit3 = e;
    }
    expect(errAudit3).toBeDefined();
    expect(errAudit3.message).toContain("NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:");
    expect(errAudit3.message).toContain("apontamentos");
  });
});
