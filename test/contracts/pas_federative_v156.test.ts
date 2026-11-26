// ============================================================================
// Testes Unitários e Lockstep Gen5.6: PAS Federativo e Dosimetria LINDB Art. 22
// docgov-engine v1.5.6 — test/contracts/pas_federative_v156.test.ts
// Sub-Asserts 30.13 a 30.16 (Marco 8.6)
// ============================================================================

import { describe, it, expect, afterAll } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { auditPasSanctionsAndGuarantees } from "../../src/contracts/pas_sanction_auditor.ts";
import { auditContractExecution } from "../../src/contracts/audit_contract_execution.ts";
import { resolveCompetentAuditCourt } from "../../src/contracts/pas_federative_dosimetry.ts";
import { handleCallTool } from "../../src/mcp/server.ts";
import { extractPdfPages } from "../../src/utils/pdf.ts";

const gen56TempRoot = mkdtempSync(join(tmpdir(), "docgov_test_gen56_"));
afterAll(() => { rmSync(gen56TempRoot, { recursive: true, force: true }); });

async function readDocxMainXml(docxPath: string): Promise<string> {
  const zip = await JSZip.loadAsync(readFileSync(docxPath));
  expect(zip.file("[Content_Types].xml")).not.toBeNull();
  expect(zip.file("_rels/.rels")).not.toBeNull();
  const docXml = await zip.file("word/document.xml")?.async("string");
  expect(docXml).toBeDefined();
  return docXml || "";
}

describe("Fiscalização Contratual Gen5.6 — PAS Federativo e Dosimetria LINDB (Marco 8.6)", () => {
  it("Sub-Assert 30.13a: deve bloquear impedimento Estadual/Municipal com alcance nacional ou > 36 meses", () => {
    const resScope = auditPasSanctionsAndGuarantees({
      contract_id: "CT-86-TERR-01",
      legal_regime: "LEI_14133",
      pas_evaluation: { sphere: "MUNICIPAL", uf: "PA", municipality: "MUNICIPIO_GENERICO", sanction_type: "IMPEDIMENTO_LICITAR_CONTRATAR", sanction_scope_claimed: "NATIONAL", duration_months: 24, opened_formal_pas: true, prior_notification_sent: true, defense_deadline_business_days: 15 },
    });
    expect(resScope.blocking_tags).toEqual(["[PAS_SANCTION_TERRITORIAL_SCOPE_MISMATCH_BLOCK]"]);
    expect(resScope.competent_audit_court).toBe("TCM-PA");
    expect(resScope.processes[0].federative_adequacy?.territorial_scope_ok).toBe(false);

    const resDuration = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_14133",
      pas_evaluation: { sphere: "STATE", uf: "MG", sanction_type: "IMPEDIMENTO_LICITAR_CONTRATAR", sanction_scope_claimed: "FEDERATIVE_ENTITY", duration_months: 48, opened_formal_pas: true, prior_notification_sent: true, defense_deadline_business_days: 15 },
    });
    expect(resDuration.blocking_tags).toEqual(["[PAS_SANCTION_TERRITORIAL_SCOPE_MISMATCH_BLOCK]"]);
    expect(resDuration.competent_audit_court).toBe("TCE-MG");

    const resOk = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_14133",
      pas_evaluation: { sphere: "STATE", uf: "PA", sanction_type: "IMPEDIMENTO_LICITAR_CONTRATAR", sanction_scope_claimed: "FEDERATIVE_ENTITY", duration_months: 24, opened_formal_pas: true, prior_notification_sent: true, defense_deadline_business_days: 15 },
    });
    expect(resOk.blocking_tags).toHaveLength(0);
    expect(resOk.processes[0].federative_adequacy?.territorial_scope_ok).toBe(true);
  });

  it("Sub-Assert 30.13b: deve aplicar regime estrito de Estatais (Lei 13.303 <= 24m sem inidoneidade)", () => {
    const resOver24 = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_13303",
      pas_evaluation: { sphere: "FEDERAL", sanction_type: "SUSPENSAO_TEMPORARIA", sanction_scope_claimed: "OWN_ENTITY", duration_months: 36, opened_formal_pas: true, prior_notification_sent: true, defense_deadline_business_days: 15 },
    });
    expect(resOver24.blocking_tags).toEqual(["[PAS_STATE_ENTERPRISE_SANCTION_REGIME_MISMATCH_BLOCK]"]);

    const resDebarment13303 = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_13303",
      pas_evaluation: { sphere: "STATE", uf: "PR", sanction_type: "DECLARACAO_INIDONEIDADE", duration_months: 24, opened_formal_pas: true, prior_notification_sent: true, defense_deadline_business_days: 15 },
    });
    expect(resDebarment13303.blocking_tags).toContain("[PAS_STATE_ENTERPRISE_SANCTION_REGIME_MISMATCH_BLOCK]");

    const resValid13303 = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_13303",
      pas_evaluation: { sphere: "FEDERAL", sanction_type: "SUSPENSAO_TEMPORARIA", sanction_scope_claimed: "OWN_ENTITY", duration_months: 18, opened_formal_pas: true, prior_notification_sent: true, defense_deadline_business_days: 15 },
    });
    expect(resValid13303.blocking_tags).toHaveLength(0);
    expect(resValid13303.processes[0].recommended_sanction).toBe("SUSPENSAO_TEMPORARIA_13303");
  });

  it("Sub-Assert 30.14a: deve bloquear declaração de inidoneidade por autoridade incompetente ou sem parecer jurídico", () => {
    const resIncompetent = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_14133",
      pas_evaluation: { sphere: "STATE", uf: "PA", sanction_type: "DECLARACAO_INIDONEIDADE", duration_months: 48, signing_authority_role: "FISCAL_CONTRATO", has_conclusive_legal_opinion: false, opened_formal_pas: true, prior_notification_sent: true, defense_deadline_business_days: 15 },
    });
    expect(resIncompetent.blocking_tags).toEqual(["[PAS_INCOMPETENT_AUTHORITY_FOR_DEBARMENT_BLOCK]"]);
    expect(resIncompetent.processes[0].federative_adequacy?.authority_competent_ok).toBe(false);
    expect(resIncompetent.processes[0].federative_adequacy?.conclusive_legal_opinion_ok).toBe(false);

    const resValid = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_14133",
      pas_evaluation: { sphere: "STATE", uf: "PA", sanction_type: "DECLARACAO_INIDONEIDADE", duration_months: 48, signing_authority_role: "SECRETARIO_ESTADUAL", has_conclusive_legal_opinion: true, registries_commanded: ["CEIS", "CNEP", "PNCP", "TCE-PA"], opened_formal_pas: true, prior_notification_sent: true, defense_deadline_business_days: 15 },
    });
    expect(resValid.blocking_tags).toHaveLength(0);
    expect(resValid.processes[0].federative_adequacy?.authority_competent_ok).toBe(true);
    expect(resValid.processes[0].federative_adequacy?.registries_ok).toBe(true);
  });

  it("Sub-Assert 30.14b: deve resolver cortes de contas federativas e alertar omissão em CEIS/CNEP/PNCP/TCE-TCM", () => {
    expect(resolveCompetentAuditCourt("FEDERAL")).toBe("TCU");
    expect(resolveCompetentAuditCourt("STATE", "DF")).toBe("TCDF");
    expect(resolveCompetentAuditCourt("STATE", "PA")).toBe("TCE-PA");
    expect(resolveCompetentAuditCourt("MUNICIPAL", "SP", "São Paulo")).toBe("TCM-SP");
    expect(resolveCompetentAuditCourt("MUNICIPAL", "RJ", "Rio de Janeiro")).toBe("TCM-RIO");
    expect(resolveCompetentAuditCourt("MUNICIPAL", "PA", "MUNICIPIO_GENERICO")).toBe("TCM-PA");
    expect(resolveCompetentAuditCourt("MUNICIPAL", "BA", "MUNICIPIO_GENERICO")).toBe("TCM-BA");
    expect(resolveCompetentAuditCourt("MUNICIPAL", "GO", "MUNICIPIO_GENERICO")).toBe("TCM-GO");
    expect(resolveCompetentAuditCourt("MUNICIPAL", "MG", "MUNICIPIO_GENERICO")).toBe("TCE-MG");
    expect(resolveCompetentAuditCourt("MUNICIPAL", "SP", "MUNICIPIO_GENERICO")).toBe("TCE-SP");

    const resOmission = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_14133",
      pas_evaluation: {
        sphere: "MUNICIPAL",
        uf: "PA",
        municipality: "MUNICIPIO_GENERICO",
        sanction_type: "IMPEDIMENTO_LICITAR_CONTRATAR",
        sanction_scope_claimed: "FEDERATIVE_ENTITY",
        duration_months: 12,
        registries_commanded: ["CEIS", "PNCP"],
        opened_formal_pas: true,
        prior_notification_sent: true,
        defense_deadline_business_days: 15,
      },
    });
    expect(resOmission.blocking_tags).toEqual(["[PAS_EXTERNAL_CONTROL_REGISTRY_OMISSION_ALERT]"]);
    expect(resOmission.processes[0].federative_adequacy?.missing_registries).toEqual(["CNEP", "TCM-PA"]);
  });

  it("Sub-Assert 30.15: deve detectar dosimetria arbitrária sem precedentes/LINDB e outlier desproporcional", () => {
    const resArbitrary = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_14133",
      pas_evaluation: {
        sphere: "STATE",
        uf: "CE",
        penalty_type: "MULTA",
        proposed_fine_pct: 12.0,
        opened_formal_pas: true,
        prior_notification_sent: true,
        defense_deadline_business_days: 15,
        dosimetry_evaluation: {
          benchmark_precedents: [],
          lindb_art22_weighed: false,
        },
      },
    });
    expect(resArbitrary.blocking_tags).toEqual(["[PAS_ARBITRARY_UNANCHORED_DOSIMETRY_ALERT]"]);

    const resOutlier = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_14133",
      pas_evaluation: {
        sphere: "STATE",
        uf: "PA",
        infraction_severity: "LOW",
        penalty_type: "MULTA",
        multa_pct: 25.0,
        opened_formal_pas: true,
        prior_notification_sent: true,
        defense_deadline_business_days: 15,
        dosimetry_benchmark: {
          juris_precedent_id: "Acórdão TCE-PA 101/2025",
          benchmark_range_pct: [2, 5],
          benchmark_median_pct: 3.5,
          is_primary_offender: true,
          concrete_damage_proven: false,
          aggravating_factors_proven: false,
          lindb_art22_weighed: true,
        },
      },
    });
    expect(resOutlier.blocking_tags).toEqual(["[PAS_DISPROPORTIONATE_SANCTION_OUTLIER_BLOCK]"]);
    expect(resOutlier.processes[0].dosimetry_calibration?.outlier_detected).toBe(true);
    expect(resOutlier.processes[0].dosimetry_calibration?.proportionality_ok).toBe(false);

    const resCalibratedOk = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_14133",
      pas_evaluation: {
        sphere: "STATE",
        uf: "PA",
        infraction_severity: "LOW",
        penalty_type: "MULTA",
        proposed_fine_pct: 4.0,
        opened_formal_pas: true,
        prior_notification_sent: true,
        defense_deadline_business_days: 15,
        dosimetry_benchmark: {
          juris_precedent_id: "Acórdão TCE-PA 101/2025",
          benchmark_range_pct: [2, 5],
          benchmark_median_pct: 3.5,
          is_primary_offender: true,
          concrete_damage_proven: false,
          aggravating_factors_proven: false,
          lindb_art22_weighed: true,
        },
      },
    });
    expect(resCalibratedOk.blocking_tags).toHaveLength(0);
    expect(resCalibratedOk.processes[0].dosimetry_calibration?.calibrated_with_precedents).toBe(true);
    expect(resCalibratedOk.processes[0].dosimetry_calibration?.proportionality_ok).toBe(true);
  });

  it("Sub-Assert 30.16: deve compilar DOCX/PDF com quadros federativo/LINDB e respeitar MCP < 900B", async () => {
    const outDir = join(gen56TempRoot, `test_gen56_mcp_${Date.now()}`);
    mkdirSync(outDir, { recursive: true });
    const jsonPath = join(outDir, "contrato_30_16.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        contract_id: "CT-GEN56-3016",
        legal_regime: "LEI_14133",
        object_type: "SERVICE",
        initial_value: 400000,
        pas_evaluation: {
          process_id: "PAS-86-01",
          sphere: "MUNICIPAL",
          uf: "PA",
          municipality: "MUNICIPIO_GENERICO",
          sanction_type: "IMPEDIMENTO_LICITAR_CONTRATAR",
          sanction_scope_claimed: "NATIONAL",
          duration_months: 24,
          multa_pct: 25.0,
          infraction_severity: "LOW",
          registries_commanded: ["CEIS", "PNCP"],
          opened_formal_pas: true,
          prior_notification_sent: true,
          defense_deadline_business_days: 15,
          dosimetry_benchmark: {
            juris_precedent_id: "TCM-PA-Res-2025",
            benchmark_range_pct: [2, 5],
            benchmark_median_pct: 3.5,
            aggravating_factors_proven: false,
            lindb_art22_weighed: true,
          },
        },
      }),
      "utf-8"
    );

    const mcpRes: any = await handleCallTool("docgov_audit_contract_execution", {
      contractJsonPath: jsonPath,
      outputDir: outDir,
      compilationMode: "BOTH",
      outputFormat: "both",
    });

    const rawStdout = mcpRes.content[0].text;
    expect(Buffer.byteLength(rawStdout, "utf-8")).toBeLessThan(900);

    const parsed = JSON.parse(rawStdout);
    expect(parsed.blocking_tags).toContain("[PAS_SANCTION_TERRITORIAL_SCOPE_MISMATCH_BLOCK]");
    expect(parsed.blocking_tags).toContain("[PAS_EXTERNAL_CONTROL_REGISTRY_OMISSION_ALERT]");
    expect(parsed.blocking_tags).toContain("[PAS_DISPROPORTIONATE_SANCTION_OUTLIER_BLOCK]");

    const reportJson = JSON.parse(
      readFileSync(join(outDir, "relatorio_fiscalizacao_contratual.json"), "utf-8")
    );
    expect(reportJson.pas_sanctions_analysis.competent_audit_court).toBe("TCM-PA");
    expect(reportJson.pas_sanctions_analysis.processes[0].competent_audit_court).toBe("TCM-PA");
    expect(reportJson.pas_sanctions_analysis.processes[0].federative_adequacy.missing_registries).toEqual([
      "CNEP",
      "TCM-PA",
    ]);
    expect(reportJson.pas_sanctions_analysis.processes[0].dosimetry_calibration.outlier_detected).toBe(true);

    const dossierMd = readFileSync(join(outDir, "dossie_fiscalizacao_contratual.md"), "utf-8");
    expect(dossierMd).toContain("TCM-PA");

    const notifDocx = join(outDir, "Notificacao_Previa_Descumprimento_e_PAS.docx");
    const notifPdf = join(outDir, "Notificacao_Previa_Descumprimento_e_PAS.pdf");
    const opinionDocx = join(outDir, "Parecer_Dosimetria_Sancao_ou_Glosa_ANS.docx");
    const opinionPdf = join(outDir, "Parecer_Dosimetria_Sancao_ou_Glosa_ANS.pdf");

    for (const p of [notifDocx, notifPdf, opinionDocx, opinionPdf]) {
      expect(existsSync(p)).toBe(true);
      expect(statSync(p).size).toBeGreaterThan(500);
    }

    for (const docxPath of [notifDocx, opinionDocx]) {
      const xml = await readDocxMainXml(docxPath);
      expect(xml).toContain("Quadro de Enquadramento Jurisdicional");
      expect(xml).toContain("TCM-PA");
      expect(xml).toContain("CEIS");
      expect(xml).toContain("CNEP");
      expect(xml).toContain("PNCP");
      expect(xml).toContain("Quadro de Calibragem Jurisprudencial da Dosimetria");
      expect(xml).toContain("LINDB");
      expect(xml).toContain("Art. 22");
    }

    const pdfExtraction = await extractPdfPages(readFileSync(opinionPdf));
    const pdfText = pdfExtraction.lines.map((l) => l.text).join("\n");
    expect(pdfText).toContain("TCM-PA");
    expect(pdfText).toContain("LINDB");
    expect(pdfText).toContain("Art. 22");
    expect(pdfText).toContain("CEIS");
  }, 20000);

  it("Estresse Combinado 12 Tags (6 da v1.5.5 + 6 da v1.5.6): mantém payload MCP stdio < 900 bytes sem truncar tags nem JSON em disco", async () => {
    const outDir = join(gen56TempRoot, `test_gen56_stress12_${Date.now()}`);
    mkdirSync(outDir, { recursive: true });
    const jsonPath = join(outDir, "stress_12_tags.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        contract_id: "CONTRATO_ESTRESSE_12_TAGS_2026",
        legal_regime: "LEI_14133",
        object_type: "SERVICOS",
        original_value: 1000000,
        has_surety_bond: true,
        pas_sanctions: [
          { process_id: "PAS-GLOSA-01", is_imr_classified_as_sanction: true, penalty_type: "MULTA", opened_formal_pas: true, defense_deadline_business_days: 15, insurer_notified: true },
          { process_id: "PAS-MULTA-02", sanction_type: "MULTA", fine_pct: 35, opened_formal_pas: true, defense_deadline_business_days: 5, has_surety_bond: true, insurer_notified: false },
          {
            process_id: "PAS-FED-03", sphere: "MUNICIPAL", uf: "PA", municipality: "MUNICIPIO_GENERICO",
            legal_regime: "LEI_14133", sanction_type: "IMPEDIMENTO_LICITAR_CONTRATAR", sanction_scope_claimed: "NATIONAL",
            duration_months: 48, fine_pct: 25, registries_commanded: ["CEIS"], opened_formal_pas: true,
            defense_deadline_business_days: 15, insurer_notified: true,
            dosimetry_benchmark: { juris_precedent_id: "TCE-PA-2025", benchmark_range_pct: [2, 5], benchmark_median_pct: 3.5, aggravating_factors_proven: false, lindb_art22_weighed: true },
          },
          { process_id: "PAS-ESTATAL-04", sphere: "STATE", uf: "SP", legal_regime: "LEI_13303", sanction_type: "DECLARACAO_INIDONEIDADE", duration_months: 36, opened_formal_pas: true, defense_deadline_business_days: 15, insurer_notified: true },
          {
            process_id: "PAS-INID-05", sphere: "STATE", uf: "PA", legal_regime: "LEI_14133", sanction_type: "DECLARACAO_INIDONEIDADE",
            signing_authority_role: "FISCAL_CONTRATO", has_conclusive_legal_opinion: false, fine_pct: 10, opened_formal_pas: true,
            defense_deadline_business_days: 15, insurer_notified: true,
            dosimetry_benchmark: { lindb_art22_weighed: false, has_jurisprudential_calibration: false },
          },
        ],
        price_basket: [{ item_id: "ITEM-1", quotes: [100, 110, 500], selected_method: "MEAN" }],
        rebalance_requests: [{ id: "REQ-1", event_nature: "EXTRAORDINARY_UNFORESEEN", risk_allocated_to: "CONTRACTOR", request_accepted: true }],
      }),
      "utf-8"
    );

    const mcpRes: any = await handleCallTool("docgov_audit_contract_execution", { contractJsonPath: jsonPath, outputDir: outDir });
    const rawStdout = mcpRes.content[0].text;
    const byteLen = Buffer.byteLength(rawStdout, "utf-8");
    expect(byteLen).toBeLessThan(900);
    expect(byteLen).toBeLessThanOrEqual(850);

    const parsed = JSON.parse(rawStdout);
    const expected12Tags = [
      "[SLA_GLOSA_MISCLASSIFIED_AS_PENALTY_BLOCK]", "[MULTA_BELOW_LEGAL_FLOOR_0_5PCT_OR_ABOVE_30PCT_BLOCK]",
      "[PAS_CONTRADICTORY_15_DAYS_VIOLATION_BLOCK]", "[SURETY_INSURER_NOTIFICATION_REQUIRED_BLOCK]",
      "[PRICE_BASKET_HIGH_DISPERSION_USE_MEDIAN]", "[EXTRAORDINARY_RISK_ALLOCATED_TO_CONTRACTOR_BLOCK]",
      "[PAS_SANCTION_TERRITORIAL_SCOPE_MISMATCH_BLOCK]", "[PAS_STATE_ENTERPRISE_SANCTION_REGIME_MISMATCH_BLOCK]",
      "[PAS_INCOMPETENT_AUTHORITY_FOR_DEBARMENT_BLOCK]", "[PAS_EXTERNAL_CONTROL_REGISTRY_OMISSION_ALERT]",
      "[PAS_ARBITRARY_UNANCHORED_DOSIMETRY_ALERT]", "[PAS_DISPROPORTIONATE_SANCTION_OUTLIER_BLOCK]",
    ];
    for (const tag of expected12Tags) expect(parsed.blocking_tags).toContain(tag);

    const reportJson = JSON.parse(readFileSync(join(outDir, "relatorio_fiscalizacao_contratual.json"), "utf-8"));
    expect(reportJson.blocking_tags.length).toBeGreaterThanOrEqual(12);
    for (const tag of expected12Tags) expect(reportJson.blocking_tags).toContain(tag);
  });

  it("Gen5.6+ Humanização Jurídica (Lei 13.303) & Dosimetria Não Calibrada (>=20% sem agravantes): prosa vernácula e zero falso PROPORCIONAL", async () => {
    const outDir = join(gen56TempRoot, `test_gen56_humanized_${Date.now()}`);
    mkdirSync(outDir, { recursive: true });
    const jsonPath = join(outDir, "contrato_estatal_uncalibrated.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        contract_id: "CONTRATO_ESTATAL_SP_2026",
        legal_regime: "LEI_13303",
        object_type: "SERVICOS",
        sphere: "STATE",
        uf: "SP",
        signing_authority: "ORDENADOR_DESPESA",
        has_conclusive_legal_opinion: false,
        pas_sanctions: [
          {
            process_id: "PAS-ESTATAL-HUM-01",
            sanction_type: "IMPEDIMENTO_LICITAR_CONTRATAR",
            fine_percentage: 28,
            opened_formal_pas: true,
            prior_notification_sent: true,
            defense_deadline_business_days: 15,
            lindb_art22_weighed: false,
            has_jurisprudential_calibration: false,
            aggravating_factors_proven: false,
          },
        ],
      }),
      "utf-8"
    );

    const mcpRes: any = await handleCallTool("docgov_audit_contract_execution", {
      contractJsonPath: jsonPath,
      outputDir: outDir,
      compilationMode: "BOTH",
      outputFormat: "both",
    });
    expect(Buffer.byteLength(mcpRes.content[0].text, "utf-8")).toBeLessThan(900);

    const reportJson = JSON.parse(readFileSync(join(outDir, "relatorio_fiscalizacao_contratual.json"), "utf-8"));
    expect(reportJson.blocking_tags).toContain("[PAS_DISPROPORTIONATE_SANCTION_OUTLIER_BLOCK]");
    expect(reportJson.blocking_tags).toContain("[PAS_ARBITRARY_UNANCHORED_DOSIMETRY_ALERT]");
    const proc0 = reportJson.pas_sanctions_analysis.processes[0];
    expect(proc0.federative_adequacy.signing_authority_role).toBe("ORDENADOR_DESPESA");
    expect(proc0.dosimetry_calibration.proportionality_ok).toBe(false);
    expect(proc0.dosimetry_calibration.outlier_detected).toBe(true);

    const notifXml = await readDocxMainXml(join(outDir, "Notificacao_Previa_Descumprimento_e_PAS.docx"));
    expect(notifXml).toContain("Lei Federal nº 13.303/2016");
    expect(notifXml).toContain("Prestação de Serviços");
    expect(notifXml).toContain("IMPEDIMENTO TÉCNICO-JURÍDICO IDENTIFICADO");
    expect(notifXml).toContain("Ordenador de Despesa");
    expect(notifXml).toContain("(Ref. de Auditoria:");
    expect(notifXml).not.toContain("ÓBICE DETECTADO:");
    expect(notifXml).not.toContain("APONTAMENTO CRÍTICO:");
    expect(notifXml).not.toContain("Autoridade: N/A");

    const opinionXml = await readDocxMainXml(join(outDir, "Parecer_Dosimetria_Sancao_ou_Glosa_ANS.docx"));
    expect(opinionXml).toContain("2. Enquadramento Jurisdicional e Calibragem da Dosimetria");
    expect(opinionXml).toContain("3. Conclusão, Enquadramento Jurídico e Determinações de Saneamento");
    expect(opinionXml).toContain("NÃO CALIBRADA");
    expect(opinionXml).not.toMatch(/\bPROPORCIONAL\b/);
    expect(opinionXml).not.toContain("Território=BLOQUEADO");
    expect(opinionXml).not.toContain("Comp=BLOQ");
    expect(opinionXml).not.toContain("Autoridade: N/A");
    expect(opinionXml).not.toContain("ÓBICE DETECTADO:");

    const notifPdfText = (await extractPdfPages(readFileSync(join(outDir, "Notificacao_Previa_Descumprimento_e_PAS.pdf")))).lines.map((l) => l.text).join(" ").replace(/\s+/g, " ");
    expect(notifPdfText).toContain("13.303/2016");
    expect(notifPdfText).toContain("Ordenador de Despesa");

    const opinionPdfText = (await extractPdfPages(readFileSync(join(outDir, "Parecer_Dosimetria_Sancao_ou_Glosa_ANS.pdf")))).lines.map((l) => l.text).join(" ").replace(/\s+/g, " ");
    expect(opinionPdfText).toContain("2. Enquadramento Jurisdicional");
    expect(opinionPdfText).toContain("3. Conclus");
    expect(opinionPdfText).not.toMatch(/\bPROPORCIONAL\b/);
  }, 20000);

  it("Aliases Naturais dos Agentes (price_basket objeto, precedent_fines_pct, sla_glosa_misclassified, defense_business_days, register_pncp, garantia e reequilibrio): todas as tags disparam de primeira", async () => {
    const outDir = join(gen56TempRoot, `test_natural_aliases_${Date.now()}`);
    mkdirSync(outDir, { recursive: true });
    const { report, synthetic } = await auditContractExecution(
      {
        contract_id: "CT-AGENT-ALIASES-01",
        legal_regime: "LEI_14133",
        sphere: "STATE",
        uf: "PA",
        pas_processes: [
          {
            process_id: "PAS-ALIAS-01",
            sla_glosa_misclassified: true,
            defense_business_days: 10,
            register_pncp: false,
            garantia: { seguradora_notificada: false },
            multa_sancionatoria_proposta: { percentual: 25 },
            precedent_fines_pct: [2.0, 3.5, 5.0],
            aggravating_factors_proven: false,
            lindb_art22_weighed: true,
          },
        ],
        price_basket: { cotacoes: [390000, 405000, 410000, 780000] },
        reequilibrio: { alocacao_matriz_riscos: "CONTRATADA" },
      } as any,
      { outputDir: outDir, compilationMode: "NONE" }
    );
    expect(Buffer.byteLength(JSON.stringify(synthetic), "utf-8")).toBeLessThan(900);
    for (const tag of [
      "[PRICE_BASKET_HIGH_DISPERSION_USE_MEDIAN]",
      "[PAS_DISPROPORTIONATE_SANCTION_OUTLIER_BLOCK]",
      "[SLA_GLOSA_MISCLASSIFIED_AS_PENALTY_BLOCK]",
      "[PAS_CONTRADICTORY_15_DAYS_VIOLATION_BLOCK]",
      "[PAS_EXTERNAL_CONTROL_REGISTRY_OMISSION_ALERT]",
      "[SURETY_INSURER_NOTIFICATION_REQUIRED_BLOCK]",
      "[EXTRAORDINARY_RISK_ALLOCATED_TO_CONTRACTOR_BLOCK]",
    ]) {
      expect(report.blocking_tags).toContain(tag);
    }
    const cal = report.pas_sanctions_analysis?.processes[0]?.dosimetry_calibration;
    expect(cal?.benchmark_median_pct).toBe(3.5);
    expect(cal?.benchmark_range_pct).toEqual([2, 5]);
    expect(report.price_basket_analysis?.items_analyzed).toBe(1);

    const { report: rep2 } = await auditContractExecution(
      {
        contract_id: "CT-AGENT-ALIASES-02",
        legal_regime: "LEI_14133",
        sphere: "FEDERAL",
        ans_imr: { classificado_como_multa: true },
        defense_deadline_days: 15,
        defense_days_type: "CALENDAR",
        register_ceis_cnep: false,
        notify_audit_court: false,
        price_basket_items: { cotacoes: [{ valor: 100 }, { valor: 110 }, { valor: 500 }] },
        risk_matrix_events: [{ risco_alocado: "CONTRACTOR" }],
      } as any,
      { outputDir: outDir, compilationMode: "NONE" }
    );
    for (const tag of [
      "[SLA_GLOSA_MISCLASSIFIED_AS_PENALTY_BLOCK]",
      "[PAS_CONTRADICTORY_15_DAYS_VIOLATION_BLOCK]",
      "[PAS_EXTERNAL_CONTROL_REGISTRY_OMISSION_ALERT]",
      "[PRICE_BASKET_HIGH_DISPERSION_USE_MEDIAN]",
      "[EXTRAORDINARY_RISK_ALLOCATED_TO_CONTRACTOR_BLOCK]",
    ]) {
      expect(rep2.blocking_tags).toContain(tag);
    }
  });
});
