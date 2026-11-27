// ============================================================================
// Envelopes Híbridos Bimodais PNCP (fetch_pncp e search_pncp — Lei 2 Bimodal)
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  buildHybridMcpEnvelope,
  type BuiltMcpEnvelope,
} from "../../utils/mcp_hybrid_output.ts";
import type {
  FetchPncpResult,
  FetchPncpSyntheticResult,
  SearchPncpResult,
  SearchPncpSyntheticResult,
} from "../../types/index.ts";
import { formatFetchPncpSyntheticResult } from "./fetch_contract.ts";
import { formatSearchPncpSyntheticResult } from "./search_contracts.ts";

export async function buildFetchPncpHybridEnvelope(
  result: FetchPncpResult
): Promise<BuiltMcpEnvelope<FetchPncpSyntheticResult>> {
  const synthetic = formatFetchPncpSyntheticResult(result);
  const mdContent: string =
    (result as any)._indexMarkdown ??
    (existsSync(result.indexPath) ? readFileSync(result.indexPath, "utf8") : "");
  return await buildHybridMcpEnvelope({
    basePayload: synthetic,
    artifactPath: result.indexPath,
    displayArtifactPath: synthetic.index_path,
    markdownContent: mdContent,
    writeMode: "sync",
    compactForPointer: (payload, targetBytes) => {
      const sizeOf = () => Buffer.byteLength(JSON.stringify(payload), "utf8");
      if (sizeOf() > targetBytes) {
        payload.target_dir = basename(result.targetDir);
        payload.meta_path = basename(result.metaPath);
        payload.index_path = basename(result.indexPath);
      }
    },
  });
}

export async function buildSearchPncpHybridEnvelope(
  result: SearchPncpResult
): Promise<BuiltMcpEnvelope<SearchPncpSyntheticResult>> {
  const synthetic = formatSearchPncpSyntheticResult(result);
  const mdContent: string =
    (result as any)._resultsMarkdown ??
    (existsSync(result.resultsMdPath)
      ? readFileSync(result.resultsMdPath, "utf8")
      : "");
  return await buildHybridMcpEnvelope({
    basePayload: synthetic,
    artifactPath: result.resultsMdPath,
    displayArtifactPath: synthetic.results_md_path,
    markdownContent: mdContent,
    writeMode: "sync",
    compactForPointer: (payload, targetBytes) => {
      const sizeOf = () => Buffer.byteLength(JSON.stringify(payload), "utf8");
      while (
        Array.isArray(payload.top_candidates) &&
        payload.top_candidates.length > 1 &&
        sizeOf() > targetBytes
      ) {
        payload.top_candidates.pop();
      }
      if (sizeOf() > targetBytes && Array.isArray(payload.top_candidates)) {
        payload.top_candidates = payload.top_candidates.map((c) => ({
          ...c,
          objeto_resumo: c.objeto_resumo.slice(0, 32),
        }));
      }
      if (sizeOf() > targetBytes && Array.isArray(payload.top_candidates)) {
        payload.top_candidates = [];
      }
      if (sizeOf() > targetBytes) {
        payload.results_md_path = basename(result.resultsMdPath);
        payload.results_json_path = basename(result.resultsJsonPath);
      }
    },
  });
}
