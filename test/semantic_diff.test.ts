import { describe, it, expect } from "bun:test";
import {
  tokenizeDiffText,
  computeTokenLcsDiff,
  coalesceDiffChunks,
  generateGranularInlineDiff,
  generateInlineDiff,
  computeStructuralDiff,
} from "../src/core/structural_diff.ts";
import type { DocxInspectionResult } from "../src/types/index.ts";

describe("Motor de Diff Semântico Granular em Nível de Token (Marco 6.1 — v1.3.0)", () => {
  describe("1. Tokenização Unicode PT-BR e Símbolos Normativos", () => {
    it("deve preservar integralmente palavras acentuadas da língua portuguesa sem fragmentação", () => {
      const text = "A contratação observará as regras de habilitação técnica e qualificação econômico-financeira.";
      const tokens = tokenizeDiffText(text);

      expect(tokens).toContain("contratação");
      expect(tokens).toContain("observará");
      expect(tokens).toContain("habilitação");
      expect(tokens).toContain("técnica");
      expect(tokens).toContain("qualificação");
      expect(tokens).toContain("econômico");
      expect(tokens).toContain("financeira");

      // Garante que não fragmentou em caracteres soltos como 'ç' ou 'ão'
      expect(tokens).not.toContain("contrata");
      expect(tokens).not.toContain("ç");
      expect(tokens).not.toContain("ão");
    });

    it("deve preservar símbolos jurídicos (º, ª, §), incisos e números de lei", () => {
      const text = "Nos termos do Art. 18, § 1º, inc. IV e Art. 25, caput, da Lei nº 14.133/2021.";
      const tokens = tokenizeDiffText(text);

      expect(tokens).toContain("Art");
      expect(tokens).toContain("§");
      expect(tokens).toContain("1º");
      expect(tokens).toContain("inc");
      expect(tokens).toContain("IV");
      expect(tokens).toContain("nº");
      expect(tokens).toContain("14.133");
      expect(tokens).toContain("2021");
    });

    it("deve preservar notações monetárias brasileiras (R$)", () => {
      const text = "O valor total estimado é de R$ 1.500.250,80 para o exercício de 2026.";
      const tokens = tokenizeDiffText(text);

      const hasCurrency = tokens.some((t) => t.includes("R$") && t.includes("1.500.250,80"));
      expect(hasCurrency).toBe(true);
    });
  });

  describe("2. Alinhamento LCS em Nível de Token", () => {
    it("deve identificar substituição pontual mantendo o restante inalterado", () => {
      const oldText = "O prazo de entrega dos bens será de 10 dias corridos contados da emissão.";
      const newText = "O prazo de entrega dos bens será de 30 dias úteis contados da emissão.";

      const tokensOld = tokenizeDiffText(oldText);
      const tokensNew = tokenizeDiffText(newText);
      const chunks = computeTokenLcsDiff(tokensOld, tokensNew);

      // Deve ter chunks UNCHANGED, REMOVED e ADDED
      const removedText = chunks
        .filter((c) => c.type === "REMOVED")
        .map((c) => c.text)
        .join(" ");
      const addedText = chunks
        .filter((c) => c.type === "ADDED")
        .map((c) => c.text)
        .join(" ");

      expect(removedText).toContain("10");
      expect(removedText).toContain("corridos");

      expect(addedText).toContain("30");
      expect(addedText).toContain("úteis");
    });

    it("deve identificar inserção no meio do texto", () => {
      const oldText = "Contratação de serviços de tecnologia.";
      const newText = "Contratação de serviços especializados de tecnologia.";

      const chunks = computeTokenLcsDiff(tokenizeDiffText(oldText), tokenizeDiffText(newText));
      const added = chunks.find((c) => c.type === "ADDED");

      expect(added).toBeDefined();
      expect(added!.text.trim()).toBe("especializados");
    });

    it("deve identificar supressão de termos", () => {
      const oldText = "Exigência de atestado com firma reconhecida e taxa administrativa.";
      const newText = "Exigência de atestado com taxa administrativa.";

      const chunks = computeTokenLcsDiff(tokenizeDiffText(oldText), tokenizeDiffText(newText));
      const removed = chunks.find((c) => c.type === "REMOVED");

      expect(removed).toBeDefined();
      expect(removed!.text).toContain("firma");
      expect(removed!.text).toContain("reconhecida");
    });
  });

  describe("3. Guardrail de Complexidade para Blocos Extensos (m * n > 2.000.000)", () => {
    it("deve processar textos massivos através do particionamento por sentenças sem estouro de pilha", () => {
      // Cria texto artificial com 1500 tokens em cada versão (1500 * 1500 = 2.250.000 > 2.000.000)
      const baseSentence = "Este é um parágrafo padronizado de teste com termos jurídicos para conferência normativa da Lei nº 14.133. ";
      const oldMassive = baseSentence.repeat(110) + "Cláusula antiga a ser substituída no final.";
      const newMassive = baseSentence.repeat(110) + "Cláusula nova devidamente saneada no final.";

      const tokensOld = tokenizeDiffText(oldMassive);
      const tokensNew = tokenizeDiffText(newMassive);

      expect(tokensOld.length * tokensNew.length).toBeGreaterThan(2_000_000);

      const startTime = performance.now();
      const chunks = computeTokenLcsDiff(tokensOld, tokensNew);
      const duration = performance.now() - startTime;

      expect(chunks.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Executa em menos de 1 segundo graças ao guardrail!

      const lastAdded = chunks.filter((c) => c.type === "ADDED");
      expect(lastAdded.some((c) => c.text.includes("saneada"))).toBe(true);
    });
  });

  describe("4. Formatação Granular de Markdown e Coalescência de Chunks", () => {
    it("deve gerar inline diff com transição [~~antigo~~ -> **novo**]", () => {
      const oldText = "O prazo será de 10 dias úteis.";
      const newText = "O prazo será de 15 dias úteis.";

      const res = generateGranularInlineDiff(oldText, newText);
      expect(res.inline_diff).toContain("10");
      expect(res.inline_diff).toContain("15");
      expect(res.inline_diff).toContain("~~");
      expect(res.inline_diff).toContain("**");
      expect(res.chunks.length).toBeGreaterThan(0);

      // Compatibilidade da função clássica
      const legacy = generateInlineDiff(oldText, newText);
      expect(legacy).toBe(res.inline_diff);
    });

    it("deve coalescer chunks adjacentes do mesmo tipo", () => {
      const raw = [
        { type: "UNCHANGED" as const, text: "O " },
        { type: "UNCHANGED" as const, text: "prazo" },
        { type: "ADDED" as const, text: " de " },
        { type: "ADDED" as const, text: "entrega" },
      ];
      const coalesced = coalesceDiffChunks(raw);
      expect(coalesced.length).toBe(2);
      expect(coalesced[0].text).toBe("O prazo");
      expect(coalesced[1].text).toBe(" de entrega");
    });
  });

  describe("5. Integração com computeStructuralDiff", () => {
    it("deve anexar diff_chunks estruturados a cada item do diff", () => {
      const oldDoc: DocxInspectionResult = {
        doc_type: "docx",
        headers: [],
        footers: [],
        paragraphs: [
          { index: 0, style: null, text: "1. OBJETO DA CONTRATAÇÃO" },
          { index: 1, style: null, text: "Prazo de entrega em 5 dias corridos." },
        ],
        tables: [],
      };

      const newDoc: DocxInspectionResult = {
        doc_type: "docx",
        headers: [],
        footers: [],
        paragraphs: [
          { index: 0, style: null, text: "1. OBJETO DA CONTRATAÇÃO" },
          { index: 1, style: null, text: "Prazo de entrega em 20 dias úteis." },
        ],
        tables: [],
      };

      const diff = computeStructuralDiff(oldDoc, newDoc, "v1.docx", "v2.docx");
      expect(diff.changes.length).toBe(2);

      const modified = diff.changes.find((c) => c.change_type === "MODIFIED");
      expect(modified).toBeDefined();
      expect(modified!.diff_chunks).toBeDefined();
      expect(modified!.diff_chunks!.length).toBeGreaterThan(0);

      const unchanged = diff.changes.find((c) => c.change_type === "UNCHANGED");
      expect(unchanged).toBeDefined();
      expect(unchanged!.diff_chunks).toBeDefined();
    });
  });
});
