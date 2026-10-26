import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  mkdirSync,
  rmdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  unlinkSync,
  rmSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";
import JSZip from "jszip";
import {
  bootstrapCase,
  formatBootstrapCaseSyntheticResult,
} from "../src/tools/bootstrap.ts";
import { MINIMAL_DOCX_BASE64 } from "./helpers/fixtures.ts";

function getSampleDocxBuffer(): Buffer {
  return Buffer.from(MINIMAL_DOCX_BASE64, "base64");
}

function createTarBuffer(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const blocks: Buffer[] = [];

  for (const entry of entries) {
    const header = Buffer.alloc(512, 0);
    const nameBuf = Buffer.from(entry.name, "utf-8");
    nameBuf.copy(header, 0, 0, Math.min(nameBuf.length, 100));

    // file mode
    header.write("0000644\0", 100, 8, "ascii");
    // uid / gid
    header.write("0000000\0", 108, 8, "ascii");
    header.write("0000000\0", 116, 8, "ascii");
    // size in octal
    const sizeOctal = entry.data.length.toString(8).padStart(11, "0") + "\0";
    header.write(sizeOctal, 124, 12, "ascii");
    // mtime
    header.write("00000000000\0", 136, 12, "ascii");
    // typeflag '0' (normal file)
    header[156] = 0x30;
    // magic "ustar\0" + version "00"
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");

    // checksum
    for (let i = 0; i < 8; i++) {
      header[148 + i] = 0x20;
    }
    let sum = 0;
    for (let i = 0; i < 512; i++) {
      sum += header[i];
    }
    const sumOctal = sum.toString(8).padStart(6, "0") + "\0 ";
    header.write(sumOctal, 148, 8, "ascii");

    blocks.push(header);

    // file data padded to 512-byte blocks
    blocks.push(entry.data);
    const remainder = entry.data.length % 512;
    if (remainder !== 0) {
      blocks.push(Buffer.alloc(512 - remainder, 0));
    }
  }

  // Two 512-byte zero blocks marking end of archive
  blocks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(blocks);
}

describe("Testes de Integração v1.3.3: Descompactação Automática de Pacotes no bootstrap_case", () => {
  const testBaseDir = resolve("tmp_test_bootstrap_archives");

  beforeEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
    mkdirSync(testBaseDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  it("1. Deve extrair pacote ZIP contendo DOCX e PDF via uploadsDir e inspecioná-los em inputs/", async () => {
    const caseDir = resolve(testBaseDir, "cases/caso_zip_upload");
    const uploadsDir = resolve(testBaseDir, "uploads");
    mkdirSync(uploadsDir, { recursive: true });

    // Monta arquivo zip com DOCX, PDF e lixo de sistema
    const docxBuf = getSampleDocxBuffer();
    const pdfBuf = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Title (Edital do Processo) >>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    );

    const zip = new JSZip();
    zip.file("01 - Termo de Referencia.docx", docxBuf);
    zip.file("02 - Edital Completo.pdf", pdfBuf);
    zip.file("__MACOSX/._01 - Termo de Referencia.docx", Buffer.from("mac-metadata"));
    zip.file(".DS_Store", Buffer.from("ds-store"));

    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    writeFileSync(resolve(uploadsDir, "pacote_documentos.zip"), zipBuf);

    const res = await bootstrapCase(caseDir, uploadsDir);

    expect(res.status).toBe("success");
    expect(res.unpacked_archives).toBeDefined();
    expect(res.unpacked_archives!.length).toBe(1);
    expect(res.unpacked_archives![0].archiveName).toBe("pacote_documentos.zip");
    expect(res.unpacked_archives![0].archiveType).toBe("zip");
    expect(res.unpacked_archives![0].extractedCount).toBe(2);

    // Verifica que arquivos foram colocados em inputs/
    const inputsDir = resolve(caseDir, "inputs");
    expect(existsSync(join(inputsDir, "01 - Termo de Referencia.docx"))).toBe(true);
    expect(existsSync(join(inputsDir, "02 - Edital Completo.pdf"))).toBe(true);
    expect(existsSync(join(inputsDir, ".DS_Store"))).toBe(false);

    // Verifica que ambos foram inspecionados
    expect(res.inspectedDocx.length).toBe(1);
    expect(res.inspectedDocx[0].fileName).toBe("01 - Termo de Referencia.docx");
    expect(res.inspectedPdf).toBeDefined();
    expect(res.inspectedPdf!.length).toBe(1);
    expect(res.inspectedPdf![0].fileName).toBe("02 - Edital Completo.pdf");

    // Verifica índice mestre
    expect(res.indice_mestre_path).toBeDefined();
    const masterMd = readFileSync(res.indice_mestre_path!, "utf-8");
    expect(masterMd).toContain("Pacotes Compactados Descompactados Automaticamente");
    expect(masterMd).toContain("pacote_documentos.zip");
    expect(masterMd).toContain("01 - Termo de Referencia.docx");
    expect(masterMd).toContain("02 - Edital Completo.pdf");

    // Verifica synthetic result MCP
    const synthetic = formatBootstrapCaseSyntheticResult(res, "cases/caso_zip_upload");
    expect(synthetic.unpacked_archives_count).toBe(1);
    expect(synthetic.extracted_files_count).toBe(2);

    const payloadBytes = Buffer.byteLength(JSON.stringify(synthetic, null, 2), "utf-8");
    expect(payloadBytes).toBeLessThan(900);
  });

  it("2. Deve extrair pacote TAR.GZ contendo subpastas, achatar nomes e inspecionar", async () => {
    const caseDir = resolve(testBaseDir, "cases/caso_targz");
    const uploadsDir = resolve(testBaseDir, "uploads_targz");
    mkdirSync(uploadsDir, { recursive: true });

    const docxBuf = getSampleDocxBuffer();
    const tarBuf = createTarBuffer([
      { name: "processo/anexo_a/minuta_contrato.docx", data: docxBuf },
      { name: "processo/anexo_b/detalhes.txt", data: Buffer.from("Observações complementares.") },
    ]);
    const tgzBuf = gzipSync(tarBuf);
    writeFileSync(resolve(uploadsDir, "arquivos_processo.tar.gz"), tgzBuf);

    const res = await bootstrapCase(caseDir, uploadsDir);

    expect(res.status).toBe("success");
    expect(res.unpacked_archives).toBeDefined();
    expect(res.unpacked_archives!.length).toBe(1);
    expect(res.unpacked_archives![0].archiveType).toBe("tar.gz");
    expect(res.unpacked_archives![0].extractedCount).toBe(2);

    const inputsDir = resolve(caseDir, "inputs");
    expect(existsSync(join(inputsDir, "processo_anexo_a_minuta_contrato.docx"))).toBe(true);
    expect(existsSync(join(inputsDir, "processo_anexo_b_detalhes.txt"))).toBe(true);
    expect(res.inspectedDocx.length).toBe(1);
    expect(res.inspectedDocx[0].fileName).toBe("processo_anexo_a_minuta_contrato.docx");
  });

  it("3. Deve descompactar arquivo .zip solto na raiz do caseDir e limpar o pacote da raiz", async () => {
    const caseDir = resolve(testBaseDir, "cases/caso_raiz_zip");
    mkdirSync(caseDir, { recursive: true });

    const docxBuf = getSampleDocxBuffer();
    const zip = new JSZip();
    zip.file("documento_oficial.docx", docxBuf);
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });

    const rootZipPath = resolve(caseDir, "pacote_raiz.zip");
    writeFileSync(rootZipPath, zipBuf);

    const res = await bootstrapCase(caseDir);

    expect(res.status).toBe("success");
    expect(existsSync(rootZipPath)).toBe(false); // O pacote original é removido da raiz
    expect(existsSync(resolve(caseDir, "inputs/documento_oficial.docx"))).toBe(true);
    expect(res.inspectedDocx.length).toBe(1);
    expect(res.inspectedDocx[0].fileName).toBe("documento_oficial.docx");
  });

  it("4. Deve descompactar arquivo .tar presente diretamente em inputs/", async () => {
    const caseDir = resolve(testBaseDir, "cases/caso_inputs_tar");
    const inputsDir = resolve(caseDir, "inputs");
    mkdirSync(inputsDir, { recursive: true });

    const docxBuf = getSampleDocxBuffer();
    const tarBuf = createTarBuffer([
      { name: "estudo_preliminar.docx", data: docxBuf },
    ]);
    const tarPath = resolve(inputsDir, "pacote_direto.tar");
    writeFileSync(tarPath, tarBuf);

    const res = await bootstrapCase(caseDir);

    expect(res.status).toBe("success");
    expect(existsSync(tarPath)).toBe(false); // Removido após descompactação
    expect(existsSync(resolve(inputsDir, "estudo_preliminar.docx"))).toBe(true);
    expect(res.inspectedDocx.length).toBe(1);
    expect(res.inspectedDocx[0].fileName).toBe("estudo_preliminar.docx");
  });

  it("5. Deve emitir erro fail-fast explicativo para formato proprietário .7z ou .rar", async () => {
    const caseDir = resolve(testBaseDir, "cases/caso_7z");
    const uploadsDir = resolve(testBaseDir, "uploads_7z");
    mkdirSync(uploadsDir, { recursive: true });

    // 7z magic bytes 37 7A BC AF 27 1C
    const sevenZipBuf = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x04]);
    writeFileSync(resolve(uploadsDir, "documentos.7z"), sevenZipBuf);

    expect(bootstrapCase(caseDir, uploadsDir)).rejects.toThrow(
      "Formato compactado proprietário (.7z/.rar) detectado"
    );
  });
});
