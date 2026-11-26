import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeNfeMod11CheckDigit,
  parseAndValidateNfeAccessKey,
  parseDeclaredDateToAamm,
} from "../src/utils/forensics/nfe_key_validator.ts";
import {
  detectBiddingUnknownKeys,
  detectDirectContractingUnknownKeys,
} from "../src/utils/forensics/gen6_contract_guard.ts";
import {
  evaluateBiddingProposals,
  serializeBiddingSyntheticResult,
} from "../src/bidding/evaluate_bidding_proposals.ts";
import {
  auditDirectContracting,
  serializeDirectContractingSyntheticResult,
} from "../src/direct_contracting/audit_direct_contracting.ts";
import { auditActForensics } from "../src/bidding/act_forensic_auditor.ts";
import { describeBiddingTagLegalProse } from "../src/bidding/bidding_legal_humanizer.ts";
import { buildActDiligenceLetterXmlParts } from "../src/bidding/act_diligence_letter_sections.ts";
import type { BiddingProposalDossier } from "../src/bidding/types.ts";

function makeNfeKey(uf: string, aamm: string, cnpj: string, modelo = "55"): string {
  const base43 = `${uf}${aamm}${cnpj.replace(/\D/g, "").padStart(14, "0")}${modelo}001000000123112345678`;
  const dv = computeNfeMod11CheckDigit(base43);
  return `${base43}${dv}`;
}

describe("Pilar 5.1 (v1.7.0) — Validador Algorítmico NF-e 44 Dígitos & Guarda unknown_keys Gen6", () => {
  const bidderCnpj = "11222333000181";
  const tomadorCnpj = "99888777000166";
  const tempOutDir = mkdtempSync(join(tmpdir(), "docgov_test_nfe_"));
  afterAll(() => {
    rmSync(tempOutDir, { recursive: true, force: true });
  });

  test("1. Decomposição posicional exata, Módulo 11 e formatos de data YYYY-MM-DD / DD/MM/YYYY / YYYY-MM", () => {
    const validKey = makeNfeKey("35", "2605", bidderCnpj, "55");
    const spaced = validKey.replace(/(.{4})/g, "$1 ").trim();

    expect(parseDeclaredDateToAamm("2026-05-14")).toBe("2605");
    expect(parseDeclaredDateToAamm("14/05/2026")).toBe("2605");
    expect(parseDeclaredDateToAamm("2026-05")).toBe("2605");

    const res = parseAndValidateNfeAccessKey(spaced, {
      expectedCnpj: "11.222.333/0001-81",
      declaredIssueDate: "14/05/2026",
    });
    expect(res.valid_structure_and_dv).toBe(true);
    expect(res.valid_cnpj_and_date).toBe(true);
    expect(res.blocking_tags).toEqual([]);
    expect(res.parsed?.uf).toBe("35");
    expect(res.parsed?.aamm).toBe("2605");
    expect(res.parsed?.cnpj).toBe(bidderCnpj);
    expect(res.parsed?.modelo).toBe("55");
  });

  test("2. Bloqueia DV Módulo 11 adulterado, UF/mês/modelo inválidos e comprimento incorreto", () => {
    const validKey = makeNfeKey("33", "2603", bidderCnpj);
    const badDv = `${validKey.slice(0, 43)}${(Number(validKey[43]) + 1) % 10}`;
    expect(parseAndValidateNfeAccessKey(badDv).blocking_tags).toContain(
      "[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]"
    );

    const badUf = makeNfeKey("99", "2603", bidderCnpj);
    expect(parseAndValidateNfeAccessKey(badUf).blocking_tags).toContain(
      "[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]"
    );

    const badMonth = makeNfeKey("35", "2613", bidderCnpj);
    expect(parseAndValidateNfeAccessKey(badMonth).blocking_tags).toContain(
      "[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]"
    );

    expect(parseAndValidateNfeAccessKey("12345").blocking_tags).toContain(
      "[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]"
    );
  });

  test("3. ACT Via B usa bidder_cnpj (e não issuer_cnpj do tomador) sem gerar falso-positivo", async () => {
    const validKey = makeNfeKey("53", "2604", bidderCnpj);
    const okRes = await evaluateBiddingProposals(
      {
        process_id: "PROC-NFE-ACT-OK",
        bidder_name: "PRESTADORA_TI_GENERICA",
        bidder_cnpj: "11.222.333/0001-81",
        act_forensic_items: [
          {
            certificate_id: "ACT-VIA-B",
            issuer_name: "ORGAO_CONTRATANTE",
            issuer_cnpj: tomadorCnpj,
            diligence_nfe_keys: [
              { access_key: validKey, declared_issue_date: "2026-04-10" },
            ],
          },
        ],
      },
      { outputDir: tempOutDir, compilationMode: "NONE" }
    );
    expect(okRes.dossier.blocking_tags).not.toContain("[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]");
    expect(okRes.dossier.blocking_tags).not.toContain("[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]");

    const badKey = makeNfeKey("53", "2604", "44555666000177");
    const badRes = await evaluateBiddingProposals(
      {
        process_id: "PROC-NFE-ACT-BAD",
        bidder_name: "PRESTADORA_TI_GENERICA",
        bidder_cnpj: "11.222.333/0001-81",
        act_forensic_items: [
          {
            certificate_id: "ACT-VIA-B",
            issuer_name: "ORGAO_CONTRATANTE",
            issuer_cnpj: tomadorCnpj,
            nfe_access_key: badKey,
            nfe_declared_issue_date: "2026-04",
          },
        ],
      },
      { outputDir: tempOutDir, compilationMode: "NONE" }
    );
    expect(badRes.dossier.decision).toBe("REJECTED");
    expect(badRes.dossier.blocking_tags).toContain("[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]");
  });

  test("4. Contratação Direta valida NF-e de supplier_market_price_proofs[]", async () => {
    const validKey = makeNfeKey("35", "2602", bidderCnpj);
    const badDvKey = `${validKey.slice(0, 43)}${(Number(validKey[43]) + 3) % 10}`;
    const res = await auditDirectContracting(
      {
        process_id: "PROC-INEX-NFE-01",
        contracting_modality: "INEXIGIBILIDADE",
        supplier_cnpj: "11.222.333/0001-81",
        offered_unit_price: 1000,
        inexigibility_details: {
          competition_infeasibility_proven: true,
          exclusivity_certificate: { provided: true, sumula_255_tcu_verified: true },
          supplier_market_price_proofs: [
            { type: "NF", identifier: "NF-1", unit_price: 1000, issue_date: "2026-02-01", nfe_access_key: validKey },
            { type: "NF", identifier: "NF-2", unit_price: 1000, issue_date: "2026-02-10", nfe_access_key: badDvKey },
            { type: "NF", identifier: "NF-3", unit_price: 1000, issue_date: "2026-02-20" },
          ],
        },
      },
      { outputDir: tempOutDir, compilationMode: "NONE" }
    );
    expect(res.dossier.decision).toBe("REJECTED");
    expect(res.dossier.blocking_tags).toContain("[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]");
  });

  test("5. Guarda unknown_keys Gen6 aceita campos v1.7.0, flagra aliases inventados e mantém < 880B", async () => {
    expect(
      detectBiddingUnknownKeys({
        process_id: "P1",
        bidder_cnpj: "11222333000181",
        act_forensic_items: [
          {
            certificate_id: "A1",
            expected_signer_name: "SERVIDOR A",
            expected_signer_cpf_cnpj: "12345678909",
            nfe_access_key: makeNfeKey("35", "2601", bidderCnpj),
            nfe_declared_issue_date: "2026-01",
            diligence_nfe_keys: [{ access_key: makeNfeKey("35", "2601", bidderCnpj), expected_cnpj: bidderCnpj }],
          },
        ],
      })
    ).toEqual([]);

    expect(
      detectDirectContractingUnknownKeys({
        process_id: "D1",
        supplier_cnpj: bidderCnpj,
        inexigibility_details: {
          supplier_market_price_proofs: [{ identifier: "NF-1", unit_price: 10, nfe_access_key: "x", issuer_cnpj: bidderCnpj }],
        },
      })
    ).toEqual([]);

    const bidRes = await evaluateBiddingProposals(
      {
        process_id: "PROC-UNK-BID",
        invented_root_alias: true,
        act_forensic_items: [{ certificate_id: "A1", fake_nfe_field: "123" }],
      },
      { outputDir: tempOutDir, compilationMode: "NONE" }
    );
    expect(bidRes.dossier.unknown_keys).toEqual(["invented_root_alias", "act_forensic_items[0].fake_nfe_field"]);
    expect(bidRes.synthetic.unknown_keys).toEqual(["invented_root_alias", "act_forensic_items[0].fake_nfe_field"]);
    expect(Buffer.byteLength(serializeBiddingSyntheticResult(bidRes.synthetic), "utf-8")).toBeLessThanOrEqual(880);

    const dirRes = await auditDirectContracting(
      {
        process_id: "PROC-UNK-DIR",
        contracting_modality: "INEXIGIBILIDADE",
        unknown_top_alias: 123,
        inexigibility_details: {
          supplier_market_price_proofs: [{ identifier: "NF-1", unit_price: 100, chave_nfe_alias: "abc" }],
        },
      },
      { outputDir: tempOutDir, compilationMode: "NONE" }
    );
    expect(dirRes.dossier.unknown_keys).toEqual([
      "unknown_top_alias",
      "inexigibility_details.supplier_market_price_proofs[0].chave_nfe_alias",
    ]);
    expect(dirRes.synthetic.unknown_keys).toEqual(dirRes.dossier.unknown_keys);
    expect(Buffer.byteLength(serializeDirectContractingSyntheticResult(dirRes.synthetic), "utf-8")).toBeLessThanOrEqual(880);
  });

  test("6. Polimento R4: dicionário jurídico das 6 tags v1.7.0 no Parecer DOCX (sem fallback genérico)", () => {
    const tagsV170 = [
      "[FORENSIC_SIGNER_IDENTITY_MISMATCH_BLOCK]",
      "[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]",
      "[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]",
      "[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]",
      "[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]",
      "[FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK]",
    ];
    const mockDossier = {
      legal_regime: "LEI_14133_2021",
      ict_execution: {},
      act_forensics: {
        certificates_audited: 1,
        total_alerts: 1,
        blocking_tags: tagsV170,
        items: [{ certificate_id: "ACT-R4", issuer_name: "ORGAO_A", issuer_cnpj: tomadorCnpj, triggered_vectors: [], blocking_tags: tagsV170, details: [] }],
      },
    } as unknown as BiddingProposalDossier;

    for (const tag of tagsV170) {
      const prose = describeBiddingTagLegalProse(tag, mockDossier);
      expect(prose.recommendation).not.toContain("Sanear integralmente o apontamento");
      expect(prose.recommendation).toMatch(/PAS|rejei|inabilit|Bloquear/i);
      expect(prose.legalBasis).toMatch(/14\.133|SINIEF|337-/);
    }
  });

  test("7. Polimento R4: deduplica chave NF-e idêntica entre nfe_access_key e diligence_nfe_keys[]", () => {
    const validKey = makeNfeKey("35", "2405", bidderCnpj);
    const badDvKey = `${validKey.slice(0, 43)}${(Number(validKey[43]) + 1) % 10}`;
    const spacedKey = badDvKey.replace(/(\d{4})/g, "$1 ").trim();
    const res = auditActForensics(
      [
        {
          certificate_id: "ACT-DEDUP",
          issuer_name: "ORGAO_A",
          issuer_cnpj: tomadorCnpj,
          nfe_access_key: badDvKey,
          diligence_nfe_keys: [{ access_key: spacedKey, declared_issue_date: "2024-05-10" }],
        },
      ],
      { bidderName: "EMPRESA GENERICA", bidderCnpj }
    );
    const dvDetails = res.items[0].details.filter((d) => d.includes("Dígito Verificador Módulo 11"));
    expect(dvDetails.length).toBe(1);
    expect(res.items[0].blocking_tags).toEqual(["[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]"]);
  });

  test("8. Polimento R4: Ofício de Diligência distingue total_alerts === 0 (rotina Art. 64) vs >= 1 (investigativa)", () => {
    const baseDossier = (alerts: number): BiddingProposalDossier =>
      ({
        process_id: "PROC-R4-OFICIO",
        legal_regime: "LEI_14133_2021",
        bidder_name: "EMPRESA_GENERICA",
        bidder_cnpj: bidderCnpj,
        ict_execution: { diligence_required: false, is_exequible: true, offered_unit_value: 100, parametric_floor_value: 90 },
        act_forensics: {
          certificates_audited: 1,
          total_alerts: alerts,
          blocking_tags: alerts > 0 ? ["[ACT_FORENSIC_SIGNATURE_DATE_MISMATCH]"] : [],
          items: [
            {
              certificate_id: "ACT-01",
              issuer_name: "ORGAO_A",
              issuer_cnpj: tomadorCnpj,
              triggered_vectors: alerts > 0 ? ["VETOR_7_CRIPTOGRAFIA_PADES"] : [],
              blocking_tags: alerts > 0 ? ["[ACT_FORENSIC_SIGNATURE_DATE_MISMATCH]"] : [],
              details: alerts > 0 ? ["Divergência detectada"] : [],
            },
          ],
        },
      }) as unknown as BiddingProposalDossier;

    const zeroXml = buildActDiligenceLetterXmlParts(baseDossier(0)).join("\n");
    expect(zeroXml).not.toContain("0 alerta(s) objetivo(s)");
    expect(zeroXml).not.toContain("exigindo a imediata deflagração");
    expect(zeroXml).toContain("situação preliminar CONFORME");
    expect(zeroXml).toContain("verificação facultativa e preventiva de rotina");

    const oneXml = buildActDiligenceLetterXmlParts(baseDossier(1)).join("\n");
    expect(oneXml).toContain("identificou 1 alerta(s) objetivo(s)");
    expect(oneXml).toContain("exigindo a imediata deflagração de diligência investigativa em dupla via");
  });
});
