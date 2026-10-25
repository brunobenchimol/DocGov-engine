import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  getPlatformAssetName,
  getLegacyPlatformAssetName,
} from "../src/core/updater.ts";
import { VERSION, GITHUB_REPO } from "../src/constants/index.ts";

describe("Testes Unitários v1.0.0: Consistência da Esteira de Distribuição e Instaladores", () => {
  it("1. getPlatformAssetName deve retornar nomes canônicos alinhados ao GitHub Releases", () => {
    expect(getPlatformAssetName("win32")).toBe("docgov-engine-win-x64.exe");
    expect(getPlatformAssetName("linux")).toBe("docgov-engine-linux-x64");
    expect(getLegacyPlatformAssetName("win32")).toBe("docgov-docx-windows-x64.exe");
    expect(getLegacyPlatformAssetName("linux")).toBe("docgov-docx-linux-x64");
  });

  it("2. scripts/install.ps1 deve conter assetName correto, destino canônico docgov-engine.exe e sanity checks", () => {
    const ps1Path = resolve(process.cwd(), "scripts/install.ps1");
    expect(existsSync(ps1Path)).toBe(true);

    const content = readFileSync(ps1Path, "utf-8");
    expect(content).toContain('$repo = "brunobenchimol/DocGov-engine"');
    expect(content).toContain('$assetName = "docgov-engine-win-x64.exe"');
    expect(content).toContain('Join-Path $targetDir "docgov-engine.exe"');
    expect(content).toContain("50 * 1024 * 1024");
    expect(content).toContain("--version");
  });

  it("3. scripts/install.sh deve conter ASSET_NAME correto, destino canônico docgov-engine e sanity checks", () => {
    const shPath = resolve(process.cwd(), "scripts/install.sh");
    expect(existsSync(shPath)).toBe(true);

    const content = readFileSync(shPath, "utf-8");
    expect(content).toContain('REPO="brunobenchimol/DocGov-engine"');
    expect(content).toContain('ASSET_NAME="docgov-engine-linux-x64"');
    expect(content).toContain('DEST="$TARGET_DIR/docgov-engine"');
    expect(content).toContain("50 * 1024 * 1024");
    expect(content).toContain("--version");
  });

  it("4. .github/workflows/release.yml deve compilar e publicar os assets canônicos da release", () => {
    const releaseYmlPath = resolve(process.cwd(), ".github/workflows/release.yml");
    expect(existsSync(releaseYmlPath)).toBe(true);

    const content = readFileSync(releaseYmlPath, "utf-8");
    expect(content).toContain("artifact_name: docgov-engine-linux-x64");
    expect(content).toContain("artifact_name: docgov-engine-win-x64.exe");
    expect(content).toContain("binary_path: bin/docgov-engine");
    expect(content).toContain("binary_path: bin/docgov-engine.exe");
  });

  it("5. .github/workflows/ci.yml deve conter os smoke tests dos instaladores oficiais", () => {
    const ciYmlPath = resolve(process.cwd(), ".github/workflows/ci.yml");
    expect(existsSync(ciYmlPath)).toBe(true);

    const content = readFileSync(ciYmlPath, "utf-8");
    expect(content).toContain("install_cmd: bash ./scripts/install.sh ./test_install_linux");
    expect(content).toContain("install_cmd: pwsh -File ./scripts/install.ps1 ./test_install_win");
    expect(content).toContain("Smoke Test do Instalador Oficial (Distribution Validation)");
  });

  it("6. package.json deve manter scripts de build compilando para ./bin/docgov-engine e ./bin/docgov-engine.exe", () => {
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

    expect(pkg.name).toBe("docgov-engine");
    expect(pkg.version).toBe("1.2.0");
    expect(pkg.scripts["build:linux"]).toContain("./bin/docgov-engine");
    expect(pkg.scripts["build:windows"]).toContain("./bin/docgov-engine.exe");
  });
});
