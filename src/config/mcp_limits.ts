// ============================================================================
// Configuração Centralizada de Limites MCP Bimodais (Lei 2 Bimodal — v1.7.5)
// ============================================================================

export const DEFAULT_MCP_INLINE_MAX_BYTES = 8192;
export const DEFAULT_MCP_POINTER_MAX_BYTES = 1024;
export const DEFAULT_MCP_POINTER_SAFE_MARGIN_BYTES = 880;

export const MCP_INLINE_HINT =
  "INLINE_INTEGRAL: usar inline_markdown; nao chamar read_file.";
export const MCP_POINTER_HINT =
  "LER_DISCO: chamar read_file em artifact_path.";

function parsePositiveIntEnv(
  rawValue: string | undefined,
  fallback: number
): number {
  if (!rawValue) return fallback;
  const parsed = Number(rawValue.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

/**
 * Lê dinamicamente o teto INLINE (bytes UTF-8 sobre o payload JSON final serializado).
 */
export function getMcpInlineMaxBytes(): number {
  return parsePositiveIntEnv(
    process.env.MCP_INLINE_MAX_BYTES,
    DEFAULT_MCP_INLINE_MAX_BYTES
  );
}

/**
 * Lê dinamicamente o sub-teto POINTER (bytes UTF-8 do envelope compacto).
 */
export function getMcpPointerMaxBytes(): number {
  return parsePositiveIntEnv(
    process.env.MCP_POINTER_MAX_BYTES,
    DEFAULT_MCP_POINTER_MAX_BYTES
  );
}
