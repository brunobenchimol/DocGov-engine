import { describe, test, expect, afterAll } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import {
  DEMO_BLOCKING_TAGS,
  auditDemoRegime,
  handleCallTool,
} from "../src/index.ts";
import type { DemoRegimeAuditInput } from "../src/demo_costs/types.ts";
import { createSuiteTempDir } from "./helpers/fixtures.ts";

describe("Geração 6.5 (v1.6.5) — Regime DEMO (docgov_audit_demo_regime & audit-demo-regime)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("demo_regime_v165");

  afterAll(() => {
    cleanup();
  });

  function buildConformeLucroRealInput(workspaceDir: string): DemoRegimeAuditInput {
    return {
      workspace_dir: workspaceDir,
      case_id: "PROC-DEMO-CONFORME-LR-001",
      contract_regime: "LEI_14133",
      service_category: "LIMPEZA",
      tax_regime: "LUCRO_REAL",
      module1_remuneration: {
        base_salary_cents: 160000,
        cct_floor_cents: 155000,
        insalubrity_degree: "MAX_40",
        is_high_traffic_public_restroom: true,
        has_technical_ltcat_report: true,
        danger_pay_30pct: false,
        night_shift_additional_cents: 0,
      },
      module2_charges_benefits: {
        sub21_13th_vacation_bps: 2043,
        sub22_inss_sistema_s_fgts_base_bps: 3380,
        rat_pct: 2,
        fap_factor: 1.0,
        declared_rat_x_fap_bps: 200,
        vt_daily_tariff_cents: 900,
        working_days: 22,
        vt_employer_net_cents: 10200,
        va_monthly_cents: 60000,
        cct_min_va_cents: 55000,
      },
      module3_termination: {
        api_bps: 42,
        fgts_penalty_bps: 400,
        apt_first_year_bps: 194,
        sub22_incidence_on_m3_bps: 84,
      },
      module4_replacement: {
        sub41_ausentes_bps: 450,
        sub22_incidence_on_m4_bps: 161,
        declared_module4_cents: 13686,
      },
      module5_inputs: {
        uniforms_epi_materials_depreciation_cents: 12000,
        is_manifestly_inconsistent_or_missing: false,
      },
      module6_indirect_profit_taxes: {
        indirect_costs_bps: 500,
        profit_bps: 600,
        pis_declared_bps: 90,
        cofins_declared_bps: 420,
        iss_declared_bps: 500,
        efd_effective_pis_bps: 90,
        efd_effective_cofins_bps: 420,
        declared_gross_up_total_cents: 592220,
      },
      productivity_m2: {
        area_type: "INTERNA",
        proposed_m2_per_worker: 1000,
        has_technical_justification: false,
      },
      decree_12174_compliance: {
        weekly_hours_reduced_44_to_40: true,
        nominal_salary_reduced: false,
        has_domestic_violence_victim_quota_and_protective_clauses: true,
      },
      execution_governance: {
        is_first_renewal_or_after_12m: true,
        renewal_apt_bps: 19,
        mitigation_mechanism: "CONTA_VINCULADA",
        linked_account_retained_bps: 3050,
        repactuation: {
          months_since_last_cct_date_base: 12,
          module5_reajusted_by_cct_salary_index: false,
          indirect_or_profit_rate_increased: false,
        },
      },
    };
  }

  test("1. Cenário CONFORME (Lucro Real EFD + Expurgo APT 1,94%->0,194% + Conta Vinculada + Anexo VI-B + Dec. 12.174)", async () => {
    const ws = join(tempDir, "cenario1_lucro_real");
    const input = buildConformeLucroRealInput(ws);
    const { output, synthetic } = await auditDemoRegime(input);

    expect(output.status).toBe("CONFORME");
    expect(output.blocking_tags).toEqual([]);
    expect(output.calculated_totals_cents.module1_cents).toBe(224000);
    expect(output.calculated_totals_cents.module2_cents).toBe(212538);
    expect(output.calculated_totals_cents.module3_cents).toBe(16128);
    expect(output.calculated_totals_cents.module4_cents).toBe(13686);
    expect(output.calculated_totals_cents.module5_cents).toBe(12000);
    expect(output.calculated_totals_cents.total_monthly_per_post_cents).toBe(592220);
    expect(output.calculated_totals_cents.module6_cents).toBe(592220 - 478352);
    expect(output.calculated_totals_cents.apt_renewal_purge_monthly_savings_cents).toBeGreaterThan(0);
    expect(output.calculated_totals_cents.linked_account_monthly_provision_cents).toBeGreaterThan(0);

    expect(existsSync(output.artifacts.json_path)).toBe(true);
    expect(existsSync(output.artifacts.md_path)).toBe(true);
    expect(existsSync(output.artifacts.docx_path)).toBe(true);
    expect(existsSync(output.artifacts.pdf_path)).toBe(true);

    const syntheticText = JSON.stringify(synthetic);
    expect(Buffer.byteLength(syntheticText, "utf-8")).toBeLessThanOrEqual(8192);
    expect(synthetic.delivery_mode).toBe("INLINE");
    expect(synthetic.read_file_required).toBe(false);
  }, 20000);

  test("2. Cenário CONFORME (Simples Nacional Anexo IV — Limpeza com 20% CPP + Fato Gerador via MCP)", async () => {
    const ws = join(tempDir, "cenario1b_simples_anexo_iv");
    const input: DemoRegimeAuditInput = {
      workspace_dir: ws,
      case_id: "PROC-DEMO-SIMPLES-ANEXO4",
      contract_regime: "LEI_14133",
      service_category: "LIMPEZA",
      tax_regime: "SIMPLES_NACIONAL",
      simples_anexo_iv_compliant: true,
      module1_remuneration: {
        base_salary_cents: 160000,
        cct_floor_cents: 155000,
        insalubrity_degree: "NONE",
        danger_pay_30pct: false,
      },
      module2_charges_benefits: {
        sub21_13th_vacation_bps: 2043,
        sub22_inss_sistema_s_fgts_base_bps: 2800,
        rat_pct: 2,
        fap_factor: 1.0,
        declared_rat_x_fap_bps: 200,
        vt_daily_tariff_cents: 900,
        working_days: 22,
        vt_employer_net_cents: 10200,
        va_monthly_cents: 60000,
        cct_min_va_cents: 55000,
      },
      module3_termination: {
        api_bps: 42,
        fgts_penalty_bps: 400,
        apt_first_year_bps: 194,
        sub22_incidence_on_m3_bps: 70,
      },
      module4_replacement: {
        sub41_ausentes_bps: 450,
        sub22_incidence_on_m4_bps: 135,
        declared_module4_cents: 9360,
      },
      module5_inputs: {
        uniforms_epi_materials_depreciation_cents: 10000,
      },
      module6_indirect_profit_taxes: {
        indirect_costs_bps: 500,
        profit_bps: 500,
        pis_declared_bps: 0,
        cofins_declared_bps: 0,
        iss_declared_bps: 400,
        declared_gross_up_total_cents: 403504,
      },
      execution_governance: {
        mitigation_mechanism: "FATO_GERADOR",
        fato_gerador_unproven_events_paid_cents: 0,
      },
    };

    const mcpRes = await handleCallTool("docgov_audit_demo_regime", input);
    expect(mcpRes.isError).toBeUndefined();
    const mcpText = mcpRes.content[0].text;
    expect(Buffer.byteLength(mcpText, "utf-8")).toBeLessThanOrEqual(8192);
    const parsedMcp = JSON.parse(mcpText);
    expect(parsedMcp.delivery_mode).toBe("INLINE");
    expect(parsedMcp.read_file_required).toBe(false);
    expect(parsedMcp.status).toBe("CONFORME");
    expect(parsedMcp.blocking_tags).toEqual([]);

    const diskAudit = JSON.parse(readFileSync(join(ws, "demo_regime_audit.json"), "utf-8"));
    expect(diskAudit.calculated_totals_cents.linked_account_monthly_provision_cents).toBe(0);
    expect(diskAudit.status).toBe("CONFORME");
  }, 20000);

  test("3. ESTRESSE EXTREMO — 16 Tags Simultâneas via MCP & CLI com Guarda <= 880B e 100% em Disco", async () => {
    const ws = join(tempDir, "nested_long_dir_for_stress_test", "caso_hostil_16_tags");
    mkdirSync(ws, { recursive: true });

    const hostileInput: DemoRegimeAuditInput = {
      workspace_dir: ws,
      case_id: "PROC-DEMO-HOSTIL-16-TAGS-MAX-OVERFLOW",
      contract_regime: "LEI_14133",
      service_category: "APOIO_ADMINISTRATIVO",
      tax_regime: "LUCRO_REAL",
      simples_anexo_iv_compliant: false,
      module1_remuneration: {
        base_salary_cents: 130000,
        cct_floor_cents: 160000,
        insalubrity_degree: "MED_20",
        is_high_traffic_public_restroom: true,
        has_technical_ltcat_report: false,
        danger_pay_30pct: true,
      },
      module2_charges_benefits: {
        sub21_13th_vacation_bps: 1200,
        sub22_inss_sistema_s_fgts_base_bps: 800,
        rat_pct: 2,
        fap_factor: 1.5,
        declared_rat_x_fap_bps: 100,
        vt_daily_tariff_cents: 900,
        working_days: 22,
        vt_employer_net_cents: 19800,
        va_monthly_cents: 30000,
        cct_min_va_cents: 55000,
      },
      module3_termination: {
        api_bps: 42,
        fgts_penalty_bps: 150,
        apt_first_year_bps: 295,
        sub22_incidence_on_m3_bps: 84,
      },
      module4_replacement: {
        sub41_ausentes_bps: 450,
        sub22_incidence_on_m4_bps: 161,
        declared_module4_cents: 5000,
      },
      module5_inputs: {
        uniforms_epi_materials_depreciation_cents: 0,
        is_manifestly_inconsistent_or_missing: true,
      },
      module6_indirect_profit_taxes: {
        indirect_costs_bps: 500,
        profit_bps: 600,
        pis_declared_bps: 165,
        cofins_declared_bps: 760,
        iss_declared_bps: 500,
        efd_effective_pis_bps: 90,
        efd_effective_cofins_bps: 420,
        declared_gross_up_total_cents: 350000,
      },
      productivity_m2: {
        area_type: "INTERNA",
        proposed_m2_per_worker: 2200,
        has_technical_justification: false,
      },
      decree_12174_compliance: {
        weekly_hours_reduced_44_to_40: true,
        nominal_salary_reduced: true,
        has_domestic_violence_victim_quota_and_protective_clauses: false,
      },
      execution_governance: {
        is_first_renewal_or_after_12m: true,
        renewal_apt_bps: 194,
        mitigation_mechanism: "CONTA_VINCULADA",
        linked_account_retained_bps: 1500,
        repactuation: {
          months_since_last_cct_date_base: 8,
          module5_reajusted_by_cct_salary_index: true,
          indirect_or_profit_rate_increased: true,
        },
      },
    };

    // 1. Invocação via MCP tool handler (forçando modo POINTER para validar guarda <= 880B)
    const prevInline = process.env.MCP_INLINE_MAX_BYTES;
    process.env.MCP_INLINE_MAX_BYTES = "512";
    try {
      const mcpRes = await handleCallTool("docgov_audit_demo_regime", hostileInput);
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

    // 2. Verificar integridade integral em disco (100% das 16 tags sem truncamento)
    const jsonDiskPath = join(ws, "demo_regime_audit.json");
    const mdDiskPath = join(ws, "demo_regime_audit.md");
    const docxDiskPath = join(ws, "laudo_pericial_planilha_demo.docx");
    const pdfDiskPath = join(ws, "laudo_pericial_planilha_demo.pdf");

    expect(existsSync(jsonDiskPath)).toBe(true);
    expect(existsSync(mdDiskPath)).toBe(true);
    expect(existsSync(docxDiskPath)).toBe(true);
    expect(existsSync(pdfDiskPath)).toBe(true);

    const diskAudit = JSON.parse(readFileSync(jsonDiskPath, "utf-8"));
    const mdDisk = readFileSync(mdDiskPath, "utf-8");

    expect(diskAudit.status).toBe("NAO_CONFORME");
    expect(diskAudit.blocking_tags.length).toBe(16);
    for (const expectedTag of DEMO_BLOCKING_TAGS) {
      expect(diskAudit.blocking_tags).toContain(expectedTag);
      expect(mdDisk).toContain(expectedTag);
    }

    // 3. Validar OpenXML DOCX e PDF gerados
    const docxZip = await JSZip.loadAsync(readFileSync(docxDiskPath));
    const docXml = await docxZip.file("word/document.xml")!.async("string");
    expect(docXml).toContain("Módulos 1 a 6");
    expect(docXml).toContain("Anexo VI-B");
    expect(docXml).toContain("12.174/2024");
    expect(docXml).toContain("Conta-Depósito Vinculada");
    expect(docXml).toContain("1.586/2018");
    expect(docXml).toContain("Art. 135");
    for (const expectedTag of DEMO_BLOCKING_TAGS) {
      expect(docXml).toContain(expectedTag);
    }

    const pdfBuf = readFileSync(pdfDiskPath);
    expect(pdfBuf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // 4. Invocação CLI real: audit-demo-regime --input <file> --workspace <dir>
    const cliWs = join(tempDir, "cli_stress_out");
    const inputPath = join(tempDir, "hostile_input.json");
    writeFileSync(inputPath, JSON.stringify(hostileInput), "utf-8");

    const proc = Bun.spawnSync(
      [
        process.execPath,
        "run",
        "src/index.ts",
        "audit-demo-regime",
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
    expect(existsSync(join(cliWs, "demo_regime_audit.json"))).toBe(true);
    expect(existsSync(join(cliWs, "laudo_pericial_planilha_demo.docx"))).toBe(true);
    expect(existsSync(join(cliWs, "laudo_pericial_planilha_demo.pdf"))).toBe(true);
  }, 25000);
});
