import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { safeReadJsonFile } from "../utils/json.ts";
import {
  createAuditReportContractError,
  createRiskMatrixContractError,
  createComplianceChecklistContractError,
} from "../contracts/errors.ts";
import {
  convertDocxToPdf,
  resolveOutputPaths,
  safeUnlink,
} from "../utils/pdf_exporter.ts";
import { generateTechnicalNoteDocx } from "./technical_note.ts";
import { VERSION } from "../constants/index.ts";
import {
  assertDocGovCaseScope,
  isValidDocGovCaseScope,
} from "../utils/paths.ts";
import type {
  AuditReportData,
  AuditFinding,
  AuditDocumentType,
  GenerateAuditDocxOptions,
  GenerateAuditDocxSyntheticResult,
} from "../types/index.ts";

import {
  cleanHumanText,
  formatReadableGlobalStatus,
  resolveFindingSeverityInfo,
  renderMultiLineParagraphsXml,
  renderLabelValueParagraphXml,
} from "./audit/finding_formatters_and_cards.ts";
import {
  buildRiskMatrixDocumentXml,
  buildComplianceChecklistDocumentXml,
  renderAuditFindingCardsXml,
  packageAuditDocxBuffer,
} from "./audit/docx_styles_and_sections.ts";

export { cleanHumanText } from "./audit/finding_formatters_and_cards.ts";
export async function generateAuditDocx(
  auditJsonPath: string,
  outputPath: string,
  options?: GenerateAuditDocxOptions
): Promise<{
  success: boolean;
  outputPath: string;
  pdf_path?: string;
  document_type?: AuditDocumentType;
  message: string;
}> {
  const resolvedAuditJson = resolve(auditJsonPath);
  const resolvedOutput = resolve(outputPath);

  const inScope =
    isValidDocGovCaseScope(resolvedAuditJson) ||
    isValidDocGovCaseScope(resolvedOutput);
  if (!inScope) {
    assertDocGovCaseScope(resolvedAuditJson, "generate_audit_docx");
  }

  const outputFormat = options?.outputFormat || "docx";
  if (!["docx", "pdf", "both"].includes(outputFormat)) {
    throw new Error(
      `Formato de saída inválido: '${outputFormat}'. Formatos suportados: 'docx', 'pdf' ou 'both'.`
    );
  }

  if (!existsSync(resolvedAuditJson)) {
    throw new Error(
      `Arquivo JSON de auditoria não encontrado: ${resolvedAuditJson}`
    );
  }

  const raw: AuditReportData =
    safeReadJsonFile<AuditReportData>(resolvedAuditJson);

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      createAuditReportContractError(
        "O arquivo de auditoria deve conter um objeto JSON válido."
      )
    );
  }

  // 1. Detecção do Tipo de Documento (Marco 5.4 & Marco 6.2)
  if (
    raw.document_type === "TECHNICAL_NOTE" ||
    raw.document_type === "EVOLUTION_REPORT" ||
    Array.isArray(raw.quadro_evolucao) ||
    Array.isArray(raw.clausulas_evolucao)
  ) {
    const techRes = await generateTechnicalNoteDocx(raw as any, resolvedOutput, options);
    return {
      success: true,
      outputPath: techRes.outputPath,
      document_type: "TECHNICAL_NOTE",
      ...(techRes.pdf_path ? { pdf_path: techRes.pdf_path } : {}),
      message: techRes.message,
    };
  }

  let documentType: AuditDocumentType = "AUDIT_REPORT";
  if (
    raw.document_type === "RISK_MATRIX" ||
    Array.isArray(raw.matriz_riscos) ||
    Array.isArray(raw.risk_matrix)
  ) {
    documentType = "RISK_MATRIX";
  } else if (
    raw.document_type === "COMPLIANCE_CHECKLIST" ||
    Array.isArray(raw.checklist_conformidade) ||
    Array.isArray(raw.compliance_checklist)
  ) {
    documentType = "COMPLIANCE_CHECKLIST";
  }

  const rawProcesso =
    raw.processo_id ??
    raw.processo ??
    raw.metadados?.processo_id ??
    raw.metadados?.numero_processo;

  if (documentType === "RISK_MATRIX") {
    if (!rawProcesso || typeof rawProcesso !== "string" || !rawProcesso.trim()) {
      throw new Error(
        createRiskMatrixContractError(
          "Campo obrigatório 'processo_id' ausente ou vazio."
        )
      );
    }
  } else if (documentType === "COMPLIANCE_CHECKLIST") {
    if (!rawProcesso || typeof rawProcesso !== "string" || !rawProcesso.trim()) {
      throw new Error(
        createComplianceChecklistContractError(
          "Campo obrigatório 'processo_id' ausente ou vazio."
        )
      );
    }
  } else {
    if (!rawProcesso || typeof rawProcesso !== "string" || !rawProcesso.trim()) {
      throw new Error(
        createAuditReportContractError(
          "Campo obrigatório 'processo_id' ausente ou vazio."
        )
      );
    }
  }

  const processoId = cleanHumanText(rawProcesso);
  const orgaoEntidade = cleanHumanText(
    raw.orgao_entidade ??
      raw.orgao ??
      raw.metadados?.orgao_entidade ??
      ""
  );
  const artefatoAuditado = cleanHumanText(
    raw.artefato_auditado ??
      raw.artefato ??
      raw.documento_auditado ??
      "N/A"
  );
  const regimeJuridico = cleanHumanText(
    raw.regime_juridico ?? raw.metadados?.regime_juridico ?? "Lei Federal nº 14.133/2021"
  );

  let documentXml = "";

  const headerCtx = { processoId, orgaoEntidade, artefatoAuditado, regimeJuridico };
  if (documentType === "RISK_MATRIX") {
    documentXml = buildRiskMatrixDocumentXml(raw, headerCtx);
  } else if (documentType === "COMPLIANCE_CHECKLIST") {
    documentXml = buildComplianceChecklistDocumentXml(raw, headerCtx);
  } else {
    const rawResumo =
      raw.resumo_executivo ??
      raw.parecer_executivo ??
      raw.resumo;

    if (!rawResumo || typeof rawResumo !== "string" || !rawResumo.trim()) {
      throw new Error(
        createAuditReportContractError(
          "Campo obrigatório 'resumo_executivo' ausente ou vazio."
        )
      );
    }

    if (raw.apontamentos !== undefined && !Array.isArray(raw.apontamentos)) {
      throw new Error(
        createAuditReportContractError(
          "O campo 'apontamentos' deve ser uma lista (array) de achados de auditoria."
        )
      );
    }

    if (raw.achados !== undefined && !Array.isArray(raw.achados)) {
      throw new Error(
        createAuditReportContractError(
          "O campo 'achados' deve ser uma lista (array) de achados de auditoria."
        )
      );
    }

    const apontamentosList: AuditFinding[] = Array.isArray(raw.apontamentos)
      ? raw.apontamentos
      : Array.isArray(raw.achados)
        ? raw.achados
        : [];

    const bloqueantes =
      raw.contagem?.bloqueantes ??
      raw.resumo_contagem?.bloqueantes ??
      apontamentosList.filter(
        (a) => resolveFindingSeverityInfo(a).label === "BLOQUEANTE"
      ).length;
    const alertas =
      raw.contagem?.alertas ??
      raw.resumo_contagem?.alertas ??
      apontamentosList.filter(
        (a) => resolveFindingSeverityInfo(a).label === "ALERTA PREVENTIVO"
      ).length;
    const conformes =
      raw.contagem?.conformes ??
      raw.resumo_contagem?.conformes ??
      apontamentosList.filter(
        (a) => resolveFindingSeverityInfo(a).label === "CONFORME"
      ).length;

    const statusGlobalLegivel = formatReadableGlobalStatus(
      raw.status_global ?? raw.status ?? raw.parecer_global,
      bloqueantes,
      alertas
    );
    const diagnosticoGlobalTexto = `${statusGlobalLegivel} (${bloqueantes} Bloqueantes | ${alertas} Alertas | ${conformes} Conformes)`;

    const resumoExecutivo =
      raw.resumo_executivo ??
      raw.parecer_executivo ??
      raw.resumo ??
      "Sem resumo executivo informado.";


    const findingsCardsXml = renderAuditFindingCardsXml(apontamentosList);

    documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Title"/>
        <w:spacing w:before="120" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
        <w:t>PARECER DE AUDITORIA TÉCNICO-JURÍDICA E CONTROLE DE DIRECIONAMENTO</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:iCs/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="4B5563"/></w:rPr>
        <w:t>Auditoria Cega de Conformidade Legal e Competitividade (Controle Externo)</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>1. IDENTIFICAÇÃO E ESCOPO DA AUDITORIA</w:t>
      </w:r>
    </w:p>
    ${renderLabelValueParagraphXml("Processo", processoId)}
    ${orgaoEntidade ? renderLabelValueParagraphXml("Órgão / Entidade", orgaoEntidade) : ""}
    ${renderLabelValueParagraphXml("Documento Auditado", artefatoAuditado)}
    ${regimeJuridico ? renderLabelValueParagraphXml("Regime Jurídico", regimeJuridico) : ""}
    ${renderLabelValueParagraphXml("Diagnóstico Global", diagnosticoGlobalTexto)}
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="280" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>2. PARECER EXECUTIVO DE CONTROLE EXTERNO</w:t>
      </w:r>
    </w:p>
    ${renderMultiLineParagraphsXml(resumoExecutivo, { jc: "both", spaceAfter: 140 })}
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="280" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
        <w:t>3. DETALHAMENTO INDIVIDUALIZADO DOS APONTAMENTOS (ID POR ID)</w:t>
      </w:r>
    </w:p>
    ${findingsCardsXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  }

  const outBuffer = await packageAuditDocxBuffer(documentXml);

  const outPaths = resolveOutputPaths(resolvedOutput, outputFormat);
  const outDir = dirname(outPaths.primaryOutputPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

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

  let docTypeName = "Relatório de Auditoria";
  if (documentType === "RISK_MATRIX") {
    docTypeName = "Matriz de Gerenciamento de Riscos";
  } else if (documentType === "COMPLIANCE_CHECKLIST") {
    docTypeName = "Checklist de Conformidade Normativa";
  }

  let finalMessage: string;
  if (outputFormat === "pdf" && pdfPath) {
    finalMessage = `${docTypeName} (.pdf) gerado com sucesso em: ${pdfPath}`;
  } else if (outputFormat === "both" && pdfPath) {
    finalMessage = `${docTypeName} (.docx e .pdf) gerados com sucesso em: ${outPaths.docxPath} e ${pdfPath}`;
  } else {
    finalMessage = `${docTypeName} (.docx) gerado com sucesso em: ${outPaths.docxPath}`;
  }

  return {
    success: true,
    outputPath: outPaths.primaryOutputPath,
    document_type: documentType,
    ...(pdfPath ? { pdf_path: pdfPath } : {}),
    message: finalMessage,
  };
}

export function formatGenerateAuditDocxSyntheticResult(
  result: {
    outputPath: string;
    message: string;
    pdf_path?: string;
    document_type?: AuditDocumentType;
  },
  baseDir: string = process.cwd()
): GenerateAuditDocxSyntheticResult {
  const relOutput =
    relative(baseDir, result.outputPath).replace(/\\/g, "/") ||
    result.outputPath;
  const relPdf = result.pdf_path
    ? relative(baseDir, result.pdf_path).replace(/\\/g, "/")
    : undefined;

  const docType = result.document_type || "AUDIT_REPORT";
  let nextHint: string;

  if (docType === "RISK_MATRIX") {
    if (relPdf) {
      nextHint = `Ciclo de governança concluído: a matriz de riscos em layout vertical A4 está pronta em PDF (${relPdf}) para revisão e assinatura.`;
    } else {
      nextHint = "Ciclo de governança concluído: a matriz de riscos em layout vertical A4 (zero tabelas) está pronta em output/ para revisão e assinatura.";
    }
  } else if (docType === "COMPLIANCE_CHECKLIST") {
    if (relPdf) {
      nextHint = `Ciclo de controle preventivo concluído: o checklist de conformidade em layout vertical A4 está pronto em PDF (${relPdf}) para revisão e assinatura.`;
    } else {
      nextHint = "Ciclo de controle preventivo concluído: o checklist de conformidade em layout vertical A4 (zero tabelas) está pronto em output/ para revisão e assinatura.";
    }
  } else if (docType === "TECHNICAL_NOTE" || docType === "EVOLUTION_REPORT") {
    if (relPdf) {
      nextHint = `Ciclo de análise comparativa concluído: a nota técnica em layout vertical A4 está pronta em PDF (${relPdf}) para revisão e assinatura.`;
    } else {
      nextHint = `Ciclo de análise comparativa concluído: a nota técnica em layout vertical A4 está pronta em DOCX (${relOutput}) para revisão e assinatura.`;
    }
  } else {
    if (relPdf) {
      if (result.outputPath.endsWith(".pdf")) {
        nextHint = `Ciclo de auditoria concluído: o parecer em layout vertical A4 está pronto em PDF (${relPdf}) para revisão e assinatura.`;
      } else {
        nextHint = `Ciclo de auditoria concluído: o parecer em layout vertical A4 está pronto em PDF (${relPdf}) e DOCX (${relOutput}) para revisão e assinatura.`;
      }
    } else {
      nextHint =
        "Ciclo de auditoria concluído: o parecer em layout vertical A4 (zero tabelas) está pronto em output/ para revisão e assinatura.";
    }
  }

  const payload: GenerateAuditDocxSyntheticResult = {
    status: "success",
    engine_version: VERSION,
    ...(docType !== "AUDIT_REPORT" ? { document_type: docType } : {}),
    outputPath: relOutput,
    ...(relPdf ? { pdf_path: relPdf } : {}),
    message: result.message,
    next_step_hint: nextHint,
  };

  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 900) {
    payload.message = "Documento gerado com sucesso.";
  }

  return payload;
}

export const formatAuditDocxSyntheticResult =
  formatGenerateAuditDocxSyntheticResult;
