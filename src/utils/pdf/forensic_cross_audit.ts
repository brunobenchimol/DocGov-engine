import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, relative, resolve } from "node:path";
import type {
  DocumentForensicMeta,
  ExtractedPdfImageAsset,
} from "../../types/index.ts";

const IGNORED_GENERIC_AUTHORS = new Set([
  "",
  "user",
  "admin",
  "administrator",
  "usuario",
  "usuário",
  "microsoft office user",
  "microsoft",
  "unknown",
  "system",
  "root",
  "default",
]);

export function resolveAssetsDirForDoc(params: {
  outDir: string;
  inScope?: boolean;
  baseStem: string;
}): { assetsDir: string; useRelativePath: boolean; caseOrOutRoot: string } {
  const { outDir, inScope, baseStem } = params;
  const resolvedOut = resolve(outDir);

  if (inScope) {
    const isStateFolder = basename(resolvedOut).toLowerCase() === "state";
    const rootDir = isStateFolder ? dirname(resolvedOut) : resolvedOut;
    return {
      assetsDir: resolve(rootDir, "assets", baseStem),
      useRelativePath: true,
      caseOrOutRoot: rootDir,
    };
  }

  return {
    assetsDir: resolve(tmpdir(), "docgov_ephemeral_inspect", "assets", baseStem),
    useRelativePath: false,
    caseOrOutRoot: resolvedOut,
  };
}

export function materializeExtractedPdfImages(params: {
  extractedImages?: ExtractedPdfImageAsset[];
  outDir: string;
  inScope?: boolean;
  baseStem: string;
}): Array<Omit<ExtractedPdfImageAsset, "png_data">> {
  const { extractedImages, outDir, inScope, baseStem } = params;
  if (!extractedImages || extractedImages.length === 0) return [];

  const { assetsDir, useRelativePath, caseOrOutRoot } = resolveAssetsDirForDoc({
    outDir,
    inScope,
    baseStem,
  });

  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }

  const manifest: Array<Omit<ExtractedPdfImageAsset, "png_data">> = [];

  for (const img of extractedImages) {
    const pagPad = String(img.page).padStart(3, "0");
    const idxPad = String(img.asset_index).padStart(2, "0");
    const fileName = `pag_${pagPad}_img_${idxPad}.png`;
    const absPath = resolve(assetsDir, fileName);

    if (img.png_data && img.png_data.length > 0) {
      writeFileSync(absPath, img.png_data);
    }

    const normalizedAbs = absPath.replace(/\\/g, "/");
    const relPath = useRelativePath
      ? relative(caseOrOutRoot, absPath).replace(/\\/g, "/")
      : normalizedAbs;

    manifest.push({
      page: img.page,
      asset_index: img.asset_index,
      asset_id: img.asset_id,
      page_class: img.page_class,
      coverage_pct: img.coverage_pct,
      width: img.width,
      height: img.height,
      sha256: img.sha256,
      saved_path: normalizedAbs,
      relative_path: relPath,
    });
  }

  return manifest;
}

export function formatAssetAnchorLine(
  asset: Omit<ExtractedPdfImageAsset, "png_data">
): string {
  const pagPad = String(asset.page).padStart(3, "0");
  const displayPath = asset.relative_path || asset.saved_path || "";
  return `[PAG_${pagPad} | ${asset.asset_id} | tipo=${asset.page_class} | coverage=${asset.coverage_pct}% | ${asset.width}x${asset.height}px | path="${displayPath}"]`;
}

export interface ForensicInventoryItem {
  fileName: string;
  forensicMeta?: DocumentForensicMeta;
  assetsExtractedCount?: number;
  hybridScanPages?: number[];
}

export interface CrossForensicCollisionAlert {
  code:
    | "BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT"
    | "PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK"
    | "FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK";
  files: string[];
  reason: string;
}

function normalizeRsidToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const norm = raw.trim().toUpperCase();
  if (!/^[0-9A-F]{1,8}$/.test(norm)) return null;
  const padded = norm.padStart(8, "0");
  return padded === "00000000" ? null : padded;
}

function detectDocxRsidCollisions(
  withMeta: ForensicInventoryItem[],
  alerts: CrossForensicCollisionAlert[]
): void {
  const byRoot = new Map<string, string[]>();
  for (const it of withMeta) {
    const root = normalizeRsidToken(it.forensicMeta?.rsid_root);
    if (!root) continue;
    const list = byRoot.get(root) || [];
    if (!list.includes(it.fileName)) list.push(it.fileName);
    byRoot.set(root, list);
  }

  const flaggedPairs = new Set<string>();
  for (const [root, files] of byRoot.entries()) {
    if (files.length < 2) continue;
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        flaggedPairs.add([files[i], files[j]].sort().join("\0"));
      }
    }
    alerts.push({
      code: "FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK",
      files,
      reason: `Clonagem estrutural OpenXML (w:rsidRoot=${root} compartilhado) detectada entre ${files.length} arquivos (${files.join(", ")}), mesmo após eventual limpeza de Author.`,
    });
  }

  const sampleEntries = withMeta
    .map((it) => ({
      fileName: it.fileName,
      rsids: new Set(
        (it.forensicMeta?.rsid_sample || [])
          .map((r) => normalizeRsidToken(r))
          .filter((r): r is string => Boolean(r))
      ),
    }))
    .filter((e) => e.rsids.size >= 3);

  for (let i = 0; i < sampleEntries.length; i++) {
    for (let j = i + 1; j < sampleEntries.length; j++) {
      const a = sampleEntries[i];
      const b = sampleEntries[j];
      const pairKey = [a.fileName, b.fileName].sort().join("\0");
      if (flaggedPairs.has(pairKey)) continue;

      let intersection = 0;
      for (const r of a.rsids) if (b.rsids.has(r)) intersection++;
      const union = a.rsids.size + b.rsids.size - intersection;
      const jaccard = union > 0 ? intersection / union : 0;
      if (intersection >= 3 && jaccard >= 0.5) {
        alerts.push({
          code: "FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK",
          files: [a.fileName, b.fileName],
          reason: `Sobreposição elevada de histórico w:rsidR (${intersection} revisões em comum, Jaccard ${(jaccard * 100).toFixed(1)}%) entre '${a.fileName}' e '${b.fileName}'.`,
        });
      }
    }
  }
}

function normalizePersonKey(val: string | null | undefined): string | null {
  if (!val) return null;
  const cleaned = val.trim().toLowerCase().replace(/\s+/g, " ");
  if (!cleaned || IGNORED_GENERIC_AUTHORS.has(cleaned)) return null;
  return cleaned;
}

export function detectCrossDocumentForensicCollisions(
  items: ForensicInventoryItem[]
): CrossForensicCollisionAlert[] {
  const withMeta = items.filter((it) => Boolean(it.forensicMeta));
  if (withMeta.length < 2) return [];

  const alerts: CrossForensicCollisionAlert[] = [];
  const byAuthor = new Map<string, string[]>();

  for (const it of withMeta) {
    const meta = it.forensicMeta!;
    const identities = new Set<string>();
    const a = normalizePersonKey(meta.author);
    const l = normalizePersonKey(meta.last_modified_by);
    if (a) identities.add(a);
    if (l) identities.add(l);

    for (const id of identities) {
      const list = byAuthor.get(id) || [];
      if (!list.includes(it.fileName)) {
        list.push(it.fileName);
      }
      byAuthor.set(id, list);
    }
  }

  for (const [identity, files] of byAuthor.entries()) {
    if (files.length < 2) continue;

    // Checa proximidade de CreationDate (< 120s) se ambos tiverem data
    const dates = files
      .map((f) => withMeta.find((x) => x.fileName === f)?.forensicMeta?.creation_date_iso)
      .filter((d): d is string => Boolean(d))
      .map((d) => new Date(d).getTime())
      .filter((ms) => !Number.isNaN(ms))
      .sort((a, b) => a - b);

    let closeTimeNote = "";
    if (dates.length >= 2) {
      const minDeltaSec = Math.round((dates[1] - dates[0]) / 1000);
      if (minDeltaSec <= 120) {
        closeTimeNote = ` e CreationDate próxima (${minDeltaSec}s <= 120s)`;
      }
    }

    const looksLikeQuotation = files.some((f) =>
      /cotac|orcament|preco|pesquisa|mapa|fornecedor/i.test(f)
    );
    const code = looksLikeQuotation
      ? "PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK"
      : "BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT";

    alerts.push({
      code,
      files,
      reason: `Identidade compartilhada ("${identity}") entre ${files.length} arquivo(s) (${files.join(
        ", "
      )})${closeTimeNote}.`,
    });
  }

  detectDocxRsidCollisions(withMeta, alerts);
  return alerts;
}

export function renderForensicInventorySectionMarkdown(
  items: ForensicInventoryItem[]
): string[] {
  const lines: string[] = [];
  lines.push("### 🔍 Inventário Forense de Metadados (PDF, DOCX & XLSX) e Cobertura Visual Multimodal");
  lines.push("");

  const inspected = items.filter((i) => Boolean(i.forensicMeta));
  if (inspected.length === 0) {
    lines.push("- *(Nenhum metadado forense extraído para os documentos deste caso)*");
    lines.push("");
    return lines;
  }

  lines.push(
    "| Arquivo | Formato | Author / Creator | LastModifiedBy / Producer | CreationDate | ModDate | Assinatura Digital | Anomalias Forenses |"
  );
  lines.push(
    "| :--- | :---: | :--- | :--- | :--- | :--- | :---: | :--- |"
  );

  for (const item of inspected) {
    const m = item.forensicMeta!;
    const authCreator = `${m.author || "-"} / ${m.creator_tool || "-"}`;
    const modProd = `${m.last_modified_by || "-"} / ${m.producer || "-"}`;
    const created = m.creation_date_iso || "-";
    const mod = m.mod_date_iso || "-";
    const sig = m.has_digital_signature
      ? m.signature_date_iso
        ? `Sim (${m.signature_date_iso})`
        : "Sim"
      : "Não";

    const notes: string[] = [...m.forensic_anomalies];
    if (m.editing_software_traces.length > 0) {
      notes.push(`Softwares: ${m.editing_software_traces.join(", ")}`);
    }
    if (item.assetsExtractedCount && item.assetsExtractedCount > 0) {
      notes.push(`Assets visuais: ${item.assetsExtractedCount} PNG(s)`);
    }
    if (item.hybridScanPages && item.hybridScanPages.length > 0) {
      notes.push(`Scan Híbrido Pág(s): ${item.hybridScanPages.join(", ")}`);
    }
    if (m.rsid_root) {
      notes.push(`rsidRoot=${m.rsid_root}${m.rsid_unique_count ? ` (${m.rsid_unique_count} rsidR)` : ""}`);
    }

    lines.push(
      `| **${item.fileName}** | \`.${m.source_format}\` | ${authCreator} | ${modProd} | ${created} | ${mod} | ${sig} | ${notes.join("; ") || "-"} |`
    );
  }

  const collisions = detectCrossDocumentForensicCollisions(inspected);
  if (collisions.length > 0) {
    lines.push("");
    for (const c of collisions) {
      lines.push(`- 🚨 **[${c.code}]** ${c.reason}`);
    }
  }

  lines.push("");
  return lines;
}
