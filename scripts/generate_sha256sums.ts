import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

export function generateSha256Sums(binDir: string = "./bin"): string {
  const resolvedBinDir = resolve(binDir);
  if (!existsSync(resolvedBinDir)) {
    mkdirSync(resolvedBinDir, { recursive: true });
  }

  const entries: Array<{ fileName: string; hash: string }> = [];

  const targets = [
    { diskName: "docgov-engine", releaseAliases: ["docgov-engine", "docgov-engine-linux-x64"] },
    { diskName: "docgov-engine.exe", releaseAliases: ["docgov-engine.exe", "docgov-engine-win-x64.exe"] },
  ];

  for (const t of targets) {
    const filePath = resolve(resolvedBinDir, t.diskName);
    if (existsSync(filePath)) {
      const buffer = readFileSync(filePath);
      const hash = createHash("sha256").update(buffer).digest("hex").toLowerCase();
      for (const alias of t.releaseAliases) {
        entries.push({ fileName: alias, hash });
      }
    }
  }

  const lines = entries.map((e) => `${e.hash}  ${e.fileName}`);
  const content = lines.join("\n") + (lines.length > 0 ? "\n" : "");

  const outPath = resolve(resolvedBinDir, "SHA256SUMS.txt");
  writeFileSync(outPath, content, "utf-8");
  return outPath;
}

// Execução direta
if (import.meta.main || process.argv[1]?.endsWith("generate_sha256sums.ts")) {
  const out = generateSha256Sums();
  console.log(`SHA256SUMS.txt gerado com sucesso em: ${out}`);
}
