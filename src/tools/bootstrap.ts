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
import { isPdfBuffer } from "../utils/pdf.ts";
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
  BootstrapCaseInspectedPdf,
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

    // 2. Inicia cópia de PDFs e anexos (garantindo disponibilidade para inspeção de %PDF-)
    if (bgItems.length > 0) {
      // Garante que qualquer PDF válido (%PDF-) esteja disponível em inputs/ para inspeção imediata
      for (const item of bgItems) {
        const src = resolve(resolvedUploadsDir, item.source);
        const dest = resolve(inputsDir, item.target);
        try {
          if (existsSync(src) && !existsSync(dest)) {
            const buf = readFileSync(src);
            if (isPdfBuffer(buf)) {
              copyFileSync(src, dest);
            }
          }
        } catch {
          // Segue fluxo normal da salvaguarda
        }
      }

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

  // 3. Inspeciona todos os arquivos .docx e .pdf encontrados em inputs/
  const inputEntries = readdirSync(inputsDir, { withFileTypes: true });
  const inspectedDocx: BootstrapCaseResult["inspectedDocx"] = [];
  const inspectedPdf: BootstrapCaseInspectedPdf[] = [];

  for (const entry of inputEntries) {
    if (!entry.isFile() || entry.name.startsWith("~$")) continue;

    if (entry.name.toLowerCase().endsWith(".docx")) {
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
    } else if (entry.name.toLowerCase().endsWith(".pdf")) {
      const pdfPath = resolve(inputsDir, entry.name);
      const buf = readFileSync(pdfPath);
      if (isPdfBuffer(buf)) {
        const base = entry.name.replace(/\.pdf$/i, "");
        const structurePath = resolve(stateDir, `estrutura_${base}.json`);
        const full = await inspectDocx(pdfPath, structurePath, true);
        const activeZonesCount = Object.values(
          full.impugnation_zones || {}
        ).filter((arr) => Array.isArray(arr) && arr.length > 0).length;

        inspectedPdf.push({
          fileName: entry.name,
          pdfPath,
          structurePath,
          ...(full.audit_view_path ? { audit_view_path: full.audit_view_path } : {}),
          pageCount: full.page_count ?? 0,
          lineCount: full.line_count ?? 0,
          outlineHeadingsCount: full.outline_headings?.length ?? 0,
          activeZonesCount,
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
    inspectedPdf,
    ingestedFiles,
  };
}

export function formatBootstrapCaseSyntheticResult(
  res: BootstrapCaseResult,
  userCaseDir?: string
): BootstrapCaseSyntheticResult {
  const hasIngested = !!(res.ingestedFiles && res.ingestedFiles.length > 0);
  const docxLimit = res.ingestedFiles && res.ingestedFiles.length > 2 ? 0 : 1;
  const hasPdfInspected = !!(res.inspectedPdf && res.inspectedPdf.length > 0);
  const pdfLimit = hasIngested ? 0 : 1;

  const buildResult = (
    ingestedCount: number,
    includeStructureOnAllIngested: boolean,
    docxSlice: number,
    pdfSlice: number
  ): BootstrapCaseSyntheticResult => ({
    status: "success",
    engine_version: VERSION,
    caseDir: userCaseDir ? userCaseDir.replace(/\\/g, "/") : res.caseDir,
    ...(hasIngested && ingestedCount > 0
      ? {
          ingested_files: res.ingestedFiles!
            .slice(0, ingestedCount)
            .map((item, idx) => ({
              original: item.original_name,
              saved_as: item.saved_as,
              type: item.detected_type,
              ...(item.structure_json &&
              (includeStructureOnAllIngested || idx < 2)
                ? { structure: item.structure_json }
                : {}),
            })),
        }
      : {}),
    docx_inspected: res.inspectedDocx.slice(0, docxSlice).map((item) => {
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
    ...(hasPdfInspected && pdfSlice > 0
      ? {
          pdf_inspected: res.inspectedPdf!.slice(0, pdfSlice).map((item) => ({
            filename: item.fileName,
            structure_json: relative(res.caseDir, item.structurePath).replace(
              /\\/g,
              "/"
            ),
            page_count: item.pageCount,
            line_count: item.lineCount,
          })),
        }
      : {}),
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
  });

  let result = buildResult(4, true, docxLimit, pdfLimit);
  if (Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 1000) {
    result = buildResult(4, false, 0, 0);
  }
  if (Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 1000) {
    result = buildResult(2, false, 0, 0);
  }

  return result;
}

