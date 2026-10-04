import { describe, expect, it } from "vitest";
import { formatTaka, perHeadCharge, surplus } from "./money";

describe("perHeadCharge", () => {
  it("divides evenly without change", () => {
    expect(perHeadCharge(3000, 6)).toBe(500);
    expect(surplus(3000, 6)).toBe(0);
  });

  it("rounds up when it does not divide (3000 / 7)", () => {
    expect(perHeadCharge(3000, 7)).toBe(429);
    expect(surplus(3000, 7)).toBe(3); // 429*7 = 3003
  });

  it("never undercharges: total collected >= total cost", () => {
    for (let total = 0; total <= 500; total += 7) {
      for (let n = 1; n <= 22; n++) {
        const share = perHeadCharge(total, n);
        expect(share * n).toBeGreaterThanOrEqual(total);
        expect(share * n - total).toBeLessThan(n); // surplus is under 1 taka per head
      }
    }
  });

  it("one player pays everything", () => {
    expect(perHeadCharge(1250, 1)).toBe(1250);
  });

  it("zero total costs nothing", () => {
    expect(perHeadCharge(0, 5)).toBe(0);
  });

  it("rejects bad input", () => {
    expect(() => perHeadCharge(100, 0)).toThrow(RangeError);
    expect(() => perHeadCharge(-1, 3)).toThrow(RangeError);
    expect(() => perHeadCharge(10.5, 3)).toThrow(RangeError);
    expect(() => perHeadCharge(10, 2.5)).toThrow(RangeError);
  });
});

describe("formatTaka", () => {
  it("formats with grouping and sign", () => {
    expect(formatTaka(1234)).toBe("৳1,234");
    expect(formatTaka(0)).toBe("৳0");
    expect(formatTaka(-50)).toBe("-৳50");
  });
});
