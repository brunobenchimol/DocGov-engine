import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative, basename } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { safeReadJsonFile } from "../utils/json.ts";
import { validateTechnicalNoteData } from "../contracts/errors.ts";
import {
  convertDocxToPdf,
  resolveOutputPaths,
  safeUnlink,
} from "../utils/pdf_exporter.ts";
import { sanitizeXmlString } from "../utils/xml.ts";
import { VERSION } from "../constants/index.ts";
import {
  assertDocGovCaseScope,
  isValidDocGovCaseScope,
} from "../utils/paths.ts";
import type {
  TechnicalNoteData,
  EvolutionClauseItem,
  GenerateTechnicalNoteOptions,
  GenerateTechnicalNoteSyntheticResult,
  StructuralDiffResult,
} from "../types/index.ts";
import {
  escapeXml,
  renderMultiLineParagraphsXml,
  renderLabelValueParagraphXml,
  renderDeltaZonasXml,
  renderClauseCardXml,
} from "./openxml/technical_note_xml_cards.ts";
import { cleanHumanText } from "./audit/finding_formatters_and_cards.ts";
export async function generateTechnicalNoteDocx(
  noteDataOrPath: string | TechnicalNoteData,
  outputPath: string,
  options?: GenerateTechnicalNoteOptions
): Promise<{
  success: boolean;
  outputPath: string;
  pdf_path?: string;
  total_changes: number;
  message: string;
}> {
  let noteData: TechnicalNoteData;

  const resolvedOutput = resolve(outputPath);
  const inScope =
    isValidDocGovCaseScope(resolvedOutput) ||
    (typeof noteDataOrPath === "string" &&
      isValidDocGovCaseScope(resolve(noteDataOrPath)));
  if (!inScope) {
    assertDocGovCaseScope(resolvedOutput, "generate_technical_note_docx");
  }

  if (typeof noteDataOrPath === "string") {
    const resolvedPath = resolve(noteDataOrPath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Arquivo da Nota Técnica não encontrado: ${resolvedPath}`);
    }
    const raw = safeReadJsonFile(resolvedPath);
    noteData = validateTechnicalNoteData(raw);
  } else {
    noteData = validateTechnicalNoteData(noteDataOrPath);
  }
  const outputFormat =
    options?.outputFormat ||
    (resolvedOutput.toLowerCase().endsWith(".pdf") ? "pdf" : "docx");

  const processoId = noteData.processo_id;
  const orgaoEntidade = noteData.orgao_entidade;
  const artefato = noteData.artefato_auditado;
  const regime = noteData.regime_juridico || "Lei Federal nº 14.133/2021";
  const versaoAnterior = noteData.versao_anterior || "Versão Anterior";
  const versaoNova = noteData.versao_nova || "Versão Saneada";
  const resumo = noteData.resumo_executivo;
  const conclusao =
    noteData.conclusao_encaminhamento ||
    "Submete-se o presente processo à Consultoria Jurídica e autoridade competente com parecer favorável ao prosseguimento em virtude do pleno saneamento das cláusulas.";

  const totalModificadas =
    noteData.contagem?.modificadas ??
    noteData.quadro_evolucao.filter((i) => i.tipo_alteracao === "MODIFICACAO").length;
  const totalIncluidas =
    noteData.contagem?.incluidas ??
    noteData.quadro_evolucao.filter((i) => i.tipo_alteracao === "INCLUSAO").length;
  const totalSuprimidas =
    noteData.contagem?.suprimidas ??
    noteData.quadro_evolucao.filter((i) => i.tipo_alteracao === "SUPRESSAO").length;
  const totalChanges = noteData.quadro_evolucao.length;

  const cardsXml = noteData.quadro_evolucao
    .map((item, idx) => renderClauseCardXml(item, idx))
    .join("\n");

  const deltaZonasXml = renderDeltaZonasXml(noteData.delta_zonas);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Title"/>
        <w:spacing w:before="120" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
        <w:t>NOTA TÉCNICA COMPARATIVA DE EVOLUÇÃO E SANEAMENTO DOCUMENTAL</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:iCs/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="4B5563"/></w:rPr>
        <w:t>Instrução Processual — Análise Comparativa "Antes vs. Depois" (${escapeXml(regime)})</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>1. IDENTIFICAÇÃO E DADOS PROCESSUAIS</w:t>
      </w:r>
    </w:p>
    ${renderLabelValueParagraphXml("Processo", processoId)}
    ${renderLabelValueParagraphXml("Órgão / Entidade", orgaoEntidade)}
    ${renderLabelValueParagraphXml("Artefato Comparado", artefato)}
    ${renderLabelValueParagraphXml("Versão Anterior", versaoAnterior)}
    ${renderLabelValueParagraphXml("Versão Nova", versaoNova)}
    ${renderLabelValueParagraphXml("Regime Jurídico", regime)}
    ${noteData.data_emissao ? renderLabelValueParagraphXml("Data de Emissão", noteData.data_emissao) : ""}
    ${noteData.autor_responsavel ? renderLabelValueParagraphXml("Responsável", noteData.autor_responsavel) : ""}
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="260" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>2. SÍNTESE E EMENTA DA MOTIVAÇÃO TÉCNICA</w:t>
      </w:r>
    </w:p>
    ${renderMultiLineParagraphsXml(resumo, { jc: "both", spaceAfter: 120 })}
    <w:p>
      <w:pPr>
        <w:spacing w:before="80" w:after="100"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="1F2937"/></w:rPr>
        <w:t xml:space="preserve">Quadro Síntese: ${totalChanges} alteração(ões) mapeada(s) (${totalModificadas} modificada(s), ${totalIncluidas} incluída(s), ${totalSuprimidas} suprimida(s)).</w:t>
      </w:r>
    </w:p>
    ${deltaZonasXml}
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="280" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>4. QUADRO ANALÍTICO DE EVOLUÇÃO DE CLÁUSULAS (ITEM A ITEM)</w:t>
      </w:r>
    </w:p>
    ${cardsXml}
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="280" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>5. CONCLUSÃO E ENCAMINHAMENTO</w:t>
      </w:r>
    </w:p>
    ${renderMultiLineParagraphsXml(conclusao, { jc: "both", spaceAfter: 200 })}
    <w:p>
      <w:pPr><w:spacing w:before="240" w:after="40"/><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
        <w:t>____________________________________________________</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:before="40" w:after="40"/><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(noteData.autor_responsavel || "Equipe de Planejamento da Contratação")}</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const docXml = parser.parseFromString(
    sanitizeXmlString(documentXml),
    "application/xml"
  );

  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
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
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:jc w:val="both"/></w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:sz w:val="22"/>
      <w:szCs w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
</w:styles>`
  );

  zip.file("word/document.xml", serializer.serializeToString(docXml));

  const outPaths = resolveOutputPaths(resolvedOutput, outputFormat);
  const outDir = dirname(outPaths.primaryOutputPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const outBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  let pdfPath: string | undefined;
  try {
    writeFileSync(outPaths.docxPath, outBuffer);

    if (outputFormat === "pdf" || outputFormat === "both") {
      const pdfRes = await convertDocxToPdf(outPaths.docxPath, outPaths.pdfPath, {
        timeoutMs: options?.pdfTimeoutMs,
      });
      pdfPath = pdfRes.pdfPath;
    }
  } finally {
    if (outPaths.isExclusivePdf && outPaths.tempDocxPath) {
      await safeUnlink(outPaths.tempDocxPath);
    }
  }

  let finalMessage: string;
  if (outputFormat === "pdf" && pdfPath) {
    finalMessage = `Nota Técnica Comparativa (.pdf) gerada com sucesso em: ${pdfPath}`;
  } else if (outputFormat === "both" && pdfPath) {
    finalMessage = `Nota Técnica Comparativa (.docx e .pdf) gerada com sucesso em: ${outPaths.docxPath} e ${pdfPath}`;
  } else {
    finalMessage = `Nota Técnica Comparativa (.docx) gerada com sucesso em: ${outPaths.docxPath}`;
  }

  return {
    success: true,
    outputPath: outPaths.primaryOutputPath,
    pdf_path: pdfPath,
    total_changes: totalChanges,
    message: finalMessage,
  };
}

export function formatTechnicalNoteSyntheticResult(
  result: {
    outputPath: string;
    message: string;
    pdf_path?: string;
    total_changes: number;
  },
  baseDir: string = process.cwd()
): GenerateTechnicalNoteSyntheticResult {
  const relOutput =
    relative(baseDir, result.outputPath).replace(/\\/g, "/") ||
    result.outputPath;
  const relPdf = result.pdf_path
    ? relative(baseDir, result.pdf_path).replace(/\\/g, "/")
    : undefined;

  let nextHint: string;
  if (relPdf) {
    nextHint = `Nota Técnica Comparativa pronta em PDF (${relPdf}) para instrução processual e assinatura.`;
  } else {
    nextHint = `Nota Técnica Comparativa pronta em DOCX (${relOutput}) para instrução processual e assinatura.`;
  }

  const payload: GenerateTechnicalNoteSyntheticResult = {
    status: "success",
    engine_version: VERSION,
    document_type: "TECHNICAL_NOTE",
    outputPath: relOutput,
    ...(relPdf ? { pdf_path: relPdf } : {}),
    total_changes: result.total_changes,
    message: result.message,
    next_step_hint: nextHint,
  };

  // Garante cumprimento rigoroso da Lei 2 (< 1024 bytes UTF-8 com folga segura < 900 bytes)
  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 900) {
    payload.message = "Nota Técnica gerada com sucesso.";
  }

  return payload;
}

export function createTechnicalNoteDataFromDiff(
  diff: StructuralDiffResult,
  oldPath: string,
  newPath: string,
  baseData?: Partial<TechnicalNoteData>
): TechnicalNoteData {
  const resolvedOld = resolve(oldPath);
  const resolvedNew = resolve(newPath);

  const relevantChanges = diff.changes.filter((c) => c.change_type !== "UNCHANGED");
  const items: EvolutionClauseItem[] = relevantChanges.map((c, idx) => ({
    id: `EVO-${String(idx + 1).padStart(2, "0")}`,
    coordenada: c.coord_new || c.coord_old || `P${idx + 1}`,
    secao_titulo: c.section_title || "Disposições Gerais",
    tipo_alteracao: (c.change_type === "ADDED"
      ? "INCLUSAO"
      : c.change_type === "REMOVED"
      ? "SUPRESSAO"
      : "MODIFICACAO") as any,
    redacao_anterior: c.old_text,
    redacao_nova: c.new_text,
    diff_inline: c.inline_diff,
    diff_chunks: c.diff_chunks,
    justificativa_tecnica:
      "Adequação e aprimoramento redacional da cláusula durante a instrução processual para atendimento ao interesse público.",
    fundamentacao_juridica:
      "Lei Federal nº 14.133/2021; Princípio do Planejamento e Padronização Documental.",
  }));

  return {
    document_type: "TECHNICAL_NOTE",
    processo_id: baseData?.processo_id || "PROCESSO_ADMINISTRATIVO",
    orgao_entidade: baseData?.orgao_entidade || "ORGAO_CONTRATANTE",
    artefato_auditado: baseData?.artefato_auditado || basename(resolvedNew),
    versao_anterior: baseData?.versao_anterior || basename(resolvedOld),
    versao_nova: baseData?.versao_nova || basename(resolvedNew),
    resumo_executivo:
      baseData?.resumo_executivo ||
      `Nota Técnica Comparativa gerada automaticamente a partir da comparação entre ${basename(
        resolvedOld
      )} e ${basename(resolvedNew)}. Foram mapeadas ${diff.total_modified} alteração(ões), ${diff.total_added} inclusão(ões) e ${diff.total_removed} supressão(ões).`,
    contagem: baseData?.contagem || {
      total_alteracoes: diff.total_modified + diff.total_added + diff.total_removed,
      modificadas: diff.total_modified,
      incluidas: diff.total_added,
      suprimidas: diff.total_removed,
      apontamentos_saneados: diff.zones_delta.filter((z) => z.status === "RESOLVED").length,
    },
    quadro_evolucao:
      baseData?.quadro_evolucao && baseData.quadro_evolucao.length > 0
        ? baseData.quadro_evolucao
        : items,
    delta_zonas: baseData?.delta_zonas || diff.zones_delta,
  };
}
