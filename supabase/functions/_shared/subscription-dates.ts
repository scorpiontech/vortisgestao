/** Calendar-only UTC dates avoid host timezone shifts; business today is São Paulo. */
export function billingToday(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
}

export function dueDateInMonth(dueDay: number, year: number, month: number): Date {
  const day = Math.min(Math.max(Math.trunc(dueDay || 10), 1), 31);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

export function computeNextDueDate(dueDay: number, today: Date): Date {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const candidate = dueDateInMonth(dueDay, year, month);
  return candidate < today ? dueDateInMonth(dueDay, year, month + 1) : candidate;
}