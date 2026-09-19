// Cobrança PIX pendente do PDV — permite recuperar a tela de pagamento
// após recarregar a página ou quando a confirmação do pagamento falhar.

import type { ChargeInstallment } from "@/components/cobrancas/CobrancaLinksDialog";

export interface PdvPixPending {
  chargeId: string;
  installment: ChargeInstallment | null;
  amount: number;
  customerName?: string;
  createdAt: number;
  /** Momento (epoch ms) em que o QR Code deixa de ser aceito. */
  expiresAt: number;
}

const KEY = "pdv_pix_pending";

export const PIX_EXPIRATION_MINUTES = 10;

export function setPdvPixPending(p: PdvPixPending) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignora indisponibilidade do storage */
  }
}

export function getPdvPixPending(): PdvPixPending | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PdvPixPending;
    return parsed?.chargeId ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPdvPixPending() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}
