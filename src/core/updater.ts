import {
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  renameSync,
  chmodSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { spawn } from "node:child_process";
import { VERSION, GITHUB_REPO } from "../constants/index.ts";
import type {
  SelfUpdateOptions,
  SelfUpdateResult,
  ReleaseInfo,
} from "../types/index.ts";
import {
  compareSemver,
  getPlatformAssetName,
  getLegacyPlatformAssetName,
  resolveSelfBinaryPath,
  cleanupOldBinaryBackup,
  resolveGitHubToken,
  verifyBinarySha256,
} from "./updater_crypto_and_env.ts";

export * from "./updater_crypto_and_env.ts";
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
