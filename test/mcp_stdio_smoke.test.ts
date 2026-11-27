import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { VERSION } from "../src/constants/index.ts";
import { computeNfeMod11CheckDigit } from "../src/utils/forensics/nfe_key_validator.ts";
import { createSuiteTempDir } from "./helpers/fixtures.ts";

const ROOT_DIR = resolve(import.meta.dir, "..");
const EXACT_COPY_PASTE_PREFIX =
  "NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:";

function extractFirstTextContent(res: any): string {
  expect(Array.isArray(res?.content)).toBe(true);
  expect(res.content.length).toBeGreaterThan(0);
  expect(res.content[0].type).toBe("text");
  return String(res.content[0].text ?? "");
}

describe("Smoke Test MCP Real via stdio (Handshake, Schemas, Tetos e Exact Copy-Paste Error)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("mcp_stdio_smoke");
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: ["run", resolve(ROOT_DIR, "src", "index.ts")],
      cwd: ROOT_DIR,
      stderr: "pipe",
    });
    client = new Client({ name: "docgov-stdio-smoke-client", version: "1.0.0" });
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    try {
      await client?.close();
    } finally {
      cleanup();
    }
  });

  test("1. initialize via stdio deve expor versão corrente e instruções canônicas sem inflar regra interna", () => {
    const serverInfo = client.getServerVersion();
    expect(serverInfo?.name).toBe("docgov-engine");
    expect(serverInfo?.version).toBe(VERSION);

    const instructions = client.getInstructions() ?? "";
    expect(instructions).toContain(`v${VERSION}`);
    expect(instructions).toContain("1. **bootstrap_case**");
    expect(instructions).toContain("5. **generate_audit_docx**");
    expect(instructions).not.toContain("<= 600");
  });

  test("2. tools/list via stdio deve retornar 16 tools sob orçamento <= 600 chars na description e schemas íntegros", async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(16);

    for (const tool of tools) {
      expect(tool.description).toBeDefined();
      expect(tool.description!.length).toBeGreaterThan(50);
      expect(tool.description!.length).toBeLessThanOrEqual(600);
      expect(tool.inputSchema?.properties).toBeDefined();
      expect(tool.annotations).toBeDefined();
    }

    const totalListChars = JSON.stringify({ tools }).length;
    expect(totalListChars).toBeLessThan(34000);
  });

  test("3. prompts/list e prompts/get via stdio devem retornar o guia docx_workflow_guide completo", async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toContain("docx_workflow_guide");

    const promptRes = await client.getPrompt({ name: "docx_workflow_guide" });
    expect(promptRes.messages.length).toBeGreaterThan(0);
    const promptText = String((promptRes.messages[0].content as any)?.text ?? "");
    expect(promptText).toContain("Guia de Arquitetura");
    expect(promptText).toContain("slots_manifest.json");
  });

  test("4. tools/call com entradas válidas via stdio deve executar inspect_doc, contrato e ARP respeitando teto MCP", async () => {
    const sampleMdPath = join(tempDir, "minuta_smoke.md");
    writeFileSync(
      sampleMdPath,
      "# Termo de Referência — ORGAO_CONTRATANTE\n\n1. Objeto: Sustentação de sistemas sem exclusividade.\n",
      "utf-8"
    );

    const inspectRes = await client.callTool({
      name: "inspect_doc",
      arguments: { filePath: sampleMdPath, compact: true },
    });
    expect(inspectRes.isError).toBeFalsy();
    const inspectText = extractFirstTextContent(inspectRes);
    expect(Buffer.byteLength(inspectText, "utf-8")).toBeLessThanOrEqual(8192);
    const inspectJson = JSON.parse(inspectText);
    expect(inspectJson.status).toBe("success");
    expect(inspectJson.engine_version).toBe(VERSION);
    expect(inspectJson.delivery_mode).toBe("INLINE");
    expect(inspectJson.read_file_required).toBe(false);
    expect(inspectJson.inline_markdown).toBeTruthy();

    const contractJsonPath = join(tempDir, "contrato_valido.json");
    writeFileSync(
      contractJsonPath,
      JSON.stringify({
        contract_id: "CT-STDIO-01",
        legal_regime: "LEI_14133",
        object_type: "SERVICE",
        initial_value: 1000000,
        addendums: [{ id: "TA-01", value_increase: 300000, value_decrease: 0 }],
      }),
      "utf-8"
    );

    const contractRes = await client.callTool({
      name: "docgov_audit_contract_execution",
      arguments: { contractJsonPath, outputDir: tempDir },
    });
    expect(contractRes.isError).toBeFalsy();
    const contractText = extractFirstTextContent(contractRes);
    expect(Buffer.byteLength(contractText, "utf-8")).toBeLessThanOrEqual(8192);
    const contractJson = JSON.parse(contractText);
    expect(contractJson.delivery_mode).toBe("INLINE");
    expect(contractJson.read_file_required).toBe(false);
    expect(contractJson.status).toBe("blocked");
    expect(contractJson.engine_version).toBe(VERSION);
    expect(contractJson.blocking_tags).toContain("[ADDENDUM_LIMIT_EXCEEDED_25PCT]");
    expect(contractJson.unknown_keys).toBeUndefined();

    const arpJsonPath = join(tempDir, "arp_valido.json");
    writeFileSync(
      arpJsonPath,
      JSON.stringify({
        arp_number: "ARP-STDIO-01",
        adherent_sphere: "FEDERAL",
        adherent_regime: "LEI_14133",
        items: [{ item_id: "IT-01", registered_qty: 100, requested_adhesion_qty: 60 }],
      }),
      "utf-8"
    );

    const arpRes = await client.callTool({
      name: "docgov_govern_arp",
      arguments: { arpJsonPath, outputDir: tempDir },
    });
    expect(arpRes.isError).toBeFalsy();
    const arpText = extractFirstTextContent(arpRes);
    expect(Buffer.byteLength(arpText, "utf-8")).toBeLessThanOrEqual(8192);
    const arpJson = JSON.parse(arpText);
    expect(arpJson.delivery_mode).toBe("INLINE");
    expect(arpJson.read_file_required).toBe(false);
    expect(arpJson.decision).toBe("REJECTED");
    expect(arpJson.engine_version).toBe(VERSION);
    expect(arpJson.blocking_tags).toContain("[ARP_INDIVIDUAL_LIMIT_EXCEEDED_50PCT]");
    expect(arpJson.unknown_keys).toBeUndefined();
  });

  test("5. tools/call com payloads vazios/inválidos ou fora de escopo via stdio deve retornar Exact Copy-Paste Error e guardrails", async () => {
    const emptyContractRes = await client.callTool({
      name: "docgov_audit_contract_execution",
      arguments: {},
    });
    expect(emptyContractRes.isError).toBe(true);
    const emptyContractText = extractFirstTextContent(emptyContractRes);
    expect(emptyContractText).toContain(EXACT_COPY_PASTE_PREFIX);
    expect(emptyContractText).toContain("contract_id");
    expect(emptyContractText).toContain("addendums");

    const invalidContractPath = join(tempDir, "contrato_invalido.json");
    writeFileSync(invalidContractPath, JSON.stringify({ chave_invalida: true }), "utf-8");
    const invalidContractRes = await client.callTool({
      name: "docgov_audit_contract_execution",
      arguments: { contractJsonPath: invalidContractPath, outputDir: tempDir },
    });
    expect(invalidContractRes.isError).toBe(true);
    expect(extractFirstTextContent(invalidContractRes)).toContain(EXACT_COPY_PASTE_PREFIX);

    const emptyArpRes = await client.callTool({
      name: "docgov_govern_arp",
      arguments: {},
    });
    expect(emptyArpRes.isError).toBe(true);
    const emptyArpText = extractFirstTextContent(emptyArpRes);
    expect(emptyArpText).toContain(EXACT_COPY_PASTE_PREFIX);
    expect(emptyArpText).toContain("arp_number");
    expect(emptyArpText).toContain("items");

    const invalidArpPath = join(tempDir, "arp_invalido.json");
    writeFileSync(invalidArpPath, JSON.stringify({ chave_invalida: true }), "utf-8");
    const invalidArpRes = await client.callTool({
      name: "docgov_govern_arp",
      arguments: { arpJsonPath: invalidArpPath, outputDir: tempDir },
    });
    expect(invalidArpRes.isError).toBe(true);
    expect(extractFirstTextContent(invalidArpRes)).toContain(EXACT_COPY_PASTE_PREFIX);

    const outOfScopeBuildRes = await client.callTool({
      name: "build_docx_template",
      arguments: {
        sourcePath: join(tempDir, "origem.docx"),
        manifestPath: join(tempDir, "slots_manifest.json"),
        outputPath: join(tempDir, "saida.docx"),
      },
    });
    expect(outOfScopeBuildRes.isError).toBe(true);
  });

  test("6. tools/call via stdio deve detectar unknown_keys (ex.: addendums[0].compensation_attempted e adhesions[0]) mantendo envelope < 900B", async () => {
    const driftContractDir = join(tempDir, "drift_contract");
    const driftContractPath = join(tempDir, "contrato_drift.json");
    writeFileSync(
      driftContractPath,
      JSON.stringify({
        contract_id: "CT-DRIFT-01",
        legal_regime: "LEI_14133",
        object_type: "SERVICE",
        initial_value: 1000000,
        addendums: [
          {
            id: "TA-01",
            value_increase: 200000,
            value_decrease: 150000,
            compensation_attempted: true,
          },
        ],
      }),
      "utf-8"
    );

    const contractRes = await client.callTool({
      name: "docgov_audit_contract_execution",
      arguments: { contractJsonPath: driftContractPath, outputDir: driftContractDir },
    });
    expect(contractRes.isError).toBeFalsy();
    const contractText = extractFirstTextContent(contractRes);
    expect(Buffer.byteLength(contractText, "utf-8")).toBeLessThanOrEqual(8192);

    const contractJson = JSON.parse(contractText);
    expect(contractJson.delivery_mode).toBe("INLINE");
    expect(contractJson.read_file_required).toBe(false);
    expect(contractJson.unknown_keys).toEqual(["addendums[0].compensation_attempted"]);

    const diskContractReport = JSON.parse(
      readFileSync(join(driftContractDir, "relatorio_fiscalizacao_contratual.json"), "utf-8")
    );
    expect(diskContractReport.unknown_keys).toEqual(["addendums[0].compensation_attempted"]);
    expect(diskContractReport.schema_warnings?.[0]).toContain("addendums[0].compensation_attempted");

    const driftArpDir = join(tempDir, "drift_arp");
    const driftArpPath = join(tempDir, "arp_drift.json");
    writeFileSync(
      driftArpPath,
      JSON.stringify({
        arp_number: "ARP-DRIFT-01",
        items: [{ item_id: "IT-01", registered_qty: 100, requested_adhesion_qty: 20 }],
        adhesions: [{ requesting_organ: "ORGAO_A", unmapped_flag: true }],
      }),
      "utf-8"
    );

    const arpRes = await client.callTool({
      name: "docgov_govern_arp",
      arguments: { arpJsonPath: driftArpPath, outputDir: driftArpDir },
    });
    expect(arpRes.isError).toBeFalsy();
    const arpText = extractFirstTextContent(arpRes);
    expect(Buffer.byteLength(arpText, "utf-8")).toBeLessThanOrEqual(8192);

    const arpJson = JSON.parse(arpText);
    expect(arpJson.delivery_mode).toBe("INLINE");
    expect(arpJson.read_file_required).toBe(false);
    expect(arpJson.unknown_keys).toContain("adhesions");
    expect(arpJson.unknown_keys).toContain("adhesions[0].unmapped_flag");
    expect(arpJson.unknown_keys).toContain("adhesions[0].requesting_organ(string_must_be_object)");

    const diskArpDossier = JSON.parse(
      readFileSync(join(driftArpDir, "dossie_governanca_arp.json"), "utf-8")
    );
    expect(diskArpDossier.unknown_keys).toContain("adhesions[0].unmapped_flag");
    expect(diskArpDossier.schema_warnings?.[0]).toContain("adhesions[0].unmapped_flag");
  });

  test("7. tools/call via stdio Gen6 (v1.7.0) deve bloquear NF-e inválida, detectar unknown_keys e manter envelope < 900B", async () => {
    const base43 = "3526041122233300018155001000000123112345678";
    const invalidNfeKey = `${base43}${(computeNfeMod11CheckDigit(base43) + 1) % 10}`;
    const bidDir = join(tempDir, "gen6_bid_smoke");
    const bidPath = join(tempDir, "bidding_v170.json");
    writeFileSync(
      bidPath,
      JSON.stringify({
        process_id: "PROC-STDIO-V170",
        bidder_name: "EMPRESA_GENERICA",
        bidder_cnpj: "11.222.333/0001-81",
        invented_bidding_alias: true,
        act_forensic_items: [
          {
            certificate_id: "ACT-STDIO-1",
            issuer_name: "ORGAO_CONTRATANTE",
            issuer_cnpj: "99.888.777/0001-66",
            nfe_access_key: invalidNfeKey,
          },
        ],
      }),
      "utf-8"
    );

    const bidRes = await client.callTool({
      name: "docgov_evaluate_bidding_proposals",
      arguments: { proposalJsonPath: bidPath, outputDir: bidDir },
    });
    expect(bidRes.isError).toBeFalsy();
    const bidText = extractFirstTextContent(bidRes);
    expect(Buffer.byteLength(bidText, "utf-8")).toBeLessThanOrEqual(8192);
    const bidJson = JSON.parse(bidText);
    expect(bidJson.delivery_mode).toBe("INLINE");
    expect(bidJson.read_file_required).toBe(false);
    expect(bidJson.decision).toBe("REJECTED");
    expect(bidJson.blocking_tags).toContain("[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]");
    expect(bidJson.unknown_keys).toEqual(["invented_bidding_alias"]);

    const dirOut = join(tempDir, "gen6_dir_smoke");
    const dirPath = join(tempDir, "direct_v170.json");
    writeFileSync(
      dirPath,
      JSON.stringify({
        process_id: "PROC-DIR-V170",
        contracting_modality: "INEXIGIBILIDADE",
        supplier_cnpj: "11222333000181",
        inexigibility_details: {
          competition_infeasibility_proven: true,
          exclusivity_certificate: { provided: true, sumula_255_tcu_verified: true },
          supplier_market_price_proofs: [
            {
              identifier: "NF-01",
              unit_price: 500,
              nfe_access_key: invalidNfeKey,
              alias_inventado: true,
            },
            { identifier: "NF-02", unit_price: 500 },
            { identifier: "NF-03", unit_price: 500 },
          ],
        },
      }),
      "utf-8"
    );

    const dirRes = await client.callTool({
      name: "docgov_audit_direct_contracting",
      arguments: { directContractingJsonPath: dirPath, outputDir: dirOut },
    });
    expect(dirRes.isError).toBeFalsy();
    const dirText = extractFirstTextContent(dirRes);
    expect(Buffer.byteLength(dirText, "utf-8")).toBeLessThanOrEqual(8192);
    const dirJson = JSON.parse(dirText);
    expect(dirJson.delivery_mode).toBe("INLINE");
    expect(dirJson.read_file_required).toBe(false);
    expect(dirJson.decision).toBe("REJECTED");
    expect(dirJson.blocking_tags).toContain("[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]");
    expect(dirJson.unknown_keys).toEqual(["inexigibility_details.supplier_market_price_proofs[0].alias_inventado"]);
  });

  test("8. Drenagem real via stdio: flushPendingWrites() persiste .md íntegro (!= 0B) no fechamento imediato após INLINE write-behind", async () => {
    const drainDir = join(tempDir, "stdio_drain_case");
    const drainContractJson = join(tempDir, "contrato_drain.json");
    writeFileSync(
      drainContractJson,
      JSON.stringify({
        contract_id: "CT-DRAIN-STDIO-01",
        legal_regime: "LEI_14133",
        object_type: "SERVICE",
        initial_value: 250000,
      }),
      "utf-8"
    );

    const isolatedTransport = new StdioClientTransport({
      command: process.execPath,
      args: ["run", resolve(ROOT_DIR, "src", "index.ts")],
      cwd: ROOT_DIR,
      stderr: "pipe",
    });
    const isolatedClient = new Client({
      name: "docgov-stdio-drain-client",
      version: "1.0.0",
    });
    await isolatedClient.connect(isolatedTransport);

    const res = await isolatedClient.callTool({
      name: "docgov_audit_contract_execution",
      arguments: { contractJsonPath: drainContractJson, outputDir: drainDir },
    });
    expect(res.isError).toBeFalsy();
    const payload = JSON.parse(extractFirstTextContent(res));
    expect(payload.delivery_mode).toBe("INLINE");
    expect(payload.read_file_required).toBe(false);
    expect(typeof payload.inline_markdown).toBe("string");

    // Fecha imediatamente o transporte stdio (disparando stdin end/close + flushPendingWrites)
    await isolatedClient.close();
    await new Promise((r) => setTimeout(r, 250));

    const mdDiskPath = join(drainDir, "dossie_fiscalizacao_contratual.md");
    const diskContent = readFileSync(mdDiskPath, "utf-8");
    expect(Buffer.byteLength(diskContent, "utf-8")).toBeGreaterThan(0);
    expect(diskContent).toBe(payload.inline_markdown);
  }, 15000);
});
