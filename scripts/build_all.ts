import { existsSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { generateSha256Sums } from "./generate_sha256sums.ts";
import { generateEngineSpecMarkdown } from "../src/mcp/spec.ts";

export interface BuildAllOptions {
  skipCompile?: boolean;
  currentOnly?: boolean;
  binDir?: string;
  silent?: boolean;
}

export interface BuildAllResult {
  success: boolean;
  binDir: string;
  sha256Path: string;
  specPath: string;
  compiledLinux: boolean;
  compiledWindows: boolean;
  elapsedMs: number;
}

/**
 * Orquestrador central e unificado de build, empacotamento local,
 * geração de checksums SHA-256 e sincronização de Self-Discovery (--dump-spec).
 * 
 * Executa em uma única chamada:
 * 1. Compilação multi-plataforma (Linux x64 e Windows x64 via Bun);
 * 2. Cópia e normalização canônica de nomes (cross-platform via node:fs);
 * 3. Geração criptográfica determinística de bin/SHA256SUMS.txt;
 * 4. Sincronização obrigatória de docs/especificacao_motor.md (Lei 4).
 */
export async function buildAll(options: BuildAllOptions = {}): Promise<BuildAllResult> {
  const startTime = Date.now();
  const binDir = resolve(options.binDir || "./bin");
  const log = options.silent ? () => {} : console.log;

  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  log("🚀 [build:all] Iniciando consolidação de build do docgov-engine...");

  let compiledLinux = false;
  let compiledWindows = false;

  // 1. Compilação Standalone com Bun
  if (!options.skipCompile) {
    const shouldBuildLinux = !options.currentOnly || process.platform === "linux";
    const shouldBuildWin = !options.currentOnly || process.platform === "win32";

    if (shouldBuildLinux) {
      log("📦 Compilando binário Linux x64 (./bin/docgov-engine)...");
      const outLinux = join(binDir, "docgov-engine");
      const proc = Bun.spawnSync([
        "bun",
        "build",
        "./src/index.ts",
        "--compile",
        "--minify",
        "--outfile",
        outLinux,
      ]);

      if (proc.exitCode !== 0) {
        const err = proc.stderr?.toString() || "Erro desconhecido na compilação Linux";
        throw new Error(`Falha no build Linux: ${err}`);
      }
      compiledLinux = true;
    }

    if (shouldBuildWin) {
      log("📦 Compilando binário Windows x64 (./bin/docgov-engine.exe)...");
      const outWin = join(binDir, "docgov-engine.exe");
      const proc = Bun.spawnSync([
        "bun",
        "build",
        "./src/index.ts",
        "--compile",
        "--target=bun-windows-x64",
        "--minify",
        "--outfile",
        outWin,
      ]);

      if (proc.exitCode !== 0) {
        const err = proc.stderr?.toString() || "Erro desconhecido na compilação Windows";
        throw new Error(`Falha no build Windows: ${err}`);
      }
      compiledWindows = true;
    }
  } else {
    log("⏩ Pulando etapa de compilação (--skip-compile)...");
  }

  // 2. Cópia e Normalização Canônica de Nomes (Cross-Platform via node:fs)
  log("📋 Normalizando nomes canônicos de release...");
  const linuxPrimary = join(binDir, "docgov-engine");
  const linuxCanonical = join(binDir, "docgov-engine-linux-x64");
  if (existsSync(linuxPrimary)) {
    copyFileSync(linuxPrimary, linuxCanonical);
  }

  const winPrimary = join(binDir, "docgov-engine.exe");
  const winCanonical = join(binDir, "docgov-engine-win-x64.exe");
  if (existsSync(winPrimary)) {
    copyFileSync(winPrimary, winCanonical);
  }

  // 3. Geração Determinística de Checksums SHA-256
  log("🔒 Gerando SHA256SUMS.txt...");
  const sha256Path = generateSha256Sums(binDir);

  // 4. Sincronização Obrigatória de Self-Discovery (docs/especificacao_motor.md — Lei 4)
  log("📄 Sincronizando especificação docs/especificacao_motor.md (--dump-spec)...");
  const specContent = generateEngineSpecMarkdown();
  const specPath = resolve("./docs/especificacao_motor.md");
  writeFileSync(specPath, specContent, "utf-8");

  const elapsedMs = Date.now() - startTime;
  const elapsedSec = (elapsedMs / 1000).toFixed(2);
  log(`✨ [build:all] Pipeline concluído com sucesso em ${elapsedSec}s!`);

  return {
    success: true,
    binDir,
    sha256Path,
    specPath,
    compiledLinux,
    compiledWindows,
    elapsedMs,
  };
}

// Execução direta pela CLI (ex: bun run ./scripts/build_all.ts)
if (import.meta.main || process.argv[1]?.endsWith("build_all.ts")) {
  const args = process.argv.slice(2);
  buildAll({
    skipCompile: args.includes("--skip-compile"),
    currentOnly: args.includes("--current"),
  }).catch((err) => {
    console.error("❌ Erro fatal em build:all:", err);
    process.exit(1);
  });
}
