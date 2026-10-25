import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  resolveGitHubToken,
  parseSha256Sums,
  verifyBinarySha256,
  compareSemver,
} from "../src/core/updater.ts";
import { generateSha256Sums } from "../scripts/generate_sha256sums.ts";

describe("Segurança de Supply-Chain & Auto-Updater (Marco 5.1)", () => {
  const tmpDir = resolve("./test/fixtures/tmp_updater_test");

  beforeEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    delete process.env.DOCGOV_GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    delete process.env.GITHUB_TOKEN;
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("1. resolveGitHubToken deve priorizar variável de ambiente DOCGOV_GITHUB_TOKEN", () => {
    process.env.DOCGOV_GITHUB_TOKEN = "token_docgov_123";
    process.env.GH_TOKEN = "token_gh_456";
    const token = resolveGitHubToken(tmpDir);
    expect(token).toBe("token_docgov_123");
  });

  it("2. resolveGitHubToken deve utilizar GH_TOKEN se DOCGOV_GITHUB_TOKEN estiver ausente", () => {
    delete process.env.DOCGOV_GITHUB_TOKEN;
    process.env.GH_TOKEN = "token_gh_secret";
    const token = resolveGitHubToken(tmpDir);
    expect(token).toBe("token_gh_secret");
  });

  it("3. resolveGitHubToken deve carregar token de arquivo .env local com aspas", () => {
    delete process.env.DOCGOV_GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    delete process.env.GITHUB_TOKEN;

    const envContent = `
# Comentário de configuração
OUTRA_VARIAVEL=123
DOCGOV_GITHUB_TOKEN="ghp_env_token_from_file_789"
`;
    writeFileSync(resolve(tmpDir, ".env"), envContent, "utf-8");

    const token = resolveGitHubToken(tmpDir);
    expect(token).toBe("ghp_env_token_from_file_789");
  });

  it("4. parseSha256Sums deve mapear hashes e arquivos no formato GNU / coreutils", () => {
    const rawSums = `
# Checksums oficiais
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  docgov-engine-linux-x64
a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3 *docgov-engine-win-x64.exe
`;
    const map = parseSha256Sums(rawSums);
    expect(map.size).toBe(2);
    expect(map.get("docgov-engine-linux-x64")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    expect(map.get("docgov-engine-win-x64.exe")).toBe(
      "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"
    );
  });

  it("5. verifyBinarySha256 deve validar com sucesso binário íntegro correspondente", () => {
    const mockBinary = Buffer.from("DOCGOV_STANDALONE_BINARY_MOCK_PAYLOAD");
    const validHash = createHash("sha256").update(mockBinary).digest("hex");

    const sha256Content = `${validHash}  docgov-engine-linux-x64\n`;
    const res = verifyBinarySha256(
      new Uint8Array(mockBinary),
      "docgov-engine-linux-x64",
      sha256Content
    );

    expect(res.valid).toBe(true);
    expect(res.assetFoundInManifest).toBe(true);
    expect(res.actualHash).toBe(validHash.toLowerCase());
  });

  it("6. verifyBinarySha256 deve lançar erro fatal se o hash divergente for detectado (adulteração)", () => {
    const mockBinary = Buffer.from("DOCGOV_STANDALONE_BINARY_MOCK_PAYLOAD");
    const fakeHash = "0000000000000000000000000000000000000000000000000000000000000000";

    const sha256Content = `${fakeHash}  docgov-engine-linux-x64\n`;

    expect(() => {
      verifyBinarySha256(
        new Uint8Array(mockBinary),
        "docgov-engine-linux-x64",
        sha256Content
      );
    }).toThrow("Falha de integridade criptográfica: Checksum SHA-256 divergente");
  });

  it("7. generateSha256Sums deve gerar SHA256SUMS.txt determinístico na pasta bin", () => {
    const mockBinDir = resolve(tmpDir, "bin");
    mkdirSync(mockBinDir, { recursive: true });

    const binaryContent = "MOCK_EXECUTABLE_CONTENT_V120";
    writeFileSync(resolve(mockBinDir, "docgov-engine"), binaryContent, "utf-8");
    writeFileSync(resolve(mockBinDir, "docgov-engine.exe"), binaryContent, "utf-8");

    const outPath = generateSha256Sums(mockBinDir);
    expect(existsSync(outPath)).toBe(true);

    const generated = readFileSync(outPath, "utf-8");
    const expectedHash = createHash("sha256")
      .update(Buffer.from(binaryContent))
      .digest("hex")
      .toLowerCase();

    expect(generated).toContain(`${expectedHash}  docgov-engine-linux-x64`);
    expect(generated).toContain(`${expectedHash}  docgov-engine-win-x64.exe`);
    expect(generated.trim().split("\n").length).toBe(2);
  });
});
