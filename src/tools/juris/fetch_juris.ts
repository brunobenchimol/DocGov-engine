// ============================================================================
// 10ª Ferramenta MCP: fetch_juris (CLI --fetch-juris)
// Verificador Anti-Alucinação e Fatiador Anatômico de Acórdãos
// ============================================================================

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { VERSION } from "../../constants/index.ts";
import { createJurisFetchContractError } from "../../contracts/errors.ts";
import {
  resolveWorkspacePath,
  isValidDocGovCaseScope,
  getEphemeralInspectDir,
} from "../../utils/paths.ts";
import { defaultJurisdictionRegistry } from "./provider_registry.ts";
import {
  assertAuthenticAcordao,
  sliceAcordaoAnatomically,
} from "./anatomical_slicer.ts";
import type {
  FetchJurisOptions,
  FetchJurisSyntheticResult,
  SlicedDossierResult,
} from "./types.ts";

/**
 * Detecta a corte a partir do identificador ou URL do acórdão.
 */
export function detectCourtFromRef(ref: string): string {
  const upper = ref.toUpperCase();
  if (upper.includes("TCE-PA") || upper.includes("TCEPA")) return "TCE-PA";
  if (upper.includes("TCE-CE") || upper.includes("TCECE")) return "TCE-CE";
  if (upper.includes("TCDF")) return "TCDF";
  if (upper.includes("STJ")) return "STJ";
  if (upper.includes("STF")) return "STF";
  return "TCU";
}

export async function fetchJuris(
  options: FetchJurisOptions
): Promise<{
  slicedResult: SlicedDossierResult;
  dossiePath: string;
  fullPath: string;
  court: string;
  canonicalId: string;
}> {
  const ref = options?.acordaoIdOrUrl || (options as any)?.id;
  if (!options || !ref || typeof ref !== "string") {
    throw createJurisFetchContractError("Parâmetro 'acordaoIdOrUrl' ausente ou inválido.");
  }

  const court = options.court || detectCourtFromRef(ref);
  const provider = defaultJurisdictionRegistry.get(court);

  if (!provider) {
    throw createJurisFetchContractError(`Tribunal '${court}' não suportado na v1.4.0.`);
  }

  // 1. Busca na fonte oficial (ou Mock Server)
  const rawFetch = await provider.fetch(ref);

  // 2. Trava Anti-Alucinação Estrita (Lei 3)
  const isAuthentic = !!rawFetch && rawFetch.exists && !!rawFetch.rawTextOrJson;
  assertAuthenticAcordao(isAuthentic, ref, court);

  // 3. Fatiamento Anatômico (6 Macro-Partes / 10 Sub-Camadas)
  const slicedResult = sliceAcordaoAnatomically(rawFetch!.rawTextOrJson, {
    court,
    topicFilter: options.topicFilter,
    stance: options.stance,
  });

  const l1a = slicedResult.layers.layer_1A_metadata;
  const canonicalId = `ACORDAO-${court}-${l1a.numero}-${l1a.ano}-${l1a.colegiado
    .toUpperCase()
    .replace(/\s+/g, "_")}`;

  const cleanShortname = (
    options.shortname || `${court.toLowerCase()}_${l1a.numero}_${l1a.ano}`
  ).replace(/[^a-zA-Z0-9_-]/g, "_");

  // 4. Determinação de Destinos em Disco (Estágio 2 em state/ e Estágio 3 em inputs/juris_*/)
  let baseCaseDir: string;
  if (options.caseDir) {
    const resolved = resolveWorkspacePath(options.caseDir);
    if (isValidDocGovCaseScope(resolved)) {
      baseCaseDir = resolved;
    } else {
      baseCaseDir = getEphemeralInspectDir();
    }
  } else {
    baseCaseDir = getEphemeralInspectDir();
  }

  const stateDir = join(baseCaseDir, "state");
  const inputsJurisDir = join(baseCaseDir, "inputs", `juris_${cleanShortname}`);

  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
  if (!existsSync(inputsJurisDir)) mkdirSync(inputsJurisDir, { recursive: true });

  const dossiePath = join(stateDir, `dossie_juris_${cleanShortname}.md`);
  const fullPath = join(inputsJurisDir, "inteiro_teor_anatomico.md");

  writeFileSync(dossiePath, slicedResult.dossieMarkdown, "utf-8");
  writeFileSync(fullPath, slicedResult.fullMarkdown, "utf-8");

  return {
    slicedResult,
    dossiePath,
    fullPath,
    court,
    canonicalId,
  };
}

/**
 * Formata o retorno sintético MCP estritamente abaixo de 900 bytes (Lei 2).
 */
export function formatFetchJurisSyntheticResult(
  result: {
    slicedResult: SlicedDossierResult;
    dossiePath: string;
    fullPath: string;
    court: string;
    canonicalId: string;
  },
  baseDir: string = process.cwd()
): FetchJurisSyntheticResult {
  const relDossie = relative(baseDir, result.dossiePath).replace(/\\/g, "/") || result.dossiePath;
  const relFull = relative(baseDir, result.fullPath).replace(/\\/g, "/") || result.fullPath;
  const l = result.slicedResult.layers;

  const payload: FetchJurisSyntheticResult = {
    status: "success",
    engine_version: VERSION,
    verified_authentic: true,
    canonical_id: result.canonicalId,
    court: result.court,
    colegiado: l.layer_1A_metadata.colegiado,
    relator: l.layer_1A_metadata.relator || "Relator",
    regime_detected: l.layer_1B_entity_regime.regimeLegal,
    outcome: l.outcome_summary,
    layers_extracted: ["1A", "1B", "2A", "2B", "3A", "3B", "3C", "4A", "5A", "6A"],
    topics_matched: result.slicedResult.topicsMatched,
    dossie_sliced_md: relDossie,
    inteiro_teor_full_md: relFull,
    next_step_hint: `Consulte ${relDossie} para citação e ${relFull} para leitura integral.`,
  };

  // Garante teto de 900 bytes (Lei 2)
  if (Buffer.byteLength(JSON.stringify(payload), "utf-8") >= 880) {
    payload.next_step_hint = `Consulte ${relDossie}`;
  }

  return payload;
}
