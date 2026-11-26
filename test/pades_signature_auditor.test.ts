import { describe, expect, test, afterAll } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractPdfForensicMeta } from "../src/utils/pdf/forensic_meta.ts";
import {
  auditPdfPadesSignatures,
  comparePadesSignerIdentity,
} from "../src/utils/pdf/pades_signature_auditor.ts";
import { evaluateBiddingProposals } from "../src/bidding/evaluate_bidding_proposals.ts";

function derTlv(tag: number, content: Buffer): Buffer {
  const len = content.length;
  let lenBuf: Buffer;
  if (len < 0x80) lenBuf = Buffer.from([len]);
  else if (len <= 0xff) lenBuf = Buffer.from([0x81, len]);
  else lenBuf = Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
  return Buffer.concat([Buffer.from([tag]), lenBuf, content]);
}

function berIndef(tag: number, children: Buffer[]): Buffer {
  return Buffer.concat([Buffer.from([tag, 0x80]), ...children, Buffer.from([0x00, 0x00])]);
}

function encodeOid(oid: string): Buffer {
  const nums = oid.split(".").map(Number);
  const bytes = [nums[0] * 40 + nums[1]];
  for (let i = 2; i < nums.length; i++) {
    let v = nums[i];
    const tmp = [v & 0x7f];
    while (v >= 0x80) {
      v >>>= 7;
      tmp.unshift((v & 0x7f) | 0x80);
    }
    bytes.push(...tmp);
  }
  return derTlv(0x06, Buffer.from(bytes));
}

function derDn(attrs: Array<[string, string]>): Buffer {
  return derTlv(
    0x30,
    Buffer.concat(
      attrs.map(([oid, val]) =>
        derTlv(0x31, derTlv(0x30, Buffer.concat([encodeOid(oid), derTlv(0x0c, Buffer.from(val, "utf8"))])))
      )
    )
  );
}

function buildCert(opts: {
  serial: number[];
  issuerCn: string;
  subjectCn: string;
  cpf?: string;
  cnpj?: string;
}): Buffer {
  const serial = derTlv(0x02, Buffer.from(opts.serial));
  const alg = derTlv(0x30, encodeOid("1.2.840.113549.1.1.11"));
  const issuer = derDn([["2.5.4.3", opts.issuerCn], ["2.5.4.6", "BR"]]);
  const validity = derTlv(
    0x30,
    Buffer.concat([derTlv(0x17, Buffer.from("260101000000Z")), derTlv(0x17, Buffer.from("280101000000Z"))])
  );
  const subject = derDn([["2.5.4.3", opts.subjectCn], ["2.5.4.6", "BR"]]);
  const spki = derTlv(0x30, Buffer.from([0x05, 0x00]));

  const sanNames: Buffer[] = [];
  if (opts.cpf) {
    sanNames.push(
      derTlv(
        0xa0,
        Buffer.concat([
          encodeOid("2.16.76.1.3.1"),
          derTlv(0xa0, derTlv(0x04, Buffer.from(`01011990${opts.cpf}00000000000`, "utf8"))),
        ])
      )
    );
  }
  if (opts.cnpj) {
    sanNames.push(
      derTlv(
        0xa0,
        Buffer.concat([
          encodeOid("2.16.76.1.3.3"),
          derTlv(0xa0, derTlv(0x13, Buffer.from(opts.cnpj, "utf8"))),
        ])
      )
    );
  }
  const sanExt = derTlv(
    0x30,
    Buffer.concat([encodeOid("2.5.29.17"), derTlv(0x04, derTlv(0x30, Buffer.concat(sanNames)))])
  );
  const tbs = derTlv(
    0x30,
    Buffer.concat([
      derTlv(0xa0, derTlv(0x02, Buffer.from([2]))),
      serial,
      alg,
      issuer,
      validity,
      subject,
      spki,
      derTlv(0xa3, derTlv(0x30, Buffer.concat([sanExt]))),
    ])
  );
  return derTlv(0x30, Buffer.concat([tbs, alg, derTlv(0x03, Buffer.from([0x00, 0x01]))]));
}

function buildCms(opts: {
  certs: Buffer[];
  signerIssuerCn: string;
  signerSerial: number[];
  messageDigest?: Buffer;
  indefinite?: boolean;
}): Buffer {
  const issuer = derDn([["2.5.4.3", opts.signerIssuerCn], ["2.5.4.6", "BR"]]);
  const sid = derTlv(0x30, Buffer.concat([issuer, derTlv(0x02, Buffer.from(opts.signerSerial))]));
  const sha256Alg = derTlv(0x30, encodeOid("2.16.840.1.101.3.4.2.1"));
  const signerParts = [derTlv(0x02, Buffer.from([1])), sid, sha256Alg];
  if (opts.messageDigest) {
    const mdAttr = derTlv(
      0x30,
      Buffer.concat([encodeOid("1.2.840.113549.1.9.4"), derTlv(0x31, derTlv(0x04, opts.messageDigest))])
    );
    signerParts.push(derTlv(0xa0, mdAttr));
  }
  signerParts.push(sha256Alg, derTlv(0x04, Buffer.from([0xaa, 0xbb])));
  const signedDataChildren = [
    derTlv(0x02, Buffer.from([1])),
    derTlv(0x31, sha256Alg),
    derTlv(0x30, encodeOid("1.2.840.113549.1.7.1")),
    derTlv(0xa0, Buffer.concat(opts.certs)),
    derTlv(0x31, derTlv(0x30, Buffer.concat(signerParts))),
  ];
  if (opts.indefinite) {
    return berIndef(0x30, [encodeOid("1.2.840.113549.1.7.2"), berIndef(0xa0, [berIndef(0x30, signedDataChildren)])]);
  }
  return derTlv(
    0x30,
    Buffer.concat([encodeOid("1.2.840.113549.1.7.2"), derTlv(0xa0, derTlv(0x30, Buffer.concat(signedDataChildren)))])
  );
}

function buildSignedPdf(cmsBuilder: (digest: Buffer) => Buffer, tail = "", padHexZeros = 0): Buffer {
  const prefix = "%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n2 0 obj << /Type /Sig /SubFilter /adbe.pkcs7.detached ";
  const placeholderLen = 2400;
  const postHex = `> >> endobj\n%%EOF\n`;
  const templateHead = `${prefix}/ByteRange [0 000000 000000 000000] /Contents <`;
  const b = templateHead.length - 1;
  const c = b + 1 + placeholderLen + 1;
  const d = postHex.length - 1;
  const brAreaLen = templateHead.indexOf("/Contents <") - prefix.length;
  const fixedPre = `${prefix}${`/ByteRange [0 ${b} ${c} ${d}]`.padEnd(brAreaLen, " ")}/Contents <`;

  const digest = createHash("sha256")
    .update(Buffer.from(fixedPre.slice(0, b), "latin1"))
    .update(Buffer.from(postHex.slice(1), "latin1"))
    .digest();
  const cmsHex = cmsBuilder(digest).toString("hex") + "00".repeat(padHexZeros);
  const paddedHex = cmsHex.padEnd(placeholderLen, "0");
  return Buffer.from(`${fixedPre}${paddedHex}${postHex}${tail}`, "latin1");
}

describe("Pilar 1 (v1.7.0) — Perícia Pure-JS PKCS#7/PAdES, ASN.1/BER e /ByteRange", () => {
  test("1. Seleciona folha via SignerInfo.sid, suporta BER indefinite-length e extrai CPF/CNPJ ICP-Brasil", async () => {
    const rootCert = buildCert({ serial: [0x01], issuerCn: "AC Raiz Brasileira ICP-Brasil", subjectCn: "AC Raiz Brasileira ICP-Brasil" });
    const leafCert = buildCert({
      serial: [0x05, 0x00],
      issuerCn: "AC SERPRO ICP-Brasil",
      subjectCn: "JOAO DA SILVA:12345678909",
      cpf: "12345678909",
      cnpj: "12345678000195",
    });

    const pdf = buildSignedPdf(
      (digest) =>
        buildCms({
          certs: [rootCert, leafCert],
          signerIssuerCn: "AC SERPRO ICP-Brasil",
          signerSerial: [0x05, 0x00],
          messageDigest: digest,
          indefinite: true,
        }),
      "",
      16
    );

    const meta = await extractPdfForensicMeta({ pdfProxy: null, sourceBuffer: pdf });
    expect(meta.has_digital_signature).toBe(true);
    expect(meta.forensic_anomalies).toEqual([]);
    expect(meta.pades_signatures?.length).toBe(1);
    const sig = meta.pades_signatures![0];
    expect(sig.subject_cn).toBe("JOAO DA SILVA:12345678909");
    expect(sig.icp_brasil_cpf).toBe("12345678909");
    expect(sig.icp_brasil_cnpj).toBe("12345678000195");
    expect(sig.is_self_signed).toBe(false);
    expect(sig.is_trusted_icp_chain).toBe(true);
    expect(sig.digest_verified).toBe(true);
    expect(sig.covers_eof).toBe(true);
  });

  test("2. Sem signedAttrs mantém digest_verified undefined e detecta cert autoassinado", () => {
    const selfCert = buildCert({ serial: [0x09], issuerCn: "TESTE SELF", subjectCn: "TESTE SELF" });
    const pdf = buildSignedPdf(() =>
      buildCms({ certs: [selfCert], signerIssuerCn: "TESTE SELF", signerSerial: [0x09] })
    );
    const sigs = auditPdfPadesSignatures(pdf);
    expect(sigs[0].digest_verified).toBeUndefined();
    expect(sigs[0].is_self_signed).toBe(true);
    expect(sigs[0].anomalies).toContain("[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]");
  });

  test("3. Co-assinatura visual Gov.br/Adobe com /Subtype /Form + BT..ET não gera falso positivo", () => {
    const leaf = buildCert({ serial: [0x07], issuerCn: "AC GOV.BR ICP-Brasil", subjectCn: "MARIA LIMA" });
    const visualCoSigTail = [
      "\n5 0 obj << /Type /Page /Contents 4 0 R /Annots [6 0 R] >> endobj",
      "\n6 0 obj << /Type /Annot /Subtype /Widget /AP << /N 7 0 R >> >> endobj",
      "\n7 0 obj << /Type /XObject /Subtype /Form /Resources << >> /Length 22 >> stream\nBT (Assinado) Tj ET\nendstream endobj",
      "\n8 0 obj << /Type /Sig /SubFilter /adbe.pkcs7.detached >> endobj\n%%EOF\n",
    ].join("");
    const pdf = buildSignedPdf(
      (digest) => buildCms({ certs: [leaf], signerIssuerCn: "AC GOV.BR ICP-Brasil", signerSerial: [0x07], messageDigest: digest }),
      visualCoSigTail
    );
    const sigs = auditPdfPadesSignatures(pdf);
    expect(sigs[0].post_signature_classification).toBe("BENIGN_CO_SIGNATURE_OR_TIMESTAMP");
    expect(sigs[0].anomalies).toEqual([]);
  });

  test("4. Detecta tampering incremental pós-assinatura (sem /Sig e alterando /Contents fora de /Form)", () => {
    const leaf = buildCert({ serial: [0x08], issuerCn: "AC Certisign ICP-Brasil", subjectCn: "CARLOS" });
    const pdfRawTamper = buildSignedPdf(
      (digest) => buildCms({ certs: [leaf], signerIssuerCn: "AC Certisign ICP-Brasil", signerSerial: [0x08], messageDigest: digest }),
      "\n9 0 obj << /Length 30 >> stream\nBT (ADULTERADO) Tj ET\nendstream endobj\n"
    );
    const sigsA = auditPdfPadesSignatures(pdfRawTamper);
    expect(sigsA[0].post_signature_classification).toBe("SUSPECT_INCREMENTAL_TAMPERING");
    expect(sigsA[0].anomalies).toContain("[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]");

    const pdfPageStreamTamper = buildSignedPdf(
      (digest) => buildCms({ certs: [leaf], signerIssuerCn: "AC Certisign ICP-Brasil", signerSerial: [0x08], messageDigest: digest }),
      "\n5 0 obj << /Type /Page /Contents 10 0 R >> endobj\n10 0 obj << /Length 24 >> stream\nBT (TROCA) Tj ET\nendstream endobj\n11 0 obj << /Type /Sig >> endobj\n"
    );
    const sigsB = auditPdfPadesSignatures(pdfPageStreamTamper);
    expect(sigsB[0].anomalies).toContain("[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]");

    const tamperedBytes = Buffer.from(
      buildSignedPdf((digest) =>
        buildCms({ certs: [leaf], signerIssuerCn: "AC Certisign ICP-Brasil", signerSerial: [0x08], messageDigest: digest })
      ).toString("latin1").replace("/Catalog", "/Xatalog"),
      "latin1"
    );
    const sigsC = auditPdfPadesSignatures(tamperedBytes);
    expect(sigsC[0].digest_verified).toBe(false);
    expect(sigsC[0].anomalies).toContain("[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]");
  });

  test("5. Diretor PF (e-CPF) assinando por PJ (issuer_cnpj) não gera falso-positivo; divergência explícita bloqueia", async () => {
    const leafPf = buildCert({
      serial: [0x0a],
      issuerCn: "AC Soluti ICP-Brasil",
      subjectCn: "DIRETOR PF:11122233344",
      cpf: "11122233344",
    });
    const pdf = buildSignedPdf((digest) =>
      buildCms({ certs: [leafPf], signerIssuerCn: "AC Soluti ICP-Brasil", signerSerial: [0x0a], messageDigest: digest })
    );
    const sigs = auditPdfPadesSignatures(pdf);
    expect(comparePadesSignerIdentity(sigs, { expectedSignerCpfCnpj: "12345678000195" })).toEqual([]);

    const padesOutDir = mkdtempSync(join(tmpdir(), "docgov_test_pades_"));
    try {
      const res = await evaluateBiddingProposals(
        {
          process_id: "PROC-PADES-01",
          bidder_name: "EMPRESA_GENERICA",
          bidder_cnpj: "11.222.333/0001-81",
          act_forensic_items: [
            {
              certificate_id: "ACT-01",
              issuer_name: "ORGAO_CONTRATANTE",
              issuer_cnpj: "99.888.777/0001-66",
              expected_signer_name: "SERVIDOR DESIGNADO",
              expected_signer_cpf_cnpj: "99988877766",
              pades_signatures: sigs,
            },
          ],
        },
        { outputDir: padesOutDir, compilationMode: "NONE" }
      );
      expect(res.dossier.decision).toBe("REJECTED");
      expect(res.dossier.blocking_tags).toContain("[FORENSIC_SIGNER_IDENTITY_MISMATCH_BLOCK]");
    } finally {
      rmSync(padesOutDir, { recursive: true, force: true });
    }
  });

  test("6. Hierarquia oficial Gov.br (AC Final do Governo Federal do Brasil v1) é aceita como confiável", () => {
    const leaf = buildCert({
      serial: [0x11],
      issuerCn: "AC Final do Governo Federal do Brasil v1",
      subjectCn: "SERVIDOR GENERICO:11122233344",
      cpf: "11122233344",
    });
    const pdf = buildSignedPdf((digest) =>
      buildCms({
        certs: [leaf],
        signerIssuerCn: "AC Final do Governo Federal do Brasil v1",
        signerSerial: [0x11],
        messageDigest: digest,
      })
    );
    const sigs = auditPdfPadesSignatures(pdf);
    expect(sigs.length).toBe(1);
    expect(sigs[0].is_self_signed).toBe(false);
    expect(sigs[0].is_trusted_icp_chain).toBe(true);
    expect(sigs[0].digest_verified).toBe(true);
    expect(sigs[0].anomalies).toEqual([]);
  });

  test("7. Caminhamento encadeado X.509 aceita AC intermediária vinculada a AC Raiz confiável", () => {
    const leaf = buildCert({
      serial: [0x21],
      issuerCn: "AC Corporativa Intermediaria G1",
      subjectCn: "ENGENHEIRO RESPONSAVEL:55566677788",
      cpf: "55566677788",
    });
    const intermediate = buildCert({
      serial: [0x20],
      issuerCn: "Autoridade Certificadora Raiz Brasileira v10",
      subjectCn: "AC Corporativa Intermediaria G1",
    });
    const pdf = buildSignedPdf((digest) =>
      buildCms({
        certs: [leaf, intermediate],
        signerIssuerCn: "AC Corporativa Intermediaria G1",
        signerSerial: [0x21],
        messageDigest: digest,
      })
    );
    const sigs = auditPdfPadesSignatures(pdf);
    expect(sigs.length).toBe(1);
    expect(sigs[0].is_trusted_icp_chain).toBe(true);
    expect(sigs[0].anomalies).toEqual([]);
  });

  test("8. Anti-bypass: certificado ICP-Brasil solto não vinculado ao issuerDn da folha continua bloqueado", () => {
    const leafUntrusted = buildCert({
      serial: [0x31],
      issuerCn: "Emissor Desconhecido XYZ",
      subjectCn: "SIGNATARIO NAO CREDENCIADO",
    });
    const detachedTrusted = buildCert({
      serial: [0x32],
      issuerCn: "Autoridade Certificadora Raiz Brasileira v5",
      subjectCn: "AC Soluti ICP-Brasil",
    });
    const pdf = buildSignedPdf((digest) =>
      buildCms({
        certs: [leafUntrusted, detachedTrusted],
        signerIssuerCn: "Emissor Desconhecido XYZ",
        signerSerial: [0x31],
        messageDigest: digest,
      })
    );
    const sigs = auditPdfPadesSignatures(pdf);
    expect(sigs.length).toBe(1);
    expect(sigs[0].is_trusted_icp_chain).toBe(false);
    expect(sigs[0].anomalies).toContain("[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]");
  });
});
