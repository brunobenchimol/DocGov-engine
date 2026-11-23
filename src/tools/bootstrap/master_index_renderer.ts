import { relative, basename } from "node:path";
import { renderForensicInventorySectionMarkdown } from "../../utils/pdf/forensic_cross_audit.ts";
import { ALL_IMPUGNATION_ZONE_IDS } from "../../core/cartography.ts";
import { VERSION } from "../../constants/index.ts";
import type {
  BootstrapCaseResult,
  BootstrapCaseSyntheticResult,
  DocumentForensicMeta,
  UnpackedArchiveSummary,
} from "../../types/index.ts";
export interface MasterIndexEntry {
  fileName: string;
  type: string;
  status?: "inspected" | "error" | "attachment";
  errorMessage?: string;
  volumeSummary: string;
  structureRelPath?: string;
  auditViewRelPath?: string;
  dossieRelPath?: string;
  activeZonesCount: number;
  scannedPages?: number[];
  hybridScanPages?: number[];
  assetsExtractedCount?: number;
  forensicMeta?: DocumentForensicMeta;
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
  entries: MasterIndexEntry[],
  unpackedArchives?: UnpackedArchiveSummary[]
): string {
  const caseName = basename(caseDir);
  const lines: string[] = [];
  const sortedEntries = entries.slice().sort((a, b) => a.fileName.localeCompare(b.fileName));

  lines.push(`# 🗺️ Índice Mestre Cartográfico do Processo: ${caseName}`);
  lines.push(
    `> Documento consolidado gerado por docgov-engine v${VERSION} (${sortedEntries.length} arquivo(s) mapeado(s)).`
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

  for (const entry of sortedEntries) {
    const scannedBadge =
      entry.scannedPages && entry.scannedPages.length > 0
        ? ` <br>⚠️ **Escaneado (Pág ${entry.scannedPages.join(", ")})**`
        : "";

    let structCol = "-";
    let activeZonesCol = `**${entry.activeZonesCount} / 14**`;

    if (entry.status === "error") {
      structCol = `⚠️ **Falha de leitura:** ${entry.errorMessage || "Erro na extração"}`;
      activeZonesCol = "⚠️ Falha";
    } else if (entry.status === "attachment") {
      structCol = `📊 *Anexo de dados (não inspecionado)*`;
      activeZonesCol = "-";
    } else if (entry.structureRelPath) {
      structCol = `\`${entry.structureRelPath}\``;
    }

    const auditLink = entry.auditViewRelPath
      ? `\`${entry.auditViewRelPath}\``
      : "-";
    const dossieLink = entry.dossieRelPath
      ? `\`${entry.dossieRelPath}\``
      : "-";

    lines.push(
      `| **${entry.fileName}**${scannedBadge} | \`.${entry.type}\` | ${entry.volumeSummary} | ${structCol} | ${auditLink} | ${dossieLink} | ${activeZonesCol} |`
    );
  }
  lines.push("");

  lines.push(
    ...renderForensicInventorySectionMarkdown(
      sortedEntries.map((e) => ({
        fileName: e.fileName,
        forensicMeta: e.forensicMeta,
        assetsExtractedCount: e.assetsExtractedCount,
        hybridScanPages: e.hybridScanPages,
      }))
    )
  );

  if (unpackedArchives && unpackedArchives.length > 0) {
    lines.push("### 📦 Pacotes Compactados Descompactados Automaticamente");
    lines.push("");
    lines.push(
      "| Pacote Original | Formato | Arquivos Extraídos | Arquivos Ingeridos em `inputs/` |"
    );
    lines.push(
      "| :--- | :---: | :---: | :--- |"
    );
    for (const archive of unpackedArchives) {
      const savedList = archive.files.map((f) => `\`${f.savedAs}\``).join(", ");
      lines.push(
        `| **${archive.archiveName}** | \`.${archive.archiveType}\` | ${archive.extractedCount} | ${savedList || "-"} |`
      );
    }
    lines.push("");
  }

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
    ...(res.unpacked_archives && res.unpacked_archives.length > 0
      ? {
          unpacked_archives_count: res.unpacked_archives.length,
          extracted_files_count: res.unpacked_archives.reduce(
            (sum, a) => sum + a.extractedCount,
            0
          ),
        }
      : {}),
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
    ...(res.failed_inspections && res.failed_inspections.length > 0
      ? { inspection_errors_count: res.failed_inspections.length }
      : {}),
    next_step_hint:
      res.failed_inspections && res.failed_inspections.length > 0
        ? `Estrutura pronta com ${res.failed_inspections.length} ressalva(s). Elabore slots_manifest.json e chame build_docx_template.`
        : "Estrutura pronta. Elabore slots_manifest.json e chame build_docx_template.",
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
