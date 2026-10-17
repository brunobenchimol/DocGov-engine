import {
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  renameSync,
  chmodSync,
} from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { spawn } from "node:child_process";
import { VERSION, GITHUB_REPO } from "../constants/index.ts";
import type { SelfUpdateOptions, SelfUpdateResult } from "../types/index.ts";

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
        ? "./bin/docgov-docx.exe"
        : "./bin/docgov-docx"
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

export async function fetchLatestReleaseInfo(
  repo: string = GITHUB_REPO
): Promise<{
  tag: string;
  version: string;
  downloadUrl: string;
  assetName: string;
}> {
  const assetName = getPlatformAssetName();

  // Tentativa 1: API oficial do GitHub
  try {
    const apiRes = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      {
        headers: {
          "User-Agent": `docgov-docx-engine/${VERSION}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (apiRes.ok) {
      const data = (await apiRes.json()) as {
        tag_name?: string;
        assets?: Array<{ name: string; browser_download_url: string }>;
      };
      if (data.tag_name) {
        const tag = data.tag_name;
        const version = tag.replace(/^v/i, "");
        const matchedAsset = data.assets?.find((a) => a.name === assetName);
        const downloadUrl =
          matchedAsset?.browser_download_url ??
          `https://github.com/${repo}/releases/download/${tag}/${assetName}`;
        return { tag, version, downloadUrl, assetName };
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
        "User-Agent": `docgov-docx-engine/${VERSION}`,
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
  return { tag, version, downloadUrl, assetName };
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
  const latest = await fetchLatestReleaseInfo();
  const cmp = compareSemver(VERSION, latest.version);
  const updateAvailable = cmp < 0;

  if (options.checkOnly) {
    const msg = updateAvailable
      ? `Nova versão disponível: v${latest.version} (atual: v${VERSION}). Execute 'docgov-docx --update' para atualizar.`
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
  const res = await fetch(latest.downloadUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": `docgov-docx-engine/${VERSION}`,
    },
  });

  if (!res.ok) {
    throw new Error(
      `Falha ao baixar o binário da release v${latest.version} (HTTP ${res.status})`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  // Binário standalone Bun tem ~50-100MB; exigimos pelo menos 1 MB para evitar páginas de erro
  replaceBinaryOnDisk(targetPath, new Uint8Array(arrayBuffer), 1024 * 1024);

  return {
    updated: true,
    updateAvailable,
    currentVersion: VERSION,
    latestVersion: latest.version,
    targetPath,
    message: `Atualizado com sucesso para v${latest.version} em: ${targetPath}`,
  };
}

