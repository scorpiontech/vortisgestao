// Helpers to validate ICMS CST/CSOSN against the company's tax regime.
// CSOSN is exclusive to Simples Nacional (CRT 1 or 4); other regimes must
// use CST (CRT 3).

export const SIMPLES_REGIMES = ["simples_nacional", "simples_excesso"] as const;

export const CSOSN_CODES = [
  { code: "101", label: "101 - Tributada com permissão de crédito" },
  { code: "102", label: "102 - Tributada sem permissão de crédito" },
  { code: "103", label: "103 - Isenção do ICMS (faixa de receita)" },
  { code: "201", label: "201 - Tributada com permissão + ST" },
  { code: "202", label: "202 - Tributada sem permissão + ST" },
  { code: "203", label: "203 - Isenção + ST" },
  { code: "300", label: "300 - Imune" },
  { code: "400", label: "400 - Não tributada pelo Simples" },
  { code: "500", label: "500 - ICMS cobrado anteriormente por ST" },
  { code: "900", label: "900 - Outros" },
];

export const CST_CODES = [
  { code: "00", label: "00 - Tributada integralmente" },
  { code: "10", label: "10 - Tributada com cobrança de ICMS por ST" },
  { code: "20", label: "20 - Com redução de base de cálculo" },
  { code: "30", label: "30 - Isenta/não tributada + ST" },
  { code: "40", label: "40 - Isenta" },
  { code: "41", label: "41 - Não tributada" },
  { code: "50", label: "50 - Suspensão" },
  { code: "51", label: "51 - Diferimento" },
  { code: "60", label: "60 - ICMS cobrado anteriormente por ST" },
  { code: "70", label: "70 - Com redução de base + ST" },
  { code: "90", label: "90 - Outras" },
];

export function isSimplesRegime(regime?: string | null): boolean {
  return !!regime && (SIMPLES_REGIMES as readonly string[]).includes(regime);
}

export function isCsosnCode(code?: string | null): boolean {
  if (!code) return false;
  return CSOSN_CODES.some((c) => c.code === code);
}

export function isCstCode(code?: string | null): boolean {
  if (!code) return false;
  return CST_CODES.some((c) => c.code === code);
}

export function defaultTributacaoCode(regime?: string | null): string {
  return isSimplesRegime(regime) ? "102" : "00";
}

/**
 * Returns an error message when the given tributação code is incompatible
 * with the informed regime. Returns null when it's valid.
 */
export function validateTributacaoForRegime(
  code: string | null | undefined,
  regime: string | null | undefined,
): string | null {
  if (!code) return null;
  const simples = isSimplesRegime(regime);
  if (simples && isCstCode(code) && !isCsosnCode(code)) {
    return `CST ${code} não é válido para Simples Nacional. Utilize um CSOSN (ex.: ${defaultTributacaoCode(regime)}).`;
  }
  if (!simples && isCsosnCode(code) && !isCstCode(code)) {
    return `CSOSN ${code} só pode ser usado por empresas do Simples Nacional. Utilize um CST (ex.: ${defaultTributacaoCode(regime)}).`;
  }
  return null;
}
