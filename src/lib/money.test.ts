import { describe, expect, it } from "vitest";
import { computeCharges, formatTaka, perHeadCharge, surplus } from "./money";

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

describe("computeCharges", () => {
  const BOSS = 100;

  it("worked example: guest excluded, transfer billed to a sponsor who isn't playing", () => {
    // ৳3000, 8 played: 6 normal, Rafid (7) covered by the boss, Imran (8) a guest
    const attendees = [
      ...[1, 2, 3, 4, 5, 6].map((playerId) => ({ playerId })),
      { playerId: 7, billedToId: BOSS },
      { playerId: 8, guest: true },
    ];
    const r = computeCharges(3000, attendees);
    expect(r.headcount).toBe(7); // Imran is excluded
    expect(r.perHead).toBe(429); // ceil(3000 / 7)
    expect(r.surplus).toBe(3);

    const imran = r.lines.find((l) => l.playerId === 8)!;
    expect(imran).toEqual({ playerId: 8, guest: true, charge: 0, billedToId: null });
    const rafid = r.lines.find((l) => l.playerId === 7)!;
    expect(rafid).toEqual({ playerId: 7, guest: false, charge: 429, billedToId: BOSS });

    const billed = r.lines.reduce((s, l) => s + l.charge, 0);
    expect(billed).toBe(3003); // collections >= cost
  });

  it("with no guests or transfers it matches the plain split", () => {
    const r = computeCharges(1100, [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }]);
    expect(r.perHead).toBe(367);
    expect(r.surplus).toBe(1);
    expect(r.lines.every((l) => l.billedToId === null && !l.guest)).toBe(true);
  });

  it("a sponsor who also plays can be billed for several people", () => {
    const r = computeCharges(900, [
      { playerId: 1 },
      { playerId: 2, billedToId: 1 },
      { playerId: 3, billedToId: 1 },
    ]);
    expect(r.perHead).toBe(300);
    expect(r.lines.filter((l) => (l.billedToId ?? l.playerId) === 1).length).toBe(3);
  });

  it("never undercharges whatever the mix of guests", () => {
    for (let total = 1; total <= 400; total += 13) {
      for (let payers = 1; payers <= 12; payers++) {
        for (let guests = 0; guests <= 3; guests++) {
          const attendees = [
            ...Array.from({ length: payers }, (_, i) => ({ playerId: i + 1 })),
            ...Array.from({ length: guests }, (_, i) => ({ playerId: 1000 + i, guest: true })),
          ];
          const r = computeCharges(total, attendees);
          expect(r.lines.reduce((s, l) => s + l.charge, 0)).toBeGreaterThanOrEqual(total);
          expect(r.surplus).toBeLessThan(payers);
        }
      }
    }
  });

  it("rejects invalid combinations", () => {
    expect(() => computeCharges(100, [{ playerId: 1, guest: true }])).toThrow(/at least one player must pay/i);
    expect(() => computeCharges(100, [{ playerId: 1, billedToId: 1 }])).toThrow(/cover themselves/i);
    expect(() => computeCharges(100, [{ playerId: 1 }, { playerId: 2, guest: true, billedToId: 1 }])).toThrow(/guest can't be covered/i);
    expect(() => computeCharges(100, [{ playerId: 1, billedToId: 2 }, { playerId: 2, guest: true }])).toThrow(/is a guest/i);
    expect(() => computeCharges(100, [{ playerId: 1 }, { playerId: 1 }])).toThrow(/listed twice/i);
  });
});
