import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  renameSync,
  chmodSync,
} from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { VERSION, GITHUB_REPO } from "../constants/index.ts";
import type {
  SelfUpdateOptions,
  SelfUpdateResult,
  ReleaseInfo,
  Sha256VerificationResult,
} from "../types/index.ts";

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

export async function fetchLatestReleaseInfo(
  repo: string = GITHUB_REPO,
  customToken?: string
): Promise<ReleaseInfo> {
  const assetName = getPlatformAssetName();
  const legacyAssetName = getLegacyPlatformAssetName();
  const token = customToken || resolveGitHubToken();

  const headers: Record<string, string> = {
    "User-Agent": `docgov-engine/${VERSION}`,
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Tentativa 1: API oficial do GitHub (com autenticação transparente se houver token)
  try {
    const apiRes = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      { headers }
    );

    if (apiRes.ok) {
      const data = (await apiRes.json()) as {
        tag_name?: string;
        assets?: Array<{
          name: string;
          browser_download_url: string;
          url: string;
        }>;
      };
      if (data.tag_name) {
        const tag = data.tag_name;
        const version = tag.replace(/^v/i, "");
        const matchedAsset =
          data.assets?.find((a) => a.name === assetName) ||
          data.assets?.find((a) => a.name === legacyAssetName);
        const resolvedAssetName = matchedAsset ? matchedAsset.name : assetName;
        const downloadUrl =
          matchedAsset?.browser_download_url ??
          `https://github.com/${repo}/releases/download/${tag}/${resolvedAssetName}`;
        const apiUrl = matchedAsset?.url;

        // Procura asset de checksum SHA256SUMS.txt
        const sha256Asset = data.assets?.find((a) =>
          /^sha256sums?\.txt$/i.test(a.name)
        );

        return {
          tag,
          version,
          downloadUrl,
          apiUrl,
          assetName: resolvedAssetName,
          sha256sumsDownloadUrl: sha256Asset?.browser_download_url,
          sha256sumsApiUrl: sha256Asset?.url,
          token,
        };
      }
    }
  } catch {
    // Prossegue para o fallback via redirecionamento HTTP
  }

  // Tentativa 2 (Fallback anti-Rate Limit): Redirecionamento de /releases/latest
  const redirectRes = await fetch(
    `https://github.com/${repo}/releases/latest`,
    {
      redirect: "follow",
      headers: {
        "User-Agent": `docgov-engine/${VERSION}`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  if (!redirectRes.ok) {
    throw new Error(
      `Não foi possível consultar a última release em github.com/${repo} (HTTP ${redirectRes.status})`
    );
  }

  const finalUrl = redirectRes.url;
  const tagMatch = finalUrl.match(/\/releases\/tag\/([^/?#]+)/i);
  if (!tagMatch || !tagMatch[1]) {
    throw new Error(
      `Não foi possível identificar a versão mais recente a partir da URL: ${finalUrl}`
    );
  }

  const tag = decodeURIComponent(tagMatch[1]);
  const version = tag.replace(/^v/i, "");
  const downloadUrl = `https://github.com/${repo}/releases/download/${tag}/${assetName}`;
  const sha256sumsDownloadUrl = `https://github.com/${repo}/releases/download/${tag}/SHA256SUMS.txt`;

  return {
    tag,
    version,
    downloadUrl,
    assetName,
    sha256sumsDownloadUrl,
    token,
  };
}

export function replaceBinaryOnDisk(
  targetPath: string,
  newBinaryBuffer: Uint8Array,
  minBytes: number = 1024
): void {
  if (newBinaryBuffer.byteLength < minBytes) {
    throw new Error(
      `Binário baixado inválido ou corrompido (${newBinaryBuffer.byteLength} bytes, mínimo esperado: ${minBytes} bytes)`
    );
  }

  const resolvedTarget = resolve(targetPath);
  const parentDir = dirname(resolvedTarget);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  const tempNewPath = `${resolvedTarget}.new`;
  const oldBackupPath = `${resolvedTarget}.old`;

  writeFileSync(tempNewPath, Buffer.from(newBinaryBuffer));

  if (process.platform !== "win32") {
    chmodSync(tempNewPath, 0o755);
    renameSync(tempNewPath, resolvedTarget);
    return;
  }

  // Estratégia Windows: renomeia o executável atual (mesmo em execução) para .old e move o .new para o destino
  if (existsSync(oldBackupPath)) {
    try {
      unlinkSync(oldBackupPath);
    } catch {
      // Ignora se já bloqueado
    }
  }

  if (existsSync(resolvedTarget)) {
    renameSync(resolvedTarget, oldBackupPath);
  }

  try {
    renameSync(tempNewPath, resolvedTarget);
  } catch (err) {
    // Rollback caso o rename do .new falhe
    if (!existsSync(resolvedTarget) && existsSync(oldBackupPath)) {
      try {
        renameSync(oldBackupPath, resolvedTarget);
      } catch {
        // Ignora erro de rollback
      }
    }
    throw err;
  }

  // Tenta remover o .old imediatamente; se for o próprio processo em execução, agenda limpeza silenciosa em background
  if (existsSync(oldBackupPath)) {
    try {
      unlinkSync(oldBackupPath);
    } catch {
      try {
        const escapedPath = oldBackupPath.replace(/'/g, "''");
        const psCommand = `Start-Sleep -Milliseconds 1500; Remove-Item -Force -LiteralPath '${escapedPath}' -ErrorAction SilentlyContinue`;
        const child = spawn(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            psCommand,
          ],
          {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
          }
        );
        child.unref();
      } catch {
        // Será limpo automaticamente na próxima inicialização via cleanupOldBinaryBackup()
      }
    }
  }
}

export async function selfUpdate(
  options: SelfUpdateOptions = {}
): Promise<SelfUpdateResult> {
  const targetPath = resolveSelfBinaryPath(options.targetPath);
  const token = options.token || resolveGitHubToken();
  const latest = await fetchLatestReleaseInfo(GITHUB_REPO, token);
  const cmp = compareSemver(VERSION, latest.version);
  const updateAvailable = cmp < 0;

  if (options.checkOnly) {
    const msg = updateAvailable
      ? `Nova versão disponível: v${latest.version} (atual: v${VERSION}). Execute 'docgov-engine --update' para atualizar.`
      : `Você já está na versão mais recente (v${VERSION}).`;
    return {
      updated: false,
      updateAvailable,
      currentVersion: VERSION,
      latestVersion: latest.version,
      targetPath,
      message: msg,
    };
  }

  if (!options.force && !updateAvailable) {
    return {
      updated: false,
      updateAvailable: false,
      currentVersion: VERSION,
      latestVersion: latest.version,
      targetPath,
      message: `Você já está na versão mais recente (v${VERSION}). Use '--force-update' para forçar a reinstalação.`,
    };
  }

  console.log(
    `Baixando ${latest.assetName} (v${latest.version}) de ${latest.downloadUrl} ...`
  );

  let binaryBuffer: ArrayBuffer | undefined;

  // Tentativa 1: Download autenticado via API do GitHub (caso seja repositório privado com token)
  if (latest.token && latest.apiUrl) {
    try {
      const apiAssetRes = await fetch(latest.apiUrl, {
        headers: {
          "User-Agent": `docgov-engine/${VERSION}`,
          Authorization: `Bearer ${latest.token}`,
          Accept: "application/octet-stream",
        },
      });
      if (apiAssetRes.ok) {
        binaryBuffer = await apiAssetRes.arrayBuffer();
      }
    } catch {
      // Prossegue para o download via URL pública
    }
  }

  // Tentativa 2: Download padrão via URL do asset
  if (!binaryBuffer) {
    const res = await fetch(latest.downloadUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": `docgov-engine/${VERSION}`,
        ...(latest.token ? { Authorization: `Bearer ${latest.token}` } : {}),
      },
    });

    if (!res.ok) {
      throw new Error(
        `Falha ao baixar o binário da release v${latest.version} (HTTP ${res.status})`
      );
    }
    binaryBuffer = await res.arrayBuffer();
  }

  const binaryUint8 = new Uint8Array(binaryBuffer);

  // Validação Criptográfica SHA-256 (Marco 5.1)
  if (!options.skipChecksumVerification) {
    const shaUrl = latest.sha256sumsDownloadUrl || latest.sha256sumsApiUrl;
    if (shaUrl) {
      try {
        const shaHeaders: Record<string, string> = {
          "User-Agent": `docgov-engine/${VERSION}`,
        };
        if (latest.token) {
          shaHeaders["Authorization"] = `Bearer ${latest.token}`;
          if (latest.sha256sumsApiUrl === shaUrl) {
            shaHeaders["Accept"] = "application/octet-stream";
          }
        }
        const shaRes = await fetch(shaUrl, {
          redirect: "follow",
          headers: shaHeaders,
        });

        if (shaRes.ok) {
          const shaText = await shaRes.text();
          const verifyResult = verifyBinarySha256(
            binaryUint8,
            latest.assetName,
            shaText
          );
          if (verifyResult.assetFoundInManifest) {
            console.log(
              `[SHA-256] Integridade criptográfica verificada: ${verifyResult.actualHash}`
            );
          }
        }
      } catch (err: any) {
        // Se a verificação falhar com divergência de checksum, interrompe imediatamente!
        if (err.message && err.message.includes("Falha de integridade criptográfica")) {
          throw err;
        }
        // Se for erro de rede ao baixar o SHA256SUMS.txt, prossegue com aviso informativo
      }
    }
  }

  // Binário standalone Bun tem ~50-100MB; exigimos pelo menos 1 MB para evitar páginas de erro HTML
  replaceBinaryOnDisk(targetPath, binaryUint8, 1024 * 1024);

  return {
    updated: true,
    updateAvailable,
    currentVersion: VERSION,
    latestVersion: latest.version,
    targetPath,
    message: `Atualizado com sucesso para v${latest.version} em: ${targetPath}`,
  };
}
