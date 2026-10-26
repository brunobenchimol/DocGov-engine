import { describe, test, expect } from "bun:test";
import { gzipSync } from "node:zlib";
import JSZip from "jszip";
import {
  detectFileType,
  detectFileTypeSync,
  extractArchiveBuffer,
  extractTarBuffer,
  extractTarGzBuffer,
  extractZipBuffer,
  sanitizeArchiveEntryName,
  isSystemJunkFile,
} from "../src/utils/archives.ts";

function createMockTar(entries: Array<{ name: string; content: string }>): Buffer {
  const chunks: Buffer[] = [];

  for (const entry of entries) {
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 100, "utf-8");
    header.write("0000644\0", 100, 8); // Mode
    header.write("0000000\0", 108, 8); // UID
    header.write("0000000\0", 116, 8); // GID

    const data = Buffer.from(entry.content, "utf-8");
    const sizeOctal = data.length.toString(8).padStart(11, "0") + " ";
    header.write(sizeOctal, 124, 12);
    header.write("0\0", 156, 2); // Regular file
    header.write("ustar\0", 257, 6); // POSIX magic

    // Calcula checksum
    let chksum = 0;
    for (let i = 0; i < 512; i++) {
      if (i >= 148 && i < 156) {
        chksum += 32;
      } else {
        chksum += header[i];
      }
    }
    header.write(chksum.toString(8).padStart(6, "0") + "\0 ", 148, 8);

    chunks.push(header);
    chunks.push(data);

    const pad = (512 - (data.length % 512)) % 512;
    if (pad > 0) {
      chunks.push(Buffer.alloc(pad));
    }
  }

  // Dois blocos zerados indicando EOF
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

describe("Testes Unitários v1.3.3: Classificador Estrutural libmagic e Extrator de Arquivos", () => {
  test("1. Deve classificar DOCX como Microsoft Word 2007+ e NÃO como arquivo zip genérico", async () => {
    const docxZip = new JSZip();
    docxZip.file("word/document.xml", "<w:document><w:body/></w:document>");
    docxZip.file("[Content_Types].xml", "<Types/>");
    const docxBuf = await docxZip.generateAsync({ type: "nodebuffer" });

    const syncRes = detectFileTypeSync(docxBuf, "Minuta_Edital.docx");
    expect(syncRes.type).toBe("docx");
    expect(syncRes.isOfficeDocument).toBe(true);
    expect(syncRes.isArchive).toBe(false);
    expect(syncRes.description).toContain("Microsoft Word 2007+");

    const asyncRes = await detectFileType(docxBuf, "Minuta_Edital.docx");
    expect(asyncRes.type).toBe("docx");
    expect(asyncRes.isOfficeDocument).toBe(true);
    expect(asyncRes.isArchive).toBe(false);
  });

  test("2. Deve classificar XLSX como Microsoft Excel 2007+ e NÃO como arquivo zip genérico", async () => {
    const xlsxZip = new JSZip();
    xlsxZip.file("xl/workbook.xml", "<workbook/>");
    xlsxZip.file("[Content_Types].xml", "<Types/>");
    const xlsxBuf = await xlsxZip.generateAsync({ type: "nodebuffer" });

    const res = await detectFileType(xlsxBuf, "Planilha.xlsx");
    expect(res.type).toBe("xlsx");
    expect(res.isOfficeDocument).toBe(true);
    expect(res.isArchive).toBe(false);
    expect(res.description).toContain("Microsoft Excel 2007+");
  });

  test("3. Deve classificar PDF genuíno com magic bytes %PDF-", async () => {
    const pdfBuf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
    const res = await detectFileType(pdfBuf, "edital.pdf");
    expect(res.type).toBe("pdf");
    expect(res.isOfficeDocument).toBe(true);
    expect(res.isArchive).toBe(false);
  });

  test("4. Deve classificar pacote ZIP de usuário com múltiplos arquivos como 'zip' (Zip archive data)", async () => {
    const packageZip = new JSZip();
    packageZip.file("Edital_Concorrencia.pdf", "%PDF-1.5 fake");
    packageZip.file("Minuta_Contrato.docx", "fake docx");
    packageZip.file("anexos/Planilha.xlsx", "fake xlsx");
    const zipBuf = await packageZip.generateAsync({ type: "nodebuffer" });

    const syncRes = detectFileTypeSync(zipBuf, "processo_completo.zip");
    expect(syncRes.type).toBe("zip");
    expect(syncRes.isArchive).toBe(true);
    expect(syncRes.isOfficeDocument).toBe(false);
    expect(syncRes.description).toBe("Zip archive data");

    const asyncRes = await detectFileType(zipBuf, "processo_completo.zip");
    expect(asyncRes.type).toBe("zip");
    expect(asyncRes.isArchive).toBe(true);
    expect(asyncRes.isOfficeDocument).toBe(false);
  });

  test("5. Deve classificar POSIX tar archive (.tar)", async () => {
    const tarBuf = createMockTar([
      { name: "termo_referencia.docx", content: "conteudo tr" },
      { name: "anexos/cronograma.pdf", content: "conteudo pdf" },
    ]);

    const res = await detectFileType(tarBuf, "pacote.tar");
    expect(res.type).toBe("tar");
    expect(res.isArchive).toBe(true);
    expect(res.isOfficeDocument).toBe(false);
    expect(res.description).toContain("POSIX tar archive");
  });

  test("6. Deve classificar POSIX tar archive (gzip compressed) (.tar.gz / .tgz)", async () => {
    const tarBuf = createMockTar([
      { name: "edital.pdf", content: "pdf data" },
    ]);
    const tgzBuf = gzipSync(tarBuf);

    const res = await detectFileType(tgzBuf, "processo.tar.gz");
    expect(res.type).toBe("tar.gz");
    expect(res.isArchive).toBe(true);
    expect(res.isOfficeDocument).toBe(false);
    expect(res.description).toContain("POSIX tar archive (gzip compressed)");
  });

  test("7. Deve detectar formatos proprietários (.7z, .rar) como unsupported_archive", async () => {
    const fake7z = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x01]);
    const res7z = await detectFileType(fake7z, "arquivos.7z");
    expect(res7z.type).toBe("unsupported_archive");
    expect(res7z.description).toContain("7-Zip");

    const fakeRar = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]);
    const resRar = await detectFileType(fakeRar, "arquivos.rar");
    expect(resRar.type).toBe("unsupported_archive");
    expect(resRar.description).toContain("RAR");
  });

  test("8. extractZipBuffer deve extrair arquivos, achatar subpastas e ignorar lixo de sistema", async () => {
    const zip = new JSZip();
    zip.file("Termo_Referencia.docx", "TR Word Content");
    zip.file("anexos/edital/Cronograma.pdf", "Cronograma PDF Content");
    zip.file("__MACOSX/._Termo_Referencia.docx", "Junk Mac");
    zip.file("anexos/.DS_Store", "Junk DS_Store");
    zip.file("~$Lock_File.docx", "Junk Office Lock");
    zip.file("Thumbs.db", "Junk Windows Thumbs");

    const buf = await zip.generateAsync({ type: "nodebuffer" });
    const extracted = await extractZipBuffer(buf);

    // Deve extrair apenas os 2 arquivos reais
    expect(extracted.length).toBe(2);

    const tr = extracted.find((f) => f.originalPath === "Termo_Referencia.docx")!;
    expect(tr).toBeDefined();
    expect(tr.fileName).toBe("Termo_Referencia.docx");
    expect(tr.data.toString("utf-8")).toBe("TR Word Content");

    // Subpasta achatada
    const cron = extracted.find((f) => f.originalPath === "anexos/edital/Cronograma.pdf")!;
    expect(cron).toBeDefined();
    expect(cron.fileName).toBe("anexos_edital_Cronograma.pdf");
    expect(cron.data.toString("utf-8")).toBe("Cronograma PDF Content");
  });

  test("9. Anti-Zip Slip: sanitizeArchiveEntryName deve barrar travessia de diretório (../)", () => {
    expect(sanitizeArchiveEntryName("../../etc/passwd")).toBe("etc_passwd");
    expect(sanitizeArchiveEntryName("..\\..\\windows\\system32\\calc.exe")).toBe("windows_system32_calc.exe");
    expect(sanitizeArchiveEntryName("/pasta/subpasta/arquivo.pdf")).toBe("pasta_subpasta_arquivo.pdf");
  });

  test("10. isSystemJunkFile deve identificar metadados espúrios", () => {
    expect(isSystemJunkFile("__MACOSX/foo.txt")).toBe(true);
    expect(isSystemJunkFile("pasta/.DS_Store")).toBe(true);
    expect(isSystemJunkFile("Thumbs.db")).toBe(true);
    expect(isSystemJunkFile("desktop.ini")).toBe(true);
    expect(isSystemJunkFile("~$Minuta.docx")).toBe(true);
    expect(isSystemJunkFile("Minuta.docx")).toBe(false);
    expect(isSystemJunkFile("edital.pdf")).toBe(false);
  });

  test("11. extractTarBuffer e extractTarGzBuffer devem extrair entradas com fidelidade", () => {
    const tarBuf = createMockTar([
      { name: "documento_a.docx", content: "conteudo A" },
      { name: "sub/documento_b.pdf", content: "conteudo B" },
      { name: ".DS_Store", content: "junk" },
    ]);

    const tarExtracted = extractTarBuffer(tarBuf);
    expect(tarExtracted.length).toBe(2);
    expect(tarExtracted[0].fileName).toBe("documento_a.docx");
    expect(tarExtracted[0].data.toString("utf-8")).toBe("conteudo A");
    expect(tarExtracted[1].fileName).toBe("sub_documento_b.pdf");
    expect(tarExtracted[1].data.toString("utf-8")).toBe("conteudo B");

    const tgzBuf = gzipSync(tarBuf);
    const tgzExtracted = extractTarGzBuffer(tgzBuf);
    expect(tgzExtracted.length).toBe(2);
    expect(tgzExtracted[0].fileName).toBe("documento_a.docx");
    expect(tgzExtracted[1].fileName).toBe("sub_documento_b.pdf");
  });

  test("12. extractArchiveBuffer deve extrair de forma unificada para zip, tar e tar.gz", async () => {
    const zip = new JSZip();
    zip.file("arquivo.txt", "texto");
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });

    const resZip = await extractArchiveBuffer(zipBuf, "pacote.zip");
    expect(resZip.length).toBe(1);
    expect(resZip[0].fileName).toBe("arquivo.txt");

    const tarBuf = createMockTar([{ name: "arquivo.txt", content: "texto" }]);
    const resTar = await extractArchiveBuffer(tarBuf, "pacote.tar");
    expect(resTar.length).toBe(1);
    expect(resTar[0].fileName).toBe("arquivo.txt");

    const tgzBuf = gzipSync(tarBuf);
    const resTgz = await extractArchiveBuffer(tgzBuf, "pacote.tar.gz");
    expect(resTgz.length).toBe(1);
    expect(resTgz[0].fileName).toBe("arquivo.txt");
  });
});
