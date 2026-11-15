import { describe, expect, it } from "vitest";
import { groupPdvProducts, pdvDay, type PdvReportSale } from "./pdvDailyReport";

const sales: PdvReportSale[] = [
  { id: "sale1", date: "2026-11-16T01:00:00Z", cash_register_id: "cash1", attendant_id: "person1", sale_items: [{ product_id: "p1", product_name: "Café", quantity: 2, total: 20 }] },
  { id: "sale2", date: "2026-11-15T20:00:00Z", cash_register_id: "cash1", attendant_id: "person1", sale_items: [{ product_id: "p1", product_name: "Café", quantity: 3, total: 30 }] },
  { id: "sale3", date: "2026-11-15T20:00:00Z", cash_register_id: "cash2", attendant_id: "person2", sale_items: [{ product_id: "p1", product_name: "Café", quantity: 4, total: 40 }] },
];
const filters = { from: "2026-11-15", to: "2026-11-15", cash: "", attendant: "", product: "" };
describe("Produtos vendidos por dia no PDV", () => {
  it("usa o dia de São Paulo inclusive próximo à meia-noite UTC", () => { expect(pdvDay(sales[0].date)).toBe("2026-11-15"); });
  it("agrupa produto por dia, caixa e atendente sem misturar caixas", () => {
    const rows = groupPdvProducts(sales, filters);
    expect(rows).toHaveLength(2);
    expect(rows[0].quantity).toBe(5);
    expect(rows[0].total).toBe(50);
    expect(rows[0].saleIds.size).toBe(2);
    expect(rows[1].quantity).toBe(4);
  });
  it("combina filtros de caixa, atendente, produto e dia", () => {
    expect(groupPdvProducts(sales, { ...filters, cash: "cash2", attendant: "person2", product: "cafe" })[0].total).toBe(40);
    expect(groupPdvProducts(sales, { ...filters, cash: "cash1", attendant: "person2" })).toHaveLength(0);
    expect(groupPdvProducts(sales, { ...filters, from: "2026-11-16", to: "2026-11-16" })).toHaveLength(0);
  });
  it("não atribui vendas antigas ao proprietário por suposição", () => {
    const rows = groupPdvProducts([{ ...sales[0], attendant_id: null, cash_register_id: null }], filters);
    expect(rows[0].attendantId).toBe("unassigned");
    expect(rows[0].cashId).toBe("unassigned");
  });
});