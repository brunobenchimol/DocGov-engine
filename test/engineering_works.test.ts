import { describe, test, expect, afterAll } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import {
  ENGINEERING_ALL_TAGS,
  ENGINEERING_BLOCKING_TAGS,
  ENGINEERING_WORKS_TOOL_DEFINITION,
  auditEngineeringWorks,
  generateEngineSpecMarkdown,
  handleCallTool,
} from "../src/index.ts";
import type { EngineeringWorksAuditInput } from "../src/engineering/types.ts";
import { createSuiteTempDir } from "./helpers/fixtures.ts";

describe("Geração 6.5 Eixo 2 (v1.6.6) — Obras e Serviços de Engenharia (docgov_audit_engineering_works)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("engineering_works_v166");

  afterAll(() => {
    cleanup();
  });

  function buildConformeInput(workspaceDir: string): EngineeringWorksAuditInput {
    // AC=400, S=80, R=127, DF=123, L=740, I=65+300+250+270=885 (bps)
    // ((1+0.0607)*(1+0.0123)*(1+0.074))/(1-0.0885) - 1 = 0.265465 -> 2655? Let's compute exact with I=615 (PIS 65 + COFINS 300 + ISS 250 + CPRB 0) or CPRB 270 + ISS 200:
    // With AC=400, S=80, R=100, DF=100, L=600, PIS=65, COFINS=300, ISS=200, CPRB=270 (I=835):
    // (1.058 * 1.01 * 1.06) / (1 - 0.0835) - 1 = 1.1326948 / 0.9165 - 1 = 0.2358917 -> 2359 bps (<= 2500 Q3!)
    return {
      workspace_dir: workspaceDir,
      case_id: "PROC-OBRAS-CONFORME-001",
      contract_regime: "LEI_14133",
      work_typology: "CONSTRUCAO_EDIFICIOS",
      execution_regime: "CONTRATACAO_SEMI_INTEGRADA",
      estimated_budget_cents: 1000000000,
      offered_proposal_cents: 820000000,
      additional_guarantee_offered: true,
      summary_disqualification_attempted: false,
      prior_diligence_opportunity_granted: true,
      diligence_viability_proven: true,
      bdi_evaluation: {
        central_admin_bps: 400,
        insurance_and_guarantee_bps: 80,
        risk_bps: 100,
        financial_expenses_bps: 100,
        profit_bps: 600,
        pis_bps: 65,
        cofins_bps: 300,
        iss_bps: 200,
        cprb_bps: 270,
        irpj_bps: 0,
        csll_bps: 0,
        declared_bdi_bps: 2359,
        justification_above_q3_proven: false,
        includes_admin_local_in_bdi: false,
        includes_canteiro_or_mobilizacao_in_bdi: false,
        includes_irpj_or_csll: false,
        has_relevant_equipment_supply: true,
        relevant_equipment_share_bps: 2200,
        differentiated_equipment_bdi_bps: 1402,
        admin_local_proportional_to_physical_progress: true,
        physical_progress_bps: 4500,
        admin_local_measured_bps: 4500,
      },
      tax_desoneracao_cprb: {
        reference_year: 2026,
        sinapi_sicro_table_regime: "DESONERADO",
        bdi_includes_cprb: true,
        applied_cprb_bps: 270,
        payroll_inss_bps: 1000,
      },
      curva_abc_items: [
        {
          item_id: "SINAPI-92775",
          description: "Concreto Estrutural FCK 30MPa",
          reference_source: "SINAPI",
          quantity: 1200,
          sinapi_sicro_median_unit_cents: 45000,
          offered_unit_cents: 44000,
        },
        {
          item_id: "SICRO-5914378",
          description: "Aço CA-50 Armação",
          reference_source: "SICRO",
          quantity: 5000,
          sinapi_sicro_median_unit_cents: 1200,
          offered_unit_cents: 1180,
        },
      ],
      schedule_and_risk: {
        front_loading_detected: false,
        schedule_stages: [
          {
            stage_number: 1,
            description: "Fundações e Infraestrutura",
            reference_physical_cumulative_bps: 2000,
            financial_disbursement_cumulative_bps: 2000,
          },
        ],
        has_risk_allocation_matrix: true,
        has_anteprojeto_or_basic_design: true,
        attempts_design_error_addendum_without_legal_exception: false,
      },
    };
  }

  test("1. Cenário CONFORME (BDI 2.622/2013, Súmula 253, SINAPI/SICRO, CPRB Lei 14.973/2024, Semi-Integrada & Garantia 85%)", async () => {
    const ws = join(tempDir, "cenario1_conforme");
    const input = buildConformeInput(ws);
    const { output, synthetic } = await auditEngineeringWorks(input);

    expect(output.status).toBe("CONFORME");
    expect(output.blocking_tags).toEqual([]);
    expect(output.bdi_summary.calculated_bdi_bps).toBe(2359);
    expect(output.bdi_summary.quartile_q3_bps).toBe(2500);
    expect(output.sinapi_schedule_summary.abc_overpriced_items_count).toBe(0);
    expect(output.sinapi_schedule_summary.abc_items[0].abc_band).toBe("A");
    expect(output.inexequibility_summary.requires_additional_guarantee_85).toBe(true);
    expect(output.inexequibility_summary.additional_guarantee_cents).toBe(30000000);

    expect(existsSync(output.artifacts.json_path)).toBe(true);
    expect(existsSync(output.artifacts.md_path)).toBe(true);
    expect(existsSync(output.artifacts.docx_path)).toBe(true);
    expect(existsSync(output.artifacts.pdf_path)).toBe(true);

    const docxZip = await JSZip.loadAsync(readFileSync(output.artifacts.docx_path));
    const docXml = await docxZip.file("word/document.xml")!.async("string");
    expect(docXml).toContain("2.622/2013");
    expect(docXml).toContain("253");
    expect(docXml).toContain("SINAPI");
    expect(docXml).toContain("14.973/2024");

    const pdfBuf = readFileSync(output.artifacts.pdf_path);
    expect(pdfBuf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const syntheticText = JSON.stringify(synthetic);
    expect(Buffer.byteLength(syntheticText, "utf-8")).toBeLessThanOrEqual(8192);
    expect(synthetic.delivery_mode).toBe("INLINE");
    expect(synthetic.read_file_required).toBe(false);
  }, 20000);

  test("2. Cenário CONFORME via MCP (Rodoviária SICRO Não Desonerado)", async () => {
    const ws = join(tempDir, "cenario2_rodoviaria_mcp");
    const input: EngineeringWorksAuditInput = {
      workspace_dir: ws,
      case_id: "PROC-RODOVIA-002",
      contract_regime: "LEI_13303",
      work_typology: "RODOVIARIA",
      execution_regime: "EMPREITADA_PRECO_UNITARIO",
      estimated_budget_cents: 500000000,
      offered_proposal_cents: 460000000,
      bdi_evaluation: {
        central_admin_bps: 380,
        insurance_and_guarantee_bps: 60,
        risk_bps: 80,
        financial_expenses_bps: 90,
        profit_bps: 660,
        pis_bps: 65,
        cofins_bps: 300,
        iss_bps: 200,
        cprb_bps: 0,
        declared_bdi_bps: 1993,
      },
      tax_desoneracao_cprb: {
        reference_year: 2026,
        sinapi_sicro_table_regime: "NAO_DESONERADO",
        bdi_includes_cprb: false,
        applied_cprb_bps: 0,
      },
      curva_abc_items: [
        {
          item_id: "SICRO-4011201",
          description: "CBUQ Capa de Rolamento",
          reference_source: "SICRO",
          quantity: 1000,
          sinapi_sicro_median_unit_cents: 35000,
          offered_unit_cents: 34500,
        },
      ],
    };

    const mcpRes = await handleCallTool("docgov_audit_engineering_works", input);
    expect(mcpRes.isError).toBeUndefined();
    const mcpText = mcpRes.content[0].text;
    expect(Buffer.byteLength(mcpText, "utf-8")).toBeLessThanOrEqual(8192);
    const parsedMcp = JSON.parse(mcpText);
    expect(parsedMcp.delivery_mode).toBe("INLINE");
    expect(parsedMcp.read_file_required).toBe(false);
    expect(parsedMcp.status).toBe("CONFORME");
    expect(parsedMcp.blocking_tags).toEqual([]);
  }, 20000);

  test("3. ESTRESSE EXTREMO — 15 Tags Simultâneas (11 [ENG_*] + 4 Inexequibilidade) via MCP & CLI com Guarda <= 880B", async () => {
    const ws = join(tempDir, "nested_long_dir_stress", "caso_hostil_15_tags_eng");
    mkdirSync(ws, { recursive: true });

    const hostileInput: EngineeringWorksAuditInput = {
      workspace_dir: ws,
      case_id: "PROC-ENG-HOSTIL-15-TAGS-OVERFLOW-STRESS",
      contract_regime: "LEI_14133",
      work_typology: "CONSTRUCAO_EDIFICIOS",
      execution_regime: "CONTRATACAO_INTEGRADA",
      estimated_budget_cents: 1000000000,
      offered_proposal_cents: 700000000,
      additional_guarantee_offered: false,
      summary_disqualification_attempted: true,
      prior_diligence_opportunity_granted: false,
      diligence_viability_proven: false,
      bdi_evaluation: {
        central_admin_bps: 400,
        insurance_and_guarantee_bps: 80,
        risk_bps: 100,
        financial_expenses_bps: 100,
        profit_bps: 700,
        pis_bps: 65,
        cofins_bps: 300,
        iss_bps: 200,
        cprb_bps: 270,
        irpj_bps: 120,
        csll_bps: 100,
        declared_bdi_bps: 3250,
        justification_above_q3_proven: false,
        includes_admin_local_in_bdi: true,
        includes_canteiro_or_mobilizacao_in_bdi: true,
        includes_irpj_or_csll: true,
        has_relevant_equipment_supply: true,
        relevant_equipment_share_bps: 3000,
        differentiated_equipment_bdi_bps: 2450,
        admin_local_proportional_to_physical_progress: false,
        physical_progress_bps: 2500,
        admin_local_measured_bps: 5500,
      },
      tax_desoneracao_cprb: {
        reference_year: 2026,
        sinapi_sicro_table_regime: "NAO_DESONERADO",
        bdi_includes_cprb: true,
        applied_cprb_bps: 270,
      },
      curva_abc_items: [
        {
          item_id: "SINAPI-92775",
          description: "Concreto FCK 30MPa - Item Faixa A",
          reference_source: "SINAPI",
          quantity: 1000,
          sinapi_sicro_median_unit_cents: 45000,
          offered_unit_cents: 62000,
          specificity_justification_approved: false,
        },
      ],
      schedule_and_risk: {
        front_loading_detected: true,
        schedule_stages: [
          {
            stage_number: 1,
            description: "Serviços Preliminares e Mobilização",
            reference_physical_cumulative_bps: 1000,
            financial_disbursement_cumulative_bps: 2900,
          },
        ],
        has_risk_allocation_matrix: false,
        has_anteprojeto_or_basic_design: true,
        attempts_design_error_addendum_without_legal_exception: true,
      },
    };

    // 1. Invocação MCP (forçando modo POINTER para validar guarda <= 880B)
    const prevInline = process.env.MCP_INLINE_MAX_BYTES;
    process.env.MCP_INLINE_MAX_BYTES = "512";
    try {
      const mcpRes = await handleCallTool("docgov_audit_engineering_works", hostileInput);
      expect(mcpRes.isError).toBeUndefined();
      const mcpText = mcpRes.content[0].text;
      expect(Buffer.byteLength(mcpText, "utf-8")).toBeLessThanOrEqual(880);

      const parsedMcp = JSON.parse(mcpText);
      expect(parsedMcp.delivery_mode).toBe("POINTER");
      expect(parsedMcp.read_file_required).toBe(true);
      expect(parsedMcp.status).toBe("NAO_CONFORME");
      expect(
        parsedMcp.blocking_tags.some((t: string) =>
          /^\[\+\d+_TAGS_NO_DOSSIE\]$/.test(t)
        )
      ).toBe(true);
    } finally {
      if (prevInline === undefined) delete process.env.MCP_INLINE_MAX_BYTES;
      else process.env.MCP_INLINE_MAX_BYTES = prevInline;
    }

    // 2. Verificar 100% das 15 tags no JSON e MD em disco
    const jsonDiskPath = join(ws, "engineering_works_audit.json");
    const mdDiskPath = join(ws, "engineering_works_audit.md");
    const docxDiskPath = join(ws, "laudo_pericial_obras_engenharia.docx");
    const pdfDiskPath = join(ws, "laudo_pericial_obras_engenharia.pdf");

    expect(existsSync(jsonDiskPath)).toBe(true);
    expect(existsSync(mdDiskPath)).toBe(true);
    expect(existsSync(docxDiskPath)).toBe(true);
    expect(existsSync(pdfDiskPath)).toBe(true);

    const diskAudit = JSON.parse(readFileSync(jsonDiskPath, "utf-8"));
    const mdDisk = readFileSync(mdDiskPath, "utf-8");

    expect(diskAudit.status).toBe("NAO_CONFORME");
    expect(diskAudit.blocking_tags.length).toBe(15);
    expect(ENGINEERING_BLOCKING_TAGS.length).toBe(11);
    for (const expectedTag of ENGINEERING_ALL_TAGS) {
      expect(diskAudit.blocking_tags).toContain(expectedTag);
      expect(mdDisk).toContain(expectedTag);
    }

    // 3. Validar marcadores obrigatórios no DOCX e PDF
    const docxZip = await JSZip.loadAsync(readFileSync(docxDiskPath));
    const docXml = await docxZip.file("word/document.xml")!.async("string");
    expect(docXml).toContain("2.622/2013");
    expect(docXml).toContain("253");
    expect(docXml).toContain("SINAPI");
    expect(docXml).toContain("14.973/2024");
    for (const expectedTag of ENGINEERING_ALL_TAGS) {
      expect(docXml).toContain(expectedTag);
    }

    const pdfBuf = readFileSync(pdfDiskPath);
    expect(pdfBuf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // 4. Invocação CLI real: audit-engineering-works --input <file> --workspace <dir>
    const cliWs = join(tempDir, "cli_stress_out");
    const inputPath = join(tempDir, "hostile_eng_input.json");
    writeFileSync(inputPath, JSON.stringify(hostileInput), "utf-8");

    const proc = Bun.spawnSync(
      [
        process.execPath,
        "run",
        "src/index.ts",
        "audit-engineering-works",
        "--input",
        inputPath,
        "--workspace",
        cliWs,
      ],
      { env: { ...process.env, MCP_INLINE_MAX_BYTES: "512" } }
    );
    expect(proc.exitCode).toBe(0);
    const cliStdout = proc.stdout.toString("utf-8");
    expect(Buffer.byteLength(cliStdout, "utf-8")).toBeLessThanOrEqual(880);
    const cliJson = JSON.parse(cliStdout.trim());
    expect(cliJson.delivery_mode).toBe("POINTER");
    expect(cliJson.read_file_required).toBe(true);
    expect(cliJson.status).toBe("NAO_CONFORME");
    expect(
      cliJson.blocking_tags.some((t: string) =>
        /^\[\+\d+_TAGS_NO_DOSSIE\]$/.test(t)
      )
    ).toBe(true);
    expect(existsSync(join(cliWs, "engineering_works_audit.json"))).toBe(true);
    expect(existsSync(join(cliWs, "laudo_pericial_obras_engenharia.docx"))).toBe(true);
    expect(existsSync(join(cliWs, "laudo_pericial_obras_engenharia.pdf"))).toBe(true);
  }, 25000);

  test("4. Black-Box Aliases & Chaves Flat na Raiz (Front-Loading + Aditivo por Erro de Projeto)", async () => {
    const ws = join(tempDir, "cenario4_aliases_flat");
    const aliasPayload: any = {
      workspace_dir: ws,
      case_id: "PROC-ENG-ALIAS-BLACKBOX-004",
      work_typology: "CONSTRUCAO_EDIFICIOS",
      execution_regime: "CONTRATACAO_INTEGRADA",
      declared_bdi_pct: 22.12,
      central_admin_pct: 4.0,
      insurance_and_guarantee_pct: 0.8,
      risk_pct: 1.0,
      financial_expenses_pct: 1.0,
      profit_pct: 6.0,
      pis_bps: 65,
      cofins_bps: 300,
      iss_bps: 423,
      cronograma_fisico_financeiro: {
        stages: [
          {
            stage: 1,
            physical_pct: 12.0,
            financial_pct: 22.5,
          },
        ],
      },
      has_risk_allocation_matrix: true,
      design_error_addendum_attempted: true,
    };

    const { output, synthetic } = await auditEngineeringWorks(aliasPayload, {
      outputFormat: "docx",
    });
    expect(output.status).toBe("NAO_CONFORME");
    expect(output.blocking_tags).toContain(
      "[ENG_SCHEDULE_FRONT_LOADING_CASHFLOW_MANIPULATION_BLOCK]"
    );
    expect(output.blocking_tags).toContain(
      "[ENG_INTEGRATED_CONTRACTING_ILLEGAL_DESIGN_ADDENDUM_BLOCK]"
    );
    expect(output.sinapi_schedule_summary.max_front_loading_gap_bps).toBe(1050);
    expect(Buffer.byteLength(JSON.stringify(synthetic), "utf-8")).toBeLessThanOrEqual(8192);
    expect(synthetic.delivery_mode).toBe("INLINE");
    expect(synthetic.read_file_required).toBe(false);
  }, 15000);

  test("5. Exact Copy-Paste Error (Lei 3) & Autodescoberta Completa de Subcampos (inputSchema + --dump-spec)", async () => {
    await expect(
      auditEngineeringWorks({ case_id: "PROC-INVALIDO" } as any)
    ).rejects.toThrow(
      "NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:"
    );

    const schemaProps = ENGINEERING_WORKS_TOOL_DEFINITION.inputSchema.properties as any;
    expect(schemaProps.bdi_evaluation.properties.declared_bdi_bps).toBeDefined();
    expect(schemaProps.tax_desoneracao_cprb.properties.sinapi_sicro_table_regime).toBeDefined();
    expect(schemaProps.curva_abc_items.items.properties.sinapi_sicro_median_unit_cents).toBeDefined();
    expect(schemaProps.schedule_and_risk.properties.schedule_stages).toBeDefined();
    expect(
      schemaProps.schedule_and_risk.properties.attempts_design_error_addendum_without_legal_exception
    ).toBeDefined();

    const spec = generateEngineSpecMarkdown();
    expect(spec).toContain("2.16. docgov_audit_engineering_works");
    expect(spec).toContain("attempts_design_error_addendum_without_legal_exception");
    expect(spec).toContain("financial_disbursement_cumulative_bps");
    expect(spec).toContain("Exemplo Canônico de Entrada para `docgov_audit_engineering_works`");
  });
});
