import { describe, it, expect } from "bun:test";
import {
  classifyTstHit,
  extractReliableYear,
  filterTstHitsByPertinence,
  triageTstPrecedents,
  mergeTstTriageResults,
  compactTstTriageToBudget,
  type TstTriageResult,
} from "../../src/tools/juris/tst_precedent_triage.ts";
import type {
  RawJurisSearchResult,
  SearchJurisSyntheticResult,
} from "../../src/tools/juris/types.ts";

function makeSyntheticBase(
  tstTriage: TstTriageResult,
  opts?: { relMd?: string; liveDegraded?: string[] }
): SearchJurisSyntheticResult & { tst_triage?: TstTriageResult } {
  const relMd = opts?.relMd || "cases/caso_demo/state/juris_search_results.md";
  return {
    status: "success",
    engine_version: "1.7.1",
    queries_executed: 1,
    stance: "DEFENSE",
    regime: "BOTH",
    total_hits: 10,
    statutory_bridge_applied: ["PONTE_ESTATAIS_13303_14133"],
    jurisdiction_routing: {
      executed_courts: ["TST"],
      unimplemented_uf_requested: null,
      supported_ufs: ["PA", "CE", "DF", "SP", "MG", "PR"],
      fallback_notice: null,
    },
    ...(opts?.liveDegraded ? { live_degraded: opts.liveDegraded } : {}),
    top_hits: [],
    tst_triage: tstTriage,
    results_md: relMd,
    next_step_hint: `Consulte ${relMd} e execute 'fetch_juris' nos leading cases escolhidos.`,
  };
}

describe("TST Precedent Triage v1.7.2 — Módulo Puro (4 Baldes, Year, Pertinência & Budget)", () => {
  it("1. deve classificar corretamente os 4 baldes (incluindo ArgInc no Pleno -> inter_partes e E-RR sem colegiado -> orientativas)", () => {
    // erga_omnes: exclusivamente SV, RG, IRR, IAC
    expect(classifyTstHit({ id: "STF-SV-10", court: "TST", processo: "SV 10" })).toEqual({
      bucket: "erga_omnes",
      kind: "SV",
    });
    expect(
      classifyTstHit({
        id: "TST-TEMA-1118-ONUS-PROVA",
        court: "TST",
        colegiado: "SBDI-1 / STF Repercussão Geral",
      })
    ).toEqual({ bucket: "erga_omnes", kind: "RG" });
    expect(
      classifyTstHit({
        id: "TST-IRR-190-53.2015.5.03.0090",
        court: "TST",
        colegiado: "SBDI-1",
      })
    ).toEqual({ bucket: "erga_omnes", kind: "IRR" });
    expect(
      classifyTstHit({
        id: "TST-IAC-0001-2023",
        court: "TST",
        colegiado: "Tribunal Pleno",
      })
    ).toEqual({ bucket: "erga_omnes", kind: "IAC" });

    // Ajuste #1: ArgInc julgada no Tribunal Pleno DEVE ir para inter_partes (kind ARGINC), nunca orientativas
    expect(
      classifyTstHit({
        id: "TST-ArgInc-1000-2022",
        court: "TST",
        processo: "ArgInc-1000-12.2022.5.00.0000",
        colegiado: "Tribunal Pleno",
      })
    ).toEqual({ bucket: "inter_partes", kind: "ARGINC" });

    // orientativas: Súmula comum, OJ, SBDI-1/2, SDC, Órgão Especial, Pleno + Ajuste #2 (E-RR/Ag-E-RR sem colegiado)
    expect(
      classifyTstHit({ id: "SUMULA-TST-331", court: "TST", colegiado: "Tribunal Pleno" })
    ).toEqual({ bucket: "orientativas", kind: "SUMULA" });
    expect(
      classifyTstHit({ id: "OJ-TST-SDI1-191", court: "TST", colegiado: "SBDI-1" })
    ).toEqual({ bucket: "orientativas", kind: "OJ" });
    expect(
      classifyTstHit({
        id: "TST-E-RR-1234-55.2020.5.02.0001",
        court: "TST",
        colegiado: "Turma", // fallback genérico sem orgaoJudicante
      })
    ).toEqual({ bucket: "orientativas", kind: "SBDI-1" });
    expect(
      classifyTstHit({
        id: "TST-Ag-E-RR-999-11.2021.5.04.0001",
        court: "TST",
      })
    ).toEqual({ bucket: "orientativas", kind: "SBDI-1" });
    expect(
      classifyTstHit({ id: "TST-SDC-100", court: "TST", colegiado: "SDC" })
    ).toEqual({ bucket: "orientativas", kind: "SDC" });
    expect(
      classifyTstHit({ id: "TST-OE-200", court: "TST", colegiado: "Órgão Especial" })
    ).toEqual({ bucket: "orientativas", kind: "ORGAO_ESPECIAL" });

    // inter_partes: 1ª..8ª Turma, RR/AIRR/Ag-AIRR/RRAg/ED-RR, monocrática
    expect(
      classifyTstHit({
        id: "TST-RR-100123-45.2020.5.02.0001",
        court: "TST",
        colegiado: "3ª Turma",
      })
    ).toEqual({ bucket: "inter_partes", kind: "TURMA" });
    expect(
      classifyTstHit({
        id: "TST-DEC-555",
        court: "TST",
        colegiado: "Decisão Monocrática - Presidência",
      })
    ).toEqual({ bucket: "inter_partes", kind: "MONOCRATICA" });

    // unclassified: payload sem metadado estruturado confiável (mesmo com fallback genérico "Turma")
    expect(
      classifyTstHit({
        id: "TST-UUID-99887766",
        court: "TST",
        colegiado: "Turma",
        rawPayload: {},
      })
    ).toEqual({ bucket: "unclassified", kind: "UNCLASSIFIED" });
  });

  it("2. NÃO deve promover acórdão de Turma para orientativas/erga_omnes por citação na ementa", () => {
    const turmaHit: RawJurisSearchResult = {
      id: "TST-Ag-AIRR-555-22.2021.5.05.0001",
      court: "TST",
      colegiado: "5ª Turma",
      processo: "Ag-AIRR-555-22.2021.5.05.0001",
      tese: "Nos termos da Súmula 331 do TST, da OJ 191 da SBDI-1, do Tema 246 e do IRR 190 de Repercussão Geral...",
      dispositivo: "Nega provimento aplicando a Súmula 331 e Tema 1118.",
    };
    expect(classifyTstHit(turmaHit)).toEqual({
      bucket: "inter_partes",
      kind: "TURMA",
    });
  });

  it("3. deve extrair year confiável (4 dígitos) e OMITIR year (sem null nem 2024 inventado) quando ausente em LIVE", () => {
    expect(
      extractReliableYear({
        id: "TST-RR-1",
        court: "TST",
        dataSessao: "2025-02-13",
      })
    ).toBe(2025);

    expect(
      extractReliableYear({
        id: "TST-RR-2",
        court: "TST",
        rawPayload: { dtaPublicacao: "19/08/2023" },
      })
    ).toBe(2023);

    expect(
      extractReliableYear({
        id: "SUMULA-TST-331",
        court: "TST",
        ano: 2011,
        origin: "CURATED_CATALOG",
      })
    ).toBe(2011);

    // Payload LIVE sem dataSessao/dtaJulgamento/dtaPublicacao, mesmo com ano: 2024 herdado -> undefined
    const missingYear = extractReliableYear({
      id: "TST-RR-NO-DATE",
      court: "TST",
      ano: 2024,
      origin: "LIVE",
      rawPayload: { numero: "123" },
    });
    expect(missingYear).toBeUndefined();

    const { triage } = triageTstPrecedents(
      [
        {
          id: "TST-RR-NO-DATE",
          court: "TST",
          colegiado: "2ª Turma",
          ano: 2024,
          origin: "LIVE",
          tese: "terceirização responsabilidade subsidiária",
        },
      ],
      "terceirização responsabilidade subsidiária",
      "triaged"
    );
    const item = triage.buckets.inter_partes[0];
    expect(item).toBeDefined();
    expect("year" in item).toBe(false);
  });

  it("4. deve aplicar piso mínimo de pertinência (filtered_out) e respeitar bypass normativo/catálogo", () => {
    const hits: RawJurisSearchResult[] = [
      {
        id: "SUMULA-TST-331",
        court: "TST",
        colegiado: "Tribunal Pleno",
        origin: "CURATED_CATALOG",
        indexacao: "Terceirização; Responsabilidade Subsidiária",
        tese: "Responsabilidade subsidiária da Administração Pública na terceirização.",
      },
      {
        id: "TST-AIRR-777-2023",
        court: "TST",
        colegiado: "4ª Turma",
        indexacao: "Adicional de periculosidade; motoboy",
        tese: "Adicional de periculosidade em deslocamento urbano por motocicleta.",
      },
    ];

    // Query aberta -> filtra hit fora do tema
    const open = triageTstPrecedents(hits, "terceirização responsabilidade subsidiária", "compare");
    expect(open.keptHits.map((h) => h.id)).toEqual(["SUMULA-TST-331"]);
    expect(open.triage.counts.filtered_out).toBe(1);
    expect(open.triage.raw_diff?.raw_total).toBe(2);
    expect(open.triage.raw_diff?.filtered_out_ids).toEqual(["TST-AIRR-777-2023"]);

    // Bypass normativo explícito -> não filtra nada
    const norm = filterTstHitsByPertinence(hits, "Súmula 331");
    expect(norm.bypassApplied).toBe(true);
    expect(norm.filteredOut.length).toBe(0);
    expect(norm.kept.length).toBe(2);

    const cnj = filterTstHitsByPertinence(hits, "0000959-81.2015.5.05.0033");
    expect(cnj.bypassApplied).toBe(true);
    expect(cnj.kept.length).toBe(2);
  });

  it("5. deve agregar sub-queries (|) via mergeTstTriageResults sem duplo filtro", () => {
    const res1 = triageTstPrecedents(
      [
        {
          id: "SUMULA-TST-331",
          court: "TST",
          colegiado: "Tribunal Pleno",
          origin: "CURATED_CATALOG",
          tese: "terceirização responsabilidade subsidiária",
        },
        {
          id: "TST-AIRR-NOISE-1",
          court: "TST",
          colegiado: "1ª Turma",
          tese: "horas in itinere turno ininterrupto",
        },
      ],
      "terceirização subsidiária",
      "compare"
    ).triage;

    const res2 = triageTstPrecedents(
      [
        {
          id: "SUMULA-TST-331",
          court: "TST",
          colegiado: "Tribunal Pleno",
          origin: "CURATED_CATALOG",
          tese: "terceirização responsabilidade subsidiária",
        },
        {
          id: "TST-AIRR-NOISE-1",
          court: "TST",
          colegiado: "1ª Turma",
          tese: "horas in itinere turno ininterrupto",
        },
      ],
      "horas in itinere",
      "compare"
    ).triage;

    const merged = mergeTstTriageResults([res1, res2], "compare");
    // SUMULA-TST-331 não é duplicada; TST-AIRR-NOISE-1 foi aceito na query 2 então sai de filtered_out_ids
    expect(merged.counts.orientativas).toBe(1);
    expect(merged.counts.inter_partes).toBe(1);
    expect(merged.counts.filtered_out).toBe(0);
    expect(merged.raw_diff?.filtered_out_ids).toEqual([]);
  });

  it("6. compactTstTriageToBudget deve manter < 900B em stress extremo e preservar filtered_out_ids antes de zerar em compare", () => {
    const longTitle = "Título jurídico extremamente extenso para forçar o estouro do orçamento de 880 bytes no envelope MCP";
    const heavyTriage = {
      mode: "compare" as const,
      counts: {
        erga_omnes: 3,
        orientativas: 4,
        inter_partes: 8,
        unclassified: 2,
        filtered_out: 3,
      },
      buckets: {
        erga_omnes: [
          { id: "TST-TEMA-1118-ONUS-PROVA", kind: "RG", year: 2025, title: longTitle },
          { id: "TST-IRR-190-53.2015.5.03.0090", kind: "IRR", year: 2017, title: longTitle },
        ],
        orientativas: [
          { id: "SUMULA-TST-331", kind: "SUMULA", year: 2011, title: longTitle },
          { id: "OJ-TST-SDI1-191", kind: "OJ", year: 2017, title: longTitle },
        ],
        inter_partes: [
          { id: "TST-RR-100123-45.2020.5.02.0001", kind: "TURMA", year: 2024, title: longTitle },
        ],
        unclassified: [{ id: "TST-UUID-0001", kind: "UNCLASSIFIED", title: longTitle }],
      },
      raw_diff: {
        raw_total: 20,
        raw_top_ids: ["TST-TEMA-1118-ONUS-PROVA", "SUMULA-TST-331", "TST-RR-100123"],
        filtered_out_ids: ["TST-AIRR-999-2023", "TST-AIRR-888-2023", "TST-AIRR-777-2023"],
      },
    };

    const payload = makeSyntheticBase(heavyTriage, {
      liveDegraded: ["TST(short_circuit->curated; force_live=true p/ live)"],
    });
    compactTstTriageToBudget(payload, "cases/caso_demo/state/juris_search_results.md", 880);

    const bytes = Buffer.byteLength(JSON.stringify(payload), "utf-8");
    expect(bytes).toBeLessThan(900);
    expect(bytes).toBeLessThanOrEqual(880);
    // Ajuste #4: em compare com filtered_out > 0, filtered_out_ids preserva ao menos 1 ID antes de zerar
    expect(payload.tst_triage?.raw_diff?.filtered_out_ids.length).toBeGreaterThanOrEqual(1);
    expect(payload.tst_triage?.counts).toEqual(heavyTriage.counts);
  });
});
