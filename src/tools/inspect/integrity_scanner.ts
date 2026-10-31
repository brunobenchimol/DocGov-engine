import type {
  DocxInspectionResult,
  PostCompileIntegrityAlert,
} from "../../types/index.ts";
import { detectTableSubtablesAndCheckboxes } from "./document_pipelines.ts";

// ============================================================================
// Scanner de Integridade Pós-Compilação e Anti-Contaminação (ENG-08, 13, 15)
// ============================================================================

export function scanPostCompileIntegrityAlerts(
  inspection: DocxInspectionResult
): PostCompileIntegrityAlert[] {
  const alerts: PostCompileIntegrityAlert[] = [];

  // 1. Detecção de "Item não aplicável" / workarounds de linhas excedentes não removidas (ENG-07 / ENG-08)
  const workaroundRegex =
    /\b(?:item\s+n[ãa]o\s+aplic[áa]vel|n[ãa]o\s+aplic[áa]vel\s+ao\s+escopo|item\s+suprimido|linha\s+n[ãa]o\s+utilizada)\b/i;

  for (const tbl of inspection.tables || []) {
    const affectedRows: number[] = [];
    const affectedCoords: string[] = [];
    for (const r of tbl.rows) {
      const physicalCells = r.cells.filter((c) => !c.isSpanPlaceholder);
      for (const c of physicalCells) {
        if (c.rowSpan === "continue") continue;
        if (workaroundRegex.test(c.text)) {
          affectedRows.push(r.rowIndex);
          affectedCoords.push(
            `T${tbl.index}.R${r.rowIndex}.C${c.physicalCellIndex ?? c.cellIndex}`
          );
          break;
        }
      }
    }
    if (affectedRows.length > 0) {
      const minRow = Math.min(...affectedRows);
      const maxRow = Math.max(...affectedRows);
      alerts.push({
        code: "UNREMOVED_ITEM_WORKAROUND",
        severity: "CRITICAL",
        coords: affectedCoords.slice(0, 8),
        message: `Detectadas ${affectedRows.length} linha(s) de tabela preenchidas com workaround textual ("Item não aplicável") em T${tbl.index}.R${minRow}..R${maxRow} em vez de exclusão física da linha.`,
        remediation_hint: `Adicione "remove_table_rows": [{ "table_index": ${tbl.index}, "from_row": ${minRow}, "to_row": ${maxRow} }] no slots_manifest.json e regere o template com build_docx_template.`,
      });
    }
  }

  // 2. Detecção de tabelas Markdown residuais não convertidas (| :--- |)
  const rawMdCoords: string[] = [];
  const rawMdSeparatorRegex = /\|\s*:?-{3,}:?\s*\|/;
  for (const p of inspection.paragraphs || []) {
    if (rawMdSeparatorRegex.test(p.text)) {
      rawMdCoords.push(`P${p.index}`);
    }
  }
  for (const tbl of inspection.tables || []) {
    for (const r of tbl.rows) {
      for (const c of r.cells.filter((cell) => !cell.isSpanPlaceholder)) {
        if (c.rowSpan === "continue") continue;
        if (rawMdSeparatorRegex.test(c.text)) {
          rawMdCoords.push(
            `T${tbl.index}.R${r.rowIndex}.C${c.physicalCellIndex ?? c.cellIndex}`
          );
        }
      }
    }
  }
  if (rawMdCoords.length > 0) {
    alerts.push({
      code: "RAW_MARKDOWN_TABLE",
      severity: "CRITICAL",
      coords: rawMdCoords.slice(0, 8),
      message: `Detectada sintaxe de tabela Markdown crua ('| :--- |') não convertida em OpenXML <w:tbl> nas coordenadas: ${rawMdCoords.slice(0, 5).join(", ")}.`,
      remediation_hint: `Garanta que a tabela Markdown possua linha de cabeçalho e linha separadora '| :--- | :--- |' contíguas e reprocesse via fill_docx_template.`,
    });
  }

  // 3. Detecção de Checkboxes Contraditórios (☒ Sim e ☒ Não marcados juntos, ou ambos ☐ em documento compilado)
  const allDocText = [
    ...(inspection.paragraphs || []).map((p) => p.text),
    ...(inspection.tables || []).flatMap((t) =>
      t.rows.flatMap((r) =>
        r.cells.filter((c) => !c.isSpanPlaceholder).map((c) => c.text)
      )
    ),
  ].join("\n");
  const hasUncompiledTags = /\{\{[A-Z0-9_]+\}\}/.test(allDocText);

  const checkboxes =
    inspection.detected_checkboxes ??
    detectTableSubtablesAndCheckboxes(inspection.tables || []).checkboxes;

  for (const group of checkboxes) {
    const simOpt = group.options.find((o) => /^sim$/i.test(o.label));
    const naoOpt = group.options.find((o) => /^n[ãa]o$/i.test(o.label));
    if (simOpt && naoOpt) {
      if (simOpt.checked && naoOpt.checked) {
        alerts.push({
          code: "CONTRADICTORY_CHECKBOXES",
          severity: "CRITICAL",
          coords: Array.from(new Set([simOpt.coord, naoOpt.coord])),
          message: `Checkboxes contraditórios marcados simultaneamente (☒ Sim e ☒ Não) para '${group.prompt}' (${simOpt.coord} e ${naoOpt.coord}).`,
          remediation_hint: `Mapeie ambas as coordenadas físicas (${simOpt.coord} e ${naoOpt.coord}) no slots_manifest.json e desmarque a opção incorreta com '☐'.`,
        });
      } else if (!simOpt.checked && !naoOpt.checked && !hasUncompiledTags) {
        alerts.push({
          code: "CONTRADICTORY_CHECKBOXES",
          severity: "HIGH",
          coords: Array.from(new Set([simOpt.coord, naoOpt.coord])),
          message: `Grupo de checkboxes (☐ Sim / ☐ Não) sem nenhuma opção assinalada para '${group.prompt}' (${simOpt.coord} e ${naoOpt.coord}).`,
          remediation_hint: `Assinale '☒ Sim' ou '☒ Não' na coordenada física correspondente (${simOpt.coord} ou ${naoOpt.coord}).`,
        });
      }
    }
  }

  // 4. Detecção de Contaminação Semântica de Doador de Hardware (ENG-08 com Refinamento de 2 Pontas)
  const objectSegments: string[] = [];
  for (let i = 0; i < (inspection.paragraphs || []).length; i++) {
    const p = inspection.paragraphs[i];
    if (/objeto|descri[çc][ãa]o\s+da\s+solu[çc][ãa]o|especifica[çc][ãa]o\s+do\s+objeto/i.test(p.text)) {
      objectSegments.push(p.text);
      if (i + 1 < inspection.paragraphs.length) {
        objectSegments.push(inspection.paragraphs[i + 1].text);
      }
    }
  }
  if ((inspection.tables || []).length > 0) {
    const t0 = inspection.tables[0];
    for (const r of t0.rows.slice(0, 12)) {
      const rowTxt = r.cells
        .filter((c) => !c.isSpanPlaceholder && c.rowSpan !== "continue")
        .map((c) => c.text.trim())
        .join(" ");
      if (
        /1\.1\b|objeto|natureza|descri[çc][ãa]o|subscri[çc][ãa]o|licenciamento|software|equipamento|appliance|servidor/i.test(
          rowTxt
        )
      ) {
        objectSegments.push(rowTxt);
      }
    }
  }

  const objectCorpus =
    objectSegments.length > 0
      ? objectSegments.join(" ")
      : (inspection.paragraphs || [])
          .slice(0, 10)
          .map((p) => p.text)
          .join(" ");

  const hasSoftwareServiceObject =
    /\b(?:subscri[çc][ãa]o|subscri[çc][õo]es|licen[çc]a|licenciamento|software|saas|paas|red\s*hat|openshift|ansible|rhel|treinamento|capacita[çc][ãa]o|suporte\s+t[ée]cnico|consultoria|ust|uns)\b/i.test(
      objectCorpus
    );
  const hasHardwareInObject =
    /\b(?:servidor(?:es)?\s+f[ií]sico|appliance(?:s)?|equipamento(?:s)?\s+de\s+inform[áa]tica|switch(?:es)?|storage\s+f[ií]sico|rack|chassi|blade|hci|hiperconverg[êe]n|nutanix|exagrid|fonte\s+redundante|gabinete)\b/i.test(
      objectCorpus
    );

  const isPureSoftwareServiceObject =
    hasSoftwareServiceObject && !hasHardwareInObject;

  const hardwareDonorTermsRegex =
    /\b(?:RoHS|merc[úu]rio|chumbo|c[áa]dmio|Portaria\s+n[º°]?\s*170|INMETRO|ANATEL|NVMe|DDR4|DDR5|SFP\+|escassez\s+global\s+de\s+chips|Next\s+Business\s+Day|Nvidia\s+RTX)\b/i;

  const isRedHatDoc = /\b(?:Red\s*Hat|OpenShift|RHEL|Ansible)\b/i.test(allDocText);
  const specificDonorLeakRegex = isRedHatDoc
    ? /(?:ARP\s*(?:N[º°]?\s*)?90015\/2024|R\$\s*68\.776\.988,00|\bPAN-OS\b|\bCollector\b)/i
    : /(?:ARP\s*(?:N[º°]?\s*)?90015\/2024|R\$\s*68\.776\.988,00)/i;

  const contaminatedCoords: string[] = [];
  const matchedTerms = new Set<string>();

  const inspectSegmentForContamination = (coord: string, text: string) => {
    if (!text) return;
    if (isPureSoftwareServiceObject) {
      const mHw = text.match(hardwareDonorTermsRegex);
      if (mHw) {
        contaminatedCoords.push(coord);
        matchedTerms.add(mHw[0]);
      }
    }
    const mLeak = text.match(specificDonorLeakRegex);
    if (mLeak) {
      if (!contaminatedCoords.includes(coord)) contaminatedCoords.push(coord);
      matchedTerms.add(mLeak[0]);
    }
  };

  for (const p of inspection.paragraphs || []) {
    inspectSegmentForContamination(`P${p.index}`, p.text);
  }
  for (const tbl of inspection.tables || []) {
    for (const r of tbl.rows) {
      for (const c of r.cells.filter((cell) => !cell.isSpanPlaceholder)) {
        if (c.rowSpan === "continue") continue;
        inspectSegmentForContamination(
          `T${tbl.index}.R${r.rowIndex}.C${c.physicalCellIndex ?? c.cellIndex}`,
          c.text
        );
      }
    }
  }

  const hasHardwareAffirmation =
    /possui\s+(?:equipamentos|bens\s+de\s+inform[áa]tica)\s*\(?hardware\)?|aquisi[çc][ãa]o\s+de\s+equipamentos\s*\(?hardware\)?/i.test(
      allDocText
    );
  const hasStrictIntangibleAffirmation =
    /natureza\s+estritamente\s+intang[ií]vel|exclusivamente\s+de\s+software\s+e\s+servi[çc]os\s+intang[ií]veis/i.test(
      allDocText
    );

  if (hasHardwareAffirmation && hasStrictIntangibleAffirmation) {
    matchedTerms.add(
      "Contradição interna: afirmação de 'hardware/equipamentos' coexistindo com 'natureza estritamente intangível'"
    );
  }

  if (contaminatedCoords.length > 0 || (hasHardwareAffirmation && hasStrictIntangibleAffirmation)) {
    alerts.push({
      code: "HARDWARE_DONOR_CONTAMINATION",
      severity: "CRITICAL",
      coords: contaminatedCoords.slice(0, 10),
      message: `Detectado vazamento de vocabulário de minuta doadora de Hardware/Ata externa em contratação de Software/Serviços (${Array.from(
        matchedTerms
      )
        .slice(0, 6)
        .join(", ")}) nas coordenadas: ${
        contaminatedCoords.slice(0, 6).join(", ") || "corpo do documento"
      }.`,
      remediation_hint: `Mapeie todas as células/parágrafos residuais listados acima no slots_manifest.json e substitua o texto herdado do modelo doador pelo conteúdo aderente ao objeto da contratação.`,
    });
  }

  // 5. Detecção de Contaminação Parcial em Linhas de Itens (ENG-13: PARTIAL_ITEM_ROW_CONTAMINATION)
  const itemRowContaminatedCoords: string[] = [];
  const itemRowMatchedTerms = new Set<string>();
  const hardwareUnitRegex = /\b(?:servidor(?:es)?|GB|TB|Rack|chassi|blade|gabinete)\b/i;
  const softwareItemRegex = /\b(?:UNS|UST|Subscri[çc][ãa]o|Licen[çc]a|Software|RHEL|OpenShift|Ansible)\b/i;

  for (const tbl of inspection.tables || []) {
    for (const r of tbl.rows) {
      const physicalCells = r.cells.filter(
        (c) => !c.isSpanPlaceholder && c.rowSpan !== "continue"
      );
      if (physicalCells.length < 3) continue;

      const hasSoftware = physicalCells.some((c) => softwareItemRegex.test(c.text));
      if (!hasSoftware) continue;

      for (const c of physicalCells) {
        if (c.text.trim().length <= 25 && hardwareUnitRegex.test(c.text)) {
          const m = c.text.match(hardwareUnitRegex);
          if (m) {
            itemRowContaminatedCoords.push(
              `T${tbl.index}.R${r.rowIndex}.C${c.physicalCellIndex ?? c.cellIndex}`
            );
            itemRowMatchedTerms.add(m[0]);
          }
        }
      }
    }
  }

  if (itemRowContaminatedCoords.length > 0) {
    alerts.push({
      code: "PARTIAL_ITEM_ROW_CONTAMINATION",
      severity: "HIGH",
      coords: itemRowContaminatedCoords.slice(0, 10),
      message: `Detectada contaminação parcial em linha de item: células de unidade/métrica contêm resíduo de hardware (${Array.from(
        itemRowMatchedTerms
      ).join(", ")}) em item de software/serviço nas coordenadas: ${itemRowContaminatedCoords
        .slice(0, 6)
        .join(", ")}.`,
      remediation_hint: `Substitua a unidade de hardware do doador pela métrica de software contratada (ex.: UNS, UST, Subscrição, Mês) no slots_manifest.json.`,
    });
  }

  // 6. Detecção de Linhas de Total Geral Zeradas ou Indefinidas (ENG-13: UNCALCULATED_TOTAL_ROW)
  for (const tbl of inspection.tables || []) {
    let hasNonZeroItems = false;
    let totalRowCoord: string | undefined;

    for (const r of tbl.rows) {
      const rowText = r.cells
        .filter((c) => !c.isSpanPlaceholder && c.rowSpan !== "continue")
        .map((c) => c.text.trim())
        .join(" ");

      const isTotalRow = /\b(?:TOTAL\s+GERAL|VALOR\s+TOTAL(?:\s+GERAL)?|TOTAL\s+GLOBAL)\b/i.test(
        rowText
      );

      if (isTotalRow) {
        const isZeroOrUndefined =
          /R\$\s*0(?:,00)?\b|\b0,00\b|\[A\s+DEFINIR\]|\bA\s+DEFINIR\b/i.test(
            rowText
          );
        if (isZeroOrUndefined) {
          totalRowCoord = `T${tbl.index}.R${r.rowIndex}`;
        }
      } else {
        if (
          /R\$\s*[1-9]\d*(?:[.,]\d{2})?|\b(?:UNS|UST|Subscri[çc][ãa]o)\b/i.test(
            rowText
          )
        ) {
          hasNonZeroItems = true;
        }
      }
    }

    if (totalRowCoord && hasNonZeroItems) {
      alerts.push({
        code: "UNCALCULATED_TOTAL_ROW",
        severity: "HIGH",
        coords: [totalRowCoord],
        message: `Linha de total ${totalRowCoord} está zerada ou indefinida (R$ 0,00 / [A DEFINIR]), divergindo do somatório dos itens da tabela.`,
        remediation_hint: `Calcule o somatório total dos itens no estado_caso.json ou slots_manifest.json para que a linha de Total Geral reflita o valor real da contratação.`,
      });
    }
  }

  // 7. Detecção de Anomalia de Reset de Numeração Multinível (ENG-15: MULTILEVEL_NUMBERING_RESET)
  const resetCoords: string[] = [];
  let currentActiveSectionNum: number | null = null;

  for (const p of inspection.paragraphs || []) {
    const text = p.text.trim();
    if (!text) continue;

    const sectionMatch = text.match(
      /^(\d+(?:\.\d+)*)(?:\.|\s*[-–—:]|\s+)\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s\-_/–—,.:;()'"ºª§]{2,})/
    );
    if (sectionMatch) {
      const secNum = parseInt(sectionMatch[1].split(".")[0], 10);
      const title = sectionMatch[2].trim();
      if (
        title === title.toUpperCase() ||
        /^(?:JUSTIFICATIVA|MOTIVA[ÇC][ÃA]O|OBJETO|ESPECIFICA|CRIT[EÉ]RIO|MODELO|GEST[AÃ]O|OBRIGA|RECEBIMENTO|PAGAMENTO|SAN[CÇ]|DISPOSI|GLOSS|ESTIMATIVA|VALOR|EQUIPE|VISTORIA|AMOSTRA|MATRIZ|SLA|N[IÍ]VEL|VIG[EÊ]NCIA|FISCALIZA|INFRAESTRUTURA|REQUISITO)/i.test(
          title
        )
      ) {
        currentActiveSectionNum = secNum;
        continue;
      }
    }

    if (currentActiveSectionNum !== null && currentActiveSectionNum >= 2) {
      if (/^\s*(?:\*\*)?1\.1(?:\.1)?[\.\-\)\s]/i.test(text)) {
        resetCoords.push(`P${p.index}`);
      }
    }
  }

  if (resetCoords.length > 0) {
    alerts.push({
      code: "MULTILEVEL_NUMBERING_RESET",
      severity: "HIGH",
      coords: resetCoords.slice(0, 8),
      message: `Detectada anomalia de numeração multinível: parágrafo(s) iniciando em '1.1.' sob seção de nível superior >= 2 nas coordenadas: ${resetCoords
        .slice(0, 6)
        .join(", ")}.`,
      remediation_hint: `Reancorar numeração relativa com o prefixo da seção ativa ou aplicar hanging indent literal.`,
    });
  }

  // 8. Detecção de Tabelas de SLA Duplicadas e Divergentes (ENG-15: DUPLICATE_CONFLICTING_SLA_TABLES)
  interface SlaTableInfo {
    tableIndex: number;
    severity1Text: string;
    hours: number;
  }
  const detectedSlaTables: SlaTableInfo[] = [];

  for (const tbl of inspection.tables || []) {
    let isSlaTable = false;
    let foundSev1Text: string | null = null;
    let foundSev1Hours: number | null = null;

    for (const r of tbl.rows) {
      const rowText = r.cells
        .filter((c) => !c.isSpanPlaceholder && c.rowSpan !== "continue")
        .map((c) => c.text.trim())
        .join(" ");

      if (
        /\b(?:severidade|sla|tempo\s+de\s+(?:resposta|solu[çc][ãa]o|atendimento)|chamado(?:s)?)\b/i.test(
          rowText
        )
      ) {
        isSlaTable = true;
      }

      if (
        /\b(?:severidade\s*1|cr[ií]tic[ao]|urgente|n[ií]vel\s*1)\b/i.test(rowText)
      ) {
        const timeMatch = rowText.match(
          /\b(\d+)\s*(?:horas?|h\b|minutos?|min\b)/i
        );
        if (timeMatch && !foundSev1Text) {
          foundSev1Text = timeMatch[0];
          const val = parseInt(timeMatch[1], 10);
          const isMin = /min/i.test(timeMatch[0]);
          foundSev1Hours = isMin ? val / 60 : val;
        }
      }
    }

    if (isSlaTable && foundSev1Text && foundSev1Hours !== null) {
      detectedSlaTables.push({
        tableIndex: tbl.index,
        severity1Text: foundSev1Text,
        hours: foundSev1Hours,
      });
    }
  }

  if (detectedSlaTables.length >= 2) {
    for (let i = 0; i < detectedSlaTables.length - 1; i++) {
      for (let j = i + 1; j < detectedSlaTables.length; j++) {
        const t1 = detectedSlaTables[i];
        const t2 = detectedSlaTables[j];
        if (Math.abs(t1.hours - t2.hours) >= 0.5) {
          alerts.push({
            code: "DUPLICATE_CONFLICTING_SLA_TABLES",
            severity: "HIGH",
            coords: [`T${t1.tableIndex}`, `T${t2.tableIndex}`],
            message: `Detectadas tabelas distintas de SLA de Atendimento com prazos divergentes para Severidade 1 (T${t1.tableIndex}: '${t1.severity1Text}' vs T${t2.tableIndex}: '${t2.severity1Text}').`,
            remediation_hint: `Verificar se há tabela residual de SLA herdada do modelo doador e remover linhas divergentes com remove_table_rows ou harmonizar prazos.`,
          });
          break;
        }
      }
    }
  }

  return alerts;
}
