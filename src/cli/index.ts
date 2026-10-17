import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { VERSION } from "../constants/index.ts";
import { generateEngineSpecMarkdown } from "../mcp/spec.ts";
import { selfUpdate } from "../core/updater.ts";
import {
  bootstrapCase,
  executeBackgroundCopyTask,
  formatBootstrapCaseSyntheticResult,
} from "../tools/bootstrap.ts";
import {
  inspectDocx,
  formatInspectDocxSyntheticResult,
} from "../tools/inspect.ts";
import { buildDocxTemplate } from "../tools/build_template.ts";
import { generateAuditDocx } from "../tools/audit.ts";
import { processDocument } from "../tools/fill_template.ts";
import type { BackgroundCopyInput } from "../types/index.ts";

// ============================================================================
// Modo CLI (Linha de Comando)
// ============================================================================

export async function runCli(args: string[]) {
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`docgov-docx-engine v${VERSION}`);
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
DocGov Docx Engine v${VERSION} — CLI & MCP Server

Uso:
  docgov-docx                                     Inicia como servidor MCP via stdio (padrão)
  docgov-docx --mcp                               Inicia como servidor MCP via stdio
  docgov-docx --dump-spec [caminho.md]            Exporta a especificação técnica integral do motor em Markdown
  docgov-docx --bootstrap-case --case-dir <dir> [--uploads-dir <dir>] [--rename-map <json>] [--wait]
  docgov-docx --inspect <arq.docx> [--out <mapa.json>] [--compact]
  docgov-docx --build-template --source <bruto.docx> --manifest <slots_manifest.json> --out <template.docx> [--save-to-registry] [--template-id <id>]
  docgov-docx --inject --template <template.docx> --state <estado.json> --out <saida.docx> [--no-auto-inspect]
  docgov-docx --generate-audit-docx --audit-json <auditoria.json> --out <parecer.docx>
  docgov-docx --check-update                      Verifica se há nova versão disponível no GitHub
  docgov-docx -u, --update                        Atualiza o binário para a versão mais recente (se houver)
  docgov-docx --force-update                      Força o download e reinstalação da última release
  docgov-docx -v, --version                       Exibe a versão do software
  docgov-docx -h, --help                          Exibe esta mensagem de ajuda
`);
    return;
  }

  // 0c) Modo --dump-spec
  if (args.includes("--dump-spec")) {
    const specIdx = args.indexOf("--dump-spec");
    const outIdx = args.indexOf("--out");
    let outputPath: string | undefined;
    if (outIdx !== -1 && args[outIdx + 1] && !args[outIdx + 1].startsWith("--")) {
      outputPath = args[outIdx + 1];
    } else if (
      args[specIdx + 1] &&
      !args[specIdx + 1].startsWith("--")
    ) {
      outputPath = args[specIdx + 1];
    }

    const specMarkdown = generateEngineSpecMarkdown();
    if (outputPath) {
      const resolved = resolve(outputPath);
      mkdirSync(dirname(resolved), { recursive: true });
      writeFileSync(resolved, specMarkdown, "utf8");
      console.log(`Especificação técnica do motor gravada com sucesso em: ${resolved}`);
    } else {
      process.stdout.write(specMarkdown + "\n");
    }
    return;
  }

  // 0a) Modo interno de cópia em segundo plano desanexada
  if (args.includes("--internal-bg-copy")) {
    const sourceIdx = args.indexOf("--source");
    const destIdx = args.indexOf("--dest");
    const stateIdx = args.indexOf("--state");
    const filesIdx = args.indexOf("--files");
    if (
      sourceIdx !== -1 &&
      destIdx !== -1 &&
      stateIdx !== -1 &&
      filesIdx !== -1
    ) {
      try {
        const sourceDir = args[sourceIdx + 1];
        const destDir = args[destIdx + 1];
        const stateDir = args[stateIdx + 1];
        const files: BackgroundCopyInput = JSON.parse(args[filesIdx + 1]);
        await executeBackgroundCopyTask(sourceDir, destDir, stateDir, files);
      } catch {
        process.exit(1);
      }
    }
    return;
  }

  // 0) Modo Auto-Atualização (--check-update, --update, -u, --force-update)
  if (
    args.includes("--check-update") ||
    args.includes("--update") ||
    args.includes("-u") ||
    args.includes("--force-update")
  ) {
    const checkOnly = args.includes("--check-update");
    const force = args.includes("--force-update");
    const outIdx = args.indexOf("--out");
    const customTarget = outIdx !== -1 ? args[outIdx + 1] : undefined;

    try {
      const res = await selfUpdate({
        checkOnly,
        force,
        targetPath: customTarget,
      });
      console.log(res.message);
    } catch (err: any) {
      console.error(`Erro na atualização: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 0b) Modo --bootstrap-case
  if (args.includes("--bootstrap-case")) {
    const caseDirIdx = args.indexOf("--case-dir");
    const uploadsDirIdx = args.indexOf("--uploads-dir");
    const renameMapIdx = args.indexOf("--rename-map");
    const bootstrapIdx = args.indexOf("--bootstrap-case");
    const wait = args.includes("--wait");

    let caseDir: string | undefined;
    if (caseDirIdx !== -1 && args[caseDirIdx + 1]) {
      caseDir = args[caseDirIdx + 1];
    } else if (
      args[bootstrapIdx + 1] &&
      !args[bootstrapIdx + 1].startsWith("--")
    ) {
      caseDir = args[bootstrapIdx + 1];
    }

    const uploadsDir =
      uploadsDirIdx !== -1 ? args[uploadsDirIdx + 1] : undefined;

    let fileRenameMap: Record<string, string> | undefined;
    if (renameMapIdx !== -1 && args[renameMapIdx + 1]) {
      try {
        fileRenameMap = JSON.parse(args[renameMapIdx + 1]);
      } catch {
        console.error(
          "Aviso: Falha ao interpretar --rename-map como JSON válido."
        );
      }
    }

    if (!caseDir) {
      console.error(
        "Erro: Informe o diretório do caso usando --case-dir <dir>."
      );
      process.exit(1);
    }

    try {
      const res = await bootstrapCase(caseDir, uploadsDir, {
        waitBackground: wait,
        detachedCli: !wait,
        fileRenameMap,
      });
      const synthetic = formatBootstrapCaseSyntheticResult(res, caseDir);
      console.log(JSON.stringify(synthetic, null, 2));
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 1) Modo --inspect
  if (args.includes("--inspect")) {
    const inspectIdx = args.indexOf("--inspect");
    const sourceIdx = args.indexOf("--source");
    const outIdx = args.indexOf("--out");
    const compact = args.includes("--compact");

    let docxPath: string | undefined;
    if (sourceIdx !== -1 && args[sourceIdx + 1]) {
      docxPath = args[sourceIdx + 1];
    } else if (
      args[inspectIdx + 1] &&
      !args[inspectIdx + 1].startsWith("--")
    ) {
      docxPath = args[inspectIdx + 1];
    }

    const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;

    if (!docxPath) {
      console.error("Erro: Informe o caminho do arquivo .docx após --inspect.");
      process.exit(1);
    }

    try {
      const res = await inspectDocx(docxPath, outPath, compact);
      if (outPath) {
        const synthetic = formatInspectDocxSyntheticResult(
          docxPath,
          resolve(outPath),
          res
        );
        console.log(JSON.stringify(synthetic, null, 2));
      } else {
        console.log(JSON.stringify(res, null, 2));
      }
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 2) Modo --build-template
  if (args.includes("--build-template")) {
    const sourceIdx = args.indexOf("--source");
    const manifestIdx = args.indexOf("--manifest");
    const outIdx = args.indexOf("--out");

    if (sourceIdx === -1 || manifestIdx === -1 || outIdx === -1) {
      console.error(
        "Erro: Parâmetros obrigatórios para --build-template: --source, --manifest e --out."
      );
      process.exit(1);
    }

    const saveToRegistry = args.includes("--save-to-registry");
    const templateIdIdx = args.indexOf("--template-id");
    const templateId =
      templateIdIdx !== -1 ? args[templateIdIdx + 1] : undefined;

    try {
      const res = await buildDocxTemplate(
        args[sourceIdx + 1],
        args[manifestIdx + 1],
        args[outIdx + 1],
        { saveToRegistry, templateId }
      );
      console.log(res.message);
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 2b) Modo --generate-audit / --generate-audit-docx
  if (
    args.includes("--generate-audit-docx") ||
    args.includes("--generate-audit")
  ) {
    const auditJsonIdx = args.indexOf("--audit-json");
    const stateIdx = args.indexOf("--state");
    const outIdx = args.indexOf("--out");
    const flagIdx = args.includes("--generate-audit-docx")
      ? args.indexOf("--generate-audit-docx")
      : args.indexOf("--generate-audit");

    let auditJsonPath: string | undefined;
    if (auditJsonIdx !== -1 && args[auditJsonIdx + 1]) {
      auditJsonPath = args[auditJsonIdx + 1];
    } else if (stateIdx !== -1 && args[stateIdx + 1]) {
      auditJsonPath = args[stateIdx + 1];
    } else if (
      flagIdx !== -1 &&
      args[flagIdx + 1] &&
      !args[flagIdx + 1].startsWith("--")
    ) {
      auditJsonPath = args[flagIdx + 1];
    }

    const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;

    if (!auditJsonPath || !outPath) {
      console.error(
        "Erro: Parâmetros obrigatórios para --generate-audit-docx: --audit-json e --out."
      );
      process.exit(1);
    }

    try {
      const res = await generateAuditDocx(auditJsonPath, outPath);
      console.log(res.message);
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 3) Modo --inject / --template
  const templateIdx = args.indexOf("--template");
  const stateIdx = args.indexOf("--state");
  const outIdx = args.indexOf("--out");
  const noAutoInspect = args.includes("--no-auto-inspect");

  if (templateIdx === -1 || stateIdx === -1 || outIdx === -1) {
    console.error(
      "Erro: Parâmetros obrigatórios ausentes: --template, --state e --out."
    );
    process.exit(1);
  }

  try {
    const res = await processDocument(
      args[templateIdx + 1],
      args[stateIdx + 1],
      args[outIdx + 1],
      { autoInspect: !noAutoInspect }
    );
    console.log(res.message);
    if (res.visao_auditoria_path) {
      console.log(`Visão linear de auditoria: ${res.visao_auditoria_path}`);
    }
  } catch (err: any) {
    console.error(`Erro: ${err.message}`);
    process.exit(1);
  }
}

