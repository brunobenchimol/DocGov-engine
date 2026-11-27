import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
} from "node:fs";
import { resolve, relative, extname, join } from "node:path";
import { spawn } from "node:child_process";
import {
  detectFileExtensionFromBuffer,
  resolveTargetFileName,
} from "../utils/naming.ts";
import { isPdfBuffer } from "../utils/pdf.ts";
import { detectFileType } from "../utils/archives.ts";
import { resolveSelfBinaryPath } from "../core/updater.ts";
import { assertDocGovCaseScope } from "../utils/paths.ts";
import { writeFileSafeSync } from "../utils/fs_safe_io.ts";
import type {
  BackgroundCopyFileItem,
  BackgroundCopyInfo,
  IngestedFileSummary,
  BootstrapCaseOptions,
  BootstrapCaseResult,
  UnpackedArchiveSummary,
} from "../types/index.ts";
import {
  activeBackgroundCopies,
  unpackAndIngestArchive,
  executeBackgroundCopyTask,
  organizeRootFilesAndUnpackInputs,
} from "./bootstrap/archive_and_bg_copy.ts";
import { inspectCaseInputsDirectory } from "./bootstrap/file_ingestion_worker.ts";
import {
  type MasterIndexEntry,
  generateCaseMasterIndexMarkdown,
} from "./bootstrap/master_index_renderer.ts";

export {
  activeBackgroundCopies,
  executeBackgroundCopyTask,
  waitForBackgroundCopy,
} from "./bootstrap/archive_and_bg_copy.ts";
export {
  type MasterIndexEntry,
  generateCaseMasterIndexMarkdown,
  formatBootstrapCaseSyntheticResult,
  buildBootstrapCaseHybridEnvelope,
} from "./bootstrap/master_index_renderer.ts";
export async function bootstrapCase(
  caseDir: string,
  uploadsDir?: string,
  options: BootstrapCaseOptions = {}
): Promise<BootstrapCaseResult> {
  const resolvedCaseDir = resolve(caseDir);
  assertDocGovCaseScope(resolvedCaseDir, "bootstrap_case");

  const isGitRepoRoot = existsSync(join(resolvedCaseDir, ".git"));
  const hasSourceCodeMarkers =
    existsSync(join(resolvedCaseDir, "core", "skills")) ||
    (existsSync(join(resolvedCaseDir, "src", "index.ts")) &&
      existsSync(join(resolvedCaseDir, "package.json")));

  if (isGitRepoRoot || hasSourceCodeMarkers) {
    throw new Error(
      `Tentativa de inicializar caso na raiz de repositório de desenvolvimento abortada por segurança: '${resolvedCaseDir}' contém marcadores de código-fonte/repositório Git (.git, core/skills). O 'caseDir' deve apontar para uma pasta de caso específica (ex.: 'cases/<nome_do_caso>').`
    );
  }
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
  const unpackedArchives: UnpackedArchiveSummary[] = [];
  const bgItems: BackgroundCopyFileItem[] = [];

  const NON_ARCHIVE_EXTENSIONS = new Set([
    ".docx",
    ".pdf",
    ".xlsx",
    ".xls",
    ".csv",
    ".txt",
    ".odt",
    ".rtf",
    ".doc",
    ".md",
  ]);

  const resolvedUploadsDir =
    uploadsDir && existsSync(uploadsDir) ? resolve(uploadsDir) : null;
  const uploadsIsSameAsCase = resolvedUploadsDir === resolvedCaseDir;

  if (resolvedUploadsDir && !uploadsIsSameAsCase) {
    const entries = readdirSync(resolvedUploadsDir, {
      withFileTypes: true,
    }).sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith("~$")) {
        const srcPath = resolve(resolvedUploadsDir, entry.name);
        const buf = readFileSync(srcPath);

        const isCandidateArchive = !NON_ARCHIVE_EXTENSIONS.has(
          extname(entry.name).toLowerCase()
        );
        if (isCandidateArchive) {
          const fileType = await detectFileType(buf, entry.name);
          if (fileType.type === "unsupported_archive") {
            throw new Error(
              `Formato compactado proprietário (.7z/.rar) detectado em '${entry.name}'. Este formato não é suportado nativamente. Utilize arquivos padrão .zip, .tar ou .tar.gz para extração automática.`
            );
          }
          if (fileType.isArchive) {
            await unpackAndIngestArchive(
              entry.name,
              buf,
              fileType.type as "zip" | "tar" | "tar.gz",
              inputsDir,
              options,
              copiedFiles,
              backgroundFiles,
              ingestedFiles,
              unpackedArchives
            );
            continue;
          }
        }

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

  await organizeRootFilesAndUnpackInputs({
    resolvedCaseDir,
    inputsDir,
    options,
    NON_ARCHIVE_EXTENSIONS,
    copiedFiles,
    backgroundFiles,
    ingestedFiles,
    unpackedArchives,
  });

  const { inspectedDocx, inspectedPdf, failedInspections, otherFiles } =
    await inspectCaseInputsDirectory({
      resolvedCaseDir,
      inputsDir,
      stateDir,
      backgroundFiles,
      ingestedFiles,
    });

  const bgCopyInfo: BackgroundCopyInfo = {
    status: backgroundFiles.length > 0 ? "started" : "idle",
    totalFiles: backgroundFiles.length,
    files: backgroundFiles,
    message:
      backgroundFiles.length > 0
        ? `Salvaguarda de ${backgroundFiles.length} arquivo(s) volumoso(s) (.pdf e anexos) iniciada em segundo plano para inputs/. Acompanhe em state/salvaguarda_status.json.`
        : "Nenhum arquivo pesado pendente de cópia em segundo plano.",
  };

  // 4. Consolidação do Índice Cartográfico Unificado do Caso (state/indice_mestre_caso.md v0.9.0 / v1.1.1)
  const masterIndexEntries: MasterIndexEntry[] = [];

  for (const docx of inspectedDocx) {
    const relStructure = relative(resolvedCaseDir, docx.structurePath).replace(
      /\\/g,
      "/"
    );
    const relAudit = docx.audit_view_path
      ? relative(resolvedCaseDir, docx.audit_view_path).replace(/\\/g, "/")
      : undefined;
    const activeCount = Object.values(
      docx.compactStructure.impugnation_zones || {}
    ).filter((arr) => Array.isArray(arr) && arr.length > 0).length;

    const isSpreadsheet =
      docx.fileName.toLowerCase().endsWith(".xlsx") ||
      docx.fileName.toLowerCase().endsWith(".xls") ||
      docx.fileName.toLowerCase().endsWith(".csv");
    const docType = isSpreadsheet
      ? (docx.fileName.toLowerCase().endsWith(".csv") ? "csv" : "xlsx")
      : "docx";
    const volumeSummary = isSpreadsheet
      ? `${docx.tablesCount} aba(s)/tabela(s), ${docx.paragraphsCount} linha(s) de dados`
      : `${docx.paragraphsCount} parágrafo(s), ${docx.tablesCount} tabela(s)`;

    masterIndexEntries.push({
      fileName: docx.fileName,
      type: docType,
      status: "inspected",
      volumeSummary,
      structureRelPath: relStructure,
      auditViewRelPath: relAudit,
      activeZonesCount: activeCount,
      forensicMeta: docx.forensic_meta ?? docx.compactStructure.forensic_meta,
      impugnationZones: docx.compactStructure.impugnation_zones || {},
      pageSignals: docx.compactStructure.page_signals || [],
    });
  }

  for (const pdf of inspectedPdf) {
    const relStructure = relative(resolvedCaseDir, pdf.structurePath).replace(
      /\\/g,
      "/"
    );
    const relAudit = pdf.audit_view_path
      ? relative(resolvedCaseDir, pdf.audit_view_path).replace(/\\/g, "/")
      : undefined;
    const relDossie = pdf.dossie_hotspots_path
      ? relative(resolvedCaseDir, pdf.dossie_hotspots_path).replace(/\\/g, "/")
      : undefined;

    let impugnationZones: any = {};
    let pageSignals: any = [];
    try {
      if (existsSync(pdf.structurePath)) {
        const parsed = JSON.parse(readFileSync(pdf.structurePath, "utf-8"));
        impugnationZones = parsed.impugnation_zones || {};
        pageSignals = parsed.page_signals || [];
      }
    } catch {
      // Ignora erro de leitura caso estrutura não esteja no disco
    }

    masterIndexEntries.push({
      fileName: pdf.fileName,
      type: "pdf",
      status: "inspected",
      volumeSummary: `${pdf.pageCount} página(s), ${pdf.lineCount} linha(s)`,
      structureRelPath: relStructure,
      auditViewRelPath: relAudit,
      dossieRelPath: relDossie,
      activeZonesCount: pdf.activeZonesCount,
      scannedPages: pdf.scanned_pages_detected,
      hybridScanPages: pdf.hybrid_scan_pages,
      assetsExtractedCount: pdf.assets_extracted_count,
      forensicMeta: pdf.forensic_meta,
      impugnationZones,
      pageSignals,
    });
  }

  // Documentos que falharam na inspeção isolada (Resiliência Forense v1.1.1)
  for (const failed of failedInspections) {
    masterIndexEntries.push({
      fileName: failed.fileName,
      type: failed.type,
      status: "error",
      errorMessage: failed.error,
      volumeSummary: "Falha na extração estrutural",
      activeZonesCount: 0,
      impugnationZones: {},
      pageSignals: [],
    });
  }

  // Anexos probatórios e planilhas de outros formatos (Inventário Completo v1.1.1)
  for (const other of otherFiles) {
    const sizeKb = (other.size / 1024).toFixed(1);
    masterIndexEntries.push({
      fileName: other.fileName,
      type: other.extension,
      status: "attachment",
      volumeSummary: `${sizeKb} KB (Anexo/Planilha)`,
      activeZonesCount: 0,
      impugnationZones: {},
      pageSignals: [],
    });
  }

  let masterIndexPath: string | undefined;
  let masterIndexMarkdown: string | undefined;
  if (masterIndexEntries.length > 0 || unpackedArchives.length > 0) {
    masterIndexPath = resolve(stateDir, "indice_mestre_caso.md");
    masterIndexMarkdown = generateCaseMasterIndexMarkdown(
      resolvedCaseDir,
      masterIndexEntries,
      unpackedArchives
    );
    writeFileSafeSync(masterIndexPath, masterIndexMarkdown);
  }

  const bootstrapRes: BootstrapCaseResult = {
    status: "success",
    caseDir: resolvedCaseDir,
    copiedFiles,
    backgroundFiles,
    backgroundCopy: bgCopyInfo,
    inspectedDocx,
    inspectedPdf,
    ingestedFiles,
    ...(unpackedArchives.length > 0 ? { unpacked_archives: unpackedArchives } : {}),
    ...(failedInspections.length > 0 ? { failed_inspections: failedInspections } : {}),
    ...(otherFiles.length > 0 ? { other_files: otherFiles } : {}),
    ...(masterIndexPath ? { indice_mestre_path: masterIndexPath } : {}),
  };
  if (masterIndexMarkdown !== undefined) {
    Object.defineProperty(bootstrapRes, "indice_mestre_markdown", {
      value: masterIndexMarkdown,
      enumerable: false,
      configurable: true,
    });
  }
  return bootstrapRes;
}
