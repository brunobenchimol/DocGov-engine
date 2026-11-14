import { describe, it, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  auditDirectContracting,
  serializeDirectContractingSyntheticResult,
} from "../src/direct_contracting/index.ts";

const tempDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "docgov-direct-gen6-"));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const d of tempDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

describe("Marco 9 (Gen6) — Eixo B: Contratação Direta & Oportunidade Estatal", () => {
  it("deve bloquear Inexigibilidade com atestado genérico (Súmula 255) e < 3 NFs/contratos de mercado", async () => {
    const outDir = makeTmpDir();
    const { dossier, synthetic } = await auditDirectContracting(
      {
        process_id: "PROC-INEX-001",
        modality: "INEXIGIBILITY",
        exclusivity_certificate_valid: false,
        price_proof_invoices_count: 2,
      },
      { outputDir: outDir, compilationMode: "DIRECT_CONTRACTING_OPINION", outputFormat: "both" }
    );

    expect(dossier.status).toBe("blocked");
    expect(dossier.decision).toBe("REJECTED");
    expect(dossier.blocking_tags).toContain("[INVALID_EXCLUSIVITY_CERTIFICATE_BLOCK]");
    expect(dossier.blocking_tags).toContain("[INEXIGIBILITY_PRICE_PROOF_INSUFFICIENT_BLOCK]");
    expect(existsSync(dossier.compiled_artifacts?.opinion_docx_path!)).toBe(true);
    expect(existsSync(dossier.compiled_artifacts?.opinion_pdf_path!)).toBe(true);
    expect(existsSync(join(outDir, "dossie_contratacao_direta.json"))).toBe(true);
    expect(existsSync(join(outDir, "relatorio_contratacao_direta.json"))).toBe(true);
    expect(existsSync(join(outDir, "visao_contratacao_direta.md"))).toBe(true);
    expect(existsSync(join(outDir, "dossie_contratacao_direta.md"))).toBe(true);
    expect(Buffer.byteLength(serializeDirectContractingSyntheticResult(synthetic), "utf-8")).toBeLessThan(900);
  }, 30000);

  it("deve bloquear Dispensa por Valor com fracionamento anual na mesma UG e PDM/CATMAT/CATSER", async () => {
    const outDir = makeTmpDir();
    const { dossier } = await auditDirectContracting(
      {
        process_id: "PROC-DISP-002",
        modality: "DISPENSATION_BY_VALUE",
        pdm_catmat_catser: "CATSER-25992",
        legal_annual_limit: 62725.59,
        prior_accumulated_spend_in_branch: 45000,
        current_proposed_spend: 25000,
      },
      { outputDir: outDir, compilationMode: "NONE" }
    );

    expect(dossier.status).toBe("blocked");
    expect(dossier.blocking_tags).toContain("[EXPENSE_FRAGMENTATION_BLOCK]");
    expect(dossier.dispensation_summary?.fragmentation_detected).toBe(true);
  });

  it("deve validar Oportunidade de Negócio Estatal (Art. 28 § 3º II Lei 13.303) bloqueando compra comum disfarçada", async () => {
    const outDir = makeTmpDir();
    const blocked = await auditDirectContracting(
      {
        process_id: "PROC-EST-003",
        modality: "STATE_ENTERPRISE_OPPORTUNITY",
        has_partner_uniqueness_justification: false,
        is_ordinary_commodity_disguised: true,
      },
      { outputDir: outDir, compilationMode: "NONE" }
    );
    expect(blocked.dossier.status).toBe("blocked");
    expect(blocked.dossier.blocking_tags).toContain("[STATE_ENTERPRISE_PARTNERSHIP_UNJUSTIFIED_BLOCK]");

    const approved = await auditDirectContracting(
      {
        process_id: "PROC-EST-004",
        modality: "OPORTUNIDADE_NEGOCIO_ESTATAL",
        state_enterprise_opportunity_details: {
          is_linked_to_corporate_purpose: true,
          partner_competitive_singularity_proven: true,
          competitive_procedure_infeasibility_proven: true,
          has_risk_and_revenue_sharing_matrix: true,
          is_ordinary_commodity_disguised: false,
        },
      },
      { outputDir: makeTmpDir(), compilationMode: "NONE" }
    );
    expect(approved.dossier.status).toBe("success");
    expect(approved.dossier.decision).toBe("APPROVED");
  });
});
