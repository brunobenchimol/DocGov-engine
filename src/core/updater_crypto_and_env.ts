import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { createHash } from "node:crypto";
import type { Sha256VerificationResult } from "../types/index.ts";
// ============================================================================
// 4. Verificação de Versão e Auto-Atualização (Self-Update)
// ============================================================================

export function compareSemver(current: string, latest: string): number {
  const cleanCurrent = current.replace(/^v/i, "").trim();
  const cleanLatest = latest.replace(/^v/i, "").trim();

  const partsA = cleanCurrent.split(".").map((n) => parseInt(n, 10) || 0);
  const partsB = cleanLatest.split(".").map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const a = partsA[i] ?? 0;
    const b = partsB[i] ?? 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
}

export function getPlatformAssetName(platform: string = process.platform): string {
  return platform === "win32"
    ? "docgov-engine-win-x64.exe"
    : "docgov-engine-linux-x64";
}

export function getLegacyPlatformAssetName(platform: string = process.platform): string {
  return platform === "win32"
    ? "docgov-docx-windows-x64.exe"
    : "docgov-docx-linux-x64";
}

export function resolveSelfBinaryPath(customTargetPath?: string): string {
  if (customTargetPath) {
    return resolve(customTargetPath);
  }
  const execBase = basename(process.execPath).toLowerCase();
  if (
    execBase === "bun" ||
    execBase === "bun.exe" ||
    execBase === "node" ||
    execBase === "node.exe"
  ) {
    return resolve(
      process.platform === "win32"
        ? "./bin/docgov-engine.exe"
        : "./bin/docgov-engine"
    );
  }
  return resolve(process.execPath);
}

export function cleanupOldBinaryBackup(binaryPath?: string): void {
  try {
    const target = binaryPath ?? resolveSelfBinaryPath();
    const oldBackup = `${target}.old`;
    if (existsSync(oldBackup)) {
      unlinkSync(oldBackup);
    }
  } catch {
    // Ignora caso ainda esteja bloqueado pelo SO
  }
}

/**
 * Resolução Híbrida de Credenciais GitHub (Marco 5.1):
 * 1. Consulta variáveis de ambiente do processo: DOCGOV_GITHUB_TOKEN, GH_TOKEN ou GITHUB_TOKEN;
 * 2. Caso ausentes, realiza fallback gracioso procurando arquivo .env no diretório atual,
 *    no diretório do executável e em até 3 diretórios ascendentes.
 */
export function resolveGitHubToken(customDir?: string): string | undefined {
  const envToken =
    process.env.DOCGOV_GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_TOKEN;
  if (envToken && envToken.trim().length > 0) {
    return envToken.trim();
  }

  const candidateDirs: string[] = [];
  const baseDir = customDir ? resolve(customDir) : process.cwd();
  candidateDirs.push(baseDir);

  try {
    const binDir = dirname(resolveSelfBinaryPath());
    if (!candidateDirs.includes(binDir)) {
      candidateDirs.push(binDir);
    }
  } catch {
    // Ignora falha na resolução de binDir
  }

  // Adiciona ancestrais até 3 níveis acima
  let curr = baseDir;
  for (let i = 0; i < 3; i++) {
    const parent = dirname(curr);
    if (!parent || parent === curr) break;
    if (!candidateDirs.includes(parent)) {
      candidateDirs.push(parent);
    }
    curr = parent;
  }

  for (const dir of candidateDirs) {
    const envPath = resolve(dir, ".env");
    if (!existsSync(envPath)) continue;

    try {
      const content = readFileSync(envPath, "utf-8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const match = trimmed.match(
          /^(?:export\s+)?(DOCGOV_GITHUB_TOKEN|GH_TOKEN|GITHUB_TOKEN)\s*=\s*(.*)$/i
        );
        if (match && match[2]) {
          let tokenVal = match[2].trim();
          // Remove aspas simples ou duplas
          if (
            (tokenVal.startsWith('"') && tokenVal.endsWith('"')) ||
            (tokenVal.startsWith("'") && tokenVal.endsWith("'"))
          ) {
            tokenVal = tokenVal.slice(1, -1).trim();
          }
          if (tokenVal.length > 0) {
            return tokenVal;
          }
        }
      }
    } catch {
      // Ignora falha de leitura em .env ilegível
    }
  }

  return undefined;
}

/**
 * Parsing seguro de manifesto SHA256SUMS.txt.
 * Mapeia nome do arquivo (em minúsculas) para o hash SHA-256 de 64 caracteres hex.
 */
export function parseSha256Sums(content: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!content) return map;

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([a-fA-F0-9]{64})\s+[*]?(.+)$/);
    if (match && match[1] && match[2]) {
      const hash = match[1].toLowerCase();
      const filename = basename(match[2].trim()).toLowerCase();
      map.set(filename, hash);
    }
  }

  return map;
}

/**
 * Validação Criptográfica de Integridade SHA-256 (Marco 5.1):
 * Confere o hash SHA-256 do binário em memória antes da substituição em disco.
 */
export function verifyBinarySha256(
  binaryBuffer: Uint8Array,
  assetName: string,
  sha256sumsContent: string
): Sha256VerificationResult {
  const actualHash = createHash("sha256")
    .update(binaryBuffer)
    .digest("hex")
    .toLowerCase();

  const sumsMap = parseSha256Sums(sha256sumsContent);
  const targetName = basename(assetName).toLowerCase();
  const legacyName = getLegacyPlatformAssetName().toLowerCase();
  const genericWin = "docgov-engine.exe";
  const genericLinux = "docgov-engine";

  let expectedHash: string | undefined;
  if (sumsMap.has(targetName)) {
    expectedHash = sumsMap.get(targetName);
  } else if (sumsMap.has(legacyName)) {
    expectedHash = sumsMap.get(legacyName);
  } else if (targetName.includes(".exe") && sumsMap.has(genericWin)) {
    expectedHash = sumsMap.get(genericWin);
  } else if (!targetName.includes(".exe") && sumsMap.has(genericLinux)) {
    expectedHash = sumsMap.get(genericLinux);
  }

  if (expectedHash) {
    if (expectedHash !== actualHash) {
      throw new Error(
        `Falha de integridade criptográfica: Checksum SHA-256 divergente para '${assetName}'! Esperado: ${expectedHash}, Calculado: ${actualHash}. Atualização abortada por segurança.`
      );
    }
    return {
      valid: true,
      expectedHash,
      actualHash,
      assetFoundInManifest: true,
      message: `Checksum SHA-256 validado com sucesso (${actualHash}).`,
    };
  }

  return {
    valid: true,
    actualHash,
    assetFoundInManifest: false,
    message: `Asset '${assetName}' não listado no SHA256SUMS.txt da release. Validação estrita ignorada.`,
  };
}
