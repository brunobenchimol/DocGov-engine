// ============================================================================
// Testes de Integração MCP, CLI e Teto Estrito de Payload < 900B (Gen5)
// docgov-engine v1.5.0 — test/contracts_arp_mcp_cli.test.ts
// ============================================================================

import { describe, it, expect } from "bun:test";
import { handleCallTool } from "../src/mcp/server.ts";
import { getMcpToolsDefinition } from "../src/mcp/tools_definition.ts";
import { handleContractsCli } from "../src/cli/contracts_cli.ts";
import { writeFileSync, mkdirSync } from "node:fs";
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
});
