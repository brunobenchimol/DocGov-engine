import { describe, it, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import JSZip from "jszip";
import {
  evaluateBiddingProposals,
  serializeBiddingSyntheticResult,
} from "../src/bidding/index.ts";
import { runCli } from "../src/cli/index.ts";

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

    const judgmentZip = await JSZip.loadAsync(readFileSync(judgmentDocx));
    const judgmentXml = await judgmentZip.file("word/document.xml")!.async("string");
    expect(judgmentXml).toContain("<w:tbl>");
    expect(judgmentXml).toContain("1. Identificação Processual e Síntese Executiva do Julgamento");
    expect(judgmentXml).toContain("5. Auditoria Pericial e Forense dos Atestados de Capacidade Técnica");
    expect(judgmentXml).toContain("6. Quadro Consolidado de Apontamentos, Recomendações e Dispositivo Conclusivo");
    expect(judgmentXml).toContain("Lei Federal nº 14.133/2021");
    expect(judgmentXml).toContain("Vetor 1 — Incompatibilidade de Porte e Objeto Social");
    expect(judgmentXml).toContain("[ACT_CHRONOLOGY_OR_INACTIVE_CNPJ_FRAUD_BLOCK]");
    expect(judgmentXml).not.toContain("Decisão: REJECTED");

    const zip = await JSZip.loadAsync(readFileSync(diligenceDocx));
    const docXml = await zip.file("word/document.xml")!.async("string");
    expect(docXml).toContain("<w:tbl>");
    expect(docXml).toContain("VIA A");
    expect(docXml).toContain("VIA B");
    expect(docXml).toContain("Receita Federal");
    expect(docXml).toContain("Emissor");
    expect(docXml).toContain("44 dígitos");
    expect(docXml).toContain("SEFIP");
    expect(docXml).toContain("eSocial");
    expect(docXml).toContain("Arts. 299");
    expect(docXml).toContain("337-I");
    expect(docXml).not.toContain("VETOR_1_PORTE_CNAE");

    const serialized = serializeBiddingSyntheticResult(synthetic);
    expect(Buffer.byteLength(serialized, "utf-8")).toBeLessThan(900);
  }, 30000);

  it("deve compilar Parecer Jurídico-Pericial TIC em Lei 13.303 com BRL formatado e perfis sem logs crus", async () => {
    const outDir = makeTmpDir();
    const { dossier } = await evaluateBiddingProposals(
      {
        process_id: "PROC-PERICIAL-13303",
        bidder_name: "TIC_EMPRESARIAL_SA",
        bidder_cnpj: "12.345.678/0001-90",
        legal_regime: "LEI_13303",
        estimated_total_value: 2500000,
        ict_execution_model: { metric_type: "UST", has_complexity_weighted_activity_catalog: true },
        proposal_exequibility: {
          offered_unit_value: 140,
          profiles_breakdown: [
            { profile_name: "Arquiteto Cloud Sênior", salary_floor: 15000, social_charges_pct: 70, taxes_and_admin_pct: 18, monthly_productive_units: 168 },
          ],
          summary_disqualification_attempted: true,
        },
        financial_qualification: {
          ativo_circulante: 1800000,
          passivo_circulante: 900000,
          ativo_total: 3000000,
          capital_social: 500000,
          patrimonio_liquido: 800000,
        },
      },
      { outputDir: outDir, compilationMode: "PROPOSAL_JUDGMENT_OPINION", outputFormat: "docx" }
    );

    const judgmentDocx = dossier.compiled_artifacts?.judgment_opinion_docx_path!;
    expect(existsSync(judgmentDocx)).toBe(true);
    const zip = await JSZip.loadAsync(readFileSync(judgmentDocx));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Lei Federal nº 13.303/2016");
    expect(xml).toContain("R$ 2.500.000,00");
    expect(xml).toContain("R$ 140,00");
    expect(xml).toContain("Arquiteto Cloud Sênior");
    expect(xml).toContain("[SUMULA_262_DILIGENCE_REQUIRED_BLOCK]");
    expect(xml).not.toContain("Regime: LEI_13303");
  });

  it("deve rotear evaluate-proposals via runCli e entrypoint src/index.ts sem cair no servidor MCP", async () => {
    const outDir = makeTmpDir();
    const jsonIn = join(outDir, "proposta_cli.json");
    writeFileSync(
      jsonIn,
      JSON.stringify({
        process_id: "PROC-CLI-TIC-01",
        bidder_name: "EMPRESA_CLI_TESTE",
        has_hidden_labor_dedication_trap: true,
      }),
      "utf-8"
    );

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logs.push(args.map(String).join(" "));
    try {
      await runCli([
        "evaluate-proposals",
        "--bidding-json",
        jsonIn,
        "--output-dir",
        outDir,
        "--mode",
        "NONE",
      ]);
    } finally {
      console.log = origLog;
    }

    const cliOut = JSON.parse(logs.join("\n"));
    expect(cliOut.process_id).toBe("PROC-CLI-TIC-01");
    expect(cliOut.blocking_tags).toContain("[ICT_HIDDEN_LABOR_DEDICATION_DEMO_TRAP_BLOCK]");

    const subOutDir = makeTmpDir();
    const entryRes = spawnSync(
      process.execPath,
      [
        "run",
        resolve(import.meta.dir, "..", "src", "index.ts"),
        "evaluate-proposals",
        "--bidding-json",
        jsonIn,
        "--output-dir",
        subOutDir,
        "--mode",
        "NONE",
      ],
      { encoding: "utf-8", timeout: 10000 }
    );
    expect(entryRes.status).toBe(0);
    const subParsed = JSON.parse(entryRes.stdout.trim());
    expect(subParsed.process_id).toBe("PROC-CLI-TIC-01");
    expect(existsSync(join(subOutDir, "dossie_julgamento_proposta_tic.json"))).toBe(true);
    expect(existsSync(join(subOutDir, "relatorio_julgamento_tic.json"))).toBe(true);
    expect(existsSync(join(subOutDir, "visao_julgamento_proposta_tic.md"))).toBe(true);
    expect(existsSync(join(subOutDir, "dossie_julgamento_tic.md"))).toBe(true);
  }, 15000);

  it("deve detectar conluio entre propostas, ACT com Canva (>180d), inexequibilidade 75%/85% e compilar peças recursais Art. 165", async () => {
    const outDir = makeTmpDir();
    const actStructPath = join(outDir, "estrutura_act.json");
    writeFileSync(
      actStructPath,
      JSON.stringify({
        forensic_meta: {
          source_format: "pdf",
          title: "ACT",
          author: "EMPRESA_CONCLUIO_LTDA",
          last_modified_by: null,
          creator_tool: "Canva",
          producer: "Canva",
          company: null,
          template: null,
          revision_count: null,
          creation_date_iso: "2026-10-01T10:00:00.000Z",
          mod_date_iso: "2026-11-01T10:00:00.000Z",
          has_digital_signature: false,
          signature_date_iso: null,
          editing_software_traces: ["Canva"],
          forensic_anomalies: ["[PDF_EDITOR_MANIPULATION_TRACE]"],
        },
      }),
      "utf-8"
    );

    const collusionAndInex = await evaluateBiddingProposals(
      {
        process_id: "PROC-GEN6-FORENSE-02",
        bidder_name: "EMPRESA_CONCLUIO_LTDA",
        is_engineering_or_works: true,
        estimated_budget_value: 1000000,
        offered_proposal_value: 700000,
        ict_execution_model: { metric_type: "UST", has_complexity_weighted_activity_catalog: true },
        act_forensic_items: [
          {
            certificate_id: "ACT-META-01",
            issuer_name: "ORGAO_A",
            act_issue_date: "2024-01-15",
            act_structure_json_path: actStructPath,
          },
        ],
        competing_proposals_meta: [
          {
            proposal_file_name: "proposta_empresa_a.pdf",
            forensic_meta: {
              source_format: "pdf",
              title: "Prop A",
              author: "Operador_Comum_XY",
              last_modified_by: null,
              creator_tool: "Microsoft Word",
              producer: "Word PDF",
              company: null,
              template: null,
              revision_count: null,
              creation_date_iso: "2026-11-10T14:00:00.000Z",
              mod_date_iso: null,
              has_digital_signature: false,
              signature_date_iso: null,
              editing_software_traces: [],
              forensic_anomalies: [],
            },
          },
          {
            proposal_file_name: "proposta_empresa_b.pdf",
            forensic_meta: {
              source_format: "pdf",
              title: "Prop B",
              author: "Operador_Comum_XY",
              last_modified_by: null,
              creator_tool: "Microsoft Word",
              producer: "Word PDF",
              company: null,
              template: null,
              revision_count: null,
              creation_date_iso: "2026-11-10T14:00:45.000Z",
              mod_date_iso: null,
              has_digital_signature: false,
              signature_date_iso: null,
              editing_software_traces: [],
              forensic_anomalies: [],
            },
          },
        ],
      },
      { outputDir: outDir, compilationMode: "NONE" }
    );

    expect(collusionAndInex.dossier.blocking_tags).toContain("[ACT_FORENSIC_SIGNATURE_DATE_MISMATCH]");
    expect(collusionAndInex.dossier.blocking_tags).toContain("[ACT_PDF_EDITING_SOFTWARE_TRACE_SUSPICION]");
    expect(collusionAndInex.dossier.blocking_tags).toContain("[BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT]");
    expect(collusionAndInex.dossier.blocking_tags).toContain("[INEXEQUIBILITY_75_PCT_PRESUMPTION_DILIGENCE_REQUIRED]");
    expect(collusionAndInex.dossier.blocking_tags).toContain("[INEXEQUIBILITY_ADDITIONAL_GUARANTEE_85_PCT_REQUIRED]");
    expect(collusionAndInex.dossier.inexequibility_check?.additional_guarantee_amount).toBe(150000);

    const appealRes = await evaluateBiddingProposals(
      {
        process_id: "PROC-REC-165",
        bidder_name: "RECORRENTE_GENERICA",
        ict_execution_model: { metric_type: "UST", has_complexity_weighted_activity_catalog: true },
        appeal_context: {
          appeal_type: "RAZOES",
          appellant_name: "RECORRENTE_GENERICA",
          intent_manifested_timely: true,
          reasons_business_days_elapsed: 4,
          declared_intent_scope: "qualificação técnica atestado UST",
          appeal_reasons_scope: "balanço patrimonial índice contábil ILG",
        },
      },
      { outputDir: outDir, compilationMode: "APPEALS_BUNDLE", outputFormat: "both" }
    );

    expect(appealRes.dossier.decision).toBe("REJECTED");
    expect(appealRes.dossier.blocking_tags).toContain("[APPEAL_UNTIMELY_3_BUSINESS_DAYS_BLOCK]");
    expect(appealRes.dossier.blocking_tags).toContain("[APPEAL_THEMATIC_INNOVATION_OUTSIDE_INTENT_BLOCK]");
    expect(existsSync(appealRes.dossier.compiled_artifacts?.appeal_petition_docx_path!)).toBe(true);
    expect(existsSync(appealRes.dossier.compiled_artifacts?.appeal_petition_pdf_path!)).toBe(true);
    expect(existsSync(appealRes.dossier.compiled_artifacts?.pregoeiro_decision_docx_path!)).toBe(true);
    expect(existsSync(appealRes.dossier.compiled_artifacts?.pregoeiro_decision_pdf_path!)).toBe(true);

    // Regressão v1.6.2 hotfix: bloco de assinatura sem iteração de caracteres nem </w:p>,<w:p>
    const appealZip = await JSZip.loadAsync(
      readFileSync(appealRes.dossier.compiled_artifacts!.appeal_petition_docx_path!)
    );
    const appealXml = await appealZip.file("word/document.xml")!.async("string");
    expect(appealXml).not.toContain("</w:p>,<w:p>");
    expect(appealXml).toContain("Representante / Peticionário — RECORRENTE_GENERICA</w:t>");
    expect((appealXml.match(/______________________________________________________________/g) || []).length).toBe(1);

    const decisionZip = await JSZip.loadAsync(
      readFileSync(appealRes.dossier.compiled_artifacts!.pregoeiro_decision_docx_path!)
    );
    const decisionXml = await decisionZip.file("word/document.xml")!.async("string");
    expect(decisionXml).not.toContain("</w:p>,<w:p>");
    expect(decisionXml).toContain("Agente de Contratação / Pregoeiro — ORGAO_CONTRATANTE</w:t>");
    expect((decisionXml.match(/______________________________________________________________/g) || []).length).toBe(1);
  }, 20000);
});
