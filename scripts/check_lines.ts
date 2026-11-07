// ============================================================================
// Verificador de Teto Físico de Arquivos (Lei 9 do Estatuto de Governança)
// docgov-engine — scripts/check_lines.ts
// Valida que nenhum arquivo em src/tools/juris/ ultrapasse 500 linhas.
// ============================================================================

import { readdirSync, statSync, readFileSync } from "fs";
import { join, relative } from "path";

const targetArg = process.argv[2] || "juris";
const baseDir = targetArg === "all"
  ? join(import.meta.dir, "..", "src")
  : join(import.meta.dir, "..", "src", "tools", "juris");

const MAX_LINES = 500;

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const item of readdirSync(dir)) {
    const full = join(dir, item);
    const s = statSync(full);
    if (s.isDirectory()) {
      files.push(...getAllTsFiles(full));
    } else if (item.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = getAllTsFiles(baseDir);
let failed = false;

console.log(`Auditoria Física de Linhas em ${relative(process.cwd(), baseDir)} (Teto Estrito: ${MAX_LINES} linhas):\n`);

for (const file of allFiles) {
  const content = readFileSync(file, "utf-8");
  const lineCount = content.split("\n").length;
  const rel = relative(baseDir, file).replace(/\\/g, "/");

  if (lineCount > MAX_LINES) {
    console.error(`❌ VIOLAÇÃO DA LEI 9: ${rel} possui ${lineCount} linhas (> ${MAX_LINES})!`);
    failed = true;
  } else {
    console.log(`  ✅ ${rel.padEnd(45)} : ${lineCount} linhas`);
  }
}

if (failed) {
  console.error(`\n❌ Falha na auditoria de conformidade da Lei 9. Reduza o tamanho dos arquivos.`);
  process.exit(1);
} else {
  console.log(`\n✨ Conformidade Total com a Lei 9: Todos os ${allFiles.length} arquivos respeitam <= ${MAX_LINES} linhas.`);
}
