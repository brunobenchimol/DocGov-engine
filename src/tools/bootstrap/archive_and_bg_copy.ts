import {
  readFileSync,
  existsSync,
  copyFileSync,
  readdirSync,
  unlinkSync,
  renameSync,
  statSync,
} from "node:fs";
import { resolve, extname } from "node:path";
import { writeFileSafeSync } from "../../utils/fs_safe_io.ts";
import {
  detectFileExtensionFromBuffer,
  resolveTargetFileName,
} from "../../utils/naming.ts";
import { isPdfBuffer } from "../../utils/pdf.ts";
import {
  detectFileType,
  extractArchiveBuffer,
} from "../../utils/archives.ts";
import type {
  BackgroundCopyFileItem,
  BackgroundCopyInput,
  SalvaguardaStatus,
  IngestedFileSummary,
  BootstrapCaseOptions,
  UnpackedArchiveSummary,
} from "../../types/index.ts";

export const activeBackgroundCopies = new Map<string, Promise<void>>();

export async function unpackAndIngestArchive(
  archiveName: string,
  buf: Buffer,
  archiveType: "zip" | "tar" | "tar.gz",
  inputsDir: string,
  options: BootstrapCaseOptions,
  copiedFiles: string[],
  backgroundFiles: string[],
  ingestedFiles: IngestedFileSummary[],
  unpackedArchives: UnpackedArchiveSummary[]
): Promise<void> {
  const extracted = await extractArchiveBuffer(buf, archiveName);
  const unpackedSummary: UnpackedArchiveSummary = {
    archiveName,
    archiveType,
    extractedCount: extracted.length,
    files: [],
  };

  for (const item of extracted) {
    const resolved = await resolveTargetFileName(
      item.fileName,
      item.data,
      options.fileRenameMap
    );
    let finalTarget = resolved.targetFileName;
    let counter = 1;
    const usedNames = new Set([
      ...copiedFiles,
      ...backgroundFiles,
      ...ingestedFiles.map((f) => f.saved_as),
    ]);
    while (usedNames.has(finalTarget)) {
      const ext = extname(finalTarget);
      const stem = ext ? finalTarget.slice(0, -ext.length) : finalTarget;
      finalTarget = `${stem}_${counter}${ext}`;
      counter++;
    }

    const destPath = resolve(inputsDir, finalTarget);
    writeFileSafeSync(destPath, item.data);

    const isDocx =
      finalTarget.toLowerCase().endsWith(".docx") ||
      detectFileExtensionFromBuffer(item.data) === ".docx";

    if (isDocx) {
      if (!copiedFiles.includes(finalTarget)) {
        copiedFiles.push(finalTarget);
      }
    } else {
      if (!backgroundFiles.includes(finalTarget)) {
        backgroundFiles.push(finalTarget);
      }
    }

    if (!ingestedFiles.some((f) => f.saved_as === finalTarget)) {
      ingestedFiles.push({
        original_name: item.fileName,
        saved_as: finalTarget,
        detected_type: resolved.detectedType,
      });
    }

    unpackedSummary.files.push({
      originalEntryName: item.fileName,
      savedAs: finalTarget,
      size: item.data.length,
    });
  }

  unpackedArchives.push(unpackedSummary);
}

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
      writeFileSafeSync(statusFilePath, JSON.stringify(data, null, 2));
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

export interface OrganizeRootAndInputsParams {
  resolvedCaseDir: string;
  inputsDir: string;
  options: BootstrapCaseOptions;
  NON_ARCHIVE_EXTENSIONS: Set<string>;
  copiedFiles: string[];
  backgroundFiles: string[];
  ingestedFiles: IngestedFileSummary[];
  unpackedArchives: UnpackedArchiveSummary[];
}

export async function organizeRootFilesAndUnpackInputs(
  params: OrganizeRootAndInputsParams
): Promise<void> {
  const {
    resolvedCaseDir,
    inputsDir,
    options,
    NON_ARCHIVE_EXTENSIONS,
    copiedFiles,
    backgroundFiles,
    ingestedFiles,
    unpackedArchives,
  } = params;
  // 2b. Organização e movimentação limpa da raiz de cases/<slug>/ para inputs/ (Zero Duplicação v1.1.1)
  const PROTECTED_ROOT_FILES = new Set([
    "agents.md",
    "readme.md",
    "architecture.md",
    "changelog.md",
    "roadmap.md",
    "license",
    "license.md",
    "license.txt",
    "contributing.md",
    "package.json",
    "tsconfig.json",
    "bun.lock",
    "bun.lockb",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "skill_spec.md",
    ".gitignore",
    ".gitattributes",
    ".env",
    ".env.local",
    "context.json",
    "metadata.json",
    "estado_caso.json",
    "slots_manifest.json",
    "relatorio_auditoria.json",
  ]);

  const CODE_OR_SCRIPT_EXTENSIONS = new Set([
    ".ts",
    ".js",
    ".mjs",
    ".cjs",
    ".sh",
    ".ps1",
    ".bat",
    ".cmd",
    ".py",
    ".cs",
    ".csproj",
    ".sln",
  ]);

  const DOCUMENT_EXTENSIONS = new Set([
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

  const rootEntries = readdirSync(resolvedCaseDir, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name)
  );

  for (const entry of rootEntries) {
    if (!entry.isFile() || entry.name.startsWith("~$")) continue;
    const lowerName = entry.name.toLowerCase();
    if (PROTECTED_ROOT_FILES.has(lowerName)) continue;

    const currentExt = extname(entry.name).toLowerCase();
    if (CODE_OR_SCRIPT_EXTENSIONS.has(currentExt)) continue;

    const rootFilePath = resolve(resolvedCaseDir, entry.name);
    let buf: Buffer;
    try {
      buf = readFileSync(rootFilePath);
    } catch {
      continue;
    }

    const isCandidateArchive = !NON_ARCHIVE_EXTENSIONS.has(currentExt);
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
        try {
          unlinkSync(rootFilePath);
        } catch {}
        continue;
      }
    }

    const detectedExt = detectFileExtensionFromBuffer(buf);
    const isDoc =
      DOCUMENT_EXTENSIONS.has(currentExt) ||
      DOCUMENT_EXTENSIONS.has(detectedExt) ||
      isPdfBuffer(buf);

    if (!isDoc) continue;

    const resolved = await resolveTargetFileName(
      entry.name,
      buf,
      options.fileRenameMap
    );

    let finalTarget = resolved.targetFileName;
    let counter = 1;
    const usedNames = new Set([
      ...copiedFiles,
      ...backgroundFiles,
      ...ingestedFiles.map((f) => f.saved_as),
    ]);
    while (usedNames.has(finalTarget)) {
      const ext = extname(finalTarget);
      const stem = ext ? finalTarget.slice(0, -ext.length) : finalTarget;
      finalTarget = `${stem}_${counter}${ext}`;
      counter++;
    }

    const destPath = resolve(inputsDir, finalTarget);

    if (existsSync(destPath)) {
      // Se o arquivo já existe em inputs/, verifica se tem o mesmo tamanho para remover a cópia redundante da raiz
      try {
        const rootSize = statSync(rootFilePath).size;
        const destSize = statSync(destPath).size;
        if (rootSize === destSize) {
          unlinkSync(rootFilePath);
        }
      } catch {
        // Ignora falha de exclusão
      }
    } else {
      // Move o arquivo da raiz para inputs/
      try {
        renameSync(rootFilePath, destPath);
      } catch {
        copyFileSync(rootFilePath, destPath);
        try {
          unlinkSync(rootFilePath);
        } catch {}
      }
    }

    if (!copiedFiles.includes(finalTarget)) {
      copiedFiles.push(finalTarget);
    }
    if (!ingestedFiles.some((f) => f.saved_as === finalTarget)) {
      ingestedFiles.push({
        original_name: entry.name,
        saved_as: finalTarget,
        detected_type: resolved.detectedType,
      });
    }
  }

  // 2c. Descompactação automática de pacotes compactados presentes diretamente em inputs/ (v1.3.3)
  const initialInputs = readdirSync(inputsDir, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name)
  );
  for (const entry of initialInputs) {
    if (!entry.isFile() || entry.name.startsWith("~$")) continue;
    if (NON_ARCHIVE_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
    const inputFilePath = resolve(inputsDir, entry.name);
    let buf: Buffer;
    try {
      buf = readFileSync(inputFilePath);
    } catch {
      continue;
    }
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
      try {
        unlinkSync(inputFilePath);
      } catch {}
    }
  }

}
