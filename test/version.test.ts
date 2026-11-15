import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VERSION, DOCX_ENGINE_INSTRUCTIONS } from "../src/constants/index.ts";
import * as barrel from "../src/index.ts";
import { generateEngineSpecMarkdown } from "../src/mcp/spec.ts";
import { getMcpToolsDefinition } from "../src/mcp/tools_definition.ts";

const ROOT_DIR = resolve(import.meta.dir, "..");
const readRootText = (relPath: string): string =>
  readFileSync(resolve(ROOT_DIR, relPath), "utf-8").replace(/\r\n/g, "\n");

describe("Governança e Integridade de Versão SemVer (Self-Discovery e Lockstep)", () => {
  test("1. VERSION em src/constants/index.ts deve seguir estritamente o padrão SemVer", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("2. package.json deve estar em estrito lockstep com VERSION", () => {
    const pkg = JSON.parse(readRootText("package.json"));
    expect(pkg.version).toBe(VERSION);
  });

  test("3. src/index.ts (barrel) deve re-exportar VERSION de forma idêntica", () => {
    expect(barrel.VERSION).toBe(VERSION);
  });

  test("4. DOCX_ENGINE_INSTRUCTIONS deve conter a versão corrente v${VERSION}", () => {
    expect(DOCX_ENGINE_INSTRUCTIONS).toContain(`v${VERSION}`);
  });

  test("5. generateEngineSpecMarkdown (--dump-spec) deve conter cabeçalho normativo com v${VERSION}", () => {
    const spec = generateEngineSpecMarkdown();
    expect(spec).toContain(`# Especificação Técnica do Motor docgov-engine (v${VERSION})`);
  });

  test("6. README.md deve permanecer em estrito lockstep com VERSION, ferramentas MCP e CLI", () => {
    const readme = readRootText("README.md");
    const tools = getMcpToolsDefinition();

    expect(readme).toContain(
      `# docgov-engine — Motor Standalone Determinístico & Servidor MCP (v${VERSION})`
    );
    expect(readme).toContain(`"engine_version": "${VERSION}"`);
    expect(readme).toContain(`${tools.length} ferramentas`);
    expect(readme).toContain(`${tools.length} Ferramentas`);

    for (const tool of tools) {
      expect(readme).toContain(tool.name);
    }

    for (const cliCmd of [
      "audit-contract",
      "govern-arp",
      "evaluate-proposals",
      "audit-direct-contracting",
    ]) {
      expect(readme).toContain(cliCmd);
    }
  });

  test("7. CHANGELOG.md e ROADMAP.md devem referenciar a versão corrente VERSION", () => {
    const changelog = readRootText("CHANGELOG.md");
    const roadmap = readRootText("ROADMAP.md");

    expect(changelog).toContain(`## [${VERSION}]`);
    expect(roadmap).toContain(`v${VERSION}`);
  });

  test("8. docs/especificacao_motor.md deve existir e coincidir exatamente com --dump-spec", () => {
    const specPath = resolve(ROOT_DIR, "docs", "especificacao_motor.md");
    expect(existsSync(specPath)).toBe(true);

    const diskSpec = readRootText("docs/especificacao_motor.md").trimEnd();
    const generatedSpec = generateEngineSpecMarkdown().replace(/\r\n/g, "\n").trimEnd();
    expect(diskSpec).toBe(generatedSpec);
  });

  test("9. docs/ARCHITECTURE_AND_MODULES.md deve existir, listar todas as tools e apontar caminhos reais", () => {
    const archPath = resolve(ROOT_DIR, "docs", "ARCHITECTURE_AND_MODULES.md");
    expect(existsSync(archPath)).toBe(true);

    const arch = readRootText("docs/ARCHITECTURE_AND_MODULES.md");
    expect(arch).toContain(`(v${VERSION})`);

    for (const tool of getMcpToolsDefinition()) {
      expect(arch).toContain(tool.name);
    }

    const citedPaths = Array.from(
      arch.matchAll(/`((?:src|test)\/[a-zA-Z0-9_./-]+\.ts)`/g),
      (m) => m[1]
    );
    expect(citedPaths.length).toBeGreaterThan(20);

    for (const relPath of new Set(citedPaths)) {
      expect(existsSync(resolve(ROOT_DIR, relPath))).toBe(true);
    }
  });

  test("10. ENGINEERING.md duplicado não deve existir na raiz (Lei única em AGENTS.md)", () => {
    expect(existsSync(resolve(ROOT_DIR, "ENGINEERING.md"))).toBe(false);
    expect(existsSync(resolve(ROOT_DIR, "AGENTS.md"))).toBe(true);
  });
});
