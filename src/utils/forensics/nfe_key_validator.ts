export interface NfeAccessKeyParsed {
  access_key: string;
  uf: string;
  aamm: string;
  cnpj: string;
  modelo: string;
  serie: string;
  numero: string;
  tipo_emissao: string;
  codigo_numerico: string;
  dv_declared: number;
  dv_expected: number;
}

export interface NfeKeyValidationResult {
  valid_structure_and_dv: boolean;
  valid_cnpj_and_date: boolean;
  parsed?: NfeAccessKeyParsed;
  blocking_tags: string[];
  reasons: string[];
}

const VALID_IBGE_UFS = new Set([
  "11", "12", "13", "14", "15", "16", "17",
  "21", "22", "23", "24", "25", "26", "27", "28", "29",
  "31", "32", "33", "35",
  "41", "42", "43",
  "50", "51", "52", "53",
]);

const VALID_NFE_MODELS = new Set(["55", "65"]);

export function computeNfeMod11CheckDigit(first43Digits: string): number {
  if (!/^\d{43}$/.test(first43Digits)) {
    throw new Error("NF-e base key must have exactly 43 numeric digits.");
  }
  let sum = 0;
  for (let i = 42; i >= 0; i--) {
    const weight = 2 + ((42 - i) % 8);
    sum += Number(first43Digits[i]) * weight;
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function parseDeclaredDateToAamm(rawDate: string | undefined): string | null {
  if (!rawDate) return null;
  const trimmed = rawDate.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})(?:-\d{2})?(?:[T\s].*)?$/);
  if (isoMatch) {
    return `${isoMatch[1].slice(2)}${isoMatch[2]}`;
  }
  const brMatch = trimmed.match(/^\d{2}\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[2].slice(2)}${brMatch[1]}`;
  }
  return null;
}

export function parseAndValidateNfeAccessKey(
  rawKey: string,
  options: { expectedCnpj?: string; declaredIssueDate?: string } = {}
): NfeKeyValidationResult {
  const sanitizedInput = String(rawKey || "").trim();
  const hasInvalidChars = /[^\d\s.\-\/]/.test(sanitizedInput);
  const digits = sanitizedInput.replace(/\D/g, "");
  const blocking_tags: string[] = [];
  const reasons: string[] = [];

  if (hasInvalidChars || digits.length !== 44) {
    blocking_tags.push("[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]");
    reasons.push(
      `Chave de acesso NF-e inválida ('${sanitizedInput}'): exige exatamente 44 dígitos numéricos (encontrado: ${digits.length}).`
    );
    return { valid_structure_and_dv: false, valid_cnpj_and_date: false, blocking_tags, reasons };
  }

  const uf = digits.slice(0, 2);
  const aamm = digits.slice(2, 6);
  const mmNum = Number(aamm.slice(2, 4));
  const cnpj = digits.slice(6, 20);
  const modelo = digits.slice(20, 22);
  const serie = digits.slice(22, 25);
  const numero = digits.slice(25, 34);
  const tipo_emissao = digits.slice(34, 35);
  const codigo_numerico = digits.slice(35, 43);
  const dv_declared = Number(digits.slice(43, 44));
  const dv_expected = computeNfeMod11CheckDigit(digits.slice(0, 43));

  const parsed: NfeAccessKeyParsed = {
    access_key: digits,
    uf,
    aamm,
    cnpj,
    modelo,
    serie,
    numero,
    tipo_emissao,
    codigo_numerico,
    dv_declared,
    dv_expected,
  };

  if (!VALID_IBGE_UFS.has(uf)) {
    reasons.push(`UF IBGE '${uf}' inválida na chave NF-e.`);
  }
  if (mmNum < 1 || mmNum > 12) {
    reasons.push(`Mês '${aamm.slice(2, 4)}' inválido no segmento AAMM da chave NF-e.`);
  }
  if (!VALID_NFE_MODELS.has(modelo)) {
    reasons.push(`Modelo fiscal '${modelo}' inválido na chave NF-e (esperado 55 ou 65).`);
  }
  if (dv_declared !== dv_expected) {
    reasons.push(
      `Dígito Verificador Módulo 11 da chave NF-e inválido: declarado '${dv_declared}', esperado '${dv_expected}'.`
    );
  }

  const validStructureAndDv = reasons.length === 0;
  if (!validStructureAndDv) {
    blocking_tags.push("[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]");
  }

  let validCnpjAndDate = true;
  const expectedCnpjDigits = (options.expectedCnpj || "").replace(/\D/g, "");
  if (
    expectedCnpjDigits.length === 14 &&
    expectedCnpjDigits !== "00000000000000" &&
    expectedCnpjDigits !== "00000000000100" &&
    cnpj !== expectedCnpjDigits
  ) {
    validCnpjAndDate = false;
    reasons.push(
      `CNPJ embutido na chave NF-e (${cnpj}) diverge do emitente esperado (${expectedCnpjDigits}).`
    );
  }

  const expectedAamm = parseDeclaredDateToAamm(options.declaredIssueDate);
  if (expectedAamm && aamm !== expectedAamm) {
    validCnpjAndDate = false;
    reasons.push(
      `Ano/mês AAMM na chave NF-e (${aamm}) diverge da data de emissão declarada (${options.declaredIssueDate} -> ${expectedAamm}).`
    );
  }

  if (!validCnpjAndDate) {
    blocking_tags.push("[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]");
  }

  return {
    valid_structure_and_dv: validStructureAndDv,
    valid_cnpj_and_date: validCnpjAndDate,
    parsed,
    blocking_tags,
    reasons,
  };
}
