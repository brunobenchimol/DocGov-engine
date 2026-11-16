// ============================================================================
// Testes de Integração MCP, CLI e Teto Estrito de Payload < 900B (Gen5)
// docgov-engine v1.5.0 — test/contracts_arp_mcp_cli.test.ts
// ============================================================================

import { describe, it, expect } from "bun:test";
import { handleCallTool } from "../src/mcp/server.ts";
import { getMcpToolsDefinition } from "../src/mcp/tools_definition.ts";
import { handleContractsCli } from "../src/cli/contracts_cli.ts";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getEphemeralInspectDir } from "../src/utils/paths.ts";

describe("Integração MCP & CLI — Ferramentas Gen5 (Marco 8)", () => {
  it("deve conter docgov_audit_contract_execution e docgov_govern_arp em getMcpToolsDefinition()", () => {
    const tools = getMcpToolsDefinition();
    const names = tools.map((t) => t.name);
    expect(names).toContain("docgov_audit_contract_execution");
    expect(names).toContain("docgov_govern_arp");
  });

  it("docgov_audit_contract_execution deve retornar payload sintético estritamente < 900 bytes", async () => {
    const testDir = join(getEphemeralInspectDir(), `test_mcp_audit_${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    const jsonPath = join(testDir, "contrato_teste.json");
    writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          contract_id: "CT-MCP-01",
          legal_regime: "LEI_14133",
          object_type: "SERVICE",
          initial_value: 1000000,
          addendums: [
            { id: "TA-01", value_increase: 300000, value_decrease: 50000 },
          ],
          tripartite_items: [
            {
              item_id: "IT-01",
              winning_proposal: { quantity: 10, unit_price: 100 },
              contract_or_invoice: { quantity: 10, unit_price: 150 },
            },
          ],
        },
        null,
        2
      )
    );

    const res: any = await handleCallTool("docgov_audit_contract_execution", {
      contractJsonPath: jsonPath,
      outputDir: testDir,
    });

    expect(res).toHaveProperty("content");
    expect(res.content).toHaveLength(1);
    expect(res.isError).toBeFalsy();

    const text = res.content[0].text;
    const byteLength = Buffer.byteLength(text, "utf-8");
    expect(byteLength).toBeLessThan(900);

    const synthetic = JSON.parse(text);
    expect(synthetic.status).toBe("blocked");
    expect(synthetic.contract_id).toBe("CT-MCP-01");
    expect(synthetic.blocking_tags).toContain("[ADDENDUM_COMPENSATION_FORBIDDEN]");
    expect(synthetic.blocking_tags).toContain("[ADDENDUM_LIMIT_EXCEEDED_25PCT]");
    expect(synthetic.blocking_tags).toContain("[TRIPARTITE_OVERPRICING_DETECTED]");
    expect(synthetic.report_json_path).toBeTruthy();
    expect(synthetic.dossier_md_path).toBeTruthy();
  });

  it("docgov_govern_arp deve retornar payload sintético estritamente < 900 bytes", async () => {
    const testDir = join(getEphemeralInspectDir(), `test_mcp_arp_${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    const jsonPath = join(testDir, "arp_teste.json");
    writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          arp_number: "ARP-MCP-02",
          manager_sphere: "FEDERAL",
          manager_regime: "LEI_14133",
          adherent_sphere: "FEDERAL",
          adherent_regime: "LEI_14133",
          items: [
            { item_id: "IT-01", registered_qty: 100, requested_adhesion_qty: 60 },
          ],
        },
        null,
        2
      )
    );

    const res: any = await handleCallTool("docgov_govern_arp", {
      arpJsonPath: jsonPath,
      outputDir: testDir,
    });

    expect(res).toHaveProperty("content");
    expect(res.content).toHaveLength(1);
    expect(res.isError).toBeFalsy();

    const text = res.content[0].text;
    const byteLength = Buffer.byteLength(text, "utf-8");
    expect(byteLength).toBeLessThan(900);

    const synthetic = JSON.parse(text);
    expect(synthetic.status).toBe("blocked");
    expect(synthetic.decision).toBe("REJECTED");
    expect(synthetic.blocking_tags).toContain("[ARP_INDIVIDUAL_LIMIT_EXCEEDED_50PCT]");
    expect(synthetic.dossier_json_path).toBeTruthy();
    expect(synthetic.dossier_md_path).toBeTruthy();
  });

  it("CLI handleContractsCli deve processar audit-contract e govern-arp com sucesso", async () => {
    const testDir = join(getEphemeralInspectDir(), `test_cli_${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    const contractPath = join(testDir, "contrato_cli.json");
    writeFileSync(
      contractPath,
      JSON.stringify({
        contract_id: "CT-CLI-01",
        legal_regime: "LEI_14133",
        object_type: "SERVICE",
        initial_value: 500000,
      })
    );

    const handledAudit = await handleContractsCli([
      "audit-contract",
      "--input",
      contractPath,
      "--output-dir",
      testDir,
    ]);
    expect(handledAudit).toBe(true);

    const arpPath = join(testDir, "arp_cli.json");
    writeFileSync(
      arpPath,
      JSON.stringify({
        arp_number: "ARP-CLI-01",
        manager_sphere: "FEDERAL",
        manager_regime: "LEI_14133",
        registered_qty: 100,
        requested_adhesion_qty: 20,
      })
    );

    const handledArp = await handleContractsCli([
      "govern-arp",
      "--arp-json",
      arpPath,
      "--output-dir",
      testDir,
    ]);
    expect(handledArp).toBe(true);

    const ignored = await handleContractsCli(["--unknown-command"]);
    expect(ignored).toBe(false);
  });

  it("Estresse máximo MCP (< 900B): docgov_audit_contract_execution com 18 tags e docgov_govern_arp REJECTED com 6 tags + DOCX/PDF", async () => {
    const longTestDir = join(
      getEphemeralInspectDir(),
      `estresse_maximo_mcp_payload_ceiling_v164_${Date.now()}`
    );
    mkdirSync(longTestDir, { recursive: true });

    const stressContractPath = join(longTestDir, "contrato_18_tags.json");
    writeFileSync(
      stressContractPath,
      JSON.stringify({
        contract_id: "CT-ESTRESSE-MAXIMO-18-TAGS-2026",
        legal_regime: "LEI_13303",
        object_type: "SERVICE",
        target_instrument: "ARP",
        initial_value: 1000000,
        has_surety_bond: true,
        addendums: [
          {
            id: "TA-01",
            value_increase: 400000,
            value_decrease: 200000,
            is_unilateral: true,
          },
        ],
        tripartite_items: [
          {
            item_id: "IT-01",
            winning_proposal: { quantity: 10, unit_price: 100 },
            contract_or_invoice: { quantity: 10, unit_price: 160 },
          },
        ],
        readjustments: [{ id: "REAJ-01", months_elapsed: 6 }],
        pas_sanctions: [
          { process_id: "PAS-GLOSA-01", is_imr_classified_as_sanction: true, penalty_type: "MULTA", opened_formal_pas: true, defense_deadline_business_days: 15, insurer_notified: true },
          { process_id: "PAS-MULTA-02", sanction_type: "MULTA", fine_pct: 35, opened_formal_pas: true, defense_deadline_business_days: 5, has_surety_bond: true, insurer_notified: false },
          {
            process_id: "PAS-FED-03", sphere: "MUNICIPAL", uf: "PA", municipality: "MUNICIPIO_GENERICO",
            legal_regime: "LEI_14133", sanction_type: "IMPEDIMENTO_LICITAR_CONTRATAR", sanction_scope_claimed: "NATIONAL",
            duration_months: 48, fine_pct: 25, registries_commanded: ["CEIS"], opened_formal_pas: true,
            defense_deadline_business_days: 15, insurer_notified: true,
            dosimetry_benchmark: { juris_precedent_id: "TCE-PA-2025", benchmark_range_pct: [2, 5], benchmark_median_pct: 3.5, aggravating_factors_proven: false, lindb_art22_weighed: true },
          },
          { process_id: "PAS-ESTATAL-04", sphere: "STATE", uf: "SP", legal_regime: "LEI_13303", sanction_type: "DECLARACAO_INIDONEIDADE", duration_months: 36, opened_formal_pas: true, defense_deadline_business_days: 15, insurer_notified: true },
          {
            process_id: "PAS-INID-05", sphere: "STATE", uf: "PA", legal_regime: "LEI_14133", sanction_type: "DECLARACAO_INIDONEIDADE",
            signing_authority_role: "FISCAL_CONTRATO", has_conclusive_legal_opinion: false, fine_pct: 10, opened_formal_pas: true,
            defense_deadline_business_days: 15, insurer_notified: true,
            dosimetry_benchmark: { lindb_art22_weighed: false, has_jurisprudential_calibration: false },
          },
        ],
        price_basket: [{ item_id: "C-01", quotes: [100, 105, 500], selected_method: "MEAN" }],
        rebalance_requests: [
          { id: "R-01", event_nature: "EXTRAORDINARY_UNFORESEEN", risk_allocated_to: "CONTRACTOR", request_accepted: true },
        ],
      })
    );

    const auditRes: any = await handleCallTool("docgov_audit_contract_execution", {
      contractJsonPath: stressContractPath,
      outputDir: longTestDir,
      compilationMode: "BOTH",
      outputFormat: "both",
    });
    const auditText = auditRes.content[0].text;
    expect(Buffer.byteLength(auditText, "utf-8")).toBeLessThan(900);
    const auditSynthetic = JSON.parse(auditText);
    expect(auditSynthetic.status).toBe("blocked");

    const diskReport = JSON.parse(
      readFileSync(join(longTestDir, "relatorio_fiscalizacao_contratual.json"), "utf-8")
    );
    expect(diskReport.blocking_tags.length).toBeGreaterThanOrEqual(17);
    expect(auditSynthetic.blocking_tags.some((t: string) => t.endsWith("_TAGS_NO_DOSSIE]"))).toBe(true);

    const stressArpPath = join(longTestDir, "arp_6_tags.json");
    writeFileSync(
      stressArpPath,
      JSON.stringify({
        arp_number: "ARP-ESTRESSE-6-TAGS-2026",
        manager_sphere: "MUNICIPAL",
        manager_regime: "LEI_14133",
        adherent_sphere: "FEDERAL",
        adherent_regime: "LEI_13303",
        is_tic: true,
        is_umbrella_or_single_lot: true,
        has_granulated_calculation_memory: false,
        validity: {
          validity_months: 12,
          is_renewed_year_2: true,
          renew_quantities_second_year: true,
          has_edital_renewal_clause: false,
          has_advantage_proof: false,
        },
        items: [
          {
            item_id: "IT-01",
            registered_qty: 100,
            prior_adhesions_qty: 180,
            requested_adhesion_qty: 60,
          },
        ],
      })
    );

    const arpRes: any = await handleCallTool("docgov_govern_arp", {
      arpJsonPath: stressArpPath,
      outputDir: longTestDir,
      compilationMode: "ARP_ADHESION_GRANT_NOTE",
      outputFormat: "both",
    });
    const arpText = arpRes.content[0].text;
    expect(Buffer.byteLength(arpText, "utf-8")).toBeLessThan(900);
    const arpSynthetic = JSON.parse(arpText);
    expect(arpSynthetic.decision).toBe("REJECTED");
    expect(arpSynthetic.blocking_tags).toHaveLength(6);
  }, 20000);
});
