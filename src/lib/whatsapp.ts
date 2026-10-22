/** Normaliza telefone brasileiro para formato wa.me (55 + DDD + número). Retorna null se inválido. */
export function normalizeWhatsappPhone(raw: string | null | undefined): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return null;
  d = d.replace(/^0+/, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return null;
}

export function openWhatsapp(phone: string, message: string) {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
