import {
  isElementMatch,
  getAllElements,
  getDirectChildElements,
  extractParagraphText,
  findBodyRunProperties,
  stripBoldFromRPr,
  addBoldToRPr,
  extractCellVMerge,
  extractCellGridSpan,
  extractCellText,
  setTableCellSingleParagraphText,
} from "../../utils/xml.ts";

// ============================================================================
// Conversor Nativo de Tabelas Markdown para OpenXML <w:tbl> (ENG-06 — v1.3.7)
// ============================================================================

export function appendRichTextRunsToParagraph(
  xmlDoc: Document,
  targetP: Element,
  textWithMarkdownBold: string,
  normalRPr: Element | null
): void {
  const segments = textWithMarkdownBold.split(/(\*\*[^*]+\*\*)/g);
  for (const seg of segments) {
    if (!seg) continue;
    const isBoldSeg =
      seg.startsWith("**") && seg.endsWith("**") && seg.length > 4;
    const cleanText = isBoldSeg ? seg.slice(2, -2) : seg;

    const r = xmlDoc.createElement("w:r");
    const rPrToUse = isBoldSeg
      ? addBoldToRPr(xmlDoc, normalRPr)
      : normalRPr
        ? (normalRPr.cloneNode(true) as Element)
        : null;
    if (rPrToUse) {
      r.appendChild(rPrToUse);
    }

    const t = xmlDoc.createElement("w:t");
    t.setAttribute("xml:space", "preserve");
    t.textContent = cleanText;
    r.appendChild(t);
    targetP.appendChild(r);
  }
}

export function parseMarkdownTableRowCells(line: string): string[] {
  let clean = line.trim();
  if (clean.startsWith("|")) {
    clean = clean.slice(1);
  }
  if (clean.endsWith("|")) {
    clean = clean.slice(0, -1);
  }
  return clean.split("|").map((c) => c.trim());
}

export function isMarkdownTablePipeRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const pipeCount = (trimmed.match(/\|/g) || []).length;
  const cells = parseMarkdownTableRowCells(trimmed);
  if (cells.length < 2) return false;
  return (trimmed.startsWith("|") && trimmed.endsWith("|")) || pipeCount >= 2;
}

export function isMarkdownTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const cells = parseMarkdownTableRowCells(trimmed);
  if (cells.length < 2) return false;
  return cells.every((c) => /^:?-{2,}:?$/.test(c));
}

export function parseMarkdownTableAlignments(
  sepLine: string
): Array<"left" | "center" | "right"> {
  const cells = parseMarkdownTableRowCells(sepLine);
  return cells.map((c) => {
    if (c.startsWith(":") && c.endsWith(":")) return "center";
    if (c.endsWith(":")) return "right";
    return "left";
  });
}

export type MarkdownLineSegment =
  | { type: "line"; line: string }
  | { type: "table"; lines: string[] };

export function segmentLinesWithMarkdownTables(
  lines: string[]
): MarkdownLineSegment[] {
  const segments: MarkdownLineSegment[] = [];
  let i = 0;
  while (i < lines.length) {
    if (
      i + 1 < lines.length &&
      isMarkdownTablePipeRow(lines[i]) &&
      !isMarkdownTableSeparatorLine(lines[i]) &&
      isMarkdownTableSeparatorLine(lines[i + 1])
    ) {
      const tableLines: string[] = [lines[i], lines[i + 1]];
      let j = i + 2;
      while (j < lines.length && isMarkdownTablePipeRow(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }
      segments.push({ type: "table", lines: tableLines });
      i = j;
    } else {
      segments.push({ type: "line", line: lines[i] });
      i++;
    }
  }
  return segments;
}

export function buildOpenXmlTableFromMarkdown(
  xmlDoc: Document,
  tableLines: string[],
  normalRPr: Element | null
): Element {
  const headerCells = parseMarkdownTableRowCells(tableLines[0]);
  const alignments = parseMarkdownTableAlignments(tableLines[1]);
  const dataRows = tableLines
    .slice(2)
    .filter((l) => !isMarkdownTableSeparatorLine(l))
    .map(parseMarkdownTableRowCells);

  const colCount = Math.max(
    headerCells.length,
    alignments.length,
    ...dataRows.map((r) => r.length),
    1
  );
  const totalWidthDxa = 9000;
  const colWidthDxa = Math.max(500, Math.floor(totalWidthDxa / colCount));

  const tbl = xmlDoc.createElement("w:tbl");

  // 1. <w:tblPr> com largura A4 útil, bordas corporativas CBD5E1 e padding interno
  const tblPr = xmlDoc.createElement("w:tblPr");
  const tblW = xmlDoc.createElement("w:tblW");
  tblW.setAttribute("w:w", String(totalWidthDxa));
  tblW.setAttribute("w:type", "dxa");
  tblPr.appendChild(tblW);

  const tblBorders = xmlDoc.createElement("w:tblBorders");
  for (const side of ["top", "left", "bottom", "right", "insideH", "insideV"]) {
    const bEl = xmlDoc.createElement(`w:${side}`);
    bEl.setAttribute("w:val", "single");
    bEl.setAttribute("w:sz", "4");
    bEl.setAttribute("w:space", "0");
    bEl.setAttribute("w:color", "CBD5E1");
    tblBorders.appendChild(bEl);
  }
  tblPr.appendChild(tblBorders);

  const tblCellMar = xmlDoc.createElement("w:tblCellMar");
  for (const [side, val] of [
    ["top", "80"],
    ["left", "120"],
    ["bottom", "80"],
    ["right", "120"],
  ] as const) {
    const mEl = xmlDoc.createElement(`w:${side}`);
    mEl.setAttribute("w:w", val);
    mEl.setAttribute("w:type", "dxa");
    tblCellMar.appendChild(mEl);
  }
  tblPr.appendChild(tblCellMar);
  tbl.appendChild(tblPr);

  // 2. <w:tblGrid>
  const tblGrid = xmlDoc.createElement("w:tblGrid");
  for (let c = 0; c < colCount; c++) {
    const gridCol = xmlDoc.createElement("w:gridCol");
    gridCol.setAttribute("w:w", String(colWidthDxa));
    tblGrid.appendChild(gridCol);
  }
  tbl.appendChild(tblGrid);

  // 3. Linha de Cabeçalho (R0) com <w:tblHeader/>, sombreado F1F5F9 e negrito <w:b/>
  const headerTr = xmlDoc.createElement("w:tr");
  const headerTrPr = xmlDoc.createElement("w:trPr");
  headerTrPr.appendChild(xmlDoc.createElement("w:tblHeader"));
  headerTr.appendChild(headerTrPr);

  const headerBoldRPr = addBoldToRPr(xmlDoc, normalRPr);

  for (let c = 0; c < colCount; c++) {
    const tc = xmlDoc.createElement("w:tc");
    const tcPr = xmlDoc.createElement("w:tcPr");
    const tcW = xmlDoc.createElement("w:tcW");
    tcW.setAttribute("w:w", String(colWidthDxa));
    tcW.setAttribute("w:type", "dxa");
    tcPr.appendChild(tcW);

    const shd = xmlDoc.createElement("w:shd");
    shd.setAttribute("w:val", "clear");
    shd.setAttribute("w:color", "auto");
    shd.setAttribute("w:fill", "F1F5F9");
    tcPr.appendChild(shd);
    tc.appendChild(tcPr);

    const p = xmlDoc.createElement("w:p");
    const pPr = xmlDoc.createElement("w:pPr");
    const jc = xmlDoc.createElement("w:jc");
    jc.setAttribute("w:val", alignments[c] ?? "left");
    pPr.appendChild(jc);
    p.appendChild(pPr);

    const rawHdr = (headerCells[c] ?? "").trim();
    const cleanHdr =
      rawHdr.startsWith("**") && rawHdr.endsWith("**") && rawHdr.length > 4
        ? rawHdr.slice(2, -2)
        : rawHdr;
    appendRichTextRunsToParagraph(xmlDoc, p, cleanHdr, headerBoldRPr);
    tc.appendChild(p);
    headerTr.appendChild(tc);
  }
  tbl.appendChild(headerTr);

  // 4. Linhas de Dados (R1..RN)
  for (const rowCells of dataRows) {
    const tr = xmlDoc.createElement("w:tr");
    for (let c = 0; c < colCount; c++) {
      const tc = xmlDoc.createElement("w:tc");
      const tcPr = xmlDoc.createElement("w:tcPr");
      const tcW = xmlDoc.createElement("w:tcW");
      tcW.setAttribute("w:w", String(colWidthDxa));
      tcW.setAttribute("w:type", "dxa");
      tcPr.appendChild(tcW);
      tc.appendChild(tcPr);

      const p = xmlDoc.createElement("w:p");
      const pPr = xmlDoc.createElement("w:pPr");
      const jc = xmlDoc.createElement("w:jc");
      jc.setAttribute("w:val", alignments[c] ?? "left");
      pPr.appendChild(jc);
      p.appendChild(pPr);

      const cellText = (rowCells[c] ?? "").trim();
      appendRichTextRunsToParagraph(xmlDoc, p, cellText, normalRPr);
      tc.appendChild(p);
      tr.appendChild(tc);
    }
    tbl.appendChild(tr);
  }

  return tbl;
}

export function ensureTableCellEndsWithParagraph(xmlDoc: Document, tc: Node): void {
  if (!isElementMatch(tc, "w:tc")) return;
  const childElements = getDirectChildElements(tc);
  if (
    childElements.length === 0 ||
    !isElementMatch(childElements[childElements.length - 1], "w:p")
  ) {
    tc.appendChild(xmlDoc.createElement("w:p"));
  }
}

export function convertSiblingParagraphMarkdownTables(xmlDoc: Document): boolean {
  let modified = false;
  const containers: Element[] = [
    ...getAllElements(xmlDoc, "w:body"),
    ...getAllElements(xmlDoc, "w:tc"),
  ];

  for (const container of containers) {
    const directChildren = getDirectChildElements(container);
    let i = 0;
    while (i < directChildren.length) {
      const child = directChildren[i];
      if (!isElementMatch(child, "w:p")) {
        i++;
        continue;
      }
      const line0 = extractParagraphText(child);
      if (
        i + 1 < directChildren.length &&
        isElementMatch(directChildren[i + 1], "w:p") &&
        isMarkdownTablePipeRow(line0) &&
        !isMarkdownTableSeparatorLine(line0)
      ) {
        const line1 = extractParagraphText(directChildren[i + 1]);
        if (isMarkdownTableSeparatorLine(line1)) {
          const tableLines: string[] = [line0, line1];
          const tableParas: Element[] = [child, directChildren[i + 1]];
          let j = i + 2;
          while (
            j < directChildren.length &&
            isElementMatch(directChildren[j], "w:p")
          ) {
            const nextLine = extractParagraphText(directChildren[j]);
            if (isMarkdownTablePipeRow(nextLine)) {
              tableLines.push(nextLine);
              tableParas.push(directChildren[j]);
              j++;
            } else {
              break;
            }
          }

          const detectedRPr = findBodyRunProperties(tableParas);
          const normalRPr = detectedRPr ? stripBoldFromRPr(detectedRPr) : null;
          const tblEl = buildOpenXmlTableFromMarkdown(
            xmlDoc,
            tableLines,
            normalRPr
          );

          container.insertBefore(tblEl, child);
          for (const tp of tableParas) {
            if (tp.parentNode === container) {
              container.removeChild(tp);
            }
          }
          ensureTableCellEndsWithParagraph(xmlDoc, container);
          modified = true;
          i = j;
          continue;
        }
      }
      i++;
    }
  }

  return modified;
}

export function autoRedirectGeometricCheckboxCells(xmlDoc: Document): boolean {
  let modified = false;
  const tables = getAllElements(xmlDoc, "w:tbl");

  for (const tbl of tables) {
    const rows = getDirectChildElements(tbl, "w:tr");
    for (const tr of rows) {
      const cells = getDirectChildElements(tr, "w:tc");
      if (cells.length < 2) continue;

      for (let i = 0; i < cells.length - 1; i++) {
        const cK = cells[i];
        const cNext = cells[i + 1];

        const vMergeK = extractCellVMerge(cK);
        if (vMergeK === "continue") continue;

        const kColSpan = extractCellGridSpan(cK);
        if (kColSpan > 2) continue;

        const textK = extractCellText(cK).trim();
        if (textK.length <= 45) continue;

        const nextColSpan = extractCellGridSpan(cNext);
        if (nextColSpan < 3 && cells.length > 3) continue;

        const textNext = extractCellText(cNext).trim();
        const isNextShortBoilerplate =
          textNext.length <= 35 &&
          /^(?:especificar|justificar|observa[çc][ãa]o|descri[çc][ãa]o|indicar|se\s+sim|n[ãa]o\s+se\s+aplica|caso\s+afirmativo|\s*)[.:\s\-—]*$/i.test(
            textNext
          );

        if (isNextShortBoilerplate) {
          const pListK = getDirectChildElements(cK, "w:p");
          if (pListK.length > 0) {
            const pListNext = getDirectChildElements(cNext, "w:p");
            for (const pNext of pListNext) {
              cNext.removeChild(pNext);
            }
            for (const p of pListK) {
              cNext.appendChild(p);
            }
            setTableCellSingleParagraphText(xmlDoc, cK, "☒ Sim.");
            ensureTableCellEndsWithParagraph(xmlDoc, cNext);
            modified = true;
          }
        }
      }
    }
  }

  return modified;
}

