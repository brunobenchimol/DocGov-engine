import { createHash } from "node:crypto";
import type { PdfPadesSignatureDetail } from "../../types/index.ts";
import {
  parseCmsSignedData,
  sliceDerByRootTlvLength,
  type ParsedX509Certificate,
} from "./asn1_der_parser.ts";

const TRUSTED_ICP_ISSUER_REGEX =
  /(ICP-?Brasil|Autoridade Certificadora Raiz Brasileira|AC-?Raiz|AC\s+(?:Final|Intermedi[aá]ria|Raiz)\s+do\s+Governo\s+Federal\s+do\s+Brasil|Governo\s+Federal\s+do\s+Brasil|Secretaria\s+de\s+Governo\s+Digital|\bGOV\.BR\b|\bITI\b|\bSERPRO\b|\bCertisign\b|\bSoluti\b|\bValid\b|\bSafeweb\b|\bAC\s*RFB\b|\bDigitalSign\b|\bImprensa Oficial\b|\bAC\s+Caixa\b|\bAC\s+Receita\b|\bAC\s+JUS\b|\bAC\s+OAB\b)/i;

function normalizeDn(dn: string | null | undefined): string {
  if (!dn) return "";
  return dn
    .toLowerCase()
    .replace(/\s*,\s*/g, ",")
    .replace(/\s*=\s*/g, "=")
    .replace(/\s+/g, " ")
    .trim();
}

function hasTrustedIcpIssuerChain(
  certs: ParsedX509Certificate[],
  leaf: ParsedX509Certificate | null,
  issuerDn: string | null,
  isSelfSigned: boolean
): boolean {
  if (!issuerDn || isSelfSigned) return false;
  if (TRUSTED_ICP_ISSUER_REGEX.test(issuerDn)) return true;
  if (!leaf || certs.length === 0) return false;

  const visitedSubjectDns = new Set<string>();
  const leafSubjectNorm = normalizeDn(leaf.subjectDn);
  if (leafSubjectNorm) visitedSubjectDns.add(leafSubjectNorm);

  let currentIssuerDn = issuerDn;
  for (let depth = 0; depth < 5; depth++) {
    const currentIssuerNorm = normalizeDn(currentIssuerDn);
    if (!currentIssuerNorm) return false;

    const parent = certs.find((c) => {
      const subNorm = normalizeDn(c.subjectDn);
      return Boolean(subNorm) && subNorm === currentIssuerNorm && !visitedSubjectDns.has(subNorm);
    });
    if (!parent) return false;

    if (
      (parent.subjectDn && TRUSTED_ICP_ISSUER_REGEX.test(parent.subjectDn)) ||
      (parent.issuerDn && TRUSTED_ICP_ISSUER_REGEX.test(parent.issuerDn))
    ) {
      return true;
    }

    const parentSubNorm = normalizeDn(parent.subjectDn);
    const parentIssNorm = normalizeDn(parent.issuerDn);
    if (!parentIssNorm || parentSubNorm === parentIssNorm) return false;

    visitedSubjectDns.add(parentSubNorm);
    currentIssuerDn = parent.issuerDn!;
  }
  return false;
}

function normalizeTextTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/:\d{11,14}\b/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function selectLeafCertificate(
  certs: ParsedX509Certificate[],
  signerIssuerDn: string | null,
  signerSerialHex: string | null
): ParsedX509Certificate | null {
  if (certs.length === 0) return null;
  if (signerSerialHex) {
    const normSignerIssuer = normalizeDn(signerIssuerDn);
    const exact = certs.find(
      (c) =>
        c.serialNumberHex === signerSerialHex &&
        (!normSignerIssuer || normalizeDn(c.issuerDn) === normSignerIssuer)
    );
    if (exact) return exact;
    const bySerial = certs.find((c) => c.serialNumberHex === signerSerialHex);
    if (bySerial) return bySerial;
  }
  const nonSelfSigned = certs.find(
    (c) => normalizeDn(c.subjectDn) !== normalizeDn(c.issuerDn)
  );
  return nonSelfSigned || certs[0];
}

function extractSignatureDictChunk(rawLatin1: string, matchIndex: number): string {
  const before = rawLatin1.slice(Math.max(0, matchIndex - 4096), matchIndex);
  const objMatches = [...before.matchAll(/\b\d+\s+\d+\s+obj\b/g)];
  const start =
    objMatches.length > 0
      ? Math.max(0, matchIndex - 4096) + (objMatches[objMatches.length - 1].index ?? 0)
      : Math.max(0, rawLatin1.lastIndexOf("<<", matchIndex));

  const endObjIdx = rawLatin1.indexOf("endobj", matchIndex);
  const end =
    endObjIdx !== -1
      ? endObjIdx + 6
      : Math.min(rawLatin1.length, matchIndex + 65536);
  return rawLatin1.slice(start, end);
}

function detectTailSuspectTampering(tail: string): boolean {
  const hasCoSigOrDss =
    /\/Type\s*\/(?:Sig|DocTimeStamp)\b/.test(tail) || /\/DSS\b/.test(tail);
  if (!hasCoSigOrDss) return true;

  const nonFormContentStreams = new Set<string>();
  const pageObjs: string[] = [];

  for (const m of tail.matchAll(/(\d+)\s+\d+\s+obj\b([\s\S]*?)\bendobj\b/g)) {
    const objId = m[1];
    const body = m[2];
    const streamIdx = body.indexOf("stream");

    if (/\/Type\s*\/Page\b/.test(body)) {
      pageObjs.push(body);
    }

    if (streamIdx !== -1) {
      const dictHead = body.slice(0, streamIdx);
      const streamBody = body.slice(streamIdx);
      const isFormXObject = /\/Subtype\s*\/Form\b/.test(dictHead);
      const isInfraStream =
        /\/Type\s*\/(?:XRef|ObjStm)\b/.test(dictHead) ||
        /\/Subtype\s*\/Image\b/.test(dictHead);

      if (!isFormXObject && !isInfraStream) {
        if (/\bBT\b[\s\S]*?\bET\b/.test(streamBody) || /\bT[jJ]\b/.test(streamBody)) {
          return true;
        }
        nonFormContentStreams.add(objId);
      }
    }
  }

  for (const pageBody of pageObjs) {
    const contentsRef = pageBody.match(/\/Contents\s*(?:\[([^\]]+)\]|(\d+)\s+\d+\s+R)/);
    if (!contentsRef) continue;
    const refsBlob = contentsRef[1] || `${contentsRef[2]} 0 R`;
    for (const r of refsBlob.matchAll(/(\d+)\s+\d+\s+R/g)) {
      if (nonFormContentStreams.has(r[1])) return true;
    }
  }

  return false;
}

export function auditPdfPadesSignatures(pdfBuffer: Buffer): PdfPadesSignatureDetail[] {
  const rawLatin1 = pdfBuffer.toString("latin1");
  const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const results: PdfPadesSignatureDetail[] = [];
  const seenOffsets = new Set<number>();

  let match: RegExpExecArray | null;
  while ((match = byteRangeRegex.exec(rawLatin1)) !== null) {
    const dictChunk = extractSignatureDictChunk(rawLatin1, match.index);
    const isSigDict =
      /\/Type\s*\/(?:Sig|DocTimeStamp)\b/.test(dictChunk) ||
      /\/SubFilter\s*\/(?:adbe\.pkcs7|ETSI\.CAdES|ETSI\.RFC3161)/i.test(dictChunk);
    if (!isSigDict) continue;

    const sigOffset = Number(match[1]);
    const sigPosKey = match.index;
    if (seenOffsets.has(sigPosKey)) continue;
    seenOffsets.add(sigPosKey);

    const a = sigOffset;
    const b = Number(match[2]);
    const c = Number(match[3]);
    const d = Number(match[4]);
    const isTimestamp =
      /\/Type\s*\/DocTimeStamp\b/.test(dictChunk) ||
      /\/SubFilter\s*\/ETSI\.RFC3161\b/i.test(dictChunk);

    const contentsMatch = dictChunk.match(/\/Contents\s*<([0-9A-Fa-f\s]+)>/);
    let parsedCms = null;
    if (contentsMatch) {
      const hex = contentsMatch[1].replace(/\s+/g, "");
      if (hex.length >= 8) {
        const rawDer = Buffer.from(hex, "hex");
        const slicedDer = sliceDerByRootTlvLength(rawDer);
        parsedCms = parseCmsSignedData(slicedDer);
      }
    }

    const leaf = parsedCms
      ? selectLeafCertificate(
          parsedCms.certificates,
          parsedCms.signerIssuerDn,
          parsedCms.signerSerialNumberHex
        )
      : null;

    const subjectDn = leaf?.subjectDn || null;
    const issuerDn = leaf?.issuerDn || parsedCms?.signerIssuerDn || null;
    const isSelfSigned = Boolean(
      subjectDn && issuerDn && normalizeDn(subjectDn) === normalizeDn(issuerDn)
    );
    const isTrustedIcpChain = hasTrustedIcpIssuerChain(
      parsedCms?.certificates ?? [],
      leaf,
      issuerDn,
      isSelfSigned
    );

    const anomalies: string[] = [];
    if (leaf && !isTimestamp && (isSelfSigned || !isTrustedIcpChain)) {
      anomalies.push("[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]");
    }

    const validBounds =
      a >= 0 && b >= 0 && c >= a + b && d >= 0 && c + d <= pdfBuffer.length;
    const postSigBytes = validBounds ? pdfBuffer.length - (c + d) : 0;
    const coversEof = validBounds && postSigBytes <= 16;

    let computedHashHex: string | undefined;
    let digestVerified: boolean | undefined;
    let postSigClassification: PdfPadesSignatureDetail["post_signature_classification"] =
      coversEof ? "NONE" : "SUSPECT_INCREMENTAL_TAMPERING";

    if (!validBounds) {
      postSigClassification = "SUSPECT_INCREMENTAL_TAMPERING";
      anomalies.push("[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]");
    } else {
      if (parsedCms?.hasSignedAttrs && parsedCms.messageDigestHex && parsedCms.digestAlgorithm) {
        computedHashHex = createHash(parsedCms.digestAlgorithm)
          .update(pdfBuffer.subarray(a, a + b))
          .update(pdfBuffer.subarray(c, c + d))
          .digest("hex")
          .toLowerCase();
        digestVerified = computedHashHex === parsedCms.messageDigestHex;
        if (!digestVerified) {
          postSigClassification = "SUSPECT_INCREMENTAL_TAMPERING";
          anomalies.push("[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]");
        }
      }

      if (postSigBytes > 16) {
        const tail = pdfBuffer.subarray(c + d).toString("latin1");
        if (detectTailSuspectTampering(tail)) {
          postSigClassification = "SUSPECT_INCREMENTAL_TAMPERING";
          if (!anomalies.includes("[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]")) {
            anomalies.push("[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]");
          }
        } else if (digestVerified !== false) {
          postSigClassification = "BENIGN_CO_SIGNATURE_OR_TIMESTAMP";
        }
      }
    }

    results.push({
      signature_index: results.length,
      byte_range: [a, b, c, d],
      covers_eof: coversEof,
      post_signature_bytes: postSigBytes,
      post_signature_classification: postSigClassification,
      ...(parsedCms?.digestAlgorithm ? { digest_algorithm: parsedCms.digestAlgorithm } : {}),
      ...(parsedCms?.messageDigestHex ? { message_digest_hex: parsedCms.messageDigestHex } : {}),
      ...(computedHashHex ? { computed_byte_range_hash_hex: computedHashHex } : {}),
      ...(digestVerified !== undefined ? { digest_verified: digestVerified } : {}),
      subject_cn: leaf?.subjectCn || null,
      issuer_cn: leaf?.issuerCn || null,
      subject_dn: subjectDn,
      issuer_dn: issuerDn,
      icp_brasil_cpf: leaf?.icpBrasilCpf || null,
      icp_brasil_cnpj: leaf?.icpBrasilCnpj || null,
      not_before_iso: leaf?.notBeforeIso || null,
      not_after_iso: leaf?.notAfterIso || null,
      is_self_signed: isSelfSigned,
      is_trusted_icp_chain: isTrustedIcpChain,
      anomalies,
    });
  }

  return results;
}

export function comparePadesSignerIdentity(
  signatures: PdfPadesSignatureDetail[],
  expected: { expectedSignerName?: string; expectedSignerCpfCnpj?: string }
): string[] {
  if (!signatures || signatures.length === 0) return [];
  const expectedDigits = (expected.expectedSignerCpfCnpj || "").replace(/\D/g, "");
  const expectedName = expected.expectedSignerName?.trim() || "";
  if (!expectedDigits && !expectedName) return [];

  const reasons: string[] = [];
  for (const sig of signatures) {
    const cnDigitsMatch = sig.subject_cn?.match(/\b(\d{11}|\d{14})\b/);
    const certCpf = sig.icp_brasil_cpf || (cnDigitsMatch?.[1].length === 11 ? cnDigitsMatch[1] : null);
    const certCnpj = sig.icp_brasil_cnpj || (cnDigitsMatch?.[1].length === 14 ? cnDigitsMatch[1] : null);

    if (expectedDigits.length === 11 && certCpf && certCpf !== expectedDigits) {
      reasons.push(
        `CPF do certificado X.509 (${certCpf}) diverge do signatário esperado (${expectedDigits}).`
      );
    } else if (expectedDigits.length === 14 && certCnpj && certCnpj !== expectedDigits) {
      reasons.push(
        `CNPJ do certificado X.509 (${certCnpj}) diverge do signatário esperado (${expectedDigits}).`
      );
    }

    if (expectedName && sig.subject_cn) {
      const expectedTokens = normalizeTextTokens(expectedName);
      const certTokens = normalizeTextTokens(sig.subject_cn);
      if (
        expectedTokens.length > 0 &&
        certTokens.length > 0 &&
        !expectedTokens.some((t) => certTokens.includes(t))
      ) {
        reasons.push(
          `Nome no certificado X.509 ('${sig.subject_cn}') diverge do signatário esperado ('${expectedName}').`
        );
      }
    }
  }
  return reasons;
}
