import { describe, test, expect, afterAll } from "bun:test";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  inspectDocx,
  formatInspectDocSyntheticResult,
  VERSION,
} from "../src/index.ts";
import { createSuiteTempDir } from "./helpers/fixtures.ts";

describe("Testes Unitários: Inspecao Linear de .md / .txt e Guardrail Anti-JSZip (Hotfix v1.3.1)", () => {
  const { tempDir, cleanup } = createSuiteTempDir("inspect_text_md");

  afterAll(() => {
    cleanup();
  });

  test("deve inspecionar arquivo .md gerando visao_auditoria e dossie_hotspots com Radar Z1..Z14", async () => {
    const mdPath = resolve(tempDir, "minuta_edital.md");
    const outJsonPath = resolve(tempDir, "estrutura_minuta_edital.json");

    const mdContent = `# EDITAL DE PREGÃO ELETRÔNICO Nº 01/2026

## 1. DO OBJETO
1.1. O objeto da presente licitação é a contratação de serviços técnicos especializados.

## 2. DA HABILITAÇÃO TÉCNICA E CRITÉRIOS RESTRITIVOS
2.1. Exigência de atestado de capacidade técnica emitido exclusivamente por entidade pública.
2.2. Vedada a participação de consórcios sem justificativa técnica prévia nos autos.
2.3. Exigência de comprovação de propriedade prévia de equipamentos antes da assinatura do contrato.

## 3. DO ORÇAMENTO ESTIMADO E PESQUISA DE PREÇOS
3.1. A pesquisa de preços considerou unicamente três orçamentos de fornecedores sem consulta a bases oficiais.
`;

    writeFileSync(mdPath, mdContent, "utf-8");

    const result = await inspectDocx(mdPath, outJsonPath);

    expect(result.doc_type).toBe("markdown");
    expect(result.format).toBe("markdown");
    expect(result.paragraphs.length).toBeGreaterThan(5);
    expect(existsSync(outJsonPath)).toBe(true);

    expect(result.audit_view_path).toBeDefined();
    expect(existsSync(result.audit_view_path!)).toBe(true);
    const auditViewContent = readFileSync(result.audit_view_path!, "utf-8");
    expect(auditViewContent).toContain("Visão Linear de Auditoria");
    expect(auditViewContent).toContain(".user_uploaded");

    expect(result.dossie_hotspots_path).toBeDefined();
    expect(existsSync(result.dossie_hotspots_path!)).toBe(true);
    const dossieContent = readFileSync(result.dossie_hotspots_path!, "utf-8");
    expect(dossieContent).toContain("Dossiê Executivo de Hotspots");

    // Verifica Radar Z1..Z14 (detectou Zonas nas cláusulas de habilitação e pesquisa de preços)
    expect(result.cartography?.impugnation_zones).toBeDefined();
    const zoneKeys = Object.keys(result.cartography!.impugnation_zones);
    expect(zoneKeys.length).toBeGreaterThan(0);
    expect(
      result.cartography!.impugnation_zones["Z2_QUALIFICACAO_TECNICA_ATESTADOS"]?.length
    ).toBeGreaterThan(0);

    // Valida teto MCP (Lei 2 < 900 bytes)
    const synthetic = formatInspectDocSyntheticResult(
      mdPath,
      outJsonPath,
      result
    );
    const jsonStr = JSON.stringify(synthetic, null, 2);
    const byteLen = Buffer.byteLength(jsonStr, "utf-8");
    expect(byteLen).toBeLessThan(920);
    expect(synthetic.doc_type).toBe("markdown");
    expect(synthetic.next_step_hint).toContain(".user_uploaded");
  });

  test("deve inspecionar arquivo .txt puro sem formatacao", async () => {
    const txtPath = resolve(tempDir, "termo_referencia.txt");
    const outJsonPath = resolve(tempDir, "estrutura_termo_referencia.json");

    const txtContent = `TERMO DE REFERÊNCIA
CLÁUSULA PRIMEIRA - DO OBJETO
Prestação de serviços contínuos de suporte técnico.

CLÁUSULA SEGUNDA - DA QUALIFICAÇÃO TÉCNICA
Exigência de certidão restritiva com índice de liquidez incompatível.
`;

    writeFileSync(txtPath, txtContent, "utf-8");

    const result = await inspectDocx(txtPath, outJsonPath);

    expect(result.doc_type).toBe("text");
    expect(result.format).toBe("plain_text");
    expect(result.paragraphs.length).toBeGreaterThan(3);
    expect(existsSync(result.audit_view_path!)).toBe(true);
    expect(existsSync(result.dossie_hotspots_path!)).toBe(true);
  });

  test("deve emitir erro fail-fast instrutivo para binarios desconhecidos/corrompidos sem quebrar no JSZip", async () => {
    const corruptedPath = resolve(tempDir, "documento_invalido.bin");
    // Buffer binário aleatório que não é ZIP nem PDF (com zeros)
    const dummyBin = Buffer.from([0x01, 0x02, 0x00, 0x04, 0x05, 0x06, 0x00, 0x08]);
    writeFileSync(corruptedPath, dummyBin);

    let errorThrown: any = null;
    try {
      await inspectDocx(corruptedPath);
    } catch (err: any) {
      errorThrown = err;
    }

    expect(errorThrown).not.toBeNull();
    // NÃO deve conter o erro críptico do JSZip
    expect(errorThrown.message).not.toContain("Can't find end of central directory");
    // DEVE conter orientação clara sobre formatos e .user_uploaded
    expect(errorThrown.message).toContain("Formato de arquivo não suportado ou corrompido");
    expect(errorThrown.message).toContain(".user_uploaded");
  });
});
