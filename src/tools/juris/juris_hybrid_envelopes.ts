// ============================================================================
// Envelopes Híbridos Bimodais de Jurisprudência (search_juris e fetch_juris)
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { MCP_POINTER_HINT } from "../../config/mcp_limits.ts";
import { formatCompactMcpPath } from "../../utils/json.ts";
import {
  buildHybridMcpEnvelope,
  type BuiltMcpEnvelope,
} from "../../utils/mcp_hybrid_output.ts";
import { formatSearchJurisSyntheticResult } from "./search_juris.ts";
import { formatFetchJurisSyntheticResult } from "./fetch_juris.ts";
import { compactTstTriageToBudget } from "./tst_precedent_triage.ts";
import type {
  FetchJurisSyntheticResult,
  JurisOrigin,
  JurisSearchResultItem,
  SearchJurisFileResult,
  SearchJurisSyntheticResult,
  SlicedDossierResult,
} from "./types.ts";

export async function buildSearchJurisHybridEnvelope(args: {
  fileResult: SearchJurisFileResult;
  mdPath: string;
  mdContent?: string;
  baseDir?: string;
  currentHits?: JurisSearchResultItem[];
}): Promise<BuiltMcpEnvelope<SearchJurisSyntheticResult>> {
  const baseDir = args.baseDir ?? process.cwd();
  const synthetic = formatSearchJurisSyntheticResult(
    args.fileResult,
    args.mdPath,
    baseDir,
    args.currentHits
  );
  const mdContent =
    args.mdContent ??
    (existsSync(args.mdPath) ? readFileSync(args.mdPath, "utf8") : "");
  const relMd = synthetic.results_md || formatCompactMcpPath(args.mdPath, baseDir);

  return await buildHybridMcpEnvelope({
    basePayload: synthetic,
    artifactPath: args.mdPath,
    displayArtifactPath: relMd,
    markdownContent: mdContent,
    writeMode: "sync",
    compactForPointer: (payload, targetBytes) => {
      const byteSize = () => Buffer.byteLength(JSON.stringify(payload), "utf8");
      if (payload.tst_triage) {
        compactTstTriageToBudget(payload, relMd, targetBytes);
        payload.next_step_hint = MCP_POINTER_HINT;
        if (byteSize() > targetBytes && payload.tst_triage) {
          payload.tst_triage.buckets = {
            erga_omnes: [],
            orientativas: [],
            inter_partes: [],
            unclassified: [],
          };
          if (payload.tst_triage.raw_diff) {
            payload.tst_triage.raw_diff = {
              raw_total: payload.tst_triage.raw_diff.raw_total,
              raw_top_ids: [],
              filtered_out_ids: [],
            };
          }
        }
        if (byteSize() > targetBytes) {
          delete payload.tst_triage;
        }
        if (byteSize() <= targetBytes) return;
      }

      if (byteSize() > targetBytes) {
        payload.top_hits = payload.top_hits.slice(0, 1);
        if (payload.top_hits[0]) {
          payload.top_hits[0].tese_short = payload.top_hits[0].tese_short.slice(0, 45);
        }
        payload.statutory_bridge_applied = payload.statutory_bridge_applied.slice(0, 1);
      }
      if (byteSize() > targetBytes) {
        payload.top_hits = [];
        payload.statutory_bridge_applied = [];
        if (payload.live_degraded?.length) {
          const courts = payload.live_degraded.map((s) => s.split("(")[0]).join(",");
          payload.live_degraded = [`${courts}(curated)`];
        }
      }
      if (byteSize() > targetBytes && payload.jurisdiction_routing.fallback_notice) {
        payload.jurisdiction_routing.fallback_notice = `UF '${payload.jurisdiction_routing.unimplemented_uf_requested}' -> fallback.`;
      }
      if (byteSize() > targetBytes) {
        payload.results_md = basename(args.mdPath);
      }
    },
  });
}

export async function buildFetchJurisHybridEnvelope(args: {
  result: {
    slicedResult: SlicedDossierResult;
    dossiePath: string;
    fullPath: string;
    court: string;
    canonicalId: string;
    source?: JurisOrigin;
    dossieMarkdown?: string;
    fullMarkdown?: string;
  };
  baseDir?: string;
  deferWrite?: boolean;
}): Promise<BuiltMcpEnvelope<FetchJurisSyntheticResult>> {
  const baseDir = args.baseDir ?? process.cwd();
  const synthetic = formatFetchJurisSyntheticResult(args.result, baseDir);
  const dossieMd =
    args.result.dossieMarkdown ??
    (existsSync(args.result.dossiePath)
      ? readFileSync(args.result.dossiePath, "utf8")
      : args.result.slicedResult.dossieMarkdown);
  const fullMd =
    args.result.fullMarkdown ??
    (existsSync(args.result.fullPath)
      ? readFileSync(args.result.fullPath, "utf8")
      : args.result.slicedResult.fullMarkdown);

  return await buildHybridMcpEnvelope({
    basePayload: synthetic,
    artifactPath: args.result.dossiePath,
    displayArtifactPath: synthetic.dossie_sliced_md,
    markdownContent: dossieMd,
    writeMode: "write_behind",
    deferWrite: args.deferWrite !== false,
    companionWrites: [{ filePath: args.result.fullPath, content: fullMd }],
    compactForPointer: (payload, targetBytes) => {
      const byteSize = () => Buffer.byteLength(JSON.stringify(payload), "utf8");
      if (byteSize() > targetBytes) {
        payload.relator = payload.relator.slice(0, 24);
        payload.colegiado = payload.colegiado.slice(0, 24);
        payload.outcome = payload.outcome.slice(0, 24);
      }
      if (byteSize() > targetBytes) {
        payload.layers_extracted = ["1A-6A"];
      }
      if (byteSize() > targetBytes) {
        payload.dossie_sliced_md = basename(args.result.dossiePath);
        payload.inteiro_teor_full_md = basename(args.result.fullPath);
      }
    },
  });
}
