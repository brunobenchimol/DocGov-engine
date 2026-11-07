import { describe, it, expect } from "bun:test";
import {
  STATUTORY_BRIDGES,
  isStateItEntity,
  findStatutoryBridgesForText,
  expandQueryWithStatutoryBridge,
  getDistinguishingNote,
} from "../../src/tools/juris/statutory_bridge.ts";
import {
  scoreJurisItem,
  classifyDecisionOutcome,
  tokenizeQuery,
  isPureTaxOrCriminalNoise,
} from "../../src/tools/juris/relevance_scorer.ts";
import {
  createJurisSearchContractError,
  createJurisFetchContractError,
  EXACT_COPY_PASTE_JURIS_SEARCH_SNIPPET,
  EXACT_COPY_PASTE_JURIS_FETCH_SNIPPET,
} from "../../src/contracts/errors.ts";
import {
  compileDefenseCounterReasoningDocx,
  compileAttackChallengeDocx,
} from "../../src/tools/juris/index.ts";
import {
  parseCanonicalAcordaoRef,
  sanitizeQueryForCourt,
} from "../../src/tools/juris/providers/http_client.ts";
import JSZip from "jszip";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Jurisprudência v1.4.0 — Statutory Bridge (Lei 13.303/16 <-> Lei 14.133/21)", () => {
  it("deve contemplar os 10 eixos normativos estruturados (SB-01 a SB-10)", () => {
    expect(STATUTORY_BRIDGES.length).toBe(10);
    const ids = STATUTORY_BRIDGES.map((b) => b.id);
    expect(ids).toEqual([
      "SB-01", "SB-02", "SB-03", "SB-04", "SB-05",
      "SB-06", "SB-07", "SB-08", "SB-09", "SB-10",
    ]);

    for (const bridge of STATUTORY_BRIDGES) {
      expect(bridge.topic).toBeDefined();
      expect(bridge.art13303).toBeDefined();
      expect(bridge.art14133).toBeDefined();
      expect(bridge.distinguishingNote.length).toBeGreaterThan(20);
      expect(bridge.keywords.length).toBeGreaterThan(2);
    }
  });

  it("deve reconhecer empresas estatais de TI e entidades públicas estratégicas", () => {
    expect(isStateItEntity("SERPRO")).toBe(true);
    expect(isStateItEntity("Serviço Federal de Processamento de Dados - Serpro")).toBe(true);
    expect(isStateItEntity("Empresa de Tecnologia e Informações da Previdência - DATAPREV")).toBe(true);
    expect(isStateItEntity("BB Tecnologia e Serviços (BBTS)")).toBe(true);
    expect(isStateItEntity("Petróleo Brasileiro S.A. - Petrobras")).toBe(true);
    expect(isStateItEntity("Empresa de Tecnologia da Informação e Comunicação do Pará - PRODEPA")).toBe(true);
    expect(isStateItEntity("Companhia de Processamento de Dados do Estado de São Paulo - PRODESP")).toBe(true);
    expect(isStateItEntity("SECRETARIA_MUNICIPAL_GENERICA")).toBe(false);
  });

  it("deve detectar eixos temáticos e expandir queries adequadamente", () => {
    const bridges = findStatutoryBridgesForText("Contratação integrada de software em lote único indivisível");
    expect(bridges.some((b) => b.id === "SB-02")).toBe(true);

    const expansion = expandQueryWithStatutoryBridge("lote único e adjudicação global", "13303");
    expect(expansion.appliedBridgeIds).toContain("SB-02");
    expect(expansion.expandedTerms).toContain("Súmula TCU 247");
    expect(expansion.expandedTerms).toContain("13.303");
  });

  it("deve fornecer distinguishing específico pró-estatais para Art. 34 e Art. 71", () => {
    const note34 = getDistinguishingNote("SB-04");
    expect(note34).toContain("regra legal geral direta");
    expect(note34).toContain("Art. 34 da Lei 13.303/16");

    const note71 = getDistinguishingNote("SB-05");
    expect(note71).toContain("até 5 anos (60 meses)");
  });
});

describe("Jurisprudência v1.4.0 — Motor de Ranking Determinístico (0..100 pts)", () => {
  it("deve pontuar mais alto no modo DEFENSE quando a decisão favorece a modelagem", () => {
    const favorableItem = {
      id: "ACORDAO-TCU-100-2024",
      court: "TCU",
      colegiado: "Plenário",
      ano: 2024,
      entidade: "SERPRO",
      indexacao: "LICITAÇÃO. LOTE ÚNICO. ADJUDICAÇÃO POR PREÇO GLOBAL.",
      tese: "É lícita a adjudicação por preço global de solução integrada de TI.",
      dispositivo: "ACORDAM em julgar a representação improcedente, arquivando os autos.",
    };

    const defenseScore = scoreJurisItem(favorableItem, "lote único adjudicação global", {
      stance: "DEFENSE",
      regime: "13303",
    });

    const attackScore = scoreJurisItem(favorableItem, "lote único adjudicação global", {
      stance: "ATTACK",
      regime: "13303",
    });

    expect(defenseScore.relevance_score).toBeGreaterThan(attackScore.relevance_score);
    expect(defenseScore.relevance_score).toBe(defenseScore.score); // alias de compatibilidade
    expect(defenseScore.breakdown.stanceAlignment).toBe(25);
    expect(defenseScore.stance_alignment).toBe("FAVORABLE");
    expect(attackScore.breakdown.stanceAlignment).toBe(0);
    expect(attackScore.stance_alignment).toBe("ADVERSE_DISTINGUISHING_REQUIRED");
    expect(defenseScore.outcome).toBe("IMPROCEDENTE / MANUTENCAO_CERTAME");
  });

  it("deve pontuar mais alto no modo ATTACK quando a decisão anula ou suspende o certame", () => {
    const adverseItem = {
      id: "ACORDAO-TCU-200-2024",
      court: "TCU",
      colegiado: "Plenário",
      ano: 2024,
      indexacao: "LICITAÇÃO. CLÁUSULA RESTRITIVA. HABILITAÇÃO.",
      tese: "A exigência excessiva restringe a competitividade e fere a isonomia.",
      dispositivo: "ACORDAM em julgar a representação procedente para determinar a anulação do edital.",
    };

    const attackScore = scoreJurisItem(adverseItem, "cláusula restritiva habilitação", {
      stance: "ATTACK",
    });

    const defenseScore = scoreJurisItem(adverseItem, "cláusula restritiva habilitação", {
      stance: "DEFENSE",
    });

    expect(attackScore.relevance_score).toBeGreaterThan(defenseScore.relevance_score);
    expect(attackScore.breakdown.stanceAlignment).toBe(25);
    expect(attackScore.stance_alignment).toBe("FAVORABLE");
    expect(defenseScore.breakdown.stanceAlignment).toBe(0);
    expect(defenseScore.stance_alignment).toBe("ADVERSE_DISTINGUISHING_REQUIRED");
    expect(attackScore.outcome).toBe("PROCEDENTE / DETERMINACAO");
  });

  it("deve classificar os desfechos decisórios por regex determinístico", () => {
    expect(classifyDecisionOutcome("deferir a medida cautelar para suspender o certame")).toBe("CAUTELAR_DEFERIDA");
    expect(classifyDecisionOutcome("indeferir a medida cautelar requerida")).toBe("CAUTELAR_INDEFERIDA");
    expect(classifyDecisionOutcome("julgar improcedente a representação")).toBe("IMPROCEDENTE / MANUTENCAO_CERTAME");
    expect(classifyDecisionOutcome("julgar procedente a representação e determinar a anulação")).toBe("PROCEDENTE / DETERMINACAO");
    expect(classifyDecisionOutcome("dar ciência de impropriedade ao órgão")).toBe("CIENCIA / RECOMENDACAO");
  });

  it("deve tokenizar query sem ruído de stopwords", () => {
    const tokens = tokenizeQuery("Contratação de fábrica de software pelo TCU no Plenário");
    expect(tokens).toContain("contratação");
    expect(tokens).toContain("fábrica");
    expect(tokens).toContain("software");
    expect(tokens).not.toContain("de");
    expect(tokens).not.toContain("pelo");
    expect(tokens).not.toContain("tcu");
    expect(tokens).not.toContain("plenário");
  });

  it("relevance_scorer v1.4.2: deve aplicar penalidade tática (-15 pts) e marcar ADVERSE_DISTINGUISHING_REQUIRED em stance DEFENSE com desfecho desfavorável", () => {
    // Caso A: Acórdão desfavorável ao gestor (anulação determinada), embora mencione "regularidade" na ementa
    const adverseItem = {
      indexacao: "LICITAÇÃO. LOTE ÚNICO. PADRONIZAÇÃO DE MARCA.",
      tese: "É regular e lícito em tese o registro de preços, contudo restou viciada a indivisibilidade.",
      dispositivo: "ACORDAM os Ministros em julgar a representação PROCEDENTE e determinar a ANULAÇÃO do certame por restrição indevida.",
      ano: 2024,
    };

    const scoreDefense = scoreJurisItem(adverseItem, "lote único padronização de marca", { stance: "DEFENSE" });
    expect(scoreDefense.stance_alignment).toBe("ADVERSE_DISTINGUISHING_REQUIRED");
    expect(scoreDefense.breakdown.stanceAlignment).toBe(0);
    expect(scoreDefense.breakdown.tacticalPenalty).toBe(-15);
    expect(scoreDefense.outcome).toBe("PROCEDENTE / DETERMINACAO");

    // No stance ATTACK, o mesmo item deve ser FAVORABLE
    const scoreAttack = scoreJurisItem(adverseItem, "lote único padronização de marca", { stance: "ATTACK" });
    expect(scoreAttack.stance_alignment).toBe("FAVORABLE");
    expect(scoreAttack.breakdown.stanceAlignment).toBe(25);
    expect(scoreAttack.breakdown.tacticalPenalty).toBeUndefined();

    // Caso B: Acórdão favorável ao gestor (improcedente)
    const favorableItem = {
      indexacao: "LICITAÇÃO. PADRONIZAÇÃO DE MARCA DE TI.",
      tese: "Justificada a escolha técnica pelo gestor com base na economicidade.",
      dispositivo: "ACORDAM em julgar IMPROCEDENTE a representação, mantendo o certame em andamento.",
      ano: 2024,
    };

    const scoreFav = scoreJurisItem(favorableItem, "padronização de marca de TI", { stance: "DEFENSE" });
    expect(scoreFav.stance_alignment).toBe("FAVORABLE");
    expect(scoreFav.breakdown.stanceAlignment).toBe(25);
    expect(scoreFav.breakdown.tacticalPenalty).toBeUndefined();
    expect(scoreFav.outcome).toBe("IMPROCEDENTE / MANUTENCAO_CERTAME");
  });

  it("relevance_scorer v1.4.2: deve aplicar penalidade de ruído tributário puro (-25 pts)", () => {
    expect(
      isPureTaxOrCriminalNoise(
        "DIREITO TRIBUTÁRIO. ICMS E ISS. SOFTWARE PADRONIZADO.",
        "Incidência de ICMS sobre operações de software de prateleira e bitributação.",
        "Conhecer da ação direta para declarar inconstitucional a incidência de ICMS."
      )
    ).toBe(true);

    // Se houver menção a licitação ou contrato público, não é ruído puro
    expect(
      isPureTaxOrCriminalNoise(
        "LICITAÇÃO. TRIBUTÁRIO. RETENÇÃO DE ISSQN EM CONTRATO ADMINISTRATIVO.",
        "É lícita a exigência de regularidade fiscal quanto ao ISSQN no edital.",
        "Julgar improcedente."
      )
    ).toBe(false);

    const taxNoiseItem = {
      indexacao: "DIREITO TRIBUTÁRIO. ICMS E ISS. SOFTWARE DE PRATELEIRA.",
      tese: "Fato gerador tributário de ICMS vs ISS sobre cessão de licença de uso.",
      dispositivo: "Julgar procedente a ação direta de inconstitucionalidade.",
      ano: 2023,
    };

    const score = scoreJurisItem(taxNoiseItem, "software padronização de marca", { stance: "DEFENSE" });
    expect(score.breakdown.domainNoisePenalty).toBe(-25);
  });
});

describe("Jurisprudência v1.4.0 — Contratos e Padrão Exact Copy-Paste Error (Lei 3)", () => {
  it("createJurisSearchContractError deve gerar erro com mensagem imperativa e snippet canônico", () => {
    const err = createJurisSearchContractError("query ausente");
    expect(err.message).toContain("NÃO faça leituras exploratórias no repositório");
    expect(err.message).toContain("search_juris");
    expect(err.message).toContain(EXACT_COPY_PASTE_JURIS_SEARCH_SNIPPET);
  });

  it("createJurisFetchContractError deve gerar erro com mensagem imperativa e snippet canônico", () => {
    const err = createJurisFetchContractError("acordaoIdOrUrl ausente");
    expect(err.message).toContain("NÃO faça leituras exploratórias no repositório");
    expect(err.message).toContain("fetch_juris");
    expect(err.message).toContain(EXACT_COPY_PASTE_JURIS_FETCH_SNIPPET);
  });
});

describe("Jurisprudência v1.4.0 — http_client e Parser de Acórdão", () => {
  it("http_client: parseCanonicalAcordaoRef deve extrair corte, número, ano e colegiado", () => {
    const p1 = parseCanonicalAcordaoRef("Acórdão 2403/2020-TCU-Plenário");
    expect(p1.court).toBe("TCU");
    expect(p1.numero).toBe("2403");
    expect(p1.ano).toBe(2020);
    expect(p1.colegiado).toBe("Plenário");

    const p2 = parseCanonicalAcordaoRef("ACORDAO-TCU-2403-2020-PLENARIO");
    expect(p2.court).toBe("TCU");
    expect(p2.numero).toBe("2403");
    expect(p2.ano).toBe(2020);
    expect(p2.colegiado).toBe("Plenário");

    const p3 = parseCanonicalAcordaoRef("TCE-PA-62072-2024");
    expect(p3.court).toBe("TCE-PA");
    expect(p3.numero).toBe("62072");
    expect(p3.ano).toBe(2024);

    const p4 = parseCanonicalAcordaoRef("Decisão 123/2024 - TCDF");
    expect(p4.court).toBe("TCDF");
    expect(p4.numero).toBe("123");
    expect(p4.ano).toBe(2024);

    const s = sanitizeQueryForCourt("padronização de marca para solução de TI com edital!");
    expect(s.cleanQuery).toContain("padronização");
    expect(s.shortQuery).toContain("padronização");
    expect(s.terms).toContain("marca");
  });
});

describe("Jurisprudência v1.4.0 — Compilador Tático OpenXML (Assert 29.6)", () => {
  it("compileDefenseCounterReasoningDocx deve gerar Nota de Contrarrazões com A4 vertical e zero tabelas", async () => {
    const outDocx = join(tmpdir(), "test_contrarazoes_defense.docx");
    const res = await compileDefenseCounterReasoningDocx(
      {
        processo_id: "PROC-1234/2024",
        orgao_entidade: "SERPRO",
        objeto: "Solução Integrada de Nuvem Soberana",
        regime_juridico: "Lei 13.303/2016",
        parecer_juridico_ref: "Parecer Jurídico nº 45/2024",
        apontamentos_respondidos: [
          {
            id: "AP-01",
            item_edital: "Cláusula 4.1",
            apontamento_juridico: "Possível restrição na exigência de lote único.",
            fundamentacao_tecnica: "A solução requer gestão centralizada e SLA único de disponibilidade.",
            distinguishing_normativo: "Aplicação da Súmula TCU 247 e flexibilidade do Art. 32 da Lei 13.303/16.",
            precedentes_tcu: ["Acórdão 1234/2024-TCU-Plenário"],
          },
        ],
        acordaos_autenticados: [
          {
            id: "ACORDAO-TCU-1234-2024",
            tese: "Adjudicação por preço global de TI é legítima.",
            dispositivo: "Julgar improcedente a representação.",
          },
        ],
      },
      outDocx
    );

    expect(existsSync(res.outputPath)).toBe(true);

    const buffer = readFileSync(res.outputPath);
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("string");

    expect(docXml).toBeDefined();
    // Invariante Assert 29.6: Folha A4 vertical (11906 x 16838 dxa)
    expect(docXml).toContain('w:w="11906"');
    expect(docXml).toContain('w:h="16838"');
    // Invariante Assert 29.6: Zero tabelas <w:tbl> (layout editorial corrido com blocos verticais)
    expect(docXml).not.toContain("<w:tbl>");
    expect(docXml).not.toContain("<w:tbl ");

    if (existsSync(outDocx)) unlinkSync(outDocx);
  });

  it("compileAttackChallengeDocx deve gerar Peça de Impugnação com A4 vertical e zero tabelas", async () => {
    const outDocx = join(tmpdir(), "test_impugnacao_attack.docx");
    const res = await compileAttackChallengeDocx(
      {
        certame_id: "PREGAO-001/2024",
        orgao_promotor: "ORGAO_CONTRATANTE",
        clausulas_impugnadas: [
          {
            zona_id: "Z4",
            item_edital: "8.2.1",
            redacao_clausula: "Exigência de atestado com marca proprietária específica.",
            ilegalidade_apontada: "Violação do princípio da isonomia e vedação a marcas.",
            dispositivo_violado: "Art. 41 da Lei 14.133/2021",
            precedentes_condenatorios: ["Acórdão 200/2024-TCU-Plenário"],
          },
        ],
        pedidos_cautelares: ["Suspensão cautelar do certame."],
      },
      outDocx
    );

    expect(existsSync(res.outputPath)).toBe(true);

    const buffer = readFileSync(res.outputPath);
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("string");

    expect(docXml).toBeDefined();
    // Invariante Assert 29.6: Folha A4 vertical e zero tabelas
    expect(docXml).toContain('w:w="11906"');
    expect(docXml).toContain('w:h="16838"');
    expect(docXml).not.toContain("<w:tbl>");
    expect(docXml).not.toContain("<w:tbl ");
    expect(docXml).toContain("PEÇA DE IMPUGNAÇÃO");
    expect(docXml).toContain("Z4");

    if (existsSync(outDocx)) unlinkSync(outDocx);
  });
});
