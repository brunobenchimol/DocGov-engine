// ============================================================================
// docgov-docx-engine — Facade Principal & Entrypoint
// ============================================================================

// 1. Constantes de Governança e Autodescoberta
export * from "./constants/index.ts";

// 2. Tipos e Modelos Estruturais
export * from "./types/index.ts";

// 3. Contratos e Padrão Exact Copy-Paste Error
export * from "./contracts/errors.ts";

// 4. Utilitários (XML/DOM, JSON Resiliente e Nomenclatura Semântica)
export * from "./utils/xml.ts";
export * from "./utils/json.ts";
export * from "./utils/naming.ts";

// 5. Motor Central (Manifesto, Registro Global e Auto-Atualizador)
export * from "./core/manifest.ts";
export * from "./core/registry.ts";
export * from "./core/updater.ts";

// 6. Ferramentas do Pipeline (Bootstrap, Inspect, Build, Fill, Audit)
export * from "./tools/inspect.ts";
export * from "./tools/bootstrap.ts";
export * from "./tools/build_template.ts";
export * from "./tools/fill_template.ts";
export * from "./tools/audit.ts";

// 7. Servidor MCP e Especificação Técnica (--dump-spec)
export * from "./mcp/spec.ts";
export * from "./mcp/server.ts";

// 8. Modo CLI
export * from "./cli/index.ts";

// ============================================================================
// Entrada Principal (Execução Direta via CLI ou MCP stdio)
// ============================================================================

import { cleanupOldBinaryBackup } from "./core/updater.ts";
import { runCli } from "./cli/index.ts";
import { runMcpServer } from "./mcp/server.ts";

if (import.meta.main) {
  cleanupOldBinaryBackup();
  const args = process.argv.slice(2);

  // Se tiver flag explícita de CLI, roda CLI.
  // Caso contrário (sem args ou com --mcp), sobe como MCP server imediatamente.
  if (
    args.includes("--dump-spec") ||
    args.includes("--internal-bg-copy") ||
    args.includes("--bootstrap-case") ||
    args.includes("--inspect") ||
    args.includes("--build-template") ||
    args.includes("--inject") ||
    args.includes("--template") ||
    args.includes("--generate-audit-docx") ||
    args.includes("--generate-audit") ||
    args.includes("--check-update") ||
    args.includes("--update") ||
    args.includes("-u") ||
    args.includes("--force-update") ||
    args.includes("--help") ||
    args.includes("-h") ||
    args.includes("--version") ||
    args.includes("-v")
  ) {
    runCli(args);
  } else {
    runMcpServer();
  }
}
