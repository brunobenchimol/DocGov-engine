// ============================================================================
// Helper Centralizado de Envelopamento Híbrido MCP/CLI (Lei 2 Bimodal — v1.7.5)
// ============================================================================

import {
  DEFAULT_MCP_POINTER_SAFE_MARGIN_BYTES,
  MCP_INLINE_HINT,
  MCP_POINTER_HINT,
  getMcpInlineMaxBytes,
  getMcpPointerMaxBytes,
} from "../config/mcp_limits.ts";
import { enqueueWrite } from "./fs_safe_io.ts";
import { fitBlockingTagsToBudget, formatCompactMcpPath } from "./json.ts";
import type {
  McpDeliveryEnvelopeFields,
  McpDeliveryMode,
} from "../types/index.ts";

export type { McpDeliveryEnvelopeFields, McpDeliveryMode };
export type McpWriteMode = "write_behind" | "sync";

export interface CompanionWriteItem {
  filePath: string;
  content: string;
}

export interface BuildHybridMcpEnvelopeOptions<T extends Record<string, any>> {
  basePayload: T;
  artifactPath: string;
  displayArtifactPath?: string;
  markdownContent: string;
  writeMode: McpWriteMode;
  deferWrite?: boolean;
  companionWrites?: CompanionWriteItem[];
  pointerSafeMarginBytes?: number;
  compactForPointer?: (
    payload: T & McpDeliveryEnvelopeFields,
    targetBytes: number
  ) => void;
}

export interface BuiltMcpEnvelope<T extends Record<string, any>> {
  payload: T & McpDeliveryEnvelopeFields;
  json: string;
  delivery_mode: McpDeliveryMode;
}

/** Remove UTF-8 BOM e normaliza quebras CRLF/CR para LF (\n). */
export function normalizeMarkdownForMcp(content: string): string {
  const withoutBom = content.startsWith("\uFEFF") ? content.slice(1) : content;
  return withoutBom.replace(/\r\n?/g, "\n");
}

/** Calcula tamanho em KB (2 casas) e total de linhas sobre texto normalizado LF. */
export function computeMarkdownMetrics(normalizedMarkdown: string): {
  artifact_size_kb: number;
  artifact_lines: number;
} {
  const bytes = Buffer.byteLength(normalizedMarkdown, "utf8");
  const artifact_size_kb = Number((bytes / 1024).toFixed(2));
  if (normalizedMarkdown.length === 0) {
    return { artifact_size_kb, artifact_lines: 0 };
  }
  const trimmedTrailingLf = normalizedMarkdown.endsWith("\n")
    ? normalizedMarkdown.slice(0, -1)
    : normalizedMarkdown;
  const artifact_lines =
    trimmedTrailingLf.length === 0 ? 1 : trimmedTrailingLf.split("\n").length;
  return { artifact_size_kb, artifact_lines };
}

function dispatchWriteBehind(filePath: string, normalizedContent: string): void {
  void enqueueWrite(filePath, normalizedContent).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[docgov-engine][write-behind] Erro ao gravar '${filePath}': ${msg}\n`
    );
  });
}

async function awaitAllQueuedWrites(
  primaryPath: string,
  primaryNormalized: string,
  companionWrites: CompanionWriteItem[] = []
): Promise<void> {
  const tasks: Array<Promise<void>> = [
    enqueueWrite(primaryPath, primaryNormalized),
  ];
  for (const item of companionWrites) {
    tasks.push(
      enqueueWrite(item.filePath, normalizeMarkdownForMcp(item.content))
    );
  }
  await Promise.all(tasks);
}

/** Constrói envelope bimodal INLINE/POINTER sobre o JSON final serializado. */
export async function buildHybridMcpEnvelope<T extends Record<string, any>>(
  options: BuildHybridMcpEnvelopeOptions<T>
): Promise<BuiltMcpEnvelope<T>> {
  const normalized = normalizeMarkdownForMcp(options.markdownContent);
  const { artifact_size_kb, artifact_lines } =
    computeMarkdownMetrics(normalized);
  const compactArtifactPath =
    options.displayArtifactPath ?? formatCompactMcpPath(options.artifactPath);

  const cleanBase: Record<string, any> = { ...options.basePayload };
  delete cleanBase.inline_markdown;

  const inlinePayload: T & McpDeliveryEnvelopeFields = {
    ...(cleanBase as T),
    delivery_mode: "INLINE",
    read_file_required: false,
    artifact_path: compactArtifactPath,
    artifact_size_kb,
    artifact_lines,
    inline_markdown: normalized,
    next_step_hint: MCP_INLINE_HINT,
  };

  const inlineJson = JSON.stringify(inlinePayload);
  const inlineBytes = Buffer.byteLength(inlineJson, "utf8");
  const maxInlineBytes = getMcpInlineMaxBytes();

  if (inlineBytes <= maxInlineBytes) {
    if (options.writeMode === "write_behind") {
      if (options.deferWrite !== false) {
        dispatchWriteBehind(options.artifactPath, normalized);
        for (const item of options.companionWrites || []) {
          dispatchWriteBehind(
            item.filePath,
            normalizeMarkdownForMcp(item.content)
          );
        }
      } else {
        await awaitAllQueuedWrites(
          options.artifactPath,
          normalized,
          options.companionWrites
        );
      }
    }
    return {
      payload: inlinePayload,
      json: inlineJson,
      delivery_mode: "INLINE",
    };
  }

  // Modo POINTER (> MCP_INLINE_MAX_BYTES): gravação síncrona obrigatória antes do retorno
  if (options.writeMode === "write_behind") {
    await awaitAllQueuedWrites(
      options.artifactPath,
      normalized,
      options.companionWrites
    );
  }

  const pointerPayload: T & McpDeliveryEnvelopeFields = {
    ...(cleanBase as T),
    delivery_mode: "POINTER",
    read_file_required: true,
    artifact_path: compactArtifactPath,
    artifact_size_kb,
    artifact_lines,
    next_step_hint: MCP_POINTER_HINT,
  };

  const maxPointerBytes = getMcpPointerMaxBytes();
  const targetBytes = Math.min(
    maxPointerBytes,
    options.pointerSafeMarginBytes ?? DEFAULT_MCP_POINTER_SAFE_MARGIN_BYTES
  );

  if (options.compactForPointer) {
    options.compactForPointer(pointerPayload, targetBytes);
  }

  // Garante preservação da sentinela [+N_TAGS_NO_DOSSIE] sobre o JSON final
  if (Array.isArray((pointerPayload as any).blocking_tags)) {
    fitBlockingTagsToBudget(pointerPayload as any, targetBytes);
  }

  const pointerJson = JSON.stringify(pointerPayload);
  return {
    payload: pointerPayload,
    json: pointerJson,
    delivery_mode: "POINTER",
  };
}

/** Constrói envelope SUMMARY (< 1 KB, read_file_required: false) para compiladores binários. */
export function buildSummaryMcpEnvelope<T extends Record<string, any>>(
  basePayload: T
): BuiltMcpEnvelope<T> {
  const payload: T & McpDeliveryEnvelopeFields = {
    ...basePayload,
    delivery_mode: "SUMMARY",
    read_file_required: false,
    ...(basePayload.next_step_hint
      ? {}
      : { next_step_hint: "Compilacao concluida." }),
  };

  const maxPointerBytes = getMcpPointerMaxBytes();
  let json = JSON.stringify(payload);
  if (
    Buffer.byteLength(json, "utf8") > maxPointerBytes &&
    typeof (payload as any).message === "string"
  ) {
    (payload as any).message = "Concluido.";
    json = JSON.stringify(payload);
  }

  return {
    payload,
    json,
    delivery_mode: "SUMMARY",
  };
}
