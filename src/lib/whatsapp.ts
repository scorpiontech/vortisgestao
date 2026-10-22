/** Normaliza telefone brasileiro para formato wa.me (55 + DDD + número). Retorna null se inválido. */
export function normalizeWhatsappPhone(raw: string | null | undefined): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return null;
  d = d.replace(/^0+/, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return null;
}

export type WhatsappMode = "desktop" | "web";
const MODE_KEY = "vortis:wa_mode";
const WA_WINDOW_NAME = "vortis_whatsapp";

export function getWhatsappMode(): WhatsappMode {
  return localStorage.getItem(MODE_KEY) === "web" ? "web" : "desktop";
}
export function setWhatsappMode(m: WhatsappMode) {
  localStorage.setItem(MODE_KEY, m);
}

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Chamar no clique (antes de qualquer await). No modo navegador reserva a aba
 * nomeada para não ser bloqueada como pop-up. No modo app não abre nada.
 */
export function prepareWhatsappWindow(): Window | null {
  if (isMobile() || getWhatsappMode() === "desktop") return null;
  return window.open("", WA_WINDOW_NAME);
}

/** Envia a mensagem: app instalado (sem abas), celular (app) ou aba única do WhatsApp Web. */
export function openWhatsapp(phone: string, message: string, win?: Window | null) {
  const text = encodeURIComponent(message);
  if (isMobile()) {
    window.location.href = `https://wa.me/${phone}?text=${text}`;
    return;
  }
  if (getWhatsappMode() === "desktop") {
    window.location.href = `whatsapp://send?phone=${phone}&text=${text}`;
    return;
  }
  const url = `https://web.whatsapp.com/send?phone=${phone}&text=${text}`;
  if (win && !win.closed) {
    try { win.location.href = url; win.focus(); return; } catch { /* segue */ }
  }
  window.open(url, WA_WINDOW_NAME)?.focus();
}
