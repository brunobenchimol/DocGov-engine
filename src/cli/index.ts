import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { VERSION } from "../constants/index.ts";
import { generateEngineSpecMarkdown } from "../mcp/spec.ts";
import { selfUpdate } from "../core/updater.ts";
import {
  bootstrapCase,
  executeBackgroundCopyTask,
  formatBootstrapCaseSyntheticResult,
} from "../tools/bootstrap.ts";
import {
  inspectDoc,
  inspectDocx,
  formatInspectDocSyntheticResult,
  formatInspectDocxSyntheticResult,
} from "../tools/inspect.ts";
import { buildDocxTemplate } from "../tools/build_template.ts";
import { generateAuditDocx } from "../tools/audit.ts";
import { processDocument } from "../tools/fill_template.ts";
import {
  generateTechnicalNoteDocx,
  formatTechnicalNoteSyntheticResult,
  createTechnicalNoteDataFromDiff,
} from "../tools/technical_note.ts";
import {
  fetchPncpContract,
  formatFetchPncpSyntheticResult,
} from "../tools/pncp.ts";
import { computeStructuralDiff } from "../core/structural_diff.ts";
import { safeReadJsonFile } from "../utils/json.ts";
import type { BackgroundCopyInput, TechnicalNoteData } from "../types/index.ts";

// ============================================================================
// Modo CLI (Linha de Comando)
// ============================================================================

export async function runCli(args: string[]) {
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`docgov-engine v${VERSION}`);
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
DocGov Engine v${VERSION} — CLI & MCP Server

Uso:
  docgov-engine                                   Inicia como servidor MCP via stdio (padrão)
  docgov-engine --mcp                             Inicia como servidor MCP via stdio
  docgov-engine --dump-spec [caminho.md]          Exporta a especificação técnica integral do motor em Markdown
  docgov-engine --bootstrap-case --case-dir <dir> [--uploads-dir <dir>] [--rename-map <json>] [--wait]
  docgov-engine --inspect <arq.docx|.pdf> [--diff <base.docx|.pdf>] [--out <mapa.json>] [--compact]
  docgov-engine --build-template --source <bruto.docx> --manifest <slots_manifest.json> --out <template.docx> [--save-to-registry] [--template-id <id>]
  docgov-engine --inject --template <template.docx> --state <estado.json> --out <saida.docx> [--format <docx|pdf|both>] [--no-auto-inspect]
  docgov-engine --generate-audit-docx --audit-json <auditoria.json> --out <parecer.docx> [--format <docx|pdf|both>]
  docgov-engine --diff-report --old <base.docx|.pdf> --new <revisado.docx|.pdf> --out <nota.docx> [--format <docx|pdf|both>] [--data <evolucao.json>]
  docgov-engine --generate-technical-note --note-json <nota.json> --out <nota.docx> [--format <docx|pdf|both>]
  docgov-engine --fetch-pncp --case-dir <dir> --pncp <id_ou_url> [--shortname <nome>]
  docgov-engine --check-update                    Verifica se há nova versão disponível no GitHub
  docgov-engine -u, --update                      Atualiza o binário para a versão mais recente (se houver)
  docgov-engine --force-update                    Força o download e reinstalação da última release
  docgov-engine -v, --version                     Exibe a versão do software
  docgov-engine -h, --help                        Exibe esta mensagem de ajuda
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

  // 0d) Modo --fetch-pncp
  if (args.includes("--fetch-pncp")) {
    const fetchIdx = args.indexOf("--fetch-pncp");
    const caseDirIdx = args.indexOf("--case-dir");
    const pncpIdx = args.indexOf("--pncp");
    const shortnameIdx = args.indexOf("--shortname");

    let caseDir: string | undefined;
    if (caseDirIdx !== -1 && args[caseDirIdx + 1] && !args[caseDirIdx + 1].startsWith("--")) {
      caseDir = args[caseDirIdx + 1];
    }

    let pncpIdOrUrl: string | undefined;
    if (pncpIdx !== -1 && args[pncpIdx + 1] && !args[pncpIdx + 1].startsWith("--")) {
      pncpIdOrUrl = args[pncpIdx + 1];
    } else if (args[fetchIdx + 1] && !args[fetchIdx + 1].startsWith("--")) {
      pncpIdOrUrl = args[fetchIdx + 1];
    }

    let shortname: string | undefined;
    if (shortnameIdx !== -1 && args[shortnameIdx + 1] && !args[shortnameIdx + 1].startsWith("--")) {
      shortname = args[shortnameIdx + 1];
    }

    if (!caseDir) {
      console.error("Erro: Informe o diretório do caso usando --case-dir <dir>.");
      process.exit(1);
    }
    if (!pncpIdOrUrl) {
      console.error("Erro: Informe o identificador ou URL do PNCP usando --pncp <id_ou_url>.");
      process.exit(1);
    }

    try {
      const res = await fetchPncpContract(caseDir, pncpIdOrUrl, { shortname });
      const synthetic = formatFetchPncpSyntheticResult(res);
      console.log(JSON.stringify(synthetic, null, 2));
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 1) Modo --inspect ou --file
  if (args.includes("--inspect") || args.includes("--file")) {
    const inspectIdx = args.indexOf("--inspect");
    const fileIdx = args.indexOf("--file");
    const docxIdx = args.indexOf("--docx");
    const sourceIdx = args.indexOf("--source");
    const outIdx = args.indexOf("--out");
    const compact = args.includes("--compact");

    let filePath: string | undefined;
    if (fileIdx !== -1 && args[fileIdx + 1] && !args[fileIdx + 1].startsWith("--")) {
      filePath = args[fileIdx + 1];
    } else if (docxIdx !== -1 && args[docxIdx + 1] && !args[docxIdx + 1].startsWith("--")) {
      filePath = args[docxIdx + 1];
    } else if (sourceIdx !== -1 && args[sourceIdx + 1] && !args[sourceIdx + 1].startsWith("--")) {
      filePath = args[sourceIdx + 1];
    } else if (inspectIdx !== -1 && args[inspectIdx + 1] && !args[inspectIdx + 1].startsWith("--")) {
      filePath = args[inspectIdx + 1];
    }

    const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;

    const diffIdx = args.indexOf("--diff");
    let compareWithPath: string | undefined;
    if (diffIdx !== -1 && args[diffIdx + 1] && !args[diffIdx + 1].startsWith("--")) {
      compareWithPath = args[diffIdx + 1];
    }

    if (!filePath) {
      console.error("Erro: Informe o caminho do arquivo (.docx ou .pdf) após --inspect ou --file.");
      process.exit(1);
    }

    try {
      const res = await inspectDoc(filePath, outPath, compact, {
        compareWithPath,
      });
      if (outPath) {
        const synthetic = formatInspectDocSyntheticResult(
          filePath,
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

    const formatIdx =
      args.indexOf("--format") !== -1
        ? args.indexOf("--format")
        : args.indexOf("-f");
    const explicitFormat =
      formatIdx !== -1 && ["docx", "pdf", "both"].includes(args[formatIdx + 1])
        ? (args[formatIdx + 1] as "docx" | "pdf" | "both")
        : undefined;
    const outputFormat =
      explicitFormat || (outPath.toLowerCase().endsWith(".pdf") ? "pdf" : undefined);

    try {
      const res = await generateAuditDocx(auditJsonPath, outPath, {
        outputFormat,
      });
      console.log(res.message);
      if (res.pdf_path) {
        console.log(`Documento PDF gerado: ${res.pdf_path}`);
      }
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 2c) Modo --diff-report
  if (args.includes("--diff-report")) {
    const oldIdx = args.indexOf("--old");
    const newIdx = args.indexOf("--new");
    const outIdx = args.indexOf("--out");
    const dataIdx = args.indexOf("--data");
    const flagIdx = args.indexOf("--diff-report");

    let oldPath: string | undefined = oldIdx !== -1 ? args[oldIdx + 1] : undefined;
    let newPath: string | undefined = newIdx !== -1 ? args[newIdx + 1] : undefined;
    let outPath: string | undefined = outIdx !== -1 ? args[outIdx + 1] : undefined;
    let dataPath: string | undefined = dataIdx !== -1 ? args[dataIdx + 1] : undefined;

    // Argumentos posicionais: --diff-report <old> <new> <out>
    if (!oldPath && args[flagIdx + 1] && !args[flagIdx + 1].startsWith("--")) {
      oldPath = args[flagIdx + 1];
      if (args[flagIdx + 2] && !args[flagIdx + 2].startsWith("--")) {
        newPath = args[flagIdx + 2];
        if (args[flagIdx + 3] && !args[flagIdx + 3].startsWith("--")) {
          outPath = args[flagIdx + 3];
        }
      }
    }

    if (!oldPath || !newPath || !outPath) {
      console.error(
        "Erro: Parâmetros obrigatórios para --diff-report: --old <base>, --new <revisado> e --out <nota.docx>."
      );
      process.exit(1);
    }

    const formatIdx =
      args.indexOf("--format") !== -1
        ? args.indexOf("--format")
        : args.indexOf("-f");
    const explicitFormat =
      formatIdx !== -1 && ["docx", "pdf", "both"].includes(args[formatIdx + 1])
        ? (args[formatIdx + 1] as "docx" | "pdf" | "both")
        : undefined;
    const outputFormat =
      explicitFormat || (outPath.toLowerCase().endsWith(".pdf") ? "pdf" : undefined);

    try {
      const resolvedOld = resolve(oldPath);
      const resolvedNew = resolve(newPath);

      const oldInspection = await inspectDoc(resolvedOld, undefined, true);
      const newInspection = await inspectDoc(resolvedNew, undefined, true);
      const diff = computeStructuralDiff(oldInspection, newInspection, resolvedOld, resolvedNew);

      let noteData: TechnicalNoteData;

      if (dataPath) {
        const resolvedData = resolve(dataPath);
        const raw = safeReadJsonFile(resolvedData);
        noteData = createTechnicalNoteDataFromDiff(diff, resolvedOld, resolvedNew, raw);
      } else {
        noteData = createTechnicalNoteDataFromDiff(diff, resolvedOld, resolvedNew);
      }

      const res = await generateTechnicalNoteDocx(noteData, outPath, {
        outputFormat,
      });
      console.log(res.message);
      if (res.pdf_path) {
        console.log(`Documento PDF gerado: ${res.pdf_path}`);
      }
    } catch (err: any) {
      console.error(`Erro: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 2d) Modo --generate-technical-note
  if (args.includes("--generate-technical-note")) {
    const noteJsonIdx = args.indexOf("--note-json");
    const stateIdx = args.indexOf("--state");
    const outIdx = args.indexOf("--out");
    const flagIdx = args.indexOf("--generate-technical-note");

    let noteJsonPath: string | undefined;
    if (noteJsonIdx !== -1 && args[noteJsonIdx + 1]) {
      noteJsonPath = args[noteJsonIdx + 1];
    } else if (stateIdx !== -1 && args[stateIdx + 1]) {
      noteJsonPath = args[stateIdx + 1];
    } else if (
      flagIdx !== -1 &&
      args[flagIdx + 1] &&
      !args[flagIdx + 1].startsWith("--")
    ) {
      noteJsonPath = args[flagIdx + 1];
    }

    const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;

    if (!noteJsonPath || !outPath) {
      console.error(
        "Erro: Parâmetros obrigatórios para --generate-technical-note: --note-json <nota.json> e --out <nota.docx>."
      );
      process.exit(1);
    }

    const formatIdx =
      args.indexOf("--format") !== -1
        ? args.indexOf("--format")
        : args.indexOf("-f");
    const explicitFormat =
      formatIdx !== -1 && ["docx", "pdf", "both"].includes(args[formatIdx + 1])
        ? (args[formatIdx + 1] as "docx" | "pdf" | "both")
        : undefined;
    const outputFormat =
      explicitFormat || (outPath.toLowerCase().endsWith(".pdf") ? "pdf" : undefined);

    try {
      const res = await generateTechnicalNoteDocx(noteJsonPath, outPath, {
        outputFormat,
      });
      console.log(res.message);
      if (res.pdf_path) {
        console.log(`Documento PDF gerado: ${res.pdf_path}`);
      }
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

  const formatIdx =
    args.indexOf("--format") !== -1
      ? args.indexOf("--format")
      : args.indexOf("-f");
  const explicitFormat =
    formatIdx !== -1 && ["docx", "pdf", "both"].includes(args[formatIdx + 1])
      ? (args[formatIdx + 1] as "docx" | "pdf" | "both")
      : undefined;
  const outPath = args[outIdx + 1];
  const outputFormat =
    explicitFormat || (outPath?.toLowerCase().endsWith(".pdf") ? "pdf" : undefined);

  try {
    const res = await processDocument(
      args[templateIdx + 1],
      args[stateIdx + 1],
      args[outIdx + 1],
      { autoInspect: !noAutoInspect, outputFormat }
    );
    console.log(res.message);
    if (res.pdf_path) {
      console.log(`Documento PDF gerado: ${res.pdf_path}`);
    }
    if (res.visao_auditoria_path) {
      console.log(`Visão linear de auditoria: ${res.visao_auditoria_path}`);
    }
  } catch (err: any) {
    console.error(`Erro: ${err.message}`);
    process.exit(1);
  }
}

