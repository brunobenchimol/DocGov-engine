import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import os from "node:os";
import JSZip from "jszip";
import {
  extractSectionHeadingPrefix,
  reanchorMultilevelItem,
  detectHierarchicalListItem,
  processDocument,
} from "../src/tools/fill_template.ts";
import { buildDocxTemplate } from "../src/tools/build_template.ts";
import {
  inspectDocx,
  scanPostCompileIntegrityAlerts,
} from "../src/tools/inspect.ts";
import type { SlotsManifest } from "../src/types/index.ts";

describe("ENG-14 e ENG-15: Reancoragem de Prefixos Multinível e Scanner de Anomalias (v1.3.9)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = resolve(os.tmpdir(), `docgov_test_multilevel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("1. extractSectionHeadingPrefix deve identificar prefixos numéricos em títulos literais e via numbering (ENG-14a)", () => {
    // Títulos textuais em caixa alta ou termos estruturais
    expect(
      extractSectionHeadingPrefix("2. JUSTIFICATIVA E OBJETIVO DA CONTRATAÇÃO")
    ).toBe("2");
    expect(
      extractSectionHeadingPrefix("4.4 CRITÉRIOS DE MEDIÇÃO E PAGAMENTO")
    ).toBe("4.4");
    expect(
      extractSectionHeadingPrefix("5.1 MODELO DE EXECUÇÃO DO CONTRATO")
    ).toBe("5.1");
    expect(
      extractSectionHeadingPrefix("5.2 MATRIZ DE RISCOS")
    ).toBe("5.2");
    expect(
      extractSectionHeadingPrefix("6. MODELO DE GESTÃO DO CONTRATO")
    ).toBe("6");
    expect(
      extractSectionHeadingPrefix("14. DISPOSIÇÕES GERAIS")
    ).toBe("14");

    // Título com estilo Heading e numPrefix do numbering.xml
    expect(
      extractSectionHeadingPrefix("Critérios de Medição", "4.4.", true)
    ).toBe("4.4");
    expect(
      extractSectionHeadingPrefix("Da Fundamentação", "2.1.", true)
    ).toBe("2.1");

    // Parágrafos de corpo normal (não-título) não devem retornar prefixo de seção
    expect(
      extractSectionHeadingPrefix("1.1. O fornecimento da subscrição deverá atender...")
    ).toBeNull();
    expect(
      extractSectionHeadingPrefix("Texto explicativo sem qualquer número de seção.")
    ).toBeNull();
  });

  test("2. reanchorMultilevelItem deve reancorar itens multinível para as Seções 4.4, 5.1, 5.2 e 6 (ENG-14a)", () => {
    const existingPrefixes = new Set(["4", "4.4", "5", "5.1", "5.2", "6"]);

    // Seção 4.4: 1.1 -> 4.4.1, 1.2 -> 4.4.2
    const item44_1 = detectHierarchicalListItem("1.1. Prazo de liquidação de 10 dias úteis.");
    const res44_1 = reanchorMultilevelItem(item44_1, "4.4", existingPrefixes);
    expect(res44_1.isConvertedToBullet).toBe(false);
    expect(res44_1.newMarkerText).toBe("4.4.1.");

    const item44_2 = detectHierarchicalListItem("1.2. A emissão do Termo Definitivo.");
    const res44_2 = reanchorMultilevelItem(item44_2, "4.4", existingPrefixes);
    expect(res44_2.isConvertedToBullet).toBe(false);
    expect(res44_2.newMarkerText).toBe("4.4.2.");

    // Seção 5.1: 1.1 -> 5.1.1
    const item51_1 = detectHierarchicalListItem("1.1. A ordem de serviço conterá o escopo.");
    const res51_1 = reanchorMultilevelItem(item51_1, "5.1", existingPrefixes);
    expect(res51_1.isConvertedToBullet).toBe(false);
    expect(res51_1.newMarkerText).toBe("5.1.1.");

    // Seção 5.2: 1.1 -> 5.2.1
    const item52_1 = detectHierarchicalListItem("1.1. Risco operacional de indisponibilidade.");
    const res52_1 = reanchorMultilevelItem(item52_1, "5.2", existingPrefixes);
    expect(res52_1.isConvertedToBullet).toBe(false);
    expect(res52_1.newMarkerText).toBe("5.2.1.");

    // Seção 6: 1.1 -> 6.1, 1.2 -> 6.2
    const item6_1 = detectHierarchicalListItem("1.1. O gestor do contrato será designado.");
    const res6_1 = reanchorMultilevelItem(item6_1, "6", existingPrefixes);
    expect(res6_1.isConvertedToBullet).toBe(false);
    expect(res6_1.newMarkerText).toBe("6.1.");

    const item6_2 = detectHierarchicalListItem("1.2. O fiscal técnico acompanhará.");
    const res6_2 = reanchorMultilevelItem(item6_2, "6", existingPrefixes);
    expect(res6_2.isConvertedToBullet).toBe(false);
    expect(res6_2.newMarkerText).toBe("6.2.");

    // Item que já veio reancorado: 4.4.1. deve ser preservado
    const itemAlready = detectHierarchicalListItem("4.4.1. Pagamento mensal após ateste.");
    const resAlready = reanchorMultilevelItem(itemAlready, "4.4", existingPrefixes);
    expect(resAlready.isConvertedToBullet).toBe(false);
    expect(resAlready.newMarkerText).toBe("4.4.1.");
  });

  test("3. reanchorMultilevelItem deve converter em Bullet '• ' ao detectar colisão com subseções irmãs fixas do template (Seção 2)", () => {
    // Template já possui as subseções 2.1 e 2.2 fixas após a introdução da Seção 2
    const existingPrefixesWithSiblings = new Set(["2", "2.1", "2.2", "3"]);

    // Item injetado no slot introdutório da Seção 2 (geraria 2.1, colidindo com o título 2.1 do template)
    const itemColisao1 = detectHierarchicalListItem("1.1. O objetivo precípuo da contratação é sustentar a arquitetura.");
    const resColisao1 = reanchorMultilevelItem(itemColisao1, "2", existingPrefixesWithSiblings);
    expect(resColisao1.isConvertedToBullet).toBe(true);
    expect(resColisao1.newMarkerText).toBe("• ");

    // Se vier como 2.1. literal no slot da Seção 2, também colide e vira bullet
    const itemColisao2 = detectHierarchicalListItem("2.1. A modernização do parque computacional.");
    const resColisao2 = reanchorMultilevelItem(itemColisao2, "2", existingPrefixesWithSiblings);
    expect(resColisao2.isConvertedToBullet).toBe(true);
    expect(resColisao2.newMarkerText).toBe("• ");

    // Já dentro da própria subseção 2.1 (activeSectionPrefix: 2.1), o subitem 1.1 vira 2.1.1 (sem colisão)
    const itemSub21 = detectHierarchicalListItem("1.1. Subitem legítimo da subseção 2.1.");
    const resSub21 = reanchorMultilevelItem(itemSub21, "2.1", existingPrefixesWithSiblings);
    expect(resSub21.isConvertedToBullet).toBe(false);
    expect(resSub21.newMarkerText).toBe("2.1.1.");
  });

  test("6. Fluxo E2E: processDocument deve reancorar seções pai, aplicar hanging indent literal e eliminar numPr órfão (ENG-14 e ENG-15)", async () => {
    const rawDocxPath = resolve(tempDir, "tr_multilevel_raw.docx");
    const manifestPath = resolve(tempDir, "slots_manifest.json");
    const tplDocxPath = resolve(tempDir, "tr_multilevel_tpl.docx");
    const statePath = resolve(tempDir, "estado_caso.json");
    const outDocxPath = resolve(tempDir, "TR_FINAL_REANCORADO.docx");

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
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>2. JUSTIFICATIVA E OBJETIVO DA CONTRATAÇÃO (ORGAO_CONTRATANTE)</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Placeholder introducao da secao 2</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>2.1 Motivação e Benefícios da Contratação</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Texto fixo da subsecao 2.1.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>4.4 CRITÉRIOS DE MEDIÇÃO E PAGAMENTO</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Placeholder regras de faturamento secao 4.4</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>6. MODELO DE GESTÃO DO CONTRATO</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Placeholder fiscais da secao 6</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`
    );
    writeFileSync(rawDocxPath, await zip.generateAsync({ type: "nodebuffer" }));

    const manifest: SlotsManifest = {
      replace_paragraphs: [
        { start_p: 1, end_p: 1, tag: "{{tr.intro_secao2}}" },
        { start_p: 5, end_p: 5, tag: "{{tr.regras_secao44}}" },
        { start_p: 7, end_p: 7, tag: "{{tr.fiscais_secao6}}" },
      ],
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const { buildDocxTemplate } = await import("../src/tools/build_template.ts");
    await buildDocxTemplate(rawDocxPath, manifestPath, tplDocxPath);

    const state = {
      tr: {
        // Na Seção 2, o LLM gerou 1.1 e 1.2 que colidiriam com o 2.1 fixo do template
        intro_secao2: [
          "**1.1. Objetivo Principal:** Sustentar a infraestrutura crítica do ORGAO_CONTRATANTE.",
          "**1.2. Alinhamento Estratégico:** Aderente ao Plano de Contratações Anual.",
        ].join("\n"),
        // Na Seção 4.4, o LLM gerou 1.1 e 1.2 que devem ser reancorados para 4.4.1 e 4.4.2
        regras_secao44: [
          "**1.1. Periodicidade de Faturamento:** O faturamento ocorrerá mensalmente.",
          "**1.2. Prazo de Liquidação:** A liquidação será efetuada em até 10 dias úteis.",
        ].join("\n"),
        // Na Seção 6, o LLM gerou 1.1 e 1.2 que devem ser reancorados para 6.1 e 6.2
        fiscais_secao6: [
          "**1.1. Gestor do Contrato:** Indicado pela autoridade competente.",
          "**1.2. Fiscal Técnico:** Acompanhará os níveis de serviço acordados.",
        ].join("\n"),
      },
    };
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    const fillRes = await processDocument(tplDocxPath, statePath, outDocxPath);
    expect(fillRes.success).toBe(true);

    const inspectRes = await inspectDocx(outDocxPath);

    // 1. Seção 2: Itens convertidos em Bullet • para não duplicar a subseção fixa 2.1
    const pIntro2 = inspectRes.paragraphs.find((p) => p.text.includes("Sustentar a infraestrutura crítica"));
    expect(pIntro2).toBeDefined();
    expect(pIntro2?.text).toContain("• Objetivo Principal: Sustentar a infraestrutura crítica");

    // 2. Seção 4.4: Reancorado para 4.4.1. e 4.4.2.
    const p44_1 = inspectRes.paragraphs.find((p) => p.text.includes("Periodicidade de Faturamento"));
    expect(p44_1).toBeDefined();
    expect(p44_1?.text).toContain("4.4.1. Periodicidade de Faturamento: O faturamento ocorrerá mensalmente.");

    const p44_2 = inspectRes.paragraphs.find((p) => p.text.includes("Prazo de Liquidação"));
    expect(p44_2).toBeDefined();
    expect(p44_2?.text).toContain("4.4.2. Prazo de Liquidação: A liquidação será efetuada em até 10 dias úteis.");

    // 3. Seção 6: Reancorado para 6.1. e 6.2.
    const p6_1 = inspectRes.paragraphs.find((p) => p.text.includes("Gestor do Contrato"));
    expect(p6_1).toBeDefined();
    expect(p6_1?.text).toContain("6.1. Gestor do Contrato: Indicado pela autoridade competente.");

    const p6_2 = inspectRes.paragraphs.find((p) => p.text.includes("Fiscal Técnico"));
    expect(p6_2).toBeDefined();
    expect(p6_2?.text).toContain("6.2. Fiscal Técnico: Acompanhará os níveis de serviço acordados.");

    // 4. Validação direta do OpenXML: Ausência de nós <w:numPr> órfãos nos parágrafos injetados
    const outZip = await JSZip.loadAsync(readFileSync(outDocxPath));
    const docXml = await outZip.file("word/document.xml")!.async("string");
    expect(docXml).not.toContain("<w:numPr>");
    expect(docXml).toContain("<w:tab/>");
    expect(docXml).toContain('w:hanging="');

    // 5. Verificação da visão de auditoria: todos os itens presentes com numeração impecável
    const auditMd = readFileSync(fillRes.visao_auditoria_path!, "utf-8");
    expect(auditMd).toContain("4.4.1. Periodicidade de Faturamento");
    expect(auditMd).toContain("6.1. Gestor do Contrato");
    expect(auditMd).toContain("• Objetivo Principal");
  });

  test("8. E2E: Herança nativa de <w:numPr> preserva árvore do template (numId=1, seções 1..19) sem reset e sem 10.2.2 na Seção 5 (ENG-16)", async () => {
    const rawDocxPath = resolve(tempDir, "tr_orgao_raw.docx");
    const manifestPath = resolve(tempDir, "slots_manifest_orgao.json");
    const tplDocxPath = resolve(tempDir, "tr_orgao_tpl.docx");
    const statePath = resolve(tempDir, "estado_caso_orgao.json");
    const outDocxPath = resolve(tempDir, "TR_ORGAO_FINAL.docx");

    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );
    zip.file(
      "word/_rels/document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`
    );
    // numbering.xml com lista multinível numId="1" de 9 níveis (%1., %1.%2., %1.%2.%3., etc.)
    zip.file(
      "word/numbering.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2."/><w:lvlJc w:val="left"/></w:lvl>
    <w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2.%3."/><w:lvlJc w:val="left"/></w:lvl>
    <w:lvl w:ilvl="3"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2.%3.%4."/><w:lvlJc w:val="left"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="1"/>
  </w:num>
</w:numbering>`
    );

    // document.xml com Seções 1 a 19 do template real
    const sectionsXml = [];
    for (let s = 1; s <= 19; s++) {
      sectionsXml.push(`
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading1"/>
            <w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>
          </w:pPr>
          <w:r><w:t>SEÇÃO ${s}. TITULO DA SECAO</w:t></w:r>
        </w:p>
      `);
      if (s === 5) {
        sectionsXml.push(`
          <w:p>
            <w:pPr>
              <w:pStyle w:val="Heading2"/>
              <w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr>
            </w:pPr>
            <w:r><w:t>SUBSECAO 5.1 REQUISITOS</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr>
              <w:pStyle w:val="Heading2"/>
              <w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr>
            </w:pPr>
            <w:r><w:t>SUBSECAO 5.2 ESPECIFICACOES TECNICAS</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr>
              <w:pStyle w:val="ListParagraph"/>
              <w:numPr><w:ilvl w:val="2"/><w:numId w:val="1"/></w:numPr>
            </w:pPr>
            <w:r><w:t>{{tr.especificacoes_secao52}}</w:t></w:r>
          </w:p>
        `);
      }
    }

    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${sectionsXml.join("\n")}
  </w:body>
</w:document>`
    );

    writeFileSync(rawDocxPath, await zip.generateAsync({ type: "nodebuffer" }));

    const rawInsp = await inspectDocx(rawDocxPath);
    const slotPIndex = rawInsp.paragraphs.findIndex((p) => p.text.includes("{{tr.especificacoes_secao52}}"));
    expect(slotPIndex).toBeGreaterThan(0);

    const manifest: SlotsManifest = {
      replace_paragraphs: [
        {
          start_p: slotPIndex,
          end_p: slotPIndex,
          tag: "{{tr.especificacoes_secao52}}",
        },
      ],
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    await buildDocxTemplate(rawDocxPath, manifestPath, tplDocxPath);

    const state = {
      tr: {
        especificacoes_secao52: [
          "**Características Gerais das Subscrições:**",
          "**1.1. Suporte Técnico 24x7:** Disponibilidade ininterrupta com abertura de chamados.",
          "**1.1.1. Prazo de Atendimento:** Severidade 1 atendida em até 1 hora.",
          "**1.2. Atualizações de Segurança:** Correções críticas aplicadas automaticamente.",
        ].join("\n"),
      },
    };
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    const fillRes = await processDocument(tplDocxPath, statePath, outDocxPath);
    expect(fillRes.success).toBe(true);

    const finalZip = await JSZip.loadAsync(readFileSync(outDocxPath));
    const finalDocXml = await finalZip.file("word/document.xml")!.async("string");

    // 1. Deve herdar o <w:numId w:val="1"/> nativo da árvore do template
    expect(finalDocXml).toContain('<w:numId w:val="1"/>');
    // 2. Não deve inventar prefixo literal de outra seção (zero 10.2.x ou 10.3.x)
    expect(finalDocXml).not.toContain("10.2.2.");
    expect(finalDocXml).not.toContain("10.3.1.1.");
    // 3. Os runs <w:t> não devem conter prefixos literais duplicados (o Word numera via numPr)
    expect(finalDocXml).toContain("Suporte Técnico 24x7:");
    expect(finalDocXml).toContain("Disponibilidade ininterrupta com abertura de chamados.");
    expect(finalDocXml).toContain("Prazo de Atendimento:");
    expect(finalDocXml).toContain("Severidade 1 atendida em até 1 hora.");
    expect(finalDocXml).not.toContain(">1.1. Suporte Técnico 24x7");
    expect(finalDocXml).not.toContain(">1.1.1. Prazo de Atendimento");

    // 4. Scanner de integridade deve passar sem alertas de inconsistência ou mismatch
    const finalInsp = await inspectDocx(outDocxPath);
    const finalAlerts = scanPostCompileIntegrityAlerts(finalInsp);
    const mismatch = finalAlerts.find((a) => a.code === "SECTION_PREFIX_MISMATCH");
    const numReset = finalAlerts.find((a) => a.code === "MULTILEVEL_NUMBERING_RESET");
    expect(mismatch).toBeUndefined();
    expect(numReset).toBeUndefined();
  });
});
