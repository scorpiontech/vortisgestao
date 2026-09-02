/**
 * Atalhos de período para os relatórios.
 */

export type PeriodPresetKey =
  | "hoje"
  | "ontem"
  | "7dias"
  | "esteMes"
  | "mesPassado"
  | "esteAno"
  | "todos";

export interface PeriodRange {
  from: string;
  to: string;
}

const iso = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

export const PERIOD_PRESETS: { key: PeriodPresetKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7dias", label: "7 dias" },
  { key: "esteMes", label: "Este mês" },
  { key: "mesPassado", label: "Mês passado" },
  { key: "esteAno", label: "Este ano" },
  { key: "todos", label: "Todos" },
];

export function resolvePeriodPreset(key: PeriodPresetKey): PeriodRange {
  const now = new Date();
  switch (key) {
    case "hoje":
      return { from: iso(now), to: iso(now) };
    case "ontem": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: iso(y), to: iso(y) };
    }
    case "7dias": {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { from: iso(s), to: iso(now) };
    }
    case "esteMes":
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
    case "mesPassado": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: iso(start), to: iso(end) };
    }
    case "esteAno":
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
    case "todos":
    default:
      return { from: "", to: "" };
  }
}

export function formatDateBR(value?: string | null) {
  if (!value) return "";
  const d = value.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

export function periodLabel(from: string, to: string) {
  if (!from && !to) return "Todos os períodos";
  return `${from ? formatDateBR(from) : "início"} a ${to ? formatDateBR(to) : "hoje"}`;
}

/** Monta a lista de filtros aplicados para o cabeçalho dos arquivos gerados. */
export function buildFilterLines(entries: Record<string, string | undefined | null>) {
  return Object.entries(entries)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${v}`);
}
