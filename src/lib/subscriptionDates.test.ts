import { describe, expect, it } from "vitest";
import { billingToday, computeNextDueDate, dueDateInMonth } from "../../supabase/functions/_shared/subscription-dates";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("subscription due dates", () => {
  it("keeps Re Farma's configured day 30 in November 2026", () => {
    expect(iso(computeNextDueDate(30, billingToday(new Date("2026-11-21T17:17:00Z"))))).toBe("2026-11-30");
  });
  it("uses the last actual day only when the configured day does not exist", () => {
    expect(iso(dueDateInMonth(30, 2026, 1))).toBe("2026-02-28");
    expect(iso(dueDateInMonth(30, 2028, 1))).toBe("2028-02-29");
    expect(iso(dueDateInMonth(31, 2026, 10))).toBe("2026-11-30");
    expect(iso(dueDateInMonth(31, 2026, 11))).toBe("2026-12-31");
  });
  it("recalculates the next month instead of overflowing into March", () => {
    expect(iso(computeNextDueDate(30, new Date("2026-01-31T00:00:00Z")))).toBe("2026-02-28");
  });
  it("does not advance to next month on the due day", () => {
    expect(iso(computeNextDueDate(30, billingToday(new Date("2026-11-30T17:17:00Z"))))).toBe("2026-11-30");
  });
  it("uses the Brazilian calendar date near UTC midnight", () => {
    expect(iso(billingToday(new Date("2026-12-01T01:00:00Z")))).toBe("2026-11-30");
  });
});