import { describe, it, expect, afterEach } from "bun:test";
import { defaultJurisdictionRegistry } from "../../src/tools/juris/provider_registry.ts";
import { TstProvider } from "../../src/tools/juris/providers/tst_provider.ts";
import { searchAguCatalog } from "../../src/tools/juris/providers/agu_catalog.ts";
import { parseCanonicalAcordaoRef } from "../../src/tools/juris/providers/http_client.ts";
import { assertAuthenticAcordao, sliceAcordaoAnatomically } from "../../src/tools/juris/anatomical_slicer.ts";
import { scoreJurisItem } from "../../src/tools/juris/relevance_scorer.ts";

describe("Jurisprudência — Cortes Federais Especializadas (TST e AGU)", () => {
  const originalAguEnv = process.env.DOCGOV_JURIS_AGU_URL;

  afterEach(() => {
    if (originalAguEnv === undefined) {
      delete process.env.DOCGOV_JURIS_AGU_URL;
    } else {
      process.env.DOCGOV_JURIS_AGU_URL = originalAguEnv;
    }
  });
  it("TstProvider v1.4.2: deve integrar conector TST, auto-trigger trabalhista e fatiamento anatômico", async () => {
    const tst = defaultJurisdictionRegistry.get("TST");
    expect(tst).toBeDefined();
    expect(tst?.courtId).toBe("TST");
    expect(tst?.tier).toBe("FEDERAL");
    expect(tst?.defaultFederal).toBe(false);

    // 1. Auto-trigger em query trabalhista/terceirização
    const routeLabor = defaultJurisdictionRegistry.resolveRouting(
      undefined,
      undefined,
      "fiscalização de terceirização e responsabilidade subsidiária da súmula 331"
    );
    expect(routeLabor.routingInfo.executed_courts).toContain("TST");
    expect(routeLabor.routingInfo.executed_courts).toContain("TCU");
    expect(routeLabor.routingInfo.executed_courts).toContain("STJ");
    expect(routeLabor.routingInfo.executed_courts).toContain("STF");

    // 2. Não-acionamento em query puramente de hardware/software
    const routeTech = defaultJurisdictionRegistry.resolveRouting(
      undefined,
      undefined,
      "aquisição de switches ethernet e servidores em lote único"
    );
    expect(routeTech.routingInfo.executed_courts).not.toContain("TST");
    expect(routeTech.routingInfo.executed_courts).toContain("TCU");

    // 3. Acionamento quando courts incluir TST explicitamente
    const routeExplicit = defaultJurisdictionRegistry.resolveRouting(["TST"]);
    expect(routeExplicit.routingInfo.executed_courts).toEqual(["TST"]);

    // 4. Reconhecimento de padrão de ID do TST
    const detected = defaultJurisdictionRegistry.detectCourtFromRef("TST-RR-21474-45.2015.5.04.0202");
    expect(detected).toBe("TST");

    const detectedRef = defaultJurisdictionRegistry.detectCourtFromRef("AIRR - 100123-45.2020.5.02.0001");
    expect(detectedRef).toBe("TST");

    // 5. Roteamento de CNJ trabalhista puro (J=5) pontuado e 20 dígitos
    expect(defaultJurisdictionRegistry.detectCourtFromRef("TST-Ag-Ag-RR-959-81.2015.5.05.0033")).toBe("TST");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("959-81.2015.5.05.0033")).toBe("TST");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("00009598120155050033")).toBe("TST");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("1000201-25.2017.5.02.0025")).toBe("TST");

    expect(parseCanonicalAcordaoRef("959-81.2015.5.05.0033").court).toBe("TST");
    expect(parseCanonicalAcordaoRef("00009598120155050033").court).toBe("TST");

    // 6. Resiliência de mapTstHitToResult com elementos nulos em arrays
    const rawHitWithNulls = {
      id: "abc123",
      numFormatado: "RR - 0000697-62.2024.5.10.0006",
      temaProcs: [null, { desTemaProc: "Ente Público" }],
      indicadores: [null, { desIndicador: "Lei 13.467/2017" }],
    };
    const mapped = (tst as any).mapTstHitToResult(rawHitWithNulls);
    expect(mapped.indexacao).toContain("Ente Público");
    expect(mapped.indexacao).toContain("Lei 13.467/2017");
  });

  it("Jurisprudência v1.4.3 — AguProvider: deve integrar conector AGU, catálogo curado, auto-trigger e trava anti-alucinação", async () => {
    const agu = defaultJurisdictionRegistry.get("AGU")!;
    expect(agu).toBeDefined();
    expect(agu.courtId).toBe("AGU");
    expect(agu.tier).toBe("FEDERAL");
    expect(agu.defaultFederal).toBe(false);

    // 1. Auto-trigger contextual por palavras-chave de normas e pareceres
    const routeNormativa = defaultJurisdictionRegistry.resolveRouting(
      undefined,
      undefined,
      "impugnação baseada em orientação normativa da AGU sobre prorrogação"
    );
    expect(routeNormativa.routingInfo.executed_courts).toContain("AGU");

    const routeParecer = defaultJurisdictionRegistry.resolveRouting(
      undefined,
      undefined,
      "parecer referencial da cnlca dispensa de licitação"
    );
    expect(routeParecer.routingInfo.executed_courts).toContain("AGU");

    const routeSumula = defaultJurisdictionRegistry.resolveRouting(
      undefined,
      undefined,
      "aplicação da súmula da AGU aos contratos federais"
    );
    expect(routeSumula.routingInfo.executed_courts).toContain("AGU");

    // 2. Roteamento explícito
    const routeExplicit = defaultJurisdictionRegistry.resolveRouting(["AGU"]);
    expect(routeExplicit.routingInfo.executed_courts).toEqual(["AGU"]);

    // 3. Reconhecimento de padrões de ID (idPatterns)
    expect(defaultJurisdictionRegistry.detectCourtFromRef("ON-AGU-050-2014")).toBe("AGU");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("AGU-ON-0046-2014")).toBe("AGU");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("SUMULA-AGU-072")).toBe("AGU");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("AGU-SUMULA-34")).toBe("AGU");
    expect(defaultJurisdictionRegistry.detectCourtFromRef("PARECER-CNLCA-001-2024")).toBe("AGU");

    // 4. Busca no catálogo curado oficial (100% offline/hermético)
    const searchResults = searchAguCatalog("prorrogação serviços contínuos vigência");
    expect(searchResults.length).toBeGreaterThan(0);
    const item50 = searchResults.find((r) => r.id.includes("050") || r.id.includes("50"));
    expect(item50).toBeDefined();
    expect(item50?.enunciado).toContain("serviço contínuo");

    // 5. Fetch determinístico no catálogo curado (suportando lookup canônico e aliases)
    const fetched50 = await agu.fetch("ON-AGU-050-2014");
    expect(fetched50).not.toBeNull();
    expect(fetched50?.exists).toBe(true);
    expect(fetched50?.rawTextOrJson.numero).toBe("50");

    const fetched46 = await agu.fetch("AGU-ON-0046-2014");
    expect(fetched46).not.toBeNull();
    expect(fetched46?.exists).toBe(true);
    expect(fetched46?.rawTextOrJson.numero).toBe("46");

    // 6. Trava anti-alucinação estrita
    const invalidId = await agu.fetch("AGU-ON-999999");
    expect(invalidId).toBeNull();
    expect(() => assertAuthenticAcordao(false, "AGU-ON-999999", "AGU")).toThrow(
      /\[ANTI_HALLUCINATION_BLOCK\]/
    );

    // 7. Fatiamento anatômico nas 6 Macro-Partes / 10 Sub-Camadas
    const sliced50 = sliceAcordaoAnatomically(fetched50!.rawTextOrJson, { court: "AGU" });
    expect(sliced50.layers.layer_1A_metadata.tribunal).toBe("AGU");
    expect(sliced50.layers.layer_1A_metadata.colegiado).toBe("Advogado-Geral da União");
    expect(sliced50.layers.layer_1B_entity_regime.entidade).toBe("ADMINISTRAÇÃO_PÚBLICA_FEDERAL");
    expect(sliced50.layers.layer_5A_operative_commands.length).toBeGreaterThan(0);
    expect(sliced50.layers.layer_6A_closing_quorum.quorum).toContain("Vinculante");

    // 8. Relevance Scorer determinístico e precedência da Camada 5A
    const scored50 = scoreJurisItem(
      {
        court: "AGU",
        colegiado: "Advogado-Geral da União",
        ano: 2024,
        indexacao: ["SERVIÇOS CONTÍNUOS", "PRORROGAÇÃO"],
        tese: fetched50!.rawTextOrJson.enunciado,
        dispositivo: fetched50!.rawTextOrJson.dispositivo,
      },
      "prorrogação serviços contínuos vigência",
      { stance: "DEFENSE" }
    );
    expect(scored50.breakdown.quorum).toBe(10);
    expect(scored50.outcome).toBe("IMPROCEDENTE / MANUTENCAO_CERTAME");
    expect(scored50.stance_alignment).toBe("FAVORABLE");

    // 9. Desfecho adverso / distinguishing em stance DEFENSE
    const fetched84 = await agu.fetch("ON-AGU-084-2024");
    expect(fetched84).not.toBeNull();
    const scored84 = scoreJurisItem(
      {
        court: "AGU",
        colegiado: "Advogado-Geral da União",
        ano: 2024,
        indexacao: ["PAGAMENTO ANTECIPADO", "VEDAÇÃO"],
        tese: fetched84!.rawTextOrJson.enunciado,
        dispositivo: fetched84!.rawTextOrJson.dispositivo,
      },
      "pagamento antecipado edital",
      { stance: "DEFENSE" }
    );
    expect(scored84.outcome).toBe("PROCEDENTE / DETERMINACAO");
    expect(scored84.stance_alignment).toBe("ADVERSE_DISTINGUISHING_REQUIRED");
  });

  it("AguProvider (Mock Server DOCGOV_JURIS_AGU_URL): deve suportar /search, /fetch e anti-alucinação offline", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/search") {
          return Response.json({
            items: [
              {
                id: "ON-AGU-050-2014",
                numero: "50",
                ano: 2014,
                colegiado: "Advogado-Geral da União",
                tese: "Serviço contínuo não pode ser prorrogado após encerramento da vigência.",
                dispositivo: "Vedada a prorrogação retroativa de serviço contínuo.",
              },
            ],
          });
        }
        if (url.pathname.startsWith("/fetch")) {
          if (url.pathname.includes("999999")) {
            return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
          }
          return Response.json({
            id: "ON-AGU-050-2014",
            numero: "50",
            ano: 2014,
            tese: "Serviço contínuo",
            dispositivo: "Vedada prorrogação retroativa.",
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    try {
      process.env.DOCGOV_JURIS_AGU_URL = `http://127.0.0.1:${server.port}`;
      const agu = defaultJurisdictionRegistry.get("AGU")!;
      const hits = await agu.search("prorrogação serviços contínuos vigência");
      expect(hits.length).toBe(1);
      expect(hits[0].court).toBe("AGU");
      expect(hits[0].tese).toContain("Serviço contínuo");

      const okFetch = await agu.fetch("ON-AGU-050-2014");
      expect(okFetch?.exists).toBe(true);
      expect(okFetch?.rawTextOrJson.numero).toBe("50");

      const fakeFetch = await agu.fetch("AGU-ON-999999");
      expect(fakeFetch).toBeNull();
    } finally {
      server.stop(true);
    }
  });
});
