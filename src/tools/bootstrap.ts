import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
} from "node:fs";
import { resolve, relative, extname } from "node:path";
import { spawn } from "node:child_process";
import {
  detectFileExtensionFromBuffer,
  resolveTargetFileName,
} from "../utils/naming.ts";
import { inspectDocx, compactInspectionResult } from "./inspect.ts";
import { resolveSelfBinaryPath } from "../core/updater.ts";
import { VERSION } from "../constants/index.ts";
import type {
  BackgroundCopyFileItem,
  BackgroundCopyInput,
  SalvaguardaStatus,
  BackgroundCopyInfo,
  IngestedFileSummary,
  BootstrapCaseOptions,
  BootstrapCaseResult,
  BootstrapCaseSyntheticResult,
} from "../types/index.ts";

// ============================================================================
// Salvaguarda em Segundo Plano e Inicialização de Caso (bootstrap_case)
// ============================================================================

export const activeBackgroundCopies = new Map<string, Promise<void>>();

export async function executeBackgroundCopyTask(
  sourceDir: string,
  destDir: string,
  stateDir: string,
  files: BackgroundCopyInput
): Promise<void> {
  const statusFilePath = resolve(stateDir, "salvaguarda_status.json");
  const normalizedItems: BackgroundCopyFileItem[] = files.map((item) =>
    typeof item === "string" ? { source: item, target: item } : item
  );
  const pending = normalizedItems.map((i) => i.target);
  const completed: string[] = [];
  const failed: Array<{ file: string; error: string }> = [];

  const updateStatus = (status: SalvaguardaStatus["status"]) => {
    try {
      const data: SalvaguardaStatus = {
        status,
        totalFiles: normalizedItems.length,
        pendingFiles: pending.filter(
          (f) => !completed.includes(f) && !failed.some((x) => x.file === f)
        ),
        completedFiles: [...completed],
        failedFiles: [...failed],
        startedAt,
        updatedAt: new Date().toISOString(),
      };
      writeFileSync(statusFilePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // Ignora erro de gravação de status para não interromper I/O
    }
  };

  const startedAt = new Date().toISOString();
  updateStatus("in_progress");

  for (const item of normalizedItems) {
    const src = resolve(sourceDir, item.source);
    const dest = resolve(destDir, item.target);
    try {
      copyFileSync(src, dest);
      completed.push(item.target);
    } catch (err: any) {
      failed.push({ file: item.target, error: err.message });
    }
    updateStatus(
      completed.length + failed.length === normalizedItems.length
        ? failed.length === 0
          ? "completed"
          : "partial_error"
        : "in_progress"
    );
  }
}

export async function waitForBackgroundCopy(caseDir: string): Promise<void> {
  const resolved = resolve(caseDir);
  const active = activeBackgroundCopies.get(resolved);
  if (active) {
    await active;
  }
}

export async function bootstrapCase(
  caseDir: string,
  uploadsDir?: string,
  options: BootstrapCaseOptions = {}
): Promise<BootstrapCaseResult> {
  const resolvedCaseDir = resolve(caseDir);
  const inputsDir = resolve(resolvedCaseDir, "inputs");
  const stateDir = resolve(resolvedCaseDir, "state");
  const templatesDir = resolve(resolvedCaseDir, "templates");
  const outputDir = resolve(resolvedCaseDir, "output");

  mkdirSync(inputsDir, { recursive: true });
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(templatesDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  const copiedFiles: string[] = [];
  const backgroundFiles: string[] = [];
  const ingestedFiles: IngestedFileSummary[] = [];
  const bgItems: BackgroundCopyFileItem[] = [];

  if (uploadsDir && existsSync(uploadsDir)) {
    const resolvedUploadsDir = resolve(uploadsDir);
    const entries = readdirSync(resolvedUploadsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith("~$")) {
        const srcPath = resolve(resolvedUploadsDir, entry.name);
        const buf = readFileSync(srcPath);

        const resolved = await resolveTargetFileName(
          entry.name,
          buf,
          options.fileRenameMap
        );

        let finalTarget = resolved.targetFileName;
        let counter = 1;
        const usedNames = new Set([
          ...copiedFiles,
          ...bgItems.map((b) => b.target),
        ]);
        while (usedNames.has(finalTarget)) {
          const ext = extname(finalTarget);
          const stem = ext ? finalTarget.slice(0, -ext.length) : finalTarget;
          finalTarget = `${stem}_${counter}${ext}`;
          counter++;
        }

        const isDocx =
          finalTarget.toLowerCase().endsWith(".docx") ||
          detectFileExtensionFromBuffer(buf) === ".docx";

        if (isDocx) {
          const destPath = resolve(inputsDir, finalTarget);
          copyFileSync(srcPath, destPath);
          copiedFiles.push(finalTarget);
          ingestedFiles.push({
            original_name: entry.name,
            saved_as: finalTarget,
            detected_type: resolved.detectedType,
          });
        } else {
          bgItems.push({
            source: entry.name,
            target: finalTarget,
          });
          backgroundFiles.push(finalTarget);
          ingestedFiles.push({
            original_name: entry.name,
            saved_as: finalTarget,
            detected_type: resolved.detectedType,
          });
        }
      }
    }

    // 2. Inicia cópia assíncrona não-bloqueante de PDFs e anexos pesados
    if (bgItems.length > 0) {
      if (options.detachedCli) {
        try {
          const binPath = resolveSelfBinaryPath();
          const child = spawn(
            binPath,
            [
              "--internal-bg-copy",
              "--source",
              resolvedUploadsDir,
              "--dest",
              inputsDir,
              "--state",
              stateDir,
              "--files",
              JSON.stringify(bgItems),
            ],
            {
              detached: true,
              stdio: "ignore",
              windowsHide: true,
            }
          );
          child.unref();
        } catch {
          // Fallback para execução in-process caso spawn falhe
          const bgPromise = executeBackgroundCopyTask(
            resolvedUploadsDir,
            inputsDir,
            stateDir,
            bgItems
          );
          activeBackgroundCopies.set(resolvedCaseDir, bgPromise);
          if (options.waitBackground) {
            await bgPromise;
          }
        }
      } else {
        const bgPromise = executeBackgroundCopyTask(
          resolvedUploadsDir,
          inputsDir,
          stateDir,
          bgItems
        );
        activeBackgroundCopies.set(resolvedCaseDir, bgPromise);
        if (options.waitBackground) {
          await bgPromise;
        }
      }
    }
  }

  // 3. Inspeciona todos os arquivos .docx encontrados em inputs/
  const inputEntries = readdirSync(inputsDir, { withFileTypes: true });
  const inspectedDocx: BootstrapCaseResult["inspectedDocx"] = [];
  for (const entry of inputEntries) {
    if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".docx") &&
      !entry.name.startsWith("~$")
    ) {
      const docxPath = resolve(inputsDir, entry.name);
      const base = entry.name.replace(/\.docx$/i, "");
      const structurePath = resolve(stateDir, `estrutura_${base}.json`);
      const full = await inspectDocx(docxPath, structurePath);
      const compact = compactInspectionResult(full);
      inspectedDocx.push({
        fileName: entry.name,
        docxPath,
        structurePath,
        tablesCount: compact.tables.length,
        paragraphsCount: compact.paragraphs.length,
        compactStructure: compact,
        ...(compact.template_match ? { template_match: compact.template_match } : {}),
        ...(compact.audit_view_path ? { audit_view_path: compact.audit_view_path } : {}),
      });

      const relStructure = relative(resolvedCaseDir, structurePath).replace(
        /\\/g,
        "/"
      );
      const match = ingestedFiles.find((f) => f.saved_as === entry.name);
      if (match) {
        match.structure_json = relStructure;
      }
    }
  }

  const bgCopyInfo: BackgroundCopyInfo = {
    status: backgroundFiles.length > 0 ? "started" : "idle",
    totalFiles: backgroundFiles.length,
    files: backgroundFiles,
    message:
      backgroundFiles.length > 0
        ? `Salvaguarda de ${backgroundFiles.length} arquivo(s) volumoso(s) (.pdf e anexos) iniciada em segundo plano para inputs/. Acompanhe em state/salvaguarda_status.json.`
        : "Nenhum arquivo pesado pendente de cópia em segundo plano.",
  };

  return {
    status: "success",
    caseDir: resolvedCaseDir,
    copiedFiles,
    backgroundFiles,
    backgroundCopy: bgCopyInfo,
    inspectedDocx,
    ingestedFiles,
  };
}

export function formatBootstrapCaseSyntheticResult(
  res: BootstrapCaseResult,
  userCaseDir?: string
): BootstrapCaseSyntheticResult {
  const hasIngested = !!(res.ingestedFiles && res.ingestedFiles.length > 0);
  const docxLimit = res.ingestedFiles && res.ingestedFiles.length > 2 ? 0 : 1;

  return {
    status: "success",
    engine_version: VERSION,
    caseDir: userCaseDir ? userCaseDir.replace(/\\/g, "/") : res.caseDir,
    ...(hasIngested
      ? {
          ingested_files: res.ingestedFiles!.slice(0, 4).map((item) => ({
            original: item.original_name,
            saved_as: item.saved_as,
            type: item.detected_type,
            ...(item.structure_json ? { structure: item.structure_json } : {}),
          })),
        }
      : {}),
    docx_inspected: res.inspectedDocx.slice(0, docxLimit).map((item) => {
      const relPath = relative(res.caseDir, item.structurePath).replace(
        /\\/g,
        "/"
      );
      return {
        filename: item.fileName,
        structure_json: relPath,
        tables_count: item.tablesCount,
        paragraphs_count: item.paragraphsCount,
        ...(item.template_match && item.template_match.status !== "NEW"
          ? {
              template_match: {
                status: item.template_match.status,
                ...(item.template_match.template_id
                  ? { template_id: item.template_match.template_id }
                  : {}),
              },
            }
          : {}),
      };
    }),
    background_copy: {
      status:
        res.backgroundCopy.status === "started"
          ? "active"
          : res.backgroundCopy.status,
      message:
        res.backgroundFiles.length > 0
          ? "Salvaguarda ativa em segundo plano."
          : "Nenhum arquivo pesado pendente de cópia em segundo plano.",
    },
    next_step_hint:
      "Estrutura criada. Elabore o slots_manifest.json para 'build_docx_template'.",
  };
}

