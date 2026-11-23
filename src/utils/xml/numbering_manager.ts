import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import {
  sanitizeXmlString,
  getDirectChildElements,
  getAllElements,
} from "./dom_and_tags.ts";
import { ensureContentTypesOverride } from "./formatting_and_inline.ts";

// ============================================================================
// Motor de Lista Multinível Nativa (word/numbering.xml + NumberingResolver v0.7.0)
// ============================================================================

const NUMBERING_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml";
const NUMBERING_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering";
const WORD_MAIN_NS =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export class NumberingManager {
  private xmlDoc: Document;
  private root: Element;
  private nextAbstractNumId: number = 100;
  private nextNumId: number = 100;
  private modified: boolean = false;

  constructor(existingXmlStr?: string | null) {
    const parser = new DOMParser();
    const cleanExisting = sanitizeXmlString(existingXmlStr || "");
    if (cleanExisting && cleanExisting.trim()) {
      this.xmlDoc = parser.parseFromString(cleanExisting, "application/xml");
      const existingRoot =
        getAllElements(this.xmlDoc, "w:numbering")[0] ??
        this.xmlDoc.documentElement;
      if (existingRoot) {
        this.root = existingRoot;
      } else {
        this.xmlDoc = parser.parseFromString(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:numbering xmlns:w="${WORD_MAIN_NS}"/>`,
          "application/xml"
        );
        this.root = this.xmlDoc.documentElement!;
      }
    } else {
      this.xmlDoc = parser.parseFromString(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:numbering xmlns:w="${WORD_MAIN_NS}"/>`,
        "application/xml"
      );
      this.root = this.xmlDoc.documentElement!;
    }

    // Descobre os maiores IDs já existentes para preservar 100% das listas originais
    const abstractNums = getDirectChildElements(this.root, "w:abstractNum");
    for (const an of abstractNums) {
      const idVal = parseInt(
        an.getAttribute("w:abstractNumId") ||
          an.getAttribute("abstractNumId") ||
          "0",
        10
      );
      if (!isNaN(idVal) && idVal >= this.nextAbstractNumId) {
        this.nextAbstractNumId = idVal + 1;
      }
    }

    const nums = getDirectChildElements(this.root, "w:num");
    for (const n of nums) {
      const idVal = parseInt(
        n.getAttribute("w:numId") || n.getAttribute("numId") || "0",
        10
      );
      if (!isNaN(idVal) && idVal >= this.nextNumId) {
        this.nextNumId = idVal + 1;
      }
    }
  }

  public isModified(): boolean {
    return this.modified;
  }

  /**
   * Cria um <w:abstractNum> de 9 níveis (%1. até %1..%9.) e um <w:num> com <w:startOverride>
   * sincronizado com o capítulo pai (e subníveis iniciais opcionais).
   */
  public createMultilevelDecimalNum(
    chapterStart: number,
    initialSegments?: number[]
  ): string {
    const safeChapter =
      Number.isFinite(chapterStart) && chapterStart >= 1
        ? Math.floor(chapterStart)
        : 1;
    const abstractNumId = String(this.nextAbstractNumId++);
    const numId = String(this.nextNumId++);

    const abstractNumEl = this.xmlDoc.createElement("w:abstractNum");
    abstractNumEl.setAttribute("w:abstractNumId", abstractNumId);

    const multiLevelType = this.xmlDoc.createElement("w:multiLevelType");
    multiLevelType.setAttribute("w:val", "multilevel");
    abstractNumEl.appendChild(multiLevelType);

    for (let ilvl = 0; ilvl <= 8; ilvl++) {
      const lvlEl = this.xmlDoc.createElement("w:lvl");
      lvlEl.setAttribute("w:ilvl", String(ilvl));

      const startEl = this.xmlDoc.createElement("w:start");
      const levelStart =
        ilvl === 0
          ? safeChapter
          : initialSegments &&
              initialSegments.length > ilvl &&
              initialSegments[ilvl] >= 1
            ? initialSegments[ilvl]
            : 1;
      startEl.setAttribute("w:val", String(levelStart));
      lvlEl.appendChild(startEl);

      const numFmtEl = this.xmlDoc.createElement("w:numFmt");
      numFmtEl.setAttribute("w:val", "decimal");
      lvlEl.appendChild(numFmtEl);

      const suffEl = this.xmlDoc.createElement("w:suff");
      suffEl.setAttribute("w:val", "tab");
      lvlEl.appendChild(suffEl);

      const placeholders: string[] = [];
      for (let k = 1; k <= ilvl + 1; k++) {
        placeholders.push(`%${k}`);
      }
      const lvlTextEl = this.xmlDoc.createElement("w:lvlText");
      lvlTextEl.setAttribute("w:val", `${placeholders.join(".")}.`);
      lvlEl.appendChild(lvlTextEl);

      const lvlJcEl = this.xmlDoc.createElement("w:lvlJc");
      lvlJcEl.setAttribute("w:val", "left");
      lvlEl.appendChild(lvlJcEl);

      // Recuos escalonados em twips para os 9 níveis
      const leftTwips = (ilvl + 1) * 360;
      const hangingTwips = Math.min(360 + ilvl * 120, leftTwips);

      const pPrEl = this.xmlDoc.createElement("w:pPr");
      const tabsEl = this.xmlDoc.createElement("w:tabs");
      const tabEl = this.xmlDoc.createElement("w:tab");
      tabEl.setAttribute("w:val", "num");
      tabEl.setAttribute("w:pos", String(leftTwips));
      tabsEl.appendChild(tabEl);
      pPrEl.appendChild(tabsEl);

      const indEl = this.xmlDoc.createElement("w:ind");
      indEl.setAttribute("w:left", String(leftTwips));
      indEl.setAttribute("w:hanging", String(hangingTwips));
      pPrEl.appendChild(indEl);

      lvlEl.appendChild(pPrEl);
      abstractNumEl.appendChild(lvlEl);
    }

    // Insere <w:abstractNum> antes do primeiro <w:num> para respeitar a ordem do schema OOXML
    const firstNum = getDirectChildElements(this.root, "w:num")[0] ?? null;
    if (firstNum) {
      this.root.insertBefore(abstractNumEl, firstNum);
    } else {
      this.root.appendChild(abstractNumEl);
    }

    // Cria <w:num> referenciando o abstractNumId com <w:lvlOverride w:ilvl="0"><w:startOverride>
    const numEl = this.xmlDoc.createElement("w:num");
    numEl.setAttribute("w:numId", numId);

    const absRefEl = this.xmlDoc.createElement("w:abstractNumId");
    absRefEl.setAttribute("w:val", abstractNumId);
    numEl.appendChild(absRefEl);

    const maxOverrideLevel =
      initialSegments && initialSegments.length > 1
        ? Math.min(8, initialSegments.length - 1)
        : 0;

    for (let lvl = 0; lvl <= maxOverrideLevel; lvl++) {
      const overrideVal =
        lvl === 0
          ? safeChapter
          : initialSegments && initialSegments[lvl] >= 1
            ? initialSegments[lvl]
            : 1;
      if (lvl === 0 || overrideVal > 1) {
        const lvlOverrideEl = this.xmlDoc.createElement("w:lvlOverride");
        lvlOverrideEl.setAttribute("w:ilvl", String(lvl));
        const startOverrideEl = this.xmlDoc.createElement("w:startOverride");
        startOverrideEl.setAttribute("w:val", String(overrideVal));
        lvlOverrideEl.appendChild(startOverrideEl);
        numEl.appendChild(lvlOverrideEl);
      }
    }

    this.root.appendChild(numEl);
    this.modified = true;
    return numId;
  }

  public serialize(): string {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(this.xmlDoc);
  }
}

export async function ensureNumberingPart(
  zip: JSZip,
  manager: NumberingManager
): Promise<void> {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  // 1. Grava word/numbering.xml
  zip.file("word/numbering.xml", manager.serialize());

  // 2. Garante Override em [Content_Types].xml
  await ensureContentTypesOverride(zip);
  const ctFile = zip.file("[Content_Types].xml");
  if (ctFile) {
    const ctXmlStr = sanitizeXmlString(await ctFile.async("string"));
    const ctDoc = parser.parseFromString(ctXmlStr, "application/xml");
    const typesRoot =
      getAllElements(ctDoc, "Types")[0] ?? ctDoc.documentElement;
    if (typesRoot) {
      const overrides = getDirectChildElements(typesRoot, "Override");
      let hasNumberingOverride = false;
      for (const ov of overrides) {
        if (ov.getAttribute("PartName") === "/word/numbering.xml") {
          ov.setAttribute("ContentType", NUMBERING_CONTENT_TYPE);
          hasNumberingOverride = true;
          break;
        }
      }
      if (!hasNumberingOverride) {
        const ov = ctDoc.createElement("Override");
        ov.setAttribute("PartName", "/word/numbering.xml");
        ov.setAttribute("ContentType", NUMBERING_CONTENT_TYPE);
        typesRoot.appendChild(ov);
      }
      zip.file("[Content_Types].xml", serializer.serializeToString(ctDoc));
    }
  }

  // 3. Garante Relationship em word/_rels/document.xml.rels
  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  if (!relsFile) {
    const defaultRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdNumbering1" Type="${NUMBERING_REL_TYPE}" Target="numbering.xml"/>
</Relationships>`;
    zip.file(relsPath, defaultRelsXml);
    return;
  }

  const relsXmlStr = sanitizeXmlString(await relsFile.async("string"));
  const relsDoc = parser.parseFromString(relsXmlStr, "application/xml");
  const relsRoot =
    getAllElements(relsDoc, "Relationships")[0] ?? relsDoc.documentElement;
  if (!relsRoot) return;

  const relationships = getDirectChildElements(relsRoot, "Relationship");
  const usedIds = new Set<string>();
  let hasNumberingRel = false;

  for (const rel of relationships) {
    const id = rel.getAttribute("Id");
    if (id) usedIds.add(id);
    const type = rel.getAttribute("Type") || "";
    const target = rel.getAttribute("Target") || "";
    if (
      type === NUMBERING_REL_TYPE ||
      target === "numbering.xml" ||
      target === "/word/numbering.xml"
    ) {
      hasNumberingRel = true;
    }
  }

  if (!hasNumberingRel) {
    let idx = 1;
    while (usedIds.has(`rIdNumbering${idx}`)) {
      idx++;
    }
    const relEl = relsDoc.createElement("Relationship");
    relEl.setAttribute("Id", `rIdNumbering${idx}`);
    relEl.setAttribute("Type", NUMBERING_REL_TYPE);
    relEl.setAttribute("Target", "numbering.xml");
    relsRoot.appendChild(relEl);
    zip.file(relsPath, serializer.serializeToString(relsDoc));
  }
}

export interface NumberingResolver {
  formatParagraphPrefix(numId: string, ilvl: number): string | null;
}

export function createNumberingResolver(
  numberingXmlStr?: string | null
): NumberingResolver {
  interface LevelDef {
    start: number;
    numFmt: string;
    lvlText: string;
  }
  interface AbstractNumDef {
    levels: Map<number, LevelDef>;
  }
  interface NumDef {
    abstractNumId: string;
    startOverrides: Map<number, number>;
  }

  const abstractNums = new Map<string, AbstractNumDef>();
  const nums = new Map<string, NumDef>();
  const activeCounters = new Map<string, Map<number, number>>();

  const cleanNumbering = sanitizeXmlString(numberingXmlStr || "");
  if (cleanNumbering && cleanNumbering.trim()) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanNumbering, "application/xml");
    const root =
      getAllElements(xmlDoc, "w:numbering")[0] ?? xmlDoc.documentElement;

    if (root) {
      for (const an of getDirectChildElements(root, "w:abstractNum")) {
        const absId =
          an.getAttribute("w:abstractNumId") ||
          an.getAttribute("abstractNumId");
        if (!absId) continue;

        const levels = new Map<number, LevelDef>();
        for (const lvl of getDirectChildElements(an, "w:lvl")) {
          const ilvlStr =
            lvl.getAttribute("w:ilvl") || lvl.getAttribute("ilvl");
          if (ilvlStr === null) continue;
          const ilvl = parseInt(ilvlStr, 10);
          if (isNaN(ilvl)) continue;

          const startEl = getDirectChildElements(lvl, "w:start")[0];
          const startVal = parseInt(
            startEl?.getAttribute("w:val") ||
              startEl?.getAttribute("val") ||
              "1",
            10
          );

          const numFmtEl = getDirectChildElements(lvl, "w:numFmt")[0];
          const numFmt =
            numFmtEl?.getAttribute("w:val") ||
            numFmtEl?.getAttribute("val") ||
            "decimal";

          const lvlTextEl = getDirectChildElements(lvl, "w:lvlText")[0];
          const lvlText =
            lvlTextEl?.getAttribute("w:val") ||
            lvlTextEl?.getAttribute("val") ||
            `%${ilvl + 1}.`;

          levels.set(ilvl, {
            start: isNaN(startVal) ? 1 : startVal,
            numFmt,
            lvlText,
          });
        }
        abstractNums.set(absId, { levels });
      }

      for (const n of getDirectChildElements(root, "w:num")) {
        const numId = n.getAttribute("w:numId") || n.getAttribute("numId");
        if (!numId) continue;
        const absRefEl = getDirectChildElements(n, "w:abstractNumId")[0];
        const absId =
          absRefEl?.getAttribute("w:val") || absRefEl?.getAttribute("val");
        if (!absId) continue;

        const startOverrides = new Map<number, number>();
        for (const ov of getDirectChildElements(n, "w:lvlOverride")) {
          const ilvlStr = ov.getAttribute("w:ilvl") || ov.getAttribute("ilvl");
          if (ilvlStr === null) continue;
          const ilvl = parseInt(ilvlStr, 10);
          const startOvEl = getDirectChildElements(ov, "w:startOverride")[0];
          const startOvVal = parseInt(
            startOvEl?.getAttribute("w:val") ||
              startOvEl?.getAttribute("val") ||
              "",
            10
          );
          if (!isNaN(ilvl) && !isNaN(startOvVal)) {
            startOverrides.set(ilvl, startOvVal);
          }
        }

        nums.set(numId, { abstractNumId: absId, startOverrides });
      }
    }
  }

  function getInitialStart(numDef: NumDef, absDef: AbstractNumDef, lvl: number): number {
    if (numDef.startOverrides.has(lvl)) {
      return numDef.startOverrides.get(lvl)!;
    }
    const lvlDef = absDef.levels.get(lvl);
    return lvlDef ? lvlDef.start : 1;
  }

  return {
    formatParagraphPrefix(numId: string, ilvl: number): string | null {
      const numDef = nums.get(numId);
      if (!numDef) return null;
      const absDef = abstractNums.get(numDef.abstractNumId);
      if (!absDef) return null;

      let counters = activeCounters.get(numId);
      if (!counters) {
        counters = new Map<number, number>();
        activeCounters.set(numId, counters);
      }

      // Garante que todos os níveis ancestrais (< ilvl) já estejam inicializados
      // (ex.: quando o bloco começa diretamente em ilvl=1 para "4.1.")
      for (let k = 0; k < ilvl; k++) {
        if (!counters.has(k)) {
          counters.set(k, getInitialStart(numDef, absDef, k));
        }
      }

      // Atualiza o nível atual
      if (!counters.has(ilvl)) {
        counters.set(ilvl, getInitialStart(numDef, absDef, ilvl));
      } else {
        counters.set(ilvl, counters.get(ilvl)! + 1);
      }

      // Reseta níveis mais profundos (> ilvl) para que reiniciem quando voltarem a aparecer
      for (const existingLvl of Array.from(counters.keys())) {
        if (existingLvl > ilvl) {
          counters.delete(existingLvl);
        }
      }

      const lvlDef = absDef.levels.get(ilvl);
      if (!lvlDef || lvlDef.numFmt === "bullet") {
        return null;
      }

      let formatted = lvlDef.lvlText;
      for (let k = 0; k <= ilvl; k++) {
        const val = counters.get(k) ?? getInitialStart(numDef, absDef, k);
        formatted = formatted.replace(new RegExp(`%${k + 1}`, "g"), String(val));
      }

      // Por compatibilidade com o texto limpo de inspect_docx (ex: "1.1 Título" ou "4.1.1 Título"),
      // removemos o ponto final do prefixo em listas multinível (ilvl >= 1) se o lvlText terminar com "."
      if (ilvl >= 1 && formatted.endsWith(".")) {
        formatted = formatted.slice(0, -1);
      }

      return formatted;
    },
  };
}
