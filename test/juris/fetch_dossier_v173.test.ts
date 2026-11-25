import { describe, it, expect, afterEach } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  fetchJuris,
  formatFetchJurisSyntheticResult,
} from "../../src/tools/juris/fetch_juris.ts";
import {
  sliceAcordaoAnatomically,
  truncateCleanBoundary,
} from "../../src/tools/juris/anatomical_slicer.ts";
import { defaultJurisdictionRegistry } from "../../src/tools/juris/provider_registry.ts";
import type { JurisdictionProvider } from "../../src/tools/juris/types.ts";

describe("JURIS v1.7.3 — Dossiê em state/, Ordenação 1->6, Corte Limpo e Links Diretos", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function makeCaseRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "docgov-fetch-v173-"));
    dirs.push(root);
    const caseDir = join(root, "cases", "caso_dossie_v173");
    mkdirSync(join(caseDir, "state"), { recursive: true });
    return caseDir;
  }

  it("1. fetchJuris grava inteiro teor em state/juris_<shortname>/inteiro_teor_anatomico.md e NUNCA cria inputs/", async () => {
    const caseDir = makeCaseRoot();
    const originalTcu = defaultJurisdictionRegistry.get("TCU");

    const longSentence =
      "A fundamentação jurídica detalhada demonstra que o poder diretivo admite ajustes motivados. ";
    const longVoto = Array.from({ length: 65 }, (_, i) => `Parágrafo ${i + 1}: ${longSentence}`).join(
      "\n\n"
    );

    const mockTcu: JurisdictionProvider = {
      courtId: "TCU",
      async search() {
        return [];
      },
      async fetch(id: string) {
        return {
          id,
          court: "TCU",
          exists: true,
          source: "LIVE",
          rawTextOrJson: {
            tribunal: "TCU",
            colegiado: "Plenário",
            numeroAcordao: "777",
            anoAcordao: 2025,
            processo: "007.777/2025-0",
            relator: "Ministro Teste",
            enunciado: "Enunciado de teste para corte limpo.",
            relatorio: "EXAME TÉCNICO\nAnálise técnica completa da unidade especializada.\nCONCLUSÃO",
            voto: longVoto,
            acordao: "ACORDAM em julgar improcedente a representação.",
          },
        };
      },
    };

    defaultJurisdictionRegistry.register(mockTcu);
    try {
      const res = await fetchJuris({
        caseDir,
        acordaoIdOrUrl: "Acórdão 777/2025-TCU-Plenário",
        shortname: "acordao_777",
      });

      expect(res.dossiePath.replace(/\\/g, "/")).toContain("/state/dossie_juris_acordao_777.md");
      expect(res.fullPath.replace(/\\/g, "/")).toContain(
        "/state/juris_acordao_777/inteiro_teor_anatomico.md"
      );
      expect(existsSync(res.dossiePath)).toBe(true);
      expect(existsSync(res.fullPath)).toBe(true);
      expect(existsSync(join(caseDir, "inputs"))).toBe(false);

      const dossie = readFileSync(res.dossiePath, "utf-8");
      const i1 = dossie.indexOf("## 1.");
      const i2 = dossie.indexOf("## 2.");
      const i3 = dossie.indexOf("## 3.");
      const i4 = dossie.indexOf("## 4.");
      const i5 = dossie.indexOf("## 5.");
      const i6 = dossie.indexOf("## 6.");
      expect(i1).toBeGreaterThan(-1);
      expect(i1).toBeLessThan(i2);
      expect(i2).toBeLessThan(i3);
      expect(i3).toBeLessThan(i4);
      expect(i4).toBeLessThan(i5);
      expect(i5).toBeLessThan(i6);

      // Aviso explícito de truncamento com contagem + links diretos
      expect(dossie).toContain("Trecho truncado em fronteira limpa: exibindo");
      expect(dossie).toContain("de " + longVoto.trim().length + " caracteres");
      expect(dossie).toContain("juris_acordao_777/inteiro_teor_anatomico.md");

      const synth = formatFetchJurisSyntheticResult(res, caseDir);
      expect(synth.inteiro_teor_full_md).toBe(
        "state/juris_acordao_777/inteiro_teor_anatomico.md"
      );
      expect(Buffer.byteLength(JSON.stringify(synth), "utf-8")).toBeLessThan(900);
    } finally {
      if (originalTcu) defaultJurisdictionRegistry.register(originalTcu);
    }
  });

  it("2. ordenação 1->2->(3 & 4)->5->6 mantida com topicFilter e truncateCleanBoundary nunca parte palavras", () => {
    const sample =
      "Primeira sentença completa do julgado administrativo.\n\n" +
      "Segunda sentença com palavras longas como constitucionalidade e proporcionalidade.\n\n" +
      "Terceira sentença final que ultrapassa o limite.";
    const cut = truncateCleanBoundary(sample, 105);
    expect(cut.truncated).toBe(true);
    expect(cut.text.endsWith("completo") || cut.text.endsWith(".") || !cut.text.endsWith("constituciona")).toBe(true);
    expect(cut.text).toBe("Primeira sentença completa do julgado administrativo.");

    const slicedWithFilter = sliceAcordaoAnatomically(
      {
        court: "TST",
        colegiado: "3ª Turma",
        numero: "123",
        ano: 2025,
        ementa: "Teletrabalho.",
        voto: "I - TELETRABALHO\nFundamentação sobre teletrabalho.\nII - OUTRO TEMA\nTexto diverso.",
        acordao: "ACORDAM em negar provimento.",
      },
      {
        court: "TST",
        topicFilter: "teletrabalho",
        fullRelLink: "juris_tst_123/inteiro_teor_anatomico.md",
      }
    );

    const md = slicedWithFilter.dossieMarkdown;
    const i1 = md.indexOf("## 1.");
    const i2 = md.indexOf("## 2.");
    const i34 = md.indexOf("## 3 & 4.");
    const i5 = md.indexOf("## 5.");
    const i6 = md.indexOf("## 6.");
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i34);
    expect(i34).toBeLessThan(i5);
    expect(i5).toBeLessThan(i6);
    expect(md).toContain("[Inteiro Teor Anatômico](juris_tst_123/inteiro_teor_anatomico.md)");
  });
});
