/** Normaliza telefone brasileiro para formato wa.me (55 + DDD + número). Retorna null se inválido. */
export function normalizeWhatsappPhone(raw: string | null | undefined): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return null;
  d = d.replace(/^0+/, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return null;
}

const WA_WINDOW_NAME = "vortis_whatsapp";
let waWindow: Window | null = null;

/** Abre o WhatsApp reaproveitando sempre a mesma aba (no celular usa o app). */
export function openWhatsapp(phone: string, message: string) {
  const text = encodeURIComponent(message);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = `https://wa.me/${phone}?text=${text}`;
    return;
  }
  const url = `https://web.whatsapp.com/send?phone=${phone}&text=${text}`;
  if (waWindow && !waWindow.closed) {
    try {
      waWindow.location.href = url;
      waWindow.focus();
      return;
    } catch {
      /* cai para abertura nomeada */
    }
  }
  waWindow = window.open(url, WA_WINDOW_NAME);
  waWindow?.focus();
}
