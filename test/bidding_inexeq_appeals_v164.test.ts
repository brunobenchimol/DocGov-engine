import { describe, expect, it, afterAll } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateBiddingProposals } from "../src/bidding/index.ts";
import { handleCallTool } from "../src/mcp/server.ts";

describe("Marco 9 (Gen6 v1.6.4) — Jogo de Planilha & Fase Recursal Completa Art. 165 / Acórdão 1211/2021", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "docgov_test_bid_v164_"));
  afterAll(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });
  it("deve detectar Jogo de Planilha via unit_items[] e via flag direta sem quebrar 75%/85%", async () => {
    const outDir = join(tempRoot, `test_jogo_planilha_${Date.now()}`);
    mkdirSync(outDir, { recursive: true });

    const viaItems = await evaluateBiddingProposals(
      {
        process_id: "PROC-JP-ITEMS",
        is_engineering_or_works: true,
        estimated_budget_value: 1000000,
        offered_proposal_value: 700000,
        proposal_exequibility: {
          unit_items: [
            { item_id: "1.1", estimated_unit_price: 100, offered_unit_price: 145 },
            { item_id: "1.2", estimated_unit_price: 200, offered_unit_price: 110 },
          ],
        },
      },
      { outputDir: outDir, compilationMode: "NONE" }
    );

    expect(viaItems.dossier.decision).toBe("REJECTED");
    expect(viaItems.dossier.blocking_tags).toContain("[UNIT_PRICE_OVERPRICING_JOGO_DE_PLANILHA_BLOCK]");
    expect(viaItems.dossier.blocking_tags).toContain("[INEXEQUIBILITY_75_PCT_PRESUMPTION_DILIGENCE_REQUIRED]");
    expect(viaItems.dossier.blocking_tags).toContain("[INEXEQUIBILITY_ADDITIONAL_GUARANTEE_85_PCT_REQUIRED]");
    expect(viaItems.dossier.inexequibility_check?.overpriced_unit_items_count).toBe(1);

    const viaFlagOnly = await evaluateBiddingProposals(
      {
        process_id: "PROC-JP-FLAG",
        jogo_de_planilha_detected: true,
      },
      { outputDir: outDir, compilationMode: "NONE" }
    );
    expect(viaFlagOnly.dossier.decision).toBe("REJECTED");
    expect(viaFlagOnly.dossier.blocking_tags).toContain("[UNIT_PRICE_OVERPRICING_JOGO_DE_PLANILHA_BLOCK]");
  });

  it("deve acionar os 4 novos marcadores recursais (Art. 165 e Acórdão TCU 1.211/2021) via MCP < 900B", async () => {
    const outDir = join(tempRoot, `test_appeals_v164_${Date.now()}`);
    mkdirSync(outDir, { recursive: true });

    const mcpRes: any = await handleCallTool("docgov_evaluate_bidding_proposals", {
      outputDir: outDir,
      compilationMode: "NONE",
      process_id: "PROC-APPEAL-FULL-164",
      appeal_context: {
        appeal_type: "RAZOES",
        intent_manifested_timely: true,
        intent_summary_rejection_attempted: true,
        edital_appeal_deadline_days: 2,
        reasons_business_days_elapsed: 4,
        pre_existing_document_submitted_on_appeal: true,
        reconsider_decision: false,
      },
    });

    const text = mcpRes.content[0].text;
    expect(Buffer.byteLength(text, "utf-8")).toBeLessThan(900);
    const synthetic = JSON.parse(text);
    expect(synthetic.status).toBe("blocked");
    expect(synthetic.decision).toBe("REJECTED");
    expect(synthetic.blocking_tags).toContain("[APPEAL_INTENTION_SUMMARY_REJECTION_ILLEGAL_BLOCK]");
    expect(synthetic.blocking_tags).toContain("[APPEAL_UNTIMELY_3_BUSINESS_DAYS_BLOCK]");
    expect(synthetic.blocking_tags).toContain("[APPEAL_DEADLINE_3_BUSINESS_DAYS_VIOLATION]");
    expect(synthetic.blocking_tags).toContain("[NEW_DOCUMENT_PRECLUSION_EXCEPTION_ACORDAO_1211_2021]");
    expect(synthetic.blocking_tags).toContain("[HIERARCHICAL_REMISSION_10_DAYS_MANDATORY]");
  });

  it("deve manter retrocompatibilidade total quando novos campos recursais opcionais não forem informados", async () => {
    const outDir = join(tempRoot, `test_appeals_retro_${Date.now()}`);
    mkdirSync(outDir, { recursive: true });

    const cleanRes = await evaluateBiddingProposals(
      {
        process_id: "PROC-APPEAL-OK",
        ict_execution_model: { metric_type: "UST", has_complexity_weighted_activity_catalog: true },
        appeal_context: {
          appeal_type: "CONTRARRAZOES",
          intent_manifested_timely: true,
          counter_reasons_business_days_elapsed: 2,
          declared_intent_scope: "qualificacao tecnica",
          appeal_reasons_scope: "qualificacao tecnica atestado",
        },
      },
      { outputDir: outDir, compilationMode: "NONE" }
    );

    expect(cleanRes.dossier.decision).toBe("APPROVED");
    expect(cleanRes.dossier.blocking_tags).toHaveLength(0);
  });

  it("Sonda Gen6-D (PE-055/2026-ENG): 14 tags simultâneas + APPEALS_BUNDLE both deve manter MCP <= 880B (< 900B) e 14/14 tags no disco", async () => {
    const outDir = join(tempRoot, `test_sonda_gen6d_${Date.now()}`);
    mkdirSync(outDir, { recursive: true });

    const mcpRes: any = await handleCallTool("docgov_evaluate_bidding_proposals", {
      outputDir: outDir,
      evaluationStance: "ATTACK",
      compilationMode: "APPEALS_BUNDLE",
      outputFormat: "both",
      process_id: "PE-055/2026-ENG",
      bidder_name: "CONSTRUTORA_SONDA_GEN6D",
      is_engineering_or_works: true,
      estimated_budget_value: 1000000,
      offered_proposal_value: 700000,
      summary_disqualification_attempted: true,
      has_unit_price_overpricing: true,
      proposal_exequibility: {
        unit_items: [{ item_id: "1.1", estimated_unit_price: 100, offered_unit_price: 130 }],
      },
      act_forensic_items: [
        {
          certificate_id: "ACT-S6D-01",
          issuer_name: "ORGAO_A",
          issuer_cnpj: "11.111.111/0001-11",
          act_issue_date: "2025-01-01",
          pdf_creation_date: "2026-10-01",
          editing_software_traces: ["iLovePDF", "SmallPDF"],
        },
      ],
      competing_proposals_meta: [
        {
          bidder_name: "EMPRESA_A",
          proposal_file_name: "prop_a.pdf",
          forensic_meta: {
            source_format: "pdf",
            title: "Proposta A",
            author: "Autor_Conluio_S6D",
            last_modified_by: null,
            creator_tool: "LibreOffice",
            producer: "LibreOffice PDF",
            company: null,
            template: null,
            revision_count: null,
            creation_date_iso: "2026-11-10T10:00:00.000Z",
            mod_date_iso: null,
            has_digital_signature: false,
            signature_date_iso: null,
            editing_software_traces: [],
            forensic_anomalies: [],
          },
        },
        {
          bidder_name: "EMPRESA_B",
          proposal_file_name: "prop_b.pdf",
          forensic_meta: {
            source_format: "pdf",
            title: "Proposta B",
            author: "Autor_Conluio_S6D",
            last_modified_by: null,
            creator_tool: "LibreOffice",
            producer: "LibreOffice PDF",
            company: null,
            template: null,
            revision_count: null,
            creation_date_iso: "2026-11-10T10:00:25.000Z",
            mod_date_iso: null,
            has_digital_signature: false,
            signature_date_iso: null,
            editing_software_traces: [],
            forensic_anomalies: [],
          },
        },
      ],
      appeal_context: {
        appeal_type: "RAZOES",
        intent_manifested_timely: false,
        intent_summary_rejection_attempted: true,
        edital_appeal_deadline_days: 2,
        reasons_business_days_elapsed: 5,
        declared_intent_scope: "exequibilidade BDI",
        appeal_reasons_scope: "certidao ambiental",
        pre_existing_document_submitted_on_appeal: true,
        reconsider_decision: false,
      },
    });

    const text = mcpRes.content[0].text;
    const byteLen = Buffer.byteLength(text, "utf-8");
    expect(byteLen).toBeLessThanOrEqual(880);
    expect(byteLen).toBeLessThan(900);

    const synthetic = JSON.parse(text);
    expect(synthetic.status).toBe("blocked");
    expect(synthetic.decision).toBe("REJECTED");
    expect(synthetic.blocking_tags.some((t: string) => t.endsWith("_TAGS_NO_DOSSIE]"))).toBe(true);

    const diskDossier = JSON.parse(
      readFileSync(join(outDir, "dossie_julgamento_proposta_tic.json"), "utf-8")
    );
    expect(diskDossier.blocking_tags).toHaveLength(14);
    expect(existsSync(join(outDir, "Peca_Razoes_ou_Contrarrazoes_Recurso_Administrativo.docx"))).toBe(true);
    expect(existsSync(join(outDir, "Peca_Razoes_ou_Contrarrazoes_Recurso_Administrativo.pdf"))).toBe(true);
    expect(existsSync(join(outDir, "Decisao_Pregoeiro_e_Encaminhamento_Autoridade_Superior.docx"))).toBe(true);
    expect(existsSync(join(outDir, "Decisao_Pregoeiro_e_Encaminhamento_Autoridade_Superior.pdf"))).toBe(true);
  }, 35000);
});
