import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import {
  generateTechnicalNoteDocx,
  formatTechnicalNoteSyntheticResult,
} from "../src/tools/technical_note.ts";
import type { TechnicalNoteData } from "../src/types/index.ts";

describe("Renderizador Editorial A4 da Nota Técnica Comparativa (Marco 6.2 — v1.3.0)", () => {
  const tmpDir = resolve("./test/fixtures/tmp_technical_note_test");

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

  it("1. deve gerar DOCX em layout vertical corrido A4 (zero tabelas), cartões Antes vs. Depois e fundamentação jurídica", async () => {
    const noteJsonPath = resolve(tmpDir, "nota_tecnica.json");
    const outDocxPath = resolve(tmpDir, "Nota_Tecnica_Saida.docx");

    const mockNoteData: TechnicalNoteData = {
      document_type: "TECHNICAL_NOTE",
      processo_id: "08000.001234/2026-00",
      orgao_entidade: "ORGAO_CONTRATANTE",
      artefato_auditado: "Termo de Referência (TR)",
      versao_anterior: "Minuta v1.0",
      versao_nova: "Minuta Saneada v2.0",
      regime_juridico: "Lei Federal nº 14.133/2021",
      resumo_executivo:
        "Nota Técnica demonstrando o saneamento das cláusulas restritivas com fulcro nos enunciados do TCU e AGU.",
      quadro_evolucao: [
        {
          id: "EVO-01",
          slot_id: "P14",
          coordenada: "[P14]",
          secao_titulo: "Cláusula 5ª — Do Prazo de Entrega e Garantia",
          tipo_alteracao: "MODIFICACAO",
          redacao_anterior:
            "O prazo de entrega dos bens será impreterivelmente de 10 dias corridos sob pena de rescisão.",
          redacao_nova:
            "O prazo de entrega dos bens será de até 30 dias úteis admitida prorrogação justificada.",
          justificativa_tecnica:
            "Adequação ao prazo de fabricação apurado na pesquisa de mercado, prevenindo licitação deserta.",
          fundamentacao_juridica:
            "Art. 18, inc. X da Lei nº 14.133/2021; Acórdão TCU nº 1234/2023-Plenário.",
          impacto_risco: "Saneamento de cláusula restritiva de prazo (Zona Z8).",
        },
        {
          id: "EVO-02",
          coordenada: "[P22]",
          secao_titulo: "Cláusula 9ª — Da Matriz de Alocação de Riscos",
          tipo_alteracao: "INCLUSAO",
          redacao_nova:
            "Fica estabelecida a matriz de riscos em conformidade com o Art. 22 da Lei nº 14.133/2021.",
          justificativa_tecnica:
            "Inclusão obrigatória de cláusula de governança e partilha de riscos contratuais.",
          fundamentacao_juridica:
            "Art. 18, inc. X e Art. 22 da Lei nº 14.133/2021; Parecer Referencial AGU nº 01/2023.",
        },
      ],
      delta_zonas: [
        {
          zone_id: "Z8_PRAZOS_ENTREGA_SLA_GARANTIA",
          zone_title: "Z8: Prazos, SLA e Garantia",
          status: "RESOLVED",
          old_occurrences_count: 1,
          new_occurrences_count: 0,
          details: "🟢 SANEADO: Prazo exíguo flexibilizado de acordo com o mercado.",
        },
      ],
      conclusao_encaminhamento:
        "Submete-se o processo à Consultoria Jurídica com parecer favorável.",
    };

    writeFileSync(noteJsonPath, JSON.stringify(mockNoteData, null, 2), "utf-8");

    const result = await generateTechnicalNoteDocx(noteJsonPath, outDocxPath);
    expect(result.success).toBe(true);
    expect(result.total_changes).toBe(2);
    expect(existsSync(outDocxPath)).toBe(true);

    // Validação profunda do Word XML
    const fileBuf = readFileSync(outDocxPath);
    const zip = await JSZip.loadAsync(fileBuf);
    const docXml = await zip.file("word/document.xml")?.async("string");
    expect(docXml).toBeDefined();

    // 1. Zero tabelas (<w:tbl>)
    expect(docXml).not.toContain("<w:tbl");

    // 2. Cabeçalho formal e identificação processual
    expect(docXml).toContain("NOTA TÉCNICA COMPARATIVA DE EVOLUÇÃO E SANEAMENTO DOCUMENTAL");
    expect(docXml).toContain("08000.001234/2026-00");
    expect(docXml).toContain("ORGAO_CONTRATANTE");
    expect(docXml).toContain("Termo de Referência (TR)");

    // 3. Cartões "Antes vs. Depois", tarjas cromáticas e fundamentações
    expect(docXml).toContain("EVO-01");
    expect(docXml).toContain("MODIFICAÇÃO");
    expect(docXml).toContain("Redação Anterior (Original)");
    expect(docXml).toContain("Nova Redação Saneadora");
    expect(docXml).toContain("10 dias corridos");
    expect(docXml).toContain("30 dias úteis");
    expect(docXml).toContain("Adequação ao prazo de fabricação");
    expect(docXml).toContain("Acórdão TCU nº 1234/2023-Plenário");

    // 4. Cartão de Inclusão
    expect(docXml).toContain("EVO-02");
    expect(docXml).toContain("INCLUSÃO");
    expect(docXml).toContain("Art. 22 da Lei nº 14.133/2021");

    // 5. Delta das 14 Zonas
    expect(docXml).toContain("SANEADO");
    expect(docXml).toContain("Z8: Prazos, SLA e Garantia");

    // 6. Teto MCP (< 900 bytes)
    const synthetic = formatTechnicalNoteSyntheticResult(result);
    const bytes = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(bytes).toBeLessThan(900);
    expect(synthetic.document_type).toBe("TECHNICAL_NOTE");
    expect(synthetic.total_changes).toBe(2);
    expect(synthetic.next_step_hint).toContain("Nota Técnica Comparativa pronta");
  });

  it("2. deve suportar exportação com outputFormat: 'pdf'", async () => {
    const noteJsonPath = resolve(tmpDir, "nota.json");
    const outPdfPath = resolve(tmpDir, "Nota_Tecnica.pdf");

    const mockNoteData: TechnicalNoteData = {
      document_type: "TECHNICAL_NOTE",
      processo_id: "08000.005678/2026-11",
      orgao_entidade: "ORGAO_CONTRATANTE",
      artefato_auditado: "Edital",
      resumo_executivo: "Resumo executivo de saneamento.",
      quadro_evolucao: [
        {
          id: "EVO-01",
          secao_titulo: "Cláusula 1",
          tipo_alteracao: "MODIFICACAO",
          redacao_anterior: "Texto antigo",
          redacao_nova: "Texto saneado",
          justificativa_tecnica: "Motivação",
          fundamentacao_juridica: "Art. 18",
        },
      ],
    };

    writeFileSync(noteJsonPath, JSON.stringify(mockNoteData, null, 2), "utf-8");

    const result = await generateTechnicalNoteDocx(noteJsonPath, outPdfPath, {
      outputFormat: "pdf",
    });

    expect(result.success).toBe(true);
    expect(result.pdf_path).toBeDefined();
    expect(existsSync(outPdfPath)).toBe(true);

    const pdfBuf = readFileSync(outPdfPath);
    expect(pdfBuf.slice(0, 4).toString("utf-8")).toBe("%PDF");
  });
});
