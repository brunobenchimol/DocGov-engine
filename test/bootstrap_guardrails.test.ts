import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { bootstrapCase } from "../src/tools/bootstrap.ts";

describe("Testes Unitários v1.3.2: Guardrails de Segurança e Denylist no bootstrap_case", () => {
  const testRoot = join(tmpdir(), `docgov_test_bootstrap_guard_${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(testRoot, { recursive: true, force: true });
    } catch {
      // Ignora falhas de cleanup
    }
  });

  test("1. bootstrapCase deve abortar com erro fail-fast ao apontar para raiz de repositório git (.git)", async () => {
    const fakeRepoDir = join(testRoot, "fake_repo");
    mkdirSync(join(fakeRepoDir, ".git"), { recursive: true });

    let errorThrown: any = null;
    try {
      await bootstrapCase(fakeRepoDir);
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).not.toBeNull();
    expect(errorThrown.message).toContain("Tentativa de inicializar caso na raiz de repositório de desenvolvimento abortada por segurança");
    expect(errorThrown.message).toContain("contém marcadores de código-fonte/repositório Git (.git, core/skills)");
  });

  test("2. bootstrapCase deve abortar com erro fail-fast ao apontar para raiz com core/skills ou src/index.ts + package.json", async () => {
    const fakeSrcRepo = join(testRoot, "fake_src_repo");
    mkdirSync(join(fakeSrcRepo, "core", "skills"), { recursive: true });

    await expect(bootstrapCase(fakeSrcRepo)).rejects.toThrow(
      "Tentativa de inicializar caso na raiz de repositório de desenvolvimento abortada por segurança"
    );

    const fakePkgRepo = join(testRoot, "fake_pkg_repo");
    mkdirSync(join(fakePkgRepo, "src"), { recursive: true });
    writeFileSync(join(fakePkgRepo, "src", "index.ts"), "console.log('test');");
    writeFileSync(join(fakePkgRepo, "package.json"), "{}");

    await expect(bootstrapCase(fakePkgRepo)).rejects.toThrow(
      "Tentativa de inicializar caso na raiz de repositório de desenvolvimento abortada por segurança"
    );
  });

  test("3. bootstrapCase em caso válido NÃO deve sequestrar arquivos protegidos de governança ou código", async () => {
    const caseDir = join(testRoot, "case_valido");
    mkdirSync(caseDir, { recursive: true });

    // Criar arquivos de governança e código na raiz do caso
    writeFileSync(join(caseDir, "AGENTS.md"), "# Estatuto de Governança");
    writeFileSync(join(caseDir, "README.md"), "# Documentação do Caso");
    writeFileSync(join(caseDir, "CHANGELOG.md"), "# Histórico");
    writeFileSync(join(caseDir, "ROADMAP.md"), "# Planejamento");
    writeFileSync(join(caseDir, "package.json"), "{}");
    writeFileSync(join(caseDir, "script.ts"), "const a = 1;");
    writeFileSync(join(caseDir, "automacao.py"), "print('ok')");

    // Criar arquivo legítimo de minuta para ser organizado
    writeFileSync(join(caseDir, "minuta_termo_referencia.md"), "# Termo de Referência");

    await bootstrapCase(caseDir);

    const inputsDir = join(caseDir, "inputs");
    const inputsFiles = existsSync(inputsDir) ? readdirSync(inputsDir) : [];

    // Arquivos protegidos continuam intactos na raiz
    expect(existsSync(join(caseDir, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(caseDir, "README.md"))).toBe(true);
    expect(existsSync(join(caseDir, "CHANGELOG.md"))).toBe(true);
    expect(existsSync(join(caseDir, "ROADMAP.md"))).toBe(true);
    expect(existsSync(join(caseDir, "package.json"))).toBe(true);
    expect(existsSync(join(caseDir, "script.ts"))).toBe(true);
    expect(existsSync(join(caseDir, "automacao.py"))).toBe(true);

    // E NÃO foram movidos para inputs/
    expect(inputsFiles.some((f) => f.toLowerCase().includes("agents"))).toBe(false);
    expect(inputsFiles.some((f) => f.toLowerCase().includes("readme"))).toBe(false);
    expect(inputsFiles.some((f) => f.toLowerCase().includes("changelog"))).toBe(false);
    expect(inputsFiles.some((f) => f.toLowerCase().includes("roadmap"))).toBe(false);
    expect(inputsFiles.some((f) => f.toLowerCase().includes("script.ts"))).toBe(false);
    expect(inputsFiles.some((f) => f.toLowerCase().includes("automacao.py"))).toBe(false);

    // O arquivo legítimo de minuta foi movido para inputs/
    expect(inputsFiles.some((f) => f.includes("minuta_termo_referencia"))).toBe(true);
  });
});
