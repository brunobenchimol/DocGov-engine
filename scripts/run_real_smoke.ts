import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import JSZip from "jszip";
import { auditPdfPadesSignatures, comparePadesSignerIdentity } from "../src/utils/pdf/pades_signature_auditor.ts";
import { extractDocxForensicMetaFromBuffer } from "../src/utils/pdf/docx_forensic_meta.ts";
import { extractXlsxForensicMetaFromBuffer } from "../src/utils/pdf/xlsx_forensic_meta.ts";
import { detectCrossDocumentForensicCollisions } from "../src/utils/pdf/forensic_cross_audit.ts";
import { parseAndValidateNfeAccessKey } from "../src/utils/forensics/nfe_key_validator.ts";
import { bootstrapCase } from "../src/tools/bootstrap.ts";
import { evaluateBiddingProposals, serializeBiddingSyntheticResult } from "../src/bidding/evaluate_bidding_proposals.ts";
import { auditDirectContracting, serializeDirectContractingSyntheticResult } from "../src/direct_contracting/audit_direct_contracting.ts";
import type { PdfPadesSignatureDetail } from "../src/types/index.ts";

type CheckStatus = "PASS" | "FAIL" | "FALSE_POSITIVE" | "NEEDS_URL_REFRESH";
interface CheckOutcome { name: string; status: CheckStatus; detail: string; }

const ROOT = resolve(import.meta.dir, "..");
const MANIFEST_PATH = join(ROOT, "scripts", "real_corpus_manifest.json");
const CACHE_DIR = join(ROOT, ".local_real_corpus");
const USER_AGENT = "docgov-engine/1.7.0 (real-corpus-smoke)";
const sha256 = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

function printPadesDetails(slotName: string, sigs: PdfPadesSignatureDetail[]): void {
  console.log(`\n📌 Diagnóstico PAdES Real [${slotName}] — ${sigs.length} assinatura(s) extraída(s):`);
  for (const s of sigs) {
    console.log(JSON.stringify({
      signature_index: s.signature_index,
      subject_cn: s.subject_cn,
      issuer_cn: s.issuer_cn,
      icp_brasil_cpf: s.icp_brasil_cpf,
      icp_brasil_cnpj: s.icp_brasil_cnpj,
      is_self_signed: s.is_self_signed,
      is_trusted_icp_chain: s.is_trusted_icp_chain,
      digest_algorithm: s.digest_algorithm,
      digest_verified: s.digest_verified,
      post_signature_bytes: s.post_signature_bytes,
      post_signature_classification: s.post_signature_classification,
      anomalies: s.anomalies,
    }, null, 2));
  }
}

async function ensureSlotBuffer(slotName: string, slot: any): Promise<{ ok: boolean; buf: Buffer; reason?: string }> {
  const localPath = join(CACHE_DIR, slot.file_name);
  if (existsSync(localPath)) {
    const buf = readFileSync(localPath);
    if (!slot.sha256 || sha256(buf) === slot.sha256) return { ok: true, buf };
  }
  if (!slot.url) return { ok: false, buf: Buffer.alloc(0), reason: `URL vazia em '${slotName}'.` };
  try {
    const res = await fetch(slot.url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15000), redirect: "follow" });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || ct.includes("text/html")) {
      return { ok: false, buf: Buffer.alloc(0), reason: `HTTP ${res.status} / Content-Type '${ct}'` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const magicOk = slot.expected_magic === "%PDF-"
      ? buf.subarray(0, 5).toString("latin1") === "%PDF-"
      : buf[0] === 0x50 && buf[1] === 0x4b;
    if (!magicOk) return { ok: false, buf: Buffer.alloc(0), reason: "Magic bytes inválidos no download." };
    writeFileSync(localPath, buf);
    return { ok: true, buf };
  } catch (e: any) {
    return { ok: false, buf: Buffer.alloc(0), reason: e?.message || "Erro de rede" };
  }
}

async function mutateDocxStripAuthor(buf: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf);
  const core = zip.file("docProps/core.xml");
  const coreXml = core ? await core.async("string") : "";
  const stripped = coreXml
    .replace(/<dc:creator>[\s\S]*?<\/dc:creator>/gi, "")
    .replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/gi, "");
  zip.file("docProps/core.xml", stripped);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function mutateXlsxAuthorIfEmpty(buf: Buffer, fallbackAuthor: string): Promise<Buffer> {
  const meta = await extractXlsxForensicMetaFromBuffer(buf);
  if (meta.author) return buf;
  const zip = await JSZip.loadAsync(buf);
  const core = zip.file("docProps/core.xml");
  if (core) {
    let xml = await core.async("string");
    xml = /<dc:creator\b/i.test(xml)
      ? xml.replace(/<dc:creator[^>]*>[\s\S]*?<\/dc:creator>/i, `<dc:creator>${fallbackAuthor}</dc:creator>`)
      : xml.replace(/<\/cp:coreProperties>/i, `<dc:creator>${fallbackAuthor}</dc:creator></cp:coreProperties>`);
    zip.file("docProps/core.xml", xml);
  } else {
    zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>${fallbackAuthor}</dc:creator></cp:coreProperties>`);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  const slots = manifest.slots;
  const outcomes: CheckOutcome[] = [];
  const tmpRoot = mkdtempSync(join(tmpdir(), "docgov-real-smoke-"));

  try {
    // 1. Cenário 1: PDF Assinado Único
    const s1 = await ensureSlotBuffer("pades_single_icp", slots.pades_single_icp);
    if (!s1.ok) {
      outcomes.push({ name: "1. PDF Único Real", status: "NEEDS_URL_REFRESH", detail: s1.reason || "Indisponível" });
    } else {
      const sigs = auditPdfPadesSignatures(s1.buf);
      printPadesDetails("pades_single_icp", sigs);
      const hasFalsePos = sigs.length === 0 || sigs.some((x) => x.anomalies.length > 0);
      outcomes.push({
        name: "1A. PDF Único Original (Controle Negativo)",
        status: hasFalsePos ? "FALSE_POSITIVE" : "PASS",
        detail: sigs.length === 0 ? "0 assinaturas parseadas" : `Anomalias: [${sigs.flatMap((x) => x.anomalies).join(", ")}]`,
      });

      const tamperedPdf = join(tmpRoot, "single_tampered.pdf");
      writeFileSync(tamperedPdf, Buffer.concat([s1.buf, Buffer.from("\n999 0 obj << /Length 28 >> stream\nBT (ADULTERADO) Tj ET\nendstream endobj\n", "latin1")]));
      const sigsTamper = auditPdfPadesSignatures(readFileSync(tamperedPdf));
      const tamperOk = sigsTamper.some((x) => x.anomalies.includes("[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]"));
      outcomes.push({
        name: "1B. PDF Único Adulterado Pós-/ByteRange",
        status: tamperOk ? "PASS" : "FAIL",
        detail: tamperOk ? "Tampering detectado" : "Falha ao detectar stream adulterado pós-assinatura",
      });

      const origPdfPath = join(tmpRoot, "single_orig.pdf");
      writeFileSync(origPdfPath, s1.buf);
      const first = sigs[0];
      const mismatchedCpfCnpj = first?.icp_brasil_cpf ? "99988877766" : first?.icp_brasil_cnpj ? "99888777000166" : undefined;
      const bidRes = await evaluateBiddingProposals({
        process_id: "SMOKE-REAL-PADES",
        bidder_name: "LICITANTE_GENERICA",
        bidder_cnpj: "11.222.333/0001-81",
        outputDir: join(tmpRoot, "out_bid_pades"),
        act_forensic_items: [{
          certificate_id: "ACT-REAL-1",
          issuer_name: "ORGAO_CONTRATANTE",
          issuer_cnpj: "99.888.777/0001-66",
          act_pdf_path: origPdfPath,
          ...(mismatchedCpfCnpj ? { expected_signer_cpf_cnpj: mismatchedCpfCnpj } : { expected_signer_name: "SIGNATARIO INEXISTENTE XYZ" }),
        }],
      });
      const envBytes = Buffer.byteLength(serializeBiddingSyntheticResult(bidRes.synthetic), "utf-8");
      const mismatchOk = bidRes.dossier.decision === "REJECTED"
        && bidRes.dossier.blocking_tags.includes("[FORENSIC_SIGNER_IDENTITY_MISMATCH_BLOCK]")
        && envBytes < 900;
      outcomes.push({
        name: "1C. Integrada evaluateBiddingProposals (Signer Mismatch + <900B)",
        status: mismatchOk ? "PASS" : "FAIL",
        detail: `decision=${bidRes.dossier.decision}, envelope=${envBytes}B, tags=[${bidRes.dossier.blocking_tags.join(", ")}]`,
      });
    }

    // 2. Cenário 2: PDF Co-Assinado / LTV
    const s2 = await ensureSlotBuffer("pades_cosigned_or_ltv", slots.pades_cosigned_or_ltv);
    if (!s2.ok) {
      outcomes.push({ name: "2. PDF Co-Assinado/LTV", status: "NEEDS_URL_REFRESH", detail: s2.reason || "Indisponível" });
    } else {
      const sigs2 = auditPdfPadesSignatures(s2.buf);
      printPadesDetails("pades_cosigned_or_ltv", sigs2);
      const falsePos2 = sigs2.length === 0 || sigs2.some((x) => x.anomalies.includes("[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]") || x.anomalies.includes("[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]"));
      outcomes.push({
        name: "2A. PDF Co-Assinado/LTV Original (Controle Negativo)",
        status: falsePos2 ? "FALSE_POSITIVE" : "PASS",
        detail: `sigs=${sigs2.length}, classifications=[${sigs2.map((x) => x.post_signature_classification).join(", ")}], anomalies=[${sigs2.flatMap((x) => x.anomalies).join(", ")}]`,
      });
      const tampered2 = Buffer.concat([s2.buf, Buffer.from("\n998 0 obj << /Length 28 >> stream\nBT (FRAUDE_CO) Tj ET\nendstream endobj\n", "latin1")]);
      const sigs2Tamper = auditPdfPadesSignatures(tampered2);
      const tamper2Ok = sigs2Tamper.some((x) => x.anomalies.includes("[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]"));
      outcomes.push({
        name: "2B. PDF Co-Assinado/LTV Adulterado Pós-EOF",
        status: tamper2Ok ? "PASS" : "FAIL",
        detail: tamper2Ok ? "Tampering detectado" : "Falha ao detectar tampering pós-EOF",
      });
    }

    // 3. Cenário 3: 2 DOCX da AGU (w:rsid)
    const dA = await ensureSlotBuffer("ooxml_docx_agu_a", slots.ooxml_docx_agu_a);
    const dB = await ensureSlotBuffer("ooxml_docx_agu_b", slots.ooxml_docx_agu_b);
    if (!dA.ok || !dB.ok) {
      outcomes.push({ name: "3. Modelos DOCX AGU (w:rsid)", status: "NEEDS_URL_REFRESH", detail: dA.reason || dB.reason || "Indisponível" });
    } else {
      const metaA = await extractDocxForensicMetaFromBuffer(dA.buf);
      const metaB = await extractDocxForensicMetaFromBuffer(dB.buf);
      const cleanCollisions = detectCrossDocumentForensicCollisions([
        { fileName: "agu_modelo_a.docx", forensicMeta: metaA },
        { fileName: "agu_modelo_b.docx", forensicMeta: metaB },
      ]);
      const rsidFalsePos = cleanCollisions.some((c) => c.code === "FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK");
      outcomes.push({
        name: "3A. 2 DOCX Distintos AGU (Controle Negativo w:rsid)",
        status: rsidFalsePos ? "FALSE_POSITIVE" : "PASS",
        detail: `rsidA=${metaA.rsid_root} (${metaA.rsid_unique_count || 0}), rsidB=${metaB.rsid_root} (${metaB.rsid_unique_count || 0})`,
      });

      const clonedBuf = await mutateDocxStripAuthor(dA.buf);
      const metaClone = await extractDocxForensicMetaFromBuffer(clonedBuf);
      const cloneCols = detectCrossDocumentForensicCollisions([
        { fileName: "agu_modelo_a.docx", forensicMeta: metaA },
        { fileName: "agu_modelo_a_author_lavado.docx", forensicMeta: metaClone },
      ]);
      const cloneOk = cloneCols.some((c) => c.code === "FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK");
      outcomes.push({
        name: "3B. DOCX Clone c/ Author Lavado (w:rsidRoot mantido)",
        status: cloneOk ? "PASS" : "FAIL",
        detail: `authorClone=${metaClone.author}, alerts=[${cloneCols.map((c) => c.code).join(", ")}]`,
      });
    }

    // 4. Cenário 4: XLSX Público em bootstrapCase + auditDirectContracting
    const x1 = await ensureSlotBuffer("ooxml_xlsx_agu", slots.ooxml_xlsx_agu);
    if (!x1.ok) {
      outcomes.push({ name: "4. Planilha XLSX Pública", status: "NEEDS_URL_REFRESH", detail: x1.reason || "Indisponível" });
    } else {
      const caseDir = join(tmpRoot, "cases", "smoke_real_xlsx");
      mkdirSync(join(caseDir, "inputs"), { recursive: true });
      writeFileSync(join(caseDir, "inputs", "planilha_publica.xlsx"), x1.buf);
      const boot = await bootstrapCase(caseDir, { cleanupMode: "none" });
      const masterMd = readFileSync(boot.indice_mestre_path!, "utf-8");
      const xlsxBootOk = masterMd.includes("Inventário Forense de Metadados (PDF, DOCX & XLSX)") && masterMd.includes("planilha_publica.xlsx");
      outcomes.push({
        name: "4A. XLSX Real no indice_mestre_caso.md",
        status: xlsxBootOk ? "PASS" : "FAIL",
        detail: xlsxBootOk ? "Tabela Forense PDF, DOCX & XLSX validada" : "XLSX ausente da tabela forense",
      });

      const quoteBuf = await mutateXlsxAuthorIfEmpty(x1.buf, "Consultor_Smoke_XLSX");
      const q1 = join(tmpRoot, "cotacao_1.xlsx");
      const q2 = join(tmpRoot, "cotacao_2.xlsx");
      writeFileSync(q1, quoteBuf);
      writeFileSync(q2, quoteBuf);
      const dirRes = await auditDirectContracting({
        process_id: "SMOKE-REAL-XLSX",
        contracting_modality: "INEXIGIBILIDADE",
        outputDir: join(tmpRoot, "out_dir_xlsx"),
        quotations_forensic_meta: [
          { quotation_id: "Q1", file_name: "cotacao_fornecedor_1.xlsx", pdf_path: q1 },
          { quotation_id: "Q2", file_name: "cotacao_fornecedor_2.xlsx", pdf_path: q2 },
        ],
        inexigibility_details: {
          competition_infeasibility_proven: true,
          exclusivity_certificate: { provided: true, sumula_255_tcu_verified: true },
          supplier_market_price_proofs: [
            { identifier: "NF-1", unit_price: 100 },
            { identifier: "NF-2", unit_price: 100 },
            { identifier: "NF-3", unit_price: 100 },
          ],
        },
      });
      const dirBytes = Buffer.byteLength(serializeDirectContractingSyntheticResult(dirRes.synthetic), "utf-8");
      const dirOk = dirRes.dossier.blocking_tags.includes("[PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK]") && dirBytes < 900;
      outcomes.push({
        name: "4B. Integrada auditDirectContracting (Cotações XLSX + <900B)",
        status: dirOk ? "PASS" : "FAIL",
        detail: `decision=${dirRes.dossier.decision}, envelope=${dirBytes}B, tags=[${dirRes.dossier.blocking_tags.join(", ")}]`,
      });
    }

    // 5. Cenário 5: NF-e Pública 44 Dígitos
    const nfe = slots.nfe_public_transparency;
    if (!nfe?.access_key_44) {
      outcomes.push({ name: "5. NF-e Pública 44 Dígitos", status: "NEEDS_URL_REFRESH", detail: "Chave NF-e não preenchida no manifesto." });
    } else {
      const okNfe = parseAndValidateNfeAccessKey(nfe.access_key_44, { expectedCnpj: nfe.issuer_cnpj, declaredIssueDate: nfe.issue_date });
      const negOk = okNfe.valid_structure_and_dv && okNfe.valid_cnpj_and_date && okNfe.blocking_tags.length === 0;
      outcomes.push({ name: "5A. NF-e Pública Original (Controle Negativo)", status: negOk ? "PASS" : "FALSE_POSITIVE", detail: `UF=${okNfe.parsed?.uf}, AAMM=${okNfe.parsed?.aamm}, CNPJ=${okNfe.parsed?.cnpj}` });

      const badDvKey = `${nfe.access_key_44.slice(0, 43)}${(Number(nfe.access_key_44[43]) + 1) % 10}`;
      const badDvRes = parseAndValidateNfeAccessKey(badDvKey);
      outcomes.push({
        name: "5B. NF-e Mutação DV Módulo 11",
        status: badDvRes.blocking_tags.includes("[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]") ? "PASS" : "FAIL",
        detail: `tags=[${badDvRes.blocking_tags.join(", ")}]`,
      });

      const mismatchRes = parseAndValidateNfeAccessKey(nfe.access_key_44, { expectedCnpj: "99888777000166", declaredIssueDate: "2019-01" });
      outcomes.push({
        name: "5C. NF-e Mutação CNPJ & Data",
        status: mismatchRes.blocking_tags.includes("[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]") ? "PASS" : "FAIL",
        detail: `tags=[${mismatchRes.blocking_tags.join(", ")}]`,
      });
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  console.log("\n==================== PLACAR FINAL — REAL CORPUS SMOKE TEST (v1.7.0) ====================");
  for (const o of outcomes) {
    const icon = o.status === "PASS" ? "✅" : o.status === "NEEDS_URL_REFRESH" ? "🔄" : "❌";
    console.log(`${icon} [${o.status}] ${o.name}\n   -> ${o.detail}`);
  }
  const counts = outcomes.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {});
  console.log(`\nResumo: PASS=${counts.PASS || 0} | FAIL=${counts.FAIL || 0} | FALSE_POSITIVE=${counts.FALSE_POSITIVE || 0} | NEEDS_URL_REFRESH=${counts.NEEDS_URL_REFRESH || 0}`);
  if ((counts.FAIL || 0) > 0 || (counts.FALSE_POSITIVE || 0) > 0 || (counts.NEEDS_URL_REFRESH || 0) > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => { console.error("Erro fatal:", err); process.exit(1); });
