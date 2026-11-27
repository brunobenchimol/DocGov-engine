// ============================================================================
// Normalizador Puro de IDs do TCM-PA (Zero Texto Normativo Estático — v1.7.6)
// ============================================================================

function stripNumberPunctuation(raw: string): string {
  return raw.replace(/\./g, "");
}

function expandYear(rawAno: string): string {
  return rawAno.length === 2 ? `20${rawAno}` : rawAno;
}

export function normalizeTcmPaId(ref: string): string {
  if (!ref) return "";
  const clean = ref.trim().toUpperCase().replace(/\s+/g, " ");

  const acMatch = clean.match(
    /(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+(?:AC[OÓ]RD[AÃ]O|AC)|AC[OÓ]RD[AÃ]O[-_ ]+(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+)?(?:N[Oº°]?\s*)?)([\d.]{1,8})[-_/](\d{2,4})/i
  );
  if (acMatch) {
    return `TCM-PA-ACORDAO-${stripNumberPunctuation(acMatch[1])}-${expandYear(acMatch[2])}`;
  }

  const resMatch = clean.match(
    /(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+RESOLU[CÇ][AÃ]O|RESOLU[CÇ][AÃ]O[-_ ]+(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+)?(?:N[Oº°]?\s*)?)([\d.]{1,8})[-_/.](\d{2,4})/i
  );
  if (resMatch) {
    return `TCM-PA-RESOLUCAO-${stripNumberPunctuation(resMatch[1])}-${expandYear(resMatch[2])}`;
  }

  const inMatch = clean.match(
    /(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+IN|(?:INSTRU[CÇ][AÃ]O\s+NORMATIVA|IN)[-_ ]+(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+)?(?:N[Oº°]?\s*)?)(\d{1,3})[-_/](\d{2,4})/i
  );
  if (inMatch) {
    return `TCM-PA-IN-${inMatch[1].padStart(2, "0")}-${expandYear(inMatch[2])}`;
  }

  const consMatch = clean.match(
    /(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+CONSULTA|CONSULTA[-_ ]+(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+)?(?:N[Oº°]?\s*)?)(\d{1,6})[-_/](\d{2,4})/i
  );
  if (consMatch) {
    return `TCM-PA-CONSULTA-${consMatch[1]}-${expandYear(consMatch[2])}`;
  }

  const sumMatch = clean.match(
    /(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+S[UÚ]MULA|S[UÚ]MULA[-_ ]+(?:(?:TCM[-_]?PA|TCMPA)[-_ ]+)?(?:N[Oº°]?\s*)?)(\d{1,3})/i
  );
  if (sumMatch) {
    return `TCM-PA-SUMULA-${String(Number(sumMatch[1]))}`;
  }

  const wpMatch = clean.match(/^TCM[-_]?PA[-_](?:WP|DECISAO)[-_](\d+)(?:[-_](\d{4}))?$/i);
  if (wpMatch) {
    return wpMatch[2] ? `TCM-PA-DECISAO-${wpMatch[1]}-${wpMatch[2]}` : `TCM-PA-WP-${wpMatch[1]}`;
  }

  const bareNumYear = clean.match(/^([\d.]{1,8})[-_/](\d{2,4})$/);
  if (bareNumYear) {
    return `TCM-PA-ACORDAO-${stripNumberPunctuation(bareNumYear[1])}-${expandYear(bareNumYear[2])}`;
  }

  if (/^[\d.]{1,10}$/.test(clean)) {
    return `TCM-PA-ACORDAO-${stripNumberPunctuation(clean)}`;
  }

  return clean;
}
