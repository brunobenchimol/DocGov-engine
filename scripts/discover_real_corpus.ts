import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInflateRaw } from "node:zlib";
import JSZip from "jszip";
import { auditPdfPadesSignatures } from "../src/utils/pdf/pades_signature_auditor.ts";
import { extractDocxForensicMetaFromBuffer } from "../src/utils/pdf/docx_forensic_meta.ts";
import { extractXlsxForensicMetaFromBuffer } from "../src/utils/pdf/xlsx_forensic_meta.ts";
import { parseAndValidateNfeAccessKey } from "../src/utils/forensics/nfe_key_validator.ts";

const ROOT = resolve(import.meta.dir, "..");
const MANIFEST_PATH = join(ROOT, "scripts", "real_corpus_manifest.json");
const CACHE_DIR = join(ROOT, ".local_real_corpus");
const USER_AGENT = "docgov-engine/1.7.0 (real-corpus-smoke)";
const TIMEOUT_MS = 15000;
const MAX_PDF_CANDIDATES = 25;
const MAX_OOXML_CANDIDATES = 18;
const MAX_BYTES = 12 * 1024 * 1024;
const FORCE_REFRESH = process.argv.includes("--refresh");

const sha256 = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");
const fmtDate = (d: Date): string => d.toISOString().slice(0, 10).replace(/-/g, "");
const isPdf = (b: Buffer): boolean => b.length >= 5 && b.subarray(0, 5).toString("latin1") === "%PDF-";
const isZip = (b: Buffer): boolean => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

async function fetchBuffer(url: string, accept = "*/*"): Promise<{ ok: boolean; status: number; buf: Buffer }> {
  try {
    const res = await fetch(url, { headers: { Accept: accept, "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "follow" });
    if (!res.ok) return { ok: false, status: res.status, buf: Buffer.alloc(0) };
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) return { ok: false, status: 413, buf: Buffer.alloc(0) };
    return { ok: true, status: res.status, buf: Buffer.from(ab) };
  } catch {
    return { ok: false, status: 0, buf: Buffer.alloc(0) };
  }
}

async function fetchJson(url: string): Promise<any | null> {
  const res = await fetchBuffer(url, "application/json, */*");
  if (!res.ok) return null;
  try { return JSON.parse(res.buf.toString("utf-8")); } catch { return null; }
}

function countRawPdfSignals(buf: Buffer): { sigCount: number; hasDssOrTs: boolean } {
  const raw = buf.toString("latin1");
  const sigCount = (raw.match(/\/Type\s*\/Sig\b/g) || []).length;
  const hasDssOrTs = /\/DSS\b|\/Type\s*\/DocTimeStamp\b|\/SubFilter\s*\/ETSI\.RFC3161\b/.test(raw);
  return { sigCount, hasDssOrTs };
}

async function collectPncpPdfUrls(): Promise<string[]> {
  const seenUrls = new Set<string>();
  const nonMunicipal: string[] = [];
  const municipalRows: Array<{ arqUrl: string }> = [];
  const now = new Date();
  const d14 = new Date(now.getTime() - 14 * 86400_000);
  const d30 = new Date(now.getTime() - 30 * 86400_000);

  const endpoints = [
    { kind: "contratos", url: `https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=${fmtDate(d14)}&dataFinal=${fmtDate(now)}&pagina=1&tamanhoPagina=100` },
    { kind: "contratos", url: `https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=${fmtDate(d14)}&dataFinal=${fmtDate(now)}&pagina=2&tamanhoPagina=100` },
    { kind: "contratos", url: `https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=${fmtDate(d14)}&dataFinal=${fmtDate(now)}&pagina=3&tamanhoPagina=100` },
    { kind: "contratos", url: `https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=${fmtDate(d14)}&dataFinal=${fmtDate(now)}&pagina=4&tamanhoPagina=100` },
    { kind: "atas", url: `https://pncp.gov.br/api/consulta/v1/atas?dataInicial=${fmtDate(d30)}&dataFinal=${fmtDate(now)}&pagina=1&tamanhoPagina=50` },
  ];

  const seenOrgs = new Set<string>();
  for (const ep of endpoints) {
    const data = await fetchJson(ep.url);
    const rows = Array.isArray(data?.data) ? data.data : [];
    for (const row of rows) {
      const cnpj = String(row?.orgaoEntidade?.cnpj || "").replace(/\D/g, "");
      if (!cnpj || seenOrgs.has(cnpj)) continue;
      seenOrgs.add(cnpj);
      const arqUrl = ep.kind === "atas"
        ? `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/atas/${row.anoAta}/${row.sequencialAta}/arquivos`
        : `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/contratos/${row.anoContrato}/${row.sequencialContrato}/arquivos`;
      const esf = String(row?.orgaoEntidade?.esferaId || "M");
      if (esf === "M") {
        if (municipalRows.length < 15) municipalRows.push({ arqUrl });
        continue;
      }
      const files = await fetchJson(arqUrl);
      if (!Array.isArray(files) || files.length === 0) continue;
      const first = files[0];
      const fUrl = typeof first?.url === "string" && first.url.startsWith("http")
        ? first.url
        : `${arqUrl}/${first?.sequencialDocumento ?? first?.id ?? 1}`;
      if (!seenUrls.has(fUrl)) {
        seenUrls.add(fUrl);
        nonMunicipal.push(fUrl);
      }
      if (nonMunicipal.length >= 30) return nonMunicipal;
    }
  }
  for (const m of municipalRows) {
    if (nonMunicipal.length >= 30) break;
    const files = await fetchJson(m.arqUrl);
    if (!Array.isArray(files) || files.length === 0) continue;
    const first = files[0];
    const fUrl = typeof first?.url === "string" && first.url.startsWith("http")
      ? first.url
      : `${m.arqUrl}/${first?.sequencialDocumento ?? first?.id ?? 1}`;
    if (!seenUrls.has(fUrl)) {
      seenUrls.add(fUrl);
      nonMunicipal.push(fUrl);
    }
  }
  return nonMunicipal;
}

async function collectGovBrOoxmlLinks(): Promise<{ docxUrls: string[]; xlsxUrls: string[] }> {
  const pages = [
    "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/modelos/licitacoesecontratos/14133/pregao-e-concorrencia",
    "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/modelos/licitacoesecontratos/14133/bens-e-servicos-de-tic",
    "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/modelos/licitacoesecontratos/14133/contratacao-direta",
    "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/modelos/licitacoesecontratos/14133/listas-de-verificacao",
    "https://www.gov.br/compras/pt-br/agente-publico/cadernos-de-logistica",
  ];
  const docxUrls: string[] = [];
  const xlsxUrls: string[] = [
    "https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/midia/modelo-planilha-para-portal-compras1.xlsx",
  ];

  for (const page of pages) {
    const res = await fetchBuffer(page, "text/html,*/*");
    if (!res.ok) continue;
    const html = res.buf.toString("utf-8");
    for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
      let abs = "";
      try { abs = new URL(m[1], page).toString(); } catch { continue; }
      if (!abs.startsWith("https://www.gov.br/")) continue;
      const low = abs.toLowerCase();
      if (low.endsWith(".odt") || low.endsWith(".pdf")) continue;
      if (low.includes(".xlsx") && !xlsxUrls.includes(abs)) xlsxUrls.push(abs);
      else if (low.includes(".docx") && !docxUrls.includes(abs)) docxUrls.push(abs);
    }
  }
  return { docxUrls, xlsxUrls };
}

function parseNfeCsvChunk(csvText: string): { key: string; cnpj: string; issueDate: string } | null {
  const lines = csvText.split(/\r?\n/).slice(1);
  for (const line of lines) {
    const cols = line.split(";").map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 10) continue;
    const key = cols[0].replace(/\D/g, "");
    const modelo = cols[1];
    const rawDate = cols[5];
    const emitterDoc = cols[8].replace(/\D/g, "");
    if (key.length !== 44 || !modelo.startsWith("55") || emitterDoc.length !== 14) continue;
    const dm = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!dm) continue;
    const issueDate = `${dm[3]}-${dm[2]}-${dm[1]}`;
    const check = parseAndValidateNfeAccessKey(key, { expectedCnpj: emitterDoc, declaredIssueDate: issueDate });
    if (check.valid_structure_and_dv && check.valid_cnpj_and_date && check.blocking_tags.length === 0) {
      return { key, cnpj: emitterDoc, issueDate };
    }
  }
  return null;
}

async function discoverNfeFromPortalTransparencia(): Promise<{ url: string; key: string; cnpj: string; issueDate: string } | null> {
  const now = new Date();
  for (let back = 1; back <= 12; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const ym = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const url = `https://portaldatransparencia.gov.br/download-de-dados/notas-fiscais/${ym}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: ctrl.signal, redirect: "follow" });
      if (!res.ok || !res.body) { ctrl.abort(); clearTimeout(timer); continue; }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("text/html")) { ctrl.abort(); clearTimeout(timer); continue; }

      const reader = res.body.getReader();
      const chunks: Buffer[] = [];
      let total = 0;
      while (total < 131072) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(Buffer.from(value));
        total += value.byteLength;
      }
      ctrl.abort();
      clearTimeout(timer);

      const zipBuf = Buffer.concat(chunks);
      if (!isZip(zipBuf) || zipBuf.length < 40) continue;
      const method = zipBuf.readUInt16LE(8);
      const dataOffset = 30 + zipBuf.readUInt16LE(26) + zipBuf.readUInt16LE(28);
      if (dataOffset >= zipBuf.length) continue;

      const compressed = zipBuf.subarray(dataOffset);
      const plain = method === 0 ? compressed.subarray(0, 8192) : await new Promise<Buffer>((resInf) => {
        let out = Buffer.alloc(0);
        const inf = createInflateRaw();
        inf.on("data", (c: Buffer) => {
          out = Buffer.concat([out, c]);
          if (out.length >= 8192) resInf(out);
        });
        inf.on("error", () => resInf(out));
        inf.on("end", () => resInf(out));
        inf.write(compressed);
        setTimeout(() => resInf(out), 1500);
      });
      const parsed = parseNfeCsvChunk(plain.toString("latin1"));
      if (parsed) return { url, ...parsed };
    } catch {
      clearTimeout(timer);
    }
  }
  return null;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  const slots = manifest.slots;

  if (FORCE_REFRESH || !slots.pades_single_icp.url || !slots.pades_cosigned_or_ltv.url) {
    console.log("🔎 [1/3] Buscando PDFs públicos assinados no PNCP (sem viés de filtro por cadeia/anomalia)...");
    const pdfUrls = await collectPncpPdfUrls();
    let testedPdfs = 0;
    for (const url of pdfUrls) {
      if (testedPdfs >= MAX_PDF_CANDIDATES) break;
      if (slots.pades_single_icp.url && slots.pades_cosigned_or_ltv.url && !FORCE_REFRESH) break;
      const res = await fetchBuffer(url, "application/pdf, */*");
      if (!res.ok || !isPdf(res.buf)) continue;
      testedPdfs++;
      const { sigCount, hasDssOrTs } = countRawPdfSignals(res.buf);
      if (sigCount === 0) continue;

      const pades = auditPdfPadesSignatures(res.buf);
      const issuerCn = pades.find((s) => s.issuer_cn)?.issuer_cn || undefined;
      const hash = sha256(res.buf);

      if (sigCount === 1 && !hasDssOrTs && (FORCE_REFRESH || !slots.pades_single_icp.url)) {
        writeFileSync(join(CACHE_DIR, "pades_single_icp.pdf"), res.buf);
        slots.pades_single_icp = { url, file_name: "pades_single_icp.pdf", sha256: hash, expected_magic: "%PDF-", signature_count: sigCount, ...(issuerCn ? { issuer_cn: issuerCn } : {}) };
        console.log(`  ✅ pades_single_icp (${testedPdfs} PDFs testados): sig=${sigCount}, AC=${issuerCn || "N/A"}`);
      } else if ((sigCount >= 2 || (sigCount >= 1 && hasDssOrTs)) && (FORCE_REFRESH || !slots.pades_cosigned_or_ltv.url)) {
        writeFileSync(join(CACHE_DIR, "pades_cosigned_or_ltv.pdf"), res.buf);
        slots.pades_cosigned_or_ltv = { url, file_name: "pades_cosigned_or_ltv.pdf", sha256: hash, expected_magic: "%PDF-", signature_count: sigCount, ...(issuerCn ? { issuer_cn: issuerCn } : {}) };
        console.log(`  ✅ pades_cosigned_or_ltv (${testedPdfs} PDFs testados): sig=${sigCount}, DSS/TS=${hasDssOrTs}, AC=${issuerCn || "N/A"}`);
      }
      if (slots.pades_single_icp.url && slots.pades_cosigned_or_ltv.url) break;
    }
  }

  if (FORCE_REFRESH || !slots.ooxml_docx_agu_a.url || !slots.ooxml_docx_agu_b.url || !slots.ooxml_xlsx_agu.url) {
    console.log("🔎 [2/3] Buscando modelos .docx (AGU) e .xlsx (Compras.gov.br/AGU)...");
    const { docxUrls, xlsxUrls } = await collectGovBrOoxmlLinks();
    let testedOoxml = 0;
    for (const url of [...xlsxUrls, ...docxUrls]) {
      if (testedOoxml >= MAX_OOXML_CANDIDATES) break;
      if (slots.ooxml_docx_agu_a.url && slots.ooxml_docx_agu_b.url && slots.ooxml_xlsx_agu.url && !FORCE_REFRESH) break;
      const res = await fetchBuffer(url);
      if (!res.ok || !isZip(res.buf)) continue;
      testedOoxml++;
      try {
        const zip = await JSZip.loadAsync(res.buf);
        const hash = sha256(res.buf);
        if (zip.file("xl/workbook.xml") && (FORCE_REFRESH || !slots.ooxml_xlsx_agu.url)) {
          await extractXlsxForensicMetaFromBuffer(res.buf);
          writeFileSync(join(CACHE_DIR, "ooxml_xlsx_agu.xlsx"), res.buf);
          slots.ooxml_xlsx_agu = { url, file_name: "ooxml_xlsx_agu.xlsx", sha256: hash, expected_magic: "PK" };
          console.log(`  ✅ ooxml_xlsx_agu: SHA-256=${hash.slice(0, 12)}...`);
        } else if (zip.file("word/document.xml") && (FORCE_REFRESH || !slots.ooxml_docx_agu_a.url || !slots.ooxml_docx_agu_b.url)) {
          const meta = await extractDocxForensicMetaFromBuffer(res.buf);
          if (!meta.rsid_root) continue;
          if (!slots.ooxml_docx_agu_a.url) {
            writeFileSync(join(CACHE_DIR, "ooxml_docx_agu_a.docx"), res.buf);
            slots.ooxml_docx_agu_a = { url, file_name: "ooxml_docx_agu_a.docx", sha256: hash, expected_magic: "PK", rsid_root: meta.rsid_root };
            console.log(`  ✅ ooxml_docx_agu_a: rsidRoot=${meta.rsid_root}`);
          } else if (url !== slots.ooxml_docx_agu_a.url && meta.rsid_root !== slots.ooxml_docx_agu_a.rsid_root && !slots.ooxml_docx_agu_b.url) {
            writeFileSync(join(CACHE_DIR, "ooxml_docx_agu_b.docx"), res.buf);
            slots.ooxml_docx_agu_b = { url, file_name: "ooxml_docx_agu_b.docx", sha256: hash, expected_magic: "PK", rsid_root: meta.rsid_root };
            console.log(`  ✅ ooxml_docx_agu_b: rsidRoot=${meta.rsid_root}`);
          }
        }
      } catch { /* ignore invalid zip */ }
    }
  }

  if (FORCE_REFRESH || !slots.nfe_public_transparency.access_key_44) {
    console.log("🔎 [3/3] Extraindo 1 registro NF-e modelo 55 público do Portal da Transparência...");
    const nfe = await discoverNfeFromPortalTransparencia();
    if (nfe) {
      slots.nfe_public_transparency = { url: nfe.url, access_key_44: nfe.key, issuer_cnpj: nfe.cnpj, issue_date: nfe.issueDate };
      console.log(`  ✅ nfe_public_transparency: AAMM=${nfe.key.slice(2, 6)}, CNPJ=${nfe.cnpj}, data=${nfe.issueDate}`);
    }
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log("\n📄 Manifesto atualizado em scripts/real_corpus_manifest.json");
}

main().catch((err) => { console.error("Erro fatal:", err); process.exit(1); });
