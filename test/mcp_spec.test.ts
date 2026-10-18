import { describe, test, expect } from "bun:test";
import {
  VERSION,
  DOCX_ENGINE_INSTRUCTIONS,
  DOCX_WORKFLOW_GUIDE_TEXT,
  getMcpToolsDefinition,
  getMcpPromptsDefinition,
  generateEngineSpecMarkdown,
  formatBootstrapCaseSyntheticResult,
  formatInspectDocxSyntheticResult,
} from "../src/index.ts";

describe("Testes Unitários: Autodescoberta MCP (--dump-spec, Prompts, Tools, Barrel)", () => {
  test("deve implementar as 4 camadas nativas de Autodescoberta (Self-Discovery) no servidor MCP (v0.4.0)", () => {
    // 1. Camada 1: instructions contendo pipeline canônico e sintaxe
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("1. **bootstrap_case**");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("2. **inspect_docx**");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("3. **build_docx_template**");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("4. **fill_docx_template**");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("5. **generate_audit_docx**");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("{{FOR item IN lista}}");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("1.1, 1.1.1");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("inspecao_");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("visao_auditoria_");

    // 2. Camada 2: ListTools enriquecido com pré/pós-condições, descriptions em todas as propriedades e annotations
    const tools = getMcpToolsDefinition();
    expect(tools.length).toBe(5);
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toEqual([
      "bootstrap_case",
      "inspect_docx",
      "build_docx_template",
      "fill_docx_template",
      "generate_audit_docx",
    ]);

    for (const tool of tools) {
      expect(tool.description).toBeDefined();
      expect(tool.description!.length).toBeGreaterThan(50);
      expect(tool.description).toContain("Quando usar");
      expect(tool.description).toContain("Próximo Passo");

      expect(tool.inputSchema.properties).toBeDefined();
      for (const [, propDef] of Object.entries(
        tool.inputSchema.properties as Record<string, { description?: string }>
      )) {
        expect(propDef.description).toBeDefined();
        expect(propDef.description!.length).toBeGreaterThan(10);
      }

      expect(tool.annotations).toBeDefined();
      expect(typeof tool.annotations!.readOnlyHint).toBe("boolean");
      expect(typeof tool.annotations!.destructiveHint).toBe("boolean");
      expect(typeof tool.annotations!.idempotentHint).toBe("boolean");
    }

    const fillTool = tools.find((t) => t.name === "fill_docx_template")!;
    expect(fillTool.description).toContain("visao_auditoria");

    // 3. Camada 3: Capacitador prompts nativo (ListPrompts e GetPrompt)
    const prompts = getMcpPromptsDefinition();
    expect(prompts.length).toBe(1);
    expect(prompts[0].name).toBe("docx_workflow_guide");
    expect(prompts[0].description).toBeDefined();
    expect(DOCX_WORKFLOW_GUIDE_TEXT).toContain("Guia de Arquitetura");
    expect(DOCX_WORKFLOW_GUIDE_TEXT).toContain("slots_manifest.json");
    expect(DOCX_WORKFLOW_GUIDE_TEXT).toContain("visao_auditoria");

    // 4. Camada 4: Next Step Hints nas ferramentas
    const bootstrapSynthetic = formatBootstrapCaseSyntheticResult({
      status: "success",
      caseDir: "cases/test",
      copiedFiles: [],
      backgroundFiles: [],
      backgroundCopy: { status: "idle", totalFiles: 0, files: [], message: "" },
      inspectedDocx: [],
    });
    expect(bootstrapSynthetic.next_step_hint).toContain("build_docx_template");

    const inspectSynthetic = formatInspectDocxSyntheticResult(
      "test.docx",
      "test_estrutura.json",
      { headers: [], footers: [], paragraphs: [], tables: [] }
    );
    expect(inspectSynthetic.next_step_hint).toContain("build_docx_template");
  });

  test("deve documentar suporte a fileRenameMap e auto-batismo nas ferramentas MCP (v0.5.1)", () => {
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("media_*");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("fileRenameMap");

    const tools = getMcpToolsDefinition();
    const bootstrapTool = tools.find((t) => t.name === "bootstrap_case")!;
    expect(bootstrapTool.description).toContain("fileRenameMap");
    expect(bootstrapTool.description).toContain("media_*");
    expect(bootstrapTool.inputSchema.properties.fileRenameMap).toBeDefined();
  });

  test("deve expor autodescoberta e resiliência v0.5.0 nas instruções e ferramentas do servidor MCP (v0.5.0)", () => {
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("toc_map");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("safeReadJsonFile");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("unflatten");

    const tools = getMcpToolsDefinition();
    const inspectTool = tools.find((t) => t.name === "inspect_docx")!;
    expect(inspectTool.description).toContain("toc_map");
    expect(inspectTool.description).toContain("toc_summary");

    const fillTool = tools.find((t) => t.name === "fill_docx_template")!;
    expect(fillTool.description).toContain("unflatten");

    const buildTool = tools.find((t) => t.name === "build_docx_template")!;
    expect(buildTool.description).toContain("auto-reparo");
  });

  test("deve expor versão 0.7.1 e novos recursos v0.7.1 nas instruções e ferramentas MCP", () => {
    expect(VERSION).toBe("0.7.1");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("v0.7.1");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Rastreabilidade de Versão MCP");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Motor Híbrido de Lista Multinível Nativa");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("word/numbering.xml");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Rastreabilidade Temporal do Cache");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Exact Copy-Paste Error");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("--dump-spec");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Arquitetura Modular");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Coordenadas Compactas");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Zero Silent No-Op");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Sanity Check");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("structure_fingerprint");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("Auto-Offset");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("saveToRegistry");
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain("visao_auditoria");

    const tools = getMcpToolsDefinition();
    const inspectTool = tools.find((t) => t.name === "inspect_docx")!;
    expect(inspectTool.description).toContain("structure_fingerprint");
    expect(inspectTool.description).toContain("created_at");
    expect(inspectTool.description).toContain("Auto-Offset");
    expect(inspectTool.description).toContain("visao_auditoria");

    const buildTool = tools.find((t) => t.name === "build_docx_template")!;
    expect(buildTool.description).toContain("Exact Copy-Paste Error");
    expect(buildTool.description).toContain("Zero Silent No-Op");
    expect(buildTool.description).toContain("saveToRegistry");
    expect(buildTool.inputSchema.properties.manifestPath.description).toContain(
      "coord"
    );
    expect(buildTool.inputSchema.properties.saveToRegistry).toBeDefined();
    expect(buildTool.inputSchema.properties.templateId).toBeDefined();

    const auditTool = tools.find((t) => t.name === "generate_audit_docx")!;
    expect(auditTool.description).toContain("Exact Copy-Paste Error");

    const fillTool = tools.find((t) => t.name === "fill_docx_template")!;
    expect(fillTool.description).toContain("visao_auditoria");
    expect(fillTool.description).toContain("word/numbering.xml");
    expect(fillTool.inputSchema.properties.autoInspect).toBeDefined();
  });

  test("deve exportar especificação técnica integral em Markdown (--dump-spec v0.7.1)", () => {
    const spec = generateEngineSpecMarkdown();
    expect(spec).toContain("# Especificação Técnica do Motor docgov-docx-engine (v0.7.1)");
    expect(spec).toContain("Diretrizes de Comunicação e Resiliência MCP");
    expect(spec).toContain("Teto Estrito de Payload MCP (< 1024 bytes)");
    expect(spec).toContain("Padrão Exact Copy-Paste Error (Zero Silent No-Op e Fail-Fast Estrito)");
    expect(spec).toContain("Neutralidade Institucional Absoluta");
    expect(spec).toContain("Resiliência e Cache Global (core/registry/templates/)");
    expect(spec).toContain("Motor Híbrido de Lista Multinível Nativa (v0.7.0)");
    expect(spec).toContain("created_at");
    expect(spec).toContain("updated_at");
    expect(spec).toContain("age_days");

    expect(spec).not.toContain("Runtime e Testes Padronizados via Bun");
    expect(spec).not.toContain("Ritual de Qualidade e Release");

    expect(spec).toContain("2.1. bootstrap_case");
    expect(spec).toContain("2.2. inspect_docx");
    expect(spec).toContain("2.3. build_docx_template");
    expect(spec).toContain("2.4. fill_docx_template");
    expect(spec).toContain("2.5. generate_audit_docx");

    expect(spec).toContain("ORGAO_CONTRATANTE");
    expect(spec).toContain("slots");
    expect(spec).toContain("loop_table_rows");
  });

  test("deve garantir integridade de todas as exportações públicas via barrel em src/index.ts (v0.7.1)", async () => {
    const barrel = await import("../src/index.ts");

    // Ferramentas do Pipeline
    expect(typeof barrel.bootstrapCase).toBe("function");
    expect(typeof barrel.inspectDocx).toBe("function");
    expect(typeof barrel.buildDocxTemplate).toBe("function");
    expect(typeof barrel.processDocument).toBe("function");
    expect(typeof barrel.fillDocxTemplate).toBe("function");
    expect(typeof barrel.formatFillDocxTemplateSyntheticResult).toBe("function");
    expect(typeof barrel.generateAuditDocx).toBe("function");
    expect(typeof barrel.formatGenerateAuditDocxSyntheticResult).toBe("function");
    expect(typeof barrel.formatAuditDocxSyntheticResult).toBe("function");

    // Servidor MCP e Especificação
    expect(typeof barrel.runMcpServer).toBe("function");
    expect(typeof barrel.getMcpToolsDefinition).toBe("function");
    expect(typeof barrel.getMcpPromptsDefinition).toBe("function");
    expect(typeof barrel.generateEngineSpecMarkdown).toBe("function");

    // CLI
    expect(typeof barrel.runCli).toBe("function");

    // Core e Normalizadores
    expect(typeof barrel.normalizeSlotsManifest).toBe("function");
    expect(typeof barrel.countManifestRules).toBe("function");
    expect(typeof barrel.computeStructureFingerprint).toBe("function");
    expect(typeof barrel.computeStructuralSimilarity).toBe("function");
    expect(typeof barrel.saveTemplateToRegistry).toBe("function");
    expect(typeof barrel.loadAllRegistryTemplates).toBe("function");
    expect(typeof barrel.findBestTemplateMatch).toBe("function");
    expect(typeof barrel.reanchorSlotsManifest).toBe("function");
    expect(typeof barrel.isValidIsoDate).toBe("function");
    expect(typeof barrel.extractCacheTemporalMetadata).toBe("function");
    expect(typeof barrel.compareSemver).toBe("function");

    // Utilitários
    expect(typeof barrel.safeReadJsonFile).toBe("function");
    expect(typeof barrel.sanitizeJsonString).toBe("function");
    expect(typeof barrel.formatJsonErrorWithSnippet).toBe("function");
    expect(typeof barrel.unflattenDotKeys).toBe("function");
    expect(typeof barrel.resolveTargetFileName).toBe("function");
    expect(typeof barrel.detectFileExtensionFromBuffer).toBe("function");
    expect(typeof barrel.isInsideTableCell).toBe("function");
    expect(typeof barrel.ensureNumberingPart).toBe("function");
    expect(typeof barrel.createNumberingResolver).toBe("function");
    expect(typeof barrel.NumberingManager).toBe("function");

    // Contratos de Erro
    expect(typeof barrel.createSlotsManifestContractError).toBe("function");
    expect(typeof barrel.createAuditReportContractError).toBe("function");

    // Constantes
    expect(barrel.VERSION).toBe("0.7.1");
  });
});
