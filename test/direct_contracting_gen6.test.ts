import { describe, it, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import JSZip from "jszip";
import {
  auditDirectContracting,
  serializeDirectContractingSyntheticResult,
} from "../src/direct_contracting/index.ts";
import { runCli } from "../src/cli/index.ts";

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
    const zip = await JSZip.loadAsync(readFileSync(dossier.compiled_artifacts?.opinion_docx_path!));
    const opinionXml = await zip.file("word/document.xml")!.async("string");
    expect(opinionXml).toContain("<w:tbl>");
    expect(opinionXml).toContain("1. Identificação Processual e Síntese Executiva");
    expect(opinionXml).toContain("2. Exame Analítico dos Requisitos Normativos da Modalidade");
    expect(opinionXml).toContain("3. Consolidação de Óbices Normativos, Recomendações e Conclusão");
    expect(opinionXml).toContain("Lei Federal nº 14.133/2021");
    expect(opinionXml).toContain("Súmula TCU nº 255");
    expect(opinionXml).toContain("[INVALID_EXCLUSIVITY_CERTIFICATE_BLOCK]");
    expect(opinionXml).toContain("[INEXIGIBILITY_PRICE_PROOF_INSUFFICIENT_BLOCK]");
    expect(opinionXml).not.toContain("Decisão: REJECTED");
    expect(existsSync(join(outDir, "dossie_contratacao_direta.json"))).toBe(true);
    expect(existsSync(join(outDir, "relatorio_contratacao_direta.json"))).toBe(true);
    expect(existsSync(join(outDir, "visao_contratacao_direta.md"))).toBe(true);
    expect(existsSync(join(outDir, "dossie_contratacao_direta.md"))).toBe(true);
    expect(Buffer.byteLength(serializeDirectContractingSyntheticResult(synthetic), "utf-8")).toBeLessThan(900);
  }, 30000);

  it("deve bloquear Dispensa por Valor com fracionamento anual na mesma UG e PDM/CATMAT/CATSER e compilar BRL formatado", async () => {
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
      { outputDir: outDir, compilationMode: "DIRECT_CONTRACTING_OPINION", outputFormat: "docx" }
    );

    expect(dossier.status).toBe("blocked");
    expect(dossier.blocking_tags).toContain("[EXPENSE_FRAGMENTATION_BLOCK]");
    expect(dossier.dispensation_summary?.fragmentation_detected).toBe(true);
    const zip = await JSZip.loadAsync(readFileSync(dossier.compiled_artifacts?.opinion_docx_path!));
    const dispXml = await zip.file("word/document.xml")!.async("string");
    expect(dispXml).toContain("CATSER-25992");
    expect(dispXml).toContain("R$ 45.000,00");
    expect(dispXml).toContain("R$ 25.000,00");
    expect(dispXml).toContain("R$ 70.000,00");
    expect(dispXml).toContain("R$ 62.725,59");
    expect(dispXml).toContain("R$ 7.274,41");
    expect(dispXml).toContain("[EXPENSE_FRAGMENTATION_BLOCK]");
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

  it("deve rotear audit-direct-contracting via runCli e entrypoint src/index.ts sem cair no servidor MCP", async () => {
    const outDir = makeTmpDir();
    const jsonIn = join(outDir, "direta_cli.json");
    writeFileSync(
      jsonIn,
      JSON.stringify({
        process_id: "PROC-CLI-DIR-01",
        modality: "INEXIGIBILITY",
        exclusivity_certificate_valid: false,
        price_proof_invoices_count: 1,
      }),
      "utf-8"
    );

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logs.push(args.map(String).join(" "));
    try {
      await runCli([
        "audit-direct-contracting",
        "--direct-json",
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
    expect(cliOut.process_id).toBe("PROC-CLI-DIR-01");
    expect(cliOut.blocking_tags).toContain("[INVALID_EXCLUSIVITY_CERTIFICATE_BLOCK]");

    const subOutDir = makeTmpDir();
    const entryRes = spawnSync(
      process.execPath,
      [
        "run",
        resolve(import.meta.dir, "..", "src", "index.ts"),
        "audit-direct-contracting",
        "--direct-json",
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
    expect(subParsed.process_id).toBe("PROC-CLI-DIR-01");
    expect(existsSync(join(subOutDir, "dossie_contratacao_direta.json"))).toBe(true);
    expect(existsSync(join(subOutDir, "relatorio_contratacao_direta.json"))).toBe(true);
    expect(existsSync(join(subOutDir, "visao_contratacao_direta.md"))).toBe(true);
    expect(existsSync(join(subOutDir, "dossie_contratacao_direta.md"))).toBe(true);
  }, 15000);

  it("deve detectar simulação de pesquisa de preços via metadados compartilhados e sobrepreço acima da mediana saneada na Inexigibilidade", async () => {
    const outDir = makeTmpDir();
    const { dossier } = await auditDirectContracting(
      {
        process_id: "PROC-INEX-OVERPRICE-04",
        modality: "INEXIGIBILIDADE",
        exclusivity_certificate_valid: true,
        offered_unit_price: 1850,
        inexigibility_details: {
          competition_infeasibility_proven: true,
          supplier_market_price_proofs: [
            { type: "NF", identifier: "NF-101", unit_price: 1000 },
            { type: "NF", identifier: "NF-102", unit_price: 1050 },
            { type: "CONTRATO", identifier: "CT-103", unit_price: 1100 },
          ],
        },
        quotations_forensic_meta: [
          {
            file_name: "cotacao_fornecedor_1.pdf",
            forensic_meta: {
              source_format: "pdf",
              title: "Cotacao 1",
              author: "Mesmo_Autor_Simulado",
              last_modified_by: null,
              creator_tool: "Microsoft Excel",
              producer: "Excel PDF",
              company: null,
              template: null,
              revision_count: null,
              creation_date_iso: "2026-11-12T09:00:00.000Z",
              mod_date_iso: null,
              has_digital_signature: false,
              signature_date_iso: null,
              editing_software_traces: [],
              forensic_anomalies: [],
            },
          },
          {
            file_name: "cotacao_fornecedor_2.pdf",
            forensic_meta: {
              source_format: "pdf",
              title: "Cotacao 2",
              author: "Mesmo_Autor_Simulado",
              last_modified_by: null,
              creator_tool: "Microsoft Excel",
              producer: "Excel PDF",
              company: null,
              template: null,
              revision_count: null,
              creation_date_iso: "2026-11-12T09:00:30.000Z",
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

    expect(dossier.status).toBe("blocked");
    expect(dossier.decision).toBe("REJECTED");
    expect(dossier.blocking_tags).toContain("[PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK]");
    expect(dossier.blocking_tags).toContain("[INEXIGIBILITY_OVERPRICING_ABOVE_SUPPLIER_MARKET_PROOF_BLOCK]");
    expect(dossier.inexigibility_summary?.sanitized_market_median).toBe(1050);

    // Garantia preventiva MCP (< 900B) em docgov_audit_direct_contracting sob múltiplos bloqueios + DOCX/PDF
    const { handleCallTool } = await import("../src/mcp/server.ts");
    const mcpDir = makeTmpDir();
    const mcpRes: any = await handleCallTool("docgov_audit_direct_contracting", {
      outputDir: mcpDir,
      compilationMode: "DIRECT_CONTRACTING_OPINION",
      outputFormat: "both",
      process_id: "PROC-INEX-MCP-STRESS-2026-LONGO",
      modality: "INEXIGIBILIDADE",
      exclusivity_certificate_valid: false,
      competition_infeasibility_proven: false,
      offered_unit_price: 2500,
      inexigibility_details: {
        competition_infeasibility_proven: false,
        supplier_market_price_proofs: [
          { type: "NF", identifier: "NF-1", unit_price: 900 },
          { type: "NF", identifier: "NF-2", unit_price: 950 },
        ],
      },
      quotations_forensic_meta: [
        {
          file_name: "c1.pdf",
          forensic_meta: {
            source_format: "pdf", title: "C1", author: "Autor_Unico", last_modified_by: null,
            creator_tool: "Excel", producer: "Excel", company: null, template: null,
            revision_count: null, creation_date_iso: "2026-11-12T09:00:00.000Z", mod_date_iso: null,
            has_digital_signature: false, signature_date_iso: null, editing_software_traces: [], forensic_anomalies: [],
          },
        },
        {
          file_name: "c2.pdf",
          forensic_meta: {
            source_format: "pdf", title: "C2", author: "Autor_Unico", last_modified_by: null,
            creator_tool: "Excel", producer: "Excel", company: null, template: null,
            revision_count: null, creation_date_iso: "2026-11-12T09:00:15.000Z", mod_date_iso: null,
            has_digital_signature: false, signature_date_iso: null, editing_software_traces: [], forensic_anomalies: [],
          },
        },
      ],
    });
    const mcpText = mcpRes.content[0].text;
    expect(Buffer.byteLength(mcpText, "utf-8")).toBeLessThanOrEqual(880);
    const mcpParsed = JSON.parse(mcpText);
    expect(mcpParsed.status).toBe("blocked");
  }, 20000);
});
