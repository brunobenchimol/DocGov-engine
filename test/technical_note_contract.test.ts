import { describe, it, expect } from "bun:test";
import {
  EXACT_COPY_PASTE_TECHNICAL_NOTE_SNIPPET,
  createTechnicalNoteContractError,
  validateTechnicalNoteData,
} from "../src/contracts/errors.ts";

describe("Contrato Canônico de Evolução de Cláusulas e Fail-Fast (Marco 6.1 — v1.3.0)", () => {
  it("deve validar com sucesso payload canônico válido de Nota Técnica", () => {
    const raw = JSON.parse(EXACT_COPY_PASTE_TECHNICAL_NOTE_SNIPPET);
    const validated = validateTechnicalNoteData(raw);

    expect(validated.document_type).toBe("TECHNICAL_NOTE");
    expect(validated.processo_id).toBe("08000.001234/2026-00");
    expect(validated.orgao_entidade).toBe("ORGAO_CONTRATANTE");
    expect(validated.artefato_auditado).toBe("Termo de Referência (TR)");
    expect(validated.quadro_evolucao.length).toBe(1);
    expect(validated.quadro_evolucao[0].id).toBe("EVO-01");
    expect(validated.quadro_evolucao[0].tipo_alteracao).toBe("MODIFICACAO");
  });

  it("deve aplicar fail-fast estrito se processo_id estiver ausente", () => {
    const invalid = {
      orgao_entidade: "ORGAO_CONTRATANTE",
      artefato_auditado: "TR",
      resumo_executivo: "Resumo",
      quadro_evolucao: [
        {
          id: "EVO-01",
          secao_titulo: "Cláusula 1",
          justificativa_tecnica: "Motivação",
          fundamentacao_juridica: "Art. 18",
        },
      ],
    };

    expect(() => validateTechnicalNoteData(invalid)).toThrow(
      "NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:"
    );
  });

  it("deve aplicar fail-fast estrito se quadro_evolucao for vazio", () => {
    const invalid = {
      processo_id: "08000.001234/2026-00",
      orgao_entidade: "ORGAO_CONTRATANTE",
      artefato_auditado: "TR",
      resumo_executivo: "Resumo",
      quadro_evolucao: [],
    };

    expect(() => validateTechnicalNoteData(invalid)).toThrow("quadro_evolucao");
  });

  it("deve exigir justificativa_tecnica e fundamentacao_juridica em cada cláusula alterada", () => {
    const semJustificativa = {
      processo_id: "08000.001234/2026-00",
      orgao_entidade: "ORGAO_CONTRATANTE",
      artefato_auditado: "TR",
      resumo_executivo: "Resumo",
      quadro_evolucao: [
        {
          id: "EVO-01",
          secao_titulo: "Cláusula 1",
          fundamentacao_juridica: "Art. 18",
        },
      ],
    };

    expect(() => validateTechnicalNoteData(semJustificativa)).toThrow("justificativa_tecnica");

    const semFundamentacao = {
      processo_id: "08000.001234/2026-00",
      orgao_entidade: "ORGAO_CONTRATANTE",
      artefato_auditado: "TR",
      resumo_executivo: "Resumo",
      quadro_evolucao: [
        {
          id: "EVO-01",
          secao_titulo: "Cláusula 1",
          justificativa_tecnica: "Motivação técnica",
        },
      ],
    };

    expect(() => validateTechnicalNoteData(semFundamentacao)).toThrow("fundamentacao_juridica");
  });
});
