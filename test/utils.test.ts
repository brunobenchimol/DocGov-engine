import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  safeReadJsonFile,
  sanitizeJsonString,
  formatJsonErrorWithSnippet,
  unflattenDotKeys,
  isOpaqueFileName,
  detectFileExtensionFromBuffer,
  extractHash4,
  resolveTargetFileName,
  compareSemver,
  replaceBinaryOnDisk,
} from "../src/index.ts";
import {
  MINIMAL_DOCX_BASE64,
  createSampleRawDocx,
  createSuiteTempDir,
} from "./helpers/fixtures.ts";

describe("Testes Unitários: Utilitários (JSON, Naming, Magic Bytes, Updater)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("utils");

  afterAll(() => {
    cleanup();
  });

  test("deve comparar versões SemVer corretamente (compareSemver)", () => {
    expect(compareSemver("0.1.0", "0.2.0")).toBe(-1);
    expect(compareSemver("v0.2.0", "0.2.0")).toBe(0);
    expect(compareSemver("0.10.0", "0.2.0")).toBe(1);
    expect(compareSemver("1.0.0", "0.9.9")).toBe(1);
  });

  test("deve substituir binário em disco com segurança (replaceBinaryOnDisk)", () => {
    const fakeBinPath = resolve(tempDir, "fake-docgov-docx.exe");
    writeFileSync(fakeBinPath, "VERSAO_ANTIGA_CONTEUDO_INICIAL");

    const newPayload = new Uint8Array(2048).fill(65); // 2048 bytes de 'A'
    replaceBinaryOnDisk(fakeBinPath, newPayload, 1024);

    expect(existsSync(fakeBinPath)).toBe(true);
    expect(existsSync(`${fakeBinPath}.new`)).toBe(false);
    expect(readFileSync(fakeBinPath).byteLength).toBe(2048);

    // Deve rejeitar payload menor que o mínimo exigido
    expect(() =>
      replaceBinaryOnDisk(fakeBinPath, new Uint8Array(10), 1024)
    ).toThrow("Binário baixado inválido ou corrompido");
  });

  test("deve auto-sanear arquivos JSON (BOM, trailing commas, quebras de linha literais em strings) regravando em disco sem interromper a execução (safeReadJsonFile v0.5.0)", () => {
    // 1. Arquivo com BOM UTF-8
    const bomFilePath = resolve(tempDir, "teste_bom.json");
    writeFileSync(bomFilePath, "\uFEFF{\n  \"parametro\": \"valor_com_bom\"\n}", "utf-8");
    const resBom = safeReadJsonFile<{ parametro: string }>(bomFilePath);
    expect(resBom.parametro).toBe("valor_com_bom");

    // 2. Arquivo com trailing commas (em objeto e array)
    const trailingCommaPath = resolve(tempDir, "teste_trailing_comma.json");
    const rawTrailing = `{\n  "objeto": {\n    "descricao": "Item Com Trailing Comma",\n  },\n  "itens": [\n    1,\n    2,\n  ],\n}`;
    writeFileSync(trailingCommaPath, rawTrailing, "utf-8");
    const resTrailing = safeReadJsonFile<{ objeto: { descricao: string }; itens: number[] }>(trailingCommaPath);
    expect(resTrailing.objeto.descricao).toBe("Item Com Trailing Comma");
    expect(resTrailing.itens).toEqual([1, 2]);

    // O arquivo em disco deve ter sido regravado limpo (sem a vírgula antes de })
    const diskContent = readFileSync(trailingCommaPath, "utf-8");
    expect(diskContent).not.toMatch(/,\s*}/);
    expect(diskContent).not.toMatch(/,\s*]/);

    // 3. Arquivo com quebra de linha literal não escapada dentro de string JSON
    const unescapedNewlinePath = resolve(tempDir, "teste_unescaped_newline.json");
    const rawNewline = "{\n  \"justificativa\": \"Linha 1 da justificativa\nLinha 2 da justificativa com quebra crua\"\n}";
    writeFileSync(unescapedNewlinePath, rawNewline, "utf-8");
    const resNewline = safeReadJsonFile<{ justificativa: string }>(unescapedNewlinePath);
    expect(resNewline.justificativa).toBe("Linha 1 da justificativa\nLinha 2 da justificativa com quebra crua");
  });

  test("deve emitir diagnóstico cirúrgico com linha, coluna e snippet de 5 linhas numeradas com marcador <-- ERRO AQUI em falhas irrecuperáveis de JSON (v0.5.0)", () => {
    const corruptPath = resolve(tempDir, "teste_corrupt.json");
    const corruptContent = `{\n  "linha1": "ok",\n  "linha2": "ok",\n  "linha3": "ok",\n  "chave_com_erro": [\n    sem_aspas: 123\n  ],\n  "linha7": "ok",\n  "linha8": "ok"\n}`;
    writeFileSync(corruptPath, corruptContent, "utf-8");

    try {
      safeReadJsonFile(corruptPath);
      throw new Error("Deveria ter falhado com erro sintático");
    } catch (err: any) {
      const msg = err.message;
      expect(msg).toContain("ERRO DE SINTAXE JSON em");
      expect(msg).toContain("na Linha");
      expect(msg).toContain("Trecho com erro:");
      expect(msg).toContain("<-- ERRO AQUI");
      expect(msg).toContain("Corrija diretamente esta linha usando replace_file_content.");
    }
  });

  test("deve desaninhar (unflatten) automaticamente chaves na raiz com notação de ponto no estado_caso.json e injetar com sucesso nos templates (v0.5.0)", async () => {
    // 1. Teste unitário de unflattenDotKeys
    const flatObj = {
      processo_id: "POC-2026-DOT-01",
      "objeto.descricao": "Fornecimento de infraestrutura",
      "metadados.unidade.sigla": "DEMANDANTE",
      "metadados.unidade.codigo": 123,
    };
    const nested = unflattenDotKeys(flatObj);
    expect(nested.processo_id).toBe("POC-2026-DOT-01");
    expect(nested.objeto?.descricao).toBe("Fornecimento de infraestrutura");
    expect(nested.metadados?.unidade?.sigla).toBe("DEMANDANTE");
    expect(nested.metadados?.unidade?.codigo).toBe(123);
    // Preserva também a chave flat original
    expect(nested["objeto.descricao"]).toBe("Fornecimento de infraestrutura");
  });

  test("deve classificar nomes opacos vs legíveis corretamente (isOpaqueFileName v0.5.1)", () => {
    expect(isOpaqueFileName("media_1792069974647_14a93b9d")).toBe(true);
    expect(isOpaqueFileName("media_1791815270384_d0baeff4.docx")).toBe(true);
    expect(isOpaqueFileName("tmp_12345.pdf")).toBe(true);
    expect(isOpaqueFileName("upload_9999.docx")).toBe(true);
    expect(isOpaqueFileName("file_001.bin")).toBe(true);
    expect(isOpaqueFileName("550e8400-e29b-41d4-a716-446655440000.docx")).toBe(true);
    expect(isOpaqueFileName("14a93b9d0123456789abcdef.docx")).toBe(true);

    expect(isOpaqueFileName("ETP_Modelo.docx")).toBe(false);
    expect(isOpaqueFileName("modelo_etp_base.docx")).toBe(false);
    expect(isOpaqueFileName("dfd_assinado.pdf")).toBe(false);
    expect(isOpaqueFileName("Termo_de_Referencia_Padrao.docx")).toBe(false);
    expect(isOpaqueFileName("Edital_01_2026.pdf")).toBe(false);
  });

  test("deve inferir extensão via magic bytes em arquivos sem extensão (detectFileExtensionFromBuffer v0.5.1)", () => {
    // 50 4B 03 04 -> .docx
    const docxMagicBuf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    expect(detectFileExtensionFromBuffer(docxMagicBuf)).toBe(".docx");

    // 25 50 44 46 -> .pdf
    const pdfMagicBuf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    expect(detectFileExtensionFromBuffer(pdfMagicBuf)).toBe(".pdf");

    // Outros buffers ou curto
    expect(detectFileExtensionFromBuffer(Buffer.from([0x00, 0x01]))).toBeNull();
    expect(detectFileExtensionFromBuffer(Buffer.from("PLAIN TEXT"))).toBeNull();
  });

  test("deve extrair hash curto de 4 caracteres de nomes opacos (extractHash4 v0.5.1)", () => {
    expect(extractHash4("media_1792069974647_14a93b9d")).toBe("3b9d");
    expect(extractHash4("media_1791815270384_d0baeff4.docx")).toBe("eff4");
    expect(extractHash4("tmp_abc1234")).toBe("1234");
  });

  test("deve resolver nomes de arquivos respeitando as 3 regras: fileRenameMap, preservação de nomes legíveis e auto-batismo semântico (resolveTargetFileName v0.5.1)", async () => {
    const rawDocxBuf = Buffer.from(MINIMAL_DOCX_BASE64, "base64");

    // Regra 1: Prioridade fileRenameMap
    const res1 = await resolveTargetFileName(
      "media_1792069974647_14a93b9d",
      rawDocxBuf,
      { "media_1792069974647_14a93b9d": "ETP_Minuta.docx" }
    );
    expect(res1.targetFileName).toBe("ETP_Minuta.docx");
    expect(res1.detectedType).toBe("ETP");
    expect(res1.isOpaque).toBe(false);

    // Regra 2: Preservação de nome legível humano (com extensão)
    const res2 = await resolveTargetFileName("ETP_Modelo.docx", rawDocxBuf);
    expect(res2.targetFileName).toBe("ETP_Modelo.docx");
    expect(res2.detectedType).toBe("ETP");
    expect(res2.isOpaque).toBe(false);

    // Regra 2b: Preservação de nome legível sem extensão inferida por magic bytes
    const res2b = await resolveTargetFileName("Termo_Referencia_Juridico", rawDocxBuf);
    expect(res2b.targetFileName).toBe("Termo_Referencia_Juridico.docx");
    expect(res2b.detectedType).toBe("TR");
    expect(res2b.isOpaque).toBe(false);

    // Regra 3: Auto-batismo de arquivo opaco media_*
    const sampleDocxPath = resolve(tempDir, "auto_name_sample.docx");
    await createSampleRawDocx(sampleDocxPath);
    const sampleDocxBuf = readFileSync(sampleDocxPath);
    const res3 = await resolveTargetFileName(
      "media_1792069974647_14a93b9d",
      sampleDocxBuf
    );
    // Deve conter tipo ETP, órgão ORGAO_A e hash 3b9d
    expect(res3.targetFileName).toBe("ETP_ORGAO_A_3b9d.docx");
    expect(res3.detectedType).toBe("ETP");
    expect(res3.isOpaque).toBe(true);
  });
});
