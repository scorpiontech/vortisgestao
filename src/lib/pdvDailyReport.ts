export interface PdvReportSale {
  id: string;
  date: string;
  attendant_id: string | null;
  cash_register_id: string | null;
  sale_items: { product_id: string | null; product_name: string; quantity: number; total: number }[];
}

export const pdvDay = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
};

export function groupPdvProducts(sales: PdvReportSale[], filters: { from: string; to: string; cash: string; attendant: string; product: string }) {
  const groups = new Map<string, { day: string; cashId: string; attendantId: string; product: string; quantity: number; total: number; saleIds: Set<string> }>();
  const search = filters.product.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  for (const sale of sales) {
    const day = pdvDay(sale.date);
    const cashId = sale.cash_register_id || "unassigned";
    const attendantId = sale.attendant_id || "unassigned";
    if (!day || (filters.from && day < filters.from) || (filters.to && day > filters.to)) continue;
    if ((filters.cash && filters.cash !== cashId) || (filters.attendant && filters.attendant !== attendantId)) continue;
    for (const item of sale.sale_items || []) {
      if (search && !item.product_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(search)) continue;
      const key = JSON.stringify([day, cashId, attendantId, item.product_id || item.product_name]);
      const row = groups.get(key) || { day, cashId, attendantId, product: item.product_name, quantity: 0, total: 0, saleIds: new Set<string>() };
      row.quantity += Number(item.quantity);
      row.total += Number(item.total);
      row.saleIds.add(sale.id);
      groups.set(key, row);
    }
  }
  return [...groups.values()].sort((a, b) => b.day.localeCompare(a.day) || a.cashId.localeCompare(b.cashId) || a.attendantId.localeCompare(b.attendantId) || a.product.localeCompare(b.product));
}