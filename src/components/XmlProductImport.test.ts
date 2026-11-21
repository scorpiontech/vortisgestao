import { describe, it, expect } from "vitest";
import { calcSalePrice, calcMargin } from "./XmlProductImport";

describe("precificação XML", () => {
  it("custo 1,80 com impostos 10% e lucro 30% = 3,00", () =>
    expect(calcSalePrice(1.8, { taxes: 10, profit: 30, expenses: 0, freight: 0 })).toBe(3));
  it("frete soma ao custo base", () =>
    expect(calcSalePrice(8, { taxes: 0, profit: 50, expenses: 0, freight: 2 })).toBe(20));
  it("percentuais somando 100% são inválidos", () =>
    expect(calcSalePrice(10, { taxes: 50, profit: 50, expenses: 0, freight: 0 })).toBeNull());
  it("margem de custo 10 e venda 20 = 50%", () => expect(calcMargin(10, 20)).toBe(50));
});
