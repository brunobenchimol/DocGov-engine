import { readFileSync, existsSync, readdirSync, renameSync, statSync } from "node:fs";
import { resolve, relative, extname } from "node:path";
import JSZip from "jszip";
import { isPdfBuffer } from "../../utils/pdf.ts";
import { inspectDocx, compactInspectionResult } from "../inspect.ts";
import type {
  IngestedFileSummary,
  BootstrapCaseResult,
  BootstrapCaseInspectedPdf,
} from "../../types/index.ts";

export interface InspectCaseInputsParams {
  resolvedCaseDir: string;
  inputsDir: string;
  stateDir: string;
  backgroundFiles: string[];
  ingestedFiles: IngestedFileSummary[];
}

export interface InspectCaseInputsOutput {
  inspectedDocx: BootstrapCaseResult["inspectedDocx"];
  inspectedPdf: BootstrapCaseInspectedPdf[];
  failedInspections: Array<{ fileName: string; type: string; error: string }>;
  otherFiles: Array<{ fileName: string; extension: string; size: number }>;
}

export async function inspectCaseInputsDirectory(
  params: InspectCaseInputsParams
): Promise<InspectCaseInputsOutput> {
  const { resolvedCaseDir, inputsDir, stateDir, backgroundFiles, ingestedFiles } = params;
  // 3. Normaliza nomes NFD -> NFC em inputs/ e inspeciona todos os arquivos .docx e .pdf (v1.1.1 / ENG-09)
  const rawInputEntries = readdirSync(inputsDir, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name)
  );
  for (const entry of rawInputEntries) {
    if (!entry.isFile() || entry.name.startsWith("~$")) continue;
    const nfcName = entry.name.normalize("NFC");
    if (entry.name !== nfcName) {
      const oldPath = resolve(inputsDir, entry.name);
      const newPath = resolve(inputsDir, nfcName);
      try {
        if (!existsSync(newPath)) {
          renameSync(oldPath, newPath);
        }
      } catch {
        // Sistemas APFS/HFS+ que tratam NFD/NFC como mesmo inode mantêm o arquivo acessível
      }
    }
  }

  const inputEntries = readdirSync(inputsDir, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name)
  );
  const inspectedDocx: BootstrapCaseResult["inspectedDocx"] = [];
  const inspectedPdf: BootstrapCaseInspectedPdf[] = [];
  const failedInspections: Array<{ fileName: string; type: string; error: string }> = [];
  const otherFiles: Array<{ fileName: string; extension: string; size: number }> = [];

  for (const entry of inputEntries) {
    if (!entry.isFile() || entry.name.startsWith("~$")) continue;
    const normalizedEntryName = entry.name.normalize("NFC");

    if (normalizedEntryName.toLowerCase().endsWith(".docx")) {
      try {
        const docxPath = resolve(inputsDir, entry.name);
        const base = normalizedEntryName.replace(/\.docx$/i, "").normalize("NFC");
        const structurePath = resolve(stateDir, `estrutura_${base}.json`);
        const full = await inspectDocx(docxPath, structurePath);
        const compact = compactInspectionResult(full);
        inspectedDocx.push({
          fileName: normalizedEntryName,
          docxPath,
          structurePath,
          tablesCount: compact.tables.length,
          paragraphsCount: compact.paragraphs.length,
          compactStructure: compact,
          ...(compact.forensic_meta ? { forensic_meta: compact.forensic_meta } : {}),
          ...(compact.template_match ? { template_match: compact.template_match } : {}),
          ...(compact.audit_view_path ? { audit_view_path: compact.audit_view_path } : {}),
        });

        const relStructure = relative(resolvedCaseDir, structurePath).replace(
          /\\/g,
          "/"
        );
        const match = ingestedFiles.find(
          (f) => f.saved_as.normalize("NFC") === normalizedEntryName
        );
        if (match) {
          match.structure_json = relStructure;
        }
      } catch (err: any) {
        failedInspections.push({
          fileName: normalizedEntryName,
          type: "docx",
          error: err?.message || "Falha desconhecida na extração de DOCX",
        });
      }
    } else if (normalizedEntryName.toLowerCase().endsWith(".pdf")) {
      try {
        const pdfPath = resolve(inputsDir, entry.name);
        const buf = readFileSync(pdfPath);
        if (isPdfBuffer(buf)) {
          const base = normalizedEntryName.replace(/\.pdf$/i, "").normalize("NFC");
          const structurePath = resolve(stateDir, `estrutura_${base}.json`);
          const full = await inspectDocx(pdfPath, structurePath, true);
          const activeZonesCount = Object.values(
            full.impugnation_zones || {}
          ).filter((arr) => Array.isArray(arr) && arr.length > 0).length;

          inspectedPdf.push({
            fileName: normalizedEntryName,
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
            ...(full.hybrid_scan_pages && full.hybrid_scan_pages.length > 0
              ? { hybrid_scan_pages: full.hybrid_scan_pages }
              : {}),
            ...(full.extracted_images_manifest &&
            full.extracted_images_manifest.length > 0
              ? {
                  assets_extracted_count: full.extracted_images_manifest.length,
                }
              : {}),
            ...(full.forensic_meta ? { forensic_meta: full.forensic_meta } : {}),
            pageCount: full.page_count ?? 0,
            lineCount: full.line_count ?? 0,
            outlineHeadingsCount: full.outline_headings?.length ?? 0,
            activeZonesCount,
          });

          const relStructure = relative(resolvedCaseDir, structurePath).replace(
            /\\/g,
            "/"
          );
          const match = ingestedFiles.find(
            (f) => f.saved_as.normalize("NFC") === normalizedEntryName
          );
          if (match) {
            match.structure_json = relStructure;
          }
        } else if (!backgroundFiles.includes(normalizedEntryName) && !backgroundFiles.includes(entry.name)) {
          failedInspections.push({
            fileName: normalizedEntryName,
            type: "pdf",
            error: "Arquivo não contém assinatura válida (%PDF-)",
          });
        }
      } catch (err: any) {
        failedInspections.push({
          fileName: normalizedEntryName,
          type: "pdf",
          error: err?.message || "Falha desconhecida na extração de PDF",
        });
      }
    } else if (
      normalizedEntryName.toLowerCase().endsWith(".xlsx") ||
      normalizedEntryName.toLowerCase().endsWith(".xls") ||
      normalizedEntryName.toLowerCase().endsWith(".csv")
    ) {
      const sheetPath = resolve(inputsDir, entry.name);
      let isValidSheet = false;
      if (normalizedEntryName.toLowerCase().endsWith(".csv")) {
        try {
          const content = readFileSync(sheetPath, "utf-8");
          isValidSheet = content.includes(";") || content.includes(",");
        } catch {
          isValidSheet = false;
        }
      } else {
        try {
          const buf = readFileSync(sheetPath);
          if (buf.length > 30 && buf[0] === 0x50 && buf[1] === 0x4b) {
            const zip = await JSZip.loadAsync(buf);
            isValidSheet = Boolean(
              zip.file("xl/workbook.xml") ||
              Object.keys(zip.files).some((k) => k.startsWith("xl/"))
            );
          }
        } catch {
          isValidSheet = false;
        }
      }

      if (isValidSheet) {
        try {
          const ext = extname(normalizedEntryName);
          const base = normalizedEntryName.slice(0, -ext.length).normalize("NFC");
          const structurePath = resolve(stateDir, `estrutura_${base}.json`);
          const full = await inspectDocx(sheetPath, structurePath);
          const compact = compactInspectionResult(full);
          inspectedDocx.push({
            fileName: normalizedEntryName,
            docxPath: sheetPath,
            structurePath,
            tablesCount: compact.tables.length,
            paragraphsCount: full.line_count ?? 0,
            compactStructure: compact,
            ...(full.forensic_meta ? { forensic_meta: full.forensic_meta } : {}),
            ...(compact.audit_view_path ? { audit_view_path: compact.audit_view_path } : {}),
          });

          const relStructure = relative(resolvedCaseDir, structurePath).replace(
            /\\/g,
            "/"
          );
          const match = ingestedFiles.find(
            (f) => f.saved_as.normalize("NFC") === normalizedEntryName
          );
          if (match) {
            match.structure_json = relStructure;
          }
        } catch (err: any) {
          failedInspections.push({
            fileName: normalizedEntryName,
            type: extname(normalizedEntryName).toLowerCase().replace(/^\./, ""),
            error: err?.message || "Falha na inspeção de planilha",
          });
        }
      } else {
        try {
          const stats = statSync(sheetPath);
          otherFiles.push({
            fileName: entry.name,
            extension: extname(entry.name).toLowerCase().replace(/^\./, "") || "anexo",
            size: stats.size,
          });
        } catch {
          // Ignora falha de stat
        }
      }
    } else {
      // Outros formatos (textos, imagens, metadados)
      try {
        const otherPath = resolve(inputsDir, entry.name);
        const stats = statSync(otherPath);
        otherFiles.push({
          fileName: entry.name,
          extension: extname(entry.name).toLowerCase().replace(/^\./, "") || "anexo",
          size: stats.size,
        });
      } catch {
        // Ignora falha de stat
      }
    }
  }


  return { inspectedDocx, inspectedPdf, failedInspections, otherFiles };
}
