import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { resolve, dirname, basename, relative } from "node:path";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import {
  getAllElements,
  getDirectChildElements,
  extractParagraphStyle,
  extractParagraphText,
  extractParagraphNumbering,
  extractCellText,
} from "../utils/xml.ts";
import {
  computeStructureFingerprint,
  findBestTemplateMatch,
  reanchorSlotsManifest,
} from "../core/registry.ts";
import type {
  BodyParagraphInfo,
  TableInfo,
  DocxTocMap,
  TocParagraphItem,
  TocFormCellItem,
  TocTableItem,
  DocxInspectionResult,
  HeaderFooterParagraphInfo,
  TemplateMatchResult,
  InspectDocxSyntheticResult,
} from "../types/index.ts";

// ============================================================================
// Mapeamento Estrutural e Sumário (TOC Map & Compact Inspection)
// ============================================================================

export function buildTocMap(
  paragraphs: BodyParagraphInfo[],
  tables: TableInfo[]
): DocxTocMap {
  const sections: TocParagraphItem[] = [];
  const form_fields: TocFormCellItem[] = [];
  const tocTables: TocTableItem[] = [];

  // 1. Mapeamento de Títulos e Seções em Parágrafos
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const text = p.text.trim();
    if (!text || text.length > 150) continue;

    const hasHeadingStyle =
      p.style !== null &&
      /^(?:Heading|Titulo|Título|T[ií]tulo|Header|Se[çc][ãa]o)/i.test(p.style);

    const isNumberedSection =
      /^(?:(?:\d+(?:\.\d+)*|[A-Z]|\b[IVXLCDM]+\b)[\.\-\)\s]|CL[ÁA]USULA|SE[ÇC][ÃA]O|CAP[IÍ]TULO|ANEXO)\s+[A-ZÀ-Ú0-9]/i.test(
        text
      );

    const isCommonAdminHeader =
      /^(?:ESTUDO T[EÉ]CNICO PRELIMINAR|TERMO DE REFER[EÊ]NCIA|PROJETO B[AÁ]SICO|JUSTIFICATIVA|OBJETO(?:\s+DA\s+CONTRATA[ÇC][ÃA]O)?|DISPOSI[ÇC][ÕO]ES GERAIS|MATRIZ DE RISCOS|CRONOGRAMA|PESQUISA DE PRE[ÇC]OS|CRIT[EÉ]RIOS DE HABILITA[ÇC][ÃA]O|DISPOSI[ÇC][ÕO]ES FINAIS)\b/i.test(
        text
      );

    const isAllCapsTitle =
      text.length >= 4 &&
      text.length <= 100 &&
      text === text.toUpperCase() &&
      /[A-ZÀ-Ú]/.test(text) &&
      !/[;,.]$/.test(text) &&
      !text.includes("\n");

    if (
      hasHeadingStyle ||
      isNumberedSection ||
      isCommonAdminHeader ||
      isAllCapsTitle
    ) {
      sections.push({
        coord: `P${p.index}`,
        title: text,
        suggested_target_slot:
          i + 1 < paragraphs.length ? `P${paragraphs[i + 1].index}` : undefined,
      });
    }
  }

  // 2. Mapeamento de Campos e Perguntas em Tabelas de Formulário
  for (const tbl of tables) {
    for (let rIdx = 0; rIdx < tbl.rows.length; rIdx++) {
      const row = tbl.rows[rIdx];
      for (let cIdx = 0; cIdx < row.cells.length; cIdx++) {
        const cell = row.cells[cIdx];
        const txt = cell.text.trim();
        if (!txt || txt.length > 250) continue;

        const isQuestion = txt.endsWith("?") || txt.includes("?");
        const isLabel =
          txt.endsWith(":") && txt.length <= 100 && !txt.includes("\n");
        const isNumberedPrompt =
          /^\d+(\.\d+)*\s+[A-ZÀ-Ú]/i.test(txt) && txt.length <= 100;
        const isTwoColKey =
          row.cells.length === 2 &&
          cIdx === 0 &&
          txt.length <= 100 &&
          !txt.includes("\n");

        if (isQuestion || isLabel || isNumberedPrompt || isTwoColKey) {
          let suggestedTarget: string | undefined;

          // Se houver célula adjacente à direita na mesma linha
          if (cIdx + 1 < row.cells.length) {
            suggestedTarget = `T${tbl.index}.R${row.rowIndex}.C${row.cells[cIdx + 1].cellIndex}`;
          } else if (rIdx + 1 < tbl.rows.length) {
            // Se for coluna única, o alvo costuma ser a linha imediatamente abaixo
            const nextRow = tbl.rows[rIdx + 1];
            const targetCell =
              nextRow.cells.find((c) => c.cellIndex === cell.cellIndex) ??
              nextRow.cells[0];
            if (targetCell) {
              suggestedTarget = `T${tbl.index}.R${nextRow.rowIndex}.C${targetCell.cellIndex}`;
            }
          }

          form_fields.push({
            coord: `T${tbl.index}.R${row.rowIndex}.C${cell.cellIndex}`,
            title: txt.length > 120 ? `${txt.slice(0, 117)}...` : txt,
            ...(suggestedTarget ? { suggested_target_slot: suggestedTarget } : {}),
          });
        }
      }
    }

    // 3. Resumo Estrutural das Tabelas
    const rowsCount = tbl.rows.length;
    let maxCols = 0;
    for (const r of tbl.rows) {
      if (r.cells.length > maxCols) maxCols = r.cells.length;
    }

    const firstRowCells = tbl.rows[0]?.cells ?? [];
    const headers = firstRowCells
      .map((c) => c.text.trim().replace(/\r?\n/g, " "))
      .filter((t) => t.length > 0);

    tocTables.push({
      table_index: tbl.index,
      rows: rowsCount,
      cols: maxCols,
      headers,
      sample_row_coord: rowsCount > 1 ? `T${tbl.index}.R1` : undefined,
    });
  }

  return {
    sections,
    form_fields,
    tables: tocTables,
  };
}

export function compactInspectionResult(
  full: DocxInspectionResult
): DocxInspectionResult {
  return {
    ...(full.toc_map ? { toc_map: full.toc_map } : {}),
    ...(full.structure_fingerprint
      ? { structure_fingerprint: full.structure_fingerprint }
      : {}),
    ...(full.template_match ? { template_match: full.template_match } : {}),
    ...(full.audit_view_path ? { audit_view_path: full.audit_view_path } : {}),
    headers: full.headers.filter((h) => h.text.trim() !== ""),
    footers: full.footers.filter((f) => f.text.trim() !== ""),
    paragraphs: full.paragraphs.filter((p) => p.text.trim() !== ""),
    tables: full.tables.map((t) => ({
      index: t.index,
      rows: t.rows
        .map((r) => ({
          rowIndex: r.rowIndex,
          cells: r.cells.filter((c) => c.text.trim() !== ""),
        }))
        .filter((r) => r.cells.length > 0),
    })),
  };
}

export function generateLinearAuditViewMarkdown(
  docName: string,
  inspection: DocxInspectionResult
): string {
  const lines: string[] = [];
  lines.push(`# Visão Linear de Auditoria: ${docName}`);
  lines.push(
    `> Espelho estrutural gerado por docgov-docx v0.6.0 para leitura integral em turno único.`
  );
  lines.push("");

  // 1. Cabeçalhos e Rodapés
  const hasHf =
    (inspection.headers && inspection.headers.length > 0) ||
    (inspection.footers && inspection.footers.length > 0);
  if (hasHf) {
    lines.push("## Cabeçalhos e Rodapés");
    if (inspection.headers) {
      for (const h of inspection.headers) {
        if (h.text.trim()) {
          lines.push(`- [H${h.paragraphIndex}] ${h.text.trim()}`);
        }
      }
    }
    if (inspection.footers) {
      for (const f of inspection.footers) {
        if (f.text.trim()) {
          lines.push(`- [F${f.paragraphIndex}] ${f.text.trim()}`);
        }
      }
    }
    lines.push("");
  }

  // 2. Parágrafos e Seções
  if (inspection.paragraphs && inspection.paragraphs.length > 0) {
    lines.push("## Parágrafos e Seções");
    for (const p of inspection.paragraphs) {
      const txt = p.text.trim();
      if (!txt) continue;
      const isHeading = inspection.toc_map?.sections.some(
        (s) => s.coord === `P${p.index}`
      );
      if (isHeading) {
        lines.push(`- **[P${p.index}]** ${txt}`);
      } else {
        lines.push(`- [P${p.index}] ${txt}`);
      }
    }
    lines.push("");
  }

  // 3. Tabelas
  if (inspection.tables && inspection.tables.length > 0) {
    lines.push("## Tabelas");
    for (const tbl of inspection.tables) {
      let maxCols = 0;
      for (const r of tbl.rows) {
        if (r.cells.length > maxCols) maxCols = r.cells.length;
      }
      lines.push(
        `### Tabela [T${tbl.index}] (${tbl.rows.length} linhas x ${maxCols} colunas)`
      );

      for (const r of tbl.rows) {
        const nonEmptyCells = r.cells.filter((c) => c.text.trim() !== "");
        if (nonEmptyCells.length === 0) continue;

        if (r.cells.length === 2) {
          const c0 = r.cells[0];
          const c1 = r.cells[1];
          const t0 = c0.text.trim().replace(/\r?\n/g, " ");
          const t1 = c1.text.trim().replace(/\r?\n/g, " ");
          lines.push(
            `- [T${tbl.index}.R${r.rowIndex}.C${c0.cellIndex}] ${t0} -> [T${tbl.index}.R${r.rowIndex}.C${c1.cellIndex}] ${t1 || "[vazio]"}`
          );
        } else {
          const rowParts = r.cells.map(
            (c) =>
              `[T${tbl.index}.R${r.rowIndex}.C${
                c.cellIndex
              }] ${c.text.trim().replace(/\r?\n/g, " ") || "[vazio]"}`
          );
          lines.push(`- [T${tbl.index}.R${r.rowIndex}] ${rowParts.join(" | ")}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim() + "\n";
}

// ============================================================================
// 1. Função de Inspeção Estrutural (inspect_docx)
// ============================================================================

export async function inspectDocx(
  docxPath: string,
  outputPath?: string,
  compact: boolean = false,
  options: { registryDir?: string } = {}
): Promise<DocxInspectionResult> {
  const resolvedDocx = resolve(docxPath);
  if (!existsSync(resolvedDocx)) {
    throw new Error(`Arquivo .docx não encontrado: ${resolvedDocx}`);
  }

  const buffer = readFileSync(resolvedDocx);
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();

  const headers: HeaderFooterParagraphInfo[] = [];
  const footers: HeaderFooterParagraphInfo[] = [];

  const fileNames = Object.keys(zip.files).sort();

  for (const name of fileNames) {
    if (/^word\/header\d*\.xml$/i.test(name)) {
      const xmlStr = await zip.file(name)!.async("string");
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      const pList = getAllElements(xmlDoc, "w:p");
      pList.forEach((p, idx) => {
        headers.push({
          part: name,
          index: idx,
          paragraphIndex: idx,
          style: extractParagraphStyle(p),
          text: extractParagraphText(p),
        });
      });
    } else if (/^word\/footer\d*\.xml$/i.test(name)) {
      const xmlStr = await zip.file(name)!.async("string");
      const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
      const pList = getAllElements(xmlDoc, "w:p");
      pList.forEach((p, idx) => {
        footers.push({
          part: name,
          index: idx,
          paragraphIndex: idx,
          style: extractParagraphStyle(p),
          text: extractParagraphText(p),
        });
      });
    }
  }

  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error(
      `Estrutura OpenXML inválida (word/document.xml ausente): ${resolvedDocx}`
    );
  }

  const docXmlStr = await docFile.async("string");
  const docXml = parser.parseFromString(docXmlStr, "application/xml");
  const body = getAllElements(docXml, "w:body")[0];
  if (!body) {
    throw new Error(`Elemento <w:body> não encontrado em word/document.xml`);
  }

  const bodyParagraphs = getDirectChildElements(body, "w:p");
  const paragraphs: BodyParagraphInfo[] = bodyParagraphs.map((p, index) => {
    const numbering = extractParagraphNumbering(p);
    return {
      index,
      style: extractParagraphStyle(p),
      text: extractParagraphText(p),
      ...(numbering ? { numbering } : {}),
    };
  });

  const bodyTables = getDirectChildElements(body, "w:tbl");
  const tables: TableInfo[] = bodyTables.map((tbl, index) => {
    const trList = getDirectChildElements(tbl, "w:tr");
    return {
      index,
      rows: trList.map((tr, rowIndex) => {
        const tcList = getDirectChildElements(tr, "w:tc");
        return {
          rowIndex,
          cells: tcList.map((tc, cellIndex) => ({
            cellIndex,
            text: extractCellText(tc),
          })),
        };
      }),
    };
  });

  const toc_map = buildTocMap(paragraphs, tables);

  const rawResult: DocxInspectionResult = {
    toc_map,
    headers,
    footers,
    paragraphs,
    tables,
  };

  // Cálculo da Impressão Digital Estrutural (v0.6.0)
  const structure_fingerprint = computeStructureFingerprint(rawResult);
  rawResult.structure_fingerprint = structure_fingerprint;

  // Geração da Visão Linear Compacta de Auditoria (v0.6.0)
  let auditViewPath: string;
  if (outputPath) {
    const resolvedOut = resolve(outputPath);
    const outDir = dirname(resolvedOut);
    const outBase = basename(resolvedOut, ".json").replace(/^estrutura_/, "");
    auditViewPath = resolve(outDir, `visao_auditoria_${outBase}.md`);
  } else {
    const docDir = dirname(resolvedDocx);
    const docBase = basename(resolvedDocx, ".docx");
    auditViewPath = resolve(docDir, `visao_auditoria_${docBase}.md`);
  }

  const auditMd = generateLinearAuditViewMarkdown(
    basename(resolvedDocx),
    rawResult
  );
  const auditDir = dirname(auditViewPath);
  if (!existsSync(auditDir)) {
    mkdirSync(auditDir, { recursive: true });
  }
  writeFileSync(auditViewPath, auditMd, "utf-8");
  rawResult.audit_view_path = auditViewPath;

  // Matching 1-para-N contra o Cache Global de Templates (v0.6.0)
  const match = findBestTemplateMatch(
    structure_fingerprint,
    resolvedDocx,
    options.registryDir
  );
  let template_match: TemplateMatchResult;

  if (match.entry) {
    if (match.similarity >= 0.995) {
      template_match = {
        status: "EXACT",
        similarity: 1.0,
        template_id: match.entry.template_id,
        registry_path: match.entry.registry_path,
        message: `Template idêntico (100%) localizado no registro global: '${match.entry.template_id}'.`,
      };
    } else if (match.similarity >= 0.75) {
      const adapted = reanchorSlotsManifest(
        match.entry,
        structure_fingerprint,
        rawResult
      );
      const outStateDir = outputPath
        ? dirname(resolve(outputPath))
        : dirname(resolvedDocx);
      const adaptedPath = resolve(outStateDir, "adapted_slots_manifest.json");
      if (!existsSync(outStateDir)) {
        mkdirSync(outStateDir, { recursive: true });
      }
      writeFileSync(adaptedPath, JSON.stringify(adapted, null, 2), "utf-8");

      template_match = {
        status: "MODIFIED",
        similarity: match.similarity,
        template_id: match.entry.template_id,
        registry_path: match.entry.registry_path,
        adapted_manifest_path: adaptedPath,
        shift_summary:
          adapted._shift_summary ||
          "Coordenadas reancoradas automaticamente por rótulos de formulário.",
        message: `Template base '${
          match.entry.template_id
        }' compatível com drift (${Math.round(
          match.similarity * 100
        )}%). Manifesto adaptado gerado em state/adapted_slots_manifest.json.`,
      };
    } else {
      template_match = {
        status: "NEW",
        similarity: match.similarity,
        message: `Minuta inédita (< 75% de similaridade com templates registrados). Maior similaridade: ${Math.round(
          match.similarity * 100
        )}% ('${
          match.entry.template_id
        }'). Elabore um novo slots_manifest.json.`,
      };
    }
  } else {
    template_match = {
      status: "NEW",
      similarity: 0,
      message:
        "Nenhum template salvo no registro global de templates. Elabore um novo slots_manifest.json.",
    };
  }
  rawResult.template_match = template_match;

  const finalResult = compact ? compactInspectionResult(rawResult) : rawResult;

  if (outputPath) {
    const resolvedOut = resolve(outputPath);
    const outDir = dirname(resolvedOut);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }
    writeFileSync(resolvedOut, JSON.stringify(finalResult, null, 2), "utf-8");
  }

  return finalResult;
}

export function formatInspectDocxSyntheticResult(
  docxPath: string,
  outputPath: string,
  inspection: DocxInspectionResult
): InspectDocxSyntheticResult {
  let totalRows = 0;
  for (const table of inspection.tables) {
    totalRows += table.rows.length;
  }

  const toc_summary: Array<{ coord: string; title: string; target?: string }> =
    [];
  const tocMap = inspection.toc_map;
  if (tocMap) {
    // Adiciona até 2 seções principais
    for (const s of tocMap.sections.slice(0, 2)) {
      toc_summary.push({
        coord: s.coord,
        title: s.title.length > 25 ? `${s.title.slice(0, 22)}...` : s.title,
        ...(s.suggested_target_slot ? { target: s.suggested_target_slot } : {}),
      });
    }
    // Adiciona 1 campo de formulário principal
    for (const f of tocMap.form_fields.slice(0, 1)) {
      toc_summary.push({
        coord: f.coord,
        title: f.title.length > 25 ? `${f.title.slice(0, 22)}...` : f.title,
        ...(f.suggested_target_slot ? { target: f.suggested_target_slot } : {}),
      });
    }
    // Adiciona 1 tabela resumida
    if (tocMap.tables.length > 0) {
      const t = tocMap.tables[0];
      const headerSample = t.headers.slice(0, 2).join(", ");
      toc_summary.push({
        coord: `T${t.table_index}`,
        title: `Tbl (${t.rows}x${t.cols})${
          headerSample ? ` [${headerSample}]` : ""
        }`,
      });
    }
  }

  const relAuditPath = inspection.audit_view_path
    ? relative(process.cwd(), inspection.audit_view_path).replace(/\\/g, "/")
    : undefined;

  const conciseMatch = inspection.template_match
    ? {
        status: inspection.template_match.status,
        ...(inspection.template_match.similarity
          ? { similarity: inspection.template_match.similarity }
          : {}),
        ...(inspection.template_match.template_id
          ? { template_id: inspection.template_match.template_id }
          : {}),
        ...(inspection.template_match.adapted_manifest_path
          ? {
              adapted_manifest_path: relative(
                process.cwd(),
                inspection.template_match.adapted_manifest_path
              ).replace(/\\/g, "/"),
            }
          : {}),
      }
    : undefined;

  let nextHint =
    "Inspeção gravada com toc_map. Próximo passo: elabore slots_manifest.json e chame 'build_docx_template'.";
  if (inspection.template_match?.status === "EXACT") {
    nextHint = `Template homologado no cache (${inspection.template_match.template_id}). Reutilize slots_manifest.json para 'build_docx_template'.`;
  } else if (inspection.template_match?.status === "MODIFIED") {
    nextHint = `Drift detectado (${Math.round(
      (inspection.template_match.similarity || 0) * 100
    )}%). Use adapted_slots_manifest.json em 'build_docx_template'.`;
  }

  return {
    status: "success",
    docxPath,
    outputPath,
    tables: inspection.tables.length,
    rows: totalRows,
    paragraphs: inspection.paragraphs.length,
    ...(conciseMatch ? { template_match: conciseMatch } : {}),
    ...(relAuditPath ? { audit_view_path: relAuditPath } : {}),
    ...(toc_summary.length > 0 ? { toc_summary } : {}),
    next_step_hint: nextHint,
  };
}

