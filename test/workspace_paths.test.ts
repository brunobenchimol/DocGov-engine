import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join, normalize } from "node:path";
import {
  findWorkspaceRoot,
  resolveWorkspacePath,
  resetWorkspaceRootCache,
} from "../src/utils/paths.ts";

const FIXTURE_DIR = resolve("./test/fixtures/tmp_workspace_paths");

describe("Resiliência de Caminhos e Desacoplamento de CWD da IDE (Lei 6)", () => {
  beforeEach(() => {
    resetWorkspaceRootCache();
    if (existsSync(FIXTURE_DIR)) {
      rmSync(FIXTURE_DIR, { recursive: true, force: true });
    }
    mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  afterEach(() => {
    delete process.env.DOCGOV_WORKSPACE_DIR;
    delete process.env.DOCGOV_ROOT_DIR;
    resetWorkspaceRootCache();
    if (existsSync(FIXTURE_DIR)) {
      rmSync(FIXTURE_DIR, { recursive: true, force: true });
    }
  });

  test("1. Deve retornar caminho absoluto normalizado diretamente quando inputPath for absoluto", () => {
    expect(resolveWorkspacePath("/workspace/cases/caso_01")).toBe("/workspace/cases/caso_01");
    expect(resolveWorkspacePath("C:/workspace/cases/caso_01")).toBe("C:/workspace/cases/caso_01");
  });

  test("2. Deve priorizar variável de ambiente DOCGOV_WORKSPACE_DIR", () => {
    const customWorkspace = join(FIXTURE_DIR, "meu_workspace_customizado");
    mkdirSync(customWorkspace, { recursive: true });
    process.env.DOCGOV_WORKSPACE_DIR = customWorkspace;
    resetWorkspaceRootCache();

    const root = findWorkspaceRoot();
    expect(root).toBe(customWorkspace);

    const resolved = resolveWorkspacePath("cases/caso_teste");
    expect(resolved).toBe(resolve(customWorkspace, "cases/caso_teste"));
  });

  test("3. Deve inferir a raiz do DocGov subindo a partir do binário em core/skills/docgov_engine/bin", () => {
    // Simula a árvore do repositório DocGov:
    // <mockDocGov>/cases
    // <mockDocGov>/core/skills/docgov_engine/bin/docgov-engine.exe
    const mockDocGov = join(FIXTURE_DIR, "DocGov_Repo");
    const mockCases = join(mockDocGov, "cases");
    const mockEngineBin = join(mockDocGov, "core", "skills", "docgov_engine", "bin");

    mkdirSync(mockCases, { recursive: true });
    mkdirSync(mockEngineBin, { recursive: true });

    const mockBinPath = join(mockEngineBin, "docgov-engine.exe");
    writeFileSync(mockBinPath, "MOCK_BINARY");

    // Salva execPath original
    const origExecPath = process.execPath;
    try {
      // Simula que o binário em execução é o do DocGov
      Object.defineProperty(process, "execPath", {
        value: mockBinPath,
        configurable: true,
      });
      resetWorkspaceRootCache();

      const root = findWorkspaceRoot();
      expect(root).toBe(mockDocGov);

      // Testa resolução de caminho relativo "cases/seduc_pa"
      const resolved = resolveWorkspacePath("cases/seduc_pa");
      expect(resolved).toBe(join(mockDocGov, "cases", "seduc_pa"));
    } finally {
      Object.defineProperty(process, "execPath", {
        value: origExecPath,
        configurable: true,
      });
      resetWorkspaceRootCache();
    }
  });

  test("4. Não deve resolver caminhos relativos dentro de pastas de instalação da IDE (AppData/Local/Programs/antigravity)", () => {
    // Simula que process.cwd() é a pasta da IDE Antigravity
    const fakeAntigravityDir = join(FIXTURE_DIR, "AppData", "Local", "Programs", "antigravity");
    mkdirSync(fakeAntigravityDir, { recursive: true });

    // E temos um workspace DocGov real
    const mockDocGov = join(FIXTURE_DIR, "Workspace_Real");
    mkdirSync(join(mockDocGov, "cases"), { recursive: true });
    const mockBinPath = join(mockDocGov, "core", "skills", "docgov_engine", "bin", "docgov-engine.exe");
    mkdirSync(join(mockDocGov, "core", "skills", "docgov_engine", "bin"), { recursive: true });
    writeFileSync(mockBinPath, "MOCK_BIN");

    const origExec = process.execPath;
    try {
      Object.defineProperty(process, "execPath", {
        value: mockBinPath,
        configurable: true,
      });
      resetWorkspaceRootCache();

      // Força a resolução com customRoot implícito
      const resolved = resolveWorkspacePath("cases/seduc_pa_rev2_id0015");

      // Deve apontar para o Workspace_Real/cases e NUNCA para AppData/Local/Programs/antigravity
      expect(resolved).toContain("Workspace_Real");
      expect(resolved).not.toContain("antigravity");
      expect(resolved).toBe(join(mockDocGov, "cases", "seduc_pa_rev2_id0015"));
    } finally {
      Object.defineProperty(process, "execPath", {
        value: origExec,
        configurable: true,
      });
      resetWorkspaceRootCache();
    }
  });

  test("5. Deve aceitar customRoot opcional em resolveWorkspacePath", () => {
    const custom = join(FIXTURE_DIR, "diretorio_customizado");
    mkdirSync(custom, { recursive: true });

    const res = resolveWorkspacePath("output/resultado.docx", custom);
    expect(res).toBe(join(custom, "output", "resultado.docx"));
  });
});
