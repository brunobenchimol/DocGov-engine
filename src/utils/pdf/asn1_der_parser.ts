export interface Asn1Node {
  tag: number;
  isConstructed: boolean;
  headerLen: number;
  valueStart: number;
  valueEnd: number;
  totalLen: number;
  indefinite: boolean;
  children: Asn1Node[];
}

export interface ParsedX509Certificate {
  serialNumberHex: string;
  issuerDn: string;
  issuerCn: string | null;
  subjectDn: string;
  subjectCn: string | null;
  notBeforeIso: string | null;
  notAfterIso: string | null;
  icpBrasilCpf: string | null;
  icpBrasilCnpj: string | null;
}

export interface ParsedCmsSignedData {
  certificates: ParsedX509Certificate[];
  signerIssuerDn: string | null;
  signerSerialNumberHex: string | null;
  digestAlgorithm?: "sha256" | "sha384" | "sha512" | "sha1";
  messageDigestHex?: string;
  hasSignedAttrs: boolean;
}

const OID_LABELS: Record<string, string> = {
  "2.5.4.3": "CN", "2.5.4.5": "SERIALNUMBER", "2.5.4.6": "C", "2.5.4.7": "L",
  "2.5.4.8": "ST", "2.5.4.10": "O", "2.5.4.11": "OU", "1.2.840.113549.1.9.1": "E",
};

const DIGEST_OIDS: Record<string, "sha256" | "sha384" | "sha512" | "sha1"> = {
  "2.16.840.1.101.3.4.2.1": "sha256", "2.16.840.1.101.3.4.2.2": "sha384",
  "2.16.840.1.101.3.4.2.3": "sha512", "1.3.14.3.2.26": "sha1",
};

const sliceNode = (buf: Buffer, node: Asn1Node): Buffer => buf.subarray(node.valueStart, node.valueEnd);

export function parseAsn1Node(buf: Buffer, offset = 0, limit = buf.length, depth = 0): Asn1Node | null {
  if (depth > 40 || offset < 0 || offset + 2 > limit) return null;
  const tag = buf[offset];
  let cursor = offset + 1;
  if ((tag & 0x1f) === 0x1f) {
    while (cursor < limit && (buf[cursor] & 0x80) !== 0) cursor++;
    cursor++;
  }
  if (cursor >= limit) return null;

  const isConstructed = (tag & 0x20) !== 0;
  const lenByte = buf[cursor++];
  let indefinite = false;
  let contentLen = 0;

  if (lenByte === 0x80) {
    indefinite = true;
  } else if (lenByte < 0x80) {
    contentLen = lenByte;
  } else {
    const numOctets = lenByte & 0x7f;
    if (numOctets === 0 || numOctets > 4 || cursor + numOctets > limit) return null;
    for (let i = 0; i < numOctets; i++) contentLen = contentLen * 256 + buf[cursor++];
  }

  const headerLen = cursor - offset;
  const valueStart = cursor;
  const children: Asn1Node[] = [];

  if (indefinite) {
    let pos = valueStart;
    while (pos + 1 < limit) {
      if (buf[pos] === 0x00 && buf[pos + 1] === 0x00) {
        return { tag, isConstructed, headerLen, valueStart, valueEnd: pos, totalLen: pos + 2 - offset, indefinite: true, children };
      }
      const child = parseAsn1Node(buf, pos, limit, depth + 1);
      if (!child || child.totalLen <= 0) return null;
      children.push(child);
      pos += child.totalLen;
    }
    return null;
  }

  const valueEnd = Math.min(limit, valueStart + contentLen);
  if (valueStart + contentLen > limit) return null;
  if (isConstructed) {
    let pos = valueStart;
    while (pos < valueEnd) {
      const child = parseAsn1Node(buf, pos, valueEnd, depth + 1);
      if (!child || child.totalLen <= 0) break;
      children.push(child);
      pos += child.totalLen;
    }
  }
  return { tag, isConstructed, headerLen, valueStart, valueEnd, totalLen: headerLen + contentLen, indefinite: false, children };
}

export function sliceDerByRootTlvLength(rawBuf: Buffer): Buffer {
  const root = parseAsn1Node(rawBuf, 0, rawBuf.length);
  return root && root.totalLen > 0 ? rawBuf.subarray(0, root.totalLen) : rawBuf;
}

export function decodeOid(buf: Buffer): string {
  if (buf.length === 0) return "";
  const parts = [Math.floor(buf[0] / 40), buf[0] % 40];
  let acc = 0;
  for (let i = 1; i < buf.length; i++) {
    acc = acc * 128 + (buf[i] & 0x7f);
    if ((buf[i] & 0x80) === 0) {
      parts.push(acc);
      acc = 0;
    }
  }
  return parts.join(".");
}

function collectOctets(node: Asn1Node, buf: Buffer): Buffer {
  if (!node.isConstructed || node.children.length === 0) return sliceNode(buf, node);
  return Buffer.concat(node.children.map((c) => collectOctets(c, buf)));
}

export function decodeAsn1String(node: Asn1Node, buf: Buffer): string {
  const raw = collectOctets(node, buf);
  if (node.tag === 0x1e) {
    let out = "";
    for (let i = 0; i + 1 < raw.length; i += 2) out += String.fromCharCode((raw[i] << 8) | raw[i + 1]);
    return out.trim();
  }
  return raw.toString("utf8").replace(/\0/g, "").trim();
}

export function decodeAsn1Time(node: Asn1Node, buf: Buffer): string | null {
  const txt = sliceNode(buf, node).toString("ascii").trim();
  const m = node.tag === 0x17 ? txt.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?/) : txt.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?/);
  if (!m) return null;
  const year = node.tag === 0x17 ? (Number(m[1]) >= 50 ? 1900 + Number(m[1]) : 2000 + Number(m[1])) : Number(m[1]);
  const iso = `${String(year).padStart(4, "0")}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || "00"}.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

const normalizeSerialHex = (buf: Buffer): string => buf.toString("hex").toUpperCase().replace(/^0+/, "") || "00";

export function parseDistinguishedName(seqNode: Asn1Node, buf: Buffer): { dn: string; cn: string | null } {
  const rdns: string[] = [];
  let cn: string | null = null;
  for (const rdnSet of seqNode.children) {
    for (const atv of rdnSet.children) {
      if (atv.children.length < 2) continue;
      const label = OID_LABELS[decodeOid(sliceNode(buf, atv.children[0]))] || decodeOid(sliceNode(buf, atv.children[0]));
      const val = decodeAsn1String(atv.children[1], buf);
      if (val) {
        rdns.push(`${label}=${val}`);
        if (label === "CN" && !cn) cn = val;
      }
    }
  }
  return { dn: rdns.join(", "), cn };
}

function extractIcpBrasilFromSan(sanBytes: Buffer): { cpf: string | null; cnpj: string | null } {
  const sanNode = parseAsn1Node(sanBytes, 0, sanBytes.length);
  if (!sanNode) return { cpf: null, cnpj: null };
  let cpf: string | null = null;
  let cnpj: string | null = null;
  for (const gn of sanNode.children) {
    if (gn.tag !== 0xa0 || gn.children.length < 2) continue;
    const oid = decodeOid(sliceNode(sanBytes, gn.children[0]));
    const inner = gn.children[1].children[0] || gn.children[1];
    const digits = decodeAsn1String(inner, sanBytes).replace(/\D/g, "");
    if (oid === "2.16.76.1.3.1" && !cpf) cpf = digits.length >= 19 ? digits.slice(8, 19) : digits.length === 11 ? digits : null;
    else if (oid === "2.16.76.1.3.3" && !cnpj && digits.length >= 14) cnpj = digits.slice(0, 14);
  }
  return { cpf, cnpj };
}

export function parseX509Certificate(certNode: Asn1Node, buf: Buffer): ParsedX509Certificate | null {
  const tbs = certNode.children[0];
  if (!tbs || tbs.children.length < 6) return null;
  const idx = tbs.children[0].tag === 0xa0 ? 1 : 0;
  if (tbs.children.length <= idx + 4) return null;

  const serialNumberHex = normalizeSerialHex(sliceNode(buf, tbs.children[idx]));
  const issuer = parseDistinguishedName(tbs.children[idx + 2], buf);
  const validity = tbs.children[idx + 3];
  const notBeforeIso = validity.children[0] ? decodeAsn1Time(validity.children[0], buf) : null;
  const notAfterIso = validity.children[1] ? decodeAsn1Time(validity.children[1], buf) : null;
  const subject = parseDistinguishedName(tbs.children[idx + 4], buf);

  let icpBrasilCpf: string | null = null;
  let icpBrasilCnpj: string | null = null;
  const extSeq = tbs.children.slice(idx + 5).find((c) => c.tag === 0xa3)?.children[0];
  if (extSeq) {
    for (const ext of extSeq.children) {
      if (ext.children.length < 2 || decodeOid(sliceNode(buf, ext.children[0])) !== "2.5.29.17") continue;
      const octetNode = ext.children.find((c) => c.tag === 0x04 || c.tag === 0x24);
      if (octetNode) {
        const res = extractIcpBrasilFromSan(collectOctets(octetNode, buf));
        icpBrasilCpf = res.cpf;
        icpBrasilCnpj = res.cnpj;
      }
    }
  }
  return { serialNumberHex, issuerDn: issuer.dn, issuerCn: issuer.cn, subjectDn: subject.dn, subjectCn: subject.cn, notBeforeIso, notAfterIso, icpBrasilCpf, icpBrasilCnpj };
}

export function parseCmsSignedData(derBuf: Buffer): ParsedCmsSignedData | null {
  const root = parseAsn1Node(derBuf, 0, derBuf.length);
  const signedData = root?.children.find((c) => c.tag === 0xa0)?.children[0];
  if (!signedData || signedData.children.length < 4) return null;

  const certsWrapper = signedData.children.find((c) => c.tag === 0xa0);
  const certificates = (certsWrapper?.children || [])
    .map((c) => parseX509Certificate(c, derBuf))
    .filter((c): c is ParsedX509Certificate => Boolean(c));

  const firstSigner = [...signedData.children].reverse().find((c) => c.tag === 0x31)?.children[0];
  if (!firstSigner || firstSigner.children.length < 4) {
    return { certificates, signerIssuerDn: null, signerSerialNumberHex: null, hasSignedAttrs: false };
  }

  let signerIssuerDn: string | null = null;
  let signerSerialNumberHex: string | null = null;
  const sidNode = firstSigner.children[1];
  if (sidNode.tag === 0x30 && sidNode.children.length >= 2) {
    signerIssuerDn = parseDistinguishedName(sidNode.children[0], derBuf).dn;
    signerSerialNumberHex = normalizeSerialHex(sliceNode(derBuf, sidNode.children[1]));
  }

  const algOidNode = firstSigner.children[2]?.children[0];
  const digestAlgorithm = algOidNode ? DIGEST_OIDS[decodeOid(sliceNode(derBuf, algOidNode))] : undefined;
  const signedAttrs = firstSigner.children.find((c) => c.tag === 0xa0);
  let messageDigestHex: string | undefined;
  if (signedAttrs) {
    for (const attr of signedAttrs.children) {
      if (attr.children.length >= 2 && decodeOid(sliceNode(derBuf, attr.children[0])) === "1.2.840.113549.1.9.4") {
        const valOctet = attr.children[1]?.children[0];
        if (valOctet) messageDigestHex = collectOctets(valOctet, derBuf).toString("hex").toLowerCase();
      }
    }
  }
  return { certificates, signerIssuerDn, signerSerialNumberHex, digestAlgorithm, messageDigestHex, hasSignedAttrs: Boolean(signedAttrs) };
}
