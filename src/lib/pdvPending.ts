// Shared "pending sale" payload passed from Orçamentos / Ordens de Serviço to the PDV.
// The PDV (Vendas) loads it on mount, lets the operator finalize, and on success
// updates the source record (quote → convertido / OS → paid).

export interface PdvPendingItem {
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PdvPending {
  source: "quote" | "service_order";
  sourceId: string;
  sourceLabel?: string; // short description shown in PDV banner
  customerId?: string | null;
  customerName?: string;
  items: PdvPendingItem[];
  paymentMethod?: string;
  installments?: number;
  /** Discount already in BRL (value, not percent). */
  discountValue?: number;
  /** Optional note appended to the quote negotiation log. */
  note?: string;
}

const KEY = "pdv_pending";

export function setPdvPending(p: PdvPending) {
  sessionStorage.setItem(KEY, JSON.stringify(p));
}

export function getPdvPending(): PdvPending | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PdvPending) : null;
  } catch {
    return null;
  }
}

export function clearPdvPending() {
  sessionStorage.removeItem(KEY);
}
