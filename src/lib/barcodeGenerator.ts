/**
 * Generates a unique barcode/SKU for products.
 * Uses a timestamp and a short random suffix to ensure uniqueness within the tenant.
 * Format: P[TIMESTAMP][RANDOM]
 */
export const generateProductBarcode = (): string => {
  const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `P${timestamp}${random}`;
};

/**
 * Validates if a string looks like a standard EAN-13 barcode.
 */
export const isValidEAN13 = (code: string): boolean => {
  return /^\d{13}$/.test(code);
};
