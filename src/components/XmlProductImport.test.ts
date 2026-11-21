import { describe, it, expect } from "vitest";
import { calcSalePrice, calcMargin } from "./XmlProductImport";

describe("precificação XML", () => {
  it("markup 30% sobre custo 10 = 13", () => expect(calcSalePrice(10, 30, "markup")).toBe(13));
  it("margem 50% sobre custo 10 = 20", () => expect(calcSalePrice(10, 50, "margin")).toBe(20));
  it("margem de custo 10 e venda 20 = 50%", () => expect(calcMargin(10, 20)).toBe(50));
});
