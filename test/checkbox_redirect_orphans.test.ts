import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import {
  inspectDocx,
  scanPostCompileIntegrityAlerts,
} from "../src/tools/inspect.ts";
import { buildDocxTemplate } from "../src/tools/build_template.ts";
import { fillDocxTemplate } from "../src/tools/fill_template.ts";
import { createSuiteTempDir } from "./helpers/fixtures.ts";
import type { DocxInspectionResult } from "../src/types/index.ts";

describe("Testes Unitários v1.3.8: Auto-Redirecionamento Geométrico C1->C2 em Checkboxes e Detecção de Órfãos (ENG-11 e ENG-13)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("checkbox_redirect_orphans");

  afterAll(() => {
    cleanup();
  });

  async function createDocxWithCheckboxTable(filePath: string): Promise<void> {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );

    // Tabela T0 com formulário contendo pergunta, C1 com checkbox e C2 com campo discursivo
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>ESTUDO TÉCNICO PRELIMINAR</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>1. Há previsão de subcontratação?</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:gridSpan w:val="1"/></w:tcPr><w:p><w:r><w:t>☐ Sim</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:gridSpan w:val="3"/></w:tcPr><w:p><w:r><w:t>Especificar:</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>Item 1 - Subscrição Red Hat OpenShift</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:gridSpan w:val="1"/></w:tcPr><w:p><w:r><w:t>servidores</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:gridSpan w:val="3"/></w:tcPr><w:p><w:r><w:t>R$ 50.000,00</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:gridSpan w:val="3"/></w:tcPr><w:p><w:r><w:t>TOTAL GERAL DA CONTRATAÇÃO</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:gridSpan w:val="3"/></w:tcPr><w:p><w:r><w:t>R$ 0,00</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

    zip.file("word/document.xml", docXml);
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    writeFileSync(filePath, buf);
  }

  // --------------------------------------------------------------------------
  // 1. ENG-11a: Mapeamento Semântico e Heurística de Checkbox em inspect_doc
  // --------------------------------------------------------------------------
  test("1. ENG-11a: inspectDocx deve mapear C1 como [Checkbox Curto] sugerindo target C2", async () => {
    const rawDocx = resolve(tempDir, "eng11a_raw.docx");
    await createDocxWithCheckboxTable(rawDocx);

    const inspection = await inspectDocx(rawDocx);
    expect(inspection.toc_map).toBeDefined();

    const formFields = inspection.toc_map!.form_fields;
    const checkboxField = formFields.find((f) => f.coord === "T0.R0.C1");
    expect(checkboxField).toBeDefined();
    expect(checkboxField!.title).toContain("[Checkbox Curto]");
    expect(checkboxField!.suggested_target_slot).toBe("T0.R0.C2");

    const discursiveField = formFields.find((f) => f.coord === "T0.R0.C2");
    expect(discursiveField).toBeDefined();
    expect(discursiveField!.title).toContain("[Texto Discursivo / Especificar]");
  });

  // --------------------------------------------------------------------------
  // 2. ENG-11b (Fase 1): Auto-Redirecionamento em build_docx_template
  // --------------------------------------------------------------------------
  test("2. ENG-11b (Fase 1): buildDocxTemplate deve redirecionar tag discursiva de C1 para C2 e marcar C1 como ☒ Sim.", async () => {
    const rawDocx = resolve(tempDir, "eng11b_raw.docx");
    await createDocxWithCheckboxTable(rawDocx);

    const templateDocx = resolve(tempDir, "eng11b_template.docx");
    const manifest = {
      slots: [
        {
          coord: "T0.R0.C1",
          tag: "{{etp.justificativa_subcontratacao}}",
        },
      ],
    };
    const manifestPath = resolve(tempDir, "manifest_eng11b.json");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    const res = await buildDocxTemplate(rawDocx, manifestPath, templateDocx);
    expect(res.applied_slots_count).toBe(1);

    // Inspeciona o template gerado
    const zip = await JSZip.loadAsync(readFileSync(templateDocx));
    const xml = await zip.file("word/document.xml")!.async("string");

    // C1 deve ter ☒ Sim.
    expect(xml).toContain("☒ Sim.");
    // C2 deve ter {{etp.justificativa_subcontratacao}}
    expect(xml).toContain("{{etp.justificativa_subcontratacao}}");
  });

  // --------------------------------------------------------------------------
  // 3. ENG-11b (Fase 2): Auto-Redirecionamento em fill_docx_template
  // --------------------------------------------------------------------------
  test("3. ENG-11b (Fase 2): fillDocxTemplate deve mover texto longo (>45 chars) de C1 para C2 e restaurar ☒ Sim.", async () => {
    // Cria template com tag colocada diretamente em C1 (simulando template manual/legado)
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>ESTUDO TÉCNICO PRELIMINAR</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>1. Há previsão de subcontratação?</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:gridSpan w:val="1"/></w:tcPr><w:p><w:r><w:t>{{etp.justificativa_subcontratacao}}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:gridSpan w:val="3"/></w:tcPr><w:p><w:r><w:t>Especificar:</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;
    zip.file("word/document.xml", docXml);
    const tmplPath = resolve(tempDir, "legacy_checkbox_template.docx");
    writeFileSync(tmplPath, await zip.generateAsync({ type: "nodebuffer" }));

    const statePath = resolve(tempDir, "state_eng11b.json");
    const longText =
      "Admite-se a subcontratação parcial de serviços especializados de sustentação avançada e suporte técnico de Nível 3, conforme facultado pelo Art. 122 da Lei Federal nº 14.133/2021.";
    writeFileSync(
      statePath,
      JSON.stringify(
        {
          etp: {
            justificativa_subcontratacao: longText,
          },
        },
        null,
        2
      ),
      "utf-8"
    );

    const outDocx = resolve(tempDir, "filled_checkbox.docx");
    await fillDocxTemplate(tmplPath, statePath, outDocx);
    expect(existsSync(outDocx)).toBe(true);

    const filledZip = await JSZip.loadAsync(readFileSync(outDocx));
    const filledXml = await filledZip.file("word/document.xml")!.async("string");

    // C1 deve ter sido restaurado para ☒ Sim.
    expect(filledXml).toContain("☒ Sim.");
    // C2 deve ter recebido o texto longo
    expect(filledXml).toContain("Admite-se a subcontratação parcial");
  });

  // --------------------------------------------------------------------------
  // 4. ENG-13: Detector de Células Órfãs e Totais Zerados
  // --------------------------------------------------------------------------
  test("4. ENG-13: scanPostCompileIntegrityAlerts deve detectar PARTIAL_ITEM_ROW_CONTAMINATION e UNCALCULATED_TOTAL_ROW", async () => {
    const rawDocx = resolve(tempDir, "eng13_raw.docx");
    await createDocxWithCheckboxTable(rawDocx);

    const inspection = await inspectDocx(rawDocx);
    const alerts = scanPostCompileIntegrityAlerts(inspection);

    const partialContamination = alerts.find(
      (a) => a.code === "PARTIAL_ITEM_ROW_CONTAMINATION"
    );
    expect(partialContamination).toBeDefined();
    expect(partialContamination!.severity).toBe("HIGH");
    expect(partialContamination!.message).toContain("resíduo de hardware");

    const uncalculatedTotal = alerts.find(
      (a) => a.code === "UNCALCULATED_TOTAL_ROW"
    );
    expect(uncalculatedTotal).toBeDefined();
    expect(uncalculatedTotal!.severity).toBe("HIGH");
    expect(uncalculatedTotal!.coords[0]).toContain("T0.R2");
    expect(uncalculatedTotal!.message).toContain("R$ 0,00");
  });
});
