import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VERSION, DOCX_ENGINE_INSTRUCTIONS } from "../src/constants/index.ts";
import * as barrel from "../src/index.ts";
import { generateEngineSpecMarkdown } from "../src/mcp/spec.ts";

describe("Governança e Integridade de Versão SemVer (Self-Discovery e Lockstep)", () => {
  test("1. VERSION em src/constants/index.ts deve seguir estritamente o padrão SemVer", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("2. package.json deve estar em estrito lockstep com VERSION", () => {
    const pkgPath = resolve(import.meta.dir, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
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
});
