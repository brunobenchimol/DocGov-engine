// ============================================================================
// Testes Unitários e Lockstep Gen5.5: PAS, Glosa ANS/IMR, Garantias e Cesta IN 65
// docgov-engine v1.5.5 — test/contracts/gen5_5_pas_and_basket.test.ts
// ============================================================================

import { describe, it, expect } from "bun:test";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { auditPasSanctionsAndGuarantees } from "../../src/contracts/pas_sanction_auditor.ts";
import { auditPriceBasketAndRebalance } from "../../src/contracts/price_basket_auditor.ts";
import { auditContractExecution } from "../../src/contracts/audit_contract_execution.ts";
import { handleContractsCli } from "../../src/cli/contracts_cli.ts";
import { handleCallTool } from "../../src/mcp/server.ts";
import { getEphemeralInspectDir } from "../../src/utils/paths.ts";

async function assertValidOpcDocxPackage(docxPath: string): Promise<void> {
  const zip = await JSZip.loadAsync(readFileSync(docxPath));
  const contentTypesXml = await zip.file("[Content_Types].xml")?.async("string");
  const rootRelsXml = await zip.file("_rels/.rels")?.async("string");
  expect(contentTypesXml).toBeDefined();
  expect(contentTypesXml).toContain("http://schemas.openxmlformats.org/package/2006/content-types");
  expect(contentTypesXml).toContain("application/vnd.openxmlformats-package.relationships+xml");
  expect(contentTypesXml).not.toContain("application/vnd.openxmlformats-officedocument.relationships+xml");
  expect(rootRelsXml).toBeDefined();
  expect(rootRelsXml).toContain("http://schemas.openxmlformats.org/package/2006/relationships");
  expect(zip.file("word/document.xml")).not.toBeNull();
  expect(zip.file("word/styles.xml")).not.toBeNull();
}

describe("Fiscalização Contratual Gen5.5 — PAS, ANS/IMR, Garantias e Cesta (Marco 8.5)", () => {
  it("Sub-Assert 30.9a: deve disparar simultaneamente as 4 tags críticas de PAS, Glosa, Multa > 30% e Seguro-Garantia", () => {
    const res = auditPasSanctionsAndGuarantees({
      contract_id: "CT-PAS-30-9A",
      legal_regime: "LEI_14133",
      pas_sanction: {
        opened_formal_pas: false,
        defense_deadline_business_days: 5,
        penalty_type: "MULTA",
        proposed_fine_pct: 45.0,
        ans_glosa_applied_as_punitive_sanction: true,
        has_surety_bond: true,
        surety_insurer_notified: false,
      },
    });

    expect(res.blocking_tags).toContain("[PAS_CONTRADICTORY_15_DAYS_VIOLATION_BLOCK]");
    expect(res.blocking_tags).toContain("[MULTA_BELOW_LEGAL_FLOOR_0_5PCT_OR_ABOVE_30PCT_BLOCK]");
    expect(res.blocking_tags).toContain("[SLA_GLOSA_MISCLASSIFIED_AS_PENALTY_BLOCK]");
    expect(res.blocking_tags).toContain("[SURETY_INSURER_NOTIFICATION_REQUIRED_BLOCK]");
    expect(res.violations_count).toBe(1);
  });

  it("Sub-Assert 30.9b: deve bloquear multa abaixo do piso legal de 0,5% na Lei 14.133/2021", () => {
    const res = auditPasSanctionsAndGuarantees({
      contract_id: "CT-PAS-30-9B",
      legal_regime: "LEI_14133",
      pas_sanction: {
        opened_formal_pas: true,
        prior_notification_sent: true,
        defense_deadline_business_days: 15,
        penalty_type: "MULTA",
        proposed_fine_pct: 0.1,
      },
    });

    expect(res.blocking_tags).toEqual([
      "[MULTA_BELOW_LEGAL_FLOOR_0_5PCT_OR_ABOVE_30PCT_BLOCK]",
    ]);
  });

  it("deve aprovar glosa remuneratória legítima dentro das faixas do IMR e PAS regular com 15 dias úteis", () => {
    const resGlosa = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_14133",
      sla_glosa: {
        indicator_id: "IMR-01",
        within_imr_bands: true,
        classified_as: "REMUNERATORY_GLOSA",
        invoice_gross_value: 100000,
        discount_pct: 4.5,
      },
    });
    expect(resGlosa.blocking_tags).toHaveLength(0);
    expect(resGlosa.processes[0].remuneratory_glosa_value).toBe(4500);
    expect(resGlosa.processes[0].recommended_sanction).toBe("NONE_REMUNERATORY_GLOSA_ONLY");

    const resValidPas = auditPasSanctionsAndGuarantees({
      legal_regime: "LEI_14133",
      pas_sanction: {
        process_id: "PAS-OK-01",
        opened_formal_pas: true,
        prior_notification_sent: true,
        defense_deadline_business_days: 15,
        infraction_article: "ART_155_VIII",
        penalty_type: "MULTA",
        proposed_fine_pct: 10.0,
        guarantee_modality: "SURETY_BOND",
        insurer_notified: true,
      },
    });
    expect(resValidPas.blocking_tags).toHaveLength(0);
    expect(resValidPas.processes[0].recommended_sanction).toBe("DECLARACAO_INIDONEIDADE");
    expect(resValidPas.processes[0].recommended_scope).toBe("ALL_SPHERES");
  });

  it("Sub-Assert 30.10: deve calcular estatísticas IN 65/2021 e disparar tags de dispersão (> 25%) e risco na contratada", () => {
    const res = auditPriceBasketAndRebalance({
      price_basket: {
        quotes: [100.0, 105.0, 95.0, 275.0],
        selected_metric: "MEAN",
        claimed_reference_price: 143.75,
      },
      rebalance_claim: {
        event_description: "Oscilacao cambial ordinaria de insumos previstos em contrato",
        risk_allocated_to: "CONTRACTOR",
        is_extraordinary_unforeseeable: false,
      },
    });

    expect(res.blocking_tags).toContain("[PRICE_BASKET_HIGH_DISPERSION_USE_MEDIAN]");
    expect(res.blocking_tags).toContain("[EXTRAORDINARY_RISK_ALLOCATED_TO_CONTRACTOR_BLOCK]");

    const item = res.price_basket_analysis.items[0];
    expect(item.mean).toBe(143.75);
    expect(item.median).toBe(102.5);
    expect(item.cv_pct).toBeGreaterThan(25);
    expect(item.outliers_removed).toEqual([275]);
    expect(item.sanitized_mean).toBe(100);
    expect(item.recommended_method).toBe("MEDIAN");
    expect(item.recommended_reference_price).toBe(102.5);
  });

  it("deve aprovar cesta que adote Mediana sob alta dispersão e revisão extraordinária alocada à Administração", () => {
    const res = auditPriceBasketAndRebalance({
      price_basket: {
        quotes: [100.0, 105.0, 95.0, 275.0],
        selected_metric: "MEDIAN",
        claimed_reference_price: 102.5,
      },
      rebalance_claim: {
        event_description: "Fato do principe tributario superveniente",
        risk_allocated_to: "ADMINISTRATION",
        is_extraordinary_unforeseeable: true,
      },
    });

    expect(res.blocking_tags).toHaveLength(0);
    expect(res.extraordinary_rebalance_analysis.events[0].eligible_for_revision).toBe(true);
  });

  it("Sub-Assert 30.11a: deve compilar Notificacao PAS (PAS_NOTIFICATION) em DOCX e PDF", async () => {
    const outDir = join(getEphemeralInspectDir(), `test_gen55_notif_${Date.now()}`);
    mkdirSync(outDir, { recursive: true });
    const jsonPath = join(outDir, "contrato_30_11a.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        contract_id: "CT-GEN55-01A",
        legal_regime: "LEI_14133",
        object_type: "SERVICE",
        initial_value: 500000,
        pas_sanction: {
          opened_formal_pas: false,
          defense_deadline_business_days: 5,
          penalty_type: "MULTA",
          proposed_fine_pct: 45.0,
          ans_glosa_applied_as_punitive_sanction: true,
          has_surety_bond: true,
          surety_insurer_notified: false,
        },
      }),
      "utf-8"
    );

    const okNotif = await handleContractsCli([
      "audit-contract",
      "--input",
      jsonPath,
      "--output-dir",
      outDir,
      "--mode",
      "PAS_NOTIFICATION",
      "--format",
      "both",
    ]);
    expect(okNotif).toBe(true);

    const notifDocx = join(outDir, "Notificacao_Previa_Descumprimento_e_PAS.docx");
    const notifPdf = join(outDir, "Notificacao_Previa_Descumprimento_e_PAS.pdf");
    expect(existsSync(notifDocx)).toBe(true);
    expect(existsSync(notifPdf)).toBe(true);
    expect(statSync(notifDocx).size).toBeGreaterThan(1000);
    expect(statSync(notifPdf).size).toBeGreaterThan(500);
    await assertValidOpcDocxPackage(notifDocx);
  }, 15000);

  it("Sub-Assert 30.11b: deve compilar Parecer de Dosimetria (DOSIMETRY_OPINION) em DOCX e PDF", async () => {
    const outDir = join(getEphemeralInspectDir(), `test_gen55_opinion_${Date.now()}`);
    mkdirSync(outDir, { recursive: true });
    const jsonPath = join(outDir, "contrato_30_11b.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        contract_id: "CT-GEN55-01B",
        legal_regime: "LEI_14133",
        object_type: "SERVICE",
        initial_value: 500000,
        pas_sanction: {
          opened_formal_pas: true,
          prior_notification_sent: true,
          defense_deadline_business_days: 15,
          penalty_type: "MULTA",
          proposed_fine_pct: 10.0,
        },
        price_basket: {
          quotes: [100.0, 105.0, 95.0, 275.0],
          selected_metric: "MEAN",
          claimed_reference_price: 143.75,
        },
      }),
      "utf-8"
    );

    const okOpinion = await handleContractsCli([
      "audit-contract",
      "--input",
      jsonPath,
      "--output-dir",
      outDir,
      "--mode",
      "DOSIMETRY_OPINION",
      "--format",
      "both",
    ]);
    expect(okOpinion).toBe(true);

    const opinionDocx = join(outDir, "Parecer_Dosimetria_Sancao_ou_Glosa_ANS.docx");
    const opinionPdf = join(outDir, "Parecer_Dosimetria_Sancao_ou_Glosa_ANS.pdf");
    expect(existsSync(opinionDocx)).toBe(true);
    expect(existsSync(opinionPdf)).toBe(true);
    expect(statSync(opinionDocx).size).toBeGreaterThan(1000);
    expect(statSync(opinionPdf).size).toBeGreaterThan(500);
    await assertValidOpcDocxPackage(opinionDocx);
  }, 15000);

  it("Sub-Assert 30.12: deve respeitar < 900B no MCP/CLI e propagar todas as tags para JSON e MD", async () => {
    const outDir = join(getEphemeralInspectDir(), `test_gen55_mcp_${Date.now()}`);
    mkdirSync(outDir, { recursive: true });
    const jsonPath = join(outDir, "contrato_30_12.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        contract_id: "CT-GEN55-02",
        legal_regime: "LEI_14133",
        object_type: "SERVICE",
        initial_value: 500000,
        pas_sanction: {
          opened_formal_pas: false,
          defense_deadline_business_days: 5,
          penalty_type: "MULTA",
          proposed_fine_pct: 45.0,
          ans_glosa_applied_as_punitive_sanction: true,
          has_surety_bond: true,
          surety_insurer_notified: false,
        },
        price_basket: {
          quotes: [100.0, 105.0, 95.0, 275.0],
          selected_metric: "MEAN",
          claimed_reference_price: 143.75,
        },
      }),
      "utf-8"
    );

    const mcpRes: any = await handleCallTool("docgov_audit_contract_execution", {
      contractJsonPath: jsonPath,
      outputDir: outDir,
      compilationMode: "SANCTION_DOSIMETRY_OPINION",
      outputFormat: "docx",
    });

    const rawStdout = mcpRes.content[0].text;
    const byteLen = Buffer.byteLength(rawStdout, "utf-8");
    expect(byteLen).toBeLessThan(900);

    const parsed = JSON.parse(rawStdout);
    expect(parsed.blocking_tags).toContain("[PAS_CONTRADICTORY_15_DAYS_VIOLATION_BLOCK]");
    expect(parsed.blocking_tags).toContain("[MULTA_BELOW_LEGAL_FLOOR_0_5PCT_OR_ABOVE_30PCT_BLOCK]");
    expect(parsed.blocking_tags).toContain("[SLA_GLOSA_MISCLASSIFIED_AS_PENALTY_BLOCK]");
    expect(parsed.blocking_tags).toContain("[SURETY_INSURER_NOTIFICATION_REQUIRED_BLOCK]");
    expect(parsed.blocking_tags).toContain("[PRICE_BASKET_HIGH_DISPERSION_USE_MEDIAN]");

    const fullJson = readFileSync(join(outDir, "relatorio_fiscalizacao_contratual.json"), "utf-8");
    const fullMd = readFileSync(join(outDir, "dossie_fiscalizacao_contratual.md"), "utf-8");
    for (const tag of parsed.blocking_tags) {
      expect(fullJson).toContain(tag);
      expect(fullMd).toContain(tag);
    }

    const { synthetic } = await auditContractExecution(jsonPath, { outputDir: outDir });
    expect(Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8")).toBeLessThan(900);
  });
});
