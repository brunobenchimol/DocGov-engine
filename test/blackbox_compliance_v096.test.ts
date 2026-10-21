import { describe, test, expect, afterAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  inspectDocx,
  reconstructLinesFromTextItems,
  generateAuditDocx,
  fillDocxTemplate,
  formatGenerateAuditDocxSyntheticResult,
  formatFillDocxTemplateSyntheticResult,
  resolveOutputPaths,
  createSyntheticPdfBuffer,
} from "../src/index.ts";
import {
  createSuiteTempDir,
  createSampleRawDocx,
} from "./helpers/fixtures.ts";

describe("Testes de Conformidade Contratual Black-Box v0.9.6 (Asserts 12 & 13)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("blackbox_v096");

  afterAll(() => {
    cleanup();
  });

  test("CORR-01: inspectDocx deve desacoplar hotspots da Linha 1 no dossie_hotspots_<stem>.md quando o hotspot real estiver na Linha 22", async () => {
    const pdfPath = resolve(tempDir, "edital_hotspot_distante.pdf");
    const jsonPath = resolve(tempDir, "state", "estrutura_edital_hotspot_distante.json");

    // Cria um edital sintético com 35 linhas onde as primeiras 21 linhas são texto introdutório neutro
    // (sem termos de zonas Z1..Z14) e o único hotspot real (Z1: lote único) está na Linha 22
    const linesPage1 = [
      "EDITAL DE PREGÃO ELETRÔNICO Nº 10/2026 - ORGAO_CONTRATANTE", // L0001
      "PREÂMBULO E DISPOSIÇÕES INICIAIS",                         // L0002
      "O órgão torna pública a realização do certame licitatório.", // L0003
      "Regência legal pela Lei Federal nº 14.133/2021.",            // L0004
      "Sessão pública realizada integralmente em ambiente digital.", // L0005
      "Os interessados deverão enviar proposta no sistema.",        // L0006
      "Horário de início da disputa fixado para as 09:00 horas.",   // L0007
      "Critério de julgamento por menor valor econômico global.",    // L0008
      "SEÇÃO 1 - DAS CONDIÇÕES GERAIS DE PARTICIPAÇÃO",            // L0009
      "Poderão participar pessoas jurídicas do ramo pertinente.",   // L0010
      "Impedimentos legais conforme legislação em vigor.",          // L0011
      "Regularidade fiscal perante a Seguridade Social e FGTS.",    // L0012
      "Comprovação de inexistência de débitos trabalhistas CNDT.",  // L0013
      "Certidão negativa de falência ou recuperação judicial.",     // L0014
      "Declaração de cumprimento do disposto no art. 7º da CF.",    // L0015
      "SEÇÃO 2 - DA APRESENTAÇÃO DOS DOCUMENTOS",                  // L0016
      "Documentos apresentados via upload no sistema oficial.",     // L0017
      "Autenticidade conferida mediante validação eletrônica.",     // L0018
      "Prazos de manifestação e envio de anexos saneadores.",       // L0019
      "SEÇÃO 3 - DA SISTEMÁTICA DE EXECUÇÃO DO CONTRATO",          // L0020
      "O fornecimento seguirá as diretrizes deste regulamento.",    // L0021
      "A presente contratação será realizada em lote único.",       // L0022 -> Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO
      "Acompanhamento dos serviços por comissão de fiscalização.",  // L0023
      "Obrigações da contratada quanto à integridade dos bens.",    // L0024
      "SEÇÃO 4 - DOS PAGAMENTOS E CRONOGRAMA",                      // L0025
      "Pagamento efetuado em até 30 dias após ateste da nota.",     // L0026
      "Retenções tributárias nos termos da lei de regência.",       // L0027
      "Emissão de nota fiscal após conferência dos quantitativos.", // L0028
      "Conta corrente específica informada pelo fornecedor.",       // L0029
      "DISPOSIÇÕES FINAIS E FORO",                                  // L0030
      "Casos omissos serão resolvidos pela autoridade competente.", // L0031
      "Eleito o foro da sede do órgão para dirimir controvérsias.", // L0032
      "Publique-se na imprensa oficial e no PNCP.",                 // L0033
      "Data e assinatura da autoridade competente.",                // L0034
    ];

    writeFileSync(pdfPath, createSyntheticPdfBuffer([linesPage1]));

    const result = await inspectDocx(pdfPath, jsonPath, true);
    expect(result.dossie_hotspots_path).toBeDefined();
    expect(existsSync(result.dossie_hotspots_path!)).toBe(true);

    const dossieMd = readFileSync(result.dossie_hotspots_path!, "utf-8");

    // Divide Bloco 1 e Bloco 2 para verificação cirúrgica
    const bloco2 = dossieMd.split("## Bloco 2: Janelas Expandidas dos Hotspots")[1] || "";

    // 1. Verifica que a Linha 1 NÃO é marcada como ALVO no Bloco 2
    expect(bloco2).not.toContain("- **[PAG_001 | L0001]**");
    expect(dossieMd).not.toContain("*(ALVO: MISTO");
    expect(dossieMd).not.toContain("*(ALVO: PLANILHA_ORCAMENTARIA");

    // 2. Verifica que linhas introdutórias distantes (L0001 a L0008) NÃO vazaram para o Bloco 2
    expect(bloco2).not.toContain("[PAG_001 | L0001]");
    expect(bloco2).not.toContain("[PAG_001 | L0005]");
    expect(bloco2).not.toContain("[PAG_001 | L0008]");

    // 3. Verifica que a Linha 22 é o alvo real expandido com sua janela cirúrgica ±12
    expect(bloco2).toContain("[PAG_001 | L0022]");
    expect(bloco2).toContain("*(ALVO: Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO");
    expect(bloco2).toContain("lote único");
  });

  test("CORR-02: reconstructLinesFromTextItems deve reconstruir tabela com Y-Jitter (deltaY <= 2.5pt) preservando ' | ' entre todas as colunas", () => {
    // Cenário idêntico ao capturado no Assert 12 do Black-Box:
    // Células da mesma linha física com micro-variação no Y (699.4 a 701.2)
    const itemsWithYJitter = [
      { str: "01", transform: [1, 0, 0, 1, 50, 700.0], width: 15, height: 10 },
      { str: "Servidor Rack 2U", transform: [1, 0, 0, 1, 100, 701.2], width: 120, height: 10 },
      { str: "UN", transform: [1, 0, 0, 1, 260, 699.4], width: 20, height: 10 },
      { str: "10", transform: [1, 0, 0, 1, 310, 700.0], width: 15, height: 10 },
      { str: "R$ 25.000,00", transform: [1, 0, 0, 1, 370, 700.5], width: 70, height: 10 },
      { str: "R$ 250.000,00", transform: [1, 0, 0, 1, 480, 699.8], width: 80, height: 10 },
    ];

    const lines = reconstructLinesFromTextItems(itemsWithYJitter);
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe(
      "01 | Servidor Rack 2U | UN | 10 | R$ 25.000,00 | R$ 250.000,00"
    );
  });

  test("CORR-03: reconstructLinesFromTextItems deve ordenar estritamente por X e separar tokens curtos fora de ordem no stream PDF com ' | '", () => {
    // Cenário capturado no Assert 12 (Linha 2):
    // Tokens curtos emitidos em ordem aleatória pelo stream PDF
    const itemsOutOfOrder = [
      { str: "R$ 15.000,00", transform: [1, 0, 0, 1, 480, 700.0], width: 75, height: 10 },
      { str: "02", transform: [1, 0, 0, 1, 50, 699.5], width: 15, height: 10 },
      { str: "Switch 24 Portas", transform: [1, 0, 0, 1, 100, 700.8], width: 110, height: 10 },
      { str: "05", transform: [1, 0, 0, 1, 310, 700.1], width: 15, height: 10 },
      { str: "UN", transform: [1, 0, 0, 1, 250, 699.7], width: 20, height: 10 },
      { str: "R$ 3.000,00", transform: [1, 0, 0, 1, 370, 700.2], width: 65, height: 10 },
    ];

    const lines = reconstructLinesFromTextItems(itemsOutOfOrder);
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe(
      "02 | Switch 24 Portas | UN | 05 | R$ 3.000,00 | R$ 15.000,00"
    );
  });

  test("CORR-04 & CORR-05: resolveOutputPaths deve tratar corretamente modo exclusivo PDF e evitar extensões duplicadas", () => {
    // 1. Modo exclusivo PDF com caminho terminando em .pdf
    const p1 = resolveOutputPaths("cases/caso1/output/Relatorio_Exclusive.pdf", "pdf");
    expect(p1.isExclusivePdf).toBe(true);
    expect(p1.pdfPath?.replace(/\\/g, "/")).toBe(resolve("cases/caso1/output/Relatorio_Exclusive.pdf").replace(/\\/g, "/"));
    expect(p1.primaryOutputPath.replace(/\\/g, "/")).toBe(resolve("cases/caso1/output/Relatorio_Exclusive.pdf").replace(/\\/g, "/"));
    expect(p1.docxPath).toContain("__tmp_");
    expect(p1.docxPath.endsWith(".docx")).toBe(true);

    // 2. Modo exclusivo PDF com caminho fornecido como .docx
    const p2 = resolveOutputPaths("cases/caso1/output/Relatorio.docx", "pdf");
    expect(p2.isExclusivePdf).toBe(true);
    expect(p2.pdfPath?.replace(/\\/g, "/")).toBe(resolve("cases/caso1/output/Relatorio.pdf").replace(/\\/g, "/"));
    expect(p2.docxPath).toContain("__tmp_");

    // 3. Modo both
    const p3 = resolveOutputPaths("cases/caso1/output/Relatorio.docx", "both");
    expect(p3.isExclusivePdf).toBe(false);
    expect(p3.docxPath.replace(/\\/g, "/")).toBe(resolve("cases/caso1/output/Relatorio.docx").replace(/\\/g, "/"));
    expect(p3.pdfPath?.replace(/\\/g, "/")).toBe(resolve("cases/caso1/output/Relatorio.pdf").replace(/\\/g, "/"));

    // 4. Modo padrão docx
    const p4 = resolveOutputPaths("cases/caso1/output/Relatorio.pdf", "docx");
    expect(p4.isExclusivePdf).toBe(false);
    expect(p4.docxPath.replace(/\\/g, "/")).toBe(resolve("cases/caso1/output/Relatorio.docx").replace(/\\/g, "/"));
    expect(p4.pdfPath).toBeUndefined();
  });

  test("CORR-04 & CORR-05: generateAuditDocx com outputFormat: 'pdf' deve gerar PDF exclusivo sem resíduo DOCX e sem duplicação .pdf.pdf", async () => {
    const auditJsonPath = resolve(tempDir, "relatorio_exclusive_audit.json");
    const targetPdfPath = resolve(tempDir, "Relatorio_Auditoria_Exclusive.pdf");

    writeFileSync(
      auditJsonPath,
      JSON.stringify(
        {
          processo_id: "PROC-2026/096",
          orgao_entidade: "ORGAO_CONTRATANTE",
          artefato_auditado: "Edital e TR",
          resumo_executivo: "Auditoria black-box final v0.9.6 concluída com conformidade plena.",
          apontamentos: [
            {
              id: "AP-01",
              severidade: "ALERTA PREVENTIVO",
              titulo_apontamento: "Conformidade Contratual Aprovada",
              base_legal: "Art. 40 da Lei nº 14.133/2021",
              localizacao: "Cláusula 3",
              trecho_impugnado: "Texto conforme.",
              risco_controle_externo: "Nenhum risco.",
              redacao_saneadora_sugerida: "Manter redação.",
            },
          ],
        },
        null,
        2
      )
    );

    const res = await generateAuditDocx(auditJsonPath, targetPdfPath, {
      outputFormat: "pdf",
    });

    expect(res.success).toBe(true);
    expect(res.outputPath).toBe(targetPdfPath);
    expect(res.pdf_path).toBe(targetPdfPath);

    // 1. O arquivo alvo .pdf deve existir e ter cabeçalho %PDF-
    expect(existsSync(targetPdfPath)).toBe(true);
    const header = readFileSync(targetPdfPath).subarray(0, 5).toString("utf-8");
    expect(header).toBe("%PDF-");

    // 2. Não deve existir nenhum .pdf.pdf nem arquivo .docx intermediário no diretório
    const duplicatePdf = resolve(tempDir, "Relatorio_Auditoria_Exclusive.pdf.pdf");
    const docxPath = resolve(tempDir, "Relatorio_Auditoria_Exclusive.docx");
    expect(existsSync(duplicatePdf)).toBe(false);
    expect(existsSync(docxPath)).toBe(false);

    // 3. Payload sintético respeita a Lei 2 (< 1024 bytes)
    const synthetic = formatGenerateAuditDocxSyntheticResult(res, tempDir);
    expect(synthetic.status).toBe("success");
    expect(synthetic.outputPath).toBe("Relatorio_Auditoria_Exclusive.pdf");
    expect(synthetic.pdf_path).toBe("Relatorio_Auditoria_Exclusive.pdf");
    expect(Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8")).toBeLessThan(1024);
  });

  test("CORR-04 & CORR-05: fillDocxTemplate com outputFormat: 'pdf' e caminho .pdf deve auto-inspecionar o PDF sem resíduo DOCX", async () => {
    const inputDocx = resolve(tempDir, "template_exclusive.docx");
    const stateJson = resolve(tempDir, "state", "estado_exclusive.json");
    const targetPdf = resolve(tempDir, "output", "Documento_Exclusive.pdf");

    await createSampleRawDocx(inputDocx);

    writeFileSync(
      stateJson,
      JSON.stringify({
        processo_id: "PROC-2026/096",
        objeto: { descricao: "Solução de Armazenamento Corporativo" },
      })
    );

    const res = await fillDocxTemplate(inputDocx, stateJson, targetPdf, {
      outputFormat: "pdf",
      autoInspect: true,
    });

    expect(res.success).toBe(true);
    expect(res.outputPath).toBe(targetPdf);
    expect(res.pdf_path).toBe(targetPdf);
    expect(existsSync(targetPdf)).toBe(true);
    expect(readFileSync(targetPdf).subarray(0, 5).toString("utf-8")).toBe("%PDF-");

    // Não deve existir nenhum DOCX na pasta output
    const leftoverDocx = resolve(tempDir, "output", "Documento_Exclusive.docx");
    const duplicatePdf = resolve(tempDir, "output", "Documento_Exclusive.pdf.pdf");
    expect(existsSync(leftoverDocx)).toBe(false);
    expect(existsSync(duplicatePdf)).toBe(false);

    // Auto-inspeção gerou inspecao_*.json e visao_auditoria_*.md para o PDF
    expect(res.inspection_path).toBeDefined();
    expect(existsSync(res.inspection_path!)).toBe(true);
    expect(res.visao_auditoria_path).toBeDefined();
    expect(existsSync(res.visao_auditoria_path!)).toBe(true);

    const synthetic = formatFillDocxTemplateSyntheticResult(res, tempDir);
    expect(synthetic.status).toBe("success");
    expect(synthetic.pdf_path).toBe("output/Documento_Exclusive.pdf");
    expect(Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8")).toBeLessThan(1024);
  });
});
