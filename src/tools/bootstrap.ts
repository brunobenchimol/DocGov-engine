import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  unlinkSync,
  renameSync,
  statSync,
} from "node:fs";
import { resolve, relative, extname, basename } from "node:path";
import { spawn } from "node:child_process";
import {
  detectFileExtensionFromBuffer,
  resolveTargetFileName,
} from "../utils/naming.ts";
import { isPdfBuffer } from "../utils/pdf.ts";
import { inspectDocx, compactInspectionResult } from "./inspect.ts";
import { resolveSelfBinaryPath } from "../core/updater.ts";
import { ALL_IMPUGNATION_ZONE_IDS } from "../core/cartography.ts";
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

  // 2b. Organização e movimentação limpa da raiz de cases/<slug>/ para inputs/ (Zero Duplicação v1.1.1)
  const SYSTEM_ROOT_FILES = new Set([
    "context.json",
    "metadata.json",
    "readme.md",
    ".gitignore",
    ".env",
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
    if (SYSTEM_ROOT_FILES.has(lowerName)) continue;

    const rootFilePath = resolve(resolvedCaseDir, entry.name);
    let buf: Buffer;
    try {
      buf = readFileSync(rootFilePath);
    } catch {
      continue;
    }

    const currentExt = extname(entry.name).toLowerCase();
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

  // 3. Inspeciona todos os arquivos .docx e .pdf encontrados em inputs/
  const inputEntries = readdirSync(inputsDir, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name)
  );
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
          ...(full.dossie_hotspots_path
            ? { dossie_hotspots_path: full.dossie_hotspots_path }
            : {}),
          ...(full.scanned_pages_detected &&
          full.scanned_pages_detected.length > 0
            ? { scanned_pages_detected: full.scanned_pages_detected }
            : {}),
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

  // 4. Consolidação do Índice Cartográfico Unificado do Caso (state/indice_mestre_caso.md v0.9.0)
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

    masterIndexEntries.push({
      fileName: docx.fileName,
      type: "docx",
      volumeSummary: `${docx.paragraphsCount} parágrafo(s), ${docx.tablesCount} tabela(s)`,
      structureRelPath: relStructure,
      auditViewRelPath: relAudit,
      activeZonesCount: activeCount,
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
      volumeSummary: `${pdf.pageCount} página(s), ${pdf.lineCount} linha(s)`,
      structureRelPath: relStructure,
      auditViewRelPath: relAudit,
      dossieRelPath: relDossie,
      activeZonesCount: pdf.activeZonesCount,
      scannedPages: pdf.scanned_pages_detected,
      impugnationZones,
      pageSignals,
    });
  }

  let masterIndexPath: string | undefined;
  if (masterIndexEntries.length > 0) {
    masterIndexPath = resolve(stateDir, "indice_mestre_caso.md");
    const masterMd = generateCaseMasterIndexMarkdown(
      resolvedCaseDir,
      masterIndexEntries
    );
    writeFileSync(masterIndexPath, masterMd, "utf-8");
  }

  return {
    status: "success",
    caseDir: resolvedCaseDir,
    copiedFiles,
    backgroundFiles,
    backgroundCopy: bgCopyInfo,
    inspectedDocx,
    inspectedPdf,
    ingestedFiles,
    ...(masterIndexPath ? { indice_mestre_path: masterIndexPath } : {}),
  };
}

export interface MasterIndexEntry {
  fileName: string;
  type: "docx" | "pdf";
  volumeSummary: string;
  structureRelPath: string;
  auditViewRelPath?: string;
  dossieRelPath?: string;
  activeZonesCount: number;
  scannedPages?: number[];
  impugnationZones: Record<
    string,
    Array<{ coord: string; keyword: string; snippet: string; section?: string }>
  >;
  pageSignals: Array<{
    page?: number;
    coord_range: string;
    signal_type: string;
    matched_terms: string[];
  }>;
}

export function generateCaseMasterIndexMarkdown(
  caseDir: string,
  entries: MasterIndexEntry[]
): string {
  const caseName = basename(caseDir);
  const lines: string[] = [];

  lines.push(`# 🗺️ Índice Mestre Cartográfico do Processo: ${caseName}`);
  lines.push(
    `> Documento consolidado gerado por docgov-engine v${VERSION} (${entries.length} arquivo(s) analisado(s)).`
  );
  lines.push(
    `> Consolidação do inventário probatório e mapa cruzado das 14 Zonas de Impugnação (Z1 a Z14) entre todos os documentos de inputs/.`
  );
  lines.push("");

  // 1. Inventário Geral do Caso
  lines.push("## 1. Inventário de Documentos do Processo");
  lines.push("");
  lines.push(
    "| Arquivo | Tipo | Volume | Estrutura JSON | Visão de Auditoria | Dossiê de Hotspots | Zonas Ativas |"
  );
  lines.push(
    "| :--- | :---: | :--- | :--- | :--- | :--- | :---: |"
  );

  for (const entry of entries) {
    const scannedBadge =
      entry.scannedPages && entry.scannedPages.length > 0
        ? ` <br>⚠️ **Escaneado (Pág ${entry.scannedPages.join(", ")})**`
        : "";
    const structLink = `\`${entry.structureRelPath}\``;
    const auditLink = entry.auditViewRelPath
      ? `\`${entry.auditViewRelPath}\``
      : "-";
    const dossieLink = entry.dossieRelPath
      ? `\`${entry.dossieRelPath}\``
      : "-";

    lines.push(
      `| **${entry.fileName}**${scannedBadge} | \`.${entry.type}\` | ${entry.volumeSummary} | ${structLink} | ${auditLink} | ${dossieLink} | **${entry.activeZonesCount} / 14** |`
    );
  }
  lines.push("");

  // 2. Matriz Cruzada das 14 Zonas de Impugnação (Z1..Z14)
  lines.push("## 2. Matriz Cruzada das 14 Zonas de Impugnação (Z1 a Z14)");
  lines.push("");

  for (const zoneId of ALL_IMPUGNATION_ZONE_IDS) {
    const docsWithZone = entries.filter(
      (e) => e.impugnationZones[zoneId] && e.impugnationZones[zoneId].length > 0
    );

    if (docsWithZone.length === 0) {
      lines.push(`### ${zoneId}`);
      lines.push(
        "- *(0 ocorrências identificadas no conjunto de documentos do processo)*"
      );
      lines.push("");
    } else {
      const totalHits = docsWithZone.reduce(
        (acc, d) => acc + d.impugnationZones[zoneId].length,
        0
      );
      lines.push(
        `### ${zoneId} (${totalHits} ocorrência(s) em ${docsWithZone.length} documento(s))`
      );

      for (const d of docsWithZone) {
        const hits = d.impugnationZones[zoneId];
        lines.push(`- **${d.fileName}** (${hits.length} ocorrência(s)):`);
        for (const hit of hits) {
          const sec = hit.section ? ` [${hit.section}]` : "";
          lines.push(
            `  - \`${hit.coord}\` [${hit.keyword}]${sec}: "${hit.snippet}"`
          );
        }
      }
      lines.push("");
    }
  }

  // 3. Alertas Globais e Sinais de Alta Densidade
  lines.push(
    "## 3. Alertas Globais e Sinais de Alta Densidade Técnica/Orçamentária"
  );
  lines.push("");

  // 3.1 Páginas Escaneadas
  const docsWithScanned = entries.filter(
    (e) => e.scannedPages && e.scannedPages.length > 0
  );
  lines.push("### 3.1. Alerta de Páginas Escaneadas (Scanned PDF Trap)");
  if (docsWithScanned.length === 0) {
    lines.push(
      "- *(Nenhuma página escaneada detectada no processo — 100% dos documentos possuem camada de texto pesquisável)*"
    );
  } else {
    for (const d of docsWithScanned) {
      lines.push(
        `- ⚠️ **${d.fileName}**: Página(s) **${d.scannedPages!.join(
          ", "
        )}** escaneada(s) como imagem sem camada de texto.`
      );
    }
  }
  lines.push("");

  // 3.2 Sinais de Alta Densidade
  const docsWithSignals = entries.filter((e) => e.pageSignals.length > 0);
  lines.push(
    "### 3.2. Sinais de Alta Densidade (Planilhas de Itens / Especificações Técnicas)"
  );
  if (docsWithSignals.length === 0) {
    lines.push(
      "- *(Sem sinais de alta densidade orçamentária ou técnica identificados)*"
    );
  } else {
    for (const d of docsWithSignals) {
      lines.push(`- **${d.fileName}**:`);
      for (const sig of d.pageSignals) {
        const pageLabel =
          sig.page !== undefined
            ? `PAG_${String(sig.page).padStart(3, "0")} (${sig.coord_range})`
            : sig.coord_range;
        lines.push(
          `  - **${pageLabel}** [${sig.signal_type}] — Termos: ${sig.matched_terms.join(
            ", "
          )}`
        );
      }
    }
  }
  lines.push("");

  return lines.join("\n").trim() + "\n";
}

export function formatBootstrapCaseSyntheticResult(
  res: BootstrapCaseResult,
  userCaseDir?: string
): BootstrapCaseSyntheticResult {
  const hasIngested = !!(res.ingestedFiles && res.ingestedFiles.length > 0);
  const docxLimit = res.ingestedFiles && res.ingestedFiles.length > 2 ? 0 : 1;
  const hasPdfInspected = !!(res.inspectedPdf && res.inspectedPdf.length > 0);
  const pdfLimit = hasIngested ? 0 : 1;
  const relMasterIndex = res.indice_mestre_path
    ? relative(res.caseDir, res.indice_mestre_path).replace(/\\/g, "/")
    : undefined;

  const buildResult = (
    ingestedCount: number,
    includeStructureOnAllIngested: boolean,
    docxSlice: number,
    pdfSlice: number
  ): BootstrapCaseSyntheticResult => ({
    status: "success",
    engine_version: VERSION,
    caseDir: userCaseDir ? userCaseDir.replace(/\\/g, "/") : res.caseDir,
    ...(relMasterIndex ? { master_index_path: relMasterIndex } : {}),
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
          ? "Salvaguarda ativa em 2º plano."
          : "Sem pendências.",
    },
    next_step_hint:
      "Estrutura pronta. Elabore slots_manifest.json e chame build_docx_template.",
  });

  let result = buildResult(4, true, docxLimit, pdfLimit);
  if (Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 920) {
    result = buildResult(4, false, 0, 0);
  }
  if (Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 990) {
    result = buildResult(2, false, 0, 0);
  }
  if (Buffer.byteLength(JSON.stringify(result, null, 2), "utf-8") >= 1015) {
    result = buildResult(1, false, 0, 0);
  }

  return result;
}

