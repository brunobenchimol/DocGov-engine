// ============================================================================
// Verificador de Teto Físico de Arquivos (Lei 9 do Estatuto de Governança)
// docgov-engine — scripts/check_lines.ts
// Valida que nenhum arquivo em src/tools/juris/, test/, tests_live/ e scripts/
// ultrapasse 500 linhas de código (Lei 9 estendida à governança de testes).
// ============================================================================

import { readdirSync, statSync, readFileSync, existsSync } from "fs";
import { join, relative } from "path";

const rootDir = join(import.meta.dir, "..");
const MAX_LINES = 500;

const targetArg = process.argv[2]?.toLowerCase() || "all";

const targetDirsMap: Record<string, string[]> = {
  juris: [join(rootDir, "src", "tools", "juris")],
  pdf: [join(rootDir, "src", "utils", "pdf")],
  forensics: [join(rootDir, "src", "utils", "forensics")],
  contracts: [join(rootDir, "src", "contracts")],
  arp: [join(rootDir, "src", "arp")],
  bidding: [join(rootDir, "src", "bidding")],
  direct_contracting: [join(rootDir, "src", "direct_contracting")],
  demo_costs: [join(rootDir, "src", "demo_costs")],
  engineering: [join(rootDir, "src", "engineering")],
  cli: [join(rootDir, "src", "cli")],
  mcp: [join(rootDir, "src", "mcp")],
  parsers: [join(rootDir, "src", "parsers")],
  constants: [join(rootDir, "src", "constants")],
  types: [join(rootDir, "src", "types")],
  test: [join(rootDir, "test")],
  tests_live: [join(rootDir, "tests_live")],
  scripts: [join(rootDir, "scripts")],
  all: [
    join(rootDir, "src", "tools", "juris"),
    join(rootDir, "src", "utils", "pdf"),
    join(rootDir, "src", "utils", "forensics"),
    join(rootDir, "src", "contracts"),
    join(rootDir, "src", "arp"),
    join(rootDir, "src", "bidding"),
    join(rootDir, "src", "direct_contracting"),
    join(rootDir, "src", "demo_costs"),
    join(rootDir, "src", "engineering"),
    join(rootDir, "src", "cli"),
    join(rootDir, "src", "mcp"),
    join(rootDir, "src", "parsers"),
    join(rootDir, "src", "constants"),
    join(rootDir, "src", "types"),
    join(rootDir, "test"),
    join(rootDir, "tests_live"),
    join(rootDir, "scripts"),
  ],
};

const auditDirs = targetDirsMap[targetArg] || targetDirsMap.all;

function getAllTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
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

let allFiles: string[] = [];
for (const dir of auditDirs) {
  allFiles.push(...getAllTsFiles(dir));
}

let failed = false;

console.log(
  `Auditoria Física de Linhas — Lei 9 (Teto Estrito: <= ${MAX_LINES} linhas)\n` +
  `Diretórios auditados: ${auditDirs.map((d) => relative(rootDir, d)).join(", ")}\n`
);

for (const file of allFiles) {
  const content = readFileSync(file, "utf-8");
  const lineCount = content.split("\n").length;
  const rel = relative(rootDir, file).replace(/\\/g, "/");

  if (lineCount > MAX_LINES) {
    console.error(`❌ VIOLAÇÃO DA LEI 9: ${rel} possui ${lineCount} linhas (> ${MAX_LINES})!`);
    failed = true;
  } else {
    console.log(`  ✅ ${rel.padEnd(50)} : ${lineCount} linhas`);
  }
}

if (failed) {
  console.error(`\n❌ Falha na auditoria de conformidade da Lei 9. Reduza o tamanho dos arquivos.`);
  process.exit(1);
} else {
  console.log(`\n✨ Conformidade Total com a Lei 9: Todos os ${allFiles.length} arquivos auditados respeitam <= ${MAX_LINES} linhas.`);
}
