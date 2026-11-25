import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchJuris, formatSearchJurisSyntheticResult } from "../../src/tools/juris/search_juris.ts";
import { JurisdictionProviderRegistry } from "../../src/tools/juris/provider_registry.ts";
import { TstProvider } from "../../src/tools/juris/providers/tst_provider.ts";
import { isStateItEntity, expandQueryWithStatutoryBridge } from "../../src/tools/juris/statutory_bridge.ts";
import { classifyDecisionOutcome, scoreJurisItem } from "../../src/tools/juris/relevance_scorer.ts";
import { sliceAcordaoAnatomically } from "../../src/tools/juris/anatomical_slicer.ts";
import { filterTstHitsByPertinence } from "../../src/tools/juris/tst_precedent_triage.ts";
import type { JurisdictionProvider } from "../../src/tools/juris/types.ts";

describe("JURIS v1.7.3 — Acumulação com Lock, Desduplicação & Neutralidade", () => {
  const createdDirs: string[] = [];
  const originalTstBase = process.env.DOCGOV_TST_BASE_URL;

  afterEach(() => {
    if (originalTstBase === undefined) delete process.env.DOCGOV_TST_BASE_URL;
    else process.env.DOCGOV_TST_BASE_URL = originalTstBase;
    for (const d of createdDirs.splice(0)) {
      rmSync(d, { recursive: true, force: true });
    }
  });

  function makeTempCaseDir(): string {
    const root = mkdtempSync(join(tmpdir(), "docgov-juris-acc-"));
    createdDirs.push(root);
    const caseDir = join(root, "cases", "caso_neutro_teste");
    mkdirSync(join(caseDir, "state"), { recursive: true });
    return caseDir;
  }

  it("1. deve acumular buscas sequenciais e paralelas sem sobrescrever, desduplicando com matched_queries e sem truncar a 10", async () => {
    const caseDir = makeTempCaseDir();

    const mockTcu: JurisdictionProvider = {
      courtId: "TCU",
      tier: "FEDERAL",
      defaultFederal: true,
      async search() {
        return [];
      },
      async searchWithDiagnostic(query: string) {
        if (query === "q_batch_1") {
          const hits = Array.from({ length: 8 }, (_, idx) => ({
            id: `ACORDAO-TCU-${100 + idx}-2024`,
            court: "TCU",
            colegiado: "Plenário",
            ano: 2024,
            tese: `q_batch_1 precedente numero ${idx}`,
            dispositivo: "Julgar improcedente a representação.",
          }));
          return {
            hits,
            diagnostic: { court: "TCU", status: "ok", hits: hits.length, latency_ms: 4, error: null, source_mode: "LIVE" },
          };
        }
        const hits = Array.from({ length: 6 }, (_, idx) => ({
          id: `ACORDAO-TCU-${106 + idx}-2024`, // 106 e 107 colidem com batch_1; 108..111 são novos (total único = 12)
          court: "TCU",
          colegiado: "Plenário",
          ano: 2024,
          tese: `${query} precedente numero ${idx}`,
          dispositivo: "Julgar improcedente a representação.",
        }));
        return {
          hits,
          diagnostic: { court: "TCU", status: "ok", hits: hits.length, latency_ms: 4, error: null, source_mode: "LIVE" },
        };
      },
      async fetch() {
        return null;
      },
    };

    const reg = new JurisdictionProviderRegistry();
    reg.register(mockTcu);

    const r1 = await searchJuris({ caseDir, query: "q_batch_1", courts: ["TCU"], limit: 10 }, reg);
    expect(r1.fileResult.total_hits).toBe(8);
    expect(r1.fileResult.total_accumulated).toBe(8);

    const [r2, r3] = await Promise.all([
      searchJuris({ caseDir, query: "q_batch_2", courts: ["TCU"], limit: 10 }, reg),
      searchJuris({ caseDir, query: "q_batch_3", courts: ["TCU"], limit: 10 }, reg),
    ]);

    const diskJson = JSON.parse(readFileSync(r2.jsonPath, "utf-8"));
    expect(diskJson.results.length).toBe(12); // Não trunca a 10
    expect(diskJson.total_accumulated).toBe(12);
    expect(diskJson.queries_executed).toEqual(["q_batch_1", "q_batch_2", "q_batch_3"]);
    expect(diskJson.queries_history.length).toBe(3);

    // Colisão ACORDAO-TCU-106-2024 acumulou matched_queries das 3 buscas
    const collided = diskJson.results.find((x: any) => x.id === "ACORDAO-TCU-106-2024");
    expect(collided).toBeDefined();
    expect(collided.matched_queries).toContain("q_batch_1");
    expect(collided.matched_queries).toContain("q_batch_2");
    expect(collided.matched_queries).toContain("q_batch_3");

    // Envelope sintético < 900B reflete rodada atual + total_accumulated
    const synth3 = formatSearchJurisSyntheticResult(r3.fileResult, r3.mdPath, caseDir, r3.currentHits);
    expect(synth3.total_hits).toBe(6);
    expect(synth3.total_accumulated).toBe(12);
    expect(synth3.top_hits.every((h) => Number(h.id.split("-")[2]) >= 106)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(synth3), "utf-8")).toBeLessThan(900);
  });

  it("2. deve eliminar falsos positivos de isStateItEntity ('ATI'/'CAIXA'), aplicar defaults neutros e rebalancear 0..100", () => {
    // Substrings falsas NÃO casam
    expect(isStateItEntity("Atividade externa e controle normativo relativo")).toBe(false);
    expect(isStateItEntity("Justificativa administrativa de caixa postal")).toBe(false);
    expect(isStateItEntity("CAIXA ECONÔMICA FEDERAL")).toBe(true);
    expect(isStateItEntity("SERPRO")).toBe(true);

    // Query livre sem contexto licitatório não aciona Statutory Bridge
    const bridge = expandQueryWithStatutoryBridge("teletrabalho retorno presencial", "AUTO");
    expect(bridge.appliedBridgeIds).toEqual([]);
    expect(bridge.expandedTerms).toEqual([]);

    // Scorer em modo NEUTRAL/AUTO pontua 85..100 para match exato em consulta livre
    const freeScore = scoreJurisItem(
      {
        id: "TST-RR-100-2024",
        court: "TST",
        colegiado: "3ª Turma",
        ano: 2024,
        entidade: "NAO_INFORMADA",
        indexacao: "TELETRABALHO. RETORNO AO TRABALHO PRESENCIAL.",
        tese: "Teletrabalho retorno presencial determinado pelo empregador dentro do poder diretivo.",
        dispositivo: "Nega provimento ao recurso de revista do reclamante.",
      },
      "teletrabalho retorno presencial"
    );

    expect(freeScore.stance_alignment).toBe("NEUTRAL");
    expect(freeScore.breakdown.tacticalPenalty).toBeUndefined();
    expect(freeScore.relevance_score).toBeGreaterThanOrEqual(85);
    expect(freeScore.relevance_score).toBeLessThanOrEqual(100);
    expect(freeScore.outcome).toBe("NAO_PROVIDO");
    expect(freeScore.outcome).not.toContain("MANUTENCAO_CERTAME");

    expect(classifyDecisionOutcome("Dar provimento parcial ao agravo.", "", "TST")).toBe("PARCIALMENTE_PROVIDO");
    expect(classifyDecisionOutcome("Dar provimento ao recurso.", "", "STJ")).toBe("PROVIDO");
  });

  it("3. anatomical_slicer deve classificar NAO_APLICAVEL / NAO_IDENTIFICADO e ignorar substring 'atividade' no texto", () => {
    const slicedTst = sliceAcordaoAnatomically(
      {
        court: "TST",
        colegiado: "4ª Turma",
        numero: "500",
        ano: 2024,
        ementa: "Teletrabalho. Atividade relativa ao regime remoto. Normativo interno.",
        voto: "Fundamentação sobre poder diretivo e reversão ao trabalho presencial.",
        acordao: "ACORDAM os Ministros em negar provimento ao recurso.",
      },
      { court: "TST" }
    );
    expect(slicedTst.layers.layer_1B_entity_regime.entidade).toBe("NAO_INFORMADA");
    expect(slicedTst.layers.layer_1B_entity_regime.isStateItEntity).toBe(false);
    expect(slicedTst.layers.layer_1B_entity_regime.regimeLegal).toBe("NAO_APLICAVEL");
    expect(slicedTst.layers.outcome_summary).toBe("NAO_PROVIDO");
    expect(slicedTst.dossieMarkdown).not.toContain("ÓRGÃO_CONTRATANTE");
    expect(slicedTst.dossieMarkdown).not.toContain("Estatal de TI");

    const slicedTcuNoLaw = sliceAcordaoAnatomically(
      {
        court: "TCU",
        colegiado: "Plenário",
        numero: "900",
        ano: 2024,
        enunciado: "Representação sobre atividade administrativa.",
        acordao: "ACORDAM em julgar improcedente a representação.",
      },
      { court: "TCU" }
    );
    expect(slicedTcuNoLaw.layers.layer_1B_entity_regime.regimeLegal).toBe("NAO_IDENTIFICADO");
  });

  it("4. TstProvider deve enviar query limpa ('teletrabalho retorno presencial') sem injeção e triagem deve reter hit aderente", async () => {
    let capturedBody: any = null;
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname.startsWith("/rest/pesquisa-textual")) {
          capturedBody = await req.json();
          return Response.json({
            registros: [
              {
                registro: {
                  id: "abcdef0123456789abcdef0123456789",
                  numFormatado: "AIRR - 0011435-87.2024.5.18.0006",
                  orgaoJudicante: { descricao: "3ª Turma" },
                  dtaJulgamento: "2024-09-10",
                  txtEmentaHighlight: "TELETRABALHO. REVERSÃO AO REGIME PRESENCIAL. PODER DIRETIVO.",
                  assuntos: [{ descricao: "Teletrabalho" }],
                },
              },
            ],
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    try {
      process.env.DOCGOV_TST_BASE_URL = `http://127.0.0.1:${server.port}`;
      const tst = new TstProvider();
      const reg = new JurisdictionProviderRegistry();
      reg.register(tst);

      const caseDir = makeTempCaseDir();
      const res = await searchJuris(
        { caseDir, query: "teletrabalho retorno presencial", courts: ["TST"] },
        reg
      );

      expect(capturedBody?.e).toBe("teletrabalho retorno presencial");
      expect(capturedBody?.e).not.toContain("administração pública");
      expect(capturedBody?.e).not.toContain("terceirização");
      expect(res.fileResult.stance).toBe("NEUTRAL");
      expect(res.fileResult.regime).toBe("AUTO");
      expect(res.fileResult.statutory_bridge_applied).toEqual([]);
      expect(res.fileResult.results.length).toBe(1);
      expect(res.fileResult.results[0].entidade).toBe("NAO_INFORMADA");
      expect(res.fileResult.tst_triage?.counts.inter_partes).toBe(1);
      expect(res.fileResult.tst_triage?.buckets.inter_partes[0]?.id).toContain("0011435-87.2024.5.18.0006");

      // Validação direta da calibração em filterTstHitsByPertinence
      const filt = filterTstHitsByPertinence(
        [
          {
            id: "TST-AIRR-1",
            court: "TST",
            tese: "Regime de trabalho remoto.",
            rawPayload: { assuntos: [{ descricao: "Teletrabalho" }] },
          },
          {
            id: "TST-AIRR-NOISE",
            court: "TST",
            tese: "Adicional de insalubridade em câmara fria.",
          },
        ],
        "teletrabalho retorno presencial"
      );
      expect(filt.kept.map((h) => h.id)).toEqual(["TST-AIRR-1"]);
      expect(filt.filteredOut.map((h) => h.id)).toEqual(["TST-AIRR-NOISE"]);
    } finally {
      server.stop(true);
    }
  });
});
