export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/**
 * Máscara CNPJ — agora aceita o formato alfanumérico definido pela
 * Receita Federal (IN RFB 2.229/2024): 12 primeiras posições aceitam
 * letras maiúsculas (A-Z) ou dígitos (0-9), as 2 últimas (DV) são
 * sempre numéricas. Formato visual mantido: 00.000.000/0000-00.
 */
export function formatCNPJ(value: string): string {
  // Mantém apenas alfanuméricos, transforma letras em maiúsculas
  const raw = (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Primeiras 12 posições: alfanuméricas | últimas 2: só dígitos
  const base = raw.slice(0, 12);
  const dv = raw.slice(12, 14).replace(/\D/g, "");
  const all = (base + dv).slice(0, 14);

  return all
    .replace(/([A-Z0-9]{2})([A-Z0-9])/, "$1.$2")
    .replace(/([A-Z0-9]{3})([A-Z0-9])/, "$1.$2")
    .replace(/([A-Z0-9]{3})([A-Z0-9])/, "$1/$2")
    .replace(/([A-Z0-9]{4})(\d{1,2})$/, "$1-$2");
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, "$1-$2");
}

export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10]);
}

/**
 * Limpa um CNPJ deixando apenas alfanuméricos (A-Z maiúsculas e 0-9).
 */
export function cleanCNPJ(cnpj: string): string {
  return (cnpj || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Indica se o CNPJ informado é puramente numérico (formato legado).
 * Útil para decidir se podemos consultar APIs externas que ainda não
 * suportam o CNPJ alfanumérico.
 */
export function isNumericCNPJ(cnpj: string): boolean {
  const clean = cleanCNPJ(cnpj);
  return clean.length === 14 && /^\d{14}$/.test(clean);
}

/**
 * Validação de CNPJ compatível com o novo formato alfanumérico.
 * Algoritmo oficial (Receita Federal):
 *   - 12 primeiras posições: aceitam A-Z (maiúsculas) ou 0-9
 *   - 2 últimas posições: dígitos verificadores numéricos
 *   - Valor de cada caractere = código ASCII - 48
 *     (assim '0'=0, '9'=9, 'A'=17, 'Z'=42)
 *   - Mesmos pesos do CNPJ tradicional:
 *     DV1 = [5,4,3,2,9,8,7,6,5,4,3,2]
 *     DV2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
 */
export function validateCNPJ(cnpj: string): boolean {
  const clean = cleanCNPJ(cnpj);
  if (clean.length !== 14) return false;
  // Os 2 últimos devem ser numéricos
  if (!/^\d{2}$/.test(clean.slice(12))) return false;
  // Rejeita sequências repetidas (ex.: 00000000000000, AAAAAAAAAAAA00)
  if (/^(.)\1{11}\d{2}$/.test(clean)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const val = (c: string) => c.charCodeAt(0) - 48;

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += val(clean[i]) * weights1[i];
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (parseInt(clean[12]) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += val(clean[i]) * weights2[i];
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  return parseInt(clean[13]) === d2;
}
