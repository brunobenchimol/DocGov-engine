import { describe, test, expect } from "bun:test";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import {
  formatBootstrapCaseSyntheticResult,
  formatInspectDocxSyntheticResult,
  inspectDocx,
  bootstrapCase,
  createSyntheticPdfBuffer,
  generateHotspotsDossierMarkdown,
  reconstructLinesFromTextItems,
} from "../src/index.ts";
import { createSampleRawDocx } from "./helpers/fixtures.ts";

describe("Testes Unitários v0.9.0: Reconstrução Espacial de Tabelas e Colunas em PDF (Y-Axis Line Grouping)", () => {
  test("1. reconstructLinesFromTextItems deve ordenar linhas por Y decrescente mesmo quando os itens chegam fora de ordem e separar colunas com ' | '", () => {
    const items = [
      // Linha 2 (Y=700) emitida em ordem aleatória de colunas
      { str: "R$ 5.000,00", transform: [1, 0, 0, 1, 450, 700], width: 60, height: 10 },
      { str: "Item 01", transform: [1, 0, 0, 1, 50, 700], width: 40, height: 10 },
      { str: "Notebook Corporativo", transform: [1, 0, 0, 1, 150, 700], width: 120, height: 10 },
      { str: "50 UN", transform: [1, 0, 0, 1, 350, 700], width: 35, height: 10 },
      // Linha 1 (Y=750) no topo
      { str: "EDITAL DE PREGÃO ELETRÔNICO", transform: [1, 0, 0, 1, 50, 750], width: 200, height: 12 },
    ];

    const lines = reconstructLinesFromTextItems(items);

    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("EDITAL DE PREGÃO ELETRÔNICO");
    expect(lines[1]).toBe("Item 01 | Notebook Corporativo | 50 UN | R$ 5.000,00");
  });

  test("2. reconstructLinesFromTextItems deve manter texto corrido contínuo com espaço normal quando gap < 18pt", () => {
    const itemsContinuous = [
      { str: "A", transform: [1, 0, 0, 1, 50, 700], width: 10, height: 10 },
      { str: "contratação", transform: [1, 0, 0, 1, 65, 700], width: 60, height: 10 },
      { str: "em", transform: [1, 0, 0, 1, 130, 700], width: 15, height: 10 },
      { str: "lote", transform: [1, 0, 0, 1, 150, 700], width: 25, height: 10 },
      { str: "único", transform: [1, 0, 0, 1, 180, 700], width: 30, height: 10 },
    ];

    const lines = reconstructLinesFromTextItems(itemsContinuous);

    expect(lines.length).toBe(1);
    expect(lines[0]).toBe("A contratação em lote único");
  });

  test("3. reconstructLinesFromTextItems deve eliminar duplicatas exatas de sobreposição (bold/shadowing)", () => {
    const itemsShadow = [
      { str: "TERMO DE REFERÊNCIA", transform: [1, 0, 0, 1, 50, 700], width: 140, height: 10 },
      { str: "TERMO DE REFERÊNCIA", transform: [1, 0, 0, 1, 50.5, 700.2], width: 140, height: 10 },
    ];

    const lines = reconstructLinesFromTextItems(itemsShadow);

    expect(lines.length).toBe(1);
    expect(lines[0]).toBe("TERMO DE REFERÊNCIA");
  });

  test("4. inspectDocx em arquivo .pdf deve gerar automaticamente state/dossie_hotspots_<stem>.md com Bloco 1 e Bloco 2 (±12 linhas)", async () => {
    const suiteDir = resolve(process.cwd(), "cases", "_test_temp_v090_dossie");
    mkdirSync(resolve(suiteDir, "state"), { recursive: true });

    const pdfPath = resolve(suiteDir, "edital_dossie_teste.pdf");
    const outJsonPath = resolve(suiteDir, "state", "estrutura_edital_dossie_teste.json");
    const samplePages = [
      [
        "EDITAL DE PREGÃO ELETRÔNICO Nº 01/2026 - ORGAO_CONTRATANTE",
        "PREÂMBULO",
        "1. DO OBJETO DA LICITAÇÃO",
        "O presente pregão tem por objeto a contratação em lote único de soluções corporativas.",
        "CLÁUSULA 2 - DA HABILITAÇÃO E QUALIFICAÇÃO TÉCNICA",
        "Apresentação de atestado de capacidade técnica emitido por pessoa jurídica.",
        "MINUTA DE CONTRATO",
      ],
      [
        "ANEXO I - TERMO DE REFERÊNCIA",
        "Especificação de fornecimento em lote único e subcontratação vedada.",
        "Prazo de entrega em 30 dias corridos com SLA de atendimento em 4 horas.",
        "Exigência de patrimônio líquido mínimo e garantia contratual de 5%.",
        "Vistoria técnica presencial in loco facultativa com declaração de conhecimento.",
        "Apresentação de amostra e prova de conceito PoC em 5 dias úteis.",
        "Exigência de carta de credenciamento do fabricante oficial.",
      ],
      [
        "ANEXO II - ESPECIFICAÇÕES TÉCNICAS E DATASHEET",
        "Processador com frequência mínima de 3.2 GHz, 128 GB de memória RAM.",
        "Armazenamento de 2 TB NVMe com taxa de transferência de 10 Gbps e 100.000 IOPS.",
        "Equipamento deve possuir certificação ABNT NBR ISO 9001 e garantia on-site de 36 meses.",
        "Padronização com o parque instalado de marca Dell ou equivalente.",
        "Métrica de faturamento por unidade de medida UST conforme catálogo de serviços.",
        "Pagamento mediante medição de resultado com IMR e índice de reajuste IPCA.",
      ],
    ];

    writeFileSync(pdfPath, createSyntheticPdfBuffer(samplePages));

    const result = await inspectDocx(pdfPath, outJsonPath, true);
    expect(result.dossie_hotspots_path).toBeDefined();
    expect(existsSync(result.dossie_hotspots_path!)).toBe(true);

    const dossieContent = readFileSync(result.dossie_hotspots_path!, "utf-8");
    expect(dossieContent).toContain("# Dossiê Executivo de Hotspots: edital_dossie_teste.pdf");
    expect(dossieContent).toContain("## Bloco 1: Mapa Cartográfico Estrutural e Radar das 14 Zonas de Impugnação");
    expect(dossieContent).toContain("## Bloco 2: Janelas Expandidas dos Hotspots (±12 Linhas de Contexto)");
    expect(dossieContent).toContain("### Hotspot 1:");
    expect(dossieContent).toContain("*(ALVO:");
    expect(dossieContent).toContain("Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO");

    // Verifica que o payload sintético inclui dossie_path e respeita o teto de 1024 bytes (Lei 2)
    const synthetic = formatInspectDocxSyntheticResult(pdfPath, outJsonPath, result);
    expect(synthetic.dossie_path).toBeDefined();
    expect(synthetic.dossie_path).toContain("dossie_hotspots_edital_dossie_teste.md");
    const byteLen = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(byteLen).toBeLessThan(1024);

    rmSync(suiteDir, { recursive: true, force: true });
  });

  test("5. generateHotspotsDossierMarkdown deve fundir intervalos contíguos de hotspots em bloco unificado", () => {
    const dummyExtraction = {
      pageCount: 1,
      lineCount: 20,
      pages: [
        {
          pageNumber: 1,
          lines: Array.from({ length: 20 }, (_, i) => ({
            page: 1,
            line: i + 1,
            coord: `PAG_001 | L${String(i + 1).padStart(4, "0")}`,
            bracket_coord: `[PAG_001 | L${String(i + 1).padStart(4, "0")}]`,
            text: `Linha de teste ${i + 1} com conteúdo licitatório genérico.`,
          })),
        },
      ],
      lines: Array.from({ length: 20 }, (_, i) => ({
        page: 1,
        line: i + 1,
        coord: `PAG_001 | L${String(i + 1).padStart(4, "0")}`,
        bracket_coord: `[PAG_001 | L${String(i + 1).padStart(4, "0")}]`,
        text: `Linha de teste ${i + 1} com conteúdo licitatório genérico.`,
      })),
    };

    const dummyCartography = {
      outline_headings: [],
      page_signals: [],
      impugnation_zones: {
        Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO: [
          { coord: "[PAG_001 | L0005]", keyword: "lote único", snippet: "lote único", section: "SECAO_A" },
        ],
        Z2_QUALIFICACAO_TECNICA_ATESTADOS: [
          { coord: "[PAG_001 | L0008]", keyword: "atestado", snippet: "atestado", section: "SECAO_A" },
        ],
        Z3_QUALIFICACAO_ECONOMICA_GARANTIAS: [],
        Z4_VISTORIA_VISITA_TECNICA: [],
        Z5_AMOSTRA_POC_HOMOLOGACAO: [],
        Z6_VINCULO_FABRICANTE_SOLIDARIEDADE: [],
        Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP: [],
        Z8_PRAZOS_ENTREGA_SLA_GARANTIA: [],
        Z9_EQUIPE_CERTIFICACOES_SEDE: [],
        Z10_PRECOS_EXEQUIBILIDADE_PLANILHA: [],
        Z11_PAGAMENTO_REAJUSTE_IMR_SANCOES: [],
        Z12_MAPA_CRUZADO_MULTIPECA: [],
        Z13_MARCA_EXPLICITA_PADRONIZACAO_NICHO: [],
        Z14_METRICA_UNIDADE_MEDIDA_E_LICENCIAMENTO: [],
      },
    };

    const md = generateHotspotsDossierMarkdown("teste.pdf", dummyExtraction, dummyCartography);
    // Linha 5 e Linha 8 estão dentro do intervalo de ±12 linhas (distância 3), logo devem ser fundidas em 1 único Hotspot
    expect(md).toContain("### Hotspot 1: [PAG_001 | L0001] .. [PAG_001 | L0020]");
    expect(md).not.toContain("### Hotspot 2:");
  });

  test("6. Detector de Páginas Escaneadas (Scanned PDF Trap): deve detectar densidade < 25 chars, retornar scanned_pages_detected e inserir marcador de alerta crítico", async () => {
    const suiteDir = resolve(process.cwd(), "cases", "_test_temp_v090_scanned");
    mkdirSync(resolve(suiteDir, "state"), { recursive: true });

    const pdfPath = resolve(suiteDir, "edital_com_pagina_escaneada.pdf");
    const outJsonPath = resolve(suiteDir, "state", "estrutura_edital_com_pagina_escaneada.json");

    // Página 1: Normal (> 25 chars)
    // Página 2: Escaneada (vazia ou quase vazia: "1" ou "")
    // Página 3: Normal (> 25 chars)
    const pagesContent = [
      [
        "EDITAL DE PREGÃO ELETRÔNICO Nº 01/2026 - ORGAO_CONTRATANTE",
        "PREÂMBULO E REGRAS GERAIS DE CONTRATAÇÃO PÚBLICA",
      ],
      [
        "2", // Apenas número de página isolado (1 char, < 25 chars)
      ],
      [
        "ANEXO I - TERMO DE REFERÊNCIA E DETALHAMENTO DO OBJETO",
        "ESPECIFICAÇÕES TÉCNICAS E CONDIÇÕES DE FORNECIMENTO",
      ],
    ];

    writeFileSync(pdfPath, createSyntheticPdfBuffer(pagesContent));

    const result = await inspectDocx(pdfPath, outJsonPath, true);

    expect(result.scanned_pages_detected).toBeDefined();
    expect(result.scanned_pages_detected).toEqual([2]);

    // Verifica que o marcador de alerta crítico foi injetado na visao_auditoria_*.md
    expect(result.audit_view_path).toBeDefined();
    const auditMd = readFileSync(result.audit_view_path!, "utf-8");
    expect(auditMd).toContain("[ALERTA CRÍTICO: PÁGINA ESCANEADA COMO IMAGEM — SEM CAMADA DE TEXTO EXTRAÍVEL]");
    expect(auditMd).toContain("### Página 002");

    // Verifica que o retorno sintético MCP expõe scanned_pages e o hint de alerta
    const synthetic = formatInspectDocxSyntheticResult(pdfPath, outJsonPath, result);
    expect(synthetic.scanned_pages).toEqual([2]);
    expect(synthetic.next_step_hint).toContain("ALERTA: páginas escaneadas detectadas (2)");
    const byteLen = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(byteLen).toBeLessThan(1024);

    rmSync(suiteDir, { recursive: true, force: true });
  });

  test("7. bootstrapCase com múltiplos arquivos deve consolidar state/indice_mestre_caso.md mapeando documentos e dispersão das 14 Zonas", async () => {
    const suiteDir = resolve(process.cwd(), "cases", "_test_temp_v090_master");
    const uploadsDir = resolve(suiteDir, "uploads");
    const caseDir = resolve(suiteDir, "caso_multi_doc");

    mkdirSync(uploadsDir, { recursive: true });

    // Arquivo 1: Edital em PDF (Z1, Z2, Z7)
    const editalPages = [
      [
        "EDITAL DE LICITAÇÃO Nº 10/2026 - ORGAO_CONTRATANTE",
        "PREÂMBULO",
        "Contratação em lote único com vedação de consórcio.",
        "CLÁUSULA DE QUALIFICAÇÃO TÉCNICA",
        "Apresentação de atestado de capacidade técnica.",
      ],
      [
        "ESPECIFICAÇÕES TÉCNICAS E DATASHEET",
        "Equipamento com processador de 3.2 GHz e memória NVMe.",
        "Apresentação do datasheet do fabricante.",
      ],
    ];
    writeFileSync(resolve(uploadsDir, "Edital.pdf"), createSyntheticPdfBuffer(editalPages));

    // Arquivo 2: TR em PDF (Z1, Z4, Z8)
    const trPages = [
      [
        "ANEXO I - TERMO DE REFERÊNCIA",
        "Contratação por preço global em lote único.",
        "Vistoria técnica presencial in loco facultativa.",
        "Prazo de entrega de 30 dias corridos com SLA de atendimento.",
      ],
    ];
    writeFileSync(resolve(uploadsDir, "Anexo_I_TR.pdf"), createSyntheticPdfBuffer(trPages));

    // Arquivo 3: Minuta em DOCX (Z3, Z11)
    await createSampleRawDocx(resolve(uploadsDir, "Minuta_Contrato.docx"));

    const res = await bootstrapCase(caseDir, uploadsDir);

    expect(res.status).toBe("success");
    expect(res.inspectedPdf).toBeDefined();
    expect(res.inspectedPdf!.length).toBe(2);
    expect(res.inspectedDocx.length).toBe(1);

    expect(res.indice_mestre_path).toBeDefined();
    expect(existsSync(res.indice_mestre_path!)).toBe(true);

    const masterMd = readFileSync(res.indice_mestre_path!, "utf-8");
    expect(masterMd).toContain("# 🗺️ Índice Mestre Cartográfico do Processo: caso_multi_doc");
    expect(masterMd).toContain("## 1. Inventário de Documentos do Processo");
    expect(masterMd).toContain("Edital.pdf");
    expect(masterMd).toContain("Anexo_I_TR.pdf");
    expect(masterMd).toContain("Minuta_Contrato.docx");

    expect(masterMd).toContain("## 2. Matriz Cruzada das 14 Zonas de Impugnação (Z1 a Z14)");
    // Z1 deve ser detectada tanto em Edital.pdf quanto em Anexo_I_TR.pdf
    expect(masterMd).toContain("Z1_AGRUPAMENTO_CONSORCIO_SUBCONTRATACAO");
    expect(masterMd).toContain("Edital.pdf");
    expect(masterMd).toContain("Anexo_I_TR.pdf");

    // Z7 detectada em Edital.pdf
    expect(masterMd).toContain("Z7_DIRECIONAMENTO_OCULTO_DATASHEET_TRAP");

    expect(masterMd).toContain("## 3. Alertas Globais e Sinais de Alta Densidade Técnica/Orçamentária");
    expect(masterMd).toContain("### 3.1. Alerta de Páginas Escaneadas (Scanned PDF Trap)");

    // Retorno sintético deve conter master_index_path e manter teto < 1024 bytes (Lei 2)
    const synthetic = formatBootstrapCaseSyntheticResult(res, "cases/caso_multi_doc");
    expect(synthetic.master_index_path).toBe("state/indice_mestre_caso.md");
    const byteLen = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(byteLen).toBeLessThan(1024);

    rmSync(suiteDir, { recursive: true, force: true });
  });
});
