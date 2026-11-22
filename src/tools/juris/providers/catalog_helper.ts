// ============================================================================
// Helper Compartilhado de Catálogos Normativos Curados (Lei 5 & Lei 9)
// Elimina duplicação de busca por palavras-chave e mapeamento para RawJurisFetchResult
// ============================================================================

import type { RawJurisFetchResult, RawJurisSearchResult } from "../types.ts";

export interface NormativeCatalogEntry {
  id: string;
  aliases: string[];
  court: string;
  numero: string;
  ano: number;
  colegiado: string;
  relator: string;
  dataSessao: string;
  indexacao: string;
  tese: string;
  dispositivo: string;
  fundamentacao: string;
  keywords: RegExp[];
}

export function searchNormativeCatalog(
  entries: NormativeCatalogEntry[],
  query: string,
  limit: number = 10,
  fallbackCount: number = 3
): RawJurisSearchResult[] {
  const scored = entries
    .map((entry) => {
      let score = 0;
      for (const rx of entry.keywords) {
        if (rx.test(query)) score += 20;
      }
      if (/licita[çc]|contrat|administra[çc][aã]o\s+p[úu]blica|edital/i.test(query)) {
        score += 5;
      }
      return { entry, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const selected =
    scored.length > 0
      ? scored.slice(0, limit).map((x) => x.entry)
      : entries.slice(0, Math.min(limit, fallbackCount));

  return selected.map((entry) => ({
    id: entry.id,
    court: entry.court,
    colegiado: entry.colegiado,
    numero: entry.numero,
    ano: entry.ano,
    processo: entry.id,
    relator: entry.relator,
    dataSessao: entry.dataSessao,
    entidade: "ORGAO_CONTRATANTE",
    indexacao: entry.indexacao,
    tese: entry.tese,
    dispositivo: entry.dispositivo,
    origin: "CURATED_CATALOG",
    rawPayload: { curated: true, ...entry },
  }));
}

export function mapNormativeCatalogToFetch(
  entry: NormativeCatalogEntry
): RawJurisFetchResult {
  return {
    id: entry.id,
    court: entry.court,
    exists: true,
    source: "CURATED_CATALOG",
    rawTextOrJson: {
      id: entry.id,
      tribunal: entry.court,
      numero: entry.numero,
      ano: entry.ano,
      processo: entry.id,
      colegiado: entry.colegiado,
      relator: entry.relator,
      dataSessao: entry.dataSessao,
      entidade: "ORGAO_CONTRATANTE",
      indexacao: entry.indexacao,
      ementa: entry.tese,
      tese: entry.tese,
      relatorio: `Precedente normativo consolidado (${entry.id} — ${entry.colegiado}).`,
      voto: entry.fundamentacao,
      acordao: entry.dispositivo,
      dispositivo: entry.dispositivo,
      inteiroTeorTexto: `${entry.tese}\n\n${entry.fundamentacao}\n\n${entry.dispositivo}`,
      rawText: `${entry.tese}\n\n${entry.fundamentacao}\n\n${entry.dispositivo}`,
    },
  };
}
