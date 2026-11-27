// ============================================================================
// Normalizador Puro de IDs do TCE-SP (Zero Texto Normativo Estático — v1.7.6)
// ============================================================================

export function normalizeTceSpId(ref: string): string {
  const clean = (ref || "").trim().toUpperCase();
  if (!clean) return "";

  const sumMatch =
    clean.match(/(?:SUMULA[-_]?TCESP|TCE[-_]?SP[-_]?SUMULA|SUMULA[-_]?TCE[-_]?SP)[-_]?0*(\d{1,3})/i) ||
    clean.match(/S[UÚ]MULA\s*(?:N[Oº°]\s*)?0*(\d{1,3})\s*(?:DO\s*)?(?:TCE[-_]?SP|TCESP)/i);
  if (sumMatch) {
    return `SUMULA-TCESP-${String(Number(sumMatch[1]))}`;
  }

  const tcCanonical = clean.match(/^TCE[-_]?SP[-_]TC[-_](\d+)[-_](\d{2,4})$/i);
  if (tcCanonical) {
    const ano = tcCanonical[2].length === 2 ? `20${tcCanonical[2]}` : tcCanonical[2];
    return `TCE-SP-TC-${tcCanonical[1]}-${ano}`;
  }

  const tcMatch = clean.match(/^(?:TCE[-_]?SP[-_]?)?TC[-_\s]*(\d+)[./](\d{3})[./](\d{2,4})(?:-\d+)?$/i);
  if (tcMatch) {
    const ano = tcMatch[3].length === 2 ? `20${tcMatch[3]}` : tcMatch[3];
    return `TCE-SP-TC-${tcMatch[1]}-${ano}`;
  }

  return clean;
}
