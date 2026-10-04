import { describe, expect, it } from "vitest";
import { allocatePayments } from "./ledger";

const g = (gameId: number, playedOn: string, charge = 430) => ({ gameId, playedOn, charge });

describe("allocatePayments", () => {
  const three = [g(1, "2026-09-06"), g(2, "2026-09-13"), g(3, "2026-09-20")];

  it("applies a partial payment to the oldest game first", () => {
    const { games, credit } = allocatePayments(three, 500);
    expect(games.map((x) => [x.paid, x.due])).toEqual([
      [430, 0],
      [70, 360],
      [0, 430],
    ]);
    expect(credit).toBe(0);
  });

  it("settles everything when paid in full", () => {
    const { games, credit } = allocatePayments(three, 1290);
    expect(games.every((x) => x.due === 0)).toBe(true);
    expect(credit).toBe(0);
  });

  it("reports an overpayment as credit", () => {
    const { games, credit } = allocatePayments(three, 1500);
    expect(games.every((x) => x.due === 0)).toBe(true);
    expect(credit).toBe(210);
  });

  it("leaves everything due with no payments", () => {
    const { games } = allocatePayments(three, 0);
    expect(games.map((x) => x.due)).toEqual([430, 430, 430]);
  });

  it("orders by date regardless of input order", () => {
    const { games } = allocatePayments([three[2], three[0], three[1]], 430);
    expect(games.map((x) => x.gameId)).toEqual([1, 2, 3]);
    expect(games[0].due).toBe(0);
    expect(games[1].due).toBe(430);
  });

  it("handles a player with no games", () => {
    expect(allocatePayments([], 100)).toEqual({ games: [], credit: 100 });
  });

  it("per-game dues always add up to charges minus payments", () => {
    for (const paid of [0, 1, 429, 430, 431, 860, 1289, 1290, 5000]) {
      const { games, credit } = allocatePayments(three, paid);
      const due = games.reduce((s, x) => s + x.due, 0);
      expect(due - credit).toBe(1290 - paid);
    }
  });
});
