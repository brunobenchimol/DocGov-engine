import { describe, it, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import {
  evaluateBiddingProposals,
  serializeBiddingSyntheticResult,
} from "../src/bidding/index.ts";

const tempDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "docgov-bidding-gen6-"));
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

describe("Marco 9 (Gen6) — Eixo A: Seleção do Fornecedor 360º TIC & ACT Forense", () => {
  it("deve aprovar modelagem Não-DEMO legítima com conversibilidade de ACT e índices contábeis conformes (< 900B)", async () => {
    const outDir = makeTmpDir();
    const { dossier, synthetic } = await evaluateBiddingProposals(
      {
        process_id: "PROC-TIC-OK-001",
        bidder_name: "EMPRESA_TIC_CONFORME",
        estimated_total_value: 1000000,
        ict_execution_model: {
          metric_type: "UST",
          is_demo_regime: false,
          has_complexity_weighted_activity_catalog: true,
          is_ust_equal_to_raw_hour: false,
          disables_linked_account_and_uses_ict_index: true,
        },
        proposal_exequibility: {
          offered_unit_value: 200,
          parametric_profile_floor_value: 180,
        },
        technical_qualification: {
          edital_metric: "UST",
          requires_identical_metric_only: false,
          allows_certificate_summation: true,
          required_parcels: [
            {
              description: "Sustentação",
              estimated_item_value: 500000,
              total_quantity: 10000,
              required_minimum_quantity: 4000,
            },
          ],
          presented_certificates: [
            { certificate_id: "C1", metric: "HORAS_TECNICAS", quantity: 3000 },
            { certificate_id: "C2", metric: "PF", quantity: 100 },
          ],
        },
        financial_qualification: {
          ativo_circulante: 600000,
          realizavel_longo_prazo: 100000,
          ativo_total: 1200000,
          passivo_circulante: 300000,
          passivo_nao_circulante: 200000,
          required_min_equity_or_capital_pct: 10,
          requires_cumulative_capital_and_equity: false,
        },
      },
      { outputDir: outDir, compilationMode: "NONE" }
    );

    expect(dossier.status).toBe("success");
    expect(dossier.decision).toBe("APPROVED");
    expect(dossier.blocking_tags).toEqual([]);
    expect(dossier.qualification.conversion_applied).toBe(true);
    expect(dossier.qualification.converted_total_quantity).toBe(4200);
    expect(dossier.qualification.financial_indices).toEqual({
      ilg: 1.4,
      ilc: 2,
      isg: 2.4,
      eg: 0.42,
    });
    expect(Buffer.byteLength(serializeBiddingSyntheticResult(synthetic), "utf-8")).toBeLessThan(900);
    expect(existsSync(join(outDir, "dossie_julgamento_proposta_tic.json"))).toBe(true);
    expect(existsSync(join(outDir, "relatorio_julgamento_tic.json"))).toBe(true);
    expect(existsSync(join(outDir, "visao_julgamento_proposta_tic.md"))).toBe(true);
    expect(existsSync(join(outDir, "dossie_julgamento_tic.md"))).toBe(true);
  });

  it("deve detectar DEMO Trap, Súmula 269 (UST=Hora), HST sem teto e Súmula 262 via flags flat e aninhadas", async () => {
    const outDir = makeTmpDir();
    const { dossier } = await evaluateBiddingProposals(
      {
        process_id: "PROC-TIC-BLOCK-002",
        has_hidden_labor_dedication_trap: true,
        ust_equals_raw_hour_without_catalog: true,
        below_profile_floor: true,
        sumula_262_diligence_opened: false,
        rejects_equivalent_metric_conversion: true,
        forbids_certificate_summation_without_justification: true,
        requires_cumulative_capital_and_equity: true,
        required_min_equity_or_capital_pct: 15,
      },
      { outputDir: outDir, compilationMode: "NONE" }
    );

    expect(dossier.status).toBe("blocked");
    expect(dossier.blocking_tags).toContain("[ICT_HIDDEN_LABOR_DEDICATION_DEMO_TRAP_BLOCK]");
    expect(dossier.blocking_tags).toContain("[ICT_UST_RAW_HOUR_EQUIVALENCE_SUMULA269_BLOCK]");
    expect(dossier.blocking_tags).toContain("[ICT_PROPOSAL_BELOW_PROFILE_FLOOR_INEXEQUIBLE]");
    expect(dossier.blocking_tags).toContain("[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]");
    expect(dossier.blocking_tags).toContain("[ICT_ACT_RIGID_METRIC_RESTRICTION_BLOCK]");
    expect(dossier.blocking_tags).toContain("[SUM_OF_CERTIFICATES_MANDATORY_BLOCK]");
    expect(dossier.blocking_tags).toContain("[CUMULATIVE_CAPITAL_AND_EQUITY_BLOCK]");
    expect(dossier.blocking_tags).toContain("[FINANCIAL_EQUITY_EXCEEDS_10PCT_CAP_BLOCK]");

    const hstRes = await evaluateBiddingProposals(
      {
        process_id: "PROC-HST-003",
        ict_execution_model: {
          metric_type: "HST",
          has_prior_closed_os_hour_ceiling: false,
          has_exceptional_hst_justification: false,
        },
        technical_qualification: {
          required_parcels: [
            {
              description: "Parcela Irrelevante",
              estimated_item_value: 20000,
              total_quantity: 100,
              required_minimum_quantity: 60,
            },
          ],
        },
        estimated_total_value: 1000000,
      },
      { outputDir: makeTmpDir(), compilationMode: "NONE" }
    );
    expect(hstRes.dossier.blocking_tags).toContain("[ICT_UNBOUNDED_TECHNICAL_HOUR_PARADOX_BLOCK]");
    expect(hstRes.dossier.blocking_tags).toContain("[TECH_CAPACITY_EXCEEDS_50PCT_BLOCK]");
    expect(hstRes.dossier.blocking_tags).toContain("[IRRELEVANT_PARCEL_BELOW_4PCT_BLOCK]");
  });

  it("deve acionar todos os 7 Vetores Forenses de ACT e compilar peças DOCX/PDF com Via A e Via B", async () => {
    const outDir = makeTmpDir();
    const { dossier, synthetic } = await evaluateBiddingProposals(
      {
        process_id: "PROC-ACT-FORENSE-004",
        bidder_name: "LICITANTE_SUSPEITA_LTDA",
        act_forensic_items: [
          {
            certificate_id: "ACT-FRAUD-1",
            issuer_name: "PADARIA_EMISSORA_MEI",
            issuer_cnpj: "99.888.777/0001-66",
            issuer_type: "PUBLIC",
            issuer_porte: "MEI",
            issuer_cnae_primary: "4721-1/02",
            issuer_cnae_compatible_with_ict: false,
            issuer_cnpj_status: "BAIXADA",
            issuer_opening_date: "2024-06-01",
            issuer_status_date: "2025-01-10",
            execution_start_date: "2023-02-01",
            act_issue_date: "2025-03-01",
            pncp_contract_verified: false,
            issuer_qsa_partners: ["SOCIO_X"],
            bidder_qsa_partners: ["SOCIO_X"],
            same_address_or_cep: true,
            shared_or_free_email_domain: true,
            act_description_text: "Prestacao de servicos especializados de desenvolvimento em arquitetura de microsservicos cloud native e sustentacao continua",
            edital_tr_reference_text: "Prestacao de servicos especializados de desenvolvimento em arquitetura de microsservicos cloud native e sustentacao continua",
            attested_volume: 60000,
            execution_months: 2,
            max_plausible_monthly_capacity: 4000,
            pdf_creation_date: "2026-01-15",
            digital_signature_date: "2026-01-15",
            is_second_copy_declared: false,
          },
        ],
      },
      { outputDir: outDir, compilationMode: "BOTH", outputFormat: "both" }
    );

    expect(dossier.act_forensics.total_alerts).toBe(7);
    expect(dossier.blocking_tags).toContain("[ACT_ISSUER_CNAE_OR_SCALE_MISMATCH_SUSPICION]");
    expect(dossier.blocking_tags).toContain("[ACT_CHRONOLOGY_OR_INACTIVE_CNPJ_FRAUD_BLOCK]");
    expect(dossier.blocking_tags).toContain("[ACT_PUBLIC_CONTRACT_UNVERIFIED_IN_PNCP]");
    expect(dossier.blocking_tags).toContain("[ACT_RELATED_PARTY_SELF_ATTESTATION_ALERT]");
    expect(dossier.blocking_tags).toContain("[ACT_LITERAL_EDITAL_PLAGIARISM_DETECTED]");
    expect(dossier.blocking_tags).toContain("[ACT_IMPLAUSIBLE_VOLUME_TIME_RATIO_ALERT]");
    expect(dossier.blocking_tags).toContain("[ACT_FORENSIC_SIGNATURE_DATE_MISMATCH]");

    const judgmentDocx = dossier.compiled_artifacts?.judgment_opinion_docx_path!;
    const diligenceDocx = dossier.compiled_artifacts?.act_diligence_docx_path!;
    expect(existsSync(judgmentDocx)).toBe(true);
    expect(existsSync(diligenceDocx)).toBe(true);
    expect(existsSync(dossier.compiled_artifacts?.act_diligence_pdf_path!)).toBe(true);

    const zip = await JSZip.loadAsync(readFileSync(diligenceDocx));
    const docXml = await zip.file("word/document.xml")!.async("string");
    expect(docXml).toContain("<w:tbl>");
    expect(docXml).toContain("Receita Federal");
    expect(docXml).toContain("Emissor");
    expect(docXml).toContain("44 dígitos");
    expect(docXml).toContain("SEFIP");
    expect(docXml).toContain("eSocial");

    const serialized = serializeBiddingSyntheticResult(synthetic);
    expect(Buffer.byteLength(serialized, "utf-8")).toBeLessThan(900);
  }, 30000);
});
