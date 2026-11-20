import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { VERSION } from "../src/constants/index.ts";
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
    expect(Buffer.byteLength(inspectText, "utf-8")).toBeLessThan(1024);
    const inspectJson = JSON.parse(inspectText);
    expect(inspectJson.status).toBe("success");
    expect(inspectJson.engine_version).toBe(VERSION);

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
    expect(Buffer.byteLength(contractText, "utf-8")).toBeLessThan(900);
    const contractJson = JSON.parse(contractText);
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
    expect(Buffer.byteLength(arpText, "utf-8")).toBeLessThan(900);
    const arpJson = JSON.parse(arpText);
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
    expect(Buffer.byteLength(contractText, "utf-8")).toBeLessThan(900);

    const contractJson = JSON.parse(contractText);
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
    expect(Buffer.byteLength(arpText, "utf-8")).toBeLessThan(900);

    const arpJson = JSON.parse(arpText);
    expect(arpJson.unknown_keys).toContain("adhesions");
    expect(arpJson.unknown_keys).toContain("adhesions[0].unmapped_flag");
    expect(arpJson.unknown_keys).toContain("adhesions[0].requesting_organ(string_must_be_object)");

    const diskArpDossier = JSON.parse(
      readFileSync(join(driftArpDir, "dossie_governanca_arp.json"), "utf-8")
    );
    expect(diskArpDossier.unknown_keys).toContain("adhesions[0].unmapped_flag");
    expect(diskArpDossier.schema_warnings?.[0]).toContain("adhesions[0].unmapped_flag");
  });
});
