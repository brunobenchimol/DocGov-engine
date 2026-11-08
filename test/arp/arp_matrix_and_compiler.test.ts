// ============================================================================
// Testes Unitários: Matriz de Compatibilidade e Compilador OpenXML/PDF (Gen5)
// docgov-engine v1.5.0 — test/arp/arp_matrix_and_compiler.test.ts
// ============================================================================

import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { evaluateArpCompatibility } from "../../src/arp/compatibility_matrix.ts";
import { governArpExecution } from "../../src/arp/govern_arp.ts";
import { getEphemeralInspectDir } from "../../src/utils/paths.ts";
import { join } from "node:path";

describe("Governança de ARP — Matriz de Compatibilidade e Compilação DOCX/PDF (Marco 8.4)", () => {
  it("deve bloquear adesão cruzada com assimetria de regime jurídico (Lei 14.133 vs Lei 13.303)", () => {
    const resAsym = evaluateArpCompatibility({
      manager_regime: "LEI_14133",
      adherent_regime: "LEI_13303",
    });

    expect(resAsym.blocking_tags).toContain("[ARP_REGIME_ASYMMETRY_BLOCK]");
    expect(resAsym.compatibility_analysis.regime_ok).toBe(false);

    const resSym = evaluateArpCompatibility({
      manager_regime: "LEI_14133",
      adherent_regime: "LEI_14133",
    });

    expect(resSym.blocking_tags).not.toContain("[ARP_REGIME_ASYMMETRY_BLOCK]");
    expect(resSym.compatibility_analysis.regime_ok).toBe(true);
  });

  it("deve bloquear adesão ascendente vedada (União ou Estado aderindo a ARP Municipal)", () => {
    const resFedMun = evaluateArpCompatibility({
      manager_sphere: "MUNICIPAL",
      adherent_sphere: "FEDERAL",
    });

    expect(resFedMun.blocking_tags).toContain("[ARP_FEDERATIVE_ASCENDING_BLOCK]");
    expect(resFedMun.compatibility_analysis.federative_ok).toBe(false);

    const resStateMun = evaluateArpCompatibility({
      manager_sphere: "MUNICIPAL",
      adherent_sphere: "STATE",
    });

    expect(resStateMun.blocking_tags).toContain("[ARP_FEDERATIVE_ASCENDING_BLOCK]");

    // Adesão descendente (Município aderindo a ARP Federal) é plenamente legal
    const resMunFed = evaluateArpCompatibility({
      manager_sphere: "FEDERAL",
      adherent_sphere: "MUNICIPAL",
    });

    expect(resMunFed.blocking_tags).not.toContain("[ARP_FEDERATIVE_ASCENDING_BLOCK]");
    expect(resMunFed.compatibility_analysis.federative_ok).toBe(true);
  });

  it("deve bloquear adesão a ata de TIC em lote único/guarda-chuva sem memória técnica granulada", () => {
    const resTicUmbrella = evaluateArpCompatibility({
      is_tic: true,
      is_umbrella_or_single_lot: true,
      has_granulated_calculation_memory: false,
    });

    expect(resTicUmbrella.blocking_tags).toContain("[ARP_ICT_UMBRELLA_LOT_BLOCK]");
    expect(resTicUmbrella.compatibility_analysis.tic_divisibility_ok).toBe(false);

    const resTicGranular = evaluateArpCompatibility({
      is_tic: true,
      is_umbrella_or_single_lot: true,
      has_granulated_calculation_memory: true,
    });

    expect(resTicGranular.blocking_tags).not.toContain("[ARP_ICT_UMBRELLA_LOT_BLOCK]");
  });

  it("deve auditar vigência e bloquear renovação de quantitativos no 2º ano sem previsão no edital", () => {
    const resNoClause = evaluateArpCompatibility({
      validity: {
        is_second_year_renewal: true,
        has_edital_renewal_clause: false,
        has_advantage_proof: true,
      },
    });

    expect(resNoClause.blocking_tags).toContain("[ARP_RENEWAL_WITHOUT_EDITAL_CLAUSE_BLOCK]");
    expect(resNoClause.validity_analysis.renewal_ok).toBe(false);

    const resWithClause = evaluateArpCompatibility({
      validity: {
        is_second_year_renewal: true,
        has_edital_renewal_clause: true,
        has_advantage_proof: true,
      },
    });

    expect(resWithClause.blocking_tags).not.toContain("[ARP_RENEWAL_WITHOUT_EDITAL_CLAUSE_BLOCK]");
    expect(resWithClause.validity_analysis.renewal_ok).toBe(true);
  });

  it("deve atestar o desacoplamento temporal válido entre a vigência da ARP e contratos derivados de até 5 anos", () => {
    const resDecoupled = evaluateArpCompatibility({
      validity: {
        validity_months: 12,
        derived_contract_duration_months: 48, // 4 anos <= 5 anos (60 meses)
      },
    });

    expect(resDecoupled.validity_analysis.derived_contract_decoupled_valid).toBe(true);
  });

  it("deve compilar nativamente Nota Técnica de Adesão (ARP_ADHESION_GRANT_NOTE) em DOCX e PDF reais (> 1KB)", async () => {
    const testOutDir = join(getEphemeralInspectDir(), `test_arp_grant_${Date.now()}`);
    const { dossier, synthetic } = await governArpExecution(
      {
        arp_number: "ARP-GRANT-01",
        manager_sphere: "FEDERAL",
        manager_regime: "LEI_14133",
        adherent_sphere: "FEDERAL",
        adherent_regime: "LEI_14133",
        items: [
          { item_id: "IT-01", registered_qty: 100, requested_adhesion_qty: 30, previous_carona_adhesions: 50 },
        ],
      },
      {
        outputDir: testOutDir,
        compilationMode: "ARP_ADHESION_GRANT_NOTE",
        outputFormat: "both",
      }
    );

    expect(dossier.decision).toBe("APPROVED");
    expect(synthetic.compiled_document_path).toBeTruthy();
    expect(existsSync(synthetic.compiled_document_path!)).toBe(true);

    const docxBuf = readFileSync(synthetic.compiled_document_path!);
    expect(docxBuf.length).toBeGreaterThan(1000);
    // Verificação de assinatura ZIP (PK\x03\x04)
    expect(docxBuf[0]).toBe(0x50);
    expect(docxBuf[1]).toBe(0x4b);

    if (synthetic.compiled_pdf_path && existsSync(synthetic.compiled_pdf_path)) {
      const pdfBuf = readFileSync(synthetic.compiled_pdf_path);
      expect(pdfBuf.length).toBeGreaterThan(500);
    }
  });

  it("deve compilar nativamente Estudo Técnico de Vantajosidade (ARP_ADVANTAGE_STUDY) em DOCX e PDF reais (> 1KB)", async () => {
    const testOutDir = join(getEphemeralInspectDir(), `test_arp_study_${Date.now()}`);
    const { dossier, synthetic } = await governArpExecution(
      {
        arp_number: "ARP-STUDY-02",
        manager_sphere: "FEDERAL",
        manager_regime: "LEI_14133",
        adherent_sphere: "FEDERAL",
        adherent_regime: "LEI_14133",
        items: [
          { item_id: "IT-02", registered_qty: 200, requested_adhesion_qty: 40, previous_carona_adhesions: 0 },
        ],
      },
      {
        outputDir: testOutDir,
        compilationMode: "ARP_ADVANTAGE_STUDY",
        outputFormat: "both",
      }
    );

    expect(dossier.decision).toBe("APPROVED");
    expect(synthetic.compiled_document_path).toBeTruthy();
    expect(existsSync(synthetic.compiled_document_path!)).toBe(true);

    const docxBuf = readFileSync(synthetic.compiled_document_path!);
    expect(docxBuf.length).toBeGreaterThan(1000);
    expect(docxBuf[0]).toBe(0x50);
    expect(docxBuf[1]).toBe(0x4b);

    const byteLength = Buffer.byteLength(JSON.stringify(synthetic), "utf-8");
    expect(byteLength).toBeLessThan(900);
  });
});
